-- ============================================================================
-- 0057_listing_view_count.sql
-- 详情页浏览计数 + 商品成色（Kevin 2026-10-20 详情页改版 · 后端件 · **一文件两列**）
-- ----------------------------------------------------------------------------
-- ① `listing.view_count bigint NOT NULL DEFAULT 0`（+ 具名 CHECK `>= 0`）
--    · 消费口 = 详情读口（`GET /api/prize/:bID`）专用「自增 + 读」单语句 CTE
--      （`database.ts` `getPrizeDetailRecordingView`：`UPDATE … RETURNING` 先 +1、
--      外层 SELECT 读回**自增后**值 ⇒ 响应加性键 `views`；同批详情另有加性 `condition`
--      （本文件 ② 的 item_condition）与 `wants`（收藏计数、与 feed 同源 left join）
--      ⇒ 详情 data 顶层 47→**50**）；
--    · 简单计数口径：**任何状态都计**（不过滤 status，直链 draft 仍可看）、**不区分访问者**、
--      **卖家自看也计**（去重 / 自看排除策略挂 OPEN-ITEMS 待裁）；
--    · feed（`/api/prize/all`、`/api/home`）**不计数、不加键**（`listBrands` 不选该列 ⇒ 行键 48 不变）；
--    · **零索引**（详情读按 `listing_id` 主键定位；浏览计数每次详情读都要写一行，索引无益，尾部自检断言 0）。
-- ② `listing.item_condition text` 可空（+ 具名 CHECK 四值闭集）
--    · 闭集（唯一真源 = 本文件 CHECK；服务层 `ITEM_CONDITIONS` 与之逐字一致、顺序一致）：
--        BrandNewSealed = 全新未拆封 · LikeNew = 几乎全新
--        MinorWear      = 细微磕碰划痕 · HeavyWear = 严重磨损
--    · **数字商品不适用**：非空仅允许 `item_type ∈ {PhysicalFreeShip, PhysicalBuyerShip}`
--      （闸在服务层写口：创建 `createListing` / 编辑 `updateListingDetails` 同规则，非法 400；
--      `NULL` = 无成色 / 数字商品 / 未分类，前端不渲染成色标签）；
--    · 存量行**不回填**（apply 后全 `NULL` = 无成色，显示层无标签，与 `item_type` 0053 同体例）。
-- 口径：
--   · 幂等：`ADD COLUMN IF NOT EXISTS`（具名 CHECK 随列同加）⇒ 反复 apply 落**同一终态**、不会新旧并存；
--   · **零 DML**（无 UPDATE/INSERT/DELETE）、零索引、不回填、不改任何既有列；
--   · 文件内**不写 BEGIN/COMMIT**（`scripts/migrate.ts` 逐文件包事务）；**不改 0050–0056 历史文件**
--     （checksum 漂移会让 migrate.ts 直接 ABORT）；
--   · 顺序纪律：**先 apply 后 push**（代码里的 `view_count` / `item_condition` 引用在列缺席的库上
--     会 42703 ⇒ 读口 503，故本迁移必须先于含本单代码的部署 apply）。
-- ============================================================================

ALTER TABLE public.listing
  ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0
  CONSTRAINT listing_view_count_check CHECK (view_count >= 0);

ALTER TABLE public.listing
  ADD COLUMN IF NOT EXISTS item_condition text
  CONSTRAINT listing_item_condition_check
  CHECK (item_condition IS NULL OR item_condition IN ('BrandNewSealed', 'LikeNew', 'MinorWear', 'HeavyWear'));

-- 尾部自检（apply 后即验；任一不满足 ⇒ 抛错 ⇒ 整文件事务回滚、不写版本行）
DO $$
DECLARE
  v_type     text;
  v_default  text;
  v_nullable text;
  v_nonzero  bigint;
  v_cons     int;
  v_cols     int;
  v_idx      int;
  v_condef   text;
