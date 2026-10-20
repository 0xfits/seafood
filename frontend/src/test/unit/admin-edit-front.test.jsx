/**
 * 管理员编辑（0059）· 前端单测
 * ============================================================================
 * 覆盖本单三件前端面的**判负敏感**部分（浏览器探针负责几何 / 真实渲染，本文件负责逻辑臂）：
 *
 *   A · 详情页【编辑】入口（钩子 `item-edit-link`）可见性 = **已登录 ∧ (本人 ∨ 管理员) ∧ status∈{draft,listed}**
 *       —— 三臂：本人看到 / 陌生人看不到 / 管理员看他人商品看到；外加「非可编辑态 ⇒ 不渲染」与「未登录 ⇒ 不渲染」。
 *   B · 编辑页预填改走 `GET /api/listing/:id/edit`（0059）—— 五项（description / price / stock /
 *       media_urls / item_type 级联）逐字段预填；`cid` 只读。
 *   C · 失败面**不白屏**：403 ⇒ `uiError.forbidden`（无权限）、404 ⇒ `uiError.notFound`（商品不存在），
 *       两者都**不渲染表单**（不留空表单可提交）。
 *   D · 管理员编辑**他人**商品 ⇒ 页头提示条 `item-admin-note`（文案键 `item.adminEditing`）；
 *       本人编辑即便具备管理员能力也**不渲染**该条（归属判定臂）。
 *
 * 替身口径（承 `item-condition-front.test.jsx` 体例）：
 *   · `item-api` = 真模块 + 只桩五个面（读口两个 / 写口 / 币种 / 状态迁移）；
 *   · `../../auth` 只桩 `fetchApiJson`（真映射、假传输）—— 管理员三键由 `/api/user` 的响应喂；
 *   · `../../trades-api` 只桩 `fetchMyListings`（仅用于「管理员编辑」归属判定）；
 *   · `t` 返回**键名本身** ⇒ 「文案走 i18n 键、零硬编中文字面」顺带被钉住。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stableT = (key) => key

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { language: 'zh', resolvedLanguage: 'zh', changeLanguage: vi.fn() },
  }),
}))

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

/**
 * ★ 替身缝合点必须是 `fetchCurrentUser`，不是 `fetchApiJson`：
 *   `auth.js` 的 `fetchCurrentUser` 调用的是**同模块内绑定**的 `fetchApiJson`，
 *   只替换模块导出不会拦到那次内部调用（实测：`/api/user` 仍走真传输 ⇒
 *   `Failed to parse URL from /api/user` ⇒ `loadListingEditAdmin` 静默 fail-safe 回 null
 *   ⇒ 管理员三臂全红，而**产品行为本身正确**）。
 *   ⇒ 这里让 `fetchCurrentUser` 显式**经过** `fetchApiJson` 替身，两条断言面（URL 调用
 *     + 管理员三键载荷）因此落在同一个 spy 上，且不引入第二套假传输。
 */
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  const fetchApiJson = vi.fn(async () => ({}))
  return {
    ...actual,
    fetchApiJson,
    fetchCurrentUser: vi.fn(async (user) => fetchApiJson('/api/user', {
      headers: { Authorization: `Bearer ${user?.token || ''}` },
    })),
  }
})

vi.mock('../../trades-api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchMyListings: vi.fn(async () => []) }
})

vi.mock('../../pages/item/item-api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchCurrencies: vi.fn(),
    fetchListingDetail: vi.fn(),
    fetchListingEdit: vi.fn(),
    publishListing: vi.fn(),
    setListingStatus: vi.fn(),
    updateListingFields: vi.fn(),
  }
})

import { useAuth } from '../../auth-context'
import { fetchApiJson } from '../../auth'
import { fetchMyListings } from '../../trades-api'
import {
  fetchCurrencies, fetchListingDetail, fetchListingEdit, setListingStatus, updateListingFields,
} from '../../pages/item/item-api'
import { resetListingEditAdminCache } from '../../pages/item/item-edit-access'
import ItemDetailPage from '../../pages/item/ItemDetailPage'
import PublishItemPage from '../../pages/item/PublishItemPage'

const q = (container, key) => container.querySelector(`[data-sf-m="${key}"]`)
const editLink = (container) => q(container, 'item-edit-link')
const adminNote = (container) => q(container, 'item-admin-note')
const loadError = (container) => q(container, 'item-edit-load-error')

const CURRENCIES = [{ cid: 1, symbol: '$', name: '社区积分' }]
const ME = { uID: 7, evm: '0xabc', token: 'test-token' }
const OTHER_SELLER_UID = 99

