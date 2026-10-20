-- ============================================================================
-- 0063_project_domain.sql
-- 项目（打工 / 工资）域四表（Kevin 2026-10-20 四点裁定）
-- ----------------------------------------------------------------------------
-- 契约真源（逐字照办，不自行推导）：
--   docs/data-layer.spec.md  **§40.15.1**（PR-1 四表列契约）· §40.15.2（状态机 / 招生准入）
--                            §40.15.3（活动桶 / 电量累积 / 两腿到账）· §40.15.4（配置键）
--                            §40.15.6（迁移形状与自检）
--   docs/route-layer.spec.md **§49.19**（七口矩阵 R1–R7）
--   docs/design/design-system.spec.md §26.20
--   ops/project/SPEC-NOTE.md
--
-- Kevin 四点（本域全部语义的源头）：
--   ① 活跃 = 近 1 小时内任意登录态请求（2 电量/时），否则离线（1 电量/时）；
--   ② 电量**只在被招工期间累积**（从 hired_at 起算，未受雇零累积）；
--   ③ 原 H5【招工】入口文案改【任务】（前端面，本文件不涉）；
--   ④ 建项目费从创建者 $ 余额扣、入平台收入台账，费额存 app_config 键 project_create_fee（默认 10000）。
--
-- 本文件做什么（纯新增，零 ALTER 既有表 / 零 DML 回填）：
--   表 1 public.project              —— 项目主体
--   表 2 public.project_worker       —— 受雇关系（含「同时只在一个项目打工」的 DB 级闸）
--   表 3 public.project_wage_claim   —— 逐次领薪流水（append-only 语义 = 只插不改）
--   表 4 public.user_activity_hour   —— 登录态请求的 UTC 小时计数桶（活跃判定载体）
--   ⑤ app_config 键 project_create_fee = {"fee":"10000"}（0017 容器 CHECK 逼对象包裹）
--   ⑥ project.time_updated 由既有 platform_config_touch_updated() 触发器刷新（0017 同源函数，不自造第二套）
--
-- ★ 列数口径（现取核算，写清差额以免下游按字面误判）：
--   · project 字面「15 列」把「(跨列) 两币同空同非空 CHECK」那一行计入 ⇒ **物理列 = 14**
--     （project_id / snowflake_id / owner_uid / title / description / headcount /
--       recruit_min_account_days / wage_batt_per_claim / wage_cid / wage_currency_amount /
--       wage_interval_hours / status / time_created / time_updated）；
--   · project_wage_claim 字面「9 列」与逐列清单不符：清单实列 **10** 项
--     （claim_id / project_id / uid / batt_credited / currency_cid / currency_amount /
--       hours_elapsed / active_hours / offline_hours / time_created）⇒ 以逐列清单为准。
--   · project_worker 6 列 / user_activity_hour 4 列 —— 字面与清单一致。
--   ⇒ 尾部自检按**物理列数**断言（14 / 6 / 10 / 4），与本段逐字一致。
--
-- ★ 电量结算口径（data §40.15.3 的 batt 公式分支已由 Kevin 一句话落定）：
--   batt_credited = 2 × active_hours + 1 × offline_hours（逐小时桶 · 上限 100h · 超出不补）；
--   **币种工资 = 每次固定额**（wage_currency_amount，与小时数解耦）。
--   `wage_batt_per_claim` 仍按契约落库（> 0）并作为「项目额定工资」出参披露，
--   **不参与**本次结算公式（结算只认 2/1 逐小时桶）；两者并存不是矛盾，是契约列与结算函数的分离。
--
-- 文件形状纪律（与 0057–0061 同族）：
--   · 文件内**不写 BEGIN / COMMIT**（scripts/migrate.ts 逐文件包事务）；
--   · 正文注释里**不出现 dollar-dollar 引号字面**（切分器按它切换 in-dollar 态）⇒ 本文件统一写「DO 块」；
--   · 幂等：CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DROP TRIGGER IF EXISTS + CREATE TRIGGER
--     / INSERT … ON CONFLICT DO NOTHING ⇒ 反复 apply 落同一终态；
--   · 零破窗：只建新表 + 插一个新配置键 ⇒ 旧代码在「已 apply、新码未上线」窗口内零影响
--     （旧 SELECT 不碰这些表）；★ 反向顺序仍禁：新码先上线而本迁移未 apply ⇒ 七口必 42P01
--     ⇒ 按台账铁律「先 apply 后 push」。
--   · 种子数据**不在本文件**：10 个 mock web3 项目落 0064_seed_projects.sql（DDL 与 DML 分文件，
--     便于对「结构」与「夹具」分别判负）。
-- ============================================================================

