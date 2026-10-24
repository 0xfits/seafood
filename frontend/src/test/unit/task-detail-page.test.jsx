/**
 * `/task/:taskId` · campaign 任务页单测（Kevin 2026-10-21 需求①）
 *
 * 覆盖面（对齐派单验证项）：
 *   ① 正常渲染：项目头（圆形 avatar + 项目名 → `/<slug>` + 活动名 → `/campaign/:id`）、任务标题、
 *      状态徽标（查表四语，不直出枚举）、时间窗（格式化，禁 ISO 直出）、奖励 `$` + 次币符号、
 *      已参与 X / 共 Y、描述、子任务清单（类型徽标 / 必做标记 / content）、底部 CTA → 活动页；
 *   ② 404：读口 404 ⇒ 落 `<NotFoundPage />`（`not-found-page` 钩子在场，任务页钩子零出现）；
 *   ③ draft 匿名：读口把 draft 行透给匿名（服务端闸失守的兜底）⇒ 仍按 404 呈现，**不泄露草稿**；
 *   ④ 公开：匿名 + active ⇒ 正常渲染，**不包登录闸**、零表单/零写口；`/en` 档前缀由唯一构造器承担；
 *   ⑤ 契约面：读口路径 = `GET /api/campaign/task/<id>`；请求体/方法 = GET；零 `/api/task/`（旧悬赏读口）调用。
 *
 * 口径：真 `campaign-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 s7/d1 联测先例）；
 *   i18n 用**真 zh 词典**逐字断言（替身取模块级稳定函数，避免无限重渲染）。
 */
import React from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const H = vi.hoisted(() => {
  const state = { table: {} }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    if (v === undefined) return key
    return opts ? String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : v
  }
  return state
})
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: H.t, i18n: { resolvedLanguage: 'zh', language: 'zh', changeLanguage: vi.fn() } }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: false, user: null }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

import CampaignTaskPage from '../../pages/campaign/CampaignTaskPage'

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  headers: { get: () => null },
})

// 读口契约行（`GET /api/campaign/task/:taskId`）：字段逐字对齐派单契约。
const TASK = {
  task_id: 1,
  title: '第一轮',
  description: '完成首轮任务：转发推文 + 链上快照。',
  status: 'active',
  time_start: '2026-10-01T00:00:00.000Z',
  time_end: '2026-11-01T00:00:00.000Z',
  reward_amount_primary: '15',
  reward_cid_secondary: '2',
  reward_amount_secondary: '40',
  joined_count: 66,
  joined_target: 300,
  campaign: { id: 501, title: '新赛季社区任务', status: 'active' },
  project: { id: 11, title: '星链楼市', slug: 'xinglian', avatar_url: '', status: 'recruiting' },
  subtasks: [
    { subtask_id: 9001, type_code: 'x_verify', title: '转发官方推文', content: '附上你的转发链接', required: true, sort: 1 },
    { subtask_id: 9002, type_code: 'survey', title: '填问卷', content: '三个问题', required: false, sort: 2 },
  ],
}

const CURRENCIES = [{ cid: 1, symbol: '$', name: 'USDT' }, { cid: 2, symbol: 'batt', name: 'BATT' }]

/** stubbed `fetch`：任务读口 + 币种表（其余一律 404）。 */
const routed = ({ task = { status: 200, body: { success: true, data: TASK } } } = {}) =>
  vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/api/campaign/task/')) return jsonResponse(task.status, task.body)
    if (u.includes('/api/currencies')) return jsonResponse(200, { success: true, data: CURRENCIES })
    return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'nf' } })
  })

const renderAt = (entry = '/task/1') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/task/:taskId" element={<CampaignTaskPage />} />
      <Route path="/en/task/:taskId" element={<CampaignTaskPage />} />
    </Routes>
  </MemoryRouter>,
)

const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)
const qa = (m) => [...document.querySelectorAll(`[data-sf-m="${m}"]`)]

