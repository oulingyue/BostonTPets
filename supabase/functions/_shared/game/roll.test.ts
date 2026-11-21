// Run with: npm run test:game  (Node strips the TypeScript types natively)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATALOG,
  DEMO_ODDS,
  getPet,
  LINE_TABLE,
  LINES,
  parseScanPayload,
  TIER_WEIGHT,
  TOTAL_PETS,
  type Line,
  type Rarity,
} from './catalog.ts';
import { rollPet, type PityState, type Rng } from './roll.ts';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seq(values: number[]): Rng {
  return () => values.shift() ?? 0.5;
}

const FRESH: PityState = { sinceEpicPlus: 0, sinceLegendary: 0 };

test('catalog has 35 unique pets and no line-colored variants', () => {
  const ids = Object.keys(CATALOG);
  assert.equal(ids.length, 35);
  assert.equal(TOTAL_PETS, 35);
  assert.equal(new Set(ids).size, 35);

  for (const id of ids) {
    const pet = getPet(id);
    assert.ok(pet);
    assert.equal(pet.petId, id);
    assert.equal(id.includes('_line_'), false);
  }

  for (const line of LINES) {
    const table = LINE_TABLE[line];
    assert.equal(table.commons.length, 5);
    assert.equal(table.rares.length, 3);
    assert.equal(table.epics.length, 2);
    assert.equal(table.legendary.rarity, 'legendary');
    assert.equal(table.commons.reduce((sum, c) => sum + TIER_WEIGHT[c.rarity], 0)
      + table.rares.length * TIER_WEIGHT.rare
      + table.epics.length * TIER_WEIGHT.epic
      + TIER_WEIGHT.legendary, 100);

    for (const creature of table.commons) {
      assert.equal(getPet(creature.id)?.line, null);
    }
    for (const creature of [...table.rares, ...table.epics, table.legendary]) {
      const pet = getPet(creature.id);
      assert.equal(pet?.line, line);
      assert.equal(pet?.rarity, creature.rarity);
      assert.equal(pet?.name, creature.name);
    }
  }

  assert.equal(getPet('red_line_alewife'), undefined);
  assert.equal(getPet('alewife')?.name, 'Alewife');
  assert.equal(getPet('mallard_duck')?.name, 'Mallard Duck');
});

test('base rates ignore pity and stay on the scanned line', () => {
  const rng = mulberry32(42);
  const n = 200_000;
  const tiers: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  let gold = 0;
  for (let i = 0; i < n; i++) {
    const roll = rollPet('red', { pity: FRESH }, rng);
    const pet = getPet(roll.petId);
    assert.ok(pet);
    assert.ok(pet.line === null || pet.line === 'red');
    tiers[pet.rarity]++;
    if (roll.isGold) gold++;
  }
  const near = (actual: number, expected: number, tol = 0.01) =>
    assert.ok(Math.abs(actual / n - expected) < tol, `${actual / n} vs ${expected}`);
  near(tiers.common, 0.6);
  near(tiers.rare, 0.3);
  near(tiers.epic, 0.08, 0.005);
  near(tiers.legendary, 0.02, 0.003);
  near(gold, 0.01, 0.002);
});

test('demo accounts boost legendary and gold and ignore pity', () => {
  const rng = mulberry32(7);
  const n = 80_000;
  let legendary = 0;
  let gold = 0;
  const stuck: PityState = { sinceEpicPlus: 9, sinceLegendary: 59 };
  for (let i = 0; i < n; i++) {
    const roll = rollPet('blue', { demo: true, pity: stuck }, rng);
    if (getPet(roll.petId)?.rarity === 'legendary') legendary++;
    if (roll.isGold) gold++;
  }
  const legendaryRate = DEMO_ODDS.tierWeights.legendary / 100;
  assert.ok(Math.abs(legendary / n - legendaryRate) < 0.01, `${legendary / n} vs ${legendaryRate}`);
  assert.ok(Math.abs(gold / n - DEMO_ODDS.goldChance) < 0.01);
});

test('epic+ pity fires on the 10th miss and an epic resets only that counter', () => {
  let pity: PityState = { sinceEpicPlus: 0, sinceLegendary: 0 };
  for (let i = 0; i < 9; i++) {
    const roll = rollPet('red', { pity }, () => 0);
    const pet = getPet(roll.petId);
    assert.ok(pet);
    assert.ok(pet.rarity === 'common' || pet.rarity === 'rare');
    pity = roll.nextPity;
  }
  assert.deepEqual(pity, { sinceEpicPlus: 9, sinceLegendary: 9 });

  const forced = rollPet('green', { pity }, seq([0.5, 0.99, 0.99]));
  const forcedPet = getPet(forced.petId);
  assert.equal(forcedPet?.rarity, 'epic');
  assert.equal(forcedPet?.line, 'green');
  assert.equal(forced.isGold, false);
  assert.deepEqual(forced.nextPity, { sinceEpicPlus: 0, sinceLegendary: 10 });
});

test('legendary pity fires on the 60th miss and resets both counters', () => {
  const roll = rollPet('silver', { pity: { sinceEpicPlus: 9, sinceLegendary: 59 } }, seq([0.99]));
  const pet = getPet(roll.petId);
  assert.equal(pet?.rarity, 'legendary');
  assert.equal(pet?.petId, 'snowy_owl');
  assert.equal(roll.isGold, false);
  assert.deepEqual(roll.nextPity, { sinceEpicPlus: 0, sinceLegendary: 0 });
});

test('a natural legendary resets both counters and a natural epic resets only epic+', () => {
  const legendary = rollPet('red', { pity: { sinceEpicPlus: 4, sinceLegendary: 7 } }, seq([0.99, 0.5, 0.5]));
  assert.equal(getPet(legendary.petId)?.rarity, 'legendary');
  assert.equal(legendary.petId, 'lobster');
  assert.deepEqual(legendary.nextPity, { sinceEpicPlus: 0, sinceLegendary: 0 });

  const epic = rollPet('orange', { pity: { sinceEpicPlus: 3, sinceLegendary: 5 } }, seq([0.95, 0.99, 0.99]));
  assert.equal(getPet(epic.petId)?.rarity, 'epic');
  assert.equal(epic.petId, 'wentworth_leopard');
  assert.deepEqual(epic.nextPity, { sinceEpicPlus: 0, sinceLegendary: 6 });
});

test('pity legendary rate averages about one every 28 rolls', () => {
  const rng = mulberry32(99);
  const trials = 4_000;
  let total = 0;
  for (let t = 0; t < trials; t++) {
    let pity: PityState = { sinceEpicPlus: 0, sinceLegendary: 0 };
    for (let rolls = 1; ; rolls++) {
      const roll = rollPet('green', { pity }, rng);
      if (getPet(roll.petId)?.rarity === 'legendary') {
        total += rolls;
        break;
      }
      pity = roll.nextPity;
    }
  }
  const mean = total / trials;
  // Epic pity (weights 4:4:2) hands out extra legendaries, so this is under the naive ~35.
  assert.ok(Math.abs(mean - 28.4) < 1.5, `mean ${mean}`);
});

test('parseScanPayload accepts only btp: codes with a 32-hex id', () => {
  const id = '0123456789abcdef0123456789abcdef';
  assert.equal(parseScanPayload(`btp:${id}`), id);
  assert.equal(parseScanPayload(`  btp:${id.toUpperCase()} `), id);
  assert.equal(parseScanPayload('btp:park-street-red'), null);
  assert.equal(parseScanPayload('https://example.com'), null);
});
