import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import BattCheckinPanel from '../../components/BattCheckinPanel'
import { applyToWageProject, claimWage, fetchWageCurrencies, fetchWageProjects, patchWageProject } from './wage-api'
import { isWageProjectEditAdmin, loadListingEditAdmin } from '../item/item-edit-access'
import './wage.css'

// ============================================================================
// /wage · 领工资（Kevin 2026-10-20 需求②）
// ----------------------------------------------------------------------------
// 形态：一张项目卡 = 项目名 / 简述 / 招工状态（招募中·已截止）/ 已招 X/Y /
//       工资：batt N 每次（间隔 M 小时）+ 可选次币固定额；
//       主按钮 = 招募中且未入职 ⇒【加入】；已入职该项目 ⇒【领工资】。
//
// 硬口径：
//   · 「同时只能在一个项目打工」—— 已在其他项目在职 ⇒ **本卡【加入】置灰**并给提示；
//     真正的闸在服务端（部分唯一索引），前端只做提示，不替服务端做判定。
//   · 领取间隔：以行内 `next_claim_at` 为准（键在场且为未来时刻 ⇒ 置灰 + 1s 倒计时，到点自动可点）；
//     键在场且已过 / 为 null ⇒ 立即可领；**键缺席**（匿名 / 后端未透出）⇒ 可点，由服务端 400 兜底
//     （`details.reason` 映射成提示，并把 `details` 里的下次可领时间/剩余秒数接成倒计时）；不猜、不本地自算间隔。
//   · 成功 ⇒ 卡内成功提示（含到账 batt/次币数值）+ 重拉列表（取服务端新的 `next_claim_at` 重新置灰倒计时）
//     + 卡内内联提示，失败不白屏、不清列表。
//   · 卡片按钮态**只认 `my_role`**：`hired` ⇒ 卡内只有【领工资】（**不再渲染【加入】**）；
//     `none` ⇒ 【加入】；键缺席（匿名）⇒ 照常渲染【加入】、点击只给登录提示。
//   · 已加入的卡换一套配色（`is-joined` + `data-sf-joined="1"`：淡黄叠加 + 左侧 4px 强调边 +
//     标题行【已加入】徽标），与其他卡一眼可辨；未加入卡片的配色一字不动、零新主题 token。
//   · 成功 ⇒ 卡内成功提示（含到账 batt/次币数值）+ 重拉列表刷新该项目卡；失败 ⇒ 卡内内联提示，
//     不白屏、不清列表。
//   · 未登录 ⇒ **项目列表照常公开浏览**（`GET /api/project/all` 本身无闸，设计意图就是「先看招工
//     中的项目」），页顶只留一条轻提示；【加入】/【领工资】可点，点击**只弹卡内登录提示、零请求**
//     （写口一律需登录，不在前端替服务端放行）。
//   · 零 JS 断点判定：列数交给 `wage.css` 的 auto-fill 栅格（单断点 767），可见性零宽度读数。
//
// ★ Kevin 2026-10-20 指令：**电量卡并入本页顶部**（原独立页 /activities 已删）。
//   · 渲染点 = 页标题之下、项目列表之上（`data-sf-m="wage-checkin"` 包裹）；
//   · 组件自带锚点 `id="batt-checkin"`（常量 `BATT_CHECKIN_ANCHOR_ID`）与
//     `hash === '#batt-checkin'` ⇒ `scrollIntoView` 机制，深链 `/wage#batt-checkin` 仍直达电量卡；
//   · 未登录 ⇒ 组件自身返回 `null`（既有策略：不渲染、不白屏），
//     本页原有的客态轻提示 + 公开项目列表不受影响。
//
// ★ Kevin 2026-10-20 需求③：签到 UI（连续签到天数 / 【签到】/ 补签 / 断签提示）**整体下线**
//   ⇒ 本页不再出现签到按钮与「连续签到天数」文案（后端接口保留，未动）。
//   电量点阵仍在（工资累积展示依赖电量）。
//
// ★ Kevin 2026-10-20 需求④：领工资成功提示 = 到账数值 + **连续领取奖励**：
//   · 后端加性字段 `streak`（第几次连续领取）/ `bonus_amount`（本次额外随机 $ 奖励）；
//   · 两键都在且为正 ⇒ 追加一行「已连续 N 次领工资，额外奖励 $X」（`wage.streakReward`）；
//   · 键缺席 / 非正（旧后端）⇒ 静默降级为原提示，**不猜、不补 0**。
//
// ★ Kevin 2026-10-21 指令：**最高管理员可以修改任何项目的信息** ⇒ 项目卡新增【编辑】：
//   · 可见性 = 已登录 ∧ `status !== 'ended'` ∧（`owner_uid` === 本人 ∨ 管理员三键
//     `can_access_admin ∧ (is_admin ∨ permissions ∋ 'manage_tasks')`——route R7
//     `PATCH /api/project/:projectId` 的 `requireAdmin('manage_tasks')` 同式）。
//     判定复用 `item/item-edit-access.js` 的 `loadListingEditAdmin`（同一份 `/api/user`
//     三键载荷 + 模块内缓存 + 取数失败 fail-safe：取不到 ⇒ 只按 owner 判，绝不误判管理员）。
//   · 【编辑】= 小号次按钮，挂**卡片头行右侧**（状态徽标旁），不挤占【加入】/【领工资】主行；
//     表单卡内展开（文档流内推下，不遮挡签到区/列表），触控目标手机档 ≥44。
//   · 可改字段 = 标题 / 说明 / headcount（缩容低于在职 ⇒ 409 内联）/ recruit_min_account_days /
//     wage_batt_per_claim / wage_interval_hours（1–100）/ wage_cid + wage_currency_amount
//     （成对、下拉取 `GET /api/currencies`、可清空）/ status（recruiting⇄working；ended 不可达）。
//   · 载荷**只带变化字段**（两币任一侧变化 ⇒ 两键成对上送/清空）；无变化 ⇒ 零请求收起。
//   · 成功 ⇒ 收起表单 + 卡内成功提示 + 重拉列表拿新值；409/400 按 `details.reason` 字段级内联。
//   · 既有加入 / 领工资 / 倒计时行为零变化。
// ============================================================================

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 项目标识：写面只认数字主键 `project_id`（缺失才回落 `snowflake_id`）。 */
const projectKey = (row) => String(row?.project_id ?? row?.snowflake_id ?? '')

