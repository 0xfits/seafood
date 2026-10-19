-- 0053 · 2026-10-20 商品分类枚举（Kevin 第 5 条）：`listing.item_type`
-- ---------------------------------------------------------------------------
-- 枚举（唯一真源 = 本文件 CHECK 闭集；服务层 `ITEM_TYPES` 与之逐字一致）：
--   enum ItemType { Digital = "Digital", PhysicalFreeShip = "PhysicalFreeShip",
--                   PhysicalBuyerShip = "PhysicalBuyerShip" }
-- 语义：Digital = 虚拟/数字商品 · PhysicalFreeShip = 实物包邮 · PhysicalBuyerShip = 实物买家付运费。
-- 口径：
--   · 新列**可空**；**存量行一律保持 NULL**（= 未分类，前端不显示标签）——本文件**不回填**、不设默认。
--   · 闭集只由 CHECK 表达（不加 PG enum 类型：枚举后续扩值要 ALTER TYPE，CHECK 改一次性、且幂等重跑安全）。
--   · 本单只做数据面：写口 = `POST /api/listing` 可选 `item_type`；`PATCH /api/listing/:id`（状态迁移）
--     与 `POST /api/listing/:id`（编辑）**均不改类型**（分类创建后不可变）。
--   · 文件内**不写** BEGIN/COMMIT（`scripts/migrate.ts` 逐文件包事务）；幂等：列 `IF NOT EXISTS`、
--     约束先查 `pg_constraint` 再 ADD ⇒ 重跑零副作用。
--   · 不改 0050-0052 历史文件（checksum 漂移会让 migrate.ts 直接 abort）。
ALTER TABLE public.listing ADD COLUMN IF NOT EXISTS item_type text;

-- 三值闭集约束（幂等：按 **表 + 约束名** 查 pg_constraint，不用 `ADD CONSTRAINT IF NOT EXISTS` ——
-- PG 无该语法，`DO` 块是等价写法；`conrelid` 限定 `public.listing` ⇒ 不误查同名其它表）。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'listing_item_type_check'
       AND conrelid = 'public.listing'::regclass
  ) THEN
    ALTER TABLE public.listing
      ADD CONSTRAINT listing_item_type_check
      CHECK (item_type IS NULL OR item_type IN ('Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip'));
  END IF;
END
$$;

-- 尾部自检（apply 后即验；任一不满足 ⇒ 抛错 ⇒ 整文件事务回滚、不写版本行）
DO $$
DECLARE
  v_type       text;
  v_nullable   text;
  v_condef     text;
  v_bad_rows   bigint;
BEGIN
  -- ① 列在场 + 类型 text + 可空（存量 NULL 语义要求 nullable）
  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing' AND column_name = 'item_type';
  IF v_type IS NULL THEN
    RAISE EXCEPTION '0053 self-check failed: public.listing.item_type missing';
  END IF;
  IF v_type <> 'text' THEN
    RAISE EXCEPTION '0053 self-check failed: public.listing.item_type type is % (expect text)', v_type;
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION '0053 self-check failed: public.listing.item_type is not nullable (stock rows must stay NULL)';
  END IF;

  -- ② 约束在场且定义含三值闭集（逐字取 pg_get_constraintdef；三个值必须都在定义里）
  SELECT pg_get_constraintdef(c.oid) INTO v_condef
    FROM pg_constraint AS c
   WHERE c.conname = 'listing_item_type_check'
     AND c.conrelid = 'public.listing'::regclass
     AND c.contype = 'c';
  IF v_condef IS NULL THEN
    RAISE EXCEPTION '0053 self-check failed: constraint listing_item_type_check missing on public.listing';
  END IF;
  IF v_condef NOT LIKE '%Digital%'
     OR v_condef NOT LIKE '%PhysicalFreeShip%'
     OR v_condef NOT LIKE '%PhysicalBuyerShip%' THEN
    RAISE EXCEPTION '0053 self-check failed: listing_item_type_check definition lacks closed set (def=%)', v_condef;
  END IF;
  IF v_condef NOT LIKE '%IS NULL%' THEN
    RAISE EXCEPTION '0053 self-check failed: listing_item_type_check must allow NULL (def=%)', v_condef;
  END IF;

  -- ③ 存量零回填（两口径都判）：(a) 表内非法值 0 行；(b) `item_type IS NOT NULL` 行数 = 0。
  --   (b) 是 apply 时点断言（「存量行一律 NULL」）；本文件只由 `scripts/migrate.ts` 一次性执行，
  --   已应用后 checksum 守卫不会重放 ⇒ 上线后有人手工 `psql -f` 重跑才会在此抛错（预期 fail-loud）。
  SELECT count(*) INTO v_bad_rows
    FROM public.listing
   WHERE item_type IS NOT NULL
     AND item_type NOT IN ('Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip');
  IF v_bad_rows <> 0 THEN
    RAISE EXCEPTION '0053 self-check failed: % row(s) with item_type outside closed set', v_bad_rows;
  END IF;

  SELECT count(*) INTO v_bad_rows FROM public.listing WHERE item_type IS NOT NULL;
  IF v_bad_rows <> 0 THEN
    RAISE EXCEPTION '0053 self-check failed: % stock row(s) backfilled with item_type (expect 0, stock must stay NULL)', v_bad_rows;
  END IF;
END
$$;
