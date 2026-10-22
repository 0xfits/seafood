/**
 * 首页【推荐 / 新发】两标签 · 客户端排序 + FLIP 位移动画单测（FEED-SORT-v2 · 2026-10-22）
 * ---------------------------------------------------------------------------
 * 判据：
 *   ① **默认推荐**：读口首屏 = `/api/prize/all?skip=0&limit=36`（**不带 `sort`**），【推荐】激活、
 *      恰两枚标签、零计数芯片、旧四档文案零命中；DOM 顺序 = `feed_score` 降序（**不是**到达序）；
 *   ② **切【新发】零请求**：`fetchApiJson` 调用计数不变（连聚合口 / campaign / 币种都不重拉），
 *      DOM 顺序 = `time_created` 降序；来回切换恒为零请求、顺序各自正确；
 *   ③ **新页 append 后按当前档归位**：切到【新发】再滚下一页 ⇒ 新行插到该在的位置（不是追加到末尾），
 *      且请求只 +1（skip 前推、仍无 `sort`）；
 *   ④ **FLIP**：切档时位移卡带 transition/transform（`data-sf-flip` 钩子在跑）；
 *   ⑤ **降级**：`prefers-reduced-motion: reduce` ⇒ 顺序照换、但**零 transition / 零 transform**；
 *   ⑥ **源码零残留**：旧四标签键 / `data-sf-filter` / `filteredRewards` 不被首页引用（键本身保留）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, waitFor, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

import '../../i18n'
import HomePage from '../../pages/HomePage'
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { useAuth } from '../../auth-context'
import { feedOrderKeys } from '../../home-feed-order'

const PAGE_SIZE = 36

/** 到达序（服务端序）刻意与两档期望序都不同 ⇒ 能分辨「客户端真的排了」 */
const row = (bID, feed_score, time_created) => ({
  bID,
  name: `商品 ${bID}`,
  description: '描述',
  points: 100 + bID,
  stores_count: 2,
  claims_count: 0,
  feed_score,
  time_created,
})

/** 4 行：到达序 [2,4,1,3]；推荐序 [4,3,2,1]；新发序 [3,2,1,4] */
const ROWS_SMALL = [
  row(2, '0.500000', 300),
  row(4, '0.900000', 100),
  row(1, '0.200000', 200),
  row(3, '0.700000', 400),
]
const RECOMMEND_SMALL = ['4', '3', '2', '1']
const NEW_SMALL = ['3', '2', '1', '4']

/** 满页（36 行）：到达序 = 服务端推荐序；bID 37.. 的续页行更新 ⇒ 新发档应插到最前 */
const ROWS_FULL = Array.from({ length: PAGE_SIZE }, (_, i) => row(i + 1, String((PAGE_SIZE - i) / 100), 1000 + i))
const ROWS_NEXT = Array.from({ length: 5 }, (_, i) => row(37 + i, '0.000001', 9000 + i))

/** 可控 IntersectionObserver stub */
class MockIntersectionObserver {
  static instances = []

  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.disconnected = false
    this.node = null
    MockIntersectionObserver.instances.push(this)
  }

  observe(node) { this.node = node }

  disconnect() { this.disconnected = true }

  unobserve() {}

  trigger(isIntersecting = true) { this.callback([{ isIntersecting, target: this.node }], this) }
}

const liveObserver = () => MockIntersectionObserver.instances.filter((o) => !o.disconnected).pop()

const triggerNextPage = async () => {
  await waitFor(() => expect(liveObserver()).toBeTruthy())
  const observer = liveObserver()
  await act(async () => { observer.trigger() })
  return observer
}

const renderHomePage = () => render(
  <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HomePage />
  </MemoryRouter>,
)

const feedCalls = () => fetchApiJson.mock.calls
  .map(([url]) => String(url))
  .filter((u) => u.startsWith('/api/prize/all'))

const allCalls = () => fetchApiJson.mock.calls.length

/** 卡顺序（读标题里的 bID；标题受 truncateByWidth 截断但短标题不受影响） */
const cardOrder = () => [...document.querySelectorAll('[data-sf-m="reward-card-title"]')]
  .map((el) => (el.textContent.match(/\d+/) || [''])[0])

const cardCount = () => document.querySelectorAll('[data-sf-m="reward-card"]').length
const tabsOf = () => [...document.querySelectorAll('[data-sf-m="home-item-filter"] [role="tab"]')]
const tabM = (key) => document.querySelector(`[data-sf-m="feed-tab-${key}"]`)
const activeTab = () => tabsOf()
  .filter((el) => el.getAttribute('aria-selected') === 'true')
  .map((el) => el.getAttribute('data-sf-sort'))

