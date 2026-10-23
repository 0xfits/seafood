/**
 * 项目页 `/:slug` · 【招工】模态框单测（Kevin 2026-10-22③：招工面自【编辑项目】拆出成独立框）
 *
 * 覆盖面（逐条对齐派单收尾项）：
 *   ① 入口与闸：操作区【编辑项目】旁有【招工】，**同一权限闸**三臂 —— owner / `manage_tasks` 管理员可见；
 *      普通用户、ended 项目、未登录一律零入口零 PATCH；
 *   ② 字段集：招工框 `[data-sf-edit]` **恰 6 个**（headcount / minDays / batt / interval / cid / amount），
 *      且**不含**项目面字段（title / description / slug / status）；两框互斥（开一框另一框不在）；
 *   ③ 载荷**只带变化字段**：改人数 ⇒ 恰 `{headcount}`；清空次币 ⇒ 恰两键 null；无变化 ⇒ 零请求关框；
 *      成功 ⇒ 关框 + 页内 `project.recruitSaved` 提示 + `load({silent:true})` 重拉；
 *   ④ 注册天数四选一：7 ⇒ 选中「一周」无提示；90 / 0 ⇒ 预选「一天」+ 提示行；保存载荷 = 选中天数；
 *   ⑤ 框内内联、框不关：409 `project_headcount_below_hired` ⇒ headcount；客户端校验（间隔越界 /
 *      人数 0 / 次币缺金额）⇒ 零 PATCH + 字段内联。
 *
 * 注：几何（390/1536 零溢出）与改 slug 跳转由 `ops/project/probe-project-recruit.mjs` 与
 *     `project-page-edit.test.jsx` 覆盖，jsdom 不套用 media query，故此处不断言面板宽度。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

// 最小 i18next 替身：点分取键 + `{{var}}` 插值（键缺失回键名，与 i18next 口径一致）。
const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}

const I18N = vi.hoisted(() => ({ table: null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => makeT(I18N.table)(key, vars),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const API = vi.hoisted(() => ({
  fetchProjectDetail: vi.fn(),
  fetchProjectCurrencies: vi.fn(),
  rechargeProjectVault: vi.fn(),
  patchProject: vi.fn(),
  createProjectCampaign: vi.fn(),
  patchProjectCampaign: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  appendProjectSubtasks: vi.fn(),
}))
vi.mock('../../pages/project/project-api', () => ({
  fetchProjectDetail: API.fetchProjectDetail,
  fetchProjectCurrencies: API.fetchProjectCurrencies,
  rechargeProjectVault: API.rechargeProjectVault,
  patchProject: API.patchProject,
  createProjectCampaign: API.createProjectCampaign,
  patchProjectCampaign: API.patchProjectCampaign,
  createProjectCampaignTask: API.createProjectCampaignTask,
  appendProjectSubtasks: API.appendProjectSubtasks,
}))

// 管理员三键加载器替身（保留真实 `isWageProjectEditAdmin` 判定，只换取数面 ⇒ 三臂可独立摆位）。
const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import ProjectPage from '../../pages/project/ProjectPage'

const VIEW = { current: null }

const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: 7,
  recruit_min_account_days: 7,
  wage_batt_per_claim: 30,
  wage_cid: null,
  wage_currency_amount: null,
  wage_interval_hours: 4,
  campaigns: [],
  ...patch,
})

const renderAt = (entry = '/sui') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

const recruitModal = () => document.querySelector('[data-sf-m="project-recruit"]')
const editModal = () => document.querySelector('[data-sf-m="project-edit"]')
const field = (name) => document.querySelector(`[data-sf-edit="${name}"]`)
const editErr = (name) => document.querySelector(`[data-sf-edit-err="${name}"]`)
const recruitEntry = (container) => container.querySelector('[data-sf-m="project-entry-recruit"]')
const editEntry = (container) => container.querySelector('[data-sf-m="project-entry-edit"]')
const saveBtn = () => document.querySelector('[data-sf-m="project-recruit-save"]')
const notice = (container) => container.querySelector('[data-sf-m="project-form-notice"]')
/** 招工框内的字段名集（顺序 = DOM 顺序）。 */
const recruitFieldNames = () => [...document.querySelectorAll('[data-sf-m="project-recruit-form"] [data-sf-edit]')]
  .map((el) => el.getAttribute('data-sf-edit'))
/** 【编辑项目】框内的字段名集。 */
const editFieldNames = () => [...document.querySelectorAll('[data-sf-m="project-edit-form"] [data-sf-edit]')]
  .map((el) => el.getAttribute('data-sf-edit'))

const openRecruit = async (container) => {
  await waitFor(() => expect(recruitEntry(container)).not.toBeNull())
  fireEvent.click(recruitEntry(container))
  await waitFor(() => expect(recruitModal()).not.toBeNull())
  return document.querySelector('[data-sf-m="project-recruit-panel"]')
}

const submit = () => fireEvent.click(saveBtn())

