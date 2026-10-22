import React, { useState } from 'react'
import { patchProjectTaskStatus } from '../../project/project-api'
import { writeFailNotice } from '../../project/project-error'

// ============================================================================
// 任务卡头【上线 / 下线】开关（自项目页任务卡原样迁来 · `/campaign/:ref` 操作主场）
// ----------------------------------------------------------------------------
// 契约（同旧，零放宽）：
//   · 只有 draft / active 两态可切（draft ⇄ active），ended 封板（服务端同口径 409）；
//   · PATCH `/api/campaign/task/:taskId` body 恰 `{status}` 一键（其余键缺省 ⇒ 库内现值不动）；
//   · 成功 ⇒ 不改本地徽标，回调页面层静默重读（卡片自身不吃结果，避免两处真相）；
//   · 失败（403 / 404 / 409 封板 / 网络）⇒ **就地内联**，文案带 code / details.reason / HTTP
//     状态（`writeFailNotice`），不谎报状态已变。
// ============================================================================

const TaskStatusToggle = ({ task, t, user, onChanged }) => {
  const status = String(task?.status || '')
  const taskRef = String(task?.task_id ?? '')
  const nextStatus = status === 'draft' ? 'active' : status === 'active' ? 'draft' : ''
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  if (!nextStatus || !taskRef) return null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      await patchProjectTaskStatus(taskRef, nextStatus, user)
      setBusy(false)
      onChanged?.(nextStatus, task)
    } catch (error) {
      setBusy(false)
      setErr(writeFailNotice(error, t))
    }
  }

  return (
    <>
      <button
        type="button"
        className="sf-campaign-btn"
        data-sf-m="campaign-task-status-toggle"
        data-sf-task={taskRef}
        data-sf-next={nextStatus}
        disabled={busy}
        onClick={toggle}
      >{t(status === 'draft' ? 'project.taskOnline' : 'project.taskOffline')}</button>
      {err?.text ? (
        <p
          className="sf-project-notice is-err"
          data-sf-m="campaign-task-status-err"
          data-sf-task={taskRef}
          data-sf-err-code={err.code || ''}
          data-sf-err-reason={err.reason || ''}
          data-sf-err-status={err.status ?? ''}
          role="alert"
        >{err.text}</p>
      ) : null}
    </>
  )
}

export default TaskStatusToggle
