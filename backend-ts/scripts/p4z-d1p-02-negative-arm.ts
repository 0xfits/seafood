/*
 * p4z-d1p-02-negative-arm.ts — D1' **负向臂实测**（临时 API 实例 + 不可达数据库）
 * ============================================================================
 * 口径（逐字执行本单 §3）：
 *   · 临时实例 = **非面板端口** `5799`，env 里把**所有**库相关变量（`*DATABASE_URL*` / `*POSTGRES*`）
 *     从子进程环境里**摘掉**后换成不可达目标（`127.0.0.1:1`）⇒ 子进程**不可能**碰真库；
 *   · 三个面都要测：① 会碰库的**读**端点；② `/api/auth/verify`（**不得 401**）；③ `/api/health`；
 *   · 另附**对照**：真鉴权失败（无 token / 坏签名）仍须 **401**；以及 4 个「catch 硬编码 500、
 *     不接分类器」的读面读数（本单范围外的诚实登记，不隐藏）。
 *   · 收尾：按**精确 PID**（`process.kill(pid, SIGTERM→SIGKILL)`）关掉自己的临时实例；
 *     **禁用** `pkill -f` / `killall`。never touches the panel-managed service.
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-d1p-02-negative-arm.ts
 * 产物：.p4-artifacts/p6d1p-<ts>/negative-arm.json；退出码取自脚本自身（不经管道）。
 */
import '../src/env'; // 只为拿到 SECRET_KEY（现铸 token）；下面 spawn 时会把库变量全部抹掉/替换
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { spawn, type ChildProcess } from 'child_process';

/* eslint-disable @typescript-eslint/no-var-requires */
const { Wallet } = require('ethers');

const REPO = path.resolve(__dirname, '..');
const PORT = 5799;
const BASE = `http://127.0.0.1:${PORT}`;
const BOGUS_DB = 'postgresql://d1p_nodb:redacted@127.0.0.1:1/nonexistent';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', `p6d1p-${stamp}`));
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'negative-arm-server.log');

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const SECRET = String(process.env.SECRET_KEY || '');
const jwt = (uid: number) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xd1p${String(uid).padStart(4, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};

type Call = { status: number | string; code: string | null; reason: string | null; top: string[]; body: string; json: unknown };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}): Promise<Call> => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
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
      body: text.slice(0, 400),
      json,
    };
  } catch (e) {
    return { status: 'NETERR', code: null, reason: null, top: [], body: String(e).slice(0, 200), json: null };
  }
};

