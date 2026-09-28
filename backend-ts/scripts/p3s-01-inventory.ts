/**
 * P3S-01 · 只读清点：真库行数 + `public` 非 internal 触发器计数口径（43 vs 44 结算）
 * ============================================================================
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3s-01-inventory.ts [--tag <TAG>]
 * 落盘：`backend-ts/.p3s-artifacts/p3s-01-inventory-<TAG>.json`（同名拒写）
 *
 * SQL 纪律：一律**显式限定 `public.`**（库内另有 `neon_auth` schema）。
 * 只读：仅 SELECT（pg_catalog / information_schema / 五张表 count）。
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const argv = process.argv.slice(2);
const ti = argv.indexOf('--tag');
const TAG = ti >= 0 && argv[ti + 1] ? argv[ti + 1] : new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.resolve(__dirname, '..', '.p3s-artifacts');
const OUT = path.join(ART_DIR, `p3s-01-inventory-${TAG}.json`);

const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
const admin = new Pool({ connectionString: DIRECT_URL, max: 2, connectionTimeoutMillis: 30_000 });
const q = async <R = Record<string, unknown>>(sql: string): Promise<R[]> => (await admin.query(sql)).rows as R[];

/** [口径名, SQL] —— 每条都保留原文以便复核 */
const QUERIES: Array<[string, string]> = [
  ['rows', `SELECT 'users' AS t, count(*)::text AS n FROM public.users
            UNION ALL SELECT 'account', count(*)::text FROM public.account
            UNION ALL SELECT 'ledger_entry', count(*)::text FROM public.ledger_entry
            UNION ALL SELECT 'currency', count(*)::text FROM public.currency
            UNION ALL SELECT 'referral', count(*)::text FROM public.referral`],
  ['T1_public_not_internal', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal`],
  ['T2_public_all', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'`],
  ['T3_public_not_internal_by_enabled', `SELECT t.tgenabled::text AS en, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal GROUP BY 1 ORDER BY 1`],
  ['T4_public_all_by_enabled', `SELECT t.tgenabled::text AS en, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' GROUP BY 1 ORDER BY 1`],
  ['T5_per_namespace_all', `SELECT n.nspname AS ns, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace GROUP BY 1 ORDER BY 1`],
  ['T6_per_namespace_not_internal', `SELECT n.nspname AS ns, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT t.tgisinternal GROUP BY 1 ORDER BY 1`],
  ['T7_public_not_internal_by_relkind', `SELECT c.relkind::text AS relkind, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal GROUP BY 1 ORDER BY 1`],
  ['T8_public_all_by_relkind', `SELECT c.relkind::text AS relkind, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' GROUP BY 1 ORDER BY 1`],
  ['T9_public_all_by_tgisinternal', `SELECT t.tgisinternal::text AS internal, count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' GROUP BY 1 ORDER BY 1`],
  ['T10_public_not_internal_by_tgparentid', `SELECT CASE WHEN t.tgparentid = 0 THEN 'parent=0' ELSE 'cloned(parent<>0)' END AS k, count(*)::text AS n
     FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal GROUP BY 1 ORDER BY 1`],
  ['T11_public_rows_any_enabled_non_O', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND t.tgenabled <> 'O'`],
  ['T12_information_schema_public', `SELECT count(*)::text AS n FROM information_schema.triggers WHERE trigger_schema = 'public'`],
  ['T13_information_schema_all', `SELECT count(*)::text AS n FROM information_schema.triggers`],
  ['T14_information_schema_public_distinct', `SELECT (count(DISTINCT (trigger_schema, event_object_table, trigger_name)))::text AS n FROM information_schema.triggers WHERE trigger_schema = 'public'`],
  ['T15_pg_trigger_no_class_join', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal`],
  ['T16_pg_event_trigger', `SELECT count(*)::text AS n FROM pg_event_trigger`],
  ['T17_public_not_internal_excl_partition_clones', `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgparentid = 0`],
];

/** 名单：枚举 public 全部触发器（含 internal），标注每个字段取值 —— 用来找「第 44 个」 */
const LIST_SQL = `SELECT n.nspname AS ns, c.relname AS rel, c.relkind::text AS relkind, t.tgname AS trig,
    t.tgisinternal::text AS internal, t.tgenabled::text AS en, t.tgparentid::text AS parent,
    (t.tgconstraint <> 0)::text AS is_constraint, t.tgtype::text AS tgtype
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  ORDER BY n.nspname, c.relname, t.tgname`;

const main = async (): Promise<void> => {
  if (fs.existsSync(OUT)) { console.error(`REFUSE_OVERWRITE ${OUT}`); process.exit(3); }
  fs.mkdirSync(ART_DIR, { recursive: true });
  const readings: Record<string, unknown> = {};
  for (const [name, sql] of QUERIES) {
    readings[name] = { sql, rows: await q(sql) };
  }
  const list = await q(LIST_SQL);
  readings.LIST_ALL_TRIGGERS = { sql: LIST_SQL, rows: list };
  const pubNonInt = list.filter((r) => r.ns === 'public' && r.internal === 'false');
  const pubAll = list.filter((r) => r.ns === 'public');
  const out = {
    probe: 'P3S-01 · 只读清点（真库行数 + public 触发器计数口径）',
    tag: TAG, utc: new Date().toISOString(), readings,
    public_all_n: pubAll.length, public_not_internal_n: pubNonInt.length,
    public_not_internal_names: pubNonInt.map((r) => `${r.rel}.${r.trig}`),
    public_internal_names: pubAll.filter((r) => r.internal === 'true').map((r) => `${r.rel}(${r.relkind}).${r.trig}`),
    other_namespaces: [...new Set(list.map((r) => r.ns))],
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`TAG=${TAG} out=${OUT}`);
  for (const [name, r] of Object.entries(readings)) {
    if (name === 'LIST_ALL_TRIGGERS') continue;
    console.log(`${name}: ${JSON.stringify((r as { rows: unknown }).rows)}`);
  }
  console.log(`public 全部触发器=${pubAll.length} · 非 internal=${pubNonInt.length}`);
  console.log(`非 internal 名单(${pubNonInt.length}): ${pubNonInt.map((r) => r.rel + '.' + r.trig).join(', ')}`);
  console.log(`internal 名单(${pubAll.length - pubNonInt.length}): ${pubAll.filter((r) => r.internal === 'true').map((r) => r.rel + '(' + r.relkind + ').' + r.trig).join(', ')}`);
  await admin.end().catch(() => undefined);
};

main().catch(async (e) => { console.error('INVENTORY_FAILED', e); try { await admin.end(); } catch { /* ignore */ } process.exit(1); });
