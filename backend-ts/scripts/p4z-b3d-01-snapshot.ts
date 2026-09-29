/**
 * p4z-b3d-01-snapshot.ts — P4-B3d 商品资金：台账快照（全账户 dump + 逐 kind + listing 快照）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3d-01-snapshot.ts <outDir> <label>
 * 口径（§5.7⑥⑧）：产物 run-tagged + 绝对路径；只读；不落 token/密钥。
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

  const listingRows = (await sql`
    SELECT listing_id::text AS listing_id, seller_uid::text AS seller_uid, cid::text AS cid,
           price::text AS price, stock::text AS stock, status, create_key
      FROM public.listing ORDER BY listing_id`) as Array<Record<string, string>>;

  const orderRows = (await sql`
    SELECT order_id::text AS order_id, listing_id::text AS listing_id, buyer_uid::text AS buyer_uid,
           seller_uid::text AS seller_uid, cid::text AS cid, price::text AS price,
           quantity::text AS quantity, status, create_key,
           pay_txid::text AS pay_txid, refund_txid::text AS refund_txid, ledger_event_keys
      FROM public.listing_order ORDER BY order_id`) as Array<Record<string, unknown>>;

  const counts = (await sql`
    SELECT (SELECT COUNT(1)::int FROM public.listing) AS listing_rows,
           (SELECT COUNT(1)::int FROM public.listing_order) AS order_rows,
           (SELECT COUNT(1)::int FROM public.listing WHERE status = 'listed') AS listing_listed,
           (SELECT COUNT(1)::int FROM public.users) AS user_rows,
           (SELECT COUNT(1)::int FROM public.account) AS account_rows`) as Array<Record<string, number>>;

  // 负值行（任何 balance/frozen < 0 ⇒ 不变量破）
  const negative = (await sql`
    SELECT COUNT(1)::int AS n FROM public.account WHERE balance < 0 OR frozen < 0`) as Array<{ n: number }>;
  // listing.stock 负值（23514 非负 CHECK 的读侧对拍）
  const negStock = (await sql`
    SELECT COUNT(1)::int AS n FROM public.listing WHERE stock < 0`) as Array<{ n: number }>;
  // 孤儿分录探针：每条分录可归到一个 listing 事件根键的集合
  const orphan = (await sql`
    SELECT COUNT(1)::int AS n FROM public.ledger_entry e
     WHERE e.ref_type = 'listing_order'
       AND e.event_root_key NOT LIKE 'biz:listing:%'`) as Array<{ n: number }>;

  const kinds: Record<string, number> = {};
  for (const r of byKind) kinds[String(r.kind)] = Number(r.n);
  const kindSum = Object.values(kinds).reduce((a, b) => a + b, 0);

  const out = {
    run: RUN, label, at: new Date().toISOString(), probe: 'p4z-b3d-01-snapshot',
    account: {
      rows: Number(totals[0].rows),
      sum_balance: String(totals[0].sum_balance),
      sum_frozen: String(totals[0].sum_frozen),
      sum_total: String(totals[0].sum_total),
      negative_rows: Number(negative[0].n),
      per_row: accounts.map((a) => ({ uid: a.uid, cid: a.cid, balance: a.balance, frozen: a.frozen })),
    },
    ledger_entry: {
      total_rows: Number(ledgerTotal[0].n),
      by_kind: kinds,
      by_kind_sum: kindSum,
      by_kind_sum_equals_total: kindSum === Number(ledgerTotal[0].n),
      listing_order_ref_orphans: Number(orphan[0].n),
    },
    listing: { rows: listingRows, negative_stock_rows: Number(negStock[0].n) },
    listing_order: { rows: orderRows },
    counts: counts[0],
  };
  const file = path.join(outDir, `b3d-01-snapshot-${label}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log('WROTE ' + file);
  console.log('account_rows=' + out.account.rows + ' sum_balance=' + out.account.sum_balance
    + ' sum_frozen=' + out.account.sum_frozen + ' sum_total=' + out.account.sum_total
    + ' negative_rows=' + out.account.negative_rows);
  console.log('ledger_total=' + out.ledger_entry.total_rows + ' kind_sum=' + out.ledger_entry.by_kind_sum
    + ' orphans=' + out.ledger_entry.listing_order_ref_orphans);
  console.log('counts=' + JSON.stringify(out.counts) + ' neg_stock=' + out.listing.negative_stock_rows);
  console.log('kinds=' + JSON.stringify(kinds));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
