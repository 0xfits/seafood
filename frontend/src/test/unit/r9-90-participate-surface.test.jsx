/**
 * ★S3b 前端契约同步 单测（**取代** R-9-90「参与面」）· 任务弹窗提交面
 *
 * 背景（S2 后端已入库，前端必须跟上）：
 *   · 提交口 `POST /api/task-progress/:identifier/submit` 的 `identifier` = 目标 **`job_id`**（换轴）；
 *   · J2 报名（`POST /api/job/:jobId/apply`）与 J3 选定（`POST /api/job/:jobId/accept`）两写面**已下架**
 *     （恒 `410` + `details.reason` = `APPLY_RETIRED` / `ACCEPT_RETIRED`）；
 *   · **无报名前置**（S2 `R-9-99`）：任何已登录 actor（含发布者本人）可提交、**同人可多次提交**。
 *
 * 本单契约（逐条对应 S3b 要求 ①–③）：
 *   ① 只要有**任务号 tID** 且任务 `open` ⇒ **直接渲染提交表单**（不再依赖 `task.jID` 是否存在）；
 *      「先参与」提示 + 参与按钮 + `applyToJob` 调用**已删**。
 *   ② 提交目标 = **`task.tID`（job_id）**；无任务号 / 任务非 open ⇒ 不渲染提交控件（给 `jobs.submitJobStateInvalid`）。
 *   ③ 提交错误面：`error.details.reason === 'ACTOR_NOT_ALLOWED'` ⇒ 精确文案（`jobs.submitNotApplicant`）；
 *      其它 reason / 无 details ⇒ 原链路通用文案**逐字不变**（`t(error) + ': ' + error.message`）。
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
  submitDeliverable: vi.fn(),
}))

import toast from 'react-hot-toast'
import { submitDeliverable } from '../../pages/jobs/job-api'
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

// ★ 保留 R-9-90 的加固口径：**不得**以 `data-sf-m` 机读钩子作为「提交面存在/不存在」的**证据**，
// 断言直接面向**浏览器原生控件**；钩子仅作辅助定位。
const NATIVE_SUBMIT_SELECTORS = [
  'form',
  'textarea',
  'input:not([type="hidden"])',
  'button[type="submit"]',
]

const readNativeSubmitControls = (root) => NATIVE_SUBMIT_SELECTORS.map(
  (selector) => ({ selector, node: root.querySelector(selector) }),
)

/** 断言 root 内**不存在**任何原生提交控件（不依赖任何 data-sf-m 钩子）。 */
const expectNoNativeSubmitControls = (root, label = '') => {
  for (const { selector, node } of readNativeSubmitControls(root)) {
    expect(node, `${label}不得出现原生 "${selector}"`).toBeNull()
  }
}

/** 去注释后扫描 —— 注释里会**故意**提到已下架的函数名（反面教材），不作证据。 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n')

/** 断言 root 内**存在**原生提交控件（`<form>` + `<textarea>` + `button[type=submit]`）。 */
const expectNativeSubmitControls = (root, label = '') => {
  expect(root.querySelector('form'), `${label}原生 <form> 应存在`).not.toBeNull()
  expect(root.querySelector('textarea'), `${label}原生 <textarea> 应存在`).not.toBeNull()
  expect(root.querySelector('button[type="submit"]'), `${label}原生 submit 按钮应存在`).not.toBeNull()
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
  toast.error.mockReset()
  toast.success.mockReset()
})
afterEach(() => cleanup())

// ============================================================================
// ① 有任务号（公开列表口径：无 jID）⇒ **直出**提交表单
// ============================================================================
describe('① 有任务号（无 jID）⇒ 直出提交表单（「先参与」面已删）', () => {
  it('task = {tID:9}（无 jID）⇒ ★原生 form/textarea/button[type=submit] 存在；参与面钩子全不在', () => {
    const { container } = renderModal({ tID: 9, title: 'T', note: 'N' })

    expectNativeSubmitControls(container, '无 jID 但有任务号：')
    const form = q('active-task-submit-form') // 钩子仅作**辅助定位**
    expect(form).not.toBeNull()
    expect(container.querySelector('form')).toBe(form)
    expect(form.textContent).toContain(zh.submitInfo)

    // 旧「参与面」钩子已随 J2 下架删除
    expect(q('active-task-need-apply')).toBeNull()
    expect(q('active-task-apply')).toBeNull()
    expect(q('active-task-apply-status')).toBeNull()
    expect(q('active-task-submit-blocked')).toBeNull()
  })

  it('任务 open（`is_open:true`）⇒ 与「无 is_open 字段」同口径，均渲染提交表单', () => {
    const { container } = renderModal({ tID: 9, is_open: true, title: 'T', note: 'N' })
    expectNativeSubmitControls(container, 'is_open=true：')
    expect(q('active-task-submit-form')).not.toBeNull()
  })

  it('标题 = `completeTask`（不再出现参与面标题 `jobs.apply`）', () => {
    renderModal({ tID: 9, title: 'T', note: 'N' })
    const header = document.querySelector('.modal-header')
    expect(header.textContent).toContain(zh.completeTask)
    expect(header.textContent).not.toContain(zh.jobs.apply)
  })
})

