/**
 * R3-P2b 探针 01：物理取证 + 政策守卫四类负例 + 平台白名单（函数级）
 * 只读为主；政策守卫负例为「尝试写入并期望被拒」，不落任何政策行。
 * 落盘：.p2b-artifacts/p2b-03-forensics-<RUN>.json（run-tagged，只新增）
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import { ledgerErrorFromDbError, normalizeLedgerError } from '../src/ledger';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';

const RUN = process.env.P2B_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

(async () => {
  const pool = new Pool({ connectionString: URL, max: 2 });
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p as never[])).rows;
  const out: Record<string, unknown> = { run: RUN, ts: new Date().toISOString() };

  // ---------- A 物理取证 ----------
  out.A_tables = await q(`SELECT relname, relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND relname IN ('referral','commission_policy') ORDER BY relname`);
  out.A_columns = await q(`SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_name IN ('referral','commission_policy')
      ORDER BY table_name, ordinal_position`);
  out.A_constraints = await q(`SELECT conrelid::regclass::text AS tbl, conname, contype, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE conrelid IN ('public.referral'::regclass,'public.commission_policy'::regclass)
      ORDER BY tbl, conname`);
  out.A_indexes = await q(`SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE tablename IN ('referral','commission_policy') ORDER BY tablename, indexname`);
  out.A_triggers = await q(`SELECT c.relname AS tbl, t.tgname, t.tgenabled, t.tgdeferrable, t.tginitdeferred,
        pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.relname IN ('referral','commission_policy','ledger_entry') AND NOT t.tgisinternal
      ORDER BY c.relname, t.tgname`);
  out.A_functions = await q(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.provolatile
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('referral_append_only','commission_policy_append_only',
        'commission_policy_weights_guard','referral_cycle_guard','referral_bind',
        'ledger_assert_commission_conservation','ledger_assert_platform_mutation')
      ORDER BY p.proname`);
  out.A_seed = await q(`SELECT policy_id::text, fee_rate_bp, levels, weights_bp::text, effective_from::text,
        created_by::text, time_created::text FROM commission_policy ORDER BY policy_id`);
  out.A_seed_count = (await q(`SELECT count(*)::text n FROM commission_policy`))[0];
  out.A_referral_rows = (await q(`SELECT count(*)::text n FROM referral`))[0];

  // ---------- B INSERT-only 确认（三张表）----------
  const insOnly = async (label: string, sql: string) => {
    const t0 = Date.now();
    try { await pool.query(sql); return { label, threw: false, ms: Date.now() - t0 }; }
    catch (e) {
      const a = e as Record<string, unknown>;
      return { label, threw: true, state: (a?.code as string) ?? null, message: String(a?.message ?? e).slice(0, 140), ms: Date.now() - t0 };
    }
  };
  const anyTx = (await q(`SELECT txid::text FROM ledger_entry ORDER BY txid DESC LIMIT 1`))[0] as { txid: string };
  out.B_insert_only = [
    await insOnly('referral.UPDATE', `UPDATE referral SET depth = 99`),
    await insOnly('referral.DELETE', `DELETE FROM referral`),
    await insOnly('commission_policy.UPDATE', `UPDATE commission_policy SET fee_rate_bp = 200`),
    await insOnly('commission_policy.DELETE', `DELETE FROM commission_policy`),
    await insOnly('ledger_entry.UPDATE', `UPDATE ledger_entry SET memo = 'x' WHERE txid = ${Number(anyTx.txid)}`),
    await insOnly('ledger_entry.DELETE', `DELETE FROM ledger_entry WHERE txid = ${Number(anyTx.txid)}`),
  ];

  // ---------- C 政策守卫四类负例（一律必须被 DB 拒；失败类 23514 ⇒ input ⇒ 400）----------
  const bad: Array<[string, string, string]> = [
    ['C1_fee_rate_bp_below_100', 'fee_rate_bp 越界（下界 99）',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (99, 10, ARRAY[3000,2000,1500,1000,800,600,500,300,200,100]::smallint[], '2200-01-01T00:00:00Z', 949001)`],
    ['C1b_fee_rate_bp_above_500', 'fee_rate_bp 越界（上界 501）',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (501, 10, ARRAY[3000,2000,1500,1000,800,600,500,300,200,100]::smallint[], '2200-01-02T00:00:00Z', 949001)`],
    ['C2_levels_over_10', 'levels > 10（11）',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 11, ARRAY[1,1,1,1,1,1,1,1,1,1,1]::smallint[], '2200-01-03T00:00:00Z', 949001)`],
    ['C3_weights_sum_exceeds_10000', 'Σweights_bp > 10000（10001）',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 10, ARRAY[3001,2000,1500,1000,800,600,500,300,200,100]::smallint[], '2200-01-04T00:00:00Z', 949001)`],
    ['C3b_weights_sum_zero', 'Σweights_bp = 0',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 3, ARRAY[0,0,0]::smallint[], '2200-01-05T00:00:00Z', 949001)`],
    ['C4_w1_zero', 'weights_bp[1] = 0（前 M 层全零）',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 3, ARRAY[0,6000,4000]::smallint[], '2200-01-06T00:00:00Z', 949001)`],
    ['C4b_weights_len_ne_levels', 'len(weights_bp) <> levels',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 3, ARRAY[6000,4000]::smallint[], '2200-01-07T00:00:00Z', 949001)`],
    ['C4c_negative_weight', '含负权重',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 3, ARRAY[11000,-5000,-4000]::smallint[], '2200-01-08T00:00:00Z', 949001)`],
    ['C6_created_by_disallowed', 'created_by 不在 {>=0, -1..-3}（-5）',
      `INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
       VALUES (100, 3, ARRAY[6000,4000,0]::smallint[], '2200-01-09T00:00:00Z', -5)`],
  ];
  const guardRows: Array<Record<string, unknown>> = [];
  for (const [id, desc, sql] of bad) {
    // C5 那条是「形态合法」的对照，用来证明守卫只拒该拒的 —— 先跑，若成功立即撤回（政策 INSERT-only ⇒ 不能撤回）
    // ⇒ 改为：只在事务里跑并 ROLLBACK（不落盘）
    let rec: Record<string, unknown> = { id, desc };
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      const cls = await c.query(`SELECT ledger_error_for_sqlstate(NULL, NULL) AS never`);
      rec = { ...rec, threw: false, rows_inserted: 1, note: '未被拒（若为负例则=缺陷）', classifier_probe: cls.rows.length };
      await c.query('ROLLBACK');
    } catch (e) {
      const a = e as Record<string, unknown>;
      await c.query('ROLLBACK').catch(() => undefined);
      const state = (a?.code as string) ?? null;
      const clsMs = (await c.query(`SELECT ledger_error_for_sqlstate($1::text, $2::text) AS j`,
        [state, (a?.constraint as string) ?? null])).rows[0]?.j as Record<string, string>;
      let ts: Record<string, unknown> = {};
      try {
        const le = ledgerErrorFromDbError(e) ?? normalizeLedgerError(e);
        ts = { code: (le as { code?: string })?.code, status: (le as { status?: number | null })?.status };
      } catch (merr) { ts = { normalize_threw: String((merr as Error)?.message).slice(0, 120) }; }
      rec = { ...rec, threw: true, pg_state: state, pg_message: String(a?.message ?? e).slice(0, 160),
        db_bucket: clsMs?.bucket ?? null, db_code: clsMs?.code ?? null, ts_code: ts.code ?? null, ts_status: ts.status ?? null,
        verdict: clsMs?.bucket === 'input' ? 'OK(400 类)' : 'UNEXPECTED(bucket=' + clsMs?.bucket + ')' };
    } finally { c.release(); }
    guardRows.push(rec);
  }
  out.C_policy_guard_negatives = guardRows;
  out.C_policy_rows_after = (await q(`SELECT count(*)::text n FROM commission_policy`))[0];
  out.C_policy_seed_untouched = await q(`SELECT policy_id::text, fee_rate_bp, effective_from::text, created_by::text
      FROM commission_policy ORDER BY policy_id`);

  // ---------- D 平台白名单（函数级：正向 + 负向）----------
  const callGuard = async (uid: number, kind: string, dir: string) => {
    try { await pool.query(`SELECT ledger_assert_platform_mutation($1::bigint, $2::text, $3::text)`, [uid, kind, dir]);
      return { uid, kind, dir, allowed: true }; }
    catch (e) { const a = e as Record<string, unknown>;
      let detail: Record<string, unknown> = {};
      try { detail = JSON.parse(String(a?.detail ?? '{}')); } catch { /* noop */ }
      return { uid, kind, dir, allowed: false, state: (a?.code as string) ?? null, message: String(a?.message ?? e), reason: detail.reason ?? null }; }
  };
  out.D_whitelist = {
    'minus1_credit_job_fee': await callGuard(-1, 'job_fee', 'credit'),
    'minus1_credit_trade_fee': await callGuard(-1, 'trade_fee', 'credit'),
    'minus1_credit_listing_fee': await callGuard(-1, 'listing_fee', 'credit'),
    'minus1_credit_currency_create_fee': await callGuard(-1, 'currency_create_fee', 'credit'),
    'minus1_credit_commission_NEGATIVE': await callGuard(-1, 'commission', 'credit'),
    'minus1_credit_mint_NEGATIVE': await callGuard(-1, 'mint', 'credit'),
    'minus1_debit_job_fee_NEGATIVE': await callGuard(-1, 'job_fee', 'debit'),
    'minus1_debit_transfer_NEGATIVE': await callGuard(-1, 'transfer', 'debit'),
    'minus2_credit_job_fee': await callGuard(-2, 'job_fee', 'credit'),
    'minus2_debit_commission': await callGuard(-2, 'commission', 'debit'),
    'minus2_debit_job_fee_NEGATIVE': await callGuard(-2, 'job_fee', 'debit'),
    'minus2_credit_trade_fee_NEGATIVE': await callGuard(-2, 'trade_fee', 'credit'),
    'minus3_debit_transfer': await callGuard(-3, 'transfer', 'debit'),
    'zero_credit_mint': await callGuard(0, 'mint', 'credit'),
  };

  // ---------- E 错误码关闭集（不得新增）----------
  out.E_closed_set_ts = { count: LEDGER_ERROR_CODES.length, has_reconcile: LEDGER_ERROR_CODES.includes('LEDGER_RECONCILE_MISMATCH') };
  out.E_closed_set_db = await q(`SELECT count(*)::text n FROM unnest(ARRAY['LEDGER_INSUFFICIENT_BALANCE','LEDGER_INSUFFICIENT_FROZEN','LEDGER_IDEMPOTENCY_CONFLICT',
      'LEDGER_IDEMPOTENCY_KEY_REQUIRED','LEDGER_IDEMPOTENCY_KEY_INVALID','LEDGER_IDEMPOTENCY_REPLAY','LEDGER_CURRENCY_NOT_FOUND',
      'LEDGER_CURRENCY_NOT_LISTED','LEDGER_CURRENCY_FROZEN','LEDGER_CURRENCY_DELISTED','LEDGER_CURRENCY_INVALID_TRANSITION',
      'LEDGER_CURRENCY_MISMATCH','LEDGER_SUPPLY_CAP_EXCEEDED','LEDGER_UNAUTHORIZED_MINT','LEDGER_HOLD_NOT_ALLOWED',
      'LEDGER_AMOUNT_INVALID','LEDGER_AMOUNT_NOT_POSITIVE','LEDGER_DECIMALS_OVERFLOW','LEDGER_SELF_TRANSFER','LEDGER_ACCOUNT_NOT_FOUND',
      'LEDGER_RESERVED_UID','LEDGER_REF_NOT_FOUND','LEDGER_UNKNOWN_KIND','LEDGER_TRANSACTION_REQUIRED','LEDGER_LOCK_TIMEOUT',
      'LEDGER_TX_TIMEOUT','LEDGER_DEADLOCK_RETRY_EXHAUSTED','LEDGER_NEGATIVE_BALANCE_GUARD','LEDGER_APPEND_ONLY_VIOLATION',
      'LEDGER_ACCOUNT_GUARD_VIOLATION','LEDGER_FEE_RATE_INVALID','LEDGER_RECONCILE_MISMATCH','LEDGER_CURRENCY_SYMBOL_TAKEN']) AS x
      WHERE ledger_sqlstate_of(x) IS NOT NULL`);

  // ---------- F Σ 断言失败面的「码 ⇒ SQLSTATE ⇒ 落桶」探针 ----------
  out.F_reconcile_bucket = await q(`SELECT ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH') AS sqlstate,
      ledger_error_for_sqlstate(ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH')) AS bucket_json,
      ledger_error_for_sqlstate('LD032') AS bucket_json_literal,
      ledger_error_for_sqlstate('23514', NULL) AS bucket_json_23514`);
  out.F_ts_map_ld032 = (() => {
    const fake = { code: 'LD032', message: 'LEDGER_RECONCILE_MISMATCH', detail: '{"reason":"COMMISSION_SPLIT_SUM_MISMATCH"}' };
    const le = ledgerErrorFromDbError(fake);
    return le ? { code: le.code, status: le.status, details: le.details } : null;
  })();

  const file = path.resolve(__dirname, '..', '.p2b-artifacts', `p2b-03-forensics-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    file,
    seed: out.A_seed, seed_count: out.A_seed_count,
    constraints_n: (out.A_constraints as unknown[]).length,
    triggers: (out.A_triggers as Array<Record<string, string>>).map((t) => `${t.tbl}.${t.tgname}(enabled=${t.tgenabled},deferrable=${t.tgdeferrable},initdeferred=${t.tginitdeferred})`),
    insert_only: out.B_insert_only,
    guard_verdicts: guardRows.map((r) => `${r.id}: threw=${r.threw} state=${r.pg_state} bucket=${r.db_bucket} ts=${r.ts_code}/${r.ts_status} => ${r.verdict ?? r.note}`),
    whitelist: out.D_whitelist,
    closed_set: out.E_closed_set_ts, closed_set_db: out.E_closed_set_db,
    F: out.F_reconcile_bucket, F_ts: out.F_ts_map_ld032,
  }, null, 1));
  await pool.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
