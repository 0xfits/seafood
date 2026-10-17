-- ============================================================================
-- 0049_seed_bttc_currency.sql · P9④ BTTC（`battcoin`）铸造 / 分解的「载体行」seed
-- ============================================================================
-- 为何需要（缺陷链三行 —— 本文件就是它的终结点）：
--   ① 读口 `DatabaseService.getBttcState`（backend-ts/src/database.ts）只按
--      `symbol = 'BTTC'` 查 `public.currency`；**查无行 ⇒ `status = null`**。
--   ② 路由面把 `status === null` 透出为 `bttcAvailable = false` ⇒ 前端 `bttcPanel`
--      只渲染「代币服务暂不可用」，**铸造 / 分解按钮整块不渲染**。
--   ③ 唯一会创建该行的代码 `DatabaseService.ensureBttcCurrency`（幂等
--      `INSERT … WHERE NOT EXISTS`）**在生产代码里零调用点**（只有门脚本
--      `backend-ts/scripts/p8-s9-bttc-gate.ts` 调过它）⇒「系统引导创建」无触发点
--      = **死链**（自上线起对所有人不可用）。
--   ⇒ 修法（Kevin 裁定 **方案 A = 迁移 seed**）：由迁移把这**一行**确定性建出来。
--      读口 / 写口 / 前端契约**一字不动**（不给 `ensure` 补调用点、不改读口兜底、
--      不做手工脚本 —— 手工脚本不可重放、dev 与生产会各说各话）。
--
-- 幂等（可反复 apply / 重跑；行已存在 ⇒ 插入 0 行且**不改既有行**）：
--   `INSERT … SELECT … WHERE NOT EXISTS (… symbol = 'BTTC')` + `ON CONFLICT (symbol) DO NOTHING`
--   —— 与 `ensureBttcCurrency` 的 INSERT 形态**逐字对齐**（双重幂等：谓词闸 + 唯一约束兜底）。
--   本文件**零 UPDATE / 零 DELETE / 零 TRUNCATE**。
--
-- 列值口径（唯一真源 = `database.ts` 的 `ensureBttcCurrency` INSERT 列清单与值，逐字一致）：
--   `symbol='BTTC'` · `name='battcoin'` · `owner_uid=0` · `decimals=0` · `status='listed'` ·
--   `listed_at=now()` · `deposit_amount=0` · `deposit_cid=1` · `supply_cap=NULL` ·
--   `is_platform_coin=true`（`0033`）。
--   `total_supply` / `icon_url` / `time_created` / `time_updated` **不写**，走列默认
--   （`total_supply` 默认 `0` ⇒ `currency_supply_guard` 满足；**不显式写非零供应量**）。
--
-- 约束满足（`0001 §2 currency` 7 条 + `0033` 标记列；逐条对照）：
--   · `currency_symbol_uniq`   UNIQUE(symbol)                    ⇒ 单行 + 谓词闸 + ON CONFLICT
--   · `currency_symbol_fmt`    symbol ~ '^[^[:space:]]{1,16}$'   ⇒ 'BTTC'（4 字符、无空白）
--   · `currency_decimals_rng`  decimals BETWEEN 0 AND 18         ⇒ 0
--   · `currency_supply_guard`  total_supply >= 0 AND（supply_cap IS NULL OR …）⇒ 0 / NULL
--   · `currency_status_enum`   status IN (draft,listed,frozen,delisted) ⇒ 'listed'
--   · `currency_deposit_guard` deposit_amount >= 0               ⇒ 0
--   · `currency_listed_at`     status='draft' OR listed_at IS NOT NULL
--                              ⇒ status='listed' **必须**给 listed_at，本文件给 `now()`
--
-- 本迁移**不做什么**：不改任何既有对象 / 不建表·列·约束·索引·触发器 / 不写 `app_config` /
--   不碰 ledger 与 batt 面 / 不新增 kind 或错误码；`0001`–`0048` 一字不动（checksum 冻结，
--   `scripts/migrate.ts` 整链 ABORT 红线沿用）。
--
-- 事务与登记：本文件**不写** `BEGIN` / `COMMIT` —— `scripts/migrate.ts` 逐文件包事务并在
--   同事务内写 `public.schema_migration` 行。末尾 `DO` 自检失败 ⇒ 抛异常 ⇒ 整文件回滚、
--   **不写版本行**（apply 后库面 = 48 行 / `0049`）。
-- ============================================================================


-- ============================================================================
-- §① BTTC 载体行（形态与 `ensureBttcCurrency` 的 INSERT 逐字一致）
-- ============================================================================

