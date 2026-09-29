// P4-B2c-02 探针：`before` / `http` / `after` 三个子命令
//   before : 逐表计数 + account/currency/ledger 全行 dump hash（**HTTP 写入前**）
//   http   : 铸 token（src/auth.ts 的兑底密钥路径）+ 端点矩阵（**token 只入指纹，不落盘**）
//   after  : 逐表计数 + dump hash + ★ 非资金不变量
// 口径（§5.7）：带引号表名；退出码不取自管道；HTTP 用 global fetch + AbortSignal.timeout(20000)。
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
// **先 import auth**（其顶部在 dotenv 之前求值 ⇒ 与服务的生效密钥口径一致；见 B2a-HTTP §2）
import { createSessionToken } from '../src/auth';

const ROOT = path.resolve(__dirname, '..');
const RUN = process.env.P4_RUN || 'b2c-manual';
const ART = path.join(ROOT, '.p4-artifacts', RUN);
fs.mkdirSync(ART, { recursive: true });

const TABLES = [
  'users', 'account', 'currency', 'ledger_entry', 'app_config',
  'admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role',
  'listing', 'listing_order', 'job', 'job_application', 'job_submission',
  'commission_policy', 'market_order', 'market_trade',
];

const HOST = 'http://127.0.0.1:5788';
const ADMIN_UID = Number(process.env.P4_ADMIN_UID || 970201);
const NORMAL_UID = Number(process.env.P4_NORMAL_UID || 970202);
const NS = 'p4b2c';

function resolveDbUrl(): string {
  dotenv.config({ path: '.env.local' });
  dotenv.config();
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.jinli_DATABASE_URL || '';
  if (!url) throw new Error('no db url in env');
  return url;
}

const fp = (value: string) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);

type SqlFn = ReturnType<typeof neon>;

const rowsOf = async <T = Record<string, unknown>>(query: Promise<unknown>): Promise<T[]> =>
  (await query) as T[];

async function snapshot(sql: SqlFn) {
  // 逐表精确计数：表名走 `format('%I')` + `query_to_xml`（**不**做客户端标识符插值）；
  // 表不存在 ⇒ rows = -1（**不**当 0 用）。
  const counts = await rowsOf<{ counts: Record<string, { rows: number; present: boolean }> }>(sql`
    SELECT jsonb_object_agg(u.t, jsonb_build_object('rows', s.cnt, 'present', s.present)) AS counts
    FROM unnest(${TABLES}::text[]) AS u(t)
    CROSS JOIN LATERAL (
      SELECT (to_regclass('public.' || quote_ident(u.t)) IS NOT NULL) AS present,
             CASE WHEN to_regclass('public.' || quote_ident(u.t)) IS NOT NULL
                  THEN (xpath('/row/c/text()',
                         query_to_xml(format('SELECT count(*) AS c FROM public.%I', u.t), false, true, '')))[1]::text::int
                  ELSE -1 END AS cnt
    ) AS s
  `);

  const accountDump = await rowsOf<{ h: string; n: number }>(sql`
    SELECT md5(COALESCE(string_agg(to_jsonb(a)::text, '|' ORDER BY to_jsonb(a)::text), '')) AS h, count(*)::int AS n
    FROM public.account a
  `);
  const currencyDump = await rowsOf<{ h: string; n: number }>(sql`
    SELECT md5(COALESCE(string_agg(to_jsonb(c)::text, '|' ORDER BY to_jsonb(c)::text), '')) AS h, count(*)::int AS n
    FROM public.currency c
  `);
  const ledgerDump = await rowsOf<{ n: number; total: string }>(sql`
    SELECT count(*)::int AS n, COALESCE(sum((to_jsonb(l)->>'amount')::numeric), 0)::text AS total
    FROM public.ledger_entry l
  `);
  const nsRows = await rowsOf(sql`
    SELECT (SELECT count(*)::int FROM public."users" WHERE bio LIKE ${`%${NS}%`}) AS users_ns,
           (SELECT count(*)::int FROM public.app_config WHERE key LIKE ${`%${NS}%`}) AS app_config_ns,
           (SELECT count(*)::int FROM public.app_config) AS app_config_total,
           (SELECT count(*)::int FROM public.admin_role) AS admin_role_total,
           (SELECT count(*)::int FROM public.admin_user_role) AS admin_user_role_total,
           (SELECT count(*)::int FROM public.admin_role_permission) AS admin_role_permission_total,
           (SELECT count(*)::int FROM public.admin_permission) AS admin_permission_total,
           (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY to_jsonb(c)->>'key'), '[]'::jsonb)
              FROM public.app_config c) AS app_config_rows
  `);

  return {
    generated_at: new Date().toISOString(),
    counts: counts[0]?.counts ?? null,
    account_dump: accountDump[0],
    currency_dump: currencyDump[0],
    ledger: ledgerDump[0],
    namespace: nsRows[0],
  };
}