beforeEach(() => {
  vi.clearAllMocks()
  I18N.table = zh
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, token: 't-7' }
  VIEW.current = viewOf()
  API.fetchProjectCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC', name: 'Bit' }])
  API.fetchProjectDetail.mockImplementation(async () => ({ ...VIEW.current }))
  // 服务端写库模拟：PATCH 载荷合并进视图行 ⇒ 成功后的重拉读到新值
  API.patchProject.mockImplementation(async (ref, body) => {
    Object.assign(VIEW.current, body)
    return { ...VIEW.current }
  })
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
  document.body.style.overflow = ''
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

// ---------------------------------------------------------------- ① 入口与闸
describe('① 【招工】入口：与【编辑项目】同一权限闸', () => {
  it('owner 臂：两入口都在操作区、文案 = project.entryRecruit，点开 = 招工框', async () => {
    const { container } = renderAt()
    await waitFor(() => expect(recruitEntry(container)).not.toBeNull())
    expect(recruitEntry(container).textContent).toBe(zh.project.entryRecruit)
    expect(editEntry(container)).not.toBeNull()
    expect(container.querySelector('[data-sf-m="project-manage"]').contains(recruitEntry(container))).toBe(true)
    // 点开之前两个框都不在
    expect(recruitModal()).toBeNull()
    expect(editModal()).toBeNull()

    const panel = await openRecruit(container)
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.querySelector('[data-sf-m="project-recruit-title"]').textContent).toBe(zh.project.recruitTitle)
    expect(recruitModal().getAttribute('data-sf-project')).toBe('11')
  })

  it('管理员臂：非 owner 但 manage_tasks ⇒ 两入口都可见', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    ADMIN.loadListingEditAdmin.mockResolvedValue({
      can_access_admin: true, is_admin: false, permissions: ['manage_tasks'],
    })
    const { container } = renderAt()
    await waitFor(() => expect(recruitEntry(container)).not.toBeNull())
    expect(editEntry(container)).not.toBeNull()
    expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled()
  })

  it('普通用户臂：非 owner 且三键不满足 ⇒ 零入口、零框、零 PATCH', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    await waitFor(() => expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled())
    expect(recruitEntry(container)).toBeNull()
    expect(editEntry(container)).toBeNull()
    expect(recruitModal()).toBeNull()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('ended 臂：owner 亦不可见（终态封板；入口不渲染 ⇒ 框不可达）', async () => {
    VIEW.current = viewOf({ owner_uid: 7, status: 'ended' })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(recruitEntry(container)).toBeNull()
  })

  it('未登录臂：无入口且零 `/api/user` 取数', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(recruitEntry(container)).toBeNull()
    expect(ADMIN.loadListingEditAdmin).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------- ② 字段集
describe('② 字段集：招工框恰 6 个招工字段，项目框不含招工字段', () => {
  it('招工框 [data-sf-edit] = 恰 6（人数/天数/工资/间隔/次币/金额），预填 = 行值', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    expect(recruitFieldNames()).toEqual(['headcount', 'minDays', 'batt', 'interval', 'cid', 'amount'])
    expect(field('headcount').value).toBe('3')
    expect(field('minDays').value).toBe('7')
    expect(field('batt').value).toBe('30')
    expect(field('interval').value).toBe('4')
    expect(field('cid').value).toBe('')
    expect(field('amount').disabled).toBe(true) // 次币为「无」⇒ 金额禁用（成对口径）
    expect(document.body.style.overflow).toBe('hidden') // 背景滚动锁定（共用外壳）
  })

  it('招工框不含项目面字段；编辑框不含招工字段（两框字段集互斥）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    for (const name of ['title', 'description', 'slug', 'status']) expect(field(name)).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(recruitModal()).toBeNull())

    fireEvent.click(editEntry(container))
    await waitFor(() => expect(editModal()).not.toBeNull())
    expect(editFieldNames()).toEqual(['title', 'description', 'slug', 'status'])
    for (const name of ['headcount', 'minDays', 'batt', 'interval', 'cid', 'amount']) {
      expect(field(name)).toBeNull()
    }
  })

  it('两框互不嵌套：开一框时另一框不在（切换入口先关旧框）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(recruitModal()).toBeNull())
    fireEvent.click(editEntry(container))
    await waitFor(() => expect(editModal()).not.toBeNull())
    expect(recruitModal()).toBeNull()
  })

  it('Esc 关框零请求（招工框走同一外壳：关框不误触写口）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(recruitModal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
    expect(document.body.style.overflow).toBe('')
  })
})

