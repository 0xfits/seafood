// ============================================================================
// 项目编辑表单 · 纯逻辑（单一真源）
// ----------------------------------------------------------------------------
// 沿革：本模块逐条自 `pages/wage/WagePage.jsx` **移出**（Kevin 2026-10-21②）——
//   编辑入口从 /wage 项目卡的行内展开**搬到项目自己的页面**（`/:slug` 的【编辑项目】），
//   表单改为模态框。为避免两套字段/校验/载荷各自漂移，逻辑只留这一份：
//   · `EDIT_REASON_MAP` —— 服务端 409/400 `details.reason` ⇒ { field, key }（字段级内联）；
//   · `editFormOf` —— 读口行 ⇒ 表单初值（数字/两币字段一律字符串化；注册天数回落四选一 select）；
//   · `validateEditForm` —— 提交前客户端校验（与后端 400 逐字段同口径，避免无用往返）；
//   · `slugSubmitErrorOf` —— 项目地址 slug 的提交前置校验（格式/保留字/清空已设地址）；
//   · `buildEditPayload` —— **只带变化字段**的载荷（两币成对；清空 ⇒ 两键 null）；
//   · `currencyOptions` —— 次币下拉选项（排除平台 $ 的 cid 1，后端 `PROJECT_WAGE_CID_INVALID` 拒收）。
// 本模块**不引 React**：可被模态框与单测直接调用。
// ============================================================================

import { recruitMinDaysSelectValue } from '../../recruit-min-days'
import { slugFieldErrorOf } from '../../project-slug'

/**
 * 编辑表单的 `details.reason` ⇒ { field, key }（409/400 按**字段**内联；`field: null` = 表单级）。
 * `key` = 完整 i18n 键（间隔校验复用 `bountyProject.intervalInvalid`，同字段同文案）。
 * 未登记的 reason ⇒ 表单级兜底句（`wage.editFailed`），机读码不外泄。
 */
export const EDIT_REASON_MAP = {
  project_headcount_below_hired: { field: 'headcount', key: 'wage.errHeadcountBelowHired' },
  project_invalid_transition: { field: 'status', key: 'wage.errTransition' },
  project_ended_frozen: { field: null, key: 'wage.errFrozen' },
  PROJECT_TITLE_INVALID: { field: 'title', key: 'wage.errTitle' },
  PROJECT_DESCRIPTION_INVALID: { field: 'description', key: 'wage.errDescription' },
  PROJECT_HEADCOUNT_INVALID: { field: 'headcount', key: 'wage.errHeadcount' },
  PROJECT_MIN_DAYS_INVALID: { field: 'minDays', key: 'wage.errMinDays' },
  PROJECT_WAGE_BATT_INVALID: { field: 'batt', key: 'wage.errBatt' },
  PROJECT_INTERVAL_INVALID: { field: 'interval', key: 'bountyProject.intervalInvalid' },
  PROJECT_WAGE_CURRENCY_PAIR_REQUIRED: { field: 'currency', key: 'wage.errCurrencyPair' },
  PROJECT_WAGE_CID_INVALID: { field: 'currency', key: 'wage.errCurrencyInvalid' },
  PROJECT_WAGE_AMOUNT_INVALID: { field: 'currency', key: 'wage.errCurrencyAmount' },
  project_wage_currency_not_found: { field: 'currency', key: 'wage.errCurrencyInvalid' },
  project_wage_currency_not_listed: { field: 'currency', key: 'wage.errCurrencyInvalid' },
  PROJECT_STATUS_INVALID: { field: 'status', key: 'wage.errStatus' },
  // 项目地址 slug（Kevin 2026-10-21）：400 `SLUG_INVALID / SLUG_TAKEN` 借码 ⇒ 字段级内联
  //（服务端 reason 大小写两形都登记，承项目域 `project_*` 小写 reason 体例）。
  SLUG_INVALID: { field: 'slug', key: 'project.errSlugFormat' },
  SLUG_TAKEN: { field: 'slug', key: 'project.errSlugTaken' },
  project_slug_invalid: { field: 'slug', key: 'project.errSlugFormat' },
  project_slug_taken: { field: 'slug', key: 'project.errSlugTaken' },
  NOT_SUPPORTED: { field: null, key: 'wage.editFailed' },
}

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 非负整数文本（含 '0'；空串不算）。 */
export const isIntText = (raw) => /^[0-9]+$/.test(String(raw ?? '').trim())

