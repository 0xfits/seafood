/**
 * 需求②（Kevin 2026-10-21）· 发布悬赏的前置准入 + 内嵌「新建项目」
 *
 * 判据（逐条可判负）：
 *   ① `hasOwnedProject` 纯函数：`owner_uid` 相等（数字/字符串等价）∧ `status !== 'ended'` 才算「在管」；
 *      别的项目 / 已 ended / 空数组 / 非数组 ⇒ 无；
 *   ② 无在管项目 ⇒ **不渲染发布表单**（`jobs-form` 计数 = 0），改渲染阻断面板（`jobs-project-gate`）；
 *   ③ 面板内【新建项目】可展开内嵌表单，字段提交 = `POST /api/project`，载荷键集**恰等于**服务端
 *      `CREATE_KEYS` 子集（title / description / headcount / recruit_min_account_days /
 *      wage_batt_per_claim / wage_interval_hours / create_key；次币两键成对才发）；
 *   ④ 建项目成功 ⇒ **重跑准入判定** ⇒ 直接落发布悬赏表单（阻断面板消失）；
 *   ⑤ 有在管项目 ⇒ 直接渲染发布表单（阻断面板计数 = 0）；
 *   ⑥ 发布口收到 403 `reason=project_required` ⇒ 转入阻断面板（双保险，不解析文案判据）；
 *   ⑦ 领取间隔 1–100 之外 ⇒ 代码闸拦下（零 `/api/project` 请求）+ 内联提示。
 *
 * 替身：mock 全站唯一出口 `../../auth.fetchApiJson`（⇒ `job-api.js` 的载荷构造、幂等 tracker 都跑真代码）。
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stableT = (key) => key
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
    i18n: { language: 'zh', resolvedLanguage: 'zh', changeLanguage: vi.fn() },
  }),
}))
vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: false, can_access_admin: false, permissions: [] })),
  hasAdminPermission: vi.fn(() => false),
}))
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchApiJson: vi.fn(),
    getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
  }
})

import { fetchApiJson } from '../../auth'
import { useAuth } from '../../auth-context'
import PublishJobPage from '../../pages/jobs/PublishJobPage'
import { hasOwnedProject } from '../../pages/jobs/job-api'

const MY_UID = 7
const CURRENCIES = [
  { cid: 1, symbol: '$', name: '社区积分' },
  { cid: 7, symbol: '₿', name: 'BTTC' },
]
const OWNED_ROW = { project_id: '11', owner_uid: MY_UID, status: 'recruiting', title: '在管项目' }

const renderPage = () => render(
  <MemoryRouter initialEntries={['/task/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <PublishJobPage />
  </MemoryRouter>
)

const byM = (c, m) => c.querySelector(`[data-sf-m="${m}"]`)
const callsTo = (pattern) => fetchApiJson.mock.calls.filter((c) => String(c[0]).includes(pattern))

/** 有状态替身：`state.projects` 决定准入判定；建项目成功后就地补一行（模拟「建完即拥有」）。 */
let state
const installFetch = () => {
  fetchApiJson.mockImplementation(async (url, options = {}) => {
    const target = String(url)
    if (target.includes('/api/project/all')) return state.projects
    if (target.includes('/api/currencies')) return CURRENCIES
    if (target === '/api/project' && String(options.method) === 'POST') {
      state.projectPosts.push(JSON.parse(options.body))
      if (state.projectError) throw state.projectError
      state.projects = [OWNED_ROW]
      return { project_id: '11' }
    }
    if (target === '/api/job' && String(options.method) === 'POST') {
      state.jobPosts.push(JSON.parse(options.body))
      if (state.jobError) throw state.jobError
      return { job_id: 5 }
    }
    return []
  })
}

const fillPublishForm = (c) => {
  fireEvent.change(byM(c, 'jobs-input-title'), { target: { value: '悬赏一' } })
  fireEvent.change(byM(c, 'jobs-input-reward'), { target: { value: '10' } })
}

const fillProjectForm = (c) => {
  fireEvent.change(byM(c, 'jobs-project-input-title'), { target: { value: '新项目' } })
  fireEvent.change(byM(c, 'jobs-project-input-headcount'), { target: { value: '3' } })
  fireEvent.change(byM(c, 'jobs-project-input-batt'), { target: { value: '5' } })
  fireEvent.change(byM(c, 'jobs-project-input-interval'), { target: { value: '24' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  state = { projects: [], projectPosts: [], jobPosts: [], projectError: null, jobError: null }
  installFetch()
  useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: MY_UID, token: 'test' } })
})

