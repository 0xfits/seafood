/*
 * p4z-audjk-01-probe.ts — Unit AUD-JOBKEY：批 2a `create_key` 派生兜底的「静默重放」审计探针。
 *
 * 只取证不裁决。只读 + 命名夹具 INSERT（前缀 `aud-jk:` / create_key 段 `aud-jk`），**无 DELETE/UPDATE 业务行**。
 * 用法：npx ts-node --transpile-only scripts/p4z-audjk-01-probe.ts <outDir>
 *
 * 探针自曝（§5.7④/⑨）：
 *  1) 计数口径 = `count(*)::int` 逐表 + 夹具域（job_id / create_key LIKE）逐项；before/after 同一脚本同一表集。
 *  2) 密钥候选两枚（env SECRET_KEY / auth.ts 公开常量）各铸一枚 token，命中 `/api/user` 200 者为准（§5.7⑩）。
 *  3) 派生键「实测」= 从 DB 回读落行的 `create_key` 真值，不是复算；服务层 J2 apply 无 HTTP 路由（见 §C 读口）。
 *  4) 产物禁落 token 本体/连接串：只记 token 指纹（sha256 前 12）。
 *  5) 本脚本不 pkill/killall、不改 migrations、不跑资金端点、无 DELETE。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash, createHmac } from 'crypto';
import { neon } from '@neondatabase/serverless';

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL || '';
if (!url) { console.error('NO_DB_URL'); process.exit(2); }
const sql = neon(url);

const outDir = process.argv[2] || path.join(__dirname, '..', '.p4-artifacts', 'audjk-unknown');
fs.mkdirSync(outDir, { recursive: true });
const API = process.env.P4_API || 'http://127.0.0.1:5788';
const NS = 'aud-jk';                       // 夹具命名空间（brief 要求前缀）
const D1 = `${NS}:deliverable:identical`;  // 两次「内容完全相同」
const D2 = `${NS}:deliverable:different`;  // 同实体、异内容（判负对照）

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rows = async (q: string, p: unknown[] = []): Promise<Record<string, unknown>[]> => {
  let last: unknown = null;
  for (let i = 0; i < 4; i += 1) {
    try { return (await sql(q, p)) as never; }
    catch (e) { last = e; await sleep(400 * (i + 1)); }
  }
  throw last;
};
const one = async (q: string, p: unknown[] = []) => (await rows(q, p))[0] || null;
const n = (v: unknown) => Number(v ?? 0);
const write = (name: string, payload: unknown) => {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, JSON.stringify(payload, null, 2));
  return p;
};

/* ---------------- 台账（before/after 同口径） ---------------- */
async function snap() {
  const c = await one(`SELECT
      (SELECT count(*)::int FROM public."job")             AS job_total,
      (SELECT count(*)::int FROM public."job_application") AS app_total,
      (SELECT count(*)::int FROM public."job_submission")  AS sub_total,
      (SELECT count(*)::int FROM public."job_submission"  WHERE create_key LIKE 'cli:p4b2a:%') AS sub_derived_p4b2a,
      (SELECT count(*)::int FROM public."job_application" WHERE create_key LIKE 'cli:p4b2a:%') AS app_derived_p4b2a,
      (SELECT count(*)::int FROM public."job"           WHERE create_key LIKE '%${NS}%')      AS job_fixture,
      (SELECT count(*)::int FROM public."job_application" WHERE create_key LIKE '%${NS}%')     AS app_fixture,
      (SELECT count(*)::int FROM public."job_submission"  WHERE create_key LIKE '%${NS}%')     AS sub_fixture,
      (SELECT count(*)::int FROM public."job_submission"  WHERE deliverable ILIKE '%${NS}%')   AS sub_fixture_by_deliverable,
      (SELECT count(*)::int FROM public."ledger_entry")    AS ledger_entry_total`);
  const acc = await one(`SELECT count(*)::int AS rows, COALESCE(sum(balance),0)::text AS sb, COALESCE(sum(frozen),0)::text AS sf FROM public."account"`);
  return { ...c, account_rows: acc?.rows ?? null, account_sum_balance: String(acc?.sb ?? ''), account_sum_frozen: String(acc?.sf ?? '') };
}

