/*
 * p4z-d1p-04-sweep-negative-arm.ts — BE-ERR503-SWEEP **负向臂复跑（全族）**
 * ============================================================================
 * 与 `p4z-d1p-02-negative-arm.ts` **同法**（临时实例 + 不可达库 + 精确 PID 收尾），把 D1' 单
 * 登记为「范围外」的 4 面 **加上** 本单新扫出的每一面**逐面给状态码**：
 *   · 临时实例 = **非面板端口** `5799`；子进程 env 里**全部** `*DATABASE_URL*` / `*POSTGRES*` 键
 *     先被摘除、再统一置为不可达目标 `127.0.0.1:1`（真值一律不回显、不落盘）；`VERCEL` 剔除；
 *   · 断言表：`must503`（DB/传输类 ⇒ 分类器面）/ `must401`（真凭据失败对照组**仍在**）/
 *     `must410`（弃用面不动）；
 *   零 IO 面（`/api/shard*`）单列：其 catch **未被本单改动**，503 来自既有 `requireActor` 前置（实测更正预判）。
 *   · 收尾：**按精确 PID** `SIGTERM`（超时未死才 `SIGKILL`）；**禁用** `pkill -f` / `killall`；
 *     面板托管服务全程未动。
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-d1p-04-sweep-negative-arm.ts
 * 产物：.p4-artifacts/p6d1p-sweep-<ts>/negative-arm.json；退出码取自脚本自身（不经管道）。
 */
import '../src/env'; // 只为拿 SECRET_KEY（现铸 token）；spawn 时把库变量全部抹掉/替换
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
/* eslint-disable @typescript-eslint/no-var-requires */
const { Wallet } = require('ethers');

const REPO = path.resolve(__dirname, '..');
const PORT = 5799;
const BASE = `http://127.0.0.1:${PORT}`;
const BOGUS_DB = 'postgresql://sweep_nodb:***@127.0.0.1:1/nonexistent';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', `p6d1p-sweep-${stamp}`));
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'negative-arm-server.log');

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const SECRET = String(process.env.SECRET_KEY || '');
const jwt = (uid: number) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xsweep${String(uid).padStart(3, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};

type Call = { status: number | string; code: string | null; reason: string | null; top: string[]; body: string };
const call = async (method: string, p: string, opts: { token?: string; secret?: boolean; body?: unknown } = {}): Promise<Call> => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.secret) headers.Authorization = `Bearer ${String(process.env.CRON_SECRET || '')}`; // 值从不打印/落盘
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    const j = json as { error?: { code?: string; details?: { reason?: string } }; details?: { reason?: string } } | null;
    return {
      status: res.status,
      code: j?.error?.code ?? null,
      reason: j?.error?.details?.reason ?? j?.details?.reason ?? null,
      top: json && typeof json === 'object' ? Object.keys(json) : [],
      body: text.slice(0, 300),
    };
  } catch (e) {
    return { status: 'NETERR', code: null, reason: null, top: [], body: String(e).slice(0, 160) };
  }
};

