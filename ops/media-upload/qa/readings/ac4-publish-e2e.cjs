/**
 * AC4 · 发布 E2E（真 token：上传 → 建商品带 media_urls → PATCH listed → DB 核对 → 读口透出）
 * ---------------------------------------------------------------------
 * E1 POST /api/listing{cid:1, price, stock, title, description, media_urls:[url], create_key} ⇒ 200 + listing_id
 * E2 PATCH /api/listing/<id> {to_status:'listed'} ⇒ 200 且 status=listed
 * E3 DB（只读）该行 media_urls = {url}（逐字）
 * E4 GET /api/prize/all 该 bID 行 media_urls 与 DB 一致
 * E5 GET /api/prize/<id> 行 media_urls 与 DB 一致
 * 另建一件**无图**商品（media_urls 缺省 ⇒ []）供 AC6 占位分支使用（同样登记进 _state.json 待回收）。
 */
const fs = require('fs');
const path = require('path');
const { login, jsonFetch } = require('../lib/auth.cjs');
const { q } = require('../lib/db.cjs');

const BASE = process.env.QA_API_BASE || 'http://localhost:5788';
const STATE = path.join(__dirname, '_state.json');
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const out = { ac: 'AC4', generated_at: new Date().toISOString(), base: BASE, checks: [] };
const t = (id, what, pass, reading, extra) => out.checks.push({ id, what, pass: !!pass, reading, ...(extra ? { extra } : {}) });

