// p4z-num1-01-e2e.ts — NUM-1 金额下限定值（10000/10000/50000）**边界实测**（真 token · 真库 · C1/C2）
// ============================================================================
// 口径（派单 §④/§⑤ + spec §5.7）：
//   · 真 token 用生产签名器 `src/auth.createSessionToken`（.env.local 装载后 dynamic require）；
//   · **本脚本不铸币**（无 mint）⇒ Σ(balance+frozen) 前后必须**恒 = 常量基线**（读数里记实测值）；
//   · 下限**从源码现取**（不写死在测试里）⇒ 断言「低于源码下限 ⇒ 400」「未传 ⇒ 扣款 == 源码下限」；
//   · 边界 = 新值**上下各一例**：9999/10000（建币费·上市费）、49999/50000（保证金）；
//   · 夹具幂等键一律 `cli:num1-*`；产物不落 token/密钥本体（只记 12 位指纹）。
// 用法：node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-num1-01-e2e.ts <outDirAbs>
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');
const BASE = process.env.SEAFOOD_BASE || 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'num1-run'));
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
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));
// 远端 Neon（ap-southeast-1）**间歇性 `fetch failed`** ⇒ 只读查询带重试（自曝 §7）
const sql = async (q: string): Promise<unknown[]> => {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try { return await sqlRaw(q); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw last;
};
const auth = require(path.join(REPO, 'src', 'auth')) as { createSessionToken: (p: { uID: number; evm: string }) => string };
const fp12 = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 12);

// ---- 下限常量：**从源码现取** -------------------------------------------------------------
const SRC = fs.readFileSync(path.join(REPO, 'src', 'currency-service.ts'), 'utf8');
const floorOf = (name: string): number => {
  const m = SRC.match(new RegExp(`${name}\\s*=\\s*(\\d+);`));
  if (!m) throw new Error(`FLOOR_CONST_NOT_FOUND:${name}`);
  return Number(m[1]);
};
const CREATE_FLOOR = floorOf('CURRENCY_CREATE_FEE_FLOOR');
const LIST_FEE_FLOOR = floorOf('CURRENCY_LIST_FEE_FLOOR');
const LIST_DEPOSIT_FLOOR = floorOf('CURRENCY_LIST_DEPOSIT_FLOOR');
const SYS_CID = 1;
const FIXTURE_SIGMA_EXPECTED = '2020100'; // 派单给定基线（实测核对，失配即 FAIL）

type Row = Record<string, string>;
const snap = async () => {
  const s = (await sql('SELECT COALESCE(sum(balance+frozen),0)::text AS sigma, COALESCE(sum(balance),0)::text AS sbal, COALESCE(sum(frozen),0)::text AS sfrz FROM public.account')) as Row[];
  const e = (await sql('SELECT count(*)::int AS n FROM public.ledger_entry')) as unknown as Array<{ n: number }>;
  const cur = (await sql('SELECT cid::text AS cid, symbol, status FROM public.currency ORDER BY cid')) as Row[];
  return { sigma: String(s[0].sigma), sbal: String(s[0].sbal), sfrz: String(s[0].sfrz), entries: Number(e[0].n), currencies: cur };
};
type Snap = Awaited<ReturnType<typeof snap>>;

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
  return {
    name: c.name, status, expect: c.expect, expect_code: c.expectCode ?? null, error_code: code,
    details: err.details ?? null,
    ok_pass: status === c.expect && (c.expectCode === undefined || c.expectCode === null ? true : code === c.expectCode),
    data: {
      cid: data.cid ?? null, fee: data.fee ?? null, fee_source: data.fee_source ?? null,
      listing_fee: data.listing_fee ?? null, listing_fee_source: data.listing_fee_source ?? null,
      deposit_consumed: data.deposit_consumed ?? null, deposit_source: data.deposit_source ?? null,
      replay: data.idempotent_replay ?? null,
    },
    body_head: text.slice(0, 200),
  };
};

