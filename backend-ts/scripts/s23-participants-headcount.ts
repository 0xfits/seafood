/**
 * S23 只读探针（Kong）：`headcount` 进入任务读模型（台账 B4）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/s23-participants-headcount.ts
 * 出口：全绿 exit 0；任一断言 FAIL ⇒ exit 1。
 * 产物：backend-ts/.s23-artifacts/s23-<RUN>/readings.json（run-tagged，禁同名覆写）
 *
 * ★ **零写库 / 零 HTTP / 零起服务**：只有 SELECT；不 UPDATE / INSERT / DELETE。
 *   真库行数（`job` / `job_submission` / `ledger_entry` / `account`）与 `Σ(account.balance, cid=1)`
 *   在**本探针首尾各取一次**，须逐字相等（自证零副作用）。
 *
 * 判据：
 *   A  静态：`TaskRecord` 含 `headcount: number`；`normalizeTask` 映射 `headcount: toHeadcount(...)`；
 *      `toHeadcount` 兜底常量在场；两读口（`listTasks`/`getTask`）内层均 `SELECT t.*`（行内自带 headcount）。
 *   B  真库读数：对 `job 232`（派单指定，headcount=50）+ 至少 1 个 `headcount=1` 的存量 job，
 *      给出 库内原始 headcount / participants_count / 服务层 `getTask` / 服务层 `listTasks`；
 *      期望：服务层两读口 `headcount === 库内原始` 且为 `number`，`participants_count` 亦在场。
 *   C  判负（数据源侧自证）：`job 232` 服务层 `headcount` 断言 `=== 50` ⇒ 若移除映射（缺省为 1/undefined）**必红**。
 *   D  零副作用：首尾行数 / Σbalance 逐字相等。
 */
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/database';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.s23-artifacts', `s23-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATABASE_TS = fs.readFileSync(path.join(REPO_ROOT, 'backend-ts', 'src', 'database.ts'), 'utf8');

const RO_TABLES = ['job', 'job_submission', 'ledger_entry', 'account'];
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

(async () => {
  const before = await countRows();

  // ---- A 静态（读源码文本）--------------------------------------------------
  const nHeadcountField = (DATABASE_TS.match(/^\s{2}headcount: number;/gm) || []).length;
  const nMapLine = (DATABASE_TS.match(/headcount: toHeadcount\(getValue\(row, 'headcount'\)\)/g) || []).length;
  const nHelper = (DATABASE_TS.match(/const toHeadcount = \(value: unknown\): number =>/g) || []).length;
  const nSelectTStar = (DATABASE_TS.match(/SELECT\s+t\.\*\s*\n\s*FROM\s+job\s+AS\s+t/g) || []).length; // listTasks + getTask 内层各 1
  t('A1', 'A静态', nHeadcountField === 1, "TaskRecord 含 `headcount: number;` 1 处", nHeadcountField);
  t('A2', 'A静态', nMapLine === 1, "normalizeTask 映射 `headcount: toHeadcount(getValue(row, 'headcount'))` 1 处", nMapLine);
  t('A3', 'A静态', nHelper === 1, '`toHeadcount` 兜底 helper 1 处', nHelper);
  t('A4', 'A静态', nSelectTStar === 2, '两读口（listTasks/getTask）内层 `SELECT t.* FROM job AS t` = 2 处（行内自带 headcount）', nSelectTStar);
  // fail-closed 语义锚：helper 体内须含 `>= 1` 且回落 `1`
  const helperBody = DATABASE_TS.slice(DATABASE_TS.indexOf('const toHeadcount'), DATABASE_TS.indexOf('const toHeadcount') + 260);
  t('A5', 'A静态', /next >= 1 \? next : 1/.test(helperBody), 'toHeadcount fail-closed：`next >= 1 ? next : 1`', helperBody.replace(/\s+/g, ' ').slice(0, 120));

  // ---- 选候选 job ----------------------------------------------------------
  const job232 = await readQuery<{ job_id: number; headcount: number }>(`SELECT job_id, headcount FROM public.job WHERE job_id = 232 LIMIT 1`);
  const hc1 = await readQuery<{ job_id: number; headcount: number }>(`SELECT job_id, headcount FROM public.job WHERE headcount = 1 ORDER BY job_id ASC LIMIT 5`);
  const rawById = new Map<number, number>();
  for (const r of job232) rawById.set(Number(r.job_id), Number(r.headcount));
  for (const r of hc1) rawById.set(Number(r.job_id), Number(r.headcount));
  const uniqTargets = [...rawById.keys()];

  // ---- 服务层读（现取当前代码）---------------------------------------------
  const list = await DatabaseService.listTasks(0, 2000);
  const listHeadcountByID = new Map<number, unknown>();
  const listPartByID = new Map<number, unknown>();
  for (const task of list as unknown as Array<Record<string, unknown>>) {
    const id = Number((task as { tID?: number }).tID ?? 0);
    if (id) {
      listHeadcountByID.set(id, (task as { headcount?: unknown }).headcount);
      listPartByID.set(id, (task as { participants_count?: unknown }).participants_count);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const jobId of uniqTargets) {
    const raw = rawById.get(jobId)!;
    const task = await DatabaseService.getTask(jobId);
    const svcGet = task ? (task as unknown as { headcount?: unknown }).headcount : null;
    const svcGetPart = task ? (task as unknown as { participants_count?: unknown }).participants_count : null;
    const svcList = listHeadcountByID.has(jobId) ? listHeadcountByID.get(jobId) : null;
    const svcListPart = listPartByID.has(jobId) ? listPartByID.get(jobId) : null;
    rows.push({ job_id: jobId, raw_headcount: raw, service_getTask_headcount: svcGet, service_listTasks_headcount: svcList,
                service_getTask_participants: svcGetPart, service_listTasks_participants: svcListPart });

    t(`B-get-hc-${jobId}`, 'B真库', svcGet === raw, `service.getTask(${jobId}).headcount == raw(${raw})`, svcGet);
    t(`B-list-hc-${jobId}`, 'B真库', svcList === raw, `service.listTasks(${jobId}).headcount == raw(${raw})`, svcList);
    t(`B-get-num-${jobId}`, 'B真库', typeof svcGet === 'number', `service.getTask(${jobId}).headcount 为 number`, typeof svcGet);
    t(`B-part-${jobId}`, 'B真库', typeof svcGetPart === 'number' && typeof svcListPart === 'number',
      `service(${jobId}).participants_count 两读口均为 number（两字段并存）`, `${typeof svcGetPart}/${typeof svcListPart}`);
  }

  // ---- C 判负（数据源侧自证）-----------------------------------------------
  if (rawById.has(232)) {
    const svc232 = rows.find((r) => r.job_id === 232)?.service_getTask_headcount;
    t('C1-neg-232', 'C负对照', svc232 === 50, '负对照：job232 服务层 headcount === 50（移除映射 ⇒ 缺省 1/undefined ⇒ 必红）', svc232);
  } else {
    t('C1-neg-232', 'C负对照', false, 'job232 应在库内', 'absent');
  }
  // 另取一个 headcount=1 的存量 job：证明「非 50」的普通值也可复算
  t('C2-baseline', 'C负对照', uniqTargets.some((id) => rawById.get(id) === 1), '存在 headcount=1 的存量 job（基线对照）', JSON.stringify(uniqTargets.map((id) => [id, rawById.get(id)])));

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
    static: { nHeadcountField, nMapLine, nHelper, nSelectTStar },
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
