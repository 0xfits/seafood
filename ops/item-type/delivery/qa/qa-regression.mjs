// AC6 回归面读数（HTTP 侧）+ 回收后库面复核：清单固定四项
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
const API = 'http://localhost:5788';
const get = async (p) => { const r = await fetch(API + p); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };

const cur = await get('/api/currencies');
const media = await get('/api/media/999');
const health = await get('/api/health');

const projectId = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid;
const listingRows = await sql`SELECT listing_id, item_type, status FROM public.listing ORDER BY listing_id`;
const nonNull = listingRows.filter((r) => r.item_type !== null);
const dist = listingRows.reduce((a, r) => { const k = String(r.item_type ?? 'NULL'); a[k] = (a[k] || 0) + 1; return a; }, {});

const feed = await get('/api/prize/all?skip=0&limit=200');
const feedRows = Array.isArray(feed.json?.data) ? feed.json.data : [];
const feedNonNull = feedRows.filter((r) => (r.item_type ?? null) !== null);

const out = {
  at: new Date().toISOString(),
  project_id: projectId,
  health: { status: health.status, schema_version: health.json?.schema_version },
  currencies: { status: cur.status, rows: Array.isArray(cur.json?.data) ? cur.json.data.length : null, data: cur.json?.data },
  media_999: { status: media.status, code: media.json?.error?.code ?? media.json?.code ?? null },
  listing_total: listingRows.length,
  listing_item_type_non_null: nonNull.length,
  listing_item_type_distribution: dist,
  feed: { http: feed.status, rows: feedRows.length, non_null_item_type: feedNonNull.length, key_count: feedRows[0] ? Object.keys(feedRows[0]).length : null },
  checks: {
    currencies_two_rows: cur.status === 200 && Array.isArray(cur.json?.data) && cur.json.data.length === 2,
    media_999_404: media.status === 404,
    schema_0054: health.json?.schema_version === '0054',
    existing_rows_all_null: nonNull.length === 0,
    listing_back_to_26: listingRows.length === 26,
  },
};
fs.writeFileSync(path.join(QA, 'readings/ac6-regression-http.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
