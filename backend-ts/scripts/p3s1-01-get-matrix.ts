/**
 * P3-S1 · 探针 01：GET 路由矩阵（只发 GET，逐条记录 HTTP 状态码 + 响应片段）
 * 用法：npx ts-node --transpile-only scripts/p3s1-01-get-matrix.ts <label>
 * 只读：全部 HTTP 方法为 GET。
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://127.0.0.1:5788';
const ROUTES = [
  '/api/market/1/orderbook',
  '/api/market/1/trades',
  '/api/prize/all',
  '/api/task/all',
  '/api/task/1',
  '/api/prize/1',
  '/api/user/asset/1',
  '/api/home',
  '/api/task-progress/1',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const label = process.argv[2] || 'run';
  const results: Array<Record<string, unknown>> = [];
  for (const p of ROUTES) {
    let status = -1; let body = ''; let err: string | null = null; let tries = 0;
    for (let i = 0; i < 3; i += 1) {
      tries = i + 1;
      try {
        const res = await fetch(BASE + p, { method: 'GET' });
        status = res.status;
        body = (await res.text()).slice(0, 300);
        err = null;
        break;
      } catch (e) {
        err = String((e as Error)?.message ?? e);
        await sleep(400);
      }
    }
    results.push({ path: p, method: 'GET', status, body, transport_error: err, tries });
  }
  const out = {
    probe: 'P3S1-01-GET-MATRIX',
    label,
    base: BASE,
    routes_total: ROUTES.length,
    status_histogram: results.reduce((a: Record<string, number>, r) => {
      a[String(r.status)] = (a[String(r.status)] || 0) + 1; return a;
    }, {}),
    results,
  };
  const dir = path.resolve(__dirname, '..', '.p3s1-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `p3s1-getmatrix-${label}.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('P3S1-01 FATAL', String((e as Error)?.message ?? e)); process.exit(2); });
