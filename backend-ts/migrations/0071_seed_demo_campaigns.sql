-- ============================================================================
-- 0071_seed_demo_campaigns.sql
-- 首页「热门任务」5 张演示卡落成真数据（项目 / 活动 / 任务三级种子）
-- ----------------------------------------------------------------------------
-- 上游：0063_project_domain.sql（project 四表）· 0065_campaign_hierarchy.sql（campaign/task）
--       0068_project_slug_campaign_link.sql（project.slug + campaign.project_id NOT NULL）
--       0069_project_avatar.sql（project.avatar_url）· 0070_drop_job_domain.sql（job 域下线）
--
-- 为什么本文件存在（Kevin 2026-10-21 派单 · 后端种子半）：
--   首页【热门任务】卡此前由 `frontend/src/home-campaign.js` 的 5 条 mock 常量补足 ——
--   mock 卡**不可点、不带 campaign_id**，与 `/campaign` 页的数据天然不一致。
--   本迁移把这 5 张 mock 卡**整体搬进 campaign 集合**变成真数据（项目 → 活动 → 任务各 1 行），
--   使 `GET /api/home/campaign-tasks` 的行集与 `/campaign` 读口同源同口径；
--   随后由**前端单**删除 mock 常量（本文件不改 frontend / docs 一字）。
--
-- 三级映射（逐字对齐 mock 卡；顺序即 mock 卡序）：
--   项目(title / slug)      活动(campaign)    任务(task)            主奖励  任务状态
--   星链楼市 / starlink-estate  新赛季社区任务    每日签到打卡            $12    active
--   喵喵矿场 / meow-farm        邀新有好礼        邀请 3 位好友注册       $30    active
--   深海流动性 / deep-sea       质押挑战赛        完成首笔质押            $88    active
--   云上集市 / cloud-market     上周回顾          晒单分享赢奖励          $6     ended（mock 卡即「已截止」）
--   贝壳学院 / shell-academy    新人引导季        回答新手问卷            $4     active
--
-- 取值口径（本文件自定，写明以便复核）：
--   · owner_uid = 既有管理员（`users.is_admin IS TRUE` 的最小 uid；**无管理员 ⇒ 退化为最小 uid**）；
--     一个用户都没有 ⇒ 三段落零行 ⇒ 尾部自检以「项目缺席」明示失败（不静默半迁移）；
--   · project.status 恒 'recruiting'（演示项目是待招项目）；headcount = 100；
--     wage_batt_per_claim = 10 / wage_interval_hours = 24（承 0063 的 > 0 与 1..100 值域）；
--   · **零币种工资**：wage_cid / wage_currency_amount 同为空（不写半对，避 23514）；
--   · campaign.status 恒 'active'；时间窗 = now() - 1 day → now() + 365 day（同一事务同一 now()，
--     故 time_end - time_start 恒 = 366 days，尾部自检按此逐行对拍）；
--   · task.status：前四条 'active'、云上集市那条 'ended'（mock 卡本来就是「已截止」）；
--     reward_amount_primary = 12 / 30 / 88 / 6 / 4（主奖励恒 $，cid = 1，结构上无 reward_cid_primary）；
--     reward_cid_secondary / reward_amount_secondary **不写**（mock 卡的次币是展示态，真数据只落 $ 主奖励，
--     避免凭空发钱 —— 次币成对与非 cid=1 的库面约束自然满足）；
--   · task.sort 恒 0（派单逐字）；task.time_start / time_end **抄自所属活动的窗**（同活动同窗）；
--   · task.time_created 显式递减（第 n 张 = now() - n 分钟）：首页读口排序是
--     `time_created DESC, task_id DESC`，而 5 行同事务插入 ⇒ now() 相同、排序会退化成 task_id 逆序；
--     显式递减使**首页卡序 = mock 卡序**（星链楼市 → 喵喵矿场 → 深海流动性 → 云上集市 → 贝壳学院）。
--   · snowflake_id = 常数 × 2^22，取 2200/2300/2400 三段（0064 的种子占 1000 段；服务层 nextSnowflake
--     是毫秒时间戳段 ⇒ 不可能撞上），确定性、互不相同，唯一性仍由 UNIQUE 约束兜底。
--   · **零 ledger 写**：三段落全是直接 INSERT，不走建项扣费 / 不走任何发奖链路
--     ⇒ project_create_fee 不扣、balances / ledger 表零新行（干跑探针在事务内前后计数对拍自证）。
--
-- 幂等口径（重放安全，三段各自一套键）：
--   ① project   —— 按 `slug` 判存在（slug 已被 0068 置 NOT NULL + UNIQUE）；
--   ② campaign  —— 按 `(project_id, title)` 判存在；
--   ③ task      —— 按 `(campaign_id, title)` 判存在。
--   ⇒ 反复 apply 落同一终态；真实用户日后自建同名活动/任务时，本文件不会抢先占位、也不会覆盖。
--
-- 文件形状纪律（与 0057–0070 同族）：
--   · 文件内**不写 BEGIN / COMMIT**（scripts/migrate.ts 逐文件包事务）；
--   · 注释里**不出现成对美元定界符字面**（切分器按它切换 in-dollar 态）⇒ 统一写「DO 块」；
--   · 本文件**只写三张业务表** + 一个尾部 DO 自检；零 DDL、零 ALTER、零 UPDATE/DELETE。
--
-- ★ home 读口口径（供复核，勿误判）：`GET /api/home/campaign-tasks` 的行集谓词是
--   `campaign.status = 'active' AND task.status <> 'draft' AND project.status <> 'ended'`
--   —— 即 **ended 的 task 仍会出现在首页**（卡片显「已截止」，正是 mock 第 4 张的形态）。
--   故本迁移落库后首页读口对这批种子返回 **5 行（4 active + 1 ended）**，与 `/campaign` 同源一致；
--   尾部自检按此事实断言（4 active 逐条在列 + 云上集市那条恰为 ended）。
-- ============================================================================

