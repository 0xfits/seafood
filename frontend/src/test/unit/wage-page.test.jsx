/**
 * /wage · 领工资页单测（Kevin 2026-10-20 需求②）
 *
 * 覆盖面：
 *   ① 项目列表：招募中 / 已截止态、已招 X/Y、工资行（batt + 可选次币）、
 *      【加入】/【领工资】按钮态与「同时只能在一个项目打工」提示；
 *   ② 领取间隔未到 ⇒ 置灰 + 倒计时文案；行内不带可领时间 ⇒ 可点，由服务端 400 兜底（reason 映射）；
 *   ③ 加入 / 领工资成功 ⇒ 卡内提示 + 重拉列表；失败 ⇒ 卡内内联提示、列表不白屏；
 *   ④ 未登录 ⇒ **也拉列表并渲染项目卡**（公开浏览面），页顶只留轻提示；【加入】/【领工资】可点、
 *      点击只弹卡内登录提示且零写请求；
 *   ⑤ 项目卡**零编辑**（Kevin 2026-10-21②：编辑整体移入项目页 `/:slug` + 模态框）：
 *      即便本人是 owner / 载荷带 manage_tasks 三键，本页也零【编辑】钮、零 PATCH、零 `/api/user`；
 *      卡内不得残留行内表单/编辑字段容器；整卡链接（有 slug ⇒ `/<slug>`）与加入/领工资行为不变；
 *   ⑥ i18n `wage` 命名空间四语齐备 + 计数前推（top 135 / flat 1369 / 四语节点 5476）。
 *
 * 注：真实浏览器几何（390/1536 零溢出）与真实契约联调由 `ops/wage/front/` 的探针覆盖，
 *     jsdom 不套用 media query，故此处不断言列数。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, en, hk, vn }
const LANGS = ['zh', 'en', 'hk', 'vn']

// 最小 i18next 替身：点分取键 + `{{var}}` 插值（键缺失回键名，与 i18next 口径一致）。
const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}

const I18N = vi.hoisted(() => ({ lang: 'zh', tables: {} }))
I18N.tables = TABLES
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => makeT(I18N.tables[I18N.lang])(key, vars),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: I18N.lang, language: I18N.lang },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

import WagePage from '../../pages/wage/WagePage'
// ★ 本页已不引用 item-edit-access（编辑判定随【编辑】搬到项目页）⇒ 无需复位三键缓存。

const HOUR = 3600 * 1000

const FUTURE = () => new Date(Date.now() + 2 * HOUR + 5 * 60 * 1000).toISOString()

const rowHired = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  title: '海鲜打包',
  description: '每天打包 20 单',
  headcount: 3,
  hired_count: 2,
  // ★ Kevin 2026-10-21：行契约含 `recruit_min_account_days`（恰四档值 ⇒ 编辑表单预选对应项、零额外载荷）
  recruit_min_account_days: 1,
  wage_batt_per_claim: 30,
  wage_cid: 1,
  wage_currency_amount: 0,
  wage_interval_hours: 4,
  status: 'recruiting',
  my_role: 'hired',
  ...patch,
})

const ROW_OPEN = {
  project_id: 12,
  snowflake_id: '70012',
  title: '文案校对',
  description: '校对商品描述',
  headcount: 5,
  hired_count: 1,
  recruit_min_account_days: 1, // 恰四档值 ⇒ 预选「一天」、保存不产生额外载荷
  wage_batt_per_claim: 20,
  wage_cid: 4,
  wage_currency_amount: 50,
  wage_interval_hours: 6,
  status: 'recruiting',
  my_role: 'none',
}

const ROW_CLOSED = {
  project_id: 13,
  snowflake_id: '70013',
  title: '冷库盘点',
  description: '季度盘点',
  headcount: 2,
  hired_count: 2,
  recruit_min_account_days: 1,
  wage_batt_per_claim: 15,
  wage_cid: 1,
  wage_currency_amount: 0,
  wage_interval_hours: 12,
  status: 'closed',
  my_role: 'none',
}

const okBody = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })
const errBody = (status, error) => ({ ok: false, status, json: async () => ({ success: false, error }) })

/**
 * 路由拦截式 fetch 替身：`/api/project/all` 与 `/api/currencies` 走夹具，写口逐案定制。
 * `adminPayload` = `GET /api/user` 的替身载荷（管理员三键判定用）；`onPatch` = PATCH 写口逐案定制。
 */
