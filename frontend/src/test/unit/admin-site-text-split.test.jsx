/**
 * 站点文案页**拆解**（Kevin 2026-10-24 批次 A · `route-layer.spec` v2.53 §49.26）
 *
 * 契约（本文件逐条钉死）：
 *  A. 四块**搬家**（写口 / 幂等键 / 字段名 / 默认值原样，**不改口径**）：
 *     ① `invite_reward_policy` ⇒ `/dashboard/points`（闸 `manage_points`）
 *     ② `rating_policy`        ⇒ `/dashboard/users`（写闸 `manage_settings` = 写口同键）
 *     ③ `mint_burn_policy`     ⇒ **新页** `/dashboard/power`（「电量」· 闸 `manage_settings`）
 *     ④ 角色文案（`role_names`）+ 站点文案（`site_text_overrides`）⇒ `/dashboard/settings`
 *  B. 两组合约默认值组**删除**：`batt_policy`（任务电量）/ `checkin_policy`（签到）
 *     ⇒ 生产 src 面零残留；**四语 i18n 键保留不删**（只登记孤儿 `adminSiteText.policyBatt` / `policyCheckin` 及其字段标签）。
 *  C. `/dashboard/site-text` 页**下线**：页面文件 / 路由 / 侧栏三项零残留；旧地址 `<Navigate replace>` ⇒ `/dashboard/settings`；
 *     侧栏该项**原位**换成【电量】`/dashboard/power`（不做重排 = 批次 B 的事）。
 *  D. 品牌行：`Seafood Admin`（原硬编码 `Jinli Admin`）＝ **一个 `<Link>` 包整段** → 首页且**带语言前缀**；
 *     `aria-label` = 品牌名 + 返回首页；hover = T130 第③类（只变色、不位移）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CALLS = vi.hoisted(() => [])
const LANG = vi.hoisted(() => ({ current: 'zh' }))
const ACCESS = vi.hoisted(() => ({ current: { is_admin: true, can_access_admin: true, permissions: [] } }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && opts.message ? `${key}|${opts.message}` : key),
    i18n: { changeLanguage: vi.fn(), language: 'zh', resolvedLanguage: 'zh' },
  }),
}))

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

// 语言前缀必须**按 location 现取**（判据 D）⇒ 只覆盖取语言这一步，其余工具函数保留真实现
vi.mock('../../utils', async () => {
  const actual = await vi.importActual('../../utils')
  return { ...actual, getLanguageFromUrl: () => LANG.current }
})

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ACCESS.current),
  fetchApiJson: vi.fn(async (url, opts = {}) => {
    CALLS.push({ url: String(url), opts })
    if (String(url) === '/api/admin/settings' && !opts.method) return { siteName: 'Seafood Club' }
    if (String(url) === '/api/admin/settings' && opts.method === 'POST') return { success: true }
    return {}
  }),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer t' })),
  getStoredUser: vi.fn(() => ({ uID: 7, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: (access, permission) => {
    if (!access) return false
    if (access.is_admin) return true
    if (!permission) return Boolean(access.can_access_admin)
    if (Array.isArray(permission)) return permission.some((p) => (access.permissions || []).includes(p))
    return (access.permissions || []).includes(permission)
  },
  loadAdminUsersWithAssets: vi.fn(async () => ({
    users: [],
    stats: { userCount: 0, totalPoints: 0, avgPoints: 0, zeroPoints: 0, adminCount: 0, assetCount: 0 },
  })),
}))

// 覆盖层读口打桩（真实实现 fail-closed 回落 locale 基值；此处只要确定性）
vi.mock('../../site-text-overlay', async () => {
  const actual = await vi.importActual('../../site-text-overlay')
  return { ...actual, fetchSiteTextOverlay: vi.fn(async () => ({ role_names: null, site_text_overrides: null })) }
})

import AdminLayout from '../../components/layout/AdminLayout'
import PointsManagement from '../../pages/admin/PointsManagement'
import UsersManagement from '../../pages/admin/UsersManagement'
import SystemSettings from '../../pages/admin/SystemSettings'
import PowerPage from '../../pages/admin/PowerPage'
import zh from '../../locales/zh.json'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(SRC, p))

/** 生产代码面（排除 test 目录与 locales：键名只在 locales 里合法存在）。 */
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'test' || e.name === 'locales') continue
      walk(abs, out)
    } else if (/\.(js|jsx)$/.test(e.name)) out.push(abs)
  }
  return out
}
const prodText = () => walk(SRC).map((abs) => ({ rel: path.relative(SRC, abs), text: fs.readFileSync(abs, 'utf8') }))
const hitsOf = (needle) => prodText().filter((f) => f.text.includes(needle)).map((f) => f.rel)

