/**
 * QA 8④-终审质检 · 自写探针 00：三表触发器现取（C-8 前提）+ 库面只读复核。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only .p8s4qa-artifacts/qa8s4-00-triggers.ts
 * 只读：单 withTransaction + 末尾哨兵 ROLLBACK（即便只读亦不 COMMIT）。
 * 不打印任何连接串 / 密钥。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { withTransaction, closePools, txQuery, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, `qa8s4-00-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const SENTINEL = 'qa8s4-rollback';

interface Check { id: string; pass: boolean; detail: unknown; }
const checks: Check[] = [];
const rec = (id: string, pass: boolean, detail: unknown): void => { checks.push({ id, pass, detail }); };

const TABLES = ['currency', 'currency_status_log', 'currency_review_log'];

const main = async (): Promise<void> => {
  const out: Record<string, unknown> = {};
  let rolledBack = false;
  try {
    await withTransaction(async (tx: TxClient) => {
      // 1) 三表触发器（非 internal）
      const trig = await txQuery<Record<string, unknown>>(tx, `
        SELECT c.relname AS table_name, t.tgname, t.tgenabled,
               p.proname AS func_name, pg_get_triggerdef(t.oid) AS def
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_proc p ON p.oid = t.tgfoid
         WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
           AND NOT t.tgisinternal
         ORDER BY c.relname, t.tgname`, [TABLES]);
      out.triggers = trig.map((r) => ({
        table: r.table_name, tgname: r.tgname, enabled: r.tgenabled, func: r.func_name, def: r.def,
      }));
      rec('T1', TABLES.every((tb) => trig.some((r) => r.table_name === tb) || tb === 'currency'),
        { tables_with_triggers: trig.map((r) => r.table_name) });
      const curTrg = trig.filter((r) => r.table_name === 'currency');
      rec('T2', curTrg.length === 0, { currency_triggers: curTrg.length });
      const slog = trig.filter((r) => r.table_name === 'currency_status_log');
      const rev = trig.filter((r) => r.table_name === 'currency_review_log');
      rec('T3', slog.length >= 1 && slog.every((r) => /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/i.test(String(r.def))),
        { slog: slog.map((r) => r.def) });
      rec('T4', rev.length >= 1 && rev.every((r) => /BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/i.test(String(r.def))),
        { rev: rev.map((r) => r.def) });

      // 2) currency_review_log 结构：8 列
      const cols = await txQuery<Record<string, unknown>>(tx, `
        SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
         WHERE table_schema='public' AND table_name='currency_review_log'
         ORDER BY ordinal_position`);
      out.review_log_columns = cols;
      rec('C1', cols.length === 8, { n: cols.length, cols: cols.map((c) => c.column_name) });

      // 3) 5 约束
      const cons = await txQuery<Record<string, unknown>>(tx, `
        SELECT conname, contype, pg_get_constraintdef(oid) AS def
          FROM pg_constraint
         WHERE conrelid = 'public.currency_review_log'::regclass
         ORDER BY conname`);
      out.review_log_constraints = cons;
      const declared = cons.filter((c) => ['p', 'f', 'u', 'c', 'x'].includes(String(c.contype)));
      out.review_log_constraints_declared = declared;
      rec('C2', declared.length === 5, { declared_n: declared.length, names: declared.map((c) => c.conname) });

      // 4) 4 索引
      const idx = await txQuery<Record<string, unknown>>(tx, `
        SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname='public' AND tablename='currency_review_log'
         ORDER BY indexname`);
      out.review_log_indexes = idx;
      rec('C3', idx.length === 4, { n: idx.length, names: idx.map((i) => i.indexname) });

      // 5) schema_migration 0025 行 + checksum
      const migRow = await txQuery<Record<string, unknown>>(tx, `
        SELECT version, checksum, applied_at::text AS applied_at
          FROM public.schema_migration WHERE version = '0025'`);
      out.schema_migration_0025 = migRow;
      rec('C4', migRow.length === 1 && migRow[0]?.checksum != null, { row: migRow[0] ?? null });

      // 6) schema_version
      let schemaVer: unknown = null;
      try {
        const sv = await txQuery<Record<string, unknown>>(tx,
          `SELECT max(version) AS v FROM public.schema_migration`);
        schemaVer = sv[0]?.v ?? null;
      } catch (e) { schemaVer = `(err ${(e as Error).message})`; }
      out.schema_version = schemaVer;

      // 7) 残渣（只读）
      const res = await txQuery<Record<string, unknown>>(tx, `
        SELECT
          (SELECT count(*)::int FROM public.currency_review_log) AS review_rows,
          (SELECT count(*)::int FROM public.currency WHERE cid >= 900000000) AS probe_currency,
          (SELECT count(*)::int FROM public.currency WHERE symbol LIKE 'p8s4%' OR symbol LIKE 'qa8s4%') AS probe_symbol,
          (SELECT count(*)::int FROM public.currency_status_log WHERE cid >= 900000000) AS probe_slog,
          (SELECT count(*)::int FROM public.ledger_entry WHERE idempotency_key LIKE 'biz:currency:list:9%' OR idempotency_key LIKE 'ops:%:currency_review:9%') AS probe_ledger,
          (SELECT max(cid)::text FROM public.currency) AS max_cid,
          (SELECT count(*)::int FROM public.ledger_entry) AS ledger_total,
          (SELECT count(*)::int FROM public.schema_migration) AS mig_rows`);
      out.residue = res[0];

      // 8) 0025 文件 sha256（本仓现取）
      const migPath = path.resolve(__dirname, '..', 'migrations', '0025_currency_review_log.sql');
      const buf = fs.readFileSync(migPath);
      out.migration_file = {
        path: 'backend-ts/migrations/0025_currency_review_log.sql',
        bytes: buf.length,
        lines: buf.toString('utf8').split('\n').length,
        sha256: createHash('sha256').update(buf).digest('hex'),
      };
      rec('C5', Boolean(out.migration_file && (out.migration_file as { sha256: string }).sha256),
        out.migration_file);

      throw new Error(SENTINEL);
    }, { statementTimeoutMs: 30000 });
    rec('Z', false, 'no sentinel');
  } catch (e) {
    if ((e as Error)?.message === SENTINEL) rolledBack = true;
    else rec('Z', false, { err: (e as Error)?.message });
  }
  out.rolled_back = rolledBack;
  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'QA8S4-00-TRIGGERS', run: RUN, total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks, out };
  fs.writeFileSync(path.join(OUT_DIR, 'triggers.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  await closePools();
  process.exit(failed.length ? 1 : 0);
};

main().catch(async (e) => { console.error('FAIL', (e as Error)?.message); await closePools(); process.exit(2); });
