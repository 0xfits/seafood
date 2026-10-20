-- ============================================================================
-- 0059_listing_edit_log.sql
-- 管理员编辑他人商品的**审计台账**（Kevin 2026-10-20 指令：管理员（如 09b0）
--   可以编辑他人发布的商品；本人编辑 = 现状口径不变，**不落台账**）
-- ----------------------------------------------------------------------------
-- 权威口径（只兑现已冻结的契约，不自行推导）：`docs/data-layer.spec.md` **§40.11.1**
--   （表契约 `EL-1`）· **§40.11.2**（唯一写面 `EL-2`）· **§40.11.3**（零 FK `EL-3`）·
--   **§40.11.5**（本文件内容契约 `EL-5`）· route `§49.15`。§40.11.8 的差额四项
--   （④ 两条 CHECK · ⑤ append-only 触发器）**由本文件补齐**；① `log_id` 型别 / ② `admin_edit`
--   无 DEFAULT / ③ 索引 1 条 = 该段已收敛的口径（以 §40.11.8 为准）。
--
-- ① `public.listing_edit_log`（只增不改的留痕面；**只由 `UPDATE_LISTING_DETAILS_SQL`
--    在同一语句内插入**，无第二条写入面）
--    · `log_id bigserial PK` · `listing_id bigint NOT NULL`（被编辑的商品）
--    · `actor_uid bigint NOT NULL`（发起编辑的管理员）· `owner_uid bigint NOT NULL`
--      （该 listing 的 `seller_uid` 快照 —— 商品日后转手/删除也不改历史行）
--    · `admin_edit boolean NOT NULL`（恒 true：本表**只**记管理员代编；本人编辑零行；
--      **不加 `CHECK (admin_edit)`** —— 保留「将来本人编辑也留痕」的扩展位，
--      改用可判负读数约束：`count(*) WHERE admin_edit = false` 必须 = 0，见 route §49.15.8 #37）
--    · `changed_fields text[] NOT NULL`（**实际变化**的字段名数组，逐项来自 SQL 内
--      逐列 `IS DISTINCT FROM` 比对；未变化字段不入数组 ⇒ 台账可机读、可对拍）
--    · `time_created timestamptz NOT NULL DEFAULT now()`
-- ② **两条 CHECK（`§40.11.1` 逐字）**：
--    · `listing_edit_log_fields_ck` = `changed_fields <@ ARRAY[六字段闭集]::text[]`
--      （闭集是「数组可机读」的前提：任何闭集外字段名 = 写面 bug，库里当场拒）
--    · `listing_edit_log_fields_no_null_ck` = `array_position(changed_fields, NULL) IS NULL`
--      （`text[]` 允许 `{NULL}`，`<@` 对 `NULL` 元素**不报错** ⇒ 只靠闭集抓不住）
-- ③ **append-only（硬）**：`BEFORE UPDATE OR DELETE` 触发器**无条件 `RAISE`**（原生 `P0001`，
--    **不借账本错误码** —— 手法逐字承 `0026 listing_review_log` / `0031 rating` 同族）。
--    诚实边界（全仓同族已知）：不拦 `TRUNCATE` / `DISABLE TRIGGER USER`。
-- ④ 索引 `listing_edit_log_listing_idx (listing_id)`（按商品查编辑史）；actor 轴索引
--    = `§40.11.8 ③` 已收敛的「建议项、不入判负」⇒ 本文件不建（表规模小、无 actor 轴读口）。
-- ⑤ **不建 FK**（有意取舍，同 0058 `listing_view_log`）：台账是留痕账本、不是商品的
--    从属数据 ⇒ 历史商品删除不得阻碍审计行保留（`listing_id`/`owner_uid` 悬挂行随表保留）。
--    本文件尾部自检含「FK 数 = 0」反断言。
-- ⑥ `listing` 表**零 DDL**：本迁移不动商品表（编辑写口放行由代码层 `adminEdit` 开关 +
--    同语句审计落实；归属闸仍在 SQL 内 ⇒ 不可能绕过）。
-- 顺序纪律：
--   · **先 apply 后 push**（与 0057/0058 同族）：若代码先上、本迁移未 apply，管理员代编
--     会因 `listing_edit_log` 不存在而 42P01（本人编辑的 `IF` 分支不插行 ⇒ 不受影响，
--     但本仓不依赖这种「半可用」运行态）⇒ 按「先 apply 后 push」走；
--   · 幂等：`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` /
--     `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`
--     ⇒ 反复 apply 落同一终态；
--   · 零 DML（不回填：历史编辑无痕 = 已知差额，接受并登记）；
--   · 文件内**不写 BEGIN/COMMIT**（`scripts/migrate.ts` 逐文件包事务）；不改历史迁移文件（checksum）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.listing_edit_log (
  log_id         bigserial   NOT NULL,
  listing_id     bigint      NOT NULL,
  actor_uid      bigint      NOT NULL,
  owner_uid      bigint      NOT NULL,
  admin_edit     boolean     NOT NULL,
  changed_fields text[]      NOT NULL,
  time_created   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_edit_log_pk PRIMARY KEY (log_id),
  -- CHECK 1（闭集 · §40.11.1 逐字）：只许六个可编辑字段名
  CONSTRAINT listing_edit_log_fields_ck CHECK (
    changed_fields <@ ARRAY['description','price','stock','media_urls','item_type','item_condition']::text[]
  ),
  -- CHECK 2（禁 NULL 元素 · §40.11.1 逐字）：`<@` 对 NULL 元素不报错 ⇒ 单列一条
  CONSTRAINT listing_edit_log_fields_no_null_ck CHECK (
    array_position(changed_fields, NULL) IS NULL
  )
);

