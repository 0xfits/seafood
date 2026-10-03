/**
 * leg 5 · 4 新口真 HTTP（受控实例 5797）
 * ============================================================================
 * 用法：cd backend-ts && PORT=5797 npx ts-node --transpile-only src/index.ts  （受控实例，另终端）
 *       cd backend-ts && npx ts-node --transpile-only .p9s2c-apply/leg5-http.ts
 * 产物：backend-ts/.p9s2c-apply/leg5-http-<RUN>.json
 *
 * 判据：4 口「无 token ⇒ 401」（逐字）；「有 token ⇒ 200」（逐字）；公开面（无鉴权读口）零回归。
 * ⚠️ 只打印状态码 / 键集 / 计数；不打印任何 token / 密钥 / 连接串。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createSessionToken } from '../src/auth';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const BASE = process.env.P9S2C_BASE || 'http://127.0.0.1:5797';
const OUT = path.resolve(__dirname, `leg5-http-${RUN}.json`);

const call = async (method: string, p: string, token?: string, body?: unknown) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Record<string, unknown> | null = null;
  try { json = (await r.json()) as Record<string, unknown>; } catch { /* non-json */ }
  return { status: r.status, success: json?.success ?? null, data_keys: json?.data ? Object.keys(json.data as object).sort() : null,
    code: ((json?.error ?? {}) as Record<string, unknown>).code ?? null };
};

const out: Record<string, unknown> = { script: '.p9s2c-apply/leg5-http.ts', base: BASE, run: RUN };
const checks: Array<{ id: string; pass: boolean; expect: string; actual: string }> = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown) =>
  checks.push({ id, pass: Boolean(pass), expect: String(expect), actual: String(actual) });

const ROUTES = [
  { id: 'GET /api/batt', method: 'GET', p: '/api/batt' },
  { id: 'GET /api/checkin', method: 'GET', p: '/api/checkin' },
  { id: 'POST /api/checkin', method: 'POST', p: '/api/checkin', body: {} },
  { id: 'POST /api/checkin/makeup', method: 'POST', p: '/api/checkin/makeup', body: { target_day: process.env.P9S2C_MAKEUP_DAY || '' } },
];

(async () => {
  const health = await call('GET', '/');
  out.health = { status: health.status };

  const row = (await readQuery<{ uid: string }>(
    `SELECT u.uid::text AS uid FROM public.users u WHERE u.is_admin IS NOT TRUE
       AND NOT EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid) ORDER BY u.uid LIMIT 1`))[0];
  const uid = Number(process.env.P9S2C_UID || row?.uid || 7);
  const token = createSessionToken({ uID: uid, evm: '' });
  out.actor = { uid, token_len: token.length };

  // ---- 401（无 token）逐口 ----
  const noTok: Record<string, unknown> = {};
  for (const r of ROUTES) { const x = await call(r.method, r.p, undefined, r.body); noTok[r.id] = x.status; }
  out.no_token = noTok;
  for (const r of ROUTES) t(`401 ${r.id}`, noTok[r.id] === 401, 401, noTok[r.id]);

  // ---- 200（有 token）逐口 ----
  const batt = await call('GET', '/api/batt', token);
  const chkGet = await call('GET', '/api/checkin', token);
  const chkPost = await call('POST', '/api/checkin', token, {});
  const makeup = await call('POST', '/api/checkin/makeup', token, { target_day: process.env.P9S2C_MAKEUP_DAY || '' });
  out.with_token = {
    batt, checkin_get: chkGet, checkin_post: chkPost, makeup_post: makeup,
  };
  t('200 GET /api/batt', batt.status === 200 && batt.success === true, 200, batt.status);
  t('200 GET /api/checkin', chkGet.status === 200 && chkGet.success === true, 200, chkGet.status);
  t('200 POST /api/checkin', chkPost.status === 200 && chkPost.success === true, 200, chkPost.status);
  t('200 POST /api/checkin/makeup', makeup.status === 200 && makeup.success === true, 200, makeup.status);
  out.frozen_keys = { batt: batt.data_keys, checkin_get: chkGet.data_keys };

  // ---- 公开面零回归（无鉴权读口 ⇒ 200）----
  const pub = await call('GET', '/api/role-names');
  out.public_surface = { '/api/role-names': pub.status };
  t('公开面 /api/role-names 无 token ⇒ 200', pub.status === 200, 200, pub.status);

  const failed = checks.filter((c) => !c.pass).length;
  out.total = checks.length; out.passed = checks.length - failed; out.failed = failed; out.checks = checks;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  console.log(`SUMMARY total=${out.total} passed=${out.passed} failed=${failed} artifact=${OUT}`);
  await closePools();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => { console.error('LEG5_FATAL', String((e as Error)?.message || e).slice(0, 300)); await closePools().catch(() => undefined); process.exit(2); });
