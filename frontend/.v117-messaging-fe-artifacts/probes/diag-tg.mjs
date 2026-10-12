import { launch, openPage, waitQuiet, BASE } from './lib.mjs'
const b = await launch()
const { context, page } = await openPage(b, { width: 390, uID: 7 })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e?.message || e)))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + String(m.text()).slice(0, 160)) })
await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForSelector('[data-sf-m="tg-bind-card"]', { timeout: 25000 }).catch(() => {})
for (const t of [0, 500, 1500, 3000, 6000]) {
  await page.waitForTimeout(t === 0 ? 0 : 500)
  const r = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-sf-m="tg-bind-card"]')
    const st = document.querySelectorAll('[data-sf-m="tg-bind-status"]')
    return {
      cards: cards.length,
      states: Array.from(cards).map((c) => c.getAttribute('data-sf-tg-state')),
      statusEls: st.length,
      statusTexts: Array.from(st).map((e) => (e.textContent || '').trim()),
      card0Text: cards[0] ? (cards[0].innerText || '').replace(/\s+/g, ' ').slice(0, 300) : null,
      hooks: Array.from(document.querySelectorAll('[data-sf-m^="tg-"]')).map((e) => e.getAttribute('data-sf-m') + '=' + ((e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40))),
    }
  })
  console.log('T+' + t, JSON.stringify(r, null, 1))
}
console.log('ERRORS', JSON.stringify(errs, null, 1))
await context.close()
await b.close()
