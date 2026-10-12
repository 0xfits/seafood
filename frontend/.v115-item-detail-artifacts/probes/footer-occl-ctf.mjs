// R-E 反事实探针（Kong 收尾单）：同一实例内对照「R-E 在 / R-E 去」。
// R-E 的去法 = 给 .sf-region-foot 打 inline padding-bottom:0（shell.css 对本元素无任何 padding 声明 ⇒ 0 == 无 R-E 的基线）。
// 读数口径同 footer-occl.mjs（footer 盒 ∩ 固定操作栏 盒 / 页脚内最后一个可见叶子）。
import { createRequire } from 'node:module'
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')
const EXE = process.env.CHROME_EXE
const AFTER = 'http://localhost:5792'
const BASE = { listing_id: 1, bID: 1, title: '闲鱼风格测试物品标题', description: '描述文字'.repeat(30), price: 42, points: 42, stock: 6, status: 'listed', i18n_status: 'ready' }

async function run(browser, w, ctf) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(() => { localStorage.setItem('theme', 'light'); localStorage.setItem('user', JSON.stringify({ uID: 7, token: 't', EVM: '0xabcdef1234', bio: 'x' })) })
  const page = await ctx.newPage()
  await page.route((url) => { const u = url.toString(); return u.includes('/api/') || !u.startsWith(AFTER) }, async (route) => {
    const s = String(route.request().url())
    if (/\/api\/prize\/\d+$/.test(s)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: BASE }) })
    if (s.includes('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
    return route.abort()
  })
  await page.goto(AFTER + '/item/1', { waitUntil: 'load' }); await page.waitForTimeout(900)
  if (ctf) await page.evaluate(() => { const f = document.querySelector('.sf-region-foot'); if (f) f.style.paddingBottom = '0px' })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(250)
  const r = await page.evaluate(() => {
    const bar = document.querySelector('.sf-item-actionbar').getBoundingClientRect()
    const foot = document.querySelector('[data-sf-region="footer"], footer, .sf-region-foot')
    const fr = foot ? foot.getBoundingClientRect() : null
    const detail = document.querySelector('.sf-item-detail').getBoundingClientRect()
    let lastLeaf = null
    if (foot) { const leaves = Array.from(foot.querySelectorAll('*')).filter((e) => !e.children.length && e.getClientRects().length); lastLeaf = leaves.length ? leaves[leaves.length - 1].getBoundingClientRect() : null }
    return {
      computedFootPadBottom: foot ? getComputedStyle(foot).paddingBottom : null,
      barTop: +bar.top.toFixed(1), barBottom: +bar.bottom.toFixed(1),
      footTop: fr ? +fr.top.toFixed(1) : null, footBottom: fr ? +fr.bottom.toFixed(1) : null,
      footCoveredPx: fr ? Math.max(0, +(Math.min(fr.bottom, bar.bottom) - Math.max(fr.top, bar.top)).toFixed(1)) : null,
      detailBottom: +detail.bottom.toFixed(1),
      detailCovered: bar.top < detail.bottom,
      lastLeafBottom: lastLeaf ? +lastLeaf.bottom.toFixed(1) : null,
      lastLeafCovered: lastLeaf ? lastLeaf.bottom > bar.top : null,
      lastLeafOverlapPx: lastLeaf ? Math.max(0, +(lastLeaf.bottom - bar.top).toFixed(1)) : null,
    }
  })
  await ctx.close(); return r
}
const main = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE })
  const out = {}
  for (const w of [320, 390, 767, 1440]) out[w] = { withRE: await run(browser, w, false), noRE_ctf: await run(browser, w, true) }
  console.log(JSON.stringify(out, null, 1))
  await browser.close()
}
main()
