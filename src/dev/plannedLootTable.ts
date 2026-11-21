// The planned loot table (README "Loot table"), for the reveal playground only.
// The real game rules are being moved into supabase/functions/_shared/game/catalog.ts; once they land,
// point the playground at the catalog and delete this file.
import type { Line } from '@game/catalog';
import type { PullRarity, RevealPet } from '@/components/reveal/PullReveal';

export type PlannedCreature = { id: string; name: string; emoji: string; rarity: PullRarity };

/** Shared by every line. Commons never come in a line color. */
export const COMMONS: PlannedCreature[] = [
  { id: 'mallard', name: 'Mallard Duck', emoji: '🦆', rarity: 'common' },
  { id: 'goose', name: 'Canada Goose', emoji: '🪿', rarity: 'common' },
  { id: 'turkey', name: 'Wild Turkey', emoji: '🦃', rarity: 'common' },
  { id: 'pigeon', name: 'Pigeon', emoji: '🐦', rarity: 'common' },
  { id: 'squirrel', name: 'Gray Squirrel', emoji: '🐿️', rarity: 'common' },
];

/** Each line drops only its own creatures (plus the commons). */
export const LINE_CREATURES: Record<Line, PlannedCreature[]> = {
  red: [
    { id: 'alewife', name: 'Alewife', emoji: '🐟', rarity: 'rare' },
    { id: 'cardinal', name: 'Northern Cardinal', emoji: '🐦', rarity: 'rare' },
    { id: 'raccoon', name: 'Raccoon', emoji: '🦝', rarity: 'rare' },
    { id: 'mit-beaver', name: 'MIT Beaver', emoji: '🦫', rarity: 'epic' },
    { id: 'red-tailed-hawk', name: 'Red-tailed Hawk', emoji: '🦅', rarity: 'epic' },
    { id: 'lobster', name: 'Lobster', emoji: '🦞', rarity: 'legendary' },
  ],
  green: [
    { id: 'boston-terrier', name: 'Boston Terrier', emoji: '🐕', rarity: 'rare' },
    { id: 'swan', name: 'Swan', emoji: '🦢', rarity: 'rare' },
    { id: 'bullfrog', name: 'Bullfrog', emoji: '🐸', rarity: 'rare' },
    { id: 'bu-terrier', name: 'BU Terrier', emoji: '🐶', rarity: 'epic' },
    { id: 'bc-eagle', name: 'BC Eagle', emoji: '🦅', rarity: 'epic' },
    { id: 'snapping-turtle', name: 'Snapping Turtle', emoji: '🐢', rarity: 'legendary' },
  ],
  orange: [
    { id: 'monarch', name: 'Monarch Butterfly', emoji: '🦋', rarity: 'rare' },
    { id: 'tabby-cat', name: 'Orange Tabby Cat', emoji: '🐈', rarity: 'rare' },
    { id: 'rat', name: 'Haymarket Rat', emoji: '🐀', rarity: 'rare' },
    { id: 'nu-husky', name: 'Northeastern Husky', emoji: '🐺', rarity: 'epic' },
    { id: 'wentworth-leopard', name: 'Wentworth Leopard', emoji: '🐆', rarity: 'epic' },
    { id: 'red-fox', name: 'Red Fox', emoji: '🦊', rarity: 'legendary' },
  ],
  blue: [
    { id: 'blue-jay', name: 'Blue Jay', emoji: '🐦', rarity: 'rare' },
    { id: 'horseshoe-crab', name: 'Horseshoe Crab', emoji: '🦀', rarity: 'rare' },
    { id: 'piping-plover', name: 'Piping Plover', emoji: '🐤', rarity: 'rare' },
    { id: 'seal', name: 'Harbor Seal', emoji: '🦭', rarity: 'epic' },
    { id: 'penguin', name: 'Penguin', emoji: '🐧', rarity: 'epic' },
    { id: 'humpback-whale', name: 'Humpback Whale', emoji: '🐋', rarity: 'legendary' },
  ],
  silver: [
    { id: 'herring-gull', name: 'Herring Gull', emoji: '🕊️', rarity: 'rare' },
    { id: 'striped-bass', name: 'Striped Bass', emoji: '🐟', rarity: 'rare' },
    { id: 'moon-jellyfish', name: 'Moon Jellyfish', emoji: '🪼', rarity: 'rare' },
    { id: 'atlantic-cod', name: 'Atlantic Cod', emoji: '🐠', rarity: 'epic' },
    { id: 'peregrine-falcon', name: 'Peregrine Falcon', emoji: '🦅', rarity: 'epic' },
    { id: 'snowy-owl', name: 'Snowy Owl', emoji: '🦉', rarity: 'legendary' },
  ],
};

/** Chance of each individual creature, per pull. Totals: common 60%, rare 30%, epic 8%, legendary 2%. */
export const CHANCE_EACH: Record<PullRarity, number> = { common: 0.12, rare: 0.1, epic: 0.04, legendary: 0.02 };
/** A line's own creatures come in the line color this often. */
export const VARIANT_CHANCE = 0.05;

export const DEMO_STATIONS: Record<Line, string> = {
  red: 'Kendall/MIT',
  green: 'Park Street',
  orange: 'Ruggles',
  blue: 'Aquarium',
  silver: 'Airport',
};

export function creaturesFor(line: Line): PlannedCreature[] {
  return [...COMMONS, ...LINE_CREATURES[line]];
}

/** A pull with the planned odds. Preview only: real pulls are rolled on the server. */
export function rollPlanned(line: Line, random: () => number = Math.random): RevealPet {
  const pool = creaturesFor(line);
  let target = random() * pool.reduce((sum, c) => sum + CHANCE_EACH[c.rarity], 0);
  const picked = pool.find((c) => (target -= CHANCE_EACH[c.rarity]) < 0) ?? pool[pool.length - 1];
  const isVariant = picked.rarity !== 'common' && random() < VARIANT_CHANCE;
  return { ...picked, isVariant };
}
