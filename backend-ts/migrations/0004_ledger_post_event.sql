-- ============================================================================
-- 0004_ledger_post_event.sql · P1e（D10 变体 B）：把记账压进 DB 函数
-- ============================================================================
-- 权威口径：docs/ledger.spec.md（v0.2，1071 行 / R1..R108）
--   §4   三态记账（hold / hold_release = 同账户两条分录）
--   §5   20 个 kind 关闭集（R40）+ 配对不变式（R41，正式形状见 §19.2）
--   §6   幂等（R48 全局唯一 / R49 前缀 / R50 确定性派生 / R51 探针协议 / R52 返回语义）
--        派生键约定：第 1 条用调用方原始键，第 i 条（i≥2）用 `<key>#<i>`（§19.5 裁定）
--   §7   R57 一个业务事件一个事务（本函数 = 一条语句 = 一个隐式事务）
--   §8   金额最小单位整数 + 入参校验（R66/R70/R71/R72）
--   §9   R74 先插分录后更账户；account_guard / append_only 触发器仍作兵底
--   §10  R79 加锁全序（currency(cid 升序) → account(uid 升序, 同 uid 再 cid 升序) → 业务行）
--        R80 负余额禁令（函数内先判，CHECK 仅兜底）R82 lock/statement timeout
--        R83 mint 必须先锁 currency 再动 account
--   §11  判据 1 / 2 / 8 在函数内部自证（配对不变式 + 快照链 + 账户等式由触发器复核）
--   §13  R98/R100/R101/R103 平台保留 uid：**仅 uid = -3 允许以 transfer 出账**（§19.1 裁定）
--   §14  §14.1 33 码关闭集 / §14.3 借用映射 / §14.4 details 形状表
--   §19  已裁定口径登记（19.1 罚没池 transfer 例外、19.2 判据 8 形状、19.3 状态矩阵补格、
--        19.4 全部 FOR UPDATE、19.5 派生键、19.6 指纹策略）
--
-- ---------------------------------------------------------------- 交付形态（D10）
-- 一个业务事件 = 一次往返。TS 侧只发：
--     SELECT ledger_post_event($1::jsonb) AS r;
-- 校验 / 幂等占位 / 加锁 / 分录 / 余额与冻结更新 / 配对不变式**全部在本函数内**完成；
-- 行锁持有时间 = 该语句执行时间（不跨往返），因此 R82 的 lock_timeout 不再被
-- 「多语句 × RTT」放大。
--
-- ---------------------------------------------------------------- 入参契约（payload）
-- {
--   "op": "mint" | "transfer" | "hold" | "hold_release" | "settle" | "entries",
--   "idempotency_key": "ops:...",              -- 必填，前缀 biz:/cm:/cli:/ops:
--   "request_fingerprint": "<sha256hex>"|null, -- 只作用于事件第 1 条分录（R53）
--   "memo": "", "ref_type": "system"|null, "ref_id": "123"|null,
--
--   mint:         "uid","cid","amount"|"amount_units","platform"?      (R23/R24/R28)
--   transfer:     "from_uid","to_uid","cid","amount"|"amount_units"    (R32/R100/R101)
--   hold:         "uid","cid","amount"|"amount_units","business_frozen_cap"?  (R34/R36/R37/R39)
--   hold_release: 同上（op 换 hold_release；四态全可，§19.3）
--   settle:       "from_uid","to_uid"?,"cid","amount"|"amount_units","kind",
--                 "payee_kind"?,"business_frozen_cap"?                 (R33/R38)
--   entries:      "entries":[ {"uid","cid","delta","frozen_delta"?,"kind",
--                              "ref_type"?,"ref_id"?,"memo"?,"reversal_of_txid"?}, ... ],
--                 "currency_op"?: "mint|transfer|hold|hold_release|settle|price"
--                 —— 显式分录列表入口（P2 十级返佣 / P5 交易所成交 4 条分录都用它，
--                    结构复杂但分录集合预先已知 ⇒ 后续阶段不必再改函数）
-- }
-- 金额二选一（与 TS 侧 parseUserAmount 语义一一对应，**不保留第二套解析逻辑**）：
--   "amount"       = 用户输入形态的十进制字符串（按 currency.decimals 换算，R72③）
--   "amount_units" = 已是该币种最小单位的整数字符串（R66/R70）
--
-- ---------------------------------------------------------------- 出参契约（jsonb）
-- { "ok": true, "idempotent_replay": bool, "idempotency_key": text, "txid": text|null,
--   "entries": [ {txid,uid,cid,delta,frozen_delta,balance_after,frozen_after,kind,
--                 ref_type,ref_id,idempotency_key,request_fingerprint,
--                 reversal_of_txid,memo,time_created} ],   -- 金额一律十进制字符串（R70）
--   "accounts": [ {uid,cid,balance,frozen} ],             -- 与旧 TS snapshotsOf 同序同值
--   "extra":    { ... 一律 string|null },                 -- 与旧 TS extra 同键同值
--   "meta":     { "op", "lock_trace": [...] } }           -- lock_trace = 加锁顺序取证（R79）
--
-- ---------------------------------------------------------------- 错误契约（机读，封闭集）
-- 一律 `RAISE EXCEPTION USING ERRCODE = <LD0nn>, MESSAGE = <§14.1 码名>,
--         DETAIL = <§14.4 details 形状的 JSON 字符串>`。
--   ① ERRCODE 是**自定义 SQLSTATE**（LD001..LD033，见 ledger_sqlstate_of），
--      TS 侧由 normalizeLedgerError 映射回 §14.1 的 LedgerError（含 HTTP status）；
--   ② MESSAGE 恒等于 §14.1 的码名，不夹带任何自由文本 / SQL / 表名（R107）；
--   ③ DETAIL 是 details 的 JSON（§14.4 形状表），TS 侧 JSON.parse 后原样进响应体；
--   ④ **绝不存在「TS 侧无法归类」的形态**：函数体内所有分支（含触发器 P0001、
--      CHECK 23514、唯一冲突 23505、外键 23503、锁超时 55P03、语句超时 57014、
--      死锁 40001/40P01、以及兜底的 WHEN OTHERS）都映射到 §14.1 的某个码。
--   LD006 = LEDGER_IDEMPOTENCY_REPLAY：**仅用于并发同键时「冲突行落在本语句快照之外」**
--      这一种情形（单语句内无法刷新快照）。TS 侧收到 LD006 立即**重发同一条语句**
--      （第二次即新快照 ⇒ 正常返回 replay=true 的既有结果）；重发仍失败才报 409。
--
-- ---------------------------------------------------------------- 与 0001..0003 的关系
-- 只**新增**对象（内部辅助函数 + 1 个事件函数），不改 0001/0002/0003 的任何对象与行；
-- 不新增表、不新增索引、不改 kind 关闭集、不禁用任何触发器。
-- ============================================================================


