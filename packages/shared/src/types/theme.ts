// =============================================================================
// Drapnr Design System — Theme Types
// =============================================================================

/** Individual color value as hex string */
export type ColorValue = string;

/** Core brand color scale */
export interface BrandColors {
  primary: ColorValue;
  primaryLight: ColorValue;
  primaryDark: ColorValue;
  secondary: ColorValue;
  secondaryLight: ColorValue;
  secondaryDark: ColorValue;
  accent: ColorValue;
  accentLight: ColorValue;
  accentDark: ColorValue;
}

/** Neutral palette */
export interface NeutralColors {
  white: ColorValue;
  gray50: ColorValue;
  gray100: ColorValue;
  gray200: ColorValue;
  gray300: ColorValue;
  gray400: ColorValue;
  gray500: ColorValue;
  gray600: ColorValue;
  gray700: ColorValue;
  gray800: ColorValue;
  gray900: ColorValue;
  black: ColorValue;
}

/** Semantic / feedback colors */
export interface SemanticColors {
  success: ColorValue;
  successLight: ColorValue;
  successDark: ColorValue;
  warning: ColorValue;
  warningLight: ColorValue;
  warningDark: ColorValue;
  error: ColorValue;
  errorLight: ColorValue;
  errorDark: ColorValue;
  info: ColorValue;
  infoLight: ColorValue;
  infoDark: ColorValue;
}

/** Surface & background tokens (mode-aware) */
export interface SurfaceColors {
  background: ColorValue;
  surface: ColorValue;
  surfaceElevated: ColorValue;
  overlay: ColorValue;
  border: ColorValue;
  borderLight: ColorValue;
  divider: ColorValue;
}

/** Text tokens (mode-aware) */
export interface TextColors {
  primary: ColorValue;
  secondary: ColorValue;
  tertiary: ColorValue;
  disabled: ColorValue;
  inverse: ColorValue;
  onPrimary: ColorValue;
  onSecondary: ColorValue;
  onAccent: ColorValue;
  link: ColorValue;
}

/** Complete color palette for a given mode */
export interface ColorPalette {
  brand: BrandColors;
  neutral: NeutralColors;
  semantic: SemanticColors;
  surface: SurfaceColors;
  text: TextColors;
}

// -----------------------------------------------------------------------------
// Typography
// -----------------------------------------------------------------------------

export type FontFamily = string;

export interface FontFamilies {
  heading: FontFamily;
  body: FontFamily;
  mono: FontFamily;
}

export interface TypographyVariant {
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
}

export interface TypographyScale {
  h1: TypographyVariant;
  h2: TypographyVariant;
  h3: TypographyVariant;
  h4: TypographyVariant;
  body: TypographyVariant;
  bodySmall: TypographyVariant;
  caption: TypographyVariant;
  button: TypographyVariant;
}

// -----------------------------------------------------------------------------
// Spacing
// -----------------------------------------------------------------------------

export interface SpacingScale {
  /** 2px */  xxs: number;
  /** 4px */  xs: number;
  /** 8px */  sm: number;
  /** 12px */ md: number;
  /** 16px */ base: number;
  /** 20px */ lg: number;
  /** 24px */ xl: number;
  /** 32px */ '2xl': number;
  /** 40px */ '3xl': number;
  /** 48px */ '4xl': number;
  /** 64px */ '5xl': number;
}

// -----------------------------------------------------------------------------
// Shadows
// -----------------------------------------------------------------------------

export interface ShadowValue {
  shadowColor: ColorValue;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ShadowScale {
  sm: ShadowValue;
  md: ShadowValue;
  lg: ShadowValue;
  xl: ShadowValue;
}

// -----------------------------------------------------------------------------
// Tokens (misc)
// -----------------------------------------------------------------------------

export interface BorderRadii {
  none: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  full: number;
}

export interface TransitionDurations {
  instant: number;
  fast: number;
  normal: number;
  slow: number;
  slower: number;
}

export interface ZIndexScale {
  hide: number;
  base: number;
  dropdown: number;
  sticky: number;
  overlay: number;
  modal: number;
  popover: number;
  toast: number;
  tooltip: number;
  max: number;
}

export interface MiscTokens {
  borderRadius: BorderRadii;
  transition: TransitionDurations;
  zIndex: ZIndexScale;
}

// -----------------------------------------------------------------------------
// Theme (combined)
// -----------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: ColorPalette;
  typography: TypographyScale;
  fontFamilies: FontFamilies;
  spacing: SpacingScale;
  shadows: ShadowScale;
  borderRadius: BorderRadii;
  transition: TransitionDurations;
  zIndex: ZIndexScale;
}
