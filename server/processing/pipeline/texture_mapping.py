"""
Texture mapping — the core of Drapnr's virtual wardrobe pipeline.

Given classified garment masks from multiple camera angles (evenly spaced
across 360 degrees), this module:

1. Estimates the camera azimuth for each frame from its index.
2. Automatically estimates FOV based on frame count.
3. Normalises exposure across frames for consistent brightness.
4. Projects garment pixels onto a cylindrical UV map using perspective warping.
5. Blends overlapping projections from multiple frames with angle-based
   weighted averaging.
6. Applies seam blending at the 0/360-degree wrap-around boundary.
7. Applies a sharpening pass to counteract blend-induced blur.
8. Extracts dominant colours and detects patterns for garment metadata.
9. Outputs a 1024x1024 RGBA texture PNG per garment category with metadata.

The cylindrical UV parameterisation maps:
  - U (horizontal) = azimuth angle normalised to [0, 1]
  - V (vertical)   = normalised height within the garment bounding box
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from numpy.typing import NDArray

from config import settings
from pipeline.classification import ClassifiedRegion, GarmentCategory

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEX_SIZE: int = settings.texture_resolution  # default 1024
TWO_PI = 2.0 * math.pi


# ---------------------------------------------------------------------------
# UV map creation
# ---------------------------------------------------------------------------

def create_uv_map(
    resolution: int = TEX_SIZE,
) -> NDArray[np.float32]:
    """Create an empty UV accumulation buffer.

    Returns an array of shape ``(resolution, resolution, 4)`` where channels
    are (B, G, R, weight).  The weight channel is used during blending and
    later converted to an alpha channel.
    """
    return np.zeros((resolution, resolution, 4), dtype=np.float32)


# ---------------------------------------------------------------------------
# FOV estimation
# ---------------------------------------------------------------------------

def estimate_fov(
    total_frames: int,
    category: GarmentCategory = "top",
) -> float:
    """Estimate the half-FOV (radians) based on frame count.

    With fewer frames, each frame must cover a wider angular range to ensure
    full 360-degree coverage.  With many frames, a narrower FOV gives sharper
    results.

    Parameters
    ----------
    total_frames:
        Number of frames covering the full 360-degree rotation.
    category:
        Garment category (shoes use narrower FOV).

    Returns
    -------
    fov_half:
        Half of the horizontal field-of-view in radians.
    """
    # Base FOV: ensure adjacent frames overlap by ~50%.
    # Angular spacing between frames = 2*pi / total_frames
    # We want fov_half >= angular_spacing to ensure overlap.
    if total_frames <= 0:
        return math.pi / 4.0

    angular_spacing = TWO_PI / total_frames

    # FOV = 1.5x the angular spacing ensures ~50% overlap between adjacent frames.
    fov_half = angular_spacing * 0.75

    # Clamp to reasonable bounds.
    fov_half = max(math.pi / 8.0, min(math.pi / 2.5, fov_half))  # 22.5° to 72°

    # Shoes use a narrower effective FOV.
    if category == "shoes":
        fov_half = min(fov_half, math.pi / 6.0)

    logger.debug(
        "Estimated FOV: %.1f° half-angle for %d frames (category=%s)",
        math.degrees(fov_half),
        total_frames,
        category,
    )
    return fov_half


# ---------------------------------------------------------------------------
# Exposure normalisation
# ---------------------------------------------------------------------------

def normalize_exposure(
    frames: List[NDArray[np.uint8]],
    masks_per_frame: Optional[List[Optional[NDArray[np.uint8]]]] = None,
) -> List[NDArray[np.uint8]]:
    """Normalise brightness across frames for consistent texture blending.

    Computes the mean luminance of each frame (optionally within the masked
    region) and adjusts all frames to match the median luminance.

    Parameters
    ----------
    frames:
        List of BGR images.
    masks_per_frame:
        Optional per-frame masks. If provided, only pixels within the mask
        are considered for luminance computation.

    Returns
    -------
    normalised_frames:
        Brightness-adjusted copies of the input frames.
    """
    if len(frames) == 0:
        return frames

    # Compute per-frame mean luminance.
    luminances = []
    for idx, frame in enumerate(frames):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if masks_per_frame and idx < len(masks_per_frame) and masks_per_frame[idx] is not None:
            mask = masks_per_frame[idx]
            fg_pixels = gray[mask > 127]  # type: ignore[index]
            if len(fg_pixels) > 0:
                luminances.append(float(np.mean(fg_pixels)))
            else:
                luminances.append(float(np.mean(gray)))
        else:
            luminances.append(float(np.mean(gray)))

    target_lum = float(np.median(luminances))

    normalised = []
    for idx, frame in enumerate(frames):
        current_lum = luminances[idx]
        if current_lum > 0 and abs(current_lum - target_lum) > 2.0:
            ratio = target_lum / current_lum
            # Clamp ratio to avoid extreme adjustments.
            ratio = max(0.5, min(2.0, ratio))
            adjusted = np.clip(frame.astype(np.float32) * ratio, 0, 255).astype(np.uint8)
            normalised.append(adjusted)
        else:
            normalised.append(frame.copy())

    logger.debug(
        "Exposure normalised: target=%.1f, range=[%.1f, %.1f]",
        target_lum,
        min(luminances),
        max(luminances),
    )
    return normalised


# ---------------------------------------------------------------------------
# Projection helpers
# ---------------------------------------------------------------------------

def _estimate_azimuth(frame_index: int, total_frames: int) -> float:
    """Return the camera azimuth in radians for a given frame index.

    Frames are assumed evenly spaced across a full 360-degree rotation.
    Frame 0 corresponds to azimuth = 0 (front).
    """
    return (TWO_PI * frame_index) / total_frames


def _angular_weight(
    source_azimuth: float,
    target_u: float,
) -> float:
    """Compute a blending weight based on angular proximity.

    *source_azimuth* is the camera angle for the frame that produced the
    pixel.  *target_u* is the horizontal UV coordinate (0-1 maps to 0-2pi).
    Frames whose viewing angle is closest to the UV azimuth get the highest
    weight.

    We use a cosine-based weighting that falls off smoothly:
        w = max(0, cos(delta / 2))^2
    where delta is the angular difference.
    """
    target_azimuth = target_u * TWO_PI
    delta = abs(source_azimuth - target_azimuth)
    # Wrap to [-pi, pi].
    delta = min(delta, TWO_PI - delta)
    # Smooth falloff — only contribute within +-90 degrees of the view.
    cos_half = math.cos(delta / 2.0)
    return max(0.0, cos_half) ** 2


def _compute_garment_bbox(
    region: ClassifiedRegion,
) -> Tuple[int, int, int, int]:
    """Return the tight bounding box (x, y, w, h) of foreground pixels."""
    return region.bbox


def _cylindrical_project_row_col(
    row: int,
    col: int,
    bbox_x: int,
    bbox_y: int,
    bbox_w: int,
    bbox_h: int,
    azimuth: float,
    fov_half: float,
    tex_size: int,
) -> Optional[Tuple[int, int]]:
    """Map a single garment pixel (row, col) to UV texture coordinates.

    The horizontal mapping uses a cylindrical projection:
        u = (azimuth + offset_angle) / (2*pi)
    where offset_angle accounts for the pixel's horizontal position relative
    to the frame centre.

    The vertical mapping is a simple linear normalisation of the pixel's
    position within the garment bounding box.
    """
    # --- Vertical (v) -------------------------------------------------------
    v_norm = (row - bbox_y) / max(bbox_h, 1)
    v_px = int(np.clip(v_norm * tex_size, 0, tex_size - 1))

    # --- Horizontal (u) via cylindrical projection --------------------------
    # Pixel horizontal offset from bbox centre, normalised to [-1, 1].
    cx = bbox_x + bbox_w / 2.0
    h_offset = (col - cx) / max(bbox_w / 2.0, 1)
    # Map through the camera's half-FOV to get an angular offset.
    offset_angle = h_offset * fov_half
    u_angle = (azimuth + offset_angle) % TWO_PI
    u_norm = u_angle / TWO_PI
    u_px = int(np.clip(u_norm * tex_size, 0, tex_size - 1))

    return u_px, v_px


# ---------------------------------------------------------------------------
# Vectorised projection (fast path)
# ---------------------------------------------------------------------------

def project_to_uv(
    frame_bgr: NDArray[np.uint8],
    region: ClassifiedRegion,
    azimuth: float,
    uv_buffer: NDArray[np.float32],
    fov_half: float = math.pi / 4.0,
) -> NDArray[np.float32]:
    """Project garment pixels from a single frame onto the UV buffer.

    This is the vectorised (fast) implementation that avoids per-pixel Python
    loops.

    Parameters
    ----------
    frame_bgr:
        Source frame in BGR.
    region:
        Classified garment region with its mask and bounding box.
    azimuth:
        Camera azimuth in radians for this frame.
    uv_buffer:
        Accumulation buffer of shape (tex_size, tex_size, 4).
    fov_half:
        Half of the assumed horizontal field-of-view (radians).

    Returns
    -------
    uv_buffer:
        The same buffer, updated in-place and returned for convenience.
    """
    tex_size = uv_buffer.shape[0]
    mask = region.mask
    bx, by, bw, bh = region.bbox

    if bw == 0 or bh == 0:
        return uv_buffer

    # Get foreground pixel coordinates.
    fg_rows, fg_cols = np.where(mask > 127)
    if len(fg_rows) == 0:
        return uv_buffer

    # --- Vertical mapping (v) -----------------------------------------------
    v_norm = (fg_rows - by).astype(np.float64) / max(bh, 1)
    v_px = np.clip((v_norm * tex_size).astype(np.int32), 0, tex_size - 1)

    # --- Horizontal mapping (u) — cylindrical --------------------------------
    cx = bx + bw / 2.0
    h_offset = (fg_cols.astype(np.float64) - cx) / max(bw / 2.0, 1.0)
    offset_angle = h_offset * fov_half
    u_angle = np.mod(azimuth + offset_angle, TWO_PI)
    u_norm = u_angle / TWO_PI
    u_px = np.clip((u_norm * tex_size).astype(np.int32), 0, tex_size - 1)

    # --- Compute per-pixel blending weights ----------------------------------
    target_u_norm = u_px.astype(np.float64) / tex_size
    target_azimuth = target_u_norm * TWO_PI
    delta = np.abs(azimuth - target_azimuth)
    delta = np.minimum(delta, TWO_PI - delta)
    weights = np.maximum(0.0, np.cos(delta / 2.0)) ** 2

    # --- Accumulate into UV buffer -------------------------------------------
    pixels_bgr = frame_bgr[fg_rows, fg_cols].astype(np.float32)  # (N, 3)

    # Use np.add.at for safe unbuffered accumulation at duplicate indices.
    np.add.at(uv_buffer, (v_px, u_px, 0), pixels_bgr[:, 0] * weights)
    np.add.at(uv_buffer, (v_px, u_px, 1), pixels_bgr[:, 1] * weights)
    np.add.at(uv_buffer, (v_px, u_px, 2), pixels_bgr[:, 2] * weights)
    np.add.at(uv_buffer, (v_px, u_px, 3), weights)

    return uv_buffer


# ---------------------------------------------------------------------------
# Blending
# ---------------------------------------------------------------------------

def blend_projections(uv_buffer: NDArray[np.float32]) -> NDArray[np.uint8]:
    """Normalise the accumulation buffer into a final BGRA texture image.

    Pixels that received no contributions are left fully transparent.

    Returns
    -------
    texture:
        (tex_size, tex_size, 4) uint8 image in BGRA order.
    """
    tex_size = uv_buffer.shape[0]
    result = np.zeros((tex_size, tex_size, 4), dtype=np.uint8)

    weight = uv_buffer[:, :, 3]
    valid = weight > 0

    for c in range(3):
        channel = np.zeros((tex_size, tex_size), dtype=np.float32)
        np.divide(uv_buffer[:, :, c], weight, out=channel, where=valid)
        result[:, :, c] = np.clip(channel, 0, 255).astype(np.uint8)

    # Alpha: 255 where we have valid data, 0 elsewhere.
    result[:, :, 3] = np.where(valid, 255, 0).astype(np.uint8)

    return result


def _blend_seam(
    texture_bgra: NDArray[np.uint8],
    seam_width: int = 16,
) -> NDArray[np.uint8]:
    """Blend the wrap-around seam at the 0/360-degree boundary.

    The left edge (azimuth=0) and right edge (azimuth=360) of the cylindrical
    UV map represent the same physical location but may have colour
    discontinuities from different source frames. This function blends a
    narrow strip at the boundary for a seamless wrap.

    Parameters
    ----------
    texture_bgra:
        Input BGRA texture.
    seam_width:
        Width (in pixels) of the blending zone on each side of the seam.

    Returns
    -------
    blended:
        Texture with smoothed seam boundary.
    """
    result = texture_bgra.copy()
    tex_w = texture_bgra.shape[1]
    half = min(seam_width, tex_w // 4)

    if half < 2:
        return result

    # Left strip: columns [0, half)
    # Right strip: columns [tex_w - half, tex_w)
    left_strip = texture_bgra[:, :half, :].astype(np.float32)
    right_strip = texture_bgra[:, tex_w - half :, :].astype(np.float32)

    # Only blend where both sides have data (alpha > 0).
    left_alpha = left_strip[:, :, 3:4]
    right_alpha = right_strip[:, :, 3:4]
    both_valid = (left_alpha > 0) & (right_alpha > 0)

    if not np.any(both_valid):
        return result

    # Create linear blend weights.
    # At the seam centre (col 0), blend 50/50.
    # Moving away from seam, favour the native side.
    for i in range(half):
        # Weight for right side contribution decreases as we move right from col 0.
        w_right = 1.0 - (i / half)
        w_left = 1.0 - w_right

        # Blend left-side columns.
        mask = both_valid[:, i, 0]
        if np.any(mask):
            # The corresponding right column is (half - 1 - i) from the right edge.
            right_col = half - 1 - i
            result[mask, i, :3] = np.clip(
                left_strip[mask, i, :3] * (1.0 - w_right * 0.5)
                + right_strip[mask, right_col, :3] * (w_right * 0.5),
                0,
                255,
            ).astype(np.uint8)

        # Blend right-side columns.
        right_idx = tex_w - half + i
        mask_r = both_valid[:, i, 0]
        if np.any(mask_r):
            left_col = i
            result[mask_r, right_idx, :3] = np.clip(
                right_strip[mask_r, i, :3] * (1.0 - w_left * 0.5)
                + left_strip[mask_r, left_col, :3] * (w_left * 0.5),
                0,
                255,
            ).astype(np.uint8)

    return result


def _inpaint_gaps(texture_bgra: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Fill small gaps in the texture using OpenCV inpainting.

    Only operates on pixels where alpha == 0 and nearby pixels have data.
    This handles thin seams between projected regions.
    """
    alpha = texture_bgra[:, :, 3]
    bgr = texture_bgra[:, :, :3]

    # Inpaint mask: pixels with no data that are near pixels with data.
    gap_mask = (alpha == 0).astype(np.uint8)
    # Dilate the valid region to detect only *nearby* gaps.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    valid_dilated = cv2.dilate((alpha > 0).astype(np.uint8), kernel, iterations=2)
    inpaint_mask = gap_mask & valid_dilated

    if inpaint_mask.sum() == 0:
        return texture_bgra

    inpainted_bgr = cv2.inpaint(bgr, inpaint_mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)

    # Write inpainted pixels back.
    result = texture_bgra.copy()
    fill_locs = inpaint_mask > 0
    result[fill_locs, :3] = inpainted_bgr[fill_locs]
    result[fill_locs, 3] = 255

    return result


