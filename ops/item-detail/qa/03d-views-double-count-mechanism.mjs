/**
 * 质检脚本 03d · views 双计机制取证：登录态 vs 游客态（同一 dist 生产构建）
 * 假设：登录态下挂载期会发**已鉴权**请求（收藏列表）⇒ 响应头 X-Session-Token ⇒ 前端 replaceAuthToken
 *       ⇒ dispatchAuthChange ⇒ AuthProvider setUser(新对象) ⇒ `load` 依赖 `user` 变 ⇒ 详情 effect 再跑一次。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { REPO, dbIdentity, save, ensureAccounts, dbRow } from './lib.mjs'

const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const DIST = path.join(REPO, 'frontend/dist')
const ORIGIN = 'http://sf.local'
const API_ORIGIN = 'http://localhost:5788'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const fx = JSON.parse(fs.readFileSync('/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa/fixtures.json', 'utf8'))
const ID = fx.ids.BNS
const out = { listing: ID, arms: [] }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' }

const main = async () => {
  out.db = await dbIdentity()
  const { B } = await ensureAccounts()
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

  const arm = async (label, loggedIn) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    if (loggedIn) {
      await context.addInitScript((u) => {
        localStorage.setItem('user', JSON.stringify({ uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }))
        localStorage.setItem('token', u.token)
      }, { uID: B.uid, EVM: B.evm, token: B.token })
    }
    const calls = []
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      const p = decodeURIComponent(url.pathname)
      if (p.startsWith('/api/')) {
        const resp = await route.fetch({ url: API_ORIGIN + p + url.search })
        const h = resp.headers()
        calls.push({
          path: p,
          auth: Boolean(route.request().headers()['authorization']),
          status: resp.status(),
          x_session_token: Boolean(h['x-session-token']),
        })
        return route.fulfill({ response: resp })
      }
      if (url.origin !== ORIGIN) return route.abort()
      let file = path.join(DIST, p)
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
      return route.fulfill({ status: 200, contentType: MIME[path.extname(file) || '.html'] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    const page = await context.newPage()
    const v0 = Number((await dbRow(ID)).view_count)
    await page.goto(`${ORIGIN}/item/${ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(document.querySelector('[data-sf-m="item-detail-views"]')), null, { timeout: 15000 })
    await page.waitForTimeout(2000)
    const v1 = Number((await dbRow(ID)).view_count)
    const detailCalls = calls.filter((c) => c.path === `/api/prize/${ID}`)
    const rec = {
      label, loggedIn,
      detail_requests: detailCalls.length, db_delta: v1 - v0,
      detail_calls: detailCalls,
      authenticated_calls: calls.filter((c) => c.auth).map((c) => c.path),
      calls_with_session_token: calls.filter((c) => c.x_session_token).map((c) => c.path),
      all_paths: calls.map((c) => c.path),
    }
    out.arms.push(rec)
    console.log('·', label, JSON.stringify(rec).slice(0, 700))
    await context.close()
  }

  await arm('游客态（无 localStorage 会话）', false)
  await arm('登录态（真 token）', true)

  out.file = save('03d-views-double-count-mechanism', out)
  console.log('READING:', out.file)
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
