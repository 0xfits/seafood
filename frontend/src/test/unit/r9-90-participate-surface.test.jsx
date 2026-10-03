/**
 * R-9-90 / R-9-91 / R-9-92 单测（本单新增）· 任务弹窗「参与 / 提交」双面
 *
 * 生产缺陷（D8 同族第三入口）：`ActiveTaskModal` 旧写法
 *   `fetch(`/api/task-progress/${task.jID || task.tID}/submit`)`
 * 在公开列表（`/api/task/all` 无 jID）上把**任务号 tID** 当**申请编号 identifier** 提交
 * ⇒ 后端 `resolveJobApplication(24, uid)` 命中**别人的**申请 ⇒ `403 AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`。
 *
 * 本单契约（逐条对应要求 ①–④）：
 *   ① 无 jID ⇒ **不渲染提交表单**，改给「先参与」提示（`jobs.applyPrompt`）+ 参与按钮
 *      （`applyToJob(task.tID)`）；成功 ⇒ `jobs.applyWaiting`。
 *   ② 有 jID ⇒ 渲染提交表单（提交目标 = jID）。
 *   ③ 提交错误面：`error.details.reason === 'ACTOR_NOT_ALLOWED'` ⇒ 精确文案（`jobs.submitNotApplicant`）；
 *      其它 reason / 无 details ⇒ 原链路通用文案**逐字不变**（`t(error) + ': ' + error.message`）。
 *   ④ 无「任务号当选申请编号」回退：源码不变量 + 提交调用只用 jID。
 *
 * 口径：i18n 用真四语表（zh）逐字断言；`job-api` / `auth` 按既有单测口径 mock。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const H = vi.hoisted(() => {
  const state = { lang: 'zh', table: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    return v === undefined ? key : v
  }
  return state
})

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../auth', () => ({ clearAuthSession: vi.fn() }))
vi.mock('../../pages/jobs/job-api', () => ({
  applyToJob: vi.fn(),
  submitDeliverable: vi.fn(),
}))

import toast from 'react-hot-toast'
import { applyToJob, submitDeliverable } from '../../pages/jobs/job-api'
import ActiveTaskModal from '../../components/ActiveTaskModal'
import { TaskCard } from '../../components/task/TaskCard'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEST_USER = { uID: 7, token: 'aaa.bbb.ccc' }

// `src/test/setup.js` 把 `localStorage` mock 成无底层的纯 spy ⇒ 逐条实现「键值存储」口径
// （与 `auth.test.js:23` 同源），否则 `ActiveTaskModal` 的 token 预检恒判「无凭证」。
const storage = {}

const renderModal = (task) => render(
  <MemoryRouter initialEntries={['/']}>
    <ActiveTaskModal open onClose={() => {}} task={task} />
  </MemoryRouter>,
)

const q = (m) => document.querySelector(`[data-sf-m="${m}"]`)

beforeEach(() => {
  H.table = zh
  H.lang = 'zh'
  for (const key of Object.keys(storage)) delete storage[key]
  storage.user = JSON.stringify(TEST_USER)
  localStorage.getItem.mockImplementation((key) => storage[key] ?? null)
  localStorage.setItem.mockImplementation((key, value) => { storage[key] = String(value) })
  localStorage.removeItem.mockImplementation((key) => { delete storage[key] })
  localStorage.clear.mockImplementation(() => { for (const key of Object.keys(storage)) delete storage[key] })
  submitDeliverable.mockReset()
  applyToJob.mockReset()
  toast.error.mockReset()
  toast.success.mockReset()
})
afterEach(() => cleanup())

// ============================================================================
// ① 无 jID ⇒ 参与面（不渲染提交表单）
// ============================================================================
describe('① 无 jID ⇒ 不渲染提交表单，给「先参与」提示 + 参与按钮', () => {
  const taskNoJID = { tID: 9, title: 'T', note: 'N' }

  it('无 jID ⇒ 无提交表单，出现 jobs.applyPrompt（逐字）且标题/按钮 = jobs.apply', () => {
    renderModal(taskNoJID)

    expect(q('active-task-submit-form')).toBeNull()
    expect(q('active-task-need-apply')).not.toBeNull()
    expect(q('active-task-need-apply').textContent).toContain(zh.jobs.applyPrompt)
    expect(q('active-task-apply')).not.toBeNull()
    expect(q('active-task-apply').textContent).toContain(zh.jobs.apply)
  })

  it('点参与按钮 ⇒ applyToJob(tID, user)；成功 ⇒ jobs.applyWaiting（且不调 submitDeliverable）', async () => {
    applyToJob.mockResolvedValue({})
    renderModal(taskNoJID)

    await act(async () => { fireEvent.click(q('active-task-apply')) })

    expect(applyToJob).toHaveBeenCalledTimes(1)
    expect(applyToJob.mock.calls[0][0]).toBe(9)
    await waitFor(() => expect(q('active-task-apply-status').textContent).toBe(zh.jobs.applyWaiting))
    expect(submitDeliverable).not.toHaveBeenCalled()
  })
})

// ============================================================================
// ② 有 jID ⇒ 提交面
// ============================================================================
describe('② 有 jID ⇒ 渲染提交表单', () => {
  it('jID=24 ⇒ 提交表单在、参与面不在', () => {
    renderModal({ tID: 9, jID: 24, title: 'T', note: 'N' })

    expect(q('active-task-submit-form')).not.toBeNull()
    expect(q('active-task-need-apply')).toBeNull()
    expect(q('active-task-submit-form').textContent).toContain(zh.submitInfo)
  })
})

// ============================================================================
// ③ 提交错误面：按 error.details.reason 分流
// ============================================================================
describe('③ 提交错误面：ACTOR_NOT_ALLOWED ⇒ 精确；其它/无 details ⇒ 通用逐字不变', () => {
  const task = { tID: 9, jID: 24, title: 'T', note: 'N' }

  const doSubmit = async (rejection) => {
    submitDeliverable.mockRejectedValue(rejection)
    renderModal(task)
    const form = q('active-task-submit-form')
    fireEvent.change(form.querySelector('textarea'), { target: { value: 'deliverable' } })
    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => expect(q('active-task-submit-status').textContent).not.toBe(''))
  }

  it('reason === ACTOR_NOT_ALLOWED ⇒ 精确文案 jobs.submitNotApplicant（非通用「无权执行该操作」）', async () => {
    const err = Object.assign(new Error('当前账号无权执行该操作'), { details: { reason: 'ACTOR_NOT_ALLOWED' } })
    await doSubmit(err)
    const status = q('active-task-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitNotApplicant)
    expect(status.textContent).not.toContain('无权执行')
  })

  it('其它 reason ⇒ 原链路通用文案逐字不变（t(error) + ": " + message）', async () => {
    const err = Object.assign(new Error('generic failure'), { details: { reason: 'SOME_OTHER_REASON' } })
    await doSubmit(err)
    const status = q('active-task-submit-status')
    expect(status.textContent).toBe(`${zh.error}: generic failure`)
    expect(status.textContent).not.toBe(zh.jobs.submitNotApplicant)
  })

  it('拿不到 reason（无 details）⇒ 原链路通用文案逐字不变', async () => {
    await doSubmit(new Error('network down'))
    const status = q('active-task-submit-status')
    expect(status.textContent).toBe(`${zh.error}: network down`)
    expect(status.textContent).not.toBe(zh.jobs.submitNotApplicant)
  })
})

// ============================================================================
// ④ 无「任务号当选申请编号」回退
// ============================================================================
describe('④ 提交目标只认 jID（杜绝「任务号当选申请编号」回退）', () => {
  it('提交调用 submitDeliverable(jID=24)（非 tID=9）', async () => {
    submitDeliverable.mockResolvedValue({})
    renderModal({ tID: 9, jID: 24, title: 'T', note: 'N' })
    const form = q('active-task-submit-form')
    fireEvent.change(form.querySelector('textarea'), { target: { value: 'x' } })
    await act(async () => { fireEvent.submit(form) })

    expect(submitDeliverable).toHaveBeenCalledTimes(1)
    expect(submitDeliverable.mock.calls[0][0]).toBe(24)
    expect(submitDeliverable.mock.calls[0][0]).not.toBe(9)
  })

  it('源码不变量：不得出现 `task.jID || task.tID` 回退；提交只用 `submitDeliverable(task.jID`', () => {
    // 去注释后扫描（注释里引用了旧写法作为「反面教材」）
    const src = fs.readFileSync(path.join(SRC, 'components/ActiveTaskModal.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    expect(src).not.toMatch(/task\.jID\s*\|\|\s*task\.tID/)
    expect(src).not.toMatch(/jID\s*\|\|\s*task\.tID/)
    expect(src).toContain('submitDeliverable(task.jID')
  })

  it('无 jID ⇒ 无提交表单，submitDeliverable 不可达', () => {
    renderModal({ tID: 9, title: 'T', note: 'N' })
    expect(q('active-task-submit-form')).toBeNull()
    expect(submitDeliverable).not.toHaveBeenCalled()
  })
})

// ============================================================================
// ⑤ 公开列表按钮语义 = 参与（TaskCard → 弹窗为参与面，非提交面）
// ============================================================================
describe('⑤ 公开列表（无 jID）按钮 ⇒ 打开「参与」面（非提交表单）', () => {
  const ListHarness = () => {
    const [task, setTask] = React.useState(null)
    return (
      <>
        <TaskCard
          task={{ tID: 9, title: 'T', description: 'N', status: 'active', statusText: 'ongoing' }}
          onAction={setTask}
        />
        {task && <ActiveTaskModal open onClose={() => setTask(null)} task={task} />}
      </>
    )
  }

  it('点按钮 ⇒ 出现参与面、无提交表单、按钮文案 = 立即参与', async () => {
    render(<MemoryRouter initialEntries={['/']}><ListHarness /></MemoryRouter>)

    const action = q('task-action')
    expect(action).not.toBeNull()
    expect(action.textContent).toContain(zh.common.joinNow)

    await act(async () => { fireEvent.click(action) })

    expect(q('active-task-need-apply')).not.toBeNull()
    expect(q('active-task-submit-form')).toBeNull()
  })
})

// ============================================================================
// ⑥ 新增键四语齐平（本单新增 2 键 · jobs 既有顶层）
// ============================================================================
describe('⑥ 新增键 jobs.applyPrompt / jobs.applyWaiting 四语齐平', () => {
  const TABLES = { zh, en, hk, vn }
  const CJK = /[\u4E00-\u9FFF]/

  it('两键四语齐备、非空、四语互异；en/vn 零 CJK', () => {
    for (const k of ['applyPrompt', 'applyWaiting']) {
      const vals = Object.values(TABLES).map((tb) => tb.jobs[k])
      for (const v of vals) {
        expect(typeof v, `jobs.${k}`).toBe('string')
        expect(v.trim().length, `jobs.${k}`).toBeGreaterThan(0)
      }
      expect(new Set(vals).size).toBe(4)
      expect(CJK.test(en.jobs[k])).toBe(false)
      expect(CJK.test(vn.jobs[k])).toBe(false)
    }
  })
})
