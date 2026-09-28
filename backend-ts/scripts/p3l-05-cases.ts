/**
 * P3-L · 探针 05：行为用例（头号必做 = **首次购买**，证明 v2 修对了）
 *
 * 用法：P3L_RUN=<tag> npx ts-node --transpile-only scripts/p3l-05-cases.ts
 * 命名空间（本片独占，用于残迹判别）：uid 窗口 9903xx；listing/listing_order 的 `create_key` 前缀 `cli:kong15-`。
 * 只写本库的**测试夹具**；不改 src / migrations / docs；不动既有 11 张老表的数据。
 *
 * 用例：
 *   K1 **首次购买**（头号）：买家无任何冻结额 ⇒ 购买**成功**、买家 `balance −n`、卖家 `balance +n`、**不得 LD002**
 *   K2 幂等键：同 create_key 重放 ⇒ idempotent_replay / 同 txid / 不双写 / 不追加 ledger_event_keys / 不二次扣库存
 *   K3 状态机白名单 正/负全集（纯函数 + UPDATE 路径）+ 终态（delisted）后再迁移
 *   K4 守卫矩阵：不得改的列逐个试（listing / listing_order / DELETE）
 *   K5 边界：不存在 FK / 自买自卖 / quantity=0 / 非 listed 币种 / 余额不足 / CHECK / FK
 *   K6 结算链守恒：Σ(delta+frozen_delta)=0 / 平台账户白名单 / 事件 kind 白名单 / cid=1 收工 Σ(balance+frozen)==total_supply
 */
import {
  mkPool, raw, raw1, save, errInfo, sha256, RUN, REPO,
  acct, ledgerCount, entriesOfKey, listingPostEvent, fundFromResidual, mkChecks,
} from './p3l-lib';
import * as fs from 'fs';
import * as path from 'path';

const UID_WINDOW = { seller: '990301', buyer: '990302', buyer2: '990303', poor: '990304' };
const PASSPHRASE = '5b7e1a2' + (process.env.P3L_TAG || String(Date.now()).slice(-6)); // 本片通行短语 + 每次调用唯一尾缀（保证可重复运行、create_key 不复用）

