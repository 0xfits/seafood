// market-mm-quotes.mjs — 方案 C 外部做市机器人 · 纯函数决策核（零依赖）
// ============================================================================
// 被两方消费：
//   · market-mm-bot.mjs      —— 长跑 bot 的每轮决策（IO 一律在 bot 侧，本文件零 IO）
//   · market-mm-quotes.test.mjs —— node:test 纯函数单测
// 口径（派单 · 方案 C）：
//   · 目标买价 = floor(ref × (1 − spread/2))、卖价 = ceil(ref × (1 + spread/2))；双边各摊一半跨
//   · ref 来源优先级：最近成交价 → env MM_REF_PRICE → 本地 state → 无（无来源 ⇒ 只撤不挂 + 告警）
//   · 撤旧挂新：不在目标价的旧单撤掉；已在目标价的单保留（同价不重挂、不重放）
//   · 库存护栏：单量 = min(MM_ORDER_SIZE_BASE, 库存上限, 资金上限)；两侧都挂不出 ⇒ 只撤不挂 + 告警
//   · create_key = `mm-<base>-<quote>-<side>-<price>-w<seq>`（seq = 时间窗）：
//       同窗重试同键 ⇒ 服务端幂等重放安全；换窗（含同价重挂）新键 ⇒ 不误触重放
// ============================================================================

/** 配置缺省值（env 键名 → 缺省字符串值；解析在 resolveConfig） */
export const CONFIG_DEFAULTS = Object.freeze({
  MM_API_BASE: 'https://0xseafood.com',
  MM_BASE_CID: '4', // 生产 BTTC；dev 库 BTTC = cid 399（两库 cid 不同，见 MM-README）
  MM_QUOTE_CID: '1', // $ 平台积分
  MM_SPREAD_PCT: '1', // 全跨 1% ⇒ 双边各 0.5%
  MM_ORDER_SIZE_BASE: '100', // BTTC / 单
  MM_REF_PRICE: '1000', // 无成交时的参考价（Kevin 2026-10-22：ref 1000 · 全跨 1% ⇒ 买 995 / 卖 1005）；显式置空（''/0）= 不给 env 价
  MM_INTERVAL_S: '60',
  MM_MAX_INVENTORY_PCT: '50', // 单笔订单名义额 ≤ 库存总值的 50%
  MM_STATE_FILE: '', // '' ⇒ <mm.env 同目录>/mm-state.json
});

const toPosInt = (v, name) => {
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`config ${name} must be a positive integer, got ${JSON.stringify(v ?? null)}`);
  }
  return n;
};

/**
 * env → 运行配置（fail-loud：任何键非法即抛错，绝不带病起跑）。
 * MM_REF_PRICE 特例：空串/'0' ⇒ null（操作者显式不给 env 价 ⇒ 交给成交价/state 回退链）。
 */
export function resolveConfig(env = {}) {
  const has = (k) => env[k] !== undefined && env[k] !== null;
  const pick = (k) => {
    if (has(k)) return String(env[k]).trim();
    return CONFIG_DEFAULTS[k];
  };
  const spreadPct = Number(pick('MM_SPREAD_PCT'));
  if (!Number.isFinite(spreadPct) || spreadPct < 0 || spreadPct > 50) {
    throw new Error(`config MM_SPREAD_PCT must be within [0, 50], got ${pick('MM_SPREAD_PCT')}`);
  }
  const maxInventoryPct = Number(pick('MM_MAX_INVENTORY_PCT'));
  if (!Number.isFinite(maxInventoryPct) || maxInventoryPct <= 0 || maxInventoryPct > 100) {
    throw new Error(`config MM_MAX_INVENTORY_PCT must be within (0, 100], got ${pick('MM_MAX_INVENTORY_PCT')}`);
  }
  const refRaw = pick('MM_REF_PRICE');
  const refNum = Number(refRaw);
  const refPriceEnv = refRaw === '' || refRaw === '0' || !Number.isFinite(refNum) || refNum <= 0 ? null : refNum;
  return {
    apiBase: pick('MM_API_BASE').replace(/\/+$/, ''),
    baseCid: toPosInt(pick('MM_BASE_CID'), 'MM_BASE_CID'),
    quoteCid: toPosInt(pick('MM_QUOTE_CID'), 'MM_QUOTE_CID'),
    spreadPct,
    orderSizeBase: toPosInt(pick('MM_ORDER_SIZE_BASE'), 'MM_ORDER_SIZE_BASE'),
    refPriceEnv,
    intervalS: toPosInt(pick('MM_INTERVAL_S'), 'MM_INTERVAL_S'),
    maxInventoryPct,
    stateFile: pick('MM_STATE_FILE'),
  };
}

