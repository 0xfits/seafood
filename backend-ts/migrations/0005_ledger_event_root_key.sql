-- ============================================================================
-- 0005_ledger_event_root_key.sql · P1f（Kong）：P1e 独立质检三条缺陷的修复
-- ============================================================================
-- 上游：0004_ledger_post_event.sql（P1e / D10 变体 B）—— **不改一行**。
--       本文件只做「加一列 + 加索引 + 加 CHECK + CREATE OR REPLACE 若干函数」的**增量**修复。
-- 权威口径：docs/ledger.spec.md（v0.3）；规格同步清单见交付报告「spec_rows_to_sync」。
--
-- ---------------------------------------------------------------- 修什么
-- 【F1 · 高】幂等派生键碰撞（无关业务事件被静默丢弃却报成功）
--   根因：0004 只校验键前缀 `^(biz|cm|cli|ops):`（**不禁止 `#`**），而事件第 i 条分录的键
--   被派生为 `<key>#<i>`；重放分支用 `key = v_key OR left(key, length+1) = v_key||'#'`
--   查询，会**匹配他人事件的派生键**；指纹校验只查 `WHERE idempotency_key = v_key`，
--   而派生行的 `request_fingerprint` 恒为 NULL ⇒ 校验被短路 ⇒ 报 ok/replay 而**不落账**。
--     方向①：B 以 `a#2` 落自己的事件 ⇒ 撞 A 的第 2 条分录 ⇒ 静默丢弃却报成功。
--     方向②：先落单条 `p#2`，再落两分录 `p` ⇒ 第二条分录撞唯一约束 ⇒ 误判 409。
--   修法（三层，缺一不可）：
--     ① **键字符集收紧**：调用方键**禁止** `#`（内部派生键分隔符）⇒「调用方键集合」与
--        「内部派生键集合」**按构造互斥**；且派生 `f(key,i)=key||'#'||i` 在合法键域上是
--        **单射**（两个方向都不可能再构造出碰撞）。
--     ② **归属落列**：新列 `ledger_entry.event_root_key` 由函数在**每一条**分录上写入
--        事件根键；重放判定改为 `event_root_key = <key>` 的**精确等值**（索引可用），
--        不再依赖字符串前缀算术。
--     ③ **根行存在性 + 归属校验**：幂等探针命中的行必须就是「键 = 根键」的根行，且其
--        归属必须等于本键；否则一律 `LEDGER_IDEMPOTENCY_CONFLICT(409)` +
--        `reason=KEY_OWNED_BY_ANOTHER_EVENT_ROOT`，**绝不冒充重放**。指纹取自
--        **事件自己的根行**，故不可能再被派生行（指纹恒 NULL）短路。
-- 【F2 · 中高】C0–C5 无兜底 ⇒ 调用方可构造 500（22003 / 22P02 逃出 §14.1 闭集）
--     ① 全函数体（C0–C8）由**唯一** EXCEPTION 处理器兜底（0004 只包住 C6 写入段）；
--     ② `SQLSTATE → §14.1 码` 的归类抽成**纯函数** `ledger_error_for_sqlstate`（全定义域，
--        永不返回 NULL；可被质检独立枚举验证）；
--     ③ 六例已知越界在**源头**收紧：`ledger_int_amount` 真范围闸（不再只拦「> 19 位」）、
--        Σdelta 与单账户推演改用 numeric 求和后查界、`ledger_parse_user_amount` 同闸；
--     ④ 三条「静默接受的类型闸缺口」按裁定处理：`cid` 收紧为字符串、`memo` 收紧为字符串、
--        `uid` 前后空格**允许并登记**（与 TS `toAmount` 的 `trim()` 逐字同语义）。
-- 〔P1i 补单（本轮新增）〕
--   · **M31/M43 漏闸**（修前基线自测新发现）：`amount_units` 优先 ⇒ `amount` 被**静默忽略**，
--     于是 `{amount_units, amount:'1000000000000001'}`（超 R71 单笔上限）与
--     `{amount_units, amount:'1e5'}`（指数形式）都返回 200。修法见 §D2（两个金额字段同时出现
--     ⇒ 400 `AMBIGUOUS_AMOUNT`）+ §D（指数形式专属 reason `EXPONENT_NOT_ALLOWED`）。
--   · **键字符集闸的覆盖面**：`#` / 控制字符禁令作用于**每一个 `idempotency_key` 位置**，
--     含 `entries[].idempotency_key`（修前实测该处 '#' 被静默忽略 ⇒ 7 种 op 形状不能全部 400）。
-- 【F3 · 中】假超时上限 + 未映射 SQLSTATE + 基础设施错误吞成 500
--     ① `set_config('statement_timeout', …, true)` 对**它自己那条语句无效**（实测 4181ms
--        不被取消）⇒ 删除该假声明，改为**函数内自证预算**：每次等锁前把 `lock_timeout`
--        压到 `min(3000, 剩余预算)`，取锁前后各查一次 deadline，越界即报
--        `LEDGER_TX_TIMEOUT(503)`（`reason=statement_budget_exhausted`）；
--     ② `55P03 / 40P01 / 57014` 由函数统一映射为 `LD025 / LD027 / LD026`（不再原样逃出），
--        DETAIL 带可机读 `reason` / `pg_code` / `retryable`；
--     ③ 基础设施类（`08xxx`/`53xxx`/`57xxx`/`58xxx`/`XXxxx`/`53000` 系列、只读事务、空闲
--        会话超时）一律 **503（可重试）**，与调用方入参错误（400）**分开**；
--     ④ `LD027` 语义更正：DB 层**0 次重试**（重试归调用方 R60），DETAIL 明写
--        `retries_performed=0` / `retry_owner=caller`（码名仍留在 §14.1 关闭集内，改名供 Jing 裁定）。
--
-- ---------------------------------------------------------------- 与 0001..0004 的关系
-- 只**新增**列 / 索引 / CHECK / 函数，或 `CREATE OR REPLACE` 覆盖 0004 定义的函数；
-- 不改 0001/0002/0003 的任何对象与行；不禁用任何触发器；不动 kind 关闭集；
-- 不做 `user` → `users` 改名（属后续 0006 单）。
-- ============================================================================


