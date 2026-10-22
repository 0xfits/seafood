// market-mm-quotes.test.mjs — 方案 C 做市机器人 · 纯函数单测（node:test，零依赖）
// ============================================================================
// 运行：cd backend-ts && node --test scripts/market-mm-quotes.test.mjs
// 覆盖（派单 · 方案 C 交付③）：报价计算（spread/取整/无成交回退）、撤旧挂新决策、
//   库存不足降级、create_key 幂等（同窗重试同键 / 换窗换价换向新键）。
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendMetricEntry,
  buildCreateKey,
  buildStatusView,
  computeInventorySkewPct,
  computeQuoteTargets,
  deriveRefPrice,
  killSwitchState,
  listOpenOrders,
  openOwnOrdersForPair,
  parseKillArgs,
  planQuotes,
  resolveConfig,
  shouldDegrade,
  sizeOrderSide,
  skewBlockedSide,
  summarizeCancelAll,
  summarizeMetrics,
  windowSeq,
} from './market-mm-quotes.mjs';

// ---------------------------------------------------------------- 配置解析
test('resolveConfig: 缺省值（spread 1% / 100 BTTC / interval 60s / ref 1000）', () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.spreadPct, 1);
  assert.equal(cfg.orderSizeBase, 100);
  assert.equal(cfg.intervalS, 60);
  assert.equal(cfg.maxInventoryPct, 50);
  assert.equal(cfg.refPriceEnv, 1000);
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
  // ★ Kevin 2026-10-22 生产口径：ref 1000 · 全跨 1% ⇒ 买 995 / 卖 1005
  assert.deepEqual(computeQuoteTargets({ refPrice: 1000, spreadPct: 1 }), { buyPrice: 995, sellPrice: 1005 });
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

// ============================================================================
// P1 托管化：硬限额 / 库存偏离闸 / 降级 / 急停 flag / kill 参数 / 指标 + status
//   缺省保守：notional 500000 / skew 90% / 连续 5 轮失败 / 指标留 100 轮
// ============================================================================

test('resolveConfig: P1 缺省限额（notional 500k / skew 90% / 连败 5 / 指标 100 / 探活关）', () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.maxNotionalUsd, 500000);
  assert.equal(cfg.maxInventorySkewPct, 90);
  assert.equal(cfg.maxConsecFail, 5);
  assert.equal(cfg.metricsLimit, 100);
  assert.equal(cfg.healthPort, 0);
  assert.equal(cfg.killFlagFile, '');
  assert.equal(cfg.statusMaxAgeS, 180, '0 ⇒ intervalS × 3 = 180s');
});

test('resolveConfig: P1 env 覆盖 + 非法值 fail-loud', () => {
  const cfg = resolveConfig({
    MM_MAX_NOTIONAL_USD: '25000',
    MM_MAX_INVENTORY_SKEW_PCT: '60',
    MM_MAX_CONSEC_FAIL: '3',
    MM_METRICS_LIMIT: '20',
    MM_KILL_FLAG: '/data/mm-kill.flag',
    MM_HEALTH_PORT: '8080',
    MM_STATUS_MAX_AGE_S: '90',
  });
  assert.equal(cfg.maxNotionalUsd, 25000);
  assert.equal(cfg.maxInventorySkewPct, 60);
  assert.equal(cfg.maxConsecFail, 3);
  assert.equal(cfg.metricsLimit, 20);
  assert.equal(cfg.killFlagFile, '/data/mm-kill.flag');
  assert.equal(cfg.healthPort, 8080);
  assert.equal(cfg.statusMaxAgeS, 90);
  assert.throws(() => resolveConfig({ MM_MAX_NOTIONAL_USD: '0' }), /MM_MAX_NOTIONAL_USD/);
  assert.throws(() => resolveConfig({ MM_MAX_INVENTORY_SKEW_PCT: '0' }), /MM_MAX_INVENTORY_SKEW_PCT/);
  assert.throws(() => resolveConfig({ MM_MAX_INVENTORY_SKEW_PCT: '101' }), /MM_MAX_INVENTORY_SKEW_PCT/);
  assert.throws(() => resolveConfig({ MM_MAX_CONSEC_FAIL: '0' }), /MM_MAX_CONSEC_FAIL/);
  assert.throws(() => resolveConfig({ MM_HEALTH_PORT: '70000' }), /MM_HEALTH_PORT/);
  assert.throws(() => resolveConfig({ MM_HEALTH_PORT: '-1' }), /MM_HEALTH_PORT/);
});

