/**
 * p7b-08 · HTTP E2E（十项）—— 自起实例 5793
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && P7B_RUN=<run> BASE=http://127.0.0.1:5793 npx ts-node --transpile-only scripts/p7b-08-e2e-http.ts
 * 读数：.p7b-artifacts/p7b-08-e2e-http-<RUN>.json
 *
 * 前置：scripts/p7b-06-fixture-setup.ts 已跑（f1=8 / f2=9 / f3=10 / f4=11）。
 * 纪律：token 现铸（SECRET_KEY 只在进程内；产物不含 token 字节）。
 */
import * as crypto from 'crypto';
import { mkPool, raw, raw1, save, pgErr } from './p7b-lib';

const BASE = process.env.P7B_BASE || 'http://127.0.0.1:5793';
const KEY = String(process.env.SECRET_KEY || '');
if (!KEY) throw new Error('SECRET_KEY missing');

const U = { S1: 900001, B1: 900002, S2: 900003, A_BUYER: 900004, A_ADMIN: 900005, A_NOPTS: 900006, P: 900007, S3: 900008 };
const O = {
  f1: Number(process.env.P7B_E2E_F1 || 5), // 卖方路（③⑦）+ 同键异内容（⑧）+ txid（⑨）
  f2: Number(process.env.P7B_E2E_F2 || 6), // 管理员路（④）
  f3: Number(process.env.P7B_E2E_F3 || 10), // 兼买方禁令（⑤）/ 缺 manage_points（⑥）/ 第三方（②）
};

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const mint = (uid: number) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0x${'0'.repeat(40)}`, exp: Math.floor(Date.now() / 1000) + 1800 }));
  const un = `${h}.${p}`;
  return `${un}.${crypto.createHmac('sha256', KEY).update(un).digest('base64url')}`;
};

const call = async (orderId: number | string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}/api/listing-orders/${orderId}/refund`, { method: 'POST', headers, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, json, top_keys: json && typeof json === 'object' ? Object.keys(json) : null, text_head: text.slice(0, 300) };
  } catch (e) {
    return { status: 'NETERR' as unknown as number, json: null, top_keys: null, text_head: String(e).slice(0, 200) };
  }
};

const snapshot = async () => {
  const p = mkPool(2);
  try {
    const q = async (sql: string, params?: unknown[]) => raw(p, sql, params);
    return {
      ledger_rows: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.ledger_entry`))?.n,
      purchase_refund: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE kind='purchase_refund'`))?.n,
      ledger_by_rootkey: await q(`SELECT event_root_key, count(*)::text AS n FROM public.ledger_entry WHERE event_root_key LIKE 'biz:listing:refund:%' GROUP BY event_root_key ORDER BY event_root_key`),
      refund_audit: await q(`SELECT log_id, actor_uid::text, order_id::text, result, txid::text, idempotency_key, memo FROM public.admin_refund_audit_log ORDER BY log_id`),
      orders: await q(`SELECT order_id::text, status, refund_txid::text FROM public.listing_order WHERE create_key LIKE 'cli:p7b-fixture-order-%' ORDER BY order_id`),
      sum_cid1_balance: (await raw1<{ n: string }>(p, `SELECT COALESCE(sum(balance),0)::text AS n FROM public.account WHERE cid=1`))?.n,
      sum_cid1_frozen: (await raw1<{ n: string }>(p, `SELECT COALESCE(sum(frozen),0)::text AS n FROM public.account WHERE cid=1`))?.n,
    };
  } finally { await p.end().catch(() => undefined); }
};

