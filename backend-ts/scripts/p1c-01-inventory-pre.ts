/**
 * P1c 探针 1：清理前逐表盘点（只读）——purge-test-data.ts 的预测集依据
 */
import { readQuery, closePools } from '../src/db';

const main = async () => {
  const out: Record<string, unknown> = {};

  out.public_tables = await readQuery(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  );

  // 外键：谁引用了 account / currency / ledger_owner
  out.fks_referencing_ledger_objects = await readQuery(
    `SELECT conrelid::regclass::text AS child, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype='f' AND confrelid::regclass::text IN ('account','currency','ledger_owner','ledger_entry')
      ORDER BY 1,2`,
  );

  out.entry_by_uid_class = await readQuery(
    `SELECT CASE WHEN uid >= 900000 THEN 'test(>=900000)'
                 WHEN uid <= 0 THEN 'platform(<=0)'
                 ELSE 'other_real' END AS cls,
            count(*)::bigint n, min(txid)::text min_txid, max(txid)::text max_txid,
            count(*) FILTER (WHERE cid <> 1)::bigint rows_non_cid1
       FROM ledger_entry GROUP BY 1 ORDER BY 1`,
  );

  out.entry_by_cid = await readQuery(
    `SELECT e.cid, c.symbol, count(*)::bigint n,
            count(*) FILTER (WHERE e.uid >= 900000)::bigint test_uid,
            count(*) FILTER (WHERE e.uid <= 0)::bigint platform_uid
       FROM ledger_entry e JOIN currency c USING (cid)
      GROUP BY 1,2 ORDER BY 1`,
  );

  out.entry_test_uid_not_in_test_cid = await readQuery(
    `SELECT e.uid, e.cid, count(*)::bigint n FROM ledger_entry e
      WHERE e.uid >= 900000 GROUP BY 1,2 ORDER BY 1,2`,
  );

  out.account_uid_class = await readQuery(
    `SELECT CASE WHEN uid >= 900000 THEN 'test(>=900000)'
                 WHEN uid <= 0 THEN 'platform(<=0)'
                 ELSE 'other_real' END AS cls, count(*)::bigint n
       FROM account GROUP BY 1 ORDER BY 1`,
  );

  out.accounts_not_test = await readQuery(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid < 900000 ORDER BY uid, cid`,
  );

  out.ledger_owner_all = await readQuery(`SELECT uid, owner_type, name FROM ledger_owner ORDER BY uid`);

  out.currency_all = await readQuery(
    `SELECT cid, symbol, owner_uid, status FROM currency ORDER BY cid`,
  );

  out.predicted = await readQuery(
    `SELECT 'ledger_entry uid>=900000' AS bucket, count(*)::bigint n FROM ledger_entry WHERE uid >= 900000
     UNION ALL SELECT 'ledger_entry cid in test cids', count(*)::bigint FROM ledger_entry
        WHERE cid IN (SELECT cid FROM currency WHERE cid <> 1 AND (symbol LIKE 'qa1b%' OR symbol LIKE 'smk%'))
     UNION ALL SELECT 'account uid>=900000', count(*)::bigint FROM account WHERE uid >= 900000
     UNION ALL SELECT 'currency qa1b%/smk%', count(*)::bigint FROM currency
        WHERE cid <> 1 AND (symbol LIKE 'qa1b%' OR symbol LIKE 'smk%')
     UNION ALL SELECT 'ledger_owner uid>=900000', count(*)::bigint FROM ledger_owner WHERE uid >= 900000`,
  );

  // 预期「超出预测集」的行：test cid 内但 uid<=0 的流水（若存在必须显式批准）
  out.entries_in_test_cid_with_platform_uid = await readQuery(
    `SELECT txid, uid, cid, delta, frozen_delta, kind, idempotency_key FROM ledger_entry
      WHERE cid IN (SELECT cid FROM currency WHERE cid <> 1 AND (symbol LIKE 'qa1b%' OR symbol LIKE 'smk%'))
        AND uid < 900000 ORDER BY txid`,
  );

  out.last_currency_cid_seq = await readQuery(`SELECT last_value::text, is_called FROM currency_cid_seq`).catch(() => []);

  // 判据 8：剔除含 mint/burn 的事件后
  out.judgement_8_excl_mint_burn = await readQuery(
    `SELECT ref_type, ref_id, SUM(delta+frozen_delta)::text AS net
       FROM ledger_entry WHERE ref_type IS NOT NULL
        AND (ref_type, ref_id) NOT IN (
          SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL AND kind IN ('mint','burn')
        )
      GROUP BY 1,2 HAVING SUM(delta+frozen_delta) <> 0`,
  );

  // 判据 8：含 mint/burn 的事件，净额应等于净增发
  out.judgement_8_mint_burn_events = await readQuery(
    `SELECT e.ref_type, e.ref_id, SUM(e.delta+e.frozen_delta)::text AS net,
            SUM(CASE WHEN e.kind='mint' THEN e.delta WHEN e.kind='burn' THEN -e.delta ELSE 0 END)::text AS issuance
       FROM ledger_entry e WHERE e.ref_type IS NOT NULL
        AND (e.ref_type, e.ref_id) IN (SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL AND kind IN ('mint','burn'))
      GROUP BY 1,2 HAVING SUM(e.delta+e.frozen_delta) <> SUM(CASE WHEN e.kind='mint' THEN e.delta WHEN e.kind='burn' THEN -e.delta ELSE 0 END)`,
  );

  console.log(JSON.stringify(out, null, 2));
};

main()
  .catch((e) => {
    console.error('probe fatal:', String((e as Error)?.message || e).slice(0, 500));
    process.exitCode = 2;
  })
  .finally(async () => {
    await closePools();
  });
