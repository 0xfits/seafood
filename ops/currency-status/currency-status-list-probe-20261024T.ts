/**
 * `listOpenCidsMarketOrderIds(cid)` 只读取证（**零写**）
 *   · 对「有活跃挂单的 base_cid」逐条对拍：SQL 返回的 order_id 集合 == 独立 SQL 的期望集合；
 *   · 对「无挂单 cid」⇒ 空数组；
 *   · 全程只 `SELECT`；不撤单、不改库、不 apply。
 * 用法：cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/currency-status/currency-status-list-probe-20261024T.ts
 */
import { mkPool, qRetry, save } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';

(async () => {
  const pool = mkPool(1);
  const tops = await qRetry<{ cid: string; n: string }>(pool,
    `SELECT base_cid::text AS cid, count(*)::text AS n
       FROM public.market_order
      WHERE status IN ('open','partial') AND amount > amount_filled
      GROUP BY base_cid ORDER BY count(*) DESC, base_cid ASC LIMIT 3`);
  const empty = (await qRetry<{ cid: string }>(pool,
    `SELECT c.cid::text AS cid FROM public.currency c
      WHERE NOT EXISTS (SELECT 1 FROM public.market_order o
                         WHERE o.base_cid = c.cid AND o.status IN ('open','partial') AND o.amount > o.amount_filled)
      ORDER BY c.cid DESC LIMIT 1`))[0];

  const got: Record<string, unknown> = {};
  let ok = true;
  for (const t of tops) {
    const cid = Number(t.cid);
    const ids = (await DatabaseService.listOpenCidsMarketOrderIds(cid)).map(String);
    const expect = (await qRetry<{ id: string }>(pool,
      `SELECT order_id::text AS id FROM public.market_order
        WHERE base_cid = $1::bigint AND status IN ('open','partial') AND amount > amount_filled
        ORDER BY order_id ASC`, [cid])).map((r) => r.id);
    const match = JSON.stringify(ids) === JSON.stringify(expect);
    ok = ok && match;
    got[`cid_${cid}`] = { expected_n: expect.length, got_n: ids.length, identical: match };
  }
  if (empty?.cid) {
    const ids = await DatabaseService.listOpenCidsMarketOrderIds(Number(empty.cid));
    ok = ok && ids.length === 0;
    got[`empty_cid_${empty.cid}`] = { got_n: ids.length, expected_n: 0, identical: ids.length === 0 };
  }
  await pool.end();
  const out = save('currency-status-list-probe', { ok, readings: got });
  console.log(JSON.stringify({ ok, readings: got, file: out }, null, 2));
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
