/**
 * P6-I18N-LIT-B3 · 登录 / 认证 / 钱包面（`loginModal` / `authPage` / `walletAuth` / `auth.err`）文案四语化
 *                + Zang 裁定 **D3**（`common.redeemable` 独立键，不得再借 `CanClaim`）
 *
 * 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）：
 *   ① 走**真实** i18n 实例（`import '../../i18n'`）+ `i18n.changeLanguage('en')`，**不 mock** `react-i18next`；
 *   ② 语言码另有来源的页面用路由前缀（本批三文件均只读 `i18n.t`，故 `changeLanguage` 即真「en 档」）；
 *   ③ 数据面只 mock `../../auth` / `../../auth-context`；`window.ethereum` 不给 ⇒ 走「未装钱包」分支（可测）。
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../../i18n'

vi.mock('../../auth', () => ({
  updateMyProfile: vi.fn(async () => ({ uID: 1 })),
  requestAuthChallenge: vi.fn(),
  verifyAuthChallenge: vi.fn(),
  fetchApiJson: vi.fn(),
  getAuthHeaders: vi.fn(() => ({})),
  clearAuthSession: vi.fn(),
}))

// 可切换的登录态（`vi.hoisted` ⇒ 提升到 mock 工厂之前；`vi.doMock` 无法替换已静态导入的绑定）
const authState = vi.hoisted(() => ({ authenticated: false }))

vi.mock('../../auth-context', () => ({
  useAuth: () => ({
    user: { uID: 1, EVM: '0xabc', bio: '' },
    isAuthenticated: authState.authenticated,
    isProfileComplete: false,
    updateSession: (u) => u,
    setSession: (s) => s,
  }),
}))

import AuthPage from '../../pages/AuthPage'
import LoginModal from '../../components/LoginModal'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LANGS = ['zh', 'en', 'hk', 'vn']

describe('P6-I18N-LIT-B3 · en 档渲染英文文案（AuthPage / WalletAuthPanel / LoginModal）', () => {
  beforeEach(async () => {
    authState.authenticated = false
    await i18n.changeLanguage('en')
  })
  afterEach(() => { cleanup() })

  it('AuthPage（/en/login）：主标题 / 副标题 / 钱包面板 / 说明 / 侧栏链接全走英文，中文原文不出现', async () => {
    render(<MemoryRouter initialEntries={['/en/login']}><AuthPage mode="login" /></MemoryRouter>)

    // 页头（`authPage.titleLogin` / `authPage.subLogin`）
    expect(await screen.findByText('Connect your wallet to continue exploring')).toBeInTheDocument()
    expect(screen.getByText('Sign with your existing wallet to log in; we will take you back to the page you just visited.')).toBeInTheDocument()
    // 钱包面板（`walletAuth.*`）
    expect(screen.getByText('Sign in with your wallet')).toBeInTheDocument()
    expect(screen.getByText('Connect your EVM wallet and complete one signature verification to log in.')).toBeInTheDocument()
    expect(screen.getByText('No wallet connected')).toBeInTheDocument()
    expect(screen.getByText('Please connect an EVM wallet address')).toBeInTheDocument()
    expect(screen.getByText('Login only requests one signature; it never starts an on-chain transaction or spends gas.')).toBeInTheDocument()
    expect(screen.getByText('MetaMask or OKX Wallet was not detected. Install a wallet extension and refresh the page to continue.')).toBeInTheDocument()
    expect(screen.getByText('Connect wallet')).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
    // 说明卡（`authPage.note` / `noteBody` / `step1-3`）
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Wallet login only requests one offline signature; it never starts an on-chain transaction or charges gas.')).toBeInTheDocument()
    expect(screen.getByText('1. Connect an EVM wallet.')).toBeInTheDocument()
    expect(screen.getByText('2. Complete the signature verification as prompted.')).toBeInTheDocument()
    expect(screen.getByText('3. First-time users then complete their bio.')).toBeInTheDocument()
    // 侧栏（`authPage.notBoundYet` / `goRegister`）
    expect(screen.getByText("Haven't finished your first-time binding yet?")).toBeInTheDocument()
    expect(screen.getByText('Register')).toBeInTheDocument()
    // 反证：简体原文（渲染期不得出现）
    expect(screen.queryByText('连接钱包继续探索')).toBeNull()
    expect(screen.queryByText('连接钱包')).toBeNull()
    expect(screen.queryByText('钱包签名登录')).toBeNull()
  })

  it('AuthPage（/en/register，已登录未补全资料）：补全资料卡走英文', async () => {
    authState.authenticated = true
    render(<MemoryRouter initialEntries={['/en/register']}><AuthPage mode="register" /></MemoryRouter>)

    expect(await screen.findByText('Complete your bio')).toBeInTheDocument()
    expect(screen.getByText('Your wallet is verified. Once you enter a bio of at least 10 characters, we will take you back to the previous page.')).toBeInTheDocument()
    expect(screen.getByText('Already completed binding?')).toBeInTheDocument()
    expect(screen.getByText('Back to login')).toBeInTheDocument()
    expect(screen.getByText('Save and continue')).toBeInTheDocument()
    expect(screen.getByText('Bio')).toBeInTheDocument()
    expect(screen.queryByText('补全个人简介')).toBeNull()
  })

  it('LoginModal（en 档）：aria-label / 标题 / 描述 / 注册引导走英文', async () => {
    render(<MemoryRouter><LoginModal isOpen onClose={() => {}} /></MemoryRouter>)

    expect(await screen.findByText('Sign in with your wallet')).toBeInTheDocument()
    expect(screen.getByText('Sign once to finish logging in. First-time users can complete their profile afterwards.')).toBeInTheDocument()
    expect(screen.getByText('First time on Jinli Club?')).toBeInTheDocument()
    expect(screen.getByText('Complete first-time binding')).toBeInTheDocument()
    expect(screen.getByLabelText('Close login dialog')).toBeInTheDocument()
    expect(screen.queryByLabelText('关闭登录窗口')).toBeNull()
  })
})

describe('P6-I18N-LIT-B3 · Zang 裁定 D3：`common.redeemable` 独立键', () => {
  const tables = {}
  for (const lang of LANGS) tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))

  it('四语齐备 / 取值互异；en-hk-vn 不得再与 `CanClaim`（立即领取语义）同值', () => {
    const values = LANGS.map((l) => tables[l].common.redeemable)
    console.info('[B3] common.redeemable 四语读数', JSON.stringify(values))
    for (const v of values) {
      expect(typeof v).toBe('string')
      expect(v.trim().length).toBeGreaterThan(0)
    }
    expect(new Set(values).size).toBe(4)
    // zh 为源语言，与 `CanClaim` 同字面（`可兑换`）属预期；差异化在 en/hk/vn 三档
    expect(tables.en.common.redeemable).not.toBe(tables.en.CanClaim)
    expect(tables.hk.common.redeemable).not.toBe(tables.hk.CanClaim)
    expect(tables.vn.common.redeemable).not.toBe(tables.vn.CanClaim)
    // D3 硬约束：`CanClaim` 取值**不得改动**（B1/B2 面已在用）
    expect(tables.zh.CanClaim).toBe('可兑换')
    expect(tables.en.CanClaim).toBe('Claim Now')
    expect(tables.hk.CanClaim).toBe('立即領取')
    expect(tables.vn.CanClaim).toBe('Nhận ngay')
  })

  it('源码内 `t(\'CanClaim\')` 调用点 = 0，`common.redeemable` 调用点 ≥ 4（4 处改指）', () => {
    const files = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'locales' || entry.name === '__tests__') continue
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(abs); continue }
        if (/\.(js|jsx)$/.test(entry.name)) files.push(abs)
      }
    }
    walk(SRC)
    let canClaim = 0
    let redeemable = 0
    for (const abs of files) {
      const text = fs.readFileSync(abs, 'utf8')
      canClaim += (text.match(/t\(\s*['"]CanClaim['"]\s*\)/g) || []).length
      redeemable += (text.match(/t\(\s*['"]common\.redeemable['"]\s*\)/g) || []).length
    }
    console.info('[B3] D3 调用点读数', JSON.stringify({ canClaim, redeemable }))
    expect(canClaim).toBe(0)
    expect(redeemable).toBeGreaterThanOrEqual(4)
  })
})

describe('P6-I18N-LIT-B3 · 四语 locale 键集（本批新增键齐备 + 逐文件相等）', () => {
  const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
    v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )).sort()
  const NEW_KEYS = [
    'loginModal.closeLabel', 'loginModal.title', 'loginModal.description', 'loginModal.firstTime', 'loginModal.goBind',
    'authPage.bioTooShort', 'authPage.bioSaved', 'authPage.saveFailed',
    'authPage.titleLogin', 'authPage.titleRegister', 'authPage.subLogin', 'authPage.subRegister',
    'authPage.completeBio', 'authPage.completeBioHint', 'authPage.unknownAddress', 'authPage.bio',
    'authPage.bioPlaceholder', 'authPage.saving', 'authPage.saveAndContinue', 'authPage.note',
    'authPage.noteBody', 'authPage.step1', 'authPage.step2', 'authPage.step3',
    'authPage.notBoundYet', 'authPage.goRegister', 'authPage.alreadyBound', 'authPage.backToLogin',
    'walletAuth.loginTitle', 'walletAuth.loginDesc', 'walletAuth.loginAction',
    'walletAuth.registerTitle', 'walletAuth.registerDesc', 'walletAuth.registerAction',
    'walletAuth.noExtension', 'walletAuth.noAddress', 'walletAuth.connected', 'walletAuth.connectFailed',
    'walletAuth.connectFirst', 'walletAuth.noWalletInBrowser', 'walletAuth.verifiedContinue',
    'walletAuth.loginSuccess', 'walletAuth.signatureFailed', 'walletAuth.stateConnected',
    'walletAuth.stateDisconnected', 'walletAuth.connectPrompt', 'walletAuth.signNote',
    'walletAuth.noWalletNotice', 'walletAuth.processing', 'walletAuth.switchWallet',
    'walletAuth.connectWallet', 'walletAuth.verifying',
    'auth.err.REQUEST_FAILED', 'auth.err.NO_CREDENTIAL',
    'common.redeemable',
  ]

  it('新增 55 键四语齐备、非空串；四文件拍平键集逐文件相等', () => {
    const tables = {}
    const sets = {}
    const counts = {}
    for (const lang of LANGS) {
      tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
      sets[lang] = keyPaths(tables[lang])
      counts[lang] = { top: Object.keys(tables[lang]).length, flat: sets[lang].length }
    }
    console.info('[B3] locale 键数读数', JSON.stringify(counts))
    console.info('[B3] 本批新增键数', NEW_KEYS.length)

    for (const lang of LANGS.slice(1)) expect(sets[lang]).toEqual(sets.zh)
    expect(new Set(LANGS.map((l) => counts[l].flat)).size).toBe(1)
    expect(counts.zh.top).toBe(counts.en.top)

    expect(NEW_KEYS.length).toBe(55)
    for (const key of NEW_KEYS) {
      expect(sets.zh).toContain(key)
      for (const lang of LANGS) {
        const value = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), tables[lang])
        expect(typeof value).toBe('string')
        expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
