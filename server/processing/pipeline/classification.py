"""
Garment region classification.

Given a binary segmentation mask for a single frame, this module classifies
sub-regions of the mask into garment categories:

- **top** — upper-body garments (shirts, jackets, etc.)
- **bottom** — lower-body garments (pants, skirts, etc.)
- **shoes** — footwear
- **dress** — full-length garments that span top+bottom (detected and split)

The approach analyses the vertical distribution of foreground pixels within the
mask and applies adaptive thresholds based on the centroid of the foreground
mass.  Additional heuristics detect:

- **Pose awareness**: sitting vs standing detection adjusts thresholds.
- **Dress detection**: single long garments classified as top+bottom combined.
- **Sleeve detection**: garments extending to wrists suggest top classification.
- **Color validation**: cross-category colour consistency checks.
- **Multi-heuristic confidence**: combines several signals for robust scoring.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Tuple

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
# Pose detection helpers
# ---------------------------------------------------------------------------

def _detect_pose(
    mask: NDArray[np.uint8],
    profile: NDArray[np.float64],
) -> Literal["standing", "sitting", "unknown"]:
    """Heuristic pose detection based on mask shape analysis.

    A sitting person has a distinctly different vertical profile:
    - The foreground mass is concentrated in the upper 60% of the mask.
    - The aspect ratio of the bounding box is wider relative to height.
    - There is minimal foreground in the lower 30% of the body.

    Parameters
    ----------
    mask:
        Binary segmentation mask.
    profile:
        Pre-computed vertical density profile.

    Returns
    -------
    pose:
        Detected pose: ``"standing"``, ``"sitting"``, or ``"unknown"``.
    """
    h = mask.shape[0]
    fg_rows = np.where(profile > 0.02)[0]
    if len(fg_rows) < 10:
        return "unknown"

    top_row = int(fg_rows[0])
    bottom_row = int(fg_rows[-1])
    body_height = bottom_row - top_row
    if body_height <= 0:
        return "unknown"

    # Compute foreground distribution in upper vs lower halves.
    mid_row = top_row + body_height // 2
    upper_mass = profile[top_row:mid_row].sum()
    lower_mass = profile[mid_row:bottom_row + 1].sum()
    total_mass = upper_mass + lower_mass

    if total_mass == 0:
        return "unknown"

    upper_ratio = upper_mass / total_mass

    # Compute bounding box aspect ratio.
    coords = cv2.findNonZero(mask)
    if coords is None:
        return "unknown"
    _, _, bw, bh = cv2.boundingRect(coords)
    aspect_ratio = bw / max(bh, 1)

    # Sitting: upper-heavy distribution + wider aspect ratio.
    if upper_ratio > 0.60 and aspect_ratio > 0.45:
        logger.debug(
            "Pose detected: sitting (upper_ratio=%.2f, aspect=%.2f)",
            upper_ratio,
            aspect_ratio,
        )
        return "sitting"

    # Check for very little lower-body content (legs tucked under).
    lower_third_start = top_row + int(body_height * 0.7)
    lower_third_mass = profile[lower_third_start:bottom_row + 1].sum()
    lower_third_ratio = lower_third_mass / total_mass if total_mass > 0 else 0

    if lower_third_ratio < 0.10 and upper_ratio > 0.55:
        logger.debug(
            "Pose detected: sitting (low lower-third ratio=%.2f)",
            lower_third_ratio,
        )
        return "sitting"

    return "standing"


# ---------------------------------------------------------------------------
# Dress / full-body garment detection
# ---------------------------------------------------------------------------

def _detect_dress(
    mask: NDArray[np.uint8],
    profile: NDArray[np.float64],
    top_row: int,
    bottom_row: int,
) -> bool:
    """Detect if the mask represents a single long garment (dress/gown/jumpsuit).

    A dress is characterised by:
    - Continuous foreground coverage from chest to below knees (>65% of body).
    - No significant narrowing at the waist (the "waist dip" is shallow).
    - Relatively uniform width throughout the garment length.

    Parameters
    ----------
    mask:
        Binary segmentation mask.
    profile:
        Vertical density profile.
    top_row, bottom_row:
        Body bounds.

    Returns
    -------
    is_dress:
        True if the garment appears to be a single full-length piece.
    """
    body_height = bottom_row - top_row
    if body_height < 20:
        return False

    # Check continuity: count rows with significant foreground.
    body_profile = profile[top_row:bottom_row + 1]
    significant_rows = (body_profile > 0.05).sum()
    continuity = significant_rows / max(len(body_profile), 1)

    if continuity < 0.85:
        return False

    # Check waist narrowing: compare width at chest, waist, and hip.
    chest_row = int(body_height * 0.25)
    waist_row = int(body_height * 0.45)
    hip_row = int(body_height * 0.60)

    chest_width = body_profile[chest_row] if chest_row < len(body_profile) else 0
    waist_width = body_profile[waist_row] if waist_row < len(body_profile) else 0
    hip_width = body_profile[hip_row] if hip_row < len(body_profile) else 0

    avg_width = (chest_width + hip_width) / 2.0
    if avg_width == 0:
        return False

    # If waist is not significantly narrower than surrounding regions, it's a dress.
    waist_ratio = waist_width / avg_width
    if waist_ratio > 0.70:
        # Also check that the garment extends past the typical waist point.
        below_waist_coverage = body_profile[waist_row:].mean()
        above_waist_coverage = body_profile[:waist_row].mean()
        if below_waist_coverage > 0.1 and above_waist_coverage > 0.1:
            logger.debug(
                "Dress detected: continuity=%.2f, waist_ratio=%.2f",
                continuity,
                waist_ratio,
            )
            return True

    return False


# ---------------------------------------------------------------------------
# Sleeve detection
# ---------------------------------------------------------------------------

def _detect_sleeves(
    mask: NDArray[np.uint8],
    top_row: int,
    bottom_row: int,
) -> Literal["long", "short", "none"]:
    """Detect sleeve length based on horizontal extent in the upper body region.

    Long sleeves extend the foreground width significantly in the arm region
    (roughly 20-40% of body height from top).

    Parameters
    ----------
    mask:
        Binary segmentation mask.
    top_row, bottom_row:
        Body bounds.

    Returns
    -------
    sleeve_type:
        ``"long"`` if garment extends to wrists, ``"short"`` for short sleeves,
        ``"none"`` if no clear sleeve pattern detected.
    """
    body_height = bottom_row - top_row
    if body_height < 20:
        return "none"

    h, w = mask.shape[:2]

    # Arm region: 15-35% of body height (shoulder to elbow area).
    arm_start = top_row + int(body_height * 0.15)
    arm_end = top_row + int(body_height * 0.35)

    # Lower arm region: 35-48% (elbow to wrist).
    lower_arm_start = top_row + int(body_height * 0.35)
    lower_arm_end = top_row + int(body_height * 0.48)

    # Torso width at chest level.
    chest_row = top_row + int(body_height * 0.25)
    if chest_row >= h:
        return "none"

    chest_slice = mask[chest_row, :]
    chest_fg = np.where(chest_slice > 127)[0]
    if len(chest_fg) < 5:
        return "none"
    chest_width = chest_fg[-1] - chest_fg[0]

    # Measure width at arm regions.
    arm_widths = []
    for row in range(arm_start, min(arm_end, h)):
        fg = np.where(mask[row, :] > 127)[0]
        if len(fg) > 0:
            arm_widths.append(fg[-1] - fg[0])

    lower_arm_widths = []
    for row in range(lower_arm_start, min(lower_arm_end, h)):
        fg = np.where(mask[row, :] > 127)[0]
        if len(fg) > 0:
            lower_arm_widths.append(fg[-1] - fg[0])

    if not arm_widths or chest_width == 0:
        return "none"

    avg_arm_width = np.mean(arm_widths)
    arm_extension = avg_arm_width / chest_width

    # If arms are significantly wider than torso, sleeves are present.
    if arm_extension > 1.2:
        # Check if lower arm also has extension (long sleeves).
        if lower_arm_widths:
            avg_lower = np.mean(lower_arm_widths)
            if avg_lower / chest_width > 1.0:
                return "long"
        return "short"

    return "none"


# ---------------------------------------------------------------------------
# Color-based validation
# ---------------------------------------------------------------------------

def _extract_dominant_color(
    image_bgr: NDArray[np.uint8],
    mask: NDArray[np.uint8],
) -> Optional[Tuple[float, float, float]]:
    """Extract the dominant colour (in HSV) from the masked region.

    Parameters
    ----------
    image_bgr:
        Source image in BGR.
    mask:
        Binary mask selecting the region.

    Returns
    -------
    dominant_hsv:
        (H, S, V) tuple of the dominant colour, or None if insufficient data.
    """
    fg_pixels = image_bgr[mask > 127]
    if len(fg_pixels) < 50:
        return None

    hsv = cv2.cvtColor(fg_pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV)
    hsv = hsv.reshape(-1, 3).astype(np.float64)

    return (float(np.median(hsv[:, 0])), float(np.median(hsv[:, 1])), float(np.median(hsv[:, 2])))


def _validate_color_consistency(
    regions: Dict[GarmentCategory, ClassifiedRegion],
    image_bgr: Optional[NDArray[np.uint8]] = None,
) -> Dict[GarmentCategory, float]:
    """Apply colour-based validation to adjust confidence scores.

    Heuristics:
    - Shoes are rarely the same colour as the top (penalty if matching).
    - Top and bottom being identical colour may indicate a dress (flag for review).

    Parameters
    ----------
    regions:
        Current classified regions.
    image_bgr:
        Source image for colour extraction. If None, returns zero adjustments.

    Returns
    -------
    adjustments:
        Per-category confidence adjustment values (-0.2 to +0.1).
    """
    adjustments: Dict[GarmentCategory, float] = {cat: 0.0 for cat in regions}

    if image_bgr is None:
        return adjustments

    colours: Dict[GarmentCategory, Optional[Tuple[float, float, float]]] = {}
    for cat, region in regions.items():
        colours[cat] = _extract_dominant_color(image_bgr, region.mask)

    # Shoes-top colour check.
    if "shoes" in colours and "top" in colours:
        shoes_c = colours["shoes"]
        top_c = colours["top"]
        if shoes_c is not None and top_c is not None:
            hue_diff = abs(shoes_c[0] - top_c[0])
            hue_diff = min(hue_diff, 180 - hue_diff)  # Wrap around hue wheel
            sat_diff = abs(shoes_c[1] - top_c[1])
            if hue_diff < 15 and sat_diff < 30:
                # Very similar colours — unusual, penalise shoes confidence.
                adjustments["shoes"] = -0.15
                logger.debug("Shoes colour matches top — reducing shoes confidence")

    return adjustments


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
    pose: Literal["standing", "sitting", "unknown"] = "standing",
) -> Tuple[int, int]:
    """Determine the row boundaries between top/bottom and bottom/shoes.

    We look for natural "waist" and "ankle" regions by finding local minima in
    the vertical density profile.  If no clear minimum is found we fall back to
    fixed proportional splits.

    Pose-aware thresholds:
    - Standing: waist at 35-60%, ankle at 82-95%.
    - Sitting: waist at 40-65%, ankle at 75-90% (body is compressed vertically).

    Parameters
    ----------
    top_row:
        First row of the body.
    bottom_row:
        Last row of the body.
    profile:
        Vertical density profile.
    pose:
        Detected pose to adjust thresholds.

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

    # Pose-dependent search regions.
    if pose == "sitting":
        waist_range = (0.40, 0.65)
        ankle_range = (0.75, 0.90)
        waist_default = 0.50
        ankle_default = 0.82
    else:
        waist_range = (0.35, 0.60)
        ankle_range = (0.82, 0.95)
        waist_default = 0.45
        ankle_default = 0.88

    # Smooth the profile to suppress noise.
    kernel_size = max(3, body_height // 20) | 1  # ensure odd
    smoothed = cv2.GaussianBlur(
        profile[top_row : bottom_row + 1].reshape(-1, 1),
        (1, kernel_size),
        0,
    ).flatten()

    # --- Waist detection -------------------------------------------------------
    waist_search_start = int(body_height * waist_range[0])
    waist_search_end = int(body_height * waist_range[1])
    waist_region = smoothed[waist_search_start:waist_search_end]

    if len(waist_region) > 0 and waist_region.max() > 0:
        waist_local = int(np.argmin(waist_region))
        waist_row = top_row + waist_search_start + waist_local
    else:
        waist_row = top_row + int(body_height * waist_default)

    # --- Ankle detection -------------------------------------------------------
    ankle_search_start = int(body_height * ankle_range[0])
    ankle_search_end = int(body_height * ankle_range[1])
    ankle_region = smoothed[ankle_search_start:ankle_search_end]

    if len(ankle_region) > 0 and ankle_region.max() > 0:
        ankle_local = int(np.argmin(ankle_region))
        ankle_row = top_row + ankle_search_start + ankle_local
    else:
        ankle_row = top_row + int(body_height * ankle_default)

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


def _multi_heuristic_confidence(
    pixel_count: int,
    total_fg: int,
    category: GarmentCategory,
    bbox: Tuple[int, int, int, int],
    mask_height: int,
    pose: Literal["standing", "sitting", "unknown"] = "standing",
    is_dress: bool = False,
    sleeve_type: Literal["long", "short", "none"] = "none",
    color_adjustment: float = 0.0,
) -> float:
    """Compute a multi-heuristic confidence score combining several signals.

    Heuristics considered:
    1. Pixel ratio (base confidence from _region_confidence).
    2. Spatial plausibility: is the region where we expect it?
    3. Size consistency: is the region proportionally reasonable?
    4. Sleeve bonus: long sleeves boost top confidence.
    5. Dress handling: boost top/bottom if dress detected.
    6. Color adjustment from cross-category validation.

    Parameters
    ----------
    pixel_count:
        Foreground pixels in this region.
    total_fg:
        Total foreground pixels across all regions.
    category:
        The garment category.
    bbox:
        Bounding box (x, y, w, h) of the region.
    mask_height:
        Total height of the mask image.
    pose:
        Detected pose.
    is_dress:
        Whether a dress was detected.
    sleeve_type:
        Detected sleeve type.
    color_adjustment:
        Confidence adjustment from colour validation.

    Returns
    -------
    confidence:
        Final confidence score in [0.0, 1.0].
    """
    base = _region_confidence(pixel_count, total_fg)

    # Spatial plausibility bonus.
    _, by, _, bh = bbox
    center_y = by + bh / 2.0
    relative_y = center_y / max(mask_height, 1)

    spatial_bonus = 0.0
    if category == "top" and relative_y < 0.50:
        spatial_bonus = 0.05
    elif category == "bottom" and 0.35 < relative_y < 0.85:
        spatial_bonus = 0.05
    elif category == "shoes" and relative_y > 0.75:
        spatial_bonus = 0.05

    # Sleeve bonus for top.
    sleeve_bonus = 0.0
    if category == "top" and sleeve_type == "long":
        sleeve_bonus = 0.05

    # Dress bonus.
    dress_bonus = 0.0
    if is_dress and category in ("top", "bottom"):
        dress_bonus = 0.03

    # Sitting adjustment.
    pose_adjustment = 0.0
    if pose == "sitting" and category == "shoes":
        # Shoes are harder to detect when sitting.
        pose_adjustment = -0.05

    final = base + spatial_bonus + sleeve_bonus + dress_bonus + pose_adjustment + color_adjustment
    return max(0.0, min(1.0, final))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_frame(
    mask: NDArray[np.uint8],
    image_bgr: Optional[NDArray[np.uint8]] = None,
) -> Dict[GarmentCategory, ClassifiedRegion]:
    """Classify a single segmentation mask into garment regions.

    Parameters
    ----------
    mask:
        Binary segmentation mask (H x W), values 0 or 255.
    image_bgr:
        Optional source image for colour-based validation. If provided,
        enables cross-category colour consistency checks.

    Returns
    -------
    regions:
        Mapping from garment category to ``ClassifiedRegion``.  Categories with
        zero foreground pixels are omitted.
    """
    profile = _compute_vertical_profile(mask)
    top_row, bottom_row = _find_body_bounds(profile)

    # Detect pose for threshold adjustment.
    pose = _detect_pose(mask, profile)
    if pose != "standing":
        logger.debug("Detected pose: %s — adjusting classification thresholds", pose)

    # Detect dress (single long garment).
    is_dress = _detect_dress(mask, profile, top_row, bottom_row)
    if is_dress:
        logger.debug("Dress/full-body garment detected — treating as combined top+bottom")

    # Detect sleeves.
    sleeve_type = _detect_sleeves(mask, top_row, bottom_row)

    waist_row, ankle_row = _adaptive_splits(top_row, bottom_row, profile, pose=pose)

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

        # Use multi-heuristic confidence (with placeholder for color).
        confidence = _multi_heuristic_confidence(
            pixel_count=px_count,
            total_fg=total_fg,
            category=category,
            bbox=bbox,
            mask_height=mask.shape[0],
            pose=pose,
            is_dress=is_dress,
            sleeve_type=sleeve_type,
            color_adjustment=0.0,
        )

        regions[category] = ClassifiedRegion(
            category=category,
            mask=region_mask,
            confidence=confidence,
            bbox=bbox,
            pixel_count=px_count,
        )

    # Apply colour-based validation if image is provided.
    if image_bgr is not None and regions:
        color_adjustments = _validate_color_consistency(regions, image_bgr)
        for cat, adj in color_adjustments.items():
            if cat in regions and adj != 0.0:
                old_conf = regions[cat].confidence
                new_conf = max(0.0, min(1.0, old_conf + adj))
                regions[cat] = ClassifiedRegion(
                    category=regions[cat].category,
                    mask=regions[cat].mask,
                    confidence=new_conf,
                    bbox=regions[cat].bbox,
                    pixel_count=regions[cat].pixel_count,
                )
                logger.debug(
                    "Colour validation adjusted %s confidence: %.2f -> %.2f",
                    cat,
                    old_conf,
                    new_conf,
                )

    logger.debug(
        "Classified mask into %d regions: %s (pose=%s, dress=%s, sleeves=%s)",
        len(regions),
        {k: f"{v.confidence:.2f}" for k, v in regions.items()},
        pose,
        is_dress,
        sleeve_type,
    )
    return regions


def classify_all_frames(
    masks: List[NDArray[np.uint8]],
    images_bgr: Optional[List[NDArray[np.uint8]]] = None,
) -> List[Dict[GarmentCategory, ClassifiedRegion]]:
    """Classify garment regions for every frame mask.

    Parameters
    ----------
    masks:
        Per-frame binary segmentation masks.
    images_bgr:
        Optional per-frame source images for colour validation.

    Returns
    -------
    classifications:
        Per-frame classification dicts aligned with *masks*.
    """
    results = []
    for idx, m in enumerate(masks):
        img = images_bgr[idx] if images_bgr is not None and idx < len(images_bgr) else None
        results.append(classify_frame(m, image_bgr=img))

    logger.info("Classification complete for %d frames", len(results))
    return results
