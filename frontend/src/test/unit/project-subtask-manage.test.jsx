/**
 * 项目页 · **子任务行级【编辑】【删除】**（Kevin 2026-10-22）
 *
 * 覆盖面（四臂；全部走真实 `project-api` → 只把最底层出口 `fetchApiJson` 换成 spy
 * ⇒「URL / 方法 / body 闭集」是**整链**取证，不是 mock 掉 API 层后的空断言）：
 *   ① 编辑预填：点【编辑】⇒ 行内切 `SubtaskForm` 编辑态（`data-sf-mode="edit"`），
 *      title / content / 奖池 / 截止时间（ISO → `datetime-local` 本地串）/ 必做 / 排序**全部预填**；
 *      改标题提交 ⇒ `PATCH /api/campaign/task/:id`，body 恰 `{subtasks:[{subtask_id, 六键}]}`
 *      （**只送被改的那一条**，键集 = `SUBTASK_EDIT_KEYS`）；存量四键 prediction 行**保持原口径**
 *      回送 `option_a/option_b`（展示恒 Yes/No，口径不得改写）；成功 ⇒ `project.subtaskSaved` + 收表单。
 *   ② prediction 非 draft ⇒ **无【编辑】钮**，只留 `project.predictionLocked` 一句（服务端 409
 *      `prediction_locked_after_publish`）；已结算（payload 带 `correct_option`）的 draft 行同理。
 *      非 prediction 类型的行不受此锁（仍可编辑）。
 *   ③ 删除 = **行内二次确认**（不弹窗）：点【删除】只切确认态、**零请求**；【取消】回到原态、仍零请求；
 *      确认 ⇒ `PATCH` body 恰 `{"subtasks_remove":[id]}`（数字主键数组）+ 回调页面层
 *      `project.subtaskDeleted`（行消失以读口重读为准，不在本地伪造）。
 *   ④ 409 两码**就地内联**、不谎报成功：删除遇 `subtask_has_proofs` ⇒ 行内 `project.hasProofs`；
 *      编辑遇 `prediction_locked_after_publish` ⇒ 表单内 `project.predictionLocked`；两条都不回调页面层。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 键回显的 t：断言里直接比键名（文案真源在 locale，四语齐备由 s8 门把关）。
const t = (key, values) => (values ? `${key}:${JSON.stringify(values)}` : key)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

// 最底层出口 = fetchApiJson（auth.js）。只换这一个 ⇒ project-api 的 URL / 方法 / body 全链现取。
const NET = vi.hoisted(() => ({ fetchApiJson: vi.fn(), getAuthHeaders: vi.fn(() => ({})) }))
vi.mock('../../auth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchApiJson: NET.fetchApiJson, getAuthHeaders: NET.getAuthHeaders }
})

import ProjectNestedList from '../../pages/project/ProjectNestedList'
import { SUBTASK_EDIT_KEYS } from '../../pages/project/project-payload'

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
      slug="sui"
      canManage
      user={{ uID: 7 }}
      {...props}
    />
  </MemoryRouter>,
)

const rowOf = (container, id) => container.querySelector(`[data-sf-m="project-subtask"][data-sf-subtask="${id}"]`)
const editBtn = (container, id) => container.querySelector(`[data-sf-m="project-subtask-edit"][data-sf-subtask="${id}"]`)
const deleteBtn = (container, id) => container.querySelector(`[data-sf-m="project-subtask-delete"][data-sf-subtask="${id}"]`)
const confirmBtn = (container, id) => container.querySelector(`[data-sf-m="project-subtask-confirm"][data-sf-subtask="${id}"]`)
const fieldOf = (container, name) => container.querySelector(`[data-sf-m="project-form-subtask"] [data-sf-field="${name}"]`)

beforeEach(() => {
  NET.fetchApiJson.mockReset()
  NET.getAuthHeaders.mockClear()
  NET.fetchApiJson.mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
})

// ============================================================================
describe('① 编辑：预填 + 载荷含 subtask_id（只送被改的那一条）', () => {
  it('点【编辑】⇒ 行内编辑态全字段预填（截止时间 ISO → datetime-local 本地串）', async () => {
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [predictionRow()] }))
    const row = rowOf(container, 5011)
    expect(row.getAttribute('data-sf-editing')).toBe('0')

    fireEvent.click(editBtn(container, 5011))

    await waitFor(() => expect(rowOf(container, 5011).getAttribute('data-sf-editing')).toBe('1'))
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
    // 零请求（只是打开编辑器）
    expect(NET.fetchApiJson).not.toHaveBeenCalled()
  })

  it('改标题提交 ⇒ body 恰 {subtasks:[{subtask_id + 六键}]}，存量四键 prediction 口径原样回送', async () => {
    const onDone = vi.fn()
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [predictionRow()] }), { onDone })

    fireEvent.click(editBtn(container, 5011))
    await waitFor(() => expect(fieldOf(container, 'title')).not.toBeNull())
    fireEvent.change(fieldOf(container, 'title'), { target: { value: '谁会赢（改）' } })
    fireEvent.submit(container.querySelector('[data-sf-m="project-form-subtask"]'))

    await waitFor(() => expect(NET.fetchApiJson).toHaveBeenCalledTimes(1))
    const [url, options] = NET.fetchApiJson.mock.calls[0]
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

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(onDone.mock.calls[0][0]).toEqual({ kind: 'ok', text: 'project.subtaskSaved' })
    // 成功 ⇒ 收表单（行内编辑态关闭）
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull())
  })

  it('同一行再点【编辑】= 收起（不发请求）', async () => {
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [verifyRow()] }))
    fireEvent.click(editBtn(container, 5012))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull())
    // 非 prediction ⇒ 无固定选项块
    expect(container.querySelector('[data-sf-m="project-prediction-choices"]')).toBeNull()
    fireEvent.click(editBtn(container, 5012))
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-form-subtask"]')).toBeNull())
    expect(NET.fetchApiJson).not.toHaveBeenCalled()
  })
})

// ============================================================================
describe('② prediction 发布后（父 task 非 draft）⇒ 无【编辑】钮', () => {
  it('task active + prediction ⇒ 只有锁定说明，零编辑钮；删除仍可用', async () => {
    const { container } = renderList(taskOf({ status: 'active', subtasks: [predictionRow()] }))
    expect(editBtn(container, 5011)).toBeNull()
    const locked = rowOf(container, 5011).querySelector('[data-sf-m="project-subtask-locked"]')
    expect(locked).not.toBeNull()
    expect(locked.textContent).toBe('project.predictionLocked')
    // 删除不受此锁（服务端只在「有凭证」时拒）
    expect(deleteBtn(container, 5011)).not.toBeNull()
  })

  it('已结算（payload 带 correct_option）的 draft 行同样无【编辑】钮', () => {
    const settled = predictionRow({ payload: { ...predictionRow().payload, correct_option: 'a' } })
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [settled] }))
    expect(editBtn(container, 5011)).toBeNull()
    expect(rowOf(container, 5011).querySelector('[data-sf-m="project-subtask-locked"]')).not.toBeNull()
  })

  it('非 prediction 类型在 active task 下仍可编辑（锁只针对 prediction）', () => {
    const { container } = renderList(taskOf({ status: 'active', subtasks: [verifyRow()] }))
    expect(editBtn(container, 5012)).not.toBeNull()
    expect(rowOf(container, 5012).querySelector('[data-sf-m="project-subtask-locked"]')).toBeNull()
  })

  it('canManage=false ⇒ 行级动作零钮（只读可见）', () => {
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [verifyRow()] }), { canManage: false })
    expect(container.querySelector('[data-sf-m="project-subtask-actions"]')).toBeNull()
    expect(editBtn(container, 5012)).toBeNull()
    expect(deleteBtn(container, 5012)).toBeNull()
  })
})

// ============================================================================
describe('③ 删除：行内二次确认 + subtasks_remove 载荷', () => {
  it('点【删除】只切确认态（零请求）；【取消】回原态（仍零请求）', async () => {
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [verifyRow()] }))
    fireEvent.click(deleteBtn(container, 5012))
    await waitFor(() => expect(confirmBtn(container, 5012)).not.toBeNull())
    expect(container.querySelector('[data-sf-m="project-subtask-confirm-text"]').textContent).toBe('project.confirmDelete')
    expect(confirmBtn(container, 5012).textContent).toBe('project.subtaskDelete')
    expect(NET.fetchApiJson).not.toHaveBeenCalled()

    fireEvent.click(container.querySelector('[data-sf-m="project-subtask-cancel"]'))
    await waitFor(() => expect(confirmBtn(container, 5012)).toBeNull())
    expect(deleteBtn(container, 5012)).not.toBeNull()
    expect(NET.fetchApiJson).not.toHaveBeenCalled()
  })

  it('确认 ⇒ PATCH body 恰 {"subtasks_remove":[id]} + 回调页面层（行消失以读口为准）', async () => {
    const onDone = vi.fn()
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [verifyRow()] }), { onDone })

    fireEvent.click(deleteBtn(container, 5012))
    await waitFor(() => expect(confirmBtn(container, 5012)).not.toBeNull())
    fireEvent.click(confirmBtn(container, 5012))

    await waitFor(() => expect(NET.fetchApiJson).toHaveBeenCalledTimes(1))
    const [url, options] = NET.fetchApiJson.mock.calls[0]
    expect(url).toBe('/api/campaign/task/555')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ subtasks_remove: [5012] })
    expect(Object.keys(JSON.parse(options.body))).toEqual(['subtasks_remove']) // 不夹带 subtasks / 整组

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(onDone.mock.calls[0][0]).toEqual({ kind: 'ok', text: 'project.subtaskDeleted' })
    // 确认态收起；行仍在 DOM（页面层静默重读后才消失，不本地伪造）
    await waitFor(() => expect(confirmBtn(container, 5012)).toBeNull())
    expect(rowOf(container, 5012)).not.toBeNull()
  })
})

// ============================================================================
describe('④ 409 两码就地内联（不谎报成功）', () => {
  it('删除遇 subtask_has_proofs ⇒ 行内 project.hasProofs，不回调页面层', async () => {
    const onDone = vi.fn()
    const error = new Error('has proofs')
    error.code = 'subtask_has_proofs'
    error.status = 409
    NET.fetchApiJson.mockRejectedValue(error)
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [verifyRow()] }), { onDone })

    fireEvent.click(deleteBtn(container, 5012))
    await waitFor(() => expect(confirmBtn(container, 5012)).not.toBeNull())
    fireEvent.click(confirmBtn(container, 5012))

    await waitFor(() => {
      const err = rowOf(container, 5012).querySelector('[data-sf-m="project-subtask-err"]')
      expect(err).not.toBeNull()
      // 删除失败带具体因由 + HTTP（原「只落 project.hasProofs」已退役）
      expect(err.textContent).toBe('project.deleteFailDetail:{"detail":"project.hasProofs","status":409}')
      expect(err.getAttribute('data-sf-err-code')).toBe('subtask_has_proofs')
      expect(err.getAttribute('role')).toBe('alert')
    })
    expect(onDone).not.toHaveBeenCalled()
    // 行仍在、删除入口回到可点态（不谎报已删）
    expect(rowOf(container, 5012)).not.toBeNull()
    expect(deleteBtn(container, 5012)).not.toBeNull()
  })

  it('编辑遇 prediction_locked_after_publish ⇒ 表单内 project.predictionLocked，不回调页面层', async () => {
    const onDone = vi.fn()
    const error = new Error('locked')
    error.code = 'prediction_locked_after_publish'
    error.status = 409
    NET.fetchApiJson.mockRejectedValue(error)
    const { container } = renderList(taskOf({ status: 'draft', subtasks: [predictionRow()] }), { onDone })

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
    expect(onDone).not.toHaveBeenCalled()
    // 表单不关（保留用户输入，可就地重试）
    expect(container.querySelector('[data-sf-m="project-form-subtask"]')).not.toBeNull()
    expect(fieldOf(container, 'title').value).toBe('改不动')
  })
})
