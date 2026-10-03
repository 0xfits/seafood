// 只读探针 v2（去掉会 RAISE 的直接函数调用）
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
  out.kind_check = await q(`select (pg_get_constraintdef(oid) like '%bttc_mint_fee%') as has_mint, (pg_get_constraintdef(oid) like '%bttc_burn_fee%') as has_burn, (select count(*)::int from regexp_matches(pg_get_constraintdef(oid), '[a-z_]{3,}', 'g')) as n_tokens from pg_constraint where conrelid='public.ledger_entry'::regclass and conname='ledger_kind_enum'`);
  out.kind_ok = await q(`select (prosrc like '%bttc_mint_fee%') as has_mint, (prosrc like '%bttc_burn_fee%') as has_burn from pg_proc where proname='ledger_kind_ok'`);
  out.credit_whitelist = await q(`select (prosrc like '%checkin_makeup_fee%') as c_checkin, (prosrc like '%bttc_mint_fee%') as c_mint, (prosrc like '%bttc_burn_fee%') as c_burn from pg_proc where proname='ledger_assert_platform_mutation'`);
  out.platform_col = await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='currency' and column_name='is_platform_coin'`);
  out.currency_rows = await q(`select count(*)::int as total, count(*) filter (where is_platform_coin)::int as flagged from public.currency`);
  out.post_event = await q(`select (prosrc like '%bttc%') as has_bttc, (prosrc like '%''entries'', ''burn''%') as has_burn_in_oplist, (prosrc like '%total_supply - v_amount%' or prosrc like '%total_supply = total_supply - v_amount%') as has_supply_doublewrite from pg_proc where proname='ledger_post_event'`);
  out.new_applied = await q(`select version, left(checksum,12) as cks from public.schema_migration where version in ('0032','0033','0034') order by version`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
