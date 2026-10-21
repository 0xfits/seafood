import React from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { refOf, statusKeyOf, taskRewardOf, timeWindowOf, typeKeyOf } from '../campaign/campaign-util'
import ProjectForms from './ProjectForms'

// ============================================================================
// 项目页嵌套列表（campaign → task → subtask）
// ----------------------------------------------------------------------------
// 形态（派单步 2 + Kevin 2026-10-21 追加）：与 `/campaign/:ref` 详情**同族观感**——活动头
//   （标题 / 状态徽标 / 时间窗 / 任务数）→ 任务卡（标题 / 完成奖 $ / 时间窗 / 简述）→
//   子任务清单（类型徽标 / 标题 / 必做·选做 / 内容）。层级**写死三级**，禁拍平单级
//   （design §26.19.1 #70）。
//
// 写入口（**入口下沉到卡片**）：
//   · 每张**活动卡**头右侧 =【发布任务】；每张**任务卡**头右侧 =【发布子任务】；
//     显隐 = `canManage`（owner ∨ manage_tasks 管理员，父组件判）∧ 该行有数字主键；
//   · 点开后表单**就地**渲染在该卡内，目标已预选锁定（活动卡 ⇒ 锁活动；任务卡 ⇒ 锁活动 + 任务），
//     表单里**不渲染**选择器（ProjectForms 侧 `campaignLock` / `taskLock`）；
//   · 无活动 ⇒ 无活动卡 ⇒ 无任务入口；活动无任务 ⇒ 无任务卡 ⇒ 无子任务入口（自然缺席，不占位）。
//
// 口径：
//   · 类名自成一套 `sf-project-campaign* / -task* / -subtask*`（项目页只吃自己的命名，
//     不借 `sf-item*` 商品卡）；观感（徽标 / 分组 / 间距）与 campaign 页对齐；
//   · 时间窗一律走 `campaign-util.timeWindowOf`（禁 ISO 直出，一端缺失就整行不渲染）；
//   · 完成奖主奖励恒 `$`，次币需币种表映射成符号（缺符号 ⇒ 只显示金额，不阻断）；
//   · 活动标题链到 `/campaign/:ref`（读面交互元素）；
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

const TaskBlock = ({ task, t, lang, symbols, canManage, subtaskOpen, subtaskForm, onEntrySubtask }) => {
  const window = timeWindowOf(task, lang)
  const reward = taskRewardOf(task)
  const secondarySymbol = reward.secondaryCid ? (symbols[reward.secondaryCid] || '') : ''
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
  const taskRef = String(task?.task_id ?? '')
  return (
    <li className="sf-project-task" data-sf-m="project-task" data-sf-task={taskRef}>
      <div className="sf-project-task-head">
        <h4 className="sf-project-task-title" data-sf-m="project-task-title">{task?.title || ''}</h4>
        <div className="sf-project-head-right">
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
          {canManage && taskRef ? (
            <button
              type="button"
              className="sf-project-btn is-card"
              data-sf-m="project-task-entry-subtask"
              data-sf-task={taskRef}
              aria-expanded={subtaskOpen === true}
              onClick={() => onEntrySubtask?.(task)}
            >{t('project.entrySubtask')}</button>
          ) : null}
        </div>
      </div>

      {task?.description ? (
        <p className="sf-project-task-desc" data-sf-m="project-task-desc">{task.description}</p>
      ) : null}

      {window ? (
        <p className="sf-project-task-time" data-sf-m="project-task-time">{t(window.key, window.values)}</p>
      ) : null}

      {subtaskOpen && subtaskForm ? (
        <div className="sf-project-card-form" data-sf-m="project-card-form">{subtaskForm}</div>
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

const ProjectNestedList = ({
  campaigns,
  t,
  lang,
  symbols,
  canManage = false,
  panel = null,
  openCampaignRef = '',
  openTaskRef = '',
  slug = '',
  currencies = [],
  onEntryTask,
  onEntrySubtask,
  onClose,
  onDone,
}) => {
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
          const taskFormOpen = panel === 'task' && Boolean(ref) && openCampaignRef === ref
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
                <div className="sf-project-head-right">
                  {statusKey ? (
                    <span
                      className={`sf-project-tag is-${status || 'unknown'}`}
                      data-sf-m="project-campaign-status"
                      data-sf-state={status}
                    >{t(statusKey)}</span>
                  ) : null}
                  {canManage && ref ? (
                    <button
                      type="button"
                      className="sf-project-btn is-card"
                      data-sf-m="project-campaign-entry-task"
                      data-sf-ref={ref}
                      aria-expanded={taskFormOpen}
                      onClick={() => onEntryTask?.(campaign, ref)}
                    >{t('project.entryTask')}</button>
                  ) : null}
                </div>
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

              {taskFormOpen ? (
                <div className="sf-project-card-form" data-sf-m="project-card-form">
                  <ProjectForms
                    panel="task"
                    campaignLock={campaign}
                    currencies={currencies}
                    t={t}
                    onClose={onClose}
                    onDone={onDone}
                  />
                </div>
              ) : null}

              {tasks.length ? (
                <ul className="sf-project-tasks" data-sf-m="project-tasks">
                  {tasks.map((task) => {
                    const taskRef = String(task?.task_id ?? '')
                    // 开合键 = (活动 ref, task_id) 二元组：只按 task_id 判会让「同一 task_id 出现在两个活动下」
                    // 的两张卡同时开表单（入口各自锁自己的卡，表单却双开）；带上活动 ref 后每枚入口只开自己那张。
                    const subtaskOpen = panel === 'subtask' && Boolean(taskRef)
                      && openCampaignRef === ref && openTaskRef === taskRef
                    return (
                      <TaskBlock
                        task={task}
                        t={t}
                        lang={lang}
                        symbols={symbols}
                        canManage={canManage}
                        subtaskOpen={subtaskOpen}
                        subtaskForm={subtaskOpen ? (
                          <ProjectForms
                            panel="subtask"
                            slug={slug}
                            campaignLock={campaign}
                            taskLock={task}
                            t={t}
                            onClose={onClose}
                            onDone={onDone}
                          />
                        ) : null}
                        onEntrySubtask={(row) => onEntrySubtask?.(campaign, row)}
                        key={taskRef}
                      />
                    )
                  })}
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
