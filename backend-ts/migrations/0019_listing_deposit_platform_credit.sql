-- ============================================================================
-- 0019_listing_deposit_platform_credit.sql · P4-B3a-FIX-A：`-1` 白名单接纳 `listing_deposit`
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · docs/ledger.spec.md §3.1 **R31（v0.2）**：保证金 = **消耗不可退**（D7 行；`:79`）
--   · docs/ledger.spec.md v0.3 修订说明（`:12-13`）：kind 关闭集 21 → 20（删 `listing_deposit_forfeit`，
--     「保证金**在上市时即消耗**」）；`:191` 内联注释同旨
--   · docs/data-layer.spec.md **DL67（`:454`）**【已冻结】：上市账务 = `currency_create_fee`（若适用）
--     + `listing_fee` + `listing_deposit`（**消耗、入 `uid = −1`**）
--   · docs/data-layer.spec.md **DL88（`:530`）**【已冻结】：`listing_deposit` **上市即消耗**
--     （`balance → uid −1`）、**不可退、无罚没、无退还 kind**
--   · 同一裁定在代码注释的落点：`backend-ts/src/ledger.ts:148-150`、
--     `backend-ts/migrations/0003_kind_close_set_20.sql:5-8`
--
-- 为什么需要这一条
--   上述裁定要求「保证金**消耗**后进平台收入账户 `uid = -1`」。
--   但 DB 侧 `ledger_assert_platform_mutation`（`0004` 原版 + `0008` 扩 `job_fee` 后）对 `-1` 只放行
--   `credit ∈ {trade_fee, listing_fee, currency_create_fee, job_fee}`、`debit` 恒 false
--   ⇒ `listing_deposit` 入 `-1` 会被 `LD021 / LEDGER_RESERVED_UID` 拒 ⇒ **该分支不可实现**。
--   实测取证（改前，只读）：`SELECT public.ledger_assert_platform_mutation(-1::bigint,'listing_deposit','credit')`
--     ⇒ `{ ok:false, error:'LEDGER_RESERVED_UID', code:'LD021' }`
--     （产物：`.p4-artifacts/b3afix-20260930T014132/b3afix-00-probe.json` → `probe_neg_listing_deposit_credit`）
--
-- 本迁移做什么（**行为改变只允许落在新迁移** ⇒ 照 `0008` 先例做**加法式**扩展）
--   1) `CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(...)` —— **仅**把 `-1` 的
--      `credit` 集合加上 `'listing_deposit'`；**其余每一格逐字不变**
--      （`0` / `-2` / `-3` / `-4..-99` 兜底；`-1` 的 `debit` 仍恒 false）
--   2) 自检（**双向**，缺一不算通过）：
--      正向：`listing_deposit` 入 `-1` 放行；既有四格（`trade_fee` / `listing_fee` /
--            `currency_create_fee` / `job_fee`）未丢
--      负向：① 不在扩展后白名单里的 kind（`commission`）入 `-1`（credit）仍必须拒
--            ② `-1` 的任何 debit 仍必须拒（原语义「debit 恒 false」不许被顺带松掉）
--            ③ `-2` / `-3` 的既有格未被顺带放宽（`-2` credit `trade_fee` 必须仍拒）
--
-- 本迁移**不**做什么
--   · 不新增 / 不删除任何 kind（关闭集恒 20 个；`ledger_kind_enum` CHECK 一字不动）
--   · 不改 `-2` / `-3` / `0` 的任何一格；不改 `ledger_post_event` 函数体
--   · 不新增错误码（仍是 33 码关闭集）；不改表结构；**不写任何业务表**
--   · **禁 `DELETE` / `TRUNCATE` / `DROP` 业务数据**（本文件不含这三个词对业务对象的任何使用）
--   · 不改 `0001`–`0018` 任何文件（改它们 ⇒ checksum 漂移 ⇒ `scripts/migrate.ts` 整链 ABORT/exit 3）
--
-- TS 侧同步（**同一单内已完成**，非「下一单」）：
--   `backend-ts/src/ledger.ts` 的 `PLATFORM_KIND_WHITELIST['-1'].credit` 同轮加入 `listing_deposit`，
--   并把 `listing_deposit` 从 `HOLD_KINDS` 移出（R31/DL67/DL88 要求它是消耗型、不是在冻型）。
--
-- 幂等 / 可重入：`CREATE OR REPLACE FUNCTION` 天然幂等；`DO` 自检块为纯只读断言，
--   重复应用（含独立重跑本文件）读数一致、不报错、不留痕。
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
    -- 🆕 0019（P4-B3a-FIX-A / R31 v0.2 + DL67 + DL88 已冻结）：`-1` 再接纳 `listing_deposit`
    --    保证金**上市即消耗**、进平台收入、**不可退、无罚没**。
    --    其余格与 0008 逐字相同：`-1` 的 debit 仍恒 false。
    WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit')
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
  'R101 平台账户 kind 白名单（0004 原版 + 0008 扩 `-1` credit 加 `job_fee` + 0019 扩 `-1` credit 加 `listing_deposit`；其余格逐字不变）。';

