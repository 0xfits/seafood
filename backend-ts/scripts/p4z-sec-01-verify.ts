// p4z-sec-01-verify.ts — P4-SEC 验读脚本（HTTP 探针 + 分类器对拍 + fail-fast 实证 + 503 E2E）
// ============================================================================
// 只读：不发任何写请求（除面板重启由外部命令单独执行）。
// 口径（§5.7）：
//   · 真 token 用**生产签名器** `src/auth.createSessionToken` 铸（dynamic require **在** env 装载之后，
//     以确保 `src/auth` 的模块期 `resolveSecretKey()` 看到的是真密钥）；
//   · 兑底常量 token 由本脚本**逐字复刻** auth.ts 的 HS256 签名（HMAC-SHA256 + base64url，同上）；
//   · 产物**不落 token/key 本体**，只落 sha256 前 12 位指纹（§5.7⑦：grep -c 'e[y]J' == 0）；
//   · 退出码**直接取**（不经管道）。
// 用法：ts-node --transpile-only scripts/p4z-sec-01-verify.ts <outDir> <pre|post>
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';

const REPO = path.resolve(__dirname, '..');
const LIVE_BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const FALLBACK_KEY = 'your-secret-key-here';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'sec-run'));
const PHASE = process.argv[3] || 'post';
fs.mkdirSync(outDir, { recursive: true });

const fp = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);
const nowIso = () => new Date().toISOString();

// ---- 与 src/env.ts 同口径装载 .env.local（只进 process.env，不写盘、不打印值）----
const loadEnvLocal = () => {
  const p = path.join(REPO, '.env.local');
  if (!fs.existsSync(p)) return false;
  for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
  return true;
};

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
/** 逐字复刻 src/auth.ts 的 signToken（HS256 + base64url） */
const signToken = (key: string, payload: Record<string, unknown>) => {
  const unsigned = `${b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64u(JSON.stringify(payload))}`;
  return `${unsigned}.${crypto.createHmac('sha256', key).update(unsigned).digest('base64url')}`;
};

interface Call { name: string; method: string; url: string; auth?: string; expect: number }
const call = async (c: Call) => {
  const headers: Record<string, string> = {};
  if (c.auth !== undefined) headers.Authorization = c.auth;
  const res = await fetch(c.url, { method: c.method, headers, redirect: 'manual' });
  const text = await res.text();
  let code: string | null = null;
  try { code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? null; } catch { /* non-JSON */ }
  return {
    name: c.name, method: c.method, url: c.url, expect: c.expect, status: res.status,
    pass: res.status === c.expect, error_code: code, body_head: text.slice(0, 220),
    auth_kind: c.auth === undefined ? 'none' : 'bearer(token)',
  };
};

const runHttp = async (checks: Call[]) => {
  const out = [];
  for (const c of checks) out.push(await call(c));
  return out;
};

/** 起一个「DB 指向不可达且密钥正确」的受控实例，实测 HTTP 层 503 分类（不用真断开生产库） */
const runInfraE2E = async (envKey: string, uid: number, evm: string, tokenEnv: string, tokenFallback: string) => {
  const PORT = 5799;
  const env = { ...process.env } as Record<string, string>;
  env.PORT = String(PORT);
  env.SECRET_KEY = envKey;
  // 故意指向本机一个必然拒连的端口 —— 保持 `.env.local` 原文不动（dotenv 不覆盖已注入变量）
  env.DATABASE_URL = 'postgresql://p4sec:p4sec@127.0.0.1:1/p4sec_none';
  env.DATABASE_URL_UNPOOLED = 'postgresql://p4sec:p4sec@127.0.0.1:1/p4sec_none';
  const logs: string[] = [];
  const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));

  const base = `http://127.0.0.1:${PORT}`;
  let ready = false;
  for (let i = 0; i < 60 && !ready; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`${base}/health`); ready = r.status > 0; } catch { /* not up yet */ }
  }

  const probe = async (name: string, auth?: string) => {
    try {
      const res = await fetch(`${base}/api/user`, { headers: auth ? { Authorization: auth } : {} });
      const text = await res.text();
      let code: string | null = null;
      try { code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? null; } catch { /* */ }
      return { name, ready, status: res.status, error_code: code, body_head: text.slice(0, 200) };
    } catch (e) {
      return { name, ready, status: null, error: String(e).slice(0, 160) };
    }
  };
  const results = [
    await probe('legal-token-with-unreachable-DB', `Bearer ${tokenEnv}`),
    await probe('public-placeholder-token-with-unreachable-DB', `Bearer ${tokenFallback}`),
  ];
  const pid = child.pid;
  child.kill('SIGTERM');
  await new Promise((r) => child.once('exit', r));
  return { port: PORT, child_pid: pid, ready, results, logs_tail: logs.join('').split('\n').slice(-25).join('\n') };
};

