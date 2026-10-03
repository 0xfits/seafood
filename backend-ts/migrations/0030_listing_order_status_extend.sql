-- ============================================================================
-- 0030_listing_order_status_extend.sql · P9③（Kong）：listing_order 状态集 4 → 6
--   + transition 白名单函数改写 + 退款闸放宽（**单一职责 = 状态机面**）
-- ============================================================================
-- 权威口径（**只兑现已冻结的裁定，不自行推导**）：
--   · `docs/data-layer.spec.md` **v0.23 §32.4**（Zang 裁定 `R-9-27` / `R-9-29` / `R-9-32` 就地定案）
--     + §32.4(d)/§32.4(c) 内容契约；主计划 `docs/seafood.master-plan.md` `§5.241`。
--   · `R-9-32`：「`0030` = `listing_order` 状态集扩展（**ALTER CHECK，绝不改 `0015`**）
--     + `*_status_transition_ok` 白名单函数改写」；apply 顺序 `0030 → 0031`；**apply 由 Zang 执行**。
--
-- 本迁移做**恰三件事**（全部落在「状态机面」，不建表、不比 `0031` 越权）：
--   ① `listing_order_status_enum` CHECK **重建** 4 → 6 值
--      （`ALTER CHECK` 手法逐字沿 `0003:58-67`：`DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT … CHECK`；
--       **绝不改 `0015`**）。新集 = 旧 4 值全保留 ∪ {`shipped`,`received`} = 恰 6 值；`cancelled` 不可删。
--   ② `public.listing_order_status_transition_ok(text,text)` 白名单函数**改写**（`CREATE OR REPLACE`）：
--      允许出边 = `created→{paid,cancelled}` · `paid→{shipped,refunded}` · `shipped→{received,refunded}` ·
--      `received`/`refunded`/`cancelled` 终态（无出边）。★ `R-9-29`：**`shipped→refunded` 允许**、
--      **`received→refunded` 不允许**（`received` 为终态）。
--   ③ `public.listing_post_event(jsonb)` 的退款闸**放宽**（`CREATE OR REPLACE`）：
--      `op='refund'` 分支由 `v_order.status <> 'paid'` 放宽为 `v_order.status NOT IN ('paid','shipped')`
--      ⇒ `reason='order_not_refundable'` 触发面 = `{created, received, refunded, cancelled}`（`received` 仍禁退）。
--      ★ **函数体逐字节照抄 `0015:449-807`，仅此一行 + 一行注释变更**（可 `diff` 复核）。
--
-- 本迁移**不做什么**（硬约束）：
--   · **绝不改 `0001`–`0029` 任何文件**（`migrate.ts` 锁文件 checksum，漂移即 ABORT）；
--   · 不建表 / 不改 `listing_order` 列 / 不建事件表（**两表归 `0031`**）；
--   · 不新增 / 不删除 kind；不新增错误码（仍 33 码关闭集）；不写任何业务数据。
--   · 函数体内**无任何 DDL**（DL142 相邻）；不 `DELETE` / `TRUNCATE` / `DROP` 业务数据。
--
-- 幂等：`DROP CONSTRAINT IF EXISTS` / `ADD CONSTRAINT` / `CREATE OR REPLACE FUNCTION` 天然幂等；
--   本文件只被 `migrate.ts` 执行一次（版本表 + checksum 去重）。
-- ★ 本迁移**未 apply**（apply 由 Zang 执行）；`R-9-24` 真跑自证 = 单事务内 `BEGIN; <全文>; ROLLBACK;`。
-- ============================================================================


-- ============================================================================
-- §A `listing_order_status_enum` CHECK 重建（4 → 6 值 · 绝不改 0015）
-- ============================================================================
-- ---------------------------------------------------------------- 前置断言
-- （① 约束存在且为 CHECK（`contype='c'`）；② 现存行状态 ⊂ 旧 4 值 —— 只加值不删值，无需「删值前无行在用」断言）
DO $$
DECLARE
  v_cnt int;
  v_bad bigint;
