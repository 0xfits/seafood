-- ============================================================================
-- 0073_project_vault.sql · 项目金库（project_vault）—— 领薪次币腿的资金来源
-- ----------------------------------------------------------------------------
-- 权威口径：Kevin 2026-10-23 裁定 ②（A 方案）
--   「领薪的**次币腿**不再从项目 owner 个人 account 扣，改从**项目金库**扣；
--     用户可在项目页给金库充值；项目页显示金库余额与充值入口。」
--   背景（生产事实）：`project_id=5` 的次币腿要发 1 ₿，而 owner uid=1 在 `account` 表**零行**
--   ⇒ 每次领取都被 `project_wage_pool_insufficient` 回滚（`project_wage_claim` 生产 0 行）。
--
-- 本迁移做什么（**纯加法**：一张新表 + 一个 updated 触发器）
--   ① `public.project_vault(project_id, cid, balance, time_created, time_updated)`
--      · 主键 `(project_id, cid)` —— 一个项目一币种一行；**无行 = 该币种金库为空**（读口只列有行的 cid）；
--      · `balance numeric NOT NULL DEFAULT 0` + `CHECK (balance >= 0)` ⇒ 金库不透支到负数
--        （领薪侧另有 `UPDATE … WHERE balance >= $n` 的行级守卫，CHECK 只作兵底）；
--      · 两个 FK 沿仓内惯例（`0063` project_worker / project_wage_claim 同体例）：
--        `project_id → public.project(project_id)`、`cid → public.currency(cid)`；
--      · `time_updated` 复用 `0017` 的 `platform_config_touch_updated()` 触发器（不造第二套）。
--   ② 尾部 apply-time 自检（任一不满足 ⇒ RAISE ⇒ 整文件回滚、不写版本行）：
--      表在场 · 五列形状 · PK 在场 · balance CHECK 在场 · 两个 FK 在场 · 触发器在场 ·
--      **拒绝面**：真实 project/cid 试插 `balance = -1` ⇒ 必须当场 23514（接受即红）。
--
-- 本迁移**不**做什么（硬边界）
--   · 不改任何既有表一列（`project` / `project_wage_claim` / `account` 一字不动）；
--   · **不新增 ledger kind**：金库两腿走现取 24 值闭集内的 `transfer`
--     （金库本体不在 `account` 表里 —— 台账侧以**平台 uid 0 账户作金库托管对手方**，
--      充值 = 用户 −N / uid 0 +N，领薪 = uid 0 −N / 用户 +N，净额恒 0 ⇒ 零新 kind、
--      `s9-ledger-kind-closure` 四语键集零变化）；
--   · 不写业务种子数据（前置发放 = `backend-ts/scripts/project-vault-seed.ts`，**默认 dry-run**，
--     由派单方显式 `--apply` 跑）；
--   · 不接路由（路由注册点在 `src/index.ts` 的另一单里加）。
--
-- 幂等（DL48）：CREATE TABLE IF NOT EXISTS / DROP TRIGGER IF EXISTS + CREATE TRIGGER /
--   尾部 DO 块自检；本文件**不含** BEGIN/COMMIT（由 `scripts/migrate.ts` 的单文件事务包裹）。
--   注释里不出现成对美元定界符字面（切分器按它切换 in-dollar 态）⇒ 统一写「DO 块」。
-- ============================================================================

-- ============================================================================
-- ① 表 public.project_vault
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_vault (
  project_id   bigint      NOT NULL,
  cid          bigint      NOT NULL,
  balance      numeric     NOT NULL DEFAULT 0,
  time_created timestamptz NOT NULL DEFAULT now(),
  time_updated timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_vault_pk PRIMARY KEY (project_id, cid),
  CONSTRAINT project_vault_project_fk FOREIGN KEY (project_id) REFERENCES public.project(project_id),
  CONSTRAINT project_vault_cid_fk FOREIGN KEY (cid) REFERENCES public.currency(cid),
  CONSTRAINT project_vault_balance_check CHECK (balance >= 0)
);

COMMENT ON TABLE public.project_vault IS
  '项目金库（0073 · Kevin 2026-10-23 ②）：按 (project_id, cid) 存项目自有的次币余额，'
  '领薪的次币腿从这里扣（不再扣 owner 个人 account）、用户可充值。台账侧以平台 uid 0 账户作托管对手方'
  '（充值 用户−N/uid0+N；领薪 uid0−N/用户+N），金库本体不在 account 表 ⇒ 零新 kind。'
  '无行 = 该币种金库为空；balance 恒非负（CHECK 兜底 + 领取侧行级守卫）。';

COMMENT ON COLUMN public.project_vault.balance IS
  '金库余额（**最小单位**整数，与 account.balance / ledger_entry.delta 同一刻度）—— 与 wage_currency_amount
   （用户输入十进制）之间的换算是服务层按 currency.decimals 做的（精度超最小单位 ⇒ 400，不静默四舍五入）。';

-- time_updated 自动刷新（复用 0017 的 platform_config_touch_updated：通用函数、无表专属逻辑）
DROP TRIGGER IF EXISTS trg_project_vault_touch_updated ON public.project_vault;
CREATE TRIGGER trg_project_vault_touch_updated
BEFORE UPDATE ON public.project_vault
  FOR EACH ROW EXECUTE FUNCTION public.platform_config_touch_updated();

