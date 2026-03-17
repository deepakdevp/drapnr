// =============================================================================
// Drapnr Design System — Typography
// =============================================================================
// Headings: Plus Jakarta Sans (geometric, modern, fashion-forward)
// Body:     Inter (clean, highly legible at small sizes)
// =============================================================================

import type { FontFamilies, TypographyScale } from '../types/theme';

export const fontFamilies: FontFamilies = {
  heading: 'PlusJakartaSans',
  body:    'Inter',
  mono:    'JetBrainsMono',
};

export const typography: TypographyScale = {
  h1: {
    fontFamily:    fontFamilies.heading,
    fontSize:      32,
    fontWeight:    '800',
    lineHeight:    40,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily:    fontFamilies.heading,
    fontSize:      26,
    fontWeight:    '700',
    lineHeight:    34,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily:    fontFamilies.heading,
    fontSize:      22,
    fontWeight:    '700',
    lineHeight:    28,
    letterSpacing: -0.2,
  },
  h4: {
    fontFamily:    fontFamilies.heading,
    fontSize:      18,
    fontWeight:    '600',
    lineHeight:    24,
    letterSpacing: 0,
  },
  body: {
    fontFamily:    fontFamilies.body,
    fontSize:      16,
    fontWeight:    '400',
    lineHeight:    24,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily:    fontFamilies.body,
    fontSize:      14,
    fontWeight:    '400',
    lineHeight:    20,
    letterSpacing: 0.1,
  },
  caption: {
    fontFamily:    fontFamilies.body,
    fontSize:      12,
    fontWeight:    '400',
    lineHeight:    16,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily:    fontFamilies.heading,
    fontSize:      15,
    fontWeight:    '700',
    lineHeight:    20,
    letterSpacing: 0.5,
  },
};
