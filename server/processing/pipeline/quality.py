"""
Quality assessment module for the Drapnr processing pipeline.

Provides functions to assess the quality of frames, masks, and textures
at various stages of the pipeline, and to generate overall quality reports.

Functions
---------
- ``assess_frame_quality`` — Laplacian variance for blur detection.
- ``assess_mask_quality`` — Coverage, edge smoothness, hole count.
- ``assess_texture_quality`` — Resolution, coverage, seam visibility.
- ``generate_quality_report`` — Overall quality metrics for a job.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Frame quality assessment
# ---------------------------------------------------------------------------

def assess_frame_quality(frame: NDArray[np.uint8]) -> float:
    """Assess frame quality using Laplacian variance (blur detection).

    The Laplacian operator highlights edges and rapid intensity changes.
    A well-focused image will have high variance in the Laplacian response,
    while a blurry image will have low variance.

    Parameters
    ----------
    frame:
        BGR image (OpenCV format).

    Returns
    -------
    score:
        Laplacian variance. Higher values indicate sharper images.
        Typical thresholds:
        - < 50: very blurry (likely out of focus or motion blur)
        - 50-100: slightly blurry (may still be usable)
        - 100-500: acceptable quality
        - > 500: very sharp
    """
    if frame is None or frame.size == 0:
        return 0.0

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    score = float(laplacian.var())

    logger.debug("Frame quality score (Laplacian variance): %.2f", score)
    return score


# ---------------------------------------------------------------------------
# Mask quality assessment
# ---------------------------------------------------------------------------

def assess_mask_quality(mask: NDArray[np.uint8]) -> float:
    """Assess segmentation mask quality using multiple metrics.

    Evaluates:
    1. **Coverage** — fraction of image covered (penalise extremes).
    2. **Edge smoothness** — ratio of perimeter to area (smooth = good).
    3. **Hole count** — number of interior holes (fewer = better).

    The final score is a weighted combination in [0.0, 1.0].

    Parameters
    ----------
    mask:
        Binary segmentation mask (H x W), values 0 or 255.

    Returns
    -------
    quality:
        Combined quality score in [0.0, 1.0]. Higher is better.
    """
    if mask is None or mask.size == 0:
        return 0.0

    h, w = mask.shape[:2]
    total_pixels = h * w

    # --- Coverage score (0 to 1) ---
    fg_count = int((mask > 127).sum())
    coverage = fg_count / max(total_pixels, 1)

    # Ideal coverage is 10-60% for a person in frame.
    if coverage < 0.03:
        coverage_score = 0.0
    elif coverage < 0.10:
        coverage_score = (coverage - 0.03) / 0.07  # Ramp up
    elif coverage <= 0.60:
        coverage_score = 1.0
    elif coverage <= 0.80:
        coverage_score = 1.0 - (coverage - 0.60) / 0.20  # Ramp down
    else:
        coverage_score = 0.0

    # --- Edge smoothness score (0 to 1) ---
    edge_score = _compute_edge_smoothness(mask)

    # --- Hole count score (0 to 1) ---
    hole_count = _count_holes(mask)
    # Penalise masks with many holes (noise/fragmentation).
    if hole_count == 0:
        hole_score = 1.0
    elif hole_count <= 3:
        hole_score = 0.8
    elif hole_count <= 10:
        hole_score = 0.5
    else:
        hole_score = max(0.0, 1.0 - hole_count / 50.0)

    # Weighted combination.
    quality = 0.4 * coverage_score + 0.35 * edge_score + 0.25 * hole_score

    logger.debug(
        "Mask quality: %.3f (coverage=%.3f [%.1f%%], edges=%.3f, holes=%d [%.3f])",
        quality,
        coverage_score,
        coverage * 100,
        edge_score,
        hole_count,
        hole_score,
    )
    return quality


def _compute_edge_smoothness(mask: NDArray[np.uint8]) -> float:
    """Compute edge smoothness of a binary mask.

    Uses the ratio of perimeter^2 to area (isoperimetric quotient).
    A perfect circle has the highest score; jagged edges score lower.

    Returns a score in [0.0, 1.0].
    """
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0

    # Use the largest contour.
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    perimeter = cv2.arcLength(largest, closed=True)

    if perimeter == 0 or area == 0:
        return 0.0

    # Isoperimetric quotient: 4 * pi * area / perimeter^2
    # Perfect circle = 1.0; lower values = more jagged.
    iq = (4.0 * np.pi * area) / (perimeter * perimeter)

    # Clamp and scale: typical human silhouettes score 0.3-0.7
    return float(min(1.0, iq * 1.5))


def _count_holes(mask: NDArray[np.uint8]) -> int:
    """Count the number of holes (interior regions of background) in the mask.

    Parameters
    ----------
    mask:
        Binary mask.

    Returns
    -------
    hole_count:
        Number of background regions enclosed by foreground.
    """
    # Invert the mask to find background regions.
    inverted = cv2.bitwise_not(mask)

    # Find connected components in the inverted mask.
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        inverted, connectivity=8
    )

    if num_labels <= 1:
        return 0

    # The largest background region is the actual background (touches edges).
    # Everything else is a "hole".
    # Find which components touch the border.
    h, w = mask.shape[:2]
    border_labels = set()
    border_labels.update(labels[0, :].tolist())     # Top row
    border_labels.update(labels[-1, :].tolist())    # Bottom row
    border_labels.update(labels[:, 0].tolist())     # Left col
    border_labels.update(labels[:, -1].tolist())    # Right col

    # Holes are non-border background components.
    hole_count = 0
    for label_id in range(1, num_labels):
        if label_id not in border_labels:
            # Only count if the hole is significant (> 20 pixels).
            if stats[label_id, cv2.CC_STAT_AREA] > 20:
                hole_count += 1

    return hole_count


def get_mask_coverage(mask: NDArray[np.uint8]) -> float:
    """Return the fraction of pixels that are foreground (0.0 to 1.0).

    Parameters
    ----------
    mask:
        Binary mask.

    Returns
    -------
    coverage:
        Foreground pixel fraction.
    """
    total = mask.shape[0] * mask.shape[1]
    if total == 0:
        return 0.0
    return int((mask > 127).sum()) / total


def get_hole_count(mask: NDArray[np.uint8]) -> int:
    """Public accessor for hole count in a mask.

    Parameters
    ----------
    mask:
        Binary mask.

    Returns
    -------
    holes:
        Number of interior holes.
    """
    return _count_holes(mask)


# ---------------------------------------------------------------------------
# Texture quality assessment
# ---------------------------------------------------------------------------

def assess_texture_quality(texture: NDArray[np.uint8]) -> float:
    """Assess the quality of a generated UV texture.

    Evaluates:
    1. **Resolution adequacy** — whether the texture has enough detail.
    2. **Coverage** — fraction of the texture with valid data (alpha > 0).
    3. **Seam visibility** — discontinuities at the wrap-around boundary.

    Parameters
    ----------
    texture:
        BGRA texture image of shape (H, W, 4).

    Returns
    -------
    quality:
        Combined quality score in [0.0, 1.0]. Higher is better.
    """
    if texture is None or texture.size == 0:
        return 0.0

    if texture.ndim != 3 or texture.shape[2] != 4:
        logger.warning("Texture has unexpected shape %s (expected H x W x 4)", texture.shape)
        return 0.0

    h, w = texture.shape[:2]

    # --- Resolution score ---
    resolution_score = _assess_resolution(h, w)

    # --- Coverage score ---
    coverage_score = _assess_texture_coverage(texture)

    # --- Seam visibility score ---
    seam_score = _assess_seam_visibility(texture)

    # Weighted combination.
    quality = 0.25 * resolution_score + 0.45 * coverage_score + 0.30 * seam_score

    logger.debug(
        "Texture quality: %.3f (resolution=%.3f [%dx%d], coverage=%.3f, seam=%.3f)",
        quality,
        resolution_score,
        w,
        h,
        coverage_score,
        seam_score,
    )
    return quality


def _assess_resolution(h: int, w: int) -> float:
    """Score resolution adequacy. 1024x1024 or larger = 1.0."""
    min_dim = min(h, w)
    if min_dim >= 1024:
        return 1.0
    elif min_dim >= 512:
        return 0.7 + 0.3 * (min_dim - 512) / 512
    elif min_dim >= 256:
        return 0.3 + 0.4 * (min_dim - 256) / 256
    else:
        return min_dim / 256.0 * 0.3


def _assess_texture_coverage(texture: NDArray[np.uint8]) -> float:
    """Score texture coverage. >70% = full score."""
    alpha = texture[:, :, 3]
    total = alpha.shape[0] * alpha.shape[1]
    valid = int((alpha > 0).sum())
    coverage = valid / max(total, 1)

    if coverage >= 0.70:
        return 1.0
    elif coverage >= 0.40:
        return 0.5 + 0.5 * (coverage - 0.40) / 0.30
    elif coverage >= 0.10:
        return 0.5 * (coverage - 0.10) / 0.30
    else:
        return 0.0


def _assess_seam_visibility(
    texture: NDArray[np.uint8],
    seam_width: int = 8,
) -> float:
    """Score seam visibility at the 0/360-degree boundary.

    Compares pixel values at the left and right edges. Lower difference = better
    seam blending = higher score.

    Parameters
    ----------
    texture:
        BGRA texture.
    seam_width:
        Number of columns to compare on each side.

    Returns
    -------
    score:
        Seam quality in [0.0, 1.0]. Higher = less visible seam.
    """
    w = texture.shape[1]
    alpha = texture[:, :, 3]
    bgr = texture[:, :, :3].astype(np.float32)

    half = min(seam_width, w // 4)
    if half < 1:
        return 1.0

    left_strip = bgr[:, :half, :]
    right_strip = bgr[:, w - half:, :]
    left_alpha = alpha[:, :half]
    right_alpha = alpha[:, w - half:]

    # Only compare rows where both sides have data.
    both_valid = (left_alpha > 0) & (right_alpha > 0)
    valid_rows = both_valid.any(axis=1)

    if valid_rows.sum() == 0:
        return 1.0  # No seam to evaluate.

    # Compute mean colour difference at the seam.
    diffs = []
    for row_idx in np.where(valid_rows)[0]:
        left_valid = left_alpha[row_idx] > 0
        right_valid = right_alpha[row_idx] > 0
        if left_valid.any() and right_valid.any():
            left_mean = left_strip[row_idx, left_valid].mean(axis=0)
            right_mean = right_strip[row_idx, right_valid].mean(axis=0)
            diff = np.sqrt(np.sum((left_mean - right_mean) ** 2))
            diffs.append(diff)

    if not diffs:
        return 1.0

    mean_diff = np.mean(diffs)

    # Map difference to score. <10 = excellent, >50 = poor.
    if mean_diff < 10:
        return 1.0
    elif mean_diff < 30:
        return 1.0 - (mean_diff - 10) / 40
    elif mean_diff < 50:
        return 0.5 - (mean_diff - 30) / 40
    else:
        return max(0.0, 0.25 - (mean_diff - 50) / 200)


# ---------------------------------------------------------------------------
# Quality report generation
# ---------------------------------------------------------------------------

def generate_quality_report(
    job_id: str,
    *,
    frames: Optional[List[NDArray[np.uint8]]] = None,
    masks: Optional[List[NDArray[np.uint8]]] = None,
    textures: Optional[Dict[str, NDArray[np.uint8]]] = None,
) -> Dict[str, Any]:
    """Generate a comprehensive quality report for a processing job.

    Aggregates quality metrics from all pipeline stages into a single report
    suitable for logging, monitoring, and user feedback.

    Parameters
    ----------
    job_id:
        Processing job identifier.
    frames:
        Optional list of BGR frames for quality assessment.
    masks:
        Optional list of segmentation masks.
    textures:
        Optional dict of category -> BGRA textures.

    Returns
    -------
    report:
        Quality report dictionary with per-stage and overall metrics.
    """
    report: Dict[str, Any] = {
        "job_id": job_id,
        "overall_quality": 0.0,
        "frames": {},
        "masks": {},
        "textures": {},
    }

    scores: List[float] = []

    # --- Frame quality ---
    if frames:
        frame_scores = [assess_frame_quality(f) for f in frames]
        avg_frame = float(np.mean(frame_scores)) if frame_scores else 0.0
        min_frame = float(np.min(frame_scores)) if frame_scores else 0.0
        max_frame = float(np.max(frame_scores)) if frame_scores else 0.0

        # Normalise to 0-1 (assuming 500 is "perfect").
        normalised_frame = min(1.0, avg_frame / 500.0)

        report["frames"] = {
            "count": len(frames),
            "mean_laplacian_variance": round(avg_frame, 2),
            "min_laplacian_variance": round(min_frame, 2),
            "max_laplacian_variance": round(max_frame, 2),
            "normalised_score": round(normalised_frame, 4),
            "per_frame": [round(s, 2) for s in frame_scores],
        }
        scores.append(normalised_frame)

    # --- Mask quality ---
    if masks:
        mask_scores = [assess_mask_quality(m) for m in masks]
        avg_mask = float(np.mean(mask_scores)) if mask_scores else 0.0

        report["masks"] = {
            "count": len(masks),
            "mean_quality": round(avg_mask, 4),
            "per_mask": [round(s, 4) for s in mask_scores],
        }
        scores.append(avg_mask)

    # --- Texture quality ---
    if textures:
        tex_entries: Dict[str, Dict[str, Any]] = {}
        tex_scores_list: List[float] = []

        for cat, tex in textures.items():
            q = assess_texture_quality(tex)
            tex_scores_list.append(q)
            tex_entries[cat] = {
                "quality": round(q, 4),
                "resolution": list(tex.shape[:2]),
            }

        avg_tex = float(np.mean(tex_scores_list)) if tex_scores_list else 0.0

        report["textures"] = {
            "count": len(textures),
            "mean_quality": round(avg_tex, 4),
            "per_category": tex_entries,
        }
        scores.append(avg_tex)

    # --- Overall quality ---
    if scores:
        report["overall_quality"] = round(float(np.mean(scores)), 4)

    logger.info(
        "Quality report for job %s: overall=%.3f",
        job_id,
        report["overall_quality"],
    )

    return report
