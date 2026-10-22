import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

import '../../i18n'
import TaskPage from '../../pages/TaskPage'
import HomeCampaignCard from '../../components/campaign/HomeCampaignCard'
import { normalizeHomeCampaignRow } from '../../home-campaign'
import { fetchApiJson } from '../../auth'
import { useAuth } from '../../auth-context'

// ============================================================================
// TASK-LIST-SUBTASK-v1（Kevin 2026-10-22 · 前端半）：`/task` 列表卡列出 subtask 标题
//   ① `/task` 卡渲染子任务标题 + 类型徽标（五类 `campaign.type.*`）+ 必做小标；
//   ② 超过 2 条 ⇒ 只渲染 2 行 + 「+N 项子任务」（`taskPage.moreSubtasks`）；
//   ③ 首页热门任务卡（不传 `showSubtasks`）**不渲染**子任务区（零回归）；
//   ④ 缺 `subtasks` 键 / 畸形值 ⇒ 不报错、不占位（整块不渲染）；
//   ⑤ 等高与防溢出靠既有布局契约（卡体 flex column + `min-height:0` + 容器 stretch）⇒
//      静态断言 styles.css；真实几何由 `ops/task-page/probe-task-list.mjs` 量。
// ★ 文案全部走**真实 i18n**（jsdom 无前缀 = zh 兜底），不复刻译文表。
// ============================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STYLES = fs.readFileSync(path.join(HERE, '../../styles.css'), 'utf8')

const LONG_TITLE = '把本次活动的推广长图转发到个人主页并截图回传（要求附上完整链接与时间戳）'

/** 读口行（逐字对齐 `GET /api/home/campaign-tasks` 冻结契约 + 本单加性 `subtasks[]`） */
const rows = () => ([
  {
    task_id: 201, campaign_id: 501, title: '转发推文', status: 'active',
    joined_count: 3, joined_target: 50, reward_amount_primary: '5',
    campaign_title: '秋季招募', project_title: '海鲜打包', project_slug: 'sui', project_avatar_url: null,
    subtasks: [
      { subtask_id: '901', type_code: 'x_verify', title: LONG_TITLE, required: true, sort: 1 },
      { subtask_id: '902', type_code: 'survey', title: '填写问卷', required: false, sort: 2 },
      { subtask_id: '903', type_code: 'quiz', title: '答题三题', required: false, sort: 3 },
    ],
  },
  {
    task_id: 202, campaign_id: 501, title: '填写问卷', status: 'active',
    joined_count: 7, joined_target: null, reward_amount_primary: '3',
    campaign_title: '秋季招募', project_title: '海鲜分拣', project_slug: 'fenjian',
    subtasks: [{ subtask_id: '911', type_code: 'onchain_snapshot', title: '链上持仓快照', required: true, sort: 1 }],
  },
  {
    // ★ 缺 `subtasks` 键（后端加性字段缺席的旧行）：不得报错、不得占位
    task_id: 203, campaign_id: 502, title: '拍摄到货视频', status: 'active',
    joined_count: 0, joined_target: 20, reward_amount_primary: '8',
    campaign_title: '春季活动', project_title: '海鲜打包', project_slug: 'sui',
  },
])

const cardsOf = (container) => [...container.querySelectorAll('[data-sf-m="home-camp-card"]')]
const subtaskBlockOf = (card) => card.querySelector('[data-sf-m="home-camp-subtasks"]')
const subtaskRowsOf = (card) => [...card.querySelectorAll('[data-sf-m="home-camp-subtask"]')]
const moreOf = (card) => card.querySelector('[data-sf-m="home-camp-subtask-more"]')

