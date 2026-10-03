/**
 * Neng 独立质检（线 A）· R-9-86 / R-9-87 的库面 recon（只读）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s6-ro/neng-a-recon.ts
 */
import { DatabaseService } from '../src/database';
import { readQuery, closePools } from '../src/db';

const j = (x: unknown) => JSON.stringify(x);

(async () => {
  const out: Record<string, unknown> = {};

  // 0) job_application 列
  const cols = await readQuery<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='job_application'
      ORDER BY ordinal_position`);
  out.job_application_columns = cols;

  // 1) 一条带交付物正文的 task_progress（application_id=jID）及其 worker
  const owned = await readQuery<Record<string, unknown>>(
    `SELECT a.application_id, a.job_id, a.worker_uid,
            length(COALESCE(s.deliverable,'')) AS deliv_len,
            left(COALESCE(s.deliverable,''), 40) AS deliv_head
       FROM public.job_application a
       LEFT JOIN LATERAL (SELECT * FROM public.job_submission s0
                           WHERE s0.job_id=a.job_id AND s0.worker_uid=a.worker_uid
                           ORDER BY s0.submission_id DESC LIMIT 1) s ON TRUE
      WHERE COALESCE(s.deliverable,'') <> ''
      ORDER BY a.application_id LIMIT 5`);
  out.owned_with_deliverable = owned;

  // 2) 任意两个不同的非管理员 worker
  const workers = await readQuery<{ uid: string }>(
    `SELECT uid::text AS uid FROM public.users WHERE is_admin IS NOT TRUE ORDER BY uid LIMIT 6`);
  out.workers = workers;

  // 3) R-9-87 撞号点：存在 X 使 (某 A 的 job_id = X) 与 (某 B 的 application_id = X, B<>A)
  const collisions = await readQuery<Record<string, unknown>>(
    `SELECT a.application_id AS other_app_id, a.worker_uid AS other_uid, a.job_id AS other_job_id,
            b.application_id AS self_app_id, b.worker_uid AS self_uid, b.job_id AS self_job_id,
            a.application_id AS X
       FROM public.job_application a
       JOIN public.job_application b ON b.job_id = a.application_id
      WHERE a.worker_uid <> b.worker_uid
        AND a.application_id <> b.job_id
      ORDER BY a.application_id LIMIT 10`);
  out.collisions = collisions;

  // 3b) 更宽的撞号扫描（application_id 命中 + job_id 命中，任一）
  const anyColl = await readQuery<Record<string, unknown>>(
    `WITH pairs AS (
       SELECT a.application_id AS aid, a.worker_uid AS aw, a.job_id AS aj,
              b.application_id AS bid, b.worker_uid AS bw, b.job_id AS bj
         FROM public.job_application a
         JOIN public.job_application b
           ON (b.application_id = a.job_id OR b.job_id = a.application_id)
      )
      SELECT DISTINCT aid, aw, aj, bid, bw, bj,
             CASE WHEN bid = aj AND aw <> bw THEN 'appid_hits_jobid_other'
                  WHEN bj = aid AND aw <> bw THEN 'jobid_hits_appid_other'
                  ELSE 'other' END AS kind
        FROM pairs
       WHERE aw <> bw
       ORDER BY aid LIMIT 20`);
  out.any_collision = anyColl;

  // 4) job_application 计数与 application_id 生成方式
  const counts = await readQuery<Record<string, unknown>>(
    `SELECT (SELECT count(*) FROM public.job_application) AS apps,
            (SELECT count(*) FROM public.job_submission) AS subs,
            (SELECT count(*) FROM public.users) AS users`);
  out.counts = counts;
  out.serial = await readQuery<Record<string, unknown>>(
    `SELECT pg_get_serial_sequence('public.job_application','application_id') AS seq,
            pg_get_serial_sequence('public.job_application','job_id') AS job_seq`);

  console.log(j(out, null, 1));
  await closePools();
})().catch(async (e) => { console.error('ERR', e); try { await closePools(); } catch { /* */ } process.exit(1); });