// ---------------------------------------------------------------- ③ 载荷
describe('③ 招工载荷只带变化字段 + 成功回写', () => {
  it('改人数 3⇒5 ⇒ PATCH 恰一次、body 恰 {headcount:5}；成功 ⇒ 关框 + recruitSaved + 重拉', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    fireEvent.change(field('headcount'), { target: { value: '5' } })
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][0]).toBe('11')
    expect(API.patchProject.mock.calls[0][1]).toEqual({ headcount: 5 })
    expect(API.patchProject.mock.calls[0][2]).toBe(AUTH.user)

    await waitFor(() => expect(recruitModal()).toBeNull())
    const n = notice(container)
    expect(n.getAttribute('data-sf-kind')).toBe('ok')
    expect(n.textContent).toBe(zh.project.recruitSaved)
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(reads)
  })

  it('清空次币 ⇒ body 恰为两键 null（成对上送）', async () => {
    VIEW.current = viewOf({ wage_cid: 4, wage_currency_amount: 50 })
    const { container } = renderAt()
    await openRecruit(container)
    expect(field('cid').value).toBe('4')
    expect(field('amount').value).toBe('50')
    fireEvent.change(field('cid'), { target: { value: '' } })
    expect(field('amount').value).toBe('')
    expect(field('amount').disabled).toBe(true)
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_cid: null, wage_currency_amount: null })
    await waitFor(() => expect(recruitModal()).toBeNull())
  })

  it('无变化保存 ⇒ 零 PATCH、零重拉，框直接关', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    await submit()
    await waitFor(() => expect(recruitModal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
  })

  it('只改招工 ⇒ 载荷零项目键（两框键集互斥，不重复上送标题/地址）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('batt'), { target: { value: '35' } })
    fireEvent.change(field('interval'), { target: { value: '6' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_batt_per_claim: '35', wage_interval_hours: 6 })
  })
})

// ---------------------------------------------------------------- ④ 四选一
describe('④ 注册天数条件 = 四选一（1/7/30/365）', () => {
  it('预填 7 ⇒ 选中「一周」、无提示行；改选「一月」保存 ⇒ body 恰 {recruit_min_account_days:30}', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    const sel = field('minDays')
    expect(sel.tagName).toBe('SELECT')
    expect([...sel.options].map((o) => o.value)).toEqual(['1', '7', '30', '365'])
    expect(sel.value).toBe('7')
    expect(document.querySelector('[data-sf-edit-hint="minDays"]')).toBeNull()

    fireEvent.change(sel, { target: { value: '30' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ recruit_min_account_days: 30 })
  })

  it('预填 90（非四档）⇒ 预选「一天」+ 历史值提示行；原样保存 ⇒ body 恰 {recruit_min_account_days:1}', async () => {
    VIEW.current = viewOf({ recruit_min_account_days: 90 })
    const { container } = renderAt()
    await openRecruit(container)
    expect(field('minDays').value).toBe('1')
    const hint = document.querySelector('[data-sf-edit-hint="minDays"]')
    expect(hint.textContent).toBe(zh.bountyProject.minDaysLegacy.replace('{{n}}', '90'))

    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ recruit_min_account_days: 1 })
  })

  it('预填 0（历史无门槛）⇒ 预选「一天」+「原为无门槛」提示', async () => {
    VIEW.current = viewOf({ recruit_min_account_days: 0 })
    const { container } = renderAt()
    await openRecruit(container)
    expect(field('minDays').value).toBe('1')
    expect(document.querySelector('[data-sf-edit-hint="minDays"]').textContent).toBe(zh.bountyProject.minDaysNoGate)
  })
})

// ---------------------------------------------------------------- ⑤ 内联
describe('⑤ 服务端 409 与客户端校验：框内内联、框不关', () => {
  it('409 project_headcount_below_hired ⇒ headcount 内联（含 hired 数值），框不关', async () => {
    VIEW.current = viewOf({ hired_count: 3 })
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('below_hired'), {
      status: 409, details: { reason: 'project_headcount_below_hired', headcount: 1, hired_count: 3 },
    }))
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('headcount'), { target: { value: '1' } })
    await submit()

    await waitFor(() => expect(editErr('headcount')).not.toBeNull())
    expect(editErr('headcount').textContent).toBe(zh.wage.errHeadcountBelowHired.replace('{{hired}}', '3'))
    expect(recruitModal()).not.toBeNull()
  })

  it('客户端校验：间隔 200 / 人数 0 ⇒ 零 PATCH + 字段内联', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('interval'), { target: { value: '200' } })
    await submit()
    await waitFor(() => expect(editErr('interval')).not.toBeNull())
    expect(editErr('interval').textContent).toBe(zh.bountyProject.intervalInvalid)

    fireEvent.change(field('interval'), { target: { value: '4' } })
    fireEvent.change(field('headcount'), { target: { value: '0' } })
    await submit()
    await waitFor(() => expect(editErr('headcount')).not.toBeNull())
    expect(editErr('headcount').textContent).toBe(zh.wage.errHeadcount)
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('次币只选币种不填金额 ⇒ 成对校验内联（零 PATCH）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('cid'), { target: { value: '4' } })
    expect(field('amount').disabled).toBe(false)
    await submit()
    await waitFor(() => expect(editErr('currency')).not.toBeNull())
    expect(editErr('currency').textContent).toBe(zh.wage.errCurrencyAmount)
    expect(API.patchProject).not.toHaveBeenCalled()
  })
})
