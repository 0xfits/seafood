/**
 * 写口失败 · **可定位内联**（Kevin 2026-10-22）
 *
 * 背景：`PATCH /api/campaign/task/:taskId` 的错误体形如
 *   `{ error: { code, message, i18n_key, details: { reason, ... } } }`，
 *   三个表单与子任务行原先一律只落 `project.publishFailed`（「发布失败，请稍后重试。」）
 *   ⇒ 页面看不出是哪条闸拦住（409 发布后锁 / 400 换口径 / 409 有凭证 / 403 无权限）。
 *
 * ★ Kevin 2026-10-22：任务/子任务操作入口迁 `/campaign/:ref` ⇒ ②③④ 的真实渲染臂
 *   挂载点自项目页 `ProjectNestedList` 迁至 `CampaignDetailPage`（断言契约逐条原样保留，
 *   仅探针随迁：`project-task-status-err` → `campaign-task-status-err`、
 *   `project-subtask-delete/confirm/err` → `campaign-subtask-*`；【发布子任务】表单本体
 *   仍是 `ProjectForms`，`project-form-*` 钩子名原样）。①为纯函数臂，与挂载点无关。
 *
 * 本文件钉死四件事：
 *   ① `writeFailNotice` 把 `{code, details.reason, status}` 拼进文案（模板 `project.failDetail` /
 *      `project.deleteFailDetail`，形如「发布失败：<reason 文案 或 code>（HTTP <n>）」）；
 *   ② 常见 reason 有中文映射（owner / 发布后锁 / 有凭证 / quiz 两码 / 子任务三码），
 *      **未知 reason 回退到 code**（机读码比假翻译有用）；
 *   ③ 无错误体（网络断 / 无 code 且无 reason / 无 HTTP 状态）⇒ 保留原文案 `project.publishFailed`；
 *   ④ 真实渲染：表单 / 行内提示带上 `data-sf-err-code` / `data-sf-err-reason` / `data-sf-err-status`（探针取证）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WRITE_REASON_TEXT_KEYS,
  errPartsOf,
  reasonTextOf,
  writeFailNotice,
} from '../../pages/project/project-error'

// 键回显 t：断言里直接比键名 + 插值（文案真源在 locale，四语齐备由 s8 键集门把关）
const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 最底层出口 = fetchApiJson（auth.js）。只换这一个 ⇒ campaign-api / project-api 的
// URL / 方法 / body 全链现取（spy 按 URL 路由，GET / PATCH 各归各）。
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

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') // = frontend/src
const zhTable = JSON.parse(fs.readFileSync(path.join(SRC, 'locales/zh.json'), 'utf8'))

/** 真 zh 表 t（只做 `{{x}}` 插值）⇒ 断言「用户实际看到的句子」。 */
const zhT = (key, values) => {
  const value = key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), zhTable)
  if (typeof value !== 'string') return key
  if (!values) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''))
}

