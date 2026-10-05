// ============================================================================
// src/job-funds-service.ts — P4-B3c · 招工**资金**编排（J1 托管 / J5 发放 / J6 退款）
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md **v0.3**
//   §4.2 J1（`:413`）· J5（`:417`）· J6（`:418`）· §4.3 资金四栏（`:438,439,440`）
//   §4.0 R1/R2/R4/R6/R7（`:385-392`）· §4.4（`:452-462`）· §4.5 幂等键总表（`:468-470,484`）
//   §4.1 关闭集（`:394-405`）· §1 #49（`POST /api/tasklist/:jID/verify` =【保留·改接】）
//   §4.6 批 3 交付清单（`:493`）· §1.1/§1.2（`:136-141,159-168`：既有路径 = 唯一对外路径）
//   §3.1/§3.2/§3.3（404 三类 / 逐码条件 / R107 收尾）· §6.2 附表（403 + ACTOR_NOT_ALLOWED）
//
// 硬口径（本文件自证）：
//   · **唯一资金写路径** = 迁移既有 DB 编排函数 `public.job_post_event($1::jsonb)`
//     （§4.0 R1/R2；函数内「锁业务行 → 派生分录 → 调 `ledger_post_event` → 回写引用列」= **一条语句**）。
//     本文件**不**写 `account`/`ledger_entry`/`currency`，**不**派生任何分录，**不**自造幂等键（DL95）。
//   · **kind 白名单零自由度**（DL84【已冻结】）：publish ⇒ 只 `job_escrow`；settle ⇒ 只
//     `job_payout`/`job_fee`/`commission`；refund ⇒ 只 `job_escrow_refund`。DB 侧为硬闸
//     （`migrations/0013_job.sql:637-645`），越界 = `LEDGER_ACCOUNT_GUARD_VIOLATION`（500 defect）。
//   · **金额不由调用方决定**（§4.4-11 / Zang §5.82 7-23）：本面 payload **无任何金额入参** ——
//     `gross = job.reward`（`0013:632`）、`fee = f(job.reward, commission_policy.fee_rate_bp)`
//     由 `job_settle_plan` 在 **DB 侧**派生 ⇒ 招工面**结构上不存在**「传 `fee=1` 绕过」的洞（报告 §7）。
//   · **`src/commission.ts` 未被修改、未被 import**（佣金拆分归 DB 侧 `job_settle_plan`；派单硬口径 #5）。
//   · **审核通过 → 发放原子**（§4.0 R4 / 派单硬口径 #3）：`job_submission.review_status` 的结论位与
//     `job_post_event` 调用压在**同一条 SQL 语句**（隐式事务）内 ⇒ **不存在「已审核但没发放」**。
//   · **前置闸最小化**：本文件只做「token 侧身份」「代他人出资」「create_key 形状」「refund 目标态」
//     四道**应用层**闸；其余一切入参/状态/币种/余额闸**一律交 DB 编排函数**（其码 = §4.2 的期望码真源），
//     异常经 `ledgerErrorFromDbError` → `normalizeLedgerError` 原码/原 status 映射（§3.3-4）。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { ledgerErrorFromDbError, normalizeLedgerError } from './ledger';
import { errorMessageOf } from './ledger-errors';
import type { TxClient } from './db';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr, type JobVerbResult as VerbResult } from './job-service';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr, VerbResult };

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状；与 currency-service 同族）---------
const fail = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  message?: string,
): VerbErr => ({
  ok: false,
  status,
  code,
  message: message ?? errorMessageOf(code),
  details,
  authDomain: code.startsWith('AUTH_'),
});

/** §3.2 400：入参形状/语义非法（`LEDGER_AMOUNT_INVALID` 兼作参数形状码，靠 `details.field` 区分） */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §3.1：引用对象不存在 ⇒ 404 `LEDGER_REF_NOT_FOUND` + `details.ref_type`（开放取值域，§4.1 注） */
const ref404 = (refType: string, refId: string | number, extra: Record<string, unknown> = {}): VerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: refType, ref_id: String(refId), ...extra }, 'Referenced object not found');

/** §3.2：业务状态机非法转移 ⇒ 409 + 借码 `LEDGER_CURRENCY_INVALID_TRANSITION` + field + reason（大写） */
const stateConflict = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', { field, reason, ...extra }, 'Business state transition rejected');

