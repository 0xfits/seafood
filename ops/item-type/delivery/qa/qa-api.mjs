// QA · 写口四值 + 退役负控 + 读口 48/47 对拍（数字商品拆分批次 · 0054）
// 真钱包登录（ethers 随机钱包 → challenge/verify）→ 真写 dev 库（自建行，收口即删）。
// 零产品代码改动；只读 + 自建夹具写。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const REPO = '/Users/kevin/bistro/seafood';
const QA = path.join(REPO, 'ops/item-type/delivery/qa');
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
// Neon HTTP 偶发 ECONNRESET（本机实测一次）⇒ 全部 DB 访问走指数退避重试，避免半途中断留下未记录夹具。
const sqlRetry = async (fn) => { let last; for (let i = 0; i < 5; i += 1) { try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); } } throw last; };

const TS = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const PREFIX = 'IT4-QA';

const FOUR = ['DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip'];
const out = { run: TS, base: BASE, project_id: null, wallet: {}, login: {}, cases: [], created: [], negative_zero_write: [], read_port: {}, notes: [] };

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
const errOf = (j) => (j && (j.error || j)) || {};
const codeOf = (j) => errOf(j).code ?? j?.code ?? null;
const detailsOf = (j) => errOf(j).details ?? j?.details ?? null;

out.project_id = (await sqlRetry(() => sql`SELECT current_setting('neon.project_id', true) AS pid`))[0].pid;

