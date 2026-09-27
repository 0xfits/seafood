-- ============================================================================
-- 0011_commission_assert_closure_and_referral_depth_guard.sql
-- P2 独立质检（不通过）修复单 · 三条 DB 侧缺陷（F3 / F6 / F2）
-- ============================================================================
-- 权威口径
--   · `docs/commission.spec.md` v0.2 §3.2（depth 不变式）/ §3.3（绑定顺序）/ §10（幂等）
--     §13.2（借码 reason 表）/ §14.2（500 类 = 实现缺陷）；`docs/ledger.spec.md` v0.8 §14.1（闭集 33 码）。
--   · `docs/seafood.master-plan.md` §5.21 #3（Σ 断言失败落 `LD032` / defect）、§5.22 / §5.23。
--   · 独立质检（Neng）三项不通过：F3（延迟约束被提前 IMMEDIATE ⇒ 假报 LD032）、
--     F6（同一「已绑」事实两条路径两种码）、F2（陈旧 `referral.depth` 会继续传播）。
--
-- 本迁移做什么（**只替换两个函数**，不新建触发器、不改表结构、不新增错误码）
--   ① F3 · `CREATE OR REPLACE FUNCTION ledger_assert_commission_conservation()`
--      新增「**事件闭合**」判据：只有当**账户行已按事件终值写过**（= 该账户的分录序列已收尾）时
--      才把 `Σcommission(出 -2) <> Σjob_fee(入 -2)` 判负；否则视为「事件未完」跳过（NOTICE）。
--   ② F6 · `CREATE OR REPLACE FUNCTION referral_cycle_guard()` 新增 ③「child 已绑」前置检查：
--      裸 `INSERT` 与 `referral_bind()` 两条路径**同一码 + 同一 reason**
--      （`LD003` / `LEDGER_IDEMPOTENCY_CONFLICT` + `REFERRAL_ALREADY_BOUND`）。
--   ③ F2 · 同一函数新增 ⑥「父 `depth` 真实性」检查（父的存储 depth 必须 == 其真实跳数）。
--   ④ 末尾 apply-time `DO` 自检（结构 + 行为探针；子事务 + 哨兵回滚 ⇒ 零残留）。
--
-- ----------------------------------------------------------------------------
-- ① F3 详述：为什么不能只按「签名」（`commission_rows = 0 且 pool_in > 0`）跳过 —— 附反例
-- ----------------------------------------------------------------------------
-- F3 观测（Neng 一手）：`SET CONSTRAINTS ALL IMMEDIATE` 后调 `ledger_post_event(24 条分录)` ⇒
--   函数在**事件中途**被逐条触发 ⇒ 读到 `pool_in=1000 / commission_out=0 / commission_rows=0` ⇒
--   假报 `LD032 COMMISSION_SPLIT_SUM_MISMATCH`。根因确认：`ledger_post_event` 是**逐条** INSERT
--   （`0004` C6 ② 的 `FOR v_i IN 1..v_n - 1 LOOP`）⇒ 每条 = 一条独立 SPI 语句 ⇒ IMMEDIATE 模式下
--   每条结束都触发一次行级断言，而 DEFERRED（默认）在 COMMIT 才跑、此时事件已完整。
--
-- ⚠️ 被否决的修法（**本单已实测证伪，不得采用**）：「`commission_rows = 0 且 pool_in > 0` 即跳过」。
--   证伪反例（**完整事件**、非中途态，且必须继续落 LD032）：
--     `p2qa-01` 攻击 1.2 `pool-in-no-out` = 仅 2 条分录的事件
--     （雇主 `job_fee` frozen −1000 ⇒ **不相关**；`-2` `job_fee` +1000 ⇒ 相关且是该事件**最后一条**）
--     ⇒ 读数恰为 `pool_in = 1000 / commission_out = 0 / commission_rows = 0` —— 与 F3 的中途态
--     **逐字段相同**，但它是**事件已完整**、真的「有入无出」的 Σ 不符，必须判负。
--     ⇒ 单看「读数签名」无法区分「事件未完」与「事件完整但短缺」，故该修法会**静默放过真缺陷**。
--   另：F3 的中途态**不止一次**。修掉 `commission_rows = 0` 那一次后，下一条 `-2 commission`
--     减方仍会在中途态被判负（读数 `pool_in=1000 / commission_out=x_1 / commission_rows=1`）。
--     ⇒ 只堵「第一次」不算修好（本单 `scripts/p2w-00-p2fix-verify.ts` 用**修复前函数体**做了 A/B 取证）。
--
-- ⇒ 采用**事件闭合判据**（可观测、非猜测）：本仓既有不变式
--   `0001` §9.2 `account_guard()`：`account` 行恒等于该 `(uid, cid)` 的**最新一条** `ledger_entry` 快照
--   （`balance_after` / `frozen_after`），而 `0004` C6 ③ 把账户写回放在**全部分录插入之后**（R74
--   「先分录后账户」）。于是：
--     `account(NEW.uid, NEW.cid)` == 该账户最新分录快照  ⇔  **该账户的分录阶段已收尾**
--   · 事件中途（含被强制 IMMEDIATE 的每一次中途 firing）：账户行还没被写 ⇒ 快照不等 ⇒ **跳过**（免疫）；
--   · 事件收尾后（默认 DEFERRED 在 COMMIT；或已闭合后有人再 `SET CONSTRAINTS IMMEDIATE`）：相等 ⇒ **照常判负**。
--   · 相关行只可能是 `uid = -2`（出池方 / 入池方）⇒ 判据只读 `-2` 那一个账户，代价可忽略。
--   · 唯一「中途却相等」的值巧合 = 该 `-2` 账户本事件的净变动恰为 0（合法事件里只发生在**最后一条**减方，
--     此时 Σ 已完整 ⇒ 判定正确，不会假报）。
--
-- 诚实边界（**不得夸大**，逐条登记）
--   · 强制 `SET CONSTRAINTS … IMMEDIATE` 的会话里，本断言在**事件收尾之前**不再判负 —— 这正是 F3 的
--     要求（不假报）；代价是「IMMEDIATE 模式中途不会真报」。**默认 DEFERRED 路径的判负能力逐字不变**
--     （COMMIT 时事件必已闭合 ⇒ 判据恒成立 ⇒ 与 `0007` 行为一致；`p2d-00` §6 / `p2qa-01` 的全部
--     tamper 用例仍必须 LD032）。
--   · 闭合判据依赖「账户写回在分录之后」这一 `0004` 实现细节（R74）。若 `0004` 将来改为「边插分录边写账户」，
--     本判据会退化为「几乎总是跳过」⇒ 由 §D 自检的**行为探针**（闭合 ⇒ 必报 LD032）钉住，改坏即迁移失败。
--   · 本迁移**不追溯**任何历史行、不改任何数据。
--
-- ----------------------------------------------------------------------------
-- ② F6 / ③ F2 详述（检查顺序纪律，不得重排）
-- ----------------------------------------------------------------------------
--   ① 自指禁令 → ② 绑定串行化（`users` 两行 `FOR UPDATE`）→ ③ **新增**「child 已绑」→
--   ④ 祖先检查（环）→ ⑤ 「已有下级」守卫（`0010`）→ ⑥ **新增**「父 depth 真实性」→ ⑦ depth 计算
--   · ③ 放在 ② 之后：与本文件之外的 `referral_bind()`（`0007` §C：先锁再做已绑判定）**同序**，
--     使两条路径在并发下都靠同一串行化点，且**同码同 reason**。
--   · ③ 放在 ④ 之前：`referral_bind` 的优先级就是「已绑 409」先于图结构检查 ⇒ 两条路径**逐字一致**。
--     （既有 2-环判负用例 `X→Y` 后 `Y→X` 的 child `Y` 此刻**未绑** ⇒ ③ 不触发 ⇒ 仍报
--      `REFERRAL_CYCLE_REJECTED`，`p1t-00` 钉住的顺序与码不变。）
--   · ⑥ 放在 ⑤ 之后：`0010` 的「已有下级」reason 已被 `p1t-00` 用例① 钉住，保持它在前面 ⇒
--     两者同时成立时 reason 不变（不回归）。
--
-- 幂等：只 `CREATE OR REPLACE` 两个函数 + 幂等 `DO` ⇒ 可重跑（`migrate.ts` 重跑报 `skipped`）。
-- ============================================================================

