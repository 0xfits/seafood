// 只读：全量 job / job_application 概览（诊断 403 归属）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  const out: Record<string, unknown> = {};
  out.jobs = await q(`select job_id, employer_uid, worker_uid, status, reward::text as reward, time_created::text, time_updated::text
                        from public.job order by job_id desc limit 40`);
  out.apps = await q(`select application_id, job_id, worker_uid, status, time_created::text
                        from public.job_application order by application_id desc limit 40`);
  out.subs = await q(`select submission_id, job_id, worker_uid, review_status, time_created::text
                        from public.job_submission order by submission_id desc limit 20`);
  out.apps_any_970213 = await q(`select * from public.job_application where worker_uid = 970213`);
  out.subs_any_970213 = await q(`select * from public.job_submission where worker_uid = 970213`);
  out.counts = await q(`select (select count(*)::int from public.job) as jobs,
                               (select count(*)::int from public.job_application) as apps,
                               (select count(*)::int from public.job_submission) as subs`);
  out.recent_apps_1d = await q(`select application_id, job_id, worker_uid, status, time_created::text
                                  from public.job_application where time_created > now() - interval '1 day' order by application_id desc`);
  out.recent_subs_1d = await q(`select submission_id, job_id, worker_uid, review_status, time_created::text
                                  from public.job_submission where time_created > now() - interval '1 day' order by submission_id desc`);
  out.jobs_openish = await q(`select job_id, employer_uid, status, reward::text from public.job where status in ('open','applied') order by job_id desc limit 20`);
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch(e=>{console.error('PROBE_FAIL', e?.message); process.exit(1);});
