-- ============================================================================
-- 0051_media_size_cap_1mb.sql · 媒体体积闸收口：size_bytes 上限 2MiB ⇒ 1MiB
-- ============================================================================
-- 契约真源（只读遵循，不在本文件重定义）：
--   · Kevin 2026-10-19 口径：「可以直接限制上传图片大小不要超出 1M」
--     ⇒ 单张媒体硬顶 = 1MiB = 1,048,576 bytes（客户端压缩降级 / 路由侧 400 闸 / DB CHECK 三层同口径）。
--   · route-layer.spec §48.2 / §48.4 #2（解码后体积闸 ⇒ 400 MEDIA_SIZE_EXCEEDED）
--   · data-layer.spec §40.1（size_bytes ∈ (0, cap] 双层闸：路由判 + DB CHECK 兜底）
--
-- 做什么（单点改约束，零动表结构）：
--   · DROP CONSTRAINT IF EXISTS public.media.media_size_bytes_check
--     （0050 的列内联 CHECK，PostgreSQL 自动命名 = `<表>_<列>_check` ⇒ media_size_bytes_check）
--   · ADD CONSTRAINT media_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 1048576)
--   · 末尾 DO 自检：约束定义含 1048576 / 旧上限 2097152 不在场 / 表内无 >1MiB 行；
--     任一不成立 ⇒ RAISE ⇒ 整迁移回滚、不写版本行。
--
-- 不做什么：
--   · **不改 0050 历史文件**（已 apply ⇒ checksum 冻结，改它 = scripts/migrate.ts 整链 ABORT）。
--     ⚠ 由此产生的已知留痕：0050 的自检块 ⑦ 断言「size_bytes CHECK 含 2097152」——
--     该断言只在 0050 自身 apply 的那一刻成立（新库按 0050 → 0051 顺序执行，先后无冲突）；
--     0050 不做二次 apply，故不构成回归。若将来重建 ledger 重放全链，须以 0051 为终态读数为准。
--   · 不写种子行 / 不建索引 / 不动 bytes、content_type、owner_uid、去重键 UNIQUE(sha256, size_bytes)。
--   · 不新增 ledger kind、不碰资金面、不借账本错误码（本文件零错误码字面）。
--
-- 幂等（可反复 apply / 重跑）：DROP … IF EXISTS + ADD ⇒ 每次落到同一终态，末尾自检读数不变。
-- 事务与登记：本文件**不写** BEGIN / COMMIT —— scripts/migrate.ts 逐文件包事务并在同事务内写
--   public.schema_migration 行（apply 由 Zang 执行，**先 apply 后 push** 铁律沿用）。
-- ============================================================================


-- ============================================================================
-- §① 体积闸收口：2MiB ⇒ 1MiB（1048576 bytes）
-- ============================================================================

ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_size_bytes_check;

ALTER TABLE public.media
  ADD CONSTRAINT media_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 1048576);


-- ============================================================================
-- §② apply-time 自检（纯读 · 不写业务数据 · 不借账本错误码）
--     ① 约束在场且定义含 1048576；② 旧上限 2097152 已不在场（防「DROP 未生效 / 名字不符」
--     导致双约束并存时旧闸仍然放行）；③ 表内不存在 >1MiB 的存量行（当前表 0 行也照写断言，
--     将来有存量则本迁移必须先清理 —— fail-loud，不静默留脏数据）。
-- ============================================================================

DO $$
DECLARE
  v_text  text;
  v_count int;
BEGIN
  -- ① 新约束在场且含 1048576
  SELECT pg_get_constraintdef(oid) INTO v_text
    FROM pg_constraint
   WHERE conrelid = 'public.media'::regclass AND contype = 'c' AND conname = 'media_size_bytes_check';
  IF v_text IS NULL THEN
    RAISE EXCEPTION '0051 self-check failed: media_size_bytes_check is missing';
  END IF;
  IF v_text NOT LIKE '%1048576%' THEN
    RAISE EXCEPTION '0051 self-check failed: size_bytes CHECK lacks 1048576 (%)', v_text;
  END IF;

  -- ② 旧上限 2097152 不得在任何 size_bytes CHECK 中残留
  SELECT count(*) INTO v_count
    FROM pg_constraint
   WHERE conrelid = 'public.media'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%size_bytes%'
     AND pg_get_constraintdef(oid) LIKE '%2097152%';
  IF v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION '0051 self-check failed: stale 2MiB size_bytes CHECK still present (% constraints)', v_count;
  END IF;

  -- ③ 表内无 >1MiB 存量行（断言恒写；0 行时同样成立）
  SELECT count(*) INTO v_count FROM public.media WHERE size_bytes > 1048576;
  IF v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION '0051 self-check failed: % existing media rows exceed 1MiB (1048576)', v_count;
  END IF;

  RAISE NOTICE '0051 self-check OK: media_size_bytes_check = (size_bytes > 0 AND size_bytes <= 1048576); stale 2MiB cap absent; oversized rows = 0';
END $$;
