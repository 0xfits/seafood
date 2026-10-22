// market-mm-quotes.test.mjs — 方案 C 做市机器人 · 纯函数单测（node:test，零依赖）
// ============================================================================
// 运行：cd backend-ts && node --test scripts/market-mm-quotes.test.mjs
// 覆盖（派单 · 方案 C 交付③）：报价计算（spread/取整/无成交回退）、撤旧挂新决策、
//   库存不足降级、create_key 幂等（同窗重试同键 / 换窗换价换向新键）。
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCreateKey,
  computeQuoteTargets,
  deriveRefPrice,
  openOwnOrdersForPair,
  planQuotes,
  resolveConfig,
  sizeOrderSide,
  windowSeq,
} from './market-mm-quotes.mjs';

// ---------------------------------------------------------------- 配置解析
test('resolveConfig: 缺省值（spread 1% / 100 BTTC / interval 60s / ref 10000）', () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.spreadPct, 1);
  assert.equal(cfg.orderSizeBase, 100);
  assert.equal(cfg.intervalS, 60);
  assert.equal(cfg.maxInventoryPct, 50);
  assert.equal(cfg.refPriceEnv, 10000);
  assert.equal(cfg.baseCid, 4);
  assert.equal(cfg.quoteCid, 1);
  assert.equal(cfg.apiBase, 'https://0xseafood.com');
});

test('resolveConfig: env 覆盖 + 尾斜杠归一 + ref 置空 = null', () => {
  const cfg = resolveConfig({
    MM_API_BASE: 'http://localhost:5788/',
    MM_BASE_CID: '399',
    MM_SPREAD_PCT: '0.8',
    MM_REF_PRICE: '',
  });
  assert.equal(cfg.apiBase, 'http://localhost:5788');
  assert.equal(cfg.baseCid, 399);
  assert.equal(cfg.spreadPct, 0.8);
  assert.equal(cfg.refPriceEnv, null);
});

test('resolveConfig: 非法值 fail-loud', () => {
  assert.throws(() => resolveConfig({ MM_SPREAD_PCT: '-1' }), /MM_SPREAD_PCT/);
  assert.throws(() => resolveConfig({ MM_ORDER_SIZE_BASE: '0' }), /MM_ORDER_SIZE_BASE/);
  assert.throws(() => resolveConfig({ MM_BASE_CID: 'abc' }), /MM_BASE_CID/);
  assert.throws(() => resolveConfig({ MM_MAX_INVENTORY_PCT: '101' }), /MM_MAX_INVENTORY_PCT/);
});

// ---------------------------------------------------------------- create_key 幂等
test('windowSeq: 同窗同号、换窗进位', () => {
  assert.equal(windowSeq(0, 60), 0);
  assert.equal(windowSeq(59_999, 60), 0);
  assert.equal(windowSeq(60_000, 60), 1);
  assert.equal(windowSeq(1_000_000, 60), 16);
});

test('buildCreateKey: 形状 = biz:mm:<base>:<quote>:<side>:<price>:w<seq>（平台前缀闭集）', () => {
  assert.equal(buildCreateKey({ baseCid: 399, quoteCid: 1, side: 'buy', price: 9950, seq: 17 }), 'biz:mm:399:1:buy:9950:w17');
});

test('buildCreateKey 幂等: 同窗同价重试同键（重放安全）；换窗/换价/换向新键', () => {
  const k1 = buildCreateKey({ baseCid: 4, quoteCid: 1, side: 'buy', price: 9950, seq: 100 });
  const kRetry = buildCreateKey({ baseCid: 4, quoteCid: 1, side: 'buy', price: 9950, seq: 100 });
  assert.equal(k1, kRetry);
  assert.notEqual(k1, buildCreateKey({ baseCid: 4, quoteCid: 1, side: 'buy', price: 9950, seq: 101 }), '换窗必新键（同价重挂不重放）');
  assert.notEqual(k1, buildCreateKey({ baseCid: 4, quoteCid: 1, side: 'buy', price: 9951, seq: 100 }), '换价必新键');
  assert.notEqual(k1, buildCreateKey({ baseCid: 4, quoteCid: 1, side: 'sell', price: 9950, seq: 100 }), '换向必新键');
  assert.notEqual(k1, buildCreateKey({ baseCid: 399, quoteCid: 1, side: 'buy', price: 9950, seq: 100 }), '换币对必新键');
  assert.ok(k1.startsWith('biz:mm:'), '必须落在平台 create_key 前缀闭集内');
  assert.ok(!k1.includes('#'), '不得含保留分隔符 #');
});

// ---------------------------------------------------------------- 报价计算
test('computeQuoteTargets: ref 10000 / spread 1% ⇒ 买 9950（floor）/ 卖 10050（ceil）', () => {
  assert.deepEqual(computeQuoteTargets({ refPrice: 10000, spreadPct: 1 }), { buyPrice: 9950, sellPrice: 10050 });
});

