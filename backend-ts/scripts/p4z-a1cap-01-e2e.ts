// p4z-a1cap-01-e2e.ts — A1-CAP（后台调分单笔上限 100000 + ≤0 拒）**边界实测**（真 token · 真库）
// ============================================================================
// 用法：node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-a1cap-01-e2e.ts <outDirAbs> <pre|post>
//   pre  = 改前基线（记录、不判定）；post = 改后（逐例判定，任一 FAIL ⇒ exit 1）
// 口径（派单 §⑤ ①~⑥ + §5.7）：
//   · 真 token = `.env.local` 的 `SECRET_KEY`，经生产签名器 `src/auth.createSessionToken`；
//     **产物只落 12 位指纹，不落 token/密钥本体**；
//   · 夹具幂等键 `cli:a1cap-*`；**零删除 SQL、零写库 SQL**（库面只 SELECT）；
//   · 本脚本**不铸币**：`Σtotal` 前后必须相等（读数里记实测值，不写死猜）；
//   · 退出码**直接取**（不经管道）；产物 run-tagged + 绝对路径。
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'a1cap-run'));
const MODE = (process.argv[3] || 'post') as 'pre' | 'post';
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
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));
const sql = async <T = Record<string, unknown>>(q: string): Promise<T[]> => {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try { return (await sqlRaw(q)) as T[]; } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw last;
};
const auth = require(path.join(REPO, 'src', 'auth')) as { createSessionToken: (p: { uID: number; evm: string }) => string };
const fp12 = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);

