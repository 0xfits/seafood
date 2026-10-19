/**
 * 商品发布页 · 币种字段 = 下拉选择器（Kevin 2026-10-19 · 小需求单）
 *
 * 契约（四条**逐条判负**，改回手填写死即红）：
 *   ① 渲染 `select[data-sf-m="item-select-cid"]`，且 `[data-sf-m="item-input-cid"]` **计数 = 0**；
 *   ② 选项数 **等于** `fetchCurrencies` 返回条数（前端**不硬编码**币种清单 —— 自建币种单位是产品
 *      既有能力，硬编码列表会立刻过期）；
 *   ③ 换选另一币种后提交，载荷 `cid` = **所选数字值**（且两次不同选择给两个不同值 ⇒ 不是恒 1）；
 *   ④ `fetchCurrencies` 失败 ⇒ **回退仅 $（cid 1）一项**，表单仍可提交（不白屏 / 不禁用提交）。
 *   ⑤/⑥ 补两条边界：默认值不在返回列表 ⇒ 选第一项；返回空数组 ⇒ 同样回退 $。
 *
 * 替身设计：
 *   · `item-api` 走 `importOriginal + 只桩三个面`（`fetchCurrencies` / `publishListing` /
 *     `setListingStatus`）⇒ 指纹与幂等 tracker 仍跑真代码（同 `listing-publish-redirect.test.jsx` 理由）；
 *   · `t` 返回**键名本身** ⇒ 「文案走 i18n 键、未新增键」顺带被钉住；模块级稳定函数避免无限重渲染。
 *   · 提交回包 `{}`（无 id）⇒ 页面停在 ok 态、不跳转 ⇒ 同一实例可连做两次提交取两个载荷。
 */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stableT = (key) => key

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { language: 'zh', resolvedLanguage: 'zh', changeLanguage: vi.fn() },
  }),
}))

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('../../pages/item/item-api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchCurrencies: vi.fn(), publishListing: vi.fn(), setListingStatus: vi.fn() }
})

import { useAuth } from '../../auth-context'
import { fetchCurrencies, publishListing, setListingStatus } from '../../pages/item/item-api'
import PublishItemPage from '../../pages/item/PublishItemPage'

// 夹具行键集与后端冻结口径一致：**恰三键** cid / symbol / name。
const CURRENCIES = [
  { cid: 1, symbol: '$', name: '社区积分' },
  { cid: 7, symbol: '₿', name: 'BTTC' },
  { cid: 21, symbol: '¥', name: '' },
]

