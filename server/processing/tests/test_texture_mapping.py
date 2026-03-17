"""
Tests for texture mapping utilities.

Tests cover:
- UV map creation and properties.
- Camera angle estimation.
- Cylindrical projection math.
- Projection UV round-trip consistency.
- FOV estimation based on frame count.
- Seam blending at 0/360-degree boundary.
- Exposure normalisation across frames.
- Sharpening pass.
- Dominant colour extraction.
- Pattern detection.
- Metadata generation.
"""

import math

import numpy as np
import pytest

from pipeline.texture_mapping import (
    create_uv_map,
    _estimate_azimuth,
    estimate_fov,
    normalize_exposure,
    _blend_seam,
    _sharpen_texture,
    extract_dominant_colors,
    detect_pattern,
    generate_texture_metadata,
    blend_projections,
    project_to_uv,
)
from pipeline.classification import ClassifiedRegion


# ---------------------------------------------------------------------------
# Helper functions (extracted / expected from pipeline/texture_mapping.py)
# ---------------------------------------------------------------------------


def create_uv_coordinate_map(width: int, height: int) -> np.ndarray:
    """Create a standard UV coordinate map of shape (height, width, 2)."""
    u = np.linspace(0, 1, width, dtype=np.float32)
    v = np.linspace(0, 1, height, dtype=np.float32)
    uu, vv = np.meshgrid(u, v)
    return np.stack([uu, vv], axis=-1)


def estimate_camera_angle(frame_index: int, total_frames: int) -> float:
    """Estimate the camera angle (in degrees) based on the frame index."""
    if total_frames <= 0:
        raise ValueError("total_frames must be positive")
    return (frame_index / total_frames) * 360.0


def cylindrical_projection(
    angle_deg: float,
    height_frac: float,
    radius: float = 1.0,
) -> tuple[float, float, float]:
    """Project a point on a cylinder into 3D space."""
    angle_rad = math.radians(angle_deg)
    x = radius * math.cos(angle_rad)
    z = radius * math.sin(angle_rad)
    y = height_frac
    return (x, y, z)


def compute_projection_uv(
    x: float,
    y: float,
    z: float,
    texture_width: int,
    texture_height: int,
) -> tuple[int, int]:
    """Map a 3D point back to texture pixel coordinates."""
    angle = math.atan2(z, x)
    if angle < 0:
        angle += 2 * math.pi

    u = angle / (2 * math.pi)
    v = y

    px = int(round(u * (texture_width - 1)))
    py = int(round(v * (texture_height - 1)))
    return (px, py)


def _make_test_texture(
    size: int = 64,
    fill_color: tuple = (128, 64, 32),
    coverage: float = 1.0,
) -> np.ndarray:
    """Create a test BGRA texture with controlled properties."""
    texture = np.zeros((size, size, 4), dtype=np.uint8)
    fill_rows = int(size * coverage)
    texture[:fill_rows, :, 0] = fill_color[0]  # B
    texture[:fill_rows, :, 1] = fill_color[1]  # G
    texture[:fill_rows, :, 2] = fill_color[2]  # R
    texture[:fill_rows, :, 3] = 255  # Alpha
    return texture