const renderTaskPage = () => render(
  <MemoryRouter initialEntries={['/task']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <TaskPage />
  </MemoryRouter>,
)

describe('/task 列表卡 · 子任务区（真数据 + 真实 i18n）', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    fetchApiJson.mockImplementation(async (url) => {
      const u = String(url)
      if (u === '/api/home/campaign-tasks') return rows()
      if (u === '/api/currencies') return [{ cid: 1, symbol: '$' }]
      throw new Error(`Unexpected URL: ${u}`)
    })
  })

  it('① 卡渲染子任务标题 + 类型徽标（五类中文名）+ 必做小标', async () => {
    const { container } = renderTaskPage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(3))
    const first = cardsOf(container)[0]
    const blocks = subtaskRowsOf(first)
    expect(blocks).toHaveLength(2)
    // 类型徽标：复用既有 `campaign.type.*`（zh 中文名），且与行的 type_code 对得上
    expect(first.querySelector('[data-sf-m="home-camp-subtask-type"]').textContent).toBe('X 验证')
    expect(first.querySelector('[data-sf-m="home-camp-subtask-type"]').getAttribute('data-sf-type')).toBe('x_verify')
    // 标题原文（长标题靠 CSS ellipsis 收口，DOM 里保留全文）
    expect(first.querySelector('[data-sf-m="home-camp-subtask-title"]').textContent).toBe(LONG_TITLE)
    // 必做小标只在 required 行出现（901 必做 / 902 非必做）
    const reqTags = [...first.querySelectorAll('[data-sf-m="home-camp-subtask-required"]')]
    expect(reqTags).toHaveLength(1)
    expect(reqTags[0].textContent).toBe('必做')
    // 单条子任务的行同样出徽标与标题
    const second = cardsOf(container)[1]
    expect(subtaskRowsOf(second)).toHaveLength(1)
    expect(within(second).getByText('链上快照')).toBeTruthy()
    expect(within(second).getByText('链上持仓快照')).toBeTruthy()
  })

  it('② 超过 2 条 ⇒ 只渲染 2 行 + 「+1 项子任务」', async () => {
    const { container } = renderTaskPage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(3))
    const first = cardsOf(container)[0]
    expect(subtaskRowsOf(first)).toHaveLength(2)
    const more = moreOf(first)
    expect(more).not.toBeNull()
    expect(more.textContent).toBe('+1 项子任务')
    expect(more.getAttribute('data-sf-rest')).toBe('1')
    expect(subtaskBlockOf(first).getAttribute('data-sf-count')).toBe('3')
    // 恰好 1 条的行 ⇒ 零「+N」行
    expect(moreOf(cardsOf(container)[1])).toBeNull()
  })

  it('④ 缺 `subtasks` 键 ⇒ 不报错、不占位（整块不渲染）', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderTaskPage()
    await waitFor(() => expect(cardsOf(container)).toHaveLength(3))
    const third = cardsOf(container)[2]
    expect(subtaskBlockOf(third)).toBeNull()
    expect(third.querySelector('[data-sf-m="home-camp-subtask"]')).toBeNull()
    // 卡本身照常渲染（标题/奖励不因缺键丢）
    expect(third.querySelector('[data-sf-m="home-camp-title"]').textContent).toBe('拍摄到货视频')
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('HomeCampaignCard · 子任务区开关（首页热门任务卡零回归）', () => {
  const t = (key, values) => {
    const table = {
      'common.ongoing': '进行中',
      'wage.statusClosed': '已截止',
      'jobs.participants': `已参与 ${values?.count} 人`,
      'campaign.requiredTag': '必做',
      'campaign.type.x_verify': 'X 验证',
      'campaign.type.survey': '问卷',
      'taskPage.moreSubtasks': `+${values?.n} 项子任务`,
    }
    return table[key] ?? key
  }

  const card = {
    taskId: 301,
    campaignId: 501,
    title: '转发推文',
    status: 'active',
    joinedCount: 1,
    joinedTarget: 10,
    rewardPrimary: '5',
    projectTitle: '海鲜打包',
    subtasks: normalizeHomeCampaignRow(rows()[0]).subtasks,
  }

  const renderCard = (props = {}) => render(
    <MemoryRouter>
      <HomeCampaignCard card={card} lang="zh" t={t} symbols={{}} {...props} />
    </MemoryRouter>,
  )

  it('③ 不传 showSubtasks（首页口径）⇒ 即便行带 subtasks 也零子任务区', () => {
    const { container } = renderCard()
    const root = container.querySelector('[data-sf-m="home-camp-card"]')
    expect(subtaskBlockOf(root)).toBeNull()
    expect(root.querySelector('[data-sf-m="home-camp-subtask-type"]')).toBeNull()
    expect(root.querySelector('[data-sf-m="home-camp-subtask-more"]')).toBeNull()
  })

  it('显式 showSubtasks ⇒ 出现子任务区（同一份行数据）', () => {
    const { container } = renderCard({ showSubtasks: true })
    const root = container.querySelector('[data-sf-m="home-camp-card"]')
    expect(subtaskBlockOf(root)).not.toBeNull()
    expect(subtaskRowsOf(root)).toHaveLength(2)
    expect(moreOf(root).textContent).toBe('+1 项子任务')
  })

  it('④ 空/缺 subtasks ⇒ showSubtasks 开着也不占位（不渲染空 ul）', () => {
    const { container } = render(
      <MemoryRouter>
        <HomeCampaignCard
          card={{ ...card, subtasks: [] }}
          lang="zh"
          t={t}
          symbols={{}}
          showSubtasks
        />
      </MemoryRouter>,
    )
    const root = container.querySelector('[data-sf-m="home-camp-card"]')
    expect(root.querySelector('ul')).toBeNull()
    expect(subtaskBlockOf(root)).toBeNull()
  })
})

describe('子任务区 · 布局契约（等高 / 防溢出 / 零新色值）', () => {
  it('⑤ 卡等高：卡体 flex column + min-height:0，grid 行 stretch，子任务块 min-height:0', () => {
    const cardRule = STYLES.match(/\.sf-home-camp-card \{[\s\S]*?\n\}/)[0]
    expect(cardRule).toMatch(/display:\s*flex;/)
    expect(cardRule).toMatch(/flex-direction:\s*column;/)
    expect(cardRule).toMatch(/min-height:\s*0;/)

    const desktopAt = STYLES.indexOf('@media (min-width: 1025px)')
    expect(desktopAt).toBeGreaterThan(-1)
    const desktop = STYLES.slice(desktopAt)
    expect(desktop).toMatch(/align-items:\s*stretch;/)
    expect(desktop).toMatch(/grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/)

    const block = STYLES.match(/\.sf-home-camp-subtasks \{[\s\S]*?\n\}/)[0]
    expect(block).toMatch(/min-height:\s*0;/)
    expect(block).toMatch(/border-top:\s*1px solid var\(--sf-panel-border\);/)
  })

  it('标题单行截断（ellipsis）+ 行内 min-width:0 防撑破卡宽', () => {
    const title = STYLES.match(/\.sf-home-camp-subtask-title \{[\s\S]*?\n\}/)[0]
    expect(title).toMatch(/white-space:\s*nowrap;/)
    expect(title).toMatch(/text-overflow:\s*ellipsis;/)
    expect(title).toMatch(/min-width:\s*0;/)
    expect(title).toMatch(/flex:\s*1 1 auto;/)
    const row = STYLES.match(/\.sf-home-camp-subtask \{[\s\S]*?\n\}/)[0]
    expect(row).toMatch(/min-width:\s*0;/)
  })

  it('字号档位：子任务行 12px（标题仍 14px），零新色值（无 hex / rgb / hsl）', () => {
    const titleRule = STYLES.match(/\.sf-home-camp-title \{[\s\S]*?\n\}/)[0]
    expect(titleRule).toMatch(/font-size:\s*14px;/)
    const row = STYLES.match(/\.sf-home-camp-subtask \{[\s\S]*?\n\}/)[0]
    expect(row).toMatch(/font-size:\s*12px;/)
    const blockStart = STYLES.indexOf('TASK-LIST-SUBTASK-v1')
    expect(blockStart).toBeGreaterThan(-1)
    const blockCss = STYLES.slice(blockStart, STYLES.indexOf('/* 状态徽标', blockStart))
    expect(blockCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(blockCss).not.toMatch(/\brgba?\(/)
    expect(blockCss).not.toMatch(/\bhsla?\(/)
  })
})
