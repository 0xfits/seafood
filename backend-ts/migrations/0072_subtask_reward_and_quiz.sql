-- ============================================================================
-- 0072_subtask_reward_and_quiz.sql
-- 子任务奖励列（quiz 答对即发奖）＋ prediction 选项恒 Yes/No 的库面口径注明
-- ----------------------------------------------------------------------------
-- 上游：0065_campaign_hierarchy.sql（subtask / subtask_proof 五表）· 0071（种子）
--
-- 为什么本文件存在（Kevin 2026-10-22 两条裁定）：
--   ① **prediction 选项恒 Yes / No** ⇒ 选项文案由前端 i18n 固定，payload 不再存选项文案
--      （新形状 = 恰两键 prize_amount / deadline）；存量四键行（option_a / option_b）继续以 a|b 走，
--      「按 payload 形状分支、两条路共存、禁双开」由服务层保证 —— **本文件不改任何存量 payload**。
--   ② **quiz 发布时填 4 个选项、其中 1–4 个标为正确，用户答对即发奖励** ⇒ 需要一个奖励载体。
--      奖励**不是** payload 键（payload 只放题目与答案），而是子任务自己的列 ⇒ 本迁移加
--      `subtask.reward_amount numeric NULL` ＋ 非负 CHECK。零新表、零新枚举、零新错误码。
--
-- 列语义（服务层写口强约束，库面只兜非负）：
--   · `quiz` 子任务：**必填且 > 0**（答对即由平台收入账户 −N → 用户 +N 发放，同一事务）；
--   · 其余四类（x_verify / onchain_snapshot / survey / prediction）：恒 NULL（写口带 ⇒ 400）；
--   · 可空是**兼容既有行**的必需（0065 起的存量子任务没有奖励概念，不回填、不改写）；
--   · 单位恒 `$`（cid = 1）：与 task 奖励 / prediction 奖池同币种口径，不设币种列（CP-R3 同族）。
--
-- 为什么用 numeric 而不是 bigint：与 task.reward_amount_primary / reward_amount_secondary 同型
--   （既有奖励列全是 numeric），避免跨列比较时的类型强转与出参 `::text` 口径分叉。
--
-- 文件形状纪律（与 0057–0071 同族）：
--   · 文件内**不写 BEGIN / COMMIT**（scripts/migrate.ts 逐文件包事务）；
--   · 注释里**不出现成对美元定界符字面**（切分器按它切换 in-dollar 态）⇒ 统一写「DO 块」；
--   · 幂等：列用 ADD COLUMN IF NOT EXISTS、约束用 DO 块内的存在性守卫 ⇒ 反复 apply 落同一终态；
--   · 只 ALTER 一张表 + 尾部一个自检 DO 块；零 INSERT / UPDATE / DELETE（不碰任何业务行）。
--
-- 尾部自检（不静默半迁移）：
--   A 列在场且可空 · B CHECK 在场且定义含 reward_amount · C prediction 存量 payload 形状零违规
--   （新两键或旧四键二选一，correct_option 若在场必须落在本行口径值域）· D quiz 存量 payload
--   若带 correct 则形状合法 · E 双开零行（prediction 带 correct / quiz 带 option_a）。
-- ============================================================================

ALTER TABLE public.subtask ADD COLUMN IF NOT EXISTS reward_amount numeric NULL;

-- 非负 CHECK（幂等：约束已存在则跳过；名字固定，便于尾部自检与门逐字断言）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.subtask'::regclass
       AND conname = 'subtask_reward_amount_nonneg'
  ) THEN
    ALTER TABLE public.subtask
      ADD CONSTRAINT subtask_reward_amount_nonneg
      CHECK (reward_amount IS NULL OR reward_amount >= 0);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 尾部自检（列 / 约束 / payload 形状零存量违规 / 禁双开）
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_col   int;
  v_cons  int;
  v_pred  int;
  v_quiz  int;
  v_dual  int;
