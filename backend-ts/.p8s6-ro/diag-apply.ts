// 只读：诊断「参与任务」被拒（钱包尾号 09b0）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  const out: Record<string, unknown> = {};

  out.users_09b0 = await q(`select uid, evm, right(evm,4) as suf, is_admin, time_reg, time_login_last
                            from public.users where evm ilike '%09b0' order by uid`);
  out.user_count = await q(`select count(*)::int as n from public.users`);
  out.recent_users = await q(`select uid, right(evm,6) as suf, is_admin, time_reg from public.users order by uid desc limit 8`);

  const uids = (out.users_09b0 as any[]).map((r) => r.uid);
  out.target_uids = uids;
  if (uids.length) {
    out.batt = await q(`select uid, batt::text as batt, time_updated from public.batt_account where uid = any($1::bigint[]) order by uid`, [uids]);
    out.batt_entries = await q(`select uid, delta::text, batt_after::text, reason, time_created from public.batt_entry where uid = any($1::bigint[]) order by uid, txid`, [uids]);
    out.referral = await q(`select child_uid, parent_uid, depth, bound_at from public.referral where child_uid = any($1::bigint[]) or parent_uid = any($1::bigint[])`, [uids]);
    out.my_apps = await q(`select application_id, job_id, worker_uid, status from public.job_application where worker_uid = any($1::bigint[]) order by application_id desc limit 10`, [uids]);
    out.my_jobs = await q(`select job_id, employer_uid, status, reward::text, cid from public.job where employer_uid = any($1::bigint[]) order by job_id desc limit 10`, [uids]);
  }
  out.jobs = await q(`select job_id, employer_uid, worker_uid, status, reward::text as reward, cid, time_created
                      from public.job order by job_id desc limit 12`);
  out.app_config_keys = await q(`select key from public.app_config`);
  out.system_settings = await q(`select left(value::text, 700) as v from public.app_config where key='system_settings'`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
