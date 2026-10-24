/**
 * 商品分类前端单测（迁移 0054 四值闭集 · Kevin 2026-10-20「发布页级联 2+2+2」+ 卡面两枚标签）
 * ============================================================================
 * 判据（design §26.12.8 · route §49.11.1 · data §40.8.1）：
 *   ① 发布页**级联三控件** → **单字段** `item_type` 四值映射：
 *      digital+auto ⇒ `DigitalAutoDeliver` / digital+manual ⇒ `DigitalManualDeliver` /
 *      physical+free ⇒ `PhysicalFreeShip` / physical+buyer ⇒ `PhysicalBuyerShip`；
 *      **绝不发裸 `Digital`**；**不发** `shipping` / `free_ship` 之类第二字段；
 *   ② 分支**互斥渲染**：数字 ⇒ 交付控件在场 / 运费控件不渲染；实物 ⇒ 反之；
 *   ③ 切换一级 ⇒ **两个二级值都清空**（stale 不得进载荷）；
 *   ④ 三个必选闸（一级 / 数字二级 / 实物二级）均**零网络调用**（`publishListing` + `fetchApiJson` 皆 0）；
 *   ⑤ 卡面标签矩阵（四值 + NULL 五行夹具）：黄标数 = 1、绿标数 = 1、总标数 = 2，均 `row1` 首子元素；
 *      `PhysicalFreeShip` ⇒ 黄「包邮」· `DigitalAutoDeliver` ⇒ 绿「自动发货」·
 *      `DigitalManualDeliver` / `PhysicalBuyerShip` / NULL ⇒ 无标签；
 *   ⑥ CSS：两枚标签几何逐条相同、**只差底色**（黄 `var(--sf-btna-bg)` / 绿 `var(--sf-reward-tag-auto-bg)`
 *      = 卡内局部常量 `#4ADE80`）；行高 48 / 卡高 392 不动（真渲染几何读数走
 *      `ops/item-type/delivery/front/` 的浏览器探针，jsdom 无布局 ⇒ 此处只钉**声明**）；
 *   ⑦ i18n 6 键四语齐备 + 计数前推（top 131 / flat 1136 / nodes 4544 / `item` 64）。
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
const publishSrc = fs.readFileSync(path.join(SRC, 'pages/item/PublishItemPage.jsx'), 'utf8')

/** 四值闭集（与后端 `ITEM_TYPES` / 迁移 0054 CHECK 逐字一致）。 */
const ITEM_TYPES = ['DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip']

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
const deliverGroup = (container) => q(container, 'item-select-deliver')
const shipGroup = (container) => q(container, 'item-select-ship')
const statusNode = (container) => q(container, 'item-status')

const fillBasics = (container) => {
  // 单描述框（title 退役）：正文填到唯一文本框 `item-input-note`（首行即派生标题）
  fireEvent.change(q(container, 'item-input-note'), { target: { value: '测试商品' } })
  fireEvent.change(q(container, 'item-input-price'), { target: { value: '7' } })
}

const submit = (container) => fireEvent.click(q(container, 'item-primary'))

const lastPayload = () => publishListing.mock.calls[publishListing.mock.calls.length - 1][0]

