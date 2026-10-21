/**
 * 项目页任务卡 · **上线 / 下线开关**（Kevin 2026-10-21 · 任务页步 3）
 *
 * 覆盖面（四臂，全部走真实 `project-api.patchProjectTaskStatus`，只把最底层 `fetchApiJson` 换成 spy
 * ⇒ 「载荷恰 `{status:...}`」这条是**整链**取证，不是 mock 掉 API 层后的空断言）：
 *   ① draft 任务 + 有权限 ⇒ 钮文案 =【上线】；点后 `PATCH /api/campaign/task/:id`，body **恰**
 *      `{"status":"active"}`（单字段：不得夹带 subtasks / title / 奖励）；
 *   ② active 任务 ⇒ 钮文案 =【下线】，body **恰** `{"status":"draft"}`；
 *   ③ 非 owner / 非管理员（`canManage=false`）⇒ **零钮**（状态徽标仍在，只读可见）；
 *   ④ PATCH 失败（409/403/网络）⇒ 卡片内**就地内联**错误（`project.publishFailed`），
 *      不回调页面层（不谎报已上线）。此外：`ended` 任务封板 ⇒ 无钮。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

// 最底层出口 = fetchApiJson（auth.js）。只换这一个 ⇒ project-api 的 URL / 方法 / body 全链现取。
const NET = vi.hoisted(() => ({ fetchApiJson: vi.fn(), getAuthHeaders: vi.fn(() => ({})) }))
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchApiJson: NET.fetchApiJson, getAuthHeaders: NET.getAuthHeaders }
})

import ProjectNestedList from '../../pages/project/ProjectNestedList'

const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)

const taskOf = (patch = {}) => ({
  task_id: 555,
  title: '转发推文',
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

const campaignsOf = (task) => ([{
  campaign_id: 501,
  title: '秋季招募',
  description: '活动说明',
  status: 'active',
  time_start: '2026-10-01T00:00:00.000Z',
  time_end: '2026-10-31T00:00:00.000Z',
  tasks: [task],
}])

const renderList = (task, props = {}) => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ProjectNestedList
      campaigns={campaignsOf(task)}
      t={t}
      lang="zh"
      symbols={{}}
      canManage
      user={{ uID: 7 }}
      {...props}
    />
  </MemoryRouter>,
)

const toggleOf = (container) => container.querySelector('[data-sf-m="project-task-status-toggle"]')

beforeEach(() => {
  NET.fetchApiJson.mockReset()
  NET.getAuthHeaders.mockClear()
  NET.fetchApiJson.mockResolvedValue({ success: true, task: taskOf() })
})

afterEach(() => {
  cleanup()
})

describe('项目任务卡 · 上线 / 下线开关', () => {
  it('① draft ⇒ 【上线】：PATCH /api/campaign/task/555，body 恰 {"status":"active"}，成功回调页面层', async () => {
    const onTaskStatusChanged = vi.fn()
    const { container } = renderList(taskOf({ status: 'draft' }), { onTaskStatusChanged })

    const badge = container.querySelector('[data-sf-m="project-task-status"]')
    expect(badge.textContent).toBe('campaign.statusDraft')
    expect(badge.getAttribute('data-sf-state')).toBe('draft')

    const btn = toggleOf(container)
    expect(btn).not.toBeNull()
    expect(btn.textContent).toBe('project.taskOnline')
    expect(btn.getAttribute('data-sf-next')).toBe('active')

    fireEvent.click(btn)

    await waitFor(() => expect(NET.fetchApiJson).toHaveBeenCalledTimes(1))
    const [url, options] = NET.fetchApiJson.mock.calls[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ status: 'active' }) // 单字段闭集：多一键即负
    expect(Object.keys(JSON.parse(options.body))).toHaveLength(1)

    await waitFor(() => expect(onTaskStatusChanged).toHaveBeenCalledTimes(1))
    expect(onTaskStatusChanged.mock.calls[0][0]).toBe('active')
    expect(onTaskStatusChanged.mock.calls[0][1].task_id).toBe(555)
    // 成功路径不得残留内联错误
    expect(container.querySelector('[data-sf-m="project-task-status-err"]')).toBeNull()
  })

  it('② active ⇒ 【下线】：body 恰 {"status":"draft"}', async () => {
    const onTaskStatusChanged = vi.fn()
    const { container } = renderList(taskOf({ status: 'active' }), { onTaskStatusChanged })

    const badge = container.querySelector('[data-sf-m="project-task-status"]')
    expect(badge.textContent).toBe('campaign.statusActive')

    const btn = toggleOf(container)
    expect(btn.textContent).toBe('project.taskOffline')
    expect(btn.getAttribute('data-sf-next')).toBe('draft')

    fireEvent.click(btn)

    await waitFor(() => expect(NET.fetchApiJson).toHaveBeenCalledTimes(1))
    const [url, options] = NET.fetchApiJson.mock.calls[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(JSON.parse(options.body)).toEqual({ status: 'draft' })
    await waitFor(() => expect(onTaskStatusChanged).toHaveBeenCalledTimes(1))
    expect(onTaskStatusChanged.mock.calls[0][0]).toBe('draft')
  })

  it('③ 非 owner / 非管理员（canManage=false）⇒ 零钮、零请求；状态徽标仍可见', () => {
    for (const status of ['draft', 'active']) {
      const { container } = renderList(taskOf({ status }), { canManage: false })
      expect(toggleOf(container)).toBeNull()
      expect(container.querySelectorAll('[data-sf-m="project-task-status-toggle"]')).toHaveLength(0)
      expect(container.querySelector('[data-sf-m="project-task-status"]').getAttribute('data-sf-state')).toBe(status)
      cleanup()
    }
    expect(NET.fetchApiJson).not.toHaveBeenCalled()
  })

  it('④ PATCH 失败 ⇒ 卡片内联错误（project.publishFailed），不回调页面层、徽标不变', async () => {
    NET.fetchApiJson.mockRejectedValueOnce(Object.assign(new Error('task_invalid_transition'), { status: 409 }))
    const onTaskStatusChanged = vi.fn()
    const { container } = renderList(taskOf({ status: 'active' }), { onTaskStatusChanged })

    fireEvent.click(toggleOf(container))

    await waitFor(() => {
      const err = container.querySelector('[data-sf-m="project-task-status-err"]')
      expect(err).not.toBeNull()
      expect(err.textContent).toBe('project.publishFailed')
      expect(err.getAttribute('role')).toBe('alert')
      expect(err.getAttribute('data-sf-task')).toBe('555')
    })
    expect(onTaskStatusChanged).not.toHaveBeenCalled()
    // 失败后收手：按钮恢复可用（可重试），徽标仍是原状态
    expect(toggleOf(container).disabled).toBe(false)
    expect(container.querySelector('[data-sf-m="project-task-status"]').getAttribute('data-sf-state')).toBe('active')
  })

  it('⑤ ended 任务封板 ⇒ 无上线/下线钮（状态徽标仍在）', () => {
    const { container } = renderList(taskOf({ status: 'ended' }), { canManage: true })
    expect(toggleOf(container)).toBeNull()
    expect(container.querySelector('[data-sf-m="project-task-status"]').getAttribute('data-sf-state')).toBe('ended')
  })
})
