/**
 * P3-S1 · 探针 02：DROP 懒 DDL 建出的 9 张空表
 * 前置硬闸：逐张 in-script 重新断言 count(*) = 0；任一张非空 ⇒ 立即 abort，绝不 DROP。
 * 用法：npx ts-node --transpile-only scripts/p3s1-02-drop-lazy-tables.ts <run>
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';
const LAZY = ['app_config', 'permission_group', 'prize', 'prize_item', 'task_progress',
  'market_order', 'market_trade', 'shard', 'shard_transfer'];
const EXPECTED = ['account', 'commission_policy', 'currency', 'ledger_entry',
  'ledger_owner', 'referral', 'schema_migration', 'users'];

(async () => {
  const pool = new Pool({ connectionString: URL, max: 2, connectionTimeoutMillis: 30_000 });
  const q = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, p as never[])).rows as R[];
  const out: Record<string, unknown> = { probe: 'P3S1-02-DROP-LAZY-TABLES', run: process.argv[2] || null };

  out.tables_before = (await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`))
    .map((r) => r.table_name);
  out.table_count_before = (out.tables_before as string[]).length;
  out.indexes_before = await q(`SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`);

  // ---- 硬闸：逐张断言 0 行 ----
  const counts: Record<string, number | null> = {};
  for (const t of LAZY) {
    if (!(out.tables_before as string[]).includes(t)) { counts[t] = null; continue; }
    counts[t] = Number((await q<{ n: string }>(`SELECT count(*)::text AS n FROM "${t}"`))[0].n);
  }
  out.row_counts_at_gate = counts;
  const nonempty = Object.entries(counts).filter(([, v]) => v !== null && v !== 0).map(([k]) => k);
  out.nonempty_at_gate = nonempty;
  if (nonempty.length) {
    out.aborted = true;
    out.abort_reason = `NON-EMPTY LAZY TABLE(S): ${nonempty.join(', ')} — DROP NOT EXECUTED`;
    console.log(JSON.stringify(out, null, 2));
    await pool.end();
    process.exit(3);
  }
  out.gate_passed = true;

  // ---- DROP（无 CASCADE：有依赖对象就报错，不静默连带删除）----
  const dropped: string[] = [];
  for (const t of LAZY) {
    await q(`DROP TABLE IF EXISTS "${t}"`);
    dropped.push(t);
  }
  out.dropped = dropped;

  out.tables_after = (await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`))
    .map((r) => r.table_name);
  out.table_count_after = (out.tables_after as string[]).length;
  out.equals_expected_set = JSON.stringify(out.tables_after) === JSON.stringify(EXPECTED);
  out.indexes_after = await q(`SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`);
  const reg = await q<{ version: string }>(`SELECT version FROM schema_migration ORDER BY version`);
  out.schema_migration_rows = reg.length;
  out.schema_version = reg.length ? reg[reg.length - 1].version : null;

  const dir = path.resolve(__dirname, '..', '.p3s1-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `p3s1-drop-${out.run}.json`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
})().catch((e) => { console.error('P3S1-02 FATAL', String((e as Error)?.message ?? e)); process.exit(2); });
