// Dev-only preview mode: `npm run preview:web` (EXPO_PUBLIC_PREVIEW=1) runs the whole app on
// in-memory sample data, with no Supabase project. Scans are rolled locally with the catalog odds.
// Never enabled in a normal build: the flag is off unless that env var is set.
import type { ScanResponse } from '@game/api';
import { LINES, ODDS, SPECIES, SPECIES_INFO, petId, parsePetId, type Line, type Species } from '@game/catalog';
import type { Session } from '@supabase/supabase-js';
import type { FollowCounts, FollowKind, OwnedPet, Profile, PublicPet, PublicProfile, ScanHistoryItem, Stats, UserSummary } from './api';

export const IS_PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

/** A payload that passes parseScanPayload; the preview scan button sends it. */
export const PREVIEW_CODE = `btp:${'0'.repeat(32)}`;

// --- auth -------------------------------------------------------------------

const ME = 'preview-user';
const ME_HANDLE = 'preview_rider';
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const PREVIEW_SESSION = { user: { id: ME, email: 'rider@preview.local', created_at: daysAgo(13) } } as unknown as Session;

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
  { pet_id: petId('duckling', 'red'), copies: 2, is_gold: false, first_caught_at: hoursAgo(80), first_station: 'Park Street' },
  { pet_id: petId('turkey', 'red'), copies: 1, is_gold: false, first_caught_at: hoursAgo(76), first_station: 'Harvard' },
  { pet_id: petId('duckling', 'orange'), copies: 1, is_gold: false, first_caught_at: hoursAgo(60), first_station: 'Ruggles' },
  { pet_id: petId('duckling', 'green'), copies: 3, is_gold: false, first_caught_at: hoursAgo(55), first_station: 'Kenmore' },
  { pet_id: petId('turkey', 'green'), copies: 1, is_gold: false, first_caught_at: hoursAgo(50), first_station: 'BU Central' },
  { pet_id: petId('seal', 'green'), copies: 1, is_gold: false, first_caught_at: hoursAgo(40), first_station: 'Kenmore' },
  { pet_id: petId('turkey', 'blue'), copies: 1, is_gold: false, first_caught_at: hoursAgo(30), first_station: 'Government Center' },
  { pet_id: petId('seal', 'blue'), copies: 2, is_gold: true, first_caught_at: hoursAgo(26), first_station: 'Aquarium' },
  { pet_id: petId('duckling', 'silver'), copies: 7, is_gold: false, first_caught_at: hoursAgo(20), first_station: 'South Station' },
];

let nextId = 1;
const history: ScanHistoryItem[] = pets
  .flatMap((p, i) =>
    Array.from({ length: p.copies }, (_, c) => ({
      id: nextId++,
      station_name: p.first_station ?? 'Park Street',
      pet_id: p.pet_id,
      is_gold: p.is_gold && c === p.copies - 1,
      created_at: hoursAgo(80 - i * 7 - c * 2),
    })),
  )
  .sort((a, b) => b.created_at.localeCompare(a.created_at));

const visitedLines = new Set<Line>(
  history.map((h) => parsePetId(h.pet_id)?.line).filter((l): l is Line => !!l),
);

export const previewData = {
  async pets(): Promise<OwnedPet[]> {
    return pets.map((p) => ({ ...p }));
  },
  async history(): Promise<ScanHistoryItem[]> {
    return history.slice(0, 50);
  },
  async profile(): Promise<Profile> {
    return {
      id: ME,
      display_name: 'Preview Rider',
      handle: ME_HANDLE,
      is_demo: false,
      created_at: daysAgo(13),
      last_active_at: new Date().toISOString(),
    };
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

    const id = petId(species, line);
    const existing = pets.find((p) => p.pet_id === id);
    const wasGold = existing?.is_gold ?? false;
    if (existing) {
      existing.copies += 1;
      existing.is_gold ||= isGold;
    } else {
      pets.push({
        pet_id: id,
        copies: 1,
        is_gold: isGold,
        first_caught_at: new Date().toISOString(),
        first_station: station.name,
      });
    }
    history.unshift({
      id: nextId++,
      station_name: station.name,
      pet_id: id,
      is_gold: isGold,
      created_at: new Date().toISOString(),
    });
    visitedLines.add(line);

    return {
      status: 'ok',
      stationName: station.name,
      pet: { petId: id, species, line, isGold },
      copies: existing?.copies ?? 1,
      isNew: !existing,
      becameGold: isGold && !wasGold,
    };
  },
};

// --- sample riders and follows ---------------------------------------------------

type SampleUser = {
  id: string;
  handle: string;
  display_name: string;
  created_at: string;
  last_active_at: string;
  total_scans: number;
  pets: PublicPet[];
};

function samplePets(list: [Line, Species, number, boolean?][]): PublicPet[] {
  return list.map(([line, species, copies, isGold], i) => ({
    pet_id: petId(species, line),
    copies,
    is_gold: !!isGold,
    first_caught_at: daysAgo(20 - i),
  }));
}

