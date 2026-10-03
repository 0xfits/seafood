/**
 * P9⑤ 收尾单 A · ① `0038` 的 `R-9-24` 真跑自证（不 apply）。
 * 单事务内 `BEGIN; <0038 全文>; ROLLBACK;`（**禁 COMMIT**）+ 四项读数：
 *   ① 无错执行；② 回滚后对象指纹复原（ledger_kind_enum 回 23 值 / ledger_kind_ok 回旧版 /
 *   ledger_assert_platform_mutation 回旧版）；③ `schema_migration` 无新行（33 行 / max 0034）；
 *   ④ 目标对象复原。
 * 行为面自检（事务内）：`ledger_kind_ok('invite_first_task_reward')` = true；闭集外必拒；
 *   白名单内 `-1` debit 放行 ⇄ 白名单外 `-1` debit 必红 `PLATFORM_DEBIT_FORBIDDEN`（活体负对照）。
 * 写库一律事务内 + 末尾 ROLLBACK。入 .p9s5-impl/（不入 scripts/ 扫面根）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, '..', '.p9s5-impl');
fs.mkdirSync(OUT, { recursive: true });
const SENT = 'P9S5_0038_ROLLBACK';

type Row = Record<string, unknown>;
const g = async (q: <T>(s: string, p?: unknown[]) => Promise<T[]>, s: string, p?: unknown[]) =>
  (await q<Row>(s, p))[0] ?? {};

const snap = async (q: <T>(s: string, p?: unknown[]) => Promise<T[]>) => {
  const enumDef = String((await g(q, `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
     WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`)).d ?? '');
  const kk = await g(q, `SELECT md5(p.prosrc) AS md5, length(p.prosrc)::int AS len FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_kind_ok'`);
  const ap = await g(q, `SELECT md5(p.prosrc) AS md5, length(p.prosrc)::int AS len FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_assert_platform_mutation'`);
  const mig = await g(q, `SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`);
  const lens = await g(q, `SELECT
     (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
     (SELECT count(*)::int FROM public.batt_account) AS batt_account,
     (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
     (SELECT count(*)::int FROM public.users) AS users,
     (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS base_tables`);
  return {
    kind_enum_def: enumDef, kind_enum_n: (enumDef.match(/'/g) || []).length / 2,
    kind_ok_md5: String(kk.md5 ?? ''), kind_ok_len: Number(kk.len ?? -1),
    assert_md5: String(ap.md5 ?? ''), assert_len: Number(ap.len ?? -1),
    mig_rows: Number(mig.n ?? -1), mig_max: (mig.v ?? null) as string | null,
    ledger_entry: Number(lens.ledger_entry ?? -1), batt_account: Number(lens.batt_account ?? -1),
    batt_entry: Number(lens.batt_entry ?? -1), users: Number(lens.users ?? -1),
    base_tables: Number(lens.base_tables ?? -1),
  };
};

/** 事务内调用（可能抛错）：捕获 SQLSTATE / message / detail。 */
const tryCall = async (tx: TxClient, sql: string, params?: unknown[]) => {
  const sp = `sp_${Math.random().toString(36).slice(2, 8)}`;
  await tx.query(`SAVEPOINT ${sp}`);
  try {
    await tx.query(sql, params);
    await tx.query(`RELEASE SAVEPOINT ${sp}`);
    return { ok: true as const };
  } catch (e) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    const err = e as { code?: string; message?: string; detail?: string };
    return { ok: false as const, sqlstate: String(err.code ?? ''), message: String(err.message ?? '').slice(0, 160),
      detail: String(err.detail ?? '').slice(0, 240) };
  }
};

