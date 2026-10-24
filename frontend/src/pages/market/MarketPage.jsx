import React, { useCallback, useEffect, useMemo, useState } from 'react'
import NotFoundPage from '../NotFoundPage'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'
import { contentStatus, localizeFields } from '../../i18n-content'
import TranslatingBadge from '../../components/i18n/TranslatingBadge'
import {
  QUOTE_CID,
  cancelAllOrders,
  cancelOrder,
  createOrderPlaceTracker,
  fetchCurrencies,
  fetchCurrencyHolders,
  fetchMarketTrades,
  fetchMyOrders,
  fetchOrderBook,
  orderPlaceFingerprint,
  placeOrder,
} from './market-api'
// 批 7-A：「账本流水」面板 = 已注册读口 `GET /api/user/ledger?kind=transfer`
//   （§5.1「碎片读口 ②」：旧 `GET /api/shard/transfer` 的语义由本读口取代）
import { fetchMyLedger, LEDGER_PAGE_SIZE } from '../../ledger-api'
// 价格走势（sparkline）：纯几何层（零新依赖、零新接口），入参 = `trades.rows`
import { TREND_VIEW_H, TREND_VIEW_W, buildTrendSeries, trendGeometry } from './sparkline'
import './market.css'

// ============================================================================
// 交易所线 · 页面（P4-B4c-ii-b / Kong）
// 接线（全部**已注册**路径；真源 backend-ts/src/index.ts，逐面行号见 ./market-api.js）：
//   行情/盘口 GET /api/market/:base_cid/orderbook  · 成交流水 GET /api/market/:base_cid/trades（公开只读）
//   我的挂单 GET /api/order（actor）· 挂单 POST /api/order（`create_key` fail-loud）
//   撤单 DELETE /api/order/:oID · 全撤 DELETE /api/order（**query only**，本页不发 body）
// 幂等键：挂单 = **前端供键**（`cli:`，tracker 保证同一次操作重试同键）；撤单/全撤 = 服务端派生（`biz:market:cancel:<id>`）。
// 金额口径：挂单的 `price`/`amount` 是交易**要约**（供给侧自主出价，§4.8.1）；`owner_uid` 一律服务端取 token actor，
//   本页**结构性不传**（传了也会被服务端丢弃，回包 `client_owner_uid_ignored`）。成交价 = 买单限价（M3），本页不做撮合。
// 空态口径（批 7-A 更新）：「账本流水」读口（`GET /api/user/ledger`）**已注册** ⇒ 本页渲染**真数据**
//   （本页面板走**转让口径** `?kind=transfer`，看下方 `loadLedger`）；**仅当真·零流水**时才显示空态。
//   本页的「成交流水」是**另一个面**（`market_trade`，只读），两者不可混为一谈。
// 退化币对（§5.103 裁定 · P4-B4c-ii-c ②）：`baseCid === QUOTE_CID`（`$` 对自身）⇒ **不发** `orderbook`/`trades` 请求，
//   空态文案 = `market.pairDegenerate`（四语），与「真无挂单」（`market.bookEmpty`，请求发出去、回包为空）**区分**。
// 失败态：一律走 R107 链（`error.message` 已是字符串）⇒ 页面不会出现 `[object Object]`。
// 断点：窄屏单列 + 底部 tab（shell 承担）；宽屏行情两列 / 盘口+流水两列（本页 CSS 的断点层）。
// ============================================================================
const MARKET_LIMIT = 50

// P7-E 小尾巴批-β ②：`market_order` 枚举字段取值域 = CHECK 白名单（现取真源，**不猜**）
//   · `status`：`backend-ts/migrations/0016_market.sql:144` ⇒ `open|partial|filled|cancelled`，默认 `open`
//   · `side`  ：`backend-ts/migrations/0016_market.sql:130` ⇒ `buy|sell`（CHECK 在 :130；`:135` 是 price 注释 —— 本单订正）
//   ★ 父单提示的「真源 = `0015_listing.sql` 的 `listing_order.status`」**不适用于本行**：
//     本页「我的挂单」= `GET /api/order` ⇒ `database.ts:3538 listOrdersByUser`（`SELECT o.* FROM market_order`）
//     ⇒ 回包 `side`/`status` 来自 **`market_order`**（`normalizeMarketOrder` 均实返，非空）。以现取为准。
//   标签键 = 本单新增 `orders.statusLabel.*` / `orders.sideLabel.*`（四语齐备，含 `unknown` 兜底）。
const MARKET_ORDER_STATUS_KEYS = ['open', 'partial', 'filled', 'cancelled']
const MARKET_ORDER_SIDE_KEYS = ['buy', 'sell']

// 「我的挂单」面板只列**活动单**（Kevin 2026-10-22 实测缺陷修复）：
//   缺陷 = `GET /api/order` 是**全量**（`SELECT o.* FROM market_order WHERE owner_uid=…`，含已终结行），
//   原渲染不分状态全列 ⇒ 全撤后旧行仍在（状态变「已撤」），读起来像「没撤掉」。
// 口径（**已终结态才隐藏**）：`filled`（全成交）/ `cancelled`（已撤）不入面板；
//   `open` / `partial` 必留；**未知/缺省状态 fail-open 一律保留** —— 理由：
//     ① 服务端 `normalizeMarketOrder` 恒给 `status`（缺省回落 `'open'`，`database.ts:2424`），
//        未知值只可能来自未来新增枚举，此时**藏行比显示更危险**（用户看不到自己的钱压在哪）；
//     ② 未知值仍走 `orders.statusLabel.unknown` 本地化兜底（不泄原始枚举）；
//     ③ 现取测试契约（`p7e-tails-beta.test.jsx` ②）以 `filled`/未知/缺省三态钉住标签查表 ⇒ 三态语义保持可测。
const MARKET_ORDER_TERMINAL_STATUS = ['filled', 'cancelled']
const isActiveMarketOrder = (row) => {
  const status = String(row?.status ?? '').trim()
  return !MARKET_ORDER_TERMINAL_STATUS.includes(status)
}

