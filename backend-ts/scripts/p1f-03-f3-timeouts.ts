/**
 * P1F-03 · F3【中】超时 / 预算 / 基础设施分类 —— 「实测生效」原始读数
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1f-03-f3-timeouts.ts
 * 落盘：.p1f-artifacts/p1f03-f3-readings-<run>.json（**run-tagged，每次运行一个新文件**）
 *       —— `<run>` = 启动时生成的 5 位 run tag（与脚本内 `RUN` 同值）。
 *       〔P1n 修正（Zang 裁定 F-1）〕修前写死固定路径 `p1f03-f3-readings.json`，验证方复跑会**覆盖
 *       实施方那轮原件**（曾出事故：报告读数 run=GT4OR ↔ 盘上文件 run=H262V）。
 *       无后缀的 `p1f03-f3-readings.json` 是**历史原始证据**，**不删不改**；此后一律 run-tagged。
 * ⚠️ chain 用例的**终局码是合法的非确定性**（Zang 裁定 F-1b）：末次等锁先撞 3s `lock_timeout` ⇒
 *    `LD025 LEDGER_LOCK_TIMEOUT`；10s 预算先耗尽 ⇒ `LD026 LEDGER_TX_TIMEOUT / statement_budget_exhausted`。
 *    **两个码都合法**（两条路径都被钳住）⇒ 断言只能针对「**等待有界**」（`wait_bounded`），
 *    **不得**钉死某一个码（`terminal_code_in_legal_set` 即该判据的机读投影）。
 *
 * 六项读数（逐项取原始 SQLSTATE / MESSAGE / DETAIL / 计时）：
 *   ① `55P03 → LD025`：伙伴事务持锁 → 直调 transfer。最终码不得再是裸 `55P03`；
 *      该次尝试 `rows_written=0` 且余额逐字未变；释放锁后**同键重试**成功
 *      ⇒ 该键流水恰 2 条、debit 恰一次。
 *   ② `40P01 → LD027`：构造**真死锁**，记录 `pg_stat_database.deadlocks` 增量、
 *      函数返回的码与 `DETAIL.retries_performed=0 / retry_owner=caller`；
 *      并走**公开 API**（src/ledger.ts `transfer`）证明 TS 拿到 LD027 后
 *      R60 同键重试**仍生效且不双扣**（RETRYABLE_SQLSTATES 含 'LD027'）。
 *   ③ `57014` / 预算耗尽 → `LD026`：① 过期 deadline 直调 `ledger_check_budget` /
 *      `ledger_arm_lock_timeout` ⇒ `LD026 reason=statement_budget_exhausted`；
 *      ② **独立语句** `SET statement_timeout` 后再调函数（同语句 `set_config` 无效，
 *      见 0005 §B 与 p1f-00 实测）⇒ 真拿一次 `57014`。
 *   ④ 预算钳位：`ledger_arm_lock_timeout(clock_timestamp()+1s)` 后 `SHOW lock_timeout`
 *      应为 **1000ms**；deadline 充裕时应为 **3000ms**（证明 `min(3s, 剩余)` 生效）。
 *   ⑤ 6 持锁链总等待：6 个持锁者按时序释放 ⇒ 实测总等待是否被钳到 **≤~10s**
 *      （修前读数 15583ms；旧宣称最坏 48s）。
 *   ⑥ 基础设施类 → 503：`53300` / `XX000` 的 DB 侧分类器读数 + TS 侧
 *      `normalizeLedgerError` 的直接 raw 读数（含真实错误对象喂入）。
 *
 * 测试数据分区：uid **944xxx** / symbol 前缀 **p1k** / 键前缀 **ops:p1k:***
 * （920/931/941/942/943 已占）；**绝不触碰 cid=1 与平台账户**（只读）。
 * 只新增测试数据；不改 schema、不改 `schema_migration`、不 commit。
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from '@neondatabase/serverless';
import { mkPool, raw, pgInfo, ensureCurrency, accountOf, sleep } from './p1f-lib';
import { normalizeLedgerError, infraSqlstateReason, LEDGER_ERROR_TABLE } from '../src/ledger-errors';
import {
  transfer, findEntriesByIdempotencyKey, LEDGER_SQLSTATE_TO_CODE, closeLedgerWritePool,
} from '../src/ledger';

const RUN = Date.now().toString(36).toUpperCase().slice(-5);

// ---------------------------------------------------------------------------
// 运行时仪表（**不改任何仓库文件**）：包住 @neondatabase/serverless 的 Pool.prototype.query，
// 记录每一次 DB 报错。用来抓 TS 侧 `runLedgerFn` 内部**被重试循环吞掉**的那一发 LD027
// （否则外部只能看到「重试后成功」，看不到「第一发到底错在哪」）。
// ---------------------------------------------------------------------------
type AnyQueryFn = (this: unknown, ...a: unknown[]) => unknown;
const capturedDbErrors: Array<Record<string, unknown>> = [];
let captureDbErrors = false;
{
  const proto = Pool.prototype as unknown as { query: AnyQueryFn };
  const orig = proto.query;
  proto.query = function patched(this: unknown, ...args: unknown[]): unknown {
    const out = orig.apply(this, args) as { then?: unknown };
    if (out && typeof out.then === 'function') {
      return (out as Promise<unknown>).then((v) => v, (e: unknown) => {
        if (captureDbErrors) {
          capturedDbErrors.push({
            at_ms: Date.now(),
            sql_head: typeof args[0] === 'string' ? String(args[0]).slice(0, 60) : null,
            code: (e as { code?: unknown })?.code ?? null,
            message: (e as { message?: unknown })?.message ?? null,
            detail: (e as { detail?: unknown })?.detail ?? null,
          });
        }
        throw e;
      });
    }
    return out;
  };
}
const SYM = (`P1K${RUN}`).slice(0, 10);
const CID = { v: '' };
const U = {
  src: '944001', tot: '944002',
  ddA: '944011', ddB: '944012', dd2A: '944013', dd2B: '944014',
  c1: '944021', c2: '944022', c3: '944023', c4: '944024', c5: '944025', c6: '944026',
  st: '944030',
};
const K = (s: string): string => `ops:p1k:${RUN}:${s}`;
const out: Record<string, unknown> = { run: RUN, symbol: SYM, started_at: new Date().toISOString() };

/**
 * Zang 裁定 F-1b：chain 用例的终局码是**合法的非确定性** —— 末次等锁先撞 3s `lock_timeout`
 * ⇒ `LD025 LEDGER_LOCK_TIMEOUT`；10s 自证预算先耗尽 ⇒ `LD026 LEDGER_TX_TIMEOUT /
 * statement_budget_exhausted`。**两者都被钳住、都合法** ⇒ 判据只能写「等待有界」，
 * 不得把某一个码钉成期望值（本集合 = 该判据的机读投影）。
 */
