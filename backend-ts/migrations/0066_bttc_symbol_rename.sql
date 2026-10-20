-- ============================================================================
-- 0066_bttc_symbol_rename.sql · 平台币口径订正：**BTTC 是货币名称，₿ 是货币符号**
-- ============================================================================
-- 依据（Kevin 2026-10-20 口径）：**「BTTC」= 货币名称**、**「₿」= 货币符号**；
--   顶部菜单 / 余额行必须显示**符号**。`currency` 里平台币那一行的现状是
--   `symbol = 'BTTC'` · `name = 'battcoin'`（dev cid 399 / 生产 cid 4）⇒ 余额菜单会
--   渲染成 `BTTC12,345`（符号位放着名字）。本文件把这一行**原位改写**为
--   `symbol = '₿'` · `name = 'BTTC'`，`cid` 不变 ⇒ `account` / `ledger_entry` /
--   `currency_status_log` 等按 `cid` 引用的既有数据**全部原地有效**。
--
-- 只改一列一位：`symbol` / `name` 两列；**cid 不参与 SET**（结构上不可能变）。
--   本文件零 INSERT / 零 DELETE / 零 TRUNCATE / 零 DDL、零新错误码、零新 kind、
--   不碰 `app_config`、不碰 ledger 与 batt 面；`0001`–`0065` 一字不动
--   （checksum 冻结 ⇒ `scripts/migrate.ts` 整链 ABORT 红线沿用）。
--
-- 定位口径 = **`is_platform_coin = true`**（`0033` 的平台标记列），**不按 `symbol`
--   字面**：cid 两库不同（dev 399 / 生产 4），symbol 正是本文件要改的值 ⇒ 用
--   `AND symbol = 'BTTC'` 作「已改名 ⇒ 零命中」的幂等闸，绝不能反过来拿它当主判据。
--
-- 幂等（重放 no-op）：重放时平台行的 `symbol` 已是 `'₿'` ⇒ `WHERE` 零命中 ⇒ 0 行更新、
--   零副作用；尾部自检断言的是**终态**（不用「更新了几行」当判据）。
--
-- 唯一约束面（先探查、已确认）：`currency_symbol_uniq UNIQUE(symbol)` 在场 ⇒ 目标
--   符号 `'₿'` 不得被**非平台行**占用（dev 现取 `currency` 无 `'₿'` 行；§① 前置断言它确实
--   空闲，占用即 RAISE 回滚，绝不静默覆盖别人的行；平台行自身在重放态**就是** `'₿'` ⇒
--   判据显式排除它，否则重放会被自己的前置断言打死）。`name` **无唯一约束**（dev 现取已有
--   重名行 `D unit` / `P4B3A test unit` / `num1 default`）⇒ `'BTTC'` 作名称无冲突风险。
--   符号格式 CHECK `currency_symbol_fmt` = `symbol ~ '^[^[:space:]]{1,16}$'` ⇒ `'₿'`
--   （U+20BF，单码点、无空白）满足。
--
-- 事务与登记：本文件**不写** `BEGIN` / `COMMIT` —— `scripts/migrate.ts` 逐文件包事务并
--   在同事务内写 `public.schema_migration` 行。§① §② 合并为**一个** `DO` 块：改前的
--   `cid` 必须在同一块内取到才能自证「cid 不变」（跨语句快照要借临时表 / 会话 GUC，
--   在 HTTP 驱动与 SQL Editor 粘贴两条路径上都不可靠）⇒ 改名本体逐字如下、只是缩进进块内：
--       UPDATE public.currency SET symbol = '₿', name = 'BTTC'
--        WHERE is_platform_coin = true AND symbol = 'BTTC';
--   自检失败 ⇒ 抛异常 ⇒ 整文件回滚、**不写版本行**。
-- ============================================================================

-- ============================================================================
-- §① 平台币行改名 + apply-time 自检（纯读断言 + 一行 UPDATE）
--     断言群（任一不成立 ⇒ RAISE ⇒ 整迁移回滚）：
--       ① 平台币行恰 1 行（`is_platform_coin = true`；0 行 = 载体行缺失、>1 行 = 数据漂移）
--       ② 终态逐字 `symbol = '₿'` ∧ `name = 'BTTC'` ∧ `is_platform_coin = true`
--       ③ `cid` 不变（改前 = 改后，同一物理行）
--       ④ 全表无残留 `symbol = 'BTTC'` 行（改名彻底；重放时也是 0）
--       ⑤ 全表 `symbol` 无重复（`currency_symbol_uniq` 的语义自证，重放免疫）
--     重跑免疫：重放时 UPDATE 0 行，② ③ ④ ⑤ 读到的都是同一个终态。
-- ============================================================================

