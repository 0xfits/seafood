/**
 * 项目页 `/:slug` · 步 2（Kevin 2026-10-21）—— 嵌套列表 + 三入口表单
 *
 * 覆盖面：
 *   ① 载荷构造器**逐键对拍**后端闭集（campaign 五键 / task 七键＋次币成对 / subtask 六键 /
 *      prediction 恰四键），并反向断言「不得出现的键」（campaign 不得带 status、奖励）；
 *   ② 子任务**整组追加**账目：旧行（可重发）+ 新行，旧行一条不少、顺序不变；
 *      不可重发行（无主键 / 已结算 prediction / payload 越界）显式跳过而非静默丢弃；
 *   ③ 嵌套列表三级结构 + 空态文案（只读臂零写入口）；
 *   ④ 入口布局（Kevin 追加）：顶部操作区**只剩【发布活动】**；【发布任务】在**每张活动卡**头、
 *      【发布子任务】在**每张任务卡**头（owner 可见 / 普通用户零入口）；无活动或无任务 ⇒ 对应入口缺席；
 *   ⑤ 两个下沉表单**预选锁定**（不渲染选择器、锁的是被点的那张卡）＋ 提交载荷 ref / 键集对拍
 *      （含 subtasks 追加 3 = 旧 2 + 新 1，旧行 subtask_id 原样回送）。
 */
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const API = vi.hoisted(() => ({
  fetchProjectDetail: vi.fn(),
  fetchProjectCurrencies: vi.fn(),
  createProjectCampaign: vi.fn(),
  patchProjectCampaign: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  appendProjectSubtasks: vi.fn(),
}))
vi.mock('../../pages/project/project-api', () => ({
  fetchProjectDetail: API.fetchProjectDetail,
  fetchProjectCurrencies: API.fetchProjectCurrencies,
  createProjectCampaign: API.createProjectCampaign,
  patchProjectCampaign: API.patchProjectCampaign,
  createProjectCampaignTask: API.createProjectCampaignTask,
  appendProjectSubtasks: API.appendProjectSubtasks,
}))

const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import ProjectPage from '../../pages/project/ProjectPage'
import ProjectNestedList from '../../pages/project/ProjectNestedList'
import {
  CAMPAIGN_KEYS,
  SUBTASK_KEYS,
  TASK_REQUIRED_KEYS,
  buildCampaignPayload,
  buildLaunchPayload,
  buildSubtaskAppendGroup,
  buildSubtaskInput,
  buildTaskPayload,
  toExistingSubtaskInput,
} from '../../pages/project/project-payload'

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

const subtasks = () => ([
  { subtask_id: 901, type_code: 'x_verify', title: '转发推文', content: '附链接', payload: { links: ['https://x.com/a'] }, sort: 1, required: true },
  { subtask_id: 902, type_code: 'survey', title: '填写问卷', content: '', payload: { answers: { q1: 'a' } }, sort: 2, required: false },
])

const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: 7,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [
    {
      campaign_id: 501,
      title: '秋季招募',
      description: '活动说明',
      status: 'active',
      time_start: '2026-10-01T00:00:00.000Z',
      time_end: '2026-10-31T00:00:00.000Z',
      tasks: [
        {
          task_id: 555,
          title: '转发推文',
          description: '转发并截图',
          status: 'active',
          sort: 1,
          time_start: null,
          time_end: null,
          reward_amount_primary: '5',
          reward_cid_secondary: null,
          reward_amount_secondary: null,
          subtasks: subtasks(),
        },
      ],
    },
  ],
  ...patch,
})

// 两活动夹具：证明「每卡一枚入口 + 点哪张锁哪张」（载荷 ref 必须跟着卡走，不能恒取第一张）
const campaignsTwo = () => {
  const first = viewOf().campaigns[0]
  return [
    first,
    {
      campaign_id: 502,
      title: '冬季招募',
      description: '冬季说明',
      status: 'draft',
      time_start: null,
      time_end: null,
      tasks: [
        {
          task_id: 556,
          title: '打包冲量',
          description: '',
          status: 'draft',
          sort: 2,
          time_start: null,
          time_end: null,
          reward_amount_primary: '8',
          reward_cid_secondary: null,
          reward_amount_secondary: null,
          subtasks: [],
        },
      ],
    },
  ]
}

