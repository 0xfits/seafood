-- ============================================================================
-- 0029_batt_checkin.sql · P9② 变体 Ⅰ：batt 电量（独立数据面）+ 签到 / 补签
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · docs/data-layer.spec.md **v0.21 §31.2(c)** 草案 ①–④（**表名 / 列 / 约束 / 索引逐字**）；
--     §31.7 Zang 裁定 **R-9-19**（就地定案，2026-10-03）：**变体 = Ⅰ（双表 · 4 张）** =
--       `batt_account` + `batt_entry` + `checkin_log` + `checkin_makeup_log`；
--   · §31.3（batt 数值面）：区间 `[0,100]` fail-closed；单任务消耗 9；「电量 < 9 ⇒ 禁接单」闸落点；
--   · §31.4（签到 / 补签）：断签清零、`UNIQUE (uid, checkin_day)`、补签幂等键、日界 = UTC 自然日；
--   · §31.4(d) Zang 裁定 **R-9-16**：补签 `$` 腿幂等键 = `biz:checkin:makeup:<uid>:<target_day>`；
--   · §31.4(c) Zang 裁定 **R-9-20**：补签**只恢复连续天数、不补发该日 batt**（**不写** `batt_entry` 补发行）；
--   · §31.5：`$` 归属 = `uid = −1`（**不真 burn**）；零净写（`Σ(delta) = 0`）。
--
-- 承载（变体 Ⅰ · 4 张新表）：
--   ① `public.batt_account`      —— 逐用户 batt 余额（**可变表** · `CHECK batt BETWEEN 0 AND 100`）
--   ② `public.batt_entry`        —— 逐用户 batt 流水（**append-only**）
--   ③ `public.checkin_log`       —— 签到记录（**append-only** · `UNIQUE (uid, checkin_day)`）
--   ④ `public.checkin_makeup_log`—— 补签记录（**append-only** · `UNIQUE (uid, makeup_day)` +
--                                    `UNIQUE (idempotency_key, result)`）
-- 触发器（**恰 4**）：`batt_account` 一枚 `BEFORE UPDATE` 刷 `time_updated` + 其余三表各一枚
--   `BEFORE UPDATE OR DELETE` 无条件 `RAISE`（append-only，原生 `P0001`，**不借账本错误码**）。
--
-- 本迁移**不做什么**：不新增 / 不删除 kind（`ledger_kind_enum` 一字不动 —— kind 扩容归 `0028`）；
--   不新增错误码（仍是 33 码关闭集）；不改 `0001`–`0027` 任何文件；不写任何业务数据。
--   函数体内**无任何 DDL**（DL142 相邻）；**不 `DELETE` / `TRUNCATE` / `DROP` 业务数据**。
--
-- 幂等：`CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` +
--   `CREATE TRIGGER` / `CREATE INDEX IF NOT EXISTS` 天然幂等；本文件只被 `migrate.ts` 执行一次。
-- ============================================================================


-- ============================================================================
-- §A `public.batt_account`（逐用户余额 · 可变表 · 唯一真源）
-- ============================================================================
-- 列 / 约束逐项溯源自 §31.2(c) 草案 ①（先例锚逐字）：
--   · `uid`          bigint NOT NULL           ← `0017:127`（`admin_user_role.uid`）/ `0001:42`（`account.uid`）
--   · `batt`         integer NOT NULL DEFAULT 0 ← `0001:44`（`account.balance`）
--   · `time_created` timestamptz NOT NULL DEFAULT now() ← `0001:47` / `0017:73`
--   · `time_updated` timestamptz NOT NULL DEFAULT now() ← `0001:48` / `0017:73`
--   · `batt_account_pk`      PRIMARY KEY (uid)         ← `0017:74`（`app_config_pk`）
--   · `batt_account_uid_fk`  FK (uid) → users(uid)     ← `0017:127`（`admin_user_role_uid_fk`）
--   · `batt_account_range`   CHECK (batt BETWEEN 0 AND 100) ← `0007:93`（区间型 CHECK 先例）
--   · 索引：只 PK（约束自带）· **不擅自增**（`0017:83`）
--   · 可变表：`time_updated` 由 `BEFORE UPDATE` 触发器刷新（`0017:44` + `0017:180-189` 手法）
CREATE TABLE IF NOT EXISTS public.batt_account (
  uid          bigint      NOT NULL,
  batt         integer     NOT NULL DEFAULT 0,
  time_created timestamptz NOT NULL DEFAULT now(),
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batt_account_pk      PRIMARY KEY (uid),
  CONSTRAINT batt_account_uid_fk  FOREIGN KEY (uid) REFERENCES public.users(uid),
  -- ★ §31.3(a) 值域 fail-closed 的 **DB 兜底**：任何写路径绕过应用层闸时，越界必被 23514 拒。
  CONSTRAINT batt_account_range   CHECK (batt BETWEEN 0 AND 100)
);

