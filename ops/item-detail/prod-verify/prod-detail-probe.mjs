import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const out = [];
for (const [w, h] of [[390, 844], [1536, 1000]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const rec = { vw: w, pageerrors: [], consoleErrors: [], prizeReqs: 0 };
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 80)); });
  page.on('request', (r) => { if (/\/api\/prize\/\d+$/.test(r.url())) rec.prizeReqs += 1; });
  await page.goto('https://0xseafood.com/item/9', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  rec.m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const cs = (el) => el ? getComputedStyle(el) : null;
    const bar = q('[data-sf-m="item-detail-actionbar"], .sf-item-bar');
    const barKids = bar ? [...bar.querySelectorAll('button')] : [];
    const geoms = barKids.map((b) => { const r = b.getBoundingClientRect(); return { t: (b.getAttribute('data-sf-m') || b.textContent || '').trim().slice(0, 10), x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; });
    const priceEl = q('.sf-item-price-num') || q('[class*="price"]');
    return {
      title: (q('h1') || {}).textContent?.trim().slice(0, 30),
      priceColor: cs(priceEl)?.color, priceSize: cs(priceEl)?.fontSize,
      secondaryTags: [...document.querySelectorAll('.sf-reward-ship-tag, .sf-reward-auto-tag, [class*="ship-tag"], [class*="auto-tag"]')].map((e) => ({ t: e.textContent.trim(), bg: getComputedStyle(e).backgroundColor })),
      counts: (document.body.innerText.match(/\d+人想要|\d+人浏览/g) || []).slice(0, 4),
      barExists: !!bar, barFixed: bar ? getComputedStyle(bar).position : null,
      barButtons: geoms,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hasConditionTag: /全新未拆封|几乎全新|细微磕碰划痕|严重磨损/.test(document.body.innerText),
      hasPlatformTag: /平台结算/.test(document.body.innerText),
    };
  });
  out.push(rec);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
