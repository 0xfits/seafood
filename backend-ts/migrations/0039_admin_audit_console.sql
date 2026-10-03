-- ============================================================================
-- 0039_admin_audit_console.sql · 8⑥ 审计台：权限键闭集 11 → 12（新增 `manage_audit`）
-- ============================================================================
-- 溯源（裁定 / 规格，逐字对照）：
--   · docs/route-layer.spec.md **v2.21 §32.14** 终审裁定落位表 —— **`R-9-75`**（`PZ-6`）：
--     采变体 Ⅱ = **新增权限键 `manage_audit`**（闭集 `11 → 12`）；★ **三处编码同步**
--     （`backend-ts/src/database.ts` `ALL_ADMIN_PERMISSIONS` / **库侧 `admin_permission` 行** /
--     `frontend/src/admin-utils.js:40-52` 硬编码）+ **迁移** + **门与前端闭集相等断言**。
--   · 依据锚 = `docs/seafood.master-plan.md:1432`（`R-9-75`）；`R-9-73`（权限键闭集**现取 = 11**，
--     更正主计划 `:1443` 的「6 个」= `manage_*` 子集标签）。
--   · 库侧载体形态 = `backend-ts/migrations/0022_admin_permission_seed.sql`（纯 DML 种子 · 逐条
--     `ON CONFLICT DO NOTHING`）**逐字沿**；本迁移 = 该种子的**同形增量**（恰 +1 键）。
--   · `data-layer.spec` **v0.28 §35.5**：`manage_audit` 迁移（`admin_permission` 11 → 12）
--     归 8⑥ 实现单 · **apply 由 Zang**。
--
-- 本迁移**做**什么（全部 DML 种子；逐条 `ON CONFLICT DO NOTHING` ⇒ 幂等）：
--   ① `public.admin_permission`：**+1 行** `permission_key = 'manage_audit'`（展示名 `审计台查看`）。
--      闭集 `11 → 12`（键集才是契约；展示名属工程提供，非规格派生 —— 承 `0022` 注释）。
--   ② `public.admin_role_permission`：**`super_admin` × `manage_audit` +1**（★ 登记：`super_admin`
--      = 「超级管理员」= **全权限**内置角色（`0022` 起即 11 键全给）⇒ 新增键**默认同给**；
--      否则「超管看不到审计台」= 语义回归。**不发明第二个角色**）。
--
-- 本迁移**不做**什么（硬边界）：
--   · **不改 `0001`–`0038` 任何字节**（`migrate.ts` 整链 checksum 冻结，漂移即 ABORT）。
--   · **不改任何表结构**：不 CREATE/ALTER/DROP 表 / 列 / 约束 / 索引 / 函数 / 触发器。
--     ⇒ **基表数仍 34**（本迁移不建任何对象）。
--   · **不建任何账本类对象**、**不写 `ledger_entry`**（Δ `ledger_entry` 恒 0）、**不碰 `account`**、
--     **不碰任何 `append-only` 留痕面**（审计台只读纪律 · `route-layer.spec` v2.21 §32.10）。
--   · 不含 `BEGIN/COMMIT`（`scripts/migrate.ts` 对每个文件单事务包裹；文件内自开事务会嵌套报错）。
--   · 不含 `DO/EXECUTE` 动态 DDL。
--   · 不含 `TRUNCATE`/`DELETE`（种子只**增**不**删**）。
--
-- ★ 覆盖说明（`0022` 自检口径，逐字沿 `R-9-75`）：`0022` 文件内的 apply-time 自检断言
--   `admin_permission = 11` / `super_admin = 11` —— 该自检在**重建链**中于 `0022` 时点运行
--   （此时确为 11，自检成立），本迁移（`0039`）在该时点**之后**把闭集推到 **12**；
--   **07-08 之后的一切断言以 12 为准**（本文件自带 12 自检）。`0022` 文件字节**未改**（不可改 · 已 apply）。
--   ★ 库侧 `admin_permission.permission_key` **无 CHECK / 无枚举类型**（现取：仅 `NOT NULL` + PK；
--   `0017:103-107`）⇒ **无「库侧闭集 CHECK 需同步」面**（本迁移自检含该负断言）。
--
-- 幂等（沿 `0022` 收尾口径）：重复应用读数一致、不报错、不留痕；末尾 apply-time 自检，
--   任一项不过 ⇒ **整迁移回滚、不写版本行**。
-- ⚠️ 本单（8⑥ 实现第一步）**不 apply**：只做事务内 `BEGIN;<本全文>;ROLLBACK;` 真跑自证（净零写）。
--    apply 由 Zang 亲自执行。
-- ============================================================================


-- ============================================================================
-- ① 权限键种子（+1 键 · `manage_audit` · 逐字来自 `R-9-75`）
--    展示名沿 `0022` 风格（`审计台查看` · 工程提供）。
-- ============================================================================
INSERT INTO public.admin_permission (permission_key, name) VALUES
  ('manage_audit', '审计台查看')
ON CONFLICT (permission_key) DO NOTHING;


-- ============================================================================
-- ② 角色 → 权限（`super_admin` = 全权限内置角色 ⇒ 新增键默认同给；`0022:74-88` 同形 +1）
-- ============================================================================
INSERT INTO public.admin_role_permission (role_key, permission_key) VALUES
  ('super_admin', 'manage_audit')
