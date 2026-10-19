// AC1（写口边界）+ AC2（读口键数）探针 · item-type QA
// 真钱包登录（ethers 随机钱包 → challenge/signMessage/verify）→ 真写 dev 库（自建行，收口时回收）。
// 零产品代码改动；只读 + 自建夹具写。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const REPO = '/Users/kevin/bistro/seafood';
const QA = path.join(REPO, 'ops/item-type/qa');
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');
const { Wallet } = req('ethers');

const envText = fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);
const BASE = 'http://localhost:5788';
const TS = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const TAG = `IT-TYPE-QA-${TS}`;

const out = { run: TS, base: BASE, wallet: {}, login: {}, cases: [], read_port: {}, created: [], notes: [] };

const jfetch = async (method, p, body, token) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
};

// ---- 登录 ----
const wallet = Wallet.createRandom();
const address = wallet.address.toLowerCase();
fs.writeFileSync(path.join(process.env.TMPDIR || '/tmp', 'itemtype-qa-wallet.txt'), `${address}\n${wallet.privateKey}\n`, { mode: 0o600 });
out.wallet = { address };
const ch = await jfetch('POST', '/api/auth/challenge', { evm_address: address });
if (ch.status !== 200) { out.login = { error: 'challenge failed', status: ch.status, body: ch.json }; console.log(JSON.stringify(out, null, 2)); process.exit(1); }
const message = ch.json?.data?.message;
const signature = await wallet.signMessage(message);
const vf = await jfetch('POST', '/api/auth/verify', { evm_address: address, signature, challenge_token: ch.json?.data?.challenge_token });
if (vf.status !== 200) { out.login = { error: 'verify failed', status: vf.status, body: vf.json }; console.log(JSON.stringify(out, null, 2)); process.exit(1); }
const token = vf.json?.data?.token || vf.json?.data?.access_token;
const uid = vf.json?.data?.uID ?? vf.json?.data?.uid;
out.login = { challenge_http: ch.status, verify_http: vf.status, uid, evm: vf.json?.data?.EVM || vf.json?.data?.evm, token_len: String(token || '').length };

const dbItemType = async (listingId) => {
  const r = await sql`SELECT item_type, status, title FROM public.listing WHERE listing_id = ${listingId}`;
  return r[0] || null;
};

const mkBody = (suffix, extra = {}) => ({
  cid: 1,
  price: '1234',
  stock: '1',
  title: `${TAG}-${suffix}`,
  description: `QA 夹具 · ${TAG} · 收口即删`,
  media_urls: [],
  create_key: `cli:${crypto.randomUUID()}`,
  ...extra,
});

// ---- AC1 · 三合法值 ----
const validCases = [
  ['valid_Digital', 'Digital', 'digital'],
  ['valid_PhysicalFreeShip', 'PhysicalFreeShip', 'ship'],
  ['valid_PhysicalBuyerShip', 'PhysicalBuyerShip', 'buyer'],
];
for (const [label, value, suffix] of validCases) {
  const r = await jfetch('POST', '/api/listing', mkBody(suffix, { item_type: value }), token);
  const id = r.json?.data?.listing_id ?? null;
  const row = id ? await dbItemType(id) : null;
  out.cases.push({ case: label, sent: { item_type: value }, http: r.status, code: r.json?.code ?? null, db_listing_id: id, db_item_type: row?.item_type ?? null, pass: r.status === 200 && row?.item_type === value });
  if (id) out.created.push({ listing_id: Number(id), arm: value, suffix });
}

// ---- AC1 · 缺省 / 不传 ⇒ NULL ----
{
  const r = await jfetch('POST', '/api/listing', mkBody('null'), token);
  const id = r.json?.data?.listing_id ?? null;
  const row = id ? await dbItemType(id) : null;
  out.cases.push({ case: 'omit_item_type', sent: '(field absent)', http: r.status, code: r.json?.code ?? null, db_listing_id: id, db_item_type: row?.item_type ?? null, pass: r.status === 200 && row?.item_type === null });
  if (id) out.created.push({ listing_id: Number(id), arm: 'NULL', suffix: 'null' });
}
{
  const r = await jfetch('POST', '/api/listing', mkBody('nullable', { item_type: null }), token);
  const id = r.json?.data?.listing_id ?? null;
  const row = id ? await dbItemType(id) : null;
  out.cases.push({ case: 'explicit_null', sent: { item_type: null }, http: r.status, code: r.json?.code ?? null, db_listing_id: id, db_item_type: row?.item_type ?? null, pass: r.status === 200 && row?.item_type === null });
  if (id) out.created.push({ listing_id: Number(id), arm: 'NULL', suffix: 'nullable' });
}

