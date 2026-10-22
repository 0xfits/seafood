/**
 * 子任务行级【编辑】【删除】（Kevin 2026-10-22）
 *
 * ★ Kevin 2026-10-22：任务/子任务全部操作入口迁 `/campaign/:ref`（项目页概况层零操作钮）
 *   ⇒ 本文件挂载点自项目页 `ProjectNestedList` 迁至 `CampaignDetailPage`（新主场整页渲染，
 *   行级管理面 = `task-manage/SubtaskManage`），断言契约**逐条原样保留**（预填 / 载荷键闭集 /
 *   行内二次确认 / 409 就地内联），仅标注与探针随迁：
 *   · `project-subtask-*` → `campaign-subtask-*`（行 / 编辑 / 删除 / 确认 / 锁定 / 行内错误）；
 *   · 行 `data-sf-editing` 探针 → 编辑钮 `aria-expanded`（同一状态机的新探针）；
 *   · 页面层回调 `onDone` → 页内结论 `campaign-manage-notice` + 静默重读取证；
 *   · 「零请求」探针 = 调用数计数器前后对拍（页面自身的读口不计入）。
 *
 * 覆盖面（四臂；全部走真实 `project-api` → 只把最底层出口 `fetchApiJson` 换成按 URL 路由的 spy
 * ⇒「URL / 方法 / body 闭集」是**整链**取证，不是 mock 掉 API 层后的空断言）：
 *   ① 编辑预填：点【编辑】⇒ 行内切 `ProjectForms` 编辑态（`data-sf-mode="edit"`），
 *      title / content / 奖池 / 截止时间（ISO → `datetime-local` 本地串）/ 必做 / 排序**全部预填**；
 *      改标题提交 ⇒ `PATCH /api/campaign/task/:id`，body 恰 `{subtasks:[{subtask_id, 六键}]}`
 *      （**只送被改的那一条**，键集 = `SUBTASK_EDIT_KEYS`）；存量四键 prediction 行**保持原口径**
 *      回送 `option_a/option_b`（展示恒 Yes/No，口径不得改写）；成功 ⇒ `project.subtaskSaved` + 收表单。
 *   ② prediction 非 draft ⇒ **无【编辑】钮**，只留 `project.predictionLocked` 一句（服务端 409
 *      `prediction_locked_after_publish`）；已结算（payload 带 `correct_option`）的 draft 行同理。
 *      非 prediction 类型的行不受此锁（仍可编辑）。
 *   ③ 删除 = **行内二次确认**（不弹窗）：点【删除】只切确认态、**零请求**；【取消】回到原态、仍零请求；
 *      确认 ⇒ `PATCH` body 恰 `{"subtasks_remove":[id]}`（数字主键数组）+ 页内结论
 *      `project.subtaskDeleted`（行消失以读口重读为准，不在本地伪造）。
 *   ④ 409 两码**就地内联**、不谎报成功：删除遇 `subtask_has_proofs` ⇒ 行内 `project.hasProofs`；
 *      编辑遇 `prediction_locked_after_publish` ⇒ 表单内 `project.predictionLocked`；两条都不给页内结论。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 键回显的 t：断言里直接比键名（文案真源在 locale，四语齐备由 s8 门把关）。
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 最底层出口 = fetchApiJson（auth.js）。只换这一个 ⇒ project-api 的 URL / 方法 / body 全链现取
// （spy 按 URL 路由：GET 读口 / PATCH 写口各归各，写口行为测试内注入）。
const NET = vi.hoisted(() => ({ fetchApiJson: vi.fn(), getAuthHeaders: vi.fn(() => ({})) }))
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchApiJson: NET.fetchApiJson, getAuthHeaders: NET.getAuthHeaders }
})

const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import CampaignDetailPage from '../../pages/campaign/CampaignDetailPage'
import { SUBTASK_EDIT_KEYS } from '../../pages/project/project-payload'

// --------------------------------------------------------------------------- fixtures
// 固定**本地**时刻 ⇒ `datetime-local` 串与时区无关（2026-11-05 09:30 本地）
const DEADLINE_LOCAL = '2026-11-05T09:30'
const DEADLINE_MS = new Date(2026, 10, 5, 9, 30).getTime()
const DEADLINE_ISO = new Date(DEADLINE_MS).toISOString()

/** 存量四键 prediction 行（payload 恰四键 ⇒ 服务端口径 `ab_legacy`，票面值 a/b）。 */
const predictionRow = (patch = {}) => ({
  subtask_id: 5011,
  task_id: 555,
  type_code: 'prediction',
  type_label: '预测',
  title: '谁会赢',
  content: '本场海鲜擂台赛',
  payload: { option_a: '甲队', option_b: '乙队', prize_amount: '100', deadline: DEADLINE_ISO },
  sort: 4,
  required: true,
  prediction_state: 'open',
  ...patch,
})

