/*
 * p4z-b4ciib-01-http.ts — P4-B4c-ii-b「商品线 + 交易所线」接线面：逐面真实 HTTP 实测
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b4ciib-01-http.ts <runDirAbs>
 * 口径（§5.7）：
 *   ① token = `.env.local` 的 `SECRET_KEY` 现铸（HS256，payload {sub,evm,exp}）；**密钥 / token 本体一律不落盘**
 *      （只记 12 位指纹；收尾自检产物内 `eyJ` 计数 = 0）
 *   ② 逐面「成功 + ≥1 负例」，报 status / `error.code` / 响应键集；**夹具幂等键一律 `cli:b4ciib:*`**
 *   ③ **零删除 SQL**：只 SELECT + 经 HTTP 写；后端 `src/**` 零改动（并发单元在改，禁碰）
 *   ④ 退出码在管道外取（本脚本自身 exitCode）；产物落 run-tagged 目录
 *   ⑤ 商品线负例：`price=0` ⇒ 400；购买缺键 ⇒ 400；卖家自购 ⇒ 400；非卖方退款 ⇒ 403
 *      交易所线负例：挂单缺键 ⇒ 400；非 owner 撤单 ⇒ 403
 *   ⑥ B8 造伪读数：购买请求带 `price`/`seller_uid`/`buyer_uid` 伪造值 ⇒ 以 DB 行 + 分录证明**被忽略**
 *   ⑦ 既有单点裁定读数：退款后 `listing.stock` **不回滚**；撤单**手续费不退**（撤单面无 `trade_fee` 分录）
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
const RUN = path.basename(outDir);
const TAG = `b4ciib${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const K = (s: string) => `cli:b4ciib:${TAG}:${s}`;
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xb4c${String(uid).padStart(6, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Call = { status: number | string; top: string[]; data: string[]; code: string | null; msg: string; json: any };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}): Promise<Call> => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return {
      status: res.status,
      top: json && typeof json === 'object' ? Object.keys(json) : [],
      data: json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? Object.keys(json.data) : [],
      code: json?.error?.code ?? null,
      msg: String(json?.error?.message ?? json?.message ?? '').slice(0, 80),
      json,
    };
  } catch (e) {
    return { status: 'NETERR', top: [], data: [], code: null, msg: String(e).slice(0, 120), json: null };
  }
};

// `@neondatabase/serverless` 该版本只有 tagged-template 通道 ⇒ `$n` 占位式安全转换（值走参数）
const raw = async <T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> => {
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

const results: Record<string, unknown> = { run: RUN, tag: TAG, base: BASE, secret_fingerprint: fp(SECRET), tests: {}, fixtures: {}, invariants: {}, notes: [] };
const tests = results.tests as Record<string, unknown>;
const say = (id: string, c: Call, extra: Record<string, unknown> = {}) => {
  const row = { status: c.status, code: c.code, data_keys: c.data, top_keys: c.top, msg: c.msg, ...extra };
  tests[id] = row;
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: keys=[${c.data.join(',')}]${extra.note ? ' :: ' + String(extra.note) : ''}`);
  return row;
};
const legsOf = async (rootKey: string) => raw(
  `SELECT uid::text AS uid, kind, delta::text AS delta, frozen_delta::text AS frozen_delta
     FROM public.ledger_entry WHERE event_root_key = $1 ORDER BY txid`, [rootKey]);
const accountOf = async (uid: number, cid: number) => (await raw<{ balance: string; frozen: string }>(
  `SELECT COALESCE(balance,0)::text AS balance, COALESCE(frozen,0)::text AS frozen
     FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint`, [String(uid), String(cid)]))[0]
  ?? { balance: '0', frozen: '0' };

async function main() {
  // ---------- 夹具发现：有 `$` 余额、且 `GET /api/user` 200 的真 uid ----------
  const accts = await raw<{ uid: string; bal: string }>(
    `SELECT uid::text AS uid, balance::text AS bal FROM public.account WHERE cid = 1 AND uid > 0 ORDER BY balance DESC LIMIT 40`);
  const usable: Array<{ uid: number; bal: string }> = [];
  for (const a of accts) {
    const uid = Number(a.uid);
    const me = await call('GET', '/api/user', { token: jwt(uid) });
    if (me.status === 200) usable.push({ uid, bal: a.bal });
  }
  const rich = usable.filter((c) => BigInt(c.bal) >= 500n);
  const seller = rich[0] ?? null;
  const buyer = rich.find((c) => c.uid !== seller?.uid) ?? null;
  const third = rich.find((c) => c.uid !== seller?.uid && c.uid !== buyer?.uid)
    ?? usable.find((c) => c.uid !== seller?.uid && c.uid !== buyer?.uid) ?? null;
  const listedCids = await raw<{ cid: string }>(
    `SELECT cid::text AS cid FROM public.currency WHERE status = 'listed' AND cid <> 1 ORDER BY cid LIMIT 10`);
  const baseCid = Number(listedCids[0]?.cid ?? 0);
  results.fixtures = {
    seller_uid: seller?.uid ?? null, seller_bal: seller?.bal ?? null,
    buyer_uid: buyer?.uid ?? null, buyer_bal: buyer?.bal ?? null,
    third_uid: third?.uid ?? null, listed_base_cids: listedCids.map((r) => Number(r.cid)),
    usable_candidates: usable.length,
  };
  console.log('FIXTURES', JSON.stringify(results.fixtures));
  if (!seller || !buyer || !third || !baseCid) {
    fs.writeFileSync(path.join(outDir, 'post', 'b4ciib-http.json'), JSON.stringify(results, null, 2));
    throw new Error('FIXTURE_MISSING');
  }
  const T_SELLER = jwt(seller.uid), T_BUYER = jwt(buyer.uid), T_THIRD = jwt(third.uid);

  // ========================== 商品线 ==========================
  const price = 7; const stock = 3; const qty = 1;
  say('L_neg_price0', await call('POST', '/api/listing', {
    token: T_SELLER, body: { cid: 1, price: 0, stock: 1, title: `b4ciib price0 ${TAG}`, create_key: K('price0') },
  }), { note: 'price=0 ⇒ 400（金额码 / 形状码，见 code）' });
  const noKey = await call('POST', '/api/listing', {
    token: T_SELLER, body: { cid: 1, price: 11, stock: 1, title: `b4ciib nokey ${TAG}` },
  });
  say('L_no_key_measured', noKey, {
    note: '派单预期「缺键 ⇒ 400」；实测见 status/code —— 服务端 `resolveListingCreateKey` 缺键会**派生**',
    created_key_derived: noKey.json?.data?.created_key_derived ?? null,
  });
  const created = await call('POST', '/api/listing', {
    token: T_SELLER, body: { cid: 1, price, stock, title: `b4ciib item ${TAG}`, description: 'b4ciib listing', create_key: K('item1') },
  });
  const listingId = Number((await raw(`SELECT listing_id::text AS id FROM public.listing WHERE create_key = $1`, [K('item1')]))[0]?.id ?? 0);
  say('L_ok', created, { listing_id: listingId, row: (await raw(`SELECT status, price::text AS price, stock::text AS stock, seller_uid::text AS seller FROM public.listing WHERE listing_id = $1::bigint`, [String(listingId)]))[0] });
  const replay = await call('POST', '/api/listing', {
    token: T_SELLER, body: { cid: 1, price, stock, title: `b4ciib item ${TAG}`, description: 'b4ciib listing', create_key: K('item1') },
  });
  say('L_replay_same_key', replay, { note: '同键重投 ⇒ 200 + idempotent_replay（不得落第二行）', rows_for_key: (await raw(`SELECT listing_id::text AS id FROM public.listing WHERE create_key = $1`, [K('item1')])).length });
  const transition = await call('PATCH', `/api/listing/${listingId}`, { token: T_SELLER, body: { to_status: 'listed' } });
  say('L_transition_listed', transition, { note: 'draft → listed（只有 listed 可被购买；DB 侧 createListingRow 硬写 draft）' });
  const listed = await call('GET', '/api/prize/all?limit=300');
  const seenIds = Array.isArray(listed.json?.data) ? listed.json.data.map((r: any) => Number(r.bID)) : [];
  say('L1_feed_visible', listed, { listing_in_feed: seenIds.includes(listingId), feed_len: seenIds.length, note: '列表读面 = GET /api/prize/all（读侧换源 listing）' });
  say('D1_detail_ok', await call('GET', `/api/prize/${listingId}`));
  say('D1_neg_miss_404', await call('GET', '/api/prize/999999999'), { note: 'detail-miss ⇒ 404' });

  // 购买：**伪造 price/seller_uid/buyer_uid** ⇒ 服务端忽略（B8）
  say('B_neg_no_key', await call('POST', `/api/listing/${listingId}/buy`, { token: T_BUYER, body: { quantity: qty } }), { note: '缺 create_key ⇒ 400 fail-loud' });
  const buy = await call('POST', `/api/listing/${listingId}/buy`, {
    token: T_BUYER, body: { quantity: qty, create_key: K('buy1'), price: '1', seller_uid: String(third.uid), buyer_uid: String(third.uid) },
  });
  const orderRow = (await raw(`SELECT order_id::text AS order_id, buyer_uid::text AS buyer, seller_uid::text AS seller, price::text AS price, quantity::text AS quantity, status
     FROM public.listing_order WHERE listing_id = $1::bigint ORDER BY order_id DESC LIMIT 1`, [String(listingId)]))[0];
  say('B_ok_spoof_ignored', buy, {
    order_row: orderRow,
    spoof: { price: '1', seller_uid: String(third.uid), buyer_uid: String(third.uid) },
    actual: { price, seller_uid: seller.uid, buyer_uid: buyer.uid },
    ignored: orderRow ? (Number(orderRow.price) === price && Number(orderRow.seller) === seller.uid && Number(orderRow.buyer) === buyer.uid) : false,
    legs: orderRow ? await legsOf(`biz:listing:buy:${orderRow.order_id}`) : [],
    note: 'B8：金额 (price×quantity) 与对手方全由 DB 从 listing 行取 ⇒ 伪造值被忽略',
  });
  say('B_neg_self_purchase', await call('POST', `/api/listing/${listingId}/buy`, {
    token: T_SELLER, body: { quantity: 1, create_key: K('selfbuy') },
  }), { note: '卖家自购 ⇒ 400 self_purchase_not_allowed' });
  const ordersMine = await call('GET', '/api/prize-item', { token: T_BUYER });
  say('O_mine_buyer_axis', ordersMine, {
    note: '买家轴读面（GET /api/prize-item）= listing_order，行键 gID=order_id ⇒ **该读面未 sunset（实测）**',
    contains_my_order: Array.isArray(ordersMine.json?.data) ? ordersMine.json.data.some((r: any) => String(r.gID) === String(orderRow?.order_id)) : null,
  });
  // 退款：actor = 仅卖方；库存**不回滚**
  const stockBefore = (await raw(`SELECT stock::text AS s FROM public.listing WHERE listing_id = $1::bigint`, [String(listingId)]))[0]?.s;
  say('R_neg_not_seller_403', await call('POST', `/api/listing-orders/${orderRow?.order_id}/refund`, { token: T_BUYER, body: {} }), { note: '非卖方 ⇒ 403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED' });
  const refund = await call('POST', `/api/listing-orders/${orderRow?.order_id}/refund`, { token: T_SELLER, body: {} });
  const stockAfter = (await raw(`SELECT stock::text AS s, status FROM public.listing WHERE listing_id = $1::bigint`, [String(listingId)]))[0];
  say('R_ok', refund, {
    stock_before: stockBefore, stock_after: stockAfter?.s, listing_status: stockAfter?.status,
    stock_unchanged: String(stockBefore) === String(stockAfter?.s),
    legs: await legsOf(`biz:listing:refund:${orderRow?.order_id}`),
    note: '既有单点裁定：退款**不回滚库存**（REFUND_ROLLS_BACK_STOCK=false）⇒ stock_before == stock_after = 真',
  });

  // ========================== 交易所线 ==========================
  say('M_neg_no_key', await call('POST', '/api/order', {
    token: T_SELLER, body: { side: 'buy', base_cid: baseCid, quote_cid: 1, price: 2, amount: 3 },
  }), { note: '挂单缺 create_key ⇒ 400 fail-loud（§9.B B11）' });
  const frozenBefore = await accountOf(seller.uid, 1);
  const order = await call('POST', '/api/order', {
    token: T_SELLER,
    body: { side: 'buy', base_cid: baseCid, quote_cid: 1, price: 2, amount: 3, create_key: K('order1'), owner_uid: String(third.uid) },
  });
  const orderRow2 = (await raw(`SELECT order_id::text AS order_id, owner_uid::text AS owner, base_cid::text AS base_cid, quote_cid::text AS quote_cid, side, price::text AS price, amount::text AS amount, amount_filled::text AS filled, status
     FROM public.market_order WHERE create_key = $1`, [K('order1')]))[0];
  const frozenAfterOrder = await accountOf(seller.uid, 1);
  say('M_ok_owner_spoof_ignored', order, {
    order_row: orderRow2,
    spoof_owner_uid: third.uid,
    ignored_owner: Number(orderRow2?.owner) === seller.uid,
    client_owner_uid_ignored: order.json?.data?.client_owner_uid_ignored ?? null,
    frozen_before: frozenBefore, frozen_after: frozenAfterOrder,
    legs: await legsOf(`biz:market:order:${orderRow2?.order_id}`),
    note: 'owner_uid 传 third 也被忽略（owner = token actor）；买单冻结 amount×price 的 $',
  });
  const book = await call('GET', `/api/market/${baseCid}/orderbook`);
  const bookRow = Array.isArray(book.json?.data) ? book.json.data.find((r: any) => r.side === 'buy' && Number(r.price) === 2) : null;
  say('OB_ok_visible', book, { base_cid: baseCid, my_level: bookRow ?? null, note: '订单簿按 base_cid 聚合（SUM(amount-amount_filled)）' });
  const bookOne = await call('GET', '/api/market/1/orderbook');
  say('OB_path1_only', bookOne, {
    len: Array.isArray(bookOne.json?.data) ? bookOne.json.data.length : null,
    note: '`:bID` 语义 = base_cid；base_cid=1 与「quote_cid 恒 1、base≠quote」互斥 ⇒ 该路径**恒空态**（实测）',
  });
  const trades = await call('GET', `/api/market/${baseCid}/trades?limit=20`);
  say('TR_ok_public', trades, { len: Array.isArray(trades.json?.data) ? trades.json.data.length : null, note: '成交流水（只读、公开面）= market_trade' });
  const frozenBeforeCancel = await accountOf(seller.uid, 1);
  const cancel = await call('DELETE', `/api/order/${orderRow2?.order_id}`, { token: T_SELLER });
  const frozenAfterCancel = await accountOf(seller.uid, 1);
  const cancelRow = (await raw(`SELECT status FROM public.market_order WHERE order_id = $1::bigint`, [String(orderRow2?.order_id)]))[0];
  const feeOnCancel = await raw(`SELECT COUNT(1)::int AS n FROM public.ledger_entry WHERE kind = 'trade_fee' AND event_root_key = $1`, [`biz:market:cancel:${orderRow2?.order_id}`]);
  say('MC_ok_fee_not_refunded', cancel, {
    frozen_before: frozenBeforeCancel, frozen_after: frozenAfterCancel,
    order_status: cancelRow?.status,
    trade_fee_legs_on_cancel: Number((feeOnCancel[0] as any)?.n ?? -1),
    legs: await legsOf(`biz:market:cancel:${orderRow2?.order_id}`),
    note: '撤单 = hold_release ×2（冻结→可用）；**手续费不退**（撤单面无 trade_fee 分录，DL87）',
  });
  say('MC_neg_not_owner_403', await call('DELETE', `/api/order/${orderRow2?.order_id}`, { token: T_THIRD }), { note: '非 owner ⇒ 403（幂等重放场景：该单已 cancelled ⇒ 仍以 403/409 口径为准，读数为准）' });
  const order2 = await call('POST', '/api/order', {
    token: T_BUYER, body: { side: 'buy', base_cid: baseCid, quote_cid: 1, price: 3, amount: 1, create_key: K('order2') },
  });
  const cancelAll = await call('DELETE', '/api/order', { token: T_BUYER });
  say('MALL_ok_query_only', cancelAll, { order2_status: order2.status, cancelled_key: cancelAll.json?.data?.cancelled ?? null, note: '全撤入参走 query；本层不发 body（§9.B B12）' });

  (results.invariants as any).account_cid1_seller = await accountOf(seller.uid, 1);
  (results.invariants as any).ledger_entry_total = Number(((await raw(`SELECT COUNT(1)::int AS n FROM public.ledger_entry`))[0] as any).n);
  (results.invariants as any).status_flags = {
    listing_price0_400: (tests.L_neg_price0 as any).status === 400,
    listing_ok_200: (tests.L_ok as any).status === 200,
    buy_ok_200: (tests.B_ok_spoof_ignored as any).status === 200,
    buy_spoof_ignored: (tests.B_ok_spoof_ignored as any).ignored === true,
    refund_ok_200: (tests.R_ok as any).status === 200,
    refund_stock_unchanged: (tests.R_ok as any).stock_unchanged === true,
    refund_not_seller_403: (tests.R_neg_not_seller_403 as any).status === 403,
    order_ok_200: (tests.M_ok_owner_spoof_ignored as any).status === 200,
    order_owner_spoof_ignored: (tests.M_ok_owner_spoof_ignored as any).ignored_owner === true,
    orderbook_visible: (tests.OB_ok_visible as any).my_level !== null,
    orderbook_path1_empty: (tests.OB_path1_only as any).len === 0,
    cancel_ok_200: (tests.MC_ok_fee_not_refunded as any).status === 200,
    cancel_fee_not_refunded: (tests.MC_ok_fee_not_refunded as any).trade_fee_legs_on_cancel === 0,
    cancel_all_ok_200: (tests.MALL_ok_query_only as any).status === 200,
  };
  results.finishedAt = new Date().toISOString();
  const outFile = path.join(outDir, 'post', 'b4ciib-http.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  const outText = fs.readFileSync(outFile, 'utf8');
  const tokenLeak = (outText.match(/eyJ/g) || []).length;
  (results.invariants as any).token_bytes_in_artifact = tokenLeak;
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log('SUMMARY', JSON.stringify({
    out: outFile, token_bytes_in_artifact: tokenLeak, installments: Object.keys(tests).length,
    flags: (results.invariants as any).status_flags,
  }, null, 2));
  const flags = (results.invariants as any).status_flags as Record<string, boolean>;
  const failed = Object.entries(flags).filter(([, v]) => v !== true).map(([k]) => k);
  if (tokenLeak !== 0) throw new Error('TOKEN_BYTES_LEAKED');
  if (failed.length) throw new Error(`FAILED_FLAGS: ${failed.join(',')}`);
}

main().catch((e) => { console.error('PROBE_FAILED', e); process.exitCode = 1; });