-- ============================================================================
-- 尾部自检（apply 后即验；任一不满足 ⇒ RAISE ⇒ 整文件事务回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_cols      int;
  v_pk        int;
  v_chk       text;
  v_fk        int;
  v_trg       int;
  v_neg_uid   bigint;
  v_probe_pid bigint;
  v_probe_cid bigint;
  v_rejected  boolean := false;
BEGIN
  -- ① 表在场且恰 5 列
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project_vault';
  IF v_cols <> 5 THEN
    RAISE EXCEPTION '0073 self-check FAILED: project_vault expect 5 columns, got %', v_cols;
  END IF;

  -- ② 列形状：balance numeric NOT NULL / 两时间列 timestamptz NOT NULL
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project_vault'
     AND ((column_name = 'project_id' AND data_type = 'bigint' AND is_nullable = 'NO')
       OR (column_name = 'cid' AND data_type = 'bigint' AND is_nullable = 'NO')
       OR (column_name = 'balance' AND data_type = 'numeric' AND is_nullable = 'NO')
       OR (column_name = 'time_created' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO')
       OR (column_name = 'time_updated' AND data_type = 'timestamp with time zone' AND is_nullable = 'NO'));
  IF v_cols <> 5 THEN
    RAISE EXCEPTION '0073 self-check FAILED: project_vault column shape mismatch (% of 5 matched)', v_cols;
  END IF;

  -- ③ 主键 = (project_id, cid)
  SELECT count(*) INTO v_pk
    FROM pg_constraint
   WHERE conrelid = 'public.project_vault'::regclass AND contype = 'p'
     AND conname = 'project_vault_pk';
  IF v_pk <> 1 THEN
    RAISE EXCEPTION '0073 self-check FAILED: project_vault_pk missing (expect 1, got %)', v_pk;
  END IF;

  -- ④ balance 非负 CHECK 在场且约束体带 >= 0
  SELECT pg_get_constraintdef(oid) INTO v_chk
    FROM pg_constraint
   WHERE conrelid = 'public.project_vault'::regclass AND conname = 'project_vault_balance_check';
  -- PG 会把 `balance >= 0` 规范化成 `CHECK ((balance >= (0)::numeric))` ⇒ 按正则判两种形态
  IF v_chk IS NULL OR v_chk !~ 'balance\s*>=\s*\(?\s*0' THEN
    RAISE EXCEPTION '0073 self-check FAILED: project_vault_balance_check 缺非负约束体，实际=%', COALESCE(v_chk, '<null>');
  END IF;

  -- ⑤ 两个 FK 在场（project / currency）
  SELECT count(*) INTO v_fk
    FROM pg_constraint
   WHERE conrelid = 'public.project_vault'::regclass AND contype = 'f';
  IF v_fk <> 2 THEN
    RAISE EXCEPTION '0073 self-check FAILED: project_vault expect 2 FKs (project, currency), got %', v_fk;
  END IF;

  -- ⑥ time_updated 触发器在场
  SELECT count(*) INTO v_trg
    FROM pg_trigger
   WHERE tgrelid = 'public.project_vault'::regclass
     AND tgname = 'trg_project_vault_touch_updated' AND NOT tgisinternal;
  IF v_trg <> 1 THEN
    RAISE EXCEPTION '0073 self-check FAILED: trg_project_vault_touch_updated missing';
  END IF;

  -- ⑦ 拒绝面：拿真实 project + 真实 cid 试插 balance = -1 ⇒ 期望 check_violation；
  --    实现纪律：DO 块（= PL/pgSQL 函数体）里**不允许** SAVEPOINT / ROLLBACK TO SAVEPOINT
  --    （42601）⇒ 用嵌套 BEGIN … EXCEPTION 子事务，只捕 23514，其余异常原样上抛。
  SELECT p.project_id, c.cid INTO v_probe_pid, v_probe_cid
    FROM public.project AS p
   CROSS JOIN (SELECT cid FROM public.currency ORDER BY cid LIMIT 1) AS c
   ORDER BY p.project_id
   LIMIT 1;
  IF v_probe_pid IS NOT NULL AND v_probe_cid IS NOT NULL THEN
    BEGIN
      INSERT INTO public.project_vault (project_id, cid, balance)
      VALUES (v_probe_pid, v_probe_cid, -1);
      RAISE EXCEPTION '0073 self-check FAILED: negative balance was accepted — CHECK not enforced';
    EXCEPTION
      WHEN check_violation THEN
        v_rejected := true;
      WHEN unique_violation THEN
        -- 自检不写脏数据：万一行已存在（重复 apply 且库里真有该行），用 UPDATE 试负值
        BEGIN
          UPDATE public.project_vault SET balance = -1
           WHERE project_id = v_probe_pid AND cid = v_probe_cid;
          RAISE EXCEPTION '0073 self-check FAILED: negative balance was accepted — CHECK not enforced';
        EXCEPTION
          WHEN check_violation THEN
            v_rejected := true;
        END;
    END;
    IF NOT v_rejected THEN
      RAISE EXCEPTION '0073 self-check FAILED: negative balance rejection probe did not run';
    END IF;
  END IF;

END $$;
