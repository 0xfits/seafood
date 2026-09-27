/**
 * P1a 并发质检 · 10 并发失败真实归因探针
 * ---------------------------------------------------------------------------
 * 背景：用例② 在 N=100 / pool=8 时出现大量 `LEDGER_TRANSACTION_REQUIRED`（§14 兜底码）。
 *       本探针把每个失败的**原始**信息全部打出来（name/code/status/details/message/stack 头部），
 *       以判定真实原因是「与事务无关的业务错误」还是「被兜底吞掉的基建/连接层错误」。
 * 运行：cd backend-ts && QA_N=100 SEAFOOD_TX_POOL_MAX=8 \
 *         npx ts-node --transpile-only scripts/qa-p1b-10-errcause.ts
 */
import { readQuery } from '../src/db';
import { transfer } from '../src/ledger';
import { j } from './qa-p1b-lib';

const N = Number(process.env.QA_N ?? 100);
const POOL = process.env.SEAFOOD_TX_POOL_MAX ?? '(default 4)';
const TAG = process.env.QA_TAG ?? 'errcause';

(async () => {
  const cid = (await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', ['qa1bGLD']))[0].cid;

  const results = await Promise.all(Array.from({ length: N }, async (_, i) => {
    try {
      const r = await transfer({ fromUid: 910001n, toUid: 910006n, cid, amount: 1n,
        idempotencyKey: `ops:qa1b:c10:${TAG}:${i + 1}` });
      return { i, ok: true, replay: r.idempotent_replay };
    } catch (e) {
      const a = e as { name?: string; code?: string; status?: number | null; message?: string;
        details?: unknown; pgCode?: string | null; stack?: string };
      return { i, ok: false,
        name: a?.name, code: a?.code, status: a?.status,
        message: a?.message, details: a?.details, pgCode: a?.pgCode,
        stack_head: String(a?.stack ?? '').split('\n').slice(0, 3).join(' | ').slice(0, 300) };
    }
  }));

  const fails = results.filter((r) => !r.ok) as Array<Record<string, unknown>>;
  const sigs = new Map<string, { n: number; sample: Record<string, unknown> }>();
  for (const f of fails) {
    const k = j([f.code, f.details ?? null, f.pgCode ?? null, f.message]);
    const cur = sigs.get(k);
    if (cur) cur.n += 1; else sigs.set(k, { n: 1, sample: f });
  }

  console.log(j({
    case: '10-errcause',
    config: { N, pool: POOL, tag: TAG },
    summary: { ok: results.filter((r) => r.ok).length, fail: fails.length },
    distinct_failure_signatures: [...sigs.entries()].map(([k, v]) => ({ signature: k, count: v.n, sample: v.sample })),
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
