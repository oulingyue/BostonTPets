// Request/response contract for the `scan` Edge Function. Types only.
import type { Line } from './catalog.ts';

export type ScanRequest = { payload: string };

export type ScanResponse =
  | {
      status: 'ok';
      stationName: string;
      /** The scanned code's line. The pull reveal sends a train (or bus) in this line's color. */
      stationLine: Line;
      pet: { petId: string; isGold: boolean; isLineVariant: boolean };
      copies: number;
      isNew: boolean;
      becameGold: boolean;
    }
  | { status: 'cooldown'; stationName: string; nextAvailableAt: string }
  | { status: 'invalid_code' };
