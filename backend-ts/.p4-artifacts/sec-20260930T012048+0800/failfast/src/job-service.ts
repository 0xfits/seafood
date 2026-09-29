// ============================================================================
// src/job-service.ts — P4-B2a · 招工**非资金**写入与状态机（内部 service 层）
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md v0.1
//   §1 #19（submit 改接 job_submission）· §1 #20（claim 拆分 apply/accept/settle）· §1 #10（detail-miss 404）
//   §3.1（404 三类 + detail-miss 默认 404）· §3.2（逐码适用条件）· §3.3（R107 收尾规则）
//   §4.2 J2/J3/J4（报名 / 选定 / 提交；**无分录**）· §4.0 R3/R4/R5（无分录的写不得借账本幂等；批 2 只做非资金）
//   §4.5（创建键前缀只允许 biz:/cm:/cli:/ops:，不得含 `#` 与控制字符）
//   §1.2（批 2/批 3「既有路径 = 唯一对外路径」，§4.1 新命名只作**内部 service 命名**）
//
// 硬边界（本文件自证）：
//   · **不 import** ./ledger、./commission ⇒ 无任何编排函数调用、无任何 ledger_entry/account/currency 写。
//   · 只走已存在表：public.job / public.job_application / public.job_submission（0013/0014 既有 DDL）。
//   · 本模块**不**实现 settle/approve（§4.0 R4：整条归批 3，禁半实现）。
// ============================================================================
import type { Response } from 'express';
import { createHash } from 'crypto';
import { DatabaseService } from './database';

// ---- R107 错误体（§3.3-1：{error:{code,message,i18n_key,details}}）-----------
export const ledgerErrorBody = (
  code: string,
  message: string,
  details: Record<string, unknown>,
  i18nDomain: 'ledger' | 'auth' = 'ledger',
) => ({
  error: {
    code,
    message,
    i18n_key: `${i18nDomain}.err.${code}`,
    details,
  },
});

/** `410` 弃用面（§5.1 统一要求：形状对齐 R107，code = LEDGER_REF_NOT_FOUND，**必须**登记过期日） */
export const sendGone = (res: Response, refId: string, sunset: string) =>
  res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${refId}`,
    { ref_type: 'endpoint', ref_id: refId, http_status: 410, sunset },
  ));

// ---- 业务 verb 结果（§3.2 逐码 + §4.2 J2/J3/J4）----------------------------
export interface JobVerbOk {
  ok: true;
  replay: boolean;
  view: Record<string, unknown>;
}

export interface JobVerbErr {
  ok: false;
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
  authDomain?: boolean;
}

export type JobVerbResult = JobVerbOk | JobVerbErr;

const fail = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  message?: string,
): JobVerbErr => ({
  ok: false,
  status,
  code,
  message: message || code,
  details,
  authDomain: code.startsWith('AUTH_'),
});

/** 路由层统一出口：400/404/409 → ledger 域码；403 → AUTH_FORBIDDEN（§3.3-6：auth 键独立域） */
export const sendVerbError = (res: Response, err: JobVerbErr) =>
  res.status(err.status).json(ledgerErrorBody(err.code, err.message, err.details, err.authDomain ? 'auth' : 'ledger'));

// ---- 创建键（§4.5：前缀只允许 biz:/cm:/cli:/ops:；禁 `#` 与控制字符）---------
const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'];
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);

/**
 * 解析创建键：调用方给 `create_key` / `Idempotency-Key` 时按 §4.5 校验；
 * 未给时派生**确定性**键 `cli:p4b2a:<verb>:<...>:<digest>`（同一请求重试 ⇒ 同键 ⇒ 200 重放）。
 * 派生键不构成「账本幂等键」（DL99/R3：无分录的写靠业务侧 create_key）——登记为批 2 过渡（见报告 §6 自曝）。
 */
export const resolveJobCreateKey = (
  raw: unknown,
  fallbackParts: Array<string | number>,
): { ok: true; key: string; derived: boolean } | { ok: false; details: Record<string, unknown> } => {
  const provided = raw === undefined || raw === null ? '' : String(raw).trim();

  if (!provided) {
    return { ok: true, key: `cli:p4b2a:${fallbackParts.join(':')}:${digest(fallbackParts.join('|'))}`, derived: true };
  }
  if (provided.length > 200) {
    return { ok: false, details: { field: 'create_key', reason: 'TOO_LONG' } };
  }
  if (!KEY_PREFIXES.some((prefix) => provided.startsWith(prefix))) {
    return { ok: false, details: { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: KEY_PREFIXES } };
  }
  if (provided.includes('#')) {
    return { ok: false, details: { field: 'create_key', reason: 'RESERVED_SEPARATOR' } };
  }
  if (CONTROL_CHARS.test(provided)) {
    return { ok: false, details: { field: 'create_key', reason: 'CONTROL_CHARACTER' } };
  }
  return { ok: true, key: provided, derived: false };
};

const keyError = (details: Record<string, unknown>): JobVerbErr =>
  fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', details, 'Idempotency key is invalid');

const gone404 = (refType: string, refId: string | number): JobVerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: refType, ref_id: String(refId) }, 'Referenced object not found');

/** 业务状态机非法转移 ⇒ 409 + 借码（§3.2：`LEDGER_CURRENCY_INVALID_TRANSITION` + details.field + reason 大写） */
const stateConflict = (field: string, reason: string, extra: Record<string, unknown> = {}): JobVerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', { field, reason, ...extra }, 'Business state transition rejected');

