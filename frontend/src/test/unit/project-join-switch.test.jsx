/**
 * 项目页 `/:slug` · 加入 / 切换（Kevin 2026-10-23）
 * ----------------------------------------------------------------------------
 * 被钉死的契约面（后端 commit `c1995a6`；本文件夹 = 前端侧承重面）：
 *   ① **三态入口**（判据只认详情读口 `GET /api/project/:ref` 的登录态加性四键
 *      `my_role` / `my_hired_at` / `my_current_project_id` / `my_current_project_title`）：
 *        · `my_role === 'hired'`（在本项目）⇒ 只渲染【已在职】置灰钮；
 *        · `my_role !== 'hired'` ∧ `my_current_project_id` 有值（在他项目）⇒ 【切换到此项目】；
 *        · 两者皆无 ⇒ 【加入此项目】；匿名 ⇒ 整块 `project-join` **不渲染**（入口不诱骗未登录用户）。
 *   ② **切换行内二次确认**（不 `window.confirm`）：点【切换到此项目】只展开确认行
 *      （`project-entry-switch-confirm` + 文案含「当前在职 X」）⇒ **确认前零 apply 请求**；
 *      取消 ⇒ 收回确认行、零请求；
 *   ③ **载荷逐键对拍**：确认后恰 `{switch:true}`（键集 = `['switch']`，不多不少）；
 *      加入走 `{}`（**不带 switch**，即「缺省 = 旧行为」不许前端偷偷补 true）；
 *   ④ **四闸失败内联**（`writeFailNotice(…, 'project.joinFailDetail')`）：
 *      `worker_already_hired` / `project_headcount_full` / `project_min_days_unmet` /
 *      `project_not_recruiting` ⇒ 页内 err 提示带中文因由 + HTTP 状态，卡片与页面不白屏；
 *   ⑤ 成功 ⇒ 页内 ok 提示（切换文案带新项目标题）+ **静默重拉**详情（三态即时翻转）。
 *
 * 手法：只 mock 两个边界（`project-api` 出参 + `auth-context` 登录态），页面逻辑全跑真实现；
 *      `t` 用真 `zh.json`（断言「用户实际看到的句子」）；管理员三键加载器替身返回 null
 *      ⇒ 页面 owner 面全程为假（`canManage=false`，加入区提示才会渲染）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') // = frontend/src
const ZH = JSON.parse(fs.readFileSync(path.join(SRC, 'locales/zh.json'), 'utf8'))

/** 真 zh 表 t（只做 `{{x}}` 插值）⇒ 断言「用户实际看到的句子」，不是键名。 */
const zhT = (key, values) => {
  const value = key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), ZH)
  if (typeof value !== 'string') return key
  if (!values) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''))
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: zhT,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

/** 写口 / 读口边界替身：键集与 `project-api` 现取一致（缺键会让页面 import 到 undefined）。 */
const API = vi.hoisted(() => ({
  fetchProjectDetail: vi.fn(),
  fetchProjectCurrencies: vi.fn(),
  applyToProject: vi.fn(),
  patchProject: vi.fn(),
  uploadProjectAvatar: vi.fn(),
  createProjectCampaign: vi.fn(),
  patchProjectCampaign: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  patchProjectTaskStatus: vi.fn(),
  appendProjectSubtasks: vi.fn(),
  editProjectSubtask: vi.fn(),
  removeProjectSubtasks: vi.fn(),
}))
vi.mock('../../pages/project/project-api', () => ({
  fetchProjectDetail: API.fetchProjectDetail,
  fetchProjectCurrencies: API.fetchProjectCurrencies,
  applyToProject: API.applyToProject,
  patchProject: API.patchProject,
  uploadProjectAvatar: API.uploadProjectAvatar,
  createProjectCampaign: API.createProjectCampaign,
  patchProjectCampaign: API.patchProjectCampaign,
  createProjectCampaignTask: API.createProjectCampaignTask,
  patchProjectTaskStatus: API.patchProjectTaskStatus,
  appendProjectSubtasks: API.appendProjectSubtasks,
  editProjectSubtask: API.editProjectSubtask,
  removeProjectSubtasks: API.removeProjectSubtasks,
}))

