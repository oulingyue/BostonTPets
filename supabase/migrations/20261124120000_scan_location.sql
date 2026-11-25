-- Where each QR code is posted, so the scan function can check the phone is nearby
-- (rules in supabase/functions/_shared/game/location.ts).
--
-- A code with no lat/lng skips the check, so codes can be given a location one at a time.
-- radius_m is generous by default: GPS doesn't reach underground platforms, and phones fall back to
-- Wi-Fi and cell positions that can be a few hundred meters off.

ALTER TABLE public.scan_codes
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision,
  ADD COLUMN radius_m integer NOT NULL DEFAULT 250,
  ADD CONSTRAINT scan_codes_location_pair CHECK ((lat IS NULL) = (lng IS NULL)),
  ADD CONSTRAINT scan_codes_lat_range CHECK (lat BETWEEN -90 AND 90),
  ADD CONSTRAINT scan_codes_lng_range CHECK (lng BETWEEN -180 AND 180),
  ADD CONSTRAINT scan_codes_radius_positive CHECK (radius_m > 0);
