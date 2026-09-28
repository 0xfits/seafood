/**
 * P3V-01 · 只读 DB 哨兵（Neng / Unit G · QA-ERRORS-FOLD-FIX）
 * ============================================================================
 * 只 `SELECT`：① 行数（显式 `public.` 限定，库内另有 neon_auth.account）；② DB 侧函数/触发器指纹；
 * ③ trigger 计数（非 internal 全库 + 非 'O'）。**不写库**、不 DDL、不 DML。
 * §5.7⑥ run-tagged；同名拒写。用法：
 *   cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3v-01-db-readonly.ts <label>
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw } from './p1f-lib';

const LABEL = (process.argv[2] ?? 'unlabeled').replace(/[^A-Za-z0-9_.-]/g, '_');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.resolve(__dirname, '..', '.p3v-artifacts');

const main = async (): Promise<void> => {
  const pool = mkPool(1);
  try {
    const counts: Array<Record<string, unknown>> = [];
    for (const t of ['users', 'account', 'ledger_entry', 'referral', 'currency', 'commission_policy']) {
      const r = await raw<{ n: string }>(pool, `SELECT count(*)::text AS n FROM public."${t}"`).catch(() => []);
      counts.push({ table: `public.${t}`, rows: r[0]?.n ?? null });
    }
    const neon = await raw<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema='neon_auth' AND table_name='account'`).catch(() => []);
    const neonRows = neon[0]?.n === '1'
      ? (await raw<{ n: string }>(pool, `SELECT count(*)::text AS n FROM neon_auth.account`).catch(() => []))[0]?.n ?? 'NOT_MEASURED'
      : 'NOT_MEASURED';

    const fns = await raw<{ proname: string; fp: string }>(pool,
      `SELECT p.proname, md5(pg_get_functiondef(p.oid)) AS fp FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname LIKE '%ledger%' ORDER BY 1`);
    const trgs = await raw<{ tgname: string; fp: string }>(pool,
      `SELECT t.tgname, md5(pg_get_triggerdef(t.oid)) AS fp FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname LIKE '%ledger%' ORDER BY 1`);
    const trgAll = await raw<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND t.tgenabled <> 'O'`);
    const trgPublic = await raw<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public'`);
    // 已知真库现状：public 非 internal 触发器 = 43（不排除 internal 会读到 175，口径错）
    const trgUser = await raw<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND NOT t.tgisinternal`);
    const trgUserNotO = await raw<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled <> 'O'`);
    const mig = await raw<{ n: string; applied: string }>(pool,
      `SELECT count(*)::text AS n, count(*) FILTER (WHERE true)::text AS applied FROM public.schema_migration`).catch(() => []);

    const out = {
      probe: 'P3V-01 · 只读 DB 哨兵', author: 'Neng (Unit G)', label: LABEL, run: RUN,
      counts, neon_auth_account_rows: neonRows,
      ledger_function_count: fns.length, ledger_functions: fns,
      ledger_trigger_count: trgs.length, ledger_triggers: trgs,
      public_triggers_total: trgPublic[0]?.n ?? null,
      public_triggers_user_defined: trgUser[0]?.n ?? null,
      public_triggers_user_defined_not_O: trgUserNotO[0]?.n ?? null,
      public_triggers_not_enabled_O: trgAll[0]?.n ?? null,
      schema_migration_rows: mig[0]?.n ?? null,
    };
    const file = path.join(ART_DIR, `p3v-01-db-readonly-${LABEL}-${RUN}.json`);
    if (fs.existsSync(file)) { console.error(`[p3v-01] 同名拒写：${file}`); process.exit(3); }
    fs.mkdirSync(ART_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    console.log(`LABEL=${LABEL} RUN=${RUN}`);
    for (const c of counts) console.log(`  rows ${String(c.table).padEnd(26)} = ${c.rows}`);
    console.log(`  neon_auth.account rows   = ${neonRows}`);
    console.log(`  ledger fns=${fns.length} trgs=${trgs.length} | public triggers=${trgPublic[0]?.n ?? null} not-O=${trgAll[0]?.n ?? null} | schema_migration rows=${mig[0]?.n ?? null}`);
    for (const f of fns) console.log(`  fn  ${f.proname.padEnd(40)} ${f.fp}`);
    for (const t of trgs) console.log(`  trg ${t.tgname.padEnd(40)} ${t.fp}`);
    console.log(`[p3v-01] 已落盘：${file}`);
  } finally { await pool.end(); }
};
main().then(() => process.exit(0)).catch((e) => { console.error('[p3v-01] FAILED', e); process.exit(1); });
