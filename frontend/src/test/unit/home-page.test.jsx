import React from 'react'
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
import { MOCK_HOME_CAMPAIGN_CARDS } from '../../home-campaign'

// ============================================================================
// HOME-CAMP-v1（2026-10-21）：首页「热门任务」= campaign 五等卡
//   ① 主卡 = 第一轮（不在首位 ⇒ 排到第一）；
//   ② mock **恰**补至 5（真数据优先；空数据 ⇒ 5 全 mock）；
//   ③ 旧 jobs 悬赏拉取（`/api/task/all` / `/api/home` 的 tasks 消费 / `task_limit` 参数）0 命中；
//   ④ 聚合口不可用时仍只回落 points / claimed ids（不再回落到任务口）。
// ============================================================================

const renderHomePage = () => render(
  <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HomePage />
  </MemoryRouter>
)

const cardsOf = (container) => [...container.querySelectorAll('[data-sf-m="home-camp-card"]')]
const calledUrls = () => fetchApiJson.mock.calls.map(([url]) => String(url))

describe('HomePage · 热门任务（campaign 体系）', () => {
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

  it('主卡 = 第一轮置首 · mock 恰补至 5 · 旧 jobs 零命中', async () => {
    wireFetch({
      campaignRows: [
        { task_id: 11, campaign_id: 511, title: '任务甲', status: 'active', joined_count: 5, joined_target: 50, reward_amount_primary: '8', campaign_title: '春季活动', project_title: '项目甲', project_avatar_url: '/api/media/a.png' },
        { task_id: 10, campaign_id: 510, title: '第一轮', status: 'active', joined_count: 66, joined_target: 300, reward_amount_primary: '15', reward_amount_secondary: '40', reward_cid_secondary: 2, campaign_title: '冬季主活动', project_title: '项目主', project_avatar_url: '' },
        { task_id: 12, campaign_id: 512, title: '任务乙', status: 'ended', joined_count: 9, reward_amount_primary: '3', campaign_title: '秋季活动', project_title: '项目乙', project_avatar_url: '' },
      ],
    })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(5))

    const cards = cardsOf(container)
    // ① 主卡置首（真数据第二行「第一轮」被旋到第一）
    expect(cards[0].getAttribute('data-sf-camp-main')).toBe('1')
    expect(cards[0].textContent).toContain('第一轮')
    expect(cards[0].textContent).toContain('冬季主活动')
    expect(cards[0].getAttribute('href')).toBe('/task/10') // 卡主目标前推：任务页（Kevin 需求②）
    // ② 其余真卡保持相对顺序，随后 mock 依序补位（3 真 + 2 mock = 恰 5）
    expect(cards[1].textContent).toContain('任务甲')
    expect(cards[1].getAttribute('href')).toBe('/task/11')
    expect(cards[2].textContent).toContain('任务乙')
    expect(cards[2].getAttribute('href')).toBe('/task/12')
    expect(cards[3].textContent).toContain(MOCK_HOME_CAMPAIGN_CARDS[0].title)
    expect(cards[4].textContent).toContain(MOCK_HOME_CAMPAIGN_CARDS[1].title)
    expect(cards.map((card) => card.getAttribute('data-sf-camp-mock'))).toEqual(['0', '0', '0', '1', '1'])
    // mock 卡不可点（渲染为 div，无 href）
    expect(cards[3].getAttribute('href')).toBeNull()

    // ③ 聚合口下发的 tasks 不再被消费（旧悬赏行不得出现在页面上）
    expect(screen.queryByText('旧悬赏幽灵')).toBeNull()

    // ④ 旧 jobs 拉取零命中
    const urls = calledUrls()
    expect(urls.some((url) => url.includes('/api/task/all'))).toBe(false)
    expect(urls.some((url) => url.includes('task_limit'))).toBe(false)
    expect(urls).not.toContain('/api/home?task_limit=6&prize_limit=8')

    // 商品区与聚合口读数不受影响
    expect(await screen.findByRole('heading', { name: '奖励甲' })).toBeInTheDocument()
    expect(fetchApiJson).toHaveBeenCalledWith('/api/home?prize_limit=8', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('「我的积分」卡已整体迁出首页（2026-10-21）⇒ 登录态零命中：无 home-my-points / 无该文案 / 无 🪙', async () => {
    useAuth.mockReturnValue({
      user: { uID: 9, token: 'home-token', access_token: 'home-token' },
      isAuthenticated: true,
    })
    getAuthHeaders.mockReturnValue({ Authorization: 'Bearer home-token' })
    wireFetch({ campaignRows: [] })

    const { container } = renderHomePage()
    // 等首屏稳定（campaign 五卡 = 页面已过 loading 并渲染完毕）
    await waitFor(() => expect(cardsOf(container)).toHaveLength(5))

    // 旧钩子零命中（不留空壳 / 占位）
    expect(container.querySelector('[data-sf-m="home-my-points"]')).toBeNull()
    // 内容整体迁走：卡片文案（zh）与 🪙 在首页任何位置都不再出现
    expect(screen.queryByText('我的积分')).toBeNull()
    expect(container.textContent).not.toContain('🪙')
  })

  it('空数据 ⇒ 恰 5 张全 mock（版块不塌，零链接）', async () => {
    wireFetch({ campaignRows: [] })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(5))

    const cards = cardsOf(container)
    expect(cards.every((card) => card.getAttribute('data-sf-camp-mock') === '1')).toBe(true)
    expect(cards.every((card) => card.getAttribute('href') === null)).toBe(true)
    expect(container.querySelector('[data-sf-m="home-camp-grid"]').querySelectorAll('a')).toHaveLength(0)
    expect(calledUrls().some((url) => url.includes('/api/task/all'))).toBe(false)
  })

  it('聚合口不可用 ⇒ 只回落 claimed ids / points（不再回落到任务口），五卡仍满', async () => {
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
    await waitFor(() => expect(cardsOf(container)).toHaveLength(5))

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

  it('campaign 读口失败 ⇒ 落回全 mock（不阻断页首其余数据）', async () => {
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      if (u === '/api/home/campaign-tasks') throw new Error('campaign endpoint not deployed')
      if (u === '/api/currencies') return []
      if (u === '/api/home?prize_limit=8') return { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0 }
      if (u === '/api/prize/all?skip=0&limit=36') return []
      throw new Error(`Unexpected URL: ${u}`)
    })

    const { container } = renderHomePage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(5))
    expect(cardsOf(container).every((card) => card.getAttribute('data-sf-camp-mock') === '1')).toBe(true)
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
