// AC7 · 回归面读数（真 dev 实例：5787 前端 + 5788 后端；零库写）
// ============================================================================
// ① `/api/currencies` = 2 行（$ / BTTC）② `/api/media/999` = 404
// ③ `/item/1` 真页面：零未捕获异常 + 零 console error + #root 有内容
// ④ 390×844 首页：零横向溢出（scrollWidth − clientWidth = 0）
// ⑤ 追加旁证：1440 真 feed 各卡高 / 四行高（与夹具相读数互校）
// 运行：node ops/card-rows/qa/probe-regressions.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../..')
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FE = 'http://localhost:5787'
const API = 'http://localhost:5788'
const OUT = path.join(HERE, 'readings/regressions.json')

const steps = []
const rec = (id, ok, actual, expected) => { steps.push({ id, ok: !!ok, actual, expected }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`, JSON.stringify(actual)) }

const main = async () => {
  // ① 币种
  const cur = await fetch(API + '/api/currencies').then((r) => r.json())
  const curRows = cur.data || []
  rec('api.currencies=2', curRows.length === 2, { rows: curRows.map((r) => `${r.cid}:${r.symbol}`) }, 2)
  rec('api.currencies.has$', curRows.some((r) => r.symbol === '$') && curRows.some((r) => r.symbol === 'BTTC'), curRows.map((r) => r.symbol), `['$','BTTC']`)

  // ② media miss
  const media = await fetch(API + '/api/media/999')
  rec('api.media999=404', media.status === 404, { status: media.status }, 404)

  const browser = await chromium.launch({ executablePath: CHROME })

  // ③ /item/1 零异常
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
    const resp = await page.goto(FE + '/item/1', { waitUntil: 'load' })
    await page.waitForSelector('#root', { timeout: 15000 })
    await page.waitForFunction(() => (document.getElementById('root')?.innerHTML || '').length > 200, { timeout: 15000 })
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const rootLen = await page.evaluate(() => document.getElementById('root').innerHTML.length)
    const itemMarkers = await page.evaluate(() => ({
      title: document.title,
      h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 30),
      favToggle: !!document.querySelector('[data-sf-m="fav-toggle"]'),
      detail: !!document.querySelector('[data-sf-region="detail"], .sf-item-detail, [data-sf-m*="item-"]'),
    }))
    rec('item1.noPageError', errors.filter((e) => e.startsWith('pageerror')).length === 0, { errors: errors.filter((e) => e.startsWith('pageerror')) }, 0)
    rec('item1.noConsoleError', errors.filter((e) => e.startsWith('console')).length === 0, { errors: errors.filter((e) => e.startsWith('console')) }, 0)
    rec('item1.rootRendered', rootLen > 200, { status: resp?.status(), rootLen, ...itemMarkers }, '>200 chars')
    await ctx.close()
  }

  // ④ 390 首页零横向溢出（+ 卡片高读数旁证）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(FE + '/', { waitUntil: 'load' })
    await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 })
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))))
    const m = await page.evaluate(() => {
      const se = document.scrollingElement
      const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')]
      const heights = cards.map((c) => Math.round(c.getBoundingClientRect().height * 100) / 100)
      const widths = cards.map((c) => Math.round(c.getBoundingClientRect().width * 100) / 100)
      const touch = cards.length ? Math.round(cards[0].getBoundingClientRect().height) : null
      const grid = document.querySelector('.sf-feed, .sf-grid')
      return {
        overflow: Math.round((se.scrollWidth - se.clientWidth) * 100) / 100,
        cards: cards.length,
        cardHeights: [...new Set(heights)],
        cardWidths: [...new Set(widths)],
        cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : null,
        cardHeight: touch,
      }
    })
    rec('mobile390.noHOverflow', m.overflow === 0, m, 'scrollWidth − clientWidth = 0')
    rec('mobile390.noPageError', errors.length === 0, { errors }, 0)
    rec('mobile390.cardsPresent', m.cards > 0, { cards: m.cards, cols: m.cols }, '>0')
    rec('mobile390.cardH392', m.cardHeights.length === 1 && m.cardHeights[0] === 392, { heights: m.cardHeights, widths: m.cardWidths }, [392])

    // ⑤ 1440 真 feed 旁证
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const p2 = await ctx2.newPage()
    await p2.goto(FE + '/', { waitUntil: 'load' })
    await p2.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 })
    await p2.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))))
    const real = await p2.evaluate(() => [...document.querySelectorAll('[data-sf-m="reward-card"]')].map((root) => {
      const rowH = ['row1-wrap-title', 'row2-wrap-service', 'row3-wrap-price', 'row4-wrap-seller']
        .map((c) => Math.round(root.querySelector('.' + c).getBoundingClientRect().height))
      return {
        h: Math.round(root.getBoundingClientRect().height * 100) / 100,
        rows: rowH,
        img: Math.round(root.querySelector('.image-container').getBoundingClientRect().height * 100) / 100,
        // 注：flex 子项会被 blockify ⇒ innerText 在 `$` / 数字间插换行；价格形态用 textContent + 几何邻接判
        priceText: (root.querySelector('.row3-wrap-price')?.textContent || '').replace(/\s+/g, ''),
        wantsText: (root.querySelector('[data-sf-m="reward-card-wants"]')?.textContent || '').trim(),
        curNumGap: (() => { const c = root.querySelector('.sf-reward-price-cur'); const n = root.querySelector('.sf-reward-price-num'); return c && n ? Math.round((n.getBoundingClientRect().left - c.getBoundingClientRect().right) * 100) / 100 : null })(),
      }
    }))
    const allOk = real.length > 0 && real.every((r) => r.h === 392 && r.img === 240 && JSON.stringify(r.rows) === JSON.stringify([48, 32, 24, 48]))
    rec('realFeed1440.geometry', allOk, { cards: real.length, sample: real.slice(0, 3), distinctHeights: [...new Set(real.map((r) => r.h))] }, '全部 392 / 240 / 48·32·24·48')
    const priceOk = real.length > 0 && real.every((r) => /^\$\d+\d+人想要$/.test(r.priceText) && /^\d+人想要$/.test(r.wantsText) && r.curNumGap !== null && Math.abs(r.curNumGap) <= 1)
    rec('realFeed1440.priceRow', priceOk, { sample: real.slice(0, 3).map((r) => ({ text: r.priceText, wants: r.wantsText, gap: r.curNumGap })) }, '`$`+数字紧贴（gap≤1）+ `^\\d+人想要$`')
    await ctx.close(); await ctx2.close()
  }

  await browser.close()
  const ok = steps.every((s) => s.ok)
  fs.writeFileSync(OUT, JSON.stringify({ finished: new Date().toISOString(), fe: FE, api: API, steps, ok }, null, 2))
  console.log('SUMMARY', JSON.stringify({ ok, failed: steps.filter((s) => !s.ok).map((s) => s.id) }))
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); fs.writeFileSync(OUT, JSON.stringify({ error: String(e && e.stack || e) }, null, 2)); process.exit(2) })
