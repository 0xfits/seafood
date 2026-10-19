// AC3（真页卡面标签四臂）+ AC4（发布页 2+2 联动 / 零网络）+ AC6（390 档零溢出）
// 真浏览器（系统 Chrome）+ 真 dev 站（localhost:5787）+ 真登录（ethers 钱包签名换真 token）。
// 只读页面 + 一次真发布（正控臂，产出 1 行夹具，收口时回收）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = '/Users/kevin/bistro/seafood';
const QA = path.join(REPO, 'ops/item-type/qa');
const req = createRequire(path.join(REPO, 'frontend/package.json'));
const { chromium } = req('playwright');
const beReq = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { Wallet } = beReq('ethers');

const API = 'http://localhost:5788';
const WEB = 'http://localhost:5787';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const created = JSON.parse(fs.readFileSync(path.join(QA, 'readings/created-listings.json'), 'utf8'));
const TS = created.TAG;

const out = { at: new Date().toISOString(), tag: TS, login: {}, ac3: {}, ac4: {}, ac6: {}, extra_publish: null };

// ---- 真登录（复用本单钱包；不存在则新建并落 600 文件）----
const wfile = path.join(process.env.TMPDIR || '/tmp', 'itemtype-qa-wallet.txt');
let address, wallet;
if (fs.existsSync(wfile)) {
  const [a, k] = fs.readFileSync(wfile, 'utf8').trim().split('\n');
  wallet = new Wallet(k); address = a;
} else {
  wallet = Wallet.createRandom(); address = wallet.address.toLowerCase();
  fs.writeFileSync(wfile, `${address}\n${wallet.privateKey}\n`, { mode: 0o600 });
}
const jpost = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ch = await jpost('/api/auth/challenge', { evm_address: address });
const sig = await wallet.signMessage(ch.json.data.message);
const vf = await jpost('/api/auth/verify', { evm_address: address, signature: sig, challenge_token: ch.json.data.challenge_token });
const userPayload = vf.json.data;
out.login = { challenge_http: ch.status, verify_http: vf.status, uid: userPayload.uID, evm: userPayload.EVM, token_len: String(userPayload.token).length };

const seed = (payload) => `
  try {
    localStorage.setItem('user', JSON.stringify(${JSON.stringify(payload)}));
    localStorage.setItem('token', ${JSON.stringify(payload.token)});
    localStorage.setItem('theme', 'light');
  } catch (e) {}
`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb'] });
const errors = [];

// ================= AC3 · 桌面 1536 真页 =================
const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce', deviceScaleFactor: 1 });
await ctx.addInitScript(seed(userPayload));
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
await page.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-sf-m="reward-card-title"]', { timeout: 30000 });
await page.waitForTimeout(1200);

