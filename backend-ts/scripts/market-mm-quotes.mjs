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
  MM_REF_FIXED: '', // ★ 固定基准价（钉死报价中心，不再跟随成交价）；空/0 = 关闭，走下面的来源链
  MM_REF_PRICE: '1000', // 无成交时的参考价（Kevin 2026-10-22：ref 1000 · 全跨 1% ⇒ 买 995 / 卖 1005）；显式置空（''/0）= 不给 env 价
  MM_INTERVAL_S: '60',
  MM_MAX_INVENTORY_PCT: '50', // 单笔订单名义额 ≤ 库存总值的 50%
  MM_STATE_FILE: '', // '' ⇒ <mm.env 同目录>/mm-state.json
  // ---- P1 托管化：硬限额 / 降级 / 运维（缺省即保守值，env 可覆盖） ----
  MM_NET_RETRIES: '3', // 单请求网络层重试次数（本机 DNS 劫持下 fetch 偶发 ECONNRESET）
  MM_MAX_NOTIONAL_USD: '500000', // 单边单笔挂单名义额上限（USD）；挂量 = min(..., 上限/价)
  MM_MAX_INVENTORY_SKEW_PCT: '90', // 买卖两侧库存名义额偏离上限 %，超限则该「加仓侧」不挂
  MM_MAX_CONSEC_FAIL: '5', // 连续 N 轮报价失败 ⇒ 自动只撤不挂 + 告警
  MM_METRICS_LIMIT: '100', // mm-metrics.json 滚动保留轮数
  MM_KILL_FLAG: '', // '' ⇒ <mm.env 同目录>/mm-kill.flag
  MM_HEALTH_PORT: '0', // 0 = 不起 HTTP 探活（本机 pm2 口径）；托管用 8080
  MM_STATUS_MAX_AGE_S: '0', // --status 判 stale 阈值；0 ⇒ intervalS × 3
});

const toPosInt = (v, name) => {
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`config ${name} must be a positive integer, got ${JSON.stringify(v ?? null)}`);
  }
  return n;
};

const toPosNum = (v, name) => {
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`config ${name} must be a positive number, got ${JSON.stringify(v ?? null)}`);
  }
  return n;
};

