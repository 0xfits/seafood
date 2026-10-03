-- ============================================================================
-- 0037_commission_conservation_m0.sql · P9⑤ 邀请奖励改版（实现第一步）
--   `CREATE OR REPLACE ledger_assert_commission_conservation` —— 新增「M = 0（无合格受益人）豁免」分支
-- ============================================================================
-- 权威口径：docs/commission.spec.md **v0.4 §19**（§19.5 / §19.6 冲突③ / §19.7 / §19.11 裁定
--           `R-9-51` / `R-9-52`）+ docs/data-layer.spec.md **v0.26 §34.5 / §34.6** +
--           docs/route-layer.spec.md **v2.19 §31.4**。
--
-- 裁定（逐字）
--   · **`R-9-51`**：DB `Σ` 断言 = 变体 Ⅰ（保形状 + 加「无合格受益人」子句）—— 守恒形状不变
--     （进池 == 出池）；新迁移 `CREATE OR REPLACE ledger_assert_commission_conservation` 增一条
--     「`M = 0`（无合格受益人）⇒ 豁免」分支；**不得碰 `ledger_post_event` 函数体**（裁定 #14）。
--   · **`R-9-52`**：`M = 0` 时 10% 池归 `uid = -1`（承 `commission.ts:663` 的
--     `fee_credit_uid = noReferrer ? -1 : -2`，最小改动）；★ **非平台抽成，乃无合格受益人时的兜底归宿**。
--   · **`R-9-49`**：允许新迁移 `CREATE OR REPLACE` 既有迁移所建对象；**严禁改已 apply 迁移文件字节**。
--
-- ★★ 播种源勘误（诚实登记 · 必读）
--   本单 brief 写「自 `0007:317-354` 逐字抽源」。**现取事实**：`ledger_assert_commission_conservation`
--   已被 **`0011`（P2 独立质检修复单 · F3）** 用 `CREATE OR REPLACE` 改写过 —— 现取
--   `pg_proc.prosrc` == `0011` 版（含「事件闭合（`v_closed` / `event_closed`）」判据），
--   **不等** `0007:317-354` 原文（`0007` 版无闭合判据）。若本迁移**照 `0007` 原文抽源**，
--   会把 `0011` 的 F3 修复**静默回退**（⇒ 在 `SET CONSTRAINTS … IMMEDIATE` 会话中途**假报 LD032**，
--   正是 `0011` 文件头 §① 明令不得回归的缺陷）。
--   ⇒ **本迁移的播种源 = `0011:81-145`（现取权威版）逐字**，仅**新增**「`M = 0` 豁免」分支；
--     **`0011` 的闭合判据逐字保留**。此为「规范口径 vs 现取真源」的第 1 处差异，已登记报告。
--
-- 本迁移做什么（`CREATE OR REPLACE` 一个函数；**不**新建触发器 / 不改表结构 / 不新增错误码）
--   ① 保留 `0011` 版函数体**逐字**（含 F3「事件闭合」判据）；
--   ② 在**原「相关行」闸之前**新增「`M = 0`（无合格受益人）豁免」分支：
--      无合格受益人 ⇒ 10% 池按 `R-9-52` 归 `uid = -1`（`job_fee` 增方落 `-1`）⇒ 该事件在 `-2` 池
--      「无进亦无出」⇒ 对 `Σ(job_fee 入 -2) == Σ(commission 出 -2)` 无贡献 ⇒ 显式豁免返回。
--  ③ 自检（CR55 / R-9-24）：原形状逐字在场 + 新分支在场 + 触发器形态未变 +
--     **`ledger_post_event` 函数体 `prosrc` 逐字未动对拍**（指纹 = 已知基线）
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0036` 任何字节**；★ **不改 `ledger_post_event` 函数体**（裁定 #14 / CR81）
--   · **不重建触发器**（`CREATE OR REPLACE FUNCTION` 保 OID ⇒ 既有 `trg_ledger_entry_commission_conservation`
--     自动指向新函数体；重建会短暂移除闸口，且属额外动作 ——— 沿 `0011` 纪律）
--   · **不新增错误码**（闭集 33 不动）；断言失败仍借 `LEDGER_RECONCILE_MISMATCH`（= `LD032` · defect / 500）
--   · 断言仍**只读**（不写任何表）
--
-- 诚实边界（关于「豁免分支」的效力 —— 不得夸大）
--   · 现取 `planJobSettlement`（M=0）录 `fee_credit_uid = -1`（`R-9-52`）⇒ 该事件**不产生任何 `-2` 行**
--     ⇒ 原断言**本就**（触发闸 `uid = -2` 不命中）返回 NULL。故本分支是**显式化 / 防御性**的：
--     它把「`-1` 的入池行」明确记为「设计内的 `M=0` 归宿」而非「漏网」，并输出可检索 `NOTICE` / 标记。
--   · 本分支**不放宽任何真判负**：`-2` 池「有入无出」（`pool_in > 0` 且 `paid_out = 0`，事件闭合）
--     仍由下方原断言判负 —— 那正是「形态非法」（池入了 `-2` 却没分出去），**不属于** `M=0` 合法形状
--     （`M=0` 的池按 `R-9-52` 入 `-1`，不入 `-2`）。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ledger_assert_commission_conservation() RETURNS trigger
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
  -- ★ P9⑤（R-9-51 + R-9-52）：M = 0（无合格受益人）豁免分支 --------------------------------
  -- 无合格受益人（以 Worker 为中心「上 3 ∪ 下 3」名单为空）⇒ 10% 池按 R-9-52 归 uid = -1
  --   （兜底归宿，**非平台抽成**）；该事件在 -2 池「无进亦无出」⇒ 不参与 Σ 守恒 ⇒ 显式豁免返回。
  -- 位置：置于原「相关行」闸**之前** —— 使 `-1` 的入池行被本函数显式承认为「设计内的 M=0 归宿」。
  -- 反例护栏：本行豁免**不影响** -2 池的真判负（-2 行走下方原闸，由原断言判负）。
  IF NEW.kind = 'job_fee' AND NEW.uid = -1 AND NEW.delta > 0 THEN
    RAISE NOTICE 'ledger_assert_commission_conservation: M=0 exemption (no eligible beneficiary => fee -> -1) skip Σ check (key=%)',
      COALESCE(NEW.event_root_key, split_part(NEW.idempotency_key, '#', 1));
    RETURN NULL;   -- 可检索标记：p9s5_m0_exemption
  END IF;

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
    -- ---- F3（0011 新增）：先判「事件是否已闭合」，未完则跳过（对「被提前结算」免疫）
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
  'P2 CR80 + 0011 + P9⑤(0037)：同一 event_root_key 的 Σcommission(出 -2) == Σjob_fee(入 -2)。只读断言，失败抛 LEDGER_RECONCILE_MISMATCH(defect/500)。0011 新增「事件闭合」判据（仅当 account(-2,cid) == 该账户最新分录快照时判负，否则视为事件未完而豁免）。0037（P9⑤ R-9-51/R-9-52）新增「M = 0（无合格受益人）豁免」分支：M=0 时 10% 池归 uid = -1（job_fee 增方落 -1）⇒ -2 池无进无出 ⇒ 显式豁免（不放宽任何 -2 池真判负）。';

-- ---------------------------------------------------------------------------
-- §自检（CR55「不安检不许起飞」/ R-9-24）：任一不通过 ⇒ RAISE ⇒ 整文件回滚、不写版本行。
--   D.1 新函数在场 + `0011` 版原形状**逐字在场**（闭合判据 + 相关行闸 + 借码）。
--   D.2 新「M = 0 豁免」分支在场（可检索标记 `p9s5_m0_exemption` + `-1` 入池行判据）。
--   D.3 触发器形态未变（仍 / 启用 / 仍 DEFERRABLE INITIALLY DEFERRED 的约束触发器）。
--   D.4 ★ **`ledger_post_event` 函数体 `prosrc` 逐字未动对拍**（`md5(prosrc)` = 已知基线
--       `3737e0f8ef4f2bbfffd973f16ce47fb8`，长度 `47968`）—— 裁定 #14 的核心护栏。
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_src       text;
  v_pe_md5    text;
  v_pe_len    integer;
BEGIN
  -- ------------------------------------------------------------------ D.1 新函数 + 原形状逐字在场
  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ledger_assert_commission_conservation';
  IF v_src IS NULL THEN
    RAISE EXCEPTION '0037 self-check FAILED: ledger_assert_commission_conservation 函数缺失';
  END IF;
  -- 0011 版闭合判据（不得回归）
  IF v_src NOT LIKE '%v_closed%' OR v_src NOT LIKE '%event_closed%' THEN
    RAISE EXCEPTION '0037 self-check FAILED: 0011 闭合判据（v_closed / event_closed）缺失 —— 播种源被错取为 0007 原文？';
  END IF;
  IF v_src NOT LIKE '%ORDER BY e2.txid DESC%' THEN
    RAISE EXCEPTION '0037 self-check FAILED: 闭合判据未按「该账户最新分录」取快照';
  END IF;
  IF v_src NOT LIKE '%IF v_pool_in <> v_paid_out THEN%'
     OR v_src NOT LIKE '%COMMISSION_SPLIT_SUM_MISMATCH%'
     OR v_src NOT LIKE '%LEDGER_RECONCILE_MISMATCH%' THEN
    RAISE EXCEPTION '0037 self-check FAILED: 守恒断言主体（借码 LD032 / reason）缺失';
  END IF;
  -- 原「相关行」闸逐字在场（不得改动）
  IF v_src NOT LIKE '%IF NOT (NEW.kind = ''commission'' AND NEW.uid = -2)%'
     OR v_src NOT LIKE '%AND NOT (NEW.kind = ''job_fee'' AND NEW.uid = -2 AND NEW.delta > 0)%' THEN
    RAISE EXCEPTION '0037 self-check FAILED: 原「相关行」闸被改动（应逐字保留）';
  END IF;

  -- ------------------------------------------------------------------ D.2 新 M=0 豁免分支在场
  IF v_src NOT LIKE '%p9s5_m0_exemption%' THEN
    RAISE EXCEPTION '0037 self-check FAILED: M=0 豁免分支的可检索标记缺失';
  END IF;
  IF v_src NOT LIKE '%NEW.kind = ''job_fee'' AND NEW.uid = -1 AND NEW.delta > 0%' THEN
    RAISE EXCEPTION '0037 self-check FAILED: M=0 豁免分支的判据（-1 入池行）缺失';
  END IF;

  -- ------------------------------------------------------------------ D.3 触发器形态未变
  IF NOT EXISTS (
       SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.ledger_entry'::regclass
          AND tgname = 'trg_ledger_entry_commission_conservation'
          AND NOT tgisinternal AND tgenabled <> 'D'
          AND tgconstraint <> 0 AND tgdeferrable AND tginitdeferred) THEN
    RAISE EXCEPTION '0037 self-check FAILED: 守恒断言触发器形态改变（应仍为 DEFERRABLE INITIALLY DEFERRED 约束触发器且启用）';
  END IF;

  -- ------------------------------------------------------------------ D.4 ledger_post_event prosrc 逐字未动对拍
  SELECT md5(p.prosrc), length(p.prosrc) INTO v_pe_md5, v_pe_len
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ledger_post_event'
     AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb';
  IF v_pe_md5 IS DISTINCT FROM '3737e0f8ef4f2bbfffd973f16ce47fb8'
     OR v_pe_len IS DISTINCT FROM 47968 THEN
    RAISE EXCEPTION '0037 self-check FAILED: ledger_post_event 函数体被改动（md5=% len=%；期望 3737e0f8ef4f2bbfffd973f16ce47fb8 / 47968）', v_pe_md5, v_pe_len;
  END IF;

  RAISE NOTICE '0037 self-check passed: M=0 豁免分支新增；0011 闭合形状逐字保留；触发器形态未变；ledger_post_event prosrc 逐字未动（md5 3737e0f8… / len 47968）';
END $$;
