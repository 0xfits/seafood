/**
 * 商品卡标题截断（2026-10-19 商品卡结构重定义 · Kevin 口径）
 * ============================================================================
 * 口径：按**显示宽单位**算 —— CJK / 全角 = 2 单位，拉丁字母 / 数字 / 半角符号 = 1 单位。
 *      上限 **48 单位**（= 24 个汉字 = 卡内宽 224 下两行 18px 的容量）。
 *      · 总宽 ≤ 48  ⇒ 原样返回（不截）
 *      · 总宽 > 48  ⇒ 逐字累积到 48 单位为止，再追加**字面 `...`**（三个 ASCII 点，不是 `…`）
 *
 * 与 CSS 的分工（双保险，互不替代）：
 *   · 本函数负责**字符级**截断 ⇒ 文本本身就以 `...` 收尾（可被 DOM 断言逐字核）。
 *   · `.row1-wrap-title` 的 `-webkit-line-clamp: 2` + `overflow: hidden` + 固定 48 高
 *     只兜底渲染侧（字体度量差异导致的意外折行），不再是「唯一截断手段」。
 *
 * 为什么不用 `text-overflow: ellipsis`：卡高恒 392 要求标题盒高固定 48（两行），
 * 多行省略号在 WebKit 下会吃掉行尾字符且没有可断言的文本形态；字符级截断可单测。
 */

/** 东亚宽字符 / 全角 / emoji 码点位（East Asian Wide & Fullwidth 的实用子集）。 */
const WIDE_RANGES = [
  [0x1100, 0x115f], // 韩文字母
  [0x2e80, 0x303e], // CJK 部首 / 标点（含「、。」）
  [0x3041, 0x33ff], // 假名 / 注音 / CJK 兼容
  [0x3400, 0x4dbf], // CJK 扩展 A
  [0x4e00, 0x9fff], // CJK 基本区（汉字主体）
  [0xa000, 0xa4cf], // 彝文
  [0xa960, 0xa97f], // 韩文扩展 A
  [0xac00, 0xd7a3], // 韩文音节
  [0xf900, 0xfaff], // CJK 兼容汉字
  [0xfe10, 0xfe19], // 竖排标点
  [0xfe30, 0xfe6f], // CJK 兼容形式 / 小写变体
  [0xff00, 0xff60], // 全角 ASCII
  [0xffe0, 0xffe6], // 全角符号
  [0x1f300, 0x1f64f], // emoji（杂项符号 / 表情）
  [0x1f900, 0x1f9ff], // emoji（补充符号）
]

/**
 * 单字符显示宽单位。
 * @param {string} ch 单个 Unicode 码位（请用 `Array.from` 迭代后传入，避免代理对被拆半）
 * @returns {1|2}
 */
export const charWidthUnits = (ch) => {
  if (!ch) return 0
  const cp = ch.codePointAt(0)
  if (cp == null) return 0
  if (cp < 0x1100) return 1 // 快速路径：绝大多数拉丁 / 数字 / 半角符号
  for (const [lo, hi] of WIDE_RANGES) {
    if (cp >= lo && cp <= hi) return 2
  }
  return 1
}

/**
 * 字符串显示宽单位合计。
 * @param {string} text
 * @returns {number}
 */
export const displayWidthUnits = (text) => {
  if (text == null) return 0
  let total = 0
  for (const ch of String(text)) total += charWidthUnits(ch)
  return total
}

/**
 * 超宽则按显示宽单位截断并追加字面 `...`。
 * @param {string|null|undefined} text 原文
 * @param {number} [maxUnits=48] 上限（显示宽单位）
 * @returns {string} 未超宽 ⇒ 原文；超宽 ⇒ 前缀（≤ maxUnits 单位）+ `...`
 */
export const truncateByWidth = (text, maxUnits = 48) => {
  if (text == null) return ''
  const source = String(text)
  if (displayWidthUnits(source) <= maxUnits) return source
  let used = 0
  let out = ''
  for (const ch of source) {
    const w = charWidthUnits(ch)
    if (used + w > maxUnits) break
    out += ch
    used += w
  }
  return `${out}...`
}

/** 标题上限（显示宽单位）—— 48 = 24 个汉字；与 `.row1-wrap-title` 的两行 18px × 24px 行高对齐 */
export const TITLE_MAX_UNITS = 48

export default truncateByWidth