/**
 * 次币下拉选项：来源 = `GET /api/currencies`（公开只读）；
 * 排除平台 $（cid 1 —— 后端 `PROJECT_WAGE_CID_INVALID` 拒收，batt 本就以 $ 计价）；
 * 无符号且无名 ⇒ 不进下拉。编号只作 value 不上屏（显示 `symbol · name`）。
 */
export const currencyOptions = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((row) => row?.cid != null && String(row.cid) !== '1' && (row?.symbol || row?.name))
  .map((row) => ({
    cid: String(row.cid),
    label: `${row.symbol || ''}${row.name ? `${row.symbol ? ' · ' : ''}${row.name}` : ''}`,
  }))

/**
 * 行 → 表单初值（数字 / 两币字段一律字符串化；次币缺省 = '' 即「无（仅 batt）」）。
 * 注册天数条件（Kevin 2026-10-21）= 四选一 select（常量真源 `src/recruit-min-days.js`）：
 * 恰为 1/7/30/365 ⇒ 预选对应项；否则（历史 0 / 90 / 缺键）⇒ 预选「一天」+ 表单下提示行。
 */
export const editFormOf = (row) => ({
  title: String(row?.title ?? ''),
  description: String(row?.description ?? ''),
  // 项目地址 slug：行无 slug（历史行）⇒ 空串 ⇒ 留空保存 = 零载荷不误发
  slug: String(row?.slug ?? ''),
  headcount: String(row?.headcount ?? ''),
  minDays: recruitMinDaysSelectValue(row?.recruit_min_account_days ?? 0),
  batt: String(row?.wage_batt_per_claim ?? ''),
  interval: String(row?.wage_interval_hours ?? ''),
  cid: row?.wage_cid == null || row?.wage_cid === '' ? '' : String(row.wage_cid),
  amount: row?.wage_currency_amount == null || row?.wage_currency_amount === '' ? '' : String(row.wage_currency_amount),
  status: String(row?.status || '') === 'working' ? 'working' : 'recruiting',
})

/** 表单校验（提交前；与后端 400 逐字段同口径，避免无用往返）。`t` = i18n 取词。 */
export const validateEditForm = (form, t) => {
  const errs = {}
  const title = String(form?.title ?? '').trim()
  if (!title || title.length > 200) errs.title = t('wage.errTitle')
  if (String(form?.description ?? '').length > 20000) errs.description = t('wage.errDescription')
  if (!isIntText(form?.headcount) || Number(String(form.headcount).trim()) < 1) {
    errs.headcount = t('wage.errHeadcount')
  }
  const minDays = String(form?.minDays ?? '').trim()
  if (minDays !== '' && !isIntText(minDays)) errs.minDays = t('wage.errMinDays')
  const battText = String(form?.batt ?? '').trim()
  const batt = Number(battText)
  if (battText === '' || !Number.isFinite(batt) || batt <= 0) errs.batt = t('wage.errBatt')
  const interval = Number(String(form?.interval ?? '').trim())
  if (!Number.isInteger(interval) || interval < 1 || interval > 100) {
    // 与发布项目表单同字段同文案（复用既有键，零新增）
    errs.interval = t('bountyProject.intervalInvalid')
  }
  const cid = String(form?.cid ?? '')
  const amount = String(form?.amount ?? '').trim()
  if (cid === '') {
    if (amount !== '') errs.currency = t('wage.errCurrencyPair')
  } else if (!isIntText(cid) || Number(cid) === 1) {
    errs.currency = t('wage.errCurrencyInvalid')
  } else if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    errs.currency = t('wage.errCurrencyAmount')
  }
  return errs
}