-- ============================================================================
-- §A F1 ②：事件根键归属列
-- ============================================================================
ALTER TABLE ledger_entry ADD COLUMN IF NOT EXISTS event_root_key text;

COMMENT ON COLUMN ledger_entry.event_root_key IS
  'P1f（F1）：该分录所属**事件根键**（= 调用方传入的 idempotency_key；事件内派生分录与其根键共用一值）。'
  '0005 之前写入的行本列为 NULL（历史数据，清理由后续单负责）；重放判定按本列精确归属。';

CREATE INDEX IF NOT EXISTS idx_ledger_event_root_key ON ledger_entry (event_root_key);

-- 结构性守卫：归属列必须等于「按派生规则从键反解出的根键」，杜绝将来写入错误的归属。
-- （历史行 NULL 通过；派生键 `<key>#<i>` 的 split_part 恰为 `<key>`。）
ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_event_root_guard;
ALTER TABLE ledger_entry ADD CONSTRAINT ledger_event_root_guard
  CHECK (event_root_key IS NULL OR event_root_key = split_part(idempotency_key, '#'::text, 1));


-- ============================================================================
-- §B F3 ①：函数内自证预算（替代「对自身语句无效」的 set_config(statement_timeout)）
-- ============================================================================
-- 机理（P1f 实测，见 p1f-00-probe-env.ts）：
--   `set_config('statement_timeout', N, true/false)` 在**同一条语句内**设置时，
--   该语句**不会被取消**（4181ms / 4384ms 读数为证）—— statement_timeout 在语句开始时
--   才武装；而独立语句 `SET statement_timeout` 后再跑慢语句会按预期取消（1705ms 读数为证）。
--   因此对「一条语句 = 一个业务事件」的函数，唯一**引擎无关且实测有效**的语句级约束是
--   函数内自证预算：lock_timeout 是**逐次获取**生效的（实测有效），把每次等锁的上限压到
--   「剩余预算」，并在取锁前后查 deadline，即可把整条语句的等待上界钳在预算内。
-- 连接级 `statement_timeout`（真上限）：直连端点可用（`options=-c statement_timeout=10000`，
--   实测 SHOW=10000ms 且按预期取消）；**pooler 端点明确拒绝该启动参数**（08P01
--   `unsupported startup parameter in options`，实测）⇒ 池化路径交由本节的自证预算。

CREATE OR REPLACE FUNCTION ledger_stmt_budget_ms() RETURNS int
LANGUAGE sql IMMUTABLE AS $$ SELECT 10000 $$;   -- R82：语句预算 10s

