/*
 * p4z-d1p-00-probe-shape.ts — D1' 只读取证：非 400 传输/驱动错误在本版驱动下**抛什么形状**
 * ============================================================================
 * 范围：**不起服务、不连真库、不改 .env.local**。只对 127.0.0.1:1（拒连）与不可解析域名
 *   发起注定失败的出站连接，用与 `src/db.ts` **同一条路**（Pool + WebSocket 注入）与
 *   `neon()` HTTP 两条路分别观测错误对象的 构造器名 / code / message / cause 链 / sourceError。
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-d1p-00-probe-shape.ts
 * 产物：.p4-artifacts/p6d1p-<ts>/shape-probe.json
 * 纪律：只读；无 DDL/DML；退出码取自脚本自身（不经管道）。
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', `p6d1p-${stamp}`));
fs.mkdirSync(outDir, { recursive: true });

/* eslint-disable @typescript-eslint/no-var-requires */
const neonMod = require('@neondatabase/serverless');
const WS = require('ws');

const urls: Array<{ name: string; url: string }> = [
  { name: 'REFUSED_127_0_0_1:1', url: 'postgresql://nobody:secret@127.0.0.1:1/nonexistent' },
  { name: 'UNRESOLVABLE_HOST', url: 'postgresql://nobody:secret@d1p-unresolvable.invalid/db' },
];

const safe = (fn: () => unknown): unknown => {
  try { return fn(); } catch { return '<threw>'; }
};
const shape = (e: unknown): Record<string, unknown> => {
  const o = e as any;
  const chain: Array<Record<string, unknown>> = [];
  const seen = new Set<unknown>();
  let cur: unknown = o && (o.cause ?? o.sourceError ?? o.error);
  for (let i = 0; i < 5 && cur && typeof cur === 'object' && !seen.has(cur); i += 1) {
    seen.add(cur);
    const c = cur as any;
    chain.push({
      ctor: safe(() => c.constructor?.name) ?? null,
      name: safe(() => c.name) ?? null,
      code: safe(() => c.code) ?? null,
      message: String(safe(() => c.message) ?? '').slice(0, 160),
      has_own_message: Object.prototype.hasOwnProperty.call(c, 'message'),
    });
    cur = c.cause ?? c.sourceError ?? c.error;
  }
  return {
    ctor: safe(() => o?.constructor?.name) ?? null,
    name: safe(() => o?.name) ?? null,
    code: safe(() => o?.code) ?? null,
    typeof_code: typeof safe(() => o?.code),
    status: safe(() => o?.status) ?? null,
    message: String(safe(() => o?.message) ?? '').slice(0, 200),
    is_global_event: (() => { try { return typeof (globalThis as any).Event === 'function' && o instanceof (globalThis as any).Event; } catch { return false; } })(),
    own_keys: (() => { try { return Object.getOwnPropertyNames(o).slice(0, 12); } catch { return null; } })(),
    chain,
  };
};

const out: Record<string, unknown> = { started: new Date().toISOString(), engine: 'p4z-d1p-00-probe-shape', cases: [] };
const cases: unknown[] = out.cases as unknown[];

(async () => {
  // ---- 路 A：与 src/db.ts 同路（Pool + WS 注入）
  neonMod.neonConfig.webSocketConstructor = WS;
  for (const u of urls) {
    const rec: Record<string, unknown> = { path: 'pool_ws', url_host: new URL(u.url).host, url_name: u.name };
    const t0 = Date.now();
    try {
      const pool = new neonMod.Pool({ connectionString: u.url, max: 1, idleTimeoutMillis: 5000, connectionTimeoutMillis: 8000 });
      const client = await pool.connect();
      rec.outcome = 'UNEXPECTED_CONNECT';
      try { await client.query('SELECT 1'); rec.outcome = 'UNEXPECTED_SUCCESS'; } catch (e) { rec.query_error = shape(e); }
      try { client.release?.(); await pool.end(); } catch { /* noop */ }
    } catch (e) {
      rec.outcome = 'THREW';
      rec.error = shape(e);
    }
    rec.elapsed_ms = Date.now() - t0;
    cases.push(rec);
    console.log(`[pool_ws] ${u.name} :: ${String(rec.outcome)} :: ${JSON.stringify((rec.error as any) ?? rec).slice(0, 400)}`);
  }
  // ---- 路 B：neon() HTTP 直连（非 400 分支的原文来源）
  for (const u of urls) {
    const rec: Record<string, unknown> = { path: 'neon_http', url_host: new URL(u.url).host, url_name: u.name };
    const t0 = Date.now();
    try {
      const sql = neonMod.neon(u.url);
      await sql('SELECT 1');
      rec.outcome = 'UNEXPECTED_SUCCESS';
    } catch (e) {
      rec.outcome = 'THREW';
      rec.error = shape(e);
    }
    rec.elapsed_ms = Date.now() - t0;
    cases.push(rec);
    console.log(`[neon_http] ${u.name} :: ${String(rec.outcome)} :: ${JSON.stringify((rec.error as any) ?? rec).slice(0, 400)}`);
  }
  out.finished = new Date().toISOString();
  const file = path.join(outDir, 'shape-probe.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`ARTIFACT=${file}`);
})().catch((e) => { console.log(`FATAL ${String(e)}`); process.exitCode = 1; });
