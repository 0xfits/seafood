// AC3（真页四类型黄/绿标签矩阵）+ AC4（发布页级联三控件 / 清空 / 三闸零请求 / 正控）+ AC6（390 零溢出）
// 真浏览器（系统 Chrome）+ 真 dev 站（localhost:5787）+ 真登录（ethers 钱包签名换真 token）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = '/Users/kevin/bistro/seafood';
const QA = path.join(REPO, 'ops/item-type/delivery/qa');
const req = createRequire(path.join(REPO, 'frontend/package.json'));
const { chromium } = req('playwright');
const beReq = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { Wallet } = beReq('ethers');
const { neon } = beReq('@neondatabase/serverless');

const API = 'http://localhost:5788';
const WEB = 'http://localhost:5787';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const created = JSON.parse(fs.readFileSync(path.join(QA, 'readings/created-listings.json'), 'utf8'));
const TS = created.run;

const envText = fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8');
const env = {};
for (const line of envText.split('\n')) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);

const out = { at: new Date().toISOString(), run: TS, login: {}, ac3: {}, ac4: {}, ac6: {}, ui_publishes: [] };

const wfile = path.join(process.env.TMPDIR || '/tmp', 'it4-qa-wallet.txt');
const [addr, pk] = fs.readFileSync(wfile, 'utf8').trim().split('\n');
const wallet = new Wallet(pk);
const address = addr;
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

