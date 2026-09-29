/**
 * p4z-qa-b3-01-conserve.ts — QA-B3 腿1：资金守恒**独立重算** + 分录倍数 + 负余额
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qa-b3-01-conserve.ts <outDir>
 * 口径（§5.7）：只读（只 SELECT）；产物 run-tagged 绝对路径；同名拒写。
 * 独立重算（**不信自报**）：
 *   A. 逐行 dump `public.account` ⇒ 脚本内自己累加 Σbalance/Σfrozen/Σtotal（并与 SQL 聚合对拍）
 *   B. 从 `ledger_entry` 独立推导期望：Σtotal 应 = Σ(mint 票面) − Σ(burn 票面)
 *      （mint 分录 delta = 铸币票面净增；burn delta = 负值）——逐币种 + 总计
 *   C. ledger_entry 总行数 == 逐 kind 计数之和
 *   D. 每类 kind 的预期倍数（同键事件的分录数）
 *   E. 负余额行 == 0；账户级漂移（balance vs Σdelta）
 *   F. 逐事件 Σ(delta+frozen_delta) != 0 的根键数（有 mint/burn 的事件除外）
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
const label = process.argv[3] || 'main';
if (!process.argv[2]) throw new Error('usage: <outDir> [label]');
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const RUN = path.basename(outDir);
type Row = Record<string, unknown>;

const EXPECTED_MULT: Record<string, number> = {
  // 同账户 ×2（hold 家族）
  hold: 2, hold_release: 2, job_escrow: 2, job_escrow_refund: 2,
  // 双账户对称
  trade: 4, trade_fee: 2, purchase: 2, sale: 2, purchase_refund: 2,
  currency_create_fee: 2, listing_deposit: 2,
  job_payout: 2, job_fee: 2, commission: 2, transfer: 2, hold_forfeit: 2,
  // 单条
  mint: 1, burn: 1, listing_fee: 2, reversal: 1,
};

async function main() {
  // A. 逐行 dump + 脚本内自算
  const accRows = (await sql`
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
      FROM public.account ORDER BY uid, cid`) as Row[];
  let sumBal = 0n, sumFro = 0n;
  const perCid: Record<string, { bal: bigint; fro: bigint; rows: number }> = {};
  let negRows = 0;
  for (const r of accRows) {
    const b = BigInt(String(r.balance)), f = BigInt(String(r.frozen));
    sumBal += b; sumFro += f;
    if (b < 0n || f < 0n) negRows += 1;
    const c = String(r.cid);
    perCid[c] = perCid[c] || { bal: 0n, fro: 0n, rows: 0 };
    perCid[c].bal += b; perCid[c].fro += f; perCid[c].rows += 1;
  }
  const sumTotal = sumBal + sumFro;

  // 与 SQL 聚合对拍（口径互证）
  const agg = (await sql`
    SELECT COUNT(1)::int AS rows, COALESCE(SUM(balance),0)::text AS sb,
           COALESCE(SUM(frozen),0)::text AS sf, COALESCE(SUM(balance+frozen),0)::text AS st
      FROM public.account`) as Row[];

  // B. 从 ledger_entry 独立推导期望铸币票面
  const mintBurn = (await sql`
    SELECT cid::text AS cid, kind, COALESCE(SUM(delta),0)::text AS s, COUNT(1)::int AS n
      FROM public.ledger_entry WHERE kind IN ('mint','burn')
     GROUP BY cid, kind ORDER BY cid, kind`) as Row[];
  const derived: Record<string, { mint: bigint; burn: bigint; mintN: number; burnN: number }> = {};
  for (const r of mintBurn) {
    const c = String(r.cid);
    derived[c] = derived[c] || { mint: 0n, burn: 0n, mintN: 0, burnN: 0 };
    if (String(r.kind) === 'mint') { derived[c].mint = BigInt(String(r.s)); derived[c].mintN = Number(r.n); }
    else { derived[c].burn = BigInt(String(r.s)); derived[c].burnN = Number(r.n); }
  }
  const derivedTotal = Object.values(derived).reduce((a, d) => a + d.mint + d.burn, 0n);
  const cid1 = derived['1'] || { mint: 0n, burn: 0n, mintN: 0, burnN: 0 };
  const derivedTotalCid1 = cid1.mint + cid1.burn;

  // C/D. 逐 kind 计数
  const byKind = (await sql`
    SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry GROUP BY kind ORDER BY kind`) as Row[];
  const kinds: Record<string, number> = {};
  for (const r of byKind) kinds[String(r.kind)] = Number(r.n);
  const kindSum = Object.values(kinds).reduce((a, b) => a + b, 0);
  const totalRows = (await sql`SELECT COUNT(1)::int AS n FROM public.ledger_entry`) as Row[];
  const total = Number(totalRows[0].n);

  // D2. 逐事件分录数（按 event_root_key）——用于核「每类 kind 的预期倍数」
  const perEvent = (await sql`
    SELECT event_root_key, COUNT(1)::int AS n, array_agg(kind ORDER BY txid)::text AS kinds
      FROM public.ledger_entry GROUP BY event_root_key
     HAVING COUNT(1) > 0 ORDER BY n DESC`) as Row[];

  // E2. 账户级漂移（balance vs Σdelta）——应 0 行
  const drift = (await sql`
    SELECT a.uid::text AS uid, a.cid::text AS cid, a.balance::text AS balance,
           COALESCE(s.d,0)::text AS sum_delta, a.frozen::text AS frozen, COALESCE(s.f,0)::text AS sum_frozen
      FROM public.account a
      LEFT JOIN (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM public.ledger_entry GROUP BY uid, cid) s
             ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`) as Row[];

  // F. 逐事件 net != 0（排除含 mint/burn 的事件）
  const evNonZero = (await sql`
    SELECT COUNT(1)::int AS n FROM (
      SELECT event_root_key FROM public.ledger_entry
       GROUP BY event_root_key
      HAVING COALESCE(SUM(delta + frozen_delta),0) <> 0
         AND COUNT(1) FILTER (WHERE kind IN ('mint','burn')) = 0) t`) as Row[];

  // G. 约束存在性（23514 结构闸）
  const cons = (await sql`
    SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.account'::regclass AND contype = 'c'`) as Row[];
  const negCons = cons.filter((c) => String(c.def).includes('< 0') || String(c.def).includes('>= 0'));

  const out = {
    run: RUN, at: new Date().toISOString(), probe: 'p4z-qa-b3-01-conserve',
    account: {
      rows: accRows.length,
      recomputed_sum_balance: sumBal.toString(),
      recomputed_sum_frozen: sumFro.toString(),
      recomputed_sum_total: sumTotal.toString(),
      sql_agg: {
        rows: Number(agg[0].rows), sum_balance: String(agg[0].sb),
        sum_frozen: String(agg[0].sf), sum_total: String(agg[0].st),
      },
      recompute_matches_sql: sumBal.toString() === String(agg[0].sb) && sumFro.toString() === String(agg[0].sf),
      negative_rows: negRows,
      per_cid: Object.fromEntries(Object.entries(perCid).map(([k, v]) => [k, { rows: v.rows, bal: v.bal.toString(), fro: v.fro.toString(), total: (v.bal + v.fro).toString() }])),
      negative_constraints: negCons.map((c) => ({ conname: String(c.conname), def: String(c.def) })),
    },
    ledger: {
      total_rows: total,
      by_kind: kinds,
      by_kind_sum: kindSum,
      kind_sum_equals_total: kindSum === total,
      expected_mult: EXPECTED_MULT,
      per_event_count_hist: Object.entries(
        perEvent.reduce((a: Record<string, number>, r) => { const k = String(Number(r.n)); a[k] = (a[k] || 0) + 1; return a; }, {}),
      ).map(([n, c]) => ({ entries_per_event: Number(n), events: Number(c) })),
      events_nonzero_excl_mint_burn: Number(evNonZero[0].n),
      per_event: perEvent.map((e) => ({ root_key: String(e.event_root_key), n: Number(e.n), kinds: String(e.kinds) })),
      account_drift_rows: drift.length,
      drift_detail: drift.map((d) => ({ uid: String(d.uid), cid: String(d.cid), balance: String(d.balance), sum_delta: String(d.sum_delta), frozen: String(d.frozen), sum_frozen: String(d.sum_frozen) })),
    },
    derived_expected: {
      per_cid: Object.fromEntries(Object.entries(derived).map(([k, v]) => [k, { mint: v.mint.toString(), burn: v.burn.toString(), net: (v.mint + v.burn).toString(), mint_entries: v.mintN, burn_entries: v.burnN }])),
      derived_total_all_cid: derivedTotal.toString(),
      derived_total_cid1: derivedTotalCid1.toString(),
      matches_account_sum_total: derivedTotal.toString() === sumTotal.toString(),
    },
  };
  const file = path.join(outDir, `qa-b3-01-conserve-${label}.json`);
  if (fs.existsSync(file)) throw new Error('refuse to overwrite: ' + file);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log('WROTE ' + file);
  console.log('account rows=' + out.account.rows + ' RECOMPUTED sum_balance=' + out.account.recomputed_sum_balance
    + ' sum_frozen=' + out.account.recomputed_sum_frozen + ' sum_total=' + out.account.recomputed_sum_total);
  console.log('sql_agg sb=' + out.account.sql_agg.sum_balance + ' sf=' + out.account.sql_agg.sum_frozen
    + ' st=' + out.account.sql_agg.sum_total + ' match=' + out.account.recompute_matches_sql);
  console.log('derived_total=' + out.derived_expected.derived_total_all_cid + ' derived_cid1=' + out.derived_expected.derived_total_cid1
    + ' matches=' + out.derived_expected.matches_account_sum_total);
  console.log('ledger_total=' + total + ' kind_sum=' + kindSum + ' eq=' + out.ledger.kind_sum_equals_total);
  console.log('negative_rows=' + negRows + ' drift_rows=' + drift.length + ' ev_nonzero_excl_mintburn=' + out.ledger.events_nonzero_excl_mint_burn);
  console.log('kinds=' + JSON.stringify(kinds));
  console.log('per_event_hist=' + JSON.stringify(out.ledger.per_event_count_hist));
}

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
