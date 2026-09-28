/**
 * p3r-01 · P3-RCA 地基体检：现取库侧结构事实（触发器定义/派生属性/约束定义/函数指纹）。
 * 只读；不做任何写。run-tagged 落盘 .p3r-artifacts/。
 * 用法：npx ts-node --transpile-only scripts/p3r-01-facts.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import { mkPool, raw, raw1, RUN, type Qx } from './p2w-lib';

const OUT_DIR = path.resolve(__dirname, '..', '.p3r-artifacts');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

(async () => {
  const p = mkPool(2);
  const q = (sql: string, params: unknown[] = []) => raw(p as unknown as Qx, sql, params);

  const out: Record<string, unknown> = {};
  out.schema_version = await raw1(p as unknown as Qx, `SELECT max(version)::text AS v FROM public.schema_migration`);
  out.triggers = await q(`
    SELECT c.relname AS tbl, t.tgname, t.tgenabled, t.tgdeferrable, t.tginitdeferred,
           pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname = 'public'
       AND c.relname IN ('ledger_entry','referral','account','currency')
     ORDER BY 1,2`);
  out.referral_constraints = await q(`
    SELECT con.conname, con.contype, con.condeferrable, con.condeferred,
           pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'referral' ORDER BY 1`);
  out.ledger_entry_constraints = await q(`
    SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'ledger_entry' ORDER BY 1`);
  out.fn_fingerprints = await q(`
    SELECT p.proname, octet_length(p.prosrc)::text AS len, md5(p.prosrc) AS md5
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('ledger_post_event','market_post_event','listing_post_event','job_post_event',
                         'ledger_assert_commission_conservation','referral_cycle_guard','referral_bind')
     ORDER BY 1`);
  out.conservation_fn_src = (await raw1<{ s: string }>(p as unknown as Qx,
    `SELECT prosrc AS s FROM pg_proc WHERE proname = 'ledger_assert_commission_conservation' LIMIT 1`))?.s ?? null;
  out.cycle_guard_fn_src = (await raw1<{ s: string }>(p as unknown as Qx,
    `SELECT prosrc AS s FROM pg_proc WHERE proname = 'referral_cycle_guard' LIMIT 1`))?.s ?? null;
  out.candle_view = await q(`SELECT count(*)::text AS n FROM pg_views WHERE schemaname='public' AND viewname='candle_view'`);

  const file = save('p3r-01-facts', out);
  console.log(JSON.stringify({ file, run: RUN, schema_version: out.schema_version,
    triggers: out.triggers, fn_fingerprints: out.fn_fingerprints }, null, 1));
  await p.end();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