-- ============================================================================
-- §A F3 · Σ 佣金守恒断言：加入「事件闭合」判据（`CREATE OR REPLACE`，**不改 `0007` 文件**）
-- ============================================================================
CREATE OR REPLACE FUNCTION ledger_assert_commission_conservation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_key      text;
  v_pool_in  bigint;
  v_paid_out bigint;
  v_comm_rows integer;
  v_fee_rows  integer;
  v_closed   boolean;
  v_acct_bal bigint;
  v_acct_frz bigint;
  v_new_bal  bigint;
  v_new_frz  bigint;
BEGIN
  -- 只读断言：不写任何表。仅对「相关行」触发（与 `0007` §D 的范围说明逐字相同）。
  IF NOT (NEW.kind = 'commission' AND NEW.uid = -2)
     AND NOT (NEW.kind = 'job_fee' AND NEW.uid = -2 AND NEW.delta > 0) THEN
    RETURN NULL;
  END IF;

  v_key := COALESCE(NEW.event_root_key, split_part(NEW.idempotency_key, '#', 1));

  SELECT COALESCE(sum(CASE WHEN e.uid = -2 AND e.kind = 'job_fee'    THEN e.delta  ELSE 0 END), 0),
         COALESCE(sum(CASE WHEN e.uid = -2 AND e.kind = 'commission' THEN -e.delta ELSE 0 END), 0),
         count(*) FILTER (WHERE e.uid = -2 AND e.kind = 'commission'),
         count(*) FILTER (WHERE e.uid = -2 AND e.kind = 'job_fee')
    INTO v_pool_in, v_paid_out, v_comm_rows, v_fee_rows
    FROM ledger_entry e
   WHERE COALESCE(e.event_root_key, split_part(e.idempotency_key, '#', 1)) = v_key;

  IF v_pool_in <> v_paid_out THEN
    -- ---- F3（本单新增）：先判「事件是否已闭合」，未完则跳过（对「被提前结算」免疫）
    -- 闭合 = 触发行的那个账户（相关行恒为 `-2`）已按事件终值写过：
    --   `account` 行 == 该 (uid,cid) 的最新一条 ledger_entry 快照（`0001` §9.2 `account_guard`），
    --   而账户写回在 `0004` C6 ③、顺序上**晚于**全部分录 ⇒ 相等即「该账户分录已收尾」。
    SELECT a.balance, a.frozen, s.balance_after, s.frozen_after
      INTO v_acct_bal, v_acct_frz, v_new_bal, v_new_frz
      FROM account a
      JOIN LATERAL (SELECT e2.balance_after, e2.frozen_after
                      FROM ledger_entry e2
                     WHERE e2.uid = NEW.uid AND e2.cid = NEW.cid
                     ORDER BY e2.txid DESC
                     LIMIT 1) s ON true
     WHERE a.uid = NEW.uid AND a.cid = NEW.cid;

    v_closed := COALESCE(v_acct_bal = v_new_bal AND v_acct_frz = v_new_frz, false);

    IF NOT v_closed THEN
      -- 事件未完（行级断言被 IMMEDIATE 提前触发）：豁免，不判负。可机读 NOTICE 便于取证。
      RAISE NOTICE 'ledger_assert_commission_conservation: event not closed, skip Σ check (key=%, account_uid=%, cid=%, pool_in=%, commission_out=%, commission_rows=%)',
        v_key, NEW.uid, NEW.cid, v_pool_in, v_paid_out, v_comm_rows;
      RETURN NULL;
    END IF;

    PERFORM ledger_raise('LEDGER_RECONCILE_MISMATCH', jsonb_build_object(
      'reason', 'COMMISSION_SPLIT_SUM_MISMATCH',
      'idempotency_key', v_key,
      'pool_in', v_pool_in::text, 'commission_out', v_paid_out::text,
      'commission_rows', v_comm_rows::text, 'job_fee_rows', v_fee_rows::text,
      'event_closed', 'true',
      'trigger_account_uid', NEW.uid::text, 'trigger_account_cid', NEW.cid::text));
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION ledger_assert_commission_conservation() IS
  'P2 CR80 + 0011：同一 event_root_key 的 Σcommission(出 -2) == Σjob_fee(入 -2)。只读断言，失败抛 LEDGER_RECONCILE_MISMATCH(defect/500)。0011 新增「事件闭合」判据：仅当 account(-2,cid) == 该账户最新分录快照（= 分录序列已收尾）时判负，否则视为事件未完而豁免（免疫 SET CONSTRAINTS IMMEDIATE 的中途假报；默认 DEFERRED 路径行为不变）。';


