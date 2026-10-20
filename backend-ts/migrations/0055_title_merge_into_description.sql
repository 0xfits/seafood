-- ============================================================================
-- 0055_title_merge_into_description.sql
-- 取消商品标题字段（`listing.title` 退场）· **三阶段零破窗 · 阶段 1 = 合并回填**
-- ----------------------------------------------------------------------------
-- 口径（Kevin 2026-10-20 数据模型指令）：
--   标题不再单独存储，正文并入 `description`；**标题 = 描述首个 `\n` 之前**；
--   无回车 ⇒ 整段即标题；**存储层不截断**（显示层 48 显示宽单位 + `...` 由前端做）。
--
-- 三阶段（本文件只做阶段 1，**不 DROP 列**）：
--   ① 0055 apply（合并回填，`title` 列**暂留**）  ← 本文件
--   ② push 代码（读口派生 / 写口拒 `title`，与「列仍在」兼容）
--   ③ 0056 apply（`DROP COLUMN title`）
--
-- 合并规则（逐字照派单）：
--   · 描述为空（trim 后）        ⇒ description = title
--   · 标题为空（trim 后）        ⇒ description 原样（不动）
--   · 两者都有                   ⇒ description = title || E'\n' || description
--   · 两者都空                   ⇒ 不进 UPDATE（保持空，属「本来就没内容」的历史行）
--
-- ★★ **幂等守卫（可重放，不二次拼接）**：`WHERE … AND <描述尚未被合并过>` ⇒
--   已合并过的行在**第二次 apply / 人工重放 / 迁移链重跑**时被**原地跳过**（`UPDATE 0`），
--   不会把标题再叠一遍（否则成 `title\ntitle…`，属静默数据损坏）。
--   · 合并后「已合并」有**两种形态**，守卫必须两支都挡：
--     ① 原描述非空 ⇒ `title || E'\n' || 原描述`（以 `title || E'\n'` 开头）；
--     ② 原描述为空 ⇒ **恰 `title`**（无尾随换行）⇒ 由 `description <> title` 兜住。
--   · 前缀支**实现用 `strpos(...) <> 1` 而非 `NOT LIKE title || E'\n%'`**：用户标题里若含 `%` / `_`，
--     LIKE 会把它们当通配符 ⇒ 该行被**误跳过**（漏回填）⇒ 尾部自检 ③ 当场 `RAISE`。`strpos` 逐字
--     比较、无通配符语义，与「不以该前缀开头」严格等价（`= 1` 即「从此处开始」）。
--   · 守卫只挡「已合并」，不挡空标题行（那类行落 `CASE` 的 `description` 原样支、天然无变化）。
 --   · ★ 2026-10-20 生产实测加固：守卫收敛为**一条** `strpos(description, title) <> 1`
 --     （描述**不以** title 开头 ⇒ 才合并）。旧两支（`<> title` + `strpos(title||'\n') <> 1`）
 --     漏了「**无换行超串**」形态（描述 = title + 后续文字、中间无 `\n`，生产 listing 5 实测：
 --     「高速飞机一个月使用权高速飞机一个月使用权」）⇒ 旧守卫照并 ⇒ 成 `title\ntitle…`
 --     ⇒ 自检 ⑤ 当场 RAISE（正是自检承重的实证）。新守卫一条覆盖三形态：
 --     相等 / 无换行超串 / 已带 `title\n` 前缀，全都「已含标题 ⇒ 不再并」。
--
-- 文件内**不写 BEGIN/COMMIT**（`scripts/migrate.ts` 逐文件包事务：失败即整文件回滚、
--   不写版本行）；自检失败一律 `RAISE EXCEPTION` ⇒ 整迁移回滚。
-- 自检（见尾部 `DO $$`）：① 合并后空描述行数 = 0（"无标题也无描述"的历史行先计数并 RAISE 报数，
--   这部分**结构上无法合并**、单独报数不判负）；② 每一条有标题的行都**就地**并入成功
--   （描述以该 title 开头、且紧随其后的字符是换行或已到串尾）⇒ 无新增行 / 无丢行；
--   ③ 行数未变（PK 唯一性 + 行数现取）；④ `title` 列仍在（阶段 1 必须保留）；
--   ⑤ **重放免疫**：不存在「标题被叠加两次」的行；⑥ **重放后空描述行数不变**
--   （有标题的行 description 一律非空 ⇒ 空描述只可能是双空历史行）。
-- ============================================================================

UPDATE public.listing
   SET description = CASE
                       WHEN btrim(description) = '' THEN title
                       WHEN btrim(title) = ''       THEN description
                       ELSE title || E'\n' || description
                     END
 WHERE btrim(title) <> ''
   -- ★ 幂等守卫（2026-10-20 收敛为一条）：描述**不以** title 开头 ⇒ 才需要合并。
   --   一条覆盖三形态（都属「已含标题 ⇒ 不再并」）：① 相等；② 无换行超串（描述 = title + 后续
   --   文字，生产 listing 5 实测）；③ 已带 `title\n` 前缀（原描述非空、合并过）。
   --   「描述原本为空」的行合并后 = 恰 `title`（无尾随换行）⇒ 也被本条兜住（重放不再拼）。
   --   strpos 逐字比较、无 LIKE 通配符语义（用户标题含 % / _ 不会误跳过）。
   AND strpos(description, title) <> 1;