CREATE INDEX IF NOT EXISTS listing_edit_log_listing_idx
  ON public.listing_edit_log (listing_id);

-- append-only 守卫：UPDATE / DELETE 一律拒（原生 P0001，不借账本错误码）
CREATE OR REPLACE FUNCTION public.listing_edit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'listing_edit_log is append-only: % forbidden (log_id=%)',
        TG_OP, COALESCE(OLD.log_id, 0);
END $$;

COMMENT ON FUNCTION public.listing_edit_log_append_only() IS
  '0059：商品编辑台账 append-only（BEFORE UPDATE OR DELETE 无条件 RAISE，原生 P0001，不借账本错误码）。只由迁移创建；体内无 DDL。诚实边界：不拦 TRUNCATE / DISABLE TRIGGER USER。';

DROP TRIGGER IF EXISTS trg_listing_edit_log_append_only ON public.listing_edit_log;
CREATE TRIGGER trg_listing_edit_log_append_only
  BEFORE UPDATE OR DELETE ON public.listing_edit_log
  FOR EACH ROW EXECUTE FUNCTION public.listing_edit_log_append_only();

-- 尾部自检（apply 后即验；任一不满足 ⇒ 抛错 ⇒ 整文件事务回滚、不写版本行）
DO $$
DECLARE
  v_cols     int;
  v_type     text;
  v_default  text;
  v_nullable text;
  v_pk       int;
  v_idx      int;
  v_fk       int;
  v_ck       int;
  v_trg      int;
  v_covers   int;
  v_rows     int;
  v_def      text;
