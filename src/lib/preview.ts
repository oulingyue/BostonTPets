// Dev-only preview mode: `npm run preview:web` (EXPO_PUBLIC_PREVIEW=1) runs the whole app on
// in-memory sample data, with no Supabase project. Scans are rolled locally with the catalog odds.
// Never enabled in a normal build: the flag is off unless that env var is set.
import type { ScanResponse } from '@game/api';
import { LINES, ODDS, SPECIES, SPECIES_INFO, type Line, type Species } from '@game/catalog';
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

const pets: OwnedPet[] = [
  { species: 'duckling', line: 'red', copies: 2, is_gold: false, first_caught_at: hoursAgo(80), first_station: 'Park Street' },
  { species: 'turkey', line: 'red', copies: 1, is_gold: false, first_caught_at: hoursAgo(76), first_station: 'Harvard' },
  { species: 'duckling', line: 'orange', copies: 1, is_gold: false, first_caught_at: hoursAgo(60), first_station: 'Ruggles' },
  { species: 'duckling', line: 'green', copies: 3, is_gold: false, first_caught_at: hoursAgo(55), first_station: 'Kenmore' },
  { species: 'turkey', line: 'green', copies: 1, is_gold: false, first_caught_at: hoursAgo(50), first_station: 'BU Central' },
  { species: 'seal', line: 'green', copies: 1, is_gold: false, first_caught_at: hoursAgo(40), first_station: 'Kenmore' },
  { species: 'turkey', line: 'blue', copies: 1, is_gold: false, first_caught_at: hoursAgo(30), first_station: 'Government Center' },
  { species: 'seal', line: 'blue', copies: 2, is_gold: true, first_caught_at: hoursAgo(26), first_station: 'Aquarium' },
  { species: 'duckling', line: 'silver', copies: 7, is_gold: false, first_caught_at: hoursAgo(20), first_station: 'South Station' },
];

// One history row per copy, newest first.
let nextId = 1;
const history: ScanHistoryItem[] = pets
  .flatMap((p, i) =>
    Array.from({ length: p.copies }, (_, c) => ({
      id: nextId++,
      station_name: p.first_station ?? 'Park Street',
      species: p.species,
      line: p.line,
      is_gold: p.is_gold && c === p.copies - 1,
      created_at: hoursAgo(80 - i * 7 - c * 2),
    })),
  )
  .sort((a, b) => b.created_at.localeCompare(a.created_at));

const visitedLines = new Set<Line>(history.map((h) => h.line));

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
    const line: Line =
      Math.random() < ODDS.scannedLineChance
        ? station.line
        : LINES.filter((l) => l !== station.line)[Math.floor(Math.random() * (LINES.length - 1))];
    const species = pickSpecies();
    const isGold = Math.random() < ODDS.goldChance;

    const existing = pets.find((p) => p.species === species && p.line === line);
    const wasGold = existing?.is_gold ?? false;
    if (existing) {
      existing.copies += 1;
      existing.is_gold ||= isGold;
    } else {
      pets.push({
        species,
        line,
        copies: 1,
        is_gold: isGold,
        first_caught_at: new Date().toISOString(),
        first_station: station.name,
      });
    }
    history.unshift({
      id: nextId++,
      station_name: station.name,
      species,
      line,
      is_gold: isGold,
      created_at: new Date().toISOString(),
    });
    visitedLines.add(station.line);

    return {
      status: 'ok',
      stationName: station.name,
      pet: { species, line, isGold },
      copies: existing?.copies ?? 1,
      isNew: !existing,
      becameGold: isGold && !wasGold,
    };
  },
};

function pickSpecies(): Species {
  let target = Math.random() * SPECIES.reduce((sum, s) => sum + SPECIES_INFO[s].weight, 0);
  for (const s of SPECIES) {
    target -= SPECIES_INFO[s].weight;
    if (target < 0) return s;
  }
  return SPECIES[SPECIES.length - 1];
}
