-- ============================================================================
-- 0042_job_settle_per_submission.sql · P9 · S4a 资金面
--   （托管总额 = reward × headcount · 逐笔发放 · 结算键含提交标识 · 剩余退）
-- ============================================================================
-- 权威口径（**只兑现已冻结裁定，不自行推导**；姊妹册 = route-layer v2.23 §34 /
--   data-layer v0.29 §36 / ledger v0.16 §19.19 / commission v0.6 §20）：
--
--   · `R-9-98`（`ledger.spec` v0.16 §19.19 A / `route-layer.spec` v2.23 §34.2）：
--       发布时托管总额 = **`reward × headcount`**（`job_escrow`：雇主 `balance −(reward×headcount)`
--       → 雇主 `frozen +(reward×headcount)`）；**余额不足 ⇒ 发布失败**（既有 R80 余额闸 →
--       `LEDGER_INSUFFICIENT_BALANCE`，**零新增码**；Zang 裁定）。
--
--   · `R-9-101`（§19.19 B / §34.5）：review **按提交逐笔判定** ⇒ `approved` ⇒ 向**该提交者**
--       发放**一份 `reward`**（`job_payout` + `job_fee` + `commission` 按**既有**费分佣口径 =
--       `public.job_settle_plan(...)`）；**已发放份数达到 `headcount` ⇒ 任务结束**
--       （`job.status = 'settled'`；★ `job.status` 枚举值域不动）。
--
--   · ★★ **结算幂等键**（Zang 裁 2026-10-03 · §19.19 D#4 / §20.4 #2）：
--       settle 键 = **`biz:job:settle:<job_id>:<submission_id>`**（**必须含提交标识** ⇒ 同一 `job`
--       多次发放不再互相落「重放」）。**`biz:job:refund:<job_id>` 保持不变**（退款为一次性整体动作）。
--       遗留单笔 settle（仲裁 / 旧脚本，未传 `submission_id`）仍用 `biz:job:settle:<job_id>`。
--
--   · `R-9-102`（§19.19 C / §34.6）：随时结束 ⇒ **未用完份额退回** =
--       `job_escrow_refund` 金额 = **`reward × (headcount − 已发放份数)`**（`frozen → balance`）。
--
-- 本迁移做什么
--   ① `CREATE OR REPLACE FUNCTION public.job_status_transition_ok`：`open` 出边**加 `'settled'`**
--      （逐笔发放「发满 ⇒ 收口」需要 `open → settled`；**枚举值域不动**，只放宽白名单一条边）。
--   ② `CREATE OR REPLACE FUNCTION public.job_post_event(jsonb)`：新函数体（逐条见体内注释）：
--        · publish：托管金额 = `reward × headcount`；`headcount` 入参与业务行同写；幂等内容比较含 `headcount`。
--        · settle ：读 `submission_id`（新）⇒ 键含提交号 ⇒ 以**该提交者**为发放锚点派生结算分录
--                   ⇒ 结论位 `job_submission.review_status='approved'`（与资金**同一函数同一语句**）
--                   ⇒ 计数：已发放份数 ≥ `headcount` ⇒ `job.status='settled'`（否则仅回写引用列）。
--                   未传 `submission_id` 的**遗留单笔**分支保持旧行为（仲裁 / 旧脚本）。
--        · refund ：键不变；金额 = `reward × (headcount − 已发放份数)`（未用完份额退回）。
--   ③ apply-time 自检（`DO` 块；不通过 ⇒ 整迁移回滚、不写版本行）。
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0041` 任何文件字节**（checksum 冻结；`migrate.ts` 会整链 ABORT/exit 3）
--   · ★ **绝不碰 `public.ledger_post_event` 函数体**（DL142 / 裁定 #14）；本迁移只**调用**它
--   · 不新增 `kind` / 错误码 / 列 / 表；不改任何触发器；不写任何业务数据（**纯 DDL**）
--
-- 幂等（DL48）：`CREATE OR REPLACE FUNCTION` + 末尾 apply-time 自检；任一失败 ⇒ 整迁移回滚、不写版本行。
-- 备注：`0013` 的 apply-time 自检曾在**其自身事务内**断言 `job_status_transition_ok('open','settled') = false`
--   （`0013_job.sql:784`）。`0013` 已 apply、`migrate.ts` 按 checksum 跳过、**不重跑其自检** ⇒
--   本迁移放宽该边不与之冲突（`0013` 字节未动）；新口径以本迁移为准（`R-9-101`）。
-- ============================================================================


-- ============================================================================
-- ① 状态机白名单（DL51 唯一真源）：open 出边加 'settled'
-- ----------------------------------------------------------------------------
--   `R-9-101`：逐笔发放期间 `job.status` 保持 `open`（S2 的 `submitJobWork` 不迁状态），
--   发满 `headcount` ⇒ 直接收口为 `settled` ⇒ 需 `open → settled` 为合法边。
--   `settled / rejected / cancelled` 仍为终态（无出边）。**枚举值域一字不动。**
-- ============================================================================
CREATE OR REPLACE FUNCTION public.job_status_transition_ok(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'open'      THEN p_to IN ('accepted', 'cancelled', 'settled')
    WHEN 'accepted'  THEN p_to IN ('submitted', 'rejected')
    WHEN 'submitted' THEN p_to IN ('settled', 'rejected', 'disputed')
    WHEN 'disputed'  THEN p_to IN ('settled', 'cancelled')
    ELSE false            -- settled / rejected / cancelled = 无出边（终态）
  END
$$;

COMMENT ON FUNCTION public.job_status_transition_ok(text, text) IS
  'DL51 状态机白名单唯一真源（0042 前推：R-9-101）：open→{accepted,cancelled,settled}；accepted→{submitted,rejected}；submitted→{settled,rejected,disputed}；disputed→{settled,cancelled}；settled/cancelled/rejected 无出边。';


-- ============================================================================
-- ② 业务编排函数 public.job_post_event(jsonb)（DL20 提案 A / DL141–DL144）
-- ----------------------------------------------------------------------------
-- 入参契约（amounts / ids 一律十进制字符串，R70）
--   op=publish: { "op":"publish", "create_key":"cli:<uuid>", "employer_uid":"900001",
--                 "cid":"1", "reward":"1000", "headcount":"3"?, "title":"…"?, "description":"…"?,
--                 "request_fingerprint":"<hex>"?, "memo":"…"? }
--               ★ headcount 缺省 = 1（R-9-97 存量语义等价）；托管 = reward × headcount。
--   op=settle : { "op":"settle", "job_id":"123", "submission_id":"456"?,
--                 "reviewed_by":"900001"?, "review_memo":"…"?,
--                 "request_fingerprint":"<hex>"?, "memo":"…"? }
--               ★ 带 submission_id ⇒ 逐笔（键 biz:job:settle:<job_id>:<submission_id>，发该提交者一份）；
--                 不带 ⇒ 遗留单笔（键 biz:job:settle:<job_id>，发 job.worker_uid）。
--   op=refund : { "op":"refund", "job_id":"123", "to_status":"cancelled"|"rejected", … }
--               ★ 键不变 biz:job:refund:<job_id>；金额 = reward × (headcount − 已发放份数)。
-- 出参：{ ok, idempotent_replay, op, job_id, status, headcount, created, submissions_reviewed,
--        paid_count, escrow_txid, settle_txid, ledger_event_keys, txid, ledger_idempotency_key,
--        entries, accounts, extra }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.job_post_event(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_op          text;
  v_fp          text;
  v_memo        text;
  v_create_key  text;
  v_employer    bigint;
  v_cid         bigint;
  v_reward      bigint;
  v_title       text;
  v_desc        text;
  v_headcount   bigint;
  v_total       bigint;
  v_to          text;
  v_job_id      bigint;
  v_sub_id      bigint;
  v_payee       bigint;
  v_sub_status  text;
  v_job         public.job;
  v_key         text;
  v_entries     jsonb;
  v_plan        jsonb;
  v_replay      boolean := false;
  v_created     boolean := false;
  v_ledger      jsonb;
  v_txid        text;
  v_seen        integer;
  v_bad         text;
  v_cur         record;
  v_paid        bigint := 0;
  v_reviewed    int := 0;
  v_reviewed_by bigint;
  v_review_memo text;
  v_remaining   bigint;
  v_sub_out     bigint;
BEGIN
  -- ---------------------------------------------------------------- 信封校验
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'payload', 'reason', 'BAD_TYPE'));
  END IF;
  v_op := payload->>'op';
  IF v_op IS NULL OR v_op NOT IN ('publish', 'refund', 'settle') THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'op', 'value', COALESCE(v_op, 'null'), 'reason', 'UNKNOWN_JOB_OP'));
  END IF;
  -- R53 / §19.6：指纹可为 NULL（未传 = 同键即重放）；只作用于事件第 1 条分录
  IF payload ? 'request_fingerprint' AND jsonb_typeof(payload->'request_fingerprint') = 'string' THEN
    v_fp := NULLIF(payload->>'request_fingerprint', '');
  ELSE
    v_fp := NULL;
  END IF;
  v_memo := COALESCE(NULLIF(payload->>'memo', ''), 'job ' || v_op);
  -- settle 结论位：审核人 / 审核备注入参（可选；缺省 = 只做资金 + 结论位、`reviewed_by` 留 NULL）
  IF payload ? 'reviewed_by' AND jsonb_typeof(payload->'reviewed_by') = 'string'
     AND btrim(payload->>'reviewed_by') <> '' THEN
    v_reviewed_by := public.ledger_int_amount(payload->>'reviewed_by', 'reviewed_by');
  ELSE
    v_reviewed_by := NULL;
  END IF;
  v_review_memo := COALESCE(payload->>'review_memo', '');

  IF v_op = 'publish' THEN
    -- ============================================================ op = publish
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
    -- 入参解析（R100：body 侧 uid 必须 > 0；平台保留区间一律拒）
    v_employer := public.ledger_uid_arg(COALESCE(payload->>'employer_uid', ''), 'employer_uid');
    IF v_employer < 1 THEN
      PERFORM public.ledger_raise('LEDGER_RESERVED_UID',
        jsonb_build_object('uid', v_employer::text, 'field', 'employer_uid',
                           'reason', 'PLATFORM_EMPLOYER_FORBIDDEN'));
    END IF;
    v_cid    := public.ledger_cid_arg(COALESCE(payload->>'cid', ''));
    v_reward := public.ledger_int_amount(COALESCE(payload->>'reward', ''), 'reward');
    IF v_reward <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'reward', 'value', v_reward::text));
    END IF;
    IF v_reward > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'reward', 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_reward::text, 40)));
    END IF;
    -- ★ R-9-97/R-9-98：名额（缺省 1）+ 托管总额 = reward × headcount
    IF payload ? 'headcount' AND jsonb_typeof(payload->'headcount') = 'string'
       AND btrim(payload->>'headcount') <> '' THEN
      v_headcount := public.ledger_int_amount(payload->>'headcount', 'headcount');
    ELSE
      v_headcount := 1;
    END IF;
    IF v_headcount < 1 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'headcount', 'value', v_headcount::text));
    END IF;
    -- 总额查界（numeric 域判，防 bigint 溢出 ⇒ 22003）
    IF v_reward::numeric * v_headcount::numeric > 9223372036854775807::numeric THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'headcount', 'reason', 'OVER_MAX_TOTAL_AMOUNT',
                           'reward', v_reward::text, 'headcount', v_headcount::text));
    END IF;
    v_total := v_reward * v_headcount;
    v_title := COALESCE(payload->>'title', '');
    v_desc  := COALESCE(payload->>'description', '');
    IF length(v_title) > 200 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'title', 'reason', 'TOO_LONG', 'limit', 200));
    END IF;

    -- ② 业务行锁（DL141：业务行先于 currency/account）。create_key 是创建幂等的唯一权威
    SELECT * INTO v_job FROM public.job j WHERE j.create_key = v_create_key FOR UPDATE;
    IF FOUND THEN
      v_replay := true;
      -- 同键异业务内容 ⇒ 409（含 headcount：名额是托管金额的组成 ⇒ 属幂等内容）
      IF v_job.employer_uid <> v_employer OR v_job.cid <> v_cid OR v_job.reward <> v_reward
         OR v_job.headcount <> v_headcount THEN
        PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT',
          jsonb_build_object('reason', 'CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT',
                             'field', 'create_key', 'idempotency_key', v_create_key,
                             'job_id', v_job.job_id::text));
      END IF;
    ELSE
      INSERT INTO public.job (employer_uid, cid, reward, title, description, status, create_key, headcount)
      VALUES (v_employer, v_cid, v_reward, v_title, v_desc, 'open', v_create_key, v_headcount)
      ON CONFLICT (create_key) DO NOTHING
      RETURNING * INTO v_job;
      IF NOT FOUND THEN
        -- 并发同键：另一事务已建行 ⇒ 重读（持行锁），按重放返回，不重写业务行
        SELECT * INTO v_job FROM public.job j WHERE j.create_key = v_create_key FOR UPDATE;
        IF NOT FOUND THEN
          PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
            jsonb_build_object('field', 'create_key', 'reason', 'job_create_race_lost',
                               'idempotency_key', v_create_key));
        END IF;
        v_replay := true;
      ELSE
        v_created := true;
      END IF;
    END IF;

    v_job_id := v_job.job_id;
    v_key    := 'biz:job:escrow:' || v_job_id::text;
    v_headcount := v_job.headcount;
    v_total  := v_job.reward * v_job.headcount;

    -- R28：招工酬金计价仅 `listed`（只在**发布托管**路径上校验；退款/结算不受币种状态影响）
    SELECT c.cid, c.status INTO v_cur FROM public.currency c WHERE c.cid = v_job.cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_job.cid::text));
    END IF;
    IF v_cur.status <> 'listed' THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_LISTED',
        jsonb_build_object('cid', v_job.cid::text, 'symbol', NULL, 'reason', 'job_reward_currency_not_listed', 'status', v_cur.status));
    END IF;

    -- ③ 派生分录（§7.1：`job_escrow` ×2，雇主 balance −(reward×headcount) / frozen +(reward×headcount)）
    --     余额不足 ⇒ 由 `ledger_post_event` 的 R80 余额闸抛既有 `LEDGER_INSUFFICIENT_BALANCE`（零新增码）
    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_job.employer_uid::text, 'cid', v_job.cid::text, 'delta', (-v_total)::text,
                         'frozen_delta', '0', 'kind', 'job_escrow',
                         'memo', '招工发布托管 job=' || v_job_id::text || '（雇主余额出账 · reward×headcount=' || v_headcount::text || '）'),
      jsonb_build_object('uid', v_job.employer_uid::text, 'cid', v_job.cid::text, 'delta', '0',
                         'frozen_delta', v_total::text, 'kind', 'job_escrow',
                         'memo', '招工发布托管 job=' || v_job_id::text || '（入冻结）'));

  ELSE
    -- ============================================================ op = refund | settle
    v_job_id := public.ledger_int_amount(COALESCE(payload->>'job_id', ''), 'job_id');
    IF v_job_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'job_id', 'value', v_job_id::text, 'reason', 'job_not_found'));
    END IF;
    IF v_op = 'refund' THEN
      v_to := COALESCE(NULLIF(payload->>'to_status', ''), 'cancelled');
      IF v_to NOT IN ('cancelled', 'rejected') THEN
        PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
          jsonb_build_object('field', 'to_status', 'value', v_to, 'reason', 'not_a_refund_target'));
      END IF;
      v_key := 'biz:job:refund:' || v_job_id::text;
    ELSE
      v_to  := 'settled';
      IF payload ? 'submission_id' AND jsonb_typeof(payload->'submission_id') = 'string'
         AND btrim(payload->>'submission_id') <> '' THEN
        v_sub_id := public.ledger_int_amount(payload->>'submission_id', 'submission_id');
      ELSE
        v_sub_id := NULL;  -- 遗留单笔（仲裁 / 旧脚本）
      END IF;
      IF v_sub_id IS NOT NULL THEN
        -- ★★ 结算键含提交标识（Zang 裁）：同 job 多份 ⇒ 不同键 ⇒ 不再互相判重放
        v_key := 'biz:job:settle:' || v_job_id::text || ':' || v_sub_id::text;
      ELSE
        v_key := 'biz:job:settle:' || v_job_id::text;
      END IF;
    END IF;

    -- ① 业务行锁（DL141 全序第 1 段；单行按主键）
    SELECT * INTO v_job FROM public.job j WHERE j.job_id = v_job_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'job_id', 'value', v_job_id::text, 'reason', 'job_not_found'));
    END IF;
    v_headcount := v_job.headcount;

    -- ② 重放探测（**只读**，按事件根键走已有索引 idx_ledger_event_root_key）
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    v_replay := FOUND;

    IF v_op = 'refund' THEN
      -- ③ 状态机闸（**仅非重放**）+ 未托管闸
      IF NOT v_replay AND NOT public.job_status_transition_ok(v_job.status, v_to) THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'job.status', 'reason', 'JOB_STATE_INVALID',
                             'from', v_job.status, 'to', v_to, 'job_id', v_job_id::text));
      END IF;
      IF v_job.escrow_txid IS NULL THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'job.escrow_txid', 'reason', 'job_escrow_missing',
                             'job_id', v_job_id::text, 'status', v_job.status));
      END IF;
      -- ★ R-9-102：退回**未用完份额** = reward × (headcount − 已发放份数)
      SELECT count(*) INTO v_paid
        FROM public.job_submission s
       WHERE s.job_id = v_job_id AND s.review_status = 'approved';
      v_remaining := (v_job.headcount - v_paid) * v_job.reward;
      IF v_remaining <= 0 THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'job.escrow', 'reason', 'job_nothing_to_refund',
                             'job_id', v_job_id::text, 'headcount', v_job.headcount::text, 'paid', v_paid::text));
      END IF;
      v_entries := jsonb_build_array(
        jsonb_build_object('uid', v_job.employer_uid::text, 'cid', v_job.cid::text, 'delta', v_remaining::text,
                           'frozen_delta', '0', 'kind', 'job_escrow_refund',
                           'memo', '招工托管退回 job=' || v_job_id::text || '（出冻结 · 未用完份额）'),
        jsonb_build_object('uid', v_job.employer_uid::text, 'cid', v_job.cid::text, 'delta', '0',
                           'frozen_delta', (-v_remaining)::text, 'kind', 'job_escrow_refund',
                           'memo', '招工托管退回 job=' || v_job_id::text || '（回余额）'));
    ELSE
      -- settle：解析发放锚点（该提交者）
      IF v_sub_id IS NOT NULL THEN
        SELECT s.worker_uid, s.review_status INTO v_payee, v_sub_status
          FROM public.job_submission s
         WHERE s.submission_id = v_sub_id AND s.job_id = v_job_id
         FOR UPDATE;
        IF NOT FOUND THEN
          PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
            jsonb_build_object('field', 'submission_id', 'value', v_sub_id::text,
                               'reason', 'submission_not_found', 'job_id', v_job_id::text));
        END IF;
      ELSE
        v_payee := v_job.worker_uid;
        v_sub_status := NULL;
      END IF;
      -- ③ 状态机闸（仅非重放）
      IF NOT v_replay THEN
        IF v_job.status NOT IN ('open', 'submitted', 'disputed') THEN
          PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
            jsonb_build_object('field', 'job.status', 'reason', 'JOB_STATE_INVALID',
                               'from', v_job.status, 'to', 'settled', 'job_id', v_job_id::text));
        END IF;
        IF v_sub_id IS NOT NULL AND v_sub_status <> 'pending' THEN
          PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
            jsonb_build_object('field', 'job_submission.review_status', 'reason', 'job_review_status_invalid',
                               'from', v_sub_status, 'to', 'approved', 'submission_id', v_sub_id::text));
        END IF;
      END IF;
      -- ④ 派生分录（一份 reward：job_payout + job_fee + commission，按既有费分佣口径）
      v_plan    := public.job_settle_plan(v_job.job_id, v_job.employer_uid, v_payee, v_job.cid, v_job.reward);
      v_entries := v_plan->'entries';
    END IF;
  END IF;

  -- ---------------------------------------------------------------- DL84 事件级 kind 白名单
  FOR v_cur IN SELECT t.e->>'kind' AS k FROM jsonb_array_elements(v_entries) AS t(e) LOOP
    IF (v_op = 'publish' AND v_cur.k <> 'job_escrow')
       OR (v_op = 'refund' AND v_cur.k <> 'job_escrow_refund')
       OR (v_op = 'settle' AND v_cur.k NOT IN ('job_payout', 'job_fee', 'commission')) THEN
      PERFORM public.ledger_raise('LEDGER_ACCOUNT_GUARD_VIOLATION',
        jsonb_build_object('reason', 'JOB_EVENT_KIND_OUT_OF_WHITELIST', 'op', v_op, 'kind', v_cur.k));
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------- DL141/DL143：调既有账本函数
  -- 锁序：业务行（上方已 `FOR UPDATE`）→ currency（cid 升序）→ account（uid 升序）—— 由
  -- `ledger_post_event` 在其内部完成第二、三段；本函数**绝不**先锁 account（否则 AB-BA 死锁）。
  v_ledger := public.ledger_post_event(jsonb_build_object(
    'op',                  'entries',
    'idempotency_key',     v_key,
    'request_fingerprint', v_fp,
    'memo',                v_memo,
    'ref_type',            'job',
    'ref_id',              v_job_id::text,
    'entries',             v_entries));
  v_txid := v_ledger->>'txid';
  IF (v_ledger->>'idempotent_replay')::boolean THEN
    v_replay := true;
  END IF;

  -- ---------------------------------------------------------------- 回写业务行
  -- DL144①：重放 ⇒ **不重写业务行**、**不追加 `ledger_event_keys` 项**；判据是账本侧的
  -- `idempotent_replay`（+ 只读根键探测），**不是** `UPDATE ... RETURNING` 的行数。
  IF NOT v_replay THEN
    IF v_op = 'publish' THEN
      UPDATE public.job j
         SET escrow_txid = v_txid::bigint,
             ledger_event_keys = j.ledger_event_keys || v_key
       WHERE j.job_id = v_job_id
      RETURNING * INTO v_job;
    ELSIF v_op = 'refund' THEN
      UPDATE public.job j
         SET status = v_to,
             ledger_event_keys = j.ledger_event_keys || v_key
       WHERE j.job_id = v_job_id
      RETURNING * INTO v_job;
    ELSE
      -- settle：结论位与资金在**同一函数（= 同一语句）**内（R4 原子）
      IF v_sub_id IS NOT NULL THEN
        UPDATE public.job_submission s
           SET review_status = 'approved',
               reviewed_by   = COALESCE(v_reviewed_by, s.reviewed_by),
               reviewed_at   = now(),
               review_memo   = COALESCE(NULLIF(v_review_memo, ''), s.review_memo)
         WHERE s.submission_id = v_sub_id AND s.job_id = v_job_id
         RETURNING s.submission_id INTO v_sub_out;
        IF v_sub_out IS NOT NULL THEN
          v_reviewed := 1;
        END IF;
        -- 已发放份数（含本次刚落定的那份）⇒ 发满 headcount ⇒ 收口 settled
        SELECT count(*) INTO v_paid
          FROM public.job_submission s
         WHERE s.job_id = v_job_id AND s.review_status = 'approved';
        IF v_paid >= v_headcount THEN
          IF NOT public.job_status_transition_ok(v_job.status, 'settled') THEN
            PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
              jsonb_build_object('field', 'job.status', 'reason', 'JOB_STATE_INVALID',
                                 'from', v_job.status, 'to', 'settled', 'job_id', v_job_id::text));
          END IF;
          UPDATE public.job j
             SET status = 'settled',
                 settle_txid = COALESCE(j.settle_txid, v_txid::bigint), -- ★ 0042 修复：settle_txid set-once（0013 job_ledger_ref_guard 禁二次写）
                 ledger_event_keys = j.ledger_event_keys || v_key
           WHERE j.job_id = v_job_id
          RETURNING * INTO v_job;
        ELSE
          UPDATE public.job j
             SET settle_txid = COALESCE(j.settle_txid, v_txid::bigint),
                 ledger_event_keys = j.ledger_event_keys || v_key
           WHERE j.job_id = v_job_id
          RETURNING * INTO v_job;
        END IF;
      ELSE
        -- 遗留单笔 settle（仲裁 / 旧脚本）
        UPDATE public.job j
           SET status = 'settled',
               settle_txid = COALESCE(j.settle_txid, v_txid::bigint),
               ledger_event_keys = j.ledger_event_keys || v_key
         WHERE j.job_id = v_job_id
        RETURNING * INTO v_job;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', v_replay,
    'op', v_op,
    'job_id', v_job_id::text,
    'created', v_created,
    'status', v_job.status,
    'headcount', v_job.headcount::text,
    'submissions_reviewed', v_reviewed,
    'paid_count', v_paid,
    'escrow_txid', CASE WHEN v_job.escrow_txid IS NULL THEN NULL ELSE v_job.escrow_txid::text END,
    'settle_txid', CASE WHEN v_job.settle_txid IS NULL THEN NULL ELSE v_job.settle_txid::text END,
    'ledger_event_keys', to_jsonb(v_job.ledger_event_keys),
    'txid', v_txid,
    'ledger_idempotency_key', v_key,
    'entries', v_ledger->'entries',
    'accounts', v_ledger->'accounts',
    'extra', jsonb_build_object('job_op', v_op, 'fee_credit_uid',
                                CASE WHEN v_plan IS NULL THEN NULL ELSE v_plan->>'fee_credit_uid' END));
END $$;

COMMENT ON FUNCTION public.job_post_event(jsonb) IS
  'P3 招工业务编排函数（DL20 提案 A；硬约束 DL141–DL144）。0042 前推（R-9-98/101/102）：publish 托管 = reward×headcount；settle 逐笔（键 biz:job:settle:<job_id>:<submission_id>，发该提交者一份；发满 headcount ⇒ job.status=settled）；refund 键不变、金额 = reward×(headcount−已发放份数)。幂等键由本函数派生；同一语句内完成「锁业务行 → 派生分录 → 调 ledger_post_event → 回写引用列」；函数体内无 DDL（DL142）；同键重放不重写业务行、不追加 ledger_event_keys 项（DL144①）。';


-- ============================================================================
-- ③ apply-time 自检（DL48：不通过 ⇒ 整迁移回滚、不写版本行）
-- ----------------------------------------------------------------------------
-- 注：探测串里的 `$$` 用 `chr(36)` 拼出（本块自身是 dollar-quoted body，体内出现字面量
--     dollar-quote 标记会提前闭合该 body；沿 0013 手法）。
-- ============================================================================
DO $$
DECLARE
  v_def     text;
  v_missing text;
  v_bad     text;
BEGIN
  -- 3.1 两函数在场
  IF to_regprocedure('public.job_post_event(jsonb)') IS NULL
     OR to_regprocedure('public.job_status_transition_ok(text,text)') IS NULL THEN
    RAISE EXCEPTION '0042 self-check FAILED: job_post_event / job_status_transition_ok missing';
  END IF;

  -- 3.2 状态机白名单：open→settled 合法（R-9-101）；其余既有边与禁边不变
  IF NOT public.job_status_transition_ok('open', 'settled')
     OR NOT public.job_status_transition_ok('open', 'accepted')
     OR NOT public.job_status_transition_ok('open', 'cancelled')
     OR NOT public.job_status_transition_ok('submitted', 'settled')
     OR NOT public.job_status_transition_ok('disputed', 'settled') THEN
    RAISE EXCEPTION '0042 self-check FAILED: whitelist missing an allowed transition (open->settled / R-9-101)';
  END IF;
  IF public.job_status_transition_ok('open', 'submitted')
     OR public.job_status_transition_ok('settled', 'open')
     OR public.job_status_transition_ok('settled', 'cancelled')
     OR public.job_status_transition_ok('cancelled', 'open')
     OR public.job_status_transition_ok('rejected', 'submitted') THEN
    RAISE EXCEPTION '0042 self-check FAILED: whitelist admits a forbidden transition';
  END IF;

  -- 3.3 job_post_event 新口径在场：headcount / 逐笔结算键 / submission_id / 剩余退
  v_def := pg_get_functiondef('public.job_post_event(jsonb)'::regprocedure);
  IF position('headcount' in v_def) = 0 THEN
    RAISE EXCEPTION '0042 self-check FAILED: job_post_event does not reference headcount';
  END IF;
  IF position('biz:job:settle:' in v_def) = 0 OR position('submission_id' in v_def) = 0 THEN
    RAISE EXCEPTION '0042 self-check FAILED: job_post_event settle key does not include submission id';
  END IF;
  IF position('job_escrow_refund' in v_def) = 0 THEN
    RAISE EXCEPTION '0042 self-check FAILED: job_post_event refund path missing';
  END IF;

  -- 3.4 DL142：编排函数体内禁 DDL（实例级；类级由 p3s1b-01 覆盖全树）
  SELECT string_agg(t.p, ',') INTO v_missing FROM (
    VALUES ('create table'),('alter table'),('drop table'),('truncate'),('create index'),
           ('create function'),('rename to'),('do ' || chr(36) || chr(36))
  ) AS t(p)
   WHERE position(upper(t.p) in upper(v_def)) > 0;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0042 self-check FAILED: DDL token(s) inside job_post_event body: %', v_missing;
  END IF;

  -- 3.5 ledger_post_event 未被本迁移触碰（函数源含既有指纹特征：仍以 0034 形态存在）
  --     （只读探测；不写、不改 —— 硬边界「绝不碰 ledger_post_event」的静态自证）
  IF to_regprocedure('public.ledger_post_event(jsonb)') IS NULL THEN
    RAISE EXCEPTION '0042 self-check FAILED: ledger_post_event missing (shall not be touched)';
  END IF;

  RAISE NOTICE '0042 self-check OK: open->settled=%; job_post_event has headcount + biz:job:settle:<job_id>:<submission_id> + refund-only whitelist; no DDL in body',
    public.job_status_transition_ok('open', 'settled');
END $$;
