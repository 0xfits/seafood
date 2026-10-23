import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { fetchCampaignCurrencies, fetchCampaignDetail } from './campaign-api'
import { pendingRewardsOf, refOf, statusKeyOf, taskRewardOf, timeWindowOf } from './campaign-util'
import ClaimButton from './ClaimButton'
import { fetchProjectDetail } from '../project/project-api'
import { isWageProjectEditAdmin, loadListingEditAdmin } from '../item/item-edit-access'
import ProjectForms from '../project/ProjectForms'
import SubtaskItem from './SubtaskItem'
import TaskStatusToggle from './task-manage/TaskStatusToggle'
import './campaign.css'
import '../project/project.css'

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
//
// ★ 操作主场（Kevin 2026-10-22 · 自项目页 `/:slug` 迁入；项目页只剩概况层）：
//   · 闸 = **owner ∨ `manage_tasks` 管理员，且项目未 ended**（与项目页旧闸逐字同式）——
//     归属链 = 活动读口 `project_id` → `GET /api/project/:ref`（**既有公开读口复用，零新端点**），
//     拿 `owner_uid` / `status` / `slug` / `avatar_url`；项目读口失败 ⇒ 安全降级只读（不猜权限）；
//   · 项目归属行（头像 + 项目名 → `/<slug>`）：活动头下方，所有人可见（只读导航）；
//   · 任务卡（canManage）：`task_status` 徽标 + 卡头【上线/下线】（draft⇄active，ended 封板，
//     `task-manage/TaskStatusToggle`）+ 卡内【发布子任务】（就地开 `ProjectForms` panel="subtask"，
//     活动 + 任务双锁）；子任务行【编辑】【删除】（行内确认，`task-manage/SubtaskManage`，
//     prediction 发布后锁同旧契约）；卡内表单全部复用 `pages/project/ProjectForms`（**同一份
//     组件、同一批载荷构造器，不复制两份逻辑** —— `project-form-*` 钩子名随组件原样保留）；
//   · 操作区【发布任务】：campaign 已锁定（`ProjectForms` panel="task" + `campaignLock`）；
//   · 写口成功 ⇒ 页内结论 + **静默重读**活动详情（行集以读口为准）；失败就地内联（同旧）；
//   · 非管理者 / 未登录 ⇒ 只读视图（与迁入前完全同形，零操作元素）。
// ============================================================================