test('computeQuoteTargets: 取整方向（9950.005→9950 买 / 10050.005→10051 卖）', () => {
  assert.deepEqual(computeQuoteTargets({ refPrice: 10000.01, spreadPct: 1 }), { buyPrice: 9950, sellPrice: 10051 });
});

test('computeQuoteTargets: 零跨 ⇒ 买=ref、卖=ref+1（结构上杜绝自碰）', () => {
  assert.deepEqual(computeQuoteTargets({ refPrice: 10000, spreadPct: 0 }), { buyPrice: 10000, sellPrice: 10001 });
});

test('computeQuoteTargets: 小 ref 钳到 ≥1 且 buy<sell', () => {
  const t = computeQuoteTargets({ refPrice: 1, spreadPct: 1 });
  assert.ok(t.buyPrice >= 1 && t.sellPrice > t.buyPrice);
});

// ---------------------------------------------------------------- ref 来源链
test('deriveRefPrice: 最近成交 > env > state > none', () => {
  assert.deepEqual(deriveRefPrice({ trades: [{ price: '10123' }, { price: '9999' }], envRefPrice: 10000, stateRefPrice: 9950 }), { refPrice: 10123, source: 'trades' });
  assert.deepEqual(deriveRefPrice({ trades: [{ price: '0' }], envRefPrice: 10000, stateRefPrice: 9950 }), { refPrice: 10000, source: 'env' });
  assert.deepEqual(deriveRefPrice({ trades: [], envRefPrice: null, stateRefPrice: 9950 }), { refPrice: 9950, source: 'state' });
  assert.deepEqual(deriveRefPrice({ trades: [], envRefPrice: null, stateRefPrice: null }), { refPrice: null, source: 'none' });
  assert.deepEqual(deriveRefPrice({ trades: [{ price: '0' }], envRefPrice: '0', stateRefPrice: 'x' }), { refPrice: null, source: 'none' });
});

// ---------------------------------------------------------------- 在挂单过滤
test('openOwnOrdersForPair: 只留本币对 open/partial 有余量单', () => {
  const orders = [
    { oID: 1, bID: 399, side: 'buy', price: 9950, volume_total: 100, volume_filled: 0, status: 'open' },
    { oID: 2, bID: 399, side: 'sell', price: 10050, volume_total: 100, volume_filled: 100, status: 'open' }, // 无余量
    { oID: 3, bID: 399, side: 'sell', price: 10100, volume_total: 50, volume_filled: 5, status: 'partial' },
    { oID: 4, bID: 399, side: 'buy', price: 9900, volume_total: 10, volume_filled: 0, status: 'cancelled' }, // 终态
    { oID: 5, bID: 4, side: 'buy', price: 9950, volume_total: 10, volume_filled: 0, status: 'open' }, // 别的币对
  ];
  assert.deepEqual(openOwnOrdersForPair(orders, 399), [
    { oID: 1, side: 'buy', price: 9950, remaining: 100 },
    { oID: 3, side: 'sell', price: 10100, remaining: 45 },
  ]);
});

// ---------------------------------------------------------------- 单边挂量（库存护栏）
test('sizeOrderSide: 买单受资金上限（quote 995,000 / 价 9950 ⇒ 恰 100）', () => {
  const s = sizeOrderSide({ side: 'buy', buyPrice: 9950, sellPrice: 10050, refPrice: 10000, quoteAvail: 995000, baseAvail: 10000, orderSizeBase: 100, maxInventoryPct: 50 });
  assert.equal(s.size, 100);
  assert.equal(s.boundedBy, 'order_size');
});

test('sizeOrderSide: quote 不足 ⇒ 降级到可冻量（boundedBy=quote_funds；base 充足使 pct 上限不先咬）', () => {
  const s = sizeOrderSide({ side: 'buy', buyPrice: 9950, sellPrice: 10050, refPrice: 10000, quoteAvail: 50000, baseAvail: 100, orderSizeBase: 100, maxInventoryPct: 50 });
  assert.equal(s.size, 5);
  assert.equal(s.boundedBy, 'quote_funds');
});

test('sizeOrderSide: base 不足 ⇒ 卖量降级（boundedBy=base_funds）；base=0 ⇒ size 0', () => {
  const s = sizeOrderSide({ side: 'sell', buyPrice: 9950, sellPrice: 10050, refPrice: 10000, quoteAvail: 1000000, baseAvail: 7, orderSizeBase: 100, maxInventoryPct: 50 });
  assert.equal(s.size, 7);
  assert.equal(s.boundedBy, 'base_funds');
  const s0 = sizeOrderSide({ side: 'sell', buyPrice: 9950, sellPrice: 10050, refPrice: 10000, quoteAvail: 1000000, baseAvail: 0, orderSizeBase: 100, maxInventoryPct: 50 });
  assert.equal(s0.size, 0);
});

