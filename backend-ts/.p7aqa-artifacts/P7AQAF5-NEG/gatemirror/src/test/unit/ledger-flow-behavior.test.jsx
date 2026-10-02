/**
 * 批 7-A · 前端行为实测（Kong）—— 「我的流水」真数据 + keyset 游标翻页 + 转让口径
 *
 * 路线（二选一，本单**选 vitest**，见报告 §3）：不启浏览器静态服务，改用**可注入的取数替身**，
 *   但替身必须按**真契约**回包（`sendSuccess` 形状：顶层 `data` + 顶层 `next_before_txid`），
 *   且 `t` 走**真实 `src/locales/zh.json`**（不是 `key => key`）—— 否则只能断言「没崩」，
 *   证不了「locale 键真能渲染成人话」与「翻页游标真起作用」。
 *
 * 五个判据（逐条对应用户可见行为）：
 *   ① `ProfilePage` 真 token 下渲染**真流水行**（行 = `fetchMyLedger` 回包逐行；标签 = zh 真文案，不得是键名）；
 *   ② 分页游标可用：点「加载更多」⇒ 第二次请求带 `before_txid=<上一页末条 txid>`，行数增加且**不重复**；
 *   ③ 到底（`next_before_txid=null`）⇒ 「加载更多」不再渲染；
 *   ④ **真·零流水**（`data: []` + `next: null`）才显示空态（`ledger.flowEmpty` 真文案）；
 *   ⑤ `MarketPage` 转让口径：**每次**请求都带 `kind=transfer`（不出现无过滤请求），且渲染行 = 回包行。
 *
 * 取数通道自曝：`ledger-api.fetchMyLedger` 走**全局 `fetch`**（为取顶层 `next_before_txid`，
 *   绕开只回 `payload.data` 的 `fetchApiJson`）⇒ 本文件 `vi.stubGlobal('fetch', …)`；
 *   其余读面仍走被 mock 的 `fetchApiJson`。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** 真值源：zh locale（仅用于断言，不参与替身） */
const ZH = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/locales/zh.json'), 'utf8'))

// 真实 i18n 替身：`t` = **查 zh 表**（缺键 ⇒ 原样返回键名，便于用例把「键名泄漏」照出来）
vi.mock('react-i18next', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const table = JSON.parse(readFileSync(resolve(process.cwd(), 'src/locales/zh.json'), 'utf8'))
  const lookup = (key) => key.split('.').reduce((acc, p) => (acc && typeof acc === 'object' ? acc[p] : undefined), table)
  const t = (key, opts) => {
    const v = lookup(key)
    if (typeof v !== 'string') return key
    return opts ? v.replace(/\{\{(\w+)\}\}/g, (_, n) => (opts[n] === undefined ? `{{${n}}}` : String(opts[n]))) : v
  }
  return { useTranslation: () => ({ t, i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' } }) }
})

// 批 7-A 收口四：`ledger-api` 新增 `getAuthToken` 前置 + `apiErrorMessage` 链（错误面与全站对齐）⇒
//   本替身改为「**真 auth 模块**（`importOriginal`）+ 只桩网络面」，否则替身漏键会把真前置打成
//   `TypeError: getAuthToken is not a function`（假红：页面把 TypeError 当取数失败吞掉）。
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchApiJson: vi.fn(async () => []),
    fetchCurrentUser: vi.fn(async () => ({ uID: 970001, bio: 'hello', EVM: '0xabc' })),
    getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
    updateMyProfile: vi.fn(),
  }
})

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: false, can_access_admin: false, permissions: [] })),
  hasAdminPermission: vi.fn(() => false),
}))

import { fetchApiJson } from '../../auth'
import { useAuth } from '../../auth-context'
import ProfilePage from '../../pages/ProfilePage'
import MarketPage from '../../pages/market/MarketPage'

