import React, { useState } from 'react'
import { useAuth } from '../../auth-context'
import {
  appendProjectSubtasks,
  createProjectCampaign,
  createProjectCampaignTask,
  fetchProjectDetail,
  patchProjectCampaign,
} from './project-api'
import {
  SUBTASK_TYPE_CODES,
  buildCampaignPayload,
  buildLaunchPayload,
  buildSubtaskAppendGroup,
  buildSubtaskInput,
  buildTaskPayload,
} from './project-payload'
import { refOf } from '../campaign/campaign-util'

// ============================================================================
// 项目页三表单（【发布活动】/【发布任务】/【发布子任务】）
// ----------------------------------------------------------------------------
// 硬口径（步 2；Kevin 2026-10-21 追加：任务/子任务入口下沉到卡片）：
//   · 入口显隐 = owner ∨ `manage_tasks` 管理员（父组件判；本组件只被 canManage 时挂载）；
//   · 【发布活动】挂在页面顶部操作区（唯一顶部入口）；【发布任务】挂在**每张活动卡**头右侧，
//     打开时 `campaignLock` = 该卡活动 ⇒ **不渲染活动选择器**（预选/锁定，载荷 ref 即该卡）；
//   · 【发布子任务】挂在**每张任务卡**头右侧，`campaignLock` + `taskLock` 双锁 ⇒ 两个选择器
//     都不渲染；提交仍「先重读现有 subtasks、再整组追加」（负控不放松）；
//   · 载荷**一律**由 `project-payload.js` 构造器产出（键集 = 后端闭集，单测逐键对拍）；
//   · 【发布活动】POST 只送五键；「立即上线」勾选 ⇒ 再发一条 PATCH `{status:'active'}`，
//     该口服务端**仅管理员** ⇒ 失败时已建草稿保留、页内明示「草稿已建、上线需管理员」；
//   · 时间输入用 `datetime-local`，发送前统一 ISO（禁把本地裸串直接发给后端）。
// ============================================================================

let rowSeq = 0
const nextRowKey = () => {
  rowSeq += 1
  return `r${rowSeq}`
}

const blankRow = (overrides = {}) => ({
  key: nextRowKey(),
  typeCode: 'x_verify',
  title: '',
  content: '',
  required: true,
  sort: '0',
  optionA: '',
  optionB: '',
  prize: '',
  deadline: '',
  ...overrides,
})

/** 校验错误码 → 文案键（单一映射点，避免各表单各写一套）。 */
const errorTextOf = (code, t) => {
  switch (code) {
    case 'title': return t('project.errNeedTitle')
    case 'project': return t('project.errProject')
    case 'description': return t('project.errDescription')
    case 'time': return t('project.timeInvalid')
    case 'sort': return t('project.errSort')
    case 'reward': return t('project.rewardInvalid')
    case 'rewardPair': return t('project.errRewardPair')
    case 'type': return t('project.errNeedType')
    case 'prediction': return t('project.predictionInvalid')
    case 'subtask': return t('project.errNeedSubtask')
    case 'assert': return t('project.errGroupAssert')
    case 'campaign': return t('project.errNeedCampaign')
    case 'task': return t('project.errNeedTask')
    default: return t('project.publishFailed')
  }
}

const Field = ({ label, children }) => (
  <label className="sf-project-field">
    <span className="sf-project-field-label">{label}</span>
    {children}
  </label>
)

