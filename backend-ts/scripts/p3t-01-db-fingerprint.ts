/**
 * P3T-01 · 真库增量 + 反回归指纹（**只读**）
 * ============================================================================
 * 单（Unit E / P3-ERRORS-FOLD-FIX · Kong）。用途：
 *   ① 登记 `users / account / ledger_entry / currency / referral` 的**真实行数**（显式 `public.` 限定）；
 *   ② 登记 DB 侧函数指纹（`md5(pg_get_functiondef(oid))`）—— 本单**不应动 DB**，指纹必须不变；
 *   ③ 落盘 run-tagged 读数（同名拒写），供「跑套件前 / 后」同口径对拍。
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules \
 *         npx ts-node --transpile-only scripts/p3t-01-db-fingerprint.ts <label>
 * 落盘：`.p3t-artifacts/p3t-01-db-fingerprint-<label>-<RUN>.json`
 * ⚠️ 只 `SELECT`；**不写库**。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw } from './p1f-lib';

const LABEL = (process.argv[2] ?? 'unlabeled').replace(/[^A-Za-z0-9_.-]/g, '_');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.resolve(__dirname, '..', '.p3t-artifacts');
const WANTED = ['users', 'account', 'ledger_entry', 'currency', 'referral'];

const main = async (): Promise<void> => {
  const pool = mkPool(1);
  try {
    const tables = await raw<{ qualified: string; schema: string; name: string }>(
      pool,
      `SELECT table_schema || '.' || table_name AS qualified, table_schema AS schema, table_name AS name
         FROM information_schema.tables
        WHERE table_name = ANY($1::text[]) AND table_schema NOT IN ('pg_catalog','information_schema')
        ORDER BY 1`,
      [WANTED],
    );

    const counts: Array<Record<string, unknown>> = [];
    for (const t of tables) {
      // 显式 `public.` 限定：库内另有 neon_auth.account（同名不同 schema），不限定会串味
      const rows = await raw<{ n: string }>(
        pool,
        `SELECT count(*)::text AS n FROM "${t.schema}"."${t.name}"`,
      );
      counts.push({ table: t.qualified, rows: rows[0]?.n ?? null });
    }
    for (const w of WANTED) {
      if (!tables.some((t) => t.name === w)) counts.push({ table: w, rows: null, note: 'NOT_MEASURED：该名表不存在' });
    }

    const fns = await raw<{ proname: string; fingerprint: string }>(
      pool,
      `SELECT p.proname,
              md5(pg_get_functiondef(p.oid)) AS fingerprint
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE '%ledger%'
        ORDER BY p.proname`,
    );
    const triggers = await raw<{ tgname: string; fingerprint: string }>(
      pool,
      `SELECT t.tgname, md5(pg_get_triggerdef(t.oid)) AS fingerprint
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname LIKE '%ledger%'
        ORDER BY t.tgname`,
    );
    const mig = await raw<{ count: string }>(
      pool,
      `SELECT count(*)::text AS count FROM public.schema_migrations`,
    ).catch(() => [] as Array<{ count: string }>);

    const out = {
      probe: 'P3T-01 · 真库增量 + DB 侧指纹（只读）', label: LABEL, run: RUN,
      tables_present: tables.map((t) => t.qualified), counts,
      db_function_fingerprints: fns, db_trigger_fingerprints: triggers,
      schema_migrations_rows: mig[0]?.count ?? null,
    };
    const file = path.join(ART_DIR, `p3t-01-db-fingerprint-${LABEL}-${RUN}.json`);
    if (fs.existsSync(file)) { console.error(`[p3t-01] 同名拒写：${file}`); process.exit(3); }
    fs.mkdirSync(ART_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    console.log(`LABEL=${LABEL} RUN=${RUN}`);
    for (const c of counts) console.log(`  rows ${String(c.table).padEnd(28)} = ${c.rows}`);
    for (const f of fns) console.log(`  fn   ${f.proname.padEnd(40)} ${f.fingerprint}`);
    for (const t of triggers) console.log(`  trg  ${t.tgname.padEnd(40)} ${t.fingerprint}`);
    console.log(`  schema_migrations_rows = ${out.schema_migrations_rows}`);
    console.log(`[p3t-01] 已落盘：${file}`);
  } finally {
    await pool.end();
  }
};

main().then(() => process.exit(0)).catch((e) => {
  console.error('[p3t-01] FAILED', e);
  process.exit(1);
});
