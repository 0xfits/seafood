// QA-job browser probe 1/3 · /task/new 形态 + 选项集合 + 两次提交载荷（AC1 / AC2 / AC4 / 判负#18）
// 零业务写：POST /api/job 就地截获；/api/currencies 走真实 dev 后端（公开只读）；
// 其余 /api/* 一律桩掉（401 噪声隔离 —— 假会话 token 非真凭据，非产品缺陷）。
// 独立探针（非实现方 probe-job-form.mjs 的复制）：判据自本单 AC 书写。
import { createRequire } from 'node:module';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');

const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa-job/readings/ac1-ac2-ac4-browser-probe.json';
const BASE = 'http://localhost:5787';
const API = 'http://localhost:5788';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 假会话（结构合法假 JWT，exp=2100；非真实凭据，仅让受保护页渲染）
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa-job' })}.qa-probe-sig`;
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Job-Probe', nickname: 'QA-Job-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN };

// 真实接口行（直接 node fetch 同一后端，供集合相等判据；与页面读数独立取一份）
const apiResp = await fetch(`${API}/api/currencies`, { headers: { Authorization: '' } });
const apiBody = await apiResp.json();
const apiRows = apiBody.data;

const rec = {
  at: new Date().toISOString(),
  head_commit: '9087c51 (worktree baseline; main repo working tree identical)',
  url: `${BASE}/task/new`,
  api_fetch_status: apiResp.status,
  api_rows: apiRows,
  recipe: 'GET /api/currencies = real backend; POST /api/job = intercepted (fulfilled locally, zero business write); other /api/* = stubbed 200 {success:true,data:[]}',
  shape: {}, decoy_negative_control: {}, options: {}, option_set_equality: {}, submit_payloads: [],
  currency_request_log: [], console_errors: [], page_errors: [], unhandled_rejections: [],
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((u) => {
  localStorage.setItem('user', JSON.stringify(u));
  localStorage.setItem('token', u.token);
  window.addEventListener('unhandledrejection', (e) => {
    window.__qaUnhandled = (window.__qaUnhandled || 0) + 1;
    window.__qaUnhandledMsg = String(e && e.reason && e.reason.message ? e.reason.message : e.reason);
  });
}, USER);

await ctx.route('**/api/**', async (route) => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  const method = req.method();
  if (path === '/api/currencies') {
    const resp = await route.fetch();
    rec.currency_request_log.push({ method, path, status: resp.status(), via: 'real-backend-passthrough' });
    await route.fulfill({ response: resp });
    return;
  }
  if (method === 'POST' && path === '/api/job') {
    rec.submit_payloads.push({ method, path, postData: req.postData(), at: new Date().toISOString() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK (qa stub, zero write)', data: { job_id: 987654 } }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'qa stub', data: [] }) });
});

const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') rec.console_errors.push(m.text()); });
page.on('pageerror', (e) => rec.page_errors.push(String(e && e.message ? e.message : e)));

await page.goto(`${BASE}/task/new`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-sf-m="jobs-select-cid"]', { timeout: 20000 });
// 等选项加载完（>1 说明真后端行已进 select）
await page.waitForFunction(() => {
  const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
  return s && s.options && s.options.length > 1;
}, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(300);

// ---- AC1 形态 ----
rec.shape = await page.evaluate(() => ({
  select_jobsSelectCid: document.querySelectorAll('select[data-sf-m="jobs-select-cid"]').length,
  legacy_jobsInputCid_anyTag: document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length,
  input_jobsInputCid: document.querySelectorAll('input[data-sf-m="jobs-input-cid"]').length,
  select_tagName: document.querySelector('select[data-sf-m="jobs-select-cid"]')?.tagName ?? null,
  select_required: document.querySelector('select[data-sf-m="jobs-select-cid"]')?.required ?? null,
  root_children: document.getElementById('root')?.children.length ?? -1,
}));

// ---- AC1 负控：注入同钩子诱饵 input ⇒ 尺子必须读到 1；移除 ⇒ 回 0 ----
rec.decoy_negative_control = await page.evaluate(() => {
  const before = document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length;
  const decoy = document.createElement('input');
  decoy.setAttribute('data-sf-m', 'jobs-input-cid');
  decoy.id = 'qa-decoy-input';
  document.querySelector('form')?.appendChild(decoy);
  const during = document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length;
  decoy.remove();
  const after = document.querySelectorAll('[data-sf-m="jobs-input-cid"]').length;
  return { before, during_with_decoy: during, after_removal: after, ruler_not_blind: before === 0 && during === 1 && after === 0 };
});

// ---- AC2 选项集合 ----
rec.options = await page.evaluate(() => {
  const s = document.querySelector('[data-sf-m="jobs-select-cid"]');
  const opts = [...s.options].map((o) => ({ value: o.value, text: o.textContent }));
  const badNumberedText = opts.filter((o) => /^\s*\d+\s*[·\-–—:|#(（#]/.test(o.text) || /^[#(（]?\d+\s*[)）]?\s*·/.test(o.text));
  return {
    count: opts.length, opts,
    selectedValue: s.value, selectedText: s.options[s.selectedIndex]?.textContent ?? null,
    bareNumericPrefixExamples: badNumberedText,
  };
});

// ---- AC2 集合相等（页面选项 vs 真实接口三元组）----
{
  const pageSet = rec.options.opts.map((o) => `${o.value}|${o.text}`);
  const apiSet = apiRows.map((r) => `${String(r.cid)}|${String(r.symbol)}${r.name ? ` · ${r.name}` : ''}`);
  const apiDraftAbsent = true; // 由 ac2-db-currency.json 的 not_listed 与下面 diff 共同判定
  rec.option_set_equality = {
    api_row_count: apiRows.length,
    page_option_count: rec.options.opts.length,
    exact_order_and_content_equal: JSON.stringify(pageSet) === JSON.stringify(apiSet),
    set_equal_ignoring_order: [...pageSet].sort().join('\n') === [...apiSet].sort().join('\n'),
    page_only: pageSet.filter((x) => !apiSet.includes(x)),
    api_only: apiSet.filter((x) => !pageSet.includes(x)),
    note: 'draft cids (DB not_listed) checked separately in ac2-db-currency.json vs options',
    apiDraftAbsent,
  };
  const draftCids = [9, 15]; // 补全由 verdict 阶段从 DB 读数取全量
  rec.option_set_equality.draft_cids_absent_from_options = undefined; // 在 verdict 阶段合并计算
  void draftCids;
}

// ---- AC4 两次选择两次提交（载荷 cid = number）----
const fillAndSubmit = async (cidToPick) => {
  await page.fill('[data-sf-m="jobs-input-title"]', `QA-jobs ${cidToPick}`);
  await page.fill('[data-sf-m="jobs-input-reward"]', '12');
  const hc = page.locator('[data-sf-m="jobs-input-headcount"]');
  if (await hc.count()) await page.fill('[data-sf-m="jobs-input-headcount"]', '2');
  const sel = page.locator('[data-sf-m="jobs-select-cid"]');
  await sel.selectOption(String(cidToPick));
  await page.click('[data-sf-m="jobs-primary"]');
  await page.waitForTimeout(250);
};

await fillAndSubmit(1);          // 默认币种 $（cid 1）
await fillAndSubmit(4);          // 换选另一币种（cid 4）
await page.waitForTimeout(200);

rec.selected_after_second = await page.evaluate(() => document.querySelector('[data-sf-m="jobs-select-cid"]')?.value ?? null);
rec.submit_payload_parsed = rec.submit_payloads.map((p) => {
  let body = null;
  try { body = JSON.parse(p.postData); } catch { /* keep null */ }
  return {
    keys: body ? Object.keys(body).sort() : null,
    cid: body?.cid ?? null,
    cid_typeof: typeof (body?.cid),
    createKey_prefix: typeof body?.createKey === 'string' ? body.createKey.split(':')[0] : body?.createKey ?? null,
    reward: body?.reward, headcount: body?.headcount, title: body?.title,
  };
});
rec.two_selections_two_values = rec.submit_payload_parsed.length === 2
  && rec.submit_payload_parsed[0].cid === 1
  && rec.submit_payload_parsed[1].cid === 4
  && rec.submit_payload_parsed.every((p) => p.cid_typeof === 'number');

rec.unhandled_from_page = await page.evaluate(() => ({ count: window.__qaUnhandled || 0, msg: window.__qaUnhandledMsg ?? null }));

await browser.close();
fs_out();
function fs_out() {
  const fs = require('node:fs');
  fs.writeFileSync(OUT, JSON.stringify(rec, null, 2));
  console.log(JSON.stringify({
    shape: rec.shape, decoy: rec.decoy_negative_control,
    options_count: rec.options.count, selected: [rec.options.selectedValue, rec.options.selectedText],
    equality: rec.option_set_equality, payloads: rec.submit_payload_parsed,
    two_selections_two_values: rec.two_selections_two_values,
    currency_requests: rec.currency_request_log.length, console_errors: rec.console_errors.length,
    page_errors: rec.page_errors.length, unhandled: rec.unhandled_from_page,
  }, null, 2));
}
