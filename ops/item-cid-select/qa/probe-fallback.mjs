// QA (Neng) AC5 — fallback arms for GET /api/currencies: 500 / network abort / success+empty data.
// Three arms measured with playwright context.route. Positive control (real backend, 11 options) lives in
// ac1-ac2-ac4-browser-probe.json — without it "1 option" could not be distinguished from "not loaded yet".
// No business writes: all other /api/* stubbed.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa/readings';
const BASE = 'http://localhost:5787';
const EXE = '/Users/kevin/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const USER = { uid: 500, id: 500, name: 'QA-Neng', bio: 'qa', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDAsInVpZCI6NTAwfQ.c2lnbmF0dXJl' };

const arms = [
  { id: 'arm1_http500', respond: 'fulfill500' },
  { id: 'arm2_network_abort', respond: 'abort' },
  { id: 'arm3_empty_array', respond: 'empty' },
];
const results = [];
const browser = await chromium.launch({ headless: true, executablePath: EXE });

for (const arm of arms) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((u) => { localStorage.setItem('user', JSON.stringify(u)); localStorage.setItem('token', u.token); }, USER);
  const consoleErrors = [];
  const pageErrors = [];
  let currencyHits = 0;
  await ctx.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/currencies') {
      currencyHits += 1;
      if (arm.respond === 'fulfill500') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INFRA_UNAVAILABLE', message: 'QA injected 500' } }) });
      if (arm.respond === 'abort') return route.abort('failed');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Currency list (public)', data: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));
  await page.goto(`${BASE}/item/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-sf-m="item-select-cid"]', { timeout: 15000 });
  // wait until the intercepted request actually happened AND React committed
  const deadline = Date.now() + 8000;
  while (currencyHits === 0 && Date.now() < deadline) await page.waitForTimeout(100);
  await page.waitForTimeout(700);
  const snap = await page.evaluate(() => {
    const s = document.querySelector('[data-sf-m="item-select-cid"]');
    const form = document.querySelector('form');
    const btn = form ? form.querySelector('button[type="submit"], button') : null;
    const root = document.getElementById('root');
    return {
      selectCount: document.querySelectorAll('[data-sf-m="item-select-cid"]').length,
      legacyInputCount: document.querySelectorAll('[data-sf-m="item-input-cid"]').length,
      optionCount: s ? s.options.length : null,
      optionValues: s ? [...s.options].map((o) => o.value) : null,
      optionTexts: s ? [...s.options].map((o) => o.textContent) : null,
      selectedValue: s ? s.value : null,
      submitPresent: Boolean(btn),
      submitDisabled: btn ? btn.disabled : null,
      formPresent: Boolean(form),
      rootChildCount: root ? root.children.length : -1,
      emptyStateText: document.body.innerText.includes('请先登录') ? 'please-login' : 'form',
    };
  });
  results.push({
    arm: arm.id,
    injected_response: arm.respond,
    request_hits_observed: currencyHits,
    ...snap,
    console_errors: { total: consoleErrors.length, unique: [...new Set(consoleErrors)].slice(0, 5) },
    page_errors: { total: pageErrors.length, list: pageErrors.slice(0, 5) },
    expect: { optionCount: 1, optionValues: ['1'], optionTexts: ['$'], submitDisabled: false },
    verdict: (snap.optionCount === 1 && JSON.stringify(snap.optionValues) === '["1"]' && snap.submitDisabled === false && snap.formPresent && pageErrors.length === 0) ? 'PASS' : 'FAIL',
  });
  await ctx.close();
}
await browser.close();
const out = { ac: 'AC5', at: new Date().toISOString(), positive_control_ref: 'ac1-ac2-ac4-browser-probe.json (real backend: 11 options)', arms: results, all_pass: results.every((r) => r.verdict === 'PASS') };
fs.writeFileSync(`${OUT}/ac5-fallback-arms.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
