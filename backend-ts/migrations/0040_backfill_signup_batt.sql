-- ============================================================================
-- 0040_backfill_signup_batt.sql · D2 存量用户补发（Zang 裁定 R-9-81）
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · 需求 **§6.2①**「新用户注册完成**即刻到账 30 batt**」= **P9⑤（今日）才实现的注册腿**
--     （`grantSignupInviteBatt` · `backend-ts/src/database.ts:4667`；写入面 = `batt_account` + `batt_entry`）
--     ⇒ **P9⑤ 之前注册的存量用户全无这 30 batt** ⇒ 被 P9② 承接门槛闸挡住（实例 `uid 970213` batt = 0）。
--   · Zang 裁定 **R-9-81**（D2 定档 = Kevin 拍板「① 追溯补发」）：
--       一次性给**全部存量用户** `+30 batt`；
--       目标集合 = 「**无 `public.batt_account` 行 ∧ 无 `reason='invite_signup'` 的 `public.batt_entry` 行**」
--                  的**全部用户**；
--       幂等键   = `biz:backfill:invite-signup:<uid>`（写入 `batt_entry.idempotency_key`）；
--       `batt_entry.reason` = `invite_signup`（与 §6.2① **同发放名目** ⇒ 总量口径一致）
--                            + `memo` 注明「**存量补发**」；
--       封顶     = `BATT_CAP_HARD_MAX`（`database.ts:281` = **100**）；
--       必须走**既有 batt 写入面形态**（`batt_account` + `batt_entry` **同一语句/同一事务**）；
--       形态 = **纯 DML 迁移** + **apply-time 自检** + 独立 `R-9-24` 真跑自证（探针在 `.p8s6-impl/`）；
--       **不得改任何既有行**。
--
-- 现取锚（2026-10-03 · 只读探针 `.p8s6-impl/d2-count-ro.ts` 真跑读数）：
--   · `public.batt_account`（`0029:45-54`；现取）：
--       `uid bigint` PK + FK(users) · `batt integer NOT NULL DEFAULT 0`
--       · `CONSTRAINT batt_account_range CHECK (batt BETWEEN 0 AND 100)` · `time_created/time_updated timestamptz`
--       · 触发器 `trg_batt_account_touch_updated`（**BEFORE UPDATE** 刷 `time_updated`，仅 UPDATE 触发）。
--   · `public.batt_entry`（`0029:79-94`；现取）：
--       `txid bigint GENERATED ALWAYS AS IDENTITY`（PK）· `uid bigint NOT NULL`（**无 FK**）
--       · `delta integer NOT NULL`（`CHECK delta <> 0`）· `batt_after integer NOT NULL`（`CHECK 0..100`）
--       · `reason text NOT NULL` · `idempotency_key text NOT NULL`（`UNIQUE`）
--       · `ref_type text` / `ref_id bigint` / `memo text NOT NULL DEFAULT ''` / `time_created timestamptz`
--       · 触发器 `trg_batt_entry_append_only`（**BEFORE UPDATE OR DELETE** 无条件 `RAISE`）
--         ⇒ **INSERT 允许**（本迁移只用 INSERT；UPDATE / DELETE 由该触发器在库面直接拒）。
--   · `BATT_CAP_HARD_MAX` = **100**（`database.ts:281`）。
--   · 注册腿写入语句形态（`database.ts:4675-4700`，逐行）＝ **单语句 CTE**：
--       ① `prior` = 幂等闸（`batt_entry.idempotency_key = <key>`）→ 在场则整条零副作用；
--       ② `cur`   = `COALESCE((SELECT batt FROM batt_account WHERE uid=…), 0)`（fail-closed）；
--       ③ `target`= `LEAST(cur + signupBatt, BATT_CAP_HARD_MAX)`（封顶）；
--       ④ `ins`   = `INSERT INTO batt_account … ON CONFLICT (uid) DO UPDATE SET batt = EXCLUDED.batt`；
--       ⑤ `entry` = `INSERT INTO batt_entry(uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)`
--                   `reason='invite_signup'` · 幂等键 `biz:invite:signup:<uid>` · `delta = after − cur`。
--       ⇒ **batt 面零 kind**（不占 `ledger_kind_enum`）。
--   · 目标集合逐计数（现取）：**用户总数 56 · 无 `batt_account` 行 54 · 无 `invite_signup` entry 56**
--     ⇒ **目标 = 54**；**差 = 2**（2 位已有 `batt_account` 行的签到用户被条件①排除）。
--     `batt_account` 现存 2 行 / `batt_entry` 现存 2 行（`reason='checkin'`）。
--
-- 本迁移**不做什么**：
--   · 不新增 / 删除 kind（batt 面零 kind）；不新增错误码；
--   · 不改 `0001`–`0039` 任何文件字节；**不改任何既有 `batt_account` / `batt_entry` 行**（只 INSERT 新行）；
--   · 不新增表 / 列 / 约束 / 索引 / 触发器 / 函数（**纯 DML**）；不改 `app_config`；
--   · 不 `DELETE` / `TRUNCATE` / `DROP` 业务数据。
--
-- 形态说明（逐字对齐 R-9-81）：本文件 = **单个 `DO` 块**（体内**只有 SELECT / INSERT**，**无任何 DDL**）；
--   §A 执行前快照 → §B 单语句 CTE 补发（既有写入面形态）→ §C 逐项 self-check（不通过 ⇒ 整迁移回滚、
--   **不写版本行**）。注册腿用 `ON CONFLICT (uid) DO UPDATE`（可变余额）；本补发目标集合与既有行**按构造
--   互斥**（条件① = 无 `batt_account` 行），为兑现「**不得改任何既有行**」的硬约束，本文件**改**为
--   `ON CONFLICT (uid) DO NOTHING`（**更强**：即使出现病态冲突也不动既有行）。
--   self-check 的「发放行数」口径 = **本次运行新插入行数**（取自 CTE `RETURNING`）⇒ **重跑零新增不误报**；
--   「幂等键唯一 / 归属行余额」= 全表读（重跑免疫）。
-- ============================================================================

