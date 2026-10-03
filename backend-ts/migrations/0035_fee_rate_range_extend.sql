-- ============================================================================
-- 0035_fee_rate_range_extend.sql · P9⑤ 邀请奖励改版（实现第一步）· 费率域扩
-- ============================================================================
-- 权威口径：docs/commission.spec.md **v0.4 §19**（§19.4① / §19.5① / §19.6 冲突① / §19.7 /
--           §19.11 裁定 `R-9-48`）+ docs/data-layer.spec.md **v0.26 §34.2 / §34.6** +
--           docs/route-layer.spec.md **v2.19 §31.5**。
--
-- 裁定（逐字）：**`R-9-48` 费率载体 = 变体 Ⅰ（扩 `CHECK`）** —— 新迁移
--   `DROP CONSTRAINT commission_policy_fee_rate_rng; ADD CONSTRAINT … CHECK (fee_rate_bp
--    BETWEEN 100 AND 10000)`；`fee_rate_bp` 语义由「平台抽成」改 **「进池比例」**（`1000` = 10%）。
--   **`R-9-49`**：允许新迁移 `ALTER` 既有迁移（`0007`）所建对象；**严禁改已 apply 迁移文件字节**。
--
-- 本迁移做什么（只动 `commission_policy` 的一个 `CHECK` 约束 —— 无新表 / 无新列 / 无数据）
--   ① `DROP CONSTRAINT IF EXISTS commission_policy_fee_rate_rng`（幂等：`IF EXISTS`）
--   ② `ADD CONSTRAINT commission_policy_fee_rate_rng CHECK (fee_rate_bp BETWEEN 100 AND 10000)`
--   ③ 自检（CR55 / R-9-24）：约束指纹现取对拍 + 三项行为探针（`1000` 可入 / `99` 拒 / `10001` 拒）
--      + 两项边界正例（`100` / `10000` 可入）；探针一律子事务 + 哨兵回滚 ⇒ 零残留
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0034` 任何字节**（checksum 纪律；`R-9-49`）
--   · **不改 `ledger_post_event` 函数体**（裁定 #14）；不新增错误码（闭集 33 不动）/ kind
--   · **不新增政策行**（新政策行 = `0036`）；不碰 `commission_policy` 的 append-only 触发器
--   · `fee_rate_bp` 语义由「平台抽成」改「进池比例」是**语义勘误**（§19.7 `CR23`），非结构改动
--
-- 诚实边界
--   · 本迁移**不追溯**历史 3 行（`fee_rate_bp = 100`，append-only 保留，§19.11 `R-9-60`）。
--   · `CHECK` 不可 `CREATE OR REPLACE` ⇒ 只能 `DROP + ADD`（新迁移，`R-9-48`）。`DROP + ADD`
--     会重建约束 ⇒ 期间表上短暂无本约束（同事务内，外部不可见）。
-- ============================================================================

ALTER TABLE public.commission_policy
  DROP CONSTRAINT IF EXISTS commission_policy_fee_rate_rng;

ALTER TABLE public.commission_policy
  ADD CONSTRAINT commission_policy_fee_rate_rng
  CHECK (fee_rate_bp BETWEEN 100 AND 10000);

-- ---------------------------------------------------------------------------
-- §自检（CR55「不安检不许起飞」/ R-9-24）：任一不通过 ⇒ RAISE ⇒ 整文件回滚、不写版本行。
--   D.1 结构自检：约束指纹现取对拍（必须恰为扩域后的定义）。
--   D.2 行为探针（真库真写，跑在子事务里，哨兵异常 ⇒ 回滚 ⇒ 零残留）：
--       ⓐ `fee_rate_bp = 1000` ⇒ 必须可入；ⓑ `= 99` ⇒ 必须拒（`23514`）；
--       ⓒ `= 10001` ⇒ 必须拒（`23514`）；ⓓ `= 100` / `= 10000` ⇒ 边界必须可入。
--       探针 INSERT 走真实约束 + `commission_policy_weights_guard`；子事务回滚 ⇒ 无新政策行。
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_cnt integer;
  v_def text;
BEGIN
  -- ------------------------------------------------------------------ D.1 结构自检
  SELECT count(*), min(pg_get_constraintdef(oid))
    INTO v_cnt, v_def
    FROM pg_constraint
   WHERE conrelid = 'public.commission_policy'::regclass
     AND conname  = 'commission_policy_fee_rate_rng'
     AND contype  = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0035 self-check FAILED: commission_policy_fee_rate_rng 不唯一在场（count=%）', v_cnt;
  END IF;
  IF v_def <> 'CHECK (((fee_rate_bp >= 100) AND (fee_rate_bp <= 10000)))' THEN
    RAISE EXCEPTION '0035 self-check FAILED: 约束定义不符（实取=%）', v_def;
  END IF;

  -- ------------------------------------------------------------------ D.2 行为探针
  -- ⓐ fee_rate_bp = 1000 必须可入（子事务 + 哨兵回滚 ⇒ 零残留）
  BEGIN
    INSERT INTO public.commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
    VALUES (1000, 1, ARRAY[10000]::smallint[], now(), 0);
    RAISE EXCEPTION 'P9S5_0035_PROBE_ACCEPT';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'P9S5_0035_PROBE_ACCEPT' THEN RAISE; END IF;
    WHEN OTHERS THEN
      RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=1000 被拒（state=% msg=%）', SQLSTATE, SQLERRM;
  END;

  -- ⓑ fee_rate_bp = 99 必须拒（CHECK 23514）
  BEGIN
    INSERT INTO public.commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
    VALUES (99, 1, ARRAY[10000]::smallint[], now(), 0);
    RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=99 未被拒';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN RAISE;
    WHEN SQLSTATE '23514' THEN NULL;   -- 期望：CHECK 违反
    WHEN OTHERS THEN
      RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=99 拒绝码=%（期望 23514）', SQLSTATE;
  END;

  -- ⓒ fee_rate_bp = 10001 必须拒
  BEGIN
    INSERT INTO public.commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
    VALUES (10001, 1, ARRAY[10000]::smallint[], now(), 0);
    RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=10001 未被拒';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN RAISE;
    WHEN SQLSTATE '23514' THEN NULL;
    WHEN OTHERS THEN
      RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=10001 拒绝码=%（期望 23514）', SQLSTATE;
  END;

  -- ⓓ 下界 100 必须可入（扩域不得误伤原下界）
  BEGIN
    INSERT INTO public.commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
    VALUES (100, 1, ARRAY[10000]::smallint[], now(), 0);
    RAISE EXCEPTION 'P9S5_0035_PROBE_ACCEPT';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'P9S5_0035_PROBE_ACCEPT' THEN RAISE; END IF;
    WHEN OTHERS THEN
      RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=100（下界）被拒（state=% msg=%）', SQLSTATE, SQLERRM;
  END;

  -- ⓔ 上界 10000 必须可入
  BEGIN
    INSERT INTO public.commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
    VALUES (10000, 1, ARRAY[10000]::smallint[], now(), 0);
    RAISE EXCEPTION 'P9S5_0035_PROBE_ACCEPT';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'P9S5_0035_PROBE_ACCEPT' THEN RAISE; END IF;
    WHEN OTHERS THEN
      RAISE EXCEPTION '0035 self-check FAILED: fee_rate_bp=10000（上界）被拒（state=% msg=%）', SQLSTATE, SQLERRM;
  END;

  RAISE NOTICE '0035 self-check passed: fee_rate_rng 扩至 100..10000（1000 可入 / 99 拒 / 10001 拒 / 100 & 10000 边界可入）';
END $$;
