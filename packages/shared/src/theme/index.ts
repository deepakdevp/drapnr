// =============================================================================
// Drapnr Design System — Theme Entry Point
// =============================================================================
// Exports assembled light & dark theme objects.
// =============================================================================

import type { Theme } from '../types/theme';
import { lightColors, darkColors } from './colors';
import { typography, fontFamilies } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';
import { borderRadius, transition, zIndex } from './tokens';

// ---------------------------------------------------------------------------
// Light Theme (default)
// ---------------------------------------------------------------------------

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  typography,
  fontFamilies,
  spacing,
  shadows,
  borderRadius,
  transition,
  zIndex,
};

// ---------------------------------------------------------------------------
// Dark Theme
// ---------------------------------------------------------------------------

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  typography,
  fontFamilies,
  spacing,
  shadows,
  borderRadius,
  transition,
  zIndex,
};

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { lightColors, darkColors } from './colors';
export { typography, fontFamilies } from './typography';
export { spacing } from './spacing';
export { shadows } from './shadows';
export { borderRadius, transition, zIndex } from './tokens';
export type { Theme, ThemeMode, ColorPalette } from '../types/theme';
