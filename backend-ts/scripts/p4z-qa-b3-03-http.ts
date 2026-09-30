/**
 * p4z-qa-b3-03-http.ts — QA-B3 腿5/7/8：幂等契约（§4.5 三款）+ 410 面补测 + 负例重测（HTTP 实测）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qa-b3-03-http.ts <outDir>
 * 只对**已注册**路由发请求；本单**不重启**服务、不改代码/规格。
 * 写库仅限 `cli:qa-b3-*` / `qa-b3` 命名夹具（symbol 以 QAB3 开头）；不删行。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <outDir>');
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const RUN = path.basename(outDir);
const BASE = 'http://127.0.0.1:5788';
type Row = Record<string, unknown>;

const SECRET = String(process.env.SECRET_KEY ?? '').trim();
if (!SECRET) throw new Error('SECRET_KEY missing in .env.local');

// ---- token 铸造（同 src/auth.ts：HS256，payload {sub, evm, exp}）----
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const mint = (uid: number): string => {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify({
    sub: String(uid), evm: '0x' + 'ab'.repeat(20), exp: Math.floor(Date.now() / 1000) + 1800,
  }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
};

const entryCount = async (): Promise<number> => {
  const r = (await sql`SELECT COUNT(1)::int AS n FROM public.ledger_entry`) as Row[];
  return Number(r[0].n);
};
const byKey = async (k: string): Promise<Row[]> => (await sql`
  SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
         frozen_delta::text AS frozen_delta, kind, idempotency_key
    FROM public.ledger_entry WHERE event_root_key = ${k} OR idempotency_key = ${k} ORDER BY txid`) as Row[];

type Res = { status: number; body: unknown };
const call = async (
  method: string, p: string, opts: { token?: string; body?: unknown } = {},
): Promise<Res> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const r = await fetch(BASE + p, {
    method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let body: unknown = null;
  const text = await r.text();
  try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  return { status: r.status, body };
};

const CODE_OF = (b: unknown): string | null => {
  const o = b as Record<string, unknown> | null;
  if (!o) return null;
  const e = o.error as Record<string, unknown> | undefined;
  if (e && typeof e === 'object') return String(e.code ?? '');
  if (typeof o.code === 'string') return o.code;
  return null;
};

async function main() {
  const results: Array<Record<string, unknown>> = [];
  const rec = async (
    id: string, leg: string, desc: string, fn: () => Promise<{ res: Res; expect: string; extra?: Record<string, unknown> }>,
  ) => {
    const base = await entryCount();
    let r: { res: Res; expect: string; extra?: Record<string, unknown> };
    try { r = await fn(); } catch (e) { r = { res: { status: -1, body: String(e) }, expect: 'no throw' }; }
    const after = await entryCount();
    results.push({
      id, leg, desc, expect: r.expect,
      status: r.res.status, code: CODE_OF(r.res.body),
      body: r.res.body,
      entries_before: base, entries_after: after, delta_entries: after - base,
      ...(r.extra || {}),
    });
    console.log(`${id} ${leg} status=${r.res.status} code=${CODE_OF(r.res.body)} dEnt=${after - base} expect=${r.expect}`);
  };

  const richUid = 970001;      // 夹具大户（cid1 = 1,891,085）
  const poorUid = 2;           // cid1 = 7,600
  const otherUid = 11;         // 非本人面
  const richT = mint(richUid), poorT = mint(poorUid), otherT = mint(otherUid);
  const stamp = RUN.replace(/[^0-9A-Za-z]/g, '').slice(-12);

  // 选一个已上市的非-$ base cid
  const listed = (await sql`
    SELECT cid::text AS cid, symbol, owner_uid::text AS owner_uid FROM public.currency
     WHERE status = 'listed' AND cid <> 1 ORDER BY cid`) as Row[];
  const baseCid = listed.length ? String(listed[0].cid) : null;

  // ================= 腿 7：410 面（无 token） =================
  const gone: Array<[string, string, unknown]> = [
    ['T01', '/api/shard/redeem', {}],
    ['T02', '/api/chest/1/open', {}],
    ['T03', '/api/admin/settings/reset', {}],
    ['T04', '/api/admin/assets/init', {}],
    ['T05', '/api/admin/task/create', {}],
    ['T06', '/api/admin/prize/create', {}],
  ];
  for (const [id, p, b] of gone) {
    await rec(id, 'L7-410', `POST ${p}（无 token）`, async () => ({ res: await call('POST', p, { body: b }), expect: '410' }));
  }

  // ================= 腿 5：幂等契约（§4.5 三款） =================
  const cSym = `QAB3${stamp}`.slice(0, 16);
  const cKey = `cli:qa-b3-c1-${stamp}`;
  const cBody = { symbol: cSym, name: 'QA B3 currency', decimals: 0, fee: 10000 };
  await rec('T07', 'L5-idem', `C1 首建（key=${cKey}）`, async () => ({
    res: await call('POST', '/api/currency', { token: richT, body: { ...cBody, create_key: cKey } }),
    expect: '200 + Δentries=+2 (currency_create_fee×2)',
  }));
  await rec('T08', 'L5-idem', '同键同内容 ⇒ 重放', async () => {
    const res = await call('POST', '/api/currency', { token: richT, body: { ...cBody, create_key: cKey } });
    return { res, expect: '200 replay，Δentries=0', extra: { replay_flag: JSON.stringify(res.body).includes('"idempotent_replay":true') } };
  });
  await rec('T09', 'L5-idem', '同键异内容 ⇒ 409', async () => ({
    res: await call('POST', '/api/currency', { token: richT, body: { ...cBody, name: 'QA B3 CHANGED', create_key: cKey } }),
    expect: '409 LEDGER_IDEMPOTENCY_CONFLICT，Δentries=0',
  }));
  await rec('T10', 'L5-idem', '异键同符号 ⇒ 409 占用', async () => ({
    res: await call('POST', '/api/currency', { token: richT, body: { ...cBody, create_key: `cli:qa-b3-c1b-${stamp}` } }),
    expect: '409 LEDGER_CURRENCY_SYMBOL_TAKEN，Δentries=0',
  }));
  await rec('T11', 'L5-idem', '非法前缀键 qa-b3: ⇒ 400 PREFIX_REQUIRED', async () => ({
    res: await call('POST', '/api/currency', { token: richT, body: { symbol: `QB${stamp.slice(-6)}`, name: 'x', fee: 10000, create_key: 'qa-b3:probe' } }),
    expect: '400 LEDGER_IDEMPOTENCY_KEY_INVALID/PREFIX_REQUIRED',
  }));

  // ================= 腿 8：负例面 =================
  await rec('N01', 'L8-neg', 'C1 余额不足（uid=2，fee=1e12）', async () => ({
    res: await call('POST', '/api/currency', { token: poorT, body: { symbol: `QA${stamp.slice(-6)}X`, name: 'poor', decimals: 0, fee: 999999999999, create_key: `cli:qa-b3-poor-${stamp}` } }),
    expect: '409 LEDGER_INSUFFICIENT_BALANCE，Δentries=0（无孤儿 currency 行）',
  }));
  const orphan = (await sql`
    SELECT COUNT(1)::int AS n FROM public.currency WHERE symbol = ${`QA${stamp.slice(-6)}X`}`) as Row[];
  results.push({ id: 'N01b', leg: 'L8-neg', desc: '余额不足后孤儿 currency 行', status: orphan[0].n, code: null, expect: '0', entries_before: null, entries_after: null, delta_entries: null });
  console.log(`N01b L8-neg orphan_currency_rows=${orphan[0].n} expect=0`);

  await rec('N02', 'L8-neg', `C2 非本人上市（cid=${listed.length ? listed[0].cid : 'n/a'}，actor=11）`, async () => ({
    res: await call('POST', `/api/currency/${listed.length ? listed[0].cid : 1}/list`, { token: otherT, body: { fee: 10000, deposit_amount: 50000 } }),
    expect: '403 AUTH_FORBIDDEN/ACTOR_NOT_ALLOWED，Δentries=0',
  }));
  await rec('N03', 'L8-neg', '未知 cid 上市 ⇒ 404 LEDGER_CURRENCY_NOT_FOUND', async () => ({
    res: await call('POST', '/api/currency/999999/list', { token: richT, body: { fee: 10000, deposit_amount: 50000 } }),
    expect: '404 LEDGER_CURRENCY_NOT_FOUND，Δentries=0',
  }));
  await rec('N04', 'L8-neg', 'M2 撤单未知 id ⇒ 404 LEDGER_REF_NOT_FOUND', async () => ({
    res: await call('DELETE', '/api/order/999999999', { token: richT }),
    expect: '404 LEDGER_REF_NOT_FOUND',
  }));

  // ================= 腿 5b/4：M1 挂单幂等 + 伪造入参被丢弃 =================
  if (baseCid) {
    const mKey = `cli:qa-b3-m1-${stamp}`;
    const mBody = { create_key: mKey, side: 'buy', bID: baseCid, price: 10, amount: 5, owner_uid: otherUid };
    await rec('T12', 'L5-idem', `M1 挂单首建（base=${baseCid}）`, async () => ({
      res: await call('POST', '/api/order', { token: richT, body: mBody }),
      expect: '200，hold×2，Δentries=+2',
    }));
    let orderId: string | null = null;
    const last = results[results.length - 1];
    const lb = last.body as Record<string, unknown> | null;
    const data = (lb && (lb.data as Record<string, unknown>)) || null;
    if (data && data.order_id) orderId = String(data.order_id);
    if (!orderId) {
      const row = (await sql`SELECT order_id::text AS id FROM public.market_order WHERE create_key = ${mKey}`) as Row[];
      if (row.length) orderId = String(row[0].id);
    }
    await rec('T13', 'L5-idem', 'M1 同键同内容 ⇒ 重放', async () => {
      const res = await call('POST', '/api/order', { token: richT, body: mBody });
      return { res, expect: '200 replay，Δentries=0', extra: { replay_flag: JSON.stringify(res.body).includes('"idempotent_replay":true'), resolved_order_id: orderId } };
    });
    await rec('T14', 'L4-spoof', 'M1 客户端 owner_uid 被丢弃（回执登记）', async () => ({
      res: await call('POST', '/api/order', { token: richT, body: { ...mBody, create_key: `cli:qa-b3-m1b-${stamp}`, amount: 1 } }),
      expect: '200，entries 全落 actuator uid，回执 client_owner_uid_ignored=11',
    }));
    if (orderId) {
      await rec('T15', 'L5-idem', `M2 撤自己的单（order_id=${orderId}）`, async () => ({
        res: await call('DELETE', `/api/order/${orderId}`, { token: richT }),
        expect: '200，hold_release×2，Δentries=+2',
      }));
      await rec('N05', 'L8-neg', `M2 非 owner 撤单（order_id=${orderId}）`, async () => ({
        res: await call('DELETE', `/api/order/${orderId}`, { token: otherT }),
        expect: '403 AUTH_FORBIDDEN 或 409（已撤单/无剩余），Δentries=0',
      }));
    }
    await rec('N06', 'L8-neg', 'M1 缺 create_key ⇒ 400 REQUIRED', async () => ({
      res: await call('POST', '/api/order', { token: richT, body: { side: 'buy', bID: baseCid, price: 1, amount: 1 } }),
      expect: '400 LEDGER_IDEMPOTENCY_KEY_REQUIRED',
    }));
    await rec('N07', 'L8-neg', 'M1 自成交面（无 M3 路由 ⇒ 以自买同价探测未覆盖）', async () => ({
      res: await call('POST', '/api/market/trade', { token: richT, body: { taker_order_id: 1, fill_no: 1, amount: 1 } }),
      expect: '404（M3 撮合端点本批未注册 ⇒ NOT_MEASURED）',
    }));
  } else {
    results.push({ id: 'T12..N07', leg: 'L5-idem', desc: '无已上市非-$ cid ⇒ M1/M2 面跳过', status: 0, expect: 'NOT_MEASURED' });
  }

  const out = {
    run: RUN, at: new Date().toISOString(), probe: 'p4z-qa-b3-03-http',
    base_url: BASE, tokens: { richUid, poorUid, otherUid }, listed_currencies: listed.map((l) => ({ cid: String(l.cid), symbol: String(l.symbol), owner_uid: String(l.owner_uid) })),
    fixtures: { symbol: cSym, create_key: cKey, base_cid: baseCid },
    cases: results,
  };
  const file = path.join(outDir, 'qa-b3-03-http.json');
  if (fs.existsSync(file)) throw new Error('refuse to overwrite: ' + file);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('WROTE ' + file);
  console.log('listed=' + JSON.stringify(out.listed_currencies));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
