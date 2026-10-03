/**
 * Neng 独立质检（线 A）· R-9-87 双向独立复现（库面只读 + 事务夹具 ROLLBACK）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s6-ro/neng-a-r987.ts
 * 主仓 = 本人优先；仓外去优先键副本 = 他人优先（同一探针，用副本 src 跑即可）。
 */
import { DatabaseService } from '../src/database';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const CASES: Array<[number, number, string]> = [
  [4, 970102, 'X=4 本人=970102(job_id=4) 应 self=5'],
  [4, 970002, 'X=4 本人=970002(application_id=4) 应 self=4'],
  [9, 3, 'X=9 本人=3(job_id=9) 应 self=8'],
  [9, 6, 'X=9 本人=6(application_id=9) 应 self=9'],
  [15, 1, 'X=15 本人=1(job_id=15) 应 self=11'],
  [15, 12, 'X=15 本人=12(application_id=15) 应 self=15'],
];

/** 同一条 SQL 的「旧序」版本（修前 `(application_id = X) DESC` 居首）用于对照读数 */
const resolveRaw = async (identifier: number, workerUid: number, order: 'new' | 'old') => {
  const ord = order === 'new'
    ? `ORDER BY (a.worker_uid = ${workerUid}) DESC, (a.application_id = ${identifier}) DESC, a.application_id DESC`
    : `ORDER BY (a.application_id = ${identifier}) DESC, a.application_id DESC`;
  const rows = await readQuery<Record<string, unknown>>(
    `SELECT a.application_id, a.worker_uid,
            CASE WHEN a.worker_uid = ${workerUid} THEN 'self' ELSE 'other' END AS ownership
       FROM public.job_application AS a
      WHERE a.application_id = ${identifier} OR a.job_id = ${identifier}
      ${ord}
      LIMIT 1`);
  return rows[0] || null;
};

(async () => {
  const out: Record<string, unknown> = {};

  // ---- (a) 真数据只读 ----
  const real: Array<Record<string, unknown>> = [];
  for (const [x, w, desc] of CASES) {
    const svc = await DatabaseService.resolveJobApplication(x, w);
    const rawNew = await resolveRaw(x, w, 'new');
    const rawOld = await resolveRaw(x, w, 'old');
    real.push({ case: desc, x, worker: w, service: svc, raw_new: rawNew, raw_old: rawOld });
  }
  out.real_data = real;

  // ---- (b) 事务内自造夹具（末尾 ROLLBACK）----
  const apps = await readQuery<Record<string, unknown>>(
    `SELECT application_id::text AS aid, job_id::text AS jid, worker_uid::text AS w FROM public.job_application`);
  const appIds = new Set(apps.map((r) => String(r.aid)));
  const jobIds = [...new Set(apps.map((r) => String(r.jid)))];
  const pairKeys = new Set(apps.map((r) => `${r.jid}#${r.w}`));
  const usedJob = new Set(apps.map((r) => String(r.jid)));
  const jobsAll = await readQuery<Record<string, unknown>>(`SELECT job_id::text AS j FROM public.job`);
  const jobTable = [...new Set(jobsAll.map((r) => String(r.j)))];
  const maxApp = apps.reduce((m, r) => Math.max(m, Number(r.aid)), 0);
  const U_A = 11; const U_B = 970002;
  // F 使 X=F 无任何已提交行命中（既非 application_id，也无既有申请以 F 为 job_id）⇒ 夹具独占命中
  const F = jobTable.find((j) => !appIds.has(j) && !pairKeys.has(`${j}#${U_A}`));
  const H = jobTable.find((j) => j !== F && !pairKeys.has(`${j}#${U_B}`));
  const G = maxApp + 1;

  const fx: Record<string, unknown> = { F_identifier: F, G_self_appid: G, H_jobid: H, U_A, U_B };
  if (!F || !H) {
    fx.error = 'no suitable fixture ids';
  } else {
    const ordSql = (order: 'new' | 'old', id: number, w: number) => (order === 'new'
      ? `ORDER BY (a.worker_uid = ${w}) DESC, (a.application_id = ${id}) DESC, a.application_id DESC`
      : `ORDER BY (a.application_id = ${id}) DESC, a.application_id DESC`);
    const pickInTx = async (tx: TxClient, order: 'new' | 'old') => (await tx.query<Record<string, unknown>>(
      `SELECT a.application_id::text AS aid, a.worker_uid::text AS w,
              CASE WHEN a.worker_uid = ${U_A} THEN 'self' ELSE 'other' END AS ownership
         FROM public.job_application AS a
        WHERE a.application_id = ${Number(F)} OR a.job_id = ${Number(F)}
        ${ordSql(order, Number(F), U_A)}
        LIMIT 1`)).rows[0] || null;
    await withTransaction(async (tx: TxClient) => {
      await tx.query(
        `INSERT INTO public.job_application (application_id, job_id, worker_uid, status, create_key)
         VALUES ($1, $2, $3, 'applied', 'neng-fixture-other')`, [Number(F), Number(H), U_B]);
      await tx.query(
        `INSERT INTO public.job_application (application_id, job_id, worker_uid, status, create_key)
         VALUES ($1, $2, $3, 'applied', 'neng-fixture-self')`, [G, Number(F), U_A]);
      fx.rows_in_tx = (await tx.query<Record<string, unknown>>(
        `SELECT application_id::text AS aid, job_id::text AS jid, worker_uid::text AS w
           FROM public.job_application
          WHERE application_id IN ($1,$2) OR job_id IN ($1,$2)
          ORDER BY application_id`, [Number(F), G])).rows;
      fx.in_tx_new_order = await pickInTx(tx, 'new');
      fx.in_tx_old_order = await pickInTx(tx, 'old');
      throw new Error('NENG_ROLLBACK_SENTINEL');
    }).catch((e) => { if (String((e as Error)?.message) !== 'NENG_ROLLBACK_SENTINEL') throw e; });

    // 零残渣证明
    fx.residue = await readQuery<Record<string, unknown>>(
      `SELECT count(*)::int AS n FROM public.job_application WHERE create_key IN ('neng-fixture-other','neng-fixture-self')`);
  }
  out.fixture = fx;

  out.verdict_real_all_self = real
    .slice(0, 1).length === 1 && real.every((r) => (r.service as any)?.ownership === 'self');
  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch(async (e) => { console.error('ERR', e); try { await closePools(); } catch { /* */ } process.exit(1); });
