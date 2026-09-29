/*
 * p4z-b3e-02-e2e.ts — P4-B3e 交易所资金端到端（M1 挂单 / M2 撤单 / M3 成交 + 逐腿取证 + 幂等重投 + 负例 + 并发）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3e-02-e2e.ts <runDirAbsOrRel>
 * 口径：
 *   ① 真 token = `.env.local` 的 `SECRET_KEY`（本脚本现取；密钥本体不落盘，只记 12 位指纹）
 *   ② **HTTP 面**（已注册路径）= `POST /api/order`（M1）/ `DELETE /api/order/:oID`（M2）/ `DELETE /api/order`（M2 全撤）
 *      **服务层面**（本片不注册，路由随批 4）= `matchMarketOrders`（M3，与批 4 路由将复用的同一函数）
 *   ③ 资金写入唯一路径 = DB `public.market_post_event`；产物零 token 字节（`eyJ` 计数须为 0）
 *   ④ 退出码直接取（不经管道）；**无删除型 SQL**（夹具只增不减）
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { matchMarketOrders } from '../src/market-service';
import { ensureUser, fundFromResidual, ledgerPostEvent, raw, raw1, mkPool, errInfo } from './p3j-lib';

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });
const RUN = path.basename(outDir);
const TAG = `p4b3e${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const KEYS = (s: string) => `cli:${TAG}:${s}`;

const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: string, evm: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', SECRET).update(unsigned).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, {
      method, headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return { status: res.status, json, body_head: text.slice(0, 300) };
  } catch (e) {
    return { status: 'NETERR' as unknown as number, json: null, body_head: String(e).slice(0, 200) };
  }
};

const legs = async (pool: any, key: string) => raw<Record<string, unknown>>(pool,
  `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
          frozen_delta::text AS frozen_delta, balance_after::text AS balance_after,
          frozen_after::text AS frozen_after, kind, ref_type, ref_id::text AS ref_id,
          event_root_key, idempotency_key
     FROM public.ledger_entry WHERE event_root_key = $1::text ORDER BY txid`, [key]);

const legCheck = (rows: Array<Record<string, unknown>>) => {
  const sd = rows.reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  const sf = rows.reduce((a, r) => a + BigInt(String(r.frozen_delta)), 0n);
  return {
    n: rows.length,
    kinds: rows.map((r) => String(r.kind)),
    legs: rows.map((r) => ({
      txid: String(r.txid), uid: String(r.uid), cid: String(r.cid), delta: String(r.delta),
      frozen_delta: String(r.frozen_delta), kind: String(r.kind), ref_type: String(r.ref_type),
      ref_id: String(r.ref_id), idempotency_key: String(r.idempotency_key),
    })),
    sum_delta: sd.toString(),
    sum_frozen_delta: sf.toString(),
    sum_delta_plus_frozen: (sd + sf).toString(),
    pure_transfer: sd + sf === 0n,
    no_frozen_movement: sf === 0n,
    frozen_legs_are_balance_pair: rows.filter((r) => String(r.frozen_delta) !== '0').length ===
      rows.filter((r) => String(r.delta) !== '0').length,
  };
};

const acctOf = async (pool: any, uid: string, cid: string) => raw1<Record<string, unknown>>(pool,
  `SELECT balance::text AS balance, frozen::text AS frozen, (balance + frozen)::text AS total
     FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint`, [uid, cid]);
const orderOf = async (pool: any, id: number) => raw1<Record<string, unknown>>(pool,
  `SELECT order_id::text AS order_id, owner_uid::text AS owner_uid, side, base_cid::text AS base_cid,
          price::text AS price, amount::text AS amount, amount_filled::text AS amount_filled, status,
          ledger_event_keys
     FROM public.market_order WHERE order_id = $1::bigint`, [id]);
const marketCounts = async (pool: any) => raw1<Record<string, unknown>>(pool,
  `SELECT (SELECT COUNT(1)::int FROM public.market_order) AS orders,
          (SELECT COUNT(1)::int FROM public.market_trade) AS trades,
          (SELECT COUNT(1)::int FROM public.ledger_entry WHERE kind='hold') AS hold_n,
          (SELECT COUNT(1)::int FROM public.ledger_entry WHERE kind='hold_release') AS hold_release_n,
          (SELECT COUNT(1)::int FROM public.ledger_entry WHERE kind='trade') AS trade_n,
          (SELECT COUNT(1)::int FROM public.ledger_entry WHERE kind='trade_fee') AS trade_fee_n`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const R: Array<Record<string, unknown>> = [];
const rec = (id: string, name: string, extra: Record<string, unknown>) => {
  R.push({ id, name, ...extra });
  const brief = extra.status !== undefined ? extra.status : extra.ok !== undefined ? String(extra.ok) : '';
  console.log(`[${id}] ${name} => ${brief} ${extra.code ? String(extra.code) : ''} ${extra.reason ? String(extra.reason) : ''}`);
};

async function main() {
  const pool = mkPool(3);
  const out: Record<string, unknown> = {
    run: RUN, at: new Date().toISOString(), probe: 'p4z-b3e-02-e2e', base: BASE,
    token_fingerprint: fp(SECRET), tag: TAG,
  };

  // ---------------------------------------------------------------- 夹具（只增不减）
  const seller = await raw1<{ uid: string; evm: string }>(pool,
    `SELECT uid::text AS uid, evm FROM public.users WHERE uid = 970001::bigint`);
  if (!seller) throw new Error('seller 970001 not found');
  const buy1 = await ensureUser(pool, `p4b3e-buyer1-${RUN}`);
  const buy2 = await ensureUser(pool, `p4b3e-buyer2-${RUN}`);
  const fund1 = await fundFromResidual(pool, buy1, 40000n);
  const fund2 = await fundFromResidual(pool, buy2, 40000n);

  const mintBase: Record<string, unknown> = {};
  for (const [cid, amount] of [['4', '100'], ['16', '100']] as Array<[string, string]>) {
    try {
      const r = await ledgerPostEvent(pool, {
        op: 'mint', uid: seller.uid, cid, amount,
        idempotency_key: `ops:${TAG}:mint:${cid}:${seller.uid}`,
        request_fingerprint: `mint:${cid}:${seller.uid}:${amount}`,
      });
      mintBase[cid] = { ok: true, txid: r.txid, idempotent_replay: r.idempotent_replay === true };
    } catch (e) { mintBase[cid] = { ok: false, err: errInfo(e) }; }
  }
  out.fixtures = {
    seller, buy1, buy2,
    funds: { buy1: fund1, buy2: fund2 },
    mint_base: mintBase,
    balances_after_fixture: {
      [`seller:1`]: await acctOf(pool, seller.uid, '1'), [`seller:4`]: await acctOf(pool, seller.uid, '4'),
      [`seller:16`]: await acctOf(pool, seller.uid, '16'),
      [`buy1:1`]: await acctOf(pool, buy1, '1'), [`buy2:1`]: await acctOf(pool, buy2, '1'),
    },
    counts_before: await marketCounts(pool),
  };
  const evmOf = async (uid: string) => {
    const r = await raw1<{ evm: string }>(pool, `SELECT evm FROM public.users WHERE uid = $1::bigint`, [uid]);
    if (!r) throw new Error(`no evm for uid ${uid}`);
    return String(r.evm);
  };
  const tok = {
    seller: jwt(seller.uid, seller.evm),
    buy1: jwt(buy1, await evmOf(buy1)),
    buy2: jwt(buy2, await evmOf(buy2)),
  };

  // ---------------------------------------------------------------- T01 M1 挂单（买单）
  const body01 = { bID: 4, side: 'buy', price: 1000, volume: 5, create_key: KEYS('buy1') };
  const t01 = await call('POST', '/api/order', { token: tok.buy1, body: body01 });
  const order01 = Number(t01.json?.data?.order_id ?? 0);
  rec('T01', 'M1 挂单（买 1 手 @1000×5）', {
    status: t01.status, code: t01.json?.error?.code ?? null, order_id: order01,
    view: t01.json?.data ?? null, body_head: t01.body_head,
  });
  const legs01 = t01.json?.data?.ledger_idempotency_key ? await legs(pool, String(t01.json.data.ledger_idempotency_key)) : [];
  rec('T01-legs', 'M1 hold ×2 逐腿', { key: t01.json?.data?.ledger_idempotency_key ?? null, ...legCheck(legs01) });
  const acctAfter01 = { buy1_1: await acctOf(pool, buy1, '1'), order01: await orderOf(pool, order01) };

  // ---------------------------------------------------------------- T02 幂等重投（同键同内容）
  const t02 = await call('POST', '/api/order', { token: tok.buy1, body: body01 });
  rec('T02', 'M1 幂等重投（同键同内容 ⇒ 200 replay / 零新增分录）', {
    status: t02.status, code: t02.json?.error?.code ?? null,
    idempotent_replay_top: t02.json?.idempotent_replay ?? null,
    entries_n: Array.isArray(t02.json?.data?.entries) ? t02.json.data.entries.length : null,
    order_id: t02.json?.data?.order_id ?? null, body_head: t02.body_head,
  });

  // ---------------------------------------------------------------- T03 同键异内容
  const t03 = await call('POST', '/api/order', { token: tok.buy1, body: { ...body01, volume: 6 } });
  rec('T03', 'M1 同键异内容 ⇒ 409（响亮拒绝）', {
    status: t03.status, code: t03.json?.error?.code ?? null, reason: t03.json?.error?.details?.reason ?? null,
    details: t03.json?.error?.details ?? null,
  });

  // ---------------------------------------------------------------- T04 缺键（旧前端形状）fail-loud
  const frontendBody = { bID: 4, side: 'buy', price: 1000, volume: 1 };
  const t04 = await call('POST', '/api/order', { token: tok.buy1, body: frontendBody });
  rec('T04', 'M1 缺 create_key（= 旧前端 `ShardPage.jsx:176` 形状）⇒ 400 fail-loud', {
    status: t04.status, code: t04.json?.error?.code ?? null, body_head: t04.body_head,
  });

  // ---------------------------------------------------------------- T05 M1 挂单（卖单，冻结 base）
  const t05 = await call('POST', '/api/order', { token: tok.seller, body: { bID: 4, side: 'sell', price: 1000, volume: 4, create_key: KEYS('sell1') } });
  const orderSell1 = Number(t05.json?.data?.order_id ?? 0);
  rec('T05', 'M1 挂单（卖 1 手 @1000×4，冻结 base cid4）', {
    status: t05.status, code: t05.json?.error?.code ?? null, order_id: orderSell1, view: t05.json?.data ?? null,
  });
  const legs05 = t05.json?.data?.ledger_idempotency_key ? await legs(pool, String(t05.json.data.ledger_idempotency_key)) : [];
  rec('T05-legs', 'M1 卖单 hold ×2 逐腿（同 uid 同 cid=4）', { key: t05.json?.data?.ledger_idempotency_key ?? null, ...legCheck(legs05) });

  // ---------------------------------------------------------------- T06 M3 部分成交（taker = 买单）
  const t06 = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(order01), amount: '3', fill_no: '1', price: '1', buy_order_id: '1', sell_order_id: '1', fee: '0' } });
  rec('T06', 'M3 部分成交（taker=买单×3 @1000；客户端 price/对手方/fee 全丢弃）', {
    ok: t06.ok, status: t06.ok ? 200 : t06.status, code: t06.ok ? null : t06.code,
    view: t06.ok ? t06.view : null, err: t06.ok ? null : t06.details,
  });
  const tradeKey06 = t06.ok ? String(t06.view.ledger_idempotency_key) : '';
  const legs06 = tradeKey06 ? await legs(pool, tradeKey06) : [];
  rec('T06-legs', 'M3 `trade`×4 + `trade_fee`×2 逐腿', { key: tradeKey06, ...legCheck(legs06) });

  // ---------------------------------------------------------------- T06b 幂等重投（同 taker + 同 fill_no ⇒ 同键）
  const t06b = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(order01), amount: '3', fill_no: '1' } });
  rec('T06b', 'M3 幂等重投（同 taker+fill_no ⇒ 200 replay / 零新增分录）', {
    ok: t06b.ok, status: t06b.ok ? 200 : t06b.status, code: t06b.ok ? null : t06b.code,
    replay: t06b.ok ? t06b.replay : null,
    entries_n: t06b.ok && Array.isArray(t06b.view.entries) ? (t06b.view.entries as unknown[]).length : null,
  });

  // ---------------------------------------------------------------- T07 M3 全额成交（taker = 卖单 ⇒ 该单 filled）
  const t07 = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(orderSell1), amount: '1', fill_no: '1' } });
  rec('T07', 'M3 全额成交（taker=卖单余量 1 ⇒ 卖单 filled）', {
    ok: t07.ok, status: t07.ok ? 200 : t07.status, code: t07.ok ? null : t07.code,
    view: t07.ok ? { order_status: t07.view.order_status, amount_filled: t07.view.amount_filled, fee: t07.view.fee, trade_id: t07.view.trade_id } : null,
    err: t07.ok ? null : t07.details, sell_order_after: await orderOf(pool, orderSell1),
  });

  // ---------------------------------------------------------------- T08 自成交
  const t08a = await call('POST', '/api/order', { token: tok.seller, body: { bID: 4, side: 'buy', price: 1000, volume: 1, create_key: KEYS('selfbuy') } });
  const t08b = await call('POST', '/api/order', { token: tok.seller, body: { bID: 4, side: 'sell', price: 1000, volume: 1, create_key: KEYS('selfsell') } });
  const selfBuy = Number(t08a.json?.data?.order_id ?? 0);
  const selfSell = Number(t08b.json?.data?.order_id ?? 0);
  const t08 = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(selfBuy), amount: '1', fill_no: '1' } });
  rec('T08', 'M3 自成交（同 owner 买卖对）⇒ 拒（DB `self_trade_not_allowed`）', {
    ok: t08.ok, status: t08.ok ? 200 : t08.status, code: t08.ok ? null : t08.code,
    err: t08.ok ? null : t08.details,
    orders: { selfbuy: { status: t08a.status, id: selfBuy }, selfsell: { status: t08b.status, id: selfSell } },
  });

  // ---------------------------------------------------------------- T09 持仓不足（卖单冻结 base）
  const t09 = await call('POST', '/api/order', { token: tok.buy2, body: { bID: 4, side: 'sell', price: 1000, volume: 1, create_key: KEYS('sell_nobase') } });
  rec('T09', 'M1 卖出无持仓（buy2 无 cid4）⇒ 409 余额/持仓不足', {
    status: t09.status, code: t09.json?.error?.code ?? null, reason: t09.json?.error?.details?.reason ?? null,
    details: t09.json?.error?.details ?? null,
  });

  // ---------------------------------------------------------------- T10 M3 成交量 > 余量
  const t10 = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(selfSell), amount: '5', fill_no: '2' } });
  rec('T10', 'M3 成交量 > 对手余量 ⇒ 409 `market_order_amount_insufficient`', {
    ok: t10.ok, status: t10.ok ? 200 : t10.status, code: t10.ok ? null : t10.code,
    err: t10.ok ? null : t10.details,
  });

  // ---------------------------------------------------------------- T11 M3 缺 fill_no（D-1 fail-loud）
  const t11 = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(selfSell), amount: '1' } });
  rec('T11', 'M3 缺 `fill_no`（D-1 fail-loud）⇒ 400 `FILL_NO_REQUIRED`', {
    ok: t11.ok, status: t11.ok ? 200 : t11.status, code: t11.ok ? null : t11.code,
    err: t11.ok ? null : t11.details,
  });

  // ---------------------------------------------------------------- T12 M3 未知 taker id
  const t12 = await matchMarketOrders({ actorUid: null, body: { taker_order_id: '99999999', amount: '1', fill_no: '1' } });
  rec('T12', 'M3 未知 taker_order_id ⇒ 404 `order_not_found`', {
    ok: t12.ok, status: t12.ok ? 200 : t12.status, code: t12.ok ? null : t12.code, err: t12.ok ? null : t12.details,
  });

  // ---------------------------------------------------------------- T13 M2 单撤（剩余释放 + 手续费不可退）
  const countsBeforeCancel = await marketCounts(pool);
  const t13 = await call('DELETE', `/api/order/${order01}`, { token: tok.buy1 });
  const legs13 = t13.json?.data?.ledger_idempotency_key ? await legs(pool, String(t13.json.data.ledger_idempotency_key)) : [];
  const countsAfterCancel = await marketCounts(pool);
  rec('T13', 'M2 单撤（买 1 手剩余 (5−4)×1000=1000 释放；手续费不退）', {
    status: t13.status, code: t13.json?.error?.code ?? null, view: t13.json?.data ?? null,
    legs: legCheck(legs13), counts_before: countsBeforeCancel, counts_after: countsAfterCancel,
    trade_fee_delta: Number(countsAfterCancel?.trade_fee_n) - Number(countsBeforeCancel?.trade_fee_n),
    order_after: await orderOf(pool, order01),
    acct_buy1_1_after: await acctOf(pool, buy1, '1'),
  });

  // ---------------------------------------------------------------- T14 M2 重投（同 order_id ⇒ 同键 ⇒ replay）
  const t14 = await call('DELETE', `/api/order/${order01}`, { token: tok.buy1 });
  rec('T14', 'M2 幂等重投（同 order_id ⇒ 200 replay）', {
    status: t14.status, code: t14.json?.error?.code ?? null,
    idempotent_replay_top: t14.json?.idempotent_replay ?? null, body_head: t14.body_head,
  });

  // ---------------------------------------------------------------- T15 M2 授权（非 owner）
  const t15 = await call('DELETE', `/api/order/${selfBuy}`, { token: tok.buy2 });
  rec('T15', 'M2 越权撤单（buy2 撤 seller 的单）⇒ 403 `ACTOR_NOT_ALLOWED`', {
    status: t15.status, code: t15.json?.error?.code ?? null, reason: t15.json?.error?.details?.reason ?? null,
  });

  // ---------------------------------------------------------------- T16 M2 未知 id / 非数字 id
  const t16a = await call('DELETE', '/api/order/99999999', { token: tok.buy1 });
  const t16b = await call('DELETE', '/api/order/abc', { token: tok.buy1 });
  rec('T16', 'M2 未知 id / 非数字 id ⇒ 404 + `{ref_type,ref_id,reason}`', {
    unknown: { status: t16a.status, code: t16a.json?.error?.code ?? null, details: t16a.json?.error?.details ?? null },
    nan: { status: t16b.status, code: t16b.json?.error?.code ?? null, details: t16b.json?.error?.details ?? null },
  });

  // ---------------------------------------------------------------- T17 M2 全撤（query 式、逐单）
  const openBefore17 = await raw<{ order_id: string }>(pool,
    `SELECT order_id::text AS order_id FROM public.market_order
      WHERE owner_uid = $1::bigint AND status IN ('open','partial') ORDER BY order_id`, [seller.uid]);
  const t17 = await call('DELETE', '/api/order', { token: tok.seller, body: {} });
  rec('T17', 'M2 全撤（`DELETE /api/order`，入参走 query ⇒ 逐单 op=cancel）', {
    status: t17.status, code: t17.json?.error?.code ?? null,
    cancelled: t17.json?.data?.cancelled ?? null, attempted: t17.json?.data?.attempted ?? null,
    open_before: openBefore17.map((o) => String(o.order_id)), orders: t17.json?.data?.orders ?? null,
    body_read_ignored: true,
  });

  // ---------------------------------------------------------------- 并发 A：同币对两笔并发成交（串行化、无超额成交）
  const cCid = '16';
  const mk = async (token: string, side: string, amount: number, salt: string, cid = cCid, price = 100) =>
    call('POST', '/api/order', { token, body: { bID: Number(cid), side, price, volume: amount, create_key: KEYS(salt) } });
  const cSell = await mk(tok.seller, 'sell', 1, `c16sell`);
  const cBuyA = await mk(tok.buy2, 'buy', 1, `c16buyA`);
  const cBuyB = await mk(tok.buy1, 'buy', 1, `c16buyB`);
  const cSellId = Number(cSell.json?.data?.order_id ?? 0);
  const cBuyAId = Number(cBuyA.json?.data?.order_id ?? 0);
  const cBuyBId = Number(cBuyB.json?.data?.order_id ?? 0);
  const [rcA, rcB] = await Promise.all([
    matchMarketOrders({ actorUid: null, body: { taker_order_id: String(cBuyAId), amount: '1', fill_no: '1' } }),
    matchMarketOrders({ actorUid: null, body: { taker_order_id: String(cBuyBId), amount: '1', fill_no: '1' } }),
  ]);
  const cSellAfter = await orderOf(pool, cSellId);
  const oversell = BigInt(String(cSellAfter?.amount_filled)) > BigInt(String(cSellAfter?.amount));
  rec('P1', '同币对（base=16）两笔并发成交 ⇒ 串行：恰 1 成功 / 另 1 被拒；无超额成交', {
    fixture: { sell: { status: cSell.status, id: cSellId }, buyA: { status: cBuyA.status, id: cBuyAId }, buyB: { status: cBuyB.status, id: cBuyBId } },
    A: { ok: rcA.ok, status: rcA.ok ? 200 : rcA.status, code: rcA.ok ? null : rcA.code, reason: rcA.ok ? null : (rcA.details as any)?.reason ?? null },
    B: { ok: rcB.ok, status: rcB.ok ? 200 : rcB.status, code: rcB.ok ? null : rcB.code, reason: rcB.ok ? null : (rcB.details as any)?.reason ?? null },
    successes: (rcA.ok ? 1 : 0) + (rcB.ok ? 1 : 0),
    sell_after: cSellAfter, oversell,
  });

  // ---------------------------------------------------------------- 并发 B：币对锁占位探针（同币对阻塞 / 异币对不阻塞）
  const lSell = await mk(tok.seller, 'sell', 1, 'lockSell4', '4', 1000);
  const lBuy4 = await mk(tok.buy2, 'buy', 1, 'lockBuy4', '4', 1000);
  const lSell16 = await mk(tok.seller, 'sell', 1, 'lockSell16', '16', 100);
  const lBuy16 = await mk(tok.buy1, 'buy', 1, 'lockBuy16', '16', 100);
  const lSellId = Number(lSell.json?.data?.order_id ?? 0);
  const lBuy4Id = Number(lBuy4.json?.data?.order_id ?? 0);
  const lBuy16Id = Number(lBuy16.json?.data?.order_id ?? 0);
  const holderHoldMs = 1500;
  const holder = (async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock($1::int4, $2::int4)', [4, 1]);
      await sleep(holderHoldMs);
      await c.query('COMMIT');
      return { ok: true };
    } catch (e) { try { await c.query('ROLLBACK'); } catch { /* noop */ } return { ok: false, err: errInfo(e) }; }
    finally { c.release(); }
  })();
  await sleep(300);
  const tA = Date.now();
  const samePair = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(lBuy4Id), amount: '1', fill_no: '1' } });
  const samePairMs = Date.now() - tA;
  const tB = Date.now();
  const otherPair = await matchMarketOrders({ actorUid: null, body: { taker_order_id: String(lBuy16Id), amount: '1', fill_no: '1' } });
  const otherPairMs = Date.now() - tB;
  const holderRes = await holder;
  rec('P2', '★ 币对锁占位（同币对 (4,1) 持锁 1.5s）⇒ 同币对**阻塞** / 异币对 (16,1) 不阻塞', {
    holder: holderRes, holder_hold_ms: holderHoldMs,
    same_pair: { ok: samePair.ok, status: samePair.ok ? 200 : samePair.status, code: samePair.ok ? null : (samePair as any).code, elapsed_ms: samePairMs },
    other_pair: { ok: otherPair.ok, status: otherPair.ok ? 200 : otherPair.status, code: otherPair.ok ? null : (otherPair as any).code, elapsed_ms: otherPairMs },
    blocked_assert: samePairMs >= holderHoldMs - 500,
    order_pair_locks: { lock: 'pg_advisory_xact_lock(base_cid::int4, quote_cid::int4)', holder_keys: [4, 1] },
    targets_after: { sell4: await orderOf(pool, lSellId), buy4: await orderOf(pool, lBuy4Id), buy16: await orderOf(pool, lBuy16Id) },
  });

  // ---------------------------------------------------------------- 收尾读数
  out.results = R;
  out.counts_after = await marketCounts(pool);
  out.balances_after = {
    seller_1: await acctOf(pool, seller.uid, '1'), seller_4: await acctOf(pool, seller.uid, '4'),
    seller_16: await acctOf(pool, seller.uid, '16'), buy1_1: await acctOf(pool, buy1, '1'),
    buy2_1: await acctOf(pool, buy2, '1'), buy1_16: await acctOf(pool, buy1, '16'),
    buy2_16: await acctOf(pool, buy2, '16'), minus1_1: await acctOf(pool, '-1', '1'),
  };
  out.all_my_orders = await raw(pool,
    `SELECT order_id::text AS order_id, owner_uid::text AS owner_uid, side, base_cid::text AS base_cid,
            price::text AS price, amount::text AS amount, amount_filled::text AS amount_filled, status, create_key
       FROM public.market_order WHERE create_key LIKE $1::text ORDER BY order_id`, [`cli:${TAG}:%`]);
  out.all_market_trades = await raw(pool,
    `SELECT trade_id::text AS trade_id, base_cid::text AS base_cid, price::text AS price, amount::text AS amount,
            buy_order_id::text AS buy_order_id, sell_order_id::text AS sell_order_id, taker_uid::text AS taker_uid,
            fee::text AS fee FROM public.market_trade ORDER BY trade_id`);
  out.trade_fee_legs = await raw(pool,
    `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta, kind, ref_type,
            ref_id::text AS ref_id, idempotency_key
       FROM public.ledger_entry WHERE kind IN ('trade_fee') ORDER BY txid`);
  out.double_three_checks = await raw1(pool,
    `SELECT COUNT(1)::int AS n FROM public.account WHERE balance < 0 OR frozen < 0`);

  const file = path.join(outDir, `b3e-02-e2e.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('WROTE ' + file);
  console.log('counts_after=' + JSON.stringify(out.counts_after));
  console.log('trades=' + JSON.stringify(out.all_market_trades));
  await pool.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e) + ' | ' + JSON.stringify(errInfo(e))); process.exit(1); });