const toNonNegInt = (v, name) => {
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n < 0) {
    throw new Error(`config ${name} must be a non-negative integer, got ${JSON.stringify(v ?? null)}`);
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
  const maxInventorySkewPct = Number(pick('MM_MAX_INVENTORY_SKEW_PCT'));
  if (!Number.isFinite(maxInventorySkewPct) || maxInventorySkewPct <= 0 || maxInventorySkewPct > 100) {
    throw new Error(`config MM_MAX_INVENTORY_SKEW_PCT must be within (0, 100], got ${pick('MM_MAX_INVENTORY_SKEW_PCT')}`);
  }
  const intervalS = toPosInt(pick('MM_INTERVAL_S'), 'MM_INTERVAL_S');
  const statusMaxAgeRaw = toNonNegInt(pick('MM_STATUS_MAX_AGE_S'), 'MM_STATUS_MAX_AGE_S');
  const healthPort = toNonNegInt(pick('MM_HEALTH_PORT'), 'MM_HEALTH_PORT');
  if (healthPort > 65535) throw new Error(`config MM_HEALTH_PORT must be within [0, 65535], got ${healthPort}`);
  const refRaw = pick('MM_REF_PRICE');
  const refNum = Number(refRaw);
  const fixedRaw = pick('MM_REF_FIXED');
  const fixedNum = Number(fixedRaw);
  const refPriceFixed = fixedRaw === '' || fixedRaw === '0' || !Number.isFinite(fixedNum) || fixedNum <= 0 ? null : fixedNum;
  const refPriceEnv = refRaw === '' || refRaw === '0' || !Number.isFinite(refNum) || refNum <= 0 ? null : refNum;
  return {
    apiBase: pick('MM_API_BASE').replace(/\/+$/, ''),
    baseCid: toPosInt(pick('MM_BASE_CID'), 'MM_BASE_CID'),
    quoteCid: toPosInt(pick('MM_QUOTE_CID'), 'MM_QUOTE_CID'),
    spreadPct,
    orderSizeBase: toPosInt(pick('MM_ORDER_SIZE_BASE'), 'MM_ORDER_SIZE_BASE'),
    refPriceFixed,
    refPriceEnv,
    intervalS,
    maxInventoryPct,
    maxInventorySkewPct,
    maxNotionalUsd: toPosNum(pick('MM_MAX_NOTIONAL_USD'), 'MM_MAX_NOTIONAL_USD'),
    netRetries: toPosInt(pick('MM_NET_RETRIES'), 'MM_NET_RETRIES'),
    maxConsecFail: toPosInt(pick('MM_MAX_CONSEC_FAIL'), 'MM_MAX_CONSEC_FAIL'),
    metricsLimit: toPosInt(pick('MM_METRICS_LIMIT'), 'MM_METRICS_LIMIT'),
    killFlagFile: pick('MM_KILL_FLAG'),
    healthPort,
    intervalS,
    statusMaxAgeS: statusMaxAgeRaw > 0 ? statusMaxAgeRaw : intervalS * 3,
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
export function deriveRefPrice({ trades, fixedRefPrice = null, envRefPrice = null, stateRefPrice = null } = {}) {
  const okNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // ★ MM_REF_FIXED 优先级最高：操作者显式钉死基准价 ⇒ 报价中心恒为该值，
  //   成交价只用于成交/库存变化，不再移动报价（999/1011 ⇐ ref 1005 的漂移由此消除）。
  const fixedP = okNum(fixedRefPrice);
  if (fixedP !== null) return { refPrice: fixedP, source: 'fixed' };
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
 * 返回 { size, boundedBy }；boundedBy ∈ order_size | notional_cap | inventory_pct | quote_funds | base_funds。
 */
export function sizeOrderSide({ side, buyPrice, sellPrice, refPrice, quoteAvail, baseAvail, orderSizeBase, maxInventoryPct, maxNotionalUsd = Number.POSITIVE_INFINITY }) {
  if (side !== 'buy' && side !== 'sell') throw new Error(`sizeOrderSide: bad side ${JSON.stringify(side)}`);
  const ref = Number(refPrice);
  const q = Math.max(0, Math.floor(Number(quoteAvail) || 0));
  const b = Math.max(0, Math.floor(Number(baseAvail) || 0));
  const caps = { order_size: Math.floor(Number(orderSizeBase)) };
  const notional = Number(maxNotionalUsd);
  const priceForCap = side === 'buy' ? Number(buyPrice) : Number(sellPrice);
  if (Number.isFinite(notional) && notional > 0) {
    // 硬限额：单边单笔名义额 ≤ MM_MAX_NOTIONAL_USD ⇒ 挂量 ≤ floor(上限 / 本侧价)
    caps.notional_cap = priceForCap > 0 ? Math.floor(notional / priceForCap) : 0;
  }
  const notionalAvail = q + b * ref;
  caps.inventory_pct = ref > 0 ? Math.floor((notionalAvail * maxInventoryPct) / 100 / ref) : 0;
  if (side === 'buy') caps.quote_funds = buyPrice > 0 ? Math.floor(q / buyPrice) : 0;
  else caps.base_funds = Math.floor(b);
  let size = Number.POSITIVE_INFINITY;
  let boundedBy = null;
  for (const k of ['order_size', 'notional_cap', 'inventory_pct', side === 'buy' ? 'quote_funds' : 'base_funds']) {
    if (!(k in caps)) continue;
    const v = Number.isFinite(caps[k]) ? Math.max(0, caps[k]) : 0;
    if (v < size) {
      size = v;
      boundedBy = k;
    }
  }
  return { size: Math.max(0, Math.floor(size)), boundedBy };
}

/**
 * 两侧库存偏离（%）：|base 名义额 − quote 余额| / (base 名义额 + quote 余额) × 100。
 * 0 = 完全均衡；100 = 单边（另一侧为 0）。heavySide 指「偏重的那一侧」（base = 持币偏多）。
 */
export function computeInventorySkewPct({ baseAvail = 0, quoteAvail = 0, refPrice }) {
  const ref = Number(refPrice);
  if (!Number.isFinite(ref) || ref <= 0) throw new Error(`computeInventorySkewPct: bad refPrice ${JSON.stringify(refPrice)}`);
  const baseNotional = Math.max(0, Number(baseAvail) || 0) * ref;
  const quoteNotional = Math.max(0, Number(quoteAvail) || 0);
  const total = baseNotional + quoteNotional;
  if (!(total > 0)) return { skewPct: 0, heavySide: null, baseNotional: 0, quoteNotional: 0 };
  const skewPct = Math.round((Math.abs(baseNotional - quoteNotional) / total) * 10000) / 100;
  const heavySide = baseNotional === quoteNotional ? null : baseNotional > quoteNotional ? 'base' : 'quote';
  return { skewPct, heavySide, baseNotional, quoteNotional };
}

/**
 * 超偏离上限时该「继续加仓」的一侧不挂（只挂减仓侧）：
 *   base 偏重 ⇒ 再买 base 更偏 ⇒ 停买；quote 偏重 ⇒ 再卖 base 更偏 ⇒ 停卖。
 * 返回被禁挂的 side（'buy' | 'sell'），未超限 ⇒ null。
 */
export function skewBlockedSide({ skewPct, heavySide, maxSkewPct = Number.POSITIVE_INFINITY }) {
  const max = Number(maxSkewPct);
  if (!Number.isFinite(max) || max >= 100) return null; // 100% = 关闸失效（仅单边库存才算超限）
  if (!(Number(skewPct) > max)) return null;
  if (heavySide === 'base') return 'buy';
  if (heavySide === 'quote') return 'sell';
  return null;
}

/** 连续失败轮数 → 是否降级（只撤不挂）。 */
export function shouldDegrade({ consecutiveFailures = 0, threshold = 5 } = {}) {
  const t = Number(threshold) > 0 ? Math.floor(Number(threshold)) : 5;
  const n = Math.max(0, Math.floor(Number(consecutiveFailures) || 0));
  return { degraded: n >= t, reason: n >= t ? `consecutive_round_failures=${n}>=${t}` : null };
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
  maxNotionalUsd = Number.POSITIVE_INFINITY,
  maxInventorySkewPct = Number.POSITIVE_INFINITY,
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

  // 库存偏离闸：超上限 ⇒ 只禁「继续加仓」那一侧的新挂；已在目标价的工作单照旧保留（不做无谓翻撤）
  const skew = Number(refPrice) > 0
    ? computeInventorySkewPct({ baseAvail, quoteAvail, refPrice })
    : { skewPct: 0, heavySide: null, baseNotional: 0, quoteNotional: 0 };
  const skewBlocked = skewBlockedSide({ skewPct: skew.skewPct, heavySide: skew.heavySide, maxSkewPct: maxInventorySkewPct });

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
    if (skewBlocked === side) {
      alerts.push(`skip_place_${side}: inventory_skew=${skew.skewPct}%>${maxInventorySkewPct}% (${skew.heavySide}-heavy)`);
      continue;
    }
    const s = sizeOrderSide({
      side, buyPrice: buy, sellPrice: sell, refPrice,
      quoteAvail, baseAvail, orderSizeBase, maxInventoryPct, maxNotionalUsd,
    });
    if (s.size >= 1) {
      places.push({ side, price: targetPrice, amount: s.size, boundedBy: s.boundedBy, degraded: s.boundedBy !== 'order_size' });
    } else {
      alerts.push(`skip_place_${side}: ${s.boundedBy}=0 (quote_avail=${quoteAvail} base_avail=${baseAvail} max_notional_usd=${maxNotionalUsd})`);
    }
  }

  let mode = 'normal';
  if (places.length === 0 && keeps.length === 0) {
    // 库存低于阈值（无任何在价工作单 ∧ 两侧都挂不出新单）⇒ 只撤不挂 + 告警。
    // 此刻 keeps 为空 ⇒ 可撤的只剩 off_target 单（已在上面进 cancels）。
    mode = 'cancel_only';
    alerts.push('inventory_below_threshold: cancel-only mode (no side placeable, nothing at target)');
  }
  return { mode, keeps, cancels, places, alerts, skew };
}

// ============================================================================
// P1 托管化 · 运维纯函数（bot 与 kill 两处消费；同样零 IO，便于单测）
//   急停 flag 判定 / kill CLI 参数 / 全撤响应归并 / 指标滚动窗口 / --status 视图
// ============================================================================

/**
 * 急停 flag 判定：`<env 同目录>/mm-kill.flag` 存在 ⇒ 只撤不挂（flag 删掉即自动恢复）。
 * IO 在调用侧（fs.existsSync / fs.statSync），本函数只做语义归一。
 */
export function killSwitchState({ flagExists = false, flagPath = null, flagMtimeMs = null, nowMs = Date.now() } = {}) {
  if (!flagExists) return { active: false, reason: null, flag_path: flagPath, flag_age_s: null };
  const mtime = Number(flagMtimeMs);
  return {
    active: true,
    reason: 'kill_flag_present',
    flag_path: flagPath,
    flag_age_s: Number.isFinite(mtime) && mtime > 0 ? Math.max(0, Math.round((nowMs - mtime) / 1000)) : null,
  };
}

/** kill CLI 参数：`--env <path>` / `--dry-run`（只列不撤）/ `--no-flag`（撤但不落 flag）/ `--json` / `--help`。 */
export function parseKillArgs(argv = [], { defaultEnvPath = null } = {}) {
  const list = Array.isArray(argv) ? argv.map(String) : [];
  const has = (n) => list.includes(n);
  const value = (n) => {
    const i = list.indexOf(n);
    if (i < 0 || i + 1 >= list.length) return null;
    const v = list[i + 1];
    return String(v).startsWith('--') ? null : v;
  };
  const dryRun = has('--dry-run');
  return {
    envPath: value('--env') || defaultEnvPath,
    dryRun,
    noFlag: has('--no-flag'),
    json: has('--json'),
    help: has('--help') || has('-h'),
    // 执行意图：dry_run 只读盘口/在挂单；否则全撤并（默认）落 flag 挡住 bot 下一轮重挂
    mode: dryRun ? 'dry_run' : 'cancel_all',
    writeFlag: !dryRun && !has('--no-flag'),
    unknown: list.filter((a) => a.startsWith('--') && !['--env', '--dry-run', '--no-flag', '--json', '--help'].includes(a)),
  };
}

/** 在挂单归一（kill --dry-run 清单用；跨币对，不筛 pair）。 */
export function listOpenOrders(orders) {
  const out = [];
  for (const o of Array.isArray(orders) ? orders : []) {
    const status = String(o && o.status);
    if (status !== 'open' && status !== 'partial') continue;
    const total = Number(o && (o.volume_total ?? o.amount));
    const filled = Number(o && (o.volume_filled ?? o.amount_filled));
    const remaining = Number.isFinite(total) && Number.isFinite(filled) ? total - filled : 0;
    if (!(remaining > 0)) continue;
    out.push({
      oID: Number(o.oID ?? o.order_id),
      // quote 恒为 $（cid 1）；平台 /api/order 行不带 quote_cid ⇒ 兜底 1
      pair: `${o.bID ?? o.base_cid}/${o.qID ?? o.quote_cid ?? 1}`,
      side: String(o.side),
      price: Number(o.price),
      remaining,
    });
  }
  return out;
}

/** `DELETE /api/order`（全撤）响应 → { cancelled, attempted, failed, failed_ids }。 */
export function summarizeCancelAll(view = {}) {
  const v = view && typeof view === 'object' ? view : {};
  const orders = Array.isArray(v.orders) ? v.orders : [];
  const failedIds = orders.filter((o) => o && o.ok !== true).map((o) => String(o.order_id ?? o.oID ?? ''));
  const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
  return {
    cancelled: num(v.cancelled) ?? orders.filter((o) => o && o.ok === true).length,
    attempted: num(v.attempted) ?? orders.length,
    failed: num(v.failed) ?? failedIds.length,
    failed_ids: failedIds,
  };
}

/** 指标滚动保留：追加一条并只留最近 limit 条（默认 100）。 */
export function appendMetricEntry(entries, entry, limit = 100) {
  const list = Array.isArray(entries) ? entries.slice() : [];
  list.push(entry);
  const lim = Number(limit) > 0 ? Math.floor(Number(limit)) : 100;
  return list.slice(Math.max(0, list.length - lim));
}

/** 时间窗（缺省 1h）内错误/轮数汇总；坏条目忽略，未来时间戳忽略。 */
export function summarizeMetrics(entries, nowMs = Date.now(), windowMs = 3600_000) {
  const win = Number(windowMs) > 0 ? Number(windowMs) : 3600_000;
  let errors = 0;
  let rounds = 0;
  for (const e of Array.isArray(entries) ? entries : []) {
    const ts = Date.parse(String(e && e.ts));
    if (!Number.isFinite(ts) || ts > nowMs) continue;
    if (nowMs - ts > win) continue;
    rounds += 1;
    errors += Math.max(0, Math.floor(Number(e.errors) || 0));
  }
  return { errors_last_hour: errors, rounds_last_hour: rounds };
}

/**
 * `--status` 视图（读 state + metrics 后归一）：
 *   { last_round_at, age_seconds, ref_price, ref_source, quotes:{buy,sell}, balances, errors_last_hour }
 * age_seconds 无历史轮次 ⇒ null（全新机器，尚未跑过一轮）。
 */
export function buildStatusView({ state = {}, metrics = [], nowMs = Date.now() } = {}) {
  const s = state && typeof state === 'object' ? state : {};
  const tsNum = Number(s.last_round_ts);
  const tsParsed = Date.parse(String(s.last_round_ts_iso || ''));
  const ts = Number.isFinite(tsNum) && tsNum > 0 ? tsNum : Number.isFinite(tsParsed) ? tsParsed : 0;
  const q = s.last_quotes && typeof s.last_quotes === 'object' ? s.last_quotes : {};
  const b = s.last_balances && typeof s.last_balances === 'object' ? s.last_balances : {};
  const numOrNull = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
  return {
    last_round_at: ts > 0 ? new Date(ts).toISOString() : null,
    age_seconds: ts > 0 ? Math.max(0, Math.round((nowMs - ts) / 1000)) : null,
    ref_price: numOrNull(s.last_ref_price),
    ref_source: s.last_ref_source ?? null,
    quotes: { buy: numOrNull(q.buy), sell: numOrNull(q.sell) },
    balances: { quote_avail: numOrNull(b.quote_avail), base_avail: numOrNull(b.base_avail) },
    errors_last_hour: summarizeMetrics(metrics, nowMs).errors_last_hour,
  };
}

