-- ============================================================================
-- 0046_telegram_binding.sql · A5 收口（Telegram bot 绑定）· data-layer.spec v0.32 §38.4
--   users +2 列（tg_user_id / tg_linked_at）+ 1 部分唯一索引
-- ============================================================================
-- 内容契约（冻结于 docs/data-layer.spec.md v0.32 §38.4 / §38.8 · apply 顺序 = 0045 → 0046）：
--   · tg_user_id   bigint       —— 隐私红线 A5-DL-P1：只存 Telegram **数字 ID**；
--     任何 Telegram 公开标识列（tg_username / tg_handle / first_name / last_name /
--     language_code / chat_id 等）一律禁止 —— webhook 载体里的这些字段只在内存中
--     用于 bot 回复文案，绝不落库。多任何列 ⇒ 判负（A5-DL-P1）。
--   · tg_linked_at timestamptz  —— 绑定时刻（rebind 刷新）。
--   · idx_users_tg_user_id 部分唯一索引（WHERE tg_user_id IS NOT NULL）
--     —— 1 个 Telegram 账号 ↔ 1 个站内账号（A5-DL-P2）；第二账号抢绑 = 路由面
--     409 TG_TARGET_ACCOUNT_TAKEN，DB 兜底 = 唯一索引冲突。
--   · 解绑 = UPDATE users SET tg_user_id = NULL, tg_linked_at = NULL（A5-DL-P3：
--     users 本就可变面，无新闸；解绑后 tg_user_id IS NULL ⇒ 推送读侧自然排除）。
--   · 一次性 code 不落任何表、不落 app_config 键（A5-DL-P4：签名令牌 / 内存承载，
--     route 册 §41.2 #7）⇒ 本迁移无任何 code 存储对象。
--   · users 既有 6 列一字不动（纯加法；既有读口显式列名 ⇒ 无 SELECT * 连带）。
--
-- 硬禁（同 0045）：不改任何既有对象 / 不动既有函数体 / 不写业务数据 / 不借账本错误码；
--   0001–0044 一字不动（checksum 冻结）。幂等：ADD COLUMN IF NOT EXISTS +
--   CREATE UNIQUE INDEX IF NOT EXISTS + 末尾 apply-time DO 自检（纯目录只读）。
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tg_user_id   bigint;     -- 隐私红线：仅数字 ID（Z4）
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tg_linked_at timestamptz; -- 绑定时刻（rebind 刷新）

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tg_user_id
  ON public.users (tg_user_id) WHERE tg_user_id IS NOT NULL;

-- ============================================================================
-- apply-time 自检（纯目录只读）：
--   ① 两新列在场且类型正确；② 部分唯一索引在场；③ 隐私红线反向断言 ——
--   users 上不得出现任何 Telegram 公开标识列（出现即 RAISE ⇒ 判负 A5-DL-P1）。
-- ============================================================================

DO $$
DECLARE
  col_count int;
  bad_cols  text;
BEGIN
  SELECT count(*)::int INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
    AND (
      (column_name = 'tg_user_id'   AND data_type = 'bigint' AND is_nullable = 'YES')
      OR
      (column_name = 'tg_linked_at' AND data_type = 'timestamp with time zone' AND is_nullable = 'YES')
    );
  IF col_count <> 2 THEN
    RAISE EXCEPTION 'apply self-check failed: users telegram columns missing or mistyped (found %/2)', col_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_users_tg_user_id'
  ) THEN
    RAISE EXCEPTION 'apply self-check failed: index idx_users_tg_user_id missing';
  END IF;

  -- 隐私红线（A5-DL-P1）：公开标识列白名单外出现 tg_* 列即失败
  --（允许集 = tg_user_id / tg_linked_at 闭集，多任何列 ⇒ 判负）。
  SELECT string_agg(column_name, ',') INTO bad_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
    AND column_name LIKE 'tg\_%'
    AND column_name NOT IN ('tg_user_id', 'tg_linked_at');
  IF bad_cols IS NOT NULL THEN
    RAISE EXCEPTION 'privacy red line violated (A5-DL-P1): forbidden telegram column(s) on users: %', bad_cols;
  END IF;
END $$;
