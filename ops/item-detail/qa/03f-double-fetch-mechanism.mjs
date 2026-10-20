/**
 * 质检脚本 03f · 详情页详情读口「两次」的机制分辨：effect 重跑 vs 组件重挂 vs 路由 replace
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
const out = {}

const main = async () => {
  out.db = await dbIdentity()
  const { B } = await ensureAccounts()
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript((u) => {
    localStorage.setItem('user', JSON.stringify({ uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }))
    localStorage.setItem('token', u.token)
    window.__qa = { layoutsAdded: 0, layoutsRemoved: 0, history: [], langChanges: [] }
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && (n.matches?.('[data-sf-m="item-detail-layout"]') || n.querySelector?.('[data-sf-m="item-detail-layout"]'))) window.__qa.layoutsAdded += 1
        }
        for (const n of m.removedNodes) {
          if (n.nodeType === 1 && (n.matches?.('[data-sf-m="item-detail-layout"]') || n.querySelector?.('[data-sf-m="item-detail-layout"]'))) window.__qa.layoutsRemoved += 1
        }
      }
    })
    document.addEventListener('DOMContentLoaded', () => obs.observe(document.getElementById('root'), { childList: true, subtree: true }))
    for (const fn of ['pushState', 'replaceState']) {
      const orig = history[fn].bind(history)
      history[fn] = (...args) => { window.__qa.history.push({ fn, url: String(args[2] ?? '') }); return orig(...args) }
    }
    document.addEventListener('i18n:lang', () => window.__qa.langChanges.push(Date.now()))
  }, { uID: B.uid, EVM: B.evm, token: B.token })

  const calls = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const p = decodeURIComponent(url.pathname)
    if (p.startsWith('/api/')) {
      if (p === `/api/prize/${fx.ids.BNS}`) calls.push({ t: Date.now(), headers: route.request().headers()['x-qa'] ?? null })
      const resp = await route.fetch({ url: API_ORIGIN + p + url.search })
      return route.fulfill({ response: resp })
    }
    if (url.origin !== ORIGIN) return route.abort()
    let file = path.join(DIST, p)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file) || '.html'] || 'application/octet-stream', body: fs.readFileSync(file) })
  })
  const page = await context.newPage()
  await page.goto(`${ORIGIN}/item/${fx.ids.BNS}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  out.qa = await page.evaluate(() => window.__qa)
  out.detailRequests = calls.length
  out.gapMs = calls.length > 1 ? calls.slice(1).map((c, i) => c.t - calls[i].t) : []
  out.file = save('03f-double-fetch-mechanism', out)
  console.log(JSON.stringify(out, null, 1).slice(0, 1500))
  console.log('READING:', out.file)
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
