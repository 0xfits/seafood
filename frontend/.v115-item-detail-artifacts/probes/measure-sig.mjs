import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const AFTER = 'http://localhost:5792'
const BEFORE = 'http://localhost:5793'
const OUT = process.env.OUT || '/Users/kevin/.hermes/profiles/zang/cache/scratch/sig.json'
const WIDTHS = [320, 390, 1440]
// 非详情页集合（AC-3）：主页 / 发布页 / 交易所 / 消息 / 个人页 + 四语前缀档
const NONDETAIL = ['/', '/en/', '/hk/', '/vn/', '/item/new', '/en/item/new', '/exchange', '/messages', '/profile']
const DETAIL = ['/item/1', '/en/item/1']

const LISTING = {
  listing_id: 1, bID: 1, title: '闲鱼风格测试物品标题', title_en: 'Item title (en)',
  description: '描述文字描述文字', price: 42, points: 42, stock: 6, status: 'listed',
  i18n_status: 'ready',
}

const stub = (url) => {
  const u = String(url)
  if (/\/api\/prize\/\d+$/.test(u)) return { ok: true, body: { success: true, data: LISTING } }
  if (u.includes('/api/prize/all')) return { ok: true, body: { success: true, data: [LISTING] } }
  if (u.includes('/api/')) return { ok: true, body: { success: true, data: [] } }
  return null
}

async function newPage(browser, base, width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 })
  await ctx.addInitScript(([t]) => {
    try {
      localStorage.setItem('theme', t === 'day' ? 'light' : 'dark')
      localStorage.setItem('user', JSON.stringify({ uID: 7, token: 't', EVM: '0xabcdef1234', bio: 'x' }))
    } catch (e) {}
  }, [theme])
  const page = await ctx.newPage()
  await page.route(
    (url) => {
      const u = url.toString()
      if (u.includes('/api/')) return true
      return !u.startsWith(base) // 外部资源（字体 / CDN）⇒ 拦下置零，保证两版读数可比
    },
    async (route) => {
      const u = route.request().url()
      const s = stub(u)
      if (s) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.body) })
      return route.abort()
    },
  )
  return { ctx, page }
}

// 结构键采集：只采**可见**元素（getClientRects().length > 0）
const COLLECT = () => {
  const rows = []
  for (const el of document.querySelectorAll('*')) {
    const rs = el.getClientRects()
    if (rs.length === 0) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = rs[0]
    const cls = el.getAttribute('class') || ''
    const attrs = ['data-sf-m', 'data-sf-region', 'data-sf-nav', 'href', 'role', 'data-sf-phase']
      .map((a) => { const v = el.getAttribute(a); return v ? `${a}=${v}` : '' }).filter(Boolean).join(',')
    const text = el.children.length === 0 ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48) : ''
    rows.push(`${el.tagName}|${cls}|${attrs}|${text}|${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`)
  }
  return rows
}

async function measure(browser, base, path, width, theme, mutate) {
  const { ctx, page } = await newPage(browser, base, width, theme)
  let rows = []
  try {
    await page.goto(base + path, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(700)
    await page.evaluate(() => (document.fonts && document.fonts.ready) || null)
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;animation-delay:0s!important;transition-delay:0s!important}' })
    await page.waitForTimeout(250)
    if (mutate) await page.evaluate(mutate)
    await page.waitForTimeout(150)
    rows = await page.evaluate(COLLECT)
  } catch (e) {
    rows = ['__ERROR__|' + String(e && e.message)]
  }
  await ctx.close()
  return rows
}

const sha = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex')

const diff = (a, b) => {
  const sa = new Set(a), sb = new Set(b)
  return { onlyA: a.filter((x) => !sb.has(x)), onlyB: b.filter((x) => !sa.has(x)) }
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXE || undefined })
  const out = { widths: WIDTHS, nondetail: {}, noise: {}, detail: {}, daynight: {} }

  // ---- AC-3 噪声基线（同版两跑） + 非详情页差异集 ----
  for (const path of NONDETAIL) {
    for (const w of WIDTHS) {
      const a1 = await measure(browser, AFTER, path, w, 'day')
      const a2 = await measure(browser, AFTER, path, w, 'day')
      const b1 = await measure(browser, BEFORE, path, w, 'day')
      const k = `${path}@${w}`
      out.noise[k] = { same: sha(JSON.stringify(a1)) === sha(JSON.stringify(a2)), n: a1.length }
      const d = diff(b1, a1)
      out.nondetail[k] = { onlyBefore: d.onlyA.length, onlyAfter: d.onlyB.length, sample: d.onlyA.slice(0, 4).concat(d.onlyB.slice(0, 4)) }
    }
  }

  // ---- 详情页：AFTER / BEFORE / 反事实（仅测量期恢复 .sf-tabbar{display:grid}）----
  for (const path of DETAIL) {
    for (const w of WIDTHS) {
      for (const theme of ['day', 'night']) {
        const a = await measure(browser, AFTER, path, w, theme)
        const b = await measure(browser, BEFORE, path, w, theme)
        const aCtf = await measure(browser, AFTER, path, w, theme, () => {
          const el = document.querySelector('.sf-tabbar')
          if (el) { el.classList.remove('is-detail'); el.style.setProperty('display', 'grid', 'important') }
        })
        const k = `${path}@${w}/${theme}`
        const d = diff(b, a)
        const dCtf = diff(b, aCtf)
        out.detail[k] = {
          beforeN: b.length, afterN: a.length,
          onlyBefore: d.onlyA.length, onlyAfter: d.onlyB.length,
          tabbarHiddenOnly: d.onlyA.filter((x) => /sf-tab|sf-tabbar/.test(x)).length,
          ctf_onlyBefore: dCtf.onlyA.length, ctf_onlyAfter: dCtf.onlyB.length,
          ctf_tabbarOnly: dCtf.onlyA.filter((x) => /sf-tab|sf-tabbar/.test(x)).length,
          eliminatedByCtf: d.onlyA.filter((x) => !new Set(dCtf.onlyA).has(x)).slice(0, 8),
          remainingAfterCtf: dCtf.onlyA.filter((x) => !/sf-tab/.test(x)).slice(0, 8),
        }
        if (theme === 'day') out.daynight[`${path}@${w}`] = { same: sha(JSON.stringify(a)) === sha(JSON.stringify(await measure(browser, AFTER, path, w, 'night'))), n: a.length }
      }
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(JSON.stringify(out, null, 1))
  await browser.close()
}
main()