# ---------------------------------------------------------------------------
# Post-processing: sharpening
# ---------------------------------------------------------------------------

def _sharpen_texture(
    texture_bgra: NDArray[np.uint8],
    strength: float = 0.5,
) -> NDArray[np.uint8]:
    """Apply an unsharp mask to counteract blur from multi-frame blending.

    Only sharpens pixels with valid alpha. This restores detail that is lost
    during the weighted averaging of overlapping projections.

    Parameters
    ----------
    texture_bgra:
        Input BGRA texture.
    strength:
        Sharpening strength (0.0 = none, 1.0 = strong).

    Returns
    -------
    sharpened:
        Sharpened texture with same dimensions and format.
    """
    if strength <= 0:
        return texture_bgra

    result = texture_bgra.copy()
    bgr = result[:, :, :3]
    alpha = result[:, :, 3]

    # Gaussian blur for unsharp mask.
    blurred = cv2.GaussianBlur(bgr, (0, 0), sigmaX=2.0)

    # Unsharp mask: sharpened = original + strength * (original - blurred)
    sharpened = cv2.addWeighted(bgr, 1.0 + strength, blurred, -strength, 0)

    # Only apply where we have valid data.
    valid = alpha > 0
    for c in range(3):
        result[:, :, c] = np.where(valid, sharpened[:, :, c], bgr[:, :, c])

    return result


