/**
 * R-9-86 / R-9-87 · 只读侦察（零写）：找「编号空间撞车」真数据 + R-9-86 三臂夹具候选。
 * 用法（cwd = backend-ts）：npx ts-node --transpile-only .p8s6-impl/r9-86-87-recon.ts
 */
import { readQuery, closePools } from '../src/db';

const main = async () => {
  const apps = await readQuery<{ application_id: string; job_id: string; worker_uid: string; status: string }>(
    `SELECT application_id::text, job_id::text, worker_uid::text, status
       FROM public.job_application ORDER BY application_id`);
  const jobs = await readQuery<{ job_id: string; employer_uid: string; worker_uid: string | null; status: string }>(
    `SELECT job_id::text, employer_uid::text, worker_uid::text, status
       FROM public.job ORDER BY job_id`);
  const users = await readQuery<{ uid: string; evm: string; is_admin: boolean }>(
    `SELECT uid::text, evm, is_admin FROM public.users ORDER BY uid`);

  console.log(JSON.stringify({
    counts: { apps: apps.length, jobs: jobs.length, users: users.length },
    apps: apps.map((a) => ({ app: Number(a.application_id), job: Number(a.job_id), worker: Number(a.worker_uid), status: a.status })),
    jobs: jobs.map((j) => ({ job: Number(j.job_id), employer: Number(j.employer_uid), worker: j.worker_uid === null ? null : Number(j.worker_uid), status: j.status })),
    users: users.map((u) => ({ uid: Number(u.uid), is_admin: u.is_admin })),
  }, null, 2));

  // 撞车检测：X 使「某 app 的 application_id = X」且「另某 app 的 job_id = X」
  const appIds = new Set(apps.map((a) => Number(a.application_id)));
  const collisions: Array<Record<string, unknown>> = [];
  for (const a of apps) {
    const X = Number(a.job_id);
    if (appIds.has(X)) {
      const ownerOfX = apps.find((b) => Number(b.application_id) === X);
      collisions.push({
        X,
        app_with_application_id_X: { app: X, job: Number(ownerOfX!.job_id), worker: Number(ownerOfX!.worker_uid) },
        app_with_job_id_X: { app: Number(a.application_id), job: X, worker: Number(a.worker_uid) },
        distinct_workers: Number(ownerOfX!.worker_uid) !== Number(a.worker_uid),
      });
    }
  }
  console.log('COLLISIONS=' + JSON.stringify(collisions, null, 2));
  await closePools();
};

main().catch(async (e) => { console.error('RECON_FAIL', e); await closePools().catch(() => undefined); process.exit(2); });
