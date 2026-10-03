-- ============================================================================
-- 0032_kind_close_set_23.sql · P9④ C3：kind 关闭集 21 → 23（`$` 费腿扩容 +2）
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · docs/data-layer.spec.md **v0.25 §33.10** Zang 裁定（就地定案，2026-10-03，`R-9-36` / `R-9-42`）：
--     **`R-9-36` = 方案 ② 扩容 +2**：新 kind = **`bttc_mint_fee`** + **`bttc_burn_fee`**（**21 → 23**）；
--     迁移 = **本文件**（**CHECK 重建、非 enum**，手法逐字沿 `0003` 先例）；
--     **三处编码穷举**（① DB `ledger_kind_enum` CHECK；② DB 函数 `ledger_kind_ok`；③ TS 常量 `LEDGER_KINDS`）
--     + **`−1` credit 白名单追加两值**（TS `PLATFORM_KIND_WHITELIST['-1'].credit`
--     + DB `ledger_assert_platform_mutation`）；`ledger.spec §5.1` 回写要求（属规范册）。
--   · §33.3(b)：`$` 费腿（铸 / 分解手续费）→ `uid = −1`（**不真 burn** · `R-9-3` / `R31`）；
--     净增发 = 0、`total_supply` 不变。
--   · §33.10 内容契约：值集逐字 = **既有 21 值前 21 位不变** + 末位追加 `bttc_mint_fee` + `bttc_burn_fee`。
--   · docs/ledger.spec.md **§5.1 / R40**：「kind 是**关闭集**；**新增/删除 kind 必须走 migration
--     （改 `ledger_kind_enum`）并同步在本册 §5.1 登记**」⇒ 本迁移 = 新增 2 值。
--
-- ⚠️ 类型 / 手法（**实测取证，非选择**，逐字承 `0003:11-23` / `0028`）：
--   本库 `ledger_entry.kind` 是 **`text` + CHECK 约束**（约束名恰为 `ledger_kind_enum`、`contype='c'`），
--   **不存在**同名 PostgreSQL enum 类型 ⇒ 无法 `ALTER TYPE`。本迁移按**实际 schema** 做等价的
--   「白名单替换」：DROP 旧 CHECK → ADD 新 CHECK（23 个值）。
--   本迁移**不删任何 kind** ⇒ **无需**「先断言无行在用」的删值断言（沿 `0028` 逐字口径）。
--
-- 幂等 / 范围：只被 `migrate.ts` 执行一次（版本表 + checksum 去重）。
--   只改 `ledger_kind_enum` 一个约束 + `CREATE OR REPLACE` 两函数（`ledger_kind_ok` /
--   `ledger_assert_platform_mutation`）；**不改 `0001`–`0031` 任何文件**（checksum 漂移会 ABORT）。
--   本迁移**不新增 / 不删除错误码**（仍是 33 码关闭集）；不改任何业务表；不写任何业务数据。
-- ============================================================================

-- ---------------------------------------------------------------- 前置断言（fail-closed · 沿 0003:28-55 / 0028:29-55）
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
    RAISE EXCEPTION 'migration 0032 aborted: CHECK constraint ledger_kind_enum not found on public.ledger_entry';
  END IF;
  IF v_contype <> 'c' THEN
    RAISE EXCEPTION 'migration 0032 aborted: ledger_kind_enum is not a CHECK (contype=%)', v_contype;
  END IF;

  -- ② 列类型取证：`kind` 必须是 `text`（**不得**是 PG enum 类型 ⇒ 否则本文件的 CHECK 手法不适用）
  SELECT cols.udt_name INTO v_udt
    FROM information_schema.columns AS cols
   WHERE cols.table_schema = 'public'
     AND cols.table_name   = 'ledger_entry'
     AND cols.column_name  = 'kind';
  IF v_udt IS NULL OR v_udt <> 'text' THEN
    RAISE EXCEPTION 'migration 0032 aborted: expected public.ledger_entry.kind to be text (won''t tolerate enum-type drift), got %', COALESCE(v_udt, '<null>');
  END IF;
END $$;

-- ------------------------------------------------- 白名单替换（23 个值 = 既有 21 + 新增 2，逐字与 §33.10 一致）
ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_kind_enum;

ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund',
    'trade','trade_fee',
    'listing_fee','listing_deposit',
    'currency_create_fee','reversal',
    'checkin_makeup_fee',
    'bttc_mint_fee','bttc_burn_fee'
));

