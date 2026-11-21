import type { ScanResponse } from '@game/api';
import { IS_PREVIEW, previewData } from './preview';
import { supabase } from './supabase';

export type OwnedPet = {
  pet_id: string;
  copies: number;
  is_gold: boolean;
  first_caught_at: string;
  first_station: string | null;
};

export type ScanHistoryItem = {
  id: number;
  station_name: string;
  pet_id: string;
  is_gold: boolean;
  created_at: string;
};

export type Profile = { display_name: string | null; is_demo: boolean };
export type Stats = { total_scans: number; lines_visited: number };

async function invokePlayer<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('player', { body });
  if (error || data === null || data === undefined) throw error ?? new Error('Empty response from player function');
  return data;
}

export async function fetchMyPets(): Promise<OwnedPet[]> {
  if (IS_PREVIEW) return previewData.pets();
  return invokePlayer<OwnedPet[]>({ resource: 'pets' });
}

export async function fetchScanHistory(limit = 50): Promise<ScanHistoryItem[]> {
  if (IS_PREVIEW) return previewData.history();
  return invokePlayer<ScanHistoryItem[]>({ resource: 'history', limit });
}

export async function fetchProfile(): Promise<Profile | null> {
  if (IS_PREVIEW) return previewData.profile();
  const { data, error } = await supabase.from('profiles').select('display_name, is_demo').maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchStats(): Promise<Stats> {
  if (IS_PREVIEW) return previewData.stats();
  return invokePlayer<Stats>({ resource: 'stats' });
}

/** Sends the raw QR payload to the server, which validates it and rolls the pet. */
export async function submitScan(payload: string): Promise<ScanResponse> {
  if (IS_PREVIEW) return previewData.scan();
  const { data, error } = await supabase.functions.invoke<ScanResponse>('scan', { body: { payload } });
  if (error || !data) throw error ?? new Error('Empty response from scan function');
  return data;
}