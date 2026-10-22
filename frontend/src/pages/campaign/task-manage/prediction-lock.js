// ============================================================================
// 活动页任务管理 · prediction 编辑闸（自项目页 `ProjectNestedList` 原样迁来）
// ----------------------------------------------------------------------------
// 契约（同旧，零放宽）：父 task 一旦发布（非 draft），prediction 行的 payload / type / title
//   不得再改（服务端 409 `prediction_locked_after_publish`）⇒ 前端直接不出【编辑】，
//   只留「发布后不可编辑」一句。已结算的行同理（结算键 `correct_option` 由 settle 口独占写，
//   重发编辑会抹掉结算键）。
// ============================================================================

/** 已结算 prediction 的 payload 键（settle 口独占写）⇒ 该行不可编辑（重发会抹掉结算键）。 */
const PREDICTION_SETTLED_KEY = 'correct_option'

/**
 * prediction 行的【编辑】闸：
 *   · 非 prediction ⇒ 永不锁；
 *   · 父 task 非 draft ⇒ 锁；
 *   · draft 但 payload 已带结算键（已结算）⇒ 锁。
 */
export const predictionEditLocked = (subtask, taskStatus) => {
  if (String(subtask?.type_code || '') !== 'prediction') return false
  if (String(taskStatus || '') !== 'draft') return true
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  return Object.prototype.hasOwnProperty.call(payload, PREDICTION_SETTLED_KEY)
}
