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
import { SHELL_NAV_ITEMS, isNavItemActive, navPathInLang } from '../../shell/nav'
import { TOKEN_KEYS } from '../../theme/tokens'
import { readInitialTheme, ThemeProvider, useTheme } from '../../theme/ThemeProvider'
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
    expect(tabs.map((a) => a.getAttribute('data-sf-nav'))).toEqual(SHELL_NAV_ITEMS.map((i) => i.key))
  })

  it('顶栏与底栏「分家」：底栏=nav 五项（含 home）· 桌面左 nav=Header menuItems 三项（各自独立断言）', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: '1', EVM: '0xabcdef1234' }, logout: vi.fn() })
    const { container } = renderShell()
    // ① 底栏（shell/nav.js 真源）：五项 href（含显式 home tab）
    const tabHrefs = Array.from(container.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => a.getAttribute('href'))
    expect(tabHrefs).toEqual(['/', '/exchange', '/item/new', '/messages', '/profile'])
    expect(tabHrefs).toEqual(SHELL_NAV_ITEMS.map((i) => navPathInLang(i, 'zh')))
    // ② 桌面左 nav + 右侧控件簇（Header.jsx · menuItems 现状值一字不动；home 由品牌 logo 承担）。
    //    sf14 前推（2026-10-14 单）：右上角新增「订单」按钮复用 nav-link 控件类 ⇒ href 集合 +'/profile'。
    const topHrefs = Array.from(container.querySelectorAll('.nav-link[href]')).map((a) => a.getAttribute('href'))
    expect(topHrefs).toEqual(['/task', '/exchange', '/profile'])
    const brandHref = container.querySelector('[data-sf-region="topnav"] a[href="/"]')
    expect(brandHref).not.toBeNull()
  })

  it('底栏恒 5 格（含未登录；/profile 保护由路由层 ProtectedRoute 承担 —— 2026-10-19 缺陷单改锚）', () => {
    // 前版曾断言「未登录不含 profile」（visibleNavItems 过滤已废）⇒ 现口径：key 集恒 5。
    expect(SHELL_NAV_ITEMS.map((i) => i.key)).toEqual(['home', 'shard', 'sell', 'messages', 'profile'])
    useAuth.mockReturnValue({ isAuthenticated: true, user: { uID: '1', EVM: '0xabcdef1234' }, logout: vi.fn() })
    const { container } = renderShell()
    const tabs = Array.from(container.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => a.getAttribute('data-sf-nav'))
    expect(tabs).toEqual(['home', 'shard', 'sell', 'messages', 'profile'])
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

  it('语言前缀与激活判定复用 utils（/en/exchange、/hk/item/new 均命中）', () => {
    expect(navPathInLang(SHELL_NAV_ITEMS[1], 'zh')).toBe('/exchange')
    expect(navPathInLang(SHELL_NAV_ITEMS[1], 'en')).toBe('/en/exchange')
    expect(isNavItemActive('/en/exchange', SHELL_NAV_ITEMS[1])).toBe(true)
    expect(isNavItemActive('/hk/item/new', SHELL_NAV_ITEMS[2])).toBe(true)
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

  it('四语 locale 文件可解析、键集合相同、siteTitle 为品牌名（P9① 拆键后）', () => {
    const langs = ['zh', 'en', 'hk', 'vn']
    const tables = langs.map((l) => JSON.parse(read(path.join(SRC, `locales/${l}.json`))))
    const keys = tables.map((t) => Object.keys(t).sort())
    for (let i = 1; i < keys.length; i += 1) expect(keys[i]).toEqual(keys[0])
    // P9①（R-9-13-3）：`siteTitle` 拆键后**仅品牌名**（标语拆到新键 `siteSlogan`）；四语品牌名逐字冻结。
    expect(tables[0].siteTitle).toBe('Seafood 海鲜市场')
    for (const t of tables) {
      expect(typeof t.siteTitle).toBe('string')
      expect(t.siteTitle.startsWith('Seafood')).toBe(true)
    }
    // P9①：标语键 `siteSlogan` 四语齐。Kevin 2026-10-22 裁定：`siteSlogan` 统一为粤语品牌口号
    // （四语逐字同值「攞人工，做條鹹魚，放閒嘢，搏佢翻身！」），顶栏品牌位品牌名下加一行小字
    // （Header.jsx `t('siteSlogan')`）；P9① 时代「按语种分值」（zh「加密人自己的「闲鱼」」等）口径退役。
    // `document.title` 组合真源不变（品牌名｜标语 ⇒ 现组合为「品牌｜粤语口号」，四语同串）。
    expect(tables[0].siteSlogan).toBe('攞人工，做條鹹魚，放閒嘢，搏佢翻身！')
    // 四语逐字一致（新口径硬断言；键集相等另行断言，故此处只需断值同）
    expect(new Set(tables.map((t) => t.siteSlogan)).size).toBe(1)
    for (const t of tables) expect(typeof t.siteSlogan).toBe('string')
    // 启动前回退标题（index.html）= **中性占位**；前台运行时真源（DocumentTitle）= 品牌名｜标语（覆盖值 > locale）。
    const html = read(path.join(SRC, '../index.html'))
    expect(html).toContain('<title>Seafood</title>')
    const app = read(path.join(SRC, 'App.jsx'))
    expect(app).toContain("t('siteTitle')")
    expect(app).toContain("t('siteSlogan')")
    expect(app).toContain('document.title =')
    expect(() => read(path.join(REPO_ROOT, 'docs/design/style-preview.html'))).not.toThrow()
  })
})

describe('主题 · 首次访问跟随系统（index.html 内联判定 + 初次应用不落盘 · 2026-10-12 单）', () => {
  const ATTR = 'data-theme'
  let savedAttr = null

  // 环境复位：attr=null ⇒ 移除属性（模拟「无 index.html 预置」）；stored=null ⇒ 无显式存储（首访态）。
  // 注：setup.js 已把 global.localStorage 换成 vi.fn() 替身（getItem 恒 undefined）——
  // 这里给替身装 Map 后端实现来模拟真实语义（无键 ⇒ null），afterEach 再 mockReset 还原默认替身。
  const store = new Map()
  const installLsMock = () => {
    window.localStorage.getItem.mockImplementation((k) => (store.has(k) ? store.get(k) : null))
    window.localStorage.setItem.mockImplementation((k, v) => { store.set(k, String(v)) })
    window.localStorage.removeItem.mockImplementation((k) => { store.delete(k) })
    window.localStorage.clear.mockImplementation(() => { store.clear() })
  }
  const resetEnv = ({ attr = null, stored = null } = {}) => {
    installLsMock()
    store.clear()
    if (attr === null) document.documentElement.removeAttribute(ATTR)
    else document.documentElement.setAttribute(ATTR, attr)
    if (stored !== null) window.localStorage.setItem('theme', stored)
  }

  const Probe = () => {
    const { theme, toggleTheme, setTheme } = useTheme()
    return (
      <>
        <button type="button" data-testid="probe-theme">{theme}</button>
        <button type="button" data-testid="probe-toggle" onClick={toggleTheme}>toggle</button>
        <button type="button" data-testid="probe-set-day" onClick={() => setTheme('day')}>day</button>
        <button type="button" data-testid="probe-set-bogus" onClick={() => setTheme('sepia')}>bogus</button>
      </>
    )
  }

  const mountProvider = () =>
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

  beforeEach(() => {
    savedAttr = document.documentElement.getAttribute(ATTR)
  })

  afterEach(() => {
    cleanup()
    if (savedAttr === null) document.documentElement.removeAttribute(ATTR)
    else document.documentElement.setAttribute(ATTR, savedAttr)
    for (const m of ['getItem', 'setItem', 'removeItem', 'clear']) window.localStorage[m].mockReset()
    store.clear()
  })

  it('① 无存储 + html 已被置 data-theme="dark"（模拟 index.html 跟随系统）⇒ readInitialTheme() = night', () => {
    resetEnv({ attr: 'dark', stored: null })
    expect(window.localStorage.getItem('theme')).toBeNull()
    expect(readInitialTheme()).toBe('night')
  })

  it('② 无存储 + 无属性 ⇒ readInitialTheme() = day（拿不到系统偏好仍是日档，DEFAULT_THEME 不变）', () => {
    resetEnv({ attr: null, stored: null })
    expect(readInitialTheme()).toBe('day')
  })

  it('③ 有存储 ⇒ 存储决定档位（dark ⇒ night / light ⇒ day，各一）', () => {
    resetEnv({ attr: null, stored: 'dark' })
    expect(readInitialTheme()).toBe('night')
    resetEnv({ attr: null, stored: 'light' })
    expect(readInitialTheme()).toBe('day')
  })

  it('④ 初次渲染只设 data-theme、不写 localStorage["theme"]（跟随系统不得首帧变粘）', () => {
    resetEnv({ attr: 'dark', stored: null })
    const view = mountProvider()
    // 状态从属性吃进来（readInitialTheme 的 fromAttr 优先）
    expect(view.container.querySelector('[data-testid="probe-theme"]').textContent).toBe('night')
    // 初次应用（effect 跑过）后：属性保持，存储仍为 null
    expect(document.documentElement.getAttribute(ATTR)).toBe('dark')
    expect(window.localStorage.getItem('theme')).toBeNull()
  })

  it('⑤ toggleTheme() ⇒ 落盘且值正确（day → night ⇒ theme=dark，attr 同步）', () => {
    resetEnv({ attr: 'light', stored: null })
    const view = mountProvider()
    expect(view.container.querySelector('[data-testid="probe-theme"]').textContent).toBe('day')
    fireEvent.click(view.container.querySelector('[data-testid="probe-toggle"]'))
    expect(view.container.querySelector('[data-testid="probe-theme"]').textContent).toBe('night')
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.getAttribute(ATTR)).toBe('dark')
  })

  it('⑥ setTheme("day") 显式落盘（attr 值 light）；非法值（sepia）不落盘不改档', () => {
    resetEnv({ attr: 'dark', stored: null })
    const view = mountProvider()
    expect(view.container.querySelector('[data-testid="probe-theme"]').textContent).toBe('night')
    fireEvent.click(view.container.querySelector('[data-testid="probe-set-day"]'))
    expect(view.container.querySelector('[data-testid="probe-theme"]').textContent).toBe('day')
    expect(window.localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.getAttribute(ATTR)).toBe('light')
    fireEvent.click(view.container.querySelector('[data-testid="probe-set-bogus"]'))
    expect(window.localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.getAttribute(ATTR)).toBe('light')
  })
})
