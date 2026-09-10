/**
 * Dominus Golf - MyCoach / MyCaddie design tokens.
 *
 * Ported from the web app's `index.css` (OKLCH) to hex for React Native,
 * which has no OKLCH support. Brand is deep charcoal + brushed gold #C5A059.
 */

import { Platform } from 'react-native';

/** Brushed gold - the single accent colour used across the whole app. */
export const GOLD = '#C5A059';

export const Colors = {
  light: {
    text: '#1C1917',
    textSecondary: '#71706B',
    textMuted: '#9C9A94',
    background: '#F7F6F4',
    card: '#FFFFFF',
    backgroundElement: '#EEEDEA',
    backgroundSelected: '#E3E1DD',
    border: '#DAD8D3',
    input: '#E5E3DF',
    primary: GOLD,
    primaryText: '#1C1917',
    accent: GOLD,
    destructive: '#C0392B',
    success: '#3F8A55',
    warning: '#C77D2E',
  },
  dark: {
    text: '#F2F0ED',
    textSecondary: '#9C9A94',
    textMuted: '#6E6C67',
    background: '#141311',
    card: '#1E1D1A',
    backgroundElement: '#2A2825',
    backgroundSelected: '#35332F',
    border: '#33312D',
    input: '#3A3833',
    primary: GOLD,
    primaryText: '#141311',
    accent: GOLD,
    destructive: '#E5645A',
    success: '#5FAE76',
    warning: '#D9974A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ColorScheme = keyof typeof Colors;

/** Chart series colours - shared across Stats, Analytics and Handicap. */
export const ChartColors = [GOLD, '#4A8FA8', '#5FAE76', '#D9974A', '#8B7BB8'] as const;

/**
 * Playfair Display is the display face on web. It is loaded at runtime via
 * expo-font; `serif` falls back to the platform serif until that resolves.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'PlayfairDisplay',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'PlayfairDisplay',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** 4pt spacing scale, matching the web app's Tailwind rhythm. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

/** Base radius is 0.4rem on web; scaled up for touch targets. */
export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
