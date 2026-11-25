// Request/response contract for the `scan` Edge Function. Types only.
import type { Line } from './catalog.ts';
import type { ScanLocation } from './location.ts';

/** `location` is required for codes that have coordinates (rules in location.ts). */
export type ScanRequest = { payload: string; location?: ScanLocation };

export type ScanResponse =
  | {
      status: 'ok';
      stationName: string;
      /** The scanned code's line. The pull reveal sends a train (or bus) in this line's color. */
      stationLine: Line;
      pet: { petId: string; isGold: boolean };
      copies: number;
      isNew: boolean;
      becameGold: boolean;
      /** Leaderboard points this pull earned, including the daily bonus (rules in points.ts). */
      points: { total: number; dailyBonus: number };
    }
  | { status: 'cooldown'; stationName: string; nextAvailableAt: string }
  /** The phone is farther from the code than its radius allows. */
  | { status: 'too_far'; stationName: string; distanceM: number }
  /** The code has coordinates, but the scan came with no location, or a mocked one. */
  | { status: 'location_required'; stationName: string }
  | { status: 'invalid_code' };