// ==================== AC3 · 桌面 1536 真页 ====================
const ctx = await browser.newContext({ viewport: { width: 1536, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce', deviceScaleFactor: 1 });
await ctx.addInitScript(seed(userPayload));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror:' + String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
await page.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-sf-m="reward-card-ship-tag"]', { timeout: 30000 });
await page.waitForSelector('[data-sf-m="reward-card-auto-tag"]', { timeout: 30000 });
await page.waitForTimeout(1500);

const readCards = async () => page.evaluate(() => {
  const YELLOW = 'rgb(255, 230, 15)';
  const GREEN = 'rgb(74, 222, 128)';
  const cards = [...document.querySelectorAll('.sf-reward-card')];
  const rows = cards.map((card) => {
    const h = card.querySelector('[data-sf-m="reward-card-title"]');
    const ship = h ? h.querySelector('[data-sf-m="reward-card-ship-tag"]') : null;
    const auto = h ? h.querySelector('[data-sf-m="reward-card-auto-tag"]') : null;
    const tag = ship || auto || null;
    const cs = tag ? getComputedStyle(tag) : null;
    const clone = h ? h.cloneNode(true) : null;
    if (clone) clone.querySelectorAll('[data-sf-m="reward-card-ship-tag"], [data-sf-m="reward-card-auto-tag"]').forEach((n) => n.remove());
    let titleTextRect = null;
    if (h) {
      const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        if (!n.textContent || !n.textContent.trim()) continue;
        if (tag && tag.contains(n)) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        const rects = [...r.getClientRects()];
        const b = rects[0] || r.getBoundingClientRect();   // ★ 只取首行：多行 Range 的 boundingRect 是并集（x 会退回容器左缘）
        titleTextRect = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) }; break;
      }
    }
    const rect = tag ? (() => { const r = tag.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null;
    return {
      title: clone ? clone.textContent.replace(/\s+/g, ' ').trim() : (h ? h.textContent.trim() : ''),
      card_h: card.offsetHeight,
      row1_h: h ? h.offsetHeight : null,
      row1_class: h ? h.className : null,
      has_ship_tag: Boolean(ship),
      has_auto_tag: Boolean(auto),
      tag_first_element: tag && h ? h.firstElementChild === tag : null,
      tag_first_node: tag && h ? h.firstChild === tag : null,
      tag_text: tag ? tag.textContent : null,
      tag_rect: rect,
      title_text_rect: titleTextRect,
      tag_before_text: Boolean(rect && titleTextRect && rect.x < titleTextRect.x),
      style: cs ? {
        backgroundColor: cs.backgroundColor, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight, height: cs.height, borderRadius: cs.borderTopLeftRadius,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        marginRight: cs.marginRight, display: cs.display, verticalAlign: cs.verticalAlign,
      } : null,
      is_yellow: cs ? cs.backgroundColor === YELLOW : null,
      is_green: cs ? cs.backgroundColor === GREEN : null,
      classes: tag ? tag.className : null,
    };
  });
  return {
    total: cards.length,
    yellow_count: rows.filter((r) => r.is_yellow).length,
    green_count: rows.filter((r) => r.is_green).length,
    any_tag_count: rows.filter((r) => r.has_ship_tag || r.has_auto_tag).length,
    rows,
  };
});

const desk = await readCards();
const findArm = (arm) => desk.rows.find((r) => r.title.startsWith(`IT4-QA-${arm}-`)) || null;
const arms = {
  DigitalAutoDeliver: findArm('DigitalAutoDeliver'),
  DigitalManualDeliver: findArm('DigitalManualDeliver'),
  PhysicalFreeShip: findArm('PhysicalFreeShip'),
  PhysicalBuyerShip: findArm('PhysicalBuyerShip'),
};
const tagRows = desk.rows.filter((r) => r.has_ship_tag || r.has_auto_tag);
const yellow = arms.PhysicalFreeShip;
const green = arms.DigitalAutoDeliver;
const geomKeys = ['fontSize', 'fontWeight', 'lineHeight', 'height', 'borderRadius', 'padding', 'marginRight', 'display', 'verticalAlign', 'color'];
const geomEqual = Boolean(yellow?.style && green?.style && geomKeys.every((k) => yellow.style[k] === green.style[k]));

out.ac3.desktop_1536 = {
  viewport: page.viewportSize(),
  cards_total: desk.total,
  yellow_count: desk.yellow_count,
  green_count: desk.green_count,
  any_tag_count: desk.any_tag_count,
  arms_found: Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, Boolean(v)])),
  arms: Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, v ? {
    title: v.title, card_h: v.card_h, row1_h: v.row1_h,
    has_ship_tag: v.has_ship_tag, has_auto_tag: v.has_auto_tag,
    tag_text: v.tag_text, tag_first_element: v.tag_first_element, tag_first_node: v.tag_first_node,
    tag_before_text: v.tag_before_text, tag_rect: v.tag_rect, title_text_rect: v.title_text_rect,
    bg: v.style?.backgroundColor, fg: v.style?.color, classes: v.classes,
  } : null])),
  yellow_tag: { text: yellow?.tag_text, bg: yellow?.style?.backgroundColor, fg: yellow?.style?.color, classes: yellow?.classes },
  green_tag: { text: green?.tag_text, bg: green?.style?.backgroundColor, fg: green?.style?.color, classes: green?.classes },
  tag_geometry_keys: geomKeys,
  tag_geometry_equal: geomEqual,
  all_tag_rows: tagRows.map((r) => ({ title: r.title, ship: r.has_ship_tag, auto: r.has_auto_tag, first_el: r.tag_first_element, bg: r.style?.backgroundColor })),
  rows_not_48: desk.rows.filter((r) => r.row1_h !== 48).map((r) => ({ title: r.title, row1_h: r.row1_h })),
  cards_not_392: desk.rows.filter((r) => r.card_h !== 392).map((r) => ({ title: r.title, card_h: r.card_h })),
  checks: {
    four_arms_present: Object.values(arms).every(Boolean),
    yellow_only_on_PhysicalFreeShip: Boolean(yellow?.has_ship_tag) && desk.rows.filter((r) => r.is_yellow).length === 1 && yellow.is_yellow === true,
    green_only_on_DigitalAutoDeliver: Boolean(green?.has_auto_tag) && desk.rows.filter((r) => r.is_green).length === 1 && green.is_green === true,
    DigitalManualDeliver_no_tag: arms.DigitalManualDeliver ? arms.DigitalManualDeliver.has_ship_tag === false && arms.DigitalManualDeliver.has_auto_tag === false : false,
    PhysicalBuyerShip_no_tag: arms.PhysicalBuyerShip ? arms.PhysicalBuyerShip.has_ship_tag === false && arms.PhysicalBuyerShip.has_auto_tag === false : false,
    all_tags_first_element: tagRows.length > 0 && tagRows.every((r) => r.tag_first_element === true),
    all_tags_first_node: tagRows.length > 0 && tagRows.every((r) => r.tag_first_node === true),
    all_tags_before_text: tagRows.every((r) => r.tag_before_text === true),
    yellow_count_is_1: desk.yellow_count === 1,
    green_count_is_1: desk.green_count === 1,
    yellow_rgb_255_230_15: yellow?.style?.backgroundColor === 'rgb(255, 230, 15)',
    green_rgb_74_222_128: green?.style?.backgroundColor === 'rgb(74, 222, 128)',
    tag_text_baoyou: yellow?.tag_text === '包邮',
    tag_text_auto: green?.tag_text === '自动发货',
    tag_12px_700: yellow?.style?.fontSize === '12px' && yellow?.style?.fontWeight === '700' && green?.style?.fontSize === '12px' && green?.style?.fontWeight === '700',
    tag_geometry_equal: geomEqual,
    row1_all_48: desk.rows.every((r) => r.row1_h === 48),
    card_all_392: desk.rows.every((r) => r.card_h === 392),
    zero_page_errors: errors.length === 0,
  },
  page_errors: errors.slice(),
};

