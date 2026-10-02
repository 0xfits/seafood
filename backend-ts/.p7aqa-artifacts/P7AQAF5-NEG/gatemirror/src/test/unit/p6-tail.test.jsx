/**
 * P6-TAIL · 前端小尾巴批验收用例（Kong）
 *  ① 乙族残留 = 0：src（去注释 / 去 test）里 `to="/…"`、`navigate('/…'` 字面量必须为空，
 *     且 10 处已登记点全部改走**唯一构造器** `buildLocalizedPath(lang, path)`。
 *  ② admin 守卫未被绕过（改成语言感知跳转后，未登录 / 非 admin 行为不变）：
 *     未登录 ⇒ `fetchApiJson` 零调用；非 admin ⇒ 零调用；admin ⇒ 放行（正对照）。
 *  ③ Tabs 共享件加固：TabsList 含 `max-w-full` + `overflow-x-auto`（实测有效项，见 audit）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import toast from 'react-hot-toast'

import '../../i18n'

const mocks = vi.hoisted(() => ({
  getStoredUser: vi.fn(),
  fetchAdminAccess: vi.fn(),
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
  hasAdminPermission: vi.fn(() => false),
}))
vi.mock('../../admin-utils', () => mocks)
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

import PermissionsManagement from '../../pages/admin/PermissionsManagement'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const prodFiles = () => walk(path.join(SRC, 'pages')).concat(walk(path.join(SRC, 'components')))
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*/gm, '').replace(/(\s)\/\/[^\n]*/g, '$1')

afterEach(() => { cleanup(); vi.clearAllMocks() })

const renderPage = () => render(<MemoryRouter initialEntries={['/dashboard/permissions']}><PermissionsManagement /></MemoryRouter>)

describe('① 乙族残留 = 0 · 站内链接唯一构造器', () => {
  it('硬编码 to="/…" / navigate(\'/…\' 残留数 = 0（上批 10 处已全部收口）', () => {
    const hits = []
    for (const f of prodFiles()) {
      const text = strip(fs.readFileSync(f, 'utf8'))
      for (const re of [/\bto=("|')(\/[^"']*)\1/g, /\bnavigate\(\s*("|')(\/[^"']*)\1/g]) {
        let m
        while ((m = re.exec(text))) { if (!m[2].startsWith('/api/')) hits.push(path.relative(SRC, f) + '|' + m[2]) }
      }
    }
    expect(hits).toEqual([])
  })
  it('有效性闸：唯一构造器 buildLocalizedPath 使用点 ≥ 10（作用域不得为空）', () => {
    const n = prodFiles().reduce((a, f) => a + ((fs.readFileSync(f, 'utf8').match(/buildLocalizedPath\(/g) || []).length), 0)
    expect(n).toBeGreaterThanOrEqual(10)
  })
  it('原 10 处登记点所在 6 文件均已引构造器', () => {
    for (const rel of ['components/ActiveTaskModal.jsx', 'pages/DashboardPage.jsx', 'pages/admin/PermissionsManagement.jsx', 'pages/admin/PointsManagement.jsx', 'pages/admin/SystemSettings.jsx', 'pages/admin/UsersManagement.jsx']) {
      expect(fs.readFileSync(path.join(SRC, rel), 'utf8')).toContain('buildLocalizedPath(')
    }
  })
})

describe('② admin 守卫链未被绕过（行为不变）', () => {
  it('未登录：不取 admin 数据、出错误提示（守卫仍拦在第一跳）', async () => {
    mocks.getStoredUser.mockReturnValue(null)
    renderPage()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(mocks.fetchApiJson).not.toHaveBeenCalled()
    expect(mocks.fetchAdminAccess).not.toHaveBeenCalled()
  })
  it('非 admin（can_access_admin=false）：不取 admin 数据、出错误提示', async () => {
    mocks.getStoredUser.mockReturnValue({ uID: 9, EVM: '0xdead' })
    mocks.fetchAdminAccess.mockResolvedValue({ is_admin: false, permissions: [], can_access_admin: false })
    renderPage()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(mocks.fetchApiJson).not.toHaveBeenCalledWith('/api/admin/permissions', expect.anything())
  })
  it('admin（正对照）：放行并取数（证明守卫只拦非法态）', async () => {
    mocks.getStoredUser.mockReturnValue({ uID: 1, EVM: '0xabc' })
    mocks.fetchAdminAccess.mockResolvedValue({ is_admin: true, permissions: [], can_access_admin: true })
    mocks.fetchApiJson.mockResolvedValue({ groups: [], users: [] })
    renderPage()
    await waitFor(() => expect(mocks.fetchApiJson).toHaveBeenCalledWith('/api/admin/permissions', expect.anything()))
  })
})

describe('③ 共享 Tabs 加固（有效项 = 列表级横向容纳）', () => {
  it('TabsList 含 max-w-full + overflow-x-auto（实测可拦 397→390 的文档级溢出）', () => {
    const t = fs.readFileSync(path.join(SRC, 'components/ui/Tabs.jsx'), 'utf8')
    expect(t).toContain('max-w-full')
    expect(t).toContain('overflow-x-auto')
  })
})
