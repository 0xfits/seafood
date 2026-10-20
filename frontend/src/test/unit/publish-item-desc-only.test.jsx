/**
 * 发布页「单描述框 · 去标题」前端单测（Kevin 2026-10-20 · route §49.13 / design §26.14）
 * ============================================================================
 * 判据：
 *   ① DOM **零**标题输入框（`item-input-title` 0 命中；判负 design #36 含 `display:none`）；
 *   ② 唯一正文字段 = `<textarea data-sf-m="item-input-note">`，且**必填**（`required` + 提交闸）；
 *   ③ 框**正下方常驻提示**「第一行将作为标题」（`item.descFirstHint` · 非 placeholder；CSS `font-size ≥ 12px`）；
 *   ④ 只填描述（+ 价格 + 库存 + 分类）即可发布 ⇒ 载荷**有 `description`、无 `title` 键**（route §49.13.2
 *      非空 `title` ⇒ 400 `NOT_SUPPORTED`）；多行描述**原样上送**（存储不截，派生在服务端/显示层）；
 *   ⑤ 描述缺省 / 全空白 ⇒ **零网络调用**（`publishListing` 0 次）+ error 态。
 *
 * 替身体例承 `item-type-front.test.jsx`：`item-api` 只桩三个读/写面；`auth` 只桩传输；`t` 返回键名。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

vi.mock('../../pages/item/item-api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchCurrencies: vi.fn(), publishListing: vi.fn(), setListingStatus: vi.fn() }
})

import { useAuth } from '../../auth-context'
import { fetchApiJson } from '../../auth'
import { fetchCurrencies, publishListing, setListingStatus } from '../../pages/item/item-api'
import PublishItemPage from '../../pages/item/PublishItemPage'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pageSrc = fs.readFileSync(path.join(SRC, 'pages/item/PublishItemPage.jsx'), 'utf8')
const itemCss = fs.readFileSync(path.join(SRC, 'pages/item/item.css'), 'utf8')

const renderPage = () => render(
  <MemoryRouter initialEntries={['/item/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <PublishItemPage />
  </MemoryRouter>,
)

const q = (container, key) => container.querySelector(`[data-sf-m="${key}"]`)
const status = (container) => q(container, 'item-status')

/** 只填「发布页描述面」必需项：描述 + 价格 + 分类（数字 + 自动发货）——库存有默认值。 */
const fillDescOnly = (container, value = '第一行标题\n第二行正文') => {
  fireEvent.change(q(container, 'item-input-note'), { target: { value } })
  fireEvent.change(q(container, 'item-input-price'), { target: { value: '7' } })
  fireEvent.click(q(container, 'item-input-type-digital'))
  fireEvent.click(q(container, 'item-input-deliver-auto'))
}

afterEach(() => { cleanup() })

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
  fetchCurrencies.mockResolvedValue([])
  publishListing.mockResolvedValue({})
  setListingStatus.mockResolvedValue({})
})

describe('① DOM：零标题框 · 唯一描述框', () => {
  it('`item-input-title` 0 命中（含隐藏），且全页恰一个 textarea = `item-input-note`', () => {
    const { container } = renderPage()

    expect(container.querySelector('[data-sf-m="item-input-title"]')).toBeNull()
    expect(container.querySelector('input[name="title"]')).toBeNull()
    const areas = container.querySelectorAll('textarea')
    expect(areas.length).toBe(1)
    expect(areas[0].getAttribute('data-sf-m')).toBe('item-input-note')
    // 源码面同口径：不得留 `item-input-title` 钩子（防「DOM 删了、钩子还在」的半截改）
    expect(pageSrc).not.toContain('data-sf-m="item-input-title"')
  })

  it('描述框必填（`required`）+ 有 `aria-describedby` 指向框下提示', () => {
    const { container } = renderPage()
    const note = q(container, 'item-input-note')
    const hint = q(container, 'item-desc-hint')

    expect(note.hasAttribute('required')).toBe(true)
    expect(hint).not.toBeNull()
    expect(note.getAttribute('aria-describedby')).toBe(hint.getAttribute('id'))
  })
})

