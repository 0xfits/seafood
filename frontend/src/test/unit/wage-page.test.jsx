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
 *   ⑤ 项目卡【编辑】（Kevin 2026-10-21）：owner ∨ manage_tasks 管理员可见、ended 不显示、
 *      表单展开/预填、PATCH 载荷只含变化字段（两币成对）、409/400 按 reason 字段内联、
 *      成功后卡片刷新取新值；客态零 /api/user 请求；
 *      注册天数条件 = 四选一 select（1/7/30/365）：恰四档 ⇒ 预选对应项；0/90 ⇒ 预选「一天」
 *      ＋表单下提示行（保存载荷 = 选中的天数）；
 *   ⑥ i18n `wage` 命名空间四语齐备 + 计数前推（top 135 / flat 1355 / 四语节点 5420）。
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
// ⑤ 组【编辑】判定复用 item/item-edit-access 的模块级三键缓存（按 uID 跨用例存活）。
// 全组共用 uID 7 ⇒ 上一臂取回的管理员载荷会污染下一臂（实测：admin 臂 0 钮、
// 非管理员臂反而出钮）⇒ 每例先复位，恢复「新页面生命周期」语义（该导出即为此设）。
import { resetListingEditAdminCache } from '../../pages/item/item-edit-access'

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
  resetListingEditAdminCache()
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

