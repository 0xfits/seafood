/**
 * Toast 双轨（Kevin 2026-10-24 裁定 · design `T126` / §40 `T139`）
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   ① **单一出口** `toastCredit` —— 参数逐键断言（`position: 'top-center'` · `className: 'sf-toast-credit'`
 *      · `duration: 5000` · `style.fontSize: 18` · `style.marginTop: '32vh'`），且 `opts` 只在
 *      「不推翻出口定义」的键上生效（覆盖 duration 可以，位置/类名由出口锁定）；
 *   ② **5 处余额增加类** 真渲染取证 —— 领奖·一键全领 / 领奖·单笔（`ClaimButton`）· 退款到账 /
 *      确认收货（`MyOrdersPanel`）成功 ⇒ 走强化档；**发货**（非余额）成功 ⇒ **仍内联、零 toast**；
 *   ③ **反向断言** —— 收藏成功 / bio 保存 / 后台设置保存 / 我的邀请绑定成功 一律**仍走默认**
 *      （`toast.success` 直调、**不带** `sf-toast-credit`）；全仓 `toastCredit` 引用面 = 出口模块 + 4 个文件；
 *   ④ 出口的「普通 toast 不变」物理前提 —— `main.jsx` 的 `<Toaster position="top-right" />` 字面仍在，
 *      强化档只用**单条 toast 覆盖** `position`。
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---- 唯一 Toast 出口的替身（`react-hot-toast` 默认导出 = { success, error }） ----
const TOAST = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: TOAST }))

// ★ 稳定性硬要求：`useTranslation().t` 与 `useAuth().user` 必须是**同一引用** ——
//   `MyOrdersPanel` 的取数 effect 依赖 `[isAuthenticated, user, t]`，替身每次返回新函数/新对象
//   会让 effect 每渲染重跑 ⇒ 无限 setState（实测 = worker JS heap OOM）。真 i18n / 真 auth 都是稳定引用。
const I18N = vi.hoisted(() => ({ t: (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: I18N.t }) }))

const AUTH = vi.hoisted(() => ({ user: { uID: 1, token: 'probe-token' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => ({ isAuthenticated: true, user: AUTH.user }) }))

const CAMPAIGN_API = vi.hoisted(() => ({
  claimCampaignAll: vi.fn(),
  claimSubtaskReward: vi.fn(),
  claimTaskReward: vi.fn(),
}))
vi.mock('../../pages/campaign/campaign-api', () => CAMPAIGN_API)

const ITEM_API = vi.hoisted(() => ({
  fetchMyListingOrders: vi.fn(),
  refundListingOrder: vi.fn(),
  shipListingOrder: vi.fn(),
  receiveListingOrder: vi.fn(),
}))
vi.mock('../../pages/item/item-api', () => ITEM_API)

import { toastCredit, TOAST_CREDIT_CLASS, TOAST_CREDIT_STYLE } from '../../toast-credit'
import ClaimButton from '../../pages/campaign/ClaimButton'
import MyOrdersPanel from '../../pages/item/MyOrdersPanel'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const SRC = path.resolve(HERE, '../..')
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

const t = I18N.t

beforeEach(() => {
  TOAST.success.mockClear()
  TOAST.error.mockClear()
  Object.values(CAMPAIGN_API).forEach((f) => f.mockReset())
  Object.values(ITEM_API).forEach((f) => f.mockReset())
  ITEM_API.fetchMyListingOrders.mockResolvedValue([])
})
afterEach(cleanup)

// ============================================================================
// ① 出口本身
// ============================================================================
describe('toastCredit = 余额增加类 Toast 的唯一出口', () => {
  it('默认参数：页面正中 top-center + 专属类 + 5s + 18px + 32vh 重心', () => {
    toastCredit('领工资成功 +100')
    expect(TOAST.success).toHaveBeenCalledTimes(1)
    const [message, opts] = TOAST.success.mock.calls[0]
    expect(message).toBe('领工资成功 +100')
    expect(opts.position).toBe('top-center')
    expect(opts.className).toBe('sf-toast-credit')
    expect(opts.className).toBe(TOAST_CREDIT_CLASS)
    expect(opts.duration).toBe(5000)
    expect(opts.style.fontSize).toBe(18)
    expect(opts.style.fontSize).toBeGreaterThanOrEqual(18)
    expect(opts.style.marginTop).toBe('32vh')
    expect(opts.style).toEqual({ ...TOAST_CREDIT_STYLE })
  })

  it('opts 只在不会推翻出口定义的键上生效（位置 / 类名仍由出口锁定）', () => {
    toastCredit('领奖成功 +5', { duration: 3000, className: 'sf-toast-credit', position: 'top-center' })
    const [, opts] = TOAST.success.mock.calls[0]
    expect(opts.duration).toBe(3000)
    expect(opts.position).toBe('top-center')
    expect(opts.className).toBe('sf-toast-credit')
  })

  it('非字符串入参不抛（null / 数字按文案渲染）', () => {
    expect(() => toastCredit(null)).not.toThrow()
    expect(TOAST.success.mock.calls[0][0]).toBe('')
  })
})

// ============================================================================
// ② 5 处余额增加类（真渲染）
// ============================================================================
describe('领奖（ClaimButton）= 强化档 toast', () => {
  const renderClaim = (variant) => render(
    <MemoryRouter>
      <ClaimButton variant={variant} refId="12" t={t} user={{ uID: 1 }} isAuthenticated />
    </MemoryRouter>,
  )

  it('一键全领成功（campaign.claim.allOk）⇒ toastCredit 等价参数', async () => {
    CAMPAIGN_API.claimCampaignAll.mockResolvedValue({ claimed: [{}, {}], total_primary: 30 })
    renderClaim('campaign')
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [message, opts] = TOAST.success.mock.calls[0]
    expect(message).toContain('campaign.claim.allOk')
    expect(opts.position).toBe('top-center')
    expect(opts.className).toBe('sf-toast-credit')
    expect(opts.duration).toBe(5000)
  })

  it('单笔领奖成功（campaign.claim.ok）⇒ toastCredit 等价参数', async () => {
    CAMPAIGN_API.claimTaskReward.mockResolvedValue({ amount: 7 })
    renderClaim('task')
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [message, opts] = TOAST.success.mock.calls[0]
    expect(message).toContain('campaign.claim.ok')
    expect(opts.position).toBe('top-center')
    expect(opts.className).toBe('sf-toast-credit')
  })
})

describe('订单动作（MyOrdersPanel）：退款 / 收货 = 强化档，发货 = 内联', () => {
  const renderPanel = () => render(
    <MemoryRouter initialEntries={['/profile/trades/bought']}>
      <MyOrdersPanel />
    </MemoryRouter>,
  )

  it('退款成功 ⇒ toastCredit（页面正中 / 18px）+ 卡内零成功文案', async () => {
    ITEM_API.refundListingOrder.mockResolvedValue({ status: 'refunded' })
    const { container } = renderPanel()
    fireEvent.change(container.querySelector('[data-sf-m="item-input-order"]'), { target: { value: '88' } })
    fireEvent.click(container.querySelector('[data-sf-m="item-refund-btn"]'))
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [, opts] = TOAST.success.mock.calls[0]
    expect(opts.position).toBe('top-center')
    expect(opts.className).toBe('sf-toast-credit')
    await waitFor(() => {
      const status = container.querySelector('[data-sf-m="item-refund-status"]')
      expect(status.getAttribute('data-sf-phase')).toBe('ok')
      expect(status.textContent.trim()).toBe('')
    })
  })

  it('确认收货成功 ⇒ toastCredit（卖方货款入账）', async () => {
    ITEM_API.receiveListingOrder.mockResolvedValue({ status: 'received' })
    const { container } = renderPanel()
    fireEvent.change(container.querySelector('[data-sf-m="item-input-order-action"]'), { target: { value: '88' } })
    fireEvent.click(container.querySelector('[data-sf-m="item-receive-btn"]'))
    await waitFor(() => expect(TOAST.success).toHaveBeenCalledTimes(1))
    const [message, opts] = TOAST.success.mock.calls[0]
    expect(message).toContain('listingOrders.receiveOk')
    expect(opts.position).toBe('top-center')
    expect(opts.className).toBe('sf-toast-credit')
  })

  it('发货成功（非余额变动）⇒ 零 toast，仍内联', async () => {
    ITEM_API.shipListingOrder.mockResolvedValue({ status: 'shipped' })
    const { container } = renderPanel()
    fireEvent.change(container.querySelector('[data-sf-m="item-input-order-action"]'), { target: { value: '88' } })
    fireEvent.click(container.querySelector('[data-sf-m="item-ship-btn"]'))
    await waitFor(() => {
      const status = container.querySelector('[data-sf-m="item-order-action-status"]')
      expect(status.getAttribute('data-sf-phase')).toBe('ok')
    })
    expect(TOAST.success).not.toHaveBeenCalled()
    expect(container.querySelector('[data-sf-m="item-order-action-status"]').textContent).toContain('listingOrders.shipOk')
  })

  it('退款失败 ⇒ 内联 error、零 toast（失败一律不进 Toast）', async () => {
    ITEM_API.refundListingOrder.mockRejectedValue(new Error('boom'))
    const { container } = renderPanel()
    fireEvent.change(container.querySelector('[data-sf-m="item-input-order"]'), { target: { value: '88' } })
    fireEvent.click(container.querySelector('[data-sf-m="item-refund-btn"]'))
    await waitFor(() => {
      const status = container.querySelector('[data-sf-m="item-refund-status"]')
      expect(status.getAttribute('data-sf-phase')).toBe('error')
    })
    expect(TOAST.success).not.toHaveBeenCalled()
  })
})

// ============================================================================
// ③ 反向断言（普通类零变化）
// ============================================================================
describe('反向：非余额增加类仍走默认 toast.success', () => {
  const ordinary = [
    ['pages/item/ItemDetailPage.jsx', "toast.success(t('item.favoriteOk'))"],          // 收藏
    ['pages/ProfilePage.jsx', "toast.success(t('profilePage.bioSaved'))"],             // bio 保存
    ['pages/AuthPage.jsx', "toast.success(t('authPage.bioSaved'))"],                   // 注册 bio 保存
    ['pages/admin/SystemSettings.jsx', "toast.success(t('adminSettings.saved'))"],     // 后台设置保存
    ['pages/profile/InvitePane.jsx', "toast.success(t('invite.ok'), { duration: 5000 })"], // 我的邀请绑定（非余额）
  ]

  it.each(ordinary)('%s 的既有成功出口逐字未动', (file, literal) => {
    expect(read(file)).toContain(literal)
  })

  it('toastCredit 引用面 = 出口 + 4 个文件，且强化类名只出现在出口与样式', () => {
    const walk = (dir, acc = []) => {
      for (const entry of fs.readdirSync(path.join(SRC, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`
        if (entry.isDirectory()) { if (!/test|locales|assets|images/.test(rel)) walk(rel, acc) }
        else if (/\.(jsx?|css)$/.test(entry.name)) acc.push(rel)
      }
      return acc
    }
    const files = walk('.')
    const users = files.filter((f) => read(f).includes('toastCredit'))
    // `styles.css` 只在本节注释里点名出口（无一字节运行时代码用途），一并列白
    expect(users.sort()).toEqual([
      './pages/campaign/ClaimButton.jsx',
      './pages/item/MyOrdersPanel.jsx',
      './pages/wage/WageMintEntry.jsx',
      './pages/wage/WagePage.jsx',
      './styles.css',
      './toast-credit.js',
    ].sort())
    const classRefs = files.filter((f) => read(f).includes('sf-toast-credit'))
    expect(classRefs.sort()).toEqual(['./styles.css', './toast-credit.js'])
  })

  it('main.jsx 的 Toaster 仍是 top-right（普通类位置的物理前提未动）', () => {
    const main = read('main.jsx')
    expect(main).toContain('<Toaster position="top-right" />')
  })

  it('styles.css 的强化块：18px + 无新主题 token + 层级低于模态框（60）', () => {
    const css = read('styles.css')
    const block = css.slice(css.indexOf('.sf-toast-credit {'), css.indexOf('@keyframes sf-toast-credit-in'))
    expect(block).toContain('font-size: 18px')
    expect(block).not.toMatch(/--sf-(?!page-fg|surface-bg|st-stroke-w-strong)/)
    expect(css).toContain('[data-rht-toaster]:has(.sf-toast-credit) { z-index: 50 !important; }')
    const modals = read('pages/project/project.css') + read('pages/wage/wage.css')
    expect(modals).toContain('z-index: 60') // 模态框实测档位（toast 容器 50 < 60）
  })
})