/** §3.3-4：DB 抛出的命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE，禁堆栈） */
const fromLedgerError = (e: unknown): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, 'job');
  if (mapped) {
    // ★ S31：`message` 由 `fail` 从码查表派生（**不再**传 `mapped.code` 当文案）
    return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>);
  }
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>);
};

// ---- 幂等键（§4.5：前缀只允许 biz:/cm:/cli:/ops:；禁 `#` 与控制字符；校验序固定）----
const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'] as const;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * J1 的**创建键**（`job.create_key`，DL94）：**必须由调用方给**（`cli:` 前缀），
 * 缺失 ⇒ `400 LD005 LEDGER_IDEMPOTENCY_KEY_REQUIRED`（fail-loud，与 DB 侧 `0013:480-483` 同码）。
 * **本片不派生**（与批 2a `resolveJobCreateKey` 的派生兜底**不同**，理由登记于报告 §2.1）：
 * 该键是**创建面唯一权力** —— 内容派生键会让「同内容的两条不同招工」相互碰撞成 `200` 重放。
 * 校验序逐字对齐 §4.5:484 = `TOO_LONG → PREFIX_REQUIRED → RESERVED_SEPARATOR → CONTROL_CHARACTER`。
 */
export const resolveJobCreateKeyRequired = (
  raw: unknown,
): { ok: true; key: string } | { ok: false; err: VerbErr } => {
  const provided = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!provided) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', { field: 'create_key' }, 'Idempotency key is required') };
  }
  if (provided.length > 256) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'TOO_LONG' }, 'Idempotency key is invalid') };
  }
  if (!KEY_PREFIXES.some((prefix) => provided.startsWith(prefix))) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: KEY_PREFIXES }, 'Idempotency key is invalid') };
  }
  if (provided.includes('#')) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'RESERVED_SEPARATOR' }, 'Idempotency key is invalid') };
  }
  if (CONTROL_CHARS.test(provided)) {
    return { ok: false, err: fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'CONTROL_CHARACTER' }, 'Idempotency key is invalid') };
  }
  return { ok: true, key: provided };
};

/** 请求指纹（R53/DL96：路由层强制传 ⇒ 本模块即「路由层」，**服务端算出**，调用方不得自造） */
const fingerprintOf = (parts: Array<string | number>): string =>
  createHash('sha256').update(parts.join('|')).digest('hex');

const actorGate = (actorUid: unknown) => {
  const uid = Number(actorUid);
  if (!Number.isInteger(uid) || uid <= 0) {
    return { ok: false as const, err: fail(400, 'LEDGER_RESERVED_UID', { field: 'actor.uid', value: String(actorUid) }, 'Reserved uid is not allowed') };
  }
  return { ok: true as const, uid };
};

/** 账本/编排函数回执 → 只读视图（**不新增任何 kind、不改任何白名单**） */
const jobEventView = (r: Record<string, unknown>): Record<string, unknown> => {
  const entries = Array.isArray(r.entries) ? (r.entries as Array<Record<string, unknown>>) : [];
  return {
    job_id: r.job_id === undefined || r.job_id === null ? null : String(r.job_id),
    status: r.status === undefined || r.status === null ? null : String(r.status),
    created: r.created === true,
    idempotent_replay: r.idempotent_replay === true,
    txid: r.txid === undefined || r.txid === null ? null : String(r.txid),
    ledger_idempotency_key: r.ledger_idempotency_key === undefined || r.ledger_idempotency_key === null
      ? null : String(r.ledger_idempotency_key),
    escrow_txid: r.escrow_txid === undefined || r.escrow_txid === null ? null : String(r.escrow_txid),
    settle_txid: r.settle_txid === undefined || r.settle_txid === null ? null : String(r.settle_txid),
    ledger_event_keys: Array.isArray(r.ledger_event_keys) ? r.ledger_event_keys : [],
    entry_count: entries.length,
    kinds: entries.map((e) => String(e.kind ?? '')),
    entries,
    accounts: Array.isArray(r.accounts) ? r.accounts : [],
    fee_credit_uid: (r.extra as Record<string, unknown> | undefined)?.fee_credit_uid === undefined
      || (r.extra as Record<string, unknown> | undefined)?.fee_credit_uid === null
      ? null : String((r.extra as Record<string, unknown>).fee_credit_uid),
  };
};

