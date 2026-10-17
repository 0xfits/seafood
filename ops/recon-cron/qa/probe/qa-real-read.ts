/**
 * 独立质检 · AC8 真库只读腿（**仅 dev 库 · 仅 SELECT · 零写**）
 * ---------------------------------------------------------------------------
 * 用法（cwd = backend-ts）：
 *   TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-real-read.ts
 * 产出：ops/recon-cron/qa/readings/AC8-real-dev-readonly.json
 *
 * 边界（写死、不靠人记）：
 *   · 连接一律走仓内 `readQuery`（只读池）⇒ 串来自 `backend-ts/.env.local` 的 **dev** DATABASE_URL；
 *     脚本**不读、不打印**任何连接串（不碰 `~/.config/seafood/prod-db.env`）。
 *   · 先自报身份 `current_setting('neon.project_id')`：若 == 生产项目 `sweet-pond-28934105`
 *     ⇒ 立即中止，一条业务 SQL 都不发（只登记 ENV_LIMITED）。
 *   · 执行的语句 = 身份读数 + schema 顶 + 表存在性 + **被检源码导出的三条 SQL 原文**
 *     + 一次 `runLedgerRecon()`（= 端点真路径的三条 SELECT）。全部 SELECT。
 */
import * as path from 'path';
import * as fs from 'fs';
import { readQuery } from '../../../../backend-ts/src/db';
import {
  runLedgerRecon,
  SUPPLY_VS_LEDGER_SQL,
  ACCOUNT_VS_LEDGER_SQL,
  BATT_VS_ENTRY_SQL,
} from '../../../../backend-ts/src/ops-recon';

const QA_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(QA_DIR, 'readings');
const PROD_PROJECT = 'sweet-pond-28934105';
const DEV_PROJECT = 'quiet-math-65207667';

const now = () => new Date().toISOString();
const sample = (rows: Array<Record<string, unknown>>, n = 3) =>
  rows.slice(0, n).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null || v === undefined ? null : String(v)])));

const out: Record<string, any> = {
  ac: 'AC8',
  title: '真库只读腿：dev 库上三条对账 SQL 可执行（不判 PASS/FAIL 具体值）',
  measured_at: now(),
  connection: 'readQuery（只读池）· DATABASE_URL 来自 backend-ts/.env.local · 连接串与凭据一律不打印',
  guard: { prod_project_forbidden: PROD_PROJECT, dev_project_expected: DEV_PROJECT },
  statements: [],
  assertions: {},
};

(async () => {
  const idRows = await readQuery<Record<string, unknown>>(
    "SELECT current_setting('neon.project_id', true) AS project_id, current_setting('neon.branch_id', true) AS branch_id, current_database() AS db",
  );
  const identity = idRows[0] ?? {};
  out.identity = {
    project_id: identity.project_id ?? null,
    branch_id: identity.branch_id ?? null,
    db: identity.db ?? null,
    is_prod: identity.project_id === PROD_PROJECT,
    matches_dev_expected: identity.project_id === DEV_PROJECT,
  };
  out.statements.push('identity: SELECT current_setting(neon.project_id|branch_id), current_database()');

  if (identity.project_id === PROD_PROJECT) {
    out.blocked = 'ABORTED: readQuery resolves to PRODUCTION Neon project — zero business SQL executed';
    out.env_limited = '队列：dev 串不可用/指向生产 ⇒ AC8 无法在 dev 上取读数（零业务查询）';
    out.pass = false;
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'AC8-real-dev-readonly.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify({ blocked: out.blocked, identity: out.identity }, null, 2));
    process.exit(0);
  }

  const schemaTop = await readQuery<Record<string, unknown>>(
    'SELECT version, name FROM public.schema_migration ORDER BY version DESC LIMIT 1',
  );
  out.statements.push('SELECT public.schema_migration top (ORDER BY version DESC LIMIT 1)');
  out.schema_migration_top = schemaTop[0] ?? null;

  const tables = await readQuery<Record<string, unknown>>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('currency','ledger_entry','account','batt_account','batt_entry') ORDER BY table_name",
  );
  out.statements.push("SELECT information_schema.tables WHERE table_name IN (currency, ledger_entry, account, batt_account, batt_entry)");
  out.tables_present = tables.map((r) => String(r.table_name));

  const SQLS: Array<[string, string]> = [
    ['supply_vs_ledger', SUPPLY_VS_LEDGER_SQL],
    ['account_vs_ledger', ACCOUNT_VS_LEDGER_SQL],
    ['batt_account_vs_batt_entry', BATT_VS_ENTRY_SQL],
  ];

  out.per_sql = [] as any[];
  for (const [id, text] of SQLS) {
    const t0 = Date.now();
    const startsWithSelect = /^\s*SELECT\b/i.test(text);
    try {
      const rows = await readQuery<Record<string, unknown>>(text);
      out.per_sql.push({
        id,
        ok: true,
        starts_with_select: startsWithSelect,
        row_count: rows.length,
        elapsed_ms: Date.now() - t0,
        sample_rows: sample(rows),
      });
    } catch (e) {
      out.per_sql.push({
        id,
        ok: false,
        starts_with_select: startsWithSelect,
        elapsed_ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // —— 端点真路径（三条 SELECT 顺序执行）在真库上跑一次
  const t1 = Date.now();
  const report = await runLedgerRecon();
  out.report = {
    ok: report.ok,
    duration_ms: Date.now() - t1,
    checks: report.checks.map((c) => ({ id: c.id, status: c.status, rows: c.rows, diff: c.diff ?? null, sample_len: (c.sample || []).length })),
  };
  out.statements.push('runLedgerRecon(): 三条 SELECT 顺序执行（与 GET /api/ops/recon/ledger 同一路径）');

  out.value_disclaimer =
    '本文件只证「三条 SQL 在真 schema 上可执行」；dev 库的 ok=false 是**构造性**结果（基线取自生产），不构成缺陷（见 AC9 ②）。';

  out.assertions = {
    identity_not_prod: out.identity.is_prod === false,
    identity_is_dev_expected: out.identity.matches_dev_expected === true,
    five_tables_present: out.tables_present.length === 5,
    all_three_sql_executed: out.per_sql.every((s: any) => s.ok === true),
    all_sql_are_select: out.per_sql.every((s: any) => s.starts_with_select === true),
    report_shape_ok: !!report && Array.isArray(report.checks) && report.checks.length === 3,
    only_select_sent: out.statements.every((s: string) => /^(identity: )?SELECT|^runLedgerRecon/.test(s)),
  };
  out.pass = Object.values(out.assertions).every(Boolean);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'AC8-real-dev-readonly.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({
    pass: out.pass,
    identity: out.identity,
    schema_top: out.schema_migration_top,
    tables: out.tables_present,
    per_sql: out.per_sql.map((s: any) => ({ id: s.id, ok: s.ok, rows: s.row_count, ms: s.elapsed_ms })),
    report: out.report,
  }, null, 2));
  process.exit(out.pass ? 0 : 1);
})().catch((e) => {
  out.error = e instanceof Error ? e.message : String(e);
  out.pass = false;
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'AC8-real-dev-readonly.json'), JSON.stringify(out, null, 2) + '\n');
  } catch { /* noop */ }
  console.error('AC8_PROBE_FATAL', out.error);
  process.exit(2);
});
