-- ============================================================================
-- 0012_replay_pre_gate_before_balance_gate.sql
-- P2 复检新发现 · **幂等契约缺陷**（幂等重放判定被余额/冻结闸挡住）
-- ============================================================================
-- 权威口径
--   · `docs/ledger.spec.md` §7.1（第 454 行）：「一条语句自带隐式事务，函数内部依次完成
--     **信封校验 → 幂等占位 → 按全序加锁 → 分录 → 余额/冻结更新 → 配对不变式**」
--     ⇒ 「幂等占位」在「余额/冻结更新」**之前**。
--   · **R51**（幂等协议，顺序固定）：① 事务内先执行带 `ON CONFLICT (idempotency_key) DO NOTHING`
--     的首条分录插入；② 返 0 行 ⇒ 立即回滚；③ 另起只读查询取回既有 txid；④ 按 R52 返回。
--     **严禁「先 SELECT 查在不在，再 INSERT」**（并发下必然双扣）。
--   · **R52①**：同键**且**指纹相同 ⇒ 200 + `{idempotent_replay:true, txid, …既有结果}`，
--     不再写任何分录、不重复扣款。**R52②**：同键但指纹不同 ⇒ 409 `LEDGER_IDEMPOTENCY_CONFLICT`。
--     §19.6 补丁：**未传指纹 ⇒ 同键一律按重放（①）**。
--   · **R63**：所有余额校验必须在**扣款所在的那个事务内**、且在取得 `FOR UPDATE` 行锁**之后**执行。
--   · §14.1 闭集 33 码（`LD001..LD033`）：**本迁移不新增任何错误码**，只替换一个函数的定义。
--
-- 缺陷（Zang 已逐条亲查的**事实**，非推断）
--   · 实现位置（`migrations/0005_ledger_event_root_key.sql`，行号）：
--       1054 / 1066  账户 `FOR UPDATE`（C4 加锁）
--       1126 / 1131  `LEDGER_INSUFFICIENT_BALANCE` / `LEDGER_INSUFFICIENT_FROZEN`（C5 R80 余额·冻结闸）
--       1163 / 1164  首条分录 `ON CONFLICT (idempotency_key) DO NOTHING`（R51① 幂等占位）
--       1213 / 1271  C7 重放返回 `idempotent_replay:true`
--     ⇒ **余额闸（1126/1131）跑在幂等占位（1164）之前**，与 §7.1 第 454 行的口径**相反**。
--   · 实测现象（探针 `scripts/p2w-03-ledger-replay-balance-gate.ts`，exit 0 / 零残留）：
--     托管被花光后，**同键同载荷**再发 ⇒ `LD002 LEDGER_INSUFFICIENT_FROZEN`（409），
--     而不是 R52① 的 `200 + idempotent_replay:true`；托管仍够时则 `idempotent_replay=true`
--     且不新增分录（键下恒 4 行）。
--   · 后果：客户端超时后重试，**无法区分「已成功」与「余额不足」** ⇒ R52① 被破坏。
--
-- 本迁移做什么（**只 `CREATE OR REPLACE` 一个函数**，不改 0004/0005 文件、不改表结构、不新增错误码）
--   ① 在 **C4 账户加锁之后、C5 余额/冻结闸之前** 新增一道**只读重放前置闸**（标记
--      `0012-REPLAY-PRE-GATE-BEGIN` / `…-END`）：按 `event_root_key = v_key` 走**已有索引**
--      `idx_ledger_event_root_key` 查一次；命中时
--        · 指纹相同（或调用方未传指纹）⇒ **立即**按 R52① 返回 `{ok:true, idempotent_replay:true,
--          txid, entries, accounts}`，**完全不跑任何余额/冻结校验**、不写任何分录；
--        · 指纹不同 ⇒ **立即** `LD003 LEDGER_IDEMPOTENCY_CONFLICT`（409），不动任何数据。
--   ② **R51 的 `ON CONFLICT` 首条分录探针原地保留、且仍是权威**：并发**两个全新**事件同键时
--      两者都可能 miss 本闸 ⇒ 仍靠唯一约束 `ledger_idem_uniq`；恰有一个落账，另一个返 0 行
--      ⇒ 走 C7 重放。本闸**不是**「先 SELECT 再 INSERT」的替代物（R51 的禁令针对的是**写入决策**，
--      而本闸只决定「键已在库时立刻按 R52 返回、不进入写路径」）。
--   ③ **R63 不变**：miss 本闸 = 真正的新事件 ⇒ 余额/冻结校验仍在 C5（本事务内、`FOR UPDATE` 之后），
--      C5 的位置与代码**一行未动**。
--   ④ 末尾 apply-time `DO` 自检：**结构性**（`pg_proc.prosrc` 位置断言把「闸在余额闸之前」钉住，
--      防静默回归）+ **行为性**（子事务 + 哨兵回滚 ⇒ 零残留：托管花光后同键重发必须 200 重放、
--      同键异指纹必须 LD003、全新键余额不足仍必须 LD002）。
--
-- ----------------------------------------------------------------------------
-- 强命题与当场反例（纪律：凡写「不可能 / 构造保证」必举一个反例去撞它）
-- ----------------------------------------------------------------------------
--   命题 1「本闸不会取代 `ON CONFLICT` 探针的权威性」 ⇒ 反例撞法：**两个全新事件同键并发**
--     （≥2 连接，非串行）。若本闸被实现成「先 SELECT 再决定是否 INSERT」（或以锁/SERIALIZABLE
--     取代唯一约束），该反例就会**双扣**或死锁。本项目实测（`scripts/p2x-00-…` 用例 5）：
--     恰一个落账、另一个 `idempotent_replay:true`、键下恒 4 行、托管恰扣一次。
--   命题 2「闸放在 C4 之后 ⇒ 并发重试也能拿到重放」 ⇒ 反例撞法：分阶段竞态（A 持锁不提交、
--     B 同键重试后 A 才提交）。实测（用例 5b）：B 阻塞等到 A 提交后**看得见**根行 ⇒ 200 重放；
--     修前该反例得到 LD002（这正是本单要修的缺陷本体）。
--   命题 3「命中即零写入」 ⇒ 反例撞法 1：键下分录数在重放后必须**不增**（用例 1/2/3 逐次读数）。
--     ⚠️ **诚实边界**：C4 的 `INSERT INTO account … ON CONFLICT DO NOTHING` 在闸之前执行，
--     故若重放请求指向一个该 (uid,cid) **尚无账户行**的业务载荷，会新建一条 0/0 账户行
--     （无余额变动）。该副作用**修前同样存在**（修前该请求会走过 C4 后被 C5 拒或走到 C7 重放）
--     ⇒ 非行为变更；命中闸时**不新增任何 ledger_entry**，这是判据本体。
--
-- ----------------------------------------------------------------------------
-- 诚实边界（不得夸大，逐条登记）
-- ----------------------------------------------------------------------------
--   · 本闸只按 `event_root_key = v_key` 归属（新协议行）。`event_root_key IS NULL` 的**历史行**
--     （0005 之前写入）不被本闸命中 ⇒ 仍走 C7 的历史回退分支（按键精确等值 + `split_part` 前缀），
--     **行为不变**（该路径本迁移一行未改）。
--   · 闸命中时仍会按 R79 全序对事件涉及的账户取 `FOR UPDATE`（因为它位于 C4 之后）——这是本单
--     明确允许的（「在信封/格式校验与必要的账户存在性/加锁之后」），且是命题 2 收益的来源。
--   · 本闸**不改变**任何错误码、响应形状与字段名：R52①/R52② 的 details 形状与 C7 逐字相同。
--   · 本迁移**不追溯**任何历史行、不改任何数据。
--   · 幂等：只 `CREATE OR REPLACE` 一个函数 + 幂等 `DO` ⇒ 可重跑（`migrate.ts` 重跑报 `skipped`）。
-- ============================================================================

