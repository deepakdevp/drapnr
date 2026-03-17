// =============================================================================
// EmptyState Component
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Button, type ButtonProps } from './Button';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Icon or illustration element rendered at the top. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Optional CTA button. */
  actionTitle?: string;
  actionVariant?: ButtonProps['variant'];
  onAction?: () => void;
  style?: ViewStyle;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  actionTitle,
  actionVariant = 'primary',
  onAction,
  style,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      {/* Icon / Illustration */}
      {icon && <View style={styles.iconContainer}>{icon}</View>}

      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.text.primary,
            fontFamily: theme.fontFamilies.heading,
            fontSize: theme.typography.h3.fontSize,
            fontWeight: theme.typography.h3.fontWeight as TextStyle['fontWeight'],
          },
        ]}
      >
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text
          style={[
            styles.description,
            {
              color: theme.colors.text.secondary,
              fontFamily: theme.fontFamilies.body,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            },
          ]}
        >
          {description}
        </Text>
      )}

      {/* CTA */}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          variant={actionVariant}
          onPress={onAction}
          style={styles.action}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Types (for fontWeight cast)
// -----------------------------------------------------------------------------

type TextStyle = { fontWeight?: string };

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: 24,
  },
});
