import React, { useState } from 'react'
import { useAuth } from '../../auth-context'
import { RECRUIT_MIN_DAYS_OPTIONS, isRecruitMinDaysKnown } from '../../recruit-min-days'
import { patchProject } from './project-api'
import {
  buildRecruitPayload,
  errsOfPatchFailure,
  slotsReadoutOf,
  validateRecruitForm,
} from './project-edit-form'
import ProjectModalShell, { FieldError, useProjectFormState } from './ProjectModalShell'

// ============================================================================
// 【招工】模态框（Kevin 2026-10-22③ 自【编辑项目】移出；2026-10-23 ② **改增量**）
// ----------------------------------------------------------------------------
// 字段集**恰 2 个**（键集真源 `project-edit-form.RECRUIT_PAYLOAD_KEYS`）：
//   ① 本次新增名额 `newSlots`（**增量**：填 2 ⇒ 目标 = 当前已招 + 2；留空 ⇒ 不改名额）
//   ② 注册天数条件 `recruit_min_account_days`（四选一 1/7/30/365；不匹配值 ⇒ 预选「一天」+ 提示行）
// 工资 / 间隔 / 次币已移入【设定工资标准】（`ProjectWageStandardModal`）—— 那三项是**全员口径**，
// 与「这次要招几个人」不是同一类决定，混在一个框里会导致「改名额顺手把在职者的工资也改了」。
//
// 为什么是增量：后端 `headcount` 是**绝对目标**（`applyProjectVerb` 用 `hired >= headcount` 判满），
// 前端只说人话（「再加 2 个名额」），换算在 `slotsReadoutOf` 一处做、载荷只发绝对目标。
// 界面必须带读数行「当前已招 X · 新增 Y ⇒ 目标 X+Y」，否则管理员无法核对换算结果。
//
// 口径：
//   · 可见性同【编辑项目】（父组件判：已登录 ∧ 未 ended ∧（owner ∨ manage_tasks））；挂载 = 打开。
//   · 与另两框**互不嵌套、各自提交**：本框只带招工键（`buildRecruitPayload` = 只带变化项），
//     无变化 ⇒ 零请求关闭；成功 ⇒ `onSaved({kind:'ok', text, hint})`（父组件关框 + 提示 + 静默重拉）。
//   · 409/400 ⇒ `EDIT_REASON_MAP` 框内字段级内联（人数下限 409 落 `newSlots` 行下方），框不关闭；
//     未登记 reason ⇒ 表单级兜底句。
//   · 外壳/滚动锁/几何 = `ProjectModalShell`（与另两框同一份实现）。
// ============================================================================

/** 项目写面标识：只认数字主键 `project_id`（缺失才回落 `snowflake_id`，与 /wage 同式）。 */
const projectKeyOf = (row) => String(row?.project_id ?? row?.snowflake_id ?? '')

const ProjectRecruitModal = ({ view, t, onClose, onSaved }) => {
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
      // 409 `project_headcount_below_hired` 的服务端字段名是 `headcount`（绝对名额），
      // 本框的输入叫「新增名额」⇒ 别名落到 `newSlots` 行下方（不静默丢弃文案）。
      const next = errsOfPatchFailure(error, t)
      if (next.headcount) {
        next.newSlots = next.headcount
        delete next.headcount
      }
      setErrs(next)
    } finally {
      setBusy(false)
    }
  }

  // 存量行不在四档（历史 0 / 90）⇒ 预选「一天」+ 提示行（仅不匹配时在场）
  const minDaysLegacy = !isRecruitMinDaysKnown(view?.recruit_min_account_days ?? 0)
  // 实时读数（与载荷换算同一函数）：Y 空 ⇒ 目标 = 当前名额（名额不变）
  const slots = slotsReadoutOf(view, form.newSlots)

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
          <span className="sf-project-field-label">{t('project.newSlotsLabel')}</span>
          <input
            className="sf-project-input"
            data-sf-edit="newSlots"
            inputMode="numeric"
            placeholder="2"
            value={form.newSlots}
            onChange={(event) => setField('newSlots', event.target.value)}
          />
          <FieldError field="newSlots" text={errs.newSlots} />
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

      {/* 增量读数行（判据要素）：当前已招 X · 新增 Y ⇒ 目标 X+Y；Y 空 ⇒ 显示「—」且目标 = 当前名额。
          数据属性供单测 / 探针取证（hired / add / target 三值各自可断言）。 */}
      <p
        className="sf-project-edit-hint"
        data-sf-edit-hint="slots"
        data-sf-hired={String(slots.hired)}
        data-sf-add={slots.add == null ? '' : String(slots.add)}
        data-sf-target={String(slots.target)}
      >
        {t('project.slotsReadout', {
          hired: slots.hired,
          add: slots.add == null ? '—' : slots.add,
          target: slots.target,
        })}
      </p>
      <p className="sf-project-edit-hint" data-sf-edit-hint="newSlots">{t('project.newSlotsHint')}</p>

      {minDaysLegacy ? (
        <p className="sf-project-edit-hint" data-sf-edit-hint="minDays">
          {Number(view?.recruit_min_account_days ?? 0) === 0
            ? t('bountyProject.minDaysNoGate')
            : t('bountyProject.minDaysLegacy', { n: Number(view?.recruit_min_account_days ?? 0) })}
        </p>
      ) : null}

      {errs.general ? (
        <p className="sf-project-edit-err" data-sf-edit-err="general" role="alert">{errs.general}</p>
      ) : null}
    </ProjectModalShell>
  )
}

export default ProjectRecruitModal