COMMENT ON FUNCTION ledger_stmt_budget_ms() IS
  'P1f（F3）:单条语句（= 一个业务事件）的自证总预算，毫秒。与 R82 的 statement_timeout 建议值同值。';

CREATE OR REPLACE FUNCTION ledger_lock_timeout_ms() RETURNS int
LANGUAGE sql IMMUTABLE AS $$ SELECT 3000 $$;    -- R82：单次等锁上限 3s

COMMENT ON FUNCTION ledger_lock_timeout_ms() IS
  'P1f（F3）:单次锁等待上限（R82 lock_timeout），毫秒；实际值会被剩余预算进一步压小。';

/** 剩余预算（毫秒）；deadline 为 NULL 时返回预算全值。
    注意：必须 VOLATILE（默认）—— 内部读 clock_timestamp()，标 IMMUTABLE/STABLE 会被
    计划器常量折叠，导致同一条语句内多次调用只算一次。 */
CREATE OR REPLACE FUNCTION ledger_budget_remaining_ms(p_deadline timestamptz) RETURNS int
LANGUAGE plpgsql AS $$
BEGIN
  IF p_deadline IS NULL THEN RETURN ledger_stmt_budget_ms(); END IF;
  RETURN floor(EXTRACT(EPOCH FROM (p_deadline - clock_timestamp())) * 1000)::int;
END $$;

COMMENT ON FUNCTION ledger_budget_remaining_ms(timestamptz) IS
  'P1f（F3）:距语句预算 deadline 的剩余毫秒数（可为 0 / 负数 ⇒ 调用方应立即报 LEDGER_TX_TIMEOUT）。';

