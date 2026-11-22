import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXP_PER_DUPLICATE, EXP_TO_NEXT, LEVEL_CAP, levelFor, pullProgress } from './leveling.ts';

test('a new pet starts at level 1 with no EXP', () => {
  assert.deepEqual(levelFor(1, 'common'), { level: 1, exp: 0, expToNext: 100, isMax: false });
});

test('duplicates add EXP by rarity and carry the remainder into the next level', () => {
  // legendary: one duplicate = 175 EXP -> level 2 with 75 of 150
  assert.deepEqual(levelFor(2, 'legendary'), { level: 2, exp: 75, expToNext: 150, isMax: false });
  // common: 4 duplicates = 100 EXP -> exactly level 2
  assert.deepEqual(levelFor(5, 'common'), { level: 2, exp: 0, expToNext: 150, isMax: false });
  assert.deepEqual(levelFor(4, 'common'), { level: 1, exp: 75, expToNext: 100, isMax: false });
});

test('the cap is reached at the total of every step, and extra copies stay maxed', () => {
  const total = EXP_TO_NEXT.reduce((a, b) => a + b, 0);
  for (const rarity of ['common', 'rare', 'epic', 'legendary'] as const) {
    const copiesToMax = Math.ceil(total / EXP_PER_DUPLICATE[rarity]) + 1;
    assert.equal(levelFor(copiesToMax, rarity).isMax, true, rarity);
    assert.equal(levelFor(copiesToMax - 1, rarity).isMax, false, rarity);
    assert.equal(levelFor(copiesToMax + 10, rarity).level, LEVEL_CAP);
  }
});

test('pullProgress reports new pets, plain duplicates, level-ups, and maxed pets', () => {
  assert.deepEqual(pullProgress(1, 'rare'), { before: null, after: levelFor(1, 'rare'), gained: 0, levelsGained: 0 });
  const plain = pullProgress(3, 'common');
  assert.equal(plain.gained, 25);
  assert.equal(plain.levelsGained, 0);
  const levelUp = pullProgress(2, 'epic');
  assert.equal(levelUp.levelsGained, 1);
  assert.equal(levelUp.after.level, 2);
  const maxed = pullProgress(20, 'legendary');
  assert.equal(maxed.before?.isMax, true);
  assert.equal(maxed.gained, 0);
  assert.equal(maxed.levelsGained, 0);
});

test('bonus EXP stacks on duplicate EXP for levels', () => {
  assert.equal(levelFor(1, 'common', 75).exp, 75);
  assert.equal(levelFor(2, 'common', 0).exp, 25);
  const boosted = levelFor(2, 'common', 75);
  assert.equal(boosted.level, 2);
  assert.equal(boosted.exp, 0);
});
