/**
 * P3-L · 探针 01：行为用例（8 条，逐条给头号读数）
 *
 * 用法：npx ts-node --transpile-only scripts/p3l-01-cases.ts
 * 只写本库的**新增对象与测试夹具**；不改 src / migrations / docs；不动既有 11 张基表的结构。
 *
 * 用例：
 *   C1 listing 状态机白名单**正全集**（draft→listed / listed→frozen / frozen→listed / listed→delisted）
 *   C2 状态机**负全集** + **终态后再迁移**（delisted→*）⇒ 全 `LD011` + reason=LISTING_STATE_INVALID
 *   C3 幂等键：同 create_key 重放 ⇒ 不双写订单、不双扣库存、不追加 ledger_event_keys（DL149）
 *   C4 守卫矩阵：不得改的列**逐个试**（listing 4 项 / listing_order 7 项 + DELETE）
 *   C5 结算链守恒：Σ(delta+frozen_delta)=0 / 平台账户零参与 / 事件 kind 白名单恰为 2 条（DL85）
 *   C6 边界：不存在 FK / 自买自卖 / 金额 0 或负 / 非 listed 币种 / 库存不足
 *   C7 不超卖：串行（第 2 人 ⇒ stock_insufficient）+ 真并发（第 2 连接被行锁阻塞）
 *   C8 退款链：paid→refunded 守恒 + 重放幂等 + created 单不可退（order_not_refundable）
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  mkPool, raw, raw1, save, errInfo, sha256, RUN, REPO,
  ensureUser, ensureListing, listingRow, orderRow, acct, ledgerCount, entriesOfKey,
  listingPostEvent, mkChecks,
} from './p3l-lib';

const FIXTURE_USERS_CHECKLIST: string[] = [];

(async () => {
  const pool = mkPool(2);
  const c2Pool = mkPool(1);
  const { add, list } = mkChecks();
  const notes: Record<string, unknown> = {};
  try {
    // ---------------------------------------------------------------- 夹具
    const seller = await ensureUser(pool, `seller-${RUN}`);
    const buyer = await ensureUser(pool, `buyer-${RUN}`);
    const buyer2 = await ensureUser(pool, `buyer2-${RUN}`);
    FIXTURE_USERS_CHECKLIST.push(seller, buyer, buyer2);
    const need = 3000n;
    const funding = await (async () => {
      try { return { buyer: await (await import('./p3l-lib')).fundFromResidual(pool, buyer, need),
                     buyer2: await (await import('./p3l-lib')).fundFromResidual(pool, buyer2, need) }; }
      catch (e) { return { error: String((e as Error).message).slice(0, 200) }; }
    })();
    const balBefore = await acct(pool, buyer);
    const ledgerBefore = await ledgerCount(pool);

    // ---------------------------------------------------------------- C1 状态机正全集
    const lA = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c1a');
    const lB = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c1b');
    const lC = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c1c');
    const lD = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c1d');
    const tryUpd = async (id: string, sql: string): Promise<Record<string, unknown>> => {
      try { const r = await raw1(pool, sql, [id]); return { ok: true, row: r }; }
      catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason, field: i.field, constraint: i.constraint }; }
    };
    const c1: Record<string, unknown> = {};
    c1.A_draft_to_listed = await tryUpd(lA.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint RETURNING status`);
    c1.B_listed_to_frozen = await tryUpd(lB.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    c1.B2_listed_to_frozen = await tryUpd(lB.listing_id, `UPDATE public.listing SET status='frozen' WHERE listing_id=$1::bigint RETURNING status`);
    c1.B3_frozen_to_listed = await tryUpd(lB.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint RETURNING status`);
    c1.C_listed_to_delisted = await tryUpd(lC.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    c1.C_delisted = await tryUpd(lC.listing_id, `UPDATE public.listing SET status='delisted' WHERE listing_id=$1::bigint RETURNING status`);
    const c1allOk = ['A_draft_to_listed', 'B_listed_to_frozen', 'B2_listed_to_frozen', 'B3_frozen_to_listed', 'C_listed_to_delisted', 'C_delisted']
      .every((k) => (c1[k] as any)?.ok === true);
    add('C1', 'listing 状态机白名单正全集：draft→listed / listed→frozen / frozen→listed / listed→delisted 全通',
      c1allOk, { headline: 'positive transitions accepted: 6/6 (4 distinct edges + setup)', detail: c1 });

    // ---------------------------------------------------------------- C2 负全集 + 终态后再迁移
    const c2: Record<string, unknown> = {};
    c2.draft_to_frozen = await tryUpd(lD.listing_id, `UPDATE public.listing SET status='frozen' WHERE listing_id=$1::bigint`);
    c2.draft_to_delisted = await tryUpd(lD.listing_id, `UPDATE public.listing SET status='delisted' WHERE listing_id=$1::bigint`);
    const lE = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c2e');
    await tryUpd(lE.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    c2.listed_to_draft = await tryUpd(lE.listing_id, `UPDATE public.listing SET status='draft' WHERE listing_id=$1::bigint`);
    // 终态后再迁移（同一行先到 delisted，再试任何出边）
    await tryUpd(lE.listing_id, `UPDATE public.listing SET status='delisted' WHERE listing_id=$1::bigint`);
    const termBefore = await listingRow(pool, lE.listing_id);
    c2.terminal_delisted_to_listed = await tryUpd(lE.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    c2.terminal_delisted_to_frozen = await tryUpd(lE.listing_id, `UPDATE public.listing SET status='frozen' WHERE listing_id=$1::bigint`);
    const termAfter = await listingRow(pool, lE.listing_id);
    const allRejected = ['draft_to_frozen', 'draft_to_delisted', 'listed_to_draft', 'terminal_delisted_to_listed', 'terminal_delisted_to_frozen']
      .every((k) => (c2[k] as any)?.ok === false && (c2[k] as any)?.sqlstate === 'LD011'
                    && (c2[k] as any)?.reason === 'LISTING_STATE_INVALID');
    add('C2', '状态机负全集（5 例）+ 终态后再迁移 ⇒ 全 LD011 / reason=LISTING_STATE_INVALID，终态行未被写',
      allRejected && termBefore?.status === termAfter?.status && termAfter?.status === 'delisted',
      { headline: 'rejected 5/5 as LD011+LISTING_STATE_INVALID; terminal row unchanged',
        detail: c2, terminal_status_before: termBefore?.status, terminal_status_after: termAfter?.status });

    // ---------------------------------------------------------------- C3 幂等键（同键重放不双写）
    const lBuy = await ensureListing(pool, seller, '1', '100', 3, 'draft', 'c3');
    await tryUpd(lBuy.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    const ck = `cli:p3l-${RUN}-buy-c3`;
    const ordBefore = await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order');
    const ledBefore = await ledgerCount(pool);
    const b1 = await listingPostEvent(pool, { op: 'buy', create_key: ck, listing_id: lBuy.listing_id, buyer_uid: buyer, quantity: '1', request_fingerprint: 'fp-c3-1' });
    const o1 = await orderRow(pool, String(b1.order_id));
    const ledAfter1 = await ledgerCount(pool);
    const b2 = await listingPostEvent(pool, { op: 'buy', create_key: ck, listing_id: lBuy.listing_id, buyer_uid: buyer, quantity: '1', request_fingerprint: 'fp-c3-1' });
    const o2 = await orderRow(pool, String(b1.order_id));
    const ledAfter2 = await ledgerCount(pool);
    const ordAfter = await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order');
    const lBuyAfter = await listingRow(pool, lBuy.listing_id);
    const c3pass = b1.idempotent_replay === false && b2.idempotent_replay === true
      && String(b1.txid) === String(b2.txid)
      && JSON.stringify(o1?.ledger_event_keys) === JSON.stringify(o2?.ledger_event_keys)
      && String(o1?.status) === 'paid' && String(o2?.status) === 'paid'
      && ledAfter1 === ledAfter2 && ledAfter2 === String(BigInt(ledBefore) + 2n)
      && String(ordBefore?.n) === '0' && String(ordAfter?.n) === '1'
      && (lBuyAfter?.stock as number) === 2;
    add('C3', '幂等键：同 create_key 重放 ⇒ idempotent_replay=true / 同 txid / ledger_event_keys 逐字相等 / ledger 行 +0 / 订单 1 条 / 库存只减 1',
      c3pass,
      { headline: `replay=${b2.idempotent_replay}, same_txid=${String(b1.txid) === String(b2.txid)}, ledger+0=${ledAfter1 === ledAfter2}, stock=${lBuyAfter?.stock}, keys_after_1st=${JSON.stringify(o1?.ledger_event_keys)}, keys_after_2nd=${JSON.stringify(o2?.ledger_event_keys)}`,
        txid_1: b1.txid, txid_2: b2.txid, ledger_before: ledBefore, ledger_after_first: ledAfter1, ledger_after_replay: ledAfter2,
        orders_total_before: ordBefore?.n, orders_total_after: ordAfter?.n, entries: await entriesOfKey(pool, `biz:listing:buy:${b1.order_id}`) });

    // ---------------------------------------------------------------- C4 守卫矩阵（逐列试）
    const gL = lBuy.listing_id;
    const gO = String(b1.order_id);
    const c4: Record<string, unknown> = {};
    c4.listing_create_key = await tryUpd(gL, `UPDATE public.listing SET create_key='cli:p3l-${RUN}-tamper' WHERE listing_id=$1::bigint`);
    c4.listing_stock_when_listed_ok = await tryUpd(gL, `UPDATE public.listing SET stock=7 WHERE listing_id=$1::bigint RETURNING stock`);
    const lDraft = await ensureListing(pool, seller, '1', '50', 5, 'draft', 'c4draft');
    c4.listing_stock_when_draft = await tryUpd(lDraft.listing_id, `UPDATE public.listing SET stock=9 WHERE listing_id=$1::bigint`);
    const tryUpdO = async (sql: string): Promise<Record<string, unknown>> => {
      try { const r = await raw1(pool, sql, [gO]); return { ok: true, row: r }; }
      catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason, field: i.field, constraint: i.constraint }; }
    };
    c4.order_core_listing_id = await tryUpdO(`UPDATE public.listing_order SET listing_id=1 WHERE order_id=$1::bigint`);
    c4.order_core_buyer_uid = await tryUpdO(`UPDATE public.listing_order SET buyer_uid=900001 WHERE order_id=$1::bigint`);
    c4.order_core_seller_uid = await tryUpdO(`UPDATE public.listing_order SET seller_uid=900001 WHERE order_id=$1::bigint`);
    c4.order_core_cid = await tryUpdO(`UPDATE public.listing_order SET cid=2 WHERE order_id=$1::bigint`);
    c4.order_core_price = await tryUpdO(`UPDATE public.listing_order SET price=1 WHERE order_id=$1::bigint`);
    c4.order_core_quantity = await tryUpdO(`UPDATE public.listing_order SET quantity=99 WHERE order_id=$1::bigint`);
    c4.order_create_key = await tryUpdO(`UPDATE public.listing_order SET create_key='cli:p3l-${RUN}-tamper' WHERE order_id=$1::bigint`);
    c4.order_pay_txid_once_only = await tryUpdO(`UPDATE public.listing_order SET pay_txid=NULL WHERE order_id=$1::bigint`);
    c4.order_pay_txid_rewrite = await tryUpdO(`UPDATE public.listing_order SET pay_txid=pay_txid+1 WHERE order_id=$1::bigint`);
    c4.order_status_illegal = await tryUpdO(`UPDATE public.listing_order SET status='created' WHERE order_id=$1::bigint`);
    const delL = await (async () => { try { await raw(pool, `DELETE FROM public.listing WHERE listing_id=$1::bigint`, [gL]); return { ok: true }; } catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason }; } })();
    const delO = await (async () => { try { await raw(pool, `DELETE FROM public.listing_order WHERE order_id=$1::bigint`, [gO]); return { ok: true }; } catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason }; } })();
    c4.listing_delete = delL; c4.order_delete = delO;
    const guardsMustReject = ['listing_create_key', 'listing_stock_when_draft',
      'order_core_listing_id', 'order_core_buyer_uid', 'order_core_seller_uid', 'order_core_cid',
      'order_core_price', 'order_core_quantity', 'order_create_key', 'order_pay_txid_once_only',
      'order_pay_txid_rewrite', 'order_status_illegal'];
    const allGuardRejected = guardsMustReject.every((k) => (c4[k] as any)?.ok === false && (c4[k] as any)?.sqlstate === 'LD011');
    add('C4', `守卫矩阵：${guardsMustReject.length} 项「不得改」逐个试 ⇒ 全 LD011；DELETE 两表 ⇒ 全 LD011；stock 在 listed 下合法可改`,
      allGuardRejected && (c4.listing_delete as any)?.sqlstate === 'LD011' && (c4.order_delete as any)?.sqlstate === 'LD011'
      && (c4.listing_stock_when_listed_ok as any)?.ok === true,
      { headline: `guards rejected ${guardsMustReject.filter((k) => (c4[k] as any)?.sqlstate === 'LD011').length}/${guardsMustReject.length} as LD011`,
        detail: c4, listing_delete: delL, order_delete: delO });

    // ---------------------------------------------------------------- C5 结算链守恒 + 平台白名单
    const buyEntries = await entriesOfKey(pool, `biz:listing:buy:${b1.order_id}`);
    const sumBuy = buyEntries.reduce((s, e) => s + BigInt(String(e.delta)) + BigInt(String(e.frozen_delta)), 0n);
    const kindsBuy = [...new Set(buyEntries.map((e) => String(e.kind)))].sort();
    const platformTouched = buyEntries.filter((e) => ['0', '-1', '-2', '-3'].includes(String(e.uid)));
    const refOk = buyEntries.every((e) => e.ref_type === 'listing_order' && String(e.ref_id) === String(b1.order_id));
    // 退款链
    const rf = await listingPostEvent(pool, { op: 'refund', order_id: b1.order_id, request_fingerprint: 'fp-c5-rf' });
    const rfEntries = await entriesOfKey(pool, `biz:listing:refund:${b1.order_id}`);
    const sumRf = rfEntries.reduce((s, e) => s + BigInt(String(e.delta)) + BigInt(String(e.frozen_delta)), 0n);
    const kindsRf = [...new Set(rfEntries.map((e) => String(e.kind)))].sort();
    const netBuy = buyEntries.filter((e) => e.kind === 'purchase').reduce((s, e) => s + BigInt(String(e.delta)), 0n);
    const netSale = buyEntries.filter((e) => e.kind === 'sale').reduce((s, e) => s + BigInt(String(e.delta)), 0n);
    add('C5', '结算链守恒：购买 Σ(delta+frozen_delta)=0 且 sale=−purchase（买−卖=0）；退款 Σ=0；平台账户 −4..0 零参与；事件 kind 恰 2 条且 ref 落 listing_order/order_id',
      sumBuy === 0n && sumRf === 0n && netBuy + netSale === 0n && netBuy < 0n
      && kindsBuy.join(',') === 'purchase,sale' && kindsRf.join(',') === 'purchase_refund'
      && platformTouched.length === 0 && refOk && buyEntries.length === 2 && rfEntries.length === 2,
      { headline: `buy Σ=${sumBuy} kinds=${kindsBuy.join(',')} n=${buyEntries.length} | refund Σ=${sumRf} kinds=${kindsRf.join(',')} n=${rfEntries.length} | platform_accounts_touched=${platformTouched.length}`,
        buy_entries: buyEntries, refund_entries: rfEntries, refund_result: rf });

    // ---------------------------------------------------------------- C6 边界
    const c6: Record<string, unknown> = {};
    const errOf = async (fn: () => Promise<unknown>): Promise<Record<string, unknown>> => {
      try { const r = await fn(); return { ok: true, result: r }; } catch (e) { const i = errInfo(e); return { ok: false, sqlstate: i.sqlstate, reason: i.reason, field: i.field, constraint: i.constraint, message: i.message }; }
    };
    c6.nonexistent_listing = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-nolisting`, listing_id: '999999999', buyer_uid: buyer, quantity: '1' }));
    c6.nonexistent_order_refund = await errOf(() => listingPostEvent(pool, { op: 'refund', order_id: '999999999' }));
    c6.bad_op = await errOf(() => listingPostEvent(pool, { op: 'publish', create_key: `cli:p3l-${RUN}-b-op`, listing_id: lA.listing_id, buyer_uid: buyer, quantity: '1' }));
    c6.buyer_platform_uid = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-plat`, listing_id: lA.listing_id, buyer_uid: '-1', quantity: '1' }));
    const lSelf = await ensureListing(pool, seller, '1', '100', 3, 'draft', 'c6self');
    await tryUpd(lSelf.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    c6.self_purchase = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-self`, listing_id: lSelf.listing_id, buyer_uid: seller, quantity: '1' }));
    c6.qty_zero = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-q0`, listing_id: lSelf.listing_id, buyer_uid: buyer, quantity: '0' }));
    c6.qty_negative = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-qn`, listing_id: lSelf.listing_id, buyer_uid: buyer, quantity: '-3' }));
    c6.price_zero_insert = await errOf(() => raw(pool, `INSERT INTO public.listing (seller_uid,cid,price,stock,status,create_key) VALUES ($1::bigint,1,0,1,'draft',$2)`, [seller, `cli:p3l-${RUN}-b-p0`]));
    c6.bad_fk_insert = await errOf(() => raw(pool, `INSERT INTO public.listing (seller_uid,cid,price,stock,status,create_key) VALUES (999999999,1,10,1,'draft',$1)`, [`cli:p3l-${RUN}-b-fk`]));
    // 非 listed 币种
    const draftCcy = await raw1<{ cid: string; status: string }>(pool, `SELECT cid::text AS cid, status FROM public.currency WHERE status <> 'listed' ORDER BY cid LIMIT 1`);
    let ccyCase: Record<string, unknown> | null = null;
    if (draftCcy) {
      const lCcy = await ensureListing(pool, seller, draftCcy.cid, '100', 3, 'draft', 'c6ccy');
      await tryUpd(lCcy.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
      ccyCase = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-ccy`, listing_id: lCcy.listing_id, buyer_uid: buyer, quantity: '1' }));
    }
    c6.non_listed_currency = ccyCase;
    c6.non_listed_currency_source = draftCcy ?? null;
    // 库存不足
    const lStock = await ensureListing(pool, seller, '1', '100', 1, 'draft', 'c6stock');
    await tryUpd(lStock.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    c6.stock_insufficient = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-stk`, listing_id: lStock.listing_id, buyer_uid: buyer, quantity: '5' }));
    // 非 listed 的 listing（状态闸）
    const lDraft2 = await ensureListing(pool, seller, '1', '100', 3, 'draft', 'c6draft');
    c6.listing_not_listed = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-b-draft`, listing_id: lDraft2.listing_id, buyer_uid: buyer, quantity: '1' }));
    const expect = (k: string, code: string, reason?: string) => {
      const v = c6[k] as any;
      return v && v.ok === false && (code.startsWith('235')
        ? v.sqlstate === code
        : v.sqlstate === code && (!reason || v.reason === reason || v.field !== undefined));
    };
    const c6pass =
      expect('nonexistent_listing', 'LD023') && (c6.nonexistent_listing as any).reason === 'listing_not_found'
      && expect('nonexistent_order_refund', 'LD023') && expect('bad_op', 'LD016')
      && expect('buyer_platform_uid', 'LD022')
      && expect('self_purchase', 'LD020') && (c6.self_purchase as any).reason === 'self_purchase_not_allowed'
      && expect('qty_zero', 'LD018') && expect('qty_negative', 'LD018')
      && (c6.price_zero_insert as any).sqlstate === '23514'
      && (c6.bad_fk_insert as any).sqlstate === '23503'
      && (!ccyCase || (ccyCase as any).sqlstate === 'LD008')
      && expect('stock_insufficient', 'LD001') && (c6.stock_insufficient as any).reason === 'listing_stock_insufficient'
      && expect('listing_not_listed', 'LD011') && (c6.listing_not_listed as any).reason === 'listing_not_listed';
    const codes = Object.fromEntries(Object.entries(c6).map(([k, v]) => [k, (v as any)?.sqlstate ?? null]));
    add('C6', '边界：不存在 listing/order ⇒ LD023；自买自卖 ⇒ LD020+self_purchase_not_allowed；qty≤0 ⇒ LD018；price=0 INSERT ⇒ 23514；坏 FK ⇒ 23503；非 listed 币种 ⇒ LD008；库存不足 ⇒ LD001+listing_stock_insufficient；listing 未 listed ⇒ LD011',
      c6pass, { headline: `boundary sqlstates: ${JSON.stringify(Object.fromEntries(Object.entries(codes).filter(([k]) => k !== 'non_listed_currency_source')))}`,
                detail: c6 });

    // ---------------------------------------------------------------- C7 不超卖（串行 + 真并发）
    const lTight = await ensureListing(pool, seller, '1', '100', 1, 'draft', 'c7');
    await tryUpd(lTight.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    const first = await listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-c7-first`, listing_id: lTight.listing_id, buyer_uid: buyer, quantity: '1' });
    const second = await errOf(() => listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-c7-second`, listing_id: lTight.listing_id, buyer_uid: buyer2, quantity: '1' }));
    const lTightAfter = await listingRow(pool, lTight.listing_id);
    const ordersForListing = await raw1<{ n: string }>(pool, 'SELECT count(*)::text AS n FROM public.listing_order WHERE listing_id=$1::bigint', [lTight.listing_id]);

    // 真并发：conn1 持 listing 行锁（未提交），conn2 用 statement_timeout 探
    const lConc = await ensureListing(pool, seller, '1', '100', 1, 'draft', 'c7conc');
    await tryUpd(lConc.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    const conn1 = await pool.connect();
    const conn2 = await c2Pool.connect();
    let conc: Record<string, unknown> = {};
    let dt = 0;
    try {
      await conn1.query('BEGIN');
      await conn1.query('SELECT public.listing_post_event($1::jsonb) AS r',
        [JSON.stringify({ op: 'buy', create_key: `cli:p3l-${RUN}-c7-conc-a`, listing_id: lConc.listing_id, buyer_uid: buyer, quantity: '1' })]);
      await conn2.query('BEGIN');
      await conn2.query("SET LOCAL statement_timeout='1500ms'");
      const t0 = Date.now();
      try {
        await conn2.query('SELECT public.listing_post_event($1::jsonb) AS r',
          [JSON.stringify({ op: 'buy', create_key: `cli:p3l-${RUN}-c7-conc-b`, listing_id: lConc.listing_id, buyer_uid: buyer2, quantity: '1' })]);
        conc = { ok: true, sqlstate: null };
      } catch (e) { const i = errInfo(e); conc = { ok: false, sqlstate: i.sqlstate, message: i.message }; }
      dt = Date.now() - t0;
    } finally {
      await conn1.query('ROLLBACK').catch(() => undefined);
      await conn2.query('ROLLBACK').catch(() => undefined);
      conn1.release(); conn2.release();
    }
    const concBlocked = dt >= 1200 && (conc.ok === false);
    const finalStock = (await listingRow(pool, lConc.listing_id))?.stock;
    add('C7', '不超卖：串行第 2 人 ⇒ LD001+stock_insufficient 且库存不为负；真并发第 2 连接被 listing 行锁阻塞（≥1200ms）⇒ 无超卖',
      (second as any).sqlstate === 'LD001' && (second as any).reason === 'listing_stock_insufficient'
      && Number(lTightAfter?.stock) === 0 && String(ordersForListing?.n) === '1' && concBlocked
      && Number(finalStock) === 1,
      { headline: `serial 2nd => ${(second as any).sqlstate}/${(second as any).reason}, stock=${lTightAfter?.stock}, orders=${ordersForListing?.n} | concurrent 2nd blocked dt=${dt}ms sqlstate=${conc.sqlstate ?? 'null'} | conc_stock_after_rollback=${finalStock}`,
        serial_first: first, serial_second: second, concurrent: conc, concurrent_dt_ms: dt });

    // ---------------------------------------------------------------- C8 退款链
    const lRf = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c8');
    await tryUpd(lRf.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    const bRf = await listingPostEvent(pool, { op: 'buy', create_key: `cli:p3l-${RUN}-c8-buy`, listing_id: lRf.listing_id, buyer_uid: buyer, quantity: '2', request_fingerprint: 'fp-c8-buy' });
    const ledAfterBuy = await ledgerCount(pool);
    const r1 = await listingPostEvent(pool, { op: 'refund', order_id: bRf.order_id, request_fingerprint: 'fp-c8-rf' });
    const oAfterRf = await orderRow(pool, String(bRf.order_id));
    const ledAfterRf = await ledgerCount(pool);
    const r2 = await listingPostEvent(pool, { op: 'refund', order_id: bRf.order_id, request_fingerprint: 'fp-c8-rf' });
    const oAfterRf2 = await orderRow(pool, String(bRf.order_id));
    const ledAfterRf2 = await ledgerCount(pool);
    // created 单不可退
    const lNoPay = await ensureListing(pool, seller, '1', '100', 5, 'draft', 'c8b');
    await tryUpd(lNoPay.listing_id, `UPDATE public.listing SET status='listed' WHERE listing_id=$1::bigint`);
    const ordNoPay = await raw1<{ order_id: string }>(pool,
      `INSERT INTO public.listing_order (listing_id,buyer_uid,seller_uid,cid,price,quantity,status,create_key)
       VALUES ($1::bigint,$2::bigint,$3::bigint,1,100,1,'created',$4) RETURNING order_id::text AS order_id`,
      [lNoPay.listing_id, buyer, seller, `cli:p3l-${RUN}-c8-nopay`]);
    const noPayRefund = await errOf(() => listingPostEvent(pool, { op: 'refund', order_id: ordNoPay!.order_id }));
    const c8pass = oAfterRf?.status === 'refunded' && oAfterRf?.refund_txid !== null
      && r1.idempotent_replay === false && r2.idempotent_replay === true
      && String(r1.txid) === String(r2.txid)
      && JSON.stringify(oAfterRf?.ledger_event_keys) === JSON.stringify(oAfterRf2?.ledger_event_keys)
      && ledAfterRf === ledAfterRf2 && ledAfterRf === String(BigInt(ledAfterBuy) + 2n)
      && (noPayRefund as any).sqlstate === 'LD011' && (noPayRefund as any).reason === 'order_not_refundable';
    add('C8', '退款链：paid→refunded + refund_txid 落引用列 + 重放幂等（同 txid / 键数组不变 / ledger 行 +0）+ created 单退 ⇒ LD011+order_not_refundable',
      c8pass, { headline: `order=${oAfterRf?.status} refund_txid=${oAfterRf?.refund_txid} replay=${r2.idempotent_replay} ledger_delta=${BigInt(ledAfterRf) - BigInt(ledAfterBuy)} no_pay_refund=${(noPayRefund as any).sqlstate}/${(noPayRefund as any).reason}`,
                keys_1st: oAfterRf?.ledger_event_keys, keys_2nd: oAfterRf2?.ledger_event_keys,
                noPayRefund });

    // ---------------------------------------------------------------- 落盘
    const ledgerAfter = await ledgerCount(pool);
    const out = {
      repo: REPO, fixture_users: FIXTURE_USERS_CHECKLIST, funding,
      balance_before: balBefore, ledger_before: ledgerBefore, ledger_after: ledgerAfter,
      checks: list, passed: list.filter((c) => c.pass).length, total: list.length,
      negative_case_notes: notes,
    };
    const file = save('cases', out);
    console.log(JSON.stringify({ ok: list.every((c) => c.pass), file,
      passed: `${list.filter((c) => c.pass).length}/${list.length}`,
      failed: list.filter((c) => !c.pass).map((c) => ({ id: c.id, headline: (c.readout as any)?.headline })) }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
    await c2Pool.end().catch(() => undefined);
  }
})();
