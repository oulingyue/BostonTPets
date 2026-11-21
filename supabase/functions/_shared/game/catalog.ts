// Single source of truth for the pet catalog and odds.
// Shared by the app (via the `@game/*` path alias) and the `scan` Edge Function (Deno).
// Keep this file dependency-free so it runs unchanged in both runtimes.
//
// 65 collectible ids: 5 shared commons + 30 line-exclusives + 30 line variants.
// Artwork is a placeholder emoji; swap sprites later keyed by `petId`.

export const LINES = ['red', 'orange', 'green', 'blue', 'silver'] as const;
export type Line = (typeof LINES)[number];

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const LINE_INFO: Record<Line, { name: string; color: string }> = {
  red: { name: 'Red Line', color: '#DA291C' },
  orange: { name: 'Orange Line', color: '#ED8B00' },
  green: { name: 'Green Line', color: '#00843D' },
  blue: { name: 'Blue Line', color: '#003DA5' },
  silver: { name: 'Silver Line', color: '#7C878E' },
};

export const GOLD_COLOR = '#E8B923';

/** Neutral circle for shared commons (they are never tinted with a line color). */
export const COMMON_COLOR = '#8A8175';

/** Per-creature weights on a line's table. Five commons + three rares + two epics + one legendary = 100. */
export const TIER_WEIGHT: Record<Rarity, number> = {
  common: 12,
  rare: 10,
  epic: 4,
  legendary: 2,
};

export const ODDS = {
  goldChance: 0.01,
  /** Applied only to line-specific Rare / Epic / Legendary. Commons never roll a variant. */
  lineVariantChance: 0.05,
  /** Hard pity: the Nth roll without an Epic or better is forced to Epic+. */
  pityEpicPlus: 10,
  /** Hard pity: the Nth roll without a Legendary is forced to Legendary. */
  pityLegendary: 60,
  cooldownHours: 24,
} as const;

/**
 * Booth accounts (`profiles.is_demo`): a heavier legendary on the scanned line, more gold, pity off.
 * Tier weights still sum to 100 (legendary 2 → 22, commons 12 → 8).
 */
export const DEMO_ODDS = {
  tierWeights: { common: 8, rare: 10, epic: 4, legendary: 22 } satisfies Record<Rarity, number>,
  goldChance: 0.1,
  pity: false,
} as const;

export const MAX_LEVEL = 5;

export type Creature = {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  blurb: string;
};

export type Pet = {
  petId: string;
  baseId: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  /** Null for a shared common. Set for a line-exclusive and for its line variant. */
  line: Line | null;
  isLineVariant: boolean;
  blurb: string;
};

export type LineTable = {
  commons: readonly Creature[];
  rares: readonly Creature[];
  epics: readonly Creature[];
  legendary: Creature;
};

const COMMONS: readonly Creature[] = [
  {
    id: 'mallard_duck',
    name: 'Mallard Duck',
    emoji: '🦆',
    rarity: 'common',
    blurb: 'Paddles the Charles whether the train is late or not.',
  },
  {
    id: 'canada_goose',
    name: 'Canada Goose',
    emoji: '🪿',
    rarity: 'common',
    blurb: 'Honks the Green Line to a full stop.',
  },
  {
    id: 'wild_turkey',
    name: 'Wild Turkey',
    emoji: '🦃',
    rarity: 'common',
    blurb: 'Owns the sidewalk. You are just visiting.',
  },
  {
    id: 'pigeon',
    name: 'Pigeon',
    emoji: '🐦',
    rarity: 'common',
    blurb: 'Pays no fare and rides every line.',
  },
  {
    id: 'gray_squirrel',
    name: 'Gray Squirrel',
    emoji: '🐿️',
    rarity: 'common',
    blurb: 'Caches peanuts under the platform bench.',
  },
];

const LINE_CREATURES: Record<
  Line,
  { legendary: Creature; epics: readonly Creature[]; rares: readonly Creature[] }