-- ============================================================================
-- §A 错误码 → 自定义 SQLSTATE（§14.1 关闭集的唯一 DB 侧投影）
-- ============================================================================

CREATE OR REPLACE FUNCTION ledger_sqlstate_of(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_code
    WHEN 'LEDGER_INSUFFICIENT_BALANCE'        THEN 'LD001'
    WHEN 'LEDGER_INSUFFICIENT_FROZEN'         THEN 'LD002'
    WHEN 'LEDGER_IDEMPOTENCY_CONFLICT'        THEN 'LD003'
    WHEN 'LEDGER_IDEMPOTENCY_KEY_REQUIRED'    THEN 'LD004'
    WHEN 'LEDGER_IDEMPOTENCY_KEY_INVALID'     THEN 'LD005'
    WHEN 'LEDGER_IDEMPOTENCY_REPLAY'          THEN 'LD006'
    WHEN 'LEDGER_CURRENCY_NOT_FOUND'          THEN 'LD007'
    WHEN 'LEDGER_CURRENCY_NOT_LISTED'         THEN 'LD008'
    WHEN 'LEDGER_CURRENCY_FROZEN'             THEN 'LD009'
    WHEN 'LEDGER_CURRENCY_DELISTED'           THEN 'LD010'
    WHEN 'LEDGER_CURRENCY_INVALID_TRANSITION' THEN 'LD011'
    WHEN 'LEDGER_CURRENCY_MISMATCH'           THEN 'LD012'
    WHEN 'LEDGER_SUPPLY_CAP_EXCEEDED'         THEN 'LD013'
    WHEN 'LEDGER_UNAUTHORIZED_MINT'           THEN 'LD014'
    WHEN 'LEDGER_HOLD_NOT_ALLOWED'            THEN 'LD015'
    WHEN 'LEDGER_AMOUNT_INVALID'              THEN 'LD016'
    WHEN 'LEDGER_AMOUNT_NOT_POSITIVE'         THEN 'LD017'
    WHEN 'LEDGER_DECIMALS_OVERFLOW'           THEN 'LD018'
    WHEN 'LEDGER_SELF_TRANSFER'               THEN 'LD019'
    WHEN 'LEDGER_ACCOUNT_NOT_FOUND'           THEN 'LD020'
    WHEN 'LEDGER_RESERVED_UID'                THEN 'LD021'
    WHEN 'LEDGER_REF_NOT_FOUND'               THEN 'LD022'
    WHEN 'LEDGER_UNKNOWN_KIND'                THEN 'LD023'
    WHEN 'LEDGER_TRANSACTION_REQUIRED'        THEN 'LD024'
    WHEN 'LEDGER_LOCK_TIMEOUT'                THEN 'LD025'
    WHEN 'LEDGER_TX_TIMEOUT'                  THEN 'LD026'
    WHEN 'LEDGER_DEADLOCK_RETRY_EXHAUSTED'    THEN 'LD027'
    WHEN 'LEDGER_NEGATIVE_BALANCE_GUARD'      THEN 'LD028'
    WHEN 'LEDGER_APPEND_ONLY_VIOLATION'       THEN 'LD029'
    WHEN 'LEDGER_ACCOUNT_GUARD_VIOLATION'     THEN 'LD030'
    WHEN 'LEDGER_FEE_RATE_INVALID'            THEN 'LD031'
    WHEN 'LEDGER_RECONCILE_MISMATCH'          THEN 'LD032'
    WHEN 'LEDGER_CURRENCY_SYMBOL_TAKEN'       THEN 'LD033'
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION ledger_sqlstate_of(text) IS
  'P1e：§14.1 错误码 → 自定义 SQLSTATE 的唯一投影表（LD001..LD033）。未登记码返回 NULL ⇒ 由 ledger_raise 兜底到 LD999。';

-- 统一抛出器：MESSAGE = §14.1 码名；DETAIL = §14.4 details 的 JSON 字符串。
-- 未登记的错误码 = 调用方缺陷 ⇒ 兜底报 §14 的 500 类（LEDGER_TRANSACTION_REQUIRED），
-- 并在 DETAIL 里带上 requested_code（机读），**绝不裸抛**（否则 TS 侧无法归类）。
CREATE OR REPLACE FUNCTION ledger_raise(p_code text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_state text;
BEGIN
  v_state := ledger_sqlstate_of(p_code);
  IF v_state IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'LD999',
      MESSAGE = 'LEDGER_TRANSACTION_REQUIRED',
      DETAIL  = jsonb_build_object(
                  'reason', 'unmapped_ledger_error_code',
                  'requested_code', p_code,
                  'error_name', 'UnmappedLedgerErrorCode')::text;
  END IF;
  RAISE EXCEPTION USING
    ERRCODE = v_state,
    MESSAGE = p_code,
    DETAIL  = COALESCE(p_details, '{}'::jsonb)::text;
END $$;

COMMENT ON FUNCTION ledger_raise(text, jsonb) IS
  'P1e：账本错误的唯一抛出出口。ERRCODE = 自定义 SQLSTATE，MESSAGE = §14.1 码名，DETAIL = details JSON。';


-- ============================================================================
-- §B 金额与入参解析（与 TS 侧 parseUserAmount / toAmount 语义一一对应）
-- ============================================================================

-- R71：单笔金额上限（最小单位整数），与 src/ledger.ts 的 MAX_SINGLE_AMOUNT 同值
CREATE OR REPLACE FUNCTION ledger_max_single_amount() RETURNS bigint
LANGUAGE sql IMMUTABLE AS $$ SELECT 1000000000000000::bigint $$;  -- 1e15

-- 整数形态的金额（最小单位）：'^-?\d+$'，长度 <= 19 防 bigint 溢出
CREATE OR REPLACE FUNCTION ledger_int_amount(p_raw text, p_field text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_s text;
BEGIN
  IF p_raw IS NULL THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object('field', p_field, 'reason', 'MISSING'));
  END IF;
  v_s := btrim(p_raw);
  IF v_s !~ '^-?[0-9]+$' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', p_field, 'reason', 'NOT_DECIMAL_INTEGER', 'value', left(v_s, 40)));
  END IF;
  IF length(ltrim(v_s, '-')) > 19 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', p_field, 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_s, 40)));
  END IF;
  RETURN v_s::bigint;
END $$;

-- 用户输入形态的金额 → 最小单位（R72：① 非字符串一律拒 ② > 0 ③ 小数位不得超 decimals
-- ④ 不得超单笔上限），逐格对齐 TS 的 parseUserAmount。
CREATE OR REPLACE FUNCTION ledger_parse_user_amount(
  p_raw text, p_decimals int, p_field text, p_cid text
) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_s text; v_int text; v_frac text; v_units_text text; v_n bigint;
BEGIN
  IF p_raw IS NULL THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object('field', p_field, 'reason', 'MISSING'));
  END IF;
  v_s := btrim(p_raw);
  -- TS：先判负号 ⇒ LEDGER_AMOUNT_NOT_POSITIVE（'^-'）；再做十进制字符串形态校验
  IF v_s LIKE '-%' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE', jsonb_build_object('field', p_field, 'value', v_s));
  END IF;
  IF v_s !~ '^[0-9]+(\.[0-9]*)?$' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', p_field, 'reason', 'NOT_DECIMAL_STRING', 'value', left(v_s, 40)));
  END IF;
  v_int  := split_part(v_s, '.', 1);
  v_frac := CASE WHEN position('.' IN v_s) > 0 THEN split_part(v_s, '.', 2) ELSE '' END;
  IF length(v_frac) > p_decimals THEN
    PERFORM ledger_raise('LEDGER_DECIMALS_OVERFLOW', jsonb_build_object(
      'cid', p_cid, 'field', p_field, 'decimals', p_decimals, 'provided', length(v_frac)));
  END IF;
  IF length(v_int) + p_decimals > 19 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', p_field, 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_s, 40)));
  END IF;
  v_units_text := v_int || rpad(v_frac, p_decimals, '0');
  v_n := v_units_text::bigint;
  IF v_n <= 0 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE', jsonb_build_object('field', p_field, 'value', v_n::text));
  END IF;
  IF v_n > ledger_max_single_amount() THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field, 'value', v_n::text, 'reason', 'OVER_MAX_SINGLE_AMOUNT'));
  END IF;
  RETURN v_n;
