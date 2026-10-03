// 只读：核 referral 触发器 tgenabled 态 + commission_policy 现值
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string) => (await pool.query(s)).rows;
  const out: Record<string, unknown> = {};
  out.triggers = await q(`select c.relname as tbl, t.tgname, t.tgenabled,
      case t.tgenabled when 'O' then 'ENABLED(default)' when 'D' then 'DISABLED' when 'R' then 'REPLICA' when 'A' then 'ALWAYS' end as state
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where not t.tgisinternal and c.relname in ('referral','commission_policy','ledger_entry')
    order by c.relname, t.tgname`);
  out.policy = await q(`select policy_id, fee_rate_bp, levels, weights_bp, effective_from, created_by from public.commission_policy order by policy_id`);
  out.policy_check = await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.commission_policy'::regclass and conname='commission_policy_fee_rate_rng'`);
  out.referral_rows = await q(`select count(*)::int as n from public.referral`);
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
