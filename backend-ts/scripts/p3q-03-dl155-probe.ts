/**
 * p3q-03 —— DL155 探针：getSchemaVersion 修前/修后行为对拍（只读）
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3q-03-dl155-probe.ts
 * 只读：SELECT / SHOW only。
 * 关注：db.ts 的 getSchemaVersion 用**未限定** `schema_migration`（search_path 决定解析目标），
 *       与 DL151「所有 SQL 显式限定 public.」口径不一致。
 * 落盘 .p3q-artifacts/p3q-03-dl155-<PHASE>-<RUN>.json|txt
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { getSchemaVersion, getDbVersion } from '../src/db';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const PHASE = (process.argv.find((a) => a.startsWith('--phase=')) || '--phase=unknown').split('=')[1];
const RUN = process.env.P3Q_RUN || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
const OUT_DIR = path.resolve(__dirname, '..', '.p3q-artifacts');
const writeArtifact = (name: string, body: string): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  if (fs.existsSync(p)) throw new Error(`REFUSE_OVERWRITE: ${p}`);
  fs.writeFileSync(p, body); return p;
};

const main = async (): Promise<void> => {
  if (!DIRECT_URL) { console.error('FATAL: no DATABASE_URL'); process.exit(2); }
  const pool = new Pool({ connectionString: DIRECT_URL, max: 2, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });
  const q = async <R = Record<string, unknown>>(sql: string): Promise<R[]> => (await pool.query(sql)).rows as R[];

  const out: Record<string, unknown> = { run: RUN, phase: PHASE, ts_utc: new Date().toISOString(), mode: 'READ_ONLY' };

  // 1) db.ts 导出函数实测
  try { out.getSchemaVersion_from_db_ts = await getSchemaVersion(); }
  catch (e: any) { out.getSchemaVersion_from_db_ts = `THREW:${e?.message ?? e}`; }
  try { out.getDbVersion_from_db_ts = await getDbVersion(); }
  catch (e: any) { out.getDbVersion_from_db_ts = `THREW:${e?.message ?? e}`; }

  // 2) search_path 状态（决定未限定名的解析目标）
  out.search_path = (await q<{ sp: string }>("SELECT current_setting('search_path') AS sp"))[0]?.sp ?? null;
  out.current_schema = (await q<{ s: string }>('SELECT current_schema() AS s'))[0]?.s ?? null;

  // 3) 未限定 vs 限定 public. 两条 SQL 结果对比
  out.unqualified_pick = (await q<{ v: string }>(
    'SELECT version AS v FROM schema_migration ORDER BY version DESC LIMIT 1'))[0]?.v ?? null;
  out.qualified_public_pick = (await q<{ v: string }>(
    'SELECT version AS v FROM public.schema_migration ORDER BY version DESC LIMIT 1'))[0]?.v ?? null;

  // 4) 是否存在同名 schema 的 schema_migration（未限定名的潜在漂移源）
  out.same_name_tables = await q(
    `SELECT table_schema AS s, table_name AS t FROM information_schema.tables
     WHERE table_name='schema_migration' ORDER BY 1`);

  await pool.end();
  const json = JSON.stringify(out, null, 2);
  const jp = writeArtifact(`p3q-03-dl155-${PHASE}-${RUN}.json`, json);
  const lines = [`RUN=${RUN} PHASE=${PHASE}`,
    `getSchemaVersion() [db.ts]        = ${JSON.stringify(out.getSchemaVersion_from_db_ts)}`,
    `getDbVersion() [db.ts]            = ${JSON.stringify(out.getDbVersion_from_db_ts)}`,
    `search_path                       = ${out.search_path}`,
    `current_schema()                  = ${out.current_schema}`,
    `SQL unqualified  schema_migration = ${out.unqualified_pick}`,
    `SQL public.      schema_migration = ${out.qualified_public_pick}`,
    `tables named schema_migration     = ${JSON.stringify(out.same_name_tables)}`,
    `artifact_json=${jp}`];
  const tp = writeArtifact(`p3q-03-dl155-${PHASE}-${RUN}.txt`, lines.join('\n'));
  console.log(lines.join('\n'));
  console.log(`artifact_txt=${tp}`);
  console.log(`--- EXIT_OK ---`);
};
main().catch((e) => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(2); });
