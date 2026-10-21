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

// ============================================================================
// 任务可见性 —— 列表面唯一谓词（`/campaign` 卡片内任务列 与 首页「热门任务」共用）
// ----------------------------------------------------------------------------
// 口径 = `GET /api/campaign/all` 的嵌套 task 面（R1：仅 active 活动 → 仅 status='active'
// 任务）。首页读口 `/api/home/campaign-tasks` 的 SQL 是 `t.status <> 'draft'`（含 ended），
// 比列表面宽 ⇒ **前端在唯一谓词处收窄**，否则首页会出现 `/campaign` 里看不到的行
// （Kevin 2026-10-21：两处必须是同一批任务）。
// ============================================================================
export const CAMPAIGN_LISTED_TASK_STATUS = 'active'

/** 任务是否出现在**列表面**（首页卡 / `/campaign` 卡内任务列）。 */
export const isCampaignListedTask = (status) => String(status ?? '').trim() === CAMPAIGN_LISTED_TASK_STATUS

/** 活动行 ⇒ 列表面任务数组（`tasks` 非数组 ⇒ `[]`；顺序沿用读口给的 `sort, task_id`）。 */
export const listedTasksOf = (campaign) => {
  const tasks = Array.isArray(campaign?.tasks) ? campaign.tasks : []
  return tasks.filter((task) => isCampaignListedTask(task?.status))
}

/** 子任务类型徽标键（五类；未知类型 ⇒ `null`，调用方回落到 seed 的 `type_label`）。 */
export const TYPE_CODES = ['x_verify', 'onchain_snapshot', 'survey', 'prediction', 'quiz']

export const typeKeyOf = (typeCode) => {
  const value = String(typeCode || '')
  return TYPE_CODES.includes(value) ? `campaign.type.${value}` : null
}

/** prediction 生命周期三态闭集（服务端读时派生；前端只读不判）。 */
export const PREDICTION_STATES = ['open', 'deadline_reached', 'settled']

/**
 * prediction 选项 = **固定 Yes / No**（Kevin 2026-10-22：发布者不再自填文案）。
 * `PREDICTION_CHOICES` 是唯一来源（面板据此渲染两枚按钮，i18n 键 `campaign.predictionYes/No`）。
 */
export const PREDICTION_CHOICES = ['yes', 'no']

/**
 * 选项归一：**新票 = `yes`/`no`**；旧行/旧票的 `a`/`b` 按 `a→yes`、`b→no` 兼容读（只读兼容，不再写旧值）。
 * 非法值 ⇒ `null`。
 */
export const normalizePredictionChoice = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'yes' || raw === 'a') return 'yes'
  if (raw === 'no' || raw === 'b') return 'no'
  return null
}

/**
 * 两个选项（恒两枚；文案走 i18n `labelKey`）。
 * `legacyText` = 旧四键行的 `option_a/option_b` 原文（仅作副行提示，不参与选择集；新行恒空）。
 */
export const predictionOptionsOf = (subtask) => {
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  const legacy = {
    yes: typeof payload.option_a === 'string' ? payload.option_a.trim() : '',
    no: typeof payload.option_b === 'string' ? payload.option_b.trim() : '',
  }
  return PREDICTION_CHOICES.map((choice) => ({
    choice,
    labelKey: choice === 'yes' ? 'campaign.predictionYes' : 'campaign.predictionNo',
    legacyText: legacy[choice],
  }))
}

/**
 * prediction 展示元信息。
 * · `state`：**服务端 `prediction_state` 优先**（读时派生，含 open/deadline_reached/settled）；
 *   旧读口未带该字段时按 `correct_option` + `deadline` 本地派生（同一套三态，无新状态）；
 * · `correct`：只在结算后由 settle 口回填（旧值 `a`/`b` 归一成 `yes`/`no`），是正确项高亮的唯一依据；
 * · `prize`：奖池 `$`（数字串），显示用，不做任何分摊计算（payout 一律服务端给）。
 */