const wrap = (node, entry = '/dashboard/points') =>
  render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>)

beforeEach(() => {
  CALLS.length = 0
  LANG.current = 'zh'
  ACCESS.current = { is_admin: true, can_access_admin: true, permissions: [] }
})

// ─────────────────────────────────────────────────────── A 零残留（页面 / 路由 / 侧栏 / 字面）
describe('A · `/dashboard/site-text` 下线：页面 / 路由 / 侧栏 / 字面 四处零残留', () => {
  it('① 页面文件已删除，新页与本轮三个接管页在场', () => {
    expect(exists('pages/admin/SiteTextPage.jsx')).toBe(false)
    for (const p of [
      'pages/admin/PowerPage.jsx',
      'pages/admin/PolicyGroupCard.jsx',
      'pages/admin/AdminOverlayCards.jsx',
      'pages/admin/PointsManagement.jsx',
      'pages/admin/UsersManagement.jsx',
      'pages/admin/SystemSettings.jsx',
    ]) expect(exists(p), p).toBe(true)
  })

  it('② App.jsx：组件名 / import / 受闸路由零残留；旧地址恰一条 `<Navigate replace>` ⇒ settings', () => {
    const app = read('App.jsx')
    expect(app).not.toContain('SiteTextPage')
    expect(app).not.toMatch(/<Route path="site-text" element=\{<ProtectedRoute/)
    expect(app).toContain('<Route path="site-text" element={<Navigate to="/dashboard/settings" replace />} />')
    // 新页 = 受闸路由（manage_settings）
    expect(app).toContain(
      '<Route path="power" element={<ProtectedRoute adminOnly={true} requiredPermission="manage_settings"><PowerPage /></ProtectedRoute>} />'
    )
    expect(app).toContain("import PowerPage from './pages/admin/PowerPage'")
  })

  it('③ 侧栏：站点文案项零残留；【电量】项在场且仅一项、闸 = manage_settings', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).not.toContain('/dashboard/site-text')
    expect(layout).not.toContain("t('adminNav.siteText')")
    expect(layout).not.toContain("t('adminNav.siteTextDesc')")
    expect(layout.match(/path: '\/dashboard\/power',/g)).toHaveLength(1)
    expect(layout).toContain("title: t('battCard.title')")
    expect(layout).toContain("description: t('adminSiteText.policyMintBurn')")
  })

  it('④ 全 src（排除 test / locales）无 `/dashboard/site-text` 字面 · 无 `Jinli Admin` · 无 `SiteTextPage`', () => {
    expect(hitsOf('/dashboard/site-text')).toEqual([])
    expect(hitsOf('Jinli Admin')).toEqual([])
    expect(hitsOf('SiteTextPage')).toEqual([])
  })
})

