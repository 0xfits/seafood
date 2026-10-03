/**
 * P9④ · BTTC CTE 语法自证（Kong · 探针不落 scripts/ 扫面根 · 库面只读 + 末尾 ROLLBACK）
 * ---------------------------------------------------------------------------
 * 在**单事务内**（BEGIN … ROLLBACK）执行 getBttcState / bttcMint / bttcBurn 的**实际 SQL**
 * （uid = 不存在的假 uid ⇒ 闸恒 false ⇒ **零副作用**；本探针只判 **PostgreSQL 可否解析整条语句**）。
 * 不触 `ensureBttcCurrency`（引用 `is_platform_coin`，`0033` 未 apply ⇒ 期望 `42703`，另行如实登记）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s4-probe/bttc-cte-syntax.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseService } = require(path.resolve(__dirname, '..', 'src', 'database.ts'));

const txUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

(async () => {
  if (!txUrl) throw new Error('missing DATABASE_URL');
  const pool = new Pool({ connectionString: txUrl, max: 1 });
  const client = await pool.connect();
  const runner = { query: (text: string, params?: unknown[]) => client.query(text, params) };
  const results: Record<string, unknown> = {};
  try {
    await client.query('BEGIN');
    const before = (await client.query(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0].n;
    const beforeBatt = (await client.query(`SELECT count(*)::int AS n FROM public.batt_entry`)).rows[0].n;

    try {
      const s = await DatabaseService.getBttcState(999999999, runner);
      results.getBttcState = { ok: true, symbol: s.symbol, status: s.status, canMint: s.canMint, canBurn: s.canBurn,
        policy: s.policy, source: s.source, balance: s.balance, usdBalance: s.usdBalance, batt: s.batt };
    } catch (e) { results.getBttcState = { ok: false, err: String((e as Error).message).slice(0, 300) }; }

    const key = `cli:00000000-0000-4000-8000-000000000000`;
    try {
      const m = await DatabaseService.bttcMint({ uid: 999999999, idempotencyKey: key, requestFingerprint: 'probe', memo: '' }, runner);
      results.bttcMint = { ok: true, outcome: m && m.outcome, batt: m && m.batt, txid: m && m.txid };
    } catch (e) { results.bttcMint = { ok: false, err: String((e as Error).message).slice(0, 300) }; }

    try {
      const b = await DatabaseService.bttcBurn({ uid: 999999999, idempotencyKey: key + ':x', requestFingerprint: 'probe', memo: '' }, runner);
      results.bttcBurn = { ok: true, outcome: b && b.outcome, batt: b && b.batt, txid: b && b.txid };
    } catch (e) { results.bttcBurn = { ok: false, err: String((e as Error).message).slice(0, 300) }; }

    try {
      // `0033` 未 apply ⇒ 引用 `is_platform_coin` 预期 42703；用 SAVEPOINT 隔离，
      // 避免预期报错中止整事务（否则本探针的 residual 零副作用读数不可得）。
      await client.query('SAVEPOINT sp_ensure');
      try {
        await DatabaseService.ensureBttcCurrency(runner);
        results.ensureBttc = { ok: true, note: '意外成功（0033 未 apply？）' };
      } finally {
        await client.query('ROLLBACK TO SAVEPOINT sp_ensure');
      }
    } catch (e) { results.ensureBttc = { ok: false, err: String((e as Error).message).slice(0, 200) }; }

    const after = (await client.query(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0].n;
    const afterBatt = (await client.query(`SELECT count(*)::int AS n FROM public.batt_entry`)).rows[0].n;
    results.residual = { ledger_delta: after - before, batt_delta: afterBatt - beforeBatt };
    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    results.fatal = String((e as Error).message).slice(0, 300);
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
  const out = { run: RUN, discipline: 'BEGIN; <methods>; ROLLBACK (no COMMIT)', results };
  const dir = path.resolve(__dirname, '..', '.p9s4-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `bttc-cte-syntax-${RUN}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