CREATE OR REPLACE FUNCTION ledger_post_event(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  -- 信封
  v_op            text;
  v_key           text;
  v_fp            text;
  v_memo          text;
  v_ref_type      text;
  v_ref_id        bigint;
  v_platform      boolean;
  -- 分录工作区
  v_entries       jsonb := '[]'::jsonb;   -- 归一化后的分录列表
  v_n             int := 0;
  v_i             int;
  v_j             int;
  v_e             jsonb;
  v_e_uid         bigint;
  v_e_cid         bigint;
  v_e_delta       bigint;
  v_e_frz         bigint;
  v_e_kind        text;
  v_e_ref_type    text;
  v_e_ref_id      bigint;
  v_e_rev         bigint;
  v_e_key         text;
  v_e_fp          text;
  v_e_memo        text;
  v_bal_after     bigint[] := '{}';       -- 每条分录的 balance_after（推演值）
  v_frz_after     bigint[] := '{}';       -- 每条分录的 frozen_after（推演值）
  v_rec           record;                 -- 通用记录变量
  -- 账户槽位（数组序 = 加锁序 = uid 升序）
  v_slot_u        bigint[] := '{}';
  v_slot_c        bigint[] := '{}';
  v_slot_b        bigint[] := '{}';
  v_slot_f        bigint[] := '{}';
  v_slot_n        int := 0;
  v_slot          int;
  v_tmp_b         bigint;
  v_tmp_f         bigint;
  v_cur_bal       bigint;
  v_cur_frz       bigint;
  v_trace         jsonb := '[]'::jsonb;   -- 加锁顺序取证（R79）
  -- 币种
  v_cur           currency;
  v_sym           text;
  v_supply_before bigint;
  v_cap           bigint;
  v_amount        bigint;
  v_cap_arg       bigint;
  v_cur_op        text;
  -- 账务
  v_kind          text;
  v_payee_kind    text;
  v_from          bigint;
  v_to            bigint;
  v_uid           bigint;
  v_cid           bigint;
  v_is_forfeit    boolean;
  -- 不变式
  v_sum_d         bigint := 0;
  v_sum_f         bigint := 0;
  v_has_mb        boolean := false;
  -- 写入
  v_row           ledger_entry;
  v_out           jsonb := '[]'::jsonb;
  v_first_txid    bigint;
  v_stored_fp     text;
  -- 0012：重放前置闸（只读；C4 账户加锁之后、C5 余额/冻结闸之前）
  v_gate_txid     bigint;
  v_gate_fp       text;
  -- 异常映射
  v_cname         text;
  v_msg           text;
  v_state         text;
  v_detail        text;
  v_hint          text;
  -- P1f（F3①）语句预算
  v_budget_ms     int := 0;
  v_deadline      timestamptz := NULL;
  -- P1f（F1②/F2③）归属与数值域
  v_ins_role      text := NULL;           -- 'root' | 'derived'（唯一冲突归类用）
  v_stored_root   text;
  v_root_txid     bigint;
  v_root_is_new   boolean := false;       -- 根行是否由 0005 之后的协议写入（归属列非空）
  v_ek            text;                   -- P1i：entries[].idempotency_key 的字符集闸工作变量
  v_sum_d_num     numeric := 0;
  v_sum_f_num     numeric := 0;
  v_new_bal_num   numeric;
  v_new_frz_num   numeric;
  v_bucket        jsonb;
  v_details       jsonb;
BEGIN
  -- ---------------------------------------------------------------- C0 信封校验
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'payload', 'reason', 'BAD_TYPE'));
  END IF;

  v_op := payload->>'op';
  IF v_op IS NULL OR v_op NOT IN ('mint', 'transfer', 'hold', 'hold_release', 'settle', 'entries') THEN
    -- §14.1 无「op 非法」专用码 ⇒ 按 §14.3 借用纪律：借 400 类 + 前缀化 reason
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'op', 'value', COALESCE(v_op, 'null'), 'reason', 'UNKNOWN_OP'));
  END IF;

  -- R49/R52③：写路径必须带键；前缀强制
  IF NOT (payload ? 'idempotency_key') OR jsonb_typeof(payload->'idempotency_key') <> 'string'
     OR btrim(payload->>'idempotency_key') = '' THEN
    PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_REQUIRED', '{}'::jsonb);
  END IF;
  v_key := btrim(payload->>'idempotency_key');
  IF length(v_key) > 256 THEN
    PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID', jsonb_build_object('reason', 'TOO_LONG'));
  END IF;
  IF v_key !~ '^(biz|cm|cli|ops):' THEN
    PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
      jsonb_build_object('reason', 'PREFIX_REQUIRED', 'provided', left(v_key, 8)));
  END IF;
  -- ============================== P1f（F1①）**核心修复：键字符集收紧** ==============================
  -- 调用方键**禁止**出现内部派生键的分隔符 `#`（与禁止控制字符）。
  -- ⇒ 「调用方键集合 K」与「内部派生键集合 D = { k || '#' || i | k ∈ K, i ≥ 2 }」按构造互斥：
  --     · 任一合法调用方键不含 '#'；
  --     · 任一派生键 = 根键 + '#' + 十进制序号 ⇒ 恰含一个 '#'，其位置 = len(根键)；
  --     · 两个派生键相等 ⇒ 首个 '#' 位置相同 ⇒ 根键相同且序号相同（单射）。
  --   ⇒ 调用方**无法**构造出与任何内部派生键相等的键（覆盖全部入参形状：mint/transfer/
  --     hold/hold_release/settle/entries 六个 op 的 idempotency_key 都走这一条闸）。
  IF position('#' IN v_key) > 0 THEN
    PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID', jsonb_build_object(
      'reason', 'RESERVED_SEPARATOR', 'value', left(v_key, 40),
      'note', 'char # is reserved for internal derived entry keys (<key>#<i>)'));
  END IF;
  IF v_key ~ '[[:cntrl:]]' THEN
    PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID', jsonb_build_object('reason', 'CONTROL_CHARACTER'));
  END IF;

  -- P1i（补 M37/M50 的覆盖面）：键字符集规则作用于**每一个 idempotency_key 位置**，
  -- 包括 `entries[].idempotency_key`（若调用方给出）。理由同 ①：函数内部派生 `<key>#<i>`，
  -- 「调用方键空间」必须与「派生键空间」按构造互斥 —— 调用方在**任何** idempotency_key
  -- 字段里塞 '#' 都在试图破坏该互斥（修前实测：entries 逐条键的 '#' 被静默忽略 ⇒ 7 种 op
  -- 形状里最后一种是「静默接受」而非 400）。
  -- 说明：逐条 `idempotency_key` **不是** DB 契约字段（函数自行派生，值被忽略）；本条只做
  -- **硬约束**（禁 '#' / 禁控制字符 / 必须是 JSON 字符串），不引入前缀或长度等事件级规则
  -- ⇒ 对既有调用方零影响（TS 侧 `entryToPayload` 从不发该字段）。
  IF jsonb_typeof(payload->'entries') = 'array' THEN
    FOR v_i IN 0..jsonb_array_length(payload->'entries') - 1 LOOP
      IF jsonb_typeof(payload->'entries'->v_i->'idempotency_key') <> 'null' THEN
        IF jsonb_typeof(payload->'entries'->v_i->'idempotency_key') <> 'string' THEN
          PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID', jsonb_build_object(
            'reason', 'NOT_STRING', 'field', 'entries[' || v_i || '].idempotency_key',
            'provided_type', jsonb_typeof(payload->'entries'->v_i->'idempotency_key')));
        END IF;
        v_ek := btrim(payload->'entries'->v_i->>'idempotency_key');
        IF position('#' IN v_ek) > 0 THEN
          PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID', jsonb_build_object(
            'reason', 'RESERVED_SEPARATOR', 'field', 'entries[' || v_i || '].idempotency_key',
            'value', left(v_ek, 40),
            'note', 'char # is reserved for internal derived entry keys (<key>#<i>)'));
        END IF;
        IF v_ek ~ '[[:cntrl:]]' THEN
          PERFORM ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID', jsonb_build_object(
            'reason', 'CONTROL_CHARACTER', 'field', 'entries[' || v_i || '].idempotency_key'));
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- R53：指纹只作用于事件第 1 条分录；可为 NULL（§19.6：未传指纹 = 同键即重放）
  IF payload ? 'request_fingerprint' AND jsonb_typeof(payload->'request_fingerprint') = 'string' THEN
    v_fp := NULLIF(payload->>'request_fingerprint', '');
  ELSE
    v_fp := NULL;
  END IF;

  -- P1f（F2④）：memo 只接受字符串（0004 把深层嵌套对象**静默**转成 JSON 文本存进 memo）
  v_memo := COALESCE(ledger_optional_text(payload, 'memo', 'memo'), '');

  -- R18：ref_type / ref_id 成对；ref_type 必须在白名单内
  IF jsonb_typeof(payload->'ref_type') = 'string' AND payload->>'ref_type' <> '' THEN
    v_ref_type := payload->>'ref_type';
    IF jsonb_typeof(payload->'ref_id') = 'string' AND payload->>'ref_id' <> '' THEN
      v_ref_id := ledger_int_amount(payload->>'ref_id', 'ref_id');
    ELSE
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'ref_type/ref_id', 'reason', 'REF_PAIR_MISMATCH'));
    END IF;
    IF v_ref_type NOT IN ('job','listing','listing_order','market_order','market_trade',
                          'currency','commission_payout','system') THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'ref_type', 'value', v_ref_type, 'reason', 'NOT_IN_WHITELIST'));
    END IF;
  ELSE
    IF jsonb_typeof(payload->'ref_id') = 'string' AND payload->>'ref_id' <> '' THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'ref_type/ref_id', 'reason', 'REF_PAIR_MISMATCH'));
    END IF;
    v_ref_type := NULL;
    v_ref_id := NULL;
  END IF;

  -- ---------------------------------------------------------------- C1 函数内自证预算（P1f / F3①）
  -- 0004 在此处 `set_config('statement_timeout','10000',true)`：**对当前这条语句无效**
  -- （statement_timeout 在语句开始时武装；实测同语句 4181ms 不被取消）⇒ 该假上限已删除。
  -- 取而代之：预算 deadline + 每次等锁前把 lock_timeout 压到「剩余预算」（lock_timeout 是
  -- **逐次获取**生效的，实测有效）⇒ 整条语句的等待上界被钳在 10s 预算内（最坏情况从
  -- 「16 账户 × 3s ≈ 48s」降到 ≤ 预算 + 一次取锁）。
  v_budget_ms := ledger_stmt_budget_ms();
  v_deadline  := clock_timestamp() + ((v_budget_ms::text || ' milliseconds')::interval);
  PERFORM ledger_arm_lock_timeout(v_deadline, 'start');

  -- ================================================================ C2 按 op 组装分录
  IF v_op = 'mint' THEN
    v_uid := ledger_uid_arg(ledger_strict_text(payload, 'uid', 'uid'), 'uid');
    v_cid := ledger_cid_arg(ledger_strict_text(payload, 'cid', 'cid'));
    -- R83：mint 必须先锁 currency 行（再动 account），顺序不可颠倒；F3①：加锁前后查预算
    PERFORM ledger_arm_lock_timeout(v_deadline, 'currency:for-update');
    SELECT * INTO v_cur FROM currency WHERE cid = v_cid FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_cid::text));
    END IF;
    PERFORM ledger_check_budget(v_deadline, 'currency:locked');
    v_trace := v_trace || to_jsonb('currency:' || v_cid::text);
    v_sym := v_cur.symbol;

    -- 与旧 TS 同序：先解析金额（需要 decimals），再判状态矩阵
    v_amount := ledger_payload_amount(payload, v_cur.decimals, 'amount', v_cid::text);
    PERFORM ledger_assert_currency_op(v_cur, 'mint');   -- R28 + R26

    -- R23 授权：owner 自铸；$ (owner_uid = 0) 仅平台受信任路径
    -- P1f（F2）：platform 只接受 JSON boolean（0004 的 (->>::boolean) 会把 'maybe' 炸成 22P02/500）
    v_platform := COALESCE(ledger_optional_bool(payload, 'platform', 'platform'), false);
    IF v_cur.owner_uid > 0 THEN
      IF v_uid <> v_cur.owner_uid THEN
        PERFORM ledger_raise('LEDGER_UNAUTHORIZED_MINT', jsonb_build_object(
          'cid', v_cur.cid::text, 'owner_uid', v_cur.owner_uid::text,
          'actor_uid', v_uid::text, 'platform', v_platform));
      END IF;
    ELSIF NOT v_platform THEN
      PERFORM ledger_raise('LEDGER_UNAUTHORIZED_MINT', jsonb_build_object(
        'cid', v_cur.cid::text, 'owner_uid', v_cur.owner_uid::text,
        'actor_uid', v_uid::text, 'platform', false));
    END IF;
    IF v_uid < 0 THEN
      PERFORM ledger_raise('LEDGER_RESERVED_UID',
        jsonb_build_object('field', 'uid', 'uid', v_uid::text, 'reason', 'MINT_TO_POOL'));
    END IF;

    -- R24 供给上限（$ 的 supply_cap = NULL ⇒ 无限）；P1f（F2③）：numeric 比较避免加法溢出
    v_supply_before := v_cur.total_supply;
    v_cap := v_cur.supply_cap;
    IF v_cap IS NOT NULL AND v_supply_before::numeric + v_amount::numeric > v_cap::numeric THEN
      PERFORM ledger_raise('LEDGER_SUPPLY_CAP_EXCEEDED', jsonb_build_object(
        'cid', v_cur.cid::text, 'symbol', v_cur.symbol, 'total_supply', v_supply_before::text,
        'supply_cap', v_cap::text, 'requested', v_amount::text));
    END IF;

    v_entries := jsonb_build_array(ledger_norm_entry(
      v_uid, v_cid, v_amount, 0, 'mint', v_ref_type, v_ref_id, v_memo, NULL, v_key, v_fp));

  ELSIF v_op = 'transfer' THEN
    v_from := ledger_uid_arg(ledger_strict_text(payload, 'from_uid', 'fromUid'), 'fromUid');
    v_to   := ledger_uid_arg(ledger_strict_text(payload, 'to_uid', 'toUid'), 'toUid');
    v_cid  := ledger_cid_arg(ledger_strict_text(payload, 'cid', 'cid'));
    -- R100 用户请求不得命中平台账户；§19.1 例外：**仅 uid = -3 允许以 transfer 出账**
    IF v_from <= 0 AND v_from <> -3 THEN
      PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
        'field', 'fromUid', 'uid', v_from::text, 'kind', 'transfer',
        'reason', 'PLATFORM_TRANSFER_DEBIT_FORBIDDEN'));
    END IF;
    IF v_to <= 0 THEN
      PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
        'field', 'toUid', 'uid', v_to::text, 'kind', 'transfer',
        'reason', 'PLATFORM_TRANSFER_CREDIT_FORBIDDEN'));
    END IF;
    IF v_from = v_to THEN
      PERFORM ledger_raise('LEDGER_SELF_TRANSFER',
        jsonb_build_object('uid', v_from::text, 'cid', v_cid::text));
    END IF;
    SELECT * INTO v_cur FROM currency WHERE cid = v_cid;   -- 只读（转账不需锁 currency 行）
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_cid::text));
    END IF;
    PERFORM ledger_assert_currency_op(v_cur, 'transfer');   -- R28：四态全可
    v_sym := v_cur.symbol;
    v_amount := ledger_payload_amount(payload, v_cur.decimals, 'amount', v_cid::text);
    v_entries := jsonb_build_array(
      ledger_norm_entry(v_from, v_cid, -v_amount, 0, 'transfer', v_ref_type, v_ref_id, v_memo, NULL, v_key, v_fp),
      ledger_norm_entry(v_to,   v_cid,  v_amount, 0, 'transfer', v_ref_type, v_ref_id, v_memo, NULL,
                        v_key || '#2', NULL));

  ELSIF v_op IN ('hold', 'hold_release') THEN
    v_uid := ledger_uid_arg(ledger_strict_text(payload, 'uid', 'uid'), 'uid');
    v_cid := ledger_cid_arg(ledger_strict_text(payload, 'cid', 'cid'));
    IF v_uid <= 0 THEN
      PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
        'field', 'uid', 'uid', v_uid::text, 'kind', v_op, 'reason', 'PLATFORM_HOLD_FORBIDDEN'));
    END IF;
    -- R37：不存在「用户手动冻结自己余额」⇒ 没有业务单就不给冻 / 解冻
    IF v_ref_type IS NULL OR v_ref_id IS NULL THEN
      PERFORM ledger_raise('LEDGER_HOLD_NOT_ALLOWED', jsonb_build_object(
        'uid', v_uid::text, 'cid', v_cid::text, 'reason', 'BUSINESS_REF_REQUIRED'));
    END IF;
    SELECT * INTO v_cur FROM currency WHERE cid = v_cid;
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_cid::text));
    END IF;
    PERFORM ledger_assert_currency_op(v_cur, v_op);
    v_sym := v_cur.symbol;
    v_amount := ledger_payload_amount(payload, v_cur.decimals, 'amount', v_cid::text);

    -- R36：业务表证明的在冻额上界（提供了就校验）
    v_cap_arg := ledger_payload_cap(payload, 'business_frozen_cap');
    IF v_cap_arg IS NOT NULL AND v_amount::numeric > v_cap_arg::numeric THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_FROZEN', jsonb_build_object(
        'uid', v_uid::text, 'cid', v_cid::text, 'required', v_amount::text,
        'available', v_cap_arg::text, 'reason', 'business_frozen_cap'));
    END IF;

    IF v_op = 'hold' THEN
      v_entries := jsonb_build_array(
        ledger_norm_entry(v_uid, v_cid, -v_amount, 0, 'hold', v_ref_type, v_ref_id, v_memo, NULL, v_key, v_fp),
        ledger_norm_entry(v_uid, v_cid, 0, v_amount, 'hold', v_ref_type, v_ref_id, v_memo, NULL,
                          v_key || '#2', NULL));
    ELSE
      v_entries := jsonb_build_array(
        ledger_norm_entry(v_uid, v_cid, 0, -v_amount, 'hold_release', v_ref_type, v_ref_id, v_memo, NULL, v_key, v_fp),
        ledger_norm_entry(v_uid, v_cid, v_amount, 0, 'hold_release', v_ref_type, v_ref_id, v_memo, NULL,
                          v_key || '#2', NULL));
    END IF;

  ELSIF v_op = 'settle' THEN
    v_kind := payload->>'kind';
    IF jsonb_typeof(payload->'kind') <> 'string'
       OR NOT ledger_kind_ok(COALESCE(v_kind, ''), true) THEN
      PERFORM ledger_raise('LEDGER_UNKNOWN_KIND', jsonb_build_object(
        'kind', COALESCE(v_kind, 'null'), 'reason', 'NOT_IN_FROZEN_SETTLE_WHITELIST'));
    END IF;
    v_from := ledger_uid_arg(ledger_strict_text(payload, 'from_uid', 'fromUid'), 'fromUid');
    v_cid  := ledger_cid_arg(ledger_strict_text(payload, 'cid', 'cid'));
    IF v_from <= 0 THEN
      PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
        'field', 'fromUid', 'uid', v_from::text, 'kind', v_kind, 'reason', 'PLATFORM_SETTLE_FORBIDDEN'));
    END IF;

    v_is_forfeit := (v_kind = 'hold_forfeit');
    IF v_is_forfeit THEN
      -- R38：罚没去向恒为平台罚没账户 uid = -3
      IF jsonb_typeof(payload->'to_uid') = 'string' AND payload->>'to_uid' <> '' THEN
        v_to := ledger_int_amount(payload->>'to_uid', 'toUid');
        IF v_to <> -3 THEN
          PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
            'field', 'toUid', 'uid', v_to::text, 'reason', 'FORFEIT_MUST_GO_TO_-3'));
        END IF;
      ELSE
        v_to := -3;
      END IF;
    ELSE
      v_to := ledger_uid_arg(ledger_strict_text(payload, 'to_uid', 'toUid'), 'toUid');
      IF v_to <= 0 THEN
        PERFORM ledger_raise('LEDGER_RESERVED_UID', jsonb_build_object(
          'field', 'toUid', 'uid', v_to::text, 'kind', v_kind, 'reason', 'PLATFORM_SETTLE_CREDIT_FORBIDDEN'));
      END IF;
    END IF;
    IF v_from = v_to THEN
      PERFORM ledger_raise('LEDGER_SELF_TRANSFER',
        jsonb_build_object('uid', v_from::text, 'cid', v_cid::text));
    END IF;

    SELECT * INTO v_cur FROM currency WHERE cid = v_cid;
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_cid::text));
    END IF;
    PERFORM ledger_assert_currency_op(v_cur, 'settle');    -- §19.3：结算类仅 listed
    v_sym := v_cur.symbol;
    v_amount := ledger_payload_amount(payload, v_cur.decimals, 'amount', v_cid::text);

    v_cap_arg := ledger_payload_cap(payload, 'business_frozen_cap');
    IF v_cap_arg IS NOT NULL AND v_amount::numeric > v_cap_arg::numeric THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_FROZEN', jsonb_build_object(
        'uid', v_from::text, 'cid', v_cid::text, 'required', v_amount::text,
        'available', v_cap_arg::text, 'reason', 'business_frozen_cap'));
    END IF;

    -- 受款方 kind：调用方显式给出优先；缺省按 TS SETTLE_PAYEE_KIND 映射（purchase ⇒ sale）
    IF v_is_forfeit THEN
      v_payee_kind := v_kind;
    ELSE
      v_payee_kind := CASE v_kind
        WHEN 'purchase' THEN COALESCE(NULLIF(ledger_optional_text(payload, 'payee_kind', 'payee_kind'), ''), 'sale')
        ELSE COALESCE(NULLIF(ledger_optional_text(payload, 'payee_kind', 'payee_kind'), ''), v_kind) END;
      IF NOT ledger_kind_ok(v_payee_kind) THEN
        PERFORM ledger_raise('LEDGER_UNKNOWN_KIND', jsonb_build_object('kind', v_payee_kind));
      END IF;
    END IF;

    v_entries := jsonb_build_array(
      ledger_norm_entry(v_from, v_cid, 0, -v_amount, v_kind, v_ref_type, v_ref_id, v_memo, NULL, v_key, v_fp),
      ledger_norm_entry(v_to, v_cid, v_amount, 0, v_payee_kind, v_ref_type, v_ref_id, v_memo, NULL,
                        v_key || '#2', NULL));

  ELSE  -- ---------------------------------------------------------- op = 'entries'
    IF COALESCE(jsonb_typeof(payload->'entries'), 'missing') <> 'array'
       OR jsonb_array_length(payload->'entries') = 0 THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'entries', 'reason', 'NOT_A_NON_EMPTY_ARRAY'));
    END IF;
    IF jsonb_array_length(payload->'entries') > 32 THEN
      -- R64：单事务分录条数上限 32（借用 400 类 + 前缀化 reason，§14.3 纪律）
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
        'field', 'entries', 'reason', 'TOO_MANY_ENTRIES',
        'provided', jsonb_array_length(payload->'entries'), 'limit', 32));
    END IF;
    v_cur_op := NULLIF(ledger_optional_text(payload, 'currency_op', 'currency_op'), '');

    FOR v_i IN 0..jsonb_array_length(payload->'entries') - 1 LOOP
      v_e := payload->'entries' -> v_i;
      IF v_e IS NULL OR jsonb_typeof(v_e) <> 'object' THEN
        PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
          'field', 'entries[' || v_i || ']', 'reason', 'BAD_TYPE'));
      END IF;
      v_e_uid := ledger_uid_arg(ledger_strict_text(v_e, 'uid', 'entries[' || v_i || '].uid'),
                                'entries[' || v_i || '].uid');
      v_e_cid := ledger_cid_arg(ledger_strict_text(v_e, 'cid', 'cid'));
      v_e_kind := v_e->>'kind';
      IF jsonb_typeof(v_e->'kind') <> 'string' OR NOT ledger_kind_ok(COALESCE(v_e_kind, '')) THEN
        PERFORM ledger_raise('LEDGER_UNKNOWN_KIND', jsonb_build_object('kind', COALESCE(v_e_kind, 'null')));
      END IF;
      -- 金额列：一律字符串（R70：禁止 JSON number / 浮点）
      IF jsonb_typeof(v_e->'delta') <> 'string' THEN
        PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
          'field', 'entries[' || v_i || '].delta', 'reason', 'NOT_STRING'));
      END IF;
      v_e_delta := ledger_int_amount(v_e->>'delta', 'entries[' || v_i || '].delta');
      IF v_e ? 'frozen_delta' AND v_e->'frozen_delta' <> 'null'::jsonb THEN
        IF jsonb_typeof(v_e->'frozen_delta') <> 'string' THEN
          PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
            'field', 'entries[' || v_i || '].frozen_delta', 'reason', 'NOT_STRING'));
        END IF;
        v_e_frz := ledger_int_amount(v_e->>'frozen_delta', 'entries[' || v_i || '].frozen_delta');
      ELSE
        v_e_frz := 0;
      END IF;
      -- ledger_move_guard 前置判定
      IF v_e_delta = 0 AND v_e_frz = 0 THEN
        PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
          'field', 'delta/frozen_delta', 'reason', 'BOTH_ZERO', 'entry', 'entries[' || v_i || ']'));
      END IF;
      -- R18：ref 成对（逐条可覆盖 payload 级默认值）
      v_e_ref_type := COALESCE(NULLIF(v_e->>'ref_type', ''), v_ref_type);
      IF v_e_ref_type IS NULL THEN
        v_e_ref_id := NULL;
      ELSE
        IF jsonb_typeof(v_e->'ref_id') = 'string' AND v_e->>'ref_id' <> '' THEN
          v_e_ref_id := ledger_int_amount(v_e->>'ref_id', 'entries[' || v_i || '].ref_id');
        ELSIF v_ref_id IS NOT NULL THEN
          v_e_ref_id := v_ref_id;
        ELSE
          PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
            'field', 'ref_type/ref_id', 'reason', 'REF_PAIR_MISMATCH',
            'entry', 'entries[' || v_i || ']'));
        END IF;
        IF v_e_ref_type NOT IN ('job','listing','listing_order','market_order','market_trade',
                                'currency','commission_payout','system') THEN
          PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
            'field', 'entries[' || v_i || '].ref_type', 'value', v_e_ref_type, 'reason', 'NOT_IN_WHITELIST'));
        END IF;
      END IF;
      -- R20 冲正守卫（ledger_reversal_guard 的 DB 版；请求形状错误 ⇒ 400 借用）
      IF v_e ? 'reversal_of_txid' AND v_e->'reversal_of_txid' <> 'null'::jsonb
         AND v_e->>'reversal_of_txid' <> '' THEN
        IF jsonb_typeof(v_e->'reversal_of_txid') <> 'string' THEN
          PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
            'field', 'reversal_of_txid', 'reason', 'NOT_STRING'));
        END IF;
        v_e_rev := ledger_int_amount(v_e->>'reversal_of_txid', 'reversal_of_txid');
      ELSE
        v_e_rev := NULL;
      END IF;
      IF (v_e_kind = 'reversal') <> (v_e_rev IS NOT NULL) THEN
        PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
          'field', 'reversal_of_txid', 'reason', 'REVERSAL_GUARD', 'entry', 'entries[' || v_i || ']'));
      END IF;

      -- P1f（F2④）：逐条 memo 只接受字符串；缺省回落 payload 级 memo
      v_e_memo := ledger_optional_text(v_e, 'memo', 'entries[' || v_i || '].memo');

      v_e_key := CASE WHEN v_i = 0 THEN v_key ELSE v_key || '#' || (v_i + 1)::text END;
      v_e_fp  := CASE WHEN v_i = 0 THEN v_fp ELSE NULL END;

      v_entries := v_entries || ledger_norm_entry(
        v_e_uid, v_e_cid, v_e_delta, v_e_frz, v_e_kind, v_e_ref_type, v_e_ref_id,
        COALESCE(v_e_memo, v_memo), v_e_rev, v_e_key, v_e_fp);
    END LOOP;

    -- 币种存在性 + 可选状态矩阵（currency_op）+ R26（$ 恒 listed）
    FOR v_rec IN
      SELECT DISTINCT t.e->>'cid' AS cid_txt
        FROM jsonb_array_elements(v_entries) AS t(e)
       ORDER BY 1
    LOOP
      SELECT * INTO v_cur FROM currency WHERE cid = v_rec.cid_txt::bigint;
      IF NOT FOUND THEN
        PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_rec.cid_txt));
      END IF;
      IF v_cur_op IS NOT NULL THEN
        PERFORM ledger_assert_currency_op(v_cur, v_cur_op);
      ELSIF v_cur.cid = 1 AND v_cur.status <> 'listed' THEN
        PERFORM ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('cid', v_cur.cid::text, 'from', 'listed', 'to', v_cur.status));
      END IF;
      IF v_sym IS NULL THEN v_sym := v_cur.symbol; END IF;
    END LOOP;

    -- R34/R39：hold 家族的减方与增方必须是**同一账户同一币种**的两条
    FOR v_rec IN
      SELECT t.e->>'uid' AS g_uid, t.e->>'cid' AS g_cid, t.e->>'kind' AS g_kind
        FROM jsonb_array_elements(v_entries) AS t(e)
       WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund','listing_deposit')
       GROUP BY 1, 2, 3
      HAVING count(*) <> 2
    LOOP
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
        'field', 'entries', 'reason', 'HOLD_PAIR_REQUIRED',
        'uid', v_rec.g_uid, 'cid', v_rec.g_cid, 'kind', v_rec.g_kind));
    END LOOP;
  END IF;

  -- ---------------------------------------------------------------- C3 配对不变式（R41 / §19.2）
  -- P1f（F2③）：Σ 在 **numeric 域**求和（32 条 bigint 之和可超 bigint ⇒ 0004 会炸 22003/500）
  v_n := jsonb_array_length(v_entries);
  FOR v_i IN 0..v_n - 1 LOOP
    v_e := v_entries -> v_i;
    v_sum_d_num := v_sum_d_num + (v_e->>'delta')::numeric;
    v_sum_f_num := v_sum_f_num + (v_e->>'frozen_delta')::numeric;
    IF v_e->>'kind' IN ('mint', 'burn') THEN v_has_mb := true; END IF;
  END LOOP;
  IF v_sum_d_num > 9223372036854775807::numeric OR v_sum_d_num < (-9223372036854775808)::numeric
     OR v_sum_f_num > 9223372036854775807::numeric OR v_sum_f_num < (-9223372036854775808)::numeric THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', 'entries', 'reason', 'EVENT_SUM_OUT_OF_RANGE',
      'delta_sum', v_sum_d_num::text, 'frozen_delta_sum', v_sum_f_num::text));
  END IF;
  v_sum_d := v_sum_d_num::bigint;
  v_sum_f := v_sum_f_num::bigint;
  IF NOT v_has_mb AND (v_sum_d_num + v_sum_f_num) <> 0 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', 'entries', 'reason', 'EVENT_NOT_BALANCED',
      'delta_sum', v_sum_d::text, 'frozen_delta_sum', v_sum_f::text,
      'net_sum', (v_sum_d_num + v_sum_f_num)::text));
  END IF;

  -- 账户条数上限（R64：<= 16 个账户）
  SELECT count(*) INTO v_j FROM (
    SELECT DISTINCT t.e->>'uid', t.e->>'cid' FROM jsonb_array_elements(v_entries) AS t(e)) s;
  IF v_j > 16 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', 'entries', 'reason', 'TOO_MANY_ACCOUNTS', 'provided', v_j, 'limit', 16));
  END IF;

  -- ================================================================ C4 加锁（R79 全序）
  -- ① currency：已在 mint 分支按 cid 锁住（v_trace 首项即 `currency:<cid>`）；其余 op 只读
  -- ② account：按 uid 升序、同 uid 再 cid 升序；开户 0/0（R75）后 FOR UPDATE
  -- ③ 业务行：P3/P5 起在此处按主键升序追加（当前无业务表）
  FOR v_rec IN
    SELECT DISTINCT t.e->>'uid' AS u, t.e->>'cid' AS c
      FROM jsonb_array_elements(v_entries) AS t(e)
     ORDER BY 1, 2
  LOOP
    PERFORM ledger_arm_lock_timeout(v_deadline, 'account:insert');      -- F3①
    INSERT INTO account (uid, cid, balance, frozen) VALUES (v_rec.u::bigint, v_rec.c::bigint, 0, 0)
      ON CONFLICT (uid, cid) DO NOTHING;
    PERFORM ledger_arm_lock_timeout(v_deadline, 'account:for-update');  -- F3①
    SELECT balance, frozen INTO v_tmp_b, v_tmp_f
      FROM account WHERE uid = v_rec.u::bigint AND cid = v_rec.c::bigint FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_ACCOUNT_NOT_FOUND',
        jsonb_build_object('uid', v_rec.u, 'cid', v_rec.c));
    END IF;
    PERFORM ledger_check_budget(v_deadline, 'account:locked');          -- F3①
    v_slot_u := v_slot_u || v_rec.u::bigint;
    v_slot_c := v_slot_c || v_rec.c::bigint;
    v_slot_b := v_slot_b || v_tmp_b;
    v_slot_f := v_slot_f || v_tmp_f;
    v_slot_n := v_slot_n + 1;
    v_trace := v_trace || to_jsonb('account:' || v_rec.u || ':' || v_rec.c);
  END LOOP;

  -- ================================================================ C4.5 重放前置闸（0012 新增 · **只读**）
  -- 0012-REPLAY-PRE-GATE-BEGIN
  -- 为什么在这里（R51 / R52 / R63 的相对顺序，spec §7.1「函数内依次完成：信封校验 → 幂等占位 →
  --   按全序加锁 → 分录 → 余额/冻结更新 → 配对不变式」）：
  --   修前（0004/0005 实现）：幂等判定只在 C7（写入段之后），而 C5 的 R80 余额/冻结闸在它之前
  --   ⇒ 「同键重放」必须先「垫付得起」才拿得到重放结果。托管（frozen）被前一笔花光后，客户端
  --   超时重试拿到的是 LD002（LEDGER_INSUFFICIENT_FROZEN），而**不是** R52① 的
  --   200 + idempotent_replay:true ⇒ 调用方无法区分「已成功」与「余额不足」（幂等契约被破坏）。
  --   现在：在 **C5 余额/冻结闸之前、C4 账户加锁之后** 插一道只读前置闸；命中「键已存在」即按
  --   R52 短路（指纹同 / 未传指纹 ⇒ ① 重放；指纹异 ⇒ ② 409），**完全不跑 C5 的余额/冻结校验、
  --   也不写任何分录**（不进入 C6）。
  -- 为什么闸在 C4（加锁）之后，而不是更早 —— 可观测收益，不是口味：
  --   并发同键重试会在 C4 的行锁上等到首个事务提交；等到之后本闸这一次 SELECT 是**新语句** ⇒
  --   新快照 ⇒ **能看见**对方已提交的根行 ⇒ 重试同样得到 200 重放（若放在加锁之前则看不见，
  --   仍会掉进 C5 的 LD002）。该收益由探针用例 5b（分阶段竞态）钉住。
  -- ⚠️ 本闸**不取代** R51 的首条分录探针（见下方 C6 ①；spec §6.2 R51 明文「严禁『先 SELECT 查在
  --     不在，再 INSERT』」）：并发**两个全新**事件同键时，两者都可能 miss 本闸 ⇒ 权威仍是唯一约束
  --     `ledger_idem_uniq`；本闸只是「键已在库」的快路径（探针用例 5 钉住）。
  -- ⚠️ 本闸**不放宽 R63**：真正的新事件（miss 本闸）其余额/冻结校验仍在**本事务内**、且仍在
  --     `FOR UPDATE` 行锁**之后**执行（C5 位置与代码未动；探针用例 4 钉住）。
  -- 归属查询走**已有索引** `idx_ledger_event_root_key`（`ledger_entry (event_root_key)`）。
  SELECT t.txid, t.request_fingerprint
    INTO v_gate_txid, v_gate_fp
    FROM ledger_entry t
   WHERE t.event_root_key = v_key
   ORDER BY t.txid
   LIMIT 1;

  IF FOUND THEN
    -- R52②：同键 + 指纹不同 ⇒ 409（不执行、不改动任何数据；DETAIL 形状与 C7 的指纹冲突逐字相同）
    IF v_fp IS NOT NULL AND v_gate_fp IS NOT NULL AND v_fp <> v_gate_fp THEN
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT', jsonb_build_object(
        'idempotency_key', v_key, 'expected', v_gate_fp, 'actual', v_fp));
    END IF;

    -- R52①（+ §19.6 补丁：**未传指纹 ⇒ 同键一律按重放**）：返回既有结果；
    -- 零写入、零余额/冻结校验（C5 与 C6 一律不进入）
    SELECT COALESCE(jsonb_agg(ledger_entry_json(t) ORDER BY t.txid), '[]'::jsonb)
      INTO v_out
      FROM ledger_entry t
     WHERE t.event_root_key = v_key;

    IF jsonb_array_length(v_out) = 0 THEN
      -- 不可达（命中即至少 1 行）；保留为不变量断言（R108 缺陷告警语义）
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_REPLAY', jsonb_build_object(
        'idempotency_key', v_key, 'reason', 'replay_rows_disappeared'));
    END IF;
    IF (v_out->0->>'txid')::bigint IS DISTINCT FROM v_gate_txid THEN
      -- 构造保证：按 txid 升序命中的首行 = 根行 = 上面聚合结果的第 1 条 ⇒ 必等。
      -- 唯一能撞破它的输入 = 脏数据（同一 event_root_key 下存在 txid 更小的**非根**行）
      -- ⇒ 判「实现缺陷 / 脏数据」（R108），不得静默返回一条说不清来源的结果。
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_REPLAY', jsonb_build_object(
        'idempotency_key', v_key, 'reason', 'replay_root_txid_mismatch',
        'gate_txid', v_gate_txid::text, 'agg_first_txid', v_out->0->>'txid'));
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'idempotency_key', v_key,
      'txid', (v_out->0->>'txid'),
      'entries', v_out,
      'accounts', ledger_accounts_from_entries(v_out),
      'extra', '{}'::jsonb,
      'meta', jsonb_build_object('op', v_op, 'lock_trace', v_trace));
  END IF;
  -- 0012-REPLAY-PRE-GATE-END

  -- ================================================================ C5 推演 + 前置判定
  -- 按分录顺序滚动，逐条校验 R80（负余额 / 冻结不足）：与旧 TS postEntry 逐条落账同序
  v_bal_after := '{}';
  v_frz_after := '{}';
  FOR v_i IN 0..v_n - 1 LOOP
    v_e := v_entries -> v_i;
    v_e_uid   := (v_e->>'uid')::bigint;
    v_e_cid   := (v_e->>'cid')::bigint;
    v_e_delta := (v_e->>'delta')::bigint;
    v_e_frz   := (v_e->>'frozen_delta')::bigint;
    v_e_kind  := v_e->>'kind';

    v_slot := NULL;
    FOR v_j IN 1..v_slot_n LOOP
      IF v_slot_u[v_j] = v_e_uid AND v_slot_c[v_j] = v_e_cid THEN v_slot := v_j; EXIT; END IF;
    END LOOP;
    IF v_slot IS NULL THEN
      -- 不可能：C4 已按同一集合建槽；保留为不变量断言（R108 缺陷告警语义）
      PERFORM ledger_raise('LEDGER_ACCOUNT_NOT_FOUND',
        jsonb_build_object('uid', v_e_uid::text, 'cid', v_e_cid::text, 'reason', 'SLOT_MISSING'));
    END IF;

    v_cur_bal  := v_slot_b[v_slot];
    v_cur_frz  := v_slot_f[v_slot];

    -- R101/R103 平台账户 kind 白名单（方向 = 该分录的变动方向；与旧 TS 逐格一致且同序：
    -- 旧 TS 在锁账户前先判白名单，故此处**先判白名单再判余额**以保持错误优先级不变）
    IF v_e_delta > 0 OR v_e_frz > 0 THEN
      PERFORM ledger_assert_platform_mutation(v_e_uid, v_e_kind, 'credit');
    END IF;
    IF v_e_delta < 0 OR v_e_frz < 0 THEN
      PERFORM ledger_assert_platform_mutation(v_e_uid, v_e_kind, 'debit');
    END IF;

    -- P1f（F2③）：推演在 numeric 域做，先查 bigint 界（余额 + 大额 delta 可溢出 ⇒ 0004 会 22003）
    v_new_bal_num := v_cur_bal::numeric + v_e_delta::numeric;
    v_new_frz_num := v_cur_frz::numeric + v_e_frz::numeric;
    IF v_new_bal_num > 9223372036854775807::numeric OR v_new_bal_num < (-9223372036854775808)::numeric
       OR v_new_frz_num > 9223372036854775807::numeric OR v_new_frz_num < (-9223372036854775808)::numeric THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
        'field', 'balance', 'uid', v_e_uid::text, 'cid', v_e_cid::text,
        'reason', 'BALANCE_OUT_OF_RANGE', 'balance', v_cur_bal::text, 'delta', v_e_delta::text));
    END IF;

    -- R80：库内先判，CHECK（account_bal_guard / ledger_after_guard）仅作兵底
    IF v_new_bal_num < 0 THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_BALANCE', jsonb_build_object(
        'uid', v_e_uid::text, 'cid', v_e_cid::text,
        'required', (-v_e_delta)::text, 'available', v_cur_bal::text));
    END IF;
    IF v_new_frz_num < 0 THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_FROZEN', jsonb_build_object(
        'uid', v_e_uid::text, 'cid', v_e_cid::text,
        'required', (-v_e_frz)::text, 'available', v_cur_frz::text));
    END IF;

    v_slot_b[v_slot] := v_new_bal_num::bigint;
    v_slot_f[v_slot] := v_new_frz_num::bigint;
    v_bal_after := v_bal_after || (v_new_bal_num::bigint);
    v_frz_after := v_frz_after || (v_new_frz_num::bigint);
  END LOOP;

  -- ================================================================ C6 写入（R74：先分录后账户）
  -- 0004 在此处套了一个 `BEGIN…EXCEPTION`（只覆盖写入段）并把 C0–C5 的裸 SQLSTATE 漏在块外；
  -- P1f 改为「整个函数体一个 EXCEPTION 处理器」⇒ 本段不再单独套块（同时修掉 0004 的一处
  -- 隐蔽缺陷：C6 内 `ledger_raise` 抛出的自家 LD 码会被那一层的 WHEN OTHERS 改写成 LD024）。
  PERFORM ledger_check_budget(v_deadline, 'write:start');               -- F3①
  v_first_txid := NULL;
  -- ① 幂等探针 = 事件第 1 条分录（R51：靠唯一约束，禁止「先查后插」）
  --    P1f（F1②）：同时写入事件根键归属列 event_root_key = v_key（事件内所有分录同值）
  v_ins_role := 'root';
  INSERT INTO ledger_entry
    (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id,
     idempotency_key, request_fingerprint, reversal_of_txid, memo, event_root_key)
  VALUES
    ((v_entries->0->>'uid')::bigint, (v_entries->0->>'cid')::bigint,
     (v_entries->0->>'delta')::bigint, (v_entries->0->>'frozen_delta')::bigint,
     v_bal_after[1], v_frz_after[1], v_entries->0->>'kind',
     NULLIF(v_entries->0->>'ref_type', ''),
     NULLIF(v_entries->0->>'ref_id', '')::bigint,
     v_entries->0->>'idempotency_key',
     NULLIF(v_entries->0->>'request_fingerprint', ''),
     NULLIF(v_entries->0->>'reversal_of_txid', '')::bigint,
     COALESCE(v_entries->0->>'memo', ''), v_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.txid IS NOT NULL THEN
    v_first_txid := v_row.txid;
    v_out := v_out || ledger_entry_json(v_row);
    v_row := NULL;

    -- ② 其余分录（派生键 <key>#<i>，i >= 2）—— 键的**互斥性**由 C0 的 '#' 禁令保证
    v_ins_role := 'derived';
    FOR v_i IN 1..v_n - 1 LOOP
      v_e := v_entries -> v_i;
      INSERT INTO ledger_entry
        (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id,
         idempotency_key, request_fingerprint, reversal_of_txid, memo, event_root_key)
      VALUES
        ((v_e->>'uid')::bigint, (v_e->>'cid')::bigint,
         (v_e->>'delta')::bigint, (v_e->>'frozen_delta')::bigint,
         v_bal_after[v_i + 1], v_frz_after[v_i + 1], v_e->>'kind',
         NULLIF(v_e->>'ref_type', ''), NULLIF(v_e->>'ref_id', '')::bigint,
         v_e->>'idempotency_key', NULLIF(v_e->>'request_fingerprint', ''),
         NULLIF(v_e->>'reversal_of_txid', '')::bigint, COALESCE(v_e->>'memo', ''), v_key)
      RETURNING * INTO v_row;
      v_out := v_out || ledger_entry_json(v_row);
    END LOOP;
    v_ins_role := NULL;

    -- ③ 账户（锁序内逐个 UPDATE；逐列等于该账户最新分录快照 ⇒ 过 trg_account_guard）
    FOR v_i IN 1..v_slot_n LOOP
      UPDATE account
         SET balance = v_slot_b[v_i], frozen = v_slot_f[v_i],
             version = version + 1, time_updated = now()
       WHERE uid = v_slot_u[v_i] AND cid = v_slot_c[v_i];
      IF NOT FOUND THEN
        PERFORM ledger_raise('LEDGER_ACCOUNT_NOT_FOUND',
          jsonb_build_object('uid', v_slot_u[v_i]::text, 'cid', v_slot_c[v_i]::text));
      END IF;
    END LOOP;

    -- ④ mint 双写 currency.total_supply（R9：必须同事务）
    IF v_op = 'mint' THEN
      UPDATE currency SET total_supply = total_supply + v_amount, time_updated = now()
       WHERE cid = v_cid;
    END IF;
  END IF;

  -- ================================================================ C7 幂等重放（R51③④ / R52）
  -- P1f（F1②③）**核心修复**：重放不再用字符串前缀算术匹配「键族」，而是
  --   ① 必须存在**键 = 根键**的根行（`idempotency_key = v_key`）；
  --   ② 该行记录的归属 `event_root_key` 必须等于 v_key（新协议行）或为 NULL 且其键的
  --      派生规则根恰为 v_key（0005 之前的历史行）；否则 ⇒ **409**（`KEY_OWNED_BY_ANOTHER_EVENT_ROOT`），
  --      **绝不**把他人事件的分录当成自己的重放结果返回；
  --   ③ 指纹取自事件自己的根行 ⇒ 不可能再被「派生行指纹恒 NULL」短路。
  IF v_first_txid IS NULL THEN
    SELECT t.request_fingerprint,
           (t.event_root_key IS NOT NULL) AS is_new_protocol,
           COALESCE(t.event_root_key, split_part(t.idempotency_key, '#'::text, 1)) AS root_of_row,
           t.txid
      INTO v_stored_fp, v_root_is_new, v_stored_root, v_root_txid
      FROM ledger_entry t
     WHERE t.idempotency_key = v_key
     ORDER BY t.txid
     LIMIT 1;

    IF NOT FOUND THEN
      -- 唯一索引看见了冲突行，但它落在本语句快照之外（并发同键）
      -- ⇒ 交给 TS 侧重发同一条语句（第二次即新快照，正常返回既有结果）
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_REPLAY', jsonb_build_object(
        'idempotency_key', v_key, 'reason', 'replay_row_not_visible_in_statement_snapshot'));
    END IF;

    -- 归属校验：键被写入，但归属不是本键 ⇒ 他人事件占用（历史 '#' 派生键数据）⇒ 409
    IF v_stored_root IS DISTINCT FROM v_key THEN
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT', jsonb_build_object(
        'idempotency_key', v_key, 'reserved_by_event_root', v_stored_root,
        'reason', 'KEY_OWNED_BY_ANOTHER_EVENT_ROOT'));
    END IF;

    -- 事件自己的分录集合：新协议行按**归属列等值**（精确，索引可用）；历史行按派生规则回退
    IF v_root_is_new THEN
      SELECT COALESCE(jsonb_agg(ledger_entry_json(t) ORDER BY t.txid), '[]'::jsonb)
        INTO v_out
        FROM ledger_entry t
       WHERE t.event_root_key = v_key;
    ELSE
      SELECT COALESCE(jsonb_agg(ledger_entry_json(t) ORDER BY t.txid), '[]'::jsonb)
        INTO v_out
        FROM ledger_entry t
       WHERE t.idempotency_key = v_key
          OR (t.event_root_key IS NULL
              AND left(t.idempotency_key, length(v_key) + 1) = v_key || '#');
    END IF;

    IF jsonb_array_length(v_out) = 0 THEN
      -- 理论上不可达（根行存在 ⇒ 至少 1 条）；保留为不变量断言
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_REPLAY', jsonb_build_object(
        'idempotency_key', v_key, 'reason', 'replay_rows_disappeared'));
    END IF;

    -- R52②：同键但指纹不同 ⇒ 409（未传指纹 = 按重放，§19.6）
    IF v_fp IS NOT NULL AND v_stored_fp IS NOT NULL AND v_fp <> v_stored_fp THEN
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT', jsonb_build_object(
        'idempotency_key', v_key, 'expected', v_stored_fp, 'actual', v_fp));
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'idempotency_key', v_key,
      'txid', (v_out->0->>'txid'),
      'entries', v_out,
      'accounts', ledger_accounts_from_entries(v_out),
      'extra', '{}'::jsonb,
      'meta', jsonb_build_object('op', v_op, 'lock_trace', v_trace));
  END IF;

  -- ================================================================ C8 首次生效的返回
  IF v_op = 'mint' THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent_replay', false, 'idempotency_key', v_key,
      'txid', v_first_txid::text, 'entries', v_out,
      'accounts', ledger_accounts_from_entries(v_out),
      'extra', jsonb_build_object(
        'supply_before', v_supply_before::text,
        'supply_after', (v_supply_before::numeric + v_amount::numeric)::text,
        'supply_cap', CASE WHEN v_cap IS NULL THEN NULL ELSE v_cap::text END),
      'meta', jsonb_build_object('op', v_op, 'lock_trace', v_trace));
  ELSIF v_op IN ('transfer', 'hold', 'hold_release') THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent_replay', false, 'idempotency_key', v_key,
      'txid', v_first_txid::text, 'entries', v_out,
      'accounts', ledger_accounts_from_entries(v_out),
      'extra', jsonb_build_object('amount', v_amount::text, 'symbol', v_sym),
      'meta', jsonb_build_object('op', v_op, 'lock_trace', v_trace));
  ELSIF v_op = 'settle' THEN
    RETURN jsonb_build_object(
      'ok', true, 'idempotent_replay', false, 'idempotency_key', v_key,
      'txid', v_first_txid::text, 'entries', v_out,
      'accounts', ledger_accounts_from_entries(v_out),
      'extra', jsonb_build_object('amount', v_amount::text, 'symbol', v_sym,
                                  'kind', v_kind, 'payee_kind', v_payee_kind),
      'meta', jsonb_build_object('op', v_op, 'lock_trace', v_trace));
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent_replay', false, 'idempotency_key', v_key,
    'txid', v_first_txid::text, 'entries', v_out,
    'accounts', ledger_accounts_from_entries(v_out),
    'extra', jsonb_build_object('entries', v_n::text, 'symbol', v_sym),
    'meta', jsonb_build_object('op', v_op, 'lock_trace', v_trace));

