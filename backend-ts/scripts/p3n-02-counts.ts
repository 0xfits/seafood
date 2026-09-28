/** p3n-02-counts.ts —— Neng 质检：只读计数快照（归因 p1o-00 套件自产残留；零写入、run-tagged） */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Pool, neonConfig } = require('@neondatabase/serverless');
// eslint-disable-next-line @typescript-eslint/no-var-requires
neonConfig.webSocketConstructor = require('ws');
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const OUT = path.resolve(__dirname, '..', '.p3n-artifacts', `p3n-02-counts-${RUN}.json`);
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '', max: 2 });
const main = async (): Promise<void> => {
  const out: Record<string, unknown> = { run: RUN, at: new Date().toISOString(), read_only: true };
  for (const t of ['users', 'account', 'ledger_entry', 'referral', 'currency', 'commission_policy', 'schema_migration']) {
    out[t] = (await pool.query(`SELECT count(*)::text AS n FROM public."${t}"`)).rows[0].n;
  }
  out.cid1 = (await pool.query(`SELECT c.total_supply::text AS supply, COALESCE((SELECT sum(a.balance+a.frozen) FROM public.account a WHERE a.cid=c.cid),0)::text AS sum_bal FROM public.currency c WHERE c.cid=1`)).rows[0];
  out.p1o_currencies = (await pool.query(`SELECT cid::text AS cid, symbol::text AS symbol, owner_uid::text AS owner, total_supply::text AS supply FROM public.currency WHERE symbol LIKE 'P1P%' ORDER BY cid`)).rows;
  out.p1o_accounts = (await pool.query(`SELECT count(*)::text AS n FROM public.account WHERE cid IN (SELECT cid FROM public.currency WHERE symbol LIKE 'P1P%')`)).rows[0];
  out.my_p3n_currencies = (await pool.query(`SELECT cid::text AS cid, symbol::text AS symbol, total_supply::text AS supply FROM public.currency WHERE symbol LIKE 'p3n19%' ORDER BY cid`)).rows;
  out.my_keys_ledger = (await pool.query(`SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE 'cli:neng19-%' OR idempotency_key LIKE 'biz:job:settle:9912%' OR idempotency_key LIKE 'biz:job:settle:9913%'`)).rows[0];
  out.users_my_windows = (await pool.query(`SELECT count(*)::text AS n FROM public.users WHERE uid BETWEEN 991000 AND 991099`)).rows[0];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), { flag: 'wx' });
  console.log(OUT);
};
main().then(() => { pool.end(); process.exit(0); })
  .catch((e) => { console.error('ERR', (e as Error)?.message); process.exit(2); });
