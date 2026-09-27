/**
 * P1e · 探针公共库（**直接调 DB 函数，不经 TS 服务层**）
 * ----------------------------------------------------------------------------
 * 目的：证明 `ledger_post_event` 本身可被直接调用与断言（D10 连带约束 ④）。
 * 只用 @neondatabase/serverless 的 Pool over WebSocket + DATABASE_URL_UNPOOLED，
 * 不 import src/ledger.ts 的任何东西（避免「用实现测实现」）。
 *
 * 用法：
 *   const { rawCall, pgErr, q } = require('./p1e-lib')
 *   const r = await rawCall({ op: 'transfer', ... })     // 返回 jsonb 结果对象
 *   catch (e) { pgErr(e) }                               // { code, message, detail }
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const URL_DIRECT = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
const URL_POOLED = process.env.DATABASE_URL || process.env.POSTGRES_URL || URL_DIRECT;

let directPool: Pool | null = null;
let pooledPool: Pool | null = null;

export const getDirect = (): Pool => {
  if (!directPool) directPool = new Pool({ connectionString: URL_DIRECT, max: Number(process.env.P1E_POOL_MAX || 8) });
  return directPool;
};
export const getPooled = (): Pool => {
  if (!pooledPool) pooledPool = new Pool({ connectionString: URL_POOLED, max: 4 });
  return pooledPool;
};

export const closeAll = async (): Promise<void> => {
  if (directPool) { await directPool.end().catch(() => undefined); directPool = null; }
  if (pooledPool) { await pooledPool.end().catch(() => undefined); pooledPool = null; }
};

/** 单语句查询（默认走直连；写路径必须直连）。
 *  实测：本机 ↔ Neon(新加坡) 的 WebSocket 建连偶发 TLS 断连（Client network socket
 *  disconnected before secure TLS connection was established）⇒ 只对**连接级**瞬时错误
 *  重试（业务错误一律不重试：重试会破坏幂等断言的读数）。 */
const TRANSIENT_RE = /socket disconnected|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|connection terminated|Timeout/i;

export const q = async <R = Record<string, unknown>>(
  sql: string, params: unknown[] = [], usePooled = false, attempts = 4,
): Promise<R[]> => {
  const pool = usePooled ? getPooled() : getDirect();
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await pool.query(sql, params as never[]);
      return res.rows as R[];
    } catch (e) {
      lastErr = e;
      const info = pgErr(e);
      const transient = info.code === null && TRANSIENT_RE.test(info.message);
      if (!transient || i + 1 >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
};

export interface PgErrInfo {
  code: string | null;
  message: string;
  detail: string | null;
  constraint: string | null;
  where: string | null;
  hint: string | null;
  raw_name: string;
}

export const pgErr = (e: unknown): PgErrInfo => {
  const a = e as Record<string, unknown>;
  return {
    code: (a?.code as string) ?? null,
    message: String(a?.message ?? e),
    detail: (a?.detail as string) ?? null,
    constraint: (a?.constraint as string) ?? null,
    where: (a?.where as string) ?? null,
    hint: (a?.hint as string) ?? null,
    raw_name: String((a as { name?: unknown })?.name ?? 'Error'),
  };
};

export interface FnResult {
  ok?: boolean;
  idempotent_replay?: boolean;
  idempotency_key?: string;
  txid?: string | null;
  entries?: Array<Record<string, string | null>>;
  accounts?: Array<Record<string, string>>;
  extra?: Record<string, string | null>;
  meta?: { op?: string; lock_trace?: string[] };
}

/** 直接调 DB 函数（**唯一入口**）；成功返回结果对象，失败抛出原始 PG 错误 */
export const rawCall = async (payload: Record<string, unknown>, attempts = 2): Promise<FnResult> => {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const rows = await q<{ r: FnResult | string }>('SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
      const r = rows[0]?.r;
      return typeof r === 'string' ? (JSON.parse(r) as FnResult) : (r as FnResult);
    } catch (e) {
      const info = pgErr(e);
      // LD006 = LEDGER_IDEMPOTENCY_REPLAY：并发同键落在本语句快照之外 ⇒ 重发一次
      if (info.code === 'LD006' && i + 1 < attempts) { lastErr = e; continue; }
      throw e;
    }
  }
  throw lastErr;
};