DO $$
DECLARE
  -- ---- 常量（与 §6.2① / BATT_CAP_HARD_MAX 同值；本迁移不改配置面，取值硬编码并自检对齐）----
  c_signup_batt constant int  := 30;   -- §6.2① 注册腿 signupBatt 默认（INVITE_REWARD_POLICY_DEFAULTS）
  c_cap         constant int  := 100;  -- BATT_CAP_HARD_MAX（database.ts:281）
  c_key_prefix  constant text := 'biz:backfill:invite-signup:';
  c_memo        constant text := '存量补发（R-9-81 · D2）：P9⑤ 前注册用户一次性补发 +30 batt';
  -- ---- 快照 / 读数 ----
  v_target_n            int;
  v_target_md5          text;
  v_acct_before_n       int;
  v_entry_before_n      int;
  v_acct_before_md5     text;   -- 既有 batt_account 行（= 非本次补发归属）执行前指纹
  v_entry_before_md5    text;   -- 既有 batt_entry  行（= 非本次补发幂等键）执行前指纹
  v_ins_acct            int;    -- **本次运行**新增 batt_account 行数
  v_ins_entry           int;    -- **本次运行**新增 batt_entry   行数
  v_new_bad_delta       int;    -- 本次新行中 delta <> 30
  v_new_bad_reason      int;    -- 本次新行中 reason <> invite_signup
  v_new_bad_key         int;    -- 本次新行中幂等键 <> biz:backfill:invite-signup:<uid>
  v_new_bad_memo        int;    -- 本次新行中 memo <> 存量补发口径
  v_new_bad_after       int;    -- 本次新行中 batt_after <> 30
  v_acct_after_n        int;
  v_entry_after_n       int;
  v_acct_after_md5      text;
  v_entry_after_md5     text;
  v_backfill_all_n      int;    -- 全表补发行数（含历史次，重跑免疫）
  v_backfill_distinct   int;    -- 全表补发去重幂等键数
  v_bad_acct_batt       int;    -- 补发归属 batt_account 行中 batt <> 30 的条数
  v_remaining_target    int;    -- 迁移后仍满足目标条件者（应为 0 = 完备性）
