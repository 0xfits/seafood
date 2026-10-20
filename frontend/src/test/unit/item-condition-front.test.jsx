/**
 * 商品成色控件单测（迁移 0057 四值闭集 · route §49.14.3 / data §40.8.2）
 * ============================================================================
 * 真实缺口（本单立案依据）：后端已支持 `item_condition`（四值闭集 + 仅实物两分类适用），
 *   而发布/编辑表单**完全没有成色控件**（`PublishItemPage.jsx` 零命中、编辑页预填只有描述/价格/分类级联）。
 *
 * 判据：
 *   ① **仅实物分支**渲染成色四选一；数字 / 未分类分支**零控件**（不是 display:none）；
 *   ② 实物下**必选**：未选 ⇒ `onSubmit` 最前拦截（零 `fetchApiJson` / 零 `publishListing`）
 *      ＋ 组 `aria-invalid` / `sf-item-choice-miss` ＋ 复用既有键 `uiError.badRequest`（零新文案键）；
 *   ③ 载荷 = 单字段 `item_condition`，四值逐字（PascalCase，不翻译）；数字分支**不带该字段**；
 *      实物 → 数字切换 ⇒ 值清空（stale 不进载荷）；
 *   ④ 编辑页：预填 `/api/listing/mine` 行键 `condition`（可改），实变才进 PATCH；
 *      行内 `condition = null` ⇒ 控件未选、**不强制补选**（存量实物行仍可改价/改描述）；
 *   ⑤ 文案键 = 既有 `itemCondition.*` 四语（本单零新增 i18n 键 ⇒ 计数不变）。
 *
 * 替身设计（承 `item-type-front.test.jsx` 体例）：
 *   · `item-api` = `importOriginal + 只桩四个面` ⇒ 线体断言走 `vi.importActual` 的**真** `publishListing`；
 *   · `../../auth` 只桩 `fetchApiJson` / `getAuthHeaders`（真映射、假传输）；
 *   · `../../trades-api` 只桩 `fetchMyListings`（编辑页取自「我的挂单」）；
 *   · `t` 返回**键名本身** ⇒ 「文案走 i18n 键、零硬编中文字面」顺带被钉住。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchApiJson: vi.fn(async () => ({})), getAuthHeaders: vi.fn(() => ({})) }
})

vi.mock('../../trades-api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchMyListings: vi.fn() }
})

vi.mock('../../pages/item/item-api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchCurrencies: vi.fn(),
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
  fetchCurrencies, fetchListingEdit, publishListing, setListingStatus, updateListingFields,
} from '../../pages/item/item-api'
import PublishItemPage from '../../pages/item/PublishItemPage'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const publishSrc = fs.readFileSync(path.join(SRC, 'pages/item/PublishItemPage.jsx'), 'utf8')

/** 四值闭集（与后端 `ITEM_CONDITIONS` / 迁移 0057 CHECK 逐字一致；顺序 = 控件顺序）。 */
const CONDITIONS = ['BrandNewSealed', 'LikeNew', 'MinorWear', 'HeavyWear']
const HOOKS = ['brandNewSealed', 'likeNew', 'minorWear', 'heavyWear']

const CURRENCIES = [{ cid: 1, symbol: '$', name: '社区积分' }]
const USER = { uID: 7, token: 'test' }

afterEach(() => { cleanup() })