/** fail-fast 实证：把 src/tsconfig 拷到产物目录（**不碰 .env.local**），在无 SECRET_KEY 环境下启动 */
const runFailFast = async () => {
  const root = path.join(outDir, 'failfast');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(path.join(REPO, 'src'), path.join(root, 'src'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'tsconfig.json'), path.join(root, 'tsconfig.json'));
  try { fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules')); } catch { /* exists */ }
  const copyState = {
    has_env_local: fs.existsSync(path.join(root, '.env.local')),
    has_env: fs.existsSync(path.join(root, '.env')),
  };

  const launch = (label: string, envExtra: Record<string, string>) => new Promise<{
    label: string; code: number | null; signal: string | null; output: string;
  }>((resolve) => {
    const env = { ...process.env } as Record<string, string>;
    delete env.SECRET_KEY;
    Object.assign(env, envExtra);
    const chunks: string[] = [];
    const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => chunks.push(String(d)));
    child.stderr.on('data', (d) => chunks.push(String(d)));
    const settle = (code: number | null, signal: string | null) => {
      if (child.exitCode === null && signal === null) child.kill('SIGKILL');
      resolve({ label, code, signal, output: chunks.join('') });
    };
    child.on('exit', (code, signal) => settle(code, signal));
    // 8s 看守：控制组（有密钥）预期不会退出，超时后按见证结果收尾
    setTimeout(() => settle(child.exitCode, null), 8000);
  });

  const missing = await launch('no_SECRET_KEY', { PORT: '5798' });
  const control = await launch('control_with_SECRET_KEY', {
    SECRET_KEY: process.env.SECRET_KEY || '',
    PORT: '5798',
    DATABASE_URL: 'postgresql://p4sec:p4sec@127.0.0.1:1/p4sec_none',
  });
  return {
    copy_root: root, copy_state: copyState,
    missing_secret_key: { ...missing, output: missing.output.slice(0, 600) },
    control: { ...control, output: control.output.split('\n').slice(-12).join('\n').slice(0, 600) },
    missing_exit_nonzero: missing.code !== null && missing.code !== 0,
    missing_is_fatal_error: /\[FATAL\] SECRET_KEY is not set/.test(missing.output),
    control_has_no_fatal: !/\[FATAL\]/.test(control.output),
  };
};