-- ============================================================================
-- 唯一 EXCEPTION 处理器（P1f / F2①②、F3②③④）
-- ============================================================================
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state  = RETURNED_SQLSTATE,
      v_msg    = MESSAGE_TEXT,
      v_detail = PG_EXCEPTION_DETAIL,
      v_hint   = PG_EXCEPTION_HINT,
      v_cname  = CONSTRAINT_NAME;

    -- ① 自家命名错误（LD001..LD033）：**原样透传**（§14.1 的唯一 DB 侧投影，禁止二次归类）
    IF v_state IS NOT NULL AND left(v_state, 2) = 'LD' THEN
      RAISE;
    END IF;

    -- ② P0001：append-only / account_guard 触发器主动 RAISE（逐字保留 0004 的口径）
    IF v_state = 'P0001' THEN
      IF v_msg ILIKE '%append-only%' THEN
        PERFORM ledger_raise('LEDGER_APPEND_ONLY_VIOLATION', '{}'::jsonb);
      ELSIF v_msg ~* 'account' THEN
        PERFORM ledger_raise('LEDGER_ACCOUNT_GUARD_VIOLATION', '{}'::jsonb);
      ELSE
        PERFORM ledger_raise('LEDGER_TRANSACTION_REQUIRED', jsonb_build_object(
          'cause', 'P0001', 'reason', 'unclassified_db_raise', 'error_name', 'PlpgsqlRaiseException',
          'pg_code', 'P0001'));
      END IF;
    END IF;

    -- ③ 派生分录撞唯一约束 = 派生函数非单射 = **实现缺陷**（R108），不得伪装成「幂等冲突 409」
    --   （新协议下不可达：C0 已禁止调用方键含 '#'；本分支是对历史脏数据 / 未来回归的守卫）
    IF v_state = '23505' AND v_ins_role = 'derived' THEN
      PERFORM ledger_raise('LEDGER_TRANSACTION_REQUIRED', jsonb_build_object(
        'cause', v_state, 'reason', 'derived_key_collision',
        'error_name', 'DerivedKeyCollision', 'pg_code', v_state));
    END IF;

    -- ④ 55P03：若预算已被压到剩余值且此刻已越过 deadline ⇒ 归类为**语句预算耗尽**（更准确）
    IF v_state = '55P03' AND v_deadline IS NOT NULL THEN
      PERFORM ledger_check_budget(v_deadline, 'lock:wakeup');
    END IF;

    -- ⑤ 统一归类（全定义域：任何 SQLSTATE 都落 §14.1 **已登记**码；参 §C ledger_error_for_sqlstate）
    v_bucket := ledger_error_for_sqlstate(v_state, v_cname);

    IF v_bucket->>'code' = 'LEDGER_LOCK_TIMEOUT' THEN
      PERFORM ledger_raise('LEDGER_LOCK_TIMEOUT', jsonb_build_object(
        'reason', 'lock_timeout', 'pg_code', COALESCE(v_state, 'none'),
        'lock_timeout_ms', least(ledger_lock_timeout_ms(), GREATEST(ledger_budget_remaining_ms(v_deadline), 0)),
        'retryable', true));
    ELSIF v_bucket->>'code' = 'LEDGER_DEADLOCK_RETRY_EXHAUSTED' THEN
      -- F3④：LD027 语义更正 —— DB 层 **0 次重试**；重试归调用方（R60 同键重试，安全）
      PERFORM ledger_raise('LEDGER_DEADLOCK_RETRY_EXHAUSTED', jsonb_build_object(
        'reason', v_bucket->>'reason', 'pg_code', COALESCE(v_state, 'none'),
        'retries_performed', 0, 'retry_owner', 'caller', 'retryable', true));
    ELSIF v_bucket->>'code' = 'LEDGER_TX_TIMEOUT' THEN
      PERFORM ledger_raise('LEDGER_TX_TIMEOUT', jsonb_build_object(
        'reason', v_bucket->>'reason', 'pg_code', COALESCE(v_state, 'none'), 'retryable', true));
    ELSIF v_bucket->>'code' = 'LEDGER_TRANSACTION_REQUIRED' THEN
      PERFORM ledger_raise('LEDGER_TRANSACTION_REQUIRED', jsonb_build_object(
        'cause', COALESCE(v_state, 'none'),
        'reason', v_bucket->>'reason',
        'error_name', CASE WHEN v_bucket->>'reason' = 'protocol_violation' THEN 'ProtocolViolation'
                           ELSE 'PlpgsqlDbError' END,
        'pg_code', COALESCE(v_state, 'none'),
        'error_hint', left(COALESCE(NULLIF(v_detail, ''), NULLIF(v_hint, ''), v_msg), 200)));
    ELSIF v_bucket->>'code' = 'LEDGER_IDEMPOTENCY_CONFLICT' THEN
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT', jsonb_build_object(
        'idempotency_key', v_key, 'reason', v_bucket->>'reason', 'pg_code', COALESCE(v_state, 'none')));
    ELSIF v_bucket->>'code' IN ('LEDGER_NEGATIVE_BALANCE_GUARD', 'LEDGER_SUPPLY_CAP_EXCEEDED',
                                'LEDGER_UNKNOWN_KIND') THEN
      PERFORM ledger_raise(v_bucket->>'code', jsonb_build_object(
        'constraint', COALESCE(v_cname, 'unknown_constraint'), 'reason', v_bucket->>'reason'));
    ELSIF v_bucket->>'code' = 'LEDGER_CURRENCY_NOT_FOUND' THEN
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object(
        'constraint', COALESCE(v_cname, 'fk'), 'reason', 'FK_VIOLATION', 'pg_code', COALESCE(v_state, 'none')));
    ELSE
      -- 其余 400 类：§14.4 的 { field?, value?, reason? } 形状 + 可机读归类
      v_details := jsonb_build_object('reason', v_bucket->>'reason', 'pg_code', COALESCE(v_state, 'none'));
      PERFORM ledger_raise(v_bucket->>'code', v_details);
    END IF;
