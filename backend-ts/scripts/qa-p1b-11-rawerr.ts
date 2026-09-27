/**
 * P1a 并发质检 · 11 原始错误归因（绕开账本层的错误码归一化）
 * ---------------------------------------------------------------------------
 * 目的：用例②/① 在 N=100 时大量失败被 ledger 层归一化为 §14 兜底码
 *       `LEDGER_TRANSACTION_REQUIRED`（details.cause='non_pg_error'），真实原因被吞。
 *       本探针用**同一个** withTransaction（db.ts，冻结的）在同等并发下跑最小事务，
 *       把**原始**错误 name/message/code 全量打出，判定根因在驱动/连接层还是在账本层逻辑。
 * 运行：cd backend-ts && QA_N=100 SEAFOOD_TX_POOL_MAX=8 \
 *         npx ts-node --transpile-only scripts/qa-p1b-11-rawerr.ts
 */
import { withTransaction, txQuery } from '../src/db';
import { j } from './qa-p1b-lib';

const N = Number(process.env.QA_N ?? 100);

(async () => {
  const t0 = Date.now();
  const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const t = Date.now();
    try {
      await withTransaction(async (tx) => txQuery(tx, 'SELECT 1 AS one'));
      return { i, ok: true, ms: Date.now() - t };
    } catch (e) {
      const a = e as { name?: string; code?: string; message?: string; pgCode?: string | null };
      return { i, ok: false, ms: Date.now() - t,
        name: a?.name, code: a?.code, message: String(a?.message ?? '').slice(0, 200) };
    }
  }));
  const wall = Date.now() - t0;

  const fails = results.filter((r) => !r.ok) as Array<Record<string, unknown>>;
  const sigs = new Map<string, { n: number; sample: Record<string, unknown> }>();
  for (const f of fails) {
    const k = j([f.name, f.code, f.message]);
    const cur = sigs.get(k);
    if (cur) cur.n += 1; else sigs.set(k, { n: 1, sample: f });
  }

  console.log(j({
    case: '11-rawerr',
    config: { N, pool: process.env.SEAFOOD_TX_POOL_MAX ?? '(default 4)' },
    wall_ms: wall,
    outcome: { ok: results.filter((r) => r.ok).length, fail: fails.length },
    distinct_raw_error_signatures: [...sigs.values()].sort((a, b) => b.n - a.n),
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