test('sizeOrderSide: MM_MAX_NOTIONAL_USD 硬限额钳挂量（500000 / 价 1005 ⇒ 497）', () => {
  const s = sizeOrderSide({
    side: 'sell', buyPrice: 995, sellPrice: 1005, refPrice: 1000,
    quoteAvail: 1_000_000_000, baseAvail: 1_000_000, orderSizeBase: 1000, maxInventoryPct: 50,
    maxNotionalUsd: 500000,
  });
  assert.equal(s.size, 497);
  assert.equal(s.boundedBy, 'notional_cap');
});

test('planQuotes: 名义额上限逐侧生效（买 502 / 卖 497 @ 500k），不进 skip 告警', () => {
  const p = planQuotes({
    targets: { buyPrice: 995, sellPrice: 1005 },
    ownOpenOrders: [],
    refPrice: 1000,
    quoteAvail: 1_000_000_000,
    baseAvail: 1_000_000,
    orderSizeBase: 1000,
    maxInventoryPct: 50,
    maxNotionalUsd: 500000,
  });
  assert.deepEqual(p.places.map((x) => ({ side: x.side, amount: x.amount, boundedBy: x.boundedBy })), [
    { side: 'buy', amount: 502, boundedBy: 'notional_cap' },
    { side: 'sell', amount: 497, boundedBy: 'notional_cap' },
  ]);
  assert.ok(p.places.every((x) => x.degraded === true), '被限额钳住 ⇒ degraded 标记');
  assert.deepEqual(p.alerts, []);
});

test('computeInventorySkewPct: 均衡 0 / base 偏重 / quote 偏重 / 空库存', () => {
  assert.deepEqual(
    { ...computeInventorySkewPct({ baseAvail: 1000, quoteAvail: 1_000_000, refPrice: 1000 }) },
    { skewPct: 0, heavySide: null, baseNotional: 1_000_000, quoteNotional: 1_000_000 },
  );
  const baseHeavy = computeInventorySkewPct({ baseAvail: 10000, quoteAvail: 1_000_000, refPrice: 1000 });
  assert.equal(baseHeavy.heavySide, 'base');
  assert.equal(baseHeavy.skewPct, 81.82);
  const quoteHeavy = computeInventorySkewPct({ baseAvail: 10, quoteAvail: 1_000_000, refPrice: 1000 });
  assert.equal(quoteHeavy.heavySide, 'quote');
  assert.equal(quoteHeavy.skewPct, 98.02);
  assert.deepEqual(computeInventorySkewPct({ baseAvail: 0, quoteAvail: 0, refPrice: 1000 }), { skewPct: 0, heavySide: null, baseNotional: 0, quoteNotional: 0 });
  assert.throws(() => computeInventorySkewPct({ baseAvail: 1, quoteAvail: 1, refPrice: 0 }), /bad refPrice/);
});

test('skewBlockedSide: 超限停「加仓侧」（base 重→停买 / quote 重→停卖），100% 关闸', () => {
  assert.equal(skewBlockedSide({ skewPct: 81.82, heavySide: 'base', maxSkewPct: 80 }), 'buy');
  assert.equal(skewBlockedSide({ skewPct: 98.02, heavySide: 'quote', maxSkewPct: 80 }), 'sell');
  assert.equal(skewBlockedSide({ skewPct: 50, heavySide: 'base', maxSkewPct: 80 }), null, '未超限不拦');
  assert.equal(skewBlockedSide({ skewPct: 81.82, heavySide: 'base', maxSkewPct: 100 }), null, '100% = 失效');
  assert.equal(skewBlockedSide({ skewPct: 81.82, heavySide: 'base' }), null, '缺省不拦（纯函数向后兼容）');
  assert.equal(skewBlockedSide({ skewPct: 81.82, heavySide: null, maxSkewPct: 10 }), null, '无偏重侧 ⇒ 不拦');
});