// ---------------------------------------------------------------------------
describe('① writeFailNotice：code / details.reason / HTTP 状态 → 文案 + 取证字段', () => {
  it('映射的 reason ⇒ 中文因由进文案（模板 + HTTP）；code / reason / status 三件齐备', () => {
    const error = Object.assign(new Error('nope'), {
      code: 'SUBTASK_NOT_FOUND',
      status: 404,
      details: { reason: 'subtask_not_in_task' },
    })
    const notice = writeFailNotice(error, t)
    expect(notice).toEqual({
      text: 'project.failDetail:{"detail":"project.reasonSubtaskNotInTask","status":404}',
      code: 'SUBTASK_NOT_FOUND',
      reason: 'subtask_not_in_task',
      status: 404,
    })
  })

  it('未知 reason ⇒ **回退到机读 code**（不臆造翻译）；reason 仍留在取证字段', () => {
    const error = Object.assign(new Error('style'), {
      code: 'PREDICTION_OPTION_STYLE_IMMUTABLE',
      status: 400,
      details: { reason: 'some_new_gate' },
    })
    const notice = writeFailNotice(error, t)
    expect(notice.text).toBe('project.failDetail:{"detail":"PREDICTION_OPTION_STYLE_IMMUTABLE","status":400}')
    expect(notice.reason).toBe('some_new_gate')
  })

  it('只有 reason、没有 code ⇒ 用 reason 的映射文案', () => {
    const notice = writeFailNotice({ status: 409, details: { reason: 'subtask_has_proofs' } }, t)
    expect(notice.text).toBe('project.failDetail:{"detail":"project.hasProofs","status":409}')
  })

  it('删除动作走自己的模板（删除失败：…）', () => {
    const notice = writeFailNotice({ code: 'subtask_has_proofs', status: 409 }, t, 'project.deleteFailDetail')
    expect(notice.text).toBe('project.deleteFailDetail:{"detail":"project.hasProofs","status":409}')
  })

  it('嵌套错误体（`{error:{code,details}}`）同样能读', () => {
    expect(errPartsOf({
      status: 403,
      error: { code: 'FORBIDDEN', details: { reason: 'project_owner_required' } },
    })).toEqual({ code: 'FORBIDDEN', reason: 'project_owner_required', status: 403 })
  })

  it('无错误体（网络断 / 无 code 无 reason / 无 HTTP 状态）⇒ 保留原文案', () => {
    expect(writeFailNotice(new Error('Failed to fetch'), t)).toEqual({
      text: 'project.publishFailed', code: '', reason: '', status: null,
    })
    expect(writeFailNotice(null, t)).toEqual({
      text: 'project.publishFailed', code: '', reason: '', status: null,
    })
    // 有 code 但无 HTTP 状态 ⇒ 不硬编「HTTP 0」这种假事实
    expect(writeFailNotice({ code: 'SUBTASK_INPUT_INVALID' }, t)).toEqual({
      text: 'project.publishFailed', code: 'SUBTASK_INPUT_INVALID', reason: '', status: null,
    })
  })

  it('常见 reason 全部登记了中文映射键（八枚；四语由 s8 键集门把关）', () => {
    expect(Object.keys(WRITE_REASON_TEXT_KEYS).sort()).toEqual([
      'QUIZ_OPTIONS_INVALID',
      'QUIZ_REWARD_REQUIRED',
      'SUBTASK_INPUT_INVALID',
      'SUBTASK_REMOVE_OVERLAP',
      'prediction_locked_after_publish',
      'project_owner_required',
      'subtask_has_proofs',
      'subtask_not_in_task',
    ])
    expect(reasonTextOf('unknown_reason', t)).toBe('')
  })

  it('真 zh 表：用户看到的是「发布失败：<因由>（HTTP <n>）」', () => {
    const notice = writeFailNotice(
      { code: 'QUIZ_REWARD_REQUIRED', status: 400, details: { reason: 'QUIZ_REWARD_REQUIRED' } },
      zhT,
    )
    expect(notice.text).toBe('发布失败：答题奖励必填（需大于 0）（HTTP 400）')
    const ownerNotice = writeFailNotice(
      { code: 'FORBIDDEN', status: 403, details: { reason: 'project_owner_required' } },
      zhT,
    )
    expect(ownerNotice.text).toBe('发布失败：无权限（需项目负责人或任务管理员）（HTTP 403）')
    // 未登记 ⇒ 直出机读码（可拿去查服务端 / 规）
    expect(writeFailNotice({ code: 'SOME_GATE', status: 409 }, zhT).text).toBe('发布失败：SOME_GATE（HTTP 409）')
  })
})

