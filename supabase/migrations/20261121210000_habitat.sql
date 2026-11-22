-- One pet per habitat band. The zone list matches HABITAT_OF in
-- supabase/functions/_shared/game/catalog.ts. Clients can read their own rows;
-- writes go through set_habitat_pet so a pet must be owned and the band stays at one.

CREATE TYPE public.habitat_zone AS ENUM ('sky', 'earth', 'water');

CREATE TABLE public.habitat_pets (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  zone public.habitat_zone NOT NULL,
  pet_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, zone)
);

ALTER TABLE public.habitat_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY habitat_pets_select_own ON public.habitat_pets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.pet_habitat(p_pet_id text)
RETURNS public.habitat_zone
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_pet_id
    WHEN 'pigeon' THEN 'sky'::public.habitat_zone
    WHEN 'red_tailed_hawk' THEN 'sky'::public.habitat_zone
    WHEN 'northern_cardinal' THEN 'sky'::public.habitat_zone
    WHEN 'bc_eagle' THEN 'sky'::public.habitat_zone
    WHEN 'blue_jay' THEN 'sky'::public.habitat_zone
    WHEN 'piping_plover' THEN 'sky'::public.habitat_zone
    WHEN 'snowy_owl' THEN 'sky'::public.habitat_zone
    WHEN 'peregrine_falcon' THEN 'sky'::public.habitat_zone
    WHEN 'herring_gull' THEN 'sky'::public.habitat_zone
    WHEN 'monarch_butterfly' THEN 'sky'::public.habitat_zone
    WHEN 'wild_turkey' THEN 'earth'::public.habitat_zone
    WHEN 'gray_squirrel' THEN 'earth'::public.habitat_zone
    WHEN 'mit_beaver' THEN 'earth'::public.habitat_zone
    WHEN 'raccoon' THEN 'earth'::public.habitat_zone
    WHEN 'bu_terrier' THEN 'earth'::public.habitat_zone
    WHEN 'boston_terrier' THEN 'earth'::public.habitat_zone
    WHEN 'red_fox' THEN 'earth'::public.habitat_zone
    WHEN 'northeastern_husky' THEN 'earth'::public.habitat_zone
    WHEN 'wentworth_leopard' THEN 'earth'::public.habitat_zone
    WHEN 'orange_tabby_cat' THEN 'earth'::public.habitat_zone
    WHEN 'haymarket_rat' THEN 'earth'::public.habitat_zone
    WHEN 'mallard_duck' THEN 'water'::public.habitat_zone
    WHEN 'canada_goose' THEN 'water'::public.habitat_zone
    WHEN 'swan' THEN 'water'::public.habitat_zone
    WHEN 'lobster' THEN 'water'::public.habitat_zone
    WHEN 'alewife' THEN 'water'::public.habitat_zone
    WHEN 'snapping_turtle' THEN 'water'::public.habitat_zone
    WHEN 'bullfrog' THEN 'water'::public.habitat_zone
    WHEN 'humpback_whale' THEN 'water'::public.habitat_zone
    WHEN 'harbor_seal' THEN 'water'::public.habitat_zone
    WHEN 'penguin' THEN 'water'::public.habitat_zone
    WHEN 'atlantic_cod' THEN 'water'::public.habitat_zone
    WHEN 'horseshoe_crab' THEN 'water'::public.habitat_zone
    WHEN 'striped_bass' THEN 'water'::public.habitat_zone
    WHEN 'moon_jellyfish' THEN 'water'::public.habitat_zone
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.my_habitat()
RETURNS TABLE (zone public.habitat_zone, pet_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT zone, pet_id FROM habitat_pets WHERE user_id = auth.uid();
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

  INSERT INTO habitat_pets (user_id, zone, pet_id)
  VALUES (auth.uid(), v_zone, p_pet_id)
  ON CONFLICT (user_id, zone) DO UPDATE
    SET pet_id = EXCLUDED.pet_id, created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.pet_habitat(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_habitat() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_habitat_pet(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_habitat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_habitat_pet(text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
