-- Read-only role that Tiger Data uses to copy scans for analytics (tiger/migrations/002_sync.sql).
-- It can read scans, scan_codes, and only the id and is_demo columns of profiles. Nothing else.
--
-- The role is created without a login. To turn it on, set a password once in the Supabase SQL editor
-- (never commit it):
--   ALTER ROLE tiger_reader WITH LOGIN PASSWORD '<a long random password>';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tiger_reader') THEN
    CREATE ROLE tiger_reader NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO tiger_reader;
GRANT SELECT ON public.scans, public.scan_codes TO tiger_reader;
GRANT SELECT (id, is_demo) ON public.profiles TO tiger_reader;

-- These tables have row-level security, which would otherwise hide every row from this role.
CREATE POLICY scans_select_tiger ON public.scans FOR SELECT TO tiger_reader USING (true);
CREATE POLICY scan_codes_select_tiger ON public.scan_codes FOR SELECT TO tiger_reader USING (true);
CREATE POLICY profiles_select_tiger ON public.profiles FOR SELECT TO tiger_reader USING (true);
