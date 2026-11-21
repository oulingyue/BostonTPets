-- Profile fields the app's profile page needs: unique @handle, joined date, last active.
-- The follows table and the `social` Edge Function come in a later migration.

ALTER TABLE public.profiles
  ADD COLUMN handle text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_active_at timestamptz;

-- Same rule as src/lib/handle.ts. Null is allowed for accounts made before handles existed.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_format CHECK (handle ~ '^[a-z0-9_]{3,20}$');
CREATE UNIQUE INDEX profiles_handle_key ON public.profiles (handle);

-- Clients may change only their display name. Without this, profiles_update_own would also let a
-- user set their own is_demo (no cooldowns), handle or timestamps.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

-- Copy display_name and handle from the sign-up metadata. A taken or malformed handle makes
-- sign-up fail, which the sign-up form prevents with handle_available().
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handle)
  VALUES (
    NEW.id,
    NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(lower(trim(NEW.raw_user_meta_data ->> 'handle')), '')
  );
  RETURN NEW;
END;
$$;

-- Live availability check on the sign-up form, so it must work signed out.
CREATE OR REPLACE FUNCTION public.handle_available(p_handle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_handle ~ '^[a-z0-9_]{3,20}$'
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE handle = p_handle);
$$;

REVOKE ALL ON FUNCTION public.handle_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_available(text) TO anon, authenticated;

-- Called by the app on open / foreground. Supabase's last_sign_in_at goes stale because sessions persist.
CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_active_at = now() WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.touch_last_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_last_active() TO authenticated;
