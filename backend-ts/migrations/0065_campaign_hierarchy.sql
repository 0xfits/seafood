-- ============================================================================
-- 0065_campaign_hierarchy.sql
-- 活动任务体系五表（Campaign → Task → Subtask → Subtask Type → Subtask Proof）
-- ----------------------------------------------------------------------------
-- 契约真源（逐字照办）：
--   docs/data-layer.spec.md  §40.14.1（CP-1…CP-5 五表列契约）· §40.14.2（状态机 / 时间窗）
--                            §40.14.3（CP-7 五类 seed）· §40.14.4（CP-8 只存不审 / 一人一提交）
--                            §40.14.5（CP-9 旧体系互不干涉）· §40.14.6（CP-10 迁移形状与自检）
--                            §40.14.8（CP-P1…P7 prediction）· §40.14.9（CP-R1…R6 task 奖励字段）
--   docs/route-layer.spec.md §49.18（八口矩阵 R1–R8）
--   ops/campaign/SPEC-NOTE.md
--
-- ★ 编号勘误（docs 待回填，本文件只按落盘事实取号）：
--   §40.14 字面写 `0062_campaign_hierarchy.sql`；盘上 0062 **已被跳过**（0061 → 0063 项目域），
--   本单按「迁移号 = 落盘事实」取 **0065**（0063/0064 已被项目域两文件占用）。
--   ⇒ docs §40.14.6 的 `0062` 字面、`schema_version 0061 → 0062` 字面均待勘误为 0065（本单不改 docs）。
--
-- ★ 列数口径（现取核算，写清差额以免下游按字面误判）：
--   · campaign     **9** 列（§40.14.1 字面一致）
--   · task         **14** 列 = §40.14.1 字面 11 列 ＋ §40.14.9 CP-R1 三列奖励字段
--                  （reward_amount_primary / reward_cid_secondary / reward_amount_secondary）
--                  —— §40.14.9 原文「字段落库由发奖另单承接，届时 CP-2 列数一次性回填登记」，
--                  本单正是该「发奖单」⇒ 三列在此落库，CP-2 列数契约 **11 → 14 待 docs 回填**。
--   · subtask      **11** 列（字面一致）
--   · subtask_type **4** 列（字面一致）
--   · subtask_proof **7** 列（字面一致）
--   ⇒ 尾部自检按**物理列数**断言（9 / 14 / 11 / 4 / 7）。
--
-- ★ 奖励货币口径（§40.14.9 · Kevin 2026-10-20 同日再裁）：
--   task 奖励 = **额外完成奖**（全部 subtask 完成后、管理员手动发放，一般延后）；
--   主奖励恒以 `$`（平台内部积分 cid = 1）计量且**必填**（CHECK > 0，写口不给 ⇒ 400）；
--   次币为**可选**任意平台货币（`reward_cid_secondary`，成对出现、不得取 cid = 1）；
--   subtask 层只有 `$` 一种计量（prediction 奖池 = subtask.payload.prize_amount，单位恒 $），
--   **与 task 预算零扣减关系**（CP-R4 / CP-N10）。
--
-- ★ prediction 结算载体（§40.14.8 CP-P2）：回填键 `correct_option` 落 **subtask.payload 内键**，
--   **零新列** —— 五表列契约不因 prediction 改变；settle 口独占写、创建写口禁带。
--
-- 文件形状纪律（与 0057–0064 同族）：
--   · 文件内**不写 BEGIN / COMMIT**（scripts/migrate.ts 逐文件包事务）；
--   · 注释里**不出现 dollar-dollar 引号字面**（切分器按它切换 in-dollar 态）⇒ 本文件统一写「DO 块」；
--   · 幂等：CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DROP TRIGGER IF EXISTS + CREATE TRIGGER
--     / INSERT … ON CONFLICT DO NOTHING ⇒ 反复 apply 落同一终态；
--   · 零业务行：本迁移只建结构 ＋ 五类枚举 seed（活动/任务/子任务/凭证行恒 0）。
-- ============================================================================

