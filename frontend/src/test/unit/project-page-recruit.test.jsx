/**
 * 项目页 `/:slug` · 【招工】模态框单测（Kevin 2026-10-22③ 拆框；2026-10-23 ② **改增量名额**）
 *
 * 覆盖面（逐条对齐派单收尾项）：
 *   ① 入口与闸：操作区【编辑项目】/【招工】/【设定工资标准】三入口，**同一权限闸** ——
 *      owner / `manage_tasks` 管理员可见；普通用户、ended 项目、未登录一律零入口零 PATCH；
 *   ② 字段集：招工框 `[data-sf-edit]` **恰 2 个**（newSlots / minDays）——「新增名额 + 注册天数条件」；
 *      **零项目面**（title / description / slug / status）与**零工资面**（batt / interval / cid / amount）；
 *      名额输入**预填留空**（增量无所谓初值）；读数行给出「当前已招 X · 新增 Y ⇒ 目标 X+Y」；
 *   ③ 载荷**只带变化字段**：已招 3 + 新增 2 ⇒ body 恰 `{headcount: 5}`（**增量换算成绝对目标**）；
 *      新增留空 ⇒ 零 `headcount` 键；无变化 ⇒ 零请求关框；
 *      成功 ⇒ 关框 + 页内 `project.recruitSaved` 提示 + `load({silent:true})` 重拉；
 *   ④ 注册天数四选一：7 ⇒ 选中「一周」无提示；90 / 0 ⇒ 预选「一天」+ 提示行；保存载荷 = 选中天数；
 *   ⑤ 框内内联、框不关：409 `project_headcount_below_hired` ⇒ 新增名额行（服务端字段名 `headcount`
 *      在框内别名到 `newSlots`）；客户端校验（新增名额填 0 / 非整数）⇒ 零 PATCH + 字段内联。
 *
 * 注：几何（390/1536 零溢出）与真契约联调见 `ops/project/probe-project-recruit.mjs`；
 *     工资三项的校验/载荷见 `project-page-wage-standard.test.jsx`。
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
const wageModal = () => document.querySelector('[data-sf-m="project-wage-std"]')
const field = (name) => document.querySelector(`[data-sf-edit="${name}"]`)
const editErr = (name) => document.querySelector(`[data-sf-edit-err="${name}"]`)
const recruitEntry = (container) => container.querySelector('[data-sf-m="project-entry-recruit"]')
const editEntry = (container) => container.querySelector('[data-sf-m="project-entry-edit"]')
const wageEntry = (container) => container.querySelector('[data-sf-m="project-entry-wage"]')
const saveBtn = () => document.querySelector('[data-sf-m="project-recruit-save"]')
const notice = (container) => container.querySelector('[data-sf-m="project-form-notice"]')
/** 招工框内的字段名集（顺序 = DOM 顺序）。 */
const recruitFieldNames = () => [...document.querySelectorAll('[data-sf-m="project-recruit-form"] [data-sf-edit]')]
  .map((el) => el.getAttribute('data-sf-edit'))
/** 【编辑项目】框内的字段名集。 */
const editFieldNames = () => [...document.querySelectorAll('[data-sf-m="project-edit-form"] [data-sf-edit]')]
  .map((el) => el.getAttribute('data-sf-edit'))
