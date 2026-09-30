import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

vi.mock('../../auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ can_access_admin: false, preferred_admin_path: '/dashboard' })),
  hasAdminPermission: vi.fn(() => false),
}))

import AppShell from '../../shell/AppShell'
import { BREAKPOINTS } from '../../shell/breakpoints'
import { SHELL_NAV_ITEMS, isNavItemActive, navPathInLang, visibleNavItems } from '../../shell/nav'
import { TOKEN_KEYS } from '../../theme/tokens'
import { useAuth } from '../../auth-context'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../..')
const REPO_ROOT = path.resolve(here, '../../../..')
const read = (p) => fs.readFileSync(p, 'utf8')

// DOM 形状签名：只取**结构**信息（标签名 + 语义属性），刻意不含 class/style/文本，
// 口径 = 「元素序列与语义绑定」，用来判「换主题/换屏型有没有换结构」。
// 唯一例外：既有 Header 的主题开关按钮内部按档渲染 Sun/Moon 两个不同图标（既有实现，本单未改），
// 其差异被显式排除在签名之外 —— 但**另有一条断言证明差异确实被局限在这棵子树内**（见下方用例）。
const SHAPE_ATTRS = ['href', 'id', 'role', 'type', 'aria-current', 'aria-label', 'data-sf-region', 'data-sf-nav', 'data-sf-shell']
const THEME_ICON_OWNER = 'button[aria-label="darkMode"]'
const shape = (root) =>
  Array.from(root.querySelectorAll('*'))
    .filter((el) => !el.closest(THEME_ICON_OWNER))
    .map((el) => {
      const attrs = SHAPE_ATTRS.map((a) => {
        const v = el.getAttribute?.(a)
        return v === null || v === undefined ? null : `${a}=${v}`
      }).filter(Boolean)
      return `${el.tagName}[${attrs.join('|')}]`
    })
    .join('>')

const subtreeCount = (root) => {
  const owner = root.querySelector(THEME_ICON_OWNER)
  return owner ? owner.querySelectorAll('*').length : 0
}

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell>
        <div data-testid="page">page</div>
      </AppShell>
    </MemoryRouter>
  )

