-- ============================================================================
-- 0070_drop_job_domain.sql · 招工（job）域**整体退场**：四表 + 全部附属对象一并删除
-- ============================================================================
-- 权威口径：Kevin 2026-10-21 裁定「job 下线手术」· 清单真源
--   `ops/job-removal/inventory-raw.json`（dev 库实测：4 表 / 20 索引 / 13 触发器 /
--   17 函数 / 10 FK）· 说明 `ops/job-removal/INVENTORY.md` / `REPORT.md`。
--
-- 本迁移做什么（**纯删除**，无新对象、无回填）
--   ① 按**依赖逆序** `DROP TABLE IF EXISTS`：
--        job_arbitration_log（FK→job）→ job_submission（FK→job）→ job_application（FK→job）→ job（头表）
--      索引（20）/ 触发器（13）/ 名内约束（58）皆随表 DROP 自动消失，**不单独写 DROP**；
--      触发函数与编排函数（17）不随表走 ⇒ 显式 `DROP FUNCTION IF EXISTS`（带形参签名，
--      以避免与同名不同签重载混淆）。
--   ② 尾部 apply-time 自检（DO 块）：四表 `to_regclass` 必须全 NULL、
--      且 `users` / `ledger_entry` / `listing` 三张**必须留存**的表仍 `NOT NULL`；
--      任一不符 ⇒ RAISE ⇒ 整文件回滚、不写版本行。
--
-- 本迁移**不**做什么（硬边界）
--   · 不删 `content_translation` 里 `entity_type='job'` 的孤儿译文行（跨域共享表；
--     读侧 `I18N_SPECS` 已无 `job` 键 ⇒ 这些行**不可达**，留待单独数据单清理）；
--   · 不动 `users` / `account` / `ledger_entry` / `listing*` / `project*` / `campaign*` 任何行与结构；
--   · 不释放 45 / 19 / 40 条历史业务行（job / job_application / job_submission）——
--     它们是**本迁移的删除对象**，删除前已由 `inventory-raw.json` 留档计数；
--   · 不改任何既有迁移文件（checksum 冻结）。
--
-- 文件形状纪律（与 0057–0069 同族）
--   · 文件内不写 BEGIN / COMMIT（`scripts/migrate.ts` 逐文件包事务）；
--   · 注释里不出现成对美元定界符字面 ⇒ 统一写「DO 块」；
--   · 幂等：全部 `IF EXISTS` ⇒ 反复 apply 落同一终态（第二次全为 no-op，自检仍通过）。
-- ============================================================================

-- ============================================================================
-- ① 四表（依赖逆序）
-- ============================================================================
DROP TABLE IF EXISTS public.job_arbitration_log;
DROP TABLE IF EXISTS public.job_submission;
DROP TABLE IF EXISTS public.job_application;
DROP TABLE IF EXISTS public.job;

-- ============================================================================
-- ② 函数（13 个触发器函数 + 4 个业务编排/谓词函数 = 17）
--    签名逐字取自 inventory-raw.json（`pg_proc.proname / pg_get_function_arguments`）
-- ============================================================================
-- ②-1 job 头表触发器函数
DROP FUNCTION IF EXISTS public.job_core_immutable_guard();
DROP FUNCTION IF EXISTS public.job_ledger_ref_guard();
DROP FUNCTION IF EXISTS public.job_no_delete();
DROP FUNCTION IF EXISTS public.job_status_guard();
DROP FUNCTION IF EXISTS public.job_touch_time_updated();
DROP FUNCTION IF EXISTS public.job_status_transition_ok(text, text);

-- ②-2 job_application 触发器函数
DROP FUNCTION IF EXISTS public.job_application_create_key_guard();
DROP FUNCTION IF EXISTS public.job_application_no_delete();
DROP FUNCTION IF EXISTS public.job_application_status_guard();
DROP FUNCTION IF EXISTS public.job_application_touch_time_updated();
DROP FUNCTION IF EXISTS public.job_application_status_transition_ok(text, text);

-- ②-3 job_arbitration_log 触发器函数
DROP FUNCTION IF EXISTS public.job_arbitration_log_append_only();
DROP FUNCTION IF EXISTS public.job_arbitration_log_no_truncate();

-- ②-4 job_submission 触发器函数
DROP FUNCTION IF EXISTS public.job_submission_immutable_guard();
DROP FUNCTION IF EXISTS public.job_submission_no_delete();

-- ②-5 业务编排 / 结算计划（原 job_post_event 单函数 = 招工唯一资金写路径）
DROP FUNCTION IF EXISTS public.job_post_event(jsonb);
DROP FUNCTION IF EXISTS public.job_settle_plan(bigint, bigint, bigint, bigint, bigint);

-- ============================================================================
-- ③ apply-time 自检（失败 ⇒ RAISE ⇒ 整文件回滚）
-- ============================================================================
DO $do$
DECLARE
  v_left text;
BEGIN
  -- ③-1 四表必须已不存在
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_left
    FROM unnest(ARRAY['job', 'job_application', 'job_submission', 'job_arbitration_log']) AS t
   WHERE to_regclass('public.' || t) IS NOT NULL;
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION '0070 self-check FAILED: job-domain tables still present: %', v_left;
  END IF;

  -- ③-2 同域函数必须已不存在（防「表删了函数还在」的半截终态）
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_left
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'job\_%';
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION '0070 self-check FAILED: job-domain functions still present: %', v_left;
  END IF;

  -- ③-3 必须留存的三张邻接表仍在（本迁移不得误伤）
  SELECT string_agg(t, ', ' ORDER BY t) INTO v_left
    FROM unnest(ARRAY['users', 'ledger_entry', 'listing']) AS t
   WHERE to_regclass('public.' || t) IS NULL;
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION '0070 self-check FAILED: neighbour tables missing: %', v_left;
  END IF;

  RAISE NOTICE '0070 OK: job domain dropped (4 tables / 17 functions); users, ledger_entry, listing intact';
END
$do$;
