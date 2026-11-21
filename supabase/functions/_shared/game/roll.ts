// Gacha roll. Runs ONLY on the server (scan Edge Function) so clients can't pick their own pets.
import { DEMO_ODDS, LINES, ODDS, SPECIES, SPECIES_INFO } from './catalog.ts';
import type { Line, Species } from './catalog.ts';

export type Rng = () => number; // returns a float in [0, 1)

export type RollResult = { species: Species; line: Line; isGold: boolean };

export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export function rollPet(
  scannedLine: Line,
  opts: { demo?: boolean } = {},
  rng: Rng = cryptoRng,
): RollResult {
  const line = rollLine(scannedLine, rng);
  const weights = opts.demo
    ? DEMO_ODDS.speciesWeights
    : (Object.fromEntries(SPECIES.map((s) => [s, SPECIES_INFO[s].weight])) as Record<Species, number>);
  const species = weightedPick(SPECIES, (s) => weights[s], rng);
  const isGold = rng() < (opts.demo ? DEMO_ODDS.goldChance : ODDS.goldChance);
  return { species, line, isGold };
}

function rollLine(scannedLine: Line, rng: Rng): Line {
  if (rng() < ODDS.scannedLineChance) return scannedLine;
  const others = LINES.filter((l) => l !== scannedLine);
  return others[Math.floor(rng() * others.length)];
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
