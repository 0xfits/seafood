import React, { useMemo, useState } from 'react'
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
// 项目页三入口表单（【发布 campaign】/【发布任务】/【发布子任务】）
// ----------------------------------------------------------------------------
// 硬口径（步 2）：
//   · 入口显隐 = owner ∨ `manage_tasks` 管理员（父组件判；本组件只被 canManage 时挂载）；
//   · 载荷**一律**由 `project-payload.js` 构造器产出（键集 = 后端闭集，单测逐键对拍）；
//   · 【发布 campaign】POST 只送五键；「立即上线」勾选 ⇒ 再发一条 PATCH `{status:'active'}`，
//     该口服务端**仅管理员** ⇒ 失败时已建草稿保留、页内明示「草稿已建、上线需管理员」；
//   · 【发布任务】campaign 下拉取读口嵌套行；无 campaign ⇒ 引导先建（切到 campaign 面板）；
//   · 【发布子任务】提交前**重读**项目详情拿最新 `task.subtasks`，再整组追加：
//     `buildSubtaskAppendGroup` 断言「旧行 + 1」，断言不过 ⇒ 拒发（零 PATCH）；
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

const TaskForm = ({ view, t, onDone, onClose, onNeedCampaign, currencies }) => {
  const { user } = useAuth()
  const campaigns = Array.isArray(view?.campaigns) ? view.campaigns : []
  const options = useMemo(
    () => campaigns.map((campaign) => ({ ref: refOf(campaign), title: campaign?.title || '' })).filter((row) => row.ref),
    [campaigns],
  )
  const [form, setForm] = useState({
    campaignRef: options[0]?.ref || '',
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

  if (!options.length) {
    return (
      <div className="sf-project-form" data-sf-m="project-form-task">
        <p className="sf-foot-note" data-sf-m="project-form-need-campaign">{t('project.fNoCampaign')}</p>
        <div className="sf-project-actions">
          <button type="button" className="sf-project-btn is-primary" data-sf-m="project-form-goto-campaign" onClick={onNeedCampaign}>
            {t('project.entryCampaign')}
          </button>
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
    if (!form.campaignRef) {
      setErr({ kind: 'err', text: t('project.errNeedCampaign') })
      return
    }
    const built = buildTaskPayload({ ...form, subtasks: rows })
    if (!built.ok) {
      setErr({ kind: 'err', text: errorTextOf(built.error, t) })
      return
    }
    setBusy(true)
    try {
      await createProjectCampaignTask(form.campaignRef, built.payload, user)
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
      <Field label={t('project.fCampaignSelect')}>
        <select
          className="sf-project-input"
          data-sf-field="campaign"
          value={form.campaignRef}
          onChange={(event) => set({ campaignRef: event.target.value })}
        >
          {options.map((row) => (
            <option value={row.ref} key={row.ref}>{row.title || row.ref}</option>
          ))}
        </select>
      </Field>
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

const SubtaskForm = ({ view, slug, t, onDone, onClose, onNeedCampaign }) => {
  const { user } = useAuth()
  const campaigns = Array.isArray(view?.campaigns) ? view.campaigns : []
  const campaignOptions = campaigns
    .map((campaign) => ({ ref: refOf(campaign), title: campaign?.title || '' }))
    .filter((row) => row.ref)

  const [campaignRef, setCampaignRef] = useState(campaignOptions[0]?.ref || '')
  const tasksOf = (ref) => {
    const campaign = campaigns.find((row) => refOf(row) === ref)
    return (Array.isArray(campaign?.tasks) ? campaign.tasks : [])
      .map((task) => ({ ref: String(task?.task_id ?? ''), title: task?.title || '' }))
      .filter((row) => row.ref)
  }
  const firstTasks = campaignRef ? tasksOf(campaignRef) : []
  const [taskRef, setTaskRef] = useState(firstTasks[0]?.ref || '')
  const [row, setRow] = useState(() => blankRow())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  if (!campaignOptions.length) {
    return (
      <div className="sf-project-form" data-sf-m="project-form-subtask">
        <p className="sf-foot-note" data-sf-m="project-form-need-campaign">{t('project.fNoCampaign')}</p>
        <div className="sf-project-actions">
          <button type="button" className="sf-project-btn is-primary" data-sf-m="project-form-goto-campaign" onClick={onNeedCampaign}>
            {t('project.entryCampaign')}
          </button>
          <button type="button" className="sf-project-btn" data-sf-m="project-form-cancel" onClick={onClose}>
            {t('project.cancel')}
          </button>
        </div>
      </div>
    )
  }

  const taskOptions = campaignRef ? tasksOf(campaignRef) : []

  const switchCampaign = (ref) => {
    setCampaignRef(ref)
    const next = tasksOf(ref)
    setTaskRef(next[0]?.ref || '')
    setErr(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setErr(null)
    if (!campaignRef) {
      setErr({ kind: 'err', text: t('project.errNeedCampaign') })
      return
    }
    if (!taskOptions.length) {
      setErr({ kind: 'err', text: t('project.fNoTask') })
      return
    }
    if (!taskRef) {
      setErr({ kind: 'err', text: t('project.errNeedTask') })
      return
    }
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
        .find((item) => refOf(item) === campaignRef)
      const task = (Array.isArray(campaign?.tasks) ? campaign.tasks : [])
        .find((item) => String(item?.task_id ?? '') === taskRef)
      if (!task) {
        setErr({ kind: 'err', text: t('project.errNeedTask') })
        return
      }
      const grouped = buildSubtaskAppendGroup(task.subtasks, built.input)
      if (!grouped.ok) {
        setErr({ kind: 'err', text: errorTextOf(grouped.error, t) })
        return
      }
      await appendProjectSubtasks(taskRef, grouped.group, user)
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
      <div className="sf-project-row-grid">
        <Field label={t('project.fCampaignSelect')}>
          <select
            className="sf-project-input"
            data-sf-field="campaign"
            value={campaignRef}
            onChange={(event) => switchCampaign(event.target.value)}
          >
            {campaignOptions.map((option) => (
              <option value={option.ref} key={option.ref}>{option.title || option.ref}</option>
            ))}
          </select>
        </Field>
        <Field label={t('project.fTaskSelect')}>
          <select
            className="sf-project-input"
            data-sf-field="task"
            value={taskRef}
            onChange={(event) => setTaskRef(event.target.value)}
            disabled={!taskOptions.length}
          >
            {taskOptions.length ? taskOptions.map((option) => (
              <option value={option.ref} key={option.ref}>{option.title || option.ref}</option>
            )) : (
              <option value="">{t('project.fNoTask')}</option>
            )}
          </select>
        </Field>
      </div>

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
          disabled={busy || !taskOptions.length}
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

const ProjectForms = ({ panel, view, slug, currencies, t, onClose, onDone, onSwitchPanel }) => {
  if (!panel) return null
  if (panel === 'campaign') {
    return <CampaignForm view={view} t={t} onDone={onDone} onClose={onClose} />
  }
  if (panel === 'task') {
    return (
      <TaskForm
        view={view}
        t={t}
        currencies={currencies}
        onDone={onDone}
        onClose={onClose}
        onNeedCampaign={() => onSwitchPanel?.('campaign')}
      />
    )
  }
  if (panel === 'subtask') {
    return (
      <SubtaskForm
        view={view}
        slug={slug}
        t={t}
        onDone={onDone}
        onClose={onClose}
        onNeedCampaign={() => onSwitchPanel?.('campaign')}
      />
    )
  }
  return null
}

export default ProjectForms