# ---------------------------------------------------------------------------
# Colour and pattern analysis
# ---------------------------------------------------------------------------

def extract_dominant_colors(
    texture_bgra: NDArray[np.uint8],
    n_colors: int = 5,
) -> List[Tuple[int, int, int]]:
    """Extract dominant colours from the texture using k-means clustering.

    Parameters
    ----------
    texture_bgra:
        BGRA texture image.
    n_colors:
        Number of dominant colours to extract.

    Returns
    -------
    colors:
        List of (R, G, B) tuples sorted by frequency (most common first).
    """
    alpha = texture_bgra[:, :, 3]
    bgr = texture_bgra[:, :, :3]

    # Only consider pixels with valid alpha.
    valid_pixels = bgr[alpha > 0].reshape(-1, 3).astype(np.float32)

    if len(valid_pixels) < n_colors:
        return []

    # Subsample for speed if too many pixels.
    if len(valid_pixels) > 50000:
        indices = np.random.default_rng(42).choice(
            len(valid_pixels), 50000, replace=False
        )
        valid_pixels = valid_pixels[indices]

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(
        valid_pixels, n_colors, None, criteria, 3, cv2.KMEANS_PP_CENTERS
    )

    # Sort by frequency.
    label_counts = np.bincount(labels.flatten(), minlength=n_colors)
    sorted_indices = np.argsort(-label_counts)

    colors = []
    for idx in sorted_indices:
        b, g, r = centers[idx].astype(int)
        colors.append((int(r), int(g), int(b)))

    return colors