// ---- 登录 ----
const wallet = Wallet.createRandom();
const address = wallet.address.toLowerCase();
fs.writeFileSync(path.join(process.env.TMPDIR || '/tmp', 'it4-qa-wallet.txt'), `${address}\n${wallet.privateKey}\n`, { mode: 0o600 });
out.wallet = { address };
const ch = await jfetch('POST', '/api/auth/challenge', { evm_address: address });
if (ch.status !== 200) { out.login = { error: 'challenge', status: ch.status, body: ch.json }; }
const message = ch.json?.data?.message;
const signature = await wallet.signMessage(message);
const vf = await jfetch('POST', '/api/auth/verify', { evm_address: address, signature, challenge_token: ch.json?.data?.challenge_token });
const token = vf.json?.data?.token || vf.json?.data?.access_token;
const uid = vf.json?.data?.uID ?? vf.json?.data?.uid;
out.login = { challenge_http: ch.status, verify_http: vf.status, uid, evm: vf.json?.data?.EVM || vf.json?.data?.evm, token_len: String(token || '').length };
if (!token) { fs.writeFileSync(path.join(QA, 'readings/ac1-write-port.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); process.exit(1); }

const dbRow = async (id) => (await sqlRetry(() => sql`SELECT item_type, status, title FROM public.listing WHERE listing_id = ${id}`))[0] || null;
const mkBody = (title, extra = {}) => ({
  cid: 1, price: '1234', stock: '1',
  title,
  description: `QA 夹具 · ${PREFIX} · 收口即删`,
  media_urls: [],
  create_key: `cli:${crypto.randomUUID()}`,
  ...extra,
});

// ================= AC1 · 四值各建 1 件（同时也是 AC3 E2E 的四类型夹具） =================
for (const value of FOUR) {
  const title = `${PREFIX}-${value}-${TS}`;
  const r = await jfetch('POST', '/api/listing', mkBody(title, { item_type: value }), token);
  const id = r.json?.data?.listing_id ?? r.json?.data?.listingId ?? null;
  const row = id ? await dbRow(id) : null;
  out.cases.push({
    case: `valid_${value}`, sent: { item_type: value }, http: r.status, code: codeOf(r.json),
    listing_id: id ? Number(id) : null, db_item_type: row?.item_type ?? null, db_title: row?.title ?? null,
    exact_match: row?.item_type === value,
    pass: r.status === 200 && row?.item_type === value,
  });
  if (id) out.created.push({ listing_id: Number(id), arm: value, title });
  else out.notes.push(`valid ${value} no listing_id: ${JSON.stringify(r.json).slice(0, 300)}`);
}

// ================= AC1 · 缺省 / 显式 null ⇒ 库 NULL =================
for (const [label, extra] of [['omit', {}], ['explicit_null', { item_type: null }]]) {
  const title = `${PREFIX}-NULL-${label}-${TS}`;
  const r = await jfetch('POST', '/api/listing', mkBody(title, extra), token);
  const id = r.json?.data?.listing_id ?? null;
  const row = id ? await dbRow(id) : null;
  out.cases.push({ case: `null_${label}`, sent: label === 'omit' ? '(absent)' : { item_type: null }, http: r.status, code: codeOf(r.json), listing_id: id ? Number(id) : null, db_item_type: row?.item_type ?? null, pass: r.status === 200 && row?.item_type === null });
  if (id) out.created.push({ listing_id: Number(id), arm: 'NULL', title });
}

// ================= AC1 · 非法值 ⇒ 400 NOT_IN_CLOSED_SET（allowed 四值）+ 零行写入 =================
const badCases = [
  ['bare_Digital', 'Digital'],
  ['empty_string', ''],
  ['spaces', '   '],
  ['lowercase_digital', 'digital'],
  ['lowercase_full', 'physicalfreeship'],
  ['legacy_AutoDeliver', 'AutoDeliver'],
];
for (const [label, value] of badCases) {
  const title = `${PREFIX}-BAD-${label}-${TS}`;
  const r = await jfetch('POST', '/api/listing', mkBody(title, { item_type: value }), token);
  const details = detailsOf(r.json);
  const allowed = details?.allowed;
  const pass = r.status === 400
    && codeOf(r.json) === 'LEDGER_AMOUNT_INVALID'
    && details?.reason === 'NOT_IN_CLOSED_SET'
    && Array.isArray(allowed) && allowed.length === 4
    && FOUR.every((v) => allowed.includes(v));
  const leaked = (await sqlRetry(() => sql`SELECT count(*)::int AS n FROM public.listing WHERE title = ${title}`))[0].n;
  out.cases.push({ case: `invalid_${label}`, sent: { item_type: value }, http: r.status, code: codeOf(r.json), reason: details?.reason ?? null, allowed, body: r.json, rows_written: leaked, pass: pass && leaked === 0 });
  out.negative_zero_write.push({ label, rows_written: leaked });
}

// ================= AC1 · PATCH 带 item_type ⇒ 库值不变 =================
{
  const target = out.created.find((c) => c.arm === 'DigitalManualDeliver');
  if (target) {
    const before = await dbRow(target.listing_id);
    const p1 = await jfetch('PATCH', `/api/listing/${target.listing_id}`, { item_type: 'PhysicalBuyerShip' }, token);
    const after1 = await dbRow(target.listing_id);
    out.cases.push({ case: 'patch_item_type_only', listing_id: target.listing_id, sent: { item_type: 'PhysicalBuyerShip' }, http: p1.status, code: codeOf(p1.json), db_before: before?.item_type ?? null, db_after: after1?.item_type ?? null, pass: after1?.item_type === before?.item_type });
    const p2 = await jfetch('PATCH', `/api/listing/${target.listing_id}`, { to_status: 'listed', item_type: 'PhysicalFreeShip' }, token);
    const after2 = await dbRow(target.listing_id);
    out.cases.push({ case: 'patch_to_listed_with_item_type', listing_id: target.listing_id, sent: { to_status: 'listed', item_type: 'PhysicalFreeShip' }, http: p2.status, code: codeOf(p2.json), db_after: after2?.item_type ?? null, db_status_after: after2?.status ?? null, pass: p2.status === 200 && after2?.item_type === before?.item_type && after2?.status === 'listed' });
  } else out.notes.push('PATCH case skipped: no DigitalManualDeliver fixture');
}

// ================= AC3 前置：四类型全部转 listed =================
for (const c of out.created) {
  const row = await dbRow(c.listing_id);
  if (row?.status === 'listed') { c.listed = 'already'; continue; }
  const r = await jfetch('PATCH', `/api/listing/${c.listing_id}`, { to_status: 'listed' }, token);
  const after = await dbRow(c.listing_id);
  c.listed_http = r.status;
  c.listed = after?.status ?? null;
  c.item_type_after_list = after?.item_type ?? null;
}
const notListed = out.created.filter((c) => c.listed !== 'already' && c.listed !== 'listed');
if (notListed.length) out.notes.push(`not listed: ${JSON.stringify(notListed)}`);

// ================= AC2 · 读口键数 + 全量对拍 =================
const feed = await jfetch('GET', '/api/prize/all?skip=0&limit=200');
const feedRows = Array.isArray(feed.json?.data) ? feed.json.data : [];
const firstRow = feedRows[0] || null;
const detailId = firstRow ? Number(firstRow.bID ?? firstRow.listing_id) : null;
const detail = detailId ? await jfetch('GET', `/api/prize/${detailId}`) : { status: 0, json: null };
const detailData = detail.json?.data || null;
const detailKeys = detailData ? Object.keys(detailData) : [];
const feedKeys = firstRow ? Object.keys(firstRow) : [];

const dbRows = await sqlRetry(() => sql`SELECT listing_id, item_type, status FROM public.listing`);
const dbMap = new Map(dbRows.map((r) => [Number(r.listing_id), r]));
const mismatches = [];
for (const row of feedRows) {
  const id = Number(row.bID ?? row.listing_id);
  const db = dbMap.get(id);
  if (!db) { mismatches.push({ id, why: 'not_in_db' }); continue; }
  const a = row.item_type ?? null;
  const b = db.item_type ?? null;
  if (a !== b) mismatches.push({ id, api: a, db: b });
  if (!Object.prototype.hasOwnProperty.call(row, 'item_type')) mismatches.push({ id, why: 'feed_missing_key' });
}
// 详情逐行对拍（抽样全部自建行 + 首行）
const detailChecks = [];
for (const row of feedRows.filter((r) => String(r.title || '').startsWith(PREFIX)).slice(0, 8)) {
  const id = Number(row.bID ?? row.listing_id);
  const d = await jfetch('GET', `/api/prize/${id}`);
  const dd = d.json?.data || null;
  const db = dbMap.get(id);
  detailChecks.push({ id, http: d.status, detail_item_type: dd?.item_type ?? null, db: db?.item_type ?? null, keys: dd ? Object.keys(dd).length : null, pass: (dd?.item_type ?? null) === (db?.item_type ?? null) });
}

out.read_port = {
  feed_http: feed.status,
  feed_rows: feedRows.length,
  feed_key_count: firstRow ? feedKeys.length : null,
  feed_keys_sorted: [...feedKeys].sort(),
  feed_has_item_type: firstRow ? Object.prototype.hasOwnProperty.call(firstRow, 'item_type') : false,
  detail_id: detailId,
  detail_http: detail.status,
  detail_key_count: detailKeys.length,
  detail_keys_sorted: [...detailKeys].sort(),
  detail_has_item_type: detailData ? Object.prototype.hasOwnProperty.call(detailData, 'item_type') : false,
  detail_item_type: detailData ? detailData.item_type ?? null : null,
  api_vs_db_mismatch_count: mismatches.length,
  mismatches,
  item_type_value_counts: feedRows.reduce((acc, r) => { const k = String(r.item_type ?? 'NULL'); acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  detail_sampling: detailChecks,
  created_in_feed: out.created.map((c) => {
    const row = feedRows.find((r) => Number(r.bID ?? r.listing_id) === c.listing_id);
    return { listing_id: c.listing_id, arm: c.arm, in_feed: Boolean(row), item_type: row ? row.item_type ?? null : null, title: row?.title ?? null };
  }),
};

fs.writeFileSync(path.join(QA, 'readings/ac1-write-port.json'), JSON.stringify({ ...out, read_port: undefined }, null, 2));
fs.writeFileSync(path.join(QA, 'readings/ac2-read-port.json'), JSON.stringify({ run: TS, project_id: out.project_id, read_port: out.read_port }, null, 2));
fs.writeFileSync(path.join(QA, 'readings/created-listings.json'), JSON.stringify({ run: TS, prefix: PREFIX, created: out.created }, null, 2));

const failed = out.cases.filter((c) => !c.pass);
console.log(JSON.stringify({
  run: TS, project_id: out.project_id, login: out.login,
  cases_total: out.cases.length, cases_failed: failed.length, failed,
  created: out.created.map((c) => ({ id: c.listing_id, arm: c.arm, listed: c.listed ?? null, item_type_after_list: c.item_type_after_list ?? null })),
  read_port: {
    feed_key_count: out.read_port.feed_key_count, feed_has_item_type: out.read_port.feed_has_item_type,
    detail_key_count: out.read_port.detail_key_count, detail_has_item_type: out.read_port.detail_has_item_type,
    mismatches: out.read_port.api_vs_db_mismatch_count, feed_rows: out.read_port.feed_rows,
    value_counts: out.read_port.item_type_value_counts,
    created_in_feed_false: out.read_port.created_in_feed.filter((c) => !c.in_feed),
    detail_sampling: out.read_port.detail_sampling,
  },
  notes: out.notes,
}, null, 2));
