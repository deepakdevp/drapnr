"""
Clothing segmentation using SAM2 (Segment Anything Model 2) with a U2-Net
fallback for environments without sufficient GPU memory.

The module exposes a single high-level function ``segment_frames`` that returns
per-frame binary masks isolating clothing regions from background and skin.

Robustness features:
- Graceful SAM2 model download from HuggingFace Hub if checkpoint is missing.
- Model warm-up on first call to avoid cold-start latency spikes.
- Automatic GPU/CPU device detection (CUDA -> MPS -> CPU).
- Image preprocessing: brightness/contrast normalisation before segmentation.
- Mask quality filtering: reject masks with <5% or >95% coverage.
- Multi-person handling: pick the largest mask when multiple people detected.
- Descriptive error messages for common failure modes.
"""

from __future__ import annotations

import logging
import os
import hashlib
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
# Device detection
# ---------------------------------------------------------------------------

_DEVICE: Optional[str] = None


def _detect_device() -> str:
    """Detect the best available compute device.

    Priority: CUDA > MPS (Apple Silicon) > CPU.
    The result is cached for the process lifetime.
    """
    global _DEVICE
    if _DEVICE is not None:
        return _DEVICE

    if torch.cuda.is_available():
        _DEVICE = "cuda"
        logger.info("Device detected: CUDA (%s)", torch.cuda.get_device_name(0))
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        _DEVICE = "mps"
        logger.info("Device detected: MPS (Apple Silicon)")
    else:
        _DEVICE = "cpu"
        logger.info("Device detected: CPU (no GPU acceleration available)")
    return _DEVICE


# ---------------------------------------------------------------------------
# Model download helpers
# ---------------------------------------------------------------------------

# HuggingFace Hub URLs for model checkpoints.
_SAM2_HF_REPO = "facebook/sam2-hiera-large"
_SAM2_HF_FILENAME = "sam2_hiera_large.pt"
_U2NET_HF_REPO = "skytnt/anime-seg"
_U2NET_HF_FILENAME = "u2net.pth"


def _download_from_huggingface(
    repo_id: str,
    filename: str,
    destination: Path,
    *,
    expected_sha256: Optional[str] = None,
) -> Path:
    """Download a model file from HuggingFace Hub if not already present.

    Parameters
    ----------
    repo_id:
        HuggingFace repository identifier (e.g. ``"facebook/sam2-hiera-large"``).
    filename:
        Name of the file within the repository.
    destination:
        Local path where the file should be saved.
    expected_sha256:
        Optional SHA-256 hex digest for integrity verification.

    Returns
    -------
    destination:
        Path to the downloaded (or already existing) file.

    Raises
    ------
    RuntimeError
        If the download fails or checksum verification fails.
    """
    if destination.exists():
        if expected_sha256:
            actual = _file_sha256(destination)
            if actual != expected_sha256:
                logger.warning(
                    "Checksum mismatch for %s (expected %s, got %s). Re-downloading.",
                    destination,
                    expected_sha256[:16],
                    actual[:16],
                )
                destination.unlink()
            else:
                logger.debug("Model file %s exists and checksum matches", destination)
                return destination
        else:
            logger.debug("Model file %s already exists (skipping download)", destination)
            return destination

    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        from huggingface_hub import hf_hub_download  # type: ignore[import-untyped]

        logger.info(
            "Downloading %s/%s -> %s (this may take several minutes)",
            repo_id,
            filename,
            destination,
        )
        downloaded_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=str(destination.parent),
            local_dir_use_symlinks=False,
        )
        # hf_hub_download may place the file in a sub-directory; move if needed.
        downloaded = Path(downloaded_path)
        if downloaded != destination:
            downloaded.rename(destination)

        if expected_sha256:
            actual = _file_sha256(destination)
            if actual != expected_sha256:
                raise RuntimeError(
                    f"Checksum verification failed for {destination}. "
                    f"Expected {expected_sha256[:16]}..., got {actual[:16]}..."
                )
        logger.info("Successfully downloaded model to %s", destination)
        return destination

    except ImportError:
        raise RuntimeError(
            "huggingface_hub package is required for automatic model download. "
            "Install it with: pip install huggingface_hub\n"
            "Alternatively, manually download the SAM2 checkpoint and place it at: "
            f"{destination}"
        )
    except Exception as exc:
        raise RuntimeError(
            f"Failed to download model from {repo_id}/{filename}: {exc}\n"
            f"You can manually download the checkpoint and place it at: {destination}"
        ) from exc


