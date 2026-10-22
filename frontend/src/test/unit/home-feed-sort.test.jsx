/**
 * FEED-SORT-v1 单测（2026-10-22 · Kevin：「精选奖励」四标签筛选整块下架 ⇒ 两标签【推荐】/【新发】）
 * ---------------------------------------------------------------------------
 * 判据：
 *   ① **默认推荐**：首屏请求 = `/api/prize/all?skip=0&limit=36&sort=recommend`，【推荐】为激活态；
 *      标签区**恰两枚**（`feed-tab-recommend` / `feed-tab-new`），且**无计数芯片**（`全部 (12)` 形态 0 命中）；
 *   ② **切新发**：请求带 `sort=new` 且**页码重置**（skip=0）；续页同样带 `sort=new` 且 skip 前推（不被旧序污染）；
 *   ③ **切档不闪空**：`sort=new` 首屏在飞时**旧行保留**（卡数不清零）+ `feed-pending` 态，**不出整页骨架**；
 *   ④ **非法 / 失败回退推荐**：非默认档首屏失败 ⇒ 退回【推荐】并重取（不出空列表、不出「重试」错误卡）；
 *      `sort` 取值恒在闭集 {recommend,new}（非法值不可能被下发 ⇒ 后端 400 `sort_invalid` 不可达）；
 *   ⑤ 旧四标签（全部 / 限量版 / 高价值 / 已兑换）与 `data-sf-filter` / `filteredRewards` **零残留**。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
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

const prizeRow = (bID) => ({
  bID,
  name: `商品 ${bID}`,
  description: '描述',
  points: 100 + bID,
  stores_count: 2,
  claims_count: 0,
})
const page = (start, count) => Array.from({ length: count }, (_, i) => prizeRow(start + i))

/** 可控 IntersectionObserver stub（setup.js 的全局 mock 会被 `vi.restoreAllMocks()` 拆掉 ⇒ 本文件自管） */
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

/** 触发「滚到底」：先等观察器挂上（passive effect 在 commit 之后才跑），再让 sentinel 进视口 */
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

/** 从请求 URL 取 `sort`（闭集判据用） */
const sortsOf = (urls) => urls.map((u) => new URL(u, 'http://local').searchParams.get('sort'))

const cardCount = () => document.querySelectorAll('[data-sf-m="reward-card"]').length
const tabsOf = () => [...document.querySelectorAll('[data-sf-m="home-item-filter"] [role="tab"]')]
const tabM = (key) => document.querySelector(`[data-sf-m="feed-tab-${key}"]`)
const activeTab = () => tabsOf().filter((el) => el.getAttribute('aria-selected') === 'true').map((el) => el.getAttribute('data-sf-sort'))

/**
 * @param {{ pages?: Record<string, Array>, failSorts?: string[], gateNew?: Promise }} cfg
 *   `pages` 以 `sort` 为键；`failSorts` = 这些 sort 的首屏请求直接抛错；
 *   `gateNew` = 给 `sort=new` 的响应挂闸（用于「pending 期间旧行还在」的断言）。
 */
const wireFetch = ({ pages = {}, failSorts = [], gateNew = null } = {}) => {
  const failed = new Set(failSorts)
  fetchApiJson.mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith('/api/home?')) {
      return { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 }
    }
    if (u.startsWith('/api/home/campaign-tasks')) return []
    if (u.startsWith('/api/currencies')) return []
    if (u.startsWith('/api/prize/all')) {
      const sort = new URL(u, 'http://local').searchParams.get('sort')
      if (failed.has(sort)) throw new Error(`feed ${sort} failed`)
      if (sort === 'new' && gateNew) await gateNew
      return pages[sort] ?? []
    }
    if (u.startsWith('/api/prize-item')) return []
    if (u.startsWith('/api/user/asset/')) return { points: 0 }
    throw new Error(`Unexpected URL: ${u}`)
  })
}