// ============================================================================
// J1 · 发布 + 托管（`job_escrow` ×2：雇主 `balance −(reward×headcount)` → 雇主 `frozen +(reward×headcount)`）
// ----------------------------------------------------------------------------
// ★ R-9-98（S4a）：托管总额 = `reward × headcount`；余额不足 ⇒ 既有 `LEDGER_INSUFFICIENT_BALANCE`
//   （R80 余额闸在 `ledger_post_event` 内自然触发，**零新增码**）。
// 触发端点（spec）= `POST /api/job`；**前端零调用**（§1.2:165 ⇒ 现取 `frontend/src` 0 命中）
//   ⇒ 本片**只交付服务层**（路由随批 4；Zang §5.74/§5.76）。
// 资金四栏（§4.3:438）：**谁出钱** = 雇主可用余额；**谁收钱** = 无人（转为雇主自己的冻结）。
// ============================================================================
export const publishJob = async (params: {
  actorUid: number;
  body: Record<string, unknown> | undefined;
}): Promise<VerbResult> => {
  const body = params.body || {};
  const actor = actorGate(params.actorUid);
  if (!actor.ok) return actor.err;

  // ① 代他人出资 ⇒ 403（§6.2 附表；不得替他人托管）
  let employerUid = actor.uid;
  if (body.employer_uid !== undefined && body.employer_uid !== null && String(body.employer_uid).trim() !== '') {
    const employerText = String(body.employer_uid).trim();
    if (!/^\d+$/.test(employerText)) {
      return shapeError('job.employer_uid', 'NOT_AN_INTEGER');
    }
    if (Number(employerText) !== actor.uid) {
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', field: 'job.employer_uid' });
    }
    employerUid = Number(employerText);
  }

  // ② 创建键（§4.5）：缺失 ⇒ fail-loud，**不派生**
  const keyed = resolveJobCreateKeyRequired(body.create_key ?? body.idempotency_key ?? body.idempotencyKey);
  if (!keyed.ok) return keyed.err;

  // ③ 最小形状：cid / reward / headcount 一律**原样透传字符串**，语义闸（正整数 / ≤1e15 /
  //    headcount ≥ 1 / 币种 must listed）全交 `job_post_event` ⇒ 期望码与 §4.2 J1 同源。
  const cid = typeof body.cid === 'string' ? body.cid.trim() : String(body.cid ?? '');
  const reward = typeof body.reward === 'string' ? body.reward.trim() : String(body.reward ?? '');
  // ★ R-9-97/R-9-98：名额入参（缺省 '1'）；托管总额 = reward × headcount（金额由 DB 侧派生）。
  const headcountRaw = body.headcount ?? body.head_count ?? body.headCount;
  const headcount = headcountRaw === undefined || headcountRaw === null || String(headcountRaw).trim() === ''
    ? '1'
    : String(headcountRaw).trim();
  const title = typeof body.title === 'string' ? body.title : '';
  const description = typeof body.description === 'string' ? body.description : '';

  const payload = {
    op: 'publish',
    create_key: keyed.key,
    employer_uid: String(employerUid),
    cid,
    reward,
    headcount,
    title,
    description,
    request_fingerprint: fingerprintOf(['job.publish', keyed.key, employerUid, cid, reward, headcount, title, description]),
    memo: `job publish escrow:${keyed.key}`,
  };

  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.jobPostEvent(payload);
  } catch (e) {
    return fromLedgerError(e);
  }

  const r = (row.r || {}) as Record<string, unknown>;
  const view = jobEventView(r);
  return { ok: true, replay: r.idempotent_replay === true, view: { ...view, employer_uid: String(employerUid), cid, reward, headcount } };
};