const readCards = async () => page.evaluate(() => {
  const cards = [...document.querySelectorAll('.sf-reward-card')];
  const rows = cards.map((card) => {
    const h = card.querySelector('[data-sf-m="reward-card-title"]');
    const tagEl = h ? h.querySelector('[data-sf-m="reward-card-ship-tag"]') : null;
    let textRect = null;      // 标题文字（剔除标签自身内部文字）的第一个文本节点
    let tagTextRect = null;   // 标签自身文字（对照用）
    if (h) {
      const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        if (!n.textContent || !n.textContent.trim()) continue;
        if (tagEl && tagEl.contains(n)) { if (!tagTextRect) { const r0 = document.createRange(); r0.selectNodeContents(n); const b = r0.getBoundingClientRect(); tagTextRect = { x: b.x, y: b.y, w: b.width }; } continue; }
        const r = document.createRange(); r.selectNodeContents(n); const rect = r.getBoundingClientRect();
        textRect = { x: rect.x, y: rect.y, w: rect.width }; break;
      }
    }
    const cs = tagEl ? getComputedStyle(tagEl) : null;
    let titleOnly = '';
    if (h) {
      const clone = h.cloneNode(true);
      clone.querySelectorAll('[data-sf-m="reward-card-ship-tag"]').forEach((n) => n.remove());
      titleOnly = clone.textContent.replace(/\s+/g, ' ').trim();
    }
    return {
      title: h ? h.textContent.trim() : '',
      title_only: titleOnly,
      cardH: card.offsetHeight,
      row1H: h ? h.offsetHeight : null,
      hasTag: Boolean(tagEl),
      tagFirstElement: h && tagEl ? h.firstElementChild === tagEl : null,
      tagIsFirstNode: h && tagEl ? h.firstChild === tagEl : null,
      tagText: tagEl ? tagEl.textContent : null,
      tagRect: tagEl ? (() => { const r = tagEl.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
      titleTextRect: textRect,
      tagTextRect,
      tagStyle: cs ? {
        backgroundColor: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        borderRadius: cs.borderTopLeftRadius, height: cs.height, lineHeight: cs.lineHeight,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        marginRight: cs.marginRight, display: cs.display, verticalAlign: cs.verticalAlign, whiteSpace: cs.whiteSpace,
      } : null,
    };
  });
  return { total: rows.length, tagCount: rows.filter((r) => r.hasTag).length, rows };
});

const desk = await readCards();
const bySuffix = (suffix) => desk.rows.find((r) => (r.title_only || r.title).startsWith(`${TS}-${suffix}`)) || null;
const arms = {
  PhysicalFreeShip: bySuffix('ship'),
  Digital: bySuffix('digital'),
  PhysicalBuyerShip: bySuffix('buyer'),
  NULL: bySuffix('null'),
};
const tagArm = arms.PhysicalFreeShip;
out.ac3.desktop_1536 = {
  viewport: page.viewportSize(),
  cards_total: desk.total,
  tag_count_global: desk.tagCount,
  arms_found: Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, Boolean(v)])),
  ship_arm: tagArm,
  non_ship_arms: Object.fromEntries(Object.entries(arms).filter(([k]) => k !== 'PhysicalFreeShip').map(([k, v]) => [k, v ? { hasTag: v.hasTag, row1H: v.row1H, cardH: v.cardH, tagText: v.tagText } : null])),
  checks: {
    tag_present_ship: Boolean(tagArm && tagArm.hasTag),
    tag_is_first_element: Boolean(tagArm && tagArm.tagFirstElement === true),
    tag_is_first_node: Boolean(tagArm && tagArm.tagIsFirstNode === true),
    tag_before_title_text: Boolean(tagArm && tagArm.tagRect && tagArm.titleTextRect && tagArm.tagRect.x < tagArm.titleTextRect.x),
    tag_text_baoyou: Boolean(tagArm && tagArm.tagText === '包邮'),
    bg_rgb_255_230_15: Boolean(tagArm && tagArm.tagStyle?.backgroundColor === 'rgb(255, 230, 15)'),
    color_rgb_32_32_32: Boolean(tagArm && tagArm.tagStyle?.color === 'rgb(32, 32, 32)'),
    font_12px: Boolean(tagArm && tagArm.tagStyle?.fontSize === '12px'),
    weight_700: Boolean(tagArm && tagArm.tagStyle?.fontWeight === '700'),
    row1_h_48: Boolean(tagArm && tagArm.row1H === 48),
    card_h_392: Boolean(tagArm && tagArm.cardH === 392),
    other_arms_no_tag: Object.entries(arms).filter(([k]) => k !== 'PhysicalFreeShip').every(([, v]) => v && v.hasTag === false),
    only_one_tag_in_feed: desk.tagCount === 1,
    non_tag_cards_row1_48: desk.rows.filter((r) => !r.hasTag).every((r) => r.row1H === 48),
    non_tag_cards_card_392: desk.rows.filter((r) => !r.hasTag).every((r) => r.cardH === 392),
  },
  page_errors: errors.slice(),
};

// ================= AC4 · 发布页 2+2 =================
const p2 = await ctx.newPage();
const reqLog = [];
p2.on('request', (r) => reqLog.push({ t: Date.now(), method: r.method(), url: r.url() }));
const p2errs = [];
p2.on('pageerror', (e) => p2errs.push(String(e)));
let extraListingId = null;
p2.on('response', async (r) => {
  if (r.url().endsWith('/api/listing') && r.request().method() === 'POST') {
    try { const j = await r.json(); if (j?.data?.listing_id) extraListingId = Number(j.data.listing_id); } catch {}
  }
});
await p2.goto(WEB + '/item/new', { waitUntil: 'domcontentloaded' });
await p2.waitForSelector('[data-sf-m="item-select-type"]', { timeout: 30000 });
await p2.fill('#root input[data-sf-m="item-input-title"]', `${TS}-publish-door`);
await p2.fill('#root input[data-sf-m="item-input-price"]', '4321');

