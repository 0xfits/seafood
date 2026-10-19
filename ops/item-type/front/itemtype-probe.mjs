import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = 'http://localhost:5787';
const mk = (id, title, type) => ({ bID: id, name: title, points: 10, price: 10, cid: 1, stock: 1, status: 'available', statusText: '', stores_count: 1,
  seller: { uid: 1, nickname: '0x12**cd', avatar: null, credit: 'new' }, wants: 0, item_type: type, image: null, description: '' });
const browser = await chromium.launch({ executablePath: EXE });
const out = { home: null, publish: null };
// —— 首页：拦截 feed 注入 1 件包邮 + 1 件数字
{
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } });
  await ctx.route('**/api/prize/all*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [mk(901, '包邮实测商品', 'PhysicalFreeShip'), mk(902, '数字商品实测', 'Digital')] }) }));
  await ctx.route('**/api/home*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0, is_authenticated: false } }) }));
  await ctx.route('**/api/task/all*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  const page = await ctx.newPage();
  const rec = { pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 80)); });
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  rec.m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    return cards.map((c) => {
      const tag = c.querySelector('.sf-reward-ship-tag');
      const titleRow = c.querySelector('.row1-wrap-title');
      const cs = tag ? getComputedStyle(tag) : null;
      const first = titleRow?.firstElementChild;
      return {
        title: titleRow?.textContent?.trim(),
        tagPresent: !!tag,
        tagText: tag?.textContent || null,
        tagFirst: first === tag,
        bg: cs?.backgroundColor, fg: cs?.color, fs: cs?.fontSize, fw: cs?.fontWeight, radius: cs?.borderRadius,
        titleH: titleRow ? Math.round(titleRow.getBoundingClientRect().height) : null,
        cardH: Math.round(c.getBoundingClientRect().height),
      };
    });
  });
  out.home = rec;
  await ctx.close();
}
// —— 发布页（假会话）：两控件联动
{
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 } });
  await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ uID: 900001, evm: '0x0000000000000000000000000000000000090001' })); localStorage.setItem('token', 'x.y.z'); });
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url();
    if (u.includes('/api/currencies')) return r.continue();
    if (r.request().method() !== 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  const page = await ctx.newPage();
  const rec = { pageerrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  await page.goto(base + '/item/new', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  rec.initial = await page.evaluate(() => ({
    typeGroup: document.querySelectorAll('[data-sf-m="item-select-type"]').length,
    digital: document.querySelectorAll('[data-sf-m="item-input-type-digital"]').length,
    physical: document.querySelectorAll('[data-sf-m="item-input-type-physical"]').length,
    shipGroup: document.querySelectorAll('[data-sf-m="item-select-ship"]').length,
  }));
  await page.evaluate(() => document.querySelector('[data-sf-m="item-input-type-physical"]')?.click());
  await page.waitForTimeout(300);
  rec.afterPhysical = await page.evaluate(() => ({
    shipGroup: document.querySelectorAll('[data-sf-m="item-select-ship"]').length,
    free: document.querySelectorAll('[data-sf-m="item-input-ship-free"]').length,
    buyer: document.querySelectorAll('[data-sf-m="item-input-ship-buyer"]').length,
  }));
  await page.evaluate(() => document.querySelector('[data-sf-m="item-input-type-digital"]')?.click());
  await page.waitForTimeout(300);
  rec.afterDigital = await page.evaluate(() => ({ shipGroup: document.querySelectorAll('[data-sf-m="item-select-ship"]').length }));
  out.publish = rec;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
