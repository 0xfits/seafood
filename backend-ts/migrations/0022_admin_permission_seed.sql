-- ============================================================================
-- 0022_admin_permission_seed.sql · P6-B6-PERM 权限/角色种子（**纯 DML 新增，本单不 apply**）
-- ============================================================================
-- 溯源（裁定 / 规格，逐字对照）：
--   · docs/route-layer.spec.md 批 6 = 「权限种子迁移（数据层补遗）+ `isAdminAddress` 第三真源收敛
--     + §5.78 的 `NOT_MEASURED` 面补测」（§6.5 顺序依赖：**先种子、后收敛**）。
--   · Zang §5.77 修正：权限键**真源放代码侧** = `backend-ts/src/database.ts:11-23`
--     的 `ALL_ADMIN_PERMISSIONS`（11 键），与 `frontend/src/admin-utils.js:40-52` **逐键 0 差异**；
--     `admin_permission` **表种子**留批 6 **走迁移**。
--     理由（§5.77 原话）：种子若只存于当前库态，用重建脚本重置回 `0001..0021` 声明基线时
--     会**消失** ⇒ 权限面**静默失效**。放进迁移 ⇒ **重建也包含它**。
--   · `DL72`（data-layer.spec v0.5）：单一真源 `can_access_admin = users.is_admin OR ∃ admin_user_role`。
--   · `0017_platform_config.sql`：本柱 4 表**只建表、不插种子**（`admin_permission` 0 行）——
--     本迁移即该「登记缺口」的补遗。
--
-- 本迁移**做**什么（全部 DML 种子；逐条 `ON CONFLICT DO NOTHING` ⇒ 幂等）：
--   ① `public.admin_permission`：**11 行**，`permission_key` = `ALL_ADMIN_PERMISSIONS` **逐键**。
--      `name` 为**展示名**（`DL72` 逐列：`name text` 可空；键集才是契约，展示名属工程提供，非规格派生）。
--   ② `public.admin_role`：**1 行** `role_key='super_admin'`（唯一内置角色；本迁移不发明第二个）。
--   ③ `public.admin_role_permission`：`super_admin` × 11 键（**显式 VALUES**，受 FK 兜底）。
--   ④ `public.admin_user_role`：把**原 `auth.ts:35` 第三真源常量** `DEFAULT_ADMIN_ADDRESS`
--      （`0x59f9f640d15ebb053c94a816232cf8ce91b209b0`）在库内的持有人绑定到 `super_admin`。
--      ⇒ 这是 §6.5「**先种子后收敛**」顺序依赖的落地：收敛后地址不再**直接**授予权限，
--         改由**角色行**授予，运营管理员因此不丢管理员身份。
--      取证：`users.evm` 命中 = uid **970213**（只读探针 `scripts/p4z-b6perm-00-probe.ts`，
--            `is_admin=false` ⇒ 收敛前它**完全依赖** `isAdminAddress` 才拿到 admin）。
--      **按库内匹配**（`INSERT … SELECT`）：重建库 `users` 为空 ⇒ 插入 0 行，天然幂等、无硬编码 uid。
--
-- 本迁移**不做**什么（硬边界）：
--   · **不改 `0001`–`0021` 任何字节**（`migrate.ts` 整链 checksum 冻结，漂移即 exit 3）。
--   · **不改任何表结构**：不 CREATE/ALTER/DROP 表 / 列 / 约束 / 索引 / 函数 / 触发器。
--     ⇒ **基表数 23、非内部触发器数 43 均不变**（`p3x-00-rebuild-replay.ts` 期望已同步：
--        `VERSION_ORDER` 追加 `'0022'`、`schema_migration` 期望行 20 → **21**、
--        `M0017_TABLES` 逐表行数由「全 0」改为「种子后真值」）。
--   · **不建任何账本类对象**、**不写 `ledger_entry`**（Δledger_entry 恒为 0）、**不碰 `account`**。
--   · 不含 `BEGIN/COMMIT`（`scripts/migrate.ts` 对每个文件单事务包裹；文件内自开事务会嵌套报错）。
--   · 不含 `DO/EXECUTE` 动态 DDL（`p3x` 的期望对象集由 `stripSql` 词法剥离后静态抽取）。
--   · 不含 `TRUNCATE`/`DELETE`（种子只**增**不**删**；撤销角色是应用层动作，不属本迁移）。
--
-- 幂等（DL48）：重复应用读数一致、不报错、不留痕；末尾 apply-time 自检，
--   任一项不过 ⇒ **整迁移回滚、不写版本行**。
-- ⚠️ 本单（P6-B6-PERM）**不 apply**：只做 `--dry-run` 重放 + 事务内预演（净零写）。
--    apply 由 Zang 亲自执行（先骸架后回填）。
-- ============================================================================


-- ============================================================================
-- ① 权限键种子（11 键 · 逐键来自 src/database.ts:12-22 ALL_ADMIN_PERMISSIONS）
-- ============================================================================
INSERT INTO public.admin_permission (permission_key, name) VALUES
  ('dashboard_access',   '控制台访问'),
  ('manage_tasks',       '任务管理'),
  ('publish_tasks',      '发布任务'),
  ('manage_rewards',     '奖励管理'),
  ('publish_prizes',     '发布奖品'),
  ('read_users',         '用户查看'),
  ('manage_users',       '用户管理'),
  ('manage_points',      '积分管理'),
  ('manage_permissions', '权限管理'),
  ('manage_settings',    '系统设置'),
  ('review_tasks',       '任务审核')
