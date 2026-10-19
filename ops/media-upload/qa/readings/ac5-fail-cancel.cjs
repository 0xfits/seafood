/**
 * AC5 · 失败即取消（真浏览器 · playwright · dev 5800 · 真会话）
 * ---------------------------------------------------------------------
 * 前置：POST /api/media 被路由截为 500（模拟上传失败）
 * S1 选 1 张真 png（浏览器内 canvas 压缩 ⇒ webp）⇒ 缩略图 1 张
 * S2 提交 ⇒ 页面停 error 态，文案含 `item.imageUploadFail`（zh：图片上传失败，发布已取消）
 * S3 关键：拦截器统计 `POST /api/listing` 调用次数 = **0**（不得产生半截商品）
 * S4 库侧旁证：该标题在 public.listing 无新行
 * S5 恢复 /api/media（unroute）⇒ 重提 ⇒ 成功跳 /item/<id>
 * S6 全程 pageerror = 0
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'node_modules', 'playwright'));
const { login } = require('../lib/auth.cjs');
const { q } = require('../lib/db.cjs');

const BASE = process.env.QA_WEB_BASE || 'http://localhost:5800';
const STATE = path.join(__dirname, '_state.json');
const FIX = path.join(__dirname, '..', 'fixtures');
const UPLOAD_FAIL_TEXT = '图片上传失败，发布已取消';

const out = { ac: 'AC5', generated_at: new Date().toISOString(), web_base: BASE, checks: [], requests: [] };
const t = (id, what, pass, reading, extra) => out.checks.push({ id, what, pass: !!pass, reading, ...(extra ? { extra } : {}) });

(async () => {
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const session = await login('ac5-ui');
  out.actor = { uid: session.uid, address_tail: session.address_tail };

  // 本机已装 chromium-1228（playwright 期望 1208）⇒ 显式给可执行路径，避免改仓内依赖
  const exeDefault = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell');
  const exe = process.env.QA_CHROMIUM_PATH || (fs.existsSync(exeDefault) ? exeDefault : undefined);
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  out.chromium = { executablePath: exe || '(playwright default)', version: require(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'node_modules', 'playwright', 'package.json')).version };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') out.requests.push({ console_error: m.text().slice(0, 200) }); });

  // 请求账本
  const led = { media_post: 0, listing_post: 0, listing_post_urls: [], media_failed: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname === '/api/media' && req.method() === 'POST') led.media_post += 1;
    if (u.pathname === '/api/listing' && req.method() === 'POST') {
      led.listing_post += 1;
      led.listing_post_urls.push(req.postData()?.slice(0, 300) ?? null);
    }
  });

  // 1) 真会话注入（= saveAuthSession 写入形状：'user' + legacy 'token'）
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.setItem('user', JSON.stringify(s));
    if (s.token) localStorage.setItem('token', s.token);
  }, session.session_data);

  // 2) 上传口截为 500（仅 POST /api/media；GET /api/media/:id 不拦）
  let mediaBlocked = true;
  await page.route('**/api/media', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (!mediaBlocked) return route.continue();
    led.media_failed.push(route.request().postData()?.slice(0, 80));
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'LEDGER_TX_TIMEOUT', message: 'temporarily unavailable (QA simulated upload failure)', i18n_key: 'ledger.err.LEDGER_TX_TIMEOUT' },
      }),
    });
  });

  await page.goto(`${BASE}/item/new`, { waitUntil: 'networkidle' });
  const authed = await page.locator('[data-sf-m="item-form"]').count();
  t('S0', '真会话下 /item/new 渲染发布表单（非「请先登录」空态）', authed === 1, `item-form count=${authed}`);

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const title = `QA媒体单-UI-${stamp}`;
  await page.locator('[data-sf-m="item-input-title"]').fill(title);
  await page.locator('[data-sf-m="item-input-price"]').fill('77');
  await page.locator('[data-sf-m="item-input-stock"]').fill('1');

  // 3) 选 1 张真图
  await page.locator('[data-sf-m="item-image-input"]').setInputFiles(path.join(FIX, 'qa-64.png'));
  await page.waitForFunction(() => document.querySelectorAll('[data-sf-m^="item-image-thumb-"]').length === 1, null, { timeout: 15000 });
  const thumb = await page.locator('[data-sf-m="item-image-thumb-0"] img').getAttribute('src');
  t('S1', '选 1 张真 png ⇒ 1 张缩略图（浏览器内压缩后 data: URL）',
    /^data:image\/(webp|jpeg)/.test(String(thumb || '')),
    `thumbs=${await page.locator('[data-sf-m^="item-image-thumb-"]').count()} src_prefix=${String(thumb).slice(0, 24)}`);

  // 4) 提交（上传必失败）
  await page.locator('[data-sf-m="item-primary"]').click();
  await page.waitForFunction(() => document.querySelector('[data-sf-m="item-status"]')?.getAttribute('data-sf-phase') === 'error', null, { timeout: 20000 });
  const statusText = (await page.locator('[data-sf-m="item-status"]').innerText()).trim();
  const phase = await page.locator('[data-sf-m="item-status"]').getAttribute('data-sf-phase');
  out.error_state = { phase, statusText, url: page.url() };
  t('S2', '上传失败 ⇒ 页面停 error 态且文案含「图片上传失败，发布已取消」',
    phase === 'error' && statusText.includes(UPLOAD_FAIL_TEXT),
    `phase=${phase} text=${statusText.slice(0, 160)}`);

  // 5) 关键断言：零 POST /api/listing
  await page.waitForTimeout(1200);
  const listingCountAtFail = led.listing_post;
  t('S3', '上传失败时 POST /api/listing 调用次数 = 0（无半截商品）',
    listingCountAtFail === 0,
    `listing_post=${listingCountAtFail} media_post=${led.media_post} media_failed=${led.media_failed.length}`);

  const dbBefore = await q(`select count(*)::int as n from public.listing where title = '${title}'`);
  t('S4', '库侧旁证：该标题在 public.listing 无新行', dbBefore[0].n === 0, `db_rows_with_title=${dbBefore[0].n}`);

  // 6) 恢复上传口 ⇒ 重提 ⇒ 成功跳 /item/<id>
  mediaBlocked = false;
  await page.locator('[data-sf-m="item-primary"]').click();
  await page.waitForURL(/\/item\/\d+$/, { timeout: 30000 }).catch(() => null);
  const finalUrl = page.url();
  const m = finalUrl.match(/\/item\/(\d+)$/);
  out.success_state = { url: finalUrl, listing_post_total: led.listing_post, media_post_total: led.media_post };
  t('S5', '恢复后重提 ⇒ 成功跳 /item/<id>', !!m, `final_url=${finalUrl} listing_post_total=${led.listing_post} media_post_total=${led.media_post}`);

  // 7) 成功页真图渲染（衔接 AC6 的带图分支）
  let natW = 0;
  let imgSrc = '';
  if (m) {
    await page.waitForLoadState('networkidle').catch(() => null);
    const img = page.locator('img[src*="/api/media/"]').first();
    await img.waitFor({ timeout: 15000 }).catch(() => null);
    natW = await img.evaluate((el) => el.naturalWidth).catch(() => 0);
    imgSrc = await img.getAttribute('src').catch(() => '');
  }
  out.landing_img = { src: imgSrc, naturalWidth: natW };
  t('S6', '成功落地页显示真图（img[src*="/api/media/"] 且 naturalWidth>0）',
    /\/api\/media\/\d+/.test(imgSrc) && natW > 0, `src=${imgSrc} naturalWidth=${natW}`);

  t('S7', '全程 pageerror = 0', pageErrors.length === 0, `pageerrors=${pageErrors.length}${pageErrors.length ? ':' + pageErrors.join(' | ').slice(0, 200) : ''}`);

  if (m) {
    const newListingId = Number(m[1]);
    state.listings = { ...(state.listings || {}), ui_created: { listing_id: newListingId, seller_uid: session.uid, title } };
    state.actors = { ...(state.actors || {}), ac5: { uid: session.uid, address_tail: session.address_tail } };
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

    const row = (await q(`select listing_id, status, media_urls, title from public.listing where listing_id = ${newListingId}`))[0];
    out.ui_created_db_row = row;
    t('S8', 'UI 落地商品在库：status=listed 且 media_urls 非空（真 url）',
      row?.status === 'listed' && Array.isArray(row?.media_urls) && row.media_urls.length === 1 && /^\/api\/media\/\d+$/.test(row.media_urls[0]),
      `listing_id=${newListingId} status=${row?.status} media_urls=${JSON.stringify(row?.media_urls)}`);
  }

  out.page_errors = pageErrors;
  out.ledger = led;
  await browser.close();

  out.pass = out.checks.every((c) => c.pass);
  out.failed = out.checks.filter((c) => !c.pass).map((c) => c.id);
  fs.writeFileSync(path.join(__dirname, 'ac5-fail-cancel.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, failed: out.failed, checks: out.checks.map((c) => `${c.id} ${c.pass ? 'PASS' : 'FAIL'} :: ${c.reading}`) }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.stack || e.message; out.pass = false;
  fs.writeFileSync(path.join(__dirname, 'ac5-fail-cancel.json'), JSON.stringify(out, null, 2));
  console.error(e.stack); process.exitCode = 1;
});
