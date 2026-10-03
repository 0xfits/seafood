/**
 * P6-I18N-LIT-B4b · 后台剩余 5 面（`adminPermissions` / `adminPoints` / `adminShards` /
 *                `adminSettings` / `adminUsers` + `adminCommon` 扩容 19 键）四语化验收
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 走**真实** i18n 实例（`import '../../i18n'`）+ `i18n.changeLanguage('en')`，**不 mock** `react-i18next`；
 *   ② 数据面只 mock `../../admin-utils`（权限 / 取数口）；组件树其余全真；
 *   ③ 反证 = 简体原文在 en 档渲染期不得出现（逐条 `queryByText` 断言）；
 *   ④ 必做① = `common.listSeparator` 分隔符 locale-aware（DashboardPage 已无裸 CJK 标点拼接）；
 *   ⑤ 必做② / AC④ = 直接 exec 本批类级断言脚本，退出码即断言（脚本内禁 `pkill`/服务/网络）；
 *   ⑥ 三条**实测口径修正**（首轮跑红后定位，均为用例写法问题，非产品缺陷）：
 *      · 同一 `<p>` 内多个 `{}` 子节点 ⇒ `getNodeText` 是拼接串 ⇒ 必须用**正则**匹配，不能用整串相等；
 *      · `System Settings` 同时出现在页头 h2 与「系统设置」卡片标题 ⇒ 用 `getAllByText`；
 *      · 本仓 `Tabs` 实现**不渲染非激活页签内容**（jsdom 下 holdings 面板不进 DOM）⇒
 *        holdings 面板文案改为「locale 取值 + 源码面」断言，不做 DOM 断言（避免假红）。
 */
import React from 'react'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(async () => ({ is_admin: true, permissions: [], can_access_admin: true })),
  fetchApiJson: vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/permissions')) {
      return {
        groups: [
          { id: 'g1', name: 'Reviewers', description: '', permissions: ['review_tasks'], user_ids: [] },
          { id: 'g2', name: 'Admin access', description: 'Full admin', permissions: [], user_ids: [1], readonly: true },
        ],
        users: [{ uID: 1, EVM: '0xabcdef1234567890' }],
      }
    }
    if (u.includes('/api/prize/all')) return [{ bID: 7, symbol: 'SYM', name: 'Prize A', stores_count: 5 }]
    if (u.includes('/orderbook')) return [{ side: 'buy', price: 1, volume: 2 }]
    if (u.includes('/trades')) return []
    if (u.includes('/api/admin/settings')) return { siteDescription: '', maintenance: false }
    return {}
  }),
  getAuthHeaders: vi.fn(() => ({})),
  getStoredUser: vi.fn(() => ({ uID: 1, EVM: '0xabcdef1234567890' })),
  hasAdminPermission: vi.fn(() => true),
  loadAdminUsersWithAssets: vi.fn(async () => ({
    users: [{ uID: 1, EVM: '0xabcdef1234567890', bio: '', points: 30, is_admin: true, time_reg: 1700000000, time_login_last: 1700000000 }],
    stats: { userCount: 1, adminCount: 1, assetCount: 1, totalPoints: 30, avgPoints: 30, zeroPoints: 0 },
  })),
}))

