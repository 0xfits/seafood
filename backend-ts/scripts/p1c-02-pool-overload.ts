/**
 * P1c 第 1 件 · 可判负探针：连接池过载被归类到哪个错误码？
 *
 * 同一个探针在「改前 / 改后」各跑一次：
 *   改前预期：LEDGER_TRANSACTION_REQUIRED（500）+ details.cause='non_pg_error'
 *   改后预期：LEDGER_TX_TIMEOUT（503）+ details.reason='pool_connection_timeout'
 *
 * A 段（不写库）：直接走 `withTransaction`（db.ts，未改动）拿原始错误，
 *   再用 `normalizeLedgerError` 分类（与 ledger.ts:803 完全同一条路径）。
 * B 段（写库，仅测试 cid=4 / uid 910xxx，本单第 3 件会清理）：
 *   打 100 并发真实 `transfer`，把每个失败都按路由层方式分类。
 *
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1c-02-pool-overload.ts
 *   env: QA_N=100  SEAFOOD_TX_POOL_MAX=（默认 4，即 db.ts 默认/真实部署形态）
 */
import { withTransaction, closePools } from '../src/db';
import { transfer } from '../src/ledger';
import { normalizeLedgerError, isLedgerError } from '../src/ledger-errors';

const N = Number(process.env.QA_N || 100);
const POOL = process.env.SEAFOOD_TX_POOL_MAX || '(unset -> 默认 4)';

/** 把一个失败对象压成一行可判负的签名 */
const signature = (e: unknown): string => {
  if (isLedgerError(e)) {
    return JSON.stringify([e.code, e.status, e.details ?? {}]);
  }
  const norm = normalizeLedgerError(e);
  return JSON.stringify([norm.code, norm.status, norm.details ?? {}]);
};

const tally = (items: string[]): Array<{ count: number; signature: string }> => {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()].map(([signature, count]) => ({ count, signature })).sort((a, b) => b.count - a.count);
};

const rawShape = (e: unknown): Record<string, unknown> => ({
  name: (e as Error)?.name ?? null,
  message: String((e as Error)?.message ?? e).slice(0, 120),
  code: (e as { code?: unknown })?.code ?? null,
  has_code_field: Object.prototype.hasOwnProperty.call(Object(e), 'code'),
});

const partA = async () => {
  const started = Date.now();
  const outcomes = await Promise.all(
    Array.from({ length: N }, async (_v, i) => {
      try {
        await withTransaction(async (tx) => tx.query('SELECT 1 AS one'));
        return { ok: true as const, ms: 0, err: null as unknown };
      } catch (e) {
        return { ok: false as const, ms: Date.now() - started, err: e };
      }
    }),
  );
  const fails = outcomes.filter((o) => !o.ok);
  return {
    case: 'p1c-A-raw-pool-overload',
    config: { N, pool: POOL },
    wall_ms: Date.now() - started,
    ok: outcomes.filter((o) => o.ok).length,
    fail: fails.length,
    distinct_raw_error_shapes: tally(fails.map((f) => JSON.stringify(rawShape(f.err)))),
    classification_of_failures: tally(fails.map((f) => signature(f.err))),
    sample_classified: fails.length ? signature(fails[0].err) : null,
  };
};

const partB = async () => {
  const started = Date.now();
  const outcomes = await Promise.all(
    Array.from({ length: N }, async (_v, i) => {
      try {
        await transfer({
          fromUid: '910003',
          toUid: '910004',
          cid: 4,
          amount: 1,
          idempotencyKey: `ops:p1c:ovl:${i}`,
          memo: 'p1c pool overload probe',
        });
        return { ok: true as const, err: null as unknown };
      } catch (e) {
        return { ok: false as const, err: e };
      }
    }),
  );
  const fails = outcomes.filter((o) => !o.ok);
  return {
    case: 'p1c-B-ledger-op-pool-overload',
    config: { N, pool: POOL, op: 'transfer(cid=4, uid 910003 -> 910004, amount=1)' },
    wall_ms: Date.now() - started,
    ok: outcomes.filter((o) => o.ok).length,
    fail: fails.length,
    distinct_raw_error_shapes: tally(fails.map((f) => JSON.stringify(rawShape(f.err)))),
    classification_of_failures: tally(fails.map((f) => signature(f.err))),
  };
};

(async () => {
  console.log(JSON.stringify({ phase: 'A', ...(await partA()) }, null, 2));
  console.log(JSON.stringify({ phase: 'B', ...(await partB()) }, null, 2));
})()
  .catch((e) => {
    console.error('probe fatal:', String((e as Error)?.message || e).slice(0, 500));
    process.exitCode = 2;
  })
  .finally(async () => {
    await closePools();
  });
