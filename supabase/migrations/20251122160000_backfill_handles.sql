-- Give a handle to every profile made before handles existed, so they can be searched for and
-- opened at /user/<handle>. Derived from the display name ("Priya S." -> priya_s); a number is
-- appended on collision; common accents are folded (é -> e); profiles without a usable name get rider_<first 6 hex of id>.
-- One-time data fix: new sign-ups always choose a handle.

DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, display_name FROM public.profiles WHERE handle IS NULL ORDER BY created_at, id LOOP
    base := left(btrim(regexp_replace(
      translate(lower(coalesce(r.display_name, '')), 'àáâãäåāçćčèéêëēìíîïīñńòóôõöøōśšùúûüūýÿžźż', 'aaaaaaaccceeeeeiiiiinnooooooossuuuuuyyzzz'),
      '[^a-z0-9]+', '_', 'g'), '_'), 20);
    IF length(base) < 3 THEN
      base := 'rider_' || left(replace(r.id::text, '-', ''), 6);
    END IF;

    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate) LOOP
      n := n + 1;
      candidate := left(base, 20 - length(n::text) - 1) || '_' || n;
    END LOOP;

    UPDATE public.profiles SET handle = candidate WHERE id = r.id;
  END LOOP;
END;
$$;
