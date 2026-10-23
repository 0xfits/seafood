// ============================================================================
// 项目表单 · 纯逻辑（单一真源：两个模态框共用）
// ----------------------------------------------------------------------------
// 沿革：本模块逐条自 `pages/wage/WagePage.jsx` **移出**（Kevin 2026-10-21②）——
//   编辑入口从 /wage 项目卡的行内展开**搬到项目自己的页面**（`/:slug` 的【编辑项目】），
//   表单改为模态框。
//   ★ Kevin 2026-10-22③：**拆成两个模态框** —— 【编辑项目】（项目面：标题 / 说明 / 地址）
//     与【招工】（招工面：人数 / 注册天数 / 每次工资 / 间隔 / 次币 + 金额）**互不嵌套、
//     各自提交**。为避免两套字段/校验/载荷各自漂移，逻辑仍只留这一份，按**字段集合**切分：
//   ★ Kevin 2026-10-23：**三框三分** ——
//     ① 【编辑项目】去掉 `status`（状态由系统派生：满员自动 recruiting→working，前端零入口）；
//     ② 【招工】人数改**增量**（填「本次新增名额」Y，提交 `headcount = 已招 X + Y`；后端
//        `headcount` 仍是绝对目标 ⇒ 增量换算只在前端做）；次币 + 每次工资 / 间隔移出；
//     ③ 新【设定工资标准】框（batt / 间隔 / 次币 + 金额），对新老成员一视同仁。
//   切分后键集**三向互斥**（`PROJECT_PAYLOAD_KEYS` / `RECRUIT_PAYLOAD_KEYS` / `WAGE_PAYLOAD_KEYS`）。
//   · `EDIT_REASON_MAP` —— 服务端 409/400 `details.reason` ⇒ { field, key }（字段级内联）；三框共用；
//   · `editFormOf` —— 读口行 ⇒ 表单初值（三框共用同一份初值；各自只渲染自己的字段）；
//   · `validateEditForm` / `validateRecruitForm` / `validateWageForm` —— 提交前客户端校验，按集合切分；
//   · `slugSubmitErrorOf` —— 项目地址 slug 的提交前置校验（格式/保留字/清空已设地址）；
//   · `slotsReadoutOf` —— 招工增量读数（已招 X · 新增 Y ⇒ 目标 X+Y）；
//   · `buildEditPayload` / `buildRecruitPayload` / `buildWagePayload` —— **只带变化字段**的载荷，
//     键集由三个 `*_PAYLOAD_KEYS` 定死（两币成对；清空 ⇒ 两键 null）；
//   · `errsOfPatchFailure` —— 写口失败 ⇒ 框内内联 errs（字段级优先，未登记 reason ⇒ 表单级兜底）；
//   · `currencyOptions` —— 次币下拉选项（排除平台 $ 的 cid 1，后端 `PROJECT_WAGE_CID_INVALID` 拒收）。
// 本模块**不引 React**：可被模态框与单测直接调用。
// ============================================================================

import { recruitMinDaysSelectValue } from '../../recruit-min-days'
import { slugFieldErrorOf } from '../../project-slug'

/**
 * 编辑表单的 `details.reason` ⇒ { field, key }（409/400 按**字段**内联；`field: null` = 表单级）。
 * `key` = 完整 i18n 键（间隔校验复用 `bountyProject.intervalInvalid`，同字段同文案）。
 * 未登记的 reason ⇒ 表单级兜底句（`wage.editFailed`），机读码不外泄。
 * 两框共用：字段落在哪一框由入口决定（招工框只会收到招工字段的 reason，项目框只会收到项目字段的）。
 */
export const EDIT_REASON_MAP = {
  project_headcount_below_hired: { field: 'headcount', key: 'wage.errHeadcountBelowHired' },
  // 状态类 reason（★ Kevin 2026-10-23 ①：前端**已无 status 入口**，本 UI 不再能触发；
  // 仍保留登记以防旧客户端 / 服务端派生路径回吐）⇒ 落**表单级**（`field: null`），
  // 因为三框里都没有 status 字段可内联，落字段级会变成静默丢弃文案。
  project_invalid_transition: { field: null, key: 'wage.errTransition' },
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
  PROJECT_STATUS_INVALID: { field: null, key: 'wage.errStatus' },
  // 项目地址 slug（Kevin 2026-10-21）：400 `SLUG_INVALID / SLUG_TAKEN` 借码 ⇒ 字段级内联
  //（服务端 reason 大小写两形都登记，承项目域 `project_*` 小写 reason 体例）。
  SLUG_INVALID: { field: 'slug', key: 'project.errSlugFormat' },
  SLUG_TAKEN: { field: 'slug', key: 'project.errSlugTaken' },
  project_slug_invalid: { field: 'slug', key: 'project.errSlugFormat' },
  project_slug_taken: { field: 'slug', key: 'project.errSlugTaken' },
  NOT_SUPPORTED: { field: null, key: 'wage.editFailed' },
}