/** 等锁前武装 lock_timeout：min(单次上限, 剩余预算)；剩余 <= 0 直接报 LD026（不尝试等锁） */
CREATE OR REPLACE FUNCTION ledger_arm_lock_timeout(p_deadline timestamptz, p_what text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_remaining int; v_ms int;
BEGIN
  v_remaining := ledger_budget_remaining_ms(p_deadline);
  IF v_remaining <= 0 THEN
    PERFORM ledger_raise('LEDGER_TX_TIMEOUT', jsonb_build_object(
      'reason', 'statement_budget_exhausted', 'budget_ms', ledger_stmt_budget_ms(),
      'remaining_ms', v_remaining, 'stage', COALESCE(p_what, 'unknown'), 'retryable', true));
  END IF;
  v_ms := least(ledger_lock_timeout_ms(), v_remaining);
  PERFORM set_config('lock_timeout', v_ms::text, true);
END $$;

COMMENT ON FUNCTION ledger_arm_lock_timeout(timestamptz, text) IS
  'P1f（F3）:等锁前把 lock_timeout 压到 min(3s, 剩余预算)（lock_timeout 逐次获取生效，实测有效）。';

/** 取锁后 / 关键阶段间查预算：越过 deadline 即报 LD026（503） */
CREATE OR REPLACE FUNCTION ledger_check_budget(p_deadline timestamptz, p_stage text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_deadline IS NOT NULL AND clock_timestamp() >= p_deadline THEN
    PERFORM ledger_raise('LEDGER_TX_TIMEOUT', jsonb_build_object(
      'reason', 'statement_budget_exhausted', 'budget_ms', ledger_stmt_budget_ms(),
      'remaining_ms', ledger_budget_remaining_ms(p_deadline),
      'stage', p_stage, 'retryable', true));
  END IF;
END $$;

COMMENT ON FUNCTION ledger_check_budget(timestamptz, text) IS
  'P1f（F3）:关键阶段后自证语句预算是否已耗尽；耗尽即 LEDGER_TX_TIMEOUT(503)。';


-- ============================================================================
-- §C F2 ①②/F3 ②③：SQLSTATE → §14 码 的**唯一归类函数**（全定义域，永不返回 NULL）
-- ============================================================================
-- 返回值（jsonb）：
--   code      §14.1 的**已登记码名**（33 个之一；本函数只可能返回已登记码）
--   reason    机读原因枚举（400 类/UPPERCASE_SNAKE；500/503 类/lowercase_snake，与 §14.4 现有枚举同风格）
--   bucket    'input'（调用方可触发 ⇒ 400 类）| 'integrity'（约束）| 'retryable'（事务冲突/超时 ⇒ 503）
--             | 'infra'（基础设施 ⇒ 503 可重试）| 'defect'（实现缺陷 ⇒ 500，R108 告警）
--   retryable 是否建议调用方按 R60 同键重试
--   pg_code / constraint  原始 SQLSTATE / 约束名（非敏感，仅用于机读定位）
-- 纪律：① **只返回 §14.1 已登记码**（code 恒非空）；② 调用方可触发的错误一律落 400 类（bucket='input'）；
--       ③ bucket↔§14.1 状态类的对应关系冻结为：
--            input       ⇒ 400 类（调用方入参可触发）
--            integrity   ⇒ 该约束对应的 §14.1 码（400 / 404 / 409，**绝不 500**）
--            retryable   ⇒ 503（事务冲突 / 超时）
--            infra       ⇒ 503（可重试；基础设施）
--            defect      ⇒ 500（实现缺陷，R108 必须告警）
--          ⇒ 「500 类码只可能来自 bucket='defect'」是一条可机读的封闭性判据（质检脚本据此对拍）。
CREATE OR REPLACE FUNCTION ledger_error_for_sqlstate(p_state text, p_constraint text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_cls text;
  v_code text;
  v_reason text;
  v_bucket text;
BEGIN
  v_cls := left(COALESCE(p_state, ''), 2);

  CASE
    -- ---------------------------------------------------------------- 完整性约束（逐格照抄 0004 C6 的既有映射）
    WHEN p_state = '23505' THEN
      v_bucket := 'integrity'; v_code := 'LEDGER_IDEMPOTENCY_CONFLICT'; v_reason := 'UNIQUE_KEY_FAMILY_COLLISION';
    WHEN p_state = '23514' THEN
      -- bucket 的纪律（本文件 §C 抬头）：'input' ⇒ 400 类；'integrity' ⇒ 该约束对应的
      -- §14.1 码（400/404/409，**绝不 500**）；'defect' ⇒ 500 类。故三条「余额/冻结/落账守卫」
      -- **不能**标 integrity —— 它们映射到 `LEDGER_NEGATIVE_BALANCE_GUARD`（§14.1 定为 500 类，
      -- R108 必须告警）：能走到这层 CHECK 说明函数内的 R80 前置判定漏了 = **实现缺陷**。
      IF p_constraint IN ('account_bal_guard', 'account_frz_guard', 'ledger_after_guard') THEN
        v_bucket := 'defect';
        v_code := 'LEDGER_NEGATIVE_BALANCE_GUARD'; v_reason := 'negative_balance_guard';
      ELSIF p_constraint = 'currency_supply_guard' THEN
        v_bucket := 'integrity'; v_code := 'LEDGER_SUPPLY_CAP_EXCEEDED'; v_reason := 'supply_cap_guard';
      ELSIF p_constraint = 'ledger_kind_enum' THEN
        v_bucket := 'input'; v_code := 'LEDGER_UNKNOWN_KIND'; v_reason := 'kind_enum_guard';
      ELSE
        v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'CHECK_VIOLATION';
      END IF;
    WHEN p_state = '23503' THEN
      v_bucket := 'integrity'; v_code := 'LEDGER_CURRENCY_NOT_FOUND'; v_reason := 'FK_VIOLATION';
    WHEN p_state = '23502' THEN
      -- NOT NULL：调用方漏必填字段（我方的必填字段一律显式给出 ⇒ 真出现时更可能是入参缺字段）
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'MISSING_REQUIRED_FIELD';
    WHEN p_state = '23P01' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'EXCLUSION_VIOLATION';

    -- ---------------------------------------------------------------- 数据异常 class 22（调用方可构造 ⇒ 400 类）
    WHEN p_state = '22003' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'NUMERIC_VALUE_OUT_OF_RANGE';
    WHEN p_state = '22P02' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'INVALID_TEXT_REPRESENTATION';
    WHEN p_state = '22001' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'STRING_DATA_TOO_LONG';
    WHEN p_state = '22007' OR p_state = '22008' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'INVALID_DATETIME';
    WHEN v_cls = '22' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'MALFORMED_INPUT_VALUE';
    WHEN v_cls = '21' THEN
      v_bucket := 'input'; v_code := 'LEDGER_AMOUNT_INVALID'; v_reason := 'CARDINALITY_VIOLATION';

    -- ---------------------------------------------------------------- 事务冲突 / 超时（503）
    WHEN p_state = '40001' THEN
      v_bucket := 'retryable'; v_code := 'LEDGER_DEADLOCK_RETRY_EXHAUSTED'; v_reason := 'serialization_failure';
    WHEN p_state = '40P01' THEN
      v_bucket := 'retryable'; v_code := 'LEDGER_DEADLOCK_RETRY_EXHAUSTED'; v_reason := 'deadlock_detected';
    WHEN p_state = '55P03' THEN
      v_bucket := 'retryable'; v_code := 'LEDGER_LOCK_TIMEOUT'; v_reason := 'lock_timeout';
    WHEN p_state = '57014' THEN
      v_bucket := 'retryable'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'statement_timeout_or_cancel';

    -- ---------------------------------------------------------------- 基础设施（503 可重试；与调用方入参错误分开）
    WHEN p_state = '53300' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'too_many_connections';
    WHEN p_state = '53200' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'out_of_memory';
    WHEN p_state = '53100' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'disk_full';
    WHEN p_state = '57P01' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'admin_shutdown';
    WHEN p_state = '57P02' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'crash_shutdown';
    WHEN p_state = '57P03' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'cannot_connect_now';
    WHEN p_state = '58030' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'io_error';
    -- 08P01 = 启动协议参数错误（我方连接配置缺陷，**不是**瞬时故障）⇒ 归实现缺陷（R108 告警）
    WHEN p_state = '08P01' THEN
      v_bucket := 'defect'; v_code := 'LEDGER_TRANSACTION_REQUIRED'; v_reason := 'protocol_violation';
    WHEN p_state = '25006' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'read_only_transaction';
    WHEN v_cls = '53' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'insufficient_resources';
    WHEN v_cls = '57' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'operator_intervention';
    WHEN v_cls = '58' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'system_error';
    WHEN v_cls = '08' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'connection_error';
    WHEN v_cls = 'XX' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'internal_error';
    WHEN p_state = '3D000' THEN
      v_bucket := 'infra'; v_code := 'LEDGER_TX_TIMEOUT'; v_reason := 'database_unavailable';

    -- ---------------------------------------------------------------- 其余 = 实现缺陷（500 类，R108 必须告警）
    ELSE
      v_bucket := 'defect'; v_code := 'LEDGER_TRANSACTION_REQUIRED'; v_reason := 'unclassified_db_error';
  END CASE;

  RETURN jsonb_build_object(
    'code',       v_code,
    'reason',     v_reason,
    'bucket',     v_bucket,
    'retryable',  v_bucket IN ('retryable', 'infra'),
    'pg_code',    COALESCE(p_state, 'none'),
    'constraint', p_constraint);
END $$;

COMMENT ON FUNCTION ledger_error_for_sqlstate(text, text) IS
  'P1f（F2/F3）:SQLSTATE → §14.1 已登记码 的唯一归类表（全定义域：任何输入都返回已登记码，永不 NULL）。'
  'bucket=input⇒400 类（调用方可触发）/ integrity⇒约束 / retryable⇒503 / infra⇒503 可重试 / defect⇒500。';


-- ============================================================================
-- §D F2 ③④：入参形态闸（严格字符串/布尔；金额真范围闸）
-- ============================================================================

/** 必填字符串字段（缺失 / null ⇒ MISSING；非字符串 ⇒ NOT_STRING） */
CREATE OR REPLACE FUNCTION ledger_strict_text(p_obj jsonb, p_key text, p_field text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_obj IS NULL OR NOT (p_obj ? p_key) OR p_obj->p_key = 'null'::jsonb THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object('field', p_field, 'reason', 'MISSING'));
  END IF;
  IF jsonb_typeof(p_obj->p_key) <> 'string' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field, 'reason', 'NOT_STRING', 'provided_type', jsonb_typeof(p_obj->p_key)));
  END IF;
  RETURN p_obj->>p_key;
END $$;

COMMENT ON FUNCTION ledger_strict_text(jsonb, text, text) IS
  'P1f（F2④）:身份字段（uid/cid/ref_id…）只接受 JSON string —— 不再静默接受 JSON number（R70 出参/入参一律文本）。';

/** 可选字符串字段（缺失 / null ⇒ NULL；非字符串 ⇒ NOT_STRING） */
CREATE OR REPLACE FUNCTION ledger_optional_text(p_obj jsonb, p_key text, p_field text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_obj IS NULL OR NOT (p_obj ? p_key) OR p_obj->p_key = 'null'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_obj->p_key) <> 'string' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field, 'reason', 'NOT_STRING', 'provided_type', jsonb_typeof(p_obj->p_key)));
  END IF;
  RETURN p_obj->>p_key;
