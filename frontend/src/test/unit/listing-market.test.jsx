/**
 * P4-B4c-ii-b · 商品线 + 交易所线 接线与 UX 单测（≥6 例；本单新增）
 *
 * 口径：这些用例钉的是**接线契约**（不是实现细节）——
 *   ① 金额一律服务端取数：购买 payload **只有** `create_key` + `quantity`（伪造 price/seller 结构性进不去）；
 *   ② 幂等键逐面：前端供键面（上架/购买/挂单）带 `cli:` 键；服务端派生面（退款/撤单/全撤）**不传键**；
 *   ③ 撤单/全撤 **不发 body**（§9.B B12 的 query-only 口径）；
 *   ④ 「账本流水」读口未注册 ⇒ 只渲染空态、不得自造（也不得去调不存在的路径）；
 *   ⑤ 失败态文案必须是**字符串**（R107 链），页面不得出现 `[object Object]`；
 *   ⑥ 审核入口按权限隐藏（后端 `requireAdmin(review_tasks)` 为唯一真源；非 admin ⇒ 不渲染、不请求）。
 *
 * ★ 探针自曝：`useTranslation` 的 `t` 在本文件里取**模块级稳定函数**（不是每次渲染新建闭包）。
 *   原因：页面里 `useCallback(..., [.., t])` + 内部 setState ⇒ 若 mock 每次返回新的 `t`，
 *   effect 依赖每次变化 ⇒ **无限重渲染**（首版即因此触发 vitest worker OOM，已修）。
 *   真机 i18next 的 `t` 稳定，故这是**测试替身的约束**，不是产品代码缺陷。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stableT = (key) => key
const stableI18n = { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' }

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT, i18n: stableI18n }),
}))

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async () => []),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
}))

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: false, can_access_admin: false, permissions: [] })),
  hasAdminPermission: vi.fn(() => false),
}))

import { fetchApiJson } from '../../auth'
import { useAuth } from '../../auth-context'
import { fetchAdminAccess, hasAdminPermission } from '../../admin-utils'
import {
  buyListing,
  createListingBuyTracker,
  fetchListingFeed,
  fetchMyListingOrders,
  listingBuyFingerprint,
  listingPublishFingerprint,
  publishListing,
  refundListingOrder,
  setListingStatus,
} from '../../pages/listings/listing-api'
import {
  QUOTE_CID,
  cancelAllOrders,
  cancelOrder,
  createOrderPlaceTracker,
  fetchOrderBook,
  orderPlaceFingerprint,
  placeOrder,
} from '../../pages/market/market-api'
import ListingsPage from '../../pages/listings/ListingsPage'
import ListingDetailPage from '../../pages/listings/ListingDetailPage'
import MarketPage from '../../pages/market/MarketPage'
import JobReviewPage from '../../pages/jobs/JobReviewPage'
import PublishJobPage from '../../pages/jobs/PublishJobPage'

const bodyOf = (callIndex = 0) => {
  const call = fetchApiJson.mock.calls[callIndex]
  return { url: call[0], options: call[1] || {}, body: call[1]?.body ? JSON.parse(call[1].body) : null }
}

const callsTo = (pattern) => fetchApiJson.mock.calls.filter((c) => String(c[0]).includes(pattern))

const renderPage = (ui, path = '/') => render(
  <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {ui}
  </MemoryRouter>
)

describe('商品线 · 接线契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchApiJson.mockImplementation(async () => [])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
  })

  it('上架 = POST /api/listing + 前端 `cli:` 键；body 不含对手方字段', async () => {
    await publishListing({ cid: 1, price: '7', stock: '3', title: 't', description: 'd', createKey: 'cli:abc', user: null })
    const { url, options, body } = bodyOf()
    expect(url).toBe('/api/listing')
    expect(options.method).toBe('POST')
    expect(body.create_key).toBe('cli:abc')
    expect(body.price).toBe('7')
    expect(body).not.toHaveProperty('seller_uid')
    expect(body).not.toHaveProperty('buyer_uid')
  })

  it('购买 payload 只有 create_key + quantity —— 伪造 price/seller_uid/buyer_uid 结构性被忽略', async () => {
    await buyListing(5, { quantity: '1', createKey: 'cli:buy', price: '1', seller_uid: '999', buyer_uid: '999', user: null })
    const { url, options, body } = bodyOf()
    expect(url).toBe('/api/listing/5/buy')
    expect(options.method).toBe('POST')
    expect(Object.keys(body).sort()).toEqual(['create_key', 'quantity'])
    expect(body.quantity).toBe('1')
  })

  it('退款 = POST /api/listing-orders/:orderId/refund 且**不传键**（服务端派生事件根键）', async () => {
    await refundListingOrder(42, null)
    const { url, options, body } = bodyOf()
    expect(url).toBe('/api/listing-orders/42/refund')
    expect(options.method).toBe('POST')
    expect(body).toEqual({})
  })

  it('读面路径与状态迁移面：列表 = /api/prize/all、我的订单 = /api/prize-item、状态迁移 = PATCH', async () => {
    await fetchListingFeed(null, 60)
    await fetchMyListingOrders(null)
    await setListingStatus(5, 'listed', null)
    expect(fetchApiJson.mock.calls[0][0]).toBe('/api/prize/all?limit=60')
    expect(fetchApiJson.mock.calls[1][0]).toBe('/api/prize-item')
    const patch = bodyOf(2)
    expect(patch.url).toBe('/api/listing/5')
    expect(patch.options.method).toBe('PATCH')
    expect(patch.body).toEqual({ to_status: 'listed' })
  })

  it('幂等 tracker：同一次操作重试 ⇒ 同一个 `cli:` 键；指纹变了 ⇒ 新键', () => {
    const tracker = createListingBuyTracker()
    const fp = listingBuyFingerprint({ listingId: 5, quantity: 1 })
    const first = tracker.keyFor(fp)
    const second = tracker.keyFor(fp)
    const other = tracker.keyFor(listingBuyFingerprint({ listingId: 5, quantity: 2 }))
    expect(first).toBe(second)
    expect(first).not.toBe(other)
    expect(first.startsWith('cli:')).toBe(true)
    expect(listingPublishFingerprint({ cid: 1, price: 7, stock: 1, title: 'a', description: '' }))
      .toBe(listingPublishFingerprint({ cid: 1, price: 7, stock: 1, title: 'a', description: '' }))
  })

  it('商品列表页：调用已注册读面并渲染空态，无 [object Object]', async () => {
    const { container } = renderPage(<ListingsPage />, '/listing')
    await waitFor(() => expect(callsTo('/api/prize/all').length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.getByText('listings.empty')).toBeTruthy())
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('详情页：购买提交的是 /api/listing/1/buy 且 body 无金额字段', async () => {
    fetchApiJson.mockImplementation(async (url) => (String(url).includes('/buy') ? { order_id: 9 } : []))
    renderPage(
      <Routes>
        <Route path="/listing/:listingId" element={<ListingDetailPage />} />
      </Routes>,
      '/listing/1',
    )
    const button = await screen.findByRole('button', { name: 'listings.buy' })
    fireEvent.click(button)
    await waitFor(() => expect(callsTo('/api/listing/1/buy').length).toBe(1))
    const call = callsTo('/api/listing/1/buy')[0]
    const body = JSON.parse(call[1].body)
    expect(Object.keys(body).sort()).toEqual(['create_key', 'quantity'])
  })
})

describe('交易所线 · 接线契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchApiJson.mockImplementation(async () => [])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
  })

  it('挂单 body = side/base_cid/quote_cid(=1)/price/amount/create_key；**不含 owner_uid**（服务端取 token actor）', async () => {
    expect(QUOTE_CID).toBe(1)
    await placeOrder({ side: 'buy', baseCid: 2, price: '2', amount: '3', createKey: 'cli:o1', owner_uid: '999', user: null })
    const { url, options, body } = bodyOf()
    expect(url).toBe('/api/order')
    expect(options.method).toBe('POST')
    expect(body).toEqual({ side: 'buy', base_cid: 2, quote_cid: 1, price: '2', amount: '3', create_key: 'cli:o1' })
    expect(body).not.toHaveProperty('owner_uid')
  })

  it('撤单面：单撤 DELETE /api/order/:oID；全撤 DELETE /api/order 且**不发 body**（query-only）', async () => {
    await cancelOrder(9, null)
    await cancelAllOrders(null)
    const one = bodyOf(0)
    const all = bodyOf(1)
    expect(one.url).toBe('/api/order/9')
    expect(one.options.method).toBe('DELETE')
    expect(one.options.body).toBeUndefined()
    expect(all.url).toBe('/api/order')
    expect(all.options.method).toBe('DELETE')
    expect(all.options.body).toBeUndefined()
  })

  it('订单簿读面按 base_cid 取数（`/api/market/1/...` 与「quote 恒 1、base≠quote」互斥 ⇒ 页面不把 1 当 base）', async () => {
    await fetchOrderBook(7, null)
    expect(fetchApiJson.mock.calls[0][0]).toBe('/api/market/7/orderbook')
    const tracker = createOrderPlaceTracker()
    const fp = orderPlaceFingerprint({ side: 'sell', baseCid: 7, price: 1, amount: 2 })
    expect(tracker.keyFor(fp)).toBe(tracker.keyFor(fp))
    expect(tracker.keyFor(fp).startsWith('cli:')).toBe(true)
  })

  it('交易所页：盘口/成交/我的挂单空态齐备；「账本流水」= 未注册读口 ⇒ 只空态、不请求', async () => {
    const { container } = renderPage(<MarketPage />, '/shard')
    await waitFor(() => expect(screen.getByText('ledger.flowEmpty')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('market.mineEmpty')).toBeTruthy())
    expect(container.textContent).not.toContain('[object Object]')
    expect(callsTo('/api/user/ledger').length).toBe(0)
    expect(callsTo('/api/user/points').length).toBe(0)
  })

  // ---- P4-B4c-ii-c ②（§5.103 裁定）：退化币对（base_cid=1）不发请求 + 空态**可区分** -------------
  it('§5.103 ①：base_cid=1（`$` 对自身）= 退化币对 ⇒ 页面**不发** orderbook / trades 请求', async () => {
    const { container } = renderPage(<MarketPage />, '/shard')
    await waitFor(() => expect(screen.getByText('market.mineEmpty')).toBeTruthy())

    const input = container.querySelector('[data-sf-m="mkt-input-base"]')
    fireEvent.change(input, { target: { value: '1' } })

    await waitFor(() => expect(screen.getAllByText('market.pairDegenerate').length).toBeGreaterThan(0))
    expect(callsTo('/api/market/').length).toBe(0)
    expect(callsTo('/api/market/1/orderbook').length).toBe(0)
    expect(callsTo('/api/market/1/trades').length).toBe(0)
  })

  it('§5.103 ②：真无挂单（base_cid=7、回包 = 空数组）⇒ 请求确实发出，空态 = `market.bookEmpty`（与退化区分）', async () => {
    const { container } = renderPage(<MarketPage />, '/shard')
    const input = container.querySelector('[data-sf-m="mkt-input-base"]')
    fireEvent.change(input, { target: { value: '7' } })

    await waitFor(() => expect(callsTo('/api/market/7/orderbook').length).toBe(1))
    await waitFor(() => expect(screen.getByText('market.bookEmpty')).toBeTruthy())
    expect(screen.queryByText('market.pairDegenerate')).toBeNull()
  })

  it('交易所页失败态：R107 文案是字符串（含 code/reason），页面无 [object Object]', async () => {
    fetchApiJson.mockImplementation(async () => { throw new Error('AUTH_FORBIDDEN (ACTOR_NOT_ALLOWED)') })
    const { container } = renderPage(<MarketPage />, '/shard')
    await waitFor(() => expect(container.textContent).toContain('AUTH_FORBIDDEN (ACTOR_NOT_ALLOWED)'))
    expect(container.textContent).not.toContain('[object Object]')
  })
})

describe('四语 locale（P4-B4c-ii-c ① / ② 新增键）', () => {
  const LANGS = ['zh', 'en', 'hk', 'vn']
  // 探针自曝：jsdom 下的 `URL` ≠ node `URL` ⇒ `fs.readFileSync(URL)` 抛 ERR_INVALID_ARG_TYPE；
  //   `new URL(.., import.meta.url).pathname` 也不可信（vitest 下解析成 `/src/...`）⇒ 与
  //   `theme-shell-isomorphism.test.jsx:29-30` 同法：`fileURLToPath(import.meta.url)` 推 SRC。
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const tableOf = (lang) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()

  it('四语键集逐文件相同（顶层 + 嵌套逐键对拍）；新增 3 键四语齐备、非空、且不是英文原文照抄', () => {
    const tables = {}
    const sets = {}
    for (const lang of LANGS) {
      tables[lang] = tableOf(lang)
      sets[lang] = keyPaths(tables[lang])
    }
    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)

    const added = ['auth.err.INVALID_WALLET_SIGNATURE', 'auth.err.SIGNATURE_ADDRESS_MISMATCH', 'market.pairDegenerate']
    const RAW = ['Invalid wallet signature', 'Signature does not match the claimed address']
    for (const lang of LANGS) {
      const values = added.map((kp) => kp.split('.').reduce((acc, part) => acc[part], tables[lang]))
      for (const value of values) {
        expect(sets[lang]).toContain(added[values.indexOf(value)])
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
        expect(RAW).not.toContain(value)
      }
      expect(new Set(values).size).toBe(added.length)
    }
  })
})

describe('审核入口按权限隐藏（四项确认 ①）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchApiJson.mockImplementation(async () => [])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
  })

  it('非 admin：审核页收敛为无权限空态，且**不**发起队列读（不拿 403 当首屏）', async () => {
    hasAdminPermission.mockReturnValue(false)
    fetchAdminAccess.mockResolvedValue({ is_admin: false, can_access_admin: false, permissions: [] })
    const { container } = renderPage(<JobReviewPage />, '/task/review')
    await waitFor(() => expect(container.querySelector('[data-sf-m="jobs-review-denied"]')).toBeTruthy())
    expect(container.textContent).toContain('auth.err.AUTH_FORBIDDEN')
    expect(callsTo('/api/tasklist/pending-verification').length).toBe(0)
  })

  it('admin（review_tasks）：审核页才取队列；发布页才显示审核入口链接', async () => {
    hasAdminPermission.mockReturnValue(true)
    fetchAdminAccess.mockResolvedValue({ is_admin: true, can_access_admin: true, permissions: ['review_tasks'] })
    renderPage(<JobReviewPage />, '/task/review')
    await waitFor(() => expect(callsTo('/api/tasklist/pending-verification').length).toBe(1))

    const publish = renderPage(<PublishJobPage />, '/task/new')
    await waitFor(() => expect(screen.getAllByText('jobs.review').length).toBeGreaterThan(0))
    expect(publish.container.textContent).toContain('jobs.review')
  })

  it('非 admin：发布页**不**渲染审核入口链接（入口隐藏 = 前端不展示，后端 403 仅兜底）', async () => {
    hasAdminPermission.mockReturnValue(false)
    fetchAdminAccess.mockResolvedValue({ is_admin: false, can_access_admin: false, permissions: [] })
    const { container } = renderPage(<PublishJobPage />, '/task/new')
    await waitFor(() => expect(container.textContent).toContain('jobs.publish'))
    expect(container.querySelector('[data-sf-m="jobs-review-link"]')).toBeNull()
    expect(callsTo('/api/tasklist/pending-verification').length).toBe(0)
  })
})