/** 分类器对拍（内存合成，不碰真库） */
const runClassifier = (uid: number, evm: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const le = require(path.join(REPO, 'src', 'ledger-errors')) as {
    normalizeLedgerError: (e: unknown) => { code: string; httpStatus: number; details: Record<string, unknown> };
    toErrorResponse: (e: unknown) => { error: { code: string } };
    ledgerErrorDiagnostics: (e: unknown) => { non_pg_class: string | null; error_name: string };
  };

  const synth: Array<{ name: string; err: unknown; expect: number }> = [];
  // ① 真 `ConnectTimeoutError`（若该版本导出）——Neon 连接超时的**真类**
  let realCtUsed = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const neo = require('@neondatabase/serverless') as Record<string, unknown>;
    const Ct = neo.ConnectTimeoutError as (new () => Error) | undefined;
    if (typeof Ct === 'function') {
      const e = new Ct();
      synth.push({ name: 'NeonConnectTimeoutError(real-class)', err: e, expect: 503 });
      realCtUsed = true;
    }
  } catch { /* ignore */ }
  synth.push({
    name: 'ConnectTimeoutError(shape-synth)',
    err: Object.assign(new Error('timeout exceeded when trying to connect'), { name: 'ConnectTimeoutError' }),
    expect: 503,
  });
  synth.push({
    name: 'NeonDbError(53300 too_many_connections)',
    err: Object.assign(new Error('remaining connection slots are reserved'), { name: 'NeonDbError', code: '53300' }),
    expect: 503,
  });
  synth.push({
    name: 'NeonDbError(08006 connection_failure)',
    err: Object.assign(new Error('connection failure'), { name: 'NeonDbError', code: '08006' }),
    expect: 503,
  });
  synth.push({
    name: 'ECONNREFUSED(driver)',
    err: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' }),
    expect: 503,
  });
  // 反例（必须**不**被算成 503）：连接配置缺陷 08P01 ⇒ 500 类（R108 告警）
  synth.push({
    name: 'NeonDbError(08P01 protocol_violation)', err: Object.assign(new Error('unsupported startup parameter'), { code: '08P01' }), expect: 500,
  });

  const rows = synth.map((s) => {
    const n = le.normalizeLedgerError(s.err);
    const body = le.toErrorResponse(n);
    const diag = le.ledgerErrorDiagnostics(s.err);
    return {
      case: s.name, expect_http: s.expect, got_http: n.httpStatus, code: n.code,
      details: n.details, detail_keys: Object.keys(n.details || {}),
      non_pg_class: diag.non_pg_class, error_name: diag.error_name,
      i18n_key: (body.error as unknown as { i18n_key?: string }).i18n_key ?? null,
      pass: n.httpStatus === s.expect,
    };
  });
  return { real_connect_timeout_class_available: realCtUsed, rows };
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: nowIso(), phase: PHASE, live_base: LIVE_BASE, repo: REPO };
  out.env_local_present = loadEnvLocal();

  const envKey = String(process.env.SECRET_KEY || '');
  out.secret_key = {
    present: envKey.length > 0,
    length: envKey.length,
    fingerprint12: fp(envKey),
    equals_public_placeholder: envKey === FALLBACK_KEY,
  };

  // ---- 取一个**真**用户（只读 SELECT）----
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
  const dbUrl = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '');
  if (!dbUrl) throw new Error('NO_DATABASE_URL (script needs it read-only to pick a real user)');
  const sql = neon(dbUrl);
  const users = (await sql('SELECT uid, evm FROM public."users" ORDER BY uid LIMIT 3')) as Array<{ uid: number; evm: string }>;
  const target = users[0];
  if (!target) throw new Error('NO_USERS');
  const uid = Number(target.uid); const evm = String(target.evm || '');
  out.target_user = { uid, evm_fingerprint12: fp(evm) };

  // ---- 铸 token：生产签名器 + 兑底常量复刻 ----
  // dynamic require：**在** .env.local 装载之后才求值 src/auth ⇒ 模块期 resolveSecretKey() 看到真密钥
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const auth = require(path.join(REPO, 'src', 'auth')) as {
    createSessionToken: (p: { uID: number; evm: string }) => string;
  };
  const exp = Math.floor(Date.now() / 1000) + 1800;
  const tokenEnv = auth.createSessionToken({ uID: uid, evm });
  const tokenFallback = signToken(FALLBACK_KEY, { sub: String(uid), evm, exp });
  const tokenOther = signToken('p4sec-wrong-key-' + String(Date.now()), { sub: String(uid), evm, exp });
  const parts = tokenEnv.split('.');
  const tokenTampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -4)}AAAA`;
  out.tokens = {
    env_key_token_fp: fp(tokenEnv), fallback_key_token_fp: fp(tokenFallback),
    wrong_key_token_fp: fp(tokenOther), tampered_token_fp: fp(tokenTampered),
    note: '只有 sha256 前 12 位；token 本体不落盘',
  };

  // ---- HTTP 探针（生产 5788）----
  const checks: Call[] = [
    { name: 'DUAL-KEY: .env.local SECRET_KEY token', method: 'GET', url: `${LIVE_BASE}/api/user`, auth: `Bearer ${tokenEnv}`, expect: 200 },
    { name: 'DUAL-KEY: public placeholder token (MUST be rejected)', method: 'GET', url: `${LIVE_BASE}/api/user`, auth: `Bearer ${tokenFallback}`, expect: 401 },
    { name: 'no token', method: 'GET', url: `${LIVE_BASE}/api/user`, expect: 401 },
    { name: 'wrong key', method: 'GET', url: `${LIVE_BASE}/api/user`, auth: `Bearer ${tokenOther}`, expect: 401 },
    { name: 'tampered signature', method: 'GET', url: `${LIVE_BASE}/api/user`, auth: `Bearer ${tokenTampered}`, expect: 401 },
    { name: 'malformed token', method: 'GET', url: `${LIVE_BASE}/api/user`, auth: 'Bearer not-a-jwt', expect: 401 },
    { name: 'REGRESSION /api/user (real token)', method: 'GET', url: `${LIVE_BASE}/api/user`, auth: `Bearer ${tokenEnv}`, expect: 200 },
    { name: 'REGRESSION /api/admin/me', method: 'GET', url: `${LIVE_BASE}/api/admin/me`, auth: `Bearer ${tokenEnv}`, expect: 200 },
    { name: 'REGRESSION /api/home', method: 'GET', url: `${LIVE_BASE}/api/home`, expect: 200 },
    { name: 'REGRESSION /api/prize/all', method: 'GET', url: `${LIVE_BASE}/api/prize/all`, expect: 200 },
    { name: 'GONE /api/shard/redeem', method: 'POST', url: `${LIVE_BASE}/api/shard/redeem`, expect: 410 },
    { name: 'GONE /api/chest/x/open', method: 'POST', url: `${LIVE_BASE}/api/chest/x/open`, expect: 410 },
    { name: 'GONE /api/admin/settings/reset', method: 'POST', url: `${LIVE_BASE}/api/admin/settings/reset`, expect: 410 },
    { name: 'GONE /api/admin/task/create', method: 'POST', url: `${LIVE_BASE}/api/admin/task/create`, expect: 410 },
    { name: 'GONE /api/admin/prize/create', method: 'POST', url: `${LIVE_BASE}/api/admin/prize/create`, expect: 410 },
    { name: 'HEALTH /health', method: 'GET', url: `${LIVE_BASE}/health`, expect: 200 },
  ];
  out.http = await runHttp(checks);

  out.classifier = runClassifier(uid, evm);
  out.infra_http_e2e = await runInfraE2E(envKey, uid, evm, tokenEnv, tokenFallback);
  out.fail_fast = await runFailFast();

  out.summary = {
    http_pass: (out.http as Array<{ pass: boolean }>).filter((r) => r.pass).length,
    http_total: (out.http as Array<{ pass: boolean }>).length,
    classifier_pass: (out.classifier as { rows: Array<{ pass: boolean }> }).rows.filter((r) => r.pass).length,
    classifier_total: (out.classifier as { rows: Array<{ pass: boolean }> }).rows.length,
    infrastructure_e2e: (out.infra_http_e2e as { results: Array<{ name: string; status: number | null }> }).results
      .map((r) => `${r.name}=${r.status}`).join(' '),
  };

  const jsonPath = path.join(outDir, `verify-${PHASE}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(outDir, `verify-${PHASE}.txt`), JSON.stringify(out, null, 1));
  console.log('WROTE ' + jsonPath);
  console.log(JSON.stringify(out.summary, null, 1));
  for (const r of out.http as Array<Record<string, unknown>>) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.status}/${r.expect} ${r.name} code=${r.error_code}`);
  }
  for (const r of (out.classifier as { rows: Array<Record<string, unknown>> }).rows) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] classifier ${r.got_http}/${r.expect_http} ${r.case} => ${r.code} class=${r.non_pg_class}`);
  }
  const e2e = out.infra_http_e2e as { results: Array<Record<string, unknown>>; ready: boolean };
  console.log(`infra e2e ready=${e2e.ready}`);
  for (const r of e2e.results) console.log(`[infra-e2e] ${r.name} status=${r.status} code=${r.error_code}`);
  const ff = out.fail_fast as Record<string, unknown>;
  console.log(`fail-fast: missing_exit_nonzero=${ff.missing_exit_nonzero} fatal_msg=${ff.missing_is_fatal_error} control_ok=${ff.control_has_no_fatal}`);
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED', e); process.exit(1); });