import PermissionsManagement from '../../pages/admin/PermissionsManagement'
import PointsManagement from '../../pages/admin/PointsManagement'
import ShardsManagement from '../../pages/admin/ShardsManagement'
import SystemSettings from '../../pages/admin/SystemSettings'
import UsersManagement from '../../pages/admin/UsersManagement'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT = path.resolve(SRC, '..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const readTable = (lang) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
const wrap = (node) => render(<MemoryRouter initialEntries={['/']}>{node}</MemoryRouter>)

afterEach(() => { cleanup() })

describe('P6-I18N-LIT-B4b · en 档渲染英文（后台剩余 5 个面）', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('PermissionsManagement（en 档）：页头 / 说明 / 徽标 / 成员区 / 兜底描述 全走英文', async () => {
    wrap(<PermissionsManagement />)

    expect(await screen.findByText('Permission Management')).toBeInTheDocument()
    expect(screen.getByText(/The "Admin access" group maps to full admin permissions/)).toBeInTheDocument()
    expect(screen.getByText('Add permission group')).toBeInTheDocument()
    expect(screen.getByText('Refresh')).toBeInTheDocument()
    // 等列表落地（`loading` 守卫）
    expect(await screen.findByText('Reviewers')).toBeInTheDocument()
    // `description` 为空 ⇒ 兜底键 `adminCommon.noDescription`
    expect(screen.getByText('No description')).toBeInTheDocument()
    expect(screen.getByText('Editable')).toBeInTheDocument()
    // `readonly` 组 ⇒ 只读徽标 + 系统组不可编辑/删除的 title
    expect(screen.getByText('Read-only')).toBeInTheDocument()
    expect(screen.getByTitle('Edit permission group')).toBeInTheDocument()
    expect(screen.getByTitle('System permission groups cannot be deleted')).toBeInTheDocument()
    // `user_ids` 为空 ⇒ `adminPermissions.noMembers`
    expect(screen.getByText('No members assigned')).toBeInTheDocument()
    // 反证：简体原文不出现
    expect(screen.queryByText('权限管理')).toBeNull()
    expect(screen.queryByText('添加权限组')).toBeNull()
    expect(screen.queryByText('暂无描述')).toBeNull()
    expect(screen.queryByText('只读')).toBeNull()
  })

  it('UsersManagement（en 档）：页头 / 四张统计卡 / 表头 / 角色徽标 / 兜底简介 全走英文', async () => {
    wrap(<UsersManagement />)

    // 表头只在 `loading` 结束后出现 ⇒ 先等它
    expect(await screen.findByText('User ID')).toBeInTheDocument()
    expect(screen.getByText('User Management')).toBeInTheDocument()
    expect(screen.getByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('With asset records')).toBeInTheDocument()
    expect(screen.getByText('Total points')).toBeInTheDocument()
    // 同一 <p> 内两个 {} 子节点 ⇒ 拼接串，用正则
    expect(screen.getByText(/This page uses real user and points asset data\./)).toBeInTheDocument()
    expect(screen.getByText(/You can change administrator rights\./)).toBeInTheDocument()
    for (const th of ['Wallet address', 'Bio', 'Registered', 'Last login', 'Actions']) {
      expect(screen.getByText(th)).toBeInTheDocument()
    }
    // `bio` 为空 ⇒ `adminUsers.noBio`
    expect(screen.getByText('No bio')).toBeInTheDocument()
    expect(screen.getByText('Refresh data')).toBeInTheDocument()
    expect(screen.getByTitle('Revoke administrator rights')).toBeInTheDocument()
    expect(screen.getByTitle('Go to points management')).toBeInTheDocument()
    // 反证
    expect(screen.queryByText('用户管理')).toBeNull()
    expect(screen.queryByText('总用户数')).toBeNull()
    expect(screen.queryByText('暂无简介')).toBeNull()
    expect(screen.queryByText('刷新数据')).toBeNull()
  })

  it('PointsManagement（en 档）：页头 / 统计卡 / 表头 / 搜索占位 / 兜底时间 全走英文', async () => {
    wrap(<PointsManagement />)

    // 表头只在 `loading` 结束后出现 ⇒ 先等它
    expect(await screen.findByText('Current points')).toBeInTheDocument()
    expect(screen.getByText('User points management')).toBeInTheDocument()
    expect(screen.getByText('Total users')).toBeInTheDocument()
    expect(screen.getByText('Average points')).toBeInTheDocument()
    expect(screen.getByText('Users with zero points')).toBeInTheDocument()
    // 同一 <p> 内两个 {} 子节点 ⇒ 拼接串，用正则
    expect(screen.getByText(/This page uses real user and points asset data,/)).toBeInTheDocument()
    expect(screen.getByText(/you can adjust points\./)).toBeInTheDocument()
    for (const th of ['User ID', 'Wallet address', 'Last updated', 'Role', 'Actions']) {
      expect(screen.getByText(th)).toBeInTheDocument()
    }
    expect(screen.getByPlaceholderText('Search by wallet address or ID...')).toBeInTheDocument()
    expect(screen.getByTitle('Add points')).toBeInTheDocument()
    expect(screen.getByTitle('Remove points')).toBeInTheDocument()
    // 反证
    expect(screen.queryByText('用户积分管理')).toBeNull()
    expect(screen.queryByText('平均积分')).toBeNull()
    expect(screen.queryByText('零积分用户')).toBeNull()
  })

  it('ShardsManagement（en 档）：页头 / 三个页签 / 刷新 全走英文（holdings 面板文案走取值+源码断言）', async () => {
    wrap(<ShardsManagement />)

    expect(await screen.findByText('Shard Management')).toBeInTheDocument()
    for (const tab of ['Holdings overview', 'Open orders', 'Trade history']) {
      expect(screen.getByText(tab)).toBeInTheDocument()
    }
    expect(screen.getByText('Refresh')).toBeInTheDocument()
    // 反证
    expect(screen.queryByText('碎片管理')).toBeNull()
    expect(screen.queryByText('持仓总览')).toBeNull()
    expect(screen.queryByText('挂单管理')).toBeNull()

    // ③ 本仓 `Tabs` 不渲染非激活页签 ⇒ holdings 面板文案走「locale 取值 + 源码面」断言
    for (const lang of LANGS) {
      const t = readTable(lang)
      expect(t.adminShards.holdingsNote).not.toContain('api/')
      expect(t.adminShards.holdingsNote).not.toContain('§')
      expect(t.adminShards.thPrize.length).toBeGreaterThan(0)
      expect(t.adminShards.thStoresCount.length).toBeGreaterThan(0)
    }
    // 必做②：原「个人持仓可通过 /api/shard 查询…」已改写为无接口路径的表述
    expect(readTable('en').adminShards.holdingsNote).toContain('in their own account page')
    const src = fs.readFileSync(path.join(SRC, 'pages/admin/ShardsManagement.jsx'), 'utf8')
    expect(src).not.toContain('/api/shard')
    expect(src).toContain("t('adminShards.holdingsNote')")
  })

  it('SystemSettings（en 档）：页头 / 三张卡 / 各字段标签 / 保存按钮 全走英文', async () => {
    wrap(<SystemSettings />)

    // 三张卡只在 `initialLoading` 结束后出现 ⇒ 先等它
    expect(await screen.findByText('Basic settings')).toBeInTheDocument()
    // `System Settings` 同时是页头 h2 与「系统设置」卡片标题 ⇒ 至少 2 处
    expect(screen.getAllByText('System Settings').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/This page reads and saves site settings\./)).toBeInTheDocument()
    expect(screen.getByText('Current content matches the saved settings.')).toBeInTheDocument()
    for (const chunk of ['Site description', 'Default language', 'Maintenance mode',
      'Allow registration', 'Email notifications', 'Points settings', 'Default points per task',
      'Max tasks per day', 'Reward cooldown (hours)', 'Save settings']) {
      expect(screen.getByText(chunk)).toBeInTheDocument()
    }
    // 必做②：原「（保存按 §2.4 S1/DL36 带 `ops:` 幂等键）…（§5.1 = `410`）」已改写
    expect(screen.queryByText(/§/)).toBeNull()
    expect(screen.queryByText(/410/)).toBeNull()
    // 反证
    expect(screen.queryByText('系统设置')).toBeNull()
    expect(screen.queryByText('基本设置')).toBeNull()
    expect(screen.queryByText('保存设置')).toBeNull()
  })
})

