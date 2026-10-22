/**
 * 项目页 `/:slug` · 概况层（Kevin 2026-10-22：操作主场迁 `/campaign/:ref`）＋ 三表单载荷闭集
 *
 * 覆盖面：
 *   ① 载荷构造器**逐键对拍**后端闭集（campaign 五键 / task 七键＋次币成对 / subtask 六键 /
 *      prediction 恰四键），并反向断言「不得出现的键」（campaign 不得带 status、奖励）；
 *   ② 子任务**整组追加**账目：旧行（可重发）+ 新行，旧行一条不少、顺序不变；
 *      不可重发行（无主键 / 已结算 prediction / payload 越界）显式跳过而非静默丢弃；
 *   ③ 概况层结构（活动名链 `/campaign/:ref` + 状态徽标；任务摘要行链 `/task/:taskId` +
 *      状态 + 完成奖 `$`；**零子任务清单、零操作钮**）+ 空态文案；
 *   ④ 项目页操作区只剩项目级两入口（【编辑项目】/【发布活动】）；任务 / 子任务全部操作元素
 *      （发布任务 / 发布子任务 / 上下线 / 行编辑 / 行删除）**零渲染** —— 它们的行为断言
 *      在 `campaign-task-manage.test.jsx` / `campaign-subtask-manage.test.jsx` /
 *      `campaign-task-status.test.jsx`（新挂载点，不放宽）；
 *   ⑤ 【发布活动】表单（项目页唯一留存的写口）：载荷五键、立即上线二次 PATCH。
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

  it('subtask：prediction ⇒ payload 恰两键（选项固定 Yes/No）；quiz ⇒ 四选项+正确项+奖励；缺项 ⇒ 拒发', () => {
    const ok = buildSubtaskInput({
      typeCode: 'prediction', title: '猜冠军', content: '', required: false, sort: '3',
      prize: '100', deadline: '2026-12-01T12:00',
    })
    expect(ok.ok).toBe(true)
    // 选项固定 Yes/No ⇒ 载荷只剩奖池与截止（不再有 option_a / option_b）
    expect(Object.keys(ok.input.payload)).toEqual(['prize_amount', 'deadline'])
    expect(ok.input.payload.prize_amount).toBe('100')
    expect(ok.input).not.toHaveProperty('option_a')
    expect(ok.input).not.toHaveProperty('reward_amount')

    // 旧四键行的字段即使被传进来也不进载荷（新写入只产两键）
    const withLegacy = buildSubtaskInput({
      typeCode: 'prediction', title: '猜冠军', content: '', required: false, sort: '0',
      optionA: 'A 队', optionB: 'B 队', prize: '50', deadline: '2026-12-01T12:00',
    })
    expect(Object.keys(withLegacy.input.payload)).toEqual(['prize_amount', 'deadline'])

    const missing = buildSubtaskInput({
      typeCode: 'prediction', title: '猜冠军', content: '', required: false, sort: '0', prize: '100',
    })
    expect(missing).toEqual({ ok: false, error: 'prediction' })
  })

  it('subtask：quiz ⇒ {options:{a,b,c,d}, correct:[...]} + 顶层 reward_amount；空选项/无正确项/奖励≤0 ⇒ 拒发', () => {
    const base = {
      typeCode: 'quiz', title: '海鲜常识', content: '', required: true, sort: '4',
      quizA: '虾', quizB: '鱼', quizC: '蟹', quizD: '贝', quizCorrect: ['a', 'c'], quizReward: '8',
    }
    const ok = buildSubtaskInput(base)
    expect(ok.ok).toBe(true)
    expect(ok.input.payload).toEqual({ options: { a: '虾', b: '鱼', c: '蟹', d: '贝' }, correct: ['a', 'c'] })
    expect(ok.input.reward_amount).toBe('8')
    expect(Object.keys(ok.input)).toEqual([...SUBTASK_KEYS, 'reward_amount'])

    // 空选项（任一格）⇒ quiz 拒发
    expect(buildSubtaskInput({ ...base, quizC: '   ' })).toEqual({ ok: false, error: 'quiz' })
    // 全不选正确项 ⇒ 拒发
    expect(buildSubtaskInput({ ...base, quizCorrect: [] })).toEqual({ ok: false, error: 'quiz' })
    // 奖励 0 / 空 / 非正整数 ⇒ 拒发（服务端不发奖，前端零请求）
    expect(buildSubtaskInput({ ...base, quizReward: '0' })).toEqual({ ok: false, error: 'reward' })
    expect(buildSubtaskInput({ ...base, quizReward: '' })).toEqual({ ok: false, error: 'reward' })
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

  it('★ 存量 prediction 行（读口剥文案 ⇒ option_style=ab_legacy）整组追加时**跳过**：组内只剩新行、载荷不含旧行', () => {
    // 读口出参：存量四键行的 option_a/option_b 已被剥掉，只剩两键 + 加性 option_style
    const legacyStripped = {
      subtask_id: 903, task_id: 555, type_code: 'prediction', title: '谁会赢', content: null,
      payload: { prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' },
      sort: 3, required: false, prediction_state: 'open', option_style: 'ab_legacy',
    }
    // 新两键行（明确 yes_no）⇒ 可安全重发，仍在组内
    const current = {
      subtask_id: 904, task_id: 555, type_code: 'prediction', title: '新预测', content: null,
      payload: { prize_amount: '20', deadline: '2026-12-01T00:00:00.000Z' },
      sort: 4, required: false, prediction_state: 'open', option_style: 'yes_no',
    }
    const grouped = buildSubtaskAppendGroup([...subtasks(), legacyStripped, current], newInput)
    expect(grouped.ok).toBe(true)
    expect(grouped.skipped).toEqual(['903'])
    expect(grouped.group.map((row) => row.subtask_id ?? 'new')).toEqual(['901', '902', '904', 'new'])
    expect(grouped.group.at(-1)).toEqual(newInput)
    // 载荷里**没有**存量行（否则服务端 400 换口径 / active task 先 409 发布后锁）
    expect(JSON.stringify(grouped.group)).not.toContain('903')
    expect(grouped.group.some((row) => 'option_a' in (row.payload || {}))).toBe(false)
  })

  it('负控：新行缺失 / 非对象 ⇒ 组不成立，调用方不得发 PATCH', () => {
    expect(buildSubtaskAppendGroup(subtasks(), null)).toEqual({ ok: false, error: 'subtask' })
    expect(buildSubtaskAppendGroup(subtasks(), 'x')).toEqual({ ok: false, error: 'subtask' })
  })

  it('toExistingSubtaskInput：空 payload（四类非 prediction）原样回送；prediction/quiz 缺键 ⇒ 跳过', () => {
    expect(toExistingSubtaskInput({
      subtask_id: 905, type_code: 'x_verify', title: '旧验证行', content: '', payload: {}, sort: 6, required: true,
    })).toEqual({
      subtask_id: '905', type_code: 'x_verify', title: '旧验证行', content: null, payload: {}, sort: 6, required: true,
    })
    expect(toExistingSubtaskInput({
      subtask_id: 906, type_code: 'prediction', title: '缺键', content: null, payload: { option_a: 'A' }, sort: 7, required: false,
    })).toBeNull()
    // 旧四键 prediction 行（payload 自带两枚文案）仍可原样回送（兼容）——口径可复现
    expect(toExistingSubtaskInput({
      subtask_id: 907, type_code: 'prediction', title: '旧四键', content: null, sort: 8, required: false,
      payload: { option_a: 'A', option_b: 'B', prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' },
    }).payload).toEqual({ option_a: 'A', option_b: 'B', prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' })
    // ★ 存量四键行**被读口剥掉文案**（只剩两键 + 加性 option_style='ab_legacy'）⇒ 跳过：
    //   重发两键会被服务端判「换口径」⇒ 400 PREDICTION_OPTION_STYLE_IMMUTABLE（active task 先撞 409）
    expect(toExistingSubtaskInput({
      subtask_id: 908, type_code: 'prediction', title: '存量剥文案', content: null, sort: 9, required: false,
      option_style: 'ab_legacy',
      payload: { prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' },
    })).toBeNull()
    // 两键形状但**未声明口径** ⇒ 无法排除「被剥文案的存量行」⇒ 同样跳过
    expect(toExistingSubtaskInput({
      subtask_id: 911, type_code: 'prediction', title: '未声明', content: null, sort: 12, required: false,
      payload: { prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' },
    })).toBeNull()
    // 明确声明 yes_no 的新两键行 ⇒ 原样回送（重发值恒等 ⇒ 服务端不判「改」，不会 409）
    expect(toExistingSubtaskInput({
      subtask_id: 912, type_code: 'prediction', title: '新两键', content: null, sort: 13, required: false,
      option_style: 'yes_no',
      payload: { prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' },
    }).payload).toEqual({ prize_amount: '10', deadline: '2026-12-01T00:00:00.000Z' })
    // quiz：公开读口不吐 correct ⇒ 缺正确项不可重发（否则会抹掉答案键）；带齐才回送 + reward_amount
    expect(toExistingSubtaskInput({
      subtask_id: 909, type_code: 'quiz', title: '公开读回', content: null, sort: 10, required: true,
      payload: { options: { a: '1', b: '2', c: '3', d: '4' } }, reward_amount: '5',
    })).toBeNull()
    expect(toExistingSubtaskInput({
      subtask_id: 910, type_code: 'quiz', title: '带答案', content: null, sort: 11, required: true,
      payload: { options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['b'] }, reward_amount: '5',
    })).toEqual({
      subtask_id: '910', type_code: 'quiz', title: '带答案', content: null,
      payload: { options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['b'] },
      sort: 11, required: true, reward_amount: '5',
    })
  })
})

// ---------------------------------------------------------------------------
// ③ 概况层：活动名链 `/campaign/:ref` + 任务摘要行链 `/task/:taskId`（零操作钮、零子任务清单）
// ---------------------------------------------------------------------------
describe('③ 概况层：活动行 + 任务摘要行（一行一条），空态文案在场', () => {
  const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)

  it('概况层逐行渲染（活动链 / 活动徽标 / 任务链 / 任务徽标 / 完成奖）且零操作元素、零子任务清单', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={viewOf().campaigns} t={t} lang="zh" />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('[data-sf-m="project-campaign"]')).toHaveLength(1)
    expect(container.querySelector('[data-sf-m="project-campaign-link"]').getAttribute('href')).toBe('/campaign/501')
    expect(container.querySelector('[data-sf-m="project-campaign-status"]').getAttribute('data-sf-state')).toBe('active')
    // 任务摘要行：一行一条，标题链 `/task/:taskId` + 状态徽标 + 完成奖 `$`
    expect(container.querySelectorAll('[data-sf-m="project-task-row"]')).toHaveLength(1)
    expect(container.querySelector('[data-sf-m="project-task-link"]').getAttribute('href')).toBe('/task/555')
    expect(container.querySelector('[data-sf-m="project-task-row-status"]').getAttribute('data-sf-state')).toBe('active')
    expect(container.querySelector('[data-sf-m="project-task-row-reward"]').getAttribute('data-sf-amount')).toBe('5')
    // 概况层硬口径：**不渲染**子任务清单与任何操作钮（操作主场在 `/campaign/:ref`）
    expect(container.querySelectorAll('[data-sf-m="project-subtask"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m^="project-campaign-entry-"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m^="project-task-entry-"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-task-status-toggle"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-subtask-edit"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-subtask-delete"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m^="project-form-"]')).toHaveLength(0)
  })

  it('空态：无活动 ⇒ campaignsEmpty；活动无任务 ⇒ tasksEmpty（子任务清单不再渲染，无第三态）', () => {
    const empty = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={[]} t={t} lang="zh" />
      </MemoryRouter>,
    )
    expect(empty.container.querySelector('[data-sf-m="project-campaigns-empty"]').textContent).toBe('project.campaignsEmpty')
    empty.unmount()

    const view = viewOf()
    view.campaigns[0].tasks = []
    const noTask = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProjectNestedList campaigns={view.campaigns} t={t} lang="zh" />
      </MemoryRouter>,
    )
    expect(noTask.container.querySelector('[data-sf-m="project-tasks-empty"]').textContent).toBe('campaign.tasksEmpty')
    expect(noTask.container.querySelectorAll('[data-sf-m="project-task-row"]')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// ④ 操作区只剩项目级两入口（【编辑项目】/【发布活动】）；任务 / 子任务操作元素零渲染
// ---------------------------------------------------------------------------
describe('④ 操作区 = 【编辑项目】+【发布活动】；任务/子任务操作元素零渲染（迁 /campaign/:ref）', () => {
  it('owner：顶部恰 2 个入口（编辑 / 发布活动）；五类任务操作元素全仓 0（概况层零写口）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: campaignsTwo() }))
    const { container } = renderAt('/sui')
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-manage"]')).not.toBeNull())

    // ① 顶部操作区 = 【编辑项目】+【发布活动】两枚（项目级操作留本页）
    const topEntries = [...container.querySelectorAll('[data-sf-m="project-manage"] [data-sf-m^="project-entry-"]')]
    expect(topEntries).toHaveLength(2)
    expect(topEntries.map((el) => el.getAttribute('data-sf-m')))
      .toEqual(['project-entry-edit', 'project-entry-campaign'])

    // ② 概况层在场：2 张活动卡（各链 /campaign/:ref）+ 2 条任务摘要行（各链 /task/:taskId）
    const links = [...container.querySelectorAll('[data-sf-m="project-campaign-link"]')].map((el) => el.getAttribute('href'))
    expect(links).toEqual(['/campaign/501', '/campaign/502'])
    const taskLinks = [...container.querySelectorAll('[data-sf-m="project-task-link"]')].map((el) => el.getAttribute('href'))
    expect(taskLinks).toEqual(['/task/555', '/task/556'])

    // ③ 迁走的五类操作元素一律 0（发布任务 / 发布子任务 / 上下线 / 行编辑 / 行删除）
    expect(container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-task-status-toggle"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-subtask-edit"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="project-subtask-delete"]')).toHaveLength(0)

    // 默认零表单（操作区只有【发布活动】面板，且不预开）
    expect(container.querySelector('[data-sf-m="project-form-task"]')).toBeNull()
    expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull()
  })

  it('普通用户（非 owner ∧ 无 manage_tasks）：操作区整块不渲染、概况层照常、零表单', async () => {
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
    // 概况层对普通用户照常（只读）
    expect(container.querySelectorAll('[data-sf-m="project-task-row"]')).toHaveLength(1)
  })

  it('无活动 ⇒ campaignsEmpty，顶部【发布活动】仍在（owner 可先建活动；零写请求）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ campaigns: [] }))
    const empty = renderAt('/sui')
    await waitFor(() => expect(empty.container.querySelector('[data-sf-m="project-campaigns-empty"]')).not.toBeNull())
    expect(empty.container.querySelectorAll('[data-sf-m="project-campaign"]')).toHaveLength(0)
    expect(empty.container.querySelectorAll('[data-sf-m="project-task-row"]')).toHaveLength(0)
    expect(empty.container.querySelectorAll('[data-sf-m="project-campaign-entry-task"]')).toHaveLength(0)
    expect(empty.container.querySelectorAll('[data-sf-m="project-task-entry-subtask"]')).toHaveLength(0)
    // 顶部【发布活动】仍在（owner 可先建活动）
    expect(empty.container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull()
    expect(API.createProjectCampaignTask).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// ⑤ 【发布活动】表单（项目页唯一留存的写口）：POST 载荷五键 / 立即上线二次 PATCH
//    （【发布任务】/【发布子任务】的表单断言已迁 `campaign-task-manage.test.jsx`，
//      挂载点换成 `/campaign/:ref`，锁定语义与载荷闭集不放宽。）
// ---------------------------------------------------------------------------
describe('⑤ 表单：【发布活动】（存草稿 / 立即上线）—— 载荷与 PATCH 对拍', () => {
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
})