INSERT INTO public.currency
  (symbol, name, owner_uid, decimals, status, listed_at, deposit_amount, deposit_cid, supply_cap, is_platform_coin)
SELECT 'BTTC'::text, 'battcoin'::text, 0::bigint, 0::smallint, 'listed', now(),
       0::bigint, 1::bigint, NULL::bigint, true
 WHERE NOT EXISTS (SELECT 1 FROM public.currency AS c WHERE c.symbol = 'BTTC')
ON CONFLICT (symbol) DO NOTHING;


-- ============================================================================
-- §② apply-time 自检（纯读 · 不写业务数据 · 不借账本错误码）
--     断言「载体行恰好 1 行且列值 = seed 口径」；任一不成立 ⇒ RAISE ⇒ 整迁移回滚。
--     重跑免疫：行已存在时上一条 INSERT 零副作用，本块读数不变。
--     `total_supply` 只断言 `>= 0`（行可能已带真实铸造量 —— 本文件不改它）。
-- ============================================================================

DO $$
DECLARE
  v_rows      int;
  v_symbol    text;
  v_name      text;
  v_owner     bigint;
  v_decimals  smallint;
  v_status    text;
  v_listed_at timestamptz;
  v_dep_amt   bigint;
  v_dep_cid   bigint;
  v_supply    bigint;
  v_cap       bigint;
  v_platform  boolean;
BEGIN
  -- ②-a 恰好 1 行 `symbol = 'BTTC'`（0 行 = seed 未落地；>1 行 = 违反 currency_symbol_uniq）
  SELECT count(*)::int INTO v_rows FROM public.currency WHERE symbol = 'BTTC';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION '0049 self-check failed: currency rows with symbol=BTTC = % (expect exactly 1)', v_rows;
  END IF;

  -- ②-b 列值逐项回读
  SELECT c.symbol, c.name, c.owner_uid, c.decimals, c.status, c.listed_at,
         c.deposit_amount, c.deposit_cid, c.total_supply, c.supply_cap, c.is_platform_coin
    INTO v_symbol, v_name, v_owner, v_decimals, v_status, v_listed_at,
         v_dep_amt, v_dep_cid, v_supply, v_cap, v_platform
    FROM public.currency AS c
   WHERE c.symbol = 'BTTC';

  IF v_symbol IS DISTINCT FROM 'BTTC' THEN
    RAISE EXCEPTION '0049 self-check failed: symbol = % (expect BTTC)', v_symbol;
  END IF;
  IF v_name IS DISTINCT FROM 'battcoin' THEN
    RAISE EXCEPTION '0049 self-check failed: name = % (expect battcoin)', v_name;
  END IF;
  IF v_owner IS DISTINCT FROM 0::bigint THEN
    RAISE EXCEPTION '0049 self-check failed: owner_uid = % (expect 0)', v_owner;
  END IF;
  IF v_decimals IS DISTINCT FROM 0::smallint THEN
    RAISE EXCEPTION '0049 self-check failed: decimals = % (expect 0)', v_decimals;
  END IF;
  IF v_status IS DISTINCT FROM 'listed' THEN
    RAISE EXCEPTION '0049 self-check failed: status = % (expect listed)', v_status;
  END IF;
  IF v_listed_at IS NULL THEN
    RAISE EXCEPTION '0049 self-check failed: listed_at IS NULL (currency_listed_at requires it for status=listed)';
  END IF;
  IF v_dep_amt IS DISTINCT FROM 0::bigint THEN
    RAISE EXCEPTION '0049 self-check failed: deposit_amount = % (expect 0)', v_dep_amt;
  END IF;
  IF v_dep_cid IS DISTINCT FROM 1::bigint THEN
    RAISE EXCEPTION '0049 self-check failed: deposit_cid = % (expect 1)', v_dep_cid;
  END IF;
  IF v_cap IS NOT NULL THEN
    RAISE EXCEPTION '0049 self-check failed: supply_cap = % (expect NULL)', v_cap;
  END IF;
  IF v_supply IS NULL OR v_supply < 0 THEN
    RAISE EXCEPTION '0049 self-check failed: total_supply = % (expect >= 0)', v_supply;
  END IF;
  IF v_platform IS DISTINCT FROM true THEN
    RAISE EXCEPTION '0049 self-check failed: is_platform_coin = % (expect true · 0033 平台豁免标记)', v_platform;
  END IF;

  RAISE NOTICE '0049 self-check OK: currency BTTC row present (symbol=BTTC/name=battcoin/status=listed/decimals=0/listed_at set/is_platform_coin=true/supply_cap=NULL/total_supply=%)', v_supply;
END $$;
