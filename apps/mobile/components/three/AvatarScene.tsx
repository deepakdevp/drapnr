// =============================================================================
// Drapnr — Main 3D Avatar Scene
// =============================================================================

import React, { Suspense, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import * as THREE from 'three';
import { Avatar } from './Avatar';
import { SceneControls, type SceneControlState } from './SceneControls';
import { LoadingAvatar } from './LoadingAvatar';
import type { Garment, GarmentCategory } from '@/types';

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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AvatarScene] 3D rendering error:', error, info);
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
// 3D Scene Internals (rendered inside Canvas)
// -----------------------------------------------------------------------------

interface SceneContentProps {
  bodyTemplate: string;
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
}

function SceneContent({
  bodyTemplate,
  topTexture,
  bottomTexture,
  shoesTexture,
}: SceneContentProps): React.JSX.Element {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={20}
        shadow-camera-near={0.1}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />

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
        modelPath={bodyTemplate}
        topTexture={topTexture}
        bottomTexture={bottomTexture}
        shoesTexture={shoesTexture}
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
      const canvas = state.gl.domElement;

      const handleLost = (event: Event) => {
        event.preventDefault();
        console.warn('[AvatarScene] WebGL context lost');
        setContextLost(true);
      };

      const handleRestored = () => {
        console.info('[AvatarScene] WebGL context restored');
        setContextLost(false);
      };

      canvas.addEventListener('webglcontextlost', handleLost);
      canvas.addEventListener('webglcontextrestored', handleRestored);
    },
    [],
  );

  return { contextLost, onCreated };
}

// -----------------------------------------------------------------------------
// 2D Fallback Grid
// -----------------------------------------------------------------------------

interface FallbackGridProps {
  garments?: Garment[];
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
  onSelectGarment?: (id: string, category: GarmentCategory) => void;
}

function FallbackGrid({
  garments,
  topTexture,
  bottomTexture,
  shoesTexture,
}: FallbackGridProps): React.JSX.Element {
  const textures = useMemo(
    () =>
      [
        { label: 'Top', url: topTexture },
        { label: 'Bottom', url: bottomTexture },
        { label: 'Shoes', url: shoesTexture },
      ].filter((t) => t.url != null) as { label: string; url: string }[],
    [topTexture, bottomTexture, shoesTexture],
  );

  if (textures.length === 0) {
    return (
      <View style={fallbackStyles.emptyFallback}>
        <Text style={fallbackStyles.emptyText}>
          Select garments to preview your outfit
        </Text>
      </View>
    );
  }

  return (
    <View style={fallbackStyles.gridContainer}>
      {textures.map((item) => (
        <View key={item.label} style={fallbackStyles.gridItem}>
          <Image
            source={{ uri: item.url }}
            style={fallbackStyles.gridImage}
            resizeMode="cover"
          />
          <Text style={fallbackStyles.gridLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
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

  // 2D fallback mode
  if (!USE_3D) {
    return (
      <View style={styles.container}>
        <FallbackGrid
          garments={garments}
          topTexture={topTexture}
          bottomTexture={bottomTexture}
          shoesTexture={shoesTexture}
          onSelectGarment={onSelectGarment}
        />
      </View>
    );
  }

  // Context lost state
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
      <SceneErrorBoundary>
        <SceneControls onControlChange={setControlState}>
          <Suspense fallback={<LoadingAvatar />}>
            <Canvas
              shadows
              camera={{ position: [0, 0.5, 3.5], fov: 40 }}
              onCreated={onCreated as any}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
              }}
              style={styles.canvas}
            >
              <SceneContent
                bodyTemplate={bodyTemplate}
                topTexture={topTexture}
                bottomTexture={bottomTexture}
                shoesTexture={shoesTexture}
              />
            </Canvas>
          </Suspense>
        </SceneControls>
      </SceneErrorBoundary>
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
  // 2D fallback
  gridContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  gridItem: {
    alignItems: 'center',
    gap: 6,
  },
  gridImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default AvatarScene;
