/**
 * p3n-01-rca-legs.ts —— Neng 独立质检（对象：docs/audit/p3-baseline-rca.md · Kong 交付）
 *
 * 复现该 RCA 的八项决定性 leg 中的**库侧五项**（T1/T2/T3/T4/T5）＋ T8 指纹不变量。
 * （T6 = 文本/代码核（shell 侧逐行）、T7 = p1o-00 套件复跑（shell 侧），不在本脚本内。）
 *
 * 自主性声明：本脚本**不 import** 任何 .p2w/.p3r/.p3q/.p1f 脚本或库，**不读**其读数；
 *   仅 import 产品侧 src/commission.ts（计划器：planJobSettlement/buildSettleEvent/toPayloadEntry）
 *   作为「事件载荷构造器」—— 那是被检对象的下游调用契约，不是我复用了质检方的读数。
 *
 * 纪律：
 *   ① 骸架先落盘、逐段回写（崩在半途也留证）；② 探针 artifact run-tagged、同名拒写；
 *   ③ T1 篡改臂走**真 COMMIT**；若意外提交成功 ⇒ 立即停手、登记残留坐标（status=HALTED_TAMPER_COMMITTED）。
 *   ④ 命名空间：uid 9910xx / 幂等键前缀 cli:neng19- / 夹具币 symbol p3n19*。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

const OUT_DIR = path.resolve(__dirname, '..', '.p3n-artifacts');
const RUN = process.env.P3N_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
const ART = path.join(OUT_DIR, `p3n-01-rca-legs-${RUN}.json`);

interface St { [k: string]: unknown; }
const ART_STATE: St = {
  run: RUN, name: 'p3n-01-rca-legs', status: 'STARTED', stage: 'init',
  started_at: new Date().toISOString(), legs: {}, notes: [] as string[],
  probe: 'Neng 独立质检（p3-baseline-rca.md 复核）',
};
let firstWrite = true;
const checkpoint = (stage: string, patch?: St): void => {
  if (patch) Object.assign(ART_STATE, patch);
  ART_STATE.stage = stage; ART_STATE.updated_at = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (firstWrite) {
    if (fs.existsSync(ART)) throw new Error(`同名拒写（run 命名空间冲突）: ${ART}`);
    fs.writeFileSync(ART, JSON.stringify(ART_STATE, null, 2), { flag: 'wx' });
    firstWrite = false;
  } else {
    fs.writeFileSync(ART, JSON.stringify(ART_STATE, null, 2));
  }
};
const note = (s: string): void => { (ART_STATE.notes as string[]).push(s); };

checkpoint('skeleton-written');   // ← 骸架先落盘

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Pool, neonConfig } = require('@neondatabase/serverless');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require('ws');
neonConfig.webSocketConstructor = WS;

const DIRECT_URL: string = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString: DIRECT_URL, max: 3, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

// ---- 通知捕获（尽力而为；驱动不支持则登记 UNSUPPORTED_BY_DRIVER，不伪造） ----
const notices: string[] = [];
let noticeCap = 'NOT_ATTEMPTED';
try {
  if (typeof pool.on === 'function') { pool.on('notice', (n: St) => notices.push(String(n?.message ?? n))); noticeCap = 'pool.on(notice)'; }
  if (typeof pool.on === 'function') { pool.on('error', (e: unknown) => notices.push('POOL_ERROR: ' + String((e as Error)?.message ?? e))); }
} catch (e) { noticeCap = 'ATTACH_FAILED: ' + String(e); }

const q = async (ex: St, sql: string, params: unknown[] = []): Promise<St[]> =>
  ((await (ex as { query: (s: string, p?: unknown[]) => Promise<{ rows: St[] }> }).query(sql, params)).rows);
const q1 = async (ex: St, sql: string, params: unknown[] = []): Promise<St | null> => (await q(ex, sql, params))[0] ?? null;

interface E { sqlstate: string | null; message: string; detail: string | null; reason: string | null; constraint: string | null; }
const pgErr = (e: unknown): E => {
  const a = e as St;
  let reason: string | null = null;
  try { reason = (JSON.parse(String(a?.detail ?? '')) as St)?.reason as string ?? null; } catch { reason = null; }
  return { sqlstate: (a?.code as string) ?? null, message: String(a?.message ?? e).slice(0, 300),
    detail: (a?.detail as string) ?? null, reason, constraint: (a?.constraint as string) ?? null };
};

const callFn = async (ex: St, payload: unknown): Promise<St> => {
  const r = await q(ex, 'SELECT public.ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  const v = r[0]?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as St;
};
const tryFn = async (ex: St, payload: unknown): Promise<St> => {
  const t0 = Date.now();
  try { const r = await callFn(ex, payload); return { ok: r?.ok === true, entries: ((r?.entries as unknown[]) ?? []).length, error: null, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, entries: null, error: pgErr(e), ms: Date.now() - t0 }; }
};
const tryQ = async (ex: St, sql: string, params: unknown[] = []): Promise<St> => {
  try { const rows = await q(ex, sql, params); return { ok: true, rows, error: null }; }
  catch (e) { return { ok: false, rows: [], error: pgErr(e) }; }
};

/** 事务：rollback=true ⇒ 一律 ROLLBACK（零残留）；false ⇒ 由 fn 自行 COMMIT，失败即抛 */
const inTx = async <T>(mode: 'rollback' | 'commit', fn: (c: St) => Promise<T>):
Promise<{ result: T | null; error: unknown | null; commit_error: unknown | null; ms: number }> => {
  const t0 = Date.now();
  const c = await pool.connect();
  let result: T | null = null; let error: unknown | null = null; let commitError: unknown | null = null;
  try {
    await c.query('BEGIN');
    result = await fn(c as unknown as St);
    if (mode === 'commit') { try { await c.query('COMMIT'); } catch (e) { commitError = e; } }
  } catch (e) { error = e; }
  finally {
    try { await c.query('ROLLBACK'); } catch { /* aborted or already committed */ }
    c.release();
  }
  return { result, error, commit_error: commitError, ms: Date.now() - t0 };
};