describe('HomePage · 精选奖励两标签（推荐 / 新发）', () => {
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

  it('① 默认 = 推荐：首屏带 sort=recommend，【推荐】激活、恰两枚标签、零计数芯片', async () => {
    wireFetch({ pages: { recommend: page(1, 3) } })
    const { container } = renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(3))

    // 请求：默认档显式下发 recommend（不靠后端缺省值）
    expect(feedCalls()).toEqual(['/api/prize/all?skip=0&limit=36&sort=recommend'])

    // 恰两枚标签，推荐为激活态
    const tabs = tabsOf()
    expect(tabs).toHaveLength(2)
    expect(tabs.map((el) => el.getAttribute('data-sf-sort'))).toEqual(['recommend', 'new'])
    expect(activeTab()).toEqual(['recommend'])
    expect(tabM('recommend').textContent).toBe('推荐')
    expect(tabM('new').textContent).toBe('新发')

    // ★ 计数芯片整块下架：`全部 (12)` / `限量版 (0)` 形态零命中
    for (const tab of tabs) expect(tab.textContent).not.toMatch(/\(\s*\d+\s*\)/)
    expect(container.querySelectorAll('[data-sf-filter]')).toHaveLength(0)
    const tablistText = container.querySelector('[data-sf-m="home-item-filter"]').textContent
    for (const legacy of ['全部', '限量版', '高价值', '已兑换']) expect(tablistText).not.toContain(legacy)
    // 旧标签键不再被页面引用（键仍留在 locale 里，见④源码臂）
    expect(container.textContent).not.toContain('限量版')
    expect(container.textContent).not.toContain('高价值')
  })

  it('② 切【新发】：请求带 sort=new 且页码重置（skip=0）；续页仍带 sort=new 且 skip 前推', async () => {
    wireFetch({
      pages: { recommend: page(1, PAGE_SIZE), new: page(101, PAGE_SIZE) },
    })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))
    expect(feedCalls()).toEqual(['/api/prize/all?skip=0&limit=36&sort=recommend'])

    await act(async () => { tabM('new').click() })

    // 切档 ⇒ 用新 sort 重取第 1 页（skip=0，不是接着旧游标 36）
    await waitFor(() => expect(feedCalls()).toHaveLength(2))
    expect(feedCalls()[1]).toBe('/api/prize/all?skip=0&limit=36&sort=new')
    expect(activeTab()).toEqual(['new'])

    // 行集被新档替换（旧档 bID 不再出现）
    await waitFor(() => expect(cardCount()).toBe(PAGE_SIZE))
    expect(document.body.textContent).toContain('商品 101')
    expect(document.body.textContent).not.toContain('商品 1 ')

    // 续页：滚到底 ⇒ skip 前推到 36，且**仍带当前档的 sort**（不会掉回推荐序）
    await triggerNextPage()
    await waitFor(() => expect(feedCalls()).toHaveLength(3))
    expect(feedCalls()[2]).toBe('/api/prize/all?skip=36&limit=36&sort=new')
    // 闭集：下发的 sort 只可能是 recommend / new
    expect(new Set(sortsOf(feedCalls()))).toEqual(new Set(['recommend', 'new']))
  })

  it('③ 切档不闪空：新档首屏在飞时旧行仍在 + feed-pending，且不出整页骨架', async () => {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    wireFetch({
      pages: { recommend: page(1, 5), new: page(101, 4) },
      gateNew: gate,
    })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(5))

    await act(async () => { tabM('new').click() })

    // 在飞期间：pending 提示在场；旧 5 张卡**没被清空**；整页骨架文案不出现
    await waitFor(() => expect(document.querySelector('[data-sf-m="feed-pending"]')).not.toBeNull())
    expect(cardCount()).toBe(5)
    expect(document.querySelector('[data-sf-m="feed-grid"]')).not.toBeNull()
    expect(document.body.textContent).not.toContain('正在加载精彩内容')
    expect(document.querySelector('[data-sf-m="home-item-filter"]').getAttribute('aria-busy')).toBe('true')

    await act(async () => { release() })
    await waitFor(() => expect(cardCount()).toBe(4))
    // 落地后 pending 撤掉、aria-busy 收回
    await waitFor(() => expect(document.querySelector('[data-sf-m="feed-pending"]')).toBeNull())
    expect(document.querySelector('[data-sf-m="home-item-filter"]').getAttribute('aria-busy')).toBeNull()
  })

  it('④ 非默认档首屏失败 ⇒ 回退推荐（重取 recommend，不出错误卡/空列表）', async () => {
    wireFetch({
      pages: { recommend: page(1, 3) },
      failSorts: ['new'],
    })
    renderHomePage()
    await waitFor(() => expect(cardCount()).toBe(3))
    const callsBeforeSwitch = feedCalls().length

    await act(async () => { tabM('new').click() })

    // `new` 失败 ⇒ 自动退回推荐：再发一次 recommend 请求，标签回到推荐档
    await waitFor(() => expect(feedCalls().length).toBeGreaterThan(callsBeforeSwitch + 1))
    const after = feedCalls().slice(callsBeforeSwitch)
    expect(after[0]).toBe('/api/prize/all?skip=0&limit=36&sort=new')
    expect(after[after.length - 1]).toBe('/api/prize/all?skip=0&limit=36&sort=recommend')
    await waitFor(() => expect(activeTab()).toEqual(['recommend']))

    // 回退成功 ⇒ 不出「重试」错误卡、不出空态（旧行/回退行都在）
    expect(document.querySelector('[data-sf-m="feed-error"]')).toBeNull()
    expect(screen.queryByText('暂无闲置物品')).toBeNull()
    expect(cardCount()).toBe(3)

    // ★ 闭集：下发的 sort 只可能是 recommend / new（非法值 ⇒ 后端 400 `sort_invalid` 不可达）
    expect(new Set(sortsOf(feedCalls()))).toEqual(new Set(['recommend', 'new']))
  })

  it('⑤ 源码零残留：旧四标签键 / data-sf-filter / filteredRewards 不再被首页引用（键本身保留）', async () => {
    const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const homeSrc = fs.readFileSync(path.join(SRC, 'pages/HomePage.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    for (const legacy of ['item.filterAll', 'item.filterLimited', 'item.filterHighValue', 'item.filterClaimed']) {
      expect(homeSrc).not.toContain(legacy)
    }
    expect(homeSrc).not.toContain('filteredRewards')
    expect(homeSrc).not.toContain('data-sf-filter')
    // 两枚新标签键确实被引用
    expect(homeSrc).toContain('item.sortRecommend')
    expect(homeSrc).toContain('item.sortNew')

    // 键仍留在四语 locale（退役不删键 ⇒ 不给计数类断言添红；本单未新增其它键）
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      const locale = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      for (const key of ['filterAll', 'filterLimited', 'filterHighValue', 'filterClaimed', 'sortRecommend', 'sortNew']) {
        expect(typeof locale.item[key]).toBe('string')
      }
    }
  })
})
