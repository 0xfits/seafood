-- ============================================================================
-- 0068_project_slug_campaign_link.sql
-- 项目 slug（页面地址）+ campaign 挂项目（project_id NOT NULL FK）
-- ----------------------------------------------------------------------------
-- 契约真源（Kevin 2026-10-21 派单 · 后端单）：
--   ① 每个项目有自己的页面地址：Sui ⇒ /sui —— 地址名（slug）在项目信息中**由用户填写**；
--   ② campaign.project_id bigint NOT NULL REFERENCES project(campaign 级联删)；
--   ③ 存量回填：10 个种子项目按映射 slug = ethereum/solana/arbitrum/base/optimism/
--      polygon/sui/aptos/starknet/zksync（Sui ⇒ sui 正是 Kevin 举例）。
--
-- ★ 职责切分（派单「二选一」采纳建议支：**DB 只查格式，保留字服务层拒**）：
--   · DB：`project_slug_format_check`（格式 ^[a-z0-9][a-z0-9-]{0,31}$）＋ `project_slug_uniq`
--     （唯一）＋ NOT NULL —— 保留字**不入** DB CHECK；
--   · 服务层（project-service.parseProjectSlugInput）：格式 / 保留字（20 词）/ 纯数字
--     （ref 判定表「全数字 ⇒ id」⇒ 纯数字 slug 永不可达 ⇒ 服务层即拒，判定表无歧义）
--     ⇒ 400 借 LEDGER_AMOUNT_INVALID + details.reason='SLUG_INVALID'；
--     唯一冲突（事务内预检 + 23505 按 constraint 名区分）⇒ 400 + details.reason='SLUG_TAKEN'。
--   · 本迁移尾部自检仍断言**数据面**保留字 0 行 / 格式违例 0 行（回填数据不越线）。
--
-- ★ slug 判定表（route R2 `GET /api/project/:ref` 三形态；零新路由，`:ref` 吞 slug）：
--   · ref 全数字（≤20 位）⇒ 数值双形态（project_id OR snowflake_id）—— 既有语义不变，**优先**；
--   · ref 匹配 slug 格式 ⇒ `slug = ref` 等值查询；
--   · 其他 ⇒ 路由层 isProjectReadRef 拦下 404（不进服务层）。
--   · item_code 的「7 位含字母」语义属 item/listing 域，**不适用于 project**。
--
-- ★ 兜底回填（派单只点 10 种子；为使 NOT NULL 在「种子之外还有存量行」的库上也可满足）：
--   非（十种子标题）的 NULL slug 行一律回填 `'p' || project_id`（合法格式、逐行唯一、非保留字），
--   owner 后续可经 PATCH /api/project/:projectId 改成自定 slug —— 不发明业务值，只为可 apply。
--
-- ★ campaign 侧（现 campaign 0 行，无回填压力 —— 派单明示）：
--   ADD COLUMN project_id → 具名 FK `campaign_project_fk`（ON DELETE CASCADE）→
--   显式预检「NULL project_id 行 = 0」后 SET NOT NULL（若有残留行 ⇒ RAISE 明示，不静默半迁移）→
--   `campaign_project_idx`（GET /api/project/:ref 嵌套读口按项目取 campaign 的走索引）。
--
-- 文件形状纪律（与 0057–0067 同族）：
--   · 文件内不写 BEGIN / COMMIT（scripts/migrate.ts 逐文件包事务）；
--   · 注释里不出现成对美元定界符字面（切分器按它切换 in-dollar 态）⇒ 统一写「DO 块」；
--   · 幂等：ADD COLUMN IF NOT EXISTS / 受 pg_constraint 守卫的 ADD CONSTRAINT /
--     CREATE INDEX IF NOT EXISTS ⇒ 反复 apply 落同一终态；
--   · 不改 0063/0064/0065 已登记文件一字（checksum 漂移 = ABORT）。
-- ============================================================================

-- ============================================================================
-- ① project.slug：加列 → 回填 → NOT NULL → 具名约束（格式 + 唯一）
-- ============================================================================
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS slug text;

-- 存量回填 · 十种子逐字映射（按 title 判定；幂等：只补 NULL 行）
UPDATE public.project SET slug = m.slug
  FROM (VALUES
    ('Ethereum 生态推广', 'ethereum'),
    ('Solana 生态推广',   'solana'),
    ('Arbitrum 生态推广', 'arbitrum'),
    ('Base 生态推广',     'base'),
    ('Optimism 生态推广', 'optimism'),
    ('Polygon 生态推广',  'polygon'),
    ('Sui 生态推广',      'sui'),
    ('Aptos 生态推广',    'aptos'),
    ('Starknet 生态推广', 'starknet'),
    ('zkSync 生态推广',   'zksync')
  ) AS m(title, slug)
  WHERE public.project.slug IS NULL
    AND public.project.title = m.title;

-- 兜底回填：其余 NULL 行（种子之外的真实存量）⇒ 'p'||project_id（合法 / 唯一 / 非保留字）
UPDATE public.project SET slug = 'p' || project_id::text WHERE slug IS NULL;

ALTER TABLE public.project ALTER COLUMN slug SET NOT NULL;

-- 具名约束（幂等守卫：pg_constraint 查名后补挂）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_slug_uniq' AND conrelid = 'public.project'::regclass
  ) THEN
    ALTER TABLE public.project ADD CONSTRAINT project_slug_uniq UNIQUE (slug);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_slug_format_check' AND conrelid = 'public.project'::regclass
  ) THEN
    ALTER TABLE public.project
      ADD CONSTRAINT project_slug_format_check
      CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,31}$');
  END IF;