END $$;

COMMENT ON FUNCTION ledger_optional_text(jsonb, text, text) IS
  'P1f（F2④）:可选文本字段（如 memo）只接受 JSON string/null；对象/数组/数字一律 NOT_STRING。';

/** 可选布尔字段（缺失 / null ⇒ NULL；JSON boolean 或 'true'/'false' 字符串；其余 ⇒ NOT_BOOLEAN） */
CREATE OR REPLACE FUNCTION ledger_optional_bool(p_obj jsonb, p_key text, p_field text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_t text;
BEGIN
  IF p_obj IS NULL OR NOT (p_obj ? p_key) OR p_obj->p_key = 'null'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_obj->p_key) = 'boolean' THEN RETURN (p_obj->>p_key)::boolean; END IF;
  IF jsonb_typeof(p_obj->p_key) = 'string' THEN
    v_t := lower(btrim(p_obj->>p_key));
    IF v_t IN ('true', 'false') THEN RETURN v_t = 'true'; END IF;
  END IF;
  PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
    'field', p_field, 'reason', 'NOT_BOOLEAN', 'provided_type', jsonb_typeof(p_obj->p_key),
    'value', left(COALESCE(p_obj->>p_key, 'null'), 20)));
END $$;

COMMENT ON FUNCTION ledger_optional_bool(jsonb, text, text) IS
  'P1f（F2④）:platform 只接受 JSON boolean（或 ''true''/''false''）—— 0004 的 (->>::boolean) 会把非法字面量炸成 22P02(500)。';

