// AC2 补采：详情口逐行对拍（4 类型 + NULL 臂）+ 读口键名对比 feed/detail 差集
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = '/Users/kevin/bistro/seafood';
const QA = path.join(REPO, 'ops/item-type/delivery/qa');
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');

const envText = fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8');
const env = {};
for (const line of envText.split('\n')) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);
const BASE = 'http://localhost:5788';
const created = JSON.parse(fs.readFileSync(path.join(QA, 'readings/created-listings.json'), 'utf8'));

const get = async (p) => { const r = await fetch(BASE + p); return { status: r.status, json: await r.json().catch(() => null) }; };

const rows = [];
for (const c of created.created) {
  const d = await get(`/api/prize/${c.listing_id}`);
  const dd = d.json?.data || {};
  const db = (await sql`SELECT item_type, status FROM public.listing WHERE listing_id = ${c.listing_id}`)[0] || {};
  rows.push({
    listing_id: c.listing_id, arm: c.arm, http: d.status,
    detail_item_type: dd.item_type ?? null, db_item_type: db.item_type ?? null,
    detail_name: dd.name ?? null, key_count: Object.keys(dd).length,
    has_item_type_key: Object.prototype.hasOwnProperty.call(dd, 'item_type'),
    pass: (dd.item_type ?? null) === (db.item_type ?? null) && Object.prototype.hasOwnProperty.call(dd, 'item_type'),
  });
}

const feed = await get('/api/prize/all?skip=0&limit=200');
const feedRows = Array.isArray(feed.json?.data) ? feed.json.data : [];
const feedKeys = feedRows[0] ? Object.keys(feedRows[0]) : [];
const detail = await get(`/api/prize/${rows[0]?.listing_id}`);
const detailKeys = detail.json?.data ? Object.keys(detail.json.data) : [];
const onlyFeed = feedKeys.filter((k) => !detailKeys.includes(k));
const onlyDetail = detailKeys.filter((k) => !feedKeys.includes(k));

const out = {
  at: new Date().toISOString(),
  detail_rows: rows,
  detail_all_pass: rows.every((r) => r.pass),
  key_counts: { feed: feedKeys.length, detail: detailKeys.length },
  keys_only_in_feed: onlyFeed,
  keys_only_in_detail: onlyDetail,
  feed_rows_listed: feedRows.length,
  item_type_value_counts: feedRows.reduce((a, r) => { const k = String(r.item_type ?? 'NULL'); a[k] = (a[k] || 0) + 1; return a; }, {}),
};
fs.writeFileSync(path.join(QA, 'readings/ac2-detail-rows.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
