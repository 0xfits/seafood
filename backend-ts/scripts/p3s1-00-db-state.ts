/**
 * P3-S1 · 探针 00：真库状态快照（表清单/计数 + 9 张懒 DDL 表行数 + schema 版本）
 * 用法：npx ts-node --transpile-only scripts/p3s1-00-db-state.ts
 * 只读：全部为 SELECT。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
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
  const out: Record<string, unknown> = { probe: 'P3S1-00-DB-STATE', run: process.argv[2] || null };

  out.tables = (await q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`))
    .map((r) => r.table_name);
  out.table_count = out.tables.length;
  out.expected_tables = EXPECTED;
  out.lazy_ddl_tables = LAZY;
  out.lazy_tables_present = LAZY.filter((t) => (out.tables as string[]).includes(t));
  out.lazy_tables_missing = LAZY.filter((t) => !(out.tables as string[]).includes(t));

  const counts: Record<string, number | null> = {};
  for (const t of LAZY) {
    if (!(out.tables as string[]).includes(t)) { counts[t] = null; continue; }
    counts[t] = Number((await q<{ n: string }>(`SELECT count(*)::text AS n FROM "${t}"`))[0].n);
  }
  out.lazy_table_row_counts = counts;
  out.lazy_tables_all_empty = LAZY.every((t) => counts[t] === 0);

  const reg = await q<{ version: string }>(`SELECT version FROM schema_migration ORDER BY version`);
  out.schema_migration_rows = reg.length;
  out.schema_version = reg.length ? reg[reg.length - 1].version : null;

  out.users_rows = Number((await q<{ n: string }>(`SELECT count(*)::text AS n FROM users`))[0].n);
  out.db_error = null;
  console.log(JSON.stringify(out, null, 2));
  await pool.end();
})().catch(async (e) => {
  console.log(JSON.stringify({ probe: 'P3S1-00-DB-STATE', fatal: String((e as Error)?.message ?? e) }, null, 2));
  process.exit(2);
});