END $$;

-- ============================================================================
-- ② campaign.project_id：加列 → 具名 FK（级联删）→ 预检后 NOT NULL → 索引
-- ============================================================================
ALTER TABLE public.campaign ADD COLUMN IF NOT EXISTS project_id bigint;

DO $$
BEGIN
  -- 具名 FK：campaign 级联删（派单逐字 ON DELETE CASCADE）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'campaign_project_fk' AND conrelid = 'public.campaign'::regclass
  ) THEN
    ALTER TABLE public.campaign
      ADD CONSTRAINT campaign_project_fk
      FOREIGN KEY (project_id) REFERENCES public.project(project_id) ON DELETE CASCADE;
  END IF;

  -- NOT NULL 前显式预检（派单：现 campaign 0 行；若某环境已有行 ⇒ 明示回填义务，不静默半迁移）
  IF EXISTS (SELECT 1 FROM public.campaign WHERE project_id IS NULL) THEN
    RAISE EXCEPTION '0068 pre-check FAILED: campaign has rows with NULL project_id — backfill required before SET NOT NULL (expected 0 rows per dispatch)';
  END IF;
END $$;

ALTER TABLE public.campaign ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_project_idx
  ON public.campaign (project_id);

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_cnt  int;
  v_n    int;
  v_def  text;
BEGIN
  -- ① slug 列在场：text + NOT NULL
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project'
     AND column_name = 'slug' AND data_type = 'text' AND is_nullable = 'NO';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0068 self-check FAILED: project.slug expect text NOT NULL column, got %', v_cnt;
  END IF;

  -- ② 具名约束三件：唯一（u）/ 格式（c，含正则体）/ FK 级联（f + confdeltype c）
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conname = 'project_slug_uniq' AND conrelid = 'public.project'::regclass AND contype = 'u';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0068 self-check FAILED: project_slug_uniq (UNIQUE) missing';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conname = 'project_slug_format_check' AND conrelid = 'public.project'::regclass AND contype = 'c';
  IF v_def IS NULL OR position('[a-z0-9-]{0,31}' IN v_def) = 0 THEN
    RAISE EXCEPTION '0068 self-check FAILED: project_slug_format_check 缺正则体，实际=%', COALESCE(v_def, '');
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conname = 'campaign_project_fk' AND conrelid = 'public.campaign'::regclass
     AND contype = 'f' AND confdeltype = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0068 self-check FAILED: campaign_project_fk (ON DELETE CASCADE) missing';
  END IF;

  -- ③ campaign.project_id：bigint + NOT NULL
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'campaign'
     AND column_name = 'project_id' AND data_type = 'bigint' AND is_nullable = 'NO';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0068 self-check FAILED: campaign.project_id expect bigint NOT NULL column, got %', v_cnt;
  END IF;

  -- ④ 数据面：NULL slug 0（NOT NULL 已保证，双保险）/ 格式违例 0 / 纯数字 0 / 保留字 0
  SELECT count(*) INTO v_cnt FROM public.project WHERE slug IS NULL;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0068 self-check FAILED: % project rows have NULL slug', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM public.project WHERE slug !~ '^[a-z0-9][a-z0-9-]{0,31}$';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0068 self-check FAILED: % project rows violate slug format check', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM public.project WHERE slug ~ '^[0-9]+$';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0068 self-check FAILED: % project rows have digit-only slug (ref 判定表歧义)', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM public.project
   WHERE slug IN ('wage','profile','task','tasks','campaign','campaigns','item','items',
                  'project','projects','admin','api','login','register','settings',
                  'assets','market','messages','order','orders');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0068 self-check FAILED: % project rows use reserved slug (保留字服务层拒；数据面须 0 行)', v_cnt;
  END IF;

  -- ⑤ slug 全局唯一（约束已保证，这里是取数面自证：distinct = 全行）
  SELECT count(*), count(DISTINCT slug) INTO v_n, v_cnt FROM public.project;
  IF v_cnt <> v_n THEN
    RAISE EXCEPTION '0068 self-check FAILED: slug not unique (rows=% distinct=%)', v_n, v_cnt;
  END IF;

  -- ⑥ 十种子逐字对拍：(title, slug) 十对齐中
  SELECT count(*) INTO v_cnt FROM public.project
   WHERE (title, slug) IN (
     ('Ethereum 生态推广', 'ethereum'),
     ('Solana 生态推广',   'solana'),
     ('Arbitrum 生态推广', 'arbitrum'),
     ('Base 生态推广',     'base'),
     ('Optimism 生态推广', 'optimism'),
     ('Polygon 生态推广',  'polygon'),
     ('Sui 生态推广',      'sui'),
     ('Aptos 生态推广',    'aptos'),
     ('Starknet 生态推广', 'starknet'),
     ('zkSync 生态推广',   'zksync'));
  IF v_cnt <> 10 THEN
    RAISE EXCEPTION '0068 self-check FAILED: expect 10 seed (title, slug) pairs, got %', v_cnt;
  END IF;

  -- ⑦ 嵌套读口索引在场
  SELECT count(*) INTO v_cnt FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'campaign_project_idx';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0068 self-check FAILED: campaign_project_idx missing';
  END IF;

  -- ⑧ campaign 残留 NULL project_id = 0（SET NOT NULL 的前置预检复读）
  SELECT count(*) INTO v_cnt FROM public.campaign WHERE project_id IS NULL;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0068 self-check FAILED: % campaign rows have NULL project_id', v_cnt;
  END IF;
END $$;
