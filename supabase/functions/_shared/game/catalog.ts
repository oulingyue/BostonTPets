// Single source of truth for the pet catalog and odds.
// Shared by the app (via the `@game/*` path alias) and the `scan` Edge Function (Deno).
// Keep this file dependency-free so it runs unchanged in both runtimes.

export const LINES = ['red', 'orange', 'green', 'blue', 'silver'] as const;
export type Line = (typeof LINES)[number];

export const SPECIES = ['duckling', 'turkey', 'seal', 'lobster'] as const;
export type Species = (typeof SPECIES)[number];

export type Rarity = 'common' | 'rare' | 'legendary';

export const LINE_INFO: Record<Line, { name: string; color: string }> = {
  red: { name: 'Red Line', color: '#DA291C' },
  orange: { name: 'Orange Line', color: '#ED8B00' },
  green: { name: 'Green Line', color: '#00843D' },
  blue: { name: 'Blue Line', color: '#003DA5' },
  silver: { name: 'Silver Line', color: '#7C878E' },
};

export const SPECIES_INFO: Record<
  Species,
  { name: string; emoji: string; rarity: Rarity; weight: number; blurb: string }
> = {
  duckling: {
    name: 'Duckling',
    emoji: '🐥',
    rarity: 'common',
    weight: 45,
    blurb: 'Waddles single-file through the Public Garden.',
  },
  turkey: {
    name: 'Wild Turkey',
    emoji: '🦃',
    rarity: 'common',
    weight: 35,
    blurb: 'Owns the sidewalk. You are just visiting.',
  },
  seal: {
    name: 'Harbor Seal',
    emoji: '🦭',
    rarity: 'rare',
    weight: 15,
    blurb: 'Sunbathes on the rocks of Boston Harbor.',
  },
  lobster: {
    name: 'Lobster',
    emoji: '🦞',
    rarity: 'legendary',
    weight: 5,
    blurb: 'The pride of the harbor. Wicked rare.',
  },
};

export const GOLD_COLOR = '#E8B923';

export const ODDS = {
  /** Chance a roll lands on the scanned code's line; the rest is split evenly across other lines. */
  scannedLineChance: 0.7,
  goldChance: 0.01,
  /** A user can scan the same code once per this many hours. */
  cooldownHours: 24,
} as const;

/** Server-side flag on demo accounts (profiles.is_demo): boosted odds and no cooldowns. */
export const DEMO_ODDS = {
  speciesWeights: { duckling: 35, turkey: 25, seal: 15, lobster: 25 } satisfies Record<Species, number>,
  goldChance: 0.1,
} as const;

export const MAX_LEVEL = 5;
export const TOTAL_PETS = LINES.length * SPECIES.length;

/** Globally unique collection slot id. Skeleton: one drawable per line × species. */
export function petId(species: Species, line: Line): string {
  return `${line}_${species}`;
}

export function petName(line: Line, species: Species): string {
  return `${LINE_INFO[line].name} ${SPECIES_INFO[species].name}`;
}

/** Level shown as stars: one per copy, capped at MAX_LEVEL. Extra copies are only counted. */
export function levelFromCopies(copies: number): number {
  return Math.min(Math.max(copies, 1), MAX_LEVEL);
}

// QR payloads look like `btp:<32 hex chars>`. IDs are random so codes can't be guessed or forged.
export const CODE_PREFIX = 'btp:';
const CODE_ID_PATTERN = /^[0-9a-f]{32}$/;

export function parseScanPayload(data: string): string | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) return null;
  const id = trimmed.slice(CODE_PREFIX.length).toLowerCase();
  return CODE_ID_PATTERN.test(id) ? id : null;
}

export function isLine(value: string): value is Line {
  return (LINES as readonly string[]).includes(value);
}

export function isSpecies(value: string): value is Species {
  return (SPECIES as readonly string[]).includes(value);
}

/** Inverse of skeleton `petId`. Returns null for full-roster ids until catalog grows. */
export function parsePetId(id: string): { species: Species; line: Line } | null {
  const sep = id.indexOf('_');
  if (sep <= 0) return null;
  const line = id.slice(0, sep);
  const species = id.slice(sep + 1);
  if (!isLine(line) || !isSpecies(species)) return null;
  return { line, species };
}
