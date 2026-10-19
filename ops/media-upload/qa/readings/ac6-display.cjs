/**
 * AC6 · 展示两分支（真浏览器 · dev 5800）
 * ---------------------------------------------------------------------
 * 两档视口 390×844 / 1440×900 × 两个面（首页卡 + 详情页）× 两个分支：
 *   ① 带图（listing 72 · media_urls=['/api/media/1']）⇒ img[src*="/api/media/"] 且 naturalWidth>0
 *   ② 无图（listing 73 · media_urls=[]）⇒ img[src*=placeholder-item] 且 naturalWidth==320
 * 每臂 zero pageerror（按臂独立记）。
 *
 * 首页数据面说明（**披露**）：HomePage 打 `/api/home?prize_limit=8`，后端该口硬编码
 *   `listPrizes(0, prizeLimit)`（skip=0）⇒ 固定返回 bID 最小的 8 行，listing 72/73 不在其中
 *   （现库 28 行，72/73 位次 25/26）。故本探针在路由层把 `/api/home` 响应中的 `prizes`
 *   替换为**真实** `/api/prize/all?skip=24&limit=8` 行（同一后端、同一 DB，无造数据），
 *   其余字段原样透传 ⇒ 验的仍是真 HomePage 映射 + 真 RewardCard 渲染。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'node_modules', 'playwright'));

const BASE = process.env.QA_WEB_BASE || 'http://localhost:5800';
const OUT = path.join(__dirname, 'ac6-display.json');
const VIEWPORTS = [
  { key: 'mobile', width: 390, height: 844 },
  { key: 'desktop', width: 1440, height: 900 },
];
const WITH_IMAGE = 72;
const NO_IMAGE = 73;

const out = { ac: 'AC6', generated_at: new Date().toISOString(), web_base: BASE, arms: [], checks: [] };
const t = (id, what, pass, reading) => { out.checks.push({ id, what, pass: !!pass, reading }); return pass; };

const readImg = async (loc) => {
  if (!(await loc.count())) return { present: false, src: null, naturalWidth: 0 };
  const el = loc.first();
  const src = await el.getAttribute('src').catch(() => null);
  let naturalWidth = 0;
  for (let i = 0; i < 40; i += 1) {
    const s = await el.evaluate((n) => ({ w: n.naturalWidth, c: n.complete })).catch(() => ({ w: 0, c: false }));
    naturalWidth = s.w;
    if (naturalWidth > 0) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { present: true, src, naturalWidth };
};

(async () => {
  const exeDefault = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell');
  const exe = process.env.QA_CHROMIUM_PATH || (fs.existsSync(exeDefault) ? exeDefault : undefined);
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  out.chromium = { executablePath: exe || '(playwright default)', version: require(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'node_modules', 'playwright', 'package.json')).version };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'zh-CN' });
    const page = await context.newPage();

    // 每臂独立 pageerror 账
    let armErrors = [];
    page.on('pageerror', (e) => armErrors.push(String(e.message)));

    // ---- 首页：/api/home 的 prizes 换成真实 skip=24 行（见文件头披露）----
    let homePrizeIds = [];
    await page.route('**/api/home*', async (route) => {
      try {
        const resp = await route.fetch();
        const body = await resp.json();
        const extra = await fetch(`${BASE.replace(/\/$/, '')}/api/prize/all?skip=24&limit=8`);
        const extraBody = await extra.json();
        const rows = extraBody?.data ?? extraBody ?? [];
        homePrizeIds = rows.map((r) => r.bID);
        body.data = { ...(body.data || {}), prizes: rows };
        await route.fulfill({ response: resp, body: JSON.stringify(body), headers: { ...resp.headers(), 'content-type': 'application/json' } });
      } catch (e) {
        await route.continue();
      }
    });

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('[data-sf-m="reward-card"]').length > 0, null, { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(800); // 卡片 <img> 解码

    const imgWith = await readImg(page.locator(`a[href$="/item/${WITH_IMAGE}"] img`));
    const imgNo = await readImg(page.locator(`a[href$="/item/${NO_IMAGE}"] img`));
    const cards = await page.locator('[data-sf-m="reward-card"]').count();

    const errWith = armErrors.slice();
    t(`HOME-${vp.key}-W`, `首页卡 · ${vp.width} · listing ${WITH_IMAGE}（带图）⇒ img[src*="/api/media/"] 且 naturalWidth>0`,
      imgWith.present && /\/api\/media\/\d+/.test(String(imgWith.src)) && imgWith.naturalWidth > 0,
      `cards=${cards} home_prize_ids=${JSON.stringify(homePrizeIds)} src=${imgWith.src} naturalWidth=${imgWith.naturalWidth}`);
    t(`HOME-${vp.key}-N`, `首页卡 · ${vp.width} · listing ${NO_IMAGE}（无图）⇒ img[src*=placeholder-item] 且 naturalWidth=320`,
      imgNo.present && /placeholder-item/.test(String(imgNo.src)) && imgNo.naturalWidth === 320,
      `src=${imgNo.src} naturalWidth=${imgNo.naturalWidth}`);
    t(`HOME-${vp.key}-E`, `首页卡臂 · ${vp.width} · pageerror=0`, errWith.length === 0,
      `pageerrors=${errWith.length}${errWith.length ? ':' + errWith.join(' | ').slice(0, 200) : ''}`);

    out.arms.push({
      arm: `home@${vp.width}`, viewport: { w: vp.width, h: vp.height }, surface: 'home-card',
      home_prize_ids: homePrizeIds, cards,
      with_image: imgWith, no_image: imgNo, pageerrors: errWith,
    });

    // ---- 详情页两跳（与首页同一 context，路由只挂 /api/home ⇒ 详情不走替身）----
    for (const [branch, id, expect] of [['W', WITH_IMAGE, 'media'], ['N', NO_IMAGE, 'placeholder']]) {
      armErrors = [];
      await page.goto(`${BASE}/item/${id}`, { waitUntil: 'networkidle' });
      await page.locator('[data-sf-m="item-detail-thumb"]').waitFor({ state: 'attached', timeout: 20000 }).catch(() => null);
      const thumb = await readImg(page.locator('[data-sf-m="item-detail-thumb"]'));
      const pass = expect === 'media'
        ? thumb.present && /\/api\/media\/\d+/.test(String(thumb.src)) && thumb.naturalWidth > 0
        : thumb.present && /placeholder-item/.test(String(thumb.src)) && thumb.naturalWidth === 320;
      t(`DETAIL-${vp.key}-${branch}`, `详情页 · ${vp.width} · listing ${id}（${expect === 'media' ? '带图' : '无图'}）⇒ ${expect === 'media' ? 'img[src*="/api/media/"] 且 naturalWidth>0' : 'img[src*=placeholder-item] 且 naturalWidth=320'}`,
        pass, `src=${thumb.src} naturalWidth=${thumb.naturalWidth}`);
      t(`DETAIL-${vp.key}-${branch}-E`, `详情页臂 · ${vp.width} · listing ${id} · pageerror=0`, armErrors.length === 0,
        `pageerrors=${armErrors.length}${armErrors.length ? ':' + armErrors.join(' | ').slice(0, 200) : ''}`);
      out.arms.push({
        arm: `detail-${id}@${vp.width}`, viewport: { w: vp.width, h: vp.height }, surface: 'detail',
        listing_id: id, image: thumb, pageerrors: armErrors.slice(),
      });
    }

    await context.close();
  }

  await browser.close();
  out.pass = out.checks.every((c) => c.pass);
  out.failed = out.checks.filter((c) => !c.pass).map((c) => c.id);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, failed: out.failed, checks: out.checks.map((c) => `${c.id} ${c.pass ? 'PASS' : 'FAIL'} :: ${c.reading}`) }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.stack || e.message; out.pass = false;
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(e.stack); process.exitCode = 1;
});
