// Gacha roll. Runs ONLY on the server (scan Edge Function) so clients can't pick their own pets.
//
// Pity (hard, not soft), counted on the base rarity. Line variants and gold do not change it.
// Counters are rolls *since* the last qualifying hit, read before this roll:
//   - Legendary (natural or pity) → both counters reset to 0.
//   - Epic → sinceEpicPlus = 0, sinceLegendary += 1.
//   - Rare or common → both counters += 1.
// Legendary pity wins if both guarantees are due on the same roll.
// `ODDS.pityEpicPlus` / `pityLegendary` are the roll number that is forced (10th miss, 60th miss),
// so the check is `since >= N - 1`. Demo accounts skip both guarantees (`DEMO_ODDS.pity`).
// Epic pity draws the line's two epics and legendary at 4:4:2, so some "epic+" guarantees are
// legendaries. That pulls the average wait below the naive E[min(Geo(0.02), 60)] ≈ 35; with both
// guarantees it lands near 28 rolls (see roll.test.ts).
//
// A line roll never leaves that line's table. A line-specific creature then has
// `ODDS.lineVariantChance` to drop as `{line}_line_{baseId}`.

import {
  DEMO_ODDS,
  LINE_TABLE,
  ODDS,
  TIER_WEIGHT,
  variantPetId,
  type Line,
  type Rarity,
} from './catalog.ts';

export type Rng = () => number; // returns a float in [0, 1)

export type PityState = { sinceEpicPlus: number; sinceLegendary: number };

export type RollResult = {
  petId: string;
  isGold: boolean;
  isLineVariant: boolean;
  nextPity: PityState;
};

export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

const EMPTY_PITY: PityState = { sinceEpicPlus: 0, sinceLegendary: 0 };

type Picked = { id: string; rarity: Rarity };

export function rollPet(
  scannedLine: Line,
  opts: { demo?: boolean; pity?: PityState } = {},
  rng: Rng = cryptoRng,
): RollResult {
  const demo = opts.demo === true;
  const pity = opts.pity ?? EMPTY_PITY;
  const usePity = demo ? DEMO_ODDS.pity : true;
  const picked = pickCreature(scannedLine, pity, usePity, demo, rng);

  let petId = picked.id;
  let isLineVariant = false;
  if (picked.rarity !== 'common' && rng() < ODDS.lineVariantChance) {
    petId = variantPetId(picked.id, scannedLine);
    isLineVariant = true;
  }

  const isGold = rng() < (demo ? DEMO_ODDS.goldChance : ODDS.goldChance);
  return { petId, isGold, isLineVariant, nextPity: advancePity(pity, picked.rarity) };
}

function pickCreature(line: Line, pity: PityState, usePity: boolean, demo: boolean, rng: Rng): Picked {
  const table = LINE_TABLE[line];
  if (usePity && pity.sinceLegendary >= ODDS.pityLegendary - 1) {
    return { id: table.legendary.id, rarity: 'legendary' };
  }
  if (usePity && pity.sinceEpicPlus >= ODDS.pityEpicPlus - 1) {
    const pool: Picked[] = [
      ...table.epics.map((creature) => ({ id: creature.id, rarity: 'epic' as const })),
      { id: table.legendary.id, rarity: 'legendary' },
    ];
    return weightedPick(pool, (row) => TIER_WEIGHT[row.rarity], rng);
  }

  const rows: Picked[] = [
    ...table.commons.map((creature) => ({ id: creature.id, rarity: creature.rarity })),
    ...table.rares.map((creature) => ({ id: creature.id, rarity: creature.rarity })),
    ...table.epics.map((creature) => ({ id: creature.id, rarity: creature.rarity })),
    { id: table.legendary.id, rarity: table.legendary.rarity },
  ];
  const weightOf = (row: Picked) => (demo ? DEMO_ODDS.tierWeights[row.rarity] : TIER_WEIGHT[row.rarity]);
  return weightedPick(rows, weightOf, rng);
}

function advancePity(prev: PityState, rarity: Rarity): PityState {
  if (rarity === 'legendary') return { sinceEpicPlus: 0, sinceLegendary: 0 };
  if (rarity === 'epic') return { sinceEpicPlus: 0, sinceLegendary: prev.sinceLegendary + 1 };
  return { sinceEpicPlus: prev.sinceEpicPlus + 1, sinceLegendary: prev.sinceLegendary + 1 };
}

function weightedPick<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let target = rng() * total;
  for (const item of items) {
    target -= weightOf(item);
    if (target < 0) return item;
  }
  return items[items.length - 1];
}
