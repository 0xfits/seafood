-- ============================================================================
-- 0028_kind_close_set_21.sql · P9② C-3 扩容 +1：kind 关闭集 20 → 21
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · docs/data-layer.spec.md **v0.21 §31.1** Zang 裁定 **R-9-14**（就地定案，2026-10-03）：
--     **C-3 = 方案 ② 扩容 +1**；新 kind = **`checkin_makeup_fee`**（**20 → 21**）；
--     迁移 = **本文件**（**CHECK 重建、非 enum**，手法逐字沿 `0003` 先例）；
--     `−1` 归属白名单追加（`R101`）；**不真 burn**（`R-9-3`）。
--   · docs/data-layer.spec.md §31.5（`$` 与归属）：补签 100 `$` 腿 = 减方用户 `balance −100`
--     / 增方 `uid = −1` `balance +100`（**净增发 = 0、`total_supply` 不变**、**禁 `burn`**）。
--   · docs/ledger.spec.md **§5.1 / R40**：「20 个 `kind` 是**关闭集**；**新增/删除 kind 必须走
--     migration（改 `ledger_kind_enum`）并同步在本册 §5.1 登记三列**」⇒ 本迁移 = 新增 1 值。
--
-- ⚠️ 类型 / 手法（**实测取证，非选择**，逐字承 `0003:11-23`）：
--   本库 `ledger_entry.kind` 是 **`text` + CHECK 约束**（约束名恰为 `ledger_kind_enum`、`contype='c'`），
--   **不存在**同名 PostgreSQL enum 类型：
--     information_schema.columns → data_type = 'text'
--     pg_constraint → ledger_kind_enum 的 contype = 'c'（CHECK），def = kind = ANY (ARRAY[...])
--   ⇒ 无法 `ALTER TYPE`。本迁移按**实际 schema** 做等价的「白名单替换」：
--     DROP 旧 CHECK → ADD 新 CHECK（21 个值）。语义 = DB 侧接纳新增 kind `checkin_makeup_fee`。
--   本迁移**不删任何 kind** ⇒ **无需**「先断言无行在用」的删值断言（§31.1 R-9-14 ② 逐字）。
--
-- 幂等 / 范围：只被 `migrate.ts` 执行一次（版本表 + checksum 去重）。
--   只改 `ledger_kind_enum` 一个约束；**不改 `0001` / `0002`**（checksum 漂移会 ABORT）。
--   本迁移**不新增 / 不删除错误码**（仍是 33 码关闭集）；不改任何业务表；不写任何业务数据。
-- ============================================================================

-- ---------------------------------------------------------------- 前置断言（fail-closed · 沿 0003:28-55）
DO $$
DECLARE
  v_contype "char";
  v_udt     text;
BEGIN
  -- ① 约束存在性 + 必须为 CHECK（contype='c'）—— 缺失 / 漂移成非 CHECK 说明 schema 漂移 ⇒ ABORT
  SELECT c.contype INTO v_contype
    FROM pg_constraint AS c
   WHERE c.conrelid = 'public.ledger_entry'::regclass
     AND c.conname  = 'ledger_kind_enum';
  IF v_contype IS NULL THEN
    RAISE EXCEPTION 'migration 0028 aborted: CHECK constraint ledger_kind_enum not found on public.ledger_entry';
  END IF;
  IF v_contype <> 'c' THEN
    RAISE EXCEPTION 'migration 0028 aborted: ledger_kind_enum is not a CHECK (contype=%)', v_contype;
  END IF;

  -- ② 列类型取证：`kind` 必须是 `text`（**不得**是 PG enum 类型 ⇒ 否则本文件的 CHECK 手法不适用）—— 承 0003:13-19
  SELECT cols.udt_name INTO v_udt
    FROM information_schema.columns AS cols
   WHERE cols.table_schema = 'public'
     AND cols.table_name   = 'ledger_entry'
     AND cols.column_name  = 'kind';
  IF v_udt IS NULL OR v_udt <> 'text' THEN
    RAISE EXCEPTION 'migration 0028 aborted: expected public.ledger_entry.kind to be text (won''t tolerate enum-type drift), got %', COALESCE(v_udt, '<null>');
  END IF;
END $$;

-- ------------------------------------------------- 白名单替换（21 个值 = 既有 20 + 新增 1，逐字与 §31.1 一致）
ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_kind_enum;

ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund',
    'trade','trade_fee',
    'listing_fee','listing_deposit',
    'currency_create_fee','reversal',
    'checkin_makeup_fee'
));

-- ---------------------------------------------------------------- 收尾自检（沿 0003:69-83 + 0019:143-166，把 20 前推为 21）
DO $$
DECLARE
  v_cnt     int;
  v_def     text;
  v_covered int;
  v_expected text[] := ARRAY[
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal',
    'checkin_makeup_fee'];
BEGIN
  -- ① 恰 1 个 ledger_kind_enum CHECK（沿 0003:71-83「expected exactly 1」）
  SELECT count(*) INTO v_cnt
    FROM pg_constraint
   WHERE conrelid = 'public.ledger_entry'::regclass
     AND conname  = 'ledger_kind_enum'
     AND contype  = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'migration 0028 post-check failed: expected exactly 1 ledger_kind_enum CHECK, got %', v_cnt;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint AS c
   WHERE c.conrelid = 'public.ledger_entry'::regclass
     AND c.conname  = 'ledger_kind_enum'
     AND c.contype  = 'c';

  -- ② 该 CHECK 必须覆盖**恰 21** 个期望值（沿 0019:154-165「covers all N kinds」口径 N = 21）
  SELECT count(*) INTO v_covered
    FROM unnest(v_expected) AS t(k)
   WHERE strpos(v_def, quote_literal(k)) > 0;
  IF v_covered <> 21 THEN
    RAISE EXCEPTION 'migration 0028 post-check failed: ledger_kind_enum covers % of the expected 21 kinds', v_covered;
  END IF;

  -- ③ fail-closed 反向：新 kind 必须在场，且每个期望值都被 CHECK 文本逐字接纳
  IF strpos(v_def, quote_literal('checkin_makeup_fee')) = 0 THEN
    RAISE EXCEPTION 'migration 0028 post-check failed: new kind checkin_makeup_fee not present in ledger_kind_enum';
  END IF;

  RAISE NOTICE '0028 post-check OK: exactly 1 ledger_kind_enum CHECK covering all 21 kinds (20 既有 + checkin_makeup_fee)';
END $$;
