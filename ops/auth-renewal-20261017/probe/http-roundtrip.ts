/**
 * P9 · 无状态滑动续期 —— **真实 HTTP 往返**探针（不是只跑纯函数）
 * ============================================================================
 * 用法（跑在 backend-ts 里，ts-node --transpile-only）：
 *   cd backend-ts && npx ts-node --transpile-only ../ops/auth-renewal-20261017/probe/http-roundtrip.ts
 *
 * 前置：dev 后端在 http://localhost:5788（面板 sid = `seafood-api`，已重载新码）。
 * 只读：库面只做一条 `SELECT uid, evm FROM users LIMIT 1`（自证 `neon.project_id` 是 dev），
 *       **零写库**；token 一律本地自签（`createSessionToken` + 假时钟）。
 *
 * 断言：H1 token 形态 · H2 2h 前的 token 换到响应头 · H3 续期保留 sst/exp 公式
 *   · H4 刚签发的 token 不回头 · H5 续期后 1h 内不重复续 · H6 /api/home 同口径
 *   · H7 匿名 /api/home 不加头 · H8 闲置过期 401 · H9 篡改 401 · H10 CORS expose
 *   · H11 绝对上限端到端夹紧
 */
import '../../../backend-ts/src/env'; // ← 必须早于 ./auth 求值（仓内同款首 import）
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { createSessionToken, SESSION_POLICY } from '../../../backend-ts/src/auth';

const requireFromBackend = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { neon } = requireFromBackend('@neondatabase/serverless');

const BASE = process.env.P9_BASE || 'http://localhost:5788';
const OUT = '/Users/kevin/bistro/seafood/ops/auth-renewal-20261017/readings/http-roundtrip.json';
const { idleSeconds: IDLE, absoluteSeconds: ABS } = SESSION_POLICY;

