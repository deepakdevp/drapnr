"""
Upload pipeline results to Supabase Storage and notify the application
via a webhook callback.

Handles:
- Encoding textures to PNG and thumbnails to WebP.
- Uploading to the configured Supabase Storage bucket.
- Inserting garment records into the ``garments`` table.
- Calling the callback URL with the final results payload.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import cv2
import httpx
import numpy as np
from numpy.typing import NDArray

from config import settings
from pipeline.classification import GarmentCategory

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Image encoding helpers
# ---------------------------------------------------------------------------

def _encode_png(image: NDArray[np.uint8]) -> bytes:
    """Encode a BGRA or BGR image as PNG bytes."""
    success, buf = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError("Failed to encode image as PNG")
    return buf.tobytes()


def _encode_webp_thumbnail(
    image: NDArray[np.uint8],
    size: int = 256,
    quality: int = 85,
) -> bytes:
    """Create a square WebP thumbnail from a BGRA/BGR image."""
    # Convert BGRA -> BGR if needed (WebP encoder handles both, but let's be
    # explicit).
    if image.shape[2] == 4:
        thumb = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    else:
        thumb = image
    thumb = cv2.resize(thumb, (size, size), interpolation=cv2.INTER_AREA)
    success, buf = cv2.imencode(".webp", thumb, [cv2.IMWRITE_WEBP_QUALITY, quality])
    if not success:
        raise RuntimeError("Failed to encode thumbnail as WebP")
    return buf.tobytes()


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _get_supabase_client() -> Any:
    """Create and return a Supabase client using supabase-py."""
    from supabase import create_client  # type: ignore[import-untyped]

    return create_client(settings.supabase_url, settings.supabase_service_key)


async def _upload_to_storage(
    client: Any,
    bucket: str,
    path: str,
    data: bytes,
    content_type: str,
) -> str:
    """Upload bytes to Supabase Storage and return the public URL.

    Uses the service-role client so no RLS policies apply.
    """
    try:
        client.storage.from_(bucket).upload(
            path,
            data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception:
        logger.exception("Storage upload failed for %s/%s", bucket, path)
        raise

    public_url = client.storage.from_(bucket).get_public_url(path)
    logger.debug("Uploaded %s (%d bytes) -> %s", path, len(data), public_url)
    return public_url


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _insert_garment_record(
    client: Any,
    user_id: str,
    job_id: str,
    category: str,
    texture_url: str,
    thumbnail_url: str,
) -> Dict[str, Any]:
    """Insert a row into the ``garments`` table and return the new record."""
    record = {
        "user_id": user_id,
        "job_id": job_id,
        "category": category,
        "texture_url": texture_url,
        "thumbnail_url": thumbnail_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        result = client.table("garments").insert(record).execute()
        logger.info("Inserted garment record for %s/%s", user_id, category)
        return result.data[0] if result.data else record
    except Exception:
        logger.exception("Failed to insert garment record")
        raise


# ---------------------------------------------------------------------------
# Webhook callback
# ---------------------------------------------------------------------------

async def _send_callback(
    callback_url: str,
    payload: Dict[str, Any],
) -> None:
    """POST the results payload to the callback URL with auth header."""
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": settings.processing_webhook_secret,
    }
    async with httpx.AsyncClient() as http:
        try:
            response = await http.post(
                callback_url,
                json=payload,
                headers=headers,
                timeout=30,
            )
            response.raise_for_status()
            logger.info("Callback sent to %s — %d", callback_url, response.status_code)
        except Exception:
            logger.exception("Callback to %s failed", callback_url)
            raise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def upload_results(
    textures: Dict[GarmentCategory, NDArray[np.uint8]],
    *,
    job_id: str,
    user_id: str,
    callback_url: str,
) -> Dict[str, Any]:
    """Upload all generated textures and notify the application.

    For each garment category:
    1. Encode the texture as a 1024x1024 PNG.
    2. Encode a 256x256 WebP thumbnail.
    3. Upload both to Supabase Storage.
    4. Create a record in the ``garments`` table.

    Finally, POST the full results payload to *callback_url*.

    Parameters
    ----------
    textures:
        Mapping from garment category to BGRA texture arrays.
    job_id:
        The processing job identifier.
    user_id:
        Owner of the garments.
    callback_url:
        URL to notify upon completion.

    Returns
    -------
    result:
        Summary dict with garment URLs and metadata.
    """
    client = _get_supabase_client()
    bucket = settings.supabase_storage_bucket
    thumbnail_size = settings.thumbnail_size

    garments: List[Dict[str, Any]] = []

    for category, texture in textures.items():
        prefix = f"{user_id}/{job_id}/{category}"

        # --- Texture PNG -----------------------------------------------------
        png_bytes = _encode_png(texture)
        texture_path = f"{prefix}/texture.png"
        texture_url = await _upload_to_storage(
            client, bucket, texture_path, png_bytes, "image/png"
        )

        # --- Thumbnail WebP --------------------------------------------------
        webp_bytes = _encode_webp_thumbnail(texture, size=thumbnail_size)
        thumb_path = f"{prefix}/thumbnail.webp"
        thumbnail_url = await _upload_to_storage(
            client, bucket, thumb_path, webp_bytes, "image/webp"
        )

        # --- DB record -------------------------------------------------------
        record = await _insert_garment_record(
            client,
            user_id=user_id,
            job_id=job_id,
            category=category,
            texture_url=texture_url,
            thumbnail_url=thumbnail_url,
        )
        garments.append(
            {
                "category": category,
                "texture_url": texture_url,
                "thumbnail_url": thumbnail_url,
                "record": record,
            }
        )

    # --- Callback ------------------------------------------------------------
    payload: Dict[str, Any] = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "completed",
        "garments": garments,
    }

    try:
        await _send_callback(callback_url, payload)
    except Exception:
        # Callback failure is not fatal — the textures are already uploaded.
        logger.error("Callback failed but results are uploaded for job %s", job_id)

    return payload
