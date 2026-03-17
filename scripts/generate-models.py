#!/usr/bin/env python3
"""
Drapnr -- Generate stylized mannequin GLB body models.

Creates 4 body-template GLB files with named material slots
(mat_top, mat_bottom, mat_shoes) and per-zone UV islands.

Usage:
    pip install trimesh numpy
    python scripts/generate-models.py

Output:
    apps/mobile/assets/models/male_slim.glb
    apps/mobile/assets/models/male_avg.glb
    apps/mobile/assets/models/female_slim.glb
    apps/mobile/assets/models/female_avg.glb
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np

try:
    import trimesh
    from trimesh.creation import capsule, cylinder, uv_sphere
    from trimesh.visual.material import PBRMaterial
except ImportError:
    print("ERROR: trimesh is required.  Install with:  pip install trimesh numpy")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

VARIANTS = {
    "male_slim": {"height": 1.80, "shoulder": 0.40, "hip": 0.35, "label": "Male - Slim"},
    "male_avg": {"height": 1.75, "shoulder": 0.45, "hip": 0.40, "label": "Male - Average"},
    "female_slim": {"height": 1.65, "shoulder": 0.35, "hip": 0.38, "label": "Female - Slim"},
    "female_avg": {"height": 1.62, "shoulder": 0.38, "hip": 0.42, "label": "Female - Average"},
}

# Relative output directory (from repo root)
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets" / "models"


# ---------------------------------------------------------------------------
# Mesh builders
# ---------------------------------------------------------------------------

def _make_head(radius: float) -> trimesh.Trimesh:
    """Sphere for the head."""
    mesh = uv_sphere(radius=radius, count=[16, 16])
    return mesh


def _make_torso(shoulder_w: float, torso_h: float, depth: float) -> trimesh.Trimesh:
    """Capsule-ish torso (top garment zone)."""
    mesh = capsule(height=torso_h, radius=shoulder_w / 2, count=[16, 8])
    # Scale depth axis for a slightly flattened body
    mesh.apply_scale([1.0, 1.0, depth / (shoulder_w / 2)])
    return mesh


def _make_arm(length: float, radius: float) -> trimesh.Trimesh:
    """Cylinder arm."""
    mesh = cylinder(radius=radius, height=length, sections=12)
    return mesh


def _make_hips_and_legs(hip_w: float, leg_h: float, leg_r: float) -> trimesh.Trimesh:
    """Hips block + two cylinder legs (bottom garment zone)."""
    # Hip block
    hip_mesh = trimesh.creation.box(extents=[hip_w, hip_w * 0.3, hip_w * 0.6])

    # Left leg
    left_leg = cylinder(radius=leg_r, height=leg_h, sections=12)
    left_leg.apply_translation([-(hip_w / 2 - leg_r), -leg_h / 2 - hip_w * 0.15, 0])

    # Right leg
    right_leg = cylinder(radius=leg_r, height=leg_h, sections=12)
    right_leg.apply_translation([(hip_w / 2 - leg_r), -leg_h / 2 - hip_w * 0.15, 0])

    combined = trimesh.util.concatenate([hip_mesh, left_leg, right_leg])
    return combined


def _make_foot(length: float, width: float, height: float) -> trimesh.Trimesh:
    """Box foot (shoes zone)."""
    mesh = trimesh.creation.box(extents=[width, height, length])
    return mesh


# ---------------------------------------------------------------------------
# UV helpers
# ---------------------------------------------------------------------------

def _assign_box_uv(mesh: trimesh.Trimesh, offset_u: float = 0.0, offset_v: float = 0.0,
                   scale_u: float = 1.0, scale_v: float = 1.0) -> np.ndarray:
    """Simple planar UV projection with offset/scale to place in texture atlas."""
    vertices = mesh.vertices
    # Project along the two largest extent axes
    bounds = vertices.max(axis=0) - vertices.min(axis=0)
    axes = np.argsort(bounds)[::-1]  # largest first
    ax_u, ax_v = axes[0], axes[1]

    uv = np.zeros((len(vertices), 2), dtype=np.float64)
    v_min = vertices.min(axis=0)
    v_range = bounds.copy()
    v_range[v_range == 0] = 1.0

    uv[:, 0] = (vertices[:, ax_u] - v_min[ax_u]) / v_range[ax_u]
    uv[:, 1] = (vertices[:, ax_v] - v_min[ax_v]) / v_range[ax_v]

    # Scale and offset into texture atlas region
    uv[:, 0] = uv[:, 0] * scale_u + offset_u
    uv[:, 1] = uv[:, 1] * scale_v + offset_v

    return uv


# ---------------------------------------------------------------------------
# Main model builder
# ---------------------------------------------------------------------------

def build_mannequin(height: float, shoulder: float, hip: float) -> trimesh.Scene:
    """
    Build a stylized mannequin and return a trimesh.Scene with 3 named
    material groups: mat_top, mat_bottom, mat_shoes.
    """
    # Proportions derived from overall height
    head_r = height * 0.065
    neck_h = height * 0.02
    torso_h = height * 0.28
    arm_len = height * 0.32
    arm_r = shoulder * 0.15
    leg_h = height * 0.42
    leg_r = hip * 0.2
    foot_l = height * 0.09
    foot_w = leg_r * 1.6
    foot_h = height * 0.025
    torso_depth = shoulder * 0.65

    # ---- Build sub-meshes ----
    head = _make_head(head_r)
    torso = _make_torso(shoulder, torso_h, torso_depth)
    left_arm = _make_arm(arm_len, arm_r)
    right_arm = _make_arm(arm_len, arm_r)
    lower_body = _make_hips_and_legs(hip, leg_h, leg_r)
    left_foot = _make_foot(foot_l, foot_w, foot_h)
    right_foot = _make_foot(foot_l, foot_w, foot_h)

    # ---- Position sub-meshes ----
    # Torso center at origin; stack upward and downward
    torso_center_y = 0.0

    head.apply_translation([0, torso_center_y + torso_h / 2 + neck_h + head_r, 0])
    left_arm.apply_translation([-(shoulder / 2 + arm_r), torso_center_y + torso_h / 4, 0])
    right_arm.apply_translation([(shoulder / 2 + arm_r), torso_center_y + torso_h / 4, 0])
    lower_body.apply_translation([0, torso_center_y - torso_h / 2 - hip * 0.15, 0])

    # Feet at the bottom of the legs
    foot_y = torso_center_y - torso_h / 2 - hip * 0.15 - leg_h - hip * 0.15 - foot_h / 2
    left_foot.apply_translation([-(hip / 2 - leg_r), foot_y, foot_l * 0.2])
    right_foot.apply_translation([(hip / 2 - leg_r), foot_y, foot_l * 0.2])

    # ---- Create materials ----
    mat_top = PBRMaterial(
        name="mat_top",
        baseColorFactor=[0.75, 0.75, 0.75, 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.8,
    )
    mat_bottom = PBRMaterial(
        name="mat_bottom",
        baseColorFactor=[0.6, 0.6, 0.6, 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.8,
    )
    mat_shoes = PBRMaterial(
        name="mat_shoes",
        baseColorFactor=[0.4, 0.4, 0.4, 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.7,
    )

    # ---- Combine top-zone meshes ----
    top_parts = [torso, head, left_arm, right_arm]
    top_mesh = trimesh.util.concatenate(top_parts)
    top_uv = _assign_box_uv(top_mesh, offset_u=0.0, offset_v=0.5, scale_u=0.5, scale_v=0.5)
    top_mesh.visual = trimesh.visual.TextureVisuals(
        uv=top_uv,
        material=mat_top,
    )

    # ---- Bottom-zone mesh ----
    bottom_mesh = lower_body
    bottom_uv = _assign_box_uv(bottom_mesh, offset_u=0.5, offset_v=0.5, scale_u=0.5, scale_v=0.5)
    bottom_mesh.visual = trimesh.visual.TextureVisuals(
        uv=bottom_uv,
        material=mat_bottom,
    )

    # ---- Shoes-zone mesh ----
    shoes_mesh = trimesh.util.concatenate([left_foot, right_foot])
    shoes_uv = _assign_box_uv(shoes_mesh, offset_u=0.0, offset_v=0.0, scale_u=0.5, scale_v=0.5)
    shoes_mesh.visual = trimesh.visual.TextureVisuals(
        uv=shoes_uv,
        material=mat_shoes,
    )

    # ---- Assemble scene ----
    scene = trimesh.Scene()
    scene.add_geometry(top_mesh, geom_name="body_top", node_name="body_top")
    scene.add_geometry(bottom_mesh, geom_name="body_bottom", node_name="body_bottom")
    scene.add_geometry(shoes_mesh, geom_name="body_shoes", node_name="body_shoes")

    return scene


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, cfg in VARIANTS.items():
        print(f"Generating {name} (height={cfg['height']}, shoulder={cfg['shoulder']}, hip={cfg['hip']})...")
        scene = build_mannequin(
            height=cfg["height"],
            shoulder=cfg["shoulder"],
            hip=cfg["hip"],
        )

        out_path = OUTPUT_DIR / f"{name}.glb"
        scene.export(file_obj=str(out_path), file_type="glb")
        file_size = out_path.stat().st_size
        print(f"  -> {out_path}  ({file_size:,} bytes)")

    print("\nDone. All models written to:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
