-- Leaderboard points. Every scan stores the points it earned (scans.points); the boards sum them.
-- Scoring rules live in supabase/functions/_shared/game/points.ts. The scan Edge Function sends the
-- new-pet and duplicate values for the rolled pet (rarity x gold); record_scan picks one and adds the
-- daily bonus, because only it knows whether the pet is new and whether this is today's first scan.
-- Changing the rules later does not rescore old scans.

ALTER TABLE public.scans ADD COLUMN points int NOT NULL DEFAULT 0 CHECK (points >= 0);

-- One-time backfill of existing scans with the same rules: new pet 25/50/100/175, duplicate 10/20/40/70,
-- gold x2, +50 on the first scan of each Boston day. Values generated from catalog.ts + points.ts.
-- Rows with pet ids that aren't in the catalog (skeleton ids like red_lobster) stay at 0.
WITH pet_points (pet_id, new_points, duplicate_points) AS (
  VALUES
    ('mallard_duck', 25, 10),
    ('canada_goose', 25, 10),
    ('wild_turkey', 25, 10),
    ('pigeon', 25, 10),
    ('gray_squirrel', 25, 10),
    ('alewife', 50, 20),
    ('northern_cardinal', 50, 20),
    ('raccoon', 50, 20),
    ('mit_beaver', 100, 40),
    ('red_tailed_hawk', 100, 40),
    ('lobster', 175, 70),
    ('monarch_butterfly', 50, 20),
    ('orange_tabby_cat', 50, 20),
    ('haymarket_rat', 50, 20),
    ('northeastern_husky', 100, 40),
    ('wentworth_leopard', 100, 40),
    ('red_fox', 175, 70),
    ('boston_terrier', 50, 20),
    ('swan', 50, 20),
    ('bullfrog', 50, 20),
    ('bu_terrier', 100, 40),
    ('bc_eagle', 100, 40),
    ('snapping_turtle', 175, 70),
    ('blue_jay', 50, 20),
    ('horseshoe_crab', 50, 20),
    ('piping_plover', 50, 20),
    ('harbor_seal', 100, 40),
    ('penguin', 100, 40),
    ('humpback_whale', 175, 70),
    ('herring_gull', 50, 20),
    ('striped_bass', 50, 20),
    ('moon_jellyfish', 50, 20),
    ('atlantic_cod', 100, 40),
    ('peregrine_falcon', 100, 40),
    ('snowy_owl', 175, 70)
),
scored AS (
  SELECT
    s.id,
    CASE
      WHEN row_number() OVER (PARTITION BY s.user_id, s.pet_id ORDER BY s.created_at, s.id) = 1 THEN pp.new_points
      ELSE pp.duplicate_points
    END * CASE WHEN s.is_gold THEN 2 ELSE 1 END
    + CASE
        WHEN row_number() OVER (
          PARTITION BY s.user_id, (s.created_at AT TIME ZONE 'America/New_York')::date
          ORDER BY s.created_at, s.id
        ) = 1 THEN 50
        ELSE 0
      END AS points
  FROM public.scans s
  JOIN pet_points pp ON pp.pet_id = s.pet_id
)
UPDATE public.scans s
SET points = scored.points
FROM scored
WHERE scored.id = s.id;

