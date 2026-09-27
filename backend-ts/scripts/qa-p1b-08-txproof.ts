/**
 * P1a 并发质检 · 用例⑦ 并发真实性论证（真的跑在独立事务上，不是同一连接串行）
 * ---------------------------------------------------------------------------
 * 论证方式（可判负）：
 *   A. N 笔并发 withTransaction，每笔在**事务内**自报 (pg_backend_pid, txid_current, 起止时刻)
 *      ⇒ 计算「时间区间重叠数」；重叠 >= 2 才叫真并发。
 *   B. 对照组（负例）：SEAFOOD_TX_POOL_MAX=1 重跑 ⇒ 池只有 1 条连接，重叠必须恒为 1
 *      （证明本指标能区分「真并发」与「同一连接串行」）。
 *   C. 采样 pg_stat_activity 观察同一瞬间「处于事务中的后端数」与锁等待数。
 * 运行：cd backend-ts && QA_N=40 SEAFOOD_TX_POOL_MAX=16 \
 *         npx ts-node --transpile-only scripts/qa-p1b-08-txproof.ts
 *       cd backend-ts && QA_N=40 SEAFOOD_TX_POOL_MAX=1  \
 *         npx ts-node --transpile-only scripts/qa-p1b-08-txproof.ts   # 负例
 */
import { withTransaction, txQuery } from '../src/db';
import { j, startSampler, summarizeSamples } from './qa-p1b-lib';

const N = Number(process.env.QA_N ?? 40);
const HOLD_MS = Number(process.env.QA_HOLD_MS ?? 800);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row { i: number; pid: number; xid: string; start_ms: number; end_ms: number; wait_ms: number }

(async () => {
  const sampler = startSampler(120);
  const t0 = Date.now();
  const rows = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const started = Date.now() - t0;
    try {
      return await withTransaction(async (tx) => {
        const r = await txQuery<{ pid: number; xid: string }>(tx,
          'SELECT pg_backend_pid() AS pid, txid_current()::text AS xid');
        await sleep(HOLD_MS);
        return { i, pid: Number(r[0].pid), xid: String(r[0].xid),
          start_ms: started, end_ms: Date.now() - t0, wait_ms: 0 } as Row;
      });
    } catch (e) {
      return { i, pid: -1, xid: `ERR:${String((e as { message?: string }).message).slice(0, 60)}`,
        start_ms: started, end_ms: Date.now() - t0, wait_ms: 0 } as Row;
    }
  }));
  const wall_ms = Date.now() - t0;
  const samples = await sampler.stop();

  // 最大区间重叠数（扫描线）
  const events: Array<[number, number]> = [];
  for (const r of rows) { events.push([r.start_ms, 1]); events.push([r.end_ms, -1]); }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0; let maxOverlap = 0;
  for (const [, d] of events) { cur += d; maxOverlap = Math.max(maxOverlap, cur); }

  const pids = new Set(rows.map((r) => r.pid).filter((p) => p > 0));
  const xids = new Set(rows.map((r) => r.xid).filter((x) => /^\d+$/.test(x)));
  const errors = rows.filter((r) => r.pid === -1);

  console.log(j({
    case: '7-txproof',
    config: { N, hold_ms: HOLD_MS, pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? '(default 4)' },
    wall_ms,
    metrics: {
      requests: N,
      succeeded_tx: rows.length - errors.length,
      failed: errors.length,
      failure_samples: errors.slice(0, 3).map((r) => r.xid),
      distinct_backend_pids: pids.size,
      distinct_txids: xids.size,
      max_simultaneous_overlapping_tx: maxOverlap,
      span_ms: Math.max(...rows.map((r) => r.end_ms)) - Math.min(...rows.map((r) => r.start_ms)),
    },
    sample_intervals: rows.slice(0, 8).map((r) => ({ i: r.i, pid: r.pid, xid: r.xid, start_ms: r.start_ms, end_ms: r.end_ms })),
    concurrency_evidence: summarizeSamples(samples),
    verdict: {
      is_genuinely_concurrent: maxOverlap >= 2 && pids.size >= 2 && xids.size >= 2,
      pool_of_one_would_be_serial: maxOverlap === 1,
    },
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