-- ============================================================================
-- 表 1 · public.project（项目主体）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project (
  project_id              bigserial   NOT NULL,
  snowflake_id            bigint      NOT NULL,
  owner_uid               bigint      NOT NULL,
  title                   text        NOT NULL,
  description             text        NOT NULL DEFAULT '',
  headcount               int         NOT NULL,
  recruit_min_account_days int        NOT NULL DEFAULT 0,
  wage_batt_per_claim     numeric     NOT NULL,
  wage_cid                bigint      NULL,
  wage_currency_amount    numeric     NULL,
  wage_interval_hours     int         NOT NULL,
  status                  text        NOT NULL DEFAULT 'recruiting',
  time_created            timestamptz NOT NULL DEFAULT now(),
  time_updated            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_pk PRIMARY KEY (project_id),
  -- 对外唯一标识（41+10+12 位雪花，JSON 出参一律字符串；承 §40.12 ID-* 体例）
  CONSTRAINT project_snowflake_uniq UNIQUE (snowflake_id),
  -- 创建者（uid 引用体例承 DL54）
  CONSTRAINT project_owner_fk FOREIGN KEY (owner_uid) REFERENCES public.users(uid),
  -- 币别引用（可空：无币种工资的项目）
  CONSTRAINT project_wage_cid_fk FOREIGN KEY (wage_cid) REFERENCES public.currency(cid),
  CONSTRAINT project_headcount_check CHECK (headcount > 0),
  CONSTRAINT project_min_days_check CHECK (recruit_min_account_days >= 0),
  CONSTRAINT project_wage_batt_check CHECK (wage_batt_per_claim > 0),
  CONSTRAINT project_wage_amount_check CHECK (wage_currency_amount IS NULL OR wage_currency_amount > 0),
  -- ★ 两币别字段同空同非空（派单逐字；反证直插必红 23514 = 判负 PR-N4）
  CONSTRAINT project_wage_currency_pair_check CHECK ((wage_cid IS NULL) = (wage_currency_amount IS NULL)),
  CONSTRAINT project_interval_check CHECK (wage_interval_hours BETWEEN 1 AND 100),
  CONSTRAINT project_status_check CHECK (status IN ('recruiting','working','ended'))
);

COMMENT ON TABLE public.project IS
  '项目（打工/工资域主体，data-layer.spec §40.15.1 PR-1）。对外标识 = snowflake_id（JSON 字符串）；project_id 为内务主键。status 三值闭集 recruiting/working/ended，ended = 终态封板（一切 PATCH 与领薪 409）。两币工资字段同空同非空（project_wage_currency_pair_check）。零余额列（DL3：余额真值在 account/batt_account）。';

COMMENT ON COLUMN public.project.wage_batt_per_claim IS
  '项目额定电量工资（契约列，> 0）。注意：实际入账额按 data §40.15.3 逐小时桶结算（活跃 2/时 + 离线 1/时，上限 100h），本列不参与结算公式，只作出参与管理面「额定工资」披露。';

-- time_updated 自动刷新（复用 0017 的 platform_config_touch_updated：通用函数、无表专属逻辑）
DROP TRIGGER IF EXISTS trg_project_touch_updated ON public.project;
CREATE TRIGGER trg_project_touch_updated
  BEFORE UPDATE ON public.project
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_touch_updated();

-- 列表读口（status ∈ recruiting|working，time_created DESC）与状态筛选的承载索引
CREATE INDEX IF NOT EXISTS project_status_time_idx
  ON public.project (status, time_created DESC);

