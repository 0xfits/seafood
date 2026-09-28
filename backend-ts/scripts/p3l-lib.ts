/**
 * P3-L（商品柱 · 0015_listing.sql）自用探针库 —— 只读为主，落 run-tagged 读数。
 * 测试数据分区：uid 由 users identity 分配（DL108：不得显式指定 uid）；幂等键前缀 `ops:p3l:` / `cli:p3l-`。
 * 只写本库；不改 src / migrations（迁移文件在判负自证里只被**读取**并复制到 scratch）、docs。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

export const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
export const RUN = process.env.P3L_RUN || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
export const OUT_DIR = path.resolve(__dirname, '..', '.p3l-artifacts');
export const REPO = path.resolve(__dirname, '..');

export const mkPool = (max = 2, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export const raw = async <R = Record<string, unknown>>(p: Pool, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await p.query(sql, params as never[])).rows as R[];

export const raw1 = async <R = Record<string, unknown>>(p: Pool, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(p, sql, params))[0] ?? null;

export interface ErrInfo {
  sqlstate: string | null; message: string; detail: string; constraint: string | null;
  reason: string | null; field: string | null; detail_parsed: Record<string, unknown> | null;
}

export const errInfo = (e: unknown): ErrInfo => {
  const a = e as Record<string, unknown>;
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(String(a?.detail ?? '')) as Record<string, unknown>; } catch { /* noop */ }
  return {
    sqlstate: (a?.code as string) ?? null,
    message: String(a?.message ?? e).slice(0, 240),
    detail: String(a?.detail ?? '').slice(0, 600),
    constraint: (a?.constraint as string) ?? null,
    reason: (parsed?.reason as string) ?? null,
    field: (parsed?.field as string) ?? null,
    detail_parsed: parsed,
  };
};

export const sha256 = (s: string | Buffer): string =>
  crypto.createHash('sha256').update(s as never).digest('hex');
export const md5 = (s: string | Buffer): string =>
  crypto.createHash('md5').update(s as never).digest('hex');

/** 落 run-tagged 读数；**同名拒写**（DL121/DL149 的「永不写固定文件名」纪律） */
export const save = (label: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p3l-${RUN}-${label}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite artifact: ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, label, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

/** 唯一编排函数入口（DL142：编排函数只由迁移创建；探针只 CALL 它） */
export const listingPostEvent = async (p: Pool, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await raw1<{ r: Record<string, unknown> }>(p, 'SELECT public.listing_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  if (!r) throw new Error('listing_post_event returned no row');
  return r.r;
};

export const ledgerPostEvent = async (p: Pool, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await raw1<{ r: Record<string, unknown> }>(p, 'SELECT public.ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  if (!r) throw new Error('ledger_post_event returned no row');
  return r.r;
};

export const ensureUser = async (p: Pool, evmRaw: string): Promise<string> => {
  const evm = /^0x[0-9a-fA-F]{40}$/.test(evmRaw) ? evmRaw.toLowerCase() : `0x${sha256(evmRaw).slice(0, 40)}`;
  const cols = await raw<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }>(
    p,
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`,
  );
  const extra = cols.filter((c) =>
    c.is_nullable === 'NO' && c.column_default === null
    && c.column_name !== 'uid' && c.column_name !== 'evm');
  const names = ['evm', ...extra.map((c) => c.column_name)];
  const vals = [`'${evm.replace(/'/g, "''")}'`,
    ...extra.map((c) => (/timestamp|date/.test(c.data_type) ? 'now()' : "''"))];
  try {
    await raw(p, `INSERT INTO public.users (${names.join(',')}) VALUES (${vals.join(',')}) ON CONFLICT DO NOTHING RETURNING uid`);
  } catch (e) {
    const i = errInfo(e);
    if (i.sqlstate !== '23505') throw e;
  }
  const got = await raw1<{ uid: string }>(p, 'SELECT uid::text AS uid FROM public.users WHERE lower(evm) = lower($1) LIMIT 1', [evm]);
  if (!got) throw new Error(`ensureUser failed for ${evm}`);
  return got.uid;
};

/**
 * 建一条商品夹具（**直接 INSERT**：DL99 ⇒ 发布属「无分录的写」，不经编排函数）。
 * 状态默认可选，便于测「库存变更只允许 listed」与终态。
 */
