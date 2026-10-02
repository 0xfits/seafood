/**
 * p7a-01-http.ts — 批 7-A `GET /api/user/ledger` 真实 HTTP 实测（**只读面 + 只读库探针**）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p7a-01-http.ts <runDirAbs> <baseUrl>
 * 口径（§5.7）：
 *   ① token = `.env.local` 的 `SECRET_KEY` **现铸**（HS256）；**密钥 / token 本体一律不落盘**（只记 12 位指纹）。
 *   ② 每条 AC 给「读数 + 判据」；退出码在脚本自身（不做 `cmd | tail` 式取码）。
 *   ③ **零删除 SQL**：库侧只 SELECT；不写任何账本行（DL23 自证靠前后计数对拍）。
 *   ④ 产物 run-tagged（`.p7a-artifacts/<RUN>/p7a-01-http-<RUN>.json`）；不落 token / 密钥。
 * 覆盖 AC：① 注册（路径 200 而非 404）② 鉴权（401 R107 形状 / 坏 token 401 / 真 token 200）
 *          ③ keyset（before_txid / next_before_txid / 3 页无重无漏 / 源码 OFFSET=0 另测）
 *          ④ 过滤（cid / kind=transfer / limit 默认·上限·非法）
 *          ⑤ 零写副作用（≥20 次调用前后 4 表计数 + Σ + public 表数/索引数对拍）
 *          ⑨ 账本零位移（Σ balance cid=1 / ledger_entry 行数逐字不变）
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir> <baseUrl>');
const BASE = process.argv[3] || 'http://127.0.0.1:5792';
const RUN = path.basename(outDir);
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0x7a0${String(uid).padStart(5, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Row = Record<string, unknown>;
const raw = async <T = Row>(query: string, params: unknown[] = []): Promise<T[]> => {
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

const call = async (p: string, opts: { token?: string } = {}) => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  try {
    const res = await fetch(BASE + p, { headers, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    const j = json as { data?: unknown; error?: unknown } | null;
    const hasNext = !!j && typeof j === 'object' && Object.prototype.hasOwnProperty.call(j, 'next_before_txid');
    return {
      status: res.status,
      json: j,
      dataArr: Array.isArray(j?.data) ? (j!.data as Row[]) : null,
      topKeys: j && typeof j === 'object' ? Object.keys(j) : [],
      errorKeys: j?.error && typeof j.error === 'object' ? Object.keys(j.error as object) : [],
      code: (j?.error as { code?: string } | undefined)?.code ?? null,
      // 保留「键缺失」与「键存在但值为 null（到底）」的区别 ⇒ 不能 `?? undefined`
      hasNextBeforeTxid: hasNext,
      nextBeforeTxid: hasNext ? (j as { next_before_txid?: unknown }).next_before_txid : undefined,
    };
  } catch (e) {
    return { status: 'NETERR' as unknown as number, json: null, dataArr: null, topKeys: [], errorKeys: [], code: null, hasNextBeforeTxid: false, nextBeforeTxid: undefined, err: String(e).slice(0, 120) };
  }
};

const out: Record<string, unknown> = { run: RUN, base: BASE, probe: 'p7a-01-http', secret_fp: fp(SECRET) };
// 批 7-A 收口四（R-3①）：读数袋 `R` 是**探针内的动态读数登记**（键随 AC 逐条写入、无下游类型面）。
//   此前写作 `Record<string, unknown>` ⇒ 9 处 `R.ac2_no_token.error_shape_ok` 一类读写报
//   **TS18046（'R.x' is of type 'unknown'）**（见报告 §3 前后错数对照：86 → 77，本文件 9 → 0）。
//   修法按「等量下移 + 原因注释 + 留痕」取**单点**放宽：逐处 `as` 会散落 9 个断言点、且对读数面零收益。
type Reading = Record<string, any>;
const R: Reading = {};
out.readings = R;
const fails: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails.push(`${name}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail)}`);
  return ok;
};

async function main() {
  // 夹具选择：取 DB 里流水最多的两个真实用户（uid > 0）
  const urows = await raw<{ uid: string; n: number }>(
    `SELECT uid::text AS uid, COUNT(1)::int AS n FROM public.ledger_entry WHERE uid > 0 GROUP BY uid ORDER BY n DESC LIMIT 2`);
  const uids = urows.map((r) => Number(r.uid));
  const primary = uids[0];
  const secondary = uids[1] ?? uids[0];
  out.fixtures = { primary_uid: primary, secondary_uid: secondary, candidates: urows };
  const T1 = jwt(primary);
  const T2 = jwt(secondary);

  // ---- AC② 鉴权 --------------------------------------------------------------
  const noTok = await call('/api/user/ledger');
  R.ac2_no_token = { status: noTok.status, error_keys: noTok.errorKeys, code: noTok.code,
    error_shape_ok: noTok.errorKeys.slice().sort().join(',') === 'code,details,i18n_key,message' };
  check('AC2 无 token ⇒ 401', noTok.status === 401, noTok.status);
  check('AC2 无 token 响应为 R107 形状', R.ac2_no_token.error_shape_ok === true, noTok.errorKeys);

  const badTok = await call('/api/user/ledger', { token: 'not.a.jwt' });
  R.ac2_bad_token = { status: badTok.status, code: badTok.code };
  check('AC2 坏 token ⇒ 401', badTok.status === 401, badTok.status);

  const okTok = await call('/api/user/ledger', { token: T1 });
  R.ac2_real_token = { status: okTok.status, top_keys: okTok.topKeys, has_data: Array.isArray(okTok.json?.data),
    has_next: okTok.hasNextBeforeTxid, row0_keys: okTok.dataArr && okTok.dataArr[0] ? Object.keys(okTok.dataArr[0]).sort() : [] };
  check('AC2 真 token ⇒ 200', okTok.status === 200, okTok.status);
  check('AC2 响应含 next_before_txid', okTok.hasNextBeforeTxid === true, okTok.topKeys);
  out.row_key_set = R.ac2_real_token.row0_keys;

  // ---- AC③ keyset 分页：3 页无重、无漏、txid 严格递减 --------------------------
  const dbAll = await raw<{ txid: string }>(
    `SELECT txid::text AS txid FROM public.ledger_entry WHERE uid = $1 ORDER BY public.ledger_entry.txid DESC`, [primary]);
  const dbAllTxids = dbAll.map((r) => Number(r.txid));
  const L = 7;
  const pages: number[][] = [];
  let cursor: number | null = null;
  for (let p = 0; p < 3; p += 1) {
    const q = `/api/user/ledger?limit=${L}` + (cursor === null ? '' : `&before_txid=${cursor}`);
    const c = await call(q, { token: T1 });
    const txids = (c.dataArr || []).map((r) => Number(r.txid));
    pages.push(txids);
    cursor = typeof c.nextBeforeTxid === 'number' ? c.nextBeforeTxid : null;
    if (p === 0) {
      R.ac3_page0 = { status: c.status, count: txids.length, next_before_txid: c.nextBeforeTxid, txids };
    }
  }
  const flat = pages.flat();
  const strictlyDesc = flat.every((v, i) => i === 0 || flat[i - 1] > v);
  const noDup = new Set(flat).size === flat.length;
  const expectedFirst21 = dbAllTxids.slice(0, flat.length);
  const matchesDb = flat.length === expectedFirst21.length && flat.every((v, i) => v === expectedFirst21[i]);
  R.ac3_keyset = {
    page_sizes: pages.map((p) => p.length),
    flat: flat,
    db_head: expectedFirst21,
    strictly_decreasing: strictlyDesc,
    no_duplicate: noDup,
    matches_db_head_prefix: matchesDb,
    last_next_before_txid: cursor,
  };
  check('AC3 三页 txid 严格递减', strictlyDesc);
  check('AC3 三页无重复', noDup);
  check('AC3 三页无跳漏（逐字等于 DB 降序前 N）', matchesDb, { flat, db: expectedFirst21 });
  check('AC3 分页发满页后 next_before_txid 非空', typeof R.ac3_page0 === 'object' && (R.ac3_page0 as { next_before_txid?: unknown }).next_before_txid !== null);

  // 到尾页：next_before_txid 应为 null
  const tail = await call(`/api/user/ledger?limit=${dbAllTxids.length + 50}`, { token: T1 });
  R.ac3_tail = { status: tail.status, count: (tail.dataArr || []).length, has_next_key: tail.hasNextBeforeTxid, next_before_txid: tail.nextBeforeTxid };
  check('AC3 不足页 ⇒ next_before_txid=null', tail.hasNextBeforeTxid === true && tail.nextBeforeTxid === null, R.ac3_tail);
  check('AC3 不足页返回全量', (tail.dataArr || []).length === dbAllTxids.length, (tail.dataArr || []).length);

  // ---- AC④ 过滤 --------------------------------------------------------------
  // kind=transfer（ShardPage 迁移依赖）
  const dbTransfer = await raw<{ txid: string }>(
    `SELECT txid::text AS txid FROM public.ledger_entry WHERE uid = $1 AND kind = 'transfer' ORDER BY public.ledger_entry.txid DESC`, [primary]);
  const dbTransferTxids = dbTransfer.map((r) => Number(r.txid));
  const ct = await call('/api/user/ledger?kind=transfer&limit=500', { token: T1 });
  const ctTxids = (ct.dataArr || []).map((r) => Number(r.txid));
  const ctKinds = new Set((ct.dataArr || []).map((r) => String(r.kind)));
  R.ac4_kind_transfer = { status: ct.status, count: ctTxids.length, db_count: dbTransferTxids.length,
    only_transfer: ctKinds.size <= 1 && (ctKinds.size === 0 || ctKinds.has('transfer')),
    txids_match_db: ctTxids.join(',') === dbTransferTxids.join(',') };
  check('AC4 kind=transfer 生效且逐字等于 DB', R.ac4_kind_transfer.txids_match_db === true, R.ac4_kind_transfer);

  // cid 过滤
  const dbCids = await raw<{ cid: string; n: number }>(
    `SELECT cid::text AS cid, COUNT(1)::int AS n FROM public.ledger_entry WHERE uid = $1 GROUP BY cid ORDER BY n DESC`, [primary]);
  const pickCid = Number(dbCids[0]?.cid ?? 1);
  const dbCidTx = await raw<{ txid: string }>(
    `SELECT txid::text AS txid FROM public.ledger_entry WHERE uid = $1 AND cid = $2 ORDER BY public.ledger_entry.txid DESC`, [primary, pickCid]);
  const cc = await call(`/api/user/ledger?cid=${pickCid}&limit=500`, { token: T1 });
  const ccTxids = (cc.dataArr || []).map((r) => Number(r.txid));
  R.ac4_cid = { cid: pickCid, status: cc.status, count: ccTxids.length, db_count: dbCidTx.length,
    txids_match_db: ccTxids.join(',') === dbCidTx.map((r) => Number(r.txid)).join(','),
    all_same_cid: (cc.dataArr || []).every((r) => Number(r.cid) === pickCid) };
  check('AC4 cid 过滤生效且逐字等于 DB', R.ac4_cid.txids_match_db === true, R.ac4_cid);

  // limit 默认 + 上限 + 非法
  const defLim = await call('/api/user/ledger', { token: T1 });
  R.ac4_limit_default = { count: (defLim.dataArr || []).length, db_total: dbAllTxids.length,
    default_is_100: (defLim.dataArr || []).length === Math.min(100, dbAllTxids.length) };
  check('AC4 limit 默认=100', R.ac4_limit_default.default_is_100 === true, R.ac4_limit_default);
  const capLim = await call('/api/user/ledger?limit=100000', { token: T1 });
  R.ac4_limit_cap = { count: (capLim.dataArr || []).length, cap_is_500: (capLim.dataArr || []).length === Math.min(500, dbAllTxids.length) };
  check('AC4 limit 上限=500', R.ac4_limit_cap.cap_is_500 === true, R.ac4_limit_cap);
  const badLim = await call('/api/user/ledger?limit=abc', { token: T1 });
  R.ac4_limit_invalid = { status: badLim.status, count: (badLim.dataArr || []).length, fell_back_to_default: badLim.status === 200 && (badLim.dataArr || []).length === Math.min(100, dbAllTxids.length) };
  check('AC4 limit 非法不 500', badLim.status === 200, badLim.status);
  const badCid = await call('/api/user/ledger?cid=abc', { token: T1 });
  R.ac4_cid_invalid = { status: badCid.status };
  check('AC4 cid 非法 ⇒ 400', badCid.status === 400, badCid.status);
  const badBefore = await call('/api/user/ledger?before_txid=xyz', { token: T1 });
  R.ac4_before_invalid = { status: badBefore.status };
  check('AC4 before_txid 非法 ⇒ 400', badBefore.status === 400, badBefore.status);
  const badKind = await call('/api/user/ledger?kind=__nope__', { token: T1 });
  R.ac4_kind_invalid = { status: badKind.status, code: badKind.code };
  check('AC4 kind 非法 ⇒ 400', badKind.status === 400, badKind.status);

  // 隔离：T2 只看到自己的流水（不串号）
  const t2c = await call('/api/user/ledger?limit=500', { token: T2 });
  const t2uids = new Set((t2c.dataArr || []).map((r) => Number(r.uid)));
  R.ac4_isolation = { status: t2c.status, only_self: t2c.dataArr !== null && t2uids.size <= 1 && (t2uids.size === 0 || t2uids.has(secondary)) };
  check('AC4 只看自己（不串号）', R.ac4_isolation.only_self === true, [...t2uids]);

  // ---- AC⑤ / AC⑨ 零写副作用 + 账本零位移（≥20 次调用前后对拍）------------------
  const snapshot = async () => {
    const le = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM public.ledger_entry`);
    const ac = await raw<{ n: number; sb: string; sf: string }>(`SELECT COUNT(1)::int AS n, COALESCE(SUM(balance),0)::text AS sb, COALESCE(SUM(frozen),0)::text AS sf FROM public.account`);
    const ac1 = await raw<{ n: number; sb: string }>(`SELECT COUNT(1)::int AS n, COALESCE(SUM(balance),0)::text AS sb FROM public.account WHERE cid=1`);
    const us = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM public.users`);
    const cu = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM public.currency`);
    const tb = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM information_schema.tables WHERE table_schema='public'`);
    const ix = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM pg_indexes WHERE schemaname='public'`);
    return {
      ledger_entry: le[0].n, account_rows: ac[0].n, account_sumbal: ac[0].sb, account_sumfrz: ac[0].sf,
      account_cid1_rows: ac1[0].n, account_cid1_sumbal: ac1[0].sb, users: us[0].n, currency: cu[0].n,
      public_tables: tb[0].n, public_indexes: ix[0].n,
    };
  };
  const before = await snapshot();
  let calls = 0;
  const paths = ['/api/user/ledger', '/api/user/ledger?limit=5', '/api/user/ledger?kind=transfer',
    `/api/user/ledger?cid=${pickCid}`, '/api/user/ledger?limit=1', `/api/user/ledger?before_txid=${dbAllTxids[10] ?? 1}`];
  for (let i = 0; i < 24; i += 1) {
    await call(paths[i % paths.length], { token: i % 2 === 0 ? T1 : T2 });
    calls += 1;
  }
  const after = await snapshot();
  R.ac5_zero_write = { calls, before, after, identical: JSON.stringify(before) === JSON.stringify(after) };
  check('AC5 ≥20 次调用前后四表计数/Σ/public 表数·索引数逐字不变', R.ac5_zero_write.identical === true, { before, after });
  check('AC5 调用数 ≥20', calls >= 20, calls);
  R.ac9_ledger_zero_displacement = { before_ledger: before.ledger_entry, after_ledger: after.ledger_entry,
    before_account_cid1_sumbal: before.account_cid1_sumbal, after_account_cid1_sumbal: after.account_cid1_sumbal,
    unchanged: before.ledger_entry === after.ledger_entry && before.account_cid1_sumbal === after.account_cid1_sumbal };
  check('AC9 账本零位移', R.ac9_ledger_zero_displacement.unchanged === true);

  // ---- AC① 注册（路径已注册 ⇒ 非 404）--------------------------------------
  R.ac1_registered = { status: okTok.status, not_404: okTok.status !== 404 };
  check('AC1 路径已注册（非 404）', okTok.status !== 404, okTok.status);

  out.failures = fails;
  out.verdict = fails.length === 0 ? 'PASS' : 'FAIL';
  const file = path.join(outDir, `p7a-01-http-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`WROTE ${file}`);
  console.log(`VERDICT ${out.verdict} failures=${fails.length}`);
  if (fails.length) process.exitCode = 1;
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