def detect_pattern(
    texture_bgra: NDArray[np.uint8],
) -> str:
    """Detect the pattern type of a texture using FFT analysis.

    Analyses the frequency domain of the texture to classify patterns:
    - **solid**: Low frequency energy, uniform colour.
    - **striped**: Strong energy along one axis.
    - **plaid**: Strong energy along both axes.
    - **floral/complex**: Distributed high-frequency energy.

    Parameters
    ----------
    texture_bgra:
        BGRA texture image.

    Returns
    -------
    pattern:
        One of ``"solid"``, ``"striped"``, ``"plaid"``, ``"floral"``, ``"complex"``.
    """
    alpha = texture_bgra[:, :, 3]
    if (alpha > 0).sum() < 100:
        return "unknown"

    # Convert to grayscale.
    bgr = texture_bgra[:, :, :3]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # Mask out transparent regions.
    gray[alpha == 0] = 0

    # Compute 2D FFT.
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.log1p(np.abs(f_shift))

    h, w = magnitude.shape
    cy, cx = h // 2, w // 2

    # Exclude DC component (centre).
    magnitude[cy - 2 : cy + 3, cx - 2 : cx + 3] = 0

    total_energy = magnitude.sum()
    if total_energy < 1e-6:
        return "solid"

    # Analyse energy distribution along axes.
    # Horizontal axis (horizontal stripes show energy along vertical axis).
    vertical_strip = magnitude[:, cx - 3 : cx + 4].sum()
    horizontal_strip = magnitude[cy - 3 : cy + 4, :].sum()

    v_ratio = vertical_strip / total_energy
    h_ratio = horizontal_strip / total_energy

    # High-frequency energy (outer ring).
    radius_outer = min(h, w) // 4
    y_coords, x_coords = np.ogrid[:h, :w]
    distance = np.sqrt((y_coords - cy) ** 2 + (x_coords - cx) ** 2)
    high_freq_energy = magnitude[distance > radius_outer].sum()
    hf_ratio = high_freq_energy / total_energy

    # Low-frequency energy (inner ring, excluding DC).
    radius_inner = min(h, w) // 8
    low_freq_mask = (distance > 3) & (distance < radius_inner)
    low_freq_energy = magnitude[low_freq_mask].sum()
    lf_ratio = low_freq_energy / total_energy

    # Classification thresholds.
    if lf_ratio < 0.15 and hf_ratio < 0.3:
        return "solid"
    elif v_ratio > 0.25 and h_ratio > 0.25:
        return "plaid"
    elif v_ratio > 0.20 or h_ratio > 0.20:
        return "striped"
    elif hf_ratio > 0.5:
        return "floral"
    else:
        return "complex"


