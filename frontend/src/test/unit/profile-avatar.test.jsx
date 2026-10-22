/**
 * 用户头像写口单测（Kevin 2026-10-22：`/profile/settings` 换头像 / 恢复默认）
 *
 * 覆盖面（逐条对齐派单验证项）：
 *   ① 无图 ⇒ 首字兜底（`data-sf-avatar="initial"` + `--sf-thumb-N` 档位 + 真 `<button>` 相机钮
 *      带 `aria-label`、隐藏 `input[type=file][accept=image/*]`）；
 *   ② 有图 ⇒ `<img src>`（不再渲首字，且此时才出现【恢复默认】）；
 *   ③ 上传流水线：压缩（共享 `src/image-compress.js`）⇒ `POST /api/media` ⇒
 *      `POST /api/user/profile`，**两次网络调用的载荷恰两形** —— 媒体口
 *      `{content_type,data_base64}`、写口 `{avatar_url:'/api/media/<id>'}`（**无 `bio`**，
 *      故不改简介、不入译文队列），成功后 `onChanged(payload)` 静默刷会话、零成功弹窗；
 *   ④ 拦截面**零上传**：压缩后仍超 1MiB（`compressImage` 返 `null`）⇒ 超限文案、零上传零写；
 *   ⑤ 写口失败内联：400 `AVATAR_URL_INVALID` ⇒ 行内提示可见 + `data-sf-err-code/reason/status`
 *      取证字段齐备，头像不改判（仍显旧 `<img>`）；
 *   ⑥ 恢复默认：行内二次确认（未确认**零写**、取消即收），确认后载荷恰 `{avatar_url:null}`。
 *
 * 注：压缩实现本身的行为（质量档 × 边长档降级、WebP 回落 JPEG、1MiB 顶）由
 *     `publish-item-image.test.jsx` 钉死；本单只断言**消费契约**。i18n 文案复用既有
 *     `project.avatar*` 五键（本单零键集变更）⇒ 此处用 `zh.json` 真表直打。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

const makeT = (table) => (key, vars) => {
  const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), table)
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])))
}
const t = makeT(zh)

// 压缩 = 共享模块（真实现留在发布页单测里钉）；这里只摆三种回包：成功 / 超限 null / 抛异常
const COMPRESS = vi.hoisted(() => ({ compressImage: vi.fn() }))
vi.mock('../../image-compress', () => ({ compressImage: COMPRESS.compressImage }))

// 媒体口：与项目头像同一个 `uploadMedia`（`pages/item/item-api`）
const MEDIA = vi.hoisted(() => ({ uploadMedia: vi.fn() }))
vi.mock('../../pages/item/item-api', () => ({ uploadMedia: MEDIA.uploadMedia }))

// 写口：`updateMyProfile`（`auth.js` ⇒ `POST /api/user/profile`）
const AUTH_API = vi.hoisted(() => ({ updateMyProfile: vi.fn() }))
vi.mock('../../auth', () => ({ updateMyProfile: AUTH_API.updateMyProfile }))

import ProfileAvatarEditor from '../../components/ProfileAvatarEditor'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CSS = fs.readFileSync(path.join(SRC, 'pages/profile.css'), 'utf8')

const q = (c, name) => c.querySelector(`[data-sf-m="${name}"]`)
const avatar = (c) => q(c, 'profile-avatar')
const avatarImg = (c) => q(c, 'profile-avatar-img')
const initial = (c) => q(c, 'profile-avatar-initial')
const changeBtn = (c) => q(c, 'profile-avatar-change')
const fileInput = (c) => q(c, 'profile-avatar-input')
const resetBtn = (c) => q(c, 'profile-avatar-reset')
const confirmRow = (c) => q(c, 'profile-avatar-reset-confirm')
const confirmOk = (c) => q(c, 'profile-avatar-reset-ok')
const confirmCancel = (c) => q(c, 'profile-avatar-reset-cancel')
const notice = (c) => q(c, 'profile-avatar-notice')

const EVM = '0x7Ab3C4d5E6f708192A3b4C5d6E7f8091A2b3C4d5'
const USER = { uID: 7, EVM, bio: '老简介', avatar_url: null }

const renderEditor = (userPatch = {}, onChanged = vi.fn()) => {
  const user = { ...USER, ...userPatch }
  const view = render(<ProfileAvatarEditor user={user} t={t} onChanged={onChanged} />)
  return { ...view, onChanged, user }
}

const imageFile = (name = 'me.png', type = 'image/png') => new File(['fake-bytes'], name, { type })
const pickFile = (c, file = imageFile()) => fireEvent.change(fileInput(c), { target: { files: [file] } })

beforeEach(() => {
  vi.clearAllMocks()
  COMPRESS.compressImage.mockResolvedValue({
    contentType: 'image/webp',
    dataBase64: 'QUJD',
    preview: 'data:image/webp;base64,QUJD',
  })
  MEDIA.uploadMedia.mockResolvedValue({ media_id: 1230 })
  AUTH_API.updateMyProfile.mockResolvedValue({ ...USER, avatar_url: '/api/media/1230' })
})

afterEach(() => cleanup())

describe('用户头像区 · 兜底形态与入口', () => {
  it('无图 ⇒ 渲地址首字 + 十档彩底，不渲 <img>；相机钮是真 button 且带可读 aria-label', () => {
    const { container } = renderEditor()
    expect(avatarImg(container)).toBeNull()
    const node = initial(container)
    expect(node).not.toBeNull()
    // 首字 = 地址去掉 `0x` 后的第一个码点（每位用户不同）
    expect(node.textContent).toBe('7')
    // 档位由 `avatarToneOf(地址)` 派生（真函数现算，不硬编）
    const expected = (() => {
      let sum = 0
      for (let i = 0; i < EVM.length; i += 1) sum += EVM.charCodeAt(i)
      return (sum % 10) + 1
    })()
    expect(avatar(container).getAttribute('data-sf-avatar')).toBe('initial')
    expect(avatar(container).getAttribute('data-sf-tone')).toBe(String(expected))

    const btn = changeBtn(container)
    expect(btn).not.toBeNull()
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.getAttribute('aria-label')).toBe(zh.project.avatarChange)

    const input = fileInput(container)
    expect(input).not.toBeNull()
    expect(input.getAttribute('type')).toBe('file')
    expect(input.getAttribute('accept')).toBe('image/*')

    // 无图 ⇒ 不出现【恢复默认】（没有可恢复的头像）
    expect(resetBtn(container)).toBeNull()
  })

  it('有图 ⇒ 渲 <img src>、不渲首字，并出现【恢复默认】', () => {
    const { container } = renderEditor({ avatar_url: '/api/media/999' })
    expect(initial(container)).toBeNull()
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/999')
    expect(avatar(container).getAttribute('data-sf-avatar')).toBe('img')
    expect(resetBtn(container)).not.toBeNull()
  })

  it('CSS 几何：64px 圆形 + 28px 相机钮（≥24 触控下限），且零新色值（只消费既有 token）', () => {
    expect(/--sf-l-prof-avatar-size:\s*64px/.test(CSS)).toBe(true)
    expect(/--sf-l-prof-avatar-btn:\s*28px/.test(CSS)).toBe(true)
    expect(/\.sf-prof-avatar\s*\{[^}]*border-radius:\s*50%/.test(CSS)).toBe(true)
    // 彩底十档全部指向既有 `--sf-thumb-N`（未新增色值字面量）
    for (let i = 1; i <= 10; i += 1) {
      expect(CSS.includes(`.sf-prof-avatar[data-sf-tone="${i}"] { background: var(--sf-thumb-${i}); }`)).toBe(true)
    }
    // 头像块内不得出现裸 hex 色值（`#rrggbb`）—— 颜色一律走 token
    const blockStart = CSS.indexOf('.sf-prof-avatar-block {')
    const block = CSS.slice(blockStart)
    expect(/#[0-9a-fA-F]{3,8}\b/.test(block)).toBe(false)
  })
})

describe('用户头像区 · 上传流水线（两次调用、载荷恰两形）', () => {
  it('选图 ⇒ 压缩 ⇒ POST /api/media ⇒ POST /api/user/profile {avatar_url}（无 bio）⇒ onChanged', async () => {
    const { container, onChanged } = renderEditor()
    pickFile(container)

    await waitFor(() => expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(1))

    // 第一次调用 = 媒体口，载荷恰两形（content_type / data_base64）
    expect(MEDIA.uploadMedia).toHaveBeenCalledTimes(1)
    const [mediaUser, mediaPayload] = MEDIA.uploadMedia.mock.calls[0]
    expect(mediaUser.uID).toBe(7)
    expect(Object.keys(mediaPayload).sort()).toEqual(['content_type', 'data_base64'])
    expect(mediaPayload.content_type).toBe('image/webp')
    expect(mediaPayload.data_base64).toBe('QUJD')

    // 第二次调用 = 写口，载荷恰 `{avatar_url:'/api/media/1230'}`（**不得带 bio**）
    const [profilePayload, profileUser] = AUTH_API.updateMyProfile.mock.calls[0]
    expect(Object.keys(profilePayload)).toEqual(['avatar_url'])
    expect(profilePayload).toEqual({ avatar_url: '/api/media/1230' })
    expect(profileUser.uID).toBe(7)

    // 成功后静默刷会话（父层拿回执 updateSession），无成功弹窗
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(onChanged.mock.calls[0][0].avatar_url).toBe('/api/media/1230')
    expect(notice(container)).toBeNull()
  })

  it('媒体口只回 url（老面形态）⇒ 亦能拼出 `/api/media/<id>`', async () => {
    MEDIA.uploadMedia.mockResolvedValue({ url: 'https://cdn.example/api/media/4321?x=1' })
    const { container } = renderEditor()
    pickFile(container)
    await waitFor(() => expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(1))
    expect(AUTH_API.updateMyProfile.mock.calls[0][0]).toEqual({ avatar_url: '/api/media/4321' })
  })

  it('压缩后仍 >1MiB（compressImage ⇒ null）⇒ 超限文案，零上传零写', async () => {
    COMPRESS.compressImage.mockResolvedValue(null)
    const { container, onChanged } = renderEditor()
    pickFile(container)

    await waitFor(() => expect(notice(container)).not.toBeNull())
    expect(notice(container).textContent).toContain(zh.project.avatarTooLarge)
    expect(MEDIA.uploadMedia).toHaveBeenCalledTimes(0)
    expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(0)
    expect(onChanged).toHaveBeenCalledTimes(0)
  })

  it('媒体口无 id ⇒ 上传失败文案，零写', async () => {
    MEDIA.uploadMedia.mockResolvedValue({})
    const { container } = renderEditor()
    pickFile(container)
    await waitFor(() => expect(notice(container)).not.toBeNull())
    expect(notice(container).textContent).toContain(zh.project.avatarUploadFail)
    expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(0)
  })
})

describe('用户头像区 · 失败内联与清空', () => {
  it('写口 400 AVATAR_URL_INVALID ⇒ 行内可见 + data-sf-err-* 三件，头像不改判', async () => {
    const rejected = Object.assign(new Error('avatar_url is invalid'), {
      code: 'AVATAR_URL_INVALID',
      details: { field: 'avatar_url', reason: 'AVATAR_URL_INVALID' },
      status: 400,
    })
    AUTH_API.updateMyProfile.mockRejectedValue(rejected)
    const { container, onChanged } = renderEditor({ avatar_url: '/api/media/999' })
    pickFile(container)

    await waitFor(() => expect(notice(container)).not.toBeNull())
    const node = notice(container)
    expect(node.getAttribute('role')).toBe('alert')
    expect(node.textContent).toContain(zh.project.avatarUploadFail)
    expect(node.textContent).toContain('AVATAR_URL_INVALID')
    expect(node.textContent).toContain('HTTP 400')
    expect(node.getAttribute('data-sf-err-code')).toBe('AVATAR_URL_INVALID')
    expect(node.getAttribute('data-sf-err-reason')).toBe('AVATAR_URL_INVALID')
    expect(node.getAttribute('data-sf-err-status')).toBe('400')
    // 头像不改判：仍显旧图，父层未被刷
    expect(avatarImg(container).getAttribute('src')).toBe('/api/media/999')
    expect(onChanged).toHaveBeenCalledTimes(0)
  })

  it('恢复默认：行内二次确认（未确认零写、可取消），确认后载荷恰 {avatar_url:null}', async () => {
    const { container, onChanged } = renderEditor({ avatar_url: '/api/media/999' })

    fireEvent.click(resetBtn(container))
    expect(confirmRow(container)).not.toBeNull()
    expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(0)

    // 取消 ⇒ 零写、确认行收起
    fireEvent.click(confirmCancel(container))
    expect(confirmRow(container)).toBeNull()
    expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(0)

    // 再开 ⇒ 确认
    AUTH_API.updateMyProfile.mockResolvedValue({ ...USER, avatar_url: null })
    fireEvent.click(resetBtn(container))
    fireEvent.click(confirmOk(container))

    await waitFor(() => expect(AUTH_API.updateMyProfile).toHaveBeenCalledTimes(1))
    expect(AUTH_API.updateMyProfile.mock.calls[0][0]).toEqual({ avatar_url: null })
    expect(Object.keys(AUTH_API.updateMyProfile.mock.calls[0][0])).toEqual(['avatar_url'])
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(confirmRow(container)).toBeNull()
  })
})
