-- ============================================================================
-- 0060_item_code_snowflake.sql
-- 商品对外标识统一（Kevin 2026-10-20 指令第 3 条）
-- ----------------------------------------------------------------------------
-- 指令原文（三条落一条本迁移）：① 统一商品 Id，建议 **Snowflake** 格式；
--   ② 商品编码 **itemCode = 字母数字混合 7 位**；③ 页面地址 `uri` 不再用数字 id，
--   改用 **itemCode**（前端链接 `/item/<itemCode>`；前端件另单，本迁移只落数据面）。
--
-- 本文件兑现的两列（`public.listing`，**加性、不动既有 15 列**）：
--
-- ① `snowflake_id bigint NOT NULL UNIQUE` —— 商品**唯一标识真源**（内部主键仍 `listing_id`
--    bigserial：既有 FK / 台账 / 触发器全部指向它 ⇒ 换主键是跨 10+ 表的破坏性变更，
--    **不在本单**；`snowflake_id` 是与 `listing_id` 并列的对外标识，二者 1:1）。
--    位布局（41 + 10 + 12 = 63 bit，恒正 ⇒ 永不触发 bigint 符号位）：
--      [63..23] 41 位 = 公历毫秒 - `1704067200000`（2024-01-01T00:00:00Z 项目纪元）
--      [22..13] 10 位 = 机器位（服务层 `SNOWFLAKE_MACHINE_ID`，默认 0；回填恒 0）
--      [12..0]  12 位 = 同毫秒序号（0..4095）
--    ⇒ 纪元 41 位可撑到 2093 年；同毫秒 4096 件上限（服务层耗尽即自旋等下一毫秒）。
--    **纪元常量必须与服务层 `backend-ts/src/item-id.ts` 的 `SNOWFLAKE_EPOCH_MS` 逐字相同**
--    （门 p60 A7 断言两处一致）—— 两处漂移 = 回填行与新建行不可比。
--
-- ② `item_code char(7) NOT NULL UNIQUE`，
--    `CHECK (item_code ~ '^[0-9A-Za-z]{7}$' AND item_code !~ '^[0-9]{7}$')` ——
--    **页面地址键**（`/item/<item_code>`）。CHECK 的**两个合取项都承重**：前者是形状（7 位字母数字，
--    与路由层 `ITEM_CODE_PATTERN` 同源），后者是**纯数字码禁令** —— `GET /api/prize/:ref` 的
--    双形态判别子就是「全数字 ⇒ listing_id、其余 ⇒ item_code」，纯数字码会与数字 ref 撞车
--    ⇒ 那种码下发即**永不可达**（会被当成 listing_id 解释）⇒ 从**库级**禁掉，保证判别无歧义
--    （服务层 `codeFromSnowflake` 与回填循环各自也 `+1` 跳过纯数字候选，三处同口径）。
--    字母表 = **base62 去混淆** 57 字符
--    `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`
--    （剔除 0/O/1/l/I 五个易混字形：手抄 / 语音 / 截图 OCR 场景下最常错的就是它们）：
--      · 数字 8 个（2-9）· 大写 24 个（A-Z 去 I/O）· 小写 **25** 个（a-z 只去 l —— 表内无 0/O，
--        故小写 o 无歧义）⇒ 62 − 5 = **57**（旧注释误记 56；`c_radix` 与字母表长度必须相等，
--        否则回填码与服务层码**不同基**、同雪花不同码 —— 门 p60 A8 对拍这一条）
--      · 57^7 = 1,954,897,493,193 ≈ 1.95e12 个码位（26 件 / 8 件的存量占用率可忽略）
--      · **恒非纯数字**：纯数字码会与「数字 ref = listing_id」的判定撞车 ⇒ 回填遇纯数字码
--        自动 `+1` 换码（服务层 `codeFromSnowflake` 同口径），故 `^[0-9]{7}$` 命中必须 = 0
--        （尾部自检 ⑦ 反断言）。
--
-- 回填口径（存量行，两列均 `WHERE ... IS NULL` ⇒ **重跑幂等**）：
--   · `snowflake_id`：`floor(extract(epoch from time_created) * 1000) - EPOCH` 作毫秒段，
--     行序号 `row_number() OVER (ORDER BY time_created, listing_id)` 作序号段；序号每满 4096
--     **自动进 1 毫秒**（`+ (rn-1)/4096`）⇒ 任意行数都唯一、且与 `time_created` **同序**
--     （时间早 ⇒ 雪花小）。存量时间戳全部非空（`listing_time_created_not_null`）⇒ 无兜底分支。
--   · `item_code`：`snowflake_id % 57^7` **确定性编码**成 7 位，撞已有码（或撞纯数字码）⇒
--     **`+1` 重试**（上限 1000 次，超限抛错整迁移回滚）—— 确定性 + 重试 = 可复现且必成功。
--   · `time_updated` **不得被回填改写**：`listing` 上有 `trg_listing_touch_time_updated`
--     （`BEFORE UPDATE` 无条件 `NEW.time_updated := now()`）⇒ 回填期间**事务内 DISABLE**、
--     回填完 **ENABLE**（DDL 在 PG 里是事务性的 ⇒ 失败回滚即复原；尾部自检 ⑧ 断言触发器
--     重新处于启用态 `tgenabled = 'O'`）。
--
-- 纪律（与 0057/0058/0059 同族）：
--   · 文件内**不写 BEGIN/COMMIT**（`scripts/migrate.ts` 逐文件包事务）；不改历史迁移文件（checksum）；
--   · 幂等：`ADD COLUMN IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` /
--     `IF NOT EXISTS` 包住 `ADD CONSTRAINT` / 回填 `WHERE ... IS NULL` ⇒ 反复 apply 落同一终态；
--   · **先 apply 后 push**：代码先上而本迁移未 apply ⇒ `createListingRow` 会 42P01（新列不在
--     INSERT 里跑不了）⇒ 按「先 apply 后 push」走（与 0057/0058/0059 同口径）；
--   · 存量 **26 行**（dev）/ 8 行（生产）全量回填，零行丢弃、零行新增（尾部自检 ⑤ 断言行数不变）。
--
-- 尾部 `DO` 块（单块）：回填 + `SET NOT NULL` + `ADD CONSTRAINT` + **九条自检** —— 任一不满足
--   即 `RAISE EXCEPTION` ⇒ 整文件事务回滚、不写版本行。
--   ★ 正文注释里**不得出现** `dollar-dollar` 引号字面（门/runner 的语句切分器按它切换 in-dollar 态，
--     注释里出现一次就会把整块切坏 ⇒ 本文件头注释写「DO 块」而不用记号本体）。
-- ============================================================================

