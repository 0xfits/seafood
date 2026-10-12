import { createRequire } from 'node:module'
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')
const EXE = process.env.CHROME_EXE
const AFTER = 'http://localhost:5792'
const LISTING = { listing_id: 1, bID: 1, title: '闲鱼风格测试物品标题', description: '描述文字描述文字', price: 42, points: 42, stock: 6, status: 'listed', i18n_status: 'ready' }
const stub = (u) => { const s = String(u); if (/\/api\/prize\/\d+$/.test(s)) return { success: true, data: LISTING }; if (s.includes('/api/')) return { success: true, data: [] }; return null }
async function rows(browser, base, path, width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('theme', t === 'day' ? 'light' : 'dark')
    localStorage.setItem('user', JSON.stringify({ uID: 7, token: 't', EVM: '0xabcdef1234', bio: 'x' }))
  }, [theme])
  const page = await ctx.newPage()
  await page.route((url) => { const u = url.toString(); return u.includes('/api/') || !u.startsWith(base) }, async (route) => {
    const s = stub(route.request().url()); if (s) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) }); return route.abort()
  })
  await page.goto(base + path, { waitUntil: 'load' }); await page.waitForTimeout(900)
  const out = await page.evaluate(() => {
    const r = []
    for (const el of document.querySelectorAll('*')) {
      const rs = el.getClientRects(); if (!rs.length) continue
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const rect = rs[0]
      const cls = el.getAttribute('class') || ''
      const attrs = ['data-sf-m', 'data-sf-region', 'data-sf-nav', 'href', 'role', 'data-sf-phase', 'aria-label'].map((a) => { const v = el.getAttribute(a); return v ? `${a}=${v}` : '' }).filter(Boolean).join(',')
      const text = el.children.length === 0 ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : ''
      const owner = el.closest('button[aria-label="darkMode"], [data-sf-m="theme-toggle"], .theme-toggle')
      r.push(`${el.tagName}|${cls}|${attrs}|${text}|${rect.x.toFixed(1)},${rect.y.toFixed(1)},${rect.width.toFixed(1)},${rect.height.toFixed(1)}|owner=${owner ? owner.getAttribute('class') : ''}`)
    }
    return r
  })
  await ctx.close(); return out
}
const main = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE })
  const day = await rows(browser, AFTER, '/item/1', 1440, 'day')
  const night = await rows(browser, AFTER, '/item/1', 1440, 'night')
  const sd = new Set(day), sn = new Set(night)
  console.log('DAY_ONLY:'); day.filter((x) => !sn.has(x)).forEach((x) => console.log('  ', x))
  console.log('NIGHT_ONLY:'); night.filter((x) => !sd.has(x)).forEach((x) => console.log('  ', x))
  await browser.close()
}
main()
