// p4z-p5t-02-d1p.ts — D1' 取证：**非 400 传输类错误**在当前驱动下抛什么、归什么状态
// ============================================================================
// 目的（本单 §6）：
//   · 结构位置：`@neondatabase/serverless` 只在 **HTTP 400 分支**读 `{message, code}`；
//     **非 400** ⇒ 抛 `Server error (HTTP status N)`、`code` 恒 `null`
//     ⇒ 现状被**归一化成 `500`**（route-layer.spec:656 的 `503` 语义 = 重试类，不含此面）。
//   · 本轮**安全构造**：**不启服务、不改 `.env.local`、不连真库**，只在进程内用
//     `neon()` 指向**拒连地址**（`127.0.0.1:1`）发起一次出站连接，观测：
//       ① 抛出的错误对象是什么（构造器名 / `code` / `message` / `sourceError`）；
//       ② 该错误在路由层 `catch` 下会被 `sendError(res, <什么>, …)` 兜住。
//   · 全程**只读**：无 DDL/DML；唯一副作用 = 一次注定失败的 TCP 出站尝试。
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'p5triage-probe'));
fs.mkdirSync(outDir, { recursive: true });

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless');

const out: Record<string, unknown> = { started: new Date().toISOString() };
const cases: Array<{ name: string; url: string; note: string }> = [
  {
    name: 'REFUSED_LOCAL_PORT',
    url: 'postgresql://nobody:nobody@127.0.0.1:1/nonexistent',
    note: '本机 1 号端口 = 拒绝连接（ECONNREFUSED）⇒ 传输类，非 HTTP 400',
  },
  {
    name: 'UNRESOLVABLE_HOST',
    url: 'postgresql://nobody:nobody@nonexistent-host-p5triage.invalid/db',
    note: 'DNS 不可解析 ⇒ 传输类',
  },
];

(async () => {
  const results: unknown[] = [];
  for (const c of cases) {
    const rec: Record<string, unknown> = { name: c.name, note: c.note, url_host: new URL(c.url).host };
    try {
      const sql = neon(c.url);
      await (sql as unknown as (t: string) => Promise<unknown>)('SELECT 1');
      rec.outcome = 'UNEXPECTED_SUCCESS';
    } catch (e: unknown) {
      const err = e as {
        name?: string;
        constructor?: { name?: string };
        message?: string;
        code?: unknown;
        severity?: unknown;
        sourceError?: unknown;
        status?: unknown;
        httpStatus?: unknown;
      };
      rec.outcome = 'THREW';
      rec.error_name = err?.name ?? null;
      rec.error_ctor = err?.constructor?.name ?? null;
      rec.error_message = err?.message ?? null;
      rec.error_code = err?.code ?? null;
      rec.error_severity = err?.severity ?? null;
      rec.error_status = err?.status ?? null;
      rec.error_httpStatus = err?.httpStatus ?? null;
      rec.error_sourceError = err?.sourceError === undefined ? 'undefined' : String(err.sourceError);
      rec.error_own_keys = e && typeof e === 'object' ? Object.keys(e as object) : null;
      // `code` 恒 null ⇒ 路由层无码可 map ⇒ 落兜底 500（结构位置见报告 §6）
      rec.code_is_null = err?.code === null || err?.code === undefined;
    }
    results.push(rec);
    console.log(`[d1p] ${c.name} => ${JSON.stringify(rec)}`);
  }
  out.cases = results;
  out.structural_claim = {
    source: 'node_modules/@neondatabase/serverless/index.js',
    claim: '仅在 HTTP 400 分支读 {message, code}；非 400 ⇒ throw "Server error (HTTP status N)"，code 恒 null',
  };
  out.finished = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'd1p-transport.json'), JSON.stringify(out, null, 2));
  console.log(`[d1p] wrote ${path.join(outDir, 'd1p-transport.json')}`);
})().catch((e) => {
  console.error('[d1p] FAILED:', e);
  process.exitCode = 1;
});
