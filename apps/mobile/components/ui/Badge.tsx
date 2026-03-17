// =============================================================================
// Badge Component
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import type { SubscriptionTier } from '../../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'pro' | 'plus' | 'free';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export interface TierBadgeProps {
  tier: SubscriptionTier;
  style?: ViewStyle;
}

// -----------------------------------------------------------------------------
// Color Map
// -----------------------------------------------------------------------------

function useVariantColors(variant: BadgeVariant) {
  const theme = useTheme();

  const map: Record<BadgeVariant, { bg: string; text: string }> = {
    primary: { bg: theme.colors.brand.primaryLight, text: theme.colors.brand.primaryDark },
    success: { bg: theme.colors.semantic.successLight, text: theme.colors.semantic.successDark },
    warning: { bg: theme.colors.semantic.warningLight, text: theme.colors.semantic.warningDark },
    pro: { bg: '#1A1A2E', text: '#E0C097' },
    plus: { bg: '#312E81', text: '#A5B4FC' },
    free: { bg: theme.colors.neutral.gray100, text: theme.colors.neutral.gray600 },
  };

  return map[variant];
}

// -----------------------------------------------------------------------------
// Badge
// -----------------------------------------------------------------------------

export function Badge({ label, variant = 'primary', style, textStyle }: BadgeProps) {
  const theme = useTheme();
  const colors = useVariantColors(variant);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderRadius: theme.borderRadius.full,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontFamily: theme.fontFamilies.body,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// TierBadge
// -----------------------------------------------------------------------------

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
};

const TIER_VARIANTS: Record<SubscriptionTier, BadgeVariant> = {
  free: 'free',
  plus: 'plus',
  pro: 'pro',
};

export function TierBadge({ tier, style }: TierBadgeProps) {
  return <Badge label={TIER_LABELS[tier]} variant={TIER_VARIANTS[tier]} style={style} />;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
