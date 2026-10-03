import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import { applyToJob, acceptApplication, fetchJobDetail, fetchMyApplications, submitDeliverable } from './job-api'
import './jobs.css'

// 招工线 · 详情 + 申请 / 接受 / 提交（§4.2 J2–J4）
//   · 详情读口 = GET /api/task/:tID（**已注册** backend-ts/src/index.ts:404；miss ⇒ 404 R107，§3.1）
//   · 申请    = POST /api/job/:jobId/apply（:1330）—— 键**服务端派生**（job-service.ts:180）⇒ 不传键
//   · 接受    = POST /api/job/:jobId/accept（:1352）—— **无键面**；非雇主 ⇒ 403 AUTH_FORBIDDEN + ACTOR_NOT_ALLOWED
//   · 提交    = POST /api/task-progress/:identifier/submit（:591，既有面）—— 键**服务端派生**（job-service.ts:133）⇒ 不传键
//               （§4.2 J4 的另一条已注册面 = POST /api/job/:jobId/submit 别名面，`:jobId` 语义同 identifier）
// 所有失败文案一律走 R107 链（auth.js:112-156 `apiErrorMessage`）⇒ 必为**字符串**，不会出现 [object Object]。
const ActionState = { phase: 'idle', message: '' }

const JobDetailPage = () => {
  const { t } = useTranslation()
  const { jobId } = useParams()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [job, setJob] = useState(null)
  const [load, setLoad] = useState({ phase: 'loading', message: '' })
  const [myApps, setMyApps] = useState([])
  const [appsState, setAppsState] = useState({ phase: 'idle', message: '' })
  const [apply, setApply] = useState(ActionState)
  const [accept, setAccept] = useState(ActionState)
  const [submit, setSubmit] = useState(ActionState)
  const [applicationId, setApplicationId] = useState('')
  const [submitTarget, setSubmitTarget] = useState('')
  const [deliverable, setDeliverable] = useState('')
  // R-9-83 闭环：申请被「电量不足」拒绝（后端 4xx `error.details.reason` 为下述机读值时）⇒ 给出
  //   直达 `/profile#batt-checkin` 的可点击提示。★ 判据源 = 后端 reason；**拿不到就不显示**（不臆测）。
  const [battBlocked, setBattBlocked] = useState(false)

  const BATT_BELOW_ACCEPT_REASON = 'BATT_BELOW_ACCEPT_THRESHOLD'
  // R-9-88：提交（J4）被拒时后端回 `AUTH_FORBIDDEN` + `details.reason = 'ACTOR_NOT_ALLOWED'`
  //   （= 该申请不属于当前账号 / 非本人）⇒ 用**精确文案**覆盖通用「无权执行该操作」。
  // R-9-94（同族补齐）：提交（J4）命中 `stateConflict` 时后端回 `LEDGER_CURRENCY_INVALID_TRANSITION`
  //   + `details.reason = JOB_APPLICATION_STATE_INVALID`（未被雇主选定）/ `JOB_STATE_INVALID`（任务态不允许）
  //   ⇒ 亦给精确文案（`jobs.submitNotSelected` / `jobs.submitJobStateInvalid`）。
  //   ★ 判据源 = 后端 reason（`fetchApiJson` 透传，`auth.js:361`）；拿不到 ⇒ 保持原链路不变。
  const SUBMIT_REASON_I18N_KEYS = Object.freeze({
    ACTOR_NOT_ALLOWED: 'jobs.submitNotApplicant',
    JOB_APPLICATION_STATE_INVALID: 'jobs.submitNotSelected',
    JOB_STATE_INVALID: 'jobs.submitJobStateInvalid',
  })

  const loadDetail = useCallback(async () => {
    setLoad({ phase: 'loading', message: t('loading') })
    try {
      const data = await fetchJobDetail(jobId, user)
      setJob(data)
      setLoad({ phase: 'ok', message: '' })
    } catch (error) {
      setJob(null)
      setLoad({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }, [jobId, user, t])

  const loadMyApps = useCallback(async () => {
    if (!isAuthenticated) return
    setAppsState({ phase: 'loading', message: t('loading') })
    try {
      const data = await fetchMyApplications(user)
      const items = (Array.isArray(data) ? data : []).filter((item) => String(item?.tID) === String(jobId))
      setMyApps(items)
      setAppsState({ phase: 'ok', message: items.length ? '' : t('jobs.myAppsEmpty') })
      if (items.length) setSubmitTarget((prev) => prev || String(items[0].jID ?? ''))
    } catch (error) {
      setMyApps([])
      setAppsState({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, jobId, t])

  useEffect(() => { loadDetail() }, [loadDetail])
  useEffect(() => { loadMyApps() }, [loadMyApps])

  const run = async (setter, fn, okMessage, after, onError) => {
    try {
      const data = await fn()
      setter({ phase: 'ok', message: okMessage })
      if (after) after(data)
    } catch (error) {
      setter({ phase: 'error', message: String(error?.message || t('error')) })
      if (onError) onError(error)
    }
  }

  const onApply = async () => {
    if (apply.phase === 'loading') return
    setApply({ phase: 'loading', message: t('jobs.submitting') })
    setBattBlocked(false)
    await run(
      setApply,
      () => applyToJob(jobId, user),
      t('jobs.applyOk'),
      () => loadMyApps(),
      // 仅当后端回包携带 `error.details.reason` 且命中电量门槛码 ⇒ 显示闭环提示；否则清除。
      (error) => setBattBlocked(error?.details?.reason === BATT_BELOW_ACCEPT_REASON),
    )
  }

  const onAccept = async () => {
    if (accept.phase === 'loading') return
    setAccept({ phase: 'loading', message: t('jobs.submitting') })
    await run(setAccept, () => acceptApplication(jobId, applicationId, user), t('jobs.acceptOk'))
  }

  const onSubmitWork = async (event) => {
    event.preventDefault()
    if (submit.phase === 'loading') return
    setSubmit({ phase: 'loading', message: t('jobs.submitting') })
    await run(
      setSubmit,
      () => submitDeliverable(submitTarget, deliverable, user),
      t('jobs.submitOk'),
      () => loadMyApps(),
      // R-9-88 ③ / R-9-94：仅当后端机读面 `details.reason` 命中下表 ⇒ 精确文案覆盖通用文案；
      //   非该 reason（拿不到 / 其它值）⇒ `run` 已写入的原链路文案**逐字不变**（onError 不改）。
      (error) => {
        const reasonKey = SUBMIT_REASON_I18N_KEYS[error?.details?.reason]
        if (reasonKey) setSubmit({ phase: 'error', message: t(reasonKey) })
      },
    )
  }

  const pay = useMemo(() => (job?.points == null ? '—' : String(job.points)), [job])

  // TR-2：招工帖的**用户录入内容**（`title`/`note`）取当前语言；空串/缺字段 ⇒ 回落原文。
  const lang = getLanguageFromUrl(location.pathname)
  const jobTitle = pickLocalized(job, 'title', lang) || (job ? `#${job.tID}` : '')
  const jobNote = pickLocalized(job, 'note', lang) || '—'

  return (
    <div className="sf-layout" data-sf-m="jobs-layout">
      <div className="sf-layout-main">
        <div className="sf-jobs" data-sf-m="jobs-detail">
          <div className="sf-jobs-head" data-sf-m="jobs-hero">
            <h1 className="sf-jobs-title">{t('jobs.detail')}</h1>
            <div className="sf-jobs-actions">
              <Link className="sf-jobs-link" to={buildLocalizedPath(lang, '/task')}>{t('jobs.list')}</Link>
              <Link className="sf-jobs-link" to={buildLocalizedPath(lang, '/task/new')}>{t('jobs.publish')}</Link>
              <Link className="sf-jobs-link" to={location.pathname.replace(/\/[^/]+$/, '/review')}>{t('jobs.review')}</Link>
            </div>
          </div>

          {load.phase === 'loading' && <div className="sf-jobs-status" data-sf-m="jobs-load">{load.message}</div>}
          {load.phase === 'error' && (
            <div className="sf-jobs-err sf-jobs-status" data-sf-m="jobs-load" role="alert">{load.message}</div>
          )}

          {job && (
            <div className="sf-jobs-item" data-sf-m="jobs-item">
              <h2 className="sf-jobs-item-title" data-sf-m="jobs-item-title">
                {jobTitle}
                {/* 「翻译中」小标（`i18n_status ∈ {pending, partial}`；ready/缺省 ⇒ null） */}
                <TranslatingBadge status={contentStatus(job)} />
              </h2>
              <div className="sf-jobs-row">
                <span className="sf-jobs-pay" data-sf-m="jobs-pay">{pay}</span>
                <span className="sf-jobs-pay-unit">$</span>
                <span className="sf-jobs-tag">{t('jobs.reward')}</span>
              </div>
              <p className="sf-jobs-meta">{jobNote}</p>
              <p className="sf-jobs-meta" data-sf-m="jobs-meta">
                #{job.tID} · {t('jobs.participants', { count: job.participants_count || 0 })}
              </p>

              {isAuthenticated && (
                <div className="sf-jobs-row">
                  <button className="sf-btn sf-jobs-btn" type="button" data-sf-m="jobs-apply" onClick={onApply} disabled={apply.phase === 'loading'}>
                    {apply.phase === 'loading' ? t('jobs.submitting') : t('jobs.apply')}
                  </button>
                  <span
                    className={`sf-jobs-status${apply.phase === 'error' ? ' sf-jobs-err' : ''}${apply.phase === 'ok' ? ' sf-jobs-ok' : ''}`}
                    data-sf-m="jobs-apply-status"
                    role="status"
                  >
                    {apply.message}
                  </span>
                </div>
              )}

              {/* R-9-83 闭环：被拒原因 = 电量不足 ⇒ 可点击提示直达签到区（标签复用既有文案键）。 */}
              {battBlocked && (
                <Link
                  className="sf-jobs-link"
                  data-sf-m="jobs-batt-hint"
                  to={`${buildLocalizedPath(lang, '/profile')}#batt-checkin`}
                >
                  {t('battCard.insufficient')} · {t('checkinPanel.checkinButton')}
                </Link>
              )}
            </div>
          )}

          {/* R-9-88 ②：无本人申请 ⇒ **不渲染**提交表单，只给「先参与该任务」提示
              （不再要求用户手打申请编号 ⇒ 杜绝「填任务编号撞别人的申请」）。 */}
          {isAuthenticated && appsState.phase === 'ok' && myApps.length === 0 && (
            <div className="sf-jobs-panel" data-sf-m="jobs-submit-need-apply">
              <h2 className="sf-jobs-title">{t('jobs.submit')}</h2>
              <p className="sf-jobs-meta">{t('jobs.submitNeedApply')}</p>
            </div>
          )}

          {/* R-9-88 ①：提交目标**只能**由「我的报名」条目（下方 `setSubmitTarget`）带出 ⇒
              此处仅**只读**展示当前目标（application_id），**绝无**可编辑的手输框。 */}
          {isAuthenticated && myApps.length > 0 && (
            <form className="sf-jobs-panel" onSubmit={onSubmitWork} data-sf-m="jobs-submit-form">
              <h2 className="sf-jobs-title">{t('jobs.submit')}</h2>
              <p className="sf-jobs-meta">{t('jobs.submitNote')}</p>
              <p className="sf-jobs-meta" data-sf-m="jobs-submit-target">
                {t('jobs.applicationId')}
                {submitTarget ? ` #${submitTarget}` : ' —'}
              </p>
              <div className="sf-jobs-form">
                <label className="sf-jobs-field">
                  <span className="sf-jobs-label">{t('jobs.deliverable')}</span>
                  <input
                    className="sf-jobs-input"
                    data-sf-m="jobs-input-deliverable"
                    value={deliverable}
                    onChange={(e) => setDeliverable(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="sf-jobs-row">
                <button className="sf-btn sf-jobs-btn" type="submit" data-sf-m="jobs-submit" disabled={submit.phase === 'loading'}>
                  {submit.phase === 'loading' ? t('jobs.submitting') : t('jobs.submit')}
                </button>
                <span
                  className={`sf-jobs-status${submit.phase === 'error' ? ' sf-jobs-err' : ''}${submit.phase === 'ok' ? ' sf-jobs-ok' : ''}`}
                  data-sf-m="jobs-submit-status"
                  role="status"
                >
                  {submit.message}
                </span>
              </div>
            </form>
          )}

          {isAuthenticated && (
            <div className="sf-jobs-panel" data-sf-m="jobs-accept-panel">
              <h2 className="sf-jobs-title">{t('jobs.accept')}</h2>
              <p className="sf-jobs-meta">{t('jobs.acceptNote')}</p>
              <div className="sf-jobs-row">
                <input
                  className="sf-jobs-input"
                  data-sf-m="jobs-input-accept"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  inputMode="numeric"
                  placeholder={t('jobs.applicationId')}
                />
                <button className="sf-btn sf-jobs-btn" type="button" data-sf-m="jobs-accept" onClick={onAccept} disabled={accept.phase === 'loading'}>
                  {accept.phase === 'loading' ? t('jobs.submitting') : t('jobs.accept')}
                </button>
                <span
                  className={`sf-jobs-status${accept.phase === 'error' ? ' sf-jobs-err' : ''}${accept.phase === 'ok' ? ' sf-jobs-ok' : ''}`}
                  data-sf-m="jobs-accept-status"
                  role="status"
                >
                  {accept.message}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-jobs-panel" data-sf-m="jobs-side">
          <h2 className="sf-jobs-title">{t('jobs.myApps')}</h2>
          {appsState.phase === 'loading' && <div className="sf-jobs-status">{appsState.message}</div>}
          {appsState.phase === 'error' && <div className="sf-jobs-err sf-jobs-status" role="alert">{appsState.message}</div>}
          {appsState.phase === 'ok' && myApps.length === 0 && (
            <div className="sf-jobs-empty" data-sf-m="jobs-apps-empty">{t('jobs.myAppsEmpty')}</div>
          )}
          {myApps.map((item) => (
            <div className="sf-jobs-item" key={String(item.jID)} data-sf-m="jobs-app">
              <div className="sf-jobs-item-title">#{item.jID}</div>
              {/* P7-E 小尾巴批-β · R-7E-4（裁定：本仓禁死代码）：原 `{item.job_status || item.status || '—'}`
                  为**死分支** —— `item` 来自 `fetchMyApplications`（`GET /api/task-progress`）⇒ 后端
                  `listTaskProgressByUser`（`backend-ts/src/database.ts:1432`）SELECT 列集**不含** `status`/`job_status`，
                  行映射 `normalizeTaskProgress`（`:652`）输出键集亦无此二者 ⇒ **两字段恒 `undefined`**
                  （`job_application.status` 虽在库（`0014_job_flow.sql:93`）但**不随本读口回包**；要展示须改后端读口，本单禁改）。
                  处置：删除死分支，保留**产品口径的空态占位** `—`（常量，不再引用任何不存在的字段）。 */}
              <div className="sf-jobs-meta">{'—'}</div>
              <button className="sf-btn sf-jobs-btn" type="button" onClick={() => setSubmitTarget(String(item.jID ?? ''))}>
                {t('jobs.pick')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JobDetailPage