const users: SampleUser[] = [
  { id: 'u-priya', handle: 'priya_on_the_t', display_name: 'Priya S.', created_at: daysAgo(22), last_active_at: hoursAgo(3), total_scans: 23,
    pets: samplePets([['orange', 'duckling', 5], ['orange', 'turkey', 4], ['orange', 'seal', 2], ['green', 'duckling', 3], ['green', 'turkey', 1], ['silver', 'duckling', 2], ['silver', 'turkey', 1], ['red', 'duckling', 1]]) },
  { id: 'u-graham', handle: 'graham_rides', display_name: 'Graham R.', created_at: daysAgo(30), last_active_at: hoursAgo(0.02), total_scans: 61,
    pets: samplePets([['green', 'duckling', 6], ['green', 'turkey', 3], ['green', 'seal', 2], ['green', 'lobster', 1, true], ['red', 'duckling', 2], ['blue', 'turkey', 1]]) },
  { id: 'u-gracie', handle: 'gracie_t', display_name: 'Gracie T.', created_at: daysAgo(5), last_active_at: hoursAgo(26), total_scans: 6,
    pets: samplePets([['red', 'duckling', 2], ['red', 'turkey', 1], ['blue', 'duckling', 1], ['orange', 'turkey', 1]]) },
  { id: 'u-granite', handle: 'granite_state', display_name: 'Sam K.', created_at: daysAgo(40), last_active_at: daysAgo(9), total_scans: 12,
    pets: samplePets([['silver', 'duckling', 3], ['silver', 'turkey', 2], ['blue', 'seal', 1]]) },
  { id: 'u-marcus', handle: 'mbta_marcus', display_name: 'Marcus D.', created_at: daysAgo(45), last_active_at: hoursAgo(8), total_scans: 88,
    pets: samplePets([['red', 'duckling', 5], ['red', 'turkey', 5], ['red', 'seal', 3], ['red', 'lobster', 1], ['orange', 'duckling', 4], ['green', 'duckling', 2], ['blue', 'duckling', 2], ['silver', 'duckling', 1]]) },
  { id: 'u-ava', handle: 'ava_outbound', display_name: 'Ava W.', created_at: daysAgo(18), last_active_at: daysAgo(2), total_scans: 9,
    pets: samplePets([['blue', 'duckling', 3], ['blue', 'seal', 1], ['blue', 'turkey', 1]]) },
  { id: 'u-noor', handle: 'noor_silverline', display_name: 'Noor A.', created_at: daysAgo(11), last_active_at: hoursAgo(1), total_scans: 17,
    pets: samplePets([['silver', 'duckling', 4], ['silver', 'turkey', 2], ['silver', 'seal', 1], ['orange', 'duckling', 1]]) },
];

/** Follow edges as [follower, followee]. */
const follows: [string, string][] = [
  [ME, 'u-priya'], [ME, 'u-graham'], [ME, 'u-marcus'],
  ['u-priya', ME], ['u-gracie', ME], ['u-noor', ME], ['u-marcus', ME],
  ['u-priya', 'u-graham'], ['u-graham', 'u-priya'], ['u-marcus', 'u-graham'], ['u-ava', 'u-marcus'],
];

const isFollowing = (follower: string, followee: string) =>
  follows.some(([a, b]) => a === follower && b === followee);
const followersOf = (id: string) => follows.filter(([, b]) => b === id).map(([a]) => a);
const followingOf = (id: string) => follows.filter(([a]) => a === id).map(([, b]) => b);

function summaryOf(id: string): UserSummary | null {
  if (id === ME) {
    return { id: ME, handle: ME_HANDLE, display_name: 'Preview Rider', pet_count: pets.length, follows_you: false, followed_by_me: false };
  }
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  return {
    id: u.id,
    handle: u.handle,
    display_name: u.display_name,
    pet_count: u.pets.length,
    follows_you: isFollowing(u.id, ME),
    followed_by_me: isFollowing(ME, u.id),
  };
}

const delay = () => new Promise((r) => setTimeout(r, 150));

export const previewSocial = {
  async search(prefix: string): Promise<UserSummary[]> {
    await delay();
    const q = prefix.toLowerCase();
    return users
      .filter((u) => u.handle.startsWith(q))
      .slice(0, 20)
      .map((u) => summaryOf(u.id)!);
  },
  async profile(handle: string): Promise<PublicProfile | null> {
    await delay();
    const u = users.find((x) => x.handle === handle);
    if (!u) return null;
    return {
      ...summaryOf(u.id)!,
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      followers: followersOf(u.id).length,
      following: followingOf(u.id).length,
      stats: { total_scans: u.total_scans, lines_visited: new Set(u.pets.map((p) => parsePetId(p.pet_id)?.line)).size },
      pets: u.pets.map((p) => ({ ...p })),
    };
  },
  async follows(handle: string, kind: FollowKind): Promise<UserSummary[]> {
    await delay();
    const id = handle === ME_HANDLE ? ME : users.find((x) => x.handle === handle)?.id;
    if (!id) return [];
    const ids = kind === 'following' ? followingOf(id) : followersOf(id);
    return ids.map(summaryOf).filter((x): x is UserSummary => x !== null);
  },
  async counts(): Promise<FollowCounts> {
    return { following: followingOf(ME).length, followers: followersOf(ME).length };
  },
  async setFollowing(userId: string, follow: boolean): Promise<void> {
    await delay();
    const i = follows.findIndex(([a, b]) => a === ME && b === userId);
    if (follow && i === -1) follows.push([ME, userId]);
    if (!follow && i !== -1) follows.splice(i, 1);
  },
  async handleAvailable(handle: string): Promise<boolean> {
    await delay();
    return handle !== ME_HANDLE && !users.some((u) => u.handle === handle);
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