const renderPage = () => render(
  <MemoryRouter initialEntries={['/item/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <PublishItemPage />
  </MemoryRouter>,
)

const renderEdit = (itemId = 501) => render(
  <MemoryRouter initialEntries={[`/item/${itemId}/edit`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/item/:itemId/edit" element={<PublishItemPage mode="edit" />} />
    </Routes>
  </MemoryRouter>,
)

const q = (container, key) => container.querySelector(`[data-sf-m="${key}"]`)
const condGroup = (container) => q(container, 'item-select-condition')
const typeGroup = (container) => q(container, 'item-select-type')
const shipGroup = (container) => q(container, 'item-select-ship')
const statusNode = (container) => q(container, 'item-status')

const fillBasics = (container) => {
  fireEvent.change(q(container, 'item-input-note'), { target: { value: '成色测试商品' } })
  fireEvent.change(q(container, 'item-input-price'), { target: { value: '7' } })
}

const submit = (container) => fireEvent.click(q(container, 'item-primary'))
const lastPayload = () => publishListing.mock.calls[publishListing.mock.calls.length - 1][0]

/** 「我的挂单」行（`/api/listing/mine` 11 键形状，含 P57 成色键 `condition`）。 */
const mineRow = (over = {}) => ({
  listing_id: 501, title: '旧标题', price: 9, cid: 1, status: 'listed', stock: 2,
  media_urls: [], time_created: '2026-10-20 10:00:00',
  description: '旧描述首行', item_type: 'PhysicalFreeShip', condition: 'LikeNew',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ isAuthenticated: true, user: USER })
  fetchCurrencies.mockResolvedValue(CURRENCIES)
  publishListing.mockResolvedValue({})
  setListingStatus.mockResolvedValue({})
  updateListingFields.mockResolvedValue({})
  fetchListingEdit.mockResolvedValue(mineRow())
  // ★ 0059：编辑页预填改走 `GET /api/listing/:id/edit`（本人/管理员同一 11 键行）——
  //   本文件只关心成色字段，故让读口直接回同一行；`mine` 仍桩着（管理员提示条归属判定用，本文件不触发）。
  fetchListingEdit.mockResolvedValue(mineRow())
})

// ---------------------------------------------------------------------------
// A · 发布页：仅实物分支渲染 + 四值载荷映射
// ---------------------------------------------------------------------------
describe('A · 发布页成色四选一（仅实物分支 · 单字段 item_condition）', () => {
  it('数字分支 ⇒ 成色控件**零渲染**（组与四个选项都 0 命中）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    fireEvent.click(q(container, 'item-input-deliver-auto'))
    expect(condGroup(container)).toBeNull()
    for (const hook of HOOKS) expect(q(container, `item-input-condition-${hook}`)).toBeNull()
  })

  it('实物分支 ⇒ 组在场、4 个 radio、`aria-required`、初始全未选', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-physical'))
    const group = condGroup(container)
    expect(group).not.toBeNull()
    expect(group.getAttribute('role')).toBe('radiogroup')
    expect(group.getAttribute('aria-required')).toBe('true')
    expect(group.querySelectorAll('input[type="radio"]').length).toBe(4)
    expect([...group.querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)
    // 四个选项的 value = 四值闭集、文案 = 既有 i18n 键名
    expect([...group.querySelectorAll('input')].map((el) => el.value)).toEqual(CONDITIONS)
    expect([...group.querySelectorAll('.sf-item-choice-text')].map((el) => el.textContent))
      .toEqual(['itemCondition.brandNewSealed', 'itemCondition.likeNew', 'itemCondition.minorWear', 'itemCondition.heavyWear'])
    // 钩子逐个在场（派单指定形态）
    for (const hook of HOOKS) expect(q(container, `item-input-condition-${hook}`)).not.toBeNull()
  })

  it('四值逐次选中 ⇒ 载荷 `item_condition` 逐字映射（PascalCase · 不翻译）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())
    fireEvent.click(q(container, 'item-input-type-physical'))
    fireEvent.click(q(container, 'item-input-ship-free'))
    fillBasics(container)

    for (const [i, hook] of HOOKS.entries()) {
      fireEvent.click(q(container, `item-input-condition-${hook}`))
      submit(container)
      await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(i + 1))
      // 等**提交落定**（phase = ok）再打下一次，否则第二次点击会撞在 `loading` 早退分支上
      await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('ok'))
      expect(lastPayload().itemCondition).toBe(CONDITIONS[i])
      expect(lastPayload().itemType).toBe('PhysicalFreeShip')
      // 行键只有一个成色字段（无第二成色字段混入）
      expect(Object.keys(lastPayload()).filter((k) => /condition/i.test(k))).toEqual(['itemCondition'])
    }
  })

  it('数字分支 ⇒ 载荷**无** `item_condition`（字段缺省，数字带值后端 400）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    fireEvent.click(q(container, 'item-input-deliver-manual'))
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))

    expect(lastPayload().itemType).toBe('DigitalManualDeliver')
    expect(lastPayload().itemCondition).toBeNull()
  })

  it('实物选成色 ⇒ 切实物之外 ⇒ 控件消失且**值已清空**（stale 不进载荷）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-physical'))
    fireEvent.click(q(container, 'item-input-ship-free'))
    fireEvent.click(q(container, 'item-input-condition-heavyWear'))
    expect(q(container, 'item-input-condition-heavyWear').checked).toBe(true)

    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(condGroup(container)).toBeNull()
    fireEvent.click(q(container, 'item-input-deliver-auto'))
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('DigitalAutoDeliver')
    expect(lastPayload().itemCondition).toBeNull() // ★ 拖过来的 stale 成色不得上送

    // 再切回实物：成色**不复活**（必须重选）
    fireEvent.click(q(container, 'item-input-type-physical'))
    expect([...condGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// B · 必选闸：实物未选成色 ⇒ 阻止提交（零网络调用）
// ---------------------------------------------------------------------------
describe('B · 实物未选成色 ⇒ 拦截（零请求 + 组高亮）', () => {
  it('零 `fetchApiJson` / 零 `publishListing`；文案 = 既有键；选中即清高亮', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())
    fireEvent.click(q(container, 'item-input-type-physical'))
    fireEvent.click(q(container, 'item-input-ship-free'))
    fillBasics(container)

    fetchApiJson.mockClear()
    submit(container)

    await waitFor(() => expect(statusNode(container).textContent).toBe('uiError.badRequest'))
    expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error')
    expect(fetchApiJson).not.toHaveBeenCalled()
    expect(publishListing).not.toHaveBeenCalled()

    const group = condGroup(container)
    expect(group.getAttribute('aria-invalid')).toBe('true')
    expect(group.className).toContain('sf-item-choice-miss')
    expect(group.getAttribute('data-sf-miss')).toBe('1')

    // 选中 ⇒ 高亮与 aria-invalid 即清、可提交
    fireEvent.click(q(container, 'item-input-condition-likeNew'))
    expect(condGroup(container).getAttribute('aria-invalid')).toBeNull()
    expect(condGroup(container).className).not.toContain('sf-item-choice-miss')

    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemCondition).toBe('LikeNew')
  })

  it('成色闸与其他分类闸**同时**缺选时都在最前（图片上传亦零发生）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())
    // 实物未选运费 + 未选成色 ⇒ 两个组同时高亮、零请求
    fireEvent.click(q(container, 'item-input-type-physical'))
    fillBasics(container)
    fetchApiJson.mockClear()
    submit(container)
    await waitFor(() => expect(condGroup(container).getAttribute('aria-invalid')).toBe('true'))
    expect(shipGroup(container).getAttribute('aria-invalid')).toBe('true')
    expect(fetchApiJson).not.toHaveBeenCalled()
    expect(publishListing).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// C · 线体：真 `publishListing` 的 `item_condition` 映射
// ---------------------------------------------------------------------------
describe('C · item-api 线体：`item_condition` 单字段（四值 / 缺省）', () => {
  it('四值逐字上送，且不出现第二成色字段', async () => {
    const actual = await vi.importActual('../../pages/item/item-api')
    fetchApiJson.mockClear()
    fetchApiJson.mockResolvedValue({})

    for (const itemCondition of CONDITIONS) {
      await actual.publishListing({
        cid: 1, price: '7', stock: '1', description: 'T', mediaUrls: [],
        itemType: 'PhysicalFreeShip', itemCondition, createKey: 'cli:x', user: null,
      })
    }
    const bodies = fetchApiJson.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(bodies.map((b) => b.item_condition)).toEqual(CONDITIONS)
    for (const body of bodies) {
      expect(Object.keys(body).filter((k) => /condition/i.test(k))).toEqual(['item_condition'])
    }
  })

  it('`null` / 未传 ⇒ 字段**缺省**（落 NULL），且从不发 `\'\'`（空串 = 后端 400）', async () => {
    const actual = await vi.importActual('../../pages/item/item-api')
    fetchApiJson.mockClear()
    fetchApiJson.mockResolvedValue({})

    await actual.publishListing({ cid: 1, price: '7', stock: '1', description: 'T', mediaUrls: [], createKey: 'cli:x', user: null })
    await actual.publishListing({
      cid: 1, price: '7', stock: '1', description: 'T', mediaUrls: [],
      itemType: 'DigitalAutoDeliver', itemCondition: null, createKey: 'cli:x', user: null,
    })
    const bodies = fetchApiJson.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(bodies.every((b) => !('item_condition' in b))).toBe(true)
    expect(bodies.some((b) => b.item_condition === '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D · 编辑页：预填 `condition`（mine 行键）+ 可改 + 实变才进 PATCH
// ---------------------------------------------------------------------------
describe('D · 编辑页预填与保存（草稿 / 在售均可改）', () => {
  it('实物行 `condition = LikeNew` ⇒ 对应 radio 选中、其余未选', async () => {
    const { container } = renderEdit()
    await waitFor(() => expect(condGroup(container)).not.toBeNull())

    expect(q(container, 'item-input-type-physical').checked).toBe(true)
    expect(q(container, 'item-input-ship-free').checked).toBe(true)
    expect(q(container, 'item-input-condition-likeNew').checked).toBe(true)
    for (const hook of ['brandNewSealed', 'minorWear', 'heavyWear']) {
      expect(q(container, `item-input-condition-${hook}`).checked).toBe(false)
    }
  })

  it('改成「严重磨损」⇒ PATCH **只带** `item_condition`（其余未变字段不上送）', async () => {
    const { container } = renderEdit()
    await waitFor(() => expect(condGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-condition-heavyWear'))
    submit(container)
    await waitFor(() => expect(updateListingFields).toHaveBeenCalledTimes(1))

    const [listingId, patch] = updateListingFields.mock.calls[0]
    expect(String(listingId)).toBe('501')
    expect(patch).toEqual({ item_condition: 'HeavyWear' })
  })

  it('草稿行（`status = draft`）同样可改成色（后端无状态限制）', async () => {
    fetchListingEdit.mockResolvedValue(mineRow({ status: 'draft', condition: 'MinorWear' }))
    const { container } = renderEdit()
    await waitFor(() => expect(condGroup(container)).not.toBeNull())

    expect(q(container, 'item-input-condition-minorWear').checked).toBe(true)
    fireEvent.click(q(container, 'item-input-condition-brandNewSealed'))
    submit(container)
    await waitFor(() => expect(updateListingFields).toHaveBeenCalledTimes(1))
    expect(updateListingFields.mock.calls[0][1]).toEqual({ item_condition: 'BrandNewSealed' })
  })

  it('未改任何字段 ⇒ **零 PATCH**（成色相等不产生空 patch 的 400）', async () => {
    const { container } = renderEdit()
    await waitFor(() => expect(condGroup(container)).not.toBeNull())

    submit(container)
    // 无变化分支 ⇒ toast + 回「我发布的」（本测试未挂该路由 ⇒ 表单被卸载是「已跳转」的可观测证据）
    await waitFor(() => expect(container.querySelector('[data-sf-m="item-form"]')).toBeNull())
    expect(updateListingFields).not.toHaveBeenCalled()
  })

  it('实物行 `condition = null`（存量）⇒ 控件在场但**未选**、且不强制补选（改价仍可保存）', async () => {
    fetchListingEdit.mockResolvedValue(mineRow({ condition: null }))
    const { container } = renderEdit()
    await waitFor(() => expect(condGroup(container)).not.toBeNull())

    expect([...condGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)

    fireEvent.change(q(container, 'item-input-price'), { target: { value: '11' } })
    submit(container)
    await waitFor(() => expect(updateListingFields).toHaveBeenCalledTimes(1))
    expect(updateListingFields.mock.calls[0][1]).toEqual({ price: 11 }) // 不含 item_condition（NULL ⇒ 未变）
  })

  it('数字行 ⇒ 成色控件零渲染；改成色不可达、PATCH 无 `item_condition`', async () => {
    fetchListingEdit.mockResolvedValue(mineRow({
      item_type: 'DigitalAutoDeliver', condition: null,
    }))
    const { container } = renderEdit()
    await waitFor(() => expect(q(container, 'item-input-type-digital')).not.toBeNull())
    await waitFor(() => expect(q(container, 'item-input-type-digital').checked).toBe(true))

    expect(condGroup(container)).toBeNull()
    fireEvent.change(q(container, 'item-input-price'), { target: { value: '12' } })
    submit(container)
    await waitFor(() => expect(updateListingFields).toHaveBeenCalledTimes(1))
    expect(updateListingFields.mock.calls[0][1]).toEqual({ price: 12 })
  })

  it('闭集外 / 缺键的 `condition`（异常行）⇒ 一律未选，**不猜补**', async () => {
    fetchListingEdit.mockResolvedValue(mineRow({ condition: 'BrandNew' }))
    const { container } = renderEdit()
    await waitFor(() => expect(condGroup(container)).not.toBeNull())
    expect([...condGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// E · 源码 / i18n 口径
// ---------------------------------------------------------------------------
describe('E · 源码与 i18n 键面', () => {
  it('控件挂派单指定钩子；仅实物分支渲染（`itemTypeSel === \'physical\'` 条件）', () => {
    expect(publishSrc).toContain('data-sf-m="item-select-condition"')
    for (const hook of HOOKS) expect(publishSrc).toContain(`item-input-condition-\${option.hook}`)
    const i = publishSrc.indexOf('data-sf-m="item-select-condition"')
    const before = publishSrc.slice(Math.max(0, i - 900), i)
    expect(before).toContain("itemTypeSel === 'physical' ? (")
    // 四值逐字出现在常量表（不硬编中文文案）
    for (const value of CONDITIONS) expect(publishSrc).toContain(`'${value}'`)
  })

  it('线体：`item_condition` 只在有值时进载荷（空串 / null 一律缺省）', () => {
    const apiSrc = fs.readFileSync(path.join(SRC, 'pages/item/item-api.js'), 'utf8')
    expect(apiSrc).toContain('if (itemCondition) body.item_condition = itemCondition')
    expect(apiSrc).toContain('itemCondition = null')
  })

  it('`itemCondition` 四键四语齐备且非空（本单零新增键 ⇒ 复用既有文案）', () => {
    const want = ['brandNewSealed', 'heavyWear', 'likeNew', 'minorWear']
    for (const [lang, table] of Object.entries({ zh, en, hk, vn })) {
      expect(Object.keys(table.itemCondition).sort(), lang).toEqual(want)
      for (const key of want) expect(String(table.itemCondition[key] || '').length, `${lang}.${key}`).toBeGreaterThan(0)
    }
    expect(zh.itemCondition).toEqual({
      brandNewSealed: '全新未拆封', likeNew: '几乎全新',
      minorWear: '细微磕碰划痕', heavyWear: '严重磨损',
    })
  })
})