-- ---------------------------------------------------------------- `ledger_kind_ok` 21 → 23（`R-9-21` 三处编码穷举之二）
-- 手法（逐字沿 `0029 §G2`）：`CREATE OR REPLACE FUNCTION`（`0004:421-430` = `0029` 现值形态逐字保留，
--   **仅在 IN 列表末位追加 2 值**）；函数体 = `LANGUAGE sql IMMUTABLE`（体内**无 DDL** · DL142 相邻）；
--   `p_frozen_settle` 第二支**一字不动**（两新 kind **不属**冻结结算族 ⇒ 不得进第二支）。
CREATE OR REPLACE FUNCTION ledger_kind_ok(p_kind text, p_frozen_settle boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal',
    'checkin_makeup_fee',
    'bttc_mint_fee','bttc_burn_fee')
  AND (NOT p_frozen_settle OR p_kind IN ('job_payout','purchase','trade','hold_forfeit'))
$$;

COMMENT ON FUNCTION ledger_kind_ok(text, boolean) IS
  'kind 关闭集（P9④ / R-9-36）：21 → 23，末位追加 bttc_mint_fee + bttc_burn_fee；与 0032 的 ledger_kind_enum CHECK / src/ledger.ts LEDGER_KINDS 三处同集。p_frozen_settle 第二支一字不动。';

-- ---------------------------------------------------------------- `−1` credit 白名单追加两值（`R-9-36` · `R101` · 沿 `0029 §G`）
-- 手法（逐字沿 `0029 §G` / `0019`）：`CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(...)` ——
--   **仅**把 `-1` 的 `credit` 集合加上 `'bttc_mint_fee'` + `'bttc_burn_fee'`；**其余每一格逐字不变**
--   （`0` / `-2` / `-3` / 兜底；`-1` 的 `debit` 仍恒 false）。语义：铸 / 分解手续费入平台收入 `uid = −1`、
--   **不真 burn**（`R-9-3`）。
CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(
  p_uid bigint, p_kind text, p_dir text
) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_ok boolean;
BEGIN
  v_ok := CASE p_uid::text
    WHEN '0'  THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('mint', 'transfer', 'reversal')
                                    ELSE p_kind IN ('transfer', 'burn', 'reversal') END
    -- 🆕 0008（P2 裁定 #11）：`-1` = 平台收入账户 ⇒ 无邀请人时的手续费入这里
    -- 🆕 0019（P4-B3a-FIX-A / R31 v0.2 + DL67 + DL88）：`-1` 再接纳 `listing_deposit`
    -- 🆕 0029（P9② / data-layer v0.21 §31.1 R-9-14 ③(b) + §31.5 + R-9-3）：`-1` 再接纳 `checkin_makeup_fee`
    -- 🆕 0032（P9④ / data-layer v0.25 §33.10 R-9-36 + §33.3(b) + R-9-3）：`-1` 再接纳
    --    `bttc_mint_fee` + `bttc_burn_fee`（BTTC 铸 / 分解手续费入平台收入、**不真 burn**）。
    --    其余格与 0029 逐字相同：`-1` 的 debit 仍恒 false。
    WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit', 'checkin_makeup_fee', 'bttc_mint_fee', 'bttc_burn_fee')
                                    ELSE false END
    WHEN '-2' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('job_fee')
                                    ELSE p_kind IN ('commission') END
    WHEN '-3' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('hold_forfeit')
                                    ELSE p_kind IN ('hold_forfeit', 'transfer') END
    ELSE NULL
  END;
  IF v_ok IS NULL OR v_ok THEN RETURN; END IF;
  PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
    'uid', p_uid::text, 'kind', p_kind,
    'reason', CASE p_dir WHEN 'debit' THEN 'PLATFORM_DEBIT_FORBIDDEN' ELSE 'PLATFORM_CREDIT_KIND_FORBIDDEN' END));
END $$;

COMMENT ON FUNCTION ledger_assert_platform_mutation(bigint, text, text) IS
  'R101 平台账户 kind 白名单（0004 原版 + 0008 扩 -1 credit 加 job_fee + 0019 扩 -1 credit 加 listing_deposit + 0029 扩 -1 credit 加 checkin_makeup_fee + 0032 扩 -1 credit 加 bttc_mint_fee/bttc_burn_fee；其余格逐字不变）。';

-- ---------------------------------------------------------------- 收尾自检（沿 0003:69-83 + 0028:71-113 + 0029 §G/§G2）
DO $$
DECLARE
  v_cnt     int;
  v_def     text;
  v_covered int;
  v_bad     int;
  v_expected text[] := ARRAY[
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal',
    'checkin_makeup_fee','bttc_mint_fee','bttc_burn_fee'];