(async () => {
  const out: Record<string, unknown> = { script: 'scripts/p7b-08-e2e-http.ts', base: BASE };
  out.before = await snapshot();
  const T = { S1: mint(U.S1), B1: mint(U.B1), S2: mint(U.S2), A_BUYER: mint(U.A_BUYER), A_ADMIN: mint(U.A_ADMIN), A_NOPTS: mint(U.A_NOPTS), P: mint(U.P), S3: mint(U.S3) };

  // ① 无 token ⇒ 401
  out.item1_no_token = await call(O.f1);
  // ② 非卖方非 admin（P）⇒ 403 ACTOR_NOT_ALLOWED
  out.item2_trespasser = await call(O.f1, T.P);
  // ⑤ 管理员兼买方（A_BUYER 是 f3 的买方）⇒ 403 ACTOR_NOT_ALLOWED
  out.item5_admin_buyer = await call(O.f3, T.A_BUYER);
  // ⑥ admin 但缺 manage_points（A_NOPTS）⇒ 403 PERMISSION_NOT_GRANTED
  out.item6_admin_nopoints = await call(O.f3, T.A_NOPTS);
  // ③ 卖方本人（S1）⇒ 200
  out.item3_seller = await call(O.f1, T.S1);
  // ⑦ 幂等重投（同 f1 卖方）⇒ 200 replay
  out.item7_replay = await call(O.f1, T.S1);
  // ④ 管理员（A_ADMIN 有 manage_points）⇒ 200
  out.item4_admin = await call(O.f2, T.A_ADMIN);

  // ⑧ 同键异内容 ⇒ 409：HTTP 面 fp 由服务端派生（见报告说明）⇒ DB 层等价构造
  {
    const p = mkPool(1);
    try {
      const r = await raw1<{ r: Record<string, unknown> }>(p, `SELECT public.listing_refund_post_event($1::jsonb) AS r`,
        [JSON.stringify({ actor_uid: String(U.S1), op: 'refund', order_id: String(O.f1), request_fingerprint: 'p7b:DIFFERENT-FP', memo: 'p7b same-key-diff-content' })]);
      out.item8_same_key_diff_content_db = { returned: r?.r ?? null };
    } catch (e) {
      out.item8_same_key_diff_content_db = { error: pgErr(e) };
    } finally { await p.end().catch(() => undefined); }
  }

  out.after = await snapshot();

  // ⑨ 审计行 txid 与资金回执 txid 逐字相同（f1 / f2）
  const f1tx = (out.item3_seller as any)?.json?.data?.txid ?? (out.item3_seller as any)?.json?.txid ?? null;
  const f2tx = (out.item4_admin as any)?.json?.data?.txid ?? (out.item4_admin as any)?.json?.txid ?? null;
  const audit = (out.after as any).refund_audit as Array<Record<string, unknown>>;
  out.item9_txid_match = {
    f1_response_txid: f1tx, f1_audit_txid: audit.find((a) => a.order_id === '8')?.txid,
    f2_response_txid: f2tx, f2_audit_txid: audit.find((a) => a.order_id === '9')?.txid,
  };

  // ⑩ 账本零位移（除本事件外）—— 由 before/after 差分逐项核对
  const b = out.before as any; const a = out.after as any;
  out.item10_drift = {
    ledger_rows_delta: Number(a.ledger_rows) - Number(b.ledger_rows),
    purchase_refund_delta: Number(a.purchase_refund) - Number(b.purchase_refund),
    sum_cid1_balance_shift: (BigInt(a.sum_cid1_balance) - BigInt(b.sum_cid1_balance)).toString(),
    sum_cid1_frozen_shift: (BigInt(a.sum_cid1_frozen) - BigInt(b.sum_cid1_frozen)).toString(),
    refund_rootkey_before: b.ledger_by_rootkey, refund_rootkey_after: a.ledger_by_rootkey,
  };

  const f = save('p7b-08-e2e-http', out);
  console.log(JSON.stringify({
    saved: f,
    s1: out.item1_no_token, s2: out.item2_trespasser, s3: out.item3_seller, s4: out.item4_admin,
    s5: out.item5_admin_buyer, s6: out.item6_admin_nopoints, s7: out.item7_replay, s8: out.item8_same_key_diff_content_db,
    item9: out.item9_txid_match, item10: out.item10_drift,
  }, null, 2));
})().catch((e) => { console.error('FATAL', pgErr(e)); process.exit(2); });
