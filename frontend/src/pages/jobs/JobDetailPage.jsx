import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import { fetchJobDetail, fetchMyApplications, submitDeliverable } from './job-api'
import './jobs.css'

// 招工线 · 详情 + 提交（§4.2 J4 · ★S3b 契约同步）
//   · 详情读口 = GET /api/task/:tID（**已注册** backend-ts/src/index.ts:404；miss ⇒ 404 R107，§3.1）
//   · 提交    = POST /api/task-progress/:identifier/submit（:919，既有面）—— ★`identifier` = 目标 **`job_id`**
//               （S2 起语义换轴，**不再是**申请编号）；键**服务端派生**（job-service.ts:133）⇒ 不传键
//               （§4.2 J4 的另一条已注册面 = POST /api/job/:jobId/submit 别名面，`:jobId` 语义同 identifier）
//   · ★ J2 报名（`POST /api/job/:jobId/apply`）与 J3 选定（`POST /api/job/:jobId/accept`）两写面**已下架**
//     （恒 `410` + `details.reason` = `APPLY_RETIRED` / `ACCEPT_RETIRED`）⇒ 本页**零调用**、两面板已删。
//   · 无报名前置 ⇒ 已登录 + 任务 open 即渲染提交表单（不再依赖「我的报名」条目）。
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
  const [submit, setSubmit] = useState(ActionState)
  const [deliverable, setDeliverable] = useState('')
  // R-9-83 闭环：提交被「电量不足」拒绝（后端 4xx `error.details.reason` 为下述机读值时）⇒ 给出
  //   直达 `/profile#batt-checkin` 的可点击提示。★ 判据源 = 后端 reason；**拿不到就不显示**（不臆测）。
  //   ★ S3b：`batt` 闸已由「报名」移到「提交」（S2）⇒ 该闭环挂到提交面（原挂报名面已随 J2 下架删除）。
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
      // ★ S3b：`jID` 语义 = **`submission_id`**（S2 换轴）⇒ 同一任务**可多条**（同人可多次提交），
      //   本侧栏按原样逐条展示本人提交，不再假设「一人一申请一条」。
      const items = (Array.isArray(data) ? data : []).filter((item) => String(item?.tID) === String(jobId))
      setMyApps(items)
      setAppsState({ phase: 'ok', message: items.length ? '' : t('jobs.myAppsEmpty') })
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

  const onSubmitWork = async (event) => {
    event.preventDefault()
    if (submit.phase === 'loading') return
    setSubmit({ phase: 'loading', message: t('jobs.submitting') })
    setBattBlocked(false)
    await run(
      setSubmit,
      // ★ S3b：`identifier` = **目标 job_id**（S2 换轴；不再取「我的报名」里的申请编号）
      () => submitDeliverable(jobId, deliverable, user),
      t('jobs.submitOk'),
      () => loadMyApps(),
      // R-9-88 ③ / R-9-94：仅当后端机读面 `details.reason` 命中下表 ⇒ 精确文案覆盖通用文案；
      //   非该 reason（拿不到 / 其它值）⇒ `run` 已写入的原链路文案**逐字不变**（onError 不改）。
      //   R-9-83：`batt` 闸（S2 起落点 = 提交）⇒ 命中电量门槛码时给可点击闭环提示。
      (error) => {
        const reason = error?.details?.reason
        setBattBlocked(reason === BATT_BELOW_ACCEPT_REASON)
        const reasonKey = SUBMIT_REASON_I18N_KEYS[reason]
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

              {/* R-9-83 闭环：提交被拒原因 = 电量不足 ⇒ 可点击提示直达签到区（标签复用既有文案键）。 */}
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

          {/* ★S3b ①：**无报名前置**（S2）⇒ 已登录 + 任务 open ⇒ **直出**提交表单
              （不再依赖「我的报名」条目是否存在；「先参与」面已随 J2 下架删除）。 */}
          {isAuthenticated && job && job.is_open !== false && (
            <form className="sf-jobs-panel" onSubmit={onSubmitWork} data-sf-m="jobs-submit-form">
              <h2 className="sf-jobs-title">{t('jobs.submit')}</h2>
              <p className="sf-jobs-meta">{t('jobs.submitNote')}</p>
              {/* ★S3b ①：提交目标 = 目标 **`job_id`**（S2 换轴）⇒ 只读展示路由/详情带的任务号，
                  **绝无**可编辑的手输框。 */}
              <p className="sf-jobs-meta" data-sf-m="jobs-submit-target">{`#${jobId}`}</p>
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
              {/* ★S3b ②：`jID` 语义 = **`submission_id`**（S2 换轴）⇒ 逐条列出本人提交；同任务可多条。 */}
              <div className="sf-jobs-item-title">#{item.jID}</div>
              {/* P7-E 小尾巴批-β · R-7E-4（裁定：本仓禁死代码）：原 `{item.job_status || item.status || '—'}`
                  为**死分支** —— `item` 来自 `fetchMyApplications`（`GET /api/task-progress`）⇒ 后端
                  `listTaskProgressByUser`（`backend-ts/src/database.ts:2604`）SELECT 列集**不含** `status`/`job_status`，
                  行映射 `normalizeTaskProgress`（`:652`）输出键集亦无此二者 ⇒ **两字段恒 `undefined`**
                  （`job_application.status` 虽在库（`0014_job_flow.sql:93`）但**不随本读口回包**；要展示须改后端读口，本单禁改）。
                  处置：删除死分支，保留**产品口径的空态占位** `—`（常量，不再引用任何不存在的字段）。 */}
              <div className="sf-jobs-meta">{'—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JobDetailPage