-- ============================================================================
-- §B F6 + F2 · 绑定守卫（`CREATE OR REPLACE`，替代 `0010` 版；**不改 `0007` / `0010` 文件**）
-- ============================================================================
-- 与 `0010` 版的差异只有两处（下方标「本单新增」）：③ 已绑检查、⑥ 父 depth 真实性检查。
-- 其余每一行（变量、注释、五段原有逻辑）逐字保留，便于「逐行 diff 只有新增」复核。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION referral_cycle_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_hit boolean;
  v_bound_parent     bigint;
  v_parent_stored_depth bigint;
  v_parent_true_depth   integer;
BEGIN
  -- ① 自指禁令（结构性闸是 `referral_no_self`；此处再挡一次以给出机读 reason）
  IF NEW.child_uid = NEW.parent_uid THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'reason', 'REFERRAL_SELF_BIND',
      'child_uid', NEW.child_uid::text, 'parent_uid', NEW.parent_uid::text));
  END IF;

  -- ② 绑定串行化点：同一事务内**先**锁 users 的两行（uid 升序）。
  --    目的：`A→B` 与 `B→A` 并发时两边争抢同一对 users 行 ⇒ 后者等前者提交后再跑 ③，
  --    此时新边已可见 ⇒ ③ 能拒绝（spec §3.3 ② 的设计意图）。
  PERFORM u.uid FROM users u WHERE u.uid IN (NEW.child_uid, NEW.parent_uid)
   ORDER BY u.uid FOR UPDATE;

  -- ③ 已绑检查（**本单新增 · F6**）：同一个 child 已经有行 ⇒ 与 `referral_bind()`（`0007` §C）
  --    的 409 分支**同码同 reason**（借码 `LEDGER_IDEMPOTENCY_CONFLICT` = `LD003` ⇒ bucket integrity
  --    ⇒ 409）。裸 `INSERT` 路径原先只会撞 `referral_pk`（`23505` / 无机读 reason）⇒ 同一业务事实
  --    两条路径两种码。放在 ② 之后 = 与 `referral_bind` 同一串行化点（并发下第二条也能看见已提交的行），
  --    放在 ④ 之前 = 与 `referral_bind` 的判定优先级一致（已绑 > 图结构）。
  SELECT r.parent_uid INTO v_bound_parent FROM referral r WHERE r.child_uid = NEW.child_uid;
  IF FOUND THEN
    PERFORM ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT', jsonb_build_object(
      'reason', 'REFERRAL_ALREADY_BOUND',
      'child_uid', NEW.child_uid::text,
      'bound_parent_uid', v_bound_parent::text,
      'requested_parent_uid', NEW.parent_uid::text,
      'path', 'trg_referral_cycle_guard'));
  END IF;

  -- ④ 祖先检查：断言**新父 P 不是 child C 的后代**（等价式 C ∉ ancestors(P)）：
  --    从 P 沿 parent_uid 上行，遇 C 即拒。步行上界 1000 只为防「库里已有环」时无限递归
  --    （不是防环机制本身；防环 = 本检查 + 串行化）。
  --    F2（本单）：同一次上行游走**顺带**算出 P 的真实跳数（`max(d)`），供 ⑥ 使用（不额外往返）。
  WITH RECURSIVE up AS (
    SELECT r.parent_uid AS cur, 1 AS d
      FROM referral r WHERE r.child_uid = NEW.parent_uid
    UNION ALL
    SELECT r.parent_uid, up.d + 1
      FROM referral r JOIN up ON r.child_uid = up.cur
     WHERE up.d < 1000
  )
  SELECT EXISTS (SELECT 1 FROM up WHERE cur = NEW.child_uid),
         COALESCE(max(d), 0)
    INTO v_hit, v_parent_true_depth
    FROM up;

  IF v_hit THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'reason', 'REFERRAL_CYCLE_REJECTED',
      'child_uid', NEW.child_uid::text, 'parent_uid', NEW.parent_uid::text));
  END IF;

  -- ⑤ 绑定协议守卫（`0010`）：被绑者 C **已有下级** ⇒ 拒绝（否则 C 的 depth 会就地失效）。
  --    机制：`depth` 在插入时算 `1 + depth(新父)`，而 `referral` INSERT-only ⇒ 不可修正。
  --      · 先绑叶、后绑父 ⇒ 叶的 `depth` 停在旧值 ⇒ **不变式失效且无法修**（spec §3.2 的现实后果）；
  --      · 真实协议（注册时绑一次、终身不变）= **先绑父、再绑子** ⇒ 每次绑定的 C 都还是叶 ⇒ 放行。
  --    ⇒ 可强制判据 = 「C 现在必须是叶（`referral` 里没有以 C 为 parent 的行）」。
  --    ⚠️ 位置纪律见文件头：必须在 ④ 之后（成环优先报 `REFERRAL_CYCLE_REJECTED`）、⑥ 之前。
  --       索引 `idx_referral_parent`（0007）正好支撑本谓词。
  IF EXISTS (SELECT 1 FROM referral r WHERE r.parent_uid = NEW.child_uid) THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'reason', 'REFERRAL_BIND_WOULD_STALE_DEPTH',
      'child_uid', NEW.child_uid::text, 'parent_uid', NEW.parent_uid::text,
      'protocol', 'BIND_PARENT_BEFORE_DESCENDANTS',
      'note', 'child already has descendants => binding a parent would retroactively invalidate their depth'));
  END IF;

  -- ⑥ 父 depth 真实性（**本单新增 · F2**）：守卫既然已经为环检测游走了祖先链，就顺便校验
  --    「父的**存储** depth == 它的**真实**跳数」。成因：`referral` 是 INSERT-only
  --    （`trg_referral_append_only`）⇒ 管理员旁路（`ALTER TABLE … DISABLE TRIGGER`）写入的陈旧
  --    `depth` 会被**原样当基数**继承：新孩子的 depth = 陈旧值 + 1（实测 50 ⇒ 51，真值应为 3）。
  --    该值不参与钱包计算（链游走不读 depth，已由质检实证），但它污染审计/遍历上界读数，
  --    且「父真实跳数」本就在 ④ 的同一次游走里算出来了 ⇒ 零额外往返即可拦下。
  --    机读 reason = `REFERRAL_PARENT_DEPTH_INCONSISTENT`（命名风格对齐既有 REFERRAL_* 常量）；
  --    借既有闭集码 `LEDGER_AMOUNT_INVALID`（= `LD016` ⇒ bucket input ⇒ **400**）——**不新增错误码**。
  SELECT r.depth INTO v_parent_stored_depth FROM referral r WHERE r.child_uid = NEW.parent_uid;

  IF COALESCE(v_parent_stored_depth, 0) <> v_parent_true_depth THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'reason', 'REFERRAL_PARENT_DEPTH_INCONSISTENT',
      'child_uid', NEW.child_uid::text, 'parent_uid', NEW.parent_uid::text,
      'parent_stored_depth', COALESCE(v_parent_stored_depth, 0)::text,
      'parent_true_depth', v_parent_true_depth::text,
      'note', 'parent stored depth must equal its true hop count; a stale depth would be inherited by the new edge'));
  END IF;

  -- ⑦ depth 由 DB 侧算（父无行 ⇒ 1）—— 只作层级标签 / 遍历上界 / 审计，不承担防环
  --    （⑥ 已保证 `v_parent_stored_depth` == 真实跳数 ⇒ 本式与真实跳数一致）
  NEW.depth := 1 + COALESCE(v_parent_stored_depth, 0);
  RETURN NEW;
