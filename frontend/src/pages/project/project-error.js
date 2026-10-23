// ============================================================================
// 项目页写口失败的「可定位」呈现（Kevin 2026-10-22）
// ----------------------------------------------------------------------------
// 背景：后端写口错误体形如 `{ error: { code, message, i18n_key, details: { reason, ... } } }`，
//   而三个表单与子任务行原先一律只落 `project.publishFailed`（「发布失败，请稍后重试。」）
//   ⇒ 页面上看不出是哪条闸拦住（409 发布后锁 / 400 换口径 / 409 有凭证 / 403 无权限…），
//   只能靠翻服务端日志。本模块把「机读三件」抬到文案与 DOM：
//     · `code`（`error.code`，如 `subtask_has_proofs` / `PREDICTION_OPTION_STYLE_IMMUTABLE`）
//     · `details.reason`（如 `project_owner_required`）
//     · `http status`（`error.status`）
//
// 硬口径：
//   · 文案 = `project.failDetail` / `project.deleteFailDetail` 模板，值为
//     「发布失败：<reason 文案 或 code>（HTTP <n>）」；**中文映射只覆盖本页常见闸**，
//     其余一律原样吐 `<code>`（机读码比假翻译更有用，也让探针能对拍）；
//   · **无错误体**（网络断 / 无 code 且无 reason / 无 HTTP 状态）⇒ 保留原文案
//     （`project.publishFailed`），不硬编「HTTP 0」这种假事实；
//   · 不做业务判断、不改请求：本模块只把异常对象**读出**来，绝不吞异常或改判成功。
// ============================================================================

/** 常见 reason / code ⇒ 文案键（其余不映射，直接显示机读码）。 */
export const WRITE_REASON_TEXT_KEYS = Object.freeze({
  // 权限（403 前置闸）
  project_owner_required: 'project.reasonOwnerRequired',
  // 发布后冻结（409）：prediction 的 payload/type/title 不可再改
  prediction_locked_after_publish: 'project.predictionLocked',
  // 已有用户凭证（409）：该子任务不能删
  subtask_has_proofs: 'project.hasProofs',
  // quiz 入参闸（400）
  QUIZ_REWARD_REQUIRED: 'project.reasonQuizRewardRequired',
  QUIZ_OPTIONS_INVALID: 'project.reasonQuizOptionsInvalid',
  // 子任务入参 / 归属 / 冲突（400 / 404）
  SUBTASK_INPUT_INVALID: 'project.reasonSubtaskInputInvalid',
  SUBTASK_REMOVE_OVERLAP: 'project.reasonSubtaskRemoveOverlap',
  subtask_not_in_task: 'project.reasonSubtaskNotInTask',
  // ★ 2026-10-22：项目页【加入 / 切换】写口（`POST /api/project/:id/apply`）的四条闸
  worker_already_hired: 'project.reasonAlreadyHired',
  project_headcount_full: 'project.reasonHeadcountFull',
  project_min_days_unmet: 'project.reasonMinDaysUnmet',
  project_not_recruiting: 'project.reasonNotRecruiting',
  // ★ Kevin 2026-10-23 ②：项目金库充值写口（`POST /api/project/:id/vault/recharge`）的三条闸
  //   （前两条是 400 机读码，第三条是币种闸；服务端 `project_vault_currency_not_listed` 等 409
  //   走未登记 ⇒ 机读码原文，不假翻译）
  VAULT_RECHARGE_INSUFFICIENT: 'project.vaultErrInsufficient',
  PROJECT_VAULT_AMOUNT_INVALID: 'project.vaultErrAmountInvalid',
  PROJECT_VAULT_CID_INVALID: 'project.vaultErrCidInvalid',
})

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())

/** 异常对象 → `{ code, reason, status }`（缺项一律空串 / null，绝不臆造）。 */
export const errPartsOf = (error) => {
  const body = error && typeof error === 'object' ? error : {}
  const nested = body.error && typeof body.error === 'object' ? body.error : {}
  const details = body.details && typeof body.details === 'object'
    ? body.details
    : (nested.details && typeof nested.details === 'object' ? nested.details : {})
  const code = text(body.code) || text(nested.code)
  const reason = text(details.reason)
  const statusRaw = Number(body.status ?? body.http_status ?? nested.status)
  const status = Number.isFinite(statusRaw) && statusRaw > 0 ? statusRaw : null
  return { code, reason, status }
}

/** reason（或 code）→ 已翻译文案；**大小写不敏感**（reason 是 `subtask_remove_overlap`，code 是 `SUBTASK_REMOVE_OVERLAP`，同一件事两种写法都要命中）；未登记 ⇒ 空串（调用方回退到机读码）。 */
const REASON_TEXT_BY_LOWER = Object.freeze(
  Object.fromEntries(Object.entries(WRITE_REASON_TEXT_KEYS).map(([k, v]) => [k.toLowerCase(), v])),
)

export const reasonTextOf = (key, t) => {
  if (!key) return ''
  const textKey = REASON_TEXT_BY_LOWER[String(key).trim().toLowerCase()]
  return textKey ? t(textKey) : ''
}

/**
 * 写口失败 → 内联提示对象 `{ text, code, reason, status }`。
 * `text` 直接可渲染；`code` / `reason` / `status` 供元素 `data-sf-err-*` 取证。
 * `templateKey` = 动作模板（发布 / 删除各一；编辑复用发布模板）。
 */
export const writeFailNotice = (error, t, templateKey = 'project.failDetail') => {
  const { code, reason, status } = errPartsOf(error)
  // 详因优先级：reason 的中文映射 > code 的中文映射 > 机读码原文（reason 其次）
  const detail = reasonTextOf(reason, t) || reasonTextOf(code, t) || code || reason
  if (!detail || status === null) {
    return { text: t('project.publishFailed'), code, reason, status }
  }
  return { text: t(templateKey, { detail, status }), code, reason, status }
}

export default writeFailNotice
