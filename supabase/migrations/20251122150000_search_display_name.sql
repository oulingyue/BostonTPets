-- People search matches display names instead of handles: case-insensitive, anywhere in the name,
-- with names that start with the query first. Max 20, excluding the viewer and people without a
-- handle (the app routes to profiles by handle).

CREATE OR REPLACE FUNCTION public.search_users(p_viewer uuid, p_prefix text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    -- Escape LIKE wildcards so "%" and "_" in a name match literally.
    SELECT replace(replace(replace(trim(p_prefix), '\', '\\'), '%', '\%'), '_', '\_') AS pattern
  )
  SELECT p.id
  FROM profiles p, q
  WHERE p.display_name ILIKE '%' || q.pattern || '%'
    AND p.handle IS NOT NULL
    AND p.id <> p_viewer
  ORDER BY (p.display_name ILIKE q.pattern || '%') DESC, lower(p.display_name), p.handle
  LIMIT 20;
$$;

-- CREATE OR REPLACE keeps the existing grants (service_role only); restated for clarity.
REVOKE ALL ON FUNCTION public.search_users(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users(uuid, text) TO service_role;
