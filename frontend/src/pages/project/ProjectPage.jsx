import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLangPath, getLanguageFromUrl } from '../../utils'
import { isReservedProjectSlug } from '../../project-slug'
import { applyToProject, fetchProjectCurrencies, fetchProjectDetail, rechargeProjectVault } from './project-api'
import { writeFailNotice } from './project-error'
import { isWageProjectEditAdmin, loadListingEditAdmin } from '../item/item-edit-access'
import NotFoundPage from '../NotFoundPage'
import ProjectNestedList from './ProjectNestedList'
import ProjectForms from './ProjectForms'
import ProjectEditModal from './ProjectEditModal'
import ProjectRecruitModal from './ProjectRecruitModal'
import ProjectAvatar from './ProjectAvatar'
import './project.css'

// ============================================================================
// 项目页 `/:slug`（Kevin 2026-10-21 · /wage 卡可点击进项目页的落点）
// ----------------------------------------------------------------------------
// 形态：项目头（标题 / 状态 / 已招 X/Y / 工资行）→ **详细介绍**（description pre-wrap）→
//       「活动与任务」**概况层**（每条活动 = 活动名链 `/campaign/:ref` + 状态徽标；其下只列
//       任务摘要行：标题链 `/task/:taskId` + 状态 + 完成奖 `$` —— **零操作钮、零子任务清单**）→
//       操作区（**仅 owner 或管理员**可见：【编辑项目】/【发布活动】）。
//
// ★ Kevin 2026-10-22②：**项目头像写口搬到本页头部**（`ProjectAvatar`）——头行最左 48px 圆形头像
//   （有 `avatar_url` ⇒ img，无 ⇒ 项目名首字彩底）；owner ∨ 管理员在头像右下角见相机钮（
//   `aria-label = project.avatarChange`），流水线 = 客户端压缩（共享 `src/image-compress.js`，与发布页
//   同一份）→ `POST /api/media` → `PATCH /api/project/:projectId {avatar_url:'/api/media/<id>'}` →
//   静默重拉；已有头像时另有【恢复默认】（行内二次确认 ⇒ `{avatar_url:null}`）。**ended 项目仍可改**
//   （纯展示属性）；普通用户只见头像、DOM 里零入口零 input。
//
// ★ Kevin 2026-10-22：**任务/子任务全部操作入口迁 `/campaign/:ref`**（发布任务 / 发布子任务 /
//   上线/下线 / 子任务编辑 / 删除）——本页对活动与任务只剩**概况**（`ProjectNestedList`
//   概况层，零写口）；具体内容与操作都去活动页。项目级操作（【编辑项目】/【发布活动】）留本页。
//
// ★ Kevin 2026-10-21②：**项目编辑搬进本页**（/wage 卡不再有【编辑】，只保留整卡链接与
//   加入/领工资）——
//   · 【编辑项目】可见性 = 已登录 ∧ 项目未 ended ∧（本人 `owner_uid` ∨ `manage_tasks` 管理员）；
//     判定与 /wage 旧口径逐字同式（`item/item-edit-access` 的三键 fail-safe）；
//   · 点开 = **模态框**（`ProjectEditModal`：背板 + 卡片面板；背板/✕/Esc 关闭零请求；
//     提交只带变化字段 → `PATCH /api/project/:projectId`；409/400 在框内内联、框不关）；
//   · 成功 ⇒ 关框 + `load({silent:true})` 重拉（标题/详情/工资行即时更新）+ 页内成功提示；
//   · 字段构建/校验/载荷/`EDIT_REASON_MAP` 的单一真源 = `project-edit-form.js`（自 WagePage 移出）。
//
// ★ Kevin 2026-10-22③：**招工面独立成框**（【编辑项目】旁的【招工】）——
//   · 6 个招工字段（人数 / 注册天数四选一 / 每次工资 / 领取间隔 / 次币 + 金额）自【编辑项目】
//     移入 `ProjectRecruitModal`；两框**互不嵌套、各自提交**，共用外壳 `ProjectModalShell`
//     与 `project-edit-form.js`（载荷键集互斥：`PROJECT_PAYLOAD_KEYS` / `RECRUIT_PAYLOAD_KEYS`）；
//   · 两入口同闸（同一个 `allowEntry`）、移动到 390 也不溢出（`.sf-project-actions` 本就换行）；
//   · **改 slug 后自愈**：PATCH 成功且地址变化 ⇒ `navigate('/'+新 slug, {replace:true})`，
//     由 slug 驱动的 effect 重拉新地址（旧 ref 不再请求），框关 + 成功提示 —— 旧地址不停留 404。
//
// 硬口径：
//   · `:slug` 路由注册在 App.jsx 内层 `<Routes>` **末位、catch-all 之前**；保留段
//     （`RESERVED_PROJECT_SEGMENTS`，wage/task/… 二十一段）⇒ **不渲染项目页**，
//     直接落 catch-all 同款 `<NotFoundPage />`（不发请求、不白屏）；
//   · slug 无效 / 项目不存在（读口 404）⇒ 同样落 `<NotFoundPage />` 提示页；
//   · 读口 = `GET /api/project/:ref`（三形态：snowflake / 数字 id / slug，原样透传）；
//   · 写口（编辑项目 / 发布活动）闸 = manage_tasks 管理员 ∨ **project owner**（项目未 ended）——
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
  // 打开中的面板：'campaign'（顶部【发布活动】）。任务 / 子任务表单已迁 `/campaign/:ref`，
  // 本页不再有卡内面板（概况层零写口）。
  const [openPanel, setOpenPanel] = useState(null)
  const [editOpen, setEditOpen] = useState(false) // 【编辑项目】模态框（挂载 = 打开）
  const [recruitOpen, setRecruitOpen] = useState(false) // 【招工】模态框（挂载 = 打开）
  const [notice, setNotice] = useState(null) // { kind: 'ok' | 'err', text }
  // ★ 2026-10-22：加入 / 切换（权限无关，所有登录用户可见）
  const [joinBusy, setJoinBusy] = useState(false)
  const [confirmSwitch, setConfirmSwitch] = useState(false) // 切换行内二次确认（不做 window.confirm）
  // ★ Kevin 2026-10-23 ②：项目金库区（余额行人人可见；充值输入只给登录用户）
  const [vaultAmounts, setVaultAmounts] = useState({}) // cid ⇒ 金额文本（每币种一行独立输入）
  const [vaultBusy, setVaultBusy] = useState('') // 充值中的 cid（空 = 无在途请求）
  const [vaultNotice, setVaultNotice] = useState(null) // { cid, kind, text, code, reason, status }
  const navigate = useNavigate()

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
  // ★ 头像闸（Kevin 2026-10-22）：owner ∨ 管理员即可，**不看 status** —— 头像纯展示属性，
  //   已结束项目也该能换图 / 恢复默认（服务端 PATCH 未对 ended 封 `avatar_url`）。
  const canEditAvatar = Boolean(view) && (isOwner || isAdmin)

  // ★ 2026-10-22：在职三态（只认详情读口 `GET /api/project/:ref` 的登录态加性四键）：
  //   `my_role==='hired'` ⇒ 【已在职】置灰；`my_current_project_id` 有值且非本项目 ⇒ 【切换到此项目】；
  //   四键在场且都不在职 ⇒ 【加入此项目】；键缺省（匿名）⇒ 不渲染入口（登录后才见）。
  const myRole = typeof view?.my_role === 'string' ? view.my_role : null
  const hiredHere = myRole === 'hired'
  const currentProjectId = typeof view?.my_current_project_id === 'string' ? view.my_current_project_id.trim() : ''
  const hiredElsewhere = Boolean(currentProjectId) && !hiredHere
  // 确认文案里「当前在职 X」的 X：标题缺失时退到 `#主键`（不硬编「未知」，也不显空引号）
  const elsewhereTitle = String(view?.my_current_project_title || '').trim() || `#${currentProjectId}`
  const showJoinEntry = isAuthenticated && Boolean(view)

  const batt = num(view?.wage_batt_per_claim)
  const hours = num(view?.wage_interval_hours)
  const amount = num(view?.wage_currency_amount)
  const symbol = symbols[String(view?.wage_cid ?? '')] || ''

  // ★ Kevin 2026-10-23 ②：金库区（读口加性 `vault[]` ⇒ 人人可读的余额面）
  //   · 行形状 `{cid, symbol, balance}`；`balance` 是**后端已换算的人类可读十进制串** ⇒ 前端零换算；
  //   · **空金库但有次币腿** ⇒ 合成一条 0 余额行（否则登录用户无处充钱：领取缺行即 409
  //     `project_wage_pool_insufficient`，却看不到任何「给哪个币充值」的入口）；
  //   · 空金库 ∧ 无次币腿（未设次币 / 金额 0）⇒ 整区不渲染（没有币种就没有余额可言）。
  const vaultRowsFromApi = (Array.isArray(view?.vault) ? view.vault : [])
    .filter((row) => row && row.cid != null)
    .map((row) => ({
      cid: String(row.cid),
      symbol: String(row.symbol ?? symbols[String(row.cid)] ?? ''),
      balance: String(row.balance ?? '0'),
    }))
  const wageCidKey = view?.wage_cid == null || view?.wage_cid === '' ? '' : String(view.wage_cid)
  const hasSecondaryLeg = wageCidKey !== '' && amount > 0
  const vaultRows = vaultRowsFromApi.length > 0
    ? vaultRowsFromApi
    : (hasSecondaryLeg ? [{ cid: wageCidKey, symbol: symbols[wageCidKey] || '', balance: '0' }] : [])
  const showVault = Boolean(view) && vaultRows.length > 0

  // 入口统一闸：未登录 / 无权限 ⇒ 页内提示、零请求（按钮本就只对 owner ∨ 管理员渲染，
  // 这里是时序 / 状态漂移的双保险）。两个入口（【发布活动】/【编辑项目】）共用。
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

  const closePanel = () => setOpenPanel(null)

  // 同一入口再点 = 收起；打开 = 只留【发布活动】面板。
  const openEntry = () => {
    if (!allowEntry()) return
    setNotice(null)
    setOpenPanel((prev) => (prev === 'campaign' ? null : 'campaign'))
  }

  const handleDone = (result) => {
    // 写口成功（或建成功但未上线）⇒ 先给结论、再静默重读（列表 / 嵌套立即反映新行）
    setNotice(result)
    closePanel()
    load({ silent: true })
  }

  /**
   * 项目编辑成功（Kevin 2026-10-22③）：
   *   · **地址改过**（`result.slug` = 新 slug）⇒ `navigate('/'+新 slug, {replace:true})`；
   *     跳转后由 `slug` 变化驱动的 `load` effect 重拉新地址数据 —— 旧地址不再请求、不留 404
   *     （此前旧 ref 重拉 ⇒ 读口 404 ⇒ 落「页面不存在」）；
   *   · 地址未改 ⇒ 原地静默重拉（标题 / 详情 / 状态即时更新）。
   * 两路都关框 + 页内成功提示。
   */
  const handleEditSaved = (result) => {
    setEditOpen(false)
    setNotice(result)
    if (result?.slug && result.slug !== slug) {
      navigate(buildLangPath(`/${result.slug}`, lang), { replace: true })
      return
    }
    load({ silent: true })
  }

  /** 招工成功：关框 + 页内成功提示 + 静默重拉（人数 / 工资行 / 已招 X/Y 即时更新）。 */
  const handleRecruitSaved = (result) => {
    setRecruitOpen(false)
    setNotice(result)
    load({ silent: true })
  }

  /** 打开编辑框：同一入口再点不切换（框是模态，打开期间不渲染入口自身状态）；无权限 ⇒ 页内提示零请求。 */
  const openEdit = () => {
    if (!allowEntry()) return
    setNotice(null)
    setOpenPanel(null)
    setRecruitOpen(false)
    setEditOpen(true)
  }

  /** 打开招工框：闸同【编辑项目】（同一个 `allowEntry`）；两框互斥（开一框先关另一框，不嵌套）。 */
  const openRecruit = () => {
    if (!allowEntry()) return
    setNotice(null)
    setOpenPanel(null)
    setEditOpen(false)
    setRecruitOpen(true)
  }

  /**
   * 加入 / 切换（★ 2026-10-22）：
   *   · 未在职 ⇒ `POST /api/project/:id/apply`（body `{}`）；
   *   · 在职于其它项目 ⇒ 先**行内二次确认**（文案 = 当前在职 X + 领取间隔从此刻重算），确认后带 `{switch:true}`；
   *   · 已在职于本项目 ⇒ 入口置灰，不触发请求。
   * 成功 ⇒ 页内成功提示 + 静默重拉（三态即时翻转；切换后本项目 `my_hired_at` = now ⇒ 间隔重算由服务端给）；
   * 失败 ⇒ `writeFailNotice` 内联（reason 四闸已映射为中文；其余吐机读码，不谎报成功）。
   */
  const submitApply = async ({ switching }) => {
    if (!isAuthenticated) {
      setNotice({ kind: 'err', text: t('project.needLogin') })
      return
    }
    if (!view) return
    setJoinBusy(true)
    setNotice(null)
    try {
      const result = await applyToProject(view.project_id, switching ? { switch: true } : {}, userRef.current)
      setConfirmSwitch(false)
      const title = String(result?.project?.title || view.title || '').trim()
      setNotice({
        kind: 'ok',
        text: switching
          ? t('project.switchedOk', { title })
          : t('wage.joinedToast', { title }),
      })
      await load({ silent: true })
    } catch (error) {
      setConfirmSwitch(false)
      setNotice({ ...writeFailNotice(error, t, 'project.joinFailDetail'), kind: 'err' })
    } finally {
      setJoinBusy(false)
    }
  }

  /**
   * 金库充值（★ Kevin 2026-10-23 ②）：每币种一行独立输入 + 一个【充值】钮（`data-sf-action="vault-recharge"`）。
   *   · 前置：未登录 ⇒ 只读（入口不渲染，这里是双保险）；金额须 > 0 十进制串 ⇒ 否则**零请求**内联；
   *   · 成功 ⇒ 清空该行输入 + 内联 ok 提示（新余额用服务端回值）+ **静默重拉**（余额行即时更新）；
   *   · 失败 ⇒ `writeFailNotice` 内联（`VAULT_RECHARGE_INSUFFICIENT` / `PROJECT_VAULT_AMOUNT_INVALID` /
   *     `PROJECT_VAULT_CID_INVALID` 三条机读码已登记中文；未登记 ⇒ 机读码原文，不假翻译），
   *     元素带 `data-sf-err-code / -reason / -status` 供探针取证；不谎报成功、不重拉。
   */
  const submitRecharge = async (cid) => {
    const key = String(cid)
    if (!isAuthenticated) {
      setVaultNotice({ cid: key, kind: 'err', text: t('project.needLogin'), code: '', reason: '', status: null })
      return
    }
    if (!view || vaultBusy) return
    const amountText = String(vaultAmounts[key] ?? '').trim()
    const amountNum = Number(amountText)
    if (amountText === '' || !Number.isFinite(amountNum) || amountNum <= 0) {
      setVaultNotice({
        cid: key, kind: 'err', text: t('project.vaultErrAmountInvalid'),
        code: 'PROJECT_VAULT_AMOUNT_INVALID', reason: '', status: null,
      })
      return
    }
    setVaultBusy(key)
    setVaultNotice(null)
    try {
      const result = await rechargeProjectVault(
        view.project_id,
        { cid: Number(key), amount: amountText },
        userRef.current,
      )
      const rowSymbol = vaultRows.find((row) => row.cid === key)?.symbol || String(result?.symbol ?? '')
      setVaultAmounts((prev) => ({ ...prev, [key]: '' }))
      setVaultNotice({
        cid: key,
        kind: 'ok',
        text: t('project.vaultRechargeOk', {
          amount: amountText,
          symbol: rowSymbol,
          balance: String(result?.balance ?? ''),
        }),
      })
      await load({ silent: true })
    } catch (error) {
      const fail = writeFailNotice(error, t, 'project.vaultFailDetail')
      const hasDetail = Boolean(fail.code || fail.reason) && fail.status !== null
      setVaultNotice({ cid: key, kind: 'err', ...fail, text: hasDetail ? fail.text : t('project.vaultErrGeneral') })
    } finally {
      setVaultBusy('')
    }
  }

  /** 入口点击：切换态先展开行内确认（零请求），其余直接提交。 */
  const onJoinEntry = () => {
    if (!isAuthenticated) {
      setNotice({ kind: 'err', text: t('project.needLogin') })
      return
    }
    if (hiredHere) return
    if (hiredElsewhere) {
      setNotice(null)
      setConfirmSwitch(true)
      return
    }
    submitApply({ switching: false })
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
                {/* 头像 + 标题成组（左），状态徽标最右：`space-between` 只分两组，标题不被推中 */}
                <div className="sf-project-head-main">
                  <ProjectAvatar
                    view={view}
                    canEdit={canEditAvatar}
                    user={user}
                    t={t}
                    onChanged={() => load({ silent: true })}
                  />
                  <h1 className="sf-panel-title" data-sf-m="project-title">{view?.title || ''}</h1>
                </div>
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

            {/* 项目金库（★ Kevin 2026-10-23 ② · 迁移 0073）：紧跟项目头 ⇒ 余额是项目的公开招工信息，
                放在「能不能招到人」的正下方。每个 `vault[]` 一行 = 币符号 + 余额（后端已换算十进制串）；
                **登录用户**每行另有金额输入 + 【充值】（`data-sf-action="vault-recharge"`）⇒
                `POST /api/project/:id/vault/recharge`；未登录只读余额（无 input、无按钮）。
                空金库 ∧ 无次币腿 ⇒ 整区不渲染（没有币种就没有余额）。 */}
            {showVault ? (
              <section className="sf-panel sf-project-vault" data-sf-m="project-vault" data-sf-authed={isAuthenticated ? '1' : '0'}>
                <h2 className="sf-project-section-title" data-sf-m="project-vault-title">{t('project.vaultTitle')}</h2>
                <ul className="sf-project-vault-list">
                  {vaultRows.map((row) => {
                    const busy = vaultBusy === row.cid
                    return (
                      <li className="sf-project-vault-row" data-sf-m="project-vault-row" data-sf-cid={row.cid} key={row.cid}>
                        <span className="sf-project-vault-balance" data-sf-m="project-vault-balance">
                          {t('project.vaultLine', { symbol: row.symbol, balance: row.balance })}
                        </span>
                        {isAuthenticated ? (
                          <span className="sf-project-vault-recharge">
                            <label className="sf-project-field sf-project-vault-field">
                              <span className="sf-project-field-label">{t('project.vaultRechargeLabel')}</span>
                              <input
                                className="sf-project-input"
                                data-sf-m="project-vault-amount"
                                data-sf-cid={row.cid}
                                inputMode="decimal"
                                value={vaultAmounts[row.cid] ?? ''}
                                onChange={(event) => setVaultAmounts((prev) => ({ ...prev, [row.cid]: event.target.value }))}
                              />
                            </label>
                            <button
                              type="button"
                              className="sf-project-btn"
                              data-sf-m="project-vault-recharge"
                              data-sf-action="vault-recharge"
                              data-sf-cid={row.cid}
                              disabled={busy}
                              onClick={() => submitRecharge(row.cid)}
                            >{busy ? t('project.vaultRecharging') : t('project.vaultRechargeBtn')}</button>
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                {vaultNotice?.text ? (
                  <p
                    className={`sf-project-notice is-${vaultNotice.kind}`}
                    data-sf-m="project-vault-notice"
                    data-sf-kind={vaultNotice.kind}
                    data-sf-cid={vaultNotice.cid}
                    data-sf-err-code={vaultNotice.code || ''}
                    data-sf-err-reason={vaultNotice.reason || ''}
                    data-sf-err-status={vaultNotice.status == null ? '' : String(vaultNotice.status)}
                    role="alert"
                  >{vaultNotice.text}</p>
                ) : null}
              </section>
            ) : null}

            <section className="sf-panel sf-project-desc" data-sf-m="project-desc">
              <h2 className="sf-project-section-title" data-sf-m="project-desc-title">{t('project.descriptionTitle')}</h2>
              {view?.description ? (
                <p className="sf-project-desc-text" data-sf-m="project-desc-text">{view.description}</p>
              ) : (
                <p className="sf-foot-note" data-sf-m="project-desc-empty">{t('project.descEmpty')}</p>
              )}
            </section>

            {/* 「活动与任务」概况层（Kevin 2026-10-22）：每条活动 = 活动名链 `/campaign/:ref`
                + 状态徽标；其下只列任务摘要行（标题链 `/task/:taskId` + 状态 + 完成奖 $）。
                零操作钮、零子任务清单、零表单 —— 具体内容与全部操作都在活动页。 */}
            <ProjectNestedList
              campaigns={view?.campaigns}
              t={t}
              lang={lang}
            />

            {/* 加入 / 切换 / 已在职（Kevin 2026-10-23）：与项目级管理入口分开渲染 ——
                对**所有登录用户**可见（管理区只给 owner/admin）。三态只认详情读口的登录态加性键；
                切换态先展开行内二次确认（零请求），确认后才带 `{switch:true}` 提交。 */}
            {showJoinEntry ? (
              <section className="sf-panel sf-project-join" data-sf-m="project-join">
                <div className="sf-project-actions">
                  {hiredHere ? (
                    <button
                      type="button"
                      className="sf-project-btn"
                      data-sf-m="project-entry-hired"
                      data-sf-action="hired"
                      disabled
                    >{t('project.alreadyHired')}</button>
                  ) : confirmSwitch ? (
                    <>
                      <span className="sf-foot-note" data-sf-m="project-switch-confirm-text">
                        {t('project.switchConfirm', { title: elsewhereTitle })}
                      </span>
                      <button
                        type="button"
                        className="sf-project-btn is-primary"
                        data-sf-m="project-entry-switch-confirm"
                        data-sf-action="switch"
                        disabled={joinBusy}
                        onClick={() => submitApply({ switching: true })}
                      >{t('project.switchConfirmOk')}</button>
                      <button
                        type="button"
                        className="sf-project-btn"
                        data-sf-m="project-entry-switch-cancel"
                        onClick={() => setConfirmSwitch(false)}
                      >{t('wage.cancel')}</button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="sf-project-btn is-primary"
                      data-sf-m={hiredElsewhere ? 'project-entry-switch' : 'project-entry-join'}
                      data-sf-action={hiredElsewhere ? 'switch' : 'join'}
                      disabled={joinBusy}
                      onClick={onJoinEntry}
                    >{t(hiredElsewhere ? 'project.switchEntry' : 'project.joinEntry')}</button>
                  )}
                </div>
                {!canManage && notice?.text ? (
                  <p
                    className={`sf-project-notice is-${notice.kind}`}
                    data-sf-m="project-form-notice"
                    data-sf-kind={notice.kind}
                    role="alert"
                  >{notice.text}</p>
                ) : null}
              </section>
            ) : null}

            {canManage ? (
              <section className="sf-panel sf-project-manage" data-sf-m="project-manage">
                <h2 className="sf-project-section-title" data-sf-m="project-manage-title">{t('project.manageTitle')}</h2>
                {/* 操作区（项目级操作留本页）：【编辑项目】+【招工】（两个独立模态框）+【发布活动】；
                    任务 / 子任务操作已迁 `/campaign/:ref`（概况层零写口）。三钮同闸、`:is-primary` 只在
                    发布活动上 ⇒ 390 档换行也不抢主次（`.sf-project-actions` 本就 `flex-wrap`）。 */}
                <div className="sf-project-actions">
                  <button
                    type="button"
                    className="sf-project-btn"
                    data-sf-m="project-entry-edit"
                    onClick={openEdit}
                  >{t('wage.editTitle')}</button>
                  <button
                    type="button"
                    className="sf-project-btn"
                    data-sf-m="project-entry-recruit"
                    onClick={openRecruit}
                  >{t('project.entryRecruit')}</button>
                  <button
                    type="button"
                    className="sf-project-btn is-primary"
                    data-sf-m="project-entry-campaign"
                    aria-expanded={openPanel === 'campaign'}
                    onClick={openEntry}
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
                  onClose={closePanel}
                  onDone={handleDone}
                />
              </section>
            ) : null}

            {/* 两个项目级模态框（Kevin 2026-10-22③ 拆框）：【编辑项目】= 项目面
                （标题/说明/地址/状态）；【招工】= 招工面（6 键）。互不嵌套、各自提交；
                均 portal 到 body，遮罩盖住悬浮菜单；挂载 = 打开、卸载 = 关闭。 */}
            {canManage && editOpen ? (
              <ProjectEditModal
                view={view}
                t={t}
                onClose={() => setEditOpen(false)}
                onSaved={handleEditSaved}
              />
            ) : null}
            {canManage && recruitOpen ? (
              <ProjectRecruitModal
                view={view}
                currencies={currencies}
                t={t}
                onClose={() => setRecruitOpen(false)}
                onSaved={handleRecruitSaved}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default ProjectPage
