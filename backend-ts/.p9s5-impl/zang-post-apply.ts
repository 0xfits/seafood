// 只读：P9⑤ apply 后深核（Zang）
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
  out.fee_check = await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.commission_policy'::regclass and conname='commission_policy_fee_rate_rng'`);
  out.policy_rows = await q(`select policy_id, fee_rate_bp, levels, array_length(weights_bp,1) as w_len, weights_bp, created_by, effective_from from public.commission_policy order by policy_id`);
  out.kind_check = await q(`select (pg_get_constraintdef(oid) like '%invite_first_task_reward%') as has_new, (select count(*)::int from regexp_matches(pg_get_constraintdef(oid), '[a-z_]{3,}', 'g')) as n_tokens from pg_constraint where conrelid='public.ledger_entry'::regclass and conname='ledger_kind_enum'`);
  out.kind_ok = await q(`select (prosrc like '%invite_first_task_reward%') as has_new, md5(prosrc) as md5, length(prosrc) as len from pg_proc where proname='ledger_kind_ok'`);
  out.platform_mut = await q(`select (prosrc like '%''invite_first_task_reward''%') as debit_whitelist_new, md5(prosrc) as md5, length(prosrc) as len,
      (select count(*)::int from regexp_matches(prosrc, '''[a-z_]{3,}''', 'g')) as n_quoted_tokens from pg_proc where proname='ledger_assert_platform_mutation'`);
  out.post_event_unchanged = await q(`select md5(prosrc) as md5, length(prosrc) as len from pg_proc where proname='ledger_post_event'`);
  out.conservation = await q(`select md5(prosrc) as md5, length(prosrc) as len, (prosrc like '%M = 0%') as has_m0 from pg_proc where proname='ledger_assert_commission_conservation'`);
  out.new_applied = await q(`select version, left(checksum,12) as cks from public.schema_migration where version in ('0035','0036','0037','0038') order by version`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
