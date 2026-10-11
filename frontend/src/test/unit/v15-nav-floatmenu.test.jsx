/**
 * v1.5 单测（本轮新增）—— design-system.spec v1.5 §14（T80–T86）+ route-layer.spec v2.27 §37
 *
 * 覆盖面（§14.7 判负清单的可测子集，设备档面见浏览器读数）：
 *   ① 底栏（H5）五项 label/href（含四语前缀）
 *   ② 右侧悬浮菜单：五项上→下 / 链接目标 / 三弹窗开关（遮罩 + ESC）/ 反馈弹窗不发起任何提交请求
 *   ③ 悬浮菜单可见性口径：shell.css 桌面默认 display:flex、≤767 唯一断点块内 display:none（唯一 @media）
 *   ④ `/messages` 路由可达（四语前缀）；悬浮菜单挂在 AppShell 中（data-sf-m="floatmenu"）
 *
 * 注：`.sf-fm` 的**真实计算 display**（1440 非 none / ≤767 = none）由真浏览器读数覆盖（jsdom 不套用 media query）。
 */
import React from 'react'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const TABLES = { zh, hk, en, vn }

const H = vi.hoisted(() => {
  const state = { lang: 'zh', tables: {} }
  state.t = (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.tables[state.lang])
    return v === undefined ? key : v
  }
  return state
})
H.tables = TABLES

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: H.t, i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' } }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12' }, logout: vi.fn() }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ can_access_admin: false, preferred_admin_path: '/dashboard' })),
  hasAdminPermission: vi.fn(() => false),
}))
vi.mock('../../components/Header', () => ({ default: () => <div>site header</div> }))
vi.mock('../../components/Footer', () => ({ default: () => <div>site footer</div> }))
vi.mock('../../components/LoginModal', () => ({ default: () => null }))

import BottomTabBar from '../../shell/BottomTabBar'
import FloatingMenu from '../../shell/FloatingMenu'
import AppShell from '../../shell/AppShell'
import MessagesPage from '../../pages/MessagesPage'
import { navPathInLang, SHELL_NAV_ITEMS } from '../../shell/nav'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../..')
const read = (p) => fs.readFileSync(p, 'utf8')

const renderIn = (node, entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {node}
    </MemoryRouter>
  )

const linkHrefs = (root) => Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href'))

beforeEach(() => {
  H.lang = 'zh'
  AUTH.isAuthenticated = true
  document.documentElement.setAttribute('data-theme', 'light')
})

afterEach(() => {
  cleanup()
})

describe('v1.5 ① 底栏（H5）五项 label / href（含四语前缀）', () => {
  it('nav 真源 = 五项，key 序 = home/shard/sell/messages/profile', () => {
    expect(SHELL_NAV_ITEMS.map((i) => i.key)).toEqual(['home', 'shard', 'sell', 'messages', 'profile'])
  })

  it('★本单 delta① 底栏⑤：key 仍 profile（路由不动）· labelKey 回 profile · profile 四语值 = 我的/Me/我的/Tôi · me 键已删', () => {
    const fifth = SHELL_NAV_ITEMS[4]
    expect(fifth.key).toBe('profile')
    expect(fifth.path).toBe('profile')
    expect(fifth.labelKey).toBe('profile')
    expect(fifth.requiresAuth).toBe(true)
    // 全站统一（Kevin 口径）：profile 键四语取值
    expect({ zh: TABLES.zh.profile, en: TABLES.en.profile, hk: TABLES.hk.profile, vn: TABLES.vn.profile })
      .toEqual({ zh: '我的', en: 'Me', hk: '我的', vn: 'Tôi' })
    // 上一轮（裁定⑧）另立的新键 me 已删（避免两键同义）
    expect(TABLES.zh.me).toBeUndefined()
    expect(TABLES.en.me).toBeUndefined()
    expect(TABLES.hk.me).toBeUndefined()
    expect(TABLES.vn.me).toBeUndefined()
  })

  it.each([
    ['zh', '/', ['/', '/exchange', '/listing/new', '/messages', '/profile']],
    ['en', '/en', ['/en/', '/en/exchange', '/en/listing/new', '/en/messages', '/en/profile']],
    ['hk', '/hk', ['/hk/', '/hk/exchange', '/hk/listing/new', '/hk/messages', '/hk/profile']],
    ['vn', '/vn', ['/vn/', '/vn/exchange', '/vn/listing/new', '/vn/messages', '/vn/profile']],
  ])('%s 档：底栏五项 href 与 label 取对应语 locale', (lang, entry, hrefs) => {
    H.lang = lang
    const { container } = renderIn(<BottomTabBar />, entry)
    const tabs = Array.from(container.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]'))
    expect(tabs.map((a) => a.getAttribute('href'))).toEqual(hrefs)
    expect(tabs.map((a) => a.getAttribute('data-sf-nav'))).toEqual(['home', 'shard', 'sell', 'messages', 'profile'])
    expect(tabs.map((a) => a.textContent.trim())).toEqual([
      TABLES[lang].home, TABLES[lang].shard, TABLES[lang].sell, TABLES[lang].messages, TABLES[lang].profile,
    ])
    // 语言前缀由 navPathInLang 承担（与真源逐项一致）
    expect(tabs.map((a) => a.getAttribute('href'))).toEqual(
      SHELL_NAV_ITEMS.map((i) => navPathInLang(i, lang))
    )
  })
})