const api = (method, p, body, token) => jsonFetch(`${BASE}${p}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

(async () => {
  if (!state.media) throw new Error('AC3 media not found in _state.json — run ac3 first');
  const mediaUrl = state.media.url;

  const session = await login('ac4');
  const token = session.token;
  out.actor = { uid: session.uid, address_tail: session.address_tail };

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  // E1 —— 带图商品
  const create1 = await api('POST', '/api/listing', {
    cid: 1,
    price: 100,
    stock: 1,
    title: `QA媒体单-带图-${stamp}`,
    description: 'QA media upload E2E (with image) — 自动回收',
    media_urls: [mediaUrl],
    create_key: `cli:qa-media-e2e-img-${stamp}`,
  }, token);
  const l1 = create1.body?.data ?? {};
  out.create_with_image = { http: create1.status, data: l1, error: create1.body?.error ?? null };
  t('E1', 'POST /api/listing（cid=1 · price=100 · stock=1 · media_urls:[url] · create_key）⇒ 200 + listing_id',
    create1.status === 200 && Number(l1.listing_id) > 0,
    `http=${create1.status} listing_id=${l1.listing_id} status=${l1.status} media_urls=${JSON.stringify(l1.media_urls)}`);

  // E2 —— 转 listed
  const listingId = Number(l1.listing_id);
  const patch = await api('PATCH', `/api/listing/${listingId}`, { to_status: 'listed' }, token);
  const p1 = patch.body?.data ?? {};
  out.patch_listed = { http: patch.status, data: p1 };
  t('E2', 'PATCH /api/listing/<id> {to_status:listed} ⇒ 200 且 status=listed',
    patch.status === 200 && String(p1.status) === 'listed',
    `http=${patch.status} status=${p1.status}`);

  // E3 —— DB 逐字核对
  const dbRow = (await q(`select listing_id, seller_uid, cid, price, stock, status, media_urls, create_key
    from public.listing where listing_id = ${listingId}`))[0];
  out.db_row = dbRow;
  const dbUrls = dbRow?.media_urls ?? null;
  t('E3', 'DB listing 行 media_urls 恰 = [url]（逐字包含 · 长度 1）',
    Array.isArray(dbUrls) && dbUrls.length === 1 && dbUrls[0] === mediaUrl,
    `db_media_urls=${JSON.stringify(dbUrls)} expect=["${mediaUrl}"] status=${dbRow?.status}`);

  // E4 —— /api/prize/all
  const all = await api('GET', '/api/prize/all?limit=100&skip=0', undefined, null);
  const allRows = all.body?.data ?? [];
  const rowAll = Array.isArray(allRows) ? allRows.find((r) => Number(r.bID) === listingId) : null;
  out.prize_all_row = rowAll ? { bID: rowAll.bID, media_urls: rowAll.media_urls, name: rowAll.name } : null;
  t('E4', 'GET /api/prize/all 中该 bID 行 media_urls 与 DB 一致',
    all.status === 200 && !!rowAll && JSON.stringify(rowAll.media_urls) === JSON.stringify(dbUrls),
    `http=${all.status} rows=${Array.isArray(allRows) ? allRows.length : 'n/a'} found=${!!rowAll} media_urls=${JSON.stringify(rowAll?.media_urls)}`);

  // E5 —— /api/prize/:id
  const one = await api('GET', `/api/prize/${listingId}`, undefined, null);
  const rowOne = one.body?.data ?? null;
  out.prize_one_row = rowOne ? { bID: rowOne.bID, media_urls: rowOne.media_urls, name: rowOne.name } : null;
  t('E5', 'GET /api/prize/<id> 行 media_urls 与 DB 一致',
    one.status === 200 && !!rowOne && JSON.stringify(rowOne.media_urls) === JSON.stringify(dbUrls),
    `http=${one.status} media_urls=${JSON.stringify(rowOne?.media_urls)}`);

  // 附加：无图商品（AC6 占位分支用）
  const create2 = await api('POST', '/api/listing', {
    cid: 1,
    price: 50,
    stock: 1,
    title: `QA媒体单-无图-${stamp}`,
    description: 'QA media upload E2E (no image) — 自动回收',
    create_key: `cli:qa-media-e2e-noimg-${stamp}`,
  }, token);
  const l2 = create2.body?.data ?? {};
  const listingIdNoImg = Number(l2.listing_id);
  const patch2 = await api('PATCH', `/api/listing/${listingIdNoImg}`, { to_status: 'listed' }, token);
  const dbRow2 = (await q(`select listing_id, status, media_urls from public.listing where listing_id = ${listingIdNoImg}`))[0];
  out.no_image_listing = { http: create2.status, error: create2.body?.error ?? null, listing_id: listingIdNoImg, patch_http: patch2.status, db: dbRow2 };
  t('E6', '无图商品（不传 media_urls）⇒ DB media_urls = {}（空数组）且已 listed',
    create2.status === 200 && patch2.status === 200 && dbRow2?.status === 'listed'
      && Array.isArray(dbRow2?.media_urls) && dbRow2.media_urls.length === 0,
    `listing_id=${listingIdNoImg} db_media_urls=${JSON.stringify(dbRow2?.media_urls)} status=${dbRow2?.status}`);

  state.listings = {
    ...(state.listings || {}),
    with_image: { listing_id: listingId, seller_uid: session.uid, media_url: mediaUrl, title: `QA媒体单-带图-${stamp}` },
    no_image: { listing_id: listingIdNoImg, seller_uid: session.uid, title: `QA媒体单-无图-${stamp}` },
  };
  state.actors = { ...(state.actors || {}), ac4: { uid: session.uid, address_tail: session.address_tail } };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

  out.pass = out.checks.every((c) => c.pass);
  out.failed = out.checks.filter((c) => !c.pass).map((c) => c.id);
  fs.writeFileSync(path.join(__dirname, 'ac4-publish-e2e.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, failed: out.failed, checks: out.checks.map((c) => `${c.id} ${c.pass ? 'PASS' : 'FAIL'} :: ${c.reading}`) }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.message; out.pass = false;
  fs.writeFileSync(path.join(__dirname, 'ac4-publish-e2e.json'), JSON.stringify(out, null, 2));
  console.error(e.stack); process.exitCode = 1;
});
