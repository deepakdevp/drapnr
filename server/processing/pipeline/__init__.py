"""
Drapnr processing pipeline.

Submodules
----------
frame_extraction : Download and pre-process video frames.
segmentation     : Isolate clothing from background / skin.
classification   : Classify garment regions (top / bottom / shoes).
texture_mapping  : Project garment textures onto UV maps.
upload           : Push results to Supabase Storage + DB.
processor        : Orchestrates the end-to-end pipeline.
"""
