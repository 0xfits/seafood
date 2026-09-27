/**
 * P1c 探针 0：库侧现状取证（只读）
 *   - ledger_entry.kind 的真实约束形态（PG enum 类型 vs CHECK 约束）
 *   - 是否存在被删 kind 的行 / 测试数据行数 / 判据 1、8 当前读数
 * 用法：npx ts-node --transpile-only scripts/p1c-00-probe-schema.ts
 */
import { readQuery, closePools } from '../src/db';

const main = async () => {
  const out: Record<string, unknown> = {};

  out.kind_column = await readQuery(
    `SELECT data_type, udt_name, is_nullable FROM information_schema.columns
      WHERE table_name='ledger_entry' AND column_name='kind'`,
  );

  out.enum_types_named_kind = await readQuery(
    `SELECT t.typname, t.typtype FROM pg_type t WHERE t.typname LIKE '%ledger_kind%' OR t.typname LIKE '%ledger%kind%'`,
  );

  out.check_constraints_on_ledger_entry = await readQuery(
    `SELECT conname, contype, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conrelid='ledger_entry'::regclass ORDER BY conname`,
  );

  out.rows_using_deleted_kinds = await readQuery(
    `SELECT kind, count(*)::bigint AS n FROM ledger_entry
      WHERE kind IN ('listing_deposit_refund','listing_deposit_forfeit') GROUP BY kind`,
  );

  out.table_counts = await readQuery(`
    SELECT 'ledger_entry' t, count(*)::bigint n FROM ledger_entry
    UNION ALL SELECT 'account', count(*)::bigint FROM account
    UNION ALL SELECT 'currency', count(*)::bigint FROM currency
    UNION ALL SELECT 'ledger_owner', count(*)::bigint FROM ledger_owner
    UNION ALL SELECT 'schema_migration', count(*)::bigint FROM schema_migration
  `);

  out.migrations = await readQuery(`SELECT version, name, checksum, applied_at FROM schema_migration ORDER BY version`);

  out.currencies = await readQuery(
    `SELECT cid, symbol, owner_uid, status FROM currency ORDER BY cid`,
  );

  out.test_accounts = await readQuery(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid >= 900000 ORDER BY uid, cid`,
  );

  out.trigger_state = await readQuery(
    `SELECT c.relname, t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE NOT t.tgisinternal AND c.relname IN ('ledger_entry','account') ORDER BY 1,2`,
  );

  // 判据 1
  out.judgement_1_hits = await readQuery(
    `SELECT a.uid,a.cid,a.balance,a.frozen,COALESCE(s.d,0) d,COALESCE(s.f,0) f
       FROM account a LEFT JOIN (SELECT uid,cid,SUM(delta) d,SUM(frozen_delta) f FROM ledger_entry GROUP BY uid,cid) s
       ON s.uid=a.uid AND s.cid=a.cid
      WHERE a.balance<>COALESCE(s.d,0) OR a.frozen<>COALESCE(s.f,0)`,
  );

  // 判据 8（v0.2 正式形状）
  out.judgement_8_hits = await readQuery(
    `SELECT ref_type, ref_id, SUM(delta+frozen_delta)::text AS net,
            count(*) FILTER (WHERE kind IN ('mint','burn')) AS mint_burn_rows
       FROM ledger_entry WHERE ref_type IS NOT NULL GROUP BY 1,2
      HAVING SUM(delta+frozen_delta) <> 0`,
  );

  out.ledger_kinds_distinct = await readQuery(
    `SELECT kind, count(*)::bigint n FROM ledger_entry GROUP BY kind ORDER BY kind`,
  );

  out.platform_accounts = await readQuery(
    `SELECT uid, cid, balance, frozen FROM account WHERE uid <= 0 ORDER BY uid, cid`,
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
