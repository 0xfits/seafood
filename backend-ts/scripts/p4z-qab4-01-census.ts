/**
 * p4z-qab4-01-census.ts — QA-B4 腿0/腿4基线与台账普查（只读）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qab4-01-census.ts <outDir>
 * 口径（§5.7）：只 SELECT；产物 run-tagged 绝对路径。
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <outDir>');
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
type Row = Record<string, unknown>;

async function main() {
  const out: Record<string, unknown> = {};
  const RUN = path.basename(outDir);
  out.run_tag = RUN;

  // 1) 列清单
  const cols = (await sql`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ledger_entry' ORDER BY ordinal_position`) as Row[];
  out.ledger_entry_cols = cols.map((c) => `${c.column_name}:${c.data_type}`);
  const acols = (await sql`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='account' ORDER BY ordinal_position`) as Row[];
  out.account_cols = acols.map((c) => `${c.column_name}:${c.data_type}`);

  // 2) 总额/行数
  const agg = (await sql`
    SELECT COUNT(1)::int AS n FROM public.ledger_entry`) as Row[];
  out.ledger_entry_rows = Number(agg[0].n);
  const acc = (await sql`
    SELECT COUNT(1)::int AS rows, COALESCE(SUM(balance),0)::text AS sb,
           COALESCE(SUM(frozen),0)::text AS sf, COALESCE(SUM(balance+frozen),0)::text AS st,
           COUNT(1) FILTER (WHERE balance < 0 OR frozen < 0)::int AS neg
      FROM public.account`) as Row[];
  out.account_rows = Number(acc[0].rows);
  out.sum_balance = String(acc[0].sb);
  out.sum_frozen = String(acc[0].sf);
  out.sum_total = String(acc[0].st);
  out.account_neg_rows = Number(acc[0].neg);

  // 3) 逐 kind 行数
  const kinds = (await sql`
    SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`) as Row[];
  out.kind_counts = kinds.map((k) => ({ kind: String(k.kind), n: Number(k.n) }));

  fs.writeFileSync(path.join(outDir, 'qab4-01-census.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    run_tag: RUN,
    ledger_entry_rows: out.ledger_entry_rows,
    sum_total: out.sum_total,
    account_neg_rows: out.account_neg_rows,
    cols: out.ledger_entry_cols,
    account_cols: out.account_cols,
    kind_counts: out.kind_counts,
  }, null, 2));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