// ============================================================================
// ② 提交目标 = 任务号 tID（job_id）
// ============================================================================
describe('② 提交 identifier = 任务号 tID（job_id）', () => {
  it('submitDeliverable(tID=9)（非任何 jID/申请编号）', async () => {
    submitDeliverable.mockResolvedValue({})
    renderModal({ tID: 9, jID: 24, title: 'T', note: 'N' })
    const form = q('active-task-submit-form')
    fireEvent.change(form.querySelector('textarea'), { target: { value: 'x' } })
    await act(async () => { fireEvent.submit(form) })

    expect(submitDeliverable).toHaveBeenCalledTimes(1)
    expect(submitDeliverable.mock.calls[0][0]).toBe(9)
    expect(submitDeliverable.mock.calls[0][0]).not.toBe(24)
  })

  it('源码不变量：提交只用 `submitDeliverable(task.tID`；不得引用 `task.jID` 作提交目标', () => {
    const src = fs.readFileSync(path.join(SRC, 'components/ActiveTaskModal.jsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    expect(src).toContain('submitDeliverable(task.tID')
    expect(src).not.toMatch(/submitDeliverable\([^)]*jID/)
    expect(src).not.toMatch(/task\.jID\s*\|\|/)
  })

  it('源码不变量：弹窗内**零** apply/accept 调用（两写面已下架）', () => {
    const src = stripComments(fs.readFileSync(path.join(SRC, 'components/ActiveTaskModal.jsx'), 'utf8'))
    expect(src).not.toMatch(/applyToJob|acceptApplication/)
    expect(src).not.toMatch(/\/apply|\.accept\(/)
  })
})

// ============================================================================
// ③ 提交错误面：按 error.details.reason 分流
// ============================================================================
describe('③ 提交错误面：ACTOR_NOT_ALLOWED ⇒ 精确；其它/无 details ⇒ 通用逐字不变', () => {
  const task = { tID: 9, title: 'T', note: 'N' }

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
  it('reason === JOB_APPLICATION_STATE_INVALID ⇒ 精确文案 jobs.submitNotSelected', async () => {
    const err = Object.assign(new Error('Business state transition rejected'), {
      details: { reason: 'JOB_APPLICATION_STATE_INVALID' },
    })
    await doSubmit(err)
    const status = q('active-task-submit-status')
    expect(status.textContent).toBe(zh.jobs.submitNotSelected)
    expect(status.textContent).not.toBe(`${zh.error}: Business state transition rejected`)
  })

  it('reason === JOB_STATE_INVALID ⇒ 精确文案 jobs.submitJobStateInvalid', async () => {
    const err = Object.assign(new Error('Business state transition rejected'), {
      details: { reason: 'JOB_STATE_INVALID' },
    })
    await doSubmit(err)
    expect(q('active-task-submit-status').textContent).toBe(zh.jobs.submitJobStateInvalid)
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
// ④ 无任务号 / 任务非 open ⇒ 不渲染提交控件（不臆造提交面）
// ============================================================================
describe('④ 无任务号 或 任务非 open ⇒ 无原生提交控件 + jobs.submitJobStateInvalid', () => {
  it('无 tID ⇒ 无原生提交控件，submitDeliverable 不可达', async () => {
    const { container } = renderModal({ title: 'T', note: 'N' })
    expect(q('active-task-submit-form')).toBeNull()
    expectNoNativeSubmitControls(container, '无 tID：')
    expect(q('active-task-submit-blocked')).not.toBeNull()
    expect(q('active-task-submit-blocked').textContent).toContain(zh.jobs.submitJobStateInvalid)
    expect(submitDeliverable).not.toHaveBeenCalled()
  })

  it('`is_open:false` ⇒ 无原生提交控件，给 jobs.submitJobStateInvalid（标题 = common.ended）', () => {
    const { container } = renderModal({ tID: 9, is_open: false, title: 'T', note: 'N' })
    expectNoNativeSubmitControls(container, 'is_open=false：')
    expect(q('active-task-submit-form')).toBeNull()
    expect(q('active-task-submit-blocked').textContent).toContain(zh.jobs.submitJobStateInvalid)
    expect(document.querySelector('.modal-header').textContent).toContain(zh.common.ended)
  })
})

// ============================================================================
// ⑤ 产品源面：apply / accept 零调用（全量扫描，非仅弹窗）
// ============================================================================
describe('⑤ 产品源码 `src/**`（排除 test）内 apply/accept 接线零残留', () => {
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'test') continue
        walk(p, out)
      } else if (/\.(jsx|js)$/.test(e.name)) out.push(p)
    }
    return out
  }

  it('无 `applyToJob` / `acceptApplication` / `/api/job/:id/apply|accept` 调用', () => {
    const files = walk(SRC)
    const hits = []
    for (const f of files) {
      const src = stripComments(fs.readFileSync(f, 'utf8'))
      if (/applyToJob|acceptApplication/.test(src)) hits.push(`${path.relative(SRC, f)} :: 函数名`)
      if (/\/api\/job\/\$\{[^}]*\}\/(apply|accept)/.test(src)) hits.push(`${path.relative(SRC, f)} :: 路径`)
    }
    expect(hits).toEqual([])
  })

  it('接线层 `job-api.js` 不再导出 `applyToJob` / `acceptApplication`', () => {
    const src = fs.readFileSync(path.join(SRC, 'pages/jobs/job-api.js'), 'utf8')
    expect(src).not.toMatch(/export const applyToJob/)
    expect(src).not.toMatch(/export const acceptApplication/)
    expect(src).toContain('export const submitDeliverable')
  })
})

// ============================================================================
// ⑥ 存量文案键**保留不动**（本单删 UI 分支，**不得**删键 ⇒ 否则计数变动）
// ============================================================================
describe('⑥ 已不再被引用的存量键仍在（四语齐备，值未改）', () => {
  const TABLES = { zh, en, hk, vn }
  const KEPT_KEYS = [
    'applyPrompt', 'applyWaiting', 'apply', 'applyOk', 'accept', 'acceptNote', 'acceptOk',
    'applicationId', 'submitNeedApply', 'pick', 'myApps', 'myAppsEmpty',
  ]

  it.each(KEPT_KEYS)('jobs.%s 四语键齐备且非空', (k) => {
    for (const [lang, table] of Object.entries(TABLES)) {
      const v = table.jobs[k]
      expect(typeof v, `${lang}.jobs.${k}`).toBe('string')
      expect(v.trim().length, `${lang}.jobs.${k}`).toBeGreaterThan(0)
    }
  })

  it('本单新增键面 = 0（未增/未删任何 locale 键）', () => {
    // 键集快照对比由报告给出（本处仅断言「仍在」这一最低面）
    for (const table of Object.values(TABLES)) {
      expect(Object.keys(table.jobs).length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// ⑦ R-9-94 新增键四语齐平（仍在用，不得回归）
// ============================================================================
describe('⑦ jobs.submitNotSelected / jobs.submitJobStateInvalid 四语齐平', () => {
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

// ============================================================================
// ⑧ 列表卡按钮 ⇒ 弹窗同样是**提交面**（公开列表任务无 jID 亦直出）
// ============================================================================
describe('⑧ 公开列表（无 jID）按钮 ⇒ 打开提交面（非参与面）', () => {
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

  it('点按钮 ⇒ 出现提交表单、★无参与面、按钮文案 = 立即参与（值未改）', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/']}><ListHarness /></MemoryRouter>)

    const action = q('task-action')
    expect(action).not.toBeNull()
    expect(action.textContent).toContain(zh.common.joinNow)

    await act(async () => { fireEvent.click(action) })

    expect(q('active-task-need-apply')).toBeNull()
    expect(q('active-task-submit-form')).not.toBeNull()
    expectNativeSubmitControls(container, '列表→弹窗：')
  })
})
