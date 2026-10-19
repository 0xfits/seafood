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
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react'
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
  // 本文件内 `vi.stubGlobal('fetch'…)` 的替身一律还原（防污染同文件/同进程后续用例）。
  vi.unstubAllGlobals()
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
    expect(fifth.key).toBe('profile') // requiresAuth 字段已废（2026-10-19：底栏恒 5 格，保护在路由层）
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
    ['zh', '/', ['/', '/exchange', '/item/new', '/messages', '/profile']],
    ['en', '/en', ['/en/', '/en/exchange', '/en/item/new', '/en/messages', '/en/profile']],
    ['hk', '/hk', ['/hk/', '/hk/exchange', '/hk/item/new', '/hk/messages', '/hk/profile']],
    ['vn', '/vn', ['/vn/', '/vn/exchange', '/vn/item/new', '/vn/messages', '/vn/profile']],
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
    expect(items[0].getAttribute('href')).toBe('/item/new')
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
    expect(items[0].getAttribute('href')).toBe('/en/item/new')
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

  it('桌面（默认）块里 .sf-fm = display:flex（几何：宽 72px / 单元高 92px / 圆角声明 36px / right:16px / top:45%）', () => {
    expect(widePart).toMatch(/\.sf-fm\s*\{[^}]*display:\s*flex/)
    expect(widePart).toContain('width: 72px')
    // [2026-10-11] 圆角声明 54px → 36px（= 宽 72 的一半；生效值本就是 36px ⇒ 零视觉差）
    expect(widePart).toContain('border-radius: 36px')
    expect(widePart).not.toContain('border-radius: 54px')
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
  ])('%s 档 消息面板（`/messages` 直链落点 = 首页 + 面板）：面板钩子在场 + 占位钩子 = 0', async (lang, title, empty) => {
    // ★ 改锚（v1.19 §21.6(A1) 第 1/2 处 · 消息面板化「方案 1 · 就地叠加」/ `T104`–`T108`）：
    //   原断言 = 「`MessagesPage` 渲染**真页**（宿主钩子 `messages-page` 在场）」。面板化后
    //   `/messages` = **直链落点 = 首页 + 面板**（同一面板，底 = 首页）⇒ 宿主钩子**改名**
    //   `messages-page` ⇒ `messages-panel`，面板由 `shell/AppShell.jsx` 按 `T105` 判据**条件挂载、单源渲染**
    //   （`MessagesPage` 体内容 = `<HomePage />`，**不再自渲染面板** ⇒ 两个打开态零判据分叉）。
    //   故本锚同步前移（**非放宽**）：宿主改为 `<AppShell><MessagesPage /></AppShell>` + 新钩子
    //   `messages-panel`；其余冻结面（四语标题 / 空态文案 / 占位钩子 = 0 / 两键已删）逐字保留。
    //   ★ 取数替身：**同一替身**同时服务「首页」与「面板」（`/messages` 落点 = 首页 + 面板）——
    //     首页在空 `rows` 替身下的取数失败分支已自带兜底（`homePayload?.tasks || []`），**不新造全局假数据**。
    H.lang = lang
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { rows: [], next_cursor: null } }),
    })))
    const { container } = renderIn(<AppShell><MessagesPage /></AppShell>, '/messages')
    const page = container.querySelector('[data-sf-m="messages-panel"]')
    expect(page).not.toBeNull()
    // 旧宿主钩子（`messages-page`）已按 §21.5 改名 ⇒ 全仓不再产出
    expect(container.querySelector('[data-sf-m="messages-page"]')).toBeNull()
    // 面板两栏包裹层在场（左 = 联系人 / 右 = 对话）
    expect(container.querySelector('[data-sf-m="messages-panel-list"]')).not.toBeNull()
    expect(container.querySelector('[data-sf-m="messages-panel-thread"]')).not.toBeNull()
    // 关闭键（§21.5 新增 `messages-panel-close` · 复用唯一新键 `messagesPage.close`）
    expect(container.querySelector('[data-sf-m="messages-panel-close"]').getAttribute('aria-label'))
      .toBe(TABLES[lang].messagesPage.close)
    expect(page.textContent).toContain(title)
    // 面板钩子在场 + 空态文案（原「empty」断言语义的等价承接）
    const emptyEl = await waitFor(() => {
      const el = container.querySelector('[data-sf-m="messages-list-empty"]')
      expect(el).not.toBeNull()
      return el
    })
    expect(emptyEl.textContent).toBe(empty)
    // T101 占位区块整块移除：钩子全仓命中 = 0（`N43` 判据）
    expect(container.querySelectorAll('[data-sf-m="messages-x-placeholder"]').length).toBe(0)
    // 占位键四语同删（本文件已 import 四语表 ⇒ 逐语断言 = 四语同删证据）
    expect(TABLES[lang].messagesPage.xPlaceholder).toBeUndefined()
    expect(TABLES[lang].messagesPage.xNote).toBeUndefined()
    for (const l of Object.keys(TABLES)) {
      expect(TABLES[l].messagesPage.xPlaceholder).toBeUndefined()
      expect(TABLES[l].messagesPage.xNote).toBeUndefined()
    }
  })

  it('未打开态（`/`）⇒ 面板**不在 DOM**（条件挂载 · 与改前形态逐字相同 · 零回归面）', () => {
    // ★ 本单新增反断言（v1.19 §21.4 面板挂载 = **条件挂载**；判据 = `T105`）：
    //   未命中判据 ⇒ 面板整棵子树不渲染（`shell/AppShell.jsx`），且零 `messages-*` 钩子产出。
    H.lang = 'zh'
    const { container } = renderIn(<AppShell><div data-testid="page">page</div></AppShell>, '/')
    expect(container.querySelector('[data-sf-m="messages-panel"]')).toBeNull()
    expect(container.querySelectorAll('[data-sf-m^="messages-"]').length).toBe(0)
    // 反事实：同一判据下 `/messages` 必须真出场（证明本尺子对「打开态」敏感）
    const opened = renderIn(<AppShell><div data-testid="page">page</div></AppShell>, '/messages')
    expect(opened.container.querySelector('[data-sf-m="messages-panel"]')).not.toBeNull()
    expect(opened.container.querySelector('[data-sf-region="shell"]').className).toContain('sf-shell--msg-open')
  })
})
