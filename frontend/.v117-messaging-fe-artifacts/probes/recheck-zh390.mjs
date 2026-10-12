import { launch, openPage, gotoL, isVisible, ITEM_ID } from './lib.mjs'
const b = await launch()
const { context, page } = await openPage(b, { width: 390, uID: null })
await page.goto('http://127.0.0.1:5792/item/19', { waitUntil: 'domcontentloaded' })
// 稳健等待：等 OK 相位的操作栏出现（冷启动首次导航时 1200ms 不足）
await page.waitForSelector('[data-sf-m="item-actionbar"]', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(800)
const r = {
  actionbar: await isVisible(page, '[data-sf-m="item-actionbar"]'),
  chat: await isVisible(page, '[data-sf-m="item-chat-btn"]'),
  buy: await isVisible(page, '[data-sf-m="item-buy-btn"]'),
  chatText: await page.locator('[data-sf-m="item-chat-btn"]').textContent().catch(() => null),
  phase: await page.evaluate(() => document.querySelector('[data-sf-m="item-detail-empty"]')?.getAttribute('data-sf-phase') || null),
}
console.log('RECHECK zh@390 anon (稳健等待)', JSON.stringify(r))
await b.close()
