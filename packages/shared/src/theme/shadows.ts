// =============================================================================
// Drapnr Design System — Shadow Tokens
// =============================================================================
// React Native compatible shadow values + Android elevation.
// =============================================================================

import type { ShadowScale } from '../types/theme';

export const shadows: ShadowScale = {
  sm: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation:     1,
  },
  md: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  6,
    elevation:     3,
  },
  lg: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    elevation:     6,
  },
  xl: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius:  24,
    elevation:     12,
  },
};
