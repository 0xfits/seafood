// P9④ 库面收口 · 活体状态只读探针（Kong；不进 scripts/）
import { readQuery, closePools } from '../src/db';
(async () => {
  try {
    const db = await readQuery<{ db: string; u: string; v: string }>(
      `SELECT current_database() AS db, current_user AS u, version() AS v`);
    console.log('DB', JSON.stringify(db[0]));

    const sm = await readQuery<{ version: string; checksum: string }>(
      `SELECT version, checksum FROM public.schema_migration ORDER BY version DESC LIMIT 5`);
    console.log('SCHEMA_TAIL', JSON.stringify(sm));
    const cnt = await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.schema_migration`);
    console.log('SCHEMA_ROWS', JSON.stringify(cnt[0]));

    const ke = await readQuery<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`);
    console.log('KIND_ENUM', JSON.stringify(ke[0]));

    const cols = await readQuery<{ column_name: string; data_type: string; is_nullable: string; column_default: string }>(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='currency' AND column_name='is_platform_coin'`);
    console.log('COL', JSON.stringify(cols));

    const tabn = await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.currency`);
    console.log('CURRENCY_ROWS', JSON.stringify(tabn[0]));

    const bttc = await readQuery<{ cid: string; symbol: string; name: string; owner_uid: string; decimals: number; status: string; total_supply: string; is_platform_coin: boolean | null }>(
      `SELECT cid::text, symbol, name, owner_uid::text, decimals::int, status, total_supply::text, is_platform_coin FROM public.currency WHERE symbol='BTTC'`);
    console.log('BTTC_ROW', JSON.stringify(bttc));

    for (const fn of ['ledger_kind_ok', 'ledger_assert_platform_mutation', 'ledger_post_event']) {
      const f = await readQuery<{ src: string; args: string }>(
        `SELECT prosrc AS src, pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname=$1 AND pronamespace='public'::regnamespace`, [fn]);
      console.log('FN', fn, JSON.stringify(f.map((x) => ({ args: x.args, len: x.src.length }))));
    }
    const op = await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_post_event' AND pronamespace='public'::regnamespace AND pg_get_function_identity_arguments(oid)='payload jsonb'`);
    const src = op[0]?.src ?? '';
    const m = src.match(/v_op NOT IN\s*\(([^)]*)\)/);
    console.log('OP_WL', JSON.stringify(m ? m[1].replace(/\s+/g, ' ').trim() : null));
    console.log('HAS_BURN_BRANCH', /ELSIF v_op = 'burn' THEN/.test(src));
    console.log('HAS_SUPPLY_DEBIT', /total_supply = total_supply - v_amount/.test(src));
    console.log('HAS_SUPPLY_CREDIT', /total_supply = total_supply \+ v_amount/.test(src));
    console.log('HAS_MB_EXEMPT', /v_e->>'kind' IN \('mint', 'burn'\)/.test(src));

    const fnk = await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_kind_ok' AND pronamespace='public'::regnamespace`);
    const kk = fnk[0]?.src ?? '';
    const mk = kk.match(/p_kind IN \(([^)]*)\)\s*AND \(NOT p_frozen_settle OR p_kind IN \(([^)]*)\)\)/);
    console.log('KIND_OK_FIRST', JSON.stringify(mk ? (mk[1].match(/'([a-z_]+)'/g) || []).length : null));
    console.log('KIND_OK_FROZEN', JSON.stringify(mk ? (mk[2].match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)) : null));

    const fna = await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_assert_platform_mutation' AND pronamespace='public'::regnamespace`);
    const aa = fna[0]?.src ?? '';
    const ma = aa.match(/WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN \(([^)]*)\)/);
    console.log('WL_M1_CREDIT', JSON.stringify(ma ? (ma[1].match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)) : null));

    const tbl = await readQuery<{ t: string; n: string }>(
      `SELECT 'ledger_entry' AS t, count(*)::int AS n FROM public.ledger_entry UNION ALL SELECT 'batt_account', count(*)::int FROM public.batt_account UNION ALL SELECT 'batt_entry', count(*)::int FROM public.batt_entry UNION ALL SELECT 'account', count(*)::int FROM public.account UNION ALL SELECT 'app_config', count(*)::int FROM public.app_config`);
    console.log('TABLE_COUNTS', JSON.stringify(tbl));
  } catch (e) { console.log('ERR', String((e as Error).stack || e).slice(0, 600)); }
  await closePools().catch(() => {});
})();
