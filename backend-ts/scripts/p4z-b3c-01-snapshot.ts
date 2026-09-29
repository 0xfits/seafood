/**
 * p4z-b3c-01-snapshot.ts — P4-B3c 招工资金：台账快照（账户逐行 + 逐 kind 计数）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3c-01-snapshot.ts <outDir> <label>
 * 口径（派单 §5.7⑥）：产物 run-tagged + 绝对路径；只读；不落 token/密钥。
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
const label = process.argv[3] || 'pre';
if (!process.argv[2]) throw new Error('usage: <outDir> <label>');
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const RUN = path.basename(outDir);

const abs = (p: string) => path.resolve(p);

async function main() {
  const accounts = (await sql`
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
      FROM public.account ORDER BY uid, cid`) as Array<{ uid: string; cid: string; balance: string; frozen: string }>;

  const totals = (await sql`
    SELECT COUNT(1)::int AS rows,
           COALESCE(SUM(balance),0)::text AS sum_balance,
           COALESCE(SUM(frozen),0)::text AS sum_frozen,
           COALESCE(SUM(balance + frozen),0)::text AS sum_total
      FROM public.account`) as Array<{ rows: number; sum_balance: string; sum_frozen: string; sum_total: string }>;

  const byKind = (await sql`
    SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`) as Array<{ kind: string; n: number }>;

  const ledgerTotal = (await sql`SELECT COUNT(1)::int AS n FROM public.ledger_entry`) as Array<{ n: number }>;

  const jobCounts = (await sql`
    SELECT (SELECT COUNT(1)::int FROM public.job) AS job_rows,
           (SELECT COUNT(1)::int FROM public.job WHERE create_key LIKE 'cli:b3c:%') AS job_b3c,
           (SELECT COUNT(1)::int FROM public.job_application) AS app_rows,
           (SELECT COUNT(1)::int FROM public.job_submission) AS sub_rows`) as Array<Record<string, number>>;

  const kinds: Record<string, number> = {};
  for (const r of byKind) kinds[String(r.kind)] = Number(r.n);
  const kindSum = Object.values(kinds).reduce((a, b) => a + b, 0);

  const out = {
    run: RUN, label, at: new Date().toISOString(),
    probe: 'p4z-b3c-01-snapshot',
    account: {
      rows: Number(totals[0].rows),
      sum_balance: String(totals[0].sum_balance),
      sum_frozen: String(totals[0].sum_frozen),
      sum_total: String(totals[0].sum_total),
      per_row: accounts.map((a) => ({ uid: a.uid, cid: a.cid, balance: a.balance, frozen: a.frozen })),
    },
    ledger_entry: {
      total_rows: Number(ledgerTotal[0].n),
      by_kind: kinds,
      by_kind_sum: kindSum,
      by_kind_sum_equals_total: kindSum === Number(ledgerTotal[0].n),
    },
    job: jobCounts[0],
  };
  const file = path.join(outDir, `b3c-01-snapshot-${label}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log('WROTE ' + abs(file));
  console.log('account_rows=' + out.account.rows + ' sum_balance=' + out.account.sum_balance
    + ' sum_frozen=' + out.account.sum_frozen + ' sum_total=' + out.account.sum_total);
  console.log('ledger_total=' + out.ledger_entry.total_rows + ' kind_sum=' + out.ledger_entry.by_kind_sum);
  console.log('job=' + JSON.stringify(out.job));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