(async () => {
  const readQ = <T>(s: string, p?: unknown[]) => readQuery<T>(s, p);
  const sql = fs.readFileSync(path.resolve(ROOT, 'migrations/0038_kind_close_set_24.sql'), 'utf8');
  const out: Record<string, unknown> = {
    unit: 'P9S5-0038-R9-24-REALRUN', generated_at: new Date().toISOString(), run: RUN,
    file: 'migrations/0038_kind_close_set_24.sql', bytes: Buffer.byteLength(sql, 'utf8'),
    note: '单事务 BEGIN;<0038 全文>;ROLLBACK（禁 COMMIT）；不 apply。',
  };

  const before = await snap(readQ);
  let execErr: string | null = null;
  const inTx: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx: TxClient) => {
      const q = <T>(s: string, p?: unknown[]) => tx.query<T>(s, p).then((r) => r.rows);
      await tx.query(sql);              // 整文件在单事务内真跑
      const post = await snap(q as never);
      inTx.post_kind_enum_def = post.kind_enum_def;
      inTx.post_kind_enum_n = post.kind_enum_n;
      inTx.post_kind_ok_md5 = post.kind_ok_md5;
      inTx.post_kind_ok_len = post.kind_ok_len;
      inTx.post_assert_md5 = post.assert_md5;
      inTx.post_assert_len = post.assert_len;
      inTx.post_mig_rows = post.mig_rows;
      inTx.post_mig_max = post.mig_max;

      // ---- 行为面（事务内，0038 已生效）
      const b = await g(q, `SELECT
        ledger_kind_ok('invite_first_task_reward') AS new_true,
        ledger_kind_ok('bttc_burn_fee') AS old_last_true,
        ledger_kind_ok('made_up_kind') AS bogus_false,
        ledger_kind_ok('') AS empty_false,
        ledger_kind_ok('listing_deposit_refund') AS outside_false,
        ledger_kind_ok('invite_first_task_reward', true) AS new_under_frozen_false,
        ledger_kind_ok('job_payout', true) AS frozen_member_true,
        (SELECT count(*)::int FROM unnest(ARRAY['mint','burn','transfer','hold','hold_release','hold_forfeit','job_escrow','job_escrow_refund','job_payout','job_fee','commission','purchase','sale','purchase_refund','trade','trade_fee','listing_fee','listing_deposit','currency_create_fee','reversal','checkin_makeup_fee','bttc_mint_fee','bttc_burn_fee','invite_first_task_reward']) k WHERE NOT ledger_kind_ok(k)) AS bad_count`);
      inTx.behavior_kind_ok = b;

      // 白名单内 -1 debit 放行（正）
      inTx.debit_in_whitelist = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-1::bigint,'invite_first_task_reward','debit')`);
      // 白名单外 -1 debit 必红（活体负对照）
      inTx.debit_outside_whitelist = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-1::bigint,'job_fee','debit')`);
      inTx.debit_outside_whitelist2 = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-1::bigint,'bttc_mint_fee','debit')`);
      // -1 credit 仍须拒新 kind（未被顺带放宽）
      inTx.credit_minus1_newkind = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-1::bigint,'invite_first_task_reward','credit')`);
      // 其它平台格不得被顺带放宽
      inTx.credit_minus2_newkind = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-2::bigint,'invite_first_task_reward','credit')`);
      inTx.credit_minus3_newkind = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-3::bigint,'invite_first_task_reward','credit')`);
      // -1 credit 八格仍放行（抽查）
      inTx.credit_minus1_kept = await tryCall(tx, `SELECT public.ledger_assert_platform_mutation(-1::bigint,'trade_fee','credit')`);

      throw new Error(SENT);
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 200)}` : msg.slice(0, 220);
  }
  const after = await snap(readQ);

  out.reads = {
    '1_no_error': execErr === null,
    exec_err: execErr,
    '2_new_object_absent_after_rollback':
      after.kind_enum_n === 23 && !after.kind_enum_def.includes('invite_first_task_reward')
      && after.kind_ok_md5 === before.kind_ok_md5 && after.assert_md5 === before.assert_md5,
    '3_schema_migration_no_new_row': after.mig_rows === before.mig_rows && after.mig_max === before.mig_max,
    mig_rows_before: before.mig_rows, mig_rows_after: after.mig_rows,
    mig_max_before: before.mig_max, mig_max_after: after.mig_max,
    '4_target_object_restored':
      after.kind_enum_def === before.kind_enum_def && after.kind_ok_md5 === before.kind_ok_md5
      && after.kind_ok_len === before.kind_ok_len && after.assert_md5 === before.assert_md5
      && after.assert_len === before.assert_len && after.ledger_entry === before.ledger_entry
      && after.batt_account === before.batt_account && after.batt_entry === before.batt_entry
      && after.users === before.users,
    new_relations_added: after.base_tables - before.base_tables,
  };
  out.before = before;
  out.after = after;
  out.in_tx = inTx;

  fs.writeFileSync(path.join(OUT, `r9-24-0038-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  const r = out.reads as Record<string, unknown>;
  process.exit(r['1_no_error'] && r['2_new_object_absent_after_rollback'] && r['3_schema_migration_no_new_row'] && r['4_target_object_restored'] ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 800)); await closePools().catch(() => undefined); process.exit(2); });
