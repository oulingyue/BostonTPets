import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXP_TO_MAX,
  PASSIVE_ACCRUAL_CAP_DAYS,
  PASSIVE_EXP_PER_DAY,
  isExpMaxed,
  levelFor,
  passiveGainForElapsed,
} from './leveling.ts';

const DAY = 86_400_000;

test('passiveGainForElapsed respects per-day rate and offline cap', () => {
  const gain = passiveGainForElapsed(2 * DAY, 1, 'common', 0);
  assert.equal(gain, 2 * PASSIVE_EXP_PER_DAY);
  const capped = passiveGainForElapsed(30 * DAY, 1, 'common', 0);
  assert.equal(capped, PASSIVE_ACCRUAL_CAP_DAYS * PASSIVE_EXP_PER_DAY);
});

test('passiveGainForElapsed stops at EXP cap and when already maxed', () => {
  assert.equal(passiveGainForElapsed(DAY, 1, 'common', 0), PASSIVE_EXP_PER_DAY);
  assert.equal(passiveGainForElapsed(DAY, 1, 'common', 80), PASSIVE_EXP_PER_DAY);
  assert.equal(passiveGainForElapsed(DAY, 1, 'common', EXP_TO_MAX - 10), 10);
  const maxedCopies = 30;
  assert.ok(isExpMaxed(maxedCopies, 'legendary', 0));
  assert.equal(passiveGainForElapsed(DAY, maxedCopies, 'legendary', 0), 0);
});

test('bonus EXP contributes to levelFor', () => {
  const dupOnly = levelFor(1, 'common', 0);
  const withPassive = levelFor(1, 'common', 50);
  assert.equal(dupOnly.level, 1);
  assert.equal(withPassive.exp, 50);
  assert.equal(levelFor(1, 'common', 100).level, 2);
});