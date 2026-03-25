// =============================================================================
// Drapnr -- Main 3D Avatar Scene
// =============================================================================

import React, { Suspense, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import * as THREE from 'three';
import { Avatar, AvatarLighting } from './Avatar';
import { SceneControls, type SceneControlState } from './SceneControls';
import { LoadingAvatar } from './LoadingAvatar';
import { FallbackViewer } from './FallbackViewer';
import { useAvatarModel } from '../../hooks/useAvatarModel';
import type { Garment, GarmentCategory } from '@/types';

// Import model manifest for camera height lookup
import modelManifest from '../../assets/models/model-manifest.json';

// -----------------------------------------------------------------------------
// Feature flag: toggle between 3D and 2D fallback
// -----------------------------------------------------------------------------

export const USE_3D = true;

// -----------------------------------------------------------------------------
// Colors (Drapnr palette)
// -----------------------------------------------------------------------------

const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  surface: '#F8F9FA',
  border: '#E5E7EB',
} as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AvatarSceneProps {
  bodyTemplate: string;
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
  /** Optional: garments for 2D fallback grid */
  garments?: Garment[];
  onSelectGarment?: (id: string, category: GarmentCategory) => void;
}

// -----------------------------------------------------------------------------
// Error Boundary
// -----------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Error is surfaced via the fallback UI — no console output in production
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <View style={fallbackStyles.errorContainer}>
            <Text style={fallbackStyles.errorTitle}>
              Unable to load 3D viewer
            </Text>
            <Text style={fallbackStyles.errorMessage}>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </Text>
          </View>
        )
      );
    }
    return this.props.children;
  }
}

// -----------------------------------------------------------------------------
// Camera height helper
// -----------------------------------------------------------------------------

type ManifestEntry = { file: string; height: number; label: string };
const manifest = modelManifest as Record<string, ManifestEntry>;

function getCameraPositionForTemplate(templateKey: string): [number, number, number] {
  const entry = manifest[templateKey];
  const height = entry?.height ?? 1.7;
  // Position camera at roughly chest height, pulled back based on model height
  const cameraY = height * 0.3;
  const cameraZ = height * 2.0;
  return [0, cameraY, cameraZ];
}

// -----------------------------------------------------------------------------
// FPS Counter (dev mode only)
// -----------------------------------------------------------------------------

function useFpsCounter() {
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!__DEV__) return;

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      if (elapsed > 0) {
        setFps(Math.round((framesRef.current * 1000) / elapsed));
      }
      framesRef.current = 0;
      lastTimeRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const tick = useCallback(() => {
    framesRef.current += 1;
  }, []);

  return { fps, tick };
}

// -----------------------------------------------------------------------------
// 3D Scene Internals (rendered inside Canvas)
// -----------------------------------------------------------------------------

interface SceneContentProps {
  modelPath: string;
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
  rotationY?: number;
  onFrame?: () => void;
}