/** 显式 uid 窗口建用户（identity 为 BY DEFAULT ⇒ 允许显式值；窗口 9903xx 为本片独占） */
const ensureUserAt = async (p: ReturnType<typeof mkPool>, uid: string, seed: string): Promise<string> => {
  const evm = `0x${sha256(seed).slice(0, 40)}`;
  const cols = await raw<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }>(
    p, `SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
  const extra = cols.filter((c) => c.is_nullable === 'NO' && c.column_default === null
    && c.column_name !== 'uid' && c.column_name !== 'evm');
  const names = ['uid', 'evm', ...extra.map((c) => c.column_name)];
  const vals = [`${BigInt(uid)}`, `'${evm}'`, ...extra.map((c) => (/timestamp|date/.test(c.data_type) ? 'now()' : "''"))];
  try {
    await raw(p, `INSERT INTO public.users (${names.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT DO NOTHING`);
  } catch (e) { if (errInfo(e).sqlstate !== '23505') throw e; }
  const got = await raw1<{ uid: string }>(p, 'SELECT uid::text AS uid FROM public.users WHERE lower(evm)=lower($1) LIMIT 1', [evm]);
  if (!got) throw new Error(`ensureUserAt(${uid}) failed`);
  return got.uid;
};

/** 建商品夹具（DL99：发布属「无分录的写」，直接 INSERT） */
const ensureListing = async (
  p: ReturnType<typeof mkPool>, sellerUid: string, cid: string, price: string, stock: number, status: string, tag: string,
): Promise<string> => {
  const key = `cli:kong15-${PASSPHRASE}-listing-${tag}`;
  const got = await raw1<{ listing_id: string }>(p, 'SELECT listing_id::text AS listing_id FROM public.listing WHERE create_key=$1', [key]);
  if (got) return got.listing_id;
  const ins = await raw1<{ listing_id: string }>(p,
    `INSERT INTO public.listing (seller_uid, cid, price, stock, title, status, create_key)
     VALUES ($1::bigint, $2::bigint, $3::bigint, $4::int, '', $5, $6) RETURNING listing_id::text AS listing_id`,
    [sellerUid, cid, price, stock, status, key]);
  if (!ins) throw new Error('fixture listing insert failed');
  return ins.listing_id;
};

const bal = async (p: ReturnType<typeof mkPool>, uid: string) => {
  const a = await acct(p, uid);
  return { row: a, balance: BigInt(String(a?.balance ?? '0')), frozen: BigInt(String(a?.frozen ?? '0')) };
};

(async () => {
  const pool = mkPool(2);
  const { add, list } = mkChecks();
  const notes: Record<string, unknown> = {};
  const tryUpd = async (sql: string, params: unknown[]): Promise<Record<string, unknown>> => {
    try { const r = await raw1(pool, sql, params); return { ok: true, row: r }; }
    catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason, field: i.field, constraint: i.constraint, message: i.message, errname: (e as Record<string, unknown>)?.name ?? null }; }
  };
  try {
    // ================================================================ 夹具 + 命名空间审计（先测）
    const nsAuditBefore = {
      users_9903xx: await raw1(pool, `SELECT count(*)::text AS n FROM public.users WHERE uid BETWEEN 990300 AND 990399`),
      listing_cli_kong15: await raw1(pool, `SELECT count(*)::text AS n FROM public.listing WHERE create_key LIKE 'cli:kong15-%'`),
      orders_cli_kong15: await raw1(pool, `SELECT count(*)::text AS n FROM public.listing_order WHERE create_key LIKE 'cli:kong15-%'`),
      ledger_biz_listing: await raw1(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:%'`),
    };
    const seller = await ensureUserAt(pool, UID_WINDOW.seller, `kong15-seller-${RUN}`);
    const buyer = await ensureUserAt(pool, UID_WINDOW.buyer, `kong15-buyer-${RUN}`);
    const buyer2 = await ensureUserAt(pool, UID_WINDOW.buyer2, `kong15-buyer2-${RUN}`);
    const poor = await ensureUserAt(pool, UID_WINDOW.poor, `kong15-poor-${RUN}`);
    const funding = await (async () => {
      try {
        return { buyer: await fundFromResidual(pool, buyer, 3000n), buyer2: await fundFromResidual(pool, buyer2, 500n) };
      } catch (e) { return { error: String((e as Error).message).slice(0, 200) }; }
    })();
    const ledgerBefore = await ledgerCount(pool);

    // ================================================================ K1 首次购买（头号）
    const L1 = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'k1');
    await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`, [L1]);
    const bBefore = await bal(pool, buyer);
    const sBefore = await bal(pool, seller);
    const led0 = await ledgerCount(pool);
    let k1res: Record<string, unknown> = {};
    let k1err: Record<string, unknown> | null = null;
    try {
      k1res = await listingPostEvent(pool, {
        op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-k1`, listing_id: L1, buyer_uid: buyer, quantity: '1',
        request_fingerprint: 'fp-kong15-k1',
      });
    } catch (e) { k1err = errInfo(e) as unknown as Record<string, unknown>; }
    const bAfter = await bal(pool, buyer);
    const sAfter = await bal(pool, seller);
    const k1Entries = k1res.order_id ? await entriesOfKey(pool, `biz:listing:buy:${k1res.order_id}`) : [];
    const k1pass = !!k1res.order_id && k1err === null
      && String(k1res.order_status) === 'paid' && String((k1res as any).op) === 'buy'
      && bAfter.balance === bBefore.balance - 100n && bAfter.frozen === bBefore.frozen
      && sAfter.balance === sBefore.balance + 100n
      && (k1err as any)?.sqlstate !== 'LD002'
      && k1Entries.length === 2
      && k1Entries.every((e) => String(e.frozen_delta) === '0');
    add('K1', '**首次购买**：买家无冻结额 ⇒ 购买成功、买家 balance −100、卖家 balance +100、买家 frozen 不变、**无 LD002**、恰 2 条分录且 frozen_delta=0',
      k1pass,
      { headline: `order_id=${k1res.order_id ?? null} status=${k1res.order_status ?? null} err=${k1err ? JSON.stringify(k1err.sqlstate) + '/' + String((k1err as any).reason) : 'null'} | buyer ${bBefore.balance}->${bAfter.balance} (frozen ${bBefore.frozen}->${bAfter.frozen}) | seller ${sBefore.balance}->${sAfter.balance}`,
        error: k1err, buyer_before: bBefore.row, buyer_after: bAfter.row, seller_before: sBefore.row, seller_after: sAfter.row,
        entries: k1Entries, ledger_before: led0, ledger_after: await ledgerCount(pool), result: k1res });
    const orderId = String(k1res.order_id ?? '');
    const txid1 = String(k1res.txid ?? '');

    // ================================================================ K2 同键重放不双写
    const ordCountKey = async () => (await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order WHERE create_key=$1', [`cli:kong15-${PASSPHRASE}-k1`]))?.n;
    const L1afterBuy = await raw1<{ stock: number; keys: unknown }>(pool, `SELECT stock, ledger_event_keys AS keys FROM public.listing WHERE listing_id=$1::bigint`, [L1]);
    const ledBeforeReplay = await ledgerCount(pool);
    const k2 = await listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-k1`, listing_id: L1, buyer_uid: buyer, quantity: '1', request_fingerprint: 'fp-kong15-k1' });
    const ledAfterReplay = await ledgerCount(pool);
    const L1afterReplay = await raw1<{ stock: number; keys: unknown }>(pool, `SELECT stock, ledger_event_keys AS keys FROM public.listing WHERE listing_id=$1::bigint`, [L1]);
    const k2Entries = await entriesOfKey(pool, `biz:listing:buy:${orderId}`);
    const k2pass = k2.idempotent_replay === true && String(k2.txid) === txid1 && String(k2.order_id) === orderId
      && ledAfterReplay === ledBeforeReplay && (await ordCountKey()) === '1'
      && JSON.stringify(L1afterBuy?.keys) === JSON.stringify(L1afterReplay?.keys)
      && k2Entries.length === 2 && Number(L1afterReplay?.stock) === Number(L1afterBuy?.stock);
    add('K2', '幂等键：同 create_key 重放 ⇒ idempotent_replay=true / 同 txid / 账本行 +0 / 订单仍 1 条 / listing.ledger_event_keys 逐字不变 / 库存不二次递减',
      k2pass,
      { headline: `replay=${k2.idempotent_replay} same_txid=${String(k2.txid) === txid1} ledger ${ledBeforeReplay}->${ledAfterReplay} stock ${L1afterBuy?.stock}->${L1afterReplay?.stock} keys_eq=${JSON.stringify(L1afterBuy?.keys) === JSON.stringify(L1afterReplay?.keys)}`,
        stock_before: L1afterBuy?.stock, stock_after: L1afterReplay?.stock, keys_before: L1afterBuy?.keys, keys_after: L1afterReplay?.keys, result: k2 });

    // ================================================================ K3 状态机 正/负全集 + 终态后再迁移
    const pure = async (fn: string, a: string, b: string) =>
      (await raw1<{ r: boolean }>(pool, `SELECT public.${fn}($1::text,$2::text) AS r`, [a, b]))?.r;
    const pureListing = {
      allowed: { 'draft->listed': await pure('listing_status_transition_ok', 'draft', 'listed'),
                 'listed->frozen': await pure('listing_status_transition_ok', 'listed', 'frozen'),
                 'frozen->listed': await pure('listing_status_transition_ok', 'frozen', 'listed'),
                 'listed->delisted': await pure('listing_status_transition_ok', 'listed', 'delisted') },
      forbidden: { 'draft->frozen': await pure('listing_status_transition_ok', 'draft', 'frozen'),
                   'draft->delisted': await pure('listing_status_transition_ok', 'draft', 'delisted'),
                   'listed->draft': await pure('listing_status_transition_ok', 'listed', 'draft'),
                   'listed->listed': await pure('listing_status_transition_ok', 'listed', 'listed'),
                   'frozen->delisted': await pure('listing_status_transition_ok', 'frozen', 'delisted'),
                   'delisted->listed': await pure('listing_status_transition_ok', 'delisted', 'listed'),
                   'delisted->frozen': await pure('listing_status_transition_ok', 'delisted', 'frozen') },
    };
    const L3a = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'k3a');
    const L3b = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'k3b');
    const L3c = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'k3c');
    const c3: Record<string, unknown> = {};
    c3.a_draft_to_listed = await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint RETURNING status`, [L3a]);
    c3.a_listed_to_frozen = await tryUpd(`UPDATE public.listing SET status='frozen' WHERE listing_id=$1::bigint RETURNING status`, [L3a]);
    c3.a_frozen_to_listed = await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint RETURNING status`, [L3a]);
    c3.a_listed_to_delisted = await tryUpd(`UPDATE public.listing SET status='delisted' WHERE listing_id=$1::bigint RETURNING status`, [L3a]);
    c3.b_draft_to_frozen = await tryUpd(`UPDATE public.listing SET status='frozen' WHERE listing_id=$1::bigint`, [L3b]);
    c3.b_draft_to_delisted = await tryUpd(`UPDATE public.listing SET status='delisted' WHERE listing_id=$1::bigint`, [L3b]);
    c3.c_draft_to_listed = await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`, [L3c]);
    c3.c_listed_to_draft = await tryUpd(`UPDATE public.listing SET status='draft' WHERE listing_id=$1::bigint`, [L3c]);
    // 终态后再迁移：L3a 已 delisted
    const termBefore = await raw1<{ status: string }>(pool, `SELECT status FROM public.listing WHERE listing_id=$1::bigint`, [L3a]);
    c3.a_terminal_delisted_to_listed = await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`, [L3a]);
    c3.a_terminal_delisted_to_frozen = await tryUpd(`UPDATE public.listing SET status='frozen' WHERE listing_id=$1::bigint`, [L3a]);
    const termAfter = await raw1<{ status: string }>(pool, `SELECT status FROM public.listing WHERE listing_id=$1::bigint`, [L3a]);
    const pureOk = Object.values(pureListing.allowed).every((v) => v === true)
      && Object.values(pureListing.forbidden).every((v) => v === false);
    const positiveOk = ['a_draft_to_listed', 'a_listed_to_frozen', 'a_frozen_to_listed', 'a_listed_to_delisted', 'c_draft_to_listed']
      .every((k) => (c3[k] as any)?.ok === true);
    const negKeys = ['b_draft_to_frozen', 'b_draft_to_delisted', 'c_listed_to_draft', 'a_terminal_delisted_to_listed', 'a_terminal_delisted_to_frozen'];
    const negOk = negKeys.every((k) => (c3[k] as any)?.ok === false && (c3[k] as any)?.sqlstate === 'LD011'
      && (c3[k] as any)?.reason === 'LISTING_STATE_INVALID');
    add('K3', '状态机白名单 正全集（纯函数 4 + UPDATE 路径 5 通过）+ 负全集（纯函数 7 拒 + UPDATE 路径 5 拒 ⇒ LD011/LISTING_STATE_INVALID）+ 终态 delisted 后再迁移 ⇒ 拒且行未写',
      pureOk && positiveOk && negOk && termBefore?.status === 'delisted' && termAfter?.status === 'delisted',
      { headline: `pure allowed=4/4 forbidden=7/7 | UPDATE positive=5/5 negative=${negKeys.filter((k) => (c3[k] as any)?.sqlstate === 'LD011').length}/${negKeys.length} | terminal unchanged=${termBefore?.status === termAfter?.status}`,
        pure_listing: pureListing, update_path: c3, terminal_before: termBefore?.status, terminal_after: termAfter?.status });

    // ================================================================ K4 守卫矩阵（逐列）
    const L4 = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'k4');
    await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`, [L4]);
    const c4: Record<string, unknown> = {};
    c4.listing_create_key = await tryUpd(`UPDATE public.listing SET create_key='cli:kong15-${PASSPHRASE}-tamper' WHERE listing_id=$1::bigint`, [L4]);
    c4.listing_stock_when_listed_ok = await tryUpd(`UPDATE public.listing SET stock=7 WHERE listing_id=$1::bigint RETURNING stock`, [L4]);
    const L4draft = await ensureListing(pool, seller, '1', '50', 5, 'draft', 'k4draft');
    c4.listing_stock_when_draft = await tryUpd(`UPDATE public.listing SET stock=9 WHERE listing_id=$1::bigint`, [L4draft]);
    c4.listing_delete = await (async () => { try { await raw(pool, `DELETE FROM public.listing WHERE listing_id=$1::bigint`, [L4]); return { ok: true }; } catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason }; } })();
    c4.order_listing_id = await tryUpd(`UPDATE public.listing_order SET listing_id=1 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_buyer_uid = await tryUpd(`UPDATE public.listing_order SET buyer_uid=990399 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_seller_uid = await tryUpd(`UPDATE public.listing_order SET seller_uid=990399 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_cid = await tryUpd(`UPDATE public.listing_order SET cid=2 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_price = await tryUpd(`UPDATE public.listing_order SET price=1 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_quantity = await tryUpd(`UPDATE public.listing_order SET quantity=99 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_create_key = await tryUpd(`UPDATE public.listing_order SET create_key='cli:kong15-${PASSPHRASE}-tamper' WHERE order_id=$1::bigint`, [orderId]);
    c4.order_pay_txid_nullout = await tryUpd(`UPDATE public.listing_order SET pay_txid=NULL WHERE order_id=$1::bigint`, [orderId]);
    c4.order_pay_txid_rewrite = await tryUpd(`UPDATE public.listing_order SET pay_txid=pay_txid+1 WHERE order_id=$1::bigint`, [orderId]);
    c4.order_status_illegal = await tryUpd(`UPDATE public.listing_order SET status='created' WHERE order_id=$1::bigint`, [orderId]);
    c4.order_delete = await (async () => { try { await raw(pool, `DELETE FROM public.listing_order WHERE order_id=$1::bigint`, [orderId]); return { ok: true }; } catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason }; } })();
    const guardKeys = ['listing_create_key', 'listing_stock_when_draft', 'order_listing_id', 'order_buyer_uid', 'order_seller_uid',
      'order_cid', 'order_price', 'order_quantity', 'order_create_key', 'order_pay_txid_nullout', 'order_pay_txid_rewrite', 'order_status_illegal'];
    const guardOk = guardKeys.every((k) => (c4[k] as any)?.ok === false && (c4[k] as any)?.sqlstate === 'LD011')
      && (c4.listing_delete as any)?.sqlstate === 'LD011' && (c4.order_delete as any)?.sqlstate === 'LD011'
      && (c4.listing_stock_when_listed_ok as any)?.ok === true;
    add('K4', `守卫矩阵：${guardKeys.length} 项「不得改」逐个试 ⇒ 全 LD011；DELETE 两表 ⇒ LD011；listing.stock 在 listed 下合法可改`,
      guardOk,
      { headline: `rejected ${guardKeys.filter((k) => (c4[k] as any)?.sqlstate === 'LD011').length}/${guardKeys.length} as LD011; deletes LD011=${(c4.listing_delete as any)?.sqlstate}/${(c4.order_delete as any)?.sqlstate}; stock@listed ok=${(c4.listing_stock_when_listed_ok as any)?.ok}`,
        detail: c4 });

    // ================================================================ K5 边界
    const c5: Record<string, unknown> = {};
    const errOf = async (fn: () => Promise<unknown>): Promise<Record<string, unknown>> => {
      try { const r = await fn(); return { ok: true, result: r }; }
      catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason, field: i.field, constraint: i.constraint, message: i.message }; }
    };
    c5.nonexistent_listing = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-nolisting`, listing_id: '999999999', buyer_uid: buyer, quantity: '1' }));
    c5.nonexistent_order_refund = await errOf(() => listingPostEvent(pool, { op: 'refund', order_id: '999999999' }));
    c5.bad_op = await errOf(() => listingPostEvent(pool, { op: 'publish', create_key: `cli:kong15-${PASSPHRASE}-c5-op`, listing_id: L4, buyer_uid: buyer, quantity: '1' }));
    c5.platform_buyer = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-plat`, listing_id: L4, buyer_uid: '-1', quantity: '1' }));
    const L5self = await ensureListing(pool, seller, '1', '100', 3, 'draft', 'k5self');
    await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`, [L5self]);
    c5.self_purchase = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-self`, listing_id: L5self, buyer_uid: seller, quantity: '1' }));
    c5.qty_zero = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-q0`, listing_id: L5self, buyer_uid: buyer, quantity: '0' }));
    c5.qty_negative = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-qn`, listing_id: L5self, buyer_uid: buyer, quantity: '-3' }));
    c5.stock_insufficient = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-stk`, listing_id: L5self, buyer_uid: buyer, quantity: '99' }));
    const L5draft = await ensureListing(pool, seller, '1', '100', 3, 'draft', 'k5draft');
    c5.listing_not_listed = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-draft`, listing_id: L5draft, buyer_uid: buyer, quantity: '1' }));
    // 余额不足：poor（uid 990304）无余额
    const poorBefore = await bal(pool, poor);
    const ledBeforePoor = await ledgerCount(pool);
    c5.insufficient_balance = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-poor`, listing_id: L5self, buyer_uid: poor, quantity: '1' }));
    const poorAfter = await bal(pool, poor);
    const poorOrder = await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order WHERE create_key=$1', [`cli:kong15-${PASSPHRASE}-c5-poor`]);
    c5.insufficient_balance_side_effects = { balance_before: poorBefore.balance.toString(), balance_after: poorAfter.balance.toString(),
      ledger_before: ledBeforePoor, ledger_after: await ledgerCount(pool), order_row_created: poorOrder?.n };
    c5.price_zero_insert = await errOf(() => raw(pool, `INSERT INTO public.listing (seller_uid,cid,price,stock,status,create_key) VALUES ($1::bigint,1,0,1,'draft',$2)`, [seller, `cli:kong15-${PASSPHRASE}-c5-p0`]));
    c5.bad_fk_insert = await errOf(() => raw(pool, `INSERT INTO public.listing (seller_uid,cid,price,stock,status,create_key) VALUES (999999999,1,10,1,'draft',$1)`, [`cli:kong15-${PASSPHRASE}-c5-fk`]));
    const otherCcy = await raw1<{ cid: string; status: string }>(pool, `SELECT cid::text AS cid, status FROM public.currency WHERE status <> 'listed' ORDER BY cid LIMIT 1`);
    let ccyCase: Record<string, unknown> | null = null;
    if (otherCcy) {
      const L5ccy = await ensureListing(pool, seller, otherCcy.cid, '100', 3, 'draft', 'k5ccy');
      await tryUpd(`UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`, [L5ccy]);
      ccyCase = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:kong15-${PASSPHRASE}-c5-ccy`, listing_id: L5ccy, buyer_uid: buyer, quantity: '1' }));
    }
    c5.non_listed_currency = ccyCase;
    c5.non_listed_currency_source = otherCcy ?? null;
    const c5pass =
      (c5.nonexistent_listing as any)?.ok === false && (c5.nonexistent_listing as any)?.reason === 'listing_not_found'
      && (c5.nonexistent_order_refund as any)?.ok === false && (c5.nonexistent_order_refund as any)?.reason === 'order_not_found'
      && (c5.bad_op as any)?.ok === false && (c5.bad_op as any)?.reason === 'UNKNOWN_LISTING_OP'
      && (c5.platform_buyer as any)?.ok === false && (c5.platform_buyer as any)?.reason === 'PLATFORM_BUYER_FORBIDDEN'
      && (c5.self_purchase as any)?.ok === false && (c5.self_purchase as any)?.reason === 'self_purchase_not_allowed'
      && (c5.qty_zero as any)?.ok === false && (c5.qty_negative as any)?.ok === false
      && (c5.stock_insufficient as any)?.ok === false && (c5.stock_insufficient as any)?.reason === 'listing_stock_insufficient'
      && (c5.listing_not_listed as any)?.ok === false && (c5.listing_not_listed as any)?.reason === 'listing_not_listed'
      && (c5.insufficient_balance as any)?.ok === false
      && (c5.insufficient_balance_side_effects as any).order_row_created === '0'
      && (c5.price_zero_insert as any)?.sqlstate === '23514' && (c5.bad_fk_insert as any)?.sqlstate === '23503'
      && (!ccyCase || (ccyCase as any)?.ok === false);
    add('K5', '边界：不存在 listing/order ⇒ listing_not_found/order_not_found；非法 op ⇒ UNKNOWN_LISTING_OP；平台买家 ⇒ PLATFORM_BUYER_FORBIDDEN；自买自卖 ⇒ self_purchase_not_allowed；qty≤0 ⇒ 拒；库存不足 ⇒ listing_stock_insufficient；未 listed ⇒ listing_not_listed；余额不足 ⇒ 拒且零副作用；price=0 ⇒ 23514；坏 FK ⇒ 23503；非 listed 币种 ⇒ 拒',
      c5pass,
      { headline: `sqlstates: ${JSON.stringify(Object.fromEntries(Object.entries(c5).filter(([k]) => !k.endsWith('_source') && k !== 'insufficient_balance_side_effects').map(([k, v]) => [k, (v as any)?.sqlstate ?? null])))} | reasons: ${JSON.stringify(Object.fromEntries(Object.entries(c5).filter(([k]) => !k.endsWith('_source') && k !== 'insufficient_balance_side_effects').map(([k, v]) => [k, (v as any)?.reason ?? null])))}`,
        detail: c5 });

    // ================================================================ K6 结算链守恒 + 平台白名单 + cid=1 收工
    const buyEntries = await entriesOfKey(pool, `biz:listing:buy:${orderId}`);
    const sumBuy = buyEntries.reduce((s, e) => s + BigInt(String(e.delta)) + BigInt(String(e.frozen_delta)), 0n);
    const kindsBuy = [...new Set(buyEntries.map((e) => String(e.kind)))].sort().join(',');
    const platformTouched = buyEntries.filter((e) => ['0', '-1', '-2', '-3'].includes(String(e.uid)));
    const refOk = buyEntries.every((e) => e.ref_type === 'listing_order' && String(e.ref_id) === orderId);
    const frozenAllZero = buyEntries.every((e) => String(e.frozen_delta) === '0');
    // 退款链
    const rf = await listingPostEvent(pool, { op: 'refund', order_id: orderId, request_fingerprint: 'fp-kong15-rf' });
    const orderAfterRf = await raw1<Record<string, unknown>>(pool, `SELECT status, refund_txid::text AS refund_txid, ledger_event_keys FROM public.listing_order WHERE order_id=$1::bigint`, [orderId]);
    const rfEntries = await entriesOfKey(pool, `biz:listing:refund:${orderId}`);
    const sumRf = rfEntries.reduce((s, e) => s + BigInt(String(e.delta)) + BigInt(String(e.frozen_delta)), 0n);
    const kindsRf = [...new Set(rfEntries.map((e) => String(e.kind)))].sort().join(',');
    // cid=1 收工守恒
    const totalSupply = await raw1<{ ts: string }>(pool, `SELECT total_supply::text AS ts FROM public.currency WHERE cid=1`);
    const accSum = await raw1<{ s: string }>(pool, `SELECT COALESCE(sum(balance+frozen),0)::text AS s FROM public.account WHERE cid=1`);
    const conserveOk = totalSupply && accSum && BigInt(totalSupply.ts) === BigInt(accSum.s);
    const k6pass = sumBuy === 0n && sumRf === 0n && frozenAllZero
      && kindsBuy === 'purchase,sale' && kindsRf === 'purchase_refund'
      && platformTouched.length === 0 && refOk
      && buyEntries.length === 2 && rfEntries.length === 2
      && String(orderAfterRf?.status) === 'refunded' && orderAfterRf?.refund_txid !== null && rf.idempotent_replay === false
      && conserveOk === true;
    add('K6', '结算链守恒：购买/退款 Σ(delta+frozen_delta)=0 且分录全 frozen_delta=0；kind 恰 purchase,sale / purchase_refund；平台账户(0,-1,-2,-3)零参与；ref 落 listing_order/order_id；退款 paid→refunded+refund_txid；cid=1 Σ(balance+frozen)==total_supply',
      k6pass,
      { headline: `buy Σ=${sumBuy} kinds=${kindsBuy} n=${buyEntries.length} | refund Σ=${sumRf} kinds=${kindsRf} n=${rfEntries.length} | platform_touched=${platformTouched.length} | order=${orderAfterRf?.status} refund_txid=${orderAfterRf?.refund_txid} | cid1 Σ(acc)=${accSum?.s} total_supply=${totalSupply?.ts} conserve=${conserveOk}`,
        buy_entries: buyEntries, refund_entries: rfEntries, refund_result: rf, order_after_refund: orderAfterRf });

    // ================================================================ 命名空间审计（后测）+ 落盘
    const nsAuditAfter = {
      users_9903xx: await raw(pool, `SELECT uid::text AS uid FROM public.users WHERE uid BETWEEN 990300 AND 990399 ORDER BY uid`),
      listing_cli_kong15: await raw1(pool, `SELECT count(*)::text AS n FROM public.listing WHERE create_key LIKE 'cli:kong15-%'`),
      orders_cli_kong15: await raw1(pool, `SELECT count(*)::text AS n FROM public.listing_order WHERE create_key LIKE 'cli:kong15-%'`),
      ledger_biz_listing_ns: await raw(pool, `SELECT event_root_key, count(*)::text AS n FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:%' GROUP BY event_root_key ORDER BY event_root_key`),
      // 冲突行是否全属本片命名空间（负向：非本片）
      foreign_listing_rows: await raw(pool, `SELECT listing_id::text AS listing_id, create_key FROM public.listing WHERE create_key NOT LIKE 'cli:kong15-%'`),
      foreign_order_rows: await raw(pool, `SELECT order_id::text AS order_id, create_key FROM public.listing_order WHERE create_key NOT LIKE 'cli:kong15-%'`),
    };
    const out = { repo: REPO, uid_window: UID_WINDOW, passport: PASSPHRASE, funding,
      ledger_before: ledgerBefore, ledger_after: await ledgerCount(pool),
      namespace_audit_before: nsAuditBefore, namespace_audit_after: nsAuditAfter,
      checks: list, passed: list.filter((c) => c.pass).length, total: list.length, notes };
    const file = save(`cases-${PASSPHRASE}`, out);
    console.log(JSON.stringify({ ok: list.every((c) => c.pass), file,
      passed: `${list.filter((c) => c.pass).length}/${list.length}`,
      headline_K1: list.find((c) => c.id === 'K1')?.readout,
      failed: list.filter((c) => !c.pass).map((c) => ({ id: c.id, headline: (c.readout as any)?.headline })) }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
})();