-- record_scan: same as 20251122100000_roll_pity.sql, plus p_new_points / p_duplicate_points /
-- p_daily_bonus. Returns points and daily_bonus.
DROP FUNCTION IF EXISTS public.record_scan(uuid, text, text, boolean, integer, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION public.record_scan(
  p_user_id uuid,
  p_code_id text,
  p_pet_id text,
  p_is_gold boolean,
  p_cooldown_hours int,
  p_expected_epic_plus int,
  p_expected_legendary int,
  p_since_epic_plus int,
  p_since_legendary int,
  p_new_points int,
  p_duplicate_points int,
  p_daily_bonus int
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
  v_day_start timestamptz;
  v_daily_bonus int;
  v_points int;
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

  -- Today's first scan, by the Boston calendar (DAY_TIME_ZONE in points.ts). Checked before the insert.
  v_day_start := date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York';
  IF EXISTS (SELECT 1 FROM scans WHERE user_id = p_user_id AND created_at >= v_day_start) THEN
    v_daily_bonus := 0;
  ELSE
    v_daily_bonus := greatest(p_daily_bonus, 0);
  END IF;

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

  v_points := greatest(CASE WHEN v_is_new THEN p_new_points ELSE p_duplicate_points END, 0) + v_daily_bonus;

  INSERT INTO scans (user_id, code_id, station_name, code_line, pet_id, is_gold, points)
  VALUES (p_user_id, p_code_id, v_station, v_code_line, p_pet_id, p_is_gold, v_points);

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
    'became_gold', v_became_gold,
    'points', v_points,
    'daily_bonus', v_daily_bonus
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_scan(uuid, text, text, boolean, integer, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_scan(uuid, text, text, boolean, integer, integer, integer, integer, integer, integer, integer, integer) TO service_role;

-- my_stats gains a points total (shown as a stat tile on profiles).
DROP FUNCTION IF EXISTS public.my_stats(uuid);

CREATE FUNCTION public.my_stats(p_user_id uuid)
RETURNS TABLE (total_scans bigint, lines_visited bigint, points bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint, count(DISTINCT code_line)::bigint, coalesce(sum(points), 0)::bigint
  FROM scans
  WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.my_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_stats(uuid) TO service_role;

-- Points leaderboard, for the `player` Edge Function (resource 'leaderboard').
--   p_scope 'global':  every non-demo player with points > 0.
--   p_scope 'friends': the viewer plus everyone they follow (non-demo), including 0 points.
-- Returns the top p_limit rows plus the viewer's own row if it ranks lower (is_me marks it).
-- Demo accounts (profiles.is_demo) are never ranked, so a demo viewer gets no row of their own.
-- Ties: whoever reached the score first (earlier last scan), then earlier sign-up, then id.
CREATE FUNCTION public.leaderboard(p_viewer uuid, p_scope text, p_limit int)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  handle text,
  display_name text,
  points bigint,
  pet_count bigint,
  is_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH members AS (
    SELECT p.id, p.handle, p.display_name, p.created_at
    FROM profiles p
    WHERE NOT p.is_demo
      AND p.handle IS NOT NULL
      AND (
        p_scope = 'global'
        OR (p_scope = 'friends' AND (
          p.id = p_viewer
          OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = p_viewer AND f.followee_id = p.id)
        ))
      )
  ),
  totals AS (
    SELECT s.user_id, sum(s.points)::bigint AS points, max(s.created_at) AS last_scan_at
    FROM scans s
    JOIN members m ON m.id = s.user_id
    GROUP BY s.user_id
  ),
  ranked AS (
    SELECT
      row_number() OVER (
        ORDER BY coalesce(t.points, 0) DESC, t.last_scan_at ASC NULLS LAST, m.created_at ASC, m.id
      ) AS rank,
      m.id AS user_id,
      m.handle,
      m.display_name,
      coalesce(t.points, 0) AS points,
      m.id = p_viewer AS is_me
    FROM members m
    LEFT JOIN totals t ON t.user_id = m.id
    WHERE p_scope = 'friends' OR coalesce(t.points, 0) > 0
  )
  SELECT
    r.rank,
    r.user_id,
    r.handle,
    r.display_name,
    r.points,
    (SELECT count(*) FROM user_pets up WHERE up.user_id = r.user_id)::bigint AS pet_count,
    r.is_me
  FROM ranked r
  WHERE r.rank <= p_limit OR r.is_me
  ORDER BY r.rank;
$$;

REVOKE ALL ON FUNCTION public.leaderboard(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard(uuid, text, integer) TO service_role;