/** 时间点归一：ISO 串 / 秒级 epoch / 毫秒级 epoch 三种形态都吃，坏值 ⇒ null。 */
const parseInstant = (value) => {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const n = Number(raw)
    if (n > 1e12) return n
    if (n > 1e9) return n * 1000
    return null
  }
  const ts = Date.parse(raw)
  return Number.isFinite(ts) ? ts : null
}

/** 倒计时文本：≥1 小时 ⇒ `h:mm:ss`，否则 `m:ss`（纯数字，不引新文案）。 */
const formatRemaining = (seconds) => {
  const total = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 键存在性判别：匿名时后端对 `my_role` / `my_hired_at` / `next_claim_at` **整键缺省**
 *  ⇒ 一律用 `hasOwn` 判别，「键缺席」与「键值为 null/false」是两种不同的事（不可用 falsy 判别）。 */
const hasKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)

/**
 * 「我的在职态」：`'hired'` | `'none'` | `null`。
 *   · 行内有 `my_role` ⇒ 逐字采用（闭集外一律按 `none`，不推断）；
 *   · 无 `my_role` 但有非空 `my_hired_at` ⇒ 也是在职（契约加性键兜底，防行内只透出时间）；
 *   · 三者都缺省 ⇒ `null` = 匿名 / 后端未透出 ⇒ **不参与在职判定**（不置灰别人的卡）。
 */
const myRoleOf = (row) => {
  if (hasKey(row, 'my_role')) return String(row?.my_role || '') === 'hired' ? 'hired' : 'none'
  if (hasKey(row, 'my_hired_at') && row?.my_hired_at) return 'hired'
  return null
}

/** 服务端 `details.reason` ⇒ 文案键（未知 reason 落到动作各自的兜底句，不外泄机读码）。 */
const REASON_TEXT_KEYS = {
  WAGE_INTERVAL_NOT_REACHED: 'claimTooSoon',
  WAGE_CLAIM_TOO_SOON: 'claimTooSoon',
  CLAIM_TOO_SOON: 'claimTooSoon',
  INTERVAL_NOT_REACHED: 'claimTooSoon',
  NOT_HIRED: 'notHired',
  WAGE_NOT_HIRED: 'notHired',
  PROJECT_NOT_HIRED: 'notHired',
  ONE_PROJECT_AT_A_TIME: 'oneAtATime',
  WAGE_ALREADY_HIRED_ELSEWHERE: 'oneAtATime',
  PROJECT_FULL: 'full',
  HEADCOUNT_FULL: 'full',
  PROJECT_CLOSED: 'statusClosed',
}

/**
 * 编辑表单的 `details.reason` ⇒ { field, key }（409/400 按**字段**内联；`field: null` = 表单级）。
 * `key` = 完整 i18n 键（间隔校验复用 `bountyProject.intervalInvalid`，同字段同文案）。
 * 未登记的 reason ⇒ 表单级兜底句（`wage.editFailed`），机读码不外泄。
 */
const EDIT_REASON_MAP = {
  project_headcount_below_hired: { field: 'headcount', key: 'wage.errHeadcountBelowHired' },
  project_invalid_transition: { field: 'status', key: 'wage.errTransition' },
  project_ended_frozen: { field: null, key: 'wage.errFrozen' },
  PROJECT_TITLE_INVALID: { field: 'title', key: 'wage.errTitle' },
  PROJECT_DESCRIPTION_INVALID: { field: 'description', key: 'wage.errDescription' },
  PROJECT_HEADCOUNT_INVALID: { field: 'headcount', key: 'wage.errHeadcount' },
  PROJECT_MIN_DAYS_INVALID: { field: 'minDays', key: 'wage.errMinDays' },
  PROJECT_WAGE_BATT_INVALID: { field: 'batt', key: 'wage.errBatt' },
  PROJECT_INTERVAL_INVALID: { field: 'interval', key: 'bountyProject.intervalInvalid' },
  PROJECT_WAGE_CURRENCY_PAIR_REQUIRED: { field: 'currency', key: 'wage.errCurrencyPair' },
  PROJECT_WAGE_CID_INVALID: { field: 'currency', key: 'wage.errCurrencyInvalid' },
  PROJECT_WAGE_AMOUNT_INVALID: { field: 'currency', key: 'wage.errCurrencyAmount' },
  project_wage_currency_not_found: { field: 'currency', key: 'wage.errCurrencyInvalid' },
  project_wage_currency_not_listed: { field: 'currency', key: 'wage.errCurrencyInvalid' },
  PROJECT_STATUS_INVALID: { field: 'status', key: 'wage.errStatus' },
  NOT_SUPPORTED: { field: null, key: 'wage.editFailed' },
}