const verifyRow = (patch = {}) => ({
  subtask_id: 5012,
  task_id: 555,
  type_code: 'x_verify',
  type_label: 'X 验证',
  title: '转发推文',
  content: '转发并附链接',
  payload: { url: 'https://x.com/a/status/1' },
  sort: 1,
  required: false,
  ...patch,
})

const taskOf = (patch = {}) => ({
  task_id: 555,
  campaign_id: 501,
  title: '主任务',
  description: '转发并截图',
  status: 'draft',
  sort: 1,
  time_start: null,
  time_end: null,
  reward_amount_primary: '5',
  reward_cid_secondary: null,
  reward_amount_secondary: null,
  subtasks: [],
  ...patch,
})

const campaignOf = (patch = {}) => ({
  campaign_id: 501,
  snowflake_id: '70501',
  project_id: '11',
  title: '秋季招募',
  description: '活动说明',
  status: 'active',
  time_start: '2026-10-01T00:00:00.000Z',
  time_end: '2026-10-31T00:00:00.000Z',
  tasks: [taskOf()],
  ...patch,
})

const projectRow = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: 7,
  avatar_url: null,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [campaignOf()],
  ...patch,
})

// --------------------------------------------------------------------------- NET 路由
// `fetchApiJson` 被整替 ⇒ 返回值即 API 层拿到的解包后数据（success 信封在本出口内，一并被替）。
const NET_STATE = { campaign: null, project: null, taskPatch: null }

/** 该 URL（可选按 method 过滤）的整链调用清单。 */
const netCalls = (url, method) => NET.fetchApiJson.mock.calls.filter(([u, o = {}]) =>
  u === url && (method ? o.method === method : !o.method))

const netWriteCalls = () => NET.fetchApiJson.mock.calls.filter(([, o = {}]) =>
  ['POST', 'PATCH', 'PUT', 'DELETE'].includes(o.method))

beforeEach(() => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  NET.getAuthHeaders.mockClear()
  NET_STATE.campaign = campaignOf()
  NET_STATE.project = projectRow()
  NET_STATE.taskPatch = null
  NET.fetchApiJson.mockImplementation((url, options = {}) => {
    if (url === '/api/currencies') return Promise.resolve([])
    if (url === '/api/campaign/501') return Promise.resolve(NET_STATE.campaign)
    if (url.startsWith('/api/project/')) return Promise.resolve(NET_STATE.project)
    if (url === '/api/campaign/task/555' && options.method === 'PATCH') {
      const behavior = NET_STATE.taskPatch
      if (typeof behavior === 'function') return Promise.resolve().then(() => behavior(options))
      return Promise.resolve(behavior ?? {})
    }
    return Promise.reject(Object.assign(new Error(`no net route: ${url}`), { status: 404 }))
  })
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
})

afterEach(cleanup)

