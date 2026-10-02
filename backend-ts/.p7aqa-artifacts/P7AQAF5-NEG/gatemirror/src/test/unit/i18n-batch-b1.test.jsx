/**
 * P6 · I18N-LIT-B1 · 首屏/全局骨架硬编码文案四语化（本单新增单测）
 *
 * 口径：走**真实** i18next 实例（`src/i18n.js`，jsdom 下无前缀路径 => zh 兜底），
 *   ① en 档渲染断言：HomePage / Footer 的既有硬编码中文面在 en 档下渲染英文；
 *   ② 四语 locale 文件拍平键路径集合**逐文件相等**（含本批新增 common.* / homePage.* / footer.*）。
 * 不 mock react-i18next —— 否则「四语文件是否真被读取」这条就没被验到。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../auth', () => ({
  fetchApiJson: vi.fn(async () => []),
  getAuthHeaders: vi.fn(() => ({})),
}))

vi.mock('../../auth-context', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}))

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

import HomePage from '../../pages/HomePage'
import Footer from '../../components/Footer'

const LANGS = ['zh', 'en', 'hk', 'vn']
const HERE = path.dirname(fileURLToPath(import.meta.url))
const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
)).sort()

describe('P6-I18N-LIT-B1 · en 档渲染英文文案', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(async () => {
    await i18n.changeLanguage('zh')
  })

  it('HomePage 首屏骨架（标题/小标题/按钮/空态）在 en 档渲染英文', async () => {
    render(
      <MemoryRouter initialEntries={['/en']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Welcome to Jinli Club' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Hot tasks' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Featured rewards' })).toBeInTheDocument()
    expect(screen.getAllByText('View all')).toHaveLength(2)
    expect(screen.getByText('Browse rewards')).toBeInTheDocument()
    expect(screen.getByText('No tasks available')).toBeInTheDocument()
    expect(screen.getByText('No rewards available')).toBeInTheDocument()
  })

  it('Footer 支持语言/联系文案在 en 档渲染英文，且邮箱保持字面量', () => {
    render(
      <MemoryRouter initialEntries={['/en']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Footer />
      </MemoryRouter>,
    )

    expect(screen.getByText('This website supports Simplified Chinese, English, Cantonese and Vietnamese.')).toBeInTheDocument()
    expect(screen.getByText('Contact us: contact@jinli.club')).toBeInTheDocument()
  })
})

describe('P6-I18N-LIT-B1 · 四语 locale 键集相等', () => {
  it('zh/hk/en/vn 四文件拍平键集逐文件相等，且本批新增键齐备', () => {
    const tables = {}
    for (const lang of LANGS) {
      tables[lang] = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'locales', `${lang}.json`), 'utf8'))
    }

    const zh = keyPaths(tables.zh)
    for (const lang of LANGS.slice(1)) {
      expect(keyPaths(tables[lang]), `${lang} vs zh`).toEqual(zh)
    }

    for (const key of [
      'common.viewAll',
      'common.communityPoints',
      'common.verifyingPermission',
      'common.ongoing',
      'homePage.welcome',
      'homePage.loadFailed',
      'footer.websiteLanguages',
      'footer.contact',
    ]) {
      expect(zh).toContain(key)
    }
  })
})
