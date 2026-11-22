-- Profile picture = an owned pet sprite, or initials when unset.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_pet_id text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_pet_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_pet_fkey
  FOREIGN KEY (id, avatar_pet_id) REFERENCES public.user_pets (user_id, pet_id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_avatar_pet(p_pet_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_pet_id IS NULL OR trim(p_pet_id) = '' THEN
    UPDATE public.profiles SET avatar_pet_id = NULL WHERE id = auth.uid();
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_pets WHERE user_id = auth.uid() AND pet_id = p_pet_id
  ) THEN
    RAISE EXCEPTION 'not_owned';
  END IF;

  UPDATE public.profiles SET avatar_pet_id = p_pet_id WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_avatar_pet(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_avatar_pet(text) TO authenticated;

-- Postgres cannot change RETURNS TABLE via CREATE OR REPLACE; drop first.
DROP FUNCTION IF EXISTS public.user_summaries(uuid, uuid[]);

-- Search / follow lists: expose avatar pet id + gold ring for the badge.
CREATE FUNCTION public.user_summaries(p_viewer uuid, p_ids uuid[])
RETURNS TABLE (
  id uuid,
  handle text,
  display_name text,
  pet_count bigint,
  follows_you boolean,
  followed_by_me boolean,
  avatar_pet_id text,
  avatar_is_gold boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.handle,
    p.display_name,
    (SELECT count(*) FROM user_pets up WHERE up.user_id = p.id),
    EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = p.id AND f.followee_id = p_viewer),
    EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = p_viewer AND f.followee_id = p.id),
    p.avatar_pet_id,
    COALESCE(
      (SELECT up.is_gold FROM user_pets up WHERE up.user_id = p.id AND up.pet_id = p.avatar_pet_id),
      false
    ) AS avatar_is_gold
  FROM unnest(p_ids) WITH ORDINALITY AS ids (uid, ord)
  JOIN profiles p ON p.id = ids.uid
  WHERE p.handle IS NOT NULL
  ORDER BY ids.ord;
$$;

REVOKE ALL ON FUNCTION public.user_summaries(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_summaries(uuid, uuid[]) TO service_role;

DROP FUNCTION IF EXISTS public.leaderboard(uuid, text, integer);

CREATE FUNCTION public.leaderboard(p_viewer uuid, p_scope text, p_limit int)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  handle text,
  display_name text,
  points bigint,
  pet_count bigint,
  is_me boolean,
  avatar_pet_id text,
  avatar_is_gold boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH members AS (
    SELECT p.id, p.handle, p.display_name, p.created_at, p.avatar_pet_id
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
      m.id = p_viewer AS is_me,
      m.avatar_pet_id
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
    r.is_me,
    r.avatar_pet_id,
    COALESCE(
      (SELECT up.is_gold FROM user_pets up WHERE up.user_id = r.user_id AND up.pet_id = r.avatar_pet_id),
      false
    ) AS avatar_is_gold
  FROM ranked r
  WHERE r.rank <= p_limit OR r.is_me
  ORDER BY r.rank;
$$;

REVOKE ALL ON FUNCTION public.leaderboard(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard(uuid, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';