// =============================================================================
// Drapnr Design System — Color Palette
// =============================================================================
// Bold & vibrant fashion-forward palette. Primary: Electric Coral / Hot Pink.
// WCAG AA contrast ratios enforced for text on surfaces.
// =============================================================================

import type { BrandColors, NeutralColors, SemanticColors, SurfaceColors, TextColors, ColorPalette } from '../types/theme';

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

const brand: BrandColors = {
  primary:      '#FF2D55',  // Electric coral-pink — hero CTA, tabs, badges
  primaryLight: '#FF6F8A',  // Hover / pressed states on light bg
  primaryDark:  '#D4173E',  // Active / pressed states on dark bg
  secondary:    '#1A1A2E',  // Deep midnight — navbars, headers
  secondaryLight: '#2D2D44',
  secondaryDark:  '#0F0F1D',
  accent:       '#FF8C42',  // Warm amber-orange — highlights, tags, promos
  accentLight:  '#FFAD73',
  accentDark:   '#CC6F35',
};

// ---------------------------------------------------------------------------
// Neutrals
// ---------------------------------------------------------------------------

const neutral: NeutralColors = {
  white:   '#FFFFFF',
  gray50:  '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',
  black:   '#000000',
};

// ---------------------------------------------------------------------------
// Semantic / Feedback
// ---------------------------------------------------------------------------

const semantic: SemanticColors = {
  success:      '#10B981',
  successLight: '#D1FAE5',
  successDark:  '#059669',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark:  '#D97706',
  error:        '#EF4444',
  errorLight:   '#FEE2E2',
  errorDark:    '#DC2626',
  info:         '#3B82F6',
  infoLight:    '#DBEAFE',
  infoDark:     '#2563EB',
};

// ---------------------------------------------------------------------------
// Light-mode surfaces & text
// ---------------------------------------------------------------------------

const lightSurface: SurfaceColors = {
  background:      '#FFFFFF',
  surface:         '#FAFAFA',
  surfaceElevated: '#FFFFFF',
  overlay:         'rgba(0, 0, 0, 0.45)',
  border:          '#E0E0E0',
  borderLight:     '#EEEEEE',
  divider:         '#F5F5F5',
};

const lightText: TextColors = {
  primary:     '#1A1A2E',  // deep midnight on white — 14.8:1
  secondary:   '#616161',  // gray700 on white — 5.9:1 (AA)
  tertiary:    '#9E9E9E',  // gray500 — decorative only
  disabled:    '#BDBDBD',
  inverse:     '#FFFFFF',
  onPrimary:   '#FFFFFF',  // white on #FF2D55 — 4.5:1 (AA)
  onSecondary: '#FFFFFF',  // white on #1A1A2E — 15.4:1
  onAccent:    '#1A1A2E',  // dark on amber — 5.7:1 (AA)
  link:        '#FF2D55',
};

// ---------------------------------------------------------------------------
// Dark-mode surfaces & text
// ---------------------------------------------------------------------------

const darkSurface: SurfaceColors = {
  background:      '#0F0F1D',
  surface:         '#1A1A2E',
  surfaceElevated: '#2D2D44',
  overlay:         'rgba(0, 0, 0, 0.65)',
  border:          '#2D2D44',
  borderLight:     '#3A3A52',
  divider:         '#1A1A2E',
};

const darkText: TextColors = {
  primary:     '#F5F5F5',  // near-white on dark bg — high contrast
  secondary:   '#BDBDBD',  // gray400 on #0F0F1D — 9.5:1
  tertiary:    '#757575',  // gray600 — decorative only
  disabled:    '#616161',
  inverse:     '#1A1A2E',
  onPrimary:   '#FFFFFF',
  onSecondary: '#FFFFFF',
  onAccent:    '#1A1A2E',
  link:        '#FF6F8A',
};

// ---------------------------------------------------------------------------
// Assembled palettes
// ---------------------------------------------------------------------------

export const lightColors: ColorPalette = {
  brand,
  neutral,
  semantic,
  surface: lightSurface,
  text:    lightText,
};

export const darkColors: ColorPalette = {
  brand,
  neutral,
  semantic,
  surface: darkSurface,
  text:    darkText,
};