/** `/api/user` 的管理员三键（后端 `buildUserPayload` 的加性 `admin` 对象）。 */
const ADMIN_FLAGS = { can_access_admin: true, is_admin: false, permissions: ['manage_rewards'] }
const NOT_ADMIN_FLAGS = { can_access_admin: false, is_admin: false, permissions: [] }

/** 详情行（`GET /api/prize/:id` 的关键键：status / seller.uid 是入口可见性的两个输入）。 */
const detailRow = (over = {}) => ({
  listing_id: 9,
  title: '九成新折叠桌子',
  description: '九成新折叠桌子\n自提，仅限本周末',
  price: 120,
  cid: 1,
  status: 'listed',
  stock: 2,
  media_urls: [],
  wants: 3,
  views: 11,
  seller: { uid: OTHER_SELLER_UID, nickname: '0x12**cd', credit: 'new' },
  ...over,
})

/** 编辑读口行（与 `/api/listing/mine` 同族 11 键）。 */
const editRow = (over = {}) => ({
  listing_id: 501,
  title: '旧描述首行',
  price: 9,
  cid: 1,
  status: 'listed',
  stock: 4,
  media_urls: ['/api/media/11'],
  time_created: '2026-10-20 10:00:00',
  description: '旧描述首行\n旧描述第二行',
  item_type: 'PhysicalFreeShip',
  condition: 'LikeNew',
  ...over,
})

