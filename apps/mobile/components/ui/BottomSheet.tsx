// =============================================================================
// BottomSheet Component
// =============================================================================
// Draggable bottom sheet powered by react-native-gesture-handler and
// react-native-reanimated. Supports multiple snap points and a backdrop.
// =============================================================================

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import { useTheme } from '../../lib/theme';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BottomSheetProps {
  /** Ordered snap points as % of screen height (0 = closed, 1 = full). */
  snapPoints: number[];
  /** Index into `snapPoints` that the sheet should be at initially. */
  initialSnap?: number;
  /** Whether the sheet is visible. */
  visible: boolean;
  /** Called when the user dismisses the sheet (drags to 0 or taps backdrop). */
  onDismiss?: () => void;
  children: React.ReactNode;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BottomSheet({
  snapPoints,
  initialSnap = 0,
  visible,
  onDismiss,
  children,
}: BottomSheetProps) {
  const theme = useTheme();

  // Convert percentage snap points to pixel positions (distance from bottom).
  const snapPixels = snapPoints.map((p) => SCREEN_HEIGHT * p);
  const initialHeight = snapPixels[initialSnap] ?? snapPixels[0] ?? 0;

  const sheetHeight = useSharedValue(visible ? initialHeight : 0);
  const startHeight = useSharedValue(0);

  // Snap to the nearest snap point.
  const snapTo = useCallback(
    (targetHeight: number) => {
      'worklet';
      let closest = snapPixels[0];
      let minDist = Math.abs(targetHeight - closest);
      for (let i = 1; i < snapPixels.length; i++) {
        const dist = Math.abs(targetHeight - snapPixels[i]);
        if (dist < minDist) {
          minDist = dist;
          closest = snapPixels[i];
        }
      }
      sheetHeight.value = withSpring(closest, SPRING_CONFIG);
      if (closest === 0 && onDismiss) {
        runOnJS(onDismiss)();
      }
    },
    [snapPixels, sheetHeight, onDismiss],
  );

  // Open / close when `visible` prop changes.
  useEffect(() => {
    if (visible) {
      sheetHeight.value = withSpring(initialHeight, SPRING_CONFIG);
    } else {
      sheetHeight.value = withSpring(0, SPRING_CONFIG);
    }
  }, [visible, initialHeight, sheetHeight]);

  // -- Gesture ----------------------------------------------------------------

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startHeight.value = sheetHeight.value;
    })
    .onUpdate((e) => {
      // Dragging down → negative translationY means dragging up
      const newHeight = startHeight.value - e.translationY;
      const maxHeight = snapPixels[snapPixels.length - 1] ?? SCREEN_HEIGHT;
      sheetHeight.value = Math.max(0, Math.min(newHeight, maxHeight + 40));
    })
    .onEnd((e) => {
      const projected = sheetHeight.value - e.velocityY * 0.15;
      snapTo(projected);
    });

  // -- Animated Styles --------------------------------------------------------

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const maxSnap = snapPixels[snapPixels.length - 1] ?? SCREEN_HEIGHT;
    return {
      opacity: interpolate(
        sheetHeight.value,
        [0, maxSnap],
        [0, 0.5],
        Extrapolation.CLAMP,
      ),
      pointerEvents: sheetHeight.value > 10 ? ('auto' as const) : ('none' as const),
    };
  });

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface.surface,
              borderTopLeftRadius: theme.borderRadius.xl,
              borderTopRightRadius: theme.borderRadius.xl,
              ...theme.shadows.lg,
            },
            sheetStyle,
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.colors.surface.border },
              ]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 999,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
