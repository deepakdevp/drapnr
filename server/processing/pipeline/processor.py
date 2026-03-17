"""
Pipeline orchestrator — ties together every stage of Drapnr's processing
pipeline and tracks progress for each job.

Stages and their progress weight:
  1. Frame download       (0 – 15 %)
  2. Segmentation         (15 – 55 %)
  3. Classification       (55 – 65 %)
  4. Texture mapping      (65 – 85 %)
  5. Upload & callback    (85 – 100 %)
"""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import numpy as np
from numpy.typing import NDArray

from pipeline.classification import (
    ClassifiedRegion,
    GarmentCategory,
    classify_all_frames,
)
from pipeline.frame_extraction import download_and_preprocess_frames
from pipeline.segmentation import segment_frames
from pipeline.texture_mapping import generate_all_textures
from pipeline.upload import upload_results

logger = logging.getLogger(__name__)


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
    """
    job = get_job(job_id)
    if job is None:
        logger.error("Job %s not found in store", job_id)
        return

    try:
        # ------------------------------------------------------------------
        # 1. Download frames (0 – 15 %)
        # ------------------------------------------------------------------
        job.update(JobStatus.DOWNLOADING, 0, "Downloading frames")
        logger.info("[%s] Downloading %d frames", job_id, len(frame_urls))

        frames, download_errors = await download_and_preprocess_frames(frame_urls)

        if not frames:
            job.fail("All frame downloads failed")
            return

        if download_errors:
            logger.warning(
                "[%s] %d frame download errors: %s",
                job_id,
                len(download_errors),
                download_errors[:3],
            )

        job.update(JobStatus.DOWNLOADING, 15, "Frames downloaded")

        # ------------------------------------------------------------------
        # 2. Segmentation (15 – 55 %)
        # ------------------------------------------------------------------
        job.update(JobStatus.SEGMENTING, 15, "Running segmentation")
        logger.info("[%s] Segmenting %d frames", job_id, len(frames))

        # Run segmentation in a thread pool to avoid blocking the event loop
        # (model inference is CPU/GPU-bound).
        loop = asyncio.get_running_loop()
        masks = await loop.run_in_executor(None, segment_frames, frames)

        job.update(JobStatus.SEGMENTING, 55, "Segmentation complete")

        # ------------------------------------------------------------------
        # 3. Classification (55 – 65 %)
        # ------------------------------------------------------------------
        job.update(JobStatus.CLASSIFYING, 55, "Classifying garment regions")
        logger.info("[%s] Classifying %d masks", job_id, len(masks))

        regions_per_frame = await loop.run_in_executor(
            None, classify_all_frames, masks
        )

        job.update(JobStatus.CLASSIFYING, 65, "Classification complete")

        # ------------------------------------------------------------------
        # 4. Texture mapping (65 – 85 %)
        # ------------------------------------------------------------------
        job.update(JobStatus.TEXTURE_MAPPING, 65, "Generating textures")
        logger.info("[%s] Generating UV textures", job_id)

        textures = await loop.run_in_executor(
            None, generate_all_textures, frames, regions_per_frame
        )

        if not textures:
            job.fail("No textures could be generated — insufficient garment data")
            return

        job.update(JobStatus.TEXTURE_MAPPING, 85, "Textures generated")

        # ------------------------------------------------------------------
        # 5. Upload & callback (85 – 100 %)
        # ------------------------------------------------------------------
        job.update(JobStatus.UPLOADING, 85, "Uploading results")
        logger.info(
            "[%s] Uploading %d textures for categories: %s",
            job_id,
            len(textures),
            list(textures.keys()),
        )

        result = await upload_results(
            textures,
            job_id=job_id,
            user_id=user_id,
            callback_url=callback_url,
        )

        job.result = result
        job.update(JobStatus.COMPLETED, 100, "Done")
        logger.info("[%s] Pipeline completed successfully", job_id)

    except Exception:
        tb = traceback.format_exc()
        logger.exception("[%s] Pipeline failed", job_id)
        job.fail(f"Pipeline error: {tb[-500:]}")
