-- Pity counters for the full-roster roll. Lives off profiles so the friends migration can own that table.
-- Skeleton pet_ids ("{line}_{species}") are not rewritten. Wipe user_pets and scans if this database
-- already has them; they will not match the catalog.

CREATE TABLE public.roll_pity (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  since_epic_plus int NOT NULL DEFAULT 0 CHECK (since_epic_plus >= 0),
  since_legendary int NOT NULL DEFAULT 0 CHECK (since_legendary >= 0)
);

ALTER TABLE public.roll_pity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.roll_pity FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.record_scan(uuid, text, text, boolean, integer);

-- p_expected_* is the pity the roll was computed from. If another scan committed first, return
-- pity_conflict and write nothing so the caller can re-roll. The user-level lock serializes that check.
CREATE OR REPLACE FUNCTION public.record_scan(
  p_user_id uuid,
  p_code_id text,
  p_pet_id text,
  p_is_gold boolean,
  p_cooldown_hours int,
  p_expected_epic_plus int,
  p_expected_legendary int,
  p_since_epic_plus int,
  p_since_legendary int
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
  v_epic int;
  v_legendary int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

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

  SELECT since_epic_plus, since_legendary INTO v_epic, v_legendary
  FROM roll_pity
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    v_epic := 0;
    v_legendary := 0;
  END IF;

  IF v_epic IS DISTINCT FROM p_expected_epic_plus
     OR v_legendary IS DISTINCT FROM p_expected_legendary THEN
    RETURN jsonb_build_object('status', 'pity_conflict');
  END IF;

  INSERT INTO scans (user_id, code_id, station_name, code_line, pet_id, is_gold)
  VALUES (p_user_id, p_code_id, v_station, v_code_line, p_pet_id, p_is_gold);

  SELECT * INTO v_existing
  FROM user_pets
  WHERE user_id = p_user_id AND pet_id = p_pet_id;

  IF NOT FOUND THEN
    INSERT INTO user_pets (user_id, pet_id, copies, is_gold, first_station)
    VALUES (p_user_id, p_pet_id, 1, p_is_gold, v_station);
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
    WHERE user_id = p_user_id AND pet_id = p_pet_id;
  END IF;

  INSERT INTO roll_pity (user_id, since_epic_plus, since_legendary)
  VALUES (p_user_id, p_since_epic_plus, p_since_legendary)
  ON CONFLICT (user_id) DO UPDATE
  SET since_epic_plus = EXCLUDED.since_epic_plus,
      since_legendary = EXCLUDED.since_legendary;

  RETURN jsonb_build_object(
    'status', 'ok',
    'station_name', v_station,
    'copies', v_copies,
    'is_new', v_is_new,
    'became_gold', v_became_gold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_scan(uuid, text, text, boolean, integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_scan(uuid, text, text, boolean, integer, integer, integer, integer, integer) TO service_role;
