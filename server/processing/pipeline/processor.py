"""
Pipeline orchestrator — ties together every stage of Drapnr's processing
pipeline and tracks progress for each job.

Robustness features:
- Job timeout (max 10 minutes per job).
- Stage-level error recovery (retry failed stage once before failing job).
- Detailed logging with structured JSON output.
- Metrics collection (processing time per stage).
- Job cleanup (remove old completed jobs after 1 hour).

Stages and their progress weight:
  1. Frame download       (0 – 15 %)
  2. Segmentation         (15 – 55 %)
  3. Classification       (55 – 65 %)
  4. Texture mapping      (65 – 85 %)
  5. Upload & callback    (85 – 100 %)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional, TypeVar

import numpy as np
from numpy.typing import NDArray

from pipeline.classification import (
    ClassifiedRegion,
    GarmentCategory,
    classify_all_frames,
)
from pipeline.frame_extraction import download_and_preprocess_frames
from pipeline.segmentation import segment_frames
from pipeline.texture_mapping import generate_all_textures, generate_all_textures_with_metadata
from pipeline.upload import upload_results, cleanup_temp_files

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_JOB_TIMEOUT_SECONDS = 600  # 10 minutes
_JOB_CLEANUP_AGE_SECONDS = 3600  # 1 hour
_STAGE_MAX_RETRIES = 1  # Retry a failed stage once

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Structured logging helper
# ---------------------------------------------------------------------------

def _log_structured(
    level: int,
    message: str,
    *,
    job_id: Optional[str] = None,
    stage: Optional[str] = None,
    duration_ms: Optional[float] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Emit a structured JSON log line alongside the human-readable message.

    Parameters
    ----------
    level:
        Logging level (e.g. logging.INFO).
    message:
        Human-readable log message.
    job_id:
        Processing job identifier.
    stage:
        Current pipeline stage.
    duration_ms:
        Stage duration in milliseconds.
    extra:
        Additional key-value pairs to include.
    """
    structured: Dict[str, Any] = {
        "msg": message,
        "ts": time.time(),
    }
    if job_id:
        structured["job_id"] = job_id
    if stage:
        structured["stage"] = stage
    if duration_ms is not None:
        structured["duration_ms"] = round(duration_ms, 2)
    if extra:
        structured.update(extra)

    # Emit both human-readable and structured formats.
    logger.log(level, "%s | %s", message, json.dumps(structured, default=str))


# ---------------------------------------------------------------------------
# Job status tracking (in-memory for MVP)
# ---------------------------------------------------------------------------

class JobStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    SEGMENTING = "segmenting"
    CLASSIFYING = "classifying"
    TEXTURE_MAPPING = "texture_mapping"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class StageMetrics:
    """Timing and status information for a single pipeline stage."""
    stage_name: str
    status: str = "pending"
    start_time: float = 0.0
    end_time: float = 0.0
    duration_ms: float = 0.0
    retries: int = 0
    error: Optional[str] = None


