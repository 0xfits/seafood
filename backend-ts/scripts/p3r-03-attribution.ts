/**
 * p3r-03 · 只读归因：把 before/after 行增量精确归到「谁写的」（本单命名空间 vs 其它会话/套件）。
 * 用法：npx ts-node --transpile-only scripts/p3r-03-attribution.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import { mkPool, raw, RUN } from './p2w-lib';

const OUT_DIR = path.resolve(__dirname, '..', '.p3r-artifacts');

(async () => {
  const p = mkPool(2);
  const out: Record<string, unknown> = {
    my_currency_rows: await raw(p as never, `SELECT cid::text, symbol, owner_uid::text AS owner, total_supply::text AS supply
      FROM public.currency WHERE symbol LIKE 'p3rk18%' OR symbol LIKE 'P1PMUL%' ORDER BY cid`),
    my_uid_window_accounts: await raw(p as never, `SELECT uid::text, cid::text, balance::text, frozen::text
      FROM public.account WHERE uid BETWEEN 990900 AND 990999 ORDER BY uid, cid`),
    my_uid_window_users: await raw(p as never, `SELECT uid::text FROM public.users WHERE uid BETWEEN 990900 AND 990999 ORDER BY uid`),
    my_uid_window_referral: await raw(p as never, `SELECT child_uid::text, parent_uid::text, depth::text FROM public.referral
      WHERE child_uid BETWEEN 990900 AND 990999 OR parent_uid BETWEEN 990900 AND 990999 ORDER BY child_uid`),
    my_key_prefix_ledger: await raw(p as never, `SELECT idempotency_key, uid::text, kind FROM public.ledger_entry
      WHERE idempotency_key LIKE 'cli:kong18-%' OR idempotency_key LIKE 'p3r%' ORDER BY txid`),
    tail_currency: await raw(p as never, `SELECT cid::text, symbol, owner_uid::text AS owner, total_supply::text AS supply
      FROM public.currency ORDER BY cid DESC LIMIT 8`),
    tail_accounts: await raw(p as never, `SELECT uid::text, cid::text, balance::text, frozen::text
      FROM public.account ORDER BY cid DESC, uid LIMIT 12`),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p3r-03-attribution-${RUN}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name: 'p3r-03', at: new Date().toISOString(), ...out }, null, 2));
  console.log(JSON.stringify({ file, run: RUN, out }, null, 1));
  await p.end();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
