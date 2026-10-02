/**
 * p7b 自用探针库（Kong · §7-32「管理员退款发起」实现单）
 * ---------------------------------------------------------------------------
 * 与既有实现方/质检方脚本**隔离**（零 import 其它脚本的 lib）。只依赖
 * `@neondatabase/serverless` + `ws`。
 *
 * 纪律（派单硬口径）：
 *   · 判据一律**只读**；破坏性探针（干跑 0024）必须 `inRollbackTx` ⇒ ROLLBACK ⇒ 零残留。
 *   · 产物 run-tagged（`.p7b-artifacts/p7b-*-<RUN>.json`，**不用** `.log` 后缀、不用固定名）。
 *   · 绝不 `pkill -f` / `killall`；自起实例只许 5793–5799。
 *   · 测试夹具 uid ≥ 900000；跑完登记残留。
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

export const DIRECT_URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  '';

export const RUN =
  process.env.P7B_RUN ||
  new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);

export const OUT_DIR = path.resolve(__dirname, '..', '.p7b-artifacts');
export const REPO_BACKEND = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(REPO_BACKEND, '..');

export const mkPool = (max: number, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export interface Qx {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export const raw = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await ex.query(sql, params)).rows as R[];

export const raw1 = async <R = Record<string, unknown>>(ex: Qx, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(ex, sql, params))[0] ?? null;

export const sha256 = (v: unknown): string =>
  crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');

/** 落 run-tagged 读数（**永不**用固定文件名） */
export const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

export interface PgErr {
  sqlstate: string | null;
  message: string;
  detail: string | null;
  reason: string | null;
  pg_code: string | null;
  raw_detail: unknown;
}

/** PG / ledger 错误 → 可机读摘要（含 `ledger_raise` 的 DETAIL JSON 里的 reason） */
export const pgErr = (e: unknown): PgErr => {
  const a = e as Record<string, unknown>;
  let reason: string | null = null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(a?.detail ?? ''));
    reason = ((parsed as Record<string, unknown>)?.reason as string) ?? null;
  } catch {
    /* noop */
  }
  return {
    sqlstate: (a?.code as string) ?? null,
    message: String(a?.message ?? e).slice(0, 240),
    detail: (a?.detail as string) ?? null,
    reason,
    pg_code: (a?.pg_code as string) ?? null,
    raw_detail: parsed,
  };
};

/** 在事务内用 SAVEPOINT 包住「预期会抛」的语句 ⇒ 事务不被打断（25P02 防线） */
export const sp = async <T>(
  ex: Qx,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; value: T | null; error: unknown | null }> => {
  await ex.query('SAVEPOINT p7b_sp');
  try {
    const value = await fn();
    await ex.query('RELEASE SAVEPOINT p7b_sp');
    return { ok: true, value, error: null };
  } catch (e) {
    try {
      await ex.query('ROLLBACK TO SAVEPOINT p7b_sp');
    } catch {
      /* noop */
    }
    return { ok: false, value: null, error: e };
  }
};

/** 在一事务内执行；末尾一律 ROLLBACK（破坏性探针必须零残留） */
export const inRollbackTx = async <T>(
  p: Pool,
  fn: (c: Qx) => Promise<T>,
): Promise<{ result: T | null; error: unknown | null; rolled_back: boolean; ms: number }> => {
  const t0 = Date.now();
  const c = await p.connect();
  let result: T | null = null;
  let error: unknown | null = null;
  try {
    await c.query('BEGIN');
    result = await fn(c as unknown as Qx);
  } catch (e) {
    error = e;
  } finally {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* noop */
    }
    c.release();
  }
  return { result, error, rolled_back: true, ms: Date.now() - t0 };
};

/** 极简断言收集器（离线/干跑探针共用）：每条都带判负计数 */
export interface Check {
  id: string;
  what: string;
  pass: boolean;
  reading: string;
}
export const checker = () => {
  const checks: Check[] = [];
  const t = (id: string, what: string, pass: boolean, reading: string) => {
    checks.push({ id, what, pass, reading });
    return pass;
  };
  const summary = () => ({
    total: checks.length,
    passed: checks.filter((c) => c.pass).length,
    failed: checks.filter((c) => !c.pass).length,
    red: checks.filter((c) => !c.pass).map((c) => c.id),
  });
  return { checks, t, summary };
};
