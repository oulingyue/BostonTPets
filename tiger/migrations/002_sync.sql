-- Copies scans from Supabase into Tiger every minute, entirely inside Tiger: postgres_fdw reads the
-- Supabase tables, and a TimescaleDB job runs sync_from_supabase(). Supabase Edge Functions can't
-- connect to Tiger (its server certificate is marked as a CA, which Deno's TLS rejects), so Tiger pulls
-- instead of Supabase pushing.
--
-- Before running: replace <supabase-pooler-host> below with your project's session pooler host
-- (Supabase dashboard > Connect > Session pooler, e.g. aws-0-us-east-1.pooler.supabase.com).
-- The login (user mapping) and the job are separate steps in tiger/README.md, so no password is in
-- this file.

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SERVER IF EXISTS supabase CASCADE;  -- also drops the user mapping and foreign tables
CREATE SERVER supabase
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '<supabase-pooler-host>', port '5432', dbname 'postgres', sslmode 'require');

CREATE SCHEMA IF NOT EXISTS supabase_src;

-- Only the columns the sync reads. t_line is an enum on Supabase; it arrives here as text.
CREATE FOREIGN TABLE supabase_src.scans (
  id bigint,
  user_id uuid,
  code_id text,
  station_name text,
  code_line text,
  pet_id text,
  is_gold boolean,
  points int,
  created_at timestamptz
) SERVER supabase OPTIONS (schema_name 'public', table_name 'scans');

CREATE FOREIGN TABLE supabase_src.scan_codes (
  id text,
  station_name text,
  line text,
  active boolean
) SERVER supabase OPTIONS (schema_name 'public', table_name 'scan_codes');

CREATE FOREIGN TABLE supabase_src.profiles (
  id uuid,
  is_demo boolean
) SERVER supabase OPTIONS (schema_name 'public', table_name 'profiles');

-- Job procedure. Run it by hand with: CALL sync_from_supabase();
CREATE OR REPLACE PROCEDURE sync_from_supabase(job_id int DEFAULT NULL, config jsonb DEFAULT NULL)
LANGUAGE plpgsql
AS $$
DECLARE
  v_after bigint;
BEGIN
  INSERT INTO stations (code_id, station_name, line, active)
  SELECT id, station_name, line, active FROM supabase_src.scan_codes
  ON CONFLICT (code_id) DO UPDATE
  SET station_name = EXCLUDED.station_name, line = EXCLUDED.line, active = EXCLUDED.active;

  INSERT INTO riders (user_id, is_demo)
  SELECT id, is_demo FROM supabase_src.profiles
  ON CONFLICT (user_id) DO UPDATE SET is_demo = EXCLUDED.is_demo;

  -- Re-read the last 1000 ids: a scan with a lower id can commit after a higher one. Rows already
  -- copied are skipped by the unique index.
  SELECT coalesce(max(scan_id), 0) - 1000 INTO v_after FROM scans WHERE source = 'live';

  INSERT INTO scans (scan_id, user_id, code_id, station_name, line, pet_id, rarity, is_gold, points,
                     is_demo, source, created_at)
  SELECT s.id, s.user_id, s.code_id, s.station_name, s.code_line, s.pet_id, p.rarity, s.is_gold, s.points,
         coalesce(r.is_demo, false), 'live', s.created_at
  FROM supabase_src.scans s
  LEFT JOIN pets p ON p.pet_id = s.pet_id
  LEFT JOIN riders r ON r.user_id = s.user_id
  WHERE s.id > v_after
  ON CONFLICT DO NOTHING;

  -- An account can be marked as a demo account after it has scanned.
  UPDATE scans SET is_demo = r.is_demo
  FROM riders r
  WHERE scans.source = 'live' AND scans.user_id = r.user_id AND scans.is_demo IS DISTINCT FROM r.is_demo;
END;
$$;
