-- ============================================================================
-- 0017_platform_config.sql · P3 平台配置柱 —— `app_config` + 权限模型（4 表）+ `currency_status_log`
-- ============================================================================
-- 权威口径：docs/data-layer.spec.md **v0.5**（md5 ed8e2a1f19c86b39db880533ee1cbae8）
--   §6.6  `DL71` `app_config` 重建（DDL 提案 · 逐列）
--         `DL72` 权限模型重建（admin_role / admin_permission / admin_role_permission / admin_user_role
--               + `users.is_admin` 保留为**总开关** + 单一真源 `can_access_admin = users.is_admin OR ∃ role`）
--         `DL73` `currency_status_log` 必须建（依据 R29）+ **append-only**（手法同 `trg_referral_append_only`）
--   §6.1  编号表 `0017` 行 = app_config / admin_role / admin_permission / admin_role_permission / currency_status_log
--   §6.7  `DL74` 索引预算 · `DL75` 三件套 · `DL76` 可变/不可变口径 · `DL77` 判负用例 · `DL78` uid 列 FK users
--         · `DL79` 禁 DELETE（业务行）· `DL80` snake_case 非保留字
--   §7.2  `DL89` mint/burn 边界（本柱不用 mint/burn）· `DL83` ref_type 白名单（本柱不建账本对象）
--   §8    `DL93`–`DL100`（本柱不建账本事件；无 create_key 见张力②）
--   `DL20` / `DL46`–`DL48`（一迁一主题 / 幂等 + 自检）· `DL151`（所有 SQL 显式限定 `public.`）
--   `DL138`（9 张懒表已 DROP ⇒ 本册「重建」= 重新 CREATE；本库无旧表 ⇒ 逐列新建即可）
--   docs/ledger.spec.md v0.12：`R29`（币种合规冻结/解冻**不产生分录**但**必须**写审计）· `R75`（关户用状态不用删行）
--         · `R79` · `R103`（`−1` 只进不出）
--
-- 本迁移做什么（**纯新增** —— 不动既有 15 张基表的结构与数据）
--   ① `public.app_config`：逐列照 DL71（key text PK / value jsonb NOT NULL / updated_by bigint NOT NULL /
--      time_updated timestamptz NOT NULL DEFAULT now()）—— **单列 key/value**、**无 privacy 列**、禁存余额（DL3）
--   ② `public.admin_role` / `public.admin_permission` / `public.admin_role_permission` / `public.admin_user_role`
--   ③ `public.currency_status_log`：逐列照 DL73 + append-only 触发器
--   ④ 守卫触发器（PK 列不可变 + `app_config.time_updated` 自动刷新 + `currency_status_log` append-only）
--   ⑤ apply-time 自检（结构 + 列名 + 反断言 + 约束/FK/索引/触发器 `tgenabled` + 账本指纹未变）
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0016` 的任何字节**（checksum 冻结；`migrate.ts` 会整链 ABORT/exit 3）
--   · **不改 `users` 表**（DL72：`is_admin` 已存在 ⇒ 保留为总开关；本迁**绝不 ALTER users**）
--   · **不建任何账本类对象**（不新增 kind、不改 `ledger_post_event` / 三个编排函数 —— 由自检指纹断言兜住）
--   · 不接路由（`src/` 本单不改）；**不自创判定接口**：`can_access_admin` 只作**数据层查询口径**写进 COMMENT，
--     不 `CREATE FUNCTION`
--   · 不建 `permission_group` / 旧 `isAdminAddress` 双源（DL72：双源必须收敛）
--
-- ⚠️ 已登记张力 / 缺口（**不发明、不静默跳过**；逐条见 docs/audit/p3-platform-0017.md §5）
--   ① **DL71（只给列、未提 FK） vs DL78（新表的 uid 列一律 FK users(uid)）**：`app_config.updated_by` 是否算
--      「uid 列」有歧义 ⇒ 本迁移**逐列照 DL71 先落、不加 FK**（依据：平台/系统写者的 uid 可能不在 `users`；
--      DL78 是泛化句）⇒ **留 Zang 裁定**。自检含**反断言**：`app_config` 的 FK 数必须 = 0。
--   ② **DL75（每张业务表必须有三件套 create_key + ledger_event_keys + time_created/time_updated） vs §6.6 的
--      逐列契约**（6 张表列清单均未列 `create_key` / `ledger_event_keys`）⇒ 与 `0016` 缺口 E 同口径：
--      **逐列契约优先**，但**加 apply-time 反断言**并在报告登记。
--   ③ **DL76 的不可变/可变清单未列 `app_config` / `admin_*`** ⇒ 本迁移工程口径（登记）：
--      · `currency_status_log` = **append-only**（DL73/DL76 明列）：`BEFORE UPDATE OR DELETE` 无条件 RAISE。
--      · `app_config` = **可变配置表**（**不是** append-only）：PK `key` 不可变 + `time_updated` 自动刷新（DL75③/R5）；
--        DELETE **允许** —— DL71 的「不得删键」是**存量费率键的数据迁移纪律**（保留 + 标注「不参与计费」），
--        **不是**全表 DELETE 禁令（否则配置键无法下线）。
--      · `admin_role` / `admin_permission` / `admin_role_permission` / `admin_user_role` = **可变引用表**：
--        PK 列不可变 + DELETE **允许**（撤销角色/权限分配是合法业务操作；DL79 的禁 DELETE 针对**业务行**）。
--   ④ **§6.6 未列索引清单**（DL63 之于 §6.3 有、§6.6 无）⇒ 逐字照办：**只**建约束自带索引（PK ×6），
--      **不擅自增**（DL74 的「新增须说明」不适用 ⇒ 不增）。FK 列不另建索引（PG 不自动建），登记缺口。
--   ⑤ `admin_role.time_created` / `currency_status_log.time_created` 在 DL72/DL73 写作**裸 `time_created`**
--      ⇒ 本迁移按全库通例落 `timestamptz NOT NULL DEFAULT now()`（DL75③/R5）；`name` / `memo` 保持 spec 字面的
--      **可空文本**（不自创 NOT NULL）。`from_status` / `to_status` / `cid` / `actor_uid` / `log_id` 落 NOT NULL。
--
-- 幂等（DL48）：`CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` +
--   `CREATE TRIGGER`；末尾 apply-time `DO` 自检；任一失败 ⇒ 整迁移回滚、**不写版本行**。
--
-- 诚实边界（不得夸大）
--   · 「append-only / PK 不可变」是**防应用层事故的护栏**：`TRUNCATE` 不触发行触发器，超管
--     `ALTER TABLE … DISABLE TRIGGER USER` 可旁路 ⇒ **不得**表述为「绝对不可变」（同 `DL65` / commission.spec §2.2）。
--   · 「禁存余额」CHECK 只拒**裸标量**（数字/字符串/bool/null）；对象内嵌数字仍可绕过 ⇒ 护栏**非证明**，
--     余额真值仍在 `account.balance`（DL2/DL3）。
-- ============================================================================


-- ============================================================================
-- §A `public.app_config`（逐列照 DL71；4 列）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  key          text        NOT NULL,
  value        jsonb       NOT NULL,
  updated_by   bigint      NOT NULL,
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_pk PRIMARY KEY (key),
  -- DL3 / DL71「禁存任何余额」：value 只接受 JSON **容器**（object / array）；
  -- 裸标量（数字/字符串/bool/null）无处存余额。诚实边界见文件头（护栏非证明）。
  CONSTRAINT app_config_value_is_container CHECK (jsonb_typeof(value) IN ('object','array'))
);

COMMENT ON TABLE public.app_config IS
  'P3 平台配置（data-layer.spec v0.5 §6.6 / DL71）：**单列 key/value**、**无 privacy 列**、**禁存任何余额**（DL3，余额真值在 account.balance）。⚠️ **费率键不在此表权威**（真源 = commission_policy.fee_rate_bp，§5.20 #3）：若历史键存在 ⇒ **保留但标注「不参与计费」**、**不得删键**（commission.spec §4.4）。updated_by **不加 FK**（DL71 逐列；张力①登记：DL78 泛化句 vs 平台/系统写者 uid 可能不在 users）。可变表：key 不可变、time_updated 由触发器刷新。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';

-- §6.6 未列索引清单 ⇒ 不擅自增；PK 自带唯一索引。


-- ============================================================================
-- §B 权限模型（逐列照 DL72；4 表）
-- 单一真源：can_access_admin = users.is_admin OR 存在角色行
--   SELECT (u.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid))
--     FROM public.users u WHERE u.uid = :uid;
--   （本迁移**不自创函数**；该口径是数据层可验证查询，路由层按此实现。）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_role (
  role_key     text        NOT NULL,
  name         text,
  time_created timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_role_pk PRIMARY KEY (role_key)
);

COMMENT ON TABLE public.admin_role IS
  'P3 权限模型·角色（data-layer.spec v0.5 §6.6 / DL72）：role_key PK / name（可空文本，逐列照 spec）/ time_created。可变引用表（PK 列不可变，DELETE 允许 = 撤销角色定义）。DL76 未列本表 ⇒ 工程口径见 docs/audit/p3-platform-0017.md §5 张力③。';

CREATE TABLE IF NOT EXISTS public.admin_permission (
  permission_key text NOT NULL,
  name           text,
  CONSTRAINT admin_permission_pk PRIMARY KEY (permission_key)
);

COMMENT ON TABLE public.admin_permission IS
  'P3 权限模型·权限（data-layer.spec v0.5 §6.6 / DL72）：permission_key PK / name（可空文本）。可变引用表（PK 列不可变，DELETE 允许）。DL72 明确**不复用**旧 permission_group（B7：旧表已 DROP 且语义未核实）。';

CREATE TABLE IF NOT EXISTS public.admin_role_permission (
  role_key       text NOT NULL,
  permission_key text NOT NULL,
  CONSTRAINT admin_role_permission_pk      PRIMARY KEY (role_key, permission_key),
  CONSTRAINT admin_role_permission_role_fk FOREIGN KEY (role_key)       REFERENCES public.admin_role(role_key),
  CONSTRAINT admin_role_permission_perm_fk FOREIGN KEY (permission_key) REFERENCES public.admin_permission(permission_key)
);

COMMENT ON TABLE public.admin_role_permission IS
  'P3 权限模型·角色→权限（data-layer.spec v0.5 §6.6 / DL72）：PK(role_key, permission_key) + 两条 FK。可变引用表：PK 对不可变，DELETE 允许（移除某角色的一项权限是合法操作）。';

CREATE TABLE IF NOT EXISTS public.admin_user_role (
  uid      bigint NOT NULL,
  role_key text   NOT NULL,
  CONSTRAINT admin_user_role_pk      PRIMARY KEY (uid, role_key),
  CONSTRAINT admin_user_role_uid_fk  FOREIGN KEY (uid)      REFERENCES public.users(uid),
  CONSTRAINT admin_user_role_role_fk FOREIGN KEY (role_key) REFERENCES public.admin_role(role_key)
);

COMMENT ON TABLE public.admin_user_role IS
  'P3 权限模型·用户→角色（data-layer.spec v0.5 §6.6 / DL72）：PK(uid, role_key)；uid **FK users(uid)**（DL78）、role_key FK admin_role。**单一真源**：can_access_admin = users.is_admin（总开关）OR EXISTS(admin_user_role.uid = :uid)。可变引用表：PK 对不可变，DELETE 允许（**撤销角色分配**必须可删行）。';


-- ============================================================================
-- §C `public.currency_status_log`（逐列照 DL73；7 列；append-only）
-- 依据 R29：币种合规冻结 / 解冻**不产生账务分录**，但**必须**写审计记录。
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.currency_status_log (
  log_id       bigint      GENERATED BY DEFAULT AS IDENTITY,
  cid          bigint      NOT NULL,
  from_status  text        NOT NULL,
  to_status    text        NOT NULL,
  actor_uid    bigint      NOT NULL,
  memo         text,
  time_created timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT currency_status_log_pk        PRIMARY KEY (log_id),
  CONSTRAINT currency_status_log_cid_fk    FOREIGN KEY (cid)       REFERENCES public.currency(cid),
  CONSTRAINT currency_status_log_actor_fk  FOREIGN KEY (actor_uid) REFERENCES public.users(uid)
);

COMMENT ON TABLE public.currency_status_log IS
  'P3 币种状态审计（data-layer.spec v0.5 §6.6 / DL73；依据 R29）：币种合规冻结/解冻**不产生账务分录**但**必须**写审计。**append-only**（BEFORE UPDATE OR DELETE 无条件 RAISE，手法同 trg_referral_append_only）。cid FK currency(cid)、actor_uid FK users(uid)（DL78）。DELETE 被拒（DL79 同向：审计行不得物理删除）。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';


-- ============================================================================
-- §D 守卫函数（DL142 相邻纪律：函数**只由迁移创建**、体内**禁任何 DDL**）
-- ============================================================================

-- D1 PK 列不可变（通用：列名由 TG_ARGV 给出）—— 用于 app_config.key 与 admin_* 的键列
CREATE OR REPLACE FUNCTION public.platform_config_key_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_col text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  FOREACH v_col IN ARRAY TG_ARGV LOOP
    IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
      RAISE EXCEPTION 'immutable key column: public.%.% cannot change (% -> %)',
        TG_TABLE_NAME, v_col, COALESCE(v_old ->> v_col, '<null>'), COALESCE(v_new ->> v_col, '<null>');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.platform_config_key_immutable() IS
  '平台配置柱守卫：拒绝 PK/键列被 UPDATE（列名经 TG_ARGV 传入）。只由迁移创建（DL142 相邻）；体内无 DDL。借码 = 原生 P0001（哨兵，不走账本错误码命名空间 ⇒ 不建账本类对象）。';

-- D2 app_config.time_updated 自动刷新（DL75③ / R5：不接受客户端传时间）
CREATE OR REPLACE FUNCTION public.platform_config_touch_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.time_updated := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.platform_config_touch_updated() IS
  'app_config.time_updated 由 BEFORE UPDATE 触发器统一刷新（DL75③/R5：不接受客户端传时间）。只由迁移创建；体内无 DDL。';

-- D3 currency_status_log append-only（手法同 referral_append_only：BEFORE UPDATE OR DELETE + 无条件 RAISE）
CREATE OR REPLACE FUNCTION public.currency_status_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'currency_status_log is append-only: % forbidden (log_id=%)',
        TG_OP, COALESCE(OLD.log_id, 0);
END $$;

COMMENT ON FUNCTION public.currency_status_log_append_only() IS
  'DL73：currency_status_log 为 append-only（BEFORE UPDATE OR DELETE 无条件 RAISE，**手法同 trg_referral_append_only** = 原生 P0001，不借账本错误码 ⇒ 不建账本类对象）。诚实边界：不拦 TRUNCATE / DISABLE TRIGGER USER。';


-- ---------------------------------------------------------------------------
-- §D4 触发器挂载（幂等：DROP IF EXISTS + CREATE）
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_app_config_key_immutable ON public.app_config;
CREATE TRIGGER trg_app_config_key_immutable
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_key_immutable('key');

DROP TRIGGER IF EXISTS trg_app_config_touch_updated ON public.app_config;
CREATE TRIGGER trg_app_config_touch_updated
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_touch_updated();

DROP TRIGGER IF EXISTS trg_admin_role_key_immutable ON public.admin_role;
CREATE TRIGGER trg_admin_role_key_immutable
  BEFORE UPDATE ON public.admin_role
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_key_immutable('role_key');

DROP TRIGGER IF EXISTS trg_admin_permission_key_immutable ON public.admin_permission;
CREATE TRIGGER trg_admin_permission_key_immutable
  BEFORE UPDATE ON public.admin_permission
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_key_immutable('permission_key');

DROP TRIGGER IF EXISTS trg_admin_role_permission_key_immutable ON public.admin_role_permission;
CREATE TRIGGER trg_admin_role_permission_key_immutable
  BEFORE UPDATE ON public.admin_role_permission
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_key_immutable('role_key','permission_key');

DROP TRIGGER IF EXISTS trg_admin_user_role_key_immutable ON public.admin_user_role;
CREATE TRIGGER trg_admin_user_role_key_immutable
  BEFORE UPDATE ON public.admin_user_role
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_key_immutable('uid','role_key');

DROP TRIGGER IF EXISTS trg_currency_status_log_append_only ON public.currency_status_log;
CREATE TRIGGER trg_currency_status_log_append_only
  BEFORE UPDATE OR DELETE ON public.currency_status_log
  FOR EACH ROW EXECUTE FUNCTION public.currency_status_log_append_only();


-- ============================================================================
-- §E apply-time 自检（DL48：不通过则整迁移回滚、**不写版本行**）
-- ============================================================================
DO $$
DECLARE
  v_tbl     text;
  v_ncol    int;
  v_names   text;
  v_missing text;
  v_cols    int;
  v_n       int;
  v_bad     int;
  v_trg     int;
BEGIN
  -- ---------------------------------------------------------------- 结构：6 张新表在场
  IF to_regclass('public.app_config') IS NULL OR to_regclass('public.admin_role') IS NULL
     OR to_regclass('public.admin_permission') IS NULL OR to_regclass('public.admin_role_permission') IS NULL
     OR to_regclass('public.admin_user_role') IS NULL OR to_regclass('public.currency_status_log') IS NULL THEN
    RAISE EXCEPTION '0017 self-check FAILED: one of the 6 new tables is missing (§6.6)';
  END IF;

  -- 逐表列数 + 逐列名（**不增删列、不自创列名**）—— §6.6 / DL71 / DL72 / DL73
  FOR v_tbl, v_ncol, v_names IN
    SELECT * FROM (VALUES
      ('app_config',            4, 'key,value,updated_by,time_updated'),
      ('admin_role',            3, 'role_key,name,time_created'),
      ('admin_permission',      2, 'permission_key,name'),
      ('admin_role_permission', 2, 'role_key,permission_key'),
      ('admin_user_role',       2, 'uid,role_key'),
      ('currency_status_log',   7, 'log_id,cid,from_status,to_status,actor_uid,memo,time_created')
    ) AS t(a, b, c)
  LOOP
    SELECT count(*) INTO v_cols FROM information_schema.columns c
     WHERE c.table_schema='public' AND c.table_name=v_tbl;
    IF v_cols <> v_ncol THEN
      RAISE EXCEPTION '0017 self-check FAILED: public.% has % columns, expected % (§6.6)', v_tbl, v_cols, v_ncol;
    END IF;
    SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
      FROM unnest(string_to_array(v_names, ',')) AS x(n)
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                        WHERE c.table_schema='public' AND c.table_name=v_tbl AND c.column_name = x.n);
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION '0017 self-check FAILED: public.% missing columns: %', v_tbl, v_missing;
    END IF;
  END LOOP;

  -- 反断言（张力②：DL75 三件套 vs §6.6 逐列契约 ⇒ 逐列优先，未列的列必须**不存在**）
  --   并含 DL71「无 privacy 列」的逐列断言
  SELECT string_agg(x.tbl || '.' || x.n, ',') INTO v_missing
    FROM (VALUES
      ('app_config','privacy'),('app_config','create_key'),('app_config','ledger_event_keys'),
      ('admin_role','create_key'),('admin_role','ledger_event_keys'),('admin_role','time_updated'),
      ('admin_permission','create_key'),('admin_permission','ledger_event_keys'),('admin_permission','time_updated'),
      ('admin_role_permission','create_key'),('admin_role_permission','ledger_event_keys'),('admin_role_permission','time_updated'),
      ('admin_user_role','create_key'),('admin_user_role','ledger_event_keys'),('admin_user_role','time_updated'),
      ('currency_status_log','create_key'),('currency_status_log','ledger_event_keys'),('currency_status_log','time_updated')
    ) AS x(tbl, n)
   WHERE EXISTS (SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name=x.tbl AND c.column_name=x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0017 self-check FAILED: forbidden extra column(s) present (§6.6 逐列契约 / DL71 无 privacy): %', v_missing;
  END IF;

  -- DL71：value / updated_by NOT NULL；time_updated NOT NULL DEFAULT now()
  SELECT count(*) INTO v_n FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='app_config'
     AND c.column_name IN ('value','updated_by','time_updated') AND c.is_nullable='NO';
  IF v_n <> 3 THEN
    RAISE EXCEPTION '0017 self-check FAILED: app_config value/updated_by/time_updated NOT NULL = %, expected 3 (DL71)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='app_config' AND c.column_name='time_updated' AND c.column_default='now()';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0017 self-check FAILED: app_config.time_updated default must be now() (DL71)';
  END IF;

  -- DL3 / DL71「禁存余额」CHECK 在场 + **实测有效**（裸标量必被拒）
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conname='app_config_value_is_container' AND k.contype='c') THEN
    RAISE EXCEPTION '0017 self-check FAILED: app_config_value_is_container CHECK missing (DL3/DL71 禁存余额)';
  END IF;
  BEGIN
    INSERT INTO public.app_config (key, value, updated_by) VALUES ('__p3p_selfcheck__', '0'::jsonb, 1);
    RAISE EXCEPTION '0017 self-check FAILED: app_config accepted a bare scalar value (禁存余额 CHECK ineffective)';
  EXCEPTION WHEN check_violation THEN
    NULL;  -- 预期：被 CHECK 拒（23514）
  END;

  -- DL72 总开关：users.is_admin 必须在场（本迁**不得 ALTER users**）
  SELECT count(*) INTO v_n FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='users' AND c.column_name='is_admin' AND c.data_type='boolean';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0017 self-check FAILED: users.is_admin (DL72 总开关) missing';
  END IF;

  -- PK：6 张新表各一
  SELECT count(*) INTO v_n FROM pg_constraint k
   WHERE k.contype='p' AND k.conrelid IN ('public.app_config'::regclass,'public.admin_role'::regclass,
        'public.admin_permission'::regclass,'public.admin_role_permission'::regclass,
        'public.admin_user_role'::regclass,'public.currency_status_log'::regclass);
  IF v_n <> 6 THEN
    RAISE EXCEPTION '0017 self-check FAILED: PK constraints on new tables = %, expected 6', v_n;
  END IF;

  -- FK 逐条（DL78）：uid → users(uid) = 2
  SELECT count(*) INTO v_n FROM pg_constraint k
   WHERE k.contype='f' AND k.confrelid='public.users'::regclass
     AND k.conrelid IN ('public.admin_user_role'::regclass,'public.currency_status_log'::regclass);
  IF v_n <> 2 THEN
    RAISE EXCEPTION '0017 self-check FAILED: uid FKs to users(uid) = %, expected 2 (DL78)', v_n;
  END IF;
  -- cid → currency(cid) = 1
  SELECT count(*) INTO v_n FROM pg_constraint k
   WHERE k.contype='f' AND k.confrelid='public.currency'::regclass AND k.conrelid='public.currency_status_log'::regclass;
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0017 self-check FAILED: currency_status_log cid FK to currency = %, expected 1', v_n;
  END IF;
  -- → admin_role = 2；→ admin_permission = 1
  SELECT count(*) INTO v_n FROM pg_constraint k WHERE k.contype='f' AND k.confrelid='public.admin_role'::regclass;
  IF v_n <> 2 THEN RAISE EXCEPTION '0017 self-check FAILED: FKs to admin_role = %, expected 2', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint k WHERE k.contype='f' AND k.confrelid='public.admin_permission'::regclass;
  IF v_n <> 1 THEN RAISE EXCEPTION '0017 self-check FAILED: FKs to admin_permission = %, expected 1', v_n; END IF;
  -- 新表 FK 总数 = 6
  SELECT count(*) INTO v_n FROM pg_constraint k
   WHERE k.contype='f' AND k.conrelid IN ('public.app_config'::regclass,'public.admin_role'::regclass,
        'public.admin_permission'::regclass,'public.admin_role_permission'::regclass,
        'public.admin_user_role'::regclass,'public.currency_status_log'::regclass);
  IF v_n <> 6 THEN RAISE EXCEPTION '0017 self-check FAILED: total FKs on new tables = %, expected 6', v_n; END IF;
  -- 张力①反断言：app_config **不得**有 FK（逐列照 DL71）
  SELECT count(*) INTO v_n FROM pg_constraint k WHERE k.contype='f' AND k.conrelid='public.app_config'::regclass;
  IF v_n <> 0 THEN RAISE EXCEPTION '0017 self-check FAILED: app_config must have 0 FKs (DL71 逐列; 张力①) = %', v_n; END IF;
  -- R21 / DL78：**不得**对 ledger_entry 建 FK
  SELECT count(*) INTO v_n FROM pg_constraint k
   WHERE k.contype='f' AND k.confrelid='public.ledger_entry'::regclass
     AND k.conrelid IN ('public.app_config'::regclass,'public.admin_role'::regclass,
        'public.admin_permission'::regclass,'public.admin_role_permission'::regclass,
        'public.admin_user_role'::regclass,'public.currency_status_log'::regclass);
  IF v_n <> 0 THEN RAISE EXCEPTION '0017 self-check FAILED: ledger_entry FK not allowed (R21/DL78) = %', v_n; END IF;

  -- DL74 / §6.6（无索引清单）：**只**允许约束自带索引（PK ×6）
  SELECT string_agg(i.indexname, ',' ORDER BY i.indexname) INTO v_missing FROM pg_indexes i
   WHERE i.schemaname='public'
     AND i.tablename IN ('app_config','admin_role','admin_permission','admin_role_permission','admin_user_role','currency_status_log')
     AND i.indexname NOT IN ('app_config_pk','admin_role_pk','admin_permission_pk','admin_role_permission_pk','admin_user_role_pk','currency_status_log_pk');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0017 self-check FAILED: unexpected extra index beyond §6.6 (none listed): %', v_missing;
  END IF;
  SELECT count(*) INTO v_n FROM pg_indexes i WHERE i.schemaname='public'
   AND i.indexname IN ('app_config_pk','admin_role_pk','admin_permission_pk','admin_role_permission_pk','admin_user_role_pk','currency_status_log_pk');
  IF v_n <> 6 THEN RAISE EXCEPTION '0017 self-check FAILED: constraint-owned indexes = %, expected 6', v_n; END IF;

  -- 触发器启用态（全 'O'）：app_config 2 / 其余各 1（合计 7）
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O' AND t.tgrelid='public.app_config'::regclass;
  IF v_trg <> 2 THEN RAISE EXCEPTION '0017 self-check FAILED: app_config enabled triggers = %, expected 2', v_trg; END IF;
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O' AND t.tgrelid='public.currency_status_log'::regclass;
  IF v_trg <> 1 THEN RAISE EXCEPTION '0017 self-check FAILED: currency_status_log enabled triggers = %, expected 1 (DL73)', v_trg; END IF;
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O'
     AND t.tgrelid IN ('public.admin_role'::regclass,'public.admin_permission'::regclass,
                       'public.admin_role_permission'::regclass,'public.admin_user_role'::regclass);
  IF v_trg <> 4 THEN RAISE EXCEPTION '0017 self-check FAILED: admin_* enabled triggers = %, expected 4', v_trg; END IF;
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O'
     AND t.tgrelid IN ('public.app_config'::regclass,'public.admin_role'::regclass,'public.admin_permission'::regclass,
                       'public.admin_role_permission'::regclass,'public.admin_user_role'::regclass,'public.currency_status_log'::regclass);
  IF v_trg <> 7 THEN RAISE EXCEPTION '0017 self-check FAILED: new-table enabled triggers = %, expected 7', v_trg; END IF;
  -- DL73：append-only 触发器必须同时覆盖 UPDATE 与 DELETE
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O' AND t.tgrelid='public.currency_status_log'::regclass
     AND t.tgtype & 16 <> 0 AND t.tgtype & 8 <> 0;
  IF v_trg <> 1 THEN
    RAISE EXCEPTION '0017 self-check FAILED: currency_status_log append-only trigger must cover UPDATE OR DELETE (DL73)';
  END IF;
  -- 本柱触发器无一被禁用
  SELECT count(*) INTO v_bad FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled <> 'O'
     AND t.tgrelid IN ('public.app_config'::regclass,'public.admin_role'::regclass,'public.admin_permission'::regclass,
                       'public.admin_role_permission'::regclass,'public.admin_user_role'::regclass,'public.currency_status_log'::regclass);
  IF v_bad <> 0 THEN RAISE EXCEPTION '0017 self-check FAILED: % disabled trigger(s) on new tables', v_bad; END IF;

  -- 守卫函数在场
  IF to_regprocedure('public.platform_config_key_immutable()') IS NULL
     OR to_regprocedure('public.platform_config_touch_updated()') IS NULL
     OR to_regprocedure('public.currency_status_log_append_only()') IS NULL THEN
    RAISE EXCEPTION '0017 self-check FAILED: guard functions missing';
  END IF;

  -- -------------------------------------------------- 「不得建任何账本类对象」：账本指纹未变（DL142）
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='ledger_post_event'
     AND octet_length(p.prosrc)=51429 AND md5(p.prosrc)='d94dd902697dfe60aba409d808c6d63a';
  IF v_n <> 1 THEN RAISE EXCEPTION '0017 self-check FAILED: ledger_post_event fingerprint changed (DL142)'; END IF;
  -- 三个编排函数指纹未变
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND ( (p.proname='job_post_event'     AND octet_length(p.prosrc)=13594 AND md5(p.prosrc)='0cedbb9ea60dcbda28e3ef3dafdd119b')
        OR (p.proname='listing_post_event' AND octet_length(p.prosrc)=17858 AND md5(p.prosrc)='0e187c20b56d45202d83978c8a02b31d')
        OR (p.proname='market_post_event'  AND octet_length(p.prosrc)=30194 AND md5(p.prosrc)='74841611252726e1cc0f57cb46ea6c6d') );
  IF v_n <> 3 THEN RAISE EXCEPTION '0017 self-check FAILED: orchestration function fingerprints changed (DL142) = %', v_n; END IF;
  -- 未新增任何 ledger* 表
  SELECT string_agg(t.table_name, ',') INTO v_missing FROM information_schema.tables t
   WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name LIKE 'ledger%'
     AND t.table_name NOT IN ('ledger_entry','ledger_owner');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION '0017 self-check FAILED: unexpected ledger* table: %', v_missing; END IF;

  -- 基表数 15 → 21（纯新增 6）
  SELECT count(*) INTO v_n FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';
  IF v_n <> 21 THEN RAISE EXCEPTION '0017 self-check FAILED: public base tables = %, expected 21 (15 + 6)', v_n; END IF;

  RAISE NOTICE '0017 self-check OK: 6 tables (app_config 4 / admin_role 3 / admin_permission 2 / admin_role_permission 2 / admin_user_role 2 / currency_status_log 7) / PK×6 / FK×6 / trg×7 all O / ledger fingerprints unchanged';
END $$;
