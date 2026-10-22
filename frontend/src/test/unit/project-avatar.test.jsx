/**
 * 项目头像写口单测（Kevin 2026-10-22②：项目页头部换头像 / 恢复默认）
 *
 * 覆盖面（逐条对齐派单验证项）：
 *   ① 入口三臂显隐：owner 见相机钮、`manage_tasks` 管理员见、普通用户**零入口零 input**
 *      （头像本身仍渲染）；`ended` 项目的 owner 仍可改（纯展示属性，不受写面封板）；
 *   ② 命中点击下限与可达性：`aria-label` = `project.avatarChange`、真 `<button type=button>`、
 *      CSS 里 28px 见方（≥24px 派单下限）；文件选择器 `accept=image/*`；
 *   ③ 上传流水线：压缩（共享 `src/image-compress.js`）⇒ `POST /api/media` ⇒
 *      `PATCH /api/project/:projectId`，**载荷恰 `{avatar_url:'/api/media/123'}`**（无其它键），
 *      成功后静默重拉（头像 `<img src>` 即时变 `/api/media/123`），零成功弹窗；
 *   ④ 拦截面**零上传**：压缩后仍超 1MiB（`compressImage` 返 `null`）⇒ `avatarTooLarge`；
 *      解码/编码异常 ⇒ `avatarUploadFail`；媒体口无 id ⇒ `avatarUploadFail`；三者都**零 PATCH**；
 *   ⑤ 写口失败内联：409 / 400 走 `writeFailNotice`（文案带机读码 + HTTP 状态，
 *      `data-sf-err-*` 取证字段齐备），头像不改判、不重拉；
 *   ⑥ 恢复默认：行内二次确认（未确认**零 PATCH**、取消即收），确认后载荷恰 `{avatar_url:null}`，
 *      成功后重拉 ⇒ 头像回到项目名首字兜底。
 *
 * 注：压缩实现本身的行为（质量档 × 边长档降级、WebP 回落 JPEG、1MiB 顶）由
 *     `publish-item-image.test.jsx` 在发布页面上钉死；本项目页断言的是**消费契约**
 *     （`{contentType,dataBase64}` 进媒体口、`null` ⇒ 拒收零上传），故此处 mock 掉共享模块。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => makeT(zh)(key, vars),
    i18n: { changeLanguage: vi.fn(), resolvedLanguage: 'zh', language: 'zh' },
  }),
}))

const AUTH = vi.hoisted(() => ({ isAuthenticated: true, user: { uID: 7, token: 't-7' } }))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

const API = vi.hoisted(() => ({
  fetchProjectDetail: vi.fn(),
  fetchProjectCurrencies: vi.fn(),
  patchProject: vi.fn(),
  uploadProjectAvatar: vi.fn(),
}))
vi.mock('../../pages/project/project-api', () => ({
  fetchProjectDetail: API.fetchProjectDetail,
  fetchProjectCurrencies: API.fetchProjectCurrencies,
  patchProject: API.patchProject,
  uploadProjectAvatar: API.uploadProjectAvatar,
  createProjectCampaign: vi.fn(),
  patchProjectCampaign: vi.fn(),
  createProjectCampaignTask: vi.fn(),
  appendProjectSubtasks: vi.fn(),
}))

// 压缩 = 共享模块（真实现留在发布页单测里钉）；这里只摆三种回包：成功 / 超限 null / 抛异常
const COMPRESS = vi.hoisted(() => ({ compressImage: vi.fn() }))
vi.mock('../../image-compress', () => ({ compressImage: COMPRESS.compressImage }))

const ADMIN = vi.hoisted(() => ({ loadListingEditAdmin: vi.fn() }))
vi.mock('../../pages/item/item-edit-access', async () => {
  const actual = await vi.importActual('../../pages/item/item-edit-access')
  return { ...actual, loadListingEditAdmin: ADMIN.loadListingEditAdmin }
})

import ProjectPage from '../../pages/project/ProjectPage'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CSS = fs.readFileSync(path.join(SRC, 'pages/project/project.css'), 'utf8')
const PAGE_SRC = fs.readFileSync(path.join(SRC, 'pages/project/ProjectAvatar.jsx'), 'utf8')

const VIEW = { current: null }

const viewOf = (patch = {}) => ({
  project_id: 11,
  snowflake_id: '70011',
  slug: 'sui',
  title: '海鲜打包',
  description: '每天打包 20 单',
  status: 'recruiting',
  headcount: 3,
  hired_count: 2,
  owner_uid: 7,
  avatar_url: null,
  recruit_min_account_days: 7,
  wage_batt_per_claim: 30,
  wage_cid: null,
  wage_currency_amount: null,
  wage_interval_hours: 4,
  campaigns: [],
  ...patch,
})

const renderAt = (entry = '/sui') => render(
  <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path=":slug" element={<ProjectPage />} />
    </Routes>
  </MemoryRouter>,
)

const q = (container, name) => container.querySelector(`[data-sf-m="${name}"]`)
const changeBtn = (container) => q(container, 'project-avatar-change')
const resetBtn = (container) => q(container, 'project-avatar-reset')
const confirmRow = (container) => q(container, 'project-avatar-reset-confirm')
const fileInput = (container) => q(container, 'project-avatar-input')
const badge = (container) => q(container, 'project-avatar-notice')
const avatarImg = (container) => q(container, 'project-avatar-img')
const initial = (container) => q(container, 'project-avatar-initial')

const ready = async (container) => {
  await waitFor(() => expect(q(container, 'project-head')).not.toBeNull())
  await waitFor(() => expect(API.fetchProjectDetail).toHaveBeenCalled())
}

const imageFile = (name = 'avatar.png', type = 'image/png') => new File(['fake-bytes'], name, { type })

const pickFile = async (container, file = imageFile()) => {
  const input = fileInput(container)
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  AUTH.isAuthenticated = true
  AUTH.user = { uID: 7, token: 't-7' }
  VIEW.current = viewOf()
  API.fetchProjectCurrencies.mockResolvedValue([{ cid: 1, symbol: '$' }])
  API.fetchProjectDetail.mockImplementation(async () => ({ ...VIEW.current }))
  // 服务端写库模拟：PATCH 载荷合并进视图 ⇒ 成功后的静默重拉读到新头像
  API.patchProject.mockImplementation(async (ref, body) => {
    Object.assign(VIEW.current, body)
    return { ...VIEW.current }
  })
  API.uploadProjectAvatar.mockResolvedValue({ media_id: 123, url: '/api/media/123' })
  COMPRESS.compressImage.mockResolvedValue({
    contentType: 'image/webp', dataBase64: 'QUJD', preview: 'data:image/webp;base64,QUJD',
  })
  ADMIN.loadListingEditAdmin.mockResolvedValue(null)
})

afterEach(() => { cleanup() })

// ------------------------------------------------------------ ① 入口显隐三臂
describe('① 头像入口显隐（owner ∨ manage_tasks；ended 仍可改；普通用户零入口）', () => {
  it('owner 臂：相机钮在、`aria-label` = project.avatarChange、文件选择器 accept=image/*', async () => {
    const { container } = renderAt()
    await ready(container)
    const btn = await waitFor(() => {
      expect(changeBtn(container)).not.toBeNull()
      return changeBtn(container)
    })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.getAttribute('aria-label')).toBe(zh.project.avatarChange)
    expect(btn.getAttribute('title')).toBe(zh.project.avatarChange)
    expect(fileInput(container)).not.toBeNull()
    expect(fileInput(container).getAttribute('accept')).toBe('image/*')
    expect(fileInput(container).getAttribute('type')).toBe('file')
    // 无头像 ⇒ 首字兜底（项目名首字），零 <img>
    expect(initial(container).textContent).toBe('海')
    expect(avatarImg(container)).toBeNull()
    // 无头像 ⇒ 不渲染【恢复默认】（没东西可恢复）
    expect(resetBtn(container)).toBeNull()
  })

  it('管理员臂：非 owner 但 manage_tasks ⇒ 相机钮在（三键异步落定后）', async () => {
    VIEW.current = viewOf({ owner_uid: 99 })
    ADMIN.loadListingEditAdmin.mockResolvedValue({
      can_access_admin: true, is_admin: false, permissions: ['manage_tasks'],
    })
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
  })

  it('普通用户臂：零相机钮、零 input、零恢复默认；头像仍是首字兜底（只读）', async () => {
    VIEW.current = viewOf({ owner_uid: 99, avatar_url: '/api/media/9' })
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(ADMIN.loadListingEditAdmin).toHaveBeenCalled())
    expect(changeBtn(container)).toBeNull()
    expect(fileInput(container)).toBeNull()
    expect(resetBtn(container)).toBeNull()
    expect(confirmRow(container)).toBeNull()
    // 头像本身对所有人可见（读面行里有 url ⇒ img）
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/9')
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(API.uploadProjectAvatar).not.toHaveBeenCalled()
  })

  it('未登录臂：零入口零 input（也不发 /api/user）', async () => {
    AUTH.isAuthenticated = false
    AUTH.user = null
    const { container } = renderAt()
    await ready(container)
    expect(changeBtn(container)).toBeNull()
    expect(fileInput(container)).toBeNull()
    expect(ADMIN.loadListingEditAdmin).not.toHaveBeenCalled()
  })

  it('ended 臂：owner 仍见相机钮与【恢复默认】（头像是展示属性，不受写面封板）', async () => {
    VIEW.current = viewOf({ status: 'ended', avatar_url: '/api/media/9' })
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    expect(resetBtn(container)).not.toBeNull()
    // 对照：操作区（编辑项目 / 发布活动）在 ended 下仍然缺席
    expect(q(container, 'project-manage')).toBeNull()
  })
})

// ------------------------------------------------ ② 可达性（尺寸 / 语义 / 复用）
describe('② 点击区与实现单一真源', () => {
  it('CSS：相机钮 28px 见方（≥24px 下限）、圆形、focus-visible 有描边', () => {
    expect(CSS).toMatch(/\.sf-project-avatar-change\s*\{[^}]*width:\s*28px/)
    expect(CSS).toMatch(/\.sf-project-avatar-change\s*\{[^}]*height:\s*28px/)
    expect(CSS).toMatch(/\.sf-project-avatar-change\s*\{[^}]*border-radius:\s*50%/)
    expect(CSS).toContain('.sf-project-avatar-change:focus-visible')
  })

  it('压缩实现 = 共享模块（页面不复制压缩算法，零 canvas/toDataURL 实现在页面里）', () => {
    expect(PAGE_SRC).toContain("from '../../image-compress'")
    expect(PAGE_SRC).not.toContain('toDataURL')
    expect(PAGE_SRC).not.toContain('QUALITY_LADDER')
  })
})

// -------------------------------------------------------- ③ 上传成功 + 载荷
describe('③ 上传流水线：压缩 ⇒ POST /api/media ⇒ PATCH 恰 {avatar_url}', () => {
  it('选图 ⇒ 压缩产物进媒体口、PATCH 载荷恰 `{avatar_url:\'/api/media/123\'}`、静默重拉后 img 换 src', async () => {
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())

    const file = imageFile()
    await pickFile(container, file)

    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    // 压缩产物逐键进媒体口（content_type / data_base64 两键，不多不少）
    expect(API.uploadProjectAvatar).toHaveBeenCalledTimes(1)
    const [uploadUser, uploadBody] = API.uploadProjectAvatar.mock.calls[0]
    expect(uploadUser).toBe(AUTH.user)
    expect(uploadBody).toEqual({ content_type: 'image/webp', data_base64: 'QUJD' })
    // 写口：目标 = 项目主键，载荷恰一个键
    const [ref, body] = API.patchProject.mock.calls[0]
    expect(String(ref)).toBe('11')
    expect(body).toEqual({ avatar_url: '/api/media/123' })
    expect(Object.keys(body)).toEqual(['avatar_url'])
    // 静默重拉 ⇒ 头像即时变成新 url（无成功弹窗 / 无错误提示）
    await waitFor(() => expect(avatarImg(container)).not.toBeNull())
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/123')
    expect(initial(container)).toBeNull()
    expect(badge(container)).toBeNull()
    expect(API.fetchProjectDetail.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('媒体口只回 `url`（无 media_id）⇒ 仍按 url 里的 id 组 `/api/media/<id>`', async () => {
    API.uploadProjectAvatar.mockResolvedValue({ url: '/api/media/777' })
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    await pickFile(container)
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    expect(API.patchProject.mock.calls[0][1]).toEqual({ avatar_url: '/api/media/777' })
  })
})

// --------------------------------------------------------- ④ 拦截：零上传零 PATCH
describe('④ 拦截面：压缩超限 / 压缩异常 / 媒体无 id ⇒ 零上传零 PATCH + 内联提示', () => {
  it('压缩后仍 >1MiB（compressImage 返 null）⇒ avatarTooLarge、零媒体调用、零 PATCH', async () => {
    COMPRESS.compressImage.mockResolvedValue(null)
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    await pickFile(container)
    await waitFor(() => expect(badge(container)).not.toBeNull())
    expect(badge(container).textContent).toBe(zh.project.avatarTooLarge)
    expect(badge(container).getAttribute('data-sf-kind')).toBe('err')
    expect(API.uploadProjectAvatar).not.toHaveBeenCalled()
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(avatarImg(container)).toBeNull() // 头像不改判
  })

  it('压缩/解码抛异常 ⇒ avatarUploadFail、零上传、零 PATCH', async () => {
    COMPRESS.compressImage.mockRejectedValue(new Error('decode failed'))
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    await pickFile(container)
    await waitFor(() => expect(badge(container)).not.toBeNull())
    expect(badge(container).textContent).toBe(zh.project.avatarUploadFail)
    expect(API.uploadProjectAvatar).not.toHaveBeenCalled()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('非图片文件 ⇒ 直接忽略（零压缩、零上传）', async () => {
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    await pickFile(container, new File(['x'], 'a.txt', { type: 'text/plain' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(COMPRESS.compressImage).not.toHaveBeenCalled()
    expect(API.uploadProjectAvatar).not.toHaveBeenCalled()
    expect(API.patchProject).not.toHaveBeenCalled()
  })

  it('媒体口回包无 id / 无 url ⇒ avatarUploadFail，零 PATCH（绝不写半截头像）', async () => {
    API.uploadProjectAvatar.mockResolvedValue({ ok: true })
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    await pickFile(container)
    await waitFor(() => expect(badge(container)).not.toBeNull())
    expect(badge(container).textContent).toBe(zh.project.avatarUploadFail)
    expect(API.patchProject).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------- ⑤ 写口失败内联
describe('⑤ 写口失败 ⇒ writeFailNotice 内联（409 / 400），头像不改判', () => {
  const fail = (status, code) => Object.assign(new Error(code), {
    status, code, details: { reason: code.toLowerCase() },
  })

  it('PATCH 409 ⇒ 内联带 HTTP 409 + 机读码，零重拉、头像仍是旧值', async () => {
    VIEW.current = viewOf({ avatar_url: '/api/media/9' })
    API.patchProject.mockRejectedValue(fail(409, 'PROJECT_ENDED'))
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    const readsBefore = API.fetchProjectDetail.mock.calls.length
    await pickFile(container)
    await waitFor(() => expect(badge(container)).not.toBeNull())
    expect(badge(container).textContent).toContain('409')
    expect(badge(container).textContent).toContain('PROJECT_ENDED')
    expect(badge(container).getAttribute('data-sf-err-code')).toBe('PROJECT_ENDED')
    expect(badge(container).getAttribute('data-sf-err-status')).toBe('409')
    expect(API.fetchProjectDetail.mock.calls.length).toBe(readsBefore)
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/9')
  })

  it('媒体口 400 ⇒ 内联带 HTTP 400 + code（上传阶段失败，零 PATCH）', async () => {
    API.uploadProjectAvatar.mockRejectedValue(fail(400, 'MEDIA_TOO_LARGE'))
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(changeBtn(container)).not.toBeNull())
    await pickFile(container)
    await waitFor(() => expect(badge(container)).not.toBeNull())
    expect(badge(container).textContent).toContain('400')
    expect(badge(container).textContent).toContain('MEDIA_TOO_LARGE')
    expect(badge(container).getAttribute('data-sf-err-status')).toBe('400')
    expect(API.patchProject).not.toHaveBeenCalled()
  })
})

// ------------------------------------------------------------ ⑥ 恢复默认
describe('⑥ 恢复默认：行内二次确认 ⇒ 载荷恰 {avatar_url:null}', () => {
  it('点【恢复默认】⇒ 出现确认行、零 PATCH；取消 ⇒ 收行、零 PATCH', async () => {
    VIEW.current = viewOf({ avatar_url: '/api/media/9' })
    const { container } = renderAt()
    await ready(container)
    const btn = await waitFor(() => {
      expect(resetBtn(container)).not.toBeNull()
      return resetBtn(container)
    })
    expect(btn.textContent).toContain(zh.project.avatarReset)
    expect(btn.getAttribute('aria-label')).toBe(zh.project.avatarReset)
    fireEvent.click(btn)
    await waitFor(() => expect(confirmRow(container)).not.toBeNull())
    expect(confirmRow(container).textContent).toContain(zh.project.avatarResetConfirm)
    expect(API.patchProject).not.toHaveBeenCalled()
    fireEvent.click(q(container, 'project-avatar-reset-cancel'))
    await waitFor(() => expect(confirmRow(container)).toBeNull())
    expect(API.patchProject).not.toHaveBeenCalled()
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/9')
  })

  it('确认 ⇒ PATCH 恰 `{avatar_url:null}`、重拉后回到首字兜底', async () => {
    VIEW.current = viewOf({ avatar_url: '/api/media/9' })
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(resetBtn(container)).not.toBeNull())
    fireEvent.click(resetBtn(container))
    await waitFor(() => expect(confirmRow(container)).not.toBeNull())
    fireEvent.click(q(container, 'project-avatar-reset-ok'))
    await waitFor(() => expect(API.patchProject).toHaveBeenCalledTimes(1))
    const [ref, body] = API.patchProject.mock.calls[0]
    expect(String(ref)).toBe('11')
    expect(body).toEqual({ avatar_url: null })
    expect(Object.keys(body)).toEqual(['avatar_url'])
    await waitFor(() => expect(avatarImg(container)).toBeNull())
    expect(initial(container).textContent).toBe('海')
    expect(resetBtn(container)).toBeNull() // 已无头像 ⇒ 恢复默认入口自行收起
    expect(API.uploadProjectAvatar).not.toHaveBeenCalled()
  })

  it('恢复默认 409 ⇒ 内联提示、不重拉、头像保留（不谎报已清）', async () => {
    VIEW.current = viewOf({ avatar_url: '/api/media/9' })
    API.patchProject.mockRejectedValue(
      Object.assign(new Error('nope'), { status: 409, code: 'PROJECT_EDIT_CONFLICT' }),
    )
    const { container } = renderAt()
    await ready(container)
    await waitFor(() => expect(resetBtn(container)).not.toBeNull())
    const readsBefore = API.fetchProjectDetail.mock.calls.length
    fireEvent.click(resetBtn(container))
    await waitFor(() => expect(confirmRow(container)).not.toBeNull())
    fireEvent.click(q(container, 'project-avatar-reset-ok'))
    await waitFor(() => expect(badge(container)).not.toBeNull())
    expect(badge(container).textContent).toContain('409')
    expect(API.fetchProjectDetail.mock.calls.length).toBe(readsBefore)
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/9')
  })
})
