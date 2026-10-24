/**
 * /wage · 卡内按钮不得触发整卡导航（Kevin 2026-10-22 缺陷）
 * ---------------------------------------------------------------------------
 * 复现：项目卡根是 `<Link to="/<slug>">`，【领工资】按钮在 `<a>` 内部。
 *   `event.stopPropagation()` 只挡 React 合成事件的**冒泡**，**不取消锚点的默认导航**
 *   ⇒ 点按钮时浏览器照样整页跳到项目页（随后请求被中断，回来只看到兜底错误句）。
 *
 * 本文件钉死两件事：
 *   ① 【领工资】/【加入】点击后 `location.pathname` **不变**，且发起了对应写请求；
 *   ② 失败 reason 大小写不敏感：后端 `wage_interval_not_reached` / `worker_not_hired`（小写蛇形）
 *      必须命中专属文案，不得落兜底「这次没有领到」。
 */
import React from 'react'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => makeT(zh)(key, vars),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7 } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))
// 成功分支已改 Toast（2026-10-24）⇒ 本文件只关心导航/文案，隔离掉 toast 的真实副作用。
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import WagePage from '../../pages/wage/WagePage'

const HOUR = 3600 * 1000
const rowHired = {
  project_id: 11, title: '深度做市项目', slug: 'deep-mm', status: 'recruiting',
  headcount: 5, hired_count: 2, wage_batt_per_claim: '50', wage_interval_hours: 100,
  wage_cid: null, wage_currency_amount: null, owner_uid: 1,
  my_role: 'hired', my_hired_at: new Date(Date.now() - 200 * HOUR).toISOString(),
}
const rowRecruiting = { ...rowHired, project_id: 12, title: '另一项目', slug: 'another', my_role: 'none', my_hired_at: null }

/** 把当前 pathname 渲进 DOM，便于断言「没跳走」 */
const LocationProbe = () => {
  const loc = useLocation()
  return <span data-testid="loc">{loc.pathname}</span>
}

const mount = (entry = '/wage') =>
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <WagePage />
      <LocationProbe />
    </MemoryRouter>
  )

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const okBody = (data) => ({ success: true, data })

/** fetch 替身：列表 GET / 领取 POST / 加入 POST 分别应答 */
const stubFetch = ({ claimStatus = 200, claimError = null, joinStatus = 200, rows = [rowHired, rowRecruiting] } = {}) => {
  const calls = []
  const fn = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = String(init.method || 'GET').toUpperCase()
    calls.push(`${method} ${u}`)
    if (u.includes('/api/project/all')) return json(okBody(rows))
    if (u.includes('/api/currencies')) return json(okBody([{ cid: '1', symbol: '$', name: '积分' }]))
    if (method === 'POST' && u.includes('/claim')) {
      if (claimStatus >= 400) return json({ success: false, error: { code: 'LEDGER_AMOUNT_INVALID', details: claimError, message: 'x' } }, claimStatus)
      return json(okBody({ wage_batt: '50', streak: 0, bonus_amount: '0' }))
    }
    if (method === 'POST' && u.includes('/apply')) {
      if (joinStatus >= 400) return json({ success: false, error: { code: 'LEDGER_AMOUNT_INVALID', details: {}, message: 'x' } }, joinStatus)
      return json(okBody({ ok: true }))
    }
    if (u.includes('/api/user/balances')) return json(okBody([]))
    return json(okBody([]))
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

const cardOf = (root, id) => root.querySelector(`[data-sf-m="wage-card"][data-sf-project="${id}"]`)
const claimBtn = (card) => card.querySelector('[data-sf-action="claim"]')
const joinBtn = (card) => card.querySelector('[data-sf-action="join"]')

beforeEach(() => { AUTH.isAuthenticated = true; AUTH.user = { uID: 7 } })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('/wage 卡内按钮不触发整卡导航', () => {
  it('① 点【领工资】⇒ 发 POST 且 pathname 仍 /wage（不跳项目页）', async () => {
    const { calls } = stubFetch()
    const { container, getByTestId } = mount('/wage')
    await waitFor(() => expect(cardOf(container, '11')).toBeTruthy())
    const btn = claimBtn(cardOf(container, '11'))
    expect(btn).toBeTruthy()
    // 卡根是 Link（有 slug）⇒ 这是缺陷成立的前提
    expect(cardOf(container, '11').getAttribute('href')).toBe('/deep-mm')

    fireEvent.click(btn)
    await waitFor(() => expect(calls.some((c) => c.includes('/claim'))).toBe(true))
    expect(getByTestId('loc').textContent).toBe('/wage')
  })

  it('② 点【加入】⇒ 发 POST 且 pathname 仍 /wage', async () => {
    // 用户当前**未任职**任何项目（否则「同时只能在一个项目打工」会把【加入】置灰）
    const { calls } = stubFetch({ rows: [{ ...rowRecruiting, my_role: 'none', my_hired_at: null }] })
    const { container, getByTestId } = mount('/wage')
    await waitFor(() => expect(cardOf(container, '12')).toBeTruthy())
    fireEvent.click(joinBtn(cardOf(container, '12')))
    await waitFor(() => expect(calls.some((c) => c.includes('/apply'))).toBe(true))
    expect(getByTestId('loc').textContent).toBe('/wage')
  })

  it('③ 失败 reason 小写蛇形（wage_interval_not_reached）⇒ 专属文案，不落兜底', async () => {
    stubFetch({ claimStatus: 400, claimError: { reason: 'wage_interval_not_reached', claim_ready_in_seconds: 3600 } })
    const { container } = mount('/wage')
    await waitFor(() => expect(cardOf(container, '11')).toBeTruthy())
    fireEvent.click(claimBtn(cardOf(container, '11')))
    await waitFor(() => {
      const hint = cardOf(container, '11').textContent
      expect(hint).toContain(zh.wage.claimTooSoon)
      expect(hint).not.toContain(zh.wage.claimFailed)
    })
  })

  it('④ 失败 reason worker_not_hired ⇒ 「你还没有加入这个项目」', async () => {
    stubFetch({ claimStatus: 403, claimError: { reason: 'worker_not_hired' } })
    const { container } = mount('/wage')
    await waitFor(() => expect(cardOf(container, '11')).toBeTruthy())
    fireEvent.click(claimBtn(cardOf(container, '11')))
    await waitFor(() => {
      const hint = cardOf(container, '11').textContent
      expect(hint).toContain(zh.wage.notHired)
      expect(hint).not.toContain(zh.wage.claimFailed)
    })
  })
})