const fill = (root, selector, value) => {
  const el = root.querySelector(selector)
  expect(el, selector).not.toBeNull()
  fireEvent.change(el, { target: { value } })
  return el
}

const submit = (root, formSel) => {
  const form = root.querySelector(formSel)
  expect(form, formSel).not.toBeNull()
  fireEvent.submit(form)
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  API.fetchProjectCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }])
  API.fetchProjectDetail.mockResolvedValue(viewOf())
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
  API.createProjectCampaign.mockResolvedValue({ campaign_id: 601, status: 'draft' })
  API.patchProjectCampaign.mockResolvedValue({ campaign_id: 601, status: 'active' })
  API.createProjectCampaignTask.mockResolvedValue({ task_id: 777 })
  API.appendProjectSubtasks.mockResolvedValue({ task_id: 555 })
})

afterEach(cleanup)

// ---------------------------------------------------------------------------
// ① 载荷构造器（逐键对拍）
// ---------------------------------------------------------------------------
describe('① 载荷构造器 = 后端闭集（逐键）', () => {
  it('campaign：恰五键，project_id 为文本，时间归一成 ISO，**不含 status / 奖励**', () => {
    const built = buildCampaignPayload({
      title: ' 秋季招募 ',
      description: '活动说明',
      timeStart: '2026-11-01T10:00',
      timeEnd: '2026-11-02T10:00',
    }, 11)
    expect(built.ok).toBe(true)
    expect(Object.keys(built.payload)).toEqual(CAMPAIGN_KEYS)
    expect(built.payload).toEqual({
      title: '秋季招募',
      project_id: '11',
      description: '活动说明',
      time_start: new Date('2026-11-01T10:00').toISOString(),
      time_end: new Date('2026-11-02T10:00').toISOString(),
    })
    expect(built.payload).not.toHaveProperty('status')
    expect(built.payload).not.toHaveProperty('reward_amount_primary')
  })

  it('campaign：空标题 / 时间窗倒置 / 项目主键缺失 ⇒ 拒发（错误码可判）', () => {
    expect(buildCampaignPayload({ title: '   ' }, 11)).toEqual({ ok: false, error: 'title' })
    expect(buildCampaignPayload({ title: 'a', timeStart: '2026-11-02T10:00', timeEnd: '2026-11-01T10:00' }, 11))
      .toEqual({ ok: false, error: 'time' })
    expect(buildCampaignPayload({ title: 'a' }, null)).toEqual({ ok: false, error: 'project' })
  })

  it('上线载荷：只送 status（后端 PATCH 闭集内一键，其余键缺省 ⇒ 不动库内值）', () => {
    expect(buildLaunchPayload()).toEqual({ status: 'active' })
  })

  it('task：七键（无次币时不含次币两键）、subtasks 整组、空行被跳过', () => {
    const built = buildTaskPayload({
      title: '转发推文',
      description: '转发并截图',
      timeStart: '',
      timeEnd: '',
      sort: '1',
      rewardPrimary: '5',
      rewardCid: '',
      rewardAmount: '',
      subtasks: [
        { typeCode: 'x_verify', title: '转发', content: '附链接', required: true, sort: '1' },
        { typeCode: 'quiz', title: '', content: '   ', required: false, sort: '2' }, // 空行 ⇒ 跳过
      ],
    })
    expect(built.ok).toBe(true)
    expect(Object.keys(built.payload)).toEqual(TASK_REQUIRED_KEYS)
    expect(built.payload).toEqual({
      title: '转发推文',
      description: '转发并截图',
      time_start: null,
      time_end: null,
      sort: 1,
      reward_amount_primary: '5',
      subtasks: [
        {
          type_code: 'x_verify',
          title: '转发',
          content: '附链接',
          payload: {},
          sort: 1,
          required: true,
        },
      ],
    })
    expect(Object.keys(built.payload.subtasks[0])).toEqual(SUBTASK_KEYS)
  })

  it('task：次币成对才发；半对 / cid=1($) / 奖励 0 ⇒ 拒发', () => {
    const base = { title: 't', rewardPrimary: '5', subtasks: [] }
    expect(buildTaskPayload({ ...base, rewardCid: '4' })).toEqual({ ok: false, error: 'rewardPair' })
    expect(buildTaskPayload({ ...base, rewardAmount: '10' })).toEqual({ ok: false, error: 'rewardPair' })
    expect(buildTaskPayload({ ...base, rewardCid: '1', rewardAmount: '10' })).toEqual({ ok: false, error: 'rewardPair' })
    expect(buildTaskPayload({ title: 't', rewardPrimary: '0', subtasks: [] })).toEqual({ ok: false, error: 'reward' })

    const paired = buildTaskPayload({ ...base, rewardCid: '4', rewardAmount: '10' })
    expect(paired.ok).toBe(true)
    expect(paired.payload.reward_cid_secondary).toBe('4')
    expect(paired.payload.reward_amount_secondary).toBe('10')
  })

  it('subtask：prediction ⇒ payload 恰四键；缺选项 / 奖池 / 截止 ⇒ 拒发', () => {
    const ok = buildSubtaskInput({
      typeCode: 'prediction', title: '猜冠军', content: '', required: false, sort: '3',
      optionA: 'A 队', optionB: 'B 队', prize: '100', deadline: '2026-12-01T12:00',
    })
    expect(ok.ok).toBe(true)
    expect(Object.keys(ok.input.payload)).toEqual(['option_a', 'option_b', 'prize_amount', 'deadline'])
    expect(ok.input.payload.prize_amount).toBe('100')

    const missing = buildSubtaskInput({
      typeCode: 'prediction', title: '猜冠军', content: '', required: false, sort: '0', optionA: 'A 队', optionB: '',
    })
    expect(missing).toEqual({ ok: false, error: 'prediction' })
  })
})

