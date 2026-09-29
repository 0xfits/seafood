/*
 * P4-B2a-HTTP · 端到端（密钥取证 → 鉴权面 → 批 2a 写分支 → 前后台账/非资金不变量）。
 * 红线：不落盘 token/连接串（产物内 'eyJ' 计数须为 0）；不碰资金端点（approve/settle/claim/托管/发放）。
 * 用法：ts-node scripts/p4z-b2ahttp-03-e2e.ts <runTag>
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const RUN = process.argv[2];
if (!RUN) throw new Error('usage: <runTag>');
const ART = path.resolve('.p4-artifacts', RUN);
const BASE = 'http://127.0.0.1:5788';
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) throw new Error('no DB url');

const U1 = { uid: 970001, evm: '0x9700010000000000000000000000000000000000' };
const U2 = { uid: 970002, evm: '0x9700020000000000000000000000000000000000' };

/* ---------- 台账（逐表精确计数；带引号对象断言 §5.7①） ---------- */
const TABLES = ['users', 'job', 'job_application', 'job_submission', 'account', 'ledger_entry',
  'currency', 'listing', 'listing_order', 'market_order', 'market_trade'] as const;
const COUNT_Q: Record<string, () => Promise<{ c: number }[]>> = {
  users: () => sql`SELECT COUNT(1)::int AS c FROM public."users"`,
  job: () => sql`SELECT COUNT(1)::int AS c FROM public."job"`,
  job_application: () => sql`SELECT COUNT(1)::int AS c FROM public."job_application"`,
  job_submission: () => sql`SELECT COUNT(1)::int AS c FROM public."job_submission"`,
  account: () => sql`SELECT COUNT(1)::int AS c FROM public."account"`,
  ledger_entry: () => sql`SELECT COUNT(1)::int AS c FROM public."ledger_entry"`,
  currency: () => sql`SELECT COUNT(1)::int AS c FROM public."currency"`,
  listing: () => sql`SELECT COUNT(1)::int AS c FROM public."listing"`,
  listing_order: () => sql`SELECT COUNT(1)::int AS c FROM public."listing_order"`,
  market_order: () => sql`SELECT COUNT(1)::int AS c FROM public."market_order"`,
  market_trade: () => sql`SELECT COUNT(1)::int AS c FROM public."market_trade"`,
};
const ledgerSnapshot = async () => {
  const counts: Record<string, number> = {};
  for (const t of TABLES) counts[t] = Number((await COUNT_Q[t]())[0].c);
  const a = (await sql`SELECT COUNT(1)::int AS n, COALESCE(SUM(balance),0)::text AS sb, COALESCE(SUM(frozen),0)::text AS sf FROM public."account"`)[0];
  const h = (await sql`SELECT md5(string_agg(uid::text||':'||cid::text||':'||balance::text||':'||frozen::text||':'||version::text, ',' ORDER BY uid,cid)) AS h FROM public."account"`)[0];
  const ns = (await sql`SELECT
      (SELECT COUNT(1)::int FROM public."job_application" WHERE create_key LIKE 'cli:p4b2:%') AS app_p4b2,
      (SELECT COUNT(1)::int FROM public."job_submission"  WHERE create_key LIKE 'cli:p4b2:%') AS sub_p4b2,
      (SELECT COUNT(1)::int FROM public."job"             WHERE create_key LIKE 'cli:p4b2:%') AS job_p4b2,
      (SELECT COUNT(1)::int FROM public."job_submission"  WHERE create_key LIKE 'cli:p4b2a:%') AS sub_p4b2a_derived`)[0];
  return {
    table_counts: counts,
    account: { rows: Number(a.n), sum_balance: String(a.sb), sum_frozen: String(a.sf), dump_md5: h.h === null ? null : String(h.h) },
    ledger_entry_rows: counts.ledger_entry,
    namespace_ledger: { app_cli_p4b2: Number(ns.app_p4b2), sub_cli_p4b2: Number(ns.sub_p4b2), job_cli_p4b2: Number(ns.job_p4b2), sub_cli_p4b2a_derived: Number(ns.sub_p4b2a_derived) },
  };
};

