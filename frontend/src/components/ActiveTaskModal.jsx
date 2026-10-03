import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { clearAuthSession } from '../auth'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'
import { submitDeliverable } from '../pages/jobs/job-api'

// ============================================================================
// 任务弹窗（招工线 · R-9-90/R-9-91/R-9-92 · ★S3b 契约同步）
//
// 口径（S3b 硬约束；取代 R-9-90 的「参与面」）：
//   · 提交目标 = **任务号 `task.tID`（= job_id）**。S2 起 `POST /api/task-progress/:identifier/submit`
//     的 `identifier` 语义换轴为**目标 job_id**（后端 `job-service.ts:133` / `index.ts:938` 逐字）。
//     ⇒ 旧写法「只认 `task.jID`（申请编号）」已失效：**不需要**任何申请/报名前置。
//   · **无报名前置**（S2 `R-9-99`）：只要有任务号且任务 `open` ⇒ **直接渲染提交表单**
//     （不再依赖 `task.jID` 是否存在；「先参与」分支与 `applyToJob` 调用已随 J2 下架删除）。
//   · 提交一律走既有接线层（`submitDeliverable` ⇒ `fetchApiJson`，服务端派生幂等键、R107 错误面统一），
//     **不再**自拼 `data.message`、**不再**手打 fetch。
//   · 401 分流 / token 预检保留（行为与旧实现同源）；提交失败文案**逐字**走同一链路。
//   · R-9-92 错误面：提交被拒且 `error.details.reason === 'ACTOR_NOT_ALLOWED'` ⇒ **精确文案**
//     （`jobs.submitNotApplicant`）。
//   · R-9-94 错误面（同族补齐）：另两条机读 reason 亦给精确文案 ——
//     `JOB_APPLICATION_STATE_INVALID` ⇒ `jobs.submitNotSelected` · `JOB_STATE_INVALID` ⇒ `jobs.submitJobStateInvalid`。
//     其它 reason / 无 details ⇒ 原链路通用文案**逐字不变**。
// ============================================================================
const SUBMIT_REASON_I18N_KEYS = Object.freeze({
  ACTOR_NOT_ALLOWED: 'jobs.submitNotApplicant',
  JOB_APPLICATION_STATE_INVALID: 'jobs.submitNotSelected',
  JOB_STATE_INVALID: 'jobs.submitJobStateInvalid',
})
const UNAUTHORIZED_CODE = 'AUTH_UNAUTHORIZED'
const UNAUTHORIZED_I18N_KEY = 'auth.err.AUTH_UNAUTHORIZED'

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** token 预检：'missing'（无凭证）/ 'malformed'（非 JWT 三段）/ 'ok'。 */
const tokenStatus = (user) => {
  const token = user?.token || user?.access_token || localStorage.getItem('token')
  if (!token) return 'missing'
  return String(token).split('.').length === 3 ? 'ok' : 'malformed'
}

const isUnauthorized = (error) => (
  error?.code === UNAUTHORIZED_CODE || error?.i18nKey === UNAUTHORIZED_I18N_KEY
)

