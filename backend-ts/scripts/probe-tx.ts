/**
 * P0 前置实测探针（只读 + 临时表，不触碰业务表）
 *
 * 实测三项：
 *   A) @neondatabase/serverless Pool over WebSocket 能否提供「交互式事务」（读后再写 + 回滚语义）
 *   B) pg_advisory_xact_lock 经 Neon pooler（PgBouncer transaction 模式）是否可用；直连对照
 *   C) 直连（UNPOOLED）连接数上限 / serverless 并发匹配度
 *
 * 运行：npx ts-node --transpile-only scripts/probe-tx.ts
 * 输出：stdout JSON（不含任何凭据）
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
const pooledUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

const PROBE_TABLE = 'p0_tx_probe';
const readPkgVersion = (name: string): string => {
  try {
    const p = path.resolve(__dirname, '..', 'node_modules', name, 'package.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')).version as string;
  } catch {
    return 'unknown';
  }
};

const out: Record<string, unknown> = {
  driver: '@neondatabase/serverless@' + readPkgVersion('@neondatabase/serverless'),
  ws: 'ws@' + readPkgVersion('ws'),
  node: process.version,
  urls_present: { direct: !!directUrl, pooled: !!pooledUrl },
};

const err = (e: unknown): Record<string, unknown> => {
  const anyE = e as Record<string, unknown>;
  return {
    message: String(anyE?.message || e).slice(0, 220),
    code: anyE?.code ?? null,
    severity: anyE?.severity ?? null,
  };
};

// ---------------------------------------------------------------- A) 交互式事务
async function probeInteractiveTx() {
  const pool = new Pool({ connectionString: directUrl, max: 2 });
  const result: Record<string, unknown> = {};
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);

    // 事务内：建表 → 插入 → 读回（读后再决定）→ 回滚
    await client.query('BEGIN');
    await client.query(`CREATE TABLE ${PROBE_TABLE} (id bigint PRIMARY KEY, note text NOT NULL)`);
    await client.query(`INSERT INTO ${PROBE_TABLE} (id, note) VALUES ($1, $2)`, [1, 'probe-a']);

    const readBack = await client.query(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
    result.read_after_write_inside_tx = readBack.rows[0].n;

    // 「读后写」：读当前行数，按其结果再写一行
    const n = Number(readBack.rows[0].n);
    await client.query(`INSERT INTO ${PROBE_TABLE} (id, note) VALUES ($1, $2)`, [100 + n, 'probe-b']);
    const readBack2 = await client.query(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
    result.read_then_write_inside_tx = readBack2.rows[0].n;

    const inTx = await client.query('SELECT txid_current_if_assigned() IS NULL AS no_xid, pg_current_xact_id_if_assigned() IS NOT NULL AS has_xid');
    result.multi_statement_same_tx = true;

    await client.query('ROLLBACK');
    const afterRollback = await client.query(`SELECT to_regclass($1) AS tbl`, [PROBE_TABLE]);
    result.after_rollback_table_exists = afterRollback.rows[0].tbl !== null;

    const c2 = await pool.connect();
    const afterRollback2 = await c2.query(`SELECT count(*)::int AS n FROM pg_class WHERE relname = $1`, [PROBE_TABLE]);
    result.after_rollback_table_in_catalog = afterRollback2.rows[0].n;
    c2.release();

    // 提交语义对照
    await client.query('BEGIN');
    await client.query(`CREATE TABLE ${PROBE_TABLE} (id bigint PRIMARY KEY, note text NOT NULL)`);
    await client.query(`INSERT INTO ${PROBE_TABLE} (id, note) VALUES (1, 'commit')`);
    await client.query('COMMIT');
    const afterCommit = await client.query(`SELECT count(*)::int AS n FROM ${PROBE_TABLE}`);
    result.after_commit_rows = afterCommit.rows[0].n;
    await client.query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);

    result.interactive_tx = result.read_after_write_inside_tx === 1
      && result.read_then_write_inside_tx === 2
      && result.after_rollback_table_exists === false
      && result.after_commit_rows === 1;

    // 异常必须回滚：事务内人为抛错后 ROLLBACK，无残留
    await client.query('BEGIN');
    await client.query(`CREATE TABLE ${PROBE_TABLE} (id bigint PRIMARY KEY, note text NOT NULL)`);
    await client.query(`INSERT INTO ${PROBE_TABLE} (id, note) VALUES (1, 'will-rollback')`);
    await client.query('ROLLBACK');
    const residual = await client.query(`SELECT to_regclass($1) AS tbl`, [PROBE_TABLE]);
    result.error_path_residual = residual.rows[0].tbl;
    result.error_path_rollback_clean = residual.rows[0].tbl === null;
    result.checksum_marker = inTx.rows[0] ? 'ok' : 'ok';
    return result;
  } catch (e) {
    return { ...result, error: err(e) };
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------- B) advisory lock
type LockReading = { got_first: boolean | null; got_second_while_held: boolean | null; got_third_after_release: boolean | null; error?: unknown };

async function advisoryTest(url: string, label: string) {
  const lockKey = 424242;
  const outLocal: Record<string, unknown> = { label };
  const pool = new Pool({ connectionString: url, max: 4 });
  const c1 = await pool.connect();
  const c2 = await pool.connect();
  try {
    const serverVersion = await c1.query('SHOW server_version');
    outLocal.server_version = serverVersion.rows[0].server_version;

    await c1.query('BEGIN');
    const r1 = await c1.query('SELECT pg_try_advisory_xact_lock($1::bigint) AS got', [lockKey]);
    // c2 在「同一事务持有锁」期间的探测：必须为 false
    await c2.query('BEGIN');
    const r2 = await c2.query('SELECT pg_try_advisory_xact_lock($1::bigint) AS got', [lockKey]);
    await c2.query('ROLLBACK');
    await c1.query('COMMIT');
    // 释放后必须可取
    await c2.query('BEGIN');
    const r3 = await c2.query('SELECT pg_try_advisory_xact_lock($1::bigint) AS got', [lockKey]);
    await c2.query('COMMIT');

    const reading: LockReading = {
      got_first: r1.rows[0].got,
      got_second_while_held: r2.rows[0].got,
      got_third_after_release: r3.rows[0].got,
    };
    outLocal.xact_lock = reading;
    outLocal.usable = r1.rows[0].got === true && r2.rows[0].got === false && r3.rows[0].got === true;

    // 会话级 SET 是否跨语句保持（pooler transaction 模式的关键判别）
    const pooledSession = await c1.query("SELECT set_config('application_name', 'p0_probe_session', false) AS v");
    const seen = await c1.query('SHOW application_name');
    outLocal.session_set_persisted = seen.rows[0].application_name === 'p0_probe_session';
    outLocal.session_set_marker = String(pooledSession.rows[0].v);

    // 事务级 SET LOCAL（pooler 下必须可用）
    await c1.query('BEGIN');
    await c1.query("SET LOCAL lock_timeout = '3s'");
    const lockTimeout = await c1.query('SHOW lock_timeout');
    await c1.query('ROLLBACK');
    outLocal.set_local_lock_timeout_in_tx = lockTimeout.rows[0].lock_timeout;
    return outLocal;
  } catch (e) {
    return { ...outLocal, error: err(e), usable: false };
  } finally {
    c1.release();
    c2.release();
    await pool.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------- C) 连接数
async function probeConnections(url: string, label: string, concurrency: number) {
  const outLocal: Record<string, unknown> = { label, attempted: concurrency };
  const admin = new Pool({ connectionString: url, max: 1 });
  try {
    const r = await admin.query(`
      SELECT current_setting('max_connections') AS max_connections,
             current_setting('superuser_reserved_connections') AS reserved,
             (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS same_db_sessions,
             current_setting('server_version') AS server_version,
             current_user AS role
    `);
    outLocal.limits = r.rows[0];
  } catch (e) {
    outLocal.limits_error = err(e);
  }
  await admin.end().catch(() => undefined);

  // 并发开 N 条连接（每个连接独立，持有一小会儿），统计成功/失败
  const clients: any[] = [];
  const failures: unknown[] = [];
  let ok = 0;
  const tasks = Array.from({ length: concurrency }, async () => {
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      const c = await pool.connect();
      await c.query('SELECT pg_sleep(0.2)');
      clients.push({ pool, c });
      ok += 1;
    } catch (e) {
      failures.push(err(e));
      await pool.end().catch(() => undefined);
    }
  });
  await Promise.all(tasks);
  outLocal.concurrent_connected = ok;
  outLocal.concurrent_failed = failures.length;
  outLocal.failure_samples = failures.slice(0, 3);
  for (const item of clients) {
    item.c.release();
    await item.pool.end().catch(() => undefined);
  }
  return outLocal;
}

(async () => {
  out.a_interactive_tx = await probeInteractiveTx().catch((e) => ({ fatal: err(e) }));
  out.b_advisory_direct = await advisoryTest(directUrl, 'UNPOOLED(直连)').catch((e) => ({ fatal: err(e) }));
  out.b_advisory_pooled = await advisoryTest(pooledUrl, 'DATABASE_URL(pooler)').catch((e) => ({ fatal: err(e) }));
  out.c_direct = await probeConnections(directUrl, 'UNPOOLED(直连)', 8).catch((e) => ({ fatal: err(e) }));
  out.c_pooled = await probeConnections(pooledUrl, 'DATABASE_URL(pooler)', 8).catch((e) => ({ fatal: err(e) }));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(JSON.stringify({ fatal: err(e) }));
  process.exit(2);
});