// ─────────────────────────────────────────────────────── B 删两组（任务电量 / 签到）
describe('B · `batt_policy` / `checkin_policy` 两组删除：生产面零残留 · 四语键保留', () => {
  it('① 生产 src 面：两组组名零命中；9 个字段名**只在公开读口消费面**出现（管理面零命中）', () => {
    for (const needle of ['batt_policy', 'checkin_policy']) {
      expect(hitsOf(needle), needle).toEqual([])
    }
    // 字段名两部分：
    //  · 「只活在设置写侧」的 4 个 ⇒ 全 src 零命中；
    for (const needle of ['taskCostBatt', 'baseRewardBatt', 'streakDay7RewardBatt', 'makeupDailyLimit']) {
      expect(hitsOf(needle), needle).toEqual([])
    }
    //  · 另外 5 个同时是**公开读口** `GET /api/batt` / `GET /api/checkin` 的响应字段名
    //    （`batt-checkin.js` 注释 + 电量额度条 `WageMintEntry` 消费 `capBatt`）⇒ 只许这两处，
    //    且**任何管理页 / 策略卡**不得再出现（这才是本单的零残留判据）。
    const ALLOWED = new Set(['batt-checkin.js', 'pages/wage/WageMintEntry.jsx'])
    for (const needle of ['capBatt', 'floorBatt', 'acceptThresholdBatt', 'streakCapDays', 'makeupCostUsd']) {
      expect(hitsOf(needle).filter((f) => !ALLOWED.has(f)), needle).toEqual([])
    }
    // 管理面（后台页 + 策略卡 + 覆盖层卡）零命中：逐个文件读现取
    const adminFiles = walk(path.join(SRC, 'pages/admin')).concat([path.join(SRC, 'components/layout/AdminLayout.jsx')])
    for (const abs of adminFiles) {
      const text = fs.readFileSync(abs, 'utf8')
      for (const needle of [
        'batt_policy', 'checkin_policy', 'taskCostBatt', 'capBatt', 'floorBatt', 'acceptThresholdBatt',
        'baseRewardBatt', 'streakCapDays', 'streakDay7RewardBatt', 'makeupCostUsd', 'makeupDailyLimit',
      ]) {
        expect(text, `${path.relative(SRC, abs)}|${needle}`).not.toContain(needle)
      }
    }
  })

  it('② 四语 i18n 键**保留不删**（孤儿登记：`policyBatt` / `policyCheckin` 及其字段标签）', () => {
    const tables = Object.fromEntries(
      ['zh', 'en', 'hk', 'vn'].map((l) => [l, JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))])
    )
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      for (const key of [
        'policyBatt', 'policyCheckin', 'taskCostBatt', 'capBatt', 'floorBatt', 'acceptThresholdBatt',
        'baseRewardBatt', 'streakCapDays', 'streakDay7RewardBatt', 'makeupCostUsd', 'makeupDailyLimit',
      ]) {
        expect(typeof tables[lang].adminSiteText[key], `${lang}.${key}`).toBe('string')
        expect(tables[lang].adminSiteText[key].length, `${lang}.${key}`).toBeGreaterThan(0)
      }
    }
    expect(zh.adminSiteText.policyBatt).toBe('任务电量')
    expect(zh.adminSiteText.policyCheckin).toBe('签到')
  })
})

