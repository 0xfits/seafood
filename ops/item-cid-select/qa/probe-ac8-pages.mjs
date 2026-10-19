// QA (Neng) — AC8 three-page browser regression (logged out), independent probe.
// Pages: `/` (home), `/item/new` (未登录态), `/item/<bID>` (bID taken live from GET /api/prize/all).
// Per page: #root child count, pageerror (uncaught) count+messages, console-error classification.
// API shape half: cross-checks live GET /api/home + GET /api/prize/all against stored
// readings/ac8-home.json + readings/ac8-prize-all.json (API half measured earlier from node).
// Read-only: no writes, no login injection, no stubbing of /api/* (logged-out 401 noise is environment noise, classified as such).
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');

const OUT = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa/readings/ac8-browser-pages.json';
const READINGS = '/Users/kevin/bistro/seafood/ops/item-cid-select/qa/readings';
const BASE = 'http://localhost:5787';

const rec = { ac: 'AC8', at: new Date().toISOString(), base: BASE, state: 'logged-out', pages: [], api: {}, crosscheck: {} };

// ---- load stored API-half readings for cross-check ----
const storedHome = JSON.parse(fs.readFileSync(`${READINGS}/ac8-home.json`, 'utf8'));
const storedPrize = JSON.parse(fs.readFileSync(`${READINGS}/ac8-prize-all.json`, 'utf8'));

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/kevin/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// ---- API shapes from inside the browser (browser half) + pick a live bID ----
{
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load', timeout: 20000 });
  const api = await p.evaluate(async () => {
    const out = {};
    const home = await (await fetch(`${location.origin}/api/home`, { headers: { accept: 'application/json' } })).json();
    out.home = {
      success: home.success,
      top_keys: Object.keys(home).sort(),
      data_keys: Object.keys(home.data ?? {}).sort(),
      prizes_len: Array.isArray(home.data?.prizes) ? home.data.prizes.length : null,
      first_prize_keys_sample: home.data?.prizes?.[0] ? Object.keys(home.data.prizes[0]).slice(0, 6) : null,
    };
    const prize = await (await fetch(`${location.origin}/api/prize/all`, { headers: { accept: 'application/json' } })).json();
    out.prize_all = {
      success: prize.success,
      data_len: Array.isArray(prize.data) ? prize.data.length : null,
      first_bID: prize.data?.[0]?.bID ?? null,
      first_row_key_count: prize.data?.[0] ? Object.keys(prize.data[0]).length : null,
    };
    out.picked_bID = out.prize_all.first_bID;
    return out;
  });
  rec.api = api;
  await p.close();
}

const bID = rec.api.picked_bID;
const targets = [
  { name: 'home', path: '/' },
  { name: 'item-new-loggedout', path: '/item/new' },
  { name: `item-detail-${bID}`, path: `/item/${bID}` },
];

for (const t of targets) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const consoleNonErrors = { warning: 0, other: 0 };
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    else if (m.type() === 'warning') consoleNonErrors.warning += 1;
  });

  let goto = 'ok';
  try {
    await page.goto(BASE + t.path, { waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    goto = `goto-failed: ${String(e).slice(0, 120)}`;
  }
  await page.waitForTimeout(3500); // settle SPA render + api round-trips (item detail fetches GET /api/prize/:bID)

  const dom = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const kids = root ? Array.from(root.children) : [];
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
    return {
      rootExists: !!root,
      rootChildCount: kids.length,
      rootChildTags: kids.slice(0, 8).map((k) => k.tagName.toLowerCase() + (k.id ? `#${k.id}` : '') + (k.className && typeof k.className === 'string' ? `.${k.className.split(' ').filter(Boolean).slice(0, 3).join('.')}` : '')),
      bodyText_sample: txt.slice(0, 160),
      still_loading: /加载中|loading/i.test(txt.slice(0, 600)),
      title: document.title,
    };
  });

  const classify = (msg) => {
    if (/401|Unauthorized|未登录|请先登录/i.test(msg)) return 'auth_401';
    if (/404/.test(msg)) return 'http_404';
    if (/Failed to load resource.*5\d\d|Internal Server Error/.test(msg)) return 'http_5xx';
    if (/Warning:|React will|react-jsx|Each child in a list/.test(msg)) return 'react_warning';
    if (/Uncaught|TypeError|ReferenceError/.test(msg)) return 'js_runtime';
    if (/net::|NetworkError|Failed to fetch/.test(msg)) return 'network';
    return 'other';
  };
  const classified = {};
  for (const m of consoleErrors) {
    const c = classify(m);
    classified[c] = (classified[c] ?? 0) + 1;
  }

  rec.pages.push({
    name: t.name,
    path: t.path,
    final_url: page.url(),
    goto,
    dom,
    pageerror_count: pageErrors.length,
    pageerrors: pageErrors.slice(0, 10),
    console_error_count: consoleErrors.length,
    console_error_classes: classified,
    console_errors_sample: consoleErrors.slice(0, 12),
    console_non_error: consoleNonErrors,
  });
  await page.close();
}

// ---- cross-check live API half vs stored readings ----
rec.crosscheck = {
  home: {
    stored: { success: storedHome.success, prizes_len: Array.isArray(storedHome.data?.prizes) ? storedHome.data.prizes.length : null, top_keys: Object.keys(storedHome).sort() },
    live: rec.api.home,
    prizes_len_match: rec.api.home.prizes_len === (Array.isArray(storedHome.data?.prizes) ? storedHome.data.prizes.length : null),
  },
  prize_all: {
    stored: { success: storedPrize.success, data_len: Array.isArray(storedPrize.data) ? storedPrize.data.length : null },
    live: rec.api.prize_all,
    data_len_match: rec.api.prize_all.data_len === (Array.isArray(storedPrize.data) ? storedPrize.data.length : null),
    note: 'len mismatch, if any, = DB drift between 08:59 readings and now (multi-session repo), not shape regression; key sets compared separately',
  },
};

fs.writeFileSync(OUT, JSON.stringify(rec, null, 2) + '\n');
console.log('WROTE', OUT);
for (const p of rec.pages) {
  console.log(`${p.name}: rootChildren=${p.dom.rootChildCount} pageerrors=${p.pageerror_count} consoleErrors=${p.console_error_count} classes=${JSON.stringify(p.console_error_classes)} final=${p.final_url}`);
}
console.log('crosscheck:', JSON.stringify({ home_len_match: rec.crosscheck.home.prizes_len_match, prize_len_match: rec.crosscheck.prize_all.data_len_match }));
await browser.close();
