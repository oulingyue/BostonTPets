-- Tiger Data analytics for BostonTPets. Supabase stays the app's database; Tiger keeps a copy of every
-- scan (pulled by 002_sync.sql) plus optional simulated history (seeds/simulate.sql), and answers
-- time-series questions about them. Nothing in the app reads from Tiger.
--
-- Safe to re-run: it drops and recreates everything below, including the old mirror schema
-- (record_scan, user_pets, scan_activity_hourly) that this replaces.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Old mirror schema ----------------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS scan_activity_hourly CASCADE;
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('record_scan', 'my_stats')
  LOOP
    EXECUTE 'DROP FUNCTION ' || f;
  END LOOP;
END $$;
DROP TABLE IF EXISTS user_pets, scan_codes CASCADE;

-- Current schema (drop first so re-runs start clean) -------------------------------------------------
DROP VIEW IF EXISTS odds_check;
DROP MATERIALIZED VIEW IF EXISTS station_traffic_hourly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS pulls_daily CASCADE;
DROP TABLE IF EXISTS scans, stations, riders, pets CASCADE;
DROP TYPE IF EXISTS t_species, t_line CASCADE;
DROP SEQUENCE IF EXISTS simulated_scan_id;

-- Lookup tables ----------------------------------------------------------------------------------------

-- Copy of Supabase scan_codes, refreshed by the sync job.
CREATE TABLE stations (
  code_id text PRIMARY KEY,
  station_name text NOT NULL,
  line text NOT NULL,
  active boolean NOT NULL
);

-- The catalog, from seeds/pets.sql (generated from catalog.ts).
CREATE TABLE pets (
  pet_id text PRIMARY KEY,
  name text NOT NULL,
  rarity text NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  line text,
  weight int NOT NULL CHECK (weight > 0)
);

-- Only the demo flag from Supabase profiles: no names, handles or emails leave Supabase.
CREATE TABLE riders (
  user_id uuid PRIMARY KEY,
  is_demo boolean NOT NULL
);

-- Scans hypertable ---------------------------------------------------------------------------------------
-- One row per pull. Rarity and the demo flag are copied onto the row, so the continuous aggregates
-- below don't need joins. source is 'live' (copied from Supabase) or 'simulated' (seeds/simulate.sql).
CREATE TABLE scans (
  scan_id bigint NOT NULL,
  user_id uuid NOT NULL,
  code_id text NOT NULL,
  station_name text NOT NULL,
  line text NOT NULL,
  pet_id text NOT NULL,
  rarity text,                       -- NULL for a pet id that isn't in the catalog
  is_gold boolean NOT NULL,
  points int NOT NULL,
  is_demo boolean NOT NULL,          -- booth accounts roll with boosted odds; excluded from the odds check
  source text NOT NULL CHECK (source IN ('live', 'simulated')),
  created_at timestamptz NOT NULL
);

-- 1-day chunks: a week of history is ~7 chunks, so the columnstore and retention policies have
-- something to act on.
SELECT create_hypertable('scans', by_range('created_at', INTERVAL '1 day'));

-- Unique keys on a hypertable must include the partition column.
CREATE UNIQUE INDEX scans_source_id_idx ON scans (source, scan_id, created_at);
CREATE INDEX scans_station_idx ON scans (code_id, created_at DESC);

CREATE SEQUENCE simulated_scan_id;

-- Columnstore: chunks older than 2 days are converted to compressed columnar storage, grouped by line.
ALTER TABLE scans SET (
  timescaledb.enable_columnstore,
  timescaledb.segmentby = 'line',
  timescaledb.orderby = 'created_at DESC'
);
CALL add_columnstore_policy('scans', after => INTERVAL '2 days');

-- Retention: raw scans are kept for a year. The continuous aggregates keep their own rollups.
SELECT add_retention_policy('scans', drop_after => INTERVAL '1 year');

-- Continuous aggregates ------------------------------------------------------------------------------------
-- materialized_only = false turns on real-time aggregation (off by default since TimescaleDB 2.13), so
-- a scan made during the demo shows up right away instead of after the next refresh.

-- Traffic per station per hour: busiest stations, rush hours, line comparisons.
CREATE MATERIALIZED VIEW station_traffic_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  time_bucket(INTERVAL '1 hour', created_at) AS bucket,
  source,
  is_demo,
  line,
  code_id,
  station_name,
  count(*) AS scans,
  sum(CASE WHEN is_gold THEN 1 ELSE 0 END) AS gold_scans,
  sum(points) AS points
FROM scans
GROUP BY bucket, source, is_demo, line, code_id, station_name
WITH NO DATA;

SELECT add_continuous_aggregate_policy('station_traffic_hourly',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes');

-- Pulls per Boston calendar day by line and rarity: feeds the odds check.
CREATE MATERIALIZED VIEW pulls_daily
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  time_bucket(INTERVAL '1 day', created_at, 'America/New_York') AS bucket,
  source,
  is_demo,
  line,
  rarity,
  count(*) AS pulls,
  sum(CASE WHEN is_gold THEN 1 ELSE 0 END) AS gold_pulls
FROM scans
GROUP BY bucket, source, is_demo, line, rarity
WITH NO DATA;

SELECT add_continuous_aggregate_policy('pulls_daily',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes');

-- Odds check ------------------------------------------------------------------------------------------------
-- Observed share of each rarity per line vs the share the catalog's weights promise, for every
-- non-demo pull. z_score is (observed - expected) / standard error; |z| under 3 means the difference is
-- ordinary randomness. With 20 rows, expect one |z| near 2 now and then by chance alone. Live pulls run slightly rich in epic+ because hard pity forces an epic or better
-- after 9 misses; simulated pulls skip pity.
CREATE VIEW odds_check AS
WITH expected AS (
  SELECT l.line, p.rarity, sum(p.weight)::numeric / 100 AS expected_share
  FROM (SELECT DISTINCT line FROM pets WHERE line IS NOT NULL) l
  JOIN pets p ON p.line = l.line OR p.line IS NULL
  GROUP BY l.line, p.rarity
),
observed AS (
  SELECT source, line, rarity, sum(pulls) AS pulls
  FROM pulls_daily
  WHERE NOT is_demo AND rarity IS NOT NULL
  GROUP BY source, line, rarity
),
totals AS (
  SELECT source, line, sum(pulls) AS total FROM observed GROUP BY source, line
)
SELECT
  t.source,
  e.line,
  e.rarity,
  coalesce(o.pulls, 0) AS pulls,
  t.total AS line_pulls,
  round(coalesce(o.pulls, 0) / t.total, 4) AS observed_share,
  round(e.expected_share, 4) AS expected_share,
  -- NULL until the line has enough pulls (5+ expected) for the normal approximation to hold.
  CASE WHEN t.total * e.expected_share >= 5 THEN
    round(
      (coalesce(o.pulls, 0) / t.total - e.expected_share)
        / sqrt(e.expected_share * (1 - e.expected_share) / t.total),
      2)
  END AS z_score
FROM totals t
JOIN expected e ON e.line = t.line
LEFT JOIN observed o ON o.source = t.source AND o.line = e.line AND o.rarity = e.rarity
ORDER BY t.source, e.line, array_position(ARRAY['common', 'rare', 'epic', 'legendary'], e.rarity);
