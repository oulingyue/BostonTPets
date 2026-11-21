// POST /functions/v1/player  { resource: "pets" | "history" | "stats", limit?: number }
import { withSupabase } from 'npm:@supabase/server@1';

type PlayerRequest =
  | { resource: 'pets' }
  | { resource: 'history'; limit?: number }
  | { resource: 'stats' };

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<PlayerRequest>;
    const admin = ctx.supabaseAdmin;

    try {
      switch (body.resource) {
        case 'pets': {
          const { data, error } = await admin
            .from('user_pets')
            .select('species, line, copies, is_gold, first_caught_at, first_station')
            .eq('user_id', userId);
          if (error) throw error;
          return Response.json(data);
        }
        case 'history': {
          const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);
          const { data, error } = await admin
            .from('scans')
            .select('id, station_name, species, line, is_gold, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
          if (error) throw error;
          return Response.json(data);
        }
        case 'stats': {
          const { data, error } = await admin.rpc('my_stats', { p_user_id: userId }).single();
          if (error) throw error;
          const row = data as { total_scans: number | string; lines_visited: number | string };
          return Response.json({
            total_scans: Number(row.total_scans),
            lines_visited: Number(row.lines_visited),
          });
        }
        default:
          return Response.json({ error: 'bad_request' }, { status: 400 });
      }
    } catch (err) {
      console.error('player error', err);
      return Response.json({ error: 'server_error' }, { status: 500 });
    }
  }),
};