/** F2③：整数形态的金额 / 身份 —— 真范围闸（0004 只拦「> 19 位」，19 位但超 bigint max 会 ::bigint 炸出 22003） */
CREATE OR REPLACE FUNCTION ledger_int_amount(p_raw text, p_field text) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_s text; v_n numeric;
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
  -- 19 位以内仍可能超 bigint 上界（9223372036854775807）⇒ 先按 numeric 查界再转型
  v_n := v_s::numeric;
  IF v_n > 9223372036854775807::numeric OR v_n < (-9223372036854775808)::numeric THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', p_field, 'reason', 'OUT_OF_BIGINT_RANGE', 'value', left(v_s, 40)));
  END IF;
  RETURN v_n::bigint;
END $$;

COMMENT ON FUNCTION ledger_int_amount(text, text) IS
  'P1f（F2③）:整数形态金额/身份。长度闸 + **真 bigint 范围闸**（numeric 查界后再转型，杜绝 22003 逃逸）。';

/** R72 用户输入金额 → 最小单位（同 F2③：换算后用 numeric 查界，杜绝 `v_units_text::bigint` 溢出） */
CREATE OR REPLACE FUNCTION ledger_parse_user_amount(
  p_raw text, p_decimals int, p_field text, p_cid text
) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_s text; v_int text; v_frac text; v_units_text text; v_n numeric; v_out bigint;
BEGIN
  IF p_raw IS NULL THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object('field', p_field, 'reason', 'MISSING'));
  END IF;
  v_s := btrim(p_raw);
  -- TS：先判负号 ⇒ LEDGER_AMOUNT_NOT_POSITIVE（'^-'）；再做十进制字符串形态校验
  IF v_s LIKE '-%' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE', jsonb_build_object('field', p_field, 'value', v_s));
  END IF;
  -- P1i（新发现 M43）：十进制字符串闸**显式封死指数形式**。
  --   合法字母表只有 [0-9.]（下面的锚定白名单），故出现 e/E 即必为指数/非法记法 ⇒ 专属 reason。
  --   （0004/0005 的锚定白名单其实已拒 '1e5'，但那只在「未同时给 amount_units」时走到；
  --    §D2 新增的 both-present 闸一旦放行，指数形式就会从 amount 字段溜进来 ⇒ 此处显式归因。）
  IF v_s ~ '[eE]' THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field, 'reason', 'EXPONENT_NOT_ALLOWED', 'value', left(v_s, 40)));
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
  v_n := v_units_text::numeric;              -- F2③：先 numeric 查界，避免超 bigint 时炸 22003
  IF v_n > 9223372036854775807::numeric THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', p_field, 'reason', 'OUT_OF_BIGINT_RANGE', 'value', left(v_s, 40)));
  END IF;
  v_out := v_n::bigint;
  IF v_out <= 0 THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE', jsonb_build_object('field', p_field, 'value', v_out::text));
  END IF;
  IF v_out > ledger_max_single_amount() THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field, 'value', v_out::text, 'reason', 'OVER_MAX_SINGLE_AMOUNT'));
  END IF;
  RETURN v_out;