const renderDetail = (itemId = 9) => render(
  <MemoryRouter initialEntries={[`/item/${itemId}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/item/:itemId" element={<ItemDetailPage />} />
    </Routes>
  </MemoryRouter>,
)

const renderEdit = (itemId = 501) => render(
  <MemoryRouter initialEntries={[`/item/${itemId}/edit`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/item/:itemId/edit" element={<PublishItemPage mode="edit" />} />
      <Route path="/profile/trades/published" element={<div data-sf-m="published-probe" />} />
    </Routes>
  </MemoryRouter>,
)

/** 让 `/api/user` 回指定三键（其它 URL 一律空对象 ⇒ 收藏列表一类静默为空）。 */
const stubUserAdmin = (flags) => {
  fetchApiJson.mockImplementation(async (url) => {
    if (String(url) === '/api/user') return { uID: ME.uID, admin: flags }
    return {}
  })
}

/**
 * 管理员三键探测次数（**只数 `/api/user`**）。
 * ★ 不能用 `expect(fetchApiJson).not.toHaveBeenCalled()`：详情页在同一挂载里还会经
 *   `trades-api` 读 `/api/favorites`（收藏态初始化），那是**与本品无关的既有读口**
 *   ⇒ 整条 spy 恒有调用，断言会把「省了管理员探测」误判成红。
 */
const userProbeCount = () => fetchApiJson.mock.calls
  .filter(([url]) => String(url) === '/api/user').length

beforeEach(() => {
  vi.clearAllMocks()
  resetListingEditAdminCache()
  useAuth.mockReturnValue({ isAuthenticated: true, user: ME })
  fetchCurrencies.mockResolvedValue(CURRENCIES)
  fetchListingDetail.mockResolvedValue(detailRow())
  fetchListingEdit.mockResolvedValue(editRow())
  fetchMyListings.mockResolvedValue([])
  updateListingFields.mockResolvedValue(editRow({ price: 15 }))
  setListingStatus.mockResolvedValue({})
  stubUserAdmin(NOT_ADMIN_FLAGS)
})

afterEach(() => { cleanup() })

// ---------------------------------------------------------------------------
// A · 详情页【编辑】入口可见性（三臂 + 两个负向臂）
// ---------------------------------------------------------------------------
describe('A · 详情页【编辑】入口（item-edit-link）', () => {
  it('本人（seller.uid === 我的 uID）∧ status=listed ⇒ 入口在场，href 指向 /item/<id>/edit', async () => {
    fetchListingDetail.mockResolvedValue(detailRow({ seller: { uid: ME.uID, nickname: '0x12**cd', credit: 'new' } }))
    const { container } = renderDetail()

    await waitFor(() => expect(editLink(container)).not.toBeNull())
    expect(editLink(container).getAttribute('href')).toBe('/item/9/edit')
    // 本人臂**不需要**补取管理员三键（省一次 `/api/user`）
    await waitFor(() => expect(q(container, 'item-detail-web-cols')).not.toBeNull())
    expect(userProbeCount()).toBe(0)
  })

  it('本人 ∧ status=draft ⇒ 入口在场（草稿也可编辑）', async () => {
    fetchListingDetail.mockResolvedValue(detailRow({
      status: 'draft', seller: { uid: ME.uID, nickname: '0x12**cd', credit: 'new' },
    }))
    const { container } = renderDetail()

    await waitFor(() => expect(editLink(container)).not.toBeNull())
  })

  it('本人 ∧ status=delisted（只读终态）⇒ 入口**不渲染**', async () => {
    fetchListingDetail.mockResolvedValue(detailRow({
      status: 'delisted', seller: { uid: ME.uID, nickname: '0x12**cd', credit: 'new' },
    }))
    const { container } = renderDetail()

    await waitFor(() => expect(q(container, 'item-detail-web-cols')).not.toBeNull())
    expect(editLink(container)).toBeNull()
  })

  it('未登录 ⇒ 入口**不渲染**，且**零** `/api/user`（不做管理员探测）', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    const { container } = renderDetail()

    await waitFor(() => expect(q(container, 'item-detail-web-cols')).not.toBeNull())
    expect(editLink(container)).toBeNull()
    expect(userProbeCount()).toBe(0)
  })

  it('陌生人（非本人 ∧ 非管理员）⇒ 入口**不渲染**（负向臂：管理员三键已取回但为 false）', async () => {
    const { container } = renderDetail()

    // 先确证「管理员探测真的发生过且回的是 false」——否则本臂会因为「没取数」而假绿
    await waitFor(() => expect(fetchApiJson).toHaveBeenCalledWith('/api/user', expect.anything()))
    await new Promise((resolve) => { setTimeout(resolve, 20) })
    expect(editLink(container)).toBeNull()
  })

  it('管理员（can_access_admin ∧ manage_rewards）看他人商品 ⇒ 入口在场', async () => {
    stubUserAdmin(ADMIN_FLAGS)
    const { container } = renderDetail()

    await waitFor(() => expect(editLink(container)).not.toBeNull())
    expect(editLink(container).getAttribute('href')).toBe('/item/9/edit')
  })

  it('管理员 ∧ 他人商品 status=delisted ⇒ 入口**不渲染**（状态闸优先于身份）', async () => {
    stubUserAdmin(ADMIN_FLAGS)
    fetchListingDetail.mockResolvedValue(detailRow({ status: 'delisted' }))
    const { container } = renderDetail()

    await waitFor(() => expect(fetchApiJson).toHaveBeenCalledWith('/api/user', expect.anything()))
    await new Promise((resolve) => { setTimeout(resolve, 20) })
    expect(editLink(container)).toBeNull()
  })

  it('`can_access_admin=true` 但权限不含 manage_rewards 且非 is_admin ⇒ 入口**不渲染**（三键同式）', async () => {
    stubUserAdmin({ can_access_admin: true, is_admin: false, permissions: ['review_tasks'] })
    const { container } = renderDetail()

    await waitFor(() => expect(fetchApiJson).toHaveBeenCalledWith('/api/user', expect.anything()))
    await new Promise((resolve) => { setTimeout(resolve, 20) })
    expect(editLink(container)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// B · 编辑页预填改走 `GET /api/listing/:id/edit`
// ---------------------------------------------------------------------------
describe('B · 编辑页预填（新读口 · 五项）', () => {
  it('读口 200 ⇒ 五项逐字段预填 + cid 只读', async () => {
    const { container } = renderEdit()

    await waitFor(() => expect(q(container, 'item-form')).not.toBeNull())
    expect(fetchListingEdit).toHaveBeenCalledWith('501', ME)
    expect(fetchMyListings).not.toHaveBeenCalled() // 预填**不再**依赖「我发布的」列表

    expect(q(container, 'item-input-note').value).toBe('旧描述首行\n旧描述第二行')
    expect(q(container, 'item-input-price').value).toBe('9')
    expect(q(container, 'item-input-stock').value).toBe('4')
    // item_type 级联反推：PhysicalFreeShip ⇒ 实物 + 包邮
    expect(q(container, 'item-input-type-physical').checked).toBe(true)
    expect(q(container, 'item-input-ship-free').checked).toBe(true)
    expect(q(container, 'item-select-deliver')).toBeNull()
    // 成色预填
    expect(q(container, 'item-input-condition-likeNew').checked).toBe(true)
    // 既有图片（media_urls[0]）
    expect(q(container, 'item-image-existing-0')).not.toBeNull()
    // cid 只读
    expect(q(container, 'item-cid-readonly').getAttribute('readonly')).not.toBeNull()
  })

  it('读口 200 且 item_type=NULL ⇒ 三控件全空（不猜补）', async () => {
    fetchListingEdit.mockResolvedValue(editRow({ item_type: null, condition: null }))
    const { container } = renderEdit()

    await waitFor(() => expect(q(container, 'item-form')).not.toBeNull())
    expect(q(container, 'item-input-type-digital').checked).toBe(false)
    expect(q(container, 'item-input-type-physical').checked).toBe(false)
    expect(q(container, 'item-select-deliver')).toBeNull()
    expect(q(container, 'item-select-ship')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// C · 失败面：403 / 404 → 提示不白屏、不留可提交空表单
// ---------------------------------------------------------------------------
describe('C · 编辑页无权限 / 不存在（不白屏）', () => {
  const failWith = (status) => {
    const error = new Error(`status ${status}`)
    error.status = status
    fetchListingEdit.mockRejectedValue(error)
  }

  it('403 ⇒ 提示 `uiError.forbidden`，表单**不渲染**', async () => {
    failWith(403)
    const { container } = renderEdit()

    await waitFor(() => expect(loadError(container)).not.toBeNull())
    expect(loadError(container).textContent).toContain('uiError.forbidden')
    expect(q(container, 'item-form')).toBeNull()
  })

  it('404 ⇒ 提示 `uiError.notFound`，表单**不渲染**', async () => {
    failWith(404)
    const { container } = renderEdit()

    await waitFor(() => expect(loadError(container)).not.toBeNull())
    expect(loadError(container).textContent).toContain('uiError.notFound')
    expect(q(container, 'item-form')).toBeNull()
  })

  it('403 ⇒ 失败态给回列表出口（不白屏）；商品提示条不渲染', async () => {
    failWith(403)
    const { container } = renderEdit()

    await waitFor(() => expect(loadError(container)).not.toBeNull())
    expect(loadError(container).querySelector('a[href="/"]')).not.toBeNull()
    expect(adminNote(container)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// D · 「管理员编辑」提示条（归属判定臂）
// ---------------------------------------------------------------------------
describe('D · 管理员编辑提示条（item-admin-note）', () => {
  it('管理员 ∧ 该行**不在**「我发布的」⇒ 提示条在场，文案 = `item.adminEditing`', async () => {
    stubUserAdmin(ADMIN_FLAGS)
    fetchMyListings.mockResolvedValue([{ listing_id: 777 }])
    const { container } = renderEdit()

    await waitFor(() => expect(adminNote(container)).not.toBeNull())
    expect(adminNote(container).textContent).toBe('item.adminEditing')
    // 预填不受提示条影响（同一读口的五项已就位）
    expect(q(container, 'item-input-price').value).toBe('9')
  })

  it('管理员 ∧ 该行**在**「我发布的」⇒ 提示条**不渲染**（本人编辑不误标）', async () => {
    stubUserAdmin(ADMIN_FLAGS)
    fetchMyListings.mockResolvedValue([{ listing_id: 501 }])
    const { container } = renderEdit()

    await waitFor(() => expect(q(container, 'item-form')).not.toBeNull())
    await waitFor(() => expect(fetchMyListings).toHaveBeenCalled())
    await new Promise((resolve) => { setTimeout(resolve, 20) })
    expect(adminNote(container)).toBeNull()
  })

  it('普通用户（三键全 false）⇒ 不取「我发布的」、提示条不渲染', async () => {
    const { container } = renderEdit()

    await waitFor(() => expect(q(container, 'item-form')).not.toBeNull())
    await new Promise((resolve) => { setTimeout(resolve, 20) })
    expect(fetchMyListings).not.toHaveBeenCalled()
    expect(adminNote(container)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// E · 保存仍走字段支（管理员路径复用同一条 PATCH）
// ---------------------------------------------------------------------------
describe('E · 保存（字段支 PATCH）', () => {
  it('管理员改价 ⇒ PATCH `{ price }` 一次，成功后离开表单（回列表）', async () => {
    stubUserAdmin(ADMIN_FLAGS)
    fetchMyListings.mockResolvedValue([])
    const { container } = renderEdit()

    await waitFor(() => expect(adminNote(container)).not.toBeNull())
    fireEvent.change(q(container, 'item-input-price'), { target: { value: '15' } })
    fireEvent.click(q(container, 'item-primary'))

    await waitFor(() => expect(updateListingFields).toHaveBeenCalledTimes(1))
    const [listingId, patch] = updateListingFields.mock.calls[0]
    expect(String(listingId)).toBe('501')
    expect(patch).toEqual({ price: 15 })
    await waitFor(() => expect(q(container, 'item-form')).toBeNull())
    expect(q(container, 'published-probe')).not.toBeNull()
  })
})