export const predictionMetaOf = (subtask) => {
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  const rawState = String(subtask?.prediction_state || '')
  const correct = normalizePredictionChoice(payload.correct_option)
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
 * 个人预测结果：**服务端 `my_outcome` 优先**（`{choice, won, payout}`，payout 服务端算）；选项按
 * `normalizePredictionChoice` 归一（旧行 `a/b` ⇒ `yes/no`）。
 * 旧读口未带该字段时，只做「结算后 + 本机回执有选项」的**降级推导**（`won` 由公开的
 * `correct_option` 比对得出，`payout` **留空** —— 前端绝不自己算钱）。
 */
export const predictionOutcomeOf = (subtask, proof) => {
  const server = subtask?.my_outcome
  if (server && typeof server === 'object') {
    const won = server.won === true ? true : server.won === false ? false : null
    return {
      choice: normalizePredictionChoice(server.choice),
      won,
      payout: server.payout === null || server.payout === undefined || server.payout === '' ? null : String(server.payout),
      source: 'server',
    }
  }
  const meta = predictionMetaOf(subtask)
  const choice = normalizePredictionChoice(proof?.payload?.choice)
  if (!meta.correct || !choice) return null
  return { choice, won: choice === meta.correct, payout: null, source: 'local' }
}

// ============================================================================
// quiz（答题）—— 四选项多选 + 服务端判分
// ----------------------------------------------------------------------------
// 口径（Kevin 2026-10-22）：
//   · 发布侧填 4 个选项（a–d）与 1–4 个正确项；**公开读口不吐 `correct`** ⇒ 参与侧**不得本地推算答案**，
//     对错与发货金额一律取服务端字段（提交响应 / `my_outcome`）；
//   · 参与票 = `{answers:{picks:[...]}}`；答题奖励 `reward_amount` 是子任务列（迁移 0072）。
// ============================================================================
export const QUIZ_OPTION_KEYS = ['a', 'b', 'c', 'd']

/** quiz 选项数组：`payload.options` 的 a–d 逐格取文本（缺格/空串 ⇒ 该格不渲染）。 */
export const quizOptionsOf = (subtask) => {
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  const options = payload.options && typeof payload.options === 'object' && !Array.isArray(payload.options)
    ? payload.options
    : null
  if (!options) return []
  return QUIZ_OPTION_KEYS
    .map((key) => ({ key, text: typeof options[key] === 'string' ? options[key].trim() : '' }))
    .filter((option) => option.text)
}

/** quiz 答对奖励 `$`（子任务列优先，旧读口回落 payload）；缺失 ⇒ `null`。 */
export const quizRewardOf = (subtask) => {
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  const raw = subtask?.reward_amount ?? payload.reward_amount
  return raw === null || raw === undefined || raw === '' ? null : String(raw)
}

/** 本机/服务端已提交的选项（`my_proof.payload.answers.picks` 或回执同形）。 */
export const quizPicksOf = (proof) => {
  const picks = proof?.payload?.answers?.picks
  if (!Array.isArray(picks)) return []
  return QUIZ_OPTION_KEYS.filter((key) => picks.includes(key))
}

const boolOrNull = (value) => (value === true ? true : value === false ? false : null)

/**
 * quiz 判分结果（**只取服务端**，绝不本地比对答案）：
 *   ① `subtask.my_outcome`（读口给）→ ② `subtask.my_proof`（提交回执落库后的行）→ ③ `local`（本次提交响应）。
 * 字段吃 `quiz_correct`/`correct`/`won` 与 `reward_paid`/`payout`/`reward`。
 * 无任何判定 ⇒ `null`。
 */
export const quizOutcomeOf = (subtask, proof, local) => {
  const candidates = [subtask?.my_outcome, subtask?.my_proof, proof, local]
  for (const row of candidates) {
    if (!row || typeof row !== 'object') continue
    const correct = boolOrNull(row.quiz_correct ?? row.correct ?? row.won)
    const paidRaw = row.reward_paid ?? row.payout ?? row.reward
    if (correct === null && (paidRaw === undefined || paidRaw === null || paidRaw === '')) continue
    return {
      correct,
      reward: paidRaw === null || paidRaw === undefined || paidRaw === '' ? null : String(paidRaw),
      source: row === local ? 'local' : 'server',
    }
  }
  return null
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
