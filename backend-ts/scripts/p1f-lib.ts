/**
 * P1f · 修复轮（Kong）自用探针库 —— **不 import src/** 之外的东西，独立于 QA 资产
 * ============================================================================
 * 与 qa-p1e-lib.ts 的差异：
 *   ① 完全独立（不复用质检脚本的 helper，避免「改质检资产」的嫌疑）；
 *   ② 按 0005 之后的形状取证：流水键族查询优先用 `event_root_key`（列的生成值），
 *      列不存在时退回旧前缀谓词 ⇒ 同一套脚本可用于「修前 / 修后」对比；
 *   ③ 测试数据分区：uid 942xxx，symbol 前缀 p1h，键前缀 ops:p1h:*（920/931/941 已被占）。
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

export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export const raw = async <R = Record<string, string>>(p: Pool, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await p.query(sql, params as never[])).rows as R[];

export interface PgInfo {
  code: string | null; message: string; detail: string | null;
  constraint: string | null; hint: string | null; name: string;
}

export const pgInfo = (e: unknown): PgInfo => {
  const a = e as Record<string, unknown>;
  return {
    code: (a?.code as string) ?? null,
    message: String(a?.message ?? e),
    detail: (a?.detail as string) ?? null,
    constraint: (a?.constraint as string) ?? null,
    hint: (a?.hint as string) ?? null,
    name: String((a as { name?: unknown })?.name ?? 'Error'),
  };
};

const normFn = (r: unknown): Record<string, unknown> =>
  (typeof r === 'string' ? JSON.parse(r) : r) as Record<string, unknown>;

export const callFnText = async (p: Pool, payloadText: string): Promise<Record<string, unknown>> =>
  normFn((await raw<{ r: unknown }>(p, FN_SQL, [payloadText]))[0]?.r);

export const callFn = async (p: Pool, payload: unknown): Promise<Record<string, unknown>> =>
  callFnText(p, JSON.stringify(payload));

export interface Attempt {
  ok: boolean; replay?: boolean; txid?: string | null;
  entries?: Array<Record<string, string | null>>;
  accounts?: Array<Record<string, string>>;
  extra?: Record<string, string | null>;
  lock_trace?: string[];
  result?: Record<string, unknown>;
  error?: PgInfo;
  elapsed_ms?: number;
}

const attemptText = async (p: Pool, payloadText: string): Promise<Attempt> => {
  const t0 = Date.now();
  try {
    const r = await callFnText(p, payloadText);
    return {
      ok: r?.ok === true, replay: r?.idempotent_replay === true,
      txid: (r?.txid ?? null) as string | null,
      entries: (r?.entries as Array<Record<string, string | null>>) ?? [],
      accounts: (r?.accounts as Array<Record<string, string>>) ?? [],
      extra: (r?.extra as Record<string, string | null>) ?? {},
      lock_trace: ((r?.meta as { lock_trace?: string[] } | undefined)?.lock_trace) ?? undefined,
      result: r, elapsed_ms: Date.now() - t0,
    };
  } catch (e) {
    return { ok: false, error: pgInfo(e), elapsed_ms: Date.now() - t0 };
  }
};

export const attempt = (p: Pool, payload: unknown): Promise<Attempt> => attemptText(p, JSON.stringify(payload));

export const jstr = (v: unknown): string => JSON.stringify(v);
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const ms = async (fn: () => Promise<unknown>): Promise<number> => {
  const t0 = Date.now(); await fn(); return Date.now() - t0;
};

/** event_root_key 列是否存在（决定键族查询走哪条路：修前 / 修后） */
export const hasRootKeyColumn = async (p: Pool): Promise<boolean> =>
  (await raw(p, `SELECT 1 AS x FROM information_schema.columns
                  WHERE table_name = 'ledger_entry' AND column_name = 'event_root_key'`)).length > 0;

/** 键族流水：优先按事件根键列精确归属；列不存在（修前）时退回旧前缀谓词 */
export const entriesFor = async (p: Pool, key: string): Promise<Array<Record<string, string>>> => {
  if (await hasRootKeyColumn(p)) {
    return raw(p, `
      SELECT txid, uid, cid, delta, frozen_delta, balance_after, frozen_after, kind,
             idempotency_key, request_fingerprint, event_root_key
        FROM ledger_entry WHERE event_root_key = $1 ORDER BY txid`, [key]);
  }
  return raw(p, `
    SELECT txid, uid, cid, delta, frozen_delta, balance_after, frozen_after, kind,
           idempotency_key, request_fingerprint
      FROM ledger_entry WHERE idempotency_key = $1 OR left(idempotency_key, length($1) + 1) = $1 || '#'
      ORDER BY txid`, [key]);
};

