/**
 * C1 定位探针（P9② 库面收口续跑 · 先取证后改）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2c-apply/c1-locate.ts
 * 产物：backend-ts/.p9s2c-apply/c1-locate-<RUN>.json
 *
 * 目的：在**同一事务内**（末尾哨兵 ROLLBACK）复现 C1（applyToJob 在 batt<阈值 时返回 conflict 而非
 *   batt_below_threshold），并逐字打印 6 个中间量 + 实参 + pg_typeof，逐条排除/坐实 H1/H2/H3。
 *
 * 中间量：
 *   (a) 该 uid 的 batt 实际值（两种 COALESCE 形态各打：代码形态 vs 旧探针调试形态）
 *   (b) 解出的 acceptThresholdBatt（含来源：batt_policy 行 vs 参数默认 9）
 *   (c) ins CTE 返回行数
 *   (d) cur.outcome 实际值
 *   (e) j.job_status
 *   (f) j.employer_uid = <workerUid> 的真假
 * 另打：实参（值 + JS 类型）+ pg_typeof。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, closePools, txQuery, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, `c1-locate-${RUN}.json`);
class Sentinel extends Error { constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); } }

const out: Record<string, unknown> = {};
const get1 = async <T = Record<string, unknown>>(tx: TxClient, sql: string, p?: unknown[]): Promise<T | null> =>
  (await txQuery<T>(tx, sql, p))[0] ?? null;
const inSavepoint = async <T>(tx: TxClient, name: string, fn: () => Promise<T>): Promise<T> => {
  await txQuery(tx, `SAVEPOINT ${name}`);
  try { const v = await fn(); await txQuery(tx, `RELEASE SAVEPOINT ${name}`); return v; }
  catch (e) { await txQuery(tx, `ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined); throw e; }
};

/**
 * 诊断 SQL：**逐字镜像 `applyToJob` 的 CTE 结构**（j / ins / cur / 终选），额外回吐 6 中间量。
 * 参数一律**不加类型转换**（与 `sqlFor`→`ex.query(text, params)` 同协议）⇒ 由 PG 推断类型，
 * 完全复刻真链路实参绑定。
 */
const DIAG = `
  WITH j AS (
    SELECT job.job_id, job.employer_uid, job.status AS job_status
      FROM public.job AS job WHERE job.job_id = $1
  ), ins AS (
    INSERT INTO public.job_application (job_id, worker_uid, status, create_key)
    SELECT j.job_id, $2, 'applied', $3 FROM j
     WHERE j.job_status = 'open' AND j.employer_uid <> $2
       AND (SELECT COALESCE(b.batt, 0) FROM public.batt_account AS b WHERE b.uid = $2)
           >= COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                                    THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END
                           FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1), $4)
    ON CONFLICT DO NOTHING RETURNING application_id
  ), cur AS (
    SELECT 'applied' AS outcome FROM ins
    UNION ALL
    SELECT 'replay' FROM public.job_application AS a, j
     WHERE a.create_key = $3 AND a.job_id = j.job_id AND a.worker_uid = $2 AND NOT EXISTS (SELECT 1 FROM ins)
    UNION ALL
    SELECT 'already_applied' FROM public.job_application AS a, j
     WHERE a.job_id = j.job_id AND a.worker_uid = $2 AND a.create_key <> $3 AND NOT EXISTS (SELECT 1 FROM ins)
  )
  SELECT j.job_id, j.job_status,
         (SELECT count(*) FROM ins) AS ins_rows,
         (SELECT count(*) FROM cur) AS cur_rows,
         (SELECT outcome FROM cur LIMIT 1) AS cur_outcome,
         (j.employer_uid = $2) AS employer_eq_worker,
         (SELECT COALESCE(b.batt, 0) FROM public.batt_account AS b WHERE b.uid = $2) AS batt_shapeA_code,
         COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = $2), 0) AS batt_shapeB_debug,
         (SELECT COALESCE(b.batt, 0) FROM public.batt_account AS b WHERE b.uid = $2)
           < COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                                   THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END
                          FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1), $4) AS lt_shapeA_code,
         COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = $2), 0)
           < COALESCE((SELECT CASE WHEN (p.value->>'acceptThresholdBatt') ~ '^[0-9]+$'
                                   THEN (p.value->>'acceptThresholdBatt')::int ELSE NULL END
                          FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1), $4) AS lt_shapeB_debug,
         (SELECT (p.value->>'acceptThresholdBatt') FROM public.app_config AS p WHERE p.key = 'batt_policy' LIMIT 1) AS raw_cfg,
         pg_typeof($1) AS ptype_job, pg_typeof($2) AS ptype_worker, pg_typeof($4) AS ptype_thr
    FROM j
`;