def _file_sha256(path: Path) -> str:
    """Compute SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

def _normalize_brightness_contrast(
    image_rgb: NDArray[np.uint8],
) -> NDArray[np.uint8]:
    """Normalise brightness and contrast using CLAHE on the luminance channel.

    This improves segmentation accuracy for under/over-exposed images by
    equalising the luminance histogram while preserving colour relationships.

    Parameters
    ----------
    image_rgb:
        Input image in RGB colour order.

    Returns
    -------
    normalised:
        Brightness/contrast-normalised RGB image.
    """
    lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    # CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_normalised = clahe.apply(l_channel)

    lab_normalised = cv2.merge([l_normalised, a_channel, b_channel])
    return cv2.cvtColor(lab_normalised, cv2.COLOR_LAB2RGB)


# ---------------------------------------------------------------------------
# Mask quality filtering
# ---------------------------------------------------------------------------

_MIN_COVERAGE_FRACTION = 0.05  # 5%
_MAX_COVERAGE_FRACTION = 0.95  # 95%


def _assess_mask_coverage(mask: Mask) -> float:
    """Return the fraction of the image covered by foreground pixels (0.0-1.0)."""
    total_pixels = mask.shape[0] * mask.shape[1]
    if total_pixels == 0:
        return 0.0
    fg_pixels = int((mask > 127).sum())
    return fg_pixels / total_pixels


def _is_mask_quality_acceptable(
    mask: Mask,
    min_coverage: float = _MIN_COVERAGE_FRACTION,
    max_coverage: float = _MAX_COVERAGE_FRACTION,
) -> bool:
    """Check whether a segmentation mask has acceptable quality.

    Masks with very low coverage (<5%) likely missed the subject.
    Masks with very high coverage (>95%) likely include the background.

    Parameters
    ----------
    mask:
        Binary mask (0/255).
    min_coverage:
        Minimum acceptable foreground fraction.
    max_coverage:
        Maximum acceptable foreground fraction.

    Returns
    -------
    acceptable:
        True if the mask passes quality checks.
    """
    coverage = _assess_mask_coverage(mask)
    if coverage < min_coverage:
        logger.warning(
            "Mask coverage %.1f%% is below minimum threshold %.1f%% "
            "(likely failed segmentation — subject may not be visible)",
            coverage * 100,
            min_coverage * 100,
        )
        return False
    if coverage > max_coverage:
        logger.warning(
            "Mask coverage %.1f%% exceeds maximum threshold %.1f%% "
            "(likely segmented background — subject may blend with background)",
            coverage * 100,
            max_coverage * 100,
        )
        return False
    return True


# ---------------------------------------------------------------------------
# Multi-person handling
# ---------------------------------------------------------------------------

def _select_largest_mask(masks: List[Mask]) -> Mask:
    """When multiple person masks are detected, select the one with the
    largest foreground area.

    This handles cases where bystanders or reflections appear in the frame.

    Parameters
    ----------
    masks:
        List of candidate binary masks.

    Returns
    -------
    best_mask:
        The mask with the most foreground pixels.
    """
    if len(masks) == 0:
        raise ValueError("No candidate masks provided for selection")
    if len(masks) == 1:
        return masks[0]

    areas = [(mask > 127).sum() for mask in masks]
    best_idx = int(np.argmax(areas))
    logger.info(
        "Multiple masks detected (%d candidates). Selected mask %d with %d pixels "
        "(areas: %s)",
        len(masks),
        best_idx,
        areas[best_idx],
        [int(a) for a in areas],
    )
    return masks[best_idx]


# ---------------------------------------------------------------------------
# Model loading (cached so we only load once per process)
# ---------------------------------------------------------------------------

_sam2_warmed_up = False
_u2net_warmed_up = False


@lru_cache(maxsize=1)
def _load_sam2_model() -> object:
    """Load the SAM2 model weights and return the predictor.

    If the checkpoint file is not found, attempts to download it from
    HuggingFace Hub. Performs a warm-up inference on first load.

    Returns the SAM2 image predictor ready for inference.

    Raises
    ------
    RuntimeError
        If the model cannot be loaded or downloaded. Error message includes
        actionable instructions for resolution.
    """
    checkpoint_path = Path(settings.sam2_checkpoint)

    # Attempt download if checkpoint is missing.
    if not checkpoint_path.exists():
        logger.info(
            "SAM2 checkpoint not found at %s — attempting download from HuggingFace",
            checkpoint_path,
        )
        try:
            _download_from_huggingface(
                repo_id=_SAM2_HF_REPO,
                filename=_SAM2_HF_FILENAME,
                destination=checkpoint_path,
            )
        except RuntimeError as exc:
            raise RuntimeError(
                f"SAM2 checkpoint not found at {checkpoint_path} and automatic "
                f"download failed: {exc}\n\n"
                "To fix this, either:\n"
                "  1. Install huggingface_hub: pip install huggingface_hub\n"
                "  2. Manually download the SAM2 checkpoint from "
                f"https://huggingface.co/{_SAM2_HF_REPO}\n"
                f"  3. Place the file at: {checkpoint_path}\n"
                "  4. Or set SAM2_CHECKPOINT env var to the correct path"
            ) from exc

    device = _detect_device()
    logger.info("Loading SAM2 model from %s onto %s", checkpoint_path, device)

    try:
        from sam2.build_sam import build_sam2  # type: ignore[import-untyped]
        from sam2.sam2_image_predictor import SAM2ImagePredictor  # type: ignore[import-untyped]

        model = build_sam2(
            settings.sam2_config,
            str(checkpoint_path),
            device=device,
        )
        predictor = SAM2ImagePredictor(model)
        logger.info("SAM2 model loaded successfully on %s", device)

        # Warm up the model with a dummy inference.
        _warm_up_sam2(predictor, device)

        return predictor

    except ImportError:
        raise RuntimeError(
            "SAM2 package not installed. Install via:\n"
            "  pip install segment-anything-2\n"
            "Or see: https://github.com/facebookresearch/segment-anything-2"
        )
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load SAM2 model from {checkpoint_path}: {exc}\n"
            "Common causes:\n"
            "  - Corrupted checkpoint file (try re-downloading)\n"
            "  - Incompatible SAM2 version (check package version)\n"
            f"  - Insufficient {'GPU' if device == 'cuda' else 'system'} memory"
        ) from exc


def _warm_up_sam2(predictor: object, device: str) -> None:
    """Run a dummy inference to warm up SAM2 (JIT compilation, memory allocation).

    This ensures the first real inference does not have unexpected latency.
    """
    global _sam2_warmed_up
    if _sam2_warmed_up:
        return

    logger.info("Warming up SAM2 model (first-call JIT compilation)...")
    try:
        dummy_image = np.zeros((64, 64, 3), dtype=np.uint8)
        dummy_points = np.array([[32.0, 32.0]], dtype=np.float32)
        dummy_labels = np.array([1], dtype=np.int32)

        predictor.set_image(dummy_image)  # type: ignore[union-attr]
        predictor.predict(  # type: ignore[union-attr]
            point_coords=dummy_points,
            point_labels=dummy_labels,
            multimask_output=False,
        )
        _sam2_warmed_up = True
        logger.info("SAM2 warm-up complete")
    except Exception:
        logger.warning("SAM2 warm-up failed (non-fatal, first real call may be slower)")


@lru_cache(maxsize=1)
def _load_u2net_model() -> torch.nn.Module:
    """Load U2-Net as a lightweight fallback segmentation model.

    If the checkpoint is missing, attempts to download from HuggingFace Hub.
    Performs a warm-up inference on first load.

    Raises
    ------
    RuntimeError
        If the model cannot be loaded. Error message includes resolution steps.
    """
    checkpoint_path = Path(settings.u2net_checkpoint)
    device = _detect_device()

    # Attempt download if checkpoint is missing.
    if not checkpoint_path.exists():
        logger.info(
            "U2-Net checkpoint not found at %s — attempting download from HuggingFace",
            checkpoint_path,
        )
        try:
            _download_from_huggingface(
                repo_id=_U2NET_HF_REPO,
                filename=_U2NET_HF_FILENAME,
                destination=checkpoint_path,
            )
        except RuntimeError:
            logger.warning(
                "U2-Net automatic download failed. Model will use random weights "
                "(results will be poor). Download manually from "
                "https://huggingface.co/%s and place at %s",
                _U2NET_HF_REPO,
                checkpoint_path,
            )

    try:
        from u2net import U2NET  # type: ignore[import-untyped]
    except ImportError:
        raise RuntimeError(
            "u2net package not installed. Install via:\n"
            "  pip install u2net\n"
            "Or place u2net.py on PYTHONPATH."
        )

    model = U2NET(3, 1)
    if checkpoint_path.exists():
        try:
            state = torch.load(str(checkpoint_path), map_location=device, weights_only=True)
            model.load_state_dict(state)
            logger.info("U2-Net checkpoint loaded from %s", checkpoint_path)
        except Exception as exc:
            logger.warning(
                "Failed to load U2-Net checkpoint from %s: %s. Using random weights.",
                checkpoint_path,
                exc,
            )
    else:
        logger.warning(
            "U2-Net checkpoint not found at %s — using random weights (poor results)",
            checkpoint_path,
        )

    model.to(device).eval()
    logger.info("U2-Net model loaded on %s", device)

    # Warm up.
    _warm_up_u2net(model, device)

    return model


def _warm_up_u2net(model: torch.nn.Module, device: str) -> None:
    """Run a dummy inference to warm up U2-Net."""
    global _u2net_warmed_up
    if _u2net_warmed_up:
        return

    logger.info("Warming up U2-Net model...")
    try:
        dummy = torch.zeros(1, 3, 320, 320, dtype=torch.float32, device=device)
        with torch.no_grad():
            model(dummy)
        _u2net_warmed_up = True
        logger.info("U2-Net warm-up complete")
    except Exception:
        logger.warning("U2-Net warm-up failed (non-fatal)")


# ---------------------------------------------------------------------------
# Inference helpers
# ---------------------------------------------------------------------------

def _segment_with_sam2(
    predictor: object,
    image_rgb: NDArray[np.uint8],
) -> Mask:
    """Run SAM2 on a single RGB image.

    We prompt SAM2 with a grid of points covering the centre 60% of the frame
    (where the person typically stands) and keep the largest predicted mask.

    When multiple masks are returned (multimask_output=True), all are evaluated
    and the best is selected based on confidence score. If multiple people are
    detected, the largest mask is chosen.

    Parameters
    ----------
    image_rgb:
        Input image in RGB colour order.

    Returns
    -------
    mask:
        Binary mask (0/255) of the same spatial dimensions as the input.

    Raises
    ------
    RuntimeError
        If SAM2 inference fails entirely (e.g. out of memory).
    """
    h, w = image_rgb.shape[:2]

    if h < 32 or w < 32:
        raise ValueError(
            f"Image too small for segmentation ({w}x{h}). "
            "Minimum size is 32x32 pixels."
        )

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

    try:
        # SAM2ImagePredictor API
        predictor.set_image(image_rgb)  # type: ignore[union-attr]
        masks, scores, _ = predictor.predict(  # type: ignore[union-attr]
            point_coords=points,
            point_labels=labels,
            multimask_output=True,
        )
    except torch.cuda.OutOfMemoryError:
        raise RuntimeError(
            "GPU out of memory during SAM2 inference. "
            "Try reducing FRAME_RESIZE_WIDTH/FRAME_RESIZE_HEIGHT or using U2-Net backend."
        )
    except Exception as exc:
        raise RuntimeError(f"SAM2 inference failed: {exc}") from exc

    if masks is None or len(masks) == 0:
        raise RuntimeError(
            "SAM2 returned no masks. The image may not contain a recognizable subject."
        )

    # Convert all masks to binary and select the best one.
    binary_masks = [(m > 0.5).astype(np.uint8) * 255 for m in masks]

    # Pick the mask with the highest confidence score.
    best_idx = int(np.argmax(scores))
    mask = binary_masks[best_idx]

    # If multiple distinct regions exist, use largest-component logic
    # (handled in _refine_mask). Here we just return the best-scored mask.
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

    try:
        with torch.no_grad():
            outputs = model(tensor)
            # U2-Net returns multiple side outputs; the first is the finest.
            pred = outputs[0] if isinstance(outputs, (list, tuple)) else outputs
    except torch.cuda.OutOfMemoryError:
        raise RuntimeError(
            "GPU out of memory during U2-Net inference. "
            "Try reducing FRAME_RESIZE_WIDTH/FRAME_RESIZE_HEIGHT."
        )

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
    - Keep only the largest connected component (multi-person handling).
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

    if num_labels > 2:
        logger.info(
            "Multiple connected components found (%d). Keeping largest (label %d, "
            "%d pixels). Other components may be bystanders or reflections.",
            num_labels - 1,
            largest_label,
            stats[largest_label, cv2.CC_STAT_AREA],
        )

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
        Returns a zero mask if segmentation produces unacceptable quality.
    """
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    # Preprocess: normalise brightness/contrast for better segmentation.
    image_rgb = _normalize_brightness_contrast(image_rgb)

    mask: Optional[Mask] = None

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
        except Exception as exc:
            logger.info("SAM2 unavailable (%s), falling back to U2-Net", exc)
            model = _load_u2net_model()
            mask = _segment_with_u2net(model, image_rgb)

    mask = _refine_mask(mask)

    # Quality gate: reject masks with unacceptable coverage.
    if not _is_mask_quality_acceptable(mask):
        logger.warning(
            "Mask failed quality check — returning empty mask for this frame. "
            "The frame may need manual review."
        )
        return np.zeros_like(mask)

    return mask


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
        Frames that fail segmentation will have zero masks.
    """
    masks: List[Mask] = []
    failed_count = 0

    for idx, frame in enumerate(frames):
        logger.debug("Segmenting frame %d / %d", idx + 1, len(frames))
        try:
            mask = segment_single_frame(frame, backend=backend)
            masks.append(mask)
            if (mask > 127).sum() == 0:
                failed_count += 1
        except Exception as exc:
            logger.error(
                "Segmentation failed for frame %d / %d: %s",
                idx + 1,
                len(frames),
                exc,
            )
            # Return a zero mask so downstream stages can skip this frame
            # without breaking index alignment.
            h, w = frame.shape[:2]
            masks.append(np.zeros((h, w), dtype=np.uint8))
            failed_count += 1

    if failed_count > 0:
        logger.warning(
            "Segmentation: %d / %d frames produced empty masks",
            failed_count,
            len(frames),
        )

    if failed_count == len(frames):
        logger.error(
            "All frames failed segmentation. Possible causes:\n"
            "  - No person visible in any frame\n"
            "  - Very poor lighting conditions\n"
            "  - Subject blends with background (try a contrasting backdrop)"
        )

    logger.info(
        "Segmentation complete: %d / %d frames successful",
        len(frames) - failed_count,
        len(frames),
    )
    return masks
