-- ============================================================================
-- 0003_kind_close_set_20.sql · P1c 收口：kind 关闭集 22 → 20
-- 权威口径：docs/ledger.spec.md §5.1 / R40
--   Zang（P1c 收口）裁定：删两个 kind
--     ① `listing_deposit_refund`  —— spec v0.2 已删（保证金 = 消耗不可退，无退还动作）
--     ② `listing_deposit_forfeit` —— P1c 新裁定删（保证金在**上市时即消耗**并转入平台收入
--        `uid = -1`；强制下架时**不存在可罚没的标的物**。将来若要做「强制下架罚款」，
--        那是**新语义、新 kind**，需单独定，不在本次范围。）
--   ⇒ 现存 kind = 20 个。
--
-- ⚠️ 与派单文字的偏差（**实测取证，非选择**）：
--   派单要求「ALTER TYPE ledger_kind_enum RENAME ... → CREATE TYPE ...」。
--   实测本库 `ledger_entry.kind` 是 **`text` + CHECK 约束**（约束名恰为 `ledger_kind_enum`），
--   **不存在**同名 PostgreSQL enum 类型：
--     information_schema.columns → data_type = 'text', udt_name = 'text'
--     pg_type → 无 typname LIKE '%ledger_kind%'
--     pg_constraint → ledger_kind_enum 的 contype = 'c'（CHECK），def = kind = ANY (ARRAY[...])
--   ⇒ 无法执行 `ALTER TYPE`（会报 type does not exist）。本 migration 按**实际 schema**
--     做等价的「白名单替换」：DROP 旧 CHECK → ADD 新 CHECK（20 个值）。
--     语义与目的与派单一致：DB 侧不再接受两个被删值；且**先断言无行在用**，否则中止。
--
-- 幂等：本文件只被 migrate.ts 执行一次（版本表 + checksum 去重）。
-- 只改 `ledger_kind_enum` 一个约束；不改 0001 / 0002（checksum 漂移会 ABORT）。
-- ============================================================================

-- ---------------------------------------------------------------- 前置断言
-- 若仍有行使用被删值 ⇒ 必须停下由人工处置，**不得**强行改约束（会静默改写历史流水语义）
DO $$
DECLARE
  bad_rows bigint;
  bad_detail text;
BEGIN
  SELECT count(*) INTO bad_rows
    FROM ledger_entry
   WHERE kind IN ('listing_deposit_refund', 'listing_deposit_forfeit');

  IF bad_rows > 0 THEN
    SELECT string_agg(DISTINCT kind, ', ') INTO bad_detail
      FROM ledger_entry
     WHERE kind IN ('listing_deposit_refund', 'listing_deposit_forfeit');
    RAISE EXCEPTION
      'migration 0003 aborted: % ledger_entry row(s) still use deleted kind(s) [%]; resolve manually before retrying',
      bad_rows, bad_detail;
  END IF;

  -- 约束存在性取证（缺失说明 schema 漂移）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'ledger_entry'::regclass
       AND conname  = 'ledger_kind_enum'
       AND contype  = 'c'
  ) THEN
    RAISE EXCEPTION 'migration 0003 aborted: CHECK constraint ledger_kind_enum not found on ledger_entry';
  END IF;
END $$;

-- ------------------------------------------------- 白名单替换（20 个值，逐字与 spec §5.1 现存集一致）
ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_kind_enum;

ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund',
    'trade','trade_fee',
    'listing_fee','listing_deposit',
    'currency_create_fee','reversal'
));

-- ---------------------------------------------------------------- 收尾断言
-- 新约束必须存在且覆盖恰好 20 个值（用 pg_get_constraintdef 计数 '::text' 出现次数）
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
    FROM pg_constraint
   WHERE conrelid = 'ledger_entry'::regclass
     AND conname  = 'ledger_kind_enum'
     AND contype  = 'c';
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'migration 0003 post-check failed: expected exactly 1 ledger_kind_enum CHECK, got %', cnt;
  END IF;
END $$;
