-- One-way follows, plus read helpers for the `social` Edge Function.
-- Clients have no direct access: every read and write goes through `social` with the service role,
-- which applies the privacy rule (no email, scan history or stations for other people).

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_not_self CHECK (follower_id <> followee_id)
);

-- The PK covers "who do I follow"; this covers "who follows me".
CREATE INDEX follows_followee_idx ON public.follows (followee_id, created_at DESC);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
-- No policies: anon and authenticated can't read or write it.

-- Summaries of p_ids as seen by p_viewer, in the order given. Skips ids without a handle,
-- since the app routes to people by handle.
CREATE OR REPLACE FUNCTION public.user_summaries(p_viewer uuid, p_ids uuid[])
RETURNS TABLE (
  id uuid,
  handle text,
  display_name text,
  pet_count bigint,
  follows_you boolean,
  followed_by_me boolean
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
    EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = p_viewer AND f.followee_id = p.id)
  FROM unnest(p_ids) WITH ORDINALITY AS ids (uid, ord)
  JOIN profiles p ON p.id = ids.uid
  WHERE p.handle IS NOT NULL
  ORDER BY ids.ord;
$$;

-- Handle-prefix search, max 20, excluding the viewer. `_` is a LIKE wildcard but legal in
-- handles, so it's escaped.
CREATE OR REPLACE FUNCTION public.search_users(p_viewer uuid, p_prefix text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM profiles
  WHERE handle LIKE replace(lower(p_prefix), '_', '\_') || '%'
    AND id <> p_viewer
  ORDER BY handle
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.user_summaries(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_summaries(uuid, uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.search_users(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users(uuid, text) TO service_role;
