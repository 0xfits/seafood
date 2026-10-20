-- ============================================================================
-- 0056_drop_listing_title.sql
-- 取消商品标题字段（`listing.title` 退场）· **三阶段零破窗 · 阶段 3 = DROP 列**
-- ----------------------------------------------------------------------------
-- 前置（必须已成立，否则本迁移会毁数据）：
--   ① **0055 已 apply**（title 已并入 description：有标题的行 description 以 title 开头）；
--   ② 代码已 push 且**线上读口不再引用 `title` 列**（读口派生 `split_part(description, E'\n', 1)`，
--      写口拒 `title`）—— 顺序 = 0055 apply → push → 本文件 apply。
--
-- 本文件只做一件事：`ALTER TABLE public.listing DROP COLUMN IF EXISTS title`（幂等写法）。
--   · 无索引 / 无视图 / 无函数依赖该列（库内实测：listing 五个触发器与四个索引均不引 title，
--     `pg_depend` 无依赖视图）⇒ 无需 `CASCADE`；
--   · **零 DML**、不回填（回填已由 0055 完成）。
--
-- 文件内**不写 BEGIN/COMMIT**（`scripts/migrate.ts` 逐文件包事务）。
-- 自检（尾部 `DO $$`）：① `title` 列不存在；② 有内容的历史行仍在（行数 > 0 时 description 非空行数 = 行数），
--   空描述行只允许是「本来就没有标题也没有描述」的历史行（有则 RAISE 报数、不判负 —— 0055 无法为它造内容）。
-- ============================================================================

ALTER TABLE public.listing DROP COLUMN IF EXISTS title;

DO $$
DECLARE
  v_title_cols int;
  v_rows       bigint;
  v_empty_desc bigint;
  v_cols       int;
BEGIN
  SELECT count(*) INTO v_title_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing' AND column_name = 'title';

  IF v_title_cols <> 0 THEN
    RAISE EXCEPTION '0056 self-check FAILED: title 列仍存在（DROP 未生效），列数 = %', v_title_cols;
  END IF;

  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing';
  IF v_cols <> 13 THEN
    RAISE EXCEPTION '0056 self-check FAILED: public.listing 应为 13 列（DL59 的 13 列，item_type 计入后 14 → DROP title 后 13），实测 %', v_cols;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE btrim(description) = '')
    INTO v_rows, v_empty_desc
    FROM public.listing;

  IF v_empty_desc > 0 THEN
    RAISE WARNING '0056: % / % 行 description 为空（存量「无标题也无描述」的历史行，无内容可回填）', v_empty_desc, v_rows;
  END IF;

  RAISE NOTICE '0056 OK: title_cols=% listing_cols=% rows=% empty_desc=%', v_title_cols, v_cols, v_rows, v_empty_desc;
END $$;
