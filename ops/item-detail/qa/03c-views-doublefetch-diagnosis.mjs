/**
 * 质检脚本 03c · views +2 归因诊断（DOM 挂载数 / 请求数 / 两条路由挂载形态）
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
const out = { listing: ID, runs: [] }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' }

const main = async () => {
  out.db = await dbIdentity()
  const { B } = await ensureAccounts()
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

  const runOnce = async (label, pathname, { strictCheck = true } = {}) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.addInitScript((u) => {
      localStorage.setItem('user', JSON.stringify({ uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }))
      localStorage.setItem('token', u.token)
    }, { uID: B.uid, EVM: B.evm, token: B.token })
    const hits = []
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      const p = decodeURIComponent(url.pathname)
      if (p.startsWith('/api/')) {
        if (p === `/api/prize/${ID}`) hits.push({ at: Date.now(), url: url.pathname + url.search })
        const resp = await route.fetch({ url: API_ORIGIN + p + url.search })
        return route.fulfill({ response: resp })
      }
      if (url.origin !== ORIGIN) return route.abort()
      let file = path.join(DIST, p)
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
      return route.fulfill({ status: 200, contentType: MIME[path.extname(file) || '.html'] || 'application/octet-stream', body: fs.readFileSync(file) })
    })
    const page = await context.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e?.message || e)))
    const v0 = Number((await dbRow(ID)).view_count)
    await page.goto(`${ORIGIN}${pathname}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(document.querySelector('[data-sf-m="item-detail-views"]')), null, { timeout: 15000 })
    await page.waitForTimeout(2000)
    const dom = await page.evaluate(() => ({
      layouts: document.querySelectorAll('[data-sf-m="item-detail-layout"]').length,
      buyForms: document.querySelectorAll('[data-sf-m="item-buy-form"]').length,
      roots: document.querySelectorAll('#root > *').length,
      viewsNodes: [...document.querySelectorAll('[data-sf-m="item-detail-views"]')].map((e) => ({ text: e.textContent, display: getComputedStyle(e).display, slot: e.parentElement?.dataset?.sfSlot ?? null })),
      counts: document.querySelectorAll('[data-sf-m="item-detail-counts"]').length,
      reactRootMarkers: Object.keys(document.querySelector('#root') || {}).filter((k) => k.startsWith('__react')),
    }))
    const v1 = Number((await dbRow(ID)).view_count)
    const rec = { label, pathname, requests: hits.length, hitTimesMs: hits.map((h, i) => (i === 0 ? 0 : h.at - hits[0].at)), db_delta: v1 - v0, dom, pageErrors: errs }
    out.runs.push(rec)
    console.log('·', label, JSON.stringify(rec).slice(0, 600))
    await context.close()
    return rec
  }

  await runOnce('路由 /item/<id>', `/item/${ID}`)
  await runOnce('兼容形态 /item?id=<id>', `/item?id=${ID}`)
  await runOnce('同页二次（reload 由新 context 模拟）', `/item/${ID}`)

  out.file = save('03c-views-doublefetch-diagnosis', out)
  console.log('READING:', out.file)
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
