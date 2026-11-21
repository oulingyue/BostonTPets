// POST /functions/v1/social  { action, ...params }
// Profiles, search and follows. Contract (actions, params, return types) is documented in the
// social section of src/lib/api.ts.
//
// Privacy rule: other people's data never includes email, scan history or stations
// (user_pets.first_station is never selected here).
import { withSupabase } from 'npm:@supabase/server@1';

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_QUERY = 3;
const MAX_QUERY = 50;
/** Upper bound on a Following / Followers list. */
const MAX_FOLLOW_LIST = 500;

type SocialRequest =
  | { action: 'search'; query?: unknown }
  | { action: 'profile'; handle?: unknown }
  | { action: 'follows'; handle?: unknown; kind?: unknown }
  | { action: 'counts' }
  | { action: 'follow' | 'unfollow'; userId?: unknown };

type SummaryRow = {
  id: string;
  handle: string;
  display_name: string | null;
  pet_count: number | string;
  follows_you: boolean;
  followed_by_me: boolean;
};

/** Same normalization as src/lib/handle.ts. Returns null if it isn't a valid handle. */
function asHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  return HANDLE_PATTERN.test(handle) ? handle : null;
}

const badRequest = () => Response.json({ error: 'bad_request' }, { status: 400 });

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    const me = ctx.userClaims?.id;
    if (!me) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<SocialRequest>;
    const admin = ctx.supabaseAdmin;

    async function summaries(ids: string[]) {
      if (ids.length === 0) return [];
      const { data, error } = await admin.rpc('user_summaries', { p_viewer: me, p_ids: ids });
      if (error) throw error;
      // bigint can arrive as a string
      return (data as SummaryRow[]).map((row) => ({ ...row, pet_count: Number(row.pet_count) }));
    }

    async function countFollows(column: 'follower_id' | 'followee_id', userId: string) {
      const { count, error } = await admin.from('follows').select('*', { count: 'exact', head: true }).eq(column, userId);
      if (error) throw error;
      return count ?? 0;
    }

    async function idForHandle(handle: string) {
      const { data, error } = await admin.from('profiles').select('id, created_at, last_active_at').eq('handle', handle).maybeSingle();
      if (error) throw error;
      return data as { id: string; created_at: string; last_active_at: string | null } | null;
    }

    try {
      switch (body.action) {
        case 'search': {
          // Display-name search, case-insensitive (matching is in the search_users SQL function).
          // Short queries return nothing rather than an error, since the app searches as you type.
          const query = typeof body.query === 'string' ? body.query.trim().replace(/\s+/g, ' ') : '';
          if (query.length < MIN_QUERY || query.length > MAX_QUERY) return Response.json([]);
          const { data, error } = await admin.rpc('search_users', { p_viewer: me, p_prefix: query });
          if (error) throw error;
          return Response.json(await summaries(data as string[]));
        }

        case 'profile': {
          const handle = asHandle(body.handle);
          if (!handle) return Response.json(null);
          const person = await idForHandle(handle);
          if (!person) return Response.json(null);

          const [[summary], following, followers, stats, pets] = await Promise.all([
            summaries([person.id]),
            countFollows('follower_id', person.id),
            countFollows('followee_id', person.id),
            admin.rpc('my_stats', { p_user_id: person.id }).single(),
            admin.from('user_pets').select('pet_id, copies, is_gold, first_caught_at').eq('user_id', person.id),
          ]);
          if (stats.error) throw stats.error;
          if (pets.error) throw pets.error;
          if (!summary) return Response.json(null);
          const row = stats.data as { total_scans: number | string; lines_visited: number | string };

          return Response.json({
            ...summary,
            following,
            followers,
            created_at: person.created_at,
            last_active_at: person.last_active_at,
            stats: { total_scans: Number(row.total_scans), lines_visited: Number(row.lines_visited) },
            pets: pets.data,
          });
        }

        case 'follows': {
          const handle = asHandle(body.handle);
          if (!handle || (body.kind !== 'following' && body.kind !== 'followers')) return badRequest();
          const person = await idForHandle(handle);
          if (!person) return Response.json([]);

          const [match, other] = body.kind === 'following' ? ['follower_id', 'followee_id'] : ['followee_id', 'follower_id'];
          const { data, error } = await admin
            .from('follows')
            .select(other)
            .eq(match, person.id)
            .order('created_at', { ascending: false })
            .limit(MAX_FOLLOW_LIST);
          if (error) throw error;
          const ids = (data as unknown as Record<string, string>[]).map((row) => row[other]);
          return Response.json(await summaries(ids));
        }

        case 'counts': {
          const [following, followers] = await Promise.all([countFollows('follower_id', me), countFollows('followee_id', me)]);
          return Response.json({ following, followers });
        }

        case 'follow':
        case 'unfollow': {
          const userId = body.userId;
          if (typeof userId !== 'string' || !UUID_PATTERN.test(userId) || userId === me) return badRequest();

          if (body.action === 'unfollow') {
            const { error } = await admin.from('follows').delete().eq('follower_id', me).eq('followee_id', userId);
            if (error) throw error;
            return Response.json({ ok: true });
          }

          const { error } = await admin
            .from('follows')
            .upsert({ follower_id: me, followee_id: userId }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true });
          // 23503: no such user (foreign key)
          if (error?.code === '23503') return Response.json({ error: 'not_found' }, { status: 404 });
          if (error) throw error;
          return Response.json({ ok: true });
        }

        default:
          return badRequest();
      }
    } catch (err) {
      console.error('social error', err);
      return Response.json({ error: 'server_error' }, { status: 500 });
    }
  }),
};