// ---- 命名空间（uid 9910xx；offset 由 run 派生 ⇒ 不撞历史跑） ----
const OFF = parseInt(crypto.createHash('md5').update(RUN).digest('hex').slice(0, 4), 16) % 70;
const UID = (k: number): string => String(991000 + OFF + k);
const EMP = UID(1), WORKER = UID(2), A1 = UID(3), A2 = UID(4), A3 = UID(5);
const REF_UIDS = [UID(11), UID(12), UID(13)];
const SYM = 'p3n19' + RUN.slice(-6).toLowerCase();
const KEY = (w: string, k: string): string => `cli:neng19-${w}:${k}`;
const JTAG = String(9910000 + OFF * 100);
const JOB = (k: number): string => `${JTAG}${String(k).padStart(2, '0')}`;
const GROSS = '10000';
const FN_NAMES = ['ledger_post_event', 'market_post_event', 'listing_post_event', 'job_post_event',
  'ledger_assert_commission_conservation', 'referral_cycle_guard'];

// eslint-disable-next-line @typescript-eslint/no-var-requires
const C = require('../src/commission');
const { planJobSettlement, buildSettleEvent, toPayloadEntry, settleJobFingerprint } = C;

const qSafe = async (ex: St, sql: string, params: unknown[] = []): Promise<St> => {
  try { return { ok: true, rows: await q(ex, sql, params), error: null }; }
  catch (e) { return { ok: false, rows: [], error: pgErr(e) }; }
};