// --------------------------------------------------------------------------- 探针
const renderCampaign = (ref = '501') => render(
  <MemoryRouter initialEntries={[`/campaign/${ref}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/campaign/:ref" element={<CampaignDetailPage />} />
    </Routes>
  </MemoryRouter>,
)

const rowOf = (container, id) => container.querySelector(`[data-sf-m="campaign-subtask"][data-sf-subtask="${id}"]`)
const editBtn = (container, id) => container.querySelector(`[data-sf-m="campaign-subtask-edit"][data-sf-subtask="${id}"]`)
const deleteBtn = (container, id) => container.querySelector(`[data-sf-m="campaign-subtask-delete"][data-sf-subtask="${id}"]`)
const confirmBtn = (container, id) => container.querySelector(`[data-sf-m="campaign-subtask-confirm"][data-sf-subtask="${id}"]`)
const fieldOf = (container, name) => container.querySelector(`[data-sf-m="project-form-subtask"] [data-sf-field="${name}"]`)
const pageNotice = (container) => container.querySelector('[data-sf-m="campaign-manage-notice"]')

// ============================================================================
describe('① 编辑：预填 + 载荷含 subtask_id（只送被改的那一条）', () => {
  it('点【编辑】⇒ 行内编辑态全字段预填（截止时间 ISO → datetime-local 本地串）', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [predictionRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(rowOf(container, 5011)).not.toBeNull())
    expect(editBtn(container, 5011).getAttribute('aria-expanded')).toBe('false')

    const callsBefore = NET.fetchApiJson.mock.calls.length
    fireEvent.click(editBtn(container, 5011))

    await waitFor(() => expect(editBtn(container, 5011).getAttribute('aria-expanded')).toBe('true'))
    const form = container.querySelector('[data-sf-m="project-form-subtask"]')
    expect(form).not.toBeNull()
    expect(form.getAttribute('data-sf-mode')).toBe('edit')
    // 预填：标题 / 内容 / 奖池 / 截止 / 必做 / 排序
    expect(fieldOf(container, 'title').value).toBe('谁会赢')
    expect(fieldOf(container, 'content').value).toBe('本场海鲜擂台赛')
    expect(fieldOf(container, 'type').value).toBe('prediction')
    expect(fieldOf(container, 'prize').value).toBe('100')
    expect(fieldOf(container, 'deadline').value).toBe(DEADLINE_LOCAL)
    expect(fieldOf(container, 'required').checked).toBe(true)
    expect(fieldOf(container, 'sort').value).toBe('4')
    // 选项固定 Yes/No 只展示（编辑态也不给改写入口）
    const fixed = [...container.querySelectorAll('[data-sf-m="project-prediction-choices"] [data-sf-choice]')]
    expect(fixed.map((n) => n.getAttribute('data-sf-choice'))).toEqual(['yes', 'no'])
    // 按钮文案 = 「保存修改」
    expect(container.querySelector('[data-sf-m="project-form-submit"]').textContent).toBe('project.subtaskSave')
    // 零请求（只是打开编辑器；页面自身读口不计）
    expect(NET.fetchApiJson.mock.calls.length).toBe(callsBefore)
  })

  it('改标题提交 ⇒ body 恒 {subtasks:[{subtask_id + 六键}]}，存量四键 prediction 口径原样回送', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [predictionRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(editBtn(container, 5011)).not.toBeNull())

    fireEvent.click(editBtn(container, 5011))
    await waitFor(() => expect(fieldOf(container, 'title')).not.toBeNull())
    fireEvent.change(fieldOf(container, 'title'), { target: { value: '谁会赢（改）' } })
    fireEvent.submit(container.querySelector('[data-sf-m="project-form-subtask"]'))

    await waitFor(() => expect(netCalls('/api/campaign/task/555', 'PATCH')).toHaveLength(1))
    const [url, options] = netCalls('/api/campaign/task/555', 'PATCH')[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(options.method).toBe('PATCH')
    const body = JSON.parse(options.body)
    expect(Object.keys(body)).toEqual(['subtasks'])
    expect(body.subtasks).toHaveLength(1) // 只送被改的那一条（不整组重发）
    const input = body.subtasks[0]
    expect(Object.keys(input)).toEqual(SUBTASK_EDIT_KEYS) // subtask_id + 六键闭集，多一键即负
    expect(input.subtask_id).toBe('5011') // upsert 键；后端 `SubtaskInput.subtask_id: string`（读口同形）
    expect(input.title).toBe('谁会赢（改）')
    expect(input.content).toBe('本场海鲜擂台赛')
    expect(input.type_code).toBe('prediction')
    expect(input.sort).toBe(4)
    expect(input.required).toBe(true)
    // 存量四键行：口径不可改写 ⇒ 选项原文原样回送（换口径服务端 400）
    expect(input.payload).toEqual({
      option_a: '甲队', option_b: '乙队', prize_amount: '100', deadline: DEADLINE_ISO,
    })

    // 成功 ⇒ 页内结论 project.subtaskSaved + 静默重读（详情读口 ≥ 2 次）
    await waitFor(() => expect(pageNotice(container).textContent).toBe('project.subtaskSaved'))
    expect(netCalls('/api/campaign/501').length).toBeGreaterThanOrEqual(2)
    // 成功 ⇒ 收表单（行内编辑态关闭）
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull())
  })

  it('同一行再点【编辑】= 收起（不发请求）', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [verifyRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(editBtn(container, 5012)).not.toBeNull())

    fireEvent.click(editBtn(container, 5012))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())
    // 非 prediction ⇒ 无固定选项块
    expect(container.querySelector('[data-sf-m="project-prediction-choices"]')).toBeNull()
    const callsBefore = NET.fetchApiJson.mock.calls.length
    fireEvent.click(editBtn(container, 5012))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull())
    expect(editBtn(container, 5012).getAttribute('aria-expanded')).toBe('false')
    expect(NET.fetchApiJson.mock.calls.length).toBe(callsBefore)
  })
})

// ============================================================================
describe('② prediction 发布后（父 task 非 draft）⇒ 无【编辑】钮', () => {
  it('task active + prediction ⇒ 只有锁定说明，零编辑钮；删除仍可用', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'active', subtasks: [predictionRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(rowOf(container, 5011)).not.toBeNull())
    expect(editBtn(container, 5011)).toBeNull()
    const locked = rowOf(container, 5011).querySelector('[data-sf-m="campaign-subtask-locked"]')
    expect(locked).not.toBeNull()
    expect(locked.textContent).toBe('project.predictionLocked')
    // 删除不受此锁（服务端只在「有凭证」时拒）
    expect(deleteBtn(container, 5011)).not.toBeNull()
  })

  it('已结算（payload 带 correct_option）的 draft 行同样无【编辑】钮', async () => {
    const settled = predictionRow({ payload: { ...predictionRow().payload, correct_option: 'a' } })
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [settled] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(rowOf(container, 5011)).not.toBeNull())
    expect(editBtn(container, 5011)).toBeNull()
    expect(rowOf(container, 5011).querySelector('[data-sf-m="campaign-subtask-locked"]')).not.toBeNull()
  })

  it('非 prediction 类型在 active task 下仍可编辑（锁只针对 prediction）', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'active', subtasks: [verifyRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(rowOf(container, 5012)).not.toBeNull())
    expect(editBtn(container, 5012)).not.toBeNull()
    expect(rowOf(container, 5012).querySelector('[data-sf-m="campaign-subtask-locked"]')).toBeNull()
  })

  it('非 owner / 非管理员 ⇒ 行级动作零钮（只读可见）', async () => {
    NET_STATE.project = projectRow({ owner_uid: 99 })
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [verifyRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(rowOf(container, 5012)).not.toBeNull())
    expect(container.querySelector('[data-sf-m="campaign-subtask-actions"]')).toBeNull()
    expect(editBtn(container, 5012)).toBeNull()
    expect(deleteBtn(container, 5012)).toBeNull()
    // 只读面原样：类型徽标 + 标题
    expect(rowOf(container, 5012).textContent).toContain('转发推文')
  })
})

// ============================================================================
describe('③ 删除：行内二次确认 + subtasks_remove 载荷', () => {
  it('点【删除】只切确认态（零请求）；【取消】回原态（仍零请求）', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [verifyRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(deleteBtn(container, 5012)).not.toBeNull())

    const callsBefore = NET.fetchApiJson.mock.calls.length
    fireEvent.click(deleteBtn(container, 5012))
    await waitFor(() => expect(confirmBtn(container, 5012)).not.toBeNull())
    expect(container.querySelector('[data-sf-m="campaign-subtask-confirm-text"]').textContent).toBe('project.confirmDelete')
    expect(confirmBtn(container, 5012).textContent).toBe('project.subtaskDelete')
    expect(NET.fetchApiJson.mock.calls.length).toBe(callsBefore)

    fireEvent.click(container.querySelector('[data-sf-m="campaign-subtask-cancel"]'))
    await waitFor(() => expect(confirmBtn(container, 5012)).toBeNull())
    expect(deleteBtn(container, 5012)).not.toBeNull()
    expect(NET.fetchApiJson.mock.calls.length).toBe(callsBefore)
  })

  it('确认 ⇒ PATCH body 恰 {"subtasks_remove":[id]} + 页内结论（行消失以读口为准）', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [verifyRow()] })] })
    const { container } = renderCampaign()
    await waitFor(() => expect(deleteBtn(container, 5012)).not.toBeNull())

    fireEvent.click(deleteBtn(container, 5012))
    await waitFor(() => expect(confirmBtn(container, 5012)).not.toBeNull())
    fireEvent.click(confirmBtn(container, 5012))

    await waitFor(() => expect(netCalls('/api/campaign/task/555', 'PATCH')).toHaveLength(1))
    const [url, options] = netCalls('/api/campaign/task/555', 'PATCH')[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ subtasks_remove: [5012] })
    expect(Object.keys(JSON.parse(options.body))).toEqual(['subtasks_remove']) // 不夹带 subtasks / 整组

    // 成功 ⇒ 页内结论 project.subtaskDeleted（静默重读 ⇒ 行消失以读口为准）
    await waitFor(() => expect(pageNotice(container).textContent).toBe('project.subtaskDeleted'))
    expect(netCalls('/api/campaign/501').length).toBeGreaterThanOrEqual(2)
    // 确认态收起；行仍在 DOM（页面层静默重读后才消失，不本地伪造）
    await waitFor(() => expect(confirmBtn(container, 5012)).toBeNull())
    expect(rowOf(container, 5012)).not.toBeNull()
  })
})

// ============================================================================
describe('④ 409 两码就地内联（不谎报成功）', () => {
  it('删除遇 subtask_has_proofs ⇒ 行内 project.hasProofs，不给页内结论', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [verifyRow()] })] })
    NET_STATE.taskPatch = () => {
      const error = new Error('has proofs')
      error.code = 'subtask_has_proofs'
      error.status = 409
      error.details = { reason: 'subtask_has_proofs' }
      throw error
    }
    const { container } = renderCampaign()
    await waitFor(() => expect(deleteBtn(container, 5012)).not.toBeNull())

    fireEvent.click(deleteBtn(container, 5012))
    await waitFor(() => expect(confirmBtn(container, 5012)).not.toBeNull())
    fireEvent.click(confirmBtn(container, 5012))

    await waitFor(() => {
      const err = rowOf(container, 5012).querySelector('[data-sf-m="campaign-subtask-err"]')
      expect(err).not.toBeNull()
      // 删除失败带具体因由 + HTTP（原「只落 project.hasProofs」已退役）
      expect(err.textContent).toBe('project.deleteFailDetail:{"detail":"project.hasProofs","status":409}')
      expect(err.getAttribute('data-sf-err-code')).toBe('subtask_has_proofs')
      expect(err.getAttribute('role')).toBe('alert')
    })
    // 不谎报成功：页内无结论
    expect(pageNotice(container)).toBeNull()
    // 行仍在、删除入口回到可点态（不谎报已删）
    expect(rowOf(container, 5012)).not.toBeNull()
    expect(deleteBtn(container, 5012)).not.toBeNull()
  })

  it('编辑遇 prediction_locked_after_publish ⇒ 表单内 project.predictionLocked，不给页内结论', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'draft', subtasks: [predictionRow()] })] })
    NET_STATE.taskPatch = () => {
      const error = new Error('locked')
      error.code = 'prediction_locked_after_publish'
      error.status = 409
      throw error
    }
    const { container } = renderCampaign()
    await waitFor(() => expect(editBtn(container, 5011)).not.toBeNull())

    fireEvent.click(editBtn(container, 5011))
    await waitFor(() => expect(fieldOf(container, 'title')).not.toBeNull())
    fireEvent.change(fieldOf(container, 'title'), { target: { value: '改不动' } })
    fireEvent.submit(container.querySelector('[data-sf-m="project-form-subtask"]'))

    await waitFor(() => {
      const notice = container.querySelector('[data-sf-m="project-form-notice"]')
      expect(notice).not.toBeNull()
      // 编辑失败带具体因由 + HTTP（原「只落 project.predictionLocked」已退役）
      expect(notice.textContent).toBe('project.failDetail:{"detail":"project.predictionLocked","status":409}')
      expect(notice.getAttribute('data-sf-err-code')).toBe('prediction_locked_after_publish')
      expect(notice.getAttribute('data-sf-err-reason')).toBe('')
    })
    // 不谎报成功：页内无结论
    expect(pageNotice(container)).toBeNull()
    // 表单不关（保留用户输入，可就地重试）
    expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull()
    expect(fieldOf(container, 'title').value).toBe('改不动')
  })
})
