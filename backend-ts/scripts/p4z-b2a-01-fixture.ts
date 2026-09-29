// p4z-b2a-01-fixture.ts — P4-B2a 探针（**neon() HTTP** 驱动；只 SELECT 计数 + 命名空间夹具 INSERT，**无 DELETE**）
// Usage: ts-node --transpile-only scripts/p4z-b2a-01-fixture.ts <outDir> <cmd> [phase]
//   cmd ∈ counts | fixture | verbs | http
//   口径见 docs/audit/p4-b2a-job-write.md §0；本脚本自曝见文件尾注释。
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
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
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || '';
if (!url) { console.error('NO_URL'); process.exit(2); }
const sql = neon(url);

const outDir = process.argv[2] || path.join(__dirname, '..', '.p4-artifacts', 'b2a-unknown');
const cmd = process.argv[3] || 'counts';
const phase = process.argv[4] || cmd;
fs.mkdirSync(outDir, { recursive: true });

const API = process.env.P4_API || 'http://127.0.0.1:5788';
const NS = 'p4b2';
const TABLES = ['job', 'job_application', 'job_submission', 'ledger_entry', 'account', 'currency', 'users', 'app_config', 'commission_policy'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// neon HTTP 在长链路/冷连接下偶发 `fetch failed`（本单**实测**）⇒ 探针自带 4 次重试（§5.7④：先怀疑探针/链路）
const rows = async (q: string, p: unknown[] = []): Promise<Record<string, unknown>[]> => {
  let last: unknown = null;
  for (let i = 0; i < 4; i += 1) {
    try {
      return (await sql(q, p)) as never;
    } catch (e) {
      last = e;
      await sleep(400 * (i + 1));
    }
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

async function counts(phaseName: string) {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), phase: phaseName, driver: 'neon-http' };
  const perTable: Record<string, number | null> = {};
  for (const t of TABLES) {
    try {
      perTable[t] = n((await one(`SELECT count(*)::bigint AS c FROM public."${t}"`))?.c);
    } catch (e) { perTable[t] = null; out[`count_error:${t}`] = String(e).slice(0, 120); }
  }
  out.table_counts = perTable;

  // 动态发现 ledger* 表（**不假设表名**；§5.7④ 读数异常先怀疑探针）
  const lt = await rows(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ledger%' ORDER BY table_name`);
  const ledgerCounts: Record<string, number | null> = {};
  for (const r of lt) {
    const name = String(r.table_name);
    try { ledgerCounts[name] = n((await one(`SELECT count(*)::bigint AS c FROM public."${name}"`))?.c); }
    catch (e) { ledgerCounts[name] = null; }
  }
  out.ledger_related_tables = ledgerCounts;

  const hashRows = async (q: string) => {
    try {
      const data = await rows(q);
      return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 32);
    } catch (e) { return `ERR:${String(e).slice(0, 100)}`; }
  };
  out.row_dump_hashes = {
    account: await hashRows(`SELECT * FROM public.account ORDER BY 1,2`),
    currency: await hashRows(`SELECT * FROM public.currency ORDER BY 1`),
    job: await hashRows(`SELECT * FROM public.job ORDER BY 1`),
    job_application: await hashRows(`SELECT * FROM public.job_application ORDER BY 1`),
    job_submission: await hashRows(`SELECT * FROM public.job_submission ORDER BY 1`),
  };

  out.namespace_counts = {
    // 口径更正（探针自曝）：命名空间标记是 create_key 内的 `p4b2:` 段（键前缀必须为 `cli:`/`biz:` 等，§4.5）
    // ⇒ 匹配口径 = **包含** `p4b2`，不是「以 p4b2 起头」（旧口径 `NS+'%'` 恒 0 = 假零）
    job_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.job WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
    job_application_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.job_application WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
    job_submission_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.job_submission WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
    users_bio_like: n((await one(`SELECT count(*)::bigint AS c FROM public.users WHERE bio LIKE $1`, ['%' + NS + '%']))?.c),
    ledger_entry_event_root_like: n((await one(`SELECT count(*)::bigint AS c FROM public.ledger_entry WHERE event_root_key LIKE $1`, ['%' + NS + '%']))?.c),
  };
  try {
    out.account_invariants = await rows(`SELECT count(*)::int AS rows, COALESCE(sum(balance),0)::text AS sum_balance, COALESCE(sum(frozen),0)::text AS sum_frozen FROM public.account`);
  } catch (e) { out.account_invariants = `ERR:${String(e).slice(0, 120)}`; }
  out.job_statuses = await rows(`SELECT status, count(*)::int AS c FROM public.job GROUP BY status ORDER BY status`);
  out.application_statuses = await rows(`SELECT status, count(*)::int AS c FROM public.job_application GROUP BY status ORDER BY status`);
  out.legacy_task_progress_regclass = String((await one(`SELECT to_regclass('public.task_progress')::text AS r`))?.r);
  out.users_head = await rows(`SELECT uid, left(COALESCE(evm,''),10) AS evm_head FROM public.users ORDER BY uid LIMIT 5`);
  const p = write(`counts-${phaseName}.json`, out);
  console.log(`COUNTS[${phaseName}] file=${p}`);
  console.log(JSON.stringify({ table_counts: perTable, ledger_tables: ledgerCounts, namespace: out.namespace_counts, account: out.account_invariants, hashes: out.row_dump_hashes, task_progress: out.legacy_task_progress_regclass, users: out.users_head }));
}

async function fixture() {
  const u = await rows(`SELECT uid FROM public.users ORDER BY uid LIMIT 4`);
  const uids = u.map((r) => n(r.uid));
  const ledger: Record<string, unknown> = { created: {}, reused_uids: uids };
  if (uids.length < 2) {
    // 库为 seed 基线：`users` 0 行（本单实测）⇒ 夹具必须自建 2 个用户（uid ∈ 9700xx 命名空间区间）
    // `users` 约束（migrations/0002_user_identity.sql）：evm NOT NULL 且 ~ '^0x[0-9a-f]{40}$'；uid > 0
    for (const uid of [970001, 970002]) {
      const evm = `0x${String(uid).padEnd(40, '0')}`;
      try {
        await sql(`INSERT INTO public.users (uid, evm, bio) VALUES ($1,$2,$3) ON CONFLICT (uid) DO NOTHING`, [uid, evm, `${NS}:fixture user`]);
        ledger.created[`users:${uid}`] = 1;
      } catch (e) { ledger[`users_insert_error:${uid}`] = String(e).slice(0, 200); }
    }
    const after = await rows(`SELECT uid FROM public.users WHERE uid >= 970001 AND uid <= 970099 ORDER BY uid`);
    for (const r of after) uids.push(n(r.uid));
  }
  const employer = uids[0];
  const worker = uids[1] ?? uids[0];
  ledger.employer_uid = employer;
  ledger.worker_uid = worker;

  const mkJob = async (suffix: string, reward: number) => {
    const existing = await one(`SELECT job_id FROM public.job WHERE create_key = $1`, [`cli:${NS}:job:${suffix}`]);
    if (existing) return n(existing.job_id);
    const r = await one(
      `INSERT INTO public.job (employer_uid, cid, reward, title, description, status, create_key)
       VALUES ($1, 1, $2, $3, $4, 'open', $5) RETURNING job_id`,
      [employer, reward, `${NS}:fixture:${suffix}`, `${NS} P4-B2a fixture（无托管：escrow_txid 保持 NULL）`, `cli:${NS}:job:${suffix}`],
    );
    ledger.created[`job:${suffix}`] = n(r?.job_id);
    return n(r?.job_id);
  };

  const jobA = await mkJob('A', 137);
  const jobB = await mkJob('B', 251);
  ledger.jobA = jobA;
  ledger.jobB = jobB;
  const p = write('fixture-ledger.json', ledger);
  console.log(`FIXTURE file=${p}`);
  console.log(JSON.stringify(ledger));
}

async function verbs() {
  const fx = JSON.parse(fs.readFileSync(path.join(outDir, 'fixture-ledger.json'), 'utf8'));
  const svc = require('../src/job-service');
  const results: Array<Record<string, unknown>> = [];
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      const r = (await fn()) as Record<string, unknown>;
      results.push({ name, ok: r.ok, status: r.ok ? 200 : r.status, code: r.ok ? 'OK' : r.code, replay: r.ok ? r.replay : null, details: r.ok ? null : r.details });
    } catch (e) { results.push({ name, exception: String(e).slice(0, 400) }); }
  };

  await run('J2 apply(jobA,worker,key1) -> applied', () => svc.applyToJob({ jobId: fx.jobA, workerUid: fx.worker_uid, createKeyRaw: `cli:${NS}:app:A2` }));
  await run('J2 apply(jobA,worker,key1 again) -> replay', () => svc.applyToJob({ jobId: fx.jobA, workerUid: fx.worker_uid, createKeyRaw: `cli:${NS}:app:A2` }));
  await run('J2 apply(jobA,worker,key2) -> 409 exists', () => svc.applyToJob({ jobId: fx.jobA, workerUid: fx.worker_uid, createKeyRaw: `cli:${NS}:app:A2b` }));
  await run('J2 apply(jobA,EMPLOYER) -> 409 self', () => svc.applyToJob({ jobId: fx.jobA, workerUid: fx.employer_uid, createKeyRaw: `cli:${NS}:app:A1` }));
  await run('J2 apply(jobB,worker) -> applied', () => svc.applyToJob({ jobId: fx.jobB, workerUid: fx.worker_uid, createKeyRaw: `cli:${NS}:app:B2` }));
  await run('J2 apply(missing job) -> 404', () => svc.applyToJob({ jobId: 999999999, workerUid: fx.worker_uid, createKeyRaw: `cli:${NS}:app:X` }));
  await run('J2 apply(bad key prefix) -> 400', () => svc.applyToJob({ jobId: fx.jobA, workerUid: fx.worker_uid, createKeyRaw: 'nope:bad' }));

  const appB = await one(`SELECT application_id FROM public.job_application WHERE create_key = $1`, [`cli:${NS}:app:B2`]);
  const appA = await one(`SELECT application_id FROM public.job_application WHERE create_key = $1`, [`cli:${NS}:app:A2`]);
  const appBId = n(appB?.application_id);
  const appAId = n(appA?.application_id);
  results.push({ name: 'resolved ids', application_id_B: appBId, application_id_A: appAId });

  await run('J3 accept(jobB,appB,actor=WORKER) -> 403', () => svc.acceptApplication({ jobId: fx.jobB, applicationId: appBId, actorUid: fx.worker_uid }));
  await run('J3 accept(jobB,appB,actor=EMPLOYER) -> accepted', () => svc.acceptApplication({ jobId: fx.jobB, applicationId: appBId, actorUid: fx.employer_uid }));
  await run('J3 accept again -> 409 already_accepted', () => svc.acceptApplication({ jobId: fx.jobB, applicationId: appBId, actorUid: fx.employer_uid }));
  await run('J2 apply(jobB now accepted) -> 409 not_open', () => svc.applyToJob({ jobId: fx.jobB, workerUid: fx.worker_uid, createKeyRaw: `cli:${NS}:app:B2x` }));

  write('verbs-results.json', results);
  console.log('VERBS');
  for (const r of results) console.log(JSON.stringify(r));
}

