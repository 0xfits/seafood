/**
 * AC3 · 上传口正例 + 去重 + 公开读口
 * ---------------------------------------------------------------------
 * P1 真登录上传 64×64 真 webp（128B）        → 200 {url,media_id,sha256,size_bytes,deduplicated:false}
 * P2 同字节再传                               → 200 deduplicated:true 且 media_id 与 P1 一致
 * P3 GET /api/media/<id>（公开无 Authorization）→ 200 + Content-Type=image/webp + Cache-Control 含 immutable
 *    且响应体 sha256 == P1.sha256（字节一致）
 * P4 GET /api/media/<不存在 id>                → 404 R107 形状（ref_type=media）
 * P5 GET /api/media/<非数字>                   → 404 R107 形状（同 §48.3 miss 口径）
 * 产出的 media_id 写入 readings/_state.json（供 AC4/AC6 与清理复用）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { login, jsonFetch } = require('../lib/auth.cjs');
const { q } = require('../lib/db.cjs');

const FIX = path.join(__dirname, '..', 'fixtures');
const BASE = process.env.QA_API_BASE || 'http://localhost:5788';
const out = { ac: 'AC3', generated_at: new Date().toISOString(), base: BASE, checks: [] };
const t = (id, what, pass, reading) => out.checks.push({ id, what, pass: !!pass, reading });

(async () => {
  const bytes = fs.readFileSync(path.join(FIX, 'qa-64.webp'));
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const b64 = bytes.toString('base64');
  out.fixture = { file: 'fixtures/qa-64.webp', bytes: bytes.length, sha256: sha };

  const session = await login('ac3');
  out.actor = { uid: session.uid, address_tail: session.address_tail };
  const token = session.token;

  const post = (body, tk) => jsonFetch(`${BASE}/api/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: JSON.stringify(body),
  });

  // P1
  const r1 = await post({ content_type: 'image/webp', data_base64: b64 }, token);
  const d1 = r1.body?.data ?? {};
  out.p1_response = { http: r1.status, data: d1 };
  t('P1', '真登录上传 64×64 webp ⇒ 200 且 data 含 {url,media_id,sha256,size_bytes,deduplicated:false}',
    r1.status === 200 && typeof d1.url === 'string' && /^\/api\/media\/\d+$/.test(d1.url)
      && Number.isInteger(Number(d1.media_id)) && d1.sha256 === sha && d1.size_bytes === bytes.length && d1.deduplicated === false,
    `http=${r1.status} url=${d1.url} media_id=${d1.media_id} sha256=${String(d1.sha256).slice(0, 16)}… size=${d1.size_bytes} dedup=${d1.deduplicated}`);

  // P2 —— 去重
  const r2 = await post({ content_type: 'image/webp', data_base64: b64 }, token);
  const d2 = r2.body?.data ?? {};
  out.p2_response = { http: r2.status, data: d2 };
  t('P2', '同字节重传 ⇒ 200 deduplicated:true 且 media_id 一致（sha256+size 去重生效）',
    r2.status === 200 && d2.deduplicated === true && String(d2.media_id) === String(d1.media_id),
    `http=${r2.status} media_id=${d2.media_id} (p1=${d1.media_id}) dedup=${d2.deduplicated}`);

  // 去重的库侧证据：该 sha256 在 media 表恰 1 行
  const dbRows = await q(`select media_id, size_bytes, content_type, owner_uid
    from public.media where sha256 = '${sha}'`);
  const dbCount = await q(`select count(*)::int as n from public.media where sha256 = '${sha}'`);
  out.db_rows_for_sha = dbRows.map((r) => ({ media_id: Number(r.media_id), size_bytes: r.size_bytes, content_type: r.content_type }));
  t('P2b', 'DB media 表中该 sha256 恰 1 行（去重为真·非仅响应标记）',
    dbCount[0].n === 1 && Number(dbRows[0]?.media_id) === Number(d1.media_id),
    `rows=${dbCount[0].n} media_id=${dbRows[0]?.media_id}`);

  // P3 —— 公开读口
  const mediaId = d1.media_id;
  const g = await jsonFetch(`${BASE}/api/media/${mediaId}`, { method: 'GET' });
  const raw = await fetch(`${BASE}/api/media/${mediaId}`);
  const buf = Buffer.from(await raw.arrayBuffer());
  const gotSha = crypto.createHash('sha256').update(buf).digest('hex');
  out.p3_response = { http: g.status, headers: g.headers, bytes: buf.length, sha256: gotSha };
  t('P3', 'GET /api/media/<id> 公开无头 ⇒ 200 + Content-Type=image/webp + Cache-Control 含 immutable + 字节 sha256 一致',
    g.status === 200 && raw.headers.get('content-type') === 'image/webp'
      && /immutable/.test(raw.headers.get('cache-control') || '') && gotSha === sha,
    `http=${g.status} ct=${raw.headers.get('content-type')} cc=${raw.headers.get('cache-control')} bytes=${buf.length} sha_match=${gotSha === sha}`);

  // P4 —— 不存在 id
  const missId = '999999999';
  const g4 = await jsonFetch(`${BASE}/api/media/${missId}`, { method: 'GET' });
  const e4 = g4.body?.error ?? {};
  out.p4_response = { http: g4.status, error: e4 };
  t('P4', 'GET /api/media/999999999 ⇒ 404 R107 形状（code=LEDGER_REF_NOT_FOUND · ref_type=media · reason=media_not_found）',
    g4.status === 404 && e4.code === 'LEDGER_REF_NOT_FOUND' && e4.details?.ref_type === 'media' && e4.details?.ref_id === missId,
    `http=${g4.status} code=${e4.code} details=${JSON.stringify(e4.details)}`);

  // P5 —— 非数字 id
  const g5 = await jsonFetch(`${BASE}/api/media/not-a-number`, { method: 'GET' });
  const e5 = g5.body?.error ?? {};
  out.p5_response = { http: g5.status, error: e5 };
  t('P5', 'GET /api/media/not-a-number ⇒ 404 R107 形状（非数字路径段同 miss 口径）',
    g5.status === 404 && e5.code === 'LEDGER_REF_NOT_FOUND',
    `http=${g5.status} code=${e5.code} details=${JSON.stringify(e5.details)}`);

  // 记录状态供后续 AC + 清理
  const stateFile = path.join(__dirname, '_state.json');
  const prev = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const state = {
    ...prev,
    media: { media_id: Number(mediaId), sha256: sha, size_bytes: bytes.length, url: d1.url, owner_uid: session.uid },
    actors: { ...(prev.actors || {}), ac3: { uid: session.uid, address_tail: session.address_tail } },
  };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  out.pass = out.checks.every((c) => c.pass);
  out.failed = out.checks.filter((c) => !c.pass).map((c) => c.id);
  fs.writeFileSync(path.join(__dirname, 'ac3-positive.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, failed: out.failed, checks: out.checks.map((c) => `${c.id} ${c.pass ? 'PASS' : 'FAIL'} :: ${c.reading}`) }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.message; out.pass = false;
  fs.writeFileSync(path.join(__dirname, 'ac3-positive.json'), JSON.stringify(out, null, 2));
  console.error(e.stack); process.exitCode = 1;
});
