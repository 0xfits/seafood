import React, { useState } from 'react'
import { useAuth } from '../../auth-context'
import { patchProject } from './project-api'
import {
  buildWagePayload,
  currencyOptions,
  errsOfPatchFailure,
  validateWageForm,
} from './project-edit-form'
import ProjectModalShell, { FieldError, useProjectFormState } from './ProjectModalShell'

// ============================================================================
// 【设定工资标准】模态框（★ Kevin 2026-10-23 ③ 新框）
// ----------------------------------------------------------------------------
// 字段集**恰 4 个**（键集真源 `project-edit-form.WAGE_PAYLOAD_KEYS`）：
//   ① 每次工资 `wage_batt_per_claim`（batt，> 0）
//   ② 领取间隔 `wage_interval_hours`（1–100 小时）
//   ③ 次币 `wage_cid` + ④ 次币金额 `wage_currency_amount`（**成对**：清空 = 两键 null；金额允许 0）
//
// 为什么单独立框（而不是留在【招工】里）：这三项是**工资标准**，改一次**全员生效**
// （含已在职成员 —— 下一笔领取就按新标准算），而【招工】管的是「这次还能招几个 / 谁能来」。
// 混在一个框里 ⇒ 管理员改名额时会顺手改动在职者工资而不自知。故：
//   · 标题与提示行都明说「新老成员统一标准」（`project.wageStdTitle` / `project.wageStdHint`）；
//   · 载荷只带**变化键**（`buildWagePayload`）；无变化 ⇒ 零请求关闭。
//
// 口径：
//   · 可见性同另两框（父组件判：已登录 ∧ 未 ended ∧（owner ∨ manage_tasks））；挂载 = 打开。
//   · 409/400 ⇒ `EDIT_REASON_MAP` 框内字段级内联（batt/interval 各自字段，次币类 reason 落 `currency` 行）：
//     `PROJECT_INTERVAL_INVALID` ⇒ interval、`PROJECT_WAGE_CURRENCY_PAIR_REQUIRED` / `PROJECT_WAGE_CID_INVALID` /
//     `PROJECT_WAGE_AMOUNT_INVALID` ⇒ currency、`project_ended_frozen` ⇒ 表单级。框不关闭。
//   · 外壳/滚动锁/几何 = `ProjectModalShell`（与另两框同一份实现）。
// ============================================================================

/** 项目写面标识：只认数字主键 `project_id`（缺失才回落 `snowflake_id`，与 /wage 同式）。 */
const projectKeyOf = (row) => String(row?.project_id ?? row?.snowflake_id ?? '')

const ProjectWageStandardModal = ({ view, currencies, t, onClose, onSaved }) => {
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
    const nextErrs = validateWageForm(form, t)
    if (Object.keys(nextErrs).length > 0) {
      setErrs(nextErrs)
      return
    }
    const body = buildWagePayload(view, form)
    if (Object.keys(body).length === 0) {
      requestClose() // 无变化 ⇒ 零请求关闭
      return
    }
    setBusy(true)
    setErrs({})
    try {
      await patchProject(projectRef, body, user)
      onSaved?.({ kind: 'ok', text: t('project.wageStdSaved') })
    } catch (error) {
      setErrs(errsOfPatchFailure(error, t))
    } finally {
      setBusy(false)
    }
  }

  const secondary = currencyOptions(currencies)

  return (
    <ProjectModalShell
      kind="project-wage-std"
      projectRef={projectRef}
      title={t('project.wageStdTitle')}
      busy={busy}
      labels={{ save: t('common.save'), saving: t('wage.saving'), cancel: t('wage.cancel') }}
      onClose={requestClose}
      onSubmit={submit}
    >
      {/* 统一口径提示：本框改动对**新老成员一视同仁**（含已在职者的下一笔领取）。
          放在字段之前 —— 管理员先看到「这是全员生效」，再动手改数。 */}
      <p className="sf-project-edit-hint" data-sf-edit-hint="wageStd">{t('project.wageStdHint')}</p>

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
      {/* 次币金额**允许 0** ⇒ 提示行明说「填 0 = 不发次币」（复用既有键，零新增） */}
      <p className="sf-project-edit-hint" data-sf-edit-hint="amount">{t('project.recruitZeroHint')}</p>

      {errs.general ? (
        <p className="sf-project-edit-err" data-sf-edit-err="general" role="alert">{errs.general}</p>
      ) : null}
    </ProjectModalShell>
  )
}

export default ProjectWageStandardModal