/** 管理员三键加载器替身：一律 null ⇒ `canManage=false`（加入区提示行才会渲染）。 */
const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import ProjectPage from '../../pages/project/ProjectPage'

const renderAt = (entry = '/sui') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

/** 详情读口真形状（含登录态四键）；`owner_uid` 故意 = 别人 ⇒ 本文件全程 owner 面为假。 */
const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 1,
  owner_uid: 999001,
  wage_batt_per_claim: 30,
  wage_interval_hours: 4,
  wage_currency_amount: 0,
  wage_cid: null,
  campaigns: [],
  my_role: 'none',
  my_hired_at: null,
  my_current_project_id: null,
  my_current_project_title: null,
  ...patch,
})

/** 页面读口三键（`fetchProjectCurrencies` 出参 = 行数组）。 */
const before = () => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  API.fetchProjectCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }])
  API.fetchProjectDetail.mockResolvedValue(viewOf())
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
  API.applyToProject.mockResolvedValue({ worker: { project_id: '11' }, project: { title: '海鲜打包' }, switched_from: null })
}

/** 等三态入口落地（页面进入 ready 相：`project-join` 区出现） */
const waitJoin = async (container) => {
  await waitFor(() => expect(container.querySelector('[data-sf-m="project-join"]')).not.toBeNull())
  return container.querySelector('[data-sf-m="project-join"]')
}

const joinBtn = (container) => container.querySelector('[data-sf-action="join"]')
const switchBtn = (container) => container.querySelector('[data-sf-m="project-entry-switch"]')
const confirmBtn = (container) => container.querySelector('[data-sf-m="project-entry-switch-confirm"]')
const hiredBtn = (container) => container.querySelector('[data-sf-m="project-entry-hired"]')
const noticeOf = (container) => container.querySelector('[data-sf-m="project-form-notice"]')

beforeEach(before)
afterEach(cleanup)

// ============================================================================
describe('① 三态入口（只认读口四键）', () => {
  it('在本项目在职（my_role=hired）⇒ 只渲染【已在职】**置灰**；零【加入】/【切换】/零确认行', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({
      my_role: 'hired', my_hired_at: '2026-10-22T00:00:00.000Z',
      my_current_project_id: '11', my_current_project_title: '海鲜打包',
    }))
    const { container } = renderAt()
    await waitJoin(container)

    expect(hiredBtn(container)).not.toBeNull()
    expect(hiredBtn(container).disabled).toBe(true)
    expect(hiredBtn(container).textContent).toBe(ZH.project.alreadyHired)
    expect(joinBtn(container)).toBeNull()
    expect(switchBtn(container)).toBeNull()
    expect(confirmBtn(container)).toBeNull()

    // 置灰钮点了也不该发请求
    fireEvent.click(hiredBtn(container))
    expect(API.applyToProject).not.toHaveBeenCalled()
  })

  it('在**他项目**在职（my_role=none + my_current_project_id 有值）⇒ 【切换到此项目】（不是【加入】）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({
      my_role: 'none', my_current_project_id: '99', my_current_project_title: '冷库分拣',
    }))
    const { container } = renderAt()
    await waitJoin(container)

    expect(switchBtn(container)).not.toBeNull()
    expect(switchBtn(container).textContent).toBe(ZH.project.switchEntry)
    expect(switchBtn(container).disabled).toBe(false)
    expect(joinBtn(container)).toBeNull()
    expect(hiredBtn(container)).toBeNull()
    expect(confirmBtn(container)).toBeNull() // 确认行默认收起
  })

  it('不在职（四键在场且 current=null）⇒ 【加入此项目】', async () => {
    const { container } = renderAt()
    await waitJoin(container)

    expect(joinBtn(container)).not.toBeNull()
    expect(joinBtn(container).textContent).toBe(ZH.project.joinEntry)
    expect(switchBtn(container)).toBeNull()
    expect(hiredBtn(container)).toBeNull()
  })

  it('匿名 ⇒ 整块加入区不渲染（三态钮与确认行全 0，页面其余部分照常）', async () => {
    AUTH.isAuthenticated = false
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-title"]')).not.toBeNull())

    expect(container.querySelector('[data-sf-m="project-join"]')).toBeNull()
    expect(joinBtn(container)).toBeNull()
    expect(switchBtn(container)).toBeNull()
    expect(hiredBtn(container)).toBeNull()
    expect(API.applyToProject).not.toHaveBeenCalled()
  })
})