const TERMINAL_CODE_LEGAL_SET = ['LD025', 'LD026'] as const;

const callFnRaw = async (url: string, pool: Pool, payload: unknown) => {
  const t0 = Date.now();
  try {
    const r = await raw<{ r: unknown }>(pool, 'SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
    const v = r[0]?.r;
    return { via: url, ok_roundtrip: true, elapsed_ms: Date.now() - t0, result: typeof v === 'string' ? JSON.parse(v) : v };
  } catch (e) {
    return { via: url, ok_roundtrip: false, elapsed_ms: Date.now() - t0, error: pgInfo(e) };
  }
};

/** 直调 SQL，取原始错误（用于预算助手 / 分类器） */
const sqlRaw = async (pool: Pool, sql: string, params: unknown[] = []) => {
  const t0 = Date.now();
  try {
    return { ok: true, elapsed_ms: Date.now() - t0, rows: await raw(pool, sql, params) };
  } catch (e) {
    return { ok: false, elapsed_ms: Date.now() - t0, error: pgInfo(e) };
  }
};

const countsForKey = async (p: Pool, key: string) => ({
  by_root_key: String((await raw<{ n: string }>(p,
    'SELECT count(*)::text AS n FROM ledger_entry WHERE event_root_key = $1', [key]))[0].n),
  debits: String((await raw<{ n: string }>(p,
    'SELECT count(*)::text AS n FROM ledger_entry WHERE event_root_key = $1 AND delta < 0', [key]))[0].n),
  credits: String((await raw<{ n: string }>(p,
    'SELECT count(*)::text AS n FROM ledger_entry WHERE event_root_key = $1 AND delta > 0', [key]))[0].n),
  exact_key_rows: String((await raw<{ n: string }>(p,
    'SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key = $1', [key]))[0].n),
});

/** 轮询：确认某条 `ledger_post_event` 卡在 Lock 等待（用于确定性构造死锁） */
const waitLockWait = async (admin: Pool, budgetMs = 6000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const rows = await raw(admin, `SELECT pid::text AS pid, wait_event_type, left(query,50) AS q
                                     FROM pg_stat_activity
                                    WHERE query ILIKE '%ledger_post_event%' AND pid <> pg_backend_pid()
                                      AND wait_event_type = 'Lock' LIMIT 1`);
    if (rows.length) return { seen: true, waited_ms: Date.now() - t0, row: rows[0] };
    await sleep(80);
  }
  return { seen: false, waited_ms: Date.now() - t0, row: null };
};

const deadlockCount = async (p: Pool): Promise<number> =>
  Number((await raw<{ n: string }>(p, 'SELECT COALESCE(SUM(deadlocks),0)::text AS n FROM pg_stat_database'))[0].n);

type Settled = { ok: true; value: unknown } | { ok: false; err: unknown };
/** 立即挂载 handler 的「延后 await」包装：避免 Node 把迟到 reject 当 unhandled rejection 崩进程 */
const settled = (p: Promise<unknown>): Promise<Settled> =>
  p.then((value) => ({ ok: true as const, value }), (err) => ({ ok: false as const, err }));