test('planQuotes: base 偏重超限 ⇒ 只挂卖边（skip_place_buy 告警），在价买单保留', () => {
  const common = {
    targets: { buyPrice: 995, sellPrice: 1005 },
    refPrice: 1000,
    quoteAvail: 1_000_000,
    baseAvail: 10000,
    orderSizeBase: 100,
    maxInventoryPct: 50,
    maxInventorySkewPct: 80,
  };
  const p = planQuotes({ ...common, ownOpenOrders: [] });
  assert.deepEqual(p.places.map((x) => x.side), ['sell']);
  assert.ok(p.alerts.some((a) => a.startsWith('skip_place_buy:') && a.includes('inventory_skew=81.82%>80%')));
  assert.equal(p.skew.skewPct, 81.82);

  const kept = planQuotes({ ...common, ownOpenOrders: [{ oID: 41, side: 'buy', price: 995, remaining: 50 }] });
  assert.deepEqual(kept.keeps.map((k) => k.oID), [41], '已在价的工作单不因偏重被翻撤');
  assert.deepEqual(kept.cancels, []);
  assert.deepEqual(kept.places.map((x) => x.side), ['sell']);
});

test('shouldDegrade: 满 N 轮失败降级，未满不降级，阈值可配', () => {
  assert.deepEqual(shouldDegrade({ consecutiveFailures: 4, threshold: 5 }), { degraded: false, reason: null });
  assert.deepEqual(shouldDegrade({ consecutiveFailures: 5, threshold: 5 }), { degraded: true, reason: 'consecutive_round_failures=5>=5' });
  assert.equal(shouldDegrade({ consecutiveFailures: 2, threshold: 2 }).degraded, true);
  assert.deepEqual(shouldDegrade({}), { degraded: false, reason: null }, '缺省阈值 5 / 0 次失败');
  assert.equal(shouldDegrade({ consecutiveFailures: 3, threshold: 0 }).degraded, false, '非法阈值 0 回落 5 ⇒ 3 轮未降级');
});

test('killSwitchState: flag 存在即只撤不挂（带 flag 年龄），不存在即放行', () => {
  const off = killSwitchState({ flagExists: false, flagPath: '/data/mm-kill.flag' });
  assert.deepEqual(off, { active: false, reason: null, flag_path: '/data/mm-kill.flag', flag_age_s: null });
  const on = killSwitchState({ flagExists: true, flagPath: '/data/mm-kill.flag', flagMtimeMs: 1_700_000_000_000, nowMs: 1_700_000_090_000 });
  assert.deepEqual(on, { active: true, reason: 'kill_flag_present', flag_path: '/data/mm-kill.flag', flag_age_s: 90 });
  assert.equal(killSwitchState({ flagExists: true }).flag_age_s, null, '无 mtime ⇒ 年龄未知');
});

test('parseKillArgs: 缺省 env / --env / --dry-run 只列不撤不落 flag / --no-flag / 未知参数', () => {
  const base = parseKillArgs([], { defaultEnvPath: '/tmp/mm.env' });
  assert.equal(base.envPath, '/tmp/mm.env');
  assert.equal(base.dryRun, false);
  assert.equal(base.mode, 'cancel_all');
  assert.equal(base.writeFlag, true, '真撤缺省落 flag（挡住 bot 重挂）');

  const dry = parseKillArgs(['--env', '/data/mm.env', '--dry-run'], { defaultEnvPath: '/tmp/mm.env' });
  assert.equal(dry.envPath, '/data/mm.env');
  assert.equal(dry.dryRun, true);
  assert.equal(dry.mode, 'dry_run');
  assert.equal(dry.writeFlag, false, 'dry-run 绝不落 flag');

  const noFlag = parseKillArgs(['--no-flag']);
  assert.equal(noFlag.mode, 'cancel_all');
  assert.equal(noFlag.writeFlag, false);

  assert.equal(parseKillArgs(['--json', '--dry-run']).json, true);
  assert.equal(parseKillArgs(['--help']).help, true);
  assert.equal(parseKillArgs(['-h']).help, true);
  assert.deepEqual(parseKillArgs(['--bogus']).unknown, ['--bogus']);
  assert.equal(parseKillArgs(['--env']).envPath, null, '--env 缺值 ⇒ null（不吞下一个 flag）');
  assert.equal(parseKillArgs(['--env', '--dry-run']).dryRun, true, '--env 后跟 flag ⇒ 不当作路径');
});

