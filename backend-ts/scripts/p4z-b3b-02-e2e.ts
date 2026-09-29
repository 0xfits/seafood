// p4z-b3b-02-e2e.ts — P4-B3b / FIX-B 端到端实测（真 token · 真库 · C1/C2 全矩阵 + 资金不变量）
// ============================================================================
// 口径（派单 §④/§⑤ + spec §5.7）：
//   · 真 token 用生产签名器 `src/auth.createSessionToken`（.env.local 装载后 dynamic require）；
//   · **本脚本不铸币**（无 mint）⇒ `Σ(balance+frozen)` 前后必须**恒 = 2,000,000**（Zang 已自算基线）；
//   · C2 成功事件：**4 条分录全在 `balance`**、`frozen_delta` 全部 = 0、两腿 uid ∈ {owner, -1}；
//   · 金额「服务端取数」的**独立取证**：**从源码读下限常量**（不写死在测试里）
//     ⇒ 断言「客户端未传时的实际扣款 == 源码常量」且「客户端低于常量 ⇒ 400」；
//   · 401/403 同时抓服务端日志（纪律 ⑩）；产物不落 token/密钥本体。
// 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3b-02-e2e.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const PANEL = process.env.SEAFOOD_PANEL || 'http://127.0.0.1:5555';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3b-run'));
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

const fp12 = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);

// ---- 下限常量：**从源码现取**（防止「把金额来源写死在测试里蒙混过关」）------------------
const SRC = fs.readFileSync(path.join(REPO, 'src', 'currency-service.ts'), 'utf8');
const floorOf = (name: string): number => {
  const m = SRC.match(new RegExp(`${name}\\s*=\\s*(\\d+);`));
  if (!m) throw new Error(`FLOOR_CONST_NOT_FOUND:${name}`);
  return Number(m[1]);
};
const CREATE_FLOOR = floorOf('CURRENCY_CREATE_FEE_FLOOR');
const LIST_FEE_FLOOR = floorOf('CURRENCY_LIST_FEE_FLOOR');
const LIST_DEPOSIT_FLOOR = floorOf('CURRENCY_LIST_DEPOSIT_FLOOR');

type Row = Record<string, string>;
const snap = async () => {
  const s = (await sql('SELECT COALESCE(sum(balance+frozen),0)::text AS sigma, COALESCE(sum(balance),0)::text AS sbal, COALESCE(sum(frozen),0)::text AS sfrz FROM public.account')) as Row[];
  const e = (await sql('SELECT count(*)::int AS n FROM public.ledger_entry')) as unknown as Array<{ n: number }>;
  const k = (await sql('SELECT kind, count(*)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind')) as unknown as Array<{ kind: string; n: number }>;
  const accounts = (await sql('SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen FROM public.account ORDER BY uid, cid')) as Row[];
  const cur = (await sql('SELECT cid::text AS cid, symbol, status, deposit_amount::text AS deposit_amount, deposit_cid::text AS deposit_cid FROM public.currency ORDER BY cid')) as Row[];
  const slog = (await sql('SELECT count(*)::int AS n FROM public.currency_status_log')) as unknown as Array<{ n: number }>;
  return {
    sigma: String(s[0].sigma), sigma_balance: String(s[0].sbal), sigma_frozen: String(s[0].sfrz),
    entries: Number(e[0].n), kinds: k, accounts, currencies: cur, status_log: Number(slog[0].n),
  };
};
type Snap = Awaited<ReturnType<typeof snap>>;
const acct = (s: Snap, uid: string) => s.accounts.find((a) => a.uid === uid) || { uid, cid: '1', balance: '0', frozen: '0' };
const bal = (s: Snap, uid: string) => BigInt(acct(s, uid).balance);
const frz = (s: Snap, uid: string) => BigInt(acct(s, uid).frozen);

const entriesOf = async (txid: string) =>
  (await sql(`SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS fd, kind
              FROM public.ledger_entry WHERE txid = ${txid}::bigint ORDER BY uid, cid, kind`)) as Row[];

