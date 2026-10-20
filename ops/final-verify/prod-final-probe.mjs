import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w, h] of [[1536, 1000], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const rec = { vw: w, pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 80)); });

  // 首页：卡链接为 /item/<code>
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  rec.home = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    const hrefs = cards.map((c) => (c.querySelector('a') || c).getAttribute('href') || '');
    return { cards: cards.length, hrefs: hrefs.slice(0, 3), codeStyle: hrefs.every((x) => /^\/item\/[0-9A-Za-z]{7}$/.test(x) || /^\/item\/\d+$/.test(x)), allCode: hrefs.every((x) => /^\/item\/[0-9A-Za-z]{7}$/.test(x)) };
  });
  // 点第一张卡（若为 code 链接）
  const href = rec.home.hrefs[0];
  if (href) {
    await page.goto('https://0xseafood.com' + href, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(900);
    rec.detail = await page.evaluate(() => ({ url: location.pathname, hasQty: !!document.querySelector('[data-sf-m="item-input-qty"], input[type="number"]'), noIdle: !/闲置物品/.test(document.body.innerText), hasCode: /[0-9A-Za-z]{7}/.test((document.body.innerText.match(/物品编号[^\n]*/) || [''])[0]) }));
  }
  // 悬浮菜单
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  rec.menu = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.sf-fm-item, [data-sf-m^="floatmenu"]')].map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(Boolean);
    return { count: new Set(items).size, items: [...new Set(items)].slice(0, 6) };
  });
  // /wage 页
  await page.goto('https://0xseafood.com/wage', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  rec.wage = await page.evaluate(() => ({ cards: document.querySelectorAll('[data-sf-m^="wage-"]').length, text: document.body.innerText.slice(0, 160) }));
  // /campaign 页
  await page.goto('https://0xseafood.com/campaign', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  rec.campaign = await page.evaluate(() => ({ has: !!document.querySelector('[data-sf-m^="campaign"]'), text: document.body.innerText.slice(0, 120) }));
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
