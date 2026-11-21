import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bostonDay, DAILY_BONUS, POINTS_DUPLICATE, POINTS_NEW, pullValues, scorePull } from './points.ts';

test('new pets score the EXP scale and duplicates score 40% of it', () => {
  assert.deepEqual(POINTS_NEW, { common: 25, rare: 50, epic: 100, legendary: 175 });
  for (const rarity of ['common', 'rare', 'epic', 'legendary'] as const) {
    assert.equal(POINTS_DUPLICATE[rarity], POINTS_NEW[rarity] * 0.4);
  }
});

test('gold doubles both values', () => {
  assert.deepEqual(pullValues('legendary', true), { newPoints: 350, duplicatePoints: 140 });
  assert.deepEqual(pullValues('common', false), { newPoints: 25, duplicatePoints: 10 });
});

test('the daily bonus is added after the gold multiplier', () => {
  assert.deepEqual(scorePull({ rarity: 'rare', isGold: true, isNew: false, firstOfDay: true }), {
    total: 20 * 2 + DAILY_BONUS,
    dailyBonus: DAILY_BONUS,
  });
  assert.deepEqual(scorePull({ rarity: 'epic', isGold: false, isNew: true, firstOfDay: false }), { total: 100, dailyBonus: 0 });
});

test('a Boston day starts at midnight Eastern, not UTC', () => {
  // 03:30 UTC on Nov 22 is still 22:30 on Nov 21 in Boston (EST, UTC-5).
  assert.equal(bostonDay(new Date('2026-11-22T03:30:00Z')), '2026-11-21');
  assert.equal(bostonDay(new Date('2026-11-22T05:30:00Z')), '2026-11-22');
  // Summer (EDT, UTC-4)
  assert.equal(bostonDay(new Date('2026-07-01T03:59:00Z')), '2026-06-30');
  assert.equal(bostonDay(new Date('2026-07-01T04:00:00Z')), '2026-07-01');
});
