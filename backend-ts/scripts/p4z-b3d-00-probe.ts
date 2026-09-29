/**
 * p4z-b3d-00-probe.ts — P4-B3d 商品资金：夹具侦察（**只读**）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3d-00-probe.ts <outDirAbs>
 * 口径（§5.7⑥）：产物 run-tagged + 绝对路径；只读；不落 token/密钥。
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
const RUN = path.basename(outDir);

async function main() {
  const currency = await sql(
    `SELECT cid::text AS cid, symbol, status, owner_uid::text AS owner_uid,
            (SELECT COUNT(1)::int FROM public.currency) AS total
       FROM public.currency ORDER BY cid`);
  const listingCols = await sql(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema='public' AND table_name='listing'
      ORDER BY ordinal_position`);
  const orderCols = await sql(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema='public' AND table_name='listing_order'
      ORDER BY ordinal_position`);
  const counts = await sql(
    `SELECT (SELECT COUNT(1)::int FROM public.listing) AS listing_rows,
            (SELECT COUNT(1)::int FROM public.listing_order) AS order_rows,
            (SELECT COUNT(1)::int FROM public.users) AS user_rows,
            (SELECT COUNT(1)::int FROM public.ledger_entry) AS ledger_rows,
            (SELECT COUNT(1)::int FROM public.account) AS account_rows`);
  const donors = await sql(
    `SELECT a.uid::text AS uid, a.balance::text AS balance FROM public.account a
      WHERE a.cid = 1 AND a.balance > 0 AND a.uid > 0 ORDER BY a.balance DESC LIMIT 8`);
  const trg = await sql(
    `SELECT t.tgname, p.proname FROM pg_trigger t
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgrelid = 'public.listing'::regclass ORDER BY 1`);
  const lpe = await sql(
    `SELECT to_regprocedure('public.listing_post_event(jsonb)')::text AS fn`);
  const minFloor = await sql(`SELECT public.ledger_max_single_amount()::text AS max_amount`);

  const out = {
    run: RUN, at: new Date().toISOString(), probe: 'p4z-b3d-00-probe',
    currency, listing_columns: listingCols, listing_order_columns: orderCols,
    counts: counts[0], donors, listing_triggers: trg, listing_post_event: lpe[0], max_single_amount: minFloor[0],
  };
  const file = path.join(outDir, 'b3d-00-probe.json');
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('WROTE ' + file);
  console.log('counts=' + JSON.stringify(counts[0]));
  console.log('currency=' + JSON.stringify(currency.map((c: any) => [c.cid, c.symbol, c.status, c.owner_uid])));
  console.log('listing_cols=' + JSON.stringify((listingCols as any[]).map((c) => c.column_name)));
  console.log('order_cols=' + JSON.stringify((orderCols as any[]).map((c) => c.column_name)));
  console.log('donors=' + JSON.stringify(donors));
  console.log('lpe=' + JSON.stringify(lpe[0]) + ' max_single=' + JSON.stringify(minFloor[0]));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
