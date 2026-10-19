import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = 'https://0xseafood.com';
const browser = await chromium.launch({ executablePath: EXE, args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'] });
const ctx = await browser.newContext();
const out = { at: new Date().toISOString(), pages: [] };
ctx.on('pageerror', (e) => { out.pages.at(-1) && (out.pages.at(-1).pageerrors.push(String(e))); });
for (const path of ['/', '/item/new', '/task/new', '/item/1']) {
  const page = await ctx.newPage();
  const rec = { path, pageerrors: [], consoleErrors: [] };
  out.pages.push(rec);
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => rec.pageerrors.push(String(e).slice(0, 160)));
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    rec.rootChildren = await page.evaluate(() => document.querySelector('#root')?.children.length ?? -1);
    rec.rootText = (await page.evaluate(() => document.querySelector('#root')?.innerText || '')).slice(0, 80).replace(/\n/g, ' | ');
    const sel = await page.evaluate(() => ({
      itemSelect: document.querySelectorAll('[data-sf-m="item-select-cid"]').length,
      jobsSelect: document.querySelectorAll('[data-sf-m="jobs-select-cid"]').length,
      legacyItem: document.querySelectorAll('[data-sf-m="item-input-cid"]').length,
      legacyJobs: document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length,
    }));
    rec.hooks = sel;
  } catch (e) { rec.error = String(e).slice(0, 200); }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
