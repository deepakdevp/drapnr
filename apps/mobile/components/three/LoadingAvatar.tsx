// =============================================================================
// Drapnr — Loading Placeholder for 3D Avatar
// =============================================================================

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

// -----------------------------------------------------------------------------
// Colors (Drapnr palette)
// -----------------------------------------------------------------------------

const COLORS = {
  shimmerBase: '#E8E8E8',
  shimmerHighlight: '#F8F9FA',
  surface: '#F8F9FA',
} as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface LoadingAvatarProps {
  width?: number;
  height?: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LoadingAvatar({
  width = 280,
  height = 420,
}: LoadingAvatarProps): React.JSX.Element {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true, // reverse
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.container, { width, height }]}>
      <Animated.View style={[styles.silhouette, pulseStyle, { width, height }]}>
        {/* Head */}
        <View style={styles.head} />

        {/* Neck */}
        <View style={styles.neck} />

        {/* Torso (top garment area) */}
        <View style={styles.torso} />

        {/* Arms */}
        <View style={styles.armsRow}>
          <View style={styles.arm} />
          <View style={styles.armSpacer} />
          <View style={styles.arm} />
        </View>

        {/* Waist divider */}
        <View style={styles.waistLine} />

        {/* Legs (bottom garment area) */}
        <View style={styles.legsRow}>
          <View style={styles.leg} />
          <View style={styles.legGap} />
          <View style={styles.leg} />
        </View>

        {/* Feet (shoes area) */}
        <View style={styles.feetRow}>
          <View style={styles.foot} />
          <View style={styles.footGap} />
          <View style={styles.foot} />
        </View>
      </Animated.View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  head: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.shimmerBase,
  },
  neck: {
    width: 18,
    height: 12,
    backgroundColor: COLORS.shimmerBase,
    marginTop: 2,
  },
  torso: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: COLORS.shimmerBase,
    marginTop: 4,
  },
  armsRow: {
    flexDirection: 'row',
    position: 'absolute',
    top: 90,
    width: 160,
    justifyContent: 'space-between',
  },
  arm: {
    width: 22,
    height: 80,
    borderRadius: 11,
    backgroundColor: COLORS.shimmerBase,
  },
  armSpacer: {
    flex: 1,
  },
  waistLine: {
    width: 80,
    height: 2,
    backgroundColor: COLORS.shimmerHighlight,
    marginTop: 4,
  },
  legsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  leg: {
    width: 34,
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.shimmerBase,
  },
  legGap: {
    width: 10,
  },
  feetRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  foot: {
    width: 38,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.shimmerBase,
  },
  footGap: {
    width: 6,
  },
});

export default LoadingAvatar;
