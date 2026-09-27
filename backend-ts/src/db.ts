/**
 * P0 数据库访问层（事务层）
 * ============================================================================
 * 权威口径：docs/ledger.spec.md
 *   R55 写操作唯一允许的驱动 = 支持交互式事务的连接池（本文件即该驱动）
 *   R56 事务走 DATABASE_URL_UNPOOLED（直连）；只读单语句可走 DATABASE_URL（pooler）
 *   R60 死锁/序列化失败最多重试 3 次，指数退避 50/200/800ms，重试必须复用同一幂等键
 *   R61 隔离级别 READ COMMITTED（Neon 默认）+ 显式行锁
 *   R82 事务内必须设 lock_timeout（默认 3s）与 statement_timeout（默认 10s）
 *
 * 实测依据（scripts/probe-tx.ts 真实读数，见交付报告）：
 *   - @neondatabase/serverless@0.6.1 的 Pool over WebSocket 提供交互式事务（读后写 + 回滚语义均实测通过）
 *   - pg_advisory_xact_lock 经 Neon pooler 与直连**均可用**（§16 #3 已打勾）
 *   - 直连端点 max_connections = 112，8 并发全部成功（§16 #3 已打勾）
 *   ⇒ 事务统一走 UNPOOLED 直连串（同 R56）
 */
import * as path from 'path';
import dotenv from 'dotenv';

// 与 database.ts 相同的加载顺序：.env.local 优先（dotenv 不覆盖已存在变量），再补 .env。
// 额外兜底：以模块位置解析 .env.local，避免由 cwd 不同导致读不到。
dotenv.config({ path: '.env.local' });
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

// Node 18/20 无全局 WebSocket ⇒ 必须注入 ws（Vercel Node runtime 同理）
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

/** 事务（写）连接串：直连优先（R56） */
export const resolveTransactionUrl = (): string => (
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.jinli_DATABASE_URL_UNPOOLED ||
  process.env.jinli_POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ''
);

/** 只读（单语句）连接串：pooler 优先 */
export const resolveReadUrl = (): string => (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.jinli_DATABASE_URL ||
  process.env.jinli_POSTGRES_URL ||
  resolveTransactionUrl()
);

// ---------------------------------------------------------------- 错误类型（§14 命名）
export class DbTxError extends Error {
  readonly code: string;
  readonly pgCode: string | null;

  constructor(code: string, message: string, pgCode: string | null = null) {
    super(message);
    this.name = 'DbTxError';
    this.code = code;
    this.pgCode = pgCode;
  }
}

// ---------------------------------------------------------------- 类型
export interface TxResult<R = Record<string, unknown>> {
  rows: R[];
  rowCount: number | null;
  command?: string;
}

export interface TxClient {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<TxResult<R>>;
}

export interface TxOptions {
  /** 死锁/序列化失败重试次数（R60） */
  retries?: number;
  /** 事务级锁等待上限，毫秒（R82） */
  lockTimeoutMs?: number;
  /** 事务级语句超时，毫秒（R82） */
  statementTimeoutMs?: number;
}

export const DEFAULT_TX_OPTIONS: Required<TxOptions> = {
  retries: 3,
  lockTimeoutMs: 3000,
  statementTimeoutMs: 10000,
};

/** 事务上下文标记：写路径可据此断言「自己在事务里」（R55 的运行时断言） */
const IN_TX = Symbol.for('seafood.inTransaction');
type BrandedClient = TxClient & { release?: (err?: Error | boolean) => void; [IN_TX]?: true };

let txPool: Pool | null = null;

