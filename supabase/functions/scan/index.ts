// POST /functions/v1/scan  { payload: "btp:<id>" }
// Validates the code, rolls a pet server-side, and records it atomically (cooldown included).
//
// Database contract (schema lands in a follow-up PR; see DESIGN.md "Data model"):
//   - table  scan_codes (id text, line t_line, active bool)    -- not readable by clients
//   - table  profiles   (id uuid, is_demo bool)                -- is_demo set by admins only
//   - rpc    record_scan(p_user_id, p_code_id, p_species, p_line, p_is_gold, p_cooldown_hours) -> jsonb
//            { status: 'ok', station_name, copies, is_new, became_gold }
//          | { status: 'cooldown', station_name, next_available_at }
//          | { status: 'invalid_code' }
//            Executable by service_role only; does cooldown check + scan insert + collection upsert in one transaction.
import { withSupabase } from 'npm:@supabase/server@1';
import { isLine, ODDS, parseScanPayload } from '../_shared/game/catalog.ts';
import type { ScanRequest, ScanResponse } from '../_shared/game/api.ts';
import { rollPet } from '../_shared/game/roll.ts';

const reply = (body: ScanResponse) => Response.json(body);

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<ScanRequest>;
    const codeId = parseScanPayload(typeof body.payload === 'string' ? body.payload : '');
    if (!codeId) return reply({ status: 'invalid_code' });

    // scan_codes and profiles.is_demo are not readable by clients, so use the admin client.
    // Both queries are filtered to this code / this caller.
    const admin = ctx.supabaseAdmin;
    const { data: code, error: codeError } = await admin
      .from('scan_codes')
      .select('id, line, active')
      .eq('id', codeId)
      .maybeSingle();
    if (codeError) return Response.json({ error: 'server_error' }, { status: 500 });
    if (!code || !code.active || !isLine(code.line)) return reply({ status: 'invalid_code' });

    const { data: profile } = await admin.from('profiles').select('is_demo').eq('id', userId).maybeSingle();
    const demo = profile?.is_demo === true;

    const roll = rollPet(code.line, { demo });

    const { data, error } = await admin.rpc('record_scan', {
      p_user_id: userId,
      p_code_id: code.id,
      p_species: roll.species,
      p_line: roll.line,
      p_is_gold: roll.isGold,
      p_cooldown_hours: demo ? 0 : ODDS.cooldownHours,
    });
    if (error || !data) return Response.json({ error: 'server_error' }, { status: 500 });

    const result = data as {
      status: 'ok' | 'cooldown' | 'invalid_code';
      station_name?: string;
      next_available_at?: string;
      copies?: number;
      is_new?: boolean;
      became_gold?: boolean;
    };

    switch (result.status) {
      case 'cooldown':
        return reply({
          status: 'cooldown',
          stationName: result.station_name!,
          nextAvailableAt: result.next_available_at!,
        });
      case 'invalid_code':
        return reply({ status: 'invalid_code' });
      case 'ok':
        return reply({
          status: 'ok',
          stationName: result.station_name!,
          pet: roll,
          copies: result.copies!,
          isNew: result.is_new!,
          becameGold: result.became_gold!,
        });
    }
  }),
};