async function ensureFixture(sql: SqlFn) {
  const out: Record<string, unknown> = {};
  for (const [uid, admin] of [[ADMIN_UID, true], [NORMAL_UID, false]] as Array<[number, boolean]>) {
    const evm = `0x${String(uid).padStart(40, '0')}`;
    const bio = `${NS}:fixture uid=${uid}`;
    await sql`
      INSERT INTO public."users" (uid, evm, bio, is_admin, time_reg, time_login_last)
      VALUES (${uid}, ${evm}, ${bio}, ${admin}, now(), now())
      ON CONFLICT (uid) DO UPDATE SET is_admin = EXCLUDED.is_admin, bio = EXCLUDED.bio
    `;
    out[String(uid)] = { is_admin: admin, evm, bio };
  }
  return out;
}

type Case = { id: string; method: string; path: string; token: string | null; body?: unknown; expect: number };

async function runHttp() {
  const adminToken = createSessionToken({ uID: ADMIN_UID, evm: `0x${String(ADMIN_UID).padStart(40, '0')}` });
  const normalToken = createSessionToken({ uID: NORMAL_UID, evm: `0x${String(NORMAL_UID).padStart(40, '0')}` });
  const badToken = `${adminToken.slice(0, -4)}dead`;

  const opsKey = (action: string, business: string | number) => `ops:${ADMIN_UID}:${action}:${business}`;
  const cases: Case[] = [
    { id: 'T01', method: 'GET', path: '/health', token: null, expect: 200 },
    { id: 'T02', method: 'GET', path: '/api/admin/me', token: adminToken, expect: 200 },
    { id: 'T03', method: 'GET', path: '/api/admin/me', token: normalToken, expect: 200 },
    { id: 'T04', method: 'GET', path: '/api/admin/settings', token: adminToken, expect: 200 },
    { id: 'T05', method: 'GET', path: '/api/admin/settings', token: normalToken, expect: 403 },
    { id: 'T06', method: 'GET', path: '/api/admin/settings', token: null, expect: 401 },
    { id: 'T07', method: 'GET', path: '/api/admin/settings', token: badToken, expect: 401 },
    { id: 'T08', method: 'POST', path: '/api/admin/settings', token: adminToken, body: { siteName: `${NS}:siteA` }, expect: 400 },
    { id: 'T09', method: 'POST', path: '/api/admin/settings', token: adminToken, body: { create_key: opsKey('setting', 'system_settings'), siteName: `${NS}:siteA` }, expect: 200 },
    { id: 'T10', method: 'GET', path: '/api/admin/settings', token: adminToken, expect: 200 },
    { id: 'T11', method: 'POST', path: '/api/admin/settings', token: adminToken, body: { create_key: opsKey('setting', 'system_settings'), fee_rate_bp: 300 }, expect: 400 },
    { id: 'T12', method: 'POST', path: '/api/admin/settings', token: adminToken, body: { create_key: 'nope:bad', siteName: 'x' }, expect: 400 },
    { id: 'T13', method: 'POST', path: '/api/admin/settings/reset', token: adminToken, expect: 410 },
    { id: 'T14', method: 'POST', path: '/api/admin/settings/reset', token: null, expect: 410 },
    { id: 'T15', method: 'GET', path: '/api/admin/permissions', token: adminToken, expect: 200 },
    { id: 'T16', method: 'POST', path: '/api/admin/permissions/save', token: adminToken, body: { name: `${NS}:role`, permissions: ['manage_settings'], user_ids: [] }, expect: 400 },
    { id: 'T17', method: 'POST', path: '/api/admin/permissions/save', token: adminToken, body: { create_key: opsKey('permission_save', 'new'), name: `${NS}:role`, permissions: ['manage_settings'], user_ids: [] }, expect: 404 },
    { id: 'T18', method: 'POST', path: '/api/admin/permissions/delete', token: adminToken, body: { create_key: opsKey('permission_delete', `${NS}:role`), id: `${NS}:role` }, expect: 404 },
    { id: 'T19', method: 'POST', path: '/api/admin/permissions/delete', token: normalToken, body: { create_key: 'ops:1:x:y', id: 'z' }, expect: 403 },
    { id: 'T20', method: 'POST', path: '/api/admin/user/update', token: adminToken, body: { create_key: opsKey('user_update', NORMAL_UID), uID: NORMAL_UID, is_admin: false }, expect: 200 },
    { id: 'T21', method: 'POST', path: '/api/admin/user/update', token: adminToken, body: { create_key: opsKey('user_update', NORMAL_UID), uID: NORMAL_UID, evm: '0xdead' }, expect: 400 },
    { id: 'T22', method: 'POST', path: '/api/admin/user/update', token: adminToken, body: { create_key: opsKey('user_update', NORMAL_UID), uID: NORMAL_UID, points: 999 }, expect: 400 },
    { id: 'T23', method: 'POST', path: '/api/admin/user/update', token: adminToken, body: { create_key: opsKey('user_update', 999999999), uID: 999999999, is_admin: false }, expect: 404 },
    { id: 'T24', method: 'GET', path: '/api/user/all', token: adminToken, expect: 200 },
    { id: 'T25', method: 'GET', path: '/api/user/all', token: normalToken, expect: 403 },
    { id: 'T26', method: 'GET', path: '/api/user/stats', token: adminToken, expect: 200 },
    { id: 'T27', method: 'GET', path: '/api/user', token: null, expect: 401 },
    { id: 'T28', method: 'GET', path: '/api/home', token: null, expect: 200 },
    { id: 'T29', method: 'GET', path: '/api/prize/all', token: null, expect: 200 },
    { id: 'T30', method: 'GET', path: '/api/task/all', token: null, expect: 200 },
    { id: 'T31', method: 'GET', path: '/api/market/1/orderbook', token: null, expect: 200 },
    { id: 'T32', method: 'GET', path: '/api/prize/999999999', token: null, expect: 404 },
    { id: 'T33', method: 'POST', path: '/api/admin/prize/create', token: adminToken, expect: 410 },
    { id: 'T34', method: 'POST', path: '/api/admin/prize/update', token: adminToken, expect: 410 },
    { id: 'T35', method: 'POST', path: '/api/admin/prize/delete', token: adminToken, expect: 410 },
    { id: 'T36', method: 'POST', path: '/api/shard/redeem', token: adminToken, expect: 410 },
    { id: 'T37', method: 'POST', path: '/api/chest/1/open', token: adminToken, expect: 410 },
    { id: 'T38', method: 'POST', path: '/api/admin/task/create', token: adminToken, expect: 410 },
    { id: 'T39', method: 'POST', path: '/api/admin/assets/init', token: adminToken, expect: 410 },
  ];

  const results: unknown[] = [];
  for (const testCase of cases) {
    const headers: Record<string, string> = {};
    if (testCase.token) headers.Authorization = `Bearer ${testCase.token}`;
    let status = 0;
    let body: unknown = null;
    let error: string | null = null;
    try {
      const init: RequestInit = { method: testCase.method, headers, signal: AbortSignal.timeout(20000) };
      if (testCase.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(testCase.body);
      }
      const res = await fetch(`${HOST}${testCase.path}`, init);
      status = res.status;
      body = await res.json().catch(() => null);
    } catch (err) {
      error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
    const payload = body as Record<string, unknown> | null;
    const dataBlock = payload && typeof payload.data === 'object' && payload.data !== null ? payload.data : null;
    const errBlock = payload && typeof payload.error === 'object' && payload.error !== null ? payload.error as Record<string, unknown> : null;
    const errDetails = errBlock && typeof errBlock.details === 'object' && errBlock.details !== null ? errBlock.details as Record<string, unknown> : null;
    results.push({
      id: testCase.id,
      endpoint: `${testCase.method} ${testCase.path}`,
      token: testCase.token ? fp(testCase.token) : null,
      expected: testCase.expect,
      actual: status,
      pass: status === testCase.expect,
      error,
      top_keys: payload ? Object.keys(payload) : null,
      data_keys: dataBlock ? Object.keys(dataBlock) : null,
      data_head: dataBlock ? JSON.stringify(dataBlock).slice(0, 300) : null,
      error_code: errBlock ? errBlock.code : null,
      error_reason: errDetails ? errDetails.reason ?? null : null,
      message: typeof payload?.message === 'string' ? payload.message : null,
      body_head: JSON.stringify(body).slice(0, 400),
    });
  }

  const out = {
    generated_at: new Date().toISOString(),
    host: HOST,
    token_fingerprints: { admin: fp(adminToken), admin_len: adminToken.length, normal: fp(normalToken), bad: fp(badToken) },
    namespace: NS,
    passed: results.filter((row) => (row as { pass: boolean }).pass).length,
    total: results.length,
    results,
  };
  fs.writeFileSync(path.join(ART, 'http-results.json'), JSON.stringify(out, null, 2));
  console.log(`HTTP ${out.passed}/${out.total} pass`);
  for (const row of results as Array<Record<string, unknown>>) {
    if (!row.pass) console.log(`  FAIL ${row.id} ${row.endpoint} expect=${row.expected} got=${row.actual} err=${row.error_code ?? ''} ${row.error ?? ''}`);
  }
}

(async () => {
  const mode = process.argv[2];
  const sql = neon(resolveDbUrl());
  if (mode === 'before') {
    const snap = await snapshot(sql);
    fs.writeFileSync(path.join(ART, 'counts-before.json'), JSON.stringify(snap, null, 2));
    console.log('counts-before:', JSON.stringify({ counts: snap.counts, account_dump: snap.account_dump, currency_dump: snap.currency_dump, ledger: snap.ledger, namespace: snap.namespace }));
    const fixture = await ensureFixture(sql);
    fs.writeFileSync(path.join(ART, 'fixture-ledger.json'), JSON.stringify({ run: RUN, at: new Date().toISOString(), fixture, namespace: NS, note: '只 INSERT；禁写 admin_permission/admin_role*' }, null, 2));
    console.log('fixture:', JSON.stringify(fixture));
  } else if (mode === 'http') {
    await runHttp();
  } else if (mode === 'after') {
    const snap = await snapshot(sql);
    fs.writeFileSync(path.join(ART, 'counts-after.json'), JSON.stringify(snap, null, 2));
    console.log('counts-after:', JSON.stringify({ counts: snap.counts, account_dump: snap.account_dump, currency_dump: snap.currency_dump, ledger: snap.ledger, namespace: snap.namespace }));
  } else {
    throw new Error('mode must be before|http|after');
  }
})();
