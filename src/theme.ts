// App-wide look: the pull reveal's subway station, softened. Day follows the phone's light mode and
// night its dark mode. Pixel font (Silkscreen) for titles, headings and numbers; Nunito for the rest.
//
// Styles that use colors are written as `makeStyles = (c: Palette) => StyleSheet.create({...})` and read with
// `useStyles(makeStyles)`, so every screen switches between day and night with the phone.
import { useMemo } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';

export type Palette = {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  /** Behind segmented controls and other inset areas. */
  sunken: string;
  text: string;
  muted: string;
  /** Card and control outlines. */
  border: string;
  /** The hard drop shadow under cards and buttons. */
  shadow: string;
  /** Station-sign header, tab bar and other navy chrome. */
  sign: string;
  signText: string;
  signMuted: string;
  /** Platform-edge yellow: selected states, main buttons, the scan button. */
  accent: string;
  onAccent: string;
  /** Strong button (ink in the day, yellow at night). */
  strong: string;
  onStrong: string;
  link: string;
  danger: string;
  /** Tile behind a pet the player hasn't found. */
  locked: string;
  lockedBorder: string;
  /** Highlight for the player's own row. */
  mine: string;
  input: string;
  rarity: Record<'common' | 'rare' | 'epic' | 'legendary', { bg: string; fg: string }>;
};

const SHARED = {
  accent: '#F2C53D',
  onAccent: '#10131C',
  signText: '#F3F5FA',
  signMuted: '#C9D0DE',
};

export const DAY: Palette = {
  ...SHARED,
  scheme: 'light',
  background: '#EFE9DA',
  surface: '#FBF8F0',
  sunken: '#E0D8C3',
  text: '#10131C',
  muted: '#4A5368',
  border: '#10131C',
  shadow: '#10131C',
  sign: '#121829',
  strong: '#10131C',
  onStrong: '#F3F5FA',
  link: '#003DA5',
  danger: '#B3261E',
  locked: '#D9D6CF',
  lockedBorder: '#B8B1A0',
  mine: '#FFE9A3',
  input: '#FFFFFF',
  rarity: {
    common: { bg: '#E6E0D0', fg: '#4A4F5C' },
    rare: { bg: '#E1EAF8', fg: '#003DA5' },
    epic: { bg: '#EFE5FA', fg: '#6B2FA3' },
    legendary: { bg: '#F2C230', fg: '#3D2B00' },
  },
};

export const NIGHT: Palette = {
  ...SHARED,
  scheme: 'dark',
  background: '#172038',
  surface: '#0E1424',
  sunken: '#0B101D',
  text: '#F3F5FA',
  muted: '#9AA6BF',
  border: '#2E3A58',
  shadow: '#05080F',
  sign: '#0E1424',
  strong: '#F2C53D',
  onStrong: '#10131C',
  link: '#8DB4FF',
  danger: '#FF7A6E',
  // Light enough that the black silhouette PNGs still show on it.
  locked: '#56627F',
  lockedBorder: '#6A7694',
  mine: '#3A3214',
  input: '#0B101D',
  rarity: {
    common: { bg: '#262F45', fg: '#C9D0DE' },
    rare: { bg: '#1B2A4D', fg: '#8DB4FF' },
    epic: { bg: '#2B2145', fg: '#CDB0F2' },
    legendary: { bg: '#F2C230', fg: '#3D2B00' },
  },
};

/** The palette for the phone's current light or dark mode. */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? NIGHT : DAY;
}

const styleCache = new WeakMap<object, Map<Palette, unknown>>();

/** Styles built from the current palette, cached per palette. Pass a module-level factory. */
export function useStyles<T>(factory: (c: Palette) => T): T {
  const c = usePalette();
  return useMemo(() => {
    let byPalette = styleCache.get(factory);
    if (!byPalette) styleCache.set(factory, (byPalette = new Map()));
    if (!byPalette.has(c)) byPalette.set(c, factory(c));
    return byPalette.get(c) as T;
  }, [factory, c]);
}

/**
 * Font families, one per weight (custom fonts ignore fontWeight on iOS and Android).
 * Loaded in src/app/_layout.tsx.
 */
export const fonts = {
  body: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
  pixel: 'Silkscreen_400Regular',
  pixelBold: 'Silkscreen_700Bold',
} as const;

/** Text style shortcuts. */
export const type = {
  body: { fontFamily: fonts.body } satisfies TextStyle,
  bold: { fontFamily: fonts.bold } satisfies TextStyle,
  heavy: { fontFamily: fonts.heavy } satisfies TextStyle,
  pixel: { fontFamily: fonts.pixelBold, letterSpacing: 1 } satisfies TextStyle,
};

export const radius = { sm: 10, md: 14, lg: 18 };

/** A card's hard drop shadow: a solid offset block, like the reveal panel, but only underneath. */
export function hardShadow(c: Palette, depth = 3) {
  return { boxShadow: `0px ${depth}px 0px ${c.shadow}` } as const;
}

/** The standard card: surface fill, outline, rounded corners, hard shadow. */
export function cardStyle(c: Palette) {
  return {
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: radius.md,
    ...hardShadow(c),
  } as const;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
