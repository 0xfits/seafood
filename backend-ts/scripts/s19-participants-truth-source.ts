/**
 * S19 只读探针（Kong）：`participants_count` 真源 `job_application` → `public.job_submission`
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/s19-participants-truth-source.ts
 * 出口：全绿 exit 0；任一断言 FAIL ⇒ exit 1。
 * 产物：backend-ts/.s19-artifacts/s19-<RUN>/readings.json（run-tagged，禁同名覆写）
 *
 * ★ **零写库 / 零 HTTP / 零起服务**：只有 SELECT；不 UPDATE / INSERT / DELETE。
 *   真库行数（`job_submission` / `job_application` / `job` / `ledger_entry` / `account`）
 *   与 `Σ(account.balance, cid=1)` 在**本探针首尾各取一次**，须逐字相等（自证零副作用）。
 *
 * 判据：
 *   A  两处 SQL 同源：`database.ts` 中 `participant_counts` CTE 的 `FROM` = `public.job_submission`，
 *      计数 = `COUNT(DISTINCT ... worker_uid)`；`COUNT(1)::int AS participants_count` + `job_application`
 *      组合 = 0 处；两处 CTE 文本逐字同形（S16「过滤谓词两处同源」纪律）。
 *   B  真库读数：对 `job_id=232` + 「有 job_submission 行」1 个 + 「只有 job_application 历史行」1 个，
 *      给出 旧源计数 / 新源计数 / 服务层（`DatabaseService.getTask`）计数。
 *      期望：服务层计数 == 新源计数；且存在至少 1 个 job 旧源≠新源（证明换源可观测）。
 *   C  负对照（数据源侧）：对 `旧源≠新源` 的 job，断言「服务层计数 == 旧源计数」 ⇒ **必红**（judge_fired）。
 *   D  零副作用：首尾行数 / Σbalance 逐字相等。
 */
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/database';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.s19-artifacts', `s19-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATABASE_TS = fs.readFileSync(path.join(REPO_ROOT, 'backend-ts', 'src', 'database.ts'), 'utf8');

// ---- 只读等价 SQL 文本（与 CTE 语义逐字对应）--------------------------------
const OLD_SRC_SQL = `SELECT COUNT(1)::int AS participants_count FROM public.job_application WHERE job_id = $1`;
const NEW_SRC_SQL = `SELECT COUNT(DISTINCT worker_uid)::int AS participants_count FROM public.job_submission WHERE job_id = $1`;

const RO_TABLES = ['job', 'job_application', 'job_submission', 'ledger_entry', 'account'];
const countRows = async (): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (const tbl of RO_TABLES) {
    const rows = await readQuery<{ n: number }>(`SELECT COUNT(1)::int AS n FROM public.${tbl}`);
    out[tbl] = Number(rows[0]?.n || 0);
  }
  const bal = await readQuery<{ s: string }>(`SELECT COALESCE(SUM(balance), 0)::text AS s FROM public.account WHERE cid = 1`);
  out['sum_balance_cid1'] = Number(bal[0]?.s || 0);
  return out;
};

const oldCount = async (jobId: number): Promise<number> => {
  const rows = await readQuery<{ participants_count: number }>(OLD_SRC_SQL, [jobId]);
  return Number(rows[0]?.participants_count || 0);
};
const newCount = async (jobId: number): Promise<number> => {
  const rows = await readQuery<{ participants_count: number }>(NEW_SRC_SQL, [jobId]);
  return Number(rows[0]?.participants_count || 0);
};

(async () => {
  const before = await countRows();

  // ---- A 静态同源检查（读源码文本；**限定到 participant_counts CTE**，非全文件）--------
  // 全文件内 `FROM public.job_submission AS s` 另有他处（他读口）⇒ 必须用「紧跟 JOIN selected_task(s)」锚定。
  const fromJobApplicationCte = /FROM\s+job_application\s+AS\s+j\s*\n\s*JOIN\s+selected_task/g;
  const fromSubmissionCte = /FROM\s+public\.job_submission\s+AS\s+s\s*\n\s*JOIN\s+selected_task/g;
  const countDistinct = /COUNT\(DISTINCT\s+s\.worker_uid\)::int\s+AS\s+participants_count/g;
  const count1Participants = /COUNT\(1\)::int\s+AS\s+participants_count/g;
  const nFromApp = (DATABASE_TS.match(fromJobApplicationCte) || []).length;
  const nFromSub = (DATABASE_TS.match(fromSubmissionCte) || []).length;
  const nDistinct = (DATABASE_TS.match(countDistinct) || []).length;
  const nCount1 = (DATABASE_TS.match(count1Participants) || []).length;

  t('A1', 'A同源', nFromSub === 2, 'participant_counts CTE：FROM public.job_submission AS s JOIN selected_task 出现 2 次', nFromSub);
  t('A2', 'A同源', nDistinct === 2, 'COUNT(DISTINCT s.worker_uid)::int AS participants_count 出现 2 次', nDistinct);
  t('A3', 'A同源', nFromApp === 0, 'participant_counts CTE：FROM job_application AS j JOIN selected_task = 0 处', nFromApp);
  t('A4', 'A同源', nCount1 === 0, 'COUNT(1)::int AS participants_count = 0 处（旧计数形态已清）', nCount1);

  // 两处 CTE 文本逐字同形（各自 participant_counts AS ( ... ) 段）
  const cteRe = /participant_counts AS \(\s*SELECT\s+s\.job_id AS tid,\s*COUNT\(DISTINCT s\.worker_uid\)::int AS participants_count\s*FROM public\.job_submission AS s\s*JOIN (selected_task|selected_tasks) AS t ON t\.job_id = s\.job_id\s*GROUP BY s\.job_id\s*\)/g;
  const cteMatches = DATABASE_TS.match(cteRe) || [];
  t('A5', 'A同源', cteMatches.length === 2, '两处 participant_counts CTE 逐字同形（仅 JOIN 目标名 selected_task(s) 不同）', cteMatches.length);

  // ---- 选候选 job ----------------------------------------------------------
  const job232 = await readQuery<{ job_id: string }>(`SELECT job_id FROM public.job WHERE job_id = 232 LIMIT 1`);
  const hasSubJobs = await readQuery<{ job_id: string; n: string }>(
    `SELECT job_id, COUNT(DISTINCT worker_uid)::text AS n FROM public.job_submission GROUP BY job_id ORDER BY COUNT(DISTINCT worker_uid) DESC, job_id ASC LIMIT 5`,
  );
  const appOnlyJobs = await readQuery<{ job_id: string; n: string }>(
    `SELECT a.job_id, COUNT(1)::text AS n
     FROM public.job_application AS a
     WHERE NOT EXISTS (SELECT 1 FROM public.job_submission AS s WHERE s.job_id = a.job_id)
     GROUP BY a.job_id ORDER BY a.job_id ASC LIMIT 5`,
  );

  const targets: number[] = [];
  if (job232[0]) targets.push(232);
  if (hasSubJobs[0]) targets.push(Number(hasSubJobs[0].job_id));
  if (appOnlyJobs[0]) targets.push(Number(appOnlyJobs[0].job_id));
  // 去重
  const uniqTargets = [...new Set(targets)];

  // ---- 服务层读（现取当前代码）--------------------------------------------
  const list = await DatabaseService.listTasks(0, 1000);
  const listByID = new Map<number, number>();
  for (const task of list as unknown as Array<Record<string, unknown>>) {
    const id = Number((task as { tID?: number }).tID ?? (task as { job_id?: number }).job_id ?? 0);
    if (id) listByID.set(id, Number((task as { participants_count?: number }).participants_count || 0));
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const jobId of uniqTargets) {
    const o = await oldCount(jobId);
    const n = await newCount(jobId);
    const task = await DatabaseService.getTask(jobId);
    const svcGet = task ? Number(task.participants_count || 0) : null;
    const svcList = listByID.has(jobId) ? listByID.get(jobId)! : null;
    const kind = hasSubJobs.some((r) => Number(r.job_id) === jobId)
      ? 'has_submission'
      : (appOnlyJobs.some((r) => Number(r.job_id) === jobId) ? 'app_only_history' : 'job232_or_other');
    rows.push({ job_id: jobId, kind, old_source: o, new_source: n, service_getTask: svcGet, service_listTasks: svcList });

    // B：服务层 == 新源
    t(`B-get-${jobId}`, 'B真库', svcGet === n, `service.getTask(${jobId}) == new_source(${n})`, svcGet);
    t(`B-list-${jobId}`, 'B真库', svcList === n, `service.listTasks(${jobId}) == new_source(${n})`, svcList);
  }

  // C：至少一个 job 旧源≠新源（换源可观测）——负对照
  const divergent = rows.filter((r) => Number(r.old_source) !== Number(r.new_source));
  t('C1', 'C负对照', divergent.length >= 1, '存在旧源≠新源的 job（先决条件）', divergent.length);
  // 负对照：若服务层仍取旧源，则 service == old_source —— 对 divergent 的 job 该断言应 **必红**
  for (const r of divergent) {
    const svc = Number(r.service_getTask);
    const wouldRed = svc === Number(r.old_source);
    t(`C2-neg-${r.job_id}`, 'C负对照', !wouldRed,
      `负对照：若真源未换 ⇒ service==old_source(${r.old_source}) 会成立（本单应为 false）`, wouldRed);
  }

  const after = await countRows();
  let zeroSideEffect = true;
  for (const k of Object.keys(before)) {
    if (before[k] !== after[k]) zeroSideEffect = false;
    t(`D-zero-${k}`, 'D零副作用', before[k] === after[k], `before ${k} == after`, `${before[k]} -> ${after[k]}`);
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    run: RUN,
    generated_at: new Date().toISOString(),
    old_src_sql: OLD_SRC_SQL,
    new_src_sql: NEW_SRC_SQL,
    static: { nFromApp, nFromSub, nDistinct, nCount1 },
    candidates: { job232: job232.map((r) => Number(r.job_id)), hasSubJobs, appOnlyJobs },
    rows,
    row_counts: { before, after, zero_side_effect: zeroSideEffect },
    checks,
    summary: { total: checks.length, failed: failed.length, verdict: failed.length === 0 ? 'PASS' : 'FAIL' },
  };
  const outFile = path.join(OUT_DIR, 'readings.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ out: outFile, rows, static: report.static, row_counts: report.row_counts, failed: failed.map((c) => c.id), verdict: report.summary.verdict }, null, 2));

  await closePools();
  process.exit(failed.length === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('PROBE ERROR', err);
  try { await closePools(); } catch { /* noop */ }
  process.exit(2);
});