@dataclass
class JobState:
    """Mutable state container for a single processing job."""

    job_id: str
    user_id: str
    status: JobStatus = JobStatus.QUEUED
    progress: int = 0  # 0 – 100
    stage: str = ""
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metrics: Dict[str, StageMetrics] = field(default_factory=dict)

    def update(
        self,
        status: JobStatus,
        progress: int,
        stage: str = "",
    ) -> None:
        self.status = status
        self.progress = min(progress, 100)
        self.stage = stage
        self.updated_at = time.time()

    def fail(self, error: str) -> None:
        self.status = JobStatus.FAILED
        self.error = error
        self.updated_at = time.time()

    def start_stage(self, stage_name: str) -> None:
        """Record the start of a pipeline stage."""
        self.metrics[stage_name] = StageMetrics(
            stage_name=stage_name,
            status="running",
            start_time=time.time(),
        )

    def end_stage(self, stage_name: str, *, error: Optional[str] = None) -> float:
        """Record the end of a pipeline stage. Returns duration in ms."""
        if stage_name in self.metrics:
            m = self.metrics[stage_name]
            m.end_time = time.time()
            m.duration_ms = (m.end_time - m.start_time) * 1000
            m.status = "failed" if error else "completed"
            m.error = error
            return m.duration_ms
        return 0.0

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Return a summary of all stage metrics."""
        total_ms = sum(m.duration_ms for m in self.metrics.values())
        return {
            "total_duration_ms": round(total_ms, 2),
            "stages": {
                name: {
                    "status": m.status,
                    "duration_ms": round(m.duration_ms, 2),
                    "retries": m.retries,
                    "error": m.error,
                }
                for name, m in self.metrics.items()
            },
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "user_id": self.user_id,
            "status": self.status.value,
            "progress": self.progress,
            "stage": self.stage,
            "error": self.error,
            "result": self.result,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metrics": self.get_metrics_summary(),
        }


# Global in-memory job store.
_jobs: Dict[str, JobState] = {}


def get_job(job_id: str) -> Optional[JobState]:
    """Retrieve job state by ID."""
    return _jobs.get(job_id)


def create_job(job_id: str, user_id: str) -> JobState:
    """Register a new job in the store."""
    state = JobState(job_id=job_id, user_id=user_id)
    _jobs[job_id] = state
    return state


def cleanup_old_jobs(max_age_seconds: float = _JOB_CLEANUP_AGE_SECONDS) -> int:
    """Remove completed/failed jobs older than ``max_age_seconds``.

    Returns the number of jobs cleaned up.
    """
    now = time.time()
    to_remove = []

    for job_id, state in _jobs.items():
        if state.status in (JobStatus.COMPLETED, JobStatus.FAILED):
            age = now - state.updated_at
            if age > max_age_seconds:
                to_remove.append(job_id)

    for job_id in to_remove:
        del _jobs[job_id]
        # Also clean up any lingering temp files.
        cleanup_temp_files(job_id)

    if to_remove:
        _log_structured(
            logging.INFO,
            f"Cleaned up {len(to_remove)} old jobs",
            extra={"cleaned_job_ids": to_remove},
        )

    return len(to_remove)


# ---------------------------------------------------------------------------
# Stage execution with retry
# ---------------------------------------------------------------------------

async def _run_stage_with_retry(
    job: JobState,
    stage_name: str,
    func: Callable[..., Awaitable[T]],
    *args: Any,
    max_retries: int = _STAGE_MAX_RETRIES,
    **kwargs: Any,
) -> T:
    """Execute a pipeline stage with retry logic.

    Retries the stage up to ``max_retries`` times on failure. Each retry
    is logged with structured output.

    Parameters
    ----------
    job:
        Job state for metrics tracking.
    stage_name:
        Human-readable stage name.
    func:
        Async callable to execute.
    max_retries:
        Maximum retry attempts.

    Returns
    -------
    result:
        Return value of the stage function.

    Raises
    ------
    Exception
        If all retry attempts fail.
    """
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        job.start_stage(stage_name)

        try:
            result = await func(*args, **kwargs)
            duration_ms = job.end_stage(stage_name)
            _log_structured(
                logging.INFO,
                f"Stage '{stage_name}' completed",
                job_id=job.job_id,
                stage=stage_name,
                duration_ms=duration_ms,
            )
            return result

        except Exception as exc:
            duration_ms = job.end_stage(stage_name, error=str(exc))

            if stage_name in job.metrics:
                job.metrics[stage_name].retries = attempt

            if attempt < max_retries:
                _log_structured(
                    logging.WARNING,
                    f"Stage '{stage_name}' failed (attempt {attempt + 1}/{max_retries + 1}), retrying",
                    job_id=job.job_id,
                    stage=stage_name,
                    duration_ms=duration_ms,
                    extra={"error": str(exc), "attempt": attempt + 1},
                )
                last_error = exc
                # Brief pause before retry.
                await asyncio.sleep(1.0)
            else:
                _log_structured(
                    logging.ERROR,
                    f"Stage '{stage_name}' failed after {max_retries + 1} attempts",
                    job_id=job.job_id,
                    stage=stage_name,
                    duration_ms=duration_ms,
                    extra={"error": str(exc)},
                )
                raise


# ---------------------------------------------------------------------------
# Pipeline orchestrator
# ---------------------------------------------------------------------------

async def run_pipeline(
    job_id: str,
    user_id: str,
    frame_urls: List[str],
    callback_url: str,
) -> None:
    """Execute the full processing pipeline for a single job.

    This is designed to be launched as an ``asyncio`` background task from
    the FastAPI endpoint.  All errors are caught and recorded on the job state
    rather than propagated.

    Features:
    - 10-minute timeout per job.
    - Stage-level error recovery (retry each stage once on failure).
    - Structured JSON logging with timing metrics.
    - Automatic cleanup of old completed jobs.
    """
    job = get_job(job_id)
    if job is None:
        logger.error("Job %s not found in store", job_id)
        return

    _log_structured(
        logging.INFO,
        f"Pipeline starting for job {job_id}",
        job_id=job_id,
        extra={"user_id": user_id, "frame_count": len(frame_urls)},
    )

    pipeline_start = time.time()

    try:
        # Wrap the entire pipeline in a timeout.
        await asyncio.wait_for(
            _execute_pipeline_stages(job, user_id, frame_urls, callback_url),
            timeout=_JOB_TIMEOUT_SECONDS,
        )

        total_ms = (time.time() - pipeline_start) * 1000
        _log_structured(
            logging.INFO,
            f"Pipeline completed for job {job_id}",
            job_id=job_id,
            duration_ms=total_ms,
            extra={"metrics": job.get_metrics_summary()},
        )

    except asyncio.TimeoutError:
        total_ms = (time.time() - pipeline_start) * 1000
        error_msg = (
            f"Job timed out after {_JOB_TIMEOUT_SECONDS} seconds "
            f"(stage: {job.stage})"
        )
        _log_structured(
            logging.ERROR,
            error_msg,
            job_id=job_id,
            duration_ms=total_ms,
        )
        job.fail(error_msg)

    except Exception:
        total_ms = (time.time() - pipeline_start) * 1000
        tb = traceback.format_exc()
        _log_structured(
            logging.ERROR,
            f"Pipeline failed for job {job_id}",
            job_id=job_id,
            duration_ms=total_ms,
            extra={"traceback": tb[-500:]},
        )
        job.fail(f"Pipeline error: {tb[-500:]}")

    finally:
        # Periodic cleanup of old jobs.
        cleanup_old_jobs()


async def _execute_pipeline_stages(
    job: JobState,
    user_id: str,
    frame_urls: List[str],
    callback_url: str,
) -> None:
    """Execute all pipeline stages sequentially.

    Separated from ``run_pipeline`` to allow timeout wrapping.
    """
    loop = asyncio.get_running_loop()

    # ------------------------------------------------------------------
    # 1. Download frames (0 – 15 %)
    # ------------------------------------------------------------------
    job.update(JobStatus.DOWNLOADING, 0, "Downloading frames")

    async def _download_stage() -> Any:
        return await download_and_preprocess_frames(frame_urls)

    frames, download_errors = await _run_stage_with_retry(
        job, "download", _download_stage
    )

    if not frames:
        job.fail("All frame downloads failed")
        return

    if download_errors:
        _log_structured(
            logging.WARNING,
            f"{len(download_errors)} frame download errors",
            job_id=job.job_id,
            stage="download",
            extra={"errors": download_errors[:3]},
        )

    job.update(JobStatus.DOWNLOADING, 15, "Frames downloaded")

    # ------------------------------------------------------------------
    # 2. Segmentation (15 – 55 %)
    # ------------------------------------------------------------------
    job.update(JobStatus.SEGMENTING, 15, "Running segmentation")

    async def _segment_stage() -> Any:
        return await loop.run_in_executor(None, segment_frames, frames)

    masks = await _run_stage_with_retry(job, "segmentation", _segment_stage)

    job.update(JobStatus.SEGMENTING, 55, "Segmentation complete")

    # ------------------------------------------------------------------
    # 3. Classification (55 – 65 %)
    # ------------------------------------------------------------------
    job.update(JobStatus.CLASSIFYING, 55, "Classifying garment regions")

    async def _classify_stage() -> Any:
        return await loop.run_in_executor(
            None, classify_all_frames, masks
        )

    regions_per_frame = await _run_stage_with_retry(
        job, "classification", _classify_stage
    )

    job.update(JobStatus.CLASSIFYING, 65, "Classification complete")

    # ------------------------------------------------------------------
    # 4. Texture mapping (65 – 85 %)
    # ------------------------------------------------------------------
    job.update(JobStatus.TEXTURE_MAPPING, 65, "Generating textures")

    async def _texture_stage() -> Any:
        return await loop.run_in_executor(
            None, generate_all_textures_with_metadata, frames, regions_per_frame
        )

    textures, texture_metadata = await _run_stage_with_retry(
        job, "texture_mapping", _texture_stage
    )

    if not textures:
        job.fail("No textures could be generated — insufficient garment data")
        return

    job.update(JobStatus.TEXTURE_MAPPING, 85, "Textures generated")

    # ------------------------------------------------------------------
    # 5. Upload & callback (85 – 100 %)
    # ------------------------------------------------------------------
    job.update(JobStatus.UPLOADING, 85, "Uploading results")
    _log_structured(
        logging.INFO,
        f"Uploading {len(textures)} textures",
        job_id=job.job_id,
        stage="upload",
        extra={"categories": list(textures.keys())},
    )

    async def _upload_stage() -> Any:
        return await upload_results(
            textures,
            job_id=job.job_id,
            user_id=user_id,
            callback_url=callback_url,
            texture_metadata=texture_metadata,
        )

    result = await _run_stage_with_retry(job, "upload", _upload_stage)

    job.result = result
    job.update(JobStatus.COMPLETED, 100, "Done")