END;
$fn$;

COMMENT ON FUNCTION ledger_post_event(jsonb) IS
  'P1f（F1/F2/F3 修复版）：一个业务事件 = 一次往返。校验/幂等占位/加锁(R79)/分录/余额与冻结更新(R74)/'
  '配对不变式(R41)+§11 判据 8 全在一次调用内完成。F1：调用方键禁止 ''#'' + event_root_key 归属列 + '
  '根行存在性与归属校验（重放不再可能被他人派生键冒充）。F2：整个函数体一个 EXCEPTION 兜底 + '
  'ledger_error_for_sqlstate 全定义域归类 + 金额/求和真范围闸。F3：函数内自证 10s 预算（lock_timeout '
  '按剩余预算收紧）+ 55P03/40P01/57014 统一映射为 LD025/LD027/LD026 + 基础设施错误归 503。'
  'op = mint|transfer|hold|hold_release|settle|entries。错误一律用自定义 SQLSTATE(LD001..LD033) '
  '+ MESSAGE=§14.1 码名 + DETAIL=§14.4 details JSON 机读传出。'
  '0012: 在 C4 账户加锁之后、C5 余额/冻结闸之前新增**只读重放前置闸**（按 event_root_key 归属、'
  '走 idx_ledger_event_root_key）：键已在库 ⇒ 指纹同/未传即按 R52① 返回既有结果（零写入、'
  '零余额校验），指纹异即 R52② 409 ⇒ 修复「托管花光后同键重试得到 LD002 而非 200 重放」'
  '的幂等契约缺陷；不取代 R51 的 ON CONFLICT 探针，不放宽 R63。';

