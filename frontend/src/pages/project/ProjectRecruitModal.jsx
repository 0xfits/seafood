import React, { useState } from 'react'
import { useAuth } from '../../auth-context'
import { RECRUIT_MIN_DAYS_OPTIONS, isRecruitMinDaysKnown } from '../../recruit-min-days'
import { patchProject } from './project-api'
import { buildRecruitPayload, currencyOptions, errsOfPatchFailure, validateRecruitForm } from './project-edit-form'
import ProjectModalShell, { FieldError, useProjectFormState } from './ProjectModalShell'

// ============================================================================
// 【招工】模态框（Kevin 2026-10-22③：自【编辑项目】**移出 6 个招工字段**，独立成框）
// ----------------------------------------------------------------------------
// 字段集**恰 6 个**（键集真源 `project-edit-form.RECRUIT_PAYLOAD_KEYS`）：
//   ① 招工人数 headcount
//   ② 注册天数条件 recruit_min_account_days（四选一 1/7/30/365；不匹配值 ⇒ 预选「一天」+ 提示行）
//   ③ 每次工资 wage_batt_per_claim
//   ④ 领取间隔 wage_interval_hours（1–100）
//   ⑤ 次币 wage_cid + ⑥ 次币金额 wage_currency_amount（**成对**：清空 = 两键 null）
//
// 口径：
//   · 可见性同【编辑项目】（父组件判：已登录 ∧ 未 ended ∧（owner ∨ manage_tasks））；挂载 = 打开。
//   · 与【编辑项目】**互不嵌套、各自提交**：本框只带招工键（`buildRecruitPayload` = 只带变化项），
//     无变化 ⇒ 零请求关闭；成功 ⇒ `onSaved({kind:'ok', text})`（父组件关框 + 提示 + 静默重拉）。
//   · 409/400 ⇒ `EDIT_REASON_MAP` 框内字段级内联（人数下限 409 落 headcount、次币对 400 落 currency），
//     框不关闭；未登记 reason ⇒ 表单级兜底句。
//   · 外壳/滚动锁/几何 = `ProjectModalShell`（与【编辑项目】同一份实现）。
// ============================================================================

/** 项目写面标识：只认数字主键 `project_id`（缺失才回落 `snowflake_id`，与 /wage 同式）。 */
const projectKeyOf = (row) => String(row?.project_id ?? row?.snowflake_id ?? '')

const ProjectRecruitModal = ({ view, currencies, t, onClose, onSaved }) => {
  const { user } = useAuth()
  const { form, errs, setErrs, setField } = useProjectFormState(view)
  const [busy, setBusy] = useState(false)
  const projectRef = projectKeyOf(view)

  const requestClose = () => {
    if (busy) return
    onClose?.()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const nextErrs = validateRecruitForm(form, t)
    if (Object.keys(nextErrs).length > 0) {
      setErrs(nextErrs)
      return
    }
    const body = buildRecruitPayload(view, form)
    if (Object.keys(body).length === 0) {
      requestClose() // 无变化 ⇒ 零请求关闭
      return
    }
    setBusy(true)
    setErrs({})
    try {
      await patchProject(projectRef, body, user)
      onSaved?.({ kind: 'ok', text: t('project.recruitSaved') })
    } catch (error) {
      setErrs(errsOfPatchFailure(error, t))
    } finally {
      setBusy(false)
    }
  }

  const secondary = currencyOptions(currencies)
  // 存量行不在四档（历史 0 / 90）⇒ 预选「一天」+ 提示行（仅不匹配时在场）
  const minDaysLegacy = !isRecruitMinDaysKnown(view?.recruit_min_account_days ?? 0)

  return (
    <ProjectModalShell
      kind="project-recruit"
      projectRef={projectRef}
      title={t('project.recruitTitle')}
      busy={busy}
      labels={{ save: t('common.save'), saving: t('wage.saving'), cancel: t('wage.cancel') }}
      onClose={requestClose}
      onSubmit={submit}
    >
      <div className="sf-project-row-grid">
        <label className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.headcount')}</span>
          <input
            className="sf-project-input"
            data-sf-edit="headcount"
            inputMode="numeric"
            value={form.headcount}
            onChange={(event) => setField('headcount', event.target.value)}
          />
          <FieldError field="headcount" text={errs.headcount} />
        </label>
        <label className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.minDays')}</span>
          {/* 注册天数条件 = 四选一 select（value = 天数 1/7/30/365，常量真源 `src/recruit-min-days.js`，
              与 `/wage` 项目卡编辑表单同源）；预选回落「一天」（存量 0 / 90 等非四档值）⇒ 另有提示行。 */}
          <select
            className="sf-project-input"
            data-sf-edit="minDays"
            value={form.minDays}
            onChange={(event) => setField('minDays', event.target.value)}
          >
            {RECRUIT_MIN_DAYS_OPTIONS.map((opt) => (
              <option key={opt.days} value={String(opt.days)}>{t(`bountyProject.${opt.key}`)}</option>
            ))}
          </select>
          <FieldError field="minDays" text={errs.minDays} />
        </label>
      </div>

      {minDaysLegacy ? (
        <p className="sf-project-edit-hint" data-sf-edit-hint="minDays">
          {Number(view?.recruit_min_account_days ?? 0) === 0
            ? t('bountyProject.minDaysNoGate')
            : t('bountyProject.minDaysLegacy', { n: Number(view?.recruit_min_account_days ?? 0) })}
        </p>
      ) : null}

      <div className="sf-project-row-grid">
        <label className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.battPerClaim')}</span>
          <input
            className="sf-project-input"
            data-sf-edit="batt"
            inputMode="decimal"
            value={form.batt}
            onChange={(event) => setField('batt', event.target.value)}
          />
          <FieldError field="batt" text={errs.batt} />
        </label>
        <label className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.intervalHours')}</span>
          <input
            className="sf-project-input"
            data-sf-edit="interval"
            inputMode="numeric"
            value={form.interval}
            onChange={(event) => setField('interval', event.target.value)}
          />
          <FieldError field="interval" text={errs.interval} />
        </label>
      </div>

      <div className="sf-project-row-grid">
        <label className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.currency')}</span>
          <select
            className="sf-project-input"
            data-sf-edit="cid"
            value={form.cid}
            onChange={(event) => setField('cid', event.target.value)}
          >
            <option value="">{t('bountyProject.noCurrency')}</option>
            {secondary.map((opt) => (
              <option key={opt.cid} value={opt.cid}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.currencyAmount')}</span>
          <input
            className="sf-project-input"
            data-sf-edit="amount"
            inputMode="decimal"
            value={form.amount}
            disabled={form.cid === ''}
            onChange={(event) => setField('amount', event.target.value)}
          />
        </label>
      </div>
      <FieldError field="currency" text={errs.currency} />
      {/* ★ Kevin 2026-10-23 ①：次币金额**允许 0** ⇒ 提示行明说「填 0 = 不发次币」
          （新键 `project.recruitZeroHint`；四语齐备）。位于金额输入之下、错误行之上。 */}
      <p className="sf-project-edit-hint" data-sf-edit-hint="amount">{t('project.recruitZeroHint')}</p>

      {errs.general ? (
        <p className="sf-project-edit-err" data-sf-edit-err="general" role="alert">{errs.general}</p>
      ) : null}
    </ProjectModalShell>
  )
}

export default ProjectRecruitModal
