import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const { neon } = require('@neondatabase/serverless');
const env = (0, require)('dotenv').parse(fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local'));
const url = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
const sql = neon(url);
const proj = await sql`SELECT current_setting('neon.project_id') AS p, current_setting('neon.branch_id', true) AS b`;
const cur = await sql`SELECT cid, symbol, name, status, owner_uid FROM public.currency ORDER BY cid`;
const refs = await sql`
  SELECT c.cid,
         (SELECT count(*) FROM public.listing l WHERE l.cid = c.cid) AS listings,
         (SELECT count(*) FROM public.account a WHERE a.cid = c.cid) AS accounts,
         (SELECT count(*) FROM public.market_order m WHERE m.base_cid = c.cid) AS market_orders,
         (SELECT count(*) FROM public.ledger_entry le WHERE le.cid = c.cid) AS ledger_rows
    FROM public.currency c ORDER BY c.cid`;
const logc = await sql`SELECT count(*)::int AS n FROM public.currency_status_log`;
const admin = await sql`SELECT uid FROM public.users WHERE uid = 1`;
console.log(JSON.stringify({ project: proj[0], log_rows: logc[0].n, actor_uid_1: admin[0]?.uid ?? null,
  currencies: cur, refs }, null, 1));
