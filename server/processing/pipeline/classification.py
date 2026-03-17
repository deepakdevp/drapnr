"""
Garment region classification.

Given a binary segmentation mask for a single frame, this module classifies
sub-regions of the mask into garment categories:

- **top** — upper-body garments (shirts, jackets, etc.)
- **bottom** — lower-body garments (pants, skirts, etc.)
- **shoes** — footwear

The approach analyses the vertical distribution of foreground pixels within the
mask and applies adaptive thresholds based on the centroid of the foreground
mass. This is fast, deterministic, and works well when the subject is standing
upright in a controlled capture environment (which is the Drapnr use-case).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Literal, Tuple

import cv2
import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

GarmentCategory = Literal["top", "bottom", "shoes"]

GARMENT_CATEGORIES: Tuple[GarmentCategory, ...] = ("top", "bottom", "shoes")


@dataclass
class ClassifiedRegion:
    """A single classified garment region for one frame."""

    category: GarmentCategory
    mask: NDArray[np.uint8]  # H x W, values 0 or 255
    confidence: float  # 0.0 – 1.0
    bbox: Tuple[int, int, int, int]  # (x, y, w, h)
    pixel_count: int


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _compute_vertical_profile(mask: NDArray[np.uint8]) -> NDArray[np.float64]:
    """Return a 1-D array of shape (H,) with the fraction of foreground pixels
    in each row.  Values are in [0, 1].
    """
    binary = (mask > 127).astype(np.float64)
    row_sums = binary.sum(axis=1)
    width = mask.shape[1]
    return row_sums / max(width, 1)


def _find_body_bounds(
    profile: NDArray[np.float64],
    threshold: float = 0.02,
) -> Tuple[int, int]:
    """Return the top-most and bottom-most rows that contain a meaningful
    amount of foreground pixels (above *threshold* fraction).
    """
    indices = np.where(profile > threshold)[0]
    if len(indices) == 0:
        return 0, len(profile) - 1
    return int(indices[0]), int(indices[-1])


def _adaptive_splits(
    top_row: int,
    bottom_row: int,
    profile: NDArray[np.float64],
) -> Tuple[int, int]:
    """Determine the row boundaries between top/bottom and bottom/shoes.

    We look for natural "waist" and "ankle" regions by finding local minima in
    the vertical density profile.  If no clear minimum is found we fall back to
    fixed proportional splits.

    Returns
    -------
    waist_row:
        Row separating *top* from *bottom*.
    ankle_row:
        Row separating *bottom* from *shoes*.
    """
    body_height = bottom_row - top_row
    if body_height <= 0:
        mid = (top_row + bottom_row) // 2
        return mid, mid

    # Smooth the profile to suppress noise.
    kernel_size = max(3, body_height // 20) | 1  # ensure odd
    smoothed = cv2.GaussianBlur(
        profile[top_row : bottom_row + 1].reshape(-1, 1),
        (1, kernel_size),
        0,
    ).flatten()

    # --- Waist detection (search in 35-60% of body height) -----------------
    waist_search_start = int(body_height * 0.35)
    waist_search_end = int(body_height * 0.60)
    waist_region = smoothed[waist_search_start:waist_search_end]

    if len(waist_region) > 0 and waist_region.max() > 0:
        waist_local = int(np.argmin(waist_region))
        waist_row = top_row + waist_search_start + waist_local
    else:
        waist_row = top_row + int(body_height * 0.45)

    # --- Ankle detection (search in 82-95% of body height) -----------------
    ankle_search_start = int(body_height * 0.82)
    ankle_search_end = int(body_height * 0.95)
    ankle_region = smoothed[ankle_search_start:ankle_search_end]

    if len(ankle_region) > 0 and ankle_region.max() > 0:
        ankle_local = int(np.argmin(ankle_region))
        ankle_row = top_row + ankle_search_start + ankle_local
    else:
        ankle_row = top_row + int(body_height * 0.88)

    return waist_row, ankle_row


def _extract_region_mask(
    full_mask: NDArray[np.uint8],
    row_start: int,
    row_end: int,
) -> Tuple[NDArray[np.uint8], Tuple[int, int, int, int], int]:
    """Extract a region mask for the given row range.

    Returns the full-size mask (zeros outside the row range), a bounding box,
    and the foreground pixel count.
    """
    region = np.zeros_like(full_mask)
    region[row_start:row_end, :] = full_mask[row_start:row_end, :]

    fg_count = int((region > 127).sum())

    # Compute tight bounding box.
    coords = cv2.findNonZero(region)
    if coords is not None:
        x, y, w, h = cv2.boundingRect(coords)
        bbox = (x, y, w, h)
    else:
        bbox = (0, row_start, full_mask.shape[1], row_end - row_start)

    return region, bbox, fg_count


def _region_confidence(pixel_count: int, total_fg: int) -> float:
    """Heuristic confidence based on the fraction of total foreground pixels
    that belong to this region.

    Regions with very few pixels get lower confidence because they may be
    misclassified noise.
    """
    if total_fg == 0:
        return 0.0
    ratio = pixel_count / total_fg
    # Penalise extremely small regions.
    if ratio < 0.03:
        return max(0.0, ratio * 5)
    return min(1.0, 0.5 + ratio)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_frame(
    mask: NDArray[np.uint8],
) -> Dict[GarmentCategory, ClassifiedRegion]:
    """Classify a single segmentation mask into garment regions.

    Parameters
    ----------
    mask:
        Binary segmentation mask (H x W), values 0 or 255.

    Returns
    -------
    regions:
        Mapping from garment category to ``ClassifiedRegion``.  Categories with
        zero foreground pixels are omitted.
    """
    profile = _compute_vertical_profile(mask)
    top_row, bottom_row = _find_body_bounds(profile)
    waist_row, ankle_row = _adaptive_splits(top_row, bottom_row, profile)

    total_fg = int((mask > 127).sum())

    splits: Dict[GarmentCategory, Tuple[int, int]] = {
        "top": (top_row, waist_row),
        "bottom": (waist_row, ankle_row),
        "shoes": (ankle_row, bottom_row + 1),
    }

    regions: Dict[GarmentCategory, ClassifiedRegion] = {}
    for category, (r_start, r_end) in splits.items():
        region_mask, bbox, px_count = _extract_region_mask(mask, r_start, r_end)
        if px_count == 0:
            continue
        confidence = _region_confidence(px_count, total_fg)
        regions[category] = ClassifiedRegion(
            category=category,
            mask=region_mask,
            confidence=confidence,
            bbox=bbox,
            pixel_count=px_count,
        )

    logger.debug(
        "Classified mask into %d regions: %s",
        len(regions),
        {k: f"{v.confidence:.2f}" for k, v in regions.items()},
    )
    return regions


def classify_all_frames(
    masks: List[NDArray[np.uint8]],
) -> List[Dict[GarmentCategory, ClassifiedRegion]]:
    """Classify garment regions for every frame mask.

    Parameters
    ----------
    masks:
        Per-frame binary segmentation masks.

    Returns
    -------
    classifications:
        Per-frame classification dicts aligned with *masks*.
    """
    results = [classify_frame(m) for m in masks]
    logger.info("Classification complete for %d frames", len(results))
    return results
