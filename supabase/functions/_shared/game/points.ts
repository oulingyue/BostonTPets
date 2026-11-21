// Leaderboard points: every scan scores by rarity, whether it was a new pet, gold, and the daily bonus.
// The scan Edge Function sends the new and duplicate values for the rolled pet to record_scan, which
// picks one, adds the daily bonus, and stores the total on scans.points. The app uses the same rules
// for the reveal playground and preview mode.
import { EXP_PER_DUPLICATE, type LevelRarity } from './leveling.ts';

/** A pet you didn't have yet: the same numbers as duplicate EXP. */
export const POINTS_NEW: Record<LevelRarity, number> = EXP_PER_DUPLICATE;
/** Another copy of a pet you already have: 40% of the new-pet value. */
export const POINTS_DUPLICATE: Record<LevelRarity, number> = { common: 10, rare: 20, epic: 40, legendary: 70 };
/** Gold pulls (1%) multiply the rarity points. */
export const GOLD_MULTIPLIER = 2;
/** Added (after the gold multiplier) to your first scan of the day. */
export const DAILY_BONUS = 50;
/** A "day" for the daily bonus is a calendar day in Boston, for everyone. record_scan uses the same zone. */
export const DAY_TIME_ZONE = 'America/New_York';

/** The two rarity-and-gold values record_scan chooses between. */
export function pullValues(rarity: LevelRarity, isGold: boolean): { newPoints: number; duplicatePoints: number } {
  const m = isGold ? GOLD_MULTIPLIER : 1;
  return { newPoints: POINTS_NEW[rarity] * m, duplicatePoints: POINTS_DUPLICATE[rarity] * m };
}

export type PullScore = { total: number; dailyBonus: number };

export function scorePull(p: { rarity: LevelRarity; isGold: boolean; isNew: boolean; firstOfDay: boolean }): PullScore {
  const values = pullValues(p.rarity, p.isGold);
  const dailyBonus = p.firstOfDay ? DAILY_BONUS : 0;
  return { total: (p.isNew ? values.newPoints : values.duplicatePoints) + dailyBonus, dailyBonus };
}

/** The Boston calendar day of a moment, as YYYY-MM-DD. */
export function bostonDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DAY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
