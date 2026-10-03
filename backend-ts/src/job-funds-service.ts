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
  message: message || code,
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
    return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>, mapped.code);
  }
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>, norm.code);
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
// J1 · 发布 + 托管（`job_escrow` ×2：雇主 `balance −reward` → 雇主 `frozen +reward`）
// ----------------------------------------------------------------------------
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
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', field: 'job.employer_uid' }, 'ACTOR_NOT_ALLOWED');
    }
    employerUid = Number(employerText);
  }

  // ② 创建键（§4.5）：缺失 ⇒ fail-loud，**不派生**
  const keyed = resolveJobCreateKeyRequired(body.create_key ?? body.idempotency_key ?? body.idempotencyKey);
  if (!keyed.ok) return keyed.err;

  // ③ 最小形状：cid / reward 一律**原样透传字符串**，语义闸（正整数 / ≤1e15 / 币种 must listed）
  //    全交 `job_post_event`（`0013:507-522,557-565`）⇒ 期望码与 §4.2 J1 同源。
  const cid = typeof body.cid === 'string' ? body.cid.trim() : String(body.cid ?? '');
  const reward = typeof body.reward === 'string' ? body.reward.trim() : String(body.reward ?? '');
  const title = typeof body.title === 'string' ? body.title : '';
  const description = typeof body.description === 'string' ? body.description : '';

  const payload = {
    op: 'publish',
    create_key: keyed.key,
    employer_uid: String(employerUid),
    cid,
    reward,
    title,
    description,
    request_fingerprint: fingerprintOf(['job.publish', keyed.key, employerUid, cid, reward, title, description]),
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
  return { ok: true, replay: r.idempotent_replay === true, view: { ...view, employer_uid: String(employerUid), cid, reward } };
};

// ============================================================================
// J5 / J6 · 结算（settle）与退托管（refund）—— `job_post_event(op='settle'|'refund')`
// ----------------------------------------------------------------------------
// 幂等键由 DB 函数**派生**（DL95；调用方不得自造）：`biz:job:settle:<job_id>` / `biz:job:refund:<job_id>`。
// 状态机：settle ⇒ `submitted|disputed → settled`；refund ⇒ `open → cancelled` / `accepted|submitted → rejected`
//   （唯一真源 = `public.job_status_transition_ok`，`0013:60-70`）。
// 审核结论位与资金写入**同一语句**（见 `DatabaseService.reviewJobSubmission`）⇒ R4 原子。
// ============================================================================
const toStatusOf = (raw: unknown): string => {
  const text = raw === undefined || raw === null || String(raw).trim() === '' ? 'cancelled' : String(raw).trim();
  return text;
};

export const settleJob = async (params: {
  jobIdRaw: unknown;
  /** 审核人（= 结论位 `job_submission.reviewed_by`）；`undefined` ⇒ 只做资金、不写结论位 */
  reviewerUid?: number;
}, ex?: TxClient): Promise<VerbResult> => {
  const jobId = typeof params.jobIdRaw === 'string' ? params.jobIdRaw.trim() : String(params.jobIdRaw ?? '');
  if (!/^\d+$/.test(jobId)) {
    return ref404('job', jobId || 'null', { field: 'job_id', reason: 'job_not_found' });
  }
  const payload = {
    op: 'settle',
    job_id: jobId,
    request_fingerprint: fingerprintOf(['job.settle', jobId]),
    memo: `job settle:${jobId}`,
  };
  // `review_status = 'approved'`（`job_submission_review_status_enum`：pending→{approved,rejected}）
  return dispatchJobEvent(payload, 'approved', params.reviewerUid, ex);
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
  // 退回 ⇒ 结论位 `rejected`（拒收）；取消（`to_status='cancelled'`）⇒ 同样落 `rejected`（结论位只有两值）
  return dispatchJobEvent(payload, 'rejected', params.reviewerUid, ex);
};