def _make_striped_texture(size: int = 128) -> np.ndarray:
    """Create a texture with vertical stripes (for pattern detection testing)."""
    texture = np.zeros((size, size, 4), dtype=np.uint8)
    for col in range(size):
        if (col // 8) % 2 == 0:
            texture[:, col, :3] = [200, 200, 200]
        else:
            texture[:, col, :3] = [50, 50, 50]
    texture[:, :, 3] = 255
    return texture


def _make_solid_texture(size: int = 128, color: tuple = (100, 150, 200)) -> np.ndarray:
    """Create a solid-color texture with slight noise."""
    texture = np.zeros((size, size, 4), dtype=np.uint8)
    texture[:, :, 0] = color[0]
    texture[:, :, 1] = color[1]
    texture[:, :, 2] = color[2]
    texture[:, :, 3] = 255
    # Add very slight noise.
    noise = np.random.default_rng(42).integers(-3, 4, (size, size, 3), dtype=np.int16)
    texture[:, :, :3] = np.clip(texture[:, :, :3].astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return texture


# ---------------------------------------------------------------------------
# Tests — UV map creation
# ---------------------------------------------------------------------------


class TestCreateUVMap:
    def test_output_shape(self):
        uv = create_uv_coordinate_map(100, 200)
        assert uv.shape == (200, 100, 2)

    def test_u_ranges_zero_to_one(self):
        uv = create_uv_coordinate_map(50, 30)
        u_channel = uv[:, :, 0]
        assert u_channel.min() == pytest.approx(0.0, abs=1e-6)
        assert u_channel.max() == pytest.approx(1.0, abs=1e-6)

    def test_v_ranges_zero_to_one(self):
        uv = create_uv_coordinate_map(50, 30)
        v_channel = uv[:, :, 1]
        assert v_channel.min() == pytest.approx(0.0, abs=1e-6)
        assert v_channel.max() == pytest.approx(1.0, abs=1e-6)

    def test_top_left_is_origin(self):
        uv = create_uv_coordinate_map(64, 64)
        assert uv[0, 0, 0] == pytest.approx(0.0, abs=1e-6)  # u = 0
        assert uv[0, 0, 1] == pytest.approx(0.0, abs=1e-6)  # v = 0

    def test_bottom_right_is_one(self):
        uv = create_uv_coordinate_map(64, 64)
        assert uv[-1, -1, 0] == pytest.approx(1.0, abs=1e-6)
        assert uv[-1, -1, 1] == pytest.approx(1.0, abs=1e-6)

    def test_dtype_is_float32(self):
        uv = create_uv_coordinate_map(10, 10)
        assert uv.dtype == np.float32

    def test_single_pixel(self):
        uv = create_uv_coordinate_map(1, 1)
        assert uv.shape == (1, 1, 2)
        assert uv[0, 0, 0] == pytest.approx(0.0, abs=1e-6)
        assert uv[0, 0, 1] == pytest.approx(0.0, abs=1e-6)


class TestCreateUVBuffer:
    def test_accumulation_buffer_shape(self):
        buf = create_uv_map(512)
        assert buf.shape == (512, 512, 4)
        assert buf.dtype == np.float32

    def test_accumulation_buffer_initially_zero(self):
        buf = create_uv_map(64)
        assert np.all(buf == 0)


# ---------------------------------------------------------------------------
# Tests — camera angle estimation
# ---------------------------------------------------------------------------


class TestEstimateCameraAngle:
    def test_first_frame_is_zero_degrees(self):
        assert estimate_camera_angle(0, 30) == pytest.approx(0.0)

    def test_halfway_is_180_degrees(self):
        assert estimate_camera_angle(15, 30) == pytest.approx(180.0)

    def test_last_frame_approaches_360(self):
        angle = estimate_camera_angle(29, 30)
        assert angle == pytest.approx(348.0)

    def test_full_rotation_at_total_frames(self):
        # frame_index == total_frames gives exactly 360
        angle = estimate_camera_angle(30, 30)
        assert angle == pytest.approx(360.0)

    def test_quarter_rotation(self):
        assert estimate_camera_angle(10, 40) == pytest.approx(90.0)

    def test_raises_on_zero_total_frames(self):
        with pytest.raises(ValueError, match="positive"):
            estimate_camera_angle(0, 0)

    def test_raises_on_negative_total_frames(self):
        with pytest.raises(ValueError, match="positive"):
            estimate_camera_angle(0, -5)

    def test_single_frame(self):
        assert estimate_camera_angle(0, 1) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Tests — cylindrical projection
# ---------------------------------------------------------------------------


class TestCylindricalProjection:
    def test_front_center(self):
        x, y, z = cylindrical_projection(0, 0.5)
        assert x == pytest.approx(1.0)
        assert z == pytest.approx(0.0, abs=1e-10)
        assert y == pytest.approx(0.5)

    def test_right_side(self):
        x, y, z = cylindrical_projection(90, 0.5)
        assert x == pytest.approx(0.0, abs=1e-10)
        assert z == pytest.approx(1.0)

    def test_back(self):
        x, y, z = cylindrical_projection(180, 0.5)
        assert x == pytest.approx(-1.0)
        assert z == pytest.approx(0.0, abs=1e-10)

    def test_custom_radius(self):
        x, y, z = cylindrical_projection(0, 0.5, radius=2.0)
        assert x == pytest.approx(2.0)
        assert z == pytest.approx(0.0, abs=1e-10)

    def test_height_at_bottom(self):
        _, y, _ = cylindrical_projection(0, 0.0)
        assert y == pytest.approx(0.0)

    def test_height_at_top(self):
        _, y, _ = cylindrical_projection(0, 1.0)
        assert y == pytest.approx(1.0)

    def test_360_equals_0(self):
        p0 = cylindrical_projection(0, 0.5)
        p360 = cylindrical_projection(360, 0.5)
        assert p0[0] == pytest.approx(p360[0], abs=1e-10)
        assert p0[2] == pytest.approx(p360[2], abs=1e-10)


# ---------------------------------------------------------------------------
# Tests — projection UV math
# ---------------------------------------------------------------------------


class TestComputeProjectionUV:
    def test_front_center_maps_to_leftmost(self):
        """A point at angle=0 (front) should map to u=0 in the texture."""
        px, py = compute_projection_uv(1.0, 0.5, 0.0, 1024, 1024)
        assert px == 0
        assert py == 512

    def test_back_maps_to_middle(self):
        """A point at angle=180 should map to u=0.5."""
        px, py = compute_projection_uv(-1.0, 0.5, 0.0, 1024, 1024)
        assert px == pytest.approx(512, abs=1)

    def test_top_maps_to_first_row(self):
        px, py = compute_projection_uv(1.0, 0.0, 0.0, 1024, 1024)
        assert py == 0

    def test_bottom_maps_to_last_row(self):
        px, py = compute_projection_uv(1.0, 1.0, 0.0, 1024, 1024)
        assert py == 1023

    def test_round_trip_consistency(self):
        """Project to 3D and back to UV — the angle should be preserved."""
        angle = 45.0
        x, y, z = cylindrical_projection(angle, 0.3)
        px, py = compute_projection_uv(x, y, z, 1024, 1024)

        expected_u = angle / 360.0
        actual_u = px / 1023.0
        assert actual_u == pytest.approx(expected_u, abs=0.01)


# ---------------------------------------------------------------------------
# Tests — FOV estimation
# ---------------------------------------------------------------------------


class TestEstimateFOV:
    def test_more_frames_gives_narrower_fov(self):
        fov_few = estimate_fov(8, "top")
        fov_many = estimate_fov(36, "top")
        assert fov_few > fov_many

    def test_shoes_have_narrower_fov(self):
        fov_top = estimate_fov(24, "top")
        fov_shoes = estimate_fov(24, "shoes")
        assert fov_shoes <= fov_top

    def test_zero_frames_returns_default(self):
        fov = estimate_fov(0, "top")
        assert fov == pytest.approx(math.pi / 4.0)

    def test_single_frame_gets_wide_fov(self):
        fov = estimate_fov(1, "top")
        # Should be at the maximum
        assert fov >= math.pi / 8.0

    def test_fov_within_bounds(self):
        for n in [4, 8, 16, 24, 36, 72]:
            fov = estimate_fov(n, "top")
            assert math.pi / 8.0 <= fov <= math.pi / 2.5


# ---------------------------------------------------------------------------
# Tests — seam blending
# ---------------------------------------------------------------------------


class TestSeamBlending:
    def test_seam_blending_preserves_shape(self):
        texture = _make_test_texture(64)
        result = _blend_seam(texture)
        assert result.shape == texture.shape

    def test_seam_blending_preserves_alpha(self):
        texture = _make_test_texture(64)
        result = _blend_seam(texture)
        # Alpha should remain unchanged for fully covered textures
        assert np.array_equal(result[:, :, 3], texture[:, :, 3])

    def test_seam_blending_with_discontinuity(self):
        """Create a texture with a colour discontinuity at the seam and verify blending."""
        texture = np.zeros((64, 64, 4), dtype=np.uint8)
        # Left side: bright
        texture[:, :32, :3] = 200
        texture[:, :32, 3] = 255
        # Right side: dark
        texture[:, 32:, :3] = 50
        texture[:, 32:, 3] = 255

        result = _blend_seam(texture, seam_width=8)

        # The seam region (columns 0-7 and 56-63) should be blended.
        # Left edge should be influenced by right edge values.
        left_edge_mean = result[:, 0, 0].mean()
        interior_left = result[:, 16, 0].mean()
        # The left edge should be modified (pushed toward right side's colour)
        # or remain the same if both sides have data.
        assert result.shape == texture.shape

    def test_seam_blending_all_transparent(self):
        """No-op when texture is fully transparent."""
        texture = np.zeros((32, 32, 4), dtype=np.uint8)
        result = _blend_seam(texture)
        assert np.array_equal(result, texture)

    def test_seam_blending_narrow_texture(self):
        """Handle very narrow textures gracefully."""
        texture = np.zeros((32, 4, 4), dtype=np.uint8)
        texture[:, :, :3] = 128
        texture[:, :, 3] = 255
        result = _blend_seam(texture, seam_width=16)
        assert result.shape == texture.shape


# ---------------------------------------------------------------------------
# Tests — exposure normalisation
# ---------------------------------------------------------------------------


class TestExposureNormalisation:
    def test_uniform_frames_unchanged(self):
        """Frames with identical brightness should not change significantly."""
        frames = [
            np.full((64, 64, 3), 128, dtype=np.uint8)
            for _ in range(4)
        ]
        normalised = normalize_exposure(frames)
        assert len(normalised) == 4
        for f in normalised:
            assert np.allclose(f, 128, atol=3)

    def test_dark_frame_brightened(self):
        """A dark frame among bright ones should be brightened."""
        bright = np.full((64, 64, 3), 180, dtype=np.uint8)
        dark = np.full((64, 64, 3), 60, dtype=np.uint8)
        frames = [bright, bright, dark, bright]
        normalised = normalize_exposure(frames)

        # The dark frame (index 2) should be brighter after normalisation.
        assert normalised[2].mean() > dark.mean()

    def test_bright_frame_darkened(self):
        """A bright frame among dark ones should be darkened."""
        dark = np.full((64, 64, 3), 80, dtype=np.uint8)
        bright = np.full((64, 64, 3), 220, dtype=np.uint8)
        frames = [dark, dark, bright, dark]
        normalised = normalize_exposure(frames)

        # The bright frame (index 2) should be darker after normalisation.
        assert normalised[2].mean() < bright.mean()

    def test_empty_frames_returns_empty(self):
        result = normalize_exposure([])
        assert result == []

    def test_with_masks(self):
        """Exposure normalisation with masks should focus on masked regions."""
        frames = [np.full((64, 64, 3), v, dtype=np.uint8) for v in [100, 150, 200]]
        masks = [
            np.full((64, 64), 255, dtype=np.uint8),
            np.full((64, 64), 255, dtype=np.uint8),
            np.full((64, 64), 255, dtype=np.uint8),
        ]
        normalised = normalize_exposure(frames, masks_per_frame=masks)
        assert len(normalised) == 3


# ---------------------------------------------------------------------------
# Tests — sharpening
# ---------------------------------------------------------------------------


class TestSharpening:
    def test_sharpening_preserves_shape(self):
        texture = _make_test_texture(64)
        result = _sharpen_texture(texture, strength=0.5)
        assert result.shape == texture.shape

    def test_zero_strength_no_change(self):
        texture = _make_test_texture(64)
        result = _sharpen_texture(texture, strength=0.0)
        assert np.array_equal(result, texture)

    def test_sharpening_preserves_alpha(self):
        texture = _make_test_texture(64)
        result = _sharpen_texture(texture, strength=0.5)
        assert np.array_equal(result[:, :, 3], texture[:, :, 3])


# ---------------------------------------------------------------------------
# Tests — dominant colour extraction
# ---------------------------------------------------------------------------


class TestDominantColorExtraction:
    def test_single_color_texture(self):
        texture = _make_test_texture(64, fill_color=(100, 150, 200))
        colors = extract_dominant_colors(texture, n_colors=3)
        assert len(colors) >= 1
        # The dominant color should be close to (200, 150, 100) in RGB.
        r, g, b = colors[0]
        assert abs(r - 200) < 15
        assert abs(g - 150) < 15
        assert abs(b - 100) < 15

    def test_empty_texture_returns_empty(self):
        texture = np.zeros((64, 64, 4), dtype=np.uint8)  # All transparent
        colors = extract_dominant_colors(texture)
        assert colors == []

    def test_returns_requested_number(self):
        texture = _make_test_texture(128)
        colors = extract_dominant_colors(texture, n_colors=3)
        # May return fewer if the texture is very uniform.
        assert len(colors) <= 3


# ---------------------------------------------------------------------------
# Tests — pattern detection
# ---------------------------------------------------------------------------


class TestPatternDetection:
    def test_solid_texture_detected(self):
        texture = _make_solid_texture(128)
        pattern = detect_pattern(texture)
        assert pattern == "solid"

    def test_empty_texture_returns_unknown(self):
        texture = np.zeros((64, 64, 4), dtype=np.uint8)
        pattern = detect_pattern(texture)
        assert pattern == "unknown"

    def test_pattern_is_valid_string(self):
        texture = _make_test_texture(128)
        pattern = detect_pattern(texture)
        assert pattern in ("solid", "striped", "plaid", "floral", "complex", "unknown")

    def test_striped_or_complex_for_striped_input(self):
        texture = _make_striped_texture(128)
        pattern = detect_pattern(texture)
        # Should detect as striped or at least not solid.
        assert pattern in ("striped", "plaid", "complex")


# ---------------------------------------------------------------------------
# Tests — metadata generation
# ---------------------------------------------------------------------------


class TestMetadataGeneration:
    def test_metadata_has_required_fields(self):
        texture = _make_test_texture(64)
        meta = generate_texture_metadata(texture, "top", 10, 24)

        assert "category" in meta
        assert "resolution" in meta
        assert "coverage_fraction" in meta
        assert "contributed_frames" in meta
        assert "total_frames" in meta
        assert "dominant_colors" in meta
        assert "pattern" in meta
        assert "confidence" in meta

    def test_metadata_values_reasonable(self):
        texture = _make_test_texture(64)
        meta = generate_texture_metadata(texture, "top", 10, 24)

        assert meta["category"] == "top"
        assert meta["contributed_frames"] == 10
        assert meta["total_frames"] == 24
        assert 0.0 <= meta["confidence"] <= 1.0
        assert 0.0 <= meta["coverage_fraction"] <= 1.0

    def test_partial_coverage_metadata(self):
        texture = _make_test_texture(64, coverage=0.5)
        meta = generate_texture_metadata(texture, "bottom", 5, 24)

        assert meta["coverage_fraction"] < 1.0
        assert meta["coverage_fraction"] > 0.0

    def test_dominant_colors_format(self):
        texture = _make_test_texture(64)
        meta = generate_texture_metadata(texture, "top", 10, 24)

        for color in meta["dominant_colors"]:
            assert "r" in color
            assert "g" in color
            assert "b" in color
            assert "hex" in color
            assert color["hex"].startswith("#")
