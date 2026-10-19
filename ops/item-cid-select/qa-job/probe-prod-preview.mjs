// QA-job browser probe 4 · 生产构建臂（vite preview of worktree dist @9087c51）
// 目的：React.StrictMode 只在 dev 双跑 effect ⇒ dev 下 /api/currencies 为 2 条 GET；
// 生产构建（真实用户面）应恰 1 条。判据（spec §47.8.5 #18）：币种读口请求集 = 恰 1 条 GET /api/currencies。
// API 传输重定向到 dev 后端 5788（应用代码零改动）；POST /api/job 仍就地截获（零业务写）。
import { createRequire } from 'node:module';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');
const fs = require('node:fs');

const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa-job/readings/ac2-prod-preview-requests.json';
const BASE = 'http://localhost:4188';
const API = 'http://localhost:5788';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa-job' })}.qa-probe-sig`;
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Job-Probe', nickname: 'QA-Job-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN };

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((u) => {
  localStorage.setItem('user', JSON.stringify(u));
  localStorage.setItem('token', u.token);
}, USER);

const currencyReqs = [];
const jobPosts = [];
await ctx.route('**/api/**', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'POST' && url.pathname === '/api/job') {
    jobPosts.push(req.postData());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'qa stub zero write', data: { job_id: 987654 } }) });
    return;
  }
  if (url.pathname === '/api/currencies') {
    // 唯一真实读口：透传 dev 后端（应用代码零改动，仅传输重定向）
    currencyReqs.push({ method: req.method(), path: url.pathname });
    const resp = await route.fetch({ url: `${API}${url.pathname}${url.search}` });
    await route.fulfill({ response: resp });
    return;
  }
  // 其余 GET 桩掉（假会话 token 非真凭据 ⇒ 真实 401 会触发 auth-expiry 清会话，属环境噪声）
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'qa stub (noise isolation)', data: [] }) });
});

const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)));
await page.goto(`${BASE}/task/new`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-sf-m="jobs-select-cid"]', { timeout: 20000 });
await page.waitForFunction(() => document.querySelector('[data-sf-m="jobs-select-cid"]')?.options?.length > 1, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(400);

const state = await page.evaluate(() => {
  const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
  return {
    option_count: s.options.length,
    options: [...s.options].map((o) => ({ value: o.value, text: o.textContent })),
    selected_value: s.value,
    legacy_input_count: document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length,
  };
});

const bundle = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')));

const rec = {
  at: new Date().toISOString(),
  served_by: 'vite preview (worktree dist built at 9087c51; bundle = index-BREoUqs6.js expected)',
  bundles_loaded: bundle,
  currency_requests: currencyReqs,
  currency_request_count: currencyReqs.length,
  exactly_one_get_currencies: currencyReqs.length === 1 && currencyReqs[0].method === 'GET' && currencyReqs[0].path === '/api/currencies',
  page_state: state,
  page_errors: pageErrors,
  job_posts_intercepted: jobPosts.length,
};
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(rec, null, 2));
console.log(JSON.stringify(rec, null, 2));