describe('应用外壳 · 骨架同构（横竖屏同一套 DOM）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: false, user: null, logout: vi.fn() })
    document.documentElement.setAttribute('data-theme', 'light')
  })

  afterEach(() => {
    cleanup()
  })

  it('区域顺序恒定：shell → 顶栏 → 路由容器 → 页脚 → 底部 tab', () => {
    const { container } = renderShell()
    const regions = Array.from(container.querySelectorAll('[data-sf-region]')).map((el) => el.getAttribute('data-sf-region'))
    expect(regions).toEqual(['shell', 'topnav', 'content', 'footer', 'tabbar'])
  })

  it('底部 tab 始终在 DOM 中（宽屏只是被断点 CSS 隐藏，不是条件渲染）', () => {
    const { container } = renderShell()
    const tabbar = container.querySelector('[data-sf-region="tabbar"]')
    expect(tabbar).not.toBeNull()
    const tabs = Array.from(tabbar.querySelectorAll('a[data-sf-nav]'))
    expect(tabs.map((a) => a.getAttribute('data-sf-nav'))).toEqual(visibleNavItems(false).map((i) => i.key))
  })

  it('顶栏与底栏导航项同源同序（底栏含显式 home tab，顶栏以品牌 logo 承担 home）', () => {
    const { container } = renderShell()
    const topHrefs = Array.from(container.querySelectorAll('.nav-link[href]')).map((a) => a.getAttribute('href'))
    const tabHrefs = Array.from(container.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => a.getAttribute('href'))
    const expected = visibleNavItems(false).map((i) => navPathInLang(i, 'zh'))
    // 底栏 = 五个真实路由（含 home）
    expect(tabHrefs).toEqual(expected)
    // 顶栏 = 同一份真源去掉 home（home 由品牌 logo 承担），顺序必须是底栏序列的子序列
    expect(topHrefs).toEqual(expected.filter((p) => p !== '/'))
    const brandHref = container.querySelector('[data-sf-region="topnav"] a[href="/"]')
    expect(brandHref).not.toBeNull()
    expect(expected).toEqual(['/', '/reward', '/task', '/shard'])
  })

  it('未登录时不含 profile / 登录后含 profile（与 Header 同一条可见性规则）', () => {
    expect(visibleNavItems(false).map((i) => i.key)).toEqual(['home', 'reward', 'task', 'shard'])
    expect(visibleNavItems(true).map((i) => i.key)).toEqual(['home', 'reward', 'task', 'shard', 'profile'])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: '1', EVM: '0xabcdef1234' }, logout: vi.fn() })
    const { container } = renderShell()
    const tabs = Array.from(container.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => a.getAttribute('data-sf-nav'))
    expect(tabs).toEqual(['home', 'reward', 'task', 'shard', 'profile'])
  })

  it('四语切换入口在 shell 顶栏内可点（复用 4b-i locale 机制，不另造一套）', async () => {
    const { container } = renderShell()
    const top = container.querySelector('[data-sf-region="topnav"]')
    const trigger = Array.from(top.querySelectorAll('button')).find((b) => b.textContent.trim() === 'language')
    expect(trigger).toBeTruthy()
    // 语言菜单是既有 HoverMenu（mouseenter 后 delay=100ms 展开）⇒ 悬停后必须出现四语选项
    fireEvent.mouseEnter(trigger.parentElement)
    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent.trim())
      expect(labels).toContain('chinese')
      expect(labels).toContain('english')
      expect(labels).toContain('cantonese')
      expect(labels).toContain('vietnamese')
    })
  })

  it('导航项与真实路由实现一致（不发明页面名）', () => {
    const app = read(path.join(SRC, 'App.jsx'))
    for (const item of SHELL_NAV_ITEMS) {
      if (item.route === 'index') {
        expect(app).toContain('<Route index element={<HomePage />} />')
      } else {
        expect(app).toContain(`path="${item.route}"`)
      }
    }
    // labelKey 必须在四语 locale 里都存在
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      const locale = JSON.parse(read(path.join(SRC, `locales/${lang}.json`)))
      for (const item of SHELL_NAV_ITEMS) expect(locale[item.labelKey]).toBeTruthy()
    }
  })

  it('语言前缀与激活判定复用 utils（/en/reward、/hk/task 均命中）', () => {
    expect(navPathInLang(SHELL_NAV_ITEMS[1], 'zh')).toBe('/reward')
    expect(navPathInLang(SHELL_NAV_ITEMS[1], 'en')).toBe('/en/reward')
    expect(isNavItemActive('/en/reward', SHELL_NAV_ITEMS[1])).toBe(true)
    expect(isNavItemActive('/hk/task', SHELL_NAV_ITEMS[2])).toBe(true)
    expect(isNavItemActive('/hk/task', SHELL_NAV_ITEMS[1])).toBe(false)
    expect(isNavItemActive('/', SHELL_NAV_ITEMS[0])).toBe(true)
  })
})

describe('应用外壳 · 主题切换不改 DOM 结构（结构级证据）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: false, user: null, logout: vi.fn() })
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
  })

  it('日档与夜档渲染出的元素序列/数量/语义绑定逐项相等', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    const day = renderShell()
    const dayShape = shape(day.container)
    const dayAll = day.container.querySelectorAll('*').length
    const dayIcons = subtreeCount(day.container)
    cleanup()

    document.documentElement.setAttribute('data-theme', 'dark')
    const night = renderShell()
    const nightShape = shape(night.container)
    const nightAll = night.container.querySelectorAll('*').length
    const nightIcons = subtreeCount(night.container)

    // ① 除主题开关图标子树外，结构逐项相等
    expect(nightShape).toBe(dayShape)
    expect(dayShape.length).toBeGreaterThan(200)
    // ② 全局元素数差 == 主题开关按钮内部的图标元素数差（证明差异被局限在该子树内，未外溢）
    expect(Math.abs(dayAll - nightAll)).toBe(Math.abs(dayIcons - nightIcons))
    expect(nightIcons).not.toBe(dayIcons)
  })

  it('同一档重复渲染也逐字节相同（证明这把尺子本身可重复）', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    const a = renderShell()
    const aShape = shape(a.container)
    cleanup()
    const b = renderShell()
    const bShape = shape(b.container)
    expect(bShape).toBe(aShape)
    expect(JSON.stringify(aShape)).toBe(JSON.stringify(bShape))
  })
})

