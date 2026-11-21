// Leveling: every duplicate gives EXP, and EXP fills levels up to the cap.
// Level and EXP are derived from `copies` (user_pets.copies), so the database doesn't store anything new.
// Self-contained (no imports) so the app, the scan Edge Function, and tests can all use it.

export type LevelRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** EXP one duplicate gives. Rarer pets turn up less often, so each copy is worth more. */
export const EXP_PER_DUPLICATE: Record<LevelRarity, number> = { common: 25, rare: 50, epic: 100, legendary: 175 };

/** EXP needed for each level-up: level 1 -> 2 needs 100, and so on. 4 steps = max level 5 (MAX_LEVEL in catalog.ts). */
export const EXP_TO_NEXT: readonly number[] = [100, 150, 200, 250];
export const LEVEL_CAP = EXP_TO_NEXT.length + 1;

export type LevelState = {
  level: number;
  /** EXP into the current level. */
  exp: number;
  /** EXP the current level needs (0 at the cap). */
  expToNext: number;
  isMax: boolean;
};

/** Level and EXP for a pet you own `copies` of (1 = just caught). */
export function levelFor(copies: number, rarity: LevelRarity): LevelState {
  let exp = Math.max(0, copies - 1) * EXP_PER_DUPLICATE[rarity];
  let level = 1;
  for (const need of EXP_TO_NEXT) {
    if (exp < need) return { level, exp, expToNext: need, isMax: false };
    exp -= need;
    level++;
  }
  return { level: LEVEL_CAP, exp: 0, expToNext: 0, isMax: true };
}

export type PullProgress = {
  /** null when the pull was a new pet. */
  before: LevelState | null;
  after: LevelState;
  /** EXP this pull added (0 for a new pet or one already at the cap). */
  gained: number;
  levelsGained: number;
};

/** What a pull did to a pet. `copies` is the count after the pull. */
export function pullProgress(copies: number, rarity: LevelRarity): PullProgress {
  const after = levelFor(copies, rarity);
  if (copies <= 1) return { before: null, after, gained: 0, levelsGained: 0 };
  const before = levelFor(copies - 1, rarity);
  return {
    before,
    after,
    gained: before.isMax ? 0 : EXP_PER_DUPLICATE[rarity],
    levelsGained: after.level - before.level,
  };
}
