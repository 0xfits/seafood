/**
 * P1e 质检 · 公共库（Neng 自写，**不 import src/** 以免「用实现测实现」）
 * ============================================================================
 * 只提供：连接、裸 SQL 执行、`ledger_post_event` 直调、PG 错误原样提取、只读核对 SQL。
 * 用法：const { withPool, callFn, attempt, pgInfo } = require('./qa-p1e-lib')
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

export const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
export const POOLED_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || DIRECT_URL;

export const FN_SQL = 'SELECT ledger_post_event($1::jsonb) AS r';

/** 建一个独立池（max 必须显式给出：并发上限测试的读数完全取决于它） */
export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export const withPool = async <T>(max: number, fn: (p: Pool) => Promise<T>, url = DIRECT_URL): Promise<T> => {
  const p = mkPool(max, url);
  try { return await fn(p); } finally { await p.end().catch(() => undefined); }
};

export interface PgInfo {
  code: string | null; message: string; detail: string | null;
  constraint: string | null; hint: string | null; where: string | null; name: string;
}

/** 原始 PG 错误**原样**提取（不归一化、不友好化） */
export const pgInfo = (e: unknown): PgInfo => {
  const a = e as Record<string, unknown>;
  return {
    code: (a?.code as string) ?? null,
    message: String(a?.message ?? e),
    detail: (a?.detail as string) ?? null,
    constraint: (a?.constraint as string) ?? null,
    hint: (a?.hint as string) ?? null,
    where: (a?.where as string) ?? null,
    name: String((a as { name?: unknown })?.name ?? 'Error'),
  };
};

/** 裸 SQL（**不重试**：并发读数必须包含真实失败） */
export const raw = async <R = Record<string, string>>(p: Pool, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await p.query(sql, params as never[])).rows as R[];

/** 直调 DB 函数（对象 payload） */
export const callFn = async (p: Pool, payload: unknown): Promise<Record<string, unknown>> => {
  const rows = await raw<{ r: unknown }>(p, FN_SQL, [JSON.stringify(payload)]);
  return normFn(rows[0]?.r);
};

/** 直调 DB 函数（**原样文本** payload：用于畸形 JSON 形状攻击） */
export const callFnText = async (p: Pool, payloadText: string): Promise<Record<string, unknown>> => {
  const rows = await raw<{ r: unknown }>(p, FN_SQL, [payloadText]);
  return normFn(rows[0]?.r);
};

const normFn = (r: unknown): Record<string, unknown> =>
  (typeof r === 'string' ? JSON.parse(r) : r) as Record<string, unknown>;

export interface Attempt {
  ok: boolean; replay?: boolean; txid?: string | null;
  entries?: Array<Record<string, string | null>>;
  accounts?: Array<Record<string, string>>;
  extra?: Record<string, string | null>;
  lock_trace?: string[];
  error?: PgInfo;
}

/** 一次直调：成功给结果摘要，失败给**原始** PG 错误 */
export const attempt = async (p: Pool, payload: unknown): Promise<Attempt> => {
  try {
    const r = await callFn(p, payload);
    return {
      ok: r?.ok === true,
      replay: r?.idempotent_replay === true,
      txid: (r?.txid ?? null) as string | null,
      entries: (r?.entries as Array<Record<string, string | null>>) ?? [],
      accounts: (r?.accounts as Array<Record<string, string>>) ?? [],
      extra: (r?.extra as Record<string, string | null>) ?? {},
      lock_trace: ((r?.meta as { lock_trace?: string[] } | undefined)?.lock_trace) ?? undefined,
    };
  } catch (e) {
    return { ok: false, error: pgInfo(e) };
  }
};

export const attemptText = async (p: Pool, payloadText: string): Promise<Attempt> => {
  try {
    const r = await callFnText(p, payloadText);
    return {
      ok: r?.ok === true, replay: r?.idempotent_replay === true,
      txid: (r?.txid ?? null) as string | null,
      entries: (r?.entries as Array<Record<string, string | null>>) ?? [],
      lock_trace: ((r?.meta as { lock_trace?: string[] } | undefined)?.lock_trace) ?? undefined,
    };
  } catch (e) {
    return { ok: false, error: pgInfo(e) };
  }
};

