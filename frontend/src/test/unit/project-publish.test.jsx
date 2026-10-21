/**
 * 项目页 `/:slug` · 步 2（Kevin 2026-10-21）—— 嵌套列表 + 三入口表单
 *
 * 覆盖面：
 *   ① 载荷构造器**逐键对拍**后端闭集（campaign 五键 / task 七键＋次币成对 / subtask 六键 /
 *      prediction 恰四键），并反向断言「不得出现的键」（campaign 不得带 status、奖励）；
 *   ② 子任务**整组追加**账目：旧行（可重发）+ 新行，旧行一条不少、顺序不变；
 *      不可重发行（无主键 / 已结算 prediction / payload 越界）显式跳过而非静默丢弃；
 *   ③ 页面三入口：owner 可见、普通用户零入口零表单；
 *   ④ 三个表单提交载荷对拍（含 subtasks 追加 3 = 旧 2 + 新 1，旧行 subtask_id 原样回送）；
 *   ⑤ 嵌套列表三级结构 + 空态文案。
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
// ④ 三入口表单（页面级 · 载荷对拍）
// ---------------------------------------------------------------------------
describe('④ 三入口：显隐 + 提交载荷对拍', () => {
  it('owner 可见三入口，普通用户零入口零表单', async () => {
    const owner = renderAt('/sui')
    await waitFor(() => expect(owner.container.querySelector('[data-sf-m="project-manage"]')).not.toBeNull())
    expect(owner.container.querySelectorAll('[data-sf-m^="project-entry-"]')).toHaveLength(3)
    owner.unmount()

    AUTH.user = { uID: 99 }
    API.fetchProjectDetail.mockResolvedValue(viewOf({ owner_uid: 7 }))
    const plain = renderAt('/sui')
    await waitFor(() => expect(plain.container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(plain.container.querySelector('[data-sf-m="project-manage"]')).toBeNull()
    expect(plain.container.querySelector('[data-sf-m="project-form-campaign"]')).toBeNull()
    expect(plain.container.querySelector('[data-sf-m="project-form-task"]')).toBeNull()
    expect(plain.container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
  })

  it('【发布 campaign】默认存草稿：POST 载荷恰五键、零 PATCH；勾「立即上线」再发一条 PATCH{status:active}', async () => {
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

  it('【发布任务】POST 到所选 campaign，载荷七键 + 次币成对 + 一行子任务', async () => {
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-entry-task"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="project-entry-task"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-task"]')).not.toBeNull())

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
  })

  it('【发布任务】无 campaign ⇒ 引导先建（不发请求）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: [] }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-entry-task"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="project-entry-task"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-task"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="project-form-need-campaign"]').textContent).toBe('project.fNoCampaign')
    fireEvent.click(container.querySelector('[data-sf-m="project-form-goto-campaign"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-campaign"]')).not.toBeNull())
    expect(API.createProjectCampaignTask).not.toHaveBeenCalled()
  })

  it('【发布子任务】提交前重读 → 整组追加（旧 2 行带 id 原样回送 + 新 1 行）', async () => {
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-entry-subtask"]')).not.toBeNull())
    const readBefore = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(container.querySelector('[data-sf-m="project-entry-subtask"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())

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
})