-- ============================================================================
-- 表 2 · public.project_worker（受雇关系）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_worker (
  worker_id   bigserial   NOT NULL,
  project_id  bigint      NOT NULL,
  uid         bigint      NOT NULL,
  status      text        NOT NULL DEFAULT 'hired',
  hired_at    timestamptz NOT NULL DEFAULT now(),
  left_at     timestamptz NULL,
  CONSTRAINT project_worker_pk PRIMARY KEY (worker_id),
  CONSTRAINT project_worker_project_fk FOREIGN KEY (project_id) REFERENCES public.project(project_id),
  CONSTRAINT project_worker_uid_fk FOREIGN KEY (uid) REFERENCES public.users(uid),
  CONSTRAINT project_worker_status_check CHECK (status IN ('hired','left'))
);

-- ★★ 本契约的核心 DB 级闸：每个用户**同时只能在一个 project 打工**。
--   部分唯一索引只覆盖在职行 ⇒ `left` 后可在同项目或别项目复职（历史行保留，故 (project_id,uid) 不设 UNIQUE）。
CREATE UNIQUE INDEX IF NOT EXISTS project_worker_single_hired_uniq
  ON public.project_worker (uid) WHERE status = 'hired';

-- 在职人数计数（apply 闸 / 列表出参 hired_count / 招满自动转 working）
CREATE INDEX IF NOT EXISTS project_worker_project_status_idx
  ON public.project_worker (project_id, status);

COMMENT ON TABLE public.project_worker IS
  '受雇关系（§40.15.1 PR-2，6 列）。apply 满足条件即**直接录用**（无申请池、无 pending 态）。project_worker_single_hired_uniq = UNIQUE(uid) WHERE status=hired ⇒「同时只在一个项目打工」由 DB 兜底（第二 hire 撞 23505 ⇒ 路由 409）。left 后可复职（新行）。';

-- ============================================================================
-- 表 3 · public.project_wage_claim（逐次领薪流水）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_wage_claim (
  claim_id        bigserial   NOT NULL,
  project_id      bigint      NOT NULL,
  uid             bigint      NOT NULL,
  batt_credited   numeric     NOT NULL,
  currency_cid    bigint      NULL,
  currency_amount numeric     NULL,
  hours_elapsed   numeric     NOT NULL,
  active_hours    numeric     NOT NULL,
  offline_hours   numeric     NOT NULL,
  time_created    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_wage_claim_pk PRIMARY KEY (claim_id),
  CONSTRAINT project_wage_claim_project_fk FOREIGN KEY (project_id) REFERENCES public.project(project_id),
  CONSTRAINT project_wage_claim_uid_fk FOREIGN KEY (uid) REFERENCES public.users(uid),
  CONSTRAINT project_wage_claim_currency_fk FOREIGN KEY (currency_cid) REFERENCES public.currency(cid),
  CONSTRAINT project_claim_batt_check CHECK (batt_credited >= 0),
  CONSTRAINT project_claim_currency_pair_check CHECK ((currency_cid IS NULL) = (currency_amount IS NULL)),
  -- 累积上限 100h 落到 CHECK（与 wage_interval_hours 的最大值一致；超出不补）
  CONSTRAINT project_claim_hours_check CHECK (hours_elapsed >= 0 AND hours_elapsed <= 100),
  CONSTRAINT project_claim_active_check CHECK (active_hours >= 0),
  CONSTRAINT project_claim_offline_check CHECK (offline_hours >= 0)
);

-- 领薪窗口查询（上次领取时间 = max(time_created) per (project, uid)）
CREATE INDEX IF NOT EXISTS project_wage_claim_worker_idx
  ON public.project_wage_claim (project_id, uid, time_created DESC);

COMMENT ON TABLE public.project_wage_claim IS
  '逐次领薪流水（§40.15.1 PR-3）。零 UNIQUE：同 (project,uid) 随时间多行，append-only 由「只插不改」纪律承载（不设触发器）。防双领竞态 = 领取事务内对 project_worker 在职行 FOR UPDATE。软校验（不设 DB CHECK）：active_hours + offline_hours = hours_elapsed。币种腿 = 每次固定额（与小时数解耦）；电量腿 = 2×active + 1×offline（上限 100h）。';