// ============================================================================
describe('② 切换 · 行内二次确认（确认前零请求）', () => {
  const elsewhere = () => viewOf({
    my_role: 'none', my_current_project_id: '99', my_current_project_title: '冷库分拣',
  })

  it('点【切换到此项目】⇒ 只展开确认行（文案含当前在职项目），**零 apply 请求**', async () => {
    API.fetchProjectDetail.mockResolvedValue(elsewhere())
    const { container } = renderAt()
    await waitJoin(container)

    fireEvent.click(switchBtn(container))

    await waitFor(() => expect(confirmBtn(container)).not.toBeNull())
    const text = container.querySelector('[data-sf-m="project-switch-confirm-text"]')
    expect(text.textContent).toBe(zhT('project.switchConfirm', { title: '冷库分拣' }))
    expect(text.textContent).toContain('冷库分拣')
    expect(confirmBtn(container).textContent).toBe(ZH.project.switchConfirmOk)
    expect(container.querySelector('[data-sf-m="project-entry-switch-cancel"]')).not.toBeNull()
    // 确认前：一次写口都没有
    expect(API.applyToProject).not.toHaveBeenCalled()
  })

  it('确认 ⇒ 载荷**恰** `{switch:true}`（键集只有 switch）+ 成功提示 + 静默重拉详情', async () => {
    API.fetchProjectDetail.mockResolvedValue(elsewhere())
    const { container } = renderAt()
    await waitJoin(container)
    fireEvent.click(switchBtn(container))
    await waitFor(() => expect(confirmBtn(container)).not.toBeNull())

    const callsBefore = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(confirmBtn(container))

    await waitFor(() => expect(API.applyToProject).toHaveBeenCalledTimes(1))
    const [ref, body, user] = API.applyToProject.mock.calls[0]
    expect(ref).toBe(11) // 项目主键（不是 slug）
    expect(body).toEqual({ switch: true })
    expect(Object.keys(body)).toEqual(['switch']) // 不多不少（不带 project_id 等杂键）
    expect(user).toEqual({ uID: 7 })

    // 成功提示（切换专用文案，带目标项目标题）+ 确认行收起 + 重拉详情
    await waitFor(() => expect(noticeOf(container)).not.toBeNull())
    expect(noticeOf(container).getAttribute('data-sf-kind')).toBe('ok')
    expect(noticeOf(container).textContent).toBe(zhT('project.switchedOk', { title: '海鲜打包' }))
    expect(confirmBtn(container)).toBeNull()
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('取消 ⇒ 确认行收回成【切换到此项目】，零 apply、零重拉', async () => {
    API.fetchProjectDetail.mockResolvedValue(elsewhere())
    const { container } = renderAt()
    await waitJoin(container)
    fireEvent.click(switchBtn(container))
    await waitFor(() => expect(confirmBtn(container)).not.toBeNull())

    const loads = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(container.querySelector('[data-sf-m="project-entry-switch-cancel"]'))

    await waitFor(() => expect(confirmBtn(container)).toBeNull())
    expect(switchBtn(container)).not.toBeNull()
    expect(API.applyToProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(loads)
  })
})

// ============================================================================
describe('③ 加入 · 载荷无 switch（缺省 = 旧行为）', () => {
  it('点【加入此项目】⇒ `{}`（键集为空，**不得**偷偷带 switch:true）+ 成功提示 + 重拉', async () => {
    const { container } = renderAt()
    await waitJoin(container)

    fireEvent.click(joinBtn(container))

    await waitFor(() => expect(API.applyToProject).toHaveBeenCalledTimes(1))
    const [ref, body] = API.applyToProject.mock.calls[0]
    expect(ref).toBe(11)
    expect(body).toEqual({})
    expect(Object.keys(body)).toEqual([])
    expect(JSON.stringify(body)).toBe('{}')

    await waitFor(() => expect(noticeOf(container)).not.toBeNull())
    expect(noticeOf(container).getAttribute('data-sf-kind')).toBe('ok')
    expect(noticeOf(container).textContent).toBe(zhT('wage.joinedToast', { title: '海鲜打包' }))
  })
})

// ============================================================================
describe('④ 四闸失败 · 页内内联文案（reason → 中文因由 + HTTP）', () => {
  const GATES = [
    ['worker_already_hired', 'reasonAlreadyHired', 409],
    ['project_headcount_full', 'reasonHeadcountFull', 409],
    ['project_min_days_unmet', 'reasonMinDaysUnmet', 409],
    ['project_not_recruiting', 'reasonNotRecruiting', 409],
  ]

  for (const [reason, reasonKey, status] of GATES) {
    it(`${reason} ⇒ err 提示「${ZH.project[reasonKey]}（HTTP ${status}）」、按钮回到可用、页面不白屏`, async () => {
      const failure = Object.assign(new Error('gate'), {
        status,
        code: 'LEDGER_INSUFFICIENT_BALANCE',
        details: { reason },
      })
      API.applyToProject.mockRejectedValue(failure)
      const { container } = renderAt()
      await waitJoin(container)

      fireEvent.click(joinBtn(container))

      await waitFor(() => expect(noticeOf(container)).not.toBeNull())
      expect(noticeOf(container).getAttribute('data-sf-kind')).toBe('err')
      expect(noticeOf(container).textContent)
        .toBe(zhT('project.joinFailDetail', { detail: ZH.project[reasonKey], status }))
      // 页面结构未塌：项目头 / 加入区仍在，按钮回到可用（可重试）
      expect(container.querySelector('[data-sf-m="project-title"]')).not.toBeNull()
      expect(joinBtn(container)).not.toBeNull()
      expect(joinBtn(container).disabled).toBe(false)
      // 失败不谎报成功、不重拉（重拉只在成功后）
      expect(API.fetchProjectDetail.mock.calls.length).toBe(1)
    })
  }

  it('未登记 reason ⇒ 回退机读码（不假翻译）；无错误体 ⇒ 保留「加入失败」原文案', async () => {
    API.applyToProject.mockRejectedValue(
      Object.assign(new Error('x'), { status: 409, code: 'SOMETHING_NEW', details: { reason: 'not_mapped_reason' } }),
    )
    const { container } = renderAt()
    await waitJoin(container)
    fireEvent.click(joinBtn(container))
    await waitFor(() => expect(noticeOf(container)).not.toBeNull())
    expect(noticeOf(container).textContent).toBe(zhT('project.joinFailDetail', { detail: 'SOMETHING_NEW', status: 409 }))

    cleanup()
    before()
    API.applyToProject.mockRejectedValue(new Error('network down'))
    const second = renderAt()
    await waitJoin(second.container)
    fireEvent.click(joinBtn(second.container))
    await waitFor(() => expect(noticeOf(second.container)).not.toBeNull())
    expect(noticeOf(second.container).textContent).toBe(ZH.project.publishFailed)
  })
})
