// p4z-b3a-01-snapshot.ts — P4-B3a 资金台账快照（**只读** SELECT；禁写）
// ============================================================================
// 口径（派单 §②/§⑤ + spec §5.7）：
//   · 对拍量 = Σ(balance + frozen)（全账户，含 0/-1/-2/-3）；事件前后**逐账户** dump。
//   · `ledger_entry` / `account` / `currency` / `currency_status_log` 计数 + 全行 dump。
//   · 读数带口径；异常先怀疑探针（本脚本对每条 SQL 单独 try/catch 并记录 ok/error）。
//   · 产物不落 token/密钥本体。
// 用法：ts-node --transpile-only scripts/p4z-b3a-01-snapshot.ts <outDir> <pre|post>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3a-run'));
const PHASE = process.argv[3] || 'pre';
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
  catch (e) { return { label, ok: false, error: String((e as Error).message || e).slice(0, 200) }; }
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), phase: PHASE, mode: 'READ-ONLY' };
  const queries: Array<[string, string]> = [
    ['count_ledger_entry', 'SELECT count(*)::int AS n FROM public.ledger_entry'],
    ['count_account', 'SELECT count(*)::int AS n FROM public.account'],
    ['count_currency', 'SELECT count(*)::int AS n FROM public.currency'],
    ['count_currency_status_log', 'SELECT count(*)::int AS n FROM public.currency_status_log'],
    ['count_users', 'SELECT count(*)::int AS n FROM public."users"'],
    ['sigma_all', 'SELECT COALESCE(sum(balance + frozen), 0)::text AS sigma FROM public.account'],
    ['sigma_by_cid', 'SELECT cid::text AS cid, COALESCE(sum(balance),0)::text AS bal, COALESCE(sum(frozen),0)::text AS frz FROM public.account GROUP BY cid ORDER BY cid'],
    ['account_dump', 'SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen FROM public.account ORDER BY uid, cid'],
    ['currency_dump', 'SELECT cid::text AS cid, symbol, owner_uid::text AS owner_uid, decimals::text AS decimals, status, deposit_amount::text AS deposit_amount, deposit_cid::text AS deposit_cid, listed_at::text AS listed_at FROM public.currency ORDER BY cid'],
    ['ledger_entry_dump', 'SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS frozen_delta, balance_after::text AS balance_after, frozen_after::text AS frozen_after, kind, idempotency_key, ref_type, ref_id::text AS ref_id FROM public.ledger_entry ORDER BY txid'],
    ['users_head', 'SELECT uid::text AS uid, left(evm, 6) AS evm_head, is_admin::text AS is_admin FROM public."users" ORDER BY uid LIMIT 10'],
    ['balance_winners_cid1', 'SELECT uid::text AS uid, balance::text AS balance FROM public.account WHERE cid = 1 AND balance > 0 ORDER BY balance DESC LIMIT 10'],
  ];
  for (const [label, q] of queries) out[label] = await attempt(label, q);

  const accounts = (out.account_dump as { rows?: Array<{ uid: string; cid: string; balance: string; frozen: string }> }).rows || [];
  let sigJs = 0n;
  for (const a of accounts) sigJs += BigInt(a.balance) + BigInt(a.frozen);
  const byUid: Record<string, string> = {};
  for (const a of accounts) {
    const k = `${a.uid}:${a.cid}`;
    byUid[k] = `${a.balance}/${a.frozen}`;
  }
  out.account_dump_sigma_js = sigJs.toString();
  out.account_map = byUid;
  out.account_row_count = accounts.length;
  out.ledger_entry_rows = ((out.ledger_entry_dump as { rows?: unknown[] }).rows || []).length;

  const p = path.join(outDir, `snapshot-${PHASE}.json`);
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('WROTE ' + p);
  console.log('counts: ledger_entry=' + JSON.stringify((out.count_ledger_entry as { rows?: unknown }).rows)
    + ' account=' + JSON.stringify((out.count_account as { rows?: unknown }).rows)
    + ' currency=' + JSON.stringify((out.count_currency as { rows?: unknown }).rows)
    + ' status_log=' + JSON.stringify((out.count_currency_status_log as { rows?: unknown }).rows)
    + ' users=' + JSON.stringify((out.count_users as { rows?: unknown }).rows));
  console.log('sigma_all(SQL)=' + JSON.stringify((out.sigma_all as { rows?: unknown }).rows) + ' sigma_js=' + sigJs.toString());
  console.log('sigma_by_cid=' + JSON.stringify((out.sigma_by_cid as { rows?: unknown }).rows));
  console.log('account_dump=' + JSON.stringify(accounts));
  console.log('currency_dump=' + JSON.stringify((out.currency_dump as { rows?: unknown }).rows));
  console.log('ledger_entry_dump=' + JSON.stringify((out.ledger_entry_dump as { rows?: unknown }).rows));
  console.log('balance_winners_cid1=' + JSON.stringify((out.balance_winners_cid1 as { rows?: unknown }).rows));
  console.log('users_head=' + JSON.stringify((out.users_head as { rows?: unknown }).rows));
  const bad = Object.keys(out).filter((k) => (out[k] as { ok?: boolean })?.ok === false);
  console.log('QUERY_FAILURES=' + JSON.stringify(bad));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED', e); process.exit(1); });