-- ---------------------------------------------------------------------------
-- 自检：正向 + **负向**（缺一不算通过）
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_msg text;
BEGIN
  -- ============ 正向：扩展后的白名单格必须全部放行 ============
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit');       -- 🆕 本次新增格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'credit');            -- 既有格（不许丢）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_fee', 'credit');          -- 既有格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'currency_create_fee', 'credit');  -- 既有格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'credit');              -- 既有格（0008 引入，不许丢）
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'commission', 'debit');
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'job_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'transfer', 'debit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'hold_forfeit', 'credit');

  -- ============ 负向 ①：`-1` 的 credit 仍必须拒「不在扩展后白名单里的 kind」============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit');
    RAISE EXCEPTION '0019 self-check FAILED: -1 credit commission WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'LEDGER_RESERVED_UID' THEN
      RAISE EXCEPTION '0019 self-check FAILED: -1 credit commission rejected with %, expected LEDGER_RESERVED_UID', v_msg;
    END IF;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'purchase', 'credit');
    RAISE EXCEPTION '0019 self-check FAILED: -1 credit purchase WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 负向 ②：`-1` 的任何 debit 仍必须拒（「debit 恒 false」不许被松掉）============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'debit');
    RAISE EXCEPTION '0019 self-check FAILED: -1 debit listing_deposit WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'debit');
    RAISE EXCEPTION '0019 self-check FAILED: -1 debit trade_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 负向 ③：只该动 `-1` 的 credit 一格 —— 其它两格抽查必须仍拒 ============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'listing_deposit', 'credit');
    RAISE EXCEPTION '0019 self-check FAILED: -2 credit listing_deposit WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-3::bigint, 'listing_deposit', 'credit');
    RAISE EXCEPTION '0019 self-check FAILED: -3 credit listing_deposit WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'trade_fee', 'credit');
    RAISE EXCEPTION '0019 self-check FAILED: -2 credit trade_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 不变式：kind 关闭集仍是 20 个（本迁移不得动它）============
  DECLARE v_n int;
  BEGIN
    SELECT count(*) INTO v_n
      FROM pg_constraint
     WHERE conrelid = 'public.ledger_entry'::regclass
       AND conname = 'ledger_kind_enum'
       AND contype = 'c';
    IF v_n <> 1 THEN
      RAISE EXCEPTION '0019 self-check FAILED: expected exactly 1 ledger_kind_enum CHECK, got %', v_n;
    END IF;
    SELECT count(*) INTO v_n
      FROM unnest(ARRAY['mint','burn','transfer','hold','hold_release','hold_forfeit',
                        'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
                        'purchase','sale','purchase_refund','trade','trade_fee',
                        'listing_fee','listing_deposit','currency_create_fee','reversal']) AS t(k)
     WHERE strpos((SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
                    WHERE c.conrelid = 'public.ledger_entry'::regclass
                      AND c.conname = 'ledger_kind_enum' AND c.contype = 'c'),
                  quote_literal(k)) > 0;
    IF v_n <> 20 THEN
      RAISE EXCEPTION '0019 self-check FAILED: ledger_kind_enum no longer covers all 20 kinds (matched %)', v_n;
    END IF;
  END;
END $$;