DO $$
DECLARE
  v_platform_rows int;
  v_symbol_taken  int;
  v_cid_before    bigint;
  v_cid_after     bigint;
  v_symbol        text;
  v_name          text;
  v_platform      boolean;
  v_updated       int;
  v_stale         int;
  v_dup_symbols   int;
BEGIN
  -- ①-a 平台标记面必须恰 1 行（本文件只改这一行；多于 1 行 ⇒ 先裁数据、不猜）
  SELECT count(*)::int INTO v_platform_rows FROM public.currency WHERE is_platform_coin = true;
  IF v_platform_rows <> 1 THEN
    RAISE EXCEPTION '0066 self-check FAILED: currency rows with is_platform_coin = true = % (expect exactly 1)', v_platform_rows;
  END IF;

  -- ①-b 目标符号不得被**别的行**占用（`currency_symbol_uniq` 前置判据；占用 ⇒ 不覆盖别人的行）。
  --     ★ 判据必须排除平台行自身：重放时 `'₿'` **就是**平台行现在用的符号 ⇒ 若写成
  --     「全表无 '₿' 行」则重放必 RAISE（首版即踩此坑：整文件重放报
  --     `symbol ₿ already taken by 1 row(s)` ⇒ 幂等性被自己的前置断言破坏）。
  SELECT count(*)::int INTO v_symbol_taken
    FROM public.currency
   WHERE symbol = '₿' AND is_platform_coin = false;
  IF v_symbol_taken <> 0 THEN
    RAISE EXCEPTION '0066 self-check FAILED: symbol % already taken by % non-platform row(s) (currency_symbol_uniq would reject / must not clobber)', '₿', v_symbol_taken;
  END IF;

  -- ①-c 改前 cid（用于 ③ 的「cid 不变」自证）
  SELECT c.cid INTO v_cid_before FROM public.currency AS c WHERE c.is_platform_coin = true;

  -- ② 改名本体（幂等：已改名 ⇒ WHERE 零命中 ⇒ 0 行）
  UPDATE public.currency
     SET symbol = '₿',
         name   = 'BTTC'
   WHERE is_platform_coin = true
     AND symbol = 'BTTC';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- ② 终态回读（逐字）
  SELECT c.cid, c.symbol, c.name, c.is_platform_coin
    INTO v_cid_after, v_symbol, v_name, v_platform
    FROM public.currency AS c
   WHERE c.is_platform_coin = true;

  IF v_symbol IS DISTINCT FROM '₿' THEN
    RAISE EXCEPTION '0066 self-check FAILED: platform coin symbol = % (expect ₿)', coalesce(v_symbol, '<null>');
  END IF;
  IF v_name IS DISTINCT FROM 'BTTC' THEN
    RAISE EXCEPTION '0066 self-check FAILED: platform coin name = % (expect BTTC)', coalesce(v_name, '<null>');
  END IF;
  IF v_platform IS DISTINCT FROM true THEN
    RAISE EXCEPTION '0066 self-check FAILED: is_platform_coin = % (expect true)', v_platform;
  END IF;

  -- ③ cid 不变（同一物理行；`cid` 未进 SET 列表，此处为活体自证）
  IF v_cid_after IS DISTINCT FROM v_cid_before THEN
    RAISE EXCEPTION '0066 self-check FAILED: platform coin cid changed % -> % (accounts/ledger refs must stay valid)', v_cid_before, v_cid_after;
  END IF;

  -- ④ 无残留 `symbol = 'BTTC'`（改名彻底；重放态同样必须 0）
  SELECT count(*)::int INTO v_stale FROM public.currency WHERE symbol = 'BTTC';
  IF v_stale <> 0 THEN
    RAISE EXCEPTION '0066 self-check FAILED: % row(s) still have symbol = BTTC', v_stale;
  END IF;

  -- ⑤ 无重复 symbol（唯一约束的语义自证）
  SELECT count(*)::int INTO v_dup_symbols
    FROM (SELECT c.symbol FROM public.currency AS c GROUP BY c.symbol HAVING count(*) > 1) AS d;
  IF v_dup_symbols <> 0 THEN
    RAISE EXCEPTION '0066 self-check FAILED: % duplicated symbol value(s) in currency', v_dup_symbols;
  END IF;

  RAISE NOTICE '0066 self-check OK: platform coin cid=% updated_rows=% symbol=% name=% (is_platform_coin=true · symbol_uniq clean)', v_cid_after, v_updated, v_symbol, v_name;
END $$;