const results: Record<string, unknown> = {
  run: path.basename(outDir), engine: 'p4z-d1p-02-negative-arm', temp_port: PORT,
  db_target: 'unreachable (127.0.0.1:1) — 子进程 env 里所有 *DATABASE_URL*/*POSTGRES* 键被摘除后替换为该值（不回显任何真值）',
  secret_fingerprint: SECRET ? crypto.createHash('sha256').update(SECRET).digest('hex').slice(0, 12) : null,
  tests: {},
};
const tests = results.tests as Record<string, unknown>;
const say = (id: string, c: Call, extra: Record<string, unknown> = {}) => {
  const row = { status: c.status, code: c.code, reason: c.reason, top_keys: c.top, body: c.body, ...extra };
  tests[id] = row;
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: reason=${String(c.reason)} :: body=${c.body.slice(0, 220)}`);
  return row;
};

const waitHttp = async (tries = 60): Promise<boolean> => {
  for (let i = 0; i < tries; i += 1) {
    try {
      await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  return false;
};

(async () => {
  if (!SECRET) { console.log('FATAL NO_SECRET_KEY (无法现铸 token；不发任何读数)'); process.exitCode = 1; return; }
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string') continue;
    if (/DATABASE_URL|POSTGRES/i.test(k)) continue; // 摘除全部库变量（含 jinli_*/SF_* 变体）
    childEnv[k] = v;
  }
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING']) childEnv[k] = BOGUS_DB;
  delete childEnv.VERCEL;
  childEnv.PORT = String(PORT);

  const log = fs.openSync(logFile, 'w');
  const child: ChildProcess = spawn(path.join(REPO, 'node_modules', '.bin', 'ts-node'), ['--transpile-only', 'src/index.ts'], {
    cwd: REPO, env: childEnv, stdio: ['ignore', log, log],
  });
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
  // ============================================================ ① 会碰库的读端点
  say('R1_get_user_read', await call('GET', '/api/user', { token: T }), { expect: '503（requireActor ⇒ infra 面；**不得** 401/500）' });
  say('R2_get_prize_item_read', await call('GET', '/api/prize-item', { token: T }), { expect: '503' });
  say('R3_get_pending_verification_read', await call('GET', '/api/tasklist/pending-verification?limit=1', { token: T }), { expect: '503（requireAdmin ⇒ requireActor 同族）' });

  // ============================================================ ② /api/auth/verify（★ 不得 401）
  say('A0_get_user_no_token_401', await call('GET', '/api/user'), { expect: '401（真鉴权失败：无 token —— **401 面仍在**）' });
  const w = Wallet.createRandom();
  const ch1 = await call('POST', '/api/auth/challenge', { body: { evm_address: w.address } });
  say('A1_post_auth_challenge', ch1, { expect: '200（不碰库 ⇒ 不受 DB 不可达影响）' });
  const c1 = ch1.json as { data?: { message?: string; challenge_token?: string } } | null;
  const msg1 = String(c1?.data?.message ?? '');
  const ct1 = String(c1?.data?.challenge_token ?? '');
  say('A2_verify_bad_signature_401', await call('POST', '/api/auth/verify', { body: { evm_address: w.address, signature: '0x' + '11'.repeat(65), challenge_token: ct1 } }), { expect: '401（真鉴权失败：EIP-191 恢复不符 —— **401 面仍在**）' });

  const w2 = Wallet.createRandom();
  const ch2 = await call('POST', '/api/auth/challenge', { body: { evm_address: w2.address } });
  const c2 = ch2.json as { data?: { message?: string; challenge_token?: string } } | null;
  const msg2 = String(c2?.data?.message ?? '');
  const ct2 = String(c2?.data?.challenge_token ?? '');
  const sig2 = await w2.signMessage(msg2);
  say('A3_verify_valid_signature_db_unreachable', await call('POST', '/api/auth/verify', { body: { evm_address: w2.address, signature: sig2, challenge_token: ct2 } }), {
    expect: '503 + 机读 reason（★ 核心断言：**不得 401**）', challenge_ok: Boolean(msg2 && ct2), signature_recovered: true,
  });
  say('A4_verify_login_alias_same_handler', await call('POST', '/api/auth/login', { body: { evm_address: w2.address, signature: sig2, challenge_token: ct2 } }), { expect: '同 handler（401/503 同 A3 口径；nonce 已消费 ⇒ 401 属预期）' });

  // ============================================================ ③ /api/health
  say('H1_health', await call('GET', '/api/health'), { expect: '503（健康探针：库不可达）' });
  say('H2_health_alias', await call('GET', '/health'), { expect: '503（同一 handler）' });

  // ============================================================ 登记：硬编码 500 的读面（本单范围外，诚实登记）
  say('X1_get_task_all_public_read', await call('GET', '/api/task/all?limit=1'), { expect: '本单**范围外**：该 catch 硬编码 `sendError(500)`、不接分类器', out_of_scope: true });
  say('X2_get_user_asset_public_read', await call('GET', '/api/user/asset/1'), { expect: '本单**范围外**：同上（硬编码 500）', out_of_scope: true });
  say('X3_get_home_mixed', await call('GET', '/api/home?task_limit=1&prize_limit=1'), { expect: '本单**范围外**：同上（硬编码 500）', out_of_scope: true });
  say('X4_post_claim_deprecated', await call('POST', '/api/task-progress/claim/1'), { expect: '410 弃用面（不碰库 ⇒ 不受影响）', out_of_scope: true });

  // ============================================================ 收尾：精确 PID
  try { if (pid) process.kill(pid, 'SIGTERM'); } catch (e) { console.log('SIGTERM_NOTE ' + String(e).slice(0, 80)); }
  const died = await new Promise<boolean>((resolve) => {
    const to = setTimeout(() => resolve(false), 5000);
    child.once('exit', () => { clearTimeout(to); resolve(true); });
  });
  if (!died && pid) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* noop */ }
  }
  await new Promise((r) => setTimeout(r, 800));
  const after = await call('GET', '/');
  results.shutdown = { pid, sigterm_ok: died, sigkill_used: !died, port_closed: after.status === 'NETERR', probe_after: after.status };
  console.log(`SHUTDOWN pid=${String(pid)} sigterm_ok=${died} sigkill_used=${!died} port_closed=${after.status === 'NETERR'}`);
  results.finished = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'negative-arm.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`ARTIFACT=${path.join(outDir, 'negative-arm.json')}`);

  const R = tests as Record<string, { status: number | string }>;
  const must503 = ['R1_get_user_read', 'R2_get_prize_item_read', 'R3_get_pending_verification_read', 'A3_verify_valid_signature_db_unreachable', 'H1_health', 'H2_health_alias'];
  const must401 = ['A0_get_user_no_token_401', 'A2_verify_bad_signature_401'];
  const bad503 = must503.filter((k) => R[k]?.status !== 503);
  const bad401 = must401.filter((k) => R[k]?.status !== 401);
  const a3_is_401 = R.A3_verify_valid_signature_db_unreachable?.status === 401;
  console.log(`NEGATIVE_ARM_SUMMARY must503=${must503.length - bad503.length}/${must503.length} not503=${JSON.stringify(bad503)} must401=${must401.length - bad401.length}/${must401.length} not401=${JSON.stringify(bad401)} a3_401_violation=${a3_is_401}`);
  if (bad503.length || bad401.length) process.exitCode = 1;
})().catch((e) => { console.log(`FATAL ${String(e)}`); process.exitCode = 1; });
