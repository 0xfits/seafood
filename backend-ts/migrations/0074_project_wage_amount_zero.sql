-- 0074 · 招工次币金额允许 0（Kevin 2026-10-23）
-- ---------------------------------------------------------------------------
-- 语义变更：`wage_currency_amount = 0` 合法 —— 表示「该次币腿不发钱」（领薪时整段跳过：
-- 不查金库、不写台账、不报错），保留 `wage_cid` 以便项目页与工资行仍显示币种。
-- 0063 的 `project_wage_amount_check` 是 `> 0`，这里重建为 `>= 0`；
-- 两字段成对约束（同空同非空）不在 CHECK 里，由服务层守（`PROJECT_WAGE_CURRENCY_PAIR_REQUIRED`）。
--
-- 幂等：DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT；尾部自检两件事
--   ① 约束体允许 0（`>= 0` 形态）
--   ② 存量数据无负数（若有负数说明历史已脏，直接 raise 让操作者看清）
-- 本文件不写 BEGIN/COMMIT（`scripts/migrate.ts` 逐文件包事务）。

ALTER TABLE public.project DROP CONSTRAINT IF EXISTS project_wage_amount_check;

ALTER TABLE public.project
  ADD CONSTRAINT project_wage_amount_check
  CHECK (wage_currency_amount IS NULL OR wage_currency_amount >= 0);

DO $$
DECLARE
  v_def text;
  v_bad integer;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.project'::regclass
     AND conname = 'project_wage_amount_check';
  IF v_def IS NULL THEN
    RAISE EXCEPTION '0074 self-check FAILED: project_wage_amount_check 不存在';
  END IF;
  -- PG 规范化后形如 `CHECK (((wage_currency_amount IS NULL) OR (wage_currency_amount >= (0)::numeric)))`
  IF v_def !~ '>=\s*\(?\s*0' THEN
    RAISE EXCEPTION '0074 self-check FAILED: 约束体未放宽到 >= 0，实际=%', v_def;
  END IF;

  SELECT count(*) INTO v_bad FROM public.project WHERE wage_currency_amount < 0;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '0074 self-check FAILED: 存量负数 wage_currency_amount 共 % 行', v_bad;
  END IF;

  RAISE NOTICE '0074 applied: wage_currency_amount >= 0 allowed (def=%)', v_def;
END $$;
