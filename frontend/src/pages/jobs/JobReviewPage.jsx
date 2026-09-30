import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { fetchPendingVerification, reviewSubmission } from './job-api'
import './jobs.css'

// 招工线 · 审核入口（§4.2 J5/J6 · 已注册路径）
//   · 队列读口 = GET /api/tasklist/pending-verification（**已注册** backend-ts/src/index.ts:1093；
//     权限 = `requireAdmin(review_tasks)` ⇒ 非管理员 `403 AUTH_FORBIDDEN`，走 R107 四语文案）
//   · 动作面 = POST /api/job/:jobId/review（**已注册** :1405；A5）
//       通过 ⇒ `approved:true`  = `job_post_event(op='settle')`（发放 + 手续费 + 返佣）
//       驳回 ⇒ `approved:false` = `job_post_event(op='refund')`（退托管，`to_status='rejected'`）
//   · **幂等键 = 服务端派生**（事件根键 `biz:job:settle:<job_id>`，`backend-ts/migrations/0013_job.sql:592`）⇒ 前端不传键。
//   · 队列项的 `jID` = `application_id`、`tID` = `job_id`（§4.4-16 路由入口语义）
const JobReviewPage = () => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [items, setItems] = useState([])
  const [state, setState] = useState({ phase: 'loading', message: '' })
  const [action, setAction] = useState({ phase: 'idle', message: '', id: null })

  const load = useCallback(async () => {
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
  }, [user, t])

  useEffect(() => { load() }, [load])

  const decide = async (item, approved) => {
    const key = String(item.tID ?? '')
    setAction({ phase: 'loading', message: t('jobs.submitting'), id: key })
    try {
      await reviewSubmission(key, approved, user)
      setAction({ phase: 'ok', message: approved ? t('jobs.approveOk') : t('jobs.rejectOk'), id: key })
      await load()
    } catch (error) {
      setAction({ phase: 'error', message: String(error?.message || t('error')), id: key })
    }
  }

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
              <Link className="sf-jobs-link" to="/task">{t('jobs.list')}</Link>
              <Link className="sf-jobs-link" to="/task/new">{t('jobs.publish')}</Link>
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
            return (
              <div className="sf-jobs-item" key={`${key}-${item.jID}`} data-sf-m="jobs-queue-item">
                <h2 className="sf-jobs-item-title">{t('jobs.itemTitle', { job: key, app: item.jID })}</h2>
                <p className="sf-jobs-meta">{item.info_input || '—'}</p>
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
