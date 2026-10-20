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

/** prediction 生命周期三态闭集（服务端读时派生；前端只读不判）。 */
export const PREDICTION_STATES = ['open', 'deadline_reached', 'settled']

/**
 * prediction 的两个选项：**服务端 payload 的 `option_a` / `option_b` 为准**（CP-P1 四键合同）。
 * 两枚都非空才返回数组（否则 `[]` ⇒ 调用方整块不渲染：宁可少渲染，不渲染半个预测）。
 */
export const predictionOptionsOf = (subtask) => {
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  const a = typeof payload.option_a === 'string' ? payload.option_a.trim() : ''
  const b = typeof payload.option_b === 'string' ? payload.option_b.trim() : ''
  if (!a || !b) return []
  return [{ choice: 'a', text: a }, { choice: 'b', text: b }]
}

/**
 * prediction 展示元信息。
 * · `state`：**服务端 `prediction_state` 优先**（读时派生，含 open/deadline_reached/settled）；
 *   旧读口未带该字段时按 `correct_option` + `deadline` 本地派生（同一套三态，无新状态）；
 * · `correct`：只在结算后由 settle 口回填 ⇒ 有值即「已结算」，是正确项高亮的唯一依据；
 * · `prize`：奖池 `$`（数字串），显示用，不做任何分摊计算（payout 一律服务端给）。
 */
export const predictionMetaOf = (subtask) => {
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  const rawState = String(subtask?.prediction_state || '')
  const correct = payload.correct_option === 'a' || payload.correct_option === 'b'
    ? payload.correct_option
    : null
  let state = PREDICTION_STATES.includes(rawState) ? rawState : null
  if (!state) {
    if (correct) state = 'settled'
    else {
      const deadlineMs = Date.parse(String(payload.deadline ?? ''))
      state = Number.isFinite(deadlineMs) && Date.now() >= deadlineMs ? 'deadline_reached' : 'open'
    }
  }
  const prize = payload.prize_amount === null || payload.prize_amount === undefined || payload.prize_amount === ''
    ? null
    : String(payload.prize_amount)
  return { options: predictionOptionsOf(subtask), prize, correct, state, deadline: payload.deadline ?? null }
}

/**
 * 个人预测结果：**服务端 `my_outcome` 优先**（`{choice, won, payout}`，payout 服务端算）；
 * 旧读口未带该字段时，只做「结算后 + 本机回执有选项」的**降级推导**（`won` 由公开的
 * `correct_option` 比对得出，`payout` **留空** —— 前端绝不自己算钱）。
 */
export const predictionOutcomeOf = (subtask, proof) => {
  const server = subtask?.my_outcome
  if (server && typeof server === 'object') {
    const won = server.won === true ? true : server.won === false ? false : null
    return {
      choice: server.choice === 'a' || server.choice === 'b' ? server.choice : null,
      won,
      payout: server.payout === null || server.payout === undefined || server.payout === '' ? null : String(server.payout),
      source: 'server',
    }
  }
  const meta = predictionMetaOf(subtask)
  const choice = proof?.payload?.choice
  if (!meta.correct || (choice !== 'a' && choice !== 'b')) return null
  return { choice, won: choice === meta.correct, payout: null, source: 'local' }
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