/* ---------------- HTTP ---------------- */
const b64u = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const mint = (uid: number, evm: string, key: string) => {
  const body = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 1800 })}`;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
};
const fp = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 12);
async function call(method: string, p: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text_head: text.slice(0, 400) };
}

/* ---------------- 主流程 ---------------- */
async function main() {
  const R: any[] = [];
  const REC: Record<string, any> = { run: path.basename(outDir), at: new Date().toISOString(), api: API, ns: NS, D1, D2 };

  /* §0 探针自检：带引号对象断言（§5.7①）—— 表存在 + 唯一约束真值 */
  REC.assert = {
    regclass: await rows(`SELECT 'public.job'::regclass::text AS job, 'public.job_application'::regclass::text AS app, 'public.job_submission'::regclass::text AS sub, 'public."users"'::regclass::text AS users`),
    job_key_cols: n((await one(`SELECT count(*)::int AS c FROM information_schema.columns WHERE table_schema='public' AND table_name='job' AND column_name='create_key'`))?.c),
    uniq: await rows(`SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
        FROM pg_constraint WHERE conname IN ('job_create_key_uniq','job_application_create_key_uniq','job_application_job_worker_uniq','job_submission_create_key_uniq')
        ORDER BY tbl, conname`),
    insert_triggers: await rows(`SELECT c.relname AS tbl, t.tgname, CASE WHEN (t.tgtype & 4) > 0 THEN 'INSERT' ELSE '' END || CASE WHEN (t.tgtype & 8) > 0 THEN 'DELETE' ELSE '' END || CASE WHEN (t.tgtype & 16) > 0 THEN 'UPDATE' ELSE '' END AS ev
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname IN ('job','job_application','job_submission') ORDER BY tbl, tgname`),
  };

  REC.before = await snap();

  /* §1 密钥候选实测（不落 token 本体） */
  const uids = (await rows(`SELECT uid, COALESCE(evm,'') AS evm FROM public."users" ORDER BY uid LIMIT 6`)).map((r) => ({ uid: n(r.uid), evm: String(r.evm) }));
  if (uids.length < 2) { write('BLOCKED.json', { reason: 'users < 2' }); return; }
  const worker = uids[0];
  const cands = [
    { name: 'env-SECRET_KEY(.env.local 经 dotenv)', key: String(process.env.SECRET_KEY || '') },
    { name: 'auth.ts 公开常量 your-secret-key-here', key: 'your-secret-key-here' },
  ].filter((c) => c.key);
  const keyProbe: any[] = [];
  let winner: { name: string; key: string } | null = null;
  for (const c of cands) {
    const t = mint(worker.uid, worker.evm, c.key);
    const r = await call('GET', '/api/user', { token: t });
    keyProbe.push({ candidate: c.name, key_len: c.key.length, token_fp: fp(t), status: r.status });
    if (r.status === 200 && !winner) winner = c;
  }
  REC.key_probe = { candidates: keyProbe, verdict: winner ? winner.name : 'NO_CANDIDATE_200', worker_uid: worker.uid };
  if (!winner) { write('BLOCKED.json', { reason: 'no key candidate accepted' }); return; }
  const token = mint(worker.uid, worker.evm, winner.key);
  REC.token_fp = fp(token);

  /* §2 夹具（命名空间 aud-jk；INSERT-only；内容两两相同） */
  const fx: Record<string, any> = { worker_uid: worker.uid, employers: [] };
  const cur = await one(`SELECT cid FROM public.currency ORDER BY cid LIMIT 1`);
  const cid = n(cur?.cid);
  fx.cid = cid;
  const mkJob = async (suffix: string, employer: number, status: string) => {
    const key = `cli:${NS}:job:${suffix}`;
    const ex = await one(`SELECT job_id FROM public.job WHERE create_key = $1`, [key]);
    if (ex) return { job_id: n(ex.job_id), create_key: key, reused: true };
    const r = await one(
      `INSERT INTO public.job (employer_uid, cid, reward, title, description, status, create_key)
       VALUES ($1,$2,137,$3,$4,$5,$6) RETURNING job_id`,
      [employer, cid, `${NS}:identical-title`, `${NS}:identical-description（同标题同内容夹具）`, status, key]);
    return { job_id: n(r?.job_id), create_key: key, reused: false };
  };
  const mkApp = async (suffix: string, jobId: number, status: string) => {
    const key = `cli:${NS}:app:${suffix}`;
    const ex = await one(`SELECT application_id FROM public.job_application WHERE create_key = $1`, [key]);
    if (ex) return { application_id: n(ex.application_id), create_key: key, reused: true };
    const r = await one(
      `INSERT INTO public.job_application (job_id, worker_uid, status, create_key) VALUES ($1,$2,$3,$4) RETURNING application_id`,
      [jobId, worker.uid, status, key]);
    return { application_id: n(r?.application_id), create_key: key, reused: false };
  };
  const E1 = uids[1].uid;
  const E2 = (uids[2] ?? uids[1]).uid;
  fx.employers = [E1, E2];
  const jOpenA = await mkJob('openA', E1, 'open');
  const jOpenB = await mkJob('openB', E2, 'open');
  const jSubA = await mkJob('subA', E1, 'accepted');
  const jSubB = await mkJob('subB', E2, 'accepted');
  const appA = await mkApp('subA', jSubA.job_id, 'accepted');
  const appB = await mkApp('subB', jSubB.job_id, 'accepted');
  fx.jobs = { jOpenA, jOpenB, jSubA, jSubB };
  fx.apps = { appA, appB };
  write('fixture-ledger.json', fx);
  REC.fixture = fx;
  REC.after_fixture = await snap();

  /* §3 J4 submit（HTTP 真 token，2a 现取路由） */
  const rec = async (id: string, method: string, p: string, opts: any, expect: string) => {
    const b = await snap();
    let r: Awaited<ReturnType<typeof call>>;
    try { r = await call(method, p, opts); }
    catch (e: any) { R.push({ id, method, path: p, expect, status: 'NETERR', error: String(e?.name || e) }); return; }
    const a = await snap();
    const entry = {
      id, method, path: p, expect,
      status: r.status,
      success: r.json?.success ?? null,
      message: r.json?.message ?? null,
      code: r.json?.error?.code ?? r.json?.code ?? null,
      details: r.json?.error?.details ?? r.json?.details ?? null,
      idempotent_replay: r.json?.idempotent_replay ?? null,
      data_keys: r.json?.data && typeof r.json.data === 'object' ? Object.keys(r.json.data) : null,
      body_head: r.json ? null : r.text_head,
      delta: {
        job: a.job_total - b.job_total,
        app: a.app_total - b.app_total,
        sub: a.sub_total - b.sub_total,
        sub_derived_p4b2a: a.sub_derived_p4b2a - b.sub_derived_p4b2a,
        ledger_entry: a.ledger_entry_total - b.ledger_entry_total,
        account_rows: a.account_rows - b.account_rows,
      },
      counts_after: { job: a.job_total, app: a.app_total, sub: a.sub_total, sub_derived_p4b2a: a.sub_derived_p4b2a },
    };
    R.push(entry);
    console.log(`[${id}] ${method} ${p} -> ${r.status} replay=${entry.idempotent_replay} delta.sub=${entry.delta.sub} (${expect})`);
  };

  // T0：读出 J2 apply 的 HTTP 注册面（预期无路由）
  await rec('T0_POST_/api/job/<openA>/apply', 'POST', `/api/job/${jOpenA.job_id}/apply`, { token, body: { info_input: D1 } }, '期望无路由(404)');
  // T1：不同实体（appA vs appB = 不同 job/application），内容**完全相同**，均不带 create_key
  await rec('T1_submit_appA_noKey_D1', 'POST', `/api/task-progress/${appA.application_id}/submit`, { token, body: { info_input: D1 } }, '期望 200 落新行');
  await rec('T2_submit_appB_noKey_D1', 'POST', `/api/task-progress/${appB.application_id}/submit`, { token, body: { info_input: D1 } }, '期望 200 落新行（判据：落两行 ⇒ 碰撞不成立）');
  // T3：同一实体（appA + 同一 worker）重试，内容相同 ⇒ 期望重放（正确幂等）
  await rec('T3_submit_appA_noKey_D1_repeat', 'POST', `/api/task-progress/${appA.application_id}/submit`, { token, body: { info_input: D1 } }, '期望 200 replay 且零新行');
  // T4：同一实体、内容**不同** ⇒ 期望 409（非静默重放）
  await rec('T4_submit_appA_noKey_D2', 'POST', `/api/task-progress/${appA.application_id}/submit`, { token, body: { info_input: D2 } }, '期望 409 REPLAY_FINGERPRINT_MISMATCH 零新行');

  /* §4 J2 apply（服务层；无 HTTP 路由 ⇒ 用 src 真 `resolveJobCreateKey` 派生，DB 约束实测） */
  const svc = require('../src/job-service');
  const applyRec: any[] = [];
  const doApply = async (id: string, jobId: number) => {
    const derived = svc.resolveJobCreateKey(undefined, ['apply', jobId, worker.uid]);
    const b = await snap();
    let r: any;
    try { r = await svc.applyToJob({ jobId, workerUid: worker.uid, createKeyRaw: undefined }); }
    catch (e: any) { applyRec.push({ id, jobId, exception: String(e).slice(0, 300) }); return; }
    const a = await snap();
    const row = await one(`SELECT create_key FROM public.job_application WHERE job_id = $1 AND worker_uid = $2`, [jobId, worker.uid]);
    applyRec.push({
      id, jobId,
      derived_key: derived.ok ? derived.key : null, derived_flag: derived.ok ? derived.derived : null,
      outcome_ok: r.ok, replay: r.ok ? r.replay : null,
      status: r.ok ? 200 : r.status, code: r.ok ? null : r.code,
      landed_create_key: row ? String(row.create_key) : null,
      delta_app: a.app_total - b.app_total, delta_app_fixture: a.app_fixture - b.app_fixture,
    });
    console.log(`[${id}] apply(job=${jobId}) -> ok=${r.ok} replay=${r.ok ? r.replay : null} delta.app=${a.app_total - b.app_total}`);
  };
  await doApply('A1_apply_jOpenA_noKey', jOpenA.job_id);
  await doApply('A2_apply_jOpenB_noKey', jOpenB.job_id);
  await doApply('A3_apply_jOpenA_noKey_repeat', jOpenA.job_id);
  REC.apply_service_layer = applyRec;

  /* §5 库侧真值（派生键回读） */
  REC.db_truth = {
    submissions_fixture: await rows(`SELECT submission_id, job_id, worker_uid, left(deliverable,40) AS deliverable_head, create_key
        FROM public.job_submission WHERE create_key LIKE '%${NS}%' OR deliverable ILIKE '%${NS}%' ORDER BY submission_id`),
    applications_fixture: await rows(`SELECT application_id, job_id, worker_uid, status, create_key FROM public.job_application
        WHERE create_key LIKE '%${NS}%' ORDER BY application_id`),
    jobs_fixture: await rows(`SELECT job_id, employer_uid, status, title, create_key FROM public.job WHERE create_key LIKE '%${NS}%' ORDER BY job_id`),
  };

  REC.after = await snap();
  REC.requests = R;
  REC.self_disclosure = [
    '计数口径 = count(*)::int 逐表/夹具域；before/after 同脚本同表集。',
    'T1/T2/T3/T4 走 HTTP 真 token（Bearer，密钥候选实测命中）；T0 证 J2 apply 无路由。',
    'J2 apply 无 HTTP 路由 ⇒ A1/A2/A3 走服务层 src/job-service.applyToJob（真 resolveJobCreateKey），并回读 DB 落行 create_key。',
    '派生键「实测」= 回读 DB 真值，非复算。',
    '产物不落 token 本体/连接串（只 token_fp）。',
    '夹具 namespace=aud-jk，INSERT-only，无 DELETE，无资金端点。',
  ];
  const payload = JSON.stringify({ ...REC }, null, 2);
  REC.leak_check = { bearer_header_occurrences: (payload.match(/eyJ/g) || []).length, secret_value_occurrences: (payload.match(new RegExp(winner.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length };
  write('before-counts.json', REC.before);
  write('after-counts.json', REC.after);
  write('results.json', { ...REC, leak_check: REC.leak_check });
  console.log('KEY_WINNER =', winner.name, 'token_fp =', fp(token));
  console.log('LEAK_CHECK =', JSON.stringify(REC.leak_check));
  console.log('TABLE DELTA =', JSON.stringify({
    job: REC.after.job_total - REC.before.job_total,
    app: REC.after.app_total - REC.before.app_total,
    sub: REC.after.sub_total - REC.before.sub_total,
    ledger_entry: REC.after.ledger_entry_total - REC.before.ledger_entry_total,
  }));
  console.log('DERIVED SUB KEYS =', JSON.stringify(REC.db_truth.submissions_fixture.map((s: any) => s.create_key)));
  console.log('WROTE', outDir);
}
main().catch((e) => { console.error('PROBE_FAIL', e); process.exit(1); });