(async () => {
  await withTransaction(async (tx) => {
    const EMP = 3, W = 6, JOB = 990101;
    const KEY = `p9s2c:c1:${JOB}:${W}:${RUN}`;
    await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, status, create_key)
      VALUES ($1::bigint,$2::bigint,1,1,'open',$3::text)`, [String(JOB), String(EMP), KEY + ':job']);

    out.args = { jobId: JOB, workerUid: W, createKey: KEY,
      jsTypes: { jobId: typeof JOB, workerUid: typeof W, createKey: typeof KEY } };

    // --- 形态 Ⅰ：worker 无 batt_account 行（= 真 C1 夹具 · batt 实为缺失） ---
    out.worker_batt_row_exists_before = (await get1(tx,
      `SELECT count(*)::int AS n FROM public.batt_account WHERE uid=$1::bigint`, [String(W)]))?.n;

    const diagOdd_norow = await inSavepoint(tx, 'sp_diag_norow', async () => {
      const d = await get1(tx, DIAG, [String(JOB), String(W), KEY + ':diag', String(9)]);
      return d;
    });
    // 真链路读数（独立 savepoint，诊断插的行已回滚）
    const real_norow = await inSavepoint(tx, 'sp_real_norow', async () =>
      DatabaseService.applyToJob(JOB, W, KEY + ':real_norow', tx));
    out.no_batt_row = { diag: diagOdd_norow, applyToJob_real: real_norow };

    // --- 形态 Ⅱ：worker 显式 batt_account 行 = 0 ---
    await txQuery(tx, `INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint, 0)
                       ON CONFLICT (uid) DO UPDATE SET batt = 0`, [String(W)]);
    const diagOdd_row0 = await inSavepoint(tx, 'sp_diag_row0', async () =>
      get1(tx, DIAG, [String(JOB), String(W), KEY + ':diag0', String(9)]));
    const real_row0 = await inSavepoint(tx, 'sp_real_row0', async () =>
      DatabaseService.applyToJob(JOB, W, KEY + ':real0', tx));
    out.explicit_batt_row_0 = { diag: diagOdd_row0, applyToJob_real: real_row0 };

    // --- 形态 Ⅲ：显式 batt_account 行 = 9（≥ 阈值 ⇒ applied，验证对照） ---
    await txQuery(tx, `UPDATE public.batt_account SET batt = 9 WHERE uid=$1::bigint`, [String(W)]);
    const real_row9 = await inSavepoint(tx, 'sp_real_row9', async () =>
      DatabaseService.applyToJob(JOB, W, KEY + ':real9', tx));
    out.explicit_batt_row_9 = { applyToJob_real: real_row9 };

    out.conclusion = '见 stdout / 报告';
    throw new Sentinel('C1');
  });

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  console.log(`ARTIFACT ${OUT}`);
  await closePools();
  process.exit(0);
})().catch(async (e) => {
  if (e instanceof Sentinel) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
    console.log(JSON.stringify(out, null, 1));
    console.log(`ARTIFACT ${OUT}`);
    await closePools(); process.exit(0);
  }
  console.error('C1LOCATE_FATAL', String((e as Error)?.message || e).slice(0, 400));
  await closePools().catch(() => undefined); process.exit(2);
});
