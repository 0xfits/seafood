-- ============================================================================
-- 0010_referral_bind_protocol_guard.sql · 绑定协议守卫：**已有下级者不得再绑上级**
-- ============================================================================
-- 权威口径
--   · `docs/commission.spec.md` §3.2 —— `depth = 父.depth + 1` **只校验新插入的那条边**，
--     既有边会被后来的插入**追溯破坏**（先 `A→B` 再 `B→A`：两次等式都成立、环照样形成）；
--     §3.3 —— 绑定顺序（由深到浅）原本是**调用方的责任**；CR16 —— `depth` 不得作为 API 入参。
--   · `docs/seafood.master-plan.md` §5.22 / §5.23 相邻轮次：上一单（P2 佣金层）**实测撞到**该缺口，
--     自述里上报「13 行 `depth` 需事后修复」并把「须由深到浅绑定」提到 spec 层。
--   · Zang 裁定（本单，逐字执行）：真实协议是**注册时绑一次、终身不变** ⇒ 「有下级的人只可能
--     在注册时就已有上级」⇒ **P 不可能在有下级之后才获得上级**。⇒ 把这条协议变成**可强制的守卫**。
--
-- 本迁移做什么（**只替换一个函数**）
--   ① `CREATE OR REPLACE FUNCTION referral_cycle_guard()`：
--      函数体 = `0007` 版**逐字保留**（自指禁令 / `users` 两行 `FOR UPDATE` 串行化 / 祖先检查 /
--      `depth` 由 DB 侧计算），**只新增一段 ④ 守卫**：
--        若**被绑者 `C` 已经是别人的 `parent`（即已有下级）** ⇒ 拒绝本次绑定。
--      机读 reason = `REFERRAL_BIND_WOULD_STALE_DEPTH`（命名风格对齐既有 `REFERRAL_SELF_BIND` /
--      `REFERRAL_CYCLE_REJECTED`）；**借既有闭集码** `LEDGER_AMOUNT_INVALID`（= `LD016`
--      ⇒ bucket `input` ⇒ **400**），与 `REFERRAL_CYCLE_REJECTED` 的用法**逐字同法**
--      ⇒ **不新增错误码**（R104 / §14.1 闭集 33 不动）。
--   ② `COMMENT ON FUNCTION` 同步改写（登记新守卫与**检查顺序**，顺序有判负用例钉着）。
--   ③ 末尾 `DO` 自检：迁移**应用时**即断言（结构 + 行为探针），不通过 ⇒ `RAISE` ⇒
--      **整个文件回滚、不写版本行**（与 `0007` §E / `0009` 末尾自检同法）。
--
-- ⚠️ 检查顺序（**不得重排 —— 有判负用例钉着**）
--      ① 自指禁令 → ② 串行化（`users` 两行 `FOR UPDATE`）→ ③ 祖先检查（环）
--      → ④ **本单新增**的「已有下级」守卫 → ⑤ `depth` 计算
--   · ③ 必须在 ④ **之前**：既有 2-环判负用例（先 `A→B` 再 `B→A`）的第二条绑定里，
--     `C = B` **同时**满足「已有下级（下级 = `A`）」与「成环（新父 `A` 在 `C` 的上行链里）」。
--     成环是**更根本**的拒绝理由（图结构问题；`depth` 失效只是它的后果之一）⇒ 保持 ③ 在前，
--     使既有判负的**码与 reason 逐字不变**（`LD016` / `REFERRAL_CYCLE_REJECTED`，不回归）。
--   · ④ 必须在 ⑤ **之前**：`depth` 一旦算出就已经太晚了 —— 非法绑定会**连带污染已经存在的下级行**。
--
-- 为什么这条守卫是**必要**的（机制，非口号）
--   `referral` 是 **INSERT-only**（`trg_referral_append_only`）⇒ `depth` 一旦写入**不可就地修正**
--   （上一单只能走管理员旁路 `ALTER TABLE … DISABLE TRIGGER` 事后修，见 `scripts/p2d-01-…ts`）。
--   若先绑叶、后绑父：`C→P`（`P` 当时无行）⇒ `depth(C) = 1`；之后 `P→G`（`P` 获得上级）⇒
--   `depth(C)` 本应为 2 却永远停在 1 ⇒ **不变式就地失效、且无法修正**。
--   ⇒ 唯一可强制的时点就是**插入那一刻**：`C` 必须**还是叶**（尚无下级）。
--
-- 与本守卫相容的正常协议（为什么它不挡合法调用）
--   · 注册协议 = **先绑父、再绑子**（等价「由深到浅」）：先给上级绑他的上级，再把下级绑到上级。
--     此时每次绑定的 `C` **都还是叶** ⇒ 守卫放行（`p2d-00` 的 `bindChain` 正是这个顺序）。
--   · 根节点（无上级）**永不绑定** ⇒ 不可能出现「已有下级还去绑上级」。
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0009` 任何字节**（尤其 `0009`：**已应用**，改它就是「撒谎态」）；
--     不删/改 `schema_migration` 既有行；不动表结构 / 业务数据 / 其它触发器 / 其它函数。
--   · **不新增错误码**；不动 `ledger_raise` / `ledger_error_for_sqlstate`。
--   · 不改 `referral_bind()`（便利层）：真正的闸是**触发器**，`referral_bind` 与**裸 INSERT**
--     两条路径都被本守卫覆盖（上一单的 `p2b-02` 已对「裸 INSERT 路径」取证过）。
--   · 不动 `src/commission.ts` 的任何业务逻辑（本单只碰守卫与错误码资产）。
--
-- 幂等：`CREATE OR REPLACE FUNCTION` + 存在性守卫 ⇒ 可重跑（`migrate.ts` 重跑报 `skipped` + checksum 一致）。
--   行为探针在**子事务**内跑完即用**哨兵异常回滚** ⇒ 不留任何探针数据（`referral` 不可删，必须如此）。
--   若预留探针 uid 已被占用（人工重放场景）⇒ 行为探针 `RAISE NOTICE` 跳过，**结构自检仍执行**
--   （不静默假装跑过；跳过事实可被 `pg_proc` 指纹与外部 run-tagged 脚本复核）。
--
-- 诚实边界（不得夸大）
--   · 本守卫保证的是「**按 `0007` + 本文件的全部守卫写入**时 `depth` 不会被追溯破坏」，
--     **不是**「任何写入都不可能让 `depth` 失效」：管理员 `ALTER TABLE … DISABLE TRIGGER USER`
--     仍可旁路（仓库内 `p2d-01` / `purge-test-data.ts` 即此法）。**不得**表述为「绝对不可失效」。
--   · 本迁移**不追溯修复存量行**：只拦新写入。若日后发现存量坏 `depth`，仍须走 `p2d-01` 式旁路修复
--     （或新开一单），本文件不静默改业务数据。
-- ============================================================================

-- ============================================================================
-- §A 绑定守卫（`CREATE OR REPLACE`，替代 `0007` 版；**不改 `0007` 文件本身**，沿 `0009` 替代 `0005` 的同法）
-- ============================================================================
-- 与 `0007` 版的**唯一差异** = 下方「④ 本单新增」那一段。其余每一行（变量、注释、四段原有逻辑）
-- 逐字保留，便于「逐行 diff 只有新增」复核。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION referral_cycle_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_hit boolean;
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

  -- ③ 祖先检查：断言**新父 P 不是 child C 的后代**（等价式 C ∉ ancestors(P)）：
  --    从 P 沿 parent_uid 上行，遇 C 即拒。步行上界 1000 只为防「库里已有环」时无限递归
  --    （不是防环机制本身；防环 = 本检查 + 串行化）。
  WITH RECURSIVE up AS (
    SELECT r.parent_uid AS cur, 1 AS d
      FROM referral r WHERE r.child_uid = NEW.parent_uid
    UNION ALL
    SELECT r.parent_uid, up.d + 1
      FROM referral r JOIN up ON r.child_uid = up.cur
     WHERE up.d < 1000
  )
  SELECT EXISTS (SELECT 1 FROM up WHERE cur = NEW.child_uid) INTO v_hit;

  IF v_hit THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'reason', 'REFERRAL_CYCLE_REJECTED',
      'child_uid', NEW.child_uid::text, 'parent_uid', NEW.parent_uid::text));
  END IF;

  -- ④ 绑定协议守卫（**本单新增**）：被绑者 C **已有下级** ⇒ 拒绝（否则 C 的 depth 会就地失效）。
  --    机制：`depth` 在插入时算 `1 + depth(新父)`，而 `referral` INSERT-only ⇒ 不可修正。
  --      · 先绑叶、后绑父 ⇒ 叶的 `depth` 停在旧值 ⇒ **不变式失效且无法修**（spec §3.2 的现实后果）；
  --      · 真实协议（注册时绑一次、终身不变）= **先绑父、再绑子** ⇒ 每次绑定的 C 都还是叶 ⇒ 放行。
  --    ⇒ 可强制判据 = 「C 现在必须是叶（`referral` 里没有以 C 为 parent 的行）」。
  --    ⚠️ 位置纪律见文件头：必须在 ③ 之后（成环优先报 `REFERRAL_CYCLE_REJECTED`）、⑤ 之前。
  --       索引 `idx_referral_parent`（0007）正好支撑本谓词。
  IF EXISTS (SELECT 1 FROM referral r WHERE r.parent_uid = NEW.child_uid) THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'reason', 'REFERRAL_BIND_WOULD_STALE_DEPTH',
      'child_uid', NEW.child_uid::text, 'parent_uid', NEW.parent_uid::text,
      'protocol', 'BIND_PARENT_BEFORE_DESCENDANTS',
      'note', 'child already has descendants => binding a parent would retroactively invalidate their depth'));
  END IF;

  -- ⑤ depth 由 DB 侧算（父无行 ⇒ 1）—— 只作层级标签 / 遍历上界 / 审计，不承担防环
  NEW.depth := 1 + COALESCE((SELECT r.depth FROM referral r WHERE r.child_uid = NEW.parent_uid), 0);
  RETURN NEW;
END $$;

COMMENT ON FUNCTION referral_cycle_guard() IS
  'P2 裁定 #1 + 0010：防环 = 自指禁令 + 祖先检查（新父 P 不是 child C 的后代）+ 绑定串行化（users 两行 FOR UPDATE）。depth 只是层级标签，不是防环机制。0010 新增绑定协议守卫：C 已有下级 ⇒ 拒（reason REFERRAL_BIND_WOULD_STALE_DEPTH，借码 LEDGER_AMOUNT_INVALID/LD016 ⇒ 400），检查顺序 = 自指 → 串行化 → 环 → 已有下级 → depth。';

-- 触发器**不重建、不改动**（`CREATE OR REPLACE FUNCTION` 即生效）：重建会短暂移除闸口，
-- 且属「改既有对象」的额外动作，本单不做。§C 自检里断言它仍在且启用。


-- ============================================================================
-- §B 迁移自检（CR55 风格「不安检不许起飞」）—— 任一不通过 ⇒ RAISE ⇒ 整个文件回滚
-- ---------------------------------------------------------------------------
-- B.1 结构自检：函数在、触发器在且启用、函数体含新守卫、借码的投影与分桶未变（不新增码）。
-- B.2 **行为探针**（真库真写，但跑在**子事务**里，结束一律用哨兵异常回滚 ⇒ 零残留）：
--     ① `A→B` 合法（B 是叶） ② 给 **B** 绑上级 ⇒ **必须被拒**（`LD016` + `REFERRAL_BIND_WOULD_STALE_DEPTH`）
--     ③ `X→Y` 后 `Y→X` ⇒ 仍必须拒 `REFERRAL_CYCLE_REJECTED`（既有 2-环判负**不回归**；钉住检查顺序）
--     ④ 正常协议（先绑父再绑子，链长 3）⇒ 两次绑定都**必须通过**，且全局 `bad_depth = 0`
--   为什么探针只能在子事务里做：`referral` 是 INSERT-only ⇒ 探针一旦落库**无法删除**；
--     `referral.child_fk/parent_fk` 又要求 `users` 行先存在 ⇒ 探针必须写两张表 ⇒ 必须回滚。
--   探针 uid 预留（**绝不复用**）：952991..952998（外部 run-tagged 脚本用 9520xx，互不打扰）。
--   ⚠️ 诚实登记：本 DO 块通过时**不打印读数**（`migrate.ts` 不消费 NOTICE）⇒ 四条用例的
--      **原始读数**由 `scripts/p1t-00-bind-protocol-guard.ts`（run-tagged 落盘）提供，二者**同判据**。
-- ============================================================================
DO $$
DECLARE
  -- 预留探针 uid（与外部脚本的 9520xx 分区不同）
  c_a bigint := 952991;  -- ① 的叶（先绑者）
  c_b bigint := 952992;  -- ① 的父（后要被绑上级者 ⇒ 必须被拒）
  c_p bigint := 952993;  -- ① 给 B 的新上级
  c_x bigint := 952994;  -- ③ 2-环：先 X→Y
  c_y bigint := 952995;  -- ③ 2-环：再 Y→X 必须被拒
  c_l bigint := 952996;  -- ④ 链最深（worker）
  c_m bigint := 952997;  -- ④ 链中间
  c_n bigint := 952998;  -- ④ 根（无上级）
  v_bad    text[] := ARRAY[]::text[];
  v_state  text;
  v_msg    text;
  v_detail text;
  v_reason text;
  v_m9     text;
  v_probe_uids bigint[];
BEGIN
  v_probe_uids := ARRAY[c_a, c_b, c_p, c_x, c_y, c_l, c_m, c_n];

  -- ------------------------------------------------------------------ B.1 结构自检
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'referral_cycle_guard') THEN
    v_bad := v_bad || 'referral_cycle_guard 函数缺失';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_proc
                     WHERE proname = 'referral_cycle_guard'
                       AND prosrc LIKE '%REFERRAL_BIND_WOULD_STALE_DEPTH%') THEN
    v_bad := v_bad || 'referral_cycle_guard 函数体未含新守卫（REFERRAL_BIND_WOULD_STALE_DEPTH）';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.referral'::regclass
                    AND tgname = 'trg_referral_cycle_guard'
                    AND NOT tgisinternal
                    AND tgenabled <> 'D') THEN
    v_bad := v_bad || 'trg_referral_cycle_guard 缺失或被禁用（守卫未被挂上）';
  END IF;

  -- 借码纪律：仍是关闭集内的码，投影与分桶未变（**不新增错误码**）
  IF ledger_sqlstate_of('LEDGER_AMOUNT_INVALID') IS DISTINCT FROM 'LD016' THEN
    v_bad := v_bad || 'LEDGER_AMOUNT_INVALID 的 SQLSTATE 投影已变（不再借 LD016）';
  END IF;
  IF COALESCE(ledger_error_for_sqlstate('LD016')->>'bucket', '') <> 'input' THEN
    v_bad := v_bad || 'LD016 的 bucket 不再是 input（借码语义漂移）';
  END IF;
  IF COALESCE(ledger_error_for_sqlstate('LD016')->>'code', '') <> 'LEDGER_AMOUNT_INVALID' THEN
    v_bad := v_bad || 'LD016 反向映射不再回到 LEDGER_AMOUNT_INVALID';
  END IF;

  -- 预留 uid 已被占用（人工重放）⇒ 探针跳过（结构自检已执行，不静默假装跑过）
  IF EXISTS (SELECT 1 FROM referral
              WHERE child_uid = ANY(v_probe_uids) OR parent_uid = ANY(v_probe_uids)) THEN
    RAISE NOTICE '0010 self-check: 行为探针已跳过（预留 uid 952991..952998 已被 referral 占用；重放场景）';
    IF array_length(v_bad, 1) IS NOT NULL AND array_length(v_bad, 1) > 0 THEN
      RAISE EXCEPTION '0010 self-check failed (structural): %', array_to_string(v_bad, ' | ');
    END IF;
    RETURN;
  END IF;

  -- ------------------------------------------------------------------ B.2 行为探针（子事务 + 哨兵回滚）
  BEGIN
    INSERT INTO users (uid, evm)
    SELECT u, '0x' || lpad(to_hex(u), 40, '0') FROM unnest(v_probe_uids) AS u
      ON CONFLICT (uid) DO NOTHING;

    -- ① 合法：A→B（B 此时是叶）—— 必须先成功，否则后面的 ② 无意义
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_a, c_b, 0);

    -- ② 负例：给**已有下级的 B** 绑上级 P ⇒ 必须被拒（借码 LD016 + 新 reason）
    BEGIN
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_b, c_p, 0);
      v_bad := v_bad || '探针②：已有下级者再绑上级**未被拒**（守卫失效）';
    EXCEPTION WHEN OTHERS THEN
      -- PG_EXCEPTION_DETAIL = ledger_raise（0004）的 details JSON ⇒ 取机读 reason
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
      v_reason := NULL;
      BEGIN
        v_reason := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      EXCEPTION WHEN OTHERS THEN v_reason := NULL; END;
      IF v_state <> 'LD016' THEN
        v_bad := v_bad || ('探针②：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD016 = LEDGER_AMOUNT_INVALID 借码）');
      END IF;
      IF v_reason IS DISTINCT FROM 'REFERRAL_BIND_WOULD_STALE_DEPTH' THEN
        v_bad := v_bad || ('探针②：reason = ' || COALESCE(v_reason, 'NULL') || '（期望 REFERRAL_BIND_WOULD_STALE_DEPTH）');
      END IF;
    END;

    -- ③ 既有 2-环判负**不回归**：X→Y 后 Y→X 仍必须拒 REFERRAL_CYCLE_REJECTED（钉住检查顺序：环在「已有下级」之前）
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_x, c_y, 0);
    BEGIN
      INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_y, c_x, 0);
      v_bad := v_bad || '探针③：2-环未被拒（防环回归）';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
      v_reason := NULL;
      BEGIN
        v_reason := COALESCE(NULLIF(v_detail, ''), '{}')::jsonb ->> 'reason';
      EXCEPTION WHEN OTHERS THEN v_reason := NULL; END;
      IF v_state <> 'LD016' THEN
        v_bad := v_bad || ('探针③：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD016）');
      END IF;
      IF v_reason IS DISTINCT FROM 'REFERRAL_CYCLE_REJECTED' THEN
        v_bad := v_bad || ('探针③：reason = ' || COALESCE(v_reason, 'NULL')
                           || '（期望 REFERRAL_CYCLE_REJECTED —— 检查顺序被改动？见文件头顺序纪律）');
      END IF;
    END;

    -- ④ 正常协议（先绑父再绑子）⇒ 必须两次都通过；并复核 depth 不变式
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_m, c_n, 0);   -- M→N（N 是根）
    INSERT INTO referral (child_uid, parent_uid, depth) VALUES (c_l, c_m, 0);   -- L→M（M 已有上级、L 是叶 ⇒ 放行）
    IF (SELECT r.depth FROM referral r WHERE r.child_uid = c_l) IS DISTINCT FROM 2 THEN
      v_bad := v_bad || '探针④：L 的 depth ≠ 2（正常协议链深计算异常）';
    END IF;

    -- 全局 depth 不变式（含本探针刚写的行；子事务内可见）
    WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL
      SELECT a.start, r.parent_uid, a.d + 1
        FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT count(*)::text INTO v_m9
      FROM referral x JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t
        ON t.start = x.child_uid WHERE x.depth <> t.mx;
    IF v_m9 IS DISTINCT FROM '0' THEN
      v_bad := v_bad || ('探针④：写入后全局 bad_depth = ' || COALESCE(v_m9, 'NULL') || '（期望 0）');
    END IF;

    -- 哨兵：无论通过与否，一律回滚本子事务（探针数据零残留；`referral` INSERT-only ⇒ 无第二选择）
    RAISE EXCEPTION 'P1T_PROBE_ROLLBACK';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'P1T_PROBE_ROLLBACK' THEN
        RAISE;                                  -- 非哨兵的 plpgsql 异常：冒泡 ⇒ 迁移回滚，不静默
      END IF;
    WHEN OTHERS THEN
      RAISE;                                    -- 任何意外 ⇒ 冒泡（迁移回滚，绝不静默吞掉）
  END;

  IF array_length(v_bad, 1) IS NOT NULL AND array_length(v_bad, 1) > 0 THEN
    RAISE EXCEPTION '0010 self-check failed: %', array_to_string(v_bad, ' | ');
  END IF;
END $$;
