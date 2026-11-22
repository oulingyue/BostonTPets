// Leveling: duplicates give EXP; equipped pets accrue passive EXP into user_pets.bonus_exp.
// Self-contained (no imports) so the app, Edge Functions, and tests can all use it.

export type LevelRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** EXP one duplicate gives. Rarer pets turn up less often, so each copy is worth more. */
export const EXP_PER_DUPLICATE: Record<LevelRarity, number> = { common: 25, rare: 50, epic: 100, legendary: 175 };

/** EXP needed for each level-up: level 1 -> 2 needs 100, and so on. 4 steps = max level 5 (MAX_LEVEL in catalog.ts). */
export const EXP_TO_NEXT: readonly number[] = [100, 150, 200, 250];
export const LEVEL_CAP = EXP_TO_NEXT.length + 1;

/** Total EXP to reach max level from zero bar progress at level 1. */
export const EXP_TO_MAX = EXP_TO_NEXT.reduce((a, b) => a + b, 0);

/** Passive EXP while equipped (habitat slot). Tune here; SQL migration mirrors these numbers. */
export const PASSIVE_EXP_PER_DAY = 20;
export const PASSIVE_ACCRUAL_CAP_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export type LevelState = {
  level: number;
  /** EXP into the current level. */
  exp: number;
  /** EXP the current level needs (0 at the cap). */
  expToNext: number;
  isMax: boolean;
};

export function duplicateExp(copies: number, rarity: LevelRarity): number {
  return Math.max(0, copies - 1) * EXP_PER_DUPLICATE[rarity];
}

export function totalExp(copies: number, rarity: LevelRarity, bonusExp = 0): number {
  return duplicateExp(copies, rarity) + Math.max(0, bonusExp);
}

export function isExpMaxed(copies: number, rarity: LevelRarity, bonusExp = 0): boolean {
  return totalExp(copies, rarity, bonusExp) >= EXP_TO_MAX;
}

/** Level and EXP for a pet you own `copies` of (1 = just caught), plus optional passive `bonusExp`. */
export function levelFor(copies: number, rarity: LevelRarity, bonusExp = 0): LevelState {
  let exp = totalExp(copies, rarity, bonusExp);
  let level = 1;
  for (const need of EXP_TO_NEXT) {
    if (exp < need) return { level, exp, expToNext: need, isMax: false };
    exp -= need;
    level++;
  }
  return { level: LEVEL_CAP, exp: 0, expToNext: 0, isMax: true };
}

/** Passive EXP to add after `elapsedMs` equipped; respects max total EXP and the offline cap. */
export function passiveGainForElapsed(
  elapsedMs: number,
  copies: number,
  rarity: LevelRarity,
  bonusExp = 0,
): number {
  if (isExpMaxed(copies, rarity, bonusExp) || elapsedMs <= 0) return 0;
  const days = Math.min(elapsedMs / MS_PER_DAY, PASSIVE_ACCRUAL_CAP_DAYS);
  const raw = Math.floor(days * PASSIVE_EXP_PER_DAY);
  const room = EXP_TO_MAX - totalExp(copies, rarity, bonusExp);
  return Math.max(0, Math.min(raw, room));
}

export type PullProgress = {
  /** null when the pull was a new pet. */
  before: LevelState | null;
  after: LevelState;
  /** EXP this pull added (0 for a new pet or one already at the cap). */
  gained: number;
  levelsGained: number;
};

/** What a pull did to a pet. `copies` is the count after the pull. Passive EXP is unchanged. */
export function pullProgress(copies: number, rarity: LevelRarity, bonusExp = 0): PullProgress {
  const after = levelFor(copies, rarity, bonusExp);
  if (copies <= 1) return { before: null, after, gained: 0, levelsGained: 0 };
  const before = levelFor(copies - 1, rarity, bonusExp);
  return {
    before,
    after,
    gained: before.isMax ? 0 : EXP_PER_DUPLICATE[rarity],
    levelsGained: after.level - before.level,
  };
}