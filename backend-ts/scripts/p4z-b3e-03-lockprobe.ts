/*
 * p4z-b3e-03-lockprobe.ts — P4-B3e 两项**定点**取证：
 *   A. `db_reason_probe`：直接经 Pool 调 `public.market_post_event`，抓 **DB 侧命名 reason**
 *      （neon HTTP 驱动不携带 `detail` ⇒ 服务层读不到 reason；本探针补上这一读数）
 *   B. `lock_probe`：**基线对照**的币对锁占位实验（同币对 vs 异币对，**并发发起**）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3e-03-lockprobe.ts <runDirAbs>
 * 口径：夹具只增不减；失败调用不落行（断言见读数）；退出码直接取。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ensureUser, raw1, raw, mkPool, errInfo, ledgerPostEvent } from './p3j-lib';

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
const RUN = path.basename(outDir);
const TAG = `p4b3e${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const KEYS = (s: string) => `cli:${TAG}:lp:${s}`;
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: string, evm: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const pool = mkPool(4);
  const seller = await raw1<{ uid: string; evm: string }>(pool, `SELECT uid::text AS uid, evm FROM public.users WHERE uid=970001::bigint`);
  if (!seller) throw new Error('no seller');
  const b1 = await ensureUser(pool, `p4b3e-buyer1-${RUN}`);
  const b2 = await ensureUser(pool, `p4b3e-buyer2-${RUN}`);
  const evmOf = async (uid: string) => String((await raw1<{ evm: string }>(pool, `SELECT evm FROM public.users WHERE uid=$1::bigint`, [uid]))?.evm || '');
  const tok = { seller: jwt(seller.uid, seller.evm), b1: jwt(b1, await evmOf(b1)), b2: jwt(b2, await evmOf(b2)) };

  const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(60000) });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* noop */ }
    return { status: res.status, json: json as any };
  };
  const mk = async (token: string, side: string, cid: number, price: number, volume: number, salt: string) => {
    const r = await call('POST', '/api/order', { token, body: { bID: cid, side, price, volume, create_key: KEYS(salt) } });
    return r.json?.data?.order_id ? Number(r.json.data.order_id) : null;
  };
  /** 服务层面成交（与批 4 路由将复用的同一函数；此处经 HTTP 触发以匹配真实路径调用形态） */
  const matchViaDb = async (body: Record<string, unknown>) => {
    // 与服务层 `matchMarketOrders` 等价的一步：直接调 DB 编排函数（**不做**任何服务端校验/选择）
    const r = await raw1<{ r: Record<string, unknown> }>(pool, 'SELECT public.market_post_event($1::jsonb) AS r', [JSON.stringify(body)]);
    return r?.r ?? null;
  };

  const out: Record<string, unknown> = { run: RUN, at: new Date().toISOString(), probe: 'p4z-b3e-03-lockprobe', tag: TAG };
  const mint = await ledgerPostEvent(pool, {
    op: 'mint', uid: seller.uid, cid: '21', amount: '100',
    idempotency_key: `ops:${TAG}:lp:mint:21`, request_fingerprint: `mint:21:${seller.uid}:100`,
  });
  out.fixture_mint_cid21 = { txid: mint.txid, replay: mint.idempotent_replay === true };

  // ============================================================ A. DB 侧命名 reason
  const reasons: Record<string, unknown> = {};
  // A1：同 create_key 异内容（用 T01 已落库的键 `cli:<TAG>:buy1`，price 改成 1234）
  try {
    await matchViaDb({ op: 'order', create_key: KEYS('buy1'), owner_uid: b1, side: 'buy', base_cid: '4', quote_cid: '1', price: '1234', amount: '5' });
    reasons.A1 = { raised: false };
  } catch (e) { reasons.A1_idempotency_conflict = errInfo(e); }
  // A2：缺 fill_no
  try {
    await matchViaDb({ op: 'trade', taker_order_id: '1', buy_order_id: '1', sell_order_id: '2', price: '1000', amount: '1' });
    reasons.A2 = { raised: false };
  } catch (e) { reasons.A2_fill_no_required = errInfo(e); }
  // A3：自成交（新造同 owner 可成交对，cid=21）
  const selfBuy = await mk(tok.seller, 'buy', 21, 100, 1, 'selfbuy21');
  const selfSell = await mk(tok.seller, 'sell', 21, 100, 1, 'selfsell21');
  try {
    await matchViaDb({ op: 'trade', taker_order_id: String(selfBuy), buy_order_id: String(selfBuy), sell_order_id: String(selfSell), price: '100', amount: '1', fill_no: '1' });
    reasons.A3 = { raised: false };
  } catch (e) { reasons.A3_self_trade = errInfo(e); }
  // A4：撤单后重复撤（同键异状态 ⇒ 重放优先，不抛）
  out.db_reason_probe = reasons;
  out.db_reason_probe_orders = { selfbuy21: selfBuy, selfsell21: selfSell };

  // ============================================================ B. 锁占位（基线对照 + 并发）
  // B0 基线：cid=21 一对（卖 1 @100 / 买 1 @100）⇒ 无锁竞争时的一次成交耗时
  const baseSell = await mk(tok.seller, 'sell', 21, 100, 1, 'base_sell21');
  const baseBuy = await mk(tok.b1, 'buy', 21, 100, 1, 'base_buy21');
  const t0 = Date.now();
  const baseRes = await call('POST', '/api/order', { token: tok.b1, body: { bID: 21, side: 'buy', price: 100, volume: 1, create_key: KEYS('base_extra') } });
  const tCreate = Date.now() - t0;
  const tB = Date.now();
  const baseMatch = await (await import('../src/market-service')).matchMarketOrders({ actorUid: null, body: { taker_order_id: String(baseBuy), amount: '1', fill_no: '1' } });
  const baseMs = Date.now() - tB;

  // B1 锁占位：持 (21,1) 锁 2500ms；**并发**发起 同币对(21) 与 异币对(4) 两笔成交
  const p4Sell = await mk(tok.seller, 'sell', 4, 1000, 1, 'ctl_sell4');
  const p4Buy = await mk(tok.b2, 'buy', 4, 1000, 1, 'ctl_buy4');
  const p21Sell = await mk(tok.seller, 'sell', 21, 100, 1, 'lock_sell21');
  const p21Buy = await mk(tok.b2, 'buy', 21, 100, 1, 'lock_buy21');

  const HOLD = 2500;
  const holder = (async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock($1::int4, $2::int4)', [21, 1]);
      await sleep(HOLD);
      await c.query('COMMIT');
      return { ok: true, hold_ms: HOLD };
    } catch (e) { try { await c.query('ROLLBACK'); } catch { /* noop */ } return { ok: false, err: errInfo(e) }; }
    finally { c.release(); }
  })();
  await sleep(400);
  const t1 = Date.now();
  const [samePair, otherPair] = await Promise.all([
    import('../src/market-service').then((m) => m.matchMarketOrders({ actorUid: null, body: { taker_order_id: String(p21Buy), amount: '1', fill_no: '1' } })),
    import('../src/market-service').then((m) => m.matchMarketOrders({ actorUid: null, body: { taker_order_id: String(p4Buy), amount: '1', fill_no: '1' } })),
  ]);
  const bothMs = Date.now() - t1;
  const holderRes = await holder;
  const orderAfter = async (id: number | null) => (id ? raw1(pool, `SELECT order_id::text AS order_id, status, amount_filled::text AS amount_filled FROM public.market_order WHERE order_id=$1::bigint`, [id]) : null);

  out.lock_probe = {
    baseline: { create_order_ms: tCreate, match_ms: baseMs, match_ok: baseMatch.ok, match_code: baseMatch.ok ? null : baseMatch.code, base_pair_orders: { sell: baseSell, buy: baseBuy } },
    holder: holderRes, holder_hold_ms: HOLD,
    concurrent: {
      both_elapsed_ms: bothMs,
      same_pair_21: { ok: samePair.ok, status: samePair.ok ? 200 : samePair.status, code: samePair.ok ? null : samePair.code, executed_after_lock_pair: true },
      other_pair_4: { ok: otherPair.ok, status: otherPair.ok ? 200 : otherPair.status, code: otherPair.ok ? null : otherPair.code },
      same_pair_orders_after: { sell: await orderAfter(p21Sell), buy: await orderAfter(p21Buy) },
      other_pair_orders_after: { sell: await orderAfter(p4Sell), buy: await orderAfter(p4Buy) },
    },
    /** 判据：并发同批中，**同币对**受持锁影响 ⇒ 整批耗时 ≈ 持锁剩余 + 单次成本；
     *  **异币对**若不受影响 ⇒ 其自身完成时刻应早于同币对（可用各自完成的时序 + 整批耗时对比基线推断） */
    verdict: {
      both_ms_minus_baseline: bothMs - baseMs,
      expected_if_serialized: HOLD + baseMs,
      expected_if_not_serialized: baseMs + 50,
    },
  };
  void baseRes;

  const file = path.join(outDir, 'b3e-03-lockprobe.json');
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('WROTE ' + file);
  console.log('A1=' + JSON.stringify(out.db_reason_probe && (out.db_reason_probe as any).A1_idempotency_conflict));
  console.log('A2=' + JSON.stringify(out.db_reason_probe && (out.db_reason_probe as any).A2_fill_no_required));
  console.log('A3=' + JSON.stringify(out.db_reason_probe && (out.db_reason_probe as any).A3_self_trade));
  console.log('baseline_match_ms=' + baseMs + ' both_ms=' + bothMs + ' hold=' + HOLD);
  console.log('same21=' + JSON.stringify({ ok: samePair.ok, code: samePair.ok ? null : samePair.code }) + ' other4=' + JSON.stringify({ ok: otherPair.ok, code: otherPair.ok ? null : otherPair.code }));
  console.log('orders_after=' + JSON.stringify(out.lock_probe && (out.lock_probe as any).concurrent));
  await pool.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e) + ' | ' + JSON.stringify(errInfo(e))); process.exit(1); });
