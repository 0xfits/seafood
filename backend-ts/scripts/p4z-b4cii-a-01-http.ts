/*
 * p4z-b4cii-a-01-http.ts — P4-B4c-ii-a「招工线 + 我的」接线面：逐面真实 HTTP 实测
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b4cii-a-01-http.ts <runDirAbs>
 * 口径（§5.7）：
 *   ① token = `.env.local` 的 `SECRET_KEY` 现铸（HS256，payload {sub,evm,exp}）；**密钥 / token 本体一律不落盘**（只记 12 位指纹）
 *   ② 逐面「成功 + ≥1 负例」，报 status / `error.code` / 响应键集；**夹具幂等键一律 `cli:b4cii-*`**
 *   ③ **零删除 SQL**：只 SELECT + 经 HTTP 写；后端 `src/**` 零改动
 *   ④ 退出码在管道外取（本脚本自身 exitCode）；产物落 run-tagged 目录
 *   ⑤ 负例清单（硬要求）：非雇主 accept ⇒ `403`；未知 job ⇒ `404`；缺幂等键 publish ⇒ `400`；同实体异内容 submit ⇒ `409`
 *   ⑥ 「我的」读数面：`GET /api/user/asset/:uID`（已注册）；**账本流水读口未注册** ⇒ 本脚本只做「未注册事实」读数
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
const RUN = path.basename(outDir);
const TAG = `b4cii${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const K = (s: string) => `cli:b4cii:${TAG}:${s}`;
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xb4c${String(uid).padStart(4, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Call = { status: number | string; top: string[]; data: string[]; code: string | null; msg: string; json: any };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}): Promise<Call> => {
  const headers: Record<string, string> = {};
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
      msg: String(json?.error?.message ?? json?.message ?? '').slice(0, 80),
      json,
    };
  } catch (e) {
    return { status: 'NETERR', top: [], data: [], code: null, msg: String(e).slice(0, 120), json: null };
  }
};
// `@neondatabase/serverless` 该版本只有 tagged-template 通道 ⇒ `$n` 占位式安全转换（值走参数，不做字符串拼接）
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

const results: Record<string, unknown> = { run: RUN, tag: TAG, base: BASE, secret_fingerprint: fp(SECRET), tests: {}, fixtures: {}, invariants: {} };
const tests = results.tests as Record<string, unknown>;
const say = (id: string, c: Call, extra: Record<string, unknown> = {}) => {
  const row = { status: c.status, code: c.code, data_keys: c.data, top_keys: c.top, msg: c.msg, ...extra };
  tests[id] = row;
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: data=[${c.data.join(',')}]${extra.note ? ' :: ' + String(extra.note) : ''}`);
  return row;
};
const ledgerCount = async () => Number(((await raw(`SELECT COUNT(1)::int AS n FROM public.ledger_entry`))[0] as any).n);
const legsOf = async (rootKey: string) => raw(`SELECT uid::text AS uid, kind, delta::text AS delta, frozen_delta::text AS frozen_delta
   FROM public.ledger_entry WHERE event_root_key = $1 ORDER BY txid`, [rootKey]);

async function main() {
  const preLedger = await ledgerCount();
  // ---------- 夹具：雇主 / 打工人 / 管理员 ----------
  const accts = await raw<{ uid: string; bal: string }>(
    `SELECT uid::text AS uid, balance::text AS bal FROM public.account WHERE cid = 1 AND uid > 0 ORDER BY uid LIMIT 60`);
  const cands: Array<{ uid: number; bal: string; ok: boolean }> = [];
  for (const a of accts) {
    const uid = Number(a.uid);
    const me = await call('GET', '/api/user', { token: jwt(uid) });
    cands.push({ uid, bal: a.bal, ok: me.status === 200 });
  }
  const usable = cands.filter((c) => c.ok);
  const emp = usable.find((c) => BigInt(c.bal) >= 1000n) ?? null;
  const worker = usable.find((c) => c.uid !== emp?.uid && BigInt(c.bal) >= 10n) ?? null;
  let admin: { uid: number; can: boolean } | null = null;
  for (const c of usable) {
    const adm = await call('GET', '/api/admin/me', { token: jwt(c.uid) });
    if (adm.status === 200 && adm.json?.data?.can_access_admin === true) { admin = { uid: c.uid, can: true }; break; }
  }
  const cur = await raw<{ cid: string }>(`SELECT cid::text AS cid FROM public.currency WHERE status = 'listed' ORDER BY cid LIMIT 1`);
  const cid = Number(cur[0]?.cid ?? 0);
  results.fixtures = { employer_uid: emp?.uid ?? null, worker_uid: worker?.uid ?? null, admin_uid: admin?.uid ?? null, listed_cid: cid, candidate_count: usable.length };
  if (!emp || !worker) { console.log('FIXTURE_MISSING', JSON.stringify(results.fixtures)); fs.writeFileSync(path.join(outDir, 'post', 'b4cii-a-http.json'), JSON.stringify(results, null, 2)); return; }
  const T_EMP = jwt(emp.uid), T_WRK = jwt(worker.uid), T_ADM = admin ? jwt(admin.uid) : '';

  // ---------- ① 发布招工 POST /api/job（幂等键 = 前端提供 cli:）----------
  say('P1_neg_no_key', await call('POST', '/api/job', { token: T_EMP, body: { cid, reward: '12', title: `b4cii no key ${TAG}` } }), { note: '缺 create_key ⇒ fail-loud（job-funds-service.ts:84）' });
  say('P1_neg_unauth', await call('POST', '/api/job', { body: { cid, reward: '12', title: 'no token', create_key: K('noauth') } }), { note: '无 token ⇒ 401 R107' });
  const pub = await call('POST', '/api/job', { token: T_EMP, body: { cid, reward: '12', title: `b4cii job ${TAG}`, description: 'b4cii probe job', create_key: K('job1') } });
  const jobId = Number((await raw(`SELECT job_id::text AS id FROM public.job WHERE create_key = $1`, [K('job1')]))[0]?.id ?? 0);
  say('P1_ok', pub, { job_id: jobId, escrow_legs: await legsOf(`biz:job:escrow:${jobId}`), job_row: (await raw(`SELECT status, reward::text AS reward, employer_uid::text AS emp FROM public.job WHERE job_id = $1`, [String(jobId)]))[0] });
  say('P1_replay_same_key', await call('POST', '/api/job', { token: T_EMP, body: { cid, reward: '12', title: `b4cii job ${TAG}`, description: 'b4cii probe job', create_key: K('job1') } }), { job_id: jobId, note: '同键重投 ⇒ 200 + idempotent_replay（不得落第二行）' });
  const jobRows = await raw(`SELECT job_id::text AS id FROM public.job WHERE create_key = $1`, [K('job1')]);
  (results.invariants as any).job_rows_for_key = jobRows.length;

  // ---------- ② 列表可见（GET /api/task/all，无鉴权）----------
  const list = await call('GET', '/api/task/all?limit=200');
  const ids = Array.isArray(list.json?.data) ? list.json.data.map((r: any) => Number(r.tID)) : [];
  say('L1_list_visible', list, { job_in_list: ids.includes(jobId), list_len: ids.length, note: '发布后列表可见（GET /api/task/all ⇒ job）' });

  // ---------- ③ 详情 GET /api/task/:tID ----------
  say('D1_ok', await call('GET', `/api/task/${jobId}`), { job_id: jobId });
  say('D1_neg_miss_404', await call('GET', '/api/task/999999999'));

  // ---------- ④ 申请 POST /api/job/:jobId/apply（键 = 服务端派生 ⇒ 前端不传）----------
  say('A_neg_unknown_job', await call('POST', '/api/job/999999999/apply', { token: T_WRK, body: {} }));
  const app = await call('POST', `/api/job/${jobId}/apply`, { token: T_WRK, body: {} });
  const appId = Number((await raw(`SELECT application_id::text AS id FROM public.job_application WHERE job_id = $1 AND worker_uid = $2`, [String(jobId), String(worker.uid)]))[0]?.id ?? 0);
  const derivedKey = String(((await raw<{ k: string }>(`SELECT create_key AS k FROM public.job_application WHERE application_id = $1`, [String(appId)]))[0]?.k) ?? '');
  say('A_ok', app, { application_id: appId, server_derived_key: derivedKey, key_derived_by_server: derivedKey.startsWith('cli:p4b2a:apply:') });
  say('A_replay_same_entity', await call('POST', `/api/job/${jobId}/apply`, { token: T_WRK, body: {} }), { application_id: appId, note: '同实体重投（服务端同键）⇒ 200 重放' });
  say('A_neg_self_apply', await call('POST', `/api/job/${jobId}/apply`, { token: T_EMP, body: {} }), { note: '雇主自投 ⇒ 409 self_application_not_allowed' });

  // ---------- ⑤ 接受 POST /api/job/:jobId/accept（**非雇主 403 负例 = 硬要求**）----------
  const preA = await ledgerCount();
  say('AC_neg_not_employer_403', await call('POST', `/api/job/${jobId}/accept`, { token: T_WRK, body: { application_id: appId } }), { ledger_delta: (await ledgerCount()) - preA, note: '非雇主 ⇒ 403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED' });
  say('AC_ok_employer', await call('POST', `/api/job/${jobId}/accept`, { token: T_EMP, body: { application_id: appId } }), { application_id: appId, app_row: (await raw(`SELECT status, worker_uid::text AS w FROM public.job_application WHERE application_id = $1`, [String(appId)]))[0] });

  // ---------- ⑥ 提交 POST /api/task-progress/:identifier/submit（键 = 服务端派生）----------
  const sub = await call('POST', `/api/task-progress/${appId}/submit`, { token: T_WRK, body: { info_input: `b4cii deliverable ${TAG}` } });
  say('S_ok', sub, { application_id: appId, submission_row: (await raw(`SELECT review_status, create_key FROM public.job_submission WHERE job_id = $1 AND worker_uid = $2`, [String(jobId), String(worker.uid)]))[0] });
  // 契约 2（§4.5 v0.6）负例：同实体 + 异内容 ⇒ 409（不得静默 replay）
  say('S_neg_same_entity_other_content_409', await call('POST', `/api/task-progress/${appId}/submit`, { token: T_WRK, body: { info_input: `b4cii deliverable CHANGED ${TAG}` } }), { note: '同 (identifier,worker) 异内容 ⇒ 409 LEDGER_IDEMPOTENCY_CONFLICT / REPLAY_FINGERPRINT_MISMATCH' });
  // 别名面（已注册 §1.8 #4）：提交后状态已 submitted ⇒ 此处只验「路径存在且非 404」
  const subAlias = await call('POST', `/api/job/${appId}/submit`, { token: T_WRK, body: { info_input: `b4cii deliverable ${TAG}` } });
  (results.invariants as any).alias_face = { status: subAlias.status, code: subAlias.code, note: '别名面 /api/job/:identifier/submit（同 service verb）' };
  console.log(`S_alias :: ${String(subAlias.status)} :: code=${String(subAlias.code)}`);

  // ---------- ⑦ 审核 POST /api/job/:jobId/review（事件根键服务端派生）----------
  const preR = await ledgerCount();
  say('R_neg_non_admin', await call('POST', `/api/job/${jobId}/review`, { token: T_WRK, body: { approved: true } }), { ledger_delta: (await ledgerCount()) - preR });
  if (T_ADM) {
    say('R_ok_approve', await call('POST', `/api/job/${jobId}/review`, { token: T_ADM, body: { approved: true } }), { job_id: jobId, settle_legs: await legsOf(`biz:job:settle:${jobId}`) });
    say('R_ok_approve_replay', await call('POST', `/api/job/${jobId}/review`, { token: T_ADM, body: { approved: true } }), { note: '同 key（服务端派生）重投 ⇒ 200 + idempotent_replay' });
    const pend = await call('GET', '/api/tasklist/pending-verification', { token: T_ADM });
    say('Q_ok_pending_queue', pend, { queue_len: Array.isArray(pend.json?.data) ? pend.json.data.length : null });
  } else {
    tests.R_ok_approve = 'NOT_MEASURED: 本 run 未发现 can_access_admin=true 的夹具（负例已测）';
  }

  // ---------- ⑧ 「我的」读数面 ----------
  say('M_ok_asset_balance', await call('GET', `/api/user/asset/${worker.uid}`), { uid: worker.uid, note: '余额读口 = 已注册 5 键' });
  say('M_probe_unregistered_ledger_endpoints', await call('GET', '/api/user/ledger', { token: T_WRK }), { note: '账本流水读口**未注册**（前端只留空态 + 登记，不自造接口）' });
  say('M_probe_unregistered_points_endpoint', await call('GET', '/api/user/points', { token: T_WRK }), { note: '积分集合读口未注册（§5.4 第 3 阶段）' });

  (results.invariants as any).ledger_rows_pre = preLedger;
  (results.invariants as any).ledger_rows_post = await ledgerCount();
  (results.invariants as any).kinds_total = await raw(`SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`);
  (results.invariants as any).job_rows = await raw(`SELECT job_id::text AS id, status, escrow_txid::text AS esc, settle_txid::text AS st FROM public.job WHERE create_key = $1`, [K('job1')]);
  fs.writeFileSync(path.join(outDir, 'post', 'b4cii-a-http.json'), JSON.stringify(results, null, 2));
  console.log(`LEDGER_PRE=${preLedger} LEDGER_POST=${(results.invariants as any).ledger_rows_post}`);
  console.log('ARTIFACT=' + path.join(outDir, 'post', 'b4cii-a-http.json'));
}

main().catch((e) => { console.log('FATAL ' + String(e)); process.exitCode = 1; });