export const ensureListing = async (
  p: Pool, sellerUid: string, cid: string, price: string, stock: number,
  status = 'draft', tag = '',
): Promise<{ listing_id: string; create_key: string }> => {
  const key = `cli:p3l-${RUN}-listing-${tag}`;
  const got = await raw1<{ listing_id: string }>(p, 'SELECT listing_id::text AS listing_id FROM public.listing WHERE create_key = $1', [key]);
  if (got) return { listing_id: got.listing_id, create_key: key };
  const ins = await raw1<{ listing_id: string }>(
    p,
    `INSERT INTO public.listing (seller_uid, cid, price, stock, title, status, create_key)
     VALUES ($1::bigint, $2::bigint, $3::bigint, $4::int, '', $5, $6) RETURNING listing_id::text AS listing_id`,
    [sellerUid, cid, price, stock, status, key],
  );
  if (!ins) throw new Error('fixture listing insert failed');
  return { listing_id: ins.listing_id, create_key: key };
};

export const listingRow = async (p: Pool, id: string): Promise<Record<string, unknown> | null> =>
  raw1(p, `SELECT listing_id::text AS listing_id, seller_uid::text AS seller_uid, cid::text AS cid,
                  price::text AS price, stock, title, description, media_urls, status, create_key,
                  ledger_event_keys, time_created::text AS time_created, time_updated::text AS time_updated
             FROM public.listing WHERE listing_id = $1::bigint`, [id]);

export const orderRow = async (p: Pool, id: string): Promise<Record<string, unknown> | null> =>
  raw1(p, `SELECT order_id::text AS order_id, listing_id::text AS listing_id, buyer_uid::text AS buyer_uid,
                  seller_uid::text AS seller_uid, cid::text AS cid, price::text AS price, quantity, status,
                  create_key, pay_txid::text AS pay_txid, refund_txid::text AS refund_txid,
                  ledger_event_keys, time_created::text AS time_created, time_updated::text AS time_updated
             FROM public.listing_order WHERE order_id = $1::bigint`, [id]);

export const acct = async (p: Pool, uid: string, cid = '1'): Promise<Record<string, unknown> | null> =>
  raw1(p, 'SELECT balance::text AS balance, frozen::text AS frozen FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint', [uid, cid]);

export const ledgerCount = async (p: Pool): Promise<string> =>
  (await raw1<{ n: string }>(p, 'SELECT count(*)::text AS n FROM public.ledger_entry'))?.n ?? '0';

export const entriesOfKey = async (p: Pool, evtRoot: string): Promise<Record<string, unknown>[]> =>
  raw(p, `SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS frozen_delta,
                 kind, ref_type, ref_id::text AS ref_id, event_root_key, txid::text AS txid
            FROM public.ledger_entry WHERE event_root_key = $1 OR event_root_key LIKE $1 || '#%'
           ORDER BY txid`, [evtRoot]);

/** 从既有存量账户搬水（与 p3f 同法）；只写本库、只动收支双方的可用余额 */
export const fundFromResidual = async (p: Pool, toUid: string, need: bigint, cid = '1'): Promise<Record<string, unknown>> => {
  const donors = await raw<{ uid: string; balance: string }>(
    p,
    `SELECT a.uid::text AS uid, a.balance::text AS balance
       FROM public.account a
      WHERE a.cid = $2::bigint AND a.balance > 0 AND a.uid > 0 AND a.uid <> $1::bigint
      ORDER BY a.balance DESC
      LIMIT 20`,
    [toUid, cid],
  );
  let remaining = need;
  const transfers: unknown[] = [];
  for (const d of donors) {
    if (remaining <= 0n) break;
    const bal = BigInt(d.balance);
    const cap = bal > 100n ? bal - 100n : bal;
    const take = cap < remaining ? cap : remaining;
    if (take <= 0n) continue;
    const res = await ledgerPostEvent(p, {
      op: 'transfer', idempotency_key: `ops:p3l:${RUN}:fund:${toUid}:${d.uid}`,
      from_uid: d.uid, to_uid: toUid, cid, amount: take.toString(),
    });
    transfers.push({ from_uid: d.uid, amount: take.toString(), txid: res.txid, idempotent_replay: res.idempotent_replay });
    remaining -= take;
  }
  if (remaining > 0n) throw new Error(`insufficient residual liquidity for uid ${toUid}: short ${remaining}`);
  return { need: need.toString(), donors_used: transfers };
};

/** 断言容器 */
export interface Check { id: string; name: string; pass: boolean; readout: Record<string, unknown>; }
export const mkChecks = (): { add: (id: string, name: string, pass: boolean, readout?: Record<string, unknown>) => void; list: Check[] } => {
  const list: Check[] = [];
  return { list, add: (id, name, pass, readout = {}) => { list.push({ id, name, pass, readout }); } };
};