/** 表中该键精确命中（不看派生键） */
export const rowsExactlyKeyed = (p: Pool, key: string): Promise<Array<Record<string, string>>> =>
  raw(p, `SELECT txid, uid, cid, delta, frozen_delta, idempotency_key, request_fingerprint${''}
            FROM ledger_entry WHERE idempotency_key = $1 ORDER BY txid`, [key]);

export const accountOf = async (p: Pool, uid: string | number | bigint, cid: string | number | bigint) =>
  (await raw(p, 'SELECT uid, cid, balance, frozen, version FROM account WHERE uid = $1 AND cid = $2',
    [String(uid), String(cid)]))[0] ?? null;

export const entryCount = async (p: Pool): Promise<string> =>
  String((await raw<{ n: string }>(p, 'SELECT count(*)::text AS n FROM ledger_entry'))[0].n);

export const deadlocks = async (p: Pool): Promise<string> =>
  String((await raw<{ n: string }>(p, `SELECT COALESCE(SUM(deadlocks),0)::text AS n FROM pg_stat_database`))[0].n);

export const negatives = async (p: Pool): Promise<string> =>
  String((await raw<{ n: string }>(p, 'SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0'))[0].n);

/** §11 判据 1（账户级守恒差异行数） */
export const judgement1 = async (p: Pool): Promise<Array<Record<string, string>>> =>
  raw(p, `SELECT a.uid, a.cid, a.balance, a.frozen, COALESCE(s.d,0) AS sum_delta, COALESCE(s.f,0) AS sum_frozen_delta
            FROM account a
            LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f FROM ledger_entry GROUP BY uid, cid) s
              ON s.uid = a.uid AND s.cid = a.cid
           WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`);

/** §11 判据 8（键族形状，豁免 mint/burn） */
export const judgement8ByKey = async (p: Pool): Promise<Array<Record<string, string>>> =>
  raw(p, `WITH ev AS (
            SELECT COALESCE(event_root_key, split_part(idempotency_key, '#', 1)) AS base_key,
                   SUM(delta + frozen_delta) AS net_sum, count(*) AS entries,
                   bool_or(kind IN ('mint','burn')) AS has_mint_burn
              FROM ledger_entry GROUP BY 1)
          SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`);

/** §11 判据 8（ref 形状） */
export const judgement8ByRef = async (p: Pool): Promise<Array<Record<string, string>>> =>
  raw(p, `WITH ev AS (
            SELECT ref_type, ref_id, SUM(delta + frozen_delta) AS net_sum, count(*) AS entries,
                   bool_or(kind IN ('mint','burn')) AS has_mint_burn
              FROM ledger_entry WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL
             GROUP BY ref_type, ref_id)
          SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`);

/** 新建测试币（symbol 前缀 p1f） */
export const ensureCurrency = async (
  p: Pool, symbol: string, owner: bigint, decimals: number, status: string, cap: string | null,
): Promise<string> => {
  const rows = await raw<{ cid: string }>(p, `
    INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
    VALUES ($1, $2, $3, $4, 0, $5, $6, CASE WHEN $6 = 'draft' THEN NULL ELSE now() END)
    RETURNING cid`, [symbol, `P1f ${symbol}`, String(owner), decimals, cap, status]);
  return rows[0].cid;
};

export const lockRow = (p: Pool, uid: bigint, cid: string) =>
  p.query('SELECT balance FROM account WHERE uid = $1 AND cid = $2 FOR UPDATE', [String(uid), cid]);

/** 轮询直到「有 ledger_post_event 语句卡在 Lock 等待」 */
export const waitForLockWait = async (admin: Pool, budgetMs = 8000): Promise<Record<string, string> | null> => {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const rows = await raw(admin, `
      SELECT pid::text AS pid, wait_event_type, left(query, 60) AS q, state
        FROM pg_stat_activity
       WHERE query ILIKE '%ledger_post_event%' AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock' LIMIT 1`);
    if (rows.length) return rows[0];
    await sleep(120);
  }
  return null;
};

/** 当前会话的 GUC 读数 */
export const gucs = async (p: Pool) =>
  (await raw(p, `SELECT current_setting('statement_timeout') AS statement_timeout,
                        current_setting('lock_timeout') AS lock_timeout,
                        current_setting('deadlock_timeout') AS deadlock_timeout,
                        version() AS server_version`))[0];
