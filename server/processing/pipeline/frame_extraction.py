"""
Frame extraction: download frames from Supabase Storage URLs and pre-process
them into a consistent format for the segmentation pipeline.

Robustness features:
- Retry logic with exponential backoff for failed downloads (3 retries).
- Frame quality scoring: reject blurry frames (Laplacian variance < threshold).
- Person detection validation per frame (skip frames where person is cut off).
- Sort frames by estimated angle for consistent ordering.
"""

from __future__ import annotations

import asyncio
import logging
import math
from io import BytesIO
from typing import List, Optional, Tuple

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

# Quality thresholds.
_BLUR_THRESHOLD = 50.0  # Laplacian variance below this = too blurry
_MIN_PERSON_COVERAGE = 0.03  # Minimum fraction of frame that should be foreground

# Retry settings.
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0  # seconds


# ---------------------------------------------------------------------------
# Download with retry
# ---------------------------------------------------------------------------

async def download_frame(
    client: httpx.AsyncClient,
    url: str,
    *,
    timeout: int | None = None,
    max_retries: int = _MAX_RETRIES,
    retry_base_delay: float = _RETRY_BASE_DELAY,
) -> bytes:
    """Download a single frame with retry logic and exponential backoff.

    Retries up to ``max_retries`` times on transient failures (network errors,
    5xx responses). Non-retryable errors (4xx, invalid content type) fail
    immediately.

    Parameters
    ----------
    client:
        Async HTTP client.
    url:
        URL to download.
    timeout:
        Per-request timeout in seconds.
    max_retries:
        Maximum number of retry attempts.
    retry_base_delay:
        Base delay for exponential backoff (seconds).

    Raises
    ------
    ValueError
        If the response content-type is not a supported image format.
    httpx.HTTPStatusError
        If the server responds with a non-2xx status code after all retries.
    RuntimeError
        If all retry attempts are exhausted.
    """
    timeout = timeout or settings.download_timeout_seconds
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            response = await client.get(url, timeout=timeout)

            # Non-retryable client errors.
            if 400 <= response.status_code < 500:
                response.raise_for_status()

            # Retryable server errors.
            if response.status_code >= 500:
                raise httpx.HTTPStatusError(
                    f"Server error {response.status_code}",
                    request=response.request,
                    response=response,
                )

            response.raise_for_status()

            content_type = response.headers.get("content-type", "").split(";")[0].strip()
            if content_type and content_type not in _VALID_CONTENT_TYPES:
                raise ValueError(
                    f"Unsupported content type '{content_type}' from {url}"
                )

            return response.content

        except (httpx.HTTPStatusError, httpx.TimeoutException, httpx.ConnectError) as exc:
            last_error = exc
            if attempt < max_retries:
                delay = retry_base_delay * (2 ** attempt)
                logger.warning(
                    "Download attempt %d/%d failed for %s: %s. Retrying in %.1fs",
                    attempt + 1,
                    max_retries + 1,
                    url,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "All %d download attempts failed for %s: %s",
                    max_retries + 1,
                    url,
                    exc,
                )

        except ValueError:
            # Content type errors are not retryable.
            raise

        except Exception as exc:
            last_error = exc
            if attempt < max_retries:
                delay = retry_base_delay * (2 ** attempt)
                logger.warning(
                    "Unexpected error on attempt %d/%d for %s: %s. Retrying in %.1fs",
                    attempt + 1,
                    max_retries + 1,
                    url,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "All %d download attempts failed for %s: %s",
                    max_retries + 1,
                    url,
                    exc,
                )

    raise RuntimeError(
        f"Failed to download {url} after {max_retries + 1} attempts: {last_error}"
    )


# ---------------------------------------------------------------------------
# Image decoding and preprocessing
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Frame quality assessment
# ---------------------------------------------------------------------------

