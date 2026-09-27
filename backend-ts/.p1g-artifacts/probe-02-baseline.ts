/**
 * P1g · 基线读数（改名前 / 清零前），只读
 */
import { readQuery, closePools } from '../src/db';

(async () => {
  const dump = (l: string, r: any[]) => { console.log(`\n### ${l} (${r.length})`); r.forEach(x => console.log(JSON.stringify(x))); };

  dump('public_base_tables', await readQuery(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`));

  dump('schema_migration', await readQuery(`SELECT version, name, applied_at FROM schema_migration ORDER BY version`));

  dump('counts', await readQuery(`
    SELECT 'ledger_entry' t, count(*)::text n FROM ledger_entry
    UNION ALL SELECT 'account', count(*)::text FROM account
    UNION ALL SELECT 'currency', count(*)::text FROM currency
    UNION ALL SELECT 'ledger_owner', count(*)::text FROM ledger_owner
    UNION ALL SELECT 'schema_migration', count(*)::text FROM schema_migration
    UNION ALL SELECT 'user', count(*)::text FROM "user"
    ORDER BY 1`));

  dump('currency_all', await readQuery(`
    SELECT cid::text, symbol, name, total_supply::text, decimals::text, status, owner_uid::text
      FROM currency ORDER BY cid::bigint`));

  dump('currency_vs_sum_mint_burn', await readQuery(`
    SELECT c.cid::text AS cid, c.symbol,
           c.total_supply::text AS total_supply,
           COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)::text AS sum_mint,
           COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0)::text AS sum_burn,
           (COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)
            - COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0))::text AS mint_minus_burn,
           (c.total_supply - (COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)
            - COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0)))::text AS drift
      FROM currency c LEFT JOIN ledger_entry e ON e.cid = c.cid
     GROUP BY c.cid, c.symbol, c.total_supply ORDER BY c.cid::bigint`));

  dump('accounts_all', await readQuery(`
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account ORDER BY uid::bigint, cid::bigint`));

  dump('platform_accounts', await readQuery(`
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account
     WHERE uid::bigint IN (0,-1,-2,-3) ORDER BY uid::bigint, cid::bigint`));

  dump('ledger_owner_all', await readQuery(`SELECT uid::text, owner_type, name FROM ledger_owner ORDER BY uid::bigint`));

  dump('judgement_1_hits', await readQuery(`
    SELECT a.uid::text, a.cid::text, a.balance::text, a.frozen::text,
           COALESCE(s.d,0)::text AS sum_delta, COALESCE(s.f,0)::text AS sum_frozen
      FROM account a LEFT JOIN (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM ledger_entry GROUP BY uid, cid) s
        ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`));

  dump('judgement_8_hits', await readQuery(`
    SELECT ref_type, ref_id::text, SUM(delta + frozen_delta)::text AS net
      FROM ledger_entry WHERE ref_type IS NOT NULL GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`));

  dump('judgement_8_hits_excl_mint_burn', await readQuery(`
    SELECT ref_type, ref_id::text, SUM(delta + frozen_delta)::text AS net
      FROM ledger_entry WHERE ref_type IS NOT NULL
        AND (ref_type, ref_id) NOT IN (SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL AND kind IN ('mint','burn'))
     GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`));

  // 预测集：现有测试 cid / uid
  dump('test_cids_now', await readQuery(`
    SELECT cid::text, symbol FROM currency WHERE cid <> 1 AND (
      symbol ILIKE 'qa1b%' OR symbol ILIKE 'smk%' OR symbol ILIKE 'p1e%' OR symbol ILIKE 'p1f%' OR symbol ILIKE 'p1g%'
      OR symbol ILIKE 'p1h%' OR symbol ILIKE 'p1i%' OR symbol ILIKE 'p1j%' OR symbol ILIKE 'p1k%' OR symbol ILIKE 'qae%')
     ORDER BY cid::bigint`));

  dump('test_uids_now', await readQuery(`SELECT uid::text, count(*)::text AS n FROM account WHERE uid::bigint >= 900000 GROUP BY uid ORDER BY uid::bigint`));

  dump('test_entries_now', await readQuery(`SELECT count(*)::text AS n FROM ledger_entry WHERE uid::bigint >= 900000`));

  dump('all_currency_symbols', await readQuery(`SELECT cid::text, symbol FROM currency ORDER BY cid::bigint`));
})().catch(e => { console.error('baseline fatal:', String((e as Error)?.message || e)); process.exitCode = 2; })
  .finally(async () => { await closePools(); });