function SceneContent({
  modelPath,
  topTexture,
  bottomTexture,
  shoesTexture,
  rotationY,
  onFrame,
}: SceneContentProps): React.JSX.Element {
  // Tick FPS counter on each frame via useFrame
  const { useFrame: useR3FFrame } = require('@react-three/fiber/native');
  useR3FFrame(() => {
    onFrame?.();
  });

  return (
    <>
      {/* Lighting */}
      <AvatarLighting />

      {/* Ground plane with shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.2, 0]}
        receiveShadow
      >
        <planeGeometry args={[6, 6]} />
        <shadowMaterial opacity={0.15} />
      </mesh>

      {/* Avatar model */}
      <Avatar
        modelPath={modelPath}
        topTexture={topTexture}
        bottomTexture={bottomTexture}
        shoesTexture={shoesTexture}
        rotationY={rotationY}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// WebGL Context Loss Handler
// -----------------------------------------------------------------------------

function useWebGLContextHandler() {
  const [contextLost, setContextLost] = useState(false);

  const onCreated = useCallback(
    (state: { gl: THREE.WebGLRenderer }) => {
      const gl = state.gl;

      // Configure GL context for React Native / expo-gl
      gl.setPixelRatio(1); // Mobile: keep pixel ratio at 1 for performance
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.0;
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;

      const canvas = gl.domElement;

      const handleLost = (event: Event) => {
        event.preventDefault();
        // WebGL context lost — handled by contextLost state
        setContextLost(true);
      };

      const handleRestored = () => {
        // WebGL context restored
        setContextLost(false);
      };

      // On native, domElement may not support addEventListener (expo-gl)
      // Wrap in try/catch to avoid crashes
      try {
        canvas?.addEventListener?.('webglcontextlost', handleLost);
        canvas?.addEventListener?.('webglcontextrestored', handleRestored);
      } catch {
        // expo-gl does not always expose standard event listeners
      }
    },
    [],
  );

  return { contextLost, onCreated };
}

// -----------------------------------------------------------------------------
// Main AvatarScene Component
// -----------------------------------------------------------------------------

export function AvatarScene({
  bodyTemplate,
  topTexture,
  bottomTexture,
  shoesTexture,
  garments,
  onSelectGarment,
}: AvatarSceneProps): React.JSX.Element {
  const { contextLost, onCreated } = useWebGLContextHandler();
  const [controlState, setControlState] = useState<SceneControlState>({
    rotationY: 0,
    zoom: 1,
  });

  // Resolve model asset path via hook
  const { modelPath, isLoading: modelLoading, error: modelError } = useAvatarModel(bodyTemplate);

  // Camera positioning based on body template
  const cameraPosition = useMemo(
    () => getCameraPositionForTemplate(bodyTemplate),
    [bodyTemplate],
  );

  // FPS counter (dev only)
  const { fps, tick } = useFpsCounter();

  // ------ 2D fallback mode (feature flag OFF) ------
  if (!USE_3D) {
    return (
      <View style={styles.container}>
        <FallbackViewer
          topTexture={topTexture}
          bottomTexture={bottomTexture}
          shoesTexture={shoesTexture}
        />
      </View>
    );
  }

  // ------ Model loading error -> fall back to 2D ------
  if (modelError) {
    return (
      <View style={styles.container}>
        <FallbackViewer
          topTexture={topTexture}
          bottomTexture={bottomTexture}
          shoesTexture={shoesTexture}
        />
        {__DEV__ && (
          <View style={fallbackStyles.devError}>
            <Text style={fallbackStyles.devErrorText}>
              Model error: {modelError}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ------ Context lost state ------
  if (contextLost) {
    return (
      <View style={styles.container}>
        <View style={fallbackStyles.errorContainer}>
          <Text style={fallbackStyles.errorTitle}>Display interrupted</Text>
          <Text style={fallbackStyles.errorMessage}>
            The 3D renderer lost its context. Please wait while it recovers.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SceneErrorBoundary
        fallback={
          <FallbackViewer
            topTexture={topTexture}
            bottomTexture={bottomTexture}
            shoesTexture={shoesTexture}
          />
        }
      >
        <SceneControls onControlChange={setControlState}>
          <Suspense fallback={<LoadingAvatar />}>
            {modelPath ? (
              <Canvas
                shadows
                camera={{ position: cameraPosition, fov: 40 }}
                onCreated={onCreated as any}
                gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: 'high-performance',
                }}
                style={styles.canvas}
              >
                <SceneContent
                  modelPath={modelPath}
                  topTexture={topTexture}
                  bottomTexture={bottomTexture}
                  shoesTexture={shoesTexture}
                  rotationY={controlState.rotationY}
                  onFrame={__DEV__ ? tick : undefined}
                />
              </Canvas>
            ) : (
              <LoadingAvatar />
            )}
          </Suspense>
        </SceneControls>
      </SceneErrorBoundary>

      {/* Dev-only FPS overlay */}
      {__DEV__ && fps > 0 && (
        <View style={styles.fpsOverlay} pointerEvents="none">
          <Text style={styles.fpsText}>{fps} FPS</Text>
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  canvas: {
    flex: 1,
  },
  fpsOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fpsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00FF88',
    fontVariant: ['tabular-nums'],
  },
});

const fallbackStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    margin: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  devError: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,0,0,0.15)',
    borderRadius: 8,
    padding: 8,
  },
  devErrorText: {
    fontSize: 11,
    color: '#CC0000',
  },
});

export default AvatarScene;
