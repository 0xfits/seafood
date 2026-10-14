/**
 * tg-bind-v2 · 2026-10-14 单 · Telegram 绑定卡「扫码绑定」主路径
 *
 * 覆盖（派单要求 ≥3 条）：
 *   ① 扫码面板渲染（bind/start 返回 bot_username 时）：QR SVG + 新开链接（t.me/<bot>，无 start 载荷）
 *      + 短码输入 + 确认按钮；旧长码路径折叠为次入口（details，钩子 tg-bind-code/steps/action 在场）
 *   ② bot_username 缺/空 ⇒ 扫码面板隐藏，回退旧长码路径（原渲染：code 槽 + steps + 回执确认）
 *   ③ confirm 成功：短码提交前 trim+toUpperCase ⇒ POST /api/telegram/bind/confirm ⇒ 转已绑定态 + 可见反馈
 *   ④ confirm 失败按 reason 映射文案（EXPIRED / TG_TARGET_ACCOUNT_TAKEN 两形抽测）
 *   ⑤ bind/start 503 ⇒ 整卡维持既有未配置降级态（env 降级零改动）
 *
 * mock 纪律：messages-api 全替身（vi.fn 驱动）；react-qr-code 用真件（纯 SVG，jsdom 可渲染）；
 * i18n 走真 zh 词典（H.t）⇒ 新键若缺会渲染裸键名、断言当场红。断言前推记录：本单四语 +8 键/语
 * ⇒ 顶层 128（不变）/ 拍平 1095⇒1103 / 四语节点 4380⇒4412（22 处硬编字面已同步前推）。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.t = (key, vars) => {
    let v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    if (typeof v === 'string' && vars) {
      for (const [k, val] of Object.entries(vars)) v = v.split(`{{${k}}}`).join(String(val))
    }
    return v === undefined ? key : v
  }
  return state
})
H.tables = { zh }

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t }) }))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  updateSession: (p) => p,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ can_access_admin: false, preferred_admin_path: '/dashboard' })),
  hasAdminPermission: vi.fn(() => false),
}))

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async () => []),
  fetchCurrentUser: vi.fn(async () => ({ uID: 7, EVM: '0xabc', bio: 'hello' })),
  getAuthHeaders: vi.fn(() => ({})),
  updateMyProfile: vi.fn(),
}))

vi.mock('../../ledger-api', () => ({
  fetchMyLedger: vi.fn(async () => ({ rows: [], nextBeforeTxid: null })),
  LEDGER_PAGE_SIZE: 20,
}))

// messages-api 全替身：每个用例按需改写返回值（具名导入 = 同一个 vi.fn 实例）。
const TG = vi.hoisted(() => ({
  status: vi.fn(async () => ({ tg_linked: false })),
  isNotConfigured: vi.fn(() => false),
  start: vi.fn(),
  unbind: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('../../messages-api', () => ({
  fetchTelegramBindStatus: TG.status,
  isTelegramNotConfigured: TG.isNotConfigured,
  startTelegramBind: TG.start,
  unbindTelegram: TG.unbind,
  confirmTelegramBind: TG.confirm,
}))

vi.mock('../../batt-checkin', () => ({
  fetchBatt: vi.fn(async () => null),
  fetchCheckinStatus: vi.fn(async () => null),
  postCheckin: vi.fn(),
  postMakeup: vi.fn(),
  utcDay: (n) => n,
}))

vi.mock('../../bttc-api', () => ({ postBttcMint: vi.fn(), postBttcBurn: vi.fn() }))

import ProfilePage from '../../pages/ProfilePage'

const renderCard = () => render(<MemoryRouter initialEntries={['/profile/settings']}><ProfilePage /></MemoryRouter>)

// 点既有 tg-bind-action（= 绑定按钮）⇒ 等 bind/start 后落到期望态（成功='code'；503 降级='notConfigured'）
const enterStateAfterBind = async (expectedState) => {
  const { container } = renderCard()
  const card = await waitFor(() => {
    const el = container.querySelector('[data-sf-m="tg-bind-card"]')
    expect(el).not.toBeNull()
    return el
  })
  // 先等初始 status 读数落定（'unbound'）——state='loading' 时按钮 disabled，点了也是空转
  await waitFor(() => expect(card.getAttribute('data-sf-tg-state')).toBe('unbound'))
  const bindBtn = card.querySelector('button[data-sf-m="tg-bind-action"]')
  expect(bindBtn).not.toBeNull()
  fireEvent.click(bindBtn)
  await waitFor(() => expect(card.getAttribute('data-sf-tg-state')).toBe(expectedState))
  return card
}

const enterCodeState = () => enterStateAfterBind('code')

beforeEach(() => {
  H.lang = 'zh'
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' }
  TG.status.mockClear()
  TG.isNotConfigured.mockClear()
  TG.isNotConfigured.mockImplementation(() => false)
  TG.start.mockReset()
  TG.unbind.mockReset()
  TG.confirm.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { points: 0 } }) })))
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('tg-bind-v2 · 扫码主路径（QR + 打开链接 + 短码 confirm）', () => {
  it('① 有 bot_username ⇒ 扫码面板渲染：QR SVG + t.me 链接（新开、无 start 载荷）+ 输入 + 确认；旧长码路径折叠为次入口', async () => {
    TG.start.mockResolvedValue({ code: 'v1.aaa.bbb', expires_in: 600, bot_username: 'seafood_bind_bot' })
    const card = await enterCodeState()

    const qr = card.querySelector('[data-sf-m="tg-bind-qr"]')
    expect(qr).not.toBeNull()
    // QR = react-qr-code 真件渲染的 SVG（本地方件，非外部图片服务）
    expect(qr.querySelector('svg')).not.toBeNull()

    const open = card.querySelector('a[data-sf-m="tg-bind-open"]')
    expect(open).not.toBeNull()
    expect(open.getAttribute('href')).toBe('https://t.me/seafood_bind_bot') // 逐字相等 ⇒ 不带任何 start 载荷
    expect(open.getAttribute('target')).toBe('_blank')
    expect(open.getAttribute('rel')).toContain('noopener')
    expect(open.textContent).toBe(zh.telegram.qrOpen)

    const input = card.querySelector('input[data-sf-m="tg-bind-code-input"]')
    expect(input).not.toBeNull()
    expect(input.getAttribute('placeholder')).toBe(zh.telegram.codeInputPlaceholder)

    const confirmBtn = card.querySelector('button[data-sf-m="tg-bind-confirm"]')
    expect(confirmBtn).not.toBeNull()
    expect(confirmBtn.textContent).toBe(zh.telegram.confirmBind)

    // 旧长码路径保留为次入口（折叠）：details 在场，钩子三件套都在 details 内且文案不动
    const details = card.querySelector('details')
    expect(details).not.toBeNull()
    expect(details.textContent).toContain(zh.telegram.codeLabel)
    expect(details.querySelector('[data-sf-m="tg-bind-code"]').textContent).toBe('v1.aaa.bbb')
    const steps = details.querySelector('[data-sf-m="tg-bind-steps"]')
    expect(steps.textContent).toBe(zh.telegram.codeSteps.replace('{{bot}}', 'seafood_bind_bot').replace('{{code}}', 'v1.aaa.bbb'))
    expect(details.querySelector('button[data-sf-m="tg-bind-action"]')).not.toBeNull()
  })

  it('② bot_username 缺/空 ⇒ 扫码面板隐藏，回退旧长码路径（原渲染：code 槽 + steps + 回执确认直出）', async () => {
    TG.start.mockResolvedValue({ code: 'v1.nobot.ccc', expires_in: 600 })
    const card = await enterCodeState()

    expect(card.querySelector('[data-sf-m="tg-bind-qr"]')).toBeNull()
    expect(card.querySelector('a[data-sf-m="tg-bind-open"]')).toBeNull()
    expect(card.querySelector('input[data-sf-m="tg-bind-code-input"]')).toBeNull()
    expect(card.querySelector('button[data-sf-m="tg-bind-confirm"]')).toBeNull()
    // 回退 = 旧路径直出（不在 details 内）
    expect(card.querySelector('details')).toBeNull()
    expect(card.querySelector('[data-sf-m="tg-bind-code"]').textContent).toBe('v1.nobot.ccc')
    expect(card.querySelector('[data-sf-m="tg-bind-steps"]')).not.toBeNull()
    expect(card.querySelector('button[data-sf-m="tg-bind-action"]')).not.toBeNull()
  })

  it('③ confirm 成功：短码提交前 trim+toUpperCase ⇒ confirm 收到归一码 ⇒ 转已绑定态 + bindSuccess 可见反馈', async () => {
    TG.start.mockResolvedValue({ code: 'v1.okk.ddd', bot_username: 'seafood_bind_bot' })
    TG.confirm.mockResolvedValue({ tg_linked: true, tg_linked_at: 1728880000 })
    const card = await enterCodeState()

    const input = card.querySelector('input[data-sf-m="tg-bind-code-input"]')
    fireEvent.change(input, { target: { value: '  ab12cd  ' } })
    fireEvent.click(card.querySelector('button[data-sf-m="tg-bind-confirm"]'))

    await waitFor(() => expect(TG.confirm).toHaveBeenCalledTimes(1))
    expect(TG.confirm.mock.calls[0][0]).toBe('AB12CD') // trim + 大写归一后提交
    // 成功 = 转已绑定态 + 可见反馈
    await waitFor(() => expect(card.getAttribute('data-sf-tg-state')).toBe('bound'))
    expect(card.querySelector('[data-sf-m="tg-bind-notice"]').textContent).toBe(zh.telegram.bindSuccess)
  })

  it('④ confirm 失败按 reason 映射文案：EXPIRED 与 TG_TARGET_ACCOUNT_TAKEN 两形（态不翻转、留 code）', async () => {
    TG.start.mockResolvedValue({ code: 'v1.exp.eee', bot_username: 'seafood_bind_bot' })
    const card = await enterCodeState()

    TG.confirm.mockRejectedValue(Object.assign(new Error('expired'), { code: 'TG_CODE_EXPIRED' }))
    fireEvent.change(card.querySelector('input[data-sf-m="tg-bind-code-input"]'), { target: { value: 'zz99xx' } })
    fireEvent.click(card.querySelector('button[data-sf-m="tg-bind-confirm"]'))
    await waitFor(() => expect(card.querySelector('[data-sf-m="tg-bind-notice"]').textContent).toBe(zh.telegram.codeExpired))
    expect(card.getAttribute('data-sf-tg-state')).toBe('code')

    TG.confirm.mockClear()
    TG.confirm.mockRejectedValue(Object.assign(new Error('taken'), { code: 'TG_TARGET_ACCOUNT_TAKEN' }))
    fireEvent.click(card.querySelector('button[data-sf-m="tg-bind-confirm"]'))
    await waitFor(() => expect(card.querySelector('[data-sf-m="tg-bind-notice"]').textContent).toBe(zh.telegram.accountTaken))
    expect(card.getAttribute('data-sf-tg-state')).toBe('code')
  })

  it('⑤ bind/start 503 ⇒ 整卡维持既有未配置降级态（env 降级零改动）', async () => {
    TG.start.mockRejectedValue(Object.assign(new Error('503'), { code: 'TG_NOT_CONFIGURED' }))
    TG.isNotConfigured.mockImplementation(() => true)
    const card = await enterStateAfterBind('notConfigured')
    expect(card.getAttribute('data-sf-tg-state')).toBe('notConfigured')
    expect(card.querySelector('[data-sf-m="tg-bind-qr"]')).toBeNull()
    expect(card.textContent).toContain(zh.telegram.notConfigured)
  })
})
