// p4z-b3afix-00-probe.ts — P4-B3a-FIX-A 取证探针（**只读**；禁写）
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix-00-probe.ts <outDir>
// 用途：现取 DB 侧 `-1` credit 白名单真身（函数体）+ kind 关闭集 CHECK 文本 + 迁移注册表读数。
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix-run'));
fs.mkdirSync(outDir, { recursive: true });

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const url = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
if (!url) throw new Error('NO_DATABASE_URL');
const sql = neon(url);

const attempt = async (label: string, q: string) => {
  try { return { label, ok: true, rows: await sql(q) }; }
  catch (e) {
    const anyE = e as Record<string, unknown>;
    return { label, ok: false, error: String(anyE?.message || e).slice(0, 300), code: anyE?.code ?? null };
  }
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), mode: 'READ-ONLY', phase: 'pre-fix' };
  const queries: Array<[string, string]> = [
    ['registry', `SELECT version, name, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version`],
    ['registry_count', `SELECT count(*)::int AS n FROM public.schema_migration`],
    ['fn_def', `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'ledger_assert_platform_mutation' AND n.nspname = 'public'`],
    ['kind_check', `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conrelid = 'public.ledger_entry'::regclass AND c.conname = 'ledger_kind_enum'`],
    ['kind_constraint_names', `SELECT conname, contype::text FROM pg_constraint WHERE conrelid = 'public.ledger_entry'::regclass ORDER BY conname`],
    ['listing_deposit_rows', `SELECT kind, count(*)::int AS n FROM public.ledger_entry WHERE kind IN ('listing_deposit','listing_deposit_refund','listing_deposit_forfeit') GROUP BY kind ORDER BY kind`],
    ['probe_neg_listing_deposit_credit', `SELECT public.ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit') AS r`],
    ['probe_pos_job_fee_credit', `SELECT public.ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'credit') AS r`],
    ['probe_neg_commission_credit', `SELECT public.ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit') AS r`],
  ];
  for (const [label, q] of queries) out[label] = await attempt(label, q);

  const p = path.join(outDir, 'b3afix-00-probe.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('WROTE ' + p);
  console.log('registry_count=' + JSON.stringify((out.registry_count as { rows?: unknown }).rows));
  console.log('kind_check=' + JSON.stringify((out.kind_check as { rows?: unknown }).rows));
  console.log('probe_neg_listing_deposit_credit=' + JSON.stringify(out.probe_neg_listing_deposit_credit));
  console.log('probe_pos_job_fee_credit=' + JSON.stringify(out.probe_pos_job_fee_credit));
  console.log('listing_deposit_rows=' + JSON.stringify((out.listing_deposit_rows as { rows?: unknown }).rows));
};

main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
