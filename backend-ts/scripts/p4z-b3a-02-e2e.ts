// p4z-b3a-02-e2e.ts — P4-B3a 端到端实测（真 token · 真库 · C1/C2 全矩阵）
// ============================================================================
// 口径（派单 §④/§⑤ + spec §5.7）：
//   · 真 token 用**生产签名器** `src/auth.createSessionToken`（dynamic require **在** .env.local 装载后）；
//   · 每例记录：HTTP status / `error.code` / **ledger_entry 增量** / **Σ(balance+frozen) 增量**；
//     纯转移类事件（C1/C2）ΔΣ **必须 = 0**；fixture `mint`（唯一铸币步骤）ΔΣ = 票面；
//   · 判负用例：余额不足 ⇒ 业务行**不得**残留（单语句回滚）；
//   · 产物**不落 token/密钥本体**（只落 sha256 前 12 位）；退出码直接取（不经管道）。
// 用法：ts-node --transpile-only scripts/p4z-b3a-02-e2e.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3a-run'));
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
const sql = neon(String(process.env.DATABASE_URL || ''));
const auth = require(path.join(REPO, 'src', 'auth')) as { createSessionToken: (p: { uID: number; evm: string }) => string };
const ledger = require(path.join(REPO, 'src', 'ledger')) as {
  mint: (i: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const fp12 = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);

// ---- 台账读数（每次事件前后各取一次：Σ + 分录数 + 该用户逐账户 dump）---------
const readings = async (ownerUid: number) => {
  const s = (await sql('SELECT COALESCE(sum(balance + frozen), 0)::text AS sigma FROM public.account')) as Array<{ sigma: string }>;
  const e = (await sql('SELECT count(*)::int AS n FROM public.ledger_entry')) as Array<{ n: number }>;
  const accounts = (await sql(`SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
                               FROM public.account ORDER BY uid, cid`)) as Array<Record<string, string>>;
  const owner = accounts.filter((a) => Number(a.uid) === ownerUid);
  const fx = (await sql(`SELECT cid::text AS cid, symbol, status, deposit_amount::text AS deposit_amount
                         FROM public.currency ORDER BY cid`)) as Array<Record<string, string>>;
  const slog = (await sql('SELECT count(*)::int AS n FROM public.currency_status_log')) as Array<{ n: number }>;
  return {
    sigma: String(s[0].sigma), ledger_entry_n: Number(e[0].n), status_log_n: Number(slog[0].n),
    accounts_all: accounts, owner_accounts: owner, currencies: fx,
  };
};

type Case = {
  name: string; method: string; url: string; auth?: string; body?: Record<string, unknown>;
  expect: number; expectCode?: string | null;
};
const call = async (c: Case) => {
  const headers: Record<string, string> = {};
  if (c.auth) headers.Authorization = c.auth;
  if (c.body !== undefined) headers['Content-Type'] = 'application/json';
  let status: number | null = null; let text = '';
  try {
    const res = await fetch(`${BASE}${c.url}`, {
      method: c.method, headers, body: c.body === undefined ? undefined : JSON.stringify(c.body), redirect: 'manual',
    });
    status = res.status; text = await res.text();
  } catch (e) { text = `FETCH_ERROR ${String(e).slice(0, 160)}`; }
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* non-JSON */ }
  const err = (parsed.error || {}) as Record<string, unknown>;
  const code = typeof err.code === 'string' ? err.code : null;
  const data = (parsed.data || {}) as Record<string, unknown>;
  const ev = (data.ledger_event || null) as { entry_count?: number } | null;
  return {
    name: c.name, method: c.method, url: c.url, expect: c.expect, status,
    error_code: code, details: err.details ?? null,
    ok_pass: status === c.expect && (c.expectCode === undefined || c.expectCode === null ? true : code === c.expectCode),
    data_cid: data.cid ?? null, data_status: data.status ?? null,
    replay: data.idempotent_replay ?? null, ledger_entries_in_event: ev ? ev.entry_count : null,
    body_head: text.slice(0, 260),
  };
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), base: BASE, run: RUN };
  const users = (await sql('SELECT uid::text AS uid, evm FROM public."users" ORDER BY uid LIMIT 4')) as Array<{ uid: string; evm: string }>;
  const owner = users.find((u) => u.uid === '970001');
  const other = users.find((u) => u.uid === '970002');
  if (!owner || !other) throw new Error('P4B3A_NEEDS_USERS_970001_970002');
  const ownerUid = Number(owner.uid);
  const otherUid = Number(other.uid);
  const tOwner = `Bearer ${auth.createSessionToken({ uID: ownerUid, evm: owner.evm })}`;
  const tOther = `Bearer ${auth.createSessionToken({ uID: otherUid, evm: other.evm })}`;
  out.subjects = { owner_uid: ownerUid, other_uid: otherUid, token_fp12: [fp12(tOwner), fp12(tOther)] };

  const SYM_A = `P4B3A${RUN.slice(-6)}`.toUpperCase().slice(0, 15);
  const SYM_B = `${SYM_A}Z`.slice(0, 15);
  const SYM_C = `${SYM_A}Y`.slice(0, 15);
  const SYM_D = `${SYM_A}X`.slice(0, 15);
  const KEY = (s: string) => `cli:p4b3a:${RUN}:${s}`;

  const stages: Record<string, unknown> = {};
  const cases: unknown[] = [];
  const push = async (c: Case, note?: string) => {
    const r = await call(c); cases.push({ ...r, note: note ?? null }); return r;
  };

  // ---------------- 阶段 S0：事件前读数（fixture 铸币前）----------------
  const fxAmount = 1_000_000;
  const s0 = await readings(ownerUid); stages.S0_pre_fixture = s0;

  // fixture：唯一铸币步骤（`$` 平台受信任路径 R23；本片唯一 ΔΣ ≠ 0 的事件）
  const mintKey = `cli:p4b3a:${RUN}:fixture-mint`;
  let mintRes: Record<string, unknown> = {};
  try {
    mintRes = await ledger.mint({ uid: ownerUid, cid: 1, amount: fxAmount, platform: true, idempotencyKey: mintKey });
  } catch (e) { mintRes = { error: String(e).slice(0, 300) }; }
  const s1 = await readings(ownerUid); stages.S1_post_fixture_mint = s1;
  out.fixture_mint = {
    key: mintKey, amount: fxAmount, platform: true, cid: 1,
    entries_in_event: Array.isArray(mintRes.entries) ? (mintRes.entries as unknown[]).length : null,
    idempotent_replay: mintRes.idempotent_replay ?? null, error: mintRes.error ?? null,
    delta_sigma: (BigInt(s1.sigma) - BigInt(s0.sigma)).toString(),
    delta_entries: s1.ledger_entry_n - s0.ledger_entry_n,
  };

  // ---------------- C1 矩阵 ----------------
  await push({ name: 'C1-T01 no-token', method: 'POST', url: '/api/currency', body: { symbol: SYM_A, name: 'x', fee: 1 }, expect: 401, expectCode: 'AUTH_UNAUTHORIZED' });
  await push({ name: 'C1-T02 bad-prefix key', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', fee: 1, create_key: 'nope:p4b3a' }, expect: 400, expectCode: 'LEDGER_IDEMPOTENCY_KEY_INVALID' });
  await push({ name: 'C1-T03 decimals out of range', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', decimals: 99, fee: 1 }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID' });
  await push({ name: 'C1-T04 symbol format invalid', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: 'bad sym', name: 'x', fee: 1 }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID' });
  await push({ name: 'C1-T05 fee missing', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x' }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  await push({ name: 'C1-T06 owner_uid != actor', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', fee: 1, owner_uid: otherUid }, expect: 403, expectCode: 'AUTH_FORBIDDEN' });

  const beforeCreate = await readings(ownerUid);
  const rCreate = await push({
    name: 'C1-T07 HAPPY create (fee 1000 -> -1)', method: 'POST', url: '/api/currency', auth: tOwner,
    body: { symbol: SYM_A, name: 'P4B3A test unit', decimals: 2, fee: 1000, create_key: KEY('c1-create') }, expect: 200,
  });
  const afterCreate = await readings(ownerUid);
  const cidA = Number(rCreate.data_cid);
  out.C1_happy = {
    cid: cidA, status: rCreate.data_status, entries_in_event: rCreate.ledger_entries_in_event,
    delta_sigma: (BigInt(afterCreate.sigma) - BigInt(beforeCreate.sigma)).toString(),
    delta_entries: afterCreate.ledger_entry_n - beforeCreate.ledger_entry_n,
    owner_accounts_after: afterCreate.owner_accounts, currency_rows_after: afterCreate.currencies,
  };

  const beforeReplay = await readings(ownerUid);
  const rReplay = await push({
    name: 'C1-T08 REPLAY same key+payload', method: 'POST', url: '/api/currency', auth: tOwner,
    body: { symbol: SYM_A, name: 'P4B3A test unit', decimals: 2, fee: 1000, create_key: KEY('c1-create') }, expect: 200,
  });
  const afterReplay = await readings(ownerUid);
  out.C1_replay = {
    replay_flag: rReplay.replay, delta_sigma: (BigInt(afterReplay.sigma) - BigInt(beforeReplay.sigma)).toString(),
    delta_entries: afterReplay.ledger_entry_n - beforeReplay.ledger_entry_n,
    currency_count_before: beforeReplay.currencies.length, currency_count_after: afterReplay.currencies.length,
  };

  const beforeConflict = await readings(ownerUid);
  const rConflict = await push({
    name: 'C1-T09 same key / DIFFERENT payload => 409', method: 'POST', url: '/api/currency', auth: tOwner,
    body: { symbol: SYM_B, name: 'different payload', decimals: 2, fee: 1000, create_key: KEY('c1-create') }, expect: 409, expectCode: 'LEDGER_IDEMPOTENCY_CONFLICT',
  });
  const afterConflict = await readings(ownerUid);
  out.C1_conflict = {
    code: rConflict.error_code, delta_sigma: (BigInt(afterConflict.sigma) - BigInt(beforeConflict.sigma)).toString(),
    delta_entries: afterConflict.ledger_entry_n - beforeConflict.ledger_entry_n,
    symbol_b_created: afterConflict.currencies.some((c) => c.symbol === SYM_B),
  };

  const beforeTaken = await readings(ownerUid);
  await push({
    name: 'C1-T10 duplicate symbol / DIFFERENT key => 409 SYMBOL_TAKEN', method: 'POST', url: '/api/currency', auth: tOwner,
    body: { symbol: SYM_A, name: 'dup', decimals: 2, fee: 1000, create_key: KEY('c1-dup') }, expect: 409, expectCode: 'LEDGER_CURRENCY_SYMBOL_TAKEN',
  });
  const afterTaken = await readings(ownerUid);
  out.C1_symbol_taken = {
    delta_sigma: (BigInt(afterTaken.sigma) - BigInt(beforeTaken.sigma)).toString(),
    delta_entries: afterTaken.ledger_entry_n - beforeTaken.ledger_entry_n,
  };

  // 余额不足：fee 超过余额 ⇒ 409 LD001 且**不留 currency 行**（单语句回滚）
  const beforeInsuf = await readings(ownerUid);
  const rInsuf = await push({
    name: 'C1-T11 insufficient balance => 409 + NO orphan row', method: 'POST', url: '/api/currency', auth: tOwner,
    body: { symbol: SYM_C, name: 'too expensive', decimals: 0, fee: 99_000_000, create_key: KEY('c1-insuf') }, expect: 409, expectCode: 'LEDGER_INSUFFICIENT_BALANCE',
  });
  const afterInsuf = await readings(ownerUid);
  out.C1_insufficient = {
    code: rInsuf.error_code, delta_sigma: (BigInt(afterInsuf.sigma) - BigInt(beforeInsuf.sigma)).toString(),
    delta_entries: afterInsuf.ledger_entry_n - beforeInsuf.ledger_entry_n,
    symbol_c_created: afterInsuf.currencies.some((c) => c.symbol === SYM_C),
  };

  // ---------------- C2 矩阵 ----------------
  await push({ name: 'C2-T12 no-token', method: 'POST', url: `/api/currency/${cidA}/list`, body: { fee: 1, deposit_amount: 1 }, expect: 401, expectCode: 'AUTH_UNAUTHORIZED' });
  await push({ name: 'C2-T13 unknown cid 999999', method: 'POST', url: '/api/currency/999999/list', auth: tOwner, body: { fee: 1, deposit_amount: 1 }, expect: 404, expectCode: 'LEDGER_CURRENCY_NOT_FOUND' });
  await push({ name: 'C2-T14 cid=0 (shape-ok, non-existent)', method: 'POST', url: '/api/currency/0/list', auth: tOwner, body: { fee: 1, deposit_amount: 1 }, expect: 404, expectCode: 'LEDGER_CURRENCY_NOT_FOUND' });
  await push({ name: 'C2-T15 non-owner => 403', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOther, body: { fee: 500, deposit_amount: 2000, create_key: KEY('c2-notowner') }, expect: 403, expectCode: 'AUTH_FORBIDDEN' });
  await push({ name: 'C2-T16 bad-prefix key', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 1, deposit_amount: 1, create_key: 'x:y' }, expect: 400, expectCode: 'LEDGER_IDEMPOTENCY_KEY_INVALID' });
  await push({ name: 'C2-T17 deposit missing', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 500 }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });

  const beforeList = await readings(ownerUid);
  const rList = await push({
    name: 'C2-T18 HAPPY list (fee 500 -> -1 ; deposit 2000 HOLD)', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner,
    body: { fee: 500, deposit_amount: 2000, create_key: KEY('c2-list') }, expect: 200,
  });
  const afterList = await readings(ownerUid);
  out.C2_happy = {
    status: rList.data_status, entries_in_event: rList.ledger_entries_in_event,
    delta_sigma: (BigInt(afterList.sigma) - BigInt(beforeList.sigma)).toString(),
    delta_entries: afterList.ledger_entry_n - beforeList.ledger_entry_n,
    delta_status_log: afterList.status_log_n - beforeList.status_log_n,
    owner_accounts_after: afterList.owner_accounts,
    currency_row_A: afterList.currencies.find((c) => Number(c.cid) === cidA) ?? null,
  };

  const beforeListReplay = await readings(ownerUid);
  const rListReplay = await push({
    name: 'C2-T19 REPLAY same key+payload', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner,
    body: { fee: 500, deposit_amount: 2000, create_key: KEY('c2-list') }, expect: 200,
  });
  const afterListReplay = await readings(ownerUid);
  out.C2_replay = {
    replay_flag: rListReplay.replay,
    delta_sigma: (BigInt(afterListReplay.sigma) - BigInt(beforeListReplay.sigma)).toString(),
    delta_entries: afterListReplay.ledger_entry_n - beforeListReplay.ledger_entry_n,
    delta_status_log: afterListReplay.status_log_n - beforeListReplay.status_log_n,
    owner_accounts_after: afterListReplay.owner_accounts,
  };

  const beforeDouble = await readings(ownerUid);
  await push({
    name: 'C2-T20 re-list already listed (new key) => 409', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner,
    body: { fee: 500, deposit_amount: 2000, create_key: KEY('c2-relis') }, expect: 409, expectCode: 'LEDGER_CURRENCY_INVALID_TRANSITION',
  });
  const afterDouble = await readings(ownerUid);
  out.C2_relist = {
    delta_sigma: (BigInt(afterDouble.sigma) - BigInt(beforeDouble.sigma)).toString(),
    delta_entries: afterDouble.ledger_entry_n - beforeDouble.ledger_entry_n,
  };

  // 判负用例（DL157③ 同族）：上市失败（保证金不足）⇒ 状态仍 draft + 无审计行 + 零分录
  const rCreateD = await push({
    name: 'C2-T21 setup: create unit D (fee 100, ok)', method: 'POST', url: '/api/currency', auth: tOwner,
    body: { symbol: SYM_D, name: 'D unit', decimals: 0, fee: 100, create_key: KEY('c1-create-d') }, expect: 200,
  });
  const cidD = Number(rCreateD.data_cid);
  const beforeDFail = await readings(ownerUid);
  const rDFail = await push({
    name: 'C2-T22 insufficient balance on list => 409 + stays draft + NO audit row', method: 'POST', url: `/api/currency/${cidD}/list`, auth: tOwner,
    body: { fee: 100, deposit_amount: 99_000_000, create_key: KEY('c2-insuf') }, expect: 409, expectCode: 'LEDGER_INSUFFICIENT_BALANCE',
  });
  const afterDFail = await readings(ownerUid);
  out.C2_insufficient = {
    code: rDFail.error_code,
    delta_sigma: (BigInt(afterDFail.sigma) - BigInt(beforeDFail.sigma)).toString(),
    delta_entries: afterDFail.ledger_entry_n - beforeDFail.ledger_entry_n,
    delta_status_log: afterDFail.status_log_n - beforeDFail.status_log_n,
    unit_D_row: afterDFail.currencies.find((c) => Number(c.cid) === cidD) ?? null,
  };

  const sFinal = await readings(ownerUid); stages.S_final = sFinal;
  out.stages = stages;
  out.cases = cases;
  out.summary = {
    pass: cases.filter((c) => (c as { ok_pass: boolean }).ok_pass).length,
    total: cases.length,
    failed: cases.filter((c) => !(c as { ok_pass: boolean }).ok_pass).map((c) => `${(c as { name: string }).name}=${(c as { status: number }).status}/${(c as { expect: number }).expect}:${(c as { error_code: string | null }).error_code}`),
    sigma_pre: s0.sigma, sigma_post_mint: s1.sigma, sigma_final: sFinal.sigma,
    ledger_entry_n_pre: s0.ledger_entry_n, ledger_entry_n_final: sFinal.ledger_entry_n,
    net_mint_expected: fxAmount,
  };

  const p = path.join(outDir, 'e2e.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('WROTE ' + p);
  console.log('SUMMARY ' + JSON.stringify(out.summary, null, 1));
  for (const c of cases as Array<Record<string, unknown>>) {
    console.log(`[${c.ok_pass ? 'PASS' : 'FAIL'}] ${c.status}/${c.expect} ${c.name} code=${c.error_code} details=${JSON.stringify(c.details)}`);
  }
  console.log('FIXTURE_MINT ' + JSON.stringify(out.fixture_mint, null, 1));
  console.log('C1_happy ' + JSON.stringify(out.C1_happy));
  console.log('C1_replay ' + JSON.stringify(out.C1_replay));
  console.log('C1_conflict ' + JSON.stringify(out.C1_conflict));
  console.log('C1_symbol_taken ' + JSON.stringify(out.C1_symbol_taken));
  console.log('C1_insufficient ' + JSON.stringify(out.C1_insufficient));
  console.log('C2_happy ' + JSON.stringify(out.C2_happy));
  console.log('C2_replay ' + JSON.stringify(out.C2_replay));
  console.log('C2_relist ' + JSON.stringify(out.C2_relist));
  console.log('C2_insufficient ' + JSON.stringify(out.C2_insufficient));
  console.log('S0 ' + JSON.stringify(s0));
  console.log('S_final ' + JSON.stringify(sFinal));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED', e); process.exit(1); });