const snapshot = async (ex: St): Promise<St> => {
  const counts: St = {}; const countErrs: St = {};
  for (const t of ['users', 'account', 'ledger_entry', 'referral', 'currency', 'commission_policy', 'schema_migration']) {
    const r = await qSafe(ex, `SELECT count(*)::text AS n FROM public."${t}"`);
    counts[t] = r.ok ? ((r.rows as St[])[0] as St).n : null;
    if (!r.ok) countErrs[t] = r.error;
  }
  const fps = await qSafe(ex, `SELECT p.proname::text AS name, octet_length(p.prosrc)::text AS len, md5(p.prosrc)::text AS md5
                            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                           WHERE n.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY 1`, [FN_NAMES]);
  const trig = await qSafe(ex, `SELECT c.relname::text AS tbl, t.tgname::text AS tgname, t.tgenabled::text AS tgenabled,
                                   t.tgdeferrable::text AS deferrable, t.tginitdeferred::text AS initdeferred
                              FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                              JOIN pg_namespace n ON n.oid = c.relnamespace
                             WHERE NOT t.tgisinternal AND n.nspname = 'public' ORDER BY 1,2`);
  const cons = await qSafe(ex, `SELECT conname::text AS conname, contype::text AS contype, condeferrable::text AS deferrable,
                                   condeferred::text AS deferred, pg_get_constraintdef(oid)::text AS def
                              FROM pg_constraint WHERE connamespace = 'public'::regnamespace
                               AND conname = 'trg_ledger_entry_commission_conservation'`);
  // schema_version：**发现式**读取（不假设表名；首跑误用 public.schema_version ⇒ 已登记为探针缺陷并改正）
  const svTabs = await qSafe(ex, `SELECT c.relname::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                   WHERE n.nspname = 'public' AND c.relkind = 'r'
                                     AND (c.relname LIKE '%schema%' OR c.relname LIKE '%version%' OR c.relname LIKE '%meta%') ORDER BY 1`);
  const svReads: St = {};
  for (const r of (svTabs.rows as St[])) {
    const t = String(r.name);
    const rr = await qSafe(ex, `SELECT to_jsonb(x) AS j FROM public."${t}" x LIMIT 10`);
    svReads[t] = rr.ok ? (rr.rows as St[]).map((y: St) => y.j) : { read_error: rr.error };
  }
  const regRows = await qSafe(ex, `SELECT count(*)::text AS n, max(version)::text AS max_v FROM public.schema_migration`);
  const c1 = await qSafe(ex, `SELECT c.cid::text AS cid, c.symbol::text AS symbol, c.total_supply::text AS total_supply,
                                  COALESCE((SELECT sum(a.balance + a.frozen) FROM public.account a WHERE a.cid = c.cid),0)::text AS sum_bal
                             FROM public.currency c WHERE c.cid = 1`);
  return { counts, count_errors: countErrs, fn_fingerprints: fps.rows, fn_fingerprints_error: fps.error,
    triggers: trig.rows, triggers_error: trig.error, conservation_constraint: cons.rows, conservation_error: cons.error,
    schema_tables: (svTabs.rows as St[]).map((r) => r.name), schema_reads: svReads,
    registry: regRows.ok ? (regRows.rows as St[])[0] : regRows.error, cid1_conservation: c1.ok ? (c1.rows as St[])[0] : c1.error };
};

const myResidue = async (ex: St, cid: string | null): Promise<St> => ({
  ledger_rows_my_event_keys: (await q1(ex, `SELECT count(*)::text AS n FROM public.ledger_entry
     WHERE idempotency_key LIKE 'biz:job:settle:${JTAG}%'`))?.n,
  ledger_rows_my_prefix: (await q1(ex, `SELECT count(*)::text AS n FROM public.ledger_entry
     WHERE idempotency_key LIKE 'cli:neng19-%'`))?.n,
  users_my_window: (await q1(ex, `SELECT count(*)::text AS n FROM public.users WHERE uid = ANY($1::bigint[])`,
    [[EMP, WORKER, A1, A2, A3, ...REF_UIDS].map(String)]))?.n,
  accounts_my_cid: cid ? (await q1(ex, `SELECT count(*)::text AS n FROM public.account WHERE cid = $1`, [cid]))?.n : null,
  referral_my_window: (await q1(ex, `SELECT count(*)::text AS n FROM public.referral
     WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`,
  [[EMP, WORKER, A1, A2, A3, ...REF_UIDS].map(String)]))?.n,
  currency_my_symbol: (await q1(ex, `SELECT count(*)::text AS n FROM public.currency WHERE symbol = $1`, [SYM]))?.n,
  currency_my_supply: (await q1(ex, `SELECT COALESCE(max(total_supply),0)::text AS s FROM public.currency WHERE symbol = $1`, [SYM]))?.s,
});

