/**
 * P6-I18N-LIT-B5 · `/theme-preview`（开发/比选预览页 · P4-B4c-i 地基）的**演示数据**
 *
 * ★ 归属与**不国际化**理由（recon 表②-c 逐条复核结论）：
 *   本页不是产品发布面，而是「主题 token + 横竖屏骨架」的可交互**比选量具**：
 *   ① 页面自述（标题 / 来源说明 / 量测表头）是开发者对量具的说明；
 *   ② 正文串（`/ 斤`、`码头分拣夜班（沈家门）`、`$320/天` …）是**演示行内容**，
 *      用来说明「四语切换与主题切换都不改这一行的高度」——将它们翻成四语会
 *      改变文本推进宽度，直接破坏本页要证明的「几何逐值相等」判据。
 *   ⇒ 取值刻意保持**源语言常量**（**language 不变式**：四语档下取值逐字相同），
 *     与 B1 对 ②-c 栏的处置同构；**不进 i18n 键集**（不写入 `locales/*.json`）。
 *
 * ★ 边界：本文件只被 `pages/ThemePreviewPage.jsx` 引用；**不参与任何产品发布面渲染**。
 *   若该路由未来转为对外发布，本文件即应改判为 ②-b 并接 i18n（recon §6 已登记该未测项）。
 */

// 页头：量具自述
export const PREVIEW_TITLE = '主题 token + 横竖屏骨架 · 可交互预览（P4-B4c-i 地基）'
export const PREVIEW_CURRENT = '当前档：'
export const PREVIEW_SOURCE_NOTE =
  '值真源 = docs/design/style-preview.html 变体 A（日档「码头大牌」）/ 变体 B（夜档「夜市行情板」）。' +
  '拖动窗口宽度：≤767px 进入手机竖屏骨架（底部 tab），≥1024px 为 web 横屏骨架（多栏）。'

// 主题切换按钮
export const THEME_BTN_DAY = '日档 · 码头大牌'
export const THEME_BTN_NIGHT = '夜档 · 夜市行情板'

// 骨架演示内容
export const SEARCH_DEMO = '搜 鲜活皮皮虾 / 大黄鱼 / 码头夜班招工 / 兑换 积分 —— 四语切换与主题切换都不改这一行的高度'
export const CHIP_DEMO = ['招工', '商品', '积分交易所', '终身返佣', '全部']
export const PRICE_UNIT = '/ 斤'
export const cardTitle = (index) => `当日捕 · 鲜活皮皮虾 ${index}`
export const CARD_META = '沈家门码头 · 手工开壳 · 当日捕'

// 侧栏演示内容
export const JOBS_TITLE = '招工精选 · 今日上新'
export const JOBS_DEMO = [
  { name: '码头分拣夜班（沈家门）', pay: '$320/天' },
  { name: '远洋船务搬运（舟山）', pay: '$410/天' },
  { name: '冷库分装白班（宁波）', pay: '$280/天' },
]
export const MARKET_TITLE = '积分行情'
export const REBATE_TAG = '终身多级返佣 · 十级'

// 量测输出区
export const LIVE_TITLE = '现行生效值（读 window.getComputedStyle，用于证明「主题确实换了值」）'
export const tableTitle = (keyCount) => `token 提取表（${keyCount} 键 · 日/夜键集合相同）`
export const TH_DAY = '日档（变体 A）'
export const TH_NIGHT = '夜档（变体 B）'
export const TH_SAME = '同值?'