END $$;

-- payload 金额取值：amount_units（已是最小单位）优先，否则 amount（按 decimals 换算）
CREATE OR REPLACE FUNCTION ledger_payload_amount(
  p_payload jsonb, p_decimals int, p_field text, p_cid text
) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_n bigint;
BEGIN
  IF p_payload ? 'amount_units' THEN
    IF jsonb_typeof(p_payload->'amount_units') <> 'string' THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', p_field, 'reason', 'NOT_STRING'));
    END IF;
    v_n := ledger_int_amount(p_payload->>'amount_units', p_field);
    IF v_n <= 0 THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE', jsonb_build_object('field', p_field, 'value', v_n::text));
    END IF;
    IF v_n > ledger_max_single_amount() THEN
      PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
        'field', p_field, 'value', v_n::text, 'reason', 'OVER_MAX_SINGLE_AMOUNT'));
    END IF;
    RETURN v_n;
  END IF;
  IF COALESCE(jsonb_typeof(p_payload->'amount'), 'missing') <> 'string' THEN
    -- R72①：浮点 JSON number / 非字符串一律拒（不静默换算）
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field,
      'reason', CASE WHEN p_payload ? 'amount' THEN 'NOT_STRING' ELSE 'MISSING' END));
  END IF;
  RETURN ledger_parse_user_amount(p_payload->>'amount', p_decimals, p_field, p_cid);
