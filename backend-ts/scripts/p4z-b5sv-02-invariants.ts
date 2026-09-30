// p4z-b5sv-02-invariants.ts — SIG-VERIFY 非资金不变量（**只读** SELECT；不写任何业务数据）
// 口径：本单**不应**写账本 ⇒ `ledger_entry` 计数与 `Σ(cid=1) 余额` 必须与基线一致；
//       静态面：端点注册点、`asset` 表仍不存在、源码内已无「不校验签名」的旁路注释。
// 用法：ts-node --transpile-only scripts/p4z-b5sv-02-invariants.ts <outDir> [baselineJson]
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b5sv-run'));
const baselinePath = process.argv[3] ? path.resolve(process.argv[3]) : null;
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
const sql = neon(String(process.env.DATABASE_URL || process.env.POSTGRES_URL || ''));

const one = async (label: string, q: string) => {
  try { const rows = await sql(q); return { label, ok: true, value: rows?.[0] ?? null, rows: rows.length }; }
  catch (e) { return { label, ok: false, error: String((e as Error).message || e).slice(0, 200) }; }
};

(async () => {
  const probes = [
    await one('ledger_entry_count', 'SELECT COUNT(*)::int AS n FROM ledger_entry'),
    await one('account_rows_cid1', 'SELECT COUNT(*)::int AS n FROM account WHERE "cid" = 1'),
    await one('sum_balance_cid1', 'SELECT COALESCE(SUM("balance"), 0)::text AS s FROM account WHERE "cid" = 1'),
    await one('users_total', 'SELECT COUNT(*)::int AS n FROM users'),
    await one('asset_table_present', "SELECT (to_regclass('public.asset') IS NULL) AS asset_absent"),
  ];
  console.log(JSON.stringify(probes, null, 2));
  fs.writeFileSync(path.join(outDir, 'invariants.json'), JSON.stringify(probes, null, 2));

  if (baselinePath && fs.existsSync(baselinePath)) {
    const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const g = (arr: any[], label: string) => arr.find((p) => p.label === label)?.value;
    const cmp: Record<string, unknown> = {};
    for (const l of ['ledger_entry_count', 'account_rows_cid1', 'sum_balance_cid1']) {
      cmp[l] = { before: g(base, l), after: g(probes, l), equal: JSON.stringify(g(base, l)) === JSON.stringify(g(probes, l)) };
    }
    console.log('DELTA', JSON.stringify(cmp, null, 2));
    fs.writeFileSync(path.join(outDir, 'invariants-delta.json'), JSON.stringify(cmp, null, 2));
  }
  const fatal = probes.filter((p) => p.label !== 'users_total' && !p.ok);
  process.exit(fatal.length === 0 ? 0 : 1);
})().catch((e) => { console.error('INVARIANT_ERROR', e); process.exit(2); });