const renderPage = () => render(
  <MemoryRouter initialEntries={['/item/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <PublishItemPage />
  </MemoryRouter>
)

const cidSelect = (container) => container.querySelector('select[data-sf-m="item-select-cid"]')
const cidInputs = (container) => container.querySelectorAll('[data-sf-m="item-input-cid"]')
const options = (container) => Array.from(cidSelect(container)?.querySelectorAll('option') ?? [])

const fillRequired = (container) => {
  fireEvent.change(container.querySelector('[data-sf-m="item-input-title"]'), { target: { value: '测试商品' } })
  fireEvent.change(container.querySelector('[data-sf-m="item-input-price"]'), { target: { value: '7' } })
}

const submit = (container) => fireEvent.click(container.querySelector('[data-sf-m="item-primary"]'))

const submittedCid = async (callIndex) => {
  await waitFor(() => expect(publishListing.mock.calls.length).toBeGreaterThan(callIndex))
  return publishListing.mock.calls[callIndex][0].cid
}

describe('发布商品页 · 币种字段 = 下拉选择器', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue(CURRENCIES)
    // 无 id 回包 ⇒ 不跳转（页面停留 ok 态），同一实例可连做多次提交
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  // ---------------- ① 形态：select 在场 / 手填 input 计数 = 0 ----------------
  it('① 渲染 `select[data-sf-m="item-select-cid"]`，且 `item-input-cid` 计数 = 0', async () => {
    const { container } = renderPage()

    await waitFor(() => expect(options(container).length).toBe(CURRENCIES.length))

    expect(cidSelect(container)).not.toBeNull()
    expect(cidSelect(container).tagName).toBe('SELECT')
    expect(cidSelect(container).getAttribute('required')).not.toBeNull()
    // 判负读数：手填 input 必须**一条都不剩**
    expect(cidInputs(container).length).toBe(0)
    expect(container.querySelector('input[inputmode="numeric"][data-sf-m="item-input-cid"]')).toBeNull()
  })

  // ---------------- ② 选项数 = 接口返回条数（禁硬编码清单） ----------------
  it('② 选项数 = 模拟接口返回条数（3 条夹具 ⇒ 3 个 option；文本 = `symbol · name`，不显示编号）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(options(container).length).toBe(3))

    const opts = options(container)
    expect(opts.map((o) => o.value)).toEqual(['1', '7', '21'])
    expect(opts.map((o) => o.textContent)).toEqual(['$ · 社区积分', '₿ · BTTC', '¥'])
    // 反向：编号不得出现在显示文本里
    expect(opts.map((o) => o.textContent).join('|')).not.toContain('21')
  })

  it('②b 接口换一组条数（5 条）⇒ 选项数跟着变（证明不是写死 3 条）', async () => {
    fetchCurrencies.mockResolvedValue([
      { cid: 1, symbol: '$', name: '' },
      { cid: 2, symbol: 'A', name: 'Alpha' },
      { cid: 3, symbol: 'B', name: 'Beta' },
      { cid: 4, symbol: 'C', name: 'Gamma' },
      { cid: 5, symbol: 'D', name: 'Delta' },
    ])
    const { container } = renderPage()
    await waitFor(() => expect(options(container).length).toBe(5))
    expect(cidSelect(container).value).toBe('1')
  })

  // ---------------- ③ cid 随选择变化（两次不同选择 ⇒ 两个不同载荷） ----------------
  it('③ 换选币种后提交，载荷 `cid` = 所选数字值（7 与 21 两次 ⇒ 两次载荷不同、均非恒 1）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(options(container).length).toBe(3))

    // 首次：选 7（₿ BTTC）
    fireEvent.change(cidSelect(container), { target: { value: '7' } })
    expect(cidSelect(container).value).toBe('7')
    fillRequired(container)
    submit(container)
    const first = await submittedCid(0)
    expect(first).toBe(7)

    // 第二次：选 21（¥）—— 同实例再提交一次，取第二个载荷
    fireEvent.change(cidSelect(container), { target: { value: '21' } })
    expect(cidSelect(container).value).toBe('21')
    submit(container)
    const second = await submittedCid(1)

    expect(second).toBe(21)
    // 判负读数：两次载荷必须不同，且都不是默认值 1
    expect(second).not.toBe(first)
    expect([first, second]).not.toContain(1)
    expect(typeof second).toBe('number')
  })

  // ---------------- ④ 接口失败 ⇒ 回退 $，提交仍可用 ----------------
  it('④ `fetchCurrencies` 失败 ⇒ 回退仅 $（cid 1）一项、表单仍可提交（不白屏、不禁用）', async () => {
    fetchCurrencies.mockRejectedValue(new Error('503 LEDGER_TX_TIMEOUT'))
    const { container } = renderPage()

    await waitFor(() => expect(options(container).length).toBe(1))
    const opts = options(container)
    expect(opts.map((o) => o.value)).toEqual(['1'])
    expect(opts[0].textContent).toBe('$')
    expect(cidSelect(container).value).toBe('1')
    // 不白屏：表单主体与提交按钮都在，且提交按钮**未被禁用**
    const primary = container.querySelector('[data-sf-m="item-primary"]')
    expect(primary).not.toBeNull()
    expect(primary.hasAttribute('disabled')).toBe(false)
    expect(cidInputs(container).length).toBe(0)

    fillRequired(container)
    submit(container)
    expect(await submittedCid(0)).toBe(1)
  })

  it('④b 返回空数组 ⇒ 同样回退 $（不是空 select）', async () => {
    fetchCurrencies.mockResolvedValue([])
    const { container } = renderPage()
    await waitFor(() => expect(options(container).length).toBe(1))
    expect(options(container).map((o) => o.value)).toEqual(['1'])
    expect(cidSelect(container).value).toBe('1')
  })

  // ---------------- ⑤ 默认值不在返回列表 ⇒ 选第一项 ----------------
  it('⑤ 返回列表不含 cid 1 ⇒ 默认选中**第一项**（不留空值、不提交 0）', async () => {
    fetchCurrencies.mockResolvedValue([
      { cid: 7, symbol: '₿', name: 'BTTC' },
      { cid: 21, symbol: '¥', name: '' },
    ])
    const { container } = renderPage()
    await waitFor(() => expect(options(container).length).toBe(2))
    await waitFor(() => expect(cidSelect(container).value).toBe('7'))

    fillRequired(container)
    submit(container)
    expect(await submittedCid(0)).toBe(7)
  })
})
