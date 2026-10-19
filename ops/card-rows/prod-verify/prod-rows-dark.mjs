import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w,h] of [[1440,900],[1536,960]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const page = await ctx.newPage();
  const rec = { vw: w, theme: 'dark', pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0,120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0,80)); });
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  rec.m = await page.evaluate(() => {
    const H = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    return {
      dataTheme: document.documentElement.getAttribute('data-theme'),
      cards: cards.length,
      heights: cards.map((c) => H(c)),
      rows: cards.map((c) => [H(c.querySelector('.row1-wrap-title')), H(c.querySelector('.row2-wrap-service')), H(c.querySelector('.row3-wrap-price')), H(c.querySelector('.row4-wrap-seller'))]),
      imgs: cards.map((c) => H(c.querySelector('.image-container'))),
    };
  });
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