describe('P6-I18N-LIT-B4b · 必做① 分隔符 locale-aware（`common.listSeparator`）', () => {
  it('四语分隔符取值正确（zh/hk = 「、」，en/vn = 「, 」）且拼接结果随语言变化', async () => {
    const expectSep = { zh: '、', hk: '、', en: ', ', vn: ', ' }
    for (const lang of LANGS) {
      await i18n.changeLanguage(lang)
      expect(i18n.t('common.listSeparator'), `common.listSeparator@${lang}`).toBe(expectSep[lang])
    }
    const labels = ['用户统计', '任务统计']
    await i18n.changeLanguage('zh')
    expect(labels.join(i18n.t('common.listSeparator'))).toBe('用户统计、任务统计')
    await i18n.changeLanguage('en')
    expect(labels.join(i18n.t('common.listSeparator'))).toBe('用户统计, 任务统计')
    await i18n.changeLanguage('vn')
    expect(labels.join(i18n.t('common.listSeparator'))).toBe('用户统计, 任务统计')
    // 四语 `dashPage.partialLoadFailed` 均以 {{list}} 占位接入分隔符
    for (const lang of LANGS) expect(readTable(lang).dashPage.partialLoadFailed).toContain('{{list}}')
    await i18n.changeLanguage('zh')
  })

  it('DashboardPage 渲染处走 `t(\'common.listSeparator\')`，源码中不得再有裸 CJK 标点拼接', () => {
    const src = fs.readFileSync(path.join(SRC, 'pages/DashboardPage.jsx'), 'utf8')
    expect(src).toContain("errors.join(t('common.listSeparator'))")
    expect(src).not.toContain("join('、')")
    // 反向断言：不得用裸非 ASCII 标点当分隔符（`、` `；` `，` 等）
    expect(/\.join\(['"][^'"]*[\u3000-\u303F\uFF00-\uFFEF]/.test(src)).toBe(false)
  })
})

describe('P6-I18N-LIT-B4b · 四语 locale 键集 + 类级断言脚本读数', () => {
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()
  const NEW_NS = { adminPermissions: 29, adminPoints: 27, adminShards: 19, adminSettings: 25, adminUsers: 17 }
  const ADMIN_COMMON_B4B = 19
  const COMMON_B4B = 1

    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
  it('新增 137 键四语齐备、非空串；四文件拍平键集逐文件相等（B5 末批 + 批 7-A + 批 7-D + P7-E 后 top=108 / flat=886）', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = readTable(lang)
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    const added = Object.values(NEW_NS).reduce((a, b) => a + b, 0) + ADMIN_COMMON_B4B + COMMON_B4B
    console.info('[B4b] locale 键数读数', JSON.stringify(counts), '本批新增键数 =', added)
    expect(added).toBe(137)

    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    expect(counts.zh).toEqual({ top: 108, flat: 886 }) // **期望订正（批 8② 费率+权重矩阵）**：+adminFeeRate 18 / +adminWeightMatrix 21 / +adminNav 4 ⇒ 拍平 +43 / 顶层 +2（745⇒788 / 103⇒105）。原口径（P7-E 小尾巴批-β）：新增 orders 块（statusLabel 5 + sideLabel 3）= 拍平 +8 / 顶层 +1（737⇒745 / 102⇒103）。原口径：B5 组件库+预览页末批；批 7-A +21；批 7-D +33
    // 本批新增的 5 个顶层命名空间（命名空间铁律：不得与既有顶层字符串键冲突）
    for (const [ns, size] of Object.entries(NEW_NS)) {
      expect(Object.keys(tables.zh)).toContain(ns)
      for (const lang of LANGS) {
        expect(typeof tables[lang][ns]).toBe('object')
        expect(Object.keys(tables[lang][ns]).sort()).toEqual(Object.keys(tables.zh[ns]).sort())
        expect(Object.keys(tables[lang][ns]).length).toBe(size)
        for (const [k, v] of Object.entries(tables[lang][ns])) {
          expect(typeof v, `${lang}.${ns}.${k}`).toBe('string')
          expect(v.trim().length, `${lang}.${ns}.${k}`).toBeGreaterThan(0)
        }
      }
    }
    // `adminCommon` 扩容后 = 28 键；`common.listSeparator` 四语齐备
    for (const lang of LANGS) expect(Object.keys(tables[lang].adminCommon).length).toBe(28)
    expect(tables.zh.common.listSeparator).toBe('、')
    expect(tables.en.common.listSeparator).toBe(', ')

    // en / vn 不得残留 CJK 表意文字（登记豁免：语言选择器 endonym 2 键）
    const CJK = /[\u4E00-\u9FFF]/
    const ENDONYM = new Set(['langZh', 'langHk'])
    for (const ns of Object.keys(NEW_NS)) {
      for (const lang of ['en', 'vn']) {
        for (const [k, v] of Object.entries(tables[lang][ns])) {
          if (ENDONYM.has(k)) continue
          expect(CJK.test(v), `${lang}.${ns}.${k}`).toBe(false)
        }
      }
    }
    // hk 必须是繁体（不得照抄简体原文）
    expect(tables.hk.adminNav.shards).toBe('碎片管理')
    expect(tables.hk.adminPoints.statAvg).toBe('平均積分')
    expect(tables.hk.adminSettings.cardBasic).toBe('基本設定')
    expect(tables.hk.adminPermissions.editable).toBe('可編輯')
    expect(tables.hk.adminUsers.introReadOnly).toContain('唯讀模式')
  })

  it('必做② 回归守卫：B4a 遗留的只读告示已去掉 §/状态码/接口路径（四语互异）', () => {
    const ENG = [/§/, /410/, /R107/, /api\//, /sunset/]
    for (const lang of LANGS) {
      const table = readTable(lang)
      for (const ns of ['adminTasks', 'adminRewards']) {
        const v = table[ns].readOnlyNotice
        for (const re of ENG) expect(re.test(v), `${lang}.${ns}.readOnlyNotice = ${v}`).toBe(false)
        expect(v.length).toBeGreaterThan(0)
      }
    }
    // 四语互异（真翻译，不是照抄）
    const tasks = LANGS.map((l) => readTable(l).adminTasks.readOnlyNotice)
    expect(new Set(tasks).size).toBe(4)
  })

  it('AC④ 类级断言脚本（p4z-i18nb4b-cjk.mjs）退出码 = 0：写集 CJK 0 / 工程口径 0', () => {
    const out = execFileSync(process.execPath, ['scripts/p4z-i18nb4b-cjk.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
    expect(out).toContain('[B4b-CJK] 总判：PASS')
    expect(out).toContain('CJK 字面量命中 = 0')
    expect(out).toContain('工程口径(用户可见文案面)命中 = 0')
  })

  it('AC③ 四语键集相等（scripts/p6-tr2-i18n-locales.mjs）退出码 = 0', () => {
    const out = execFileSync(process.execPath, ['scripts/p6-tr2-i18n-locales.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
    expect(out).toContain('[TR-2] 键集相等：PASS')
    // 批 8④ 计数期望订正（逐字登记）：新增顶层 adminCurrencyReview（28 键）+ adminNav 2 键 ⇒ 顶层 105⇒106 / 拍平 788⇒818 / locale 节点 3152⇒3272
    // 批 8⑤ 计数期望订正（逐字登记）：新增顶层 adminListingReview（30 键）+ adminArbitrationReview（34 键）+ adminNav 4 键（listingReview/listingReviewDesc/arbitrationReview/arbitrationReviewDesc）⇒ 顶层 106⇒108 / 拍平 818⇒886 / locale 节点 3272⇒3544（增量来源 = 本批合法新增：注册点 +4 ⇔ 4 新路由；迁移 +2 ⇔ 2 新文件；adminNav +4 ⇔ 4 新菜单键）
    expect(out).toContain('zh: top=108 flat=886') // **期望订正（批 8② 费率+权重矩阵）**：+43 拍平 / +2 顶层（745⇒788 / 103⇒105）：新增 orders 块 8 键（737⇒745 / 102⇒103）
  })
})
