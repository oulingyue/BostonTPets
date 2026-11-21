// Run with: npm run test:game  (Node strips the TypeScript types natively)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePetId, parseScanPayload, petId } from './catalog.ts';
import { rollPet } from './roll.ts';

// Deterministic PRNG so the distribution test is stable.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('roll distribution matches the configured odds', () => {
  const rng = mulberry32(42);
  const n = 200_000;
  let sameLine = 0;
  let gold = 0;
  const species: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const r = rollPet('green', {}, rng);
    if (r.line === 'green') sameLine++;
    if (r.isGold) gold++;
    species[r.species] = (species[r.species] ?? 0) + 1;
  }
  const near = (actual: number, expected: number, tol = 0.01) =>
    assert.ok(Math.abs(actual / n - expected) < tol, `${actual / n} vs ${expected}`);
  near(sameLine, 0.7);
  near(gold, 0.01, 0.002);
  near(species.duckling, 0.45);
  near(species.turkey, 0.35);
  near(species.seal, 0.15);
  near(species.lobster, 0.05, 0.005);
});

test('off-line rolls never land on the scanned line', () => {
  // First rng() call >= 0.7 forces an off-line roll.
  const values = [0.99, 0.0, 0.5, 0.5];
  const r = rollPet('blue', {}, () => values.shift() ?? 0.5);
  assert.notEqual(r.line, 'blue');
});

test('demo accounts get boosted lobster odds', () => {
  const rng = mulberry32(7);
  let lobsters = 0;
  for (let i = 0; i < 50_000; i++) if (rollPet('red', { demo: true }, rng).species === 'lobster') lobsters++;
  assert.ok(Math.abs(lobsters / 50_000 - 0.25) < 0.01);
});

test('petId and parsePetId round-trip skeleton slots', () => {
  assert.equal(petId('lobster', 'red'), 'red_lobster');
  assert.deepEqual(parsePetId('green_duckling'), { line: 'green', species: 'duckling' });
  assert.equal(parsePetId('mallard_duck'), null);
});

test('parseScanPayload accepts only btp: codes with a 32-hex id', () => {
  const id = '0123456789abcdef0123456789abcdef';
  assert.equal(parseScanPayload(`btp:${id}`), id);
  assert.equal(parseScanPayload(`  btp:${id.toUpperCase()} `), id);
  assert.equal(parseScanPayload('btp:park-street-red'), null);
  assert.equal(parseScanPayload('https://example.com'), null);
});