END $$;

-- 可选的上界（business_frozen_cap）：整数形态（R36 业务表证明的在冻额）
CREATE OR REPLACE FUNCTION ledger_payload_cap(p_payload jsonb, p_field text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF NOT (p_payload ? p_field) OR (p_payload->p_field = 'null'::jsonb) THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_payload->p_field) <> 'string' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object('field', p_field, 'reason', 'NOT_STRING'));
  END IF;
  RETURN ledger_int_amount(p_payload->>p_field, p_field);
END $$;

-- uid 形态解析（保持与 TS toAmount 同款失败码：LEDGER_AMOUNT_INVALID + field）
CREATE OR REPLACE FUNCTION ledger_uid_arg(p_raw text, p_field text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN ledger_int_amount(p_raw, p_field);
END $$;

-- cid 形态解析（非法 / <= 0 ⇒ 视同「该单位不存在」，§14.3 借用纪律）
CREATE OR REPLACE FUNCTION ledger_cid_arg(p_raw text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_c bigint;
BEGIN
  v_c := ledger_int_amount(p_raw, 'cid');
  IF v_c <= 0 THEN
    PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_c::text));
  END IF;
  RETURN v_c;
END $$;

-- 归一化分录形状（值一律 text：R70 禁止把 bigint 交给 JSON number 以免丢精度）
CREATE OR REPLACE FUNCTION ledger_norm_entry(
  p_uid bigint, p_cid bigint, p_delta bigint, p_frozen_delta bigint, p_kind text,
  p_ref_type text, p_ref_id bigint, p_memo text, p_reversal bigint,
  p_idem_key text, p_fingerprint text
) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'uid',                 p_uid::text,
    'cid',                 p_cid::text,
    'delta',               p_delta::text,
    'frozen_delta',        p_frozen_delta::text,
    'kind',                p_kind,
    'ref_type',            p_ref_type,
    'ref_id',              CASE WHEN p_ref_id IS NULL THEN NULL ELSE p_ref_id::text END,
    'memo',                COALESCE(p_memo, ''),
    'reversal_of_txid',    CASE WHEN p_reversal IS NULL THEN NULL ELSE p_reversal::text END,
    'idempotency_key',     p_idem_key,
    'request_fingerprint', p_fingerprint
  ) $$;

-- ledger_entry 行 → 出参 JSON（金额与 txid 一律 text：R70）
CREATE OR REPLACE FUNCTION ledger_entry_json(r ledger_entry) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'txid',                r.txid::text,
    'uid',                 r.uid::text,
    'cid',                 r.cid::text,
    'delta',               r.delta::text,
    'frozen_delta',        r.frozen_delta::text,
    'balance_after',       r.balance_after::text,
    'frozen_after',        r.frozen_after::text,
    'kind',                r.kind,
    'ref_type',            r.ref_type,
    'ref_id',              CASE WHEN r.ref_id IS NULL THEN NULL ELSE r.ref_id::text END,
    'idempotency_key',     r.idempotency_key,
    'request_fingerprint', r.request_fingerprint,
    'reversal_of_txid',    CASE WHEN r.reversal_of_txid IS NULL THEN NULL ELSE r.reversal_of_txid::text END,
    'memo',                r.memo,
    'time_created',        to_char(r.time_created AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) $$;

