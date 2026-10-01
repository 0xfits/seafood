-- ============================================================================
-- 0021_content_translation.sql · P6-TR-1a 多语言 UGC 翻译表（**纯新增**，本单不 apply）
-- ============================================================================
-- 用途（一句话）：把「用户录入的中文内容」译成 en / vn（DeepSeek）或转成 hk
--   （OpenCC 确定性简繁转换）后的结果，与「译文缓存」「待翻译/失败重试状态位」
--   集中落在一套表里，供 TR-1b 的写路径（waitUntil 后台补齐）与定时兜底读取。
--
-- 背景（已拍板，见 docs/seafood.master-plan.md §5.111）：
--   · 站点有四语 UI（zh 简体 / hk 繁体 / en / vn 越南语），但**用户录入内容只存中文一种**
--     ⇒ 切语言时卡片正文不变。
--   · 引擎：en/vn = DeepSeek（OpenAI 兼容 /chat/completions）；hk = OpenCC 简繁转换
--     （**确定性转换，不是翻译**）。
--   · 形态：写入即返回 + waitUntil 后台补齐 + 定时兜底；**绝不阻塞提交**，
--     失败留空 + status 标记 + 后台重试。
--   · **真实前提（TR-0 双口径取证）**：库与迁移面**都没有三语列**
--     （information_schema 探针 trilingual_cols: []；grep migrations 0 命中）
--     ⇒ 本表是**唯一**的三语落点，不存在「已有的列」可用。
--   · 采「独立翻译表」而非逐表加 18 列（master-plan §5.111 G）：四类内容
--     （job.title/description、listing.title/description、users.bio、currency.name）
--     一套表统一，**将来新增内容类型免 ALTER**（⇒ entity_type / field **故意不加 CHECK**）。
--
-- 表 1 `public.content_translation` —— 译文真源 + 状态位（**写入者：翻译服务层**）
--   幂等键 = PK `(entity_type, entity_id, field, lang)`
--     · entity_type  text  内容对象类型（当前：job / listing / user / currency）
--     · entity_id    text  该对象的业务主键（字符串化，兼容 bigint / uuid / slug）
--     · field        text  字段名（title / description / bio / name …）
--     · lang         text  目标语言（en / vn / hk；zh 是源语言，**永不入本表**）
--     · text         text  译文正文；`status='failed'|'deferred'` 时**留空或不写**
--                          （红线：**不写脏数据**）
--     · status       text  取值域 **pending | ready | failed | deferred**（具名 CHECK）
--     · attempts     int   已尝试次数（后台重试的闸门：`attempts < N` 才再试）
--     · last_error   text  最近一次失败原因（机读 reason + 摘要，**不含用户全文**）
--     · updated_at   timestamptz  写入 / 重试时刻。**日限额计数分母**
--                                 （当日 `updated_at` 行数 ≤ TRANSLATE_DAILY_ITEM_CAP）
--   语义约定：
--     · 行存在但 status='pending' ⇒ 「该字段该语言待翻译」；TR-1b 的 mapper 读不到
--       status='ready' 的 text ⇒ **回落原文**（API 契约不变）。
--     · 一行一行地 upsert（ON CONFLICT (PK)）⇒ 幂等；重放不产生重复行。
--     · **本表与账本无关**：翻译属内容更新，`Δledger_entry` 恒为 0。
--
-- 表 2 `public.translation_cache` —— 按**源文本内容**去重的译文缓存
--   幂等键 = PK `(src_hash, src_lang, tgt_lang)`
--     · src_hash   text    源文本的 sha256（hex，**只哈希文本本身**，与实体无关）
--     · src_lang   text    源语言，默认 'zh'
--     · tgt_lang   text    目标语言（en / vn / hk）
--     · text_out   text    缓存译文
--     · engine     text    产出该译文的引擎（'deepseek' / 'stub' / 'opencc'）
--     · created_at timestamptz 首次写入时刻
--   语义约定：**命中即不再付费**（写前查缓存）；引擎/提示词升级后如需失效，
--     由调用方带上 engine 维度判断（本表**不自动过期**）。
--
-- 本迁移**建立**的对象：
--   ① public.content_translation（含 PK + 4 个具名 CHECK）
--   ② public.translation_cache（含 PK + 2 个具名 CHECK）
--   ③ 2 个索引（待翻译扫描 + 日限额计数）
--
-- 本迁移**不做**：
--   · **不建任何触发器**（⇒ 重置脚本 triggers 期望 **仍 = 43**，`p3x:626` 不变）
--   · 不改既有任何表的结构 / 数据；不新增 kind；不碰账本
--   · 不含 BEGIN/COMMIT（`scripts/migrate.ts` 对每个文件单事务包裹；文件内自开事务会嵌套报错）
--   · 不含 DO/EXECUTE 动态 DDL（`p3x` 的期望对象由 **stripSql 词法剥离注释后**抽取，
--     动态建对象会被漏 ⇒ 一律静态 DDL）
--   · 不含 CREATE/ALTER/DROP 任何**业务对象**（新表为空，无 DELETE/TRUNCATE 可言）
--
-- 幂等 / 可重入：全部 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`；
--   重复应用读数一致、不报错、不留痕。（本单**不 apply**；apply 步骤见交付报告。）
-- ============================================================================


-- ---------------------------------------------------------------- 表 1 / 译文真源 + 状态位
CREATE TABLE IF NOT EXISTS public.content_translation (
  entity_type  text        NOT NULL,
  entity_id    text        NOT NULL,
  field        text        NOT NULL,
  lang         text        NOT NULL,
  text         text,
  status       text        NOT NULL DEFAULT 'pending',
  attempts     int         NOT NULL DEFAULT 0,
  last_error   text,
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- 幂等键（同一实体 × 字段 × 语言**唯一**）
  CONSTRAINT content_translation_pk
    PRIMARY KEY (entity_type, entity_id, field, lang),

  -- 状态取值域（**具名 CHECK，不用枚举类型**：新增态免 ALTER TYPE 迁移）
  CONSTRAINT content_translation_status_enum
    CHECK (status IN ('pending', 'ready', 'failed', 'deferred')),

  -- 目标语言域：四个 UI 语言里 zh 是**源**（不入表），其余三个是目标
  CONSTRAINT content_translation_lang_enum
    CHECK (lang IN ('en', 'vn', 'hk')),

  -- attempts 非负
  CONSTRAINT content_translation_attempts_nonneg
    CHECK (attempts >= 0),

  -- ★ 红线「不写脏数据」的**结构级兜底**：status='ready' ⇒ 必须有非空正文；
  --   反之非 ready 的行**允许**正文为空（失败留空 + 后台重试）。
  --   `"text"` 显式加引号：列名与类型名同名（text），引号消除任何解析歧义。
  CONSTRAINT content_translation_ready_has_text
    CHECK (status <> 'ready' OR ("text" IS NOT NULL AND btrim("text") <> ''))
);

COMMENT ON TABLE public.content_translation IS
  'P6-TR-1a 三语译文真源 + 待翻译/失败状态位。PK=(entity_type,entity_id,field,lang) 即幂等键。'
  '写入者：翻译服务层（src/translate-service.ts）。status=ready 时 text 必须非空（CHECK 兜底）。'
  '与账本无关：翻译属内容更新，Δledger_entry 恒为 0。';
COMMENT ON COLUMN public.content_translation.entity_type IS
  '内容对象类型（job/listing/user/currency）。故意不加 CHECK：将来新增内容类型免 ALTER。';
COMMENT ON COLUMN public.content_translation.entity_id IS
  '内容对象业务主键（字符串化：job.job_id / listing.listing_id / users.uid / currency.cid）。';
COMMENT ON COLUMN public.content_translation.text IS
  '译文正文；status=failed|deferred 时为 NULL（失败留空，不写脏数据）。';
COMMENT ON COLUMN public.content_translation.status IS
  'pending|ready|failed|deferred（具名 CHECK）。TR-1b mapper 读不到 ready 正文即回落原文。';
COMMENT ON COLUMN public.content_translation.updated_at IS
  '写入/重试时刻。**日限额计数分母**：当日行数 ≤ TRANSLATE_DAILY_ITEM_CAP。';


-- ---------------------------------------------------------------- 表 2 / 按源文本去重的译文缓存
CREATE TABLE IF NOT EXISTS public.translation_cache (
  src_hash   text        NOT NULL,
  src_lang   text        NOT NULL DEFAULT 'zh',
  tgt_lang   text        NOT NULL,
  text_out   text        NOT NULL,
  engine     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 幂等键（同一源文本 × 源语言 × 目标语言**唯一**）
  CONSTRAINT translation_cache_pk
    PRIMARY KEY (src_hash, src_lang, tgt_lang),

  -- 缓存译文必须非空（空串缓存 = 脏缓存）
  CONSTRAINT translation_cache_text_out_nonempty
    CHECK (btrim(text_out) <> ''),

  -- 自译无意义：源语言 ≠ 目标语言
  CONSTRAINT translation_cache_lang_differs
    CHECK (tgt_lang <> src_lang)
);

COMMENT ON TABLE public.translation_cache IS
  'P6-TR-1a 译文缓存，按源文本 sha256 去重（PK=(src_hash,src_lang,tgt_lang) 即幂等键）。'
  '写前查、命中即不付费；本表不自动过期，引擎/提示词升级由调用方按 engine 维度判断失效。';
COMMENT ON COLUMN public.translation_cache.src_hash IS
  '源文本的 sha256（hex，64 字符）。只哈希文本本身，与实体/字段无关。';
COMMENT ON COLUMN public.translation_cache.engine IS
  '产出该译文的引擎：deepseek / stub / opencc。';


-- ---------------------------------------------------------------- 索引
-- 待翻译扫描（backfillPending：status IN (pending,failed) AND attempts < N ORDER BY updated_at）
CREATE INDEX IF NOT EXISTS content_translation_pending_idx
  ON public.content_translation (status, updated_at)
  WHERE status IN ('pending', 'failed');

-- 日限额计数（当日 updated_at 行数派生；不新建计数表）
CREATE INDEX IF NOT EXISTS content_translation_updated_at_idx
  ON public.content_translation (updated_at);

-- 缓存回源（按源哈希查缓存；PK 前缀已覆盖，此索引仅服务于「按 tgt_lang 统计」类运维查询）
CREATE INDEX IF NOT EXISTS translation_cache_tgt_lang_idx
  ON public.translation_cache (tgt_lang, created_at);
