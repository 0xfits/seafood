/**
 * qa-p7a-r107.ts —— **Neng 独立质检（批 7-A 终轮 / 收口五）**：非法入参 **R107 形状独立重取**
 * 目的：**不采信交付方 AC① 的响应体** —— 由质检方独立取回五例非法入参的**完整响应体** +
 *       `error` 键集 + 顶层键 + `code` / `i18n_key` / `details`，逐例落 run-tagged JSON。
 * 五例（收口五统一的非法面）：`cid=abc` / `cid=0` / `before_txid=xyz` / `before_txid=-9` / `kind=__nope__`
 * 使用：npx ts-node --transpile-only .p7aqa-artifacts/scripts/qa-p7a-r107.ts <RUN> <baseUrl>
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

type Row = Record<string, unknown>;
const RUN = process.argv[2] || 'P7AQAF5-R107';
const BASE = process.argv[3] || 'http://127.0.0.1:5796';
const OUTDIR = `.p7aqa-artifacts/${RUN}`;
fs.mkdirSync(OUTDIR, { recursive: true });
const SECRET = String(process.env.SECRET_KEY || '');

const b64u = (v: string) => Buffer.from(v).toString('base64url');
const jwt = (uid: number, evm: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};

const CASES = ['cid=abc', 'cid=0', 'before_txid=xyz', 'before_txid=-9', 'kind=__nope__'];

(async () => {
  const fx = JSON.parse(fs.readFileSync('.p7aqa-artifacts/FIXTURE-P7AQA001/fixture-P7AQA001.json', 'utf8')) as Row;
  const A = Number((fx.fixture as Row).uids ? ((fx.fixture as Row).uids as Row).A : 0);
  const evmA = String((fx.fixture as Row).evm_a);
  const token = jwt(A, evmA);
  const out: Row = { run: RUN, base: BASE, probe: 'qa-p7a-r107', fixture_uid: A, cases: [] };

  const results: Row[] = [];
  for (const q of CASES) {
    const res = await fetch(`${BASE}/api/user/ledger?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: Row | null = null;
    try { json = JSON.parse(text) as Row; } catch { /* 非 JSON */ }
    const err = (json?.error ?? null) as Row | null;
    results.push({
      query: q,
      status: res.status,
      content_type: res.headers.get('content-type'),
      raw_body: text,
      top_level_keys: json ? Object.keys(json) : [],
      uses_r107_envelope: !!(json && typeof json === 'object' && !Array.isArray(json) && Object.prototype.hasOwnProperty.call(json, 'error')),
      error_object_keys: err && typeof err === 'object' && !Array.isArray(err) ? Object.keys(err).sort() : null,
      code: err && typeof err === 'object' ? (err.code ?? null) : null,
      i18n_key: err && typeof err === 'object' ? (err.i18n_key ?? null) : null,
      message: err && typeof err === 'object' ? (err.message ?? null) : null,
      details: err && typeof err === 'object' ? (err.details ?? null) : null,
      legacy_shape_keys: json ? Object.keys(json).filter((k) => ['success', 'message'].includes(k)) : [],
    });
  }
  out.cases = results;
  // 汇总：五例是否**全部** R107 形状（error 对象 4 键 code/details/i18n_key/message）+ 无旧形状泄漏
  out.summary = {
    all_r107: results.every((r) => r.uses_r107_envelope === true && JSON.stringify(r.error_object_keys) === JSON.stringify(['code', 'details', 'i18n_key', 'message'])),
    none_500: results.every((r) => r.status !== 500),
    no_legacy_shape: results.every((r) => (r.legacy_shape_keys as string[]).length === 0),
    statuses: Object.fromEntries(results.map((r) => [r.query, r.status])),
    codes: Object.fromEntries(results.map((r) => [r.query, r.code])),
  };
  fs.writeFileSync(path.join(OUTDIR, `qa-r107-${RUN}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ run: RUN, summary: out.summary, cases: results.map((r) => ({ q: r.query, status: r.status, keys: r.error_object_keys, code: r.code, i18n_key: r.i18n_key, details: r.details })) }, null, 1));
  process.exitCode = (out.summary as Row).all_r107 && (out.summary as Row).none_500 && (out.summary as Row).no_legacy_shape ? 0 : 1;
})().catch((e) => { console.error('R107-PROBE-FAILED', String(e).slice(0, 800)); process.exit(2); });
