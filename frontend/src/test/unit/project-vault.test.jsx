/**
 * 项目页 `/:slug` · 金库区 + 充值（★ Kevin 2026-10-23 ② · 迁移 0073）
 * ----------------------------------------------------------------------------
 * 被钉死的契约面：
 *   ① **次币金额允许 0**（`project-edit-form.validateWageForm`，★ 2026-10-23 ③ 次币随【设定工资标准】
 *      移出招工框）：`0` 合法、负数非法、空串非法；载荷侧 0 是**真值**（`buildWagePayload` 会把它
 *      作为变化字段送出，不当「空」吞掉）。
 *   ② **金库区渲染**（`data-sf-m="project-vault"`，紧跟项目头）：
 *        · 每个 `vault[]` 行 = 币符号 + 余额（`balance` 是人可读十进制串，**原样上屏不换算**）；
 *        · **空金库 ∧ 有次币腿** ⇒ 合成一条 0 余额行（否则用户无处充钱）；
 *        · **空金库 ∧ 无次币腿**（未设次币 / 金额 0）⇒ 整区不渲染。
 *   ③ **登录用户**每行有金额输入 + 【充值】（`data-sf-action="vault-recharge"`）；
 *      **未登录**只有余额行：零 input、零按钮、零写请求。
 *   ④ **充值载荷**恰 `{cid:<number>, amount:'<原样字符串>'}`（不换算精度、不加多余键），
 *      成功 ⇒ 内联 ok 提示（新余额取服务端回值）+ 静默重拉 + 清空该行输入。
 *   ⑤ **失败内联**：`VAULT_RECHARGE_INSUFFICIENT` / `PROJECT_VAULT_AMOUNT_INVALID` /
 *      `PROJECT_VAULT_CID_INVALID` ⇒ 中文因由 + HTTP 状态，元素带
 *      `data-sf-err-code / -reason / -status`；不谎报成功、**零重拉**；金额 ≤ 0 ⇒ 零请求内联。
 *
 * 手法：只 mock 两个边界（`project-api` 出参 + `auth-context` 登录态），页面逻辑全跑真实现；
 *      `t` 用真 `zh.json`（断言「用户实际看到的句子」）；管理员三键加载器替身返回 null。
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
  rechargeProjectVault: vi.fn(),
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
  rechargeProjectVault: API.rechargeProjectVault,
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

const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import ProjectPage from '../../pages/project/ProjectPage'
import { buildWagePayload, validateWageForm } from '../../pages/project/project-edit-form'

const renderAt = (entry = '/sui') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

/** 详情读口真形状（含加性 `vault[]`）；`owner_uid` 故意 = 别人 ⇒ 本文件全程 owner 面为假。 */
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
  wage_currency_amount: 20,
  wage_cid: 4,
  campaigns: [],
  my_role: 'none',
  my_hired_at: null,
  my_current_project_id: null,
  my_current_project_title: null,
  vault: [{ cid: '4', symbol: 'BTTC', balance: '1000.5' }],
  ...patch,
})

const before = () => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
  API.fetchProjectCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }])
  API.fetchProjectDetail.mockResolvedValue(viewOf())
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
  API.rechargeProjectVault.mockResolvedValue({
    project_id: '11', cid: '4', symbol: 'BTTC', amount: '12.5', balance: '1013',
    vault: [{ cid: '4', symbol: 'BTTC', balance: '1013' }],
  })
}

const waitVault = async (container) => {
  await waitFor(() => expect(container.querySelector('[data-sf-m="project-vault"]')).not.toBeNull())
  return container.querySelector('[data-sf-m="project-vault"]')
}
const rowsOf = (container) => [...container.querySelectorAll('[data-sf-m="project-vault-row"]')]
const inputOf = (container, cid = '4') => container.querySelector(`[data-sf-m="project-vault-amount"][data-sf-cid="${cid}"]`)
const btnOf = (container, cid = '4') => container.querySelector(`[data-sf-action="vault-recharge"][data-sf-cid="${cid}"]`)
const noticeOf = (container) => container.querySelector('[data-sf-m="project-vault-notice"]')

beforeEach(before)
afterEach(cleanup)