DO $$
DECLARE
  v_rows        bigint;
  v_rows_distinct bigint;
  v_titled      bigint;
  v_empty_desc  bigint;
  v_titled_empty_desc bigint;
  v_both_empty  bigint;
  v_merged_ok   bigint;
  v_double      bigint;
  v_title_cols  int;
BEGIN
  -- 合并后现取（UPDATE 不能增删行 ⇒ 下面用「行数 + PK 唯一性 + 逐行并入判据」三重自证）
  SELECT count(*) INTO v_rows           FROM public.listing;
  SELECT count(DISTINCT listing_id) INTO v_rows_distinct FROM public.listing;
  SELECT count(*) INTO v_titled         FROM public.listing WHERE btrim(title) <> '';
  SELECT count(*) INTO v_empty_desc     FROM public.listing WHERE btrim(description) = '';
  SELECT count(*) INTO v_both_empty
    FROM public.listing
   WHERE btrim(title) = '' AND btrim(description) = '';
  -- ★ ⑥ 重放臂：有标题却描述为空（= 该并的没并 / 或重放把内容丢了）⇒ 必须 0
  SELECT count(*) INTO v_titled_empty_desc
    FROM public.listing
   WHERE btrim(title) <> '' AND btrim(description) = '';
  -- ★ ⑤ 重放臂：标题被叠加两次（幂等守卫失效的指纹）⇒ 必须 0
  --   两种形态都算：`title\ntitle\n…`（原描述非空）与 `title\ntitle`（原描述为空、尾无换行）
  SELECT count(*) INTO v_double
    FROM public.listing
   WHERE btrim(title) <> ''
     AND strpos(description, title || E'\n' || title) = 1;
  SELECT count(*) INTO v_title_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'listing' AND column_name = 'title';

  -- 每一条有标题的行：描述必须**以该标题开头**（合并过的 = title + '\n' + 原描述；被守卫跳过的
  --   相等/超串行本就以 title 开头 ⇒ 两类并集 = 「以 title 开头」，2026-10-20 守卫收敛后同口径）
  SELECT count(*) INTO v_merged_ok
    FROM public.listing
   WHERE btrim(title) <> ''
     AND left(description, length(title)) = title;

  -- ① 「无标题也无描述」的历史行先报数（这部分无可合并内容，不等于合并失败）
  IF v_both_empty > 0 THEN
    RAISE WARNING '0055: % 行「无标题也无描述」（无可合并内容，description 保持为空）', v_both_empty;
  ELSE
    RAISE NOTICE '0055: 无「无标题也无描述」的行（both_empty=0）';
  END IF;

  -- ② 合并后空描述行数 = 本就可空的行数（both_empty）⇒ 有内容的一行都没被清空
  IF v_empty_desc <> v_both_empty THEN
    RAISE EXCEPTION '0055 self-check FAILED: 合并后空描述 % 行 ≠ 双空历史行 % 行', v_empty_desc, v_both_empty;
  END IF;

  -- ③ 有标题的行全部就地并入（无新增 / 无丢行）
  IF v_merged_ok <> v_titled THEN
    RAISE EXCEPTION '0055 self-check FAILED: 有标题 % 行，但并入判据只命中 % 行', v_titled, v_merged_ok;
  END IF;

  -- ④ 行数未变（PK 唯一 ⇒ 行数 == 主键行数；UPDATE 不增删行）
  IF v_rows <> v_rows_distinct THEN
    RAISE EXCEPTION '0055 self-check FAILED: 行数 % ≠ 主键唯一行数 %', v_rows, v_rows_distinct;
  END IF;

  -- ⑤ 重放免疫：没有任何行被叠加两次（幂等守卫生效的正面读数）
  IF v_double > 0 THEN
    RAISE EXCEPTION '0055 self-check FAILED: % 行的标题被叠加两次（幂等守卫失效 ⇒ 重放会二次拼接）', v_double;
  END IF;

  -- ⑥ 重放后空描述行数不变：有标题的行 description 一律非空
  IF v_titled_empty_desc > 0 THEN
    RAISE EXCEPTION '0055 self-check FAILED: % 行有标题但描述为空（并入口径失效）', v_titled_empty_desc;
  END IF;

  -- ⑦ 阶段 1 必须保留 title 列（DROP 归 0056）
  IF v_title_cols <> 1 THEN
    RAISE EXCEPTION '0055 self-check FAILED: title 列应仍在（阶段 1 保留），实测列数 = %', v_title_cols;
  END IF;

  RAISE NOTICE '0055 OK: rows=% titled=% merged_ok=% empty_desc=% both_empty=% titled_empty_desc=% double=% title_cols=%',
    v_rows, v_titled, v_merged_ok, v_empty_desc, v_both_empty, v_titled_empty_desc, v_double, v_title_cols;
END $$;
