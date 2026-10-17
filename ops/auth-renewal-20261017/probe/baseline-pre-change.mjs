/**
 * 改前基线探针（只读）：证「现盘无续期」—— 现役 token（{sub,evm,exp}，无 iat/sst）
 * 打 `GET /api/user` ⇒ 200，且响应头**没有** `X-Session-Token`。
 * 本探针**手签** token（现盘 `createSessionToken` 无 iat/sst，等价形态），不是改后实现。
 *
 * 用法：cd /Users/kevin/bistro/seafood && \
 *   env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u POSTGRES_URL -u POSTGRES_URL_NON_POOLING \
 *   node ops/auth-renewal-20261017/probe/baseline-pre-change.mjs
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const { neon } = require('@neondatabase/serverless');

const OUT = '/Users/kevin/bistro/seafood/ops/auth-renewal-20261017/readings/baseline-pre-change.json';
const ENV_FILE = '/Users/kevin/bistro/seafood/backend-ts/.env.local';
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
  if (!m || process.env[m[1]] !== undefined) continue;
  process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const b64 = (v) => Buffer.from(v).toString('base64url');
const sign = (payload) => {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', process.env.SECRET_KEY).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
};

const sql = neon(process.env.DATABASE_URL);
const [{ project_id: projectId }] = await sql`SELECT current_setting('neon.project_id', true) AS project_id`;
const users = await sql`SELECT uid, evm AS evm FROM public.users ORDER BY uid LIMIT 1`;

const now = Math.floor(Date.now() / 1000);
const uid = Number(users[0].uid);
const evm = String(users[0].evm || '').toLowerCase();
const token = sign({ sub: String(uid), evm, exp: now + 30 * 60 });

const res = await fetch('http://localhost:5788/api/user', { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json().catch(() => null);
const headerValue = res.headers.get('x-session-token');

const out = {
  script: 'ops/auth-renewal-20261017/probe/baseline-pre-change.mjs',
  at: new Date().toISOString(),
  purpose: '改前基线：现盘 token 无 iat/sst，鉴权成功不回头（无 X-Session-Token）',
  db: { neon_project_id: projectId, uid, evm_suffix: evm.slice(-4) },
  token_payload: { keys: ['sub', 'evm', 'exp'], iat: null, sst: null, exp_offset_s: now + 1800 - now },
  http: {
    url: 'GET http://localhost:5788/api/user',
    status: res.status,
    body_ok: body?.ok ?? null,
    body_uid: body?.data?.uID ?? body?.data?.uid ?? null,
    x_session_token_present: headerValue !== null,
    x_session_token: headerValue,
  },
  verdict: res.status === 200 && headerValue === null ? 'BASELINE_CONFIRMED_NO_RENEWAL' : 'UNEXPECTED',
};
fs.mkdirSync('/Users/kevin/bistro/seafood/ops/auth-renewal-20261017/readings', { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