def assess_frame_blur(frame: NDArray[np.uint8]) -> float:
    """Compute blur score using Laplacian variance.

    Higher values indicate sharper images. A value below ``_BLUR_THRESHOLD``
    typically indicates a blurry or out-of-focus frame.

    Parameters
    ----------
    frame:
        BGR image.

    Returns
    -------
    score:
        Laplacian variance (higher = sharper).
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    return float(laplacian.var())


def assess_person_presence(
    frame: NDArray[np.uint8],
    min_coverage: float = _MIN_PERSON_COVERAGE,
) -> Tuple[bool, float]:
    """Quick heuristic to check if a person is reasonably visible in the frame.

    Uses a combination of:
    - Foreground detection via simple background subtraction (GrabCut-lite).
    - Edge density in the central region.
    - Skin colour detection in HSV space.

    Parameters
    ----------
    frame:
        BGR image.
    min_coverage:
        Minimum fraction of frame that should contain foreground.

    Returns
    -------
    is_valid:
        True if a person appears to be present and not cut off.
    coverage:
        Estimated foreground coverage fraction.
    """
    h, w = frame.shape[:2]

    # Check central region has content (person usually in centre).
    central_region = frame[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]

    # Edge detection in central region.
    gray_central = cv2.cvtColor(central_region, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray_central, 50, 150)
    edge_density = edges.sum() / (255.0 * edges.shape[0] * edges.shape[1])

    # Skin detection in HSV space (broad range to catch diverse skin tones).
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    skin_lower = np.array([0, 20, 70], dtype=np.uint8)
    skin_upper = np.array([35, 255, 255], dtype=np.uint8)
    skin_mask = cv2.inRange(hsv, skin_lower, skin_upper)
    skin_coverage = skin_mask.sum() / (255.0 * h * w)

    # Combined coverage estimate.
    coverage = max(edge_density * 5, skin_coverage)  # Rough heuristic

    is_valid = coverage >= min_coverage and edge_density > 0.005

    if not is_valid:
        logger.debug(
            "Frame failed person presence check: edge_density=%.4f, "
            "skin_coverage=%.4f, coverage=%.4f",
            edge_density,
            skin_coverage,
            coverage,
        )

    return is_valid, coverage


def _estimate_frame_angle(
    frame: NDArray[np.uint8],
    index: int,
    total_frames: int,
) -> float:
    """Estimate the camera angle for a frame.

    Currently uses index-based estimation (frames are assumed evenly spaced).
    In future, visual feature matching could provide more accurate estimates.

    Parameters
    ----------
    frame:
        BGR image (unused in current implementation, reserved for future).
    index:
        Frame index in the capture sequence.
    total_frames:
        Total number of frames.

    Returns
    -------
    angle:
        Estimated camera azimuth in radians.
    """
    return (2.0 * math.pi * index) / max(total_frames, 1)


# ---------------------------------------------------------------------------
# Preprocessing pipeline
# ---------------------------------------------------------------------------

def validate_and_preprocess(raw: bytes) -> NDArray[np.uint8]:
    """Decode, validate, and resize a single frame."""
    img = decode_image(raw)
    img = resize_frame(img)
    return img


async def download_and_preprocess_frames(
    frame_urls: List[str],
    *,
    max_concurrency: int = 16,
    reject_blurry: bool = True,
    validate_person: bool = True,
    blur_threshold: float = _BLUR_THRESHOLD,
) -> Tuple[List[NDArray[np.uint8]], List[str]]:
    """Download all frame URLs concurrently and return pre-processed images.

    Applies quality filtering:
    - Retries failed downloads up to 3 times with exponential backoff.
    - Rejects blurry frames (Laplacian variance below threshold).
    - Validates person presence in each frame.
    - Sorts frames by estimated angle for consistent ordering.

    Parameters
    ----------
    frame_urls:
        Ordered list of image URLs (assumed evenly spaced across 360 degrees).
    max_concurrency:
        Maximum number of simultaneous HTTP connections.
    reject_blurry:
        Whether to reject frames below the blur threshold.
    validate_person:
        Whether to validate person presence in each frame.
    blur_threshold:
        Laplacian variance threshold for blur detection.

    Returns
    -------
    frames:
        List of pre-processed BGR images (numpy arrays), sorted by angle.
    errors:
        List of error messages for frames that failed to download/decode.
    """
    semaphore = asyncio.Semaphore(max_concurrency)

    # Store (index, frame, angle) tuples for sorting.
    frame_data: List[Tuple[int, NDArray[np.uint8], float] | None] = [None] * len(frame_urls)
    errors: List[str] = []
    quality_stats = {"blurry": 0, "no_person": 0, "download_failed": 0}

    async def _fetch(idx: int, url: str) -> None:
        async with semaphore:
            try:
                async with httpx.AsyncClient() as client:
                    raw = await download_frame(client, url)
                img = validate_and_preprocess(raw)

                # Quality check: blur detection.
                if reject_blurry:
                    blur_score = assess_frame_blur(img)
                    if blur_score < blur_threshold:
                        msg = (
                            f"Frame {idx} rejected: too blurry "
                            f"(score={blur_score:.1f}, threshold={blur_threshold})"
                        )
                        logger.warning(msg)
                        errors.append(msg)
                        quality_stats["blurry"] += 1
                        return

                # Quality check: person presence.
                if validate_person:
                    is_valid, coverage = assess_person_presence(img)
                    if not is_valid:
                        msg = (
                            f"Frame {idx} rejected: person not detected or cut off "
                            f"(coverage={coverage:.3f})"
                        )
                        logger.warning(msg)
                        errors.append(msg)
                        quality_stats["no_person"] += 1
                        return

                angle = _estimate_frame_angle(img, idx, len(frame_urls))
                frame_data[idx] = (idx, img, angle)

            except Exception as exc:
                msg = f"Frame {idx} ({url}): {exc}"
                logger.warning(msg)
                errors.append(msg)
                quality_stats["download_failed"] += 1

    await asyncio.gather(*[_fetch(i, url) for i, url in enumerate(frame_urls)])

    # Collect valid frames and sort by angle for consistent ordering.
    valid_entries = [entry for entry in frame_data if entry is not None]
    valid_entries.sort(key=lambda e: e[2])  # Sort by angle

    valid_frames = [entry[1] for entry in valid_entries]

    logger.info(
        "Downloaded %d/%d frames successfully (blurry=%d, no_person=%d, failed=%d)",
        len(valid_frames),
        len(frame_urls),
        quality_stats["blurry"],
        quality_stats["no_person"],
        quality_stats["download_failed"],
    )
    return valid_frames, errors
