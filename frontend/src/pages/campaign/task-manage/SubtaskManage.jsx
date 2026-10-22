import React, { useState } from 'react'
import ProjectForms from '../../project/ProjectForms'
import { removeProjectSubtasks } from '../../project/project-api'
import { buildSubtaskRemovePayload } from '../../project/project-payload'
import { writeFailNotice } from '../../project/project-error'
import { predictionEditLocked } from './prediction-lock'

// ============================================================================
// 子任务行级【编辑】【删除】（自项目页 `SubtaskRow` 原样迁来 · `/campaign/:ref` 操作主场）
// ----------------------------------------------------------------------------
// 契约（同旧，零放宽）：
//   · 编辑 = 行内就地切 `ProjectForms` 编辑态（`panel="subtask"` 预填），提交走
//     task PATCH `subtasks:[{subtask_id,…}]`（只送被改的那一条，键闭集在 project-payload）；
//   · **prediction 且父 task 非 draft ⇒ 不出【编辑】**（服务端 409
//     `prediction_locked_after_publish`），只留「发布后不可编辑」一句；已结算行同理
//     （`prediction-lock.js` 单一真源）；
//   · 删除 = **行内二次确认**（不弹窗）⇒ PATCH `subtasks_remove:[id]`；
//     409 `subtask_has_proofs` ⇒ 行内「删除失败：已有用户提交，不能删除」；
//   · 成功 ⇒ 回调页面层（`onManaged`）给结论 + 静默重读，行消失以读口为准，不本地伪造；
//   · 失败就地内联（code / details.reason / HTTP 状态三件取证 `data-sf-err-*`）。
// 显隐：仅 `canManage` 时由 `SubtaskItem` 挂载；`/task/:taskId` 任务页不传 ⇒ 零渲染。
// ============================================================================

const SubtaskManage = ({ subtask, task, campaign, slug, t, user, onManaged }) => {
  const taskRef = String(task?.task_id ?? '')
  const subtaskId = String(subtask?.subtask_id ?? '')
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [err, setErr] = useState(null)

  const editLocked = predictionEditLocked(subtask, task?.status)

  /** 【编辑】= 就地切编辑态（同一行再点 = 收起）。 */
  const toggleEdit = () => {
    if (!subtaskId) return
    setErr(null)
    setConfirming(false)
    setEditing((prev) => !prev)
  }

  /** 【删除】第一步：行内二次确认（不弹窗、不发请求）。 */
  const askDelete = () => {
    if (!subtaskId || removing) return
    setErr(null)
    setEditing(false)
    setConfirming(true)
  }

  /** 【删除】第二步：PATCH `{subtasks_remove:[id]}`；成功 ⇒ 页面静默重读，失败 ⇒ 行内内联。 */
  const confirmDelete = async () => {
    if (!subtaskId || removing) return
    const built = buildSubtaskRemovePayload([subtaskId])
    if (!built.ok) {
      // 本地构造失败（主键非法）⇒ 无错误体，保留原文案
      setErr({ text: t('project.deleteFailed'), code: '', reason: '', status: null })
      return
    }
    setRemoving(true)
    setErr(null)
    try {
      await removeProjectSubtasks(taskRef, built.payload.subtasks_remove, user)
      setConfirming(false)
      onManaged?.({ kind: 'ok', text: t('project.subtaskDeleted') })
    } catch (error) {
      // 删除失败：reason 中文映射 + 机读码 + HTTP（删除模板）
      setErr(writeFailNotice(error, t, 'project.deleteFailDetail'))
      setConfirming(false)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <div className="sf-campaign-subtask-actions" data-sf-m="campaign-subtask-actions">
        {editLocked ? (
          <span className="sf-campaign-subtask-locked" data-sf-m="campaign-subtask-locked">
            {t('project.predictionLocked')}
          </span>
        ) : (
          <button
            type="button"
            className="sf-campaign-btn is-ghost"
            data-sf-m="campaign-subtask-edit"
            data-sf-subtask={subtaskId}
            aria-expanded={editing}
            onClick={toggleEdit}
          >{t('project.subtaskEdit')}</button>
        )}
        {confirming ? (
          <>
            <span className="sf-campaign-subtask-confirm-text" data-sf-m="campaign-subtask-confirm-text">
              {t('project.confirmDelete')}
            </span>
            <button
              type="button"
              className="sf-campaign-btn is-danger"
              data-sf-m="campaign-subtask-confirm"
              data-sf-subtask={subtaskId}
              disabled={removing}
              onClick={confirmDelete}
            >{t('project.subtaskDelete')}</button>
            <button
              type="button"
              className="sf-campaign-btn is-ghost"
              data-sf-m="campaign-subtask-cancel"
              disabled={removing}
              onClick={() => setConfirming(false)}
            >{t('project.cancel')}</button>
          </>
        ) : (
          <button
            type="button"
            className="sf-campaign-btn is-ghost"
            data-sf-m="campaign-subtask-delete"
            data-sf-subtask={subtaskId}
            disabled={removing || editing}
            onClick={askDelete}
          >{t('project.subtaskDelete')}</button>
        )}
      </div>

      {err?.text ? (
        <p
          className="sf-project-notice is-err"
          data-sf-m="campaign-subtask-err"
          data-sf-err-code={err.code || ''}
          data-sf-err-reason={err.reason || ''}
          data-sf-err-status={err.status ?? ''}
          role="alert"
        >{err.text}</p>
      ) : null}

      {editing ? (
        <div className="sf-campaign-card-form" data-sf-m="campaign-card-form">
          <ProjectForms
            panel="subtask"
            slug={slug}
            campaignLock={campaign}
            taskLock={task}
            subtask={subtask}
            t={t}
            onClose={() => setEditing(false)}
            onDone={onManaged}
          />
        </div>
      ) : null}
    </>
  )
}

export default SubtaskManage