-- ============================================================================
-- 表 4 · public.subtask_type（枚举表；先建，供 subtask 的 FK 引用）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subtask_type (
  type_code text    NOT NULL,
  label     text    NOT NULL,
  sort      int     NOT NULL,
  active    boolean NOT NULL DEFAULT true,
  CONSTRAINT subtask_type_pk PRIMARY KEY (type_code),
  CONSTRAINT subtask_type_label_check CHECK (length(btrim(label)) > 0),
  CONSTRAINT subtask_type_sort_check CHECK (sort >= 0)
);

COMMENT ON TABLE public.subtask_type IS
  '子任务类型枚举（§40.14.1 CP-4，4 列；枚举行不带时间戳）。写面唯一入口 = 迁移 seed ＋ 受控追加（本单不开路由）。停用 = active=false（枚举行不删：被 subtask 引用，删除必失败）；type_code 一经落库不再改写。起步冻结 5 类 = x_verify / onchain_snapshot / survey / prediction / quiz（poll 不入 seed，管理员后续如需按受控追加自增）。';

-- ============================================================================
-- 表 1 · public.campaign（活动主体）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign (
  campaign_id  bigserial   NOT NULL,
  snowflake_id bigint      NOT NULL,
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  status       text        NOT NULL DEFAULT 'draft',
  time_start   timestamptz NULL,
  time_end     timestamptz NULL,
  time_created timestamptz NOT NULL DEFAULT now(),
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_pk PRIMARY KEY (campaign_id),
  -- 对外唯一标识（41+10+12 位雪花，JSON 出参一律字符串；承 §40.12 ID-* 体例）
  CONSTRAINT campaign_snowflake_uniq UNIQUE (snowflake_id),
  CONSTRAINT campaign_title_check CHECK (length(btrim(title)) > 0),
  -- 状态机三值闭集（§40.14.2：draft→active→ended，ended = 终态封板）
  CONSTRAINT campaign_status_check CHECK (status IN ('draft','active','ended')),
  -- 时间窗：单侧为空 = 只锁一端；两端皆非空 ⇒ end 必晚于 start
  CONSTRAINT campaign_time_window_check
    CHECK (time_start IS NULL OR time_end IS NULL OR time_end > time_start)
);

COMMENT ON TABLE public.campaign IS
  '活动主体（§40.14.1 CP-1，9 列）。对外标识 = snowflake_id（JSON 字符串）；campaign_id 为内务主键。status 三值闭集 draft/active/ended，合法迁移仅 draft→active / active→ended，ended = 终态封板（一切 PATCH 409）。零定时器零触发器（到期不自动收口）。';

DROP TRIGGER IF EXISTS trg_campaign_touch_updated ON public.campaign;
CREATE TRIGGER trg_campaign_touch_updated
  BEFORE UPDATE ON public.campaign
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_touch_updated();

-- ============================================================================
-- 表 2 · public.task（任务卡；随活动删）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.task (
  task_id                 bigserial   NOT NULL,
  snowflake_id            bigint      NOT NULL,
  campaign_id             bigint      NOT NULL,
  title                   text        NOT NULL,
  description             text        NOT NULL DEFAULT '',
  status                  text        NOT NULL DEFAULT 'draft',
  time_start              timestamptz NULL,
  time_end                timestamptz NULL,
  sort                    int         NOT NULL DEFAULT 0,
  reward_amount_primary   numeric     NOT NULL,
  reward_cid_secondary    bigint      NULL,
  reward_amount_secondary numeric     NULL,
  time_created            timestamptz NOT NULL DEFAULT now(),
  time_updated            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_pk PRIMARY KEY (task_id),
  CONSTRAINT task_snowflake_uniq UNIQUE (snowflake_id),
  -- 随活动删（派单逐字 ON DELETE CASCADE）
  CONSTRAINT task_campaign_fk FOREIGN KEY (campaign_id)
    REFERENCES public.campaign(campaign_id) ON DELETE CASCADE,
  CONSTRAINT task_title_check CHECK (length(btrim(title)) > 0),
  CONSTRAINT task_status_check CHECK (status IN ('draft','active','ended')),
  CONSTRAINT task_time_window_check
    CHECK (time_start IS NULL OR time_end IS NULL OR time_end > time_start),
  -- §40.14.9 CP-R1：主奖励恒 $、必填（金额 > 0；单位由「不设 reward_cid_primary」结构保证）
  CONSTRAINT task_reward_primary_check CHECK (reward_amount_primary > 0),
  -- 次币成对（同空同非空；同式承 §40.15.1 project_wage_currency_pair_check）
  CONSTRAINT task_reward_secondary_pair_check
    CHECK ((reward_cid_secondary IS NULL) = (reward_amount_secondary IS NULL)),
  CONSTRAINT task_reward_secondary_amount_check
    CHECK (reward_amount_secondary IS NULL OR reward_amount_secondary > 0),
  -- 次币不得取 $（cid = 1）—— 与主奖励同币 ⇒ 判负 CP-N8，库面直接拒
  CONSTRAINT task_reward_secondary_cid_check
    CHECK (reward_cid_secondary IS NULL OR reward_cid_secondary <> 1),
  CONSTRAINT task_reward_secondary_fk FOREIGN KEY (reward_cid_secondary)
    REFERENCES public.currency(cid)
);

