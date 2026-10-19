/**
 * AC2 · 上传口负例（真 token + 无 token）
 * ---------------------------------------------------------------------
 * 每例记 http + error.code + i18n_key（R107 形状）。判据（route v2.39 §48）：
 *   N1 无 Authorization                      → 401 AUTH_UNAUTHORIZED
 *   N2 content_type 超闭集（image/gif）      → 400 MEDIA_CONTENT_TYPE_INVALID
 *   N3 base64 非法（!!!not-base64!!!）        → 400 MEDIA_BASE64_INVALID
 *   N4 解码后 2.5MiB（>2MiB）                 → 400 MEDIA_SIZE_EXCEEDED
 *   N5 png 魔数 + 声明 jpeg                   → 400 MEDIA_MAGIC_MISMATCH
 *   N6（附加观察）解码 3MiB ⇒ base64 4.19MB > express.json 4mb ⇒ 实测记录（不预判）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { login, jsonFetch } = require('../lib/auth.cjs');

const FIX = path.join(__dirname, '..', 'fixtures');
const out = { ac: 'AC2', generated_at: new Date().toISOString(), base: process.env.QA_API_BASE || 'http://localhost:5788', cases: [] };

const post = async (body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return jsonFetch(`${out.base}/api/media`, { method: 'POST', headers, body: JSON.stringify(body) });
};

const rec = (id, desc, expect, r, extra = {}) => {
  const err = r.body?.error;
  const row = {
    id,
    desc,
    expect,
    http: r.status,
    code: err?.code ?? null,
    i18n_key: err?.i18n_key ?? null,
    details: err?.details ?? null,
    body_keys: r.body && typeof r.body === 'object' ? Object.keys(r.body) : null,
    ...extra,
  };
  out.cases.push(row);
  return row;
};

(async () => {
  // N1 —— 无 Authorization（先于登录，纯无头请求）
  const r1 = await post({ content_type: 'image/webp', data_base64: 'AAAA' }, null);
  rec('N1', '无 Authorization POST /api/media', '401', r1);

  const session = await login('ac2');
  out.actor = { uid: session.uid, address_tail: session.address_tail };
  const token = session.token;

  // N2
  const png = fs.readFileSync(path.join(FIX, 'qa-64.png')).toString('base64');
  const r2 = await post({ content_type: 'image/gif', data_base64: png }, token);
  rec('N2', 'content_type=image/gif（超三值闭集），字节为真 png', '400 MEDIA_CONTENT_TYPE_INVALID', r2);

  // N3
  const r3 = await post({ content_type: 'image/webp', data_base64: '!!!not-base64!!!' }, token);
  rec('N3', 'data_base64 非 RFC4648 严格 base64（!!!not-base64!!!）', '400 MEDIA_BASE64_INVALID', r3);

  // N4 —— 2.5MiB 随机字节（base64 ≈ 3.49MB < 4mb JSON 上限 ⇒ 应抵达体积闸）
  const big = crypto.randomBytes(2.5 * 1024 * 1024);
  const bigB64 = big.toString('base64');
  const r4 = await post({ content_type: 'image/webp', data_base64: bigB64 }, token);
  rec('N4', '解码后 2.5MiB（>2MiB）随机字节，声明 image/webp', '400 MEDIA_SIZE_EXCEEDED', r4,
    { base64_chars: bigB64.length, decoded_bytes: big.length });

  // N5 —— png 魔数声明 jpeg
  const jpegBytes = Buffer.from(png, 'base64');
  const r5 = await post({ content_type: 'image/jpeg', data_base64: jpegBytes.toString('base64') }, token);
  rec('N5', 'png 字节（89 50 4E 47 魔数）声明 image/jpeg', '400 MEDIA_MAGIC_MISMATCH', r5,
    { actual_magic_hex: jpegBytes.subarray(0, 4).toString('hex') });

  // N6 —— 3MiB（base64 ≈ 4.19MB：观察 express.json 4mb 与体积闸的先后）
  const huge = crypto.randomBytes(3 * 1024 * 1024);
  const hugeB64 = huge.toString('base64');
  const r6 = await post({ content_type: 'image/webp', data_base64: hugeB64 }, token);
  rec('N6', '解码后 3MiB（base64 4.19MB > express.json 4mb）—— 观察姿态', 'record only', r6,
    { base64_chars: hugeB64.length, decoded_bytes: huge.length });

  out.pass_expected = out.cases.filter((c) => c.id !== 'N6').every((c) => {
    const [wantHttp, wantCode] = c.expect.split(' ');
    return String(c.http) === wantHttp && (!wantCode || c.code === wantCode);
  });
  out.failed = out.cases.filter((c) => c.id !== 'N6').filter((c) => {
    const [wantHttp, wantCode] = c.expect.split(' ');
    return String(c.http) !== wantHttp || (wantCode && c.code !== wantCode);
  }).map((c) => c.id);
  out.pass = out.pass_expected;
  fs.writeFileSync(path.join(__dirname, 'ac2-negative.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, failed: out.failed, rows: out.cases.map((c) => `${c.id} http=${c.http} code=${c.code}`) }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.message; out.pass = false;
  fs.writeFileSync(path.join(__dirname, 'ac2-negative.json'), JSON.stringify(out, null, 2));
  console.error(e.stack); process.exitCode = 1;
});
