/**
 * P7-E 小尾巴批-β 单测（本单新增）—— 数据枚举查表化回归契约
 *  ① `ListingDetailPage` 状态：四语标签 + **未知兜底** + 缺省维持 `-`（**不得**原样渲染 DB 枚举）
 *  ② `MarketPage`「我的挂单」`status`/`side`：四语标签 + **未知兜底**（**不得**原样渲染 `open`/`buy` 等）
 *  ③ `orders.statusLabel` / `orders.sideLabel` 四语键集相等（en/vn 不得残留中文）+ 取值域 = 现取 CHECK 白名单
 *
 * ★ 探针自曝：`useTranslation` 的 `t` 取**模块级稳定函数**（不是每次渲染新建闭包）——
 *   页面里 `useCallback(..., [t])` + 内部 setState ⇒ 若 mock 每次返回新 `t`，effect 依赖每次变化 ⇒
 *   **无限重渲染**（OOM）。真机 i18next 的 `t` 稳定，故这是**测试替身的约束**，非产品代码缺陷。
 */
import React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import hk from '../../locales/hk.json'
import en from '../../locales/en.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, hk, en, vn }

const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))
// ★ 稳定 auth 对象：`useAuth()` 每次返回**同一引用**（否则页面 `useCallback(..., [user])` 依赖每次变化 ⇒ 无限重渲染）
const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, token: 't' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))
vi.mock('../../pages/listings/listing-api', () => ({
  fetchListingDetail: vi.fn(),
  buyListing: vi.fn(),
  createListingBuyTracker: () => ({ keyFor: () => 'cli:x', reset: () => {} }),
  listingBuyFingerprint: () => 'fp',
}))
vi.mock('../../pages/market/market-api', () => ({
  QUOTE_CID: 1,
  fetchMyOrders: vi.fn(),
  fetchOrderBook: vi.fn(async () => []),
  fetchMarketTrades: vi.fn(async () => []),
  placeOrder: vi.fn(),
  cancelOrder: vi.fn(),
  cancelAllOrders: vi.fn(),
  createOrderPlaceTracker: () => ({ keyFor: () => 'cli:x', reset: () => {} }),
  orderPlaceFingerprint: () => 'fp',
}))
vi.mock('../../ledger-api', () => ({
  fetchMyLedger: vi.fn(async () => ({ rows: [], nextBeforeTxid: null })),
  LEDGER_PAGE_SIZE: 20,
}))

import { fetchListingDetail } from '../../pages/listings/listing-api'
import { fetchMyOrders } from '../../pages/market/market-api'
import ListingDetailPage from '../../pages/listings/ListingDetailPage'
import MarketPage from '../../pages/market/MarketPage'

const setLang = (lang) => { H.lang = lang; H.i18n.resolvedLanguage = lang; H.i18n.language = lang }
const renderDetail = () => render(
  <MemoryRouter initialEntries={['/listing/1']}>
    <Routes><Route path="/listing/:listingId" element={<ListingDetailPage />} /></Routes>
  </MemoryRouter>,
)
const renderMarket = () => render(<MemoryRouter initialEntries={['/shard']}><MarketPage /></MemoryRouter>)

const noteEl = () => document.querySelector('.sf-listings-note')
const noteText = () => (noteEl() ? noteEl().textContent : '')
const orderMeta = () => document.querySelector('[data-sf-m="mkt-order"] .sf-mkt-meta')
const orderTitle = () => document.querySelector('[data-sf-m="mkt-order"] .sf-mkt-item-title')

beforeEach(() => {
  H.tables = { zh, hk, en, vn }
  setLang('zh')
  fetchListingDetail.mockResolvedValue(null)
  fetchMyOrders.mockResolvedValue([])
})
afterEach(() => cleanup())

describe('① ListingDetailPage 状态查表（四语 + 未知兜底 + 缺省）', () => {
  it('已知取值 ⇒ 四语标签（判负：四语两两互异、且不含原始枚举）', async () => {
    const seen = {}
    for (const lang of ['zh', 'hk', 'en', 'vn']) {
      setLang(lang)
      fetchListingDetail.mockResolvedValue({ listing_id: 5, title: 'x', status: 'draft' })
      renderDetail()
      await waitFor(() => expect(noteText()).toContain(TABLES[lang].listings.statusLabel.draft))
      expect(noteText()).not.toContain('draft')   // 判负：原始枚举不得进用户面
      seen[lang] = noteText()
      cleanup()
    }
    expect(new Set(Object.values(seen)).size).toBe(4)   // 四语两两可区分
  })

  it('未知取值 ⇒ 本地化兜底（不渲染原始枚举、不空白），原值留 title/data-sf-status', async () => {
    setLang('en')
    fetchListingDetail.mockResolvedValue({ listing_id: 5, title: 'x', status: 'sunset-value' })
    renderDetail()
    await waitFor(() => expect(noteText()).toContain(TABLES.en.listings.statusLabel.unknown))
    expect(noteText()).not.toContain('sunset-value')                       // 判负：原始枚举不得进用户面
    expect(noteEl().getAttribute('data-sf-status')).toBe('sunset-value')
    expect(noteEl().getAttribute('title')).toBe('sunset-value')
  })

  it('缺省 / 空串 ⇒ 维持既有口径 `-`（不留 data-sf-status）', async () => {
    for (const status of [undefined, null, '']) {
      setLang('zh')
      fetchListingDetail.mockResolvedValue({ listing_id: 5, title: 'x', status })
      renderDetail()
      await waitFor(() => expect(noteText()).toContain('#5'))
      expect(noteText().endsWith('-')).toBe(true)
      expect(noteEl().getAttribute('data-sf-status')).toBeNull()
      cleanup()
    }
  })
})