describe('hasOwnedProject · 在管项目判定（纯函数）', () => {
  it('owner 命中且 status ≠ ended ⇒ true；数字/字符串 uid 等价', () => {
    expect(hasOwnedProject([OWNED_ROW], MY_UID)).toBe(true)
    expect(hasOwnedProject([OWNED_ROW], String(MY_UID))).toBe(true)
    expect(hasOwnedProject([{ ...OWNED_ROW, owner_uid: String(MY_UID) }], MY_UID)).toBe(true)
  })

  it('他人项目 / 已 ended / 空数组 / 非数组 / 空 uid ⇒ false', () => {
    expect(hasOwnedProject([{ ...OWNED_ROW, owner_uid: 8 }], MY_UID)).toBe(false)
    expect(hasOwnedProject([{ ...OWNED_ROW, status: 'ended' }], MY_UID)).toBe(false)
    expect(hasOwnedProject([], MY_UID)).toBe(false)
    expect(hasOwnedProject(null, MY_UID)).toBe(false)
    expect(hasOwnedProject([OWNED_ROW], '')).toBe(false)
  })

  it('status 缺键 ⇒ 视为在管（公开列表只出 recruiting/working）', () => {
    expect(hasOwnedProject([{ project_id: '11', owner_uid: MY_UID }], MY_UID)).toBe(true)
  })
})

describe('发布悬赏页 · 无项目 ⇒ 阻断面板 + 内嵌新建项目', () => {
  it('② 无在管项目：阻断面板在场、发布表单计数 = 0', async () => {
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())
    expect(byM(container, 'jobs-project-gate-text').textContent).toBe('bountyProject.needProject')
    expect(byM(container, 'jobs-project-open')).not.toBeNull()
    // 判负读数：发布表单 / 奖励输入 / 提交按钮**一条都不渲染**
    expect(container.querySelectorAll('[data-sf-m="jobs-form"]').length).toBe(0)
    expect(byM(container, 'jobs-input-reward')).toBeNull()
    expect(byM(container, 'jobs-primary')).toBeNull()
    // 判定走的是公开读口
    expect(callsTo('/api/project/all').length).toBe(1)
  })

  it('③ 点【新建项目】⇒ 内嵌表单可填；提交载荷键集 = 服务端 CREATE_KEYS 子集（次币未选 ⇒ 两键不发）', async () => {
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())

    expect(byM(container, 'jobs-project-form')).toBeNull()
    fireEvent.click(byM(container, 'jobs-project-open'))
    expect(byM(container, 'jobs-project-form')).not.toBeNull()

    fillProjectForm(container)
    fireEvent.submit(byM(container, 'jobs-project-form'))
    await vi.waitFor(() => expect(state.projectPosts.length).toBe(1))

    expect(Object.keys(state.projectPosts[0]).sort()).toEqual([
      'create_key', 'description', 'headcount', 'recruit_min_account_days',
      'title', 'wage_batt_per_claim', 'wage_interval_hours',
    ])
    expect(state.projectPosts[0].title).toBe('新项目')
    expect(state.projectPosts[0].headcount).toBe(3)
    expect(state.projectPosts[0].recruit_min_account_days).toBe(0)
    expect(state.projectPosts[0].wage_batt_per_claim).toBe('5')
    expect(state.projectPosts[0].wage_interval_hours).toBe(24)
    expect(String(state.projectPosts[0].create_key)).toMatch(/^cli:/)
  })

  it('③b 选了次币 ⇒ `wage_cid` + `wage_currency_amount` 成对下发', async () => {
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())
    fireEvent.click(byM(container, 'jobs-project-open'))
    fillProjectForm(container)
    fireEvent.change(byM(container, 'jobs-project-select-cid'), { target: { value: '7' } })
    await vi.waitFor(() => expect(byM(container, 'jobs-project-input-amount')).not.toBeNull())
    fireEvent.change(byM(container, 'jobs-project-input-amount'), { target: { value: '12' } })
    fireEvent.submit(byM(container, 'jobs-project-form'))
    await vi.waitFor(() => expect(state.projectPosts.length).toBe(1))
    expect(state.projectPosts[0].wage_cid).toBe('7')
    expect(state.projectPosts[0].wage_currency_amount).toBe('12')
  })

  it('④ 建项目成功 ⇒ 重跑判定（第二次读口）⇒ 直接落发布悬赏表单', async () => {
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())
    fireEvent.click(byM(container, 'jobs-project-open'))
    fillProjectForm(container)
    fireEvent.submit(byM(container, 'jobs-project-form'))

    await vi.waitFor(() => expect(byM(container, 'jobs-form')).not.toBeNull())
    expect(callsTo('/api/project/all').length).toBe(2) // 进页 1 次 + 建成后 1 次
    expect(container.querySelectorAll('[data-sf-m="jobs-project-gate"]').length).toBe(0)
    // 成功提示保留（不静默）
    expect(byM(container, 'jobs-project-created').textContent).toBe('bountyProject.createOk')
  })

  it('⑦ 领取间隔 101 ⇒ 代码闸拦下：零 `/api/project` 请求 + 内联提示', async () => {
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())
    fireEvent.click(byM(container, 'jobs-project-open'))
    fillProjectForm(container)
    fireEvent.change(byM(container, 'jobs-project-input-interval'), { target: { value: '101' } })
    fireEvent.submit(byM(container, 'jobs-project-form'))
    expect(callsTo('/api/project').filter((c) => String(c[0]) === '/api/project').length).toBe(0)
    expect(byM(container, 'jobs-project-status').textContent).toBe('bountyProject.intervalInvalid')
  })

  it('⑦b 后端 409（建项目费不足）⇒ 内联提示、表单保持可编辑', async () => {
    const failure = new Error('余额不足，建项目需要 10000 $')
    failure.status = 409
    failure.code = 'LEDGER_INSUFFICIENT_BALANCE'
    state.projectError = failure
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())
    fireEvent.click(byM(container, 'jobs-project-open'))
    fillProjectForm(container)
    fireEvent.submit(byM(container, 'jobs-project-form'))
    await vi.waitFor(() => expect(byM(container, 'jobs-project-status').textContent).toContain('余额不足'))
    expect(byM(container, 'jobs-project-form')).not.toBeNull()
    expect(byM(container, 'jobs-project-input-title').value).toBe('新项目')
    expect(byM(container, 'jobs-project-submit').hasAttribute('disabled')).toBe(false)
  })
})

