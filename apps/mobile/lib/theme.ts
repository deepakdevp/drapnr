// =============================================================================
// Theme utilities for mobile app
// =============================================================================
// Re-exports the shared design system and provides React context helpers.
// =============================================================================

import { createContext, useContext } from 'react';

import type { Theme } from '@drapnr/shared/src/types/theme';
import { lightTheme, darkTheme } from '@drapnr/shared/src/theme';

export { lightTheme, darkTheme };
export type { Theme };

// ---------------------------------------------------------------------------
// Theme Context
// ---------------------------------------------------------------------------

export const ThemeContext = createContext<Theme>(lightTheme);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
