/**
 * schema 取证脚本：输出 public schema 的表 / 列类型 / 约束 / 触发器 / 索引 真实读数
 * 运行：npx ts-node --transpile-only scripts/inspect-schema.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';

(async () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const c = await pool.connect();
  const q = async (text: string, params?: unknown[]) => (await c.query(text, params as any[])).rows;

  const tables = await q(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  const columns = await q(`
    SELECT table_name, ordinal_position, column_name, data_type,
           is_nullable, COALESCE(column_default,'') AS column_default
      FROM information_schema.columns
     WHERE table_schema='public'
     ORDER BY table_name, ordinal_position`);
  const constraints = await q(`
    SELECT c.relname AS table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' ORDER BY c.relname, con.contype, con.conname`);
  const indexes = await q(`
    SELECT tablename, indexname, indexdef FROM pg_indexes
     WHERE schemaname='public' ORDER BY tablename, indexname`);
  const triggers = await q(`
    SELECT c.relname AS table_name, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname='public' ORDER BY c.relname, t.tgname`);
  const seeds = await q(`
    SELECT 'currency' AS tbl, count(*)::int AS n FROM currency
    UNION ALL SELECT 'account', count(*)::int FROM account
    UNION ALL SELECT 'ledger_owner', count(*)::int FROM ledger_owner
    UNION ALL SELECT 'ledger_entry', count(*)::int FROM ledger_entry
    UNION ALL SELECT 'users', count(*)::int FROM "users"`);
  const floatCols = await q(`
    SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema='public'
       AND data_type IN ('real','double precision','numeric')
     ORDER BY 1,2`);

  console.log(JSON.stringify({
    tables: tables.map((r: any) => r.table_name),
    table_count: tables.length,
    money_columns_are_bigint: (await q(`
      SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND column_name IN
         ('delta','frozen_delta','balance','frozen','total_supply','supply_cap','deposit_amount','balance_after','frozen_after')
       ORDER BY table_name, column_name`)).map((r: any) => `${r.table_name}.${r.column_name}=${r.data_type}`),
    float_or_numeric_columns: floatCols,
    columns,
    constraints,
    indexes,
    triggers,
    seed_row_counts: seeds,
  }, null, 2));

  c.release();
  await pool.end();
  process.exit(0);
})().catch((e) => { console.error('inspect fatal:', String((e as Error).message).slice(0, 300)); process.exit(2); });
