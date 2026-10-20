/**
 * 质检脚本 03e · 双拉是否为「全站现象」还是「详情页特有」：同构建下数首页/详情页首拉请求数
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { REPO, save, ensureAccounts, dbIdentity } from './lib.mjs'

const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const DIST = path.join(REPO, 'frontend/dist')
const ORIGIN = 'http://sf.local'
const API_ORIGIN = 'http://localhost:5788'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const fx = JSON.parse(fs.readFileSync('/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa/fixtures.json', 'utf8'))
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' }
const out = { routes: [] }

const main = async () => {
  out.db = await dbIdentity()
  const { B } = await ensureAccounts()
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

  const visit = async (label, p) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.addInitScript((u) => {
      localStorage.setItem('user', JSON.stringify({ uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }))
      localStorage.setItem('token', u.token)
    }, { uID: B.uid, EVM: B.evm, token: B.token })
    const counts = {}
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      const rp = decodeURIComponent(url.pathname)
      if (rp.startsWith('/api/')) {
        counts[rp] = (counts[rp] || 0) + 1
        const resp = await route.fetch({ url: API_ORIGIN + rp + url.search })
        return route.fulfill({ response: resp })
      }
      if (url.origin !== ORIGIN) return route.abort()
      let file = path.join(DIST, rp)
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
      return route.fulfill({ status: 200, contentType: MIME[path.extname(file) || '.html'] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    const page = await context.newPage()
    await page.goto(`${ORIGIN}${p}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const rec = { label, path: p, counts, doubled: Object.entries(counts).filter(([, n]) => n > 1) }
    out.routes.push(rec)
    console.log('·', label, JSON.stringify(rec))
    await context.close()
  }

  await visit('首页', '/')
  await visit('详情页', `/item/${fx.ids.BNS}`)
  await visit('我的-发布列表', '/profile/trades/published')

  out.file = save('03e-double-fetch-scope', out)
  console.log('READING:', out.file)
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
