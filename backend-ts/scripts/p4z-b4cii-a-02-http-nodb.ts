/*
 * p4z-b4cii-a-02-http-nodb.ts — P4-B4c-ii-a 接线面 HTTP 实测（**无 DB 依赖**版）
 * 用途：01 版在「提交」步因 `@neondatabase/serverless` 连接失败（`fetch failed`，连续 3 次）中断 ⇒
 *   本版把「夹具发现 + 落库核对」全部改成**纯 HTTP 证据**（不连库、不猜 schema），把招工全链一次跑完：
 *   发布 → 列表可见 → 详情 → 申请 → 接受（含非雇主 403）→ 提交（含同实体异内容 409）→ 审核（含非管理员 403）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b4cii-a-02-http-nodb.ts <runDirAbs>
 * 口径：SECRET_KEY 现铸 token（**不落盘**，只记 12 位指纹）；夹具键一律 `cli:b4cii-*`；退出码管道外取。
 * 自曝：无 DB ⇒ **不产出**「库侧分录/行数」读数（`NOT_MEASURED: db_legs`）；本片只声明 HTTP 面读数。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
const RUN = path.basename(outDir);
const TAG = `b4cii${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const K = (s: string) => `cli:b4cii:${TAG}:${s}`;
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });

const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xb4c${String(uid).padStart(4, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Call = { status: number | string; top: string[]; data: string[]; code: string | null; reason: string | null; msg: string; json: any };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}): Promise<Call> => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON（如 404 兜底 HTML） */ }
    return {
      status: res.status,
      top: json && typeof json === 'object' ? Object.keys(json) : [],
      data: json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? Object.keys(json.data) : [],
      code: json?.error?.code ?? null,
      reason: json?.error?.details?.reason ?? json?.details?.reason ?? null,
      msg: String(json?.error?.message ?? json?.message ?? '').slice(0, 80),
      json,
    };
  } catch (e) {
    return { status: 'NETERR', top: [], data: [], code: null, reason: null, msg: String(e).slice(0, 120), json: null };
  }
};