export const getTransactionPool = (): Pool => {
  if (txPool) return txPool;
  const url = resolveTransactionUrl();
  if (!url) throw new DbTxError('DATABASE_URL_MISSING', '缺少 DATABASE_URL_UNPOOLED / DATABASE_URL');
  txPool = new Pool({
    connectionString: url,
    max: Number(process.env.SEAFOOD_TX_POOL_MAX || 4),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return txPool;
};

/** 关闭连接池（脚本收尾 / 优雅退出用；服务常驻时不需要调用） */
export const closePools = async (): Promise<void> => {
  if (txPool) {
    await txPool.end().catch(() => undefined);
    txPool = null;
  }
};

export const isRetryableTxError = (e: unknown): boolean => {
  const code = String((e as { code?: unknown })?.code ?? '');
  return code === '40001' || code === '40P01'; // serialization_failure / deadlock_detected
};

const mapTxError = (e: unknown): unknown => {
  const code = String((e as { code?: unknown })?.code ?? '');
  if (code === '55P03' || code === '57014') {
    const isLock = code === '55P03'
      || /lock timeout/i.test(String((e as { message?: unknown })?.message ?? ''));
    return new DbTxError(
      isLock ? 'LEDGER_LOCK_TIMEOUT' : 'LEDGER_TX_TIMEOUT',
      isLock ? '获取锁超时（lock_timeout）' : '事务超时（statement_timeout）',
      code,
    );
  }
  if (code === '40001' || code === '40P01') {
    return new DbTxError('LEDGER_DEADLOCK_RETRY_EXHAUSTED', '死锁/序列化失败重试已耗尽', code);
  }
  return e;
};

/**
 * 唯一允许的写事务入口（R55 / R57：一个业务事件一个事务）。
 *
 * 语义：
 *   - 回调抛错 ⇒ ROLLBACK 并向上抛（绝无「半成品」提交）
 *   - 正常返回 ⇒ COMMIT，返回回调结果
 *   - 仅对 40001 / 40P01 重试（R60），业务错误不重试
 *   - 事务内先 `SET LOCAL lock_timeout / statement_timeout`（R82）
 *   - 连接在 finally 中必定归还（异常路径也不泄漏）
 */
export async function withTransaction<T>(
  fn: (tx: TxClient) => Promise<T>,
  options: TxOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_TX_OPTIONS, ...options };
  const pool = getTransactionPool();
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= opts.retries) {
    attempt += 1;
    const client = (await pool.connect()) as unknown as BrandedClient;
    (client as BrandedClient)[IN_TX] = true;
    try {
      await client.query('BEGIN'); // READ COMMITTED（R61，Neon 默认隔离级别）
      await client.query(`SET LOCAL lock_timeout = ${opts.lockTimeoutMs}`);
      await client.query(`SET LOCAL statement_timeout = ${opts.statementTimeoutMs}`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (isRetryableTxError(e) && attempt <= opts.retries) {
        lastError = e;
        const backoff = [50, 200, 800][Math.min(attempt - 1, 2)];
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw mapTxError(e);
    } finally {
      delete (client as BrandedClient)[IN_TX];
      (client as BrandedClient).release?.();
    }
  }

  throw mapTxError(lastError);
}

/** 断言当前处于事务上下文；不在则抛 LEDGER_TRANSACTION_REQUIRED（R55 的运行时兜底） */
export const assertInTransaction = (tx: unknown): void => {
  if (!tx || (tx as Record<symbol, unknown>)[IN_TX] !== true) {
    throw new DbTxError('LEDGER_TRANSACTION_REQUIRED', '写操作必须在 withTransaction() 内执行');
  }
};

/** 事务内只读查询（供服务层在锁前读取当前状态） */
export const txQuery = async <R = Record<string, unknown>>(
  tx: TxClient,
  text: string,
  params?: unknown[],
): Promise<R[]> => (await tx.query<R>(text, params)).rows;

// ---------------------------------------------------------------- 只读查询（单语句，不占显式事务）
// 现有 database.ts 的 neon() HTTP 单语句驱动对「只读单语句」仍可用（R55 只禁写）。
export const readQuery = async <R = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<R[]> => {
  const pool = getTransactionPool() as unknown as {
    query: (t: string, p?: unknown[]) => Promise<TxResult<R>>;
  };
  const result = await pool.query(text, params);
  return result.rows;
};

// ---------------------------------------------------------------- /health 用探针
export interface HealthReport {
  ok: boolean;
  db_version: string;
  schema_version: string | null;
  time: string;
}

export const getDbVersion = async (): Promise<string> => {
  const rows = await readQuery<{ v: string }>('SELECT version() AS v');
  return rows[0]?.v ?? 'unknown';
};

export const getSchemaVersion = async (): Promise<string | null> => {
  const rows = await readQuery<{ version: string }>(
    'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1',
  );
  return rows[0]?.version ?? null;
};

export const healthCheck = async (): Promise<HealthReport> => {
  const [dbVersion, schemaVersion] = await Promise.all([getDbVersion(), getSchemaVersion()]);
  return {
    ok: Boolean(dbVersion) && Boolean(schemaVersion),
    db_version: dbVersion,
    schema_version: schemaVersion,
    time: new Date().toISOString(),
  };
};
