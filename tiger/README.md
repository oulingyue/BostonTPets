# Tiger Data (analytics)

Use Tiger for **time-series analytics** and the MLH “Best Use of Tiger Data” story:

1. Keep the hypertable schema on Tiger (`migrations/001_game.sql` + `seeds/demo_codes.sql`) — run in the SQL editor or `psql`.
2. **Replicate scans** from Supabase when you want Tiger dashboards full:
   - [Integrate Supabase with Tiger](https://www.tigerdata.com/docs/integrate/data-engineering-etl/supabase) (FDW from Tiger pulling Supabase `scans`), or
   - periodic `INSERT INTO scans ... SELECT` from a script that reads Supabase.

For hackathon demos, show Tiger’s hypertable + continuous aggregate **after** copying scan rows from Supabase (Table Editor → export, or SQL).

## Mark a demo account (Supabase)

```sql
UPDATE public.profiles SET is_demo = true WHERE id = '<user-uuid>';
```