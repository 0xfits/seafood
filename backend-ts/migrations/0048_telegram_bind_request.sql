-- ============================================================================
-- 0048_telegram_bind_request.sql · tg-bind-v2（反向短码绑定）· public.telegram_bind_request 全量 DDL
--   1 表 + 1 PK + 1 UNIQUE + 1 限速索引（(tg_user_id, iat)）
-- ============================================================================
-- 内容契约（冻结于派单 tg-bind-v2 · 行文风格沿 0046_telegram_binding.sql / 0047_listing_favorite.sql）：
--   · req_id  bigserial PRIMARY KEY —— 「大 serial」主键。
--   · code    varchar(12) NOT NULL UNIQUE —— 8 位短码（大写字母 + 数字、剔除易混 0/O/1/I）；
--     UNIQUE = 撞码重试承重墙（服务层重试上限 5 次）；列宽 12 留余量，服务层签发恒 8 位。
--   · tg_user_id bigint NOT NULL —— 发码者 Telegram 数字 ID（隐私红线 A5-DL-P1 同 0046：
--     不存 username / first_name 等任何公开标识；本表回读仅服务层内部使用，读口绝不外泄数值）。
--   · iat  timestamptz NOT NULL DEFAULT now() —— 签发时刻。
--   · exp  timestamptz NOT NULL —— 语义 = iat + 600 秒（10 分钟，与 HMAC 长码同有效期）；
--     服务层 INSERT 以 now() + interval '600 seconds' 落值（与 iat 默认 now() 同语句同钟）。
--   · consumed_at timestamptz 可空 —— 站内 confirm 成功时刻（NULL = 未消费；一次性消费闸）。
--   · 索引 (tg_user_id, iat) —— webhook 防刷限速读路径（同号冷却 60 秒 / 每小时 5 次，占位数值）。
--   · 无 FK users：tg_user_id 是 Telegram 侧 ID 而非站内 uid（发码者未必有站内账号，bot 机器面）。
--   · 无资金动作：不写 ledger、不借账本错误码、不新增 kind。
--   · 一次性消费 = confirm 成功置 consumed_at = now()；过期行由 webhook 签发事务顺手 DELETE
--     （exp 早于 now() 减 1 天）回收，本迁移不建清理任务、不加触发器。
--   · 既有「站点出 HMAC 长码 v1 → bot 发 /start <长码>」路径不落任何表（A5-DL-P4 不变），
--     本表只承载新增的反向短码路径，与长码路径互不影响。
--
-- 硬禁（同 0046/0047）：不改任何既有对象 / 不 CREATE OR REPLACE 既有函数体 / 不写业务数据；
--   0001–0047 一字不动（checksum 冻结，migrate.ts 整链 ABORT 红线沿用）。
-- 幂等（DL48 体例）：CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
--   末尾 apply-time DO 自检（纯目录只读）；任一失败 ⇒ 整迁移回滚、不写版本行。
-- ============================================================================


-- ============================================================================
-- §① 表 public.telegram_bind_request
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.telegram_bind_request (
  req_id      bigserial,
  code        varchar(12) NOT NULL,
  tg_user_id  bigint      NOT NULL,
  iat         timestamptz NOT NULL DEFAULT now(),
  exp         timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT telegram_bind_request_pk        PRIMARY KEY (req_id),
  CONSTRAINT telegram_bind_request_code_uniq UNIQUE (code)
);

COMMENT ON TABLE public.telegram_bind_request IS
  'tg-bind-v2 反向短码绑定请求：bot 无载荷 /start 签发 8 位短码，站内 confirm 消费；exp = iat + 600 秒；一次性消费 = consumed_at；无资金动作。';

-- webhook 防刷限速读路径：同 tg_user_id 冷却 / 每小时配额均按 (tg_user_id, iat) 计数。
CREATE INDEX IF NOT EXISTS idx_telegram_bind_request_tg_iat
  ON public.telegram_bind_request (tg_user_id, iat);


-- ============================================================================
-- §② apply-time 自检（纯目录只读 · 不 INSERT / 不 UPDATE / 不借账本错误码）
--     逐项断言「DDL 全在场」；任一缺席 ⇒ RAISE ⇒ 整迁移回滚、不写版本行。
-- ============================================================================

DO $$
DECLARE
  missing  text;
BEGIN
  -- ②-a 表在场
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'telegram_bind_request'
      AND table_type = 'BASE TABLE'
  ) THEN
    RAISE EXCEPTION 'apply self-check failed: missing table telegram_bind_request';
  END IF;

  -- ②-b 6 列逐名在场
  SELECT string_agg(v.col, ',') INTO missing FROM (
    VALUES ('req_id'), ('code'), ('tg_user_id'), ('iat'), ('exp'), ('consumed_at')
  ) AS v(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'telegram_bind_request'
      AND column_name = v.col
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'apply self-check failed: missing column(s): %', missing;
  END IF;

  -- ②-c 1 PK + 1 UNIQUE 逐名在场
  SELECT string_agg(v.conname, ',') INTO missing FROM (
    VALUES ('telegram_bind_request_pk'), ('telegram_bind_request_code_uniq')
  ) AS v(conname)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public' AND con.conname = v.conname
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'apply self-check failed: missing constraint(s): %', missing;
  END IF;

  -- ②-d 限速索引在场
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_telegram_bind_request_tg_iat'
  ) THEN
    RAISE EXCEPTION 'apply self-check failed: index idx_telegram_bind_request_tg_iat missing';
  END IF;

  RAISE NOTICE '0048 self-check OK: telegram_bind_request cols=6 / 1 pk + 1 uniq / 1 index';
END $$;
