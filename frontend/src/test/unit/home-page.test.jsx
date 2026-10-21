import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}))

import toast from 'react-hot-toast'
// P6-I18N-LIT-B1：HomePage 已接 useTranslation => 需初始化真实 i18n（jsdom 无前缀路径 = zh 兜底口径）
import '../../i18n'
import HomePage from '../../pages/HomePage'
import { fetchApiJson, getAuthHeaders } from '../../auth'
import { useAuth } from '../../auth-context'

// ============================================================================
// HOME-CAMP-v1（2026-10-21 · 前端半）：首页「热门任务」= campaign 卡（**纯真数据**）
//   ① 卡 = 读口行的一一映射，最多 5 张；「第一轮」置首；**零 mock / 零补位**；
//   ② 0 行（或读口失败）⇒ 版块空态（既有键 `taskPage.emptyAvailable`），**不造假卡**；
//   ③ 不可见行（ended）不上首页 ⇒ 与 `/campaign` 同一批任务（同一谓词）；
//   ④ 旧 jobs 悬赏拉取（`/api/task/all` / `task_limit`）0 命中。
// ============================================================================

const renderHomePage = () => render(
  <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HomePage />
  </MemoryRouter>
)

const cardsOf = (container) => [...container.querySelectorAll('[data-sf-m="home-camp-card"]')]
const emptyOf = (container) => container.querySelector('[data-sf-m="home-camp-empty"]')
const gridOf = (container) => container.querySelector('[data-sf-m="home-camp-grid"]')
const calledUrls = () => fetchApiJson.mock.calls.map(([url]) => String(url))

