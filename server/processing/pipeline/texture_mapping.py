"""
Texture mapping — the core of Drapnr's virtual wardrobe pipeline.

Given classified garment masks from multiple camera angles (evenly spaced
across 360 degrees), this module:

1. Estimates the camera azimuth for each frame from its index.
2. Projects garment pixels onto a cylindrical UV map using perspective warping.
3. Blends overlapping projections from multiple frames with angle-based
   weighted averaging.
4. Outputs a 1024x1024 RGBA texture PNG per garment category.

The cylindrical UV parameterisation maps:
  - U (horizontal) = azimuth angle normalised to [0, 1]
  - V (vertical)   = normalised height within the garment bounding box

This works well for torso garments (shirts, jackets, pants) where a cylinder
is a reasonable shape proxy.  For shoes a simpler frontal projection is used.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple

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
# High-level API
# ---------------------------------------------------------------------------

def generate_texture(
    frames: List[NDArray[np.uint8]],
    regions_per_frame: List[Dict[GarmentCategory, ClassifiedRegion]],
    category: GarmentCategory,
    resolution: int = TEX_SIZE,
) -> Optional[NDArray[np.uint8]]:
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
    texture:
        BGRA uint8 image of shape ``(resolution, resolution, 4)``, or ``None``
        if no frames contained the requested category.
    """
    total_frames = len(frames)
    if total_frames == 0:
        return None

    uv_buffer = create_uv_map(resolution)
    contributed = 0

    # Shoes use a narrower effective FOV since they occupy less horizontal
    # extent in the frame.
    fov_half = math.pi / 6.0 if category == "shoes" else math.pi / 4.0

    for idx, (frame, regions) in enumerate(zip(frames, regions_per_frame)):
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
    return texture


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
    """
    # Determine which categories appear in at least one frame.
    present: set[GarmentCategory] = set()
    for regions in regions_per_frame:
        present.update(regions.keys())

    textures: Dict[GarmentCategory, NDArray[np.uint8]] = {}
    for cat in present:
        tex = generate_texture(frames, regions_per_frame, cat, resolution)
        if tex is not None:
            textures[cat] = tex

    logger.info("Generated textures for categories: %s", list(textures.keys()))
    return textures
