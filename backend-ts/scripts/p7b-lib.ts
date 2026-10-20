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

import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
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

export const mkPool = (max: number, url = DIRECT_URL): Pool => {
  const p = new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });
  // ★ 空闲套接字被掐（dev Neon 间歇 ECONNRESET）时驱动会在 pool/client 上 `emit('error')`；
  //   无监听者 ⇒ Node 直接抛未处理 'error' 事件把整个探针打死（读数一条都取不到）。
  //   这里只降级为告警：真失败仍会在 `query`/`connect` 上以错误返回，判据不受影响。
  p.on('error', (e: unknown) => {
    console.warn(`[p7b-lib] pool 空闲连接错误（已忽略，不影响判据）：${String((e as { message?: string })?.message ?? e).slice(0, 140)}`);
  });
  return p;
};

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

/* ============================================================================
 * 网络类错误判定 + 重连重试（**只对网络**，业务/SQL 错误绝不重试）
 * ----------------------------------------------------------------------------
 * 为什么必须区分：dev Neon 端点间歇 `ECONNRESET`（WS 隧道被掐）⇒ 只读探针会假红；
 *   但对 **负控臂**（预期 P0001 / 23514 / 23505 / 403 等）若也重试，错误会被「重试成功」
 *   吞成假绿 —— 那是把判据偷换掉。故判据两条同时看：
 *     ① `e.code` 是 PG SQLSTATE（5 位 `[0-9A-Z]{5}`，如 23514 / 42P01 / P0001 / XX000）
 *        ⇒ **业务/SQL 错误** ⇒ 永不重试（即便 message 里带 connect 字样也算 SQL 侧）；
 *     ② 否则按网络码表 / 网络报文正则判（ECONNRESET · fetch failed · ETIMEDOUT ·
 *        connect 一类 · socket hang up · Connection terminated · WebSocket closed · UND_ERR_*）。
 *   每次重试都**重新 `p.connect()`**（旧连接已死，`release(true)` 销毁而非回池）。
 * ========================================================================== */
const NET_CODES = new Set<string>([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CLOSED',
]);
const NET_MSG_PATTERNS: RegExp[] = [
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ECONNABORTED/i,
  /ETIMEDOUT/i,
  /EPIPE/i,
  /ENETUNREACH|EHOSTUNREACH|EAI_AGAIN/i,
  /fetch failed/i,
  /socket hang up/i,
  /socket (?:disconnected|closed)/i,
  /Connection terminated/i,
  /connection (?:closed|reset|terminated)/i,
  // Neon WS 隧道被掐的两种原话（`ErrorEvent` 与 `fetch failed` 内层）：
  // 「Client network socket disconnected before secure TLS connection was established」
  /disconnected before secure TLS/i,
  /secure TLS connection/i,
  /WebSocket (?:was )?closed/i,
  /websocket.*(?:ECONNRESET|error)/i,
  /UND_ERR_[A-Z_]+/i,
  /TLS connection|handshake timeout/i,
];
/** PG SQLSTATE 形态（`23514` / `42P01` / `P0001` / `XX000` / `57014`） */
const SQLSTATE_RE = /^[0-9A-Z]{5}$/;

/** 沿 `cause` 链找**网络类**错误；只认网络，SQL/业务错误恒 false（负控臂靠这条不被吞） */
export const isNetworkError = (e: unknown): boolean => {
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 6; depth += 1) {
    const a = cur as Record<string, unknown>;
    const code = a?.code === undefined || a?.code === null ? '' : String(a.code);
    const msg = String(a?.message ?? cur);
    // ① SQLSTATE ⇒ 业务/SQL 错误 ⇒ 不重试（pg 的 code 就是 SQLSTATE）
    if (SQLSTATE_RE.test(code) && !NET_CODES.has(code)) return false;
    // ② 网络码 / 网络报文
    if (NET_CODES.has(code)) return true;
    if (NET_MSG_PATTERNS.some((re) => re.test(msg))) return true;
    // ③ 符号属性：Neon 驱动把真错误塞进 `ErrorEvent[Symbol(kError)]`（字符串键读不到）
    for (const sym of Object.getOwnPropertySymbols(cur as object)) {
      const inner = (cur as Record<symbol, unknown>)[sym];
      if (inner && typeof inner === 'object') {
        const ic = (inner as Record<string, unknown>).code;
        const im = String((inner as Record<string, unknown>).message ?? '');
        if (ic !== undefined && ic !== null && NET_CODES.has(String(ic))) return true;
        if (NET_MSG_PATTERNS.some((re) => re.test(im))) return true;
      }
    }
    cur = a?.cause;
  }
  return false;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 网络重试上限（含首跑 ⇒ 最多 3 次尝试）· 指数退避 400 / 800 ms */
