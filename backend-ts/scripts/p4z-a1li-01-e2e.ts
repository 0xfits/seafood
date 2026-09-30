// p4z-a1li-01-e2e.ts — A1-LEDGER-IMPL（`POST /api/admin/points/adjust` 改接账本）**实测**
// ============================================================================
// 用法：node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-a1li-01-e2e.ts <outDirAbs> <pre|post>
//   pre  = 改前基线（只记录，不判定）；post = 改后（逐例判定，任一 FAIL ⇒ exit 1）
// 口径（Zang §5.99 + §5.7）：
//   · 真 token = `.env.local` 的 `SECRET_KEY`（经生产签名器 `src/auth.createSessionToken`）；
//     产物**只落 12 位指纹**，不落 token / 密钥本体；
//   · 夹具 = **一次性新造 uid**（`public."users"` 新行，evm 由 run tag 派生，`a1li-*` 命名空间）；
//     夹具金额自备（先由本路由铸给夹具账户）；**零 DELETE SQL**（夹具残留已在报告登记）；
//   · 幂等键 = 规范形 `ops:<admin_uid>:points_adjust:<target_uid>:1:<seq>`（DL146② / DL36）；
//   · 逐例前后读数（Σtotal(cid=1) / ledger_entry 计数与逐 kind / 夹具账户行）⇒ **可逐笔归因**；
//   · 退出码**直接取**（不经管道）；产物 run-tagged + 绝对路径。
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'a1li-run'));
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
const hex40 = (seed: string) => crypto.createHash('sha256').update(seed).digest('hex').slice(0, 40);

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

type Snap = { sigma: string; entries: number; kinds: Record<string, number> };
const snap = async (): Promise<Snap> => {
  const s = await sql<{ sigma: string }>('SELECT COALESCE(sum(balance+frozen),0)::text AS sigma FROM public.account WHERE cid = 1');
  const e = await sql<{ n: number }>('SELECT count(*)::int AS n FROM public.ledger_entry');
  const k = await sql<{ kind: string; n: number }>('SELECT kind, count(*)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY 1');
  return { sigma: String(s[0].sigma), entries: Number(e[0].n), kinds: Object.fromEntries(k.map((r) => [r.kind, Number(r.n)])) };
};
const rowOf = async (uid: number) =>
  sql<{ bal: string; frz: string }>(`SELECT balance::text AS bal, frozen::text AS frz FROM public.account WHERE uid = ${uid} AND cid = 1`);
const totalOf = async (uid: number) =>
  sql<{ m: string }>(`SELECT COALESCE(sum(balance+frozen),0)::text AS m FROM public.account WHERE uid = ${uid} AND cid = 1`);

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

type Case = {
  id: string; note: string; who: 'admin' | 'nonadmin' | 'none'; key?: string | null; body?: unknown;
  expect: number | null; expectCode?: string | null; expectReason?: string | null; expectOp?: string | null;
};
const results: Array<Record<string, unknown>> = [];

/** 一次性夹具：`public."users"` 新行（evm 由 run tag 派生 ⇒ 幂等可复跑） */
const ensureUser = async (tag: string, isAdmin = false): Promise<{ uid: number; created: boolean }> => {
  const evm = `0x${hex40(`a1li-${RUN}-${tag}`)}`;
  await sql(`INSERT INTO public."users" (evm, is_admin) VALUES ('${evm}', ${isAdmin ? 'true' : 'false'}) ON CONFLICT (evm) DO NOTHING`);
  const r = await sql<{ uid: string }>(`SELECT uid::text AS uid FROM public."users" WHERE evm = '${evm}'`);
  return { uid: Number(r[0].uid), created: true };
};

