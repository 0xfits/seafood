/**
 * P6-VERCEL-SHAPE 探针（**只读**）：账本行数快照，用于证明 `Δledger_entry`。
 * ----------------------------------------------------------------------------
 * 用法： `npx ts-node scripts/p4z-p6vs-ledger-count.ts <label>`
 * 输出： 单行 JSON（stdout）⇒ 由调用方 tee 进 `.p4-artifacts/<run>/`。
 *
 * 口径（与 `src/db.ts` 一致）：
 *   · 只读单语句 ⇒ 走 pooler 串（`DATABASE_URL` || `POSTGRES_URL`，R56 的读口径）；
 *   · **只执行 SELECT count(\*)**：无写库、无 DDL、无事务、无 advisory lock；
 *   · 连接串/token **绝不**打印（本脚本只输出计数）。
 * 探针自曝：本脚本经 `../src/env` 取串 —— 即被测的同一入口；
 *   若 env 面出问题，本探针会以 `NO_URL` / `PROBE_FAIL` 显式失败（不静默返回 0）。
 */
import '../src/env';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) {
  console.error('NO_URL: neither DATABASE_URL nor POSTGRES_URL resolved');
  process.exit(2);
}

const countOf = async (pool: Pool, table: string): Promise<string> => {
  try {
    const r = await pool.query(`select count(*)::text as n from ${table}`);
    return String(r.rows[0].n);
  } catch (error) {
    return `ERR:${(error as Error).message.slice(0, 80)}`;
  }
};

(async () => {
  const pool = new Pool({ connectionString: url });
  try {
    const ledgerEntry = await countOf(pool, 'ledger_entry');
    const ledgerTx = await countOf(pool, 'ledger_tx');
    console.log(JSON.stringify({
      label: process.argv[2] ?? 'na',
      ledger_entry: ledgerEntry,
      ledger_tx: ledgerTx,
      read_url_source: process.env.DATABASE_URL ? 'DATABASE_URL' : 'POSTGRES_URL',
      at: new Date().toISOString(),
    }));
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error('PROBE_FAIL:', (error as Error)?.message ?? error);
  process.exit(1);
});
