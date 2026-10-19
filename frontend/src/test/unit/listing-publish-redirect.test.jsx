/**
 * 小需求单（Kevin 2026-10-11）· 上架成功 ⇒ **自动跳该商品详情页**（`/item/new` → `/item/<id>`）
 *
 * 口径（四条**逐条判负**，改回旧行为即红）：
 *   ① 成功且已 `listed` ⇒ `navigate(root('/item/' + itemId))`（**必带当前语言前缀**，四语一致）；
 *      且**跳转前先弹 toast**（`react-hot-toast`，`main.jsx` 顶层 `<Toaster/>` ⇒ 跨路由存活），文案复用
 *      `item.publishOk` + id（**不新增 i18n 键**）；
 *   ② `setListingStatus` 抛错 ⇒ **不跳**、停留在错误态与既有 R107 文案（`return` 生效）；
 *   ③ `publishListing` 抛错 ⇒ **不跳**；
 *   ④ `itemId` 为空/缺失（接口未回 id）⇒ **不跳**，保持 ok 态原地停留（**严禁拼 `/item/null`**）。
 *
 * 替身设计（两处刻意选型，避免「假门」）：
 *   · `react-router-dom` 走 **部分替身**：`useNavigate` = 「记录实参」+ **转发真 hook**（真路由照样走）。
 *     只录不跳的话，「目标路径真的能落到详情页」就无证据；这里两件事同时被钉住。
 *   · `listing-api` 走 **importOriginal + 只桩两个网络面**：幂等 tracker / 指纹仍跑**真代码**
 *     （与 `listing-market.test.jsx` 同法，见其 `ledger-api` 替身注释：漏键会把真前置打成 TypeError 假红）。
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => {
      const real = actual.useNavigate()
      return (...args) => {
        mockNavigate(...args)
        return real(...args)
      }
    },
  }
})

// `t` 取模块级稳定函数（同 `listing-market.test.jsx` 的探针自曝：每次新建 `t` 闭包会触发无限重渲染）。
// 返回**键名**本身 ⇒ 「文案确实走 i18n 键、而不是硬编中文」这条也被顺带钉住。
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
  return { ...actual, publishListing: vi.fn(), setListingStatus: vi.fn() }
})

import toast from 'react-hot-toast'
import { useAuth } from '../../auth-context'
import { publishListing, setListingStatus } from '../../pages/item/item-api'
import PublishListingPage from '../../pages/item/PublishItemPage'

// 详情页替身：只把**路由实参**摊出来（证明真路由确实落到了 `/…/item/<id>`，且 id 未被吃掉）
const DetailProbe = () => {
  const { itemId } = useParams()
  return <div data-sf-m="item-detail-probe">{`DETAIL:${itemId}`}</div>
}

const renderPage = (path) => render(
  <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/item/new" element={<PublishListingPage />} />
      <Route path="/:lang/item/new" element={<PublishListingPage />} />
      <Route path="/item/:itemId" element={<DetailProbe />} />
      <Route path="/:lang/item/:itemId" element={<DetailProbe />} />
    </Routes>
  </MemoryRouter>
)

const statusNode = (container) => container.querySelector('[data-sf-m="item-status"]')

const submitForm = (container) => {
  fireEvent.change(container.querySelector('[data-sf-m="item-input-title"]'), { target: { value: '测试商品' } })
  fireEvent.change(container.querySelector('[data-sf-m="item-input-price"]'), { target: { value: '7' } })
  // 商品分类（2026-10-20）：必选闸 ⇒ 统一选「数字商品」（运费控件随之不渲染）
  fireEvent.click(container.querySelector('[data-sf-m="item-input-type-digital"]'))
  fireEvent.click(container.querySelector('[data-sf-m="item-primary"]'))
}

describe('上架成功 ⇒ 自动跳该商品详情页（小需求单 · Kevin 2026-10-11）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    publishListing.mockResolvedValue({ listing_id: 123 })
    setListingStatus.mockResolvedValue({ listing_id: 123, status: 'listed' })
  })

  // ---------------- ① 成功（含 id）⇒ 跳转 + toast（四语各一例） ----------------
  it.each([
    ['zh（无前缀）', '/item/new', '/item/123'],
    ['en', '/en/item/new', '/en/item/123'],
    ['hk', '/hk/item/new', '/hk/item/123'],
    ['vn', '/vn/item/new', '/vn/item/123'],
  ])('① %s：成功且已 listed ⇒ navigate 到带语言前缀的 /item/<id>，且**先 toast 后跳**', async (label, entry, target) => {
    const { container } = renderPage(entry)
    submitForm(container)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1))
    expect(mockNavigate).toHaveBeenCalledWith(target)
    // 路径构造器唯一真源：不得出现 `undefined` / `null` 段
    expect(target).not.toContain('undefined')
    expect(target).not.toContain('null')

    // 真路由也确实落到了详情页（id 未被吃掉）——「只喊了一声 navigate」不算数
    await screen.findByText('DETAIL:123')
    expect(container.querySelector('[data-sf-m="item-primary"]')).toBeNull()

    // toast：文案 = `item.publishOk` 键值 + id（未新增 i18n 键）；且在 navigate **之前**发出
    expect(toast.success).toHaveBeenCalledTimes(1)
    const toastArg = toast.success.mock.calls[0][0]
    expect(typeof toastArg).toBe('string')
    expect(toastArg).toContain('item.publishOk')
    expect(toastArg).toContain('#123')
    expect(toast.success.mock.invocationCallOrder[0]).toBeLessThan(mockNavigate.mock.invocationCallOrder[0])
    // 失败态没理由弹成功 toast
    expect(toast.error).not.toHaveBeenCalled()
  })

  // ---------------- ② setListingStatus 抛错 ⇒ 不跳、停留错误态 ----------------
  it('② setListingStatus 抛错 ⇒ **不跳**，保持既有错误态与 R107 文案（`return` 生效）', async () => {
    setListingStatus.mockRejectedValue(new Error('LISTING_STATUS_TRANSITION_DENIED'))
    const { container } = renderPage('/item/new')
    submitForm(container)

    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(publishListing).toHaveBeenCalledTimes(1)
    expect(setListingStatus).toHaveBeenCalledTimes(1)
    expect(statusNode(container).textContent).toContain('item.listedFail')
    expect(statusNode(container).textContent).toContain('LISTING_STATUS_TRANSITION_DENIED')
    expect(container.textContent).not.toContain('[object Object]')

    // 四条「不跳」硬口径
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByText(/^DETAIL:/)).toBeNull()
    expect(container.querySelector('[data-sf-m="item-primary"]')).not.toBeNull() // 页面仍在原地
  })

  // ---------------- ③ 接口未回 id ⇒ 不跳（严禁 /item/null） ----------------
  it('③ 接口未回 id（`{}`）⇒ **不跳**、保持 ok 态原地停留；全量 navigate 实参不得含 null/undefined', async () => {
    publishListing.mockResolvedValue({})
    const { container } = renderPage('/item/new')
    submitForm(container)

    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('ok'))
    expect(statusNode(container).textContent).toContain('item.publishOk')
    expect(statusNode(container).textContent).toContain('#-')

    // 无 id ⇒ 连状态迁移都不该发（否则就是「对着不存在的实体发 PATCH」）
    expect(setListingStatus).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByText(/^DETAIL:/)).toBeNull()
    expect(container.querySelector('[data-sf-m="item-primary"]')).not.toBeNull()

    const navigateArgs = mockNavigate.mock.calls.flat().join(' ')
    expect(navigateArgs).not.toContain('null')
    expect(navigateArgs).not.toContain('undefined')
  })

  // ---------------- ④ publishListing 抛错 ⇒ 不跳 ----------------
  it('④ publishListing 抛错 ⇒ **不跳**、错误态（不因「未 listed」而误跳）', async () => {
    publishListing.mockRejectedValue(new Error('LEDGER_IDEMPOTENCY_KEY_REQUIRED'))
    const { container } = renderPage('/item/new')
    submitForm(container)

    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(statusNode(container).textContent).toContain('LEDGER_IDEMPOTENCY_KEY_REQUIRED')
    expect(setListingStatus).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByText(/^DETAIL:/)).toBeNull()
  })

  // ---------------- ⑤ `bID` 回包形态（同源兜底字段）也走同一跳转口径 ----------------
  it('⑤ 回包只有 `bID`（无 `listing_id`）⇒ 同样跳 `/item/<bID>`（不因字段名差异漏跳）', async () => {
    publishListing.mockResolvedValue({ bID: 987 })
    const { container } = renderPage('/en/item/new')
    submitForm(container)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/en/item/987'))
    await screen.findByText('DETAIL:987')
  })

  // ---------------- ⑥ 成功态下的「去列表」按钮归属（保留判定的落点） ----------------
  it('⑥ 成功态跳走后本页不再停留；「去列表」按钮仍在**跳转前各态**可见（非死代码）', async () => {
    const { container } = renderPage('/item/new')
    // idle 态即可见
    expect(container.querySelector('[data-sf-m="item-goto-feed"]')).not.toBeNull()
    submitForm(container)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1))
    // 跳转后本页卸载 ⇒ 该按钮随之消失（其可见态 = idle/loading/error + ok 跳转前一瞬）
    await screen.findByText('DETAIL:123')
    await waitFor(() => expect(container.querySelector('[data-sf-m="item-goto-feed"]')).toBeNull())
  })
})
