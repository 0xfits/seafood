-- ============================================================================
-- 0069_project_avatar.sql
-- 项目头像（project.avatar_url）—— 首页热门任务卡的项目圆形头像来源
-- ----------------------------------------------------------------------------
-- 契约真源（Kevin 2026-10-21 派单 · 后端小步单）：
--   ① `project.avatar_url text NULL` —— 加性列，存量行全 NULL（无回填压力）；
--   ② 值域 = 平台自有媒体读口地址：`^/api/media/[0-9]{1,12}$`（media_id 为 bigserial，
--      12 位留足余量）—— **只收站内相对路径**，不接受外链 / data: / javascript: 等形状；
--   ③ 具名约束 `project_avatar_url_format_check`：NULL（未设头像）∨ 上述正则；
--   ④ PATCH /api/project/:projectId 闭集新增 `avatar_url`（null 可清空），
--      路由准入（`manage_tasks` 管理员）**一字不动**；
--   ⑤ 公开读口 `GET /api/home/campaign-tasks` 每行加性 `project_avatar_url`。
--
-- 文件形状纪律（与 0057–0068 同族）：
--   · 文件内不写 BEGIN / COMMIT（scripts/migrate.ts 逐文件包事务）；
--   · 注释里不出现成对美元定界符字面（切分器按它切换 in-dollar 态）⇒ 统一写「DO 块」；
--   · 幂等：ADD COLUMN IF NOT EXISTS / 受 pg_constraint 守卫的 ADD CONSTRAINT ⇒
--     反复 apply 落同一终态；
--   · 不改 0063/0064/0065/0068 已登记文件一字（checksum 漂移 = ABORT）。
-- ============================================================================

-- ============================================================================
-- ① 加列（可空 · 存量行 NULL 即「无头像」，前端首字渐变兜底）
-- ============================================================================
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS avatar_url text NULL;

COMMENT ON COLUMN public.project.avatar_url IS
  '项目头像（0069 加性）：站内媒体相对路径 ^/api/media/[0-9]{1,12}$；NULL = 未设头像（前端按项目名首字渐变兜底）。';

-- ============================================================================
-- ② 具名 CHECK（幂等守卫：pg_constraint 查名后补挂）
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'project_avatar_url_format_check'
       AND conrelid = 'public.project'::regclass
  ) THEN
    ALTER TABLE public.project
      ADD CONSTRAINT project_avatar_url_format_check
      CHECK (avatar_url IS NULL OR avatar_url ~ '^/api/media/[0-9]{1,12}$');
  END IF;
END $$;

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
--   ③ 列在场：text + 可空（NULL 是合法态，不是缺陷）
--   ④ 具名约束在场且约束体带正则
--   ⑤ 数据面：现存行里越线值 0 行
--   ⑥ 拒绝面：拿一行真实数据试写非法 URL ⇒ 必须被 CHECK 当场拒（23514）；
--      若竟被接受 ⇒ 自检主动 RAISE（不允许「约束挂着但不生效」）
-- ============================================================================
DO $$
DECLARE
  v_cnt      int;
  v_def      text;
  v_probe    bigint;
  v_rejected boolean := false;
BEGIN
  -- ③ 列在场：text + 可空
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project'
     AND column_name = 'avatar_url' AND data_type = 'text' AND is_nullable = 'YES';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0069 self-check FAILED: project.avatar_url expect nullable text column, got %', v_cnt;
  END IF;

  -- ④ 具名约束：CHECK 存在且约束体带正则（防止同名异体）
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conname = 'project_avatar_url_format_check'
     AND conrelid = 'public.project'::regclass AND contype = 'c';
  IF v_def IS NULL OR position('/api/media/[0-9]{1,12}' IN v_def) = 0 THEN
    RAISE EXCEPTION '0069 self-check FAILED: project_avatar_url_format_check 缺正则体，实际=%', COALESCE(v_def, '');
  END IF;

  -- ⑤ 数据面：越线值 0 行（存量全 NULL ⇒ 恒成立；双保险）
  SELECT count(*) INTO v_cnt FROM public.project
   WHERE avatar_url IS NOT NULL AND avatar_url !~ '^/api/media/[0-9]{1,12}$';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '0069 self-check FAILED: % project rows violate avatar_url format check', v_cnt;
  END IF;

  -- ⑥ 拒绝面：真实行试写外链 ⇒ 期望 check_violation；接受即红
  --    实现纪律：PL/pgSQL（DO 块 = 函数体）里**不允许** SAVEPOINT / ROLLBACK TO SAVEPOINT
  --    （42601 syntax error at or near "TO"）⇒ 用嵌套 BEGIN … EXCEPTION 块：它自带子事务，
  --    check_violation 一抛即回滚该子事务（脏值不留在行上），且只捕 23514，其余异常原样上抛。
  SELECT project_id INTO v_probe FROM public.project ORDER BY project_id LIMIT 1;
  IF v_probe IS NOT NULL THEN
    BEGIN
      UPDATE public.project SET avatar_url = 'https://evil.example.com/a.png'
       WHERE project_id = v_probe;
      RAISE EXCEPTION '0069 self-check FAILED: illegal avatar_url was accepted — CHECK not enforced';
    EXCEPTION
      WHEN check_violation THEN
        v_rejected := true;
    END;
    IF NOT v_rejected THEN
      RAISE EXCEPTION '0069 self-check FAILED: illegal avatar_url rejection probe did not run';
    END IF;
  END IF;
END $$;
