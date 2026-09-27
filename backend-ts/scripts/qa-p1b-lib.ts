/**
 * P1a 并发质检 · 公共探针库（质检方 Neng 自写）
 * ---------------------------------------------------------------------------
 * 只提供：并发采样器（pg_stat_activity）、守恒/漂移读数、结果归约。
 * 不修改任何被验代码；不 import 实现方自测脚本。
 */
import { readQuery } from '../src/db';
import { findAccountDrift, sumAccountTotals } from '../src/ledger';

export const j = (v: unknown) => JSON.stringify(v);

export interface Sample {
  t: number;
  rows: Array<{ pid: number; state: string | null; wait_event_type: string | null; wait_event: string | null; query: string }>;
  error?: string;
}

/** 并发快照采样器：独立只读查询，不干扰被测事务 */
export const startSampler = (intervalMs = 100) => {
  const samples: Sample[] = [];
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      try {
        const rows = await readQuery<Sample['rows'][number]>(
          `SELECT pid, state, wait_event_type, wait_event, left(query, 60) AS query
             FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid() AND state IS NOT NULL
            ORDER BY pid`);
        samples.push({ t: Date.now(), rows });
      } catch (e) {
        samples.push({ t: Date.now(), rows: [], error: String((e as Error).message) });
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return {
    async stop() {
      stop = true;
      await loop;
      return samples;
    },
  };
};

/** 对采样结果做归约：最大同时活跃事务数、观察到的不同 pid、锁等待峰值、撞到账本语句的 pid */
export const summarizeSamples = (samples: Sample[]) => {
  const pids = new Set<number>();
  let maxActive = 0;
  let maxLockWaiters = 0;
  let maxLedgerActive = 0;
  let maxDistinctTx = 0;
  const ledgerPids = new Set<number>();
  let errors = 0;
  for (const s of samples) {
    if (s.error) { errors += 1; continue; }
    let active = 0; let lockWaiters = 0; let ledgerActive = 0;
    const txPids = new Set<number>();
    for (const r of s.rows) {
      pids.add(r.pid);
      const isActive = r.state === 'active';
      if (isActive) active += 1;
      if (r.wait_event_type === 'Lock') lockWaiters += 1;
      if (isActive && /ledger_entry|FOR UPDATE|account/i.test(r.query)) { ledgerActive += 1; ledgerPids.add(r.pid); }
      if (isActive || r.state === 'idle in transaction') txPids.add(r.pid);
    }
    maxActive = Math.max(maxActive, active);
    maxLockWaiters = Math.max(maxLockWaiters, lockWaiters);
    maxLedgerActive = Math.max(maxLedgerActive, ledgerActive);
    maxDistinctTx = Math.max(maxDistinctTx, txPids.size);
  }
  return {
    samples: samples.length,
    sampler_errors: errors,
    distinct_pids_observed: pids.size,
    max_simultaneous_active: maxActive,
    max_simultaneous_lock_waiters: maxLockWaiters,
    max_simultaneous_ledger_stmts: maxLedgerActive,
    max_simultaneous_tx: maxDistinctTx,
    ledger_statement_pids: ledgerPids.size,
  };
};

/** 我的独立守恒/漂移探针（不复用实现方的 findAccountDrift 作为唯一依据） */
export const qaDrift = async (cid?: string) => {
  const params = cid ? [cid] : [];
  const where = cid ? 'WHERE a.cid = $1' : '';
  return readQuery<Record<string, string>>(
    `SELECT * FROM (
        SELECT a.uid, a.cid, a.balance AS qa_balance, a.frozen AS qa_frozen,
               COALESCE(s.d, 0) AS qa_sum_delta, COALESCE(s.f, 0) AS qa_sum_frozen_delta
          FROM account a
          LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f
                       FROM ledger_entry GROUP BY uid, cid) s
                 ON s.uid = a.uid AND s.cid = a.cid
          ${where}
     ) t
     WHERE t.qa_balance <> t.qa_sum_delta OR t.qa_frozen <> t.qa_sum_frozen_delta
     ORDER BY t.uid, t.cid`, params);
};

/** 全局按 cid 守恒：Σ(balance+frozen) 与 Σ(delta+frozen_delta) 必须一致（mint/burn 除外按净增发说明） */
export const qaGlobalLedgerSum = async () =>
  readQuery<Record<string, string>>(
    `SELECT a.cid,
            SUM(a.balance + a.frozen) AS acct_net,
            COALESCE((SELECT SUM(l.delta + l.frozen_delta) FROM ledger_entry l WHERE l.cid = a.cid), 0) AS entry_net
       FROM account a GROUP BY a.cid ORDER BY a.cid`);

export const qaMinBalance = async () =>
  readQuery<Record<string, string>>(
    'SELECT min(balance) AS min_balance, min(frozen) AS min_frozen FROM account');

/** 一次完整读数（调用方拼装报告用） */
export const readings = async (cid?: string) => ({
  sum_account_totals: await sumAccountTotals(),
  impl_drift_global: (await findAccountDrift()).length,
  qa_drift: (await qaDrift()).length,
  qa_drift_cid: cid ? (await qaDrift(cid)).length : null,
  qa_global_ledger_sum: await qaGlobalLedgerSum(),
  qa_min: await qaMinBalance(),
});

export const errorCodeOf = (e: unknown): string => {
  const anyE = e as { code?: unknown; name?: unknown; message?: unknown };
  if (typeof anyE?.code === 'string' && anyE.code) return anyE.code;
  return `${String(anyE?.name ?? 'Error')}:${String(anyE?.message ?? '').slice(0, 60)}`;
};

export const tally = (arr: string[]) => arr.reduce<Record<string, number>>((m, k) => {
  m[k] = (m[k] ?? 0) + 1; return m;
}, {});
