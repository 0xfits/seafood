/**
 * 「基本设置」单字段面板 ＋「任务管理 / 碎片管理」两页下线（Kevin 2026-10-24 裁定 · 三轮中的第②轮）
 *
 * 契约（本文件逐条钉死）：
 *  A. `/dashboard/settings` = **基本设置**，**只保留 `siteName` 一个字段**：
 *     ① 读 `GET /api/admin/settings` 只取 `siteName`，页面**只渲出 1 个设置控件**；
 *     ② 保存 = `POST /api/admin/settings`，请求体**键集恰为 `['siteName']`**（不发其它 8 个字段、不发全量对象）；
 *        `ops:` 幂等键走 `Idempotency-Key` 头（后端 `resolveAdminOpsKey` 三处等价取值）⇒ 请求体才能保持单键；
 *        后端是**补丁合并**语义（`assertSystemSettingsPatch` 不补默认值）⇒ 单键不会清空其它键；
 *     ③ 闸仍 `manage_settings`（无权限 ⇒ 保存不可用）；
 *     ④ 8 个零消费方字段的 UI / state / 校验全删（i18n 键保留不删，登记孤儿）。
 *  B. 两页下线：`TasksManagement`（任务管理）/ `ShardsManagement`（碎片管理）
 *     ⇒ 页面文件 / `App.jsx` 路由与 import / 侧栏项三处零残留，旧地址落后台内层 catch-all；**后端口不动**。
 *  C. 反向对照：`/dashboard/exchange` 三条子路径与 `/dashboard/settings` **仍在**（防「删过头」）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CALLS = vi.hoisted(() => [])

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, permissions: ['manage_settings'], can_access_admin: true })),
  fetchApiJson: vi.fn(async (url, opts = {}) => {
    CALLS.push({ url: String(url), opts })
    if (String(url) === '/api/admin/settings' && !opts.method) {
      // 读口返回**全量** settings（含已从 UI 移除的 8 键）⇒ 页面只准认 `siteName`
      return {
        siteName: 'Seafood Club',
        siteDescription: 'ignored',
        maintenance: false,
        allowRegistration: true,
        emailNotifications: true,
        defaultLanguage: 'zh',
        pointsPerTask: 100,
        maxDailyTasks: 10,
        rewardCooldown: 24,
      }
    }
    if (String(url) === '/api/admin/settings' && opts.method === 'POST') return { siteName: 'New Site' }
    return {}
  }),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  getStoredUser: vi.fn(() => ({ uID: 7, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: vi.fn(() => true),
}))

import toast from 'react-hot-toast'
import i18n from '../../i18n'
import * as adminUtils from '../../admin-utils'
import SystemSettings from '../../pages/admin/SystemSettings'
import zh from '../../locales/zh.json'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')
const TABLES = Object.fromEntries(
  ['zh', 'hk', 'en', 'vn'].map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))])
)

const wrap = (node) => render(<MemoryRouter initialEntries={['/']}>{node}</MemoryRouter>)

/** 生产代码面文件清单（排除 test 目录与 locales）。 */
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === 'locales') continue
      walk(abs, out)
    } else if (/\.(js|jsx)$/.test(entry.name)) out.push(abs)
  }
  return out
}
const prodFiles = () => walk(SRC).map((abs) => ({ abs, rel: path.relative(SRC, abs), text: fs.readFileSync(abs, 'utf8') }))

const EIGHT_DEAD_FIELDS = [
  'siteDescription', 'maintenance', 'allowRegistration', 'emailNotifications',
  'defaultLanguage', 'pointsPerTask', 'maxDailyTasks', 'rewardCooldown',
]

beforeEach(async () => {
  CALLS.length = 0
  adminUtils.hasAdminPermission.mockReturnValue(true)
  await i18n.changeLanguage('zh')
})