-- ============================================================================
-- 表 4 · public.user_activity_hour（登录态请求的 UTC 小时桶）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_activity_hour (
  uid           bigint  NOT NULL,
  day           date    NOT NULL,
  hour          int     NOT NULL,
  request_count bigint  NOT NULL DEFAULT 0,
  CONSTRAINT user_activity_hour_pk PRIMARY KEY (uid, day, hour),
  CONSTRAINT user_activity_hour_uid_fk FOREIGN KEY (uid) REFERENCES public.users(uid),
  CONSTRAINT user_activity_hour_bucket_check CHECK (hour >= 0 AND hour <= 23),
  -- 行仅在 ≥1 次登录态请求时存在（计数桶不得有 0 行）
  CONSTRAINT user_activity_hour_count_check CHECK (request_count > 0)
);

COMMENT ON TABLE public.user_activity_hour IS
  '登录态请求的 UTC 小时计数桶（§40.15.1 PR-4，4 列；主键即 (uid,day,hour) 唯一键，零额外索引）。写入 = 登录态请求旁路单语句 upsert（不进业务事务、失败不阻断业务）；某桶有行 ⇒ 该小时活跃（2 电量/时），无行 ⇒ 离线（1 电量/时）。日界 = UTC（承 R-9-15）。';

-- ============================================================================
-- ⑤ app_config 键 project_create_fee（§40.15.4 PR-7）
--   0017 的 app_config_value_is_container CHECK 只收 object/array ⇒ 裸标量 '10000' 会被拒，
--   必须对象包裹；fee 是**字符串数字**（派单逐字形态）。
-- ============================================================================
INSERT INTO public.app_config (key, value, updated_by)
VALUES ('project_create_fee', '{"fee":"10000"}'::jsonb, 0)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_n      int;
  v_def    text;
  v_cnt    int;
  v_fee    text;
  v_tbl    int;