// ---- 事件载荷构造（我的口径） ----
const setupEvent = async (tx: St, jobId: string): Promise<St> => {
  const mint = await tryFn(tx, { op: 'mint', uid: EMP, cid: CID, amount_units: '1000000', kind: 'mint', idempotency_key: KEY('mint', jobId) });
  const hold = await tryFn(tx, { op: 'hold', uid: EMP, cid: CID, amount_units: GROSS, kind: 'hold', ref_type: 'job', ref_id: jobId, idempotency_key: KEY('hold', jobId) });
  const plan = await planJobSettlement({ jobId, employerUid: EMP, workerUid: WORKER, cid: CID, gross: GROSS, ex: tx });
  const ev = buildSettleEvent(plan, `p3n19 质检结算 job=${jobId}`);
  const payload = {
    op: 'entries', idempotency_key: plan.idempotency_key,
    request_fingerprint: settleJobFingerprint({ jobId, employerUid: EMP, workerUid: WORKER, cid: CID, gross: GROSS }),
    ref_type: 'job', ref_id: plan.job_id, memo: `p3n19 质检结算 job=${jobId}`,
    entries: ev.entries.map(toPayloadEntry),
  };
  return { mint_ok: mint.ok, mint_err: mint.error, hold_ok: hold.ok, hold_err: hold.error,
    plan: { fee: plan.fee, net: plan.net, M: plan.M, N: plan.N, layers: plan.layers.length, policy_levels: plan.policy?.levels, fee_rate_bp: plan.policy?.fee_rate_bp, key: plan.idempotency_key },
    payload };
};
const sumDelta = (entries: St[]): string => entries.reduce((a, e) => a + BigInt(String(e.delta ?? '0')), 0n).toString();
const tamperDropLastPair = (p: St): St => ({ ...p, entries: (p.entries as St[]).filter((_e, i, arr) => i < arr.length - 2) });
const tamperPoolInNoOut = (p: St): St => ({ ...p, entries: (p.entries as St[]).filter((_e, i) => i < 4) });
const kinds = (entries: St[]): string[] => entries.map((e) => String(e.kind));
const closureState = async (ex: St, cid: string): Promise<St> => {
  const r = await q1(ex, `SELECT a.balance::text AS bal, a.frozen::text AS frz, s.balance_after::text AS sna, s.frozen_after::text AS snf
                            FROM public.account a
                            JOIN LATERAL (SELECT balance_after, frozen_after FROM public.ledger_entry
                                           WHERE uid = -2 AND cid = $1 ORDER BY txid DESC LIMIT 1) s ON true
                           WHERE a.uid = -2 AND a.cid = $1`, [cid]);
  return { ...(r ?? {}), closed_uid_minus2: r ? (r.bal === r.sna && r.frz === r.snf) : null };
};

let CID = ''; // 夹具币 cid（对照臂提交后固定）