describe('应用外壳 · 断点只能落在 CSS 里（结构级证据）', () => {
  const shellDir = path.join(SRC, 'shell')
  const themeDir = path.join(SRC, 'theme')

  it('shell/theme 的 JS 里不出现内联断点判定（无 matchMedia / innerWidth / clientWidth）', () => {
    const offenders = []
    for (const file of [...fs.readdirSync(shellDir).map((f) => path.join(shellDir, f)), ...fs.readdirSync(themeDir).map((f) => path.join(themeDir, f)), path.join(SRC, 'pages/ThemePreviewPage.jsx')]) {
      if (!/\.(js|jsx)$/.test(file)) continue
      const text = read(file)
      if (/matchMedia|innerWidth|innerHeight|clientWidth|offsetWidth|screen\.width/.test(text)) offenders.push(path.relative(SRC, file))
    }
    expect(offenders).toEqual([])
  })

  it('shell.css 只有一个断点块（手机竖屏 767px），底栏可见性只在这里翻转', () => {
    const css = read(path.join(shellDir, 'shell.css'))
    const medias = css.match(/@media[^{]+/g) || []
    expect(medias).toHaveLength(1)
    expect(medias[0]).toContain(`${BREAKPOINTS.phonePortraitMax}px`)
    const mobileBlock = css.slice(css.indexOf('@media'))
    expect(mobileBlock).toContain('.sf-tabbar')
    expect(mobileBlock).toContain('display: grid')
    // 宽屏（默认）块里底栏隐藏
    const widePart = css.slice(0, css.indexOf('@media'))
    expect(widePart).toMatch(/\.sf-tabbar\s*\{[^}]*display:\s*none/)
    // 栅格列数：宽屏 4 列（结构常量）→ 竖屏 2 列
    expect(widePart).toContain('repeat(var(--sf-st-feed-cols), minmax(0, 1fr))')
    expect(mobileBlock).toContain('repeat(var(--sf-st-feed-cols-m), minmax(0, 1fr))')
  })

  it('shell.css 里没有任何按主题分支的选择器（主题只能来自 token）', () => {
    const css = read(path.join(shellDir, 'shell.css'))
    expect(css).not.toContain('[data-theme')
    expect(css).not.toContain('theme-day')
    expect(css).not.toContain('theme-night')
  })

  it('token 层的主题块只声明 token 变量，且键名全部落在 TOKEN_KEYS 内', () => {
    const css = read(path.join(themeDir, 'theme-tokens.css'))
    const themeBlocks = css.match(/\[data-theme="(?:light|dark)"\][^{]*\{[^}]*\}/g) || []
    expect(themeBlocks.length).toBeGreaterThanOrEqual(2)
    const bad = []
    for (const block of themeBlocks) {
      const decls = block.match(/--[a-z0-9-]+\s*:/g) || []
      for (const d of decls) {
        const name = d.replace(/\s*:$/, '')
        if (!name.startsWith('--sf-')) { bad.push(`非 sf 变量 ${name}`); continue }
        if (!TOKEN_KEYS.includes(name.slice('--sf-'.length))) bad.push(`未登记 token ${name}`)
      }
      const nonVar = block
        .slice(block.indexOf('{') + 1, block.lastIndexOf('}'))
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !s.startsWith('--'))
      if (nonVar.length) bad.push(`主题块出现非变量声明: ${nonVar.join(' / ')}`)
    }
    expect(bad).toEqual([])
  })

  it('四语 locale 文件可解析、键集合相同、siteTitle 为硬编码站名', () => {
    const langs = ['zh', 'en', 'hk', 'vn']
    const tables = langs.map((l) => JSON.parse(read(path.join(SRC, `locales/${l}.json`))))
    const keys = tables.map((t) => Object.keys(t).sort())
    for (let i = 1; i < keys.length; i += 1) expect(keys[i]).toEqual(keys[0])
    // zh 站名逐字等于产品硬编码口径；其余三语为各自语言的硬编码站名（同样不来自后台）
    expect(tables[0].siteTitle).toBe('Seafood 海鲜市场｜加密人自己的「闲鱼」')
    for (const t of tables) {
      expect(typeof t.siteTitle).toBe('string')
      expect(t.siteTitle.startsWith('Seafood')).toBe(true)
    }
    // 启动前回退标题（index.html）+ 前台运行时真源（DocumentTitle）都指向同一站名
    const html = read(path.join(SRC, '../index.html'))
    expect(html).toContain('<title>Seafood 海鲜市场｜加密人自己的「闲鱼」</title>')
    const app = read(path.join(SRC, 'App.jsx'))
    expect(app).toContain("document.title = t('siteTitle')")
    expect(() => read(path.join(REPO_ROOT, 'docs/design/style-preview.html'))).not.toThrow()
  })
})
