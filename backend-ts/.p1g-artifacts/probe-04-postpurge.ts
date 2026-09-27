/**
 * P1g · 清零后复核（**只读**，不新建任何数据）
 */
import { readQuery, closePools } from '../src/db';

(async () => {
  const dump = (l: string, r: any[]) => { console.log(`\n### ${l} (${r.length})`); r.forEach(x => console.log(JSON.stringify(x))); };

  dump('public_base_tables', await readQuery(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`));

  dump('public_base_table_count', await readQuery(`
    SELECT count(*)::text AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`));

  dump('base_table_named_users', await readQuery(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='users'`));

  dump('row_counts', await readQuery(`
    SELECT 'account' t, count(*)::text n FROM account
    UNION ALL SELECT 'currency', count(*)::text FROM currency
    UNION ALL SELECT 'ledger_entry', count(*)::text FROM ledger_entry
    UNION ALL SELECT 'ledger_owner', count(*)::text FROM ledger_owner
    UNION ALL SELECT 'schema_migration', count(*)::text FROM schema_migration
    UNION ALL SELECT 'users', count(*)::text FROM "users"
    ORDER BY 1`));

  // §11 判据 1：account.balance/frozen 必须等于该 (uid,cid) 的 Σdelta / Σfrozen_delta
  dump('judgement_1_hits', await readQuery(`
    SELECT a.uid::text, a.cid::text, a.balance::text, a.frozen::text,
           COALESCE(s.d,0)::text AS sum_delta, COALESCE(s.f,0)::text AS sum_frozen
      FROM account a LEFT JOIN (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM ledger_entry GROUP BY uid, cid) s
        ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`));

  dump('judgement_1_rowcount', await readQuery(`
    SELECT count(*)::text AS n FROM account a
      LEFT JOIN (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM ledger_entry GROUP BY uid, cid) s
        ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`));

  // §11 判据 8 · 口径 A（原样）：ref_type IS NOT NULL 分组的 Σ(delta+frozen_delta) = 0
  dump('judgement_8_hits_raw', await readQuery(`
    SELECT ref_type, ref_id::text, SUM(delta + frozen_delta)::text AS net
      FROM ledger_entry WHERE ref_type IS NOT NULL GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`));

  // §11 判据 8 · 口径 B（排除 mint/burn 组）
  dump('judgement_8_hits_excl_mint_burn', await readQuery(`
    SELECT ref_type, ref_id::text, SUM(delta + frozen_delta)::text AS net
      FROM ledger_entry WHERE ref_type IS NOT NULL
        AND (ref_type, ref_id) NOT IN (SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL AND kind IN ('mint','burn'))
     GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`));

  dump('judgement_8_rowcounts', await readQuery(`
    SELECT
      (SELECT count(*) FROM (
         SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL
          GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0) x)::text AS raw_n,
      (SELECT count(*) FROM (
         SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL
           AND (ref_type, ref_id) NOT IN (SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL AND kind IN ('mint','burn'))
          GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0) y)::text AS excl_n`));

  dump('currency_after_purge', await readQuery(`
    SELECT cid::text, symbol, name, total_supply::text, supply_cap::text, status, owner_uid::text, decimals::text
      FROM currency ORDER BY cid::bigint`));

  // cid=1 自洽：total_supply == Σ(mint) − Σ(burn)
  dump('cid1_reconcile_check', await readQuery(`
    SELECT c.cid::text AS cid, c.symbol,
           c.total_supply::text AS total_supply,
           COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)::text AS sum_mint,
           COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0)::text AS sum_burn,
           (COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)
            - COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0))::text AS sum_mint_minus_burn,
           (c.total_supply = COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)
                            - COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0))::text AS cid1_consistent,
           count(e.*)::text AS residue_entry_count
      FROM currency c LEFT JOIN ledger_entry e ON e.cid = c.cid
     WHERE c.cid = 1 GROUP BY c.cid, c.symbol, c.total_supply`));

  dump('all_cids_consistent', await readQuery(`
    SELECT count(*)::text AS inconsistent_cids FROM (
      SELECT c.cid FROM currency c LEFT JOIN ledger_entry e ON e.cid=c.cid
       GROUP BY c.cid, c.total_supply
      HAVING c.total_supply <> COALESCE(SUM(e.delta) FILTER (WHERE e.kind='mint'),0)
                              - COALESCE(SUM(e.delta) FILTER (WHERE e.kind='burn'),0)) z`));

  dump('platform_accounts', await readQuery(`
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account
     WHERE uid::bigint IN (0,-1,-2,-3) ORDER BY uid::bigint`));

  dump('any_nonzero_balance', await readQuery(`
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account
     WHERE balance <> 0 OR frozen <> 0`));

  dump('ledger_owner_untouched', await readQuery(`SELECT uid::text, owner_type, name FROM ledger_owner ORDER BY uid::bigint`));

  dump('schema_migration_rows', await readQuery(`SELECT version, name, applied_at FROM schema_migration ORDER BY version`));

  dump('schema_version', await readQuery(`SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1`));

  dump('trigger_state', await readQuery(`
    SELECT c.relname, t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE NOT t.tgisinternal ORDER BY 1,2`));

  dump('objects_named_like_user', await readQuery(`
    SELECT c.relkind, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND (c.relname LIKE '%user%' OR c.relname LIKE '%users%') ORDER BY 1,2`));
})().catch(e => { console.error('postpurge fatal:', String((e as Error)?.message || e)); process.exitCode = 2; })
  .finally(async () => { await closePools(); });