// ============================================================================
// J5 / J6 · 结算（settle）与退托管（refund）—— `job_post_event(op='settle'|'refund')`
// ----------------------------------------------------------------------------
// 幂等键由 DB 函数**派生**（DL95；调用方不得自造）：settle = `biz:job:settle:<job_id>:<submission_id>`
//   （★ S4a 逐笔 · Zang 裁：**键与指纹都必须含提交标识**）/ refund = `biz:job:refund:<job_id>`（**不变**）。
// 状态机：settle ⇒ `open|submitted|disputed → settled`（`open→settled` = S4a 为「发满即收口」新开）；
//   refund ⇒ `open → cancelled` / `accepted|submitted → rejected`（真源 `public.job_status_transition_ok`）。
// 审核结论位与资金写入**同一 DB 函数同一语句**（见 `DatabaseService.reviewJobSubmission`）⇒ R4 原子。
// ============================================================================
const toStatusOf = (raw: unknown): string => {
  const text = raw === undefined || raw === null || String(raw).trim() === '' ? 'cancelled' : String(raw).trim();
  return text;
};

/**
 * J5 · **逐笔发放**（`R-9-101` · S4a）：审核人判一份合格 ⇒ 向**该提交者**发放**一份 `reward`**
 *   （`job_payout` + `job_fee` + `commission` 按既有费分佣口径 · 金额由 DB 侧 `job_settle_plan` 派生）；
 *   发满 `headcount` ⇒ `job.status='settled'`。
 * ★ 幂等键含提交标识（Zang 裁）：`biz:job:settle:<job_id>:<submission_id>`；`request_fingerprint`
 *   与之同源（`['job.settle', jobId, submissionId]`）⇒ 同 job 多份**不再互相判重放**。
 * ★ `submissionIdRaw` 缺省 ⇒ **遗留单笔**（键退化为 `biz:job:settle:<job_id>`，发 `job.worker_uid`；
 *   供既有仲裁 / 旧脚本）；新模型（review 路由）**必须**给提交号。
 */
export const settleJob = async (params: {
  jobIdRaw: unknown;
  /** 目标提交号（`R-9-100` 换轴：review 按提交逐笔）；缺省 ⇒ 遗留单笔。 */
  submissionIdRaw?: unknown;
  /** 审核人（= 结论位 `job_submission.reviewed_by`）；`undefined` ⇒ 只做资金、不写结论位 */
  reviewerUid?: number;
}, ex?: TxClient): Promise<VerbResult> => {
  const jobId = typeof params.jobIdRaw === 'string' ? params.jobIdRaw.trim() : String(params.jobIdRaw ?? '');
  if (!/^\d+$/.test(jobId)) {
    return ref404('job', jobId || 'null', { field: 'job_id', reason: 'job_not_found' });
  }
  const submissionId = params.submissionIdRaw === undefined || params.submissionIdRaw === null
    ? ''
    : String(params.submissionIdRaw).trim();
  if (submissionId !== '' && !/^\d+$/.test(submissionId)) {
    return ref404('job_submission', submissionId, { field: 'submission_id', reason: 'submission_not_found', job_id: jobId });
  }
  const payload: Record<string, unknown> = {
    op: 'settle',
    job_id: jobId,
    request_fingerprint: submissionId === ''
      ? fingerprintOf(['job.settle', jobId])
      : fingerprintOf(['job.settle', jobId, submissionId]),
    memo: submissionId === '' ? `job settle:${jobId}` : `job settle:${jobId}:${submissionId}`,
  };
  if (submissionId !== '') payload.submission_id = submissionId;
  // 结论位 `review_status='approved'` 与资金在 DB `job_post_event` 的**同一函数同一语句**内落定（R4）。
  return dispatchJobEvent(payload, params.reviewerUid, ex);
};

export const refundJob = async (params: {
  jobIdRaw: unknown;
  toStatusRaw?: unknown;
  reviewerUid?: number;
}, ex?: TxClient): Promise<VerbResult> => {
  const jobId = typeof params.jobIdRaw === 'string' ? params.jobIdRaw.trim() : String(params.jobIdRaw ?? '');
  if (!/^\d+$/.test(jobId)) {
    return ref404('job', jobId || 'null', { field: 'job_id', reason: 'job_not_found' });
  }
  const toStatus = toStatusOf(params.toStatusRaw);
  // §4.2 J6 期望码逐字：`400` LD016 + `not_a_refund_target`（DB 侧 `0013:585-588` 同码同 reason）
  if (toStatus !== 'cancelled' && toStatus !== 'rejected') {
    return shapeError('to_status', 'not_a_refund_target', { value: toStatus, allowed: ['cancelled', 'rejected'] });
  }
  const payload = {
    op: 'refund',
    job_id: jobId,
    to_status: toStatus,
    request_fingerprint: fingerprintOf(['job.refund', jobId, toStatus]),
    memo: `job refund:${jobId}:${toStatus}`,
  };
  // ★ S4a（`R-9-102`）：退款为**一次性整体动作**（键 `biz:job:refund:<job_id>` 不变）⇒ DB 侧只关 job
  //   （`status = to_status` + 退**未用完份额** `reward × (headcount − 已发放份数)`）；不逐笔落提交结论位
  //   （「判不合格」按提交归 `verifyJobSubmission` 的 reject 腿）。
  return dispatchJobEvent(payload, params.reviewerUid, ex);
};