BEGIN
  -- A · 列在场且可空（可空是兼容存量行的必需——别在下一次迁移里擅自收紧成 NOT NULL）
  SELECT count(*) INTO v_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'subtask'
     AND column_name = 'reward_amount' AND is_nullable = 'YES'
     AND data_type = 'numeric';
  IF v_col <> 1 THEN
    RAISE EXCEPTION '0072 self-check FAILED: subtask.reward_amount expect 1 nullable numeric 列, got %', v_col;
  END IF;

  -- B · CHECK 在场且定义含 reward_amount
  SELECT count(*) INTO v_cons
    FROM pg_constraint
   WHERE conrelid = 'public.subtask'::regclass
     AND conname = 'subtask_reward_amount_nonneg'
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%reward_amount%';
  IF v_cons <> 1 THEN
    RAISE EXCEPTION '0072 self-check FAILED: subtask_reward_amount_nonneg 未落成, got %', v_cons;
  END IF;

  -- C · prediction 存量 payload 形状零违规：
  --     新两键 {prize_amount, deadline} 或 旧四键 {option_a, option_b, prize_amount, deadline}
  --     （均可叠一枚 correct_option，且必须落在**本行口径**的值域内）
  SELECT count(*) INTO v_pred
    FROM public.subtask AS s
   WHERE s.type_code = 'prediction'
     AND NOT (
       (
         (s.payload - 'correct_option') ?& ARRAY['prize_amount', 'deadline']
         AND (s.payload - 'correct_option') - ARRAY['prize_amount', 'deadline'] = '{}'::jsonb
         AND (NOT s.payload ? 'correct_option' OR s.payload->>'correct_option' IN ('yes', 'no'))
       )
       OR
       (
         (s.payload - 'correct_option') ?& ARRAY['option_a', 'option_b', 'prize_amount', 'deadline']
         AND (s.payload - 'correct_option') - ARRAY['option_a', 'option_b', 'prize_amount', 'deadline'] = '{}'::jsonb
         AND (NOT s.payload ? 'correct_option' OR s.payload->>'correct_option' IN ('a', 'b'))
       )
     );
  IF v_pred <> 0 THEN
    RAISE EXCEPTION '0072 self-check FAILED: prediction 存量 payload 形状违规 % 行', v_pred;
  END IF;

  -- D · quiz 存量 payload：**带 correct 的行**必须形状合法（两键 + options 恰 a/b/c/d + correct 1–4）
  --     不带 correct 的行属 0072 之前的问卷式存量，按「两条路共存」不回填、不改写（预测同族口径）
  SELECT count(*) INTO v_quiz
    FROM public.subtask AS s
   WHERE s.type_code = 'quiz'
     AND s.payload ? 'correct'
     AND NOT (
       s.payload ?& ARRAY['options', 'correct']
       AND (s.payload - ARRAY['options', 'correct']) = '{}'::jsonb
       AND jsonb_typeof(s.payload->'options') = 'object'
       AND (s.payload->'options') ?& ARRAY['a', 'b', 'c', 'd']
       AND ((s.payload->'options') - ARRAY['a', 'b', 'c', 'd']) = '{}'::jsonb
       AND jsonb_typeof(s.payload->'correct') = 'array'
       AND jsonb_array_length(s.payload->'correct') BETWEEN 1 AND 4
     );
  IF v_quiz <> 0 THEN
    RAISE EXCEPTION '0072 self-check FAILED: quiz 存量 payload 形状违规 % 行', v_quiz;
  END IF;

  -- E · 禁双开：prediction 行不得带 quiz 答案键，quiz 行不得带 prediction 的选项文案键
  SELECT count(*) INTO v_dual
    FROM public.subtask AS s
   WHERE (s.type_code = 'prediction' AND s.payload ? 'correct')
      OR (s.type_code = 'quiz' AND (s.payload ? 'option_a' OR s.payload ? 'option_b'));
  IF v_dual <> 0 THEN
    RAISE EXCEPTION '0072 self-check FAILED: 同一子任务双开两套口径 % 行', v_dual;
  END IF;
END $$;
