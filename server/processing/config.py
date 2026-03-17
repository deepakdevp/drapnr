"""
Configuration for the Drapnr GPU processing server.

All settings are loaded from environment variables with sensible defaults
for local development.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    """Immutable application settings loaded once at startup."""

    # --- Supabase -----------------------------------------------------------
    supabase_url: str = field(
        default_factory=lambda: os.environ.get("SUPABASE_URL", "")
    )
    supabase_service_key: str = field(
        default_factory=lambda: os.environ.get("SUPABASE_SERVICE_KEY", "")
    )
    supabase_storage_bucket: str = field(
        default_factory=lambda: os.environ.get("SUPABASE_STORAGE_BUCKET", "garment-textures")
    )

    # --- Webhook / Auth ------------------------------------------------------
    processing_webhook_secret: str = field(
        default_factory=lambda: os.environ.get("PROCESSING_WEBHOOK_SECRET", "")
    )

    # --- Model paths ---------------------------------------------------------
    model_path: str = field(
        default_factory=lambda: os.environ.get("MODEL_PATH", "/models")
    )
    sam2_checkpoint: str = field(
        default_factory=lambda: os.environ.get(
            "SAM2_CHECKPOINT", "/models/sam2_hiera_large.pt"
        )
    )
    sam2_config: str = field(
        default_factory=lambda: os.environ.get(
            "SAM2_CONFIG", "sam2_hiera_l.yaml"
        )
    )
    u2net_checkpoint: str = field(
        default_factory=lambda: os.environ.get(
            "U2NET_CHECKPOINT", "/models/u2net.pth"
        )
    )

    # --- Processing defaults -------------------------------------------------
    frame_resize_width: int = int(os.environ.get("FRAME_RESIZE_WIDTH", "1024"))
    frame_resize_height: int = int(os.environ.get("FRAME_RESIZE_HEIGHT", "1024"))
    texture_resolution: int = int(os.environ.get("TEXTURE_RESOLUTION", "1024"))
    thumbnail_size: int = int(os.environ.get("THUMBNAIL_SIZE", "256"))
    max_concurrent_jobs: int = int(os.environ.get("MAX_CONCURRENT_JOBS", "4"))
    download_timeout_seconds: int = int(
        os.environ.get("DOWNLOAD_TIMEOUT_SECONDS", "30")
    )

    # --- Server --------------------------------------------------------------
    host: str = os.environ.get("HOST", "0.0.0.0")
    port: int = int(os.environ.get("PORT", "8000"))
    log_level: str = os.environ.get("LOG_LEVEL", "INFO")


# Singleton – import this everywhere.
settings = Settings()
