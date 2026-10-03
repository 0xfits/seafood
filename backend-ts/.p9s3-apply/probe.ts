// 只读探针（Zang apply P9③ 迁移后核验；不写任何数据）
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
  out.new_tables = await q(`select table_name from information_schema.tables where table_schema='public' and table_name in ('rating','listing_order_event') order by table_name`);
  out.order_status_check = await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.listing_order'::regclass and conname='listing_order_status_enum'`);
  out.transition = await q(`select
      public.listing_order_status_transition_ok('created','paid')    as created_paid,
      public.listing_order_status_transition_ok('shipped','received') as shipped_received,
      public.listing_order_status_transition_ok('shipped','refunded') as shipped_refunded,
      public.listing_order_status_transition_ok('received','refunded') as received_refunded,
      public.listing_order_status_transition_ok('created','received') as created_received`);
  out.rating_cols = await q(`select count(*)::int as cols from information_schema.columns where table_schema='public' and table_name='rating'`);
  out.rating_idx = await q(`select count(*)::int as idx from pg_indexes where schemaname='public' and tablename='rating'`);
  out.rating_trg = await q(`select count(*)::int as trg from pg_trigger where not tgisinternal and tgrelid='public.rating'::regclass`);
  out.oe_cols = await q(`select count(*)::int as cols from information_schema.columns where table_schema='public' and table_name='listing_order_event'`);
  out.oe_idx = await q(`select count(*)::int as idx from pg_indexes where schemaname='public' and tablename='listing_order_event'`);
  out.oe_trg = await q(`select count(*)::int as trg from pg_trigger where not tgisinternal and tgrelid='public.listing_order_event'::regclass`);
  out.new_applied = await q(`select version, left(checksum,12) as cks from public.schema_migration where version in ('0030','0031') order by version`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
