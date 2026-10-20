-- ============================================================================
-- 0061_listing_allow_multi_buy.sql
-- 多件购买授权列（Kevin 2026-10-20 指令）
-- ----------------------------------------------------------------------------
-- 指令原文：发布商品时「如果商品数量（stock）> 1，用户需填写一个选项『是否支持
--   一次购买多个』；若开启，购买者点【立即购买】后弹确认购买数量的提示（数量默认 1，
--   上限 = min(stock, 单次上限)）；未开启 ⇒ 恒买 1 件、零提示」。
-- 契约真源：docs/data-layer.spec.md §40.13.1 / §40.13.4（列契约 · 迁移内容契约）
--          docs/route-layer.spec.md §49.17（写口矩阵 W1–W7 · 购买矩阵 B1–B8 · 四读口键数）
--
-- 唯一动作（一行 DDL，零 DML / 零索引 / 零 CHECK / 零触发器 / 零回填 UPDATE）：
--   listing.allow_multi_buy boolean NOT NULL DEFAULT false
--
-- 为什么默认 false：Kevin 未要求默认开；默认开 = 替卖家授权、静默放大成交件数。
-- 为什么存量不回填：存量商品从未被卖家授权过 ⇒ 回填 true = 替卖家做决定（与
--   §40.8「存量 item_type 留 NULL 不回填」同一纪律）。DEFAULT 本身让存量行读成 false。
-- 为什么不设「true ⇒ stock >= 2」的 CHECK / 触发器（§40.13.2 的核心裁定）：
--   stock 是随购买递减的可变列（0015 的 `UPDATE listing SET stock = stock - quantity`）⇒
--   把该不变式写进库面，正常购买把 stock 从 2 买到 1 就撞 23514、交易链被打断。
--   该不变式只在**写口准入**成立；读面必须容忍「true 且 stock = 1」这个正常终态。
--
-- 文件形状纪律（与 0057/0058/0059/0060 同族）：
--   · 文件内不写 BEGIN / COMMIT（scripts/migrate.ts 逐文件包事务）；
--   · 正文注释里不得出现 dollar-dollar 引号字面（门与 runner 的语句切分器按它切换
--     in-dollar 态，注释里出现一次就会把整块切坏）⇒ 本文件统一写「DO 块」；
--   · 幂等：ADD COLUMN IF NOT EXISTS ⇒ 反复 apply 落同一终态；
--   · 顺序：本迁移必须排在 0060 之后（apply 序 0059 → 0060 → 0061 由 migrate.ts 按版本号
--     升序天然保证）；**不得与 0060 合并成一个文件**（合并后 0060 自检失败会连带本列）。
--
-- 列数（现取核实，2026-10-20 · dev 库 quiet-math-65207667 · information_schema）：
--   已 apply 至 0059 ⇒ listing 实际 **15 列**；0060 再 +2（snowflake_id / item_code）
--   ⇒ **17 列**；本迁移 +1 ⇒ **18 列**。⇒ 尾部自检断言列数 = 18
--   （派单里写的「18 → 19」是推算值；现取实测 15 + 2 + 1 = 18，以实测为准，
--    与 data-layer.spec §40.13.1 的「17 → 18」一致）。
--
-- 零破窗：只加列、不改任何既有列 / 约束 / 函数 ⇒ 旧代码在「已 apply、新码未上线」窗口内
--   照常工作（旧 SELECT 不带该列）。★ 反向顺序禁：新码先上线而本迁移未 apply ⇒
--   三读口（详情 / mine / edit）的 SELECT 必 42703 ⇒ 先 apply 后 push（台账铁律）。
-- ============================================================================

ALTER TABLE public.listing
  ADD COLUMN IF NOT EXISTS allow_multi_buy boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  v_n        int;
  v_col      record;
  v_first    boolean;
  v_true_cnt bigint;
  v_null_cnt bigint;
BEGIN
  -- ⓪ 列在场
  SELECT count(*) INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing'
     AND column_name = 'allow_multi_buy';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0061 self-check FAILED: allow_multi_buy column missing, got % matching columns', v_n;
  END IF;

  -- ① 形状：boolean / NOT NULL / DEFAULT false
  SELECT data_type, is_nullable, column_default INTO v_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing'
     AND column_name = 'allow_multi_buy';
  IF v_col.data_type <> 'boolean' THEN
    RAISE EXCEPTION '0061 self-check FAILED: allow_multi_buy expect boolean, got %', v_col.data_type;
  END IF;
  IF v_col.is_nullable <> 'NO' THEN
    RAISE EXCEPTION '0061 self-check FAILED: allow_multi_buy expect NOT NULL, got is_nullable=%', v_col.is_nullable;
  END IF;
  IF v_col.column_default IS NULL OR position('false' IN lower(v_col.column_default)) = 0 THEN
    RAISE EXCEPTION '0061 self-check FAILED: allow_multi_buy expect DEFAULT false, got default=%',
      COALESCE(v_col.column_default, '<none>');
  END IF;

  -- ② 零三态：NULL 行必须 0（NOT NULL 已保证，此处是取值面自证）
  SELECT count(*) INTO v_null_cnt FROM public.listing WHERE allow_multi_buy IS NULL;
  IF v_null_cnt <> 0 THEN
    RAISE EXCEPTION '0061 self-check FAILED: % rows have NULL allow_multi_buy (two-state only)', v_null_cnt;
  END IF;

  -- ③ 存量全 false（**仅首跑断言**）
  --   ★ 重放免疫：判据 = schema_migration 里还没有 0061 版本行（= 本次是首次 apply）。
  --     首次 apply 时存量行只可能吃到 DEFAULT false ⇒ true 行必为 0；
  --     人工重放（版本行已在）时 true 行属线上真实业务值（卖家已开），再断言即误红
  --     ⇒ 首跑断言、重放跳过（不是放宽判据，而是把判据限定在它成立的那个时刻）。
  SELECT NOT EXISTS (SELECT 1 FROM public.schema_migration WHERE version = '0061') INTO v_first;
  IF v_first THEN
    SELECT count(*) INTO v_true_cnt FROM public.listing WHERE allow_multi_buy IS TRUE;
    IF v_true_cnt <> 0 THEN
      RAISE EXCEPTION '0061 self-check FAILED: % rows have allow_multi_buy = true on first apply (existing rows must all default to false)', v_true_cnt;
    END IF;
  END IF;

  -- ④ 列数 = 18（15 @0059 + 0060 的两列 + 本列）
  SELECT count(*) INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing';
  IF v_n <> 18 THEN
    RAISE EXCEPTION '0061 self-check FAILED: listing expect 18 columns (15 @0059 + 0060 x2 + 0061 x1), got %', v_n;
  END IF;

  -- ⑤ 零库面跨列约束（§40.13.2 / MB-N1：true ⇒ stock >= 2 不得落成 CHECK）
  --   判据 = listing 上不得出现任何提到 allow_multi_buy 的 CHECK 约束。
  SELECT count(*) INTO v_n
    FROM pg_constraint
   WHERE conrelid = 'public.listing'::regclass
     AND contype = 'c'
     AND position('allow_multi_buy' IN pg_get_constraintdef(oid)) > 0;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0061 self-check FAILED: % CHECK constraints reference allow_multi_buy (cross-column invariant belongs to the write path, not the schema)', v_n;
  END IF;
END $$;