-- ① 两列（先可空：存量行此刻必须允许 NULL 才能加列；回填后由尾部块 SET NOT NULL）
ALTER TABLE public.listing ADD COLUMN IF NOT EXISTS snowflake_id bigint;
ALTER TABLE public.listing ADD COLUMN IF NOT EXISTS item_code    char(7);

-- ② 两条唯一索引（先建：全 NULL 时唯一索引不拦 NULL；建在回填前 = 回填期间冲突当场暴露）
CREATE UNIQUE INDEX IF NOT EXISTS listing_snowflake_id_uidx ON public.listing (snowflake_id);
CREATE UNIQUE INDEX IF NOT EXISTS listing_item_code_uidx   ON public.listing (item_code);

DO $$
DECLARE
  -- ★ 字母表 / 纪元 / 位宽：与 `backend-ts/src/item-id.ts` 逐字同源（门 p60 A6/A7 对拍两处）
  c_alphabet   CONSTANT text   := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  c_radix      CONSTANT int    := 57;
  c_epoch_ms   CONSTANT bigint := 1704067200000;   -- 2024-01-01T00:00:00Z（项目纪元）
  c_seq_bits   CONSTANT int    := 12;
  c_seq_max    CONSTANT bigint := 4096;            -- 2^12
  v_rows_before bigint;
  v_rows_after  bigint;
  v_mod        bigint;
  v_seq        bigint;
  v_idx        bigint;
  v_base       bigint;
  v_val        bigint;
  v_try        int;
  v_code       text;
  r            record;
  v_n          bigint;
  v_after      bigint;
  v_def        text;
