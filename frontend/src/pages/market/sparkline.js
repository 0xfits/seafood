// ============================================================================
// 交易所线 · 价格走势（sparkline）纯几何层
// 数据源（现取，唯一）：`GET /api/market/:base_cid/trades?limit=50`（公开只读）
//   回包行键集 = `database.ts:2442 normalizeMarketTrade` ⇒
//     { trID, bID, buy_oID, sell_oID, buyer_uID, seller_uID, price, volume, time_created, brand_symbol }
//   · 排列 = **最新在前**（`ORDER BY time_created DESC, trade_id DESC`）⇒ 本层按 `time_created` 升序重排后出图；
//   · `time_created` = epoch **秒**；同秒多笔 ⇒ 以 `trID` 升序定序（旧→新）。
//
// 口径（本文件只做数学，不碰 DOM / 不碰 i18n / 不碰颜色）：
//   · 零新依赖、零新接口；z 轴不参与（价格走势只看 `price`）；
//   · 非数值 `price`（缺省/`null`/`''`）⇒ 该笔**不入图**（不补 0、不插值、不造点）；
//   · 全平（max === min）⇒ 画中线（有走势就看得见，不伪造波动）；
//   · 单笔 ⇒ 水平段 + 圆点（点由页面层用 zero-length path 画，见 CSS）；多点 ⇒ 折线 + 面积。
// 坐标系：viewBox 固定 `0 0 100 40`（`preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke`
//   ⇒ 宽度随容器自适应、线宽不随拉伸变形）。
// ============================================================================

export const TREND_VIEW_W = 100
export const TREND_VIEW_H = 40
export const TREND_PAD = 4

const round2 = (v) => Math.round(v * 100) / 100

/** 一笔成交的数值快照（不可解析 ⇒ `null`，由调用方过滤）。 */
const toPoint = (row) => {
  if (!row || typeof row !== 'object') return null
  // ★ `Number(null)` / `Number('')` 都 = 0（有限值）——必须显式挡掉，否则缺价成交会被画成 0 的假点
  const rawPrice = row.price
  if (rawPrice === null || rawPrice === undefined) return null
  if (typeof rawPrice === 'string' && rawPrice.trim() === '') return null
  const price = Number(rawPrice)
  if (!Number.isFinite(price)) return null
  const rawTime = Number(row.time_created)
  const trID = Number(row.trID ?? row.trade_id ?? row.trID)
  return {
    price,
    time: Number.isFinite(rawTime) ? rawTime : null,
    trID: Number.isFinite(trID) ? trID : 0,
  }
}

/**
 * 成交行 ⇒ 升序序列（旧→新）。缺时标的行排在**最前**（按「不知道该多旧」处理，不猜）。
 * 入参 = `trades.rows`（API 原序：最新在前）——本函数**不改入参**。
 */
export const buildTrendSeries = (rows) => {
  if (!Array.isArray(rows)) return []
  const points = rows.map(toPoint).filter(Boolean)
  return points.sort((a, b) => {
    if (a.time !== b.time) {
      if (a.time === null) return -1
      if (b.time === null) return 1
      return a.time - b.time
    }
    return a.trID - b.trID
  })
}

/**
 * 序列 ⇒ viewBox 内几何。
 * 返回 `null`（真空态：零笔可绘）或：
 *   { count, min, max, first, last, dir, flat, single, line, area, dot }
 *   · `dir < 0` ⇒ 下跌（页面层据此选既有 up/down token 上色）；`dir >= 0` ⇒ 上涨/持平；
 *   · `line`/`area` = SVG path `d`；`area` 已闭合到底边（面积渐变用）；
 *   · `dot` = 末点圆心（单笔 ⇒ 视口中点）。
 */
export const trendGeometry = (series, {
  width = TREND_VIEW_W,
  height = TREND_VIEW_H,
  pad = TREND_PAD,
} = {}) => {
  if (!Array.isArray(series) || series.length === 0) return null

  const count = series.length
  const prices = series.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const flat = max === min
  const innerH = Math.max(1, height - pad * 2)
  const yOf = (price) => (flat
    ? pad + innerH / 2
    : pad + innerH - ((price - min) / (max - min)) * innerH)
  const single = count === 1

  // 单笔：整条水平段（x: 0 → width），圆点落视口中点；多点：逐笔等距 + 末点圆点
  const points = single
    ? [{ x: 0, y: yOf(prices[0]) }, { x: width, y: yOf(prices[0]) }]
    : series.map((p, i) => ({ x: (i / (count - 1)) * width, y: yOf(p.price) }))

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round2(p.x)},${round2(p.y)}`)
    .join(' ')
  const area = `${line} L${round2(width)},${round2(height)} L0,${round2(height)} Z`
  const lastPoint = points[points.length - 1]
  const dot = single
    ? { x: width / 2, y: lastPoint.y }
    : lastPoint

  return {
    count,
    min,
    max,
    first: prices[0],
    last: prices[count - 1],
    dir: prices[count - 1] - prices[0],
    flat,
    single,
    line,
    area,
    dot,
  }
}
