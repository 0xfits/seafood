/*
 * p4z-b3d-02-e2e.ts — P4-B3d 商品资金端到端（P2 购买 / P4 退款 + 逐腿取证 + 幂等重投 + 负例）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3d-02-e2e.ts <runDirAbsOrRel>
 * 口径：
 *   ① 真 token = `.env.local` 的 `SECRET_KEY`（本脚本现取取证；密钥本体不落盘，只记指纹）
 *   ② 两条目标路径（`POST /api/listing/:id/buy`、`POST /api/listing/order/:id/refund`）**本片不注册**
 *      ⇒ HTTP 面预期 **404**（实测记录）；资金写入走**服务层 verb**（= 批 4 路由将复用的同一函数）
 *   ③ 资金写入唯一路径 = DB `public.listing_post_event`；产物零 token/密钥字节（`eyJ` 计数须为 0）
 *   ④ 退出码直接取（不经管道）
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buyListing, refundListingOrder } from '../src/listing-funds-service';
import { ensureUser, fundFromResidual, raw, raw1, mkPool } from './p3j-lib';

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });
const RUN = path.basename(outDir);

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const mint = (uid: string, evm: string, key: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', key).update(unsigned).digest('base64url')}`;
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
    return { status: res.status, json, text_head: text.slice(0, 400) };
  } catch (e) {
    return { status: 'NETERR' as unknown as number, json: null, text_head: String(e).slice(0, 200) };
  }
};

const legs = (pool: any, rootKey: string) => raw<Record<string, unknown>>(pool,
  `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
          frozen_delta::text AS frozen_delta, balance_after::text AS balance_after,
          frozen_after::text AS frozen_after, kind, ref_type, ref_id::text AS ref_id, idempotency_key
     FROM public.ledger_entry WHERE event_root_key = $1::text ORDER BY txid`, [rootKey]);

const legCheck = (rows: Array<Record<string, unknown>>) => {
  const sd = rows.reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  const sf = rows.reduce((a, r) => a + BigInt(String(r.frozen_delta)), 0n);
  return {
    n: rows.length,
    kinds: rows.map((r) => String(r.kind)),
    uids: Array.from(new Set(rows.map((r) => String(r.uid)))),
    frozen_deltas: rows.map((r) => String(r.frozen_delta)),
    sum_delta: sd.toString(),
    sum_frozen_delta: sf.toString(),
    sum_delta_plus_frozen: (sd + sf).toString(),
    pure_transfer: sd + sf === 0n,
    no_frozen_movement: sf === 0n,
    txids: rows.map((r) => String(r.txid)),
  };
};

const listingRow = (pool: any, id: number) => raw1<Record<string, unknown>>(pool,
  `SELECT listing_id::text AS listing_id, seller_uid::text AS seller_uid, cid::text AS cid,
          price::text AS price, stock::text AS stock, status
     FROM public.listing WHERE listing_id = $1::bigint`, [id]);
const orderRow = (pool: any, id: number) => raw1<Record<string, unknown>>(pool,
  `SELECT order_id::text AS order_id, listing_id::text AS listing_id, buyer_uid::text AS buyer_uid,
          seller_uid::text AS seller_uid, cid::text AS cid, price::text AS price, quantity::text AS quantity,
          status, pay_txid::text AS pay_txid, refund_txid::text AS refund_txid, ledger_event_keys
     FROM public.listing_order WHERE order_id = $1::bigint`, [id]);
const acct = (pool: any, uid: string) => raw1<Record<string, unknown>>(pool,
  `SELECT balance::text AS balance, frozen::text AS frozen FROM public.account WHERE uid = $1::bigint AND cid = 1`, [uid]);

const mkListing = async (pool: any, sellerUid: string, price: number, stock: number, tag: string) => {
  const r = await raw1<{ listing_id: string }>(pool,
    `INSERT INTO public.listing (seller_uid, cid, price, stock, title, description, media_urls, status, create_key)
     VALUES ($1::bigint, 1, $2::bigint, $3::int, $4::text, '', '{}'::text[], 'listed', $5::text)
     RETURNING listing_id::text AS listing_id`,
    [sellerUid, price, stock, `b3d ${tag}`, `cli:b3d:${RUN}:listing:${tag}`]);
  return Number(r!.listing_id);
};

async function main() {
  const pool = mkPool(2);
  const results: Record<string, unknown> = {};
  const R: any[] = [];
  const rec = (id: string, r: { status: number; json: any; text_head: string }, extra: Record<string, unknown> = {}) => {
    const entry = {
      id, status: r.status, code: r.json?.error?.code ?? null, reason: r.json?.error?.details?.reason ?? null,
      success: r.json?.success ?? null, message: r.json?.message ?? null, error_details: r.json?.error?.details ?? null,
      body_head: r.json ? null : r.text_head, ...extra,
    };
    R.push(entry); return entry;
  };
  const S: any[] = [];
  const recS = (id: string, res: any, extra: Record<string, unknown> = {}) => {
    const entry = res?.ok
      ? { id, status: 200, ok: true, replay: res.replay === true, view_keys: Object.keys(res.view || {}), ...extra, view: res.view }
      : { id, status: res?.status ?? null, ok: false, code: res?.code ?? null, details: res?.details ?? null, message: res?.message ?? null, ...extra };
    S.push(entry); return entry;
  };

  // ---------------------------------------------------------------- 0) /health + 面板重启（先等 200）
  const preHealth = await call('GET', '/health');
  const restart = await (async () => {
    try {
      const res = await fetch('http://127.0.0.1:5555/api/restart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid: 'seafood-api' }), signal: AbortSignal.timeout(90000),
      });
      return { status: res.status, body: (await res.text()).slice(0, 200) };
    } catch (e) { return { status: null, body: String(e).slice(0, 200) }; }
  })();
  let healthy = false; const t0 = Date.now();
  for (let i = 0; i < 120; i += 1) {
    const h = await call('GET', '/health');
    if (h.status === 200) { healthy = true; break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  results.restart = { pre_health: preHealth.status, pre_schema_version: preHealth.json?.schema_version ?? null, panel: restart, health_200_after: healthy, waited_ms: Date.now() - t0 };
  if (!healthy) throw new Error('service not healthy after restart');

  // ---------------------------------------------------------------- 1) fixtures
  const SELLER = await ensureUser(pool, `0xb3dseller${RUN}`);
  const BUYER = await ensureUser(pool, `0xb3dbuyer${RUN}`);
  const THIRD = await ensureUser(pool, `0xb3dthird${RUN}`);
  const ADMIN = await ensureUser(pool, `0xb3dadmin${RUN}`);
  await raw(pool, `UPDATE public.users SET is_admin = true WHERE uid = $1::bigint`, [ADMIN]);
  const fundS = await fundFromResidual(pool, SELLER, 5000n);
  const fundB = await fundFromResidual(pool, BUYER, 5000n);
  const L_HAPPY = await mkListing(pool, SELLER, 100, 3, 'happy');
  const L_EMPTY = await mkListing(pool, SELLER, 50, 0, 'empty');
  const L_PRICEY = await mkListing(pool, SELLER, 100000000, 5, 'pricey');
  // 未付款订单夹具（status='created'，无 pay_txid）⇒ 退款应被 DB 状态机闸拒
  const O_CREATED = await raw1<{ order_id: string }>(pool,
    `INSERT INTO public.listing_order (listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
     VALUES ($1::bigint, $2::bigint, $3::bigint, 1, 100, 1, 'created', $4::text)
     RETURNING order_id::text AS order_id`,
    [L_HAPPY, BUYER, SELLER, `cli:b3d:${RUN}:order-created`]);
  results.fixtures = {
    seller_uid: SELLER, buyer_uid: BUYER, third_uid: THIRD, admin_uid: ADMIN,
    fund_seller: fundS, fund_buyer: fundB,
    listings: { happy: L_HAPPY, empty_stock: L_EMPTY, pricey: L_PRICEY },
    order_created_fixture: Number(O_CREATED!.order_id),
    account_snapshot: { seller: await acct(pool, SELLER), buyer: await acct(pool, BUYER), third: await acct(pool, THIRD) },
    listing_snapshot: { happy: await listingRow(pool, L_HAPPY), empty: await listingRow(pool, L_EMPTY) },
  };

  // ---------------------------------------------------------------- 2) token 现取取证
  const cands: Array<{ name: string; key: string }> = [];
  if (process.env.SECRET_KEY) cands.push({ name: 'env-SECRET_KEY(.env.local)', key: process.env.SECRET_KEY });
  cands.push({ name: 'auth.ts 硬编码兑底', key: 'your-secret-key-here' });
  const keyProbe: any[] = []; let winner: { name: string; key: string } | null = null;
  for (const c of cands) {
    const evm = (await raw1<{ evm: string }>(pool, `SELECT evm FROM public.users WHERE uid = $1::bigint`, [ADMIN]))?.evm || '';
    const t = mint(ADMIN, String(evm), c.key);
    const r = await call('GET', '/api/admin/me', { token: t });
    keyProbe.push({ candidate: c.name, key_len: c.key.length, token_fp: fp(t), status: r.status, reason: r.json?.error?.details?.reason ?? null });
    if (r.status === 200 && !winner) winner = { name: c.name, key: c.key };
  }
  results.token = { key_probe: keyProbe, verdict: winner?.name ?? null, note: '密钥本体不落盘；只记候选名 + token 指纹' };
  if (!winner) throw new Error('no token candidate gave 200');

  // ---------------------------------------------------------------- 3) 路径注册面（预期 404 —— 本片不注册）
  rec('HTTP_buy_404', await call('POST', `/api/listing/${L_HAPPY}/buy`, { body: { create_key: `cli:b3d:${RUN}:x`, quantity: '1' } }));
  rec('HTTP_refund_404', await call('POST', `/api/listing/order/${O_CREATED!.order_id}/refund`, { body: {} }));

  // ================================================================ 4) P2 happy（真 token 身份 → 服务层 verb）
  const kBuy1 = `cli:b3d:${RUN}:buy1`;
  const b1 = await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { create_key: kBuy1, quantity: '2' } });
  recS('P2_buy_happy', b1);
  const order1 = Number((b1 as any).view?.order_id);
  const buyKey = `biz:listing:buy:${order1}`;
  const buyLegs1 = await legs(pool, buyKey);
  // 伪造入参：客户端传 price / seller_uid / buyer_uid ⇒ 必须被忽略
  const kSpoof = `cli:b3d:${RUN}:buy-spoof`;
  const bSpoof = await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { create_key: kSpoof, quantity: '1', price: '1', seller_uid: THIRD, buyer_uid: THIRD } });
  recS('P2_buy_spoof_attempt', bSpoof);
  const spoofOrder = Number((bSpoof as any).view?.order_id);
  const spoofLegs = await legs(pool, `biz:listing:buy:${spoofOrder}`);
  results.P2_happy = {
    order_id: order1, buy_key: buyKey,
    legs: buyLegs1, legs_check: legCheck(buyLegs1),
    order_row: await orderRow(pool, order1),
    listing_after: await listingRow(pool, L_HAPPY),
    buyer_after: await acct(pool, BUYER), seller_after: await acct(pool, SELLER),
    view: (b1 as any).view,
  };
  results.P2_spoof = {
    order_id: spoofOrder, view: (bSpoof as any).view,
    legs: spoofLegs, legs_check: legCheck(spoofLegs),
    note: 'body 里 price=1 / seller_uid=THIRD / buyer_uid=THIRD 必须全被忽略（服务端取数）',
  };

  // ---------------------------------------------------------------- 5) P2 幂等重投（同键同内容）
  const stockBeforeReplay = (await listingRow(pool, L_HAPPY))?.stock;
  const b2 = await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { create_key: kBuy1, quantity: '2' } });
  recS('P2_buy_replay_same_key', b2);
  const buyLegs2 = await legs(pool, buyKey);
  results.P2_replay = {
    view: (b2 as any).view,
    stock_before_replay: String(stockBeforeReplay), stock_after_replay: String((await listingRow(pool, L_HAPPY))?.stock),
    legs_n_after_replay: buyLegs2.length,
    same_txid_set: JSON.stringify(buyLegs1.map((r) => r.txid)) === JSON.stringify(buyLegs2.map((r) => r.txid)),
  };

  // ---------------------------------------------------------------- 6) P2 同键异内容 ⇒ 409
  const b3 = await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { create_key: kBuy1, quantity: '1' } });
  recS('P2_buy_same_key_diff_content', b3);
  results.P2_conflict = { code: (b3 as any).code, details: (b3 as any).details, legs_n_still: (await legs(pool, buyKey)).length };

  // ---------------------------------------------------------------- 7) P2 负例
  recS('P2_neg_stock_insufficient', await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_EMPTY), body: { create_key: `cli:b3d:${RUN}:ne-stock`, quantity: '1' } }));
  recS('P2_neg_self_purchase', await buyListing({ actorUid: Number(SELLER), listingIdRaw: String(L_HAPPY), body: { create_key: `cli:b3d:${RUN}:ne-self`, quantity: '1' } }));
  recS('P2_neg_unknown_listing', await buyListing({ actorUid: Number(BUYER), listingIdRaw: '999999999', body: { create_key: `cli:b3d:${RUN}:ne-miss`, quantity: '1' } }));
  recS('P2_neg_nonnumeric_listing', await buyListing({ actorUid: Number(BUYER), listingIdRaw: 'abc', body: { create_key: `cli:b3d:${RUN}:ne-nan`, quantity: '1' } }));
  recS('P2_neg_no_create_key', await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { quantity: '1' } }));
  recS('P2_neg_bad_prefix', await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { create_key: 'zzz:1', quantity: '1' } }));
  recS('P2_neg_zero_qty', await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_HAPPY), body: { create_key: `cli:b3d:${RUN}:ne-q0`, quantity: '0' } }));
  recS('P2_neg_insufficient_balance', await buyListing({ actorUid: Number(BUYER), listingIdRaw: String(L_PRICEY), body: { create_key: `cli:b3d:${RUN}:ne-bal`, quantity: '1' } }));
  results.P2_neg_zero_residue = {
    empty_listing: await listingRow(pool, L_EMPTY),
    order_rows_total: (await raw1<{ n: number }>(pool, `SELECT COUNT(1)::int AS n FROM public.listing_order`))?.n,
  };

  // ================================================================ 8) P4 退款 happy
  const r1 = await refundListingOrder({ actorUid: Number(SELLER), orderIdRaw: String(order1) });
  recS('P4_refund_happy', r1);
  const refundKey = `biz:listing:refund:${order1}`;
  const refundLegs1 = await legs(pool, refundKey);
  results.P4_happy = {
    order_id: order1, refund_key: refundKey,
    legs: refundLegs1, legs_check: legCheck(refundLegs1),
    order_row: await orderRow(pool, order1),
    listing_after: await listingRow(pool, L_HAPPY),
    buyer_after: await acct(pool, BUYER), seller_after: await acct(pool, SELLER),
    view: (r1 as any).view,
  };

  // 幂等重投
  const r2 = await refundListingOrder({ actorUid: Number(SELLER), orderIdRaw: String(order1) });
  recS('P4_refund_replay', r2);
  const refundLegs2 = await legs(pool, refundKey);
  results.P4_replay = {
    view: (r2 as any).view,
    legs_n_after_replay: refundLegs2.length,
    same_txid_set: JSON.stringify(refundLegs1.map((r) => r.txid)) === JSON.stringify(refundLegs2.map((r) => r.txid)),
    stock_after_replay: String((await listingRow(pool, L_HAPPY))?.stock),
  };

  // ================================================================ 9) P4 负例
  const r3 = await refundListingOrder({ actorUid: Number(THIRD), orderIdRaw: String(order1) });
  recS('P4_neg_non_owner_third', r3);
  const r4 = await refundListingOrder({ actorUid: Number(BUYER), orderIdRaw: String(order1) });
  recS('P4_neg_non_owner_buyer', r4);
  const r5 = await refundListingOrder({ actorUid: Number(SELLER), orderIdRaw: String(O_CREATED!.order_id) });
  recS('P4_neg_order_not_refundable', r5);
  recS('P4_neg_unknown_order', await refundListingOrder({ actorUid: Number(SELLER), orderIdRaw: '999999999' }));
  recS('P4_neg_nonnumeric_order', await refundListingOrder({ actorUid: Number(SELLER), orderIdRaw: 'xyz' }));
  results.P4_neg = {
    non_owner_third: { code: (r3 as any).code, status: (r3 as any).status, details: (r3 as any).details },
    non_owner_buyer: { code: (r4 as any).code, status: (r4 as any).status, details: (r4 as any).details },
    not_refundable: { code: (r5 as any).code, status: (r5 as any).status, details: (r5 as any).details },
    refund_legs_on_created_order: (await legs(pool, `biz:listing:refund:${O_CREATED!.order_id}`)).length,
    refund_legs_on_unknown: 0,
  };

  // ---------------------------------------------------------------- 10) 产物
  const out = {
    run: RUN, base: BASE, at: new Date().toISOString(), probe: 'p4z-b3d-02-e2e',
    results, http_records: R, service_records: S,
  };
  const payload = JSON.stringify(out, null, 2);
  const leak = {
    eyJ: (payload.match(/eyJ/g) || []).length,
    secret_occurrences: (payload.match(new RegExp(winner.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
  };
  fs.writeFileSync(path.join(outDir, 'post', 'e2e.json'), JSON.stringify({ ...out, leak_check: leak }, null, 2));
  console.log('WROTE ' + path.resolve(outDir, 'post', 'e2e.json'));
  console.log('leak_check=' + JSON.stringify(leak));
  console.log('token_verdict=' + winner.name);
  console.log('HTTP=' + JSON.stringify(R.map((r) => [r.id, r.status, r.code, r.reason])));
  console.log('P2_happy_legs=' + JSON.stringify((results.P2_happy as any).legs_check));
  console.log('P2_spoof_legs=' + JSON.stringify((results.P2_spoof as any).legs_check));
  console.log('P4_happy_legs=' + JSON.stringify((results.P4_happy as any).legs_check));
  console.log('SVC=' + JSON.stringify(S.map((r) => [r.id, r.status, r.code, r.reason ?? null, r.replay ?? null])));
  await pool.end().catch(() => undefined);
}

main().then(() => process.exit(0)).catch((e) => { console.error('E2E_FAIL ' + String(e && (e as Error).stack || e)); process.exit(1); });
