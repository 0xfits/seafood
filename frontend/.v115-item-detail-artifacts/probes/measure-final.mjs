import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')
const EXE = process.env.CHROME_EXE
const AFTER = 'http://localhost:5792'
const OUT = process.env.OUT || '/Users/kevin/.hermes/profiles/zang/cache/scratch/final.json'
const BASE = { listing_id: 1, bID: 1, title: '闲鱼风格测试物品标题', description: '描述文字描述文字', price: 42, points: 42, stock: 6, status: 'listed', i18n_status: 'ready' }
let LISTING = { ...BASE }

async function open(browser, base, path, width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('theme', t === 'day' ? 'light' : 'dark')
    localStorage.setItem('user', JSON.stringify({ uID: 7, token: 't', EVM: '0xabcdef1234', bio: 'x' }))
  }, [theme])
  const page = await ctx.newPage()
  await page.route((url) => { const u = url.toString(); return u.includes('/api/') || !u.startsWith(base) }, async (route) => {
    const s = String(route.request().url())
    if (/\/api\/prize\/\d+$/.test(s)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: LISTING }) })
    if (s.includes('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    return route.abort()
  })
  await page.goto(base + path, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(900)
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  return { ctx, page }
}
const COLLECT = (skipThemeIcon) => {
  const out = []
  for (const el of document.querySelectorAll('*')) {
    if (skipThemeIcon && el.closest('svg[class*="lucide-moon"], svg[class*="lucide-sun"]')) continue
    const rs = el.getClientRects(); if (!rs.length) continue
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = rs[0]
    const cls = el.getAttribute('class') || ''
    const attrs = ['data-sf-m', 'data-sf-region', 'data-sf-nav', 'href', 'role', 'data-sf-phase'].map((a) => { const v = el.getAttribute(a); return v ? `${a}=${v}` : '' }).filter(Boolean).join(',')
    const text = el.children.length === 0 ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48) : ''
    out.push(`${el.tagName}|${cls}|${attrs}|${text}|${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`)
  }
  return out
}
const sha = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex')

const main = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE })
  const res = { ac6: {}, ac1: {}, rb: {}, nc: {}, rc_stress: {} }

  // ---- AC-6（排除既有主题开关图标子树 = theme-shell-isomorphism 的同一排除口径）----
  for (const w of [320, 390, 1440]) {
    const { ctx: c1, page: p1 } = await open(browser, AFTER, '/item/1', w, 'day')
    const day = await p1.evaluate(COLLECT, true); await c1.close()
    const { ctx: c2, page: p2 } = await open(browser, AFTER, '/item/1', w, 'night')
    const night = await p2.evaluate(COLLECT, true); await c2.close()
    res.ac6[w] = { dayN: day.length, nightN: night.length, same: sha(JSON.stringify(day)) === sha(JSON.stringify(night)), sha: sha(JSON.stringify(day)) }
  }

  // ---- AC-1（仅详情页容器 .sf-item 内的可见文本）+ R-B 圆角读数 + NC2 ----
  for (const w of [320, 390, 1440]) {
    const { ctx, page } = await open(browser, AFTER, '/item/1', w, 'day')
    const ac1 = await page.evaluate(() => {
      const root = document.querySelector('.sf-item')
      const texts = []
      for (const el of root.querySelectorAll('*')) {
        if (el.children.length) continue
        if (!el.getClientRects().length) continue
        const t = (el.textContent || '').trim(); if (!t) continue
        texts.push(t)
      }
      const cls = new Set(Array.from(root.querySelectorAll('*')).map((e) => e.getAttribute('class') || ''))
      const has = (s) => Array.from(cls).some((c) => c.includes(s))
      return {
        texts,
        classes: {
          note: has('sf-item-note'), thumb: has('sf-item-thumb'), actionbar: has('sf-item-actionbar'),
          cta: has('sf-item-cta'), back: has('sf-item-back'), price: has('sf-item-price'),
          titleL: has('sf-item-title-l'), metaGroup: has('sf-item-meta-group'),
          forbidden_seller: has('sf-item-seller'), forbidden_attr: has('sf-item-attr'),
          forbidden_promo: has('sf-item-promo'), forbidden_stats: has('sf-item-stats'),
          forbidden_priceOrig: has('sf-item-price-orig'),
        },
        removedLabelsPresent: ['刷新', '返回列表', '卖家', '品牌', '成色', '包邮', '想要', '浏览', '留言', '收藏', '聊一聊', '比市场价'].filter((s) => texts.some((t) => t.includes(s))),
      }
    })
    const rb = await page.evaluate(() => {
      const c = document.querySelector('.sf-item-cta')
      const cs = getComputedStyle(c)
      return { radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopWidth + ' ' + cs.borderTopColor, classes: c.getAttribute('class') }
    })
    // NC2：胶囊改 8px ⇒ 可辨读数变化
    await page.addStyleTag({ content: '.sf-btn.sf-item-cta{border-radius:8px!important}' })
    const nc2 = await page.evaluate(() => getComputedStyle(document.querySelector('.sf-item-cta')).borderRadius)
    res.ac1[w] = ac1
    res.rb[w] = rb
    res.nc[`NC2_cta_8px@${w}`] = { before: rb.radius, afterInjected: nc2, changed: rb.radius !== nc2 }
    await ctx.close()
  }

  // ---- NC3：长描述 + 极端价串 ⇒ R-D 遮挡判据 / R-C 320 溢出 ----
  LISTING = { ...BASE, description: '很长的描述文字。'.repeat(120), price: '123456789.99' }
  for (const w of [320, 390]) {
    const { ctx, page } = await open(browser, AFTER, '/item/1', w, 'day')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(250)
    const probe = () => {
      const bar = document.querySelector('.sf-item-actionbar').getBoundingClientRect()
      const area = document.querySelector('.sf-item-detail')
      const last = area.lastElementChild.getBoundingClientRect()
      const html = document.documentElement
      return {
        overflowX: html.scrollWidth > window.innerWidth, scrollWidth: html.scrollWidth, innerWidth: window.innerWidth,
        occluded: last.bottom > bar.top + 0.5, lastBottom: +last.bottom.toFixed(1), barTop: +bar.top.toFixed(1),
        docHeight: html.scrollHeight, barHeight: +bar.height.toFixed(1),
      }
    }
    const withPad = await page.evaluate(probe)
    res.rc_stress[`${w}_longdesc`] = withPad
    await page.addStyleTag({ content: '.sf-item-detail{padding-bottom:0!important}' })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(250)
    const noPad = await page.evaluate(probe)
    res.nc[`NC3_remove_rd_padding@${w}`] = { withPadding: withPad, withoutPadding: noPad, occlusionAppeared: !withPad.occluded && noPad.occluded }
    await ctx.close()
  }
  LISTING = { ...BASE }

  // ---- NC1：删掉底栏 is-detail ----
  {
    const { ctx, page } = await open(browser, AFTER, '/item/1', 390, 'day')
    const r = await page.evaluate(() => {
      const e = document.querySelector('.sf-tabbar')
      const before = getComputedStyle(e).display
      e.classList.remove('is-detail')
      return { beforeDisplay: before, afterDisplay: getComputedStyle(e).display, tabbarVisible: !!e.getClientRects().length, classNow: e.getAttribute('class') }
    })
    res.nc.NC1_remove_is_detail = { ...r, verdict: r.beforeDisplay === 'none' && r.afterDisplay !== 'none' && r.tabbarVisible }
    await ctx.close()
  }

  fs.writeFileSync(OUT, JSON.stringify(res, null, 1))
  console.log(JSON.stringify(res, null, 1))
  await browser.close()
}
main()
