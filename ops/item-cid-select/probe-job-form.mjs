// 浏览器探针 · 发布任务页（/task/new）币种下拉 · 只读 + 零写库
// 配方照 ops/item-cid-select/qa/probe-form.mjs：
//   · createRequire(<仓>/frontend/package.json) 取仓内 playwright（不 npm install）
//   · 假会话由 addInitScript 预置 localStorage（auth.js 读形状 = 'user' JSON + 'token'）
//   · /api/currencies 走真实后端（公开只读）；POST /api/job 就地截获并回包 ⇒ **不真发任务、零业务写**
//   · 其余 /api/* 一律桩掉（401 噪声隔离，属环境噪声不是产品缺陷）
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');

const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/readings/job-probe.json';
const BASE = 'http://localhost:5787';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 结构合法的假 JWT（payload {"exp":4102444800}），仅用于让受保护页渲染；不是任何真实凭据。
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa' })}.qa-probe-sig`;
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Probe', nickname: 'QA-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN };

const rec = {
  url: `${BASE}/task/new`,
  at: new Date().toISOString(),
  fakeSession: { storageKeys: ['user', 'token'], tokenPayloadExp: 4102444800, realCredentials: false },
  steps: {},
  api: {},
  writes: [],
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
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
  const path = new URL(req.url()).pathname;
  const method = req.method();
  if (path === '/api/currencies') {
    const resp = await route.fetch();
    const bodyText = await resp.text();
    let rows = null;
    try { rows = JSON.parse(bodyText)?.data ?? null; } catch { /* 保持原样 */ }
    apiLog.push({ path, method, hit: 'real-backend', status: resp.status(), rowCount: Array.isArray(rows) ? rows.length : null });
    await route.fulfill({ response: resp, body: bodyText });
    return;
  }
  if (method === 'POST' && path === '/api/job') {
    rec.writes.push({ path, method, postData: req.postData(), contentType: req.headers()['content-type'] || '' });
    apiLog.push({ path, method, hit: 'stubbed-captured (zero business write)', status: 200 });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { job_id: 987654 } }) });
    return;
  }
  apiLog.push({ path, method, hit: 'stubbed-noise-isolation', status: 200 });
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
});

const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

await page.goto(`${BASE}/task/new`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-sf-m="jobs-select-cid"]', { timeout: 20000 });
await page.waitForFunction(() => {
  const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
  return s && s.options && s.options.length > 1;
}, null, { timeout: 20000 }).catch(() => {});

rec.steps.shape = await page.evaluate(() => {
  const sel = document.querySelectorAll('select[data-sf-m="jobs-select-cid"]');
  const legacy = document.querySelectorAll('[data-sf-m="jobs-input-cid"]');
  const allSelects = document.querySelectorAll('select');
  const field = sel[0] ? sel[0].closest('label') : null;
  const cs = sel[0] ? getComputedStyle(sel[0]) : null;
  const root = document.getElementById('root');
  const primary = document.querySelector('[data-sf-m="jobs-primary"]');
  return {
    select_jobsSelectCid: sel.length,
    legacy_jobsInputCid_any: legacy.length,
    select_tagName: sel[0] ? sel[0].tagName : null,
    select_required: sel[0] ? sel[0].required : null,
    optionsInCidSelect: sel[0] ? sel[0].options.length : null,
    selectsOnPage_total: allSelects.length,
    labelText: field ? field.querySelector('span')?.textContent : null,
    labelContainsNumericId: field ? /\d/.test(field.querySelector('span')?.textContent || '') : null,
    noteText: document.querySelector('[data-sf-m="jobs-hero"] p')?.textContent ?? null,
    computedStyle: cs ? { minHeight: cs.minHeight, width: cs.width, background: cs.backgroundColor, borderRadius: cs.borderTopLeftRadius, fontSize: cs.fontSize, appearance: cs.appearance } : null,
    rootChildCount: root ? root.children.length : -1,
    primaryButton: primary ? { text: primary.textContent.trim(), disabled: primary.disabled } : null,
  };
});

