-- ============================================================================
-- 0041_job_headcount.sql · P9 · `public.job` 新增「招募名额」列 `headcount`
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · 需求 **`R-9-97`**（Kevin 定档）：task（招工）**无「申请报名」逻辑**；悬赏家发布 task
--     时**须说明总人数**（= 招募名额上限）；**每个合格提交都发奖**（合格即发，不按名额截断）；
--     发布时**押全款 = `reward × 人数`**。⇒ `public.job` 需新增**名额列**（本迁移）。
--   · 本列语义（逐字兑现 `R-9-97`）：
--       `headcount` = 悬赏家发布时**必填**的**招募人数上限**（`>= 1`）；
--       存量行（`R-9-97` 之前发布、无此字段）**backfill = 1**。
--   · 名额最小口径：`headcount >= 1`（CHECK 约束名 `job_headcount_min`）；
--     发布押金 `reward × headcount` 的**派生/校验不属本迁移**（属路由/编排后续单）。
--
-- 本迁移做什么
--   ① `ALTER TABLE public.job ADD COLUMN IF NOT EXISTS headcount bigint NOT NULL DEFAULT 1`
--   ② 存量 backfill：`UPDATE public.job SET headcount = 1 WHERE headcount IS NULL`
--      （`DEFAULT 1` 在 `ADD COLUMN` 时已填充存量行；此句为**显式兜底**，幂等无害）
--   ③ CHECK 约束 `job_headcount_min`：`headcount >= 1`
--      （幂等手法：先 `DROP CONSTRAINT IF EXISTS` 再 `ADD CONSTRAINT`；删/加 CHECK **不丢数据**）
--   ④ `COMMENT ON COLUMN` 记录语义（便于库面自释）
--   ⑤ 末尾 apply-time `DO` 自检（结构断言：列在场 + 类型/可空 + 约束在场 + 无 NULL；
--      不通过 ⇒ RAISE ⇒ 整迁移回滚、**不写版本行**）
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0040` 任何文件字节**（checksum 冻结；`migrate.ts` 会整链 ABORT/exit 3）
--   · 不改任何既有列 / 约束 / 索引 / 触发器 / 函数；不新增 kind；不新增错误码
--   · 不写任何业务数据（**纯 DDL + 存量 backfill**）；不 `DELETE` / `TRUNCATE` / `DROP` 列
--   · 不接路由（`src/**` 本单不改）
--
-- 幂等（DL48）：`ADD COLUMN IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`；
--   末尾 apply-time `DO` 自检；任一失败 ⇒ 整迁移回滚、不写版本行。
-- 备注：`0013_job.sql` 的 apply-time 断言「public.job 恰 14 列（DL50）」只在其**自身**事务内生效
--   （`0013` 已 apply，`migrate.ts` 按 checksum 跳过、不重跑其自检）⇒ 本迁移把列数显式扩为 **15**，
--   **不动 `0013` 字节**，二者不冲突。
-- ============================================================================

-- ---------------------------------------------------------------- ① 新增列
ALTER TABLE public.job
  ADD COLUMN IF NOT EXISTS headcount bigint NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------- ② 存量 backfill
--   （`ADD COLUMN ... DEFAULT 1` 已填充存量行 ⇒ 本句通常 0 行；显式写出以兜底「若曾以可空形态存在」）
UPDATE public.job SET headcount = 1 WHERE headcount IS NULL;

-- ---------------------------------------------------------------- ③ CHECK 约束（幂等：先 DROP 再 ADD；不丢数据）
ALTER TABLE public.job DROP CONSTRAINT IF EXISTS job_headcount_min;
ALTER TABLE public.job ADD CONSTRAINT job_headcount_min CHECK (headcount >= 1);

-- ---------------------------------------------------------------- ④ 列注释（库面自释）
COMMENT ON COLUMN public.job.headcount IS
  'R-9-97：招募名额上限（悬赏家发布 task 时必填，>= 1）；发布押金 = reward × headcount。存量行 backfill = 1。';

-- ============================================================================
-- ⑤ apply-time 自检（DL48：不通过 ⇒ 整迁移回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_n      int;
  v_type   text;
  v_null   text;
  v_def    text;
  v_isnull int;
  v_rows   int;
BEGIN
  -- 5.1 列在场（恰 1 列）
  SELECT count(*)::int INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'job' AND column_name = 'headcount';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0041 self-check FAILED: public.job.headcount column not found (n=%)', v_n;
  END IF;

  -- 5.2 列型/可空：bigint NOT NULL
  SELECT c.data_type, c.is_nullable INTO v_type, v_null
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'job' AND c.column_name = 'headcount';
  IF v_type <> 'bigint' OR v_null <> 'NO' THEN
    RAISE EXCEPTION '0041 self-check FAILED: headcount type/nullable wrong (type=%, nullable=%)', v_type, v_null;
  END IF;

  -- 5.3 约束在场（CHECK）
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.job'::regclass AND conname = 'job_headcount_min' AND contype = 'c';
  IF v_def IS NULL THEN
    RAISE EXCEPTION '0041 self-check FAILED: constraint job_headcount_min missing';
  END IF;

  -- 5.4 存量无 NULL（backfill 完备性）
  SELECT count(*)::int INTO v_isnull FROM public.job WHERE headcount IS NULL;
  IF v_isnull <> 0 THEN
    RAISE EXCEPTION '0041 self-check FAILED: % rows with headcount IS NULL', v_isnull;
  END IF;

  SELECT count(*)::int INTO v_rows FROM public.job;
  RAISE NOTICE '0041 self-check OK: public.job.headcount bigint NOT NULL DEFAULT 1; job_headcount_min=%; rows=% (headcount IS NULL = 0)',
    v_def, v_rows;
END $$;
