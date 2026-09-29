// p4z-b2b-02-listing.ts — P4-B2b 探针（**neon() HTTP** 驱动；只 SELECT/INSERT，**无 DELETE**）
// Usage: ts-node --transpile-only scripts/p4z-b2b-02-listing.ts <outDir> <cmd> [phase]
//   cmd ∈ counts | fixture | verbs | http | keys
//   口径：docs/audit/p4-b2b-listing-write.md §0；自曝见文件尾。
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createHash, createHmac } from 'crypto';
import { neon } from '@neondatabase/serverless';

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const envPath = path.join(root, '.env.local');
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

const outDir = process.argv[2] || path.join(root, '.p4-artifacts', 'b2b-unknown');
const cmd = process.argv[3] || 'counts';
const phase = process.argv[4] || cmd;
fs.mkdirSync(outDir, { recursive: true });

const API = process.env.P4_API || 'http://127.0.0.1:5788';
const PANEL = process.env.P4_PANEL || 'http://127.0.0.1:5555';
const NS = process.env.P4_NS || 'p4b2c'; // 重跑腿用 P4_NS 切换（键集全新，避免与已落库夹具撞键；`LIKE '%p4b2c%'` 仍覆盖全部腿）
const SELLER = 970101;
const OTHER = 970102;
const TABLES = ['listing', 'listing_order', 'ledger_entry', 'account', 'currency', 'users', 'job', 'job_application', 'job_submission', 'app_config', 'commission_policy'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// neon HTTP 长链路偶发 `fetch failed`（B2a 实测）⇒ 4 次重试
const rows = async (q: string, p: unknown[] = []): Promise<Record<string, unknown>[]> => {
  let last: unknown = null;
  for (let i = 0; i < 4; i += 1) {
    try { return (await sql(q, p)) as never; } catch (e) { last = e; await sleep(400 * (i + 1)); }
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

// --------------------------------------------------------------------- counts
async function counts(phaseName: string) {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), phase: phaseName, driver: 'neon-http', namespace: NS };
  const perTable: Record<string, number | null> = {};
  for (const t of TABLES) {
    try { perTable[t] = n((await one(`SELECT count(*)::bigint AS c FROM public."${t}"`))?.c); }
    catch (e) { perTable[t] = null; out[`count_error:${t}`] = String(e).slice(0, 120); }
  }
  out.table_counts = perTable;

  // 动态发现 ledger* / listing* 表（不假设表名）
  for (const like of ['ledger%', 'listing%', 'prize%']) {
    const lt = await rows(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE $1 ORDER BY table_name`, [like]);
    const m: Record<string, number | null> = {};
    for (const r of lt) {
      const name = String(r.table_name);
      try { m[name] = n((await one(`SELECT count(*)::bigint AS c FROM public."${name}"`))?.c); } catch { m[name] = null; }
    }
    out[`tables_like_${like.replace('%', '')}`] = m;
  }

  const hashRows = async (q: string) => {
    try { return createHash('sha256').update(JSON.stringify(await rows(q))).digest('hex').slice(0, 32); }
    catch (e) { return `ERR:${String(e).slice(0, 100)}`; }
  };
  out.row_dump_hashes = {
    account: await hashRows(`SELECT * FROM public.account ORDER BY 1,2`),
    currency: await hashRows(`SELECT * FROM public.currency ORDER BY 1`),
    listing: await hashRows(`SELECT * FROM public.listing ORDER BY 1`),
    ledger_entry: await hashRows(`SELECT * FROM public.ledger_entry ORDER BY 1`),
    job: await hashRows(`SELECT * FROM public.job ORDER BY 1`),
    job_application: await hashRows(`SELECT * FROM public.job_application ORDER BY 1`),
    job_submission: await hashRows(`SELECT * FROM public.job_submission ORDER BY 1`),
    users: await hashRows(`SELECT * FROM public."users" ORDER BY 1`),
  };

  out.namespace_counts = {
    // 口径：命名空间标记是 `create_key` 内的 `p4b2c:` 段（键前缀须为 cli:/biz: 等）⇒ **包含**匹配，不是起头匹配
    listing_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.listing WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
    listing_order_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.listing_order WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
    users_bio_like: n((await one(`SELECT count(*)::bigint AS c FROM public."users" WHERE bio LIKE $1`, ['%' + NS + '%']))?.c),
    ledger_entry_event_root_like: n((await one(`SELECT count(*)::bigint AS c FROM public.ledger_entry WHERE event_root_key LIKE $1`, ['%' + NS + '%']))?.c),
    job_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.job WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
    job_submission_create_key_like: n((await one(`SELECT count(*)::bigint AS c FROM public.job_submission WHERE create_key LIKE $1`, ['%' + NS + '%']))?.c),
  };

  out.account_invariants = await rows(`SELECT count(*)::int AS rows, COALESCE(sum(balance),0)::text AS sum_balance, COALESCE(sum(frozen),0)::text AS sum_frozen FROM public.account`);
  out.account_rows = await rows(`SELECT uid, cid, balance::text, frozen::text FROM public.account ORDER BY uid, cid`);
  out.currency_rows = await rows(`SELECT cid, symbol, status, total_supply::text, owner_uid FROM public.currency ORDER BY cid`);
  out.listing_rows = await rows(`SELECT listing_id, seller_uid, cid, price::text, stock, title, status, create_key, ledger_event_keys, time_created, time_updated FROM public.listing ORDER BY listing_id`);
  out.listing_statuses = await rows(`SELECT status, count(*)::int AS c FROM public.listing GROUP BY status ORDER BY status`);
  out.job_rows = await rows(`SELECT job_id, employer_uid, worker_uid, status, create_key, escrow_txid IS NULL AS escrow_null FROM public.job ORDER BY job_id`);
  out.users_rows = await rows(`SELECT uid, left(COALESCE(evm,''),10) AS evm_head, bio, is_admin FROM public."users" ORDER BY uid`);
  out.schema_assertions = {
    listing_columns: await rows(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' ORDER BY ordinal_position`),
    listing_status_fn: await rows(`SELECT public.listing_status_transition_ok(p_from, p_to) AS ok, p_from, p_to FROM (VALUES ('draft','listed'),('draft','delisted'),('listed','delisted'),('listed','frozen'),('frozen','listed'),('delisted','listed'),('listed','listed')) AS t(p_from, p_to)`),
    listing_triggers: await rows(`SELECT tgname, tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relname = 'listing' AND NOT t.tgisinternal ORDER BY tgname`),
    listing_status_check_constraint: await rows(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.listing'::regclass AND contype = 'c' ORDER BY conname`),
  };
  const p = write(`counts-${phaseName}.json`, out);
  console.log(`COUNTS[${phaseName}] file=${p}`);
  console.log(JSON.stringify({
    table_counts: perTable, namespace: out.namespace_counts, account: out.account_invariants,
    listing: out.listing_rows, statuses: out.listing_statuses, currency: out.currency_rows,
    hashes: out.row_dump_hashes, fn: out.schema_assertions.listing_status_fn,
  }));
}

// -------------------------------------------------------------------- fixture
async function fixture() {
  const ledger: Record<string, unknown> = { created: {}, ns: NS };
  for (const uid of [SELLER, OTHER]) {
    const evm = `0x${String(uid).padEnd(40, '0')}`;
    try {
      await sql(`INSERT INTO public."users" (uid, evm, bio) VALUES ($1,$2,$3) ON CONFLICT (uid) DO NOTHING`, [uid, evm, `${NS}:fixture user`]);
      ledger.created[`users:${uid}`] = 1;
    } catch (e) { ledger[`users_insert_error:${uid}`] = String(e).slice(0, 200); }
  }
  // HTTP 层「幂等重投」补偿读数用夹具（走**已注册**的既有写端点 `/api/task-progress/:identifier/submit`，无分录）
  const jobKey = `cli:${NS}:job:S1`;
  let jobId = n((await one(`SELECT job_id FROM public.job WHERE create_key = $1`, [jobKey]))?.job_id);
  if (!jobId) {
    const r = await one(
      `INSERT INTO public.job (employer_uid, cid, reward, title, description, status, worker_uid, create_key)
       VALUES ($1, 1, 11, $2, $3, 'accepted', $4, $5) RETURNING job_id`,
      [SELLER, `${NS}:fixture job`, `${NS} P4-B2b（无托管：escrow_txid 保持 NULL）`, OTHER, jobKey],
    );
    jobId = n(r?.job_id);
  }
  const appKey = `cli:${NS}:app:S1`;
  let appId = n((await one(`SELECT application_id FROM public.job_application WHERE create_key = $1`, [appKey]))?.application_id);
  if (!appId) {
    const r = await one(
      `INSERT INTO public.job_application (job_id, worker_uid, status, create_key) VALUES ($1,$2,'accepted',$3) RETURNING application_id`,
      [jobId, OTHER, appKey],
    );
    appId = n(r?.application_id);
  }
  ledger.seller_uid = SELLER;
  ledger.other_uid = OTHER;
  ledger.http_submit_fixture = { job_id: jobId, application_id: appId };
  const p = write('fixture-ledger.json', ledger);
  console.log(`FIXTURE file=${p}`);
  console.log(JSON.stringify(ledger));
}

// ---------------------------------------------------------------------- verbs
const summarise = (r: Record<string, unknown>) => ({
  ok: r.ok, status: r.ok ? 200 : r.status, code: r.ok ? 'OK' : r.code, replay: r.ok ? r.replay : null,
  details: r.ok ? null : r.details, view: r.ok ? r.view : null,
});

async function verbs() {
  const svc = require('../src/listing-service');
  const results: Array<Record<string, unknown>> = [];
  const run = async (name: string, expect: string, fn: () => Promise<unknown>) => {
    try {
      const r = (await fn()) as Record<string, unknown>;
      const s = summarise(r);
      results.push({ name, expect, ...s });
    } catch (e) { results.push({ name, expect, exception: String(e).slice(0, 300) }); }
  };

  const base = { sellerUid: SELLER, cid: 1, price: 137, stock: 5, title: `${NS}:listing A`, description: `${NS} desc`, mediaUrls: [`p4b2c://a.png`] };
  await run('P1 create(listing A, key L1) -> inserted', '200 replay=false', () => svc.createListing({ ...base, createKeyRaw: `cli:${NS}:listing:L1` }));
  const created = await one(`SELECT listing_id, status FROM public.listing WHERE create_key = $1`, [`cli:${NS}:listing:L1`]);
  const lidA = n(created?.listing_id);
  results.push({ name: 'resolved lidA', expect: '—', listing_id: lidA, status: created?.status });
  await run('P1 create(same key+payload) -> REPLAY', '200 replay=true', () => svc.createListing({ ...base, createKeyRaw: `cli:${NS}:listing:L1` }));
  await run('P1 create(same key, diff price) -> 409', '409 LD003', () => svc.createListing({ ...base, price: 138, createKeyRaw: `cli:${NS}:listing:L1` }));
  await run('P1 create(no key -> derived) -> inserted', '200 replay=false', () => svc.createListing({ ...base, createKeyRaw: undefined }));
  await run('P1 create(bad key prefix) -> 400', '400', () => svc.createListing({ ...base, createKeyRaw: 'nope:bad' }));
  await run('P1 create(price=0) -> 400', '400 LD017', () => svc.createListing({ ...base, price: 0, createKeyRaw: `cli:${NS}:listing:P0` }));
  await run('P1 create(price="200" 十进制字符串) -> inserted', '200', () => svc.createListing({ ...base, price: '200', createKeyRaw: `cli:${NS}:listing:P200` }));
  await run('P1 create(stock=0) -> inserted', '200', () => svc.createListing({ ...base, stock: 0, createKeyRaw: `cli:${NS}:listing:S0` }));
  await run('P1 create(seller_uid=0 保留 uid) -> 400', '400 LD022', () => svc.createListing({ ...base, sellerUid: 0, createKeyRaw: `cli:${NS}:listing:Z` }));
  await run('P1 create(cid=999999 不存在) -> 404', '404 LD007', () => svc.createListing({ ...base, cid: 999999, createKeyRaw: `cli:${NS}:listing:CX` }));
  await run('P1 create(cid=1 币种闸实测) -> 见 status', '闸口径', () => svc.createListing({ ...base, createKeyRaw: `cli:${NS}:listing:C1` }));
  await run('P1 transition(draft->listed)', '200', () => svc.transitionListingStatus({ listingId: lidA, actorUid: SELLER, toStatus: 'listed' }));
  await run('P1 transition(listed->listed 白名单外)', '409 LD011 LISTING_STATE_INVALID', () => svc.transitionListingStatus({ listingId: lidA, actorUid: SELLER, toStatus: 'listed' }));
  await run('P1 update(stock 5->7 @listed)', '200', () => svc.updateListing({ listingId: lidA, actorUid: SELLER, stock: 7 }));
  await run('P1 update(price+title @listed)', '200', () => svc.updateListing({ listingId: lidA, actorUid: SELLER, price: 199, title: `${NS}:listing A v2` }));
  await run('P1 update(非卖家) -> 403', '403 AUTH_FORBIDDEN ACTOR_NOT_ALLOWED', () => svc.updateListing({ listingId: lidA, actorUid: OTHER, price: 1 }));
  await run('P1 transition(listed->delisted)', '200', () => svc.transitionListingStatus({ listingId: lidA, actorUid: SELLER, toStatus: 'delisted' }));
  await run('P1 update(delisted 终态) -> 409', '409 LISTING_STATE_INVALID(delisted_terminal)', () => svc.updateListing({ listingId: lidA, actorUid: SELLER, price: 200 }));
  await run('P1 transition(delisted->listed 终态) -> 409', '409 LISTING_STATE_INVALID', () => svc.transitionListingStatus({ listingId: lidA, actorUid: SELLER, toStatus: 'listed' }));
  await run('P1 transition(miss) -> 404', '404 LD023 ref_type=listing', () => svc.transitionListingStatus({ listingId: 999999999, actorUid: SELLER, toStatus: 'listed' }));
  await run('P1 update(miss) -> 404', '404 LD023', () => svc.updateListing({ listingId: 999999999, actorUid: SELLER, price: 1 }));

  // 第二件：draft 常温下的两道闸
  await run('P1 create(listing B, key L2) -> inserted(draft)', '200', () => svc.createListing({ ...base, title: `${NS}:listing B`, createKeyRaw: `cli:${NS}:listing:L2` }));
  const b = await one(`SELECT listing_id FROM public.listing WHERE create_key = $1`, [`cli:${NS}:listing:L2`]);
  const lidB = n(b?.listing_id);
  results.push({ name: 'resolved lidB', expect: '—', listing_id: lidB });
  await run('P1 update(stock @draft) -> 409', '409 listing_stock_change_requires_listed', () => svc.updateListing({ listingId: lidB, actorUid: SELLER, stock: 9 }));
  await run('P1 update(price @draft, 非库存) -> 200', '200（DL60 只闸 stock）', () => svc.updateListing({ listingId: lidB, actorUid: SELLER, price: 155 }));
  await run('P1 transition(draft->delisted) -> 409', '409 白名单外', () => svc.transitionListingStatus({ listingId: lidB, actorUid: SELLER, toStatus: 'delisted' }));
  await run('P1 transition(draft->frozen) -> 409', '409 白名单外', () => svc.transitionListingStatus({ listingId: lidB, actorUid: SELLER, toStatus: 'frozen' }));

  const finalRows = await rows(`SELECT listing_id, seller_uid, cid, price::text, stock, title, status, create_key, ledger_event_keys FROM public.listing WHERE create_key LIKE $1 ORDER BY listing_id`, ['%' + NS + '%']);
  write('verbs-results.json', { generated_at: new Date().toISOString(), results, final_rows: finalRows });
  console.log('VERBS rows=' + finalRows.length);
  for (const r of results) console.log(JSON.stringify({ name: r.name, expect: r.expect, status: r.status, code: r.code, replay: r.replay, details: r.details, exception: r.exception }));
  console.log('FINAL_ROWS ' + JSON.stringify(finalRows));
}

// ----------------------------------------------------------------------- http
const curl = (args: string[]) => {
  try { return execFileSync('curl', ['-sS', '--max-time', '20', ...args], { encoding: 'utf8' }); }
  catch (e) { return `CURL_ERR:${String(e).slice(0, 200)}`; }
};
const curlStatus = (args: string[]) => {
  const bodyFile = path.join(outDir, '.last-body.json');
  const status = curl([...args, '-o', bodyFile, '-w', '%{http_code}']).trim();
  let body = '';
  try { body = fs.readFileSync(bodyFile, 'utf8').slice(0, 400); } catch { /* ignore */ }
  return { status, body };
};

async function http() {
  const fx = JSON.parse(fs.readFileSync(path.join(outDir, 'fixture-ledger.json'), 'utf8'));
  const H = ['-H', 'Content-Type: application/json'];
  // 铸 token：两候选（`.env.local` 的 SECRET_KEY / `auth.ts:3` 兑底常量），逐字复刻 auth.ts:36-47 + :188-197
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sign = (secret: string) => {
    const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: String(OTHER), evm: `0x${String(OTHER).padEnd(40, '0')}`, exp: Math.floor(Date.now() / 1000) + 1800 })}`;
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  const fp = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 12);
  const tokenEnv = sign(process.env.SECRET_KEY || 'your-secret-key-here');
  const tokenFallback = sign('your-secret-key-here');
  const withToken = (t: string) => (t ? [...H, '-H', `Authorization: Bearer ${t}`] : [...H]);

  const results: Array<Record<string, unknown>> = [];
  const rec = (name: string, r: { status: string; body: string }) => results.push({
    name, status: r.status, body_head: r.body.replace(/\s+/g, ' ').slice(0, 240),
  });

  rec('GET /health', curlStatus([`${API}/health`]));
  const rEnv = curlStatus([`${API}/api/user`, ...withToken(tokenEnv)]);
  const rFb = curlStatus([`${API}/api/user`, ...withToken(tokenFallback)]);
  results.push({ name: 'auth isolation: token=env-secret', status: rEnv.status, body_head: rEnv.body.slice(0, 120), key_len: (process.env.SECRET_KEY || '').length, token_fp: fp(tokenEnv) });
  results.push({ name: 'auth isolation: token=fallback-secret', status: rFb.status, body_head: rFb.body.slice(0, 120), key_len: 'your-secret-key-here'.length, token_fp: fp(tokenFallback) });
  const useFallback = rFb.status === '200';
  const token = rEnv.status === '200' ? tokenEnv : (useFallback ? tokenFallback : '');
  const AUTH = withToken(token);
  results.push({ name: 'auth mode', status: token ? '200' : 'NONE', body_head: rEnv.status === '200' ? 'env-secret' : (useFallback ? 'fallback-secret' : 'NONE (both 401)') });

  // 回归（读口；B1 已完成改接，本片只做读数）
  const lidA = n((await one(`SELECT listing_id FROM public.listing WHERE create_key = $1`, [`cli:${NS}:listing:L1`]))?.listing_id);
  rec('GET /api/prize/all (回归 200)', curlStatus([`${API}/api/prize/all?limit=5`, ...AUTH]));
  rec('GET /api/prize/<fixture lidA> (回归 200)', curlStatus([`${API}/api/prize/${lidA}`, ...AUTH]));
  rec('GET /api/prize/999999999 (miss -> 404)', curlStatus([`${API}/api/prize/999999999`, ...AUTH]));
  rec('GET /api/home (回归 200)', curlStatus([`${API}/api/home?task_limit=5&prize_limit=5`, ...AUTH]));
  rec('GET /api/task/all (回归 200)', curlStatus([`${API}/api/task/all?limit=5`, ...AUTH]));
  rec('GET /api/market/1/orderbook (回归 200)', curlStatus([`${API}/api/market/1/orderbook`, ...AUTH]));
  rec('GET /api/prize-item (回归 200 + 键集)', curlStatus([`${API}/api/prize-item`, ...AUTH]));
  rec('GET /api/user (回归 200)', curlStatus([`${API}/api/user`, ...AUTH]));

  // 本片 410 面（无 token / 有 token 两侧都读；弃用面不得伪装成 401）
  for (const p of ['/api/admin/prize/create', '/api/admin/prize/update', '/api/admin/prize/delete']) {
    rec(`POST ${p} (无 token -> 410)`, curlStatus(['-X', 'POST', `${API}${p}`, ...H, '-d', '{"bID":1}']));
    rec(`POST ${p} (有 token -> 410)`, curlStatus(['-X', 'POST', `${API}${p}`, ...AUTH, '-d', '{"bID":1}']));
  }
  rec('POST /api/shard/redeem (有 token -> 410)', curlStatus(['-X', 'POST', `${API}/api/shard/redeem`, ...AUTH, '-d', `{"bID":${lidA}}`]));
  rec('POST /api/chest/1/open (有 token -> 410)', curlStatus(['-X', 'POST', `${API}/api/chest/1/open`, ...AUTH, '-d', '{}']));

  // 「商品写路径未注册」的负面证据（§1.3-1 的处置口径）
  rec('POST /api/listing (未注册 -> 404 兜底)', curlStatus(['-X', 'POST', `${API}/api/listing`, ...AUTH, '-d', `{"cid":1,"price":100,"stock":1,"title":"${NS}"}`]));
  rec('POST /api/job/2/apply (未注册 -> 404 兜底)', curlStatus(['-X', 'POST', `${API}/api/job/2/apply`, ...AUTH, '-d', '{"create_key":"cli:p4b2c:nope"}']));

  // ★ 幂等重投（HTTP 级、真 token、既有已注册写端点；非资金：`job_submission`）
  const appId = n(fx.http_submit_fixture?.application_id);
  const payload = JSON.stringify({ info_input: `${NS}:deliverable-1`, create_key: `cli:${NS}:sub:S1` });
  rec(`POST /api/task-progress/${appId}/submit (首发 -> 200)`, curlStatus(['-X', 'POST', `${API}/api/task-progress/${appId}/submit`, ...AUTH, '-d', payload]));
  rec(`POST /api/task-progress/${appId}/submit (同键同载荷 -> 200 replay)`, curlStatus(['-X', 'POST', `${API}/api/task-progress/${appId}/submit`, ...AUTH, '-d', payload]));
  rec(`POST /api/task-progress/${appId}/submit (无 token -> 401)`, curlStatus(['-X', 'POST', `${API}/api/task-progress/${appId}/submit`, ...H, '-d', payload]));
  rec('POST /api/shard/redeem (无 token -> 410，不伪装 401)', curlStatus(['-X', 'POST', `${API}/api/shard/redeem`, ...H, '-d', `{"bID":${lidA}}`]));

  // 401/403 判读纪律（§0.1-9）：同时看服务端日志
  const logs = curl(['--max-time', '20', `${PANEL}/api/logs/seafood-api`]);
  const logTail = logs.slice(-4000);
  write('server-logs-tail.txt', logTail);
  results.push({ name: 'server logs tail (panel)', status: 'FETCHED', body_head: /Failed to resolve actor|Invalid token signature|does not exist/.test(logTail) ? '见 server-logs-tail.txt（含 resolveActor/token 关键词）' : '无 resolveActor/token 关键词' });

  const out = { generated_at: new Date().toISOString(), api: API, token_minted: Boolean(token), results };
  write('http-results.json', out);
  console.log(`HTTP token_minted=${Boolean(token)}`);
  for (const r of results) console.log(`${String(r.status)} | ${String(r.name)} | ${String(r.body_head).slice(0, 160)}`);
}

// ----------------------------------------------------------------------- keys
// 键集冻结（§2 母约束 F1）：内存夹具喂 **改前** mapper（`git show HEAD:backend-ts/src/database.ts` +
// 本片改动前备份 `orig/src_database.ts.orig`）与 **改后** mapper ⇒ 逐 key 比对（只比 key 集，不比值）。
async function keys() {
  const gen = (label: string, source: string) => {
    const imports = [...new Set((source.match(/from '\.\/[A-Za-z0-9._-]+'/g) || []))];
    let s = source;
    for (const imp of imports) {
      const name = imp.slice("from './".length, -1);
      s = s.split(imp).join(`from '${path.join(root, 'src', name)}'`);
    }
    if (!/export \{\s*normalizeBrand/.test(s)) s += `\nexport { normalizeBrand, normalizePrizeItem };\n`;
    const p = path.join(outDir, `database.${label}.ts`);
    fs.writeFileSync(p, s);
    return p;
  };

  const headSrc = execFileSync('git', ['show', 'HEAD:backend-ts/src/database.ts'], { encoding: 'utf8', cwd: repoRoot });
  const origPath = path.join(outDir, 'orig', 'src_database.ts.orig');
  const origSrc = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf8') : null;
  const curSrc = fs.readFileSync(path.join(root, 'src', 'database.ts'), 'utf8');

  const mods: Record<string, { brand?: unknown; item?: unknown; error?: string }> = {};
  const load = (label: string, src: string) => {
    try {
      const m = require(path.resolve(gen(label, src)));
      mods[label] = { brand: m.normalizeBrand, item: m.normalizePrizeItem };
    } catch (e) { mods[label] = { error: String(e).slice(0, 200) }; }
  };
  load('HEAD', headSrc);
  if (origSrc) load('preb2b', origSrc);
  load('postb2b', curSrc);

  // 合成行（旧列名 + 新列名并集；对两侧 mapper 喂**同一行**）
  const brandRow: Record<string, unknown> = {
    bID: 777, listing_id: 777, uID: SELLER, seller_uid: SELLER, cid: 1, name: 'x', title: 'x', points: 10, price: 10,
    description: 'd', image: 'i', image_url: 'i', brand: 'b', status: 'listed', stock: 3, media_urls: ['u1'],
    time_created: '2026-01-01T00:00:00Z', time_updated: '2026-01-01T00:00:00Z', time_start: 1, time_end: 2,
    market_is_open: true, free_shards_remaining: 0, shard_price: 0, total_supply: 0, claimed: 0, claim_count: 0,
    is_claimed: false, is_active: true, is_deleted: false, tags: [], category: 'c', seller: 's', owner: 'o',
  };
  const itemRow: Record<string, unknown> = { gID: 5, order_id: 5, bID: 777, listing_id: 777, uID: SELLER, buyer_uid: SELLER, status: 'paid', price: 10, quantity: 1, time_created: '2026-01-01T00:00:00Z' };
  const ctx = { brand: null as unknown, prize: null as unknown, market: null as unknown, seller: null as unknown };

  const callWith = (fn: unknown, row: Record<string, unknown>) => {
    const f = fn as (...a: unknown[]) => Record<string, unknown>;
    for (const args of [[row], [row, ctx]]) {
      try {
        const out = f(...args);
        if (out && typeof out === 'object') return { keys: Object.keys(out).sort(), mode: args.length };
      } catch { /* try next */ }
    }
    return { keys: null as string[] | null, mode: -1 };
  };

  const report: Record<string, unknown> = { generated_at: new Date().toISOString(), labels: Object.keys(mods) };
  const compare = (label: 'brand' | 'item') => {
    const row = label === 'brand' ? brandRow : itemRow;
    const calls: Record<string, unknown> = {};
    for (const [k, m] of Object.entries(mods)) {
      if (!m.brand && !m.item) { calls[k] = { error: m.error }; continue; }
      const r = callWith(label === 'brand' ? m.brand : m.item, row);
      calls[k] = { key_count: r.keys === null ? null : r.keys.length, mode: r.mode, keys: r.keys };
    }
    const sets = Object.values(calls).filter((c) => (c as { keys?: string[] | null }).keys).map((c) => JSON.stringify((c as { keys: string[] }).keys));
    const allEqual = sets.length >= 2 && sets.every((s) => s === sets[0]);
    return { calls, all_key_sets_equal: allEqual, compared_labels: sets.length };
  };
  report.normalizeBrand = compare('brand');
  report.normalizePrizeItem = compare('item');
  const p = write('keys-results.json', report);
  console.log(`KEYS file=${p}`);
  for (const [name, v] of Object.entries({ normalizeBrand: report.normalizeBrand, normalizePrizeItem: report.normalizePrizeItem })) {
    const r = v as { all_key_sets_equal: boolean; compared_labels: number; calls: Record<string, { key_count?: number | null; error?: string }> };
    console.log(`${name}: all_key_sets_equal=${r.all_key_sets_equal} labels=${r.compared_labels} ` +
      Object.entries(r.calls).map(([k, c]) => `${k}=${c.error ? 'ERR' : c.key_count}`).join(' '));
  }
}

(async () => {
  if (cmd === 'counts') await counts(phase);
  else if (cmd === 'fixture') await fixture();
  else if (cmd === 'verbs') await verbs();
  else if (cmd === 'http') await http();
  else if (cmd === 'keys') await keys();
  else { console.error('UNKNOWN_CMD ' + cmd); process.exit(2); }
})().catch((e) => { console.error('PROBE_FAIL ' + String(e).slice(0, 600)); process.exit(1); });

// 探针自曝：
//  1) 计数口径 = `count(*)` 逐表（保留字表名 `public."users"` **带引号**）；before/after 同脚本同表集。
//  2) 命名空间台账 = `create_key LIKE '%p4b2c%'`（**包含**匹配；起头匹配恒 0 = 假零，B2a §4.3-1 已吃过这个亏）。
//  3) 只 INSERT/SELECT；**无 DELETE/TRUNCATE/DROP**；不跑写库套件；不改 migrations；不 kill 任何进程。
//  4) token 只以 `sha256…slice(12)` 指纹 + key_len 入盘（JWT 本体不落盘）；连接串来自 .env.local，不经 argv。
//  5) `keys` 子命令把两侧 database.ts 复制成 `.p4-artifacts` 下的临时模块（相对 import 重写为绝对 + 追加
//     `export { normalizeBrand, normalizePrizeItem }`）后 `require`；**只比 key 集不比值**，且对两侧喂同一合成行。
