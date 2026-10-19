import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const out = { at: new Date().toISOString(), pages: [] };
for (const path of ['/', '/item/1', '/item/new']) {
  const page = await ctx.newPage();
  const rec = { path, pageerrors: [], consoleErrors: [] };
  out.pages.push(rec);
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 100)); });
  await page.goto('https://0xseafood.com' + path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  rec.rootChildren = await page.evaluate(() => document.querySelector('#root')?.children.length ?? -1);
  rec.imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src')?.slice(0, 60), nw: i.naturalWidth })).filter((i) => i.src && (i.src.includes('placeholder') || i.src.includes('/api/media'))).slice(0, 4));
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
