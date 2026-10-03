-- ============================================================================
-- 0033_currency_platform_coin_flag.sql · P9④ 变体 Ⅱ：`currency.is_platform_coin` 标记列
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · docs/data-layer.spec.md **v0.25 §33.10** Zang 裁定（就地定案，2026-10-03，`R-9-39` / `R-9-42`）：
--     **`R-9-39`：豁免形态 = 变体 Ⅱ（新列 `currency.is_platform_coin boolean NOT NULL DEFAULT false`）**；
--     **手法** = `ALTER TABLE public.currency ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false;`
--     （**只加列 · 既有约束一字不动**—— 沿 `0001` 列风格 + §33.1(d)「绝不 `ALTER` 已有约束（`DL7`）」）。
--   · §33.1(c)：**豁免闸谓词落「唯一写路径的谓词」**（加在 `src/database.ts` 的上市审核闸 SQL：既有
--     `AND EXISTS (… result = 'approved')` 之外追加 `OR c.is_platform_coin = true`；保证金腿对平台行跳过）
--     ⇒ **改 `src` 非迁移**、**旧文一字不动**、**豁免 = 加谓词**（C-1 / `R-9-39`）。
--   · ★ **存量兼容**（`R-9-39` / C-1 判据）：既有**全部行 `is_platform_coin = false`**（`ADD COLUMN … DEFAULT false`）
--     ⇒ **非平台行仍必须走保证金 + 审核闸**；「非平台身份创建的行 ⇒ 仍必须走保证金 + 审核闸」。
--   · ★ Ⅰ（按 `owner_uid = 0` 判豁免）/ Ⅲ（白名单表）= **判负对照**（若实现按 `owner_uid` 判豁免 ⇒ 门必红；
--     白名单表 = 第二真源 ⇒ 违 `R-9-2` / `DL1`）—— 落门 `p8-s9` 判负面，不在本迁移。
--
-- 本迁移**不做什么**：不 `ALTER` 任何既有约束（`currency_status_enum` / `currency_symbol_uniq` 等七约束
--   指纹一字不动 · `DL7`）；不改任何业务数据；不新增 / 不删除错误码；不建表；不改 `0001`–`0032` 任何文件。
--
-- 幂等：只被 `migrate.ts` 执行一次（版本表 + checksum 去重）；`ADD COLUMN IF NOT EXISTS` 天然幂等。
-- ============================================================================

-- ------------------------------------------------------------------ 手法（唯一 DDL：只加列）
ALTER TABLE public.currency
  ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.currency.is_platform_coin IS
  'P9④（Kong；依据 data-layer.spec v0.25 §33.1(c)/§33.10 R-9-39 · 变体 Ⅱ）：平台币标记（BTTC 为 true）。豁免保证金 + 审核闸**只对 true 行生效**且豁免谓词落在唯一写路径（src/database.ts 上市闸 SQL）；历史行默认 false ⇒ 非平台行仍必须走保证金 + 审核闸（C-1 判据）。';

-- ---------------------------------------------------------------- 收尾自检（列在场 + 类型 + NOT NULL + DEFAULT false + 既有约束指纹未变 + 存量兼容）
DO $$
DECLARE
  v_type    text;
  v_nullable text;
  v_def     text;
  v_udt     text;
  v_n       int;
  v_true    bigint;
BEGIN
  -- ① 列在场 + 类型 boolean + NOT NULL + DEFAULT false（结构面，沿 `0025:197-202` 结构指纹断言手法）
  SELECT data_type, is_nullable, column_default, udt_name
    INTO v_type, v_nullable, v_def, v_udt
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'currency' AND column_name = 'is_platform_coin';
  IF v_type IS NULL THEN
    RAISE EXCEPTION '0033 self-check FAILED: public.currency.is_platform_coin missing';
  END IF;
  IF v_type <> 'boolean' THEN
    RAISE EXCEPTION '0033 self-check FAILED: is_platform_coin type = % (expect boolean)', v_type;
  END IF;
  IF v_nullable <> 'NO' THEN
    RAISE EXCEPTION '0033 self-check FAILED: is_platform_coin is NULLABLE (expect NOT NULL)';
  END IF;
  IF v_def IS NULL OR strpos(v_def, 'false') = 0 THEN
    RAISE EXCEPTION '0033 self-check FAILED: is_platform_coin default = % (expect false)', COALESCE(v_def, '<null>');
  END IF;

  -- ② 既有七约束指纹未变：1 UNIQUE + 6 CHECK（`0001:28-37`），且**未 `ALTER` 任何既有约束**
  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'public.currency'::regclass AND contype = 'c';
  IF v_n <> 6 THEN
    RAISE EXCEPTION '0033 self-check FAILED: currency CHECK count = % (expect 6 unchanged)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'public.currency'::regclass AND contype = 'u' AND conname = 'currency_symbol_uniq';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0033 self-check FAILED: currency_symbol_uniq missing/changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.currency'::regclass AND conname = 'currency_status_enum'
                    AND contype = 'c' AND strpos(pg_get_constraintdef(oid), '''delisted''') > 0) THEN
    RAISE EXCEPTION '0033 self-check FAILED: currency_status_enum fingerprint changed';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = 'public.currency'::regclass AND conname = 'currency_listed_at') IS NULL THEN
    RAISE EXCEPTION '0033 self-check FAILED: currency_listed_at CHECK missing';
  END IF;

  -- ③ ★ 存量兼容断言：既有**全部行 `is_platform_coin = false`**（非平台行仍必须走保证金 + 审核闸）
  SELECT count(*) INTO v_true FROM public.currency WHERE is_platform_coin;
  IF v_true <> 0 THEN
    RAISE EXCEPTION '0033 self-check FAILED: % pre-existing currency row(s) already flagged is_platform_coin = true (存量兼容 violated)', v_true;
  END IF;

  RAISE NOTICE '0033 self-check OK: currency.is_platform_coin boolean NOT NULL DEFAULT false 在场；既有 7 约束指纹未变（1 UNIQUE + 6 CHECK）；存量 0 行被误标 true';
END $$;
