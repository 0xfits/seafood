/**
 * S19 单测（Kong）：`participants_count` 真源换轴（job_application → job_submission）的**展示面**契约
 * ============================================================================
 * 覆盖两件事：
 *   (a) 四语 `jobs.participants` **值**已改「已参与」族；**键名/键数不动**（顶层 119 / 拍平 1059）。
 *   (b) `JobDetailPage` 的 `#{tID} · <jobs.participants>` 展示**随 `participants_count` 变**。
 *
 * ★ 内建负对照（本文件必含）：把 `participants_count` 钉为**旧源代表值**（`job_application` 计数）
 *   ⇒ 「新源断言」谓词**判假**（红）；钉为新源代表值 ⇒ 判真（绿）。给红/绿两次读数。
 *   （数据源侧的红/绿 = `backend-ts/scripts/s19-participants-truth-source.ts` 开工前/改后两跑。）
 *
 * 口径：真 `job-api.js` + 真 `fetchApiJson` + stubbed `fetch`（同 s7-submissions-panel 先例）；
 *   i18n 用**真 zh 词典**（`{{count}}` 插值），逐字断言。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '../../locales/zh.json'

// i18n 替身：真 zh 词典 + `{{var}}` 插值（模块级稳定函数）
const H = vi.hoisted(() => {
  const state = { table: {} }
  state.i18n = { resolvedLanguage: 'zh', language: 'zh' }
  state.t = (key, opts) => {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.table)
    if (v === undefined) return key
    return opts ? String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')) : v
  }
  return state
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: H.t, i18n: H.i18n }) }))

const AUTH = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { uID: 7, EVM: '0xABCDEF1234567890abcdef1234567890ABCDEF12', token: 't' },
}))
vi.mock('../../auth-context', () => ({ useAuth: () => AUTH }))

import JobDetailPage from '../../pages/jobs/JobDetailPage'
import { buildLocalizedPath } from '../../utils'

const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

/** stubbed `fetch`：任务详情返回指定 `participants_count`，其余读口给空。 */
const routed = ({ count }) => vi.fn(async (url) => {
  const u = String(url)
  if (u.includes('/api/task-progress')) return jsonResponse(200, { success: true, data: [] })
  if (u.includes('/submissions')) return jsonResponse(403, { success: false, error: { code: 'AUTH_FORBIDDEN', message: 'f', details: { reason: 'NOT_ADMIN' } } })
  if (u.includes('/api/task/')) return jsonResponse(200, { success: true, data: { tID: 9, title: 'x', points: 5, participants_count: count } })
  return jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'nf' } })
})

const renderPage = () => render(
  <MemoryRouter initialEntries={['/job/9']}>
    <Routes><Route path="/job/:jobId" element={<JobDetailPage />} /></Routes>
  </MemoryRouter>,
)

const metaEl = () => document.querySelector('[data-sf-m="jobs-meta"]')

beforeEach(() => { H.table = zh })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// ============================================================================
// (a) 四语 `jobs.participants` 值 + 键数不变
// ============================================================================
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/
const readTable = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flat(readTable(l)))]))

const EXPECTED = {
  zh: '已参与 {{count}} 人',
  hk: '已參與 {{count}} 人',
  en: '{{count}} participants',
  vn: '{{count}} người tham gia',
}

describe('(a) 四语 jobs.participants 值（改值不改键）', () => {
  it('四语值逐字 = 期望（「已参与」族）', () => {
    for (const l of LANGS) expect(TABLES[l]['jobs.participants'], l).toBe(EXPECTED[l])
  })

  it('四语值均含 {{count}} 占位符', () => {
    for (const l of LANGS) expect(TABLES[l]['jobs.participants'], l).toContain('{{count}}')
  })

  it('en/vn 值零 CJK', () => {
    for (const l of ['en', 'vn']) expect(CJK.test(TABLES[l]['jobs.participants']), l).toBe(false)
  })

  it('键名/键数不变：顶层 119 / 拍平 1059 / 四语节点 4236', () => {
    for (const l of LANGS) {
      expect(Object.keys(readTable(l)).length, `${l} top`).toBe(119)
      expect(flat(readTable(l)).length, `${l} flat`).toBe(1059)
    }
    expect(flat(readTable('zh')).length * LANGS.length).toBe(4236)
  })
})