// ---------------------------------------------------------------------------
// A · 发布页级联三控件（2 + 2 + 2）· 载荷四值映射
// ---------------------------------------------------------------------------
describe('A · 发布页级联三控件 ⇒ 单字段 item_type（四值）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue(CURRENCIES)
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  it('一级控件在场（digital/physical 两项）；两个二级控件初始**都不渲染**', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    expect(q(container, 'item-input-type-digital')).not.toBeNull()
    expect(q(container, 'item-input-type-physical')).not.toBeNull()
    expect(typeGroup(container).getAttribute('role')).toBe('radiogroup')
    expect(typeGroup(container).getAttribute('aria-required')).toBe('true')
    expect(typeGroup(container).querySelectorAll('input[type="radio"]').length).toBe(2)
    expect([...typeGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)
    // 未选一级 ⇒ 两个分支的二级控件都未渲染（互斥渲染，不是 display:none）
    expect(deliverGroup(container)).toBeNull()
    expect(shipGroup(container)).toBeNull()
  })

  it('① 数字 + 自动 ⇒ `DigitalAutoDeliver`；运费控件**不渲染**、载荷无第二分类字段', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(deliverGroup(container)).not.toBeNull()
    expect(shipGroup(container)).toBeNull() // 数字 ⇒ 运费不适用（不渲染，不是 display:none）
    expect(q(container, 'item-input-deliver-auto')).not.toBeNull()
    expect(q(container, 'item-input-deliver-manual')).not.toBeNull()

    fireEvent.click(q(container, 'item-input-deliver-auto'))
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))

    expect(lastPayload().itemType).toBe('DigitalAutoDeliver')
    expect(lastPayload().itemType).not.toBe('Digital') // ★ 裸值退役，绝不上送
    for (const dead of ['shipping', 'free_ship', 'shipping_free', 'itemTypeShip']) {
      expect(Object.keys(lastPayload())).not.toContain(dead)
    }
  })

  it('② 数字 + 手动 ⇒ `DigitalManualDeliver`', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    fireEvent.click(q(container, 'item-input-deliver-manual'))
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('DigitalManualDeliver')
    expect(shipGroup(container)).toBeNull()
  })

  it('③ 实物 + 包邮 ⇒ `PhysicalFreeShip`；④ 实物 + 不包邮 ⇒ `PhysicalBuyerShip`（交付控件不渲染）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-physical'))
    expect(shipGroup(container)).not.toBeNull()
    expect(deliverGroup(container)).toBeNull() // 实物 ⇒ 交付方式不适用
    expect(q(container, 'item-input-ship-free')).not.toBeNull()
    expect(q(container, 'item-input-ship-buyer')).not.toBeNull()

    fireEvent.click(q(container, 'item-input-ship-free'))
    // ★ 成色四值（迁移 0057）：实物分支必选 ⇒ 否则提交闸先拦
    fireEvent.click(q(container, 'item-input-condition-likeNew'))
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('PhysicalFreeShip')
    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('ok'))

    fireEvent.click(q(container, 'item-input-ship-buyer'))
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(2))
    expect(lastPayload().itemType).toBe('PhysicalBuyerShip')
  })

  it('⑤ 切换一级 ⇒ **两个二级值都清空**（stale 不进载荷；重选后才可提交）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    // 实物 + 包邮 ⇒ 再切数字：运费值必须被清（不是「隐藏但留着」）
    fireEvent.click(q(container, 'item-input-type-physical'))
    fireEvent.click(q(container, 'item-input-ship-free'))
    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(shipGroup(container)).toBeNull()
    expect(deliverGroup(container)).not.toBeNull()
    expect([...deliverGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)

    // 数字二级未选 ⇒ 提交被闸拦住（stale 的「包邮」不会变成任何四值）
    fillBasics(container)
    submit(container)
    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(publishListing).not.toHaveBeenCalled()

    fireEvent.click(q(container, 'item-input-deliver-manual'))
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('DigitalManualDeliver')
  })

  it('数字 + 自动 ⇒ 切实物：交付值被清、运费必须重选（反之亦然）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    fireEvent.click(q(container, 'item-input-deliver-auto'))
    fireEvent.click(q(container, 'item-input-type-physical'))
    expect(deliverGroup(container)).toBeNull()
    expect([...shipGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)

    fillBasics(container)
    submit(container)
    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(publishListing).not.toHaveBeenCalled()

    // 回到数字：交付值同样已被清空（stale 不复活）
    fireEvent.click(q(container, 'item-input-type-digital'))
    expect([...deliverGroup(container).querySelectorAll('input')].every((el) => el.checked === false)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// B · 三个必选闸（阻止提交，零网络调用）
// ---------------------------------------------------------------------------
describe('B · 必选闸：一级未选 / 数字二级未选 / 实物二级未选 ⇒ 阻止提交', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: 7, token: 'test' } })
    fetchCurrencies.mockResolvedValue(CURRENCIES)
    publishListing.mockResolvedValue({})
    setListingStatus.mockResolvedValue({})
  })

  it('一级未选 ⇒ `publishListing` 零调用、状态 = 既有键 `uiError.badRequest`（零新文案键）+ 组高亮', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fillBasics(container)
    submit(container)

    await waitFor(() => expect(statusNode(container).textContent).toBe('uiError.badRequest'))
    expect(publishListing).not.toHaveBeenCalled()
    expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error')
    expect(typeGroup(container).getAttribute('aria-invalid')).toBe('true')
    expect(typeGroup(container).className).toContain('sf-item-choice-miss')
    // 选中任一项 ⇒ 高亮即清
    fireEvent.click(q(container, 'item-input-type-digital'))
    expect(typeGroup(container).className).not.toContain('sf-item-choice-miss')
    expect(publishListing).not.toHaveBeenCalled()
  })

  it('数字二级未选 ⇒ 零调用；补选「自动发货」后可提交（`DigitalAutoDeliver`）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-digital'))
    fillBasics(container)
    submit(container)

    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(publishListing).not.toHaveBeenCalled()
    expect(deliverGroup(container).getAttribute('aria-invalid')).toBe('true')
    expect(deliverGroup(container).className).toContain('sf-item-choice-miss')

    fireEvent.click(q(container, 'item-input-deliver-auto'))
    expect(deliverGroup(container).className).not.toContain('sf-item-choice-miss')
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('DigitalAutoDeliver')
  })

  it('实物二级未选 ⇒ 零调用；补选「不包邮」后可提交（`PhysicalBuyerShip`）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())

    fireEvent.click(q(container, 'item-input-type-physical'))
    fillBasics(container)
    submit(container)

    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(publishListing).not.toHaveBeenCalled()
    expect(shipGroup(container).getAttribute('aria-invalid')).toBe('true')

    fireEvent.click(q(container, 'item-input-ship-buyer'))
    // ★ 成色四值（迁移 0057）：实物分支必选 ⇒ 否则提交闸先拦
    fireEvent.click(q(container, 'item-input-condition-minorWear'))
    submit(container)
    await waitFor(() => expect(publishListing).toHaveBeenCalledTimes(1))
    expect(lastPayload().itemType).toBe('PhysicalBuyerShip')
  })

  it('闸在**最前**：两个分支的二级闸都先于任何网络动作（零 `fetchApiJson`、零 `publishListing`）', async () => {
    const { container } = renderPage()
    await waitFor(() => expect(typeGroup(container)).not.toBeNull())
    fillBasics(container)

    // 一级未选
    fetchApiJson.mockClear()
    submit(container)
    await waitFor(() => expect(statusNode(container).getAttribute('data-sf-phase')).toBe('error'))
    expect(fetchApiJson).not.toHaveBeenCalled()
    expect(publishListing).not.toHaveBeenCalled()

    // 数字二级未选
    fireEvent.click(q(container, 'item-input-type-digital'))
    fetchApiJson.mockClear()
    submit(container)
    await waitFor(() => expect(deliverGroup(container).getAttribute('aria-invalid')).toBe('true'))
    expect(fetchApiJson).not.toHaveBeenCalled()
    expect(publishListing).not.toHaveBeenCalled()

    // 实物二级未选
    fireEvent.click(q(container, 'item-input-type-physical'))
    fetchApiJson.mockClear()
    submit(container)
    await waitFor(() => expect(shipGroup(container).getAttribute('aria-invalid')).toBe('true'))
    expect(fetchApiJson).not.toHaveBeenCalled()
    expect(publishListing).not.toHaveBeenCalled()
  })

  it('源码：四值映射**不出现裸 `Digital`**（`= \'Digital\'` / `: \'Digital\'` 零命中）', () => {
    expect(publishSrc).not.toMatch(/[:=]\s*'Digital'\s*[,\n)]/)
    for (const value of ITEM_TYPES) expect(publishSrc).toContain(`'${value}'`)
  })
})

