// =============================================================================
// Capture Store (Zustand)
// =============================================================================

import { create } from 'zustand';

import type { ProcessingStatus } from '../types';

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface CaptureState {
  isRecording: boolean;
  rotation: number;
  frames: string[];
  processingJobId: string | null;
  processingStatus: ProcessingStatus;
  processingProgress: number;
}

interface CaptureActions {
  startRecording: () => void;
  stopRecording: () => void;
  addFrame: (uri: string) => void;
  updateRotation: (degrees: number) => void;
  startProcessing: () => Promise<string>;
  pollProcessingStatus: (jobId: string) => Promise<void>;
  reset: () => void;
}

type CaptureStore = CaptureState & CaptureActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const INITIAL_STATE: CaptureState = {
  isRecording: false,
  rotation: 0,
  frames: [],
  processingJobId: null,
  processingStatus: 'idle',
  processingProgress: 0,
};

// Simulate the processing pipeline stages with realistic durations.
const PROCESSING_STAGES: { status: ProcessingStatus; durationMs: number; progressEnd: number }[] = [
  { status: 'uploading', durationMs: 1200, progressEnd: 15 },
  { status: 'extracting', durationMs: 1500, progressEnd: 40 },
  { status: 'segmenting', durationMs: 2000, progressEnd: 75 },
  { status: 'mapping', durationMs: 1800, progressEnd: 95 },
  { status: 'complete', durationMs: 500, progressEnd: 100 },
];

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  ...INITIAL_STATE,

  // -- Actions ----------------------------------------------------------------

  startRecording: () => {
    set({ isRecording: true, frames: [], rotation: 0, processingStatus: 'idle', processingProgress: 0 });
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  addFrame: (uri) => {
    set((state) => ({ frames: [...state.frames, uri] }));
  },

  updateRotation: (degrees) => {
    // Clamp to 0-360
    const normalized = ((degrees % 360) + 360) % 360;
    set({ rotation: normalized });
  },

  startProcessing: async () => {
    const jobId = `job_${Date.now().toString(36)}`;
    set({ processingJobId: jobId, processingStatus: 'uploading', processingProgress: 0 });

    // Walk through each mock processing stage
    for (const stage of PROCESSING_STAGES) {
      // Check if we've been reset in the meantime
      if (get().processingJobId !== jobId) break;

      set({ processingStatus: stage.status });

      // Simulate incremental progress within this stage
      const previousProgress = get().processingProgress;
      const steps = 5;
      const stepDuration = stage.durationMs / steps;
      const progressIncrement = (stage.progressEnd - previousProgress) / steps;

      for (let i = 1; i <= steps; i++) {
        if (get().processingJobId !== jobId) break;
        await delay(stepDuration);
        set({ processingProgress: Math.round(previousProgress + progressIncrement * i) });
      }
    }

    return jobId;
  },

  pollProcessingStatus: async (jobId) => {
    // Mock: the processing is simulated inside startProcessing, so polling
    // simply reads the current state. In production this would query the
    // processing_jobs table via Supabase.
    await delay(500);
    const { processingJobId, processingStatus, processingProgress } = get();
    if (processingJobId === jobId) {
      set({ processingStatus, processingProgress });
    }
  },

  reset: () => {
    set({ ...INITIAL_STATE });
  },
}));