const curl = (args: string[]) => {
  try {
    return execFileSync('curl', ['-sS', '--max-time', '20', ...args], { encoding: 'utf8' });
  } catch (e) { return `CURL_ERR:${String(e).slice(0, 200)}`; }
};
const curlStatus = (args: string[]) => {
  const out = curl([...args, '-o', path.join(outDir, '.last-body.json'), '-w', '%{http_code}']).trim();
  let body = '';
  try { body = fs.readFileSync(path.join(outDir, '.last-body.json'), 'utf8').slice(0, 400); } catch { /* ignore */ }
  return { status: out, body };
};

async function http() {
  const fx = JSON.parse(fs.readFileSync(path.join(outDir, 'fixture-ledger.json'), 'utf8'));
  const auth = require('../src/auth');
  const appB = await one(`SELECT application_id FROM public.job_application WHERE create_key = $1`, [`cli:${NS}:app:B2`]);
  const appA = await one(`SELECT application_id FROM public.job_application WHERE create_key = $1`, [`cli:${NS}:app:A2`]);
  const appBId = n(appB?.application_id);
  const appAId = n(appA?.application_id);
  const u2 = await one(`SELECT uid, COALESCE(evm,'') AS evm FROM public.users WHERE uid = $1`, [fx.worker_uid]);
  const uID = n(u2?.uid);
  const evm = String(u2?.evm || '');
  // 口径自曝：`src/auth.ts:3` 在**模块加载期**读 `process.env.SECRET_KEY || 'your-secret-key-here'`，
  // 而 `src/index.ts` 在 `./database`（内含 dotenv.config）之前 import `./auth` ⇒ 服务端很可能用**回退密钥**。
  // 故探针两种口径各铸一枚，实测哪一枚能过 `GET /api/user`（200）后用于后续写端点。
  // 用本脚本**逐字复刻** `src/auth.ts:36-47`（signToken）+ `:188-197`（createSessionToken）的 HS256 签名，
  // 避免 require-cache / env 加载顺序带来的口径不确定性：两枚候选 =
  //   ① env 口径（`.env.local` 的 SECRET_KEY）② 回退口径（auth.ts:3 的 'your-secret-key-here'）
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sign = (secret: string) => {
    const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: String(uID), evm, exp: Math.floor(Date.now() / 1000) + 1800 })}`;
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  const tokenEnv = sign(process.env.SECRET_KEY || 'your-secret-key-here');
  const tokenFallback = sign('your-secret-key-here');
  const H = ['-H', 'Content-Type: application/json'];
  const withToken = (t: string) => (t ? [...H, '-H', `Authorization: Bearer ${t}`] : [...H]);
  const results: Array<Record<string, unknown>> = [];
  const rec = (name: string, r: { status: string; body: string }) => results.push({ name, status: r.status, body_head: r.body.replace(/\s+/g, ' ').slice(0, 220) });

  rec('GET /health', curlStatus([`${API}/health`]));
  rec('GET /api/task/999999999 (miss -> 404)', curlStatus([`${API}/api/task/999999999`]));
  rec('GET /api/task/<jobB> (hit -> 200)', curlStatus([`${API}/api/task/${fx.jobB}`]));
  const rEnv = curlStatus([`${API}/api/user`, ...withToken(tokenEnv)]);
  const rFb = curlStatus([`${API}/api/user`, ...withToken(tokenFallback)]);
  rec('GET /api/user token=env-secret (auth isolation)', rEnv);
  rec('GET /api/user token=fallback-secret (auth isolation)', rFb);
  const token = rEnv.status === '200' ? tokenEnv : (rFb.status === '200' ? tokenFallback : '');
  const tokenMode = token === tokenEnv && token ? 'env-secret' : (token ? 'fallback-secret' : 'NONE');
  const WITH_AUTH = withToken(token);
  rec('POST /api/admin/task/create (-> 410)', curlStatus([`${API}/api/admin/task/create`, ...H, '-d', '{"title":"x","reward":1}']));
  rec('POST /api/admin/task/update (-> 410)', curlStatus([`${API}/api/admin/task/update`, ...H, '-d', '{"tID":1}']));
  rec('POST /api/admin/task/delete (-> 410)', curlStatus([`${API}/api/admin/task/delete`, ...H, '-d', '{"tID":1}']));
  rec('POST /api/task-progress/<appB>/submit 1st (-> 200)', curlStatus([`${API}/api/task-progress/${appBId}/submit`, ...WITH_AUTH, '-d', `{"info_input":"${NS}:deliverable-1","create_key":"cli:${NS}:sub:B2"}`]));
  rec('POST .../submit same key+payload (-> 200 replay)', curlStatus([`${API}/api/task-progress/${appBId}/submit`, ...WITH_AUTH, '-d', `{"info_input":"${NS}:deliverable-1","create_key":"cli:${NS}:sub:B2"}`]));
  rec('POST .../submit same key, diff payload (-> 409)', curlStatus([`${API}/api/task-progress/${appBId}/submit`, ...WITH_AUTH, '-d', `{"info_input":"${NS}:deliverable-2","create_key":"cli:${NS}:sub:B2"}`]));
  rec('POST .../submit bad key (-> 400)', curlStatus([`${API}/api/task-progress/${appBId}/submit`, ...WITH_AUTH, '-d', `{"info_input":"x","create_key":"nope:bad"}`]));
  rec('POST .../submit app not accepted (-> 409)', curlStatus([`${API}/api/task-progress/${appAId}/submit`, ...WITH_AUTH, '-d', `{"info_input":"x","create_key":"cli:${NS}:sub:A2"}`]));
  rec('POST .../submit unknown id (-> 404)', curlStatus([`${API}/api/task-progress/999999999/submit`, ...WITH_AUTH, '-d', `{"info_input":"x","create_key":"cli:${NS}:sub:Z"}`]));
  rec('POST .../submit no token (-> 401)', curlStatus([`${API}/api/task-progress/${appBId}/submit`, ...H, '-d', `{"info_input":"x"}`]));
  rec('POST .../claim/<appB> not-verified (无资金)', curlStatus(['-X', 'POST', `${API}/api/task-progress/claim/${appBId}`, ...WITH_AUTH]));
  rec('POST .../claim/<appA> not-verified (无资金)', curlStatus(['-X', 'POST', `${API}/api/task-progress/claim/${appAId}`, ...WITH_AUTH]));
  rec('POST .../claim/<appB> no token (-> 401)', curlStatus(['-X', 'POST', `${API}/api/task-progress/claim/${appBId}`, ...H]));

  const out = { generated_at: new Date().toISOString(), api: API, token_minted: Boolean(token), application_id_B: appBId, application_id_A: appAId, results };
  write('http-results.json', out);
  console.log(`HTTP token_minted=${Boolean(token)}`);
  for (const r of results) console.log(`${String(r.status)} | ${r.name} | ${String(r.body_head).slice(0, 120)}`);
}

(async () => {
  if (cmd === 'counts') await counts(phase);
  else if (cmd === 'fixture') await fixture();
  else if (cmd === 'verbs') await verbs();
  else if (cmd === 'http') await http();
  else { console.error('UNKNOWN_CMD ' + cmd); process.exit(2); }
})().catch((e) => { console.error('PROBE_FAIL ' + String(e).slice(0, 600)); process.exit(1); });

// 探针自曝：
//  1) 计数口径 = `count(*)` 逐表（含 `public."users"` 带引号保留字表名）；「before/after」两跑同脚本同表集。
//  2) 命名空间台账 = `create_key LIKE 'p4b2%'` 三表 + `ledger_entry/ledger_event_keys` 的 `event_root_key LIKE 'p4b2%'`（预期 0）。
//  3) fixture 复用既有 users（≥2 个）；不足才回填 uid 970001/970002（前缀命名空间）。**无任何 DELETE/TRUNCATE**。
//  4) 资金不变量 = account 行数 + sum(balance) + sum(frozen) + currency 行数/总供给 的 before/after 差；ledger_entry 增量须为 0。
//  5) `claim` 仅测「未审核态」短路（400）——**不含**资金分支（time_checked 非 0 的分支会写 account，属批 3 禁用面，NOT_MEASURED）。
//  6) 本脚本**不** `pkill`/`killall`、**不**跑写库套件、**不**改 migrations。
