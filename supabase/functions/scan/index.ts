// POST /functions/v1/scan  { payload: "btp:<id>" }
import { withSupabase } from 'npm:@supabase/server@1';
import { isLine, ODDS, parseScanPayload } from '../_shared/game/catalog.ts';
import type { ScanRequest, ScanResponse } from '../_shared/game/api.ts';
import { rollPet, type PityState } from '../_shared/game/roll.ts';

const reply = (body: ScanResponse) => Response.json(body);

type RecordedScan = {
  status: 'ok' | 'cooldown' | 'invalid_code' | 'pity_conflict';
  station_name?: string;
  next_available_at?: string;
  copies?: number;
  is_new?: boolean;
  became_gold?: boolean;
};

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<ScanRequest>;
    const codeId = parseScanPayload(typeof body.payload === 'string' ? body.payload : '');
    if (!codeId) return reply({ status: 'invalid_code' });

    const admin = ctx.supabaseAdmin;
    const { data: code, error: codeError } = await admin
      .from('scan_codes')
      .select('id, line, active')
      .eq('id', codeId)
      .maybeSingle();
    if (codeError) return Response.json({ error: 'server_error' }, { status: 500 });
    if (!code || !code.active || !isLine(code.line)) return reply({ status: 'invalid_code' });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_demo')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) return Response.json({ error: 'server_error' }, { status: 500 });
    const demo = profile?.is_demo === true;

    // Re-roll if another scan for this user committed pity between the read and the write.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: pityRow, error: pityError } = await admin
        .from('roll_pity')
        .select('since_epic_plus, since_legendary')
        .eq('user_id', userId)
        .maybeSingle();
      if (pityError) return Response.json({ error: 'server_error' }, { status: 500 });

      const pity: PityState = {
        sinceEpicPlus: pityRow?.since_epic_plus ?? 0,
        sinceLegendary: pityRow?.since_legendary ?? 0,
      };
      const roll = rollPet(code.line, { demo, pity });

      const { data, error } = await admin.rpc('record_scan', {
        p_user_id: userId,
        p_code_id: code.id,
        p_pet_id: roll.petId,
        p_is_gold: roll.isGold,
        p_cooldown_hours: demo ? 0 : ODDS.cooldownHours,
        p_expected_epic_plus: pity.sinceEpicPlus,
        p_expected_legendary: pity.sinceLegendary,
        p_since_epic_plus: roll.nextPity.sinceEpicPlus,
        p_since_legendary: roll.nextPity.sinceLegendary,
      });
      if (error || !data) return Response.json({ error: 'server_error' }, { status: 500 });

      const result = data as RecordedScan;
      if (result.status === 'pity_conflict') continue;

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
            stationLine: code.line,
            pet: { petId: roll.petId, isGold: roll.isGold, isLineVariant: roll.isLineVariant },
            copies: result.copies!,
            isNew: result.is_new!,
            becameGold: result.became_gold!,
          });
      }
    }

    return Response.json({ error: 'server_error' }, { status: 500 });
  }),
};
