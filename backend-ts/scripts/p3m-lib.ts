/**
 * P3-M（交易所柱 · `0016_market.sql`）自用探针库 —— 只读为主，落 run-tagged 读数。
 *
 * 测试数据分区（**本单独占命名空间**，禁复用 9903xx / 9904xx）：
 *   · uid 窗口 **9905xx**（990501..990504，identity 为 `BY DEFAULT` ⇒ 允许显式 uid）
 *   · 创建键前缀 **`cli:kong16-`**；运维/注资键前缀 **`ops:p3m:`**
 * 只写本库；不改 src / migrations（判负自证里迁移文件只被**读取**并复制到 scratch）/ docs。
 * 所有 SQL 显式限定 `public.`（DL151）。
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
export const RUN =
  process.env.P3M_RUN ||
  new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
export const OUT_DIR = path.resolve(__dirname, '..', '.p3m-artifacts');
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

export const sha256 = (s: string | Buffer): string => crypto.createHash('sha256').update(s as never).digest('hex');
export const md5 = (s: string | Buffer): string => crypto.createHash('md5').update(s as never).digest('hex');

/** 落 run-tagged 读数；**同名拒写**（DL121/DL149「永不写固定文件名」纪律） */
export const save = (label: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p3m-${RUN}-${label}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite artifact: ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, label, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

/** 编排函数唯一入口（DL142：编排函数只由迁移创建；探针只 SELECT 它） */
export const marketPostEvent = async (p: Pool, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await raw1<{ r: Record<string, unknown> }>(p, 'SELECT public.market_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  if (!r) throw new Error('market_post_event returned no row');
  return r.r;
};

export const ledgerPostEvent = async (p: Pool, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await raw1<{ r: Record<string, unknown> }>(p, 'SELECT public.ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
  if (!r) throw new Error('ledger_post_event returned no row');
  return r.r;
};

/** 建夹具用户（uid 显式落在本单窗口 9905xx；uid 列 identity 为 BY DEFAULT） */
export const ensureUser = async (p: Pool, uid: number, tag: string): Promise<string> => {
  const evm = '0x' + sha256(`p3m-kong16-${tag}`).slice(0, 40);
  const cols = await raw<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }>(
    p,
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`,
  );
  const extra = cols.filter((c) =>
    c.is_nullable === 'NO' && c.column_default === null
    && c.column_name !== 'uid' && c.column_name !== 'evm');
  const names = ['uid', 'evm', ...extra.map((c) => c.column_name)];
  const params: unknown[] = [uid, evm, ...extra.map((c) => (/timestamp|date/.test(c.data_type) ? new Date() : ''))];
  const ph = names.map((_, i) => `$${i + 1}`).join(',');
  try {
    await raw(p, `INSERT INTO public.users (${names.join(',')}) VALUES (${ph}) ON CONFLICT DO NOTHING`, params);
  } catch (e) {
    if (errInfo(e).sqlstate !== '23505') throw e;
  }
  const got = await raw1<{ uid: string }>(p, 'SELECT uid::text AS uid FROM public.users WHERE uid = $1::bigint', [uid]);
  if (!got) throw new Error(`ensureUser failed for uid ${uid}`);
  return got.uid;
};

/** 从既有存量账户搬水（只动可用余额、只用 transfer ⇒ 不改变 total_supply；与 p3f/p3l 同法） */
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
      op: 'transfer', idempotency_key: `ops:p3m:${RUN}:fund:${cid}:${toUid}:${d.uid}`,
      from_uid: d.uid, to_uid: toUid, cid, amount: take.toString(),
    });
    transfers.push({ from_uid: d.uid, cid, amount: take.toString(), txid: res.txid, idempotent_replay: res.idempotent_replay });
    remaining -= take;
  }
  if (remaining > 0n) throw new Error(`insufficient residual liquidity (cid=${cid}) for uid ${toUid}: short ${remaining}`);
  return { need: need.toString(), cid, donors_used: transfers };
};

export const acct = async (p: Pool, uid: string, cid = '1'): Promise<Record<string, unknown> | null> =>
  raw1(p, 'SELECT balance::text AS balance, frozen::text AS frozen, version FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint', [uid, cid]);

export const ledgerCount = async (p: Pool): Promise<string> =>
  (await raw1<{ n: string }>(p, 'SELECT count(*)::text AS n FROM public.ledger_entry'))?.n ?? '0';

export const entriesOfKey = async (p: Pool, evtRoot: string): Promise<Record<string, unknown>[]> =>
  raw(p, `SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS frozen_delta,
                 kind, ref_type, ref_id::text AS ref_id, event_root_key, txid::text AS txid
            FROM public.ledger_entry WHERE event_root_key = $1 OR event_root_key LIKE $1 || '#%'
           ORDER BY txid`, [evtRoot]);

export const orderRow = async (p: Pool, id: string): Promise<Record<string, unknown> | null> =>
  raw1(p, `SELECT order_id::text AS order_id, owner_uid::text AS owner_uid, side, base_cid::text AS base_cid,
                  quote_cid::text AS quote_cid, price::text AS price, amount::text AS amount,
                  amount_filled::text AS amount_filled, status, create_key, ledger_event_keys,
                  time_created::text AS time_created, time_updated::text AS time_updated
             FROM public.market_order WHERE order_id = $1::bigint`, [id]);

export const tradeRow = async (p: Pool, id: string): Promise<Record<string, unknown> | null> =>
  raw1(p, `SELECT trade_id::text AS trade_id, base_cid::text AS base_cid, quote_cid::text AS quote_cid,
                  price::text AS price, amount::text AS amount, buy_order_id::text AS buy_order_id,
                  sell_order_id::text AS sell_order_id, taker_uid::text AS taker_uid, fee::text AS fee,
                  time_created::text AS time_created
             FROM public.market_trade WHERE trade_id = $1::bigint`, [id]);

export const orderByCreateKey = async (p: Pool, key: string): Promise<Record<string, unknown> | null> =>
  raw1<{ order_id: string }>(p, 'SELECT order_id::text AS order_id FROM public.market_order WHERE create_key = $1', [key]);

/** 断言容器 */
export interface Check { id: string; name: string; pass: boolean; readout: Record<string, unknown>; }
export const mkChecks = (): { add: (id: string, name: string, pass: boolean, readout?: Record<string, unknown>) => void; list: Check[] } => {
  const list: Check[] = [];
  return { list, add: (id, name, pass, readout = {}) => { list.push({ id, name, pass, readout }); } };
};

/** 跑一条「预期被 DB 拒」的语句，返回原始错误读数（纪律①：报「必抛」必须给原始读数） */
export const expectReject = async (
  p: Pool, sql: string, params: unknown[] = [],
): Promise<{ rejected: boolean; err: ErrInfo | null; rows: number }> => {
  try {
    const r = await raw(p, sql, params);
    return { rejected: false, err: null, rows: r.length };
  } catch (e) {
    return { rejected: true, err: errInfo(e), rows: 0 };
  }
};
