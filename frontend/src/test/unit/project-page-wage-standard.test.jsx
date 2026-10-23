/**
 * 项目页 `/:slug` · 【设定工资标准】模态框单测（★ Kevin 2026-10-23 ③ 新框）
 *
 * 覆盖面（逐条对齐派单收尾项）：
 *   ① 入口与文案：操作区独立按钮【设定工资标准】（`project-entry-wage`）→ 模态框标题 = `wageStdTitle`，
 *      且**提示行明说「新老成员一视同仁」**（`wageStdHint`）——工资是全员口径，不藏在【招工】里；
 *      入口与另两框**同一权限闸**（owner ∨ manage_tasks ∧ 未 ended）；普通用户 / ended / 未登录零入口；
 *   ② 字段集：`[data-sf-edit]` 的**钩子集**固定 = 4 个载荷字段（batt / interval / cid / amount）
 *      + 滑块卡三钩（interval-range / wage-rate-anchor / 条件渲染的 wage-legacy-rate），
 *      预填 = 行值；零项目面（title/description/slug/status）与零招工面（newSlots/minDays）；
 *      ★ 2026-10-24：batt 改**只读派生读数**（`readOnly`），间隔 = 滑块（吸附档位）+ 手输（不吸附）；
 *   ③ 载荷**只带变化键**：拖滑块 ⇒ 恰 `{wage_batt_per_claim, wage_interval_hours}` 两键；
 *      改间隔 ⇒ 同上两键；选次币 + 金额 0 ⇒ 恰两币键（金额 0 = 不发次币，合法）；
 *      清空次币 ⇒ 两键 null；无变化 ⇒ 零请求关框；历史速率行**初值不改** ⇒ 零请求 / 只改次币 ⇒ 只带两币键；
 *      成功 ⇒ 关框 + `project.wageStdSaved` 提示 + `load({silent:true})` 重拉（工资行即时更新）；
 *   ④ 框内内联、框不关：间隔越界（0 / 101 / 空 / 非整数，含手输）/ 次币只选币不填额 ⇒ 客户端零 PATCH；
 *      服务端 `PROJECT_WAGE_CURRENCY_PAIR_REQUIRED` ⇒ currency 行；`project_ended_frozen` ⇒ 表单级。
 *   ⑤ 单轨联动（★ 2026-10-24）：拖到档位 ⇒ 吸附；手输非档位 ⇒ 真值以手输为准、滑块停最近档；
 *      历史速率提示只在「行速率 ≠ ⚡1/h 且用户尚未接管间隔」时出现。
 *
 * 注：几何（390/1536 零溢出）见 `ops/project/probe-project-recruit.mjs`。
 */
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

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

const wageModal = () => document.querySelector('[data-sf-m="project-wage-std"]')
const field = (name) => document.querySelector(`[data-sf-edit="${name}"]`)
const editErr = (name) => document.querySelector(`[data-sf-edit-err="${name}"]`)
const wageEntry = (container) => container.querySelector('[data-sf-m="project-entry-wage"]')
const saveBtn = () => document.querySelector('[data-sf-m="project-wage-std-save"]')
const notice = (container) => container.querySelector('[data-sf-m="project-form-notice"]')
const wageFieldNames = () => [...document.querySelectorAll('[data-sf-m="project-wage-std-form"] [data-sf-edit]')]
  .map((el) => el.getAttribute('data-sf-edit'))
const hint = (name) => document.querySelector(`[data-sf-edit-hint="${name}"]`)