/* ---------- token（形态逐字复刻 auth.ts:36-47/188-197） ---------- */
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const mint = (uid: number, evm: string, key: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 1800 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', key).update(unsigned).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

async function call(method: string, p: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + p, {
    method, headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text_head: text.slice(0, 300) };
}

async function main() {
  fs.mkdirSync(path.join(ART, 'pre'), { recursive: true });
  fs.mkdirSync(path.join(ART, 'post'), { recursive: true });

  const before = await ledgerSnapshot();

  /* --- 取证：服务端生效密钥（两个候选各铸一枚，命中 200 者为准；实测非假设） --- */
  const cands: { name: string; key: string }[] = [];
  if (process.env.SECRET_KEY) cands.push({ name: 'env-SECRET_KEY(.env.local/.env 经 dotenv)', key: process.env.SECRET_KEY });
  cands.push({ name: 'auth.ts:3 硬编码兑底', key: 'your-secret-key-here' });
  const keyProbe: any[] = [];
  let winner: { name: string; key: string } | null = null;
  for (const c of cands) {
    const t = mint(U1.uid, U1.evm, c.key);
    const r = await call('GET', '/api/user', { token: t });
    keyProbe.push({ candidate: c.name, key_len: c.key.length, token_fp: fp(t), status: r.status });
    if (r.status === 200 && !winner) winner = c;
  }

  if (!winner) {
    fs.writeFileSync(path.join(ART, 'post', 'key-probe.json'), JSON.stringify({ keyProbe, verdict: 'NO_CANDIDATE_200' }, null, 2));
    console.log('KEY_PROBE_FAIL', JSON.stringify(keyProbe));
    return;
  }

  const t1 = mint(U1.uid, U1.evm, winner.key);
  const t2 = mint(U2.uid, U2.evm, winner.key);
  const R: any[] = [];
  const rec = async (id: string, method: string, p: string, opts: any = {}, extra: Record<string, unknown> = {}) => {
    let r: Awaited<ReturnType<typeof call>>;
    try {
      r = await call(method, p, opts);
    } catch (e: any) {
      R.push({ id, method, path: p, status: 'TIMEOUT_OR_NETERR', error: String(e?.name || e?.message || e), ...extra });
      console.log(`[${id}] ${method} ${p} -> TIMEOUT_OR_NETERR (${e?.name || e})`);
      return { status: 'TIMEOUT_OR_NETERR' as any, json: null, text_head: '' };
    }
    const entry = {
      id, method, path: p, status: r.status,
      ok: r.json?.success ?? null,
      message: r.json?.message ?? null,
      idempotent_replay: r.json?.idempotent_replay ?? null,
      data_keys: r.json?.data && typeof r.json.data === 'object' ? Object.keys(r.json.data) : null,
      data: r.json?.data ?? (r.json ? null : r.text_head),
      ...extra,
    };
    R.push(entry);
    console.log(`[${id}] ${method} ${p} -> ${r.status} ${entry.idempotent_replay === true ? '(replay)' : ''}`);
    return r;
  };

  // §2 鉴权面
  await rec('A1_unauth_401', 'GET', '/api/user', {});
  const a2 = await rec('A2_GET_/api/user', 'GET', '/api/user', { token: t1 });
  await rec('A3_GET_task-progress', 'GET', '/api/task-progress', { token: t1 });
  await rec('A4_GET_admin-me', 'GET', '/api/admin/me', { token: t1 });
  await rec('A5_bad_signature_401', 'GET', '/api/user', { token: mint(U1.uid, U1.evm, 'wrong-key') });

  // §3 批 2a HTTP 写分支（§1/§4：apply/accept 目标路径 vs 实测注册面）
  await rec('B1_POST_/api/job/2/apply', 'POST', '/api/job/2/apply', { token: t2, body: { create_key: 'cli:p4b2:apply:J2' } });
  await rec('B2_POST_/api/job/2/accept', 'POST', '/api/job/2/accept', { token: t1, body: { application_id: 1 } });
  // J4 submit（夹具：job 3 已 accepted，app 4 worker=970002，status=accepted）
  await rec('B3_submit_J3_worker', 'POST', '/api/task-progress/4/submit',
    { token: t2, body: { info_input: 'cli:p4b2:deliverable:J3A', create_key: 'cli:p4b2:submit:J3A' } });
  await rec('B4_submit_J3_same_key_replay', 'POST', '/api/task-progress/4/submit',
    { token: t2, body: { info_input: 'cli:p4b2:deliverable:J3A', create_key: 'cli:p4b2:submit:J3A' } });
  await rec('B5_submit_other_worker_403', 'POST', '/api/task-progress/4/submit',
    { token: t1, body: { info_input: 'cli:p4b2:deliverable:NOT_MINE', create_key: 'cli:p4b2:submit:J3B' } });
  await rec('B6_submit_miss_404', 'POST', '/api/task-progress/999999/submit',
    { token: t2, body: { info_input: 'cli:p4b2:deliverable:MISS', create_key: 'cli:p4b2:submit:MISS' } });
  await rec('B7_submit_applied_state_409', 'POST', '/api/task-progress/1/submit',
    { token: t2, body: { info_input: 'cli:p4b2:deliverable:J2X', create_key: 'cli:p4b2:submit:J2X' } });
  // updateUserProfile 读回（写同值 bio ⇒ 无净变更；非资金）
  await rec('B8_POST_/api/user/profile_same_bio', 'POST', '/api/user/profile',
    { token: t1, body: { bio: 'p4b2:fixture user' } });
  await rec('B9_GET_user-asset', 'GET', '/api/user/asset/970001', { token: t1 });

  // §4 库侧落点核对
  const subs = await sql`SELECT submission_id, job_id, worker_uid, review_status, create_key, deliverable
                           FROM public."job_submission" WHERE job_id = 3 ORDER BY submission_id`;
  const job3 = (await sql`SELECT job_id, status, worker_uid FROM public."job" WHERE job_id = 3`)[0];
  const appAfter = await sql`SELECT application_id, job_id, worker_uid, status, create_key FROM public."job_application" ORDER BY application_id`;
  const subAll = await sql`SELECT COUNT(1)::int AS c FROM public."job_submission"`;

  const after = await ledgerSnapshot();

  const out = {
    run: RUN, base: BASE, at: new Date().toISOString(),
    key_probe: { candidates: keyProbe, verdict: winner.name, winner_token_fp: fp(t1), note: '获胜候选名已记，密钥本体不落盘' },
    requests: R,
    db_after: { job3, job_submission_job3: subs, job_submission_total: Number(subAll[0].c), job_application: appAfter },
    ledger_before: before, ledger_after: after,
  };
  const payload = JSON.stringify(out, null, 2);

  // 自检：产物不得含 token 头（'eyJ'）或密钥本体
  const leakCheck = {
    eyJ_occurrences: (payload.match(/eyJ/g) || []).length,
    secret_value_occurrences: (payload.match(new RegExp(winner.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
  };
  fs.writeFileSync(path.join(ART, 'pre', 'counts.json'), JSON.stringify({ run: RUN, label: 'before', ...before }, null, 2));
  fs.writeFileSync(path.join(ART, 'post', 'counts.json'), JSON.stringify({ run: RUN, label: 'after', ...after }, null, 2));
  fs.writeFileSync(path.join(ART, 'post', 'e2e.json'), JSON.stringify({ ...out, leak_check: leakCheck }, null, 2));

  console.log('KEY_WINNER =', winner.name, 'token_fp =', fp(t1));
  console.log('LEAK CHECK =', JSON.stringify(leakCheck));
  console.log('ledger delta =', after.ledger_entry_rows - before.ledger_entry_rows,
    '| account', JSON.stringify(before.account), '->', JSON.stringify(after.account));
  console.log('table delta =', JSON.stringify(Object.fromEntries(TABLES.map((t) => [t, after.table_counts[t] - before.table_counts[t]]))));
  console.log('job3 =', JSON.stringify(job3), '| submissions =', subs.length);
}

main().catch((e) => { console.error('E2E_FAIL', e); process.exit(1); });
