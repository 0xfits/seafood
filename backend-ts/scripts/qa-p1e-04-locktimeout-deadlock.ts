/**
 * QA-P1E-04 · 真实锁超时 / 死锁 + 重试不双铸（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-04-locktimeout-deadlock.ts
 *
 * 覆盖实现方**自己列为未验证**的超时路径（LD025 / LD027 真读数），并回答：
 *   ① 锁超时 / 死锁之后，同键重试**会不会双扣**？
 *   ② 公开 API（transfer）在真实死锁下看到什么码 / status？**有没有真的重试过？**
 *
 * ⚠️ 方法学教训（已内建修正）：`@neondatabase/serverless` 每次新建 Pool 到 Neon 的
 *    首查询要付 WS 握手成本（~0.5–1s）。上一版以「固定 sleep 600ms」构造死锁 ⇒ 函数
 *    还没开始执行伙伴就抢完了 ⇒ **假阴性（deadlock_delta=0）**。本版改为：
 *    先预热连接，再**轮询 pg_stat_activity 直到函数的语句真的处于 Lock 等待**，才触发环。
 * 纪律：uid 933xxx；symbol 前缀 qae；键前缀 ops:qae:*。
 */
import { closePools, readQuery } from '../src/db';
import { closeLedgerWritePool, transfer } from '../src/ledger';
import { attempt, deadlocks, ensureCurrency, entriesFor, mkPool, pgInfo, raw } from './qa-p1e-lib';
import { Pool } from '@neondatabase/serverless';

const RUN = Date.now().toString(36).slice(-5);
const SYM = `qaeL${RUN}`;
const SRC = 933001n;
const DST = 933002n;

const sleep = (m: number) => new Promise((r) => setTimeout(r, m));
const lockRow = (p: Pool, uid: bigint, cid: string) =>
  p.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [String(uid), cid]);
const bal = async (p: Pool, uid: bigint, cid: string) =>
  (await raw(p, 'SELECT balance, frozen, version FROM account WHERE uid = $1 AND cid = $2', [String(uid), cid]))[0] ?? null;

/** 轮询直到「有 ledger_post_event 语句正卡在 Lock 等待」，返回等待者 backend pid */
const waitForLockWait = async (admin: Pool, budgetMs = 8000): Promise<Record<string, string> | null> => {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const rows = await raw(admin, `
      SELECT pid::text AS pid, wait_event_type, left(query, 60) AS q, state
        FROM pg_stat_activity
       WHERE query ILIKE '%ledger_post_event%' AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock' LIMIT 1`);
    if (rows.length) return rows[0];
    await sleep(120);
  }
  return null;
};