/** 键族流水（键 + 派生键 `<key>#<i>`） */
export const keyFamily = async (key: string) =>
  q<Record<string, string>>(
    `SELECT txid, uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key
       FROM ledger_entry
      WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#'
      ORDER BY txid`, [key]);

export const entryCount = async (): Promise<string> =>
  String((await q<{ n: string }>('SELECT count(*)::text AS n FROM ledger_entry'))[0].n);

export const accountOf = async (uid: string | number | bigint, cid: string | number | bigint) => {
  const rows = await q<Record<string, string>>(
    'SELECT uid, cid, balance, frozen, version FROM account WHERE uid = $1 AND cid = $2', [String(uid), String(cid)]);
  return rows[0] ?? null;
};

/** §11 判据 1：账户级守恒差异（应为 0 行） */
export const judgement1 = async () =>
  q<Record<string, string>>(
    `SELECT a.uid, a.cid, a.balance, a.frozen, COALESCE(s.d,0) AS sum_delta, COALESCE(s.f,0) AS sum_frozen_delta
       FROM account a
       LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f FROM ledger_entry GROUP BY uid, cid) s
         ON s.uid = a.uid AND s.cid = a.cid
      WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`);

/** §11 判据 8（正式形状，spec §19.2）：同一事件内 Σ(delta + frozen_delta) = 0；
 *  含 mint/burn 的事件豁免（差额 = 净增发额）。按 (ref_type, ref_id) 分组（spec 原形）。 */
export const judgement8 = async () =>
  q<Record<string, string>>(
    `WITH ev AS (
       SELECT ref_type, ref_id,
              SUM(delta + frozen_delta) AS net_sum,
              count(*) AS entries,
              bool_or(kind IN ('mint','burn')) AS has_mint_burn
         FROM ledger_entry
        WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL
        GROUP BY ref_type, ref_id)
     SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`);

/** 判据 8 的**键族形状**（覆盖 ref 为 NULL 的事件）：按 base key 分组，同样豁免 mint/burn */
export const judgement8ByKey = async () =>
  q<Record<string, string>>(
    `WITH ev AS (
       SELECT split_part(idempotency_key, '#', 1) AS base_key,
              SUM(delta + frozen_delta) AS net_sum,
              count(*) AS entries,
              bool_or(kind IN ('mint','burn')) AS has_mint_burn
         FROM ledger_entry
        GROUP BY 1)
     SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`);

/** 判据 8 的豁免面读数：含 mint/burn 的事件（净额必须等于净增发额，非 0 属正常） */
export const judgement8Exempt = async () =>
  q<Record<string, string>>(
    `WITH ev AS (
       SELECT split_part(idempotency_key, '#', 1) AS base_key,
              SUM(delta + frozen_delta) AS net_sum,
              SUM(CASE WHEN kind IN ('mint','burn') THEN delta ELSE 0 END) AS net_issuance,
              count(*) AS entries
         FROM ledger_entry
        GROUP BY 1)
     SELECT * FROM ev WHERE net_issuance <> 0 OR net_sum = 0 ORDER BY base_key`);


/** 总额守恒读数：按 cid 的 Σ(balance+frozen) */
export const totals = async () =>
  q<Record<string, string>>(
    `SELECT cid, SUM(balance) AS sum_balance, SUM(frozen) AS sum_frozen, SUM(balance + frozen) AS sum_net
       FROM account WHERE uid >= 900000 GROUP BY cid ORDER BY cid`);

export const testAccountRows = async () =>
  q<Record<string, string>>('SELECT uid, cid, balance, frozen FROM account WHERE uid >= 900000 ORDER BY uid, cid');

export const jstr = (v: unknown): string => JSON.stringify(v);