rec.steps.options = await page.evaluate(() => {
  const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
  if (!s) return null;
  const texts = [...s.options].map((o) => o.textContent);
  const values = [...s.options].map((o) => o.value);
  // 「裸编号前缀」判据：文本以 `<自身 cid>` + 分隔符/空白开头（如 "21 · x" / "1 - y" / "7: z"）
  const bareNumericPrefix = texts.filter((t, i) => new RegExp(`^\\s*${values[i]}\\s*[·\\-–—:|#]`).test(t));
  return {
    count: s.options.length,
    values,
    texts,
    selectedValue: s.value,
    selectedText: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : null,
    bareNumericPrefix,
    anyTextStartsWithDigit: texts.filter((t) => /^\s*\d+\s*[·\-–—:|#]/.test(t)),
  };
});

// 负控：同一把尺子必须能读到「手填 input 计数 1」（证明 legacy 计数不是恒 0）
rec.steps.negative_control = await page.evaluate(() => {
  const count = () => ({
    select: document.querySelectorAll('select[data-sf-m="jobs-select-cid"]').length,
    legacy: document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length,
  });
  const before = count();
  const decoy = document.createElement('input');
  decoy.setAttribute('data-sf-m', 'jobs-input-cid');
  decoy.type = 'number';
  document.querySelector('[data-sf-m="jobs-select-cid"]').closest('label').appendChild(decoy);
  const during = count();
  decoy.remove();
  const after = count();
  return { before, during, after, probe_is_sensitive: during.legacy === before.legacy + 1 && after.legacy === before.legacy };
});

// 换选：取第一个 ≠ 当前值且 cid 不是 1 的选项（回退臂只有 1 项时则跳过并如实登记）
const opts = rec.steps.options ?? { values: [], selectedValue: null };
const target = opts.values.find((v) => v !== '1' && v !== opts.selectedValue) ?? opts.values.find((v) => v !== opts.selectedValue) ?? null;
rec.steps.change = { target, applied: false };
if (target) {
  await page.selectOption('[data-sf-m="jobs-select-cid"]', target);
  rec.steps.change = await page.evaluate((v) => {
    const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
    return { target: v, applied: true, domValue: s.value, domSelectedText: s.options[s.selectedIndex]?.textContent ?? null };
  }, target);
}

// 提交载荷：填必填项 → 点提交 → POST /api/job 被截获（零业务写、零库写）
await page.fill('[data-sf-m="jobs-input-title"]', 'QA 探针任务（未真发）');
await page.fill('[data-sf-m="jobs-input-reward"]', '7');
await page.fill('[data-sf-m="jobs-input-headcount"]', '2');
await page.click('[data-sf-m="jobs-primary"]').catch(() => {});
await page.waitForTimeout(1500);

const post = rec.writes.find((w) => w.method === 'POST' && w.path === '/api/job');
rec.steps.submit_payload = post
  ? (() => {
      const body = JSON.parse(post.postData || '{}');
      const selected = rec.steps.change?.domValue ?? rec.steps.options?.selectedValue;
      return {
        rawKeys: Object.keys(body),
        cid: body.cid,
        cid_typeof: typeof body.cid,
        expected_selected: selected,
        cid_matches_selected: String(body.cid) === String(selected),
        cid_is_not_currency_text: typeof body.cid === 'number',
        reward: body.reward,
        headcount: body.headcount,
        title: body.title,
        has_create_key: typeof body.create_key === 'string' && body.create_key.startsWith('cli:'),
      };
    })()
  : { note: 'no POST /api/job captured', captured_count: rec.writes.length };

rec.steps.status_after_submit = await page.evaluate(() => {
  const el = document.querySelector('[data-sf-m="jobs-status"]');
  return el ? { phase: el.getAttribute('data-sf-phase'), text: el.textContent.trim() } : null;
});

rec.api.log = apiLog;
rec.console = { error_total: consoleErrors.length, unique: [...new Set(consoleErrors)].slice(0, 10) };
rec.pageerrors = { total: pageErrors.length, list: pageErrors.slice(0, 10) };

await browser.close();
fs.writeFileSync(OUT, JSON.stringify(rec, null, 2));
console.log(JSON.stringify({
  shape: rec.steps.shape,
  options_summary: rec.steps.options ? { count: rec.steps.options.count, selectedValue: rec.steps.options.selectedValue, selectedText: rec.steps.options.selectedText, bareNumericPrefix: rec.steps.options.bareNumericPrefix, anyTextStartsWithDigit: rec.steps.options.anyTextStartsWithDigit, texts: rec.steps.options.texts.slice(0, 12) } : null,
  negative_control: rec.steps.negative_control,
  change: rec.steps.change,
  submit_payload: rec.steps.submit_payload,
  console_error_total: rec.console.error_total,
  pageerrors: rec.pageerrors.total,
}, null, 2));
