-- Passive EXP for pets equipped in habitat (must match PASSIVE_* and EXP_* in _shared/game/leveling.ts).

ALTER TABLE public.user_pets
  ADD COLUMN IF NOT EXISTS bonus_exp int NOT NULL DEFAULT 0 CHECK (bonus_exp >= 0);

ALTER TABLE public.habitat_pets
  ADD COLUMN IF NOT EXISTS passive_tick_at timestamptz NOT NULL DEFAULT now();

-- Duplicate EXP per pet_id (values from EXP_PER_DUPLICATE by rarity in catalog.ts).
CREATE OR REPLACE FUNCTION public.pet_duplicate_exp(p_pet_id text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_pet_id IN (
      'lobster', 'snapping_turtle', 'red_fox', 'humpback_whale', 'snowy_owl'
    ) THEN 175
    WHEN p_pet_id IN (
      'mit_beaver', 'red_tailed_hawk', 'bu_terrier', 'bc_eagle', 'northeastern_husky',
      'wentworth_leopard', 'harbor_seal', 'penguin', 'atlantic_cod', 'peregrine_falcon'
    ) THEN 100
    WHEN p_pet_id IN (
      'alewife', 'northern_cardinal', 'raccoon', 'boston_terrier', 'swan', 'bullfrog',
      'monarch_butterfly', 'orange_tabby_cat', 'haymarket_rat', 'blue_jay', 'horseshoe_crab',
      'piping_plover', 'herring_gull', 'striped_bass', 'moon_jellyfish'
    ) THEN 50
  ELSE 25
  END;
$$;

CREATE OR REPLACE FUNCTION public._pet_total_exp(p_copies int, p_bonus_exp int, p_pet_id text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0, p_copies - 1) * public.pet_duplicate_exp(p_pet_id) + GREATEST(0, p_bonus_exp);
$$;

-- Sum of EXP_TO_NEXT in leveling.ts (700).
CREATE OR REPLACE FUNCTION public._exp_to_max()
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 700; $$;

CREATE OR REPLACE FUNCTION public._accrue_passive_slot(p_user_id uuid, p_zone public.habitat_zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet_id text;
  v_tick timestamptz;
  v_copies int;
  v_bonus int;
  v_total int;
  v_elapsed_days numeric;
  v_gain int;
  v_room int;
BEGIN
  SELECT pet_id, passive_tick_at INTO v_pet_id, v_tick
  FROM habitat_pets
  WHERE user_id = p_user_id AND zone = p_zone
  FOR UPDATE;

  IF v_pet_id IS NULL THEN
    RETURN;
  END IF;

  SELECT copies, bonus_exp INTO v_copies, v_bonus
  FROM user_pets
  WHERE user_id = p_user_id AND pet_id = v_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE habitat_pets SET passive_tick_at = now()
    WHERE user_id = p_user_id AND zone = p_zone;
    RETURN;
  END IF;

  v_total := _pet_total_exp(v_copies, v_bonus, v_pet_id);
  IF v_total >= _exp_to_max() THEN
    UPDATE habitat_pets SET passive_tick_at = now()
    WHERE user_id = p_user_id AND zone = p_zone;
    RETURN;
  END IF;

  v_elapsed_days := EXTRACT(EPOCH FROM (now() - v_tick)) / 86400.0;
  v_elapsed_days := LEAST(GREATEST(v_elapsed_days, 0), 7);
  v_gain := floor(v_elapsed_days * 20)::int;

  v_room := _exp_to_max() - v_total;
  v_gain := LEAST(v_gain, GREATEST(v_room, 0));

  IF v_gain > 0 THEN
    UPDATE user_pets
    SET bonus_exp = bonus_exp + v_gain
    WHERE user_id = p_user_id AND pet_id = v_pet_id;
  END IF;

  UPDATE habitat_pets SET passive_tick_at = now()
  WHERE user_id = p_user_id AND zone = p_zone;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_passive_exp_for(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone public.habitat_zone;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR v_zone IN SELECT unnest(enum_range(NULL::public.habitat_zone))
  LOOP
    PERFORM _accrue_passive_slot(p_user_id, v_zone);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_passive_exp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  PERFORM sync_passive_exp_for(auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.set_habitat_pet(p_pet_id text, p_place boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone public.habitat_zone;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_zone := pet_habitat(p_pet_id);
  IF v_zone IS NULL THEN
    RAISE EXCEPTION 'unknown_pet';
  END IF;

  PERFORM _accrue_passive_slot(auth.uid(), v_zone);

  IF NOT p_place THEN
    DELETE FROM habitat_pets
    WHERE user_id = auth.uid() AND zone = v_zone AND pet_id = p_pet_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_pets WHERE user_id = auth.uid() AND pet_id = p_pet_id
  ) THEN
    RAISE EXCEPTION 'not_owned';
  END IF;

  INSERT INTO habitat_pets (user_id, zone, pet_id, passive_tick_at)
  VALUES (auth.uid(), v_zone, p_pet_id, now())
  ON CONFLICT (user_id, zone) DO UPDATE
    SET pet_id = EXCLUDED.pet_id, created_at = now(), passive_tick_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.pet_duplicate_exp(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._accrue_passive_slot(uuid, public.habitat_zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_passive_exp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_passive_exp_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_passive_exp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_passive_exp_for(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';