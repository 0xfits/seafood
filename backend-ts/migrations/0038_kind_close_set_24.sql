-- ============================================================================
-- 0038_kind_close_set_24.sql · P9⑤ C3：kind 关闭集 23 → 24（`$` 平台出账腿 +1）
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · docs/commission.spec.md **v0.4 §19.5⑦**（`C-2⑦` §6.2 两条一次性奖励落点）+ §19.11
--     裁定 **`R-9-57`**（首任务腿 = 完成首任务者本人 + 其直接上级 `parent_uid` 各 10$；
--     无上级 ⇒ 只发本人、平台不吞）。
--   · **`R-9-65`**（Kong 预设 · 待 Zang 终审）：首任务 10$ 两腿**资金来源 = `uid = −1`（平台收入账户）
--     出账**（需求 §6.2②「邀请双方发放 10$ 积分」= 平台负责发放；与 §6.3「平台不抽成」不冲突 ——
--     后者指**任务奖励分配**口径）⇒ 新增 kind **`invite_first_task_reward`**（**23 → 24**）；
--     迁移 = **本文件**（**CHECK 重建、非 enum**，手法逐字沿 `0003` / `0032` 先例）；
--     **`−1` 白名单 `debit` +1**（★ **首次给 `−1` 开 `debit`** = `R103`「只进不出」的唯一例外）。
--   · docs/data-layer.spec.md **v0.26 §34.6**（迁移内容契约）+ `route-layer.spec` **v2.19 §31.4**。
--   · docs/ledger.spec.md **§5.1 / R40**：「kind 是**关闭集**；新增 kind 必须走 migration
--     （改 `ledger_kind_enum`）并同步在本册 §5.1 登记」⇒ 本迁移 = 新增 1 值（规范册回写不属本单）。
--
-- ★ `R-9-24`（真跑自证）：本迁移自带结构 + 行为自检（事务内，失败 ⇒ RAISE ⇒ 整文件回滚）。
--
-- ⚠️ 类型 / 手法（**实测取证，非选择**，逐字承 `0003:11-23` / `0028` / `0032`）：
--   本库 `ledger_entry.kind` 是 **`text` + CHECK 约束**（约束名恰为 `ledger_kind_enum`、`contype='c'`），
--   **不存在**同名 PostgreSQL enum 类型 ⇒ 无法 `ALTER TYPE`。本迁移按**实际 schema** 做等价的
--   「白名单替换」：DROP 旧 CHECK → ADD 新 CHECK（24 个值）。
--   本迁移**不删任何 kind** ⇒ **无需**「先断言无行在用」的删值断言（沿 `0028` / `0032` 逐字口径）。
--
-- 迁移边界（`commission.spec §19.6 抬头` / `R-9-49`）：
--   允许新迁移 `ALTER` / `CREATE OR REPLACE` 既有迁移（含 `0007`）所建对象（`CHECK` / 函数 / 触发器）；
--   **严禁修改已 apply 迁移文件（`0001`–`0037`）的字节**。
--
-- 幂等 / 范围：只被 `migrate.ts` 执行一次（版本表 + checksum 去重）。
--   只改 `ledger_kind_enum` 一个约束 + `CREATE OR REPLACE` 两函数（`ledger_kind_ok` /
--   `ledger_assert_platform_mutation`）；**不改 `0001`–`0037` 任何文件**（checksum 漂移会 ABORT）。
--   本迁移**不新增 / 不删除错误码**（仍是 33 码关闭集）；不改任何业务表；不写任何业务数据。
-- ============================================================================

-- ---------------------------------------------------------------- 前置断言（fail-closed · 沿 0003:28-55 / 0028:29-55 / 0032:29-56）
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
    RAISE EXCEPTION 'migration 0038 aborted: CHECK constraint ledger_kind_enum not found on public.ledger_entry';
  END IF;
  IF v_contype <> 'c' THEN
    RAISE EXCEPTION 'migration 0038 aborted: ledger_kind_enum is not a CHECK (contype=%)', v_contype;
  END IF;

  -- ② 列类型取证：`kind` 必须是 `text`（**不得**是 PG enum 类型 ⇒ 否则本文件的 CHECK 手法不适用）
  SELECT cols.udt_name INTO v_udt
    FROM information_schema.columns AS cols
   WHERE cols.table_schema = 'public'
     AND cols.table_name   = 'ledger_entry'
     AND cols.column_name  = 'kind';
  IF v_udt IS NULL OR v_udt <> 'text' THEN
    RAISE EXCEPTION 'migration 0038 aborted: expected public.ledger_entry.kind to be text (won''t tolerate enum-type drift), got %', COALESCE(v_udt, '<null>');
  END IF;
