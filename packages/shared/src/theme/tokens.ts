// =============================================================================
// Drapnr Design System — Miscellaneous Tokens
// =============================================================================
// Border radii, transition durations, z-index scale.
// =============================================================================

import type { BorderRadii, TransitionDurations, ZIndexScale } from '../types/theme';

export const borderRadius: BorderRadii = {
  none: 0,
  xs:   2,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl': 24,
  full: 9999,
};

export const transition: TransitionDurations = {
  instant: 0,
  fast:    150,
  normal:  250,
  slow:    400,
  slower:  600,
};

export const zIndex: ZIndexScale = {
  hide:     -1,
  base:     0,
  dropdown: 100,
  sticky:   200,
  overlay:  300,
  modal:    400,
  popover:  500,
  toast:    600,
  tooltip:  700,
  max:      9999,
};
