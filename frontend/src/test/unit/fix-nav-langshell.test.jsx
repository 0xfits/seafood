/**
 * FIX-NAV 单测（本单新增）—— 钉两个生产缺陷的**回归契约**
 *
 * F1（语言前缀登录页空壳）：`/en|/hk|/vn/login` 曾渲染 Header/Footer + `<main>` 0 字节。
 *   根因 = 登录/注册路由声明在 `LangShell` **之外**的顶层 `App` 路由里（绝对路径 `/login`），
 *   带语言前缀的地址落到 `/*` 壳的内层却无匹配 ⇒ 空壳。契约：**四档登录地址都渲染登录内容**。
 *
 * F2（卡片链接 `/undefined/item/item/<id>`）：
 *   根因 = 页面内 `buildLangPath(location.pathname, undefined)` 把**字符串 `undefined`** 当作语言段，
 *   且返回值是「整条路径」而非「语言前缀」⇒ 前缀位 + 重复路径段。
 *   契约：站内链接的**唯一构造器** `buildLocalizedPath(lang, path)`；
 *   **判负用例**：语言缺失/非法时输出**不得**出现 `undefined`，也不得出现重复路径段。
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildLangPath,
  buildLocalizedPath,
  langPathPrefix,
  SUPPORTED_LANGS,
} from '../../utils'

// t 必须是**模块级稳定函数**：页面用 `useCallback(..., [t])`，mock 每次返回新闭包会无限重渲染
const stableT = (key) => key
const stableI18n = { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' }

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT, i18n: stableI18n }),
}))

vi.mock('../../components/Header', () => ({ default: () => <div>site header</div> }))
vi.mock('../../components/Footer', () => ({ default: () => <div>site footer</div> }))
vi.mock('../../components/LoginModal', () => ({ default: () => null }))
vi.mock('../../components/layout/AdminLayout', () => ({ default: () => <div>admin layout</div> }))
vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(),
  hasAdminPermission: vi.fn(() => false),
}))
vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: false, user: null })),
}))
// 顶层路由的其它页面替身（本单只钉登录/注册归属）
vi.mock('../../pages/TaskPage', () => ({ default: () => <div>task page content</div> }))
vi.mock('../../pages/ProfilePage', () => ({ default: () => <div>profile page content</div> }))
vi.mock('../../pages/DashboardPage', () => ({ default: () => <div>dashboard page content</div> }))
vi.mock('../../pages/ShardPage', () => ({ default: () => <div>shard page content</div> }))
// AuthPage 替身：把 `mode` 渲染出来即可（本单钉的是**路由归属**，不是登录表单本身）
vi.mock('../../pages/AuthPage', () => ({
  default: ({ mode }) => <div>{`${mode} auth page`}</div>,
}))

// ★ S1（2026-10-17）：`auth.js` 新增具名导出（`SESSION_EXPIRED_EVENT` / `markProtectedRouteActive` /
//   `isProtectedRouteActive` / `isUnauthorizedError` …），而本文件是**白名单式** mock ⇒ 漏一个即在渲染期
//   抛「No X export is defined on the ../../auth mock」。改为「展开 actual + 只覆盖本单要 stub 的两个出口」
//   ⇒ 后续 auth 再加导出不会再把本文件判红（断言语义不变：`fetchApiJson` / `getAuthHeaders` 仍是替身）。
vi.mock('../../auth', async () => {
  const actual = await vi.importActual('../../auth')
  return {
    ...actual,
    fetchApiJson: vi.fn(async () => ({})),
    getAuthHeaders: vi.fn(() => ({})),
  }
})
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import App from '../../App'
import HomePage from '../../pages/HomePage'

const EMPTY = { v7_startTransition: true, v7_relativeSplatPath: true }
const inRouter = (node, entry) => render(<MemoryRouter initialEntries={[entry]} future={EMPTY}>{node}</MemoryRouter>)

afterEach(() => cleanup())

// ============================================================================
// ① 链接构造器契约（F2）
// ============================================================================
describe('F2 · buildLocalizedPath 站内链接构造器契约', () => {
  it('zh = 无前缀口径（原样返回站内路径）', () => {
    expect(buildLocalizedPath('zh', '/item/5')).toBe('/item/5')
    expect(buildLocalizedPath('zh', '/')).toBe('/')
    expect(buildLocalizedPath('zh', 'item/5')).toBe('/item/5')
  })

  it('四语白名单逐档给对前缀，且无重复路径段', () => {
    expect(buildLocalizedPath('en', '/item/5')).toBe('/en/item/5')
    expect(buildLocalizedPath('hk', '/item/5')).toBe('/hk/item/5')
    expect(buildLocalizedPath('vn', '/item/5')).toBe('/vn/item/5')
    for (const lang of SUPPORTED_LANGS) {
      const href = buildLocalizedPath(lang, '/item/5')
      expect(href).not.toContain('//')
      expect(href.match(/\/item\//g).length).toBe(1) // 重复段判负
    }
  })

  it('★ 判负：语言缺失 / 非法 ⇒ 输出不得出现 `undefined`（F2 事故原形 /undefined/item/item/5）', () => {
    for (const bad of [undefined, null, '', 'xx', 'ZH', 0]) {
      const href = buildLocalizedPath(bad, '/item/5')
      expect(String(href), `lang=${String(bad)}`).not.toContain('undefined')
      expect(href).toBe('/item/5')
    }
    // 语言根同理
    expect(buildLocalizedPath(undefined, '/')).toBe('/')
  })

  it('langPathPrefix：zh ⇒ 空前缀；白名单语言 ⇒ `/<lang>`；非法 ⇒ zh 口径（不产 undefined）', () => {
    expect(langPathPrefix('zh')).toBe('')
    expect(langPathPrefix('en')).toBe('/en')
    expect(langPathPrefix('hk')).toBe('/hk')
    expect(langPathPrefix('vn')).toBe('/vn')
    for (const bad of [undefined, null, 'xx']) expect(langPathPrefix(bad)).toBe('')
  })

  it('buildLangPath 兜底：非法目标语言不再拼出 `/undefined/...`（旧实现的原形）', () => {
    expect(buildLangPath('/item', undefined)).toBe('/item')
    expect(buildLangPath('/item', 'xx')).toBe('/item')
    expect(buildLangPath('/item', 'en')).toBe('/en/item') // 合法目标语言行为不变
    expect(buildLangPath('/vn/item', 'hk')).toBe('/hk/item')
  })
})

// ② F2 页面接线：首页站内链接语言前缀形态（真渲染 HomePage；列表已并入首页）
//    ★ 2026-10-24（Kevin）：首页 hero 版块整块删除 ⇒ 发布入口 `/item/new` **不再从 UI 给出**
//      （`home-publish-link` 钩子随之消失）。断言覆盖面不削弱、只换锚：
//      ① 首页**零** `home-publish-link`（入口确已下线，不留隐藏链接 / 不留 `/item/new` 链接）；
//      ② 语言前缀改由仍在页内的「查看全部 → `/campaign`」继续验（四档逐条）。
// ============================================================================
describe('F2 · 首页站内链接语言前缀（真渲染 HomePage）', () => {
  const viewAllHref = () => [...document.querySelectorAll('a')]
    .find((a) => (a.textContent || '').trim() === 'common.viewAll')?.getAttribute('href')
  const renderHome = (entry) => render(<MemoryRouter initialEntries={[entry]} future={EMPTY}><HomePage /></MemoryRouter>)

  beforeEach(() => { cleanup() })

  //   ★ 口径：本 describe **只渲染 HomePage**（Header / Footer / 壳层均已 mock）⇒ 断的是「首页自身」
  //     不再给发布入口；壳层（底栏「卖闲置」/ 浮层菜单）的既有 `/item/new` 属全局导航，不在本单范围、未动。
  it('首页零发布入口：`home-publish-link` 不存在，且本页无 `/item/new` 链接', async () => {
    renderHome('/en')
    await screen.findByText('common.viewAll')
    expect(document.querySelector('[data-sf-m="home-publish-link"]')).toBeNull()
    expect(screen.queryByText('item.publish')).toBeNull()
    const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '')
    expect(hrefs.some((href) => href.includes('/item/new'))).toBe(false)
  })

  it('en 档：查看全部 href = `/en/campaign`（无 undefined、无重复段）', async () => {
    renderHome('/en')
    await screen.findByText('common.viewAll')
    expect(viewAllHref()).toBe('/en/campaign')
    expect(viewAllHref()).not.toContain('undefined')
    expect(viewAllHref().match(/\/campaign/g).length).toBe(1)
  })

  it('zh 档（无前缀）⇒ `/campaign`；hk/vn 档各带自身前缀', async () => {
    renderHome('/')
    await screen.findByText('common.viewAll')
    expect(viewAllHref()).toBe('/campaign')
    cleanup()

    renderHome('/hk')
    await screen.findByText('common.viewAll')
    expect(viewAllHref()).toBe('/hk/campaign')
    cleanup()

    renderHome('/vn')
    await screen.findByText('common.viewAll')
    expect(viewAllHref()).toBe('/vn/campaign')
  })

  it('同族链接一并纠正：前缀位不含 `undefined`，且无重复路径段', async () => {
    renderHome('/en')
    await screen.findByText('common.viewAll')
    const href = viewAllHref()
    expect(href).not.toContain('undefined')
    expect(href).not.toContain('//')
    expect(href.match(/\/campaign/g).length).toBe(1)
    // 全页站内链接同口径（不再只验单条）
    for (const a of [...document.querySelectorAll('a')]) {
      const h = a.getAttribute('href') || ''
      expect(h, h).not.toContain('undefined')
    }
  })
})

// ============================================================================
// ============================================================================
// ③ F1 路由归属：四档登录/注册地址都渲染登录内容（不再空壳）
// ============================================================================
describe('F1 · 语言前缀登录路由（LangShell 管辖）', () => {
  beforeEach(() => { cleanup() })

  it('四档登录地址 /login /en/login /hk/login /vn/login 均渲染登录内容', () => {
    for (const entry of ['/login', '/en/login', '/hk/login', '/vn/login']) {
      cleanup()
      inRouter(<App />, entry)
      expect(screen.getByText('login auth page'), `entry=${entry}`).toBeInTheDocument()
      // 语言前缀档同样挂在外壳内（归属 LangShell，与其它页面一致）
      expect(document.querySelector('main')).not.toBeNull()
      expect(document.querySelector('main').innerHTML.length, `entry=${entry} main 空壳`).toBeGreaterThan(0)
    }
  })

  it('四档注册地址 /register /en/register /hk/register /vn/register 均渲染注册内容', () => {
    for (const entry of ['/register', '/en/register', '/hk/register', '/vn/register']) {
      cleanup()
      inRouter(<App />, entry)
      expect(screen.getByText('register auth page'), `entry=${entry}`).toBeInTheDocument()
    }
  })

  it('登录/注册不再由顶层绝对路径路由专属：源码里不得出现顶层 `<Route path="/login"`', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const appSrc = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../App.jsx'),
      'utf8',
    )
    expect(appSrc).not.toContain('<Route path="/login"')
    expect(appSrc).not.toContain('<Route path="/register"')
    expect(appSrc).toContain('<Route path="login" element={<AuthPage mode="login" />} />')
    expect(appSrc).toContain('<Route path="register" element={<AuthPage mode="register" />} />')
  })
})

// ============================================================================
// ④ 静态不变量：全仓不得再用「undefined 当语言段」的旧构造（同族清零）
// ============================================================================
describe('F2 · 静态不变量：`buildLangPath(<path>, undefined)` 同族构造已清零', () => {
  it('src 下不再出现 `buildLangPath(location.pathname, undefined)`', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const hits = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(abs); continue }
        if (!/\.(js|jsx)$/.test(entry.name)) continue
        if (abs.includes(`${path.sep}test${path.sep}`)) continue // 测试自身文本不算存量
        const raw = fs.readFileSync(abs, 'utf8')
        // 去注释后再扫：本单的修复注释里会**引用**旧写法，注释不是代码
        const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '')
        if (/buildLangPath\([^)]*,\s*undefined\s*\)/.test(text)) hits.push(path.relative(root, abs))
      }
    }
    walk(root)
    expect(hits).toEqual([])
  })
})
