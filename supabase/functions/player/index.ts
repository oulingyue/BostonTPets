// POST /functions/v1/player  { resource: "pets" | "history" | "stats" | "leaderboard", limit?: number, scope?: "global" | "friends" }
import { withSupabase } from 'npm:@supabase/server@1';

type PlayerRequest =
  | { resource: 'pets' }
  | { resource: 'history'; limit?: number }
  | { resource: 'stats' }
  | { resource: 'leaderboard'; scope?: 'global' | 'friends' };

/** Rows on a board. The caller's own row is added below them when it ranks lower. */
const LEADERBOARD_SIZE = 50;

type LeaderboardRow = {
  rank: number | string;
  user_id: string;
  handle: string;
  display_name: string | null;
  points: number | string;
  pet_count: number | string;
  is_me: boolean;
  avatar_pet_id: string | null;
  avatar_is_gold: boolean;
};

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
          const { error: syncError } = await admin.rpc('sync_passive_exp_for', { p_user_id: userId });
          if (syncError) throw syncError;
          const { data, error } = await admin
            .from('user_pets')
            .select('pet_id, copies, is_gold, first_caught_at, first_station, bonus_exp')
            .eq('user_id', userId);
          if (error) throw error;
          return Response.json(data);
        }
        case 'history': {
          const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);
          const { data, error } = await admin
            .from('scans')
            .select('id, station_name, pet_id, is_gold, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
          if (error) throw error;
          return Response.json(data);
        }
        case 'stats': {
          const { data, error } = await admin.rpc('my_stats', { p_user_id: userId }).single();
          if (error) throw error;
          const row = data as { total_scans: number | string; lines_visited: number | string; points: number | string };
          return Response.json({
            total_scans: Number(row.total_scans),
            lines_visited: Number(row.lines_visited),
            points: Number(row.points),
          });
        }
        case 'leaderboard': {
          // Ranking rules (demo accounts left out, ties, who's on each board) are in the leaderboard SQL function.
          const scope = body.scope;
          if (scope !== 'global' && scope !== 'friends') return Response.json({ error: 'bad_request' }, { status: 400 });
          const { data, error } = await admin.rpc('leaderboard', { p_viewer: userId, p_scope: scope, p_limit: LEADERBOARD_SIZE });
          if (error) throw error;
          // bigint can arrive as a string
          const rows = (data as LeaderboardRow[]).map((r) => ({
            ...r,
            rank: Number(r.rank),
            points: Number(r.points),
            pet_count: Number(r.pet_count),
            avatar_pet_id: r.avatar_pet_id ?? null,
            avatar_is_gold: Boolean(r.avatar_is_gold),
          }));
          return Response.json({
            entries: rows.filter((r) => r.rank <= LEADERBOARD_SIZE),
            me: rows.find((r) => r.is_me) ?? null,
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