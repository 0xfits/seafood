/**
 * P2 QA（Neng · 独立质检）自用探针库 —— 与实现方脚本（p1t、p2d 系）完全隔离。
 * 测试数据分区：uid 954xxx / symbol 前缀 `p1u` / 幂等键前缀 `ops:p1u:`。
 * 只写本库；不改 src、migrations、docs/spec、p1/p2d 脚本。
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

export const RUN = process.env.P2QA_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));

export const OUT_DIR = path.resolve(__dirname, '..', '.p2qa-artifacts');

export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export const raw = async <R = Record<string, string>>(p: Pool, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await p.query(sql, params as never[])).rows as R[];

export const raw1 = async <R = Record<string, string>>(p: Pool, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(p, sql, params))[0] ?? null;

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

/** 可机读错误摘要（含 ledger_raise 的 details JSON 里的 reason） */
export const errInfo = (e: unknown): Record<string, unknown> => {
  const i = pgInfo(e);
  let reason: string | null = null;
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(i.detail ?? '') as Record<string, unknown>; reason = (parsed?.reason as string) ?? null; } catch { /* noop */ }
  return {
    sqlstate: i.code, message: i.message.slice(0, 200), constraint: i.constraint,
    detail: (i.detail ?? '').slice(0, 300), reason, detail_parsed: parsed,
  };
};

export const jstr = (v: unknown): string => JSON.stringify(v);
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const crypto = require('crypto') as typeof import('crypto');
const fsMod = require('fs') as typeof import('fs');
const cpMod = require('child_process') as typeof import('child_process');

export const sha256 = (v: unknown): string =>
  crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');

/** 落 run-tagged 读数（永不用固定文件名） */
export const save = (name: string, obj: unknown): string => {
  fsMod.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  const body = JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...obj as object }, null, 2);
  fsMod.writeFileSync(file, body);
  return file;
};

/** 在一事务内执行，最后总是回滚（用于必须复原的破坏性探针） */
export type Conn = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };

export const inRollbackTx = async <T>(
  p: Pool, fn: (c: Conn) => Promise<T>,
): Promise<{ result: T | null; error: unknown | null; rolled_back: boolean }> => {
  const c = await p.connect();
  let result: T | null = null; let error: unknown | null = null;
  try {
    await c.query('BEGIN');
    result = await fn(c as unknown as Conn);
  } catch (e) { error = e; }
  finally {
    try { await c.query('ROLLBACK'); } catch { /* noop */ }
    c.release();
  }
  return { result, error, rolled_back: true };
};

export const git = (cwd: string, args: string[]): string =>
  cpMod.execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export const REPO = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// 只读/写入 执行器抽象：Pool 与事务 client 都满足
// ---------------------------------------------------------------------------
export interface Qx { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; }

export const callFn = async (ex: Qx, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await ex.query(FN_SQL, [JSON.stringify(payload)]);
  const v = (r.rows[0] as { r: unknown })?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
};

export interface Outcome {
  ok: boolean; replay?: boolean; txid?: string | null;
  entries?: Array<Record<string, unknown>>;
  error?: Record<string, unknown>;
  elapsed_ms: number;
}

export const tryFn = async (ex: Qx, payload: unknown): Promise<Outcome> => {
  const t0 = Date.now();
  try {
    const r = await callFn(ex, payload);
    return { ok: r?.ok === true, replay: r?.idempotent_replay === true,
      txid: (r?.txid ?? null) as string | null,
      entries: (r?.entries as Array<Record<string, unknown>>) ?? [], elapsed_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: errInfo(e), elapsed_ms: Date.now() - t0 };
  }
};

export const trySql = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []):
Promise<{ ok: boolean; rows: R[]; error?: Record<string, unknown>; elapsed_ms: number }> => {
  const t0 = Date.now();
  try {
    const r = await ex.query(sql, params);
    return { ok: true, rows: r.rows as R[], elapsed_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, rows: [], error: errInfo(e), elapsed_ms: Date.now() - t0 };
  }
};

/** 建 users 行（幂等） */
export const ensureUsers = async (ex: Qx, uids: Array<number | bigint | string>): Promise<void> => {
  await ex.query(`INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                    FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [uids.map(String)]);
};

/** 建测试币（symbol 前缀 p1u；绝不触碰 cid = 1） */
export const ensureCurrency = async (
  ex: Qx, symbol: string, ownerUid: string, decimals: number,
): Promise<string> => {
  const found = await ex.query(`SELECT cid::text AS cid FROM currency WHERE symbol = $1 LIMIT 1`, [symbol]);
  if (found.rows.length) return String((found.rows[0] as { cid: string }).cid);
  const r = await ex.query(`INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
                            VALUES ($1, $2, $3, $4, 0, NULL, 'listed', now()) RETURNING cid::text AS cid`,
  [symbol, `P2QA ${symbol}`, ownerUid, decimals]);
  return String((r.rows[0] as { cid: string }).cid);
};

export const mintTo = (ex: Qx, uid: string, cid: string, units: string, key: string): Promise<Outcome> =>
  tryFn(ex, { op: 'mint', uid, cid, amount_units: units, kind: 'mint', idempotency_key: key });

export const holdFor = (ex: Qx, uid: string, cid: string, units: string, jobId: string, key: string): Promise<Outcome> =>
  tryFn(ex, { op: 'hold', uid, cid, amount_units: units, kind: 'hold',
    ref_type: 'job', ref_id: jobId, idempotency_key: key });

export { Pool };
