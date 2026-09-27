/**
 * R3-P2b 判负用例 + 正例取证（唯一权威取值来源）
 *  1) 2-环判负（裁定 #1 强制）：A→B 后 B→A 必须被拒（函数路径 + 裸 INSERT 路径）
 *  2) 绑定串行化取证：两条反向绑定并发 ⇒ 后到者被串行化后**必须被拒**（+ pg_stat_activity 的 Lock 等待）
 *  3) M9 对照：绕过守卫直插两行 ⇒ cycles/bad_depth 必须变红（事务内，ROLLBACK 复原）
 *  4) 政策守卫四类负例已在 p2b-01；本脚本补 referral 的 INSERT-only（有行时）
 *  5) -1 白名单端到端：正向（job_fee 入 -1 成功）+ 负向（commission 入 -1 仍被拒）
 *  6) Σ 断言：正向（合法事件过）+ 负向（人为 Σ 不等 ⇒ 必须 LD032/LEDGER_RECONCILE_MISMATCH）
 * 测试数据分区：uid 949xxx / symbol 前缀 p1q / 幂等键前缀 ops:p1q:*
 * 落盘：.p2b-artifacts/p2b-04-cases-<RUN>.json（run-tagged，只新增）
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Pool } from '@neondatabase/serverless';
import { mkPool, raw, attempt, jstr, ensureCurrency, pgInfo } from './p1f-lib';
import { ledgerErrorFromDbError } from '../src/ledger';

const RUN = process.env.P2B_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- uid 分区 ----
const PA = 949001, PB = 949002;            // 2-环判负
const PC = 949003, PD = 949004;            // 并发串行化
const PX = 949014, PY = 949015;            // M9 对照（绕过守卫）
const PE = 949016;                         // 改绑冲突（409）
const OWNER = 949010, WORKER = 949011, BEN1 = 949012, BEN2 = 949013;  // 账本用

const evmOf = (uid: number) => '0x' + uid.toString(16).padStart(40, '0');
const errRec = (e: unknown) => {
  const a = e as Record<string, unknown>;
  let detail: Record<string, unknown> = {};
  try { detail = JSON.parse(String(a?.detail ?? '{}')); } catch { /* noop */ }
  let ts: Record<string, unknown> = {};
  try { const le = ledgerErrorFromDbError(e); ts = le ? { code: le.code, status: le.status } : { code: null, status: null }; }
  catch { ts = { map_error: true }; }
  return { state: (a?.code as string) ?? null, message: String(a?.message ?? e).slice(0, 200),
    reason: (detail as Record<string, unknown>)?.reason ?? null, pg_detail: String(a?.detail ?? '').slice(0, 300),
    ts_code: ts.code ?? null, ts_status: ts.status ?? null };
};

