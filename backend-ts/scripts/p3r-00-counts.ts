/**
 * p3r-00 · 真库行增量口径探针（只读）：登记套件批跑前后的 public 行数 + cid=1 守恒核对。
 * 用法：npx ts-node --transpile-only scripts/p3r-00-counts.ts <label>
 * 落盘 .p3r-artifacts/p3r-00-counts-<label>-<RUN>.json
 */
import * as path from 'path';
import * as fs from 'fs';
import { mkPool, raw1, RUN, type Qx } from './p2w-lib';

const OUT_DIR = path.resolve(__dirname, '..', '.p3r-artifacts');
const label = process.argv[2] ?? 'unlabeled';

(async () => {
  const p = mkPool(2);
  const q = p as unknown as Qx;
  const one = async (sql: string) => (await raw1<{ n: string }>(q, sql))?.n ?? null;
  const out: Record<string, unknown> = {
    users: await one(`SELECT count(*)::text AS n FROM public.users`),
    account: await one(`SELECT count(*)::text AS n FROM public.account`),
    ledger_entry: await one(`SELECT count(*)::text AS n FROM public.ledger_entry`),
    referral: await one(`SELECT count(*)::text AS n FROM public.referral`),
    currency: await one(`SELECT count(*)::text AS n FROM public.currency`),
    commission_policy: await one(`SELECT count(*)::text AS n FROM public.commission_policy`),
    schema_version: await one(`SELECT max(version)::text AS n FROM public.schema_migration`),
    usd_total_supply: await one(`SELECT total_supply::text AS n FROM public.currency WHERE cid = 1`),
    cid1_sum_balance_frozen: await one(`SELECT COALESCE(sum(balance + frozen),0)::text AS n FROM public.account WHERE cid = 1`),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p3r-00-counts-${label}-${RUN}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, label, at: new Date().toISOString(), counts: out }, null, 2));
  console.log(JSON.stringify({ file, label, run: RUN, counts: out }, null, 1));
  await p.end();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