END $$;

COMMENT ON FUNCTION referral_cycle_guard() IS
  'P2 裁定 #1 + 0010 + 0011：防环 = 自指禁令 + 祖先检查（新父 P 不是 child C 的后代）+ 绑定串行化（users 两行 FOR UPDATE）。depth 只是层级标签，不是防环机制。0010 新增绑定协议守卫：C 已有下级 ⇒ 拒（REFERRAL_BIND_WOULD_STALE_DEPTH，借码 LEDGER_AMOUNT_INVALID/LD016 ⇒ 400）。0011 新增：③ child 已绑 ⇒ 拒（LEDGER_IDEMPOTENCY_CONFLICT/LD003 ⇒ 409 + REFERRAL_ALREADY_BOUND，与 referral_bind 同码同 reason）；⑥ 父存储 depth ≠ 真实跳数 ⇒ 拒（LD016 + REFERRAL_PARENT_DEPTH_INCONSISTENT）。检查顺序 = 自指 → 串行化 → 已绑 → 环 → 已有下级 → 父 depth 真实性 → depth。';

-- 触发器**不重建、不改动**（`CREATE OR REPLACE FUNCTION` 即生效）：重建会短暂移除闸口，
-- 且属「改既有对象」的额外动作，本单不做。§D 自检里断言两个触发器仍在、启用、且仍是延迟约束触发器。