/**
 * 三框的**载荷键集**（Kevin 2026-10-23 三框三分）。
 *   · 项目面（【编辑项目】）= 标题 / 说明 / 项目地址 —— ★ 无 `status`（系统派生，前端零入口）；
 *   · 招工面（【招工】）= 招工名额（增量换算成绝对 `headcount`）/ 注册天数条件；
 *   · 工资面（【设定工资标准】）= 每次工资 / 领取间隔 / 次币 cid / 次币金额。
 * 三集合互斥且并集 = `editFormOf` 的全部可写字段（单测有对拍断言）：任一键只归一个模态框，
 * 不会出现「两框都发同一键」的漂移。
 */
export const PROJECT_PAYLOAD_KEYS = ['title', 'description', 'slug']
export const RECRUIT_PAYLOAD_KEYS = ['headcount', 'recruit_min_account_days']
export const WAGE_PAYLOAD_KEYS = [
  'wage_batt_per_claim',
  'wage_interval_hours',
  'wage_cid',
  'wage_currency_amount',
]

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
 * **两框共用同一份初值**：各自只渲染自己集合内的字段，载荷再按集合筛键（见 `buildEditPayload`）。
 * 注册天数条件（Kevin 2026-10-21）= 四选一 select（常量真源 `src/recruit-min-days.js`）：
 * 恰为 1/7/30/365 ⇒ 预选对应项；否则（历史 0 / 90 / 缺键）⇒ 预选「一天」+ 表单下提示行。
 */
export const editFormOf = (row) => ({
  title: String(row?.title ?? ''),
  description: String(row?.description ?? ''),
  // 项目地址 slug：行无 slug（历史行）⇒ 空串 ⇒ 留空保存 = 零载荷不误发
  slug: String(row?.slug ?? ''),
  // ★ 招工名额改**增量**（Kevin 2026-10-23 ②）：`newSlots` = 本次新增名额，**不预填**
  //（增量无所谓「初值」，预填当前绝对值会被误读成「把目标改成 3」）；留空 = 不改名额。
  newSlots: '',
  minDays: recruitMinDaysSelectValue(row?.recruit_min_account_days ?? 0),
  batt: String(row?.wage_batt_per_claim ?? ''),
  interval: String(row?.wage_interval_hours ?? ''),
  cid: row?.wage_cid == null || row?.wage_cid === '' ? '' : String(row.wage_cid),
  amount: row?.wage_currency_amount == null || row?.wage_currency_amount === '' ? '' : String(row.wage_currency_amount),
})

/**
 * 招工增量读数（★ Kevin 2026-10-23 ②）：填 Y ⇒ 目标 = 已招 X + Y；Y 空 ⇒ 目标 = 当前名额。
 * 单一真源：模态框的读数行与载荷换算都走这里（不会出现「读数 5 / 提交 3」的漂移）。
 * `add` 非正整数文本 ⇒ 视作**未填**（null），`target` 回落当前名额 —— 校验层另行报错。
 */
export const slotsReadoutOf = (row, addText) => {
  const hired = num(row?.hired_count, 0)
  const current = num(row?.headcount, 0)
  const text = String(addText ?? '').trim()
  const add = isIntText(text) && Number(text) > 0 ? Number(text) : null
  return { hired, current, add, target: add == null ? current : hired + add }
}

/** 项目面校验（【编辑项目】：标题 / 说明）。`t` = i18n 取词。 */
export const validateEditForm = (form, t) => {
  const errs = {}
  const title = String(form?.title ?? '').trim()
  if (!title || title.length > 200) errs.title = t('wage.errTitle')
  if (String(form?.description ?? '').length > 20000) errs.description = t('wage.errDescription')
  return errs
}

