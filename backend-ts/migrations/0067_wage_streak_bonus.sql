-- ============================================================================
-- 0067_wage_streak_bonus.sql · 领工资「连续领工资」随机奖励区间配置键
-- ============================================================================
-- 权威口径：Kevin 需求第 4 条（【领工资】带「连续领工资」奖励）· 后端面
--   `docs/data-layer.spec.md` §40.15.4 PR-7（配置键族：建费 project_create_fee 的同族加法）
--   `docs/route-layer.spec.md` §49.19 R5（`POST /api/project/:id/claim` —— 本次响应**加性**追加
--     `streak` / `bonus_amount` / `bonus_kind`，原有字段一字不改）
--
-- 本迁移做什么（**纯加法**：一行配置键）
--   ① 插入 `public.app_config` 键 `wage_streak_bonus`，值 = `{"min":"1","max":"5"}`。
--      · 0017 的 `app_config_value_is_container` CHECK 只收 object/array ⇒ **必须对象包裹**，
--        裸标量 `5` 会被拒（与 0063 的 `project_create_fee` 同一手法，逐字参照）。
--      · `min` / `max` 为**字符串数字**（派单逐字形态），单位 = `$`（平台积分）整数。
--      · `ON CONFLICT (key) DO NOTHING` ⇒ 反复 apply **不覆盖**运维已调过的区间（迁移只补缺行）。
--   ② 尾部 apply-time 自检（任一不满足 ⇒ RAISE ⇒ 整文件回滚、不写版本行）：
--      键恰 1 行 / 值是对象 / `min`、`max` 均为十进制数字串 / `0 < min <= max` /
--      0017 的容器 CHECK 仍在（本迁移不得旁路它）。
--
-- 本迁移**不**做什么（硬边界）
--   · 不改任何表结构：不加列、不加 CHECK、不动 `project_wage_claim`（连续次数 = 该表**行计数**派生，
--     不落冗余列 ⇒ 无「两处真源」）；
--   · 不新增 ledger kind（奖励腿借现取 24 值闭集内的 `invite_first_task_reward`，见服务层注释）；
--   · 不接路由（`src/` 路由注册点仍 128）；不改既有迁移文件（checksum 冻结）。
--
-- 幂等（DL48）：单条 `INSERT … ON CONFLICT DO NOTHING` + 末尾 DO 块自检；本文件**不含** BEGIN/COMMIT
--   （由 `scripts/migrate.ts` 的单文件事务包裹）。
-- ============================================================================

-- ============================================================================
-- ① app_config 键 wage_streak_bonus（连续领工资随机奖励区间，含端点）
-- ============================================================================
INSERT INTO public.app_config (key, value, updated_by)
VALUES ('wage_streak_bonus', '{"min":"1","max":"5"}'::jsonb, 0)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_cnt     int;
  v_val     jsonb;
  v_min     text;
  v_max     text;
  v_chk     int;
BEGIN
  -- ① 键恰 1 行
  SELECT count(*) INTO v_cnt FROM public.app_config WHERE key = 'wage_streak_bonus';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0067 self-check FAILED: app_config.wage_streak_bonus expect exactly 1 row, got %', v_cnt;
  END IF;

  -- ② 值是 JSON **对象**（0017 容器约束的口径；裸标量 / 数组都不合）
  SELECT value INTO v_val FROM public.app_config WHERE key = 'wage_streak_bonus';
  IF jsonb_typeof(v_val) <> 'object' THEN
    RAISE EXCEPTION '0067 self-check FAILED: wage_streak_bonus must be a jsonb object, got %', jsonb_typeof(v_val);
  END IF;

  -- ③ min / max 均为十进制数字串（不接受负数、小数、科学计数、空串）
  v_min := v_val ->> 'min';
  v_max := v_val ->> 'max';
  IF v_min IS NULL OR v_min !~ '^[0-9]+$' THEN
    RAISE EXCEPTION '0067 self-check FAILED: wage_streak_bonus.min must be a digit string, got %', COALESCE(v_min, '<null>');
  END IF;
  IF v_max IS NULL OR v_max !~ '^[0-9]+$' THEN
    RAISE EXCEPTION '0067 self-check FAILED: wage_streak_bonus.max must be a digit string, got %', COALESCE(v_max, '<null>');
  END IF;

  -- ④ 区间合法：0 < min <= max
  IF NOT (v_min::numeric > 0 AND v_max::numeric >= v_min::numeric) THEN
    RAISE EXCEPTION '0067 self-check FAILED: wage_streak_bonus needs 0 < min <= max, got min=% max=%', v_min, v_max;
  END IF;

  -- ⑤ 0017 容器约束仍生效（本迁移不得旁路它）
  SELECT count(*) INTO v_chk FROM pg_constraint
   WHERE conrelid = 'public.app_config'::regclass AND conname = 'app_config_value_is_container';
  IF v_chk <> 1 THEN
    RAISE EXCEPTION '0067 self-check FAILED: app_config_value_is_container CHECK missing (0017 容器约束必须仍生效)';
  END IF;
END $$;