// ============================================================================
// (b) 展示面：渲染值随 participants_count 变 + 负对照
// ============================================================================
describe('(b) JobDetailPage 展示随 participants_count 变', () => {
  it('participants_count=5 ⇒ 元信息行含「已参与 5 人」', async () => {
    vi.stubGlobal('fetch', routed({ count: 5 }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(metaEl().textContent).toContain('已参与 5 人')
    expect(metaEl().textContent).toContain('#9')
  })

  it('participants_count=0 ⇒ 「已参与 0 人」（展示随值变，非常量）', async () => {
    vi.stubGlobal('fetch', routed({ count: 0 }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    expect(metaEl().textContent).toContain('已参与 0 人')
    expect(metaEl().textContent).not.toContain('已参与 5 人')
  })
})

// ============================================================================
// ★ 负对照：把数据源钉回旧表值 ⇒ 新源断言必红（自证断言对真值敏感）
// ============================================================================
describe('★ 负对照（旧源值 ⇒ 新源断言必红）', () => {
  // 代表值：新源 = `job_submission` distinct worker（如 5）；旧源 = `job_application` 计数（如 3）。
  const NEW_SOURCE_VALUE = 5
  const OLD_SOURCE_VALUE = 3
  // 「新源断言」谓词：渲染文本须含新源值对应文案
  const newSourcePredicate = (text) => String(text).includes(`已参与 ${NEW_SOURCE_VALUE} 人`)

  it('旧源值（participants_count=3）下：新源断言**判假**（红）', async () => {
    vi.stubGlobal('fetch', routed({ count: OLD_SOURCE_VALUE }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    const text = metaEl().textContent
    // 展示随值变：确实显示旧源值 3
    expect(text).toContain('已参与 3 人')
    // 若在此渲染下断言「已参与 5 人」（toContain）⇒ **必红**；故谓词必须判假
    expect(newSourcePredicate(text)).toBe(false)
  })

  it('新源值（participants_count=5）下：新源断言**判真**（绿）', async () => {
    vi.stubGlobal('fetch', routed({ count: NEW_SOURCE_VALUE }))
    renderPage()
    await waitFor(() => expect(metaEl()).not.toBeNull())
    const text = metaEl().textContent
    expect(newSourcePredicate(text)).toBe(true)
    expect(text).not.toContain('已参与 3 人')
  })
})

// ============================================================================
// (c) ProfilePage /shard → /exchange 收口（产品面链接）
// ============================================================================
const walkSrc = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name)
  if (e.isDirectory()) return e.name === 'test' ? [] : walkSrc(p)
  return /\.(jsx?|mjs)$/.test(e.name) ? [p] : []
})

describe('(c) ProfilePage /shard → /exchange 收口', () => {
  it('buildLocalizedPath(lang, \'/exchange\') 四语可解析', () => {
    expect(buildLocalizedPath('zh', '/exchange')).toBe('/exchange')
    expect(buildLocalizedPath('en', '/exchange')).toBe('/en/exchange')
    expect(buildLocalizedPath('hk', '/exchange')).toBe('/hk/exchange')
    expect(buildLocalizedPath('vn', '/exchange')).toBe('/vn/exchange')
  })

  it('ProfilePage 源：buildLocalizedPath(lang, \'/exchange\')，无 \'/shard\'', () => {
    const profile = fs.readFileSync(path.join(SRC, 'pages/ProfilePage.jsx'), 'utf8')
    expect(profile).toContain("buildLocalizedPath(lang, '/exchange')")
    expect(profile).not.toContain("buildLocalizedPath(lang, '/shard')")
  })

  it('产品面（排除 /test/）页面级 /shard 链接 = 0（/api/shard* 与注释不在本判据）', () => {
    const LINK_RE = /buildLocalizedPath\(\s*lang\s*,\s*['"]\/shard['"]\s*\)|to=\{?['"]\/shard['"]\}?|navigate\(\s*['"]\/shard['"]\s*\)/
    const hits = []
    for (const f of walkSrc(SRC)) {
      const text = fs.readFileSync(f, 'utf8')
      text.split('\n').forEach((line, i) => { if (LINK_RE.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}: ${line.trim()}`) })
    }
    expect(hits).toEqual([])
  })
})
