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
//   ① 每次工资 `wage_batt_per_claim`（batt）—— ★ Kevin 2026-10-24：**只读派生读数**（不再手输）
//   ② 领取间隔 `wage_interval_hours`（1–100 小时）—— 滑块 + 手输（单轨联动，见下）
//   ③ 次币 `wage_cid` + ④ 次币金额 `wage_currency_amount`（**成对**：清空 = 两键 null；金额允许 0）
//
// ★ Kevin 2026-10-24【单轨联动滑块】：① 与 ② 合成**一张输入卡**（上下结构）：
//   · 领取间隔 = `<input type=range>`（值域 1–100 整数，**拖动吸附**到 9 个档位
//     2/4/6/8/12/24/48/72/100）＋ 同卡一个数字手输框（任意 1–100 整数，**不吸附**）；
//     手输值不落档位 ⇒ 滑块视觉停在**最接近的档位**，真值以手输为准（`sliderPositionOf`）；
//   · 每次工资 = 领取间隔 × ⚡1（每小时等效工资**恒** ⚡1）⇒ 只读，随拖动 / 手输实时重算；
//   · 卡内一行锚定说明「每小时等效工资 ⚡1（恒定）」（`project.wageRateAnchor`）。
//
// 防静默改写的硬口径（历史行必须不被顺手改工资）：
//   · 表单初值 batt = **行原值**（`editFormOf`，不预派生）—— 否则历史行（速率 ≠ ⚡1/h）一打开
//     就被判成「有变化」，保存即静默改写工资；
//   · 行速率 ≠ ⚡1/h ⇒ 卡内额外显一行「历史速率 ⚡X/h」（`project.wageLegacyRate`，X 保留原精度），
//     batt 读数保持行原值；**用户一旦拖滑块或改间隔** ⇒ 才按 ⚡1/h 重算 batt（此时才发该键）；
//   · 无变化 ⇒ 零请求关框（既有行为不退化）；手输越界（空 / 0 / <1 / >100 / 非整数）⇒
//     字段级 `bountyProject.intervalInvalid`、零 PATCH（拖滑块本身不可能越界）。
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

/** 滑块**档位停靠**（9 档，升序）：拖动吸附到这些值；手输不受限（任意 1–100 整数）。 */
export const INTERVAL_GEARS = [2, 4, 6, 8, 12, 24, 48, 72, 100]

/** 合法间隔（1–100 整数 ⇒ 数字；否则 null）。`'4'` ⇒ 4；`''` / `'0'` / `'101'` / `'1.5'` ⇒ null。 */
const intervalNumOf = (raw) => {
  const text = String(raw ?? '').trim()
  if (!/^[0-9]+$/.test(text)) return null
  const n = Number(text)
  return n >= 1 && n <= 100 ? n : null
}

/** 最接近的档位（**并列取上档** ⇒ 向右拖必定前进一档，不会卡在两档之间原地不动）。 */
const nearestGear = (n) => {
  let best = INTERVAL_GEARS[0]
  let bestGap = Infinity
  for (const gear of INTERVAL_GEARS) {
    const gap = Math.abs(gear - n)
    if (gap <= bestGap) {
      best = gear
      bestGap = gap
    }
  }
  return best
}

/**
 * 滑块视觉位置：真值（手输）优先，滑块只是**显示**。
 *   · 落在档位上 ⇒ 原值；不落档位 ⇒ 最近档位（如 9 ⇒ 8、7 ⇒ 8）；
 *   · 越界 / 空 / 非数字 ⇒ 夹到 1–100 后取最近档（滑块不能"无位置"，错误由 interval 字段行报）。
 */
const sliderPositionOf = (raw) => {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n)) return INTERVAL_GEARS[0]
  const clamped = Math.min(100, Math.max(1, Math.round(n)))
  return INTERVAL_GEARS.includes(clamped) ? clamped : nearestGear(clamped)
}

/**
 * 行速率（每小时等效工资）⇒ 提示用文本；行速率**恰** ⚡1/h ⇒ null（无提示）。
 * 派生口径恒定 ⚡1/h ⇒ 判据 = `batt === interval × 1`。X **保留原精度**（不取整）：
 * `toPrecision(12)` 只为消掉浮点尾噪（0.30000000000000004），不做业务舍入。
 */