BEGIN
  -- ① 表在场 + 七列逐列（名称齐全）
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log'
     AND column_name IN ('log_id', 'listing_id', 'actor_uid', 'owner_uid', 'admin_edit', 'changed_fields', 'time_created');
  IF v_cols <> 7 THEN
    RAISE EXCEPTION '0059 self-check FAILED: listing_edit_log expect 7 named columns, got %', v_cols;
  END IF;

  -- ② log_id = bigserial PK（bigint NOT NULL nextval）
  SELECT data_type, column_default, is_nullable INTO v_type, v_default, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log' AND column_name = 'log_id';
  IF v_type <> 'bigint' OR v_nullable <> 'NO' OR v_default NOT LIKE 'nextval%' THEN
    RAISE EXCEPTION '0059 self-check FAILED: log_id expect bigserial PK (bigint NOT NULL nextval), got %/%/%',
      v_type, v_nullable, COALESCE(v_default, 'NULL');
  END IF;
  SELECT count(*) INTO v_pk FROM pg_constraint
   WHERE conrelid = 'public.listing_edit_log'::regclass AND contype = 'p';
  IF v_pk <> 1 THEN
    RAISE EXCEPTION '0059 self-check FAILED: expect exactly 1 primary key, got %', v_pk;
  END IF;

  -- ③ listing_id / actor_uid / owner_uid = bigint NOT NULL（零 FK 的自证前提：类型仍须对）
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log'
     AND column_name IN ('listing_id', 'actor_uid', 'owner_uid')
     AND data_type = 'bigint' AND is_nullable = 'NO';
  IF v_cols <> 3 THEN
    RAISE EXCEPTION '0059 self-check FAILED: listing_id/actor_uid/owner_uid expect bigint NOT NULL x3, got %', v_cols;
  END IF;

  -- ④ admin_edit = boolean NOT NULL（无默认：写入方必须显式给值）
  SELECT data_type, is_nullable, column_default INTO v_type, v_nullable, v_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log' AND column_name = 'admin_edit';
  IF v_type <> 'boolean' OR v_nullable <> 'NO' OR v_default IS NOT NULL THEN
    RAISE EXCEPTION '0059 self-check FAILED: admin_edit expect boolean NOT NULL WITHOUT default, got %/%/%',
      v_type, v_nullable, COALESCE(v_default, 'NULL');
  END IF;

  -- ⑤ changed_fields = text[] NOT NULL（字段名数组；与实际变化逐项对拍）
  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log' AND column_name = 'changed_fields';
  IF v_type <> 'ARRAY' OR v_nullable <> 'NO' THEN
    RAISE EXCEPTION '0059 self-check FAILED: changed_fields expect text[] NOT NULL, got %/%', v_type, v_nullable;
  END IF;
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log' AND column_name = 'changed_fields'
     AND udt_name = '_text';
  IF v_cols <> 1 THEN
    RAISE EXCEPTION '0059 self-check FAILED: changed_fields udt expect _text, got %', v_cols;
  END IF;

  -- ⑥ time_created = timestamptz NOT NULL DEFAULT now()
  SELECT data_type, column_default, is_nullable INTO v_type, v_default, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_edit_log' AND column_name = 'time_created';
  IF v_type <> 'timestamp with time zone' OR v_nullable <> 'NO' OR v_default NOT LIKE 'now()%' THEN
    RAISE EXCEPTION '0059 self-check FAILED: time_created expect timestamptz NOT NULL DEFAULT now(), got %/%/%',
      v_type, v_nullable, COALESCE(v_default, 'NULL');
  END IF;

  -- ⑦ 索引 listing_edit_log_listing_idx (listing_id) 在场
  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'listing_edit_log' AND indexname = 'listing_edit_log_listing_idx'
     AND indexdef LIKE '%(listing_id)%';
  IF v_idx <> 1 THEN
    RAISE EXCEPTION '0059 self-check FAILED: index listing_edit_log_listing_idx(listing_id) missing, got %', v_idx;
  END IF;

  -- ⑧ 零 FK（有意取舍：台账独立保留；出现 FK ⇒ 迁移写错，立即回滚）
  SELECT count(*) INTO v_fk FROM pg_constraint
   WHERE conrelid = 'public.listing_edit_log'::regclass AND contype = 'f';
  IF v_fk <> 0 THEN
    RAISE EXCEPTION '0059 self-check FAILED: expect 0 foreign keys (log survives listing deletion), got %', v_fk;
  END IF;

  -- ⑨ 两条 CHECK 齐（§40.11.1 ④）：闭集 `<@` + 禁 NULL 元素
  SELECT count(*) INTO v_ck FROM pg_constraint
   WHERE conrelid = 'public.listing_edit_log'::regclass AND contype = 'c'
     AND conname IN ('listing_edit_log_fields_ck', 'listing_edit_log_fields_no_null_ck');
  IF v_ck <> 2 THEN
    RAISE EXCEPTION '0059 self-check FAILED: expect 2 named CHECKs (fields_ck + fields_no_null_ck), got %', v_ck;
  END IF;
  -- 闭集 CHECK 必须真的含六个字段名与 `<@`（不是同名空壳）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.listing_edit_log'::regclass AND conname = 'listing_edit_log_fields_ck';
  IF v_def IS NULL
     OR position('<' IN v_def) = 0
     OR (SELECT count(*) FROM unnest(ARRAY['description','price','stock','media_urls','item_type','item_condition']) AS f(name)
          WHERE position('''' || f.name || '''' IN v_def) > 0) <> 6 THEN
    RAISE EXCEPTION '0059 self-check FAILED: fields_ck 闭集不是六字段子集判定，实际=%', COALESCE(v_def, '<none>');
  END IF;
  -- 禁 NULL 元素 CHECK 必须引用 array_position(…, NULL)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.listing_edit_log'::regclass AND conname = 'listing_edit_log_fields_no_null_ck';
  IF v_def IS NULL OR position('array_position' IN lower(v_def)) = 0 THEN
    RAISE EXCEPTION '0059 self-check FAILED: fields_no_null_ck 未引用 array_position，实际=%', COALESCE(v_def, '<none>');
  END IF;

  -- ⑩ append-only 触发器：恰 1 个启用触发器（tgenabled = 'O'）且覆盖 UPDATE OR DELETE
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'listing_edit_log'
     AND NOT t.tgisinternal AND t.tgenabled = 'O';
  IF v_trg <> 1 THEN
    RAISE EXCEPTION '0059 self-check FAILED: listing_edit_log enabled triggers = %, expect 1', v_trg;
  END IF;
  SELECT count(*) INTO v_covers FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'listing_edit_log' AND NOT t.tgisinternal
     AND (t.tgtype & 2) <> 0 AND (t.tgtype & 8) <> 0 AND (t.tgtype & 16) <> 0;
  IF v_covers <> 1 THEN
    RAISE EXCEPTION '0059 self-check FAILED: append-only trigger must cover BEFORE UPDATE OR DELETE, got %', v_covers;
  END IF;
  IF to_regprocedure('public.listing_edit_log_append_only()') IS NULL THEN
    RAISE EXCEPTION '0059 self-check FAILED: function public.listing_edit_log_append_only() missing';
  END IF;

  -- ⑪ 存量行数 = 0（本迁移零 DML · 不回填）
  SELECT count(*) INTO v_rows FROM public.listing_edit_log;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '0059 self-check FAILED: listing_edit_log expect 0 rows on fresh apply, got %', v_rows;
  END IF;
END $$;
