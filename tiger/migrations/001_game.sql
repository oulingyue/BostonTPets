-- Analytics mirror for Tiger Cloud (TimescaleDB). NOT the app runtime DB — see tiger/README.md.
-- Keep record_scan / my_stats bodies in sync with supabase/migrations/20251121210000_game.sql.
-- User ids match Supabase Auth UUIDs; no FK to auth.users (different host).

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TYPE t_line AS ENUM ('red', 'orange', 'green', 'blue', 'silver');
CREATE TYPE t_species AS ENUM ('duckling', 'turkey', 'seal', 'lobster');

CREATE TABLE scan_codes (
  id text PRIMARY KEY,
  station_name text NOT NULL,
  line t_line NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE user_pets (
  user_id uuid NOT NULL,
  species t_species NOT NULL,
  line t_line NOT NULL,
  copies int NOT NULL DEFAULT 1 CHECK (copies >= 1),
  is_gold boolean NOT NULL DEFAULT false,
  first_caught_at timestamptz NOT NULL DEFAULT now(),
  first_station text,
  PRIMARY KEY (user_id, species, line)
);

CREATE TABLE scans (
  id bigserial,
  user_id uuid NOT NULL,
  code_id text NOT NULL REFERENCES scan_codes (id),
  station_name text NOT NULL,
  code_line t_line NOT NULL,
  species t_species NOT NULL,
  line t_line NOT NULL,
  is_gold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('scans', 'created_at', if_not_exists => true);

CREATE INDEX scans_user_created_idx ON scans (user_id, created_at DESC);
CREATE INDEX scans_user_code_created_idx ON scans (user_id, code_id, created_at DESC);

CREATE MATERIALIZED VIEW scan_activity_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', created_at) AS bucket,
  count(*)::bigint AS total_scans,
  count(DISTINCT user_id)::bigint AS unique_riders
FROM scans
GROUP BY 1
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'scan_activity_hourly',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

CREATE OR REPLACE FUNCTION record_scan(
  p_user_id uuid,
  p_code_id text,
  p_species t_species,
  p_line t_line,
  p_is_gold boolean,
  p_cooldown_hours int
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_station text;
  v_code_line t_line;
  v_last timestamptz;
  v_next timestamptz;
  v_existing user_pets%ROWTYPE;
  v_copies int;
  v_is_new boolean;
  v_became_gold boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_code_id)
  );

  SELECT station_name, line INTO v_station, v_code_line
  FROM scan_codes
  WHERE id = p_code_id AND active;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  SELECT created_at INTO v_last
  FROM scans
  WHERE user_id = p_user_id AND code_id = p_code_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last IS NOT NULL AND p_cooldown_hours > 0 THEN
    v_next := v_last + make_interval(hours => p_cooldown_hours);
    IF now() < v_next THEN
      RETURN jsonb_build_object(
        'status', 'cooldown',
        'station_name', v_station,
        'next_available_at', v_next
      );
    END IF;
  END IF;

  INSERT INTO scans (user_id, code_id, station_name, code_line, species, line, is_gold)
  VALUES (p_user_id, p_code_id, v_station, v_code_line, p_species, p_line, p_is_gold);

  SELECT * INTO v_existing
  FROM user_pets
  WHERE user_id = p_user_id AND species = p_species AND line = p_line;

  IF NOT FOUND THEN
    INSERT INTO user_pets (user_id, species, line, copies, is_gold, first_station)
    VALUES (p_user_id, p_species, p_line, 1, p_is_gold, v_station);
    v_copies := 1;
    v_is_new := true;
    v_became_gold := p_is_gold;
  ELSE
    v_is_new := false;
    v_became_gold := p_is_gold AND NOT v_existing.is_gold;
    v_copies := v_existing.copies + 1;
    UPDATE user_pets
    SET copies = v_copies,
        is_gold = v_existing.is_gold OR p_is_gold
    WHERE user_id = p_user_id AND species = p_species AND line = p_line;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'station_name', v_station,
    'copies', v_copies,
    'is_new', v_is_new,
    'became_gold', v_became_gold
  );
END;
$$;

CREATE OR REPLACE FUNCTION my_stats(p_user_id uuid)
RETURNS TABLE (total_scans bigint, lines_visited bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::bigint, count(DISTINCT code_line)::bigint
  FROM scans
  WHERE user_id = p_user_id;
$$;