// ============================================================================
describe('① 工资标准表单 · 次币金额 0 合法（负数非法）', () => {
  const form = (patch = {}) => ({
    title: '海鲜打包', description: '', slug: '', newSlots: '', minDays: '1',
    batt: '30', interval: '4', cid: '4', amount: '20', ...patch,
  })
  const row = {
    project_id: 11, title: '海鲜打包', description: '', slug: '', headcount: 3,
    recruit_min_account_days: 1, wage_batt_per_claim: 30, wage_interval_hours: 4,
    wage_cid: 4, wage_currency_amount: 20, status: 'recruiting',
  }

  it('amount = 0 ⇒ 校验零错（「只发 batt」合法态）', () => {
    expect(validateWageForm(form({ amount: '0' }), zhT)).toEqual({})
  })

  it('amount = 负数 / 空串 / 非数字 ⇒ currency 字段报错', () => {
    for (const bad of ['-1', '-0.01', '', 'abc']) {
      const errs = validateWageForm(form({ amount: bad }), zhT)
      expect(errs.currency, `amount=${JSON.stringify(bad)}`).toBe(ZH.wage.errCurrencyAmount)
    }
  })

  it('载荷侧 0 是**真值**：原 20 ⇒ 改 0 时送出 `wage_currency_amount: "0"`（不是丢键）', () => {
    const body = buildWagePayload(row, form({ amount: '0' }))
    expect(body.wage_cid).toBe(4)
    expect(body.wage_currency_amount).toBe('0')
  })

  it('提示行文案存在（四语键：填 0 = 不发次币）', () => {
    expect(ZH.project.recruitZeroHint).toContain('0')
    expect(ZH.project.recruitZeroHint).toContain('不发次币')
  })
})

// ============================================================================
describe('② 金库区渲染（余额人可见）', () => {
  it('`vault[]` 每行 = 币符号 + 余额（十进制串原样上屏，不换算）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({
      vault: [
        { cid: '4', symbol: 'BTTC', balance: '1000.5' },
        { cid: '6', symbol: 'USDT', balance: '0' },
      ],
    }))
    const { container } = renderAt()
    await waitVault(container)

    const rows = rowsOf(container)
    expect(rows.map((r) => r.getAttribute('data-sf-cid'))).toEqual(['4', '6'])
    expect(rows[0].querySelector('[data-sf-m="project-vault-balance"]').textContent)
      .toBe(zhT('project.vaultLine', { symbol: 'BTTC', balance: '1000.5' }))
    expect(rows[0].textContent).toContain('1000.5')
    expect(rows[1].textContent).toContain('USDT')
    // 位于项目头**正下方**（DOM 顺序：head → vault → desc）
    const order = [...container.querySelectorAll('[data-sf-m="project-head"], [data-sf-m="project-vault"], [data-sf-m="project-desc"]')]
      .map((el) => el.getAttribute('data-sf-m'))
    expect(order).toEqual(['project-head', 'project-vault', 'project-desc'])
  })

  it('空金库 ∧ **有**次币腿 ⇒ 合成一条 0 余额行（给充值入口一个落点）', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ vault: [] }))
    const { container } = renderAt()
    await waitVault(container)

    const rows = rowsOf(container)
    expect(rows).toHaveLength(1)
    expect(rows[0].getAttribute('data-sf-cid')).toBe('4')
    expect(rows[0].textContent).toContain('BTTC')
    expect(rows[0].textContent).toContain('0')
  })

  it('空金库 ∧ **无**次币腿（未设次币 / 金额 0）⇒ 整区不渲染', async () => {
    API.fetchProjectDetail.mockResolvedValue(viewOf({ vault: [], wage_cid: null, wage_currency_amount: 0 }))
    const { container } = renderAt()
    await waitFor(() => expect(container.querySelector('[data-sf-m="project-title"]')).not.toBeNull())

    expect(container.querySelector('[data-sf-m="project-vault"]')).toBeNull()
    expect(container.querySelector('[data-sf-action="vault-recharge"]')).toBeNull()
  })
})

// ============================================================================
describe('③ 登录 / 未登录（只读余额）', () => {
  it('登录用户：每行有金额输入 + 【充值】钮', async () => {
    const { container } = renderAt()
    await waitVault(container)

    expect(inputOf(container)).not.toBeNull()
    expect(btnOf(container)).not.toBeNull()
    expect(btnOf(container).textContent).toBe(ZH.project.vaultRechargeBtn)
    expect(container.querySelector('[data-sf-m="project-vault"]').getAttribute('data-sf-authed')).toBe('1')
  })

  it('未登录：余额行照常、**零** input / 零按钮 / 零写请求', async () => {
    AUTH.isAuthenticated = false
    const { container } = renderAt()
    await waitVault(container)

    expect(rowsOf(container)).toHaveLength(1)
    expect(rowsOf(container)[0].textContent).toContain('1000.5')
    expect(inputOf(container)).toBeNull()
    expect(btnOf(container)).toBeNull()
    expect(container.querySelector('[data-sf-m="project-vault"]').getAttribute('data-sf-authed')).toBe('0')
    expect(API.rechargeProjectVault).not.toHaveBeenCalled()
  })
})