> = {
  red: {
    legendary: {
      id: 'lobster',
      name: 'Lobster',
      emoji: '🦞',
      rarity: 'legendary',
      blurb: 'The pride of the harbor. Wicked rare.',
    },
    epics: [
      {
        id: 'mit_beaver',
        name: 'MIT Beaver',
        emoji: '🦫',
        rarity: 'epic',
        blurb: 'Engineers the Kendall/MIT crossing.',
      },
      {
        id: 'red_tailed_hawk',
        name: 'Red-tailed Hawk',
        emoji: '🦅',
        rarity: 'epic',
        blurb: 'Circles the towers along the Red Line.',
      },
    ],
    rares: [
      {
        id: 'alewife',
        name: 'Alewife',
        emoji: '🐟',
        rarity: 'rare',
        blurb: 'Namesake of the end of the line.',
      },
      {
        id: 'northern_cardinal',
        name: 'Northern Cardinal',
        emoji: '🐦',
        rarity: 'rare',
        blurb: 'A red flash in the trees past Alewife.',
      },
      {
        id: 'raccoon',
        name: 'Raccoon',
        emoji: '🦝',
        rarity: 'rare',
        blurb: 'Works the night shift at the trash cans.',
      },
    ],
  },
  green: {
    legendary: {
      id: 'snapping_turtle',
      name: 'Snapping Turtle',
      emoji: '🐢',
      rarity: 'legendary',
      blurb: 'Slow, like the Green Line, and just as determined.',
    },
    epics: [
      {
        id: 'bu_terrier',
        name: 'BU Terrier',
        emoji: '🐕',
        rarity: 'epic',
        blurb: 'Holds down Comm Ave and the BU stops.',
      },
      {
        id: 'bc_eagle',
        name: 'BC Eagle',
        emoji: '🦅',
        rarity: 'epic',
        blurb: 'Watches the B Line from Chestnut Hill.',
      },
    ],
    rares: [
      {
        id: 'boston_terrier',
        name: 'Boston Terrier',
        emoji: '🐶',
        rarity: 'rare',
        blurb: 'The city\'s own dog, tuxedo and all.',
      },
      {
        id: 'swan',
        name: 'Swan',
        emoji: '🦢',
        rarity: 'rare',
        blurb: 'Glides the Public Garden swan boats.',
      },
      {
        id: 'bullfrog',
        name: 'Bullfrog',
        emoji: '🐸',
        rarity: 'rare',
        blurb: 'Sings at Frog Pond after the rain.',
      },
    ],
  },
  orange: {
    legendary: {
      id: 'red_fox',
      name: 'Red Fox',
      emoji: '🦊',
      rarity: 'legendary',
      blurb: 'Slips between the Orange Line pylons at dusk.',
    },
    epics: [
      {
        id: 'northeastern_husky',
        name: 'Northeastern Husky',
        emoji: '🐺',
        rarity: 'epic',
        blurb: 'Howls at Ruggles when the train arrives.',
      },
      {
        id: 'wentworth_leopard',
        name: 'Wentworth Leopard',
        emoji: '🐆',
        rarity: 'epic',
        blurb: 'Prowls the Wentworth campus at Ruggles.',
      },
    ],
    rares: [
      {
        id: 'monarch_butterfly',
        name: 'Monarch Butterfly',
        emoji: '🦋',
        rarity: 'rare',
        blurb: 'Migrates through the Southwest Corridor.',
      },
      {
        id: 'orange_tabby_cat',
        name: 'Orange Tabby Cat',
        emoji: '🐈',
        rarity: 'rare',
        blurb: 'Naps on a warm Orange Line seat.',
      },
      {
        id: 'haymarket_rat',
        name: 'Haymarket Rat',
        emoji: '🐀',
        rarity: 'rare',
        blurb: 'The unofficial mascot of Haymarket.',
      },
    ],
  },
  blue: {
    legendary: {
      id: 'humpback_whale',
      name: 'Humpback Whale',
      emoji: '🐋',
      rarity: 'legendary',
      blurb: 'Surfaces off the harbor the Blue Line points at.',
    },
    epics: [
      {
        id: 'harbor_seal',
        name: 'Harbor Seal',
        emoji: '🦭',
        rarity: 'epic',
        blurb: 'Sunbathes on the rocks of Boston Harbor.',
      },
      {
        id: 'penguin',
        name: 'Penguin',
        emoji: '🐧',
        rarity: 'epic',
        blurb: 'Waddles the Aquarium concourse.',
      },
    ],
    rares: [
      {
        id: 'blue_jay',
        name: 'Blue Jay',
        emoji: '🐦',
        rarity: 'rare',
        blurb: 'Screeches over the tracks toward Wonderland.',
      },
      {
        id: 'horseshoe_crab',
        name: 'Horseshoe Crab',
        emoji: '🦀',
        rarity: 'rare',
        blurb: 'Older than the subway, and still on time.',
      },
      {
        id: 'piping_plover',
        name: 'Piping Plover',
        emoji: '🐥',
        rarity: 'rare',
        blurb: 'Nests on the sand at Revere Beach.',
      },
    ],
  },
  silver: {
    legendary: {
      id: 'snowy_owl',
      name: 'Snowy Owl',
      emoji: '🦉',
      rarity: 'legendary',
      blurb: 'Winters on the flats by Logan.',
    },
    epics: [
      {
        id: 'atlantic_cod',
        name: 'Atlantic Cod',
        emoji: '🐟',
        rarity: 'epic',
        blurb: 'The Seaport\'s original resident.',
      },
      {
        id: 'peregrine_falcon',
        name: 'Peregrine Falcon',
        emoji: '🦅',
        rarity: 'epic',
        blurb: 'Stoops between the downtown towers.',
      },
    ],
    rares: [
      {
        id: 'herring_gull',
        name: 'Herring Gull',
        emoji: '🐦',
        rarity: 'rare',
        blurb: 'Steals fries at the waterfront stops.',
      },
      {
        id: 'striped_bass',
        name: 'Striped Bass',
        emoji: '🐠',
        rarity: 'rare',
        blurb: 'Runs the harbor the Silver Line skirts.',
      },
      {
        id: 'moon_jellyfish',
        name: 'Moon Jellyfish',
        emoji: '🪼',
        rarity: 'rare',
        blurb: 'Pulses under the pier lights.',
      },
    ],
  },
};