beforeEach(() => {
  H.table = zh
  AUTH.isAuthenticated = false
  AUTH.user = null
  vi.stubGlobal('fetch', routed())
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// ① 正常渲染（公开读；匿名可见 active）
// ============================================================================
describe('① 正常渲染', () => {
  it('读口路径 = GET /api/campaign/task/1（匿名也发；零 /api/task/ 旧悬赏读口）', async () => {
    renderAt()
    await waitFor(() => expect(qa('task-page').length).toBe(1))
    const urls = fetch.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u === '/api/campaign/task/1')).toBe(true)
    expect(urls.some((u) => u.includes('/api/task/'))).toBe(false)
    const call = fetch.mock.calls.find((c) => String(c[0]) === '/api/campaign/task/1')
    expect(call[1]?.method ?? 'GET').toBe('GET')
  })

  it('项目头：圆形 avatar（无 avatar_url ⇒ 首字兜底）+ 项目名链 → /xinglian + 活动名链 → /campaign/501', async () => {
    renderAt()
    await waitFor(() => expect(q('task-project')).not.toBeNull())
    const avatar = q('task-project-avatar')
    expect(avatar).not.toBeNull()
    expect(avatar.querySelector('img')).toBeNull()
    expect(avatar.querySelector('.sf-task-avatar-initial').textContent).toBe('星')
    expect(q('task-project-name').getAttribute('href')).toBe('/xinglian')
    expect(q('task-project-name').textContent).toBe('星链楼市')
    expect(q('task-campaign').getAttribute('href')).toBe('/campaign/501')
    expect(q('task-campaign').textContent).toBe('新赛季社区任务')
  })

  it('有 avatar_url ⇒ 圆形 <img> 透传 src（无首字兜底）', async () => {
    vi.stubGlobal('fetch', routed({
      task: { status: 200, body: { success: true, data: { ...TASK, project: { ...TASK.project, avatar_url: '/api/media/abc.png' } } } },
    }))
    renderAt()
    await waitFor(() => expect(q('task-project-avatar')).not.toBeNull())
    const img = q('task-project-avatar').querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/api/media/abc.png')
  })

  it('标题 / 状态徽标查表 / 时间窗格式化 / 奖励 $ + 次币 / 已参与 X 共 Y', async () => {
    renderAt()
    await waitFor(() => expect(q('task-title')).not.toBeNull())
    expect(q('task-title').textContent).toBe('第一轮')
    // 状态 = 查表文案（不直出 `active`）
    expect(q('task-status').textContent).toBe('进行中')
    expect(q('task-status').getAttribute('data-sf-state')).toBe('active')
    // 时间窗：格式化成本地文案，禁 ISO 原串
    const time = q('task-time').textContent
    expect(time).toContain('~')
    expect(time).not.toContain('T00:00:00')
    // 奖励
    expect(q('task-reward').getAttribute('data-sf-amount')).toBe('15')
    expect(q('task-reward').textContent).toContain('完成奖 $15')
    await waitFor(() => expect(q('task-reward-secondary')).not.toBeNull())
    expect(q('task-reward-secondary').textContent).toBe('+batt40') // T139-a 货币文案：单位（batt）紧贴数量、无空格
    // 参与数
    expect(q('task-joined').textContent).toBe('已参与 66 / 共 300 人')
    // 描述
    expect(q('task-desc').textContent).toBe(TASK.description)
  })

  it('子任务清单：两条 / 类型徽标查表 / 必做·选做标记 / content', async () => {
    renderAt()
    await waitFor(() => expect(qa('task-subtask').length).toBe(2))
    const rows = qa('task-subtask')
    expect(rows[0].getAttribute('data-sf-type')).toBe('x_verify')
    expect(rows[0].querySelector('[data-sf-m="task-subtask-type"]').textContent).toBe('X 验证')
    expect(rows[0].querySelector('[data-sf-m="task-subtask-title"]').textContent).toBe('转发官方推文')
    // 必做标记 = 星标 `*`（2026-10-22 改版；可访问名 = `project.fRequired` 的 zh 值「必做」，旧文案不再直出）
    const req0 = rows[0].querySelector('[data-sf-m="task-subtask-required"]')
    expect(req0.textContent).toBe('*')
    expect(req0.getAttribute('aria-label')).toBe('必做')
    expect(req0.getAttribute('data-sf-required')).toBe('1')
    expect(rows[0].querySelector('[data-sf-m="task-subtask-content"]').textContent).toBe('附上你的转发链接')
    expect(rows[1].querySelector('[data-sf-m="task-subtask-type"]').textContent).toBe('问卷')
    expect(rows[1].querySelector('[data-sf-m="task-subtask-required"]').textContent).toBe('选做')
  })

  it('底部 CTA：唯一主按钮 → 活动页（去参与），本页零表单', async () => {
    renderAt()
    await waitFor(() => expect(q('task-cta')).not.toBeNull())
    expect(q('task-cta').getAttribute('href')).toBe('/campaign/501')
    expect(q('task-cta').textContent).toBe('立即参与')
    expect(document.querySelector('form')).toBeNull()
    expect(document.querySelector('button[type="submit"]')).toBeNull()
  })

  it('joined_target 缺席 ⇒ 只显「已参与 X 人」（不渲染残缺的 /共 Y）', async () => {
    const { joined_target, ...rest } = TASK
    vi.stubGlobal('fetch', routed({ task: { status: 200, body: { success: true, data: rest } } }))
    renderAt()
    await waitFor(() => expect(q('task-joined')).not.toBeNull())
    expect(q('task-joined').textContent).toBe('已参与 66 人')
  })
})