type Check = { id: string; pass: boolean; expect: string; actual: string };
const checks: Check[] = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown) => {
  checks.push({ id, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

const decode = (token: string): Record<string, number | string> =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const nowSec = () => Math.floor(Date.now() / 1000);

/** 假时钟签发（epoch 秒）——`createSessionToken` 读 `Date.now` */
const signAt = (uid: number, evm: string, epochSeconds: number, sessionStartedAt?: number): string => {
  const real = Date.now;
  Date.now = () => epochSeconds * 1000;
  try {
    return createSessionToken({ uID: uid, evm, sessionStartedAt });
  } finally {
    Date.now = real;
  }
};

const call = async (urlPath: string, token?: string, extraHeaders: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, { headers });
  const body = await res.json().catch(() => null);
  return {
    status: res.status,
    body,
    renewed: res.headers.get('x-session-token'),
    expose: res.headers.get('access-control-expose-headers'),
    cacheControl: res.headers.get('cache-control'),
    dateHeader: res.headers.get('date'),
  };
};

(async () => {
  const sql = neon(process.env.DATABASE_URL as string);
  const [{ project_id: projectId }] = (await sql`SELECT current_setting('neon.project_id', true) AS project_id`) as Array<{ project_id: string }>;
  const users = (await sql`SELECT uid, evm FROM public.users ORDER BY uid LIMIT 1`) as Array<{ uid: unknown; evm: string }>;
  const UID = Number(users[0].uid);
  const EVM = String(users[0].evm || '').toLowerCase();

  const T = nowSec();

  // ── H1：两小时前签发的 token（iat/sst = T-7200）
  const tokenAged = signAt(UID, EVM, T - 7200);
  const agedPayload = decode(tokenAged);
  t('H1', agedPayload.iat === T - 7200 && agedPayload.sst === T - 7200,
    `iat=sst=${T - 7200}`, `iat=${agedPayload.iat} sst=${agedPayload.sst}`);

  // ── H2：该 token 打鉴权读口 ⇒ 200 且响应头回新 token
  const agedCall = await call('/api/user', tokenAged);
  t('H2', agedCall.status === 200 && typeof agedCall.renewed === 'string' && agedCall.renewed.split('.').length === 3,
    '200 + 响应头 X-Session-Token（三段 JWT）',
    `status=${agedCall.status} renewed=${agedCall.renewed ? 'present' : 'ABSENT'}`);

  // ── H3：续期后保留会话起点 + exp 公式
  const renewedPayload = agedCall.renewed ? decode(agedCall.renewed) : ({} as Record<string, number | string>);
  const nowAfter = nowSec();
  const sstOk = renewedPayload.sst === T - 7200;
  const iatOk = Number(renewedPayload.iat) >= T - 5 && Number(renewedPayload.iat) <= nowAfter + 5;
  const expExpected = Math.min(Number(renewedPayload.iat) + IDLE, Number(renewedPayload.sst) + ABS);
  t('H3', sstOk && iatOk && Number(renewedPayload.exp) === expExpected,
    `sst 不变=${T - 7200} · iat≈now · exp=min(iat+${IDLE}, sst+${ABS})`,
    `sst=${renewedPayload.sst} iat=${renewedPayload.iat} exp=${renewedPayload.exp} expected=${expExpected}`);

  // ── H4：刚签发的 token（iat=now）不回头
  const tokenFresh = signAt(UID, EVM, nowSec());
  const freshCall = await call('/api/user', tokenFresh);
  t('H4', freshCall.status === 200 && freshCall.renewed === null,
    '200 + 无 X-Session-Token', `status=${freshCall.status} renewed=${freshCall.renewed === null ? 'absent' : 'PRESENT'}`);

  // ── H5：用刚拿到的续期 token 再打一次 ⇒ 1h 粒度内不重复续
  const renewedCall = agedCall.renewed ? await call('/api/user', agedCall.renewed) : null;
  t('H5', renewedCall !== null && renewedCall.status === 200 && renewedCall.renewed === null,
    '续期 token 立即可用，且 1h 内不重复下发',
    `status=${renewedCall?.status ?? 'n/a'} renewed=${renewedCall ? (renewedCall.renewed === null ? 'absent' : 'PRESENT') : 'n/a'}`);

  // ── H6：/api/home（唯一绕开 requireActor 的带 token 读口）同口径续期
  const homeAged = await call('/api/home', tokenAged);
  t('H6', homeAged.status === 200 && typeof homeAged.renewed === 'string' && homeAged.body?.data?.is_authenticated === true,
    '200 + is_authenticated=true + 回 X-Session-Token',
    `status=${homeAged.status} auth=${homeAged.body?.data?.is_authenticated} renewed=${homeAged.renewed ? 'present' : 'ABSENT'}`);

  // ── H7：匿名 /api/home 不得加头（公开面语义不变）
  const homeAnon = await call('/api/home');
  t('H7', homeAnon.status === 200 && homeAnon.renewed === null && homeAnon.body?.data?.is_authenticated === false,
    '200 + is_authenticated=false + 无头',
    `status=${homeAnon.status} auth=${homeAnon.body?.data?.is_authenticated} renewed=${homeAnon.renewed === null ? 'absent' : 'PRESENT'}`);

  // ── H8：闲置 3 天 ⇒ 401（语义不变、无头）
  const tokenIdleExpired = signAt(UID, EVM, T - IDLE - 10);
  const idleCall = await call('/api/user', tokenIdleExpired);
  t('H8', idleCall.status === 401 && idleCall.body?.error?.code === 'AUTH_UNAUTHORIZED' && idleCall.renewed === null,
    '401 + error.code=AUTH_UNAUTHORIZED + 无头',
    `status=${idleCall.status} code=${idleCall.body?.error?.code} renewed=${idleCall.renewed === null ? 'absent' : 'PRESENT'}`);

  // ── H9：篡改签名 ⇒ 401（既有错误码，零新增）
  const parts = tokenAged.split('.');
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}${parts[2].endsWith('aa') ? 'bb' : 'aa'}`;
  const tamperCall = await call('/api/user', tampered);
  t('H9', tamperCall.status === 401 && tamperCall.body?.error?.code === 'AUTH_UNAUTHORIZED' && tamperCall.renewed === null,
    '401 + AUTH_UNAUTHORIZED + 无头',
    `status=${tamperCall.status} code=${tamperCall.body?.error?.code} renewed=${tamperCall.renewed === null ? 'absent' : 'PRESENT'}`);

  // ── H10：CORS 暴露面（跨源调用方要能读到这个头）
  const corsCall = await call('/api/user', tokenAged, { Origin: 'http://example.test' });
  const preflight = await fetch(`${BASE}/api/user`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://example.test',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  const prefExpose = preflight.headers.get('access-control-expose-headers');
  t('H10', (corsCall.expose || '').toLowerCase().includes('x-session-token') && preflight.status === 204,
    '实际响应 Access-Control-Expose-Headers 含 X-Session-Token；预检 204（预检本身不带 expose，属 CORS 规范）',
    `expose="${corsCall.expose}" preflight_status=${preflight.status} preflight_expose="${prefExpose}"`);

  // ── H11：绝对上限端到端 —— sst = 7 天前差 100s、iat 1h 前 ⇒ 续期后 exp 被夹在 sst+7d
  const T2 = nowSec();
  const nearAbsStart = T2 - ABS + 100;
  const tokenNearAbs = signAt(UID, EVM, T2 - 3700, nearAbsStart);
  const nearCall = await call('/api/user', tokenNearAbs);
  const nearRenewed = nearCall.renewed ? decode(nearCall.renewed) : ({} as Record<string, number | string>);
  t('H11',
    nearCall.status === 200 && nearRenewed.sst === nearAbsStart && nearRenewed.exp === nearAbsStart + ABS
      && Number(nearRenewed.exp) - T2 <= 100,
    `sst=${nearAbsStart} exp=sst+7d=${nearAbsStart + ABS}（余量 ≤100s，远小于 3 天）`,
    `status=${nearCall.status} sst=${nearRenewed.sst} exp=${nearRenewed.exp} remaining=${nearRenewed.exp ? Number(nearRenewed.exp) - T2 : 'n/a'}s`);

  // ── H12：带新 token 的响应不得被共享缓存留存（Cache-Control: private, no-store）
  t('H12', (agedCall.cacheControl || '').includes('private') && (agedCall.cacheControl || '').includes('no-store'),
    'Cache-Control 含 private + no-store',
    `cache-control="${agedCall.cacheControl}"`);

  // ── H13：公开缓存面（匿名口）即便带了 token 也不续期、缓存语义不变
  const publicCall = await call('/api/task/all', tokenAged);
  t('H13', publicCall.status === 200 && publicCall.renewed === null && (publicCall.cacheControl || '').includes('public'),
    '匿名公共口：200 + 无 X-Session-Token + Cache-Control 仍 public',
    `status=${publicCall.status} renewed=${publicCall.renewed === null ? 'absent' : 'PRESENT'} cache-control="${publicCall.cacheControl}"`);

  const passed = checks.filter((c) => c.pass).length;
  const out = {
    script: 'ops/auth-renewal-20261017/probe/http-roundtrip.ts',
    at: new Date().toISOString(),
    base: BASE,
    db: { neon_project_id: projectId, expected_dev_project: 'quiet-math-65207667', uid: UID, evm_suffix: EVM.slice(-4) },
    server_date_header: agedCall.dateHeader,
    policy: { idle_seconds: IDLE, absolute_seconds: ABS, renew_granularity_seconds: SESSION_POLICY.renewGranularitySeconds },
    readings: {
      aged_token_payload: agedPayload,
      renewed_token_payload: renewedPayload,
      near_abs_renewed_payload: nearRenewed,
      cors_expose_header: corsCall.expose,
      preflight: { status: preflight.status, expose: prefExpose, allow_origin: preflight.headers.get('access-control-allow-origin') },
    },
    checks,
    summary: { total: checks.length, passed, failed: checks.length - passed },
    verdict: passed === checks.length ? 'PASS' : 'FAIL',
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  expect=${c.expect} actual=${c.actual}`);
  console.log(`\n${passed}/${checks.length} green · verdict=${out.verdict} · ${OUT}`);
  process.exit(passed === checks.length ? 0 : 1);
})().catch((e) => {
  console.error('PROBE ERROR:', e);
  process.exit(2);
});
