# ===========================================================================
# Drapnr GPU Processing Server
# ---------------------------------------------------------------------------
# Base: NVIDIA CUDA 12.2 + cuDNN 8 on Ubuntu 22.04
# Python: 3.11  |  Framework: FastAPI + Uvicorn
# ===========================================================================

FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# -- System dependencies ----------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-venv \
        python3.11-dev \
        python3-pip \
        libgl1-mesa-glx \
        libglib2.0-0 \
        curl \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && rm -rf /var/lib/apt/lists/*

# -- Python dependencies -----------------------------------------------------
WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install -r requirements.txt

# -- Application code --------------------------------------------------------
COPY . .

# -- Model cache directory (mount a volume here) ----------------------------
RUN mkdir -p /models

# -- Runtime -----------------------------------------------------------------
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info"]