/**
 * @param {{ pages?: Record<number, Array> }} cfg `pages` 以 skip 为键
 */
const wireFetch = ({ pages = {} } = {}) => {
  fetchApiJson.mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith('/api/home?')) {
      return { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 }
    }
    if (u.startsWith('/api/home/campaign-tasks')) return []
    if (u.startsWith('/api/currencies')) return []
    const match = u.match(/^\/api\/prize\/all\?skip=(\d+)&limit=(\d+)$/)
    if (match) return pages[Number(match[1])] ?? []
    if (u.startsWith('/api/prize-item')) return []
    if (u.startsWith('/api/user/asset/')) return { points: 0 }
    throw new Error(`Unexpected URL: ${u}`)
  })
}

/** 每张卡的矩形由「它在 DOM 里的位次」决定 ⇒ 重排后矩形必然变化（FLIP 有位移可算） */
const stubCardRectsByDomIndex = () => {
  const grid = document.querySelector('[data-sf-m="feed-grid"]')
  expect(grid).not.toBeNull()
  for (const node of grid.children) {
    node.getBoundingClientRect = () => {
      const index = [...grid.children].indexOf(node)
      const top = Math.floor(index / 6) * 420
      const left = (index % 6) * 240
      return { top, bottom: top + 392, left, right: left + 224, width: 224, height: 392, x: left, y: top, toJSON() { return this } }
    }
  }
  return grid
}