/**
 * ★ P9⑤（`commission.spec` v0.4 §19.5⑦ · `R-9-57` · 需求 §6.2②）：**首任务奖励接线**。
 * 接线点 = `reviewJobSubmission` / `dispatchJobEvent` 的**结算后**（`op = 'settle'` 才发）。
 *   · 「首个平台任务」判定依据 + 幂等键形态（`biz:invite:firsttask:<worker_uid>`）**全部**在
 *     `DatabaseService.settleInviteFirstTaskReward` 内（只由不可变 `worker_uid` 派生）；
 *   · **失败不阻断结算**（沿注册腿「失败不阻断注册」纪律 ⇒ 奖励为**尽力而为**的后续事件）；
 *   · `ex` 透传（生产默认 `undefined` ⇒ 各走自有连接；探针注入 ⇒ 同一事务内可触发）。
 */
const settleFirstTaskRewardBestEffort = async (
  payload: Record<string, unknown>,
  ex?: TxClient,
): Promise<void> => {
  if (payload.op !== 'settle') return;
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
  reviewStatus: 'approved' | 'rejected',
  reviewerUid?: number,
  ex?: TxClient,
): Promise<VerbResult> => {
  let row: Record<string, unknown>;
  try {
    if (reviewerUid === undefined) {
      row = await DatabaseService.jobPostEvent(payload, ex);
      // ★ P9⑤ 首任务奖励接线（结算后 · 尽力而为 · 失败不阻断）
      await settleFirstTaskRewardBestEffort(payload, ex);
      return { ok: true, replay: ((row.r || {}) as Record<string, unknown>).idempotent_replay === true, view: jobEventView((row.r || {}) as Record<string, unknown>) };
    }
    const gate = actorGate(reviewerUid);
    if (!gate.ok) return gate.err;
    row = await DatabaseService.reviewJobSubmission({
      payload,
      reviewStatus,
      reviewedBy: gate.uid,
      reviewMemo: `job ${String(payload.op)}:${String(payload.job_id)}`,
    }, ex);
  } catch (e) {
    return fromLedgerError(e);
  }
  // ★ P9⑤ 首任务奖励接线（结算后 · 尽力而为 · 失败不阻断）
  await settleFirstTaskRewardBestEffort(payload, ex);
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
// spec §1 #49【保留·改接】：`job_submission.review_status` + `job_post_event(op='settle'|'refund')`；
//   `approve` = 结算（资金）⇒ 整条归批 3（§4 J5/J6、§4.0 R4）。
// 前端契约（`frontend/src/pages/DashboardPage.jsx:223`）：`POST {approved: boolean}`。
//   `approved !== false` ⇒ **J5 settle**；`approved === false` ⇒ **J6 refund（`to_status='rejected'`）**。
// `:jID` 语义：前端读口 `getTaskProgress`/`listPendingVerification` 的 `jID` 键 = `job_application.application_id`
//   ⇒ 本入口按 `application_id` 精确解析（未命中再容错按 `job_id`），解析结果 → `job.job_id`。
// 返回：调用方（路由层）用 `view.application_id` 重读 9 键读口以**保持响应键集不变**（§2 母约束 F1）。
// ============================================================================
export const verifyJobSubmission = async (params: {
  identifierRaw: unknown;
  approved: boolean;
  actorUid: number;
}, ex?: TxClient): Promise<VerbResult & { applicationId?: number; jobId?: number }> => {
  const identText = typeof params.identifierRaw === 'string' ? params.identifierRaw.trim() : String(params.identifierRaw ?? '');
  if (!/^\d+$/.test(identText) || Number(identText) <= 0) return ref404('job_application', identText || 'null', { reason: 'jID_not_found' });

  let target: Awaited<ReturnType<typeof DatabaseService.resolveReviewTarget>>;
  try {
    target = await DatabaseService.resolveReviewTarget(Number(identText));
  } catch (e) {
    return fromLedgerError(e);
  }
  if (!target) return ref404('job_application', identText, { reason: 'jID_not_found' });

  const result = params.approved
    ? await settleJob({ jobIdRaw: target.jobId, reviewerUid: params.actorUid }, ex)
    : await refundJob({ jobIdRaw: target.jobId, toStatusRaw: 'rejected', reviewerUid: params.actorUid }, ex);

  if (!result.ok) return result;
  return { ...result, applicationId: target.applicationId, jobId: target.jobId };
};
