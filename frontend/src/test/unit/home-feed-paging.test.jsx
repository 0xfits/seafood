/**
 * FEED-PAGING-v2 单测（2026-10-22 · Kevin 改口：排序回到前端）
 *   口径：首页商品 = `GET /api/prize/all?skip=<n>&limit=36`（**不带 `sort`** —— 读口只取下一页）
 *     ① 首屏 36 条，且**不再用 `/api/home` 的 `prizes`**（聚合口只供 tasks / points / claimed ids）；
 *     ② 滚到底（sentinel 进视口）⇒ skip 36 → 72 …，< 36 即终止；
 *     ③ 按 bID 去重；
 *     ④ 卸载后不再发请求；
 *     ⑤ 某页失败 ⇒ 停（不自动重试）+ 「重试」按钮复用同一 skip；
 *     ⑥ **上限 108 件**（18 行 × 6 列）：首页不分页，滚到第 3 页满页即止，不再发第 4 页。
 *   `IntersectionObserver` 在 jsdom 里不存在 ⇒ 本文件用可控 stub 触发（组件侧有存在性守卫）。
 */
import React from 'react'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
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

const PAGE_SIZE = 36
/** 首页上限：18 行 × 6 列 */
const MAX_ITEMS = 108

const prizeRow = (bID) => ({
  bID,
  name: `商品 ${bID}`,
  description: '描述',
  points: 100 + bID,
  stores_count: 2,
  claims_count: 0,
})

const page = (start, count) => Array.from({ length: count }, (_, i) => prizeRow(start + i))

/** 可控 IntersectionObserver stub：记录实例，测试里手动让 sentinel「进视口」 */
class MockIntersectionObserver {
  static instances = []

  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.disconnected = false
    this.node = null
    MockIntersectionObserver.instances.push(this)
  }

  observe(node) {
    this.node = node
  }

  disconnect() {
    this.disconnected = true
  }

  unobserve() {}

  trigger(isIntersecting = true) {
    this.callback([{ isIntersecting, target: this.node }], this)
  }
}

const liveObserver = () => MockIntersectionObserver.instances.filter((o) => !o.disconnected).pop()

/** 触发「滚到底」：先等观察器挂上（passive effect 在 commit 之后才跑），再让 sentinel 进视口 */
const triggerNextPage = async () => {
  await waitFor(() => expect(liveObserver()).toBeTruthy())
  const observer = liveObserver()
  await act(async () => { observer.trigger() })
  return observer
}

const flushEffects = async () => { await act(async () => {}) }

const feedCalls = () => fetchApiJson.mock.calls
  .map(([url]) => String(url))
  .filter((u) => u.startsWith('/api/prize/all'))

const cardCount = () => document.querySelectorAll('[data-sf-m="reward-card"]').length

const renderHomePage = () => render(
  <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HomePage />
  </MemoryRouter>,
)

/**
 * @param {{ pages: Record<number, Array>, homePrizes?: Array }} cfg  `pages` 以 skip 为键
 */
const wireFetch = ({ pages, homePrizes = [{ bID: 9001, name: '聚合口商品', points: 1 }], failOnceAt = null }) => {
  let pendingFailure = failOnceAt  // 只失败一次（重试臂需要第二次成功）
  fetchApiJson.mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith('/api/home?')) {
      return {
        // ★ HOME-CAMP-v1 起聚合口的 `tasks` 不再被首页消费（版块改走 campaign 读口）
        tasks: [{ tID: 1, title: '任务 A', note: '描述', points: 10, is_open: true }],
        // ★ 故意塞一条「聚合口商品」：本单口径下首页不得渲染它
        prizes: homePrizes,
        claimed_prize_ids: [],
        user_points: 0,
      }
    }
    if (u.startsWith('/api/home/campaign-tasks')) return []
    if (u.startsWith('/api/currencies')) return []
    // ★ 读口 URL **只有 skip / limit**（无 `sort`）
    const match = u.match(/^\/api\/prize\/all\?skip=(\d+)&limit=(\d+)$/)
    if (match) {
      const skip = Number(match[1])
      if (pendingFailure === skip) {
        pendingFailure = null
        throw new Error(`feed ${skip} failed`)
      }
      return pages[skip] ?? []
    }
    if (u.startsWith('/api/prize-item')) return []
    if (u.startsWith('/api/user/asset/')) return { points: 0 }
    throw new Error(`Unexpected URL: ${u}`)
  })
}