/**
 * ★ P9⑤（`commission.spec` v0.4 §19.5⑦ · `R-9-57` · 需求 §6.2②）：**首任务奖励接线**。
 * 接线点 = `reviewJobSubmission` / `dispatchJobEvent` 的**结算后**（`op = 'settle'` 才发）。
 *   · 「首个平台任务」判定依据 + 幂等键形态（`biz:invite:firsttask:<worker_uid>`）**全部**在
 *     `DatabaseService.settleInviteFirstTaskReward` 内（只由不可变 `worker_uid` 派生）；
 * ★ S4a-c 裁（`R-9-103` · **重放零写**）：**幂等重放分支必须跳过本钩子** —— 重放不是新业务事实，
 *   其唯一合法回执是账本既有读数；若在重放上仍派生「首任务奖励」，重放就不再是零副作用。
 *   现取事实（全库该 `kind` 仅此 2 行）：`txid 1460` `−10 @uid=−1` / `txid 1461` `+10 @uid=12`
 *   （`2026-10-03T14:22:38Z`）—— 一次 `settle` **重放**意外触发了本钩子（`biz:invite:firsttask:12`
 *   彼时账上尚无 ⇒ 重放路径**新落**了 20 分净额 0 的分录）。`ledger_entry` append-only ⇒ **历史行不改**；
 *   本闸只拦未来重放（判负：造一次重放 ⇒ `invite_first_task_reward` **零新增行**）。
 *   · **失败不阻断结算**（沿注册腿「失败不阻断注册」纪律 ⇒ 奖励为**尽力而为**的后续事件）；
 *   · `ex` 透传（生产默认 `undefined` ⇒ 各走自有连接；探针注入 ⇒ 同一事务内可触发）。
 */
const settleFirstTaskRewardBestEffort = async (
  payload: Record<string, unknown>,
  /** ★ S4a-c：`true` = 本次 settle 是幂等重放 ⇒ 直接返回（零新分录） */
  replay: boolean,
  ex?: TxClient,
): Promise<void> => {
  if (payload.op !== 'settle' || replay) return;
  await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: payload.job_id }, ex)
    .catch((e) => {
      console.warn('[P9⑤] invite first-task reward skipped:', String((e as Error)?.message ?? e));
    });
};

/**
 * settle / refund 的共同出口：**有审核人 ⇒ 结论位 + 资金写在同一语句**（R4 原子）；
 * 无审核人（服务层直调用例）⇒ 只调编排函数（业务行状态 + 分录仍在同一条语句内）。
 */
const dispatchJobEvent = async (
  payload: Record<string, unknown>,
  reviewerUid?: number,
  ex?: TxClient,
): Promise<VerbResult> => {
  let row: Record<string, unknown>;
  try {
    if (reviewerUid === undefined) {
      row = await DatabaseService.jobPostEvent(payload, ex);
      // ★ P9⑤ 首任务奖励接线（结算后 · 尽力而为 · 失败不阻断）—— ★ S4a-c：重放分支跳过（零写）
      await settleFirstTaskRewardBestEffort(
        payload, ((row.r || {}) as Record<string, unknown>).idempotent_replay === true, ex);
      return { ok: true, replay: ((row.r || {}) as Record<string, unknown>).idempotent_replay === true, view: jobEventView((row.r || {}) as Record<string, unknown>) };
    }
    const gate = actorGate(reviewerUid);
    if (!gate.ok) return gate.err;
    const subId = payload.submission_id === undefined || payload.submission_id === null ? '' : String(payload.submission_id);
    row = await DatabaseService.reviewJobSubmission({
      payload,
      reviewedBy: gate.uid,
      reviewMemo: subId === ''
        ? `job ${String(payload.op)}:${String(payload.job_id)}`
        : `job ${String(payload.op)}:${String(payload.job_id)}:${subId}`,
    }, ex);
  } catch (e) {
    return fromLedgerError(e);
  }
  // ★ P9⑤ 首任务奖励接线（结算后 · 尽力而为 · 失败不阻断）—— ★ S4a-c：重放分支跳过（零写）
  await settleFirstTaskRewardBestEffort(
    payload, ((row.r || {}) as Record<string, unknown>).idempotent_replay === true, ex);
  const r = (row.r || {}) as Record<string, unknown>;
  const view = jobEventView(r);
  return {
    ok: true,
    replay: r.idempotent_replay === true,
    view: { ...view, submissions_reviewed: Number(row.submissions_reviewed ?? 0) },
  };
};

