import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { getLanguageFromUrl } from '../../utils'
import { isReservedProjectSlug } from '../../project-slug'
import { fetchProjectCurrencies, fetchProjectDetail } from './project-api'
import { isWageProjectEditAdmin, loadListingEditAdmin } from '../item/item-edit-access'
import NotFoundPage from '../NotFoundPage'
import ProjectNestedList from './ProjectNestedList'
import ProjectForms from './ProjectForms'
import './project.css'

// ============================================================================
// 项目页 `/:slug`（Kevin 2026-10-21 · /wage 卡可点击进项目页的落点）
// ----------------------------------------------------------------------------
// 形态：项目头（标题 / 状态 / 已招 X/Y / 工资行）→ **详细介绍**（description pre-wrap）→
//       嵌套活动列表（该项目的 campaigns/tasks/subtasks，与 campaign 详情同族卡片）→
//       操作区（**仅 owner 或管理员**可见：【发布 campaign】【发布任务】【发布子任务】）。
//
// 硬口径：
//   · `:slug` 路由注册在 App.jsx 内层 `<Routes>` **末位、catch-all 之前**；保留段
//     （`RESERVED_PROJECT_SEGMENTS`，wage/task/… 二十一段）⇒ **不渲染项目页**，
//     直接落 catch-all 同款 `<NotFoundPage />`（不发请求、不白屏）；
//   · slug 无效 / 项目不存在（读口 404）⇒ 同样落 `<NotFoundPage />` 提示页；
//   · 读口 = `GET /api/project/:ref`（三形态：snowflake / 数字 id / slug，原样透传）；
//   · 写口（三个入口）闸 = manage_tasks 管理员 ∨ **project owner**（项目未 ended）——
//     前端只做入口显隐与提示，真正的闸在服务端；未授权点入口 ⇒ 页内提示、零请求；
//   · 管理员三键判定复用 `item/item-edit-access`（同一份 `/api/user` 载荷 + 模块缓存 +
//     fail-safe：取不到 ⇒ 只按 owner_uid 判，绝不误判管理员，同 WagePage 体例）；
//   · 时间 / 工资口径禁 ISO 直出：工资行走 `wage.*` 既有文案，时间窗走 campaign-util 格式化。
// ============================================================================

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const ProjectPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const params = useParams()
  const { isAuthenticated, user } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const slug = String(params?.slug ?? '').trim()
  // 保留段判定提到取数之前（Kevin 2026-10-21 · 派单判据④）：命中 ⇒ **三个 effect 全部短路**，
  // 零请求直落提示页。若只靠渲染期 early-return，effect 仍会先发读口（保留段白白打一次 API）。
  const reserved = isReservedProjectSlug(slug)

  const [state, setState] = useState({ phase: 'loading', view: null })
  const [symbols, setSymbols] = useState({})
  const [currencies, setCurrencies] = useState([])
  const [adminFlags, setAdminFlags] = useState(null)
  const [openPanel, setOpenPanel] = useState(null) // 'campaign' | 'task' | 'subtask' | null
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text }

  const userRef = useRef(user)
  userRef.current = user
  const reqSeq = useRef(0)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!slug || reserved) return
    const seq = reqSeq.current + 1
    reqSeq.current = seq
    if (!silent) setState((prev) => ({ ...prev, phase: 'loading' }))
    try {
      const view = await fetchProjectDetail(slug, userRef.current)
      if (reqSeq.current !== seq) return
      if (!view || typeof view !== 'object') {
        setState({ phase: 'notfound', view: null })
        return
      }
      setState({ phase: 'ready', view })
    } catch (error) {
      if (reqSeq.current !== seq) return
      setState({ phase: error?.status === 404 ? 'notfound' : 'error', view: null })
    }
  }, [slug, reserved])

  useEffect(() => {
    load()
  }, [load])

  // 次币符号（公开读面；失败 ⇒ 空表，工资行退化为只显示 batt 口径，不阻断页面）。
  useEffect(() => {
    if (reserved) return undefined
    let cancelled = false
    fetchProjectCurrencies(userRef.current)
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload) ? payload : (payload?.rows || [])
        const list = Array.isArray(rows) ? rows : []
        const map = {}
        for (const row of list) {
          if (row?.cid != null && row?.symbol) map[String(row.cid)] = String(row.symbol)
        }
        setSymbols(map)
        setCurrencies(list) // 次币下拉（发布任务表单）与符号映射同源，一次请求两用
      })
      .catch(() => {
        if (cancelled) return
        setSymbols({})
        setCurrencies([])
      })
    return () => { cancelled = true }
  }, [reserved])

  // 管理员三键（`/api/user`）：逐字复用 item-edit-access 加载器（同 WagePage 体例）。
  useEffect(() => {
    let alive = true
    if (reserved || !isAuthenticated) {
      setAdminFlags(null)
      return undefined
    }
    loadListingEditAdmin(userRef.current)
      .then((flags) => { if (alive) setAdminFlags(flags) })
      .catch(() => { if (alive) setAdminFlags(null) })
    return () => { alive = false }
  }, [isAuthenticated, reserved])

  // 保留段 ⇒ 不渲染项目页、不发请求，直接落 catch-all 同款提示页（派单判据④）。
  if (reserved) {
    return <NotFoundPage />
  }

  if (state.phase === 'notfound') {
    return <NotFoundPage />
  }

  const view = state.phase === 'ready' ? state.view : null
  const status = String(view?.status || '')
  const statusKey = status === 'recruiting' ? 'project.statusRecruiting'
    : status === 'working' ? 'project.statusWorking'
      : status === 'ended' ? 'project.statusEnded'
        : null
  const uid = user?.uID ?? user?.uid
  const isOwner = Boolean(
    isAuthenticated && uid != null && uid !== '' && String(view?.owner_uid ?? '') === String(uid)
  )
  const isAdmin = isWageProjectEditAdmin(adminFlags)
  // 入口闸（前端显隐）：owner ∨ 管理员，且项目未 ended（owner 写面的服务端闸同式）。
  const canManage = Boolean(view) && status !== 'ended' && (isOwner || isAdmin)

  const batt = num(view?.wage_batt_per_claim)
  const hours = num(view?.wage_interval_hours)
  const amount = num(view?.wage_currency_amount)
  const symbol = symbols[String(view?.wage_cid ?? '')] || ''

  const openEntry = (panel) => {
    // 双保险：入口按钮本就只对 owner / 管理员渲染；未授权点入口（时序 / 状态漂移）⇒ 页内提示、零请求。
    if (!isAuthenticated) {
      setNotice({ kind: 'err', text: t('project.needLogin') })
      return
    }
    if (!canManage) {
      setNotice({ kind: 'err', text: t('project.noPermission') })
      return
    }
    setNotice(null)
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  return (
    <div className="sf-layout sf-project-page" data-sf-m="project-page" data-sf-slug={slug}>
      <div className="sf-layout-main">
        {state.phase === 'loading' ? (
          <p className="sf-foot-note" data-sf-m="project-loading">{t('wage.loading')}</p>
        ) : state.phase === 'error' ? (
          <div className="sf-panel" data-sf-m="project-error" role="alert">
            <p>{t('project.loadFailed')}</p>
            <button type="button" className="sf-project-btn" data-sf-m="project-retry" onClick={() => load()}>
              {t('project.retry')}
            </button>
          </div>
        ) : (
          <>
            <section className="sf-panel sf-project-head" data-sf-m="project-head">
              <div className="sf-project-head-row">
                <h1 className="sf-panel-title" data-sf-m="project-title">{view?.title || ''}</h1>
                {statusKey ? (
                  <span
                    className={`sf-project-badge is-${status || 'unknown'}`}
                    data-sf-m="project-status"
                    data-sf-state={status}
                  >{t(statusKey)}</span>
                ) : null}
              </div>
              <div className="sf-project-meta">
                <span data-sf-m="project-headcount">
                  {t('project.headcountLine', { hired: num(view?.hired_count), total: num(view?.headcount) })}
                </span>
                <span className="sf-project-pay" data-sf-m="project-wage">
                  {t('wage.wageLine', { batt, hours })}
                  {amount > 0 && symbol ? (
                    <span className="sf-project-pay-extra" data-sf-m="project-wage-extra">
                      {t('wage.wageExtra', { amount, symbol })}
                    </span>
                  ) : null}
                </span>
              </div>
            </section>

            <section className="sf-panel sf-project-desc" data-sf-m="project-desc">
              <h2 className="sf-project-section-title" data-sf-m="project-desc-title">{t('project.descriptionTitle')}</h2>
              {view?.description ? (
                <p className="sf-project-desc-text" data-sf-m="project-desc-text">{view.description}</p>
              ) : (
                <p className="sf-foot-note" data-sf-m="project-desc-empty">{t('project.descEmpty')}</p>
              )}
            </section>

            {/* 嵌套活动列表（campaigns → tasks → subtasks，与 campaign 详情同族卡片、只读） */}
            <ProjectNestedList
              campaigns={view?.campaigns}
              t={t}
              lang={lang}
              symbols={symbols}
            />

            {canManage ? (
              <section className="sf-panel sf-project-manage" data-sf-m="project-manage">
                <h2 className="sf-project-section-title" data-sf-m="project-manage-title">{t('project.manageTitle')}</h2>
                <div className="sf-project-actions">
                  <button
                    type="button"
                    className="sf-project-btn is-primary"
                    data-sf-m="project-entry-campaign"
                    aria-expanded={openPanel === 'campaign'}
                    onClick={() => openEntry('campaign')}
                  >{t('project.entryCampaign')}</button>
                  <button
                    type="button"
                    className="sf-project-btn is-primary"
                    data-sf-m="project-entry-task"
                    aria-expanded={openPanel === 'task'}
                    onClick={() => openEntry('task')}
                  >{t('project.entryTask')}</button>
                  <button
                    type="button"
                    className="sf-project-btn is-primary"
                    data-sf-m="project-entry-subtask"
                    aria-expanded={openPanel === 'subtask'}
                    onClick={() => openEntry('subtask')}
                  >{t('project.entrySubtask')}</button>
                </div>
                {notice?.text && !openPanel ? (
                  <p
                    className={`sf-project-notice is-${notice.kind}`}
                    data-sf-m="project-form-notice"
                    data-sf-kind={notice.kind}
                    role="alert"
                  >
                    {notice.text}
                  </p>
                ) : null}
                <ProjectForms
                  panel={openPanel}
                  view={view}
                  slug={slug}
                  currencies={currencies}
                  t={t}
                  onClose={() => setOpenPanel(null)}
                  onSwitchPanel={(panel) => { setNotice(null); setOpenPanel(panel) }}
                  onDone={(result) => {
                    // 写口成功（或建成功但未上线）⇒ 先给结论、再静默重读（列表 / 嵌套立即反映新行）
                    setNotice(result)
                    setOpenPanel(null)
                    load({ silent: true })
                  }}
                />
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default ProjectPage