/**
 * 项目地址 slug 的**提交前置**校验（格式 / 保留字 / 清空已设地址）⇒ 文案或 null。
 * 与行原值相同 ⇒ null（无变化不是错）；服务端 400 `SLUG_INVALID / SLUG_TAKEN` 仍走
 * `EDIT_REASON_MAP` 字段级兜底。
 */
export const slugSubmitErrorOf = (row, form, t) => {
  const next = String(form?.slug ?? '').trim()
  const orig = String(row?.slug ?? '')
  if (next === orig) return null
  const kind = slugFieldErrorOf(next)
  if (kind === 'reserved') return t('project.errSlugReserved')
  if (kind === 'format') return t('project.errSlugFormat')
  // 已设地址被清空 ⇒ 视为格式错（服务端同样拒收；不清不静默丢地址）
  if (next === '') return t('project.errSlugFormat')
  return null
}

/**
 * 载荷 = **只带变化字段**（与行原值逐字段比对；两币任一侧变化 ⇒ 两键成对上送，
 * 清空 ⇒ 两键都 null —— 后端对「同现同缺」整包校验）。无变化 ⇒ 空对象（调用方零请求关闭）。
 */
export const buildEditPayload = (row, form) => {
  const body = {}
  const nextTitle = String(form?.title ?? '').trim()
  if (nextTitle !== String(row?.title ?? '')) body.title = nextTitle
  if (String(form?.description ?? '') !== String(row?.description ?? '')) {
    body.description = String(form?.description ?? '')
  }
  // 项目地址 slug：**变化才发**（历史行留空 = 零载荷不误发；清空已设 slug = 发空串，
  // 由服务端定夺 —— 提交前置校验已先拦下）。
  const nextSlug = String(form?.slug ?? '').trim()
  if (nextSlug !== String(row?.slug ?? '')) body.slug = nextSlug

  const intField = (raw, orig) => {
    const text = String(raw ?? '').trim()
    if (!isIntText(text)) return undefined
    const n = Number(text)
    return n !== orig ? n : undefined
  }
  const headcount = intField(form?.headcount, num(row?.headcount, -1))
  if (headcount !== undefined) body.headcount = headcount
  // 注册天数下限：value 恒为四档天数之一（select 无空值态）；与行原值不同才发
  //（含「原 0 / 90 等非四档值 ⇒ 预选一天 ⇒ 保存即归 1」的收敛载荷）。
  const minDaysText = String(form?.minDays ?? '').trim()
  if (isIntText(minDaysText) || minDaysText === '') {
    const minDaysVal = minDaysText === '' ? 0 : Number(minDaysText)
    if (minDaysVal !== num(row?.recruit_min_account_days, 0)) body.recruit_min_account_days = minDaysVal
  }
  const interval = intField(form?.interval, num(row?.wage_interval_hours, -1))
  if (interval !== undefined) body.wage_interval_hours = interval

  const battText = String(form?.batt ?? '').trim()
  const batt = Number(battText)
  if (battText !== '' && Number.isFinite(batt) && batt > 0 && batt !== num(row?.wage_batt_per_claim, -1)) {
    body.wage_batt_per_claim = battText
  }

  const origCid = row?.wage_cid == null || row?.wage_cid === '' ? '' : String(row.wage_cid)
  const origAmount = row?.wage_currency_amount == null || row?.wage_currency_amount === ''
    ? '' : String(row.wage_currency_amount)
  const nextCid = String(form?.cid ?? '')
  const nextAmount = String(form?.amount ?? '').trim()
  if (nextCid !== origCid || nextAmount !== origAmount) {
    body.wage_cid = nextCid === '' ? null : Number(nextCid)
    body.wage_currency_amount = nextCid === '' ? null : nextAmount
  }

  const nextStatus = form?.status === 'working' ? 'working' : 'recruiting'
  if (nextStatus !== String(row?.status || '')) body.status = nextStatus
  return body
}
