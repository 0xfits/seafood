/**
 * L2 库面活体探针（Neng 自写 · 只读）。不复用实现方产物。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s5q/l2-probe.ts
 */
import { readQuery, closePools } from '../src/db';

const md5 = (s: string | null) =>
  s === null ? null : require('crypto').createHash('md5').update(s, 'utf8').digest('hex');

(async () => {
  const out: Record<string, unknown> = {};

  // 1 schema_version
  const sv = await readQuery<{ v: string }>(
    `SELECT COALESCE(max(version), '<none>') AS v FROM schema_migration`);
  out.schema_version = sv[0].v;

  // 2 schema_migration row count
  const mc = await readQuery<{ n: string }>(`SELECT count(*)::text AS n FROM schema_migration`);
  out.schema_migration_rows = Number(mc[0].n);

  // 3 base tables
  const bt = await readQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`);
  out.base_tables = Number(bt[0].n);

  // 4 ledger_kind_enum def + 24 values
  const kd = await readQuery<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
      WHERE c.conrelid='public.ledger_entry'::regclass AND c.conname='ledger_kind_enum' AND c.contype='c'`);
  const def = kd[0]?.def ?? '';
  out.ledger_kind_enum_def_has_new = def.includes("'invite_first_task_reward'");
  const kinds = ['mint','burn','transfer','hold','hold_release','hold_forfeit','job_escrow','job_escrow_refund','job_payout','job_fee','commission','purchase','sale','purchase_refund','trade','trade_fee','listing_fee','listing_deposit','currency_create_fee','reversal','checkin_makeup_fee','bttc_mint_fee','bttc_burn_fee','invite_first_task_reward'];
  out.ledger_kind_enum_covered = kinds.filter((k) => def.includes(`'${k}'`)).length;

  // 5 ledger_kind_ok prosrc
  const ko = await readQuery<{ src: string; len: number }>(
    `SELECT prosrc AS src, length(prosrc) AS len FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='ledger_kind_ok'`);
  out.kind_ok_md5 = md5(ko[0].src);
  out.kind_ok_len = ko[0].len;
  const okNew = await readQuery<{ ok: boolean }>(`SELECT ledger_kind_ok('invite_first_task_reward') AS ok`);
  out.kind_ok_new_true = okNew[0].ok;
  const okFrozen = await readQuery<{ ok: boolean }>(
    `SELECT ledger_kind_ok('invite_first_task_reward', true) AS ok`);
  out.kind_ok_new_frozen_false = okFrozen[0].ok === false;

  // 6 ledger_assert_platform_mutation prosrc + whitelist behavior
  const am = await readQuery<{ src: string; len: number }>(
    `SELECT prosrc AS src, length(prosrc) AS len FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='ledger_assert_platform_mutation'`);
  out.assert_md5 = md5(am[0].src);
  out.assert_len = am[0].len;
  // -1 credit 八值仍放行 / -1 debit 仅 1 项：逐一探行为
  const whitelistProbe: Record<string, string> = {};
  const tryMut = async (uid: string, kind: string, dir: 'credit' | 'debit'): Promise<string> => {
    try {
      await readQuery(`SELECT ledger_assert_platform_mutation($1::bigint, $2::text, $3::text)`, [uid, kind, dir]);
      return 'ALLOW';
    } catch (e: any) {
      return `REJECT:${e?.code}:${JSON.parse(e?.details ?? '{}')?.reason ?? ''}`;
    }
  };
  const creditKinds = ['trade_fee','listing_fee','currency_create_fee','job_fee','listing_deposit','checkin_makeup_fee','bttc_mint_fee','bttc_burn_fee'];
  for (const k of creditKinds) whitelistProbe[`credit:${k}`] = await tryMut('-1', k, 'credit');
  whitelistProbe['debit:invite_first_task_reward'] = await tryMut('-1', 'invite_first_task_reward', 'debit');
  whitelistProbe['debit:job_fee'] = await tryMut('-1', 'job_fee', 'debit');
  whitelistProbe['debit:bttc_mint_fee'] = await tryMut('-1', 'bttc_mint_fee', 'debit');
  whitelistProbe['credit:invite_first_task_reward'] = await tryMut('-1', 'invite_first_task_reward', 'credit');
  whitelistProbe['credit(-2):invite_first_task_reward'] = await tryMut('-2', 'invite_first_task_reward', 'credit');
  whitelistProbe['debit(-2):commission'] = await tryMut('-2', 'commission', 'debit');
  whitelistProbe['credit(-3):hold_forfeit'] = await tryMut('-3', 'hold_forfeit', 'credit');
  out.whitelist_behavior = whitelistProbe;

  // 7 commission_policy rows
  const cp = await readQuery<any>(
    `SELECT policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS w, created_by::text AS created_by
       FROM commission_policy ORDER BY policy_id`);
  out.commission_policy = cp;

  // 8 fee rate CHECK domain
  const fr = await readQuery<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
      WHERE c.conrelid='public.commission_policy'::regclass AND c.conname='commission_policy_fee_rate_rng' AND c.contype='c'`);
  out.fee_rate_check_def = fr[0]?.def ?? null;

  // 9 ledger_post_event prosrc (裁定 #14)
  const pe = await readQuery<{ src: string; len: number }>(
    `SELECT prosrc AS src, length(prosrc) AS len FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='ledger_post_event'
        AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`);
  out.post_event_md5 = md5(pe[0].src);
  out.post_event_len = pe[0].len;

  // 10 schema_migration checksums for 0035-0038
  const ck = await readQuery<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM schema_migration WHERE version IN ('0035','0036','0037','0038') ORDER BY version`);
  out.migration_checksums = Object.fromEntries(ck.map((r) => [r.version, r.checksum.slice(0, 12)]));

  // 11 conservation trigger form + M0 marker present
  const trg = await readQuery<any>(
    `SELECT tgname, tgenabled, tgdeferrable, tginitdeferred, tgconstraint<>0 AS is_constraint
       FROM pg_trigger WHERE tgrelid='public.ledger_entry'::regclass
        AND tgname='trg_ledger_entry_commission_conservation' AND NOT tgisinternal`);
  out.conservation_trigger = trg;
  const cons = await readQuery<{ src: string }>(
    `SELECT prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='ledger_assert_commission_conservation'`);
  out.conservation_has_m0_marker = (cons[0]?.src ?? '').includes('p9s5_m0_exemption');
  out.conservation_has_v_closed = (cons[0]?.src ?? '').includes('v_closed');

  console.log(JSON.stringify(out, null, 2));
  await closePools();
})().catch(async (e) => { console.error('PROBE_ERR', e); try { await closePools(); } catch {} process.exit(1); });