// ============================================================================
// ② 404
// ============================================================================
describe('② 读口 404 ⇒ 提示页', () => {
  it('404 ⇒ <NotFoundPage />（not-found-page 在场，任务页钩子零出现）', async () => {
    vi.stubGlobal('fetch', routed({ task: { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'nf' } } } }))
    renderAt('/task/999')
    await waitFor(() => expect(q('not-found-page')).not.toBeNull())
    expect(q('task-page')).toBeNull()
    expect(q('task-title')).toBeNull()
  })

  it('500 ⇒ 可重试错误块（不误判成 404）', async () => {
    vi.stubGlobal('fetch', routed({ task: { status: 500, body: { success: false, error: { code: 'INTERNAL', message: 'boom' } } } }))
    renderAt('/task/1')
    await waitFor(() => expect(q('task-error')).not.toBeNull())
    expect(q('not-found-page')).toBeNull()
    expect(q('task-retry')).not.toBeNull()
  })
})

// ============================================================================
// ③ draft 匿名 ⇒ 404（不泄露草稿）
// ============================================================================
describe('③ draft 匿名', () => {
  it('服务端把 draft 行透给匿名 ⇒ 前端仍按 404 呈现（零标题 / 零描述 / 零子任务）', async () => {
    vi.stubGlobal('fetch', routed({ task: { status: 200, body: { success: true, data: { ...TASK, status: 'draft' } } } }))
    renderAt('/task/1')
    await waitFor(() => expect(q('not-found-page')).not.toBeNull())
    expect(q('task-page')).toBeNull()
    expect(document.body.textContent).not.toContain('第一轮')
    expect(document.body.textContent).not.toContain(TASK.description)
  })

  it('服务端按契约 404（draft 匿名）⇒ 同落提示页', async () => {
    vi.stubGlobal('fetch', routed({ task: { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'nf' } } } }))
    renderAt('/task/1')
    await waitFor(() => expect(q('not-found-page')).not.toBeNull())
    expect(q('task-page')).toBeNull()
  })
})

// ============================================================================
// ④ 公开可读 + 语言前缀
// ============================================================================
describe('④ 公开页 / 语言前缀', () => {
  it('匿名 + active ⇒ 正常渲染（未登录不拦截阅读；无登录跳转、无保护路由文案）', async () => {
    AUTH.isAuthenticated = false
    const { container } = renderAt('/task/1')
    await waitFor(() => expect(q('task-title')).not.toBeNull())
    expect(container.textContent).not.toContain('verifyingPermission')
    expect(container.querySelector('[data-sf-m="not-found-page"]')).toBeNull()
  })

  it('/en/task/1 ⇒ 站内链接带 en 前缀（/en/xinglian · /en/campaign/501）', async () => {
    renderAt('/en/task/1')
    await waitFor(() => expect(q('task-project-name')).not.toBeNull())
    expect(q('task-project-name').getAttribute('href')).toBe('/en/xinglian')
    expect(q('task-campaign').getAttribute('href')).toBe('/en/campaign/501')
    expect(q('task-cta').getAttribute('href')).toBe('/en/campaign/501')
  })
})
