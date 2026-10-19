-- 0052 · 2026-10-19 商品卡改版（Kevin 第 4 条）：卖家头像列
-- 读口面：feed 行 `seller.avatar` 与详情 `getPrizeSellerView().seller.avatar` 改读 `users.avatar_url`
-- （null ⇒ 前端灰底占位头像，现状不变）。本单**不做**头像上传 / 写入口（另立单登记）；
-- 零写既有数据（新列可空、存量行全 NULL）。文件内不写 BEGIN/COMMIT（migrate.ts 逐文件包事务）。
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

DO $$
BEGIN
  -- 自检①：列在场
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url'
  ) THEN
    RAISE EXCEPTION '0052 self-check failed: public.users.avatar_url missing';
  END IF;
  -- 自检②：类型 text
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url') <> 'text' THEN
    RAISE EXCEPTION '0052 self-check failed: public.users.avatar_url type is not text';
  END IF;
  -- 自检③：可空（本单不回填、不设默认）
  IF (SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url') <> 'YES' THEN
    RAISE EXCEPTION '0052 self-check failed: public.users.avatar_url is not nullable';
  END IF;
END
$$;
