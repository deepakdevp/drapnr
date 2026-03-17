"""
Model weight management and loading utilities.

Model checkpoints are expected under the path defined by ``config.settings.model_path``.
Supported models:
  - SAM2 (Segment Anything Model 2) for clothing segmentation
  - U2-Net as a lighter-weight fallback segmentation model
"""
