#!/usr/bin/env python3
"""
Download model checkpoints for the Drapnr ML processing pipeline.

Downloads:
- SAM2 (Segment Anything Model 2) checkpoint from HuggingFace.
- U2-Net fallback segmentation model from HuggingFace.

Verifies checksums and saves to the configured model directory.

Usage
-----
    python scripts/download_models.py
    python scripts/download_models.py --model-dir /path/to/models
    python scripts/download_models.py --sam2-only
    python scripts/download_models.py --u2net-only
    python scripts/download_models.py --verify-only
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
import sys
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model definitions
# ---------------------------------------------------------------------------

MODELS = {
    "sam2": {
        "repo_id": "facebook/sam2-hiera-large",
        "filename": "sam2_hiera_large.pt",
        "description": "SAM2 Hiera Large — primary segmentation model",
        "expected_sha256": None,  # Set to a known hash in production
        "size_hint": "~2.4 GB",
    },
    "u2net": {
        "repo_id": "skytnt/anime-seg",
        "filename": "u2net.pth",
        "description": "U2-Net — lightweight fallback segmentation model",
        "expected_sha256": None,  # Set to a known hash in production
        "size_hint": "~176 MB",
    },
}

DEFAULT_MODEL_DIR = Path(
    os.environ.get("MODEL_PATH", str(Path(__file__).resolve().parent.parent / "server" / "processing" / "models"))
)


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def compute_sha256(path: Path) -> str:
    """Compute SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_checksum(path: Path, expected: Optional[str]) -> bool:
    """Verify file checksum. Returns True if valid or no expected hash."""
    if expected is None:
        logger.info("  No expected checksum configured — skipping verification")
        return True

    actual = compute_sha256(path)
    if actual == expected:
        logger.info("  Checksum OK: %s", actual[:16])
        return True
    else:
        logger.error(
            "  Checksum MISMATCH: expected %s..., got %s...",
            expected[:16],
            actual[:16],
        )
        return False


def download_model(
    model_name: str,
    model_dir: Path,
    *,
    force: bool = False,
) -> bool:
    """Download a single model checkpoint.

    Parameters
    ----------
    model_name:
        Key in the MODELS dict (e.g. "sam2", "u2net").
    model_dir:
        Directory to save the model file.
    force:
        If True, re-download even if file exists.

    Returns
    -------
    success:
        True if the model was downloaded and verified successfully.
    """
    if model_name not in MODELS:
        logger.error("Unknown model: %s", model_name)
        return False

    info = MODELS[model_name]
    destination = model_dir / info["filename"]

    logger.info("=" * 60)
    logger.info("Model: %s", info["description"])
    logger.info("Repo:  %s", info["repo_id"])
    logger.info("File:  %s", info["filename"])
    logger.info("Size:  %s", info["size_hint"])
    logger.info("Dest:  %s", destination)
    logger.info("=" * 60)

    if destination.exists() and not force:
        logger.info("File already exists at %s", destination)
        if verify_checksum(destination, info["expected_sha256"]):
            logger.info("Model %s is ready.", model_name)
            return True
        else:
            logger.warning("Existing file has bad checksum — re-downloading")

    # Ensure directory exists.
    model_dir.mkdir(parents=True, exist_ok=True)

    try:
        from huggingface_hub import hf_hub_download  # type: ignore[import-untyped]
    except ImportError:
        logger.error(
            "huggingface_hub package is required for model download.\n"
            "Install with: pip install huggingface_hub"
        )
        return False

    logger.info("Downloading from HuggingFace Hub (this may take a while)...")

    try:
        downloaded_path = hf_hub_download(
            repo_id=info["repo_id"],
            filename=info["filename"],
            local_dir=str(model_dir),
            local_dir_use_symlinks=False,
        )

        downloaded = Path(downloaded_path)
        if downloaded != destination:
            downloaded.rename(destination)

        logger.info("Download complete: %s", destination)

        # Verify checksum.
        if not verify_checksum(destination, info["expected_sha256"]):
            logger.error("Downloaded file failed checksum verification!")
            return False

        # Print actual hash for reference.
        actual_hash = compute_sha256(destination)
        logger.info("  SHA-256: %s", actual_hash)

        file_size_mb = destination.stat().st_size / (1024 * 1024)
        logger.info("  Size: %.1f MB", file_size_mb)

        logger.info("Model %s downloaded and verified successfully.", model_name)
        return True

    except Exception as exc:
        logger.error("Failed to download %s: %s", model_name, exc)
        return False


def verify_only(model_dir: Path) -> bool:
    """Verify all model files exist and have valid checksums."""
    all_ok = True

    for model_name, info in MODELS.items():
        destination = model_dir / info["filename"]
        logger.info("Checking %s (%s)...", model_name, destination)

        if not destination.exists():
            logger.error("  MISSING: %s", destination)
            all_ok = False
            continue

        file_size_mb = destination.stat().st_size / (1024 * 1024)
        logger.info("  Found: %.1f MB", file_size_mb)

        if not verify_checksum(destination, info["expected_sha256"]):
            all_ok = False
            continue

        actual_hash = compute_sha256(destination)
        logger.info("  SHA-256: %s", actual_hash)
        logger.info("  OK")

    return all_ok


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Download model checkpoints for the Drapnr ML pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=DEFAULT_MODEL_DIR,
        help=f"Directory to save models (default: {DEFAULT_MODEL_DIR})",
    )
    parser.add_argument(
        "--sam2-only",
        action="store_true",
        help="Only download the SAM2 model",
    )
    parser.add_argument(
        "--u2net-only",
        action="store_true",
        help="Only download the U2-Net model",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify existing model files (no download)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if files exist",
    )

    args = parser.parse_args()
    model_dir: Path = args.model_dir.resolve()

    logger.info("Model directory: %s", model_dir)

    if args.verify_only:
        ok = verify_only(model_dir)
        return 0 if ok else 1

    # Determine which models to download.
    models_to_download = []
    if args.sam2_only:
        models_to_download = ["sam2"]
    elif args.u2net_only:
        models_to_download = ["u2net"]
    else:
        models_to_download = list(MODELS.keys())

    # Download.
    results = {}
    for model_name in models_to_download:
        success = download_model(model_name, model_dir, force=args.force)
        results[model_name] = success

    # Summary.
    logger.info("")
    logger.info("=" * 60)
    logger.info("DOWNLOAD SUMMARY")
    logger.info("=" * 60)
    all_ok = True
    for model_name, success in results.items():
        status = "OK" if success else "FAILED"
        logger.info("  %-10s: %s", model_name, status)
        if not success:
            all_ok = False

    if all_ok:
        logger.info("")
        logger.info("All models downloaded successfully!")
        logger.info("Model directory: %s", model_dir)
    else:
        logger.error("")
        logger.error("Some downloads failed. Check the log above for details.")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
