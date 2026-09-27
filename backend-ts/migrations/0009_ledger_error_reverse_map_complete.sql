-- ============================================================================
-- 0009 · 错误码**反向映射**补全（LD001..LD033 全量）+ 33 码往返闭合自检
-- ============================================================================
-- 权威口径：
--   · `docs/seafood.master-plan.md` §5.22「裁定」（2026-09-27）——
--     ① **必须修，两侧同改**：`0009` 迁移 `CREATE OR REPLACE` 反向映射函数补齐缺失码
--        （**不改 `0005` 文件**）+ TS `LEDGER_ERROR_TABLE` 同步；
--     ② **新增机读判据「33 码全量往返闭合测试」**：`ledger_error_for_sqlstate(ledger_sqlstate_of(name))`
--        必须回到同名，且 bucket 满足冻结的 `bucket↔状态类` 映射；
--        断言 `roundtrip_mismatches = 0 / unknown_codes = 0 / bucket_violations = 0`
--        （实现见 `scripts/p2c-00-code-roundtrip.ts`，同轮交付）；
--     ③ 诚实口径：P1 自证过的只是「正向映射有 33 条」，**从未自证反向映射也有 33 条** ⇒
--        凡双向映射（名↔码 / 状态码↔HTTP / 枚举↔字符串），**单向自证不算闭合**。
--   · `docs/ledger.spec.md` §14.1（33 码关闭集，R104/R105/R106）、§14.3 附（bucket 纪律冻结，S1）。
--
-- ---------------------------------------------------------------- 缺陷事实（修前真实读数）
--   探针：`ledger_error_for_sqlstate('LD031'|'LD032'|'LD033')`（Zang 亲核，§5.22）
--   修前 33 个自家码（`LD001..LD033`）**全部**落 ELSE 兜底：
--     `{code: LEDGER_TRANSACTION_REQUIRED, bucket: defect, reason: unclassified_db_error}`
--   —— 落桶侥幸没错（`defect ⇒ 500` 类），但**码名与 reason 全被错配**：调用方看到「事务必需 /
--   无法归类」，而实际分别是「对账不符」（LD032）等。逆向表**一条 LD* 分支都没有**（不是「缺最后三码」
--   那么轻）—— 只是最后三码在今天之前**从未被真正抛过**，所以缺口直到 `0007` 的佣金守恒断言上线才暴露。
--   基线读数（同一份终版脚本产出）：`.p2c-artifacts/p2c-00-roundtrip-before-MUJNM9EO.json`
--     `roundtrip_mismatches = 32`（唯一「对上」的 `LD024` 是撞名，非真闭合）/ `unknown_codes = 0` /
--     `bucket_violations = 54` / `null_status_defect = 27` / `stale_unclassified_reason = 33`。
--
-- ---------------------------------------------------------------- 本迁移做什么（**只替换一个函数**）
--   ① `CREATE OR REPLACE FUNCTION ledger_error_for_sqlstate(text, text)`
--      —— 函数体 = `0005` 版**逐字保留**（原生 SQLSTATE 的每一格映射、`23514` 按约束名分桶、
--         infra/retryable 分类、ELSE 兜底 **一字未改**），**只新增一段 `LD001..LD033` 分支**
--         （正向 `ledger_sqlstate_of` 的逆：码名 / bucket / reason 逐条按真实语义给出）。
--         **闭集仍 33，不新增任何错误码**（R104/§14.1）。
--   ② `COMMENT ON FUNCTION` 同步改写（说明 LD 分支与扩展档位）。
--   ③ 末尾 `DO` 自检：迁移**应用时**即断言 33 码往返闭合 + 原生 SQLSTATE 映射未被扰动，
--      不通过则**整个迁移回滚**（不写版本行）。
--
-- ---------------------------------------------------------------- bucket 取值（冻结映射 + 最小扩展）
--   冻结（`0005` §C 抬头 / ledger.spec §14.3 附 S1，**一字未改**）：
--     `input ⇒ 400 类` / `integrity ⇒ 400|404|409（绝不 500）` / `retryable ⇒ 503` /
--     `infra ⇒ 503` / `defect ⇒ 500` ⇒ 判据「500 类码只可能来自 bucket='defect'」。
--   §14.1 的状态集含 `403`（LD014/LD015）、`423`（LD009）、`200`（LD006，R106 明定**不是错误**）——
--   **冻结的四条一个都没覆盖这三个状态类** ⇒ 任何分桶都必然「超出冻结面」。本迁移取**最小扩展**并留痕：
--     · `403 ⇒ input`     （权限不足 = 调用方身份不对；非完整性、非状态冲突）
--     · `423 ⇒ integrity` （资源被锁定 = 合规冻结；R105 把「币种状态」归 409 语义族）
--     · `200 ⇒ input`     （幂等重放 = 调用方重复提交；R106 保证它**不进错误分支**）
--     · `null ⇒ defect`   （LD032 账实不符 = 实现缺陷，R108 必告警；**HTTP 层 `status ?? 500`**）
--   ⇒ 覆盖内的码走**严格冻结公式**，覆盖外的码走扩展档位，两者都由往返脚本逐条对拍、都进 `bucket_violations`。
--
-- ---------------------------------------------------------------- 幂等 / 边界
--   · `CREATE OR REPLACE` ⇒ 可重跑（`migrate.ts` 重跑报 `skipped` + checksum 一致）。
--   · **不改** `0001`–`0008` 任何文件；不删/改 `schema_migration` 既有行；不动表/数据/触发器。
--   · 非法 / 域外输入（`LD000` / `LD034` / 小写 / 带空格）**一律仍落 ELSE 兜底**
--     （`defect` / `LEDGER_TRANSACTION_REQUIRED` / `unclassified_db_error`）—— 分支用严格正则锚定。
-- ============================================================================


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
  -- ---------------------------------------------------------------------- ① 自家命名码（LD001..LD033）
  -- 依据（`0009` 本迁移的权威口径 = `docs/seafood.master-plan.md` §5.22 裁定 1/2）：
  --   正向 `ledger_sqlstate_of`（0004 §A）的**逆** —— 上表 33 条与正向表一一对应，**不新增码**。
  --   修前（0005 版）本函数**没有** LD* 分支 ⇒ 全部 33 个自家码落 ELSE 兜底
  --   （`defect` / `LEDGER_TRANSACTION_REQUIRED` / `unclassified_db_error`）：落桶侥幸对（500 类），
  --   但**码名与 reason 全被错配**（调用方看到「事务必需 / 无法归类」，实际是「对账不符」等）。
  --   `0007` 的佣金守恒断言是人类**第一次真正抛 `LD032`**，缺口才暴露（P1 只自证过正向 33 条）。
  --
  --   bucket 取值规则（**真源 = §14.1 状态 + 冻结的 `bucket↔状态类` 映射**，逐条可复核）：
  --     `400 ⇒ input` / `404|409 ⇒ integrity` / `500 ⇒ defect` / `503 ⇒ retryable`；
  --     冻结映射**未覆盖**的状态类取**最小扩展**（逐条留痕，供追认）：
  --       `403 ⇒ input`（权限不足 = 调用方身份不对）· `423 ⇒ integrity`（资源被锁定 = 合规冻结，
  --       R105 把「币种状态」归 409 语义族）· `200 ⇒ input`（R106：`LEDGER_IDEMPOTENCY_REPLAY`
  --       **不是错误**，只是调用方重复提交）· `null ⇒ defect`（`LEDGER_RECONCILE_MISMATCH` 是
  --       账实不符 = 实现缺陷；**HTTP 响应层以 `status ?? 500` 兜底**，见 `src/ledger-errors.ts`）。
  --   `reason` 逐码不同（可机读定位），**不再是兜底的 `unclassified_db_error`**。
  IF p_state ~ '^LD0(0[1-9]|[12][0-9]|3[0-3])$' THEN
    CASE p_state
      WHEN 'LD001' THEN v_bucket := 'integrity';  v_code := 'LEDGER_INSUFFICIENT_BALANCE';        v_reason := 'insufficient_balance';
      WHEN 'LD002' THEN v_bucket := 'integrity';  v_code := 'LEDGER_INSUFFICIENT_FROZEN';         v_reason := 'insufficient_frozen';
      WHEN 'LD003' THEN v_bucket := 'integrity';  v_code := 'LEDGER_IDEMPOTENCY_CONFLICT';        v_reason := 'idempotency_conflict';
      WHEN 'LD004' THEN v_bucket := 'input';      v_code := 'LEDGER_IDEMPOTENCY_KEY_REQUIRED';    v_reason := 'idempotency_key_required';
      WHEN 'LD005' THEN v_bucket := 'input';      v_code := 'LEDGER_IDEMPOTENCY_KEY_INVALID';     v_reason := 'idempotency_key_invalid';
      WHEN 'LD006' THEN v_bucket := 'input';      v_code := 'LEDGER_IDEMPOTENCY_REPLAY';          v_reason := 'idempotency_replay';
      WHEN 'LD007' THEN v_bucket := 'integrity';  v_code := 'LEDGER_CURRENCY_NOT_FOUND';          v_reason := 'currency_not_found';
      WHEN 'LD008' THEN v_bucket := 'integrity';  v_code := 'LEDGER_CURRENCY_NOT_LISTED';         v_reason := 'currency_not_listed';
      WHEN 'LD009' THEN v_bucket := 'integrity';  v_code := 'LEDGER_CURRENCY_FROZEN';             v_reason := 'currency_frozen';
      WHEN 'LD010' THEN v_bucket := 'integrity';  v_code := 'LEDGER_CURRENCY_DELISTED';           v_reason := 'currency_delisted';
      WHEN 'LD011' THEN v_bucket := 'integrity';  v_code := 'LEDGER_CURRENCY_INVALID_TRANSITION';  v_reason := 'currency_invalid_transition';
      WHEN 'LD012' THEN v_bucket := 'input';      v_code := 'LEDGER_CURRENCY_MISMATCH';           v_reason := 'currency_mismatch';
      WHEN 'LD013' THEN v_bucket := 'integrity';  v_code := 'LEDGER_SUPPLY_CAP_EXCEEDED';         v_reason := 'supply_cap_exceeded';
      WHEN 'LD014' THEN v_bucket := 'input';      v_code := 'LEDGER_UNAUTHORIZED_MINT';           v_reason := 'unauthorized_mint';
      WHEN 'LD015' THEN v_bucket := 'input';      v_code := 'LEDGER_HOLD_NOT_ALLOWED';            v_reason := 'hold_not_allowed';
      WHEN 'LD016' THEN v_bucket := 'input';      v_code := 'LEDGER_AMOUNT_INVALID';              v_reason := 'amount_invalid';
      WHEN 'LD017' THEN v_bucket := 'input';      v_code := 'LEDGER_AMOUNT_NOT_POSITIVE';         v_reason := 'amount_not_positive';
      WHEN 'LD018' THEN v_bucket := 'input';      v_code := 'LEDGER_DECIMALS_OVERFLOW';           v_reason := 'decimals_overflow';
      WHEN 'LD019' THEN v_bucket := 'input';      v_code := 'LEDGER_SELF_TRANSFER';               v_reason := 'self_transfer';
      WHEN 'LD020' THEN v_bucket := 'integrity';  v_code := 'LEDGER_ACCOUNT_NOT_FOUND';           v_reason := 'account_not_found';
      WHEN 'LD021' THEN v_bucket := 'input';      v_code := 'LEDGER_RESERVED_UID';                v_reason := 'reserved_uid';
      WHEN 'LD022' THEN v_bucket := 'integrity';  v_code := 'LEDGER_REF_NOT_FOUND';               v_reason := 'ref_not_found';
      WHEN 'LD023' THEN v_bucket := 'input';      v_code := 'LEDGER_UNKNOWN_KIND';                v_reason := 'unknown_kind';
      WHEN 'LD024' THEN v_bucket := 'defect';     v_code := 'LEDGER_TRANSACTION_REQUIRED';        v_reason := 'transaction_required';
      WHEN 'LD025' THEN v_bucket := 'retryable';  v_code := 'LEDGER_LOCK_TIMEOUT';                v_reason := 'lock_timeout';
      WHEN 'LD026' THEN v_bucket := 'retryable';  v_code := 'LEDGER_TX_TIMEOUT';                  v_reason := 'tx_timeout';
      WHEN 'LD027' THEN v_bucket := 'retryable';  v_code := 'LEDGER_DEADLOCK_RETRY_EXHAUSTED';    v_reason := 'deadlock_retry_exhausted';
      WHEN 'LD028' THEN v_bucket := 'defect';     v_code := 'LEDGER_NEGATIVE_BALANCE_GUARD';      v_reason := 'negative_balance_guard';
      WHEN 'LD029' THEN v_bucket := 'defect';     v_code := 'LEDGER_APPEND_ONLY_VIOLATION';       v_reason := 'append_only_violation';
      WHEN 'LD030' THEN v_bucket := 'defect';     v_code := 'LEDGER_ACCOUNT_GUARD_VIOLATION';     v_reason := 'account_guard_violation';
      WHEN 'LD031' THEN v_bucket := 'defect';     v_code := 'LEDGER_FEE_RATE_INVALID';            v_reason := 'fee_rate_invalid';
      WHEN 'LD032' THEN v_bucket := 'defect';     v_code := 'LEDGER_RECONCILE_MISMATCH';          v_reason := 'reconcile_mismatch';
      WHEN 'LD033' THEN v_bucket := 'integrity';  v_code := 'LEDGER_CURRENCY_SYMBOL_TAKEN';       v_reason := 'currency_symbol_taken';
    END CASE;
    RETURN jsonb_build_object(
      'code',       v_code,
      'reason',     v_reason,
      'bucket',     v_bucket,
      'retryable',  v_bucket IN ('retryable', 'infra'),
      'pg_code',    p_state,
      'constraint', p_constraint);
  END IF;

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
  'P1f（F2/F3）+ 0009：SQLSTATE → §14.1 已登记码 的唯一归类表（全定义域：任何输入都返回已登记码，永不 NULL）。'
  'bucket=input⇒400 类（调用方可触发）/ integrity⇒400|404|409 / retryable⇒503 / infra⇒503 可重试 / defect⇒500。'
  '0009 新增 LD001..LD033 分支：自家命名码（0004 ledger_sqlstate_of 的逆）**原样回码名**并给逐码 reason；'
  'bucket 由 §14.1 状态 + 冻结映射派生，冻结未覆盖的状态类取最小扩展'
  '（403⇒input / 423⇒integrity / 200⇒input / null⇒defect，见 0009 文件头）。';