# ---------------------------------------------------------------------------
# Metadata generation
# ---------------------------------------------------------------------------

def generate_texture_metadata(
    texture_bgra: NDArray[np.uint8],
    category: GarmentCategory,
    contributed_frames: int,
    total_frames: int,
) -> Dict[str, Any]:
    """Generate metadata JSON for a texture.

    Parameters
    ----------
    texture_bgra:
        The final BGRA texture.
    category:
        Garment category.
    contributed_frames:
        Number of frames that contributed to this texture.
    total_frames:
        Total number of captured frames.

    Returns
    -------
    metadata:
        Dictionary with texture metadata including dominant colours, pattern,
        coverage, and confidence metrics.
    """
    alpha = texture_bgra[:, :, 3]
    total_pixels = alpha.shape[0] * alpha.shape[1]
    valid_pixels = int((alpha > 0).sum())
    coverage = valid_pixels / max(total_pixels, 1)

    dominant_colors = extract_dominant_colors(texture_bgra)
    pattern = detect_pattern(texture_bgra)

    # Confidence based on frame coverage and texture completeness.
    frame_confidence = min(1.0, contributed_frames / max(total_frames * 0.5, 1))
    texture_confidence = min(1.0, coverage / 0.7)  # 70% coverage = full confidence
    overall_confidence = (frame_confidence + texture_confidence) / 2.0

    metadata: Dict[str, Any] = {
        "category": category,
        "resolution": texture_bgra.shape[:2],
        "coverage_fraction": round(coverage, 4),
        "contributed_frames": contributed_frames,
        "total_frames": total_frames,
        "dominant_colors": [
            {"r": r, "g": g, "b": b, "hex": f"#{r:02x}{g:02x}{b:02x}"}
            for r, g, b in dominant_colors
        ],
        "pattern": pattern,
        "confidence": round(overall_confidence, 4),
        "frame_confidence": round(frame_confidence, 4),
        "texture_confidence": round(texture_confidence, 4),
    }

    return metadata