const ActiveTaskModal = ({ open, isOpen, onClose, task }) => {
  const { t } = useTranslation()
  const [infoInput, setInfoInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const navigate = useNavigate()
  const visible = typeof open === 'boolean' ? open : Boolean(isOpen)

  // S3b：提交目标 = **任务号 tID（job_id）**；无报名前置 ⇒ 有任务号且任务 open 即可提交。
  const hasTaskNumber = Boolean(
    task && task.tID !== undefined && task.tID !== null && task.tID !== '',
  )
  const isTaskOpen = Boolean(task) && task.is_open !== false
  const canSubmit = hasTaskNumber && isTaskOpen

  // 重置表单
  React.useEffect(() => {
    if (visible && task) {
      setInfoInput('')
      setErrorText('')
    }
  }, [visible, task])

  const toLogin = () => navigate(
    buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'),
  )

  // token 预检（无凭证 / 凭证格式错）⇒ 保持旧实现同源：提示 + 跳登录（格式错另清会话）
  const ensureCredential = (user) => {
    const status = tokenStatus(user)
    if (status === 'missing') {
      toast.error(t('activeTaskModal.noCredential'))
      toLogin()
      return false
    }
    if (status === 'malformed') {
      toast.error(t('activeTaskModal.badCredential'))
      clearAuthSession()
      toLogin()
      return false
    }
    return true
  }

  // 提交交付物（仅 canSubmit 时可达；★identifier = 任务号 tID = job_id）
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!task || !canSubmit || !infoInput.trim()) return

    const user = readStoredUser()
    if (!ensureCredential(user)) return

    setSubmitting(true)
    setErrorText('')
    try {
      await submitDeliverable(task.tID, infoInput.trim(), user)
      toast.success(t('successSubmitTask'))
      onClose()
      // 重定向到任务页面并滚动到待验证部分
      navigate(`${buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/task')}#pending-verification`)
    } catch (error) {
      if (isUnauthorized(error)) {
        // Token 过期或无效，需要重新登录
        toast.error(t('sessionExpired'))
        clearAuthSession()
        toLogin()
        return
      }
      // R-9-92 / R-9-94：机读面 `details.reason` 命中 ⇒ 精确文案；未命中（其它 reason / 无 details）⇒ 通用文案逐字不变
      const reasonKey = SUBMIT_REASON_I18N_KEYS[error?.details?.reason]
      if (reasonKey) {
        setErrorText(t(reasonKey))
        toast.error(t(reasonKey))
      } else {
        // 其它 reason / 无 details / 网络错 ⇒ 原链路通用文案（逐字不变）
        const message = `${t('error')}: ${error?.message || t('error')}`
        setErrorText(message)
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 如果模态框关闭或没有任务，不显示
  if (!visible || !task) return null

  return (
    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="modal-container bg-white dark:bg-bg-dark rounded-lg shadow-xl w-full max-w-md">
        <div className="modal-header p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-bold">{canSubmit ? t('completeTask') : t('common.ended')}</h3>
          <button
            className="modal-close text-text-muted hover:text-text-primary transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-body p-6">
          <h4 className="text-lg font-medium mb-4">{task.title}</h4>
          <p className="text-text-secondary mb-6">{task.note}</p>

          {canSubmit ? (
            <form onSubmit={handleSubmit} data-sf-m="active-task-submit-form">
              <div className="mb-6">
                <label htmlFor="infoInput" className="block text-sm font-medium mb-2">
                  {t('submitInfo')}
                </label>
                <textarea
                  id="infoInput"
                  value={infoInput}
                  onChange={(e) => setInfoInput(e.target.value)}
                  placeholder={t('enterTaskInfo')}
                  className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  rows={6}
                  required
                />
              </div>

              {task.linkA && (
                <div className="mb-6">
                  <p className="text-sm text-text-secondary mb-2">{t('taskLink')}:</p>
                  <a
                    href={task.linkA}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm inline-flex items-center"
                  >
                    {task.linkA}
                    <span className="ml-1">↗</span>
                  </a>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  className="btn btn-inactive"
                  onClick={onClose}
                  disabled={submitting}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-proceed"
                  disabled={submitting || !infoInput.trim()}
                >
                  {submitting ? (
                    <span className="flex items-center">
                      <div className="loading-spinner mr-2 h-4 w-4"></div>
                      {t('submitting')}
                    </span>
                  ) : (
                    t('submitInfo')
                  )}
                </button>
              </div>

              <p
                className={`mt-3 text-sm${errorText ? ' text-red-500' : ''}`}
                data-sf-m="active-task-submit-status"
                role="status"
              >
                {errorText}
              </p>
            </form>
          ) : (
            // S3b：无任务号 / 任务非 open ⇒ 不渲染提交表单（「先参与」面已随 J2 下架删除）
            <div data-sf-m="active-task-submit-blocked">
              <p className="text-text-secondary mb-6">{t('jobs.submitJobStateInvalid')}</p>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  className="btn btn-inactive"
                  onClick={onClose}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActiveTaskModal
