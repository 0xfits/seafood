-- ============================================================================
-- 0043_truncate_guard.sql · 台账 B9 · append-only 真实边界补齐
--   （给全部 append-only 表补 BEFORE TRUNCATE 守卫 —— 封堵 TRUNCATE 零保护缺口）
-- ============================================================================
-- 背景（台账 B9 · 早期已登记）：
--   既有 append-only 守卫一律是 **`BEFORE UPDATE OR DELETE` 行级（`FOR EACH ROW`）** 触发器
--   （逐表清单见下）⇒ 阻断 UPDATE / DELETE，但对 **`TRUNCATE`** **零保护**：
--   `TRUNCATE` 是 **语句级 / `TRUNCATE` 事件**，**不触发行级触发器** ⇒ 可一句清空 append-only 表。
--   既有各迁移的诚实边界注释亦逐处自陈「不拦 TRUNCATE」（如 `0016:189` / `0023:122` /
--   `0029:97` / `0031:55` …）。⇒ 「append-only 已绝对保证」的表述不成立；本迁移补
--   `BEFORE TRUNCATE` 守卫收口该缺口。
--
-- 权威口径：本迁移只**兑现**「append-only 表须对 `TRUNCATE` 亦设闸」这一既有登记缺口，
--   **不**引入新错误码 / **不**改任何既有对象 / **不**动任何函数体。
--
-- 受保护对象（**15 张 append-only 表** · 文件面「建它的迁移:行 + 触发器名」与库面
--   `pg_trigger`（`tgenabled='O'`）**双口径逐表一致**，见 `docs/audit/s09-truncate-guard-migration.md`）：
--   · `0001:125` ledger_entry            :: trg_ledger_entry_append_only
--   · `0007:75`  referral                :: trg_referral_append_only
--   · `0007:110` commission_policy       :: trg_commission_policy_append_only
--   · `0016:359` market_trade            :: trg_market_trade_append_only
--   · `0017:237` currency_status_log     :: trg_currency_status_log_append_only
--   · `0023:125` admin_ops_audit_log     :: trg_admin_ops_audit_log_append_only
--   · `0024:100` admin_refund_audit_log  :: trg_admin_refund_audit_log_append_only
--   · `0025:90`  currency_review_log     :: trg_currency_review_log_append_only
--   · `0026:95`  listing_review_log      :: trg_listing_review_log_append_only
--   · `0027:99`  job_arbitration_log     :: trg_job_arbitration_log_append_only
--   · `0029:256` batt_entry              :: trg_batt_entry_append_only
--   · `0029:261` checkin_log             :: trg_checkin_log_append_only
--   · `0029:266` checkin_makeup_log      :: trg_checkin_makeup_log_append_only
--   · `0031:171` rating                  :: trg_rating_append_only
--   · `0031:176` listing_order_event     :: trg_listing_order_event_append_only
--
-- 手法（沿用本仓既有 append-only 守卫的风格）：
--   · 函数：`public.<table>_no_truncate()` · `LANGUAGE plpgsql` · 原生 `RAISE EXCEPTION`
--     （默认 `SQLSTATE = P0001`，**不借账本错误码** —— 与 `0001:119` / `0023:114` /
--     `0029:215` / `0031:146` 的 append-only 守卫**同形**）。
--   · 触发器：`CREATE TRIGGER trg_<table>_no_truncate BEFORE TRUNCATE ON public.<table>
--     FOR EACH STATEMENT EXECUTE FUNCTION public.<table>_no_truncate();`
--     （★ `FOR EACH STATEMENT` —— `TRUNCATE` **不支持行级**触发器，故**非** `FOR EACH ROW`）。
--   · 命名沿 `_no_delete` 家族（如 `0013` 的 `job_no_delete` / `trg_job_no_delete`）：既有
--     `_append_only` 名**不可复用**（`CREATE OR REPLACE` 会覆写既有函数体 ⇒ 硬禁）；
--     本闸用新名 `<table>_no_truncate`。
--
-- 本迁移**不**做什么（硬边界）：
--   · **不改 `0001`–`0042` 任何文件字节**（checksum 冻结；`migrate.ts` 会整链 ABORT / exit 3）
--   · **不动任何既有函数体**（只新建 `_no_truncate()`）；**不 `ALTER` 任何既有对象**；
--     **不删任何既有对象**（`DROP TRIGGER IF EXISTS` 仅针对本迁移新建的 `trg_*_no_truncate`，
--     首次 apply 时为无操作）
--   · 不新增列 / 表 / 错误码；不写任何业务数据（**纯 DDL**）
--
-- 幂等（DL48）：`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`
--   + 末尾 apply-time `DO` 自检；任一失败 ⇒ 整迁移回滚、**不写版本行**。
-- ============================================================================


-- ============================================================================
-- §① 守卫函数（15 枚 · 体内**无任何 DDL**；仅 `RAISE EXCEPTION`）
-- ----------------------------------------------------------------------------
--   `TRUNCATE` 为语句级事件，无 `OLD` 行 ⇒ 错误消息不含 `OLD.<pk>`（对比既有
--   append-only 守卫含 `COALESCE(OLD.<pk>, 0)`）；保留既有 `% forbidden` + `TG_OP` 形态。
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ledger_entry_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entry is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.referral_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'referral is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.commission_policy_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'commission_policy is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.market_trade_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'market_trade is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.currency_status_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'currency_status_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ops_audit_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_ops_audit_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_refund_audit_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_refund_audit_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.currency_review_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'currency_review_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.listing_review_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'listing_review_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.job_arbitration_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'job_arbitration_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.batt_entry_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'batt_entry is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'checkin_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_makeup_log_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'checkin_makeup_log is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.rating_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'rating is append-only: % forbidden', TG_OP;
END $$;

CREATE OR REPLACE FUNCTION public.listing_order_event_no_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'listing_order_event is append-only: % forbidden', TG_OP;
END $$;


-- ============================================================================
-- §② 触发器挂载（15 枚 · 幂等：`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`）
--   每枚 = `BEFORE TRUNCATE` · **`FOR EACH STATEMENT`**（TRUNCATE 不支持行级）
-- ============================================================================
DROP TRIGGER IF EXISTS trg_ledger_entry_no_truncate ON public.ledger_entry;
CREATE TRIGGER trg_ledger_entry_no_truncate
  BEFORE TRUNCATE ON public.ledger_entry
  FOR EACH STATEMENT EXECUTE FUNCTION public.ledger_entry_no_truncate();

DROP TRIGGER IF EXISTS trg_referral_no_truncate ON public.referral;
CREATE TRIGGER trg_referral_no_truncate
  BEFORE TRUNCATE ON public.referral
  FOR EACH STATEMENT EXECUTE FUNCTION public.referral_no_truncate();

DROP TRIGGER IF EXISTS trg_commission_policy_no_truncate ON public.commission_policy;
CREATE TRIGGER trg_commission_policy_no_truncate
  BEFORE TRUNCATE ON public.commission_policy
  FOR EACH STATEMENT EXECUTE FUNCTION public.commission_policy_no_truncate();

DROP TRIGGER IF EXISTS trg_market_trade_no_truncate ON public.market_trade;
CREATE TRIGGER trg_market_trade_no_truncate
  BEFORE TRUNCATE ON public.market_trade
  FOR EACH STATEMENT EXECUTE FUNCTION public.market_trade_no_truncate();

DROP TRIGGER IF EXISTS trg_currency_status_log_no_truncate ON public.currency_status_log;
CREATE TRIGGER trg_currency_status_log_no_truncate
  BEFORE TRUNCATE ON public.currency_status_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.currency_status_log_no_truncate();

DROP TRIGGER IF EXISTS trg_admin_ops_audit_log_no_truncate ON public.admin_ops_audit_log;
CREATE TRIGGER trg_admin_ops_audit_log_no_truncate
  BEFORE TRUNCATE ON public.admin_ops_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.admin_ops_audit_log_no_truncate();

DROP TRIGGER IF EXISTS trg_admin_refund_audit_log_no_truncate ON public.admin_refund_audit_log;
CREATE TRIGGER trg_admin_refund_audit_log_no_truncate
  BEFORE TRUNCATE ON public.admin_refund_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.admin_refund_audit_log_no_truncate();

DROP TRIGGER IF EXISTS trg_currency_review_log_no_truncate ON public.currency_review_log;
CREATE TRIGGER trg_currency_review_log_no_truncate
  BEFORE TRUNCATE ON public.currency_review_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.currency_review_log_no_truncate();

DROP TRIGGER IF EXISTS trg_listing_review_log_no_truncate ON public.listing_review_log;
CREATE TRIGGER trg_listing_review_log_no_truncate
  BEFORE TRUNCATE ON public.listing_review_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.listing_review_log_no_truncate();

DROP TRIGGER IF EXISTS trg_job_arbitration_log_no_truncate ON public.job_arbitration_log;
CREATE TRIGGER trg_job_arbitration_log_no_truncate
  BEFORE TRUNCATE ON public.job_arbitration_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.job_arbitration_log_no_truncate();

DROP TRIGGER IF EXISTS trg_batt_entry_no_truncate ON public.batt_entry;
CREATE TRIGGER trg_batt_entry_no_truncate
  BEFORE TRUNCATE ON public.batt_entry
  FOR EACH STATEMENT EXECUTE FUNCTION public.batt_entry_no_truncate();

DROP TRIGGER IF EXISTS trg_checkin_log_no_truncate ON public.checkin_log;
CREATE TRIGGER trg_checkin_log_no_truncate
  BEFORE TRUNCATE ON public.checkin_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.checkin_log_no_truncate();

DROP TRIGGER IF EXISTS trg_checkin_makeup_log_no_truncate ON public.checkin_makeup_log;
CREATE TRIGGER trg_checkin_makeup_log_no_truncate
  BEFORE TRUNCATE ON public.checkin_makeup_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.checkin_makeup_log_no_truncate();

DROP TRIGGER IF EXISTS trg_rating_no_truncate ON public.rating;
CREATE TRIGGER trg_rating_no_truncate
  BEFORE TRUNCATE ON public.rating
  FOR EACH STATEMENT EXECUTE FUNCTION public.rating_no_truncate();

DROP TRIGGER IF EXISTS trg_listing_order_event_no_truncate ON public.listing_order_event;
CREATE TRIGGER trg_listing_order_event_no_truncate
  BEFORE TRUNCATE ON public.listing_order_event
  FOR EACH STATEMENT EXECUTE FUNCTION public.listing_order_event_no_truncate();


-- ============================================================================
-- §③ apply-time 自检（不通过 ⇒ 整迁移回滚、**不写版本行**）
--   手法照抄 `0027:213-215`（上游版本行在场）+ `0029:360-371`（append-only 触发器覆盖断言）。
-- ============================================================================
DO $$
DECLARE
  v_tabs text[] := ARRAY[
    'ledger_entry','referral','commission_policy','market_trade','currency_status_log',
    'admin_ops_audit_log','admin_refund_audit_log','currency_review_log','listing_review_log',
    'job_arbitration_log','batt_entry','checkin_log','checkin_makeup_log','rating','listing_order_event'
  ];
  v_t    text;
  v_trg  int;
  v_n    int;
BEGIN
  -- ---------------------------------------------------------------- 15 张目标表在场
  FOREACH v_t IN ARRAY v_tabs LOOP
    IF to_regclass('public.' || v_t) IS NULL THEN
      RAISE EXCEPTION '0043 self-check FAILED: public.% missing', v_t; END IF;
  END LOOP;

  -- ---------------------------------------------------------------- 逐表：恰 1 枚 BEFORE TRUNCATE 触发器，且为 statement 级
  FOREACH v_t IN ARRAY v_tabs LOOP
    SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_t AND NOT t.tgisinternal
       AND (t.tgtype & 2) <> 0 AND (t.tgtype & 32) <> 0;              -- BEFORE + TRUNCATE
    IF v_trg <> 1 THEN
      RAISE EXCEPTION '0043 self-check FAILED: % BEFORE TRUNCATE triggers = %, expect 1', v_t, v_trg; END IF;

    -- 必须 statement 级（TRUNCATE 不支持行级；如误建行级 = 无闸）
    SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_t AND NOT t.tgisinternal
       AND (t.tgtype & 2) <> 0 AND (t.tgtype & 32) <> 0 AND (t.tgtype & 1) = 0;
    IF v_trg <> 1 THEN
      RAISE EXCEPTION '0043 self-check FAILED: % BEFORE TRUNCATE trigger must be FOR EACH STATEMENT', v_t; END IF;

    -- 守卫函数在场
    IF to_regprocedure('public.' || v_t || '_no_truncate()') IS NULL THEN
      RAISE EXCEPTION '0043 self-check FAILED: public.%_no_truncate() missing', v_t; END IF;

    -- 既有 append-only 守卫（BEFORE UPDATE OR DELETE，行级）仍在场（本迁移未动它）
    SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_t AND NOT t.tgisinternal
       AND (t.tgtype & 2) <> 0 AND (t.tgtype & 8) <> 0 AND (t.tgtype & 16) <> 0;   -- BEFORE + DELETE + UPDATE
    IF v_trg <> 1 THEN
      RAISE EXCEPTION '0043 self-check FAILED: % 既有 append-only 守卫（BEFORE UPDATE OR DELETE）= %, expect 1（本迁移不应改动它）', v_t, v_trg; END IF;
  END LOOP;

  -- ---------------------------------------------------------------- 上游版本行在场（0027:213-215 手法）
  SELECT count(*) INTO v_n FROM public.schema_migration WHERE version = '0042';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0043 self-check FAILED: upstream migration row 0042 = % (expect 1)', v_n; END IF;

  RAISE NOTICE '0043 self-check OK: 15 append-only 表各恰 1 枚 BEFORE TRUNCATE（statement）触发器 + 既有 BEFORE UPDATE OR DELETE 守卫全在 + upstream 0042 在场';
END $$;
