/**
 * AC5-S6 重跑（真浏览器 · dev 5800 · 真会话 · **真上传不拦截**）
 * ---------------------------------------------------------------------
 * 背景：AC5 首轮 S6 的读数是旧选择器（无条件 `img`）取的 ⇒ 落到导航/占位图，
 *   `src=/src/images/order.svg`。探针改 `img[src*="/api/media/"]` 后未执行。
 * 本脚本只补 S6：走**完整成功路径**（不 route 拦截）→ 落地 /item/<id> →
 *   断言落地页存在 `img[src*="/api/media/"]` 且 naturalWidth>0，且零 pageerror。
 * 产物：ac5-s6-rerun.json（完整）+ 由 merge 步骤并入 ac5-fail-cancel.json 的 `s6_rerun` 段。
 * ★ 不覆盖 ac5-fail-cancel.json 任何旧键（merge 由本文件尾部完成，仅**新增** s6_rerun）。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'node_modules', 'playwright'));
const { login } = require('../lib/auth.cjs');
const { q } = require('../lib/db.cjs');

const BASE = process.env.QA_WEB_BASE || 'http://localhost:5800';
const FIX = path.join(__dirname, '..', 'fixtures');
const OUT = path.join(__dirname, 'ac5-s6-rerun.json');

const out = { ac: 'AC5', segment: 's6_rerun', generated_at: new Date().toISOString(), web_base: BASE, checks: [] };
const t = (id, what, pass, reading, extra) => out.checks.push({ id, what, pass: !!pass, reading, ...(extra ? { extra } : {}) });

(async () => {
  const session = await login('ac5-s6-rerun');
  out.actor = { uid: session.uid, address_tail: session.address_tail };

  const exeDefault = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell');
  const exe = process.env.QA_CHROMIUM_PATH || (fs.existsSync(exeDefault) ? exeDefault : undefined);
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  out.chromium = { executablePath: exe || '(playwright default)', version: require(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'node_modules', 'playwright', 'package.json')).version };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  const led = { media_post: 0, media_ok: 0, listing_post: 0 };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname === '/api/media' && req.method() === 'POST') led.media_post += 1;
    if (u.pathname === '/api/listing' && req.method() === 'POST') led.listing_post += 1;
  });
  page.on('response', (res) => {
    const u = new URL(res.url());
    if (u.pathname === '/api/media' && res.request().method() === 'POST' && res.status() === 200) led.media_ok += 1;
  });

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.setItem('user', JSON.stringify(s));
    if (s.token) localStorage.setItem('token', s.token);
  }, session.session_data);

  await page.goto(`${BASE}/item/new`, { waitUntil: 'networkidle' });
  const formCount = await page.locator('[data-sf-m="item-form"]').count();
  t('S0', '真会话下 /item/new 渲染发布表单', formCount === 1, `item-form count=${formCount}`);

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const title = `QA媒体单-S6重跑-${stamp}`;
  out.title = title;
  await page.locator('[data-sf-m="item-input-title"]').fill(title);
  await page.locator('[data-sf-m="item-input-price"]').fill('55');
  await page.locator('[data-sf-m="item-input-stock"]').fill('1');
  await page.locator('[data-sf-m="item-image-input"]').setInputFiles(path.join(FIX, 'qa-64.png'));
  await page.waitForFunction(() => document.querySelectorAll('[data-sf-m^="item-image-thumb-"]').length === 1, null, { timeout: 15000 });

  await page.locator('[data-sf-m="item-primary"]').click();
  await page.waitForURL(/\/item\/\d+$/, { timeout: 40000 }).catch(() => null);
  const finalUrl = page.url();
  const m = finalUrl.match(/\/item\/(\d+)$/);
  out.landing = { url: finalUrl, listing_id: m ? Number(m[1]) : null, ledger: { ...led } };
  t('S5', '成功路径重提 ⇒ 跳 /item/<id>', !!m, `final_url=${finalUrl} media_post=${led.media_post} media_ok=${led.media_ok} listing_post=${led.listing_post}`);

  // ---- S6 主体：落地页真图 ----
  let selCount = 0;
  let natW = 0;
  let imgSrc = '';
  let imgComplete = null;
  let detailThumb = null;
  if (m) {
    await page.waitForLoadState('networkidle').catch(() => null);
    const img = page.locator('img[src*="/api/media/"]').first();
    await img.waitFor({ state: 'attached', timeout: 20000 }).catch(() => null);
    selCount = await page.locator('img[src*="/api/media/"]').count();
    imgSrc = (await img.getAttribute('src').catch(() => '')) || '';
    // naturalWidth 需图解码完成：轮询至 >0 或超时（不掩盖真实失败，超时即读 0）
    for (let i = 0; i < 40; i += 1) {
      const s = await img.evaluate((el) => ({ w: el.naturalWidth, c: el.complete })).catch(() => ({ w: 0, c: null }));
      natW = s.w; imgComplete = s.c;
      if (natW > 0) break;
      await page.waitForTimeout(250);
    }
    detailThumb = await page.locator('[data-sf-m="item-detail-thumb"]').evaluate((el) => ({ src: el.getAttribute('src'), naturalWidth: el.naturalWidth })).catch(() => null);
  }
  out.landing_img = { selector: 'img[src*="/api/media/"]', count: selCount, src: imgSrc, naturalWidth: natW, complete: imgComplete };
  out.detail_thumb = detailThumb;
  t('S6', '落地页显示真图（img[src*="/api/media/"] 且 naturalWidth>0）',
    selCount >= 1 && /\/api\/media\/\d+/.test(imgSrc) && natW > 0,
    `selector_count=${selCount} src=${imgSrc} naturalWidth=${natW} complete=${imgComplete} detail_thumb=${JSON.stringify(detailThumb)}`);

  t('S7', '本次重跑全程 pageerror = 0', pageErrors.length === 0,
    `pageerrors=${pageErrors.length}${pageErrors.length ? ':' + pageErrors.join(' | ').slice(0, 200) : ''}`);
  out.page_errors = pageErrors;
  out.console_errors = consoleErrors.slice(0, 10);

  if (m) {
    const id = Number(m[1]);
    const row = (await q(`select listing_id, status, media_urls, title from public.listing where listing_id = ${id}`))[0];
    out.db_row = row;
    const mediaId = Array.isArray(row?.media_urls) && row.media_urls[0] ? Number(String(row.media_urls[0]).split('/').pop()) : null;
    out.created = { listing_id: id, media_id: mediaId, uid: session.uid, title };
    if (mediaId) {
      const mrow = (await q(`select media_id, owner_uid, content_type, size_bytes from public.media where media_id = ${mediaId}`))[0];
      out.media_row = mrow;
    }
    t('S8', '落地商品在库：status=listed 且 media_urls 非空', row?.status === 'listed' && Array.isArray(row?.media_urls) && row.media_urls.length === 1,
      `listing_id=${id} status=${row?.status} media_urls=${JSON.stringify(row?.media_urls)}`);
  }

  await browser.close();
  out.pass = out.checks.every((c) => c.pass);
  out.failed = out.checks.filter((c) => !c.pass).map((c) => c.id);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  // ---- 并入 AC5 主读数：仅新增 s6_rerun（不覆盖既有键）----
  const mainPath = path.join(__dirname, 'ac5-fail-cancel.json');
  const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
  main.s6_rerun = {
    generated_at: out.generated_at,
    supersedes: 'S6（首轮读数 = 旧无条件 img 选择器所致，src=/src/images/order.svg）',
    checks: out.checks,
    landing: out.landing,
    landing_img: out.landing_img,
    detail_thumb: out.detail_thumb,
    page_errors: out.page_errors,
    pass: out.pass,
    failed: out.failed,
    full_reading: 'ops/media-upload/qa/readings/ac5-s6-rerun.json',
  };
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2));

  console.log(JSON.stringify({ pass: out.pass, failed: out.failed, checks: out.checks.map((c) => `${c.id} ${c.pass ? 'PASS' : 'FAIL'} :: ${c.reading}`), created: out.created }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.stack || e.message; out.pass = false;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(e.stack); process.exitCode = 1;
});