type Case = { name: string; method: string; url: string; auth?: string; body?: Record<string, unknown>; expect: number; expectCode?: string | null };
const call = async (c: Case) => {
  const headers: Record<string, string> = {};
  if (c.auth) headers.Authorization = c.auth;
  if (c.body !== undefined) headers['Content-Type'] = 'application/json';
  let status: number | null = null; let text = '';
  try {
    const res = await fetch(`${BASE}${c.url}`, {
      method: c.method, headers, body: c.body === undefined ? undefined : JSON.stringify(c.body), redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    status = res.status; text = await res.text();
  } catch (e) { text = `FETCH_ERROR ${String(e).slice(0, 160)}`; }
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* non-JSON */ }
  const err = (parsed.error || {}) as Record<string, unknown>;
  const code = typeof err.code === 'string' ? err.code : null;
  const data = (parsed.data || {}) as Record<string, unknown>;
  const ev = (data.ledger_event || null) as { entry_count?: number; txid?: string | null } | null;
  return {
    name: c.name, status, expect: c.expect, expect_code: c.expectCode ?? null, error_code: code,
    details: err.details ?? null, ok_pass: status === c.expect && (c.expectCode === undefined || c.expectCode === null ? true : code === c.expectCode),
    txid: ev ? ev.txid ?? null : null, entries_in_event: ev ? ev.entry_count ?? null : null,
    data: { cid: data.cid ?? null, status: data.status ?? null, fee: data.fee ?? null, fee_source: data.fee_source ?? null,
            listing_fee: data.listing_fee ?? null, listing_fee_source: data.listing_fee_source ?? null,
            deposit_consumed: data.deposit_consumed ?? null, deposit_source: data.deposit_source ?? null,
            deposit_refundable: data.deposit_refundable ?? null, deposit_credit_uid: data.deposit_credit_uid ?? null,
            replay: data.idempotent_replay ?? null },
    body_head: text.slice(0, 220),
  };
};

const logTail = async (lines: number) => {
  try {
    const res = await fetch(`${PANEL}/api/logs/seafood-api?lines=${lines}`, { signal: AbortSignal.timeout(20000) });
    const j = (await res.json()) as { text?: string };
    return (j.text || '').split('\n').slice(-60);
  } catch (e) { return [`LOG_FETCH_ERROR ${String(e).slice(0, 120)}`]; }
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), base: BASE, run: RUN, floors: { CREATE_FLOOR, LIST_FEE_FLOOR, LIST_DEPOSIT_FLOOR }, mints_in_this_run: 0 };
  const users = (await sql('SELECT uid::text AS uid, evm FROM public."users" ORDER BY uid LIMIT 6')) as Array<{ uid: string; evm: string }>;
  const owner = users.find((u) => u.uid === '970001');
  const other = users.find((u) => u.uid === '970002');
  if (!owner || !other) throw new Error('P4B3B_NEEDS_USERS_970001_970002');
  const tOwner = `Bearer ${auth.createSessionToken({ uID: Number(owner.uid), evm: owner.evm })}`;
  const tOther = `Bearer ${auth.createSessionToken({ uID: Number(other.uid), evm: other.evm })}`;
  out.subjects = { owner_uid: Number(owner.uid), other_uid: Number(other.uid), token_fp12: [fp12(tOwner), fp12(tOther)] };

  // 目标构造：A 走客户端传值路径；B 走**服务端默认值**路径；C = 已存在的 draft（cid 9）走余额不足路径
  const draftPool = (await sql(`SELECT cid::text AS cid, owner_uid::text AS owner_uid, symbol FROM public.currency WHERE status = 'draft' ORDER BY cid`)) as Row[];
  const draftC = draftPool.find((d) => Number(d.owner_uid) === Number(owner.uid));
  if (!draftC) throw new Error('P4B3B_NEEDS_AN_EXISTING_DRAFT_OWNED_BY_970001');
  const cidC = Number(draftC.cid);
  const SYM_A = `P4B3B${RUN.replace(/\D/g, '').slice(-6)}`.slice(0, 15).toUpperCase();
  const KEY = (s: string) => `cli:p4b3b:${RUN}:${s}`;
  out.targets = { cidC, SYM_A, cidC_symbol: draftC.symbol };

  const cases: Array<Record<string, unknown>> = [];
  const push = async (c: Case) => { const r = await call(c); cases.push(r as unknown as Record<string, unknown>); return r; };

  const pre = await snap();
  out.pre = pre;

  // ---------------- C1 矩阵 ----------------
  await push({ name: 'C1-T01 no-token => 401', method: 'POST', url: '/api/currency', body: { symbol: SYM_A, name: 'x', fee: 1500 }, expect: 401, expectCode: 'AUTH_UNAUTHORIZED' });
  await push({ name: 'C1-T02 bad-prefix key => 400', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', fee: 1500, create_key: 'nope:x' }, expect: 400, expectCode: 'LEDGER_IDEMPOTENCY_KEY_INVALID' });
  await push({ name: 'C1-T03 decimals=99 => 400', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', decimals: 99, fee: 1500 }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID' });
  await push({ name: 'C1-T04 symbol shape => 400', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: 'bad sym', name: 'x', fee: 1500 }, expect: 400, expectCode: 'LEDGER_AMOUNT_INVALID' });
  // ★ NEW（FIX-B）：客户端金额 < 服务端下限 ⇒ 400（修前：fee=1 会被**接受并只扣 1**）
  const b1 = await snap();
  const rBelow = await push({ name: `C1-T05 fee=${CREATE_FLOOR - 1} (below server floor) => 400`, method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', fee: CREATE_FLOOR - 1 }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  const a1 = await snap();
  out.C1_below_floor = { code: rBelow.error_code, details: rBelow.details, delta_entries: a1.entries - b1.entries, plan_created: a1.currencies.some((c) => c.symbol === SYM_A) };
  await push({ name: 'C1-T06 owner_uid != actor => 403', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'x', fee: 1500, owner_uid: Number(other.uid) }, expect: 403, expectCode: 'AUTH_FORBIDDEN' });

  const beforeCreate = await snap();
  const rCreate = await push({ name: `C1-T07 HAPPY create (fee=${1500} -> -1)`, method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'P4B3B test unit', decimals: 2, fee: 1500, create_key: KEY('c1-create') }, expect: 200 });
  const afterCreate = await snap();
  const cidA = Number(rCreate.data.cid);
  out.C1_happy = {
    cid: cidA, txid: rCreate.txid, entries_in_event: rCreate.entries_in_event, fee_source: rCreate.data.fee_source,
    entries: rCreate.txid ? await entriesOf(String(rCreate.txid)) : null,
    delta_sigma: (BigInt(afterCreate.sigma) - BigInt(beforeCreate.sigma)).toString(),
    delta_entries: afterCreate.entries - beforeCreate.entries,
    owner_bal_delta: (bal(afterCreate, '970001') - bal(beforeCreate, '970001')).toString(),
    neg1_bal_delta: (bal(afterCreate, '-1') - bal(beforeCreate, '-1')).toString(),
    owner_frz_delta: (frz(afterCreate, '970001') - frz(beforeCreate, '970001')).toString(),
  };

  const beforeReplay = await snap();
  const rReplay = await push({ name: 'C1-T08 REPLAY same key+payload => 200 replay', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'P4B3B test unit', decimals: 2, fee: 1500, create_key: KEY('c1-create') }, expect: 200 });
  const afterReplay = await snap();
  out.C1_replay = { replay_flag: rReplay.data.replay, delta_sigma: (BigInt(afterReplay.sigma) - BigInt(beforeReplay.sigma)).toString(), delta_entries: afterReplay.entries - beforeReplay.entries, currency_rows_delta: afterReplay.currencies.length - beforeReplay.currencies.length };

  const beforeConflict = await snap();
  const rConflict = await push({ name: 'C1-T09 same key / different payload => 409', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: `${SYM_A}Z`.slice(0, 15), name: 'different', decimals: 2, fee: 1500, create_key: KEY('c1-create') }, expect: 409, expectCode: 'LEDGER_IDEMPOTENCY_CONFLICT' });
  const afterConflict = await snap();
  out.C1_conflict = { code: rConflict.error_code, delta_entries: afterConflict.entries - beforeConflict.entries, delta_sigma: (BigInt(afterConflict.sigma) - BigInt(beforeConflict.sigma)).toString() };

  const beforeTaken = await snap();
  await push({ name: 'C1-T10 duplicate symbol / different key => 409 SYMBOL_TAKEN', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: SYM_A, name: 'dup', decimals: 2, fee: 1500, create_key: KEY('c1-dup') }, expect: 409, expectCode: 'LEDGER_CURRENCY_SYMBOL_TAKEN' });
  const afterTaken = await snap();
  out.C1_symbol_taken = { delta_entries: afterTaken.entries - beforeTaken.entries, delta_sigma: (BigInt(afterTaken.sigma) - BigInt(beforeTaken.sigma)).toString() };

  const beforeInsuf = await snap();
  const rInsuf = await push({ name: 'C1-T11 insufficient balance => 409 + no orphan row', method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: `${SYM_A}Y`.slice(0, 15), name: 'too expensive', decimals: 0, fee: 99_000_000, create_key: KEY('c1-insuf') }, expect: 409, expectCode: 'LEDGER_INSUFFICIENT_BALANCE' });
  const afterInsuf = await snap();
  out.C1_insufficient = { code: rInsuf.error_code, delta_entries: afterInsuf.entries - beforeInsuf.entries, orphan_row: afterInsuf.currencies.some((c) => c.symbol === `${SYM_A}Y`.slice(0, 15)) };

  // ★ NEW（FIX-B）：**完全不传 fee ⇒ 服务端取数**（扣款必须 == 源码常量，而非 0 / 而非客户端值）
  const beforeDef = await snap();
  const rDef = await push({ name: `C1-T12 fee OMITTED => server default (${CREATE_FLOOR})`, method: 'POST', url: '/api/currency', auth: tOwner, body: { symbol: `${SYM_A}X`.slice(0, 15), name: 'server default fee', decimals: 0, create_key: KEY('c1-default') }, expect: 200 });
  const afterDef = await snap();
  const cidB = Number(rDef.data.cid);
  out.C1_server_default = {
    cid: cidB, fee_in_response: rDef.data.fee, fee_source: rDef.data.fee_source, floor_from_source: CREATE_FLOOR,
    entries: rDef.txid ? await entriesOf(String(rDef.txid)) : null,
    owner_bal_delta: (bal(afterDef, '970001') - bal(beforeDef, '970001')).toString(),
    neg1_bal_delta: (bal(afterDef, '-1') - bal(beforeDef, '-1')).toString(),
    matches_source_floor: String(rDef.data.fee) === String(CREATE_FLOOR),
  };

  // ---------------- C2 矩阵 ----------------
  await push({ name: 'C2-T13 no-token => 401', method: 'POST', url: `/api/currency/${cidA}/list`, body: { fee: 1500, deposit_amount: 2000 }, expect: 401, expectCode: 'AUTH_UNAUTHORIZED' });
  await push({ name: 'C2-T14 unknown cid 999999 => 404', method: 'POST', url: '/api/currency/999999/list', auth: tOwner, body: { fee: 1500, deposit_amount: 2000 }, expect: 404, expectCode: 'LEDGER_CURRENCY_NOT_FOUND' });
  await push({ name: 'C2-T15 cid=0 => 404', method: 'POST', url: '/api/currency/0/list', auth: tOwner, body: { fee: 1500, deposit_amount: 2000 }, expect: 404, expectCode: 'LEDGER_CURRENCY_NOT_FOUND' });
  // ★ NEW（FIX-B）：保证金 / 上市费低于服务端下限 ⇒ 400（修前：deposit_amount=1 会被接受）
  const b2 = await snap();
  const rDepBelow = await push({ name: `C2-T16 deposit_amount=${LIST_DEPOSIT_FLOOR - 1} (below floor) => 400`, method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 1500, deposit_amount: LIST_DEPOSIT_FLOOR - 1 }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  const rFeeBelow = await push({ name: `C2-T17 fee=${LIST_FEE_FLOOR - 1} (below floor) => 400`, method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: LIST_FEE_FLOOR - 1, deposit_amount: 2000 }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  const a2 = await snap();
  out.C2_below_floor = { deposit_code: rDepBelow.error_code, deposit_details: rDepBelow.details, fee_code: rFeeBelow.error_code, fee_details: rFeeBelow.details, delta_entries: a2.entries - b2.entries, delta_sigma: (BigInt(a2.sigma) - BigInt(b2.sigma)).toString(), unit_still_draft: (a2.currencies.find((c) => Number(c.cid) === cidA) || {}).status };
  const rNonOwner = await push({ name: 'C2-T18 non-owner => 403 ACTOR_NOT_ALLOWED', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOther, body: { fee: 1500, deposit_amount: 2000, create_key: KEY('c2-notowner') }, expect: 403, expectCode: 'AUTH_FORBIDDEN' });
  out.C2_non_owner = { code: rNonOwner.error_code, details: rNonOwner.details, expect_code: rNonOwner.expect_code, ok_pass: rNonOwner.ok_pass };
  await push({ name: 'C2-T19 bad-prefix key => 400', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 1500, deposit_amount: 2000, create_key: 'x:y' }, expect: 400, expectCode: 'LEDGER_IDEMPOTENCY_KEY_INVALID' });

  // ★ 核心：C2 成功路径 —— **消耗入 uid=-1**（4 条分录全在 balance、frozen 零变动）
  const beforeList = await snap();
  const rList = await push({ name: 'C2-T20 HAPPY list (fee 1500 + deposit 2000 -> both to -1)', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 1500, deposit_amount: 2000, create_key: KEY('c2-list') }, expect: 200 });
  const afterList = await snap();
  const listEntries = rList.txid ? await entriesOf(String(rList.txid)) : [];
  out.C2_happy = {
    cid: cidA, txid: rList.txid, entries_in_event: rList.entries_in_event, entries: listEntries,
    entry_kinds: listEntries.map((e) => e.kind),
    deposit_consumed: rList.data.deposit_consumed, deposit_refundable: rList.data.deposit_refundable, deposit_credit_uid: rList.data.deposit_credit_uid,
    listing_fee_source: rList.data.listing_fee_source, deposit_source: rList.data.deposit_source,
    // 断言（供 Zang 自算复核，均为实测读数）：
    kinds_ok: JSON.stringify(listEntries.map((e) => e.kind).sort()) === JSON.stringify(['currency_create_fee', 'currency_create_fee', 'listing_deposit', 'listing_deposit']),
    all_entries_on_balance: listEntries.every((e) => e.fd === '0'),
    both_legs_owner_and_neg1: ['970001', '-1'].every((u) => listEntries.some((e) => e.uid === u)),
    owner_bal_delta: (bal(afterList, '970001') - bal(beforeList, '970001')).toString(),
    neg1_bal_delta: (bal(afterList, '-1') - bal(beforeList, '-1')).toString(),
    owner_frz_delta: (frz(afterList, '970001') - frz(beforeList, '970001')).toString(),
    neg1_frz_delta: (frz(afterList, '-1') - frz(beforeList, '-1')).toString(),
    delta_sigma: (BigInt(afterList.sigma) - BigInt(beforeList.sigma)).toString(),
    delta_entries: afterList.entries - beforeList.entries,
    delta_status_log: afterList.status_log - beforeList.status_log,
    unit_row: afterList.currencies.find((c) => Number(c.cid) === cidA) ?? null,
  };

  const beforeListReplay = await snap();
  const rListReplay = await push({ name: 'C2-T21 REPLAY same key+payload => 200 replay', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 1500, deposit_amount: 2000, create_key: KEY('c2-list') }, expect: 200 });
  const afterListReplay = await snap();
  out.C2_replay = { replay_flag: rListReplay.data.replay, delta_entries: afterListReplay.entries - beforeListReplay.entries, delta_sigma: (BigInt(afterListReplay.sigma) - BigInt(beforeListReplay.sigma)).toString(), delta_status_log: afterListReplay.status_log - beforeListReplay.status_log };

  const beforeDouble = await snap();
  await push({ name: 'C2-T22 re-list already listed (new key) => 409', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tOwner, body: { fee: 1500, deposit_amount: 2000, create_key: KEY('c2-relis') }, expect: 409, expectCode: 'LEDGER_CURRENCY_INVALID_TRANSITION' });
  const afterDouble = await snap();
  out.C2_relist = { delta_entries: afterDouble.entries - beforeDouble.entries, delta_sigma: (BigInt(afterDouble.sigma) - BigInt(beforeDouble.sigma)).toString() };

  // ★ NEW（FIX-B）：**完全不传 fee / deposit_amount ⇒ 服务端取数**（两笔扣款都必须 == 源码常量）
  const beforeLDef = await snap();
  const rLDef = await push({ name: `C2-T23 fee+deposit OMITTED => server defaults (${LIST_FEE_FLOOR}+${LIST_DEPOSIT_FLOOR})`, method: 'POST', url: `/api/currency/${cidB}/list`, auth: tOwner, body: { create_key: KEY('c2-default') }, expect: 200 });
  const afterLDef = await snap();
  const lDefEntries = rLDef.txid ? await entriesOf(String(rLDef.txid)) : [];
  out.C2_server_default = {
    cid: cidB, listing_fee: rLDef.data.listing_fee, deposit_consumed: rLDef.data.deposit_consumed,
    listing_fee_source: rLDef.data.listing_fee_source, deposit_source: rLDef.data.deposit_source,
    entries: lDefEntries,
    owner_bal_delta: (bal(afterLDef, '970001') - bal(beforeLDef, '970001')).toString(),
    neg1_bal_delta: (bal(afterLDef, '-1') - bal(beforeLDef, '-1')).toString(),
    owner_frz_delta: (frz(afterLDef, '970001') - frz(beforeLDef, '970001')).toString(),
    all_entries_on_balance: lDefEntries.every((e) => e.fd === '0'),
    matches_source_floors: String(rLDef.data.listing_fee) === String(LIST_FEE_FLOOR) && String(rLDef.data.deposit_consumed) === String(LIST_DEPOSIT_FLOOR),
    delta_sigma: (BigInt(afterLDef.sigma) - BigInt(beforeLDef.sigma)).toString(),
  };

  // 判负：余额不足（保证金 > 可用余额）⇒ 409 + 状态仍 draft + 无审计行 + 零分录
  const beforeCFail = await snap();
  const rCFail = await push({ name: 'C2-T24 insufficient balance on list => 409 + stays draft + no audit row', method: 'POST', url: `/api/currency/${cidC}/list`, auth: tOwner, body: { fee: 1500, deposit_amount: 99_000_000, create_key: KEY('c2-insuf') }, expect: 409, expectCode: 'LEDGER_INSUFFICIENT_BALANCE' });
  const afterCFail = await snap();
  out.C2_insufficient = {
    code: rCFail.error_code, delta_entries: afterCFail.entries - beforeCFail.entries, delta_sigma: (BigInt(afterCFail.sigma) - BigInt(beforeCFail.sigma)).toString(),
    delta_status_log: afterCFail.status_log - beforeCFail.status_log, unit_row: afterCFail.currencies.find((c) => Number(c.cid) === cidC) ?? null,
  };

  const post = await snap();
  out.post = post;
  out.logs_401_403 = await logTail(200);

  // ---- 资金不变量 ----
  const kindsDelta: Record<string, number> = {};
  const preKinds: Record<string, number> = {}; const postKinds: Record<string, number> = {};
  for (const k of pre.kinds) preKinds[k.kind] = k.n;
  for (const k of post.kinds) postKinds[k.kind] = k.n;
  for (const kk of Array.from(new Set([...Object.keys(preKinds), ...Object.keys(postKinds)])).sort()) kindsDelta[kk] = (postKinds[kk] || 0) - (preKinds[kk] || 0);
  out.invariants = {
    sigma_pre: pre.sigma, sigma_post: post.sigma, sigma_delta: (BigInt(post.sigma) - BigInt(pre.sigma)).toString(),
    sigma_expected_unchanged: '2000000',
    sigma_is_2000000_pre_and_post: pre.sigma === '2000000' && post.sigma === '2000000',
    sigma_frozen_pre: pre.sigma_frozen, sigma_frozen_post: post.sigma_frozen,
    entries_pre: pre.entries, entries_post: post.entries, entries_delta: post.entries - pre.entries,
    ledger_entry_kinds_pre: preKinds, ledger_entry_kinds_post: postKinds, ledger_entry_kinds_delta: kindsDelta,
    status_log_delta: post.status_log - pre.status_log,
    accounts_pre: pre.accounts, accounts_post: post.accounts,
  };

  out.cases = cases;
  out.summary = {
    pass: cases.filter((c) => c.ok_pass).length, total: cases.length,
    failed: cases.filter((c) => !c.ok_pass).map((c) => `${c.name}=${c.status}/${c.expect}:${c.error_code}`),
  };

  fs.writeFileSync(path.join(outDir, 'b3b-02-e2e.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3b-02-e2e.json'));
  console.log('FLOORS ' + JSON.stringify(out.floors));
  for (const c of cases) console.log(`[${c.ok_pass ? 'PASS' : 'FAIL'}] ${c.status}/${c.expect} ${c.name} code=${c.error_code} details=${JSON.stringify(c.details)}`);
  console.log('SUMMARY ' + JSON.stringify(out.summary));
  console.log('INVARIANTS ' + JSON.stringify(out.invariants));
  console.log('C1_BELOW ' + JSON.stringify(out.C1_below_floor));
  console.log('C1_HAPPY ' + JSON.stringify(out.C1_happy));
  console.log('C1_DEFAULT ' + JSON.stringify(out.C1_server_default));
  console.log('C2_BELOW ' + JSON.stringify(out.C2_below_floor));
  console.log('C2_HAPPY ' + JSON.stringify(out.C2_happy));
  console.log('C2_DEFAULT ' + JSON.stringify(out.C2_server_default));
  console.log('C2_INSUF ' + JSON.stringify(out.C2_insufficient));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
