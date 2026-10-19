/**
 * 商品分类前端单测（Kevin 2026-10-20「2 + 2 两控件」+ 卡片「包邮」贴纸）
 * ============================================================================
 * 判据（design §26.12.4/.5 判负 #15–#19 · route §49.11 ②）：
 *   ① 发布页两控件 → **单字段** `item_type` 三值映射：digital ⇒ `Digital` /
 *      physical+free ⇒ `PhysicalFreeShip` / physical+buyer ⇒ `PhysicalBuyerShip`；
 *      **不发** `shipping` / `free_ship` 之类第二字段；
 *   ② 分类 = 数字 ⇒ 运费控件**不渲染**（不是 display:none）且不进载荷（含 stale 值）；
 *   ③ 分类未选 / 实物未选运费 ⇒ **阻止提交**（零 `publishListing` 调用、零 `''` 上送）；
 *   ④ 卡片贴纸：**仅** `PhysicalFreeShip` 渲染，且必须是 `row1-wrap-title` 内
 *      **标题文字之前**的第一个 inline 节点（DOM 顺序可判）；
 *   ⑤ 色值只取 `var(--sf-btna-bg)` / `var(--sf-btna-fg)`（零新 token / 零新色值），
 *      盒 16px < 行盒 24px ⇒ row1 仍 `flex: 0 0 48px` / 卡高仍 392（几何读数走真浏览器探针
 *      `ops/item-type/front/`，jsdom 无布局 ⇒ 此处只钉**声明**）；
 *   ⑥ i18n 5 键四语齐备 + 计数前推（top 130 / flat 1120 / nodes 4480 / `item` 54）。
 *
 * 替身设计（承 `publish-item-cid-select.test.jsx` 体例）：
 *   · `item-api` = `importOriginal + 只桩三个面`（`fetchCurrencies` / `publishListing` /
 *     `setListingStatus`）⇒ 线体断言走 `vi.importActual` 的**真** `publishListing`；
 *   · `../../auth` 只桩 `fetchApiJson` / `getAuthHeaders`（真映射、假传输）；
 *   · `t` 返回**键名本身** ⇒ 「文案走 i18n 键、零硬编中文字面」顺带被钉住。
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
import { RewardCard } from '../../components/reward/RewardCard'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cardSrc = fs.readFileSync(path.join(SRC, 'components/reward/RewardCard.jsx'), 'utf8')
const cardCss = fs.readFileSync(path.join(SRC, 'components/reward/reward-card.css'), 'utf8')
const homeSrc = fs.readFileSync(path.join(SRC, 'pages/HomePage.jsx'), 'utf8')

// 夹具行键集与后端冻结口径一致：**恰三键** cid / symbol / name
const CURRENCIES = [{ cid: 1, symbol: '$', name: '社区积分' }]

afterEach(() => { cleanup() })

const renderPage = () => render(
  <MemoryRouter initialEntries={['/item/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <PublishItemPage />
  </MemoryRouter>,
)

const q = (container, key) => container.querySelector(`[data-sf-m="${key}"]`)
const typeGroup = (container) => q(container, 'item-select-type')
const shipGroup = (container) => q(container, 'item-select-ship')
const statusNode = (container) => q(container, 'item-status')

const fillBasics = (container) => {
  fireEvent.change(q(container, 'item-input-title'), { target: { value: '测试商品' } })
  fireEvent.change(q(container, 'item-input-price'), { target: { value: '7' } })
}

const submit = (container) => fireEvent.click(q(container, 'item-primary'))

const lastPayload = () => publishListing.mock.calls[publishListing.mock.calls.length - 1][0]

// ---------------------------------------------------------------------------
// A · 发布页两控件（2 + 2）· 载荷三值映射
// ---------------------------------------------------------------------------
describe('A · 发布页两控件 ⇒ 单字段 item_type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue(CURRENCIES)
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  it('两控件在场：分类组 = `item-select-type` 两项（digital/physical），运费组初始**不渲染**', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    expect(q(container, 'item-input-type-digital')).not.toBeNull()
    expect(q(container, 'item-input-type-physical')).not.toBeNull()
    expect(typeGroup(container).getAttribute('role')).toBe('radiogroup')
    expect(typeGroup(container).getAttribute('aria-required')).toBe('true')
    expect(typeGroup(container).querySelectorAll('input[type="radio"]').length).toBe(2)
    // 初始 = 未选 ⇒ 两 radio 都未选中；运费组尚未渲染
    expect([...typeGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)
    expect(shipGroup(container)).toBeNull()
  })

  it('① 数字商品 ⇒ 载荷 `itemType = Digital`，运费控件**不渲染**、载荷无第二分类字段', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(shipGroup(container)).toBeNull() // 数字 ⇒ 运费不适用（不渲染，不是 display:none）

    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))

    expect(lastPayload().itemType).toBe('Digital')
    for (const dead of ['shipping', 'free_ship', 'shipping_free', 'itemTypeShip']) {
      expect(Object.keys(lastPayload())).not.toContain(dead)
    }
  })

  it('② 实物 + 包邮 ⇒ `PhysicalFreeShip`；③ 实物 + 不包邮 ⇒ `PhysicalBuyerShip`', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    // 实物 ⇒ 运费控件出现（2 项，必选未选）
    fireEvent.click(q(container, 'item-input-type-physical'))
    expect(shipGroup(container)).not.toBeNull()
    expect(q(container, 'item-input-ship-free')).not.toBeNull()
    expect(q(container, 'item-input-ship-buyer')).not.toBeNull()

    fireEvent.click(q(container, 'item-input-ship-free'))
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('PhysicalFreeShip')
    // 等首提回到终态（ok）再改选运费 —— 加载态期间提交被闸挡（同一次操作不重入）
    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('ok'))

    fireEvent.click(q(container, 'item-input-ship-buyer'))
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(2))
    expect(lastPayload().itemType).toBe('PhysicalBuyerShip')
  })

  it('④ 先实物+包邮、再改数字 ⇒ 运费控件消失且载荷回落 `Digital`（stale 值不进载荷）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-physical'))
    fireEvent.click(q(container, 'item-input-ship-free'))
    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(shipGroup(container)).toBeNull()

    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('Digital')
  })
})

// ---------------------------------------------------------------------------
// B · 必选闸（阻止提交，零网络调用）
// ---------------------------------------------------------------------------
describe('B · 必选闸：未选分类 / 实物未选运费 ⇒ 阻止提交', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue(CURRENCIES)
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  it('分类未选 ⇒ `publishListing` 零调用、状态 = 既有键 `uiError.badRequest`（零新文案键）+ 组高亮', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fillBasics(container)
    submit(container)

    await waitFor(() => expect(statusNode(container).textContent).toBe('uiError.badRequest'))
    expect(publishListing).not.toHaveBeenCalled()
    expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error')
    // 提示形态：组 aria-invalid + 高亮类（不新增文案键）
    expect(typeGroup(container).getAttribute('aria-invalid')).toBe('true')
    expect(typeGroup(container).className).toContain('sf-item-choice-miss')
    // 选中任一项 ⇒ 高亮即清
    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(typeGroup(container).className).not.toContain('sf-item-choice-miss')
    expect(publishListing).not.toHaveBeenCalled()
  })

  it('实物未选运费 ⇒ 仍零调用；补选运费后即可提交（`PhysicalBuyerShip`）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-physical'))
    fillBasics(container)
    submit(container)

    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(publishListing).not.toHaveBeenCalled()
    expect(shipGroup(container).getAttribute('aria-invalid')).toBe('true')

    fireEvent.click(q(container, 'item-input-ship-buyer'))
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('PhysicalBuyerShip')
  })

  it('闸在**最前**：未选分类时连图片上传都不发（零 `fetchApiJson`、零 `publishListing`）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())
    fetchApiJson.mockClear()
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(fetchApiJson).not.toHaveBeenCalled()
    expect(publishListing).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// C · 线体（真 `publishListing`）：`item_type` 逐字三值 / 无第二字段 / 未分类缺省
// ---------------------------------------------------------------------------
describe('C · item-api 线体：`item_type` 单一字段', () => {
  it('三值逐字上送（PascalCase · 不翻译），且**不发**第二分类字段', async () => {
    const actual = await vi.importActual('../../pages/item/item-api')
    fetchApiJson.mockClear()
    fetchApiJson.mockResolvedValue({})

    for (const itemType of ['Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip']) {
      await actual.publishListing({ cid: 1, price: '7', stock: '1', title: 'T', description: '', mediaUrls: [], itemType, createKey: 'cli:x', user: null })
    }
    const bodies = fetchApiJson.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(bodies.map((b) => b.item_type)).toEqual(['Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip'])
    for (const body of bodies) {
      expect(body).not.toHaveProperty('shipping')
      expect(body).not.toHaveProperty('free_ship')
      expect(Object.keys(body).filter((k) => /ship|item_type/.test(k))).toEqual(['item_type'])
    }
  })

  it('未分类（不传 / null）⇒ 字段**缺省**（服务端落 NULL），且从不发 `\'\'`', async () => {
    const actual = await vi.importActual('../../pages/item/item-api')
    fetchApiJson.mockClear()
    fetchApiJson.mockResolvedValue({})

    await actual.publishListing({ cid: 1, price: '7', stock: '1', title: 'T', description: '', mediaUrls: [], createKey: 'cli:x', user: null })
    await actual.publishListing({ cid: 1, price: '7', stock: '1', title: 'T', description: '', mediaUrls: [], itemType: null, createKey: 'cli:x', user: null })
    const bodies = fetchApiJson.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(bodies.every((b) => !('item_type' in b))).toBe(true)
    expect(bodies.some((b) => b.item_type === '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D · 卡片「包邮」贴纸：显示矩阵 + DOM 位置 + 文案键
// ---------------------------------------------------------------------------
describe('D · 卡片贴纸（reward-card-ship-tag）', () => {
  const baseReward = (over = {}) => ({
    bID: 1,
    title: '商品 R',
    image: '/media/x.png',
    points_required: 495,
    wants: 3,
    seller: { uid: 7, nickname: '0x12**12', avatar: null, credit: 'new' },
    ...over,
  })

  const renderCard = (reward) => render(
    <MemoryRouter><RewardCard reward={reward} /></MemoryRouter>,
  )

  const tagOf = (container) => container.querySelector('[data-sf-m="reward-card-ship-tag"]')

  it('显示矩阵：**仅** `PhysicalFreeShip` 渲染贴纸（其余三态零节点 · #15）', () => {
    const free = renderCard(baseReward({ item_type: 'PhysicalFreeShip' }))
    expect(tagOf(free.container)).not.toBeNull()
    free.unmount()

    for (const value of ['Digital', 'PhysicalBuyerShip', null, undefined, 'Bogus']) {
      const r = renderCard(baseReward({ item_type: value }))
      expect(tagOf(r.container), `item_type=${String(value)} 不得出标签`).toBeNull()
      r.unmount()
    }
  })

  it('位置：`row1-wrap-title` 内**标题文字之前**的第一个节点（#18），文案走 `t(\'item.freeShipping\')`', () => {
    const { container } = renderCard(baseReward({ item_type: 'PhysicalFreeShip' }))
    const row = q(container, 'reward-card-title')
    expect(row.className).toContain('row1-wrap-title')

    const tag = tagOf(container)
    expect(tag.parentElement).toBe(row)
    expect(row.firstElementChild).toBe(tag)        // 行首第一个**元素**节点
    expect(row.textContent.startsWith('item.freeShipping')).toBe(true) // 文本之前
    expect(row.textContent).toBe('item.freeShipping商品 R')            // 顺序 = 标签 → 标题
    expect(row.innerHTML.indexOf('sf-reward-ship-tag')).toBeLessThan(row.innerHTML.indexOf('商品 R'))
    expect(tag.textContent).toBe('item.freeShipping')
    // 标签不得落进 row2 服务槽（§26.11.1 的 row2 仍空）
    expect(q(container, 'reward-card-service').textContent).toBe('')
  })

  it('无 `item_type` 的旧夹具（存量 NULL）⇒ 卡片结构与四行完全不变', () => {
    const { container } = renderCard(baseReward())
    const rows = [...container.querySelector('.content').children]
    expect(rows.map((el) => el.className.split(' ')[0]))
      .toEqual(['row1-wrap-title', 'row2-wrap-service', 'row3-wrap-price', 'row4-wrap-seller'])
    expect(tagOf(container)).toBeNull()
    expect(q(container, 'reward-card-title').textContent).toBe('商品 R')
  })

  it('源码：标签只在 `item_type === \'PhysicalFreeShip\'` 分支内、且位于 `{titleText}` 之前', () => {
    const cond = cardSrc.indexOf("reward.item_type === 'PhysicalFreeShip'")
    const tagIdx = cardSrc.indexOf('data-sf-m="reward-card-ship-tag"')
    const titleIdx = cardSrc.indexOf('{titleText}')
    expect(cond).toBeGreaterThan(-1)
    expect(tagIdx).toBeGreaterThan(cond)
    expect(titleIdx).toBeGreaterThan(tagIdx)
    expect(cardSrc.split('data-sf-m="reward-card-ship-tag"').length - 1).toBe(1)
    // 文案键（零硬编中文字面）
    expect(cardSrc).toContain("t('item.freeShipping')")
  })
})

// ---------------------------------------------------------------------------
// E · CSS 口径：零新 token / 零新色值 / 不破 48·392
// ---------------------------------------------------------------------------
describe('E · reward-card.css 贴纸口径（零新 token · 不破行高 48 / 卡高 392）', () => {
  const block = (sel) => {
    const i = cardCss.indexOf(sel + ' {')
    expect(i, `缺规则 ${sel}`).toBeGreaterThan(-1)
    return cardCss.slice(i, cardCss.indexOf('}', i))
  }

  it('色值只取 `var(--sf-btna-bg)` / `var(--sf-btna-fg)`；规则内零 hex/rgb 字面（#17）', () => {
    const tag = block('.sf-reward-card .sf-reward-ship-tag')
    expect(tag).toContain('background: var(--sf-btna-bg)')
    expect(tag).toContain('color: var(--sf-btna-fg)')
    expect(tag).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(tag).not.toMatch(/rgba?\(/)
    expect(tag).not.toContain('--sf-it-') // 不得另立局部颜色别名
  })

  it('几何：12px / 700 · 16px 盒 · line-height 16 · padding 0 4px · 圆角 2px · 间距 4px · nowrap', () => {
    const tag = block('.sf-reward-card .sf-reward-ship-tag')
    expect(tag).toContain('font-size: 12px')
    expect(tag).toContain('font-weight: 700')
    expect(tag).toContain('line-height: 16px')
    expect(tag).toContain('height: 16px')
    expect(tag).toContain('padding: 0 4px')
    expect(tag).toContain('border-radius: 2px')
    expect(tag).toContain('margin-right: 4px')
    expect(tag).toContain('display: inline-block')
    expect(tag).toContain('white-space: nowrap')
    // 不得用胶囊 / 按钮圆角（会把「贴纸」改成「按钮」）
    expect(tag).not.toMatch(/border-radius:\s*(9999?px|8px|50%)/)
    // 16px 盒 < 行盒 24px ⇒ 不抬行
    expect(parseFloat((tag.match(/height:\s*(\d+)px/) || [])[1])).toBeLessThan(24)
  })

  it('行高 48 / 卡高 392 的声明未被动过（标题行仍 48、卡仍 392、四行仍 48|32|24|48）', () => {
    expect(block('.sf-reward-card .sf-reward-inner')).toContain('height: 392px')
    const row1 = block('.sf-reward-card .row1-wrap-title')
    expect(row1).toContain('flex: 0 0 48px')
    expect(row1).toContain('height: 48px')
    expect(row1).toContain('line-height: 24px')
    for (const [sel, size] of [
      ['.sf-reward-card .row1-wrap-title', '48px'],
      ['.sf-reward-card .row2-wrap-service', '32px'],
      ['.sf-reward-card .row3-wrap-price', '24px'],
      ['.sf-reward-card .row4-wrap-seller', '48px'],
    ]) {
      expect(block(sel)).toContain(`flex: 0 0 ${size}`)
    }
  })

  it('主题 token 层未新增颜色项（`TOKEN_KEYS` / `theme-tokens.css` 零改动面）', () => {
    const themeCss = fs.readFileSync(path.join(SRC, 'theme/theme-tokens.css'), 'utf8')
    expect(themeCss).not.toContain('--sf-it-')
    // 贴纸两色 = 既有 A 系按钮 token（日/夜两档同值，故两处都在）
    expect((themeCss.match(/--sf-btna-bg:/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((themeCss.match(/--sf-btna-fg:/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// F · i18n 5 键四语 + 计数前推
// ---------------------------------------------------------------------------
describe('F · i18n 5 键四语 + 计数前推（top 130 / flat 1120 / nodes 4480 / item 54）', () => {
  const TABLES = { zh, en, hk, vn }
  const flat = (o) => Object.values(o).reduce((n, v) => n + (v && typeof v === 'object' ? flat(v) : 1), 0)

  it('`itemType` 命名空间恰 4 键、`item.freeShipping` 在场，四语键集逐文件相同', () => {
    const want = ['buyerShip', 'digital', 'freeShip', 'physical']
    for (const lang of Object.keys(TABLES)) {
      expect(Object.keys(TABLES[lang].itemType).sort(), lang).toEqual(want)
      expect(typeof TABLES[lang].item.freeShipping, lang).toBe('string')
      expect(TABLES[lang].item.freeShipping.length, lang).toBeGreaterThan(0)
    }
  })

  it('zh 值逐字 = 契约表；en/vn 无 CJK；hk 与 zh 同为繁体口径', () => {
    expect(zh.itemType).toEqual({ digital: '数字商品', physical: '实物商品', freeShip: '包邮', buyerShip: '不包邮' })
    expect(zh.item.freeShipping).toBe('包邮')
    expect(hk.itemType.freeShip).toBe('包郵')
    const CJK = /[\u3400-\u9fff]/
    expect(CJK.test(en.item.freeShipping)).toBe(false)
    expect(CJK.test(vn.item.freeShipping)).toBe(false)
    expect(CJK.test(en.itemType.buyerShip)).toBe(false)
    expect(CJK.test(vn.itemType.buyerShip)).toBe(false)
  })

  it('计数：top 130 / flat 1120 / 四语节点 4480 / `item` 54（四语逐文件相等）', () => {
    for (const [lang, table] of Object.entries(TABLES)) {
      expect(Object.keys(table).length, `${lang} top`).toBe(130)
      expect(flat(table), `${lang} flat`).toBe(1120)
      expect(Object.keys(table.item).length, `${lang} item`).toBe(54)
    }
    expect(Object.keys(zh).length * 4).toBe(520)
    expect(flat(zh) * 4).toBe(4480)
  })
})

// ---------------------------------------------------------------------------
// G · 首页透传：`mapRewardsForHome` 不丢 `item_type`
// ---------------------------------------------------------------------------
describe('G · HomePage 透传 item_type', () => {
  it('`mapRewardsForHome` 显式透传 `item_type`（读口 → 卡片，防丢字段）', () => {
    const i = homeSrc.indexOf('const mapRewardsForHome')
    expect(i).toBeGreaterThan(-1)
    const body = homeSrc.slice(i, homeSrc.indexOf('useEffect(', i))
    expect(body).toContain('item_type: prize.item_type ?? null')
    expect(body).toContain('...prize')
  })
})
