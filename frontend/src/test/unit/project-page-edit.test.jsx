/**
 * 项目页 `/:slug` · 【编辑项目】模态框单测（Kevin 2026-10-21②：编辑自 /wage 卡移入项目页；
 *   2026-10-22③：招工面 6 字段已拆出成独立【招工】框 —— 本文件只覆盖**项目面**）
 *
 * 覆盖面（逐条对齐派单收尾项）：
 *   ① 入口显隐三臂 + 两向闸：owner / `manage_tasks` 管理员可见；普通用户与 ended 项目不可见；
 *      未登录不渲染入口且**零** `/api/user` 取数；
 *   ② 模态开合：点入口 ⇒ 挂载（`role=dialog` + 标题 + 预填 + 背景滚动锁定）；
 *      **背板 / ✕ / Esc 三路关闭零请求**（零 PATCH、零重拉），卸载即还原 body 滚动原值；
 *      面板内 mousedown 不关框（只认背板自身）；**框内无招工字段**（字段集恰 4 = 项目面）；
 *   ③ 载荷**只带变化字段**：改标题 ⇒ 恰 `{title}`；无变化 ⇒ 零请求关框；
 *      成功后 ⇒ 关框 + 页内成功提示 + `load({silent:true})` 重拉（标题即时更新）；
 *   ④ **改 slug 自愈**：PATCH 成功且地址变化 ⇒ `navigate('/'+新 slug, {replace:true})`，
 *      页面按新地址重拉并正常渲染（不落 404），旧地址在保存后**不再请求**；地址未改 ⇒ 不跳转；
 *   ⑤ 服务端错误**框内内联、框不关**：400 `SLUG_TAKEN` ⇒ slug 字段；
 *      客户端校验（slug 格式 / 保留字）⇒ 零 PATCH。
 *
 * 招工面（人数 / 注册天数四选一 / 每次工资 / 间隔 / 次币成对）的断言见
 * `project-page-recruit.test.jsx`；几何（390/1536 零溢出）与真契约联调见
 * `ops/project/probe-project-recruit.mjs`（jsdom 不套用 media query，故此处不断言面板宽度）。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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
  // 项目域 CHECK：`(wage_cid IS NULL) = (wage_currency_amount IS NULL)` ∧ amount > 0
  // ⇒ 无次币行的金额是真 `null`（不是 0；0 会在库里被约束拒收）
  wage_currency_amount: null,
  wage_interval_hours: 4,
  campaigns: [],
  ...patch,
})

const renderAt = (entry = '/sui') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <LocationProbe />
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

/** 当前 URL（改 slug 后父组件 navigate 的取证锚；`replace` 语义由「无历史可回」另行覆盖）。 */
const LocationProbe = () => <span data-sf-loc={useLocation().pathname} />
const pathname = () => document.querySelector('[data-sf-loc]').getAttribute('data-sf-loc')

const modal = () => document.querySelector('[data-sf-m="project-edit"]')
const panel = () => document.querySelector('[data-sf-m="project-edit-panel"]')
const field = (name) => document.querySelector(`[data-sf-edit="${name}"]`)
const editFieldNames = () => [...document.querySelectorAll('[data-sf-m="project-edit-form"] [data-sf-edit]')]
  .map((el) => el.getAttribute('data-sf-edit'))
const editErr = (name) => document.querySelector(`[data-sf-edit-err="${name}"]`)
const entry = (container) => container.querySelector('[data-sf-m="project-entry-edit"]')
const saveBtn = () => document.querySelector('[data-sf-m="project-edit-save"]')
const notice = (container) => container.querySelector('[data-sf-m="project-form-notice"]')

const openModal = async (container) => {
  await waitFor(() => expect(entry(container)).not.toBeNull())
  fireEvent.click(entry(container))
  await waitFor(() => expect(modal()).not.toBeNull())
  return panel()
}

const submit = async () => {
  fireEvent.click(saveBtn())
}

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

