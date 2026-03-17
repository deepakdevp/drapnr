"""
Modal.com deployment configuration for the Drapnr GPU processing server.

Deploy with:
    modal deploy modal_deploy.py

This provisions a serverless GPU (A100-40GB) container with the full
processing pipeline pre-loaded.  The FastAPI app is exposed as a web endpoint
and auto-scales to zero when idle.
"""

from __future__ import annotations

import modal

# ---------------------------------------------------------------------------
# Container image
# ---------------------------------------------------------------------------

image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install(
        "libgl1-mesa-glx",
        "libglib2.0-0",
    )
    .pip_install(
        "fastapi>=0.110,<1",
        "uvicorn[standard]>=0.29,<1",
        "httpx>=0.27,<1",
        "opencv-python-headless>=4.9,<5",
        "numpy>=1.26,<2",
        "torch>=2.2,<3",
        "torchvision>=0.17,<1",
        "supabase>=2.4,<3",
        "Pillow>=10,<11",
    )
    .copy_local_dir(".", "/app")
)

# ---------------------------------------------------------------------------
# Modal app
# ---------------------------------------------------------------------------

app = modal.App(
    name="drapnr-processing",
    image=image,
)

# Persistent volume for model weights so they survive across cold starts.
model_volume = modal.Volume.from_name("drapnr-models", create_if_missing=True)

# ---------------------------------------------------------------------------
# Web endpoint
# ---------------------------------------------------------------------------


@app.function(
    gpu=modal.gpu.A100(count=1, size="40GB"),
    timeout=600,  # 10 minutes max per invocation
    memory=16384,  # 16 GB RAM
    volumes={"/models": model_volume},
    allow_concurrent_inputs=4,
    container_idle_timeout=300,  # keep warm for 5 min after last request
)
@modal.asgi_app()
def serve() -> object:
    """Return the FastAPI ASGI application.

    Modal will route HTTP traffic to this function.  The container
    auto-scales based on incoming request volume and scales to zero
    when idle.
    """
    import sys

    sys.path.insert(0, "/app")

    # Set environment defaults that Modal doesn't provide automatically.
    import os

    os.environ.setdefault("MODEL_PATH", "/models")
    os.environ.setdefault("SAM2_CHECKPOINT", "/models/sam2_hiera_large.pt")
    os.environ.setdefault("U2NET_CHECKPOINT", "/models/u2net.pth")

    from main import app as fastapi_app  # noqa: WPS442

    return fastapi_app


# ---------------------------------------------------------------------------
# Model download helper (run once to populate the volume)
# ---------------------------------------------------------------------------


@app.function(
    volumes={"/models": model_volume},
    timeout=1800,
    memory=8192,
)
def download_models() -> None:
    """Download model checkpoints into the persistent volume.

    Run manually:
        modal run modal_deploy.py::download_models
    """
    import subprocess

    # SAM2 checkpoint
    sam2_url = (
        "https://dl.fbaipublicfiles.com/segment_anything_2/"
        "072824/sam2_hiera_large.pt"
    )
    subprocess.run(
        ["curl", "-fSL", "-o", "/models/sam2_hiera_large.pt", sam2_url],
        check=True,
    )

    # U2-Net checkpoint
    u2net_url = (
        "https://github.com/xuebinqin/U-2-Net/releases/download/v1.0/u2net.pth"
    )
    subprocess.run(
        ["curl", "-fSL", "-o", "/models/u2net.pth", u2net_url],
        check=True,
    )

    model_volume.commit()
    print("Models downloaded successfully.")
