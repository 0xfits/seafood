// QA-job browser probe 2/3 · 回退三态（AC5）：/api/currencies ⇒ 500 / abort / success:true data:[]
// 每臂独立 browser context；判据：选项恰 1（value '1'、文本恰 '$'）、jobs-primary 不 disabled、
// 零 pageerror；另就地提交一次证明表单仍可提交（POST /api/job 截获，cid=1 number，零业务写）。
// 正控臂 = 真实 dev 后端（11 选项）。
import { createRequire } from 'node:module';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const fs = require('node:fs');

const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa-job/readings/ac5-fallback-arms.json';
const BASE = 'http://localhost:5787';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa-job' })}.qa-probe-sig`;
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Job-Probe', nickname: 'QA-Job-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN };

const ARMS = [
  { id: 'real-backend', mode: 'real', expect: 'positive control: 11 options' },
  { id: 'inject-500', mode: '500', expect: 'fallback: 1 option $' },
  { id: 'inject-abort', mode: 'abort', expect: 'fallback: 1 option $' },
  { id: 'inject-empty', mode: 'empty', expect: 'fallback: 1 option $' },
];

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const rec = { at: new Date().toISOString(), url: `${BASE}/task/new`, recipe: 'GET passthrough only for real arm; injected arms intercepted before network; POST /api/job always intercepted (zero business write)', arms: {} };

for (const arm of ARMS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((u) => {
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('token', u.token);
    window.addEventListener('unhandledrejection', (e) => {
      window.__qaUnhandled = (window.__qaUnhandled || 0) + 1;
    });
  }, USER);

  const currenciesHits = [];
  const jobPosts = [];
  await ctx.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/currencies') {
      currenciesHits.push(req.method());
      if (arm.mode === '500') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'qa injected 500', code: 'QA_INJECTED_500' }) });
        return;
      }
      if (arm.mode === 'abort') { await route.abort('connectionreset'); return; }
      if (arm.mode === 'empty') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'qa injected empty list', data: [] }) });
        return;
      }
      await route.fetch().then((r) => route.fulfill({ response: r }));
      return;
    }
    if (req.method() === 'POST' && path === '/api/job') {
      jobPosts.push(req.postData());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'qa stub zero write', data: { job_id: 987654 } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'qa stub', data: [] }) });
  });

  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  const out = { arm: arm.id, mode: arm.mode };
  try {
    await page.goto(`${BASE}/task/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-sf-m="jobs-select-cid"]', { timeout: 20000 });
    // 注入臂：等回退稳定（真臂：等 11 项加载）
    await page.waitForFunction((n) => {
      const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
      return s && n === 'real' ? s.options.length > 1 : true;
    }, arm.id, { timeout: 8000 });
    await page.waitForTimeout(600); // 让失败分支 settle

    out.state = await page.evaluate(() => {
      const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
      const opts = [...s.options].map((o) => ({ value: o.value, text: o.textContent }));
      const primary = document.querySelector('[data-sf-m="jobs-primary"]');
      return {
        option_count: opts.length, options: opts,
        selected_value: s.value,
        single_option_is_value1_textDollar: opts.length === 1 && opts[0].value === '1' && opts[0].text === '$',
        primary_disabled: primary ? primary.disabled : null,
        hero_note: document.querySelector('[data-sf-m="jobs-hero"] p')?.textContent ?? null,
      };
    });

    // 回退态仍可提交：填必填项 + 点击提交（写口就地截获）
    await page.fill('[data-sf-m="jobs-input-title"]', `QA-fallback ${arm.id}`);
    await page.fill('[data-sf-m="jobs-input-reward"]', '5');
    await page.fill('[data-sf-m="jobs-input-headcount"]', '1');
    await page.click('[data-sf-m="jobs-primary"]');
    await page.waitForTimeout(300);

    out.submit = {
      job_post_count: jobPosts.length,
      payloads: jobPosts.map((p) => { try { const b = JSON.parse(p); return { cid: b.cid, cid_typeof: typeof b.cid, title: b.title }; } catch { return { parse_error: true }; } }),
      status_text: await page.evaluate(() => document.querySelector('[data-sf-m="jobs-status"]')?.textContent ?? null),
    };
    out.currency_get_count = currenciesHits.length;
    out.page_errors = pageErrors;
    out.console_errors = consoleErrors;
    out.unhandled_rejections = await page.evaluate(() => window.__qaUnhandled || 0);
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
    out.page_errors = pageErrors;
  }
  rec.arms[arm.id] = out;
  await ctx.close();
}

await browser.close();
rec.verdict = {
  real_backend_options: rec.arms['real-backend'].state?.option_count ?? null,
  all_three_fallbacks_single_dollar: ['inject-500', 'inject-abort', 'inject-empty'].every((a) => rec.arms[a].state?.single_option_is_value1_textDollar === true),
  all_three_fallbacks_primary_enabled: ['inject-500', 'inject-abort', 'inject-empty'].every((a) => rec.arms[a].state?.primary_disabled === false),
  all_three_fallbacks_zero_pageerror: ['inject-500', 'inject-abort', 'inject-empty'].every((a) => (rec.arms[a].page_errors || []).length === 0),
  all_three_fallbacks_submitted_cid1_number: ['inject-500', 'inject-abort', 'inject-empty'].every((a) => {
    const p = rec.arms[a].submit?.payloads?.[0];
    return rec.arms[a].submit?.job_post_count === 1 && p && p.cid_typeof === 'number' && p.cid === 1;
  }),
};
fs.writeFileSync(OUT, JSON.stringify(rec, null, 2));
console.log(JSON.stringify(rec.verdict, null, 2));
for (const a of Object.values(rec.arms)) {
  console.log(a.arm, '| opts:', a.state?.option_count, '| single$:', a.state?.single_option_is_value1_textDollar, '| primaryDisabled:', a.state?.primary_disabled, '| pageErr:', (a.page_errors || []).length, '| jobPosts:', a.submit?.job_post_count, '| cid:', a.submit?.payloads?.[0]?.cid, a.submit?.payloads?.[0]?.cid_typeof, '| consoleErr:', (a.console_errors || []).length, '| unhandled:', a.unhandled_rejections, a.error ? '| ERROR: ' + a.error : '');
}
