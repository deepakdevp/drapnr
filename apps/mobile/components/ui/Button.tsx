// =============================================================================
// Button Component
// =============================================================================

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../../lib/theme';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// -----------------------------------------------------------------------------
// Animated Pressable
// -----------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  textStyle,
  onPress,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    },
    [onPress],
  );

  // -- Variant Styles ---------------------------------------------------------

  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
    primary: {
      bg: theme.colors.brand.primary,
      text: theme.colors.text.onPrimary,
      border: 'transparent',
    },
    secondary: {
      bg: theme.colors.brand.secondary,
      text: theme.colors.text.onSecondary,
      border: 'transparent',
    },
    outline: {
      bg: 'transparent',
      text: theme.colors.brand.primary,
      border: theme.colors.brand.primary,
    },
    ghost: {
      bg: 'transparent',
      text: theme.colors.text.primary,
      border: 'transparent',
    },
    danger: {
      bg: theme.colors.semantic.error,
      text: '#FFFFFF',
      border: 'transparent',
    },
  };

  // -- Size Styles ------------------------------------------------------------

  const sizeStyles: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
    sm: { height: 36, px: theme.spacing.md, fontSize: 13 },
    md: { height: 48, px: theme.spacing.lg, fontSize: 15 },
    lg: { height: 56, px: theme.spacing.xl, fontSize: 17 },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: theme.borderRadius.md,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                color: v.text,
                fontSize: s.fontSize,
                fontFamily: theme.fontFamilies.body,
                fontWeight: '600',
                marginLeft: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    textAlign: 'center',
  },
});
