// QA (Neng) independent browser probe — AC1 (form shape) + AC2 (option source) + AC4 (submit payload shape).
// Own script; does not reuse ops/item-cid-select/readings/probe.json.
// Network policy: /api/currencies goes to the REAL backend (via vite proxy).
// All other /api/* are stubbed (auth noise isolation: 401 flood would be environment noise, not product defect).
// Write面 (POST /api/listing, PATCH /api/listing/:id) is intercepted & fulfilled locally => ZERO business writes.
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');

const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa/readings';
const BASE = 'http://localhost:5787';
const USER = {
  uid: 500, id: 500, user_id: 500, name: 'QA-Neng', nickname: 'QA-Neng', bio: 'qa',
  // non-expired structurally-valid JWT (payload {"exp":4102444800}) — fake token; only /api/currencies must stay live.
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQxMDI0NDQ4MDAsInVpZCI6NTAwfQ.c2lnbmF0dXJl',
};

const rec = { url: `${BASE}/item/new`, at: new Date().toISOString(), steps: {}, api: {}, console: {}, writes: [] };

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/kevin/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((u) => {
  localStorage.setItem('user', JSON.stringify(u));
  localStorage.setItem('token', u.token);
}, USER);

const consoleErrors = [];
const pageErrors = [];
const apiLog = [];
await ctx.route('**/api/**', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const method = req.method();
  if (path === '/api/currencies') {
    const resp = await route.fetch();
    const bodyText = await resp.text();
    apiLog.push({ path, method, hit: 'real-backend', status: resp.status(), bodyBytes: bodyText.length });
    await route.fulfill({ response: resp, body: bodyText });
    return;
  }
  if (method === 'POST' && path === '/api/listing') {
    rec.writes.push({ path, method, postData: req.postData(), contentType: req.headers()['content-type'] || '' });
    apiLog.push({ path, method, hit: 'stubbed-captured', status: 200 });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { listing_id: 987654 } }) });
    return;
  }
  if (method === 'PATCH' && /^\/api\/listing\/\d+$/.test(path)) {
    rec.writes.push({ path, method, postData: req.postData() });
    apiLog.push({ path, method, hit: 'stubbed-captured', status: 200 });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { listing_id: 987654, status: 'listed' } }) });
    return;
  }
  apiLog.push({ path, method, hit: 'stubbed-noise-isolation', status: 200 });
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
});

const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

await page.goto(`${BASE}/item/new`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-sf-m="item-select-cid"]', { timeout: 15000 });
await page.waitForFunction(() => {
  const s = document.querySelector('[data-sf-m="item-select-cid"]');
  return s && s.options && s.options.length > 1;
}, null, { timeout: 15000 }).catch(() => {});

rec.steps.shape = await page.evaluate(() => {
  const sel = document.querySelectorAll('select[data-sf-m="item-select-cid"]');
  const inp = document.querySelectorAll('input[data-sf-m="item-input-cid"]');
  const anyCidInput = document.querySelectorAll('[data-sf-m="item-input-cid"]');
  const field = sel[0] ? sel[0].closest('label') : null;
  const root = document.getElementById('root');
  return {
    select_itemSelectCid: sel.length,
    input_itemInputCid: inp.length,
    anyElement_with_itemInputCid_attr: anyCidInput.length,
    cidControl_tagName: sel[0] ? sel[0].tagName : null,
    cidControl_type_attr: sel[0] ? sel[0].getAttribute('type') : null,
    cidControl_role: sel[0] ? sel[0].getAttribute('role') : null,
    optionsInCidControl: sel[0] ? sel[0].options.length : null,
    inputElementsInsideCidField: field ? field.querySelectorAll('input').length : null,
    labelText: field ? field.querySelector('span')?.textContent : null,
    optionCountAllSelectsInForm: document.querySelectorAll('form select').length,
    rootChildCount: root ? root.children.length : -1,
    submitButton: (() => {
      const b = document.querySelector('form button[type="submit"], form button:not([type])');
      const btn = document.querySelector('[data-sf-m="item-submit"], form button');
      const target = b || btn;
      return target ? { text: target.textContent.trim(), disabled: target.disabled } : null;
    })(),
  };
});

rec.steps.options = await page.evaluate(() => {
  const s = document.querySelector('[data-sf-m="item-select-cid"]');
  if (!s) return null;
  return {
    count: s.options.length,
    values: [...s.options].map((o) => o.value),
    texts: [...s.options].map((o) => o.textContent),
    selectedValue: s.value,
    selectedText: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : null,
  };
});

