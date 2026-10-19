-- 0054 · 2026-10-20 商品分类「数字商品」再拆两类：`listing.item_type` 闭集 3 值 → 4 值，`Digital` 退役
-- ---------------------------------------------------------------------------
-- Kevin 新口径（定名以其最新一条为准）：数字商品再分两类（自动发货 / 手动发货）⇒ 闭集变 **4 值**，
-- 裸值 `Digital` **退役**。闭集（唯一真源 = 本文件 CHECK；服务层 `ITEM_TYPES` 与之逐字一致、顺序一致）：
--   DigitalAutoDeliver    数字商品 · 自动发货
--   DigitalManualDeliver  数字商品 · 手动发货
--   PhysicalFreeShip      实物 · 包邮
--   PhysicalBuyerShip     实物 · 买家付运费
-- 口径：
--   · **只换约束集**：不动列定义（仍是 `text`、仍**可空**）、**零 DML**（无 UPDATE/INSERT/DELETE）、
--     **不回填存量**（apply 前两库现取：dev 26 行 / 生产 7 行，`item_type` 全 `NULL`、`Digital` 行 = 0）。
--   · `NULL` 语义不变 = **未分类**（≠ 任何具体值；前端不渲染标签）。
--   · 裸值 `Digital` 行若存在 ⇒ 本文件**fail-loud**（ADD CONSTRAINT 会先以 23514 拒绝；尾部自检再显式断言 0 行）。
--     ⇒ 换集前必须先把 `Digital` 行对账迁到 `DigitalAutoDeliver`/`DigitalManualDeliver`（属另单的 DML，不在本文件）。
--   · 幂等：先 `DROP CONSTRAINT IF EXISTS` 再 `ADD CONSTRAINT`（显式命名）⇒ 反复 apply 落**同一终态**、
--     库内**恰 1 条**、不会新旧并存。
--   · 文件内**不写** BEGIN/COMMIT（`scripts/migrate.ts` 逐文件包事务）；**不改** 0050–0053 历史文件
--     （checksum 漂移会让 migrate.ts 直接 ABORT）。
ALTER TABLE public.listing DROP CONSTRAINT IF EXISTS listing_item_type_check;

ALTER TABLE public.listing
  ADD CONSTRAINT listing_item_type_check
  CHECK (item_type IS NULL OR item_type IN ('DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip'));

-- 尾部自检（apply 后即验；任一不满足 ⇒ 抛错 ⇒ 整文件事务回滚、不写版本行）
DO $$
DECLARE
  v_type     text;
  v_nullable text;
  v_condef   text;
  v_cons     bigint;
BEGIN
  -- ④ 列仍在场 + 类型 text + 可空（存量 NULL 语义要求 nullable；本文件不改列）
  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing' AND column_name = 'item_type';
  IF v_type IS NULL THEN
    RAISE EXCEPTION '0054 self-check failed: public.listing.item_type missing (0053 must be applied first)';
  END IF;
  IF v_type <> 'text' THEN
    RAISE EXCEPTION '0054 self-check failed: public.listing.item_type type is % (expect text)', v_type;
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION '0054 self-check failed: public.listing.item_type is not nullable (stock rows must stay NULL)';
  END IF;

  -- ① 约束在场且**恰 1 条**（旧三值不得残留、不得与新四值并存）
  SELECT count(*) INTO v_cons
    FROM pg_constraint AS c
   WHERE c.conrelid = 'public.listing'::regclass
     AND c.contype = 'c'
     AND (c.conname = 'listing_item_type_check' OR pg_get_constraintdef(c.oid) LIKE '%item_type%');
  IF v_cons <> 1 THEN
    RAISE EXCEPTION '0054 self-check failed: expect exactly 1 item_type CHECK on public.listing, got %', v_cons;
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO v_condef
    FROM pg_constraint AS c
   WHERE c.conname = 'listing_item_type_check'
     AND c.conrelid = 'public.listing'::regclass
     AND c.contype = 'c';
  IF v_condef IS NULL THEN
    RAISE EXCEPTION '0054 self-check failed: constraint listing_item_type_check missing on public.listing';
  END IF;
  IF v_condef NOT LIKE '%DigitalAutoDeliver%'
     OR v_condef NOT LIKE '%DigitalManualDeliver%'
     OR v_condef NOT LIKE '%PhysicalFreeShip%'
     OR v_condef NOT LIKE '%PhysicalBuyerShip%' THEN
    RAISE EXCEPTION '0054 self-check failed: listing_item_type_check lacks 4-value closed set (def=%)', v_condef;
  END IF;
  -- 退役值：**裸值 `Digital`**（不是前缀）—— 按「整字面 + 终止符（`,` / `)` / 数组收尾 `]`）」判，
  -- 避免 DigitalAutoDeliver / DigitalManualDeliver 误命中（前缀值的终止符是 `A`/`M`，不匹配）。
  IF v_condef ~ '''Digital''(::text)?([,)\]]|$)' THEN
    RAISE EXCEPTION '0054 self-check failed: retired value Digital (bare) still accepted by listing_item_type_check (def=%)', v_condef;
  END IF;
  IF v_condef NOT LIKE '%IS NULL%' THEN
    RAISE EXCEPTION '0054 self-check failed: listing_item_type_check must allow NULL (def=%)', v_condef;
  END IF;

  -- ② 退役值零行：**裸值** `item_type = 'Digital'`（非前缀）行数必须 = 0（换集前须已对账迁移；非 0 ⇒ 整迁移回滚）
  SELECT count(*) INTO v_cons FROM public.listing WHERE item_type = 'Digital';
  IF v_cons <> 0 THEN
    RAISE EXCEPTION '0054 self-check failed: % row(s) still item_type=Digital (retired bare value, expect 0)', v_cons;
  END IF;

  -- ③ 非法值零行（闭集外 / 大小写不符 / 空白串 / 旧三值 `Digital` 全算非法）
  SELECT count(*) INTO v_cons
    FROM public.listing
   WHERE item_type IS NOT NULL
     AND item_type NOT IN ('DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip');
  IF v_cons <> 0 THEN
    RAISE EXCEPTION '0054 self-check failed: % row(s) with item_type outside 4-value closed set', v_cons;
  END IF;
END
$$;