const main = async (): Promise<number> => {
  // ================= T8 before =================
  const before = await snapshot(pool);
  const resBefore = await myResidue(pool, null);
  checkpoint('t8-before-done', { t8_before: before, residue_before_session: resBefore, namespace: { RUN, SYM, JTAG, EMP, WORKER, A1, A2, A3, REF_UIDS, key_prefix: 'cli:neng19-', uid_window: '9910xx' } });

  // ================= T1 对照臂（真 COMMIT）=================
  const t1control = await inTx('commit', async (tx) => {
    const cur = await q1(tx, `INSERT INTO public.currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
      VALUES ($1,$2,$3,8,0,'listed',now()) RETURNING cid::text AS cid`, [SYM, `p3n19 ${RUN}`, EMP]);
    CID = String(cur?.cid);
    await q(tx, `INSERT INTO public.users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                   FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [[EMP, WORKER, A1, A2, A3].map(String)]);
    // 邀请链（自顶向下：A2→A3, A1→A2, WORKER→A1；depth 由 trg_referral_cycle_guard 覆写）
    for (const [c, p] of [[A2, A3], [A1, A2], [WORKER, A1]] as Array<[string, string]>) {
      await q(tx, `INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,0) ON CONFLICT (child_uid) DO NOTHING`, [c, p]);
    }
    const chain = await q(tx, `SELECT child_uid::text AS c, parent_uid::text AS p, depth::text AS d FROM public.referral
                                WHERE child_uid = ANY($1::bigint[]) ORDER BY depth`, [[WORKER, A1, A2].map(String)]);
    const policy = await q1(tx, `SELECT policy_id::text AS id, fee_rate_bp::text AS fee_bp, levels::text AS levels FROM public.commission_policy
                                  WHERE effective_from <= now() ORDER BY effective_from DESC LIMIT 1`);
    const s = await setupEvent(tx, JOB(1));
    const post = await tryFn(tx, s.payload);
    return { cid: CID, chain_rows: chain, policy_row: policy, plan: s.plan,
      entries: (s.payload as St).entries, entries_n: ((s.payload as St).entries as St[]).length,
      kinds: kinds((s.payload as St).entries as St[]), sum_delta: sumDelta((s.payload as St).entries as St[]),
      post };
  });
  const t1cErr = t1control.commit_error ? pgErr(t1control.commit_error) : null;
  const t1cCommitted = t1cErr === null && t1control.error === null;
  await checkpoint('t1-control-done', { t1_control: {
    tx_error: t1control.error ? pgErr(t1control.error) : null, commit_error: t1cErr,
    committed: t1cCommitted, committed_rows_readback: t1cCommitted
      ? (await q1(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key = $1`, [`biz:job:settle:${JOB(1)}`]))?.n : null,
    result: t1control.result, ms: t1control.ms } });

  if (!t1cCommitted) {
    checkpoint('ABORT-contract-path-broken', { status: 'HALTED_CONTROL_ARM_FAILED' });
    return 3;
  }

  // ================= T1 篡改臂 ①（丢最后一对 commission）真 COMMIT =================
  const t1a = await inTx('commit', async (tx) => {
    const s = await setupEvent(tx, JOB(2));
    const beforeE = (s.payload as St).entries as St[];
    const t = tamperDropLastPair(s.payload as St);
    const afterE = t.entries as St[];
    const dropped = kinds(beforeE).slice(Math.max(0, beforeE.length - 2));
    const post = await tryFn(tx, t);
    const inTxRows = post.ok === true ? (await q(tx, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`biz:job:settle:${JOB(2)}%`]))[0]?.n : null;
    return { job: JOB(2), entries_before: beforeE.length, entries_after: afterE.length, dropped_kinds: dropped,
      tamper_valid: dropped.length === 2 && dropped.every((k) => k === 'commission') && afterE.length > 0,
      sum_delta_before: sumDelta(beforeE), sum_delta_after: sumDelta(afterE),
      sum_delta_unchanged: sumDelta(beforeE) === sumDelta(afterE), rows_in_db_in_tx: inTxRows,
      event_key: (s.payload as St).idempotency_key, post };
  });
  const t1aErr = t1a.commit_error ? pgErr(t1a.commit_error) : null;
  const t1aLanded = (await q1(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`biz:job:settle:${JOB(2)}%`]))?.n;
  const t1aRes = await myResidue(pool, CID);
  await checkpoint('t1-tamper-a-done', { t1_tamper_drop_pair_commit: {
    tx_error: t1a.error ? pgErr(t1a.error) : null, commit_error: t1aErr, committed: t1aErr === null && t1a.error === null,
    tamper_landed_rows_after_commit: t1aLanded, result: t1a.result, residue_after: t1aRes, ms: t1a.ms } });

  const t1aPostOk = ((t1a.result as St)?.post as St)?.ok === true;
  if (t1aErr === null && t1a.error === null && t1aPostOk && Number(t1aLanded) > 0) {
    const coords = await q(pool, `SELECT txid::text AS txid, cid::text AS cid, uid::text AS uid, event_root_key::text AS k, kind::text AS kind, delta::text AS delta
        FROM public.ledger_entry WHERE idempotency_key LIKE 'biz:job:settle:${JOB(2)}%' ORDER BY txid`);
    await checkpoint('HALT-tamper-committed', { status: 'HALTED_TAMPER_COMMITTED', halt_reason: 'T1 篡改臂①被 COMMIT 接受 ⇒ 闸未响（顶级发现）',
      residue_coordinates: { txids: coords, cid: CID, uid_window: [EMP, WORKER, A1, A2, A3], event_root_key: `biz:job:settle:${JOB(2)}` } });
    return 3;
  }

  // ================= T1 篡改臂 ②（只入不出）真 COMMIT =================
  const t1b = await inTx('commit', async (tx) => {
    const s = await setupEvent(tx, JOB(3));
    const beforeE = (s.payload as St).entries as St[];
    const t = tamperPoolInNoOut(s.payload as St);
    const afterE = t.entries as St[];
    const post = await tryFn(tx, t);
    const inTxRows = post.ok === true ? (await q(tx, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`biz:job:settle:${JOB(3)}%`]))[0]?.n : null;
    return { job: JOB(3), entries_before: beforeE.length, entries_after: afterE.length,
      dropped_kinds: kinds(beforeE).slice(4), tamper_valid: afterE.length === 4 && afterE.every((e) => e.kind !== 'commission'),
      sum_delta_before: sumDelta(beforeE), sum_delta_after: sumDelta(afterE),
      sum_delta_unchanged: sumDelta(beforeE) === sumDelta(afterE), rows_in_db_in_tx: inTxRows,
      event_key: (s.payload as St).idempotency_key, post };
  });
  const t1bErr = t1b.commit_error ? pgErr(t1b.commit_error) : null;
  const t1bLanded = (await q1(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`biz:job:settle:${JOB(3)}%`]))?.n;
  const t1bRes = await myResidue(pool, CID);
  await checkpoint('t1-tamper-b-done', { t1_tamper_pool_in_no_out_commit: {
    tx_error: t1b.error ? pgErr(t1b.error) : null, commit_error: t1bErr, committed: t1bErr === null && t1b.error === null,
    tamper_landed_rows_after_commit: t1bLanded, result: t1b.result, residue_after: t1bRes, ms: t1b.ms } });
  const t1bPostOk = ((t1b.result as St)?.post as St)?.ok === true;
  if (t1bErr === null && t1b.error === null && t1bPostOk && Number(t1bLanded) > 0) {
    const coords = await q(pool, `SELECT txid::text AS txid, cid::text AS cid, uid::text AS uid, event_root_key::text AS k, kind::text AS kind, delta::text AS delta
        FROM public.ledger_entry WHERE idempotency_key LIKE 'biz:job:settle:${JOB(3)}%' ORDER BY txid`);
    await checkpoint('HALT-tamper-committed-b', { status: 'HALTED_TAMPER_COMMITTED', halt_reason: 'T1 篡改臂②被 COMMIT 接受 ⇒ 闸未响（顶级发现）',
      residue_coordinates: { txids: coords, cid: CID, event_root_key: `biz:job:settle:${JOB(3)}` } });
    return 3;
  }

  // ================= T2（已闭合后强制结算必须判负；回滚事务）=================
  const t2 = await inTx('rollback', async (tx) => {
    const s = await setupEvent(tx, JOB(4));
    const t = tamperDropLastPair(s.payload as St);
    const post = await tryFn(tx, t);
    const closure = await closureState(tx, CID);
    const flush = await tryQ(tx, 'SET CONSTRAINTS ALL IMMEDIATE');
    return { job: JOB(4), entries_after: (t.entries as St[]).length, sum_delta_after: sumDelta(t.entries as St[]),
      post_before_closure: post, closure_before_flush: closure, flush_after_post: flush };
  });
  await checkpoint('t2-done', { t2_closed_then_immediate: { tx_error: t2.error ? pgErr(t2.error) : null, result: t2.result, ms: t2.ms } });

  // ================= T3（未闭合窗口逃逸；回滚事务）=================
  const t3 = await inTx('rollback', async (tx) => {
    const immBefore = await tryQ(tx, 'SET CONSTRAINTS ALL IMMEDIATE');
    const s = await setupEvent(tx, JOB(5));
    const t = tamperPoolInNoOut(s.payload as St);
    const post = await tryFn(tx, t);
    const closureAfterPost = await closureState(tx, CID);
    const flush = await tryQ(tx, 'SET CONSTRAINTS ALL IMMEDIATE');
    return { job: JOB(5), immediate_before_post: immBefore, entries_after: (t.entries as St[]).length,
      sum_delta_after: sumDelta(t.entries as St[]), post_while_immediate: post, closure_after_post: closureAfterPost, flush_after: flush };
  });
  await checkpoint('t3-done', { t3_unclosed_window_escape: { tx_error: t3.error ? pgErr(t3.error) : null, result: t3.result, ms: t3.ms } });

  const t3b = await inTx('rollback', async (tx) => {
    const immBefore = await tryQ(tx, 'SET CONSTRAINTS ALL IMMEDIATE');
    const s = await setupEvent(tx, JOB(6));
    const t = tamperDropLastPair(s.payload as St);
    const post = await tryFn(tx, t);
    const flush = await tryQ(tx, 'SET CONSTRAINTS ALL IMMEDIATE');
    return { job: JOB(6), immediate_before_post: immBefore, entries_after: (t.entries as St[]).length,
      post_while_immediate: post, flush_after: flush };
  });
  await checkpoint('t3b-done', { t3b_unclosed_drop_pair: { tx_error: t3b.error ? pgErr(t3b.error) : null, result: t3b.result, ms: t3b.ms } });

  // ================= T4（仅 DEFERRED = no-op + 回滚 ⇒ 不报）=================
  const t4 = await inTx('rollback', async (tx) => {
    const s = await setupEvent(tx, JOB(7));
    const t = tamperDropLastPair(s.payload as St);
    const setDef = await tryQ(tx, 'SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED');
    const post = await tryFn(tx, t);
    const after = await tryQ(tx, 'SELECT 1 AS x');
    return { job: JOB(7), entries_after: (t.entries as St[]).length, set_deferred_noop: setDef, post,
      post_flush_probe_note: '无任何 flush（未 SET IMMEDIATE、未 COMMIT），事务随即 ROLLBACK',
      subsequent_statement_ok: after.ok };
  });
  await checkpoint('t4-done', { t4_deferred_noop_then_rollback: { tx_error: t4.error ? pgErr(t4.error) : null, result: t4.result, rolled_back: true, ms: t4.ms } });

  // ================= T5（E4 反例：摘守卫的 referral 腿）=================
  const [C1, PB, PC] = REF_UIDS;
  const t5a = await inTx('rollback', async (tx) => {
    await q(tx, `INSERT INTO public.users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                   FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [[C1, PB, PC].map(String)]);
    const dis = await tryQ(tx, 'ALTER TABLE public.referral DISABLE TRIGGER trg_referral_cycle_guard');
    const ins = await tryQ(tx, 'INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)', [C1, PB]);
    return { child: C1, parent: PB, depth_literal: 0, disable: dis, first_insert: ins };
  });
  const t5b = await inTx('rollback', async (tx) => {
    await q(tx, `INSERT INTO public.users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                   FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [[C1, PB, PC].map(String)]);
    const dis = await tryQ(tx, 'ALTER TABLE public.referral DISABLE TRIGGER trg_referral_cycle_guard');
    const first = await tryQ(tx, 'INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)', [C1, PB]);
    const rebind = await tryQ(tx, 'INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)', [C1, PC]);
    const en = await tryQ(tx, 'ALTER TABLE public.referral ENABLE TRIGGER trg_referral_cycle_guard');
    return { child: C1, parent: PB, parent2: PC, depth_literal: 1, disable: dis, first_insert: first, rebind, enable: en };
  });
  await checkpoint('t5-done', { t5_e4_counterexample: {
    depth0_leg: { tx_error: t5a.error ? pgErr(t5a.error) : null, result: t5a.result },
    depth1_leg: { tx_error: t5b.error ? pgErr(t5b.error) : null, result: t5b.result } } });

  const refResidue = await myResidue(pool, CID);

  // ================= T8 after =================
  const after = await snapshot(pool);
  const resAfter = await myResidue(pool, CID);
  const same = JSON.stringify(before.fn_fingerprints) === JSON.stringify(after.fn_fingerprints);
  await checkpoint('t8-after-done', {
    status: 'DONE',
    t8_after: after,
    t8_invariants: {
      fn_fingerprints_identical: same,
      schema_reads_identical: JSON.stringify(before.schema_reads) === JSON.stringify(after.schema_reads),
      registry_rows_identical: JSON.stringify(before.registry) === JSON.stringify(after.registry),
      triggers_identical: JSON.stringify(before.triggers) === JSON.stringify(after.triggers),
      cid1_conservation_identical: JSON.stringify(before.cid1_conservation) === JSON.stringify(after.cid1_conservation),
    },
    residue_after_session: resAfter,
    residue_referral_legs: refResidue,
    counts_delta: Object.fromEntries(Object.keys(before.counts as St).map((k) =>
      [k, Number((after.counts as St)[k]) - Number((before.counts as St)[k])])),
    notice_capture: noticeCap, notices,
    finished_at: new Date().toISOString(),
  });
  return 0;
};

process.on('unhandledRejection', (e: unknown) => {
  try { checkpoint('CRASH-unhandledRejection', { status: 'CRASHED', crash: String((e as Error)?.stack ?? e) }); } catch { /* noop */ }
  process.exit(2);
});
process.on('uncaughtException', (e: Error) => {
  try { checkpoint('CRASH-uncaughtException', { status: 'CRASHED', crash: String(e?.stack ?? e) }); } catch { /* noop */ }
  process.exit(2);
});

main().then((code) => {
  try { pool.end(); } catch { /* noop */ }
  process.exit(code);
}).catch((e) => {
  try { checkpoint('CRASH-main', { status: 'CRASHED', crash: String((e as Error)?.stack ?? e) }); } catch { /* noop */ }
  process.exit(2);
});
