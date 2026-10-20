/**
 * 质检脚本 03b · views 自增归因（+1 vs +2）+ Web 两栏读数（null-safe 重跑）
 * ---------------------------------------------------------------------------
 * 归因口径：逐条记录页面发出的 `/api/prize/<id>` 请求（URL / 状态 / 响应里的 views / 是否来自缓存），
 * 并把库内 view_count 的前后差对上「请求条数 × 每请求自增 1」。请求数 = 1 而库差 = 2 ⇒ 后端双计；
 * 请求数 = 2 ⇒ 前端双拉（再看是否 dev 双跑）。
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
const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch/item-detail-qa'
const fx = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'fixtures.json'), 'utf8'))
const ID = fx.ids.BNS
const out = { listing: ID, loads: [] }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
}
const n = (v) => Number(v)

const main = async () => {
  out.db = await dbIdentity()
  const { B } = await ensureAccounts()

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' })
  await context.addInitScript((u) => {
    const user = { uID: u.uID, EVM: u.EVM, bio: 'qa', token: u.token, access_token: u.token }
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', u.token)
  }, { uID: B.uid, EVM: B.evm, token: B.token })

  const apiHits = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const p = decodeURIComponent(url.pathname)
    if (p.startsWith('/api/')) {
      const started = Date.now()
      const resp = await route.fetch({ url: API_ORIGIN + p + url.search })
      const body = await resp.text()
      let views = null
      try { views = JSON.parse(body)?.data?.views ?? null } catch { /* ignore */ }
      if (p === `/api/prize/${ID}`) {
        apiHits.push({
          path: p, resourceType: route.request().resourceType(), status: resp.status(), views,
          cacheControl: resp.headers()['cache-control'] ?? null, ms: Date.now() - started,
          initiator: route.request().frame()?.url() ?? null,
        })
      }
      return route.fulfill({ status: resp.status(), headers: resp.headers(), body })
    }
    if (url.origin !== ORIGIN) return route.abort()
    let file = path.join(DIST, p)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file) || '.html'] || 'application/octet-stream', body: fs.readFileSync(file) })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)))

  const wait = async () => {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-sf-m="item-detail-views"]')), null, { timeout: 15000 })
    // 等「迟到的第二次取数」落地（实测页面会在首帧后再次 GET 详情）
    await page.waitForTimeout(1800)
  }
  const viewsText = async () => page.textContent('[data-sf-m="item-detail-views"]')
  const dbViews = async () => n((await dbRow(ID)).view_count)

  const oneLoad = async (label, action) => {
    const hits0 = apiHits.length
    const v0 = await dbViews()
    await action()
    await wait()
    const domText = await viewsText()
    const v1 = await dbViews()
    const rec = {
      label, db_before: v0, db_after: v1, db_delta: v1 - v0,
      api_prize_requests: apiHits.length - hits0, hits: apiHits.slice(hits0),
      dom_views_text: domText,
      attribution: (v1 - v0) === (apiHits.length - hits0) ? 'k 请求 = k 自增' : `MISMATCH 请求 ${apiHits.length - hits0} / 自增 ${v1 - v0}`,
    }
    out.loads.push(rec)
    console.log('·', label, JSON.stringify(rec).slice(0, 600))
    return rec
  }

  await oneLoad('首次冷启', () => page.goto(`${ORIGIN}/item/${ID}`, { waitUntil: 'domcontentloaded' }))
  await oneLoad('reload', () => page.reload({ waitUntil: 'domcontentloaded' }))
  await oneLoad('reload #2', () => page.reload({ waitUntil: 'domcontentloaded' }))

  // ---- Web 两栏（null-safe） ------------------------------------------------
  await page.setViewportSize({ width: 1536, height: 900 })
  await page.waitForTimeout(700)
  const web = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) } }
    const cs = (el, p) => (el ? getComputedStyle(el)[p] : null)
    const seller = q('[data-sf-m="item-detail-seller-row"]')
    const cols = q('[data-sf-m="item-detail-web-cols"]')
    const gallery = q('[data-sf-m="item-detail-gallery"]')
    const thumbs = q('[data-sf-m="item-detail-media-thumbs"]')
    const mainImg = q('.sf-item-media-main')
    const side = q('[data-sf-m="item-detail-web-side"]')
    const priceRow = q('[data-sf-m="item-detail-price-row"]')
    const countsDesk = q('[data-sf-m="item-detail-counts"][data-sf-slot="price"]')
    const countsMob = q('[data-sf-m="item-detail-counts"][data-sf-slot="tags"]')
    const group = q('.sf-item-cta-group')
    const fav = q('[data-sf-m="fav-toggle"]')
    const buy = q('[data-sf-m="item-buy-btn"]')
    const chat = q('[data-sf-m="item-chat-btn"]')
    const msg = q('[data-sf-m="item-detail-msg-btn"]')
    const bar = q('[data-sf-m="item-actionbar"]')
    return {
      present: { seller: Boolean(seller), cols: Boolean(cols), gallery: Boolean(gallery), side: Boolean(side), priceRow: Boolean(priceRow), group: Boolean(group) },
      seller: rect(seller), cols: rect(cols), gallery: rect(gallery), thumbs: rect(thumbs), main: rect(mainImg), side: rect(side), priceRow: rect(priceRow),
      thumbCount: document.querySelectorAll('[data-sf-m="item-detail-media-thumb"]').length,
      arrows: { prev: Boolean(q('[data-sf-m="item-detail-media-prev"]')), next: Boolean(q('[data-sf-m="item-detail-media-next"]')) },
      countsDesk: countsDesk ? { text: countsDesk.innerText, rect: rect(countsDesk) } : null,
      countsMobDisplay: countsMob ? cs(countsMob, 'display') : 'absent',
      group: group ? { rect: rect(group), radius: cs(group, 'borderRadius'), overflow: cs(group, 'overflow'), position: cs(group, 'position'),
        children: [...group.children].map((c) => ({ cls: String(c.className), rect: rect(c), radius: cs(c, 'borderRadius') })) } : null,
      fav: fav ? { rect: rect(fav), radius: cs(fav, 'borderRadius') } : null,
      buy: rect(buy), chat: rect(chat),
      msgDisplay: msg ? cs(msg, 'display') : 'absent',
      bar: bar ? { rect: rect(bar), position: cs(bar, 'position') } : null,
      webTitle: (() => { const t = q('.sf-item-web-title'); return t ? { text: t.innerText.slice(0, 40), visible: t.getBoundingClientRect().height > 0, weight: cs(t, 'fontWeight') } : null })(),
    }
  })
  out.web = web
  out.pageErrors = pageErrors
  out.file = save('03b-views-attribution-web', out)
  console.log('READING:', out.file)
  console.log('WEB', JSON.stringify(web).slice(0, 700))
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