/** 增量读数行（data-sf-hired / -add / -target 三值）。 */
const slotsRow = () => document.querySelector('[data-sf-edit-hint="slots"]')

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
describe('① 三入口同一权限闸（【编辑项目】/【招工】/【设定工资标准】）', () => {
  it('owner 臂：三入口都在操作区、文案各自 i18n，点开 = 招工框', async () => {
    const { container } = renderAt()
    await waitFor(() => expect(recruitEntry(container)).not.toBeNull())
    expect(recruitEntry(container).textContent).toBe(zh.project.entryRecruit)
    expect(editEntry(container)).not.toBeNull()
    expect(wageEntry(container)).not.toBeNull()
    expect(wageEntry(container).textContent).toBe(zh.project.entryWageStd)
    expect(container.querySelector('[data-sf-m="project-manage"]').contains(recruitEntry(container))).toBe(true)
    // 点开之前三个框都不在
    expect(recruitModal()).toBeNull()
    expect(editModal()).toBeNull()
    expect(wageModal()).toBeNull()

    const panel = await openRecruit(container)
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(document.querySelector('[data-sf-m="project-recruit-title"]').textContent).toBe(zh.project.recruitTitle)
    expect(recruitModal().getAttribute('data-sf-project')).toBe('11')
  })

  it('管理员臂：非 owner 但 manage_tasks ⇒ 三入口都可见', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    ADMIN.loadListingEditAdmin.mockResolvedValue({
      can_access_admin: true, is_admin: false, permissions: ['manage_tasks'],
    })
    const { container } = renderAt()
    await waitFor(() => expect(recruitEntry(container)).not.toBeNull())
    expect(editEntry(container)).not.toBeNull()
    expect(wageEntry(container)).not.toBeNull()
    expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled()
  })

  it('普通用户臂：非 owner 且三键不满足 ⇒ 零入口、零框、零 PATCH', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    await waitFor(() => expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled())
    expect(recruitEntry(container)).toBeNull()
    expect(editEntry(container)).toBeNull()
    expect(wageEntry(container)).toBeNull()
    expect(recruitModal()).toBeNull()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('ended 臂：owner 亦不可见（终态封板；入口不渲染 ⇒ 框不可达）', async () => {
    VIEW.current = viewOf({ owner_uid: 7, status: 'ended' })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(recruitEntry(container)).toBeNull()
    expect(wageEntry(container)).toBeNull()
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

// ---------------------------------------------------------------- ② 字段集 + 读数
describe('② 字段集：招工框恰 2 个字段（新增名额 + 注册天数），名额预填留空 + 实时读数', () => {
  it('招工框 [data-sf-edit] = 恰 2；名额空（增量）、天数预填 7；读数行 = 已招 2 / 目标 3', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    expect(recruitFieldNames()).toEqual(['newSlots', 'minDays'])
    expect(field('newSlots').value).toBe('') // 增量 ⇒ 预填留空
    expect(field('minDays').value).toBe('7')
    // 读数行：Y 空 ⇒ 目标 = 当前名额（3），add 显示占位
    expect(slotsRow()).not.toBeNull()
    expect(slotsRow().getAttribute('data-sf-hired')).toBe('2')
    expect(slotsRow().getAttribute('data-sf-add')).toBe('')
    expect(slotsRow().getAttribute('data-sf-target')).toBe('3')
    expect(slotsRow().textContent).toBe(
      zh.project.slotsReadout.replace('{{hired}}', '2').replace('{{add}}', '—').replace('{{target}}', '3'),
    )
    expect(document.body.style.overflow).toBe('hidden') // 背景滚动锁定（共用外壳）
  })

  it('填新增 2 ⇒ 读数行实时变 已招 2 / 新增 2 ⇒ 目标 4', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('newSlots'), { target: { value: '2' } })
    expect(slotsRow().getAttribute('data-sf-add')).toBe('2')
    expect(slotsRow().getAttribute('data-sf-target')).toBe('4')
    expect(slotsRow().textContent).toBe(
      zh.project.slotsReadout.replace('{{hired}}', '2').replace('{{add}}', '2').replace('{{target}}', '4'),
    )
  })

  it('招工框不含项目面 / 工资面字段；编辑框不含招工字段（三框字段集互斥）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    for (const name of ['title', 'description', 'slug', 'status', 'batt', 'interval', 'cid', 'amount']) {
      expect(field(name)).toBeNull()
    }
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(recruitModal()).toBeNull())

    fireEvent.click(editEntry(container))
    await waitFor(() => expect(editModal()).not.toBeNull())
    expect(editFieldNames()).toEqual(['title', 'description', 'slug'])
    for (const name of ['newSlots', 'minDays', 'batt', 'interval', 'cid', 'amount']) {
      expect(field(name)).toBeNull()
    }
  })

  it('三框互不嵌套：开一框时另两框不在（切换入口先关旧框）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(recruitModal()).toBeNull())
    fireEvent.click(wageEntry(container))
    await waitFor(() => expect(wageModal()).not.toBeNull())
    expect(recruitModal()).toBeNull()
    expect(editModal()).toBeNull()
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

// ---------------------------------------------------------------- ③ 增量载荷
describe('③ 增量换算 + 载荷只带变化字段', () => {
  it('已招 3 + 新增 2 ⇒ PATCH body 恰 {headcount: 5}；成功 ⇒ 关框 + recruitSaved + 重拉', async () => {
    VIEW.current = viewOf({ hired_count: 3, headcount: 3 })
    const { container } = renderAt()
    await openRecruit(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    expect(slotsRow().getAttribute('data-sf-target')).toBe('3')
    fireEvent.change(field('newSlots'), { target: { value: '2' } })
    expect(slotsRow().getAttribute('data-sf-target')).toBe('5')
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][0]).toBe('11')
    expect(API.patchProject.mock.calls[0][1]).toEqual({ headcount: 5 }) // 绝对目标 = 已招 + 新增
    expect(API.patchProject.mock.calls[0][2]).toBe(AUTH.user)

    await waitFor(() => expect(recruitModal()).toBeNull())
    const n = notice(container)
    expect(n.getAttribute('data-sf-kind')).toBe('ok')
    expect(n.textContent).toBe(zh.project.recruitSaved)
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(reads)
    // 重拉后头部读数吃到新名额（5）
    await waitFor(() => expect(
      container.querySelector('[data-sf-m="project-headcount"]').textContent,
    ).toBe(zh.project.headcountLine.replace('{{hired}}', '3').replace('{{total}}', '5')))
  })

  it('新增名额留空 ⇒ 零 `headcount` 键（名额不变）；只改天数 ⇒ body 恰 {recruit_min_account_days}', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('minDays'), { target: { value: '30' } })
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    const body = API.patchProject.mock.calls[0][1]
    expect(body).toEqual({ recruit_min_account_days: 30 })
    expect(body).not.toHaveProperty('headcount')
  })

  it('无变化保存（名额留空 + 天数未动）⇒ 零 PATCH、零重拉，框直接关', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    await submit()
    await waitFor(() => expect(recruitModal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
  })

  it('新增名额 + 天数同时改 ⇒ 恰两键（零工资键，三框键集互斥）', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('newSlots'), { target: { value: '1' } })
    fireEvent.change(field('minDays'), { target: { value: '1' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ headcount: 3, recruit_min_account_days: 1 })
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
  it('409 project_headcount_below_hired ⇒ 新增名额行内联（含 hired 数值），框不关', async () => {
    VIEW.current = viewOf({ hired_count: 3 })
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('below_hired'), {
      status: 409, details: { reason: 'project_headcount_below_hired', headcount: 1, hired_count: 3 },
    }))
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('newSlots'), { target: { value: '1' } })
    await submit()

    await waitFor(() => expect(editErr('newSlots')).not.toBeNull())
    expect(editErr('newSlots').textContent).toBe(zh.wage.errHeadcountBelowHired.replace('{{hired}}', '3'))
    expect(recruitModal()).not.toBeNull()
  })

  it('客户端校验：新增名额 0 / 非整数 ⇒ 零 PATCH + 名额行内联', async () => {
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('newSlots'), { target: { value: '0' } })
    await submit()
    await waitFor(() => expect(editErr('newSlots')).not.toBeNull())
    expect(editErr('newSlots').textContent).toBe(zh.wage.errHeadcount)

    fireEvent.change(field('newSlots'), { target: { value: '2.5' } })
    await submit()
    await waitFor(() => expect(editErr('newSlots')).not.toBeNull())
    expect(editErr('newSlots').textContent).toBe(zh.wage.errHeadcount)
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('未登记 reason ⇒ 表单级兜底句（机读码不外泄），框不关', async () => {
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('nope'), {
      status: 500, details: { reason: 'SOMETHING_ELSE' },
    }))
    const { container } = renderAt()
    await openRecruit(container)
    fireEvent.change(field('newSlots'), { target: { value: '1' } })
    await submit()
    await waitFor(() => expect(editErr('general')).not.toBeNull())
    expect(editErr('general').textContent).toBe(zh.wage.editFailed)
    expect(recruitModal()).not.toBeNull()
  })
})