// ---------------------------------------------------------------------------
const taskOf = (patch = {}) => ({
  task_id: 555,
  campaign_id: 501,
  title: '主任务',
  description: '转发并截图',
  status: 'active',
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

// `fetchApiJson` 被整替 ⇒ 返回值即 API 层拿到的解包后数据（success 信封在本出口内，一并被替）。
const NET_STATE = { campaign: null, project: null, taskPatch: null }

const netCalls = (url, method) => NET.fetchApiJson.mock.calls.filter(([u, o = {}]) =>
  u === url && (method ? o.method === method : !o.method))

beforeEach(() => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  NET.getAuthHeaders.mockClear()
  NET_STATE.campaign = campaignOf()
  NET_STATE.project = projectRow() // 【发布子任务】提交前的新鲜读（GET /api/project/:slug）同源
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

const renderCampaign = (ref = '501') => render(
  <MemoryRouter initialEntries={[`/campaign/${ref}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/campaign/:ref" element={<CampaignDetailPage />} />
    </Routes>
  </MemoryRouter>,
)

/** 【发布子任务】表单**已开**（挂载点 = 任务卡内就地开面板，活动 + 任务双锁）。 */
const openSubtaskForm = async (container) => {
  await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]')).not.toBeNull())
  fireEvent.click(container.querySelector('[data-sf-m="campaign-task-entry-subtask"]'))
  await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())
  return container.querySelector('[data-sf-m="project-form-subtask"]')
}

describe('② 表单失败路径：内联 code + reason + HTTP（探针取证）', () => {
  it('【发布子任务】失败 ⇒ 通知里带具体因由，元素带 data-sf-err-code / -reason / -status', async () => {
    NET_STATE.taskPatch = () => {
      throw Object.assign(new Error('not owned'), {
        code: 'SUBTASK_NOT_FOUND',
        status: 404,
        details: { reason: 'subtask_not_in_task' },
      })
    }
    const { container } = renderCampaign()
    const form = await openSubtaskForm(container)

    fireEvent.change(form.querySelector('[data-sf-field="title"]'), { target: { value: '新问卷' } })
    fireEvent.submit(form)

    await waitFor(() => {
      const notice = container.querySelector('[data-sf-m="project-form-notice"]')
      expect(notice).not.toBeNull()
      expect(notice.textContent).toBe('project.failDetail:{"detail":"project.reasonSubtaskNotInTask","status":404}')
      expect(notice.getAttribute('data-sf-err-code')).toBe('SUBTASK_NOT_FOUND')
      expect(notice.getAttribute('data-sf-err-reason')).toBe('subtask_not_in_task')
      expect(notice.getAttribute('data-sf-err-status')).toBe('404')
      expect(notice.getAttribute('role')).toBe('alert')
    })
  })

  it('未知 reason ⇒ 文案回退到 code（不吞掉失败、也不谎报成功）', async () => {
    NET_STATE.taskPatch = () => {
      throw Object.assign(new Error('style'), {
        code: 'PREDICTION_OPTION_STYLE_IMMUTABLE',
        status: 400,
      })
    }
    const { container } = renderCampaign()
    const form = await openSubtaskForm(container)
    fireEvent.change(form.querySelector('[data-sf-field="title"]'), { target: { value: '新问卷' } })
    fireEvent.submit(form)

    await waitFor(() => {
      const notice = container.querySelector('[data-sf-m="project-form-notice"]')
      expect(notice.textContent)
        .toBe('project.failDetail:{"detail":"PREDICTION_OPTION_STYLE_IMMUTABLE","status":400}')
      expect(notice.getAttribute('data-sf-err-code')).toBe('PREDICTION_OPTION_STYLE_IMMUTABLE')
      expect(notice.getAttribute('data-sf-err-reason')).toBe('')
      // 表单不关：保留输入，可就地重试
      expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull()
    })
  })

  it('无错误体（网络断）⇒ 原文案照旧，data-* 为空串', async () => {
    NET_STATE.taskPatch = () => {
      throw new Error('Failed to fetch')
    }
    const { container } = renderCampaign()
    const form = await openSubtaskForm(container)
    fireEvent.change(form.querySelector('[data-sf-field="title"]'), { target: { value: '新问卷' } })
    fireEvent.submit(form)

    await waitFor(() => {
      const notice = container.querySelector('[data-sf-m="project-form-notice"]')
      expect(notice.textContent).toBe('project.publishFailed')
      expect(notice.getAttribute('data-sf-err-code')).toBe('')
      expect(notice.getAttribute('data-sf-err-reason')).toBe('')
    })
  })
})

// ---------------------------------------------------------------------------
describe('③ 任务卡上线/下线失败：同样内联 code + reason + HTTP', () => {
  it('PATCH status 被拒（campaign_ended_frozen + reason）⇒ 卡内提示带因由与 data-sf-err-*', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'active' })] })
    NET_STATE.taskPatch = () => {
      throw Object.assign(new Error('frozen'), {
        code: 'CAMPAIGN_ENDED_FROZEN',
        status: 409,
        details: { reason: 'subtask_remove_overlap' },
      })
    }
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-task-status-toggle"]'))

    await waitFor(() => {
      const err = container.querySelector('[data-sf-m="campaign-task-status-err"]')
      expect(err).not.toBeNull()
      expect(err.textContent).toBe('project.failDetail:{"detail":"project.reasonSubtaskRemoveOverlap","status":409}')
      expect(err.getAttribute('data-sf-err-code')).toBe('CAMPAIGN_ENDED_FROZEN')
      expect(err.getAttribute('data-sf-err-reason')).toBe('subtask_remove_overlap')
      expect(err.getAttribute('data-sf-err-status')).toBe('409')
    })
  })

  it('无错误体（网络断）⇒ 原文案照旧（`project.publishFailed`），data-* 为空串', async () => {
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ status: 'active' })] })
    NET_STATE.taskPatch = () => {
      throw new Error('Failed to fetch')
    }
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-task-status-toggle"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-task-status-toggle"]'))

    await waitFor(() => {
      const err = container.querySelector('[data-sf-m="campaign-task-status-err"]')
      expect(err.textContent).toBe('project.publishFailed')
      expect(err.getAttribute('data-sf-err-code')).toBe('')
    })
  })
})

// ---------------------------------------------------------------------------
describe('④ 行级删除失败：删除模板 + 取证字段', () => {
  it('删除遇 subtask_has_proofs（带 reason）⇒ 行内「删除失败：已有用户提交，不能删除（HTTP 409）」', async () => {
    const row = {
      subtask_id: 5012, task_id: 555, type_code: 'x_verify', type_label: 'X 验证',
      title: '转发推文', content: '转发并附链接', payload: {}, sort: 1, required: false,
    }
    NET_STATE.campaign = campaignOf({ tasks: [taskOf({ subtasks: [row] })] })
    NET_STATE.taskPatch = () => {
      throw Object.assign(new Error('has proofs'), {
        code: 'subtask_has_proofs',
        status: 409,
        details: { reason: 'subtask_has_proofs' },
      })
    }
    const { container } = renderCampaign()
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-subtask-delete"]')).not.toBeNull())

    fireEvent.click(container.querySelector('[data-sf-m="campaign-subtask-delete"]'))
    await waitFor(() => expect(container.querySelector('[data-sf-m="campaign-subtask-confirm"]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-sf-m="campaign-subtask-confirm"]'))

    await waitFor(() => {
      const err = container.querySelector('[data-sf-m="campaign-subtask-err"]')
      expect(err).not.toBeNull()
      expect(err.textContent).toBe('project.deleteFailDetail:{"detail":"project.hasProofs","status":409}')
      expect(err.getAttribute('data-sf-err-code')).toBe('subtask_has_proofs')
      expect(err.getAttribute('data-sf-err-reason')).toBe('subtask_has_proofs')
      expect(err.getAttribute('data-sf-err-status')).toBe('409')
    })
  })
})