// ==================== AC4 · 发布页级联三控件 ====================
const p2 = await ctx.newPage();
const reqLog = [];
const p2errs = [];
p2.on('request', (r) => reqLog.push({ t: Date.now(), method: r.method(), url: r.url() }));
p2.on('pageerror', (e) => p2errs.push(String(e)));
const postedPayloads = [];
const postedResponses = [];
p2.on('request', (r) => {
  if (r.url().endsWith('/api/listing') && r.method() === 'POST') {
    try { postedPayloads.push(JSON.parse(r.postData() || '{}')); } catch { postedPayloads.push({ parse_error: true }); }
  }
});
p2.on('response', async (r) => {
  if (r.url().endsWith('/api/listing') && r.request().method() === 'POST') {
    let j = null; try { j = await r.json(); } catch {}
    postedResponses.push({ status: r.status(), body: j });
  }
});

const apiSince = (t) => reqLog.filter((r) => r.t >= t && r.url.includes('/api/'));
const snap = async (label, mark) => {
  const s = await p2.evaluate(() => {
    const g = (k) => document.querySelector(`[data-sf-m="${k}"]`);
    const typeG = g('item-select-type'); const delG = g('item-select-deliver'); const shipG = g('item-select-ship');
    const checked = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
    const desc = (n) => n ? { present: true, miss: n.getAttribute('data-sf-miss'), aria_invalid: n.getAttribute('aria-invalid'), class_miss: n.className.includes('sf-item-choice-miss'), checked: null } : { present: false };
    return {
      type: desc(typeG), deliver: desc(delG), ship: desc(shipG),
      type_checked: checked('item_type'), deliver_checked: checked('item_deliver'), ship_checked: checked('item_shipping'),
      submit_disabled: g('item-primary') ? g('item-primary').disabled : null,
      body_has_badrequest: document.body.innerText.includes('请求参数错误'),
      url: location.pathname + location.search,
    };
  });
  return { label, ...s, api_requests: apiSince(mark).map((r) => `${r.method} ${r.url.replace(API, '')}`), api_count: apiSince(mark).length };
};

