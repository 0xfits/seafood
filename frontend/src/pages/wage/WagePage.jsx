import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import BattCheckinPanel from '../../components/BattCheckinPanel'
import WageMintEntry from './WageMintEntry'
import { applyToWageProject, claimWage, fetchWageCurrencies, fetchWageProjects } from './wage-api'
import { projectHrefOf } from '../../project-slug'
import { avatarInitialOf, avatarToneOf } from '../../avatar-tone'
import toast from 'react-hot-toast'
import './wage.css'

// ============================================================================
// /wage · 领工资（Kevin 2026-10-20 需求②）
// ----------------------------------------------------------------------------
// 形态：一张项目卡 = 项目名 / 简述 / 招工状态（招募中·已截止）/ 已招 X/Y /
//       工资：batt N 每次（间隔 M 小时）+ 可选次币固定额；
//       主按钮 = 招募中且未入职 ⇒【加入】；已入职该项目 ⇒【领工资】。
//
// 硬口径：
//   · 「同时只能在一个项目打工」—— ★ Kevin 2026-10-22：本人**已在任一项目在职**（任一行 `my_role==='hired'`）
//     ⇒ ① 全页所有卡**不再渲染【加入】**（不是置灰）；② 页顶「同时只能在一个项目打工」文案**不显示**；
//     ③ 在职那张卡仍只有【领工资】。加入 / 切换入口统一搬到项目页 `/:slug`（`ProjectPage` 的
//     【加入此项目】/【切换到此项目】/【已在职】三态）。未在职时行为逐字不变；
//     真正的闸仍在服务端（部分唯一索引 + `apply` 三闸），前端只做显隐，不替服务端判定。
//   · 领取间隔：以行内 `next_claim_at` 为准（键在场且为未来时刻 ⇒ 置灰 + 1s 倒计时，到点自动可点）；
//     键在场且已过 / 为 null ⇒ 立即可领；**键缺席**（匿名 / 后端未透出）⇒ 可点，由服务端 400 兜底
//     （`details.reason` 映射成提示，并把 `details` 里的下次可领时间/剩余秒数接成倒计时）；不猜、不本地自算间隔。
//   · 成功 ⇒ 卡内成功提示（含到账 batt/次币数值）+ 重拉列表（取服务端新的 `next_claim_at` 重新置灰倒计时）
//     + 卡内内联提示，失败不白屏、不清列表。
//   · 卡片按钮态**只认 `my_role`**：`hired` ⇒ 卡内只有【领工资】（**不再渲染【加入】**）；
//     `none` ∧ 本人未在任一处在职 ⇒ 【加入】；`none` ∧ 已在别处在职 ⇒ **无动作钮**（切换入口在项目页）；
//     键缺席（匿名）⇒ 照常渲染【加入】、点击只给登录提示。
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
// ★ Kevin 2026-10-23 需求A：领工资成功 ⇒ **模态框**（`WageClaimModal`），卡内**不再**出现成功文案：
//   · 框体 = 三路零请求关闭（✕ / 背板 / Esc）+ 滚动锁定，文案 = 到账电量（⚡️）+ 可选次币 + 连续奖励；
//   · 卡内 `wage-card-notice` 只留**失败 / 登录 / 加入成功**三态 —— 领取成功不再写进卡；
//   · 关闭后卡面靠重拉列表拿到的 `next_claim_at` 自行置灰倒计时（与关闭动作无关，不因关框丢状态）。
//   ▲ 以上「模态框」一条已被 **Kevin 2026-10-24 裁定**推翻（资金余额变动类成功反馈 = Toast）：
//     成功 ⇒ `toast.success(...)` 一条（主文案 + 可选连续奖励句，duration 5000），**模态框整体撤掉**
//     （`WageClaimModal.jsx` 已删）；卡内仍**不写**成功文案，失败/登录/加入成功三态不变（失败不得改 Toast）。
// ★ Kevin 2026-10-23 需求B：卡内【已招 X/Y】文案 ⇒ 前文案「招工名额」+ 270×3 进度条
//   （填充 = hired/headcount；`headcount = 0` ⇒ 恒 0%；超员钳到 100%）；钩子 `wage-card-headcount`
//   保留，读数改由 `data-hired` / `data-total` 承载。
// ★ Kevin 2026-10-23 需求C：工资行改 emoji 计数口径【💰：每 M 小时 + ⚡️ N + ₿ X】（值改、键不动）。
//
// ★ Kevin 2026-10-21 指令：最高管理员可以修改任何项目的信息。
// ★ Kevin 2026-10-21②（本版）：**【编辑】从本页**（项目卡卡头 / 卡内行内展开表单）**整体移出**，
//   改在项目自己的页面（`/:slug`）操作区【编辑项目】+ **模态框**（`pages/project/ProjectEditModal.jsx`
//   与 `project-edit-form.js`，字段构建 / 校验 / 载荷 / `EDIT_REASON_MAP` 的唯一真源）。
//   本页只保留**整卡链接**（行有 slug ⇒ `/<slug>`）与卡内既有交互（【加入】/【领工资】/倒计时/提示）；
//   卡内**不再有【编辑】钮，也不再请求 `/api/user`**（管理员三键判定随编辑一起搬到项目页）。
// ★ Kevin 2026-10-24 需求A/B/C/D（布局重排 + 铸造入口）：
//   A. 页顶改**两列同一行**：左电量卡（弹性主位，锚点/深链不动）、右当前项目卡（固定 320px，钩子
//      `wage-current`）；无已加入项目 ⇒ 灰态占位（`wage-current-empty`）；≤767 上下堆叠且当前项目卡在前。
//   B. 已加入项目**从下方网格移出**：`wage-list` 只列其它项目（排序与卡形态不变，不在网格重复出现）。
//   C. 卡尺寸规范：`.sf-wage-card` 固定高 + 网格 `align-items: stretch` + 描述固定 3 行截断 +
//      操作区 `margin-top:auto` 贴底 ⇒ 同排卡片逐值等高；零新主题 token（只吃既有 `--sf-*`）。
//   D. 电量卡内新增【铸造】入口（`pages/wage/WageMintEntry.jsx`）：可点 / 可见置灰两态 + 缺口同源口径
//      （复用 `BttcAssetPanel` 的 `mintShortfallOf`），成功 Toast（T126 · 5000ms）/ 失败卡内内联。
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
  // ★ 2026-10-22：后端 `details.reason` 实际是**小写蛇形**（`wage_interval_not_reached` /
  //   `worker_not_hired` / `project_ended_frozen`），旧表只写了大写码 ⇒ 永远查不中 ⇒ 一律兜底。
  //   现按「大小写不敏感」建表（下面 REASON_TEXT_BY_LOWER 归一），旧大写键保留兼容。
  wage_interval_not_reached: 'claimTooSoon',
  worker_not_hired: 'notHired',
  project_ended_frozen: 'statusClosed',
  // ★ 2026-10-22：领薪三闸此前一律落 `claimFailed`（「这次没有领到」）⇒ 用户看不出是项目方没钱还是币种下线。
  //   `project_wage_pool_insufficient` = 项目方次币奖池不足（owner 腿转不出）⇒ 要联系项目管理员；
  //   `project_wage_currency_not_found` / `_not_listed` = 该次币不存在 / 已下架 ⇒ 同族文案（同一处置动作）。
  project_wage_pool_insufficient: 'poolInsufficient',
  project_wage_currency_not_found: 'currencyUnavailable',
  project_wage_currency_not_listed: 'currencyUnavailable',
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
const REASON_TEXT_BY_LOWER = Object.freeze(
  Object.fromEntries(Object.entries(REASON_TEXT_KEYS).map(([k, v]) => [k.toLowerCase(), v])),
)