describe('② 框下常驻提示「第一行将作为标题」', () => {
  it('提示节点在文本框**之后**（同字段容器内）、文案走 i18n 键、不是 placeholder', () => {
    const { container } = renderPage()
    const note = q(container, 'item-input-note')
    const hint = q(container, 'item-desc-hint')

    expect(hint.textContent).toBe('item.descFirstLineHint')
    // 位置：提示是描述字段容器里 textarea 的**后继兄弟**
    expect(hint.previousElementSibling).toBe(note)
    // 不得用 placeholder 顶替（判负 design #39）
    expect(note.getAttribute('placeholder')).toBeNull()
  })

  it('四语键齐备且值非空；zh 逐字 = 契约文案；en/vn 无 CJK', () => {
    const CJK = /[\u3400-\u9fff]/
    const tables = {}
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      expect(typeof tables[lang].item.descFirstLineHint, lang).toBe('string')
      expect(tables[lang].item.descFirstLineHint.trim().length, lang).toBeGreaterThan(0)
    }
    expect(tables.zh.item.descFirstLineHint).toBe('第一行将作为标题')
    expect(CJK.test(tables.en.item.descFirstLineHint)).toBe(false)
    expect(CJK.test(tables.vn.item.descFirstLineHint)).toBe(false)
  })

  it('CSS：`.sf-item-hint` 字号 ≥ 12px（且提示为常驻节点，不随输入显隐）', () => {
    const block = itemCss.slice(itemCss.indexOf('.sf-item-hint'), itemCss.indexOf('.sf-item-btn', itemCss.indexOf('.sf-item-hint')))
    const size = Number((block.match(/font-size:\s*(\d+)px/) || [])[1])
    expect(size).toBeGreaterThanOrEqual(12)
    // 提示不带条件渲染（DOM 里恒在 ⇒ 输入清空后仍在）
    const { container } = renderPage()
    const note = q(container, 'item-input-note')
    fireEvent.change(note, { target: { value: '' } })
    expect(q(container, 'item-desc-hint')).not.toBeNull()
  })
})

describe('③ 载荷：只有 description，没有 title', () => {
  it('只填描述即可发布 ⇒ `publishListing` 载荷无 `title` 键、`description` = 全文（多行不截）', async () => {
    const { container } = renderPage()
    fillDescOnly(container, '第一行标题\n第二行正文\n第三行')

    fireEvent.click(q(container, 'item-primary'))

    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    const payload = publishListing.mock.calls[0][0]
    expect(payload).not.toHaveProperty('title')
    expect(payload.description).toBe('第一行标题\n第二行正文\n第三行')
    expect(payload.price).toBe('7')
    // 创建成功即迁移 listed（无 id 回包 ⇒ 不跳转、停在 ok 态）
    await waitFor(() => expect(status(container).getAttribute('data-sf-phase')).toBe('ok'))
  })

  it('线体（真 `publishListing`）：请求体 JSON 无 `title` 键（防中途又把 title 塞回）', async () => {
    const actual = await vi.importActual('../../pages/item/item-api')
    fetchApiJson.mockClear()
    fetchApiJson.mockResolvedValue({})

    await actual.publishListing({
      cid: 1,
      price: '7',
      stock: '1',
      description: '首行\n正文',
      mediaUrls: [],
      createKey: 'cli:x',
      user: null,
    })

    const body = JSON.parse(fetchApiJson.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('title')
    expect(body.description).toBe('首行\n正文')
    expect(Object.keys(body).sort()).toEqual(['cid', 'create_key', 'description', 'media_urls', 'price', 'stock'])
  })
})

describe('④ 描述必填闸：空白描述 ⇒ 零网络调用', () => {
  it('描述全空白 ⇒ error 态 + `publishListing` / `setListingStatus` 零调用', async () => {
    const { container } = renderPage()
    fillDescOnly(container, '   \n  ')

    fireEvent.click(q(container, 'item-primary'))

    await waitFor(() => expect(status(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(status(container).textContent).toBe('uiError.badRequest')
    expect(publishListing).not.toHaveBeenCalled()
    expect(setListingStatus).not.toHaveBeenCalled()
  })
})