const results: Record<string, unknown> = {
  run: path.basename(outDir), engine: 'p4z-d1p-04-sweep-negative-arm', temp_port: PORT,
  db_target: 'unreachable (127.0.0.1:1) — 子进程 env 里所有 *DATABASE_URL*/*POSTGRES* 键被摘除后替换为该值（不回显任何真值）',
  secret_fingerprint: SECRET ? crypto.createHash('sha256').update(SECRET).digest('hex').slice(0, 12) : null,
  cron_secret_present: Boolean(String(process.env.CRON_SECRET || '').trim()),
  tests: {},
};
const tests = results.tests as Record<string, { status: number | string; expect: string }>;
const say = (id: string, c: Call, expect: string, extra: Record<string, unknown> = {}) => {
  tests[id] = { status: c.status, code: c.code, reason: c.reason, top_keys: c.top, body: c.body, expect, ...extra };
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: reason=${String(c.reason)} :: ${c.body.slice(0, 170)}`);
};

const waitHttp = async (tries = 60): Promise<boolean> => {
  for (let i = 0; i < tries; i += 1) {
    try { await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) }); return true; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  return false;
};

(async () => {
  if (!SECRET) { console.log('FATAL NO_SECRET_KEY (无法现铸 token；不发任何读数)'); process.exitCode = 1; return; }
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string') continue;
    if (/DATABASE_URL|POSTGRES/i.test(k)) continue;
    childEnv[k] = v;
  }
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']) childEnv[k] = BOGUS_DB;
  delete childEnv.VERCEL;
  childEnv.PORT = String(PORT);

  const log = fs.openSync(logFile, 'w');
  const child: ChildProcess = spawn(path.join(REPO, 'node_modules', '.bin', 'ts-node'), ['--transpile-only', 'src/index.ts'], { cwd: REPO, env: childEnv, stdio: ['ignore', log, log] });
  const pid = child.pid ?? null;
  results.temp_pid = pid;
  console.log(`TEMP_INSTANCE pid=${String(pid)} port=${PORT} log=${logFile}`);
  const up = await waitHttp();
  results.temp_up = up;
  if (!up) {
    console.log('FATAL temp instance did not come up');
    try { if (pid) process.kill(pid, 'SIGKILL'); } catch { /* noop */ }
    fs.writeFileSync(path.join(outDir, 'negative-arm.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
    process.exitCode = 1;
    return;
  }

  const T = jwt(1);
  // ---------------------------------------------------------------- must503：DB/传输类（含本单改的 catch）
  const probes: Array<[string, () => Promise<Call>, string]> = [
    ['S01_get_task_all', () => call('GET', '/api/task/all?limit=1'), '修前 X1 = 500 ⇒ 期望 503（DB 读）'],
    ['S02_get_prize_all', () => call('GET', '/api/prize/all?limit=1'), '修前 500 ⇒ 期望 503（DB 读）'],
    ['S03_get_home', () => call('GET', '/api/home?task_limit=1&prize_limit=1'), '修前 X3 = 500 ⇒ 期望 503（DB 读）'],
    ['S04_get_user_asset', () => call('GET', '/api/user/asset/1'), '修前 X2 = 200（`database.ts` 吞成假空态）⇒ 期望 503'],
    ['S05_get_task_detail', () => call('GET', '/api/task/1'), '修前 500 ⇒ 期望 503'],
    ['S06_get_prize_detail', () => call('GET', '/api/prize/1'), '修前 500 ⇒ 期望 503'],
    ['S07_get_task_progress_detail', () => call('GET', '/api/task-progress/1'), '修前 500 ⇒ 期望 503'],
    ['S08_get_orderbook', () => call('GET', '/api/market/1/orderbook'), '修前 500 ⇒ 期望 503'],
    ['S09_get_trades', () => call('GET', '/api/market/1/trades'), '修前 500 ⇒ 期望 503'],
    ['T01_get_user', () => call('GET', '/api/user', { token: T }), '既有 503（requireActor；**不得 401/500**）'],
    ['T02_get_prize_item', () => call('GET', '/api/prize-item', { token: T }), '既有 503'],
    ['T03_get_task_progress_list', () => call('GET', '/api/task-progress', { token: T }), '修前 500 ⇒ 期望 503'],
    ['T04_get_order_list', () => call('GET', '/api/order', { token: T }), '修前 500 ⇒ 期望 503'],
    ['T05_get_admin_settings', () => call('GET', '/api/admin/settings', { token: T }), '修前 500 ⇒ 期望 503'],
    ['T06_get_admin_permissions', () => call('GET', '/api/admin/permissions', { token: T }), '修前 500（且 `getAllUsers` 吞成空列表）⇒ 期望 503'],
    ['T07_get_user_all', () => call('GET', '/api/user/all', { token: T }), '修前 500 ⇒ 期望 503'],
    ['T08_get_user_stats', () => call('GET', '/api/user/stats', { token: T }), '修前 500 ⇒ 期望 503'],
    ['T09_get_pending_count', () => call('GET', '/api/tasklist/pending-verification/count', { token: T }), '修前 500 ⇒ 期望 503'],
    ['T10_get_pending_list', () => call('GET', '/api/tasklist/pending-verification?limit=1', { token: T }), '既有 503（修前 R3 实测）'],
    ['T11_post_user_profile', () => call('POST', '/api/user/profile', { token: T, body: { bio: 'sweep' } }), '修前 500 ⇒ 期望 503（requireActor 前置）'],
    ['T12_post_task_progress_submit', () => call('POST', '/api/task-progress/1/submit', { token: T, body: { info_input: 'sweep' } }), '修前 500 ⇒ 期望 503（requireActor 前置）'],
  ];
  for (const [id, fn, expect] of probes) say(id, await fn(), expect);

  // ---------------------------------------------------------------- ★ /api/auth/verify：不得 401
  const w = Wallet.createRandom();
  const challenge = async (addr: string) => {
    const r = await fetch(`${BASE}/api/auth/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evm_address: addr }) });
    return { status: r.status, json: (await r.json()) as { data?: { message?: string; challenge_token?: string } } };
  };
  const cA = await challenge(w.address);
  say('A1_post_auth_challenge', { status: cA.status, code: null, reason: null, top: [], body: `status=${cA.status}` }, '200（不碰库 ⇒ 不受 DB 不可达影响）', { has_message: Boolean(cA.json?.data?.message), has_challenge_token: Boolean(cA.json?.data?.challenge_token) });
  say('A2_post_auth_verify_bad_signature', await call('POST', '/api/auth/verify', { body: { evm_address: w.address, signature: '0x' + '11'.repeat(65), challenge_token: String(cA.json?.data?.challenge_token ?? '') } }), '**401**（真凭据失败对照组必须仍在）');

  const w2 = Wallet.createRandom();
  const cB = await challenge(w2.address);
  const sig2 = await w2.signMessage(String(cB.json?.data?.message ?? ''));
  say('A3_post_auth_verify_valid_sig', await call('POST', '/api/auth/verify', { body: { evm_address: w2.address, signature: sig2, challenge_token: String(cB.json?.data?.challenge_token ?? '') } }), '503 + 机读 reason（★ 核心断言：**不得 401**）', { challenge_ok: Boolean(cB.json?.data?.message && cB.json?.data?.challenge_token), signature_recovered: true });
  say('A4_post_auth_login_alias', await call('POST', '/api/auth/login', { body: { evm_address: w2.address, signature: sig2, challenge_token: String(cB.json?.data?.challenge_token ?? '') } }), '**401**（同一 handler 复用；nonce 已由 A3 消费 ⇒ 真凭据失败）');

  // ---------------------------------------------------------------- 健康探针
  say('H1_health', await call('GET', '/api/health'), '503（健康探针：库不可达）');
  say('H2_health_alias', await call('GET', '/health'), '503（同一 handler）');

  // ---------------------------------------------------------------- 对照：无 token ⇒ 401（面仍在）
  say('C01_get_user_no_token', await call('GET', '/api/user'), '**401**（无 token）');
  say('C02_get_prize_item_no_token', await call('GET', '/api/prize-item'), '**401**（无 token）');
  say('C03_get_admin_settings_no_token', await call('GET', '/api/admin/settings'), '**401**（无 token）');

  // ------------------------------------------- 零 IO 面（其 catch 未被本单改动；503 来自 requireActor 前置）
  // 诚实更正：修前预判「恒空态 ⇒ 200」**错了** —— 实测经 `requireActor`（会碰库）⇒ 503。
  // 该 503 由既有 `requireActor` 分流产出，与本单未改的 catch 无关；两侧 catch 仍**保留 500**（零 IO ⇒ 只可能见代码缺陷）。
  say('K01_get_shard_zero_io', await call('GET', '/api/shard', { token: T }), '503（requireActor 前置的 infra 分流；其 catch 零 IO ⇒ 未被本单改动）');
  say('K02_get_shard_transfer_zero_io', await call('GET', '/api/shard/transfer', { token: T }), '503（同上；其 catch 零 IO ⇒ 未被本单改动）');

  // ---------------------------------------------------------------- must410：弃用面不动
  say('G01_post_claim_deprecated', await call('POST', '/api/task-progress/claim/1'), '410（弃用面不碰库 ⇒ 不受影响）');

  // ---------------------------------------------------------------- translate.backfill（按 CRON_SECRET 分口径）
  if (String(process.env.CRON_SECRET || '').trim()) {
    say('B01_post_translate_backfill', await call('POST', '/api/translate/backfill', { secret: true, body: { mode: 'scan' } }), '503（本单改的 catch ⇒ 分类器）；secret 值只作 header，不回显');
  } else {
    say('B01_post_translate_backfill', await call('POST', '/api/translate/backfill', { body: { mode: 'scan' } }), '503（`CRON_SECRET not configured` 守卫面 ⇒ 该面分类器路径 **NOT_MEASURED**）', { guard_face: true });
  }

  // ---------------------------------------------------------------- 收尾：精确 PID
  try { if (pid) process.kill(pid, 'SIGTERM'); } catch (e) { console.log('SIGTERM_NOTE ' + String(e).slice(0, 80)); }
  const died = await new Promise<boolean>((resolve) => {
    const to = setTimeout(() => resolve(false), 5000);
    child.once('exit', () => { clearTimeout(to); resolve(true); });
  });
  if (!died && pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* noop */ } }
  await new Promise((r) => setTimeout(r, 800));
  const after = await call('GET', '/');
  results.shutdown = { pid, sigterm_ok: died, sigkill_used: !died, port_closed: after.status === 'NETERR', probe_after: after.status };
  console.log(`SHUTDOWN pid=${String(pid)} sigterm_ok=${died} sigkill_used=${!died} port_closed=${after.status === 'NETERR'}`);

  const ids = Object.keys(tests);
  const must503Ids = ids.filter((k) => /^(S0[1-9]|T0[1-9]|T1[0-2]|H[12]_|B01_|K0[12]_)/.test(k));
  const must401Ids = ids.filter((k) => /^(C0[1-3]|A2_|A4_)/.test(k));
  const must410Ids = ids.filter((k) => /^G01_/.test(k));
  const bad = (list: string[], want: number) => list.filter((k) => tests[k]?.status !== want);
  const r = { must503: bad(must503Ids, 503), must401: bad(must401Ids, 401), must410: bad(must410Ids, 410) };
  const summary = {
    must503: `${must503Ids.length - r.must503.length}/${must503Ids.length}`, must401: `${must401Ids.length - r.must401.length}/${must401Ids.length}`,
    must410: `${must410Ids.length - r.must410.length}/${must410Ids.length}`,
    a3_401_violation: tests.A3_post_auth_verify_valid_sig?.status === 401,
    failed: r,
  };
  results.summary = summary;
  results.finished = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'negative-arm.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`NEGATIVE_ARM_SUMMARY must503=${summary.must503} must401=${summary.must401} must410=${summary.must410} a3_401_violation=${summary.a3_401_violation} failed=${JSON.stringify(r)}`);
  console.log(`ARTIFACT=${path.join(outDir, 'negative-arm.json')}`);
  if (r.must503.length || r.must401.length || r.must410.length) process.exitCode = 1;
})().catch((e) => { console.log(`FATAL ${String(e)}`); process.exitCode = 1; });