// Negative control: can the selector distinguish select vs input? Inject a decoy input carrying the legacy
// hook, re-run the same counters (expect input count 1), then remove it and confirm back to 0.
rec.steps.negative_control = await page.evaluate(() => {
  const count = () => ({
    select_itemSelectCid: document.querySelectorAll('select[data-sf-m="item-select-cid"]').length,
    input_itemInputCid: document.querySelectorAll('input[data-sf-m="item-input-cid"]').length,
  });
  const before = count();
  const decoy = document.createElement('input');
  decoy.setAttribute('data-sf-m', 'item-input-cid');
  decoy.type = 'number';
  decoy.id = '__qa_decoy';
  document.querySelector('[data-sf-m="item-select-cid"]').closest('label').appendChild(decoy);
  const during = count();
  decoy.remove();
  const after = count();
  return { before, during, after, probe_is_sensitive: during.input_itemInputCid === before.input_itemInputCid + 1 };
});

// Selection change: pick a different cid (prefer 4 to match impl claim, else first != current).
const target = rec.steps.options && rec.steps.options.values.includes('4') ? '4' : (rec.steps.options?.values.find((v) => v !== rec.steps.options.selectedValue) ?? null);
if (target) {
  await page.selectOption('[data-sf-m="item-select-cid"]', target);
  rec.steps.change = await page.evaluate((v) => {
    const s = document.querySelector('[data-sf-m="item-select-cid"]');
    return { requested: v, domValue: s.value, domSelectedText: s.options[s.selectedIndex].textContent };
  }, target);
}

// AC4 live payload shape: fill required fields and submit; POST is intercepted (no DB write).
await page.fill('form input[data-sf-m="item-input-title"], form input[name="title"], form input[placeholder]', '').catch(() => {});
rec.steps.form_fields = await page.evaluate(() => {
  const form = document.querySelector('form');
  if (!form) return null;
  return [...form.querySelectorAll('input, textarea')].map((el) => ({
    tag: el.tagName, name: el.getAttribute('name'), hook: el.getAttribute('data-sf-m'),
    type: el.getAttribute('type'), inputMode: el.getAttribute('inputMode'), required: el.required,
  }));
});
const fields = await page.evaluate(() => {
  const form = document.querySelector('form');
  return [...form.querySelectorAll('input,textarea')].map((el, i) => ({ i, type: el.type, tag: el.tagName, name: el.name, hook: el.getAttribute('data-sf-m') }));
});
for (const f of fields) {
  if (f.tag === 'INPUT' && (f.type === 'text' || f.type === 'number' || f.type === '')) {
    await page.evaluate(({ i, val }) => {
      const els = [...document.querySelectorAll('form input,form textarea')];
      const el = els[i];
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { i: f.i, val: f.type === 'number' ? '10' : (f.hook?.includes('price') ? '5' : 'QA probe item') });
  }
}
await page.click('form button[type="submit"]').catch(async () => { await page.click('form button'); });
await page.waitForTimeout(1200);

rec.api.log = apiLog;
rec.api.writes = rec.writes;
rec.steps.submit_payload = rec.writes.find((w) => w.method === 'POST' && w.path === '/api/listing')
  ? (() => {
      const body = JSON.parse(rec.writes.find((w) => w.method === 'POST' && w.path === '/api/listing').postData || '{}');
      return {
        raw: rec.writes.find((w) => w.method === 'POST').postData,
        keys: Object.keys(body),
        cid: body.cid,
        cid_typeof: typeof body.cid,
        expected_selected: rec.steps.change?.domValue ?? rec.steps.options?.selectedValue,
        cid_matches_selected_numerically: String(body.cid) === String(rec.steps.change?.domValue ?? rec.steps.options?.selectedValue),
        price: body.price, stock: body.stock, has_create_key: typeof body.create_key === 'string' && body.create_key.length > 0,
      };
    })()
  : { note: 'no POST captured (submit may have been blocked client-side)', captured_count: rec.writes.length };

rec.console = { error_total: consoleErrors.length, unique: [...new Set(consoleErrors)].map((m) => ({ message: m, count: consoleErrors.filter((x) => x === m).length })) };
rec.pageerrors = { total: pageErrors.length, list: pageErrors.slice(0, 10) };

await browser.close();
fs.writeFileSync(`${OUT}/ac1-ac2-ac4-browser-probe.json`, JSON.stringify(rec, null, 2));
console.log(JSON.stringify({ shape: rec.steps.shape, negative_control: rec.steps.negative_control, options: rec.steps.options, change: rec.steps.change, submit_payload: rec.steps.submit_payload, console: rec.console, pageerrors: rec.pageerrors }, null, 2));