END $$;

-- ------------------------------------------------- 白名单替换（24 个值 = 既有 23 + 新增 1，逐字与 §19.5⑦ 一致）
ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_kind_enum;

ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK (kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund',
    'trade','trade_fee',
    'listing_fee','listing_deposit',
    'currency_create_fee','reversal',
    'checkin_makeup_fee',
    'bttc_mint_fee','bttc_burn_fee',
    'invite_first_task_reward'
));

-- ---------------------------------------------------------------- `ledger_kind_ok` 23 → 24（三处编码穷举之二）
-- 手法（逐字沿 `0029 §G2` / `0032`）：`CREATE OR REPLACE FUNCTION`；函数体 = `LANGUAGE sql IMMUTABLE`
--   （体内**无 DDL** · DL142 相邻）；**仅在 IN 列表末位追加 1 值**；`p_frozen_settle` 第二支**一字不动**
--   （新 kind **不属**冻结结算族 ⇒ 不得进第二支）。
CREATE OR REPLACE FUNCTION ledger_kind_ok(p_kind text, p_frozen_settle boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal',
    'checkin_makeup_fee',
    'bttc_mint_fee','bttc_burn_fee',
    'invite_first_task_reward')
  AND (NOT p_frozen_settle OR p_kind IN ('job_payout','purchase','trade','hold_forfeit'))
$$;

COMMENT ON FUNCTION ledger_kind_ok(text, boolean) IS
  'kind 关闭集（P9⑤ / R-9-65）：23 → 24，末位追加 invite_first_task_reward；与 0038 的 ledger_kind_enum CHECK / src/ledger.ts LEDGER_KINDS 三处同集。p_frozen_settle 第二支一字不动。';

-- ---------------------------------------------------------------- `−1` 白名单 `debit` +1（`R-9-65` · `R101` · 沿 `0029 §G` / `0032`）
-- 手法（逐字沿 `0029 §G` / `0032`）：`CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(...)` ——
--   **仅**把 `-1` 的 `debit` 由 `ELSE false` 改为 `p_kind IN ('invite_first_task_reward')`（★ 首次开 `-1` debit）；
--   `-1` 的 `credit` 八值逐字不变；`0` / `-2` / `-3` / 兜底每一格逐字不变。
--   语义：§6.2② 首任务 10$ 两腿**资金来源 = 平台收入账户 `uid = −1` 出账**（`R-9-65`）。
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
    -- 🆕 0038（P9⑤ / commission v0.4 §19.5⑦ R-9-57 + R-9-65）：★ **首次给 `-1` 开 `debit`** ——
    --    接纳 `invite_first_task_reward`（§6.2② 首任务 10$ 两腿的资金来源 = 平台收入账户出账）；
    --    `-1` 的 `credit` 八值仍逐字不变；其余格与 0032 逐字相同。
    WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit', 'checkin_makeup_fee', 'bttc_mint_fee', 'bttc_burn_fee')
                                    ELSE p_kind IN ('invite_first_task_reward') END
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
  'R101 平台账户 kind 白名单（0004 原版 + 0008 扩 -1 credit 加 job_fee + 0019 扩 -1 credit 加 listing_deposit + 0029 扩 -1 credit 加 checkin_makeup_fee + 0032 扩 -1 credit 加 bttc_mint_fee/bttc_burn_fee + 0038 ★ 首次扩 -1 debit 加 invite_first_task_reward；其余格逐字不变）。';

-- ---------------------------------------------------------------- 收尾自检（沿 0003:69-83 + 0028:71-113 + 0029 §G/§G2 + 0032）
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
    'checkin_makeup_fee','bttc_mint_fee','bttc_burn_fee','invite_first_task_reward'];
