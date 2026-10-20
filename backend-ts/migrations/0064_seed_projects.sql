-- ============================================================================
-- 0064_seed_projects.sql
-- 10 个 mock web3 项目种子（项目域演示 / 门套夹具基线）
-- ----------------------------------------------------------------------------
-- 上游：0063_project_domain.sql（四表 + app_config.project_create_fee）
-- 契约真源：docs/data-layer.spec.md §40.15.1（PR-1 列契约）/ §40.15.2（状态机）
--
-- 为什么把种子单独成一个文件（不在 0063 里）：
--   · 「结构」与「夹具」分别判负 —— 0063 的干跑可以断言四表零业务行，0064 的干跑断言恰 10 行；
--   · 种子是**演示数据**，将来要清/换只动这一个文件，不触碰 DDL 文件（避免 checksum 漂移）。
--
-- 幂等口径：**按 title 判存在**（INSERT … WHERE NOT EXISTS (SELECT 1 … WHERE title = p.title)），
--   重复 apply 不增行；同名项目被真实用户创建时也不会被误判（标题带「生态推广」后缀 + 本文件逐字标题）。
--
-- 取值口径（本文件自定，写明以便复核）：
--   · owner_uid = 既有管理员（`users.is_admin = true` 的最小 uid）—— 平台演示账号；无管理员 ⇒ 直接 RAISE；
--   · status 恒 'recruiting'（种子是待招项目，不是在职项目）；
--   · headcount 5–20 / wage_interval_hours 1–100 / wage_batt_per_claim **十个互不相同**（门里对拍 distinct 数）；
--   · 次币工资：偶数序号 5 个项目带（wage_cid 取 listed 且 cid <> 1 的最小 cid）；
--     若库内**没有**可用的次币 ⇒ 这 5 个也落 NULL（两币字段同空同非空，绝不写半对）；
--   · snowflake_id = (1000 + n) × 2^22（确定性、互不相同；种子是夹具，唯一性由 UNIQUE 约束兜底）。
--
-- 文件形状纪律：无 BEGIN/COMMIT（runner 逐文件包事务）；注释里不出现 dollar-dollar 引号字面。
-- ============================================================================

WITH own AS (
  SELECT uid FROM public.users WHERE is_admin IS TRUE ORDER BY uid LIMIT 1
), sec AS (
  SELECT cid FROM public.currency WHERE status = 'listed' AND cid <> 1 ORDER BY cid LIMIT 1
), seed(n, title, description, headcount, min_days, batt, interval_h, with_sec) AS (
  VALUES
    (1,  'Ethereum 生态推广',  '维护 Ethereum 主网生态的社区推广位：转发官方公告、整理 grants 信息、每周汇总生态动态。', 5,  0, 12, 1,   TRUE),
    (2,  'Solana 生态推广',    'Solana 生态项目冷启动推广：社群答疑、活动报名引导、开发者文档校对。',                 8,  1, 15, 2,   FALSE),
    (3,  'Arbitrum 生态推广',  'Arbitrum 生态空投季宣传：任务引导、链上交互演示、社群维护。',                         10, 3, 18, 3,   TRUE),
    (4,  'Base 生态推广',      'Base 链上应用推广：教程撰写、推特空间协作、用户答疑。',                               12, 0, 20, 6,   FALSE),
    (5,  'Optimism 生态推广',  'Optimism 公共物品资助宣传：RetroPGF 说明、项目盘点、社区问答。',                       6,  7, 25, 12,  TRUE),
    (6,  'Polygon 生态推广',   'Polygon zkEVM 生态推广：开发者活动组织、文档本地化、社群运营。',                     15, 2, 30, 24,  FALSE),
    (7,  'Sui 生态推广',       'Sui 生态新项目推广：Move 开发入门资料整理、社群答疑、活动执行。',                       20, 0, 35, 48,  TRUE),
    (8,  'Aptos 生态推广',     'Aptos 生态推广：活动策划执行、用户增长数据汇总、内容排期。',                           7,  5, 40, 72,  FALSE),
    (9,  'Starknet 生态推广',  'Starknet 生态推广：Cairo 教程整理、生态项目访谈、社群维护。',                         9,  1, 45, 96,  TRUE),
    (10, 'zkSync 生态推广',    'zkSync 生态推广：空投规则解读、任务指引、社区答疑。',                                 14, 10, 50, 100, FALSE)
), payload AS (
  SELECT
    s.n,
    ((1000 + s.n)::bigint * 4194304) AS snowflake_id,
    s.title,
    s.description,
    s.headcount,
    s.min_days,
    s.batt,
    s.interval_h,
    CASE WHEN s.with_sec THEN (SELECT cid FROM sec) ELSE NULL END AS wage_cid,
    CASE WHEN s.with_sec AND (SELECT cid FROM sec) IS NOT NULL THEN 25::numeric ELSE NULL END AS wage_amount
  FROM seed s
)
INSERT INTO public.project (
  snowflake_id, owner_uid, title, description, headcount,
  recruit_min_account_days, wage_batt_per_claim, wage_cid, wage_currency_amount,
  wage_interval_hours, status
)
SELECT
  p.snowflake_id,
  (SELECT uid FROM own),
  p.title,
  p.description,
  p.headcount,
  p.min_days,
  p.batt::numeric,
  p.wage_cid,
  p.wage_amount,
  p.interval_h,
  'recruiting'
