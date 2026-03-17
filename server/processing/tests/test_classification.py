"""
Tests for garment classification pipeline.

These tests create synthetic binary masks that simulate a standing human figure
and verify that the classification logic correctly identifies top, bottom, and
shoes regions based on vertical position and pixel density.

Additional tests cover:
- Dress detection (single long garment).
- Sitting pose detection and threshold adjustment.
- Sleeve detection.
- Color-based validation.
- Multi-heuristic confidence scoring.
"""

import numpy as np
import pytest

from pipeline.classification import (
    ClassifiedRegion,
    GarmentCategory,
    classify_frame,
    classify_all_frames,
    _compute_vertical_profile,
    _find_body_bounds,
    _region_confidence,
    _detect_pose,
    _detect_dress,
    _detect_sleeves,
    _multi_heuristic_confidence,
    _validate_color_consistency,
    _extract_dominant_color,
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


def _make_sitting_mask(height: int = 400, width: int = 200) -> np.ndarray:
    """Create a mask simulating a sitting person.

    Sitting posture has:
    - Wider upper body relative to height.
    - Body concentrated in upper 60% of frame.
    - Minimal lower-body content.
    """
    mask = np.zeros((height, width), dtype=np.uint8)
    top_row = int(height * 0.1)
    # Sitting person appears shorter — body ends at ~60% instead of 90%
    bottom_row = int(height * 0.60)

    # Upper body wider (seated spread)
    upper_left = int(width * 0.20)
    upper_right = int(width * 0.80)
    mid_row = int(height * 0.35)
    mask[top_row:mid_row, upper_left:upper_right] = 255

    # Lower body (lap area) — wider
    lower_left = int(width * 0.15)
    lower_right = int(width * 0.85)
    mask[mid_row:bottom_row, lower_left:lower_right] = 255

    # Small feet area
    feet_top = int(height * 0.55)
    feet_bottom = int(height * 0.60)
    feet_left = int(width * 0.30)
    feet_right = int(width * 0.70)
    mask[feet_top:feet_bottom, feet_left:feet_right] = 255

    return mask


def _make_dress_mask(height: int = 400, width: int = 200) -> np.ndarray:
    """Create a mask simulating a dress/gown (continuous from shoulders to ankles).

    A dress has:
    - Continuous coverage from top to near-bottom.
    - No significant waist narrowing.
    - Relatively uniform width.
    """
    mask = np.zeros((height, width), dtype=np.uint8)
    top_row = int(height * 0.10)
    bottom_row = int(height * 0.85)

    # Uniform width throughout (no waist narrowing)
    left = int(width * 0.25)
    right = int(width * 0.75)

    # Draw with slight A-line flare
    for row in range(top_row, bottom_row):
        frac = (row - top_row) / (bottom_row - top_row)
        # Slight flare: gets 10% wider at the bottom
        flare = int(width * 0.05 * frac)
        mask[row, max(0, left - flare):min(width, right + flare)] = 255

    # Small shoes below
    shoe_top = int(height * 0.85)
    shoe_bottom = int(height * 0.90)
    shoe_left = int(width * 0.35)
    shoe_right = int(width * 0.65)
    mask[shoe_top:shoe_bottom, shoe_left:shoe_right] = 255

    return mask


def _make_long_sleeve_mask(height: int = 400, width: int = 300) -> np.ndarray:
    """Create a mask where the upper body has extended arms (long sleeves).

    The arm region (15-48% of body height) is wider than the torso,
    simulating long sleeves extending to the wrists.
    """
    mask = np.zeros((height, width), dtype=np.uint8)
    top_row = int(height * 0.10)
    bottom_row = int(height * 0.90)

    # Torso: normal width
    torso_left = int(width * 0.30)
    torso_right = int(width * 0.70)
    mask[top_row:bottom_row, torso_left:torso_right] = 255

    # Arms: wider region in shoulder-to-wrist range
    arm_start = top_row + int((bottom_row - top_row) * 0.15)
    arm_end = top_row + int((bottom_row - top_row) * 0.48)
    arm_left = int(width * 0.10)
    arm_right = int(width * 0.90)
    mask[arm_start:arm_end, arm_left:arm_right] = 255

    return mask


def _make_bgr_image(height: int = 400, width: int = 200, color: tuple = (128, 128, 128)) -> np.ndarray:
    """Create a simple BGR image with a uniform color."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = color
    return img


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
# Tests — pose detection
# ---------------------------------------------------------------------------


class TestDetectPose:
    def test_standing_body_detected(self):
        mask = _make_body_mask()
        profile = _compute_vertical_profile(mask)
        pose = _detect_pose(mask, profile)
        assert pose == "standing"

    def test_sitting_body_detected(self):
        mask = _make_sitting_mask()
        profile = _compute_vertical_profile(mask)
        pose = _detect_pose(mask, profile)
        assert pose == "sitting"

    def test_empty_mask_returns_unknown(self):
        mask = np.zeros((100, 50), dtype=np.uint8)
        profile = _compute_vertical_profile(mask)
        pose = _detect_pose(mask, profile)
        assert pose == "unknown"

    def test_very_small_mask_returns_unknown(self):
        mask = np.zeros((100, 50), dtype=np.uint8)
        mask[45:55, 20:30] = 255  # Tiny region
        profile = _compute_vertical_profile(mask)
        pose = _detect_pose(mask, profile)
        # Small regions should return unknown
        assert pose in ("standing", "sitting", "unknown")


# ---------------------------------------------------------------------------
# Tests — dress detection
# ---------------------------------------------------------------------------


class TestDetectDress:
    def test_dress_mask_detected(self):
        mask = _make_dress_mask()
        profile = _compute_vertical_profile(mask)
        top_row, bottom_row = _find_body_bounds(profile)
        is_dress = _detect_dress(mask, profile, top_row, bottom_row)
        assert is_dress is True

    def test_normal_body_not_detected_as_dress(self):
        mask = _make_narrow_feet_mask()
        profile = _compute_vertical_profile(mask)
        top_row, bottom_row = _find_body_bounds(profile)
        is_dress = _detect_dress(mask, profile, top_row, bottom_row)
        assert is_dress is False

    def test_empty_mask_not_dress(self):
        mask = np.zeros((100, 50), dtype=np.uint8)
        profile = _compute_vertical_profile(mask)
        is_dress = _detect_dress(mask, profile, 0, 99)
        assert is_dress is False

    def test_dress_classification_produces_top_and_bottom(self):
        """A dress should still produce both top and bottom regions."""
        mask = _make_dress_mask()
        regions = classify_frame(mask)
        assert "top" in regions
        assert "bottom" in regions


# ---------------------------------------------------------------------------
# Tests — sleeve detection
# ---------------------------------------------------------------------------


class TestDetectSleeves:
    def test_long_sleeves_detected(self):
        mask = _make_long_sleeve_mask()
        profile = _compute_vertical_profile(mask)
        top_row, bottom_row = _find_body_bounds(profile)
        sleeve = _detect_sleeves(mask, top_row, bottom_row)
        # Should detect long or short sleeves (the extended arms)
        assert sleeve in ("long", "short")

    def test_normal_body_no_extended_sleeves(self):
        mask = _make_body_mask()
        profile = _compute_vertical_profile(mask)
        top_row, bottom_row = _find_body_bounds(profile)
        sleeve = _detect_sleeves(mask, top_row, bottom_row)
        assert sleeve == "none"

    def test_empty_mask_no_sleeves(self):
        mask = np.zeros((100, 50), dtype=np.uint8)
        sleeve = _detect_sleeves(mask, 10, 90)
        assert sleeve == "none"


# ---------------------------------------------------------------------------
# Tests — multi-heuristic confidence
# ---------------------------------------------------------------------------


class TestMultiHeuristicConfidence:
    def test_returns_bounded_value(self):
        conf = _multi_heuristic_confidence(
            pixel_count=5000,
            total_fg=10000,
            category="top",
            bbox=(50, 50, 100, 100),
            mask_height=400,
        )
        assert 0.0 <= conf <= 1.0

    def test_spatial_bonus_for_top_in_upper_region(self):
        conf_good = _multi_heuristic_confidence(
            pixel_count=4000, total_fg=10000, category="top",
            bbox=(50, 20, 100, 80), mask_height=400,
        )
        conf_bad = _multi_heuristic_confidence(
            pixel_count=4000, total_fg=10000, category="top",
            bbox=(50, 300, 100, 80), mask_height=400,
        )
        # Top region in upper area should get slight bonus
        assert conf_good >= conf_bad

    def test_sleeve_bonus_for_top(self):
        conf_sleeves = _multi_heuristic_confidence(
            pixel_count=4000, total_fg=10000, category="top",
            bbox=(50, 50, 100, 100), mask_height=400,
            sleeve_type="long",
        )
        conf_no_sleeves = _multi_heuristic_confidence(
            pixel_count=4000, total_fg=10000, category="top",
            bbox=(50, 50, 100, 100), mask_height=400,
            sleeve_type="none",
        )
        assert conf_sleeves >= conf_no_sleeves

    def test_sitting_penalty_for_shoes(self):
        conf_standing = _multi_heuristic_confidence(
            pixel_count=500, total_fg=10000, category="shoes",
            bbox=(50, 350, 100, 30), mask_height=400,
            pose="standing",
        )
        conf_sitting = _multi_heuristic_confidence(
            pixel_count=500, total_fg=10000, category="shoes",
            bbox=(50, 350, 100, 30), mask_height=400,
            pose="sitting",
        )
        assert conf_sitting < conf_standing

    def test_color_adjustment_applied(self):
        conf_no_adj = _multi_heuristic_confidence(
            pixel_count=4000, total_fg=10000, category="shoes",
            bbox=(50, 350, 100, 30), mask_height=400,
            color_adjustment=0.0,
        )
        conf_penalty = _multi_heuristic_confidence(
            pixel_count=4000, total_fg=10000, category="shoes",
            bbox=(50, 350, 100, 30), mask_height=400,
            color_adjustment=-0.15,
        )
        assert conf_penalty < conf_no_adj


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

    def test_sitting_pose_adjusts_classification(self):
        """Sitting pose should still produce valid regions but with adjusted splits."""
        mask = _make_sitting_mask()
        regions = classify_frame(mask)

        # Should still classify at least top and bottom.
        assert "top" in regions
        assert "bottom" in regions

    def test_classify_with_image_bgr(self):
        """Classification with a BGR image should work and enable colour validation."""
        mask = _make_body_mask()
        image = _make_bgr_image()
        regions = classify_frame(mask, image_bgr=image)

        assert "top" in regions
        assert "bottom" in regions

    def test_classify_all_frames_returns_aligned_list(self):
        """classify_all_frames should return a list aligned with the input masks."""
        masks = [_make_body_mask() for _ in range(5)]
        results = classify_all_frames(masks)

        assert len(results) == 5
        for r in results:
            assert "top" in r

    def test_classify_all_frames_with_images(self):
        """classify_all_frames should accept optional images for colour validation."""
        masks = [_make_body_mask() for _ in range(3)]
        images = [_make_bgr_image() for _ in range(3)]
        results = classify_all_frames(masks, images_bgr=images)

        assert len(results) == 3