BEGIN
  -- ==========================================================================
  -- §A 执行前快照
  -- ==========================================================================
  -- A1 目标集合（执行前）＝ 无 batt_account 行 ∧ 无 invite_signup entry（逐字兑现 R-9-81 双重条件）
  SELECT count(*)::int,
         md5(coalesce(string_agg(t.uid::text, ',' ORDER BY t.uid), ''))
    INTO v_target_n, v_target_md5
    FROM (
      SELECT u.uid
        FROM public.users AS u
       WHERE NOT EXISTS (SELECT 1 FROM public.batt_account AS b WHERE b.uid = u.uid)
         AND NOT EXISTS (SELECT 1 FROM public.batt_entry   AS e
                          WHERE e.uid = u.uid AND e.reason = 'invite_signup')
    ) AS t;

  -- A2 行数基线
  SELECT count(*)::int INTO v_acct_before_n  FROM public.batt_account;
  SELECT count(*)::int INTO v_entry_before_n FROM public.batt_entry;

  -- A3 既有行逐字指纹（排除「本次补发归属」——首跑时无补发行 ⇒ 即全表；重跑免疫）
  SELECT md5(coalesce(string_agg(b.uid::text || ':' || b.batt::text || ':'
                                   || b.time_created::text || ':' || b.time_updated::text,
                                 ',' ORDER BY b.uid), ''))
    INTO v_acct_before_md5
    FROM public.batt_account AS b
   WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry AS e
                      WHERE e.uid = b.uid AND e.idempotency_key LIKE c_key_prefix || '%');

  SELECT md5(coalesce(string_agg(e.txid::text || ':' || e.uid::text || ':' || e.delta::text || ':'
                                   || e.batt_after::text || ':' || e.reason || ':' || e.idempotency_key,
                                 ',' ORDER BY e.txid), ''))
    INTO v_entry_before_md5
    FROM public.batt_entry AS e
   WHERE e.idempotency_key NOT LIKE c_key_prefix || '%';

  -- ==========================================================================
  -- §B 存量补发（**单语句 CTE** · 既有 batt 写入面形态 · batt 面零 kind）
  --   与注册腿（database.ts:4675-4700）同形态；差异仅为「按集合发放 + DO NOTHING（不改既有行）」。
  --   target 条件①保证 cur = 0 ⇒ after = LEAST(30, 100) = 30 ⇒ delta = after − cur = 30。
  -- ==========================================================================
  WITH target AS (
    SELECT u.uid,
           LEAST(COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = u.uid), 0)
                 + c_signup_batt, c_cap)::int AS after
      FROM public.users AS u
     WHERE NOT EXISTS (SELECT 1 FROM public.batt_account AS b WHERE b.uid = u.uid)
       AND NOT EXISTS (SELECT 1 FROM public.batt_entry   AS e
                        WHERE e.uid = u.uid AND e.reason = 'invite_signup')
  ),
  ins AS (
    INSERT INTO public.batt_account (uid, batt)
    SELECT t.uid, t.after FROM target AS t
    ON CONFLICT (uid) DO NOTHING            -- ★ 不改既有行（比注册腿 DO UPDATE 更严）
    RETURNING uid, batt
  ),
  entry AS (
    INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
    SELECT i.uid, i.batt, i.batt, 'invite_signup',
           c_key_prefix || i.uid::text, 'invite', i.uid, c_memo
      FROM ins AS i
    ON CONFLICT (idempotency_key) DO NOTHING -- ★ 幂等键唯一；冲突零副作用
    RETURNING uid, delta, batt_after, reason, idempotency_key, memo
  )
  SELECT (SELECT count(*)::int FROM ins)::int,
         (SELECT count(*)::int FROM entry)::int,
         (SELECT count(*)::int FROM entry WHERE delta         <> c_signup_batt)::int,
         (SELECT count(*)::int FROM entry WHERE reason        <> 'invite_signup')::int,
         (SELECT count(*)::int FROM entry WHERE idempotency_key <> c_key_prefix || uid::text)::int,
         (SELECT count(*)::int FROM entry WHERE memo          <> c_memo)::int,
         (SELECT count(*)::int FROM entry WHERE batt_after    <> LEAST(c_signup_batt, c_cap))::int
    INTO v_ins_acct, v_ins_entry,
         v_new_bad_delta, v_new_bad_reason, v_new_bad_key, v_new_bad_memo, v_new_bad_after;

  -- ==========================================================================
  -- §C apply-time 自检（不通过 ⇒ RAISE ⇒ 整迁移回滚、不写版本行）
  -- ==========================================================================
  -- C1 执行后行数
  SELECT count(*)::int INTO v_acct_after_n  FROM public.batt_account;
  SELECT count(*)::int INTO v_entry_after_n FROM public.batt_entry;

  -- C2 既有行逐字指纹（执行后；与 A3 同口径过滤）
  SELECT md5(coalesce(string_agg(b.uid::text || ':' || b.batt::text || ':'
                                   || b.time_created::text || ':' || b.time_updated::text,
                                 ',' ORDER BY b.uid), ''))
    INTO v_acct_after_md5
    FROM public.batt_account AS b
   WHERE NOT EXISTS (SELECT 1 FROM public.batt_entry AS e
                      WHERE e.uid = b.uid AND e.idempotency_key LIKE c_key_prefix || '%');

  SELECT md5(coalesce(string_agg(e.txid::text || ':' || e.uid::text || ':' || e.delta::text || ':'
                                   || e.batt_after::text || ':' || e.reason || ':' || e.idempotency_key,
                                 ',' ORDER BY e.txid), ''))
    INTO v_entry_after_md5
    FROM public.batt_entry AS e
   WHERE e.idempotency_key NOT LIKE c_key_prefix || '%';

  -- C3 全表补发行：幂等键唯一（读；重跑免疫）
  SELECT count(*)::int, count(DISTINCT e.idempotency_key)::int
    INTO v_backfill_all_n, v_backfill_distinct
    FROM public.batt_entry AS e
   WHERE e.idempotency_key LIKE c_key_prefix || '%';

  -- C4 补发归属 batt_account 行的余额（应为 LEAST(30,100) = 30）
  SELECT count(*) FILTER (WHERE b.batt <> LEAST(c_signup_batt, c_cap))::int
    INTO v_bad_acct_batt
    FROM public.batt_account AS b
   WHERE EXISTS (SELECT 1 FROM public.batt_entry AS e
                  WHERE e.uid = b.uid AND e.idempotency_key LIKE c_key_prefix || '%');

  -- C5 完备性：迁移后目标集合应为空
  SELECT count(*)::int INTO v_remaining_target
    FROM public.users AS u
   WHERE NOT EXISTS (SELECT 1 FROM public.batt_account AS b WHERE b.uid = u.uid)
     AND NOT EXISTS (SELECT 1 FROM public.batt_entry   AS e
                      WHERE e.uid = u.uid AND e.reason = 'invite_signup');

  -- ---- 断言（任一不成立 ⇒ 抛异常 ⇒ 整文件回滚）----
  -- ② 发放行数（本次运行）= 目标数
  IF v_ins_acct <> v_target_n THEN
    RAISE EXCEPTION '0040 self-check FAILED: batt_account 新增 % <> 目标数 %', v_ins_acct, v_target_n; END IF;
  IF v_ins_entry <> v_target_n THEN
    RAISE EXCEPTION '0040 self-check FAILED: batt_entry 新增 % <> 目标数 %', v_ins_entry, v_target_n; END IF;
  -- ④ 新行形态：delta=30 / reason=invite_signup / key 派生 / memo / batt_after
  IF v_new_bad_delta <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: % 条新补发行 delta <> 30', v_new_bad_delta; END IF;
  IF v_new_bad_reason <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: % 条新补发行 reason <> invite_signup', v_new_bad_reason; END IF;
  IF v_new_bad_key <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: % 条新补发行幂等键 <> biz:backfill:invite-signup:<uid>', v_new_bad_key; END IF;
  IF v_new_bad_memo <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: % 条新补发行 memo 未注明存量补发', v_new_bad_memo; END IF;
  IF v_new_bad_after <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: % 条新补发行 batt_after <> 30', v_new_bad_after; END IF;
  -- ③ 无重复幂等键（全表）
  IF v_backfill_distinct <> v_backfill_all_n THEN
    RAISE EXCEPTION '0040 self-check FAILED: 补发行重复幂等键（% 行 / % 唯一键）', v_backfill_all_n, v_backfill_distinct; END IF;
  IF v_bad_acct_batt <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: % 条补发归属 batt_account.batt <> 30', v_bad_acct_batt; END IF;
  -- ① 行数对拍：新增恰等于目标数（无越界写入）
  IF v_acct_after_n <> v_acct_before_n + v_target_n THEN
    RAISE EXCEPTION '0040 self-check FAILED: batt_account 行数 % <> 基线 % + 目标 %',
      v_acct_after_n, v_acct_before_n, v_target_n; END IF;
  IF v_entry_after_n <> v_entry_before_n + v_target_n THEN
    RAISE EXCEPTION '0040 self-check FAILED: batt_entry 行数 % <> 基线 % + 目标 %',
      v_entry_after_n, v_entry_before_n, v_target_n; END IF;
  -- ① 逐字未动：既有行 md5 前后一致
  IF v_acct_after_md5 IS DISTINCT FROM v_acct_before_md5 THEN
    RAISE EXCEPTION '0040 self-check FAILED: 既有 batt_account 行被改（md5 before=% / after=%）',
      v_acct_before_md5, v_acct_after_md5; END IF;
  IF v_entry_after_md5 IS DISTINCT FROM v_entry_before_md5 THEN
    RAISE EXCEPTION '0040 self-check FAILED: 既有 batt_entry 行被改（md5 before=% / after=%）',
      v_entry_before_md5, v_entry_after_md5; END IF;
  -- ⑤ 完备性：目标集合已被清空
  IF v_remaining_target <> 0 THEN
    RAISE EXCEPTION '0040 self-check FAILED: 迁移后仍余 % 位目标用户未发放', v_remaining_target; END IF;

  RAISE NOTICE '0040 self-check OK: 本次发放 % 位存量用户各 +30 batt（封顶 %）'
               '（batt_account +% / batt_entry +%；reason=invite_signup · key=biz:backfill:invite-signup:<uid>）；'
               '既有行 md5 未动（acct=% / entry=%）；全表补发 % 行幂等键唯一；remaining_target=0；目标 uid md5=%',
    v_target_n, c_cap, v_ins_acct, v_ins_entry,
    v_acct_after_md5, v_entry_after_md5, v_backfill_all_n, v_target_md5;
END $$;
