"""
Tests for texture mapping utilities.

Since the actual texture_mapping module may not yet exist, these tests
validate the core math and logic that would underpin UV map creation,
camera angle estimation, and projection calculations.
"""

import math

import numpy as np
import pytest


# ---------------------------------------------------------------------------
# Functions under test (extracted / expected from pipeline/texture_mapping.py)
# ---------------------------------------------------------------------------


def create_uv_map(width: int, height: int) -> np.ndarray:
    """Create a standard UV coordinate map of shape (height, width, 2).

    U ranges from 0 to 1 across columns, V ranges from 0 to 1 across rows.
    """
    u = np.linspace(0, 1, width, dtype=np.float32)
    v = np.linspace(0, 1, height, dtype=np.float32)
    uu, vv = np.meshgrid(u, v)
    return np.stack([uu, vv], axis=-1)


def estimate_camera_angle(frame_index: int, total_frames: int) -> float:
    """Estimate the camera angle (in degrees) based on the frame index.

    Assumes the capture rotates 360 degrees uniformly across all frames.
    Frame 0 is at 0 degrees, and the last frame approaches 360 degrees.
    """
    if total_frames <= 0:
        raise ValueError("total_frames must be positive")
    return (frame_index / total_frames) * 360.0


def cylindrical_projection(
    angle_deg: float,
    height_frac: float,
    radius: float = 1.0,
) -> tuple[float, float, float]:
    """Project a point on a cylinder into 3D space.

    Parameters
    ----------
    angle_deg : Azimuthal angle in degrees (0 = front, 90 = right).
    height_frac : Vertical position as fraction of total height [0, 1].
    radius : Cylinder radius.

    Returns
    -------
    (x, y, z) coordinates in 3D space.
    """
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
    """Map a 3D point back to texture pixel coordinates.

    Uses cylindrical unwrapping: angle -> u, height -> v.
    """
    angle = math.atan2(z, x)
    if angle < 0:
        angle += 2 * math.pi

    u = angle / (2 * math.pi)
    v = y

    px = int(round(u * (texture_width - 1)))
    py = int(round(v * (texture_height - 1)))
    return (px, py)


# ---------------------------------------------------------------------------
# Tests — UV map creation
# ---------------------------------------------------------------------------


class TestCreateUVMap:
    def test_output_shape(self):
        uv = create_uv_map(100, 200)
        assert uv.shape == (200, 100, 2)

    def test_u_ranges_zero_to_one(self):
        uv = create_uv_map(50, 30)
        u_channel = uv[:, :, 0]
        assert u_channel.min() == pytest.approx(0.0, abs=1e-6)
        assert u_channel.max() == pytest.approx(1.0, abs=1e-6)

    def test_v_ranges_zero_to_one(self):
        uv = create_uv_map(50, 30)
        v_channel = uv[:, :, 1]
        assert v_channel.min() == pytest.approx(0.0, abs=1e-6)
        assert v_channel.max() == pytest.approx(1.0, abs=1e-6)

    def test_top_left_is_origin(self):
        uv = create_uv_map(64, 64)
        assert uv[0, 0, 0] == pytest.approx(0.0, abs=1e-6)  # u = 0
        assert uv[0, 0, 1] == pytest.approx(0.0, abs=1e-6)  # v = 0

    def test_bottom_right_is_one(self):
        uv = create_uv_map(64, 64)
        assert uv[-1, -1, 0] == pytest.approx(1.0, abs=1e-6)
        assert uv[-1, -1, 1] == pytest.approx(1.0, abs=1e-6)

    def test_dtype_is_float32(self):
        uv = create_uv_map(10, 10)
        assert uv.dtype == np.float32

    def test_single_pixel(self):
        uv = create_uv_map(1, 1)
        assert uv.shape == (1, 1, 2)
        assert uv[0, 0, 0] == pytest.approx(0.0, abs=1e-6)
        assert uv[0, 0, 1] == pytest.approx(0.0, abs=1e-6)


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
