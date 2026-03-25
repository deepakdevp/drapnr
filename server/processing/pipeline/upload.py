"""
Upload pipeline results to Supabase Storage and notify the application
via a webhook callback.

Handles:
- Encoding textures to PNG and thumbnails to WebP.
- Uploading to the configured Supabase Storage bucket with retry logic.
- Smart thumbnail generation centred on the garment.
- Inserting garment records with metadata into the ``garments`` table.
- Calling the callback URL with the final results payload.
- Cleaning up temporary files after successful upload.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import httpx
import numpy as np
from numpy.typing import NDArray

from config import settings
from pipeline.classification import GarmentCategory

logger = logging.getLogger(__name__)

# Retry settings.
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0  # seconds


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


def _smart_crop_thumbnail(
    image: NDArray[np.uint8],
    size: int = 256,
    quality: int = 85,
) -> bytes:
    """Generate a thumbnail with smart cropping centred on the garment.

    For BGRA images, uses the alpha channel to find the garment's bounding box
    and centres the crop on it. This ensures the thumbnail shows the garment
    prominently rather than including excess transparent/background areas.

    Parameters
    ----------
    image:
        BGRA or BGR image.
    size:
        Output thumbnail size (square).
    quality:
        WebP encoding quality.

    Returns
    -------
    thumbnail_bytes:
        WebP-encoded thumbnail bytes.
    """
    if image.shape[2] == 4:
        alpha = image[:, :, 3]
        bgr = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    else:
        alpha = np.full(image.shape[:2], 255, dtype=np.uint8)
        bgr = image

    h, w = bgr.shape[:2]

    # Find garment bounding box from alpha channel.
    coords = cv2.findNonZero(alpha)
    if coords is not None and len(coords) > 0:
        gx, gy, gw, gh = cv2.boundingRect(coords)

        # Centre of the garment.
        cx = gx + gw // 2
        cy = gy + gh // 2

        # Determine crop size (square, fitting the garment with padding).
        crop_size = int(max(gw, gh) * 1.2)  # 20% padding
        crop_size = max(crop_size, size)  # At least thumbnail size
        crop_size = min(crop_size, min(h, w))  # Don't exceed image

        # Compute crop bounds centred on garment.
        x1 = max(0, cx - crop_size // 2)
        y1 = max(0, cy - crop_size // 2)
        x2 = min(w, x1 + crop_size)
        y2 = min(h, y1 + crop_size)

        # Adjust if we hit image boundaries.
        if x2 - x1 < crop_size:
            x1 = max(0, x2 - crop_size)
        if y2 - y1 < crop_size:
            y1 = max(0, y2 - crop_size)

        cropped = bgr[y1:y2, x1:x2]
    else:
        cropped = bgr

    # Resize to thumbnail size.
    thumb = cv2.resize(cropped, (size, size), interpolation=cv2.INTER_AREA)

    success, buf = cv2.imencode(".webp", thumb, [cv2.IMWRITE_WEBP_QUALITY, quality])
    if not success:
        raise RuntimeError("Failed to encode smart-cropped thumbnail as WebP")
    return buf.tobytes()


# ---------------------------------------------------------------------------
# Supabase helpers with retry logic
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
    max_retries: int = _MAX_RETRIES,
) -> str:
    """Upload bytes to Supabase Storage with retry logic.

    Retries up to ``max_retries`` times on failure with exponential backoff.

    Parameters
    ----------
    client:
        Supabase client.
    bucket:
        Storage bucket name.
    path:
        Storage path for the file.
    data:
        File content bytes.
    content_type:
        MIME type of the file.
    max_retries:
        Maximum number of retry attempts.

    Returns
    -------
    public_url:
        Public URL of the uploaded file.

    Raises
    ------
    RuntimeError
        If all upload attempts fail.
    """
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            client.storage.from_(bucket).upload(
                path,
                data,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            public_url = client.storage.from_(bucket).get_public_url(path)
            logger.debug("Uploaded %s (%d bytes) -> %s", path, len(data), public_url)
            return public_url

        except Exception as exc:
            last_error = exc
            if attempt < max_retries:
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Upload attempt %d/%d failed for %s/%s: %s. Retrying in %.1fs",
                    attempt + 1,
                    max_retries + 1,
                    bucket,
                    path,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "All %d upload attempts failed for %s/%s: %s",
                    max_retries + 1,
                    bucket,
                    path,
                    exc,
                )

    raise RuntimeError(
        f"Failed to upload {bucket}/{path} after {max_retries + 1} attempts: {last_error}"
    )


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
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Insert a row into the ``garments`` table with garment metadata.

    Parameters
    ----------
    client:
        Supabase client.
    user_id:
        Owner of the garment.
    job_id:
        Processing job identifier.
    category:
        Garment category.
    texture_url:
        URL of the full texture image.
    thumbnail_url:
        URL of the thumbnail image.
    metadata:
        Optional garment metadata (dominant colours, pattern, confidence, etc.).

    Returns
    -------
    record:
        The inserted database record.
    """
    record: Dict[str, Any] = {
        "user_id": user_id,
        "job_id": job_id,
        "category": category,
        "texture_url": texture_url,
        "thumbnail_url": thumbnail_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Add metadata fields if available.
    if metadata:
        record["dominant_colors"] = metadata.get("dominant_colors", [])
        record["pattern"] = metadata.get("pattern", "unknown")
        record["confidence"] = metadata.get("confidence", 0.0)
        record["coverage"] = metadata.get("coverage_fraction", 0.0)

    try:
        result = client.table("garments").insert(record).execute()
        logger.info("Inserted garment record for %s/%s", user_id, category)
        return result.data[0] if result.data else record
    except Exception:
        logger.exception("Failed to insert garment record")
        raise


# ---------------------------------------------------------------------------
# Temporary file cleanup
# ---------------------------------------------------------------------------

_temp_dirs: Dict[str, Path] = {}


def _get_temp_dir(job_id: str) -> Path:
    """Get or create a temporary directory for a job."""
    if job_id not in _temp_dirs:
        temp_dir = Path(tempfile.mkdtemp(prefix=f"drapnr_{job_id}_"))
        _temp_dirs[job_id] = temp_dir
        logger.debug("Created temp directory: %s", temp_dir)
    return _temp_dirs[job_id]


def cleanup_temp_files(job_id: str) -> None:
    """Delete temporary files associated with a job.

    Should be called after successful upload to free disk space.

    Parameters
    ----------
    job_id:
        The processing job identifier.
    """
    if job_id in _temp_dirs:
        temp_dir = _temp_dirs.pop(job_id)
        try:
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
                logger.info("Cleaned up temp directory: %s", temp_dir)
        except Exception as exc:
            logger.warning("Failed to clean up temp directory %s: %s", temp_dir, exc)


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
    texture_metadata: Optional[Dict[GarmentCategory, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Upload all generated textures and notify the application.

    For each garment category:
    1. Encode the texture as a 1024x1024 PNG.
    2. Generate a smart-cropped 256x256 WebP thumbnail centred on garment.
    3. Upload both to Supabase Storage with retry logic.
    4. Create a record in the ``garments`` table with metadata.

    Finally, POST the full results payload to *callback_url* and clean up
    temporary files.

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
    texture_metadata:
        Optional per-category metadata from texture generation.

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

        # Get metadata for this category.
        cat_metadata = None
        if texture_metadata and category in texture_metadata:
            cat_metadata = texture_metadata[category]

        # --- Texture PNG -----------------------------------------------------
        png_bytes = _encode_png(texture)
        texture_path = f"{prefix}/texture.png"
        texture_url = await _upload_to_storage(
            client, bucket, texture_path, png_bytes, "image/png"
        )

        # --- Smart-cropped Thumbnail WebP ------------------------------------
        webp_bytes = _smart_crop_thumbnail(texture, size=thumbnail_size)
        thumb_path = f"{prefix}/thumbnail.webp"
        thumbnail_url = await _upload_to_storage(
            client, bucket, thumb_path, webp_bytes, "image/webp"
        )

        # --- DB record with metadata -----------------------------------------
        record = await _insert_garment_record(
            client,
            user_id=user_id,
            job_id=job_id,
            category=category,
            texture_url=texture_url,
            thumbnail_url=thumbnail_url,
            metadata=cat_metadata,
        )

        garment_entry: Dict[str, Any] = {
            "category": category,
            "texture_url": texture_url,
            "thumbnail_url": thumbnail_url,
            "record": record,
        }
        if cat_metadata:
            garment_entry["metadata"] = cat_metadata

        garments.append(garment_entry)

    # --- Callback ------------------------------------------------------------
    payload: Dict[str, Any] = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "complete",
        "garments": garments,
    }

    try:
        await _send_callback(callback_url, payload)
    except Exception:
        # Callback failure is not fatal — the textures are already uploaded.
        logger.error("Callback failed but results are uploaded for job %s", job_id)

    # --- Cleanup temporary files ----------------------------------------------
    cleanup_temp_files(job_id)

    return payload