describe('A · 基本设置 = 单字段面板（siteName）', () => {
  it('① 只渲出 1 个设置控件，且值来自 `GET /api/admin/settings` 的 `siteName`', async () => {
    const { container } = wrap(<SystemSettings />)

    const box = await screen.findByRole('textbox')
    await waitFor(() => expect(box.value).toBe('Seafood Club'))
    // 页面级断言：表单控件（input/textarea/select）**恰 1 个**（原 8 字段已删）
    expect(container.querySelectorAll('input, textarea, select').length).toBe(1)
    // 页头 / 卡片 / 字段标签 / 保存按钮（zh 档）；页头 h2 与卡片标题同值（`adminNav.settings` = `cardBasic`）
    expect(screen.getAllByText(zh.adminNav.settings).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(zh.adminSiteText.labelSiteTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(zh.adminSettings.saveButton) })).toBeInTheDocument()
    // 已删的 8 个字段标签一个都不渲染
    for (const key of ['labelSiteDescription', 'labelDefaultLanguage', 'labelPointsPerTask',
      'labelMaxDailyTasks', 'labelRewardCooldown', 'maintenance', 'allowRegistration', 'emailNotifications']) {
      expect(screen.queryByText(zh.adminSettings[key])).toBeNull()
    }
  })

  it('② 保存请求体键集**恰为** `["siteName"]`（含值），ops 幂等键走 `Idempotency-Key` 头', async () => {
    wrap(<SystemSettings />)
    const box = await screen.findByRole('textbox')
    await waitFor(() => expect(box.value).toBe('Seafood Club'))

    fireEvent.change(box, { target: { value: 'New Site' } })
    const save = screen.getByRole('button', { name: new RegExp(zh.adminSettings.saveButton) })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    await waitFor(() => expect(CALLS.some((c) => c.opts?.method === 'POST')).toBe(true))
    const post = CALLS.find((c) => c.opts?.method === 'POST')

    const body = JSON.parse(post.opts.body)
    // ★ 键集精确断言：不多发一个键（`create_key` 也不在 body 里 —— 它走请求头）
    expect(Object.keys(body).sort()).toEqual(['siteName'])
    expect(body.siteName).toBe('New Site')
    // 8 个零消费方字段一个都不出现（补丁合并语义的安全前提）
    for (const dead of EIGHT_DEAD_FIELDS) expect(body).not.toHaveProperty(dead)
    // 幂等键：`ops:<uid>:setting:system_settings`（DL36 前缀硬闸；服务端只校验前缀、不落库）
    expect(post.opts.headers['Idempotency-Key']).toBe('ops:7:setting:system_settings')
    expect(post.opts.headers.Authorization).toBe('Bearer test-token')

    // 成功后落定值取自响应、并出 toast（沿用页面既有 toast）
    await waitFor(() => expect(box.value).toBe('New Site'))
    expect(toast.success).toHaveBeenCalled()
  })

  it('③ 闸仍 `manage_settings`：无权限者改值后保存按钮仍 disabled', async () => {
    adminUtils.hasAdminPermission.mockReturnValue(false)
    wrap(<SystemSettings />)
    const box = await screen.findByRole('textbox')
    await waitFor(() => expect(box.value).toBe('Seafood Club'))

    fireEvent.change(box, { target: { value: 'X' } })
    expect(screen.getByRole('button', { name: new RegExp(zh.adminSettings.saveButton) })).toBeDisabled()
    expect(CALLS.some((c) => c.opts?.method === 'POST')).toBe(false)
  })

  it('④ 源码面：无 DEFAULT_SETTINGS / 无 8 字段 / 无全量展开（`...settings` 一类）', () => {
    // 只看**活代码**（剥掉块注释与行注释 —— 头注里逐字登记了被删的 8 个字段名）
    const src = read('pages/admin/SystemSettings.jsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')

    expect(src).not.toContain('DEFAULT_SETTINGS')
    expect(src).not.toContain('handleSettingChange')
    for (const dead of EIGHT_DEAD_FIELDS) expect(src).not.toContain(dead)
    expect(src).not.toMatch(/JSON\.stringify\(\s*\{[^}]*\.\.\./)
    expect(src).toContain('JSON.stringify({ siteName })')
    // 只读 `siteName`：读口归一化不得把整包塞进 state
    expect(src).toContain('data.siteName')
  })
})

