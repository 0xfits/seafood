import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w,h] of [[1440,900],[1536,960]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const rec = { vw: w, pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0,120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0,80)); });
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  rec.m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    const H = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const info = cards.map((c) => ({
      h: H(c),
      img: H(c.querySelector('.image-container')),
      title: H(c.querySelector('.row1-wrap-title')),
      service: H(c.querySelector('.row2-wrap-service')),
      price: H(c.querySelector('.row3-wrap-price')),
      seller: H(c.querySelector('.row4-wrap-seller')),
      titleText: (c.querySelector('.row1-wrap-title')?.textContent || '').trim().slice(0, 40),
      titleEndsDots: (c.querySelector('.row1-wrap-title')?.textContent || '').trim().endsWith('...'),
      priceText: (c.querySelector('.row3-wrap-price')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
      gift: c.querySelectorAll('.lucide-gift').length,
    }));
    const wantsOk = [...document.querySelectorAll('.row3-wrap-price')].every((p) => /\d+\s*人想要|want it|người muốn/.test(p.textContent || ''));
    return { cards: info.length, rows: info, wantsOk, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
