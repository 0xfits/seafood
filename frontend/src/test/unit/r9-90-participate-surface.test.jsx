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

// ★ 本单修补（收紧断言强度）：**不得**以 `data-sf-m` 机读钩子作为「提交面存在/不存在」的**证据**。
// 独立质检已证：旧写法只锚钩子（`q('active-task-submit-form')`）⇒ 注入一个**真实**
// `<form><textarea/></form>`（不带任何 `data-sf-m`）时该套件仍 11/11 全绿 = **假绿/漏判**。
// 下列读数直接面向**浏览器原生控件**；钩子仅保留作**辅助定位**容器。
// 负对照（仓外副本注入无钩子提交框 ⇒ 本套件必红）见本单质检读数；此处为「防假绿」加固。
const NATIVE_SUBMIT_SELECTORS = [
  'form',
  'textarea',
  'input:not([type="hidden"])',
  'button[type="submit"]',
]

/** root 内首个原生提交控件的 [{selector, node}] 读数（辅助失败时定位红点）。 */
const readNativeSubmitControls = (root) => NATIVE_SUBMIT_SELECTORS.map(
  (selector) => ({ selector, node: root.querySelector(selector) }),
)

/** 断言 root 内**不存在**任何原生提交控件（不依赖任何 data-sf-m 钩子）。 */
const expectNoNativeSubmitControls = (root, label = '') => {
  for (const { selector, node } of readNativeSubmitControls(root)) {
    expect(node, `${label}不得出现原生 "${selector}"`).toBeNull()
  }
}

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

  it('无 jID ⇒ ★原生 form/textarea/input/button[type=submit] 全为 null，出现 jobs.applyPrompt（逐字）且标题/按钮 = jobs.apply', () => {
    const { container } = renderModal(taskNoJID)
    const pane = q('active-task-need-apply') // 钩子仅作**辅助定位**，不作「无提交面」的证据

    // ★ 原生结构断言：对「整个弹窗容器」+「参与面容器」各查一遍
    //   （若产品在该分支偷偷渲染一个不带 data-sf-m 的提交框 ⇒ 此处必红；负对照已证）
    expectNoNativeSubmitControls(container, '弹窗容器：')
    expect(pane, '参与面容器应存在（辅助定位）').not.toBeNull()
    expectNoNativeSubmitControls(pane, '参与面：')
    // 旧钩子读数保留作辅助/回归对照 —— 但**不得单独**作为存在性证明（本单修补点）
    expect(q('active-task-submit-form')).toBeNull()

    expect(pane.textContent).toContain(zh.jobs.applyPrompt)
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
  it('jID=24 ⇒ ★原生 form/textarea/button[type=submit] 存在（反件）、参与面不在', () => {
    const { container } = renderModal({ tID: 9, jID: 24, title: 'T', note: 'N' })
    const form = q('active-task-submit-form') // 钩子：辅助定位

    // ★ 反件：原生提交控件必须**真实存在**（不靠钩子自证）
    expect(container.querySelector('form'), '原生 <form> 应存在').not.toBeNull()
    expect(container.querySelector('form')).toBe(form)
    expect(container.querySelector('textarea'), '原生 <textarea> 应存在').not.toBeNull()
    expect(container.querySelector('button[type="submit"]'), '原生 submit 按钮应存在').not.toBeNull()
    // 口径：产品提交面交付物控件为 <textarea>，源码**无** <input> 节点，
    //       故「input 存在」不作反件断言；no-jID 侧「input 为 null」仍约束「不得凭空多出可见输入框」。

    expect(q('active-task-need-apply')).toBeNull()
    expect(form.textContent).toContain(zh.submitInfo)
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

  // R-9-94（同族补齐）：另两条 `stateConflict` reason ⇒ 亦给精确文案
  it('reason === JOB_APPLICATION_STATE_INVALID ⇒ 精确文案 jobs.submitNotSelected（未被雇主选定）', async () => {
    const err = Object.assign(new Error('Business state transition rejected'), {
      details: { reason: 'JOB_APPLICATION_STATE_INVALID' },
    })
    await doSubmit(err)
    const status = q('active-task-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitNotSelected)
    expect(status.textContent).not.toBe(`${zh.error}: Business state transition rejected`)
  })

  it('reason === JOB_STATE_INVALID ⇒ 精确文案 jobs.submitJobStateInvalid（任务态不允许提交交付物）', async () => {
    const err = Object.assign(new Error('Business state transition rejected'), {
      details: { reason: 'JOB_STATE_INVALID' },
    })
    await doSubmit(err)
    const status = q('active-task-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitJobStateInvalid)
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

  it('无 jID ⇒ 无原生提交控件，submitDeliverable 不可达', () => {
    const { container } = renderModal({ tID: 9, title: 'T', note: 'N' })
    expect(q('active-task-submit-form')).toBeNull()
    expectNoNativeSubmitControls(container, '无 jID：')
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

  it('点按钮 ⇒ 出现参与面、★无原生提交控件、按钮文案 = 立即参与', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/']}><ListHarness /></MemoryRouter>)

    const action = q('task-action')
    expect(action).not.toBeNull()
    expect(action.textContent).toContain(zh.common.joinNow)

    await act(async () => { fireEvent.click(action) })

    expect(q('active-task-need-apply')).not.toBeNull()
    expect(q('active-task-submit-form')).toBeNull()
    expectNoNativeSubmitControls(container, '列表→弹窗：')
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

// ============================================================================
// ⑦ 新增键（R-9-94）jobs.submitNotSelected / jobs.submitJobStateInvalid 四语齐平
// ============================================================================
describe('⑦ 新增键 jobs.submitNotSelected / jobs.submitJobStateInvalid 四语齐平', () => {
  const TABLES = { zh, en, hk, vn }
  const CJK = /[\u4E00-\u9FFF]/

  it('两键四语齐备、非空、四语互异；en/vn 零 CJK', () => {
    for (const k of ['submitNotSelected', 'submitJobStateInvalid']) {
      const vals = Object.values(TABLES).map((tb) => tb.jobs[k])
      for (const v of vals) {
        expect(typeof v, `jobs.${k}`).toBe('string')
        expect(v.trim().length, `jobs.${k}`).toBeGreaterThan(0)
      }
      expect(new Set(vals).size, `jobs.${k} 四语应互异`).toBe(4)
      expect(CJK.test(en.jobs[k]), `en.jobs.${k}`).toBe(false)
      expect(CJK.test(vn.jobs[k]), `vn.jobs.${k}`).toBe(false)
    }
  })
})
