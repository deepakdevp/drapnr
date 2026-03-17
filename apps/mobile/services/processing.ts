// =============================================================================
// Processing Service
// =============================================================================
// Handles triggering the server-side outfit processing pipeline and polling
// for job status updates.
// =============================================================================

import { supabase, fetchProcessingJob } from './supabase';
import type { ProcessingJob, ProcessingStatus, ApiResponse } from '../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TriggerProcessingParams {
  outfitId: string;
  frameUrls: string[];
}

export interface ProcessingStatusResult {
  jobId: string;
  status: ProcessingStatus;
  progress: number;
  errorMessage: string | null;
}

// -----------------------------------------------------------------------------
// Trigger Processing
// -----------------------------------------------------------------------------

/**
 * Calls the Supabase Edge Function `process-video` to kick off the
 * server-side processing pipeline (frame extraction, garment segmentation,
 * texture mapping).
 */
export async function triggerProcessing(
  params: TriggerProcessingParams,
): Promise<ApiResponse<ProcessingJob>> {
  const { data, error } = await supabase.functions.invoke<{
    job: {
      id: string;
      outfit_id: string;
      user_id: string;
      status: ProcessingStatus;
      progress: number;
      error_message: string | null;
      created_at: string;
      completed_at: string | null;
    };
  }>('process-video', {
    body: {
      outfit_id: params.outfitId,
      frame_urls: params.frameUrls,
    },
  });

  if (error) {
    return {
      data: null,
      error: {
        code: 'PROCESSING_TRIGGER_FAILED',
        message: error.message ?? 'Failed to trigger processing',
      },
    };
  }

  if (!data?.job) {
    return {
      data: null,
      error: { code: 'PROCESSING_NO_JOB', message: 'No job returned from edge function' },
    };
  }

  const job: ProcessingJob = {
    id: data.job.id,
    outfitId: data.job.outfit_id,
    userId: data.job.user_id,
    status: data.job.status,
    progress: data.job.progress,
    errorMessage: data.job.error_message,
    createdAt: data.job.created_at,
    completedAt: data.job.completed_at,
  };

  return { data: job, error: null };
}

// -----------------------------------------------------------------------------
// Poll Status
// -----------------------------------------------------------------------------

/**
 * Polls the processing_jobs table for the current status of a job.
 * Returns a simplified status result.
 */
export async function pollStatus(jobId: string): Promise<ApiResponse<ProcessingStatusResult>> {
  const response = await fetchProcessingJob(jobId);

  if (response.error || !response.data) {
    return {
      data: null,
      error: response.error ?? { code: 'POLL_FAILED', message: 'Job not found' },
    };
  }

  return {
    data: {
      jobId: response.data.id,
      status: response.data.status,
      progress: response.data.progress,
      errorMessage: response.data.errorMessage,
    },
    error: null,
  };
}

// -----------------------------------------------------------------------------
// Polling Loop Helper
// -----------------------------------------------------------------------------

/**
 * Repeatedly polls job status at the given interval until the job reaches
 * a terminal state ('complete' | 'failed') or the optional abort signal fires.
 */
export async function pollUntilComplete(
  jobId: string,
  options: {
    intervalMs?: number;
    onProgress?: (result: ProcessingStatusResult) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ApiResponse<ProcessingStatusResult>> {
  const { intervalMs = 2000, onProgress, signal } = options;

  const TERMINAL_STATUSES: ProcessingStatus[] = ['complete', 'failed'];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      return {
        data: null,
        error: { code: 'ABORTED', message: 'Polling was aborted' },
      };
    }

    const result = await pollStatus(jobId);

    if (result.error) return result;
    if (!result.data) {
      return { data: null, error: { code: 'POLL_EMPTY', message: 'Empty poll response' } };
    }

    onProgress?.(result.data);

    if (TERMINAL_STATUSES.includes(result.data.status)) {
      return result;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}
