-- 0075 · 任务/活动奖励改「待领取」+ 每次动作扣 1 电量（Kevin 2026-10-23 裁定）
-- ---------------------------------------------------------------------------
-- 三块结构（本文件不写 BEGIN/COMMIT，scripts/migrate.ts 逐文件包事务）：
--
--   ① `subtask_proof` 两枚加性列：
--      · `reward_due_units numeric NULL` —— **应得奖快照**（$ units；提交/结算资格成立时由写口落值）。
--        「应得」语义：quiz 答对 / 三类提交（reward_amount > 0）⇒ 提交时快照；prediction 胜方
--        ⇒ settle 时按 floor(prize ÷ 胜者数) 快照。存量行恒 NULL ⇒ 不产生任何待领
--        （历史即时发放的奖励不追缴、已提交的旧 proof 不重复可领 —— 存量兼容口径）。
--      · `reward_claimed_at timestamptz NULL` —— 领取时间。**待领谓词 = reward_due_units > 0
--        AND reward_claimed_at IS NULL**（重提覆盖不重置 claimed_at ⇒ 同一 (subtask, uid) 至多领一次）。
--
--   ② 新表 `campaign_task_reward_pending`：task 完成奖改「管理员 grant ⇒ 落 pending 行，不再直接动账」。
--      主键 (task_id, uid) 一人一行；次币腿以两枚可空列随行（`amount_secondary_units` / `cid_secondary`，
--      服务层成对落值 —— 同 task 奖励既有「主 $ + 可选次币」两腿形状）。
--
--   ③ 电量平台腿容纳（扣的电量进平台 uid 0，两腿台账 = batt_account 两行 + batt_entry 两条）：
--      · `batt_account_uid_fk`（FK → users(uid)）无法表达「uid = 0 豁免」—— users_uid_positive
--        CHECK (uid > 0) ⇒ 库里不可能存在 users.uid = 0 行。以 BEFORE 触发器守卫重建同一完整性：
--        uid <> 0 时仍必须存在 users 行（违者原生 ERRCODE 23503，与 FK 同码），uid = 0 平台豁免。
--      · `batt_account_range` / `batt_entry_after_guard` 两枚 CHECK 放宽为
--        `uid = 0 OR (... BETWEEN 0 AND 100)`：平台累计无上限；**真实用户的 0..100 钳制原样保留**
--        （p8-s9 K1 的 DB 兜底判据与 K6 的 23514 反事實不回退 —— 违规直插仍必红）。
--      · 平台账户行 `(0, 0)` 随迁移播种（幂等 DO NOTHING）。

ALTER TABLE public.subtask_proof
  ADD COLUMN IF NOT EXISTS reward_due_units numeric;

ALTER TABLE public.subtask_proof
  ADD COLUMN IF NOT EXISTS reward_claimed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.campaign_task_reward_pending (
  task_id                bigint      NOT NULL,
  uid                    bigint      NOT NULL,
  cid                    bigint      NOT NULL,
  amount_units           numeric     NOT NULL,
  amount_secondary_units numeric,
  cid_secondary          bigint,
  granted_at             timestamptz NOT NULL DEFAULT now(),
  claimed_at             timestamptz,
  CONSTRAINT campaign_task_reward_pending_pk        PRIMARY KEY (task_id, uid),
  CONSTRAINT campaign_task_reward_pending_amount_ck CHECK (amount_units > 0),
  CONSTRAINT campaign_task_reward_pending_secondary_ck
    CHECK ((amount_secondary_units IS NULL AND cid_secondary IS NULL)
        OR (amount_secondary_units IS NOT NULL AND cid_secondary IS NOT NULL))
);

COMMENT ON TABLE public.campaign_task_reward_pending IS
  '活动任务完成奖「待领取」行（Kevin 2026-10-23 裁定：管理员 grant 只落资格、不直接动账；用户点领取时才扣 1 电量并两腿发奖）。PK(task_id, uid) 一人一行；cid/amount_units = 主奖励（$）；amount_secondary_units/cid_secondary = 可选次币腿（成对 NULL 或成对非 NULL）；claimed_at IS NULL = 待领。append 无 UPDATE 语义守卫：领取只回填 claimed_at。';

CREATE INDEX IF NOT EXISTS idx_campaign_task_reward_pending_uid_open
  ON public.campaign_task_reward_pending (uid)
  WHERE claimed_at IS NULL;

-- ③a FK → 触发器守卫（uid = 0 平台豁免，其余保持 FK 完整性）
ALTER TABLE public.batt_account DROP CONSTRAINT IF EXISTS batt_account_uid_fk;

CREATE OR REPLACE FUNCTION public.batt_account_user_fk_guard() RETURNS trigger
AS $fn$
BEGIN
  IF NEW.uid <> 0 AND NOT EXISTS (SELECT 1 FROM public.users WHERE uid = NEW.uid) THEN
    RAISE EXCEPTION 'batt_account.uid % has no users row (FK batt_account_uid_fk: platform uid 0 exempt only)', NEW.uid
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batt_account_user_fk ON public.batt_account;
CREATE TRIGGER trg_batt_account_user_fk
  BEFORE INSERT OR UPDATE OF uid ON public.batt_account
  FOR EACH ROW EXECUTE FUNCTION public.batt_account_user_fk_guard();