describe('/wage ⑤ 项目卡【编辑】（owner ∨ manage_tasks 管理员）', () => {
  const ADMIN_OK = { can_access_admin: true, is_admin: false, permissions: ['manage_tasks'] }

  it('manage_tasks 管理员 ⇒ 每张卡有【编辑】；展开预填；载荷只含变化字段；成功后卡片标题更新', async () => {
    const liveRows = [
      { ...ROW_OPEN, owner_uid: '9' },
      { ...ROW_CLOSED, owner_uid: '9' },
    ]
    const { calls } = installFetch({
      rows: liveRows,
      adminPayload: { uID: 7, admin: ADMIN_OK },
      onPatch: (target, body) => {
        // 模拟服务端写库：把载荷合并进夹具行 ⇒ 重拉列表能读到新值
        const id = Number(target.split('/').pop())
        const row = liveRows.find((r) => r.project_id === id)
        if (row) Object.assign(row, body)
        return okBody({ ...row })
      },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))

    // 管理员：每张卡都有【编辑】（头行小按钮，不属于主行动行）。
    // 三键走 /api/user 异步解析 ⇒ 与卡渲染不是同帧，等【编辑】钮落定再断言（恰 2 张卡各 1）。
    await waitFor(() => expect(container.querySelectorAll('[data-sf-m="wage-card-edit"]')).toHaveLength(2))
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]').textContent).toBe(zh.common.edit)
    expect(cardOf(container, '12').querySelectorAll('[data-sf-m="wage-card-action"]')).toHaveLength(1)

    // 展开：表单预填当前值
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).not.toBeNull()
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    expect(form().querySelector('[data-sf-edit="title"]').value).toBe(ROW_OPEN.title)
    expect(form().querySelector('[data-sf-edit="headcount"]').value).toBe('5')

    // 只改标题与状态 ⇒ PATCH 载荷**恰**为两键（未动的字段一律不上送）
    fireEvent.change(form().querySelector('[data-sf-edit="title"]'), { target: { value: '新标题' } })
    fireEvent.change(form().querySelector('[data-sf-edit="status"]'), { target: { value: 'working' } })
    fireEvent.click(form().querySelector('[data-sf-m="wage-edit-save"]'))

    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).toBeNull())
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].url).toBe('/api/project/12')
    expect(patches[0].body).toEqual({ title: '新标题', status: 'working' })

    // 成功 ⇒ 卡内成功提示 + 重拉列表 ⇒ 卡片标题更新
    const notice = cardOf(container, '12').querySelector('[data-sf-m="wage-card-notice"]')
    expect(notice.getAttribute('data-sf-kind')).toBe('ok')
    expect(notice.textContent).toBe(zh.wage.editSaved)
    await waitFor(() => (
      expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-title"]').textContent).toBe('新标题')
    ))
    expect(calls.filter((c) => c.url.startsWith('/api/project/all')).length).toBeGreaterThanOrEqual(2)
  })

  it('非管理员非本人 ⇒ 无【编辑】；permissions 管理员 ≠ manage_tasks（如 manage_rewards）⇒ 也不显示', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: { can_access_admin: true, is_admin: false, permissions: ['manage_rewards'] } },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    // 负向臂先等 /api/user 三键路径真实发起（载荷无 manage_tasks ⇒ 任何时刻都出不了钮），再断「无钮」
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/user')).length).toBeGreaterThanOrEqual(1))
    expect(container.querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
  })

  it('/api/user 无 admin 三键 ⇒ fail-safe：只按 owner 判，不显示【编辑】', async () => {
    const { calls } = installFetch({ rows: [{ ...ROW_OPEN, owner_uid: '9' }], adminPayload: { uID: 7 } })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    // 同上：fail-safe 臂也要等 /api/user 路径真实发起（载荷无 admin 三键 ⇒ 全 false ⇒ 出不了钮）
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/user')).length).toBeGreaterThanOrEqual(1))
    expect(container.querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
  })

  it('owner ⇒ 自己的卡有【编辑】，他人的卡没有', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, owner_uid: '7' }, { ...ROW_CLOSED, owner_uid: '9' }],
      adminPayload: { uID: 7 },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))
    // 等三键路径跑完（载荷无 admin 三键 ⇒ 他人卡任何时刻都出不了钮）再断两卡的可定性
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/user')).length).toBeGreaterThanOrEqual(1))
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull()
    expect(cardOf(container, '13').querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
  })

  it('ended 卡 ⇒ 即使 owner / 管理员也不显示【编辑】（后端终态封板）', async () => {
    installFetch({
      rows: [
        { ...ROW_OPEN, owner_uid: '7' },
        { ...ROW_CLOSED, owner_uid: '7', status: 'ended' },
      ],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(2))
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull()
    expect(cardOf(container, '13').querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
  })

  it('未登录 ⇒ 无【编辑】且零 /api/user 请求', async () => {
    AUTH.isAuthenticated = false
    const { calls } = installFetch({ rows: [{ ...ROW_OPEN, owner_uid: '7' }] })
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    expect(container.querySelector('[data-sf-m="wage-card-edit"]')).toBeNull()
    expect(calls.filter((c) => c.url.startsWith('/api/user'))).toHaveLength(0)
  })

  it('409 project_headcount_below_hired ⇒ headcount 字段内联提示、表单不收起', async () => {
    installFetch({
      rows: [{ ...ROW_OPEN, owner_uid: '9', hired_count: 3 }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
      onPatch: () => errBody(409, {
        code: 'LEDGER_INSUFFICIENT_BALANCE',
        details: { reason: 'project_headcount_below_hired', headcount: 1, hired_count: 3 },
      }),
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    // adminFlags 三键异步落定 ⇒ 等【编辑】钮出现再展开
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    fireEvent.change(form().querySelector('[data-sf-edit="headcount"]'), { target: { value: '1' } })
    fireEvent.click(form().querySelector('[data-sf-m="wage-edit-save"]'))

    await waitFor(() => {
      const err = form().querySelector('[data-sf-edit-err="headcount"]')
      expect(err).not.toBeNull()
      expect(err.textContent).toBe(zh.wage.errHeadcountBelowHired.replace('{{hired}}', '3'))
    })
    // 表单不收起（保持可改），409 提示留在字段旁
    expect(form()).not.toBeNull()
    expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).not.toBeNull()
  })

  it('客户端校验：间隔 200（须 1–100）⇒ 零 PATCH + 复用 bountyProject.intervalInvalid 内联', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    // adminFlags 三键异步落定 ⇒ 等【编辑】钮出现再展开
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    fireEvent.change(form().querySelector('[data-sf-edit="interval"]'), { target: { value: '200' } })
    fireEvent.click(form().querySelector('[data-sf-m="wage-edit-save"]'))

    await waitFor(() => expect(form().querySelector('[data-sf-edit-err="interval"]')).not.toBeNull())
    expect(form().querySelector('[data-sf-edit-err="interval"]').textContent).toBe(zh.bountyProject.intervalInvalid)
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('无变化保存 ⇒ 零 PATCH 请求、表单直接收起', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    // adminFlags 三键异步落定 ⇒ 等【编辑】钮出现再展开
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-edit-save"]'))
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).toBeNull())
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('清空次币 ⇒ 载荷恰为 wage_cid / wage_currency_amount 两键 null（成对上送）', async () => {
    const liveRows = [{ ...ROW_OPEN, owner_uid: '9' }] // wage_cid 4 + wage_currency_amount 50
    const { calls } = installFetch({
      rows: liveRows,
      adminPayload: { uID: 7, admin: ADMIN_OK },
      onPatch: (target, body) => {
        const id = Number(target.split('/').pop())
        const row = liveRows.find((r) => r.project_id === id)
        if (row) Object.assign(row, body)
        return okBody({ ...row })
      },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cards(container)).toHaveLength(1))
    // adminFlags 三键异步落定 ⇒ 等【编辑】钮出现再展开
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    expect(form().querySelector('[data-sf-edit="cid"]').value).toBe('4')
    expect(form().querySelector('[data-sf-edit="amount"]').value).toBe('50')

    fireEvent.change(form().querySelector('[data-sf-edit="cid"]'), { target: { value: '' } })
    // 选「无」⇒ 定额输入联动清空并禁用（两键同空）
    expect(form().querySelector('[data-sf-edit="amount"]').value).toBe('')
    expect(form().querySelector('[data-sf-edit="amount"]').disabled).toBe(true)
    fireEvent.click(form().querySelector('[data-sf-m="wage-edit-save"]'))

    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).toBeNull())
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].body).toEqual({ wage_cid: null, wage_currency_amount: null })
  })

  // ★ Kevin 2026-10-21：注册天数条件改四选一 select（1/7/30/365，常量真源 src/recruit-min-days.js）
  it('注册天数条件 = 四选一 select：预填 7 ⇒ 选中「一周」无提示；改选「一月」保存 ⇒ 载荷恰为 30', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, recruit_min_account_days: 7, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    const sel = () => form().querySelector('[data-sf-edit="minDays"]')
    expect(sel().tagName).toBe('SELECT')
    expect([...sel().options].map((o) => o.value)).toEqual(['1', '7', '30', '365']) // 恰 4 档
    expect(sel().value).toBe('7') // 恰为四档值 ⇒ 预选「一周」
    expect(form().querySelector('[data-sf-edit-hint="minDays"]')).toBeNull() // 匹配 ⇒ 无提示行

    fireEvent.change(sel(), { target: { value: '30' } })
    fireEvent.click(form().querySelector('[data-sf-m="wage-edit-save"]'))
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).toBeNull())
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].body).toEqual({ recruit_min_account_days: 30 }) // 保存载荷 = 选中的天数
  })

  it('注册天数条件预填 90（非四档）⇒ 预选「一天」+ 表单下提示行；保存载荷 = 1', async () => {
    const { calls } = installFetch({
      rows: [{ ...ROW_OPEN, recruit_min_account_days: 90, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    expect(form().querySelector('[data-sf-edit="minDays"]').value).toBe('1') // 回落「一天」
    const hint = form().querySelector('[data-sf-edit-hint="minDays"]')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toBe(zh.bountyProject.minDaysLegacy.replace('{{n}}', '90'))

    fireEvent.click(form().querySelector('[data-sf-m="wage-edit-save"]'))
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')).toBeNull())
    const patches = calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    expect(patches[0].body).toEqual({ recruit_min_account_days: 1 }) // 提示所言即载荷
  })

  it('注册天数条件预填 0 ⇒ 预选「一天」+「原为无门槛」提示', async () => {
    installFetch({
      rows: [{ ...ROW_OPEN, recruit_min_account_days: 0, owner_uid: '9' }],
      adminPayload: { uID: 7, admin: ADMIN_OK },
    })
    AUTH.user = { uID: 7, token: 't-7' }
    const { container } = mount()
    await waitFor(() => expect(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]')).not.toBeNull())
    fireEvent.click(cardOf(container, '12').querySelector('[data-sf-m="wage-card-edit"]'))
    const form = () => cardOf(container, '12').querySelector('[data-sf-m="wage-edit"]')
    expect(form().querySelector('[data-sf-edit="minDays"]').value).toBe('1')
    expect(form().querySelector('[data-sf-edit-hint="minDays"]').textContent).toBe(zh.bountyProject.minDaysNoGate)
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

  it('计数前推：顶层 135 / 拍平 1355 / 四语节点 5420 / 顶层×4 = 540', () => {
    const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
      v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
    ))
    for (const lang of LANGS) {
      expect(Object.keys(TABLES[lang]).length, `${lang} top`).toBe(135) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
      expect(flat(TABLES[lang]).length, `${lang} flat`).toBe(1355) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】表单/错误文案，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump min-days-select +6 键（bountyProject.days1/7/30/365 + minDaysLegacy/minDaysNoGate，四语对称）⇒ flat 1271⇒1277 / 四语节点 5084⇒5108（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
    }
    expect(Object.keys(TABLES.zh).length * LANGS.length).toBe(540) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
    expect(flat(TABLES.zh).length * LANGS.length).toBe(5420) // [i18n-bump campaign（顶层 campaign 54 键，四语对称）⇒ top 132⇒133 / flat 1169⇒1223 / 四语节点 4676⇒4892 / top×4 528⇒532] // [i18n-bump wage-edit +18 键（项目卡【编辑】表单/错误文案，四语对称）⇒ flat 1253⇒1271 / 四语节点 5012⇒5084（top 134 不变）] // [i18n-bump min-days-select +6 键（bountyProject.days1/7/30/365 + minDaysLegacy/minDaysNoGate，四语对称）⇒ flat 1271⇒1277 / 四语节点 5084⇒5108（top 134 不变）] // [i18n-bump project-slug（2026-10-21）：新增顶层 project 50 键 ⇒ top 134⇒135 / flat 1277⇒1327 / 四语节点 5108⇒5308 / top×4 536⇒540；bountyProject 注册天数 6 键（四语对称）已随前次订正计入 1277]
    // 新增命名空间恰 +1 顶层 / +29 拍平键（相对上一版 131 / 1140）；joinedBadge 加入后 30 键；streakReward 加入后 31 键；wage-edit +18 键后 49 键
    expect(REQUIRED).toHaveLength(49)
  })
})
