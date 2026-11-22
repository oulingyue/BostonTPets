-- SIMULATED history: a week of city-scale scans shaped like T ridership (weekday rush hours at
-- 7-9am and 4-6pm, flatter weekends, busier downtown hubs). Rows are marked source = 'simulated',
-- so every chart can show or hide them. Tell judges this data is simulated.
--
-- Run after 001_analytics.sql, seeds/pets.sql, and at least one CALL sync_from_supabase() (the
-- stations come from Supabase). Re-running replaces the previous simulation.
-- Rolls use the catalog's base odds, without pity or booth odds.

DELETE FROM scans WHERE source = 'simulated';

WITH
params AS (
  SELECT 10 AS scale,    -- multiplies the hourly rates below (10 gives ~25k scans)
         1500 AS riders  -- size of the simulated rider pool
),
-- Downtown hubs appear three times in the pool, so they draw about three times the traffic.
station_pool AS (
  SELECT array_agg(code_id) AS codes
  FROM (
    SELECT code_id FROM stations WHERE active
    UNION ALL
    SELECT code_id
    FROM stations CROSS JOIN generate_series(1, 2)
    WHERE active AND station_name ~* '(park st|downtown crossing|south station|north station|government center|kendall|harvard|back bay)'
  ) s
),
hours AS (
  SELECT h,
         extract(hour FROM h AT TIME ZONE 'America/New_York')::int AS hod,
         extract(isodow FROM h AT TIME ZONE 'America/New_York')::int AS dow
  FROM generate_series(date_trunc('hour', now()) - INTERVAL '7 days',
                       date_trunc('hour', now()) - INTERVAL '1 hour',
                       INTERVAL '1 hour') h
),
volume AS (
  SELECT h, round(rate * p.scale * (0.75 + random() * 0.5))::int AS n
  FROM (
    SELECT h,
      CASE WHEN dow <= 5 THEN  -- weekday
        CASE WHEN hod BETWEEN 7 AND 9 THEN 40
             WHEN hod BETWEEN 16 AND 18 THEN 45
             WHEN hod BETWEEN 10 AND 15 THEN 14
             WHEN hod BETWEEN 19 AND 22 THEN 10
             WHEN hod BETWEEN 5 AND 6 THEN 6
             ELSE 1 END
      ELSE                     -- weekend
        CASE WHEN hod BETWEEN 11 AND 19 THEN 18
             WHEN hod BETWEEN 8 AND 10 OR hod BETWEEN 20 AND 23 THEN 8
             ELSE 1 END
      END AS rate
    FROM hours
  ) x CROSS JOIN params p
),
events AS (
  SELECT v.h + random() * INTERVAL '1 hour' AS created_at,
         sp.codes[1 + floor(random() * cardinality(sp.codes))::int] AS code_id,
         md5('simulated-rider-' || (1 + floor(random() * p.riders))::int)::uuid AS user_id,
         random() * 100 AS roll,
         random() < 0.01 AS is_gold
  FROM volume v
  CROSS JOIN station_pool sp
  CROSS JOIN params p
  CROSS JOIN generate_series(1, v.n)
),
-- Cumulative rarity cut-offs from the catalog weights (common < 60, rare < 90, epic < 98, legendary).
tier_cut AS (
  SELECT rarity,
         sum(sum(weight)) OVER (ORDER BY array_position(ARRAY['common', 'rare', 'epic', 'legendary'], rarity)) AS upper
  FROM pets
  WHERE line = 'red' OR line IS NULL  -- every line has the same tier weights
  GROUP BY rarity
),
pools AS (
  SELECT l.line, p.rarity, array_agg(p.pet_id) AS ids
  FROM (SELECT DISTINCT line FROM pets WHERE line IS NOT NULL) l
  JOIN pets p ON p.line = l.line OR p.line IS NULL
  GROUP BY l.line, p.rarity
)
INSERT INTO scans (scan_id, user_id, code_id, station_name, line, pet_id, rarity, is_gold, points,
                   is_demo, source, created_at)
SELECT nextval('simulated_scan_id'),
       e.user_id,
       e.code_id,
       st.station_name,
       st.line,
       pl.ids[1 + floor(random() * cardinality(pl.ids))::int],
       t.rarity,
       e.is_gold,
       -- duplicate-pull points from points.ts, doubled for gold (no new-pet or daily bonuses)
       CASE t.rarity WHEN 'common' THEN 10 WHEN 'rare' THEN 20 WHEN 'epic' THEN 40 ELSE 70 END
         * CASE WHEN e.is_gold THEN 2 ELSE 1 END,
       false,
       'simulated',
       e.created_at
FROM events e
JOIN stations st ON st.code_id = e.code_id
CROSS JOIN LATERAL (
  SELECT rarity FROM tier_cut WHERE upper > e.roll ORDER BY upper LIMIT 1
) t
JOIN pools pl ON pl.line = st.line AND pl.rarity = t.rarity;

SELECT count(*) AS simulated_scans, min(created_at) AS first, max(created_at) AS last
FROM scans WHERE source = 'simulated';

-- Then run these on their own (they can't run inside a transaction, which some SQL editors use):
--   CALL refresh_continuous_aggregate('station_traffic_hourly', NULL, NULL);
--   CALL refresh_continuous_aggregate('pulls_daily', NULL, NULL);
-- And compress the older chunks now instead of waiting for the policy's next run:
--   SELECT job_id FROM timescaledb_information.jobs
--   WHERE proc_name = 'policy_compression' AND hypertable_name = 'scans';
--   CALL run_job(<that job_id>);
