/**
 * p7a-05-ledger-shape.ts — 批 7-A 收口五（Kong）· `GET /api/user/ledger` **非法入参 R107 形状**实测
 * ============================================================================
 * 覆盖（派单 AC①）：`cid=abc` / `cid=0` / `before_txid=xyz` / `before_txid=-9` / `kind=__nope__`
 *   ⇒ **全部 R107 形状**，且 `error` 键集**逐字** = `code,message,i18n_key,details`；
 *   **顶层键必须恰为 `["error"]`**（旧形状 `{success,message,error}` 顶层键 = `[error,message,success]` ⇒ 必红）。
 * AC②：合法入参（规范十进制整数）行为与 `238bc01` 逐字一致（`status=200` + `next_before_txid` 键在）。
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p7a-05-ledger-shape.ts <runDirAbs> <baseUrl>
 * 硬口径：只读（库侧只 SELECT）；token = `.env.local` 的 SECRET_KEY 现铸（**密钥/token 一律不落盘**）；
 *   产物 run-tagged `…/p7a-05-ledger-shape-<RUN>.json`。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir> <baseUrl>');
const BASE = process.argv[3] || 'http://127.0.0.1:5793';
const RUN = path.basename(outDir);
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer): string => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string): string => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0x7a0${String(uid).padStart(5, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string): string => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Row = Record<string, unknown>;
const raw = async <T = Row>(query: string, params: unknown[] = []): Promise<T[]> => {
  const parts: string[] = [];
  const values: unknown[] = [];
  let buf = '';
  for (let i = 0; i < query.length; i += 1) {
    if (query[i] === '$' && /\d/.test(query[i + 1] ?? '')) {
      let j = i + 1; let num = '';
      while (j < query.length && /\d/.test(query[j])) { num += query[j]; j += 1; }
      parts.push(buf); buf = '';
      values.push(params[Number(num) - 1]);
      i = j - 1;
    } else buf += query[i];
  }
  parts.push(buf);
  const strings = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray;
  return (await (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown>)(strings, ...values)) as T[];
};

interface CallOut {
  status: number; topKeys: string[]; errorKeys: string[]; code: string | null;
  errorObj: Record<string, unknown> | null; body: unknown; err?: string;
}
const call = async (p: string, token: string): Promise<CallOut> => {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  try {
    const res = await fetch(BASE + p, { headers, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    const j = json as { error?: unknown } | null;
    const errObj = j?.error && typeof j.error === 'object' ? (j.error as Record<string, unknown>) : null;
    return {
      status: res.status,
      topKeys: json && typeof json === 'object' ? Object.keys(json as object) : [],
      errorKeys: errObj ? Object.keys(errObj) : [],
      code: (errObj?.code as string | undefined) ?? null,
      errorObj: errObj,
      body: json,
    };
  } catch (e) {
    return { status: -1, topKeys: [], errorKeys: [], code: null, errorObj: null, body: null, err: String(e).slice(0, 120) };
  }
};

const out: Record<string, unknown> = { run: RUN, base: BASE, probe: 'p7a-05-ledger-shape', secret_fp: fp(SECRET) };
const fails: string[] = [];
const check = (name: string, ok: boolean, detail?: unknown): boolean => {
  if (!ok) fails.push(`${name}${detail === undefined ? '' : ' :: ' + JSON.stringify(detail)}`);
  return ok;
};
const KEY_SET = 'code,details,i18n_key,message';

async function main(): Promise<void> {
  const urows = await raw<{ uid: string; n: number }>(
    `SELECT uid::text AS uid, COUNT(1)::int AS n FROM public.ledger_entry WHERE uid > 0 GROUP BY uid ORDER BY n DESC LIMIT 1`);
  const uid = Number(urows[0]?.uid ?? 0);
  if (!uid) throw new Error('no fixture uid with ledger entries');
  out.fixture = { uid, rows: urows[0]?.n ?? 0 };
  const T = jwt(uid);

  const realTx = await raw<{ txid: string; cid: string }>(
    `SELECT txid::text AS txid, cid::text AS cid FROM public.ledger_entry WHERE uid = $1 ORDER BY txid DESC LIMIT 1`, [uid]);
  const realTxid = realTx[0]?.txid ?? '1';
  const realCid = realTx[0]?.cid ?? '1';
  out.legal_params = { real_txid: realTxid, real_cid: realCid };

  // ---- AC①：非法入参 ⇒ R107 形状（逐例给完整响应体）------------------------------
  const illegal: Array<[string, string, number]> = [
    ['cid_abc', '/api/user/ledger?cid=abc', 400],
    ['cid_zero', '/api/user/ledger?cid=0', 404],
    ['cid_neg5', '/api/user/ledger?cid=-5', 404],
    ['before_txid_xyz', '/api/user/ledger?before_txid=xyz', 400],
    ['before_txid_neg9', '/api/user/ledger?before_txid=-9', 400],
    ['kind_nope', '/api/user/ledger?kind=__nope__', 400],
  ];
  const illegalRead: Record<string, unknown> = {};
  for (const [name, p, wantStatus] of illegal) {
    const r = await call(p, T);
    const shapeOk = r.errorKeys.slice().sort().join(',') === KEY_SET;
    const topOnlyError = r.topKeys.length === 1 && r.topKeys[0] === 'error';
    illegalRead[name] = {
      path: p, status: r.status, top_keys: r.topKeys, error_keys: r.errorKeys,
      code: r.code, i18n_key: r.errorObj?.i18n_key ?? null, message: r.errorObj?.message ?? null,
      details: r.errorObj?.details ?? null, body: r.body,
      r107_shape: shapeOk, top_only_error: topOnlyError,
    };
    check(`AC1 ${name} ⇒ status=${wantStatus}`, r.status === wantStatus, r.status);
    check(`AC1 ${name} ⇒ R107 键集 ${KEY_SET}`, shapeOk, r.errorKeys);
    check(`AC1 ${name} ⇒ 顶层键恰 ["error"]`, topOnlyError, r.topKeys);
  }
  out.illegal = illegalRead;

  // ---- AC②：合法入参（规范十进制整数）⇒ 200 + 键在 -------------------------------
  const legal: Array<[string, string]> = [
    ['plain', '/api/user/ledger'],
    ['cid_real', `/api/user/ledger?cid=${realCid}`],
    ['before_real', `/api/user/ledger?before_txid=${realTxid}`],
    ['kind_transfer', '/api/user/ledger?kind=transfer'],
    ['limit_abc', '/api/user/ledger?limit=abc'],
    ['empty_vals', '/api/user/ledger?cid=&before_txid=&kind='],
  ];
  const legalRead: Record<string, unknown> = {};
  for (const [name, p] of legal) {
    const r = await call(p, T);
    const j = r.body as { data?: unknown; next_before_txid?: unknown } | null;
    const hasNext = j !== null && typeof j === 'object' && Object.prototype.hasOwnProperty.call(j, 'next_before_txid');
    legalRead[name] = {
      path: p, status: r.status, top_keys: r.topKeys,
      count: Array.isArray(j?.data) ? (j!.data as unknown[]).length : null,
      next_before_txid: hasNext ? (j as { next_before_txid?: unknown }).next_before_txid : 'MISSING',
    };
    check(`AC2 ${name} ⇒ 200`, r.status === 200, r.status);
    check(`AC2 ${name} ⇒ next_before_txid 键在`, hasNext, r.topKeys);
  }
  out.legal = legalRead;

  out.failures = fails;
  out.verdict = fails.length === 0 ? 'PASS' : 'FAIL';
  const file = path.join(outDir, `p7a-05-ledger-shape-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ run: RUN, verdict: out.verdict, failures: fails.length, fails }, null, 1));
  console.log(`WROTE ${file}`);
  if (fails.length) process.exitCode = 1;
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