(async () => {
  const pool = mkPool(4);
  const out: Record<string, unknown> = { run: RUN, ts: new Date().toISOString() };

  // ---------- 0 前置：建测试用户 + 自建币（symbol 前缀 p1q）----------
  const uids = [PA, PB, PC, PD, PX, PY, PE, OWNER, WORKER, BEN1, BEN2];
  await raw(pool, `INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                     FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [uids.map(String)]);
  out['0_users_created'] = (await raw(pool, `SELECT count(*)::text n FROM users WHERE uid = ANY($1::bigint[])`,
    [uids.map(String)]))[0];
  const existingCid = (await raw(pool, `SELECT cid::text FROM currency WHERE symbol = 'p1qP2B' LIMIT 1`))[0]?.cid;
  const CID = existingCid ?? await ensureCurrency(pool, 'p1qP2B', BigInt(OWNER), 0, 'listed', null);
  out['0_test_currency'] = { cid: CID, symbol: 'p1qP2B', owner: String(OWNER), note: '绝不触碰 cid=1' };

  // ---------- 1 2-环判负（裁定 #1 强制用例）----------
  const bind = async (c: bigint, p: bigint) => {
    try { const r = await raw<{ j: Record<string, unknown> }>(pool, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(c), String(p)]);
      return { ok: true, result: r[0]?.j ?? null }; }
    catch (e) { return { ok: false, ...errRec(e) }; }
  };
  const c1 = await bind(BigInt(PA), BigInt(PB));               // A→B：合法 ⇒ 成功
  const c2 = await bind(BigInt(PB), BigInt(PA));               // B→A：必须被拒（2-环反例）
  const c2_raw = await (async () => {                          // 裸 INSERT 路径（绕过 referral_bind）也必须被拒
    try { await pool.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [String(PB), String(PA)]);
      return { threw: false, note: '未被拒 = 缺陷（触发器没拦住）' }; }
    catch (e) { return { threw: true, ...errRec(e) }; } })();
  const c3_self = await (async () => {
    try { await pool.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$1,1)`, [String(PA)]);
      return { threw: false, note: '未被拒 = 缺陷' }; }
    catch (e) { return { threw: true, ...errRec(e) }; } })();
  const c4_replay = await bind(BigInt(PA), BigInt(PB));        // 幂等：同 (C,P) ⇒ replay
  const c5_conflict = await bind(BigInt(PA), BigInt(PE));      // 改绑 ⇒ 409
  out['1_cycle_cases'] = {
    '1a_bind_A_to_B_ok': c1, '1b_bind_B_to_A_MUST_REJECT': c2, '1c_raw_insert_B_to_A_MUST_REJECT': c2_raw,
    '1d_self_bind_MUST_REJECT': c3_self, '1e_idempotent_replay': c4_replay, '1f_rebind_conflict_409': c5_conflict,
  };
  out['1g_referral_rows'] = await raw(pool, `SELECT child_uid::text, parent_uid::text, depth::text FROM referral ORDER BY child_uid`);

  // ---------- 2 绑定串行化（并发反向绑定）----------
  const c1conn = await pool.connect();
  const c2conn = await pool.connect();
  const seq: Record<string, unknown> = {};
  try {
    await c1conn.query('BEGIN');
    seq.t0 = Date.now();
    const r1 = await c1conn.query('SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(PC), String(PD)]);
    seq.t1_bind_C_to_D_done = Date.now() - (seq.t0 as number);
    seq.conn1_result = r1.rows[0]?.j ?? null;
    // conn2 反向绑定：必须卡在 users 行锁上
    const p2 = c2conn.query('BEGIN').then(() => c2conn.query('SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(PD), String(PC)]));
    let settled2: unknown = null; let rejected2: unknown = null;
    p2.then((r) => { settled2 = r.rows[0]?.j ?? null; }, (e) => { rejected2 = errRec(e); });
    await sleep(1500);
    seq.conn2_still_pending_after_1500ms = settled2 === null && rejected2 === null;
    seq.lock_wait_row = (await raw(pool, `SELECT pid::text AS pid, wait_event_type, wait_event, left(query,50) AS q
        FROM pg_stat_activity WHERE query ILIKE '%referral_bind%' AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock' LIMIT 1`))[0] ?? null;
    seq.t_commit_conn1 = Date.now();
    await c1conn.query('COMMIT');
    await p2.catch(() => undefined);
    seq.conn2_outcome = rejected2 ? { rejected: true, ...(rejected2 as Record<string, unknown>) } : { rejected: false, result: settled2 };
    seq.conn2_elapsed_after_commit_ms = Date.now() - (seq.t_commit_conn1 as number);
    await c2conn.query('ROLLBACK').catch(() => undefined);
  } finally { c1conn.release(); c2conn.release(); }
  out['2_serialization'] = seq;
  out['2b_graph_after'] = await raw(pool, `SELECT child_uid::text, parent_uid::text, depth::text FROM referral ORDER BY child_uid`);

  // ---------- 3 M9 对照：绕过守卫直插 2-环 ⇒ cycles/bad_depth 必须变红 ----------
  const M9 = async (conn: { query: (s: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, string>> }> }) => {
    const cyc = await conn.query(`
      WITH RECURSIVE up AS (
        SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
        UNION ALL
        SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
      SELECT count(*)::text AS cycles FROM up WHERE cur = start`);
    const bad = await conn.query(`
      WITH RECURSIVE anc AS (
        SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
        UNION ALL
        SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
      SELECT count(*)::text AS bad_depth FROM referral x
        JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid WHERE x.depth <> t.mx`);
    return { cycles: cyc.rows[0]?.cycles, bad_depth: bad.rows[0]?.bad_depth };
  };
  out['3a_M9_baseline'] = await M9(pool as never);
  const bc = await pool.connect();
  let m9Bypass: Record<string, unknown> = {};
  try {
    await bc.query('BEGIN');
    await bc.query('ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard');
    await bc.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$1,2)`, [String(PX), String(PY)]);
    m9Bypass = { inserted_rows: 2, ...(await M9(bc as never)) };
    await bc.query('ROLLBACK');
  } catch (e) { await bc.query('ROLLBACK').catch(() => undefined); m9Bypass = { error: errRec(e) }; }
  finally { bc.release(); }
  out['3b_M9_bypass_contrast'] = { ...m9Bypass, note: '事务内测量后 ROLLBACK ⇒ 不留脏数据' };
  out['3c_M9_restored'] = await M9(pool as never);

  // ---------- 4 referral INSERT-only（有行时）----------
  const insOnly = async (label: string, sql: string, params: unknown[] = []) => {
    try { await pool.query(sql, params as never[]); return { label, threw: false }; }
    catch (e) { return { label, threw: true, ...errRec(e) }; }
  };
  out['4_referral_insert_only'] = [
    await insOnly('referral.UPDATE', `UPDATE referral SET depth = 99 WHERE child_uid = $1`, [String(PA)]),
    await insOnly('referral.DELETE', `DELETE FROM referral WHERE child_uid = $1`, [String(PA)]),
  ];

  // ---------- 5 账本：mint + freeze 预备 ----------
  const mintR = await attempt(pool, { op: 'mint', uid: String(OWNER), cid: CID, amount_units: '1000',
    kind: 'mint', idempotency_key: `ops:p1q:mint-${RUN}` });
  // R37：hold 家族必须带业务 ref（BUSINESS_REF_REQUIRED）⇒ 显式给 ref_type/ref_id
  const freezeOne = (amt: string, tag: string) => attempt(pool, { op: 'hold', uid: String(OWNER), cid: CID,
    amount_units: amt, kind: 'hold', ref_type: 'job', ref_id: '9490010',
    idempotency_key: `ops:p1q:hold-${tag}-${RUN}` });
  const fr = [await freezeOne('100', 'a'), await freezeOne('100', 'b'), await freezeOne('40', 'c'), await freezeOne('30', 'd')];
  out['5_setup'] = {
    mint_ok: mintR.ok, mint_err: mintR.error ?? null,
    freeze_ok: fr.map((f) => f.ok), freeze_failed: fr.filter((f) => !f.ok).map((f) => f.error ?? null),
    owner_account: (await raw(pool, `SELECT balance::text, frozen::text FROM account WHERE uid=$1 AND cid=$2`,
      [String(OWNER), CID]))[0] ?? null,
  };

  // ---------- 6 Σ 断言：正向（合法事件）----------
  const K_POS = `ops:p1q:settle-pos-${RUN}`;
  const posEntries = [
    { uid: String(OWNER), cid: CID, kind: 'job_payout', delta: '0', frozen_delta: '-60', ref_type: 'job' },
    { uid: String(WORKER), cid: CID, kind: 'job_payout', delta: '60', ref_type: 'job' },
    { uid: String(OWNER), cid: CID, kind: 'job_fee', delta: '0', frozen_delta: '-40', ref_type: 'job' },
    { uid: '-2', cid: CID, kind: 'job_fee', delta: '40', ref_type: 'job' },
    { uid: '-2', cid: CID, kind: 'commission', delta: '-24', ref_type: 'commission_payout' },
    { uid: String(BEN1), cid: CID, kind: 'commission', delta: '24', ref_type: 'commission_payout' },
    { uid: '-2', cid: CID, kind: 'commission', delta: '-16', ref_type: 'commission_payout' },
    { uid: String(BEN2), cid: CID, kind: 'commission', delta: '16', ref_type: 'commission_payout' },
  ];
  const pos = await attempt(pool, { op: 'entries', idempotency_key: K_POS, request_fingerprint: 'p2b-pos-v1',
    ref_type: 'job', ref_id: '9490001', memo: 'P2b Σ 正向', entries: posEntries });
  out['6_sigma_positive'] = { ok: pos.ok, txid: pos.txid ?? null, n_entries: pos.entries?.length ?? 0, error: pos.error ?? null,
    M1_readback: (await raw(pool, `
      SELECT COALESCE(sum(delta) FILTER (WHERE uid=-2 AND kind='job_fee'),0)::text AS pool_in,
             COALESCE(-sum(delta) FILTER (WHERE uid=-2 AND kind='commission'),0)::text AS paid_out,
             count(*) FILTER (WHERE kind='commission')::text AS commission_rows,
             COALESCE(sum(delta) FILTER (WHERE uid=-2),0)::text AS minus2_net
        FROM ledger_entry WHERE event_root_key = $1`, [K_POS]))[0] ?? null };

  // ---------- 7 Σ 断言：负向（人为 Σ 不等 ⇒ 必须 LD032 / LEDGER_RECONCILE_MISMATCH）----------
  const K_NEG = `ops:p1q:settle-neg-${RUN}`;
  const negEntries = [
    { uid: String(OWNER), cid: CID, kind: 'job_payout', delta: '0', frozen_delta: '-60', ref_type: 'job' },
    { uid: String(WORKER), cid: CID, kind: 'job_payout', delta: '60', ref_type: 'job' },
    { uid: String(OWNER), cid: CID, kind: 'job_fee', delta: '0', frozen_delta: '-40', ref_type: 'job' },
    { uid: '-2', cid: CID, kind: 'job_fee', delta: '40', ref_type: 'job' },
    { uid: '-2', cid: CID, kind: 'commission', delta: '-20', ref_type: 'commission_payout' },
    { uid: String(BEN1), cid: CID, kind: 'commission', delta: '20', ref_type: 'commission_payout' },
    { uid: '-2', cid: CID, kind: 'commission', delta: '-10', ref_type: 'commission_payout' },
    { uid: String(BEN2), cid: CID, kind: 'commission', delta: '10', ref_type: 'commission_payout' },
  ];
  const rowsBefore = (await raw(pool, `SELECT count(*)::text n FROM ledger_entry`))[0];
  const neg = await attempt(pool, { op: 'entries', idempotency_key: K_NEG, request_fingerprint: 'p2b-neg-v1',
    ref_type: 'job', ref_id: '9490002', memo: 'P2b Σ 负向（人为不等）', entries: negEntries });
  const rowsAfter = (await raw(pool, `SELECT count(*)::text n FROM ledger_entry`))[0];
  const negBucket = (await raw(pool, `SELECT ledger_error_for_sqlstate($1::text, $2::text) AS j`,
    [(neg.error?.code as string) ?? null, (neg.error?.constraint as string) ?? null]))[0]?.j ?? null;
  out['7_sigma_negative'] = { ok: neg.ok, error: neg.error ?? null, db_classifier: negBucket,
    ledger_rows_before: rowsBefore, ledger_rows_after: rowsAfter,
    rows_written_0: rowsBefore?.n === rowsAfter?.n,
    rows_landed_for_neg_key: (await raw(pool, `SELECT count(*)::text n FROM ledger_entry WHERE event_root_key = $1`, [K_NEG]))[0] };
  // 负向：分两条（先只写 job_fee 入池、不写 commission）⇒ 也必须被断言拦住
  const K_NEG2 = `ops:p1q:settle-neg2-${RUN}`;
  const neg2 = await attempt(pool, { op: 'entries', idempotency_key: K_NEG2, request_fingerprint: 'p2b-neg2-v1',
    ref_type: 'job', ref_id: '9490003', memo: 'P2b Σ 负向（漏发全部佣金）',
    entries: [ { uid: String(OWNER), cid: CID, kind: 'job_payout', delta: '0', frozen_delta: '-20', ref_type: 'job' },
               { uid: '-2', cid: CID, kind: 'job_fee', delta: '20', ref_type: 'job' } ] });
  out['7b_sigma_negative_missing_commissions'] = { ok: neg2.ok, error: neg2.error ?? null };

  // ---------- 8 -1 白名单端到端 ----------
  const K_P1 = `ops:p1q:minus1-pos-${RUN}`;
  const p1 = await attempt(pool, { op: 'entries', idempotency_key: K_P1, request_fingerprint: 'p2b-m1-pos-v1',
    ref_type: 'job', ref_id: '9490004', memo: 'P2b 无邀请人（手续费入 -1）',
    entries: [ { uid: String(OWNER), cid: CID, kind: 'job_payout', delta: '0', frozen_delta: '-40', ref_type: 'job' },
               { uid: '-1', cid: CID, kind: 'job_fee', delta: '40', ref_type: 'job' } ] });
  const K_P2 = `ops:p1q:minus1-neg-${RUN}`;
  const p2n = await attempt(pool, { op: 'entries', idempotency_key: K_P2, request_fingerprint: 'p2b-m1-neg-v1',
    ref_type: 'job', ref_id: '9490005', memo: 'P2b -1 负向（commission 入 -1 必须被拒）',
    entries: [ { uid: String(OWNER), cid: CID, kind: 'job_payout', delta: '0', frozen_delta: '-30', ref_type: 'job' },
               { uid: '-1', cid: CID, kind: 'commission', delta: '30', ref_type: 'commission_payout' } ] });
  out['8_minus1'] = {
    '8a_positive_job_fee_to_minus1': { ok: p1.ok, txid: p1.txid ?? null, error: p1.error ?? null,
      readback: (await raw(pool, `SELECT COALESCE(sum(delta) FILTER (WHERE uid=-1 AND kind='job_fee'),0)::text AS minus1_fee_in,
        COALESCE(sum(delta) FILTER (WHERE uid=-2),0)::text AS minus2_net,
        count(*) FILTER (WHERE kind='commission')::text AS commission_rows
        FROM ledger_entry WHERE event_root_key = $1`, [K_P1]))[0] ?? null },
    '8b_negative_commission_to_minus1_MUST_REJECT': { ok: p2n.ok, error: p2n.error ?? null,
      rows_landed: (await raw(pool, `SELECT count(*)::text n FROM ledger_entry WHERE event_root_key = $1`, [K_P2]))[0] },
  };

  // ---------- 9 Σ 断言触发器的只读/统计读数 + 断言窗口证据 ----------
  out['9_conservation_trigger'] = {
    trigger_def: (await raw(pool, `SELECT tgname, tgdeferrable::text, tginitdeferred::text, tgenabled
        FROM pg_trigger WHERE tgname = 'trg_ledger_entry_commission_conservation'`))[0] ?? null,
    fires_on_relevant_rows_only: '负例 7b（无 commission 行，仅 job_fee 入 -2）也被拦 ⇒ 非「仅 commission 行触发」的收窄形态',
  };

  const file = path.resolve(__dirname, '..', '.p2b-artifacts', `p2b-04-cases-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ file, ...out }, null, 1).slice(0, 12000));
  await pool.end();
})().catch((e) => { console.error('FATAL', jstr(pgInfo(e))); process.exit(1); });
