/**
 * 「注册天数条件」四选一常量（Kevin 2026-10-21）—— 两处表单共用，别在页面里各写一份：
 *   ① `/task/new` 阻断面板的内嵌新建项目表单（`pages/jobs/PublishJobPage.jsx`）；
 *   ② `/wage` 项目卡【编辑】表单（`pages/wage/WagePage.jsx`）。
 * 后端 `recruit_min_account_days` 仍为 int（≥0），字段与校验零改动；前端把手填 number
 * 收敛为**恰 4 档** select，value = 天数本身（1 / 7 / 30 / 365），文案键挂既有
 * `bountyProject.days1/days7/days30/days365`（四语同补）。
 * 存量行不在四档（如历史 0 / 90）⇒ 编辑表单预选「一天」并在表单下提示
 * 「保存后将改为注册满 1 天」（N=0 提示「原为无门槛」）—— 保存载荷 = 选中的天数。
 */

/** 四档选项（单一真源；`key` = `bountyProject.*` 下的文案键）。 */
export const RECRUIT_MIN_DAYS_OPTIONS = [
  { days: 1, key: 'days1' },
  { days: 7, key: 'days7' },
  { days: 30, key: 'days30' },
  { days: 365, key: 'days365' },
]

/** 新建表单默认档 = 一天（1）。原先可填 0 ⇒ 改枚举后最小条件就是 1 天（后端 ≥0 仍兼容）。 */
export const RECRUIT_MIN_DAYS_DEFAULT = 1

const KNOWN_DAYS = new Set(RECRUIT_MIN_DAYS_OPTIONS.map((opt) => opt.days))

/**
 * 行值恰为四档之一？（编辑表单判据：true ⇒ 预选对应项；false ⇒ 预选「一天」+ 提示行。）
 * 非数字 / 缺键（undefined/null）⇒ 不算已知档（回落「一天」分支）。
 */
export const isRecruitMinDaysKnown = (raw) => {
  const n = Number(raw)
  return Number.isFinite(n) && KNOWN_DAYS.has(n)
}

/** 行值 → select 的 value（字符串）：恰为 1/7/30/365 ⇒ 对应档；否则回落默认「一天」。 */
export const recruitMinDaysSelectValue = (raw) => (
  isRecruitMinDaysKnown(raw) ? String(Number(raw)) : String(RECRUIT_MIN_DAYS_DEFAULT)
)
