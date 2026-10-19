// card-resize QA · 主浏览器探针（AC1 四组合恒高 / AC2 移除项计数 / AC3 卖家栏渲染 / AC6 回归）
// 真页 = dev 5787（vite dev）+ 5788（API）；fixture 仅拦 /api/prize/all，其余 API 真打 5788。零写库。
// 产出: readings/probe-card-qa.json, shots/*.png
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/kevin/bistro/seafood';
const QA = path.join(ROOT, 'ops/card-resize/qa');
const req = createRequire(path.join(ROOT, 'frontend/package.json'));
const { chromium } = req('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---------- fixture：克隆 dev 真实行（bID 76），四种内容组合 ----------
const allRows = JSON.parse(fs.readFileSync(path.join(QA, 'readings/dev-prize-all.json'), 'utf8')).data;
const tpl = allRows.find(r => r.bID === 76);
if (!tpl) throw new Error('模板行 76 不存在');
const LONG_TITLE = '九成新青轴机械键盘104键RGB背光白色款带手托可小刀自用一年无维修无进水附原装拔键器与备用轴体同城面交可试打手感顺滑无';
if ([...LONG_TITLE].length !== 60) throw new Error(`长标题须 60 字，实 ${[...LONG_TITLE].length}`);
const FIXTURES = [
  { ...tpl, bID: 980001, name: '罗技 G Pro X 无线耳机 白色', description: '用了半年，成色很好，无磕碰，配件齐全，附收纳袋。', media_urls: ['/api/media/8'], image_url: null, url_image: null, points: 120 }, // 有图
  { ...tpl, bID: 980002, name: '宜家马克杯 两只装 蓝白花纹', description: '全新未拆封，搬家出闲置，自取优先。', media_urls: [], image_url: null, url_image: null, points: 80 }, // 无图 ⇒ 占位
  { ...tpl, bID: 980003, name: LONG_TITLE, description: ' display 长标题组合：标题 clamp-2 两行盒高。', media_urls: ['/api/media/8'], image_url: null, url_image: null, points: 19999 }, // 长标题 60 字
  { ...tpl, bID: 980004, name: '小米台灯 Pro 白色', description: '', description_en: '', description_hk: '', description_vn: '', media_urls: ['/api/media/8'], image_url: null, url_image: null, points: 50 }, // 无描述
];
const routeFixture = (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ success: true, message: 'ok', data: FIXTURES }),
});

// ---------- 页面内采集 ----------
const COLLECT = `
(() => {
  const grid = document.querySelector('[data-sf-m="feed-grid"]');
  const cards = grid ? [...grid.querySelectorAll('.sf-reward-card')] : [];
  const readCard = (c) => {
    const r = c.getBoundingClientRect();
    const inner = c.querySelector('.sf-reward-inner');
    const ri = inner ? inner.getBoundingClientRect() : null;
    const ics = inner ? getComputedStyle(inner) : null;
    const innerClientW = inner ? inner.clientWidth : null;
    const innerBorderX = ics ? (parseFloat(ics.borderLeftWidth) + parseFloat(ics.borderRightWidth)) : null;
    const media = c.querySelector('.sf-reward-media');
    const img = c.querySelector('.sf-reward-media-img');
    const seller = c.querySelector('.sf-reward-seller');
    const rs = seller ? seller.getBoundingClientRect() : null;
    const avatar = c.querySelector('.sf-reward-seller-avatar');
    const tier = c.querySelector('[data-sf-m="reward-card-seller-tier"]');
    const name = c.querySelector('.sf-reward-seller-name');
    const blob = c.querySelector('.blur-xl');
    return {
      cardH: +(r.height.toFixed(2)), cardW: +(r.width.toFixed(2)),
      innerH: ri ? +(ri.height.toFixed(2)) : null,
      innerClientW, innerBorderX,
      media: media ? { h: +(media.getBoundingClientRect().height.toFixed(2)), w: +(media.getBoundingClientRect().width.toFixed(2)) } : null,
      img: img ? { complete: img.complete, naturalWidth: img.naturalWidth, fit: getComputedStyle(img).objectFit } : null,
      sellerH: rs ? +(rs.height.toFixed(2)) : null,
      sellerW: rs ? +(rs.width.toFixed(2)) : null,
      nickname: name ? name.textContent : null,
      tierText: tier ? tier.textContent : null,
      avatar: avatar ? { text: avatar.textContent, bg: getComputedStyle(avatar).backgroundColor, hasImg: !!avatar.querySelector('img') } : null,
      giftIcons: c.querySelectorAll('svg.lucide-gift').length,
      blob: blob ? { present: true, cls: blob.className } : { present: false },
      removedTexts: ['库存不足','可兑换','已兑换','人已领取'].filter(t => c.textContent.includes(t)),
      title: (c.querySelector('.sf-reward-title') || {}).textContent || null,
      descPresent: !!c.querySelector('.sf-reward-desc'),
    };
  };
  return {
    href: location.href,
    cardCount: cards.length,
    cards: cards.map(readCard),
    gridGiftIcons: grid ? grid.querySelectorAll('svg.lucide-gift').length : null,
    gridRemovedCounts: grid ? ['库存不足','可兑换','已兑换','人已领取'].map(t => ({ t, n: (grid.textContent.match(new RegExp(t, 'g')) || []).length })) : null,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rootLen: document.querySelector('#root') ? document.querySelector('#root').innerHTML.length : 0,
  };
})()`;

