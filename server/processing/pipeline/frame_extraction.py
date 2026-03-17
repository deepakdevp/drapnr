"""
Frame extraction: download frames from Supabase Storage URLs and pre-process
them into a consistent format for the segmentation pipeline.
"""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO
from typing import List, Tuple

import cv2
import httpx
import numpy as np
from numpy.typing import NDArray

from config import settings

logger = logging.getLogger(__name__)

# Accepted MIME types for uploaded frames.
_VALID_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)


async def download_frame(
    client: httpx.AsyncClient,
    url: str,
    *,
    timeout: int | None = None,
) -> bytes:
    """Download a single frame and return raw bytes.

    Raises
    ------
    ValueError
        If the response content-type is not a supported image format.
    httpx.HTTPStatusError
        If the server responds with a non-2xx status code.
    """
    timeout = timeout or settings.download_timeout_seconds
    response = await client.get(url, timeout=timeout)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "").split(";")[0].strip()
    if content_type and content_type not in _VALID_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported content type '{content_type}' from {url}"
        )

    return response.content


def decode_image(raw: bytes) -> NDArray[np.uint8]:
    """Decode raw image bytes into a BGR numpy array (OpenCV convention).

    Raises
    ------
    ValueError
        If the image cannot be decoded.
    """
    buf = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes")
    return img


def resize_frame(
    img: NDArray[np.uint8],
    width: int | None = None,
    height: int | None = None,
) -> NDArray[np.uint8]:
    """Resize *img* to (width, height) using area interpolation for
    down-scaling and cubic for up-scaling.  Defaults come from settings.
    """
    width = width or settings.frame_resize_width
    height = height or settings.frame_resize_height

    h, w = img.shape[:2]
    if (w, h) == (width, height):
        return img

    interp = cv2.INTER_AREA if (w * h) > (width * height) else cv2.INTER_CUBIC
    return cv2.resize(img, (width, height), interpolation=interp)


def validate_and_preprocess(raw: bytes) -> NDArray[np.uint8]:
    """Decode, validate, and resize a single frame."""
    img = decode_image(raw)
    img = resize_frame(img)
    return img


async def download_and_preprocess_frames(
    frame_urls: List[str],
    *,
    max_concurrency: int = 16,
) -> Tuple[List[NDArray[np.uint8]], List[str]]:
    """Download all frame URLs concurrently and return pre-processed images.

    Parameters
    ----------
    frame_urls:
        Ordered list of image URLs (assumed evenly spaced across 360 degrees).
    max_concurrency:
        Maximum number of simultaneous HTTP connections.

    Returns
    -------
    frames:
        List of pre-processed BGR images (numpy arrays).
    errors:
        List of error messages for frames that failed to download/decode.
    """
    semaphore = asyncio.Semaphore(max_concurrency)
    frames: List[NDArray[np.uint8] | None] = [None] * len(frame_urls)
    errors: List[str] = []

    async def _fetch(idx: int, url: str) -> None:
        async with semaphore:
            try:
                async with httpx.AsyncClient() as client:
                    raw = await download_frame(client, url)
                frames[idx] = validate_and_preprocess(raw)
            except Exception as exc:
                msg = f"Frame {idx} ({url}): {exc}"
                logger.warning(msg)
                errors.append(msg)

    await asyncio.gather(*[_fetch(i, url) for i, url in enumerate(frame_urls)])

    # Filter out failed frames (keep ordering stable).
    valid_frames = [f for f in frames if f is not None]
    logger.info(
        "Downloaded %d/%d frames successfully", len(valid_frames), len(frame_urls)
    )
    return valid_frames, errors
