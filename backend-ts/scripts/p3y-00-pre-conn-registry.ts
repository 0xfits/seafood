/**
 * P3Y-00 · S0b 前置连接登记（只读）
 * ============================================================================
 * 单：P3-D20-REBUILD-APPLY（Kong）
 * 用途：重建前登记 pg_stat_activity 中的**非本会话**连接（application_name/state/
 *       state_change/backend_start）+ 判定是否存在非本会话 `idle in transaction`。
 * 只读：会话强制 READ ONLY；仅 SELECT。禁用 pg_terminate_backend/pg_cancel_backend。
 * 连接：单连接 `new Client({ connectionString: DATABASE_URL_UNPOOLED })`（禁 Pool/pooler）。
 * 产物：.p3y-artifacts/p3y-00-pre-conn-<RUN>.-plain/conn-registry.json（同名拒写）
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/p3y-00-pre-conn-registry.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const ROOT = path.resolve(__dirname, '..');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const RUN_DIR = path.join(ROOT, '.p3y-artifacts', `p3y-00-pre-conn-${RUN}.-plain`);

const redact = (s: string): string => String(s).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');

const main = async (): Promise<void> => {
  const cs = process.env.DATABASE_URL_UNPOOLED;
  if (!cs) { console.error('[p3y-00] FATAL: DATABASE_URL_UNPOOLED missing'); process.exit(2); }
  if (fs.existsSync(RUN_DIR)) { console.error(`[p3y-00] 同名拒写: ${RUN_DIR}`); process.exit(3); }
  fs.mkdirSync(RUN_DIR, { recursive: true });

  const c = new Client({ connectionString: cs });
  await c.connect();
  await c.query(`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  await c.query(`SET statement_timeout = '120s'`);

  const q = async <R = any>(sql: string, params: unknown[] = []): Promise<R[]> =>
    (await c.query(sql, params as any)).rows as R[];

  const self = await q(`SELECT pg_backend_pid()::text AS pid, current_database() AS db, current_user AS usr, version() AS pg_version`);
  const others = await q(
    `SELECT pid::text AS pid,
            usename,
            COALESCE(application_name,'') AS application_name,
            COALESCE(state,'') AS state,
            state_change::text AS state_change,
            backend_start::text AS backend_start,
            xact_start::text AS xact_start,
            COALESCE(client_addr::text,'local') AS client_addr,
            left(COALESCE(query,''), 120) AS query_head
       FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
      ORDER BY pid`);
  const idleInTx = others.filter((r) => r.state.startsWith('idle in transaction'));

  const out = {
    probe: 'P3Y-00 · S0b 前置连接登记',
    author: 'Kong (Unit J2)',
    run: RUN,
    mode: 'READ_ONLY (SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY + 仅 SELECT)',
    self: self[0],
    connections_non_self_total: others.length,
    connections_non_self: others,
    idle_in_transaction_non_self_count: idleInTx.length,
    idle_in_transaction_non_self: idleInTx,
    verdict: {
      blocked: idleInTx.length > 0 ? 'BLOCKED: 存在非本会话 idle in transaction（按铁律登记后停手；禁 terminate/cancel）' : 'CLEAR: 无非本会话 idle in transaction',
    },
    note: '只读登记；未调用 pg_terminate_backend/pg_cancel_backend。连接串已 redact。',
  };
  const file = path.join(RUN_DIR, 'conn-registry.json');
  if (fs.existsSync(file)) { console.error(`[p3y-00] 同名拒写: ${file}`); process.exit(3); }
  fs.writeFileSync(file, redact(JSON.stringify(out, null, 1)) + '\n', 'utf8');

  console.log(`RUN=${RUN}`);
  console.log(`SELF pid=${self[0]?.pid} db=${self[0]?.db} user=${self[0]?.usr} pg=${String(self[0]?.pg_version).split(' ').slice(0, 2).join(' ')}`);
  console.log(`non_self_connections=${others.length} idle_in_transaction_non_self=${idleInTx.length}`);
  for (const r of others) console.log(`  pid=${r.pid} app=${r.application_name || '(empty)'} state=${r.state} state_change=${r.state_change} backend_start=${r.backend_start} q=${String(r.query_head).slice(0, 60)}`);
  console.log(`VERDICT=${out.verdict.blocked}`);
  console.log(`artifact=${file}`);
  await c.end();
};
main().then(() => process.exit(0)).catch((e) => { console.error('[p3y-00] FAILED', e && e.stack ? e.stack : e); process.exit(1); });