-- ============================================================================
-- 自检（迁移应用时即断言；任一不通过 ⇒ RAISE ⇒ 整文件回滚，不写版本行）
--   A. 33 码往返闭合：`ledger_sqlstate_of(ledger_error_for_sqlstate(st)->>'code') = st`（正向的逆）
--   B. bucket 落在五值闭集；`retryable` 与 bucket 自洽
--   C. 原生 SQLSTATE 侧映射**未被扰动**（逐格保留 0005 的口径）
-- ============================================================================
DO $$
DECLARE
  v_states text[] := ARRAY[
    'LD001','LD002','LD003','LD004','LD005','LD006','LD007','LD008','LD009','LD010','LD011','LD012',
    'LD013','LD014','LD015','LD016','LD017','LD018','LD019','LD020','LD021','LD022','LD023','LD024',
    'LD025','LD026','LD027','LD028','LD029','LD030','LD031','LD032','LD033'];
  v_s text;
  v_j jsonb;
  v_n int := 0;
  v_bad text[] := ARRAY[]::text[];
BEGIN
  FOREACH v_s IN ARRAY v_states LOOP
    v_j := ledger_error_for_sqlstate(v_s);
    v_n := v_n + 1;
    IF v_j->>'code' IS NULL OR ledger_sqlstate_of(v_j->>'code') IS DISTINCT FROM v_s THEN
      v_bad := v_bad || (v_s || '→' || COALESCE(v_j->>'code', 'NULL') || '（往返未闭合）');
    END IF;
    IF COALESCE(v_j->>'reason', '') IN ('', 'unclassified_db_error') THEN
      v_bad := v_bad || (v_s || ' reason=' || COALESCE(v_j->>'reason', 'NULL') || '（兜底漏配）');
    END IF;
    IF v_j->>'bucket' NOT IN ('input', 'integrity', 'retryable', 'infra', 'defect') THEN
      v_bad := v_bad || (v_s || ' bucket=' || COALESCE(v_j->>'bucket', 'NULL') || '（不在闭集）');
    END IF;
    IF (v_j->>'retryable')::boolean IS DISTINCT FROM (v_j->>'bucket' IN ('retryable', 'infra')) THEN
      v_bad := v_bad || (v_s || '（retryable 与 bucket 不自洽）');
    END IF;
  END LOOP;
  IF v_n <> 33 THEN v_bad := v_bad || ('LD 码域抽样数 = ' || v_n || '（应为 33）'); END IF;

  -- C. 原生 SQLSTATE 侧逐格保留（0005 §C 的原口径；改了就是回归）
  IF COALESCE(ledger_error_for_sqlstate('23514', 'account_bal_guard')->>'code', '') <> 'LEDGER_NEGATIVE_BALANCE_GUARD'
     OR COALESCE(ledger_error_for_sqlstate('23514', 'account_frz_guard')->>'code', '') <> 'LEDGER_NEGATIVE_BALANCE_GUARD'
     OR COALESCE(ledger_error_for_sqlstate('23514', 'ledger_after_guard')->>'code', '') <> 'LEDGER_NEGATIVE_BALANCE_GUARD'
     OR COALESCE(ledger_error_for_sqlstate('23514', 'currency_supply_guard')->>'code', '') <> 'LEDGER_SUPPLY_CAP_EXCEEDED'
     OR COALESCE(ledger_error_for_sqlstate('23514', 'ledger_kind_enum')->>'code', '') <> 'LEDGER_UNKNOWN_KIND'
     OR COALESCE(ledger_error_for_sqlstate('23514')->>'code', '') <> 'LEDGER_AMOUNT_INVALID'
     OR COALESCE(ledger_error_for_sqlstate('23514')->>'bucket', '') <> 'input'
     OR COALESCE(ledger_error_for_sqlstate('23505')->>'code', '') <> 'LEDGER_IDEMPOTENCY_CONFLICT'
     OR COALESCE(ledger_error_for_sqlstate('23503')->>'code', '') <> 'LEDGER_CURRENCY_NOT_FOUND'
     OR COALESCE(ledger_error_for_sqlstate('40001')->>'bucket', '') <> 'retryable'
     OR COALESCE(ledger_error_for_sqlstate('40P01')->>'code', '') <> 'LEDGER_DEADLOCK_RETRY_EXHAUSTED'
     OR COALESCE(ledger_error_for_sqlstate('55P03')->>'code', '') <> 'LEDGER_LOCK_TIMEOUT'
     OR COALESCE(ledger_error_for_sqlstate('57014')->>'code', '') <> 'LEDGER_TX_TIMEOUT'
     OR COALESCE(ledger_error_for_sqlstate('53300')->>'bucket', '') <> 'infra'
     OR COALESCE(ledger_error_for_sqlstate('XX000')->>'code', '') <> 'LEDGER_TX_TIMEOUT'
     OR COALESCE(ledger_error_for_sqlstate('08P01')->>'bucket', '') <> 'defect'
     OR COALESCE(ledger_error_for_sqlstate('25006')->>'bucket', '') <> 'infra'
     OR COALESCE(ledger_error_for_sqlstate('3D000')->>'bucket', '') <> 'infra'
     OR COALESCE(ledger_error_for_sqlstate('22003')->>'bucket', '') <> 'input'
     OR COALESCE(ledger_error_for_sqlstate('23502')->>'bucket', '') <> 'input'
     OR COALESCE(ledger_error_for_sqlstate('23P01')->>'bucket', '') <> 'input'
     OR COALESCE(ledger_error_for_sqlstate('P0001')->>'code', '') <> 'LEDGER_TRANSACTION_REQUIRED'
     OR COALESCE(ledger_error_for_sqlstate('42P01')->>'bucket', '') <> 'defect'
     OR COALESCE(ledger_error_for_sqlstate(NULL)->>'bucket', '') <> 'defect' THEN
    v_bad := v_bad || '原生 SQLSTATE 侧映射被扰动（0005 §C 原口径已变）';
  END IF;

  -- D. 域外 / 畸形输入必须仍落 ELSE 兜底（严格正则锚定，不得被 LD 分支吞掉）
  IF ledger_error_for_sqlstate('LD000')->>'bucket' <> 'defect'
     OR ledger_error_for_sqlstate('LD034')->>'bucket' <> 'defect'
     OR ledger_error_for_sqlstate('LD999')->>'bucket' <> 'defect'
     OR ledger_error_for_sqlstate('ld032')->>'bucket' <> 'defect'
     OR ledger_error_for_sqlstate('LD032 ')->>'bucket' <> 'defect'
     OR ledger_error_for_sqlstate('LD032')->>'code' <> 'LEDGER_RECONCILE_MISMATCH' THEN
    v_bad := v_bad || '域外/畸形 LD 输入的兜底行为异常（0009 分支锚定不严）';
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL AND array_length(v_bad, 1) > 0 THEN
    RAISE EXCEPTION '0009 self-check failed: %', array_to_string(v_bad, ' | ');
  END IF;
END $$;