// ---- AC1 · 非法四例 ⇒ 400 + LEDGER_AMOUNT_INVALID + NOT_IN_CLOSED_SET + allowed 三值 ----
const badCases = [
  ['empty_string', ''],
  ['spaces', '   '],
  ['lowercase_digital', 'digital'],
  ['bogus', 'Bogus'],
];
for (const [label, value] of badCases) {
  const r = await jfetch('POST', '/api/listing', mkBody(`bad-${label}`, { item_type: value }), token);
  const err = r.json?.error || r.json || {};
  const details = err.details || r.json?.details || null;
  const allowed = details?.allowed;
  const pass = r.status === 400
    && (err.code === 'LEDGER_AMOUNT_INVALID' || r.json?.code === 'LEDGER_AMOUNT_INVALID')
    && details?.reason === 'NOT_IN_CLOSED_SET'
    && Array.isArray(allowed) && allowed.length === 3
    && ['Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip'].every((v) => allowed.includes(v));
  out.cases.push({ case: `invalid_${label}`, sent: { item_type: value }, http: r.status, code: err.code ?? r.json?.code ?? null, details, body: r.json, pass });
  // 非法值不得落库
  const leaked = await sql`SELECT count(*)::int AS n FROM public.listing WHERE title = ${`${TAG}-bad-${label}`}`;
  if (leaked[0].n !== 0) out.notes.push(`invalid case ${label} leaked ${leaked[0].n} row(s)`);
}

// ---- AC1 · PATCH 带 item_type ⇒ 不改库内值 ----
{
  const created = await jfetch('POST', '/api/listing', mkBody('patch', { item_type: 'Digital' }), token);
  const id = created.json?.data?.listing_id;
  const before = await dbItemType(id);
  const p1 = await jfetch('PATCH', `/api/listing/${id}`, { to_status: 'listed', item_type: 'PhysicalBuyerShip' }, token);
  const after = await dbItemType(id);
  out.cases.push({ case: 'patch_with_item_type', listing_id: Number(id), sent: { to_status: 'listed', item_type: 'PhysicalBuyerShip' }, http: p1.status, code: p1.json?.error?.code ?? p1.json?.code ?? null, db_before: before?.item_type ?? null, db_after: after?.item_type ?? null, db_status_after: after?.status ?? null, pass: p1.status === 200 && after?.item_type === before?.item_type && after?.status === 'listed' });
  const p2 = await jfetch('PATCH', `/api/listing/${id}`, { item_type: 'PhysicalFreeShip' }, token);
  const after2 = await dbItemType(id);
  out.cases.push({ case: 'patch_item_type_only', listing_id: Number(id), sent: { item_type: 'PhysicalFreeShip' }, http: p2.status, code: p2.json?.error?.code ?? p2.json?.code ?? null, db_after: after2?.item_type ?? null, pass: after2?.item_type === before?.item_type, http_expected: '400 或 200 均可（本条只判库值不变）' });
  out.created.push({ listing_id: Number(id), arm: 'PATCH_CASE', suffix: 'patch' });
}

// ---- AC1 · 编辑口（POST /api/listing/:id）同样不改类型（第二写口核对） ----
{
  const target = out.created.find((c) => c.arm === 'Digital');
  if (target) {
    const r = await jfetch('POST', `/api/listing/${target.listing_id}`, { item_type: 'PhysicalBuyerShip', description: `edit · ${TAG}` }, token);
    const row = await dbItemType(target.listing_id);
    out.cases.push({ case: 'edit_post_with_item_type', listing_id: target.listing_id, http: r.status, code: r.json?.error?.code ?? r.json?.code ?? null, db_after: row?.item_type ?? null, pass: r.status === 200 && row?.item_type === 'Digital' });
  }
}

