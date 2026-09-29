// p4z-sec-03-invariants.ts — P4-SEC 非资金不变量（**只读** SELECT；不写任何业务数据）
// 口径：`ledger_entry` 必须仍为 0（本单不应写任何业务数据）；`account`/`currency` 现状快照。
// 用法：ts-node --transpile-only scripts/p4z-sec-03-invariants.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'sec-run'));
fs.mkdirSync(outDir, { recursive: true });

// .env.local（只进 process.env）
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
const sql = neon(url);

const attempt = async (label: string, q: string) => {
  try { return { label, ok: true, rows: await sql(q) }; }
  catch (e) { return { label, ok: false, error: String((e as Error).message || e).slice(0, 200) }; }
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), mode: 'READ-ONLY' };
  const queries: Array<[string, string]> = [
    ['ledger_entry_count', 'SELECT count(*)::int AS n FROM public.ledger_entry'],
    ['account_count', 'SELECT count(*)::int AS n FROM public.account'],
    ['currency_count', 'SELECT count(*)::int AS n FROM public.currency'],
    ['account_rows', 'SELECT * FROM public.account ORDER BY 1 LIMIT 50'],
    ['currency_rows', 'SELECT * FROM public.currency ORDER BY 1 LIMIT 50'],
    ['users_count', 'SELECT count(*)::int AS n FROM public."users"'],
  ];
  const results = [];
  for (const [label, q] of queries) results.push(await attempt(label, q));
  for (const r of results) out[(r as { label: string }).label] = r;

  const le = out.ledger_entry_count as { ok: boolean; rows?: Array<{ n: number }> };
  out.INVARIANT_ledger_entry_is_zero = Boolean(le?.ok && le.rows && le.rows[0]?.n === 0);

  const p = path.join(outDir, 'invariants.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('WROTE ' + p);
  console.log('ledger_entry_count=' + JSON.stringify((out.ledger_entry_count as { rows?: unknown }).rows));
  console.log('INVARIANT_ledger_entry_is_zero=' + out.INVARIANT_ledger_entry_is_zero);
  console.log('account_count=' + JSON.stringify((out.account_count as { rows?: unknown }).rows));
  console.log('currency_count=' + JSON.stringify((out.currency_count as { rows?: unknown }).rows));
  console.log('account_rows=' + JSON.stringify((out.account_rows as { rows?: unknown }).rows));
  console.log('currency_rows=' + JSON.stringify((out.currency_rows as { rows?: unknown }).rows));
  console.log('users_count=' + JSON.stringify((out.users_count as { rows?: unknown }).rows));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED', e); process.exit(1); });
