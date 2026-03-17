// =============================================================================
// Capture Store (Zustand)
// =============================================================================
// Manages capture state, frame storage, upload to Supabase Storage, and
// triggering server-side processing.
// =============================================================================

import { create } from 'zustand';
import * as FileSystem from 'expo-file-system';

import type { ProcessingStatus } from '../types';
import { supabase } from '../services/supabase';
import {
  triggerProcessing as triggerProcessingService,
  pollUntilComplete,
} from '../services/processing';

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
  uploadFrames: (outfitName: string) => Promise<UploadResult>;
  triggerProcessing: () => Promise<UploadResult>;
  pollProcessingStatus: (jobId: string) => Promise<void>;
  reset: () => void;
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
};

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
    });
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  addFrame: (uri) => {
    set((state) => ({ frames: [...state.frames, uri] }));
  },

  updateRotation: (degrees) => {
    const normalized = Math.min(Math.max(degrees, 0), 360);
    set({ rotation: normalized });
  },

  uploadFrames: async (outfitName) => {
    const { frames } = get();

    if (frames.length === 0) {
      return { success: false, error: 'No frames to upload' };
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    set({
      processingStatus: 'uploading',
      processingProgress: 0,
      outfitName,
    });

    try {
      // Create an outfit record in the database
      const outfitId = `outfit_${Date.now().toString(36)}`;
      const { data: outfitData, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          id: outfitId,
          user_id: userId,
          name: outfitName,
          status: 'pending',
          captured_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (outfitError) {
        set({ processingStatus: 'failed' });
        return {
          success: false,
          error: `Failed to create outfit: ${outfitError.message}`,
        };
      }

      const actualOutfitId = outfitData?.id ?? outfitId;
      set({ outfitId: actualOutfitId });

      // Upload each frame to Supabase Storage
      const uploadedPaths: string[] = [];
      const totalFrames = frames.length;

      for (let i = 0; i < totalFrames; i++) {
        const frameUri = frames[i];
        const storagePath = `${userId}/${actualOutfitId}/frame_${String(i).padStart(4, '0')}.jpg`;

        try {
          // Read file as base64 and convert to array buffer for upload
          const base64Data = await readFileAsBase64(frameUri);
          const arrayBuffer = base64ToArrayBuffer(base64Data);

          const { error: uploadError } = await supabase.storage
            .from(FRAMES_BUCKET)
            .upload(storagePath, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            console.warn(
              `[captureStore] Failed to upload frame ${i}:`,
              uploadError.message,
            );
            set({ processingStatus: 'failed' });
            return {
              success: false,
              error: `Failed to upload frame ${i + 1}: ${uploadError.message}`,
            };
          }

          uploadedPaths.push(storagePath);

          // Update progress (upload phase = 0-50%)
          const uploadProgress = Math.round(((i + 1) / totalFrames) * 50);
          set({ processingProgress: uploadProgress });
        } catch (fileError) {
          console.warn(
            `[captureStore] Error reading frame ${i}:`,
            fileError,
          );
          set({ processingStatus: 'failed' });
          return {
            success: false,
            error: `Failed to read frame ${i + 1} from disk`,
          };
        }
      }

      set({
        uploadedFramePaths: uploadedPaths,
        processingProgress: 50,
      });

      return { success: true };
    } catch (error) {
      set({ processingStatus: 'failed' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  },

  triggerProcessing: async () => {
    const { outfitId, uploadedFramePaths } = get();

    if (!outfitId) {
      return { success: false, error: 'No outfit ID' };
    }

    if (uploadedFramePaths.length === 0) {
      return { success: false, error: 'No uploaded frames' };
    }

    set({ processingStatus: 'extracting', processingProgress: 55 });

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
        set({ processingStatus: 'failed' });
        return {
          success: false,
          error: result.error?.message ?? 'Failed to trigger processing',
        };
      }

      set({
        processingJobId: result.data.id,
        processingStatus: result.data.status,
        processingProgress: 60,
      });

      return { success: true };
    } catch (error) {
      set({ processingStatus: 'failed' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing trigger failed',
      };
    }
  },

  pollProcessingStatus: async (jobId) => {
    try {
      const result = await pollUntilComplete(jobId, {
        intervalMs: 2000,
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

      if (result.data) {
        set({
          processingStatus: result.data.status,
          processingProgress: result.data.status === 'complete' ? 100 : get().processingProgress,
        });
      }
    } catch {
      // Polling error — status will be stale until next poll
    }
  },

  reset: () => {
    set({ ...INITIAL_STATE });
  },
}));