// ---- J4 · 提交交付物（`submitWork`；无分录；§4.2 J4）-------------------------
export const submitWork = async (params: {
  identifier: number;
  workerUid: number;
  deliverable: string;
  createKeyRaw?: unknown;
  /** 路由层已用 B1-b 的 job_application 读口证过归属时的快路径（application_id） */
  applicationHint?: number | null;
}): Promise<JobVerbResult> => {
  const resolvedKey = resolveJobCreateKey(params.createKeyRaw, ['submit', params.identifier, params.workerUid]);
  if (!resolvedKey.ok) return keyError(resolvedKey.details);

  let applicationId = params.applicationHint || null;

  if (!applicationId) {
    const resolved = await DatabaseService.resolveJobApplication(params.identifier, params.workerUid);
    if (!resolved) return gone404('job_application', params.identifier);
    if (resolved.ownership !== 'self') {
      // §6.2 附表：已参与但无该动作权限 ⇒ 403 + reason=ACTOR_NOT_ALLOWED（C6：不得借 LEDGER_HOLD_NOT_ALLOWED）
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', ref_type: 'job_application', ref_id: String(params.identifier) }, 'ACTOR_NOT_ALLOWED');
    }
    applicationId = resolved.applicationId;
  }

  if (!applicationId) return gone404('job_application', params.identifier);

  const write = await DatabaseService.submitJobWork(applicationId, params.workerUid, params.deliverable, resolvedKey.key);
  if (!write) return gone404('job_application', applicationId);

  if (write.outcome === 'replay') {
    if (write.existingDeliverable !== params.deliverable) {
      // §3.2 409：同键异指纹 ⇒ LEDGER_IDEMPOTENCY_CONFLICT
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { field: 'job_submission.create_key', reason: 'REPLAY_FINGERPRINT_MISMATCH', ref_id: resolvedKey.key }, 'Idempotency conflict');
    }
  } else if (write.outcome === 'blocked') {
    if (write.applicationStatus === 'accepted' && write.jobStatus === 'accepted') {
      // 应用与 job 都在 accepted、却未落行 ⇒ 唯一可能是 create_key 已被别的对象占用
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { field: 'job_submission.create_key', reason: 'create_key_taken', ref_id: resolvedKey.key }, 'Idempotency conflict');
    }
    return write.applicationStatus !== 'accepted'
      ? stateConflict('job_application.status', 'JOB_APPLICATION_STATE_INVALID', { from: write.applicationStatus, to: 'accepted', application_id: String(applicationId) })
      : stateConflict('job.status', 'JOB_STATE_INVALID', { from: write.jobStatus, to: 'submitted', application_id: String(applicationId) });
  }

  const view = await DatabaseService.getTaskProgress(applicationId);
  if (!view) return gone404('job_application', applicationId);

  return { ok: true, replay: write.outcome === 'replay', view: view as unknown as Record<string, unknown> };
};

// ---- J2 · 报名（`applyToJob`；无分录；§4.2 J2）------------------------------
export const applyToJob = async (params: {
  jobId: number;
  workerUid: number;
  createKeyRaw?: unknown;
}): Promise<JobVerbResult> => {
  const resolvedKey = resolveJobCreateKey(params.createKeyRaw, ['apply', params.jobId, params.workerUid]);
  if (!resolvedKey.ok) return keyError(resolvedKey.details);

  const write = await DatabaseService.applyToJob(params.jobId, params.workerUid, resolvedKey.key);
  if (!write) return gone404('job', params.jobId);

  switch (write.outcome) {
    case 'not_open':
      return stateConflict('job.status', 'not_open_job', { from: write.jobStatus, to: 'applied', job_id: String(params.jobId) });
    case 'self_application':
      return stateConflict('job.employer_uid', 'self_application_not_allowed', { job_id: String(params.jobId) });
    case 'already_applied':
      // §3.3-4：业务级唯一键必须在应用层先判 ⇒ 409（不得让裸 23505 落 400）
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { reason: 'application_already_exists', ref_type: 'job_application', ref_id: String(write.applicationId ?? ''), job_id: String(params.jobId) }, 'application_already_exists');
    case 'conflict':
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { reason: 'create_key_taken', ref_id: resolvedKey.key, job_id: String(params.jobId) }, 'Idempotency conflict');
    default:
      break;
  }

  return {
    ok: true,
    replay: write.outcome === 'replay',
    view: { application_id: write.applicationId, job_id: params.jobId, worker_uid: params.workerUid, status: 'applied' },
  };
};

// ---- J3 · 雇主选定打工人（`acceptApplication`；无分录；§4.2 J3）------------
export const acceptApplication = async (params: {
  jobId: number;
  applicationId: number;
  actorUid: number;
}): Promise<JobVerbResult> => {
  const write = await DatabaseService.acceptJobApplication(params.jobId, params.applicationId, params.actorUid);
  if (!write) return gone404('job_application', params.applicationId);

  switch (write.outcome) {
    case 'not_employer':
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', ref_type: 'job_application', ref_id: String(params.applicationId) }, 'ACTOR_NOT_ALLOWED');
    case 'already_accepted':
      return stateConflict('job_application.status', 'application_already_accepted', { from: write.applicationStatus, to: 'accepted', application_id: String(params.applicationId) });
    case 'app_state_invalid':
      return stateConflict('job_application.status', 'JOB_APPLICATION_STATE_INVALID', { from: write.applicationStatus, to: 'accepted', application_id: String(params.applicationId) });
    case 'job_state_invalid':
      return stateConflict('job.status', 'JOB_STATE_INVALID', { from: write.jobStatus, to: 'accepted', job_id: String(params.jobId) });
    default:
      break;
  }

  return {
    ok: true,
    replay: false,
    view: {
      application_id: write.applicationId,
      job_id: write.jobId,
      worker_uid: write.workerUid,
      status: 'accepted',
    },
  };
};
