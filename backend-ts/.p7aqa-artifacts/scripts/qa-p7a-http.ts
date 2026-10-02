/**
 * qa-p7a-http.ts —— **Neng 独立质检（批 7-A）**：`GET /api/user/ledger` 真 HTTP 实测
 * 法源：本项目自建夹具（`.p7aqa-artifacts/FIXTURE-<RUN>/`，uid ≥ 910001）+ 自起实例（5793–5799）。
 * 与交付方探针的差别：独立夹具 uid / 独立断言 / 独立 token 现铸路径 / 判据写在脚本自身（退出码管道外捕获）。
 * 覆盖：鉴权（401 R107 / 坏 token / 真 token）· keyset（翻页/无重/无漏/逐字 = DB 降序 · 末页 null
 *        · 满页边界）· 过滤（kind/cid/before_txid/非法入参 400）· limit（默认/夹取/回落/下限）
 *        · 隔离（只看自己）· 零写副作用（24 次调用前后四表 + Σ + public 表数/索引数 + 表名/索引名集合）
 * 用法：npx ts-node --transpile-only .p7aqa-artifacts/scripts/qa-p7a-http.ts <RUN> <baseUrl>
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

type Row = Record<string, unknown>;
const RUN = process.argv[2] || 'HTTP-QA001';
const BASE = process.argv[3] || 'http://127.0.0.1:5793';
const OUTDIR = `.p7aqa-artifacts/${RUN}`;
fs.mkdirSync(OUTDIR, { recursive: true });
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
const SECRET = String(process.env.SECRET_KEY || '');

const b64u = (v: string) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string, evm: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

interface Resp { status: number | 'NETERR'; json: Row | null; topKeys: string[]; errorKeys: string[]; code: string | null;
  hasNext: boolean; next: unknown; rows: Row[] | null; raw: string }
const call = async (q: string, token?: string): Promise<Resp> => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(BASE + '/api/user/ledger' + q, { headers, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: Row | null = null;
    try { json = JSON.parse(text) as Row; } catch { /* 非 JSON */ }
    const hasNext = !!json && Object.prototype.hasOwnProperty.call(json, 'next_before_txid');
    const err = (json?.error ?? null) as { code?: string; keys?: string[] } | null;
    return { status: res.status, json, topKeys: json ? Object.keys(json) : [],
      errorKeys: err && typeof err === 'object' ? Object.keys(err) : [], code: err && typeof err === 'object' ? (err.code ?? null) : null,
      hasNext, next: hasNext ? json!.next_before_txid : undefined,
      rows: Array.isArray(json?.data) ? (json!.data as Row[]) : null, raw: text.slice(0, 900) };
  } catch (e) {
    return { status: 'NETERR', json: null, topKeys: [], errorKeys: [], code: null, hasNext: false, next: undefined, rows: null, raw: String(e).slice(0, 200) };
  }
};