BEGIN
  -- ⓪ 行数基线（回填**不得**增删行；⑤ 断言行数不变）
  SELECT count(*) INTO v_rows_before FROM public.listing;

  -- ① 回填期间摘掉 `time_updated` 自动刷新（回填是「补标识列」，不是「业务改动」；
  --    不摘则 26 行的 time_updated 会被压成迁移时刻 = 篡改既有读数）
  ALTER TABLE public.listing DISABLE TRIGGER trg_listing_touch_time_updated;

  -- ② snowflake_id 回填（毫秒段 ← time_created · 序号段 ← 行序号 · 每 4096 行进 1 毫秒）
  WITH seq AS (
    SELECT l.listing_id,
           (floor(extract(epoch FROM l.time_created) * 1000)::bigint - c_epoch_ms) AS ms0,
           row_number() OVER (ORDER BY l.time_created, l.listing_id) AS rn
      FROM public.listing AS l
     WHERE l.snowflake_id IS NULL
  )
  UPDATE public.listing AS t
     SET snowflake_id = ((s.ms0 + ((s.rn - 1) / c_seq_max)) << c_seq_bits) | ((s.rn - 1) % c_seq_max)
    FROM seq AS s
   WHERE s.listing_id = t.listing_id;

  -- ③ item_code 回填（base57 确定性编码 + 冲突/纯数字 **重试**）
  v_mod := 1;
  FOR v_idx IN 1..7 LOOP
    v_mod := v_mod * c_radix;                       -- 57^7 = 1954897493193
  END LOOP;

  FOR r IN SELECT l.listing_id, l.snowflake_id
             FROM public.listing AS l
            WHERE l.item_code IS NULL
            ORDER BY l.listing_id LOOP
    -- 确定性打散：`(sf mod 57^7) * 1000003 mod 57^7` —— 1000003 与 57^7(=3^7·19^7) 互质
    -- ⇒ 该映射是 Z_(57^7) 上的**双射**（不同余数必不同码），同时把「雪花随建单递增」
    -- 摊成不连号的码（页面地址不可靠枚举、也不泄露「第几件」）。
    -- ★ 打散常量必须与服务层 `codeFromSnowflake` 逐字相同（门 p60 A6 对拍）。
    v_base := ((r.snowflake_id % v_mod) * 1000003) % v_mod;
    v_try  := 0;
    LOOP
      v_val  := (v_base + v_try) % v_mod;
      v_code := '';
      FOR v_idx IN 1..7 LOOP
        v_code := substr(c_alphabet, (v_val % c_radix)::int + 1, 1) || v_code;
        v_val  := v_val / c_radix;
      END LOOP;
      -- 接受条件：① 不与已有行撞码（唯一索引的**前置**判定，为了让重试可控而非靠报错）
      --           ② 不是纯数字码（纯数字 = 数字 ref 的判定域，路由层按 listing_id 解释）
      EXIT WHEN v_code !~ '^[0-9]{7}$'
            AND NOT EXISTS (SELECT 1 FROM public.listing AS x
                             WHERE x.item_code = v_code AND x.listing_id <> r.listing_id);
      v_try := v_try + 1;
      IF v_try > 1000 THEN
        RAISE EXCEPTION '0060 backfill FAILED: item_code 冲突重试超限（listing_id=%）', r.listing_id;
      END IF;
    END LOOP;
    UPDATE public.listing SET item_code = v_code WHERE listing_id = r.listing_id;
  END LOOP;

  -- ④ 收紧到 NOT NULL（回填完成后；重跑 = no-op）+ 格式 CHECK（具名，一次建好不再动）
  ALTER TABLE public.listing ALTER COLUMN snowflake_id SET NOT NULL;
  ALTER TABLE public.listing ALTER COLUMN item_code    SET NOT NULL;

  -- ★ CHECK 两条件：形状（7 位字母数字）∧ **非纯数字**。后者不是冗余 —— 路由层「全数字 ref ⇒
  --   listing_id」是向后兼容判据，纯数字 item_code 一旦入库就永不可达（被当 id 解释）⇒ 库级禁令
  --   是「双形态判别无歧义」的**结构保证**（不是仅靠生成器自律）。
  --   幂等体例：判「是否已是两条件版」用 `pg_get_constraintdef` 里有没有 `!~`（旧单条件版没有，
  --   且 LIKE 里不写 `[0-9]{7}` 一类字面 —— 方括号在 LIKE 里是字符类，会误判）；不是新版就先 DROP
  --   再按现定义重建（历史库若已 apply 过旧版单条件约束，本迁移负责升级）。
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.listing'::regclass
                    AND conname  = 'listing_item_code_format_ck'
                    AND pg_get_constraintdef(oid) LIKE '%!~%') THEN
    ALTER TABLE public.listing DROP CONSTRAINT IF EXISTS listing_item_code_format_ck;
    ALTER TABLE public.listing
      ADD CONSTRAINT listing_item_code_format_ck
      CHECK (item_code ~ '^[0-9A-Za-z]{7}$' AND item_code !~ '^[0-9]{7}$');
  END IF;

  -- ⑤ 触发器等位恢复（回填结束立刻开回；尾部自检 ⑧ 复核）
  ALTER TABLE public.listing ENABLE TRIGGER trg_listing_touch_time_updated;

  -- ============================ 尾部自检（apply 后即验） ============================
  -- ① 两列在场（列名 / 类型 / NOT NULL 逐列）
  SELECT count(*) INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing'
     AND column_name = 'snowflake_id' AND data_type = 'bigint' AND is_nullable = 'NO';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0060 self-check FAILED: snowflake_id expect bigint NOT NULL, got % matching columns', v_n;
  END IF;
  SELECT count(*) INTO v_n
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing'
     AND column_name = 'item_code' AND data_type = 'character' AND is_nullable = 'NO'
     AND character_maximum_length = 7;
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0060 self-check FAILED: item_code expect char(7) NOT NULL, got % matching columns', v_n;
  END IF;

  -- ② 两条唯一索引在场且**确为 UNIQUE**（同名同列空壳 ⇒ 这里红）
  SELECT count(*) INTO v_n
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'listing'
     AND indexname = 'listing_snowflake_id_uidx'
     AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%(snowflake_id)%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0060 self-check FAILED: listing_snowflake_id_uidx(UNIQUE snowflake_id) missing, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'listing'
     AND indexname = 'listing_item_code_uidx'
     AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%(item_code)%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0060 self-check FAILED: listing_item_code_uidx(UNIQUE item_code) missing, got %', v_n;
  END IF;

  -- ③ 格式正则**全行命中**（7 位、且只在字母表 57 字符内 —— 正则放行 62 字符，字母表更严）
  SELECT count(*) INTO v_n
    FROM public.listing
   WHERE item_code !~ '^[0-9A-Za-z]{7}$' OR char_length(item_code) <> 7;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: % rows violate item_code format ^[0-9A-Za-z]{7}$', v_n;
  END IF;
  SELECT count(*) INTO v_n
    FROM public.listing
   WHERE translate(item_code::text, c_alphabet, '') <> '';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: % rows carry item_code chars outside the 57-char alphabet', v_n;
  END IF;

  -- ④ 空值 0 行（两列）
  SELECT count(*) INTO v_n
    FROM public.listing WHERE snowflake_id IS NULL OR item_code IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: expect 0 rows with NULL snowflake_id/item_code, got %', v_n;
  END IF;

  -- ⑤ 行数不变（回填前基线 = 现在）+ 两列**各自**唯一（唯一索引之外的取值面自证）
  SELECT count(*) INTO v_rows_after FROM public.listing;
  IF v_rows_after <> v_rows_before THEN
    RAISE EXCEPTION '0060 self-check FAILED: row count changed % -> % (backfill must not add/remove rows)',
      v_rows_before, v_rows_after;
  END IF;
  SELECT count(DISTINCT snowflake_id) INTO v_after FROM public.listing;
  IF v_after <> v_rows_after THEN
    RAISE EXCEPTION '0060 self-check FAILED: snowflake_id not unique (% distinct of %)', v_after, v_rows_after;
  END IF;
  SELECT count(DISTINCT item_code) INTO v_after FROM public.listing;
  IF v_after <> v_rows_after THEN
    RAISE EXCEPTION '0060 self-check FAILED: item_code not unique (% distinct of %)', v_after, v_rows_after;
  END IF;

  -- ⑥ 雪花位宽自证：正数 + 落在 63 位内 + 与 time_created 同序（毫秒段 = 时间推导，不越界）
  SELECT count(*) INTO v_n
    FROM public.listing
   WHERE snowflake_id <= 0 OR snowflake_id >= (1::bigint << 62)
      OR (snowflake_id >> c_seq_bits) <> (floor(extract(epoch FROM time_created) * 1000)::bigint - c_epoch_ms);
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: % rows have out-of-layout snowflake_id (expect 41+10+12 positive)', v_n;
  END IF;

  -- ⑦ 反断言：**纯数字码 0 行**（数字 ref 恒按 listing_id 解释 ⇒ 纯数字 item_code 永不可达）
  SELECT count(*) INTO v_n FROM public.listing WHERE item_code ~ '^[0-9]{7}$';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: % rows carry all-digit item_code (unreachable via /api/prize/:ref)', v_n;
  END IF;

  -- ⑧ CHECK 约束在场且**真的是两条件**（形状 ∧ 纯数字禁令；不是同名空壳、也不是旧单条件版）
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.listing'::regclass AND conname = 'listing_item_code_format_ck';
  IF v_def IS NULL
     OR position('[0-9A-Za-z]{7}' IN v_def) = 0
     OR position('!~' IN v_def) = 0
     OR position('[0-9]{7}' IN v_def) = 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: listing_item_code_format_ck missing or not the (7-char shape ∧ non-all-digit) regex pair, def=%',
      COALESCE(v_def, '<none>');
  END IF;

  -- ⑨ 回填期间摘掉的触发器已恢复启用（tgenabled = 'O'），且 listing 上零禁用触发器
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'listing'
     AND t.tgname = 'trg_listing_touch_time_updated' AND NOT t.tgisinternal AND t.tgenabled = 'O';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0060 self-check FAILED: trg_listing_touch_time_updated not re-enabled, got %', v_n;
  END IF;
  SELECT count(*) INTO v_n
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'listing'
     AND NOT t.tgisinternal AND t.tgenabled <> 'O';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0060 self-check FAILED: % disabled triggers left on public.listing', v_n;
  END IF;
END $$;
