// ============================================================================
// TR-2 · 用户录入内容的**多语读取** + 「翻译中」状态（前端消费面）
//
// 归属（跨片交接面，逐字）：`*_<lang>` 列与 `i18n_status` 由**后端（TR-1b）产出**；本模块**只读、不写**。
//   · 语言后缀 = `en` / `hk` / `vn`（`zh` 无后缀）；
//   · `*_<lang>`（`title_*` / `note_*` / `name_*` / `description_*` …）**恒有值** —— 未翻译时
//     **等于原文（中文）**、**不会为空串**；但**字段本身可能缺省**（旧载荷 / 未迁移行）⇒ 取值必须
//     对**空串与缺字段都安全**。★ 空串会穿透 `??`（`'' ?? x` ⇒ `''`）⇒ 本模块一律用 `||`，**禁 `??`**。
//   · `i18n_status: "ready" | "partial" | "pending"`（同对象一个值）；**字段缺省 ⇒ 不显示任何小标**。
//       ready   = 全部字段四语齐   ⇒ 无小标
//       partial = 介于两者之间     ⇒ 小标
//       pending = 一个都没有       ⇒ 小标
//
// 与既有写法的关系：`HomePage.jsx:36-96` / `TaskPage.jsx:47-67` / `RewardPage.jsx` 已用
//   `lang === 'en' ? (task.title_en ?? task.title) : …` 的**三目链**写法；本模块是同一语义的
//   **可复用形式**（新页不必抄四份三目链），且修掉了 `??` 的空串穿透。旧页保留原样（本单「只核不改」）。
// ============================================================================
import { SUPPORTED_LANGS } from './utils'

/** 带后缀的语言码（顺序即后缀清单；`zh` = 无后缀） */
export const CONTENT_LANGS = ['en', 'hk', 'vn']

/** 语言码 ⇒ 字段后缀（非法/`zh` ⇒ 空串） */
export const langSuffix = (lang) => (CONTENT_LANGS.includes(lang) ? `_${lang}` : '')

/** 语言码归一（非白名单 ⇒ `zh`；与 `utils.getLanguageFromUrl` 同一白名单） */
export const normalizeLang = (lang) => (SUPPORTED_LANGS.includes(lang) ? lang : 'zh')

/**
 * 取字段的当前语言值：`obj[<key>_<lang>] || obj[<key>]`（`zh` 直取无后缀字段）。
 * 对**空串**（⇒ 回落原文）与**缺字段**（⇒ `undefined`，由调用方兜底）都安全。
 * @param {object} obj    载荷行（可空）
 * @param {string} key    无后缀字段名（`title` / `note` / `name` / `description` / `info_input` …）
 * @param {string} lang   语言码
 * @returns {*} 当前语言值；原文也缺 ⇒ `undefined`
 */
export const pickLocalized = (obj, key, lang) => {
  if (!obj || typeof obj !== 'object') return undefined
  const suffix = langSuffix(normalizeLang(lang))
  if (!suffix) return obj[key]

  const localized = obj[`${key}${suffix}`]

  return localized || obj[key]
}

/**
 * 把一行的若干字段就地换成当前语言值（返回新对象，不改原行）。
 * `zh` 档 ⇒ 原样返回（本地零行为变化）。缺字段的键**不新增**（保持行形状）。
 */
export const localizeFields = (obj, keys, lang) => {
  if (!obj || typeof obj !== 'object') return obj
  const suffix = langSuffix(normalizeLang(lang))
  if (!suffix) return obj

  const next = { ...obj }
  for (const key of keys) {
    if (next[`${key}${suffix}`] === undefined && next[key] === undefined) continue
    next[key] = pickLocalized(next, key, lang)
  }

  return next
}

/** 需要显示「翻译中」小标的状态集（`ready` / 缺省 ⇒ 无小标） */
export const TRANSLATING_STATUSES = ['pending', 'partial']

/** 读 `i18n_status`：非字符串 / 缺省 ⇒ `null`（⇒ 不显示小标） */
export const contentStatus = (obj) => {
  const status = obj && typeof obj === 'object' ? obj.i18n_status : null

  return typeof status === 'string' && status ? status : null
}

/** `i18n_status` ⇒ 是否显示「翻译中」小标（缺省/`ready` ⇒ `false`） */
export const isTranslating = (status) => TRANSLATING_STATUSES.includes(status)

/** 便捷式：直接给行/对象判定小标 */
export const needsTranslatingBadge = (obj) => isTranslating(contentStatus(obj))