const TaskCard = ({
  task,
  t,
  lang,
  symbols,
  user,
  isAuthenticated,
  onRefresh,
  canManage = false,
  campaign = null,
  project = null,
  currencies = [],
  subtaskOpen = false,
  onToggleSubtask,
  onCloseSubtask,
  onManaged,
  onStatusChanged,
}) => {
  const window = timeWindowOf(task, lang)
  const reward = taskRewardOf(task)
  const secondarySymbol = reward.secondaryCid ? (symbols[reward.secondaryCid] || '') : ''
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
  const status = String(task?.status || '')
  const statusKey = statusKeyOf(status)

  return (
    <article className="sf-panel sf-campaign-task" data-sf-m="campaign-task" data-sf-task={String(task?.task_id ?? '')}>
      <div className="sf-campaign-task-head">
        <h2 className="sf-campaign-task-title" data-sf-m="campaign-task-title">{task?.title || ''}</h2>
        <div className="sf-campaign-task-head-right">
          {statusKey ? (
            <span
              className={`sf-campaign-tag ${status === 'ended' ? 'is-ended' : status === 'draft' ? 'is-draft' : 'is-active'}`}
              data-sf-m="campaign-task-status"
              data-sf-state={status}
            >{t(statusKey)}</span>
          ) : null}
          {canManage ? (
            <TaskStatusToggle task={task} t={t} user={user} onChanged={onStatusChanged} />
          ) : null}
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
          {canManage ? (
            <button
              type="button"
              className="sf-campaign-btn"
              data-sf-m="campaign-task-entry-subtask"
              data-sf-task={String(task?.task_id ?? '')}
              aria-expanded={subtaskOpen}
              onClick={() => onToggleSubtask?.(task)}
            >{t('project.entrySubtask')}</button>
          ) : null}
        </div>
      </div>

      {task?.description ? (
        <p className="sf-campaign-task-desc" data-sf-m="campaign-task-desc">{task.description}</p>
      ) : null}

      {window ? (
        <div className="sf-campaign-task-meta">
          <span data-sf-m="campaign-task-time">{t(window.key, window.values)}</span>
        </div>
      ) : null}

      {canManage && subtaskOpen ? (
        <div className="sf-campaign-card-form" data-sf-m="campaign-card-form">
          <ProjectForms
            panel="subtask"
            slug={project?.slug || project?.id || ''}
            campaignLock={campaign}
            taskLock={task}
            t={t}
            /* 关闭 = 只收面板（成功结论是页面层状态，不得被 onClose 抹掉——
               旧实现复用 toggle 处理器会把 setNotice(null)，③ 系结论被吞）。 */
            onClose={() => onCloseSubtask?.(task)}
            onDone={onManaged}
          />
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
              canManage={canManage}
              manageCtx={canManage ? {
                task,
                campaign,
                slug: project?.slug || project?.id || '',
                onManaged,
              } : null}
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
  const [currencies, setCurrencies] = useState([])
  // 归属项目（既有公开读口 `GET /api/project/:ref` 复用）：项目归属行 + owner 闸的数据面。
  // 拉取失败 ⇒ null ⇒ 安全降级只读（绝不本地猜权限）。
  const [project, setProject] = useState(null)
  const [adminFlags, setAdminFlags] = useState(null)
  // 操作面板：'task'（操作区【发布任务】）| 子任务表单开在 task_id 对应的卡内（互斥，一次一个）。
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [subtaskOpenTaskId, setSubtaskOpenTaskId] = useState('')
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text }

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
        setProject(null)
        setState({ phase: 'notfound', view: null })
        return
      }
      // 归属项目简读**并入 load 同批提交**（Kevin 2026-10-22）：首帧渲染任务卡时闸已定，
      // 杜绝「先只读、项目读口晚到再闪出操作钮」的竞态。读口失败 ⇒ project=null ⇒
      // 安全降级只读（绝不本地猜权限），且不阻断页面（只读面照常渲染）。
      const projectId = view.project_id != null ? String(view.project_id) : ''
      let projectRow = null
      if (projectId) {
        try {
          const row = await fetchProjectDetail(projectId, userRef.current)
          projectRow = row && typeof row === 'object' ? row : null
        } catch (error) {
          projectRow = null
        }
      }
      if (reqSeq.current !== seq) return
      setProject(projectRow)
      setState({ phase: 'ready', view })
    } catch (error) {
      if (reqSeq.current !== seq) return
      setState({ phase: error?.status === 404 ? 'notfound' : 'error', view: null })
    }
  }, [ref])

  useEffect(() => {
    load()
  }, [load])

  // 归属项目简读已并入 load()（同批提交、首帧定闸）；静默重读不换 project_id ⇒ 不重拉。

  // 管理员三键（`/api/user`）：逐字复用 item-edit-access 加载器（同项目页体例）。
  useEffect(() => {
    let alive = true
    if (!isAuthenticated) {
      setAdminFlags(null)
      return undefined
    }
    loadListingEditAdmin(userRef.current)
      .then((flags) => { if (alive) setAdminFlags(flags) })
      .catch(() => { if (alive) setAdminFlags(null) })
    return () => { alive = false }
  }, [isAuthenticated])

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

  // 次币符号（公开读面）：失败 ⇒ 空表，卡面退化为只显示金额。行集同时喂【发布任务】表单的次币下拉。
  useEffect(() => {
    let cancelled = false
    fetchCampaignCurrencies(userRef.current)
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload) ? payload : (payload?.rows || [])
        const list = Array.isArray(rows) ? rows : []
        const map = {}
        for (const row of list) {
          if (row?.cid != null && row?.symbol) map[String(row.cid)] = String(row.symbol)
        }
        setSymbols(map)
        setCurrencies(list)
      })
      .catch(() => { if (!cancelled) { setSymbols({}); setCurrencies([]) } })
    return () => { cancelled = true }
  }, [])

  /** 管理写口成功（发布任务 / 发布子任务 / 编辑 / 删除 / 上下线）：页内结论 + 静默重读。 */
  const handleManaged = (result) => {
    setNotice(result || null)
    refresh()
  }

  /** 上线 / 下线成功（开关组件已发 PATCH）：结论 + 静默重读（徽标以读口为准）。 */
  const handleStatusChanged = (next) => {
    setNotice({ kind: 'ok', text: t(next === 'active' ? 'project.okLaunched' : 'project.okDraft') })
    refresh()
  }

  const view = state.view
  const status = String(view?.status || '')
  const statusKey = statusKeyOf(status)
  const window = view ? timeWindowOf(view, lang) : null
  const tasks = Array.isArray(view?.tasks) ? view.tasks : []
  // 活动级待领取池（读口加性 `pending_rewards`）：有行才出【一键领取】⇒ 匿名 / 无可领一律零按钮。
  // ★ 一次点击共扣 1 电量 ⇒ 只发一个请求（组件内部单项循环在本仓是硬禁）。
  const pending = pendingRewardsOf(view)

  // 管理闸（与项目页旧闸逐字同式）：owner ∨ `manage_tasks` 管理员，且项目未 ended。
  const uid = user?.uID ?? user?.uid
  const isOwner = Boolean(
    isAuthenticated && uid != null && uid !== '' && project && String(project.owner_uid ?? '') === String(uid)
  )
  const isAdmin = isWageProjectEditAdmin(adminFlags)
  const canManage = Boolean(view && project && String(project.status || '') !== 'ended' && (isOwner || isAdmin))

  const projectRef = project?.slug || project?.id || ''
  const toggleSubtask = (task) => {
    const id = String(task?.task_id ?? '')
    if (!id) return
    setNotice(null)
    setTaskFormOpen(false)
    setSubtaskOpenTaskId((prev) => (prev === id ? '' : id))
  }

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

              {/* 项目归属行（头像 + 项目名 → `/<slug>`）：所有人可见的只读导航；读不到归属 ⇒ 整行不渲染 */}
              {project && projectRef ? (
                <Link
                  className="sf-campaign-project-row"
                  data-sf-m="campaign-project-row"
                  to={buildLocalizedPath(lang, `/${encodeURIComponent(projectRef)}`)}
                >
                  {project.avatar_url ? (
                    <img
                      className="sf-campaign-project-avatar"
                      data-sf-m="campaign-project-avatar"
                      src={project.avatar_url}
                      alt=""
                    />
                  ) : (
                    <span className="sf-campaign-project-avatar is-fallback" data-sf-m="campaign-project-avatar" aria-hidden="true">
                      {(project.title || '?').slice(0, 1)}
                    </span>
                  )}
                  <span className="sf-campaign-project-title" data-sf-m="campaign-project-title">{project.title || ''}</span>
                </Link>
              ) : null}

              {/* 活动级【一键领取】（`POST /api/campaign/:campaignId/claim` · **一次点击共扣 1 电量**）。
                  只在读口 `pending_rewards.items` 非空且已登录时出现；成功/失败一律内联，成功后静默复读。 */}
              {pending.items.length ? (
                <div
                  className="sf-campaign-claim-bar"
                  data-sf-m="campaign-claim-bar"
                  data-sf-count={pending.items.length}
                  data-sf-ref={String(refOf(view) || ref)}
                >
                  <span className="sf-campaign-cost-hint" data-sf-m="campaign-claim-cost">
                    {t('campaign.claim.allCost')}
                  </span>
                  <ClaimButton
                    variant="campaign"
                    refId={refOf(view) || ref}
                    t={t}
                    user={user}
                    isAuthenticated={isAuthenticated}
                    onClaimed={refresh}
                    m="campaign-claim-all"
                  />
                </div>
              ) : null}
            </section>

            {tasks.length ? (
              <div className="sf-campaign-tasks" data-sf-m="campaign-tasks">
                {tasks.map((task) => {
                  const taskRef = String(task?.task_id ?? '')
                  return (
                    <TaskCard
                      task={task}
                      t={t}
                      lang={lang}
                      symbols={symbols}
                      user={user}
                      isAuthenticated={isAuthenticated}
                      onRefresh={refresh}
                      canManage={canManage}
                      campaign={view}
                      project={project}
                      currencies={currencies}
                      subtaskOpen={canManage && subtaskOpenTaskId === taskRef}
                      onToggleSubtask={toggleSubtask}
                      onCloseSubtask={() => setSubtaskOpenTaskId('')}
                      onManaged={handleManaged}
                      onStatusChanged={handleStatusChanged}
                      key={taskRef}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="sf-foot-note" data-sf-m="campaign-detail-empty">{t('campaign.tasksEmpty')}</p>
            )}

            {/* 操作区（canManage）：【发布任务】——campaign 已锁定（本页活动），无活动选择器 */}
            {canManage ? (
              <section className="sf-panel sf-campaign-manage" data-sf-m="campaign-manage">
                <h2 className="sf-campaign-manage-title" data-sf-m="campaign-manage-title">{t('project.manageTitle')}</h2>
                <div className="sf-campaign-panel-actions">
                  <button
                    type="button"
                    className="sf-campaign-btn is-primary"
                    data-sf-m="campaign-entry-task"
                    aria-expanded={taskFormOpen}
                    onClick={() => {
                      setNotice(null)
                      setSubtaskOpenTaskId('')
                      setTaskFormOpen((prev) => !prev)
                    }}
                  >{t('project.entryTask')}</button>
                </div>
                {notice?.text && !taskFormOpen ? (
                  <p
                    className={`sf-project-notice is-${notice.kind || 'err'}`}
                    data-sf-m="campaign-manage-notice"
                    data-sf-kind={notice.kind || 'err'}
                    role="alert"
                  >
                    {notice.text}
                  </p>
                ) : null}
                {taskFormOpen ? (
                  <div className="sf-campaign-card-form" data-sf-m="campaign-card-form">
                    <ProjectForms
                      panel="task"
                      campaignLock={view}
                      currencies={currencies}
                      t={t}
                      onClose={() => setTaskFormOpen(false)}
                      onDone={handleManaged}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default CampaignDetailPage
