// Location check for scans: the phone must be near the QR code it scanned.
// Shared by the `scan` Edge Function (Deno), the app (via `@game/location`), and node:test.
// Keep this file dependency-free so it runs unchanged in all three.
//
// The phone reports its own position, so this stops casual cheating (scanning a photo of a code
// from home), not someone who sends made-up coordinates to the API.

/** The phone's position, sent with a scan. */
export type ScanLocation = {
  lat: number;
  lng: number;
  /** Radius of uncertainty in meters, as the phone reports it. Null when the phone didn't say. */
  accuracy: number | null;
  /** True when the OS says the position came from a mock-location app or a simulator. */
  mocked: boolean;
};

/** Where a code is posted (`scan_codes.lat`, `lng`, `radius_m`). Null coordinates turn the check off for that code. */
export type CodePlace = { lat: number | null; lng: number | null; radius_m: number };

export type LocationVerdict =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'mocked' }
  | { ok: false; reason: 'too_far'; distanceM: number };

/**
 * The most the phone's reported uncertainty can stretch a code's radius, in meters. A fix that says
 * "within 50 m" gets 50 m of slack, but a 3 km cell-tower fix can't pass from across town.
 */
export const MAX_ACCURACY_CREDIT_M = 150;

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle (haversine) distance between two points, in meters. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates the `location` field of a scan request. Anything malformed counts as no location. */
export function parseScanLocation(value: unknown): ScanLocation | null {
  if (typeof value !== 'object' || value === null) return null;
  const { lat, lng, accuracy, mocked } = value as Record<string, unknown>;
  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) return null;
  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) return null;
  return {
    lat,
    lng,
    accuracy: isFiniteNumber(accuracy) && accuracy >= 0 ? accuracy : null,
    mocked: mocked === true,
  };
}

/** Decides whether a scan at `location` counts for a code posted at `code`. */
export function checkScanLocation(code: CodePlace, location: ScanLocation | null): LocationVerdict {
  if (code.lat === null || code.lng === null) return { ok: true };
  if (!location) return { ok: false, reason: 'missing' };
  if (location.mocked) return { ok: false, reason: 'mocked' };

  const distance = distanceMeters(location, { lat: code.lat, lng: code.lng });
  const credit = Math.min(location.accuracy ?? 0, MAX_ACCURACY_CREDIT_M);
  if (distance - credit <= code.radius_m) return { ok: true };
  return { ok: false, reason: 'too_far', distanceM: Math.round(distance) };
}
