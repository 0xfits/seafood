// 只读探针（Zang apply P9④ 迁移后核验；不写任何数据）
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
  out.kind_check = await q(`select length(pg_get_constraintdef(oid)) as def_len, (pg_get_constraintdef(oid) like '%bttc_mint_fee%') as has_mint, (pg_get_constraintdef(oid) like '%bttc_burn_fee%') as has_burn, (select count(*)::int from regexp_matches(pg_get_constraintdef(oid), '''[a-z_]+''', 'g')) as n_values from pg_constraint where conrelid='public.ledger_entry'::regclass and conname='ledger_kind_enum'`);
  out.kind_ok = await q(`select (prosrc like '%bttc_mint_fee%') as has_mint, (prosrc like '%bttc_burn_fee%') as has_burn from pg_proc where proname='ledger_kind_ok'`);
  out.platform_whitelist = await q(`select
      position('bttc_mint_fee' in prosrc) > 0 as credit_has_mint,
      position('bttc_burn_fee' in prosrc) > 0 as credit_has_burn,
      position('commission' in prosrc) > 0 as has_commission_text
    from pg_proc where proname='ledger_assert_platform_mutation'`);
  out.whitelist_behaviour = await q(`select
      public.ledger_assert_platform_mutation(-1,'credit','bttc_mint_fee') as c_mint_ok,
      public.ledger_assert_platform_mutation(-1,'credit','bttc_burn_fee') as c_burn_ok,
      public.ledger_assert_platform_mutation(-1,'debit','bttc_mint_fee') as d_mint`);
  out.platform_col = await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='currency' and column_name='is_platform_coin'`);
  out.currency_rows_default = await q(`select count(*)::int as total, count(*) filter (where is_platform_coin) ::int as flagged from public.currency`);
  out.op_whitelist = await q(`select (prosrc like '%''settle'', ''entries'', ''burn''%') as has_burn_in_oplist from pg_proc where proname='ledger_post_event'`);
  out.new_applied = await q(`select version, left(checksum,12) as cks from public.schema_migration where version in ('0032','0033','0034') order by version`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
