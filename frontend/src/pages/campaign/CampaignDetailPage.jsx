import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { fetchCampaignCurrencies, fetchCampaignDetail } from './campaign-api'
import { statusKeyOf, taskRewardOf, timeWindowOf } from './campaign-util'
import SubtaskItem from './SubtaskItem'
import './campaign.css'

// ============================================================================
// `/campaign/:ref` · 活动详情（**两级结构写死**：活动头 → 任务卡 → 子任务清单）
// ----------------------------------------------------------------------------
// design §26.19.1：#70 禁把 task→subtask 拍平成单级列表。本页 DOM 层级即：
//   campaign-detail-head（活动）
//     └ campaign-task（任务，含完成奖 $N + 可选次币）
//         └ campaign-subtask（子任务：类型徽标 / 标题 / required / 状态）
//
// 口径：
//   · `:ref` 原样透传给读口（数字主键或雪花号两形态都由服务端判；非数字 ⇒ 服务端 404）；
//   · 时间窗 start/end 任一在场即渲染、无则整行不渲染（#72，禁 ISO 直出）；
//   · 任务完成奖主奖励恒 `$`（读口是数字串），次币金额需借公开币种表映射成符号；币种表失败
//     ⇒ 退化为只显示金额、不阻断页面（同 WagePage 体例）。
//   · 404 / 拉取失败分开呈现：前者 = 「活动不存在或已下线」，后者 = 可重试错误块。
// ============================================================================