const installFetch = ({ rows = [], onClaim, onApply, onPatch, adminPayload = null } = {}) => {
  const calls = []
  const fn = vi.fn(async (url, options = {}) => {
    const target = String(url)
    const method = (options.method || 'GET').toUpperCase()
    calls.push({ url: target, method, body: options.body ? JSON.parse(options.body) : null })
    if (target.startsWith('/api/project/all')) return okBody(rows)
    if (target.startsWith('/api/currencies')) {
      return okBody([{ cid: 1, symbol: '$' }, { cid: 4, symbol: 'BTTC' }])
    }
    if (target.startsWith('/api/user')) return okBody(adminPayload ?? { uID: 7 })
    if (/\/api\/project\/[^/]+\/apply$/.test(target)) {
      return onApply ? onApply(target) : okBody({})
    }
    if (/\/api\/project\/[^/]+\/claim$/.test(target)) {
      return onClaim ? onClaim(target) : okBody({})
    }
    if (/^\/api\/project\/[^/]+$/.test(target) && method === 'PATCH') {
      return onPatch ? onPatch(target, options.body ? JSON.parse(options.body) : {}) : okBody({})
    }
    return okBody([])
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

const mount = (entry = '/wage') =>
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <WagePage />
    </MemoryRouter>
  )

const cards = (root) => Array.from(root.querySelectorAll('[data-sf-m="wage-card"]'))
const cardOf = (root, id) => root.querySelector(`[data-sf-m="wage-card"][data-sf-project="${id}"]`)

beforeEach(() => {
  I18N.lang = 'zh'
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7 }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/wage ① 列表卡：状态 / 已招 X/Y / 工资行 / 按钮态', () => {
  it('三卡渲染：招募中与已截止态、已招 X/Y、batt 与次币固定额、领工资置灰 + 倒计时', async () => {
    installFetch({ rows: [rowHired({ next_claim_at: FUTURE() }), ROW_OPEN, ROW_CLOSED] })
    const { container } = mount()

    await waitFor(() => expect(cards(container)).toHaveLength(3))

    // 状态标签：招募中 / 已截止
    expect(cardOf(container, '11').querySelector('[data-sf-m="wage-card-status"]').textContent).toBe(zh.wage.statusRecruiting)
    expect(cardOf(container, '13').querySelector('[data-sf-m="wage-card-status"]').textContent).toBe(zh.wage.statusClosed)

    // 已招 X/Y + 工资行（batt/次 + 间隔小时）
    expect(cardOf(container, '11').querySelector('[data-sf-m="wage-card-headcount"]').textContent).toBe('已招 2/3')
    expect(cardOf(container, '11').querySelector('[data-sf-m="wage-card-wage"]').textContent)
      .toContain('batt 30/次')
    expect(cardOf(container, '11').querySelector('[data-sf-m="wage-card-wage"]').textContent)
      .toContain('间隔 4 小时')

    // 可选次币：cid 4 ⇒ BTTC 固定额 50（cid 1 的 $ 也在符号表里，但该行金额为 0 ⇒ 不渲染额外段落）
    const extra = cardOf(container, '12').querySelector('[data-sf-m="wage-card-wage-extra"]')
    expect(extra).not.toBeNull()
    expect(extra.textContent).toContain('50')
    expect(extra.textContent).toContain('BTTC')
    expect(cardOf(container, '11').querySelector('[data-sf-m="wage-card-wage-extra"]')).toBeNull()

    // 已入职卡 = 【领工资】；可领时间未到 ⇒ 置灰 + 倒计时文案（data-sf-remaining > 0）
    const claimBtn = cardOf(container, '11').querySelector('[data-sf-action="claim"]')
    expect(claimBtn).not.toBeNull()
    expect(claimBtn.textContent).toBe(zh.wage.claim)
    expect(claimBtn.disabled).toBe(true)
    expect(claimBtn.getAttribute('data-sf-claimable')).toBe('0')
    expect(Number(claimBtn.getAttribute('data-sf-remaining'))).toBeGreaterThan(0)
    const hint = cardOf(container, '11').querySelector('[data-sf-m="wage-card-hint"]')
    expect(hint.textContent).toMatch(/后可领$/)

    // ★ 已加入的项目**不得再出现【加入】**（卡内只有【领工资】）
    expect(cardOf(container, '11').querySelector('[data-sf-action="join"]')).toBeNull()
    expect(cardOf(container, '11').querySelectorAll('[data-sf-m="wage-card-action"]')).toHaveLength(1)

    // 已在其他项目在职 ⇒ 本卡【加入】置灰 + 「同时只能在一个项目打工」
    const joinBtn = cardOf(container, '12').querySelector('[data-sf-action="join"]')
    expect(joinBtn).not.toBeNull()
    expect(joinBtn.disabled).toBe(true)
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-hint"]').textContent)
      .toBe(zh.wage.oneAtATime)

    // 已截止且未入职 ⇒ 无动作按钮（只在状态标签上体现）
    expect(cardOf(container, '13').querySelector('[data-sf-m="wage-card-action"]')).toBeNull()
  })

  it('已加入的卡换配色：data-sf-joined=1 + 【已加入】徽标；未加入卡 0 且无徽标', async () => {
    installFetch({ rows: [rowHired(), ROW_OPEN] })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    const joined = cardOf(container, '11')
    expect(joined.getAttribute('data-sf-joined')).toBe('1')
    expect(joined.className).toContain('is-joined')
    const badge = joined.querySelector('[data-sf-m="wage-card-joined"]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toBe(zh.wage.joinedBadge)
    // 徽标挂在标题行内，标题文字本身不受影响
    expect(joined.querySelector('[data-sf-m="wage-card-title"]').textContent).toBe('海鲜打包')

    const plain = cardOf(container, '12')
    expect(plain.getAttribute('data-sf-joined')).toBe('0')
    expect(plain.className).not.toContain('is-joined')
    expect(plain.querySelector('[data-sf-m="wage-card-joined"]')).toBeNull()
  })

  it('无人在职 ⇒ 招募中卡【加入】可点；已招满 ⇒ 置灰 + 已招满提示', async () => {
    installFetch({ rows: [ROW_OPEN, { ...ROW_CLOSED, status: 'recruiting', headcount: 2, hired_count: 2 }] })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    const joinBtn = cardOf(container, '12').querySelector('[data-sf-action="join"]')
    expect(joinBtn.disabled).toBe(false)
    expect(joinBtn.textContent).toBe(zh.wage.join)
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-hint"]')).toBeNull()

    const fullCard = cardOf(container, '13')
    expect(fullCard.querySelector('[data-sf-action="join"]').disabled).toBe(true)
    expect(fullCard.querySelector('[data-sf-m="wage-card-hint"]').textContent).toBe(zh.wage.full)
  })
})

describe('/wage ② 加入 / 领工资行为', () => {
  it('加入：POST 到该项目 apply ⇒ 卡内成功提示 + 重拉列表', async () => {
    const { calls } = installFetch({ rows: [ROW_OPEN], onApply: () => okBody({ applied: true }) })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-action="join"]'))

    await waitFor(() => {
      const notice = cardOf(container, '12').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice).not.toBeNull()
      expect(notice.getAttribute('data-sf-kind')).toBe('ok')
      expect(notice.textContent).toBe(zh.wage.joinedToast.replace('{{title}}', ROW_OPEN.title))
    })
    const apply = calls.filter((c) => /\/apply$/.test(c.url))
    expect(apply).toHaveLength(1)
    expect(apply[0].method).toBe('POST')
    expect(apply[0].url).toBe('/api/project/12/apply')
    // 列表被重拉（首拉 + 成功后的静默刷新）
    expect(calls.filter((c) => c.url.startsWith('/api/project/all')).length).toBeGreaterThanOrEqual(2)
  })

  it('next_claim_at 未到 ⇒ 置灰倒计时；到点后 1s tick 自动可点', async () => {
    installFetch({
      rows: [rowHired({ next_claim_at: new Date(Date.now() + 1200).toISOString() })],
      onClaim: () => okBody({ wage_batt: 30 }),
    })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    const claimBtn = () => cardOf(container, '11').querySelector('[data-sf-action="claim"]')
    expect(claimBtn().disabled).toBe(true)
    expect(claimBtn().getAttribute('data-sf-claimable')).toBe('0')
    expect(Number(claimBtn().getAttribute('data-sf-remaining'))).toBeGreaterThan(0)

    // 到点：定时器 tick 后自动转可用（无需刷新、无需点击）
    await waitFor(() => expect(claimBtn().disabled).toBe(false), { timeout: 6000 })
    expect(claimBtn().getAttribute('data-sf-claimable')).toBe('1')
    expect(cardOf(container, '11').querySelector('[data-sf-m="wage-card-hint"]')).toBeNull()
  })

  it('领工资成功：POST claim ⇒ 卡内到账数值提示 + 间隔置灰倒计时', async () => {
    const { calls } = installFetch({
      rows: [rowHired({ next_claim_at: null, claim_ready_in_seconds: null })],
      onClaim: () => okBody({ wage_batt: 30, wage_currency_amount: 0 }),
    })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    const btn = cardOf(container, '11').querySelector('[data-sf-action="claim"]')
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)

    await waitFor(() => {
      const notice = cardOf(container, '11').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice).not.toBeNull()
      expect(notice.getAttribute('data-sf-kind')).toBe('ok')
      expect(notice.textContent).toBe('已领到 batt 30')
    })
    const claim = calls.filter((c) => /\/claim$/.test(c.url))
    expect(claim).toHaveLength(1)
    expect(claim[0].url).toBe('/api/project/11/claim')
    // 领完 ⇒ 按 wage_interval_hours 起倒计时（置灰）
    await waitFor(() => {
      const after = cardOf(container, '11').querySelector('[data-sf-action="claim"]')
      expect(after.getAttribute('data-sf-claimable')).toBe('0')
      expect(after.disabled).toBe(true)
    })
  })

  it('领工资失败（400 间隔未到）：卡内内联提示 + 列表仍在、按钮转置灰', async () => {
    installFetch({
      rows: [rowHired({ next_claim_at: null })],
      onClaim: () => errBody(400, {
        code: 'WAGE_CLAIM_TOO_SOON',
        details: { reason: 'WAGE_INTERVAL_NOT_REACHED', remaining_seconds: 90 },
      }),
    })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    fireEvent.click(cardOf(container, '11').querySelector('[data-sf-action="claim"]'))

    await waitFor(() => {
      const notice = cardOf(container, '11').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice).not.toBeNull()
      expect(notice.getAttribute('data-sf-kind')).toBe('err')
      expect(notice.getAttribute('role')).toBe('alert')
      expect(notice.textContent).toBe(zh.wage.claimTooSoon)
    })
    // 不白屏：卡还在，且失败体里的剩余秒数被接成倒计时
    expect(cards(container)).toHaveLength(1)
    const btn = cardOf(container, '11').querySelector('[data-sf-action="claim"]')
    expect(btn.getAttribute('data-sf-claimable')).toBe('0')
    expect(Number(btn.getAttribute('data-sf-remaining'))).toBeGreaterThan(0)
  })

  it('加入失败：卡内内联提示，列表不白屏', async () => {
    installFetch({
      rows: [ROW_OPEN],
      onApply: () => errBody(400, { code: 'PROJECT_FULL', details: { reason: 'PROJECT_FULL' } }),
    })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-action="join"]'))

    await waitFor(() => {
      const notice = cardOf(container, '12').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice.getAttribute('data-sf-kind')).toBe('err')
      expect(notice.textContent).toBe(zh.wage.full)
    })
    expect(cards(container)).toHaveLength(1)
  })
})