BEGIN
  SELECT count(*) INTO v_cnt
    FROM pg_constraint
   WHERE conrelid = 'public.listing_order'::regclass
     AND conname  = 'listing_order_status_enum'
     AND contype  = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0030 §A pre-check FAILED: listing_order_status_enum CHECK not found on public.listing_order (got %)', v_cnt;
  END IF;
  -- 旧 4 值集以外不应有行（若已有 6 值中的新值 ⇒ schema 已被别处改动 ⇒ 停下）
  SELECT count(*) INTO v_bad
    FROM public.listing_order
   WHERE status NOT IN ('created','paid','refunded','cancelled');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '0030 §A pre-check FAILED: % listing_order row(s) carry a status outside the pre-0030 4-value set', v_bad;
  END IF;
END $$;

-- ---------------------------------------------------------------- 白名单替换（6 值）
ALTER TABLE public.listing_order DROP CONSTRAINT IF EXISTS listing_order_status_enum;
ALTER TABLE public.listing_order
  ADD CONSTRAINT listing_order_status_enum CHECK (status IN ('created','paid','shipped','received','refunded','cancelled'));

-- ---------------------------------------------------------------- 收尾断言
DO $$
DECLARE
  v_cnt  int;
  v_def  text;
  v_vals int;
BEGIN
  SELECT count(*) INTO v_cnt
    FROM pg_constraint
   WHERE conrelid = 'public.listing_order'::regclass
     AND conname  = 'listing_order_status_enum'
     AND contype  = 'c';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '0030 §A post-check FAILED: expected exactly 1 listing_order_status_enum CHECK, got %', v_cnt;
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'public.listing_order'::regclass AND conname = 'listing_order_status_enum';
  -- 恰 6 个字面量，且逐字 6 值齐全（R-9-32 写死集）
  v_vals := (SELECT count(*) FROM regexp_matches(v_def, '''[a-z_]+''', 'g'));
  IF v_vals <> 6 THEN
    RAISE EXCEPTION '0030 §A post-check FAILED: expected 6 literals in CHECK, got % (def=%)', v_vals, v_def;
  END IF;
  IF NOT (v_def LIKE '%''created''%' AND v_def LIKE '%''paid''%' AND v_def LIKE '%''shipped''%'
          AND v_def LIKE '%''received''%' AND v_def LIKE '%''refunded''%' AND v_def LIKE '%''cancelled''%') THEN
    RAISE EXCEPTION '0030 §A post-check FAILED: 6-value set incomplete (def=%)', v_def;
  END IF;
END $$;