COMMENT ON TABLE public.task IS
  '活动任务卡（§40.14.1 CP-2 契约 11 列 ＋ §40.14.9 奖励三列 = 物理 14 列）。随 campaign 级联删。status 三值闭集与 campaign 同式、各自独立推进（task 不随 campaign 自动翻转）；ended = 终态封板。奖励 = **额外完成奖**（全部 subtask 完成后管理员手动发放）；reward_amount_primary 恒 $ 且必填（> 0），reward_cid_secondary / reward_amount_secondary 可选成对、次币不得取 cid = 1。零跨表窗口约束（task 窗 ⊆ campaign 窗 = 写口软校验）。';

DROP TRIGGER IF EXISTS trg_task_touch_updated ON public.task;
CREATE TRIGGER trg_task_touch_updated
  BEFORE UPDATE ON public.task
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_touch_updated();

-- 列表/详情读口：按活动取任务、按 sort 全序（§40.14.6 两枚索引之一）
CREATE INDEX IF NOT EXISTS task_campaign_idx
  ON public.task (campaign_id, sort);

-- ============================================================================
-- 表 3 · public.subtask（子任务；随任务删；无 status 列）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subtask (
  subtask_id   bigserial   NOT NULL,
  snowflake_id bigint      NOT NULL,
  task_id      bigint      NOT NULL,
  type_code    text        NOT NULL,
  title        text        NOT NULL,
  content      text        NULL,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sort         int         NOT NULL DEFAULT 0,
  required     boolean     NOT NULL DEFAULT false,
  time_created timestamptz NOT NULL DEFAULT now(),
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subtask_pk PRIMARY KEY (subtask_id),
  CONSTRAINT subtask_snowflake_uniq UNIQUE (snowflake_id),
  CONSTRAINT subtask_task_fk FOREIGN KEY (task_id)
    REFERENCES public.task(task_id) ON DELETE CASCADE,
  -- 类型闭集 = 枚举表（未知 type_code 直插必红 23503）
  CONSTRAINT subtask_type_fk FOREIGN KEY (type_code)
    REFERENCES public.subtask_type(type_code),
  CONSTRAINT subtask_title_check CHECK (length(btrim(title)) > 0),
  -- payload 必须是 JSON 对象（数组/标量/null ⇒ 23514；写口另有 400 前置）
  CONSTRAINT subtask_payload_object_check CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.subtask IS
  '子任务（§40.14.1 CP-3，11 列）。随 task 级联删。**无 status 列** —— 只有「存在 / required」两态，「完成」由 subtask_proof 行的存在表达。required 默认 false（不替活动方强制）。payload 恒 JSON 对象：prediction 类型 = 恰四键 {option_a,option_b,prize_amount,deadline}，结算回填 correct_option 亦在 payload 内（零新列 · §40.14.8 CP-P2）。零路由（增改内联于 task 写口）。';

DROP TRIGGER IF EXISTS trg_subtask_touch_updated ON public.subtask;
CREATE TRIGGER trg_subtask_touch_updated
  BEFORE UPDATE ON public.subtask
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_touch_updated();

CREATE INDEX IF NOT EXISTS subtask_task_idx
  ON public.subtask (task_id, sort);

-- ============================================================================
-- 表 5 · public.subtask_proof（完成凭证；只存不审 · 一人一提交）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subtask_proof (
  proof_id     bigserial   NOT NULL,
  subtask_id   bigint      NOT NULL,
  uid          bigint      NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status       text        NOT NULL DEFAULT 'submitted',
  time_created timestamptz NOT NULL DEFAULT now(),
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subtask_proof_pk PRIMARY KEY (proof_id),
  CONSTRAINT subtask_proof_subtask_fk FOREIGN KEY (subtask_id)
    REFERENCES public.subtask(subtask_id) ON DELETE CASCADE,
  CONSTRAINT subtask_proof_uid_fk FOREIGN KEY (uid) REFERENCES public.users(uid),
  -- ★ 一人一提交（通用类型重提 = 覆盖 200；prediction 类型重提 = 409，类型级例外见 §40.14.8 CP-P4）
  CONSTRAINT subtask_proof_uniq UNIQUE (subtask_id, uid),
  -- 单值 CHECK = 「审核态不存在」的库面声明（CP-N1：出现 approved/rejected 必红）
  CONSTRAINT subtask_proof_status_check CHECK (status IN ('submitted')),
  CONSTRAINT subtask_proof_payload_object_check CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE public.subtask_proof IS
  '子任务完成凭证（§40.14.1 CP-5，7 列）。**只存不审**：status 单值闭集 submitted —— 库面排除审核态存在性；proof 行存在即完成凭证。UNIQUE(subtask_id,uid) = 一人一提交：通用类型重提走单语句 ON CONFLICT DO UPDATE 覆盖（200 ＋ 新 payload，last-write-wins，与 job_application 的回放旧值方向相反）；prediction 类型首票即定（重提 409，类型级例外）。';

-- ============================================================================
-- §40.14.3 CP-7 · Subtask Type 五类 seed（逐字；ON CONFLICT DO NOTHING 重放安全）
--   排序 1–5；**poll（投票）不入 seed**
-- ============================================================================
INSERT INTO public.subtask_type (type_code, label, sort, active)
VALUES ('x_verify',         'X 验证',   1, true),
       ('onchain_snapshot', '链上快照', 2, true),
       ('survey',           '问卷',     3, true),
       ('prediction',       '预测',     4, true),
       ('quiz',             '答题',     5, true)
ON CONFLICT (type_code) DO NOTHING;

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_tbl  int;
  v_n    int;
  v_cnt  int;
  v_def  text;
  v_seed int;
BEGIN
  -- ① 五表在场
  SELECT count(*) INTO v_tbl FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('campaign', 'task', 'subtask', 'subtask_type', 'subtask_proof');
  IF v_tbl <> 5 THEN
    RAISE EXCEPTION '0065 self-check FAILED: expect 5 new tables, got %', v_tbl;
  END IF;

  -- ② 物理列数（9 / 14 / 11 / 4 / 7；task 14 = CP-2 的 11 ＋ CP-R1 奖励三列，见文件头）
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'campaign';
  IF v_n <> 9 THEN
    RAISE EXCEPTION '0065 self-check FAILED: campaign expect 9 columns, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'task';
  IF v_n <> 14 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task expect 14 columns (CP-2 11 + CP-R1 reward 3), got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'subtask';
  IF v_n <> 11 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask expect 11 columns, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'subtask_type';
  IF v_n <> 4 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_type expect 4 columns, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'subtask_proof';
  IF v_n <> 7 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_proof expect 7 columns, got %', v_n;
  END IF;

  -- ③ 具名约束齐（campaign 5 / task 11 / subtask 6 / subtask_proof 6 / subtask_type 3）
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.campaign'::regclass
     AND conname IN ('campaign_pk','campaign_snowflake_uniq','campaign_title_check',
                     'campaign_status_check','campaign_time_window_check');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0065 self-check FAILED: campaign expect 5 named constraints (pk/uniq/3 checks), got %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.task'::regclass
     AND conname IN ('task_pk','task_snowflake_uniq','task_campaign_fk','task_title_check',
                     'task_status_check','task_time_window_check','task_reward_primary_check',
                     'task_reward_secondary_pair_check','task_reward_secondary_amount_check',
                     'task_reward_secondary_cid_check','task_reward_secondary_fk');
  IF v_cnt <> 11 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task expect 11 named constraints, got %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.subtask'::regclass
     AND conname IN ('subtask_pk','subtask_snowflake_uniq','subtask_task_fk','subtask_type_fk',
                     'subtask_title_check','subtask_payload_object_check');
  IF v_cnt <> 6 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask expect 6 named constraints, got %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.subtask_proof'::regclass
     AND conname IN ('subtask_proof_pk','subtask_proof_subtask_fk','subtask_proof_uid_fk',
                     'subtask_proof_uniq','subtask_proof_status_check','subtask_proof_payload_object_check');
  IF v_cnt <> 6 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_proof expect 6 named constraints, got %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.subtask_type'::regclass
     AND conname IN ('subtask_type_pk','subtask_type_label_check','subtask_type_sort_check');
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_type expect 3 named constraints, got %', v_cnt;
  END IF;

  -- ④ 状态机三值闭集（campaign / task 逐字同集）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.campaign'::regclass AND conname = 'campaign_status_check';
  IF v_def IS NULL OR position('draft' IN v_def) = 0
     OR position('active' IN v_def) = 0 OR position('ended' IN v_def) = 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: campaign_status_check 三值不全，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.task'::regclass AND conname = 'task_status_check';
  IF v_def IS NULL OR position('draft' IN v_def) = 0
     OR position('active' IN v_def) = 0 OR position('ended' IN v_def) = 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task_status_check 三值不全，实际=%', COALESCE(v_def, '');
  END IF;

  -- ⑤ 时间窗 CHECK 真的是「两端皆非空 ⇒ end > start」（不是同名空壳）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.campaign'::regclass AND conname = 'campaign_time_window_check';
  IF v_def IS NULL OR position('time_end > time_start' IN v_def) = 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: campaign_time_window_check 缺 end > start，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.task'::regclass AND conname = 'task_time_window_check';
  IF v_def IS NULL OR position('time_end > time_start' IN v_def) = 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task_time_window_check 缺 end > start，实际=%', COALESCE(v_def, '');
  END IF;

  -- ⑥ proof：单值 CHECK 恰 submitted（审核态不存在）+ UNIQUE 恰 (subtask_id, uid)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.subtask_proof'::regclass AND conname = 'subtask_proof_status_check';
  IF v_def IS NULL OR position('submitted' IN v_def) = 0
     OR position('approved' IN v_def) > 0 OR position('rejected' IN v_def) > 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_proof_status_check 必须单值 submitted，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.subtask_proof'::regclass AND conname = 'subtask_proof_uniq';
  IF v_def IS NULL OR position('subtask_id' IN v_def) = 0 OR position('uid' IN v_def) = 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_proof_uniq 必须覆盖 (subtask_id, uid)，实际=%', COALESCE(v_def, '');
  END IF;

  -- ⑦ 级联：task→campaign / subtask→task / proof→subtask 三条 FK 删除规则皆 CASCADE
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conname IN ('task_campaign_fk','subtask_task_fk','subtask_proof_subtask_fk')
     AND contype = 'f' AND confdeltype = 'c';
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION '0065 self-check FAILED: expect 3 ON DELETE CASCADE FKs, got %', v_cnt;
  END IF;

  -- ⑧ 奖励三列：主 $ 必填（NOT NULL · > 0）· 次币成对 · 次币 ≠ cid 1
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'task'
     AND ((column_name = 'reward_amount_primary' AND is_nullable = 'NO')
       OR column_name IN ('reward_cid_secondary','reward_amount_secondary'));
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task reward columns shape wrong, got %', v_cnt;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.task'::regclass AND conname = 'task_reward_primary_check';
  IF v_def IS NULL OR position('reward_amount_primary' IN v_def) = 0
     OR (position('> 0' IN v_def) = 0 AND position('> (0)' IN v_def) = 0) THEN
    RAISE EXCEPTION '0065 self-check FAILED: task_reward_primary_check 缺 > 0，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.task'::regclass AND conname = 'task_reward_secondary_pair_check';
  IF v_def IS NULL OR position('reward_cid_secondary IS NULL' IN v_def) = 0
     OR position('reward_amount_secondary IS NULL' IN v_def) = 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task_reward_secondary_pair_check 不是同空同非空判定，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.task'::regclass AND conname = 'task_reward_secondary_cid_check';
  IF v_def IS NULL OR (position('<> 1' IN v_def) = 0 AND position('<> (1)' IN v_def) = 0) THEN
    RAISE EXCEPTION '0065 self-check FAILED: task_reward_secondary_cid_check 缺 <> 1，实际=%', COALESCE(v_def, '');
  END IF;

  -- ⑨ 两枚索引在场（task_campaign_idx / subtask_task_idx）
  SELECT count(*) INTO v_cnt FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname IN ('task_campaign_idx','subtask_task_idx');
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION '0065 self-check FAILED: expect 2 indexes (task_campaign_idx/subtask_task_idx), got %', v_cnt;
  END IF;

  -- ⑩ time_updated 触发器三张皆在场且启用
  SELECT count(*) INTO v_cnt FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('campaign','task','subtask')
     AND NOT t.tgisinternal AND t.tgenabled = 'O'
     AND t.tgname IN ('trg_campaign_touch_updated','trg_task_touch_updated','trg_subtask_touch_updated');
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION '0065 self-check FAILED: expect 3 time_updated triggers enabled, got %', v_cnt;
  END IF;

  -- ⑪ seed 恰 5 行、逐字（sort 1–5 / label 中文 / 全 active），且**无 poll**
  SELECT count(*) INTO v_seed FROM public.subtask_type;
  IF v_seed <> 5 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_type expect exactly 5 seed rows, got %', v_seed;
  END IF;
  SELECT count(*) INTO v_cnt FROM public.subtask_type
   WHERE (type_code, label, sort, active) IN (
     ('x_verify','X 验证',1,true),
     ('onchain_snapshot','链上快照',2,true),
     ('survey','问卷',3,true),
     ('prediction','预测',4,true),
     ('quiz','答题',5,true));
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0065 self-check FAILED: subtask_type seed rows 与 §40.14.3 不一致，命中 %', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM public.subtask_type WHERE type_code = 'poll';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: poll 不得入 seed（CP-N6），实见 % 行', v_cnt;
  END IF;

  -- ⑫ DL26 定向收窄自证：新表 task **零旧列集**（tID / jID / tasklist 一律不得出现）
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'task'
     AND lower(column_name) IN ('tid','jid','tasklist','tasklist_id');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0065 self-check FAILED: task 表出现旧悬赏列集（DL26 定向收窄失守），got %', v_cnt;
  END IF;

  -- ⑬ 首次 apply 零业务行（seed 只写 subtask_type；活动/任务/子任务/凭证恒 0）
  IF NOT EXISTS (SELECT 1 FROM public.schema_migration WHERE version = '0065') THEN
    SELECT count(*) INTO v_cnt FROM public.campaign;
    IF v_cnt <> 0 THEN
      RAISE EXCEPTION '0065 self-check FAILED: campaign expect 0 rows on first apply, got %', v_cnt;
    END IF;
    SELECT count(*) INTO v_cnt FROM public.task;
    IF v_cnt <> 0 THEN
      RAISE EXCEPTION '0065 self-check FAILED: task expect 0 rows on first apply, got %', v_cnt;
    END IF;
    SELECT count(*) INTO v_cnt FROM public.subtask;
    IF v_cnt <> 0 THEN
      RAISE EXCEPTION '0065 self-check FAILED: subtask expect 0 rows on first apply, got %', v_cnt;
    END IF;
    SELECT count(*) INTO v_cnt FROM public.subtask_proof;
    IF v_cnt <> 0 THEN
      RAISE EXCEPTION '0065 self-check FAILED: subtask_proof expect 0 rows on first apply, got %', v_cnt;
    END IF;
  END IF;
END $$;
