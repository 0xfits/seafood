import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 1536, height: 1200 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
const reqs = []; page.on('request', (r) => { if (r.url().includes('/api/project')) reqs.push(r.url()); });
await page.goto('https://0xseafood.com/wage', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => ({
  body: document.body.innerText.slice(0, 600),
  cards: document.querySelectorAll('[data-sf-m="wage-item"], [data-sf-m^="wage-"]').length,
  hooks: [...document.querySelectorAll('[data-sf-m^="wage"]')].map((e) => e.getAttribute('data-sf-m')).slice(0, 8),
  projectNames: /Ethereum|Solana|Arbitrum|Optimism|Polygon|Sui|Aptos|Starknet|zkSync|Base/.test(document.body.innerText),
}));
console.log(JSON.stringify({ info, reqs, errs }, null, 1));
await browser.close();