/**
 * 招工面校验（【招工】：本次新增名额 / 注册天数条件）。
 * ★ Kevin 2026-10-23 ②：名额是**增量** ⇒ 留空合法（= 不改名额）；填了就必须是 ≥1 的整数
 * （填 0 无意义：增量 0 等于不动，容易误读成「把名额清零」，按非法报错）。
 */
export const validateRecruitForm = (form, t) => {
  const errs = {}
  const addText = String(form?.newSlots ?? '').trim()
  if (addText !== '' && (!isIntText(addText) || Number(addText) < 1)) {
    errs.newSlots = t('wage.errHeadcount')
  }
  const minDays = String(form?.minDays ?? '').trim()
  if (minDays !== '' && !isIntText(minDays)) errs.minDays = t('wage.errMinDays')
  return errs
}

/**
 * 工资标准校验（【设定工资标准】：每次工资 / 领取间隔 / 次币成对）。
 * ★ Kevin 2026-10-23 ③：本框是**全员生效**的工资口径 ⇒ 三项都不允许「空着蒙混」，
 * 与招工框拆开前的口径逐条一致（batt > 0、间隔 1–100、两币成对且金额允许 0）。
 */
export const validateWageForm = (form, t) => {
  const errs = {}
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
  // ★ Kevin 2026-10-23 ①：次币金额**允许 0**（「只发 batt、不发次币」是合法招工口径；
  //   后端 `asNonNegativeDecimal` 同宽，领薪时金额 0 ⇒ 整条次币腿跳过）。判据 ⇒ `< 0` 才非法。
  } else if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
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
 * 全字段候选载荷（**只带变化字段**；与行原值逐字段比对；两币任一侧变化 ⇒ 两键成对上送，
 * 清空 ⇒ 两键都 null —— 后端对「同现同缺」整包校验）。
 * 内部件：对外只暴露按集合筛过的 `buildEditPayload` / `buildRecruitPayload`（键集互斥，不重叠）。
 */
const payloadOfAll = (row, form) => {
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
  // ★ 招工名额 = **增量换算**（Kevin 2026-10-23 ②）：增量 Y > 0 ⇒ 上送绝对目标 `headcount`
  //   = 已招 X + Y（后端判满仍是 `hired >= headcount`，绝对口径）；Y 空 / 0 ⇒ 不发本键，
  //   名额保持原值（后端 `hired <= headcount` 不受影响）。
  const slots = slotsReadoutOf(row, form?.newSlots)
  if (slots.add != null) body.headcount = slots.target
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

  return body
}

/** 按集合筛键（键序 = 集合声明序；值来自 `payloadOfAll` 的变化项）。 */
const payloadOf = (keys, row, form) => {
  const all = payloadOfAll(row, form)
  const out = {}
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(all, key)) out[key] = all[key]
  }
  return out
}

/** 【编辑项目】载荷：只带**项目面**的变化字段（标题 / 说明 / 地址）。无变化 ⇒ `{}`。 */
export const buildEditPayload = (row, form) => payloadOf(PROJECT_PAYLOAD_KEYS, row, form)

/**
 * 【招工】载荷：只带**招工面**的变化字段（`headcount` = 增量换算后的绝对目标 /
 * `recruit_min_account_days`）。增量留空且天数未变 ⇒ `{}`（调用方零请求关闭）。
 */
export const buildRecruitPayload = (row, form) => payloadOf(RECRUIT_PAYLOAD_KEYS, row, form)

/** 【设定工资标准】载荷：只带**工资面**的变化字段（4 键；两币成对）。无变化 ⇒ `{}`。 */
export const buildWagePayload = (row, form) => payloadOf(WAGE_PAYLOAD_KEYS, row, form)

/**
 * 写口失败 ⇒ 框内内联 errs（两框共用）：
 *   ① 已登记 `details.reason` ⇒ 该字段内联（`hired` 插值供人数下限文案用）；
 *   ② 未登记 ⇒ 表单级兜底句 `wage.editFailed`（机读码不外泄）。
 */
export const errsOfPatchFailure = (error, t) => {
  const details = error?.details && typeof error.details === 'object' ? error.details : null
  const reason = typeof details?.reason === 'string' ? details.reason : ''
  const mapped = EDIT_REASON_MAP[reason]
  if (!mapped) return { general: t('wage.editFailed') }
  const text = t(mapped.key, { hired: num(details?.hired_count, 0) })
  return mapped.field ? { [mapped.field]: text } : { general: text }
}