const legacyRateOf = (row) => {
  const batt = Number(row?.wage_batt_per_claim)
  const hours = Number(row?.wage_interval_hours)
  if (!Number.isFinite(batt) || !Number.isFinite(hours) || hours <= 0) return null
  if (Math.abs(batt - hours) < 1e-9) return null
  return String(Number((batt / hours).toPrecision(12)))
}

const ProjectWageStandardModal = ({ view, currencies, t, onClose, onSaved }) => {
  const { user } = useAuth()
  const { form, errs, setErrs, setField } = useProjectFormState(view)
  const [busy, setBusy] = useState(false)
  // 是否已由用户「接管」间隔（拖滑块 / 手输）—— 未接管前 batt 保持行原值（历史速率不得被静默改写）
  const [rateTouched, setRateTouched] = useState(false)
  const projectRef = projectKeyOf(view)
  const legacyRate = legacyRateOf(view)

  const requestClose = () => {
    if (busy) return
    onClose?.()
  }

  /**
   * 间隔写入口（拖动与手输共用）：写 interval ⇒ **合法时**同步派生 batt = String(interval)（⚡1/h）。
   * 派生只在 1–100 整数上发生：越界 / 空 / 非整数时**不动 batt** —— 否则「间隔填 0」会顺手把
   * 每次工资也写成 0，同屏两条错误且载荷语义被放大（`validateWageForm` 已单独拦 interval）。
   */
  const applyInterval = (raw) => {
    setField('interval', raw)
    const n = intervalNumOf(raw)
    if (n != null) setField('batt', String(n))
    setRateTouched(true) // 用户已接管 ⇒ 历史速率提示退场（此后工资按 ⚡1/h 口径）
  }

  /** 拖滑块：吸附到最近档位（滑块值域 1–100，本身不可能越界）。 */
  const onIntervalRange = (event) => {
    applyInterval(String(nearestGear(Number(event.target.value))))
  }

  /** 手输：原样收（不吸附；越界/非整数由提交时的字段级校验拦下）。 */
  const onIntervalInput = (event) => {
    applyInterval(event.target.value)
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

      <div className="sf-project-wage-card" data-sf-m="project-wage-card">
        {/* ① 领取间隔：滑块（吸附档位）+ 同卡手输（不吸附）。手输值才是真值，滑块只按最近档显示。 */}
        <div className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.intervalHours')}</span>
          <div className="sf-project-wage-slider-row">
            <input
              className="sf-project-range"
              type="range"
              data-sf-edit="interval-range"
              min="1"
              max="100"
              step="1"
              value={sliderPositionOf(form.interval)}
              onChange={onIntervalRange}
              aria-label={t('bountyProject.intervalHours')}
            />
            <input
              className="sf-project-input sf-project-wage-num"
              data-sf-edit="interval"
              inputMode="numeric"
              value={form.interval}
              onChange={onIntervalInput}
              aria-label={t('bountyProject.intervalHours')}
            />
          </div>
          <FieldError field="interval" text={errs.interval} />
        </div>

        {/* ② 每次工资 = 领取间隔 × ⚡1（**只读派生读数**；不再手输） */}
        <div className="sf-project-field">
          <span className="sf-project-field-label">{t('bountyProject.battPerClaim')}</span>
          <input
            className="sf-project-input sf-project-wage-readout"
            data-sf-edit="batt"
            readOnly
            aria-readonly="true"
            value={form.batt}
          />
          <FieldError field="batt" text={errs.batt} />
        </div>

        {/* ③ 历史速率提示（**条件渲染**：行速率 ≠ ⚡1/h 且用户尚未接管间隔）——
            点明「现在存的是 X/h」，避免用户以为滑块一动就等于原样保存。 */}
        {legacyRate && !rateTouched ? (
          <p className="sf-project-edit-hint" data-sf-edit="wage-legacy-rate">
            {t('project.wageLegacyRate', { rate: legacyRate })}
          </p>
        ) : null}

        {/* ④ 锚定说明：本卡派生口径恒定（也是用户理解「每次工资为什么跟着动」的唯一依据） */}
        <p className="sf-project-edit-hint" data-sf-edit="wage-rate-anchor">
          {t('project.wageRateAnchor')}
        </p>
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
