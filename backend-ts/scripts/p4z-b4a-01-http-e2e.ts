/*
 * p4z-b4a-01-http-e2e.ts — P4-B4a 路由层注册：逐条 HTTP 实测（成功 + 负例）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b4a-01-http-e2e.ts <runDirAbs>
 * 口径（§5.7）：
 *   ① 真 token = `.env.local` 的 `SECRET_KEY`（HS256，payload {sub,evm,exp}）；**密钥/token 本体不落盘**（只记 12 位指纹）
 *   ② 逐条：**成功路径 + ≥1 负例**，报 status + 响应键集（top / data）+ 错码；403/401 同报「零分录」读数（无 access log ⇒ NOT_MEASURED）
 *   ③ 资金面：pre/post `Σtotal`（基线 2,020,100；纯转移不得变）；夹具幂等键一律 `cli:b4a:*`；**零删除 SQL**（只 SELECT + 经 HTTP 写）
 *   ④ 退出码直接取（不经管道）；产物 run-tagged + 绝对路径
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE = 'http://127.0.0.1:5788';
const PANEL = 'http://127.0.0.1:5555';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
const RUN = path.basename(outDir);
const TAG = `b4a${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const K = (s: string) => `cli:b4a:${TAG}:${s}`;
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xb4a${String(uid).padStart(4, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', SECRET).update(unsigned).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Call = { status: number | string; top: string[]; data: string[]; code: string | null; msg: string; head: string; json: any };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown; hdr?: Record<string, string> } = {}): Promise<Call> => {
  const headers: Record<string, string> = { ...(opts.hdr || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return {
      status: res.status,
      top: json && typeof json === 'object' ? Object.keys(json) : [],
      data: json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? Object.keys(json.data) : [],
      code: json?.error?.code ?? null,
      msg: String(json?.message ?? '').slice(0, 80),
      head: text.slice(0, 200),
      json,
    };
  } catch (e) {
    return { status: 'NETERR', top: [], data: [], code: null, msg: String(e).slice(0, 120), head: '', json: null };
  }
};
// 该版本 `@neondatabase/serverless` 的客户端**只有 tagged-template 通道**（无 `sql.query`/`unsafe`）
// ⇒ 本助手把 `$n` 占位式调用安全转成 tagged-template 调用（**值走参数**，绝不做字符串拼接）
const raw = async <T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> => {
  const parts: string[] = [];
  const values: unknown[] = [];
  let buf = '';
  for (let i = 0; i < query.length; i += 1) {
    if (query[i] === '$' && /\d/.test(query[i + 1] ?? '')) {
      let j = i + 1; let num = '';
      while (j < query.length && /\d/.test(query[j])) { num += query[j]; j += 1; }
      parts.push(buf); buf = '';
      values.push(params[Number(num) - 1]);
      i = j - 1;
    } else buf += query[i];
  }
  parts.push(buf);
  const strings = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray;
  return (await (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown>)(strings, ...values)) as T[];
};

const results: Record<string, unknown> = { run: RUN, tag: TAG, secret_fingerprint: fp(SECRET), tests: {}, fixtures: {}, invariants: {} };
const tests = results.tests as Record<string, unknown>;
const rec = (id: string, extra: Record<string, unknown> = {}) => { tests[id] = { ...(tests[id] as object || {}), ...extra }; return tests[id]; };
const say = (id: string, c: Call, extra: Record<string, unknown> = {}) => {
  const row = { status: c.status, code: c.code, data_keys: c.data, top_keys: c.top, msg: c.msg, ...extra };
  tests[id] = row;
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: data=[${c.data.join(',')}]${extra.note ? ' :: ' + String(extra.note) : ''}`);
  return row;
};
const sigmaTotal = async () => String(((await raw(`SELECT COALESCE(SUM(balance+frozen),0)::text AS t FROM public.account`))[0] as any).t);
const ledgerCount = async () => Number(((await raw(`SELECT COUNT(1)::int AS n FROM public.ledger_entry`))[0] as any).n);
const legsOf = async (rootKey: string) => raw(`SELECT uid::text AS uid, kind, delta::text AS delta, frozen_delta::text AS frozen_delta
   FROM public.ledger_entry WHERE event_root_key = $1 ORDER BY txid`, [rootKey]);

async function main() {
  // ---------- pre 快照 ----------
  const preLedger = await ledgerCount();
  results.invariants = { sigma_total_pre: await sigmaTotal(), ledger_rows_pre: preLedger, sigma_total_baseline: '2020200?', };
  (results.invariants as any).sigma_total_baseline = '2020100 (派单给定基线 · 本片 pre 现取见 sigma_total_pre)';

  // ---------- 夹具选人（token 有效性用既有 GET /api/user 验证；不猜 schema） ----------
  const accounts = await raw<{ uid: string; bal: string }>(
    `SELECT uid::text AS uid, balance::text AS bal FROM public.account WHERE cid = 1 AND uid > 0 ORDER BY balance DESC LIMIT 8`);
  const accounts2 = await raw<{ uid: string; bal: string }>(
    `SELECT uid::text AS uid, balance::text AS bal FROM public.account WHERE cid = 1 AND uid > 0 ORDER BY uid LIMIT 40`);
  const pool = [...accounts, ...accounts2].filter((a, i, arr) => arr.findIndex((b) => b.uid === a.uid) === i);
  const cand: Array<{ uid: number; bal: string; user_ok: boolean; can_access_admin: boolean }> = [];
  for (const a of pool) {
    const uid = Number(a.uid);
    const me = await call('GET', '/api/user', { token: jwt(uid) });
    const adm = await call('GET', '/api/admin/me', { token: jwt(uid) });
    cand.push({ uid, bal: a.bal, user_ok: me.status === 200, can_access_admin: adm.json?.data?.can_access_admin === true });
  }
  const admins = cand.filter((c) => c.user_ok && c.can_access_admin);
  // ★ 管理员发现（§6.1 `can_access_admin = users.is_admin OR admin_user_role OR EVM=默认管理员地址`）：
  //   ① 扫 uid 1..40 + 若干历史夹具 uid 的 `/api/admin/me`（**以 API 回执为准**，不猜 schema）
  //   ② 另试 `users.is_admin` 直查（列名两种写法，失败即忽略——**不据此断言**）
  const scanUids = [...Array(40).keys()].map((i) => i + 1).concat([100, 101, 102, 999, 1000, 1001, 1002, 970001, 970002]);
  const found: Array<Record<string, unknown>> = [];
  for (const uid of scanUids) {
    const adm = await call('GET', '/api/admin/me', { token: jwt(uid) });
    if (adm.status === 200 && adm.json?.data?.can_access_admin === true) found.push({ uid, source: 'scan' });
  }
  for (const q of [`SELECT uid::text AS uid FROM public.users WHERE is_admin IS TRUE ORDER BY uid LIMIT 3`,
    `SELECT "uID"::text AS uid FROM public.users WHERE "is_admin" IS TRUE ORDER BY "uID" LIMIT 3`]) {
    try {
      const r = await raw<{ uid: string }>(q);
      for (const x of r) if (!found.some((f) => Number(f.uid) === Number(x.uid))) found.push({ uid: Number(x.uid), source: 'db_is_admin' });
    } catch (e) { found.push({ db_query_failed: q.slice(0, 40), err: String(e).slice(0, 60) }); }
  }
  for (const f of found.filter((x) => x.source === 'db_is_admin')) {
    const adm = await call('GET', '/api/admin/me', { token: jwt(Number(f.uid)) });
    f.verified = adm.status === 200 && adm.json?.data?.can_access_admin === true;
  }
  const admIds = found.filter((f) => f.source === 'scan' || f.verified === true).map((f) => Number(f.uid));
  if (admIds.length) admins.push({ uid: admIds[0], bal: 'n/a', user_ok: true, can_access_admin: true });
  const nonAdmins = cand.filter((c) => c.user_ok && !c.can_access_admin);
  const admin = admins[0] ?? null;
  const pool2 = [...nonAdmins, ...admins]; // 优先非 admin（403 负例需要真非管理员）
  const emp = pool2.find((c) => BigInt(c.bal) >= 100n);
  const worker = pool2.find((c) => c.uid !== emp?.uid && BigInt(c.bal) >= 10n);
  const nonAdmin = nonAdmins[0] ?? null;
  results.fixtures = {
    candidates: cand, admin_uid: admin?.uid ?? null, employer_uid: emp?.uid ?? null,
    worker_uid: worker?.uid ?? null, non_admin_uid: nonAdmin?.uid ?? null,
    admin_count: admins.length, non_admin_count: nonAdmins.length, admin_discovery: found,
  };
  if (!emp || !worker) { console.log('FIXTURE_MISSING', JSON.stringify(results.fixtures)); fs.writeFileSync(path.join(outDir, 'post', 'b4a-http.json'), JSON.stringify(results, null, 2)); return; }
  const T_ADM = jwt(admin?.uid ?? emp.uid), T_EMP = jwt(emp.uid), T_WRK = jwt(worker.uid);
  // 403 负例专用 token：真非管理员（无 `can_access_admin`）；若无 ⇒ 用 worker（并在报告标口径）
  const T_NA = jwt(nonAdmin?.uid ?? worker.uid);
  if (!nonAdmin) (results.fixtures as any).non_admin_note = 'NOT_MEASURED_IN_FIXTURE: 候选池内无 can_access_admin=false 的用户 ⇒ 403 负例退化为「非 admin 权限」观测';
  if (!admin) (results.fixtures as any).admin_note = 'NOT_MEASURED: 未发现任何 can_access_admin=true 的用户 ⇒ A5/A6/A11 的成功面本 run 未测（其负例照测并如实记录）';

  const cur = await raw<{ cid: string; owner: string }>(`SELECT cid::text AS cid, owner_uid::text AS owner FROM public.currency WHERE status = 'listed' ORDER BY cid LIMIT 3`);
  const listedCid = Number(cur[0]?.cid ?? 0);
  (results.fixtures as any).listed_cids = cur;
  (results.fixtures as any).used_cid = listedCid;

  // ============ A1 · POST /api/job ============
  say('A1_neg_no_key', await call('POST', '/api/job', { token: T_EMP, body: { cid: listedCid, reward: '5', title: 'b4a no key' } }));
  const j1 = await call('POST', '/api/job', { token: T_EMP, body: { cid: listedCid, reward: '5', title: `b4a job1 ${TAG}`, create_key: K('job1') } });
  const j1full = await call('POST', '/api/job', { token: T_EMP, body: { cid: listedCid, reward: '5', title: `b4a job1 ${TAG}`, create_key: K('job1') } }); // 同键重投（幂等重放）
  const job1 = Number((await raw(`SELECT job_id::text AS id FROM public.job WHERE create_key = $1`, [K('job1')]))[0]?.id ?? 0);
  say('A1_ok', j1, { job_id: job1, escrow_legs: await legsOf(`biz:job:escrow:${job1}`) });
  say('A1_replay', j1full, { note: '同 key 重投', job_id: job1, legs_after_replay: (await legsOf(`biz:job:escrow:${job1}`)).length });

  // ============ A2 · POST /api/job/:jobId/apply ============
  say('A2_neg_missing_job', await call('POST', '/api/job/999999999/apply', { token: T_WRK, body: { create_key: K('apply_miss') } }));
  const a1 = await call('POST', `/api/job/${job1}/apply`, { token: T_WRK, body: { create_key: K('apply1') } });
  const app1 = Number((await raw(`SELECT application_id::text AS id FROM public.job_application WHERE create_key = $1`, [K('apply1')]))[0]?.id ?? 0);
  const a1replay = await call('POST', `/api/job/${job1}/apply`, { token: T_WRK, body: { create_key: K('apply1') } });
  say('A2_ok', a1, { job_id: job1, application_id: app1 });
  say('A2_replay', a1replay, { application_id: app1 });
  say('A2_neg_already_applied', await call('POST', `/api/job/${job1}/apply`, { token: T_WRK, body: { create_key: K('apply_dupkey') } }), { application_id: app1 });

  // ============ A3 · POST /api/job/:jobId/accept ============
  const preA3 = await ledgerCount();
  say('A3_neg_not_employer', await call('POST', `/api/job/${job1}/accept`, { token: T_WRK, body: { application_id: app1 } }), { ledger_entries_delta: (await ledgerCount()) - preA3 });
  say('A3_ok', await call('POST', `/api/job/${job1}/accept`, { token: T_EMP, body: { application_id: app1 } }), { application_id: app1 });
  const preA3b = await ledgerCount();
  say('A3_neg_already_accepted', await call('POST', `/api/job/${job1}/accept`, { token: T_EMP, body: { application_id: app1 } }), { ledger_entries_delta: (await ledgerCount()) - preA3b });

  // ============ A4 · POST /api/job/:jobId/submit（别名；键集须与既有路径一致）============
  say('A4_neg_missing_deliverable', await call('POST', `/api/job/${app1}/submit`, { token: T_WRK, body: {} }));
  const sub1 = await call('POST', `/api/job/${app1}/submit`, { token: T_WRK, body: { deliverable: `b4a deliverable ${TAG}`, create_key: K('sub1') } });
  say('A4_ok', sub1, { identifier: app1 });
  // 链 #2（同一 service verb 的既有路径）⇒ 键集对拍
  const j2 = await call('POST', '/api/job', { token: T_EMP, body: { cid: listedCid, reward: '5', title: `b4a job2 ${TAG}`, create_key: K('job2') } });
  const job2 = Number((await raw(`SELECT job_id::text AS id FROM public.job WHERE create_key = $1`, [K('job2')]))[0]?.id ?? 0);
  await call('POST', `/api/job/${job2}/apply`, { token: T_WRK, body: { create_key: K('apply2') } });
  const app2 = Number((await raw(`SELECT application_id::text AS id FROM public.job_application WHERE create_key = $1`, [K('apply2')]))[0]?.id ?? 0);
  await call('POST', `/api/job/${job2}/accept`, { token: T_EMP, body: { application_id: app2 } });
  const sub2 = await call('POST', `/api/task-progress/${app2}/submit`, { token: T_WRK, body: { info_input: `b4a deliverable2 ${TAG}`, create_key: K('sub2') } });
  say('A4_keySet_parity', sub2, { note: '既有路径 /api/task-progress/:identifier/submit', alias_data_keys: sub1.data, sibling_data_keys: sub2.data, identical: JSON.stringify(sub1.data) === JSON.stringify(sub2.data), job2, app2, job2_status: j2.status });

  // ============ A5 · POST /api/job/:jobId/review ============
  const preA5 = await ledgerCount();
  say('A5_neg_non_admin', await call('POST', `/api/job/${job1}/review`, { token: T_WRK, body: { approved: true } }), { ledger_entries_delta: (await ledgerCount()) - preA5 });
  const rv1 = await call('POST', `/api/job/${job1}/review`, { token: T_ADM, body: { approved: true } });
  say('A5_ok_approve', rv1, { job_id: job1, settle_legs: await legsOf(`biz:job:settle:${job1}`) });
  const rv1b = await call('POST', `/api/job/${job1}/review`, { token: T_ADM, body: { approved: true } });
  say('A5_replay_approve', rv1b, { note: '同键（DB 派生）重投' });
  const rv2 = await call('POST', `/api/job/${job2}/review`, { token: T_ADM, body: { approved: false } });
  say('A5_ok_reject', rv2, { job_id: job2, refund_legs: await legsOf(`biz:job:refund:${job2}`) });

  // ============ A6 · POST /api/job/:jobId/cancel ============
  await call('POST', '/api/job', { token: T_EMP, body: { cid: listedCid, reward: '5', title: `b4a job3 ${TAG}`, create_key: K('job3') } });
  const job3 = Number((await raw(`SELECT job_id::text AS id FROM public.job WHERE create_key = $1`, [K('job3')]))[0]?.id ?? 0);
  const preA6 = await ledgerCount();
  say('A6_neg_non_admin', await call('POST', `/api/job/${job3}/cancel`, { token: T_WRK, body: {} }), { ledger_entries_delta: (await ledgerCount()) - preA6 });
  say('A6_ok_cancel', await call('POST', `/api/job/${job3}/cancel`, { token: T_ADM, body: {} }), { job_id: job3, refund_legs: await legsOf(`biz:job:refund:${job3}`) });
  say('A6_neg_state', await call('POST', `/api/job/${job1}/cancel`, { token: T_ADM, body: {} }), { note: 'job1 已 settled ⇒ 状态机拒' });
  const noEscrow = await raw<{ id: string; st: string }>(`SELECT job_id::text AS id, status AS st FROM public.job WHERE escrow_txid IS NULL ORDER BY job_id DESC LIMIT 1`);
  if (noEscrow.length) say('A6_neg_escrow_missing', await call('POST', `/api/job/${noEscrow[0].id}/cancel`, { token: T_ADM, body: {} }), { note: `escrow_txid IS NULL（job ${noEscrow[0].id} / status=${noEscrow[0].st}）` });
  else tests.A6_neg_escrow_missing = 'NOT_MEASURED: 库内无 escrow_txid IS NULL 的 job 行';

  // ============ A7 · POST /api/listing ============
  say('A7_neg_shape', await call('POST', '/api/listing', { token: T_EMP, body: { cid: listedCid, stock: 3, create_key: K('ls_bad') } }), { note: '缺 price' });
  const ls = await call('POST', '/api/listing', { token: T_EMP, body: { cid: listedCid, price: 1, stock: 3, title: `b4a listing ${TAG}`, create_key: K('ls1') } });
  const listingId = Number((await raw(`SELECT listing_id::text AS id FROM public.listing WHERE create_key = $1`, [K('ls1')]))[0]?.id ?? 0);
  const lsStatus = String(((await raw<{ s: string }>(`SELECT status AS s FROM public.listing WHERE listing_id = $1`, [String(listingId)]))[0]?.s) ?? '');
  if (lsStatus !== 'listed' && listingId) await call('PATCH', `/api/listing/${listingId}`, { token: T_EMP, body: { to_status: 'listed' } });
  say('A7_ok', ls, { listing_id: listingId, status_in_db_before_patch: lsStatus, status_in_db_after: String(((await raw<{ s: string }>(`SELECT status AS s FROM public.listing WHERE listing_id = $1`, [String(listingId)]))[0]?.s) ?? '') });

  // ============ A8 · POST（编辑）/ PATCH（状态迁移）============
  const preA8 = await ledgerCount();
  say('A8_neg_not_owner', await call('POST', `/api/listing/${listingId}`, { token: T_WRK, body: { price: 2 } }), { ledger_entries_delta: (await ledgerCount()) - preA8 });
  say('A8_ok_update', await call('POST', `/api/listing/${listingId}`, { token: T_EMP, body: { price: 2 } }), { listing_id: listingId, price_in_db: String(((await raw<{ p: string }>(`SELECT price::text AS p FROM public.listing WHERE listing_id = $1`, [String(listingId)]))[0]?.p) ?? '') });
  say('A8_neg_no_field', await call('POST', `/api/listing/${listingId}`, { token: T_EMP, body: {} }));

  // ============ A9 · POST /api/listing/:listingId/buy ============
  say('A9_neg_no_key', await call('POST', `/api/listing/${listingId}/buy`, { token: T_WRK, body: { quantity: 1 } }));
  const by = await call('POST', `/api/listing/${listingId}/buy`, { token: T_WRK, body: { quantity: 1, create_key: K('buy1'), price: 99999, seller_uid: 99999, buyer_uid: 99999 } });
  const orderId = Number((await raw(`SELECT order_id::text AS id FROM public.listing_order WHERE create_key = $1`, [K('buy1')]))[0]?.id ?? 0);
  say('A9_ok', by, { listing_id: listingId, order_id: orderId, buy_legs: await legsOf(`biz:listing:buy:${orderId}`) });

  // ============ A10 · POST /api/listing-orders/:orderId/refund ============
  const preA10 = await ledgerCount();
  say('A10_neg_not_seller', await call('POST', `/api/listing-orders/${orderId}/refund`, { token: T_WRK, body: {} }), { ledger_entries_delta: (await ledgerCount()) - preA10 });
  say('A10_ok', await call('POST', `/api/listing-orders/${orderId}/refund`, { token: T_EMP, body: {} }), { order_id: orderId, refund_legs: await legsOf(`biz:listing:refund:${orderId}`) });

  // ============ A8-b · PATCH 下架 + delisted 终态（§7-18）============
  say('A8b_ok_transition_delisted', await call('PATCH', `/api/listing/${listingId}`, { token: T_EMP, body: { to_status: 'delisted' } }), { listing_id: listingId });
  const preA8c = await ledgerCount();
  say('A8b_neg_delisted_terminal', await call('PATCH', `/api/listing/${listingId}`, { token: T_EMP, body: { to_status: 'listed' } }), { ledger_entries_delta: (await ledgerCount()) - preA8c });

  // ============ A11 · POST /api/admin/commission_policy ============
  const pol = await raw<{ fee: number; levels: number; w: string; eff: string }>(
    `SELECT fee_rate_bp::int AS fee, levels::int AS levels, weights_bp::text AS w, effective_from::text AS eff
       FROM public.commission_policy ORDER BY effective_from DESC LIMIT 1`);
  const maxEff = (await raw<{ m: string }>(`SELECT MAX(effective_from)::text AS m FROM public.commission_policy`))[0]?.m ?? null;
  const base = Math.max(Date.now(), maxEff ? Date.parse(maxEff) : 0);
  const newEff = new Date(base + 86400000).toISOString();
  const wArr = String(pol[0]?.w ?? '{5000,5000}').replace(/[{}]/g, '').split(',').map((x) => Number(x)).filter((n) => !Number.isNaN(n));
  (results.fixtures as any).commission_policy_current = { ...pol[0], new_effective_from: newEff };
  say('A11_neg_fee_out_of_range', await call('POST', '/api/admin/commission_policy', { token: T_ADM, body: { fee_rate_bp: 9999, levels: 1, weights_bp: [10000] } }));
  say('A11_neg_non_admin', await call('POST', '/api/admin/commission_policy', { token: T_WRK, body: { fee_rate_bp: 200, levels: 1, weights_bp: [10000] } }));
  say('A11_ok', await call('POST', '/api/admin/commission_policy', { token: T_ADM, body: { fee_rate_bp: Number(pol[0]?.fee ?? 200), levels: Number(pol[0]?.levels ?? 2), weights_bp: wArr, effective_from: newEff } }), { note: `与现行政策同参、effective_from=${newEff}（严格递增 ⇒ 行为不变）` });

  // ---------- post 快照 ----------
  (results.invariants as any).sigma_total_post = await sigmaTotal();
  (results.invariants as any).ledger_rows_post = await ledgerCount();
  (results.invariants as any).job_rows = await raw(`SELECT job_id::text AS id, status, escrow_txid::text AS esc, settle_txid::text AS st FROM public.job WHERE create_key LIKE $1 ORDER BY job_id`, [`cli:b4a:${TAG}%`]);
  (results.invariants as any).kinds_total = await raw(`SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`);
  (results.invariants as any).commission_policy_rows = await raw(`SELECT policy_id::text, fee_rate_bp, levels, effective_from::text, created_by::text FROM public.commission_policy ORDER BY effective_from`);

  fs.writeFileSync(path.join(outDir, 'post', 'b4a-http.json'), JSON.stringify(results, null, 2));
  console.log('SIGMA_PRE=' + (results.invariants as any).sigma_total_pre + ' SIGMA_POST=' + (results.invariants as any).sigma_total_post);
  console.log('LEDGER_PRE=' + preLedger + ' LEDGER_POST=' + (results.invariants as any).ledger_rows_post);
  console.log('ARTIFACT=' + path.join(outDir, 'post', 'b4a-http.json'));
}

main().catch((e) => { console.log('FATAL ' + String(e)); process.exitCode = 1; });
void PANEL;