const SRC_INDEX = fs.readFileSync(path.join(REPO, 'src', 'index.ts'), 'utf8');
const routeCount = (SRC_INDEX.match(/^app\.(get|post|put|delete|patch)\(/gm) || []).length;
const SRC_CS = fs.readFileSync(path.join(REPO, 'src', 'currency-service.ts'), 'utf8');
const numOf = (name: string): number | null => {
  const m = SRC_CS.match(new RegExp(`${name}\\s*=\\s*([\\d_]+);`));
  return m ? Number(m[1].replace(/_/g, '')) : null;
};
const CAP_IN_SRC = (() => {
  const m = SRC_INDEX.match(/ADMIN_POINTS_ADJUST_MAX_PER_CALL\s*=\s*([\d_]+);/);
  return m ? Number(m[1].replace(/_/g, '')) : null;
})();

type Snap = { sigma: string; sbal: string; sfrz: string; entries: number; kinds: Record<string, number> };
const snap = async (): Promise<Snap> => {
  const s = await sql<{ sigma: string; sbal: string; sfrz: string }>(
    'SELECT COALESCE(sum(balance+frozen),0)::text AS sigma, COALESCE(sum(balance),0)::text AS sbal, COALESCE(sum(frozen),0)::text AS sfrz FROM public.account');
  const e = await sql<{ n: number }>('SELECT count(*)::int AS n FROM public.ledger_entry');
  const k = await sql<{ kind: string; n: number }>('SELECT kind, count(*)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY 1');
  return { sigma: String(s[0].sigma), sbal: String(s[0].sbal), sfrz: String(s[0].sfrz), entries: Number(e[0].n), kinds: Object.fromEntries(k.map((r) => [r.kind, Number(r.n)])) };
};
const rowsFor = async (uids: number[]) =>
  sql<{ uid: string; cid: string; bal: string; frz: string }>(
    `SELECT uid::text AS uid, cid::text AS cid, balance::text AS bal, frozen::text AS frz FROM public.account WHERE uid IN (${uids.join(',')}) ORDER BY uid, cid`);

type Res = { status: number | null; code: string | null; reason: string | null; msg: string | null; body: Record<string, unknown>; fp: string };
const call = async (method: string, url: string, token?: string | null, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Res> => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers.Authorization = /^Bearer /i.test(token) ? token : `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let status: number | null = null; let text = '';
  try {
    const res = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(30000) });
    status = res.status; text = await res.text();
  } catch (e) { text = `FETCH_ERROR ${String(e).slice(0, 200)}`; }
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* non-JSON */ }
  const err = (parsed.error || {}) as Record<string, unknown>;
  const det = (err.details || {}) as Record<string, unknown>;
  return {
    status,
    code: typeof err.code === 'string' ? err.code : null,
    reason: typeof det.reason === 'string' ? det.reason : null,
    msg: typeof parsed.message === 'string' ? parsed.message : (typeof err.message === 'string' ? err.message : null),
    body: parsed,
    fp: fp12(text),
  };
};

type Case = { id: string; note: string; method: string; url: string; who: 'admin' | 'nonadmin' | 'none'; body?: unknown; headers?: Record<string, string>; expect: number | null; expectCode?: string | null; expectReason?: string | null };
const results: Array<Record<string, unknown>> = [];

(async () => {
  const out: Record<string, unknown> = { run: RUN, mode: MODE, base: BASE, cap_const_in_src: CAP_IN_SRC, route_count_from_src: routeCount, started_at: new Date().toISOString() };

  // ---- 发现 admin / 非 admin 夹具 -------------------------------------------------
  const jwtFor = async (uid: number) => {
    const u = await sql<{ evm: string }>(`SELECT evm FROM public.users WHERE uid = ${uid}`);
    if (!u.length) return null;
    const t = auth.createSessionToken({ uID: uid, evm: String(u[0].evm) });
    return { token: t, fp: fp12(t) };
  };
  let admin: { uid: number; fp: string; token: string } | null = null;
  let nonadmin: { uid: number; fp: string; token: string } | null = null;
  // 自曝探针（§5.7 ④）：admin 发现失败时先怀疑自己的探针 ⇒ 逐 uid 记回执
  const actorProbe: Array<Record<string, unknown>> = [];
  for (const uid of [1, 2]) {
    const j = await jwtFor(uid);
    if (!j) { actorProbe.push({ uid, has_user_row: false }); continue; }
    const me = await call('GET', '/api/user', j.token);
    const adm = await call('GET', '/api/admin/me', j.token);
    actorProbe.push({ uid, token_fp12: j.fp, user_status: me.status, user_code: me.code, admin_status: adm.status, admin_code: adm.code, admin_keys: Object.keys(adm.body || {}), can_access_admin: (adm.body?.data as Record<string, unknown> | undefined)?.can_access_admin === true });
  }
  const adminCands = await sql<{ uid: string }>('SELECT uid::text AS uid FROM public.users WHERE is_admin = true ORDER BY uid LIMIT 4');
  for (const c of adminCands) {
    const uid = Number(c.uid);
    const j = await jwtFor(uid);
    if (!j) continue;
    const adm = await call('GET', '/api/admin/me', j.token);
    if ((adm.body?.data as Record<string, unknown> | undefined)?.can_access_admin === true) { admin = { uid, fp: j.fp, token: j.token }; break; }
  }
  const nonCands = await sql<{ uid: string }>('SELECT uid::text AS uid FROM public.users WHERE is_admin = false AND uid > 1 ORDER BY uid LIMIT 3');
  for (const c of nonCands) {
    const uid = Number(c.uid);
    const j = await jwtFor(uid);
    if (!j) continue;
    const me = await call('GET', '/api/user', j.token);
    const adm = await call('GET', '/api/admin/me', j.token);
    if (me.status === 200 && (adm.body?.data as Record<string, unknown> | undefined)?.can_access_admin !== true) { nonadmin = { uid, fp: j.fp, token: j.token }; break; }
  }
  out.actor_probe = actorProbe;
  out.actors = { admin: admin ? { uid: admin.uid, token_fp12: admin.fp } : null, nonadmin: nonadmin ? { uid: nonadmin.uid, token_fp12: nonadmin.fp } : null, secret_key_fp12: fp12(String(process.env.SECRET_KEY || '')) };

  // ---- 目标 uID：cid=1 有 account 行者（保证走到服务层，能区分「校验挡住」与「服务层挡住」）----
  const cid1 = await sql<{ uid: string }>('SELECT uid::text AS uid FROM public.account WHERE cid = 1 AND uid > 0 ORDER BY balance ASC, uid ASC LIMIT 3');
  const targetUid = Number(cid1[0]?.uid || 0);
  const absentUid = 987654321; // 库内无 account 行 ⇒ 服务层 404 分支
  out.targets = { cid1_uid: targetUid, cid1_candidates: cid1.map((r) => r.uid), absent_uid: absentUid };

  // ---- 结构面：asset 表存在性（A1 成功路径依赖 `database.ts:889 upsertAsset` 写 `asset`）----
  const tbl = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='asset'`);
  out.asset_table_exists = Number(tbl[0].n) > 0;

  const pre = await snap();
  const preRows = await rowsFor([targetUid, absentUid]);
  out.pre = { snap: pre, rows: preRows };

  // ---- 用例 -------------------------------------------------------------------
  const tag = RUN.replace(/^a1cap-/, '');
  const cases: Case[] = [
    { id: 'T01', note: 'cap 边界内 = 100000（改后应过校验 ⇒ 落到服务层）', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: targetUid, amount: 100000, reason: 'A1CAP at-limit' }, expect: MODE === 'post' ? null : null },
    { id: 'T02', note: 'cap 超限 = 100001（改后应 400 + OVER_MAX_SINGLE_AMOUNT）', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: targetUid, amount: 100001, reason: 'A1CAP over-cap' }, expect: MODE === 'post' ? 400 : null, expectCode: MODE === 'post' ? 'LEDGER_AMOUNT_INVALID' : null, expectReason: MODE === 'post' ? 'OVER_MAX_SINGLE_AMOUNT' : null },
    { id: 'T03', note: '零值 amount = 0（改后应 400）', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: targetUid, amount: 0, reason: 'A1CAP zero' }, expect: MODE === 'post' ? 400 : null, expectCode: MODE === 'post' ? 'LEDGER_AMOUNT_INVALID' : null, expectReason: MODE === 'post' ? 'NOT_A_POSITIVE_INTEGER' : null },
    { id: 'T04', note: '负值 amount = -5（改后应 400）', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: targetUid, amount: -5, reason: 'A1CAP negative' }, expect: MODE === 'post' ? 400 : null, expectCode: MODE === 'post' ? 'LEDGER_AMOUNT_INVALID' : null, expectReason: MODE === 'post' ? 'NOT_A_POSITIVE_INTEGER' : null },
    { id: 'T05', note: '非 admin ⇒ 403（不得因新增校验绕过权限闸）', method: 'POST', url: '/api/admin/points/adjust', who: 'nonadmin', body: { uID: targetUid, amount: 1, reason: 'A1CAP nonadmin' }, expect: 403, expectCode: 'AUTH_FORBIDDEN' },
    { id: 'T06', note: '无 token ⇒ 401', method: 'POST', url: '/api/admin/points/adjust', who: 'none', body: { uID: targetUid, amount: 1, reason: 'A1CAP notoken' }, expect: 401, expectCode: 'AUTH_UNAUTHORIZED' },
    { id: 'T07', note: '缺 reason ⇒ 既有 400「参数不完整」（未改）', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: targetUid, amount: 10, reason: '' }, expect: 400, expectCode: null },
    { id: 'T08', note: '小额 100（cap 内）→ 服务层；库内无该行 ⇒ 404 用户资产记录不存在', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: absentUid, amount: 100, reason: 'A1CAP small absent' }, expect: 404, expectCode: null },
    { id: 'T09', note: '超上限的浮点 1e21（超 safe-int，改后应被 cap 挡）', method: 'POST', url: '/api/admin/points/adjust', who: 'admin', body: { uID: targetUid, amount: 1e21, reason: 'A1CAP huge' }, expect: MODE === 'post' ? 400 : null, expectCode: MODE === 'post' ? 'LEDGER_AMOUNT_INVALID' : null, expectReason: MODE === 'post' ? 'OVER_MAX_SINGLE_AMOUNT' : null },
    { id: 'T10', note: '非 admin + 超上限（权限闸必须先于金额校验 ⇒ 403 而非 400）', method: 'POST', url: '/api/admin/points/adjust', who: 'nonadmin', body: { uID: targetUid, amount: 100001, reason: 'A1CAP nonadmin overcap' }, expect: 403, expectCode: 'AUTH_FORBIDDEN' },
  ];

  for (const c of cases) {
    const token = c.who === 'admin' ? admin?.token : c.who === 'nonadmin' ? nonadmin?.token : null;
    const r = await call(c.method, c.url, token, c.body, c.headers || {});
    const pass = c.expect === null ? null : r.status === c.expect
      && (c.expectCode === undefined || c.expectCode === null || r.code === c.expectCode)
      && (c.expectReason === undefined || c.expectReason === null || r.reason === c.expectReason);
    const rec = { id: c.id, note: c.note, who: c.who, url: c.url, sent: c.body, status: r.status, code: r.code, reason: r.reason, msg: r.msg, resp_fp12: r.fp, expect: c.expect, pass };
    results.push(rec);
    console.log(`[${c.id}] ${MODE} status=${r.status} code=${r.code} reason=${r.reason} pass=${pass}`);
  }

  // ---- 回归面 -------------------------------------------------------------------
  const health = await call('GET', '/health');
  const home = await call('GET', '/api/home');
  const goneFaces = [
    { m: 'POST', u: '/api/auth/register' }, { m: 'POST', u: '/api/shard/redeem' }, { m: 'POST', u: '/api/chest/1/open' },
    { m: 'POST', u: '/api/admin/prize/create' }, { m: 'POST', u: '/api/admin/prize/update' }, { m: 'POST', u: '/api/admin/prize/delete' },
  ];
  const gone: Array<Record<string, unknown>> = [];
  for (const g of goneFaces) {
    let r = await call(g.m, g.u, admin?.token, {});
    let used = g.m;
    if (r.status === 404) { r = await call('GET', g.u, admin?.token); used = 'GET'; }
    gone.push({ face: g.u, method_used: used, status: r.status, code: r.code, pass: r.status === 410 });
  }
  const floors = {
    create_fee_floor_src: numOf('CURRENCY_CREATE_FEE_FLOOR'),
    list_fee_floor_src: numOf('CURRENCY_LIST_FEE_FLOOR'),
    list_deposit_floor_src: numOf('CURRENCY_LIST_DEPOSIT_FLOOR'),
  };
  // C1 低于下限 ⇒ 400（不会落库：被拒）；C2 试探（可能先被 ownership 挡）
  const c1 = await call('POST', '/api/currency', admin?.token, { symbol: 'A1CAPX', name: 'A1CAP floor probe', fee: 9999 }, { 'idempotency-key': `cli:a1cap-${tag}-c1floor` });
  const c2 = await call('POST', '/api/currency/1/list', admin?.token, { listing_fee: 9999, deposit_amount: 49999 }, { 'idempotency-key': `cli:a1cap-${tag}-c2floor` });

  // ---- 后置读数 ---------------------------------------------------------------
  const post = await snap();
  const postRows = await rowsFor([targetUid, absentUid]);
  out.post = { snap: post, rows: postRows };
  out.delta = {
    sigma: String(Number(post.sigma) - Number(pre.sigma)),
    sbal: String(Number(post.sbal) - Number(pre.sbal)),
    sfrz: String(Number(post.sfrz) - Number(pre.sfrz)),
    ledger_entries: post.entries - pre.entries,
    kinds_changed: Object.keys(post.kinds).filter((k) => (pre.kinds[k] || 0) !== post.kinds[k]).map((k) => ({ kind: k, pre: pre.kinds[k] || 0, post: post.kinds[k] })),
  };
  out.results = results;
  out.failed = results.filter((r) => r.pass === false).map((r) => r.id);
  out.regression = { health: { status: health.status }, home: { status: home.status }, gone_410: gone, gone_pass: gone.filter((g) => g.pass).length + '/' + gone.length, route_count_from_src: routeCount, floors, c1_below_floor: { status: c1.status, code: c1.code, reason: c1.reason }, c2_below_floor: { status: c2.status, code: c2.code, reason: c2.reason } };
  out.finished_at = new Date().toISOString();

  fs.writeFileSync(path.join(outDir, `a1cap-01-e2e.${MODE}.json`), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(outDir, `a1cap-01-e2e.${MODE}.log`), results.map((r) => `${r.id} ${r.status} ${r.code} ${r.reason} ${r.pass}`).join('\n') + '\n');
  console.log(JSON.stringify({ outDir, failed: out.failed, delta: out.delta, gone: out.regression.gone_pass, route_count: routeCount, floors, c1: out.regression.c1_below_floor, c2: out.regression.c2_below_floor }));
  if (MODE === 'post' && (out.failed as string[]).length) process.exitCode = 1;
})().catch((e) => {
  console.error('E2E_ERROR', String(e).slice(0, 500));
  process.exitCode = 2;
});