-- ============================================================================
-- §C apply-time 自检（结构性 prosrc 位置断言 + 行为探针 / 子事务 + 哨兵回滚 ⇒ 零残留）
--   失败即 `RAISE EXCEPTION` ⇒ migrate.ts 整文件回滚、不写版本行（**绝不静默**）。
-- ============================================================================
DO $chk$
DECLARE
  v_src      text;
  v_gate_b   int;
  v_gate_e   int;
  v_window   text;
  v_code     text;
  v_bad      text[] := '{}';
  v_probe_uids bigint[] := ARRAY[960901, 960902];
  v_occ      int;
  v_sym      text := 'p2x-zfix-probe';
  v_cid      bigint;
  v_owner    bigint := 960901;
  v_payee    bigint := 960902;
  v_k_mint   text := 'ops:p2x:zfix:mint';
  v_k_hold   text := 'ops:p2x:zfix:hold';
  v_k_evt    text := 'ops:p2x:zfix:evt';
  v_k_new    text := 'ops:p2x:zfix:newkey';
  v_evt      jsonb;
  v_r1       jsonb;
  v_r2       jsonb;
  v_txid1    text;
  v_state    text;
  v_rows     int;
  v_pos      int;
BEGIN
  -- ---------------------------------------------------------------- C.1 取函数体源码
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ledger_post_event'
     AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  IF v_src IS NULL THEN
    v_bad := array_append(v_bad, '找不到 public.ledger_post_event(payload jsonb)');
  ELSE
    v_gate_b := position('0012-REPLAY-PRE-GATE-BEGIN' IN v_src);
    v_gate_e := position('0012-REPLAY-PRE-GATE-END'   IN v_src);
    IF v_gate_b = 0 OR v_gate_e = 0 OR v_gate_e <= v_gate_b THEN
      v_bad := array_append(v_bad, '重放前置闸标记缺失或错位（BEGIN/END）');
      v_window := '';
    ELSE
      v_window := substr(v_src, v_gate_b, v_gate_e - v_gate_b);
    END IF;

    -- ① 必须在 C4 账户加锁**之后**（'account:for-update' 是 C4 独有标记）
    v_pos := position('account:for-update' IN v_src);
    IF v_pos = 0 OR v_gate_b < v_pos THEN
      v_bad := array_append(v_bad, '重放前置闸**不在** C4 账户加锁（account:for-update）之后');
    END IF;

    -- ② 必须在 C5 余额/冻结闸**之前**（C5 段首标记 + R80 余额判据点）
    v_pos := position('C5 推演 + 前置判定' IN v_src);
    IF v_pos = 0 OR v_gate_e > v_pos THEN
      v_bad := array_append(v_bad, '重放前置闸**不在** C5 段（余额/冻结闸）之前');
    END IF;
    v_pos := position('R80：库内先判' IN v_src);
    IF v_pos = 0 OR v_gate_e > v_pos THEN
      v_bad := array_append(v_bad, '重放前置闸**不在** R80 余额闸（INSUFFICIENT_BALANCE / INSUFFICIENT_FROZEN）之前');
    END IF;

    -- ③ R51 的 ON CONFLICT 首条分录探针必须**仍在**、且在闸**之后**（不得被闸取代）
    v_pos := position('ON CONFLICT (idempotency_key) DO NOTHING' IN v_src);
    IF v_pos = 0 THEN
      v_bad := array_append(v_bad, 'R51 的 ON CONFLICT (idempotency_key) DO NOTHING 首条分录探针**消失了**');
    ELSIF v_pos < v_gate_b THEN
      v_bad := array_append(v_bad, 'ON CONFLICT 探针被挪到重放前置闸之前（顺序被改，R51 权威性受损）');
    END IF;
    IF position('v_entries->0->>''idempotency_key''' IN v_src) = 0 THEN
      v_bad := array_append(v_bad, 'ON CONFLICT 探针不再写入调用方原始键（v_entries->0->>idempotency_key）');
    END IF;

    -- ④ 闸体必须**只读**（剥掉 SQL 行注释后再查写/加锁关键字）
    v_code := regexp_replace(v_window, '--[^' || chr(10) || ']*', ' ', 'g');
    IF v_code ~* '(insert[[:space:]]|update[[:space:]]|delete[[:space:]]|for update|for share|lock table|set constraints)' THEN
      v_bad := array_append(v_bad, '重放前置闸体出现写/加锁关键字（必须只读）');
    END IF;

    -- ⑤ 闸体必须真的覆盖 R52 两支 + 按归属列查询
    IF position('LEDGER_IDEMPOTENCY_CONFLICT' IN v_window) = 0 THEN
      v_bad := array_append(v_bad, '闸体缺 R52② 分支（同键异指纹 ⇒ LD003 409）');
    END IF;
    IF position('''idempotent_replay''' IN v_window) = 0 THEN
      v_bad := array_append(v_bad, '闸体缺 R52① 分支（idempotent_replay 返回）');
    END IF;
    IF position('t.event_root_key = v_key' IN v_window) = 0 THEN
      v_bad := array_append(v_bad, '闸体未按 event_root_key = v_key 归属查询');
    END IF;
    IF position('idx_ledger_event_root_key' IN v_window) = 0 THEN
      v_bad := array_append(v_bad, '闸体未标注既有索引用途（idx_ledger_event_root_key）');
    END IF;

    -- ⑥ 索引必须还在（否则闸退化为顺序扫描）
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = 'ledger_entry'
                      AND indexname = 'idx_ledger_event_root_key') THEN
      v_bad := array_append(v_bad, '索引 idx_ledger_event_root_key 不存在（闸退化为顺序扫描）');
    END IF;
  END IF;

  -- ---------------------------------------------------------------- C.2 行为探针（子事务 + 哨兵）
  SELECT count(*) INTO v_occ FROM users WHERE uid = ANY(v_probe_uids);
  IF v_occ > 0 THEN
    RAISE NOTICE '0012 self-check: 行为探针已跳过（保留 uid 960901..960902 已被占用；结构性断言仍已执行）';
  ELSE
    BEGIN   -- 子事务：无论通过与否一律回滚（哨兵）⇒ 零残留
      INSERT INTO users (uid, evm)
      SELECT u, '0x' || lpad(to_hex(u), 40, '0') FROM unnest(v_probe_uids) AS u;

      SELECT cid INTO v_cid FROM currency WHERE symbol = v_sym;
      IF v_cid IS NULL THEN
        INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
        VALUES (v_sym, '0012 self-check probe', v_owner, 0, 0, 'listed', now())
        RETURNING cid INTO v_cid;
      END IF;

      PERFORM ledger_post_event(jsonb_build_object(
        'op', 'mint', 'uid', v_owner::text, 'cid', v_cid::text,
        'amount_units', '1000000', 'kind', 'mint', 'idempotency_key', v_k_mint));
      PERFORM ledger_post_event(jsonb_build_object(
        'op', 'hold', 'uid', v_owner::text, 'cid', v_cid::text,
        'amount_units', '90000', 'kind', 'hold', 'ref_type', 'job', 'ref_id', v_owner::text,
        'request_fingerprint', 'zfix-fp-hold', 'idempotency_key', v_k_hold));

      -- 事件形状：雇主托管 −90000（**恰把 hold 的 90000 全部花光**）+ 打工人 +90000
      v_evt := jsonb_build_object(
        'op', 'entries', 'idempotency_key', v_k_evt, 'request_fingerprint', 'zfix-fp-evt',
        'ref_type', 'job', 'ref_id', v_owner::text,
        'entries', jsonb_build_array(
          jsonb_build_object('uid', v_owner::text, 'cid', v_cid::text,
                             'kind', 'job_payout', 'delta', '0', 'frozen_delta', '-90000'),
          jsonb_build_object('uid', v_payee::text, 'cid', v_cid::text,
                             'kind', 'job_payout', 'delta', '90000', 'frozen_delta', '0')));

      v_r1 := ledger_post_event(v_evt);
      v_txid1 := v_r1->>'txid';
      IF COALESCE((v_r1->>'idempotent_replay')::boolean, true) THEN
        v_bad := array_append(v_bad, '探针①：首写竟报 idempotent_replay=true（首写必须是新事件）');
      END IF;

      SELECT frozen INTO v_rows FROM account WHERE uid = v_owner AND cid = v_cid;
      IF v_rows <> 0 THEN
        v_bad := v_bad || ('探针夹具不成立：首写后托管 = ' || v_rows || '（期望 0 = 已花光）');
      END IF;

      -- ① 幂等契约本体：托管花光后**同键同指纹**再发 ⇒ 必须 200 重放（闸在余额闸之前）
      v_r2 := ledger_post_event(v_evt);
      IF COALESCE((v_r2->>'idempotent_replay')::boolean, false) IS NOT TRUE THEN
        v_bad := v_bad || ('探针①：托管花光后同键重放**未**得到 R52① 重放（读数 = '
                           || COALESCE(v_r2::text, 'NULL') || '）');
      END IF;
      IF v_r2->>'txid' IS DISTINCT FROM v_txid1 THEN
        v_bad := v_bad || ('探针①：重放 txid = ' || COALESCE(v_r2->>'txid', 'NULL')
                           || ' ≠ 首写 txid = ' || COALESCE(v_txid1, 'NULL'));
      END IF;
      SELECT count(*) INTO v_rows FROM ledger_entry WHERE event_root_key = v_k_evt;
      IF v_rows <> 2 THEN
        v_bad := v_bad || ('探针①：重放后键下分录数 = ' || v_rows || '（期望 2 = 未新增）');
      END IF;

      -- ② 同键**异指纹**（托管仍花光）⇒ 必须 409 LD003（而不是 LD002）
      BEGIN
        PERFORM ledger_post_event(jsonb_set(v_evt, '{request_fingerprint}', '"zfix-fp-other"'::jsonb));
        v_bad := array_append(v_bad, '探针②：同键异指纹**未被拒**（期望 LD003）');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
        IF v_state <> 'LD003' THEN
          v_bad := v_bad || ('探针②：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD003）');
        END IF;
      END;

      -- ③ **全新键** + 冻结不足（托管已花光）⇒ 仍必须 LD002（闸没被拆掉；R63 仍成立）
      BEGIN
        PERFORM ledger_post_event(jsonb_build_object(
          'op', 'entries', 'idempotency_key', v_k_new, 'request_fingerprint', 'zfix-fp-new',
          'ref_type', 'job', 'ref_id', v_owner::text,
          'entries', jsonb_build_array(
            jsonb_build_object('uid', v_owner::text, 'cid', v_cid::text,
                               'kind', 'job_payout', 'delta', '0', 'frozen_delta', '-1'),
            jsonb_build_object('uid', v_payee::text, 'cid', v_cid::text,
                               'kind', 'job_payout', 'delta', '1', 'frozen_delta', '0'))));
        v_bad := array_append(v_bad, '探针③：全新键 + 冻结不足**未被拒**（期望 LD002）');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
        IF v_state <> 'LD002' THEN
          v_bad := v_bad || ('探针③：拒绝码 = ' || COALESCE(v_state, 'NULL') || '（期望 LD002）');
        END IF;
      END;
      SELECT count(*) INTO v_rows FROM ledger_entry WHERE event_root_key = v_k_new;
      IF v_rows <> 0 THEN
        v_bad := v_bad || ('探针③：被拒的新事件竟留下 ' || v_rows || ' 条分录（期望 0）');
      END IF;

      -- 哨兵：无论通过与否一律回滚本子事务（探针数据零残留）
      RAISE EXCEPTION 'P2X0012_PROBE_ROLLBACK';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'P2X0012_PROBE_ROLLBACK' THEN RAISE; END IF;
      WHEN OTHERS THEN
        RAISE;   -- 任何意外 ⇒ 冒泡（迁移回滚，绝不静默吞掉）
    END;
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL AND array_length(v_bad, 1) > 0 THEN
    RAISE EXCEPTION '0012 self-check failed: %', array_to_string(v_bad, ' | ');
  END IF;
  RAISE NOTICE '0012 self-check passed: 前置闸在 C4 加锁之后 / C5 余额闸之前（prosrc 位置已钉）；ON CONFLICT 探针保留为权威；只读；行为探针：托管花光后同键重放 = 200 R52①、同键异指纹 = LD003、全新键冻结不足 = LD002';
END;
$chk$;
