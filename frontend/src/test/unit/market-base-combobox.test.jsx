/**
 * 「标的币种」combobox（Kevin 2026-10-21 · /exchange 挂单表单）行为单测
 *
 * 口径（派单逐条）：
 *   ① 下拉列出全部 listed 币（行文案 `symbol · name · #cid`），**cid 1 恒不在选项**（§5.103 退化币对）；
 *   ② 过滤 = 输入词对 symbol/name/cid **不区分大小写包含**（`bttc` ⇒ 命中 BTTC 一项）；
 *   ③ 点选 / Enter ⇒ `base = 该币 cid`：URL `?base=` 写回 + 订单簿请求按该 cid 发出；
 *   ④ 纯数字直输 + 失焦 ⇒ 既有行为（base = 该 cid，404/无效走现兜底）；
 *   ⑤ Esc / 失焦关闭面板 ⇒ **零请求**（关面板纯本地态）；
 *   ⑥ `?base=N` 直进 ⇒ 回显对应 symbol；无对应 ⇒ 回显数字。
 *
 * 替身体例（承 p7e/listing-market 的既有教训）：
 *   · `t` = 模块级稳定函数（避免 `useCallback([.., t])` 依赖每次变化 ⇒ 无限重渲染）；
 *   · `useAuth()` 返回**同一引用**（同上）；
 *   · 网络打在 `../../auth` 的 `fetchApiJson` 上（页面真实消费层；账本面直接 mock `../../ledger-api`）。
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stableT = (key) => key
const stableI18n = { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' }
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: stableT, i18n: stableI18n }) }))

// ★ 稳定 auth 对象（模块级同一引用）
const AUTH = { isAuthenticated: true, user: { uID: 7, token: 't' } }
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 选项源夹具（形态对齐 dev 库现状：平台币 `symbol='$'`；BTTC symbol='₿'、name='BTTC'、cid≠1）
const FIXTURE_CURRENCIES = [
  { cid: 1, symbol: '$', name: 'USD' },
  { cid: 4, symbol: '₿', name: 'BTTC' },
  { cid: 10, symbol: 'Ω', name: 'Omega Coin' },
]

vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchApiJson: vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/api/currencies')) return FIXTURE_CURRENCIES.map((row) => ({ ...row }))
      return []
    }),
    getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
  }
})

vi.mock('../../ledger-api', () => ({
  fetchMyLedger: vi.fn(async () => ({ rows: [], nextBeforeTxid: null })),
  LEDGER_PAGE_SIZE: 20,
}))

import { fetchApiJson } from '../../auth'
import MarketPage from '../../pages/market/MarketPage'

// 路由探针：读 MemoryRouter 内的 location.search（jsdom 的 window.location 不随 MemoryRouter 变）
const LocationSpy = () => {
  const location = useLocation()
  return <div data-sf-m="loc-spy" data-search={location.search} />
}

const renderPage = (initialUrl = '/exchange') => render(
  <MemoryRouter initialEntries={[initialUrl]}>
    <LocationSpy />
    <MarketPage />
  </MemoryRouter>,
)

const inputOf = (container) => container.querySelector('[data-sf-m="mkt-input-base"]')
const urlSearch = () => document.querySelector('[data-sf-m="loc-spy"]')?.getAttribute('data-search') || ''
const apiCalls = (needle) => fetchApiJson.mock.calls.filter(([u]) => String(u).includes(needle))
// 精确匹配变体：`/api/order`（挂单写口）—— includes 会把 `/api/market/N/orderbook` 顶进来（坏尺子）；
//   可选 method 过滤：挂载时「我的挂单」GET /api/order 在场，判「表单提交」必须认 POST。
const exactCalls = (url, method) => fetchApiJson.mock.calls.filter(([u, o]) => String(u) === url && (!method || o?.method === method))
const optionsOf = () => [...document.querySelectorAll('[data-sf-m="mkt-base-option"]')]

beforeEach(() => {
  fetchApiJson.mockClear()
})

describe('「标的币种」combobox（/exchange · Kevin 2026-10-21）', () => {
  it('① 下拉列出全部 listed 币（symbol · name · #cid），cid 1 恒不在选项', async () => {
    const { container } = renderPage()
    const input = inputOf(container)
    fireEvent.focus(input) // 面板打开（此刻选项源可能仍在途）
    await waitFor(() => expect(optionsOf().length).toBe(2))

    const texts = optionsOf().map((el) => el.textContent)
    expect(texts[0]).toBe('₿ · BTTC · #4')
    expect(texts[1]).toBe('Ω · Omega Coin · #10')
    expect(container.querySelector('[data-sf-cid="1"]')).toBeNull() // cid 1（退化币对）不在列表
    expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    expect(input.getAttribute('aria-expanded')).toBe('true')
    // 面板打开 ⇒ 清显全文（便于改搜）
    expect(input.value).toBe('')
  })

  it('② 过滤不区分大小写包含：`bttc` ⇒ 恰 1 项（BTTC）；Enter ⇒ base=4（URL ?base= 写回 + 订单簿按 cid=4 发出）', async () => {
    const { container } = renderPage()
    const input = inputOf(container)
    fireEvent.focus(input)
    await waitFor(() => expect(optionsOf().length).toBe(2))

    fireEvent.change(input, { target: { value: 'bttc' } })
    await waitFor(() => expect(optionsOf().length).toBe(1))
    expect(optionsOf()[0].textContent).toContain('BTTC')
    expect(optionsOf()[0].getAttribute('data-sf-cid')).toBe('4')

    fireEvent.keyDown(input, { key: 'Enter' })
    // 面板关闭 + 输入框回显选中币 symbol
    await waitFor(() => expect(container.querySelector('[data-sf-m="mkt-base-listbox"]')).toBeNull())
    await waitFor(() => expect(input.value).toBe('₿'))
    expect(urlSearch()).toContain('base=4')
    await waitFor(() => expect(apiCalls('/api/market/4/orderbook').length).toBe(1))
    // 面板开着时 Enter 永不提交挂单表单（零 POST /api/order —— 精确匹配 + method 过滤，orderbook 读口与挂载期「我的挂单」GET 都不算）
    expect(exactCalls('/api/order', 'POST').length).toBe(0)
  })

  it('③ 键盘 ↑↓ + aria-activedescendant / aria-selected；Enter 选中高亮项', async () => {
    const { container } = renderPage()
    const input = inputOf(container)
    fireEvent.focus(input)
    await waitFor(() => expect(optionsOf().length).toBe(2))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('sf-mkt-base-opt-0')
    expect(optionsOf()[0].getAttribute('aria-selected')).toBe('true')
    expect(optionsOf()[1].getAttribute('aria-selected')).toBe('false')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('sf-mkt-base-opt-1')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.getAttribute('aria-activedescendant')).toBe('sf-mkt-base-opt-0')

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(urlSearch()).toContain('base=4'))
    await waitFor(() => expect(apiCalls('/api/market/4/orderbook').length).toBe(1))
  })

  it('④ 点选写回：mouseDown 选项 ⇒ base=该行 cid（URL + 订单簿）+ 回显 symbol', async () => {
    const { container } = renderPage()
    const input = inputOf(container)
    fireEvent.focus(input)
    await waitFor(() => expect(optionsOf().length).toBe(2))

    fireEvent.mouseDown(container.querySelector('[data-sf-cid="10"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="mkt-base-listbox"]')).toBeNull())
    await waitFor(() => expect(input.value).toBe('Ω'))
    expect(urlSearch()).toContain('base=10')
    await waitFor(() => expect(apiCalls('/api/market/10/orderbook').length).toBe(1))
  })

  it('⑤ 纯数字直输 + 失焦 ⇒ 既有行为：base = 该 cid（订单簿按该 cid 发出）、回显数字、URL 写回', async () => {
    const { container } = renderPage()
    const input = inputOf(container)
    fireEvent.change(input, { target: { value: '7' } }) // 7 不在选项源 ⇒ 无面板命中也可直输
    fireEvent.blur(input)

    await waitFor(() => expect(apiCalls('/api/market/7/orderbook').length).toBe(1))
    expect(input.value).toBe('7') // 无对应币 ⇒ 回显数字
    expect(urlSearch()).toContain('base=7')
  })

  it('⑥ Esc / 失焦关闭面板 ⇒ 零请求（挂单/盘口/币种读口都不新增调用）', async () => {
    const { container } = renderPage()
    const input = inputOf(container)
    await waitFor(() => expect(apiCalls('/api/currencies').length).toBe(1))
    const callsAtRest = fetchApiJson.mock.calls.length

    // Esc 关面板：纯本地态，零请求
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('[data-sf-m="mkt-base-listbox"]')).toBeNull()
    expect(fetchApiJson.mock.calls.length).toBe(callsAtRest)

    // 输入文本后失焦（非数字 ⇒ 放弃搜索）：零请求，echo 恢复（base 仍为空 ⇒ 空串）
    fireEvent.focus(input)
    await waitFor(() => expect(optionsOf().length).toBe(2))
    fireEvent.change(input, { target: { value: 'bt' } })
    fireEvent.blur(input)
    expect(container.querySelector('[data-sf-m="mkt-base-listbox"]')).toBeNull()
    expect(input.value).toBe('')
    expect(fetchApiJson.mock.calls.length).toBe(callsAtRest)
    expect(apiCalls('/api/market/').length).toBe(0)
    expect(apiCalls('/api/currencies').length).toBe(1) // 挂载一次，关面板不重取
  })

  it('⑦ `?base=4` 直进 ⇒ 回显对应 symbol；`?base=999` 无对应 ⇒ 回显数字（订单簿仍按该 cid 发出）', async () => {
    const { container } = renderPage('/exchange?base=4')
    const input = inputOf(container)
    await waitFor(() => expect(input.value).toBe('₿')) // 选项源落地后回显 symbol
    expect(urlSearch()).toContain('base=4')
    await waitFor(() => expect(apiCalls('/api/market/4/orderbook').length).toBe(1))

    const second = renderPage('/exchange?base=999')
    const input2 = inputOf(second.container)
    await waitFor(() => expect(apiCalls('/api/market/999/orderbook').length).toBe(1))
    expect(input2.value).toBe('999') // 无对应 ⇒ 回显数字
  })
})