describe('/wage ③ 未登录（公开浏览） / 空态', () => {
  it('未登录 ⇒ 也拉 /api/project/all 并渲染项目卡；页顶只留轻提示（不整页替换）', async () => {
    I18N.lang = 'zh'
    AUTH.isAuthenticated = false
    const { calls } = installFetch({ rows: [ROW_OPEN, ROW_CLOSED] })
    const { container } = mount('/en/wage')

    // 列表真渲染（公开浏览面）：项目名 / 简述 / 状态 / 已招 X/Y / 工资行 / 次币
    await waitFor(() => expect(cards(container)).toHaveLength(2))
    const open = cardOf(container, '12')
    expect(open.querySelector('[data-sf-m="wage-card-title"]').textContent).toBe(ROW_OPEN.title)
    expect(open.querySelector('[data-sf-m="wage-card-desc"]').textContent).toBe(ROW_OPEN.description)
    expect(open.querySelector('[data-sf-m="wage-card-status"]').textContent).toBe(zh.wage.statusRecruiting)
    expect(cardOf(container, '13').querySelector('[data-sf-m="wage-card-status"]').textContent)
      .toBe(zh.wage.statusClosed)
    expect(open.querySelector('[data-sf-m="wage-card-headcount"]').textContent).toBe('已招 1/5')
    expect(open.querySelector('[data-sf-m="wage-card-wage"]').textContent).toContain('batt 20/次')
    // 次币定额：客态也必须拿到币种符号（/api/currencies 是公开读口）
    expect(open.querySelector('[data-sf-m="wage-card-wage-extra"]').textContent).toContain('BTTC')

    // 页顶轻提示与列表**并存**（旧形态「未登录 ⇒ 整页只有登录块」已作废）
    const login = container.querySelector('[data-sf-m="wage-login"]')
    expect(login).not.toBeNull()
    expect(login.textContent).toContain(zh.wage.loginRequired)
    // 登录引导保留语言前缀（与 ProtectedRoute 同口径：/en/wage ⇒ /en/login）
    expect(container.querySelector('[data-sf-m="wage-login-cta"]').getAttribute('href')).toBe('/en/login')
    expect(container.querySelector('[data-sf-m="wage-list"]')).not.toBeNull()

    // 列表读口是真打了（GET），且**零写请求**
    expect(calls.filter((c) => c.url.startsWith('/api/project/all')).length).toBeGreaterThanOrEqual(1)
    expect(calls.filter((c) => /\/apply$|\/claim$/.test(c.url))).toHaveLength(0)
  })

  it('未登录点【加入】⇒ 可点（不置灰）+ 卡内登录提示 + 零写请求', async () => {
    AUTH.isAuthenticated = false
    const { calls } = installFetch({ rows: [ROW_OPEN] })
    const { container } = mount('/wage')
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    const joinBtn = cardOf(container, '12').querySelector('[data-sf-action="join"]')
    expect(joinBtn.disabled).toBe(false)
    expect(joinBtn.textContent).toBe(zh.wage.join)
    expect(joinBtn.getAttribute('data-sf-need-login')).toBe('1')
    fireEvent.click(joinBtn)

    await waitFor(() => {
      const notice = cardOf(container, '12').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice).not.toBeNull()
      expect(notice.getAttribute('data-sf-kind')).toBe('login')
      expect(notice.textContent).toContain(zh.wage.loginRequired)
    })
    // 卡内带登录入口，且不跳页（当前仍是 /wage 的卡）
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-login-link"]').getAttribute('href'))
      .toBe('/login')
    expect(calls.filter((c) => /\/apply$|\/claim$/.test(c.url))).toHaveLength(0)
    // 列表没被清空（提示是卡内的，不白屏）
    expect(cards(container)).toHaveLength(1)
  })

  it('未登录点【领工资】⇒ 同样只弹登录提示（零 claim 请求）', async () => {
    AUTH.isAuthenticated = false
    // 防御臂：真实客态不会有 my_role=hired，但一旦行内带了在职标记也必须被登录闸拦住
    const { calls } = installFetch({ rows: [rowHired({ next_claim_at: null })] })
    const { container } = mount('/wage')
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    const claimBtn = cardOf(container, '11').querySelector('[data-sf-action="claim"]')
    expect(claimBtn.disabled).toBe(false)
    expect(claimBtn.getAttribute('data-sf-need-login')).toBe('1')
    fireEvent.click(claimBtn)

    await waitFor(() => {
      const notice = cardOf(container, '11').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice.getAttribute('data-sf-kind')).toBe('login')
      expect(notice.textContent).toContain(zh.wage.loginRequired)
    })
    expect(calls.filter((c) => /\/claim$/.test(c.url))).toHaveLength(0)
  })

  it('匿名行（my_role/my_hired_at/next_claim_at 三键缺省）⇒ 全卡【加入】、无【领工资】，点击只弹登录提示', async () => {
    AUTH.isAuthenticated = false
    const anonRow = (row) => {
      const copy = { ...row }
      delete copy.my_role
      delete copy.my_hired_at
      delete copy.next_claim_at
      return copy
    }
    const { calls } = installFetch({ rows: [anonRow(rowHired()), anonRow(ROW_OPEN)] })
    const { container } = mount('/wage')
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    // 键缺省不得被当作 hired：两张卡都无【领工资】、无在职徽标
    expect(container.querySelectorAll('[data-sf-action="claim"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-sf-m="wage-card-joined"]')).toHaveLength(0)
    for (const card of cards(container)) {
      expect(card.getAttribute('data-sf-joined')).toBe('0')
      expect(card.getAttribute('data-sf-role')).toBe('anonymous')
      const joinBtn = card.querySelector('[data-sf-action="join"]')
      expect(joinBtn).not.toBeNull()
      expect(joinBtn.disabled).toBe(false)
      expect(joinBtn.textContent).toBe(zh.wage.join)
      expect(joinBtn.getAttribute('data-sf-need-login')).toBe('1')
    }

    fireEvent.click(cardOf(container, '11').querySelector('[data-sf-action="join"]'))
    await waitFor(() => {
      const notice = cardOf(container, '11').querySelector('[data-sf-m="wage-card-notice"]')
      expect(notice).not.toBeNull()
      expect(notice.getAttribute('data-sf-kind')).toBe('login')
      expect(notice.textContent).toContain(zh.wage.loginRequired)
    })
    expect(calls.filter((c) => /\/apply$|\/claim$/.test(c.url))).toHaveLength(0)
  })

  it('空列表 ⇒ 空态文案（不渲染卡片）', async () => {
    installFetch({ rows: [] })
    const { container } = mount()
    await waitFor(() => {
      expect(container.querySelector('[data-sf-m="wage-empty"]')).not.toBeNull()
    })
    expect(cards(container)).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// /wage ⑤ 项目卡【零编辑】（Kevin 2026-10-21②：编辑整体移出本页）
// ----------------------------------------------------------------------------
// 口径：项目编辑搬进项目页（`/:slug` 操作区【编辑项目】+ 模态框），因此本页必须**零编辑钮**、
//  **零 PATCH**、**零 `/api/user` 三键取数**——即便访问者本人是 owner、即便载荷里带 manage_tasks
//  管理员三键（判定随编辑一起搬走，本页不再有任何理由去取 /api/user）。
//  卡内也不得残留行内表单/编辑字段容器（旧 `wage-edit` / `data-sf-edit` 全部绝迹）。
describe('/wage ⑤ 项目卡零编辑（编辑已移入项目页）', () => {
  const ADMIN_OK = { can_access_admin: true, is_admin: false, permissions: ['manage_tasks'] }

  it('owner 本人的项目 ⇒ 仍零【编辑】钮、零 PATCH、零 `/api/user`', async () => {
    const { calls } = installFetch({ rows: [{ ...ROW_OPEN, owner_uid: '7' }], adminPayload: { uID: 7, admin: ADMIN_OK } })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    // 三零：钮 / 写口 / 三键取数（本页已无编辑入口）
    expect(container.querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-edit]')).toHaveLength(0)
    expect(container.querySelector('[data-sf-m="wage-edit"]')).toBeNull()
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
    expect(calls.filter((c) => c.url.startsWith('/api/user'))).toHaveLength(0)
  })

  it('manage_tasks 管理员载荷 ⇒ 也不出钮、也不取 /api/user（判定已搬到项目页）', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, owner_uid: '9' }, { ...ROW_CLOSED, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    // 负向臂不等异步：本页压根不该发 /api/user，直接断「零」
    expect(container.querySelectorAll('[data-sf-m="wage-card-edit"]')).toHaveLength(0)
    expect(calls.filter((c) => c.url.startsWith('/api/user'))).toHaveLength(0)
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('ended / 已截止卡的既有行为不变：零编辑钮、卡内动作仍按状态渲染', async () => {
    const { calls } = installFetch({
      rows: [
        { ...ROW_OPEN, owner_uid: '7' },
        { ...ROW_CLOSED, owner_uid: '7', status: 'ended' },
      ],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    expect(container.querySelectorAll('[data-sf-m="wage-card-edit"]')).toHaveLength(0)
    // 既有动作面未被「去编辑」误伤：招募中卡仍有【加入】，已截止卡无动作按钮
    expect(cardOf(container, '12').querySelector('[data-sf-action="join"]')).not.toBeNull()
    expect(cardOf(container, '13').querySelector('[data-sf-m="wage-card-action"]')).toBeNull()
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('未登录 ⇒ 同样零编辑钮、零写口、零 `/api/user`（公开浏览面只读）', async () => {
    AUTH.isAuthenticated = false
    const { calls } = installFetch({ rows: [{ ...ROW_OPEN, owner_uid: '7' }] })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))

    expect(container.querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
    expect(calls.filter((c) => c.url.startsWith('/api/user'))).toHaveLength(0)
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('整卡链接仍在（编辑搬走、入口保留）：有 slug ⇒ 卡是 `/<slug>` 链接，无 slug ⇒ article', async () => {
    installFetch({ rows: [{ ...ROW_OPEN, slug: 'sui', owner_uid: '7' }, ROW_CLOSED] })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    const linked = cardOf(container, '12')
    expect(linked.tagName).toBe('A')
    expect(linked.getAttribute('href')).toBe('/sui')
    expect(cardOf(container, '13').tagName).toBe('ARTICLE')
    // 卡内零编辑残留：连表单根 / 字段容器都不存在
    expect(container.querySelectorAll('[data-sf-edit], [data-sf-edit-err], [data-sf-edit-hint]')).toHaveLength(0)
  })
})

describe('/wage ⑥ i18n `wage` 命名空间（四语齐备 + 计数前推）', () => {
  const REQUIRED = [
    'menuLabel', 'title', 'loading', 'statusRecruiting', 'statusClosed', 'headcount', 'wageLine',
    'wageExtra', 'join', 'joining', 'joined', 'joinedToast', 'claim', 'claiming', 'claimReadyIn',
    'inService', 'full', 'oneAtATime', 'claimed', 'claimedWithCurrency', 'claimTooSoon', 'notHired',
    'claimFailed', 'applyFailed', 'loginRequired', 'loginCta', 'loadFailed', 'retry', 'empty',
    'joinedBadge', 'streakReward',
    // 项目卡【编辑】（2026-10-21）：表单标题/状态标签/保存动作/错误文案（间隔校验复用 bountyProject）
    'editTitle', 'fieldStatus', 'cancel', 'saving', 'editSaved', 'editFailed',
    'errTitle', 'errDescription', 'errHeadcount', 'errHeadcountBelowHired', 'errMinDays', 'errBatt',
    'errCurrencyPair', 'errCurrencyInvalid', 'errCurrencyAmount', 'errStatus', 'errTransition', 'errFrozen',
  ]

  it('四语键集相同且逐键非空；menuLabel 逐字 = 领工资 系', () => {
    for (const lang of LANGS) {
      const ns = TABLES[lang].wage
      expect(Object.keys(ns).sort(), lang).toEqual([...REQUIRED].sort())
      for (const key of REQUIRED) expect(String(ns[key]).trim().length, `${lang}.${key}`).toBeGreaterThan(0)
    }
    expect(TABLES.zh.wage.menuLabel).toBe('领工资')
    expect(TABLES.en.wage.menuLabel).toBe('Claim pay')
    expect(TABLES.hk.wage.menuLabel).toBe('領工資')
    expect(TABLES.vn.wage.menuLabel).toBe('Nhận lương')
  })

  it('计数前推：顶层 135 / 拍平 1369 / 四语节点 5476 / 顶层×4 = 540', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
      v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
    ))
    for (const lang of LANGS) {
      expect(Object.keys(TABLES[lang]).length, `${lang} top`).toBe(135) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
      expect(flat(TABLES[lang]).length, `${lang} flat`).toBe(1369) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】表单/错误文案，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump min-days-select +6 键（bountyProject.days1/7/30/365 + minDaysLegacy/minDaysNoGate，四语对称）⇒ flat 1271⇒1277 / 四语节点 5084⇒5108（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变]
    }
    expect(Object.keys(TABLES.zh).length * LANGS.length).toBe(540) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
    expect(flat(TABLES.zh).length * LANGS.length).toBe(5476) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】表单/错误文案，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump min-days-select +6 键（bountyProject.days1/7/30/365 + minDaysLegacy/minDaysNoGate，四语对称）⇒ flat 1271⇒1277 / 四语节点 5084⇒5108（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277] // [i18n-bump task-status（2026-10-21 · 步 3 任务上线/下线开关）：+2 键 `project.taskOnline`/`project.taskOffline`（四语对称）⇒ top 135 不变 / flat 1355⇒1369 / 四语节点 5420⇒5476 / top×4 540 不变]
    // 新增命名空间恰 +1 顶层 / +29 拍平键（相对上一版 131 / 1140）；joinedBadge 加入后 30 键；streakReward 加入后 31 键；wage-edit +18 键后 49 键
    expect(REQUIRED).toHaveLength(49)
  })
})