// ─────────────────────────────────────────────────────── C 四块搬家（运行时逐页现身）
describe('C · 四块搬家：控件落在各自页（且旧两组在任何页都不再出现）', () => {
  it('① 积分页：邀请奖励（3 字段）在场', async () => {
    wrap(<PointsManagement />)
    expect(await screen.findByText('adminSiteText.policyInvite')).toBeInTheDocument()
    for (const field of ['signupBatt', 'firstTaskUsd', 'rewardLevels']) {
      expect(
        await screen.findByLabelText(`adminSiteText.${field}`),
        field
      ).toBeInTheDocument()
    }
    expect(screen.queryByText('adminSiteText.policyBatt')).toBeNull()
    expect(screen.queryByText('adminSiteText.policyCheckin')).toBeNull()
  })

  it('② 用户页：评分（3 字段）在场', async () => {
    wrap(<UsersManagement />)
    expect(await screen.findByText('adminSiteText.policyRating')).toBeInTheDocument()
    for (const field of ['storageDecimals', 'displayDecimals', 'defaultStars']) {
      expect(await screen.findByLabelText(`adminSiteText.${field}`), field).toBeInTheDocument()
    }
    expect(screen.queryByText('adminSiteText.policyBatt')).toBeNull()
  })

  it('③ 电量页（新）：标题 `battCard.title` + 铸造与销毁 5 字段', async () => {
    wrap(<PowerPage />, '/dashboard/power')
    expect(await screen.findByRole('heading', { name: 'battCard.title' })).toBeInTheDocument()
    expect(screen.getByText('adminSiteText.policyMintBurn')).toBeInTheDocument()
    for (const field of ['mintBattCost', 'mintFeeUsd', 'burnBttcCost', 'burnFeeUsd', 'burnBattGain']) {
      expect(await screen.findByLabelText(`adminSiteText.${field}`), field).toBeInTheDocument()
    }
    expect(screen.queryByText('adminSiteText.policyBatt')).toBeNull()
    expect(screen.queryByText('adminSiteText.policyCheckin')).toBeNull()
  })

  it('④ 设置页：角色文案（4 角色 × 4 语）+ 站点文案（3 键 × 4 语）在场', async () => {
    wrap(<SystemSettings />, '/dashboard/settings')
    expect(await screen.findByText('adminRoleNames.title')).toBeInTheDocument()
    expect(screen.getByText('adminSiteText.sectionSite')).toBeInTheDocument()
    // 角色行标签（td 文案 = `roleNames.<role>` 回填值）与 4 语输入
    for (const role of ['poster', 'worker', 'seller', 'buyer']) {
      expect(screen.getAllByText(`roleNames.${role}`).length).toBeGreaterThanOrEqual(1)
    }
    for (const key of ['siteTitle', 'siteSlogan', 'slogan']) {
      for (const lang of ['zh', 'en', 'hk', 'vn']) {
        expect(document.querySelector(`[data-sf-m="admin-site-text-${key}-${lang}"]`), `${key}-${lang}`).not.toBeNull()
      }
    }
    for (const role of ['poster', 'worker', 'seller', 'buyer']) {
      for (const lang of ['zh', 'en', 'hk', 'vn']) {
        expect(document.querySelector(`[data-sf-m="admin-role-name-${role}-${lang}"]`), `${role}-${lang}`).not.toBeNull()
      }
    }
    // 基本设置（siteName）未被回退
    expect(document.querySelector('[data-sf-m="admin-setting-site-name"]')).not.toBeNull()
    expect(screen.queryByText('adminSiteText.policyBatt')).toBeNull()
    expect(screen.queryByText('adminSiteText.policyCheckin')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────── D 写口口径（形态 B + ops 幂等键）
describe('D · 写口口径原样搬运：`POST /api/admin/settings` 形态 B + `ops:` 幂等键', () => {
  it('电量页保存 ⇒ body 恰 `{ key, value, create_key }`，key = mint_burn_policy，value 5 数值键', async () => {
    wrap(<PowerPage />, '/dashboard/power')
    const save = await screen.findByRole('button', { name: 'adminSiteText.saveNumbers' })
    fireEvent.click(save)

    await waitFor(() => expect(CALLS.some((c) => c.opts?.method === 'POST')).toBe(true))
    const post = CALLS.find((c) => c.opts?.method === 'POST')
    expect(post.url).toBe('/api/admin/settings')
    const body = JSON.parse(post.opts.body)
    expect(Object.keys(body).sort()).toEqual(['create_key', 'key', 'value'])
    expect(body.key).toBe('mint_burn_policy')
    expect(Object.keys(body.value).sort()).toEqual(
      ['burnBattGain', 'burnBttcCost', 'burnFeeUsd', 'mintBattCost', 'mintFeeUsd'].sort()
    )
    for (const v of Object.values(body.value)) expect(typeof v).toBe('number')
    expect(body.create_key).toBe('ops:7:setting:mint_burn_policy')
  })

  it('源码面：三组 key 名逐字 + 卡片组件共用同一写口（零新增写出端点）', () => {
    const card = read('pages/admin/PolicyGroupCard.jsx')
    expect(card).toContain("key: 'invite_reward_policy'")
    expect(card).toContain("key: 'rating_policy'")
    expect(card).toContain("key: 'mint_burn_policy'")
    expect(card).toContain("fetchApiJson('/api/admin/settings'")
    expect(card).toContain("adminOpsKey(currentUser?.uID, 'setting', group.key)")
    // 三组落点：积分 / 用户 / 电量
    //  ★ F 项复核（2026-10-24）：积分页的控件闸由 `manage_points` 收窄为**写口同键** `manage_settings`
    //  （页面可见性仍 `manage_points`），见下方 F 组。
    expect(read('pages/admin/PointsManagement.jsx')).toContain(
      '<PolicyGroupCard group={POLICY_INVITE} canManage={canManageSettings} readOnlyNotice />'
    )
    expect(read('pages/admin/UsersManagement.jsx')).toContain('<PolicyGroupCard group={POLICY_RATING} canManage={canManageSettings} />')
    expect(read('pages/admin/PowerPage.jsx')).toContain('<PolicyGroupCard group={POLICY_MINT_BURN} canManage={canManage} />')
    // 设置页两块覆盖层
    expect(read('pages/admin/SystemSettings.jsx')).toContain('<RoleNamesCard canManage={canManageSettings} />')
    expect(read('pages/admin/SystemSettings.jsx')).toContain('<SiteTextCard canManage={canManageSettings} />')
  })
})

// ─────────────────────────────────────────────────────── E 品牌行 = 带语言前缀的首页链接
describe('E · 品牌行 `Seafood Admin`：整段链接 → 首页（带语言前缀）· aria-label · hover 只变色', () => {
  const brandHref = async () => {
    const res = wrap(<AdminLayout />, '/dashboard/users')
    const link = await waitFor(() => {
      const el = document.querySelector('[data-sf-m="admin-brand-link"]')
      expect(el).not.toBeNull()
      return el
    })
    return { link, res }
  }

  it('① 文案 = `Seafood Admin`（旧 `Jinli Admin` 零残留）且整段是一个 `<a>`', async () => {
    const { link } = await brandHref()
    expect(link.tagName).toBe('A')
    expect(link.textContent).toContain('Seafood Admin')
    expect(document.body.textContent).not.toContain('Jinli Admin')
    // 品牌行（h1 面板名 + p 品牌名）都在同一个链接内 ⇒ 不是「只有品牌名可点」
    expect(link.textContent).toContain('adminLayout.panelTitle')
    expect(link.querySelectorAll('a')).toHaveLength(0) // 不得嵌套链接
  })

  it('② href = 首页 + 当前语言前缀（zh ⇒ `/`；vn ⇒ `/vn`）', async () => {
    const { link, res } = await brandHref()
    expect(link.getAttribute('href')).toBe('/')
    res.unmount()

    LANG.current = 'vn'
    const { link: vnLink } = await brandHref()
    expect(vnLink.getAttribute('href')).toBe('/vn')
  })

  it('③ aria-label = 品牌名 + 返回首页；hover 按 T130 第③类（只变色 · 无位移类）', async () => {
    const { link } = await brandHref()
    expect(link.getAttribute('aria-label')).toBe('Seafood Admin — notFound.backHome')
    expect(link.className).toContain('transition-colors')
    for (const banned of ['translate-', 'scale-', 'hover:shadow', 'hover:-mt', 'hover:mt-', 'hover:-translate']) {
      expect(link.className, banned).not.toContain(banned)
    }
    // 变色落在子节点（h1 / p）上
    const source = read('components/layout/AdminLayout.jsx')
    expect(source).toContain('group-hover:text-blue-600')
    expect(source).toContain('group-hover:text-blue-500')
    expect(source).toContain("buildLocalizedPath(getLanguageFromUrl(location.pathname), '/')")
  })
})

// ─────────────────────────────────────────────────────── F 权限拆分（页面闸 vs 写口闸）
/**
 * 真缺陷（2026-10-24 · 批次 A 收口）：积分页「邀请奖励」卡的控件闸一度跟随**页面闸**
 * `manage_points`，而写口 `POST /api/admin/settings` 要 `manage_settings`
 * ⇒ 仅持 `manage_points` 的用户「可编辑但保存必 403」（假开）。
 * 现口径 = 与用户页「评分」卡同型：**卡可见**由页面闸决定，**控件启用**跟写口同键。
 */
describe('F · 积分页邀请奖励卡：可见性 = `manage_points` · 控件/保存 = `manage_settings`', () => {
  const cell = (field) => document.querySelector(`[data-sf-m="admin-policy-invite_reward_policy-${field}"]`)
  const FIELDS = ['signupBatt', 'firstTaskUsd', 'rewardLevels']
  const grantOnly = (permissions) => {
    ACCESS.current = { is_admin: false, can_access_admin: true, permissions }
  }

  it('① 仅 `manage_points`：卡**在场不隐藏**、3 个输入框 disabled、保存 disabled、恰一行只读提示', async () => {
    grantOnly(['manage_points'])
    wrap(<PointsManagement />)

    // 卡片（标题 + 三个字段标签）仍渲染
    expect(await screen.findByText('adminSiteText.policyInvite')).toBeInTheDocument()
    for (const field of FIELDS) {
      const input = cell(field)
      expect(input, field).not.toBeNull()
      expect(input.disabled, `${field} disabled`).toBe(true)
    }
    expect(screen.getByRole('button', { name: 'adminSiteText.saveNumbers' })).toBeDisabled()

    // 恰一行只读提示（复用既有键 `adminCommon.readOnlyNotice`，零新增键）
    const notices = screen.getAllByText('adminCommon.readOnlyNotice')
    expect(notices).toHaveLength(1)
    expect(notices[0].getAttribute('data-sf-m')).toBe('admin-policy-invite_reward_policy-readonly')
  })

  it('② 兼持 `manage_points` + `manage_settings`：3 个输入框可编辑、保存可点、无只读提示', async () => {
    grantOnly(['manage_points', 'manage_settings'])
    wrap(<PointsManagement />)

    expect(await screen.findByText('adminSiteText.policyInvite')).toBeInTheDocument()
    // 权限是挂载后才取回的 ⇒ 等控件真启用（不然断言落在 access 初值 `permissions: []` 上）
    await waitFor(() => expect(cell('signupBatt').disabled).toBe(false))
    for (const field of FIELDS) {
      const input = cell(field)
      expect(input, field).not.toBeNull()
      expect(input.disabled, `${field} editable`).toBe(false)
    }
    expect(screen.getByRole('button', { name: 'adminSiteText.saveNumbers' })).not.toBeDisabled()
    expect(screen.queryByText('adminCommon.readOnlyNotice')).toBeNull()
  })

  it('③ 仅 `manage_settings`（无 `manage_points`）：页面级只读提示仍在（页面闸未被放宽），卡片控件可编辑', async () => {
    // 两条闸各自独立：页面动作面（加减积分 / 页面只读提示）只认 `manage_points`；
    // 卡片控件只认写口键。此处验证「不为修卡片而放宽页面闸」。
    grantOnly(['manage_settings'])
    wrap(<PointsManagement />)
    expect(await screen.findByText('adminSiteText.policyInvite')).toBeInTheDocument()
    await waitFor(() => expect(cell('signupBatt').disabled).toBe(false))
    // 卡片内不出现只读提示；页面级 intro 仍挂只读文案（两处文案同键，靠钩子区分）
    expect(document.querySelector('[data-sf-m="admin-policy-invite_reward_policy-readonly"]')).toBeNull()
    expect(document.body.textContent).toContain('adminCommon.readOnlyNotice')
  })

  it('④ 源码面：页面闸与写口闸**两个权限键各自持有**，控件只吃 `manage_settings`', () => {
    const src = read('pages/admin/PointsManagement.jsx')
    expect(src).toContain("hasAdminPermission(access, 'manage_points')")
    expect(src).toContain("hasAdminPermission(access, 'manage_settings')")
    // 卡片只准吃写口键（不得回退成 `canManagePoints`）
    expect(src).toContain('canManage={canManageSettings}')
    expect(src).not.toContain('canManage={canManagePoints}')
    // 复用既有键，零新增 i18n：卡片里的只读提示只能出现这一个键
    const card = read('pages/admin/PolicyGroupCard.jsx')
    expect(card).toContain("t('adminCommon.readOnlyNotice')")
    expect(card).toContain('disabled={!canManage}')
  })
})