describe('B · 任务管理 / 碎片管理两页下线（零残留）', () => {
  it('① 页面文件已删除', () => {
    expect(fs.existsSync(path.join(SRC, 'pages/admin/TasksManagement.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/admin/ShardsManagement.jsx'))).toBe(false)
  })

  it('② App.jsx：component import 与路由段零残留，且内层 catch-all 仍在', () => {
    const app = read('App.jsx')
    expect(app).not.toContain('TasksManagement')
    expect(app).not.toContain('ShardsManagement')
    expect(app).not.toMatch(/path="tasks"/)
    expect(app).not.toMatch(/path="shards"/)
    // 旧地址的落点 = 后台内层 catch-all（404 形态提示页）
    expect(app).toMatch(/<Route path="\*" element=\{<NotFoundPage \/>\} \/>/)
  })

  it('③ AdminLayout 侧栏两项已删（title 引用与 path 都移除）', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).not.toContain("t('adminNav.tasks')")
    expect(layout).not.toContain("t('adminNav.shards')")
    expect(layout).not.toContain("t('adminNav.tasksDesc')")
    expect(layout).not.toContain("t('adminNav.shardsDesc')")
    expect(layout).not.toContain('/dashboard/tasks')
    expect(layout).not.toContain('/dashboard/shards')
  })

  it('④ 全 `src`（排除 test / locales）无 `/dashboard/tasks`、`/dashboard/shards`、两页组件名字面', () => {
    const hits = []
    for (const { rel, text } of prodFiles()) {
      if (text.includes('/dashboard/tasks')) hits.push(`${rel}|/dashboard/tasks`)
      if (text.includes('/dashboard/shards')) hits.push(`${rel}|/dashboard/shards`)
      if (text.includes('TasksManagement')) hits.push(`${rel}|TasksManagement`)
      if (text.includes('ShardsManagement')) hits.push(`${rel}|ShardsManagement`)
    }
    expect(hits).toEqual([])
  })

  it('⑤ 后端读口不动：两页原读的 `/api/campaign/all`、`/api/prize/all` 仍被公开页消费', () => {
    // 前端仍有人调 = 后端口必须留（本单禁改后端）
    const callers = prodFiles().filter(({ text }) => text.includes('/api/campaign/all') || text.includes('/api/prize/all'))
    expect(callers.length).toBeGreaterThanOrEqual(1)
  })
})

describe('C · 反向对照：删过头即判负', () => {
  it('① App.jsx：`/dashboard/settings` 与 exchange 三条子路径仍在', () => {
    const app = read('App.jsx')
    expect(app).toMatch(/path="settings"/)
    expect(app).toMatch(/path="exchange"/)
    expect(app).toMatch(/path="fee-rate"/)
    expect(app).toMatch(/path="currency-review"/)
    expect(app).toMatch(/path="commission-levels"/)
  })

  it('② 侧栏仍有 `/dashboard/settings` 与 `/dashboard/exchange`', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).toContain("path: '/dashboard/settings'")
    expect(layout).toContain("path: '/dashboard/exchange'")
    expect(layout).toContain("t('adminNav.settings')")
  })

  it('③ 页名改值不改键：四语 `adminNav.settings` 新值 + 描述同步', () => {
    expect(TABLES.zh.adminNav.settings).toBe('基本设置')
    expect(TABLES.hk.adminNav.settings).toBe('基本設定')
    expect(TABLES.en.adminNav.settings).toBe('Basic settings')
    expect(TABLES.vn.adminNav.settings).toBe('Cài đặt cơ bản')
    expect(TABLES.zh.adminNav.settingsDesc).toBe('站点名称等基础信息')
    for (const lang of ['zh', 'hk', 'en', 'vn']) {
      expect(TABLES[lang].adminNav.settingsDesc.length).toBeGreaterThan(0)
    }
  })

  it('④ i18n 孤儿键**保留不删**（`adminNav.tasks` / `shards` 四语仍在，键集计数不变）', () => {
    for (const lang of ['zh', 'hk', 'en', 'vn']) {
      expect(TABLES[lang].adminNav.tasks).toBeTruthy()
      expect(TABLES[lang].adminNav.shards).toBeTruthy()
      expect(TABLES[lang].adminSettings).toHaveProperty('maintenance')
    }
    expect(TABLES.zh.adminNav.tasks).toBe('任务管理')
    expect(TABLES.zh.adminNav.shards).toBe('碎片管理')
  })
})