// 「标的币种」combobox（Kevin 2026-10-21）：选项行文案 = `symbol · name · #cid`
//   （symbol 为展示符号、可为空；空段跳过，`#cid` 恒在场）。
const baseOptionText = (row) => {
  const parts = [row?.symbol, row?.name].map((v) => String(v ?? '').trim()).filter(Boolean)
  parts.push(`#${row?.cid}`)
  return parts.join(' · ')
}

// 匹配口径：输入词对 `symbol` / `name` / cid 数字**不区分大小写包含**（`bttc` 命中 name=BTTC；
//   纯数字同时命中 cid 数字串，如 `39` 命中 #399）。
const normNeedle = (v) => String(v ?? '').trim().toLowerCase()

/** cid → symbol（查已加载的币种表；未加载/未命中 ⇒ 原样返回数字串，调用方兜底） */
const slugOf = (row) => {
  if (!row) return ''
  const sym = String(row.symbol ?? '').trim().toLowerCase()
  if (/^[a-z0-9-]{1,16}$/.test(sym)) return sym
  return String(row.name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const cidSymbol = (cid, list = []) => {
  const hit = list.find((row) => String(row.cid) === String(cid))
  return hit ? String(hit.symbol ?? '') : String(cid)
}

const MarketPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  // ★ 0076（Kevin 2026-10-23 ①③）：路径参数化 + 无参 = 币种选择页
  //   · `/exchange/<symbol>`（不分大小写）⇒ 命中 listed 币 ⇒ base = cid；
  //   · `/exchange?base=N` 旧链接 ⇒ 兼容重定向 `/exchange/<symbol>`（replace，保语言前缀）；
  //   · `/exchange`（无 symbol 无 base）⇒ **选择模式**：渲染币种选择界面，不渲染行情体；
  //   · symbol 未命中 ⇒ 404 提示页（NotFoundPage，零请求）。
  const params = useParams()
  const routeSymbol = typeof params?.symbol === 'string' ? String(params.symbol).trim() : ''
  const langPrefix = /^\/(en|hk|vn)(\/|$)/.test(location.pathname) ? location.pathname.slice(0, 3) : ''
  // 解析态：'resolving'（等 currencies）· 'ok' · 'unknown'（symbol 未命中 ⇒ 404）
  const [resolveState, setResolveState] = useState(routeSymbol ? 'resolving' : 'pending')

  // 「标的币种」combobox（Kevin 2026-10-21）：
  //   · `base` 仍是**已提交**的币种编号（挂单/盘口的唯一真源，语义与旧手填一致）；
  //   · 初值取 URL `?base=`（合法正整数才采纳；`?base=N` 直进 ⇒ 回显对应 symbol，无对应 ⇒ 回显数字）；
  //   · 面板内输入只进 `query`（过滤用），**提交动作** = 点选 / Enter（选项）或纯数字失焦；
  //   · Esc / 失焦关闭面板且**零请求**（关面板纯本地态，不发任何网络调用）。
  const [base, setBase] = useState(() => {
    const raw = String(searchParams.get('base') ?? '').trim()
    return /^\d+$/.test(raw) && Number(raw) > 0 ? String(Number(raw)) : ''
  })
  const [currencies, setCurrencies] = useState([]) // `GET /api/currencies` 选项源（公开面，挂载取一次）
  const [panelOpen, setPanelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const [form, setForm] = useState({ side: 'buy', price: '', amount: '' })
  const [book, setBook] = useState({ phase: 'idle', rows: [], message: '' })
  const [trades, setTrades] = useState({ phase: 'idle', rows: [], message: '' })
  const [mine, setMine] = useState({ phase: 'idle', rows: [], message: '' })
  // 批 7-A：账本流水（转让口径）= `GET /api/user/ledger?kind=transfer` 真数据；
  //   `next` = `next_before_txid` 游标（`null` = 到底）；真·零流水 ⇒ 空态。
  const [ledger, setLedger] = useState({ rows: [], next: null, message: '' })
  const [act, setAct] = useState({ phase: 'idle', message: '' })
  // 0076（Kevin 2026-10-23 ②）：全网持币人（公开只读；`GET /api/currency/:cid/holders`）
  const [holders, setHolders] = useState({ phase: 'idle', total: 0, rows: [], message: '' })
  const tracker = useMemo(() => createOrderPlaceTracker(), [])

  const baseCid = Number(base)
  const basePositive = Number.isInteger(baseCid) && baseCid > 0
  // §5.103 裁定：`baseCid === QUOTE_CID`（`$` 对自身）= **退化币对** —— 与「`quote_cid` 恒 1 且 base≠quote」互斥
  // ⇒ 该路径恒空态；本页**结构性不发请求**（不是「请求回来恰好是空」）。
  const baseDegenerate = basePositive && baseCid === QUOTE_CID
  const baseValid = basePositive && !baseDegenerate

  // 行情（公开面）：**只有合法且非退化**的 base_cid 才请求（退化 ⇒ 不发；未填/非法 ⇒ 不发）
  const loadMarket = useCallback(async () => {
    if (baseDegenerate) {
      const message = t('market.pairDegenerate')
      setBook({ phase: 'empty', rows: [], message })
      setTrades({ phase: 'empty', rows: [], message })
      return
    }
    if (!baseValid) {
      setBook({ phase: 'empty', rows: [], message: t('market.bookEmpty') })
      setTrades({ phase: 'empty', rows: [], message: t('market.tradesEmpty') })
      return
    }
    setBook({ phase: 'loading', rows: [], message: t('loading') })
    setTrades({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const [bookRows, tradeRows] = await Promise.all([
        fetchOrderBook(baseCid, user),
        fetchMarketTrades(baseCid, user, MARKET_LIMIT),
      ])
      const b = Array.isArray(bookRows) ? bookRows : []
      const tr = Array.isArray(tradeRows) ? tradeRows : []
      setBook({ phase: b.length ? 'ok' : 'empty', rows: b, message: b.length ? '' : t('market.bookEmpty') })
      setTrades({ phase: tr.length ? 'ok' : 'empty', rows: tr, message: tr.length ? '' : t('market.tradesEmpty') })
    } catch (error) {
      const message = String(error?.message || t('error'))
      setBook({ phase: 'error', rows: [], message })
      setTrades({ phase: 'error', rows: [], message })
    }
  }, [baseValid, baseCid, user, t])

  const loadMine = useCallback(async () => {
    if (!isAuthenticated) {
      setMine({ phase: 'empty', rows: [], message: t('pleaseLogin') })
      return
    }
    setMine({ phase: 'loading', rows: [], message: t('loading') })
    try {
      const rows = await fetchMyOrders(user)
      const list = Array.isArray(rows) ? rows : []
      setMine({ phase: list.length ? 'ok' : 'empty', rows: list, message: list.length ? '' : t('market.mineEmpty') })
    } catch (error) {
      setMine({ phase: 'error', rows: [], message: String(error?.message || t('error')) })
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { loadMarket() }, [loadMarket])
  useEffect(() => { loadMine() }, [loadMine])

  // 批 7-A：账本流水（**转让口径** `kind=transfer`；§5.1「碎片读口 ②」语义替代面）。
  //   未登录 ⇒ 空态；已登录 ⇒ 读 `GET /api/user/ledger?kind=transfer`（DL25 keyset 分页）。
  const loadLedger = useCallback(async (beforeTxid = null) => {
    if (!isAuthenticated) {
      setLedger({ rows: [], next: null, message: t('pleaseLogin') })
      return
    }
    try {
      const { rows, nextBeforeTxid } = await fetchMyLedger({
        user,
        kind: 'transfer',
        beforeTxid,
        limit: LEDGER_PAGE_SIZE,
      })
      setLedger((prev) => ({
        rows: beforeTxid ? [...prev.rows, ...rows] : rows,
        next: nextBeforeTxid,
        message: '',
      }))
    } catch (error) {
      setLedger((prev) => ({ ...prev, message: String(error?.message || t('error')) }))
    }
  }, [isAuthenticated, user, t])

  useEffect(() => { loadLedger(null) }, [loadLedger])

  // combobox 选项源：`GET /api/currencies`（公开面，未登录也 200）⇒ 挂载取一次。
  //   失败 / 空列表 ⇒ 空选项（面板无可选项），**纯数字手填路径照旧可用**（不白屏、不加文案键）。
  useEffect(() => {
    let cancelled = false
    fetchCurrencies(user)
      .then((rows) => {
        if (cancelled) return
        setCurrencies(Array.isArray(rows) ? rows.filter((row) => row && row.cid !== undefined && row.cid !== null) : [])
      })
      .catch(() => { if (!cancelled) setCurrencies([]) })
    return () => { cancelled = true }
    // 选项源是公开静态面，挂载取一次即可（登录态变化不重取；`user` 只作透传）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 0076：symbol 解析 / `?base=` 兼容重定向 / 选择模式判定 ----------------
  useEffect(() => {
    if (!currencies.length) return // 列表未到位，等下一轮
    const pick = (cid) => {
      navigate(`${langPrefix}/exchange/${slugOf(currencies.find((row) => String(row.cid) === String(cid)) || { name: String(cid) })}`, { replace: true })
    }
    if (routeSymbol) {
      const seg = normNeedle(routeSymbol)
      // 解析口径：slug（symbol ASCII 直用 / name 连字化）· symbol · name · 纯数字直认 cid
      // （末位兜底保留旧 `?base=999` 直进数字的能力）
      const hit = currencies.find((row) => slugOf(row) === seg)
        || currencies.find((row) => normNeedle(row.symbol) === seg)
        || currencies.find((row) => normNeedle(row.name) === seg)
      if (hit) {
        setResolveState('ok')
        setBase((prev) => (prev === String(hit.cid) ? prev : String(hit.cid)))
      } else if (/^\d+$/.test(seg) && Number(seg) > 0) {
        setResolveState('ok')
        setBase((prev) => (prev === String(Number(seg)) ? prev : String(Number(seg))))
      } else {
        setResolveState('unknown')
      }
      return
    }
    const qsBase = String(searchParams.get('base') ?? '').trim()
    if (/^\d+$/.test(qsBase) && Number(qsBase) > 0) {
      const hit = currencies.find((row) => String(row.cid) === String(Number(qsBase)))
      if (hit) { navigate(`${langPrefix}/exchange/${slugOf(hit)}`, { replace: true }) }
      else if (/^\d+$/.test(qsBase)) { navigate(`${langPrefix}/exchange/${Number(qsBase)}`, { replace: true }) }
      else { navigate(`${langPrefix}/exchange`, { replace: true }) }
      return
    }
    setResolveState('pending') // 选择模式
  }, [currencies, routeSymbol, searchParams, langPrefix])

  // ---- combobox 派生态与提交动作 ---------------------------------------------
  //   · 选项池 = listed 币**排除 cid 1**（§5.103：`$` 对自身 = 退化币对，不可作 base 选中）；
  //   · 回显 = 已提交 base 对应行的 `symbol`（查**全量**表，cid 1 也能回显 `$`）；无对应 ⇒ 回显数字；
  //   · 提交动作统一走 `commitBase` ⇒ `base` 状态 + URL `?base=`（replace，不刷历史栈）双写。
  const optionPool = useMemo(
    () => currencies.filter((row) => Number(row.cid) !== QUOTE_CID),
    [currencies],
  )
  const needle = normNeedle(query)
  const filtered = useMemo(() => {
    if (!needle) return optionPool
    return optionPool.filter((row) => (
      normNeedle(row.symbol).includes(needle)
      || normNeedle(row.name).includes(needle)
      || String(row.cid).includes(needle)
    ))
  }, [optionPool, needle])
  const selectedRow = useMemo(
    () => currencies.find((row) => Number(row.cid) === baseCid),
    [currencies, baseCid],
  )
  const baseEcho = base === '' ? '' : String((selectedRow && (selectedRow.symbol || selectedRow.name)) || base)

  const closeBasePanel = useCallback(() => {
    setPanelOpen(false)
    setQuery('')
    setActiveIdx(-1)
  }, [])

  const commitBase = useCallback((cid) => {
    setBase(cid)
    // 0076：选择即入路径（`/exchange/<symbol>`，replace 不刷历史栈）；旧 `?base=` 不再写回
    navigate(`${langPrefix}/exchange/${slugOf(currencies.find((row) => String(row.cid) === String(cid)) || { name: String(cid) })}`, { replace: true })
  }, [langPrefix, currencies])

  const selectBaseOption = useCallback((row) => {
    commitBase(String(row.cid))
    closeBasePanel()
  }, [commitBase, closeBasePanel])

  const onBaseFocus = () => {
    // 面板打开时清显全文，便于改搜（关面板后由 `baseEcho` 恢复选中币 symbol）
    setPanelOpen(true)
    setQuery('')
    setActiveIdx(-1)
  }

  const onBaseChange = (event) => {
    const text = event.target.value
    if (!panelOpen) setPanelOpen(true)
    setQuery(text)
  }

  const onBaseBlur = () => {
    const text = normNeedle(query)
    closeBasePanel()
    // 纯数字直输 ⇒ 既有行为：base = 该 cid（404/无效走现兜底）；非数字文本 = 放弃本次搜索（零请求）。
    if (/^\d+$/.test(text)) {
      const normalized = String(Number(text))
      if (normalized !== base) commitBase(normalized)
    }
  }

  const onBaseKeyDown = (event) => {
    if (!panelOpen) return // 面板关闭时 Enter 走表单默认提交（既有行为）
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIdx((i) => (filtered.length ? Math.min(i + 1, filtered.length - 1) : -1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIdx((i) => (i <= 0 ? -1 : i - 1))
    } else if (event.key === 'Enter') {
      // 面板开着 ⇒ Enter 永不提交表单：有高亮选中高亮项，否则选第一项；零命中 ⇒ 不动作
      event.preventDefault()
      const idx = activeIdx >= 0 && filtered[activeIdx] ? activeIdx : (filtered.length ? 0 : -1)
      if (idx >= 0) selectBaseOption(filtered[idx])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeBasePanel()
    }
  }

  const loadHolders = useCallback(async () => {
    if (!baseValid) {
      setHolders({ phase: 'idle', total: 0, rows: [], message: '' })
      return
    }
    setHolders((prev) => ({ ...prev, phase: 'loading' }))
    try {
      // ★ `fetchApiJson` 已 unwrap 到 `payload.data`（`auth.js:631`）⇒ 这里直接就是数据体，
      //   再取 `.data` 会恒 undefined（首版即踩：接口 200 但面板恒「暂无持币用户」）。
      const data = (await fetchCurrencyHolders(baseCid, user)) ?? {}
      setHolders({ phase: 'done', total: Number(data.total_holders ?? 0), rows: Array.isArray(data.holders) ? data.holders : [], message: '' })
    } catch (error) {
      setHolders((prev) => ({ ...prev, phase: 'error', message: String(error?.message ?? 'holders failed') }))
    }
  }, [baseCid, baseValid])

  useEffect(() => {
    loadHolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCid, baseValid])

  const refresh = async () => {
    await Promise.all([loadMarket(), loadMine(), loadLedger(null), loadHolders()])
  }

  const onPlace = async (event) => {
    event.preventDefault()
    if (act.phase === 'loading') return
    if (!baseValid) {
      setAct({ phase: 'error', message: t('market.baseNote') })
      return
    }
    const fingerprint = orderPlaceFingerprint({ side: form.side, baseCid, price: form.price, amount: form.amount })
    const createKey = tracker.keyFor(fingerprint) // 同一次操作重试 ⇒ 同键（服务端 fail-loud，缺键 ⇒ 400）
    setAct({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await placeOrder({
        side: form.side,
        baseCid,
        price: String(form.price).trim(),
        amount: String(form.amount).trim(),
        createKey,
        user,
      })
      tracker.reset()
      setAct({ phase: 'ok', message: t('market.placeOk') })
      await refresh()
    } catch (error) {
      setAct({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const onCancel = async (orderId) => {
    setAct({ phase: 'loading', message: t('jobs.submitting') })
    try {
      await cancelOrder(orderId, user) // 键 = 服务端派生 ⇒ 前端不传；手续费不退（DL87）
      setAct({ phase: 'ok', message: t('market.cancelOk') })
      await refresh()
    } catch (error) {
      setAct({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const onCancelAll = async () => {
    setAct({ phase: 'loading', message: t('jobs.submitting') })
    try {
      // **query only**：本层不发 body（§9.B B12）。回包 `data` = `{cancelled, attempted, failed, orders}`
      //   （`market-service.ts:425` 现取）⇒ 提示文案带**服务端计数**，不再笼统一句「已撤销全部挂单」
      //   （cancelled=0 时那句是假阳性：本来就没有活动挂单）。
      const view = await cancelAllOrders(user)
      const cancelled = Number(view?.cancelled)
      const failed = Number(view?.failed)
      const cancelledN = Number.isFinite(cancelled) && cancelled > 0 ? cancelled : 0
      const failedN = Number.isFinite(failed) && failed > 0 ? failed : 0
      if (failedN > 0) {
        // 部分/全部失败：有成功过 ⇒ 中性提示；一单没撤成 ⇒ 错误态（与「已撤」区分）
        setAct({
          phase: cancelledN > 0 ? 'ok' : 'error',
          message: t('market.cancelPartial', { n: failedN }),
          cancelled: cancelledN,
          failed: failedN,
        })
      } else if (cancelledN > 0) {
        setAct({ phase: 'ok', message: t('market.cancelAllOkCount', { n: cancelledN }), cancelled: cancelledN, failed: 0 })
      } else {
        setAct({ phase: 'ok', message: t('market.cancelAllNone'), cancelled: 0, failed: 0 })
      }
      await refresh()
    } catch (error) {
      setAct({ phase: 'error', message: String(error?.message || t('error')) })
    }
  }

  const lastTrade = trades.rows[0] || null
  // 价格走势：成交行（最新在前）⇒ 升序序列 ⇒ viewBox 几何。真空（零笔可绘）⇒ `null` ⇒ 空态占位。
  const trendSeries = useMemo(() => buildTrendSeries(trades.rows), [trades.rows])
  const trend = useMemo(() => trendGeometry(trendSeries), [trendSeries])
  // 「我的挂单」只画面板活动单（已终结态 `filled`/`cancelled` 已由服务端写入，但列表仍是全量）
  const activeMineRows = useMemo(() => mine.rows.filter(isActiveMarketOrder), [mine.rows])
  // TR-2：当前语言（`utils.SUPPORTED_LANGS` 同一白名单）。
  //   · 「我的挂单」行 = `market_order` 行（`/api/order`）⇒ 面板渲染的文本键只有 `name`/`title`（用户录入文本）。
  //   · R-7E-6（批 8 A 小项）：`side`/`status` 是 **DB 枚举**（`open`/`filled`/`buy`…），**不得入翻译面** ——
  //     它们由 `orders.statusLabel.*` / `orders.sideLabel.*` 查表渲染（下方渲染处），不走 `*_<lang>` 后缀列。
  //     故本行 keys 收敛为 `['name','title']`（去 `side`/`status`）。
  const lang = getLanguageFromUrl(location.pathname)
  const mineRows = activeMineRows.map((row) => localizeFields(row, ['name', 'title'], lang))

  // ---- 0076 渲染分支：symbol 未命中 ⇒ 404；选择模式 ⇒ 币种选择界面（不渲染行情体） ----
  if (resolveState === 'unknown') {
    return <NotFoundPage />
  }
  const pickerMode = resolveState === 'pending' && !base

  // ---- 持币人面板（0076 ②）：baseValid 才渲染；空态 / 失败态内联，不打断其它区块 ----
  const holdersPanel = baseValid ? (
    <section className="sf-panel sf-mkt-holders" data-sf-m="holders">
      <h2 className="sf-mkt-sec-title" data-sf-m="holders-title">{t('market.holdersTitle')}</h2>
      {holders.phase === 'error' ? (
        <p className="sf-foot-note" data-sf-m="holders-error" role="alert">{t('market.holdersFail')}</p>
      ) : holders.rows.length === 0 ? (
        <p className="sf-foot-note" data-sf-m="holders-empty">{t('market.holdersEmpty')}</p>
      ) : (
        <>
          <p className="sf-foot-note" data-sf-m="holders-total">{t('market.holdersTotal', { n: holders.total })}</p>
          <ol className="sf-mkt-holders-list" data-sf-m="holders-list">
            {holders.rows.map((row) => (
              <li className="sf-mkt-holder" data-sf-m="holder-row" data-sf-rank={String(row.rank ?? '')} key={String(row.rank)}>
                <span className="sf-mkt-holder-rank">{`#${String(row.rank ?? '-')}`}</span>
                <span className="sf-mkt-holder-addr" data-sf-addr={row.evm_masked || undefined}>{String(row.evm_masked ?? '-')}</span>
                <span className="sf-mkt-holder-bal" data-sf-balance={String(row.balance ?? '')}>{String(row.balance ?? '-')}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  ) : null

  return (
    <div className="sf-layout" data-sf-m="mkt-layout">
      <div className="sf-layout-main">
        {pickerMode ? (
          <div className="sf-mkt" data-sf-m="mkt-pick">
            <div className="sf-mkt-head" data-sf-m="mkt-pick-hero">
              <h1 className="sf-mkt-title">{t('market.title')}</h1>
              <p className="sf-mkt-note">{t('market.pickNote')}</p>
            </div>
            <section className="sf-panel" data-sf-m="pick-panel">
              <h2 className="sf-mkt-sec-title" data-sf-m="pick-title">{t('market.pickTitle')}</h2>
              <ul className="sf-mkt-pick-list" data-sf-m="pick-list">
                {optionPool.map((row) => (
                  <li className="sf-mkt-pick-item" key={String(row.cid)}>
                    <Link
                      className="sf-btn sf-mkt-btn"
                      data-sf-m="pick-option"
                      data-sf-symbol={String(row.symbol ?? '')}
                      to={`${langPrefix}/exchange/${slugOf(row)}`}
                    >
                      <span className="sf-mkt-pick-sym">{String(row.symbol ?? '')}</span>
                      <span className="sf-mkt-pick-name">{String(row.name ?? '')}</span>
                      <span className="sf-mkt-pick-cta">{t('market.pickCta')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
        <div className="sf-mkt" data-sf-m="mkt">
          <div className="sf-mkt-head" data-sf-m="mkt-hero">
            <h1 className="sf-mkt-title">{t('market.title')}</h1>
            <p className="sf-mkt-note">{t('market.note')}</p>
            <div className="sf-mkt-actions">
              <button className="sf-btn sf-mkt-btn" type="button" onClick={refresh} data-sf-m="mkt-refresh">{t('market.refresh')}</button>
            </div>
          </div>

          {/* 行情条：窄屏单列 / 宽屏两列；无成交 ⇒ 显示占位，不用假数据。
              第三块 = 价格走势（sparkline，零新依赖/零新接口）：数据 = 同一份 `trades.rows`（升序后出图）。 */}
          <div className="sf-mkt-ticker" data-sf-m="mkt-ticker">
            <div>
              <div className="sf-mkt-pair">{`#${baseValid ? baseCid : '-'} / #${QUOTE_CID}`}</div>
              <div className="sf-mkt-last">{trades.phase === 'ok' && lastTrade ? String(lastTrade.price ?? '-') : '-'}</div>
            </div>
            <div>
              <div className="sf-mkt-pair">{t('market.trades')}</div>
              <div className="sf-mkt-meta">{`${trades.phase} · ${trades.rows.length}`}</div>
            </div>
            <div className="sf-mkt-trend" data-sf-m="mkt-trend" data-sf-points={trendSeries.length}>
              <div className="sf-mkt-trend-head">
                <span className="sf-mkt-pair">{t('market.priceTrend')}</span>
                {trend && (
                  <span className="sf-mkt-trend-range" data-sf-m="mkt-trend-range">
                    {t('market.trendRange', {
                      high: String(trend.max),
                      low: String(trend.min),
                      last: String(trend.last),
                    })}
                  </span>
                )}
              </div>
              {!trend
                ? <div className="sf-mkt-trend-empty" data-sf-m="mkt-trend-empty">{trades.message || t('market.tradesEmpty')}</div>
                : (
                  <svg
                    className={`sf-mkt-trend-svg ${trend.dir < 0 ? 'sf-mkt-trend-down' : 'sf-mkt-trend-up'}`}
                    data-sf-m="mkt-trend-svg"
                    data-sf-dir={trend.dir < 0 ? 'down' : 'up'}
                    data-sf-count={trend.count}
                    viewBox={`0 0 ${TREND_VIEW_W} ${TREND_VIEW_H}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={t('market.priceTrend')}
                  >
                    <defs>
                      <linearGradient id="sf-mkt-trend-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop className="sf-mkt-trend-stop-top" offset="0" />
                        <stop className="sf-mkt-trend-stop-bottom" offset="1" />
                      </linearGradient>
                    </defs>
                    <path className="sf-mkt-trend-area" d={trend.area} fill="url(#sf-mkt-trend-grad)" />
                    <path className="sf-mkt-trend-line" d={trend.line} />
                    {/* 末点圆点：zero-length 段 + round linecap（`vector-effect` 保证不被 viewBox 拉伸成椭圆） */}
                    <path className="sf-mkt-trend-dot" d={`M${trend.dot.x},${trend.dot.y} l0.01,0`} data-sf-m="mkt-trend-dot" />
                  </svg>
                )}
            </div>
          </div>

          {/* 挂单：`create_key` = 前端供键（fail-loud） */}
          <form className="sf-mkt-panel" onSubmit={onPlace} data-sf-m="mkt-form">
            <div className="sf-mkt-form">
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.side')}</span>
                <select
                  className="sf-mkt-select"
                  data-sf-m="mkt-side"
                  value={form.side}
                  onChange={(e) => setForm((p) => ({ ...p, side: e.target.value }))}
                >
                  <option value="buy">{t('market.buy')}</option>
                  <option value="sell">{t('market.sell')}</option>
                </select>
              </label>
              {/* 「标的币种」combobox（Kevin 2026-10-21）：可下拉选 / 可输入名称过滤命中（如 bttc ⇒ BTTC）。
                  A11y：input role=combobox + aria-expanded/controls/activedescendant，
                  面板 role=listbox、行 role=option（站内首例，无既有 combobox 体例可承）。
                  结构说明：面板**不得**置于 <label> 内（label 内容模型只许 phrasing），
                  故改用 `htmlFor` + `id` 显式关联；`.sf-mkt-base-anchor` 为定位锚。 */}
              <div className="sf-mkt-field sf-mkt-field-base" data-sf-m="mkt-base-field">
                <label className="sf-mkt-label" htmlFor="sf-mkt-base-input">{t('market.baseCid')}</label>
                <div className="sf-mkt-base-anchor">
                  <input
                    id="sf-mkt-base-input"
                    className="sf-mkt-input"
                    data-sf-m="mkt-input-base"
                    role="combobox"
                    aria-expanded={panelOpen}
                    aria-controls={panelOpen ? 'sf-mkt-base-listbox' : undefined}
                    aria-activedescendant={panelOpen && activeIdx >= 0 && filtered[activeIdx] ? `sf-mkt-base-opt-${activeIdx}` : undefined}
                    aria-autocomplete="list"
                    autoComplete="off"
                    value={panelOpen ? query : baseEcho}
                    placeholder={t('market.baseNote')}
                    onFocus={onBaseFocus}
                    onChange={onBaseChange}
                    onBlur={onBaseBlur}
                    onKeyDown={onBaseKeyDown}
                  />
                  {panelOpen && (
                    <div
                      className="sf-mkt-base-panel"
                      data-sf-m="mkt-base-listbox"
                      role="listbox"
                      id="sf-mkt-base-listbox"
                      aria-label={t('market.baseCid')}
                    >
                      {filtered.map((row, i) => (
                        <div
                          key={String(row.cid)}
                          id={`sf-mkt-base-opt-${i}`}
                          role="option"
                          aria-selected={i === activeIdx}
                          className={`sf-mkt-base-opt${i === activeIdx ? ' sf-mkt-base-opt-active' : ''}`}
                          data-sf-m="mkt-base-option"
                          data-sf-cid={String(row.cid)}
                          onMouseDown={(e) => { e.preventDefault(); selectBaseOption(row) }}
                        >
                          {baseOptionText(row)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.price')}</span>
                <input
                  className="sf-mkt-input"
                  data-sf-m="mkt-input-price"
                  value={form.price}
                  inputMode="numeric"
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  required
                />
              </label>
              <label className="sf-mkt-field">
                <span className="sf-mkt-label">{t('market.amount')}</span>
                <input
                  className="sf-mkt-input"
                  data-sf-m="mkt-input-amount"
                  value={form.amount}
                  inputMode="numeric"
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="sf-mkt-row">
              <button className="sf-btn sf-mkt-btn" type="submit" data-sf-m="mkt-primary" disabled={act.phase === 'loading' || !isAuthenticated}>
                {t('market.place')}
              </button>
              <span
                className={`sf-mkt-status${act.phase === 'error' ? ' sf-mkt-err' : ''}${act.phase === 'ok' ? ' sf-mkt-ok' : ''}`}
                data-sf-m="mkt-status"
                data-sf-phase={act.phase}
                data-sf-cancelled={act.cancelled === undefined ? undefined : act.cancelled}
                data-sf-failed={act.failed === undefined ? undefined : act.failed}
                role="status"
              >
                {act.message}
              </span>
            </div>
            <p className="sf-mkt-note">{t('market.placeNote')}</p>
          </form>

          {/* 盘口 + 成交流水：窄屏单列 / 宽屏两列（DOM 顺序恒定） */}
          <div className="sf-mkt-cols">
            <div className="sf-mkt-panel" data-sf-m="mkt-book">
              <h2 className="sf-mkt-title">{t('market.book')}</h2>
              {book.rows.length === 0
                ? <div className="sf-mkt-empty" data-sf-m="mkt-book-empty">{book.message || t('market.bookEmpty')}</div>
                : book.rows.map((row, i) => (
                  <div className="sf-mkt-book-row" key={`${row.side}-${row.price}-${i}`}>
                    <span className={row.side === 'buy' ? 'sf-mkt-side-buy' : 'sf-mkt-side-sell'}>
                      {row.side === 'buy' ? t('market.buy') : t('market.sell')}
                    </span>
                    <span>{String(row.price ?? '-')}</span>
                    <span>{String(row.volume ?? '-')}</span>
                  </div>
                ))}
              <p className="sf-mkt-note">{t('market.bookNote')}</p>
            </div>

            <div className="sf-mkt-panel" data-sf-m="mkt-trades">
              <h2 className="sf-mkt-title">{t('market.trades')}</h2>
              {trades.rows.length === 0
                ? <div className="sf-mkt-empty" data-sf-m="mkt-trades-empty">{trades.message || t('market.tradesEmpty')}</div>
                : trades.rows.map((row, i) => (
                  <div className="sf-mkt-trade-row" key={String(row.trID ?? row.trade_id ?? i)}>
                    <span>{String(row.price ?? '-')}</span>
                    <span>{String(row.volume ?? row.amount ?? '-')}</span>
                    <span>{`#${String(row.buyer_uID ?? '-')}→#${String(row.seller_uID ?? '-')}`}</span>
                  </div>
                ))}
              <p className="sf-mkt-note">{t('market.tradesNote')}</p>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="sf-layout-side">
{holdersPanel}
        <div className="sf-mkt-panel" data-sf-m="mkt-mine">
          <h2 className="sf-mkt-title">{t('market.mine')}</h2>
          <div className="sf-mkt-row">
            <button
              className="sf-btn sf-mkt-btn"
              type="button"
              onClick={onCancelAll}
              data-sf-m="mkt-cancel-all"
              disabled={!isAuthenticated || act.phase === 'loading'}
            >
              {t('market.cancelAll')}
            </button>
          </div>
          {activeMineRows.length === 0
            ? <div className="sf-mkt-empty" data-sf-m="mkt-mine-empty">{mine.message || t('market.mineEmpty')}</div>
            : mineRows.map((row) => {
              // P7-E 小尾巴批-β ②：枚举字段（`status`/`side`）**不得原样渲染**（原文把 `market_order`
              //   的 DB 枚举 `open`/`buy` 等直接给用户看）。已知取值 ⇒ 四语标签（`orders.statusLabel.*`
              //   / `orders.sideLabel.*`）；**未知取值 ⇒ 本地化兜底**；原值留 `title`/`data-sf-*`（仅排查用）；
              //   缺省/空串 ⇒ 空串（维持既有口径）。
              const statusRaw = row.status == null || row.status === '' ? '' : String(row.status)
              const statusText = statusRaw === ''
                ? ''
                : (MARKET_ORDER_STATUS_KEYS.includes(statusRaw)
                  ? t(`orders.statusLabel.${statusRaw}`)
                  : t('orders.statusLabel.unknown'))
              const sideRaw = row.side == null || row.side === '' ? '' : String(row.side)
              const sideText = sideRaw === ''
                ? ''
                : (MARKET_ORDER_SIDE_KEYS.includes(sideRaw)
                  ? t(`orders.sideLabel.${sideRaw}`)
                  : t('orders.sideLabel.unknown'))
              return (
                <div className="sf-mkt-item" key={String(row.order_id ?? row.oID)} data-sf-m="mkt-order">
                  <div className="sf-mkt-item-title" data-sf-side={sideRaw || undefined} title={sideRaw || undefined}>
                    {`#${String(row.order_id ?? row.oID ?? '-')} · ${sideText}`}
                    {/* 「翻译中」小标（`i18n_status ∈ {pending, partial}`；ready/缺省 ⇒ null） */}
                    <TranslatingBadge status={contentStatus(row)} />
                  </div>
                  <div className="sf-mkt-price">{String(row.price ?? '-')}</div>
                  <div className="sf-mkt-meta" data-sf-status={statusRaw || undefined} title={statusRaw || undefined}>{`${String(row.amount ?? '-')}/${String(row.amount_filled ?? '-')} · ${statusText}`}</div>
                  <button
                    className="sf-btn sf-mkt-btn"
                    type="button"
                    onClick={() => onCancel(String(row.order_id ?? row.oID ?? ''))}
                    data-sf-m="mkt-cancel-one"
                  >
                    {t('market.cancel')}
                  </button>
                </div>
              )
            })}
          <p className="sf-mkt-note">{t('market.mineNote')}</p>
        </div>

        {/* 账本流水（**转让口径**）：读口 = 已注册 `GET /api/user/ledger?kind=transfer`
            （§5.1「碎片读口 ②」；批 7-A 接线）⇒ 渲染真数据；**仅当真·零流水**时才显示空态。 */}
        <div className="sf-mkt-panel" data-sf-m="mkt-ledger">
          <h2 className="sf-mkt-title">{t('ledger.flow')}</h2>
          {ledger.rows.length === 0
            ? <div className="sf-mkt-empty" data-sf-m="mkt-ledger-empty">{ledger.message || t('ledger.flowEmpty')}</div>
            : (
              <div data-sf-m="mkt-ledger-list">
                {ledger.rows.map((entry) => (
                  <div className="sf-mkt-item" key={String(entry.txid)} data-sf-m="mkt-ledger-item">
                    <div className="sf-mkt-item-title">{t(`ledger.kind.${entry.kind}`)}</div>
                    <div className="sf-mkt-meta">
                      {`${Number(entry.delta) > 0 ? '+' : ''}${entry.delta}`}
                      {' · '}
                      {entry.time_created ? new Date(entry.time_created * 1000).toLocaleDateString() : '—'}
                    </div>
                  </div>
                ))}
                {ledger.next != null && (
                  <button
                    type="button"
                    className="sf-mkt-btn"
                    data-sf-m="mkt-ledger-more"
                    onClick={() => loadLedger(ledger.next)}
                  >
                    {t('ledger.flowMore')}
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

export default MarketPage