-- ============================================================================
-- §D 迁移自检（CR55「不安检不许起飞」）—— 任一不通过 ⇒ RAISE ⇒ 整个文件回滚、不写版本行
-- ----------------------------------------------------------------------------
-- D.1 结构自检：两个函数在、函数体含本单新增判据、两个触发器在且启用、
--     Σ 断言触发器**仍是** DEFERRABLE INITIALLY DEFERRED 的约束触发器、借码投影与分桶未变（不新增码）。
-- D.2 **行为探针**（真库真写，跑在子事务里，末尾同法：哨兵异常 ⇒ 回滚 ⇒ 零残留）：
--     ⓐ F3-skip ：直插一条**事件未闭合**的 `-2` `job_fee` +1000（`Σ 出 == 0`）⇒
--                 `SET CONSTRAINTS … IMMEDIATE` 强制结算 ⇒ **必须不报**（F3 的假报已免疫）。
--     ⓑ F3-assert：把账户行按事件终值写回（= 事件闭合）后再造一件 ⇒ 强制结算 ⇒
--                  **必须** `LD032` + reason `COMMISSION_SPLIT_SUM_MISMATCH`（真缺陷仍必须判负）。
--     ⓒ F6       ：裸 `INSERT` 与 `referral_bind` 两条路径对「child 已绑」⇒
--                  **必须同码同 reason**（`LD003` + `REFERRAL_ALREADY_BOUND`）。
--     ⓓ F2       ：把父的 `depth` 篡改为陈旧值 ⇒ 绑定新孩子 ⇒ **必须** `LD016` +
--                  `REFERRAL_PARENT_DEPTH_INCONSISTENT`；父 depth 一致时 ⇒ 必须放行。
--     ⓔ 不回归    ：2-环仍 `REFERRAL_CYCLE_REJECTED`、已有下级仍 `REFERRAL_BIND_WOULD_STALE_DEPTH`、
--                  正常协议（先父后子）仍放行且 depth 正确、子事务内 `cycles = 0 且 bad_depth = 0`。
--     探针 uid 预留（**绝不复用**）：952981..952990（`0010` 用 952991..952998，外部脚本用 9520xx/955xxx/956xxx）。
--     ⚠️ 诚实登记：本 `DO` 块通过时**只**打印 NOTICE（`migrate.ts` 不消费 NOTICE）⇒ 同一批判据的
--        原始读数由 `scripts/p2w-00-p2fix-verify.ts`（run-tagged 落盘）提供，二者**同判据**。
-- ============================================================================
DO $$
DECLARE
  -- 探针 uid（本文件专属窗口）
  c_f6_child  bigint := 952981;   -- ⓒ 已绑的 child（先 A→B）
  c_f6_parent bigint := 952982;   -- ⓒ A 的父 B
  c_f6_other  bigint := 952983;   -- ⓒ 想改绑的另一个父
  c_f2_stale  bigint := 952984;   -- ⓓ 父（depth 将被篡改为陈旧值）
  c_f2_child  bigint := 952985;   -- ⓓ 新孩子
  c_f2_root   bigint := 952986;   -- ⓓ 父的父（根；depth 一致 ⇒ 正向对照）
  c_cyc_x     bigint := 952987;   -- ⓔ 2-环：先 X→Y
  c_cyc_y     bigint := 952988;   -- ⓔ 2-环：再 Y→X 必须被拒
  c_desc_leaf bigint := 952989;   -- ⓔ 已有下级者的下级
  c_desc_par  bigint := 952990;   -- ⓔ 已有下级者（再绑上级必须被拒）
  v_bad       text[] := ARRAY[]::text[];
  v_probe_uids bigint[];
  v_state     text;
  v_detail    text;
  v_reason    text;
  v_msg       text;
  v_m9_cyc    text;
  v_m9_bad    text;
  v_state2    text;
  v_reason2   text;
  v_state3    text;
  v_reason3   text;
  v_fn        text;
  -- F3 探针
  v_sym       text := 'p0011selfcheck';
  v_cid       bigint;
  v_key1      text := 'p0011:selfcheck:pool-in-no-out';
  v_key2      text := 'p0011:selfcheck:pool-in-no-out-2';
  v_state_f3  text;
  v_reason_f3 text;
  v_res       text;
