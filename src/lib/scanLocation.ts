// The phone's position for the scan function's location check (rules in @game/location).
// While the Scan tab is open it keeps a fresh fix, so a scan rarely waits for one.
import type { ScanLocation } from '@game/location';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';

/** A fix younger than this is used as is. */
const FRESH_MS = 2 * 60_000;
/** How long a scan waits for a new fix before falling back to an older one. */
const FIX_TIMEOUT_MS = 6_000;
/**
 * The oldest fix a scan falls back to. Underground there may be no new fix at all, but the one from
 * the station entrance a few minutes ago is still close to the code.
 */
const STALE_MAX_AGE_MS = 15 * 60_000;

/**
 * - `granted`: precise location is on.
 * - `approximate`: the user only shares an approximate location (iOS "Precise: Off", Android "Approximate"),
 *   which is usually too vague for the check.
 * - `ask`: not granted, but the app can still show the system prompt.
 * - `denied`: only the Settings app can turn it on.
 */
export type LocationAccess = 'granted' | 'approximate' | 'ask' | 'denied';

function accessOf(permission: Location.LocationPermissionResponse | null): LocationAccess {
  if (permission?.granted) {
    const approximate = permission.ios?.accuracy === 'reduced' || permission.android?.accuracy === 'coarse';
    return approximate ? 'approximate' : 'granted';
  }
  return !permission || permission.canAskAgain ? 'ask' : 'denied';
}

/** `active`: the camera is showing, so keep a fresh fix ready. */
export function useScanLocation(active: boolean) {
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const latest = useRef<Location.LocationObject | null>(null);
  const granted = permission?.granted === true;

  useEffect(() => {
    if (!active || !granted) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    const remember = (loc: Location.LocationObject | null) => {
      if (!cancelled && loc && (!latest.current || loc.timestamp > latest.current.timestamp)) latest.current = loc;
    };

    Location.getLastKnownPositionAsync({ maxAge: FRESH_MS }).then(remember, () => {});
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5_000, distanceInterval: 10 }, remember).then(
      (sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      },
      () => {},
    );
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, granted]);

  /**
   * The best position available for a scan, and the permission state behind it. Reads the permission
   * itself rather than the hook's state, which may not have loaded when the camera reads its first code.
   * The first time, this is where the app asks: right after the rider scans, so the prompt makes sense.
   */
  const getLocation = useCallback(async (): Promise<{ location: ScanLocation | null; access: LocationAccess }> => {
    let perm = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (perm && !perm.granted && perm.status === Location.PermissionStatus.UNDETERMINED) {
      perm = await requestPermission().catch(() => perm);
    }
    const access = accessOf(perm);
    if (!perm?.granted) return { location: null, access };

    const fresh = latest.current && Date.now() - latest.current.timestamp < FRESH_MS ? latest.current : null;
    const loc =
      fresh ??
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS)) ??
      (await Location.getLastKnownPositionAsync({ maxAge: STALE_MAX_AGE_MS }).catch(() => null));
    if (!loc) return { location: null, access };
    return {
      location: {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? null,
        mocked: loc.mocked === true,
      },
      access,
    };
  }, [requestPermission]);

  /** Shows the system prompt when it still can, otherwise opens this app's page in Settings. */
  const fixAccess = useCallback(async () => {
    const access = accessOf(await Location.getForegroundPermissionsAsync().catch(() => null));
    if (access === 'ask') await requestPermission().catch(() => {});
    else if (access !== 'granted') await Linking.openSettings().catch(() => {});
  }, [requestPermission]);

  return { getLocation, fixAccess };
}

/** Resolves to null instead of rejecting, or after `ms` with no fix. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/** "400 ft", "2.3 mi": the app's players are in Boston. */
export function formatDistance(meters: number): string {
  const feet = meters * 3.28084;
  if (feet < 1000) return `${Math.max(50, Math.round(feet / 50) * 50)} ft`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}
