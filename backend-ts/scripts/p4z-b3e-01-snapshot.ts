/**
 * p4z-b3e-01-snapshot.ts — P4-B3e 交易所资金：台账快照（**全账户逐行 dump** + 逐 kind + market 快照 + 不变量）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3e-01-snapshot.ts <outDir> <label>
 * 口径（§5.7⑥⑧）：产物 run-tagged + 绝对路径；**只读**（只 SELECT）；同名拒写；不落 token/密钥。
 * 不变量对拍（供 Zang 自算）：
 *   account: 行数 / Σbalance / Σfrozen / **Σtotal**（逐行 dump ⇒ 可独立复算）；负值行数
 *   ledger_entry: 总数 / **逐 kind 计数**（= 由各片事件累加，增量 == 事件×分录条数）/ 逐 ref_type
 *   逐事件 Σ(delta+frozen_delta) ≠ 0 的根键数（**必须 0**）
 *   孤儿分录：ref_type ∈ {market_order, market_trade} 而 ref_id 不指向存在的业务行（**必须 0**）
 *   market_order / market_trade 全量 dump + 每行 ledger_event_keys
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

type Row = Record<string, unknown>;

async function main() {
  const accounts = (await sql`
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen,
           (balance + frozen)::text AS total
      FROM public.account ORDER BY uid, cid`) as Row[];

  const totals = (await sql`
    SELECT COUNT(1)::int AS rows,
           COALESCE(SUM(balance),0)::text AS sum_balance,
           COALESCE(SUM(frozen),0)::text AS sum_frozen,
           COALESCE(SUM(balance + frozen),0)::text AS sum_total
      FROM public.account`) as Row[];

  const totalsCid1 = (await sql`
    SELECT COUNT(1)::int AS rows,
           COALESCE(SUM(balance),0)::text AS sum_balance,
           COALESCE(SUM(frozen),0)::text AS sum_frozen,
           COALESCE(SUM(balance + frozen),0)::text AS sum_total
      FROM public.account WHERE cid = 1`) as Row[];

  const negative = (await sql`
    SELECT COUNT(1)::int AS n FROM public.account WHERE balance < 0 OR frozen < 0`) as Row[];

  const byKind = (await sql`
    SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`) as Row[];
  const ledgerTotal = (await sql`SELECT COUNT(1)::int AS n FROM public.ledger_entry`) as Row[];
  const byRefType = (await sql`
    SELECT ref_type, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY ref_type ORDER BY ref_type`) as Row[];
  const byRefAndKind = (await sql`
    SELECT ref_type, kind, COUNT(1)::int AS n FROM public.ledger_entry
     GROUP BY ref_type, kind ORDER BY ref_type, kind`) as Row[];

  // 逐事件守恒：Σ(delta + frozen_delta) 必须 = 0（纯转移）
  const eventNonZero = (await sql`
    SELECT COUNT(1)::int AS n FROM (
      SELECT event_root_key
        FROM public.ledger_entry
       GROUP BY event_root_key
      HAVING COALESCE(SUM(delta + frozen_delta), 0) <> 0) t`) as Row[];

  // 孤儿分录（market 域）：分录指向不存在的业务行 ⇒ 必须 0
  const orphanOrder = (await sql`
    SELECT COUNT(1)::int AS n FROM public.ledger_entry e
     WHERE e.ref_type = 'market_order'
       AND NOT EXISTS (SELECT 1 FROM public.market_order o WHERE o.order_id = e.ref_id)`) as Row[];
  const orphanTrade = (await sql`
    SELECT COUNT(1)::int AS n FROM public.ledger_entry e
     WHERE e.ref_type = 'market_trade'
       AND NOT EXISTS (SELECT 1 FROM public.market_trade t WHERE t.trade_id = e.ref_id)`) as Row[];

  const orders = (await sql`
    SELECT order_id::text AS order_id, owner_uid::text AS owner_uid, side,
           base_cid::text AS base_cid, quote_cid::text AS quote_cid,
           price::text AS price, amount::text AS amount, amount_filled::text AS amount_filled,
           status, create_key, ledger_event_keys
      FROM public.market_order ORDER BY order_id`) as Row[];
  const trades = (await sql`
    SELECT trade_id::text AS trade_id, base_cid::text AS base_cid, quote_cid::text AS quote_cid,
           price::text AS price, amount::text AS amount,
           buy_order_id::text AS buy_order_id, sell_order_id::text AS sell_order_id,
           taker_uid::text AS taker_uid, fee::text AS fee, time_created::text AS time_created
      FROM public.market_trade ORDER BY trade_id`) as Row[];

  const currencies = (await sql`
    SELECT cid::text AS cid, symbol, status, owner_uid::text AS owner_uid, decimals::text AS decimals
      FROM public.currency ORDER BY cid`) as Row[];

  const policies = (await sql`
    SELECT policy_id::text AS policy_id, fee_rate_bp::int AS fee_rate_bp, levels::int AS levels,
           effective_from::text AS effective_from
      FROM public.commission_policy ORDER BY effective_from DESC`) as Row[];

  const counts = (await sql`
    SELECT (SELECT COUNT(1)::int FROM public.market_order) AS market_order_rows,
           (SELECT COUNT(1)::int FROM public.market_trade) AS market_trade_rows,
           (SELECT COUNT(1)::int FROM public.users) AS user_rows,
           (SELECT COUNT(1)::int FROM public.account) AS account_rows,
           (SELECT COUNT(1)::int FROM public.currency WHERE status = 'listed') AS currency_listed`) as Row[];

  const kinds: Record<string, number> = {};
  for (const r of byKind) kinds[String(r.kind)] = Number(r.n);
  const kindSum = Object.values(kinds).reduce((a, b) => a + b, 0);

  const out = {
    run: RUN, label, at: new Date().toISOString(), probe: 'p4z-b3e-01-snapshot',
    account: {
      rows: Number(totals[0].rows),
      sum_balance: String(totals[0].sum_balance),
      sum_frozen: String(totals[0].sum_frozen),
      sum_total: String(totals[0].sum_total),
      cid1: {
        rows: Number(totalsCid1[0].rows),
        sum_balance: String(totalsCid1[0].sum_balance),
        sum_frozen: String(totalsCid1[0].sum_frozen),
        sum_total: String(totalsCid1[0].sum_total),
      },
      negative_rows: Number(negative[0].n),
      per_row: accounts.map((a) => ({
        uid: String(a.uid), cid: String(a.cid), balance: String(a.balance),
        frozen: String(a.frozen), total: String(a.total),
      })),
    },
    ledger_entry: {
      total_rows: Number(ledgerTotal[0].n),
      by_kind: kinds,
      by_kind_sum: kindSum,
      by_kind_sum_equals_total: kindSum === Number(ledgerTotal[0].n),
      by_ref_type: byRefType.map((r) => ({ ref_type: String(r.ref_type), n: Number(r.n) })),
      by_ref_type_kind: byRefAndKind.map((r) => ({ ref_type: String(r.ref_type), kind: String(r.kind), n: Number(r.n) })),
      events_with_nonzero_sum: Number(eventNonZero[0].n),
      orphans_market_order: Number(orphanOrder[0].n),
      orphans_market_trade: Number(orphanTrade[0].n),
    },
    market_order: { rows: orders.length, per_row: orders },
    market_trade: { rows: trades.length, per_row: trades },
    currency: { rows: currencies.length, listed: Number(counts[0].currency_listed), per_row: currencies },
    commission_policy: { rows: policies.length, per_row: policies },
    counts: counts[0],
  };
  const file = path.join(outDir, `b3e-01-snapshot-${label}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite: ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log('WROTE ' + file);
  console.log('account_rows=' + out.account.rows + ' sum_balance=' + out.account.sum_balance
    + ' sum_frozen=' + out.account.sum_frozen + ' sum_total=' + out.account.sum_total
    + ' negative_rows=' + out.account.negative_rows);
  console.log('cid1 sum_balance=' + out.account.cid1.sum_balance + ' sum_frozen=' + out.account.cid1.sum_frozen
    + ' sum_total=' + out.account.cid1.sum_total);
  console.log('ledger_total=' + out.ledger_entry.total_rows + ' kind_sum=' + out.ledger_entry.by_kind_sum
    + ' events_nonzero=' + out.ledger_entry.events_with_nonzero_sum
    + ' orphans=' + (out.ledger_entry.orphans_market_order + out.ledger_entry.orphans_market_trade));
  console.log('market_order_rows=' + out.market_order.rows + ' market_trade_rows=' + out.market_trade.rows
    + ' policy_rows=' + out.commission_policy.rows + ' policy_bp=' + JSON.stringify(policies.map((p) => p.fee_rate_bp)));
  console.log('counts=' + JSON.stringify(out.counts));
  console.log('kinds=' + JSON.stringify(kinds));
  console.log('listed_currencies=' + JSON.stringify(currencies.filter((c) => c.status === 'listed').map((c) => String(c.cid))));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