-- 事件分录集合 → accounts 快照（与旧 TS snapshotsOf 同语义：首次出现定序，末次快照定值）
CREATE OR REPLACE FUNCTION ledger_accounts_from_entries(p_entries jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_u bigint[] := '{}'; v_c bigint[] := '{}'; v_b text[] := '{}'; v_f text[] := '{}';
  v_i int; v_j int; v_slot int; v_e jsonb; v_n int;
BEGIN
  v_n := COALESCE(jsonb_array_length(p_entries), 0);
  FOR v_i IN 0..v_n - 1 LOOP
    v_e := p_entries -> v_i;
    v_slot := NULL;
    FOR v_j IN 1..COALESCE(array_length(v_u, 1), 0) LOOP
      IF v_u[v_j] = (v_e->>'uid')::bigint AND v_c[v_j] = (v_e->>'cid')::bigint THEN
        v_slot := v_j; EXIT;
      END IF;
    END LOOP;
    IF v_slot IS NULL THEN
      v_u := v_u || (v_e->>'uid')::bigint;
      v_c := v_c || (v_e->>'cid')::bigint;
      v_b := v_b || (v_e->>'balance_after');
      v_f := v_f || (v_e->>'frozen_after');
    ELSE
      v_b[v_slot] := v_e->>'balance_after';
      v_f[v_slot] := v_e->>'frozen_after';
    END IF;
  END LOOP;
  IF array_length(v_u, 1) IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN (SELECT jsonb_agg(jsonb_build_object(
              'uid', u::text, 'cid', c::text, 'balance', b, 'frozen', f) ORDER BY ord)
            FROM unnest(v_u, v_c, v_b, v_f) WITH ORDINALITY AS t(u, c, b, f, ord));
END $$;

-- R28「状态 × 操作」矩阵（逐格，含 §19.3 补格）+ R26（$ 恒为 listed）
CREATE OR REPLACE FUNCTION ledger_assert_currency_op(p_cur currency, p_op text) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_ok boolean; v_details jsonb;
BEGIN
  IF p_cur.cid = 1 AND p_cur.status <> 'listed' THEN
    PERFORM ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('cid', p_cur.cid::text, 'from', 'listed', 'to', p_cur.status));
  END IF;
  v_ok := CASE p_op
    WHEN 'mint'         THEN p_cur.status IN ('draft', 'listed')
    WHEN 'transfer'     THEN p_cur.status IN ('draft', 'listed', 'frozen', 'delisted')
    WHEN 'hold'         THEN p_cur.status IN ('listed')
    WHEN 'price'        THEN p_cur.status IN ('listed')
    WHEN 'hold_release' THEN p_cur.status IN ('draft', 'listed', 'frozen', 'delisted')
    WHEN 'settle'       THEN p_cur.status IN ('listed')
    ELSE NULL
  END;
  IF v_ok IS NULL THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'currency_op', 'value', p_op, 'reason', 'UNKNOWN_CURRENCY_OP'));
  END IF;
  IF v_ok THEN RETURN; END IF;
  v_details := jsonb_build_object('cid', p_cur.cid::text, 'symbol', p_cur.symbol,
                                  'status', p_cur.status, 'op', p_op);
  IF p_cur.status = 'frozen' THEN
    PERFORM ledger_raise('LEDGER_CURRENCY_FROZEN', v_details);
  ELSIF p_cur.status = 'delisted' THEN
    PERFORM ledger_raise('LEDGER_CURRENCY_DELISTED', v_details);
  ELSE
    PERFORM ledger_raise('LEDGER_CURRENCY_NOT_LISTED', v_details);
  END IF;
END $$;

-- R101 平台账户 kind 白名单（逐格照抄 src/ledger.ts 的 PLATFORM_KIND_WHITELIST；
--   -4..-99 预留区间不在本白名单管辖内；§19.1：仅 -3 允许以 transfer 出账）
CREATE OR REPLACE FUNCTION ledger_assert_platform_mutation(
  p_uid bigint, p_kind text, p_dir text
) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_ok boolean;
BEGIN
  v_ok := CASE p_uid::text
    WHEN '0'  THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('mint', 'transfer', 'reversal')
                                    ELSE p_kind IN ('transfer', 'burn', 'reversal') END
    WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN ('trade_fee', 'listing_fee', 'currency_create_fee')
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

