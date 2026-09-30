// p4z-b5l-01-login.ts — B5-FIX-LOGIN 探针 v2（**真 HTTP + 真库**）
// ============================================================================
// v2 修订（v1 自伤，见报告 §6 探针自曝）：本机 `/health` 会触库，Neon 抖动时驱动抛
//   `TypeError: Cannot set property message of #<ErrorEvent>` ⇒ 服务自退（已知风险）。
//   故：① `/health` 探测**移到末尾**（不挡核心判据）且非致命；② 所有 HTTP 取数包
//   try/catch，传输失败记为 `status:-1` + `FETCH_ERROR:…`，**不**中断全例。
// 目的（改前/改后同脚本同口径）：
//   C1 新随机 EVM 地址（库内无 `account` 行）challenge→verify：改前应 401、改后应 200 + points=0
//   C2 存量用户（有 cid=1 account 行）⇒ 200 且 points 与库内 balance 一致
//   C3/C4/C5/C6 负例：无 challenge_token / 伪造 token / 空签名 / 地址不匹配 ⇒ 401
//   C7 签名内容不校验（历史遗留）现取读数——本单**不**改鉴权语义，只记录
//   C8 回归：GET /api/user/asset/:uID（P4-B1-a 已修面）仍 200
// 库面（只 SELECT）：users/account/ledger_entry 指纹 + `asset` 表存在性
// 用法（§5.7①：退出码取自命令本身，非管道之后）：
//   node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-b5l-01-login.ts <outDirAbs>
// 硬边界：不发 DDL/DML；产物**不含**任何密钥/token。
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b5l-probe'));
fs.mkdirSync(outDir, { recursive: true });
const API = String(process.env.SEAFOOD_API_URL || 'http://127.0.0.1:5788');

// .env.local 只读加载（不改写、不打印）
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
const { neon } = require('@neondatabase/serverless');
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));

let HIT_BRANCH = 'UNKNOWN';
const run = async (q: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
  const anySql = sqlRaw as unknown as {
    (t: string, p?: unknown[]): Promise<unknown[]>;
    query?: (t: string, p?: unknown[]) => Promise<unknown[]>;
    unsafe?: (t: string, p?: unknown[]) => Promise<unknown[]>;
  };
  if (typeof anySql.query === 'function') {
    HIT_BRANCH = 'sql.query';
    return (await anySql.query(q, params)) as Record<string, unknown>[];
  }
  if (typeof anySql.unsafe === 'function' && params.length) {
    HIT_BRANCH = 'sql.unsafe';
    return (await anySql.unsafe(q, params)) as Record<string, unknown>[];
  }
  HIT_BRANCH = 'sql(text,params)';
  return (await anySql(q, params)) as Record<string, unknown>[];
};

const steps: string[] = [];
const log = (s: string) => { const l = `[${new Date().toISOString()}] ${s}`; steps.push(l); console.log(l); };
const one = async (q: string, p: unknown[] = []) => (await run(q, p))[0] || null;
const guarded = async (label: string, q: string, p: unknown[] = []): Promise<unknown> => {
  try { return await one(q, p); } catch (e) { const m = e instanceof Error ? e.message : String(e); log(`DB_READ_FAIL ${label}: ${m}`); return { __error: m }; }
};

type HttpResult = { status: number; body: string; json: any };
const doFetch = async (p: string, init?: RequestInit): Promise<HttpResult> => {
  try {
    const res = await fetch(`${API}${p}`, init);
    const text = await res.text();
    let json: any = null; try { json = JSON.parse(text); } catch { /* non-json */ }
    return { status: res.status, body: text.slice(0, 700), json };
  } catch (e) {
    const m = e instanceof Error ? `${e.message} cause=${(e as any).cause?.code || (e as any).cause?.message || 'n/a'}` : String(e);
    return { status: -1, body: `FETCH_ERROR: ${m}`, json: null };
  }
};
const postJson = (p: string, body: unknown) => doFetch(p, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify(body),
});
const getJson = (p: string, token: string) => doFetch(p, { headers: { accept: 'application/json', authorization: `Bearer ${token}` } });

const newEvm = () => '0x' + crypto.randomBytes(20).toString('hex');
const fakeSig = () => '0x' + crypto.randomBytes(65).toString('hex');

const challenge = async (evm: string): Promise<{ token: string | null; status: number }> => {
  const r = await postJson('/api/auth/challenge', { evm_address: evm });
  return { token: r.json?.data?.challenge_token || r.json?.challenge_token || null, status: r.status };
};

const results: any = { api: API, probe_version: 'v2', started_at: new Date().toISOString(), fixture: {}, db_before: {}, db_after: {}, http_cases: {} };