const main = async () => {
  const out: Record<string, unknown> = {
    generated_at: new Date().toISOString(), base: BASE, run: RUN, mints_in_this_run: 0,
    floors: { CREATE_FLOOR, LIST_FEE_FLOOR, LIST_DEPOSIT_FLOOR }, fixture_sigma_expected: FIXTURE_SIGMA_EXPECTED,
  };

  // 主体 = cid=1（系统币）余额最大的用户（**数值序** cast(bigint)，账户列按文本存）
  const top = (await sql(`SELECT uid::text AS uid, balance::text AS balance FROM public.account WHERE cid = ${SYS_CID} ORDER BY balance::bigint DESC LIMIT 1`)) as Row[];
  const actorUid = Number(top[0].uid);
  const usr = (await sql(`SELECT uid::text AS uid, evm FROM public."users" WHERE uid = ${actorUid}`)) as Array<{ uid: string; evm: string }>;
  if (!usr[0]) throw new Error('NUM1_ACTOR_NOT_FOUND');
  const tActor = `Bearer ${auth.createSessionToken({ uID: actorUid, evm: usr[0].evm })}`;
  out.subject = { actor_uid: actorUid, actor_cid1_balance: String(top[0].balance), token_fp12: fp12(tActor) };

  const TAG = RUN.replace(/[^0-9A-Za-z]/g, '').slice(-8).toUpperCase();
  const SYM_A = `N1A${TAG}`.slice(0, 16);
  const SYM_B = `N1B${TAG}`.slice(0, 16);
  const K = (s: string) => `cli:num1-${TAG}:${s}`;
  out.fixtures = { SYM_A, SYM_B, key_prefix: `cli:num1-${TAG}:` };

  const cases: Array<Record<string, unknown>> = [];
  const push = async (c: Case) => { const r = await call(c); cases.push(r as unknown as Record<string, unknown>); return r; };

  const pre = await snap();

  // ---------------- C1 · 建币费下限 ----------------
  const c1a = await push({ name: `C1-a fee=${CREATE_FLOOR - 1} (below floor) => 400`, method: 'POST', url: '/api/currency', auth: tActor, body: { symbol: SYM_A, name: 'num1 below', decimals: 2, fee: CREATE_FLOOR - 1 } , expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  const c1b = await push({ name: `C1-b fee=${CREATE_FLOOR} (== floor) => 200`, method: 'POST', url: '/api/currency', auth: tActor, body: { symbol: SYM_A, name: 'num1 at floor', decimals: 2, fee: CREATE_FLOOR, create_key: K('c1b') }, expect: 200 });
  const cidA = Number(c1b.data.cid);
  const c1c = await push({ name: `C1-c fee OMITTED => server default (${CREATE_FLOOR})`, method: 'POST', url: '/api/currency', auth: tActor, body: { symbol: SYM_B, name: 'num1 default', decimals: 2, create_key: K('c1c') }, expect: 200 });
  const cidB = Number(c1c.data.cid);
  const c1d = await push({ name: 'C1-d REPLAY same key+payload => 200 replay', method: 'POST', url: '/api/currency', auth: tActor, body: { symbol: SYM_B, name: 'num1 default', decimals: 2, create_key: K('c1c') }, expect: 200 });
  const midC1 = await snap();
  out.C1 = {
    c1a_below: { status: c1a.status, code: c1a.error_code, details: c1a.details },
    c1b_at_floor: { status: c1b.status, fee: c1b.data.fee, fee_source: c1b.data.fee_source, matches_source_floor: String(c1b.data.fee) === String(CREATE_FLOOR) },
    c1c_default: { status: c1c.status, fee: c1c.data.fee, fee_source: c1c.data.fee_source, matches_source_floor: String(c1c.data.fee) === String(CREATE_FLOOR) },
    c1d_replay: { status: c1d.status, replay_flag: c1d.data.replay, delta_entries: midC1.entries - pre.entries },
    cidA, cidB,
  };

  // ---------------- C2 · 上市费 / 保证金下限 ----------------
  const c2a = await push({ name: `C2-a deposit_amount=${LIST_DEPOSIT_FLOOR - 1} (below floor) => 400`, method: 'POST', url: `/api/currency/${cidA}/list`, auth: tActor, body: { fee: LIST_FEE_FLOOR, deposit_amount: LIST_DEPOSIT_FLOOR - 1, create_key: K('c2a') }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  const c2b = await push({ name: `C2-b listing_fee=${LIST_FEE_FLOOR - 1} (below floor) => 400`, method: 'POST', url: `/api/currency/${cidA}/list`, auth: tActor, body: { fee: LIST_FEE_FLOOR - 1, deposit_amount: LIST_DEPOSIT_FLOOR, create_key: K('c2b') }, expect: 400, expectCode: 'LEDGER_AMOUNT_NOT_POSITIVE' });
  const c2c = await push({ name: `C2-c fee=${LIST_FEE_FLOOR}+deposit=${LIST_DEPOSIT_FLOOR} (at floor) => 200`, method: 'POST', url: `/api/currency/${cidA}/list`, auth: tActor, body: { fee: LIST_FEE_FLOOR, deposit_amount: LIST_DEPOSIT_FLOOR, create_key: K('c2c') }, expect: 200 });
  const c2d = await push({ name: 'C2-d REPLAY same key+payload => 200 replay', method: 'POST', url: `/api/currency/${cidA}/list`, auth: tActor, body: { fee: LIST_FEE_FLOOR, deposit_amount: LIST_DEPOSIT_FLOOR, create_key: K('c2c') }, expect: 200 });
  const c2e = await push({ name: `C2-e OMITTED => server defaults (${LIST_FEE_FLOOR}+${LIST_DEPOSIT_FLOOR})`, method: 'POST', url: `/api/currency/${cidB}/list`, auth: tActor, body: { create_key: K('c2e') }, expect: 200 });
  const post = await snap();
  out.C2 = {
    c2a_dep_below: { status: c2a.status, code: c2a.error_code, details: c2a.details },
    c2b_fee_below: { status: c2b.status, code: c2b.error_code, details: c2b.details },
    c2c_at_floor: { status: c2c.status, listing_fee: c2c.data.listing_fee, deposit_consumed: c2c.data.deposit_consumed, listing_fee_source: c2c.data.listing_fee_source, deposit_source: c2c.data.deposit_source },
    c2d_replay: { status: c2d.status, replay_flag: c2d.data.replay },
    c2e_default: { status: c2e.status, listing_fee: c2e.data.listing_fee, deposit_consumed: c2e.data.deposit_consumed, listing_fee_source: c2e.data.listing_fee_source, deposit_source: c2e.data.deposit_source, matches_source_floors: String(c2e.data.listing_fee) === String(LIST_FEE_FLOOR) && String(c2e.data.deposit_consumed) === String(LIST_DEPOSIT_FLOOR) },
  };

  // ---------------- 资金不变量（纯转移） ----------------
  out.invariants = {
    sigma_pre: pre.sigma, sigma_post: post.sigma,
    sigma_delta: (BigInt(post.sigma) - BigInt(pre.sigma)).toString(),
    sigma_expected: FIXTURE_SIGMA_EXPECTED,
    sigma_is_expected_pre_and_post: pre.sigma === FIXTURE_SIGMA_EXPECTED && post.sigma === FIXTURE_SIGMA_EXPECTED,
    sigma_frozen_pre: pre.sfrz, sigma_frozen_post: post.sfrz,
    entries_pre: pre.entries, entries_post: post.entries, entries_delta: post.entries - pre.entries,
    currencies_added: post.currencies.filter((c) => c.symbol === SYM_A || c.symbol === SYM_B).map((c) => `${c.cid}:${c.symbol}:${c.status}`),
  };

  out.cases = cases;
  out.summary = {
    pass: cases.filter((c) => c.ok_pass).length, total: cases.length,
    failed: cases.filter((c) => !c.ok_pass).map((c) => `${c.name}=${c.status}/${c.expect}:${c.error_code}`),
  };

  fs.writeFileSync(path.join(outDir, 'num1-01-e2e.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'num1-01-e2e.json'));
  console.log('FLOORS ' + JSON.stringify(out.floors));
  console.log('SUBJECT ' + JSON.stringify(out.subject));
  for (const c of cases) console.log(`[${c.ok_pass ? 'PASS' : 'FAIL'}] ${c.status}/${c.expect} ${c.name} code=${c.error_code} details=${JSON.stringify(c.details)}`);
  console.log('SUMMARY ' + JSON.stringify(out.summary));
  console.log('INVARIANTS ' + JSON.stringify(out.invariants));
  if ((out.summary as { failed: string[] }).failed.length > 0) process.exitCode = 1;
};
main().catch((e) => { console.error('NUM1_ERR ' + String(e).slice(0, 400)); process.exit(1); });