/** 子任务行编辑器（task 表单可多行；subtask 表单单行）——prediction 追加四键输入。 */
const SubtaskRowEditor = ({ row, index, t, onChange, onRemove, canRemove }) => {
  const set = (patch) => onChange({ ...row, ...patch })
  const isPrediction = row.typeCode === 'prediction'
  return (
    <div className="sf-project-row" data-sf-m="project-row" data-sf-row={index} data-sf-type={row.typeCode}>
      <div className="sf-project-row-head">
        <span className="sf-project-row-index" data-sf-m="project-row-index">{index + 1}</span>
        <select
          className="sf-project-input"
          data-sf-field="type"
          aria-label={t('project.fType')}
          value={row.typeCode}
          onChange={(event) => set({ typeCode: event.target.value })}
        >
          {SUBTASK_TYPE_CODES.map((code) => (
            <option value={code} key={code}>{t(`campaign.type.${code}`)}</option>
          ))}
        </select>
        {canRemove ? (
          <button
            type="button"
            className="sf-project-btn is-ghost"
            data-sf-m="project-row-remove"
            onClick={onRemove}
          >{t('project.fSubtaskRemove')}</button>
        ) : null}
      </div>

      <input
        className="sf-project-input"
        data-sf-field="title"
        aria-label={t('project.fTitle')}
        placeholder={t('project.fTitle')}
        value={row.title}
        onChange={(event) => set({ title: event.target.value })}
      />
      <textarea
        className="sf-project-input"
        data-sf-field="content"
        aria-label={t('project.fContent')}
        placeholder={t('project.fContent')}
        rows={2}
        value={row.content}
        onChange={(event) => set({ content: event.target.value })}
      />

      {isPrediction ? (
        <div className="sf-project-row-grid">
          <input
            className="sf-project-input"
            data-sf-field="optionA"
            aria-label={t('project.fOptionA')}
            placeholder={t('project.fOptionA')}
            value={row.optionA}
            onChange={(event) => set({ optionA: event.target.value })}
          />
          <input
            className="sf-project-input"
            data-sf-field="optionB"
            aria-label={t('project.fOptionB')}
            placeholder={t('project.fOptionB')}
            value={row.optionB}
            onChange={(event) => set({ optionB: event.target.value })}
          />
          <input
            className="sf-project-input"
            data-sf-field="prize"
            aria-label={t('project.fPrize')}
            placeholder={t('project.fPrize')}
            inputMode="numeric"
            value={row.prize}
            onChange={(event) => set({ prize: event.target.value })}
          />
          <input
            className="sf-project-input"
            data-sf-field="deadline"
            aria-label={t('project.fDeadline')}
            type="datetime-local"
            value={row.deadline}
            onChange={(event) => set({ deadline: event.target.value })}
          />
        </div>
      ) : null}

      <div className="sf-project-row-grid">
        <label className="sf-project-check">
          <input
            type="checkbox"
            data-sf-field="required"
            checked={row.required === true}
            onChange={(event) => set({ required: event.target.checked })}
          />
          <span>{t('project.fRequired')}</span>
        </label>
        <label className="sf-project-check">
          <span>{t('project.fSort')}</span>
          <input
            className="sf-project-input is-narrow"
            data-sf-field="sort"
            inputMode="numeric"
            value={row.sort}
            onChange={(event) => set({ sort: event.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

const Notice = ({ notice }) => (
  notice?.text ? (
    <p
      className={`sf-project-notice is-${notice.kind || 'err'}`}
      data-sf-m="project-form-notice"
      data-sf-kind={notice.kind || 'err'}
      role="alert"
    >
      {notice.text}
    </p>
  ) : null
)

/**
 * 锁定上下文条（替代选择器）：入口从卡片进入 ⇒ 目标已定，不再让用户改。
 * 只读、无输入控件、无文案键新增（链上文字取读口行标题）；
 * `data-sf-ref` / `data-sf-campaign` 供单测与探针对拍「锁的是哪一条」。
 */
const LockedContext = ({ items, ...rest }) => (
  <div className="sf-project-locked" {...rest}>
    {items.map((item, index) => (
      <React.Fragment key={`${item.ref}-${index}`}>
        {index > 0 ? <span className="sf-project-locked-sep" aria-hidden="true">›</span> : null}
        <span className="sf-project-locked-value">{item.label}</span>
      </React.Fragment>
    ))}
  </div>
)

const CampaignForm = ({ view, t, onDone, onClose }) => {
  const { user } = useAuth()
  const [form, setForm] = useState({ title: '', description: '', timeStart: '', timeEnd: '', launch: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const projectId = view?.project_id ?? view?.snowflake_id
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setErr(null)
    const built = buildCampaignPayload(form, projectId)
    if (!built.ok) {
      setErr({ kind: 'err', text: errorTextOf(built.error, t) })
      return
    }
    setBusy(true)
    try {
      const created = await createProjectCampaign(built.payload, user)
      const ref = refOf(created)
      if (form.launch && ref) {
        try {
          await patchProjectCampaign(ref, buildLaunchPayload(), user)
          onDone({ kind: 'ok', text: t('project.okLaunched') })
        } catch (error) {
          // 建成功、上线失败（该口服务端仅管理员）：草稿保留，明确告知，不谎报「上线」
          onDone({ kind: 'err', text: t('project.okDraftOnly') })
        }
      } else {
        onDone({ kind: 'ok', text: t('project.okDraft') })
      }
      setForm({ title: '', description: '', timeStart: '', timeEnd: '', launch: false })
      onClose?.()
    } catch (error) {
      setErr({ kind: 'err', text: t('project.publishFailed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="sf-project-form" data-sf-m="project-form-campaign" onSubmit={submit}>
      <Field label={t('project.fTitle')}>
        <input
          className="sf-project-input"
          data-sf-field="title"
          value={form.title}
          onChange={(event) => set({ title: event.target.value })}
        />
      </Field>
      <Field label={t('project.fDescription')}>
        <textarea
          className="sf-project-input"
          data-sf-field="description"
          rows={3}
          value={form.description}
          onChange={(event) => set({ description: event.target.value })}
        />
      </Field>
      <div className="sf-project-row-grid">
        <Field label={t('project.fTimeStart')}>
          <input
            className="sf-project-input"
            data-sf-field="timeStart"
            type="datetime-local"
            value={form.timeStart}
            onChange={(event) => set({ timeStart: event.target.value })}
          />
        </Field>
        <Field label={t('project.fTimeEnd')}>
          <input
            className="sf-project-input"
            data-sf-field="timeEnd"
            type="datetime-local"
            value={form.timeEnd}
            onChange={(event) => set({ timeEnd: event.target.value })}
          />
        </Field>
      </div>
      <label className="sf-project-check">
        <input
          type="checkbox"
          data-sf-field="launch"
          checked={form.launch}
          onChange={(event) => set({ launch: event.target.checked })}
        />
        <span>{t('project.fNowLive')}</span>
      </label>
      <p className="sf-foot-note" data-sf-m="project-form-hint">{t('project.fNowLiveHint')}</p>
      <Notice notice={err} />
      <div className="sf-project-actions">
        <button type="submit" className="sf-project-btn is-primary" data-sf-m="project-form-submit" disabled={busy}>
          {busy ? t('project.submitting') : t('project.submitCampaign')}
        </button>
        <button type="button" className="sf-project-btn" data-sf-m="project-form-cancel" onClick={onClose} disabled={busy}>
          {t('project.cancel')}
        </button>
      </div>
    </form>
  )
}

const TaskForm = ({ t, onDone, onClose, currencies, campaignLock }) => {
  const { user } = useAuth()
  // 入口在活动卡内 ⇒ 目标活动**预选锁定**（只读芯片代替下拉，载荷 ref 恒为该卡）
  const lockedRef = refOf(campaignLock)
  const [form, setForm] = useState({
    title: '',
    description: '',
    timeStart: '',
    timeEnd: '',
    sort: '0',
    rewardPrimary: '',
    rewardCid: '',
    rewardAmount: '',
  })
  const [rows, setRows] = useState(() => [blankRow()])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // 防御：活动无主键（读口异形行）不可能有入口；万一被唤起也不得发写请求（零请求、明示原因）。
  if (!lockedRef) {
    return (
      <div className="sf-project-form" data-sf-m="project-form-task">
        <p className="sf-foot-note" data-sf-m="project-form-need-campaign">{t('project.fNoCampaign')}</p>
        <div className="sf-project-actions">
          <button type="button" className="sf-project-btn" data-sf-m="project-form-cancel" onClick={onClose}>
            {t('project.cancel')}
          </button>
        </div>
      </div>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setErr(null)
    const built = buildTaskPayload({ ...form, subtasks: rows })
    if (!built.ok) {
      setErr({ kind: 'err', text: errorTextOf(built.error, t) })
      return
    }
    setBusy(true)
    try {
      await createProjectCampaignTask(lockedRef, built.payload, user)
      onDone({ kind: 'ok', text: t('project.published') })
      onClose?.()
    } catch (error) {
      setErr({ kind: 'err', text: t('project.publishFailed') })
    } finally {
      setBusy(false)
    }
  }

  const secondaryCurrencies = (Array.isArray(currencies) ? currencies : [])
    .filter((row) => String(row?.cid ?? '') !== '1' && row?.cid != null)

  return (
    <form className="sf-project-form" data-sf-m="project-form-task" onSubmit={submit}>
      <LockedContext
        data-sf-m="project-form-campaign-locked"
        data-sf-ref={lockedRef}
        items={[{ ref: lockedRef, label: campaignLock?.title || lockedRef }]}
      />
      <Field label={t('project.fTitle')}>
        <input
          className="sf-project-input"
          data-sf-field="title"
          value={form.title}
          onChange={(event) => set({ title: event.target.value })}
        />
      </Field>
      <Field label={t('project.fDescription')}>
        <textarea
          className="sf-project-input"
          data-sf-field="description"
          rows={2}
          value={form.description}
          onChange={(event) => set({ description: event.target.value })}
        />
      </Field>
      <div className="sf-project-row-grid">
        <Field label={t('project.fTimeStart')}>
          <input
            className="sf-project-input"
            data-sf-field="timeStart"
            type="datetime-local"
            value={form.timeStart}
            onChange={(event) => set({ timeStart: event.target.value })}
          />
        </Field>
        <Field label={t('project.fTimeEnd')}>
          <input
            className="sf-project-input"
            data-sf-field="timeEnd"
            type="datetime-local"
            value={form.timeEnd}
            onChange={(event) => set({ timeEnd: event.target.value })}
          />
        </Field>
      </div>
      <div className="sf-project-row-grid">
        <Field label={t('project.fReward')}>
          <input
            className="sf-project-input"
            data-sf-field="reward"
            inputMode="numeric"
            value={form.rewardPrimary}
            onChange={(event) => set({ rewardPrimary: event.target.value })}
          />
        </Field>
        <Field label={t('project.fSort')}>
          <input
            className="sf-project-input"
            data-sf-field="sort"
            inputMode="numeric"
            value={form.sort}
            onChange={(event) => set({ sort: event.target.value })}
          />
        </Field>
      </div>
      <div className="sf-project-row-grid">
        <Field label={t('project.fRewardCid')}>
          <select
            className="sf-project-input"
            data-sf-field="cid"
            value={form.rewardCid}
            onChange={(event) => set({ rewardCid: event.target.value })}
          >
            <option value="">{t('project.fRewardCidNone')}</option>
            {secondaryCurrencies.map((row) => (
              <option value={String(row.cid)} key={String(row.cid)}>{row.symbol || `#${row.cid}`}</option>
            ))}
          </select>
        </Field>
        <Field label={t('project.fRewardAmount')}>
          <input
            className="sf-project-input"
            data-sf-field="amount"
            inputMode="numeric"
            value={form.rewardAmount}
            onChange={(event) => set({ rewardAmount: event.target.value })}
          />
        </Field>
      </div>

      <div className="sf-project-rows" data-sf-m="project-task-rows">
        <div className="sf-project-rows-head">
          <span className="sf-project-field-label">{t('project.fSubtaskRows')}</span>
          <button
            type="button"
            className="sf-project-btn is-ghost"
            data-sf-m="project-row-add"
            onClick={() => setRows((prev) => [...prev, blankRow({ sort: String(prev.length) })])}
          >{t('project.fAddRow')}</button>
        </div>
        {rows.map((row, index) => (
          <SubtaskRowEditor
            row={row}
            index={index}
            t={t}
            canRemove={rows.length > 1}
            key={row.key}
            onChange={(next) => setRows((prev) => prev.map((item) => (item.key === next.key ? next : item)))}
            onRemove={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
          />
        ))}
      </div>

      <Notice notice={err} />
      <div className="sf-project-actions">
        <button type="submit" className="sf-project-btn is-primary" data-sf-m="project-form-submit" disabled={busy}>
          {busy ? t('project.submitting') : t('project.submitTask')}
        </button>
        <button type="button" className="sf-project-btn" data-sf-m="project-form-cancel" onClick={onClose} disabled={busy}>
          {t('project.cancel')}
        </button>
      </div>
    </form>
  )
}

const SubtaskForm = ({ slug, t, onDone, onClose, campaignLock, taskLock }) => {
  const { user } = useAuth()
  // 入口在任务卡内 ⇒ 活动 + 任务**双预选锁定**（两个选择器都不渲染；载荷 ref 恒为该卡）
  const lockedCampaignRef = refOf(campaignLock)
  const lockedTaskRef = taskLock?.task_id != null ? String(taskLock.task_id) : ''
  const [row, setRow] = useState(() => blankRow())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // 防御：无主键的卡片不渲染入口；万一被唤起也零请求、明示原因（不静默提交到错目标）。
  if (!lockedCampaignRef || !lockedTaskRef) {
    return (
      <div className="sf-project-form" data-sf-m="project-form-subtask">
        <p className="sf-foot-note" data-sf-m="project-form-need-campaign">{t('project.fNoTask')}</p>
        <div className="sf-project-actions">
          <button type="button" className="sf-project-btn" data-sf-m="project-form-cancel" onClick={onClose}>
            {t('project.cancel')}
          </button>
        </div>
      </div>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setErr(null)
    const built = buildSubtaskInput(row)
    if (!built.ok) {
      setErr({ kind: 'err', text: errorTextOf(built.error, t) })
      return
    }
    if (built.skip) {
      setErr({ kind: 'err', text: t('project.errNeedSubtask') })
      return
    }
    setBusy(true)
    try {
      // 先取现有 subtasks（**新鲜读**，不用页面缓存）⇒ 再整组追加；旧行一条都不能丢。
      const fresh = await fetchProjectDetail(slug, user)
      const campaign = (Array.isArray(fresh?.campaigns) ? fresh.campaigns : [])
        .find((item) => refOf(item) === lockedCampaignRef)
      const task = (Array.isArray(campaign?.tasks) ? campaign.tasks : [])
        .find((item) => String(item?.task_id ?? '') === lockedTaskRef)
      if (!task) {
        setErr({ kind: 'err', text: t('project.errNeedTask') })
        return
      }
      const grouped = buildSubtaskAppendGroup(task.subtasks, built.input)
      if (!grouped.ok) {
        setErr({ kind: 'err', text: errorTextOf(grouped.error, t) })
        return
      }
      await appendProjectSubtasks(lockedTaskRef, grouped.group, user)
      onDone({ kind: 'ok', text: t('project.published') })
      onClose?.()
    } catch (error) {
      setErr({ kind: 'err', text: t('project.publishFailed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="sf-project-form" data-sf-m="project-form-subtask" onSubmit={submit}>
      <LockedContext
        data-sf-m="project-form-task-locked"
        data-sf-campaign={lockedCampaignRef}
        data-sf-ref={lockedTaskRef}
        items={[
          { ref: lockedCampaignRef, label: campaignLock?.title || lockedCampaignRef },
          { ref: lockedTaskRef, label: taskLock?.title || lockedTaskRef },
        ]}
      />

      <div className="sf-project-rows" data-sf-m="project-subtask-rows">
        <SubtaskRowEditor
          row={row}
          index={0}
          t={t}
          canRemove={false}
          onChange={setRow}
          onRemove={() => setRow(blankRow())}
        />
      </div>

      <Notice notice={err} />
      <div className="sf-project-actions">
        <button
          type="submit"
          className="sf-project-btn is-primary"
          data-sf-m="project-form-submit"
          disabled={busy}
        >
          {busy ? t('project.submitting') : t('project.submitSubtask')}
        </button>
        <button type="button" className="sf-project-btn" data-sf-m="project-form-cancel" onClick={onClose} disabled={busy}>
          {t('project.cancel')}
        </button>
      </div>
    </form>
  )
}

const ProjectForms = ({ panel, view, slug, currencies, t, onClose, onDone, campaignLock, taskLock }) => {
  if (!panel) return null
  if (panel === 'campaign') {
    return <CampaignForm view={view} t={t} onDone={onDone} onClose={onClose} />
  }
  if (panel === 'task') {
    return (
      <TaskForm
        t={t}
        currencies={currencies}
        campaignLock={campaignLock}
        onDone={onDone}
        onClose={onClose}
      />
    )
  }
  if (panel === 'subtask') {
    return (
      <SubtaskForm
        slug={slug}
        t={t}
        campaignLock={campaignLock}
        taskLock={taskLock}
        onDone={onDone}
        onClose={onClose}
      />
    )
  }
  return null
}

export default ProjectForms