BEGIN
  -- ① view_count：在场 + 类型 bigint + 默认 0 + NOT NULL
  SELECT data_type, column_default, is_nullable INTO v_type, v_default, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing' AND column_name = 'view_count';
  IF v_type IS NULL THEN
    RAISE EXCEPTION '0057 self-check FAILED: public.listing.view_count missing';
  END IF;
  IF v_type <> 'bigint' THEN
    RAISE EXCEPTION '0057 self-check FAILED: view_count type is % (expect bigint)', v_type;
  END IF;
  IF v_default IS NULL OR btrim(v_default) <> '0' THEN
    RAISE EXCEPTION '0057 self-check FAILED: view_count default is % (expect 0)', COALESCE(v_default, 'NULL');
  END IF;
  IF v_nullable <> 'NO' THEN
    RAISE EXCEPTION '0057 self-check FAILED: view_count must be NOT NULL';
  END IF;

  -- ② 存量行全 0（ADD COLUMN DEFAULT 之下 apply 刻不可能非 0；非 0 ⇒ 有异物 ⇒ 整迁移回滚）
  SELECT count(*) INTO v_nonzero FROM public.listing WHERE view_count <> 0;
  IF v_nonzero <> 0 THEN
    RAISE EXCEPTION '0057 self-check FAILED: % row(s) with view_count <> 0 right after ADD COLUMN', v_nonzero;
  END IF;

  -- ③ view_count CHECK 在场且恰 1 条
  SELECT count(*) INTO v_cons FROM pg_constraint
   WHERE conrelid = 'public.listing'::regclass AND conname = 'listing_view_count_check' AND contype = 'c';
  IF v_cons <> 1 THEN
    RAISE EXCEPTION '0057 self-check FAILED: listing_view_count_check count = % (expect 1)', v_cons;
  END IF;

  -- ④ item_condition：在场 + 类型 text + 可空（NULL = 无成色 / 数字商品 / 未分类）
  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing' AND column_name = 'item_condition';
  IF v_type IS NULL THEN
    RAISE EXCEPTION '0057 self-check FAILED: public.listing.item_condition missing';
  END IF;
  IF v_type <> 'text' THEN
    RAISE EXCEPTION '0057 self-check FAILED: item_condition type is % (expect text)', v_type;
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION '0057 self-check FAILED: item_condition must be nullable (digital / uncategorized rows stay NULL)';
  END IF;

  -- ⑤ item_condition CHECK 在场恰 1 条 + 四值闭集逐字在场
  SELECT count(*) INTO v_cons FROM pg_constraint
   WHERE conrelid = 'public.listing'::regclass AND conname = 'listing_item_condition_check' AND contype = 'c';
  IF v_cons <> 1 THEN
    RAISE EXCEPTION '0057 self-check FAILED: listing_item_condition_check count = % (expect 1)', v_cons;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_condef FROM pg_constraint
   WHERE conrelid = 'public.listing'::regclass AND conname = 'listing_item_condition_check';
  IF v_condef NOT LIKE '%BrandNewSealed%' OR v_condef NOT LIKE '%LikeNew%'
     OR v_condef NOT LIKE '%MinorWear%' OR v_condef NOT LIKE '%HeavyWear%' THEN
    RAISE EXCEPTION '0057 self-check FAILED: item_condition CHECK lacks 4-value closed set (def=%)', v_condef;
  END IF;

  -- ⑥ 存量成色零非法行（ADD COLUMN 后全 NULL ⇒ 结构上 0；非 0 ⇒ 整迁移回滚）
  SELECT count(*) INTO v_nonzero FROM public.listing
   WHERE item_condition IS NOT NULL
     AND item_condition NOT IN ('BrandNewSealed', 'LikeNew', 'MinorWear', 'HeavyWear');
  IF v_nonzero <> 0 THEN
    RAISE EXCEPTION '0057 self-check FAILED: % row(s) with item_condition outside 4-value closed set', v_nonzero;
  END IF;

  -- ⑦ 零索引：listing 上不得出现引用新两列的索引（浏览计数面主键足矣）
  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'listing'
     AND (indexdef LIKE '%view_count%' OR indexdef LIKE '%item_condition%');
  IF v_idx <> 0 THEN
    RAISE EXCEPTION '0057 self-check FAILED: % index(es) reference the new columns (expect 0 — zero-index migration)', v_idx;
  END IF;

  -- ⑧ 列数守恒：0056 后 13 列 → 本文件后 15 列（+view_count +item_condition）
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing';
  IF v_cols <> 15 THEN
    RAISE EXCEPTION '0057 self-check FAILED: public.listing expect 15 columns after 0057 (13 after 0056 + 2), got %', v_cols;
  END IF;

  RAISE NOTICE '0057 OK: view_count bigint NOT NULL DEFAULT 0 (+CHECK>=0) · item_condition text nullable (+CHECK 4-value) · listing_cols=%', v_cols;
END
$$;
