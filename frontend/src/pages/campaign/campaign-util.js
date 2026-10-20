// ============================================================================
// 活动页共用的小工具（时间窗格式化 / 状态文案键 / 标识取值 / 类型徽标键）
// ----------------------------------------------------------------------------
// 硬口径（`docs/design/design-system.spec.md` §26.19.1）：
//   · 时间窗「start/end 任一在场即渲染」，**禁 ISO 原串直出**（#72）⇒ 一律格式化成本地时区文案；
//   · 类型徽标 = i18n 键 `campaign.type.<type_code>` 优先、后端 seed 的 `type_label` 兜底（#74）；
//   · 活动/任务标识取数字主键（读口两形态都吃，但写面与路由统一用主键）。
// ============================================================================

const LOCALE_BY_LANG = {
  zh: 'zh-CN',
  hk: 'zh-HK',
  en: 'en-US',
  vn: 'vi-VN',
}

/** 语言 → `Intl` locale（未知语言回落 zh-CN ⇒ 绝不出现 `undefined` 进 `toLocaleString`）。 */
export const localeOf = (lang) => LOCALE_BY_LANG[lang] || LOCALE_BY_LANG.zh

/**
 * 时间点 ⇒ 本地时区文案；空值 / 坏值 ⇒ `null`（调用方据此决定「整行不渲染」，不渲染残行）。
 * 接受 ISO 串与数字时间戳（秒级 / 毫秒级都吃 —— 后端回 ISO，探针可能喂 epoch）。
 */
export const formatDateTime = (value, lang) => {
  if (value === null || value === undefined || value === '') return null
  let ms = null
  if (typeof value === 'number') {
    ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : null
  } else {
    const raw = String(value).trim()
    if (/^\d+$/.test(raw)) {
      const n = Number(raw)
      ms = n > 1e12 ? n : n > 1e9 ? n * 1000 : null
    } else {
      const parsed = Date.parse(raw)
      ms = Number.isFinite(parsed) ? parsed : null
    }
  }
  if (ms === null) return null
  try {
    return new Date(ms).toLocaleString(localeOf(lang), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return null
  }
}

/**
 * 时间窗文案：起止都在 ⇒ 区间；只有一端 ⇒ 单端文案（**不渲染残缺行**）；都没有 ⇒ `null`。
 * 返回 `{ key, values }`（key 由调用方交给 `t()`，便于文案层统一改口径）。
 */
export const timeWindowOf = (row, lang) => {
  const start = formatDateTime(row?.time_start, lang)
  const end = formatDateTime(row?.time_end, lang)
  if (start && end) return { key: 'campaign.timeWindow', values: { start, end } }
  if (start) return { key: 'campaign.timeStartOnly', values: { start } }
  if (end) return { key: 'campaign.timeEndOnly', values: { end } }
  return null
}

/** 状态 ⇒ 文案键（`draft` 公众一般看不到，管理员读草稿时才可能出现）。 */
export const statusKeyOf = (status) => {
  const value = String(status || '')
  if (value === 'active') return 'campaign.statusActive'
  if (value === 'ended') return 'campaign.statusEnded'
  if (value === 'draft') return 'campaign.statusDraft'
  return null
}

/** 活动 / 任务的对外标识：数字主键优先（写面与路由统一），缺失才回落雪花号。 */
export const refOf = (row) => String(row?.campaign_id ?? row?.snowflake_id ?? '')

/** 子任务类型徽标键（五类；未知类型 ⇒ `null`，调用方回落到 seed 的 `type_label`）。 */
export const TYPE_CODES = ['x_verify', 'onchain_snapshot', 'survey', 'prediction', 'quiz']

export const typeKeyOf = (typeCode) => {
  const value = String(typeCode || '')
  return TYPE_CODES.includes(value) ? `campaign.type.${value}` : null
}

/** 任务完成奖：主奖励恒 `$`（读口是数字串）+ 可选次币（`reward_cid_secondary` + 金额）。 */
export const taskRewardOf = (task) => {
  const primary = task?.reward_amount_primary
  const secondaryAmount = task?.reward_amount_secondary
  const secondaryCid = task?.reward_cid_secondary
  return {
    primary: primary === null || primary === undefined || primary === '' ? null : String(primary),
    secondaryAmount: secondaryAmount === null || secondaryAmount === undefined || secondaryAmount === ''
      ? null
      : String(secondaryAmount),
    secondaryCid: secondaryCid === null || secondaryCid === undefined || secondaryCid === ''
      ? null
      : String(secondaryCid),
  }
}