/** 非负整数文本（含 '0'；空串不算）。 */
const isIntText = (raw) => /^[0-9]+$/.test(String(raw ?? '').trim())

/**
 * 次币下拉选项：来源 = `GET /api/currencies`（公开只读）；
 * 排除平台 $（cid 1 —— 后端 `PROJECT_WAGE_CID_INVALID` 拒收，batt 本就以 $ 计价）；
 * 无符号且无名 ⇒ 不进下拉。编号只作 value 不上屏（显示 `symbol · name`）。
 */
const wageCurrencyOptions = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((row) => row?.cid != null && String(row.cid) !== '1' && (row?.symbol || row?.name))
  .map((row) => ({
    cid: String(row.cid),
    label: `${row.symbol || ''}${row.name ? `${row.symbol ? ' · ' : ''}${row.name}` : ''}`,
  }))

const WagePage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const uidKey = user?.uID ?? user?.uid ?? null

  const [list, setList] = useState({ phase: 'loading', rows: [] })
  const [busy, setBusy] = useState({}) // projectKey ⇒ 'join' | 'claim'
  const [notices, setNotices] = useState({}) // projectKey ⇒ { kind:'ok'|'err', text }
  const [claimAt, setClaimAt] = useState({}) // projectKey ⇒ 下次可领时间戳
  const [symbols, setSymbols] = useState({}) // cid ⇒ 币种符号
  const [currencyRows, setCurrencyRows] = useState([]) // 币种原始行（编辑表单次币下拉用）
  const [adminFlags, setAdminFlags] = useState(null) // `/api/user` 三键；null = 未取到 ⇒ 不做管理员特判（fail-safe）
  const [editKey, setEditKey] = useState(null) // 当前展开编辑表单的项目 key（单开；null = 全部收起）
  const [editForm, setEditForm] = useState(null) // 编辑表单值（由行派生；字段见 editFormOf）
  const [editErrs, setEditErrs] = useState({}) // 编辑表单内联错误 { field: text }（'general' = 表单级）
  const [editBusy, setEditBusy] = useState(false)
  const [clock, setClock] = useState(() => Date.now())

  // user / t 走 ref：取数 effect 的依赖收敛到原始值（同 ItemDetailPage 体例，避免语言切换重拉）。
  const userRef = useRef(user)
  const tRef = useRef(t)
  userRef.current = user
  tRef.current = t

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setList((prev) => ({ ...prev, phase: 'loading' }))
    try {
      const payload = await fetchWageProjects(userRef.current)
      const rows = Array.isArray(payload) ? payload : (payload?.rows || payload?.projects || [])
      const nextRows = Array.isArray(rows) ? rows : []
      setList({ phase: 'ready', rows: nextRows })
      // 下次可领时间以**服务端行**为准：键在场 ⇒ 采用（未来 ⇒ 置灰倒计时；已过 / null ⇒ 立即可领、
      // 清掉上一轮本地倒计时）；键缺席（匿名 / 后端未透出）⇒ 不动，避免把「没透出」读成「现在可领」。
      setClaimAt((prev) => {
        const next = { ...prev }
        for (const row of nextRows) {
          const key = projectKey(row)
          if (!key || !hasKey(row, 'next_claim_at')) continue
          const instant = parseInstant(row.next_claim_at)
          if (instant && instant > Date.now()) next[key] = instant
          else delete next[key]
        }
        return next
      })
      return nextRows
    } catch (error) {
      setList({ phase: 'error', rows: [] })
      return []
    }
  }, [])

  useEffect(() => {
    // 客态也拉：列表读口是公开面（先浏览招工中的项目），写口才需登录。
    load()
  }, [isAuthenticated, uidKey, load]) // eslint-disable-line react-hooks/exhaustive-deps -- user/t 走 ref

  // 币种符号（公开读面；失败 ⇒ 空表，卡面退化为只显示 batt 口径，不阻断页面）。
  // ★ 客态同样要取 —— 客态也渲染项目卡，次币定额（`wageExtra`）不能因为未登录就消失。
  useEffect(() => {
    let cancelled = false
    fetchWageCurrencies()
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload) ? payload : (payload?.rows || [])
        const safeRows = Array.isArray(rows) ? rows : []
        setCurrencyRows(safeRows)
        const map = {}
        for (const row of safeRows) {
          if (row?.cid != null && row?.symbol) map[String(row.cid)] = String(row.symbol)
        }
        setSymbols(map)
      })
      .catch(() => { if (!cancelled) { setCurrencyRows([]); setSymbols({}) } })
    return () => { cancelled = true }
  }, [])

  // 管理员三键（`/api/user`）：逐字复用 item-edit-access 的加载器（模块内按 uID 缓存 +
  // 并发去重 + 失败返回 null），取不到 ⇒ 只按 owner_uid 判【编辑】，绝不误判管理员。
  useEffect(() => {
    let alive = true
    if (!isAuthenticated) {
      setAdminFlags(null)
      return undefined
    }
    loadListingEditAdmin(userRef.current)
      .then((flags) => { if (alive) setAdminFlags(flags) })
      .catch(() => { if (alive) setAdminFlags(null) })
    return () => { alive = false }
  }, [isAuthenticated, uidKey]) // eslint-disable-line react-hooks/exhaustive-deps -- user 走 ref

  // 倒计时驱动：只有存在「未来」的领取时间点时才起定时器（无倒计时 ⇒ 零定时器）；
  // 到点那一次 tick 之后 `pendingClaim` 转 false ⇒ 定时器自动停，按钮同帧起可用。
  const pendingClaim = useMemo(
    () => Object.values(claimAt).some((ts) => ts > clock),
    [claimAt, clock]
  )

  useEffect(() => {
    if (!pendingClaim) return undefined
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pendingClaim])

  const hiredKey = useMemo(() => {
    // 客态没有「我」的在职行（`my_role` 整键缺省）⇒ 不参与判定（否则会拿别人的在职业态去置灰【加入】）。
    if (!isAuthenticated) return ''
    const hiredRow = list.rows.find((row) => myRoleOf(row) === 'hired')
    return hiredRow ? projectKey(hiredRow) : ''
  }, [isAuthenticated, list.rows])

  const setNotice = (key, notice) => setNotices((prev) => ({ ...prev, [key]: notice }))

  const markBusy = (key, value) => {
    setBusy((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  const reasonNotice = (error, fallbackKey) => {
    const details = error?.details
    const reason = typeof details?.reason === 'string' ? details.reason : ''
    const key = REASON_TEXT_KEYS[reason] || fallbackKey
    // 服务端若在失败体里带了下次可领时间 / 剩余秒数 ⇒ 接成倒计时（不本地猜间隔）。
    const instant = parseInstant(details?.next_claim_at ?? details?.next_claim_time ?? details?.claimable_at)
    const remaining = num(details?.claim_ready_in_seconds ?? details?.remaining_seconds, null)
    return {
      text: tRef.current(`wage.${key}`),
      at: instant || (remaining != null && remaining > 0 ? Date.now() + remaining * 1000 : null),
    }
  }

  /** 写口（加入 / 领工资）一律需登录：客态点击只弹卡内登录提示，**零请求**。 */
  const guestNotice = (key) => {
    setNotice(key, { kind: 'login', text: tRef.current('wage.loginRequired') })
  }

  const onJoin = async (row) => {
    const key = projectKey(row)
    if (!key) return
    if (!isAuthenticated) {
      guestNotice(key)
      return
    }
    markBusy(key, 'join')
    setNotice(key, null)
    try {
      await applyToWageProject(key, userRef.current)
      setNotice(key, {
        kind: 'ok',
        text: row?.title
          ? tRef.current('wage.joinedToast', { title: row.title })
          : tRef.current('wage.joined'),
      })
      await load({ silent: true })
    } catch (error) {
      const { text, at } = reasonNotice(error, 'applyFailed')
      setNotice(key, { kind: 'err', text })
      if (at) setClaimAt((prev) => ({ ...prev, [key]: at }))
    } finally {
      markBusy(key, null)
    }
  }

  const onClaim = async (row) => {
    const key = projectKey(row)
    if (!key) return
    if (!isAuthenticated) {
      guestNotice(key)
      return
    }
    markBusy(key, 'claim')
    setNotice(key, null)
    try {
      const result = await claimWage(key, userRef.current)
      const batt = num(
        result?.wage_batt ?? result?.batt_claimed ?? result?.batt_earned ?? result?.claimed_batt,
        num(row?.wage_batt_per_claim)
      )
      const amount = num(
        result?.wage_currency_amount ?? result?.currency_amount ?? result?.wage_currency_claimed,
        num(row?.wage_currency_amount)
      )
      const symbol = symbols[String(row?.wage_cid ?? '')] || ''
      const text = amount > 0 && symbol
        ? tRef.current('wage.claimedWithCurrency', { batt, amount, symbol })
        : tRef.current('wage.claimed', { batt })
      // 连续领取奖励（后端加性字段）：两键都在且为正才提示；缺键 / 非正 ⇒ 静默降级（旧后端）。
      const streak = num(result?.streak, 0)
      const bonus = num(result?.bonus_amount, 0)
      const streakText = streak > 0 && bonus > 0
        ? tRef.current('wage.streakReward', { n: streak, bonus })
        : ''
      setNotice(key, { kind: 'ok', text, streak: streakText })
      // 刷新列表拿服务端**新的** `next_claim_at`（下次可领时间的真源）。
      const refreshed = await load({ silent: true })
      const fresh = Array.isArray(refreshed) ? refreshed.find((item) => projectKey(item) === key) : null
      const fromResult = parseInstant(result?.next_claim_at ?? result?.next_claim_time ?? result?.claimable_at)
      const fromRow = fresh && hasKey(fresh, 'next_claim_at') ? parseInstant(fresh.next_claim_at) : null
      const hours = num(row?.wage_interval_hours, 0)
      const nextAt = fromResult || fromRow || (hours > 0 ? Date.now() + hours * 3600 * 1000 : null)
      setClaimAt((prev) => {
        const next = { ...prev }
        if (nextAt) next[key] = nextAt
        else delete next[key]
        return next
      })
    } catch (error) {
      const { text, at } = reasonNotice(error, 'claimFailed')
      setNotice(key, { kind: 'err', text })
      if (at) setClaimAt((prev) => ({ ...prev, [key]: at }))
    } finally {
      markBusy(key, null)
    }
  }

  // ============================ 项目卡【编辑】（owner ∨ manage_tasks 管理员）========================

  /** 行 → 表单初值（数字 / 两币字段一律字符串化；次币缺省 = '' 即「无（仅 batt）」）。 */
  const editFormOf = (row) => ({
    title: String(row?.title ?? ''),
    description: String(row?.description ?? ''),
    headcount: String(row?.headcount ?? ''),
    minDays: String(row?.recruit_min_account_days ?? 0),
    batt: String(row?.wage_batt_per_claim ?? ''),
    interval: String(row?.wage_interval_hours ?? ''),
    cid: row?.wage_cid == null || row?.wage_cid === '' ? '' : String(row.wage_cid),
    amount: row?.wage_currency_amount == null || row?.wage_currency_amount === '' ? '' : String(row.wage_currency_amount),
    status: String(row?.status || '') === 'working' ? 'working' : 'recruiting',
  })

  /** 【编辑】可见性：已登录 ∧ 非 ended ∧（本人 `owner_uid` ∨ `manage_tasks` 管理员三键）。 */
  const canEditCard = (row) => {
    if (!isAuthenticated) return false
    if (String(row?.status || '') === 'ended') return false
    const uid = user?.uID ?? user?.uid
    if (uid != null && uid !== '' && String(row?.owner_uid ?? '') === String(uid)) return true
    return isWageProjectEditAdmin(adminFlags)
  }

  const openEdit = (row) => {
    const key = projectKey(row)
    if (!key) return
    setEditKey(key)
    setEditForm(editFormOf(row))
    setEditErrs({})
    setEditBusy(false)
  }

  const closeEdit = () => {
    setEditKey(null)
    setEditForm(null)
    setEditErrs({})
    setEditBusy(false)
  }

  const setEditField = (field, value) => {
    setEditForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      // 次币两键联动：选「无」⇒ 定额一并清空（后端两键同空同非空）
      if (field === 'cid' && String(value) === '') next.amount = ''
      return next
    })
    const errField = field === 'cid' || field === 'amount' ? 'currency' : field
    setEditErrs((prev) => {
      if (!prev[errField]) return prev
      const next = { ...prev }
      delete next[errField]
      return next
    })
  }

  /** 表单校验（提交前；与后端 400 逐字段同口径，避免无用往返）。 */
  const validateEdit = (form) => {
    const errs = {}
    const title = String(form?.title ?? '').trim()
    if (!title || title.length > 200) errs.title = tRef.current('wage.errTitle')
    if (String(form?.description ?? '').length > 20000) errs.description = tRef.current('wage.errDescription')
    if (!isIntText(form?.headcount) || Number(String(form.headcount).trim()) < 1) {
      errs.headcount = tRef.current('wage.errHeadcount')
    }
    const minDays = String(form?.minDays ?? '').trim()
    if (minDays !== '' && !isIntText(minDays)) errs.minDays = tRef.current('wage.errMinDays')
    const battText = String(form?.batt ?? '').trim()
    const batt = Number(battText)
    if (battText === '' || !Number.isFinite(batt) || batt <= 0) errs.batt = tRef.current('wage.errBatt')
    const interval = Number(String(form?.interval ?? '').trim())
    if (!Number.isInteger(interval) || interval < 1 || interval > 100) {
      // 与发布项目表单同字段同文案（复用既有键，零新增）
      errs.interval = tRef.current('bountyProject.intervalInvalid')
    }
    const cid = String(form?.cid ?? '')
    const amount = String(form?.amount ?? '').trim()
    if (cid === '') {
      if (amount !== '') errs.currency = tRef.current('wage.errCurrencyPair')
    } else if (!isIntText(cid) || Number(cid) === 1) {
      errs.currency = tRef.current('wage.errCurrencyInvalid')
    } else if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      errs.currency = tRef.current('wage.errCurrencyAmount')
    }
    return errs
  }

  /**
   * 载荷 = **只带变化字段**（与行原值逐字段比对；两币任一侧变化 ⇒ 两键成对上送，
   * 清空 ⇒ 两键都 null —— 后端对「同现同缺」整包校验）。无变化 ⇒ 空对象（调用方零请求收起）。
   */
  const buildEditPayload = (row, form) => {
    const body = {}
    const nextTitle = String(form?.title ?? '').trim()
    if (nextTitle !== String(row?.title ?? '')) body.title = nextTitle
    if (String(form?.description ?? '') !== String(row?.description ?? '')) {
      body.description = String(form?.description ?? '')
    }

    const intField = (raw, orig) => {
      const text = String(raw ?? '').trim()
      if (!isIntText(text)) return undefined
      const n = Number(text)
      return n !== orig ? n : undefined
    }
    const headcount = intField(form?.headcount, num(row?.headcount, -1))
    if (headcount !== undefined) body.headcount = headcount
    // 注册天数下限：清空 = 归 0（后端对 null 同样按 0 处理；行缺键也按 0 基线，不误报变化）
    const minDaysText = String(form?.minDays ?? '').trim()
    if (isIntText(minDaysText) || minDaysText === '') {
      const minDaysVal = minDaysText === '' ? 0 : Number(minDaysText)
      if (minDaysVal !== num(row?.recruit_min_account_days, 0)) body.recruit_min_account_days = minDaysVal
    }
    const interval = intField(form?.interval, num(row?.wage_interval_hours, -1))
    if (interval !== undefined) body.wage_interval_hours = interval

    const battText = String(form?.batt ?? '').trim()
    const batt = Number(battText)
    if (battText !== '' && Number.isFinite(batt) && batt > 0 && batt !== num(row?.wage_batt_per_claim, -1)) {
      body.wage_batt_per_claim = battText
    }

    const origCid = row?.wage_cid == null || row?.wage_cid === '' ? '' : String(row.wage_cid)
    const origAmount = row?.wage_currency_amount == null || row?.wage_currency_amount === ''
      ? '' : String(row.wage_currency_amount)
    const nextCid = String(form?.cid ?? '')
    const nextAmount = String(form?.amount ?? '').trim()
    if (nextCid !== origCid || nextAmount !== origAmount) {
      body.wage_cid = nextCid === '' ? null : Number(nextCid)
      body.wage_currency_amount = nextCid === '' ? null : nextAmount
    }

    const nextStatus = form?.status === 'working' ? 'working' : 'recruiting'
    if (nextStatus !== String(row?.status || '')) body.status = nextStatus
    return body
  }

  const onEditSubmit = async (row, event) => {
    event.preventDefault()
    if (editBusy || !editForm) return
    const key = projectKey(row)
    if (!key) return
    const errs = validateEdit(editForm)
    if (Object.keys(errs).length > 0) {
      setEditErrs(errs)
      return
    }
    const body = buildEditPayload(row, editForm)
    if (Object.keys(body).length === 0) {
      // 无变化 ⇒ 零请求直接收起（「只带变化字段」口径下没有可发的键）
      closeEdit()
      return
    }
    setEditBusy(true)
    setEditErrs({})
    try {
      await patchWageProject(key, body, userRef.current)
      closeEdit()
      setNotice(key, { kind: 'ok', text: tRef.current('wage.editSaved') })
      await load({ silent: true })
    } catch (error) {
      const details = error?.details && typeof error.details === 'object' ? error.details : null
      const reason = typeof details?.reason === 'string' ? details.reason : ''
      const mapped = EDIT_REASON_MAP[reason]
      if (mapped) {
        const text = tRef.current(mapped.key, { hired: num(details?.hired_count, 0) })
        setEditErrs(mapped.field ? { [mapped.field]: text } : { general: text })
      } else {
        setEditErrs({ general: tRef.current('wage.editFailed') })
      }
    } finally {
      setEditBusy(false)
    }
  }

  const renderCard = (row) => {
    const key = projectKey(row)
    const recruiting = String(row?.status || '') === 'recruiting'
    const role = myRoleOf(row) // 'hired' | 'none' | null（null = 匿名 / 行内缺键）
    const joined = role === 'hired'
    const headcount = num(row?.headcount)
    const hiredCount = num(row?.hired_count)
    const batt = num(row?.wage_batt_per_claim)
    const hours = num(row?.wage_interval_hours)
    const amount = num(row?.wage_currency_amount)
    const symbol = symbols[String(row?.wage_cid ?? '')] || ''
    const nextAt = claimAt[key] || null
    const remainingMs = nextAt ? nextAt - clock : 0
    const claimable = !nextAt || remainingMs <= 0
    const busyAction = busy[key]
    const notice = notices[key]
    const canEdit = canEditCard(row)
    const editOpen = Boolean(editForm) && editKey === key
    const joinedElsewhere = Boolean(hiredKey) && hiredKey !== key
    const isFull = headcount > 0 && hiredCount >= headcount

    return (
      <article
        className={`sf-wage-card sf-card${joined ? ' is-joined' : ''}`}
        data-sf-m="wage-card"
        data-sf-project={key}
        data-sf-joined={joined ? '1' : '0'}
        data-sf-role={role || 'anonymous'}
        key={key || row?.title}
      >
        <div className="sf-wage-card-head">
          <div className="sf-wage-card-head-main">
            <h2 className="sf-wage-card-title" data-sf-m="wage-card-title">{row?.title || ''}</h2>
            {joined ? (
              <span className="sf-wage-joined-badge" data-sf-m="wage-card-joined">{t('wage.joinedBadge')}</span>
            ) : null}
          </div>
          <div className="sf-wage-card-head-side">
            <span
              className={`sf-wage-status ${recruiting ? 'is-open' : 'is-closed'}`}
              data-sf-m="wage-card-status"
              data-sf-state={recruiting ? 'recruiting' : 'closed'}
            >{t(recruiting ? 'wage.statusRecruiting' : 'wage.statusClosed')}</span>
            {canEdit ? (
              <button
                type="button"
                className="sf-wage-edit-toggle"
                data-sf-m="wage-card-edit"
                data-sf-open={editOpen ? '1' : '0'}
                aria-expanded={editOpen}
                onClick={() => (editOpen ? closeEdit() : openEdit(row))}
              >
                {t('common.edit')}
              </button>
            ) : null}
          </div>
        </div>

        {row?.description ? (
          <p className="sf-wage-card-desc" data-sf-m="wage-card-desc">{row.description}</p>
        ) : null}

        <div className="sf-wage-card-meta">
          <span data-sf-m="wage-card-headcount">{t('wage.headcount', { hired: hiredCount, total: headcount })}</span>
          <span className="sf-wage-pay" data-sf-m="wage-card-wage">
            {t('wage.wageLine', { batt, hours })}
            {amount > 0 && symbol ? (
              <span className="sf-wage-pay-extra" data-sf-m="wage-card-wage-extra">
                {t('wage.wageExtra', { amount, symbol })}
              </span>
            ) : null}
          </span>
        </div>

        <div className="sf-wage-card-actions">
          {joined ? (
            <>
              <span className="sf-wage-in-service" data-sf-m="wage-card-in-service">{t('wage.inService')}</span>
              <button
                type="button"
                className="sf-wage-btn is-primary"
                data-sf-m="wage-card-action"
                data-sf-action="claim"
                data-sf-need-login={isAuthenticated ? '0' : '1'}
                data-sf-claimable={claimable ? '1' : '0'}
                data-sf-remaining={claimable ? '0' : String(Math.ceil(remainingMs / 1000))}
                disabled={!claimable || busyAction === 'claim'}
                onClick={() => onClaim(row)}
              >
                {busyAction === 'claim' ? t('wage.claiming') : t('wage.claim')}
              </button>
              {!claimable ? (
                <span className="sf-wage-hint" data-sf-m="wage-card-hint">
                  {t('wage.claimReadyIn', { time: formatRemaining(remainingMs / 1000) })}
                </span>
              ) : null}
            </>
          ) : recruiting ? (
            <>
              <button
                type="button"
                className="sf-wage-btn is-primary"
                data-sf-m="wage-card-action"
                data-sf-action="join"
                data-sf-need-login={isAuthenticated ? '0' : '1'}
                disabled={joinedElsewhere || isFull || busyAction === 'join'}
                onClick={() => onJoin(row)}
              >
                {busyAction === 'join' ? t('wage.joining') : t('wage.join')}
              </button>
              {joinedElsewhere ? (
                <span className="sf-wage-hint is-warn" data-sf-m="wage-card-hint">{t('wage.oneAtATime')}</span>
              ) : isFull ? (
                <span className="sf-wage-hint" data-sf-m="wage-card-hint">{t('wage.full')}</span>
              ) : null}
            </>
          ) : null}
        </div>

        {editOpen ? (
          <form className="sf-wage-edit" data-sf-m="wage-edit" noValidate onSubmit={(e) => onEditSubmit(row, e)}>
            <p className="sf-wage-edit-title" data-sf-m="wage-edit-title">{t('wage.editTitle')}</p>
            <div className="sf-wage-edit-grid">
              <label className="sf-wage-edit-field is-wide">
                <span className="sf-wage-edit-label">{t('bountyProject.title')}</span>
                <input
                  className="sf-wage-edit-input"
                  data-sf-edit="title"
                  value={editForm.title}
                  maxLength={200}
                  onChange={(e) => setEditField('title', e.target.value)}
                />
                {editErrs.title ? <span className="sf-wage-edit-err" data-sf-edit-err="title" role="alert">{editErrs.title}</span> : null}
              </label>
              <label className="sf-wage-edit-field is-wide">
                <span className="sf-wage-edit-label">{t('bountyProject.description')}</span>
                <textarea
                  className="sf-wage-edit-input"
                  data-sf-edit="description"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditField('description', e.target.value)}
                />
                {editErrs.description ? <span className="sf-wage-edit-err" data-sf-edit-err="description" role="alert">{editErrs.description}</span> : null}
              </label>
              <label className="sf-wage-edit-field">
                <span className="sf-wage-edit-label">{t('bountyProject.headcount')}</span>
                <input
                  className="sf-wage-edit-input"
                  data-sf-edit="headcount"
                  inputMode="numeric"
                  value={editForm.headcount}
                  onChange={(e) => setEditField('headcount', e.target.value)}
                />
                {editErrs.headcount ? <span className="sf-wage-edit-err" data-sf-edit-err="headcount" role="alert">{editErrs.headcount}</span> : null}
              </label>
              <label className="sf-wage-edit-field">
                <span className="sf-wage-edit-label">{t('bountyProject.minDays')}</span>
                <input
                  className="sf-wage-edit-input"
                  data-sf-edit="minDays"
                  inputMode="numeric"
                  value={editForm.minDays}
                  onChange={(e) => setEditField('minDays', e.target.value)}
                />
                {editErrs.minDays ? <span className="sf-wage-edit-err" data-sf-edit-err="minDays" role="alert">{editErrs.minDays}</span> : null}
              </label>
              <label className="sf-wage-edit-field">
                <span className="sf-wage-edit-label">{t('bountyProject.battPerClaim')}</span>
                <input
                  className="sf-wage-edit-input"
                  data-sf-edit="batt"
                  inputMode="decimal"
                  value={editForm.batt}
                  onChange={(e) => setEditField('batt', e.target.value)}
                />
                {editErrs.batt ? <span className="sf-wage-edit-err" data-sf-edit-err="batt" role="alert">{editErrs.batt}</span> : null}
              </label>
              <label className="sf-wage-edit-field">
                <span className="sf-wage-edit-label">{t('bountyProject.intervalHours')}</span>
                <input
                  className="sf-wage-edit-input"
                  data-sf-edit="interval"
                  inputMode="numeric"
                  value={editForm.interval}
                  onChange={(e) => setEditField('interval', e.target.value)}
                />
                {editErrs.interval ? <span className="sf-wage-edit-err" data-sf-edit-err="interval" role="alert">{editErrs.interval}</span> : null}
              </label>
              <label className="sf-wage-edit-field">
                <span className="sf-wage-edit-label">{t('bountyProject.currency')}</span>
                <select
                  className="sf-wage-edit-input"
                  data-sf-edit="cid"
                  value={editForm.cid}
                  onChange={(e) => setEditField('cid', e.target.value)}
                >
                  <option value="">{t('bountyProject.noCurrency')}</option>
                  {wageCurrencyOptions(currencyRows).map((opt) => (
                    <option key={opt.cid} value={opt.cid}>{opt.label}</option>
                  ))}
                </select>
                <span className="sf-wage-edit-label">{t('bountyProject.currencyAmount')}</span>
                <input
                  className="sf-wage-edit-input"
                  data-sf-edit="amount"
                  inputMode="decimal"
                  value={editForm.amount}
                  disabled={editForm.cid === ''}
                  onChange={(e) => setEditField('amount', e.target.value)}
                />
                {editErrs.currency ? <span className="sf-wage-edit-err" data-sf-edit-err="currency" role="alert">{editErrs.currency}</span> : null}
              </label>
              <label className="sf-wage-edit-field">
                <span className="sf-wage-edit-label">{t('wage.fieldStatus')}</span>
                <select
                  className="sf-wage-edit-input"
                  data-sf-edit="status"
                  value={editForm.status}
                  onChange={(e) => setEditField('status', e.target.value)}
                >
                  {(editForm.status === 'working' ? ['working', 'recruiting'] : ['recruiting', 'working']).map((s) => (
                    <option key={s} value={s}>{t(s === 'working' ? 'common.ongoing' : 'wage.statusRecruiting')}</option>
                  ))}
                </select>
                {editErrs.status ? <span className="sf-wage-edit-err" data-sf-edit-err="status" role="alert">{editErrs.status}</span> : null}
              </label>
            </div>
            {editErrs.general ? <p className="sf-wage-edit-err" data-sf-edit-err="general" role="alert">{editErrs.general}</p> : null}
            <div className="sf-wage-edit-actions">
              <button type="submit" className="sf-wage-btn is-primary" data-sf-m="wage-edit-save" disabled={editBusy}>
                {editBusy ? t('wage.saving') : t('common.save')}
              </button>
              <button type="button" className="sf-wage-btn" data-sf-m="wage-edit-cancel" onClick={closeEdit}>
                {t('wage.cancel')}
              </button>
            </div>
          </form>
        ) : null}

        {notice?.text ? (
          <p
            className={`sf-wage-notice is-${notice.kind}`}
            data-sf-m="wage-card-notice"
            data-sf-kind={notice.kind}
            role={notice.kind === 'err' ? 'alert' : 'status'}
          >
            {notice.text}
            {notice.streak ? (
              <span className="sf-wage-notice-streak" data-sf-m="wage-card-streak">{notice.streak}</span>
            ) : null}
            {notice.kind === 'login' ? (
              <Link className="sf-wage-notice-link" data-sf-m="wage-card-login-link" to={buildLocalizedPath(lang, '/login')}>
                {t('wage.loginCta')}
              </Link>
            ) : null}
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <div className="sf-layout sf-wage-page" data-sf-m="wage-page">
      <div className="sf-layout-main">
        <header className="sf-wage-head">
          <h1 className="sf-panel-title">{t('wage.title')}</h1>
          <p className="sf-foot-note">{t('wage.oneAtATime')}</p>
        </header>

        {/* 电量卡（Kevin 2026-10-20：自 /activities 并入本页顶部，位于项目列表之上）。
            ★ 2026-10-20 需求③：签到按钮 / 连续签到天数已下线，本处只剩电量点阵；
            组件自带锚点 `batt-checkin` 与 hash 滚动；未登录时组件返回 null（不白屏）。 */}
        <div className="sf-wage-checkin" data-sf-m="wage-checkin">
          <BattCheckinPanel />
        </div>

        {/* 客态轻提示条（不遮挡列表：项目列表本身是公开浏览面，只有写口需登录） */}
        {!isAuthenticated ? (
          <div className="sf-panel sf-wage-login" data-sf-m="wage-login">
            <p>{t('wage.loginRequired')}</p>
            <Link className="sf-wage-btn is-primary" data-sf-m="wage-login-cta" to={buildLocalizedPath(lang, '/login')}>
              {t('wage.loginCta')}
            </Link>
          </div>
        ) : null}

        {list.phase === 'loading' ? (
          <p className="sf-foot-note" data-sf-m="wage-loading">{t('wage.loading')}</p>
        ) : list.phase === 'error' ? (
          <div className="sf-panel" data-sf-m="wage-error" role="alert">
            <p>{t('wage.loadFailed')}</p>
            <button type="button" className="sf-wage-btn" data-sf-m="wage-retry" onClick={() => load()}>
              {t('wage.retry')}
            </button>
          </div>
        ) : list.rows.length === 0 ? (
          <p className="sf-foot-note" data-sf-m="wage-empty">{t('wage.empty')}</p>
        ) : (
          <div className="sf-wage-list" data-sf-m="wage-list">
            {list.rows.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  )
}

export default WagePage
