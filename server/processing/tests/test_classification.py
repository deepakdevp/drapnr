"""
Tests for garment classification pipeline.

These tests create synthetic binary masks that simulate a standing human figure
and verify that the classification logic correctly identifies top, bottom, and
shoes regions based on vertical position and pixel density.
"""

import numpy as np
import pytest

from pipeline.classification import (
    ClassifiedRegion,
    GarmentCategory,
    classify_frame,
    _compute_vertical_profile,
    _find_body_bounds,
    _region_confidence,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_body_mask(
    height: int = 400,
    width: int = 200,
    top_frac: float = 0.1,
    bottom_frac: float = 0.9,
    body_width_frac: float = 0.4,
) -> np.ndarray:
    """Create a synthetic binary mask simulating a standing person.

    The body occupies rows from `top_frac * height` to `bottom_frac * height`,
    centred horizontally with width `body_width_frac * width`.
    """
    mask = np.zeros((height, width), dtype=np.uint8)
    top_row = int(height * top_frac)
    bottom_row = int(height * bottom_frac)
    left = int(width * (0.5 - body_width_frac / 2))
    right = int(width * (0.5 + body_width_frac / 2))
    mask[top_row:bottom_row, left:right] = 255
    return mask


def _make_narrow_feet_mask(height: int = 400, width: int = 200) -> np.ndarray:
    """Body mask where the feet region is narrower (simulating shoes)."""
    mask = _make_body_mask(height, width)
    # Make the bottom 12% narrower to simulate shoes being smaller
    ankle_row = int(height * 0.78)
    bottom_row = int(height * 0.9)
    # Clear existing shoe area
    mask[ankle_row:bottom_row, :] = 0
    # Re-draw narrower
    narrow_left = int(width * 0.35)
    narrow_right = int(width * 0.65)
    mask[ankle_row:bottom_row, narrow_left:narrow_right] = 255
    return mask


# ---------------------------------------------------------------------------
# Tests — vertical profile
# ---------------------------------------------------------------------------


class TestComputeVerticalProfile:
    def test_returns_correct_shape(self):
        mask = _make_body_mask()
        profile = _compute_vertical_profile(mask)
        assert profile.shape == (400,)

    def test_empty_mask_returns_all_zeros(self):
        mask = np.zeros((100, 50), dtype=np.uint8)
        profile = _compute_vertical_profile(mask)
        assert np.allclose(profile, 0.0)

    def test_full_row_returns_one(self):
        mask = np.full((10, 20), 255, dtype=np.uint8)
        profile = _compute_vertical_profile(mask)
        assert np.allclose(profile, 1.0)

    def test_body_rows_have_positive_values(self):
        mask = _make_body_mask(height=200, top_frac=0.2, bottom_frac=0.8)
        profile = _compute_vertical_profile(mask)
        # Rows in body region should be > 0
        assert profile[50] > 0  # well within body
        # Rows outside body should be 0
        assert profile[0] == 0.0
        assert profile[199] == 0.0


# ---------------------------------------------------------------------------
# Tests — body bounds
# ---------------------------------------------------------------------------


class TestFindBodyBounds:
    def test_detects_top_and_bottom_rows(self):
        mask = _make_body_mask(height=200, top_frac=0.2, bottom_frac=0.8)
        profile = _compute_vertical_profile(mask)
        top, bottom = _find_body_bounds(profile)

        assert top == pytest.approx(40, abs=2)
        assert bottom == pytest.approx(159, abs=2)

    def test_empty_mask_returns_full_range(self):
        profile = np.zeros(100, dtype=np.float64)
        top, bottom = _find_body_bounds(profile)
        assert top == 0
        assert bottom == 99


# ---------------------------------------------------------------------------
# Tests — region confidence
# ---------------------------------------------------------------------------


class TestRegionConfidence:
    def test_zero_total_returns_zero(self):
        assert _region_confidence(0, 0) == 0.0

    def test_small_region_gets_low_confidence(self):
        # 1% of total — below the 3% threshold
        conf = _region_confidence(100, 10000)
        assert conf < 0.5

    def test_large_region_gets_high_confidence(self):
        # 40% of total
        conf = _region_confidence(4000, 10000)
        assert conf >= 0.5

    def test_confidence_bounded_to_one(self):
        conf = _region_confidence(10000, 10000)
        assert conf <= 1.0


# ---------------------------------------------------------------------------
# Tests — classify_frame (integration)
# ---------------------------------------------------------------------------


class TestClassifyFrame:
    def test_classifies_body_into_three_categories(self):
        mask = _make_body_mask()
        regions = classify_frame(mask)

        assert "top" in regions
        assert "bottom" in regions
        assert "shoes" in regions

    def test_vertical_position_top_is_above_bottom(self):
        mask = _make_body_mask()
        regions = classify_frame(mask)

        top_bbox = regions["top"].bbox  # (x, y, w, h)
        bottom_bbox = regions["bottom"].bbox

        top_center_y = top_bbox[1] + top_bbox[3] / 2
        bottom_center_y = bottom_bbox[1] + bottom_bbox[3] / 2

        assert top_center_y < bottom_center_y

    def test_vertical_position_bottom_is_above_shoes(self):
        mask = _make_body_mask()
        regions = classify_frame(mask)

        bottom_bbox = regions["bottom"].bbox
        shoes_bbox = regions["shoes"].bbox

        bottom_center_y = bottom_bbox[1] + bottom_bbox[3] / 2
        shoes_center_y = shoes_bbox[1] + shoes_bbox[3] / 2

        assert bottom_center_y < shoes_center_y

    def test_all_regions_have_positive_pixel_count(self):
        mask = _make_body_mask()
        regions = classify_frame(mask)

        for category, region in regions.items():
            assert region.pixel_count > 0, f"{category} has zero pixels"

    def test_confidence_scores_are_in_valid_range(self):
        mask = _make_body_mask()
        regions = classify_frame(mask)

        for category, region in regions.items():
            assert 0.0 <= region.confidence <= 1.0, (
                f"{category} confidence {region.confidence} out of range"
            )

    def test_top_region_is_largest(self):
        """In a uniform-width body mask, the top region (head to waist) typically
        has the most pixels because it spans roughly 35-45% of body height."""
        mask = _make_body_mask()
        regions = classify_frame(mask)

        assert regions["top"].pixel_count >= regions["shoes"].pixel_count

    def test_empty_mask_returns_no_regions(self):
        mask = np.zeros((400, 200), dtype=np.uint8)
        regions = classify_frame(mask)
        assert len(regions) == 0

    def test_narrow_feet_still_classified(self):
        """Even when the shoes region is narrower, it should still be detected."""
        mask = _make_narrow_feet_mask()
        regions = classify_frame(mask)
        assert "shoes" in regions
        assert regions["shoes"].pixel_count > 0

    def test_region_masks_match_original_dimensions(self):
        mask = _make_body_mask(height=300, width=150)
        regions = classify_frame(mask)

        for region in regions.values():
            assert region.mask.shape == (300, 150)