-- 20 个 kind 关闭集（§5.1，与 migrations/0003 的 ledger_kind_enum 同集）
CREATE OR REPLACE FUNCTION ledger_kind_ok(p_kind text, p_frozen_settle boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_kind IN (
    'mint','burn','transfer','hold','hold_release','hold_forfeit',
    'job_escrow','job_escrow_refund','job_payout','job_fee','commission',
    'purchase','sale','purchase_refund','trade','trade_fee',
    'listing_fee','listing_deposit','currency_create_fee','reversal')
  AND (NOT p_frozen_settle OR p_kind IN ('job_payout','purchase','trade','hold_forfeit'))
$$;


-- ============================================================================
-- §C 事件函数本体
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
  -- 异常映射
  v_cname         text;
  v_msg           text;
  v_state         text;
  v_detail        text;
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

  -- R53：指纹只作用于事件第 1 条分录；可为 NULL（§19.6：未传指纹 = 同键即重放）
  IF payload ? 'request_fingerprint' AND jsonb_typeof(payload->'request_fingerprint') = 'string' THEN
    v_fp := NULLIF(payload->>'request_fingerprint', '');
  ELSE
    v_fp := NULL;
  END IF;

  v_memo := COALESCE(payload->>'memo', '');

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

  -- ---------------------------------------------------------------- C1 单语句内的 R82 超时
  -- 本函数 = 一条语句 = 一个隐式事务 ⇒ lock_timeout 约束的是「本语句内的锁等待」，
  -- 不再被多语句 × RTT 放大（lock_timeout=3s 只覆盖一个持有者 ⇒ 有效并发上限 2 的
  -- 那个问题随之消失）。
  PERFORM set_config('lock_timeout', '3000', true);
  PERFORM set_config('statement_timeout', '10000', true);

  -- ================================================================ C2 按 op 组装分录
  IF v_op = 'mint' THEN
    v_uid := ledger_uid_arg(payload->>'uid', 'uid');
    v_cid := ledger_cid_arg(payload->>'cid');
    -- R83：mint 必须先锁 currency 行（再动 account），顺序不可颠倒
    SELECT * INTO v_cur FROM currency WHERE cid = v_cid FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_cid::text));
    END IF;
    v_trace := v_trace || to_jsonb('currency:' || v_cid::text);
    v_sym := v_cur.symbol;

    -- 与旧 TS 同序：先解析金额（需要 decimals），再判状态矩阵
    v_amount := ledger_payload_amount(payload, v_cur.decimals, 'amount', v_cid::text);
    PERFORM ledger_assert_currency_op(v_cur, 'mint');   -- R28 + R26

    -- R23 授权：owner 自铸；$ (owner_uid = 0) 仅平台受信任路径
    v_platform := COALESCE((payload->>'platform')::boolean, false);
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

    -- R24 供给上限（$ 的 supply_cap = NULL ⇒ 无限）
    v_supply_before := v_cur.total_supply;
    v_cap := v_cur.supply_cap;
    IF v_cap IS NOT NULL AND v_supply_before + v_amount > v_cap THEN
      PERFORM ledger_raise('LEDGER_SUPPLY_CAP_EXCEEDED', jsonb_build_object(
        'cid', v_cur.cid::text, 'symbol', v_cur.symbol, 'total_supply', v_supply_before::text,
        'supply_cap', v_cap::text, 'requested', v_amount::text));
    END IF;

    v_entries := jsonb_build_array(ledger_norm_entry(
      v_uid, v_cid, v_amount, 0, 'mint', v_ref_type, v_ref_id, v_memo, NULL, v_key, v_fp));

  ELSIF v_op = 'transfer' THEN
    v_from := ledger_uid_arg(payload->>'from_uid', 'fromUid');
    v_to   := ledger_uid_arg(payload->>'to_uid', 'toUid');
    v_cid  := ledger_cid_arg(payload->>'cid');
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
    v_uid := ledger_uid_arg(payload->>'uid', 'uid');
    v_cid := ledger_cid_arg(payload->>'cid');
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
    IF v_cap_arg IS NOT NULL AND v_amount > v_cap_arg THEN
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
    v_from := ledger_uid_arg(payload->>'from_uid', 'fromUid');
    v_cid  := ledger_cid_arg(payload->>'cid');
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
      v_to := ledger_uid_arg(payload->>'to_uid', 'toUid');
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
    IF v_cap_arg IS NOT NULL AND v_amount > v_cap_arg THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_FROZEN', jsonb_build_object(
        'uid', v_from::text, 'cid', v_cid::text, 'required', v_amount::text,
        'available', v_cap_arg::text, 'reason', 'business_frozen_cap'));
    END IF;

    -- 受款方 kind：调用方显式给出优先；缺省按 TS SETTLE_PAYEE_KIND 映射（purchase ⇒ sale）
    IF v_is_forfeit THEN
      v_payee_kind := v_kind;
    ELSE
      -- 缺省按 TS SETTLE_PAYEE_KIND 映射（purchase ⇒ sale）
      v_payee_kind := CASE v_kind
        WHEN 'purchase' THEN COALESCE(NULLIF(payload->>'payee_kind', ''), 'sale')
        ELSE COALESCE(NULLIF(payload->>'payee_kind', ''), v_kind) END;
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
    v_cur_op := NULLIF(payload->>'currency_op', '');

    FOR v_i IN 0..jsonb_array_length(payload->'entries') - 1 LOOP
      v_e := payload->'entries' -> v_i;
      IF v_e IS NULL OR jsonb_typeof(v_e) <> 'object' THEN
        PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
          'field', 'entries[' || v_i || ']', 'reason', 'BAD_TYPE'));
      END IF;
      v_e_uid := ledger_uid_arg(v_e->>'uid', 'entries[' || v_i || '].uid');
      v_e_cid := ledger_cid_arg(v_e->>'cid');
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

      v_e_key := CASE WHEN v_i = 0 THEN v_key ELSE v_key || '#' || (v_i + 1)::text END;
      v_e_fp  := CASE WHEN v_i = 0 THEN v_fp ELSE NULL END;

      v_entries := v_entries || ledger_norm_entry(
        v_e_uid, v_e_cid, v_e_delta, v_e_frz, v_e_kind, v_e_ref_type, v_e_ref_id,
        COALESCE(v_e->>'memo', v_memo), v_e_rev, v_e_key, v_e_fp);
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
  v_n := jsonb_array_length(v_entries);
  FOR v_i IN 0..v_n - 1 LOOP
    v_e := v_entries -> v_i;
    v_sum_d := v_sum_d + (v_e->>'delta')::bigint;
    v_sum_f := v_sum_f + (v_e->>'frozen_delta')::bigint;
    IF v_e->>'kind' IN ('mint', 'burn') THEN v_has_mb := true; END IF;
  END LOOP;
  IF NOT v_has_mb AND (v_sum_d + v_sum_f) <> 0 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', 'entries', 'reason', 'EVENT_NOT_BALANCED',
      'delta_sum', v_sum_d::text, 'frozen_delta_sum', v_sum_f::text,
      'net_sum', (v_sum_d + v_sum_f)::text));
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
    INSERT INTO account (uid, cid, balance, frozen) VALUES (v_rec.u::bigint, v_rec.c::bigint, 0, 0)
      ON CONFLICT (uid, cid) DO NOTHING;
    SELECT balance, frozen INTO v_tmp_b, v_tmp_f
      FROM account WHERE uid = v_rec.u::bigint AND cid = v_rec.c::bigint FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM ledger_raise('LEDGER_ACCOUNT_NOT_FOUND',
        jsonb_build_object('uid', v_rec.u, 'cid', v_rec.c));
    END IF;
    v_slot_u := v_slot_u || v_rec.u::bigint;
    v_slot_c := v_slot_c || v_rec.c::bigint;
    v_slot_b := v_slot_b || v_tmp_b;
    v_slot_f := v_slot_f || v_tmp_f;
    v_slot_n := v_slot_n + 1;
    v_trace := v_trace || to_jsonb('account:' || v_rec.u || ':' || v_rec.c);
  END LOOP;

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

    -- R80：库内先判，CHECK（account_bal_guard / ledger_after_guard）仅作兵底
    IF v_cur_bal + v_e_delta < 0 THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_BALANCE', jsonb_build_object(
        'uid', v_e_uid::text, 'cid', v_e_cid::text,
        'required', (-v_e_delta)::text, 'available', v_cur_bal::text));
    END IF;
    IF v_cur_frz + v_e_frz < 0 THEN
      PERFORM ledger_raise('LEDGER_INSUFFICIENT_FROZEN', jsonb_build_object(
        'uid', v_e_uid::text, 'cid', v_e_cid::text,
        'required', (-v_e_frz)::text, 'available', v_cur_frz::text));
    END IF;

    v_slot_b[v_slot] := v_cur_bal + v_e_delta;
    v_slot_f[v_slot] := v_cur_frz + v_e_frz;
    v_bal_after := v_bal_after || (v_cur_bal + v_e_delta);
    v_frz_after := v_frz_after || (v_cur_frz + v_e_frz);
  END LOOP;

  -- ================================================================ C6 写入（R74：先分录后账户）
  v_first_txid := NULL;
  BEGIN
    -- ① 幂等探针 = 事件第 1 条分录（R51：靠唯一约束，禁止「先查后插」）
    INSERT INTO ledger_entry
      (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id,
       idempotency_key, request_fingerprint, reversal_of_txid, memo)
    VALUES
      ((v_entries->0->>'uid')::bigint, (v_entries->0->>'cid')::bigint,
       (v_entries->0->>'delta')::bigint, (v_entries->0->>'frozen_delta')::bigint,
       v_bal_after[1], v_frz_after[1], v_entries->0->>'kind',
       NULLIF(v_entries->0->>'ref_type', ''),
       NULLIF(v_entries->0->>'ref_id', '')::bigint,
       v_entries->0->>'idempotency_key',
       NULLIF(v_entries->0->>'request_fingerprint', ''),
       NULLIF(v_entries->0->>'reversal_of_txid', '')::bigint,
       COALESCE(v_entries->0->>'memo', ''))
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING * INTO v_row;

    IF v_row.txid IS NOT NULL THEN
      v_first_txid := v_row.txid;
      v_out := v_out || ledger_entry_json(v_row);
      v_row := NULL;

      -- ② 其余分录（派生键 <key>#<i>，i >= 2）
      FOR v_i IN 1..v_n - 1 LOOP
        v_e := v_entries -> v_i;
        INSERT INTO ledger_entry
          (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id,
           idempotency_key, request_fingerprint, reversal_of_txid, memo)
        VALUES
          ((v_e->>'uid')::bigint, (v_e->>'cid')::bigint,
           (v_e->>'delta')::bigint, (v_e->>'frozen_delta')::bigint,
           v_bal_after[v_i + 1], v_frz_after[v_i + 1], v_e->>'kind',
           NULLIF(v_e->>'ref_type', ''), NULLIF(v_e->>'ref_id', '')::bigint,
           v_e->>'idempotency_key', NULLIF(v_e->>'request_fingerprint', ''),
           NULLIF(v_e->>'reversal_of_txid', '')::bigint, COALESCE(v_e->>'memo', ''))
        RETURNING * INTO v_row;
        v_out := v_out || ledger_entry_json(v_row);
      END LOOP;

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
  EXCEPTION
    -- 幂等占位之外的唯一冲突（键族撞键 / 派生键被占）⇒ 409
    WHEN unique_violation THEN
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT', jsonb_build_object(
        'idempotency_key', v_key, 'reason', 'UNIQUE_KEY_FAMILY_COLLISION'));
    -- 23514：CHECK（account_bal_guard / account_frz_guard / ledger_after_guard /
    --              currency_supply_guard / ledger_kind_enum / ledger_move_guard / ...）
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_cname = CONSTRAINT_NAME;
      IF v_cname IN ('account_bal_guard', 'account_frz_guard', 'ledger_after_guard') THEN
        PERFORM ledger_raise('LEDGER_NEGATIVE_BALANCE_GUARD', jsonb_build_object('constraint', v_cname));
      ELSIF v_cname = 'currency_supply_guard' THEN
        PERFORM ledger_raise('LEDGER_SUPPLY_CAP_EXCEEDED', jsonb_build_object('constraint', v_cname));
      ELSIF v_cname = 'ledger_kind_enum' THEN
        PERFORM ledger_raise('LEDGER_UNKNOWN_KIND', jsonb_build_object('constraint', v_cname));
      ELSE
        PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
          jsonb_build_object('constraint', COALESCE(v_cname, 'unknown_check'), 'reason', 'CHECK_VIOLATION'));
      END IF;
    -- FK（cid 不存在 / reversal_of_txid 指向不存在的 txid）⇒ 404 借用
    WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS v_cname = CONSTRAINT_NAME;
      PERFORM ledger_raise('LEDGER_CURRENCY_NOT_FOUND',
        jsonb_build_object('constraint', COALESCE(v_cname, 'fk'), 'reason', 'FK_VIOLATION'));
    -- P0001：append-only / account_guard 触发器主动 RAISE
    WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg ILIKE '%append-only%' THEN
        PERFORM ledger_raise('LEDGER_APPEND_ONLY_VIOLATION', '{}'::jsonb);
      ELSIF v_msg ~* 'account' THEN
        PERFORM ledger_raise('LEDGER_ACCOUNT_GUARD_VIOLATION', '{}'::jsonb);
      ELSE
        PERFORM ledger_raise('LEDGER_TRANSACTION_REQUIRED',
          jsonb_build_object('reason', 'unclassified_db_raise', 'pg_code', 'P0001'));
      END IF;
    -- R82 超时（lock_timeout 3s / statement_timeout 10s）⇒ 503
    WHEN lock_not_available THEN
      PERFORM ledger_raise('LEDGER_LOCK_TIMEOUT', '{}'::jsonb);
    WHEN query_canceled THEN
      PERFORM ledger_raise('LEDGER_TX_TIMEOUT', '{}'::jsonb);
    WHEN serialization_failure THEN
      PERFORM ledger_raise('LEDGER_DEADLOCK_RETRY_EXHAUSTED', '{}'::jsonb);
    WHEN deadlock_detected THEN
      PERFORM ledger_raise('LEDGER_DEADLOCK_RETRY_EXHAUSTED', '{}'::jsonb);
    -- 兜底（绝不裸抛：TS 侧必须能归类；原始 SQLSTATE 进 DETAIL 供日志定位，R107/R108）
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
      PERFORM ledger_raise('LEDGER_TRANSACTION_REQUIRED', jsonb_build_object(
        'reason', 'unclassified_db_error',
        'pg_code', v_state,
        'error_name', 'PlpgsqlRuntimeError',
        'error_hint', left(COALESCE(v_detail, v_msg), 200)));
  END;

  -- ================================================================ C7 幂等重放（R51③④ / R52）
  IF v_first_txid IS NULL THEN
    -- 探针命中既有键 ⇒ 本语句**未写入任何账务**（只锁过行，语句结束即释放）
    SELECT COALESCE(jsonb_agg(ledger_entry_json(t) ORDER BY t.txid), '[]'::jsonb)
      INTO v_out
      FROM ledger_entry t
     WHERE t.idempotency_key = v_key
        OR left(t.idempotency_key, length(v_key) + 1) = v_key || '#';

    IF jsonb_array_length(v_out) = 0 THEN
      -- 唯一索引看见了冲突行，但它落在本语句快照之外（并发同键）
      -- ⇒ 交给 TS 侧重发同一条语句（第二次即新快照，正常返回既有结果）
      PERFORM ledger_raise('LEDGER_IDEMPOTENCY_REPLAY', jsonb_build_object(
        'idempotency_key', v_key, 'reason', 'replay_row_not_visible_in_statement_snapshot'));
    END IF;

    -- R52②：同键但指纹不同 ⇒ 409（未传指纹 = 按重放，§19.6）
    SELECT t.request_fingerprint INTO v_stored_fp
      FROM ledger_entry t WHERE t.idempotency_key = v_key;
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
        'supply_after', (v_supply_before + v_amount)::text,
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
END;
$fn$;

COMMENT ON FUNCTION ledger_post_event(jsonb) IS
  'P1e（D10 变体 B）：一个业务事件 = 一次往返。校验/幂等占位/加锁(R79)/分录/余额与冻结更新(R74)/配对不变式(R41)+§11 判据 8 全在一次调用内完成。'
  'op = mint|transfer|hold|hold_release|settle|entries。错误一律用自定义 SQLSTATE(LD001..LD033) + MESSAGE=§14.1 码名 + DETAIL=§14.4 details JSON 机读传出。';
