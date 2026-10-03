-- ============================================================================
-- 0036_commission_policy_p9_5.sql · P9⑤ 邀请奖励改版（实现第一步）· 新增 1 行新政策
-- ============================================================================
-- 权威口径：docs/commission.spec.md **v0.4 §19**（§19.5① / §19.7 / §19.11 裁定 `R-9-53` /
--           `R-9-58` / `R-9-60`）+ docs/data-layer.spec.md **v0.26 §34.6** +
--           docs/route-layer.spec.md **v2.19 §31.1**。
--
-- 裁定（逐字）
--   · **`R-9-53`**：权重向量 = 对称 `{2600,1700,700,2600,1700,700}`，序 `[U1,U2,U3,D1,D2,D3]`
--     （`Σ = 10000`）。
--   · **`R-9-58`**：`net` 语义 = `fee_rate_bp = 1000` 承 `computeFee`/`computeNet`
--     （`fee = gross × 10%` 进池 / `net = 90%`）⇒ 新政策行 `fee_rate_bp = 1000`。
--   · **`R-9-60`**：历史 3 行 append-only **保留** + **新增 1 行新政策**
--     （`fee_rate_bp = 1000` / `levels = 6` / `weights_bp` 恰 6 项 / 新 `effective_from`）；
--     ★ **`levels` 语义勘误 = 「有效层数（含下 3）」**（域 `1..10` 容 6 ⇒ **无需扩 `CHECK`**）。
--
-- 本迁移做什么（只 `INSERT` 一行；**无** DDL / 无新列 / 不改历史行）
--   ① `INSERT … SELECT 1000, 6, ARRAY[2600,1700,700,2600,1700,700], now(), -1 WHERE NOT EXISTS (…)`
--      · `created_by = -1`（平台保留 id；`commission_policy_created_by_rng` 接纳 `-1`）
--      · `WHERE NOT EXISTS (fee_rate_bp = 1000 AND levels = 6)` ⇒ **幂等**（重跑不双插）
--   ② 自检（CR55 / R-9-24）：新行在场 / 历史 3 行逐字未动 / `weights_bp` 恰 6 项且 `Σ = 10000`
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0035` 任何字节**；**不改 `ledger_post_event` 函数体**；不新增错误码 / kind
--   · **不 UPDATE / 不 DELETE 任何行**（`commission_policy` append-only：触发器拒 UPDATE/DELETE）
--   · 不碰约束（域扩 = `0035`）
--
-- 诚实边界
--   · 新行 `effective_from = now()`（apply 时刻）⇒ 严格晚于历史 3 行（`≤ 2026-10-01`）
--     ⇒ 生效口径（`effective_from <= T` 取最大）下，本次 apply 后**新行即刻生效**。
--   · 本迁移只落**政策行**；`commission.ts` 的 6 层分配计算 = 同批实现单（此迁移不涉）。
-- ============================================================================

INSERT INTO public.commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
SELECT 1000,
       6,
       ARRAY[2600, 1700, 700, 2600, 1700, 700]::smallint[],
       now(),
       -1
 WHERE NOT EXISTS (
   SELECT 1 FROM public.commission_policy WHERE fee_rate_bp = 1000 AND levels = 6);

-- ---------------------------------------------------------------------------
-- §自检（CR55 / R-9-24）：任一不通过 ⇒ RAISE ⇒ 整文件回滚、不写版本行。
--   D.1 新行在场（恰 1 行：`fee_rate_bp = 1000` ∧ `levels = 6`）。
--   D.2 `weights_bp` 恰 6 项，且 `Σ = 10000`，且逐项 == `{2600,1700,700,2600,1700,700}`。
--   D.3 历史 3 行**逐字未动**：`fee_rate_bp = 100` ∧ `levels = 10` ∧
--       `weights_bp == {3000,2000,1500,1000,800,600,500,300,200,100}` 的行数仍 = 3。
--   D.4 表行数 = 4（3 历史 + 1 新）；历史行的 `created_by` 集合仍含 0/1（未被改写）。
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_new_cnt   integer;
  v_hist_cnt  integer;
  v_total     integer;
  v_wlen      integer;
  v_wsum      bigint;
  v_weights   smallint[];
  v_created0  integer;
BEGIN
  -- D.1 新行在场（恰 1 行）
  SELECT count(*) INTO v_new_cnt
    FROM public.commission_policy WHERE fee_rate_bp = 1000 AND levels = 6;
  IF v_new_cnt <> 1 THEN
    RAISE EXCEPTION '0036 self-check FAILED: 新政策行（fee_rate_bp=1000/levels=6）行数=%（期望 1）', v_new_cnt;
  END IF;

  -- D.2 新行 weights_bp 恰 6 项 / Σ=10000 / 逐项相符
  SELECT weights_bp, array_length(weights_bp, 1),
         COALESCE((SELECT sum(w) FROM unnest(weights_bp) AS w), 0)
    INTO v_weights, v_wlen, v_wsum
    FROM public.commission_policy WHERE fee_rate_bp = 1000 AND levels = 6;
  IF v_wlen IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION '0036 self-check FAILED: 新行 weights_bp 项数=%（期望 6）', v_wlen;
  END IF;
  IF v_wsum IS DISTINCT FROM 10000 THEN
    RAISE EXCEPTION '0036 self-check FAILED: 新行 Σweights_bp=%（期望 10000）', v_wsum;
  END IF;
  IF v_weights IS DISTINCT FROM ARRAY[2600, 1700, 700, 2600, 1700, 700]::smallint[] THEN
    RAISE EXCEPTION '0036 self-check FAILED: 新行 weights_bp=%（期望 {2600,1700,700,2600,1700,700}）', v_weights;
  END IF;

  -- D.3 历史 3 行逐字未动
  SELECT count(*) INTO v_hist_cnt
    FROM public.commission_policy
   WHERE fee_rate_bp = 100 AND levels = 10
     AND weights_bp = ARRAY[3000, 2000, 1500, 1000, 800, 600, 500, 300, 200, 100]::smallint[];
  IF v_hist_cnt <> 3 THEN
    RAISE EXCEPTION '0036 self-check FAILED: 历史 3 行（fee_rate_bp=100/levels=10/10 项权重）行数=%（期望 3，append-only 应未被改写）', v_hist_cnt;
  END IF;

  -- D.4 表行数 = 4；历史种子（created_by=0）仍在
  SELECT count(*) INTO v_total FROM public.commission_policy;
  IF v_total <> 4 THEN
    RAISE EXCEPTION '0036 self-check FAILED: commission_policy 总行数=%（期望 4 = 3 历史 + 1 新）', v_total;
  END IF;
  SELECT count(*) INTO v_created0 FROM public.commission_policy WHERE created_by = 0;
  IF v_created0 <> 1 THEN
    RAISE EXCEPTION '0036 self-check FAILED: 历史种子行（created_by=0）行数=%（期望 1，未被改写）', v_created0;
  END IF;

  RAISE NOTICE '0036 self-check passed: 新增 1 行（fee_rate_bp=1000 / levels=6 / weights_bp 6 项 Σ=10000）；历史 3 行逐字未动；表行数 3 -> 4';
END $$;
