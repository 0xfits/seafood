import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w,h,theme] of [[1440,900,'light'],[1536,960,'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('theme','dark'));
  const page = await ctx.newPage();
  const rec = { vw: w, theme, pageerrors: [], consoleErrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0,120)));
  page.on('console', (m) => { if (m.type()==='error') rec.consoleErrors.push(m.text().slice(0,80)); });
  await page.goto('https://0xseafood.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  rec.m = await page.evaluate(() => {
    const H = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
    const sample = cards.slice(0, 3).map((c) => {
      const row = c.querySelector('.row3-wrap-price');
      const cur = row?.querySelector('.sf-reward-price-cur');
      const num = row?.querySelector('.sf-reward-price-num');
      const wants = row?.querySelector('.sf-reward-wants');
      const cs = (el) => el ? getComputedStyle(el) : null;
      const base = (el) => el ? el.getBoundingClientRect().bottom : null;
      return {
        rowH: H(row),
        num: { text: num?.textContent, size: cs(num)?.fontSize, weight: cs(num)?.fontWeight, color: cs(num)?.color },
        cur: { text: cur?.textContent, size: cs(cur)?.fontSize, color: cs(cur)?.color },
        wants: { text: wants?.textContent, size: cs(wants)?.fontSize, color: cs(wants)?.color },
        baselineDelta: Math.abs(Math.round((base(num) - base(wants)) * 100) / 100),
        rowJustify: cs(row)?.justifyContent,
      };
    });
    return { cards: cards.length, cardHeights: cards.map(H), sample, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
