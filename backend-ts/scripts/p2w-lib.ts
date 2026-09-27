/**
 * p2w 自用探针库（Kong · P2 质检不通过修复单）—— 与实现方脚本（p1xx/p2d）及质检方脚本（p2qa）**完全隔离**。
 * 测试数据分区：uid **956xxx** / symbol 前缀 **p1w** / 幂等键前缀 **ops:p1w:**（绝不触碰 cid = 1
 * 与平台账户 0/-1/-2/-3 的既有余额）。
 * 自包含（只依赖 @neondatabase/serverless + ws），不 import 任何其它脚本的 lib。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

export const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
export const RUN = process.env.P2W_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
export const OUT_DIR = path.resolve(__dirname, '..', '.p2w-artifacts');
export const REPO_BACKEND = path.resolve(__dirname, '..');

export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export interface Qx { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; }

export const raw = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await ex.query(sql, params)).rows as R[];
export const raw1 = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(ex, sql, params))[0] ?? null;

export const sha256 = (v: unknown): string =>
  crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
export const md5 = (v: string): string => crypto.createHash('md5').update(v).digest('hex');

/** 落 run-tagged 读数（**永不**用固定文件名；固定名会被复跑静默覆盖） */
export const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
export const saveText = (name: string, text: string): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.txt`);
  fs.writeFileSync(file, text);
  return file;
};

export interface PgErr { sqlstate: string | null; message: string; detail: string | null; reason: string | null; constraint: string | null; raw_detail: unknown; }

/** PG / ledger 错误 → 可机读摘要（含 `ledger_raise` 的 details JSON 里的 reason） */
export const pgErr = (e: unknown): PgErr => {
  const a = e as Record<string, unknown>;
  let reason: string | null = null;
  let parsed: unknown = null;
  try { parsed = JSON.parse(String(a?.detail ?? '')); reason = (parsed as Record<string, unknown>)?.reason as string ?? null; } catch { /* noop */ }
  return { sqlstate: (a?.code as string) ?? null, message: String(a?.message ?? e).slice(0, 240),
    detail: (a?.detail as string) ?? null, reason, constraint: (a?.constraint as string) ?? null, raw_detail: parsed };
};

export const trySql = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []):
Promise<{ ok: boolean; rows: R[]; error: PgErr | null; ms: number }> => {
  const t0 = Date.now();
  try {
    const r = await ex.query(sql, params);
    return { ok: true, rows: r.rows as R[], error: null, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, rows: [], error: pgErr(e), ms: Date.now() - t0 };
  }
};

/** 在一事务内执行；末尾一律 ROLLBACK（破坏性探针必须零残留） */
export const inRollbackTx = async <T>(p: Pool, fn: (c: Qx) => Promise<T>):
Promise<{ result: T | null; error: unknown | null; rolled_back: boolean; ms: number }> => {
  const t0 = Date.now();
  const c = await p.connect();
  let result: T | null = null; let error: unknown | null = null;
  try {
    await c.query('BEGIN');
    result = await fn(c as unknown as Qx);
  } catch (e) { error = e; }
  finally {
    try { await c.query('ROLLBACK'); } catch { /* noop */ }
    c.release();
  }
  return { result, error, rolled_back: true, ms: Date.now() - t0 };
};

export const ensureUsers = async (ex: Qx, uids: Array<number | string>): Promise<void> => {
  await ex.query(`INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                    FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [uids.map(String)]);
};

export const ensureCurrency = async (ex: Qx, symbol: string, ownerUid: string, decimals: number): Promise<string> => {
  const found = await raw1<{ cid: string }>(ex, `SELECT cid::text AS cid FROM currency WHERE symbol = $1 LIMIT 1`, [symbol]);
  if (found) return String(found.cid);
  const r = await raw1<{ cid: string }>(ex, `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
    VALUES ($1, $2, $3, $4, 0, 'listed', now()) RETURNING cid::text AS cid`, [symbol, `P2W ${symbol}`, ownerUid, decimals]);
  return String((r as { cid: string }).cid);
};

export const FN_SQL = 'SELECT ledger_post_event($1::jsonb) AS r';

export const callFn = async (ex: Qx, payload: unknown): Promise<Record<string, unknown>> => {
  const r = await ex.query(FN_SQL, [JSON.stringify(payload)]);
  const v = (r.rows[0] as { r: unknown })?.r;
  return (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
};

export const tryFn = async (ex: Qx, payload: unknown):
Promise<{ ok: boolean; replay: boolean; rows: number; error: PgErr | null; raw: Record<string, unknown> | null; ms: number }> => {
  const t0 = Date.now();
  try {
    const r = await callFn(ex, payload);
    return { ok: r?.ok === true, replay: r?.idempotent_replay === true,
      rows: ((r?.entries as unknown[]) ?? []).length, error: null, raw: r, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, replay: false, rows: 0, error: pgErr(e), raw: null, ms: Date.now() - t0 };
  }
};

export const mintTo = (ex: Qx, uid: string, cid: string, units: string, key: string) =>
  tryFn(ex, { op: 'mint', uid, cid, amount_units: units, kind: 'mint', idempotency_key: key });
export const holdFor = (ex: Qx, uid: string, cid: string, units: string, jobId: string, key: string) =>
  tryFn(ex, { op: 'hold', uid, cid, amount_units: units, kind: 'hold', ref_type: 'job', ref_id: jobId, idempotency_key: key });

/** 全局图不变式（cycles / bad_depth / 行数）—— 与 src/commission.ts 的 readGraphInvariants 同口径 */
export const graphInvariants = async (ex: Qx): Promise<{ cycles: string; bad_depth: string; referral_rows: string }> => {
  const cycles = await raw1<{ n: string }>(ex, `WITH RECURSIVE up AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
    SELECT count(*)::text AS n FROM up WHERE cur = start`);
  const bad = await raw1<{ n: string }>(ex, `WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT count(*)::text AS n FROM referral x
      JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid WHERE x.depth <> t.mx`);
  const rows = await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM referral`);
  return { cycles: String(cycles?.n ?? ''), bad_depth: String(bad?.n ?? ''), referral_rows: String(rows?.n ?? '') };
};

/** public 下全部非 internal 触发器的启用态（判据：必须全部 'O'） */
export const triggerEnablement = async (ex: Qx):
Promise<{ total: number; enabled: number; anomalies: Array<{ table: string; trigger: string; tgenabled: string }> }> => {
  const rows = await raw<{ tbl: string; tgname: string; tgenabled: string }>(ex, `
    SELECT c.relname AS tbl, t.tgname, t.tgenabled FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname = 'public' ORDER BY 1,2`);
  const anomalies = rows.filter((r) => r.tgenabled !== 'O').map((r) => ({ table: r.tbl, trigger: r.tgname, tgenabled: r.tgenabled }));
  return { total: rows.length, enabled: rows.length - anomalies.length, anomalies };
};

export { Pool };