// ---------------------------------------------------------------------------
// ② 子任务整组追加（不丢旧行）
// ---------------------------------------------------------------------------
describe('② 子任务整组追加：旧行一条不少 + 新行一条', () => {
  const newInput = {
    type_code: 'survey', title: '新问卷', content: '填写', payload: { answers: {} }, sort: 3, required: true,
  }

  it('旧两行原样回送（带 subtask_id / payload），新行在尾部 ⇒ 组长度 = 旧 + 1', () => {
    const grouped = buildSubtaskAppendGroup(subtasks(), newInput)
    expect(grouped.ok).toBe(true)
    expect(grouped.group).toHaveLength(3)
    expect(grouped.resent).toBe(2)
    expect(grouped.skipped).toEqual([])
    expect(grouped.group[0]).toEqual({
      subtask_id: '901',
      type_code: 'x_verify',
      title: '转发推文',
      content: '附链接',
      payload: { links: ['https://x.com/a'] },
      sort: 1,
      required: true,
    })
    expect(grouped.group[1].subtask_id).toBe('902')
    expect(grouped.group[2]).toEqual(newInput)
  })

  it('不可重发行**显式跳过**（不是静默消失）：已结算 prediction / 无主键 / payload 越界', () => {
    const rows = [
      ...subtasks(),
      // 已结算 prediction：payload 带 correct_option ⇒ 重发会被后端拒（且会抹掉结算结果）⇒ 跳过
      {
        subtask_id: 903, type_code: 'prediction', title: '猜冠军', content: null, sort: 3, required: false,
        payload: { option_a: 'A', option_b: 'B', prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z', correct_option: 'a' },
      },
      // payload 含类型之外的键 ⇒ 重发会丢键 ⇒ 跳过
      { subtask_id: 904, type_code: 'x_verify', title: '旧行', content: null, sort: 4, required: true, payload: { links: [], note: 'x' } },
      // 无主键（读口异常行）⇒ 无法定位，重发会变成插入（重复行）⇒ 跳过
      { type_code: 'quiz', title: '无主键', content: null, sort: 5, required: true, payload: {} },
    ]
    const grouped = buildSubtaskAppendGroup(rows, newInput)
    expect(grouped.ok).toBe(true)
    expect(grouped.resent).toBe(2)
    expect(grouped.skipped).toEqual(['903', '904', ''])
    expect(grouped.group).toHaveLength(3)
    // 旧行总账：可重发 + 显式跳过 = 全部旧行（一条不许无声蒸发）
    expect(grouped.resent + grouped.skipped.length).toBe(rows.length)
  })

  it('负控：新行缺失 / 非对象 ⇒ 组不成立，调用方不得发 PATCH', () => {
    expect(buildSubtaskAppendGroup(subtasks(), null)).toEqual({ ok: false, error: 'subtask' })
    expect(buildSubtaskAppendGroup(subtasks(), 'x')).toEqual({ ok: false, error: 'subtask' })
  })

  it('toExistingSubtaskInput：空 payload（四类非 prediction）原样回送；prediction 缺键 ⇒ 跳过', () => {
    expect(toExistingSubtaskInput({
      subtask_id: 905, type_code: 'quiz', title: '答题', content: '', payload: {}, sort: 6, required: true,
    })).toEqual({
      subtask_id: '905', type_code: 'quiz', title: '答题', content: null, payload: {}, sort: 6, required: true,
    })
    expect(toExistingSubtaskInput({
      subtask_id: 906, type_code: 'prediction', title: '缺键', content: null, payload: { option_a: 'A' }, sort: 7, required: false,
    })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ③ 嵌套列表（三级结构 + 空态）
// ---------------------------------------------------------------------------
describe('③ 嵌套列表：campaign → task → subtask 三级，空态文案在场', () => {
  const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)

  it('三级结构逐层渲染（活动标题链 / 任务完成奖 / 子任务类型徽标与必做标记）', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={viewOf().campaigns} t={t} lang="zh" symbols={{ '4': 'BTTC' }} />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('[data-sf-m="project-campaign"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-sf-m="project-task"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-sf-m="project-subtask"]')).toHaveLength(2)
    expect(container.querySelector('[data-sf-m="project-campaign-link"]').getAttribute('href')).toBe('/campaign/501')
    expect(container.querySelector('[data-sf-m="project-task-reward"]').getAttribute('data-sf-amount')).toBe('5')
    const badges = [...container.querySelectorAll('[data-sf-m="project-subtask-type"]')].map((el) => el.textContent)
    expect(badges).toEqual(['campaign.type.x_verify', 'campaign.type.survey'])
    const reqs = [...container.querySelectorAll('[data-sf-m="project-subtask-required"]')].map((el) => el.getAttribute('data-sf-required'))
    expect(reqs).toEqual(['1', '0'])
    // 只读臂（未传 canManage）⇒ 卡片内零写入口（入口显隐由父组件闸控，组件自身不擅自开）
    expect(container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(0)
  })

  it('空态：无活动 ⇒ campaignsEmpty；活动无任务 ⇒ tasksEmpty；任务无子任务 ⇒ subtasksEmpty', () => {
    const empty = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={[]} t={t} lang="zh" symbols={{}} />
      </MemoryRouter>,
    )
    expect(empty.container.querySelector('[data-sf-m="project-campaigns-empty"]').textContent).toBe('project.campaignsEmpty')
    empty.unmount()

    const view = viewOf()
    view.campaigns[0].tasks[0].subtasks = []
    const noSub = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={view.campaigns} t={t} lang="zh" symbols={{}} />
      </MemoryRouter>,
    )
    expect(noSub.container.querySelector('[data-sf-m="project-subtasks-empty"]').textContent).toBe('project.subtasksEmpty')
    noSub.unmount()

    view.campaigns[0].tasks = []
    const noTask = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={view.campaigns} t={t} lang="zh" symbols={{}} />
      </MemoryRouter>,
    )
    expect(noTask.container.querySelector('[data-sf-m="project-tasks-empty"]').textContent).toBe('campaign.tasksEmpty')
  })
})

// ---------------------------------------------------------------------------
// ④ 入口布局（Kevin 2026-10-21 追加）：顶部只剩【发布活动】，任务入口进活动卡、
//    子任务入口进任务卡；无活动 / 无任务 ⇒ 对应入口自然缺席
// ---------------------------------------------------------------------------
describe('④ 入口布局：顶部只剩【发布活动】＋ 每活动卡一枚任务、每任务卡一枚子任务', () => {
  it('owner：顶部恰 1 个入口（活动）；2 张活动卡各 1 枚任务入口、2 张任务卡各 1 枚子任务入口（各在所属卡头内）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: campaignsTwo() }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-manage"]')).not.toBeNull())

    // ① 顶部操作区 = 【编辑项目】+【发布活动】两枚（2026-10-21② 编辑入口自 /wage 卡移入本页，
    //    排在操作区第 1 枚）；任务 / 子任务入口仍不得出现在顶部
    const topEntries = [...container.querySelectorAll('[data-sf-m="project-manage"] [data-sf-m^="project-entry-"]')]
    expect(topEntries).toHaveLength(2)
    expect(topEntries.map((el) => el.getAttribute('data-sf-m')))
      .toEqual(['project-entry-edit', 'project-entry-campaign'])
    expect(container.querySelector('[data-sf-m="project-entry-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-entry-subtask"]')).toBeNull()

    // ② 每张活动卡一枚【发布任务】，ref 跟着卡走（不是恒取第一张）
    const taskEntries = [...container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')]
    expect(taskEntries).toHaveLength(2)
    expect(taskEntries.map((el) => el.getAttribute('data-sf-ref'))).toEqual(['501', '502'])

    // ③ 每张任务卡一枚【发布子任务】，task id 跟着卡走
    const subEntries = [...container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')]
    expect(subEntries).toHaveLength(2)
    expect(subEntries.map((el) => el.getAttribute('data-sf-task'))).toEqual(['555', '556'])

    // 入口位置：都在自己卡片头里（不是顶部、不是列表外）
    const heads = [...container.querySelectorAll('[data-sf-m="project-campaign"] > .sf-project-campaign-head')]
    expect(heads).toHaveLength(2)
    for (const head of heads) {
      expect(head.querySelector('[data-sf-m="project-campaign-entry-task"]')).not.toBeNull()
    }
    const taskHeads = [...container.querySelectorAll('[data-sf-m="project-task"] > .sf-project-task-head')]
    expect(taskHeads).toHaveLength(2)
    for (const head of taskHeads) {
      expect(head.querySelector('[data-sf-m="project-task-entry-subtask"]')).not.toBeNull()
    }

    // 默认零表单（入口不预开）
    expect(container.querySelector('[data-sf-m="project-form-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
  })

  it('普通用户（非 owner ∧ 无 manage_tasks）：三处入口全不渲染、零表单', async () => {
    AUTH.user = { uID: 99 }
    API.fetchProjectDetail.mockResolvedValue(viewOf({ owner_uid: 7 }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="project-manage"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-entry-campaign"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(0)
    expect(container.querySelector('[data-sf-m="project-form-campaign"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-form-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
  })

  it('无活动 ⇒ 任务入口不出现；活动无任务 ⇒ 子任务入口不出现（零写请求）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: [] }))
    const empty = renderAt('/sui')
    await waitFor(() => expect(empty.container.querySelector('[data-sf-m="project-campaigns-empty"]')).not.toBeNull())
    expect(empty.container.querySelectorAll('[data-sf-m="project-campaign"]')).toHaveLength(0)
    expect(empty.container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(0)
    expect(empty.container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(0)
    // 顶部【发布活动】仍在（owner 可先建活动）
    expect(empty.container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull()
    expect(API.createProjectCampaignTask).not.toHaveBeenCalled()
    empty.unmount()

    const noTasks = viewOf()
    noTasks.campaigns[0].tasks = []
    API.fetchProjectDetail.mockResolvedValue(noTasks)
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-tasks-empty"]')).not.toBeNull())
    // 活动卡在 ⇒ 任务入口在；无任务卡 ⇒ 子任务入口缺席
    expect(container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(0)
    expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
    expect(API.appendProjectSubtasks).not.toHaveBeenCalled()
  })

  it('同一 task_id 出现在两张活动卡下 ⇒ 点第 2 张卡只在该卡开 1 个表单（开合键带活动 ref，不双开）', async () => {
    const campaigns = campaignsTwo()
    // 人为造「556 同时在 501 与 502 下」（正常库里 task_id 全局唯一；此处只为钉住开合键口径）
    campaigns[0].tasks.push({ ...campaigns[1].tasks[0], campaign_id: '501', sort: 2 })
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(3))

    const cards = [...container.querySelectorAll('[data-sf-m="project-campaign"]')]
    const secondTask = cards[1].querySelector('[data-sf-m="project-task"][data-sf-task="556"]')
    fireEvent.click(secondTask.querySelector('[data-sf-m="project-task-entry-subtask"]'))
    await waitFor(() => expect(secondTask.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())

    // 全局恰 1 个表单，且落在被点的第 2 张活动卡内；第 1 张卡里的同 id 任务**不开**
    expect(container.querySelectorAll('[data-sf-m="project-form-subtask"]')).toHaveLength(1)
    expect(cards[0].querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
    const locked = cards[1].querySelector('[data-sf-m="project-form-task-locked"]')
    expect(locked.getAttribute('data-sf-campaign')).toBe('502')
    expect(locked.getAttribute('data-sf-ref')).toBe('556')
  })
})

// ---------------------------------------------------------------------------
// ⑤ 三个表单：活动（顶部）/ 任务（卡内锁定）/ 子任务（卡内双锁）—— 载荷与 ref 对拍
// ---------------------------------------------------------------------------
describe('⑤ 表单：预选锁定（无选择器）＋ 提交载荷 / ref 对拍', () => {
  it('【发布活动】默认存草稿：POST 载荷恰五键、零 PATCH；勾「立即上线」再发一条 PATCH{status:active}', async () => {
    const first = renderAt('/sui')
    await waitFor(() => expect(first.container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull())
    fireEvent.click(first.container.querySelector('[data-sf-m="project-entry-campaign"]'))
    await waitFor(() => expect(first.container.querySelector('[data-sf-m="project-form-campaign"]')).not.toBeNull())
    fill(first.container, '[data-sf-m="project-form-campaign"] [data-sf-field="title"]', '秋季招募')
    fill(first.container, '[data-sf-m="project-form-campaign"] [data-sf-field="description"]', '活动说明')
    fill(first.container, '[data-sf-m="project-form-campaign"] [data-sf-field="timeStart"]', '2026-11-01T10:00')
    fill(first.container, '[data-sf-m="project-form-campaign"] [data-sf-field="timeEnd"]', '2026-11-02T10:00')
    submit(first.container, '[data-sf-m="project-form-campaign"]')
    await waitFor(() => expect(API.createProjectCampaign).toHaveBeenCalledTimes(1))
    expect(API.createProjectCampaign.mock.calls[0][0]).toEqual({
      title: '秋季招募',
      project_id: '11',
      description: '活动说明',
      time_start: new Date('2026-11-01T10:00').toISOString(),
      time_end: new Date('2026-11-02T10:00').toISOString(),
    })
    expect(API.patchProjectCampaign).not.toHaveBeenCalled()
    await waitFor(() => expect(first.container.querySelector('[data-sf-m="project-form-notice"]').textContent).toBe('project.okDraft'))
    first.unmount()

    // 勾选「立即上线」⇒ 二次 PATCH 只送 status
    const second = renderAt('/sui')
    await waitFor(() => expect(second.container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull())
    fireEvent.click(second.container.querySelector('[data-sf-m="project-entry-campaign"]'))
    await waitFor(() => expect(second.container.querySelector('[data-sf-m="project-form-campaign"]')).not.toBeNull())
    fill(second.container, '[data-sf-m="project-form-campaign"] [data-sf-field="title"]', '秋季招募')
    fireEvent.click(second.container.querySelector('[data-sf-m="project-form-campaign"] [data-sf-field="launch"]'))
    submit(second.container, '[data-sf-m="project-form-campaign"]')
    await waitFor(() => expect(API.patchProjectCampaign).toHaveBeenCalledTimes(1))
    expect(API.patchProjectCampaign.mock.calls[0]).toEqual(['601', { status: 'active' }, AUTH.user])
    await waitFor(() => expect(second.container.querySelector('[data-sf-m="project-form-notice"]').textContent).toBe('project.okLaunched'))
  })

  it('【发布任务】点第 2 张活动卡 ⇒ 表单就地落在该卡、锁 502、无活动选择器；提交 POST 到 502', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: campaignsTwo() }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(2))
    const cards = () => [...container.querySelectorAll('[data-sf-m="project-campaign"]')]

    fireEvent.click(cards()[1].querySelector('[data-sf-m="project-campaign-entry-task"]'))
    await waitFor(() => expect(cards()[1].querySelector('[data-sf-m="project-form-task"]')).not.toBeNull())
    // 就地渲染在第二张卡内（不在第一张、也不在顶部操作区）
    expect(cards()[0].querySelector('[data-sf-m="project-form-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-manage"] [data-sf-m="project-form-task"]')).toBeNull()
    // 预选锁定：锁的是被点的这张卡，选择器不渲染
    const lockedSecond = cards()[1].querySelector('[data-sf-m="project-form-campaign-locked"]')
    expect(lockedSecond.getAttribute('data-sf-ref')).toBe('502')
    expect(lockedSecond.textContent).toContain('冬季招募')
    expect(container.querySelector('[data-sf-m="project-form-task"] [data-sf-field="campaign"]')).toBeNull()

    // 换点第 1 张卡 ⇒ 只留一个任务表单，锁切到 501
    fireEvent.click(cards()[0].querySelector('[data-sf-m="project-campaign-entry-task"]'))
    await waitFor(() => expect(cards()[0].querySelector('[data-sf-m="project-form-task"]')).not.toBeNull())
    expect(container.querySelectorAll('[data-sf-m="project-form-task"]')).toHaveLength(1)
    expect(container.querySelector('[data-sf-m="project-form-campaign-locked"]').getAttribute('data-sf-ref')).toBe('501')

    const form = '[data-sf-m="project-form-task"]'
    fill(container, `${form} [data-sf-field="title"]`, '转发推文')
    fill(container, `${form} [data-sf-field="description"]`, '转发并截图')
    fill(container, `${form} [data-sf-field="reward"]`, '5')
    fill(container, `${form} [data-sf-field="cid"]`, '4')
    fill(container, `${form} [data-sf-field="amount"]`, '10')
    fill(container, `${form} [data-sf-field="sort"]`, '2')
    fill(container, `${form} [data-sf-row="0"] [data-sf-field="title"]`, '转发')
    fill(container, `${form} [data-sf-row="0"] [data-sf-field="content"]`, '附链接')
    fill(container, `${form} [data-sf-row="0"] [data-sf-field="sort"]`, '1')
    submit(container, form)

    await waitFor(() => expect(API.createProjectCampaignTask).toHaveBeenCalledTimes(1))
    const [campaignRef, payload] = API.createProjectCampaignTask.mock.calls[0]
    // campaignId 对拍：等于被点那张卡的 ref（不是第一张、不是页面缓存里的默认值）
    expect(campaignRef).toBe('501')
    expect(payload).toEqual({
      title: '转发推文',
      description: '转发并截图',
      time_start: null,
      time_end: null,
      sort: 2,
      reward_amount_primary: '5',
      reward_cid_secondary: '4',
      reward_amount_secondary: '10',
      subtasks: [{
        type_code: 'x_verify',
        title: '转发',
        content: '附链接',
        payload: {},
        sort: 1,
        required: true,
      }],
    })
    expect(payload).not.toHaveProperty('status')
    // 提交后收面板、给结论、静默重读
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-task"]')).toBeNull())
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-notice"]').textContent).toBe('project.published'))
  })

  it('【发布子任务】点任务卡入口 ⇒ 活动 + 任务双锁（两个选择器都不渲染），提交前重读 → 整组追加', async () => {
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-task-entry-subtask"]')).not.toBeNull())
    const readBefore = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(container.querySelector('[data-sf-m="project-task-entry-subtask"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())

    // 就地渲染在任务卡内；活动 + 任务均锁定，两个选择器都不在
    const taskCard = container.querySelector('[data-sf-m="project-task"]')
    expect(taskCard.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull()
    const locked = taskCard.querySelector('[data-sf-m="project-form-task-locked"]')
    expect(locked.getAttribute('data-sf-campaign')).toBe('501')
    expect(locked.getAttribute('data-sf-ref')).toBe('555')
    expect(locked.textContent).toContain('秋季招募')
    expect(locked.textContent).toContain('转发推文')
    expect(container.querySelector('[data-sf-m="project-form-subtask"] [data-sf-field="campaign"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-form-subtask"] [data-sf-field="task"]')).toBeNull()

    const form = '[data-sf-m="project-form-subtask"]'
    fill(container, `${form} [data-sf-field="type"]`, 'survey')
    fill(container, `${form} [data-sf-field="title"]`, '新问卷')
    fill(container, `${form} [data-sf-field="content"]`, '填写')
    fill(container, `${form} [data-sf-field="sort"]`, '3')
    submit(container, form)

    await waitFor(() => expect(API.appendProjectSubtasks).toHaveBeenCalledTimes(1))
    // 提交前**新鲜重读**（不用页面缓存）：重读发生在 PATCH 之前（调用顺序可判）
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(readBefore)
    const freshOrder = API.fetchProjectDetail.mock.invocationCallOrder[readBefore]
    expect(freshOrder).toBeLessThan(API.appendProjectSubtasks.mock.invocationCallOrder[0])
    const [taskRef, group] = API.appendProjectSubtasks.mock.calls[0]
    // taskId 对拍：等于被点那张任务卡的 task_id
    expect(taskRef).toBe('555')
    expect(group).toHaveLength(3)
    expect(group[0].subtask_id).toBe('901')
    expect(group[0].payload).toEqual({ links: ['https://x.com/a'] })
    expect(group[1].subtask_id).toBe('902')
    expect(group[2]).toEqual({
      type_code: 'survey',
      title: '新问卷',
      content: '填写',
      payload: {},
      sort: 3,
      required: true,
    })
    // 旧行主键全部保留（不丢旧行）
    expect(group.filter((row) => row.subtask_id).map((row) => row.subtask_id)).toEqual(['901', '902'])
  })

  it('【发布子任务】点第 2 张任务卡 ⇒ taskId 对拍到 556（不写第一张卡）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: campaignsTwo() }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(2))
    const tasks = () => [...container.querySelectorAll('[data-sf-m="project-task"]')]
    fireEvent.click(tasks()[1].querySelector('[data-sf-m="project-task-entry-subtask"]'))
    await waitFor(() => expect(tasks()[1].querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())
    expect(tasks()[0].querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-m="project-form-subtask"]')).toHaveLength(1)
    expect(container.querySelector('[data-sf-m="project-form-task-locked"]').getAttribute('data-sf-campaign')).toBe('502')
    expect(container.querySelector('[data-sf-m="project-form-task-locked"]').getAttribute('data-sf-ref')).toBe('556')

    const form = '[data-sf-m="project-form-subtask"]'
    fill(container, `${form} [data-sf-field="title"]`, '冷库复核')
    fill(container, `${form} [data-sf-field="sort"]`, '1')
    submit(container, form)
    await waitFor(() => expect(API.appendProjectSubtasks).toHaveBeenCalledTimes(1))
    const [taskRef, group] = API.appendProjectSubtasks.mock.calls[0]
    expect(taskRef).toBe('556')
    // 556 下本来没有子任务 ⇒ 组 = 0 旧 + 1 新
    expect(group).toHaveLength(1)
    expect(group[0].title).toBe('冷库复核')
  })
})