COMMENT ON TABLE public.batt_account IS
  'P9②（Kong；依据 data-layer.spec v0.21 §31.2(c) 草案① + Zang 裁定 R-9-19 变体 Ⅰ）：**batt 电量逐用户余额**（独立数据面，不占 ledger kind · R-9-6）。变体 Ⅰ 的**可变表**：`batt` 随消耗 / 签到更新（`CHECK batt BETWEEN 0 AND 100` = 值域 fail-closed 的 DB 兜底），`time_updated` 由 BEFORE UPDATE 触发器刷新。索引只 PK（约束自带），不擅自增。**禁存于 `app_config`**（DL3/DL71 禁存余额）。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';


-- ============================================================================
-- §B `public.batt_entry`（逐用户 batt 流水 · append-only）
-- ============================================================================
-- 列 / 约束逐项溯源自 §31.2(c) 草案 ②：
--   · `txid` bigint GENERATED ALWAYS AS IDENTITY (PK) ← `0001:56`（`ledger_entry.txid`）
--   · `uid` bigint NOT NULL ← `0001:57`（**无 FK** —— 同 `ledger_entry.uid` 先例）
--   · `delta` integer NOT NULL ← `0001:59`
--   · `batt_after` integer NOT NULL ← `0001:61`（`balance_after`）
--   · `reason` text NOT NULL（机读常量：`checkin` / `checkin_day7` / `task_cost` ——
--       §31.2(c) 草案②候选集，**去除 R-9-20 已废的补签补发行**）
--   · `idempotency_key` text NOT NULL ← `0001:66`
--   · `ref_type` text / `ref_id` bigint ← `0001:64-65`
--   · `memo` text NOT NULL DEFAULT '' ← `0001:69`
--   · `time_created` timestamptz NOT NULL DEFAULT now() ← `0001:70` / `0017:146`
--   · `batt_entry_move_guard`  CHECK (delta <> 0) ← `0001:71`（`ledger_move_guard`）
--   · `batt_entry_after_guard` CHECK (batt_after BETWEEN 0 AND 100) ← `0001:72` + `0007:93`
--   · `batt_entry_idem_uniq`   UNIQUE (idempotency_key) ← `0001:74`（`ledger_idem_uniq`）
--   · 索引 `idx_batt_entry_uid_time (uid, time_created DESC)` ← `0023:133`（`actor_day_idx` 手法）
--   · append-only：`BEFORE UPDATE OR DELETE` 无条件 `RAISE`（原生 `P0001`）← `0017:191-197` / `0023:112-127`
CREATE TABLE IF NOT EXISTS public.batt_entry (
  txid            bigint      GENERATED ALWAYS AS IDENTITY,
  uid             bigint      NOT NULL,
  delta           integer     NOT NULL,
  batt_after      integer     NOT NULL,
  reason          text        NOT NULL,
  idempotency_key text        NOT NULL,
  ref_type        text,
  ref_id          bigint,
  memo            text        NOT NULL DEFAULT '',
  time_created    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batt_entry_pk          PRIMARY KEY (txid),
  CONSTRAINT batt_entry_move_guard  CHECK (delta <> 0),
  CONSTRAINT batt_entry_after_guard CHECK (batt_after BETWEEN 0 AND 100),
  CONSTRAINT batt_entry_idem_uniq   UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.batt_entry IS
  'P9②（Kong；依据 data-layer.spec v0.21 §31.2(c) 草案② + Zang 裁定 R-9-19）：**batt 逐笔流水**（append-only）。每笔 batt 变动一行（审计逐笔凭证）；`batt_after` 为事后余额（前值 = batt_after − delta）；`reason` = 机读常量（checkin / checkin_day7 / task_cost）。**补签不写本表**（R-9-20：补签只恢复连续天数、不补发该日 batt）。**append-only**（BEFORE UPDATE OR DELETE 无条件 RAISE，原生 P0001，不借账本码）。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';

CREATE INDEX IF NOT EXISTS idx_batt_entry_uid_time
  ON public.batt_entry (uid, time_created DESC);


-- ============================================================================
-- §C `public.checkin_log`（签到记录 · append-only · 逐用户 × 逐日唯一）
-- ============================================================================
-- 列 / 约束逐项溯源自 §31.2(c) 草案 ③：
--   · `log_id` bigint GENERATED BY DEFAULT AS IDENTITY (PK) ← `0017:140` / `0023:65`
--   · `uid` bigint NOT NULL ← `0017:144` / `0023:66`
--   · `checkin_day` date NOT NULL（日界 = **UTC 自然日** · R-9-15）
--   · `streak_day` smallint NOT NULL（判定后的连续天数 1..7）← `0007:87`
--   · `reward_batt` integer NOT NULL ← `0001:59`
--   · `time_created` timestamptz NOT NULL DEFAULT now() ← `0017:146` / `0023:81`
--   · `checkin_log_pk`          PRIMARY KEY (log_id) ← `0023:82`
--   · `checkin_log_uid_fk`      FK (uid) → users(uid) ← `0023:83`
--   · `checkin_log_streak_rng`  CHECK (streak_day BETWEEN 1 AND 7) ← `0007:93`
--   · `checkin_log_reward_ck`   CHECK (reward_batt > 0) ← `0023:88`（`amount <> 0`）
--   · `checkin_log_day_uniq`    UNIQUE (uid, checkin_day) ← `0001:28`（UNIQUE 先例）
--   · 索引 `idx_checkin_log_uid_day (uid, checkin_day)` ← `0023:133`
--   · append-only（同手法）← `0017:236-239` / `0023:112-127`
CREATE TABLE IF NOT EXISTS public.checkin_log (
  log_id       bigint      GENERATED BY DEFAULT AS IDENTITY,
  uid          bigint      NOT NULL,
  checkin_day  date        NOT NULL,
  streak_day   smallint    NOT NULL,
  reward_batt  integer     NOT NULL,
  time_created timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_log_pk         PRIMARY KEY (log_id),
  CONSTRAINT checkin_log_uid_fk     FOREIGN KEY (uid) REFERENCES public.users(uid),
  CONSTRAINT checkin_log_streak_rng CHECK (streak_day BETWEEN 1 AND 7),
  CONSTRAINT checkin_log_reward_ck  CHECK (reward_batt > 0),
  CONSTRAINT checkin_log_day_uniq   UNIQUE (uid, checkin_day)
);

COMMENT ON TABLE public.checkin_log IS
  'P9②（Kong；依据 data-layer.spec v0.21 §31.2(c) 草案③ + §31.4 签到规则）：**签到记录**（append-only）。`checkin_day` = 动作发生日的 UTC 自然日（R-9-15）；`streak_day` = 判定后的连续天数（1..7，断签清零后归 1）；`reward_batt` = 本次配置奖励（30 基础 / 60 第 7 天，**> 0**；实际入账 delta 受封顶丢弃限制，见 batt_entry）。`UNIQUE (uid, checkin_day)` = 每日 1 次。**append-only**（BEFORE UPDATE OR DELETE 无条件 RAISE）。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';

CREATE INDEX IF NOT EXISTS idx_checkin_log_uid_day
  ON public.checkin_log (uid, checkin_day);


-- ============================================================================
-- §D `public.checkin_makeup_log`（补签记录 · append-only · 幂等 + 每日上限）
-- ============================================================================
-- 列 / 约束逐项溯源自 §31.2(c) 草案 ④：
--   · `log_id` bigint GENERATED BY DEFAULT AS IDENTITY (PK) ← `0023:65` / `0024:49`
--   · `uid` bigint NOT NULL ← `0023:66` / `0024:50`
--   · `makeup_day` date NOT NULL（动作发生的「日界日」· 用于 ≤1/日 · R-9-15）
--   · `target_day` date NOT NULL（被补的那一天 · 业务标的日）
--   · `cost_usd` bigint NOT NULL（= 100 · 服务端取数）← `0024:55`（`amount`）
--   · `restored_streak_day` smallint NOT NULL ← `0007:87`
--   · `cid` bigint NOT NULL ← `0023:71`（`cid` 列先例；草案④ 的 `checkin_makeup_log_cid_fk`
--       引用它 ⇒ 本列必需）
--   · `result` text NOT NULL（**闭集** —— 候选值域随 P9② 实现单定案：
--        `applied` / `rejected_daily_limit` / `rejected_insufficient_balance` / `rejected_target_invalid`）
--        ← `0023:78` / `0024:56`
--   · `txid` bigint（成功行 = 回执；拒绝行 = NULL）← `0023:79` / `0024:57`
--   · `idempotency_key` text NOT NULL ← `0023:77`
--   · `request_fingerprint` text NOT NULL ← `0023:76`
--   · `memo` text ← `0023:80`
--   · `time_created` timestamptz NOT NULL DEFAULT now() ← `0023:81`
--   · `checkin_makeup_log_pk` / `..._uid_fk` ← `0023:82-83`
--   · `checkin_makeup_log_cid_fk` FK (cid) → currency(cid)（cid = 1）← `0023:85` / `0024:66`
--   · `checkin_makeup_log_idem_uniq` UNIQUE (idempotency_key, result) ← `0023:99` / `0024:72`
--   · `checkin_makeup_log_day_uniq`  UNIQUE (uid, makeup_day) ← `0001:28`（UNIQUE 先例）
--   · 索引 `idx_checkin_makeup_log_uid_day (uid, makeup_day)` ← `0024:107` / `0023:133`
--   · append-only ← `0023:112-127` / `0025:79-91`
CREATE TABLE IF NOT EXISTS public.checkin_makeup_log (
  log_id              bigint      GENERATED BY DEFAULT AS IDENTITY,
  uid                 bigint      NOT NULL,
  makeup_day          date        NOT NULL,
  target_day          date        NOT NULL,
  cost_usd            bigint      NOT NULL,
  restored_streak_day smallint    NOT NULL,
  cid                 bigint      NOT NULL,
  result              text        NOT NULL,
  txid                bigint,
  idempotency_key     text        NOT NULL,
  request_fingerprint text        NOT NULL,
  memo                text,
  time_created        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_makeup_log_pk        PRIMARY KEY (log_id),
  CONSTRAINT checkin_makeup_log_uid_fk    FOREIGN KEY (uid) REFERENCES public.users(uid),
  CONSTRAINT checkin_makeup_log_cid_fk    FOREIGN KEY (cid) REFERENCES public.currency(cid),
  -- 闭集（候选值域随 P9② 实现单定案）：成功 = 'applied'；三类拒绝亦留痕（§31.4(c)-5「被拒尝试必须留痕」）。
  CONSTRAINT checkin_makeup_log_result_ck CHECK (result IN (
    'applied', 'rejected_daily_limit', 'rejected_insufficient_balance', 'rejected_target_invalid')),
  -- 沿 0023 裁定四（「幂等键约束**效果**、不约束**尝试**」）：同键同结果唯一。
  CONSTRAINT checkin_makeup_log_idem_uniq UNIQUE (idempotency_key, result),
  -- ≤1/日（按 UTC 自然日 · R-9-15）。
  CONSTRAINT checkin_makeup_log_day_uniq  UNIQUE (uid, makeup_day)
);

COMMENT ON TABLE public.checkin_makeup_log IS
  'P9②（Kong；依据 data-layer.spec v0.21 §31.2(c) 草案④ + §31.4(c)/(d) + R-9-16/R-9-20）：**补签记录**（append-only）。`makeup_day` = 动作发生日的 UTC 自然日（≤1/日）；`target_day` = 被补那一天（业务标的日 · 幂等键成分）；`cost_usd` = 100（服务端取数）；`restored_streak_day` = 恢复后的连续天数。`result` 闭集：成功 `applied`（写账本腿 `−100 $ → uid = −1` · 不补发 batt）、拒绝三类（资金零残留，但**留痕**）。`UNIQUE (uid, makeup_day)` + `UNIQUE (idempotency_key, result)`（沿 0023 裁定四）。**append-only**（BEFORE UPDATE OR DELETE 无条件 RAISE）。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';

CREATE INDEX IF NOT EXISTS idx_checkin_makeup_log_uid_day
  ON public.checkin_makeup_log (uid, makeup_day);


-- ============================================================================
-- §E 守卫函数（DL142 相邻纪律：函数**只由迁移创建**、体内**禁任何 DDL**）
-- ============================================================================
-- E1 batt_account.time_updated 自动刷新（手法同 0017:181-189 platform_config_touch_updated）
CREATE OR REPLACE FUNCTION public.batt_account_touch_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.time_updated := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.batt_account_touch_updated() IS
  'batt_account.time_updated 由 BEFORE UPDATE 触发器统一刷新（不接受客户端传时间）。只由迁移创建；体内无 DDL。';

-- E2 batt_entry append-only（手法同 0017:192-197 / 0023:114-119）
CREATE OR REPLACE FUNCTION public.batt_entry_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'batt_entry is append-only: % forbidden (txid=%)',
        TG_OP, COALESCE(OLD.txid, 0);
END $$;

COMMENT ON FUNCTION public.batt_entry_append_only() IS
  'batt_entry 为 append-only（BEFORE UPDATE OR DELETE 无条件 RAISE，原生 P0001，不借账本错误码）。只由迁移创建；体内无 DDL。诚实边界：不拦 TRUNCATE / DISABLE TRIGGER USER。';

-- E3 checkin_log append-only
CREATE OR REPLACE FUNCTION public.checkin_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'checkin_log is append-only: % forbidden (log_id=%)',
        TG_OP, COALESCE(OLD.log_id, 0);
END $$;

COMMENT ON FUNCTION public.checkin_log_append_only() IS
  'checkin_log 为 append-only（BEFORE UPDATE OR DELETE 无条件 RAISE，原生 P0001）。只由迁移创建；体内无 DDL。诚实边界：不拦 TRUNCATE / DISABLE TRIGGER USER。';

-- E4 checkin_makeup_log append-only
CREATE OR REPLACE FUNCTION public.checkin_makeup_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'checkin_makeup_log is append-only: % forbidden (log_id=%)',
        TG_OP, COALESCE(OLD.log_id, 0);
END $$;

COMMENT ON FUNCTION public.checkin_makeup_log_append_only() IS
  'checkin_makeup_log 为 append-only（BEFORE UPDATE OR DELETE 无条件 RAISE，原生 P0001）。只由迁移创建；体内无 DDL。诚实边界：不拦 TRUNCATE / DISABLE TRIGGER USER。';

-- ---------------------------------------------------------------------------
-- §E5 触发器挂载（**恰 4** 枚；幂等：DROP IF EXISTS + CREATE）
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_batt_account_touch_updated ON public.batt_account;
CREATE TRIGGER trg_batt_account_touch_updated
  BEFORE UPDATE ON public.batt_account
  FOR EACH ROW EXECUTE FUNCTION public.batt_account_touch_updated();

DROP TRIGGER IF EXISTS trg_batt_entry_append_only ON public.batt_entry;
CREATE TRIGGER trg_batt_entry_append_only
  BEFORE UPDATE OR DELETE ON public.batt_entry
  FOR EACH ROW EXECUTE FUNCTION public.batt_entry_append_only();

DROP TRIGGER IF EXISTS trg_checkin_log_append_only ON public.checkin_log;
CREATE TRIGGER trg_checkin_log_append_only
  BEFORE UPDATE OR DELETE ON public.checkin_log
  FOR EACH ROW EXECUTE FUNCTION public.checkin_log_append_only();

DROP TRIGGER IF EXISTS trg_checkin_makeup_log_append_only ON public.checkin_makeup_log;
CREATE TRIGGER trg_checkin_makeup_log_append_only
  BEFORE UPDATE OR DELETE ON public.checkin_makeup_log
  FOR EACH ROW EXECUTE FUNCTION public.checkin_makeup_log_append_only();


-- ============================================================================
-- §F apply-time 自检（不通过 ⇒ 整迁移回滚、**不写版本行**）
-- ============================================================================
DO $$
DECLARE
  v_names   text;
  v_n       int;
  v_trg     int;
  v_covers  int;
BEGIN
  -- ---------------------------------------------------------------- 四表在场
  IF to_regclass('public.batt_account')        IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: public.batt_account missing'; END IF;
  IF to_regclass('public.batt_entry')          IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: public.batt_entry missing'; END IF;
  IF to_regclass('public.checkin_log')         IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: public.checkin_log missing'; END IF;
  IF to_regclass('public.checkin_makeup_log')  IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: public.checkin_makeup_log missing'; END IF;

  -- ---------------------------------------------------------------- 逐表列名逐字
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO v_names
    FROM information_schema.columns WHERE table_schema='public' AND table_name='batt_account';
  IF v_names <> 'uid,batt,time_created,time_updated' THEN
    RAISE EXCEPTION '0029 self-check FAILED: batt_account columns = %', v_names; END IF;

  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO v_names
    FROM information_schema.columns WHERE table_schema='public' AND table_name='batt_entry';
  IF v_names <> 'txid,uid,delta,batt_after,reason,idempotency_key,ref_type,ref_id,memo,time_created' THEN
    RAISE EXCEPTION '0029 self-check FAILED: batt_entry columns = %', v_names; END IF;

  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO v_names
    FROM information_schema.columns WHERE table_schema='public' AND table_name='checkin_log';
  IF v_names <> 'log_id,uid,checkin_day,streak_day,reward_batt,time_created' THEN
    RAISE EXCEPTION '0029 self-check FAILED: checkin_log columns = %', v_names; END IF;

  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO v_names
    FROM information_schema.columns WHERE table_schema='public' AND table_name='checkin_makeup_log';
  IF v_names <> 'log_id,uid,makeup_day,target_day,cost_usd,restored_streak_day,cid,result,txid,idempotency_key,request_fingerprint,memo,time_created' THEN
    RAISE EXCEPTION '0029 self-check FAILED: checkin_makeup_log columns = %', v_names; END IF;

  -- ---------------------------------------------------------------- batt_account：PK×1 / FK×1 / CHECK×1
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.batt_account'::regclass AND contype='p';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_account PK count = %', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.batt_account'::regclass AND contype='f';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_account FK count = % (expect 1)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.batt_account'::regclass AND contype='c';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_account CHECK count = % (expect 1: range)', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.batt_account'::regclass AND conname='batt_account_range'
                   AND pg_get_constraintdef(oid) LIKE '%batt >= 0%' AND pg_get_constraintdef(oid) LIKE '%batt <= 100%') THEN
    RAISE EXCEPTION '0029 self-check FAILED: batt_account_range CHECK (batt BETWEEN 0 AND 100) not in place'; END IF;

  -- ---------------------------------------------------------------- batt_entry：PK×1 / CHECK×2 / UNIQUE×1
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.batt_entry'::regclass AND contype='p';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_entry PK count = %', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.batt_entry'::regclass AND contype='c';
  IF v_n <> 2 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_entry CHECK count = % (expect 2)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.batt_entry'::regclass AND contype='u' AND conname='batt_entry_idem_uniq';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_entry idempotency UNIQUE missing'; END IF;

  -- ---------------------------------------------------------------- checkin_log：PK×1 / FK×1 / CHECK×2 / UNIQUE×1
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_log'::regclass AND contype='p';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_log PK count = %', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_log'::regclass AND contype='f';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_log FK count = % (expect 1)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_log'::regclass AND contype='c';
  IF v_n <> 2 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_log CHECK count = % (expect 2)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_log'::regclass AND contype='u' AND conname='checkin_log_day_uniq';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_log UNIQUE (uid, checkin_day) missing'; END IF;

  -- ---------------------------------------------------------------- checkin_makeup_log：PK×1 / FK×2 / CHECK×1 / UNIQUE×2
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_makeup_log'::regclass AND contype='p';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_makeup_log PK count = %', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_makeup_log'::regclass AND contype='f';
  IF v_n <> 2 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_makeup_log FK count = % (expect 2: uid/cid)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_makeup_log'::regclass AND contype='c';
  IF v_n <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_makeup_log CHECK count = % (expect 1: result)', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE conrelid='public.checkin_makeup_log'::regclass AND contype='u'
    AND conname IN ('checkin_makeup_log_idem_uniq','checkin_makeup_log_day_uniq');
  IF v_n <> 2 THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_makeup_log UNIQUE count = % (expect 2)', v_n; END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid='public.checkin_makeup_log'::regclass AND conname='checkin_makeup_log_idem_uniq')
     <> 'UNIQUE (idempotency_key, result)' THEN
    RAISE EXCEPTION '0029 self-check FAILED: makeup idem UNIQUE 非复合 (idempotency_key, result)'; END IF;

  -- ---------------------------------------------------------------- 索引齐（具名索引逐明在场）
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='batt_entry' AND indexname='idx_batt_entry_uid_time') THEN
    RAISE EXCEPTION '0029 self-check FAILED: idx_batt_entry_uid_time missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='checkin_log' AND indexname='idx_checkin_log_uid_day') THEN
    RAISE EXCEPTION '0029 self-check FAILED: idx_checkin_log_uid_day missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='checkin_makeup_log' AND indexname='idx_checkin_makeup_log_uid_day') THEN
    RAISE EXCEPTION '0029 self-check FAILED: idx_checkin_makeup_log_uid_day missing'; END IF;

  -- ---------------------------------------------------------------- append-only 三表：恰 1 启用触发器且覆盖 UPDATE OR DELETE
  FOR v_names IN SELECT unnest(ARRAY['batt_entry','checkin_log','checkin_makeup_log']) LOOP
    SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=v_names AND NOT t.tgisinternal AND t.tgenabled='O';
    IF v_trg <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: % enabled triggers = %, expect 1', v_names, v_trg; END IF;
    SELECT count(*) INTO v_covers FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=v_names AND NOT t.tgisinternal
       AND (t.tgtype & 2) <> 0 AND (t.tgtype & 8) <> 0 AND (t.tgtype & 16) <> 0;
    IF v_covers <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: % append-only trigger must cover UPDATE OR DELETE', v_names; END IF;
  END LOOP;

  -- ---------------------------------------------------------------- batt_account：恰 1 枚 BEFORE UPDATE touch 触发器
  SELECT count(*) INTO v_trg FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='batt_account' AND NOT t.tgisinternal AND t.tgenabled='O';
  IF v_trg <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_account enabled triggers = %, expect 1', v_trg; END IF;
  SELECT count(*) INTO v_covers FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='batt_account' AND NOT t.tgisinternal
     AND (t.tgtype & 2) <> 0 AND (t.tgtype & 16) <> 0;
  IF v_covers <> 1 THEN RAISE EXCEPTION '0029 self-check FAILED: batt_account touch trigger must be BEFORE UPDATE'; END IF;

  -- ---------------------------------------------------------------- 四守卫函数在场
  IF to_regprocedure('public.batt_account_touch_updated()')       IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: batt_account_touch_updated() missing'; END IF;
  IF to_regprocedure('public.batt_entry_append_only()')           IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: batt_entry_append_only() missing'; END IF;
  IF to_regprocedure('public.checkin_log_append_only()')          IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_log_append_only() missing'; END IF;
  IF to_regprocedure('public.checkin_makeup_log_append_only()')   IS NULL THEN RAISE EXCEPTION '0029 self-check FAILED: checkin_makeup_log_append_only() missing'; END IF;

  -- ---------------------------------------------------------------- kind 关闭集未被动（扩容归 0028，本迁移不动）
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'
                    AND contype='c' AND strpos(pg_get_constraintdef(oid), quote_literal('checkin_makeup_fee')) > 0) THEN
    RAISE NOTICE '0029 self-check NOTICE: ledger_kind_enum 尚未含 checkin_makeup_fee —— 需 0028 先行 apply（本迁移不依赖它，仅登记）';
  END IF;

  RAISE NOTICE '0029 self-check OK: 4 tables (batt_account/batt_entry/checkin_log/checkin_makeup_log) + 4 triggers (1 touch + 3 append-only) + named indexes in place';
