import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../auth-context'
import { RECRUIT_MIN_DAYS_OPTIONS, isRecruitMinDaysKnown } from '../../recruit-min-days'
import { slugFieldErrorOf } from '../../project-slug'
import { patchProject } from './project-api'
import {
  EDIT_REASON_MAP,
  buildEditPayload,
  currencyOptions,
  editFormOf,
  slugSubmitErrorOf,
  validateEditForm,
} from './project-edit-form'

// ============================================================================
// 项目编辑模态框（Kevin 2026-10-21②：编辑从 /wage 卡内**搬到项目页**，并改为模态框）
// ----------------------------------------------------------------------------
// 口径：
//   · 入口在项目页操作区【编辑项目】（可见性由父组件判：已登录 ∧ 未 ended ∧（owner ∨ manage_tasks））；
//     本组件只在该入口被点后挂载 ⇒ 挂载 = 打开、卸载 = 关闭（无 `open` 开关态可漂移）。
//   · 关闭三路（背板 / ✕ / Esc）**零请求**：只调 `onClose`，不发任何写口；打开期间背景滚动锁定
//     （`document.body.style.overflow = 'hidden'`，卸载即还原原值）。
//   · 字段复刻原卡内表单：标题 / 说明 / 招工人数 / 注册天数四选一（1/7/30/365，不匹配预选一天+提示）/
//     每次工资 batt / 领取间隔 1–100 / 次币 cid + 金额（成对、可清空）/ 项目地址 slug（实时格式+保留字）/
//     状态 recruiting⇄working（ended 不可达 —— 入口本身对 ended 不渲染）。
//   · 载荷**只带变化字段**（`project-edit-form.buildEditPayload`）；无变化 ⇒ 零请求直接关闭；
//     成功 ⇒ `onSaved({kind:'ok'})`（父组件关框 + 重拉页面数据 + 成功提示）；
//     409/400 ⇒ 按 `details.reason` 在**框内**字段级内联，框不关闭。
//   · 几何：390 全宽（面板左右 16px 内边距）、1536 居中且面板宽 ≤640；`z-index` 高于右侧悬浮菜单
//     （`.sf-fm` z-index 6 ⇒ 本框 60）；两档均不得产生横向溢出（面板 `max-width:100%` + 输入 `width:100%`）。
// ============================================================================

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 项目写面标识：只认数字主键 `project_id`（缺失才回落 `snowflake_id`，与 /wage 同式）。 */
const projectKeyOf = (row) => String(row?.project_id ?? row?.snowflake_id ?? '')

const EditError = ({ field, text }) => (
  text ? <span className="sf-project-edit-err" data-sf-edit-err={field} role="alert">{text}</span> : null
)

