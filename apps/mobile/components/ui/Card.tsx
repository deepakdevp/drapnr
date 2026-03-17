// =============================================================================
// Card Component
// =============================================================================

import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '../../lib/theme';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export interface PressableCardProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: ViewStyle;
}

export interface ImageCardProps extends Omit<PressableProps, 'style'> {
  imageUrl: string;
  imageHeight?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
}

// -----------------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------------

export function Card({ children, style }: CardProps) {
  const theme = useTheme();
  const shadow = theme.shadows.md;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surface.surface,
          borderRadius: theme.borderRadius.lg,
          ...shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// -----------------------------------------------------------------------------
// PressableCard
// -----------------------------------------------------------------------------

export function PressableCard({ children, style, ...rest }: PressableCardProps) {
  const theme = useTheme();
  const shadow = theme.shadows.md;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.surface.surface,
          borderRadius: theme.borderRadius.lg,
          opacity: pressed ? 0.85 : 1,
          ...shadow,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// ImageCard
// -----------------------------------------------------------------------------

export function ImageCard({
  imageUrl,
  imageHeight = 180,
  children,
  style,
  ...rest
}: ImageCardProps) {
  const theme = useTheme();
  const shadow = theme.shadows.md;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.surface.surface,
          borderRadius: theme.borderRadius.lg,
          opacity: pressed ? 0.85 : 1,
          overflow: 'hidden',
          ...shadow,
        },
        style,
      ]}
      {...rest}
    >
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { height: imageHeight }]}
        contentFit="cover"
        transition={200}
        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
      />
      {children && <View style={styles.imageContent}>{children}</View>}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    padding: 16,
  },
  image: {
    width: '100%',
    marginTop: -16,
    marginLeft: -16,
    marginRight: -16,
    // Compensate for the negative margins on width
    // Width is handled by the parent container; use alignSelf stretch
  },
  imageContent: {
    paddingTop: 12,
  },
});
