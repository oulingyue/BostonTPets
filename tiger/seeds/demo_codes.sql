-- Demo poster codes (one active code per line). Same ids as supabase/migrations/20251121210000_game.sql.
INSERT INTO scan_codes (id, station_name, line, active) VALUES
  ('00000000000000000000000000000001', 'Park Street (Red)', 'red', true),
  ('00000000000000000000000000000002', 'North Station (Orange)', 'orange', true),
  ('00000000000000000000000000000003', 'Park Street (Green)', 'green', true),
  ('00000000000000000000000000000004', 'Government Center (Blue)', 'blue', true),
  ('00000000000000000000000000000005', 'Airport (Silver)', 'silver', true)
ON CONFLICT (id) DO UPDATE SET
  station_name = EXCLUDED.station_name,
  line = EXCLUDED.line,
  active = EXCLUDED.active;