const rowOf = (txid, kind, delta) => ({
  txid,
  uid: 970001,
  cid: 1,
  delta: String(delta),
  frozen_delta: '0',
  balance_after: '100',
  frozen_after: '0',
  kind,
  ref_type: 'system',
  ref_id: null,
  reversal_of_txid: null,
  memo: null,
  time_created: 1750000000 + txid,
})

const okPayload = (rows, nextBeforeTxid) => ({ success: true, message: 'OK', data: rows, next_before_txid: nextBeforeTxid })

/** 可注入取数替身：按 `before_txid` 游标分发页面（键 = 游标值，`null` = 首页） */
const ledgerFetch = (pages) => vi.fn(async (url) => {
  const m = String(url).match(/before_txid=(\d+)/)
  const cursor = m ? Number(m[1]) : null
  const payload = pages[cursor] || okPayload([], null)
  return { ok: true, status: 200, json: async () => payload }
})

const renderPage = (ui, p = '/') => render(
  <MemoryRouter initialEntries={[p]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {ui}
  </MemoryRouter>
)

const ledgerCalls = (mock) => mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/api/user/ledger'))
const profileItems = (container) => Array.from(container.querySelectorAll('[data-sf-m="jobs-flow-item"]'))
const mktItems = (container) => Array.from(container.querySelectorAll('[data-sf-m="mkt-ledger-item"]'))

describe('批 7-A · 账本流水前端行为（真 zh locale + 可注入取数替身）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchApiJson.mockImplementation(async () => [])
    useAuth.mockReturnValue({
      isAuthenticated: true,
      updateSession: (p) => p,
      user: { uID: 970001, token: 'real-token-shape', EVM: '0xabc' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① ProfilePage：真 token 下渲染真流水行，标签走 zh 真文案（不得是 `ledger.kind.*` 键名）', async () => {
    vi.stubGlobal('fetch', ledgerFetch({
      null: okPayload([rowOf(270, 'transfer', 5), rowOf(269, 'job_payout', 12), rowOf(268, 'hold', -3)], 247),
    }))

    const { container } = renderPage(<ProfilePage />, '/profile')
    await waitFor(() => expect(profileItems(container).length).toBe(3))

    const labels = profileItems(container).map((n) => n.querySelector('.sf-jobs-item-title')?.textContent)
    expect(labels).toEqual(['转让', '任务报酬', '冻结'])
    // 键名不得泄漏（缺键时 `t` 原样返回键名）
    expect(container.textContent).not.toContain('ledger.kind.')
    // 真文案来自 locale：与 zh 表逐字相等
    expect(labels[0]).toBe(ZH.ledger.kind.transfer)
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('② 分页游标：点「加载更多」⇒ 请求带上一页 `next_before_txid`；行数增、不重复；到底后按钮消失', async () => {
    const fetchMock = ledgerFetch({
      null: okPayload([rowOf(270, 'transfer', 5), rowOf(269, 'job_payout', 12), rowOf(268, 'commission', 1)], 247),
      247: okPayload([rowOf(245, 'sale', 9), rowOf(243, 'purchase', -4)], null),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = renderPage(<ProfilePage />, '/profile')
    await waitFor(() => expect(profileItems(container).length).toBe(3))

    // 首页：不带游标
    expect(ledgerCalls(fetchMock)[0]).not.toContain('before_txid')
    const more = container.querySelector('[data-sf-m="jobs-flow-more"]')
    expect(more).toBeTruthy()
    expect(more.textContent).toBe(ZH.ledger.flowMore)

    fireEvent.click(more)
    await waitFor(() => expect(profileItems(container).length).toBe(5))

    // 第二页请求确实带游标 = 上一页 `next_before_txid`
    const calls = ledgerCalls(fetchMock)
    expect(calls.length).toBe(2)
    expect(calls[1]).toContain('before_txid=247')

    // 不重复：5 行文本两两互异（本用例每行 delta 互异 ⇒ 行文本唯一）
    const texts = profileItems(container).map((n) => n.textContent)
    expect(new Set(texts).size).toBe(5)

    // 到底（`next_before_txid=null`）⇒ 不再渲染「加载更多」
    expect(container.querySelector('[data-sf-m="jobs-flow-more"]')).toBeNull()
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('④ 真·零流水（`data: []` + `next: null`）⇒ 空态 = `ledger.flowEmpty` 真文案（非键名）', async () => {
    vi.stubGlobal('fetch', ledgerFetch({ null: okPayload([], null) }))

    const { container } = renderPage(<ProfilePage />, '/profile')
    await waitFor(() => {
      const empty = container.querySelector('[data-sf-m="jobs-flow-empty"]')
      expect(empty).toBeTruthy()
      expect(empty.textContent).toBe(ZH.ledger.flowEmpty)
    })
    expect(profileItems(container).length).toBe(0)
    expect(container.querySelector('[data-sf-m="jobs-flow-more"]')).toBeNull()
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('⑤ MarketPage 转让口径：**每次**账本请求都带 `kind=transfer`（不出现无过滤请求），渲染行 = 回包行', async () => {
    const fetchMock = ledgerFetch({
      null: okPayload([rowOf(260, 'transfer', 7), rowOf(259, 'transfer', -2)], null),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = renderPage(<MarketPage />, '/shard')
    await waitFor(() => expect(mktItems(container).length).toBe(2))

    const calls = ledgerCalls(fetchMock)
    expect(calls.length).toBeGreaterThan(0)
    for (const u of calls) {
      expect(u.startsWith('/api/user/ledger?')).toBe(true)
      expect(u).toContain('kind=transfer')
    }
    // 回包只有 transfer（服务端过滤）⇒ 页面逐行渲染且标签为「转让」，不得出现其它 kind 文案
    const labels = mktItems(container).map((n) => n.querySelector('.sf-mkt-item-title')?.textContent)
    expect(labels).toEqual(['转让', '转让'])
    expect(container.textContent).not.toContain('ledger.kind.')
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('⑥ （原锚保留）MarketPage 取数失败 ⇒ 兜底文案是字符串、无 [object Object]（与 `market.mineEmpty` 可区分）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('LEDGER_NET_DOWN') }))

    const { container } = renderPage(<MarketPage />, '/shard')
    const empty = container.querySelector('[data-sf-m="mkt-ledger-empty"]')
    expect(empty).toBeTruthy()
    // 失败文案异步落地（首帧先渲染 `ledger.flowEmpty`，catch 后换成错误串）
    await waitFor(() => expect(empty.textContent).toBe('LEDGER_NET_DOWN'))
    expect(empty.textContent).not.toBe(ZH.market.mineEmpty)
    expect(container.textContent).not.toContain('[object Object]')
    expect(mktItems(container).length).toBe(0)
  })

  // 收口四 R-2（统一未登录口径）：`ProfilePage` 的账本面按 `isAuthenticated` 设闸（与 `MarketPage` 对齐）
  //   ⇒ 未登录**不发请求**（旧行为 = 发出去吃 401，再把服务端错误串当文案显示）。
  it('⑦ 未登录（`isAuthenticated=false`）⇒ 账本读口**零请求** + 本地登录提示（登录闸）', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, updateSession: (p) => p, user: null })
    const fetchSpy = vi.fn(async () => { throw new Error('SHOULD_NOT_FETCH') })
    vi.stubGlobal('fetch', fetchSpy)

    const { container } = renderPage(<ProfilePage />, '/profile')

    await waitFor(() => expect(container.textContent).toContain(ZH.pleaseLogin))
    expect(fetchSpy).not.toHaveBeenCalled() // 一个请求都没发（含账本读口）
    expect(ledgerCalls(fetchSpy).length).toBe(0)
    expect(container.textContent).not.toContain('AUTH_UNAUTHORIZED') // 本地提示，非服务端错误串
    expect(container.querySelector('[data-sf-m="jobs-flow"]')).toBeNull() // 未登录 ⇒ 账本面板整体不渲染
  })
})
