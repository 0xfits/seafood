-- ============================================================================
-- 0006_user_to_users.sql · D11：`public."user"` 重命名为 `public.users`
-- ============================================================================
-- 决策依据：docs/seafood.master-plan.md §D11（Kevin 2026-09-27 拍板）
--   `user` 是 PostgreSQL 保留字：`SELECT ... FROM user` **不报错**，而是被解析成
--   `current_user` 并**静默返回错误结果**（实测同一时刻：裸 `user` = 1 行 /
--   `"user"` = 0 行）⇒ 属「静默给错答案」类陷阱。趁表 0 行时改成本最低。
--
--   ⚠️ 诚实边界（必须写清，不得夸大）：**改名不消除 `user` 关键字的该行为**。
--      改完之后 `SELECT count(*) FROM user` **依旧**静默返回 `current_user` 的 1 行。
--      本迁移消除的是**事故类别**：项目「正确的那名字」（`users`）不再是保留字 ⇒
--      写对时无歧义、写错时（从旧代码拷来的 `user` / 裸写法）因为没有同名表可被
--      「碰对」而暴露得更早。**不是「陷阱已被消除」。**
--
-- 本迁移做什么（严格限定在 public schema，绝不触碰 neon_auth."user"）：
--   1) 前置断言：不允许存在指向 public."user" 的 FK（若有则中止，交人工处理）
--   2) `ALTER TABLE public."user" RENAME TO users`（幂等守卫）
--   3) 约束改名 `user_*` → `users_*`（PK / UNIQUE / CHECK / NOT NULL 全类）
--      —— 改 PK / UNIQUE 约束名会**连带改其底层索引名**（PostgreSQL 语义）
--   4) 独立索引 `idx_user_evm_lower` → `idx_users_evm_lower`
--   5) 序列 `user_uid_seq` → `users_uid_seq`（identity 序列，PG 不随表改名自动改）
--   6) 后置校验：新名在、旧名不在、旧前缀约束零残留
--
-- 本迁移**不**做什么：
--   - 不改任何列名（`uid` / `evm` / `bio` / `is_admin` / `time_reg` / `time_login_last` 原样）
--     ⇒ 代码侧只需把表名 `"user"` 换成 `"users"`，不必连带改列引用。
--   - 不建索引 `idx_user_uid`：实测该索引在库里**不存在**（`src/database.ts:518` 的
--     `CREATE INDEX IF NOT EXISTS idx_user_uid ON "user" ("uID")` 因 `"uID"` 列不存在而
--     从未建成 —— 既存失配，与本单无关）。
--   - 不触碰 `neon_auth."user"`（Neon Auth 自有表；本库有 4 条 FK 指向**它**，
--     `account.userId` / `invitation.inviterId` / `member.userId` / `session.userId`，
--     全部在 neon_auth schema，**与 D11 无关**）。
--   - 不改 `0001`–`0005`、不改 `schema_migration`。
--
-- 实证（改名前真库目录，见 .p1g-artifacts/p1g-00-inventory.txt）：
--   - 指向 public."user" 的 FK：**0 条**
--   - 视图 / RLS / 非内部触发器：**0**
--   - PL/pgSQL 函数体含 `"user"`：**0 条**（0004/0005 的函数体零引用 ⇒ 无需 CREATE OR REPLACE）
--   - 关联对象：`user_pk` / `user_evm_uniq` / `user_evm_fmt` / `user_uid_positive`
--                + 6 个 `user_*_not_null` + `idx_user_evm_lower` + `user_uid_seq`
--   - 行数：0
-- 幂等：全部 DDL 走 `EXECUTE` + `to_regclass` / `pg_constraint` 存在性守卫，重跑为空操作。
-- ============================================================================

-- ---------------------------------------------------------------- 1. 前置断言
DO $$
DECLARE
  v_fk_cnt int;
BEGIN
  SELECT count(*) INTO v_fk_cnt
    FROM pg_constraint con
   WHERE con.contype = 'f'
     AND con.confrelid = (
       SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'user' AND c.relkind = 'r'
     );
  IF v_fk_cnt > 0 THEN
    RAISE EXCEPTION 'migration 0006 aborted: % FK(s) still reference public."user"; migrate them explicitly before renaming', v_fk_cnt;
  END IF;
END
$$;

-- ---------------------------------------------------------------- 2. 表改名
DO $$
DECLARE
  v_old oid;
  v_new oid;
BEGIN
  SELECT c.oid INTO v_old FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'user' AND c.relkind = 'r';
  SELECT c.oid INTO v_new FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r';

  IF v_old IS NOT NULL AND v_new IS NULL THEN
    EXECUTE 'ALTER TABLE public."user" RENAME TO users';
  END IF;
END
$$;

-- ---------------------------------------------------------------- 3. 约束改名
DO $$
DECLARE
  r      record;
  v_new  text;
  v_n    int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r') THEN
    RAISE EXCEPTION 'migration 0006 step3: public.users not found';
  END IF;

  FOR r IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'users'
       AND con.conname LIKE 'user\_%'
     ORDER BY con.conname
  LOOP
    v_new := 'users_' || substr(r.conname, 6);   -- 去掉 'user_' 前缀
    EXECUTE format('ALTER TABLE public.users RENAME CONSTRAINT %I TO %I', r.conname, v_new);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------- 4. 独立索引改名
DO $$
DECLARE v_old oid;
BEGIN
  SELECT c.oid INTO v_old FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'idx_user_evm_lower' AND c.relkind = 'i';
  IF v_old IS NOT NULL THEN
    EXECUTE 'ALTER INDEX public.idx_user_evm_lower RENAME TO idx_users_evm_lower';
  END IF;
END
$$;

-- ---------------------------------------------------------------- 5. 序列改名
DO $$
DECLARE v_old oid;
BEGIN
  SELECT c.oid INTO v_old FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'user_uid_seq' AND c.relkind = 'S';
  IF v_old IS NOT NULL THEN
    EXECUTE 'ALTER SEQUENCE public.user_uid_seq RENAME TO users_uid_seq';
  END IF;
END
$$;

-- ---------------------------------------------------------------- 6. 后置校验
DO $$
DECLARE
  v_old_present int;
  v_new_present int;
  v_residual    int;
  v_legacy_idx  int;
  v_legacy_seq  int;
BEGIN
  SELECT count(*) INTO v_old_present FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'user' AND c.relkind = 'r';
  IF v_old_present <> 0 THEN
    RAISE EXCEPTION 'migration 0006 post-check: public."user" still exists';
  END IF;

  SELECT count(*) INTO v_new_present FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind = 'r';
  IF v_new_present <> 1 THEN
    RAISE EXCEPTION 'migration 0006 post-check: public.users missing (found %)', v_new_present;
  END IF;

  SELECT count(*) INTO v_residual
    FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'users' AND con.conname LIKE 'user\_%';
  IF v_residual <> 0 THEN
    RAISE EXCEPTION 'migration 0006 post-check: % constraint(s) still named user_*', v_residual;
  END IF;

  SELECT count(*) INTO v_legacy_idx FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'idx_user_evm_lower';
  IF v_legacy_idx <> 0 THEN
    RAISE EXCEPTION 'migration 0006 post-check: legacy index idx_user_evm_lower still present';
  END IF;

  SELECT count(*) INTO v_legacy_seq FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'user_uid_seq';
  IF v_legacy_seq <> 0 THEN
    RAISE EXCEPTION 'migration 0006 post-check: legacy sequence user_uid_seq still present';
  END IF;
END
$$;
