-- ============================================================================
-- 0008_platform_revenue_job_fee.sql · P2 裁定 #11 的机械前提：`-1` 白名单接纳 `job_fee`
-- ============================================================================
-- 权威口径：docs/commission.spec.md v0.2 §8.2 / §9.5 / CR84 / CR85
--           ＋ docs/seafood.master-plan.md **§5.21 #1**（Zang 裁定：**选 (a)** —— 接受
--             P2 = `0007` + `0008` 两条迁移；`0008` 用 `CREATE OR REPLACE` 扩 `-1` 白名单，
--             **不改 `0004` 文件本身**，沿用 `0005` 的替代模式）。
--
-- 为什么需要这一条
--   裁定 #11：**无邀请人**时手续费**仍收**，但**入 `-1`（平台收入）**、**不入 `-2`**。
--   理由：`-2` 只作佣金中转（同一事件内进出相抵、净额 0、不留存）；若把无人可分的钱留在
--   `-2`，而 `-2` 按 R103 只进不出 ⇒ 钱**永久沉淀**。
--   而现行 `ledger_assert_platform_mutation`（`0004`）对 `-1` 只放行
--   `credit ∈ {trade_fee, listing_fee, currency_create_fee}`、`debit` 恒 false
--   ⇒ `job_fee` 入 `-1` 会被 `LD021 / LEDGER_RESERVED_UID` 拒 ⇒ 该分支**不可实现**。
--
-- 本迁移做什么（**行为改变只允许落在新迁移**：`-1` 的白名单是既有对象的行为 ⇒ 只能 0008+）
--   1) `CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(...)` —— **仅**把 `-1` 的
--      `credit` 集合加上 `'job_fee'`；**其余每一格逐字不变**（`0` / `-2` / `-3` / `-4..-99` 兜底）
--   2) 自检（**双向**，缺一不算通过）：
--      正向：`job_fee` 入 `-1` 放行；既有三格（`trade_fee` / `listing_fee` / `currency_create_fee`）未丢
--      负向：**不在扩展后白名单里的 kind 仍必须被拒** ——
--            ① `commission` 入 `-1`（credit）必须拒
--            ② **`-1` 的任何 debit 都必须拒**（原语义「debit 恒 false」不许被顺带松掉）
--            ③ `-2` 的 `job_fee` debit 必须仍拒（证明只动了该动的那一格）
--
-- 本迁移**不**做什么
--   · **不改 `0004` 文件本身**（一个字节都不改；改它 ⇒ checksum 漂移 ⇒ migrate.ts 整链 ABORT/exit 3）
--   · 不触碰 `ledger_post_event` 函数体（裁定 #14 明令禁止）
--   · **不新增错误码**（仍是 33 码关闭集）；不新增 kind；不改表结构；不写任何业务表
--   · ⚠️ TS 侧 `PLATFORM_KIND_WHITELIST['-1']`（`backend-ts/src/ledger.ts`）按 spec CR85 ④
--     必须与 DB 侧**同改** —— 本单只做迁移（不碰 TS 业务层）⇒ **登记为下一单的第一件事**
--     （未同步前：DB 允许 `job_fee` 入 `-1`、TS 侧前置校验仍会拒绝该形状）。
--
-- 幂等：`CREATE OR REPLACE FUNCTION` 天然幂等；自检块重跑读数一致。
-- ============================================================================

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
    --    （其余格与 0004 逐字相同：debit 仍恒 false）
    WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee')
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
  'R101 平台账户 kind 白名单（0004 原版 + 0008 扩 `-1` credit 加 `job_fee`；其余格逐字不变）。';

-- ---------------------------------------------------------------------------
-- 自检：正向 + **负向**（master-plan §5.21 #1 强制：「证明这次扩展没有顺带松掉别的」）
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_state text;
  v_msg   text;
BEGIN
  -- ============ 正向：扩展后的白名单格必须全部放行 ============
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'credit');              -- 🆕 本次新增格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'credit');            -- 既有格（不许丢）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_fee', 'credit');          -- 既有格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'currency_create_fee', 'credit');  -- 既有格
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'commission', 'debit');            -- P2 的准入前提
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'job_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'transfer', 'debit');

  -- ============ 负向 ①：`-1` 的 credit 仍必须拒「不在扩展后白名单里的 kind」 ============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit');
    RAISE EXCEPTION '0008 self-check FAILED: -1 credit commission WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    IF v_msg <> 'LEDGER_RESERVED_UID' THEN
      RAISE EXCEPTION '0008 self-check FAILED: -1 credit commission rejected with %, expected LEDGER_RESERVED_UID', v_msg;
    END IF;
  END;

  -- ============ 负向 ②：`-1` 的任何 debit 仍必须拒（原「debit 恒 false」不许被松掉） ============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'debit');
    RAISE EXCEPTION '0008 self-check FAILED: -1 debit job_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'debit');
    RAISE EXCEPTION '0008 self-check FAILED: -1 debit trade_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 负向 ③：只该动 `-1` 的 credit 一格 —— `-2` 的 job_fee debit 必须仍拒 ============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'job_fee', 'debit');
    RAISE EXCEPTION '0008 self-check FAILED: -2 debit job_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'trade_fee', 'credit');
    RAISE EXCEPTION '0008 self-check FAILED: -2 credit trade_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
END $$;
