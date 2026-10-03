// 只读：诊断「提交任务 ⇒ 403 当前账号无权执行该操作」（钱包尾号 09b0）
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  const out: Record<string, unknown> = {};

  // ① 该钱包的全部用户行（查「重登是否造了第二个 uid」）
  out.users_09b0 = await q(`select uid, evm, is_admin, time_reg::text, time_login_last::text
                            from public.users where evm ilike '%09b0' order by uid`);
  out.user_rows_same_evm = await q(`select lower(evm) as evm_l, count(*)::int as n, array_agg(uid order by uid) as uids
                                    from public.users group by lower(evm) having count(*) > 1 order by n desc limit 10`);

  const uids = (out.users_09b0 as any[]).map((r) => r.uid);
  out.target_uids = uids;

  if (uids.length) {
    // ② 我报名的申请（含状态 + 该 job 的 worker/雇主）
    out.my_applications = await q(
      `select a.application_id, a.job_id, a.worker_uid, a.status::text as app_status, a.time_created::text,
              j.employer_uid, j.worker_uid as job_worker_uid, j.status::text as job_status, j.reward::text as reward
         from public.job_application a join public.job j on j.job_id = a.job_id
        where a.worker_uid = any($1::bigint[]) order by a.application_id desc limit 20`, [uids]);
    // ③ 这些 job 上的全部申请（看是否「雇主选了别人」）
    out.same_job_applications = await q(
      `select a.application_id, a.job_id, a.worker_uid, a.status::text as app_status, a.time_created::text
         from public.job_application a
        where a.job_id in (select job_id from public.job_application where worker_uid = any($1::bigint[]))
        order by a.job_id desc, a.application_id`, [uids]);
    // ④ 我作为雇主的 job
    out.my_employer_jobs = await q(
      `select job_id, employer_uid, worker_uid, status::text, reward::text, time_created::text
         from public.job where employer_uid = any($1::bigint[]) order by job_id desc limit 10`, [uids]);
    // ⑤ 我提交过的交付
    out.my_submissions = await q(
      `select s.submission_id, s.job_id, s.worker_uid, s.review_status, s.time_created::text
         from public.job_submission s where s.worker_uid = any($1::bigint[]) order by s.submission_id desc limit 10`, [uids]);
  }

  // ⑥ 当前可提交面（accepted 态）
  out.accepted_jobs = await q(`select job_id, employer_uid, worker_uid, status::text from public.job where status::text='accepted' order by job_id desc limit 15`);
  out.accepted_apps = await q(`select application_id, job_id, worker_uid, status::text from public.job_application where status::text='accepted' order by application_id desc limit 15`);
  out.stale_apps = await q(`select a.application_id, a.job_id, a.worker_uid, a.status::text as app_status, j.status::text as job_status
                              from public.job_application a join public.job j on j.job_id=a.job_id
                             where a.status::text='accepted' and j.status::text <> 'accepted'
                             order by a.application_id desc limit 15`);

  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('PROBE_FAIL', e?.message || e); process.exit(1); });