END $$;

COMMENT ON FUNCTION ledger_parse_user_amount(text, int, text, text) IS
  'P1f（F2③）:R72 用户输入金额换算；换算结果先按 numeric 查界（杜绝 19 位但超 bigint max 的 22003 逃逸）。'
  'P1i：显式拒绝指数形式（reason=EXPONENT_NOT_ALLOWED）。';


-- ============================================================================
-- §D2 P1i 新发现 M31 / M43：金额字段闸 —— 「两个金额字段同时出现」不再被静默忽略
-- ============================================================================
-- 根因（本轮实测，读数见 .p1f-artifacts/p1f02-before.txt）：0004 的 `ledger_payload_amount`
--   把 `amount_units` 放在**优先级首位**，命中即 RETURN —— `amount` 字段**一个字都不校验**。
--   于是调用方传 `{amount_units:'1', amount:'1000000000000001'}`（超 R66 单笔上限）或
--   `{amount_units:'1', amount:'1e5'}`（指数形式）时，两者都被**静默接受 200**。
-- 修法（消灭「被静默忽略的金额字段」这一整类）：
--   ① 两个字段**同时出现** ⇒ 400 `LEDGER_AMOUNT_INVALID` + reason=`AMBIGUOUS_AMOUNT`
--      （契约：`amount`（R72 用户十进制）/ `amount_units`（R66 最小单位）**二选一**；
--       TS 侧 `amountToPayload` 恒只发其中一个 ⇒ 对外 API 零破坏）；
--   ② 单给 `amount`        ⇒ ledger_parse_user_amount（锚定白名单 + 指数形式显式拒绝，见 §D）；
--   ③ 单给 `amount_units`  ⇒ ledger_int_amount + 真范围闸 + R71 单笔上限（逐格保留 0004 口径）；
--   ④ 缺失 / 非字符串      ⇒ 400（MISSING / NOT_STRING，逐格保留 0004 口径）。
CREATE OR REPLACE FUNCTION ledger_payload_amount(
  p_payload jsonb, p_decimals int, p_field text, p_cid text
) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_n bigint; v_has_units boolean; v_has_amount boolean;
BEGIN
  v_has_units  := (p_payload ? 'amount_units');
  v_has_amount := (p_payload ? 'amount');

  -- P1i（M31/M43）①：两个金额字段同时出现 ⇒ 请求歧义，**绝不**静默挑一个
  IF v_has_units AND v_has_amount THEN
    PERFORM ledger_raise('LEDGER_AMOUNT_INVALID', jsonb_build_object(
      'field', p_field, 'reason', 'AMBIGUOUS_AMOUNT', 'provided', 'amount,amount_units',
      'note', 'exactly one of amount (user decimal, R72) / amount_units (minimal unit, R66) is accepted'));
  END IF;

  IF v_has_units THEN
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

COMMENT ON FUNCTION ledger_payload_amount(jsonb, int, text, text) IS
  'P1i：payload 金额取值（amount_units 最小单位 / amount 用户十进制，**恰一个**）。'
  '两个同时出现 ⇒ 400 AMBIGUOUS_AMOUNT（禁止静默挑一个 —— 修前 M31/M43 漏闸的根因）。';


-- ============================================================================
-- §E F1/F2/F3：事件函数本体（CREATE OR REPLACE 覆盖 0004 的定义）
-- ============================================================================
-- 与 0004 的结构逐段对齐（C0 信封 / C1 超时 / C2 组装 / C3 配对 / C4 加锁 / C5 推演 /
-- C6 写入 / C7 重放 / C8 返回），**唯一的结构性变化**：0004 把 `BEGIN…EXCEPTION` 只包住
-- C6 写入段（导致 C0–C5 的裸 SQLSTATE 原样逃出、且 C6 内的自家 LD 码被 WHEN OTHERS
-- 二次改写），本版改为**整个函数体一个 EXCEPTION 处理器**，并对 `LD*` 做**原样透传**。
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
  '+ MESSAGE=§14.1 码名 + DETAIL=§14.4 details JSON 机读传出。';
