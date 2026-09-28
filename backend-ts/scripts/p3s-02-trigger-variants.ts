/**
 * P3S-02 · 「44 从哪来」变体搜捕（只读）：把 `public` 触发器计数的**所有能想到的口径**逐条算出来，
 * 标出等于 44 的项 ⇒ 把「43 vs 44」判成「口径差」还是「数据差」。
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3s-02-trigger-variants.ts
 * 落盘：`.p3s-artifacts/p3s-02-trigger-variants-<RUN>.json`（同名拒写）
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.resolve(__dirname, '..', '.p3s-artifacts');
const OUT = path.join(ART_DIR, `p3s-02-trigger-variants-${RUN}.json`);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '',
  max: 2, connectionTimeoutMillis: 30_000,
});
const q = async (sql: string): Promise<Array<Record<string, string>>> => (await pool.query(sql)).rows as Array<Record<string, string>>;

const BASE = 'FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace';

const VARIANTS: Array<[string, string, string]> = [
  ['V01', 'pg_trigger：public 且 NOT tgisinternal（我用的口径）', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal`],
  ['V02', 'pg_trigger：public 全部（含 internal）', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public'`],
  ['V03', 'pg_trigger：public 且 tgisinternal IS NOT TRUE（NULL 也算）', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND t.tgisinternal IS NOT TRUE`],
  ['V04', 'pg_trigger：全库 NOT tgisinternal（不限 schema）', `SELECT count(*)::text AS n FROM pg_trigger t WHERE NOT t.tgisinternal`],
  ['V05', 'pg_trigger：全库 全部', `SELECT count(*)::text AS n FROM pg_trigger`],
  ['V06', 'pg_trigger：public 且 tgname NOT LIKE \'RI_%\'', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND t.tgname NOT LIKE 'RI\\_%'`],
  ['V07', 'pg_trigger：public 且 tgisinternal=false 且 tgconstraint=0（非约束触发器）', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgconstraint = 0`],
  ['V08', 'pg_trigger：public 且 tgisinternal=false，按 DISTINCT tgname', `SELECT count(DISTINCT t.tgname)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal`],
  ['V09', 'pg_trigger：public 且 tgisinternal=false，按 DISTINCT tgrelid（有触发器的表数）', `SELECT count(DISTINCT t.tgrelid)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal`],
  ['V10', 'pg_trigger：按**函数**所在 schema=public 且 NOT tgisinternal', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace WHERE pn.nspname='public' AND NOT t.tgisinternal`],
  ['V11', 'pg_trigger：按**函数**所在 schema<>public 且 NOT tgisinternal', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace WHERE pn.nspname <> 'public' AND NOT t.tgisinternal`],
  ['V12', 'pg_trigger：public 且 NOT tgisinternal 且 tgparentid=0', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgparentid = 0`],
  ['V13', 'pg_trigger：public 且 NOT tgisinternal 且 tgparentid<>0（分区克隆）', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgparentid <> 0`],
  ['V14', 'pg_trigger：public 且 NOT tgisinternal 且 relkind=\'r\'', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relkind='r'`],
  ['V15', 'pg_trigger：public 且 NOT tgisinternal 且 relkind<> \'r\'（视图/外部表）', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relkind<>'r'`],
  ['V16', 'pg_trigger：public 且 NOT tgisinternal 且 tgenabled=\'O\'', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled='O'`],
  ['V17', 'pg_trigger：public 且 NOT tgisinternal 且 tgenabled<>\'D\'', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D'`],
  ['V18', 'information_schema.triggers：trigger_schema=public 行数', `SELECT count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema='public'`],
  ['V19', 'information_schema.triggers：public 去重 (table,name)', `SELECT count(DISTINCT (event_object_table, trigger_name))::text AS n FROM information_schema.triggers WHERE trigger_schema='public'`],
  ['V20', 'information_schema.triggers：action_timing/event_manipulation 组合数（替代无效列 action_schema）', `SELECT count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema='public' AND action_timing='AFTER'`],
  ['V21', 'information_schema.triggers：全库行数', `SELECT count(*)::text AS n FROM information_schema.triggers`],
  ['V22', 'information_schema.triggers：public 行数（仅 ROW 级 / action_orientation=ROW）', `SELECT count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema='public' AND action_orientation='ROW'`],
  ['V23', 'pg_constraint：public 表上全部约束数', `SELECT count(*)::text AS n FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`],
  ['V24', 'pg_constraint：public 表上 FOREIGN KEY 约束数', `SELECT count(*)::text AS n FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND k.contype='f'`],
  ['V25', 'pg_event_trigger：全库', `SELECT count(*)::text AS n FROM pg_event_trigger`],
  ['V26', 'pg_trigger：public NOT tgisinternal 且 tgtype 含 ROW(1) 位', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgtype::int & 1) = 1`],
  ['V27', 'pg_trigger：public NOT tgisinternal 且 tgtype 含 BEFORE(2) 位', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgtype::int & 2) = 2`],
  ['V28', 'pg_trigger：public NOT tgisinternal 且 tgtype 含 AFTER(64) 位', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgtype::int & 64) = 64`],
  ['V29', 'pg_trigger：public NOT tgisinternal 且 tgtype 含 INSTEAD(32) 位', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgtype::int & 32) = 32`],
  ['V30', 'pg_trigger：public NOT tgisinternal，tgname 以 trg_ 开头', `SELECT count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname LIKE 'trg\\_%'`],
  ['V31', 'pg_trigger：public NOT tgisinternal，且 tgfoid 属于 0013–0017 之后建的对象（tgfoid > 0 恒真，占位口径）', `SELECT count(DISTINCT t.tgfoid)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal`],
  ['V32', 'pg_trigger：public NOT tgisinternal，按 tgfoid 去重后的**函数数**与触发器数差', `SELECT (count(*) - count(DISTINCT t.tgfoid))::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal`],
];

const BREAKDOWN: Array<[string, string]> = [
  ['B_event_manipulation', `SELECT event_manipulation AS k, count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema='public' GROUP BY 1 ORDER BY 1`],
  ['B_timing', `SELECT action_timing AS k, count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema='public' GROUP BY 1 ORDER BY 1`],
  ['B_event_orientation', `SELECT event_manipulation || '/' || action_orientation AS k, count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema='public' GROUP BY 1 ORDER BY 1`],
  ['B_per_table', `SELECT c.relname AS k, count(*)::text AS n ${BASE} WHERE n.nspname='public' AND NOT t.tgisinternal GROUP BY 1 ORDER BY 1`],
  ['B_schemas', `SELECT n.nspname AS k, count(*)::text AS n FROM pg_namespace n GROUP BY 1 ORDER BY 1`],
];

const main = async (): Promise<void> => {
  if (fs.existsSync(OUT)) { console.error(`REFUSE_OVERWRITE ${OUT}`); process.exit(3); }
  fs.mkdirSync(ART_DIR, { recursive: true });
  const out: Record<string, unknown> = { probe: 'P3S-02 · 44 变体搜捕', run: RUN, utc: new Date().toISOString(), variants: {}, breakdown: {}, equals_44: [] as string[] };
  for (const [id, label, sql] of VARIANTS) {
    const rows = await q(sql);
    const n = rows[0]?.n ?? null;
    (out.variants as Record<string, unknown>)[id] = { label, sql, rows };
    console.log(`${id} n=${n}  ${label}`);
    if (n === '44') (out.equals_44 as string[]).push(`${id} ${label}`);
  }
  for (const [id, sql] of BREAKDOWN) {
    const rows = await q(sql);
    (out.breakdown as Record<string, unknown>)[id] = { sql, rows };
    console.log(`-- ${id}: ${JSON.stringify(rows)}`);
  }
  // information_schema 每-event 行 vs 去重行的差（解释 51 − 43 = 8）
  const dup = await q(`SELECT event_object_table AS tbl, trigger_name AS trg, count(*)::text AS rows_per_event
    FROM information_schema.triggers WHERE trigger_schema='public'
    GROUP BY 1,2 HAVING count(*) > 1 ORDER BY 3 DESC, 1`);
  (out as Record<string, unknown>).info_schema_multievent = dup;
  console.log(`-- 多事件触发器（information_schema 一触发器多行）: ${JSON.stringify(dup)}`);
  console.log(`等于 44 的变体: ${JSON.stringify(out.equals_44)}`);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`out=${OUT}`);
  await pool.end().catch(() => undefined);
};

main().catch(async (e) => { console.error('VARIANTS_FAILED', e); try { await pool.end(); } catch { /* ignore */ } process.exit(1); });