export const NET_RETRY_ATTEMPTS = 3;

/**
 * 在一事务内执行；末尾一律 ROLLBACK（破坏性探针必须零残留）。
 * 网络类错误 ⇒ 退避后**重连**重跑（事务已整体回滚，重跑零残留、无副作用）；
 * 业务/SQL 错误 ⇒ 原样返回给调用方（负控臂要读它的 sqlstate/reason）。
 */
export const inRollbackTx = async <T>(
  p: Pool,
  fn: (c: Qx) => Promise<T>,
  attempts: number = NET_RETRY_ATTEMPTS,
): Promise<{
  result: T | null;
  error: unknown | null;
  rolled_back: boolean;
  ms: number;
  attempts: number;
  network_retries: number;
}> => {
  const t0 = Date.now();
  const maxTries = Math.max(1, attempts);
  let error: unknown | null = null;
  let result: T | null = null;
  let tried = 0;
  let retries = 0;

  for (let i = 1; i <= maxTries; i += 1) {
    tried = i;
    error = null;
    result = null;
    let c: PoolClient | null = null;
    try {
      c = await p.connect();   // ★ 每次重试都是**新**物理连接
      await c.query('BEGIN');
      result = await fn(c as unknown as Qx);
    } catch (e) {
      error = e;
    } finally {
      if (c) {
        if (error && isNetworkError(error)) {
          // 连接已死：销毁而非回池（回池会把坏套接字喂给下一个探针 ⇒ 连环假红）
          try {
            c.release(true as never);
          } catch {
            /* noop */
          }
        } else {
          try {
            await c.query('ROLLBACK');
          } catch {
            /* noop */
          }
          try {
            c.release();
          } catch {
            /* noop */
          }
        }
      }
    }
    if (!error) break;
    if (!isNetworkError(error) || i >= maxTries) break;   // ★ 业务/SQL 错误 ⇒ 绝不重试
    retries += 1;
    const wait = 400 * 2 ** (i - 1);
    console.warn(
      `[p7b-lib] inRollbackTx 网络错误（第 ${i}/${maxTries} 次）⇒ ${wait}ms 后重连重试：` +
        String((error as { message?: string })?.message ?? error).slice(0, 140),
    );
    await sleep(wait);
  }

  return { result, error, rolled_back: true, ms: Date.now() - t0, attempts: tried, network_retries: retries };
};

/**
 * 池级只读语句（**事务外**，如「库身份自证 `neon.project_id`」「迁移态列探测」）：
 * 这类语句落在 `inRollbackTx` 之外 ⇒ 单独给同一套网络重试（业务/SQL 错误原样抛）。
 */
export const qRetry = async <R = Record<string, unknown>>(
  p: Pool,
  sql: string,
  params: unknown[] = [],
  attempts: number = NET_RETRY_ATTEMPTS,
): Promise<R[]> => {
  const maxTries = Math.max(1, attempts);
  let last: unknown = null;
  for (let i = 1; i <= maxTries; i += 1) {
    try {
      return (await p.query(sql, params)).rows as R[];
    } catch (e) {
      last = e;
      if (!isNetworkError(e) || i >= maxTries) break;   // ★ 业务/SQL 错误 ⇒ 不重试
      const wait = 400 * 2 ** (i - 1);
      console.warn(
        `[p7b-lib] qRetry 网络错误（第 ${i}/${maxTries} 次）⇒ ${wait}ms 后重连重试：` +
          String((e as { message?: string })?.message ?? e).slice(0, 140),
      );
      await sleep(wait);
    }
  }
  throw last;
};

/** 事务外 `raw` / `raw1` 的重试版（同一套判据：只重试网络类错误） */
export const rawRetry = async <R = Record<string, unknown>>(
  p: Pool, sql: string, params: unknown[] = [],
): Promise<R[]> => qRetry<R>(p, sql, params);

export const raw1Retry = async <R = Record<string, unknown>>(
  p: Pool, sql: string, params: unknown[] = [],
): Promise<R | null> => (await qRetry<R>(p, sql, params))[0] ?? null;

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
