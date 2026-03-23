// =============================================================================
// Capture Store (Zustand)
// =============================================================================
// Real capture flow: upload frames to Supabase Storage, trigger the
// server-side processing edge function, and poll for status updates.
// =============================================================================

import { create } from 'zustand';
import * as FileSystem from 'expo-file-system';

import type { ProcessingStatus } from '../types';
import { supabase } from '../services/supabase';
import {
  triggerProcessing as triggerProcessingService,
  pollUntilComplete,
} from '../services/processing';
import { useWardrobeStore } from './wardrobeStore';
import { createLogger } from '../utils/logger';

const log = createLogger('captureStore');

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface CaptureState {
  isRecording: boolean;
  rotation: number;
  frames: string[];
  outfitName: string;
  outfitId: string | null;
  processingJobId: string | null;
  processingStatus: ProcessingStatus;
  processingProgress: number;
  uploadedFramePaths: string[];
  error: string | null;
}

interface UploadResult {
  success: boolean;
  error?: string;
}

interface CaptureActions {
  startRecording: () => void;
  stopRecording: () => void;
  addFrame: (uri: string) => void;
  updateRotation: (degrees: number) => void;
  startCapture: () => void;
  stopCapture: () => void;
  uploadFrames: (outfitName: string) => Promise<UploadResult>;
  triggerProcessing: () => Promise<UploadResult>;
  pollProcessingStatus: (jobId: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

type CaptureStore = CaptureState & CaptureActions;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FRAMES_BUCKET = 'capture-frames';

const INITIAL_STATE: CaptureState = {
  isRecording: false,
  rotation: 0,
  frames: [],
  outfitName: '',
  outfitId: null,
  processingJobId: null,
  processingStatus: 'idle',
  processingProgress: 0,
  uploadedFramePaths: [],
  error: null,
};

// Abort controller for cancelling polling when reset is called
let pollAbortController: AbortController | null = null;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function readFileAsBase64(uri: string): Promise<string> {
  const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
  return FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------

  clearError: () => set({ error: null }),

  startRecording: () => {
    set({
      isRecording: true,
      frames: [],
      rotation: 0,
      processingStatus: 'idle',
      processingProgress: 0,
      outfitId: null,
      processingJobId: null,
      uploadedFramePaths: [],
      error: null,
    });
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  startCapture: () => {
    // Cancel any existing polling
    if (pollAbortController) {
      pollAbortController.abort();
      pollAbortController = null;
    }

    set({
      isRecording: true,
      frames: [],
      rotation: 0,
      processingStatus: 'idle',
      processingProgress: 0,
      outfitId: null,
      processingJobId: null,
      uploadedFramePaths: [],
      error: null,
    });
  },

  stopCapture: () => {
    set({ isRecording: false });
  },

  addFrame: (uri) => {
    set((state) => ({ frames: [...state.frames, uri] }));
  },

  updateRotation: (degrees) => {
    const normalized = Math.min(Math.max(degrees, 0), 360);
    set({ rotation: normalized });
  },

  /**
   * Uploads captured frames from local URIs to Supabase Storage.
   * Creates an outfit record in the database first, then uploads
   * each frame to `frames/{userId}/{outfitId}/frame_NNNN.jpg`.
   */
  uploadFrames: async (outfitName) => {
    const { frames } = get();

    if (frames.length === 0) {
      set({ error: 'No frames to upload' });
      return { success: false, error: 'No frames to upload' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      set({ error: 'Not authenticated' });
      return { success: false, error: 'Not authenticated' };
    }

    set({
      processingStatus: 'uploading',
      processingProgress: 0,
      outfitName,
      error: null,
    });

    try {
      // Create an outfit record in the database
      const { data: outfitData, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: userId,
          name: outfitName,
          status: 'pending',
          captured_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (outfitError) {
        const msg = `Failed to create outfit: ${outfitError.message}`;
        set({ processingStatus: 'failed', error: msg });
        return { success: false, error: msg };
      }

      const actualOutfitId = outfitData?.id;
      set({ outfitId: actualOutfitId });

      // Upload each frame to Supabase Storage
      const uploadedPaths: string[] = [];
      const totalFrames = frames.length;

      for (let i = 0; i < totalFrames; i++) {
        const frameUri = frames[i];
        const storagePath = `${userId}/${actualOutfitId}/frame_${String(i + 1).padStart(3, '0')}.jpg`;

        try {
          const base64Data = await readFileAsBase64(frameUri);
          const arrayBuffer = base64ToArrayBuffer(base64Data);

          const { error: uploadError } = await supabase.storage
            .from(FRAMES_BUCKET)
            .upload(storagePath, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            const msg = `Failed to upload frame ${i + 1}: ${uploadError.message}`;
            log.warn(msg);
            set({ processingStatus: 'failed', error: msg });
            return { success: false, error: msg };
          }

          uploadedPaths.push(storagePath);

          // Update progress (upload phase = 0-50%)
          const uploadProgress = Math.round(((i + 1) / totalFrames) * 50);
          set({ processingProgress: uploadProgress });
        } catch (fileError) {
          const msg = `Failed to read frame ${i + 1} from disk`;
          log.warn('Error reading frame:', fileError);
          set({ processingStatus: 'failed', error: msg });
          return { success: false, error: msg };
        }
      }

      set({
        uploadedFramePaths: uploadedPaths,
        processingProgress: 50,
      });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Upload failed';
      set({ processingStatus: 'failed', error: msg });
      return { success: false, error: msg };
    }
  },

  /**
   * Calls the Supabase Edge Function `process-video` to start server-side
   * processing. Must be called after uploadFrames succeeds.
   */
  triggerProcessing: async () => {
    const { outfitId, uploadedFramePaths } = get();

    if (!outfitId) {
      set({ error: 'No outfit ID' });
      return { success: false, error: 'No outfit ID' };
    }

    if (uploadedFramePaths.length === 0) {
      set({ error: 'No uploaded frames' });
      return { success: false, error: 'No uploaded frames' };
    }

    set({ processingStatus: 'extracting', processingProgress: 55, error: null });

    try {
      // Build public URLs for uploaded frames
      const frameUrls = uploadedFramePaths.map((path) => {
        const { data } = supabase.storage
          .from(FRAMES_BUCKET)
          .getPublicUrl(path);
        return data.publicUrl;
      });

      // Call the Edge Function
      const result = await triggerProcessingService({
        outfitId,
        frameUrls,
      });

      if (result.error || !result.data) {
        const msg = result.error?.message ?? 'Failed to trigger processing';
        set({ processingStatus: 'failed', error: msg });
        return { success: false, error: msg };
      }

      set({
        processingJobId: result.data.id,
        processingStatus: result.data.status,
        processingProgress: 60,
      });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Processing trigger failed';
      set({ processingStatus: 'failed', error: msg });
      return { success: false, error: msg };
    }
  },

  /**
   * Polls the processing_jobs table every 3 seconds until the job reaches
   * a terminal state. Updates progress and status in the store.
   * When processing completes, triggers a wardrobe refresh.
   */
  pollProcessingStatus: async (jobId) => {
    // Cancel any existing polling
    if (pollAbortController) {
      pollAbortController.abort();
    }
    pollAbortController = new AbortController();

    try {
      const result = await pollUntilComplete(jobId, {
        intervalMs: 3000,
        signal: pollAbortController.signal,
        onProgress: (status) => {
          const currentJobId = get().processingJobId;
          if (currentJobId === jobId) {
            set({
              processingStatus: status.status,
              processingProgress: Math.max(60, status.progress),
            });
          }
        },
      });

      if (result.error) {
        set({
          processingStatus: 'failed',
          error: result.error.message,
        });
        return;
      }

      if (result.data) {
        set({
          processingStatus: result.data.status,
          processingProgress: result.data.status === 'complete' ? 100 : get().processingProgress,
        });

        // If processing completed successfully, refresh the wardrobe
        if (result.data.status === 'complete') {
          const { outfitId } = get();
          if (outfitId) {
            useWardrobeStore.getState().refreshAfterProcessing(outfitId);
          }
        }

        if (result.data.status === 'failed') {
          set({ error: result.data.errorMessage ?? 'Processing failed.' });
        }
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err?.name === 'AbortError') return;

      set({
        processingStatus: 'failed',
        error: err?.message ?? 'Failed to check processing status.',
      });
    } finally {
      pollAbortController = null;
    }
  },

  reset: () => {
    // Abort any active polling
    if (pollAbortController) {
      pollAbortController.abort();
      pollAbortController = null;
    }

    set({ ...INITIAL_STATE });
  },
}));
