import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mk = (id, t, type) => ({ bID: id, name: t, points: 10, price: 10, cid: 1, stock: 1, status: 'available', statusText: '', stores_count: 1,
  seller: { uid: 1, nickname: '0x12**cd', avatar: null, credit: 'new' }, wants: 0, item_type: type, image: null, description: '' });
const rows = [mk(9801, '商品A', 'PhysicalFreeShip'), mk(9802, '商品B', 'DigitalAutoDeliver'), mk(9803, '商品C', 'DigitalManualDeliver'), mk(9804, '商品D', 'PhysicalBuyerShip'), mk(9805, '商品E', null)];
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w, h, theme] of [[1536, 1000, 'light'], [1536, 1000, 'dark'], [390, 844, 'light']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await ctx.route('**/api/prize/all*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: rows }) }));
  await ctx.route('**/api/home*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0, is_authenticated: false } }) }));
  await ctx.route('**/api/task/all*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  const page = await ctx.newPage();
  const rec = { vw: w, theme, pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 80)); });
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  rec.m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    const one = (el) => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, fg: cs.color, fs: cs.fontSize, fw: cs.fontWeight, r: cs.borderRadius }; };
    return {
      cards: cards.length,
      yellow: cards.filter((c) => c.querySelector('.sf-reward-ship-tag')).length,
      green: cards.filter((c) => c.querySelector('.sf-reward-auto-tag')).length,
      detail: cards.map((c) => {
        const row = c.querySelector('.row1-wrap-title');
        const y = c.querySelector('.sf-reward-ship-tag'), g = c.querySelector('.sf-reward-auto-tag');
        const tag = y || g;
        return { tag: y ? 'yellow' : g ? 'green' : 'none', first: tag ? row?.firstElementChild === tag : null,
          style: tag ? one(tag) : null, titleH: row ? Math.round(row.getBoundingClientRect().height) : null, cardH: Math.round(c.getBoundingClientRect().height) };
      }),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
