import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mk = (id, title, type) => ({ bID: id, name: title, points: 10, price: 10, cid: 1, stock: 1, status: 'available', statusText: '', stores_count: 1,
  seller: { uid: 1, nickname: '0x12**cd', avatar: null, credit: 'new' }, wants: 0, item_type: type, image: null, description: '' });
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w, h, theme] of [[1536, 1000, 'light'], [1536, 1000, 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await ctx.route('**/api/prize/all*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [mk(9901, '验收商品A', 'PhysicalFreeShip'), mk(9902, '验收商品B', 'Digital'), mk(9903, '验收商品C', 'PhysicalBuyerShip')] }) }));
  await ctx.route('**/api/home*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0, is_authenticated: false } }) }));
  await ctx.route('**/api/task/all*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  const page = await ctx.newPage();
  const rec = { theme, pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 80)); });
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  rec.m = await page.evaluate(() => [...document.querySelectorAll('[data-sf-m="reward-card"]')].map((c) => {
    const tag = c.querySelector('.sf-reward-ship-tag');
    const row = c.querySelector('.row1-wrap-title');
    const cs = tag ? getComputedStyle(tag) : null;
    return { tagPresent: !!tag, tagFirstChild: row?.firstElementChild === tag, bg: cs?.backgroundColor, fg: cs?.color, fs: cs?.fontSize, radius: cs?.borderRadius,
      titleH: row ? Math.round(row.getBoundingClientRect().height) : null, cardH: Math.round(c.getBoundingClientRect().height), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }));
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