BEGIN
  -- ① 恰 1 个 ledger_kind_enum CHECK（沿 0003:71-83 / 0032:143-151「expected exactly 1」）
  SELECT count(*) INTO v_cnt
    FROM pg_constraint
   WHERE conrelid = 'public.ledger_entry'::regclass
     AND conname  = 'ledger_kind_enum'
     AND contype  = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: expected exactly 1 ledger_kind_enum CHECK, got %', v_cnt;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint AS c
   WHERE c.conrelid = 'public.ledger_entry'::regclass
     AND c.conname  = 'ledger_kind_enum'
     AND c.contype  = 'c';

  -- ② 该 CHECK 必须覆盖**恰 24** 个期望值
  SELECT count(*) INTO v_covered
    FROM unnest(v_expected) AS t(k)
   WHERE strpos(v_def, quote_literal(k)) > 0;
  IF v_covered <> 24 THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: ledger_kind_enum covers % of the expected 24 kinds', v_covered;
  END IF;

  -- ③ fail-closed 反向：新 kind 必须在场
  IF strpos(v_def, quote_literal('invite_first_task_reward')) = 0 THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: new kind invite_first_task_reward not present in ledger_kind_enum';
  END IF;

  -- ④ `ledger_kind_ok` 正向：24 值逐字逐真（防闭集丢值）+ 新值在场
  SELECT count(*) INTO v_bad FROM unnest(v_expected) AS t(k) WHERE NOT ledger_kind_ok(t.k);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: % of the 24 expected kinds rejected by ledger_kind_ok', v_bad;
  END IF;
  -- ⑤ `ledger_kind_ok` 负向：闭集外必拒 + 冻结结算族第二支未放宽
  IF ledger_kind_ok('listing_deposit_refund') OR ledger_kind_ok('market_hold') OR ledger_kind_ok('') OR ledger_kind_ok('made_up_kind') THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: ledger_kind_ok accepted a kind outside the 24-value closed set';
  END IF;
  IF ledger_kind_ok('invite_first_task_reward', true) THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: invite_first_task_reward wrongly accepted under frozen_settle';
  END IF;
  IF NOT (ledger_kind_ok('job_payout', true) AND ledger_kind_ok('purchase', true)
          AND ledger_kind_ok('trade', true) AND ledger_kind_ok('hold_forfeit', true)) THEN
    RAISE EXCEPTION 'migration 0038 post-check failed: frozen_settle 第二支既有成员丢值';
  END IF;

  RAISE NOTICE '0038 post-check OK: ledger_kind_enum 覆盖恰 24 值（既有 23 + invite_first_task_reward）；ledger_kind_ok 扩 24；闭集外必拒、冻结族第二支未放宽';
END $$;

-- ---------------------------------------------------------------- `−1` 白名单 / `ledger_assert_platform_mutation` 自检（正 + 负，缺一不算通过）
DO $$
DECLARE v_n int;
BEGIN
  -- 正向 ①：`-1` credit 八格必须全部仍放行（不许丢）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'currency_create_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'checkin_makeup_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'bttc_mint_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'bttc_burn_fee', 'credit');

  -- 正向 ②：★ 本次新增 —— `-1` debit `invite_first_task_reward` 必须放行（R-9-65 首次开 debit）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'invite_first_task_reward', 'debit');

  -- 正向 ③：其余平台格逐字不变（抽查）
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'commission', 'debit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'transfer', 'debit');

  -- 负向 ①：`-1` credit 仍必须拒非白名单 kind
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit');
    RAISE EXCEPTION '0038 self-check FAILED: -1 credit commission WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  -- 负向 ②：`-1` debit **仅**放行 `invite_first_task_reward` —— 其它 kind 的 debit 仍必须拒
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'debit');
    RAISE EXCEPTION '0038 self-check FAILED: -1 debit job_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'bttc_mint_fee', 'debit');
    RAISE EXCEPTION '0038 self-check FAILED: -1 debit bttc_mint_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  -- 负向 ③：只该动 `-1` 的 debit 一格 —— 其它平台格必须仍拒新 kind（不得被顺带放宽）
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'invite_first_task_reward', 'credit');
    RAISE EXCEPTION '0038 self-check FAILED: -2 credit invite_first_task_reward WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-3::bigint, 'invite_first_task_reward', 'credit');
    RAISE EXCEPTION '0038 self-check FAILED: -3 credit invite_first_task_reward WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'public.ledger_entry'::regclass AND conname = 'ledger_kind_enum' AND contype = 'c';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0038 self-check FAILED: expected exactly 1 ledger_kind_enum CHECK, got %', v_n;
  END IF;

  RAISE NOTICE '0038 self-check OK: ★ 首次开 -1 debit 接纳 invite_first_task_reward（-1 credit 八格未丢）；负向（-1 credit 非白名单 / -1 debit 其它 kind / 其它平台格）皆拒';
END $$;
