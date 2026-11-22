-- Grafana panel queries for the Tiger dashboard. Setup: tiger/README.md.
-- npm run tiger:dashboard builds tiger/grafana-dashboard.json from this file; re-run it after editing.
-- Each panel uses the Grafana variable $source (multi-value, options: live, simulated) so you can show
-- real scans only, or real + simulated. $__timeFilter() is Grafana's time-range macro.

-- name: Scans per hour by line (time series)
SELECT bucket AS time, line AS metric, sum(scans) AS scans
FROM station_traffic_hourly
WHERE $__timeFilter(bucket) AND source IN ($source)
GROUP BY 1, 2
ORDER BY 1;

-- name: Busiest stations (bar chart)
SELECT station_name, line, sum(scans) AS scans
FROM station_traffic_hourly
WHERE $__timeFilter(bucket) AND source IN ($source)
GROUP BY 1, 2
ORDER BY scans DESC
LIMIT 10;

-- name: Rush-hour profile, average scans per hour of day in Boston (bar chart)
SELECT lpad(extract(hour FROM bucket AT TIME ZONE 'America/New_York')::int::text, 2, '0') || ':00' AS hour,
       round(avg(scans) FILTER (WHERE extract(isodow FROM bucket AT TIME ZONE 'America/New_York') <= 5), 1) AS weekday,
       round(avg(scans) FILTER (WHERE extract(isodow FROM bucket AT TIME ZONE 'America/New_York') > 5), 1) AS weekend
FROM (
  SELECT bucket, sum(scans) AS scans
  FROM station_traffic_hourly
  WHERE $__timeFilter(bucket) AND source IN ($source)
  GROUP BY bucket
) hourly
GROUP BY 1
ORDER BY 1;

-- name: Riders per day (time series)
SELECT time_bucket(INTERVAL '1 day', created_at, 'America/New_York') AS time,
       count(DISTINCT user_id) AS riders
FROM scans
WHERE $__timeFilter(created_at) AND source IN ($source)
GROUP BY 1
ORDER BY 1;

-- name: Drop-rate check (table)
SELECT source, line, rarity, pulls, observed_share, expected_share, z_score
FROM odds_check
WHERE source IN ($source);

-- name: Live scan feed, newest real scans (table, refresh every 10s)
SELECT created_at AS time, station_name, line, pet_id, rarity, is_gold
FROM scans
WHERE source = 'live' AND NOT is_demo
ORDER BY created_at DESC
LIMIT 10;

-- name: Columnstore savings (stat)
SELECT before_compression_total_bytes AS "Before",
       after_compression_total_bytes AS "After",
       round(before_compression_total_bytes::numeric / nullif(after_compression_total_bytes, 0), 1) AS "Smaller by"
FROM hypertable_columnstore_stats('scans');
