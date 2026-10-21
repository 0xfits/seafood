import React from 'react'
import { describe, expect, it } from 'vitest'
import {
  HOME_CAMPAIGN_CARD_SLOTS,
  MAIN_TASK_TITLE,
  avatarToneOf,
  buildHomeCampaignCards,
  normalizeHomeCampaignRow,
} from '../../home-campaign'
import { isCampaignListedTask, listedTasksOf } from '../../pages/campaign/campaign-util'

// ============================================================================
// HOME-CAMP-v1 纯函数层：读口行 ⇒ 卡（第一轮置首 · 最多 5 张 · **零 mock / 零补位**）
//   ＋ 与 `/campaign` 共用的任务可见性谓词（同一读口口径）
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

describe('buildHomeCampaignCards · 纯映射口径（真行 → 卡，零补位）', () => {
  it('空数据 ⇒ 空数组（不造卡；渲染层走空态）', () => {
    expect(buildHomeCampaignCards([])).toEqual([])
  })

  it('非数组输入 ⇒ 同空数据（[]，不抛错）', () => {
    expect(buildHomeCampaignCards(undefined)).toEqual([])
    expect(buildHomeCampaignCards(null)).toEqual([])
    expect(buildHomeCampaignCards('nope')).toEqual([])
    expect(buildHomeCampaignCards({ rows: [row()] })).toEqual([])
  })

  it('「第一轮」不在首位 ⇒ 置首，其余卡的相对顺序不变；3 行 ⇒ 恰 3 张（不补）', () => {
    const cards = buildHomeCampaignCards([
      row({ task_id: 1, title: '任务甲' }),
      row({ task_id: 2, title: MAIN_TASK_TITLE }),
      row({ task_id: 3, title: '任务乙' }),
    ])
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.title)).toEqual([MAIN_TASK_TITLE, '任务甲', '任务乙'])
    expect(cards.map((card) => card.taskId)).toEqual([2, 1, 3])
    expect(cards[0].isMain).toBe(true)
    expect(cards.filter((card) => card.isMain)).toHaveLength(1)
  })

  it('「第一轮」本就在首位 ⇒ 顺序原样；2 行 ⇒ 恰 2 张（不补至 5）', () => {
    const cards = buildHomeCampaignCards([
      row({ task_id: 9, title: MAIN_TASK_TITLE }),
      row({ task_id: 10, title: '任务乙' }),
    ])
    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.title)).toEqual([MAIN_TASK_TITLE, '任务乙'])
    expect(cards[0].isMain).toBe(true)
  })

  it('真数据 ≥ 5 ⇒ 只取前 5 张（第一轮仍置首，多余行被截）', () => {
    const rows = Array.from({ length: 7 }, (_, i) => row({
      task_id: 20 + i,
      title: i === 2 ? MAIN_TASK_TITLE : `任务第${i}号`,
    }))
    const cards = buildHomeCampaignCards(rows)
    expect(cards).toHaveLength(HOME_CAMPAIGN_CARD_SLOTS)
    expect(cards[0].title).toBe(MAIN_TASK_TITLE)
    expect(cards.map((card) => card.taskId)).toEqual([22, 20, 21, 23, 24])
  })

  it('恰 5 行 ⇒ 5 张、逐行对应（卡数 = 可见行数，字段原样透传）', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ task_id: 40 + i, title: `任务${i}` }))
    const cards = buildHomeCampaignCards(rows)
    expect(cards).toHaveLength(5)
    expect(cards.map((card) => card.taskId)).toEqual([40, 41, 42, 43, 44])
    cards.forEach((card, i) => {
      expect(card.title).toBe(`任务${i}`)
      expect(card.status).toBe('active')
      expect(card.rewardPrimary).toBe('9')
      expect(card.campaignTitle).toBe('活动一')
      expect(card.projectTitle).toBe('项目甲')
      expect(card.joinedCount).toBe(12)
    })
  })

  it('不可见行（ended / draft）被丢弃 ⇒ 与 `/campaign` 同一批任务；全不可见 ⇒ []', () => {
    const cards = buildHomeCampaignCards([
      row({ task_id: 51, title: '进行中甲', status: 'active' }),
      row({ task_id: 52, title: '已截止乙', status: 'ended' }),
      row({ task_id: 53, title: '草稿丙', status: 'draft' }),
      row({ task_id: 54, title: '进行中丁', status: ' active ' }),
    ])
    expect(cards.map((card) => card.taskId)).toEqual([51, 54])
    expect(cards.every((card) => card.status === 'active')).toBe(true)

    expect(buildHomeCampaignCards([
      row({ task_id: 61, title: '已截止甲', status: 'ended' }),
      row({ task_id: 62, title: '已截止乙', status: 'ended' }),
    ])).toEqual([])
  })

  it('「第一轮」不在可见数据中 ⇒ 不产生主卡旗标（也不补造主卡）', () => {
    const cards = buildHomeCampaignCards([row({ task_id: 31 }), row({ task_id: 32, title: '任务乙' })])
    expect(cards).toHaveLength(2)
    expect(cards.some((card) => card.isMain)).toBe(false)
  })

  it('主卡识别 = title trim 后逐字相等（「 第一轮 」带空白也命中）', () => {
    const cards = buildHomeCampaignCards([row({ task_id: 41, title: '  第一轮  ' })])
    expect(cards[0].isMain).toBe(true)
  })

  it('卡行零 mock 旗标（装配不再产 mock 卡）', () => {
    const cards = buildHomeCampaignCards([row({ task_id: 71 })])
    expect(cards[0]).not.toHaveProperty('isMock')
    expect(cards.every((card) => card.taskId != null)).toBe(true)
  })
})

describe('isCampaignListedTask / listedTasksOf · 列表唯一谓词（首页与 /campaign 同源）', () => {
  it('只有 active 进列表面（ended / draft / 空值 / 未知状态一律不进）', () => {
    expect(isCampaignListedTask('active')).toBe(true)
    expect(isCampaignListedTask(' active ')).toBe(true)
    for (const status of ['ended', 'draft', '', null, undefined, 'archived', 'ACTIVE']) {
      expect(isCampaignListedTask(status)).toBe(false)
    }
  })

  it('listedTasksOf：过滤活动下的非列表任务；`tasks` 非数组 ⇒ []', () => {
    const tasks = listedTasksOf({
      tasks: [
        { task_id: 1, status: 'active', title: '甲' },
        { task_id: 2, status: 'ended', title: '乙' },
        { task_id: 3, status: 'active', title: '丙' },
      ],
    })
    expect(tasks.map((task) => task.task_id)).toEqual([1, 3])
    expect(listedTasksOf({})).toEqual([])
    expect(listedTasksOf({ tasks: null })).toEqual([])
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
