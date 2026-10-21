import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { fetchCampaignCurrencies, fetchCampaignTask } from './campaign-api'
import { statusKeyOf, taskRewardOf, timeWindowOf, typeKeyOf } from './campaign-util'
import SubtaskForm from './SubtaskForm'
import NotFoundPage from '../NotFoundPage'
import './campaign.css'

// ============================================================================
// `/task/:taskId` · **campaign 任务页**（Kevin 2026-10-21 需求①）
// ----------------------------------------------------------------------------
// 口径（与后端并行单逐条对齐）：
//   · 路由归属：`/task/<id>` = **campaign task**（活动任务）。`/task`（列表 = campaign 任务列表）
//     与 `/task/review` 不动（react-router v6 静态段排名优先于动态段 ⇒ 三者互不吞）；
//     ★ 2026-10-21 Kevin 裁定 job 体系弃用 ⇒ `/bounty/<jobId>`（悬赏详情）与 `/task/new`（发布）已移除，
//     本页对**非数字号**直接判 404（`/task/new` 落 `:taskId` 时不再向后端要一个不存在的任务）。
//   · 读口 = `GET /api/campaign/task/:taskId`（公开；30s 缓存）。行形状：
//       { task_id, title, description, status, time_start, time_end,
//         reward_amount_primary, reward_cid_secondary, reward_amount_secondary,
//         joined_count, joined_target?, campaign{id,title,status},
//         project{id,title,slug,avatar_url,status}, subtasks[] }
//   · **可见性**：draft 任务对匿名 / 非 owner 一律服务端 `404`（owner / admin 可见）。
//     前端不另造判据——读口 404 ⇒ 落 `<NotFoundPage />`；另加一条**匿名 + draft 就地兜底**
//     （服务端若把 draft 行透给匿名，页面仍按 404 呈现，不泄露草稿）。
//   · **公开读**：不包 `ProtectedRoute`、未登录不拦截阅读；子任务清单里就地挂载参与面板
//     （`SubtaskForm`：prediction 固定 Yes/No、quiz 四选项多选 + 提交），未登录点提交只提示登录（零请求）；
//     底部仍保留【去参与】CTA 回活动页。
//   · 文案键**全部复用既有键**（`campaign.*` / `jobs.*` / `common.*`）+ 2026-10-22 的 quiz/Yes-No 新键：
//     状态徽标 `campaign.statusActive|statusEnded|statusDraft`、时间窗 `campaign.timeWindow*`、
//     奖励 `campaign.rewardCompletion|rewardSecondary`、参与数 `jobs.participantsHeadcount|participants`、
//     子任务 `campaign.requiredTag|optionalTag` + `campaign.type.<code>`、CTA `common.joinNow`。
//   · 类名自成一套 `sf-task-*`（不借 `sf-campaign-task*` 的任务卡类，也不借 `sf-item*`）；
//     颜色一律主题 token、几何取结构常量（同 campaign.css 纪律）。
// ============================================================================

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const CampaignTaskPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const params = useParams()
  const { isAuthenticated, user } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const taskId = String(params?.taskId ?? '').trim()

  const [state, setState] = useState({ phase: 'loading', view: null })
  const [symbols, setSymbols] = useState({})

  const userRef = useRef(user)
  userRef.current = user
  const reqSeq = useRef(0)

  const load = useCallback(async () => {
    // ★ 数字号闸（Kevin 2026-10-21 · job 弃用）：task_id 在库内恒为 bigint ⇒ 文本形态必为纯数字。
    //   非数字号（典型：已下线的 `/task/new`、手编 `/task/abc`）在本页**直接** 404，不发请求 ——
    //   否则 `/task/new` 会被 `task/:taskId` 动态段吃掉并向后端要一个不存在的任务。
    if (!taskId || !/^\d+$/.test(taskId)) {
      setState({ phase: 'notfound', view: null })
      return
    }
    const seq = reqSeq.current + 1
    reqSeq.current = seq
    setState((prev) => ({ ...prev, phase: 'loading' }))
    try {
      const view = await fetchCampaignTask(taskId, userRef.current)
      if (reqSeq.current !== seq) return
      if (!view || typeof view !== 'object') {
        setState({ phase: 'notfound', view: null })
        return
      }
      setState({ phase: 'ready', view })
    } catch (error) {
      if (reqSeq.current !== seq) return
      // 404 = 不存在 / 已下线 / draft 且无权（服务端可见性闸）⇒ 一律提示页
      setState({ phase: error?.status === 404 ? 'notfound' : 'error', view: null })
    }
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  // 次币符号（公开币种表；失败 ⇒ 空表 ⇒ 次币行整行不渲染，不阻断页面）
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
  // draft 只对 owner / admin 可见（服务端判）。匿名拿到 draft 行 ⇒ 按 404 呈现（防御性兜底）。
  if (status === 'draft' && !isAuthenticated) {
    return <NotFoundPage />
  }
  if (state.phase === 'notfound') {
    return <NotFoundPage />
  }

  const project = view?.project && typeof view.project === 'object' ? view.project : null
  const campaign = view?.campaign && typeof view.campaign === 'object' ? view.campaign : null
  const projectSlug = String(project?.slug || '').trim()
  const campaignRef = campaign?.id != null && campaign?.id !== '' ? String(campaign.id) : ''
  const campaignPath = campaignRef ? buildLocalizedPath(lang, `/campaign/${encodeURIComponent(campaignRef)}`) : ''

  const statusKey = statusKeyOf(status)
  const statusClass = status === 'ended' ? 'is-ended' : status === 'draft' ? 'is-draft' : 'is-active'
  const window = view ? timeWindowOf(view, lang) : null
  const reward = taskRewardOf(view)
  const secondarySymbol = reward.secondaryCid ? (symbols[reward.secondaryCid] || '') : ''
  const hasTarget = view?.joined_target !== null && view?.joined_target !== undefined && view?.joined_target !== ''
  const joinedCount = num(view?.joined_count)
  const subtasks = Array.isArray(view?.subtasks) ? view.subtasks : []
  const projectInitial = project?.title ? String(project.title).slice(0, 1).toUpperCase() : '?'

  return (
    <div className="sf-layout sf-task-page" data-sf-m="task-page" data-sf-task={taskId}>
      <div className="sf-layout-main">
        {state.phase === 'loading' ? (
          <p className="sf-foot-note" data-sf-m="task-loading">{t('campaign.loading')}</p>
        ) : state.phase === 'error' ? (
          <div className="sf-panel" data-sf-m="task-error" role="alert">
            <p>{t('campaign.loadFailed')}</p>
            <button type="button" className="sf-task-btn" data-sf-m="task-retry" onClick={load}>
              {t('campaign.retry')}
            </button>
          </div>
        ) : (
          <>
            {/* 项目头：圆形 avatar + 项目名（→ `/​<slug>`）+ 活动名（→ `/campaign/:id`） */}
            <div className="sf-task-project" data-sf-m="task-project">
              <span className="sf-task-avatar" data-sf-m="task-project-avatar" aria-hidden="true">
                {project?.avatar_url
                  ? <img className="sf-task-avatar-img" src={project.avatar_url} alt="" loading="lazy" />
                  : <span className="sf-task-avatar-initial">{projectInitial}</span>}
              </span>
              <span className="sf-task-project-names">
                {projectSlug && project?.title ? (
                  <Link
                    className="sf-task-project-name"
                    data-sf-m="task-project-name"
                    to={buildLocalizedPath(lang, `/${encodeURIComponent(projectSlug)}`)}
                  >{project.title}</Link>
                ) : (
                  <span className="sf-task-project-name" data-sf-m="task-project-name">{project?.title || ''}</span>
                )}
                {campaign?.title ? (
                  campaignPath ? (
                    <Link className="sf-task-campaign-name" data-sf-m="task-campaign" to={campaignPath}>
                      {campaign.title}
                    </Link>
                  ) : (
                    <span className="sf-task-campaign-name" data-sf-m="task-campaign">{campaign.title}</span>
                  )
                ) : null}
              </span>
            </div>

            <section className="sf-panel sf-task-head" data-sf-m="task-head">
              <div className="sf-task-head-row">
                <h1 className="sf-task-title" data-sf-m="task-title">{view?.title || ''}</h1>
                {statusKey ? (
                  <span
                    className={`sf-task-tag ${statusClass}`}
                    data-sf-m="task-status"
                    data-sf-state={status}
                  >{t(statusKey)}</span>
                ) : null}
              </div>

              <div className="sf-task-meta">
                {window ? (
                  <span data-sf-m="task-time">{t(window.key, window.values)}</span>
                ) : null}
                <span data-sf-m="task-joined">
                  {hasTarget
                    ? t('jobs.participantsHeadcount', { done: joinedCount, limit: num(view?.joined_target) })
                    : t('jobs.participants', { count: joinedCount })}
                </span>
              </div>

              {reward.primary ? (
                <div className="sf-task-reward" data-sf-m="task-reward" data-sf-amount={reward.primary}>
                  {t('campaign.rewardCompletion', { amount: reward.primary })}
                  {reward.secondaryAmount && secondarySymbol ? (
                    <span className="sf-task-reward-extra" data-sf-m="task-reward-secondary">
                      {t('campaign.rewardSecondary', { amount: reward.secondaryAmount, symbol: secondarySymbol })}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {view?.description ? (
                <p className="sf-task-desc" data-sf-m="task-desc">{view.description}</p>
              ) : null}
            </section>

            {/* 子任务清单：类型徽标 + 必做标记 + 内容（层级不拍平） */}
            {subtasks.length ? (
              <section className="sf-panel sf-task-subtasks-panel" data-sf-m="task-subtasks-panel">
                {subtasks.map((subtask) => {
                  const typeKey = typeKeyOf(subtask?.type_code)
                  const badge = typeKey ? t(typeKey) : (subtask?.type_label || '')
                  const required = subtask?.required === true
                  return (
                    <article
                      className="sf-task-subtask"
                      data-sf-m="task-subtask"
                      data-sf-subtask={String(subtask?.subtask_id ?? '')}
                      data-sf-type={String(subtask?.type_code ?? '')}
                      key={String(subtask?.subtask_id ?? '')}
                    >
                      <div className="sf-task-subtask-head">
                        {badge ? (
                          <span className="sf-task-type-badge" data-sf-m="task-subtask-type">{badge}</span>
                        ) : null}
                        <span className="sf-task-subtask-title" data-sf-m="task-subtask-title">{subtask?.title || ''}</span>
                        <span
                          className={`sf-task-req ${required ? 'is-required' : 'is-optional'}`}
                          data-sf-m="task-subtask-required"
                          data-sf-required={required ? '1' : '0'}
                        >{t(required ? 'campaign.requiredTag' : 'campaign.optionalTag')}</span>
                      </div>
                      {subtask?.content ? (
                        <p className="sf-task-subtask-content" data-sf-m="task-subtask-content">{subtask.content}</p>
                      ) : null}
                      {/* 参与面就地挂载（Kevin 2026-10-22）：prediction = Yes/No 两枚按钮、quiz = 四选项多选 + 提交；
                          写口与活动页同一组件（`SubtaskForm`），未登录只提示登录、零请求。 */}
                      <SubtaskForm
                        subtask={subtask}
                        t={t}
                        lang={lang}
                        user={user}
                        isAuthenticated={isAuthenticated}
                        onRefresh={load}
                      />
                    </article>
                  )
                })}
              </section>
            ) : (
              <p className="sf-foot-note" data-sf-m="task-subtasks-empty">{t('project.subtasksEmpty')}</p>
            )}

            {/* 底部 CTA：主按钮回活动页【去参与】（写面在活动页子任务面板；本页只读） */}
            {campaignPath ? (
              <div className="sf-task-actions" data-sf-m="task-actions">
                <Link className="sf-task-btn is-primary" data-sf-m="task-cta" to={campaignPath}>
                  {t('common.joinNow')}
                </Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default CampaignTaskPage