describe('发布悬赏页 · 有项目 / 403 双保险', () => {
  it('⑤ 有在管项目 ⇒ 直接发发布表单，阻断面板计数 = 0（行为与改前一致）', async () => {
    state.projects = [OWNED_ROW]
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-form')).not.toBeNull())
    expect(container.querySelectorAll('[data-sf-m="jobs-project-gate"]').length).toBe(0)
    expect(byM(container, 'jobs-input-reward')).not.toBeNull()
    expect(byM(container, 'jobs-primary')).not.toBeNull()
  })

  it('⑥ 发布口 403 project_required ⇒ 转入阻断面板（并展开建项目表单）', async () => {
    state.projects = [OWNED_ROW]
    const failure = new Error('发布悬赏需要先拥有一个项目')
    failure.status = 403
    failure.code = 'AUTH_FORBIDDEN'
    failure.details = { reason: 'project_required' }
    state.jobError = failure
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-form')).not.toBeNull())

    fillPublishForm(container)
    fireEvent.submit(byM(container, 'jobs-form'))
    await vi.waitFor(() => expect(byM(container, 'jobs-project-gate')).not.toBeNull())
    expect(container.querySelectorAll('[data-sf-m="jobs-form"]').length).toBe(0)
    expect(byM(container, 'jobs-project-form')).not.toBeNull()
    expect(state.jobPosts.length).toBe(1)
  })

  it('⑥b 其它错误（如 400 金额非法）**不**转阻断面板（只内联报错）', async () => {
    state.projects = [OWNED_ROW]
    const failure = new Error('金额非法')
    failure.status = 400
    failure.details = { reason: 'NOT_CLOSED_SET' }
    state.jobError = failure
    const { container } = renderPage()
    await vi.waitFor(() => expect(byM(container, 'jobs-form')).not.toBeNull())
    fillPublishForm(container)
    fireEvent.submit(byM(container, 'jobs-form'))
    await vi.waitFor(() => expect(byM(container, 'jobs-status').textContent).toContain('金额非法'))
    expect(byM(container, 'jobs-project-gate')).toBeNull()
    expect(byM(container, 'jobs-form')).not.toBeNull()
  })

  it('未登录 ⇒ 登录提示（不查项目、不渲染表单）', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, user: null })
    const { container } = renderPage()
    await vi.waitFor(() => expect(container.textContent).toContain('pleaseLogin'))
    expect(callsTo('/api/project/all').length).toBe(0)
    expect(byM(container, 'jobs-form')).toBeNull()
  })
})
