-- ops/uid-renumber-2026-10-24/preflight.sql
-- 迁移前机读快照（§40.17.6 UR6 A 表「元数据」组）：输出**单个 JSON 文档**（stdout ⇒ preflight.json）。
-- 只读；不改库。由 backup.sh 调用：psql -At -f preflight.sql > preflight.json
WITH fk AS (
  SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.conname,
         c.condeferrable, c.condeferred
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) k ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
   WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
), trg AS (
  SELECT t.tgname, t.tgenabled::text AS tgenabled, t.tgrelid::regclass::text AS tbl
    FROM pg_trigger t
   WHERE NOT t.tgisinternal
     AND (t.tgname LIKE 'trg_%_append_only'
          OR t.tgname IN ('trg_batt_account_user_fk', 'trg_account_guard',
                          'trg_ledger_entry_no_truncate', 'trg_ledger_entry_commission_conservation'))
), tabs AS (
  SELECT unnest(ARRAY['users','ledger_entry','account','ledger_owner','currency','app_config','schema_migration',
                      'batt_entry','batt_account','listing_edit_log','campaign_task_reward_pending',
                      'admin_ops_audit_log','admin_refund_audit_log','admin_user_role','checkin_log',
                      'checkin_makeup_log','conversation','currency_review_log','currency_status_log',
                      'listing','listing_favorite','listing_order','listing_order_event','listing_review_log',
                      'market_order','market_trade','media','message','project','project_wage_claim',
                      'project_worker','rating','referral','subtask_proof','user_activity_hour']) AS t
), counts AS (
  SELECT jsonb_object_agg(t, n ORDER BY t) AS j FROM (
    SELECT t, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', t), false, true, '')))[1]::text::bigint AS n
      FROM tabs) s
)
SELECT jsonb_pretty(jsonb_build_object(
  'generated_at', now(),
  'database', current_database(),
  'server_version', version(),
  'users_count', (SELECT count(*) FROM public.users),
  'users_min_uid', (SELECT min(uid) FROM public.users),
  'users_max_uid', (SELECT max(uid) FROM public.users),
  'real_account', (SELECT jsonb_build_object('uid', uid, 'evm', lower(evm), 'is_admin', is_admin)
                     FROM public.users WHERE lower(evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'),
  'fk_users_count_live_NM1', (SELECT count(*) FROM fk),
  'fk_users', (SELECT jsonb_agg(jsonb_build_object('table', tbl, 'column', col, 'constraint', conname,
                                                 'deferrable', condeferrable, 'deferred', condeferred) ORDER BY tbl, col) FROM fk),
  'triggers', (SELECT jsonb_agg(jsonb_build_object('trigger', tgname, 'table', tbl, 'tgenabled', tgenabled) ORDER BY tgname) FROM trg),
  'users_uid_seq', (SELECT jsonb_build_object('name', 'users_uid_seq', 'last_value', last_value, 'is_called', is_called)
                      FROM public.users_uid_seq),
  'schema_migration', (SELECT jsonb_agg(jsonb_build_object('version', version, 'name', name, 'applied_at', applied_at) ORDER BY version)
                         FROM public.schema_migration),
  'schema_migration_max_version', (SELECT max(version) FROM public.schema_migration),
  'row_counts', (SELECT j FROM counts),
  'ledger', (SELECT jsonb_build_object(
               'rows', count(*),
               'sum_delta', sum(delta),
               'sum_frozen_delta', sum(frozen_delta),
               'by_cid', (SELECT jsonb_object_agg(cid::text, d ORDER BY cid) FROM (SELECT cid, sum(delta) d FROM public.ledger_entry GROUP BY cid) x),
               'uid_lt_0_rows', count(*) FILTER (WHERE uid < 0))
             FROM public.ledger_entry),
  'account', (SELECT jsonb_build_object(
                'rows', count(*),
                'uid_le_0_rows', count(*) FILTER (WHERE uid <= 0),
                'drift_rows_all', (SELECT count(*) FROM public.account a
                                    WHERE ROW(a.balance, a.frozen) IS DISTINCT FROM (
                                          SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
                                           WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)),
                'drift_rows_migrated_NM2', (SELECT count(*) FROM public.account a
                                             WHERE a.uid > 0 AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
                                               AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
                                                     SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
                                                      WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)),
                'drift_detail_NM2', (SELECT coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'cid', cid, 'balance', balance, 'frozen', frozen,
                                                     'ledger_rows', (SELECT count(*) FROM public.ledger_entry e WHERE e.uid = a.uid AND e.cid = a.cid)) ORDER BY uid), '[]'::jsonb)
                                       FROM public.account a
                                      WHERE a.uid > 0 AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
                                        AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
                                              SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
                                               WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)))
              FROM public.account),
  'orphans_NM3', (SELECT jsonb_build_object(
                    'ledger_entry_rows_uid_not_in_users', (SELECT count(*) FROM public.ledger_entry e
                                                            WHERE e.uid > 0 AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.uid = e.uid)),
                    'ledger_entry_distinct_uids', (SELECT count(DISTINCT uid) FROM public.ledger_entry e
                                                     WHERE e.uid > 0 AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.uid = e.uid)),
                    'account_rows_uid_not_in_users', (SELECT count(*) FROM public.account a
                                                       WHERE a.uid > 0 AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)),
                    'batt_entry_rows_uid_not_in_users', (SELECT count(*) FROM public.batt_entry b
                                                          WHERE b.uid > 0 AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.uid = b.uid)))),
  'app_config_updated_by_hits_NM7', (SELECT count(*) FROM public.app_config WHERE updated_by IN (SELECT uid FROM public.users)),
  'users_cols', (SELECT jsonb_agg(jsonb_build_object('column', column_name, 'type', data_type, 'identity', is_identity) ORDER BY ordinal_position)
                   FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users')
)) AS preflight;