// ---------------------------------------------------------------- ① 入口显隐
describe('① 【编辑项目】入口显隐（已登录 ∧ 未 ended ∧（owner ∨ manage_tasks））', () => {
  it('owner 臂：本人项目 ⇒ 入口在操作区、文案 = wage.editTitle，且与【发布活动】并列', async () => {
    const { container } = renderAt()
    await waitFor(() => expect(entry(container)).not.toBeNull())
    expect(entry(container).textContent).toBe(zh.wage.editTitle)
    expect(entry(container).closest('[data-sf-m="project-actions"]') || entry(container).parentElement)
      .not.toBeNull()
    // 入口在管理面板内（不是漂在页面根部）
    expect(container.querySelector('[data-sf-m="project-manage"]').contains(entry(container))).toBe(true)
    expect(container.querySelector('[data-sf-m="project-entry-campaign"]')).not.toBeNull()
    // 未点开之前框不在
    expect(modal()).toBeNull()
  })

  it('管理员臂：非 owner 但 manage_tasks ⇒ 入口可见（三键异步落定后）', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    ADMIN.loadListingEditAdmin.mockResolvedValue({
      can_access_admin: true, is_admin: false, permissions: ['manage_tasks'],
    })
    const { container } = renderAt()
    await waitFor(() => expect(entry(container)).not.toBeNull())
    expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled()
  })

  it('普通用户臂：非 owner 且三键不满足 ⇒ 入口与整块操作区都不渲染，零 PATCH', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    await waitFor(() => expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled())
    expect(container.querySelector('[data-sf-m="project-manage"]')).toBeNull()
    expect(entry(container)).toBeNull()
    expect(modal()).toBeNull()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('ended 臂：owner 亦不可见（后端终态封板；入口不渲染 ⇒ 框不可达）', async () => {
    VIEW.current = viewOf({ owner_uid: 7, status: 'ended' })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(container.querySelector('[data-sf-m="project-manage"]')).toBeNull()
    expect(entry(container)).toBeNull()
  })

  it('未登录臂：无入口且零 `/api/user` 取数（编辑判定不空跑）', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(entry(container)).toBeNull()
    expect(ADMIN.loadListingEditAdmin).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------- ② 开合
describe('② 模态开合：挂载即打开，背板 / ✕ / Esc 三路零请求', () => {
  it('点入口 ⇒ 挂载 dialog 面板、项目面字段预填（无招工字段）、背景滚动锁定', async () => {
    const { container } = renderAt()
    const p = await openModal(container)
    expect(p).not.toBeNull()
    expect(p.getAttribute('role')).toBe('dialog')
    expect(p.getAttribute('aria-modal')).toBe('true')
    expect(document.querySelector('[data-sf-m="project-edit-title"]').textContent).toBe(zh.wage.editTitle)
    // 预填 = 行值（项目面 4 字段）
    expect(field('title').value).toBe('海鲜打包')
    expect(field('description').value).toBe('每天打包 20 单')
    expect(field('slug').value).toBe('sui')
    expect(field('status').value).toBe('recruiting')
    expect(editFieldNames()).toEqual(['title', 'description', 'slug', 'status'])
    // 招工面（已拆出到【招工】框）在本框内零残留
    for (const name of ['headcount', 'minDays', 'batt', 'interval', 'cid', 'amount']) {
      expect(field(name)).toBeNull()
    }
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('Esc ⇒ 关框、零 PATCH、零重拉；body 滚动还原原值', async () => {
    const { container } = renderAt()
    await openModal(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(modal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
    expect(document.body.style.overflow).toBe('')
  })

  it('背板 mousedown ⇒ 关框零请求；面板内 mousedown 不关（只认背板自身）', async () => {
    const { container } = renderAt()
    await openModal(container)
    fireEvent.mouseDown(panel())
    expect(modal()).not.toBeNull()
    fireEvent.mouseDown(document.querySelector('[data-sf-m="project-edit-backdrop"]'))
    await waitFor(() => expect(modal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('✕ 与【取消】两路 ⇒ 各自关框、零请求（都已打开两次）', async () => {
    const { container } = renderAt()
    const reads = API.fetchProjectDetail.mock.calls.length
    await openModal(container)
    fireEvent.click(document.querySelector('[data-sf-m="project-edit-close"]'))
    await waitFor(() => expect(modal()).toBeNull())

    await openModal(container)
    fireEvent.click(document.querySelector('[data-sf-m="project-edit-cancel"]'))
    await waitFor(() => expect(modal()).toBeNull())

    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
  })
})

// ---------------------------------------------------------------- ③ 载荷
describe('③ 载荷只带变化字段 + 成功回写', () => {
  it('改标题 + 状态 ⇒ PATCH 恰一次、body 恰 {title,status}；成功 ⇒ 关框 + 成功提示 + 重拉拿新值', async () => {
    const { container } = renderAt()
    await openModal(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    fireEvent.change(field('title'), { target: { value: '海鲜打包·周末班' } })
    fireEvent.change(field('status'), { target: { value: 'working' } })
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][0]).toBe('11') // project_id 主键
    expect(API.patchProject.mock.calls[0][1]).toEqual({ title: '海鲜打包·周末班', status: 'working' })
    expect(API.patchProject.mock.calls[0][2]).toBe(AUTH.user) // 鉴权走当前用户

    await waitFor(() => expect(modal()).toBeNull())
    const n = notice(container)
    expect(n).not.toBeNull()
    expect(n.getAttribute('data-sf-kind')).toBe('ok')
    expect(n.textContent).toBe(zh.wage.editSaved)
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(reads) // 静默重拉
    await waitFor(() => (
      expect(container.querySelector('[data-sf-m="project-title"]').textContent).toBe('海鲜打包·周末班')
    ))
    expect(container.querySelector('[data-sf-m="project-status"]').getAttribute('data-sf-state')).toBe('working')
  })

  it('无变化保存 ⇒ 零 PATCH、零重拉，框直接关（「只带变化字段」下没有可发的键）', async () => {
    const { container } = renderAt()
    await openModal(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    await submit()
    await waitFor(() => expect(modal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
  })
})

// ---------------------------------------------------------------- ④ 改 slug 自愈
describe('④ 改 slug 保存后自动跳到新地址（旧地址不留 404）', () => {
  it('改地址 + 保存 ⇒ PATCH 只带 {slug}；URL 变 /haixian-weekend；新地址正常渲染、旧地址不再请求', async () => {
    const { container } = renderAt()
    await openModal(container)
    expect(pathname()).toBe('/sui')
    const oldSlugReads = API.fetchProjectDetail.mock.calls.filter(([ref]) => ref === 'sui').length

    fireEvent.change(field('slug'), { target: { value: 'haixian-weekend' } })
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ slug: 'haixian-weekend' })

    // ① 地址跳到新 slug（replace 语义；MemoryRouter 下 pathname 即取证锚）
    await waitFor(() => expect(pathname()).toBe('/haixian-weekend'))
    await waitFor(() => expect(modal()).toBeNull()) // 框关
    // ② 页面按新地址重拉并正常渲染 —— 不是「页面不存在」
    await waitFor(() => expect(API.fetchProjectDetail.mock.calls.some(([ref]) => ref === 'haixian-weekend')).toBe(true))
    expect(document.querySelector('[data-sf-m="not-found-page"]')).toBeNull()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-title"]').textContent).toBe('海鲜打包'))
    expect(container.querySelector('[data-sf-m="project-page"]').getAttribute('data-sf-slug')).toBe('haixian-weekend')
    // ③ 旧地址保存后不再请求（此前旧 ref 重拉 ⇒ 404 ⇒ 落提示页的根因）
    expect(API.fetchProjectDetail.mock.calls.filter(([ref]) => ref === 'sui').length).toBe(oldSlugReads)
    // ④ 成功提示仍在（框关 + 提示成功）
    const n = notice(container)
    expect(n.getAttribute('data-sf-kind')).toBe('ok')
    expect(n.textContent).toBe(zh.wage.editSaved)
  })

  it('地址未改（只改标题）⇒ 不跳转、原地静默重拉', async () => {
    const { container } = renderAt()
    await openModal(container)
    fireEvent.change(field('title'), { target: { value: '海鲜打包·周末班' } })
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ title: '海鲜打包·周末班' })
    await waitFor(() => expect(modal()).toBeNull())
    await waitFor(() => (
      expect(container.querySelector('[data-sf-m="project-title"]').textContent).toBe('海鲜打包·周末班')
    ))
    expect(pathname()).toBe('/sui')
    expect(API.fetchProjectDetail.mock.calls.some(([ref]) => ref !== 'sui')).toBe(false)
  })
})

// ---------------------------------------------------------------- ⑤ 框内内联
describe('⑤ 服务端 400 与客户端校验：框内内联、框不关', () => {
  it('400 SLUG_TAKEN ⇒ slug 字段内联冲突文案，框不关', async () => {
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('slug_taken'), {
      status: 400, details: { reason: 'SLUG_TAKEN' },
    }))
    const { container } = renderAt()
    await openModal(container)
    fireEvent.change(field('slug'), { target: { value: 'other-slug' } })
    await submit()

    await waitFor(() => expect(editErr('slug')).not.toBeNull())
    expect(editErr('slug').textContent).toBe(zh.project.errSlugTaken)
    expect(editErr('slug').getAttribute('role')).toBe('alert')
    expect(modal()).not.toBeNull() // 框不关，可改后重提
    expect(field('slug').value).toBe('other-slug') // 用户输入不被吞
    expect(pathname()).toBe('/sui') // 失败不跳转
  })

  it('未登记 reason ⇒ 表单级兜底句（机读码不外泄），框不关', async () => {
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('nope'), {
      status: 500, details: { reason: 'SOMETHING_ELSE' },
    }))
    const { container } = renderAt()
    await openModal(container)
    fireEvent.change(field('title'), { target: { value: '新标题' } })
    await submit()

    await waitFor(() => expect(editErr('general')).not.toBeNull())
    expect(editErr('general').textContent).toBe(zh.wage.editFailed)
    expect(modal()).not.toBeNull()
  })

  it('客户端校验：slug 格式非法（大写）/ 保留字 ⇒ 零 PATCH + 字段内联', async () => {
    const { container } = renderAt()
    await openModal(container)
    fireEvent.change(field('slug'), { target: { value: 'Sui' } })
    await submit()
    await waitFor(() => expect(editErr('slug')).not.toBeNull())
    expect(editErr('slug').textContent).toBe(zh.project.errSlugFormat)

    fireEvent.change(field('slug'), { target: { value: 'wage' } })
    await submit()
    await waitFor(() => expect(editErr('slug').textContent).toBe(zh.project.errSlugReserved))
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('历史行无 slug + 留空保存 ⇒ 零 slug 键（不误发空串），仍按其它变化字段走', async () => {
    VIEW.current = viewOf({ slug: null })
    const { container } = renderAt()
    await openModal(container)
    expect(field('slug').value).toBe('')
    fireEvent.change(field('title'), { target: { value: '改名' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ title: '改名' })
    expect(Object.prototype.hasOwnProperty.call(API.patchProject.mock.calls[0][1], 'slug')).toBe(false)
  })
})