# ---------------------------------------------------------------------------
# High-level API
# ---------------------------------------------------------------------------

def generate_texture(
    frames: List[NDArray[np.uint8]],
    regions_per_frame: List[Dict[GarmentCategory, ClassifiedRegion]],
    category: GarmentCategory,
    resolution: int = TEX_SIZE,
) -> Optional[Tuple[NDArray[np.uint8], Dict[str, Any]]]:
    """Generate a single UV texture for the given garment category.

    Parameters
    ----------
    frames:
        All captured frames (BGR).
    regions_per_frame:
        Per-frame classification results from ``classification.classify_all_frames``.
    category:
        Which garment to render (``"top"``, ``"bottom"``, ``"shoes"``).
    resolution:
        Output texture size (square).

    Returns
    -------
    result:
        Tuple of (BGRA texture, metadata dict), or ``None`` if no frames
        contained the requested category.
    """
    total_frames = len(frames)
    if total_frames == 0:
        return None

    # Exposure normalisation: collect relevant masks for luminance calculation.
    category_masks: List[Optional[NDArray[np.uint8]]] = []
    for regions in regions_per_frame:
        if category in regions:
            category_masks.append(regions[category].mask)
        else:
            category_masks.append(None)

    normalised_frames = normalize_exposure(frames, masks_per_frame=category_masks)

    uv_buffer = create_uv_map(resolution)
    contributed = 0

    # Automatic FOV estimation.
    fov_half = estimate_fov(total_frames, category=category)

    for idx, (frame, regions) in enumerate(zip(normalised_frames, regions_per_frame)):
        if category not in regions:
            continue

        azimuth = _estimate_azimuth(idx, total_frames)
        region = regions[category]
        project_to_uv(frame, region, azimuth, uv_buffer, fov_half=fov_half)
        contributed += 1

    if contributed == 0:
        logger.warning("No frames contained category '%s'", category)
        return None

    logger.info(
        "Blending %d projections for '%s' texture (%dx%d)",
        contributed,
        category,
        resolution,
        resolution,
    )

    texture = blend_projections(uv_buffer)
    texture = _inpaint_gaps(texture)
    texture = _blend_seam(texture)
    texture = _sharpen_texture(texture, strength=0.4)

    # Generate metadata.
    metadata = generate_texture_metadata(
        texture, category, contributed, total_frames
    )

    logger.info(
        "Texture '%s': coverage=%.1f%%, pattern=%s, confidence=%.2f, colors=%d",
        category,
        metadata["coverage_fraction"] * 100,
        metadata["pattern"],
        metadata["confidence"],
        len(metadata["dominant_colors"]),
    )

    return texture, metadata