const openWage = async (container) => {
  await waitFor(() => expect(wageEntry(container)).not.toBeNull())
  fireEvent.click(wageEntry(container))
  await waitFor(() => expect(wageModal()).not.toBeNull())
  return document.querySelector('[data-sf-m="project-wage-std-panel"]')
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

// ---------------------------------------------------------------- ① 入口与文案
describe('① 入口与「新老成员统一标准」文案', () => {
  it('owner：按钮文案 + 模态标题/提示行都声明全员一视同仁', async () => {
    const { container } = renderAt()
    await waitFor(() => expect(wageEntry(container)).not.toBeNull())
    expect(wageEntry(container).textContent).toBe(zh.project.entryWageStd)
    expect(container.querySelector('[data-sf-m="project-manage"]').contains(wageEntry(container))).toBe(true)

    const panel = await openWage(container)
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(document.querySelector('[data-sf-m="project-wage-std-title"]').textContent).toBe(zh.project.wageStdTitle)
    expect(hint('wageStd').textContent).toBe(zh.project.wageStdHint)
    // 文案硬口径：必须点明「新老成员」一视同仁（改后含在职者下一笔）
    expect(zh.project.wageStdHint).toContain('新老成员')
    expect(zh.project.wageStdHint).toContain('一视同仁')
  })

  it('普通用户：非 owner 且无 manage_tasks ⇒ 入口不渲染、零 PATCH', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    await waitFor(() => expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled())
    expect(wageEntry(container)).toBeNull()
    expect(wageModal()).toBeNull()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('ended：owner 亦不可见（终态封板）', async () => {
    VIEW.current = viewOf({ owner_uid: 7, status: 'ended' })
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-head"]')).not.toBeNull())
    expect(wageEntry(container)).toBeNull()
  })
})

// ---------------------------------------------------------------- ② 字段集
describe('② 字段集：4 个载荷字段 + 滑块卡三钩；batt 只读派生', () => {
  it('历史速率行（30 / 4h）：钩子集 = 滑块卡三钩 + 4 字段、预填 = 行值、次币「无」⇒ 金额禁用', async () => {
    const { container } = renderAt()
    await openWage(container)
    expect(wageFieldNames()).toEqual([
      'interval-range', 'interval', 'batt', 'wage-legacy-rate', 'wage-rate-anchor', 'cid', 'amount',
    ])
    // 滑块与手输初值 = 行间隔 4（落档位 ⇒ 滑块原值）；手输框是真值入口
    expect(field('interval-range').value).toBe('4')
    expect(field('interval-range').type).toBe('range')
    expect(field('interval').value).toBe('4')
    // 每次工资 = **只读派生读数**，初值 = 行原值 30（历史速率 7.5/h，不预派生 —— 否则一开框就成「有变化」）
    expect(field('batt').value).toBe('30')
    expect(field('batt').readOnly).toBe(true)
    expect(field('cid').value).toBe('')
    expect(field('amount').value).toBe('')
    expect(field('amount').disabled).toBe(true)
    for (const name of ['title', 'description', 'slug', 'status', 'newSlots', 'minDays']) {
      expect(field(name)).toBeNull()
    }
  })

  it('⚡1/h 行（4 / 4h）：无历史速率提示行（钩子集少一格），读数 = 间隔', async () => {
    VIEW.current = viewOf({ wage_batt_per_claim: 4 })
    const { container } = renderAt()
    await openWage(container)
    expect(wageFieldNames()).toEqual([
      'interval-range', 'interval', 'batt', 'wage-rate-anchor', 'cid', 'amount',
    ])
    expect(field('batt').value).toBe('4')
    expect(field('batt').readOnly).toBe(true)
  })

  it('已有次币行 ⇒ 预填 cid + 金额', async () => {
    VIEW.current = viewOf({ wage_cid: 4, wage_currency_amount: 50 })
    const { container } = renderAt()
    await openWage(container)
    expect(field('cid').value).toBe('4')
    expect(field('amount').value).toBe('50')
    expect(field('amount').disabled).toBe(false)
  })
})

// ---------------------------------------------------------------- ③ 载荷
describe('③ 载荷只带变化键 + 成功回写', () => {
  it('拖滑块到档位 12 ⇒ body 恰两键（batt 派生 + 间隔）；成功 ⇒ 关框 + wageStdSaved + 重拉（工资行更新）', async () => {
    const { container } = renderAt()
    await openWage(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    // 滑块拖到 12（档位）⇒ 每次工资按 ⚡1/h 派生 = 12
    fireEvent.change(field('interval-range'), { target: { value: '12' } })
    expect(field('batt').value).toBe('12')
    expect(field('interval').value).toBe('12')
    await submit()

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][0]).toBe('11')
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_batt_per_claim: '12', wage_interval_hours: 12 })
    expect(API.patchProject.mock.calls[0][2]).toBe(AUTH.user)

    await waitFor(() => expect(wageModal()).toBeNull())
    const n = notice(container)
    expect(n.getAttribute('data-sf-kind')).toBe('ok')
    expect(n.textContent).toBe(zh.project.wageStdSaved)
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(reads)
    // 重拉后页头工资行（`data-sf-m="project-wage"`，与模态框 `project-wage-std` 不同名）吃到新 batt
    await waitFor(() => expect(
      container.querySelector('[data-sf-m="project-wage"]').textContent,
    ).toBe(zh.wage.wageLine.replace('{{batt}}', '12').replace('{{hours}}', '12')))
  })

  it('手输间隔 6（档位）⇒ 派生 batt 6，body 恰两键', async () => {
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('interval'), { target: { value: '6' } })
    expect(field('batt').value).toBe('6')
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_batt_per_claim: '6', wage_interval_hours: 6 })
  })

  it('选次币 + 金额 0 ⇒ 恰两键成对上送（金额 0 = 不发次币）', async () => {
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('cid'), { target: { value: '4' } })
    expect(field('amount').disabled).toBe(false)
    fireEvent.change(field('amount'), { target: { value: '0' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_cid: 4, wage_currency_amount: '0' })
  })

  it('清空次币 ⇒ body 恰两键 null（成对清空）', async () => {
    VIEW.current = viewOf({ wage_cid: 4, wage_currency_amount: 50 })
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('cid'), { target: { value: '' } })
    expect(field('amount').value).toBe('')
    expect(field('amount').disabled).toBe(true)
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_cid: null, wage_currency_amount: null })
  })

  it('无变化保存 ⇒ 零 PATCH、零重拉，框直接关', async () => {
    const { container } = renderAt()
    await openWage(container)
    const reads = API.fetchProjectDetail.mock.calls.length
    await submit()
    await waitFor(() => expect(wageModal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)
  })

  it('只改工资口径 ⇒ 载荷零招工键 / 零项目键（三框键集互斥）', async () => {
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('interval-range'), { target: { value: '24' } })
    fireEvent.change(field('cid'), { target: { value: '4' } })
    fireEvent.change(field('amount'), { target: { value: '2' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    const body = API.patchProject.mock.calls[0][1]
    expect(body).toEqual({
      wage_batt_per_claim: '24',
      wage_interval_hours: 24,
      wage_cid: 4,
      wage_currency_amount: '2',
    })
    for (const key of ['headcount', 'recruit_min_account_days', 'title', 'slug', 'status']) {
      expect(body).not.toHaveProperty(key)
    }
  })

  it('历史速率行初值不改 ⇒ 零请求；只改次币 ⇒ 载荷只含两币键（工资两键不发）', async () => {
    const { container } = renderAt()
    await openWage(container)
    // 开框即「历史速率 ⚡7.5/h」提示，batt 读数保持行原值 30
    expect(document.querySelector('[data-sf-edit="wage-legacy-rate"]').textContent)
      .toBe(zh.project.wageLegacyRate.replace('{{rate}}', '7.5'))
    expect(field('batt').value).toBe('30')

    // ① 初值不改 ⇒ 零请求直接关框
    const reads = API.fetchProjectDetail.mock.calls.length
    await submit()
    await waitFor(() => expect(wageModal()).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.fetchProjectDetail.mock.calls.length).toBe(reads)

    // ② 再开一次，只改次币 ⇒ 只发两币键（历史 batt 与间隔不被顺手带上）
    const panel = await openWage(container)
    expect(panel).not.toBeNull()
    fireEvent.change(field('cid'), { target: { value: '4' } })
    fireEvent.change(field('amount'), { target: { value: '3' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_cid: 4, wage_currency_amount: '3' })
  })
})

// ---------------------------------------------------------------- ④ 内联
describe('④ 客户端校验与服务端 400：框内内联、框不关', () => {
  it('手输越界（200 / 0 / 空）⇒ interval 字段内联、零 PATCH；batt 读数不被污染', async () => {
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('interval'), { target: { value: '200' } })
    await submit()
    await waitFor(() => expect(editErr('interval')).not.toBeNull())
    expect(editErr('interval').textContent).toBe(zh.bountyProject.intervalInvalid)

    fireEvent.change(field('interval'), { target: { value: '0' } })
    await submit()
    await waitFor(() => expect(editErr('interval')).not.toBeNull())
    expect(editErr('interval').textContent).toBe(zh.bountyProject.intervalInvalid)
    // 越界值**不派生** batt：读数保持行原值 30（不出现「间隔 0 ⇒ 工资也 0」的二次改写）
    expect(field('batt').value).toBe('30')
    expect(editErr('batt')).toBeNull()

    fireEvent.change(field('interval'), { target: { value: '' } })
    await submit()
    await waitFor(() => expect(editErr('interval')).not.toBeNull())
    expect(editErr('batt')).toBeNull()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('只选次币不填金额 ⇒ currency 行内联（成对校验），零 PATCH', async () => {
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('cid'), { target: { value: '4' } })
    await submit()
    await waitFor(() => expect(editErr('currency')).not.toBeNull())
    expect(editErr('currency').textContent).toBe(zh.wage.errCurrencyAmount)
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('服务端 400 PROJECT_WAGE_CURRENCY_PAIR_REQUIRED ⇒ currency 行内联，框不关', async () => {
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('pair'), {
      status: 400, details: { reason: 'PROJECT_WAGE_CURRENCY_PAIR_REQUIRED' },
    }))
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('interval-range'), { target: { value: '6' } })
    await submit()
    await waitFor(() => expect(editErr('currency')).not.toBeNull())
    expect(editErr('currency').textContent).toBe(zh.wage.errCurrencyPair)
    expect(wageModal()).not.toBeNull()
  })

  it('服务端 project_ended_frozen ⇒ 表单级兜底（无字段可落，不静默丢弃）', async () => {
    API.patchProject.mockRejectedValueOnce(Object.assign(new Error('frozen'), {
      status: 409, details: { reason: 'project_ended_frozen' },
    }))
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('interval-range'), { target: { value: '6' } })
    await submit()
    await waitFor(() => expect(editErr('general')).not.toBeNull())
    expect(editErr('general').textContent).toBe(zh.wage.errFrozen)
    expect(wageModal()).not.toBeNull()
  })
})