const ProjectEditModal = ({ view, currencies, t, onClose, onSaved }) => {
  const { user } = useAuth()
  const [form, setForm] = useState(() => editFormOf(view))
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const projectRef = projectKeyOf(view)

  // 关闭回调走 ref：Esc 监听只在挂载时注册一次（onClose 换引用不重挂监听）。
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy

  // ① 背景滚动锁定（挂载锁、卸载还原原值 —— 不覆盖宿主页面的既有 inline 值）
  useEffect(() => {
    const body = document.body
    const prev = body.style.overflow
    body.style.overflow = 'hidden'
    body.dataset.sfModalLock = '1'
    return () => {
      body.style.overflow = prev
      delete body.dataset.sfModalLock
    }
  }, [])

  // ② Esc 关闭（零请求）；提交在途时忽略，避免关框与响应竞争
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event?.key !== 'Escape') return
      event.stopPropagation()
      if (busyRef.current) return
      closeRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const requestClose = () => {
    if (busy) return
    onClose?.()
  }

  /** 背板点击 = 关闭：只认背板自身（面板内点击冒泡到此一律忽略）。 */
  const onBackdropDown = (event) => {
    if (event.target !== event.currentTarget) return
    requestClose()
  }

  const setField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // 次币两键联动：选「无」⇒ 定额一并清空（后端两键同空同非空）
      if (field === 'cid' && String(value) === '') next.amount = ''
      return next
    })
    const errField = field === 'cid' || field === 'amount' ? 'currency' : field
    setErrs((prev) => {
      if (!prev[errField]) return prev
      const next = { ...prev }
      delete next[errField]
      return next
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    // slug 前置校验：格式 / 保留字 / 清空已设地址 ⇒ 框内内联，不空发请求
    const slugErr = slugSubmitErrorOf(view, form, t)
    if (slugErr) {
      setErrs({ slug: slugErr })
      return
    }
    const nextErrs = validateEditForm(form, t)
    if (Object.keys(nextErrs).length > 0) {
      setErrs(nextErrs)
      return
    }
    const body = buildEditPayload(view, form)
    if (Object.keys(body).length === 0) {
      // 无变化 ⇒ 零请求关闭（「只带变化字段」口径下没有可发的键）
      requestClose()
      return
    }
    setBusy(true)
    setErrs({})
    try {
      await patchProject(projectRef, body, user)
      onSaved?.({ kind: 'ok', text: t('wage.editSaved') })
    } catch (error) {
      const details = error?.details && typeof error.details === 'object' ? error.details : null
      const reason = typeof details?.reason === 'string' ? details.reason : ''
      const mapped = EDIT_REASON_MAP[reason]
      if (mapped) {
        const text = t(mapped.key, { hired: num(details?.hired_count, 0) })
        setErrs(mapped.field ? { [mapped.field]: text } : { general: text })
      } else {
        setErrs({ general: t('wage.editFailed') })
      }
    } finally {
      setBusy(false)
    }
  }

  const slugLive = slugFieldErrorOf(form.slug)
  const statusOptions = form.status === 'working' ? ['working', 'recruiting'] : ['recruiting', 'working']
  const secondary = currencyOptions(currencies)

  const node = (
    <div className="sf-project-modal" data-sf-m="project-edit" data-sf-project={projectRef}>
      {/* 背板：遮罩 + 关闭面（点背板 = 关闭，零请求） */}
      <div
        className="sf-project-modal-backdrop"
        data-sf-m="project-edit-backdrop"
        onMouseDown={onBackdropDown}
        aria-hidden="true"
      />
      <div
        className="sf-project-modal-panel"
        data-sf-m="project-edit-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-project-edit-title"
      >
        <div className="sf-project-modal-head">
          <h2 className="sf-project-modal-title" id="sf-project-edit-title" data-sf-m="project-edit-title">
            {t('wage.editTitle')}
          </h2>
          <button
            type="button"
            className="sf-project-modal-close"
            data-sf-m="project-edit-close"
            aria-label={t('wage.cancel')}
            onClick={requestClose}
          >✕</button>
        </div>

        <form className="sf-project-form" data-sf-m="project-edit-form" noValidate onSubmit={submit}>
          <label className="sf-project-field">
            <span className="sf-project-field-label">{t('bountyProject.title')}</span>
            <input
              className="sf-project-input"
              data-sf-edit="title"
              maxLength={200}
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
            />
            <EditError field="title" text={errs.title} />
          </label>

          <label className="sf-project-field">
            <span className="sf-project-field-label">{t('bountyProject.description')}</span>
            <textarea
              className="sf-project-input"
              data-sf-edit="description"
              rows={3}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
            <EditError field="description" text={errs.description} />
          </label>

          {/* 项目地址（slug）：用户可填的项目地址名（页面规范形 `/<slug>`）；实时校验格式与保留字
              （单一真源 `src/project-slug.js`），冲突由后端 400 `SLUG_TAKEN` 框内内联提示。 */}
          <label className="sf-project-field">
            <span className="sf-project-field-label">{t('project.slugLabel')}</span>
            <input
              className="sf-project-input"
              data-sf-edit="slug"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              value={form.slug}
              onChange={(event) => setField('slug', event.target.value)}
            />
            {errs.slug ? (
              <EditError field="slug" text={errs.slug} />
            ) : slugLive ? (
              <span className="sf-project-edit-err" data-sf-edit-err="slug" role="alert">
                {t(slugLive === 'reserved' ? 'project.errSlugReserved' : 'project.errSlugFormat')}
              </span>
            ) : null}
            <span className="sf-project-edit-hint" data-sf-edit-hint="slug">{t('project.slugHint')}</span>
          </label>

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
              <EditError field="headcount" text={errs.headcount} />
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
              <EditError field="minDays" text={errs.minDays} />
            </label>
          </div>

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
              <EditError field="batt" text={errs.batt} />
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
              <EditError field="interval" text={errs.interval} />
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
          <EditError field="currency" text={errs.currency} />

          <label className="sf-project-field">
            <span className="sf-project-field-label">{t('wage.fieldStatus')}</span>
            <select
              className="sf-project-input"
              data-sf-edit="status"
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{t(s === 'working' ? 'common.ongoing' : 'wage.statusRecruiting')}</option>
              ))}
            </select>
            <EditError field="status" text={errs.status} />
          </label>

          {/* 存量行不在四档（历史 0 / 90）⇒ 预选「一天」+ 提示行（仅不匹配时在场） */}
          {!isRecruitMinDaysKnown(view?.recruit_min_account_days ?? 0) ? (
            <p className="sf-project-edit-hint" data-sf-edit-hint="minDays">
              {Number(view?.recruit_min_account_days ?? 0) === 0
                ? t('bountyProject.minDaysNoGate')
                : t('bountyProject.minDaysLegacy', { n: Number(view?.recruit_min_account_days ?? 0) })}
            </p>
          ) : null}

          {errs.general ? (
            <p className="sf-project-edit-err" data-sf-edit-err="general" role="alert">{errs.general}</p>
          ) : null}

          <div className="sf-project-actions">
            <button type="submit" className="sf-project-btn is-primary" data-sf-m="project-edit-save" disabled={busy}>
              {busy ? t('wage.saving') : t('common.save')}
            </button>
            <button type="button" className="sf-project-btn" data-sf-m="project-edit-cancel" onClick={requestClose} disabled={busy}>
              {t('wage.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  // 挂在 body 上：脱离页面容器（含 `sf-layout-main` 的滚动/层叠上下文），保证遮罩盖住悬浮菜单。
  return typeof document === 'undefined' ? node : createPortal(node, document.body)
}

export default ProjectEditModal
