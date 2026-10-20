import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w, h] of [[390, 844], [1536, 1000]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const rec = { vw: w, pageerrors: [] };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 100)));
  await page.goto('https://0xseafood.com/item/9', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  rec.m = await page.evaluate(() => {
    const bar = document.querySelector('[data-sf-m="item-actionbar"]');
    if (!bar) return { barExists: false };
    const cs = getComputedStyle(bar);
    const btns = [...bar.querySelectorAll('[data-sf-m="item-msg-btn"], [data-sf-m="fav-toggle"], [data-sf-m="item-buy-btn"], [data-sf-m="item-chat-btn"], button')]
      .filter((b, i, a) => a.indexOf(b) === i)
      .map((b) => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return { hook: b.getAttribute('data-sf-m') || b.textContent.trim().slice(0, 8), x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, color: s.color, display: s.display }; });
    return { barExists: true, position: cs.position, bottom: cs.bottom, barW: Math.round(bar.getBoundingClientRect().width), buttons: btns, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