FROM payload p
WHERE (SELECT uid FROM own) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.project x WHERE x.title = p.title);

-- ============================================================================
-- 尾部自检（任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_owner   bigint;
  v_rows    int;
  v_dist    int;
  v_bad     int;
  v_min     int;
  v_max     int;
  v_sec     int;
BEGIN
  SELECT uid INTO v_owner FROM public.users WHERE is_admin IS TRUE ORDER BY uid LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '0064 self-check FAILED: no admin user (users.is_admin = true) to own the seed projects';
  END IF;

  -- ① 恰 10 行（十个逐字标题各 1 行）
  SELECT count(*) INTO v_rows FROM public.project
   WHERE title IN ('Ethereum 生态推广','Solana 生态推广','Arbitrum 生态推广','Base 生态推广',
                   'Optimism 生态推广','Polygon 生态推广','Sui 生态推广','Aptos 生态推广',
                   'Starknet 生态推广','zkSync 生态推广');
  IF v_rows <> 10 THEN
    RAISE EXCEPTION '0064 self-check FAILED: expect 10 seed projects by title, got %', v_rows;
  END IF;

  -- ② 全部 recruiting + owner = 管理员
  SELECT count(*) INTO v_bad FROM public.project
   WHERE title LIKE '%生态推广' AND (status <> 'recruiting' OR owner_uid <> v_owner);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0064 self-check FAILED: % seed rows are not recruiting / not owned by admin %', v_bad, v_owner;
  END IF;

  -- ③ headcount 落在 5–20（派单口径）
  SELECT min(headcount), max(headcount) INTO v_min, v_max FROM public.project WHERE title LIKE '%生态推广';
  IF v_min < 5 OR v_max > 20 THEN
    RAISE EXCEPTION '0064 self-check FAILED: seed headcount must sit in 5..20, got min=% max=%', v_min, v_max;
  END IF;

  -- ④ 十个 interval 互不相同且都在 1–100
  SELECT count(DISTINCT wage_interval_hours) INTO v_dist FROM public.project WHERE title LIKE '%生态推广';
  IF v_dist <> 10 THEN
    RAISE EXCEPTION '0064 self-check FAILED: seed wage_interval_hours expect 10 distinct values, got %', v_dist;
  END IF;
  SELECT count(*) INTO v_bad FROM public.project
   WHERE title LIKE '%生态推广' AND wage_interval_hours NOT BETWEEN 1 AND 100;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0064 self-check FAILED: % seed rows have wage_interval_hours outside 1..100', v_bad;
  END IF;

  -- ⑤ 十个 batt 额定互不相同
  SELECT count(DISTINCT wage_batt_per_claim) INTO v_dist FROM public.project WHERE title LIKE '%生态推广';
  IF v_dist <> 10 THEN
    RAISE EXCEPTION '0064 self-check FAILED: seed wage_batt_per_claim expect 10 distinct values, got %', v_dist;
  END IF;

  -- ⑥ 两币同空同非空（半对行 = 0）
  SELECT count(*) INTO v_bad FROM public.project
   WHERE title LIKE '%生态推广'
     AND ((wage_cid IS NULL) <> (wage_currency_amount IS NULL));
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0064 self-check FAILED: % seed rows have half-paired wage currency fields', v_bad;
  END IF;

  -- ⑦ 有可用次币 ⇒ 恰 5 行带次币；无次币 ⇒ 0 行带（同空同非空已保证不写半对）
  SELECT count(*) INTO v_sec FROM public.currency WHERE status = 'listed' AND cid <> 1;
  IF v_sec > 0 THEN
    SELECT count(*) INTO v_bad FROM public.project
     WHERE title LIKE '%生态推广' AND wage_cid IS NOT NULL;
    IF v_bad <> 5 THEN
      RAISE EXCEPTION '0064 self-check FAILED: expect 5 seed rows with secondary wage currency, got %', v_bad;
    END IF;
  END IF;

  -- ⑧ snowflake_id 唯一（DB 约束已保证，这里是取值面自证：十个互不相同）
  SELECT count(DISTINCT snowflake_id) INTO v_dist FROM public.project WHERE title LIKE '%生态推广';
  IF v_dist <> 10 THEN
    RAISE EXCEPTION '0064 self-check FAILED: seed snowflake_id expect 10 distinct values, got %', v_dist;
  END IF;
END $$;
