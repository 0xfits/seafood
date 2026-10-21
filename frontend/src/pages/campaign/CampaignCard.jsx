import React from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { listedTasksOf, refOf, statusKeyOf, taskRewardOf, timeWindowOf } from './campaign-util'

// ============================================================================
// 活动卡（`/campaign` 列表项 · **独立组件**）
// ----------------------------------------------------------------------------
// 硬口径（design §26.19.1 #73 / #75）：
//   · **不复用商品卡**（`sf-listings-card` / `sf-item*` 类名与组件一律不碰）—— 活动卡自成一套
//     `sf-campaign-*` 命名，避免样式与语义双向污染；
//   · 卡面五件：标题 / 简述首行 / 时间窗 / 状态徽标 / 包含任务数；`ended` 与 `active` 视觉可区分
//     （徽标文案 + `data-sf-state` + `is-ended` 修饰类，三处同时变，不靠颜色单打）；
//   · ★ 任务列（Kevin 2026-10-21 派单）：卡内列出该活动下**任务标题 + 奖励 + 状态**；
//     行集走唯一谓词 `listedTasksOf`（active 活动 ∧ active 任务）⇒ **与首页「热门任务」
//     同一谓词、同一批行**（首页取前 5 张卡，本页逐活动全列）；零任务 ⇒ 既有键
//     `campaign.tasksEmpty` 文案（零新增键）；
//   · 结构（**禁嵌套交互元素**）：卡根 = `<article>`；标题行与任务行各自是唯一链接，
//     卡内零按钮、零输入。链接目标走唯一构造器 `buildLocalizedPath`（禁字面路径硬写，
//     语言前缀由构造器承担）：标题 → `/campaign/:ref`，任务 → `/task/:taskId`。
// ============================================================================

const firstLineOf = (text) => {
  const raw = String(text || '')
  const line = raw.split('\n')[0].trim()
  return line || ''
}

const CampaignCard = ({ campaign, lang, t }) => {
  const ref = refOf(campaign)
  const status = String(campaign?.status || '')
  const statusKey = statusKeyOf(status)
  const window = timeWindowOf(campaign, lang)
  const tasks = listedTasksOf(campaign)
  const desc = firstLineOf(campaign?.description)
  const totalTasks = Array.isArray(campaign?.tasks) ? campaign.tasks.length : 0

  return (
    <article
      className={`sf-campaign-card sf-card${status === 'ended' ? ' is-ended' : ''}`}
      data-sf-m="campaign-card"
      data-sf-ref={ref}
      data-sf-state={status || 'unknown'}
    >
      <header className="sf-campaign-card-head">
        <Link
          className="sf-campaign-card-link"
          data-sf-m="campaign-card-link"
          to={buildLocalizedPath(lang, `/campaign/${encodeURIComponent(ref)}`)}
        >
          <h2 className="sf-campaign-card-title" data-sf-m="campaign-card-title">{campaign?.title || ''}</h2>
        </Link>
        {statusKey ? (
          <span
            className={`sf-campaign-tag ${status === 'ended' ? 'is-ended' : 'is-active'}`}
            data-sf-m="campaign-card-status"
            data-sf-state={status}
          >{t(statusKey)}</span>
        ) : null}
      </header>

      {desc ? (
        <p className="sf-campaign-card-desc" data-sf-m="campaign-card-desc">{desc}</p>
      ) : null}

      <div className="sf-campaign-card-meta">
        {window ? (
          <span className="sf-campaign-card-time" data-sf-m="campaign-card-time">
            {t(window.key, window.values)}
          </span>
        ) : null}
        <span className="sf-campaign-card-count" data-sf-m="campaign-card-tasks">
          {t('campaign.taskCount', { n: totalTasks })}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="sf-campaign-card-tasks-empty" data-sf-m="campaign-card-tasks-empty">
          {t('campaign.tasksEmpty')}
        </p>
      ) : (
        <ul className="sf-campaign-card-tasks" data-sf-m="campaign-card-task-list">
          {tasks.map((task, index) => {
            const taskId = task?.task_id ?? null
            const taskStatus = String(task?.status || '')
            const taskStatusKey = statusKeyOf(taskStatus)
            const reward = taskRewardOf(task)
            return (
              <li
                className="sf-campaign-card-task-item"
                data-sf-m="campaign-card-task-item"
                key={String(taskId ?? `task-${index}`)}
              >
                {taskId == null ? (
                  <span className="sf-campaign-card-task" data-sf-state={taskStatus || 'unknown'}>
                    <span className="sf-campaign-card-task-title" data-sf-m="campaign-card-task-title">
                      {task?.title || ''}
                    </span>
                  </span>
                ) : (
                  <Link
                    className="sf-campaign-card-task"
                    data-sf-m="campaign-card-task"
                    data-sf-task={String(taskId)}
                    data-sf-state={taskStatus || 'unknown'}
                    to={buildLocalizedPath(lang, `/task/${encodeURIComponent(String(taskId))}`)}
                  >
                    <span className="sf-campaign-card-task-title" data-sf-m="campaign-card-task-title">
                      {task?.title || ''}
                    </span>
                  </Link>
                )}
                <span className="sf-campaign-card-task-meta">
                  <span
                    className="sf-campaign-card-task-reward"
                    data-sf-m="campaign-card-task-reward"
                    data-sf-amount={reward.primary ?? ''}
                  >
                    <span className="sf-campaign-card-task-cur">$</span>
                    {reward.primary ?? '0'}
                  </span>
                  {taskStatusKey ? (
                    <span
                      className={`sf-campaign-card-task-status${taskStatus === 'ended' ? ' is-ended' : ''}`}
                      data-sf-m="campaign-card-task-status"
                      data-sf-state={taskStatus}
                    >{t(taskStatusKey)}</span>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

export default CampaignCard