ON CONFLICT (role_key, permission_key) DO NOTHING;


-- ============================================================================
-- §E apply-time 自检（沿 `0022:106-177` 手法；不通过 ⇒ 整迁移回滚、**不写版本行**）
--   · 新值在场（`manage_audit`）+ 旧 11 值逐字未动 + 闭集恰 12（多/少任一键判负）
--   · `admin_role_permission` super_admin 恰 12（新增键已赋权）
--   · 结构面零位移（DML-only 反断言）：基表数仍 **34**
--   · `admin_permission.permission_key` **无 CHECK / 无枚举**（同步面为零 · 负断言）
--   · 不新增任何 ledger* 表 / 不碰任何 append-only 面
-- ============================================================================
DO $$
DECLARE
  v_n       int;
  v_missing text;
BEGIN
  -- ① 权限键：恰好 12 行
  SELECT count(*) INTO v_n FROM public.admin_permission;
  IF v_n <> 12 THEN
    RAISE EXCEPTION '0039 self-check FAILED: admin_permission rows = %, expected 12 (11 旧 + manage_audit)', v_n;
  END IF;

  -- ② ★ 新值在场（fail-closed 正向）
  SELECT count(*) INTO v_n FROM public.admin_permission WHERE permission_key = 'manage_audit';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0039 self-check FAILED: new permission key manage_audit rows = %, expected 1', v_n;
  END IF;

  -- ③ ★ 旧 11 值**逐字未动**（任一缺失判负）
  SELECT string_agg(x.k, ',' ORDER BY x.k) INTO v_missing
    FROM (VALUES
      ('dashboard_access'),('manage_permissions'),('manage_points'),('manage_rewards'),
      ('manage_settings'),('manage_tasks'),('manage_users'),('publish_prizes'),
      ('publish_tasks'),('read_users'),('review_tasks')
    ) AS x(k)
   WHERE NOT EXISTS (SELECT 1 FROM public.admin_permission p WHERE p.permission_key = x.k);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0039 self-check FAILED: admin_permission missing old key(s): %', v_missing;
  END IF;

  -- ④ 闭集**恰 12**：除 12 键外**不得有**任何其它键（多键判负 ⇒ 防漂移）
  SELECT string_agg(p.permission_key, ',' ORDER BY p.permission_key) INTO v_missing
    FROM public.admin_permission p
   WHERE p.permission_key NOT IN
     ('dashboard_access','manage_permissions','manage_points','manage_rewards','manage_settings',
      'manage_tasks','manage_users','publish_prizes','publish_tasks','read_users','review_tasks',
      'manage_audit');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0039 self-check FAILED: admin_permission has unexpected key(s): %', v_missing;
  END IF;

  -- ⑤ 角色→权限：super_admin 恰 12（新增键已赋权）
  SELECT count(*) INTO v_n FROM public.admin_role_permission WHERE role_key = 'super_admin';
  IF v_n <> 12 THEN
    RAISE EXCEPTION '0039 self-check FAILED: super_admin permissions = %, expected 12', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.admin_role_permission
   WHERE role_key = 'super_admin' AND permission_key = 'manage_audit';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0039 self-check FAILED: super_admin lacks manage_audit (grant row missing)';
  END IF;

  -- ⑥ 无悬挂 FK（沿 `0022:147-152`）
  SELECT count(*) INTO v_n FROM public.admin_role_permission r
   WHERE NOT EXISTS (SELECT 1 FROM public.admin_role a WHERE a.role_key = r.role_key);
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0039 self-check FAILED: % dangling admin_role_permission rows', v_n;
  END IF;

  -- -------------------------------------------------- 结构面零位移（DML-only 反断言）
  -- ① 基表数仍 34（本迁移不建任何对象 · `R-9-75` 只加 DML 种子）
  SELECT count(*) INTO v_n FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';
  IF v_n <> 34 THEN
    RAISE EXCEPTION '0039 self-check FAILED: public base tables = %, expected 34 (unchanged)', v_n;
  END IF;

  -- ② 库侧闭集同步面为零：`admin_permission.permission_key` 不得有 CHECK / 枚举约束
  --    （现取：仅 PK + NOT NULL · `0017:103-107`）⇒ 本迁移无需同步 CHECK。
  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'public.admin_permission'::regclass AND contype IN ('c','e');
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0039 self-check FAILED: admin_permission has % CHECK/enum constraint(s) — library-side closed set drifted; migration must sync it', v_n;
  END IF;

  -- ③ 不新增任何 ledger* 表（沿 `0022:169-174`）
  SELECT string_agg(t.table_name, ',') INTO v_missing FROM information_schema.tables t
   WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name LIKE 'ledger%'
     AND t.table_name NOT IN ('ledger_entry','ledger_owner');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0039 self-check FAILED: unexpected ledger* table: %', v_missing;
  END IF;

  RAISE NOTICE '0039 self-check OK: admin_permission 11 → 12 (manage_audit 在场; 旧 11 值逐字未动) / super_admin 11 → 12 / base tables 34 unchanged / no CHECK on permission_key / no ledger* table';
END $$;