/** 只读核对 */
export const judgementRows = async (p: Pool) => ({
  j1_drift: await raw(p, `
    SELECT a.uid, a.cid, a.balance, a.frozen, COALESCE(s.d,0) AS sum_delta, COALESCE(s.f,0) AS sum_frozen_delta
      FROM account a
      LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f
                   FROM ledger_entry GROUP BY uid, cid) s ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`),
  j8_ref: await raw(p, `
    WITH ev AS (
      SELECT ref_type, ref_id, SUM(delta + frozen_delta) AS net_sum, count(*) AS entries,
             bool_or(kind IN ('mint','burn')) AS has_mint_burn
        FROM ledger_entry WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL
       GROUP BY ref_type, ref_id)
    SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`),
  j8_key: await raw(p, `
    WITH ev AS (
      SELECT split_part(idempotency_key, '#', 1) AS base_key,
             SUM(delta + frozen_delta) AS net_sum, count(*) AS entries,
             bool_or(kind IN ('mint','burn')) AS has_mint_burn
        FROM ledger_entry GROUP BY 1)
    SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`),
  negatives: await raw(p, `SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0`),
  supply_over: await raw(p, `
    SELECT c.cid, c.symbol, c.total_supply, c.supply_cap FROM currency c
     WHERE c.supply_cap IS NOT NULL AND c.total_supply > c.supply_cap`),
  supply_mismatch: await raw(p, `
    SELECT c.cid, c.symbol, c.total_supply, COALESCE(m.d,0) AS minted
      FROM currency c
      LEFT JOIN (SELECT cid, SUM(delta) AS d FROM ledger_entry WHERE kind = 'mint' GROUP BY cid) m ON m.cid = c.cid
     WHERE c.total_supply <> COALESCE(m.d,0)`),
  platform: await raw(p, `
    SELECT uid, cid, balance, frozen, version FROM account
     WHERE uid IN (0,-1,-2,-3) ORDER BY uid, cid`),
});

export const accountsOf = async (p: Pool, pairs: Array<[string | number, string | number]>) =>
  raw(p, `
    SELECT uid, cid, balance, frozen, version FROM account
     WHERE (uid, cid) IN (SELECT * FROM unnest($1::bigint[], $2::bigint[])) ORDER BY uid, cid`,
  [pairs.map((x) => String(x[0])), pairs.map((x) => String(x[1]))]);

export const entriesFor = async (p: Pool, key: string) =>
  raw(p, `
    SELECT txid, uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key, request_fingerprint
      FROM ledger_entry
     WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#'
     ORDER BY txid`, [key]);

export const entryCount = async (p: Pool): Promise<string> =>
  String((await raw<{ n: string }>(p, 'SELECT count(*)::text AS n FROM ledger_entry'))[0].n);

export const deadlocks = async (p: Pool): Promise<string> =>
  String((await raw<{ n: string }>(p, `SELECT COALESCE(SUM(deadlocks),0)::text AS n FROM pg_stat_database`))[0].n);

/** 新建测试币（symbol 前缀 qae） */
export const ensureCurrency = async (
  p: Pool, symbol: string, owner: bigint, decimals: number, status: string, cap: string | null,
): Promise<string> => {
  const rows = await raw<{ cid: string }>(p, `
    INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
    VALUES ($1, $2, $3, $4, 0, $5, $6, CASE WHEN $6 = 'draft' THEN NULL ELSE now() END)
    RETURNING cid`, [symbol, `QAE P1e ${symbol}`, String(owner), decimals, cap, status]);
  return rows[0].cid;
};

export const jstr = (v: unknown): string => JSON.stringify(v);
export const ms = async (fn: () => Promise<unknown>): Promise<number> => {
  const t0 = Date.now(); await fn(); return Date.now() - t0;
};
export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** pg_stat_activity 采样（并发真实性取证） */
export const sampleActivity = async (p: Pool) =>
  raw(p, `
    SELECT count(*)::text AS backends,
           count(*) FILTER (WHERE state = 'active')::text AS active,
           count(*) FILTER (WHERE wait_event_type = 'Lock')::text AS lock_waiters,
           count(DISTINCT pid)::text AS distinct_pids
      FROM pg_stat_activity
     WHERE query ILIKE '%ledger_post_event%' AND pid <> pg_backend_pid()`);