const collectErrors = (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push({ kind: 'pageerror', msg: String(e && e.message || e) }));
  page.on('console', (m) => { if (m.type() === 'error') errs.push({ kind: 'console', msg: m.text().slice(0, 300) }); });
  return errs;
};

const newPage = async (browser, { viewport, mobile = false, fixture = false }) => {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: 1,
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  if (fixture) await ctx.route('**/api/prize/all*', routeFixture);
  const page = await ctx.newPage();
  return { ctx, page, errs: collectErrors(page) };
};

const out = { generatedAt: new Date().toISOString(), head: 'd37a813', fixture: { combos: ['with-image', 'no-image', 'long-title-60', 'no-description'] }, views: {} };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---------- AC1/AC2/AC3（fixture 四组合 × 1440 / 1536） ----------
for (const vp of [{ name: 'w1440', width: 1440, height: 900 }, { name: 'w1536', width: 1536, height: 960 }]) {
  const { ctx, page } = await newPage(browser, { viewport: { width: vp.width, height: vp.height }, fixture: true });
  await page.goto('http://localhost:5787/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForSelector('[data-sf-m="feed-grid"] .sf-reward-card', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-sf-m="feed-grid"] .sf-reward-card').length === 4, { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.sf-reward-media-img')].every(i => i.complete), { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const data = await page.evaluate(COLLECT);
  out.views[`fixture-${vp.name}`] = data;
  await page.screenshot({ path: path.join(QA, 'shots', `fixture-${vp.name}.png`), fullPage: false });
  await ctx.close();
}

// ---------- 真实 feed（dev 真数据：掩码 / new 档 / 占位头像 / 48 栏） ----------
{
  const { ctx, page, errs } = await newPage(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5787/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForSelector('[data-sf-m="feed-grid"] .sf-reward-card', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-sf-m="feed-grid"] .sf-reward-card').length >= 1 && [...document.querySelectorAll('.sf-reward-media-img')].every(i => i.complete), { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const data = await page.evaluate(COLLECT);
  data.uncaught = errs.filter(e => e.kind === 'pageerror');
  out.views['realfeed-w1440'] = data;
  await page.screenshot({ path: path.join(QA, 'shots', 'realfeed-w1440.png'), fullPage: false });
  await ctx.close();
}

// ---------- AC6a：/item/1 详情页零异常 ----------
{
  const { ctx, page, errs } = await newPage(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5787/item/1', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => (document.querySelector('#root') || {}).innerHTML?.length > 0, { timeout: 20000 });
  const data = await page.evaluate(COLLECT);
  data.uncaught = errs.filter(e => e.kind === 'pageerror');
  data.consoleErrors = errs.filter(e => e.kind === 'console');
  out.views['item1-w1440'] = data;
  await ctx.close();
}

// ---------- AC6b：390 档首页零溢出（真 feed） ----------
{
  const { ctx, page, errs } = await newPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
  await page.goto('http://localhost:5787/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForSelector('[data-sf-m="feed-grid"] .sf-reward-card', { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.sf-reward-media-img')].every(i => i.complete), { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const data = await page.evaluate(COLLECT);
  data.uncaught = errs.filter(e => e.kind === 'pageerror');
  out.views['realfeed-w390'] = data;
  await page.screenshot({ path: path.join(QA, 'shots', 'realfeed-w390.png'), fullPage: true });
  await ctx.close();
}

await browser.close();

// ---------- AC4 生产真页探针（--host-resolver-rules 绕 DNS 劫持） ----------
{
  const browser2 = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--host-resolver-rules=MAP 0xseafood.com 76.76.21.21', '--ignore-certificate-errors'],
  });
  const { ctx, page, errs } = await newPage(browser2, { viewport: { width: 1440, height: 900 } });
  await page.goto('https://0xseafood.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForSelector('[data-sf-m="feed-grid"] .sf-reward-card', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.sf-reward-media-img')].every(i => i.complete), { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const data = await page.evaluate(COLLECT);
  data.uncaught = errs.filter(e => e.kind === 'pageerror');
  data.consoleErrors = errs.filter(e => e.kind === 'console');
  out.views['prod-w1440'] = data;
  await page.screenshot({ path: path.join(QA, 'shots', 'prod-w1440.png'), fullPage: false });
  await ctx.close();
  await browser2.close();
}

fs.writeFileSync(path.join(QA, 'readings/probe-card-qa.json'), JSON.stringify(out, null, 2));
// 控制台摘要
for (const [k, v] of Object.entries(out.views)) {
  const hs = (v.cards || []).map(c => c.cardH).join(',');
  console.log(`${k}: cards=${v.cardCount} heights=[${hs}] gift=${v.gridGiftIcons} overflowX=${v.overflowX} rootLen=${v.rootLen}`);
}
