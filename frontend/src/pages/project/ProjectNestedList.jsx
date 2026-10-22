import React from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { refOf, statusKeyOf, taskRewardOf, timeWindowOf } from '../campaign/campaign-util'

// ============================================================================
// 项目页「活动与任务」区 · **概况层**（Kevin 2026-10-22 裁定：操作主场迁 `/campaign/:ref`）
// ----------------------------------------------------------------------------
// 形态：每条活动 = 活动名（可点 → `/campaign/:ref`）+ 状态徽标；其下只列**任务摘要行**
//   （标题 → `/task/:taskId`、状态徽标、完成奖 `$`，一行一条）。**不渲染**：
//   · 子任务清单（具体内容在活动页/任务页）；
//   · 【发布任务】【发布子任务】【上线/下线】【编辑】【删除】任何操作钮（全部迁活动页）；
//   · 表单与写口（本组件零请求、纯只读）。
// 口径：
//   · 时间窗仍走 `campaign-util.timeWindowOf`（禁 ISO 直出）——只用于活动卡 meta 行；
//   · 完成奖主奖励恒 `$`（`campaign.rewardCompletion`），次币金额在概况层不展开（活动页全量展示）；
//   · 任务摘要行链到 `/task/:taskId`（数字主键；无主键 ⇒ 只渲染纯文本，不链空页）；
//   · 空态保留：项目无活动 → `project.campaignsEmpty`；活动无任务 → `campaign.tasksEmpty`。
// ============================================================================

/** 任务摘要行：标题链 `/task/:taskId` + 状态徽标 + 完成奖 `$`（一行一条，零操作钮）。 */
const TaskSummaryRow = ({ task, t, lang }) => {
  const status = String(task?.status || '')
  const statusKey = statusKeyOf(status)
  const reward = taskRewardOf(task)
  const taskRef = String(task?.task_id ?? '')
  return (
    <li
      className="sf-project-task-row"
      data-sf-m="project-task-row"
      data-sf-task={taskRef}
      data-sf-state={status || 'unknown'}
    >
      {taskRef ? (
        <Link
          className="sf-project-task-row-title"
          data-sf-m="project-task-link"
          to={buildLocalizedPath(lang, `/task/${encodeURIComponent(taskRef)}`)}
        >{task?.title || ''}</Link>
      ) : (
        <span className="sf-project-task-row-title" data-sf-m="project-task-row-title">{task?.title || ''}</span>
      )}
      {statusKey ? (
        <span
          className={`sf-project-tag is-${status || 'unknown'}`}
          data-sf-m="project-task-row-status"
          data-sf-state={status}
        >{t(statusKey)}</span>
      ) : null}
      {reward.primary ? (
        <span className="sf-project-task-row-reward" data-sf-m="project-task-row-reward" data-sf-amount={reward.primary}>
          {t('campaign.rewardCompletion', { amount: reward.primary })}
        </span>
      ) : null}
    </li>
  )
}

const ProjectNestedList = ({ campaigns, t, lang }) => {
  const rows = Array.isArray(campaigns) ? campaigns : []
  if (!rows.length) {
    return (
      <section className="sf-project-campaigns" data-sf-m="project-campaigns">
        <h2 className="sf-project-section-title" data-sf-m="project-campaigns-title">{t('project.campaignsTitle')}</h2>
        <p className="sf-foot-note" data-sf-m="project-campaigns-empty">{t('project.campaignsEmpty')}</p>
      </section>
    )
  }

  return (
    <section className="sf-project-campaigns" data-sf-m="project-campaigns">
      <h2 className="sf-project-section-title" data-sf-m="project-campaigns-title">{t('project.campaignsTitle')}</h2>
      <ul className="sf-project-campaign-list" data-sf-m="project-campaign-list">
        {rows.map((campaign) => {
          const status = String(campaign?.status || '')
          const statusKey = statusKeyOf(status)
          const window = timeWindowOf(campaign, lang)
          const tasks = Array.isArray(campaign?.tasks) ? campaign.tasks : []
          const ref = refOf(campaign)
          return (
            <li
              className={`sf-project-campaign is-${status || 'unknown'}`}
              data-sf-m="project-campaign"
              data-sf-ref={ref}
              data-sf-state={status || 'unknown'}
              key={ref || campaign?.title}
            >
              <div className="sf-project-campaign-head">
                {ref ? (
                  <Link
                    className="sf-project-campaign-title"
                    data-sf-m="project-campaign-link"
                    to={buildLocalizedPath(lang, `/campaign/${encodeURIComponent(ref)}`)}
                  >{campaign?.title || ''}</Link>
                ) : (
                  <span className="sf-project-campaign-title" data-sf-m="project-campaign-title">
                    {campaign?.title || ''}
                  </span>
                )}
                {statusKey ? (
                  <span
                    className={`sf-project-tag is-${status || 'unknown'}`}
                    data-sf-m="project-campaign-status"
                    data-sf-state={status}
                  >{t(statusKey)}</span>
                ) : null}
              </div>

              {window ? (
                <p className="sf-project-campaign-meta" data-sf-m="project-campaign-time">
                  {t(window.key, window.values)}
                </p>
              ) : null}

              {tasks.length ? (
                <ul className="sf-project-task-rows" data-sf-m="project-task-rows">
                  {tasks.map((task) => (
                    <TaskSummaryRow
                      task={task}
                      t={t}
                      lang={lang}
                      key={String(task?.task_id ?? '')}
                    />
                  ))}
                </ul>
              ) : (
                <p className="sf-foot-note" data-sf-m="project-tasks-empty">{t('campaign.tasksEmpty')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ProjectNestedList