describe('HomePage · 两标签客户端排序 + FLIP（推荐 / 新发）', () => {
  let originalMatchMedia

  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getAuthHeaders.mockReturnValue({})
    useAuth.mockReturnValue({ user: null, isAuthenticated: false })
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    cleanup()
    window.matchMedia = originalMatchMedia
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('① 默认推荐：读口不带 sort；DOM 顺序 = feed_score 降序（非到达序）；恰两枚标签、零芯片', async () => {
    wireFetch({ pages: { 0: ROWS_SMALL } })
    const { container } = renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(4))

    // 读口：只有 skip / limit，**无 sort**
    expect(feedCalls()).toEqual(['/api/prize/all?skip=0&limit=36'])
    expect(feedCalls().some((u) => u.includes('sort='))).toBe(false)

    // 到达序是 [2,4,1,3]，客户端按推荐档排成 [4,3,2,1]
    expect(cardOrder()).toEqual(RECOMMEND_SMALL)

    const tabs = tabsOf()
    expect(tabs).toHaveLength(2)
    expect(tabs.map((el) => el.getAttribute('data-sf-sort'))).toEqual(['recommend', 'new'])
    expect(activeTab()).toEqual(['recommend'])
    expect(tabM('recommend').textContent).toBe('推荐')
    expect(tabM('new').textContent).toBe('新发')
    for (const tab of tabs) expect(tab.textContent).not.toMatch(/\(\s*\d+\s*\)/)
    expect(container.querySelectorAll('[data-sf-filter]')).toHaveLength(0)
    expect(container.textContent).not.toContain('限量版')
    expect(container.textContent).not.toContain('高价值')
  })

  it('② 切【新发】零请求：fetch 计数不变、DOM 顺序 = time_created 降序；来回切换仍零请求', async () => {
    wireFetch({ pages: { 0: ROWS_SMALL } })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(4))
    expect(cardOrder()).toEqual(RECOMMEND_SMALL)

    const callsBeforeSwitch = allCalls()
    const feedBefore = feedCalls().length

    await act(async () => { tabM('new').click() })

    expect(cardOrder()).toEqual(NEW_SMALL)
    expect(activeTab()).toEqual(['new'])
    // ★ 零网络：任何接口都没有新增调用（不是只有 feed 没发）
    expect(allCalls()).toBe(callsBeforeSwitch)
    expect(feedCalls().length).toBe(feedBefore)

    // 切回推荐：同样零请求、顺序复原
    await act(async () => { tabM('recommend').click() })
    expect(cardOrder()).toEqual(RECOMMEND_SMALL)
    expect(allCalls()).toBe(callsBeforeSwitch)

    // 同档重复点击：无请求、顺序不变
    await act(async () => { tabM('recommend').click() })
    expect(allCalls()).toBe(callsBeforeSwitch)
    expect(cardOrder()).toEqual(RECOMMEND_SMALL)
  })

  it('③ 新页 append 后按当前档归位：切到【新发】再滚下一页 ⇒ 新行插到最前（请求只 +1、无 sort）', async () => {
    wireFetch({ pages: { 0: ROWS_FULL, 36: ROWS_NEXT } })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    await act(async () => { tabM('new').click() })
    // 满页首屏在「新发」档：time_created 1000+i ⇒ bID 36 最新
    expect(cardOrder()[0]).toBe('36')
    const callsBeforeAppend = feedCalls().length

    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE + ROWS_NEXT.length))

    // 续页新行（time 9000+）在同档下必须插到**最前**，而不是追加到末尾
    expect(cardOrder().slice(0, 5)).toEqual(['41', '40', '39', '38', '37'])
    expect(cardOrder().slice(-1)).toEqual(['1'])
    // 全序列 = 纯函数按当前档算出的期望序（到达序 [1..36] + [37..41]）
    expect(cardOrder()).toEqual(feedOrderKeys([...ROWS_FULL, ...ROWS_NEXT], 'new'))
    // 只多了一次续页请求，且仍不带 sort
    expect(feedCalls().length).toBe(callsBeforeAppend + 1)
    expect(feedCalls()[feedCalls().length - 1]).toBe('/api/prize/all?skip=36&limit=36')
  })

  it('④ FLIP：切档给位移卡上 transition/transform，容器挂 data-sf-flip 钩子', async () => {
    wireFetch({ pages: { 0: ROWS_SMALL } })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(4))
    stubCardRectsByDomIndex()

    await act(async () => { tabM('new').click() })

    const grid = document.querySelector('[data-sf-m="feed-grid"]')
    // 顺序先换（FLIP 只负责「看得见的位移」，不改变结果序）
    expect(cardOrder()).toEqual(NEW_SMALL)
    // 位移态：至少一张卡带 translate transform，且容器处于 running
    const moving = [...grid.children].filter((node) => String(node.style.transform || '').includes('translate'))
    expect(moving.length).toBeGreaterThan(0)
    expect(grid.getAttribute('data-sf-flip')).toBe('running')
    // 时长 ≤ 300ms（transition 里出现的 ms 值）
    const durations = [...grid.children]
      .map((node) => String(node.style.transition || '').match(/transform\s+(\d+)ms/))
      .filter(Boolean)
      .map((m) => Number(m[1]))
    for (const duration of durations) expect(duration).toBeLessThanOrEqual(300)
  })

  it('⑤ 降级：prefers-reduced-motion=reduce ⇒ 顺序照换、但零 transition/零 transform', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: String(query).includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    wireFetch({ pages: { 0: ROWS_SMALL } })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(4))
    stubCardRectsByDomIndex()

    const callsBeforeSwitch = allCalls()
    await act(async () => { tabM('new').click() })

    const grid = document.querySelector('[data-sf-m="feed-grid"]')
    expect(cardOrder()).toEqual(NEW_SMALL) // 位置照换（瞬时）
    expect(grid.getAttribute('data-sf-flip')).toBeNull()
    for (const node of grid.children) {
      expect(String(node.style.transition || '')).toBe('')
      expect(String(node.style.transform || '')).toBe('')
      expect(node.getAttribute('data-sf-flip-move')).toBeNull()
    }
    expect(allCalls()).toBe(callsBeforeSwitch)
  })

  it('⑥ 源码零残留：旧四标签键 / data-sf-filter / filteredRewards 不再被首页引用（键本身保留）', () => {
    const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const homeSrc = fs.readFileSync(path.join(SRC, 'pages/HomePage.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    for (const legacy of ['item.filterAll', 'item.filterLimited', 'item.filterHighValue', 'item.filterClaimed']) {
      expect(homeSrc).not.toContain(legacy)
    }
    expect(homeSrc).not.toContain('filteredRewards')
    expect(homeSrc).not.toContain('data-sf-filter')
    // 两枚新标签键仍在（FEED-SORT-v2 起收在纯函数层 `home-feed-order.js`，首页引用 `FEED_SORTS`）
    const orderSrc = fs.readFileSync(path.join(SRC, 'home-feed-order.js'), 'utf8')
    expect(orderSrc).toContain('item.sortRecommend')
    expect(orderSrc).toContain('item.sortNew')
    expect(homeSrc).toContain('FEED_SORTS')
    // 读口 URL 不再拼 `sort=`（切档零请求）
    expect(homeSrc).not.toMatch(/prize\/all\?[^`'"]*sort=/)

    // 键仍留在四语 locale（退役不删键）
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      const locale = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      for (const key of ['filterAll', 'filterLimited', 'filterHighValue', 'filterClaimed', 'sortRecommend', 'sortNew']) {
        expect(typeof locale.item[key]).toBe('string')
      }
    }
  })
})
