import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')
const EXE = process.env.CHROME_EXE
const AFTER = 'http://localhost:5792'
const OUT = process.env.OUT || '/Users/kevin/.hermes/profiles/zang/cache/scratch/widths.json'

const LISTING = { listing_id: 1, bID: 1, title: '闲鱼风格测试物品标题', description: '描述文字描述文字', price: 42, points: 42, stock: 6, status: 'listed', i18n_status: 'ready' }
const stub = (u) => {
  const s = String(u)
  if (/\/api\/prize\/\d+$/.test(s)) return { success: true, data: LISTING }
  if (s.includes('/api/')) return { success: true, data: [] }
  return null
}

async function ctxPage(browser, width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(([t]) => {
    localStorage.setItem('theme', t === 'day' ? 'light' : 'dark')
    localStorage.setItem('user', JSON.stringify({ uID: 7, token: 't', EVM: '0xabcdef1234', bio: 'x' }))
  }, [theme])
  const page = await ctx.newPage()
  await page.route((url) => { const u = url.toString(); return u.includes('/api/') || !u.startsWith(AFTER) }, async (route) => {
    const s = stub(route.request().url())
    if (s) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) })
    return route.abort()
  })
  return { ctx, page }
}

const PROBE = () => {
  const bar = document.querySelector('.sf-item-actionbar')
  const cta = document.querySelector('.sf-item-cta')
  const back = document.querySelector('.sf-item-back')
  const qty = document.querySelector('[data-sf-m="item-input-qty"]')
  const priceRow = document.querySelector('.sf-item-price')
  const titleEl = document.querySelector('.sf-item-title-l')
  const note = document.querySelector('.sf-item-note')
  const panel = document.querySelector('[data-sf-m="item-detail"]')
  const tabbar = document.querySelector('.sf-tabbar')
  const r = (e) => (e ? e.getBoundingClientRect() : null)
  const j = (x) => (x ? { x: +x.x.toFixed(1), y: +x.y.toFixed(1), w: +x.width.toFixed(1), h: +x.height.toFixed(1), top: +x.top.toFixed(1), bottom: +x.bottom.toFixed(1), right: +x.right.toFixed(1) } : null)
  const texts = []
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length) continue
    if (!el.getClientRects().length) continue
    const t = (el.textContent || '').trim()
    if (!t) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    texts.push({ t: t.slice(0, 40), size: parseFloat(cs.fontSize) })
  }
  const cs = (e) => (e ? getComputedStyle(e) : null)
  return {
    innerWidth: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    url: location.pathname,
    tabbar: { cls: tabbar ? tabbar.getAttribute('class') : null, display: tabbar ? getComputedStyle(tabbar).display : null },
    back: { n: document.querySelectorAll('.sf-item-back').length, href: back ? back.getAttribute('href') : null, rect: j(r(back)) },
    priceRow: { rect: j(r(priceRow)), numFont: priceRow ? cs(priceRow.querySelector('.sf-item-price-num')).fontSize : null, borderRight: j(r(priceRow)).right },
    titleFont: titleEl ? cs(titleEl).fontSize : null,
    noteText: note ? note.textContent : null,
    qtyRect: j(r(qty)),
    panelRect: j(r(panel)),
    bar: { pos: bar ? cs(bar).position : null, rect: j(r(bar)), zIndex: bar ? cs(bar).zIndex : null },
    cta: { rect: j(r(cta)), radius: cta ? cs(cta).borderRadius : null, minH: cta ? cs(cta).minHeight : null, h: cta ? +cta.getBoundingClientRect().height.toFixed(1) : null, bg: cta ? cs(cta).backgroundColor : null, text: cta ? cta.textContent : null },
    occluded: bar && qty ? qty.getBoundingClientRect().bottom > bar.getBoundingClientRect().top + 0.5 : null,
    minTextSize: texts.length ? Math.min(...texts.map((x) => x.size)) : null,
    texts,
  }
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE })
  const out = { detail: {}, negatives: {} }

  for (const w of [320, 390, 1440]) {
    for (const theme of ['day', 'night']) {
      const { ctx, page } = await ctxPage(browser, w, theme)
      await page.goto(AFTER + '/item/1', { waitUntil: 'load', timeout: 30000 })
      await page.waitForTimeout(900)
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(200)
      const p = await page.evaluate(PROBE)
      // AC-2③ / AC-5：桌面不滚到底（fixed 不适用）；跑一次点击返回箭头
      await page.evaluate(() => window.scrollTo(0, 0))
      const href = p.back.href
      let nav = null
      try {
        await page.click('.sf-item-back')
        await page.waitForTimeout(600)
        nav = await page.evaluate(() => ({
          path: location.pathname,
          tabbarDisplay: (() => { const e = document.querySelector('.sf-tabbar'); return e ? getComputedStyle(e).display : null })(),
          tabs: Array.from(document.querySelectorAll('[data-sf-region="tabbar"] a[data-sf-nav]')).map((a) => a.getAttribute('href')),
          tabbarVisible: (() => { const e = document.querySelector('.sf-tabbar'); return !!(e && e.getClientRects().length) })(),
        }))
      } catch (e) { nav = { error: String(e.message) } }
      out.detail[`${w}/${theme}`] = { ...p, backHref: href, afterClick: nav }
      await ctx.close()
    }
  }

  // ---- 判负 ≥2：三条内存变异（不动仓库） ----
  // NC1：删掉底栏 is-detail（模拟「未挂修饰类」）
  {
    const { ctx, page } = await ctxPage(browser, 390, 'day')
    await page.goto(AFTER + '/item/1', { waitUntil: 'load' }); await page.waitForTimeout(900)
    let before = await page.evaluate(() => getComputedStyle(document.querySelector('.sf-tabbar')).display)
    const mutated = await page.evaluate(() => { const e = document.querySelector('.sf-tabbar'); const had = e.classList.contains('is-detail'); e.classList.remove('is-detail'); return { had, now: getComputedStyle(e).display, visible: !!e.getClientRects().length } })
    out.negatives.NC1_remove_is_detail = { beforeDisplay: before, ...mutated }
    await ctx.close()
  }
  // NC2：.sf-item-cta 胶囊改 8px
  {
    const { ctx, page } = await ctxPage(browser, 390, 'day')
    await page.goto(AFTER + '/item/1', { waitUntil: 'load' }); await page.waitForTimeout(900)
    const base = await page.evaluate(() => getComputedStyle(document.querySelector('.sf-item-cta')).borderRadius)
    await page.addStyleTag({ content: '.sf-item-cta{border-radius:8px!important}' })
    const mut = await page.evaluate(() => getComputedStyle(document.querySelector('.sf-item-cta')).borderRadius)
    out.negatives.NC2_cta_radius_8 = { before: base, after: mut, changed: base !== mut }
    await ctx.close()
  }
  // NC3：去掉 R-D 底部内边距 ⇒ 遮挡出现
  {
    const { ctx, page } = await ctxPage(browser, 390, 'day')
    await page.goto(AFTER + '/item/1', { waitUntil: 'load' }); await page.waitForTimeout(900)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(200)
    const beforeOccl = await page.evaluate(() => {
      const b = document.querySelector('.sf-item-actionbar').getBoundingClientRect()
      const q = document.querySelector('[data-sf-m="item-input-qty"]').getBoundingClientRect()
      return { occluded: q.bottom > b.top + 0.5, qtyBottom: +q.bottom.toFixed(1), barTop: +b.top.toFixed(1) }
    })
    await page.addStyleTag({ content: '.sf-item-detail{padding-bottom:0!important}' })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(200)
    const afterOccl = await page.evaluate(() => {
      const b = document.querySelector('.sf-item-actionbar').getBoundingClientRect()
      const q = document.querySelector('[data-sf-m="item-input-qty"]').getBoundingClientRect()
      return { occluded: q.bottom > b.top + 0.5, qtyBottom: +q.bottom.toFixed(1), barTop: +b.top.toFixed(1) }
    })
    out.negatives.NC3_remove_rd_padding = { before: beforeOccl, after: afterOccl, occlusionAppeared: !beforeOccl.occluded && afterOccl.occluded }
    await ctx.close()
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
  console.log(JSON.stringify(out, null, 1))
  await browser.close()
}
main()