BEGIN
  v_probe_uids := ARRAY[c_f6_child, c_f6_parent, c_f6_other, c_f2_stale, c_f2_child, c_f2_root,
                        c_cyc_x, c_cyc_y, c_desc_leaf, c_desc_par];

  -- ------------------------------------------------------------------ D.1 结构自检
  SELECT prosrc INTO v_fn FROM pg_proc WHERE proname = 'ledger_assert_commission_conservation';
  IF v_fn IS NULL THEN
    v_bad := v_bad || 'ledger_assert_commission_conservation 函数缺失';
  ELSE
    IF v_fn NOT LIKE '%v_closed%' OR v_fn NOT LIKE '%event_closed%' THEN
      v_bad := v_bad || 'Σ 断言函数体未含闭合判据（v_closed / event_closed 缺失）';
    END IF;
    IF v_fn NOT LIKE '%ORDER BY e2.txid DESC%' THEN
      v_bad := v_bad || 'Σ 断言函数体的闭合判据未按「该账户最新分录」取快照';
    END IF;
  END IF;

  SELECT prosrc INTO v_fn FROM pg_proc WHERE proname = 'referral_cycle_guard';
  IF v_fn IS NULL THEN
    v_bad := v_bad || 'referral_cycle_guard 函数缺失';
  ELSE
    IF v_fn NOT LIKE '%REFERRAL_ALREADY_BOUND%' THEN
      v_bad := v_bad || 'referral_cycle_guard 未含 F6 检查（REFERRAL_ALREADY_BOUND 缺失）';
    END IF;
    IF v_fn NOT LIKE '%REFERRAL_PARENT_DEPTH_INCONSISTENT%' THEN
      v_bad := v_bad || 'referral_cycle_guard 未含 F2 检查（REFERRAL_PARENT_DEPTH_INCONSISTENT 缺失）';
    END IF;
    IF v_fn NOT LIKE '%REFERRAL_BIND_WOULD_STALE_DEPTH%' OR v_fn NOT LIKE '%REFERRAL_CYCLE_REJECTED%' THEN
      v_bad := v_bad || 'referral_cycle_guard 丢失 0010/0007 的既有判据（不回归被破坏）';
    END IF;
  END IF;

  -- Σ 断言触发器：仍在 / 启用 / 仍是 DEFERRABLE INITIALLY DEFERRED 的约束触发器（否则整个设计前提崩）
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.ledger_entry'::regclass
                    AND tgname = 'trg_ledger_entry_commission_conservation'
                    AND NOT tgisinternal
                    AND tgenabled <> 'D') THEN
    v_bad := v_bad || 'trg_ledger_entry_commission_conservation 缺失或被禁用';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_trigger
                     WHERE tgrelid = 'public.ledger_entry'::regclass
                       AND tgname = 'trg_ledger_entry_commission_conservation'
                       AND tgconstraint <> 0 AND tgdeferrable AND tginitdeferred) THEN
    v_bad := v_bad || 'Σ 断言触发器不再是 DEFERRABLE INITIALLY DEFERRED 的约束触发器（闭合判据的前提被破坏）';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.referral'::regclass
                    AND tgname = 'trg_referral_cycle_guard'
                    AND NOT tgisinternal AND tgenabled <> 'D') THEN
    v_bad := v_bad || 'trg_referral_cycle_guard 缺失或被禁用（守卫未被挂上）';
  END IF;

  -- 借码纪律：仍是关闭集内的码，投影与分桶未变（**不新增错误码**）
  IF ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH') IS DISTINCT FROM 'LD032' THEN
    v_bad := v_bad || 'LEDGER_RECONCILE_MISMATCH 的 SQLSTATE 投影已变（不再借 LD032）';
  END IF;
  IF COALESCE(ledger_error_for_sqlstate('LD032')->>'bucket', '') <> 'defect' THEN
    v_bad := v_bad || 'LD032 的 bucket 不再是 defect（Σ 断言失败不再是 500 类）';
  END IF;
  IF COALESCE(ledger_error_for_sqlstate('LD032')->>'code', '') <> 'LEDGER_RECONCILE_MISMATCH' THEN
    v_bad := v_bad || 'LD032 反向映射不再回到 LEDGER_RECONCILE_MISMATCH';
  END IF;
  IF ledger_sqlstate_of('LEDGER_IDEMPOTENCY_CONFLICT') IS DISTINCT FROM 'LD003' THEN
    v_bad := v_bad || 'LEDGER_IDEMPOTENCY_CONFLICT 的 SQLSTATE 投影已变（不再借 LD003）';
  END IF;
  IF COALESCE(ledger_error_for_sqlstate('LD003')->>'bucket', '') <> 'integrity' THEN
    v_bad := v_bad || 'LD003 的 bucket 不再是 integrity（已绑冲突应落 409）';
  END IF;
  IF ledger_sqlstate_of('LEDGER_AMOUNT_INVALID') IS DISTINCT FROM 'LD016' THEN
    v_bad := v_bad || 'LEDGER_AMOUNT_INVALID 的 SQLSTATE 投影已变（不再借 LD016）';
  END IF;
  IF COALESCE(ledger_error_for_sqlstate('LD016')->>'bucket', '') <> 'input' THEN
    v_bad := v_bad || 'LD016 的 bucket 不再是 input（借码语义漂移）';
  END IF;

  -- 预留 uid 已被占用（人工重放）⇒ 行为探针跳过（结构自检已执行，不静默假装跑过）
  IF EXISTS (SELECT 1 FROM users WHERE uid = ANY(v_probe_uids))
     OR EXISTS (SELECT 1 FROM referral WHERE child_uid = ANY(v_probe_uids) OR parent_uid = ANY(v_probe_uids)) THEN
    RAISE NOTICE '0011 self-check: 行为探针已跳过（预留 uid 952981..952990 已被占用；重放场景）';
    IF array_length(v_bad, 1) IS NOT NULL AND array_length(v_bad, 1) > 0 THEN
      RAISE EXCEPTION '0011 self-check failed (structural): %', array_to_string(v_bad, ' | ');
    END IF;
    RETURN;
  END IF;

  -- ------------------------------------------------------------------ D.2 行为探针（子事务 + 哨兵回滚）
  BEGIN
    INSERT INTO users (uid, evm)
    SELECT u, '0x' || lpad(to_hex(u), 40, '0') FROM unnest(v_probe_uids) AS u
      ON CONFLICT (uid) DO NOTHING;

    -- ============================== ⓐ / ⓑ F3：事件闭合判据（用直插分录 + 账户写回，隔离变量）
    -- 造一枚探针单位（子事务回滚 ⇒ 零残留；绝不触碰 cid = 1 与平台账户既有余额）
    SELECT cid INTO v_cid FROM currency WHERE symbol = v_sym;
    IF v_cid IS NULL THEN
      INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
      VALUES (v_sym, '0011 self-check probe', 0, 0, 0, 'listed', now())
      RETURNING cid INTO v_cid;
    END IF;
    -- 平台佣金池在探针单位上开户（0/0，account_guard 允许）
    INSERT INTO account (uid, cid, balance, frozen) VALUES (-2, v_cid, 0, 0)
      ON CONFLICT (uid, cid) DO NOTHING;

    -- ⓐ 事件未闭合：只有「入池」一条（Σ 出 == 0 ⇒ 若闭合就必须判负）
    INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after,
                              kind, ref_type, ref_id, idempotency_key, memo)
    VALUES (-2, v_cid, 1000, 0, 1000, 0, 'job_fee', 'job', 952981, v_key1, '0011 self-check: pool in, event NOT closed');

    SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE;   -- 强制结算（= F3 的「提前结算」）
    SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED;    -- 复原默认语义
    -- 走到这里没抛 = 免疫成立（读数为 NOTICE 里的 "event not closed, skip"）

    -- ⓑ 事件闭合：把账户行按事件终值写回（account_guard 要求 == 最新分录快照），再造一件
    --    ⇒ 强制结算必须 LD032（真缺陷仍必须判负）
    UPDATE account SET balance = 1000, version = version + 1 WHERE uid = -2 AND cid = v_cid;

    INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after,
                              kind, ref_type, ref_id, idempotency_key, memo)
    VALUES (-2, v_cid, 1000, 0, 2000, 0, 'job_fee', 'job', 952982, v_key2, '0011 self-check: pool in, event closed');
    UPDATE account SET balance = 2000, version = version + 1 WHERE uid = -2 AND cid = v_cid;

    BEGIN
      SET CONSTRAINTS trg_ledger_entry_commission_conservation IMMEDIATE;
      v_bad := v_bad || 'F3 探针ⓑ：事件闭合后的 Σ 不符**未被判负**（真缺陷被静默放过）';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state_f3 = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
      v_reason_f3 := NULL;
      BEGIN
        v_reason_f3 := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      EXCEPTION WHEN OTHERS THEN v_reason_f3 := NULL; END;
      IF v_state_f3 <> 'LD032' THEN
        v_bad := v_bad || ('F3 探针ⓑ：拒绝码 = ' || COALESCE(v_state_f3, 'NULL') || '（期望 LD032）');
      END IF;
      IF v_reason_f3 IS DISTINCT FROM 'COMMISSION_SPLIT_SUM_MISMATCH' THEN
        v_bad := v_bad || ('F3 探针ⓑ：reason = ' || COALESCE(v_reason_f3, 'NULL') || '（期望 COMMISSION_SPLIT_SUM_MISMATCH）');
      END IF;
    END;
    SET CONSTRAINTS trg_ledger_entry_commission_conservation DEFERRED;

    -- ============================== ⓒ F6：两条路径同一码 + 同一 reason
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_f6_child, c_f6_parent, 0);   -- A→B 合法

    BEGIN
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_f6_child, c_f6_other, 0); -- 裸 INSERT 重绑
      v_bad := v_bad || 'F6 探针ⓒ：裸 INSERT 重绑**未被拒**';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
      v_reason := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      IF v_state <> 'LD003' THEN
        v_bad := v_bad || ('F6 探针ⓒ（裸 INSERT）：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD003）');
      END IF;
      IF v_reason IS DISTINCT FROM 'REFERRAL_ALREADY_BOUND' THEN
        v_bad := v_bad || ('F6 探针ⓒ（裸 INSERT）：reason = ' || COALESCE(v_reason, 'NULL') || '（期望 REFERRAL_ALREADY_BOUND）');
      END IF;
    END;

    BEGIN
      PERFORM referral_bind(c_f6_child, c_f6_other);                                          -- 便利层重绑
      v_bad := v_bad || 'F6 探针ⓒ：referral_bind 重绑**未被拒**';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state2 = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
      v_reason2 := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      IF v_state2 <> 'LD003' THEN
        v_bad := v_bad || ('F6 探针ⓒ（referral_bind）：拒绝码 = ' || COALESCE(v_state2, 'NULL') || '（期望 LD003）');
      END IF;
      IF v_reason2 IS DISTINCT FROM 'REFERRAL_ALREADY_BOUND' THEN
        v_bad := v_bad || ('F6 探针ⓒ（referral_bind）：reason = ' || COALESCE(v_reason2, 'NULL') || '（期望 REFERRAL_ALREADY_BOUND）');
      END IF;
    END;

    -- 两条路径**同码同 reason**（F6 的判据本体）
    IF v_state IS DISTINCT FROM v_state2 OR v_reason IS DISTINCT FROM v_reason2 THEN
      v_bad := v_bad || ('F6 探针ⓒ：两条路径不同码/不同 reason（裸 INSERT = ' || COALESCE(v_state, 'NULL')
                         || '/' || COALESCE(v_reason, 'NULL') || '；referral_bind = '
                         || COALESCE(v_state2, 'NULL') || '/' || COALESCE(v_reason2, 'NULL') || '）');
    END IF;

    -- ============================== ⓓ F2：父存储 depth ≠ 真实跳数 ⇒ 拒；一致 ⇒ 放行
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_f2_stale, c_f2_root, 0);   -- P→G（P 是叶、G 是根）
    -- 用管理员旁路把 P 的 depth 篡改为陈旧值（子事务内 DISABLE + UPDATE ⇒ 回滚后复原）
    ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only;
    UPDATE referral SET depth = 50 WHERE child_uid = c_f2_stale;
    ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only;

    BEGIN
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_f2_child, c_f2_stale, 0);  -- 绑到陈旧父
      v_bad := v_bad || 'F2 探针ⓓ：绑到陈旧 depth 的父**未被拒**（守卫失效）';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state3 = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
      v_reason3 := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      IF v_state3 <> 'LD016' THEN
        v_bad := v_bad || ('F2 探针ⓓ：拒绝码 = ' || COALESCE(v_state3, 'NULL') || '（期望 LD016）');
      END IF;
      IF v_reason3 IS DISTINCT FROM 'REFERRAL_PARENT_DEPTH_INCONSISTENT' THEN
        v_bad := v_bad || ('F2 探针ⓓ：reason = ' || COALESCE(v_reason3, 'NULL') || '（期望 REFERRAL_PARENT_DEPTH_INCONSISTENT）');
      END IF;
    END;

    -- 正向对照：父 depth 一致（G 是根，无行）⇒ 必须放行
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_f2_child, c_f2_root, 0);
    IF (SELECT r.depth FROM referral r WHERE r.child_uid = c_f2_child) IS DISTINCT FROM 1 THEN
      v_bad := v_bad || 'F2 探针ⓓ：正向对照（父 depth 一致）写入后的 depth ≠ 1';
    END IF;

    -- ============================== ⓔ 不回归：2-环 / 已有下级 / 正常协议
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_cyc_x, c_cyc_y, 0);
    BEGIN
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_cyc_y, c_cyc_x, 0);
      v_bad := v_bad || '探针ⓔ：2-环未被拒（防环回归）';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
      v_reason := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      IF v_state <> 'LD016' THEN
        v_bad := v_bad || ('探针ⓔ（2-环）：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD016）');
      END IF;
      IF v_reason IS DISTINCT FROM 'REFERRAL_CYCLE_REJECTED' THEN
        v_bad := v_bad || ('探针ⓔ（2-环）：reason = ' || COALESCE(v_reason, 'NULL')
                           || '（期望 REFERRAL_CYCLE_REJECTED —— 检查顺序被改动？见文件头顺序纪律）');
      END IF;
    END;

    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_desc_leaf, c_desc_par, 0);   -- 叶先绑
    BEGIN
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_desc_par, c_f6_other, 0); -- 已有下级者绑上级
      v_bad := v_bad || '探针ⓔ：已有下级者再绑上级**未被拒**（0010 守卫回归）';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
      v_reason := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      IF v_state <> 'LD016' THEN
        v_bad := v_bad || ('探针ⓔ（已有下级）：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD016）');
      END IF;
      IF v_reason IS DISTINCT FROM 'REFERRAL_BIND_WOULD_STALE_DEPTH' THEN
        v_bad := v_bad || ('探针ⓔ（已有下级）：reason = ' || COALESCE(v_reason, 'NULL')
                           || '（期望 REFERRAL_BIND_WOULD_STALE_DEPTH）');
      END IF;
    END;

    -- ⓓ 收尾：把为 F2 探针**故意**篡改的父 depth 复原为真实跳数（否则下面 ⓔ 的
    --    全局 bad_depth = 0 判据会因「探针自己造的破坏」而假红 —— 探针不得自证其罪）
    ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only;
    UPDATE referral SET depth = 1 WHERE child_uid = c_f2_stale;
    ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only;

    -- 子事务内全局不变式（含本探针刚写的行）
    WITH RECURSIVE up AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
    SELECT count(*)::text INTO v_m9_cyc FROM up WHERE cur = start;
    WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT count(*)::text INTO v_m9_bad
      FROM referral x JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid
     WHERE x.depth <> t.mx;

    IF v_m9_cyc IS DISTINCT FROM '0' THEN
      v_bad := v_bad || ('探针ⓔ：写入后 cycles = ' || COALESCE(v_m9_cyc, 'NULL') || '（期望 0）');
    END IF;
    IF v_m9_bad IS DISTINCT FROM '0' THEN
      v_bad := v_bad || ('探针ⓔ：写入后全局 bad_depth = ' || COALESCE(v_m9_bad, 'NULL') || '（期望 0）');
    END IF;

    -- 哨兵：无论通过与否，一律回滚本子事务（探针数据零残留；`referral` INSERT-only ⇒ 无第二选择）。
    -- 注意：`SET CONSTRAINTS` 的模式已显式复原为 DEFERRED。
    RAISE EXCEPTION 'P2W0011_PROBE_ROLLBACK';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'P2W0011_PROBE_ROLLBACK' THEN
        RAISE;                                  -- 非哨兵的 plpgsql 异常：冒泡 ⇒ 迁移回滚，不静默
      END IF;
    WHEN OTHERS THEN
      RAISE;                                    -- 任何意外 ⇒ 冒泡（迁移回滚，绝不静默吞掉）
  END;

  IF array_length(v_bad, 1) IS NOT NULL AND array_length(v_bad, 1) > 0 THEN
    RAISE EXCEPTION '0011 self-check failed: %', array_to_string(v_bad, ' | ');
  END IF;
  RAISE NOTICE '0011 self-check passed: F3 closure gate (skip when event not closed / LD032 when closed), F6 unified code LD003+REFERRAL_ALREADY_BOUND, F2 stale parent depth rejected (LD016+REFERRAL_PARENT_DEPTH_INCONSISTENT), 0010/0007 negative cases intact';
END $$;
