import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { clearAuthSession } from '../auth'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'
import { applyToJob, submitDeliverable } from '../pages/jobs/job-api'

// ============================================================================
// 任务弹窗（招工线 · R-9-90/R-9-91/R-9-92）
//
// 口径（本单硬约束）：
//   · 提交目标**只能**是 `task.jID`（= application_id，来自 `/api/task-progress`）——
//     公开列表 `/api/task/all` 的 task 对象**没有** jID ⇒ **绝不**回退成「任务号 tID」
//     （旧写法 `task.jID || task.tID` 会把别人的申请编号当提交目标 ⇒ 生产 403
//     `AUTH_FORBIDDEN` + `details.reason='ACTOR_NOT_ALLOWED'`）。
//   · 无 `jID` ⇒ **不渲染提交表单**，改给「先参与」提示 + **参与**按钮（`applyToJob(task.tID)`）；
//     报名成功 ⇒ 提示「已报名，等雇主选定后即可提交」。
//   · 提交 / 参与一律走既有接线层（`submitDeliverable` / `applyToJob` ⇒ `fetchApiJson`，服务端派生幂等键、
//     R107 错误面统一），**不再**自拼 `data.message`、**不再**手打 fetch。
//   · 401 分流 / token 预检保留（行为与旧实现同源）；参与、提交失败文案**逐字**走同一链路。
//   · R-9-92 错误面：提交被拒且 `error.details.reason === 'ACTOR_NOT_ALLOWED'` ⇒ **精确文案**
//     （`jobs.submitNotApplicant`）；其它 reason / 无 details ⇒ 原链路通用文案**逐字不变**。
// ============================================================================
const SUBMIT_ACTOR_NOT_ALLOWED_REASON = 'ACTOR_NOT_ALLOWED'
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
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [errorText, setErrorText] = useState('')
  const navigate = useNavigate()
  const visible = typeof open === 'boolean' ? open : Boolean(isOpen)

  // 提交目标**只认** jID（application_id）；无 jID ⇒ 走「参与」面（R-9-90）
  const hasApplication = Boolean(
    task && task.jID !== undefined && task.jID !== null && task.jID !== '',
  )

  // 重置表单
  React.useEffect(() => {
    if (visible && task) {
      setInfoInput('')
      setApplied(false)
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

  // 提交交付物（仅在 hasApplication 时可达；identifier = 服务端已派生的申请号）
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!task || !hasApplication || !infoInput.trim()) return

    const user = readStoredUser()
    if (!ensureCredential(user)) return

    setSubmitting(true)
    setErrorText('')
    try {
      await submitDeliverable(task.jID, infoInput.trim(), user)
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
      if (error?.details?.reason === SUBMIT_ACTOR_NOT_ALLOWED_REASON) {
        // R-9-92：机读面命中 ⇒ 精确文案（非申请人本人）
        setErrorText(t('jobs.submitNotApplicant'))
        toast.error(t('jobs.submitNotApplicant'))
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

  // 参与报名（无 jID 面的按钮动作；task.tID = 招工号）
  const handleApply = async () => {
    if (!task || applying || task.tID === undefined || task.tID === null) return

    const user = readStoredUser()
    if (!ensureCredential(user)) return

    setApplying(true)
    setErrorText('')
    try {
      await applyToJob(task.tID, user)
      setApplied(true)
    } catch (error) {
      if (isUnauthorized(error)) {
        toast.error(t('sessionExpired'))
        clearAuthSession()
        toLogin()
        return
      }
      // 通用兜底：`apiErrorMessage` 已把 reason（如电量门槛）映射为四语文案，此处原样透出
      toast.error(`${t('error')}: ${error?.message || t('error')}`)
    } finally {
      setApplying(false)
    }
  }

  // 如果模态框关闭或没有任务，不显示
  if (!visible || !task) return null

  return (
    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="modal-container bg-white dark:bg-bg-dark rounded-lg shadow-xl w-full max-w-md">
        <div className="modal-header p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-bold">{hasApplication ? t('completeTask') : t('jobs.apply')}</h3>
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

          {hasApplication ? (
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
            // R-9-90：无 jID ⇒ **不渲染**提交表单，改给「先参与」提示 + 参与按钮
            <div data-sf-m="active-task-need-apply">
              <p className="text-text-secondary mb-6">{t('jobs.applyPrompt')}</p>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  className="btn btn-inactive"
                  onClick={onClose}
                  disabled={applying}
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-proceed"
                  data-sf-m="active-task-apply"
                  onClick={handleApply}
                  disabled={applying || applied}
                >
                  {applying ? t('submitting') : t('jobs.apply')}
                </button>
              </div>

              <p className="mt-3 text-sm text-green-600" data-sf-m="active-task-apply-status" role="status">
                {applied ? t('jobs.applyWaiting') : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActiveTaskModal
