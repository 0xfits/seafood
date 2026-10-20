-- ============================================================================
-- 0058_view_dedup_switch.sql
-- 详情浏览去重开关（Kevin 2026-10-20 · **后台开关**：可选去重/不去重；
--   代码层默认 = on（去重），**当前配置 = off（不去重，现状行为不变）**）
-- ----------------------------------------------------------------------------
-- ① `public.listing_view_log`（访客×商品×天 去重日志；消费口 = 详情读口 on 分支）
--    · `id bigserial PK` · `listing_id bigint NOT NULL` · `viewer_key text NOT NULL`
--      · `view_day date NOT NULL DEFAULT current_date` · `time_created timestamptz NOT NULL DEFAULT now()`；
--    · 具名唯一约束 `listing_view_log_uniq (listing_id, viewer_key, view_day)`
--      = 去重判据真源（同访客同商品同天至多一行；读口 `INSERT … ON CONFLICT ON CONSTRAINT
--      listing_view_log_uniq DO NOTHING`，**rowCount = 1 才自增**）；
--    · 索引 `listing_view_log_listing_idx (listing_id)`（按商品清账 / 对账用）；
--    · **不建 FK**（有意取舍）：历史商品删除不得阻碍日志保留（日志是计数账本、不是商品从属数据；
--      listing_id 悬挂行 = 已删商品的计数残影，随表保留）。本文件尾部自检含「FK 数 = 0」反断言；
--    · 计数读数不变：`views` 仍 = listing.view_count（自增后读）；本表只承「去没去重」判定，不承计数真值。
-- ② `app_config` 开关行：键 `detail_view_dedup` 值 `{"dedup":"off"}`（**当前不去重**）
--    · ⚠️ 0017 容器硬约束 `app_config_value_is_container`：value 只接受 jsonb **object/array**
--      ⇒ 裸标量 '"off"'::jsonb 会被 CHECK 拒 ⇒ 开关值落 `{"dedup":"off"}` 对象内字段；
--    · 合法值闭集 = `on | off`（唯一真源 = 本文件尾部自检 + 服务层 `DETAIL_VIEW_DEDUP_LEGAL_VALUES`；
--      app_config 表本身无键名 CHECK（只有容器 CHECK）⇒ 键面在代码 `APP_CONFIG_LEGAL_KEYS`
--      同步前推（9→10 键，**在册 ≠ 可写**：该键不经 /api/admin/settings 写，只经配置行 / 迁移改）；
--    · **ON CONFLICT (key) DO NOTHING**：反复 apply **不覆盖**运维已翻转的值（迁移只补缺行、绝不回拨）；
--    · 读口语义：值非法 / 行缺席 ⇒ **按默认 on（去重）fail-safe**（服务层 `parseDetailViewDedupSwitch`）。
-- 顺序纪律：
--   · **先 apply 后 push**（与 0057 同族）：若代码先上、迁移未 apply，on 分支首语句 42P01 ⇒
--     fail-open 落旧口径自增（详情不挂、计数退化为不去重），但会每请求多一次失败语句 ⇒ 按 0057 顺序走；
--   · 幂等：`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `ON CONFLICT DO NOTHING`
--     ⇒ 反复 apply 落同一终态；
--   · 文件内**不写 BEGIN/COMMIT**（`scripts/migrate.ts` 逐文件包事务）；不改历史迁移文件（checksum）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.listing_view_log (
  id           bigserial  NOT NULL,
  listing_id   bigint     NOT NULL,
  viewer_key   text       NOT NULL,
  view_day     date       NOT NULL DEFAULT current_date,
  time_created timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_view_log_pk PRIMARY KEY (id),
  CONSTRAINT listing_view_log_uniq UNIQUE (listing_id, viewer_key, view_day)
);

CREATE INDEX IF NOT EXISTS listing_view_log_listing_idx
  ON public.listing_view_log (listing_id);

INSERT INTO public.app_config (key, value, updated_by)
VALUES ('detail_view_dedup', '{"dedup":"off"}'::jsonb, 0)
ON CONFLICT (key) DO NOTHING;

-- 尾部自检（apply 后即验；任一不满足 ⇒ 抛错 ⇒ 整文件事务回滚、不写版本行）
DO $$
DECLARE
  v_cols     int;
  v_type     text;
  v_default  text;
  v_nullable text;
  v_cons     int;
  v_idx      int;
  v_fk       int;
  v_val      text;
  v_jtype    text;
  v_listing_cols int;
BEGIN
  -- ① 表在场 + 五列逐列（类型 / 默认 / 非空）
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_view_log'
     AND column_name IN ('id', 'listing_id', 'viewer_key', 'view_day', 'time_created');
  IF v_cols <> 5 THEN
    RAISE EXCEPTION '0058 self-check FAILED: listing_view_log expect 5 named columns, got %', v_cols;
  END IF;

  SELECT data_type, column_default, is_nullable INTO v_type, v_default, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_view_log' AND column_name = 'id';
  IF v_type <> 'bigint' OR v_nullable <> 'NO' OR v_default NOT LIKE 'nextval%' THEN
    RAISE EXCEPTION '0058 self-check FAILED: id expect bigserial PK (bigint NOT NULL nextval), got %/%/%', v_type, v_nullable, COALESCE(v_default, 'NULL');
  END IF;

  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_view_log' AND column_name = 'listing_id';
  IF v_type <> 'bigint' OR v_nullable <> 'NO' THEN
    RAISE EXCEPTION '0058 self-check FAILED: listing_id expect bigint NOT NULL, got %/%', v_type, v_nullable;
  END IF;

  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_view_log' AND column_name = 'viewer_key';
  IF v_type <> 'text' OR v_nullable <> 'NO' THEN
    RAISE EXCEPTION '0058 self-check FAILED: viewer_key expect text NOT NULL, got %/%', v_type, v_nullable;
  END IF;

  SELECT data_type, is_nullable, column_default INTO v_type, v_nullable, v_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_view_log' AND column_name = 'view_day';
  -- ★ LOWER 比对：PG 会把 default 规范成大写 `CURRENT_DATE`（information_schema 原样回显）
  IF v_type <> 'date' OR v_nullable <> 'NO' OR LOWER(COALESCE(v_default, '')) NOT LIKE '%current_date%' THEN
    RAISE EXCEPTION '0058 self-check FAILED: view_day expect date NOT NULL DEFAULT current_date, got %/%/%', v_type, v_nullable, COALESCE(v_default, 'NULL');
  END IF;

  SELECT data_type, is_nullable INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing_view_log' AND column_name = 'time_created';
  IF v_type <> 'timestamp with time zone' OR v_nullable <> 'NO' THEN
    RAISE EXCEPTION '0058 self-check FAILED: time_created expect timestamptz NOT NULL, got %/%', v_type, v_nullable;
  END IF;

  -- ② 具名唯一约束在场（去重判据真源）且恰覆盖三列
  SELECT count(*) INTO v_cons FROM pg_constraint
   WHERE conrelid = 'public.listing_view_log'::regclass
     AND conname = 'listing_view_log_uniq' AND contype = 'u';
  IF v_cons <> 1 THEN
    RAISE EXCEPTION '0058 self-check FAILED: listing_view_log_uniq count = % (expect 1)', v_cons;
  END IF;
  SELECT count(*) INTO v_cons FROM pg_attribute a
   JOIN pg_constraint c ON c.conrelid = a.attrelid AND a.attnum = ANY (c.conkey)
   WHERE c.conrelid = 'public.listing_view_log'::regclass AND c.conname = 'listing_view_log_uniq'
     AND a.attname IN ('listing_id', 'viewer_key', 'view_day');
  IF v_cons <> 3 THEN
    RAISE EXCEPTION '0058 self-check FAILED: listing_view_log_uniq expect 3 columns, got %', v_cons;
  END IF;

  -- ③ 索引在场
  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'listing_view_log'
     AND indexname = 'listing_view_log_listing_idx';
  IF v_idx <> 1 THEN
    RAISE EXCEPTION '0058 self-check FAILED: listing_view_log_listing_idx count = % (expect 1)', v_idx;
  END IF;

  -- ④ 反断言：**零 FK**（历史商品删除不阻碍日志保留 —— 见文件头取舍）
  SELECT count(*) INTO v_fk FROM pg_constraint
   WHERE conrelid = 'public.listing_view_log'::regclass AND contype = 'f';
  IF v_fk <> 0 THEN
    RAISE EXCEPTION '0058 self-check FAILED: listing_view_log must carry 0 FK (log outlives listings), got %', v_fk;
  END IF;

  -- ⑤ 开关行在场且值合法（object + dedup ∈ on|off；**不**断言具体值 —— 运维翻转后重 apply 不得误判）
  SELECT jsonb_typeof(value), value ->> 'dedup' INTO v_jtype, v_val
    FROM public.app_config WHERE key = 'detail_view_dedup';
  IF v_jtype IS NULL THEN
    RAISE EXCEPTION '0058 self-check FAILED: app_config key detail_view_dedup missing';
  END IF;
  IF v_jtype <> 'object' THEN
    RAISE EXCEPTION '0058 self-check FAILED: detail_view_dedup value expect jsonb object (0017 container CHECK), got %', v_jtype;
  END IF;
  IF v_val NOT IN ('on', 'off') THEN
    RAISE EXCEPTION '0058 self-check FAILED: detail_view_dedup.dedup expect on|off, got %', COALESCE(v_val, 'NULL');
  END IF;

  -- ⑥ 列数守恒：listing 仍 15 列（本迁移零列变更）
  SELECT count(*) INTO v_listing_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing';
  IF v_listing_cols <> 15 THEN
    RAISE EXCEPTION '0058 self-check FAILED: public.listing expect 15 columns (unchanged by 0058), got %', v_listing_cols;
  END IF;

  RAISE NOTICE '0058 OK: listing_view_log (5 cols, uniq(listing,viewer,day), idx, 0 FK) · app_config detail_view_dedup={"dedup":"%"} (legal on|off) · listing_cols=%', v_val, v_listing_cols;
END
$$;