const WagePage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const uidKey = user?.uID ?? user?.uid ?? null

  const [list, setList] = useState({ phase: 'loading', rows: [] })
  const [busy, setBusy] = useState({}) // projectKey ⇒ 'join' | 'claim'
  const [notices, setNotices] = useState({}) // projectKey ⇒ { kind:'ok'|'err'|'login', text }
  // ★ Kevin 2026-10-24 裁定：领取成功改 **Toast**（不再有模态框 state）——
  //   成功结果只经 `toast.success` 一条出口，页面不持有它；失败/登录/加入仍走上方 `notices`。
  const [claimAt, setClaimAt] = useState({}) // projectKey ⇒ 下次可领时间戳
  const [symbols, setSymbols] = useState({}) // cid ⇒ 币种符号
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

  // 次币符号（公开读面；失败 ⇒ 空表，卡面退化为只显示 batt 口径，不阻断页面）。
  // ★ 客态同样要取 —— 客态也渲染项目卡，次币定额（`wageExtra`）不能因为未登录就消失。
  useEffect(() => {
    let cancelled = false
    fetchWageCurrencies()
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload) ? payload : (payload?.rows || [])
        const safeRows = Array.isArray(rows) ? rows : []
        const map = {}
        for (const row of safeRows) {
          if (row?.cid != null && row?.symbol) map[String(row.cid)] = String(row.symbol)
        }
        setSymbols(map)
      })
      .catch(() => { if (!cancelled) setSymbols({}) })
    return () => { cancelled = true }
  }, [])

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

  /** 「当前项目」行 = 本人已在职的那一行（取自同一份列表读数，不另开读口）。 */
  const currentRow = useMemo(() => {
    if (!isAuthenticated || !hiredKey) return null
    return list.rows.find((row) => projectKey(row) === hiredKey) || null
  }, [isAuthenticated, hiredKey, list.rows])

  /** 下方网格 = **其它项目**（Kevin 2026-10-24 需求B：已加入的那张不再在网格里重复出现）。 */
  const gridRows = useMemo(
    () => (hiredKey ? list.rows.filter((row) => projectKey(row) !== hiredKey) : list.rows),
    [hiredKey, list.rows],
  )

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
    // 大小写不敏感查表（reason 由后端给出，形态可能是小写蛇形或大写码）
    const key = reason ? (REASON_TEXT_BY_LOWER[String(reason).trim().toLowerCase()] || fallbackKey) : fallbackKey
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
      // ★ Kevin 2026-10-24 裁定：成功 ⇒ **Toast**（资金余额变动类统一），卡内**不写**成功文案。
      //   · 一条 toast = 主文案 +（有连续奖励时）空格拼上的奖励句；duration 5000（文案较长，默认 4s 偏短）；
      //   · `<Toaster/>` 挂在 `main.jsx` 顶层 ⇒ 重拉列表不会把它带走，无需等待即可刷新；
      //   · 先清掉该卡旧提示（上一轮失败 / 登录提示不得留在成功背后像一次失败的余影）。
      setNotice(key, null)
      toast.success([text, streakText].filter(Boolean).join(' '), { duration: 5000 })
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

  // ★ Kevin 2026-10-21②：项目卡【编辑】（owner ∨ manage_tasks 管理员）连同行内表单**整体移出本页** ——
  //   改在项目自己的页面（`/:slug`）操作区【编辑项目】+ 模态框；字段/校验/载荷的唯一真源见
  //   `pages/project/project-edit-form.js`，UI 见 `pages/project/ProjectEditModal.jsx`。
  //   本页零编辑钮、零 `/api/user` 请求、零 PATCH（卡片只保留整卡链接与加入/领工资）。

  const renderCard = (row, { current = false } = {}) => {
    const key = projectKey(row)
    const recruiting = String(row?.status || '') === 'recruiting'
    const role = myRoleOf(row) // 'hired' | 'none' | null（null = 匿名 / 行内缺键）
    const joined = role === 'hired'
    const headcount = num(row?.headcount)
    const hiredCount = num(row?.hired_count)
    // ★ Kevin 2026-10-23 需求B：进度条填充比例 = hired/headcount；**0 头恒 0%**、超员钳到 100%
    //   （两种都在前端钳位 —— 服务端可能出现 hired > headcount 的历史行，不得画出 >100% 的条）。
    const hiredPct = headcount > 0
      ? Math.min(100, Math.max(0, Math.round((hiredCount / headcount) * 10000) / 100))
      : 0
    const batt = num(row?.wage_batt_per_claim)
    const hours = num(row?.wage_interval_hours)
    const amount = num(row?.wage_currency_amount)
    const symbol = symbols[String(row?.wage_cid ?? '')] || ''
    const nextAt = claimAt[key] || null
    const remainingMs = nextAt ? nextAt - clock : 0
    const claimable = !nextAt || remainingMs <= 0
    const busyAction = busy[key]
    const notice = notices[key]
    // ★ Kevin 2026-10-22：**在职于任一项目 ⇒ 本页所有卡都不再有【加入】**
    //   （此前只把别处的【加入】置灰 + 挂「同时只能在一个项目打工」）—— 加入/切换入口统一搬到项目页 `/:slug`，
    //   本页只保留【领工资】。`hiredKey` 非空 = 本人已在某个项目在职（`my_role==='hired'`）。
    const hiredAnywhere = Boolean(hiredKey)
    const isFull = headcount > 0 && hiredCount >= headcount
    // ★ Kevin 2026-10-24：操作区**按需渲染**——下面三支分支里只有「在职可领」与「招募中可加入」
    //   会产出内容；其余（已截止 / 已在别处打工 / 招募已满且非在职…）此前仍渲染一个空壳 div，
    //   带 `margin-top:auto` + `flex:none` ⇒ 在 180px 固定高卡里白占一条按钮高。
    //   无内容 ⇒ **整块不渲染**（不用 `:empty`、不留空 div），空间交给描述（CSS `:has` 回 2 行）。
    const hasActions = joined || (recruiting && !hiredAnywhere)
    // 整卡链接（Kevin 2026-10-21）：行有合法 slug ⇒ 根元素 article→Link（页面规范形 `/<slug>`）；
    // 历史行无 slug ⇒ null ⇒ 保持原 `<article>` 不变链接。卡内按钮 stopPropagation 不触发跳转。
    const slugHref = projectHrefOf(row)
    // ★ Kevin 2026-10-22：卡头左侧 40px 圆形头像 —— 行有 `avatar_url` ⇒ `<img>`（object-fit:cover）；
    //   无（null / 空串 / 非串）⇒ 项目名首字 + `--sf-thumb-N` 彩底。档位与首字都取
    //   `src/avatar-tone.js`（与首页热门任务卡 / 项目页头像**同一份**纯函数，不在本页复制 hash）。
    const avatarUrl = typeof row?.avatar_url === 'string' ? row.avatar_url.trim() : ''
    const avatarTone = avatarUrl ? 0 : avatarToneOf(row?.title)
    const avatarBody = avatarUrl ? (
      <img className="sf-wage-card-avatar-img" src={avatarUrl} alt="" loading="lazy" />
    ) : (
      <span className="sf-wage-card-avatar-initial" aria-hidden="true">{avatarInitialOf(row?.title)}</span>
    )
    const cardBody = (
      <>
        <div className="sf-wage-card-head">
          <div className="sf-wage-card-head-main">
            <span
              className="sf-wage-card-avatar"
              data-sf-m="wage-card-avatar"
              data-sf-avatar={avatarUrl ? 'img' : 'initial'}
              data-sf-tone={avatarUrl ? undefined : String(avatarTone)}
            >
              {avatarBody}
            </span>
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
          </div>
        </div>

        {/* 简述**恒定在场**、固定 3 行截断（Kevin 2026-10-24 需求C：卡高矮不齐的根因是描述行数随文案变）
            ⇒ 无描述的行也占位，同排卡片行高一致；`-webkit-line-clamp` 见 wage.css。 */}
        <p className="sf-wage-card-desc" data-sf-m="wage-card-desc">{row?.description || ''}</p>

        <div className="sf-wage-card-meta">
          {/* ★ Kevin 2026-10-23 需求B：旧【已招 X/Y】文案退场，改为「招工名额」+ 270×3 进度条。
              钩子 `wage-card-headcount` 保留（探针/单测的抓手），读数改由 `data-hired` / `data-total`。 */}
          <span
            className="sf-wage-headcount"
            data-sf-m="wage-card-headcount"
            data-hired={String(hiredCount)}
            data-total={String(headcount)}
          >
            <span className="sf-wage-headcount-label" data-sf-m="wage-card-headcount-label">{t('wage.headcount')}</span>
            <span
              className="sf-wage-progress"
              data-sf-m="wage-card-headcount-bar"
              data-sf-percent={String(hiredPct)}
              role="progressbar"
              aria-label={t('wage.headcount')}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, headcount)}
              aria-valuenow={Math.max(0, Math.min(hiredCount, headcount))}
            >
              <span
                className="sf-wage-progress-fill"
                data-sf-m="wage-card-headcount-fill"
                style={{ width: `${hiredPct}%` }}
              />
            </span>
          </span>
          <span className="sf-wage-pay" data-sf-m="wage-card-wage">
            {t('wage.wageLine', { batt, hours })}
            {amount > 0 && symbol ? (
              <span className="sf-wage-pay-extra" data-sf-m="wage-card-wage-extra">
                {t('wage.wageExtra', { amount, symbol })}
              </span>
            ) : null}
          </span>
        </div>

        {hasActions ? (
        <div className="sf-wage-card-actions">
          {joined ? (
            <>
              <span className="sf-wage-in-service" data-sf-m="wage-card-in-service">{t('wage.inService')}</span>
              <button
                type="button"
                className="sf-wage-btn is-primary"
                data-sf-m={current ? 'wage-current-claim' : 'wage-card-action'}
                data-sf-action="claim"
                data-sf-need-login={isAuthenticated ? '0' : '1'}
                data-sf-claimable={claimable ? '1' : '0'}
                data-sf-remaining={claimable ? '0' : String(Math.ceil(remainingMs / 1000))}
                disabled={!claimable || busyAction === 'claim'}
                onClick={(event) => {
                  // 卡根是 <Link>：stopPropagation 只挡 React 合成事件冒泡，
                  // **不挡锚点默认导航** ⇒ 必须同时 preventDefault（Kevin 2026-10-22 复现：点按钮整页跳走）。
                  event.preventDefault()
                  event.stopPropagation()
                  onClaim(row)
                }}
              >
                {busyAction === 'claim' ? t('wage.claiming') : t('wage.claim')}
              </button>
              {!claimable ? (
                <span className="sf-wage-hint" data-sf-m="wage-card-hint">
                  {t('wage.claimReadyIn', { time: formatRemaining(remainingMs / 1000) })}
                </span>
              ) : null}
            </>
          ) : recruiting && !hiredAnywhere ? (
            <>
              <button
                type="button"
                className="sf-wage-btn is-primary"
                data-sf-m="wage-card-action"
                data-sf-action="join"
                data-sf-need-login={isAuthenticated ? '0' : '1'}
                disabled={isFull || busyAction === 'join'}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onJoin(row)
                }}
              >
                {busyAction === 'join' ? t('wage.joining') : t('wage.join')}
              </button>
              {isFull ? (
                <span className="sf-wage-hint" data-sf-m="wage-card-hint">{t('wage.full')}</span>
              ) : null}
            </>
          ) : null}
        </div>
        ) : null}

        {notice?.text ? (
          <p
            className={`sf-wage-notice is-${notice.kind}`}
            data-sf-m="wage-card-notice"
            data-sf-kind={notice.kind}
            role={notice.kind === 'err' ? 'alert' : 'status'}
          >
            {notice.text}
            {notice.kind === 'login' ? (
              <Link
                className="sf-wage-notice-link"
                data-sf-m="wage-card-login-link"
                to={buildLocalizedPath(lang, '/login')}
                onClick={(event) => event.stopPropagation()}
              >
                {t('wage.loginCta')}
              </Link>
            ) : null}
          </p>
        ) : null}
      </>
    )

    // 根元素：有 slug ⇒ `<Link>`（整卡可点、href 可探针断言）；无 slug ⇒ 原 `<article>` 不变。
    // 卡内交互元素（加入 / 领工资 / 编辑 / 表单）stopPropagation ⇒ 不触发整卡跳转。
    const cardClass = `sf-wage-card sf-card${joined ? ' is-joined' : ''}${current ? ' sf-wage-current-card' : ''}`
    const cardData = {
      'data-sf-project': key,
      'data-sf-joined': joined ? '1' : '0',
      'data-sf-role': role || 'anonymous',
      'data-sf-slug': slugHref ? slugHref.slice(1) : '',
    }

    return slugHref ? (
      <Link
        className={cardClass}
        data-sf-m="wage-card"
        {...cardData}
        to={buildLocalizedPath(lang, slugHref)}
        key={key || row?.title}
      >
        {cardBody}
      </Link>
    ) : (
      <article
        className={cardClass}
        data-sf-m="wage-card"
        {...cardData}
        key={key || row?.title}
      >
        {cardBody}
      </article>
    )
  }

  return (
    <div className="sf-layout sf-wage-page" data-sf-m="wage-page">
      <div className="sf-layout-main">
        <header className="sf-wage-head">
          <h1 className="sf-panel-title">{t('wage.title')}</h1>
          {/* ★ Kevin 2026-10-22：**只在未在职时**显示「同时只能在一个项目打工」——
              已在职的用户看到这句话只会以为本页还能再投一次（实际入口已搬到项目页）。 */}
          {hiredKey ? null : (
            <p className="sf-foot-note" data-sf-m="wage-one-at-a-time">{t('wage.oneAtATime')}</p>
          )}
        </header>

        {/* ★ Kevin 2026-10-24 需求A：顶部改**两列**（同一行）——
            左 = 电量卡（`wage-checkin`，宽弹性占主位；卡内追加【铸造】入口，锚点 `batt-checkin` 与
            `/wage#batt-checkin` 深链逐字不动：`id` 仍在组件根上，hash 滚动仍直达）；
            右 = **当前项目卡**（`wage-current`，固定 320px）：承载已加入项目的工资标准 / 名额 /
            下次可领倒计时 / 【领工资】；未加入 ⇒ 灰态占位 `wage-current-empty`。
            ≤767 移动档：上下堆叠且**当前项目卡排在前**（领工资是主操作，不得被电量卡挤到折叠线下），
            由 wage.css 的 `order` 实现（同一 DOM，桌面左电右项目）。 */}
        <div className="sf-wage-top" data-sf-m="wage-top">
          <div className="sf-wage-checkin" data-sf-m="wage-checkin">
            <BattCheckinPanel>
              {({ batt, reload }) => <WageMintEntry batt={batt} reload={reload} />}
            </BattCheckinPanel>
          </div>

          {currentRow ? (
            <section
              className="sf-wage-current"
              data-sf-m="wage-current"
              data-sf-project={projectKey(currentRow)}
              aria-label={t('wage.currentTitle')}
            >
              {renderCard(currentRow, { current: true })}
            </section>
          ) : (
            <section
              className="sf-wage-current is-empty"
              data-sf-m="wage-current-empty"
              aria-label={t('wage.currentTitle')}
            >
              <p className="sf-wage-current-empty-text" data-sf-m="wage-current-empty-text">
                {t('wage.currentEmpty')}
              </p>
            </section>
          )}
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
        ) : gridRows.length === 0 ? (
          <p className="sf-foot-note" data-sf-m="wage-empty">{t('wage.empty')}</p>
        ) : (
          <div className="sf-wage-list" data-sf-m="wage-list">
            {gridRows.map((row) => renderCard(row))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WagePage
