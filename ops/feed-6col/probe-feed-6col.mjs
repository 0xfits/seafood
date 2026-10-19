/**
 * JING-SPEC-FEED-6COL · 真浏览器读数（2026-10-19）
 * ---------------------------------------------------------------------------
 * 目标：首页商品网格列数 / 容器宽 / 单卡宽 / 溢出，五档 × 日两档。
 *   档位：390（手机 token）/ 1024（4 列）/ 1440（4 列 <1280? 否 —— 见下）/ 1536（6 列）/ 1920（6 列）
 *   ★ 1440 ≥ 1280 ⇒ 期望 6 列；4 列档由 1024 取证。
 * 验证面：
 *   ① feed 网格计算列数（grid-template-columns 的轨道数）
 *   ② .sf-route-container 计算 max-width（≤767 应满宽）
 *   ③ 单卡宽 + 卡内标题/价格 scrollWidth<=clientWidth、标题行高稳定
 *   ④ document.scrollWidth == clientWidth（无横向溢出）
 * 栈：真 vite dev(5787, 反代 /api → 5788) + 真 dev 后端(5788)；不拦截任何请求。
 * 用法：node ops/feed-6col/probe-feed-6col.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')

const BASE = 'http://localhost:5787'
const OUT_DIR = path.join(REPO, 'ops/feed-6col/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'vp390', width: 390, height: 844 },
  { name: 'vp1024', width: 1024, height: 800 },
  { name: 'vp1440', width: 1440, height: 900 },
  { name: 'vp1536', width: 1536, height: 900 },
  { name: 'vp1920', width: 1920, height: 1080 },
]
const THEMES = ['light', 'dark']

const readGrid = () =>
  (() => {
    const grid = document.querySelector('[data-sf-m="feed-grid"]')
    if (!grid) return { found: false }
    const cs = getComputedStyle(grid)
    const tracks = cs.gridTemplateColumns.split(' ').filter(Boolean)
    const cards = [...document.querySelectorAll('[data-sf-m="feed-grid"] [data-sf-m="reward-card"]')]
    const first = cards[0] ? cards[0].getBoundingClientRect() : null
    const container = document.querySelector('.sf-route-container')
    const ccs = container ? getComputedStyle(container) : null
    const cRect = container ? container.getBoundingClientRect() : null

    const perCard = cards.slice(0, 12).map((card, i) => {
      const title = card.querySelector('h3')
      const price = card.querySelector('.sf-reward-price')
      const tRect = title ? title.getBoundingClientRect() : null
      const tcs = title ? getComputedStyle(title) : null
      return {
        i,
        cardW: +card.getBoundingClientRect().width.toFixed(2),
        cardOverflowX: card.scrollWidth - card.clientWidth,
        titleOverflowX: title ? title.scrollWidth - title.clientWidth : null,
        titleH: tRect ? +tRect.height.toFixed(2) : null,
        titleLineH: tcs ? tcs.lineHeight : null,
        titleText: title ? title.textContent.trim().slice(0, 24) : null,
        priceOverflowX: price ? price.scrollWidth - price.clientWidth : null,
      }
    })

    return {
      found: true,
      className: grid.className,
      hook: grid.getAttribute('data-sf-m'),
      cols: tracks.length,
      gridTemplateColumns: cs.gridTemplateColumns,
      columnGap: cs.columnGap,
      display: cs.display,
      gridW: +grid.getBoundingClientRect().width.toFixed(2),
      cardCount: cards.length,
      firstCardW: first ? +first.width.toFixed(2) : null,
      container: container
        ? {
            maxWidth: ccs.maxWidth,
            width: +cRect.width.toFixed(2),
            padL: ccs.paddingLeft,
            padR: ccs.paddingRight,
          }
        : null,
      doc: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
      perCard,
    }
  })()

const run = async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const out = { base: BASE, at: new Date().toISOString(), rows: [] }

  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: 'reduce',
      })
      await context.addInitScript((t) => {
        window.localStorage.setItem('theme', t)
      }, theme)
      const page = await context.newPage()
      const pageErrors = []
      const consoleErrors = []
      page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text())
      })
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 30000 })
      await page.waitForTimeout(600)
      const data = await page.evaluate(readGrid)
      const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      out.rows.push({ theme, themeAttr: htmlTheme, vp: vp.name, width: vp.width, ...data, pageErrors, consoleErrors })
      console.log(
        `${theme} ${vp.name}(${vp.width}) cols=${data.cols} cardW=${data.firstCardW} gridW=${data.gridW} maxW=${data.container && data.container.maxWidth} containerW=${data.container && data.container.width} docOverflow=${data.doc && data.doc.scrollWidth - data.doc.clientWidth} cards=${data.cardCount} errs=${pageErrors.length}/${consoleErrors.length}`
      )
      await context.close()
    }
  }

  const file = path.join(OUT_DIR, 'probe-feed-6col.json')
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log('WROTE', file)
  await browser.close()
}

run().catch((e) => {
  console.error('PROBE-FAILED', e)
  process.exit(1)
})
