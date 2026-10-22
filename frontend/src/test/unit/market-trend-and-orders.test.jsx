/**
 * /exchange 价格走势（sparkline）+「我的挂单」活动单过滤 + 撤全计数提示（Kevin 2026-10-22 · 本单新增）
 *
 * 口径（派单逐条）：
 *   ① 走势图数据 = 同一份 `trades.rows`（`GET /api/market/:base_cid/trades`，**最新在前**）
 *      ⇒ 按 `time_created` 升序出图；点数 = 可绘成交数（非数值 `price` 不入图，不补 0、不插值）；
 *   ② 单笔/全平也要好看：单笔 = 水平段 + 圆点；全平 = 中线；
 *   ③ 零成交 ⇒ 空态占位（**不造假数据**，不画线）；
 *   ④ 「我的挂单」只列**活动单**：`filled`/`cancelled` 不入面板（服务端列表是全量）；
 *      未知/缺省状态 fail-open 保留（`orders.statusLabel.unknown` 兜底，不泄原始枚举）；
 *   ⑤ 撤全提示带服务端计数：`cancelled>0` ⇒ `market.cancelAllOkCount(n)`；`cancelled=0` ⇒
 *      `market.cancelAllNone`；`failed>0` ⇒ `market.cancelPartial(n)`（有成功过 = ok 态，一单没撤成 = error 态）；
 *   ⑥ 新增 5 键四语齐备（vn 待复核）。
 *
 * 替身体例承 `market-base-combobox.test.jsx`：`t` 与 `useAuth()` 都取**模块级同一引用**
 * （否则页面 `useCallback([...,t])` 依赖每次变化 ⇒ 无限重渲染）；网络打在 `../../auth` 的
 * `fetchApiJson`（页面真实消费层）。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
import vn from '../../locales/vn.json'

// `t` 带插值：`market.trendRange(high=12,low=10,last=12)` —— 文案三臂/计数可断言
const stableT = (key, opts) => {
  if (!opts || typeof opts !== 'object') return key
  const pairs = Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')
  return `${key}(${pairs})`
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = { isAuthenticated: true, user: { uID: 7, token: 't' } }
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const H = vi.hoisted(() => ({
  orders: [],
  ordersAfterCancelAll: null,
  cancelAllView: { cancelled: 0, attempted: 0, failed: 0, orders: [] },
  trades: [],
}))

vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
    fetchApiJson: vi.fn(async (url, options = {}) => {
      const u = String(url)
      const method = options.method || 'GET'
      // 「我的挂单」全量面（含已终结行 —— 正是本单缺陷现场）
      if (u === '/api/order' && method === 'GET') return H.orders.map((r) => ({ ...r }))
      // 全体撤单：返回服务端计数视图，并把列表切成「已撤」（模拟真实后端：全量里仍能看到 cancelled 行）
      if (u === '/api/order' && method === 'DELETE') {
        if (H.ordersAfterCancelAll) H.orders = H.ordersAfterCancelAll.map((r) => ({ ...r }))
        return { ...H.cancelAllView }
      }
      if (/^\/api\/market\/\d+\/trades/.test(u)) return H.trades.map((r) => ({ ...r }))
      if (/^\/api\/market\/\d+\/orderbook/.test(u)) return []
      if (u.includes('/api/currencies')) return []
      return null
    }),
  }
})

vi.mock('../../ledger-api', () => ({
  fetchMyLedger: vi.fn(async () => ({ rows: [], nextBeforeTxid: null })),
  LEDGER_PAGE_SIZE: 20,
}))

import { buildTrendSeries, trendGeometry } from '../../pages/market/sparkline'
import MarketPage from '../../pages/market/MarketPage'

const TABLES = { zh, hk, en, vn }

const renderPage = (url = '/exchange?base=4') => render(
  <MemoryRouter initialEntries={[url]}>
    <MarketPage />
  </MemoryRouter>,
)

// 现取行键集（`database.ts:2442 normalizeMarketTrade`）：trID/bID/.../price/volume/time_created
const trade = (trID, price, timeCreated) => ({
  trID,
  bID: 4,
  buy_oID: 100 + trID,
  sell_oID: 200 + trID,
  buyer_uID: 7,
  seller_uID: 8,
  price,
  volume: 1,
  time_created: timeCreated,
  brand_symbol: '₿',
})

const order = (orderId, status, over = {}) => ({
  order_id: orderId,
  bID: 4,
  uID: 7,
  side: 'buy',
  price: 10,
  volume_total: 5,
  volume_filled: 0,
  status,
  ...over,
})

const orderRows = () => [...document.querySelectorAll('[data-sf-m="mkt-order"]')]
const orderIds = () => orderRows().map((el) => el.textContent.split(' · ')[0])
const statusEl = () => document.querySelector('[data-sf-m="mkt-status"]')
const trendEl = () => document.querySelector('[data-sf-m="mkt-trend"]')
const trendSvg = () => document.querySelector('[data-sf-m="mkt-trend-svg"]')
const rangeText = () => document.querySelector('[data-sf-m="mkt-trend-range"]')?.textContent || ''

beforeEach(() => {
  H.orders = []
  H.ordersAfterCancelAll = null
  H.cancelAllView = { cancelled: 0, attempted: 0, failed: 0, orders: [] }
  H.trades = []
})
afterEach(() => cleanup())

// ---------------------------------------------------------------------------
describe('① sparkline 纯几何层（空 / 单笔 / 多点 / 非数值过滤）', () => {
  it('空 ⇒ 无序列、无几何（空态由页面层渲染，不画线）', () => {
    expect(buildTrendSeries([])).toEqual([])
    expect(buildTrendSeries(null)).toEqual([])
    expect(trendGeometry([])).toBeNull()
  })

  it('单笔 ⇒ 水平段 + 视口中点圆点（single=true、dir=0）', () => {
    const series = buildTrendSeries([trade(1, 10, 100)])
    const geo = trendGeometry(series)
    expect(geo.count).toBe(1)
    expect(geo.single).toBe(true)
    expect(geo.flat).toBe(true)          // 单笔 = 全平 ⇒ 中线
    expect(geo.dir).toBe(0)
    expect(geo.line).toBe('M0,20 L100,20') // 高度 40 / pad 4 ⇒ 中线 y=20，整幅水平段
    expect(geo.dot).toEqual({ x: 50, y: 20 })
    expect(geo.area.endsWith('L100,40 L0,40 Z')).toBe(true) // 面积闭合到底边
  })

  it('多点 ⇒ 按 time_created 升序（入参最新在前）、高低/最新价正确、首末 x = 0/100', () => {
    // API 原序：最新在前 ⇒ trID 3(time 300) → 1(time 100)
    const series = buildTrendSeries([trade(3, 12, 300), trade(2, 11, 200), trade(1, 10, 100)])
    expect(series.map((p) => p.price)).toEqual([10, 11, 12])
    const geo = trendGeometry(series)
    expect(geo.count).toBe(3)
    expect(geo.single).toBe(false)
    expect(geo.min).toBe(10)
    expect(geo.max).toBe(12)
    expect(geo.last).toBe(12)
    expect(geo.dir).toBe(2)              // 涨
    expect(geo.line.startsWith('M0,')).toBe(true)
    expect(geo.line.endsWith('L100,4')).toBe(true) // 最高价贴 pad 上沿
    expect(geo.dot.x).toBe(100)
  })

  it('下跌序列 ⇒ dir<0（页面层据此取 --sf-down-fg）', () => {
    const series = buildTrendSeries([trade(3, 10, 300), trade(2, 11, 200), trade(1, 12, 100)])
    expect(trendGeometry(series).dir).toBe(-2)
  })

  it('非数值 price 不入图（不补 0、不插值）；同秒按 trID 升序', () => {
    const rows = [
      trade(5, '', 300),                  // 空串 ⇒ 过滤
      trade(4, null, 300),                // null ⇒ 过滤
      trade(3, 14, 200),
      trade(2, 13, 200),                  // 同秒：trID 小者在前
      { trID: 1, bID: 4 },                // 无 price 键 ⇒ 过滤
    ]
    const series = buildTrendSeries(rows)
    expect(series.map((p) => p.trID)).toEqual([2, 3])
    expect(series.map((p) => p.price)).toEqual([13, 14])
  })
})

// ---------------------------------------------------------------------------
describe('② 行情条走势图（在场 / 点数 = 成交数 / 涨跌色 / 空态）', () => {
  it('3 笔成交 ⇒ 折线在场、data-sf-points=3、最高/最低/最新标注齐备、涨 ⇒ up', async () => {
    H.trades = [trade(3, 12, 300), trade(2, 11, 200), trade(1, 10, 100)]
    renderPage()
    await waitFor(() => expect(trendSvg()).toBeTruthy())

    expect(trendEl().getAttribute('data-sf-points')).toBe('3')
    expect(trendSvg().getAttribute('data-sf-count')).toBe('3')
    expect(trendSvg().getAttribute('data-sf-dir')).toBe('up')
    expect(trendSvg().querySelector('.sf-mkt-trend-line')).toBeTruthy()
    expect(trendSvg().querySelector('.sf-mkt-trend-area')).toBeTruthy()
    expect(trendSvg().querySelector('.sf-mkt-trend-dot')).toBeTruthy()
    // 标注（小字）：最高 / 最低 / 最新
    expect(rangeText()).toBe('market.trendRange(high=12,low=10,last=12)')
    // 在场位置 = 行情条内的第三块
    expect(document.querySelector('[data-sf-m="mkt-ticker"] [data-sf-m="mkt-trend"]')).toBeTruthy()
  })

  it('下跌 ⇒ data-sf-dir=down（颜色由既有 token 类切换）', async () => {
    H.trades = [trade(3, 10, 300), trade(2, 11, 200), trade(1, 12, 100)]
    renderPage()
    await waitFor(() => expect(trendSvg()).toBeTruthy())
    expect(trendSvg().getAttribute('data-sf-dir')).toBe('down')
    expect(trendSvg().getAttribute('class')).toContain('sf-mkt-trend-down')
  })

  it('单笔成交 ⇒ 仍是折线形态（水平段 + 圆点），点数 = 1', async () => {
    H.trades = [trade(1, 10, 100)]
    renderPage()
    await waitFor(() => expect(trendSvg()).toBeTruthy())
    expect(trendEl().getAttribute('data-sf-points')).toBe('1')
    expect(trendSvg().querySelector('.sf-mkt-trend-line').getAttribute('d')).toBe('M0,20 L100,20')
    expect(rangeText()).toBe('market.trendRange(high=10,low=10,last=10)')
  })

  it('零成交 ⇒ 空态占位（无 svg、不造假数据）', async () => {
    H.trades = []
    renderPage()
    await waitFor(() => expect(trendEl()).toBeTruthy())
    expect(trendSvg()).toBeNull()
    expect(document.querySelector('[data-sf-m="mkt-trend-empty"]')).toBeTruthy()
    expect(trendEl().getAttribute('data-sf-points')).toBe('0')
    expect(rangeText()).toBe('') // 无成交 ⇒ 不标注高/低/最新
  })
})

// ---------------------------------------------------------------------------
describe('③ 「我的挂单」只列活动单（三态 + fail-open）', () => {
  it('全 open ⇒ 逐行照列（2 行）', async () => {
    H.orders = [order(901, 'open'), order(902, 'open')]
    renderPage()
    await waitFor(() => expect(orderRows().length).toBe(2))
    expect(orderIds()).toEqual(['#901', '#902'])
  })

  it('混合（open + partial + cancelled + filled）⇒ 只留活动单 2 行（已终结行不入面板）', async () => {
    H.orders = [
      order(901, 'open'),
      order(902, 'cancelled'),
      order(903, 'partial', { volume_filled: 2 }),
      order(904, 'filled', { volume_filled: 5 }),
    ]
    renderPage()
    await waitFor(() => expect(orderRows().length).toBe(2))
    expect(orderIds()).toEqual(['#901', '#903'])
    expect(document.querySelector('[data-sf-m="mkt-mine-empty"]')).toBeNull()
  })

  it('全完结（cancelled + filled）⇒ 面板空态 = market.mineEmpty（不是空列表）', async () => {
    H.orders = [order(902, 'cancelled'), order(904, 'filled')]
    renderPage()
    // 载入中先渲染 loading 文案 ⇒ 等取数落地后 = 空态键
    await waitFor(() => expect(document.querySelector('[data-sf-m="mkt-mine-empty"]').textContent).toBe('market.mineEmpty'))
    expect(orderRows().length).toBe(0)
  })

  it('未知 / 缺省状态 ⇒ fail-open 保留（藏行比显示更危险；原始枚举仍不上面）', async () => {
    H.orders = [order(905, 'sunset-value'), order(906, undefined)]
    renderPage()
    await waitFor(() => expect(orderRows().length).toBe(2))
    expect(orderIds()).toEqual(['#905', '#906'])
    expect(orderRows()[0].textContent).not.toContain('sunset-value')
  })
})

// ---------------------------------------------------------------------------
describe('④ 全体撤单：行消失 + 服务端计数提示（三臂）', () => {
  it('cancelled=2 ⇒ 撤后行消失（0 行 + 空态）、提示 = 已撤 2 单', async () => {
    H.orders = [order(901, 'open'), order(902, 'open')]
    H.cancelAllView = { cancelled: 2, attempted: 2, failed: 0, orders: [] }
    // 真实后端行为：撤后 `GET /api/order` 仍返回这两行，只是状态变 cancelled
    H.ordersAfterCancelAll = [order(901, 'cancelled'), order(902, 'cancelled')]
    renderPage()
    await waitFor(() => expect(orderRows().length).toBe(2))

    fireEvent.click(document.querySelector('[data-sf-m="mkt-cancel-all"]'))
    await waitFor(() => expect(statusEl().textContent).toBe('market.cancelAllOkCount(n=2)'))
    await waitFor(() => expect(orderRows().length).toBe(0))
    expect(document.querySelector('[data-sf-m="mkt-mine-empty"]').textContent).toBe('market.mineEmpty')
    expect(statusEl().getAttribute('data-sf-phase')).toBe('ok')
    expect(statusEl().getAttribute('data-sf-cancelled')).toBe('2')
    expect(statusEl().getAttribute('data-sf-failed')).toBe('0')
  })

  it('cancelled=0 ⇒ 提示「无活动挂单」（不再假报「已撤销全部挂单」）', async () => {
    H.orders = []
    H.cancelAllView = { cancelled: 0, attempted: 0, failed: 0, orders: [] }
    renderPage()
    fireEvent.click(document.querySelector('[data-sf-m="mkt-cancel-all"]'))
    await waitFor(() => expect(statusEl().textContent).toBe('market.cancelAllNone'))
    expect(statusEl().getAttribute('data-sf-phase')).toBe('ok')
    expect(statusEl().getAttribute('data-sf-cancelled')).toBe('0')
  })

  it('failed=1（部分失败且有一单成功）⇒ 提示部分失败计数，仍 ok 态', async () => {
    H.orders = [order(901, 'open'), order(902, 'open')]
    H.cancelAllView = { cancelled: 1, attempted: 2, failed: 1, orders: [{ order_id: 902, ok: false }] }
    H.ordersAfterCancelAll = [order(901, 'cancelled'), order(902, 'open')]
    renderPage()
    await waitFor(() => expect(orderRows().length).toBe(2))
    fireEvent.click(document.querySelector('[data-sf-m="mkt-cancel-all"]'))
    await waitFor(() => expect(statusEl().textContent).toBe('market.cancelPartial(n=1)'))
    expect(statusEl().getAttribute('data-sf-failed')).toBe('1')
    expect(statusEl().getAttribute('data-sf-phase')).toBe('ok')
    // 未撤成功的活动单仍在（902 open）
    await waitFor(() => expect(orderIds()).toEqual(['#902']))
  })

  it('failed=2 且 cancelled=0 ⇒ 错误态（一单没撤成不得报「已撤」）', async () => {
    H.orders = [order(901, 'open'), order(902, 'open')]
    H.cancelAllView = { cancelled: 0, attempted: 2, failed: 2, orders: [] }
    renderPage()
    await waitFor(() => expect(orderRows().length).toBe(2))
    fireEvent.click(document.querySelector('[data-sf-m="mkt-cancel-all"]'))
    await waitFor(() => expect(statusEl().textContent).toBe('market.cancelPartial(n=2)'))
    expect(statusEl().getAttribute('data-sf-phase')).toBe('error')
    // 刷新落地后列表未变（两单仍是 open ⇒ 仍在面板）
    await waitFor(() => expect(orderRows().length).toBe(2))
  })
})

// ---------------------------------------------------------------------------
describe('⑤ 新增 5 键四语齐备（vn 待复核）', () => {
  const NEW_KEYS = ['priceTrend', 'trendRange', 'cancelAllOkCount', 'cancelAllNone', 'cancelPartial']

  it('四语 market.* 新键均在场、非空串、键集逐语相等', () => {
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      for (const key of NEW_KEYS) {
        expect(typeof TABLES[lang].market[key], `${lang}.market.${key}`).toBe('string')
        expect(TABLES[lang].market[key].trim().length, `${lang}.market.${key}`).toBeGreaterThan(0)
      }
      expect(Object.keys(TABLES[lang].market).sort()).toEqual(Object.keys(TABLES.zh.market).sort())
    }
    // 带计数占位（插值面钉死，防手改文案丢占位）
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      expect(TABLES[lang].market.cancelAllOkCount).toContain('{{n}}')
      expect(TABLES[lang].market.cancelPartial).toContain('{{n}}')
      for (const ph of ['{{high}}', '{{low}}', '{{last}}']) {
        expect(TABLES[lang].market.trendRange).toContain(ph)
      }
    }
    // en/vn 不得残留中文（hk 允许）
    expect(/\p{Script=Han}/u.test(JSON.stringify(Object.fromEntries(NEW_KEYS.map((k) => [k, TABLES.en.market[k]]))))).toBe(false)
    expect(/\p{Script=Han}/u.test(JSON.stringify(Object.fromEntries(NEW_KEYS.map((k) => [k, TABLES.vn.market[k]]))))).toBe(false)
  })
})