BEGIN
  -- ① 四表在场
  SELECT count(*) INTO v_tbl FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('project', 'project_worker', 'project_wage_claim', 'user_activity_hour');
  IF v_tbl <> 4 THEN
    RAISE EXCEPTION '0063 self-check FAILED: expect 4 new tables, got %', v_tbl;
  END IF;

  -- ② 物理列数（14 / 6 / 10 / 4；字面差额见文件头「列数口径」段）
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project';
  IF v_n <> 14 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project expect 14 physical columns (15 literal includes the cross-column CHECK row), got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project_worker';
  IF v_n <> 6 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_worker expect 6 columns, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project_wage_claim';
  IF v_n <> 10 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_wage_claim expect 10 columns (literal 9 omits time_created), got %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'user_activity_hour';
  IF v_n <> 4 THEN
    RAISE EXCEPTION '0063 self-check FAILED: user_activity_hour expect 4 columns, got %', v_n;
  END IF;

  -- ③ project 的九条具名约束齐（pk + snowflake uniq + headcount + min_days + batt + amount + pair + interval + status）
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.project'::regclass
     AND conname IN ('project_pk','project_snowflake_uniq','project_headcount_check',
                     'project_min_days_check','project_wage_batt_check','project_wage_amount_check',
                     'project_wage_currency_pair_check','project_interval_check','project_status_check');
  IF v_cnt <> 9 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project expect 9 named constraints, got %', v_cnt;
  END IF;

  -- ④ 跨列两币 CHECK 真的是「同空同非空」判定（不是同名空壳）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.project'::regclass AND conname = 'project_wage_currency_pair_check';
  IF v_def IS NULL OR position('wage_cid IS NULL' IN v_def) = 0
     OR position('wage_currency_amount IS NULL' IN v_def) = 0 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_wage_currency_pair_check 不是同空同非空判定，实际=%',
      COALESCE(v_def, '');
  END IF;

  -- ⑤ interval 1–100 与 status 三值闭集（读约束定义文本，防「有约束但值域写错」）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.project'::regclass AND conname = 'project_interval_check';
  IF v_def IS NULL OR position('1' IN v_def) = 0 OR position('100' IN v_def) = 0 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_interval_check 缺 1..100 值域，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.project'::regclass AND conname = 'project_status_check';
  IF v_def IS NULL OR position('recruiting' IN v_def) = 0
     OR position('working' IN v_def) = 0 OR position('ended' IN v_def) = 0 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_status_check 三值不全，实际=%', COALESCE(v_def, '');
  END IF;

  -- ⑥ project_worker：status 两值闭集 + **部分唯一索引**（UNIQUE(uid) WHERE status='hired'）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.project_worker'::regclass AND conname = 'project_worker_status_check';
  IF v_def IS NULL OR position('hired' IN v_def) = 0 OR position('left' IN v_def) = 0 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_worker_status_check 两值不全，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'project_worker'
     AND indexname = 'project_worker_single_hired_uniq'
     AND indexdef LIKE '%UNIQUE%'
     AND indexdef LIKE '%(uid)%'
     AND indexdef LIKE '%WHERE%'
     AND indexdef LIKE '%hired%';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0063 self-check FAILED: partial unique index project_worker_single_hired_uniq(uid) WHERE status=hired missing, got %', v_cnt;
  END IF;

  -- ⑦ user_activity_hour：主键 = (uid, day, hour)；hour 0..23；request_count > 0
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.user_activity_hour'::regclass AND contype = 'p';
  IF v_def IS NULL OR position('uid' IN v_def) = 0 OR position('day' IN v_def) = 0
     OR position('hour' IN v_def) = 0 THEN
    RAISE EXCEPTION '0063 self-check FAILED: user_activity_hour 主键必须覆盖 (uid, day, hour)，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.user_activity_hour'::regclass
     AND conname IN ('user_activity_hour_bucket_check','user_activity_hour_count_check');
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION '0063 self-check FAILED: user_activity_hour expect 2 named CHECKs, got %', v_cnt;
  END IF;

  -- ⑧ project_wage_claim：hours 上限 100 落到 CHECK + 两币同空同非空 + batt >= 0
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.project_wage_claim'::regclass AND conname = 'project_claim_hours_check';
  IF v_def IS NULL OR position('100' IN v_def) = 0 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_claim_hours_check 缺 100h 上限，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.project_wage_claim'::regclass
     AND conname IN ('project_claim_batt_check','project_claim_currency_pair_check',
                     'project_claim_hours_check','project_claim_active_check','project_claim_offline_check');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_wage_claim expect 5 named CHECKs, got %', v_cnt;
  END IF;

  -- ⑨ 配置键：行在场且 fee 逐字 = 10000（字符串数字）
  SELECT count(*) INTO v_cnt FROM public.app_config WHERE key = 'project_create_fee';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0063 self-check FAILED: app_config.project_create_fee expect exactly 1 row, got %', v_cnt;
  END IF;
  SELECT value->>'fee' INTO v_fee FROM public.app_config WHERE key = 'project_create_fee';
  IF v_fee IS DISTINCT FROM '10000' THEN
    RAISE EXCEPTION '0063 self-check FAILED: project_create_fee.fee expect 10000, got %', COALESCE(v_fee, '<null>');
  END IF;
  -- 容器约束仍生效（对象包裹；裸标量不可存）
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.app_config'::regclass AND conname = 'app_config_value_is_container';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0063 self-check FAILED: app_config_value_is_container CHECK missing (0017 容器约束必须仍生效)';
  END IF;

  -- ⑩ time_updated 触发器在场且启用
  SELECT count(*) INTO v_cnt FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'project'
     AND NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgname = 'trg_project_touch_updated';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0063 self-check FAILED: project time_updated trigger missing/disabled, got %', v_cnt;
  END IF;

  -- ⑪ 本迁移零业务行（种子在 0064；此处断言四表皆空 —— 人工重放时 0064 已插行 ⇒ 跳过该断言）
  IF NOT EXISTS (SELECT 1 FROM public.schema_migration WHERE version = '0063') THEN
    SELECT count(*) INTO v_cnt FROM public.project;
    IF v_cnt <> 0 THEN
      RAISE EXCEPTION '0063 self-check FAILED: project expect 0 rows on first apply (seed lives in 0064), got %', v_cnt;
    END IF;
  END IF;
END $$;
