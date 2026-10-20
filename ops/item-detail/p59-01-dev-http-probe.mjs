/**
 * p59-01 · 详情读口 no-store 的**运行实例**读数（dev 5788 · 真 socket）
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && env -u DATABASE_URL … node ../ops/item-detail/p59-01-dev-http-probe.mjs
 * （`@neondatabase/serverless` 从 backend-ts 解析；凭据只读 backend-ts/.env.local）
 *
 * 与 `p59-00-…gate.ts`（进程内 http.createServer(app) 临时端口）互补：本条打的是**面板托管的
 * dev 实例**（5788，前端实际消费的那个进程），因此同时证明「重启后人肉可达的这条链也改了」。
 * 三个数：`views` 逐次 +1 · 详情 `cache-control` 恒 `private, no-store` · feed 仍 public。
 * 读完把 `view_count` **回写复原**（探针只做产品自身行为的那一次自增）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const requireHere = createRequire(path.resolve(process.cwd(), 'package.json'));
const dotenv = requireHere('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const { neon } = requireHere('@neondatabase/serverless');

const BASE = process.env.P59_BASE || 'http://localhost:5788';
const OUT_DIR = path.resolve('..', 'ops', 'item-detail', 'readings');
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL);

const hit = async (url, headers = {}) => {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { url, status: res.status, cacheControl: res.headers.get('cache-control'), vary: res.headers.get('vary'), setCookie: res.headers.get('set-cookie'), json };
};

const main = async () => {
  const pidRow = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0];
  if (pidRow?.pid !== 'quiet-math-65207667') throw new Error(`STOP: not dev db (${pidRow?.pid})`);
  const row = (await sql`SELECT listing_id, view_count FROM public.listing ORDER BY listing_id LIMIT 1`)[0];
  const bID = Number(row.listing_id);
  const pre = Number(row.view_count);

  const detail = [];
  for (const n of [1, 2, 3]) {
    detail.push(await hit(`${BASE}/api/prize/${bID}`, { 'x-sf-viewer': `anon:p59-dev-${n}` }));
  }
  const feed = await hit(`${BASE}/api/prize/all?skip=0&limit=6`);
  const tasks = await hit(`${BASE}/api/task/all?skip=0&limit=6`);
  const home = await hit(`${BASE}/api/home?task_limit=2&prize_limit=2`);

  const viewsSeries = detail.map((r) => Number(r.json?.data?.views));
  const restored = (await sql`UPDATE public.listing SET view_count = ${pre} WHERE listing_id = ${bID} RETURNING view_count`)[0];

  const checks = [
    ['D1', 'dev 实例详情头 = private, no-store（3 次全同）· 不含 public/s-maxage/max-age',
      detail.every((r) => r.status === 200 && r.cacheControl === 'private, no-store' && !/public|s-maxage|max-age/i.test(String(r.cacheControl)))],
    ['D2', `views 逐次 +1（pre=${pre} ⇒ ${viewsSeries.join('→')}）`,
      viewsSeries.every((v, i) => v === pre + 1 + i)],
    ['D3', 'dev 实例 feed /api/prize/all 仍 public + s-maxage=30',
      /public/.test(String(feed.cacheControl)) && /s-maxage=30/.test(String(feed.cacheControl))],
    ['D4', 'dev 实例 /api/task/all 仍 public + s-maxage=30',
      /public/.test(String(tasks.cacheControl)) && /s-maxage=30/.test(String(tasks.cacheControl))],
    ['D5', 'dev 实例 /api/home 匿名仍 public + Vary: Authorization',
      /public/.test(String(home.cacheControl)) && /authorization/i.test(String(home.vary ?? ''))],
    ['D6', '探针自增已回写复原（view_count 读回 = 改前值）', Number(restored?.view_count) === pre],
  ].map(([id, what, pass]) => ({ id, what, pass: Boolean(pass) }));

  const out = {
    run: RUN, script: 'ops/item-detail/p59-01-dev-http-probe.mjs', base: BASE, at: new Date().toISOString(),
    env: { project_id: pidRow?.pid }, target: { bID, pre_views: pre, restored_views: Number(restored?.view_count) },
    headers: {
      detail: detail.map((r) => ({ status: r.status, cache_control: r.cacheControl, set_cookie: r.setCookie ?? null })),
      feed: { status: feed.status, cache_control: feed.cacheControl },
      tasks: { status: tasks.status, cache_control: tasks.cacheControl },
      home: { status: home.status, cache_control: home.cacheControl, vary: home.vary },
    },
    views_series: viewsSeries,
    checks,
    summary: { total: checks.length, passed: checks.filter((c) => c.pass).length, failed: checks.filter((c) => !c.pass).map((c) => c.id) },
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p59-dev-instance-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ saved: file, views_series: viewsSeries, headers: out.headers, summary: out.summary }, null, 1));
  if (out.summary.failed.length) process.exit(1);
};

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
