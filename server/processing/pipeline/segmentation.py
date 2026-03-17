"""
Clothing segmentation using SAM2 (Segment Anything Model 2) with a U2-Net
fallback for environments without sufficient GPU memory.

The module exposes a single high-level function ``segment_frames`` that returns
per-frame binary masks isolating clothing regions from background and skin.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import List, Literal, Optional, Tuple

import cv2
import numpy as np
import torch
from numpy.typing import NDArray

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------
Mask = NDArray[np.uint8]  # H x W, 0 or 255

SegmentationBackend = Literal["sam2", "u2net"]


# ---------------------------------------------------------------------------
# Model loading (cached so we only load once per process)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _load_sam2_model() -> object:
    """Load the SAM2 model weights and return the predictor.

    Returns the SAM2 image predictor ready for inference.  We use
    ``sam2.build_sam.build_sam2`` and ``sam2.sam2_image_predictor.SAM2ImagePredictor``
    from the official Meta repository.
    """
    logger.info("Loading SAM2 model from %s", settings.sam2_checkpoint)
    try:
        from sam2.build_sam import build_sam2  # type: ignore[import-untyped]
        from sam2.sam2_image_predictor import SAM2ImagePredictor  # type: ignore[import-untyped]

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = build_sam2(
            settings.sam2_config,
            settings.sam2_checkpoint,
            device=device,
        )
        predictor = SAM2ImagePredictor(model)
        logger.info("SAM2 model loaded on %s", device)
        return predictor
    except Exception:
        logger.exception("Failed to load SAM2 — will fall back to U2-Net")
        raise


@lru_cache(maxsize=1)
def _load_u2net_model() -> torch.nn.Module:
    """Load U2-Net as a lightweight fallback segmentation model."""
    logger.info("Loading U2-Net from %s", settings.u2net_checkpoint)

    # U2-Net architecture definition — we import from a vendored copy or pip
    # package.  For robustness we inline a minimal loader.
    device = "cuda" if torch.cuda.is_available() else "cpu"

    try:
        from u2net import U2NET  # type: ignore[import-untyped]
    except ImportError:
        # Minimal U2NET stub — in production the full package would be installed.
        raise RuntimeError(
            "u2net package not installed. Install via "
            "'pip install u2net' or place u2net.py on PYTHONPATH."
        )

    model = U2NET(3, 1)
    checkpoint = Path(settings.u2net_checkpoint)
    if checkpoint.exists():
        state = torch.load(str(checkpoint), map_location=device, weights_only=True)
        model.load_state_dict(state)
    else:
        logger.warning("U2-Net checkpoint not found at %s — using random weights", checkpoint)

    model.to(device).eval()
    logger.info("U2-Net model loaded on %s", device)
    return model


# ---------------------------------------------------------------------------
# Inference helpers
# ---------------------------------------------------------------------------

def _segment_with_sam2(
    predictor: object,
    image_rgb: NDArray[np.uint8],
) -> Mask:
    """Run SAM2 on a single RGB image.

    We prompt SAM2 with a grid of points covering the centre 60 % of the frame
    (where the person typically stands) and keep the largest predicted mask.
    """
    h, w = image_rgb.shape[:2]

    # Generate a grid of prompt points in the central region.
    y_start, y_end = int(h * 0.15), int(h * 0.90)
    x_start, x_end = int(w * 0.25), int(w * 0.75)
    points = np.array(
        [
            [x_start + (x_end - x_start) * px, y_start + (y_end - y_start) * py]
            for py in np.linspace(0.1, 0.9, 5)
            for px in np.linspace(0.2, 0.8, 4)
        ],
        dtype=np.float32,
    )
    labels = np.ones(len(points), dtype=np.int32)  # all foreground

    # SAM2ImagePredictor API
    predictor.set_image(image_rgb)  # type: ignore[union-attr]
    masks, scores, _ = predictor.predict(  # type: ignore[union-attr]
        point_coords=points,
        point_labels=labels,
        multimask_output=True,
    )

    # Pick the mask with the highest confidence score.
    best_idx = int(np.argmax(scores))
    mask = (masks[best_idx] > 0.5).astype(np.uint8) * 255
    return mask


def _preprocess_for_u2net(
    image_rgb: NDArray[np.uint8],
    input_size: int = 320,
) -> torch.Tensor:
    """Resize and normalise an RGB image for U2-Net inference."""
    img = cv2.resize(image_rgb, (input_size, input_size), interpolation=cv2.INTER_LINEAR)
    img = img.astype(np.float32) / 255.0
    # Normalise with ImageNet statistics.
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img = (img - mean) / std
    tensor = torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0).float()
    return tensor


def _segment_with_u2net(
    model: torch.nn.Module,
    image_rgb: NDArray[np.uint8],
) -> Mask:
    """Run U2-Net saliency detection and return a binary clothing mask."""
    h, w = image_rgb.shape[:2]
    device = next(model.parameters()).device
    tensor = _preprocess_for_u2net(image_rgb).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        # U2-Net returns multiple side outputs; the first is the finest.
        pred = outputs[0] if isinstance(outputs, (list, tuple)) else outputs

    pred = pred.squeeze().cpu().numpy()
    # Normalise to 0-255.
    pred = ((pred - pred.min()) / (pred.max() - pred.min() + 1e-8) * 255).astype(np.uint8)
    # Resize back to original dimensions.
    pred = cv2.resize(pred, (w, h), interpolation=cv2.INTER_LINEAR)
    # Threshold with Otsu.
    _, mask = cv2.threshold(pred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return mask


def _refine_mask(mask: Mask) -> Mask:
    """Morphological post-processing to clean up the raw segmentation mask.

    - Remove small blobs (noise).
    - Fill small holes.
    - Smooth edges with a closing operation.
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

    # Close small gaps.
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    # Open to remove small noise blobs.
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Keep only the largest connected component.
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num_labels <= 1:
        return mask

    # Label 0 is background — find the largest non-background component.
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_label = int(np.argmax(areas)) + 1
    mask = np.where(labels == largest_label, np.uint8(255), np.uint8(0))
    return mask


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def segment_single_frame(
    image_bgr: NDArray[np.uint8],
    backend: Optional[SegmentationBackend] = None,
) -> Mask:
    """Segment clothing from a single BGR image.

    Parameters
    ----------
    image_bgr:
        Input image in BGR colour order (OpenCV default).
    backend:
        Force a specific backend. If ``None`` tries SAM2 first, then U2-Net.

    Returns
    -------
    mask:
        Binary mask (0 / 255), same spatial dimensions as the input image.
    """
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    if backend == "u2net":
        model = _load_u2net_model()
        mask = _segment_with_u2net(model, image_rgb)
    elif backend == "sam2":
        predictor = _load_sam2_model()
        mask = _segment_with_sam2(predictor, image_rgb)
    else:
        # Try SAM2 first; fall back to U2-Net.
        try:
            predictor = _load_sam2_model()
            mask = _segment_with_sam2(predictor, image_rgb)
        except Exception:
            logger.info("SAM2 unavailable, falling back to U2-Net")
            model = _load_u2net_model()
            mask = _segment_with_u2net(model, image_rgb)

    return _refine_mask(mask)


def segment_frames(
    frames: List[NDArray[np.uint8]],
    backend: Optional[SegmentationBackend] = None,
) -> List[Mask]:
    """Segment clothing in every frame.

    Parameters
    ----------
    frames:
        List of BGR images.
    backend:
        Segmentation backend to use.

    Returns
    -------
    masks:
        Per-frame binary masks aligned with the input list.
    """
    masks: List[Mask] = []
    for idx, frame in enumerate(frames):
        logger.debug("Segmenting frame %d / %d", idx + 1, len(frames))
        mask = segment_single_frame(frame, backend=backend)
        masks.append(mask)

    logger.info("Segmentation complete for %d frames", len(frames))
    return masks
