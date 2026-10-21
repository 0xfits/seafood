import React from 'react'
import { describe, expect, it } from 'vitest'
import {
  HOME_CAMPAIGN_CARD_SLOTS,
  MAIN_TASK_TITLE,
  MOCK_HOME_CAMPAIGN_CARDS,
  avatarToneOf,
  buildHomeCampaignCards,
  normalizeHomeCampaignRow,
} from '../../home-campaign'

// ============================================================================
// HOME-CAMP-v1 纯函数层：五卡装配（第一轮置首 / mock 恰补至 5）+ 头像兜底档位
// ============================================================================

const row = (overrides = {}) => ({
  task_id: 101,
  campaign_id: 501,
  title: '普通任务 A',
  status: 'active',
  joined_count: 12,
  joined_target: 100,
  reward_amount_primary: '9',
  reward_amount_secondary: null,
  reward_cid_secondary: null,
  campaign_title: '活动一',
  project_title: '项目甲',
  project_slug: 'proj-a',
  project_avatar_url: '',
  ...overrides,
})

describe('buildHomeCampaignCards · 装配口径', () => {
  it('空数据 ⇒ 恰 5 张全 mock（版块不塌，全部不可点：campaign_id 为空）', () => {
    const cards = buildHomeCampaignCards([])
    expect(cards).toHaveLength(HOME_CAMPAIGN_CARD_SLOTS)
    expect(cards.every((card) => card.isMock)).toBe(true)
    expect(cards.every((card) => card.campaignId === null)).toBe(true)
  })

  it('非数组输入 ⇒ 同空数据（5 张全 mock）', () => {
    expect(buildHomeCampaignCards(undefined)).toHaveLength(HOME_CAMPAIGN_CARD_SLOTS)
    expect(buildHomeCampaignCards('nope')).toHaveLength(HOME_CAMPAIGN_CARD_SLOTS)
  })

  it('「第一轮」不在首位 ⇒ 旋转到第一，其余真卡相对顺序不变，mock 恰补至 5', () => {
    const cards = buildHomeCampaignCards([
      row({ task_id: 1, title: '任务甲' }),
      row({ task_id: 2, title: MAIN_TASK_TITLE }),
      row({ task_id: 3, title: '任务乙' }),
    ])
    expect(cards.map((card) => card.title)).toEqual([
      MAIN_TASK_TITLE, '任务甲', '任务乙',
      MOCK_HOME_CAMPAIGN_CARDS[0].title, MOCK_HOME_CAMPAIGN_CARDS[1].title,
    ])
    expect(cards[0].isMain).toBe(true)
    expect(cards.slice(0, 3).every((card) => !card.isMock)).toBe(true)
    expect(cards.slice(3).every((card) => card.isMock)).toBe(true)
    expect(cards).toHaveLength(HOME_CAMPAIGN_CARD_SLOTS)
  })

  it('「第一轮」本就在首位 ⇒ 顺序原样；真卡 2 条 ⇒ mock 补 3', () => {
    const cards = buildHomeCampaignCards([
      row({ task_id: 9, title: MAIN_TASK_TITLE }),
      row({ task_id: 10, title: '任务乙' }),
    ])
    expect(cards.map((card) => card.title)).toEqual([
      MAIN_TASK_TITLE, '任务乙',
      MOCK_HOME_CAMPAIGN_CARDS[0].title, MOCK_HOME_CAMPAIGN_CARDS[1].title, MOCK_HOME_CAMPAIGN_CARDS[2].title,
    ])
    expect(cards[0].isMain).toBe(true)
    expect(cards.filter((card) => card.isMock)).toHaveLength(3)
  })

  it('真数据 ≥ 5 ⇒ 全真卡零 mock；多余真卡被截去且「第一轮」仍置首', () => {
    const rows = Array.from({ length: 7 }, (_, i) => row({
      task_id: 20 + i,
      title: i === 2 ? MAIN_TASK_TITLE : `任务第${i}号`,
    }))
    const cards = buildHomeCampaignCards(rows)
    expect(cards).toHaveLength(HOME_CAMPAIGN_CARD_SLOTS)
    expect(cards.every((card) => !card.isMock)).toBe(true)
    expect(cards[0].title).toBe(MAIN_TASK_TITLE)
    expect(cards.map((card) => card.taskId)).toEqual([22, 20, 21, 23, 24])
  })

  it('「第一轮」不在真数据中 ⇒ 不产生主卡旗标，真卡仍优先', () => {
    const cards = buildHomeCampaignCards([row({ task_id: 31 }), row({ task_id: 32 })])
    expect(cards.some((card) => card.isMain)).toBe(false)
    expect(cards.filter((card) => !card.isMock)).toHaveLength(2)
  })

  it('主卡识别 = title trim 后逐字相等（「 第一轮 」带空白也命中）', () => {
    const cards = buildHomeCampaignCards([row({ task_id: 41, title: '  第一轮  ' })])
    expect(cards[0].isMain).toBe(true)
  })
})

describe('normalizeHomeCampaignRow · 行归一', () => {
  it('字段缺省给空值兜底；joined_count 坏值 ⇒ 0；campaign_id 原样透传', () => {
    const view = normalizeHomeCampaignRow({})
    expect(view.taskId).toBeNull()
    expect(view.campaignId).toBeNull()
    expect(view.title).toBe('')
    expect(view.joinedCount).toBe(0)
    expect(view.joinedTarget).toBeNull()
    expect(view.rewardPrimary).toBeNull()
    expect(view.projectAvatarUrl).toBe('')
  })

  it('数字字段走 Number（字符串数字照收），金额保持字符串（防大数精度丢失）', () => {
    const view = normalizeHomeCampaignRow(row({
      joined_count: '37',
      joined_target: 500,
      reward_amount_primary: '12345678901234567890',
      reward_cid_secondary: 2,
    }))
    expect(view.joinedCount).toBe(37)
    expect(view.joinedTarget).toBe(500)
    expect(view.rewardPrimary).toBe('12345678901234567890')
    expect(view.rewardSecondaryCid).toBe(2)
  })
})

describe('avatarToneOf · 头像兜底档位', () => {
  it('恒落 1..10；同名稳定；不同名可分档', () => {
    expect(avatarToneOf('')).toBe(1)
    expect(avatarToneOf(null)).toBe(1)
    for (const name of ['星链楼市', '喵喵矿场', '深海流动性', '云上集市', 'A', 'Ω', '项目X'.repeat(9)]) {
      const tone = avatarToneOf(name)
      expect(tone).toBeGreaterThanOrEqual(1)
      expect(tone).toBeLessThanOrEqual(10)
      expect(Number.isInteger(tone)).toBe(true)
      expect(avatarToneOf(name)).toBe(tone)
    }
    expect(new Set([1, 2, 3, 4, 5].map((i) => avatarToneOf(`项目${i}`))).size).toBeGreaterThan(1)
  })
})