const openPublish = async () => {
  await p2.goto(WEB + '/item/new', { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('[data-sf-m="item-select-type"]', { timeout: 30000 });
  await p2.waitForLoadState('networkidle').catch(() => {});
  await p2.fill('#root input[data-sf-m="item-input-title"]', `IT4-QA-ui-${Date.now()}`);
  await p2.fill('#root input[data-sf-m="item-input-price"]', '4321');
  await p2.waitForTimeout(300);
};
await openPublish();

const gateSteps = [];
// 闸 A：一级未选
let mark = Date.now();
await p2.click('[data-sf-m="item-primary"]');
await p2.waitForTimeout(700);
gateSteps.push(await snap('A_no_type', mark));

// 闸 B：数字分支未选二级
await p2.click('[data-sf-m="item-input-type-digital"]');
await p2.waitForTimeout(300);
const c1 = await snap('C1_digital_branch', Date.now());
mark = Date.now();
await p2.click('[data-sf-m="item-primary"]');
await p2.waitForTimeout(700);
gateSteps.push(await snap('B_digital_no_deliver', mark));

// 联动：数字选 auto → 切实物 ⇒ deliver 控件不在 DOM、ship 控件在且未选；再切回数字 ⇒ deliver 值已被清空
await p2.click('[data-sf-m="item-input-deliver-auto"]');
await p2.waitForTimeout(200);
const c2 = await snap('C2_digital_auto_selected', Date.now());
await p2.click('[data-sf-m="item-input-type-physical"]');
await p2.waitForTimeout(300);
const c3 = await snap('C3_switch_to_physical', Date.now());
await p2.click('[data-sf-m="item-input-type-digital"]');
await p2.waitForTimeout(300);
const c4 = await snap('C4_back_to_digital_cleared', Date.now());

// 闸 C：实物分支未选运费
await p2.click('[data-sf-m="item-input-type-physical"]');
await p2.waitForTimeout(250);
mark = Date.now();
await p2.click('[data-sf-m="item-primary"]');
await p2.waitForTimeout(700);
gateSteps.push(await snap('C_physical_no_ship', mark));

// 正控四组合：每次真提交，抓 POST 载荷里的 item_type + 库内值
const combos = [
  { label: 'digital_auto', path: ['item-input-type-digital', 'item-input-deliver-auto'], expect: 'DigitalAutoDeliver' },
  { label: 'digital_manual', path: ['item-input-type-digital', 'item-input-deliver-manual'], expect: 'DigitalManualDeliver' },
  { label: 'physical_free', path: ['item-input-type-physical', 'item-input-ship-free'], expect: 'PhysicalFreeShip' },
  { label: 'physical_buyer', path: ['item-input-type-physical', 'item-input-ship-buyer'], expect: 'PhysicalBuyerShip' },
];
for (const combo of combos) {
  await openPublish();
  for (const h of combo.path) { await p2.click(`[data-sf-m="${h}"]`); await p2.waitForTimeout(150); }
  const m = Date.now();
  await p2.click('[data-sf-m="item-primary"]');
  await p2.waitForTimeout(3500);
  const reqs = apiSince(m).map((r) => `${r.method} ${r.url.replace(API, '')}`);
  const payload = postedPayloads[postedPayloads.length - 1] || null;
  const resp = postedResponses[postedResponses.length - 1] || null;
  const idFromResp = resp?.body?.data?.listing_id ?? resp?.body?.data?.listingId ?? null;
  const idFromUrl = await p2.evaluate(() => {
    const m2 = location.pathname.match(/\/item\/(\d+)/);
    return m2 ? Number(m2[1]) : null;
  });
  const idAfter = idFromResp != null ? Number(idFromResp) : idFromUrl;
  const respStatus = resp?.status ?? null;
  let dbType = null, dbTitle = null;
  if (idAfter) {
    const row = (await sql`SELECT item_type, title FROM public.listing WHERE listing_id = ${idAfter}`)[0];
    dbType = row?.item_type ?? null; dbTitle = row?.title ?? null;
  }
  out.ui_publishes.push({
    combo: combo.label, expect: combo.expect, requests: reqs, api_count: reqs.length,
    response_status: respStatus,
    payload_item_type: payload?.item_type ?? null, payload_title: payload?.title ?? null,
    listing_id: idAfter, db_item_type: dbType, db_title: dbTitle,
    url_after: p2.url(),
    pass: reqs.length >= 1 && respStatus === 200 && (payload?.item_type ?? null) === combo.expect && dbType === combo.expect && dbTitle === (payload?.title ?? null),
  });
}

out.ac4 = {
  steps: gateSteps,
  cascade: { c1_digital_branch: c1, c2_auto_selected: c2, c3_switch_physical: c3, c4_back_digital: c4 },
  ui_publishes: out.ui_publishes,
  page_errors: p2errs.slice(),
  checks: {
    A_zero_requests: gateSteps[0].api_count === 0,
    A_type_highlighted: gateSteps[0].type.miss === '1' && gateSteps[0].type.class_miss === true && gateSteps[0].type.aria_invalid === 'true',
    A_hint_shown: gateSteps[0].body_has_badrequest === true,
    B_zero_requests: gateSteps[1].api_count === 0,
    B_deliver_highlighted: gateSteps[1].deliver.miss === '1' && gateSteps[1].deliver.class_miss === true && gateSteps[1].deliver.aria_invalid === 'true',
    C_zero_requests: gateSteps[2].api_count === 0,
    C_ship_highlighted: gateSteps[2].ship.miss === '1' && gateSteps[2].ship.class_miss === true && gateSteps[2].ship.aria_invalid === 'true',
    digital_branch_has_deliver_not_ship: c1.deliver.present === true && c1.ship.present === false,
    switch_to_physical_swaps_controls: c3.deliver.present === false && c3.ship.present === true,
    switch_clears_second_level: c2.deliver_checked === 'auto' && c4.deliver_checked === null,
    physical_ship_unselected_after_swap: c3.ship_checked === null,
    four_combos_positive: out.ui_publishes.length === 4 && out.ui_publishes.every((p) => p.pass),
    zero_page_errors: p2errs.length === 0,
  },
};
await p2.close();
await ctx.close();

// ==================== AC6 · 390 档 ====================
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN', reducedMotion: 'reduce' });
await mctx.addInitScript(seed(userPayload));
const mp = await mctx.newPage();
const merrs = [];
mp.on('pageerror', (e) => merrs.push(String(e)));
await mp.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
await mp.waitForSelector('[data-sf-m="reward-card-title"]', { timeout: 30000 });
await mp.waitForTimeout(1200);
const mob = await mp.evaluate(() => {
  const tags = [...document.querySelectorAll('[data-sf-m="reward-card-ship-tag"], [data-sf-m="reward-card-auto-tag"]')];
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    overflow_x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body_overflow_x: document.body.scrollWidth - document.body.clientWidth,
    cards: document.querySelectorAll('.sf-reward-card').length,
    yellow: tags.filter((t) => getComputedStyle(t).backgroundColor === 'rgb(255, 230, 15)').length,
    green: tags.filter((t) => getComputedStyle(t).backgroundColor === 'rgb(74, 222, 128)').length,
    tabbar_items: document.querySelectorAll('.sf-tabbar a, .sf-tabbar button').length,
  };
});
out.ac6.mobile_390 = { ...mob, page_errors: merrs.slice(), checks: { zero_overflow: mob.overflow_x === 0 && mob.body_overflow_x === 0, zero_page_errors: merrs.length === 0 } };
await mctx.close();
await browser.close();

out.ac3.checks_pass = Object.values(out.ac3.desktop_1536.checks).every(Boolean);
out.ac4.checks_pass = Object.values(out.ac4.checks).every(Boolean);
fs.writeFileSync(path.join(QA, 'readings/ac3-ac4-ac6-browser.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  login: out.login,
  ac3_checks: out.ac3.desktop_1536.checks,
  ac3_pass: out.ac3.checks_pass,
  ac3_counts: { cards: desk.total, yellow: desk.yellow_count, green: desk.green_count, any: desk.any_tag_count },
  ac3_yellow: out.ac3.desktop_1536.yellow_tag,
  ac3_green: out.ac3.desktop_1536.green_tag,
  ac3_arms: out.ac3.desktop_1536.arms,
  ac3_errors: out.ac3.desktop_1536.page_errors,
  ac4_checks: out.ac4.checks,
  ac4_pass: out.ac4.checks_pass,
  ac4_steps: gateSteps.map((s) => ({ label: s.label, api_count: s.api_count, type: s.type, deliver: s.deliver, ship: s.ship })),
  ac4_publishes: out.ui_publishes.map((p) => ({ combo: p.combo, payload: p.payload_item_type, db: p.db_item_type, id: p.listing_id, pass: p.pass, reqs: p.requests })),
  ac4_errors: out.ac4.page_errors,
  ac6: out.ac6.mobile_390,
}, null, 2));