-- ============================================================================
-- §B transition 白名单函数改写（唯一真源 = public.listing_order_status_transition_ok）
-- ============================================================================
-- 允许出边（`R-9-29` 冻结）：created→{paid,cancelled}；paid→{shipped,refunded}；
--   shipped→{received,refunded}；received / refunded / cancelled = 终态（无出边）。
-- `CREATE OR REPLACE` 目标 ⇒ 不与 `0015` 文件 checksum 冲突（`migrate.ts` 只锁文件 checksum）。
CREATE OR REPLACE FUNCTION public.listing_order_status_transition_ok(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'created'  THEN p_to IN ('paid', 'cancelled')
    WHEN 'paid'     THEN p_to IN ('shipped', 'refunded')
    WHEN 'shipped'  THEN p_to IN ('received', 'refunded')
    ELSE false            -- received / refunded / cancelled = 终态（无出边）
  END
$$;

COMMENT ON FUNCTION public.listing_order_status_transition_ok(text, text) IS
  '0030（P9③ · R-9-29）listing_order 状态白名单唯一真源：created→{paid,cancelled}；paid→{shipped,refunded}；shipped→{received,refunded}；received/refunded/cancelled 终态。★ R-9-29：shipped→refunded 允许；received→refunded 不允许（received 为终态）。';

-- ---------------------------------------------------------------- §B 自检（正 / 负全集 · 负例必含 received→refunded）
DO $$
BEGIN
  -- 正向（允许）
  IF NOT public.listing_order_status_transition_ok('created','paid')
     OR NOT public.listing_order_status_transition_ok('created','cancelled')
     OR NOT public.listing_order_status_transition_ok('paid','shipped')
     OR NOT public.listing_order_status_transition_ok('paid','refunded')
     OR NOT public.listing_order_status_transition_ok('shipped','received')
     OR NOT public.listing_order_status_transition_ok('shipped','refunded') THEN
    RAISE EXCEPTION '0030 §B self-check FAILED: whitelist missing an allowed transition (R-9-29)';
  END IF;
  -- 负向（越级 / 终态无出边 / 自环 / 自造状态）
  IF public.listing_order_status_transition_ok('created','shipped')
     OR public.listing_order_status_transition_ok('created','received')
     OR public.listing_order_status_transition_ok('created','refunded')
     OR public.listing_order_status_transition_ok('paid','received')
     OR public.listing_order_status_transition_ok('received','refunded')   -- ★ R-9-29 禁令
     OR public.listing_order_status_transition_ok('received','paid')
     OR public.listing_order_status_transition_ok('received','shipped')
     OR public.listing_order_status_transition_ok('refunded','paid')
     OR public.listing_order_status_transition_ok('cancelled','paid')
     OR public.listing_order_status_transition_ok('created','created')
     OR public.listing_order_status_transition_ok('paid','paid')
     OR public.listing_order_status_transition_ok('shipped','shipped')
     OR public.listing_order_status_transition_ok('made_up','paid') THEN
    RAISE EXCEPTION '0030 §B self-check FAILED: whitelist admits a forbidden transition (R-9-29 负例必红)';
  END IF;
END $$;


-- ============================================================================
-- §C 退款闸放宽（`public.listing_post_event(jsonb)` 改写 · `R-9-29` 连带）
-- ============================================================================
-- ---------------------------------------------------------------- 前置断言（函数在场且为原签名）
DO $$
BEGIN
  IF to_regprocedure('public.listing_post_event(jsonb)') IS NULL THEN
    RAISE EXCEPTION '0030 §C pre-check FAILED: public.listing_post_event(jsonb) missing (0015 未 apply?)';
  END IF;
END $$;

-- ---------------------------------------------------------------- 函数改写（逐字节照抄 0015:449-807，仅退款闸一行 + 注释变更）
CREATE OR REPLACE FUNCTION public.listing_post_event(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_op         text;
  v_fp         text;
  v_memo       text;
  v_create_key text;
  v_listing_id bigint;
  v_buyer      bigint;
  v_qty        bigint;
  v_order_id   bigint;
  v_qty_int    int;
  v_amount     bigint;
  v_listing    public.listing;
  v_order      public.listing_order;
  v_order_pre  boolean := false;
  v_key        text;
  v_replay     boolean := false;
  v_created    boolean := false;
  v_ledger     jsonb;
  v_entries    jsonb;
  v_txid       text;
  v_seen       integer;
  v_kinds      text;
  v_bad        integer;
  v_cur        record;
BEGIN
  -- ---------------------------------------------------------------- 信封校验
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'payload', 'reason', 'BAD_TYPE'));
  END IF;
  v_op := payload->>'op';
  IF v_op IS NULL OR v_op NOT IN ('buy', 'refund') THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'op', 'value', COALESCE(v_op, 'null'), 'reason', 'UNKNOWN_LISTING_OP'));
  END IF;
  -- R53 / §19.6：指纹可为 NULL（未传 = 同键即重放）；只作用于事件第 1 条分录
  IF payload ? 'request_fingerprint' AND jsonb_typeof(payload->'request_fingerprint') = 'string' THEN
    v_fp := NULLIF(payload->>'request_fingerprint', '');
  ELSE
    v_fp := NULL;
  END IF;
  v_memo := COALESCE(NULLIF(payload->>'memo', ''), 'listing ' || v_op);

  IF v_op = 'buy' THEN
    -- ============================================================ op = buy
    -- ① 创建幂等键闸（DL93 的字符集闸，逐项同序：TOO_LONG → PREFIX_REQUIRED →
    --    RESERVED_SEPARATOR → CONTROL_CHARACTER）
    v_create_key := btrim(COALESCE(payload->>'create_key', ''));
    IF v_create_key = '' OR jsonb_typeof(payload->'create_key') <> 'string' THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_REQUIRED',
        jsonb_build_object('field', 'create_key'));
    END IF;
    IF length(v_create_key) > 256 THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'TOO_LONG', 'field', 'create_key'));
    END IF;
    IF v_create_key !~ '^(biz|cm|cli|ops):' THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'PREFIX_REQUIRED', 'provided', left(v_create_key, 8), 'field', 'create_key'));
    END IF;
    IF position('#' in v_create_key) > 0 THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'RESERVED_SEPARATOR', 'field', 'create_key'));
    END IF;
    IF v_create_key ~ '[[:cntrl:]]' THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'CONTROL_CHARACTER', 'field', 'create_key'));
    END IF;

    -- ② 入参解析（不含存在性判定）
    v_listing_id := public.ledger_int_amount(COALESCE(payload->>'listing_id', ''), 'listing_id');
    IF v_listing_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'listing_id', 'value', v_listing_id::text, 'reason', 'listing_not_found'));
    END IF;
    v_qty := public.ledger_int_amount(COALESCE(payload->>'quantity', ''), 'quantity');
    IF v_qty <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'quantity', 'value', v_qty::text));
    END IF;
    IF v_qty > 2147483647 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'quantity', 'reason', 'OUT_OF_INT4_RANGE', 'value', left(v_qty::text, 40)));
    END IF;
    v_qty_int := v_qty::int;
    v_buyer   := public.ledger_uid_arg(COALESCE(payload->>'buyer_uid', ''), 'buyer_uid');
    IF v_buyer < 1 THEN
      PERFORM public.ledger_raise('LEDGER_RESERVED_UID',
        jsonb_build_object('uid', v_buyer::text, 'field', 'buyer_uid',
                           'reason', 'PLATFORM_BUYER_FORBIDDEN'));
    END IF;

    -- ③ 业务行锁（DL141 全序第 1 段：**业务行先于 currency/account**）
    SELECT * INTO v_listing FROM public.listing l WHERE l.listing_id = v_listing_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'listing_id', 'value', v_listing_id::text, 'reason', 'listing_not_found'));
    END IF;

    -- ④ 订单行解析（创建幂等的唯一权威 = `listing_order.create_key` 唯一约束）
    SELECT * INTO v_order FROM public.listing_order o WHERE o.create_key = v_create_key FOR UPDATE;
    IF FOUND THEN
      v_order_pre := true;
      v_replay    := true;
      -- 同键异业务内容 ⇒ 409（DL144② 的业务侧对应物）
      IF v_order.listing_id <> v_listing_id
         OR v_order.buyer_uid <> v_buyer
         OR v_order.seller_uid <> v_listing.seller_uid
         OR v_order.quantity <> v_qty_int THEN
        PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT',
          jsonb_build_object('reason', 'CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT',
                             'field', 'create_key', 'idempotency_key', v_create_key,
                             'order_id', v_order.order_id::text));
      END IF;
      v_order_id := v_order.order_id;
    END IF;

    -- ⑤ 纯业务闸（**仅非重放**：重放时业务行已落终态，不得第二次校验/改写，DL144①）
    --     状态机闸（DL60）→ 自买自卖（§11.2）→ 库存（§11.2）
    IF NOT v_replay THEN
      IF v_listing.status <> 'listed' THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'listing.status', 'reason', 'listing_not_listed',
                             'status', v_listing.status, 'listing_id', v_listing_id::text));
      END IF;
      IF v_buyer = v_listing.seller_uid THEN
        PERFORM public.ledger_raise('LEDGER_SELF_TRANSFER',
          jsonb_build_object('uid', v_buyer::text, 'field', 'buyer_uid',
                             'reason', 'self_purchase_not_allowed', 'listing_id', v_listing_id::text));
      END IF;
      IF v_listing.stock < v_qty_int THEN
        PERFORM public.ledger_raise('LEDGER_INSUFFICIENT_BALANCE',
          jsonb_build_object('uid', v_listing.seller_uid::text, 'field', 'listing.stock',
                             'reason', 'listing_stock_insufficient',
                             'required', v_qty::text, 'available', v_listing.stock::text,
                             'listing_id', v_listing_id::text));
      END IF;
    END IF;

    v_amount := v_listing.price * v_qty;
    IF v_amount <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'amount', 'value', v_amount::text));
    END IF;
    IF v_amount > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'amount', 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_amount::text, 40)));
    END IF;

    -- ⑥ 订单行创建（仅新单；卖家用 listing 行的**当前** seller_uid ⇒ 快照自洽）
    IF NOT v_order_pre THEN
      INSERT INTO public.listing_order
        (listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
      VALUES
        (v_listing_id, v_buyer, v_listing.seller_uid, v_listing.cid, v_listing.price, v_qty_int, 'created', v_create_key)
      ON CONFLICT (create_key) DO NOTHING
      RETURNING * INTO v_order;
      IF NOT FOUND THEN
        -- 并发同键：另一事务已建行 ⇒ 重读（持行锁），按重放返回，不重写业务行
        SELECT * INTO v_order FROM public.listing_order o WHERE o.create_key = v_create_key FOR UPDATE;
        IF NOT FOUND THEN
          PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
            jsonb_build_object('field', 'create_key', 'reason', 'listing_order_create_race_lost',
                               'idempotency_key', v_create_key));
        END IF;
        v_order_pre := true;
        v_replay    := true;
      ELSE
        v_created := true;
      END IF;
      v_order_id := v_order.order_id;
    END IF;

    v_key := 'biz:listing:buy:' || v_order_id::text;

    -- ⑦ 只读重放探测（按事件根键走既有索引 idx_ledger_event_root_key）
    --     同 0013/0012 同法：它只决定「是否还走业务校验」，不取代账本的权威幂等探针（R51）。
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    IF FOUND THEN v_replay := true; END IF;
    -- 结构性断言：订单行已在库而账本事件不在 ⇒ 同事务语义被破坏（响亮缺陷，R108 类，绝不静默）
    IF v_order_pre AND NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_TRANSACTION_REQUIRED',
        jsonb_build_object('reason', 'listing_order_without_ledger_event',
                           'order_id', v_order_id::text, 'idempotency_key', v_key));
    END IF;

    -- ⑧ 币种存在性（金额/状态闸在账本内；此处只为函数出参与本柱读口的一致性）
    SELECT c.cid, c.status INTO v_cur FROM public.currency c WHERE c.cid = v_listing.cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_listing.cid::text));
    END IF;

    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_buyer::text, 'cid', v_listing.cid::text, 'delta', (-v_amount)::text,
                         'frozen_delta', '0', 'kind', 'purchase',
                         'memo', v_memo || '（买家付款 purchase listing_order=' || v_order_id::text || '）'),
      jsonb_build_object('uid', v_listing.seller_uid::text, 'cid', v_listing.cid::text, 'delta', v_amount::text,
                         'frozen_delta', '0', 'kind', 'sale',
                         'memo', v_memo || '（卖家收款 sale listing_order=' || v_order_id::text || '）'));

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'currency_op',         'settle',            -- §19.3/R28：结算类（purchase/sale）仅 `listed`
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'listing_order',
      'ref_id',              v_order_id::text,
      'entries',             v_entries));
  ELSE
    -- ============================================================ op = refund
    v_order_id := public.ledger_int_amount(COALESCE(payload->>'order_id', ''), 'order_id');
    IF v_order_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'value', v_order_id::text, 'reason', 'order_not_found'));
    END IF;
    v_key := 'biz:listing:refund:' || v_order_id::text;

    -- ① 业务行锁（DL141 全序第 1 段）
    SELECT * INTO v_order FROM public.listing_order o WHERE o.order_id = v_order_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'value', v_order_id::text, 'reason', 'order_not_found'));
    END IF;

    -- ② 只读重放探测
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    v_replay := FOUND;

    -- ③ 状态机闸 + 托管存在性闸（**仅非重放**）
    IF NOT v_replay THEN
      -- ★ 0030（R-9-29）：退款闸放宽 —— shipped 亦可退；received / refunded / cancelled / created 仍禁退。
      IF v_order.status NOT IN ('paid', 'shipped') THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'listing_order.status', 'reason', 'order_not_refundable',
                             'status', v_order.status, 'order_id', v_order_id::text));
      END IF;
      IF v_order.pay_txid IS NULL THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'listing_order.pay_txid', 'reason', 'order_pay_missing',
                             'order_id', v_order_id::text, 'status', v_order.status));
      END IF;
    END IF;

    -- ④ 业务行锁（listing）—— 与 buy 同一序列：listing 先于 listing_order 的回写
    SELECT * INTO v_listing FROM public.listing l WHERE l.listing_id = v_order.listing_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'listing_id', 'value', v_order.listing_id::text, 'reason', 'listing_not_found'));
    END IF;

    -- ④′ 币种存在性（**v3 修正 · 留痕**：v2（sha256 911c7be4…）的 refund 分支从未给 `v_cur` 赋值，
    --   而 RETURN 的 `extra` 块无条件求值 `CASE WHEN v_cur IS NULL …` ⇒ 任何**成功**的 refund 都在
    --   RETURN 处抛 `55000 record "v_cur" is not assigned yet`（实测：行为用例 K6 退款链被此拦下）。
    --   现与 buy 的步骤 ⑧ 对称补齐币种查询，使 refund 的 `extra.currency_status` 亦有意义。）
    SELECT c.cid, c.status INTO v_cur FROM public.currency c WHERE c.cid = v_order.cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_order.cid::text));
    END IF;

    v_amount := v_order.price * v_order.quantity;
    IF v_amount <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'amount', 'value', v_amount::text));
    END IF;
    IF v_amount > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'amount', 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_amount::text, 40)));
    END IF;

    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_order.seller_uid::text, 'cid', v_order.cid::text, 'delta', (-v_amount)::text,
                         'frozen_delta', '0', 'kind', 'purchase_refund',
                         'memo', v_memo || '（卖家退回 purchase_refund listing_order=' || v_order_id::text || '）'),
      jsonb_build_object('uid', v_order.buyer_uid::text, 'cid', v_order.cid::text, 'delta', v_amount::text,
                         'frozen_delta', '0', 'kind', 'purchase_refund',
                         'memo', v_memo || '（买家收款 purchase_refund listing_order=' || v_order_id::text || '）'));

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'currency_op',         'settle',
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'listing_order',
      'ref_id',              v_order_id::text,
      'entries',             v_entries));
  END IF;

  v_txid := v_ledger->>'txid';
  IF (v_ledger->>'idempotent_replay')::boolean THEN
    v_replay := true;
  END IF;

  -- ---------------------------------------------------------------- DL85 事件级 kind 白名单（事后核对）
  SELECT string_agg(DISTINCT t.e->>'kind', ',' ORDER BY t.e->>'kind') INTO v_kinds
    FROM jsonb_array_elements(v_ledger->'entries') AS t(e);
  SELECT count(*) INTO v_bad
    FROM jsonb_array_elements(v_ledger->'entries') AS t(e)
   WHERE (v_op = 'buy'    AND t.e->>'kind' NOT IN ('purchase', 'sale'))
      OR (v_op = 'refund' AND t.e->>'kind' NOT IN ('purchase_refund'));
  IF COALESCE(v_bad, 0) <> 0 THEN
    PERFORM public.ledger_raise('LEDGER_ACCOUNT_GUARD_VIOLATION',
      jsonb_build_object('reason', 'LISTING_EVENT_KIND_OUT_OF_WHITELIST',
                         'op', v_op, 'kinds', v_kinds));
  END IF;

  -- ---------------------------------------------------------------- 回写业务行
  -- DL144①：重放 ⇒ **不重写业务行**、**不追加 `ledger_event_keys` 项**（DL149 判负用例钉住）；
  -- 判据是账本侧的 `idempotent_replay`（+ 只读根键探测／订单行预存在），**不是** UPDATE 的行数。
  IF NOT v_replay THEN
    IF v_op = 'buy' THEN
      UPDATE public.listing_order o
         SET status = 'paid',
             pay_txid = v_txid::bigint,
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_order_id
      RETURNING * INTO v_order;
      -- DL60：库存递减与 `purchase` 分录**同一事件**（同一函数、同一事务）
      UPDATE public.listing l
         SET stock = l.stock - v_order.quantity
       WHERE l.listing_id = v_order.listing_id
      RETURNING * INTO v_listing;
    ELSE
      -- DL62：**库存回滚策略由 P4 spec 定**（登记为「未定」）⇒ 本迁移**不复原库存**（不发明）
      UPDATE public.listing_order o
         SET status = 'refunded',
             refund_txid = v_txid::bigint,
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_order_id
      RETURNING * INTO v_order;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', v_replay,
    'op', v_op,
    'listing_id', v_order.listing_id::text,
    'order_id', v_order.order_id::text,
    'listing_status', v_listing.status,
    'order_status', v_order.status,
    'stock', v_listing.stock,
    'created', v_created,
    'pay_txid', CASE WHEN v_order.pay_txid IS NULL THEN NULL ELSE v_order.pay_txid::text END,
    'refund_txid', CASE WHEN v_order.refund_txid IS NULL THEN NULL ELSE v_order.refund_txid::text END,
    'ledger_event_keys', to_jsonb(v_order.ledger_event_keys),
    'txid', v_txid,
    'ledger_idempotency_key', v_key,
    'entries', v_ledger->'entries',
    'accounts', v_ledger->'accounts',
    'extra', jsonb_build_object('amount', v_amount::text, 'currency_status',
                                CASE WHEN v_cur IS NULL THEN NULL ELSE v_cur.status END,
                                'event_kinds', v_kinds));
