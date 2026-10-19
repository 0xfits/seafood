import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = { at: new Date().toISOString(), arms: [] };
for (const [w, h] of [[1024, 900], [1280, 900], [1440, 900], [1536, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const rec = { vw: w, pageerrors: [], consoleErrors: [] };
  out.arms.push(rec);
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 80)); });
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  rec.m = await page.evaluate(() => {
    const grid = document.querySelector('[data-sf-m="feed-grid"]');
    const cards = grid ? [...grid.children] : [];
    const gcs = grid ? getComputedStyle(grid) : null;
    const cols = gcs ? gcs.gridTemplateColumns.split(' ').filter(Boolean).length : -1;
    const cont = document.querySelector('.sf-route-container') || document.querySelector('[class*=container]');
    const cr = cont ? cont.getBoundingClientRect() : null;
    return {
      gridClass: grid?.className || null,
      columns: cols,
      cards: cards.length,
      firstCardTitle: cards[0]?.innerText?.split('\n')[0]?.slice(0, 24) || null,
      firstCardHref: cards[0]?.querySelector('a')?.getAttribute('href') || null,
      containerW: cr ? Math.round(cr.width) : null,
      containerLeft: cr ? Math.round(cr.left) : null,
      maxW: getComputedStyle(document.documentElement).getPropertyValue('--sf-st-shell-max-w').trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sentinel: document.querySelectorAll('[data-sf-m="feed-sentinel"]').length,
      end: document.querySelectorAll('[data-sf-m="feed-end"]').length,
    };
  });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
