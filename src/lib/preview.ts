// Dev-only preview mode: `npm run preview:web` (EXPO_PUBLIC_PREVIEW=1) runs the whole app on
// in-memory sample data, with no Supabase project. Scans are rolled locally with the catalog odds.
// Never enabled in a normal build: the flag is off unless that env var is set.
import type { ScanResponse } from '@game/api';
import type { Line } from '@game/catalog';
import { rollPet, type PityState } from '@game/roll';
import type { Session } from '@supabase/supabase-js';
import type { OwnedPet, Profile, ScanHistoryItem, Stats } from './api';

export const IS_PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

/** A payload that passes parseScanPayload; the preview scan button sends it. */
export const PREVIEW_CODE = `btp:${'0'.repeat(32)}`;

// --- auth -------------------------------------------------------------------

const PREVIEW_SESSION = { user: { id: 'preview-user', email: 'rider@preview.local' } } as unknown as Session;

let currentSession: Session | null = PREVIEW_SESSION;
const listeners = new Set<(s: Session | null) => void>();

export const previewAuth = {
  get: () => currentSession,
  signIn() {
    currentSession = PREVIEW_SESSION;
    listeners.forEach((l) => l(currentSession));
  },
  signOut() {
    currentSession = null;
    listeners.forEach((l) => l(currentSession));
  },
  subscribe(listener: (s: Session | null) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// --- sample collection --------------------------------------------------------

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const STATIONS: { name: string; line: Line }[] = [
  { name: 'Park Street', line: 'red' },
  { name: 'Harvard', line: 'red' },
  { name: 'Ruggles', line: 'orange' },
  { name: 'Back Bay', line: 'orange' },
  { name: 'Kenmore', line: 'green' },
  { name: 'BU Central', line: 'green' },
  { name: 'Aquarium', line: 'blue' },
  { name: 'Government Center', line: 'blue' },
  { name: 'South Station', line: 'silver' },
  { name: 'World Trade Center', line: 'silver' },
];

const SEED: { pet_id: string; copies: number; is_gold: boolean; station: string; line: Line; hours: number }[] = [
  { pet_id: 'mallard_duck', copies: 2, is_gold: false, station: 'Park Street', line: 'red', hours: 80 },
  { pet_id: 'red_line_alewife', copies: 1, is_gold: false, station: 'Harvard', line: 'red', hours: 76 },
  { pet_id: 'monarch_butterfly', copies: 1, is_gold: false, station: 'Ruggles', line: 'orange', hours: 60 },
  { pet_id: 'swan', copies: 3, is_gold: false, station: 'Kenmore', line: 'green', hours: 55 },
  { pet_id: 'bullfrog', copies: 1, is_gold: false, station: 'BU Central', line: 'green', hours: 50 },
  { pet_id: 'harbor_seal', copies: 2, is_gold: true, station: 'Aquarium', line: 'blue', hours: 30 },
  { pet_id: 'pigeon', copies: 7, is_gold: false, station: 'South Station', line: 'silver', hours: 20 },
];

const pets: OwnedPet[] = SEED.map((seed) => ({
  pet_id: seed.pet_id,
  copies: seed.copies,
  is_gold: seed.is_gold,
  first_caught_at: hoursAgo(seed.hours),
  first_station: seed.station,
}));

let nextId = 1;
const history: ScanHistoryItem[] = SEED.flatMap((seed) =>
  Array.from({ length: seed.copies }, (_, c) => ({
    id: nextId++,
    station_name: seed.station,
    pet_id: seed.pet_id,
    is_gold: seed.is_gold && c === seed.copies - 1,
    created_at: hoursAgo(seed.hours - c * 2),
  })),
).sort((a, b) => b.created_at.localeCompare(a.created_at));

const visitedLines = new Set<Line>(SEED.map((seed) => seed.line));
let pity: PityState = { sinceEpicPlus: 0, sinceLegendary: 0 };

export const previewData = {
  async pets(): Promise<OwnedPet[]> {
    return pets.map((p) => ({ ...p }));
  },
  async history(): Promise<ScanHistoryItem[]> {
    return history.slice(0, 50);
  },
  async profile(): Promise<Profile> {
    return { display_name: 'Preview Rider', is_demo: false };
  },
  async stats(): Promise<Stats> {
    return { total_scans: history.length, lines_visited: visitedLines.size };
  },
  /** Rolls locally with the real odds, then updates the in-memory collection like record_scan would. */
  async scan(): Promise<ScanResponse> {
    const station = STATIONS[Math.floor(Math.random() * STATIONS.length)];
    const roll = rollPet(station.line, { pity });
    pity = roll.nextPity;

    const existing = pets.find((p) => p.pet_id === roll.petId);
    const wasGold = existing?.is_gold ?? false;
    const isNew = !existing;
    if (existing) {
      existing.copies += 1;
      existing.is_gold ||= roll.isGold;
    } else {
      pets.push({
        pet_id: roll.petId,
        copies: 1,
        is_gold: roll.isGold,
        first_caught_at: new Date().toISOString(),
        first_station: station.name,
      });
    }
    history.unshift({
      id: nextId++,
      station_name: station.name,
      pet_id: roll.petId,
      is_gold: roll.isGold,
      created_at: new Date().toISOString(),
    });
    visitedLines.add(station.line);

    return {
      status: 'ok',
      stationName: station.name,
      stationLine: station.line,
      pet: { petId: roll.petId, isGold: roll.isGold, isLineVariant: roll.isLineVariant },
      copies: existing?.copies ?? 1,
      isNew,
      becameGold: roll.isGold && !wasGold,
    };
  },
};