const apiCount = (since) => reqLog.filter((r) => r.t >= since && r.url.includes('/api/')).length;
const snap = async (label, since) => p2.evaluate(({ label, apiN }) => {
  const typeG = document.querySelector('[data-sf-m="item-select-type"]');
  const shipG = document.querySelector('[data-sf-m="item-select-ship"]');
  const submit = document.querySelector('[data-sf-m="item-primary"]');
  const alert = [...document.querySelectorAll('[role="alert"], .sf-item-state, [data-sf-m="item-state"]')].map((n) => n.textContent.trim()).filter(Boolean);
  const bodyText = document.body.innerText;
  const checkedShip = shipG ? (shipG.querySelector('input[name="item_shipping"]:checked')?.value ?? null) : null;
  return {
    label,
    api_requests_since_marker: apiN,
    type_group_present: Boolean(typeG),
    ship_group_present: Boolean(shipG),
    type_miss: typeG ? typeG.getAttribute('data-sf-miss') : null,
    type_aria_invalid: typeG ? typeG.getAttribute('aria-invalid') : null,
    type_class_miss: typeG ? typeG.className.includes('sf-item-choice-miss') : null,
    ship_miss: shipG ? shipG.getAttribute('data-sf-miss') : null,
    ship_aria_invalid: shipG ? shipG.getAttribute('aria-invalid') : null,
    ship_class_miss: shipG ? shipG.className.includes('sf-item-choice-miss') : null,
    ship_checked: checkedShip,
    submit_disabled: submit ? submit.disabled : null,
    has_bad_request_text: bodyText.includes('请求参数错误'),
    type_group_text: typeG ? typeG.innerText.replace(/\n/g, '|') : null,
    ship_group_text: shipG ? shipG.innerText.replace(/\n/g, '|') : null,
  };
}, { label, apiN: apiCount(since) }).then((r) => ({ ...r, requests_since_marker: reqLog.filter((x) => x.t >= since && x.url.includes('/api/')).map((x) => `${x.method} ${x.url.replace(API, '')}`) }));

const results = [];

await p2.waitForLoadState('networkidle').catch(() => {});
await p2.waitForTimeout(600);

// A · 未选分类 ⇒ 零请求 + 分类组高亮
let mark = Date.now();
await p2.click('[data-sf-m="item-primary"]');
await p2.waitForTimeout(700);
results.push(await snap('A_unselected_type', mark));

// B · 选实物 → 运费组出现；未选运费 ⇒ 零请求 + 运费组高亮
await p2.click('[data-sf-m="item-input-type-physical"]');
await p2.waitForTimeout(250);
mark = Date.now();
await p2.click('[data-sf-m="item-primary"]');
await p2.waitForTimeout(700);
results.push(await snap('B_physical_no_ship', mark));

// C · 选包邮 → 切数字 ⇒ 运费组不渲染（联动 + 无 stale 值）
await p2.click('[data-sf-m="item-input-ship-free"]');
await p2.waitForTimeout(150);
const cBefore = await snap('C_before_switch_digital', Date.now());
await p2.click('[data-sf-m="item-input-type-digital"]');
await p2.waitForTimeout(250);
const cAfter = await snap('C_digital_ship_group_gone', Date.now());
// 再切回实物 ⇒ 运费组重现且选择已被清空（stale 值清除）
await p2.click('[data-sf-m="item-input-type-physical"]');
await p2.waitForTimeout(250);
const cBack = await snap('C_back_to_physical_ship_reset', Date.now());

// D · 正控臂（尺子灵敏度）：数字 + 必填齐 ⇒ 真发一次 ⇒ 必 ≥1 个 /api 请求（也证明前端载荷合法）
await p2.click('[data-sf-m="item-input-type-digital"]');
await p2.waitForTimeout(150);
mark = Date.now();
await p2.click('[data-sf-m="item-primary"]');
await p2.waitForTimeout(3500);
const dSnap = await snap('D_valid_digital_submit', mark);
const dRequests = reqLog.filter((r) => r.t >= mark && r.url.includes('/api/')).map((r) => `${r.method} ${r.url.replace(API, '')}`);

