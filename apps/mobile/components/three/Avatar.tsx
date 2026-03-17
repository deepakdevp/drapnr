// =============================================================================
// Drapnr — 3D Avatar Model Component
// =============================================================================

import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader } from '@react-three/fiber/native';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useTexture, getFallbackTexture } from './TextureSwapper';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AvatarProps {
  modelPath: string;
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
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
// Avatar Component
// -----------------------------------------------------------------------------

export function Avatar({
  modelPath,
  topTexture,
  bottomTexture,
  shoesTexture,
  enableIdleRotation = true,
  idleRotationSpeed = 0.003,
}: AvatarProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  // Material refs for direct texture assignment
  const matTopRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const matBottomRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const matShoesRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Load GLTF model
  const gltf = useLoader(GLTFLoader, modelPath);

  // Load textures via the caching hook
  const topState = useTexture(topTexture);
  const bottomState = useTexture(bottomTexture);
  const shoesState = useTexture(shoesTexture);

  // Clone the scene so multiple instances don't share state
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Clone materials so we can swap textures independently
        child.material = (child.material as THREE.Material).clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf]);

  // Find and store material references from the loaded model
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat?.name) return;

      if (mat.name === MATERIAL_SLOTS.top) {
        matTopRef.current = mat;
      } else if (mat.name === MATERIAL_SLOTS.bottom) {
        matBottomRef.current = mat;
      } else if (mat.name === MATERIAL_SLOTS.shoes) {
        matShoesRef.current = mat;
      }
    });
  }, [scene]);

  // Apply texture to a material when it changes
  const applyTexture = (
    matRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>,
    textureState: { texture: THREE.Texture | null; isLoading: boolean },
  ) => {
    const mat = matRef.current;
    if (!mat) return;

    if (textureState.texture) {
      mat.map = textureState.texture;
    } else if (!textureState.isLoading) {
      // No texture URL provided — use fallback
      mat.map = getFallbackTexture();
    }
    mat.needsUpdate = true;
  };

  useEffect(() => applyTexture(matTopRef, topState), [topState.texture]);
  useEffect(() => applyTexture(matBottomRef, bottomState), [bottomState.texture]);
  useEffect(() => applyTexture(matShoesRef, shoesState), [shoesState.texture]);

  // Idle rotation animation
  useFrame((_state, delta) => {
    if (enableIdleRotation && groupRef.current) {
      groupRef.current.rotation.y += idleRotationSpeed * delta * 60;
    }
  });

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
