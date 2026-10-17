/**
 * 真实读数探针 · 三条对账 SQL 打**真库**（只读 · 零写库）
 * ---------------------------------------------------------------------------
 * 用法（cwd = backend-ts）：
 *   TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/probe/recon-real-read.ts
 *
 * 目的：证明 `ops-recon.ts` 里那三条 SQL **在真 schema 上语法/列名成立**（stub 探针证不了这一层）。
 * 连接口径：`db.readQuery` ⇒ 只读池 ⇒ `resolveReadUrl()` 优先 `DATABASE_URL`
 *   ⇒ 本机 = `backend-ts/.env.local` 的 **dev** 串（Neon `quiet-math-65207667`），
 *   **不是生产**。dev 库读数与生产不可比（技能已登记），本文件只当「SQL 能跑」的证据。
 * 只发 SELECT：`SELECT current_setting('neon.project_id')` 自报身份 + 对账三条。
 * 凭据纪律：串不进命令行、不打印；只打印 project_id / branch / db 这三个非机密标识。
 */
import * as path from 'path';
import * as fs from 'fs';
import { readQuery } from '../../../backend-ts/src/db';
import { runLedgerRecon } from '../../../backend-ts/src/ops-recon';

const OUT_DIR = path.resolve(__dirname, '../readings');

(async () => {
  const identity = await readQuery<Record<string, unknown>>(
    "SELECT current_setting('neon.project_id', true) AS project_id, current_setting('neon.branch_id', true) AS branch_id, current_database() AS db",
  );
  const version = await readQuery<{ version: string }>(
    'SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1',
  );

  const report = await runLedgerRecon();

  const out = {
    probe: 'recon-real-read',
    target: 'dev (DATABASE_URL from backend-ts/.env.local)',
    identity: identity[0] ?? null,
    schema_top: version[0]?.version ?? null,
    report,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'recon-real-dev.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
  console.log(JSON.stringify({ saved: file, identity: out.identity, schema_top: out.schema_top, ok: report.ok, duration_ms: report.duration_ms, checks: report.checks.map((c) => ({ id: c.id, status: c.status, rows: c.rows, diff: c.diff })) }));
  process.exit(0);
})().catch((e) => {
  console.error('PROBE_FATAL', e instanceof Error ? e.message : String(e));
  process.exit(2);
});
