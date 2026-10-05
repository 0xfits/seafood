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
import { DatabaseService, type SqlRunner } from './database';
import { errorMessageOf } from './ledger-errors';

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
  // ★ S31（台账 B5 上半）：第 4 参缺省 ⇒ **查表派生的稳定英文句**（`errorMessageOf`），**不再回退 `code`**
  //   （§3.3 条款 9′：`message` 严禁机读码）。显式传英文句的调用点行为不变。
  message: message ?? errorMessageOf(code),
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

// ---- J4 · 提交交付物（`submitWork`；无分录；§4.2 J4；★ S2 任务模型改造 `R-9-99`）-----
// ★ 提交即参与（口径逐字）：
//   · **取消「报名 / 选定」前置** —— 不再要求先有 `accepted` 的 `job_application`；
//   · **任何已登录 actor（含任务发布者本人）**可对 `status='open'` 的任务直接提交（**移除 self 限制**）；
//   · **同一人可多次提交**（不再因「已有提交」而拒；无 `create_key` 时派生键含交付物摘要 ⇒
//     不同内容 = 各自新提交；完全相同内容的重投 = 200 幂等重放，**非拒**）；
//   · ★ **`batt` 闸由「报名」移到「提交」**：不满足 ⇒ 409 + `reason='BATT_BELOW_ACCEPT_THRESHOLD'`
//     （**逐字不变**，仅落点变更）；阈值真源 = 既有 `batt_policy.acceptThresholdBatt`（非自造）。
//   · `identifier` 语义（S2 起）= 目标 **`job_id`**（不再解析 / 要求 `job_application`）。
export const submitWork = async (params: {
  identifier: number;
  workerUid: number;
  deliverable: string;
  createKeyRaw?: unknown;
}, ex?: SqlRunner): Promise<JobVerbResult> => {
  // 派生键含交付物摘要 ⇒ 同 (job,worker) 不同内容得不同键（支持「同一人多次提交」）。
  const resolvedKey = resolveJobCreateKey(
    params.createKeyRaw,
    ['submit', params.identifier, params.workerUid, digest(params.deliverable)],
  );
  if (!resolvedKey.ok) return keyError(resolvedKey.details);

  const write = await DatabaseService.submitJobWork(
    params.identifier, params.workerUid, params.deliverable, resolvedKey.key, ex,
  );
  if (!write) return gone404('job', params.identifier);

  switch (write.outcome) {
    case 'not_open':
      // 提交面**只**对 `status='open'` 放行（§4.2 J4 改造 / `R-9-99`）；借既有「非法状态转移」族码。
      return stateConflict('job.status', 'JOB_STATE_INVALID', { from: write.jobStatus, to: 'open', job_id: String(params.identifier) });
    case 'batt_below_threshold':
      // ★ S2（`R-9-99`）：`batt` 闸**落点已从报名移到提交**；机读 `reason` **逐字不变**。
      return stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD', { job_id: String(params.identifier) });
    case 'conflict':
      // 应用层先判唯一键（§3.3-4）⇒ 409 借码 `LEDGER_IDEMPOTENCY_CONFLICT`。
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { reason: 'create_key_taken', ref_id: resolvedKey.key, job_id: String(params.identifier) }, 'Idempotency conflict');
    case 'replay':
      if (write.existingDeliverable !== params.deliverable) {
        // §3.2 409：同键异指纹 ⇒ LEDGER_IDEMPOTENCY_CONFLICT
        return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { field: 'job_submission.create_key', reason: 'REPLAY_FINGERPRINT_MISMATCH', ref_id: resolvedKey.key }, 'Idempotency conflict');
      }
      break;
    case 'inserted':
      break;
    default:
      break;
  }

  const submissionId = write.submissionId;
  if (!submissionId) return gone404('job_submission', params.identifier);

  const view = await DatabaseService.getTaskProgress(submissionId, ex);
  if (!view) return gone404('job_submission', submissionId);

  return { ok: true, replay: write.outcome === 'replay', view: view as unknown as Record<string, unknown> };
};

// ---- J2 · 报名（`applyToJob`；无分录；§4.2 J2）------------------------------
// @deprecated ★ S2（`R-9-99`）：口径已取消「报名 / 选定」环节 ⇒ 本 verb **不再被新链路调用**
//   （提交面的 `batt` 前置闸已移到 `submitWork`）。函数**保留**（不删）—— 其路由
//   `POST /api/job/:jobId/apply` 的 `410` 退役归 **S3**（`R-9-103`），此处零路由改动。
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
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { reason: 'application_already_exists', ref_type: 'job_application', ref_id: String(write.applicationId ?? ''), job_id: String(params.jobId) });
    case 'batt_below_threshold':
      // ★ P9② 双闸落点 A（`R-9-18`）：电量 < 阈值 ⇒ 409（**借既有「非法状态转移」族码** · 零新增码；
      //   `reason` 稳定常量；`details` 不含表名 / SQL / 约束名 —— R107）。
      return stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD', { job_id: String(params.jobId) });
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
// @deprecated ★ S2（`R-9-99`）：口径已取消「选定」环境 ⇒ 本 verb **不再被新链路调用**
//   （逐笔发放 `R-9-101` 归 S4）。函数**保留**（不删）—— 其路由
//   `POST /api/job/:jobId/accept` 的 `410` 退役归 **S3**（`R-9-103`），此处零路由改动。
export const acceptApplication = async (params: {
  jobId: number;
  applicationId: number;
  actorUid: number;
}): Promise<JobVerbResult> => {
  const write = await DatabaseService.acceptJobApplication(params.jobId, params.applicationId, params.actorUid);
  if (!write) return gone404('job_application', params.applicationId);

  switch (write.outcome) {
    case 'not_employer':
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', ref_type: 'job_application', ref_id: String(params.applicationId) });
    case 'already_accepted':
      return stateConflict('job_application.status', 'application_already_accepted', { from: write.applicationStatus, to: 'accepted', application_id: String(params.applicationId) });
    case 'app_state_invalid':
      return stateConflict('job_application.status', 'JOB_APPLICATION_STATE_INVALID', { from: write.applicationStatus, to: 'accepted', application_id: String(params.applicationId) });
    case 'job_state_invalid':
      return stateConflict('job.status', 'JOB_STATE_INVALID', { from: write.jobStatus, to: 'accepted', job_id: String(params.jobId) });
    case 'batt_below_threshold':
      // ★ P9② 双闸落点 B（`R-9-18`）· **权威扣费点**：Worker 电量 < 阈值 ⇒ 整体回滚 ⇒ 409（batt 不变）。
      return stateConflict('batt', 'BATT_BELOW_ACCEPT_THRESHOLD', { application_id: String(params.applicationId) });
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
      worker_batt_after: write.workerBattAfter,
    },
  };
};
