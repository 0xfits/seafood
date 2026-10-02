/**
 * P6-B6-PERM · 只读探针（**零写入**：仅 SELECT / information_schema）
 * 用途：批 6 权限面取证 —— 权限键/角色/admin_role* 四表行数、users.is_admin、
 *       DEFAULT_ADMIN_ADDRESS 命中情况、账本零位移基线、迁移面计数。
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-b6perm-00-probe.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const DEFAULT_ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';

(async () => {
  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  if (!URL) { console.log('FATAL: missing DATABASE_URL_UNPOOLED'); process.exit(2); }
  const c = new Client({ connectionString: URL });
  await c.connect();
  const out: any = {};
  try {
    out.schema_migration = (await c.query(
      `SELECT version, name, checksum FROM public.schema_migration ORDER BY version`)).rows;
    out.schema_migration_row_count = out.schema_migration.length;

    out.base_table_count = (await c.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows[0].n;

    out.non_internal_triggers = (await c.query(
      `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class k ON k.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=k.relnamespace
        WHERE n.nspname='public' AND NOT t.tgisinternal`)).rows[0].n;

    for (const t of ['admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role', 'app_config']) {
      out[`${t}_rows`] = (await c.query(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0].n;
    }

    out.admin_permission_cols = (await c.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='admin_permission' ORDER BY ordinal_position`)).rows;
    out.admin_role_cols = (await c.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='admin_role' ORDER BY ordinal_position`)).rows;

    out.users_cols = (await c.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`)).rows.map((r: any) => r.column_name);
    out.users = (await c.query(
      `SELECT uid::text AS uid, EVM, is_admin FROM public.users ORDER BY uid`)).rows;
    out.admin_address_hits = (await c.query(
      `SELECT uid::text AS uid, EVM, is_admin FROM public.users
        WHERE lower(EVM) = $1`, [DEFAULT_ADMIN_ADDRESS])).rows;

    out.ledger_entry_count = (await c.query(`SELECT count(*)::text AS n FROM public.ledger_entry`)).rows[0].n;
    out.sigma_balance_cid1 = (await c.query(
      `SELECT coalesce(sum(balance),0)::text AS s FROM public.account WHERE cid = 1`)).rows[0].s;
    out.account_rows = (await c.query(`SELECT count(*)::int AS n FROM public.account`)).rows[0].n;

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await c.end().catch(() => undefined);
  }
})().catch((e) => { console.error('PROBE_CRASHED', e?.message); process.exit(2); });