// ============================================================================
describe('④ 充值 · 载荷与成功路径', () => {
  it('点【充值】⇒ 载荷恰 `{cid:4, amount:"12.5"}`（cid 数字、amount 原样串）+ ok 提示 + 静默重拉', async () => {
    const { container } = renderAt()
    await waitVault(container)

    fireEvent.change(inputOf(container), { target: { value: '12.5' } })
    const loadsBefore = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(btnOf(container))

    await waitFor(() => expect(API.rechargeProjectVault).toHaveBeenCalledTimes(1))
    const [ref, body, user] = API.rechargeProjectVault.mock.calls[0]
    expect(ref).toBe(11) // 项目主键（不是 slug）
    expect(body).toEqual({ cid: 4, amount: '12.5' })
    expect(Object.keys(body).sort()).toEqual(['amount', 'cid']) // 不多不少
    expect(typeof body.cid).toBe('number')
    expect(user).toEqual({ uID: 7 })

    await waitFor(() => expect(noticeOf(container)).not.toBeNull())
    expect(noticeOf(container).getAttribute('data-sf-kind')).toBe('ok')
    expect(noticeOf(container).textContent)
      .toBe(zhT('project.vaultRechargeOk', { amount: '12.5', symbol: 'BTTC', balance: '1013' }))
    // 成功后：输入清空 + 静默重拉（余额行刷新）
    expect(inputOf(container).value).toBe('')
    await waitFor(() => expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThan(loadsBefore))
  })

  it('金额 ≤ 0 / 空 ⇒ **零请求**内联（客户端先拦，不打扰服务端）', async () => {
    const { container } = renderAt()
    await waitVault(container)

    for (const bad of ['', '0', '-2']) {
      fireEvent.change(inputOf(container), { target: { value: bad } })
      fireEvent.click(btnOf(container))
      await waitFor(() => expect(noticeOf(container)).not.toBeNull())
      expect(noticeOf(container).getAttribute('data-sf-kind')).toBe('err')
      expect(noticeOf(container).textContent).toBe(ZH.project.vaultErrAmountInvalid)
      expect(noticeOf(container).getAttribute('data-sf-err-code')).toBe('PROJECT_VAULT_AMOUNT_INVALID')
    }
    expect(API.rechargeProjectVault).not.toHaveBeenCalled()
  })
})

// ============================================================================
describe('⑤ 充值失败 · 内联机读三件（不谎报成功、不重拉）', () => {
  const FAILS = [
    ['VAULT_RECHARGE_INSUFFICIENT', 'vaultErrInsufficient', 400],
    ['PROJECT_VAULT_AMOUNT_INVALID', 'vaultErrAmountInvalid', 400],
    ['PROJECT_VAULT_CID_INVALID', 'vaultErrCidInvalid', 400],
  ]

  for (const [code, key, status] of FAILS) {
    it(`${code} ⇒ err 提示「${ZH.project[key]}（HTTP ${status}）」+ data-sf-err-* 三件`, async () => {
      API.rechargeProjectVault.mockRejectedValue(Object.assign(new Error('vault'), {
        status, code, details: { cid: '4', need: '12.5', have: '1' },
      }))
      const { container } = renderAt()
      await waitVault(container)
      fireEvent.change(inputOf(container), { target: { value: '12.5' } })

      const loadsBefore = API.fetchProjectDetail.mock.calls.length
      fireEvent.click(btnOf(container))

      await waitFor(() => expect(noticeOf(container)).not.toBeNull())
      expect(noticeOf(container).getAttribute('data-sf-kind')).toBe('err')
      expect(noticeOf(container).textContent).toBe(zhT('project.vaultFailDetail', { detail: ZH.project[key], status }))
      expect(noticeOf(container).getAttribute('data-sf-err-code')).toBe(code)
      expect(noticeOf(container).getAttribute('data-sf-err-status')).toBe(String(status))
      // 页面结构未塌 + 输入保留（可改数重试）+ 失败不重拉
      expect(container.querySelector('[data-sf-m="project-vault"]')).not.toBeNull()
      expect(inputOf(container).value).toBe('12.5')
      expect(btnOf(container).disabled).toBe(false)
      expect(API.fetchProjectDetail.mock.calls.length).toBe(loadsBefore)
    })
  }

  it('未登记 code ⇒ 机读码原文（不假翻译）；无错误体 ⇒ 兜底「充值失败」', async () => {
    API.rechargeProjectVault.mockRejectedValue(Object.assign(new Error('x'), {
      status: 409, code: 'project_vault_currency_not_listed', details: { reason: 'project_vault_currency_not_listed', cid: '4' },
    }))
    const { container } = renderAt()
    await waitVault(container)
    fireEvent.change(inputOf(container), { target: { value: '1' } })
    fireEvent.click(btnOf(container))
    await waitFor(() => expect(noticeOf(container)).not.toBeNull())
    expect(noticeOf(container).textContent).toContain('project_vault_currency_not_listed')
    expect(noticeOf(container).getAttribute('data-sf-err-code')).toBe('project_vault_currency_not_listed')

    cleanup()
    before()
    API.rechargeProjectVault.mockRejectedValue(new Error('network down'))
    const second = renderAt()
    await waitVault(second.container)
    fireEvent.change(inputOf(second.container), { target: { value: '1' } })
    fireEvent.click(btnOf(second.container))
    await waitFor(() => expect(noticeOf(second.container)).not.toBeNull())
    expect(noticeOf(second.container).textContent).toBe(ZH.project.vaultErrGeneral)
  })
})