describe('v1.5 ② 右侧悬浮菜单（T81–T84）', () => {
  it('五项上→下 = 卖闲置/消息/APP/反馈/客服，链接目标正确', () => {
    const { container } = renderIn(<FloatingMenu />, '/')
    const menu = container.querySelector('[data-sf-m="floatmenu"]')
    expect(menu).not.toBeNull()
    const items = Array.from(menu.querySelectorAll('[data-sf-m="floatmenu-item"]'))
    expect(items.map((el) => el.getAttribute('data-sf-fm'))).toEqual(['sell', 'messages', 'app', 'feedback', 'support'])
    expect(items.map((el) => el.textContent.trim())).toEqual([
      zh.sell, zh.messages, zh.app, zh.feedback, zh.support,
    ])
    // 前两项 = 链接（含语言前缀），后三项 = 按钮（开弹窗）
    expect(items[0].tagName).toBe('A')
    expect(items[0].getAttribute('href')).toBe('/listing/new')
    expect(items[1].tagName).toBe('A')
    expect(items[1].getAttribute('href')).toBe('/messages')
    expect(items.slice(2).every((el) => el.tagName === 'BUTTON')).toBe(true)
    // 单元间分隔线 = 4 条
    expect(menu.querySelectorAll('.sf-fm-div').length).toBe(4)
  })

  it('四语前缀：/en 档下链接带 /en 前缀', () => {
    H.lang = 'en'
    const { container } = renderIn(<FloatingMenu />, '/en')
    const items = Array.from(container.querySelectorAll('[data-sf-m="floatmenu-item"]'))
    expect(items[0].getAttribute('href')).toBe('/en/listing/new')
    expect(items[1].getAttribute('href')).toBe('/en/messages')
  })

  it('三弹窗：点开出现（role=dialog），关闭按钮可关；关后 DOM 无弹窗节点', () => {
    const { container } = renderIn(<FloatingMenu />, '/')
    const btn = (key) => container.querySelector(`[data-sf-fm="${key}"]`)
    for (const [key, titleKey] of [['app', 'appModal'], ['feedback', 'feedbackModal'], ['support', 'supportModal']]) {
      act(() => { fireEvent.click(btn(key)) })
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog, key).not.toBeNull()
      expect(dialog.textContent).toContain(zh[titleKey].title)
      // 关闭（弹窗底部按钮 = 各弹窗 close 键）
      const closeBtn = dialog.querySelector('[data-sf-m="floatmenu-modal-close"]')
      act(() => { fireEvent.click(closeBtn) })
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    }
  })

  it('ESC 关闭：打开后按 Escape ⇒ 弹窗消失', () => {
    const { container } = renderIn(<FloatingMenu />, '/')
    act(() => { fireEvent.click(container.querySelector('[data-sf-fm="support"]')) })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('反馈弹窗不做任何提交请求（表单占位：readonly 输入 + disabled 提交 + 提示），且无 fetch', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = renderIn(<FloatingMenu />, '/')
    act(() => { fireEvent.click(container.querySelector('[data-sf-fm="feedback"]')) })
    const dialog = document.querySelector('[role="dialog"]')
    const input = dialog.querySelector('[data-sf-m="floatmenu-feedback-input"]')
    expect(input.getAttribute('placeholder')).toBe(zh.feedbackModal.formPlaceholder)
    expect(input.hasAttribute('readonly')).toBe(true)
    const submit = dialog.querySelector('[data-sf-m="floatmenu-feedback-submit"]')
    expect(submit.disabled).toBe(true)
    expect(dialog.textContent).toContain(zh.feedbackModal.submitNote)
    // 点击提交按钮也不发起请求
    act(() => { fireEvent.click(submit) })
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('v1.5 ③ 悬浮菜单可见性只由 CSS 断点承担（§14.6 第 8–9 项 · T81）', () => {
  const css = read(path.join(SRC, 'shell/shell.css'))
  const widePart = css.slice(0, css.indexOf('@media'))
  const mobileBlock = css.slice(css.indexOf('@media'))

  it('shell.css 仍只有一个断点块（767px），且块内含 .sf-fm{display:none}', () => {
    const medias = css.match(/@media[^{]+/g) || []
    expect(medias).toHaveLength(1)
    expect(medias[0]).toContain('767px')
    expect(mobileBlock).toMatch(/\.sf-fm\s*\{[^}]*display:\s*none/)
  })

  it('桌面（默认）块里 .sf-fm = display:flex（几何：宽 72px / 单元高 92px / 圆角声明 54px / right:16px / top:45%）', () => {
    expect(widePart).toMatch(/\.sf-fm\s*\{[^}]*display:\s*flex/)
    expect(widePart).toContain('width: 72px')
    expect(widePart).toContain('border-radius: 54px')
    // 本单 delta②：单元间分隔线按 2/3 缩为 32px
    expect(widePart).toMatch(/\.sf-fm-div\s*\{[^}]*width:\s*32px/)
    expect(widePart).toContain('right: 16px')
    expect(widePart).toContain('top: 45%')
    expect(widePart).toContain('height: 92px')
  })

  it('FloatingMenu.jsx 不做 JS 断点判定（无 matchMedia/innerWidth/clientWidth）', () => {
    const src = read(path.join(SRC, 'shell/FloatingMenu.jsx'))
    expect(/matchMedia|innerWidth|innerHeight|clientWidth|offsetWidth|screen\.width/.test(src)).toBe(false)
  })
})

describe('v1.5 ④ /messages 路由可达 + 悬浮菜单挂载于 AppShell', () => {
  it('AppShell 内挂 FloatingMenu（data-sf-m="floatmenu"），且不新增 data-sf-region', () => {
    const { container } = renderIn(<AppShell><div data-testid="page">page</div></AppShell>, '/')
    expect(container.querySelector('[data-sf-m="floatmenu"]')).not.toBeNull()
    const regions = Array.from(container.querySelectorAll('[data-sf-region]')).map((el) => el.getAttribute('data-sf-region'))
    expect(regions).toEqual(['shell', 'topnav', 'content', 'footer', 'tabbar'])
  })

  it('App.jsx 源：/messages 挂在 LangShell 内层（相对段）', () => {
    const app = read(path.join(SRC, 'App.jsx'))
    expect(app).toContain('<Route path="messages" element={<MessagesPage />} />')
    expect(app).toContain("import MessagesPage from './pages/MessagesPage'")
    expect(app).not.toContain('path="nearby"')
  })

  it.each([
    ['zh', '消息', '暂无消息'],
    ['en', 'Messages', 'No messages yet'],
    ['hk', '訊息', '暫無訊息'],
    ['vn', 'Tin nhắn', 'Chưa có tin nhắn'],
  ])('%s 档 MessagesPage 渲染 messagesPage.* + X 接驳位占位钩子', (lang, title, empty) => {
    H.lang = lang
    const { container } = renderIn(<MessagesPage />, '/messages')
    const page = container.querySelector('[data-sf-m="messages-page"]')
    expect(page).not.toBeNull()
    expect(page.textContent).toContain(title)
    expect(page.textContent).toContain(empty)
    expect(container.querySelector('[data-sf-m="messages-x-placeholder"]')).not.toBeNull()
    expect(page.textContent).toContain(TABLES[lang].messagesPage.xPlaceholder)
  })
})