END $$;

COMMENT ON FUNCTION public.listing_post_event(jsonb) IS
  'P4 商品业务编排函数（DL20 提案 A；硬约束 DL141–DL144）。op=buy|refund；幂等键由本函数按 §8 确定性派生（buy=cli: 创建键 + biz:listing:buy:<order_id> / refund=biz:listing:refund:<order_id>）；同一语句内完成「锁业务行 → 派生分录 → 调 ledger_post_event($1::jsonb) → 回写 ledger_event_keys/托管列/库存」；函数体内无任何 DDL（DL142）；同键重放不重写业务行、不追加 ledger_event_keys 项、不二次扣库存（DL144①/DL149）。发布/编辑/下架**不**走本函数（DL99：无分录的写不得借账本幂等）。';

-- ---------------------------------------------------------------- §C 收尾断言（退款闸已放宽）
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'listing_post_event';
  IF v_def IS NULL THEN
    RAISE EXCEPTION '0030 §C post-check FAILED: listing_post_event not found in public';
  END IF;
  IF position('NOT IN (''paid'', ''shipped'')' IN v_def) = 0 THEN
    RAISE EXCEPTION '0030 §C post-check FAILED: 退款闸未放宽为 status NOT IN (''paid'',''shipped'')';
  END IF;
  IF position('v_order.status <> ''paid''' IN v_def) <> 0 THEN
    RAISE EXCEPTION '0030 §C post-check FAILED: 旧退款闸（status <> ''paid''）仍在函数体内';
  END IF;
  -- 函数体内不得出现 DDL 令牌（DL142 相邻纪律）
  IF position('CREATE TABLE' IN v_def) <> 0 OR position('ALTER TABLE' IN v_def) <> 0 THEN
    RAISE EXCEPTION '0030 §C post-check FAILED: DDL token inside listing_post_event body';
  END IF;
END $$;


-- ============================================================================
-- §D 存量兼容断言（须实测 · §32.4(g)）
-- ============================================================================
-- 现有行 status ∈ {created,paid,refunded,cancelled} ⊂ 新 6 值集 ⇒ 行级零改、可读可写；
-- 本断言在 apply 时对**既有行**真跑（不构造数据）：任何越集行 ⇒ 整迁移中止。
DO $$
DECLARE
  v_bad bigint;
BEGIN
  SELECT count(*) INTO v_bad
    FROM public.listing_order
   WHERE status NOT IN ('created','paid','shipped','received','refunded','cancelled');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '0030 §D 存量兼容 FAILED: % row(s) outside the 6-value set after ALTER CHECK', v_bad;
  END IF;
  RAISE NOTICE '0030 self-check OK: listing_order_status_enum = 6 值 / transition 白名单（正 6 + 负 13）/ 退款闸 status NOT IN (paid,shipped) / 存量行零越集';
END $$;