// ============================================================================
// 路由入口 · `POST /api/tasklist/:jID/verify`（**既有路径 · 前端真实消费点**）
// ----------------------------------------------------------------------------
// spec §1 #49【保留·改接】：★ S4a（`R-9-100`/`R-9-101`）· **换轴**：`:jID` 语义 =
//   `job_submission.submission_id`（改前 = `job_application.application_id`）。
// 前端契约（`frontend/src/pages/DashboardPage.jsx:223`）：`POST {approved: boolean}`。
//   · `approved !== false` ⇒ **逐笔发放**（`settleJob` 向该提交者发一份 `reward`；发满 `headcount` ⇒ `settled`）；
//   · `approved === false` ⇒ **按提交判不合格**（只落该提交结论位 `rejected`，**零资金**，job 状态不变 · 可再提）。
// 返回：调用方（路由层）用 `submissionId`（兼容别名 `applicationId`）重读 9 键读口以**保持响应键集不变**（§2 F1）。
// ============================================================================
export const verifyJobSubmission = async (params: {
  identifierRaw: unknown;
  approved: boolean;
  actorUid: number;
}, ex?: TxClient): Promise<VerbResult & { submissionId?: number; jobId?: number; applicationId?: number }> => {
  const identText = typeof params.identifierRaw === 'string' ? params.identifierRaw.trim() : String(params.identifierRaw ?? '');
  if (!/^\d+$/.test(identText) || Number(identText) <= 0) return ref404('job_submission', identText || 'null', { reason: 'jID_not_found' });

  let target: Awaited<ReturnType<typeof DatabaseService.resolveReviewTarget>>;
  try {
    target = await DatabaseService.resolveReviewTarget(Number(identText));
  } catch (e) {
    return fromLedgerError(e);
  }
  if (!target) return ref404('job_submission', identText, { reason: 'jID_not_found' });

  if (!params.approved) {
    // ★ 按提交判不合格（`R-9-99`）：只落结论位，**零资金**；job 状态不变（同人可再提）。
    let rejected = 0;
    try {
      rejected = await DatabaseService.rejectJobSubmission({
        submissionId: target.submissionId,
        reviewedBy: params.actorUid,
        reviewMemo: `job reject:${target.jobId}:${target.submissionId}`,
      }, ex);
    } catch (e) {
      return fromLedgerError(e);
    }
    if (rejected <= 0) {
      return stateConflict('job_submission.review_status', 'job_review_status_invalid', {
        from: target.submissionStatus, to: 'rejected', submission_id: String(target.submissionId),
      });
    }
    return {
      ok: true,
      replay: false,
      view: {
        submission_id: String(target.submissionId),
        job_id: String(target.jobId),
        worker_uid: String(target.workerUid),
        status: 'rejected',
      },
      submissionId: target.submissionId,
      jobId: target.jobId,
      // 兼容别名：既有路由层 `index.ts:1995` 读 `result.applicationId` 重读 9 键读口（S2 换轴后该值 = submission_id）
      applicationId: target.submissionId,
    };
  }

  const result = await settleJob({ jobIdRaw: target.jobId, submissionIdRaw: target.submissionId, reviewerUid: params.actorUid }, ex);
  if (!result.ok) return result;
  return { ...result, submissionId: target.submissionId, jobId: target.jobId, applicationId: target.submissionId };
};
