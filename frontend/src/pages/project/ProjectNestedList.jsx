import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildLocalizedPath } from '../../utils'
import { refOf, statusKeyOf, taskRewardOf, timeWindowOf, typeKeyOf } from '../campaign/campaign-util'
import { patchProjectTaskStatus, removeProjectSubtasks } from './project-api'
import { buildSubtaskRemovePayload } from './project-payload'
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
//   · **子任务行级操作**（Kevin 2026-10-22）：每条子任务右侧【编辑】【删除】（仅 `canManage`）——
//       编辑 = 该行就地切成 `SubtaskForm` 编辑态（预填），提交走 task PATCH `subtasks:[{subtask_id,...}]`；
//       **prediction 且父 task 非 draft ⇒ 不出【编辑】**（服务端 409 `prediction_locked_after_publish`），
//       只留「发布后不可编辑」一句；已结算的 prediction 同理；
//       删除 = **行内二次确认**（不弹窗）⇒ PATCH `subtasks_remove:[id]`；409 `subtask_has_proofs` ⇒ 行内
//       「已有用户提交，不能删除」；成功 ⇒ 页面静默重读（行消失以读口为准，不本地伪造）；
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

/** 已结算 prediction 的 payload 键（settle 口独占写）⇒ 该行不可编辑（重发会抹掉结算键）。 */
const PREDICTION_SETTLED_KEY = 'correct_option'

/**
 * prediction 行的【编辑】闸（Kevin 2026-10-22）：父 task 一旦发布（非 draft）即**不得编辑**
 * payload/type/title（服务端 409 `prediction_locked_after_publish`）⇒ 前端直接不出按钮，
 * 只留一行「发布后不可编辑」说明。已结算的行同理（结算键由 settle 口独占）。
 */
const predictionEditLocked = (subtask, taskStatus) => {
  if (String(subtask?.type_code || '') !== 'prediction') return false
  if (String(taskStatus || '') !== 'draft') return true
  const payload = subtask?.payload && typeof subtask.payload === 'object' ? subtask.payload : {}
  return Object.prototype.hasOwnProperty.call(payload, PREDICTION_SETTLED_KEY)
}

