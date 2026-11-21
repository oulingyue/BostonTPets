-- Runtime game data on Supabase (Edge Functions cannot open TLS to Tiger free-tier certs).
-- Tiger keeps the Timescale hypertable + analytics copy — see tiger/README.md.

CREATE TYPE public.t_line AS ENUM ('red', 'orange', 'green', 'blue', 'silver');
CREATE TYPE public.t_species AS ENUM ('duckling', 'turkey', 'seal', 'lobster');

CREATE TABLE public.scan_codes (
  id text PRIMARY KEY,
  station_name text NOT NULL,
  line public.t_line NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.user_pets (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  species public.t_species NOT NULL,
  line public.t_line NOT NULL,
  copies int NOT NULL DEFAULT 1 CHECK (copies >= 1),
  is_gold boolean NOT NULL DEFAULT false,
  first_caught_at timestamptz NOT NULL DEFAULT now(),
  first_station text,
  PRIMARY KEY (user_id, species, line)
);

CREATE TABLE public.scans (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  code_id text NOT NULL REFERENCES public.scan_codes (id),
  station_name text NOT NULL,
  code_line public.t_line NOT NULL,
  species public.t_species NOT NULL,
  line public.t_line NOT NULL,
  is_gold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scans_user_created_idx ON public.scans (user_id, created_at DESC);
CREATE INDEX scans_user_code_created_idx ON public.scans (user_id, code_id, created_at DESC);

ALTER TABLE public.scan_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_pets_select_own ON public.user_pets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY scans_select_own ON public.scans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_scan(
  p_user_id uuid,
  p_code_id text,
  p_species public.t_species,
  p_line public.t_line,
  p_is_gold boolean,
  p_cooldown_hours int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station text;
  v_code_line public.t_line;
  v_last timestamptz;
  v_next timestamptz;
  v_existing user_pets%ROWTYPE;
  v_copies int;
  v_is_new boolean;
  v_became_gold boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_code_id));

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

CREATE OR REPLACE FUNCTION public.my_stats(p_user_id uuid)
RETURNS TABLE (total_scans bigint, lines_visited bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint, count(DISTINCT code_line)::bigint
  FROM scans
  WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.record_scan FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_scan TO service_role;

REVOKE ALL ON FUNCTION public.my_stats FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_stats TO service_role;

INSERT INTO public.scan_codes (id, station_name, line, active) VALUES
  ('00000000000000000000000000000001', 'Park Street (Red)', 'red', true),
  ('00000000000000000000000000000002', 'North Station (Orange)', 'orange', true),
  ('00000000000000000000000000000003', 'Park Street (Green)', 'green', true),
  ('00000000000000000000000000000004', 'Government Center (Blue)', 'blue', true),
  ('00000000000000000000000000000005', 'Airport (Silver)', 'silver', true)
ON CONFLICT (id) DO NOTHING;