/**
 * p3q-00 —— 地盘体检基线指纹（只读）
 * Kong · P3-Q 单（变体 1 第 ①③）。
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3q-00-fingerprint.ts
 * 退出码：0 正常 / 2 致命。
 * 只读：仅 SELECT。不改任何数据。
 * 落盘：.p3q-artifacts/p3q-00-fingerprint-<RUN>.json / .txt（同名拒写）。
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

const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const RUN = process.env.P3Q_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
const OUT_DIR = path.resolve(__dirname, '..', '.p3q-artifacts');

const writeArtifact = (name: string, body: string): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  if (fs.existsSync(p)) throw new Error(`REFUSE_OVERWRITE: ${p}`);
  fs.writeFileSync(p, body);
  return p;
};

const md5 = (v: string): string => crypto.createHash('md5').update(v).digest('hex');

const main = async (): Promise<void> => {
  if (!DIRECT_URL) { console.error('FATAL: no DATABASE_URL'); process.exit(2); }
  const runTag = RUN;
  const pool = new Pool({ connectionString: DIRECT_URL, max: 3, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });
  const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, params)).rows as R[];

  const out: Record<string, unknown> = { run: runTag, ts_utc: new Date().toISOString(), host_readonly: true };

  // 1) 库版本
  out.db_version = (await q<{ v: string }>('SELECT version() AS v'))[0]?.v ?? null;

  // 2) schema_version + registry
  const mig = await q<{ version: string }>('SELECT version FROM public.schema_migration ORDER BY version DESC');
  out.schema_migration_versions = mig.map((r) => r.version);
  out.registry_rows = mig.length;
  out.schema_version_max = mig[0]?.version ?? null;

  // 3) 基表 / 视图
  const tbl = await q<{ table_name: string; table_type: string }>(
    `SELECT table_name, table_type FROM information_schema.tables
     WHERE table_schema='public' AND table_type IN ('BASE TABLE','VIEW') ORDER BY table_type, table_name`);
  out.base_tables = tbl.filter((r) => r.table_type === 'BASE TABLE').map((r) => r.table_name);
  out.views = tbl.filter((r) => r.table_type === 'VIEW').map((r) => r.table_name);
  out.base_table_count = (out.base_tables as string[]).length;
  out.view_count = (out.views as string[]).length;

  // 4) 四个编排函数指纹
  const fns = ['ledger_post_event', 'market_post_event', 'listing_post_event', 'job_post_event'];
  const fpr: Record<string, unknown> = {};
  for (const f of fns) {
    const row = (await q<{ n: string; l: number; b: number; src: string; def: string }>(
      `SELECT p.proname AS n, length(p.prosrc) AS l, octet_length(p.prosrc) AS b, p.prosrc AS src,
              pg_get_functiondef(p.oid) AS def
       FROM pg_proc p WHERE p.proname=$1 AND p.pronamespace='public'::regnamespace ORDER BY p.oid`, [f]))[0];
    if (!row) { fpr[f] = { found: false }; continue; }
    fpr[f] = {
      found: true, length_chars: Number(row.l), octet_length: Number(row.b),
      md5_prosrc: md5(row.src), md5_functiondef: md5(row.def),
    };
  }
  out.functions = fpr;

  // 5) 所有 public 基表的 (name, columns) —— 供残差清单口径定位
  const cols = await q<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
    `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
  const colMap: Record<string, Array<{ c: string; t: string; n: string }>> = {};
  for (const r of cols) {
    (colMap[r.table_name] ||= []).push({ c: r.column_name, t: r.data_type, n: r.is_nullable });
  }
  out.columns = colMap;

  await pool.end();

  const json = JSON.stringify(out, null, 2);
  const jsonPath = writeArtifact(`p3q-00-fingerprint-${runTag}.json`, json);
  const txt = [
    `RUN=${runTag}`, `db_version=${out.db_version}`,
    `schema_version=${out.schema_version_max} registry_rows=${out.registry_rows}`,
    `base_table_count=${out.base_table_count} view_count=${out.view_count}`,
    `base_tables=${(out.base_tables as string[]).join(',')}`,
    `views=${(out.views as string[]).join(',')}`,
    ...Object.entries(fpr).map(([k, v]) => `fn ${k} = ${JSON.stringify(v)}`),
    `artifact_json=${jsonPath}`,
  ].join('\n');
  writeArtifact(`p3q-00-fingerprint-${runTag}.txt`, txt);
  console.log(txt);
  console.log('--- COLUMNS ---');
  for (const [t, cs] of Object.entries(colMap)) {
    console.log(`${t}: ${cs.map((x) => `${x.c}:${x.t}${x.n === 'NO' ? '!' : ''}`).join(' ')}`);
  }
  console.log(`--- EXIT_OK RUN=${runTag} ---`);
};

main().catch((e) => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(2); });