-- ③b 两枚 0..100 CHECK 放宽（uid = 0 平台豁免；真实用户钳制原样保留）
ALTER TABLE public.batt_account DROP CONSTRAINT IF EXISTS batt_account_range;
ALTER TABLE public.batt_account
  ADD CONSTRAINT batt_account_range
  CHECK (uid = 0 OR (batt >= 0 AND batt <= 100));

ALTER TABLE public.batt_entry DROP CONSTRAINT IF EXISTS batt_entry_after_guard;
ALTER TABLE public.batt_entry
  ADD CONSTRAINT batt_entry_after_guard
  CHECK (uid = 0 OR (batt_after >= 0 AND batt_after <= 100));

-- ③c 平台电量账户行（幂等播种）
INSERT INTO public.batt_account (uid, batt) VALUES (0, 0) ON CONFLICT (uid) DO NOTHING;

DO $selfcheck$
DECLARE
  v_col integer;
  v_def text;
  v_trg integer;
  v_plat integer;
  v_err text;
BEGIN
  -- ① 两枚新列在场
  SELECT count(*) INTO v_col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'subtask_proof'
     AND column_name IN ('reward_due_units', 'reward_claimed_at');
  IF v_col <> 2 THEN
    RAISE EXCEPTION '0075 self-check FAILED: subtask_proof 新列期望 2 实得 %', v_col;
  END IF;

  -- ② pending 表 + 主键 + 金额闭集在场
  IF to_regclass('public.campaign_task_reward_pending') IS NULL THEN
    RAISE EXCEPTION '0075 self-check FAILED: campaign_task_reward_pending 不存在';
  END IF;
  SELECT count(*) INTO v_col FROM pg_constraint
   WHERE conrelid = 'public.campaign_task_reward_pending'::regclass
     AND conname IN ('campaign_task_reward_pending_pk', 'campaign_task_reward_pending_amount_ck',
                     'campaign_task_reward_pending_secondary_ck');
  IF v_col <> 3 THEN
    RAISE EXCEPTION '0075 self-check FAILED: pending 表约束期望 3 实得 %', v_col;
  END IF;

  -- ③ 两枚 CHECK 已放宽（uid = 0 豁免 + 0..100 钳制原样）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.batt_account'::regclass AND conname = 'batt_account_range';
  IF v_def IS NULL OR v_def !~ 'uid\s*=\s*0' OR v_def !~ 'batt\s*>=\s*\(?0' OR v_def !~ 'batt\s*<=\s*\(?100' THEN
    RAISE EXCEPTION '0075 self-check FAILED: batt_account_range 未放宽（需 uid=0 豁免 + 0..100），实际=%', COALESCE(v_def, 'NULL');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.batt_entry'::regclass AND conname = 'batt_entry_after_guard';
  IF v_def IS NULL OR v_def !~ 'uid\s*=\s*0' OR v_def !~ 'batt_after\s*>=\s*\(?0' OR v_def !~ 'batt_after\s*<=\s*\(?100' THEN
    RAISE EXCEPTION '0075 self-check FAILED: batt_entry_after_guard 未放宽（需 uid=0 豁免 + 0..100），实际=%', COALESCE(v_def, 'NULL');
  END IF;

  -- ④ 触发器守卫在场，且「无 users 行的普通 uid 直插必拒 23503」（嵌套块隐式子事务，禁 SAVEPOINT）
  SELECT count(*) INTO v_trg FROM pg_trigger
   WHERE tgrelid = 'public.batt_account'::regclass AND tgname = 'trg_batt_account_user_fk' AND NOT tgisinternal;
  IF v_trg <> 1 THEN
    RAISE EXCEPTION '0075 self-check FAILED: trg_batt_account_user_fk 不在场';
  END IF;
  BEGIN
    INSERT INTO public.batt_account (uid, batt) VALUES (2147480000, 10);
    RAISE EXCEPTION '0075 self-check FAILED: 无 users 行的 uid 直插未被 23503 拒（FK 守卫失效）';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;  -- 预期路径：触发器守卫以同码拒绝
  END;

  -- ⑤ 平台行在场且可超 100（uid = 0 豁免臂）
  SELECT count(*) INTO v_plat FROM public.batt_account WHERE uid = 0;
  IF v_plat <> 1 THEN
    RAISE EXCEPTION '0075 self-check FAILED: 平台电量账户行 (uid=0) 期望 1 实得 %', v_plat;
  END IF;
  BEGIN
    UPDATE public.batt_account SET batt = 4242 WHERE uid = 0;
    IF (SELECT batt FROM public.batt_account WHERE uid = 0) <> 4242 THEN
      RAISE EXCEPTION '0075 self-check FAILED: 平台行超上限写入未生效';
    END IF;
    UPDATE public.batt_account SET batt = 0 WHERE uid = 0;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE EXCEPTION '0075 self-check FAILED: 平台行 uid=0 豁免臂被拒：%（CHECK 未放宽到位）', v_err;
  END;

  RAISE NOTICE '0075 applied: subtask_proof reward_due_units/reward_claimed_at + campaign_task_reward_pending + batt platform legs (uid 0 exempt)';
END
$selfcheck$;
