// 只读探针（Zang apply 后核验用；不写任何数据）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (sql: string) => (await pool.query(sql)).rows;
  const out: Record<string, unknown> = {};

  out.schema_migration = await q(`select max(version) as max_version, count(*)::int as applied_rows from public.schema_migration`);
  out.public_tables = await q(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
  out.new_tables = await q(`select table_name from information_schema.tables where table_schema='public' and table_name in ('batt_account','batt_entry','checkin_log','checkin_makeup_log') order by table_name`);
  out.kind_constraint = await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.ledger_entry'::regclass and conname='ledger_kind_enum'`);
  out.kind_ok_has_new = await q(`select position('checkin_makeup_fee' in prosrc) > 0 as has_new, length(prosrc) as src_len from pg_proc where proname='ledger_kind_ok'`);
  out.platform_mut_has_new = await q(`select position('checkin_makeup_fee' in prosrc) > 0 as has_new from pg_proc where proname='ledger_assert_platform_mutation'`);
  out.new_triggers = await q(`select tgname, tgrelid::regclass::text as tbl from pg_trigger where not tgisinternal and tgrelid in ('public.batt_account'::regclass,'public.batt_entry'::regclass,'public.checkin_log'::regclass,'public.checkin_makeup_log'::regclass) order by 2,1`);
  // 0028/0029 的 applied 行 + checksum 前缀
  out.new_applied = await q(`select version, left(checksum,12) as cks FROM public.schema_migration WHERE version in ('0028','0029') order by version`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
