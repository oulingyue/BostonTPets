# Tiger Data analytics

Supabase runs the app. Tiger Data keeps a time-series copy of every scan and answers questions about
it: which stations are busiest, when rush hour is, and whether the gacha really pays out at the odds
it promises. Nothing in the app reads from Tiger, so if Tiger is down, the game still works.

```
 phone ──scan──▶ Supabase (scan Edge Function, Postgres)
                     ▲
                     │ every minute: Tiger job + postgres_fdw (read-only role)
                     │
                 Tiger Data ──▶ Grafana dashboard
                 · scans hypertable (1-day chunks, columnstore after 2 days, 1-year retention)
                 · station_traffic_hourly, pulls_daily (real-time continuous aggregates)
                 · odds_check view
```

Tiger pulls from Supabase instead of Supabase pushing, because Supabase Edge Functions can't connect
to Tiger: Tiger's server certificate is marked as a CA (`CA:TRUE`), which Deno's TLS rejects
(`CaUsedAsEndEntity`).

## What to show judges

| Feature | Where |
| --- | --- |
| Hypertable with 1-day chunks | `scans` in [migrations/001_analytics.sql](migrations/001_analytics.sql) |
| Columnstore compression + savings | `add_columnstore_policy`; the **Columnstore savings** panel |
| Real-time continuous aggregates | `station_traffic_hourly`, `pulls_daily`: a scan shows up right away |
| Retention policy | `add_retention_policy('scans', drop_after => INTERVAL '1 year')` |
| Scheduled job pulling live data | `sync_from_supabase` job in [migrations/002_sync.sql](migrations/002_sync.sql) |
| Drop-rate check | `odds_check`: observed rarity share vs the catalog odds, with a z-score per line |

Demo idea: have a judge scan a poster code, then watch it appear in the **Live scan feed** panel
within a minute.

**Simulated data:** [seeds/simulate.sql](seeds/simulate.sql) adds a week of made-up, commute-shaped
traffic (about 25k scans) so the charts have something to show. Every simulated row has
`source = 'simulated'`, and the dashboard's `source` filter switches it on and off. Tell judges which
charts include it.

## Setup

Run the SQL in the Tiger console's SQL editor (or `psql`), in this order. Never commit a password.

1. **Supabase: read-only role.** Deploy the migration `supabase/migrations/20261123100000_tiger_reader.sql`
   (`npx supabase db push`), then in the Supabase SQL editor give it a password:
   ```sql
   ALTER ROLE tiger_reader WITH LOGIN PASSWORD '<a long random password>';
   ```
2. **Tiger: check postgres_fdw is allowed.** We couldn't confirm this from Tiger's docs:
   ```sql
   SELECT name, installed_version FROM pg_available_extensions WHERE name = 'postgres_fdw';
   ```
   No row means Tiger doesn't offer it. Stop here and ask for a sync script instead.
3. **Tiger: schema.** Run [migrations/001_analytics.sql](migrations/001_analytics.sql), then
   [seeds/pets.sql](seeds/pets.sql). This drops the old mirror tables.
4. **Tiger: sync.** In [migrations/002_sync.sql](migrations/002_sync.sql), replace
   `<supabase-pooler-host>` with your session pooler host (Supabase dashboard → **Connect** →
   **Session pooler**), run it, then add the login and test it:
   ```sql
   CREATE USER MAPPING FOR CURRENT_USER SERVER supabase
     OPTIONS (user 'tiger_reader.<supabase-project-ref>', password '<tiger_reader password>');
   CALL sync_from_supabase();
   SELECT count(*) FROM stations;  -- should match scan_codes on Supabase
   ```
   The pooler needs the `.<project-ref>` suffix on the user name. Then start the job:
   ```sql
   SELECT add_job('sync_from_supabase', INTERVAL '1 minute')
   WHERE NOT EXISTS (SELECT 1 FROM timescaledb_information.jobs WHERE proc_name = 'sync_from_supabase');
   ```
5. **Tiger: simulated history (optional).** Run [seeds/simulate.sql](seeds/simulate.sql), then the
   refresh and compression lines at the bottom of that file, each on its own.
6. **Grafana.** See below.

Check the jobs with:
```sql
SELECT job_id, proc_name, last_run_status, last_successful_finish, total_failures
FROM timescaledb_information.job_stats JOIN timescaledb_information.jobs USING (job_id);
```

## Grafana dashboard

Grafana Cloud's free tier works and can be opened on any laptop or projector.

1. Make a read-only Tiger login for Grafana, in the Tiger SQL editor:
   ```sql
   CREATE ROLE grafana_reader LOGIN PASSWORD '<another password>';
   GRANT USAGE ON SCHEMA public TO grafana_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
   ```
2. In Grafana add a **PostgreSQL** data source: host `<tiger-host>:<port>` from your Tiger connection
   string, database `tsdb`, user `grafana_reader`, **TLS/SSL mode `require`** (Tiger's certificate comes
   from a private CA), and turn on **TimescaleDB**.
3. Add a dashboard variable: **Custom**, name `source`, values `live,simulated`, **Multi-value** on.
4. Add one panel per query in [dashboard.sql](dashboard.sql); each query's header says which panel type
   to use.

## Changing the catalog

`seeds/pets.sql` is generated from `catalog.ts`. After changing pets or odds, run `npm run tiger:pets`
and re-run `seeds/pets.sql` on Tiger.

## Mark a demo account (Supabase)

```sql
UPDATE public.profiles SET is_demo = true WHERE id = '<user-uuid>';
```

Demo accounts roll with boosted odds, so the odds check leaves them out. The next sync picks up the
change, including for scans already copied.