/** 时间窗序号：同一窗内重试共用 create_key（幂等重放安全），换窗新键。 */
export function windowSeq(nowMs, intervalS) {
  const iv = toPosInt(intervalS, 'intervalS');
  return Math.floor(nowMs / (iv * 1000));
}

/** create_key 组装（platform 幂等键；每字段都进键 ⇒ 换价/换向/换窗必得新键）。
 *  前缀闭集：平台 create_key 只认 `biz:/cm:/cli:/ops:`（market-service KEY_PREFIXES）⇒ 取 `biz:mm:…`。 */
export function buildCreateKey({ baseCid, quoteCid, side, price, seq }) {
  if (side !== 'buy' && side !== 'sell') throw new Error(`buildCreateKey: bad side ${JSON.stringify(side)}`);
  const p = toPosInt(price, 'price');
  const s = toPosInt(seq, 'seq');
  return `biz:mm:${toPosInt(baseCid, 'baseCid')}:${toPosInt(quoteCid, 'quoteCid')}:${side}:${p}:w${s}`;
}

/**
 * 目标双边价。spread 全跨（%），双边各摊一半；买价向下取整、卖价向上取整。
 * 极端小 ref / 零跨导致 buy ≥ sell 时把卖价顶到买价 +1 ⇒ 结构上杜绝 MM 双边自碰。
 */
export function computeQuoteTargets({ refPrice, spreadPct }) {
  const ref = Number(refPrice);
  if (!Number.isFinite(ref) || ref <= 0) throw new Error(`computeQuoteTargets: bad refPrice ${JSON.stringify(refPrice)}`);
  const sp = Number(spreadPct);
  if (!Number.isFinite(sp) || sp < 0) throw new Error(`computeQuoteTargets: bad spreadPct ${JSON.stringify(spreadPct)}`);
  let buyPrice = Math.floor(ref * (1 - sp / 200));
  let sellPrice = Math.ceil(ref * (1 + sp / 200));
  if (buyPrice < 1) buyPrice = 1;
  if (sellPrice < 1) sellPrice = 1;
  if (buyPrice >= sellPrice) sellPrice = buyPrice + 1;
  return { buyPrice, sellPrice };
}

/**
 * ref price 来源链：最近成交 → env → 本地 state → 无。
 * trades 形如 API 返回（按时间倒序）：[{ price, time_created }]；取第一条可解析价。
 */
export function deriveRefPrice({ trades, envRefPrice = null, stateRefPrice = null } = {}) {
  const okNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  if (Array.isArray(trades)) {
    for (const t of trades) {
      const p = okNum(t && (t.price ?? t.Price));
      if (p !== null) return { refPrice: p, source: 'trades' };
    }
  }
  const envP = okNum(envRefPrice);
  if (envP !== null) return { refPrice: envP, source: 'env' };
  const stateP = okNum(stateRefPrice);
  if (stateP !== null) return { refPrice: stateP, source: 'state' };
  return { refPrice: null, source: 'none' };
}