// ---- 把四条臂全部 listed（供 AC3 首页真页取证） ----
for (const c of out.created) {
  const row = await dbItemType(c.listing_id);
  if (row?.status === 'listed') continue;
  const r = await jfetch('PATCH', `/api/listing/${c.listing_id}`, { to_status: 'listed' }, token);
  c.listed_http = r.status;
}

// ---- AC2 · 读口键数 ----
const feed = await jfetch('GET', '/api/prize/all?limit=2');
const feedRows = feed.json?.data;
const firstRow = Array.isArray(feedRows) ? feedRows[0] : null;
const feedById = new Map((Array.isArray(feedRows) ? feedRows : []).map((r) => [Number(r.bID ?? r.listing_id), r]));
const detailId = firstRow ? Number(firstRow.bID ?? firstRow.listing_id) : null;
const detail = detailId ? await jfetch('GET', `/api/prize/${detailId}`) : { status: 0, json: null };
const detailData = detail.json?.data || null;

// 全量 feed 逐行核 item_type 与库一致
const all = await jfetch('GET', '/api/prize/all?limit=200');
const allRows = Array.isArray(all.json?.data) ? all.json.data : [];
const dbRows = await sql`SELECT listing_id, item_type, status FROM public.listing`;
const dbMap = new Map(dbRows.map((r) => [Number(r.listing_id), r]));
const mismatches = [];
for (const row of allRows) {
  const id = Number(row.bID ?? row.listing_id);
  const db = dbMap.get(id);
  if (!db) { mismatches.push({ id, why: 'not_in_db' }); continue; }
  const a = row.item_type ?? null;
  const b = db.item_type ?? null;
  if (a !== b) mismatches.push({ id, api: a, db: b });
}
out.read_port = {
  feed_http: feed.status,
  feed_rows_returned: allRows.length,
  feed_key_count: firstRow ? Object.keys(firstRow).length : null,
  feed_has_item_type: firstRow ? Object.prototype.hasOwnProperty.call(firstRow, 'item_type') : false,
  feed_key_names_sample: firstRow ? Object.keys(firstRow).sort() : [],
  detail_id: detailId,
  detail_http: detail.status,
  detail_key_count: detailData ? Object.keys(detailData).length : null,
  detail_has_item_type: detailData ? Object.prototype.hasOwnProperty.call(detailData, 'item_type') : false,
  detail_item_type: detailData ? detailData.item_type ?? null : null,
  detail_db_item_type: detailId && dbMap.get(detailId) ? dbMap.get(detailId).item_type ?? null : null,
  api_vs_db_mismatches: mismatches,
  feed_item_type_value_counts: allRows.reduce((acc, r) => { const k = String(r.item_type ?? 'NULL'); acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  // 每条自建行的读口可见性（AC3 依赖：卡片必须真在 feed 里）
  created_in_feed: out.created.map((c) => {
    const row = allRows.find((r) => Number(r.bID ?? r.listing_id) === c.listing_id);
    return { listing_id: c.listing_id, arm: c.arm, suffix: c.suffix, in_feed: Boolean(row), item_type: row ? row.item_type ?? null : null, title: row?.title ?? null };
  }),
};

fs.writeFileSync(path.join(QA, 'readings/ac1-ac2-write-read-port.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(QA, 'readings/created-listings.json'), JSON.stringify({ TAG, created: out.created }, null, 2));

const bad = out.cases.filter((c) => !c.pass);
console.log(JSON.stringify({
  run: TS, tag: TAG, login: out.login,
  cases_total: out.cases.length,
  cases_failed: bad.length,
  failed: bad,
  read_port: { feed_key_count: out.read_port.feed_key_count, feed_has_item_type: out.read_port.feed_has_item_type, detail_key_count: out.read_port.detail_key_count, detail_has_item_type: out.read_port.detail_has_item_type, mismatches: mismatches.length },
  created_in_feed_false: out.read_port.created_in_feed.filter((c) => !c.in_feed),
  created: out.created,
}, null, 2));
