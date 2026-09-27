/**
 * QA-P1E-01 · 单语句形态下的并发上限重测（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-01-concurrency.ts
 *
 * 与被测形态的关系：D10 变体 B 把「一笔 transfer」压成**一条** SELECT ⇒
 * 行锁持有时间 = 单语句执行时间，而不再是「语句数 × RTT」。P1b（旧形态）测得
 * 「同一行有效并发 ≈ 2」（lock_timeout=3s vs 单笔 4.2s）。**本探针重测该结论。**
 *
 * 用例：
 *   A 同键 N=8 / N=16 并发（预期：只落 1 个业务事件 = 2 条流水，与 P1b 同形）
 *   B 不同键、**同一行**（931001/cid）并发上限扫描 N = 2/4/8/16/32/64
 *   C 并发真实性取证（pg_stat_activity 同时活跃/锁等待/不同 backend pid）
 *   D 并发后不变式：Σdelta 守恒、min(balance)>=0、§11 判据 1/8、不超 supply_cap
 *
 * 纪律：uid 931xxx；symbol 前缀 qae；键前缀 ops:qae:*；不碰 cid=1 与平台账户。
 *       所有池 max 显式 = N（否则读数测的是池排队，不是 DB 并发）。
 */
import {
  accountsOf, attempt, ensureCurrency, entryCount, judgementRows, median, mkPool,
  raw, sampleActivity,
} from './qa-p1e-lib';
import { Pool } from '@neondatabase/serverless';

const RUN = Date.now().toString(36).slice(-5);
const SYM = `qaeC${RUN}`;
const SRC = 931001n;
const DST = 931002n;
const DST2 = 931003n;

const out: Record<string, unknown> = { run: RUN, symbol: SYM };

interface Req { i: number; key: string; t0: number; t1: number; ok: boolean; replay?: boolean; err?: string; msg?: string }

const runBatch = async (pool: Pool, keys: string[], toUid: bigint, cid: string, amount: string) => {
  const t0 = Date.now();
  const reqs: Req[] = await Promise.all(keys.map(async (key, i): Promise<Req> => {
    const s = Date.now();
    const r = await attempt(pool, {
      op: 'transfer', from_uid: String(SRC), to_uid: String(toUid), cid,
      amount_units: amount, idempotency_key: key, memo: `qae p1e conc ${RUN}`,
      ref_type: 'system', ref_id: '1',
    });
    return {
      i, key, t0: s, t1: Date.now(), ok: r.ok, replay: r.replay,
      err: r.error?.code ?? undefined, msg: r.error?.message?.slice(0, 60),
    };
  }));
  const wall = Date.now() - t0;
  const codes: Record<string, number> = {};
  for (const r of reqs) if (!r.ok) codes[`${r.err}|${r.msg}`] = (codes[`${r.err}|${r.msg}`] ?? 0) + 1;
  // 自测「真同时在飞」的峰值（请求发起时刻含排队，故仅作参考；结论用 pg_stat_activity）
  const marks: Array<[number, number, number]> = [];
  for (const r of reqs) { marks.push([r.t0 - t0, 1, 0]); marks.push([r.t1 - t0, -1, 0]); }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0; let peak = 0;
  for (const m of marks) { cur += m[1]; peak = Math.max(peak, cur); }
  return {
    n: keys.length, wall_ms: wall, success: reqs.filter((r) => r.ok).length,
    replay_true: reqs.filter((r) => r.ok && r.replay).length,
    replay_false: reqs.filter((r) => r.ok && !r.replay).length,
    failure: reqs.filter((r) => !r.ok).length,
    failure_codes: codes,
    latency_ms: {
      min: Math.min(...reqs.map((r) => r.t1 - r.t0)),
      p50: median(reqs.map((r) => r.t1 - r.t0)),
      max: Math.max(...reqs.map((r) => r.t1 - r.t0)),
    },
    client_peak_inflight: peak,
    distinct_txids: undefined as unknown,
    reqs: reqs.map((r) => ({ i: r.i, ok: r.ok, replay: r.replay, ms: r.t1 - r.t0, err: r.err })),
  };
};

/** 并发期间在**独立连接**上采样 DB 现场（不占被测池） */
const withSampler = async <T>(samplerPool: Pool, fn: () => Promise<T>): Promise<{ result: T; samples: Array<Record<string, string>> }> => {
  const samples: Array<Record<string, string>> = [];
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      try { const s = await sampleActivity(samplerPool); if (s.length) samples.push(s[0]); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 120));
    }
  })();
  const result = await fn();
  stop = true;
  await loop.catch(() => undefined);
  return { result, samples };
};

