// 只读：8⑥ apply 后深核（Zang）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string) => (await pool.query(s)).rows;
  const out: Record<string, unknown> = {};
  out.schema_migration = await q(`select max(version) as max_version, count(*)::int as applied_rows from public.schema_migration`);
  out.public_tables = await q(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
  out.perms = await q(`select count(*)::int as n, bool_and(permission_key <> 'manage_audit' or true) as _x, (select string_agg(permission_key, ',' order by permission_key) from public.admin_permission) as keys from public.admin_permission`);
  out.has_audit_key = await q(`select count(*)::int as n from public.admin_permission where permission_key='manage_audit'`);
  out.super_admin_perms = await q(`select count(*)::int as n from public.admin_role_permission where role_key='super_admin'`);
  out.role_perm_audit = await q(`select count(*)::int as n from public.admin_role_permission where role_key='super_admin' and permission_key='manage_audit'`);
  out.perm_check = await q(`select count(*)::int as n from pg_constraint where conrelid='public.admin_permission'::regclass and contype='c'`);
  out.new_applied = await q(`select version, left(checksum,12) as cks from public.schema_migration where version='0039'`);
  out.audit_rows = await q(`select count(*)::int as n from public.admin_ops_audit_log`);
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
