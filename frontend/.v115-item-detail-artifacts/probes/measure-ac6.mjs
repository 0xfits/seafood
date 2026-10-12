import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')
const EXE = process.env.CHROME_EXE
const AFTER = 'http://localhost:5792'
const BEFORE = 'http://localhost:5793'
const OUT = process.env.OUT || '/Users/kevin/.hermes/profiles/zang/cache/scratch/ac6-and-elim.json'
const LISTING = { listing_id: 1, bID: 1, title: '闲鱼风格测试物品标题', description: '描述文字描述文字', price: 42, points: 42, stock: 6, status: 'listed', i18n_status: 'ready' }
const stub = (u) => { const s = String(u); if (/\/api\/prize\/\d+$/.test(s)) return { success: true, data: LISTING }; if (s.includes('/api/')) return { success: true, data: [] }; return null }

async function shot(browser, base, path, width, theme, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('theme', t === 'day' ? 'light' : 'dark')
    localStorage.setItem('user', JSON.stringify({ uID: 7, token: 't', EVM: '0xabcdef1234', bio: 'x' }))
  }, [theme])
  const page = await ctx.newPage()
  await page.route((url) => { const u = url.toString(); return u.includes('/api/') || !u.startsWith(base) }, async (route) => {
    const s = stub(route.request().url())
    if (s) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) })
    return route.abort()
  })
  await page.goto(base + path, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(900)
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  if (opts.ctf) await page.evaluate(() => { const e = document.querySelector('.sf-tabbar'); if (e) { e.classList.remove('is-detail'); e.style.setProperty('display', 'grid', 'important') } })
  await page.waitForTimeout(200)
  const rows = await page.evaluate((skipThemeIcon) => {
    const out = []
    for (const el of document.querySelectorAll('*')) {
      if (skipThemeIcon && el.closest('button[aria-label="darkMode"]')) continue
      const rs = el.getClientRects(); if (!rs.length) continue
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = rs[0]
      const cls = el.getAttribute('class') || ''
      const attrs = ['data-sf-m', 'data-sf-region', 'data-sf-nav', 'href', 'role', 'data-sf-phase'].map((a) => { const v = el.getAttribute(a); return v ? `${a}=${v}` : '' }).filter(Boolean).join(',')
      const text = el.children.length === 0 ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48) : ''
      out.push(`${el.tagName}|${cls}|${attrs}|${text}|${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`)
    }
    return out
  }, !!opts.skipThemeIcon)
  await ctx.close()
  return rows
}
const sha = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex')
const diff = (a, b) => { const sb = new Set(b); return a.filter((x) => !sb.has(x)) }

const main = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE })
  const res = { ac6: {}, elim: {} }
  // AC-6：排除主题开关图标子树（与 theme-shell-isomorphism 同一排除口径）
  for (const w of [320, 390, 1440]) {
    const day = await shot(browser, AFTER, '/item/1', w, 'day', { skipThemeIcon: true })
    const night = await shot(browser, AFTER, '/item/1', w, 'night', { skipThemeIcon: true })
    res.ac6[`${w}`] = { dayN: day.length, nightN: night.length, same: sha(JSON.stringify(day)) === sha(JSON.stringify(night)), shaDay: sha(JSON.stringify(day)).slice(0, 16), shaNight: sha(JSON.stringify(night)).slice(0, 16) }
  }
  // AC-3 反事实：列全部「被反事实消掉」的条目并分类
  for (const w of [320, 390]) {
    const b = await shot(browser, BEFORE, '/item/1', w, 'day')
    const a = await shot(browser, AFTER, '/item/1', w, 'day')
    const aCtf = await shot(browser, AFTER, '/item/1', w, 'day', { ctf: true })
    const onlyBefore = diff(b, a)
    const onlyBeforeCtf = diff(b, aCtf)
    const setCtf = new Set(onlyBeforeCtf)
    const eliminated = onlyBefore.filter((x) => !setCtf.has(x))
    const prefix = (e) => e.split('|').slice(0, 4).join('|')
    const afterPrefixes = new Set(a.map(prefix))
    const cls = eliminated.map((e) => (/sf-tab/.test(e) ? 'tabbar' : (afterPrefixes.has(prefix(e)) ? 'geometry-shift' : 'CONTENT')))
    res.elim[`${w}`] = {
      onlyBefore: onlyBefore.length, onlyBeforeCtf: onlyBeforeCtf.length, eliminated: eliminated.length,
      eliminatedByClass: cls.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {}),
      contentSurvivors: eliminated.filter((e, i) => cls[i] === 'CONTENT'),
      tabbarEntriesStillInDiff: onlyBeforeCtf.filter((x) => /sf-tab/.test(x)),
      sampleNonTabbarEliminated: eliminated.filter((e) => !/sf-tab/.test(e)).slice(0, 12),
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1))
  console.log(JSON.stringify(res, null, 1))
  await browser.close()
}
main()