const TaskCard = ({ task, t, lang, symbols, user, isAuthenticated, onRefresh }) => {
  const window = timeWindowOf(task, lang)
  const reward = taskRewardOf(task)
  const secondarySymbol = reward.secondaryCid ? (symbols[reward.secondaryCid] || '') : ''
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []

  return (
    <article className="sf-panel sf-campaign-task" data-sf-m="campaign-task" data-sf-task={String(task?.task_id ?? '')}>
      <div className="sf-campaign-task-head">
        <h2 className="sf-campaign-task-title" data-sf-m="campaign-task-title">{task?.title || ''}</h2>
        {reward.primary ? (
          <span className="sf-campaign-task-reward" data-sf-m="campaign-task-reward" data-sf-amount={reward.primary}>
            {t('campaign.rewardCompletion', { amount: reward.primary })}
            {reward.secondaryAmount && secondarySymbol ? (
              <span className="sf-campaign-task-reward-extra" data-sf-m="campaign-task-reward-extra">
                {t('campaign.rewardSecondary', { amount: reward.secondaryAmount, symbol: secondarySymbol })}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {task?.description ? (
        <p className="sf-campaign-task-desc" data-sf-m="campaign-task-desc">{task.description}</p>
      ) : null}

      {window ? (
        <div className="sf-campaign-task-meta">
          <span data-sf-m="campaign-task-time">{t(window.key, window.values)}</span>
        </div>
      ) : null}

      {subtasks.length ? (
        <ul className="sf-campaign-subtasks" data-sf-m="campaign-subtasks">
          {subtasks.map((subtask) => (
            <SubtaskItem
              subtask={subtask}
              t={t}
              lang={lang}
              user={user}
              isAuthenticated={isAuthenticated}
              onRefresh={onRefresh}
              key={String(subtask?.subtask_id ?? '')}
            />
          ))}
        </ul>
      ) : null}
    </article>
  )
}

const CampaignDetailPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const params = useParams()
  const { user, isAuthenticated } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const ref = String(params?.ref ?? '')

  const [state, setState] = useState({ phase: 'loading', view: null })
  const [symbols, setSymbols] = useState({})

  const userRef = useRef(user)
  userRef.current = user
  const reqSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = reqSeq.current + 1
    reqSeq.current = seq
    setState((prev) => ({ ...prev, phase: 'loading' }))
    try {
      const view = await fetchCampaignDetail(ref, userRef.current)
      if (reqSeq.current !== seq) return
      if (!view || typeof view !== 'object') {
        setState({ phase: 'notfound', view: null })
        return
      }
      setState({ phase: 'ready', view })
    } catch (error) {
      if (reqSeq.current !== seq) return
      setState({ phase: error?.status === 404 ? 'notfound' : 'error', view: null })
    }
  }, [ref])

  useEffect(() => {
    load()
  }, [load])

  /**
   * 提交成功后的**静默复读**（步 3）：只为拿服务端 `my_proof` / `my_outcome`。
   * · 不切 `phase`（不闪 loading、不清页面）；失败保持原视图（提交本身已成功，提示已给）；
   * · 仍受 `reqSeq` 守卫：与 `load()` 并发时以最后发出者为准，避免旧响应盖新数据。
   */
  const refresh = useCallback(async () => {
    const seq = reqSeq.current + 1
    reqSeq.current = seq
    try {
      const view = await fetchCampaignDetail(ref, userRef.current)
      if (reqSeq.current !== seq) return
      if (view && typeof view === 'object') setState({ phase: 'ready', view })
    } catch (error) {
      // 静默：复读失败不改判已成功的提交
    }
  }, [ref])

  // 次币符号（公开读面）：失败 ⇒ 空表，卡面退化为只显示金额。
  useEffect(() => {
    let cancelled = false
    fetchCampaignCurrencies(userRef.current)
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload) ? payload : (payload?.rows || [])
        const map = {}
        for (const row of Array.isArray(rows) ? rows : []) {
          if (row?.cid != null && row?.symbol) map[String(row.cid)] = String(row.symbol)
        }
        setSymbols(map)
      })
      .catch(() => { if (!cancelled) setSymbols({}) })
    return () => { cancelled = true }
  }, [])

  const view = state.view
  const status = String(view?.status || '')
  const statusKey = statusKeyOf(status)
  const window = view ? timeWindowOf(view, lang) : null
  const tasks = Array.isArray(view?.tasks) ? view.tasks : []

  return (
    <div className="sf-layout sf-campaign-detail" data-sf-m="campaign-detail">
      <div className="sf-layout-main">
        <Link className="sf-campaign-back" data-sf-m="campaign-back" to={buildLocalizedPath(lang, '/campaign')}>
          {t('campaign.backToList')}
        </Link>

        {state.phase === 'loading' ? (
          <p className="sf-foot-note" data-sf-m="campaign-detail-loading">{t('campaign.loading')}</p>
        ) : state.phase === 'notfound' ? (
          <div className="sf-panel" data-sf-m="campaign-detail-notfound" role="alert">
            <p>{t('campaign.notFound')}</p>
          </div>
        ) : state.phase === 'error' ? (
          <div className="sf-panel" data-sf-m="campaign-detail-error" role="alert">
            <p>{t('campaign.loadFailed')}</p>
            <button type="button" className="sf-campaign-btn" data-sf-m="campaign-detail-retry" onClick={load}>
              {t('campaign.retry')}
            </button>
          </div>
        ) : (
          <>
            <section className="sf-panel sf-campaign-detail-head" data-sf-m="campaign-detail-head">
              <div className="sf-campaign-detail-head-row">
                <h1 className="sf-campaign-detail-title" data-sf-m="campaign-detail-title">{view?.title || ''}</h1>
                {statusKey ? (
                  <span
                    className={`sf-campaign-tag ${status === 'ended' ? 'is-ended' : status === 'draft' ? 'is-draft' : 'is-active'}`}
                    data-sf-m="campaign-detail-status"
                    data-sf-state={status}
                  >{t(statusKey)}</span>
                ) : null}
              </div>

              {window ? (
                <p className="sf-campaign-detail-meta" data-sf-m="campaign-detail-time">
                  {t(window.key, window.values)}
                </p>
              ) : null}

              {view?.description ? (
                <p className="sf-campaign-detail-desc" data-sf-m="campaign-detail-desc">{view.description}</p>
              ) : null}
            </section>

            {tasks.length ? (
              <div className="sf-campaign-tasks" data-sf-m="campaign-tasks">
                {tasks.map((task) => (
                  <TaskCard
                    task={task}
                    t={t}
                    lang={lang}
                    symbols={symbols}
                    user={user}
                    isAuthenticated={isAuthenticated}
                    onRefresh={refresh}
                    key={String(task?.task_id ?? '')}
                  />
                ))}
              </div>
            ) : (
              <p className="sf-foot-note" data-sf-m="campaign-detail-empty">{t('campaign.tasksEmpty')}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CampaignDetailPage