// ---------------------------------------------------------------- ⑤ 单轨联动
describe('⑤ 单轨联动：滑块吸附档位 / 手输优先 / 历史速率提示', () => {
  it('滑块值域 1–100 且 9 档吸附（7⇒8 并列取上档、13⇒12、50⇒48、99⇒100）', async () => {
    const { container } = renderAt()
    await openWage(container)
    expect(field('interval-range').getAttribute('min')).toBe('1')
    expect(field('interval-range').getAttribute('max')).toBe('100')

    for (const [raw, snapped] of [['7', '8'], ['13', '12'], ['50', '48'], ['99', '100'], ['2', '2']]) {
      fireEvent.change(field('interval-range'), { target: { value: raw } })
      expect(field('interval').value).toBe(snapped)
      expect(field('interval-range').value).toBe(snapped)
      expect(field('batt').value).toBe(snapped) // 每次工资 = 间隔 × ⚡1
    }
  })

  it('手输非档位值 9 ⇒ 真值以手输为准（载荷两键 = 9），滑块视觉停最近档 8', async () => {
    const { container } = renderAt()
    await openWage(container)
    fireEvent.change(field('interval'), { target: { value: '9' } })
    expect(field('interval').value).toBe('9')
    expect(field('batt').value).toBe('9')
    expect(field('interval-range').value).toBe('8') // 8 与 12 中 9 更近 8

    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_batt_per_claim: '9', wage_interval_hours: 9 })
  })

  it('卡内锚定说明恒在；历史速率提示在用户接管间隔后消失（读数转 ⚡1/h 口径）', async () => {
    const { container } = renderAt()
    await openWage(container)
    expect(document.querySelector('[data-sf-edit="wage-rate-anchor"]').textContent).toBe(zh.project.wageRateAnchor)
    expect(document.querySelector('[data-sf-edit="wage-legacy-rate"]')).not.toBeNull()

    fireEvent.change(field('interval-range'), { target: { value: '2' } })
    expect(document.querySelector('[data-sf-edit="wage-legacy-rate"]')).toBeNull()
    expect(field('batt').value).toBe('2')
    expect(document.querySelector('[data-sf-edit="wage-rate-anchor"]').textContent).toBe(zh.project.wageRateAnchor)
  })

  it('从 ⚡1/h 行（4 / 4h）拖到 2h ⇒ 载荷两键（batt 2 / interval 2）', async () => {
    VIEW.current = viewOf({ wage_batt_per_claim: 4 })
    const { container } = renderAt()
    await openWage(container)
    expect(document.querySelector('[data-sf-edit="wage-legacy-rate"]')).toBeNull()
    fireEvent.change(field('interval-range'), { target: { value: '2' } })
    await submit()
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ wage_batt_per_claim: '2', wage_interval_hours: 2 })
  })
})

