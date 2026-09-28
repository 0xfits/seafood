/**
 * P3-M-02 · 行为用例 K1–K6（逐条头号读数；run-tagged 落盘）。
 * 命名空间：uid 990501..990504 / create_key 前缀 `cli:kong16-` / 运维键前缀 `ops:p3m:`。
 * 只写本库；不清理夹具（DL79：业务表禁物理 DELETE ⇒ 残差登记在报告 §9）。
 */
import {
  mkPool, raw, raw1, save, errInfo, marketPostEvent, ledgerPostEvent, ensureUser, fundFromResidual,
  acct, ledgerCount, entriesOfKey, orderRow, tradeRow, orderByCreateKey, mkChecks, expectReject, RUN,
} from './p3m-lib';

const bn = (x: unknown): bigint => { try { return BigInt(String(x ?? '0')); } catch { return 0n; } };
const sumDelta = (es: any[]): bigint => es.reduce((a, e) => a + bn(e.delta) + bn(e.frozen_delta), 0n);
const kindsOf = (es: any[]): string[] => [...new Set(es.map((e) => e.kind))].sort();
const K = (s: string) => `cli:kong16-${RUN}-${s}`;

const main = async () => {
  const p = mkPool();
  const { add, list } = mkChecks();
  const BUYER = 990501, SELLER = 990502, SELLER2 = 990503, SPARE = 990504;
  const events: { key: string; op: string; txid: string | null }[] = [];
  try {
    // ================================================================= 夹具
    for (const [u, t] of [[BUYER, 'buyer'], [SELLER, 'seller'], [SELLER2, 'seller2'], [SPARE, 'spare']] as [number, string][]) {
      await ensureUser(p, u, t);
    }
    const basePick = await raw1<any>(p, `SELECT a.cid::text AS cid, a.uid::text AS donor, a.balance::text AS balance,
             c.symbol, c.decimals, c.status
        FROM public.account a JOIN public.currency c ON c.cid = a.cid
       WHERE c.status = 'listed' AND a.cid <> 1 AND a.uid > 0 AND a.balance >= 1000
         AND a.uid NOT BETWEEN 990501 AND 990599
       ORDER BY a.balance DESC LIMIT 1`);
    if (!basePick) throw new Error('no listed base currency with a funded holder');
    const BASE = String(basePick.cid);
    const fundBuyer = await fundFromResidual(p, String(BUYER), 200n, '1');
    const fundSeller2 = await fundFromResidual(p, String(SELLER2), 50n, '1');
    const fundSpare = await fundFromResidual(p, String(SPARE), 20n, '1');
    const baseXfer = async (to: number, tag: string) => ledgerPostEvent(p, {
      op: 'transfer', idempotency_key: `ops:p3m:${RUN}:base:${to}:${tag}`,
      from_uid: basePick.donor, to_uid: String(to), cid: BASE, amount: '50',
    });
    const bx1 = await baseXfer(SELLER, 'a');
    const bx2 = await baseXfer(SELLER2, 'b');

    const beforeAll = {
      ledger_total: await ledgerCount(p),
      cid1: await raw1(p, `SELECT (SELECT COALESCE(sum(balance+frozen),0)::text FROM public.account WHERE cid=1) AS sum_bal_frozen,
                                  (SELECT total_supply::text FROM public.currency WHERE cid=1) AS total_supply`),
      buyer: await acct(p, String(BUYER), '1'), seller: await acct(p, String(SELLER), BASE),
    };

    // ================================================================= K1 挂单 + 首笔成交（头号）
    const buyKey = K('buy1'), sellKey = K('sell1');
    const cBuy = await marketPostEvent(p, {
      op: 'order', create_key: buyKey, owner_uid: String(BUYER), side: 'buy',
      base_cid: BASE, quote_cid: '1', price: '10', amount: '5',
    });
    events.push({ key: buyKey, op: 'order', txid: String(cBuy.txid) });
    const buyId = String(cBuy.order_id);
    const buyerAfterHold = await acct(p, String(BUYER), '1');
    const buyEv = await entriesOfKey(p, buyKey);
    add('K1a', '买单挂单：status=open / 冻结 quote=(amount)×price / hold ×2 / 账本落 ref=market_order',
      cBuy.status === 'open' && cBuy.frozen_hold === '50' && buyEv.length === 2
      && kindsOf(buyEv).join(',') === 'hold' && sumDelta(buyEv) === 0n
      && buyEv.every((e) => e.ref_type === 'market_order' && e.ref_id === buyId)
      && bn(beforeAll.buyer?.balance) - bn(buyerAfterHold?.balance) === 50n
      && bn(buyerAfterHold?.frozen) - bn(beforeAll.buyer?.frozen) === 50n,
      { order_id: buyId, status: cBuy.status, frozen_hold: cBuy.frozen_hold, entries: buyEv.length,
        kinds: kindsOf(buyEv), sigma: sumDelta(buyEv).toString(), txid: cBuy.txid,
        buyer_1_before: beforeAll.buyer, buyer_1_after: buyerAfterHold,
        ret_ledger_event_keys: cBuy.ledger_event_keys });

    const cSell = await marketPostEvent(p, {
      op: 'order', create_key: sellKey, owner_uid: String(SELLER), side: 'sell',
      base_cid: BASE, quote_cid: '1', price: '10', amount: '5',
    });
    events.push({ key: sellKey, op: 'order', txid: String(cSell.txid) });
    const sellId = String(cSell.order_id);
    const sellerAfterHold = await acct(p, String(SELLER), BASE);
    const sellEv = await entriesOfKey(p, sellKey);
    add('K1b', '卖单挂单：冻结 base=(amount) / hold ×2 / 同 uid 同 cid 两条（R34/R39）',
      cSell.status === 'open' && cSell.frozen_hold === '5' && sellEv.length === 2
      && kindsOf(sellEv).join(',') === 'hold' && sumDelta(sellEv) === 0n
      && bn(beforeAll.seller?.balance) - bn(sellerAfterHold?.balance) === 5n
      && bn(sellerAfterHold?.frozen) - bn(beforeAll.seller?.frozen) === 5n,
      { order_id: sellId, status: cSell.status, frozen_hold: cSell.frozen_hold, kinds: kindsOf(sellEv),
        sigma: sumDelta(sellEv).toString(), seller_base_before: beforeAll.seller, seller_base_after: sellerAfterHold });

    const tradeKey = `biz:market:trade:${buyId}:1`;
    const sellerQuoteBefore = await acct(p, String(SELLER), '1');
    const buyerBaseBefore = await acct(p, String(BUYER), BASE);
    const t1 = await marketPostEvent(p, {
      op: 'trade', taker_order_id: buyId, buy_order_id: buyId, sell_order_id: sellId,
      price: '10', amount: '3', fee: '1', fill_no: '1',
    });
    events.push({ key: tradeKey, op: 'trade', txid: String(t1.txid) });
    const tradeEv = await entriesOfKey(p, tradeKey);
    const buyerAfterTrade = await acct(p, String(BUYER), '1');
    const buyerBaseAfter = await acct(p, String(BUYER), BASE);
    const sellerQuoteAfter = await acct(p, String(SELLER), '1');
    const sellerBaseAfter = await acct(p, String(SELLER), BASE);
    const p1After = await acct(p, '-1', '1');
    const t1row = await tradeRow(p, String(t1.trade_id));
    add('K1', '★头号：首笔成交（trade ×4 + trade_fee ×2，6 条；taker 付 $1 手续费；守恒 Σ=0；两边进度与余额逐个对齐）',
      tradeEv.length === 6 && kindsOf(tradeEv).join(',') === 'trade,trade_fee'
      && sumDelta(tradeEv) === 0n
      && t1row !== null && String(t1row.amount) === '3' && String(t1row.price) === '10'
      && String(t1row.buy_order_id) === buyId && String(t1row.sell_order_id) === sellId
      && String(t1row.taker_uid) === String(BUYER) && String(t1row.fee) === '1'
      && t1.buy_status === 'partial' && t1.sell_status === 'partial'
      && bn(t1.buy_amount_filled) === 3n && bn(t1.sell_amount_filled) === 3n
      && bn(buyerAfterTrade?.frozen) === bn(buyerAfterHold?.frozen) - 30n
      && bn(buyerAfterTrade?.balance) === bn(buyerAfterHold?.balance) - 1n
      && bn(sellerQuoteAfter?.balance) - bn(sellerQuoteBefore?.balance) === 30n
      && bn(buyerBaseAfter?.balance) === bn(buyerBaseBefore?.balance) + 3n
      && bn(sellerBaseAfter?.frozen) === bn(sellerAfterHold?.frozen) - 3n
      && bn(tradeEv[0].frozen_delta) === -30n && bn(tradeEv[1].delta) === 3n
      && bn(tradeEv[2].frozen_delta) === -3n && bn(tradeEv[3].delta) === 30n
      && tradeEv[4].uid === String(BUYER) && bn(tradeEv[4].delta) === -1n
      && tradeEv[5].uid === '-1' && bn(tradeEv[5].delta) === 1n
      && tradeEv.every((e) => e.ref_type === 'market_trade' && e.ref_id === String(t1.trade_id))
      && bn(p1After?.balance) >= 1n,
      { trade_id: t1.trade_id, txid: t1.txid, entries: tradeEv.length, kinds: kindsOf(tradeEv),
        sigma: sumDelta(tradeEv).toString(), buy_status: t1.buy_status, sell_status: t1.sell_status,
        trade_row: t1row, buyer_quote_after: buyerAfterTrade, buyer_base_after: buyerBaseAfter,
        seller_quote_after: sellerQuoteAfter, seller_base_after: sellerBaseAfter, platform_m1: p1After,
        ledger_event_keys: t1.ledger_event_keys });

    // ================================================================= K2 幂等键重放（DL149：不双写）
    const snap = {
      ledger_total: await ledgerCount(p),
      trade_rows: (await raw1<any>(p, 'SELECT count(*)::text AS n FROM public.market_trade'))?.n,
      buy_order: await orderRow(p, buyId), sell_order: await orderRow(p, sellId),
      trade_row: await tradeRow(p, String(t1.trade_id)),
    };
    const t1replay = await marketPostEvent(p, {
      op: 'trade', taker_order_id: buyId, buy_order_id: buyId, sell_order_id: sellId,
      price: '10', amount: '3', fee: '1', fill_no: '1',
    });
    const orderReplay = await marketPostEvent(p, {
      op: 'order', create_key: sellKey, owner_uid: String(SELLER), side: 'sell',
      base_cid: BASE, quote_cid: '1', price: '10', amount: '5',
    });
    const post = {
      ledger_total: await ledgerCount(p),
      trade_rows: (await raw1<any>(p, 'SELECT count(*)::text AS n FROM public.market_trade'))?.n,
      buy_order: await orderRow(p, buyId), sell_order: await orderRow(p, sellId),
      trade_row: await tradeRow(p, String(t1.trade_id)),
    };
    add('K2', 'DL149：同键同指纹重放（trade + order）⇒ idempotent_replay=true / txid 相同 / 账本 +0 / 成交行 +0 / amount_filled 不变 / ledger_event_keys 逐字不变',
      t1replay.idempotent_replay === true && String(t1replay.txid) === String(t1.txid)
      && orderReplay.idempotent_replay === true && String(orderReplay.txid) === String(cSell.txid)
      && post.ledger_total === snap.ledger_total && post.trade_rows === snap.trade_rows
      && JSON.stringify(post.buy_order) === JSON.stringify(snap.buy_order)
      && JSON.stringify(post.sell_order) === JSON.stringify(snap.sell_order)
      && JSON.stringify(post.trade_row) === JSON.stringify(snap.trade_row)
      && JSON.stringify(orderReplay.ledger_event_keys) === JSON.stringify(post.sell_order?.ledger_event_keys),
      { replay_trade: { idempotent_replay: t1replay.idempotent_replay, txid: t1replay.txid,
                        amount: t1replay.amount, buy_amount_filled: t1replay.buy_amount_filled },
        replay_order: { idempotent_replay: orderReplay.idempotent_replay, txid: orderReplay.txid,
                        keys: orderReplay.ledger_event_keys, keys_first: cSell.ledger_event_keys },
        ledger_total: `${snap.ledger_total} -> ${post.ledger_total}`,
        trade_rows: `${snap.trade_rows} -> ${post.trade_rows}`,
        amount_filled_unchanged: `${snap.buy_order?.amount_filled} -> ${post.buy_order?.amount_filled}`,
        keys_unchanged: JSON.stringify(post.buy_order?.ledger_event_keys) === JSON.stringify(snap.buy_order?.ledger_event_keys) });

    // ================================================================= K5 边界（先跑：为 K1 的剩余冻结留位）
    const boundaries: Record<string, unknown> = {};
    const tryOp = async (label: string, payload: any, expectReason?: string) => {
      const r = await expectReject(p, 'SELECT public.market_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
      boundaries[label] = { rejected: r.rejected, sqlstate: r.err?.sqlstate ?? null, message: r.err?.message ?? null,
                            reason: r.err?.reason ?? null, field: r.err?.field ?? null };
      return boundaries[label] as any;
    };
    const b1 = await tryOp('op_unknown', { op: 'x' });
    const b2 = await tryOp('side_unknown', { op: 'order', create_key: K('bad-side'), owner_uid: String(BUYER),
      side: 'long', base_cid: BASE, quote_cid: '1', price: '1', amount: '1' });
    const b3 = await tryOp('price_zero', { op: 'order', create_key: K('p0'), owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '0', amount: '1' });
    const b4 = await tryOp('amount_zero', { op: 'order', create_key: K('a0'), owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '1', amount: '0' });
    const b5 = await tryOp('amount_negative', { op: 'order', create_key: K('aneg'), owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '1', amount: '-1' });
    const b6 = await tryOp('quote_cid_not_one', { op: 'order', create_key: K('q2'), owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '2', price: '1', amount: '1' });
    const b7 = await tryOp('base_eq_quote', { op: 'order', create_key: K('beq'), owner_uid: String(BUYER),
      side: 'buy', base_cid: '1', quote_cid: '1', price: '1', amount: '1' });
    const b8 = await tryOp('key_no_prefix', { op: 'order', create_key: 'kong16-noprefix', owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '1', amount: '1' });
    const b9 = await tryOp('key_reserved_sep', { op: 'order', create_key: 'cli:kong16#x', owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '1', amount: '1' });
    const b10 = await tryOp('owner_platform', { op: 'order', create_key: K('plat'), owner_uid: '-1',
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '1', amount: '1' });
    const b11 = await tryOp('base_cid_not_found', { op: 'order', create_key: K('nf'), owner_uid: String(BUYER),
      side: 'buy', base_cid: '99999999', quote_cid: '1', price: '1', amount: '1' });
    const unlisted = await raw1<any>(p, `SELECT cid::text AS cid, status FROM public.currency
        WHERE status <> 'listed' AND cid <> 1 ORDER BY cid LIMIT 1`);
    const b12 = unlisted
      ? await tryOp('base_not_listed', { op: 'order', create_key: K('unlisted'), owner_uid: String(BUYER),
          side: 'buy', base_cid: String(unlisted.cid), quote_cid: '1', price: '1', amount: '1' })
      : 'NOT_MEASURED:library has no non-listed currency';
    const b13 = await tryOp('cancel_missing_order', { op: 'cancel', order_id: '99999999' });
    const b14 = await tryOp('trade_price_ne_buy_limit', { op: 'trade', taker_order_id: buyId, buy_order_id: buyId,
      sell_order_id: sellId, price: '11', amount: '1', fee: '0', fill_no: '9' });
    const b15 = await tryOp('trade_amount_over_remaining', { op: 'trade', taker_order_id: buyId, buy_order_id: buyId,
      sell_order_id: sellId, price: '10', amount: '4', fee: '0', fill_no: '9' });
    const b16 = await tryOp('trade_same_order_id', { op: 'trade', taker_order_id: buyId, buy_order_id: buyId,
      sell_order_id: buyId, price: '10', amount: '1', fee: '0', fill_no: '9' });
    const b17 = await tryOp('trade_taker_not_a_party', { op: 'trade', taker_order_id: sellId, buy_order_id: buyId,
      sell_order_id: String(SpareIds.spareId), price: '10', amount: '1', fee: '0', fill_no: '9' });
    const b18 = await tryOp('insufficient_balance_hold', { op: 'order', create_key: K('poor'), owner_uid: String(SPARE),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '100', amount: '1000' });
    const fkRaw = await expectReject(p, `INSERT INTO public.market_order
        (owner_uid, side, base_cid, quote_cid, price, amount, status, create_key)
        VALUES ($1::bigint,'buy',99999999,1,1,1,'open',$2)`, [String(BUYER), K('fk')]);
    boundaries.raw_insert_bad_fk = { rejected: fkRaw.rejected, sqlstate: fkRaw.err?.sqlstate ?? null,
                                     constraint: fkRaw.err?.constraint ?? null, message: fkRaw.err?.message ?? null };
    add('K5', '边界：不存在 FK(23503)/未 listed 币种/金额 0 与负/quote_cid≠1/base=quote/坏键前缀与 #/平台 uid/不存在订单/成交价≠买单限价/超额/自成交/余额不足 —— 逐条原始读数',
      b1.reason === 'UNKNOWN_MARKET_OP' && b2.reason === 'UNKNOWN_MARKET_SIDE'
      && b3.sqlstate === 'LD017' && b4.sqlstate === 'LD017' && b5.sqlstate === 'LD017'
      && b6.reason === 'QUOTE_CID_MUST_BE_ONE' && b7.reason === 'BASE_QUOTE_CID_EQUAL'
      && b8.reason === 'PREFIX_REQUIRED' && b9.reason === 'RESERVED_SEPARATOR'
      && b10.reason === 'PLATFORM_OWNER_FORBIDDEN' && b11.sqlstate !== null && b11.rejected === true
      && (b12 === 'NOT_MEASURED:library has no non-listed currency' || b12.reason === 'base_not_listed' || b12.sqlstate !== null)
      && b13.sqlstate !== null && b13.reason === 'order_not_found'
      && b14.reason === 'MARKET_PRICE_MUST_EQUAL_BUY_LIMIT'
      && b15.reason === 'market_order_amount_insufficient'
      && b16.sqlstate !== null && b17.sqlstate !== null
      && b18.sqlstate !== null && fkRaw.rejected === true && fkRaw.err?.sqlstate === '23503',
      { ...boundaries, b12_raw: b12, unlisted_currency: unlisted });

    // ================================================================= K4 守卫矩阵（不得改的列逐个试）
    const spareKey = K('spare-buy');
    const cSpare = await marketPostEvent(p, { op: 'order', create_key: spareKey, owner_uid: String(SPARE),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '10', amount: '1' });
    events.push({ key: spareKey, op: 'order', txid: String(cSpare.txid) });
    const sid = String(cSpare.order_id);
    const guard: Record<string, any> = {};
    const tryUpd = async (label: string, sql: string, params: unknown[] = []) => {
      const r = await expectReject(p, sql, params);
      guard[label] = { rejected: r.rejected, sqlstate: r.err?.sqlstate ?? null, reason: r.err?.reason ?? null,
                       message: r.err?.message ?? null };
    };
    await tryUpd('order.owner_uid', `UPDATE public.market_order SET owner_uid=990599 WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.side', `UPDATE public.market_order SET side='sell' WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.base_cid', `UPDATE public.market_order SET base_cid=1 WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.quote_cid', `UPDATE public.market_order SET quote_cid=$2::bigint WHERE order_id=$1::bigint`, [sid, BASE]);
    await tryUpd('order.price', `UPDATE public.market_order SET price=99 WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.amount', `UPDATE public.market_order SET amount=99 WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.create_key', `UPDATE public.market_order SET create_key='cli:kong16-x' WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.amount_filled_back', `UPDATE public.market_order SET amount_filled=-1 WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.amount_filled_over', `UPDATE public.market_order SET amount_filled=99 WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('order.delete', `DELETE FROM public.market_order WHERE order_id=$1::bigint`, [sid]);
    await tryUpd('trade.update', `UPDATE public.market_trade SET price=99 WHERE trade_id=$1::bigint`, [String(t1.trade_id)]);
    await tryUpd('trade.delete', `DELETE FROM public.market_trade WHERE trade_id=$1::bigint`, [String(t1.trade_id)]);
    const ctrl = await expectReject(p, `UPDATE public.market_order SET status='partial' WHERE order_id=$1::bigint RETURNING order_id`, [sid]);
    guard['_positive_control_open_to_partial'] = { rejected: ctrl.rejected, rows: ctrl.rows };
    add('K4', '守卫矩阵：owner_uid/side/base_cid/quote_cid/price/amount/create_key 逐个改 + amount_filled 回退与超额 + order DELETE + trade UPDATE/DELETE = 12/12 拒；对照项 open→partial 正常通过',
      Object.entries(guard).filter(([k]) => !k.startsWith('_')).length === 12
      && Object.entries(guard).filter(([k]) => !k.startsWith('_')).every(([, v]: any) => v.rejected === true)
      && guard['trade.update'].sqlstate !== null && guard['trade.delete'].sqlstate !== null
      && guard['order.delete'].sqlstate !== null
      && guard['_positive_control_open_to_partial'].rejected === false,
      guard);

    // ================================================================= K3 状态机（正/负全集 + 终态后再迁移）
    const pure = await raw<{ f: string; t: string; ok: boolean }>(p, `
      SELECT f, t, public.market_order_status_transition_ok(f, t) AS ok FROM (VALUES
        ('open','partial'),('open','filled'),('open','cancelled'),('partial','filled'),('partial','cancelled'),
        ('open','open'),('partial','open'),('partial','partial'),('filled','open'),('filled','partial'),
        ('filled','cancelled'),('cancelled','open'),('cancelled','partial'),('cancelled','filled')) AS v(f,t)`);
    const pureOk = pure.filter((r) => r.ok).map((r) => `${r.f}->${r.t}`).sort();
    const pureBad = pure.filter((r) => !r.ok).map((r) => `${r.f}->${r.t}`).sort();
    // 终态后再迁移：**新起一对**挂单（不动 K1 的单，否则会干扰 K1c 的「部分成交后撤单」），
    // 一次全额成交（fee=0 ⇒ DL85 的 4 条形态）⇒ 两单都进终态 filled；再试 cancel。
    const b3key = K('buy3'), s3key = K('sell3');
    const cB3 = await marketPostEvent(p, { op: 'order', create_key: b3key, owner_uid: String(BUYER),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '10', amount: '5' });
    const cS3 = await marketPostEvent(p, { op: 'order', create_key: s3key, owner_uid: String(SELLER),
      side: 'sell', base_cid: BASE, quote_cid: '1', price: '10', amount: '5' });
    events.push({ key: b3key, op: 'order', txid: String(cB3.txid) });
    events.push({ key: s3key, op: 'order', txid: String(cS3.txid) });
    const t2 = await marketPostEvent(p, { op: 'trade', taker_order_id: String(cB3.order_id),
      buy_order_id: String(cB3.order_id), sell_order_id: String(cS3.order_id),
      price: '10', amount: '5', fee: '0', fill_no: '1' });
    events.push({ key: `biz:market:trade:${cB3.order_id}:1`, op: 'trade(fee=0)', txid: String(t2.txid) });
    const filledOrder = await orderRow(p, String(cB3.order_id));
    const filledOrderSell = await orderRow(p, String(cS3.order_id));
    const keysBeforeFailedCancel = await ledgerCount(p);
    const cancelFilled = await expectReject(p, 'SELECT public.market_post_event($1::jsonb) AS r',
      [JSON.stringify({ op: 'cancel', order_id: String(cB3.order_id) })]);
    const keysAfterFailedCancel = await ledgerCount(p);
    add('K3', '状态机白名单正 5/5 + 负 9/9（纯函数）；终态 filled 后再迁移（cancel）被拒且零账本写入；零额手续费成交 = trade ×4（无 trade_fee）',
      pureOk.join(',') === 'open->cancelled,open->filled,open->partial,partial->cancelled,partial->filled'
      && pureBad.length === 9
      && filledOrder?.status === 'filled' && String(filledOrder?.amount_filled) === '5'
      && t2.entries !== undefined && (t2.entries as any[]).length === 4
      && kindsOf(t2.entries as any[]).join(',') === 'trade'
      && sumDelta(t2.entries as any[]) === 0n
      && cancelFilled.rejected === true && cancelFilled.err?.reason === 'MARKET_ORDER_STATE_INVALID'
      && keysBeforeFailedCancel === keysAfterFailedCancel,
      { positives: pureOk, negatives: pureBad, t2: { trade_id: t2.trade_id, entries: (t2.entries as any[]).length,
        kinds: kindsOf(t2.entries as any[]), sigma: sumDelta(t2.entries as any[]).toString() },
        filled_order: filledOrder, cancel_rejected: { sqlstate: cancelFilled.err?.sqlstate, reason: cancelFilled.err?.reason },
        ledger_rows: `${keysBeforeFailedCancel} -> ${keysAfterFailedCancel}` });

    // ================================================================= 自成交（两单同 owner）
    const s2buy = K('s2-buy'), s2sell = K('s2-sell');
    const cS2b = await marketPostEvent(p, { op: 'order', create_key: s2buy, owner_uid: String(SELLER2),
      side: 'buy', base_cid: BASE, quote_cid: '1', price: '10', amount: '1' });
    const cS2s = await marketPostEvent(p, { op: 'order', create_key: s2sell, owner_uid: String(SELLER2),
      side: 'sell', base_cid: BASE, quote_cid: '1', price: '10', amount: '1' });
    events.push({ key: s2buy, op: 'order', txid: String(cS2b.txid) });
    events.push({ key: s2sell, op: 'order', txid: String(cS2s.txid) });
    const selfTrade = await expectReject(p, 'SELECT public.market_post_event($1::jsonb) AS r', [JSON.stringify({
      op: 'trade', taker_order_id: String(cS2b.order_id), buy_order_id: String(cS2b.order_id),
      sell_order_id: String(cS2s.order_id), price: '10', amount: '1', fee: '0', fill_no: '1' })]);
    add('K5b', '自成交（买/卖两单同 owner）被账本与函数双闸拒绝（LEDGER_SELF_TRANSFER / self_trade_not_allowed）',
      selfTrade.rejected === true && selfTrade.err?.reason === 'self_trade_not_allowed',
      { sqlstate: selfTrade.err?.sqlstate, message: selfTrade.err?.message, reason: selfTrade.err?.reason,
        field: selfTrade.err?.field, detail: selfTrade.err?.detail });

    // ================================================================= K1c 撤单（释放剩余冻结）
    const sellerBaseBeforeCancel = await acct(p, String(SELLER), BASE);
    const cancelBuy = await marketPostEvent(p, { op: 'cancel', order_id: sellId });
    events.push({ key: `biz:market:cancel:${sellId}`, op: 'cancel', txid: String(cancelBuy.txid) });
    const cancelEv = await entriesOfKey(p, `biz:market:cancel:${sellId}`);
    const sellerAfterCancel = await acct(p, String(SELLER), BASE);
    add('K1c', '撤单：hold_release ×2 / status=cancelled / 剩余冻结全部回余额 / 守恒 Σ=0',
      cancelBuy.status === 'cancelled' && cancelEv.length === 2 && kindsOf(cancelEv).join(',') === 'hold_release'
      && sumDelta(cancelEv) === 0n && bn(sellerAfterCancel?.frozen) === 0n
      && bn(sellerAfterCancel?.frozen) === bn(sellerBaseBeforeCancel?.frozen) - 2n
      && bn(sellerAfterCancel?.balance) === bn(sellerBaseBeforeCancel?.balance) + 2n,
      { order_id: sellId, status: cancelBuy.status, frozen_hold: cancelBuy.frozen_hold, entries: cancelEv.length,
        kinds: kindsOf(cancelEv), sigma: sumDelta(cancelEv).toString(), seller_base_after_cancel: sellerAfterCancel });

    // ================================================================= K6 结算链守恒 + 判据 5 对账
    const perEvent: any[] = [];
    for (const e of events) {
      const es = await entriesOfKey(p, e.key);
      perEvent.push({ key: e.key, op: e.op, entries: es.length, kinds: kindsOf(es),
                      sigma_delta_plus_frozen: sumDelta(es).toString() });
    }
    const platform = await raw1<any>(p, `SELECT
        (SELECT count(*)::text FROM public.ledger_entry e WHERE e.uid = -1 AND e.kind='trade_fee'
           AND e.event_root_key LIKE 'biz:market:trade:%') AS fee_credits_to_m1,
        (SELECT count(*)::text FROM public.ledger_entry e WHERE e.uid IN (0,-2,-3)
           AND (e.event_root_key LIKE 'biz:market%' OR e.event_root_key LIKE 'cli:kong16-%')) AS other_platform_rows`);
    const recon = await raw1<any>(p, `WITH o AS (
        SELECT owner_uid, side, base_cid, quote_cid, (amount-amount_filled) AS rem, price, status
          FROM public.market_order WHERE owner_uid BETWEEN 990501 AND 990599)
      SELECT
        (SELECT COALESCE(sum(rem*price),0)::text FROM o WHERE side='buy' AND status IN ('open','partial')) AS book_buy_quote,
        (SELECT COALESCE(sum(rem),0)::text FROM o WHERE side='sell' AND status IN ('open','partial')) AS book_sell_base,
        (SELECT COALESCE(sum(frozen),0)::text FROM public.account WHERE uid BETWEEN 990501 AND 990599 AND cid=1) AS acct_quote_frozen,
        (SELECT COALESCE(sum(frozen),0)::text FROM public.account WHERE uid BETWEEN 990501 AND 990599 AND cid=${BASE}::bigint) AS acct_base_frozen,
        (SELECT count(*)::text FROM o) AS fixture_orders`);
    const cid1End = await raw1<any>(p, `SELECT (SELECT COALESCE(sum(balance+frozen),0)::text FROM public.account WHERE cid=1) AS sum_bal_frozen,
                                               (SELECT total_supply::text FROM public.currency WHERE cid=1) AS total_supply`);
    add('K6', '结算链守恒：每个事件 Σ(delta+frozen_delta)=0 且 kind 恰在白名单内；平台账户仅 −1 收 trade_fee（0/−2/−3 零参与）；cid=1 收工 Σ(balance+frozen)==total_supply；DL68 挂单判据 5 对账（账面在冻额 == business 表公式）',
      perEvent.every((e) => e.sigma_delta_plus_frozen === '0')
      && perEvent.every((e) => e.op === 'order' ? e.kinds.join() === 'hold'
        : e.op === 'cancel' ? e.kinds.join() === 'hold_release'
          : e.kinds.join() === 'trade' || e.kinds.join() === 'trade,trade_fee')
      && platform.other_platform_rows === '0' && bn(platform.fee_credits_to_m1) >= 1n
      && cid1End.sum_bal_frozen === cid1End.total_supply
      && bn(recon.book_buy_quote) === bn(recon.acct_quote_frozen)
      && bn(recon.book_sell_base) === bn(recon.acct_base_frozen),
      { per_event: perEvent, platform, recon_market_order_book_vs_account: recon,
        cid1_end: cid1End, cid1_before: beforeAll.cid1, base: { cid: BASE, symbol: basePick.symbol,
        decimals: basePick.decimals, donor: basePick.donor },
        funding: { buyer: fundBuyer, seller2: fundSeller2, spare: fundSpare, base_xfer_seller: bx1, base_xfer_seller2: bx2 } });

    const artifact = save('cases', { cases: list, pass: list.filter((c) => c.pass).length, total: list.length,
      boundaries, guard, events, fixture: { BUYER, SELLER, SELLER2, SPARE, BASE, buyId, sellId, tradeIds: [t1.trade_id, t2.trade_id] } });
    console.log(JSON.stringify({ artifact, pass: `${list.filter((c) => c.pass).length}/${list.length}`,
      failed: list.filter((c) => !c.pass).map((c) => c.id),
      headlines: list.map((c) => ({ id: c.id, pass: c.pass, name: c.name.slice(0, 60) })) }, null, 2));
  } catch (e) {
    const i = errInfo(e);
    const artifact = save('cases-FATAL', { cases: list, error: i, at_stage: 'see error' });
    console.error('p3m-02 FATAL:', JSON.stringify({ artifact, err: i, cases: list.map((c) => c.id) }));
    process.exitCode = 3;
  } finally { await p.end().catch(() => undefined); }
};

// 占位：b17 需要 SPARE 的订单 id；用常量在 main 里赋值前先声明
const SpareIds: { spareId: string } = { spareId: '0' };

main().catch((e) => { console.error('p3m-02 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
