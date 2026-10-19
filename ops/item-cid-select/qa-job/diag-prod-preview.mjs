// QA diagnostic · prod preview arm: why did the select disappear? dump page state.
import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');

const BASE = 'http://localhost:4188';
const API = 'http://localhost:5788';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa-job' })}.qa-probe-sig`;
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Job-Probe', nickname: 'QA-Job-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN };

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext();
await ctx.addInitScript((u) => {
  localStorage.setItem('user', JSON.stringify(u));
  localStorage.setItem('token', u.token);
}, USER);
await ctx.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  try {
    const resp = await route.fetch({ url: `${API}${url.pathname}${url.search}` });
    await route.fulfill({ response: resp });
  } catch (e) {
    await route.fulfill({ status: 502, body: 'qa-passthrough-fail' });
  }
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e?.message ?? e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(`${BASE}/task/new`, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({
    url: location.href,
    select: !!document.querySelector('[data-sf-m="jobs-select-cid"]'),
    opts: document.querySelector('[data-sf-m="jobs-select-cid"]')?.options?.length ?? null,
    rootText: (document.getElementById('root')?.innerText || '').trim().slice(0, 100).replace(/\n/g, ' / '),
  }));
  console.log(i, JSON.stringify(st));
}
console.log('errors:', JSON.stringify(errs.slice(0, 10), null, 1));
await browser.close();