/** 自己在该币对上的在挂单（open/partial 且有余量），归一为决策核输入形状。 */
export function openOwnOrdersForPair(orders, baseCid) {
  const out = [];
  for (const o of Array.isArray(orders) ? orders : []) {
    const bID = Number(o && (o.bID ?? o.base_cid));
    const status = String(o && o.status);
    const total = Number(o && (o.volume_total ?? o.amount));
    const filled = Number(o && (o.volume_filled ?? o.amount_filled));
    if (bID !== Number(baseCid)) continue;
    if (status !== 'open' && status !== 'partial') continue;
    if (!Number.isFinite(total) || !Number.isFinite(filled) || total - filled <= 0) continue;
    const side = String(o.side);
    if (side !== 'buy' && side !== 'sell') continue;
    const price = Number(o.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({ oID: Number(o.oID ?? o.order_id), side, price, remaining: total - filled });
  }
  return out;
}

/**
 * 单边挂量（库存护栏）：
 *   上限 = min(单笔额定 MM_ORDER_SIZE_BASE, 库存名义额 × maxInventoryPct / 100 折 base, 可冻资金 / 买价 或 base 余额)
 * 返回 { size, boundedBy }；boundedBy ∈ order_size | inventory_pct | quote_funds | base_funds。
 */
export function sizeOrderSide({ side, buyPrice, sellPrice, refPrice, quoteAvail, baseAvail, orderSizeBase, maxInventoryPct }) {
  if (side !== 'buy' && side !== 'sell') throw new Error(`sizeOrderSide: bad side ${JSON.stringify(side)}`);
  const ref = Number(refPrice);
  const q = Math.max(0, Math.floor(Number(quoteAvail) || 0));
  const b = Math.max(0, Math.floor(Number(baseAvail) || 0));
  const caps = { order_size: Math.floor(Number(orderSizeBase)) };
  const notionalAvail = q + b * ref;
  caps.inventory_pct = ref > 0 ? Math.floor((notionalAvail * maxInventoryPct) / 100 / ref) : 0;
  if (side === 'buy') caps.quote_funds = buyPrice > 0 ? Math.floor(q / buyPrice) : 0;
  else caps.base_funds = Math.floor(b);
  let size = Number.POSITIVE_INFINITY;
  let boundedBy = null;
  for (const k of ['order_size', 'inventory_pct', side === 'buy' ? 'quote_funds' : 'base_funds']) {
    const v = Number.isFinite(caps[k]) ? Math.max(0, caps[k]) : 0;
    if (v < size) {
      size = v;
      boundedBy = k;
    }
  }
  return { size: Math.max(0, Math.floor(size)), boundedBy };
}

/**
 * 每轮决策（撤旧挂新 + 库存护栏）。
 * 输入：targets / 自己在挂单（openOwnOrdersForPair 的输出）/ 余额 / 单笔额 / 库存上限。
 * 输出：
 *   mode    'normal' | 'cancel_only'（两侧都挂不出 ⇒ 只撤不挂 + 告警）
 *   keeps   已在目标价、保留不动的单
 *   cancels 要撤的单（off_target；cancel_only 时含全部在挂单）
 *   places  要挂的单（[{side, price, amount, boundedBy, degraded}]）
 *   alerts  决策告警文案（bot 侧负责落日志）
 */
export function planQuotes({
  targets,
  ownOpenOrders = [],
  refPrice,
  quoteAvail = 0,
  baseAvail = 0,
  orderSizeBase,
  maxInventoryPct,
}) {
  const buy = Number(targets.buyPrice);
  const sell = Number(targets.sellPrice);
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) {
    throw new Error('planQuotes: targets.buyPrice/sellPrice required');
  }
  const mine = Array.isArray(ownOpenOrders) ? ownOpenOrders : [];
  const keeps = [];
  const cancels = [];
  const places = [];
  const alerts = [];

  for (const side of ['buy', 'sell']) {
    const targetPrice = side === 'buy' ? buy : sell;
    const onSide = mine.filter((o) => o.side === side);
    const atTarget = onSide.find((o) => Number(o.price) === targetPrice && o.remaining > 0);
    if (atTarget) {
      keeps.push({ oID: atTarget.oID, side, price: targetPrice, remaining: atTarget.remaining });
      for (const o of onSide.filter((o) => o.oID !== atTarget.oID)) {
        cancels.push({ oID: o.oID, side, price: o.price, reason: 'off_target' });
      }
      continue;
    }
    for (const o of onSide) cancels.push({ oID: o.oID, side, price: o.price, reason: 'off_target' });
    const s = sizeOrderSide({
      side, buyPrice: buy, sellPrice: sell, refPrice,
      quoteAvail, baseAvail, orderSizeBase, maxInventoryPct,
    });
    if (s.size >= 1) {
      places.push({ side, price: targetPrice, amount: s.size, boundedBy: s.boundedBy, degraded: s.boundedBy !== 'order_size' });
    } else {
      alerts.push(`skip_place_${side}: ${s.boundedBy}=0 (quote_avail=${quoteAvail} base_avail=${baseAvail})`);
    }
  }

  let mode = 'normal';
  if (places.length === 0 && keeps.length === 0) {
    // 库存低于阈值（无任何在价工作单 ∧ 两侧都挂不出新单）⇒ 只撤不挂 + 告警。
    // 此刻 keeps 为空 ⇒ 可撤的只剩 off_target 单（已在上面进 cancels）。
    mode = 'cancel_only';
    alerts.push('inventory_below_threshold: cancel-only mode (no side placeable, nothing at target)');
  }
  return { mode, keeps, cancels, places, alerts };
}