END $$;


-- ============================================================================
-- §G `-1` 归属白名单追加 `checkin_makeup_fee`（`R101` · 承 §31.1 R-9-14 ③(b)）
-- ============================================================================
-- 依据（逐字）：`docs/data-layer.spec.md` v0.21 §31.1 R-9-14 ③(b)：「**`−1` 归属白名单追加**：
--   `R101` 的 `−1` 增方（credit）白名单须追加 `checkin_makeup_fee` —— 现取 `0019:63` `-1 credit IN
--   ('trade_fee','listing_fee','currency_create_fee','job_fee','listing_deposit')` + `backend-ts/src/ledger.ts`
--   的 `PLATFORM_KIND_WHITELIST['-1'].credit` 同轮加入（**手法逐字照 `0019` 对 `listing_deposit` 的加法式扩展**）。」
--   + §31.5 第 4/7 行（`$` 归属 = `uid = −1`；`−1` 白名单须追加）。
--
-- 为什么放在本文件（而非 `0028`）：`0028` 的内容契约**写死**为「只改 `ledger_kind_enum` 一个约束」
--   （§31.1 R-9-14 ② 末条）⇒ 白名单函数扩展**不得**落 `0028`。补签 `$` 腿（`checkin_makeup_fee`）由本
--   迁移（batt/签到/补签业务面）承载 ⇒ 其账本腿所需的 `−1` 白名单扩展**同轮**落本文件（沿 `0019` 先例）。
--
-- 本文件做什么（**行为改变只允许落在新迁移** ⇒ 照 `0019` 先例做**加法式**扩展）：
--   1) `CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(...)` —— **仅**把 `-1` 的
--      `credit` 集合加上 `'checkin_makeup_fee'`；**其余每一格逐字不变**（`0` / `-2` / `-3` / 兜底；
--      `-1` 的 `debit` 仍恒 false）。
--   2) 自检（**双向**，缺一不算通过）：正向（新增格 + 既有五格未丢）／负向（`-1` credit 非白名单 kind
--      仍拒、`-1` 任何 debit 仍拒、`-2`/`-3` 既有格未被顺带放宽）。
--
-- 本文件**不**：新增 / 删除任何 kind（关闭集扩容归 `0028`）；不改 `-2` / `-3` / `0` 任何一格；
--   不改 `ledger_post_event` 函数体；不新增错误码。
CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(
  p_uid bigint, p_kind text, p_dir text
) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_ok boolean;
BEGIN
  v_ok := CASE p_uid::text
    WHEN '0'  THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('mint', 'transfer', 'reversal')
                                    ELSE p_kind IN ('transfer', 'burn', 'reversal') END
    -- 🆕 0008（P2 裁定 #11）：`-1` = 平台收入账户 ⇒ 无邀请人时的手续费入这里
    -- 🆕 0019（P4-B3a-FIX-A / R31 v0.2 + DL67 + DL88）：`-1` 再接纳 `listing_deposit`（上市即消耗、进平台收入、不可退）
    -- 🆕 0029（P9② / data-layer v0.21 §31.1 R-9-14 ③(b) + §31.5 + R-9-3）：`-1` 再接纳 `checkin_makeup_fee`
    --    （补签 100 `$` 手续费入平台收入、**不真 burn**）。其余格与 0019 逐字相同：`-1` 的 debit 仍恒 false。
    WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit', 'checkin_makeup_fee')
                                    ELSE false END
    WHEN '-2' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('job_fee')
                                    ELSE p_kind IN ('commission') END
    WHEN '-3' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('hold_forfeit')
                                    ELSE p_kind IN ('hold_forfeit', 'transfer') END
    ELSE NULL
  END;
  IF v_ok IS NULL OR v_ok THEN RETURN; END IF;
  PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
    'uid', p_uid::text, 'kind', p_kind,
    'reason', CASE p_dir WHEN 'debit' THEN 'PLATFORM_DEBIT_FORBIDDEN' ELSE 'PLATFORM_CREDIT_KIND_FORBIDDEN' END));
