// 只读：为「给 uid 970213 加 10000 积分」做前置现取
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  const out: Record<string, unknown> = {};

  out.admin_uids = await q(`select uid, evm, is_admin from public.users where is_admin = true order by uid limit 10`);
  out.super_admin_rows = await q(`select * from public.admin_role_permission where role_key = 'super_admin' order by 1 limit 5`).catch(() => []);
  out.kevin_account = await q(`select uid, cid, balance::text from public.account where uid = 970213 order by cid`);
  out.kevin_owner = await q(`select * from public.ledger_owner where uid = 970213 limit 5`).catch(() => []);
  out.cid1_currency = await q(`select cid, symbol, name, decimals, status::text from public.currency where cid = 1`);
  out.recent_adj_audit = await q(`select * from public.admin_ops_audit_log order by 1 desc limit 8`);
  out.audit_cols = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='admin_ops_audit_log' order by ordinal_position`);
  // 日累计闸：现取函数体里的 cap 常量
  const fn = await q(`select p.proname, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%points_adjust%'`);
  out.fn_names = (fn as any[]).map((r) => r.proname);
  const def = String((fn as any[])[0]?.def || '');
  out.cap_lines = def.split('\n').filter((l) => /cap|1000|10000|daily/i.test(l)).slice(0, 12);
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
