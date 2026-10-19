import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/backend-ts/package.json');
const { neon } = require('@neondatabase/serverless');
const env = (0, require)('dotenv').parse(fs.readFileSync('/Users/kevin/bistro/seafood/backend-ts/.env.local'));
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);
const self = await sql`SELECT current_setting('neon.project_id') AS p`;
if (self[0].p !== 'quiet-math-65207667') { console.error('ABORT: not dev project', self[0].p); process.exit(3); }
const before = await sql`SELECT cid, symbol, name FROM public.currency WHERE status='listed' AND symbol NOT IN ('$', 'BTTC') ORDER BY cid`;
const cids = before.map(r => Number(r.cid));
if (!cids.length) { console.log(JSON.stringify({ noop: true })); process.exit(0); }
if (!cids.every(n => Number.isInteger(n) && n > 1)) { console.error('ABORT: unexpected cid set', cids); process.exit(3); }
const list = cids.join(',');
const logBefore = await sql`SELECT count(*)::int AS n FROM public.currency_status_log`;
const res = await sql(`
  WITH upd AS (
    UPDATE public.currency SET status='delisted'
     WHERE status='listed' AND cid IN (${list}) RETURNING cid, symbol
  )
  INSERT INTO public.currency_status_log (cid, from_status, to_status, actor_uid, memo)
  SELECT cid, 'listed', 'delisted', 1, 'dev cleanup: QA fixture currency delisted (Kevin 2026-10-19 directive; platform coins $/BTTC kept; no business listings referenced)' FROM upd
  RETURNING log_id, cid`);
const after = await sql`SELECT cid, symbol, name, status FROM public.currency WHERE status='listed' ORDER BY cid`;
const logAfter = await sql`SELECT count(*)::int AS n FROM public.currency_status_log`;
console.log(JSON.stringify({ project: self[0].p, delisted: res.map(r => r.cid), log_before: logBefore[0].n, log_after: logAfter[0].n, log_inserted: res.length, listed_after: after }, null, 1));
