import type { ScanResponse } from '@game/api';
import type { Line, Species } from '@game/catalog';
import { IS_PREVIEW, previewData, previewSocial } from './preview';
import { supabase } from './supabase';

export type OwnedPet = {
  /** Permanent ID of this pet (user_pets.id). Shown on the pet sheet. */
  id: string;
  species: Species;
  line: Line;
  copies: number;
  is_gold: boolean;
  first_caught_at: string;
  first_station: string | null;
};

export type ScanHistoryItem = {
  id: number;
  station_name: string;
  species: Species;
  line: Line;
  is_gold: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  /** Unique username, without the @. Null for accounts made before handles existed. */
  handle: string | null;
  is_demo: boolean;
  created_at: string;
  /** Updated by the backend when the user opens the app or scans. */
  last_active_at: string | null;
};
export type Stats = { total_scans: number; lines_visited: number };

export async function fetchMyPets(): Promise<OwnedPet[]> {
  if (IS_PREVIEW) return previewData.pets();
  const { data, error } = await supabase
    .from('user_pets')
    .select('id, species, line, copies, is_gold, first_caught_at, first_station');
  if (error) throw error;
  return data as OwnedPet[];
}

export async function fetchScanHistory(limit = 50): Promise<ScanHistoryItem[]> {
  if (IS_PREVIEW) return previewData.history();
  const { data, error } = await supabase
    .from('scans')
    .select('id, station_name, species, line, is_gold, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ScanHistoryItem[];
}

export async function fetchProfile(): Promise<Profile | null> {
  if (IS_PREVIEW) return previewData.profile();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, handle, is_demo, created_at, last_active_at')
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchStats(): Promise<Stats> {
  if (IS_PREVIEW) return previewData.stats();
  const { data, error } = await supabase.rpc('my_stats').single();
  if (error) throw error;
  const row = data as { total_scans: number | string; lines_visited: number | string };
  // bigint columns can arrive as strings
  return { total_scans: Number(row.total_scans), lines_visited: Number(row.lines_visited) };
}

/** Sends the raw QR payload to the server, which validates it and rolls the pet. */
export async function submitScan(payload: string): Promise<ScanResponse> {
  if (IS_PREVIEW) return previewData.scan();
  const { data, error } = await supabase.functions.invoke<ScanResponse>('scan', { body: { payload } });
  if (error || !data) throw error ?? new Error('Empty response from scan function');
  return data;
}

// --- social: profiles, search and follows --------------------------------------
//
// Everything below goes through one Edge Function, `social`, which reads the game database.
// Request body: { action, ...params }. Responses are the types below.
//
//   action             params                              returns
//   search             { prefix }                          UserSummary[]   (handle prefix, 3+ chars, max 20, excludes caller)
//   profile            { handle }                          PublicProfile | null
//   follows            { handle, kind }                    UserSummary[]
//   counts             {}                                  FollowCounts    (the caller's own)
//   follow / unfollow  { userId }                          { ok: true }
//   handle_available   { handle }                          { available: boolean }   (must allow signed-out callers)
//   touch              {}                                  { ok: true }    (sets the caller's last_active_at = now())
//
// Privacy rule: other people's data never includes email, scan history or stations.

/** A pet as other people see it: no station. */
export type PublicPet = Omit<OwnedPet, 'first_station'>;

export type UserSummary = {
  id: string;
  handle: string;
  display_name: string | null;
  pet_count: number;
  /** They follow the caller. */
  follows_you: boolean;
  /** The caller follows them. */
  followed_by_me: boolean;
};

export type FollowCounts = { following: number; followers: number };
export type FollowKind = 'following' | 'followers';

export type PublicProfile = UserSummary &
  FollowCounts & {
    created_at: string;
    last_active_at: string | null;
    stats: Stats;
    pets: PublicPet[];
  };

async function invokeSocial<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('social', { body });
  if (error) throw error;
  return data as T;
}

export async function searchUsers(prefix: string): Promise<UserSummary[]> {
  if (IS_PREVIEW) return previewSocial.search(prefix);
  return invokeSocial({ action: 'search', prefix });
}

export async function fetchPublicProfile(handle: string): Promise<PublicProfile | null> {
  if (IS_PREVIEW) return previewSocial.profile(handle);
  return invokeSocial({ action: 'profile', handle });
}

export async function fetchFollows(handle: string, kind: FollowKind): Promise<UserSummary[]> {
  if (IS_PREVIEW) return previewSocial.follows(handle, kind);
  return invokeSocial({ action: 'follows', handle, kind });
}

export async function fetchMyFollowCounts(): Promise<FollowCounts> {
  if (IS_PREVIEW) return previewSocial.counts();
  return invokeSocial({ action: 'counts' });
}

export async function setFollowing(userId: string, follow: boolean): Promise<void> {
  if (IS_PREVIEW) return previewSocial.setFollowing(userId, follow);
  await invokeSocial({ action: follow ? 'follow' : 'unfollow', userId });
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  if (IS_PREVIEW) return previewSocial.handleAvailable(handle);
  const { available } = await invokeSocial<{ available: boolean }>({ action: 'handle_available', handle });
  return available;
}

/** Marks the signed-in user as active now. Best effort: failures are ignored. */
export async function touchLastActive(): Promise<void> {
  if (IS_PREVIEW) return;
  await invokeSocial({ action: 'touch' }).catch(() => {});
}