export const LINE_TABLE: Record<Line, LineTable> = {
  red: { commons: COMMONS, ...LINE_CREATURES.red },
  orange: { commons: COMMONS, ...LINE_CREATURES.orange },
  green: { commons: COMMONS, ...LINE_CREATURES.green },
  blue: { commons: COMMONS, ...LINE_CREATURES.blue },
  silver: { commons: COMMONS, ...LINE_CREATURES.silver },
};

/** Line-colored variant of a line-exclusive creature. Commons never use this. */
export function variantPetId(baseId: string, line: Line): string {
  return `${line}_line_${baseId}`;
}

function basePet(creature: Creature, line: Line | null): Pet {
  return {
    petId: creature.id,
    baseId: creature.id,
    name: creature.name,
    emoji: creature.emoji,
    rarity: creature.rarity,
    line,
    isLineVariant: false,
    blurb: creature.blurb,
  };
}

function variantPet(creature: Creature, line: Line): Pet {
  return {
    petId: variantPetId(creature.id, line),
    baseId: creature.id,
    name: `${LINE_INFO[line].name} ${creature.name}`,
    emoji: creature.emoji,
    rarity: creature.rarity,
    line,
    isLineVariant: true,
    blurb: creature.blurb,
  };
}

function buildCatalog(): Record<string, Pet> {
  const catalog: Record<string, Pet> = {};
  for (const creature of COMMONS) catalog[creature.id] = basePet(creature, null);
  for (const line of LINES) {
    const table = LINE_TABLE[line];
    for (const creature of [...table.rares, ...table.epics, table.legendary]) {
      catalog[creature.id] = basePet(creature, line);
      const variant = variantPet(creature, line);
      catalog[variant.petId] = variant;
    }
  }
  return catalog;
}

export const CATALOG: Record<string, Pet> = buildCatalog();

export const TOTAL_PETS = Object.keys(CATALOG).length;

export function getPet(petId: string): Pet | undefined {
  return CATALOG[petId];
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