test('listOpenOrders: 只列 open/partial 有余量单（跨币对，kill 全撤口径）', () => {
  const rows = [
    { oID: 1, bID: 4, qID: 1, side: 'buy', price: 995, volume_total: 100, volume_filled: 0, status: 'open' },
    { oID: 2, bID: 4, side: 'sell', price: 1005, volume_total: 100, volume_filled: 100, status: 'open' },
    { oID: 3, bID: 399, side: 'sell', price: 1005, volume_total: 50, volume_filled: 10, status: 'partial' },
    { oID: 4, bID: 4, side: 'buy', price: 990, volume_total: 10, volume_filled: 0, status: 'cancelled' },
  ];
  assert.deepEqual(listOpenOrders(rows), [
    { oID: 1, pair: '4/1', side: 'buy', price: 995, remaining: 100 },
    { oID: 3, pair: '399/1', side: 'sell', price: 1005, remaining: 40 },
  ], '平台 /api/order 行无 quote_cid ⇒ pair 兜底 /1（quote 恒 $）');
  assert.deepEqual(listOpenOrders(null), []);
});

test('summarizeCancelAll: 撤单数/尝试数/失败数 + 失败单号', () => {
  const view = {
    cancelled: 1,
    attempted: 2,
    failed: 1,
    orders: [{ order_id: '11', ok: true }, { order_id: '12', ok: false, code: 'ORDER_NOT_OPEN' }],
    pair_lock: 'x',
  };
  assert.deepEqual(summarizeCancelAll(view), { cancelled: 1, attempted: 2, failed: 1, failed_ids: ['12'] });
  assert.deepEqual(summarizeCancelAll({}), { cancelled: 0, attempted: 0, failed: 0, failed_ids: [] }, '空响应不炸');
  assert.deepEqual(
    summarizeCancelAll({ orders: [{ order_id: '7', ok: true }, { order_id: '8', ok: true }] }),
    { cancelled: 2, attempted: 2, failed: 0, failed_ids: [] },
    '缺汇总键时按 orders[] 反推',
  );
});

test('appendMetricEntry: 滚动只留最近 N 轮（缺省 100）', () => {
  let list = [];
  for (let i = 1; i <= 105; i += 1) list = appendMetricEntry(list, { ts: new Date(0).toISOString(), round: i }, 100);
  assert.equal(list.length, 100);
  assert.equal(list[0].round, 6);
  assert.equal(list[99].round, 105);
  assert.deepEqual(appendMetricEntry(null, { round: 1 }), [{ round: 1 }], '空文件 ⇒ 新建数组');
});

test('summarizeMetrics: 只计 1h 窗口内 errors（坏条目/未来时间戳忽略）', () => {
  const now = Date.parse('2026-10-22T12:00:00.000Z');
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const entries = [
    { ts: iso(60_000), errors: 2 },
    { ts: iso(3_500_000), errors: 1 },
    { ts: iso(7_200_000), errors: 5 },
    { ts: 'not-a-time', errors: 9 },
    { ts: iso(-60_000), errors: 9 },
  ];
  assert.deepEqual(summarizeMetrics(entries, now), { errors_last_hour: 3, rounds_last_hour: 2 });
  assert.deepEqual(summarizeMetrics([], now), { errors_last_hour: 0, rounds_last_hour: 0 });
});

test('buildStatusView: state + 指标 → --status 视图（age/ref/quotes/balances/errors）', () => {
  const now = Date.parse('2026-10-22T12:00:00.000Z');
  const view = buildStatusView({
    state: {
      last_round_ts: now - 120_000,
      last_ref_price: 1000,
      last_ref_source: 'env',
      last_quotes: { buy: 995, sell: 1005 },
      last_balances: { quote_avail: 998_400, base_avail: 9998 },
    },
    metrics: [{ ts: new Date(now - 60_000).toISOString(), errors: 3, placed: 2, cancelled: 0, mode: 'normal' }],
    nowMs: now,
  });
  assert.deepEqual(view, {
    last_round_at: '2026-10-22T11:58:00.000Z',
    age_seconds: 120,
    ref_price: 1000,
    ref_source: 'env',
    quotes: { buy: 995, sell: 1005 },
    balances: { quote_avail: 998_400, base_avail: 9998 },
    errors_last_hour: 3,
  });
  const empty = buildStatusView({ state: {}, metrics: [] });
  assert.equal(empty.last_round_at, null);
  assert.equal(empty.age_seconds, null, '没跑过一轮 ⇒ age 未知（容器据此判 stale）');
  assert.deepEqual(empty.quotes, { buy: null, sell: null });
  assert.equal(empty.errors_last_hour, 0);
});
