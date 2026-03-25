// =============================================================================
// Drapnr -- 3D Avatar Model Component
// =============================================================================

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber/native';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useTexture, getFallbackTexture } from './TextureSwapper';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AvatarProps {
  /** Local URI to the GLB model file (resolved by useAvatarModel hook) */
  modelPath: string;
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
  /** Y-axis rotation from touch controls (radians). Overrides idle rotation when set. */
  rotationY?: number;
  enableIdleRotation?: boolean;
  idleRotationSpeed?: number;
}

// Material slot names expected in the GLB model
const MATERIAL_SLOTS = {
  top: 'mat_top',
  bottom: 'mat_bottom',
  shoes: 'mat_shoes',
} as const;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Traverse a scene and collect material references keyed by material name.
 * Only considers MeshStandardMaterial / MeshPhysicalMaterial instances.
 */
function findMaterialsByName(
  root: THREE.Object3D,
): Map<string, THREE.MeshStandardMaterial> {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const mat = child.material;
    if (!mat) return;

    // Handle arrays of materials (multi-material meshes)
    const matArray = Array.isArray(mat) ? mat : [mat];
    for (const m of matArray) {
      if (
        m instanceof THREE.MeshStandardMaterial &&
        m.name &&
        !materials.has(m.name)
      ) {
        materials.set(m.name, m);
      }
    }
  });
  return materials;
}

/**
 * Safely apply a texture to a material, disposing the previous map if it was
 * not the shared fallback texture.
 */
function applyTextureToMaterial(
  mat: THREE.MeshStandardMaterial | undefined,
  textureState: { texture: THREE.Texture | null; isLoading: boolean },
): void {
  if (!mat) return;

  const fallback = getFallbackTexture();

  if (textureState.texture) {
    // Dispose old map only if it is not the shared fallback
    if (mat.map && mat.map !== fallback && mat.map !== textureState.texture) {
      mat.map.dispose();
    }
    mat.map = textureState.texture;
  } else if (!textureState.isLoading) {
    // No texture URL -- use fallback
    mat.map = fallback;
  }
  mat.needsUpdate = true;
}

// -----------------------------------------------------------------------------
// Lighting Setup (rendered as sibling inside the same Canvas)
// -----------------------------------------------------------------------------

export function AvatarLighting(): React.JSX.Element {
  return (
    <>
      {/* Soft ambient fill */}
      <ambientLight intensity={0.5} />
      {/* Key light */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={20}
        shadow-camera-near={0.1}
      />
      {/* Fill light */}
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />
      {/* Rim / back light for depth */}
      <pointLight position={[0, 3, -4]} intensity={0.4} />
    </>
  );
}

// -----------------------------------------------------------------------------
// Avatar Component
// -----------------------------------------------------------------------------

export function Avatar({
  modelPath,
  topTexture,
  bottomTexture,
  shoesTexture,
  rotationY,
  enableIdleRotation = true,
  idleRotationSpeed = 0.003,
}: AvatarProps): React.JSX.Element | null {
  const groupRef = useRef<THREE.Group>(null);

  // Material refs for direct texture assignment
  const matTopRef = useRef<THREE.MeshStandardMaterial | undefined>(undefined);
  const matBottomRef = useRef<THREE.MeshStandardMaterial | undefined>(undefined);
  const matShoesRef = useRef<THREE.MeshStandardMaterial | undefined>(undefined);

  // ------ Load GLTF model ------
  let gltf: ReturnType<typeof useLoader<any, any>> | null = null;
  let loadError: Error | null = null;

  try {
    gltf = useLoader(GLTFLoader, modelPath);
  } catch (err) {
    // useLoader throws a promise for Suspense; re-throw that.
    // Only catch real errors.
    if (err instanceof Promise) {
      throw err;
    }
    loadError = err instanceof Error ? err : new Error(String(err));
  }

  // ------ Load textures via the caching hook ------
  const topState = useTexture(topTexture);
  const bottomState = useTexture(bottomTexture);
  const shoesState = useTexture(shoesTexture);

  // ------ Clone scene so multiple instances don't share state ------
  const scene = useMemo(() => {
    if (!gltf?.scene) return null;

    const cloned = gltf.scene.clone(true);
    cloned.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Clone materials so texture swaps are independent per instance
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m: THREE.Material) => m.clone());
        } else {
          child.material = child.material.clone();
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf]);

  // ------ Find and store material references from the loaded model ------
  useEffect(() => {
    if (!scene) return;

    const materials = findMaterialsByName(scene);
    matTopRef.current = materials.get(MATERIAL_SLOTS.top);
    matBottomRef.current = materials.get(MATERIAL_SLOTS.bottom);
    matShoesRef.current = materials.get(MATERIAL_SLOTS.shoes);

    // Warn about missing slots in dev for easier debugging
    if (__DEV__) {
      for (const [zone, slot] of Object.entries(MATERIAL_SLOTS)) {
        if (!materials.has(slot)) {
          // Dev-only: material slot missing in model
        }
      }
    }
  }, [scene]);

  // ------ Apply textures when they change ------
  useEffect(() => {
    applyTextureToMaterial(matTopRef.current, topState);
  }, [topState.texture, topState.isLoading]);

  useEffect(() => {
    applyTextureToMaterial(matBottomRef.current, bottomState);
  }, [bottomState.texture, bottomState.isLoading]);

  useEffect(() => {
    applyTextureToMaterial(matShoesRef.current, shoesState);
  }, [shoesState.texture, shoesState.isLoading]);

  // ------ Y-axis rotation (touch controls or idle) ------
  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    if (rotationY !== undefined) {
      // Touch-controlled rotation from SceneControls
      groupRef.current.rotation.y = rotationY;
    } else if (enableIdleRotation) {
      // Idle auto-rotation
      groupRef.current.rotation.y += idleRotationSpeed * delta * 60;
    }
  });

  // ------ Handle load errors gracefully ------
  if (loadError) {
    // Render nothing — the error boundary in AvatarScene will catch this
    return null;
  }

  if (!scene) {
    return null;
  }

  return (
    <group ref={groupRef} dispose={null}>
      <primitive
        object={scene}
        position={[0, -1.2, 0]}
        scale={[1, 1, 1]}
      />
    </group>
  );
}

export default Avatar;
