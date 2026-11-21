-- Keep in sync with supabase/migrations/20251121220000_pet_id.sql (analytics DB only).

ALTER TABLE user_pets ADD COLUMN IF NOT EXISTS pet_id text;

UPDATE user_pets
SET pet_id = line::text || '_' || species::text
WHERE pet_id IS NULL;

ALTER TABLE user_pets ALTER COLUMN pet_id SET NOT NULL;

ALTER TABLE scans ADD COLUMN IF NOT EXISTS pet_id text;

UPDATE scans
SET pet_id = line::text || '_' || species::text
WHERE pet_id IS NULL;

ALTER TABLE scans ALTER COLUMN pet_id SET NOT NULL;

ALTER TABLE user_pets DROP CONSTRAINT user_pets_pkey;
ALTER TABLE user_pets DROP COLUMN species;
ALTER TABLE user_pets DROP COLUMN line;
ALTER TABLE user_pets ADD PRIMARY KEY (user_id, pet_id);

ALTER TABLE scans DROP COLUMN species;
ALTER TABLE scans DROP COLUMN line;

DROP FUNCTION IF EXISTS record_scan(uuid, text, t_species, t_line, boolean, integer);

CREATE OR REPLACE FUNCTION record_scan(
  p_user_id uuid,
  p_code_id text,
  p_pet_id text,
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

  INSERT INTO scans (user_id, code_id, station_name, code_line, pet_id, is_gold, created_at)
  VALUES (p_user_id, p_code_id, v_station, v_code_line, p_pet_id, p_is_gold, now());

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

  RETURN jsonb_build_object(
    'status', 'ok',
    'station_name', v_station,
    'copies', v_copies,
    'is_new', v_is_new,
    'became_gold', v_became_gold
  );
END;
$$;