(async () => {
  log(`API=${API} outDir=${outDir}`);

  // ---------- DB 只读指纹（先于任何 HTTP 写请求） ----------
  results.db_before.schema_selfcheck = {
    account_columns: await guarded('account_columns',
      `SELECT string_agg(column_name, ',' ORDER BY ordinal_position) AS cols
       FROM information_schema.columns WHERE table_schema='public' AND table_name='account'`),
  };
  // 表存在性自检（**逐名**；区分「表不存在(reg=null → ABSENT)」与「读失败(READ_ERROR:…)」——v1 曾把 NULL 误标为 READ_FAILED）
  const existingTables: Record<string, string> = {};
  for (const t of ['account', 'ledger_entry', 'users', 'asset', 'task_progress', 'shard', 'shard_transfer', 'task', 'prize', 'prize_item']) {
    try {
      const row = await one(`SELECT to_regclass('public.' || $1)::text AS reg`, [t]);
      existingTables[t] = row ? ((row as any).reg === null ? 'ABSENT (reg=null)' : String((row as any).reg)) : 'ROW_ERR';
    } catch (err) { existingTables[t] = 'READ_ERROR: ' + (err instanceof Error ? err.message : String(err)); }
  }
  results.db_before.table_existence = existingTables;
  log(`TABLE_EXISTENCE=${JSON.stringify(existingTables)}`);
  const fp = async () => ({
    users_total: await guarded('users_total', `SELECT count(*)::int AS n FROM "users"`),
    account_rows_total: await guarded('account_rows_total', `SELECT count(*)::int AS n FROM account`),
    account_rows_cid1: await guarded('account_rows_cid1', `SELECT count(*)::int AS n FROM account WHERE cid = 1`),
    account_sum_balance_cid1: await guarded('account_sum_balance_cid1',
      `SELECT COALESCE(SUM(balance),0)::text AS s FROM account WHERE cid = 1`),
    ledger_entry_total: await guarded('ledger_entry_total', `SELECT count(*)::int AS n FROM ledger_entry`),
    users_without_cid1_account: await guarded('users_without_cid1_account',
      `SELECT count(*)::int AS n FROM "users" u WHERE NOT EXISTS (SELECT 1 FROM account a WHERE a.uid = u.uid AND a.cid = 1)`),
  });
  results.db_before.fingerprint = await fp();
  log(`DB_BEFORE=${JSON.stringify(results.db_before.fingerprint)}`);

  // ---------- 夹具 ----------
  const newAddr = newEvm();
  const existing = await guarded('pick_existing',
    `SELECT u.uid::text AS uid, u.evm, a.balance::text AS balance
     FROM "users" u JOIN account a ON a.uid = u.uid AND a.cid = 1
     WHERE u.evm ~ '^0x[a-f0-9]{40}$' ORDER BY u.uid LIMIT 1`);
  results.fixture = {
    new_evm_address: newAddr,
    new_evm_private_key: 'NOT_USED（服务端不校验签名内容，见 C7 ⇒ 本单无需私钥）',
    existing_user: existing,
  };
  log(`FIXTURE new=${newAddr} existing=${JSON.stringify(existing)}`);

  // ---------- C1 新用户（无 account 行）★核心判据 ----------
  {
    const ch = await challenge(newAddr);
    const r = await postJson('/api/auth/verify', { evm_address: newAddr, signature: fakeSig(), challenge_token: ch.token });
    const uidRow = await guarded('c1_uid', `SELECT uid::text AS uid FROM "users" WHERE evm = $1`, [newAddr]);
    results.http_cases.C1_new_user_verify = {
      challenge_status: ch.status, status: r.status, body: r.body,
      points: r.json?.data?.points ?? r.json?.points ?? null,
      has_token: Boolean(r.json?.data?.token || r.json?.token),
      user_row_after: uidRow,
      error_42P01_in_body: /42P01|relation .*asset.* does not exist/i.test(r.body),
    };
    results.fixture.new_user_uid = (uidRow as any)?.uid ?? null;
    log(`C1_NEW_USER verify ⇒ ${r.status} points=${results.http_cases.C1_new_user_verify.points} 42P01_in_body=${results.http_cases.C1_new_user_verify.error_42P01_in_body}`);
  }

  // ---------- C2 存量用户 ----------
  if (existing && (existing as any).evm) {
    const evm = String((existing as any).evm);
    const ch = await challenge(evm);
    const r = await postJson('/api/auth/verify', { evm_address: evm, signature: fakeSig(), challenge_token: ch.token });
    const token = r.json?.data?.token || r.json?.token || null;
    const pts = r.json?.data?.points ?? r.json?.points ?? null;
    results.http_cases.C2_existing_user_verify = {
      challenge_status: ch.status, status: r.status,
      points_http: pts, balance_db: (existing as any).balance,
      matches: String(pts) === String((existing as any).balance),
      body: String(r.body).replace(String(token || ''), '<TOKEN_REDACTED>'),
    };
    log(`C2_EXISTING verify ⇒ ${r.status} points=${pts} db_balance=${(existing as any).balance} matches=${results.http_cases.C2_existing_user_verify.matches}`);

    if (token) {
      const uid = Number((existing as any).uid);
      const g = await getJson(`/api/user/asset/${uid}`, token);
      results.http_cases.C8_get_user_asset = { status: g.status, body: String(g.body).replace(String(token), '<TOKEN_REDACTED>') };
      log(`C8_GET_USER_ASSET ⇒ ${g.status}`);
    }
  } else {
    results.http_cases.C2_existing_user_verify = { status: null, note: 'NO_USER_WITH_CID1_ACCOUNT_FOUND_OR_DB_READ_FAILED' };
    log('C2_EXISTING SKIPPED');
  }

  // ---------- C3 无 challenge_token ----------
  {
    const r = await postJson('/api/auth/verify', { evm_address: newEvm(), signature: fakeSig() });
    results.http_cases.C3_missing_challenge_token = { status: r.status, body: r.body };
    log(`C3_NO_TOKEN ⇒ ${r.status}`);
  }
  // ---------- C4 伪造 challenge_token ----------
  {
    const r = await postJson('/api/auth/verify', { evm_address: newEvm(), signature: fakeSig(), challenge_token: 'not-a-jwt' });
    results.http_cases.C4_forged_challenge_token = { status: r.status, body: r.body };
    log(`C4_FORGED_TOKEN ⇒ ${r.status}`);
  }
  // ---------- C5 空签名 ----------
  {
    const a = newEvm();
    const ch = await challenge(a);
    const r = await postJson('/api/auth/verify', { evm_address: a, signature: '', challenge_token: ch.token });
    results.http_cases.C5_empty_signature = { status: r.status, body: r.body };
    log(`C5_EMPTY_SIG ⇒ ${r.status}`);
  }
  // ---------- C6 地址与 challenge 不匹配 ----------
  {
    const ch = await challenge(newEvm());
    const r = await postJson('/api/auth/verify', { evm_address: newEvm(), signature: fakeSig(), challenge_token: ch.token });
    results.http_cases.C6_address_mismatch = { status: r.status, body: r.body };
    log(`C6_ADDR_MISMATCH ⇒ ${r.status}`);
  }
  // ---------- C7 签名内容不校验（历史遗留）现取读数 ----------
  {
    const a = newEvm();
    const ch = await challenge(a);
    const r = await postJson('/api/auth/verify', { evm_address: a, signature: '0x' + 'de'.repeat(65), challenge_token: ch.token });
    results.http_cases.C7_garbage_signature_new_addr = { status: r.status, body: r.body };
    log(`C7_GARBAGE_SIG(new addr) ⇒ ${r.status}（200 即证「签名内容不校验」）`);
  }

  // ---------- DB 只读指纹（after） ----------
  results.db_after.fingerprint = await fp();
  log(`DB_AFTER=${JSON.stringify(results.db_after.fingerprint)}`);
  const b = results.db_before.fingerprint as any;
  const a2 = results.db_after.fingerprint as any;
  const num = (x: any) => Number(x?.n ?? 0);
  results.invariants = {
    delta_ledger_entry: num(a2.ledger_entry_total) - num(b.ledger_entry_total),
    delta_account_rows_cid1: num(a2.account_rows_cid1) - num(b.account_rows_cid1),
    delta_account_sum_balance_cid1: String(Number(a2.account_sum_balance_cid1?.s ?? 0) - Number(b.account_sum_balance_cid1?.s ?? 0)),
    delta_users_total: num(a2.users_total) - num(b.users_total),
    asset_table_regclass: (results.db_before.schema_selfcheck.asset_regclass as any)?.reg ?? 'READ_FAILED',
  };
  log(`INVARIANTS=${JSON.stringify(results.invariants)} hit_branch=${HIT_BRANCH}`);

  // ---------- §末尾：/health（触库 ⇒ 可能触发已知 Neon 抖动自退，放最后、非致命） ----------
  results.health_status = 'UNREACHABLE';
  for (let i = 1; i <= 3; i += 1) {
    const h = await doFetch('/health');
    results.health_status = h.status;
    if (h.status === 200) break;
    log(`health attempt ${i}: status=${h.status} body=${h.body.slice(0, 160)}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  log(`GET /health ⇒ ${results.health_status}`);

  results.finished_at = new Date().toISOString();
  results.hit_branch = HIT_BRANCH;
  fs.writeFileSync(path.join(outDir, 'login-results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outDir, 'steps.log'), steps.join('\n') + '\n');
  console.log(`WROTE ${path.join(outDir, 'login-results.json')}`);
})().catch((e) => {
  const m = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  log(`FATAL ${m}`);
  fs.writeFileSync(path.join(outDir, 'steps.log'), steps.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'login-results.json'), JSON.stringify({ ...results, fatal: m }, null, 2));
  console.log('PROBE_FATAL');
  process.exit(1);
});
