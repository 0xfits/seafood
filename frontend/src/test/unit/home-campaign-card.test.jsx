import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import '../../i18n'
import HomeCampaignCard from '../../components/campaign/HomeCampaignCard'

// ============================================================================
// HOME-CAMP-v1 卡片两形态：项目头像（有 / 无 url）· 点击路由 · mock 不可点
// ============================================================================

const t = (key, values) => {
  const table = {
    'common.ongoing': '进行中',
    'wage.statusClosed': '已截止',
    'jobs.participants': `已参与 ${values?.count} 人`,
    'jobs.participantsHeadcount': `已参与 ${values?.done} / 共 ${values?.limit} 人`,
    'campaign.rewardSecondary': `+${values?.amount} ${values?.symbol}`,
  }
  return table[key] ?? key
}

const renderCard = (card, ui = {}) => render(
  <MemoryRouter>
    <HomeCampaignCard card={card} lang="zh" t={t} symbols={ui.symbols ?? {}} />
  </MemoryRouter>,
)

const baseCard = {
  taskId: 301,
  campaignId: 501,
  title: '第一轮',
  status: 'active',
  joinedCount: 66,
  joinedTarget: 300,
  rewardPrimary: '15',
  rewardSecondaryAmount: '40',
  rewardSecondaryCid: '2',
  campaignTitle: '新赛季社区任务',
  projectTitle: '星链楼市',
  projectSlug: 'xinglian',
  projectAvatarUrl: '',
  isMock: false,
  isMain: true,
}

describe('HomeCampaignCard · 项目头像两形态', () => {
  afterEach(cleanup)

  it('有 project_avatar_url ⇒ 圆形 avatar 内渲染 <img>（src 透传），无首字兜底', () => {
    const { container } = renderCard({ ...baseCard, projectAvatarUrl: '/api/media/abc.png' })
    const avatar = container.querySelector('[data-sf-m="home-camp-avatar"]')
    expect(avatar).not.toBeNull()
    const img = avatar.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/api/media/abc.png')
    expect(avatar.querySelector('.sf-home-camp-avatar-initial')).toBeNull()
  })

  it('无 project_avatar_url ⇒ 项目名首字兜底（首字 + data-sf-tone 档位），零 <img>', () => {
    const { container } = renderCard({ ...baseCard, projectAvatarUrl: '' })
    const avatar = container.querySelector('[data-sf-m="home-camp-avatar"]')
    expect(avatar).not.toBeNull()
    expect(avatar.querySelector('img')).toBeNull()
    const initial = avatar.querySelector('.sf-home-camp-avatar-initial')
    expect(initial).not.toBeNull()
    expect(initial.textContent).toBe('星')
    const tone = Number(avatar.getAttribute('data-sf-tone'))
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(10)
  })
})

describe('HomeCampaignCard · 点击路由与 mock 不可点', () => {
  afterEach(cleanup)

  // 口径前推（Kevin 2026-10-21 需求②）：整卡主目标 = **任务自己的页面** `/task/:taskId`；
  // 缺 task_id 的历史行才回落活动页 `/campaign/:campaignId`（兜底，不留不可点卡）。
  it('task_id 在场 ⇒ 整卡 <a> 指向 /task/:taskId（zh 档无前缀）', () => {
    renderCard(baseCard)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/task/301')
    expect(link.getAttribute('data-sf-camp-mock')).toBe('0')
    expect(link.getAttribute('data-sf-camp-main')).toBe('1')
    expect(link.getAttribute('data-sf-task')).toBe('301')
  })

  it('缺 task_id 但有 campaign_id ⇒ 回落 /campaign/:campaignId（兜底可点）', () => {
    renderCard({ ...baseCard, taskId: null })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/campaign/501')
    expect(link.getAttribute('data-sf-camp-mock')).toBe('0')
  })

  it('mock 卡（campaign_id 缺省）⇒ 渲染 div，零链接（仅展示不可点）', () => {
    const { container } = renderCard({ ...baseCard, campaignId: null, taskId: null, isMock: true, isMain: false })
    expect(screen.queryByRole('link')).toBeNull()
    const card = container.querySelector('[data-sf-m="home-camp-card"]')
    expect(card.tagName).toBe('DIV')
    expect(card.getAttribute('data-sf-camp-mock')).toBe('1')
  })

  it('en 档前缀由唯一构造器承担：href = /en/task/301', () => {
    render(
      <MemoryRouter>
        <HomeCampaignCard card={baseCard} lang="en" t={t} symbols={{}} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('/en/task/301')
  })
})

describe('HomeCampaignCard · 徽标 / 进度 / 奖励', () => {
  afterEach(cleanup)

  it('active ⇒ 进行中；ended ⇒ 已截止；其余状态 ⇒ 徽标整行不渲染', () => {
    const a = renderCard(baseCard)
    expect(a.queryByText('进行中')).not.toBeNull()
    cleanup()
    const b = renderCard({ ...baseCard, status: 'ended' })
    expect(b.queryByText('已截止')).not.toBeNull()
    cleanup()
    const c = renderCard({ ...baseCard, status: 'draft' })
    expect(c.queryByText('进行中')).toBeNull()
    expect(c.queryByText('已截止')).toBeNull()
  })

  it('进度：带 joined_target ⇒ 「已参与 X / 共 Y」；缺省 ⇒ 只显「已参与 X」', () => {
    const a = renderCard(baseCard)
    expect(a.queryByText('已参与 66 / 共 300 人')).not.toBeNull()
    cleanup()
    const b = renderCard({ ...baseCard, joinedTarget: null })
    expect(b.queryByText('已参与 66 人')).not.toBeNull()
    expect(b.queryByText('已参与 66 / 共 300 人')).toBeNull()
  })

  it('奖励：$ 主奖励恒在；次币需币种表命中符号（未命中 ⇒ 次币行不渲染）', () => {
    const withSymbol = renderCard(baseCard, { symbols: { 2: 'batt' } })
    expect(withSymbol.container.querySelector('.sf-home-camp-reward-cur').textContent).toBe('$')
    expect(withSymbol.container.querySelector('[data-sf-amount]').getAttribute('data-sf-amount')).toBe('15')
    expect(withSymbol.queryByText('+40 batt')).not.toBeNull()
    cleanup()
    const noSymbol = renderCard(baseCard, { symbols: {} })
    expect(noSymbol.queryByText('+40 batt')).toBeNull()
  })

  it('卡内自上而下五段钩子齐备（项目行 / 标题 / 徽标 / 进度 / 奖励）', () => {
    const { container } = renderCard(baseCard, { symbols: { 2: 'batt' } })
    for (const hook of ['home-camp-project', 'home-camp-campaign', 'home-camp-title', 'home-camp-status', 'home-camp-joined', 'home-camp-reward']) {
      expect(container.querySelector(`[data-sf-m="${hook}"]`)).not.toBeNull()
    }
  })
})