ON CONFLICT (permission_key) DO NOTHING;


-- ============================================================================
-- ② 角色种子（1 内置角色）
-- ============================================================================
INSERT INTO public.admin_role (role_key, name) VALUES
  ('super_admin', '超级管理员')
ON CONFLICT (role_key) DO NOTHING;


-- ============================================================================
-- ③ 角色 → 权限（super_admin × 11 键；显式 VALUES，FK 兜底）
-- ============================================================================
INSERT INTO public.admin_role_permission (role_key, permission_key) VALUES
  ('super_admin', 'dashboard_access'),
  ('super_admin', 'manage_tasks'),
  ('super_admin', 'publish_tasks'),
  ('super_admin', 'manage_rewards'),
  ('super_admin', 'publish_prizes'),
  ('super_admin', 'read_users'),
  ('super_admin', 'manage_users'),
  ('super_admin', 'manage_points'),
  ('super_admin', 'manage_permissions'),
  ('super_admin', 'manage_settings'),
  ('super_admin', 'review_tasks')
ON CONFLICT (role_key, permission_key) DO NOTHING;


-- ============================================================================
-- ④ 用户 → 角色（原第三真源地址的持有人 ⇒ super_admin）
--    只读取证：uid 970213（EVM 0x59f9f640d15ebb053c94a816232cf8ce91b209b0）/ is_admin=false。
--    重建库 users 为空 ⇒ 0 行；真库 ⇒ 1 行（幂等）。
-- ============================================================================
INSERT INTO public.admin_user_role (uid, role_key)
SELECT u.uid, 'super_admin'
  FROM public.users u
 WHERE lower(u.evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'
ON CONFLICT (uid, role_key) DO NOTHING;


-- ============================================================================
-- §E apply-time 自检（DL48：不通过 ⇒ 整迁移回滚、**不写版本行**）
-- ============================================================================
DO $$
DECLARE
  v_n       int;
  v_missing text;
BEGIN
  -- ① 权限键：恰好 11 行，且键集**逐键相等**（多/少任一键都判负）
  SELECT count(*) INTO v_n FROM public.admin_permission;
  IF v_n <> 11 THEN
    RAISE EXCEPTION '0022 self-check FAILED: admin_permission rows = %, expected 11 (ALL_ADMIN_PERMISSIONS)', v_n;
  END IF;
  SELECT string_agg(x.k, ',' ORDER BY x.k) INTO v_missing
    FROM (VALUES
      ('dashboard_access'),('manage_permissions'),('manage_points'),('manage_rewards'),
      ('manage_settings'),('manage_tasks'),('manage_users'),('publish_prizes'),
      ('publish_tasks'),('read_users'),('review_tasks')
    ) AS x(k)
   WHERE NOT EXISTS (SELECT 1 FROM public.admin_permission p WHERE p.permission_key = x.k);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0022 self-check FAILED: admin_permission missing key(s): %', v_missing;
  END IF;
  SELECT string_agg(p.permission_key, ',' ORDER BY p.permission_key) INTO v_missing
    FROM public.admin_permission p
   WHERE p.permission_key NOT IN
     ('dashboard_access','manage_permissions','manage_points','manage_rewards','manage_settings',
      'manage_tasks','manage_users','publish_prizes','publish_tasks','read_users','review_tasks');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0022 self-check FAILED: admin_permission has unexpected key(s): %', v_missing;
  END IF;

  -- ② 角色：super_admin 在场
  SELECT count(*) INTO v_n FROM public.admin_role WHERE role_key = 'super_admin';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0022 self-check FAILED: admin_role super_admin rows = %, expected 1', v_n;
  END IF;

  -- ③ 角色→权限：恰好 11 行（super_admin 全权限）
  SELECT count(*) INTO v_n FROM public.admin_role_permission WHERE role_key = 'super_admin';
  IF v_n <> 11 THEN
    RAISE EXCEPTION '0022 self-check FAILED: super_admin permissions = %, expected 11', v_n;
  END IF;

  -- ④ 用户→角色：**可为 0**（重建库 users 为空）——只断言 FK 完整性（无悬挂 role_key）
  SELECT count(*) INTO v_n FROM public.admin_user_role r
   WHERE NOT EXISTS (SELECT 1 FROM public.admin_role a WHERE a.role_key = r.role_key);
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0022 self-check FAILED: % dangling admin_user_role rows', v_n;
  END IF;

  -- -------------------------------------------------- 结构面零位移（DML-only 反断言）
  -- 基表数仍 23、非内部触发器仍 43（本迁移不建任何对象）
  SELECT count(*) INTO v_n FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';
  IF v_n <> 23 THEN
    RAISE EXCEPTION '0022 self-check FAILED: public base tables = %, expected 23 (unchanged)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal;
  IF v_n <> 43 THEN
    RAISE EXCEPTION '0022 self-check FAILED: non-internal triggers = %, expected 43 (unchanged)', v_n;
  END IF;

  -- 不新增任何 ledger* 表
  SELECT string_agg(t.table_name, ',') INTO v_missing FROM information_schema.tables t
   WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name LIKE 'ledger%'
     AND t.table_name NOT IN ('ledger_entry','ledger_owner');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0022 self-check FAILED: unexpected ledger* table: %', v_missing;
  END IF;

  RAISE NOTICE '0022 self-check OK: admin_permission 11 / admin_role 1 (super_admin) / admin_role_permission 11 / admin_user_role ≥0 / base tables 23 / triggers 43 unchanged';
END $$;
