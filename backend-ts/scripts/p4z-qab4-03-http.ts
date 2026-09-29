/*
 * p4z-qab4-03-http.ts — QA-B4 腿2（注册面回归）+ 腿3（新路线独立实测）+ 开口③（fee>0 结算）+ 腿4（不变量）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qab4-03-http.ts <runDirAbs>
 * 口径（§5.7）：① token = .env.local SECRET_KEY（HS256），本体不落盘（只记 12 位指纹）
 *   ② 夹具幂等键一律 `cli:qab4:*` ③ 只 SELECT + 经 HTTP 写；零删除 SQL ④ 退出码直接取
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDirAbs>');
const RUN = path.basename(outDir);
const TAG = `qab4${RUN.replace(/[^0-9]/g, '').slice(-8)}`;
const K = (s: string) => `cli:qab4:${TAG}:${s}`;
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0xqab4${String(uid).padStart(4, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', SECRET).update(unsigned).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Call = { status: number | string; top: string[]; data: string[]; code: string | null; msg: string; json: any };
const call = async (method: string, p: string, opts: { token?: string; body?: unknown; hdr?: Record<string, string> } = {}): Promise<Call> => {
  const headers: Record<string, string> = { ...(opts.hdr || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return {
      status: res.status,
      top: json && typeof json === 'object' ? Object.keys(json) : [],
      data: json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? Object.keys(json.data) : [],
      code: json?.error?.code ?? null,
      msg: String(json?.message ?? json?.error?.message ?? '').slice(0, 100),
      json,
    };
  } catch (e) {
    return { status: 'NETERR', top: [], data: [], code: null, msg: String(e).slice(0, 120), json: null };
  }
};
const raw = async <T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> => {
  const parts: string[] = []; const values: unknown[] = []; let buf = '';
  for (let i = 0; i < query.length; i += 1) {
    if (query[i] === '$' && /\d/.test(query[i + 1] ?? '')) {
      let j = i + 1; let num = '';
      while (j < query.length && /\d/.test(query[j])) { num += query[j]; j += 1; }
      parts.push(buf); buf = ''; values.push(params[Number(num) - 1]); i = j - 1;
    } else buf += query[i];
  }
  parts.push(buf);
  const strings = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray;
  return (await (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown>)(strings, ...values)) as T[];
};
const sigmaTotal = async () => String(((await raw(`SELECT COALESCE(SUM(balance+frozen),0)::text AS t FROM public.account`))[0] as any).t);
const ledgerCount = async () => Number(((await raw(`SELECT COUNT(1)::int AS n FROM public.ledger_entry`))[0] as any).n);
const negRows = async () => Number(((await raw(`SELECT COUNT(1)::int AS n FROM public.account WHERE balance < 0 OR frozen < 0`))[0] as any).n);

const R: Record<string, any> = { run: RUN, tag: TAG, secret_fingerprint: fp(SECRET), legs2: {}, legs3: {}, fee_pos: {}, invariants: {} };
const P = (id: string, c: Call, extra: Record<string, unknown> = {}) => {
  const row = { status: c.status, code: c.code, data_keys: c.data, top_keys: c.top, msg: c.msg, ...extra };
  R.last_slot = row;
  console.log(`${id} :: ${String(c.status)} :: code=${String(c.code)} :: data=[${c.data.join(',')}] :: ${JSON.stringify(extra).slice(0, 220)}`);
  return row;
};
const num = (...v: unknown[]) => { for (const x of v) { if (x !== undefined && x !== null && String(x) !== '') return String(x); } return null; };

async function main() {
  R.invariants.sigma_total_pre = await sigmaTotal();
  R.invariants.ledger_rows_pre = await ledgerCount();
  R.invariants.neg_rows_pre = await negRows();

  const EMP = 970001, WRK = 12, ADM = 1;
  const T_EMP = jwt(EMP), T_WRK = jwt(WRK), T_ADM = jwt(ADM);
  const cidRow = await raw<{ cid: string }>(`SELECT cid::text AS cid FROM public.currency WHERE status = 'listed' ORDER BY cid LIMIT 1`);
  const CID = cidRow.length ? String(cidRow[0].cid) : '1';
  R.cid_used = CID;

  // ================= 腿2-A：既有 53 条抽样 5（3 GET + 2 写口负例） =================
  const s2a = [
    ['L2_health_GET_/', 'GET', '/health', {}],
    ['L2_user_GET_/api/user', 'GET', '/api/user', { token: T_WRK }],
    ['L2_taskall_GET_/api/task/all', 'GET', '/api/task/all', { token: T_WRK }],
    ['L2_currency_POST_nokey', 'POST', '/api/currency', { token: T_EMP, body: { name: `qab4 ${TAG}`, symbol: 'QAB4' } }],
    ['L2_verify_POST_missing', 'POST', '/api/tasklist/999999999/verify', { token: T_ADM, body: { approved: true } }],
  ] as const;
  R.legs2.sample = {};
  for (const [id, m, p, o] of s2a) R.legs2.sample[id] = P(id, await call(m as string, p as string, o as any));

  // ================= 腿2-B：410 面 6/6 =================
  const gone = ['/api/shard/redeem', '/api/chest/1/open', '/api/admin/settings/reset', '/api/admin/task/create', '/api/admin/prize/create', '/api/admin/assets/init'];
  R.legs2.gone = {};
  for (const g of gone) R.legs2.gone[g] = P('L2_GONE' + g, await call('POST', g, { token: T_ADM, body: {} }));

  // ================= 腿3 + 开口③：fee>0 全链 A1→A2→A3→A4→A5 approve =================
  const preFee = await ledgerCount();
  const c1 = await call('POST', '/api/job', { token: T_EMP, body: { cid: CID, reward: '100000', title: `qab4 fee>0 ${TAG}`, description: 'neng qab4 fee>0 probe', create_key: K('feejob') } });
  R.legs3.A1_post_job = P('L3_A1_post_job(fee>0)', c1);
  const JOB = num(c1.json?.data?.job_id, c1.json?.data?.jobId, c1.json?.data?.job?.id, c1.json?.data?.id);
  R.legs3.job_id = JOB;
  if (!JOB) throw new Error('A1 no job id');

  const c2 = await call('POST', `/api/job/${JOB}/apply`, { token: T_WRK, body: { create_key: K('feeapply') } });
  R.legs3.A2_post_apply = P('L3_A2_post_apply', c2);
  const APP = num(c2.json?.data?.application_id, c2.json?.data?.applicationId, c2.json?.data?.id);
  R.legs3.application_id = APP;

  const c3 = await call('POST', `/api/job/${JOB}/accept`, { token: T_EMP, body: { application_id: APP } });
  R.legs3.A3_post_accept = P('L3_A3_post_accept', c3);

  const c4 = await call('POST', `/api/job/${JOB}/submit`, { token: T_WRK, body: { deliverable: `qab4 deliverable ${TAG}` } });
  R.legs3.A4_post_submit = P('L3_A4_post_submit', c4);

  const c5 = await call('POST', `/api/job/${JOB}/review`, { token: T_ADM, body: { approved: true } });
  R.legs3.A5_post_review_approve = P('L3_A5_post_review_approve', c5);

  // 结算分录形态（按 event_root_key）
  const settleLegs = await raw(`SELECT uid::text AS uid, kind, delta::text AS delta, frozen_delta::text AS frozen_delta, memo
     FROM public.ledger_entry WHERE event_root_key = $1 ORDER BY txid`, [`biz:job:settle:${JOB}`]);
  R.fee_pos.settle_job_id = JOB;
  R.fee_pos.settle_legs = settleLegs;
  R.fee_pos.settle_legs_n = settleLegs.length;
  R.fee_pos.kind_counts = settleLegs.reduce((a: Record<string, number>, l: any) => { a[l.kind] = (a[l.kind] || 0) + 1; return a; }, {});
  R.fee_pos.uid_counts = settleLegs.reduce((a: Record<string, number>, l: any) => { a[l.uid] = (a[l.uid] || 0) + 1; return a; }, {});
  // job_fee/commission 去向 + 佣金合计 vs 手续费
  const feeRow = settleLegs.filter((l: any) => l.kind === 'job_fee');
  const comRow = settleLegs.filter((l: any) => l.kind === 'commission');
  const sumFee = feeRow.reduce((a: bigint, l: any) => a + BigInt(l.delta) + BigInt(l.frozen_delta), 0n);
  const sumCom = comRow.reduce((a: bigint, l: any) => a + BigInt(l.delta) + BigInt(l.frozen_delta), 0n);
  R.fee_pos.job_fee_uids = [...new Set(feeRow.map((l: any) => l.uid))];
  R.fee_pos.job_fee_sum_net = String(sumFee);
  R.fee_pos.commission_legs_n = comRow.length;
  R.fee_pos.commission_sum_net = String(sumCom);
  R.fee_pos.commission_equals_fee = String(sumFee + sumCom) === '0';
  R.fee_pos.fee_positive = feeRow.some((l: any) => BigInt(l.delta) !== 0n || BigInt(l.frozen_delta) !== 0n);
  R.fee_pos.ledger_delta_this_chain = (await ledgerCount()) - preFee;
  console.log('FEE_POS ' + JSON.stringify({ legs: R.fee_pos.settle_legs_n, kinds: R.fee_pos.kind_counts, fee_uids: R.fee_pos.job_fee_uids, com_legs: R.fee_pos.commission_legs_n, com_sum: R.fee_pos.commission_sum_net, fee_sum: R.fee_pos.job_fee_sum_net }));
  console.log('SETTLE_LEGS ' + JSON.stringify(settleLegs));

  // ================= 腿3 第三口：A11 管理口 =================
  const eff = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const c11 = await call('POST', '/api/admin/commission_policy', { token: T_ADM, body: { fee_rate_bp: 100, levels: 10, weights_bp: [3000, 2000, 1500, 1000, 800, 600, 500, 300, 200, 100], effective_from: eff, created_by: 'qab4' } });
  R.legs3.A11_post_commission_policy = P('L3_A11_post_commission_policy', c11, { effective_from_sent: eff });

  // ================= 腿4：post 不变量 =================
  R.invariants.sigma_total_post = await sigmaTotal();
  R.invariants.ledger_rows_post = await ledgerCount();
  R.invariants.neg_rows_post = await negRows();
  R.invariants.baseline = '2020100';

  fs.writeFileSync(path.join(outDir, 'qab4-03-http.json'), JSON.stringify(R, null, 1));
  console.log('INVARIANTS ' + JSON.stringify(R.invariants));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