test('sizeOrderSide: 库存名义额 × maxInventoryPct 上限钳单量', () => {
  // 总库存 = $5,000 + 3×10000 = $35,000 ⇒ 单笔名义 ≤ $17,500 ⇒ base ≤ 1（先于 base_funds=3 咬合）
  const s = sizeOrderSide({ side: 'sell', buyPrice: 9950, sellPrice: 10050, refPrice: 10000, quoteAvail: 5000, baseAvail: 3, orderSizeBase: 100, maxInventoryPct: 50 });
  assert.equal(s.size, 1);
  assert.equal(s.boundedBy, 'inventory_pct');
});

// ---------------------------------------------------------------- 每轮决策（撤旧挂新）
const BASE = { refPrice: 10000, quoteAvail: 1000000, baseAvail: 10000, orderSizeBase: 100, maxInventoryPct: 50 };

test('planQuotes: 空单簿 + 足库存 ⇒ 挂双边两单', () => {
  const p = planQuotes({ targets: { buyPrice: 9950, sellPrice: 10050 }, ownOpenOrders: [], ...BASE });
  assert.equal(p.mode, 'normal');
  assert.deepEqual(p.places.map((x) => ({ side: x.side, price: x.price, amount: x.amount })), [
    { side: 'buy', price: 9950, amount: 100 },
    { side: 'sell', price: 10050, amount: 100 },
  ]);
  assert.deepEqual(p.cancels, []);
  assert.deepEqual(p.alerts, []);
});

test('planQuotes: 已在目标价 ⇒ keep 不重挂；偏离目标价 ⇒ 撤旧', () => {
  const own = [
    { oID: 11, side: 'buy', price: 9950, remaining: 100 },
    { oID: 12, side: 'sell', price: 10100, remaining: 100 },
  ];
  const p = planQuotes({ targets: { buyPrice: 9950, sellPrice: 10050 }, ownOpenOrders: own, ...BASE });
  assert.deepEqual(p.keeps, [{ oID: 11, side: 'buy', price: 9950, remaining: 100 }]);
  assert.deepEqual(p.cancels, [{ oID: 12, side: 'sell', price: 10100, reason: 'off_target' }]);
  assert.deepEqual(p.places, [{ side: 'sell', price: 10050, amount: 100, boundedBy: 'order_size', degraded: false }]);
});

test('planQuotes: 买单资金不足 ⇒ 只挂卖边（降级告警），卖单照常', () => {
  const p = planQuotes({ targets: { buyPrice: 9950, sellPrice: 10050 }, ownOpenOrders: [], ...BASE, quoteAvail: 5000 });
  assert.equal(p.mode, 'normal');
  assert.deepEqual(p.places.map((x) => x.side), ['sell']);
  assert.ok(p.alerts.some((a) => a.startsWith('skip_place_buy:')));
});

test('planQuotes: 两侧都挂不出且无在挂 ⇒ cancel_only + 告警', () => {
  const p = planQuotes({ targets: { buyPrice: 9950, sellPrice: 10050 }, ownOpenOrders: [], ...BASE, quoteAvail: 100, baseAvail: 0 });
  assert.equal(p.mode, 'cancel_only');
  assert.deepEqual(p.places, []);
  assert.deepEqual(p.keeps, []);
  assert.ok(p.alerts.some((a) => a.includes('inventory_below_threshold')));
});

test('planQuotes: 破产但在目标价仍有工作单 ⇒ 保它（normal + skip 告警，不误撤唯一在价单）', () => {
  const own = [{ oID: 21, side: 'buy', price: 9950, remaining: 100 }];
  const p = planQuotes({ targets: { buyPrice: 9950, sellPrice: 10050 }, ownOpenOrders: own, ...BASE, quoteAvail: 0, baseAvail: 0 });
  assert.equal(p.mode, 'normal');
  assert.deepEqual(p.keeps, [{ oID: 21, side: 'buy', price: 9950, remaining: 100 }]);
  assert.deepEqual(p.places, []);
  assert.ok(p.alerts.some((a) => a.startsWith('skip_place_sell:')));
});

test('planQuotes: ref 无来源的撤全部由 bot 侧按 openOwnOrdersForPair 直接撤（本处只核决策输入不抛）', () => {
  // ref=none 时 bot 不走 planQuotes；这里只确认 openOwnOrdersForPair 给出可撤清单
  const own = [{ oID: 31, bID: 399, side: 'buy', price: 9950, volume_total: 10, volume_filled: 0, status: 'open' }];
  assert.equal(openOwnOrdersForPair(own, 399).length, 1);
});
