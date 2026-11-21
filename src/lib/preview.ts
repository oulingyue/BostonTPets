// Dev-only preview mode: `npm run preview:web` (EXPO_PUBLIC_PREVIEW=1) runs the whole app on
// in-memory sample data, with no Supabase project. Scans are rolled locally with the catalog odds.
// Never enabled in a normal build: the flag is off unless that env var is set.
import type { ScanResponse } from '@game/api';
import { getPet, type Line } from '@game/catalog';
import { rollPet, type PityState } from '@game/roll';
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

const SEED: { pet_id: string; copies: number; is_gold: boolean; station: string; line: Line; hours: number }[] = [
  { pet_id: 'mallard_duck', copies: 2, is_gold: false, station: 'Park Street', line: 'red', hours: 80 },
  { pet_id: 'alewife', copies: 1, is_gold: false, station: 'Harvard', line: 'red', hours: 76 },
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
      pet: { petId: roll.petId, isGold: roll.isGold },
      copies: existing?.copies ?? 1,
      isNew,
      becameGold: roll.isGold && !wasGold,
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

function samplePets(list: [petId: string, copies: number, isGold?: boolean][]): PublicPet[] {
  return list.map(([pet_id, copies, isGold], i) => ({
    pet_id,
    copies,
    is_gold: !!isGold,
    first_caught_at: daysAgo(20 - i),
  }));
}

/** Distinct T lines among a pet list (commons have no line). */
function linesOf(list: PublicPet[]): number {
  return new Set(list.map((p) => getPet(p.pet_id)?.line).filter(Boolean)).size;
}

const users: SampleUser[] = [
  { id: 'u-priya', handle: 'priya_on_the_t', display_name: 'Priya S.', created_at: daysAgo(22), last_active_at: hoursAgo(3), total_scans: 23,
    pets: samplePets([['mallard_duck', 5], ['pigeon', 4], ['haymarket_rat', 2], ['northeastern_husky', 1], ['swan', 3], ['herring_gull', 1], ['monarch_butterfly', 1]]) },
  { id: 'u-graham', handle: 'graham_rides', display_name: 'Graham R.', created_at: daysAgo(30), last_active_at: hoursAgo(0.02), total_scans: 61,
    pets: samplePets([['canada_goose', 6], ['bullfrog', 3], ['bu_terrier', 2], ['snapping_turtle', 1, true], ['alewife', 2], ['blue_jay', 1]]) },
  { id: 'u-gracie', handle: 'gracie_t', display_name: 'Gracie T.', created_at: daysAgo(5), last_active_at: hoursAgo(26), total_scans: 6,
    pets: samplePets([['wild_turkey', 2], ['raccoon', 1], ['piping_plover', 1], ['orange_tabby_cat', 1]]) },
  { id: 'u-granite', handle: 'granite_state', display_name: 'Sam K.', created_at: daysAgo(40), last_active_at: daysAgo(9), total_scans: 12,
    pets: samplePets([['gray_squirrel', 3], ['striped_bass', 2], ['harbor_seal', 1]]) },
  { id: 'u-marcus', handle: 'mbta_marcus', display_name: 'Marcus D.', created_at: daysAgo(45), last_active_at: hoursAgo(8), total_scans: 88,
    pets: samplePets([['mallard_duck', 5], ['pigeon', 5], ['mit_beaver', 3], ['lobster', 1], ['alewife', 1], ['red_fox', 1], ['penguin', 2], ['snowy_owl', 1]]) },
  { id: 'u-ava', handle: 'ava_outbound', display_name: 'Ava W.', created_at: daysAgo(18), last_active_at: daysAgo(2), total_scans: 9,
    pets: samplePets([['canada_goose', 3], ['horseshoe_crab', 1], ['humpback_whale', 1]]) },
  { id: 'u-noor', handle: 'noor_silverline', display_name: 'Noor A.', created_at: daysAgo(11), last_active_at: hoursAgo(1), total_scans: 17,
    pets: samplePets([['pigeon', 4], ['moon_jellyfish', 2], ['atlantic_cod', 1], ['wentworth_leopard', 1]]) },
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
  async search(query: string): Promise<UserSummary[]> {
    await delay();
    const q = query.trim().toLowerCase();
    const name = (u: SampleUser) => u.display_name.toLowerCase();
    return users
      .filter((u) => name(u).includes(q))
      .sort((a, b) => Number(name(b).startsWith(q)) - Number(name(a).startsWith(q)) || name(a).localeCompare(name(b)))
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
      stats: { total_scans: u.total_scans, lines_visited: linesOf(u.pets) },
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

