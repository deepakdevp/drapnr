"""
Drapnr GPU Processing Server — FastAPI application.

Endpoints
---------
POST /process       Queue a new texture-extraction job.
GET  /status/{id}   Poll job status and progress.
GET  /health        Health / readiness check.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import List, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from config import settings
from pipeline.processor import JobStatus, create_job, get_job, run_pipeline

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Drapnr Processing Server",
    description="GPU-backed pipeline for extracting garment textures from 360-degree video frames.",
    version="0.1.0",
)

# Track running tasks so we can respect the concurrency limit.
_active_tasks: int = 0
_task_lock = asyncio.Lock()

# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Depends(_api_key_header)) -> str:
    """Validate the X-API-Key header against the configured webhook secret."""
    expected = settings.processing_webhook_secret
    if not expected:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: PROCESSING_WEBHOOK_SECRET is not set.",
        )
    if not api_key or api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    return api_key


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ProcessRequest(BaseModel):
    """Payload for POST /process."""

    job_id: Optional[str] = Field(
        default=None,
        description="Client-supplied job ID. A UUID is generated if omitted.",
    )
    user_id: str = Field(..., description="Supabase user ID that owns the scan.")
    frame_urls: List[str] = Field(
        ...,
        min_length=1,
        description="Ordered list of frame image URLs (evenly spaced across 360 degrees).",
    )
    supabase_url: Optional[str] = Field(
        default=None,
        description="Override Supabase project URL (defaults to env var).",
    )
    callback_url: str = Field(
        ...,
        description="URL to POST results to when processing completes.",
    )


class ProcessResponse(BaseModel):
    job_id: str
    status: str


class StatusResponse(BaseModel):
    job_id: str
    user_id: str
    status: str
    progress: int
    stage: str
    error: Optional[str] = None
    result: Optional[dict] = None


class HealthResponse(BaseModel):
    status: str
    active_jobs: int
    max_concurrent_jobs: int


# ---------------------------------------------------------------------------
# Background task wrapper
# ---------------------------------------------------------------------------

async def _run_job(
    job_id: str,
    user_id: str,
    frame_urls: List[str],
    callback_url: str,
) -> None:
    """Wrapper that manages the active-task counter."""
    global _active_tasks
    async with _task_lock:
        _active_tasks += 1
    try:
        await run_pipeline(job_id, user_id, frame_urls, callback_url)
    finally:
        async with _task_lock:
            _active_tasks -= 1


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/process", response_model=ProcessResponse, status_code=202)
async def process(
    request: ProcessRequest,
    background_tasks: BackgroundTasks,
    _key: str = Depends(verify_api_key),
) -> ProcessResponse:
    """Queue a new garment texture extraction job.

    The job runs asynchronously in the background. Poll ``GET /status/{job_id}``
    to track progress, or wait for the webhook callback.
    """
    # Enforce concurrency limit.
    if _active_tasks >= settings.max_concurrent_jobs:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Server is at capacity ({settings.max_concurrent_jobs} concurrent jobs). "
                "Please retry later."
            ),
        )

    job_id = request.job_id or str(uuid.uuid4())

    # Reject duplicate job IDs.
    if get_job(job_id) is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} already exists.",
        )

    create_job(job_id, request.user_id)
    logger.info(
        "Queued job %s for user %s (%d frames)",
        job_id,
        request.user_id,
        len(request.frame_urls),
    )

    background_tasks.add_task(
        _run_job,
        job_id,
        request.user_id,
        request.frame_urls,
        request.callback_url,
    )

    return ProcessResponse(job_id=job_id, status=JobStatus.QUEUED.value)


@app.get("/status/{job_id}", response_model=StatusResponse)
async def status(job_id: str) -> StatusResponse:
    """Return the current status and progress of a processing job."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    return StatusResponse(
        job_id=job.job_id,
        user_id=job.user_id,
        status=job.status.value,
        progress=job.progress,
        stage=job.stage,
        error=job.error,
        result=job.result,
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health / readiness probe."""
    return HealthResponse(
        status="ok",
        active_jobs=_active_tasks,
        max_concurrent_jobs=settings.max_concurrent_jobs,
    )


# ---------------------------------------------------------------------------
# Entrypoint for direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        reload=False,
    )
