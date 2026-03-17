# Drapnr Body Models

## Overview

This directory contains GLB body models used for the 3D avatar try-on viewer.
Each model is a stylized mannequin shape suitable for garment texture mapping.

## Required Models

| File              | Description         | Height | Shoulder | Hip  |
| ----------------- | ------------------- | ------ | -------- | ---- |
| `male_slim.glb`   | Male - Slim build   | 1.80m  | 0.40m    | 0.35m |
| `male_avg.glb`    | Male - Average build| 1.75m  | 0.45m    | 0.40m |
| `female_slim.glb` | Female - Slim build | 1.65m  | 0.35m    | 0.38m |
| `female_avg.glb`  | Female - Average build | 1.62m | 0.38m   | 0.42m |

## Material Slots

Every model **must** contain exactly 3 named materials:

1. **`mat_top`** -- Covers torso and arms (t-shirt / jacket zone)
2. **`mat_bottom`** -- Covers hips and legs (pants / skirt zone)
3. **`mat_shoes`** -- Covers feet (shoe zone)

The avatar renderer (`Avatar.tsx`) traverses the loaded scene graph looking for
meshes whose material name matches these slots. If a slot is missing, the
garment texture for that zone will not be applied.

## UV Mapping Requirements

- Each material group must have its own UV island
- UV islands should be mapped to a 1024x1024 texture space
- No overlapping UVs between different material groups
- UVs should maximize texture space usage for best visual quality

## Generating Models

### Automated (Python script)

The fastest way to generate all 4 models for development/MVP:

```bash
pip install trimesh numpy
python scripts/generate-models.py
```

This creates stylized mannequin meshes (capsule body, sphere head, cylinder
limbs) with proper material assignments and UV islands. Not photorealistic,
but functional for texture mapping and iteration.

### Manual (MakeHuman + Blender)

For higher-quality production models:

1. **MakeHuman**
   - Download from https://www.makehumancommunity.org/
   - Create a base human with the target body proportions
   - Export as FBX with skeleton (no clothes, no hair)

2. **Blender Import**
   - Import the FBX into Blender 3.6+
   - Delete the skeleton (armature) -- the app does not use bone animation yet
   - Simplify the mesh to ~5,000-8,000 triangles for mobile performance

3. **Material Assignment**
   - Select faces for the torso + arms region -> Assign material named `mat_top`
   - Select faces for the hips + legs region -> Assign material named `mat_bottom`
   - Select faces for the feet region -> Assign material named `mat_shoes`
   - Ensure each material uses Principled BSDF with a Base Color texture input

4. **UV Unwrapping**
   - For each material group, select its faces and UV unwrap
   - Pack UV islands so each group occupies its own non-overlapping region
   - Target 1024x1024 texture resolution

5. **Export**
   - File > Export > glTF 2.0 (.glb)
   - Settings: Format = GLB, Apply Modifiers = ON, UVs = ON, Normals = ON
   - Materials = Export (do NOT embed textures -- they are applied at runtime)
   - Save as `male_slim.glb`, `male_avg.glb`, etc. into this directory

## Testing

After generating models, verify them by:

1. Opening in https://gltf-viewer.donmccurdy.com/ (drag-and-drop)
2. Confirming 3 materials appear in the sidebar: `mat_top`, `mat_bottom`, `mat_shoes`
3. Rotating the model to check UV seam placement
4. Loading in the app to verify texture application
