import React from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { refOf, statusKeyOf, taskRewardOf, timeWindowOf, typeKeyOf } from '../campaign/campaign-util'

// ============================================================================
// 项目页嵌套列表（campaign → task → subtask，**只读**）
// ----------------------------------------------------------------------------
// 形态（派单步 2）：与 `/campaign/:ref` 详情**同族观感**——活动头（标题 / 状态徽标 / 时间窗 /
//   任务数）→ 任务卡（标题 / 完成奖 $ / 时间窗 / 简述）→ 子任务清单（类型徽标 / 标题 /
//   必做·选做 / 内容）。层级**写死三级**，禁拍平单级（design §26.19.1 #70）。
//
// 口径：
//   · 类名自成一套 `sf-project-campaign* / -task* / -subtask*`（项目页只吃自己的命名，
//     不借 `sf-item*` 商品卡）；观感（徽标 / 分组 / 间距）与 campaign 页对齐；
//   · 时间窗一律走 `campaign-util.timeWindowOf`（禁 ISO 直出，一端缺失就整行不渲染）；
//   · 完成奖主奖励恒 `$`，次币需币种表映射成符号（缺符号 ⇒ 只显示金额，不阻断）；
//   · 活动标题链到 `/campaign/:ref`（同族页面；只读列表里唯一的交互元素）；
//   · 空态：项目无活动 → `project.campaignsEmpty`；活动无任务 → `campaign.tasksEmpty`；
//     任务无子任务 → `project.subtasksEmpty`（三处文案各自在场，不靠空白示意）。
// ============================================================================

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const SubtaskRow = ({ subtask, t }) => {
  const typeKey = typeKeyOf(subtask?.type_code)
  const badge = typeKey ? t(typeKey) : (subtask?.type_label || '')
  const required = subtask?.required === true
  return (
    <li
      className="sf-project-subtask"
      data-sf-m="project-subtask"
      data-sf-subtask={String(subtask?.subtask_id ?? '')}
      data-sf-type={String(subtask?.type_code ?? '')}
    >
      <div className="sf-project-subtask-head">
        {badge ? <span className="sf-project-type-badge" data-sf-m="project-subtask-type">{badge}</span> : null}
        <span className="sf-project-subtask-title" data-sf-m="project-subtask-title">{subtask?.title || ''}</span>
        <span
          className={`sf-project-req ${required ? 'is-required' : 'is-optional'}`}
          data-sf-m="project-subtask-required"
          data-sf-required={required ? '1' : '0'}
        >{t(required ? 'campaign.requiredTag' : 'campaign.optionalTag')}</span>
      </div>
      {subtask?.content ? (
        <p className="sf-project-subtask-content" data-sf-m="project-subtask-content">{subtask.content}</p>
      ) : null}
    </li>
  )
}

const TaskBlock = ({ task, t, lang, symbols }) => {
  const window = timeWindowOf(task, lang)
  const reward = taskRewardOf(task)
  const secondarySymbol = reward.secondaryCid ? (symbols[reward.secondaryCid] || '') : ''
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
  return (
    <li className="sf-project-task" data-sf-m="project-task" data-sf-task={String(task?.task_id ?? '')}>
      <div className="sf-project-task-head">
        <h4 className="sf-project-task-title" data-sf-m="project-task-title">{task?.title || ''}</h4>
        {reward.primary ? (
          <span className="sf-project-task-reward" data-sf-m="project-task-reward" data-sf-amount={reward.primary}>
            {t('campaign.rewardCompletion', { amount: reward.primary })}
            {reward.secondaryAmount && secondarySymbol ? (
              <span className="sf-project-task-reward-extra" data-sf-m="project-task-reward-extra">
                {t('campaign.rewardSecondary', { amount: reward.secondaryAmount, symbol: secondarySymbol })}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {task?.description ? (
        <p className="sf-project-task-desc" data-sf-m="project-task-desc">{task.description}</p>
      ) : null}

      {window ? (
        <p className="sf-project-task-time" data-sf-m="project-task-time">{t(window.key, window.values)}</p>
      ) : null}

      {subtasks.length ? (
        <ul className="sf-project-subtasks" data-sf-m="project-subtasks">
          {subtasks.map((subtask) => (
            <SubtaskRow subtask={subtask} t={t} key={String(subtask?.subtask_id ?? '')} />
          ))}
        </ul>
      ) : (
        <p className="sf-foot-note" data-sf-m="project-subtasks-empty">{t('project.subtasksEmpty')}</p>
      )}
    </li>
  )
}

const ProjectNestedList = ({ campaigns, t, lang, symbols }) => {
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

              {campaign?.description ? (
                <p className="sf-project-campaign-desc" data-sf-m="project-campaign-desc">{campaign.description}</p>
              ) : null}

              <div className="sf-project-campaign-meta">
                {window ? (
                  <span data-sf-m="project-campaign-time">{t(window.key, window.values)}</span>
                ) : null}
                <span data-sf-m="project-campaign-tasks">{t('campaign.taskCount', { n: num(tasks.length) })}</span>
              </div>

              {tasks.length ? (
                <ul className="sf-project-tasks" data-sf-m="project-tasks">
                  {tasks.map((task) => (
                    <TaskBlock
                      task={task}
                      t={t}
                      lang={lang}
                      symbols={symbols}
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