out.ac4 = {
  seed_ok: true,
  results,
  linkage: {
    c_before_switch: { ship_group_present: cBefore.ship_group_present, ship_checked: cBefore.ship_checked },
    c_after_switch_digital: { ship_group_present: cAfter.ship_group_present, type_miss: cAfter.type_miss },
    c_back_to_physical: { ship_group_present: cBack.ship_group_present, ship_checked: cBack.ship_checked },
  },
  positive_arm: { snap: dSnap, requests: dRequests, extra_listing_id: extraListingId, url_after: p2.url() },
  page_errors: p2errs.slice(),
  checks: {
    A_zero_api: results[0].api_requests_since_marker === 0,
    A_type_highlighted: results[0].type_miss === '1' && results[0].type_class_miss === true && results[0].type_aria_invalid === 'true',
    A_inline_hint: results[0].has_bad_request_text === true,
    B_zero_api: results[1].api_requests_since_marker === 0,
    B_ship_highlighted: results[1].ship_miss === '1' && results[1].ship_class_miss === true && results[1].ship_aria_invalid === 'true',
    B_ship_group_rendered_on_physical: results[1].ship_group_present === true,
    C_ship_group_absent_on_digital: cAfter.ship_group_present === false,
    C_ship_reset_on_return: cBack.ship_group_present === true && cBack.ship_checked === null,
    D_positive_requests: dRequests.length >= 1,
    D_positive_publish_id: Boolean(extraListingId),
  },
};
out.extra_publish = extraListingId ? { listing_id: extraListingId, title: `${TS}-publish-door`, item_type: 'Digital' } : null;
await p2.close();
await ctx.close();

// ================= AC6 · 390 档 =================
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN', reducedMotion: 'reduce' });
await mctx.addInitScript(seed(userPayload));
const mp = await mctx.newPage();
const merrs = [];
mp.on('pageerror', (e) => merrs.push(String(e)));
await mp.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
await mp.waitForSelector('[data-sf-m="reward-card-title"]', { timeout: 30000 });
await mp.waitForTimeout(1000);
const mob = await mp.evaluate(() => {
  const cards = [...document.querySelectorAll('.sf-reward-card')];
  const tags = [...document.querySelectorAll('[data-sf-m="reward-card-ship-tag"]')];
  const shipCard = tags[0]?.closest('.sf-reward-card') || null;
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    overflow_x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body_overflow_x: document.body.scrollWidth - document.body.clientWidth,
    cards: cards.length,
    tag_count: tags.length,
    ship_tag_text: tags[0]?.textContent ?? null,
    ship_card_h: shipCard ? shipCard.offsetHeight : null,
    ship_row1_h: shipCard ? shipCard.querySelector('[data-sf-m="reward-card-title"]').offsetHeight : null,
    tabbar_items: document.querySelectorAll('.sf-tabbar a, .sf-tabbar button').length,
  };
});
out.ac6.mobile_390 = { ...mob, page_errors: merrs.slice(), pass_overflow: mob.overflow_x === 0 && mob.body_overflow_x === 0 };
await mctx.close();
await browser.close();

out.ac3.checks_pass = Object.values(out.ac3.desktop_1536.checks).every(Boolean);
out.ac4.checks_pass = Object.values(out.ac4.checks).every(Boolean);
fs.writeFileSync(path.join(QA, 'readings/ac3-ac4-ac6-browser.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  login: out.login,
  ac3_checks: out.ac3.desktop_1536.checks,
  ac3_pass: out.ac3.checks_pass,
  ship_arm_style: out.ac3.desktop_1536.ship_arm?.tagStyle,
  ship_arm_rects: { tag: out.ac3.desktop_1536.ship_arm?.tagRect, text: out.ac3.desktop_1536.ship_arm?.titleTextRect },
  ac3_errors: out.ac3.desktop_1536.page_errors,
  ac4_checks: out.ac4.checks,
  ac4_results: out.ac4.results.map((r) => ({ label: r.label, api: r.api_requests_since_marker, reqs: r.requests_since_marker, type_miss: r.type_miss, ship_present: r.ship_group_present, ship_miss: r.ship_miss, checked: r.ship_checked, hint: r.has_bad_request_text })),
  ac3_arms: Object.fromEntries(Object.entries(out.ac3.desktop_1536.arms_found || {}).map(([k, v]) => [k, v])),
  ac4_positive: out.ac4.positive_arm,
  ac4_errors: out.ac4.page_errors,
  ac6_390: out.ac6.mobile_390,
}, null, 2));