(async () => {
  const admin = mkPool(4);
  const sampler = mkPool(1);
  const cid = await ensureCurrency(admin, SYM, SRC, 0, 'listed', null);
  out.cid = cid;
  await attempt(admin, { op: 'mint', uid: String(SRC), cid, amount_units: '1000000', idempotency_key: `ops:qae:${RUN}:seed` });
  out.after_seed = (await accountsOf(admin, [[SRC, cid]]))[0];

  // ============================================================ A. 同键并发
  const idem: Array<Record<string, unknown>> = [];
  for (const N of [8, 16]) {
    const key = `ops:qae:${RUN}:idem:${N}`;
    const pool = mkPool(N);
    const { result, samples } = await withSampler(sampler, () => runBatch(
      pool, Array.from({ length: N }, () => key), DST, cid, '1'));
    await pool.end().catch(() => undefined);
    const rows = await raw(admin, `
      SELECT txid, uid, delta, idempotency_key FROM ledger_entry
       WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#' ORDER BY txid`, [key]);
    const txids = new Set(result.reqs.filter((r) => r.ok).map((r) => r.i));
    idem.push({
      key, ...result, distinct_txids: txids.size,
      ledger_rows_for_key: rows.length, ledger_rows: rows,
      samples_summary: {
        n: samples.length,
        max_distinct_pids: Math.max(0, ...samples.map((s) => Number(s.distinct_pids))),
        max_active: Math.max(0, ...samples.map((s) => Number(s.active))),
        max_lock_waiters: Math.max(0, ...samples.map((s) => Number(s.lock_waiters))),
      },
    });
  }
  out.A_same_key = idem;
  out.A_verdict = idem.map((x) => ({
    key: x.key, rows: x.ledger_rows_for_key, success: x.success, replay_true: x.replay_true,
    failure: x.failure, exactly_one_event: (x.ledger_rows_for_key as number) === 2,
  }));

  // ============================================================ B. 不同键、同一行
  const sweep: Array<Record<string, unknown>> = [];
  for (const N of [1, 2, 4, 8, 16, 32, 64]) {
    const keys = Array.from({ length: N }, (_, i) => `ops:qae:${RUN}:sweep:${N}:${i}`);
    const pool = mkPool(Math.max(N, 2));
    const to = N % 2 ? DST : DST2;
    const { result, samples } = await withSampler(sampler, () => runBatch(pool, keys, to, cid, '1'));
    await pool.end().catch(() => undefined);
    // 每个成功请求 = 1 条业务事件 = 2 条流水
    const fam = await raw(admin, `
      SELECT count(*)::text AS rows_, count(DISTINCT split_part(idempotency_key,'#',1))::text AS events
        FROM ledger_entry WHERE split_part(idempotency_key,'#',1) = ANY($1::text[])`,
    [keys]);
    sweep.push({
      N, ...result, ledger_rows_for_run: fam[0].rows_, events: fam[0].events,
      samples_summary: {
        n: samples.length,
        max_distinct_pids: Math.max(0, ...samples.map((s) => Number(s.distinct_pids))),
        max_active: Math.max(0, ...samples.map((s) => Number(s.active))),
        max_lock_waiters: Math.max(0, ...samples.map((s) => Number(s.lock_waiters))),
      },
    });
  }
  out.B_sweep = sweep;
  out.B_verdict = sweep.map((x) => ({
    N: x.N, success: x.success, failure: x.failure, wall_ms: x.wall_ms,
    p50_ms: (x.latency_ms as Record<string, number>).p50,
    lock_waiters_max: (x.samples_summary as Record<string, number>).max_lock_waiters,
    failure_codes: x.failure_codes,
  }));

  // ============================================================ D. 不变式
  const before = await accountsOf(admin, [[SRC, cid], [DST, cid], [DST2, cid]]);
  out.accounts = before;
  const j = await judgementRows(admin);
  const sums = await raw(admin, `
    SELECT uid, cid, SUM(delta)::text AS sum_delta, SUM(frozen_delta)::text AS sum_frozen
      FROM ledger_entry WHERE cid = $1 GROUP BY uid, cid ORDER BY uid`, [cid]);
  out.run_sums = sums;
  out.section11 = {
    j1_rows: j.j1_drift.length, j8_ref_rows: j.j8_ref.length, j8_key_rows: j.j8_key.length,
    negatives: j.negatives[0].n, supply_over: j.supply_over.length, platform: j.platform,
  };
  out.totals = await raw(admin, `
    SELECT SUM(delta + frozen_delta)::text AS net_all FROM ledger_entry WHERE cid = $1`, [cid]);
  out.entry_count = await entryCount(admin);
  out.successes_total = sweep.reduce((a, x) => a + (x.success as number), 0);

  console.log(JSON.stringify(out, null, 1));
  await admin.end().catch(() => undefined);
  await sampler.end().catch(() => undefined);
})().catch(async (e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