// ---------------------------------------------------------------------------
// C · 线体（真 `publishListing`）：`item_type` 四值逐字 / 无第二字段 / 未分类缺省
// ---------------------------------------------------------------------------
describe('C · item-api 线体：`item_type` 单一字段（四值）', () => {
  it('四值逐字上送（PascalCase · 不翻译），且**不发**第二分类字段', async () => {
    const actual = await vi.importActual('../../pages/item/item-api')
    fetchApiJson.mockClear()
    fetchApiJson.mockResolvedValue({})

    for (const itemType of ITEM_TYPES) {
      await actual.publishListing({ cid: 1, price: '7', stock: '1', description: 'T', mediaUrls: [], itemType, createKey: 'cli:x', user: null })
    }
    const bodies = fetchApiJson.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(bodies.map((b) => b.item_type)).toEqual(ITEM_TYPES)
    expect(bodies.map((b) => b.item_type)).not.toContain('Digital')
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

    await actual.publishListing({ cid: 1, price: '7', stock: '1', description: 'T', mediaUrls: [], createKey: 'cli:x', user: null })
    await actual.publishListing({ cid: 1, price: '7', stock: '1', description: 'T', mediaUrls: [], itemType: null, createKey: 'cli:x', user: null })
    const bodies = fetchApiJson.mock.calls.map((call) => JSON.parse(call[1].body))
    expect(bodies.every((b) => !('item_type' in b))).toBe(true)
    expect(bodies.some((b) => b.item_type === '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// D · 卡面两枚标签：五行矩阵（黄 1 / 绿 1 / 总 2）+ DOM 位置 + 文案键
// ---------------------------------------------------------------------------
describe('D · 卡面两枚标签（包邮黄 · 自动发货绿）', () => {
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

  const yellowOf = (container) => container.querySelectorAll('[data-sf-m="reward-card-ship-tag"]')
  const greenOf = (container) => container.querySelectorAll('[data-sf-m="reward-card-auto-tag"]')

  it('矩阵（四值 + NULL 五行）：黄标数 = 1、绿标数 = 1、总标数 = 2，其余三态零标签', () => {
    const rows = [
      [901, 'PhysicalFreeShip', 'yellow'],
      [902, 'DigitalAutoDeliver', 'green'],
      [903, 'DigitalManualDeliver', 'none'],
      [904, 'PhysicalBuyerShip', 'none'],
      [905, null, 'none'],
    ]
    const { container } = render(
      <MemoryRouter>
        {rows.map(([id, itemType]) => (
          <RewardCard key={id} reward={baseReward({ bID: id, title: `商品 ${id}`, item_type: itemType })} />
        ))}
      </MemoryRouter>,
    )

    // 全 feed 计数：黄 1 / 绿 1 / 总 2（只验「显示出来了」= 没验条件）
    expect(container.querySelectorAll('.sf-reward-ship-tag').length).toBe(1)
    expect(container.querySelectorAll('.sf-reward-auto-tag').length).toBe(1)
    expect(yellowOf(container).length).toBe(1)
    expect(greenOf(container).length).toBe(1)
    expect(container.querySelectorAll('.sf-reward-ship-tag, .sf-reward-auto-tag').length).toBe(2)

    // 逐行：命中值各得一枚、且是 `row1-wrap-title` 的**首个子元素**（标题文字之前）
    for (const [id, itemType, kind] of rows) {
      const card = container.querySelector(`[data-sf-m="reward-card"][href$="/item/${id}"]`)
        || [...container.querySelectorAll('[data-sf-m="reward-card"]')].find((c) => c.textContent.includes(`商品 ${id}`))
      expect(card, `card ${id}`).toBeTruthy()
      const row = card.querySelector('[data-sf-m="reward-card-title"]')
      const yellow = card.querySelectorAll('.sf-reward-ship-tag')
      const green = card.querySelectorAll('.sf-reward-auto-tag')
      if (kind === 'yellow') {
        expect(yellow.length).toBe(1)
        expect(green.length).toBe(0)
        expect(row.firstElementChild).toBe(yellow[0])
        expect(yellow[0].textContent).toBe('item.freeShipping')
        expect(row.textContent.startsWith('item.freeShipping')).toBe(true)
      } else if (kind === 'green') {
        expect(green.length).toBe(1)
        expect(yellow.length).toBe(0)
        expect(row.firstElementChild).toBe(green[0])
        expect(green[0].textContent).toBe('itemType.autoDeliver')
        expect(row.textContent.startsWith('itemType.autoDeliver')).toBe(true)
      } else {
        expect(yellow.length).toBe(0)
        expect(green.length).toBe(0)
        expect(row.textContent).toBe(`商品 ${id}`)
      }
      // 标签**不得**落进 row2 服务槽（该槽恒空）
      expect(card.querySelector('[data-sf-m="reward-card-service"]').textContent).toBe('')
    }
  })

  it('文案键：黄 = `t(\'item.freeShipping\')`、绿 = `t(\'itemType.autoDeliver\')`（零硬编中文字面）', () => {
    expect(cardSrc).toContain("t('item.freeShipping')")
    expect(cardSrc).toContain("t('itemType.autoDeliver')")
    // 两个分支条件与顺序：黄分支 → 绿分支 → `{titleText}`
    const yellow = cardSrc.indexOf('data-sf-m="reward-card-ship-tag"')
    const green = cardSrc.indexOf('data-sf-m="reward-card-auto-tag"')
    const title = cardSrc.indexOf('{titleText}')
    expect(yellow).toBeGreaterThan(-1)
    expect(green).toBeGreaterThan(yellow)
    expect(title).toBeGreaterThan(green)
    expect(cardSrc.split('data-sf-m="reward-card-ship-tag"').length - 1).toBe(1)
    expect(cardSrc.split('data-sf-m="reward-card-auto-tag"').length - 1).toBe(1)
    expect(cardSrc.split("reward.item_type === 'PhysicalFreeShip'").length - 1).toBe(1)
    expect(cardSrc.split("reward.item_type === 'DigitalAutoDeliver'").length - 1).toBe(1)
    // 退役值不得参与渲染判断
    expect(cardSrc).not.toMatch(/item_type === 'Digital'/)
    expect(cardSrc).not.toMatch(/item_type === 'DigitalManualDeliver'/)
    expect(cardSrc).not.toMatch(/item_type === 'PhysicalBuyerShip'/)
  })

  it('无 `item_type` 的旧夹具（存量 NULL）⇒ 卡片结构与四行完全不变', () => {
    const { container } = renderCard(baseReward())
    const rows = [...container.querySelector('.content').children]
    expect(rows.map((el) => el.className.split(' ')[0]))
      .toEqual(['row1-wrap-title', 'row2-wrap-service', 'row3-wrap-price', 'row4-wrap-seller'])
    expect(yellowOf(container).length).toBe(0)
    expect(greenOf(container).length).toBe(0)
    expect(q(container, 'reward-card-title').textContent).toBe('商品 R')
  })
})

// ---------------------------------------------------------------------------
// E · CSS 口径：两枚标签几何逐条相同、只差底色；零新 token；不破 48·392
// ---------------------------------------------------------------------------
describe('E · reward-card.css 两枚标签（同几何 · 只差底色 · 不破行高 48 / 卡高 392）', () => {
  const block = (sel) => {
    const i = cardCss.indexOf(sel + ' {')
    expect(i, `缺规则 ${sel}`).toBeGreaterThan(-1)
    return cardCss.slice(i, cardCss.indexOf('}', i))
  }
  /** 规则体 ⇒ 声明集（去注释、去空白、按键排序；`color`/`background` 单独比）。 */
  const decls = (body) => body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line.includes(':'))
    .map((line) => line.replace(/\s+/g, ' '))
    .sort()

  const shipBody = block('.sf-reward-card .sf-reward-ship-tag')
  const autoBody = block('.sf-reward-card .sf-reward-auto-tag')
  const COLORISH = /^(background|color):/

  it('几何逐条相同（除 `background` / `color` 外声明集完全一致）', () => {
    const shipGeo = decls(shipBody).filter((d) => !COLORISH.test(d))
    const autoGeo = decls(autoBody).filter((d) => !COLORISH.test(d))
    expect(autoGeo).toEqual(shipGeo)
    // 逐项点明（受冻结口径）
    for (const line of ['display: inline-block', 'font-size: 12px', 'font-weight: 700',
      'line-height: 16px', 'height: 16px', 'border-radius: 2px', 'padding: 0 4px',
      'margin-right: 4px', 'vertical-align: baseline', 'white-space: nowrap']) {
      expect(autoBody.replace(/\s+/g, ' '), line).toContain(line)
    }
  })

  it('底色：黄 = `var(--sf-btna-bg)`（现役不变）· 绿 = `var(--sf-reward-tag-auto-bg)`，字色同为 `var(--sf-btna-fg)`', () => {
    expect(shipBody).toContain('background: var(--sf-btna-bg)')
    expect(shipBody).toContain('color: var(--sf-btna-fg)')
    expect(autoBody).toContain('background: var(--sf-reward-tag-auto-bg)')
    expect(autoBody).toContain('color: var(--sf-btna-fg)')
    // 两枚标签规则内零 hex/rgb 字面（色值只从变量来）
    for (const body of [shipBody, autoBody]) {
      expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(body).not.toMatch(/rgba?\(/)
    }
    // 不得用胶囊 / 按钮圆角
    expect(autoBody).not.toMatch(/border-radius:\s*(9999?px|8px|50%)/)
    // 16px 盒 < 行盒 24px ⇒ 不抬行
    expect(parseFloat((autoBody.match(/height:\s*(\d+)px/) || [])[1])).toBeLessThan(24)
  })

  it('绿色值 = 卡内局部常量 `#4ADE80`（不进主题 token 层）', () => {
    // ★ 先剥注释再切块：规则体内注释含字面 `{n}`（wants 文案），直接找 `}` 会提前截断。
    const bare = cardCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const start = bare.indexOf('.sf-reward-card.sf-reward-card {')
    const rootBlock = bare.slice(start, bare.indexOf('}', start))
    expect(start).toBeGreaterThan(-1)
    expect(rootBlock).toContain('--sf-reward-tag-auto-bg: #4ADE80')
    const themeCss = fs.readFileSync(path.join(SRC, 'theme/theme-tokens.css'), 'utf8')
    const tokensJs = fs.readFileSync(path.join(SRC, 'theme/tokens.js'), 'utf8')
    expect(themeCss).not.toContain('--sf-reward-tag-auto-bg')
    expect(tokensJs).not.toContain('--sf-reward-tag-auto-bg')
    // 黄标两色仍 = 既有 A 系按钮 token（日/夜两档同值 ⇒ 各 ≥2 处声明）
    expect((themeCss.match(/--sf-btna-bg:/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect((themeCss.match(/--sf-btna-fg:/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('行高 48 / 卡高 392 未动（标题行仍 48、卡仍 392、四行仍 48|32|24|48）', () => {
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
})

// ---------------------------------------------------------------------------
// F · i18n 6 键四语 + 计数前推
// ---------------------------------------------------------------------------
describe('F · i18n 6 键四语 + 计数前推（top 130 / flat 1123 / nodes 4492 / item 55）', () => {
  const TABLES = { zh, en, hk, vn }
  const flat = (o) => Object.values(o).reduce((n, v) => n + (v && typeof v === 'object' ? flat(v) : 1), 0)

  it('`itemType` 命名空间恰 6 键、`item.freeShipping` 在场，四语键集逐文件相同', () => {
    const want = ['autoDeliver', 'buyerShip', 'digital', 'freeShip', 'manualDeliver', 'physical']
    for (const lang of Object.keys(TABLES)) {
      expect(Object.keys(TABLES[lang].itemType).sort(), lang).toEqual(want)
      expect(typeof TABLES[lang].item.freeShipping, lang).toBe('string')
      expect(TABLES[lang].item.freeShipping.length, lang).toBeGreaterThan(0)
      expect(TABLES[lang].itemType.autoDeliver.length, lang).toBeGreaterThan(0)
      expect(TABLES[lang].itemType.manualDeliver.length, lang).toBeGreaterThan(0)
    }
  })

  it('zh 值逐字 = 契约表；en/vn 无 CJK；hk 与 zh 同为繁体口径', () => {
    expect(zh.itemType).toEqual({
      digital: '数字商品', physical: '实物商品',
      autoDeliver: '自动发货', manualDeliver: '手动发货',
      freeShip: '包邮', buyerShip: '不包邮',
    })
    expect(zh.item.freeShipping).toBe('包邮')
    expect(hk.itemType.freeShip).toBe('包郵')
    expect(hk.itemType.autoDeliver).toBe('自動發貨')
    expect(hk.itemType.manualDeliver).toBe('手動發貨')
    const CJK = /[\u3400-\u9fff]/
    for (const lang of ['en', 'vn']) {
      for (const key of ['autoDeliver', 'manualDeliver', 'buyerShip', 'freeShip']) {
        expect(CJK.test(TABLES[lang].itemType[key]), `${lang}.${key}`).toBe(false)
      }
      expect(CJK.test(TABLES[lang].item.freeShipping), `${lang}.item.freeShipping`).toBe(false)
    }
  })

  it('计数：top 130 / flat 1123 / 四语节点 4492 / `item` 55（四语逐文件相等）', () => {
    for (const [lang, table] of Object.entries(TABLES)) {
      expect(Object.keys(table).length, `${lang} top`).toBe(135) // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
      expect(flat(table), `${lang} flat`).toBe(1451) // [home-hero-removal（2026-10-24）：删 5 个死键（homePage.welcome/heroLead/heroTail/continueTask/registerNow，四语对称）⇒ flat 1456⇒1451 / 四语节点 5824⇒5804（top 135 不变）] [i18n-bump project-wage-slider（2026-10-24）：+2 `project.*` 键（wageRateAnchor/wageLegacyRate，四语对称）⇒ flat 1454⇒1456 / 四语节点 5816⇒5824（top 135 不变 / project 140⇒142）] // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] // [i18n-bump exchange-route（2026-10-23 · /exchange 路径参数 + 持币人 + 选择页）：+7 `market.*` 键（holdersTitle/holdersTotal/holdersEmpty/holdersFail/pickNote/pickTitle/pickCta，四语对称）⇒ flat 1427⇒1434 / 四语节点 5708⇒5788 / market 34⇒41（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）] [i18n-bump project-wage-std（2026-10-23）：+7 `project.*` 键（entryWageStd / wageStdTitle / wageStdHint / newSlotsLabel / newSlotsHint / slotsReadout / wageStdSaved，四语对称）⇒ flat 1447⇒1454 / 四语节点 5788⇒5816 / project 133⇒140（top 135 不变）]
      expect(Object.keys(table.item).length, `${lang} item`).toBe(70) // [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68]
    }
    expect(Object.keys(zh).length * 4).toBe(540) // [i18n-bump item-detail top 130⇒131 ×4 = 524] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
    expect(flat(zh) * 4).toBe(5804) // [home-hero-removal（2026-10-24）：删 5 个死键（homePage.welcome/heroLead/heroTail/continueTask/registerNow，四语对称）⇒ flat 1456⇒1451 / 四语节点 5824⇒5804（top 135 不变）] [i18n-bump project-wage-slider（2026-10-24）：+2 `project.*` 键（wageRateAnchor/wageLegacyRate，四语对称）⇒ flat 1454⇒1456 / 四语节点 5816⇒5824（top 135 不变 / project 140⇒142）] // [i18n-bump project-avatar（2026-10-22）：+5 `project.*` 键（avatarChange/avatarReset/avatarResetConfirm/avatarTooLarge/avatarUploadFail，四语对称）⇒ flat 1388⇒1393 / 四语节点 5552⇒5572 / project 102⇒107（top 135 不变）] [i18n-bump title-merge +1 键 item.descFirstLineHint ⇒ flat 1122⇒1123 / nodes 4488⇒4492 / item 54⇒55] // [i18n-bump edit-page +3 键 item.editTitle/editOk/draftStockLocked ⇒ flat 1123⇒1126 / nodes 4492⇒4504 / item 55⇒58] // [i18n-bump list-actions +3 键 item.lowerPrice/newPrice/lowerPriceInvalid ⇒ flat 1126⇒1129 / nodes 4504⇒4516 / item 58⇒61] // [i18n-bump item-detail +7 键 item.message/platformSettled/views + itemCondition×4 ⇒ top 130⇒131 / flat 1129⇒1136 / nodes 4516⇒4544 / item 61⇒64] // [i18n-bump multi-buy +3 键 item.multiBuyLabel/buyQtyTitle/buyQtyHint ⇒ flat 1137⇒1140 / nodes 4548⇒4560 / item 65⇒68] // [i18n-bump wage：新增顶层 `wage`(29 键，四语对称) ⇒ top 131⇒132 / flat 1140⇒1169 / 四语节点 4560⇒4676 / top×4 524⇒528] // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变] // [i18n-bump subtask-manage（2026-10-22 · 子任务行内编辑/删除）：+9 `project.*` 键（子任务编辑/删除/锁/有凭证/失败，四语对称）⇒ top 135 不变 / flat 1369⇒1378 / 四语节点 5476⇒5512 / project 85⇒94] [i18n-bump exchange-trend（2026-10-22 · /exchange 价格走势 + 撤全计数）：+5 `market.*` 键（priceTrend / trendRange / cancelAllOkCount / cancelAllNone / cancelPartial，四语对称）⇒ flat 1394⇒1399 / 四语节点 5576⇒5596 / market 29⇒34（top 135 不变）] [i18n-bump project-recruit（2026-10-22③ · 项目页拆出【招工】模态框）：+3 `project.*` 键（entryRecruit / recruitTitle / recruitSaved，四语对称）⇒ flat 1399⇒1415 / 四语节点 5596⇒5660 / project 107⇒110（top 135 不变）] [i18n-bump project-vault（2026-10-23）：+12 `project.*` 键（vaultTitle/vaultLine/vaultRechargeLabel/vaultRechargeBtn/vaultRecharging/vaultRechargeOk/vaultFailDetail/vaultErrInsufficient/vaultErrAmountInvalid/vaultErrCidInvalid/vaultErrGeneral/recruitZeroHint，四语对称）⇒ flat 1415⇒1427 / 四语节点 5660⇒5708 / project 121⇒133（top 135 不变；vn 待复核）] // [i18n-bump exchange-route（2026-10-23 · /exchange 路径参数 + 持币人 + 选择页）：+7 `market.*` 键（holdersTitle/holdersTotal/holdersEmpty/holdersFail/pickNote/pickTitle/pickCta，四语对称）⇒ flat 1427⇒1447 / 四语节点 5708⇒5736 / market 34⇒41（top 135 不变；vn 待复核）] [i18n-bump campaign-claim（2026-10-23）：+13 `campaign.*` 键（submit.battCost/battInsufficient/rewardPending + claim.{cta,claiming,all,allCost,pending,ok,allOk,battInsufficient,nothingToClaim,failed}，四语对称）⇒ flat 1434⇒1447 / 四语节点 5736⇒5788（top 135 不变 / campaign 74⇒87）] [i18n-bump project-wage-std（2026-10-23）：+7 `project.*` 键（entryWageStd / wageStdTitle / wageStdHint / newSlotsLabel / newSlotsHint / slotsReadout / wageStdSaved，四语对称）⇒ flat 1447⇒1454 / 四语节点 5788⇒5816 / project 133⇒140（top 135 不变）]
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