const SubtaskRow = ({
  subtask,
  t,
  canManage = false,
  editLocked = false,
  editing = false,
  confirming = false,
  removing = false,
  error = '',
  form = null,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) => {
  const typeKey = typeKeyOf(subtask?.type_code)
  const badge = typeKey ? t(typeKey) : (subtask?.type_label || '')
  const required = subtask?.required === true
  return (
    <li
      className={`sf-project-subtask${editing ? ' is-editing' : ''}`}
      data-sf-m="project-subtask"
      data-sf-subtask={String(subtask?.subtask_id ?? '')}
      data-sf-type={String(subtask?.type_code ?? '')}
      data-sf-editing={editing ? '1' : '0'}
    >
      <div className="sf-project-subtask-head">
        {badge ? <span className="sf-project-type-badge" data-sf-m="project-subtask-type">{badge}</span> : null}
        <span className="sf-project-subtask-title" data-sf-m="project-subtask-title">{subtask?.title || ''}</span>
        <span
          className={`sf-project-req ${required ? 'is-required' : 'is-optional'}`}
          data-sf-m="project-subtask-required"
          data-sf-required={required ? '1' : '0'}
        >{t(required ? 'campaign.requiredTag' : 'campaign.optionalTag')}</span>
        {canManage ? (
          <div className="sf-project-subtask-actions" data-sf-m="project-subtask-actions">
            {/* prediction 发布后：不出【编辑】，只给一句说明（标题/载荷/类型都已锁） */}
            {editLocked ? (
              <span className="sf-project-subtask-locked" data-sf-m="project-subtask-locked">
                {t('project.predictionLocked')}
              </span>
            ) : (
              <button
                type="button"
                className="sf-project-btn is-ghost is-row"
                data-sf-m="project-subtask-edit"
                data-sf-subtask={String(subtask?.subtask_id ?? '')}
                aria-expanded={editing}
                onClick={onEdit}
              >{t('project.subtaskEdit')}</button>
            )}
            {confirming ? (
              <>
                <span className="sf-project-subtask-confirm-text" data-sf-m="project-subtask-confirm-text">
                  {t('project.confirmDelete')}
                </span>
                <button
                  type="button"
                  className="sf-project-btn is-danger is-row"
                  data-sf-m="project-subtask-confirm"
                  data-sf-subtask={String(subtask?.subtask_id ?? '')}
                  disabled={removing}
                  onClick={onConfirmDelete}
                >{t('project.subtaskDelete')}</button>
                <button
                  type="button"
                  className="sf-project-btn is-ghost is-row"
                  data-sf-m="project-subtask-cancel"
                  disabled={removing}
                  onClick={onCancelDelete}
                >{t('project.cancel')}</button>
              </>
            ) : (
              <button
                type="button"
                className="sf-project-btn is-ghost is-row"
                data-sf-m="project-subtask-delete"
                data-sf-subtask={String(subtask?.subtask_id ?? '')}
                disabled={removing || editing}
                onClick={onAskDelete}
              >{t('project.subtaskDelete')}</button>
            )}
          </div>
        ) : null}
      </div>
      {subtask?.content ? (
        <p className="sf-project-subtask-content" data-sf-m="project-subtask-content">{subtask.content}</p>
      ) : null}
      {/* 失败就地内联（409 subtask_has_proofs / prediction_locked_after_publish / 网络） */}
      {error ? (
        <p className="sf-project-notice is-err" data-sf-m="project-subtask-err" role="alert">{error}</p>
      ) : null}
      {editing && form ? (
        <div className="sf-project-card-form" data-sf-m="project-card-form">{form}</div>
      ) : null}
    </li>
  )
}

const TaskBlock = ({ task, campaign, slug, t, lang, symbols, canManage, user, subtaskOpen, subtaskForm, onEntrySubtask, onStatusChanged, onDone }) => {
  const window = timeWindowOf(task, lang)
  const reward = taskRewardOf(task)
  const secondarySymbol = reward.secondaryCid ? (symbols[reward.secondaryCid] || '') : ''
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
  const taskRef = String(task?.task_id ?? '')
  const status = String(task?.status || '')
  const statusKey = statusKeyOf(status)
  // 上线 / 下线开关（Kevin 2026-10-21 · 步 3）：只有 draft / active 两态可切，ended 封板（服务端同口径）。
  const nextStatus = status === 'draft' ? 'active' : status === 'active' ? 'draft' : ''
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusErr, setStatusErr] = useState('')
  // 行级操作（Kevin 2026-10-22）：编辑**就地**展开在行内（一次只开一行）；删除 = 行内二次确认（不弹窗）。
  const [editingId, setEditingId] = useState('')
  const [confirmingId, setConfirmingId] = useState('')
  const [removingId, setRemovingId] = useState('')
  const [rowErr, setRowErr] = useState({ id: '', text: '' })

  const toggleStatus = async () => {
    if (!nextStatus || statusBusy) return
    setStatusBusy(true)
    setStatusErr('')
    try {
      await patchProjectTaskStatus(taskRef, nextStatus, user)
      setStatusBusy(false)
      // 成功 ⇒ 由页面层静默重读嵌套列表 + 页内提示（卡片自身不吃结果，避免两处真相）
      onStatusChanged?.(nextStatus, task)
    } catch (err) {
      setStatusBusy(false)
      // 失败（403 / 404 / 409 封板 / 网络）⇒ **就地内联**，不谎报状态已变
      // 文案复用 `project.publishFailed`（本项目域「写口失败」唯一句，零新键 ⇒ 四语计数不动）
      setStatusErr(t('project.publishFailed'))
    }
  }

  /** 【编辑】= 就地切编辑态（同一行再点 = 收起）；换行 = 关掉上一行的编辑/确认态与在报的错。 */
  const toggleEdit = (subtask) => {
    const id = String(subtask?.subtask_id ?? '')
    if (!id) return
    setRowErr({ id: '', text: '' })
    setConfirmingId('')
    setEditingId((prev) => (prev === id ? '' : id))
  }

  /** 【删除】第一步：行内二次确认（不弹窗、不发请求）。 */
  const askDelete = (subtask) => {
    const id = String(subtask?.subtask_id ?? '')
    if (!id || removingId) return
    setRowErr({ id: '', text: '' })
    setEditingId('')
    setConfirmingId(id)
  }

  /** 【删除】第二步：PATCH `{subtasks_remove:[id]}`；成功 ⇒ 页面静默重读，失败 ⇒ 行内内联。 */
  const confirmDelete = async (subtask) => {
    const id = String(subtask?.subtask_id ?? '')
    if (!id || removingId) return
    const built = buildSubtaskRemovePayload([id])
    if (!built.ok) {
      setRowErr({ id, text: t('project.deleteFailed') })
      return
    }
    setRemovingId(id)
    setRowErr({ id: '', text: '' })
    try {
      await removeProjectSubtasks(taskRef, built.payload.subtasks_remove, user)
      setConfirmingId('')
      // 成功 ⇒ 由页面层给结论 + 静默重读（行消失由读口事实决定，不在本地伪造）
      onDone?.({ kind: 'ok', text: t('project.subtaskDeleted') })
    } catch (error) {
      const code = String(error?.code || '')
      setRowErr({
        id,
        text: code === 'subtask_has_proofs'
          ? t('project.hasProofs')
          : code === 'prediction_locked_after_publish'
            ? t('project.predictionLocked')
            : t('project.deleteFailed'),
      })
      setConfirmingId('')
    } finally {
      setRemovingId('')
    }
  }

  return (
    <li className="sf-project-task" data-sf-m="project-task" data-sf-task={taskRef} data-sf-state={status || 'unknown'}>
      <div className="sf-project-task-head">
        <h4 className="sf-project-task-title" data-sf-m="project-task-title">{task?.title || ''}</h4>
        <div className="sf-project-head-right">
          {statusKey ? (
            <span
              className={`sf-project-tag is-${status || 'unknown'}`}
              data-sf-m="project-task-status"
              data-sf-state={status}
            >{t(statusKey)}</span>
          ) : null}
          {canManage && taskRef && nextStatus ? (
            <button
              type="button"
              className="sf-project-btn is-card"
              data-sf-m="project-task-status-toggle"
              data-sf-task={taskRef}
              data-sf-next={nextStatus}
              disabled={statusBusy}
              onClick={toggleStatus}
            >{t(status === 'draft' ? 'project.taskOnline' : 'project.taskOffline')}</button>
          ) : null}
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

      {statusErr ? (
        <p
          className="sf-project-notice is-err"
          data-sf-m="project-task-status-err"
          data-sf-task={taskRef}
          role="alert"
        >{statusErr}</p>
      ) : null}

      {subtaskOpen && subtaskForm ? (
        <div className="sf-project-card-form" data-sf-m="project-card-form">{subtaskForm}</div>
      ) : null}

      {subtasks.length ? (
        <ul className="sf-project-subtasks" data-sf-m="project-subtasks">
          {subtasks.map((subtask) => {
            const id = String(subtask?.subtask_id ?? '')
            const manageable = canManage && Boolean(id)
            const editing = manageable && editingId === id
            return (
              <SubtaskRow
                subtask={subtask}
                t={t}
                canManage={manageable}
                editLocked={predictionEditLocked(subtask, status)}
                editing={editing}
                confirming={manageable && confirmingId === id}
                removing={manageable && removingId === id}
                error={rowErr.id === id ? rowErr.text : ''}
                form={editing ? (
                  <ProjectForms
                    panel="subtask"
                    slug={slug}
                    campaignLock={campaign}
                    taskLock={task}
                    subtask={subtask}
                    t={t}
                    onClose={() => setEditingId('')}
                    onDone={onDone}
                  />
                ) : null}
                onEdit={() => toggleEdit(subtask)}
                onAskDelete={() => askDelete(subtask)}
                onCancelDelete={() => setConfirmingId('')}
                onConfirmDelete={() => confirmDelete(subtask)}
                key={id || String(subtask?.title ?? '')}
              />
            )
          })}
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
  user = null,
  panel = null,
  openCampaignRef = '',
  openTaskRef = '',
  slug = '',
  currencies = [],
  onEntryTask,
  onEntrySubtask,
  onTaskStatusChanged,
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
                        campaign={campaign}
                        slug={slug}
                        t={t}
                        lang={lang}
                        symbols={symbols}
                        canManage={canManage}
                        user={user}
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
                        onStatusChanged={onTaskStatusChanged}
                        onDone={onDone}
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
