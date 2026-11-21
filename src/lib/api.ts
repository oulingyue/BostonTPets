import type { ScanResponse } from '@game/api';
import type { Line, Species } from '@game/catalog';
import { supabase } from './supabase';

export type OwnedPet = {
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

export type Profile = { display_name: string | null; is_demo: boolean };
export type Stats = { total_scans: number; lines_visited: number };

export async function fetchMyPets(): Promise<OwnedPet[]> {
  const { data, error } = await supabase
    .from('user_pets')
    .select('species, line, copies, is_gold, first_caught_at, first_station');
  if (error) throw error;
  return data as OwnedPet[];
}

export async function fetchScanHistory(limit = 50): Promise<ScanHistoryItem[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('id, station_name, species, line, is_gold, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ScanHistoryItem[];
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('display_name, is_demo').maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc('my_stats').single();
  if (error) throw error;
  const row = data as { total_scans: number | string; lines_visited: number | string };
  // bigint columns can arrive as strings
  return { total_scans: Number(row.total_scans), lines_visited: Number(row.lines_visited) };
}

/** Sends the raw QR payload to the server, which validates it and rolls the pet. */
export async function submitScan(payload: string): Promise<ScanResponse> {
  const { data, error } = await supabase.functions.invoke<ScanResponse>('scan', { body: { payload } });
  if (error || !data) throw error ?? new Error('Empty response from scan function');
  return data;
}