const checks: Row[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => { checks.push({ name, ok, detail }); };

const SNAP_SQL = `
  SELECT (SELECT COUNT(1)::int FROM public.ledger_entry) AS ledger_rows,
         (SELECT COALESCE(SUM(delta),0)::text FROM public.ledger_entry) AS ledger_sum_delta,
         (SELECT COALESCE(SUM(frozen_delta),0)::text FROM public.ledger_entry) AS ledger_sum_frozen,
         (SELECT COUNT(1)::int FROM public.account) AS account_rows,
         (SELECT COALESCE(SUM(balance),0)::text FROM public.account) AS account_sum_balance,
         (SELECT COALESCE(SUM(frozen),0)::text FROM public.account) AS account_sum_frozen,
         (SELECT COUNT(1)::int FROM public.users) AS users_rows,
         (SELECT COUNT(1)::int FROM public.currency) AS currency_rows,
         (SELECT COUNT(1)::int FROM information_schema.tables WHERE table_schema='public') AS public_tables,
         (SELECT COUNT(1)::int FROM pg_indexes WHERE schemaname='public') AS public_indexes,
         (SELECT string_agg(table_name::text, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public') AS table_names,
         (SELECT string_agg(indexname::text, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname='public') AS index_names,
         (SELECT COALESCE(SUM(balance),0)::text FROM public.account WHERE cid = 1) AS sum_cid1
`;
const callSql = sql as unknown as (q: string, p?: unknown[]) => Promise<Row[]>;
const snap = async (): Promise<Row> => (await callSql(SNAP_SQL, []))[0];

(async () => {
  const fxPath = `.p7aqa-artifacts/FIXTURE-P7AQA001/fixture-P7AQA001.json`;
  const fx = JSON.parse(fs.readFileSync(fxPath, 'utf8')) as Row;
  const A = Number((fx.fixture as Row).uids ? ((fx.fixture as Row).uids as Row).A : 0);
  const Bn = Number(((fx.fixture as Row).uids as Row).B);
  const evmA = String((fx.fixture as Row).evm_a);
  const cidX = Number(((fx.fixture as Row).cids as Row).X);
  const cidY = Number(((fx.fixture as Row).cids as Row).Y);
  const TA = jwt(A, evmA);
  const evmB = '0x' + crypto.createHash('sha256').update(`${String((fx.run as string) || '')}:b`).digest('hex').slice(0, 40);
  // B 的身份行不由夹具创建（只有 A 进 users）⇒ B 的 token 预期 401；用 A 的存在性对照。
  const TB = jwt(Bn, evmB);

  const out: Row = { run: RUN, base: BASE, probe: 'qa-p7a-http', fixture: { A, B: Bn, cidX, cidY, evmA_present: !!evmA },
    token_fp: { A: fp(TA) }, secret_fp: fp(SECRET) };
  const R: Row = {};
  out.readings = R;

  // ---- DB 真值（独立重取；不采信夹具文件）--------------------------------------
  const dbRows = await sql`SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
                                  frozen_delta::text AS frozen_delta, balance_after::text AS balance_after,
                                  frozen_after::text AS frozen_after, kind, ref_type, ref_id::text AS ref_id,
                                  reversal_of_txid::text AS reversal_of_txid, memo,
                                  (floor(extract(epoch from time_created)))::bigint::text AS time_created
                             FROM public.ledger_entry WHERE uid = ${A} ORDER BY public.ledger_entry.txid DESC` as Row[];
  const dbTxids = dbRows.map((r) => Number(r.txid));
  const dbTxidsB = (await sql`SELECT txid::text AS txid FROM public.ledger_entry WHERE uid = ${Bn} ORDER BY txid DESC` as Row[]).map((r) => Number(r.txid));
  R.db_desc_txids_A = dbTxids;
  R.db_desc_txids_B = dbTxidsB;
  check('夹具前提：DB 里 A 的降序流水 ≥ 25 行（供 3 页 limit=10 实测）', dbTxids.length >= 25, { n: dbTxids.length });

  // ============================================================ ① 鉴权（R107 / 401）
  const noTok = await call('');
  R.auth_no_token = { status: noTok.status, error_keys: noTok.errorKeys.slice().sort().join(','), code: noTok.code, raw: noTok.raw };
  check('① 无 token ⇒ 401', noTok.status === 401, noTok.status);
  check('① 无 token ⇒ R107 形状 {code,message,i18n_key,details}', noTok.errorKeys.slice().sort().join(',') === 'code,details,i18n_key,message', noTok.errorKeys);
  check('① 无 token ⇒ code = AUTH_UNAUTHORIZED（非账本域）', noTok.code === 'AUTH_UNAUTHORIZED', noTok.code);

  const badTok = await call('?limit=5', 'not.a.jwt');
  R.auth_bad_token = { status: badTok.status, code: badTok.code };
  check('① 坏 token ⇒ 401', badTok.status === 401 && badTok.code === 'AUTH_UNAUTHORIZED', R.auth_bad_token);

  const tokB = await call('?limit=5', TB);
  R.auth_token_of_nonexistent_user = { status: tokB.status, code: tokB.code };
  check('① 签名正确但 users 无此行 ⇒ 401（鉴权语义：无对应主体）', tokB.status === 401, R.auth_token_of_nonexistent_user);

  const ok1 = await call('?limit=10', TA);
  R.auth_real_token = { status: ok1.status, top_keys: ok1.topKeys.slice().sort().join(','), has_next_key: ok1.hasNext, rows: ok1.rows?.length };
  check('① 真 token ⇒ 200', ok1.status === 200, ok1.status);
  check('① 顶层含 next_before_txid 键（DL25 回传位）', ok1.hasNext === true, ok1.topKeys);
  check('① data 为数组', Array.isArray(ok1.rows), typeof ok1.rows);

  // 行键集（不得泄漏内部机械列）
  const rowKeys = ok1.rows && ok1.rows[0] ? Object.keys(ok1.rows[0]).sort() : [];
  R.row_keys = rowKeys;
  const expectKeys = ['balance_after', 'cid', 'delta', 'frozen_after', 'frozen_delta', 'kind', 'memo', 'ref_id', 'ref_type', 'reversal_of_txid', 'time_created', 'txid', 'uid'];
  check('① 行键集 = 冻结业务键集（13 键，无 idempotency_key/request_fingerprint/event_root_key）',
    JSON.stringify(rowKeys) === JSON.stringify(expectKeys), { rowKeys, expectKeys });

  // ============================================================ ② keyset 翻页（limit=10）
  const pages: Row[] = [];
  let cursor: number | null = null;
  let guard = 0;
  for (;;) {
    const q = cursor === null ? '?limit=10' : `?limit=10&before_txid=${cursor}`;
    const r = await call(q, TA);
    if (r.status !== 200) { check(`② 翻页第 ${pages.length + 1} 页 200`, false, { status: r.status, raw: r.raw }); break; }
    pages.push({ page: pages.length + 1, n: r.rows?.length ?? 0, has_next_key: r.hasNext, next: r.next, txids: (r.rows ?? []).map((x) => Number(x.txid)) });
    const nxt = r.next;
    if (r.hasNext && nxt === null) break;                        // 到底
    if (!r.hasNext) { check('② 每页都必须回传 next_before_txid 键', false, r.topKeys); break; }
    cursor = Number(nxt);
    if ((guard += 1) > 10) break;
  }
  const flat = pages.flatMap((p) => p.txids as number[]);
  R.keyset_pages = pages;
  R.keyset_flat = flat;
  check('② 3 页取尽（28 行 / limit 10 ⇒ 10+10+8）', pages.length === 3 && JSON.stringify(pages.map((p) => p.n)) === JSON.stringify([10, 10, 8]), pages.map((p) => p.n));
  check('② 无重复', new Set(flat).size === flat.length, { flat_len: flat.length, uniq: new Set(flat).size });
  check('② 严格递减', flat.every((v, i) => i === 0 || flat[i - 1] > v), flat);
  check('② 与 DB 降序逐字一致（无跳无漏）', JSON.stringify(flat) === JSON.stringify(dbTxids), { http: flat, db: dbTxids });
  check('② 末页 next_before_txid = null 且键存在', pages[2].has_next_key === true && pages[2].next === null, pages[2]);
  check('② 首页不回 NULL 游标（满页 ⇒ 回传末条 txid）', pages[0].next === dbTxids[9], { next: pages[0].next, expect: dbTxids[9] });

  // 逐字对拍（整集 13 字段）
  const flatRows: Row[] = [];
  {
    let c: number | null = null;
    let g = 0;
    for (;;) {
      const r = await call(c === null ? '?limit=10' : `?limit=10&before_txid=${c}`, TA);
      if (!r.rows || r.rows.length === 0) break;
      flatRows.push(...r.rows);
      if (!r.hasNext || r.next === null) break;
      c = Number(r.next);
      if ((g += 1) > 60) break;   // 守卫：变异体（游标失效）下防死循环；正常 28 行 ⇒ 3 页即止
    }
  }
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const cmp: Row[] = [];
  for (let i = 0; i < Math.min(flatRows.length, dbRows.length); i += 1) {
    const h = flatRows[i]; const d = dbRows[i];
    const eq = Number(h.txid) === Number(d.txid) && Number(h.uid) === Number(d.uid) && Number(h.cid) === Number(d.cid)
      && Number(h.delta) === Number(d.delta) && Number(h.frozen_delta) === Number(d.frozen_delta)
      && Number(h.balance_after) === Number(d.balance_after) && Number(h.frozen_after) === Number(d.frozen_after)
      && String(h.kind) === String(d.kind) && String(h.memo) === String(d.memo)
      && (h.ref_type === null ? null : String(h.ref_type)) === (d.ref_type === null ? null : String(d.ref_type))
      && num(h.ref_id) === num(d.ref_id) && num(h.reversal_of_txid) === num(d.reversal_of_txid)
      && num(h.time_created) === num(d.time_created);
    if (!eq) cmp.push({ i, http: h, db: d });
  }
  R.verbatim_row_diffs = cmp;
  check('② 全字段（13 项）逐字 = DB', cmp.length === 0 && flatRows.length === dbRows.length, { diffs: cmp.length, http_n: flatRows.length, db_n: dbRows.length });

  // 满页边界：limit = 总行数 ⇒ 仍回非 NULL 游标；再来一页 ⇒ 0 行 + null
  const b1 = await call(`?limit=${dbRows.length}`, TA);
  const b2 = await call(`?limit=${dbRows.length}&before_txid=${b1.next as number}`, TA);
  R.boundary_full_page = { page1_n: b1.rows?.length, page1_next: b1.next, page2_n: b2.rows?.length, page2_next: b2.next, page2_has_key: b2.hasNext };
  check('② 满页边界：n == limit ⇒ 回末条 txid（非 null）', b1.rows?.length === dbRows.length && b1.next === dbTxids[dbTxids.length - 1], R.boundary_full_page);
  check('② 满页后的下一页 ⇒ 0 行 + next_before_txid=null（键在）', b2.rows?.length === 0 && b2.hasNext === true && b2.next === null, R.boundary_full_page);

  // before_txid 过滤语义
  const big = await call('?limit=500&before_txid=999999999', TA);
  const minTx = Math.min(...dbTxids);
  const below = await call(`?limit=500&before_txid=${minTx}`, TA);
  const mid = dbTxids[9];
  const midPage = await call(`?limit=500&before_txid=${mid}`, TA);
  R.before_filter = { big_n: big.rows?.length, below_n: below.rows?.length, mid_n: midPage.rows?.length, mid_first: midPage.rows?.[0]?.txid };
  check('③ before_txid 过滤：> 最大 ⇒ 全集', big.rows?.length === dbRows.length, R.before_filter);
  check('③ before_txid 过滤：= 最小 ⇒ 0 行', below.rows?.length === 0, R.before_filter);
  check('③ before_txid 过滤：严格小于（不含边界）', midPage.rows?.length === dbTxids.length - 10 && Number(midPage.rows?.[0]?.txid) === dbTxids[10], R.before_filter);

  // ============================================================ ③ kind / cid 过滤
  const kindTransfer = await call('?limit=500&kind=transfer', TA);
  const kindMint = await call('?limit=500&kind=mint', TA);
  const kindBurn = await call('?limit=500&kind=burn', TA);
  const cidPage = await call(`?limit=500&cid=${cidX}`, TA);
  const cidPageY = await call(`?limit=500&cid=${cidY}`, TA);
  const combo = await call(`?limit=500&kind=mint&cid=${cidY}`, TA);
  const dbTransfer = (await sql`SELECT txid::text AS txid FROM public.ledger_entry WHERE uid=${A} AND kind='transfer' ORDER BY txid DESC` as Row[]).map((r) => Number(r.txid));
  const dbMint = (await sql`SELECT txid::text AS txid FROM public.ledger_entry WHERE uid=${A} AND kind='mint' ORDER BY txid DESC` as Row[]).map((r) => Number(r.txid));
  const dbCidX = (await sql`SELECT txid::text AS txid FROM public.ledger_entry WHERE uid=${A} AND cid=${cidX} ORDER BY txid DESC` as Row[]).map((r) => Number(r.txid));
  const dbCidY = (await sql`SELECT txid::text AS txid FROM public.ledger_entry WHERE uid=${A} AND cid=${cidY} ORDER BY txid DESC` as Row[]).map((r) => Number(r.txid));
  R.filters = {
    kind_transfer: { http_n: kindTransfer.rows?.length, db_n: dbTransfer.length, same: JSON.stringify((kindTransfer.rows ?? []).map((r) => Number(r.txid))) === JSON.stringify(dbTransfer) },
    kind_mint: { http_n: kindMint.rows?.length, db_n: dbMint.length, same: JSON.stringify((kindMint.rows ?? []).map((r) => Number(r.txid))) === JSON.stringify(dbMint) },
    kind_absent: { kind: 'burn', http_n: kindBurn.rows?.length, status: kindBurn.status },
    cid_x: { http_n: cidPage.rows?.length, db_n: dbCidX.length, same: JSON.stringify((cidPage.rows ?? []).map((r) => Number(r.txid))) === JSON.stringify(dbCidX) },
    cid_y: { http_n: cidPageY.rows?.length, db_n: dbCidY.length, same: JSON.stringify((cidPageY.rows ?? []).map((r) => Number(r.txid))) === JSON.stringify(dbCidY) },
    combo_mint_cidY: { http_n: combo.rows?.length, db_n: dbCidY.length },
  };
  check('④ kind=transfer 逐字 = DB', (R.filters as Row).kind_transfer && ((R.filters as Row).kind_transfer as Row).same === true);
  check('④ kind=mint 逐字 = DB', (R.filters as Row).kind_mint && ((R.filters as Row).kind_mint as Row).same === true);
  check('④ kind=burn（闭集内但本 uid 无该流水）⇒ 200 + 0 行', kindBurn.status === 200 && kindBurn.rows?.length === 0);
  check('④ cid=X 逐字 = DB', (R.filters as Row).cid_x && ((R.filters as Row).cid_x as Row).same === true);
  check('④ cid=Y 逐字 = DB', (R.filters as Row).cid_y && ((R.filters as Row).cid_y as Row).same === true);
  check('④ kind+cid 组合 = 期望（mint on Y = 3）', combo.rows?.length === dbCidY.length, (R.filters as Row).combo_mint_cidY);

  // 非法入参 ⇒ 400（不得 500）
  const badKind = await call('?kind=__nope__', TA);
  const badCid1 = await call('?cid=abc', TA);
  const badCid2 = await call('?cid=0', TA);
  const badCid3 = await call('?cid=-1', TA);
  const okCidAbsent = await call('?cid=999999', TA);
  const badBefore1 = await call('?before_txid=xyz', TA);
  const badBefore2 = await call('?before_txid=0', TA);
  const badBefore3 = await call('?before_txid=-9', TA);
  R.illegal = {
    bad_kind: { status: badKind.status, code: badKind.code, keys: badKind.errorKeys, raw: badKind.raw },
    cid_abc: { status: badCid1.status }, cid_0: { status: badCid2.status }, cid_neg: { status: badCid3.status },
    cid_absent_valid: { status: okCidAbsent.status, n: okCidAbsent.rows?.length },
    before_xyz: { status: badBefore1.status }, before_0: { status: badBefore2.status }, before_neg: { status: badBefore3.status },
  };
  check('④ 非法 kind ⇒ 400 + LEDGER_UNKNOWN_KIND + R107 形状', badKind.status === 400 && badKind.code === 'LEDGER_UNKNOWN_KIND' && badKind.errorKeys.slice().sort().join(',') === 'code,details,i18n_key,message', R.illegal);
  check('④ 非法 cid（abc/0/-1）⇒ 400', badCid1.status === 400 && badCid2.status === 400 && badCid3.status === 400, R.illegal);
  check('④ cid 合法但不存在 ⇒ 200 + 0 行（不 500）', okCidAbsent.status === 200 && okCidAbsent.rows?.length === 0, R.illegal);
  check('④ 非法 before_txid（xyz/0/-9）⇒ 400', badBefore1.status === 400 && badBefore2.status === 400 && badBefore3.status === 400, R.illegal);

  // ============================================================ ④ limit 语义
  const lim = async (q: string) => { const r = await call(q, TA); return { status: r.status, n: r.rows?.length ?? null, next: r.hasNext ? r.next : 'KEY_MISSING' }; };
  R.limit = {
    absent: await lim(''), limit_500: await lim('?limit=500'), limit_1000: await lim('?limit=1000'),
    limit_abc: await lim('?limit=abc'), limit_empty: await lim('?limit='),
    limit_0: await lim('?limit=0'), limit_neg: await lim('?limit=-5'), limit_float: await lim('?limit=2.7'),
    limit_1: await lim('?limit=1'),
  };
  check('⑤ limit 缺省 ⇒ 全取（28 < 默认上限）+ next=null', (R.limit as Row).absent.n === dbRows.length && (R.limit as Row).absent.next === null, (R.limit as Row).absent);
  check('⑤ limit=500/1000 ⇒ 200 且不截断夹具（夹取不报错）', (R.limit as Row).limit_500.status === 200 && (R.limit as Row).limit_1000.status === 200, (R.limit as Row).limit_1000);
  check('⑤ limit 非法（abc / 空串）⇒ 200 回落默认（全取）', (R.limit as Row).limit_abc.status === 200 && (R.limit as Row).limit_abc.n === dbRows.length && (R.limit as Row).limit_empty.n === dbRows.length, (R.limit as Row).limit_abc);
  check('⑤ limit=0 / 负值 ⇒ 夹到 1（不 500、不 0 行）', (R.limit as Row).limit_0.n === 1 && (R.limit as Row).limit_neg.n === 1, { z: (R.limit as Row).limit_0, n: (R.limit as Row).limit_neg });
  check('⑤ limit=2.7 ⇒ 截断为 2', (R.limit as Row).limit_float.n === 2, (R.limit as Row).limit_float);
  check('⑤ limit=1 ⇒ 1 行 + 非空游标（= 首条 txid）', (R.limit as Row).limit_1.n === 1 && (R.limit as Row).limit_1.next === dbTxids[0], (R.limit as Row).limit_1);

  // ============================================================ ⑤ 隔离（只看自己）
  const isolationB = await call(`?limit=500`, TA);
  R.isolation = {
    A_token_rows_all_belong_to_A: (isolationB.rows ?? []).every((r) => Number(r.uid) === A),
    A_token_txids_vs_dbA: JSON.stringify((isolationB.rows ?? []).map((r) => Number(r.txid))) === JSON.stringify(dbTxids),
    // 反向：构造「B token 但 users 无 B」⇒ 401 已测；这里再证「B 的流水不会出现在 A 的响应里」
    b_txid_hits_in_A_response: (isolationB.rows ?? []).filter((r) => dbTxidsB.includes(Number(r.txid))).length,
    b_rows_in_db: dbTxidsB.length,
  };
  check('⑥ 只看自己：全部行 uid = token actor', (R.isolation as Row).A_token_rows_all_belong_to_A === true, R.isolation);
  check('⑥ 只看自己：B 的流水 0 条混入 A 的响应', (R.isolation as Row).b_txid_hits_in_A_response === 0, R.isolation);

  // ============================================================ ⑥ 零写副作用（DL23）24 次调用前后对拍
  const before = await snap();
  const callPlan = ['', '?limit=10', `?limit=10&before_txid=${mid}`, '?kind=transfer', `?cid=${cidX}`, '?limit=1', '?limit=abc', '?kind=mint&cid=1'];
  const zeroWriteResponses: Row[] = [];
  let callCount = 0;
  for (let i = 0; i < 24; i += 1) {
    const q = callPlan[i % callPlan.length];
    const r = await call(q, TA);
    callCount += 1;
    zeroWriteResponses.push({ q, status: r.status, n: r.rows?.length ?? null });
    const r401 = await call(q);      // 无 token 的只读尝试也算「调用」
    callCount += 1;
    zeroWriteResponses.push({ q: q + ' (no-token)', status: r401.status, n: r401.rows?.length ?? null });
  }
  const after = await snap();
  const keys = Object.keys(before);
  const diffs = keys.filter((k) => String(before[k]) !== String(after[k]));
  R.zero_write = { calls: callCount, before, after, diff_keys: diffs };
  check(`⑥ 零写副作用：${callCount} 次调用前后 13 项读数逐字不变（含 ledger_entry/account/users/currency 行数与 Σ、public 表数/索引数、表名/索引名集合）`, diffs.length === 0, diffs);
  check('⑥ public 表数/索引数 = 25 / 65（与基线一致，无新表/新索引）', String(after.public_tables) === '25' && String(after.public_indexes) === '65', { tables: after.public_tables, indexes: after.public_indexes });

  // 汇总
  const passed = checks.filter((c) => c.ok).length;
  out.summary = { passed, failed: checks.length - passed, total: checks.length };
  out.checks = checks;
  fs.writeFileSync(path.join(OUTDIR, `qa-http-${RUN}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ run: RUN, summary: out.summary, failed_checks: checks.filter((c) => !c.ok) }, null, 1));
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
})().catch((e) => { console.error('HTTP-PROBE-FAILED', String(e).slice(0, 800)); process.exit(2); });