const results: Record<string, unknown> = {
  run: RUN, tag: TAG, base: BASE, secret_fingerprint: fp(SECRET), db_used: false,
  not_measured: ['db_legs: 本版不连库 ⇒ 不发「库侧分录行数/账本 Δ」读数（与 01 版口径一致：01 版在提交步因 DB 连接失败中断）'],
  tests: {}, fixtures: {},
};
const tests = results.tests as Record<string, unknown>;
const say = (id: string, c: Call, extra: Record<string, unknown> = {}) => {
  const row = { status: c.status, code: c.code, reason: c.reason, data_keys: c.data, top_keys: c.top, msg: c.msg, ...extra };
  tests[id] = row;
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: reason=${String(c.reason)} :: data=[${c.data.join(',')}]${extra.note ? ' :: ' + String(extra.note) : ''}`);
  return row;
};

async function main() {
  // ---------- 夹具发现（纯 HTTP；token 有效性 = GET /api/user 200）----------
  const scanUids = [...Array(40).keys()].map((i) => i + 1).concat([100, 101, 102, 999, 1000, 1001, 1002, 970001, 970002]);
  const alive: number[] = [];
  const admins: number[] = [];
  for (const uid of scanUids) {
    const me = await call('GET', '/api/user', { token: jwt(uid) });
    if (me.status === 200) alive.push(uid);
    const adm = await call('GET', '/api/admin/me', { token: jwt(uid) });
    if (adm.status === 200 && adm.json?.data?.can_access_admin === true) admins.push(uid);
  }
  const candidates = await call('GET', '/api/task/all?limit=1'); // 仅确认公共读口可达
  results.fixtures = { alive_uids: alive.slice(0, 12), alive_count: alive.length, admin_uids: admins, list_public_status: candidates.status };
  if (alive.length < 2) { console.log('FIXTURE_MISSING', JSON.stringify(results.fixtures)); fs.writeFileSync(path.join(outDir, 'post', 'b4cii-a-nodb.json'), JSON.stringify(results, null, 2)); return; }
  const adminUid = admins[0] ?? null;

  // ---------- ① 发布招工（cid 由「试发布」探得：listed 币种闸是硬闸，`cli:` 键由**前端提供**）----------
  say('P1_neg_no_key', await call('POST', '/api/job', { token: jwt(alive[0]), body: { cid: 1, reward: '1', title: `b4cii nokey ${TAG}` } }), { note: '缺 create_key ⇒ fail-loud（真源 job-funds-service.ts:84）' });
  say('P1_neg_unauth', await call('POST', '/api/job', { body: { cid: 1, reward: '1', title: 'no token', create_key: K('noauth') } }), { note: '无 token ⇒ 401 R107' });
  let employer: number | null = null;
  let cid = 0;
  let pub: Call | null = null;
  const attempts: Array<Record<string, unknown>> = [];
  outer:
  for (const cand of [1, 2, 3, 4, 5]) {
    for (const uid of alive) {
      const r = await call('POST', '/api/job', { token: jwt(uid), body: { cid: cand, reward: '1', title: `b4cii job ${TAG}`, description: 'b4cii chain probe', create_key: K(`job_c${cand}_u${uid}`) } });
      attempts.push({ uid, cid: cand, status: r.status, code: r.code });
      if (r.status === 200) { employer = uid; cid = cand; pub = r; break outer; }
      if (r.status !== 409 && r.status !== 400) break outer; // 非「余额/币种」类失败 ⇒ 不再盲试
    }
  }
  results.fixtures = { ...(results.fixtures as object), employer_uid: employer, listed_cid: cid, admin_uid: adminUid, publish_attempts: attempts.slice(0, 12) };
  if (!employer || !pub) { console.log('PUBLISH_FAILED', JSON.stringify(attempts.slice(0, 12))); fs.writeFileSync(path.join(outDir, 'post', 'b4cii-a-nodb.json'), JSON.stringify(results, null, 2)); return; }
  const jobId = Number(pub.json?.data?.job_id ?? 0);
  const T_EMP = jwt(employer);
  const worker = alive.find((u) => u !== employer && !admins.includes(u)) as number;
  const T_WRK = jwt(worker);
  say('P1_ok', pub, { job_id: jobId, cid, employer_uid: employer, escrow_txid: pub.json?.data?.escrow_txid, entry_count: pub.json?.data?.entry_count, kinds: pub.json?.data?.kinds });

  // ---------- ② 列表可见（GET /api/task/all ⇒ 招工）----------
  const list = await call('GET', '/api/task/all?limit=200');
  const ids = Array.isArray(list.json?.data) ? list.json.data.map((r: any) => Number(r.tID)) : [];
  say('L1_list_visible', list, { job_in_list: ids.includes(jobId), list_len: ids.length, note: '发布后 GET /api/task/all 立即可见' });

  // ---------- ③ 详情 ----------
  say('D1_ok', await call('GET', `/api/task/${jobId}`), { job_id: jobId, title: (await call('GET', `/api/task/${jobId}`)).json?.data?.title });
  say('D1_neg_miss_404', await call('GET', '/api/task/999999999'));

  // ---------- ④ 申请（键 = **服务端派生** ⇒ 前端不传键）----------
  say('A_neg_unknown_job_404', await call('POST', '/api/job/999999999/apply', { token: T_WRK, body: {} }));
  const app = await call('POST', `/api/job/${jobId}/apply`, { token: T_WRK, body: {} });
  const appId = Number(app.json?.data?.application_id ?? 0);
  say('A_ok', app, { application_id: appId, note: '请求体为空（无 create_key）⇒ 服务端派生 cli:p4b2a:apply:<job>:<worker>' });
  say('A_replay_same_entity', await call('POST', `/api/job/${jobId}/apply`, { token: T_WRK, body: {} }), { application_id: appId, note: '同实体重投 ⇒ 200 重放（前端不传键即同键）' });
  say('A_neg_self_apply', await call('POST', `/api/job/${jobId}/apply`, { token: T_EMP, body: {} }), { note: '雇主自投 ⇒ 409' });

  // ---------- ⑤ 接受（**非雇主 403 = 硬要求负例**）----------
  say('AC_neg_not_employer_403', await call('POST', `/api/job/${jobId}/accept`, { token: T_WRK, body: { application_id: appId } }), { note: '非雇主 ⇒ 403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED' });
  say('AC_ok_employer', await call('POST', `/api/job/${jobId}/accept`, { token: T_EMP, body: { application_id: appId } }), { application_id: appId });

  // ---------- ⑥ 提交（既有已注册面；键 = **服务端派生**）----------
  const d1 = `b4cii deliverable ${TAG}`;
  say('S_ok', await call('POST', `/api/task-progress/${appId}/submit`, { token: T_WRK, body: { info_input: d1 } }), { application_id: appId, note: '请求体仅 {info_input}（无 create_key）' });
  say('S_replay_same_content', await call('POST', `/api/task-progress/${appId}/submit`, { token: T_WRK, body: { info_input: d1 } }), { note: '同实体同内容 ⇒ 200 + idempotent_replay（§4.5 契约 2）' });
  say('S_neg_same_entity_other_content_409', await call('POST', `/api/task-progress/${appId}/submit`, { token: T_WRK, body: { info_input: `${d1} CHANGED` } }), { note: '同实体异内容 ⇒ 409 LEDGER_IDEMPOTENCY_CONFLICT / REPLAY_FINGERPRINT_MISMATCH（**永久回归项**）' });
  say('S_alias_face', await call('POST', `/api/job/${appId}/submit`, { token: T_WRK, body: { deliverable: d1 } }), { note: '别名面（§1.8 #4 · 已注册）——`:jobId` 语义 = identifier' });
  say('S_neg_non_worker_403', await call('POST', `/api/task-progress/${appId}/submit`, { token: T_EMP, body: { info_input: 'employer tries' } }), { note: '非打工人提交 ⇒ 403 ACTOR_NOT_ALLOWED' });

  // ---------- ⑦ 审核（事件根键 = 服务端派生 biz:job:settle:<job_id>）----------
  say('R_neg_non_admin_403', await call('POST', `/api/job/${jobId}/review`, { token: T_WRK, body: { approved: true } }));
  if (adminUid) {
    const T_ADM = jwt(adminUid);
    const ok = await call('POST', `/api/job/${jobId}/review`, { token: T_ADM, body: { approved: true } });
    say('R_ok_approve', ok, { job_id: jobId, settle_txid: ok.json?.data?.settle_txid, entry_count: ok.json?.data?.entry_count, kinds: ok.json?.data?.kinds, fee_credit_uid: ok.json?.data?.fee_credit_uid });
    say('R_ok_approve_replay', await call('POST', `/api/job/${jobId}/review`, { token: T_ADM, body: { approved: true } }), { note: '同 key（服务端派生）重投 ⇒ 200 重放' });
    const pend = await call('GET', '/api/tasklist/pending-verification', { token: T_ADM });
    say('Q_ok_pending_queue', pend, { queue_len: Array.isArray(pend.json?.data) ? pend.json.data.length : null });
    say('Q_neg_non_admin_403', await call('GET', '/api/tasklist/pending-verification', { token: T_WRK }));
  } else {
    tests.R_ok_approve = 'NOT_MEASURED: 本 run 未发现 can_access_admin=true 的夹具（负例 R_neg_non_admin_403 已测）';
  }

  // ---------- ⑧ 「我的」读数面 ----------
  say('M_ok_asset_balance', await call('GET', `/api/user/asset/${worker}`), { uid: worker, note: '余额读口 = 已注册 5 键（index_id/uID/points/lucks/time_update）' });
  say('M_probe_unregistered_ledger', await call('GET', '/api/user/ledger', { token: T_WRK }), { note: '账本流水读口**未注册** ⇒ 前端只留空态 + 登记（禁自造接口）' });
  say('M_probe_unregistered_points', await call('GET', '/api/user/points', { token: T_WRK }), { note: '积分集合读口未注册（§5.4 第 3 阶段）' });

  fs.writeFileSync(path.join(outDir, 'post', 'b4cii-a-nodb.json'), JSON.stringify(results, null, 2));
  console.log('ARTIFACT=' + path.join(outDir, 'post', 'b4cii-a-nodb.json'));
}

main().catch((e) => { console.log('FATAL ' + String(e)); process.exitCode = 1; });