describe('HomePage · 商品分页（FEED-PAGING-v2）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getAuthHeaders.mockReturnValue({})
    useAuth.mockReturnValue({ user: null, isAuthenticated: false })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('首屏 36 条走 /api/prize/all?skip=0&limit=36（无 sort），且不再使用 /api/home 的 prizes', async () => {
    wireFetch({ pages: { 0: page(1, PAGE_SIZE) } })
    renderHomePage()

    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    expect(feedCalls()).toEqual([`/api/prize/all?skip=0&limit=36`])
    // ★ 读口不再下发排序档：URL 里既无 sort=recommend 也无 sort=new
    expect(feedCalls().some((u) => u.includes('sort='))).toBe(false)
    // 聚合口的 `prizes` 字段不再被消费
    expect(screen.queryByText('聚合口商品')).toBeNull()
    // ★ HOME-CAMP-v1：聚合口的 `tasks` 字段同样不再被消费（任务版块改走 campaign 读口）
    expect(screen.queryByText('任务 A')).toBeNull()
    // ★ 去 mock：读口空（`/api/home/campaign-tasks` ⇒ []）⇒ 版块空态、**零假卡**（不再补位）
    expect(document.querySelector('[data-sf-m="home-camp-grid"]')).toBeNull()
    expect(document.querySelectorAll('[data-sf-m="home-camp-card"]')).toHaveLength(0)
    expect(document.querySelector('[data-sf-m="home-camp-empty"]')).not.toBeNull()
    // 返回 36 条（满页）⇒ 仍可能有下一页 ⇒ sentinel 在场且已挂观察器
    expect(document.querySelector('[data-sf-m="feed-sentinel"]')).not.toBeNull()
    expect(document.querySelector('[data-sf-m="feed-end"]')).toBeNull()
    await flushEffects()
    expect(liveObserver()).toBeTruthy()
  })

  it('滚到底触发下一页：skip 36 → 72（同一时刻只一个在飞）', async () => {
    wireFetch({
      pages: {
        0: page(1, PAGE_SIZE),
        36: page(37, PAGE_SIZE),
        72: page(73, PAGE_SIZE),
      },
    })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    // 第一次「进视口」：跳 36
    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE * 2))
    expect(feedCalls()).toEqual([
      '/api/prize/all?skip=0&limit=36',
      '/api/prize/all?skip=36&limit=36',
    ])

    // 第二次：跳 72（累计 108 = 上限，止步）
    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE * 3))
    expect(feedCalls()).toEqual([
      '/api/prize/all?skip=0&limit=36',
      '/api/prize/all?skip=36&limit=36',
      '/api/prize/all?skip=72&limit=36',
    ])
    // 不重复 bID ⇒ 卡数 == 去重后行数
    expect(new Set(page(1, PAGE_SIZE * 3).map((r) => r.bID)).size).toBe(cardCount())
  })

  it('③ 返回 < 36 ⇒ 终止（不再请求，出「没有更多数据了」，无加载态/按钮残留）', async () => {
    wireFetch({ pages: { 0: page(1, PAGE_SIZE), 36: page(37, 5) } })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE + 5))

    await flushEffects()
    const callsAfterLastPage = feedCalls().length
    expect(callsAfterLastPage).toBe(2)

    // 观察器不得再挂（hasMore=false）⇒ 再触发也不发请求
    expect(liveObserver()).toBeUndefined()
    expect(document.querySelector('[data-sf-m="feed-end"]')).not.toBeNull()
    expect(document.querySelector('[data-sf-m="feed-loading"]')).toBeNull()
    expect(document.querySelector('[data-sf-m="feed-retry"]')).toBeNull()
    expect(feedCalls().length).toBe(callsAfterLastPage)
  })

  it('⑥ 上限 108 件（18 行 × 6 列）：第 3 页满页即止，不再发第 4 页', async () => {
    wireFetch({
      pages: {
        0: page(1, PAGE_SIZE),
        36: page(37, PAGE_SIZE),
        72: page(73, PAGE_SIZE),
        108: page(109, PAGE_SIZE),
      },
    })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE * 2))
    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(MAX_ITEMS))

    // 满 108 ⇒ hasMore=false：观察器卸载、出「到底」文案、第 4 页 never
    await flushEffects()
    expect(liveObserver()).toBeUndefined()
    expect(document.querySelector('[data-sf-m="feed-end"]')).not.toBeNull()
    await act(async () => {})
    expect(feedCalls().filter((u) => u.includes('skip=108'))).toEqual([])
    expect(cardCount()).toBe(MAX_ITEMS)
  })

  it('④ 重复 bID 去重（相邻页因新发插队出现重叠行时，卡数不重复计）', async () => {
    // 第 2 页与第 1 页重叠 30..36（7 行），新增 37..40（4 行）⇒ 去重后共 40
    wireFetch({ pages: { 0: page(1, PAGE_SIZE), 36: page(30, 11) } })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    await triggerNextPage()
    await waitFor(() => expect(cardCount()).toBe(40))

    const ids = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
      .map((el) => el.getAttribute('href'))
      .filter(Boolean)
    if (ids.length > 0) expect(new Set(ids).size).toBe(ids.length)  // 同一 bID 不得出两张卡
  })

  it('卸载后不再发请求（sentinel 已 disconnect）', async () => {
    wireFetch({ pages: { 0: page(1, PAGE_SIZE), 36: page(37, PAGE_SIZE) } })
    const view = renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    await waitFor(() => expect(liveObserver()).toBeTruthy())
    const observerBeforeUnmount = liveObserver()
    const callsBeforeUnmount = feedCalls().length

    view.unmount()

    expect(observerBeforeUnmount.disconnected).toBe(true)
    // 观察器回调即使在卸载后才被投递，也不得再发请求
    await act(async () => { observerBeforeUnmount.trigger() })
    expect(feedCalls().length).toBe(callsBeforeUnmount)
  })

  it('⑤ 下一页失败 ⇒ 停（不自动重试），给「重试」按钮；重试复用同一 skip', async () => {
    wireFetch({ pages: { 0: page(1, PAGE_SIZE), 36: page(37, PAGE_SIZE) }, failOnceAt: 36 })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))

    await triggerNextPage()
    await waitFor(() => expect(document.querySelector('[data-sf-m="feed-retry"]')).not.toBeNull())

    // 失败即停：只发过 1 次 skip=36，不自动循环重试
    expect(feedCalls().filter((u) => u.includes('skip=36')).length).toBe(1)
    // 已加载行保留
    expect(cardCount()).toBe(PAGE_SIZE)

    // 重试：复用 skip=36
    await act(async () => {
      document.querySelector('[data-sf-m="feed-retry"]').click()
    })
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE * 2))
    expect(feedCalls().filter((u) => u.includes('skip=36')).length).toBe(2)
  })
})
