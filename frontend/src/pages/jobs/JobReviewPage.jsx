import React, { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, pickLocalized } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import { fetchPendingVerification, reviewSubmission } from './job-api'
import './jobs.css'

// 招工线 · 审核入口（§4.2 J5/J6 · 已注册路径）
//   · 队列读口 = GET /api/tasklist/pending-verification（**已注册** backend-ts/src/index.ts:1989；
//     ★ S16 准入放宽 = 「admin（持 `review_tasks`）∨ 已登录」：admin ⇒ 全局视图（**零回归**）；
//       普通发布者 ⇒ 只返回其 `job.employer_uid` 命中的 pending 提交（过滤真源 = 后端
//       `resolveReviewQueueScope`，list :1992 / count :1975 **两处同源**）；未登录 ⇒ 401。
//     ★ S17a（本单）：前端门随之放开为「**已登录即可**」；**不另写前端过滤**（后端为唯一真源）。
//   · 动作面 = POST /api/job/:jobId/review（**已注册** :2457；A5）body = `{ approved, submission_id }`
//       通过 ⇒ `approved:true`  + 提交号 = `settleJob({submissionIdRaw})` **逐笔发放**
//              （该提交转 `approved` + `job_payout`/`job_fee`/`commission` 同一语句（R4 原子））
//       驳回 ⇒ `approved:false` + 提交号 = **逐笔判不合格**（零资金、该提交转 `rejected`、任务保持 `open`）
//   · ★ 逐笔键 = **提交号**（`submission_id`）：缺省 ⇒ 后端落**遗留单笔分支**
//     （`index.ts:2464` / `job-funds-service.ts:234`）—— 在 0042 新模型下**必失败**
//     （`409 LEDGER_CURRENCY_INVALID_TRANSITION`）⇒ 本页**必须**逐笔带上提交号。
//   · **幂等键 = 服务端派生** ⇒ 前端不传键：
//       `biz:job:settle:<job_id>:<submission_id>`（`job-funds-service.ts:232`）；
//       缺提交号退化为 `biz:job:settle:<job_id>`（`migrations/0013_job.sql:592`）。
//   · 队列项字段（现取 `database.ts:4013-4014`）：`tID` = `job_id`（= 动作面 URL 的 `:jobId`）、
//     `jID` = `submission_id`（= body 的 `submission_id`）。★ 两者皆有 ⇒ 逐笔调用两值都取。
const JobReviewPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）
  const lang = getLanguageFromUrl(location.pathname)
  const [items, setItems] = useState([])
  const [state, setState] = useState({ phase: 'loading', message: '' })
  const [action, setAction] = useState({ phase: 'idle', message: '', id: null })
  // ★ S17a（本单）：S16 后端已把待审队列读口准入放宽为「admin ∨ 已登录」（非 admin 只返回其
  //   `job.employer_uid` 命中的 pending 提交）⇒ **前端门随之放开为「已登录即可」**（改前 = 持 `review_tasks`）。
  //   ★ 过滤唯一真源 = 后端 `resolveReviewQueueScope`（`backend-ts/src/index.ts`）⇒ **前端不另写
  //     「只看自己的」过滤**，只负责「已登录就发请求」（两处各写一套 = 漂移，禁止）。
  //   未登录 ⇒ 走下方 `!isAuthenticated` 早返回（渲染登录提示、**不发起队列读**）。
  const canReview = isAuthenticated

  const load = useCallback(async () => {
    // 未登录 ⇒ 不发起队列读（后端会 401；此处不从首屏触发）
    if (!canReview) return
    setState({ phase: 'loading', message: t('loading') })
    try {
      const data = await fetchPendingVerification(user)
      const list = Array.isArray(data) ? data : []
      setItems(list)
      setState({ phase: 'ok', message: list.length ? '' : t('jobs.queueEmpty') })
    } catch (error) {
      setItems([])
      setState({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }, [canReview, user, t])

  useEffect(() => { load() }, [load])

  const decide = async (item, approved) => {
    // ★ 逐笔：URL 的 `:jobId` 用任务号 `tID`；body 的 `submission_id` **必带**提交号 `jID`
    //   （缺 ⇒ 后端遗留单笔分支 ⇒ 0042 新模型下必 409，见文件头）。
    const jobId = String(item.tID ?? '')
    const submissionId = item.jID
    setAction({ phase: 'loading', message: t('jobs.submitting'), id: jobId })
    try {
      await reviewSubmission(jobId, approved, user, submissionId)
      setAction({ phase: 'ok', message: approved ? t('jobs.approveOk') : t('jobs.rejectOk'), id: jobId })
      await load()
    } catch (error) {
      setAction({ phase: 'error', message: String(error?.message || t('error')), id: jobId })
    }
  }

  // ★ S17a：未登录 ⇒ 登录提示（此分支早返回 ⇒ **不发起队列读**）；已登录 ⇒ 一律进队列面
  //   （准入/过滤的唯一真源在后端 `resolveReviewQueueScope`；前端不再按 admin 能力收敛为无权限空态）。
  if (!isAuthenticated) {
    return (
      <div className="sf-jobs" data-sf-m="jobs-hero">
        <div className="sf-jobs-empty">{t('pleaseLogin')}</div>
      </div>
    )
  }

  return (
    <div className="sf-layout" data-sf-m="jobs-layout">
      <div className="sf-layout-main">
        <div className="sf-jobs" data-sf-m="jobs-queue">
          <div className="sf-jobs-head" data-sf-m="jobs-hero">
            <h1 className="sf-jobs-title">{t('jobs.review')}</h1>
            <div className="sf-jobs-actions">
              <Link className="sf-jobs-link" to={buildLocalizedPath(lang, '/task')}>{t('jobs.list')}</Link>
              <Link className="sf-jobs-link" to={buildLocalizedPath(lang, '/task/new')}>{t('jobs.publish')}</Link>
              <button className="sf-btn sf-jobs-btn" type="button" data-sf-m="jobs-refresh" onClick={load}>{t('jobs.refresh')}</button>
            </div>
          </div>

          {state.phase === 'loading' && <div className="sf-jobs-status" data-sf-m="jobs-load">{state.message}</div>}
          {state.phase === 'error' && (
            <div className="sf-jobs-err sf-jobs-status" data-sf-m="jobs-load" role="alert">{state.message}</div>
          )}
          {state.phase === 'ok' && items.length === 0 && (
            <div className="sf-jobs-empty" data-sf-m="jobs-queue-empty">{t('jobs.queueEmpty')}</div>
          )}

          {items.map((item) => {
            const key = String(item.tID ?? '')
            const busy = action.phase === 'loading' && action.id === key
            // TR-2：`info_input` = **申请者提交的交付物文本**（用户录入内容）⇒ 取当前语言；空串/缺字段 ⇒ 回落原文
            const infoInput = pickLocalized(item, 'info_input', lang) || '—'
            return (
              <div className="sf-jobs-item" key={`${key}-${item.jID}`} data-sf-m="jobs-queue-item">
                <h2 className="sf-jobs-item-title">{t('jobs.itemTitle', { job: key, app: item.jID })}</h2>
                <p className="sf-jobs-meta">
                  {infoInput}
                  {/* 「翻译中」小标（ready/缺省 ⇒ null） */}
                  <TranslatingBadge status={contentStatus(item)} />
                </p>
                <div className="sf-jobs-row">
                  <button className="sf-btn sf-jobs-btn" type="button" data-sf-m="jobs-approve" disabled={busy} onClick={() => decide(item, true)}>
                    {t('jobs.approve')}
                  </button>
                  <button className="sf-btn sf-jobs-btn" type="button" data-sf-m="jobs-reject" disabled={busy} onClick={() => decide(item, false)}>
                    {t('jobs.reject')}
                  </button>
                  {action.id === key && action.message && (
                    <span
                      className={`sf-jobs-status${action.phase === 'error' ? ' sf-jobs-err' : ''}${action.phase === 'ok' ? ' sf-jobs-ok' : ''}`}
                      data-sf-m="jobs-action-status"
                      role="status"
                    >
                      {action.message}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sf-layout-side">
        <div className="sf-jobs-panel" data-sf-m="jobs-side">
          <h2 className="sf-jobs-title">{t('jobs.review')}</h2>
          <p className="sf-jobs-meta">{t('jobs.reviewNote')}</p>
        </div>
      </div>
    </div>
  )
}

export default JobReviewPage