(async () => {
  const out: Record<string, unknown> = { run: RUN, symbol: SYM };
  const admin = mkPool(4);
  const cid = await ensureCurrency(admin, SYM, SRC, 0, 'listed', null);
  out.cid = cid;
  await attempt(admin, { op: 'mint', uid: String(SRC), cid, amount_units: '10000', idempotency_key: `ops:qae:${RUN}:lock:seed` });
  out.after_seed = await bal(admin, SRC, cid);

  // ======================================================= ① 真实 55P03 ⇒ LD025
  {
    const hp = mkPool(1); const fn = mkPool(1);
    await hp.query('SELECT 1'); await fn.query('SELECT 1');   // 握手预热（关键：消除 WS 首查询延迟）
    const key = `ops:qae:${RUN}:lock:timeout`;
    const before = { src: await bal(admin, SRC, cid), dst: await bal(admin, DST, cid) };
    await hp.query('BEGIN');
    await lockRow(hp, SRC, cid);
    const t0 = Date.now();
    const r = await attempt(fn, {
      op: 'transfer', from_uid: String(SRC), to_uid: String(DST), cid, amount_units: '5',
      idempotency_key: key, memo: 'qae lock timeout',
    });
    const dt = Date.now() - t0;
    await hp.query('COMMIT').catch(() => undefined);
    const rowsDuring = await entriesFor(admin, key);
    const after = { src: await bal(admin, SRC, cid), dst: await bal(admin, DST, cid) };
    const t1 = Date.now();
    const r2 = await attempt(fn, {
      op: 'transfer', from_uid: String(SRC), to_uid: String(DST), cid, amount_units: '5',
      idempotency_key: key, memo: 'qae lock timeout',
    });
    const dt2 = Date.now() - t1;
    const after2 = { src: await bal(admin, SRC, cid), dst: await bal(admin, DST, cid) };
    const rowsAfter = await entriesFor(admin, key);
    const r3 = await attempt(fn, {
      op: 'transfer', from_uid: String(SRC), to_uid: String(DST), cid, amount_units: '5',
      idempotency_key: key, memo: 'qae lock timeout',
    });
    const rowsThird = await entriesFor(admin, key);
    out.lock_timeout = {
      key, db_sqlstate: r.error?.code ?? null, db_message: r.error?.message ?? null,
      db_detail: r.error?.detail ?? null, elapsed_ms: dt,
      rows_written_by_timed_out_attempt: rowsDuring.length,
      balances_unchanged_by_timeout: JSON.stringify(before) === JSON.stringify(after),
      balances_before: before, balances_after_timeout: after,
      retry_same_key: { ok: r2.ok, replay: r2.replay, txid: r2.txid, elapsed_ms: dt2, error: r2.error ?? null },
      balances_after_retry: after2,
      rows_after_retry: rowsAfter.length, rows_after_retry_detail: rowsAfter,
      third_call: { ok: r3.ok, replay: r3.replay, txid: r3.txid },
      rows_after_third: rowsThird.length,
      exactly_two_rows_per_event: rowsAfter.length === 2 && rowsThird.length === 2,
      debit_applied_once: BigInt(before.src.balance) - BigInt(after2.src.balance) === 5n,
    };
    await hp.end().catch(() => undefined); await fn.end().catch(() => undefined);
  }

  // ======================================================= ② 真实 40P01 ⇒ LD027（3 轮）
  const rounds: Array<Record<string, unknown>> = [];
  {
    const hp = mkPool(1); const fn = mkPool(1);
    await hp.query('SELECT 1'); await fn.query('SELECT 1');
    for (let i = 1; i <= 3; i += 1) {
      const key = `ops:qae:${RUN}:lock:deadlock:${i}`;
      const dBefore = await deadlocks(admin);
      const srcBefore = await bal(admin, SRC, cid);
      const dstBefore = await bal(admin, DST, cid);

      await hp.query('BEGIN');
      await lockRow(hp, DST, cid);                 // 伙伴先持 DST
      const pFn = attempt(fn, {                     // 函数：持 SRC → 等 DST
        op: 'transfer', from_uid: String(SRC), to_uid: String(DST), cid, amount_units: '1',
        idempotency_key: key, memo: 'qae deadlock',
      });
      const waitEvidence = await waitForLockWait(admin);   // ← 确认函数真的卡在锁等待
      let partnerErr: ReturnType<typeof pgInfo> | null = null;
      const tCycle = Date.now();
      try { await lockRow(hp, SRC, cid); } catch (e) { partnerErr = pgInfo(e); }
      const cycleMs = Date.now() - tCycle;
      await hp.query('COMMIT').catch(() => undefined);
      const r = await pFn;
      const dAfter = await deadlocks(admin);

      rounds.push({
        round: i, key,
        fn_lock_wait_evidence: waitEvidence,
        cycle_wait_ms: cycleMs,
        deadlocks_before: dBefore, deadlocks_after: dAfter, deadlock_delta: Number(dAfter) - Number(dBefore),
        partner_error: partnerErr ? { code: partnerErr.code, message: partnerErr.message } : null,
        fn_error: r.error ? { code: r.error.code, message: r.error.message, detail: r.error.detail } : null,
        fn_ok: r.ok, fn_replay: r.replay,
        victim: partnerErr?.code === '40P01' ? 'partner(探针侧牺牲)' : (r.error?.code === 'LD027' ? 'function(LD027)' : (r.error ? `other:${r.error.code}` : 'none')),
        rows_written: (await entriesFor(admin, key)).length,
        balances_before: { src: srcBefore, dst: dstBefore },
        balances_after: { src: await bal(admin, SRC, cid), dst: await bal(admin, DST, cid) },
      });
      await sleep(300);
    }
    await hp.end().catch(() => undefined); await fn.end().catch(() => undefined);
  }
  out.deadlock_rounds = rounds;

  // ③ 被判死的同键重试 ⇒ 必须且只生效一次
  {
    const fn = mkPool(2);
    await fn.query('SELECT 1');
    const key = `ops:qae:${RUN}:lock:deadlock:1`;
    const before = await bal(admin, SRC, cid);
    const r = await attempt(fn, {
      op: 'transfer', from_uid: String(SRC), to_uid: String(DST), cid, amount_units: '1',
      idempotency_key: key, memo: 'qae deadlock',
    });
    const rows = await entriesFor(admin, key);
    const after = await bal(admin, SRC, cid);
    out.deadlock_retry = {
      key, ok: r.ok, replay: r.replay, txid: r.txid, error: r.error ?? null,
      rows_for_key: rows.length, rows,
      src_before: before.balance, src_after: after.balance,
      debit_exactly_once: BigInt(before.balance) - BigInt(after.balance) === 1n,
      note: '若该键在死锁轮已被牺牲，则此处应为 replay=true 且流水仍 2 条（不重复扣）',
    };
    await fn.end().catch(() => undefined);
  }

  // ④ 公开 API 在真实死锁下看到什么？有没有真的重试？
  {
    const hp = mkPool(1);
    await hp.query('SELECT 1');
    await readQuery('SELECT 1');               // 预热 db.ts 读池（pool 驱动）
    const keyApi = `ops:qae:${RUN}:lock:deadlock:api`;
    await hp.query('BEGIN');
    await lockRow(hp, DST, cid);
    const pApi = transfer({ fromUid: SRC, toUid: DST, cid, amount: 1n, idempotencyKey: keyApi, memo: 'qae deadlock api' })
      .then((r) => ({ ok: true as const, r })).catch((e) => ({ ok: false as const, e }));
    const waitEvidence = await waitForLockWait(admin, 10_000);
    let partnerErr: ReturnType<typeof pgInfo> | null = null;
    try { await lockRow(hp, SRC, cid); } catch (e) { partnerErr = pgInfo(e); }
    await hp.query('COMMIT').catch(() => undefined);
    const apiRes = await pApi;
    out.api_under_deadlock = {
      fn_lock_wait_evidence: waitEvidence,
      partner_error: partnerErr ? { code: partnerErr.code, message: partnerErr.message } : null,
      api_result: apiRes.ok
        ? { ok: true, txid: apiRes.r.txid, replay: apiRes.r.idempotent_replay }
        : {
          ok: false,
          ts_code: (apiRes.e as Record<string, unknown>)?.code ?? null,
          ts_status: (apiRes.e as Record<string, unknown>)?.status ?? null,
          ts_message: (apiRes.e as Record<string, unknown>)?.message ?? null,
          ts_details: (apiRes.e as Record<string, unknown>)?.details ?? null,
          raw_pg_code: (apiRes.e as Record<string, unknown>)?.pgCode ?? (apiRes.e as Record<string, unknown>)?.code ?? null,
        },
    };
    out.api_retry_note = {
      ts_RETRYABLE_SQLSTATES: ['40001', '40P01'],
      finding: '函数在内部把 deadlock_detected/serialization_failure 吞成 LD027 ⇒ TS 的可重试分支（只认 40001/40P01）在 DB 函数形态下**不可能触发**；而码名却是「RETRY_EXHAUSTED」',
    };
    await hp.end().catch(() => undefined);
  }

  out.deadlocks_cumulative = await deadlocks(admin);
  out.section11 = await raw(admin, `
    WITH ev AS (SELECT ref_type, ref_id, SUM(delta+frozen_delta) AS net FROM ledger_entry
                 WHERE ref_type IS NOT NULL GROUP BY 1,2)
    SELECT count(*)::text AS j8_ref_rows_no_exemption FROM ev WHERE net <> 0`);
  out.negatives = (await raw(admin, `SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0`))[0].n;
  out.cid_net = await raw(admin, `SELECT SUM(delta + frozen_delta)::text AS net FROM ledger_entry WHERE cid = $1`, [cid]);

  console.log(JSON.stringify(out, null, 1));
  await admin.end().catch(() => undefined);
  await closeLedgerWritePool().catch(() => undefined);
  await closePools().catch(() => undefined);
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closeLedgerWritePool().catch(() => undefined);
  process.exit(1);
});