def generate_all_textures(
    frames: List[NDArray[np.uint8]],
    regions_per_frame: List[Dict[GarmentCategory, ClassifiedRegion]],
    resolution: int = TEX_SIZE,
) -> Dict[GarmentCategory, NDArray[np.uint8]]:
    """Generate UV textures for all detected garment categories.

    Returns
    -------
    textures:
        Mapping from category to BGRA texture.  Categories with insufficient
        data are omitted.

    Note
    ----
    This function maintains backward compatibility by returning only the
    texture arrays. Use ``generate_all_textures_with_metadata`` to also
    get metadata.
    """
    textures: Dict[GarmentCategory, NDArray[np.uint8]] = {}
    present: set[GarmentCategory] = set()
    for regions in regions_per_frame:
        present.update(regions.keys())

    for cat in present:
        result = generate_texture(frames, regions_per_frame, cat, resolution)
        if result is not None:
            tex, _meta = result
            textures[cat] = tex

    logger.info("Generated textures for categories: %s", list(textures.keys()))
    return textures


def generate_all_textures_with_metadata(
    frames: List[NDArray[np.uint8]],
    regions_per_frame: List[Dict[GarmentCategory, ClassifiedRegion]],
    resolution: int = TEX_SIZE,
) -> Tuple[Dict[GarmentCategory, NDArray[np.uint8]], Dict[GarmentCategory, Dict[str, Any]]]:
    """Generate UV textures and metadata for all detected garment categories.

    Returns
    -------
    textures:
        Mapping from category to BGRA texture.
    metadata:
        Mapping from category to metadata dict.
    """
    textures: Dict[GarmentCategory, NDArray[np.uint8]] = {}
    all_metadata: Dict[GarmentCategory, Dict[str, Any]] = {}

    present: set[GarmentCategory] = set()
    for regions in regions_per_frame:
        present.update(regions.keys())

    for cat in present:
        result = generate_texture(frames, regions_per_frame, cat, resolution)
        if result is not None:
            tex, meta = result
            textures[cat] = tex
            all_metadata[cat] = meta

    logger.info(
        "Generated textures with metadata for categories: %s",
        list(textures.keys()),
    )
    return textures, all_metadata