const main = async (): Promise<void> => {
  const admin = mkPool(3);                      // 直连：只读取证 + 轮询
  const guarded = mkPool(2);                    // 直连：种子/只读辅助

  // ================================================================ §0 环境
  out.env = {
    schema_version: (await raw(admin, `SELECT max(version)::text AS v FROM schema_migration`))[0],
    schema_migration_rows: await raw(admin, 'SELECT version, left(checksum,12) AS ck FROM schema_migration ORDER BY version'),
    gucs: await raw(admin, `SELECT current_setting('statement_timeout') AS statement_timeout,
                                   current_setting('lock_timeout') AS lock_timeout,
                                   current_setting('deadlock_timeout') AS deadlock_timeout`),
    fns: await raw(admin, `SELECT proname, pg_get_function_identity_arguments(oid) AS args
                             FROM pg_proc WHERE proname IN
                             ('ledger_post_event','ledger_error_for_sqlstate','ledger_arm_lock_timeout',
                              'ledger_check_budget','ledger_budget_remaining_ms','ledger_stmt_budget_ms',
                              'ledger_lock_timeout_ms') ORDER BY proname`),
    budget_constants: (await raw(admin, `SELECT ledger_stmt_budget_ms()::text AS stmt_budget_ms,
                                                ledger_lock_timeout_ms()::text AS lock_timeout_ms,
                                                ledger_budget_remaining_ms(NULL)::text AS remaining_null`))[0],
  };

  // ================================================================ §0b 测试数据
  CID.v = await ensureCurrency(guarded, SYM, 944001n, 2, 'listed', '100000000000');
  const cid = CID.v;
  const seedKey = K('seed:mint');
  const seed = await callFnRaw('direct', guarded,
    { op: 'mint', idempotency_key: seedKey, uid: U.src, cid, amount_units: '1000000' });
  // 一次 entries 事件给 12 个目标账户各 1000（Σ=0，13 账户 ≤ R64 的 16 上限）
  const targets = [U.tot, U.ddA, U.ddB, U.dd2A, U.dd2B, U.c1, U.c2, U.c3, U.c4, U.c5, U.c6, U.st];
  const seed2Key = K('seed:fanout');
  const seed2 = await callFnRaw('direct', guarded, {
    op: 'entries', idempotency_key: seed2Key,
    entries: [{ uid: U.src, cid, delta: String(-1000 * targets.length), kind: 'transfer' },
      ...targets.map((u) => ({ uid: u, cid, delta: '1000', kind: 'transfer' }))],
  });
  out.test_data = {
    currency: { cid, symbol: SYM, owner_uid: 944001, decimals: 2 },
    seed_mint: { key: seedKey, ok: seed.ok_roundtrip, error: seed.error ?? null },
    seed_fanout: { key: seed2Key, ok: seed2.ok_roundtrip, error: seed2.error ?? null, accounts: targets.length + 1 },
    balances_after_seed: await raw(guarded,
      `SELECT uid::text, balance::text, frozen::text FROM account WHERE cid = $1 ORDER BY uid`, [cid]),
  };

  // ================================================================ §1 55P03 → LD025
  {
    const key = K('lkt');
    const holder = mkPool(1);
    await holder.query('SELECT 1');
    const balBefore = await accountOf(guarded, U.src, cid);
    await holder.query('BEGIN');
    await holder.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.src, cid]);
    const attempt1 = await callFnRaw('direct', guarded,
      { op: 'transfer', idempotency_key: key, from_uid: U.src, to_uid: U.tot, cid, amount_units: '1000' });
    const afterFail = { src: await accountOf(guarded, U.src, cid), tot: await accountOf(guarded, U.tot, cid) };
    const rowsAfterFail = await countsForKey(guarded, key);
    await holder.query('ROLLBACK').catch(() => undefined);
    await holder.end().catch(() => undefined);
    // 同键重试（R60：键不变 ⇒ 安全）
    const attempt2 = await callFnRaw('direct', guarded,
      { op: 'transfer', idempotency_key: key, from_uid: U.src, to_uid: U.tot, cid, amount_units: '1000' });
    await sleep(200);
    out.locktimeout_55P03 = {
      key,
      attempt1,
      final_sqlstate: attempt1.error?.code ?? null,
      final_message: attempt1.error?.message ?? null,
      final_detail: attempt1.error?.detail ?? null,
      raw_55P03_escaped: (attempt1.error?.code ?? '') === '55P03',
      rows_written_0: rowsAfterFail.by_root_key === '0',
      entries_for_key_after_fail: rowsAfterFail,
      src_balance_before: balBefore?.balance ?? null,
      src_balance_after_fail: afterFail.src?.balance ?? null,
      tot_balance_after_fail: afterFail.tot?.balance ?? null,
      balance_unchanged: String(balBefore?.balance) === String(afterFail.src?.balance),
      attempt2_same_key: attempt2,
      retry_result: attempt2.result ? {
        txid: (attempt2.result as Record<string, unknown>).txid,
        entries: ((attempt2.result as Record<string, unknown>).entries as unknown[])?.length ?? null,
      } : null,
      entries_for_key_after_retry: await countsForKey(guarded, key),
      src_balance_final: (await accountOf(guarded, U.src, cid))?.balance ?? null,
      tot_balance_final: (await accountOf(guarded, U.tot, cid))?.balance ?? null,
    };
  }

  // ================================================================ §2 40P01 → LD027（DB 直调 + 公开 API）
  {
    // --- (a) DB 直调：伙伴持 U2，函数先取 U1 再等 U2，伙伴随后抢 U1 ⇒ 真死锁
    const key = K('dd1');
    const dlBefore = await deadlockCount(admin);
    const p1 = mkPool(1);
    await p1.query('SELECT 1');
    await p1.query('BEGIN');
    await p1.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.ddB, cid]);
    const caller = mkPool(1);
    await caller.query('SELECT 1');
    await caller.query('BEGIN');
    const t0 = Date.now();
    const callerP = settled(raw<{ r: unknown }>(caller, 'SELECT ledger_post_event($1::jsonb) AS r',
      [JSON.stringify({ op: 'transfer', idempotency_key: key, from_uid: U.ddA, to_uid: U.ddB, cid, amount_units: '500' })]));
    const lw = await waitLockWait(admin);                       // 等到「函数已卡在 U2 等待」
    const p1P = settled(raw(p1, 'SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.ddA, cid]));
    const callerRes = await callerP;
    const callerMs = Date.now() - t0;
    const p1Res = await p1P;
    const callerErr: unknown = callerRes.ok ? null : callerRes.err;
    const callerOk = callerRes.ok;
    const p1Err: unknown = p1Res.ok ? null : p1Res.err;
    await caller.query('ROLLBACK').catch(() => undefined);
    await p1.query('ROLLBACK').catch(() => undefined);
    await p1.end().catch(() => undefined); await caller.end().catch(() => undefined);
    const dlAfter = await deadlockCount(admin);
    let detailParsed: unknown = null;
    const dRaw = (callerErr as { detail?: unknown } | null)?.detail;
    if (typeof dRaw === 'string') { try { detailParsed = JSON.parse(dRaw); } catch { detailParsed = dRaw; } }
    out.deadlock_40P01_db = {
      key,
      lock_wait_seen: lw,
      deadlocks_before: dlBefore, deadlocks_after: dlAfter, deadlocks_delta: dlAfter - dlBefore,
      caller_elapsed_ms: callerMs,
      caller_final_sqlstate: pgInfo(callerErr).code,
      caller_final_message: pgInfo(callerErr).message,
      caller_detail_raw: dRaw ?? null,
      caller_detail_parsed: detailParsed,
      raw_40P01_escaped: pgInfo(callerErr).code === '40P01',
      retries_performed_0: (detailParsed as Record<string, unknown>)?.retries_performed === 0,
      retry_owner_caller: (detailParsed as Record<string, unknown>)?.retry_owner === 'caller',
      partner_after_cycle: pgInfo(p1Err).code ?? 'no_error(acquired_after_victim_abort)',
      rows_written_0: (await countsForKey(guarded, key)).by_root_key === '0',
      entries_for_key: await countsForKey(guarded, key),
    };

    // --- (b) 公开 API：TS transfer 拿到 LD027 ⇒ R60 同键重试必须把它救回来（且不双扣）
    const key2 = K('dd2');
    const dl2Before = await deadlockCount(admin);
    const p2 = mkPool(1);
    await p2.query('SELECT 1');
    await p2.query('BEGIN');
    await p2.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.dd2B, cid]);
    const balA0 = (await accountOf(guarded, U.dd2A, cid))?.balance ?? null;
    const balB0 = (await accountOf(guarded, U.dd2B, cid))?.balance ?? null;
    const t1 = Date.now();
    capturedDbErrors.length = 0;
    captureDbErrors = true;
    const apiP = settled(transfer({ fromUid: U.dd2A, toUid: U.dd2B, cid, amount: '1', idempotencyKey: key2 }));
    // 语句级观察器：记录该函数语句在服务端的**每一次执行**（pid+query_start）
    //   ⇒ 出现 2 个不同 query_start = 「同键重试真的又发了一发」的直接证据
    const seenStmts = new Map<string, string>();
    let watching = true;
    const watcher = (async () => {
      while (watching) {
        try {
          const rs = await raw<{ pid: string; qs: string; we: string | null }>(admin,
            `SELECT pid::text AS pid, query_start::text AS qs, wait_event_type AS we
               FROM pg_stat_activity WHERE query ILIKE '%ledger_post_event%' AND pid <> pg_backend_pid()`);
          for (const r of rs) seenStmts.set(`${r.pid}|${r.qs}`, `${r.pid}|${r.qs}|${r.we}`);
        } catch { /* 观察器失败不影响主流程 */ }
        await sleep(60);
      }
    })();
    const lw2 = await waitLockWait(admin);                     // TS 已卡在 U2′
    const p2P = settled(raw(p2, 'SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.dd2A, cid]));
    const p2Res = await p2P;
    // 让重试那一发「真的一次重发」：死锁受害者（TS）已 abort，但伙伴再压住 U2′ 2s
    await sleep(2000);
    await p2.query('COMMIT').catch(() => undefined);
    const apiRes = await apiP;
    const apiMs = Date.now() - t1;
    captureDbErrors = false;
    const caughtByInstrumentation = capturedDbErrors.map((r) => ({ ...r, at_ms_from_call_ms: Number(r.at_ms) - t1 }));
    watching = false;
    await watcher.catch(() => undefined);
    const apiResult = (apiRes.ok ? apiRes.value : null) as Record<string, unknown> | null;
    const apiError = apiRes.ok ? null : pgInfo(apiRes.err);
    const p2Err: unknown = p2Res.ok ? null : p2Res.err;
    await p2.end().catch(() => undefined);
    const dl2After = await deadlockCount(admin);
    const apiEntries = await findEntriesByIdempotencyKey(key2);
    const sumA = apiEntries.filter((e) => String(e.uid) === U.dd2A)
      .reduce((s, e) => s + Number(e.delta), 0);
    const sumB = apiEntries.filter((e) => String(e.uid) === U.dd2B)
      .reduce((s, e) => s + Number(e.delta), 0);
    const balA1 = (await accountOf(guarded, U.dd2A, cid))?.balance ?? null;
    const balB1 = (await accountOf(guarded, U.dd2B, cid))?.balance ?? null;
    out.deadlock_40P01_public_api = {
      key: key2,
      lock_wait_seen: lw2,
      deadlocks_delta: dl2After - dl2Before,
      api_elapsed_ms: apiMs,
      api_ok: !!apiResult && apiResult.ok === true,
      api_idempotent_replay: apiResult?.idempotent_replay ?? null,
      api_txid: apiResult?.txid ?? null,
      api_entries_count: (apiResult?.entries as unknown[] | undefined)?.length ?? null,
      api_error: apiError,
      /** 运行时仪表抓到的**所有** DB 报错（含被 runLedgerFn 重试循环吞掉的那一发） */
      captured_internal_db_errors: caughtByInstrumentation,
      captured_first_error_is_LD027: ((caughtByInstrumentation[0] as Record<string, unknown> | undefined)?.code ?? '') === 'LD027',
      /** 服务端观察到的函数语句执行次数（>1 ⇒ TS 真的同键重发了一发） */
      distinct_fn_statements_observed: seenStmts.size,
      fn_statements: [...seenStmts.values()],
      retry_actually_reissued: seenStmts.size >= 2,
      // 反证：不重试则该调用会在 ~1.3s（死锁探测 1s）直接抛 LEDGER_DEADLOCK_RETRY_EXHAUSTED(503)
      api_ms_ge_deadlock_probe_plus_hold: apiMs >= 2500,
      partner_sqlstate: pgInfo(p2Err).code ?? 'no_error(acquired_after_victim_abort)',
      entries_for_key: await countsForKey(guarded, key2),
      find_by_key_rows: apiEntries.length,
      find_by_key_debits: apiEntries.filter((e) => String(e.delta).startsWith('-')).length,
      sum_delta_A: sumA, sum_delta_B: sumB,
      bal_A_before: balA0, bal_A_after: balA1,
      bal_B_before: balB0, bal_B_after: balB1,
      no_double_debit: apiEntries.length === 2 && sumA < 0 && sumA + sumB === 0
        && String(balA1) === String(Number(balA0) + sumA) && String(balB1) === String(Number(balB0) + sumB),
    };
  }

  // ================================================================ §3 57014 / 预算耗尽 → LD026
  {
    // (a) 预算路径（确定性）
    const expired = await sqlRaw(guarded, `SELECT ledger_check_budget(clock_timestamp() - interval '1 second', 'unit_probe')`);
    const expiredArm = await sqlRaw(guarded, `SELECT ledger_arm_lock_timeout(clock_timestamp() - interval '1 second', 'unit_probe')`);
    const nullDeadline = await sqlRaw(guarded, `SELECT ledger_check_budget(NULL::timestamptz, 'null_deadline')`);
    const exact = await sqlRaw(guarded, `SELECT ledger_check_budget(clock_timestamp() + interval '5 seconds', 'future')`);

    // (b) 真 57014：**独立语句** SET statement_timeout，再调函数（同语句 set_config 无效）
    const key = K('stmt57014');
    const holder = mkPool(1);
    await holder.query('SELECT 1');
    await holder.query('BEGIN');
    await holder.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.st, cid]);
    const sess = mkPool(1);
    await sess.query('SELECT 1');
    const setTo = await sqlRaw(sess, `SET statement_timeout = '600'`);
    const showT = await sqlRaw(sess, `SHOW statement_timeout`);
    const attempt = await callFnRaw('direct', sess,
      { op: 'transfer', idempotency_key: key, from_uid: U.st, to_uid: U.tot, cid, amount_units: '100' });
    const resetT = await sqlRaw(sess, `SET statement_timeout = 0`);
    await holder.query('ROLLBACK').catch(() => undefined);
    await holder.end().catch(() => undefined);
    await sess.end().catch(() => undefined);
    let dP: unknown = null;
    const dR = attempt.error?.detail;
    if (typeof dR === 'string') { try { dP = JSON.parse(dR); } catch { dP = dR; } }
    out.budget_exhausted_LD026 = {
      expired_deadline_check_budget: expired,
      expired_deadline_arm_lock_timeout: expiredArm,
      null_deadline_no_error: nullDeadline.ok === true,
      future_deadline_no_error: exact.ok === true,
      real_57014: {
        set_statement_timeout: setTo, show_after_set: showT.rows, reset: resetT.ok,
        key, elapsed_ms: attempt.elapsed_ms,
        final_sqlstate: attempt.error?.code ?? null,
        final_message: attempt.error?.message ?? null,
        final_detail_raw: dR ?? null,
        final_detail_parsed: dP,
        raw_57014_escaped: (attempt.error?.code ?? '') === '57014',
        rows_written_0: (await countsForKey(guarded, key)).by_root_key === '0',
      },
    };

    // (c) 隔离实验：**为什么** 57014 会绕过函数的唯一 EXCEPTION 处理器？
    //     匿名 DO 块（无 DDL、会话内即弃）：WHEN OTHERS 捕获到 ⇒ 主动改抛 ZZ999（可见）；
    //     没捕获到 ⇒ 直接看到原始 SQLSTATE。
    //     **每次探测都新建连接**：statement_timeout 取消会让 WS 驱动与 TCP 流错位，
    //     复用连接会拿到「上一发取消」的残留响应（首次实现即踩到，读数全是 0ms 假绿）。
    const holder2 = mkPool(1);
    await holder2.query('SELECT 1');
    await holder2.query('BEGIN');
    await holder2.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [U.st, cid]);
    const CAUGHT = `EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = 'CAUGHT:' || SQLSTATE;`;
    const isoProbe = async (label: string, setup: string[], body: string) => {
      const pool = mkPool(1);
      const cl = (await pool.connect()) as unknown as {
        query: (s: string) => Promise<unknown>; release: () => void;
      };
      const t0 = Date.now();
      try {
        await cl.query('SELECT 1');
        for (const s of setup) await cl.query(s);
        await cl.query(body);
        return { label, ok: true, elapsed_ms: Date.now() - t0, caught: false, sqlstate_seen: null as string | null, message: null as string | null };
      } catch (e) {
        const info = pgInfo(e);
        return { label, ok: false, elapsed_ms: Date.now() - t0, caught: info.code === 'ZZ999', sqlstate_seen: info.code, message: info.message };
      } finally {
        cl.release();
        await pool.end().catch(() => undefined);
      }
    };
    const forUpdate = `PERFORM 1 FROM account WHERE uid = '${U.st}' AND cid = ${cid} FOR UPDATE;`;
    const tA1 = await isoProbe('A1_stmt_timeout+handler(no lock wait)',
      [`SET statement_timeout = '700'`], `DO $do$ BEGIN PERFORM pg_sleep(2); ${CAUGHT} END $do$`);
    const tA2 = await isoProbe('A2_stmt_timeout+NO handler(no lock wait)',
      [`SET statement_timeout = '700'`], `DO $do$ BEGIN PERFORM pg_sleep(2); END $do$`);
    const tB1 = await isoProbe('B1_stmt_timeout+handler(lock wait)',
      [`SET statement_timeout = '700'`], `DO $do$ BEGIN ${forUpdate} ${CAUGHT} END $do$`);
    const tB2 = await isoProbe('B2_lock_timeout+handler(lock wait)',
      [`SET lock_timeout = '700'`], `DO $do$ BEGIN ${forUpdate} ${CAUGHT} END $do$`);
    const tB3 = await isoProbe('B3_stmt_timeout+NO handler(lock wait)',
      [`SET statement_timeout = '700'`], `DO $do$ BEGIN ${forUpdate} END $do$`);
    const tB4 = await isoProbe('B4_lock_timeout+NO handler(lock wait)',
      [`SET lock_timeout = '700'`], `DO $do$ BEGIN ${forUpdate} END $do$`);
    const tB5 = await isoProbe('B5_lock_timeout+plain FOR UPDATE(no function)',
      [`SET lock_timeout = '700'`], `SELECT 1 FROM account WHERE uid = '${U.st}' AND cid = ${cid} FOR UPDATE`);
    await holder2.query('ROLLBACK').catch(() => undefined);
    await holder2.end().catch(() => undefined);
    out.escape_isolation_57014 = {
      note: 'DO 块（匿名 plpgsql，无 DDL）：捕获到 WHEN OTHERS ⇒ 改抛 ZZ999；否则看到原始 SQLSTATE。每探测一条新连接。',
      lock_holder_uid: U.st,
      A1_stmt_timeout_handler_no_lockwait: tA1,
      A2_stmt_timeout_no_handler_no_lockwait: tA2,
      B1_stmt_timeout_handler_lockwait: tB1,
      B2_lock_timeout_handler_lockwait: tB2,
      B3_stmt_timeout_no_handler_lockwait: tB3,
      B4_lock_timeout_no_handler_lockwait: tB4,
      B5_lock_timeout_plain_for_update: tB5,
      verdicts: {
        stmt_timeout_catchable_by_plpgsql: tA1.caught && tB1.caught,
        lock_timeout_catchable_by_plpgsql: tB2.caught,
        stmt_timeout_lockwait_raw_57014_when_no_handler: tB3.sqlstate_seen === '57014',
        lock_timeout_lockwait_raw_55P03_when_no_handler: tB4.sqlstate_seen === '55P03',
        statement_timeout_bypasses_plpgsql_handler: !tA1.caught && !tB1.caught,
      },
    };
  }

  // ================================================================ §4 预算钳位（min(3s, 剩余)）
  {
    const clamp = async (label: string, deadlineExpr: string) => {
      const c = await mkPool(1).connect();
      try {
        await c.query('BEGIN');
        const arm = await c.query(`SELECT ledger_arm_lock_timeout(${deadlineExpr}, $1)`, [label]);
        const show = (await c.query('SHOW lock_timeout')).rows[0] as Record<string, string>;
        const remain = (await c.query(`SELECT ledger_budget_remaining_ms(${deadlineExpr})::text AS r`)).rows[0] as Record<string, string>;
        await c.query('ROLLBACK');
        return { label, deadline_expr: deadlineExpr, arm_rows: arm.rowCount, lock_timeout: show.lock_timeout, remaining_ms_at_call: remain.r };
      } catch (e) {
        await c.query('ROLLBACK').catch(() => undefined);
        return { label, deadline_expr: deadlineExpr, error: pgInfo(e) };
      } finally {
        c.release();
      }
    };
    out.budget_clamp = {
      tight_1s: await clamp('tight_1s(should=1000ms)', `clock_timestamp() + interval '1 second'`),
      tight_1_5s: await clamp('tight_1_5s(should=1500ms)', `clock_timestamp() + interval '1500 milliseconds'`),
      ample_60s: await clamp('ample_60s(should=3000ms)', `clock_timestamp() + interval '60 seconds'`),
      null_deadline: await clamp('null(should=3000ms)', `NULL::timestamptz`),
      // 负向：过期 deadline 直接 LD026（不再去等锁）
      expired: await clamp('expired(should=LD026)', `clock_timestamp() - interval '1 second'`),
    };
  }

  // ================================================================ §5 6 持锁链总等待
  {
    const chain = [U.c1, U.c2, U.c3, U.c4, U.c5, U.c6];
    const SPACING = 2600;                                  // 每个持锁者比上一个多持 2.6s ⇒ 朴素总等待 15.6s
    const key = K('chain6');
    const holders: Pool[] = [];
    const t0 = Date.now();
    try {
      for (let i = 0; i < chain.length; i += 1) {
        const hp = mkPool(1);
        holders.push(hp);
        await hp.query('SELECT 1');
        await hp.query('BEGIN');
        await hp.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [chain[i], cid]);
      }
      const allLockedAt = Date.now();
      const releaseAt = chain.map((_, i) => allLockedAt + SPACING * (i + 1));
      const releases = holders.map((hp, i) => (async () => {
        await sleep(Math.max(0, releaseAt[i] - Date.now()));
        await hp.query('COMMIT').catch(() => undefined);
      })());
      await sleep(400);                                    // 让持锁者全部就位后再发函数
      // DB 侧采样器：记录服务端该语句的 `clock_timestamp() - query_start` 上限
      //   （客户端 elapsed 含一次 WS 错误回传，需与 DB 侧真值并列报出）
      let sampling = true;
      const sampler = (async () => {
        let maxDb = 0; let samples = 0; let lastRow: Record<string, string> | null = null;
        const seen = new Set<string>();
        while (sampling) {
          try {
            const rs = await raw<Record<string, string>>(admin,
              `SELECT pid::text AS pid, query_start::text AS qs, wait_event_type AS we,
                      (EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) * 1000)::text AS db_elapsed_ms
                 FROM pg_stat_activity WHERE query ILIKE '%ledger_post_event%' AND pid <> pg_backend_pid()`);
            if (rs.length) {
              samples += 1;
              seen.add(`${rs[0].pid}|${rs[0].qs}`);
              const v = Number(rs[0].db_elapsed_ms);
              if (v > maxDb) { maxDb = v; lastRow = rs[0]; }
            } else if (maxDb > 0) break;
          } catch { /* 采样失败不影响主流程 */ }
          await sleep(40);
        }
        return { max_db_elapsed_ms: Math.round(maxDb), samples, last_row: lastRow, distinct_stmts: seen.size, statements: [...seen] };
      })();
      const fnStart = Date.now();
      const attempt = await callFnRaw('direct', guarded, {
        op: 'entries', idempotency_key: key,
        entries: [
          { uid: chain[0], cid, delta: '-1', kind: 'transfer' },
          { uid: chain[1], cid, delta: '-1', kind: 'transfer' },
          { uid: chain[2], cid, delta: '-1', kind: 'transfer' },
          { uid: chain[3], cid, delta: '-1', kind: 'transfer' },
          { uid: chain[4], cid, delta: '-1', kind: 'transfer' },
          { uid: chain[5], cid, delta: '5', kind: 'transfer' },
        ],
      });
      const measured = Date.now() - fnStart;
      sampling = false;
      const dbSample = await sampler.catch(() => null);
      await Promise.all(releases);
      let dP: unknown = null;
      const dR = attempt.error?.detail;
      if (typeof dR === 'string') { try { dP = JSON.parse(dR); } catch { dP = dR; } }
      out.total_wait_chain = {
        key, holders: chain.length, spacing_ms: SPACING,
        naive_total_wait_if_unclamped_ms: SPACING * chain.length,
        pre_fix_reference_ms: 15583,
        legacy_claim_worst_ms: 48000,
        measured_total_wait_ms: measured,
        db_side_sampled_wait_ms: dbSample,
        clamped_to_le_10s: (dbSample?.max_db_elapsed_ms ?? measured) <= 10300,
        // ---------------- Zang 裁定 F-1b：断言只针对「等待有界」，不钉死某一个终局码
        terminal_code_legal_set: [...TERMINAL_CODE_LEGAL_SET],
        terminal_code_observed: attempt.error?.code ?? null,
        terminal_code_in_legal_set: attempt.ok_roundtrip
          ? null
          : (TERMINAL_CODE_LEGAL_SET as readonly string[]).includes(String(attempt.error?.code ?? '')),
        wait_bounded: (dbSample?.max_db_elapsed_ms ?? measured) <= 10300,
        client_overhead_ms: dbSample ? measured - dbSample.max_db_elapsed_ms : null,
        terminal_sqlstate: attempt.error?.code ?? null,
        terminal_message: attempt.error?.message ?? null,
        terminal_detail_raw: dR ?? null,
        terminal_detail_parsed: dP,
        function_result_if_ok: attempt.ok_roundtrip ? attempt.result : null,
        rows_written_0: (await countsForKey(guarded, key)).by_root_key === '0',
        setup_ms: allLockedAt - t0,
      };
    } finally {
      for (const hp of holders) await hp.end().catch(() => undefined);
    }
  }

  // ================================================================ §6 基础设施类 → 503
  {
    const states = ['53300', '53200', '53100', '57P01', '57P02', '57P03', '58030', '25006', '3D000',
      'XX000', 'XX001', '08P01', '57014', '40001', '40P01', '55P03', '23505', '23514', '28P01'];
    const dbSide = await raw(admin, `
      SELECT s::text AS sqlstate, ledger_error_for_sqlstate(s) AS json_noconstraint,
             ledger_error_for_sqlstate(s, NULL)::text AS raw
        FROM unnest($1::text[]) AS s ORDER BY 1`, [states]);
    const tsSide: Record<string, unknown> = {};
    for (const s of states) {
      const errObj = Object.assign(new Error(`synthetic ${s}`), { code: s, constraint: 'synthetic_constraint' });
      const norm = normalizeLedgerError(errObj);
      tsSide[s] = { ts_code: norm.code, ts_status: norm.status, ts_details: norm.details, ts_infra_reason: infraSqlstateReason(s) };
    }
    // 真实错误对象（来自 §3 的真 57014 / §1 的真 LD025）也要能被 TS 归类
    // DB 侧（含约束名）↔ TS 侧 同集同码对拍：§C bucket 纪律的可机读判据
    const pairCases: Array<[string, string | null]> = [
      ['23505', 'ledger_idem_uniq'], ['23505', 'other_unique'],
      ['23514', 'currency_supply_guard'], ['23514', 'account_bal_guard'],
      ['23514', 'account_frz_guard'], ['23514', 'ledger_after_guard'],
      ['23514', 'ledger_kind_enum'], ['23514', 'some_other_check'],
      ['23503', 'fk_account_cid'], ['53300', null], ['XX000', null], ['57014', null],
      ['55P03', null], ['08P01', null], ['40P01', null], ['25006', null],
    ];
    const pairing: Array<Record<string, unknown>> = [];
    for (const [st, cn] of pairCases) {
      const r = await raw<{ db: string }>(admin,
        `SELECT ledger_error_for_sqlstate($1::text, $2::text)::text AS db`, [st, cn]);
      const dbj = JSON.parse(r[0].db) as Record<string, unknown>;
      const tsErr = normalizeLedgerError(Object.assign(new Error('x'), { code: st, constraint: cn ?? undefined }));
      pairing.push({
        sqlstate: st, constraint: cn,
        db_code: dbj.code, db_bucket: dbj.bucket, db_reason: dbj.reason, db_retryable: dbj.retryable,
        ts_code: tsErr.code, ts_status: tsErr.status,
        code_match: dbj.code === tsErr.code,
        bucket_status_ok: (dbj.bucket === 'input' && tsErr.status === 400)
          || (dbj.bucket === 'integrity' && [400, 404, 409].includes(tsErr.status as number))
          || (dbj.bucket === 'retryable' && tsErr.status === 503)
          || (dbj.bucket === 'infra' && tsErr.status === 503)
          || (dbj.bucket === 'defect' && tsErr.status === 500),
      });
    }

    out.infra_503 = {
      db_classifier: dbSide,
      ts_normalize: tsSide,
      db_ts_pairing: pairing,
      pairing_verdicts: {
        all_codes_match: pairing.every((x) => x.code_match),
        all_bucket_status_ok: pairing.every((x) => x.bucket_status_ok),
        violations: pairing.filter((x) => !x.code_match || !x.bucket_status_ok),
      },
      // 端到端：把真实的 503 语义两条读数并排（DB 分类器 bucket=infra ⇒ TS code/status）
      db_53300: dbSide.find((r) => (r as Record<string, string>).sqlstate === '53300') ?? null,
      db_XX000: dbSide.find((r) => (r as Record<string, string>).sqlstate === 'XX000') ?? null,
      ts_53300_503: tsSide['53300'],
      ts_XX000_503: tsSide['XX000'],
      ts_08P01_500_not_infra: tsSide['08P01'],
      ts_57014_503: tsSide['57014'],
      // ★ S32b（台账 B15）：原为整条 `LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT`（含 message）—— 随 S31 的
      //   message 契约改造（中文句 ⇒ 稳定英文句）漂移。message 文本与「503 基础设施语义」无关 ⇒ 只钉稳定量
      //   `code` / `status`；message 出处 = `src/ledger-errors.ts#LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT.message`（S31 英文句）。
      ledger_tx_timeout_meta: { code: 'LEDGER_TX_TIMEOUT', status: LEDGER_ERROR_TABLE.LEDGER_TX_TIMEOUT.status },
      sqlstate_to_code: {
        LD025: LEDGER_SQLSTATE_TO_CODE.LD025, LD026: LEDGER_SQLSTATE_TO_CODE.LD026, LD027: LEDGER_SQLSTATE_TO_CODE.LD027,
      },
    };
  }

  // ================================================================ §7 未受影响面抽检
  {
    out.invariants_tail = {
      negatives: (await raw(admin, 'SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0'))[0],
      platform_cid1: await raw(admin, 'SELECT uid::text, balance::text, frozen::text FROM account WHERE cid = 1 ORDER BY uid'),
      ledger_entry_total: (await raw(admin, 'SELECT count(*)::text AS n FROM ledger_entry'))[0],
      wrong_root_rows: (await raw(admin, 'SELECT count(*)::text AS n FROM ledger_entry WHERE event_root_key IS NOT NULL AND event_root_key <> split_part(idempotency_key, $1, 1)', ['#']))[0],
    };
  }

  out.finished_at = new Date().toISOString();
  const dir = path.resolve(__dirname, '..', '.p1f-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  // P1n（Zang 裁定 F-1）：输出**必须 run-tagged** —— 固定路径会让「验证方的复跑」覆盖
  // 「实施方的原件」（曾致报告读数与盘上文件对不上）。无后缀旧件是历史证据，只读不删。
  const file = path.join(dir, `p1f03-f3-readings-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`WROTE ${file}`);
  console.log(JSON.stringify({
    run: RUN, symbol: SYM,
    locktimeout: out.locktimeout_55P03 ? (out.locktimeout_55P03 as Record<string, unknown>).final_sqlstate : null,
    deadlock_db: out.deadlock_40P01_db ? (out.deadlock_40P01_db as Record<string, unknown>).caller_final_sqlstate : null,
    deadlock_api: out.deadlock_40P01_public_api ? {
      ok: (out.deadlock_40P01_public_api as Record<string, unknown>).api_ok,
      ms: (out.deadlock_40P01_public_api as Record<string, unknown>).api_elapsed_ms,
      retried: (out.deadlock_40P01_public_api as Record<string, unknown>).retry_actually_reissued,
    } : null,
    budget: out.budget_exhausted_LD026 ? (out.budget_exhausted_LD026 as Record<string, unknown>).expired_deadline_check_budget : null,
    real57014: out.budget_exhausted_LD026
      ? ((out.budget_exhausted_LD026 as Record<string, unknown>).real_57014 as Record<string, unknown>)?.final_sqlstate : null,
    clamp: out.budget_clamp ? {
      tight: ((out.budget_clamp as Record<string, unknown>).tight_1s as Record<string, unknown>)?.lock_timeout,
      ample: ((out.budget_clamp as Record<string, unknown>).ample_60s as Record<string, unknown>)?.lock_timeout,
    } : null,
    chain: out.total_wait_chain ? {
      ms: (out.total_wait_chain as Record<string, unknown>).measured_total_wait_ms,
      db_ms: ((out.total_wait_chain as Record<string, unknown>).db_side_sampled_wait_ms as Record<string, unknown>)?.max_db_elapsed_ms ?? null,
      code: (out.total_wait_chain as Record<string, unknown>).terminal_sqlstate,
      code_in_legal_set: (out.total_wait_chain as Record<string, unknown>).terminal_code_in_legal_set,
      legal_set: (out.total_wait_chain as Record<string, unknown>).terminal_code_legal_set,
      wait_bounded: (out.total_wait_chain as Record<string, unknown>).wait_bounded,
      detail: (out.total_wait_chain as Record<string, unknown>).terminal_detail_parsed,
      clamped: (out.total_wait_chain as Record<string, unknown>).clamped_to_le_10s,
    } : null,
    escape57014: out.escape_isolation_57014 ? (out.escape_isolation_57014 as Record<string, unknown>).verdicts : null,
    pairing: out.infra_503 ? (out.infra_503 as Record<string, unknown>).pairing_verdicts : null,
  }, null, 1));
  await admin.end().catch(() => undefined);
  await guarded.end().catch(() => undefined);
};

process.on('unhandledRejection', (r) => { console.error('UNHANDLED_REJECTION(ignored):', String(r).slice(0, 200)); });

main()
  .then(async () => { await closeLedgerWritePool().catch(() => undefined); process.exit(0); })
  .catch(async (e) => {
    console.error('P1F-03 FAILED:', (e as Error)?.stack ?? e);
    fs.mkdirSync(path.resolve(__dirname, '..', '.p1f-artifacts'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '..', '.p1f-artifacts', 'p1f03-f3-readings.partial.json'),
      JSON.stringify({ ...out, fatal: String((e as Error)?.message ?? e) }, null, 1));
    await closeLedgerWritePool().catch(() => undefined);
    process.exit(1);
  });
