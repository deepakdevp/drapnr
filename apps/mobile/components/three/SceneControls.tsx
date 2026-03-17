// =============================================================================
// Drapnr — Touch Controls for 3D Scene
// =============================================================================

import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SceneControlState {
  rotationY: number;
  zoom: number;
}

export interface SceneControlsProps {
  children: React.ReactNode;
  /** Callback fired on every frame with current rotation/zoom */
  onControlChange?: (state: SceneControlState) => void;
  /** Minimum zoom scale (default 0.5) */
  minZoom?: number;
  /** Maximum zoom scale (default 2.0) */
  maxZoom?: number;
  /** Initial Y rotation in radians */
  initialRotationY?: number;
  /** Spring damping factor (default 15) */
  damping?: number;
  /** Sensitivity multiplier for rotation (default 0.005) */
  rotationSensitivity?: number;
  /** Enable/disable controls */
  enabled?: boolean;
}

// Default rotation/zoom
const DEFAULT_ROTATION_Y = 0;
const DEFAULT_ZOOM = 1;

// Double-tap detection threshold (ms)
const DOUBLE_TAP_DELAY = 300;

// Spring config for smooth damping
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SceneControls({
  children,
  onControlChange,
  minZoom = 0.5,
  maxZoom = 2.0,
  initialRotationY = DEFAULT_ROTATION_Y,
  damping = 15,
  rotationSensitivity = 0.005,
  enabled = true,
}: SceneControlsProps): React.JSX.Element {
  const rotationY = useSharedValue(initialRotationY);
  const zoom = useSharedValue(DEFAULT_ZOOM);

  // Track gesture start values
  const startRotationY = useSharedValue(initialRotationY);
  const startZoom = useSharedValue(DEFAULT_ZOOM);

  // Notify parent of control changes
  const notifyChange = useCallback(
    (rotation: number, zoomVal: number) => {
      onControlChange?.({ rotationY: rotation, zoom: zoomVal });
    },
    [onControlChange],
  );

  // Pan gesture — horizontal swipe rotates Y axis
  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onStart(() => {
      startRotationY.value = rotationY.value;
    })
    .onUpdate((event) => {
      rotationY.value =
        startRotationY.value + event.translationX * rotationSensitivity;
    })
    .onEnd((event) => {
      // Apply momentum with spring damping
      const velocity = event.velocityX * rotationSensitivity * 0.001;
      rotationY.value = withSpring(rotationY.value + velocity, {
        ...SPRING_CONFIG,
        damping,
      });
      runOnJS(notifyChange)(rotationY.value + velocity, zoom.value);
    });

  // Pinch gesture — pinch to zoom with min/max bounds
  const pinchGesture = Gesture.Pinch()
    .enabled(enabled)
    .onStart(() => {
      startZoom.value = zoom.value;
    })
    .onUpdate((event) => {
      const newZoom = startZoom.value * event.scale;
      zoom.value = Math.min(maxZoom, Math.max(minZoom, newZoom));
    })
    .onEnd(() => {
      runOnJS(notifyChange)(rotationY.value, zoom.value);
    });

  // Double-tap gesture — reset view
  const doubleTapGesture = Gesture.Tap()
    .enabled(enabled)
    .numberOfTaps(2)
    .maxDuration(DOUBLE_TAP_DELAY)
    .onEnd(() => {
      rotationY.value = withSpring(DEFAULT_ROTATION_Y, SPRING_CONFIG);
      zoom.value = withSpring(DEFAULT_ZOOM, SPRING_CONFIG);
      runOnJS(notifyChange)(DEFAULT_ROTATION_Y, DEFAULT_ZOOM);
    });

  // Compose gestures: double-tap is exclusive, pan+pinch are simultaneous
  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(panGesture, pinchGesture),
  );

  // Animated container style (zoom is applied as a scale transform)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// -----------------------------------------------------------------------------
// Hook: use inside R3F to read shared rotation/zoom from controls
// -----------------------------------------------------------------------------

export interface UseSceneControlsReturn {
  rotationY: number;
  zoom: number;
  resetView: () => void;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SceneControls;