describe('HomePage · 热门任务（campaign 体系 · 真数据）', () => {
  let consoleWarnSpy

  const wireFetch = ({ campaignRows, homeFails = false, prizeRows = [{ bID: 2, name: '奖励甲', points: 120, stores_count: 3, claims_count: 0 }] } = {}) => {
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      // ★ 旧 jobs 悬赏口：若仍被请求即命中本支（用 throw 暴露，断言侧另有零命中判据）
      if (u.startsWith('/api/task/all')) throw new Error('LEGACY_JOBS_FETCHED')

      if (u === '/api/home/campaign-tasks') return campaignRows
      if (u === '/api/currencies') return [{ cid: 1, symbol: '$' }, { cid: 2, symbol: 'batt' }]

      if (u === '/api/home?prize_limit=8') {
        if (homeFails) throw new Error('aggregate unavailable')
        return {
          // ★ 聚合口仍会下发 tasks（响应形状不动）—— 本页**不再消费**它
          tasks: [{ tID: 999, title: '旧悬赏幽灵', note: '旧描述', points: 1, is_open: true }],
          prizes: [],
          claimed_prize_ids: [],
          user_points: 42,
        }
      }
      if (u === '/api/prize/all?skip=0&limit=36') return prizeRows
      if (u.startsWith('/api/prize-item')) return []
      if (u.startsWith('/api/user/asset/')) return { points: 520 }
      if (u.startsWith('/api/prize/all?')) return []

      throw new Error(`Unexpected URL: ${u}`)
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getAuthHeaders.mockReturnValue({})
    useAuth.mockReturnValue({ user: null, isAuthenticated: false })
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('3 行真数据 ⇒ 恰 3 张卡（不补至 5）· 第一轮置首 · 旧 jobs 零命中', async () => {
    wireFetch({
      campaignRows: [
        { task_id: 11, campaign_id: 511, title: '任务甲', status: 'active', joined_count: 5, joined_target: 50, reward_amount_primary: '8', campaign_title: '春季活动', project_title: '项目甲', project_avatar_url: '/api/media/a.png' },
        { task_id: 10, campaign_id: 510, title: '第一轮', status: 'active', joined_count: 66, joined_target: 300, reward_amount_primary: '15', reward_amount_secondary: '40', reward_cid_secondary: 2, campaign_title: '冬季主活动', project_title: '项目主', project_avatar_url: '' },
        { task_id: 12, campaign_id: 512, title: '任务乙', status: 'active', joined_count: 9, reward_amount_primary: '3', campaign_title: '秋季活动', project_title: '项目乙', project_avatar_url: '' },
      ],
    })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(3))

    const cards = cardsOf(container)
    // 卡数 = 可见行数（3 行 ⇒ 3 张，无 mock 补位）
    expect(emptyOf(container)).toBeNull()
    // ① 主卡置首（读口第二行「第一轮」被前置）
    expect(cards[0].getAttribute('data-sf-camp-main')).toBe('1')
    expect(cards[0].textContent).toContain('第一轮')
    expect(cards[0].textContent).toContain('冬季主活动')
    expect(cards[0].getAttribute('href')).toBe('/task/10') // 卡主目标：任务页（Kevin 需求②）
    // ② 其余真卡保持相对顺序，逐行一一对应（无伪造行）
    expect(cards[1].textContent).toContain('任务甲')
    expect(cards[1].getAttribute('href')).toBe('/task/11')
    expect(cards[2].textContent).toContain('任务乙')
    expect(cards[2].getAttribute('href')).toBe('/task/12')
    expect(cards.map((card) => card.getAttribute('data-sf-task'))).toEqual(['10', '11', '12'])
    // ③ 零 mock 旗标
    expect(cards.every((card) => card.getAttribute('data-sf-camp-mock') === null)).toBe(true)
    expect(cards.every((card) => card.tagName === 'A')).toBe(true)

    // ④ 聚合口下发的 tasks 不再被消费（旧悬赏行不得出现在页面上）
    expect(screen.queryByText('旧悬赏幽灵')).toBeNull()

    // ⑤ 旧 jobs 拉取零命中
    const urls = calledUrls()
    expect(urls.some((url) => url.includes('/api/task/all'))).toBe(false)
    expect(urls.some((url) => url.includes('task_limit'))).toBe(false)
    expect(urls).not.toContain('/api/home?task_limit=6&prize_limit=8')

    // 商品区与聚合口读数不受影响
    expect(await screen.findByRole('heading', { name: '奖励甲' })).toBeInTheDocument()
    expect(fetchApiJson).toHaveBeenCalledWith('/api/home?prize_limit=8', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('≥5 行真数据 ⇒ 只渲染前 5 张（第一轮置首，截断不补）', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      task_id: 100 + i,
      campaign_id: 600 + i,
      title: i === 3 ? '第一轮' : `任务第${i}号`,
      status: 'active',
      joined_count: i,
      reward_amount_primary: String(i + 1),
      campaign_title: `活动${i}`,
      project_title: `项目${i}`,
    }))
    wireFetch({ campaignRows: rows })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(5))

    const cards = cardsOf(container)
    expect(cards[0].textContent).toContain('第一轮')
    expect(cards[0].getAttribute('data-sf-task')).toBe('103')
    expect(cards.map((card) => card.getAttribute('data-sf-task'))).toEqual(['103', '100', '101', '102', '104'])
    expect(emptyOf(container)).toBeNull()
  })

  it('空数据 ⇒ 版块空态（零卡、零链接、不造假卡）', async () => {
    wireFetch({ campaignRows: [] })

    const { container } = renderHomePage()
    await waitFor(() => expect(emptyOf(container)).not.toBeNull())

    expect(cardsOf(container)).toHaveLength(0)
    expect(gridOf(container)).toBeNull()
    expect(emptyOf(container).textContent).toContain('暂无可用悬赏')
    expect(container.querySelector('[data-sf-m="home-camp"]').querySelectorAll('a')).toHaveLength(1) // 仅「查看全部」
    expect(calledUrls().some((url) => url.includes('/api/task/all'))).toBe(false)
  })

  it('不可见行（ended）不上首页 ⇒ 与 /campaign 同一批任务（3 可见 + 1 已截止 ⇒ 3 卡）', async () => {
    wireFetch({
      campaignRows: [
        { task_id: 201, campaign_id: 701, title: '进行中甲', status: 'active', joined_count: 1, reward_amount_primary: '5', campaign_title: '活动一', project_title: '项目一' },
        { task_id: 202, campaign_id: 701, title: '已截止乙', status: 'ended', joined_count: 2, reward_amount_primary: '6', campaign_title: '活动一', project_title: '项目一' },
        { task_id: 203, campaign_id: 702, title: '进行中丙', status: 'active', joined_count: 3, reward_amount_primary: '7', campaign_title: '活动二', project_title: '项目二' },
        { task_id: 204, campaign_id: 702, title: '进行中丁', status: 'active', joined_count: 4, reward_amount_primary: '8', campaign_title: '活动二', project_title: '项目二' },
      ],
    })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(3))

    expect(cardsOf(container).map((card) => card.getAttribute('data-sf-task'))).toEqual(['201', '203', '204'])
    expect(container.textContent).not.toContain('已截止乙')
    expect(container.textContent).not.toContain('已截止')
  })

  it('「我的积分」卡已整体迁出首页（2026-10-21）⇒ 登录态零命中：无 home-my-points / 无该文案 / 无 🪙', async () => {
    useAuth.mockReturnValue({
      user: { uID: 9, token: 'home-token', access_token: 'home-token' },
      isAuthenticated: true,
    })
    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer home-token' })
    wireFetch({ campaignRows: [] })

    const { container } = renderHomePage()
    // 等首屏稳定（任务版块落空态 = 页面已过 loading 并渲染完毕）
    await waitFor(() => expect(emptyOf(container)).not.toBeNull())

    // 旧钩子零命中（不留空壳 / 占位）
    expect(container.querySelector('[data-sf-m="home-my-points"]')).toBeNull()
    // 内容整体迁走：卡片文案（zh）与 🪙 在首页任何位置都不再出现
    expect(screen.queryByText('我的积分')).toBeNull()
    expect(container.textContent).not.toContain('🪙')
  })

  it('聚合口不可用 ⇒ 只回落 claimed ids / points（不再回落到任务口），卡数仍 = 读口行数', async () => {
    useAuth.mockReturnValue({
      user: { uID: 9, token: 'home-token', access_token: 'home-token' },
      isAuthenticated: true,
    })
    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer home-token' })
    wireFetch({
      homeFails: true,
      campaignRows: [{ task_id: 21, campaign_id: 521, title: '第一轮', status: 'active', joined_count: 1, reward_amount_primary: '5', campaign_title: '回退活动', project_title: '回退项目' }],
    })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(1))

    expect(cardsOf(container)[0].textContent).toContain('第一轮')
    expect(cardsOf(container)[0].getAttribute('href')).toBe('/task/21')
    expect(await screen.findByRole('heading', { name: '奖励甲' })).toBeInTheDocument()

    expect(fetchApiJson).toHaveBeenCalledWith('/api/prize-item', expect.objectContaining({
      headers: { Authorization: 'Bearer home-token' },
      signal: expect.any(AbortSignal),
    }))
    expect(fetchApiJson).toHaveBeenCalledWith('/api/user/asset/9', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    const urls = calledUrls()
    expect(urls.some((url) => url.includes('/api/task/all'))).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('campaign 读口失败 ⇒ 空态（**不再**回落 mock 卡），不阻断页首其余数据', async () => {
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      if (u === '/api/home/campaign-tasks') throw new Error('campaign endpoint not deployed')
      if (u === '/api/currencies') return []
      if (u === '/api/home?prize_limit=8') return { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 }
      if (u === '/api/prize/all?skip=0&limit=36') return []
      throw new Error(`Unexpected URL: ${u}`)
    })

    const { container } = renderHomePage()
    await waitFor(() => expect(emptyOf(container)).not.toBeNull())

    expect(cardsOf(container)).toHaveLength(0)
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 首页**去动画容器**（2026-10-21 · Kevin：「首页移除容器 animate-fade-in」）
//   ① 首页 DOM 零 `[class*="animate-fade-in"]`（hero 与商品卡都不再套 `FadeIn` 的 `<div>`）；
//   ② 商品卡根 `.sf-reward-card` **直落** `.sf-feed` 网格子项（中间无 wrapper）—— 卡几何
//      （高 392 / 图 240 / 四行 48|32|24|48）由 `reward-card.css` 保证，静态门在 `reward-card-resize`；
//      本页只负责「不塞中间层」⇒ 栅格子项仍 = 卡根；
//   ③ `Motion.jsx` / `animations.css` 的 `.animate-fade-in` **保留**（其它页仍用，全局不动）。
// ============================================================================
describe('HomePage · 去 animate-fade-in 容器（无包裹层）', () => {
  let consoleWarnSpy

  const wireFetch = () => {
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      if (u === '/api/home/campaign-tasks') return []
      if (u === '/api/currencies') return [{ cid: 1, symbol: '$' }]
      if (u === '/api/home?prize_limit=8') return { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 42 }
      if (u === '/api/prize/all?skip=0&limit=36') {
        return [{
          bID: 2, name: '奖励甲', points: 120, stores_count: 3, claims_count: 0,
          seller: { uid: 7, nickname: '0x12**12', avatar: null, credit: 'excellent' },
        }]
      }
      if (u.startsWith('/api/prize-item')) return []
      if (u.startsWith('/api/user/asset/')) return { points: 520 }
      if (u.startsWith('/api/prize/all?')) return []
      throw new Error(`Unexpected URL: ${u}`)
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getAuthHeaders.mockReturnValue({})
    useAuth.mockReturnValue({ user: null, isAuthenticated: false })
    wireFetch()
  })

  afterEach(() => { consoleWarnSpy.mockRestore() })

  it('首页零 `animate-fade-in` 命中（hero 与商品卡均无容器）', async () => {
    const { container } = renderHomePage()
    const grid = await waitFor(() => {
      const el = container.querySelector('[data-sf-m="feed-grid"]')
      expect(el).not.toBeNull()
      return el
    })
    expect(grid.children.length).toBeGreaterThan(0)

    // ① 全页零命中（SlideUp 的 `animate-slide-up` 不算；只看 fade-in）
    expect(container.querySelectorAll('[class*="animate-fade-in"]')).toHaveLength(0)
    expect(document.querySelectorAll('[class*="animate-fade-in"]')).toHaveLength(0)

    // ② hero 直接是列表容器的首个元素子节点（原 `<FadeIn><section>` 的 wrapper 已去）
    const list = container.querySelector('[data-sf-m="home-item-list"]')
    const firstEl = list.children[0]
    expect(firstEl.tagName).toBe('SECTION')
    expect(firstEl.className).toContain('rounded-2xl')
    expect(firstEl.querySelector('h1')).not.toBeNull()
  })

  it('商品卡根直落网格子项（无中间 wrapper）· 卡结构完整', async () => {
    const { container } = renderHomePage()
    const grid = await waitFor(() => {
      const el = container.querySelector('[data-sf-m="feed-grid"]')
      expect(el).not.toBeNull()
      return el
    })

    const cards = [...grid.children]
    expect(cards.length).toBeGreaterThan(0)
    for (const node of cards) {
      // 子项即卡根：`sf-reward-card` + 受测钩子，非 div 包装
      expect(node.classList.contains('sf-reward-card')).toBe(true)
      expect(node.getAttribute('data-sf-m')).toBe('reward-card')
      // 卡内两部分结构仍在（几何由 reward-card.css 固定，见 reward-card-resize 门）
      expect(node.querySelector('.image-container')).not.toBeNull()
      expect(node.querySelector('.content')).not.toBeNull()
      expect(node.querySelector('.sf-reward-inner')).not.toBeNull()
    }
    // 网格的父节点即版块 `<section data-sf-m="home-items">`（无 `space-y-4` 中间层）
    expect(grid.parentElement.getAttribute('data-sf-m')).toBe('home-items')
  })

  it('源码零 `FadeIn` / `StaggerContainer` / `animate-fade-in` 引用（注释除外）· 全局动画类保留', () => {
    // jsdom 环境里 `URL` 不是 node 的 URL ⇒ 用 `fileURLToPath`（与 `reward-card-resize` 同法）
    const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')
    const homeSrc = read('pages/HomePage.jsx').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(homeSrc).not.toContain('FadeIn')
    expect(homeSrc).not.toContain('StaggerContainer')
    expect(homeSrc).not.toContain('animate-fade-in')

    // 全局侧**不动**（其它页仍在用）：Motion.jsx 仍渲染该类、animations.css 仍定义该类
    expect(read('components/ui/Motion.jsx')).toContain('animate-fade-in')
    expect(read('styles/animations.css')).toContain('.animate-fade-in')
  })
})
