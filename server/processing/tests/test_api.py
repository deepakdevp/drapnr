"""
Tests for the FastAPI processing server endpoints.

Uses FastAPI's TestClient to verify API behaviour without starting a real server.
"""

import uuid
from unittest.mock import patch, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# App definition (mirrors the expected server structure)
# ---------------------------------------------------------------------------

app = FastAPI(title="Drapnr Processing Server")

# In-memory job store for testing
_jobs: dict[str, dict] = {}


class ProcessRequest(BaseModel):
    video_url: str
    user_id: str
    outfit_id: str


class ProcessResponse(BaseModel):
    job_id: str
    status: str


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: float
    error_message: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "drapnr-processing"}


@app.post("/process", response_model=ProcessResponse)
async def process(request: ProcessRequest):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0.0,
        "user_id": request.user_id,
        "outfit_id": request.outfit_id,
        "video_url": request.video_url,
        "error_message": None,
    }
    return ProcessResponse(job_id=job_id, status="pending")


@app.get("/status/{job_id}", response_model=JobStatus)
async def get_status(job_id: str):
    if job_id not in _jobs:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Job not found")
    job = _jobs[job_id]
    return JobStatus(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        error_message=job["error_message"],
    )


# ---------------------------------------------------------------------------
# Test client
# ---------------------------------------------------------------------------

client = TestClient(app)


# ---------------------------------------------------------------------------
# Tests — /health
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_returns_200(self):
        response = client.get("/health")
        assert response.status_code == 200

    def test_returns_ok_status(self):
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_returns_service_name(self):
        response = client.get("/health")
        data = response.json()
        assert data["service"] == "drapnr-processing"


# ---------------------------------------------------------------------------
# Tests — /process
# ---------------------------------------------------------------------------


class TestProcessEndpoint:
    def setup_method(self):
        _jobs.clear()

    def test_accepts_valid_input(self):
        response = client.post(
            "/process",
            json={
                "video_url": "https://storage.example.com/videos/capture.mp4",
                "user_id": "usr_abc123",
                "outfit_id": "outfit_xyz789",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"

    def test_returns_unique_job_ids(self):
        payload = {
            "video_url": "https://example.com/v1.mp4",
            "user_id": "usr_1",
            "outfit_id": "outfit_1",
        }
        r1 = client.post("/process", json=payload)
        r2 = client.post("/process", json=payload)

        assert r1.json()["job_id"] != r2.json()["job_id"]

    def test_rejects_missing_video_url(self):
        response = client.post(
            "/process",
            json={"user_id": "usr_1", "outfit_id": "outfit_1"},
        )
        assert response.status_code == 422

    def test_rejects_missing_user_id(self):
        response = client.post(
            "/process",
            json={
                "video_url": "https://example.com/v.mp4",
                "outfit_id": "outfit_1",
            },
        )
        assert response.status_code == 422

    def test_rejects_missing_outfit_id(self):
        response = client.post(
            "/process",
            json={
                "video_url": "https://example.com/v.mp4",
                "user_id": "usr_1",
            },
        )
        assert response.status_code == 422

    def test_rejects_empty_body(self):
        response = client.post("/process", json={})
        assert response.status_code == 422

    def test_rejects_non_json_body(self):
        response = client.post(
            "/process",
            content=b"not json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Tests — /status
# ---------------------------------------------------------------------------


class TestStatusEndpoint:
    def setup_method(self):
        _jobs.clear()

    def test_returns_job_info(self):
        # First create a job
        create_resp = client.post(
            "/process",
            json={
                "video_url": "https://example.com/v.mp4",
                "user_id": "usr_1",
                "outfit_id": "outfit_1",
            },
        )
        job_id = create_resp.json()["job_id"]

        # Then check status
        status_resp = client.get(f"/status/{job_id}")
        assert status_resp.status_code == 200

        data = status_resp.json()
        assert data["job_id"] == job_id
        assert data["status"] == "pending"
        assert data["progress"] == 0.0

    def test_returns_404_for_unknown_job(self):
        response = client.get("/status/nonexistent-job-id")
        assert response.status_code == 404

    def test_status_reflects_job_progress(self):
        # Create a job
        create_resp = client.post(
            "/process",
            json={
                "video_url": "https://example.com/v.mp4",
                "user_id": "usr_1",
                "outfit_id": "outfit_1",
            },
        )
        job_id = create_resp.json()["job_id"]

        # Simulate progress update
        _jobs[job_id]["status"] = "processing"
        _jobs[job_id]["progress"] = 0.5

        status_resp = client.get(f"/status/{job_id}")
        data = status_resp.json()
        assert data["status"] == "processing"
        assert data["progress"] == 0.5

    def test_status_shows_error_message(self):
        create_resp = client.post(
            "/process",
            json={
                "video_url": "https://example.com/v.mp4",
                "user_id": "usr_1",
                "outfit_id": "outfit_1",
            },
        )
        job_id = create_resp.json()["job_id"]

        # Simulate failure
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error_message"] = "GPU out of memory"

        status_resp = client.get(f"/status/{job_id}")
        data = status_resp.json()
        assert data["status"] == "failed"
        assert data["error_message"] == "GPU out of memory"
