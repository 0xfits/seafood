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
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  rec.m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    return {
      cards: cards.length,
      titles: cards.map((c) => (c.querySelector('.row1-wrap-title')?.textContent || '').trim().slice(0, 24)),
      emptyTitles: cards.filter((c) => !(c.querySelector('.row1-wrap-title')?.textContent || '').trim()).length,
      cardHeights: [...new Set(cards.map((c) => Math.round(c.getBoundingClientRect().height)))],
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const id = await page.evaluate(() => document.querySelector('[data-sf-m="reward-card"] a, [data-sf-m="reward-card"]')?.getAttribute('href') || '');
  if (id) { await page.goto('https://0xseafood.com' + id, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(600); rec.detail = { title: (await page.textContent('h1')).trim().slice(0, 40), pageerrors: rec.pageerrors.length }; }
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