BEGIN
  -- ① 恰 1 个 ledger_kind_enum CHECK（沿 0003:71-83 / 0028:84-91「expected exactly 1」）
  SELECT count(*) INTO v_cnt
    FROM pg_constraint
   WHERE conrelid = 'public.ledger_entry'::regclass
     AND conname  = 'ledger_kind_enum'
     AND contype  = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: expected exactly 1 ledger_kind_enum CHECK, got %', v_cnt;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint AS c
   WHERE c.conrelid = 'public.ledger_entry'::regclass
     AND c.conname  = 'ledger_kind_enum'
     AND c.contype  = 'c';

  -- ② 该 CHECK 必须覆盖**恰 23** 个期望值
  SELECT count(*) INTO v_covered
    FROM unnest(v_expected) AS t(k)
   WHERE strpos(v_def, quote_literal(k)) > 0;
  IF v_covered <> 23 THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: ledger_kind_enum covers % of the expected 23 kinds', v_covered;
  END IF;

  -- ③ fail-closed 反向：两新 kind 必须在场
  IF strpos(v_def, quote_literal('bttc_mint_fee')) = 0 OR strpos(v_def, quote_literal('bttc_burn_fee')) = 0 THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: new kind(s) bttc_mint_fee / bttc_burn_fee not present in ledger_kind_enum';
  END IF;

  -- ④ `ledger_kind_ok` 正向：23 值逐字逐真（防闭集丢值）+ 两新值在场
  SELECT count(*) INTO v_bad FROM unnest(v_expected) AS t(k) WHERE NOT ledger_kind_ok(t.k);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: % of the 23 expected kinds rejected by ledger_kind_ok', v_bad;
  END IF;
  -- ⑤ `ledger_kind_ok` 负向：闭集外必拒 + 冻结结算族第二支未放宽
  IF ledger_kind_ok('listing_deposit_refund') OR ledger_kind_ok('market_hold') OR ledger_kind_ok('') OR ledger_kind_ok('made_up_kind') THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: ledger_kind_ok accepted a kind outside the 23-value closed set';
  END IF;
  IF ledger_kind_ok('bttc_mint_fee', true) OR ledger_kind_ok('bttc_burn_fee', true) THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: bttc fee kind wrongly accepted under frozen_settle';
  END IF;
  IF NOT (ledger_kind_ok('job_payout', true) AND ledger_kind_ok('purchase', true)
          AND ledger_kind_ok('trade', true) AND ledger_kind_ok('hold_forfeit', true)) THEN
    RAISE EXCEPTION 'migration 0032 post-check failed: frozen_settle 第二支既有成员丢值';
  END IF;

  RAISE NOTICE '0032 post-check OK: ledger_kind_enum 覆盖恰 23 值（既有 21 + bttc_mint_fee/bttc_burn_fee）；ledger_kind_ok 扩 23；闭集外必拒、冻结族第二支未放宽';
END $$;

-- ---------------------------------------------------------------- `−1` credit / `ledger_assert_platform_mutation` 自检（正 + 负，缺一不算通过）
DO $$
DECLARE v_n int;
BEGIN
  -- 正向：扩展后的白名单格必须全部放行（含本次新增两格）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'bttc_mint_fee', 'credit');   -- 🆕
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'bttc_burn_fee', 'credit');   -- 🆕
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'credit');       -- 既有格（不许丢）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'currency_create_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'checkin_makeup_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'commission', 'debit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'transfer', 'debit');

  -- 负向 ①：`-1` credit 仍必须拒非白名单 kind
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit');
    RAISE EXCEPTION '0032 self-check FAILED: -1 credit commission WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  -- 负向 ②：`-1` 的任何 debit 仍必须拒（「debit 恒 false」不许被松掉）
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'bttc_mint_fee', 'debit');
    RAISE EXCEPTION '0032 self-check FAILED: -1 debit bttc_mint_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  -- 负向 ③：只该动 `-1` 的 credit 一格 —— 其它两格抽查必须仍拒（新 kind 不得被顺带放宽）
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'bttc_burn_fee', 'credit');
    RAISE EXCEPTION '0032 self-check FAILED: -2 credit bttc_burn_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-3::bigint, 'bttc_mint_fee', 'credit');
    RAISE EXCEPTION '0032 self-check FAILED: -3 credit bttc_mint_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'public.ledger_entry'::regclass AND conname = 'ledger_kind_enum' AND contype = 'c';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0032 self-check FAILED: expected exactly 1 ledger_kind_enum CHECK, got %', v_n;
  END IF;

  RAISE NOTICE '0032 self-check OK: -1 credit 追加 bttc_mint_fee/bttc_burn_fee（既有六格未丢）+ 负向三条（非白名单 credit / 任意 debit / 其它平台格）皆拒';
END $$;