describe('② MarketPage 我的挂单 status/side 查表（四语 + 未知兜底）', () => {
  it('已知取值 ⇒ 四语 status/side 标签（判负：不含原始枚举）', async () => {
    const seen = {}
    for (const lang of ['zh', 'hk', 'en', 'vn']) {
      setLang(lang)
      fetchMyOrders.mockResolvedValue([{ order_id: 9, side: 'sell', status: 'filled', price: 3, amount: 5, amount_filled: 5 }])
      renderMarket()
      await waitFor(() => expect(orderMeta()).toBeTruthy())
      expect(orderMeta().textContent).toContain(TABLES[lang].orders.statusLabel.filled)
      expect(orderTitle().textContent).toContain(TABLES[lang].orders.sideLabel.sell)
      expect(orderMeta().textContent).not.toContain('filled')   // 判负：原始枚举不得进用户面
      expect(orderTitle().textContent).not.toContain('sell')
      seen[lang] = `${orderMeta().textContent}|${orderTitle().textContent}`
      cleanup()
    }
    expect(new Set(Object.values(seen)).size).toBe(4)
  })

  it('未知取值 ⇒ 本地化兜底（不渲染原始枚举），原值留 data-sf-status/data-sf-side', async () => {
    setLang('en')
    fetchMyOrders.mockResolvedValue([{ order_id: 9, side: 'moon', status: 'sunset-value', price: 3, amount: 5, amount_filled: 0 }])
    renderMarket()
    await waitFor(() => expect(orderMeta()).toBeTruthy())
    expect(orderMeta().textContent).toContain(TABLES.en.orders.statusLabel.unknown)
    expect(orderTitle().textContent).toContain(TABLES.en.orders.sideLabel.unknown)
    expect(orderMeta().textContent).not.toContain('sunset-value')   // 判负 1
    expect(orderTitle().textContent).not.toContain('moon')          // 判负 2
    expect(orderMeta().getAttribute('data-sf-status')).toBe('sunset-value')
    expect(orderTitle().getAttribute('data-sf-side')).toBe('moon')
  })

  it('缺省 / 空串 ⇒ 维持既有口径（空串，不留 data-sf-*）', async () => {
    setLang('zh')
    fetchMyOrders.mockResolvedValue([{ order_id: 9, price: 3, amount: 5, amount_filled: 0 }])
    renderMarket()
    await waitFor(() => expect(orderMeta()).toBeTruthy())
    expect(orderMeta().textContent.endsWith('· ')).toBe(true)
    expect(orderTitle().textContent.endsWith('· ')).toBe(true)
    expect(orderMeta().getAttribute('data-sf-status')).toBeNull()
    expect(orderTitle().getAttribute('data-sf-side')).toBeNull()
  })
})

describe('③ orders.statusLabel / orders.sideLabel 键集与取值域', () => {
  it('四语键集逐语相等；en/vn 不得残留中文', () => {
    for (const grp of ['statusLabel', 'sideLabel']) {
      const keys = Object.keys(zh.orders[grp]).sort()
      for (const lang of ['hk', 'en', 'vn']) {
        expect(Object.keys(TABLES[lang].orders[grp]).sort()).toEqual(keys)
      }
      expect(/\p{Script=Han}/u.test(JSON.stringify(en.orders[grp]))).toBe(false)
      expect(/\p{Script=Han}/u.test(JSON.stringify(vn.orders[grp]))).toBe(false)
    }
  })

  it('取值域 = 现取 CHECK 白名单（status=open|partial|filled|cancelled；side=buy|sell；各 + unknown）', () => {
    expect(Object.keys(zh.orders.statusLabel).sort()).toEqual(['cancelled', 'filled', 'open', 'partial', 'unknown'])
    expect(Object.keys(zh.orders.sideLabel).sort()).toEqual(['buy', 'sell', 'unknown'])
  })
})
