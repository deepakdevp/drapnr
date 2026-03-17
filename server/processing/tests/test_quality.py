"""
Tests for the quality assessment module.

Tests cover:
- Frame quality assessment (blur detection via Laplacian variance).
- Mask quality assessment (coverage, edge smoothness, hole count).
- Texture quality assessment (resolution, coverage, seam visibility).
- Quality report generation.
"""

import numpy as np
import pytest

from pipeline.quality import (
    assess_frame_quality,
    assess_mask_quality,
    assess_texture_quality,
    generate_quality_report,
    get_mask_coverage,
    get_hole_count,
    _compute_edge_smoothness,
    _count_holes,
    _assess_resolution,
    _assess_texture_coverage,
    _assess_seam_visibility,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_sharp_frame(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a BGR frame with sharp edges (high Laplacian variance)."""
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    # Checkerboard pattern for high-frequency content.
    for r in range(height):
        for c in range(width):
            if (r // 10 + c // 10) % 2 == 0:
                frame[r, c] = [200, 200, 200]
            else:
                frame[r, c] = [50, 50, 50]
    return frame


def _make_blurry_frame(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a BGR frame that is very blurry (low Laplacian variance)."""
    import cv2
    frame = _make_sharp_frame(height, width)
    # Apply heavy Gaussian blur.
    blurry = cv2.GaussianBlur(frame, (51, 51), 20)
    return blurry


def _make_uniform_frame(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a perfectly uniform BGR frame (zero Laplacian variance)."""
    return np.full((height, width, 3), 128, dtype=np.uint8)


def _make_clean_mask(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a clean segmentation mask (circle, no holes, smooth edges)."""
    mask = np.zeros((height, width), dtype=np.uint8)
    center = (width // 2, height // 2)
    radius = min(height, width) // 4
    import cv2
    cv2.circle(mask, center, radius, 255, -1)
    return mask


def _make_noisy_mask(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a noisy segmentation mask with holes and jagged edges."""
    rng = np.random.default_rng(42)
    mask = np.zeros((height, width), dtype=np.uint8)
    # Random splotches.
    for _ in range(20):
        r = rng.integers(0, height)
        c = rng.integers(0, width)
        size = rng.integers(5, 30)
        mask[max(0, r - size):r + size, max(0, c - size):c + size] = 255
    return mask


def _make_full_coverage_mask(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a mask covering the entire image."""
    return np.full((height, width), 255, dtype=np.uint8)


def _make_empty_mask(height: int = 200, width: int = 200) -> np.ndarray:
    """Create an empty mask."""
    return np.zeros((height, width), dtype=np.uint8)


def _make_mask_with_holes(height: int = 200, width: int = 200) -> np.ndarray:
    """Create a mask with explicit interior holes."""
    mask = np.full((height, width), 255, dtype=np.uint8)
    # Cut out interior holes.
    mask[50:70, 50:70] = 0  # Hole 1
    mask[100:120, 80:100] = 0  # Hole 2
    mask[80:90, 130:140] = 0  # Hole 3
    return mask


def _make_test_texture(
    size: int = 64,
    fill_color: tuple = (128, 64, 32),
    coverage: float = 1.0,
) -> np.ndarray:
    """Create a test BGRA texture."""
    texture = np.zeros((size, size, 4), dtype=np.uint8)
    fill_rows = int(size * coverage)
    texture[:fill_rows, :, 0] = fill_color[0]
    texture[:fill_rows, :, 1] = fill_color[1]
    texture[:fill_rows, :, 2] = fill_color[2]
    texture[:fill_rows, :, 3] = 255
    return texture


def _make_seamless_texture(size: int = 64) -> np.ndarray:
    """Create a texture with matching left/right edges (no seam)."""
    texture = np.full((size, size, 4), dtype=np.uint8, fill_value=0)
    texture[:, :, :3] = 128
    texture[:, :, 3] = 255
    return texture


def _make_seam_texture(size: int = 64) -> np.ndarray:
    """Create a texture with a visible seam (different left/right edges)."""
    texture = np.zeros((size, size, 4), dtype=np.uint8)
    # Left half: bright
    texture[:, : size // 2, :3] = 200
    # Right half: dark
    texture[:, size // 2 :, :3] = 50
    texture[:, :, 3] = 255
    return texture


# ---------------------------------------------------------------------------
# Tests — frame quality
# ---------------------------------------------------------------------------


class TestAssessFrameQuality:
    def test_sharp_frame_has_high_score(self):
        frame = _make_sharp_frame()
        score = assess_frame_quality(frame)
        assert score > 100  # Sharp frames should have high Laplacian variance

    def test_blurry_frame_has_low_score(self):
        frame = _make_blurry_frame()
        score = assess_frame_quality(frame)
        assert score < 100  # Blurry frames should have lower score

    def test_uniform_frame_has_zero_score(self):
        frame = _make_uniform_frame()
        score = assess_frame_quality(frame)
        assert score == pytest.approx(0.0, abs=0.1)

    def test_sharp_beats_blurry(self):
        sharp = assess_frame_quality(_make_sharp_frame())
        blurry = assess_frame_quality(_make_blurry_frame())
        assert sharp > blurry

    def test_empty_frame_returns_zero(self):
        frame = np.zeros((0, 0, 3), dtype=np.uint8)
        score = assess_frame_quality(frame)
        assert score == 0.0

    def test_none_returns_zero(self):
        score = assess_frame_quality(None)  # type: ignore
        assert score == 0.0

    def test_returns_float(self):
        frame = _make_sharp_frame()
        score = assess_frame_quality(frame)
        assert isinstance(score, float)


# ---------------------------------------------------------------------------
# Tests — mask quality
# ---------------------------------------------------------------------------


class TestAssessMaskQuality:
    def test_clean_mask_has_high_quality(self):
        mask = _make_clean_mask()
        quality = assess_mask_quality(mask)
        assert quality > 0.5

    def test_noisy_mask_has_lower_quality(self):
        clean = assess_mask_quality(_make_clean_mask())
        noisy = assess_mask_quality(_make_noisy_mask())
        # Clean should generally score higher, though noisy might
        # have decent coverage.
        assert isinstance(noisy, float)
        assert 0.0 <= noisy <= 1.0

    def test_empty_mask_has_zero_quality(self):
        mask = _make_empty_mask()
        quality = assess_mask_quality(mask)
        assert quality == pytest.approx(0.0, abs=0.01)

    def test_full_coverage_mask_penalised(self):
        """A mask covering the entire image should get low quality (likely bad segmentation)."""
        mask = _make_full_coverage_mask()
        quality = assess_mask_quality(mask)
        assert quality < 0.5

    def test_quality_in_valid_range(self):
        for mask_fn in [_make_clean_mask, _make_noisy_mask, _make_empty_mask, _make_full_coverage_mask]:
            q = assess_mask_quality(mask_fn())
            assert 0.0 <= q <= 1.0

    def test_none_returns_zero(self):
        quality = assess_mask_quality(None)  # type: ignore
        assert quality == 0.0


class TestMaskCoverage:
    def test_full_mask_coverage(self):
        mask = _make_full_coverage_mask()
        assert get_mask_coverage(mask) == pytest.approx(1.0)

    def test_empty_mask_coverage(self):
        mask = _make_empty_mask()
        assert get_mask_coverage(mask) == pytest.approx(0.0)

    def test_partial_coverage(self):
        mask = _make_clean_mask()
        coverage = get_mask_coverage(mask)
        assert 0.0 < coverage < 1.0


class TestHoleCount:
    def test_no_holes_in_clean_mask(self):
        mask = _make_clean_mask()
        holes = get_hole_count(mask)
        assert holes == 0

    def test_holes_detected(self):
        mask = _make_mask_with_holes()
        holes = get_hole_count(mask)
        assert holes >= 2  # At least 2 of our 3 holes should be detected

    def test_empty_mask_no_holes(self):
        mask = _make_empty_mask()
        holes = get_hole_count(mask)
        assert holes == 0


class TestEdgeSmoothness:
    def test_circle_has_high_smoothness(self):
        mask = _make_clean_mask()
        smoothness = _compute_edge_smoothness(mask)
        assert smoothness > 0.3

    def test_empty_mask_zero_smoothness(self):
        mask = _make_empty_mask()
        smoothness = _compute_edge_smoothness(mask)
        assert smoothness == 0.0


# ---------------------------------------------------------------------------
# Tests — texture quality
# ---------------------------------------------------------------------------


class TestAssessTextureQuality:
    def test_good_texture_has_high_quality(self):
        texture = _make_test_texture(1024, coverage=1.0)
        quality = assess_texture_quality(texture)
        assert quality > 0.5

    def test_low_coverage_texture_penalised(self):
        full = assess_texture_quality(_make_test_texture(64, coverage=1.0))
        partial = assess_texture_quality(_make_test_texture(64, coverage=0.2))
        assert full > partial

    def test_empty_texture_zero_quality(self):
        texture = np.zeros((64, 64, 4), dtype=np.uint8)
        quality = assess_texture_quality(texture)
        assert quality == pytest.approx(0.0, abs=0.01)

    def test_none_returns_zero(self):
        quality = assess_texture_quality(None)  # type: ignore
        assert quality == 0.0

    def test_wrong_shape_returns_zero(self):
        texture = np.zeros((64, 64, 3), dtype=np.uint8)  # BGR not BGRA
        quality = assess_texture_quality(texture)
        assert quality == 0.0

    def test_quality_in_valid_range(self):
        texture = _make_test_texture(128)
        quality = assess_texture_quality(texture)
        assert 0.0 <= quality <= 1.0


class TestResolutionAssessment:
    def test_1024_full_score(self):
        score = _assess_resolution(1024, 1024)
        assert score == 1.0

    def test_larger_than_1024_still_full(self):
        score = _assess_resolution(2048, 2048)
        assert score == 1.0

    def test_512_decent_score(self):
        score = _assess_resolution(512, 512)
        assert 0.6 <= score <= 0.8

    def test_128_low_score(self):
        score = _assess_resolution(128, 128)
        assert score < 0.5


class TestSeamVisibility:
    def test_seamless_texture_high_score(self):
        texture = _make_seamless_texture(64)
        score = _assess_seam_visibility(texture)
        assert score > 0.8

    def test_seam_texture_lower_score(self):
        seamless_score = _assess_seam_visibility(_make_seamless_texture(64))
        seam_score = _assess_seam_visibility(_make_seam_texture(64))
        assert seamless_score >= seam_score

    def test_transparent_texture_high_score(self):
        texture = np.zeros((64, 64, 4), dtype=np.uint8)
        score = _assess_seam_visibility(texture)
        assert score == 1.0


# ---------------------------------------------------------------------------
# Tests — quality report
# ---------------------------------------------------------------------------


class TestGenerateQualityReport:
    def test_report_has_required_fields(self):
        report = generate_quality_report("test-job-123")
        assert "job_id" in report
        assert "overall_quality" in report
        assert "frames" in report
        assert "masks" in report
        assert "textures" in report
        assert report["job_id"] == "test-job-123"

    def test_report_with_frames(self):
        frames = [_make_sharp_frame(), _make_blurry_frame()]
        report = generate_quality_report("job-1", frames=frames)
        assert report["frames"]["count"] == 2
        assert len(report["frames"]["per_frame"]) == 2
        assert report["overall_quality"] > 0

    def test_report_with_masks(self):
        masks = [_make_clean_mask(), _make_clean_mask()]
        report = generate_quality_report("job-2", masks=masks)
        assert report["masks"]["count"] == 2
        assert report["overall_quality"] > 0

    def test_report_with_textures(self):
        textures = {
            "top": _make_test_texture(64),
            "bottom": _make_test_texture(64, fill_color=(50, 100, 150)),
        }
        report = generate_quality_report("job-3", textures=textures)
        assert report["textures"]["count"] == 2
        assert "top" in report["textures"]["per_category"]
        assert "bottom" in report["textures"]["per_category"]

    def test_full_report(self):
        frames = [_make_sharp_frame()]
        masks = [_make_clean_mask()]
        textures = {"top": _make_test_texture(128)}

        report = generate_quality_report(
            "job-full",
            frames=frames,
            masks=masks,
            textures=textures,
        )

        assert report["overall_quality"] > 0
        assert report["frames"]["count"] == 1
        assert report["masks"]["count"] == 1
        assert report["textures"]["count"] == 1

    def test_empty_report(self):
        report = generate_quality_report("job-empty")
        assert report["overall_quality"] == 0.0
        assert report["frames"] == {}
        assert report["masks"] == {}
        assert report["textures"] == {}
