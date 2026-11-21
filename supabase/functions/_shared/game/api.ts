// Request/response contract for the `scan` Edge Function. Types only.
import type { Line, Species } from './catalog.ts';

export type ScanRequest = { payload: string };

export type ScanResponse =
  | {
      status: 'ok';
      stationName: string;
      pet: { petId: string; species: Species; line: Line; isGold: boolean };
      copies: number;
      isNew: boolean;
      becameGold: boolean;
    }
  | { status: 'cooldown'; stationName: string; nextAvailableAt: string }
  | { status: 'invalid_code' };
