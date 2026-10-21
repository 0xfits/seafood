import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { getLanguageFromUrl } from '../../utils'
import { isReservedProjectSlug } from '../../project-slug'
import { fetchProjectCurrencies, fetchProjectDetail } from './project-api'
import { isWageProjectEditAdmin, loadListingEditAdmin } from '../item/item-edit-access'
import { refOf } from '../campaign/campaign-util'
import NotFoundPage from '../NotFoundPage'
import ProjectNestedList from './ProjectNestedList'
import ProjectForms from './ProjectForms'
import './project.css'

// ============================================================================
// 项目页 `/:slug`（Kevin 2026-10-21 · /wage 卡可点击进项目页的落点）
// ----------------------------------------------------------------------------
// 形态：项目头（标题 / 状态 / 已招 X/Y / 工资行）→ **详细介绍**（description pre-wrap）→
//       嵌套活动列表（该项目的 campaigns/tasks/subtasks，与 campaign 详情同族卡片）→
//       操作区（**仅 owner 或管理员**可见：顶部只留【发布活动】；【发布任务】在每张活动卡内、
//       【发布子任务】在每张任务卡内，点击就地开表单且目标预选锁定）。
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
  // 打开中的面板 + 其锁定目标：'campaign'（顶部）| 'task'（活动卡）| 'subtask'（任务卡）
  // 活动卡入口 ⇒ `openCampaignRef` = 该卡 ref；任务卡入口 ⇒ 再带 `openTaskRef` = 该卡 task_id。
  const [openPanel, setOpenPanel] = useState(null)
  const [openCampaignRef, setOpenCampaignRef] = useState('')
  const [openTaskRef, setOpenTaskRef] = useState('')
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

  // 入口统一闸：未登录 / 无权限 ⇒ 页内提示、零请求（按钮本就只对 owner ∨ 管理员渲染，
  // 这里是时序 / 状态漂移的双保险）。三个入口（顶部活动、卡内任务、卡内子任务）共用。
  const allowEntry = () => {
    if (!isAuthenticated) {
      setNotice({ kind: 'err', text: t('project.needLogin') })
      return false
    }
    if (!canManage) {
      setNotice({ kind: 'err', text: t('project.noPermission') })
      return false
    }
    return true
  }

  const closePanels = () => {
    setOpenPanel(null)
    setOpenCampaignRef('')
    setOpenTaskRef('')
  }

  // 同一入口再点 = 收起；换卡 / 换面板 = 只留一个面板（表单就地渲染在所属卡片内）。
  const openEntry = (panel, campaignRef = '', taskRef = '') => {
    if (!allowEntry()) return
    const same = openPanel === panel && openCampaignRef === campaignRef && openTaskRef === taskRef
    setNotice(null)
    if (same) {
      closePanels()
      return
    }
    setOpenPanel(panel)
    setOpenCampaignRef(campaignRef)
    setOpenTaskRef(taskRef)
  }

  const handleDone = (result) => {
    // 写口成功（或建成功但未上线）⇒ 先给结论、再静默重读（列表 / 嵌套立即反映新行）
    setNotice(result)
    closePanels()
    load({ silent: true })
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

            {/* 嵌套活动列表（campaigns → tasks → subtasks，与 campaign 详情同族卡片）
                · 任务 / 子任务入口**下沉到卡片头**：每张活动卡一枚【发布任务】、每张任务卡一枚
                  【发布子任务】；点开就地渲染表单，目标预选锁定（无选择器）。
                · 无活动 ⇒ 无活动卡 ⇒ 任务入口自然缺席；活动无任务 ⇒ 无任务卡 ⇒ 子任务入口缺席。 */}
            <ProjectNestedList
              campaigns={view?.campaigns}
              t={t}
              lang={lang}
              symbols={symbols}
              canManage={canManage}
              panel={openPanel}
              openCampaignRef={openCampaignRef}
              openTaskRef={openTaskRef}
              slug={slug}
              currencies={currencies}
              onEntryTask={(campaign, ref) => openEntry('task', ref || refOf(campaign))}
              onEntrySubtask={(campaign, task) => openEntry('subtask', refOf(campaign), String(task?.task_id ?? ''))}
              onClose={closePanels}
              onDone={handleDone}
            />

            {canManage ? (
              <section className="sf-panel sf-project-manage" data-sf-m="project-manage">
                <h2 className="sf-project-section-title" data-sf-m="project-manage-title">{t('project.manageTitle')}</h2>
                {/* 顶部操作区只留【发布活动】：任务 / 子任务入口在各卡片头右侧 */}
                <div className="sf-project-actions">
                  <button
                    type="button"
                    className="sf-project-btn is-primary"
                    data-sf-m="project-entry-campaign"
                    aria-expanded={openPanel === 'campaign'}
                    onClick={() => openEntry('campaign')}
                  >{t('project.entryCampaign')}</button>
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
                  panel={openPanel === 'campaign' ? 'campaign' : null}
                  view={view}
                  slug={slug}
                  currencies={currencies}
                  t={t}
                  onClose={closePanels}
                  onDone={handleDone}
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
