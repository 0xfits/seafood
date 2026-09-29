// p4z-b3afix2-05-restart-http.ts — P4-B3a-FIX-A2 收尾：面板单服务重启 + HTTP 面回归
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix2-05-restart-http.ts <outDir>
// 口径：重启只走面板 {sid} 路由（禁 pkill/killall）；token 用 .env.local 的 SECRET_KEY 经 src/auth 真签名；
//       产物只落 token 指纹（sha256 前 12 位）。退出码直接取，不经管道。
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const PANEL = process.env.SEAFOOD_PANEL || 'http://127.0.0.1:5555';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix2-run'));
fs.mkdirSync(outDir, { recursive: true });
const RUN = path.basename(outDir);

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sql = neon(String(process.env.DATABASE_URL || ''));
const auth = require(path.join(REPO, 'src', 'auth')) as { createSessionToken: (p: { uID: number; evm: string }) => string };
const fp12 = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);

const get = async (url: string, token?: string) => {
  try {
    const res = await fetch(url.startsWith('http') ? url : `${BASE}${url}`, {
      method: 'GET',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let code: string | null = null;
    try { code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? null; } catch { /* non-json */ }
    return { url, status: res.status, error_code: code, body_head: text.slice(0, 140) };
  } catch (e) {
    return { url, status: null, error_code: null, body_head: `FETCH_ERROR ${String(e).slice(0, 120)}` };
  }
};

const post = async (url: string, body: Record<string, unknown>, token?: string) => {
  try {
    const res = await fetch(url.startsWith('http') ? url : `${BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const text = await res.text();
    let code: string | null = null;
    try { code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? null; } catch { /* non-json */ }
    return { url, status: res.status, error_code: code, body_head: text.slice(0, 240) };
  } catch (e) {
    return { url, status: null, error_code: null, body_head: `FETCH_ERROR ${String(e).slice(0, 160)}` };
  }
};

const health = async () => (await get('/health')).status;

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), run: RUN, base: BASE, panel: PANEL };
  const results: Record<string, unknown> = {};
  results.panel_self_before = await get(`${PANEL}/api/self`);
  results.panel_status_seafood_before = await get(`${PANEL}/api/status`);

  // ---- A. 重启前：非资金面回归 ----
  results.pre_health = await get('/health');
  results.pre_home = await get('/api/home');
  results.pre_410_register = await post('/api/auth/register', {});

  // ---- B. 面板单服务重启（{sid}）----
  results.panel_restart = await post(`${PANEL}/api/restart`, { sid: 'seafood-api' });

  // ---- C. 等 /health 200 ----
  const t0 = Date.now();
  let ok = false;
  for (let i = 0; i < 90; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if ((await health()) === 200) { ok = true; break; }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000));
  }
  results.post_restart_health = { status_200: ok, waited_ms: Date.now() - t0 };
  results.panel_status_seafood_after = await get(`${PANEL}/api/status`);

  // ---- D. 重启后：非资金面回归 + 真 token 业务端点 ----
  results.post_health = await get('/health');
  results.post_home = await get('/api/home');
  results.post_410_register = await post('/api/auth/register', {});

  const users = (await sql(`SELECT uid::text AS uid, evm FROM public."users" WHERE uid = 970001`)) as Array<{ uid: string; evm: string }>;
  if (users.length) {
    const t = auth.createSessionToken({ uID: Number(users[0].uid), evm: users[0].evm });
    results.token_fp12 = fp12(t);
    results.token_len = t.length;
    results.post_business_user_asset = await get(`/api/user/asset/${users[0].uid}`, t);
    results.post_business_shard = await get('/api/shard', t);
    results.post_business_order = await get('/api/order', t);
  } else {
    results.post_business = 'NO_USER_970001';
  }

  out.results = results;
  fs.writeFileSync(path.join(outDir, 'b3afix2-05-http.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3afix2-05-http.json'));
  for (const [k, v] of Object.entries(results)) console.log(`${k} :: ${JSON.stringify(v).slice(0, 230)}`);
};

main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