(async () => {
  const out: Record<string, unknown> = { run: RUN, mode: MODE, base: BASE, cap_const_in_src: CAP_IN_SRC, route_count_from_src: routeCount, started_at: new Date().toISOString() };

  // ---- 夹具（新造一次性 uid） -----------------------------------------------------
  const target = await ensureUser('target');
  const nonadminFix = await ensureUser('nonadmin', false);
  out.fixtures = { target_uid: target.uid, nonadmin_uid: nonadminFix.uid };

  // ---- actor 发现 ---------------------------------------------------------------
  const jwtFor = async (uid: number) => {
    const u = await sql<{ evm: string }>(`SELECT evm FROM public."users" WHERE uid = ${uid}`);
    if (!u.length) return null;
    const t = auth.createSessionToken({ uID: uid, evm: String(u[0].evm) });
    return { token: t, fp: fp12(t) };
  };
  let admin: { uid: number; fp: string; token: string } | null = null;
  const adminCands = await sql<{ uid: string }>('SELECT uid::text AS uid FROM public."users" WHERE is_admin = true ORDER BY uid LIMIT 4');
  for (const c of adminCands) {
    const uid = Number(c.uid);
    const j = await jwtFor(uid);
    if (!j) continue;
    const adm = await call('GET', '/api/admin/me', j.token);
    if ((adm.body?.data as Record<string, unknown> | undefined)?.can_access_admin === true) { admin = { uid, fp: j.fp, token: j.token }; break; }
  }
  const nonadminTok = await jwtFor(nonadminFix.uid);
  out.actors = {
    admin: admin ? { uid: admin.uid, token_fp12: admin.fp } : null,
    nonadmin: nonadminTok ? { uid: nonadminFix.uid, token_fp12: nonadminTok.fp } : null,
    secret_key_fp12: fp12(String(process.env.SECRET_KEY || '')),
  };

  // ---- 结构面 -------------------------------------------------------------------
  const tbl = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='asset'`);
  out.asset_table_exists = Number(tbl[0].n) > 0;
  out.target_row_before = await rowOf(target.uid);
  out.pre = await snap();

  // ---- 用例 ---------------------------------------------------------------------
  const tag = RUN.replace(/^a1li-/, '');
  const K = (seq: string) => `ops:${admin ? admin.uid : 0}:points_adjust:${target.uid}:1:${tag}-${seq}`;
  const MINT = 137; const BURN = 37; const BIG = 100000;
  const post = MODE === 'post';
  const cases: Case[] = [
    { id: 'A01', note: `a) 正向 mint：amount=+${MINT}（key K1）`, who: 'admin', key: K('k1'), body: { uID: target.uid, amount: MINT, reason: 'A1LI mint fixture fund' }, expect: post ? 200 : null, expectOp: post ? 'mint' : null },
    { id: 'A02', note: `b) 负向 burn：amount=-${BURN}（key K2）`, who: 'admin', key: K('k2'), body: { uID: target.uid, amount: -BURN, reason: 'A1LI burn' }, expect: post ? 200 : null, expectOp: post ? 'burn' : null },
    { id: 'A03', note: `c) 边界上限：amount=+${BIG}（通过）`, who: 'admin', key: K('k3'), body: { uID: target.uid, amount: BIG, reason: 'A1LI at cap' }, expect: post ? 200 : null, expectOp: post ? 'mint' : null },
    { id: 'A04', note: `c) 边界上限：amount=-${BIG}（通过 ⇒ 回到 0 附近）`, who: 'admin', key: K('k4'), body: { uID: target.uid, amount: -BIG, reason: 'A1LI at cap burn' }, expect: post ? 200 : null, expectOp: post ? 'burn' : null },
    { id: 'A05', note: `c) 超上限：amount=+${BIG + 1} ⇒ 400 OVER_MAX_SINGLE_AMOUNT`, who: 'admin', key: K('k5'), body: { uID: target.uid, amount: BIG + 1, reason: 'A1LI over cap' }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID', expectReason: 'OVER_MAX_SINGLE_AMOUNT' },
    { id: 'A06', note: `c) 超上限（绝对値）：amount=-${BIG + 1} ⇒ 400 OVER_MAX_SINGLE_AMOUNT`, who: 'admin', key: K('k6'), body: { uID: target.uid, amount: -(BIG + 1), reason: 'A1LI over cap neg' }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID', expectReason: 'OVER_MAX_SINGLE_AMOUNT' },
    { id: 'A07', note: 'd) 零值：amount=0 ⇒ 400 NOT_A_POSITIVE_INTEGER', who: 'admin', key: K('k7'), body: { uID: target.uid, amount: 0, reason: 'A1LI zero' }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID', expectReason: 'NOT_A_POSITIVE_INTEGER' },
    { id: 'A08', note: 'e) 非 admin ⇒ 403（权限闸必须先于一切）', who: 'nonadmin', key: K('k8'), body: { uID: target.uid, amount: 1, reason: 'A1LI nonadmin' }, expect: 403, expectCode: 'AUTH_FORBIDDEN', expectReason: 'NOT_ADMIN' },
    { id: 'A08b', note: 'e) 非 admin + 超上限（权限闸优先 ⇒ 403 而非 400）', who: 'nonadmin', key: K('k8b'), body: { uID: target.uid, amount: BIG + 1, reason: 'A1LI nonadmin overcap' }, expect: 403, expectCode: 'AUTH_FORBIDDEN' },
    { id: 'A09', note: 'e) 无 token ⇒ 401', who: 'none', key: K('k9'), body: { uID: target.uid, amount: 1, reason: 'A1LI notoken' }, expect: 401, expectCode: 'AUTH_UNAUTHORIZED' },
    { id: 'A10', note: 'f) 目标 uid 不存在（987654321）⇒ 拒（不得造幽灵账户）', who: 'admin', key: K('k10'), body: { uID: 987654321, amount: 1, reason: 'A1LI ghost' }, expect: post ? 400 : null, expectCode: post ? 'LEDGER_RESERVED_UID' : null },
    { id: 'A10b', note: 'f) 目标 uid = -1（保留 uid）⇒ 拒（不得当目标用户）', who: 'admin', key: K('k10b'), body: { uID: -1, amount: 1, reason: 'A1LI reserved' }, expect: 400, expectCode: 'LEDGER_RESERVED_UID' },
    { id: 'A11', note: 'g) 幂等：同 key 重投（K1 同体）⇒ 200 replay + 零新增分录', who: 'admin', key: K('k1'), body: { uID: target.uid, amount: MINT, reason: 'A1LI mint fixture fund' }, expect: post ? 200 : null, expectOp: post ? 'mint' : null },
    { id: 'A12', note: 'g) 缺 key ⇒ 400 LEDGER_IDEMPOTENCY_KEY_REQUIRED', who: 'admin', key: null, body: { uID: target.uid, amount: 1, reason: 'A1LI nokey' }, expect: post ? 400 : null, expectCode: post ? 'LEDGER_IDEMPOTENCY_KEY_REQUIRED' : null },
    { id: 'A13', note: 'g) 非 ops: 前缀（cli:）⇒ 400 LEDGER_IDEMPOTENCY_KEY_INVALID + PREFIX_REQUIRED', who: 'admin', key: `cli:a1li-${tag}-badprefix`, body: { uID: target.uid, amount: 1, reason: 'A1LI badprefix' }, expect: post ? 400 : null, expectCode: post ? 'LEDGER_IDEMPOTENCY_KEY_INVALID' : null, expectReason: post ? 'PREFIX_REQUIRED' : null },
    { id: 'A14', note: 'h) 缺 reason ⇒ 既有 400「参数不完整」（未改）', who: 'admin', key: K('k14'), body: { uID: target.uid, amount: 1, reason: '' }, expect: 400 },
  ];

  for (const c of cases) {
    const token = c.who === 'admin' ? admin?.token : c.who === 'nonadmin' ? (nonadminTok ? nonadminTok.token : null) : null;
    const hdr: Record<string, string> = {};
    if (c.key) hdr['idempotency-key'] = c.key;
    const b4 = await snap();
    const b4row = await rowOf(target.uid);
    const r = await call('POST', '/api/admin/points/adjust', token, c.body, hdr);
    const af = await snap();
    const afRow = await rowOf(target.uid);
    const d = (x: number, y: number) => String(y - x);
    const data = (r.body?.data || {}) as Record<string, unknown>;
    const pass = c.expect === null ? null : r.status === c.expect
      && (c.expectCode === undefined || c.expectCode === null || r.code === c.expectCode)
      && (c.expectReason === undefined || c.expectReason === null || r.reason === c.expectReason)
      && (c.expectOp === undefined || c.expectOp === null || data.op === c.expectOp);
    const rec = {
      id: c.id, note: c.note, who: c.who, key_fp12: c.key ? fp12(c.key) : null, sent: c.body,
      status: r.status, code: r.code, reason: r.reason, msg: r.msg, resp_fp12: r.fp,
      resp_data: r.body?.data ?? null, idempotent_replay: data.idempotent_replay === true,
      sigma_pre: b4.sigma, sigma_post: af.sigma, sigma_delta: d(Number(b4.sigma), Number(af.sigma)),
      bal_pre: String(b4row[0]?.bal ?? '0'), bal_post: String(afRow[0]?.bal ?? '0'),
      bal_delta: d(Number(b4row[0]?.bal ?? 0), Number(afRow[0]?.bal ?? 0)),
      entries_pre: b4.entries, entries_post: af.entries, entries_delta: af.entries - b4.entries,
      kinds_delta: Object.keys(af.kinds).concat(Object.keys(b4.kinds)).filter((k, i, a) => a.indexOf(k) === i)
        .map((k) => ({ kind: k, delta: (af.kinds[k] || 0) - (b4.kinds[k] || 0) })).filter((x) => x.delta !== 0),
      expect: c.expect, pass,
    };
    results.push(rec);
    console.log(`[${c.id}] status=${r.status} code=${r.code} reason=${r.reason} sigma_d=${rec.sigma_delta} bal_d=${rec.bal_delta} ent_d=${rec.entries_delta} pass=${pass}`);
  }

  // ---- 回归面 -------------------------------------------------------------------
  const health = await call('GET', '/health');
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
  const c1 = await call('POST', '/api/currency', admin?.token, { symbol: `A1LI${tag}`.slice(0, 12).toUpperCase(), name: 'A1LI floor probe', fee: 9999 }, { 'idempotency-key': `cli:a1li-${tag}-c1floor` });
  const c2 = await call('POST', '/api/currency/1/list', admin?.token, { listing_fee: 9999, deposit_amount: 49999 }, { 'idempotency-key': `cli:a1li-${tag}-c2floor` });

  const post2 = await snap();
  out.target_row_after = await rowOf(target.uid);
  out.post = post2;
  out.delta_overall = {
    sigma_cid1: String(Number(post2.sigma) - Number(out.pre ? (out.pre as Snap).sigma : 0)),
    ledger_entries: post2.entries - (out.pre as Snap).entries,
    kinds_changed: Object.keys(post2.kinds).filter((k) => ((out.pre as Snap).kinds[k] || 0) !== post2.kinds[k]).map((k) => ({ kind: k, pre: (out.pre as Snap).kinds[k] || 0, post: post2.kinds[k] })),
  };
  out.results = results;
  out.failed = results.filter((r) => r.pass === false).map((r) => r.id);
  out.replay_face = results.find((r) => r.id === 'A11') ?? null;
  out.regression = {
    health: { status: health.status }, gone_410: gone, gone_pass: gone.filter((g) => g.pass).length + '/' + gone.length,
    route_count_from_src: routeCount, floors,
    c1_below_floor: { status: c1.status, code: c1.code, reason: c1.reason },
    c2_below_floor: { status: c2.status, code: c2.code, reason: c2.reason },
  };
  out.finished_at = new Date().toISOString();

  fs.writeFileSync(path.join(outDir, `a1li-01-e2e.${MODE}.json`), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(outDir, `a1li-01-e2e.${MODE}.log`), results.map((r) => `${r.id} status=${r.status} code=${r.code} reason=${r.reason} sigma_d=${r.sigma_delta} bal_d=${r.bal_delta} ent_d=${r.entries_delta} pass=${r.pass}`).join('\n') + '\n');
  console.log(JSON.stringify({ outDir, failed: out.failed, delta_overall: out.delta_overall, gone: out.regression.gone_pass, route_count: routeCount, floors, c1: out.regression.c1_below_floor, c2: out.regression.c2_below_floor }));
  if (MODE === 'post' && (out.failed as string[]).length) process.exitCode = 1;
})().catch((e) => {
  console.error('E2E_ERROR', String(e).slice(0, 500));
  process.exitCode = 2;
});