END $$;

COMMENT ON FUNCTION ledger_assert_platform_mutation(bigint, text, text) IS
  'R101 平台账户 kind 白名单（0004 原版 + 0008 扩 `-1` credit 加 `job_fee` + 0019 扩 `-1` credit 加 `listing_deposit` + 0029 扩 `-1` credit 加 `checkin_makeup_fee`；其余格逐字不变）。';

-- ---------------------------------------------------------------------------
-- §G 自检：正向 + **负向**（缺一不算通过；手法逐字照 0019:83-166）
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_msg text;
  v_n   int;
BEGIN
  -- ============ 正向：扩展后的白名单格必须全部放行 ============
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'checkin_makeup_fee', 'credit');   -- 🆕 本次新增格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'credit');            -- 既有格（不许丢）
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_fee', 'credit');          -- 既有格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'currency_create_fee', 'credit');  -- 既有格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'credit');              -- 既有格
  PERFORM ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit');      -- 既有格（0019 引入，不许丢）
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'commission', 'debit');
  PERFORM ledger_assert_platform_mutation(-2::bigint, 'job_fee', 'credit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'transfer', 'debit');
  PERFORM ledger_assert_platform_mutation(-3::bigint, 'hold_forfeit', 'credit');

  -- ============ 负向 ①：`-1` 的 credit 仍必须拒「不在扩展后白名单里的 kind」 ============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -1 credit commission WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'LEDGER_RESERVED_UID' THEN
      RAISE EXCEPTION '0029 §G self-check FAILED: -1 credit commission rejected with %, expected LEDGER_RESERVED_UID', v_msg;
    END IF;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'purchase', 'credit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -1 credit purchase WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 负向 ②：`-1` 的任何 debit 仍必须拒（「debit 恒 false」不许被松掉）============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'checkin_makeup_fee', 'debit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -1 debit checkin_makeup_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-1::bigint, 'trade_fee', 'debit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -1 debit trade_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 负向 ③：只该动 `-1` 的 credit 一格 —— 其它两格抽查必须仍拒 ============
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'checkin_makeup_fee', 'credit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -2 credit checkin_makeup_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-3::bigint, 'checkin_makeup_fee', 'credit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -3 credit checkin_makeup_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;
  BEGIN
    PERFORM ledger_assert_platform_mutation(-2::bigint, 'trade_fee', 'credit');
    RAISE EXCEPTION '0029 §G self-check FAILED: -2 credit trade_fee WAS NOT rejected';
  EXCEPTION WHEN SQLSTATE 'LD021' THEN NULL;
  END;

  -- ============ 不变式：kind 关闭集仍恰 1 个 CHECK（本段不涉其值集；值集扩容归 0028）============
  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid = 'public.ledger_entry'::regclass AND conname = 'ledger_kind_enum' AND contype = 'c';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0029 §G self-check FAILED: expected exactly 1 ledger_kind_enum CHECK, got %', v_n;
  END IF;

  RAISE NOTICE '0029 §G self-check OK: -1 credit 追加 checkin_makeup_fee（既有五格未丢）+ 负向三条（非白名单 credit / 任意 debit / 其它平台格）皆拒';
END $$;


-- ============================================================================
-- §G2 `ledger_kind_ok` 关闭集 20 → 21（★ `R-9-21` · 承 §31.1 `R-9-14`；本块 = §G 第 2 件事）
-- ============================================================================
-- 依据（逐字）：Zang 裁定 **`R-9-22`**：`0029 §G` = 「`−1` credit 白名单 + **`ledger_kind_ok` 扩 21**
--   （+ ± 自检）」；**`R-9-21`**：kind 闭集现取**已知三处编码**（① `ledger_kind_enum` CHECK
--   ② `ledger_kind_ok` ③ TS `LEDGER_KINDS`）—— **`ledger_kind_ok`（`0004:421`）必须扩到 21**
--   （含 `checkin_makeup_fee`），否则 `ledger_post_event` 的 **`entries` 路径**（`0004:788`
--   `NOT ledger_kind_ok(COALESCE(v_e_kind,''))`）会拒补签腿 ⇒ **交付不成立**。
--
-- ★ 穷举扫面（全仓 + `migrations/`；正则 `ledger_kind_ok|ledger_kind_enum|LEDGER_KINDS|
--   PLATFORM_KIND_WHITELIST|checkin_makeup_fee`）结论：**全闭集编码恰三处**（① 归 `0028`；
--   ② 本块；③ `src/ledger.ts` 已完成）；其余命中皆为**派生子集 / 只读调用 / 一次性 apply
--   自检 / `.p*-artifacts` 弃件**，无独立全闭集值集（逐处清单见实现报告）。
--
-- 手法（逐字）：`CREATE OR REPLACE FUNCTION`（`0004:421-430` 原形态逐字保留，**仅在 IN 列表
--   末位追加 1 值**）；函数体 = `LANGUAGE sql IMMUTABLE`（体内**无 DDL** · DL142 相邻）；
--   `p_frozen_settle` 第二支**一字不动**（`checkin_makeup_fee` **不属**冻结结算族 ⇒ 不得进第二支）。
CREATE OR REPLACE FUNCTION ledger_kind_ok(p_kind text, p_frozen_settle boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal',
    'checkin_makeup_fee')
  AND (NOT p_frozen_settle OR p_kind IN ('job_payout','purchase','trade','hold_forfeit'))
$$;

COMMENT ON FUNCTION ledger_kind_ok(text, boolean) IS
  'kind 关闭集（P9② / R-9-21）：20 → 21，末位追加 checkin_makeup_fee；与 0028 的 ledger_kind_enum CHECK / src/ledger.ts LEDGER_KINDS 三处同集。p_frozen_settle 第二支一字不动。';

-- ---------------------------------------------------------------------------
-- §G2 自检（正向：21 值全接纳 + 新增值在场；负向：闭集外必拒 + 冻结族第二支未放宽）
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_bad int;
BEGIN
  -- 正向 ①：新增值必被接纳
  IF NOT ledger_kind_ok('checkin_makeup_fee') THEN
    RAISE EXCEPTION '0029 §G2 self-check FAILED: ledger_kind_ok(checkin_makeup_fee) = false';
  END IF;
  -- 正向 ②：既有 20 值逐字逐真（防闭集丢值）
  SELECT count(*) INTO v_bad FROM unnest(ARRAY[
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal',
    'checkin_makeup_fee']) AS t(k)
   WHERE NOT ledger_kind_ok(t.k);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0029 §G2 self-check FAILED: % of the 21 expected kinds rejected by ledger_kind_ok', v_bad;
  END IF;
  -- 负向 ①：闭集外的值（含 0003 删除的 kind / 从未存在的 kind / 空串）必拒
  IF ledger_kind_ok('listing_deposit_refund') OR ledger_kind_ok('listing_deposit_forfeit')
     OR ledger_kind_ok('market_hold') OR ledger_kind_ok('') OR ledger_kind_ok('made_up_kind') THEN
    RAISE EXCEPTION '0029 §G2 self-check FAILED: ledger_kind_ok accepted a kind outside the 21-value closed set';
  END IF;
  -- 负向 ②：冻结结算族第二支未放宽（checkin_makeup_fee 在 p_frozen_settle=true 下必拒）
  IF ledger_kind_ok('checkin_makeup_fee', true) THEN
    RAISE EXCEPTION '0029 §G2 self-check FAILED: checkin_makeup_fee wrongly accepted under frozen_settle';
  END IF;
  -- 负向 ③：第二支既有成员仍在（job_payout / purchase / trade / hold_forfeit）
  IF NOT (ledger_kind_ok('job_payout', true) AND ledger_kind_ok('purchase', true)
          AND ledger_kind_ok('trade', true) AND ledger_kind_ok('hold_forfeit', true)) THEN
    RAISE EXCEPTION '0029 §G2 self-check FAILED: frozen_settle 第二支既有成员丢值';
  END IF;
  RAISE NOTICE '0029 §G2 self-check OK: ledger_kind_ok 关闭集 = 21（+checkin_makeup_fee），既有 20 未丢，闭集外必拒，冻结族第二支未放宽';
END $$;
