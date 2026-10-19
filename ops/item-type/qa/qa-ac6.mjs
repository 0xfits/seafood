// AC6 · 回归读数（HTTP 面）：/api/currencies 2 行 · /api/media/999 404 · /api/prize/1 零异常
// 390 档零溢出读数在 readings/ac3-ac4-ac6-browser.json 的 ac6.mobile_390。
import fs from 'node:fs';
import path from 'node:path';

const QA = '/Users/kevin/bistro/seafood/ops/item-type/qa';
const API = 'http://localhost:5788';
const out = { at: new Date().toISOString(), base: API };

const get = async (p) => {
  const r = await fetch(API + p);
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};

const cur = await get('/api/currencies');
out.currencies = {
  http: cur.status,
  success: cur.json?.success ?? null,
  rows: Array.isArray(cur.json?.data) ? cur.json.data.length : null,
  row_keys: Array.isArray(cur.json?.data) && cur.json.data[0] ? Object.keys(cur.json.data[0]).sort() : [],
  values: Array.isArray(cur.json?.data) ? cur.json.data.map((r) => ({ cid: r.cid, symbol: r.symbol })) : null,
  pass: cur.status === 200 && Array.isArray(cur.json?.data) && cur.json.data.length === 2,
};

const m = await get('/api/media/999');
out.media_999 = {
  http: m.status,
  code: m.json?.error?.code ?? null,
  reason: m.json?.error?.details?.reason ?? null,
  body: m.json,
  pass: m.status === 404 && m.json?.error?.code === 'LEDGER_REF_NOT_FOUND',
};

const p1 = await get('/api/prize/1');
const d = p1.json?.data || null;
out.prize_1 = {
  http: p1.status,
  success: p1.json?.success ?? null,
  has_error: Boolean(p1.json?.error),
  key_count: d ? Object.keys(d).length : null,
  has_item_type: d ? Object.prototype.hasOwnProperty.call(d, 'item_type') : false,
  item_type: d ? d.item_type ?? null : null,
  bID: d?.bID ?? null,
  pass: p1.status === 200 && p1.json?.success === true && !p1.json?.error && Boolean(d),
};

// 详情页真页零异常（浏览器侧旁证：/item/1 打开后 #root 有内容且无 pageerror）
out.checks = { currencies_2: out.currencies.pass, media_999_404: out.media_999.pass, prize_1_clean: out.prize_1.pass };
out.pass = Object.values(out.checks).every(Boolean);
fs.writeFileSync(path.join(QA, 'readings/ac6-regression-http.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
