import type { ScanResponse } from '@game/api';
import { IS_PREVIEW, previewData, previewLeaderboard, previewSocial } from './preview';
import { supabase } from './supabase';

/** One row of user_pets: the caller owns `copies` copies of the catalog pet `pet_id`. */
export type OwnedPet = {
  pet_id: string;
  copies: number;
  is_gold: boolean;
  first_caught_at: string;
  first_station: string | null;
  /** EXP from equipping in habitat; synced on the server. */
  bonus_exp: number;
};

export type ScanHistoryItem = {
  id: number;
  station_name: string;
  pet_id: string;
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
  avatar_pet_id: string | null;
};
export type Stats = {
  total_scans: number;
  lines_visited: number;
  /** Leaderboard points: the sum of scans.points. A backend deployed before points existed omits it. */
  points?: number;
};

async function invokePlayer<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('player', { body });
  if (error || data === null || data === undefined) throw error ?? new Error('Empty response from player function');
  return data;
}

export async function fetchMyPets(): Promise<OwnedPet[]> {
  if (IS_PREVIEW) return previewData.pets();
  const rows = await invokePlayer<OwnedPet[]>({ resource: 'pets' });
  return rows.map((p) => ({ ...p, bonus_exp: p.bonus_exp ?? 0 }));
}

export async function fetchScanHistory(limit = 50): Promise<ScanHistoryItem[]> {
  if (IS_PREVIEW) return previewData.history();
  return invokePlayer<ScanHistoryItem[]>({ resource: 'history', limit });
}

export async function fetchProfile(): Promise<Profile | null> {
  if (IS_PREVIEW) return previewData.profile();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, handle, is_demo, created_at, last_active_at, avatar_pet_id')
    .maybeSingle();
  if (error) throw error;
  const row = data as Profile | null;
  if (row) row.avatar_pet_id = row.avatar_pet_id ?? null;
  return row;
}

/** Set profile picture to an owned pet, or `null` for initials. */
export async function setAvatarPet(petId: string | null): Promise<void> {
  if (IS_PREVIEW) {
    previewData.setAvatar(petId);
    return;
  }
  const { error } = await supabase.rpc('set_avatar_pet', { p_pet_id: petId });
  if (error) throw error;
}

export async function fetchStats(): Promise<Stats> {
  if (IS_PREVIEW) return previewData.stats();
  return invokePlayer<Stats>({ resource: 'stats' });
}

export type LeaderboardScope = 'global' | 'friends';

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  handle: string;
  display_name: string | null;
  points: number;
  pet_count: number;
  is_me: boolean;
  avatar_pet_id: string | null;
  avatar_is_gold: boolean;
};

/**
 * `entries` is the top 50. `me` is the caller's own row, whether or not it's in `entries`; null when
 * the caller isn't on that board (no points yet on Global, or a demo account).
 * Rules: DESIGN.md "Leaderboards" and the leaderboard SQL function.
 */
export type Leaderboard = { entries: LeaderboardEntry[]; me: LeaderboardEntry | null };

export async function fetchLeaderboard(scope: LeaderboardScope): Promise<Leaderboard> {
  if (IS_PREVIEW) return previewLeaderboard(scope);
  return invokePlayer<Leaderboard>({ resource: 'leaderboard', scope });
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
// Reads of other people go through the `social` Edge Function (supabase/functions/social),
// since RLS only lets you read your own rows. Request body: { action, ...params }.
//
//   action             params                              returns
//   search             { query }                           UserSummary[]   (display name contains query, any case, 3+ chars, max 20, excludes caller)
//   profile            { handle }                          PublicProfile | null
//   follows            { handle, kind }                    UserSummary[]
//   counts             {}                                  FollowCounts    (the caller's own)
//   follow / unfollow  { userId }                          { ok: true }
//
// Two small Postgres RPCs are called directly (supabase/migrations/20251122130000_profile_social.sql):
//   handle_available(p_handle) -> boolean   callable signed out, for the sign-up form
//   touch_last_active()        -> void      sets the caller's last_active_at = now()
//
// Privacy rule: other people's data never includes email, scan history or stations.

/** A pet as other people see it: no station or passive EXP. */
export type PublicPet = Omit<OwnedPet, 'first_station' | 'bonus_exp'>;

export type UserSummary = {
  id: string;
  handle: string;
  display_name: string | null;
  pet_count: number;
  /** They follow the caller. */
  follows_you: boolean;
  /** The caller follows them. */
  followed_by_me: boolean;
  avatar_pet_id: string | null;
  avatar_is_gold: boolean;
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

export async function searchUsers(query: string): Promise<UserSummary[]> {
  if (IS_PREVIEW) return previewSocial.search(query);
  return invokeSocial({ action: 'search', query });
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
  const { data, error } = await supabase.rpc('handle_available', { p_handle: handle });
  if (error) throw error;
  return data === true;
}

/** Marks the signed-in user as active now. Best effort: failures are ignored. */
export async function touchLastActive(): Promise<void> {
  if (IS_PREVIEW) {
    previewData.syncPassiveExp();
    return;
  }
  await Promise.all([
    supabase.rpc('touch_last_active'),
    supabase.rpc('sync_passive_exp'),
  ]).then(
    () => {},
    () => {},
  );
}

export type HabitatSlot = { zone: 'sky' | 'earth' | 'water'; pet_id: string };

/** The signed-in user's habitat: at most one pet for sky, earth, and water. */
export async function fetchHabitat(): Promise<HabitatSlot[]> {
  if (IS_PREVIEW) return previewData.habitat();
  const { data, error } = await supabase.rpc('my_habitat');
  if (error) throw error;
  return (data ?? []) as HabitatSlot[];
}

/** Equip `petId` in its habitat band (same as habitat placement), or unequip when `place` is false. */
export async function equipPet(petId: string, place: boolean): Promise<void> {
  return setHabitatPet(petId, place);
}

/** Place `petId` in its zone, replacing whoever was there, or clear it when `place` is false. */
export async function setHabitatPet(petId: string, place: boolean): Promise<void> {
  if (IS_PREVIEW) {
    previewData.setHabitat(petId, place);
    return;
  }
  const { error } = await supabase.rpc('set_habitat_pet', { p_pet_id: petId, p_place: place });
  if (error) throw error;
}
