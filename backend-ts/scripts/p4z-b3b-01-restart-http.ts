// p4z-b3b-01-restart-http.ts — P4-B3b 收尾：面板单服务重启 + HTTP 面回归 + 服务端日志留证
// 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3b-01-restart-http.ts <outDir>
// 口径：① 重启只走面板 {sid} 路由（禁 pkill/killall）；② 重启后先等 /health 200；
//       ③ 注册点计数 = `src/index.ts` 内 `app.<method>(` 注册语句数（本片必须仍 = 53）；
//       ④ 产物不落 token/密钥本体；退出码直接取（不经管道）。
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const PANEL = process.env.SEAFOOD_PANEL || 'http://127.0.0.1:5555';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3b-run'));
fs.mkdirSync(outDir, { recursive: true });
const RUN = path.basename(outDir);

const get = async (url: string) => {
  try {
    const res = await fetch(url.startsWith('http') ? url : `${BASE}${url}`, {
      method: 'GET', headers: {}, signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    return { url, status: res.status, body_head: text.slice(0, 200) };
  } catch (e) {
    return { url, status: null, body_head: `FETCH_ERROR ${String(e).slice(0, 120)}` };
  }
};

const post = async (url: string, body: Record<string, unknown>) => {
  try {
    const res = await fetch(url.startsWith('http') ? url : `${BASE}${url}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90000),
    });
    const text = await res.text();
    return { url, status: res.status, body_head: text.slice(0, 200) };
  } catch (e) {
    return { url, status: null, body_head: `FETCH_ERROR ${String(e).slice(0, 120)}` };
  }
};

/** 服务端日志尾（面板只读口 `GET /api/logs/:sid?lines=N`）—— 401/403 必须同时看日志（纪律 ⑩） */
const logTail = async (lines: number) => {
  try {
    const res = await fetch(`${PANEL}/api/logs/seafood-api?lines=${lines}`, { signal: AbortSignal.timeout(20000) });
    const j = (await res.json()) as { ok?: boolean; text?: string };
    return { ok: res.status === 200, lines_returned: (j.text || '').split('\n').length, text: (j.text || '').slice(-6000) };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
};

const REG_PATTERN = /^app\.(get|post|put|delete|patch)\(/gm;
const countRegistrations = () => (fs.readFileSync(path.join(REPO, 'src', 'index.ts'), 'utf8').match(REG_PATTERN) || []).length;

const FACE_410: Array<[string, string, Record<string, unknown>]> = [
  ['auth/register', '/api/auth/register', {}],
  ['shard/redeem', '/api/shard/redeem', {}],
  ['chest/open', '/api/chest/1/open', {}],
  ['admin/prize/create', '/api/admin/prize/create', {}],
  ['admin/prize/update', '/api/admin/prize/update', {}],
  ['admin/prize/delete', '/api/admin/prize/delete', {}],
];

const sweep = async () => {
  const r: Record<string, unknown> = {};
  r.health = await get('/health');
  r.home = await get('/api/home');
  r.prize_all = await get('/api/prize/all');
  r.task_all = await get('/api/task/all');
  const face: Record<string, unknown> = {};
  for (const [name, url, body] of FACE_410) face[name] = await post(url, body);
  r.face_410 = face;
  r.face_410_all_410 = Object.values(face).every((v) => (v as { status: number | null }).status === 410);
  r.face_410_count = Object.keys(face).length;
  return r;
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), run: RUN, base: BASE, panel: PANEL };
  const results: Record<string, unknown> = {};
  results.registrations = countRegistrations();
  results.panel_self = await get(`${PANEL}/api/self`);
  results.pre = await sweep();
  results.pre_log_tail = await logTail(60);

  results.panel_restart = await post(`${PANEL}/api/restart`, { sid: 'seafood-api' });

  const t0 = Date.now();
  let healthy = false;
  for (let i = 0; i < 120; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const h = await get('/health');
    if (h.status === 200) { healthy = true; break; }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000));
  }
  results.health_200_after_restart = { ok: healthy, waited_ms: Date.now() - t0 };

  results.post = await sweep();
  results.post_log_tail = await logTail(60);
  results.readings_consistent = {
    health: (results.post as Record<string, Record<string, unknown>>).health.status === 200,
    home: (results.post as Record<string, Record<string, unknown>>).home.status === 200,
    prize_all: (results.post as Record<string, Record<string, unknown>>).prize_all.status === 200,
    task_all: (results.post as Record<string, Record<string, unknown>>).task_all.status === 200,
    face_410: (results.post as Record<string, unknown>).face_410_all_410,
  };

  out.results = results;
  fs.writeFileSync(path.join(outDir, 'b3b-01-http.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3b-01-http.json'));
  console.log('registrations=' + results.registrations);
  console.log('panel_restart=' + JSON.stringify(results.panel_restart));
  console.log('health_200_after_restart=' + JSON.stringify(results.health_200_after_restart));
  console.log('pre=' + JSON.stringify(results.pre));
  console.log('post=' + JSON.stringify(results.post));
  console.log('readings_consistent=' + JSON.stringify(results.readings_consistent));
  console.log('post_log_tail_lines=' + JSON.stringify((results.post_log_tail as { lines_returned?: number }).lines_returned));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
