// Request/response contract for the `scan` Edge Function. Types only.

export type ScanRequest = { payload: string };

export type ScanResponse =
  | {
      status: 'ok';
      stationName: string;
      pet: { petId: string; isGold: boolean; isLineVariant: boolean };
      copies: number;
      isNew: boolean;
      becameGold: boolean;
    }
  | { status: 'cooldown'; stationName: string; nextAvailableAt: string }
  | { status: 'invalid_code' };
