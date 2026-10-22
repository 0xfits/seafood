// ============================================================================
// 首页商品**客户端排序**（纯函数层：零 React / 零网络 / 零 DOM，单测直打）
// ----------------------------------------------------------------------------
// 口径（Kevin 2026-10-22 改口：排序回到前端）：
//   · 读口 `GET /api/prize/all?skip=<n>&limit=36` **不再带 `sort`** —— 它只负责
//     「取下一页」，服务器默认序（score desc, time_created desc, id desc）保持稳定，
//     保证滚动加载**不重不漏**；
//   · 两标签的**序**由本文件算：切档 = 只重排已加载行（**零网络请求**）；
//   · 每页 append 之后按**当前档**重新应用排序 ⇒ 新行落到该在的位置（不是简单追加）。
//
// 两档口径（唯一真源）：
//   · `recommend`：`feed_score` 降序 → `time_created` 降序 → `bID` 降序
//     （`feed_score` = 后端 FEED-RANK-v2 五因子加权分的**数字字符串**，如 "0.412345"；
//      前端**不算分**，只读该字段）；
//   · `new`：`time_created` 降序 → `bID` 降序。
//
// 病态行处置（旧缓存 / 旧读口降级 / 过渡态）：
//   · 缺 `feed_score`（null / '' / 非数）⇒ **按 0 处理**，不得把整列顺序打乱；
//   · 缺 `time_created` ⇒ 按 0 处理；
//   · 三者全同 ⇒ **稳定**（沿用输入次序，末位 tie-break 用原索引）。
// ============================================================================

/** 两标签（顺序即渲染顺序；`labelKey` 为既有 i18n 键，零新增）。 */
export const FEED_SORTS = [
  { key: 'recommend', labelKey: 'item.sortRecommend' },
  { key: 'new', labelKey: 'item.sortNew' },
]

const FEED_SORT_KEYS = new Set(FEED_SORTS.map((sort) => sort.key))

/** 排序闭集归一：未知值（含历史 `?sort=` 的成因值）一律回退 `recommend`。 */
export const normalizeFeedSort = (value) => (FEED_SORT_KEYS.has(value) ? value : 'recommend')

/** 时间戳归一为**毫秒**（秒 / 毫秒 / ISO 串 / 数字串皆可；无效 ⇒ 0）。 */
const toEpochMs = (value) => {
  if (value == null || value === '') return 0
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0
    return value < 1e11 ? value * 1000 : value // < 1e11 视作**秒**（1e11 ms ≈ 1973 年，秒到 1e11 已是公元 5138 年）
  }
  const raw = String(value).trim()
  if (!raw) return 0
  if (/^-?\d+(\.\d+)?$/.test(raw)) return toEpochMs(Number(raw))
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

/** `feed_score` 读数：数字字符串 ⇒ 数值；缺 / 非数 ⇒ **0**（不参与判别，但排序仍稳定）。 */
export const feedScoreOf = (row) => {
  const raw = row?.feed_score
  if (raw == null || raw === '') return 0
  const score = typeof raw === 'number' ? raw : Number(String(raw).trim())
  return Number.isFinite(score) ? score : 0
}

/** 发布时间读数（毫秒）。 */
export const feedTimeOf = (row) => toEpochMs(row?.time_created)

/** `bID` 比较：两侧可转数 ⇒ 数值降序；否则字符串降序（本地口径，稳定）。 */
const compareBID = (a, b) => {
  const left = a?.bID ?? a?.listing_id
  const right = b?.bID ?? b?.listing_id
  const ln = Number(left)
  const rn = Number(right)
  if (Number.isFinite(ln) && Number.isFinite(rn) && ln !== rn) return rn - ln
  const ls = String(left ?? '')
  const rs = String(right ?? '')
  if (ls === rs) return 0
  return ls < rs ? 1 : -1
}

/**
 * 按档排序（**不改入参**，返回新数组）。
 * @param {Array<object>} rows 读口行（含 `feed_score` / `time_created` / `bID`）
 * @param {'recommend'|'new'} sort
 */
export const sortFeedRows = (rows, sort) => {
  const mode = normalizeFeedSort(sort)
  const list = Array.isArray(rows) ? rows : []
  // 原索引作末位 tie-break ⇒ 全同值行**稳定**（不依赖引擎排序稳定性）
  const indexed = list.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    if (mode === 'recommend') {
      const delta = feedScoreOf(b.row) - feedScoreOf(a.row)
      if (delta !== 0) return delta
    }
    const timeDelta = feedTimeOf(b.row) - feedTimeOf(a.row)
    if (timeDelta !== 0) return timeDelta
    const idDelta = compareBID(a.row, b.row)
    if (idDelta !== 0) return idDelta
    return a.index - b.index
  })
  return indexed.map(({ row }) => row)
}

/** 行键（`bID` 优先，回落 `listing_id`）。 */
export const feedRowKey = (row) => row?.bID ?? row?.listing_id ?? null

/**
 * 逐页并入 + 按 `bID` 去重（同一行在后续页重复出现时保留**首见**行，就地更新不换位）。
 * 返回的数组保持「服务器到达序」，排序交给 `sortFeedRows`（口径分离：合并 ≠ 排序）。
 */
export const mergeFeedRows = (prev, incoming) => {
  const merged = Array.isArray(prev) ? [...prev] : []
  const seen = new Set(merged.map((row) => feedRowKey(row)).filter((key) => key != null && key !== ''))
  for (const row of Array.isArray(incoming) ? incoming : []) {
    const key = feedRowKey(row)
    if (key == null || key === '' || seen.has(key)) continue
    seen.add(key)
    merged.push(row)
  }
  return merged
}

/** 期望的行键序列（探针 / 测试断言 DOM 顺序用）。 */
export const feedOrderKeys = (rows, sort) => sortFeedRows(rows, sort).map((row) => String(feedRowKey(row)))