-- ============================================================================
-- ① 五个演示项目（owner = 管理员；status 恒 recruiting）
-- ============================================================================
WITH own AS (
  SELECT uid FROM public.users WHERE is_admin IS TRUE ORDER BY uid LIMIT 1
), seed(n, slug, title, description) AS (
  VALUES
    (1, 'starlink-estate', '星链楼市',
     '星链楼市行情与房源共建社区：整理新盘动态、撰写看房笔记、维护社区问答，帮新人快速看懂市场。'),
    (2, 'meow-farm',       '喵喵矿场',
     '喵喵矿场算力社区：矿机配置答疑、收益数据整理、新手挖矿教程编写，让每一份算力都算得明白。'),
    (3, 'deep-sea',        '深海流动性',
     '深海流动性做市与质押社区：策略复盘、LP 收益对比、风险提示，长期跟踪深水区的资金效率。'),
    (4, 'cloud-market',    '云上集市',
     '云上集市商户与买家共建社群：晒单评测、好物推荐、每周市集话题，把线下的烟火气搬到云上。'),
    (5, 'shell-academy',   '贝壳学院',
     '贝壳学院新手课堂：体系化课程、答疑互助、学习笔记沉淀，从第一课陪到独立上手。')
), payload AS (
  SELECT s.n,
         ((2200 + s.n)::bigint * 4194304) AS snowflake_id,
         s.slug, s.title, s.description
  FROM seed s
)
INSERT INTO public.project (
  snowflake_id, owner_uid, slug, title, description, headcount,
  recruit_min_account_days, wage_batt_per_claim, wage_cid, wage_currency_amount,
  wage_interval_hours, status
)
SELECT
  p.snowflake_id,
  (SELECT uid FROM own),
  p.slug,
  p.title,
  p.description,
  100,
  0,
  10::numeric,
  NULL,
  NULL,
  24,
  'recruiting'
FROM payload p
WHERE (SELECT uid FROM own) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.project x WHERE x.slug = p.slug)
  AND NOT EXISTS (SELECT 1 FROM public.project x WHERE x.snowflake_id = p.snowflake_id);

-- ============================================================================
-- ② 每个项目一个活动（status 全 active；窗 = now()-1day → now()+365day）
-- ============================================================================
WITH seed(n, slug, title, description) AS (
  VALUES
    (1, 'starlink-estate', '新赛季社区任务',
     '新赛季社区共建：连续打卡、优质内容评选同步开启，完成任务即计入赛季奖励名单。'),
    (2, 'meow-farm',       '邀新有好礼',
     '老矿工邀请新朋友入驻喵喵矿场，被邀请人完成新手引导后双方同享奖励。'),
    (3, 'deep-sea',        '质押挑战赛',
     '为期一季的质押挑战：完成首笔质押即计入完赛名单，收益与挑战奖励两条腿各自到账。'),
    (4, 'cloud-market',    '上周回顾',
     '上周市集活动回顾：晒单与好物推荐汇总，本期已截止，仅作存档展示。'),
    (5, 'shell-academy',   '新人引导季',
     '新人引导季：跟着课程走完第一周，完成新手问卷即可领取入学礼。')
), payload AS (
  SELECT s.n,
         ((2300 + s.n)::bigint * 4194304) AS snowflake_id,
         s.slug, s.title, s.description
  FROM seed s
)
INSERT INTO public.campaign (
  snowflake_id, project_id, title, description, status, time_start, time_end
)
SELECT
  p.snowflake_id,
  pr.project_id,
  p.title,
  p.description,
  'active',
  now() - interval '1 day',
  now() + interval '365 days'
FROM payload p
JOIN public.project pr ON pr.slug = p.slug
WHERE NOT EXISTS (
        SELECT 1 FROM public.campaign c
         WHERE c.project_id = pr.project_id AND c.title = p.title
      )
  AND NOT EXISTS (SELECT 1 FROM public.campaign c2 WHERE c2.snowflake_id = p.snowflake_id);

-- ============================================================================
-- ③ 每个活动一个任务（标题/奖励同 mock 卡；云上集市那条 ended；窗抄活动窗）
-- ============================================================================
WITH seed(n, slug, campaign_title, title, description, reward, status) AS (
  VALUES
    (1, 'starlink-estate', '新赛季社区任务', '每日签到打卡',
     '每天到星链楼市社区签到一次，连续打卡不断签，赛季结束统一发放完成奖励。', 12, 'active'),
    (2, 'meow-farm',       '邀新有好礼',     '邀请 3 位好友注册',
     '通过专属邀请链接邀请 3 位好友注册，并在喵喵矿场完成新手引导即算达标。', 30, 'active'),
    (3, 'deep-sea',        '质押挑战赛',     '完成首笔质押',
     '在深海流动性完成首笔质押（金额不限），保留链上交易哈希备查，活动期内有效。', 88, 'active'),
    (4, 'cloud-market',    '上周回顾',       '晒单分享赢奖励',
     '在社区晒出本周市集订单与使用体验，附图片与文字说明；本期晒单已截止。', 6, 'ended'),
    (5, 'shell-academy',   '新人引导季',     '回答新手问卷',
     '填写贝壳学院新手问卷（约 3 分钟），帮我们改进课程顺序与讲解节奏。', 4, 'active')
), payload AS (
  SELECT s.n,
         ((2400 + s.n)::bigint * 4194304) AS snowflake_id,
         s.slug, s.campaign_title, s.title, s.description, s.reward, s.status
  FROM seed s
)
INSERT INTO public.task (
  snowflake_id, campaign_id, title, description, status,
  time_start, time_end, sort, reward_amount_primary,
  reward_cid_secondary, reward_amount_secondary, time_created
)
SELECT
  p.snowflake_id,
  c.campaign_id,
  p.title,
  p.description,
  p.status,
  c.time_start,
  c.time_end,
  0,
  p.reward::numeric,
  NULL,
  NULL,
  -- 首页读口按 time_created DESC 排序 ⇒ 第 n 张卡早 n 分钟，使首页卡序 = mock 卡序
  now() - (p.n * interval '1 minute')
FROM payload p
JOIN public.project  pr ON pr.slug = p.slug
JOIN public.campaign c  ON c.project_id = pr.project_id AND c.title = p.campaign_title
WHERE NOT EXISTS (
        SELECT 1 FROM public.task t
         WHERE t.campaign_id = c.campaign_id AND t.title = p.title
      )
  AND NOT EXISTS (SELECT 1 FROM public.task t2 WHERE t2.snowflake_id = p.snowflake_id);

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
--   ① 5 个项目逐字在场（slug / title / status / headcount / 工资 / owner 全 tuple 对拍）
--   ② 5 个项目各恰 1 行、且无第六行混入这批 slug（「无额外行」）
--   ③ 5 个活动逐字在场（项目 slug + 活动 title + active + 时间窗 366 days）
--   ④ 这批项目下活动恰 5 行（无额外行）
--   ⑤ 5 个任务逐字在场（活动 + 标题 + 奖励 + 状态 + sort 0 + 窗 = 活动窗）
--   ⑥ 这批活动下任务恰 5 行（无额外行）
--   ⑦ home 读口（与 project-service 的 HOME_CAMPAIGN_TASKS_SQL 同谓词）对这批种子：
--      恰 5 行、其中 status='active' 恰 4 行、云上集市那条恰 1 行且为 'ended'
-- ============================================================================
DO $$
DECLARE
  v_owner bigint;
  v_cnt   int;
  v_n     int;
  v_home  int;
BEGIN
  -- ① 5 个项目逐字（owner = 管理员最小 uid）
  SELECT uid INTO v_owner FROM public.users WHERE is_admin IS TRUE ORDER BY uid LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT uid INTO v_owner FROM public.users ORDER BY uid LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION '0071 self-check FAILED: no user to own the demo projects (users 表空 ⇒ 三段落零行)';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.project p
   WHERE (p.slug, p.title, p.status, p.headcount, p.wage_batt_per_claim,
          p.wage_interval_hours, p.owner_uid)
     IN (
       ('starlink-estate', '星链楼市',   'recruiting', 100, 10::numeric, 24, v_owner),
       ('meow-farm',       '喵喵矿场',   'recruiting', 100, 10::numeric, 24, v_owner),
       ('deep-sea',        '深海流动性', 'recruiting', 100, 10::numeric, 24, v_owner),
       ('cloud-market',    '云上集市',   'recruiting', 100, 10::numeric, 24, v_owner),
       ('shell-academy',   '贝壳学院',   'recruiting', 100, 10::numeric, 24, v_owner)
     )
     -- 零币种工资：两列同为空（row 比较遇 NULL 恒 NULL ⇒ 故单列断言，不入上面的 tuple）
     AND p.wage_cid IS NULL
     AND p.wage_currency_amount IS NULL;
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: expect 5 demo projects (slug/title/status/headcount/wage/owner 逐字), got %', v_cnt;
  END IF;

  -- ② 无额外行：这批 slug 恰 5 行，且同名的项目不得落在别的 slug 上
  SELECT count(*) INTO v_cnt FROM public.project
   WHERE slug IN ('starlink-estate','meow-farm','deep-sea','cloud-market','shell-academy');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: demo slug set expect exactly 5 rows, got %', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM public.project
   WHERE title IN ('星链楼市','喵喵矿场','深海流动性','云上集市','贝壳学院')
     AND slug NOT IN ('starlink-estate','meow-farm','deep-sea','cloud-market','shell-academy');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0071 self-check FAILED: % demo-title projects carry a foreign slug (撞名残留)', v_cnt;
  END IF;

  -- ③ 5 个活动逐字（status active + 窗 366 days 且跨过当下）
  SELECT count(*) INTO v_cnt
    FROM public.campaign c
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE (pr.slug, c.title, c.status) IN (
       ('starlink-estate', '新赛季社区任务', 'active'),
       ('meow-farm',       '邀新有好礼',     'active'),
       ('deep-sea',        '质押挑战赛',     'active'),
       ('cloud-market',    '上周回顾',       'active'),
       ('shell-academy',   '新人引导季',     'active')
     )
     AND c.time_end - c.time_start = interval '366 days'
     AND c.time_start < now() AND c.time_end > now()
     AND length(btrim(c.description)) > 0;
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: expect 5 demo campaigns (active / 366d 窗 / 描述非空), got %', v_cnt;
  END IF;

  -- ④ 无额外行：这批项目下活动恰 5 行
  SELECT count(*) INTO v_cnt
    FROM public.campaign c
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE pr.slug IN ('starlink-estate','meow-farm','deep-sea','cloud-market','shell-academy');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: demo projects expect exactly 5 campaigns, got %', v_cnt;
  END IF;

  -- ⑤ 5 个任务逐字（奖励 12/30/88/6/4 · 前四 active / 云上 ended · sort 0 · 窗 = 活动窗）
  SELECT count(*) INTO v_cnt
    FROM public.task t
    JOIN public.campaign c  ON c.campaign_id = t.campaign_id
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE (pr.slug, t.title, t.reward_amount_primary, t.status, t.sort) IN (
       ('starlink-estate', '每日签到打卡',       12::numeric, 'active', 0),
       ('meow-farm',       '邀请 3 位好友注册',  30::numeric, 'active', 0),
       ('deep-sea',        '完成首笔质押',       88::numeric, 'active', 0),
       ('cloud-market',    '晒单分享赢奖励',      6::numeric, 'ended',  0),
       ('shell-academy',   '回答新手问卷',        4::numeric, 'active', 0)
     )
     AND t.time_start = c.time_start
     AND t.time_end   = c.time_end
     AND t.reward_cid_secondary IS NULL AND t.reward_amount_secondary IS NULL
     AND length(btrim(t.description)) > 0;
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: expect 5 demo tasks (奖励/状态/sort/窗/描述 逐字), got %', v_cnt;
  END IF;

  -- ⑥ 无额外行：这批活动下任务恰 5 行
  SELECT count(*) INTO v_cnt
    FROM public.task t
    JOIN public.campaign c  ON c.campaign_id = t.campaign_id
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE pr.slug IN ('starlink-estate','meow-farm','deep-sea','cloud-market','shell-academy');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: demo campaigns expect exactly 5 tasks, got %', v_cnt;
  END IF;

  -- ⑦ home 读口（逐字同谓词）：5 行在列，active 恰 4 行，云上集市那条恰 1 行且 ended
  SELECT count(*) INTO v_home
    FROM public.task t
    JOIN public.campaign c  ON c.campaign_id = t.campaign_id
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE c.status = 'active'
     AND t.status <> 'draft'
     AND pr.status <> 'ended'
     AND pr.slug IN ('starlink-estate','meow-farm','deep-sea','cloud-market','shell-academy');
  IF v_home <> 5 THEN
    RAISE EXCEPTION '0071 self-check FAILED: home 读口对这批种子 expect 5 行, got %', v_home;
  END IF;

  SELECT count(*) INTO v_cnt
    FROM public.task t
    JOIN public.campaign c  ON c.campaign_id = t.campaign_id
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE c.status = 'active'
     AND t.status <> 'draft'
     AND pr.status <> 'ended'
     AND t.status = 'active'
     AND pr.slug IN ('starlink-estate','meow-farm','deep-sea','cloud-market','shell-academy');
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION '0071 self-check FAILED: home 读口 active 任务 expect 4 条, got %', v_cnt;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.task t
    JOIN public.campaign c  ON c.campaign_id = t.campaign_id
    JOIN public.project  pr ON pr.project_id = c.project_id
   WHERE c.status = 'active'
     AND t.status <> 'draft'
     AND pr.status <> 'ended'
     AND pr.slug = 'cloud-market'
     AND t.title = '晒单分享赢奖励'
     AND t.status = 'ended';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0071 self-check FAILED: 云上集市那条在 home 读口 expect 恰 1 行且 ended, got %', v_n;
  END IF;
END $$;
