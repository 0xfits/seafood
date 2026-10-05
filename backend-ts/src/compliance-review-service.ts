// ============================================================================
// src/compliance-review-service.ts — 批 8⑤ · 合规审核（商品 / 招工仲裁）（变体 Ⅱ = 旁路台账型）
// ============================================================================
// 依据（唯一权威 · 已冻结）：
//   · `docs/route-layer.spec.md` **v2.10 §25**（读口 / 动作口 / 注册点 71→75 / 权限键 / 归属闸 / 后台页）
//   · `docs/data-layer.spec.md` **v0.17 §28**（状态机映射 / 载体 / 留痕 / 迁移内容契约 `0026`/`0027`）
// 硬边界（本文件自证）：
//   · **零新增错误码**（33 码闭集不动）：资源不存在 ⇒ 借既有 `LEDGER_REF_NOT_FOUND`（404）；
//     非法状态 ⇒ 借既有 `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`（409）+ `reason =
//     LISTING_STATE_INVALID` / `JOB_STATE_INVALID`；入参形状 ⇒ 借既有 `LEDGER_AMOUNT_INVALID`（400）。
//     **零新增 reason 常量**（reason 字面 = 姊妹册 §25.3(b)#6 逐字给定）。
//   · **不实现退还 / 罚没 / `delist` 面**（`R-8-17` / `DL67` / `DL88` 仍有效）：商品轴**零账本分录**
//     （`DL59`）；招工仲裁面**只**走既有 `job_post_event(op='settle'|'refund')`（资金腿由 DB 侧派生）。
//   · **状态迁移一律走既有已白名单边**（`R-8-23③`）：商品 `listed→{delisted,frozen}`（`0015:83-93`）；
//     招工 `submitted→disputed→settled` / `disputed→cancelled`（`0013:60-70`）。**不新增状态值**。
//   · 主仓 `index.ts` / `database.ts` 唯一写者 = 本单；本文件只**读**它们。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr, type JobVerbResult as VerbResult } from './job-service';
import { ledgerErrorFromDbError, normalizeLedgerError } from './ledger';
import { errorMessageOf } from './ledger-errors';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr, VerbResult };

/** 动作闭集（§25.3：审核 / 仲裁决定，恰 2 值；**缺失 / 非枚举 ⇒ 400，不得静默取默认决定**）。 */
export const REVIEW_ACTIONS = ['approve', 'reject'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** 动作 → 台账 `result`（§28.6(c) 值域；逐字取 `0025:54` 的 `approved`/`rejected` 两值）。 */
export const REVIEW_ACTION_TO_RESULT: Record<ReviewAction, 'approved' | 'rejected'> = {
  approve: 'approved',
  reject: 'rejected',
};

/** `listing.status` 四值闭集（只读引用；§28.2(a) 逐字 —— 不得增删）。 */
export const LISTING_STATUS_VALUES = ['draft', 'listed', 'delisted', 'frozen'] as const;

/** `job.status` 七值闭集（只读引用；§28.2(b) 逐字 —— 不得增删）。 */
export const JOB_STATUS_VALUES = ['open', 'accepted', 'submitted', 'settled', 'disputed', 'rejected', 'cancelled'] as const;

/** 商品 `takedown` 通过时的**目标状态闭集**（§28.2(d)：`listed→delisted`（下架）/ `listed→frozen`（合规冻结））。 */
export const LISTING_TAKEDOWN_TARGETS = ['delisted', 'frozen'] as const;
export type ListingTakedownTarget = (typeof LISTING_TAKEDOWN_TARGETS)[number];

/** 招工仲裁通过 / 驳回的**目标状态**（§28.2(d) / §25.6(d)：approve ⇒ settled（支持雇主）；reject ⇒ cancelled（退单））。 */
export const JOB_ARBITRATE_ACTION_TO_TARGET: Record<ReviewAction, 'settled' | 'cancelled'> = {
  approve: 'settled',
  reject: 'cancelled',
};

/** 商品动作口的 `ops:` 幂等键 action 词（§25.2：`<资源 listing>_<动作 takedown>`）。 */
export const LISTING_TAKEDOWN_OPS_ACTION = 'listing_takedown';

/** 招工仲裁动作口的 `ops:` 幂等键 action 词（§25.2 · **既有逐字** = `data-layer.spec.md:509`）。 */
export const JOB_ARBITRATE_OPS_ACTION = 'job_arbitrate';

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状；与 currency-review-service 同族）------
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

/** §3.1 detail-miss：资源不存在 ⇒ 404 既有码（含非数字 / `<=0`）。 */
export const listing404 = (listingId: string): VerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: 'listing', ref_id: listingId || 'null', reason: 'listing_not_found' }, 'Referenced object not found');

export const job404 = (jobId: string): VerbErr =>
  fail(404, 'LEDGER_REF_NOT_FOUND', { ref_type: 'job', ref_id: jobId || 'null', reason: 'job_not_found' }, 'Referenced object not found');

/** §28.5：审批时资源非「可审」态 ⇒ 借既有 `LD011`（409）+ 稳定常量 reason。 */
export const listingStateConflict = (extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
    field: 'listing.status', reason: 'LISTING_STATE_INVALID', required_from: 'listed', ...extra,
  }, 'Business state transition rejected');

export const jobStateConflict = (extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
    field: 'job.status', reason: 'JOB_STATE_INVALID', required_from: 'submitted|disputed', ...extra,
  }, 'Business state transition rejected');

/** §25.3(b)#3#4：入参形状非法 ⇒ 400（既有参数形状码，靠 `details.field` / `details.reason` 区分）。 */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §3.3-4：账本抛出的命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE）。 */
const fromLedgerError = (e: unknown, key: string): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, key);
  if (mapped) return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>);
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>);
};

// ---- 请求指纹（DL96：business 字段集合的 sha256；具体拼接式 = 本单现取落此处）----
export const listingTakedownFingerprint = (listingId: number, action: ReviewAction, target: string, reason: string): string =>
  createHash('sha256').update(['listing_takedown', String(listingId), action, target, reason].join('|')).digest('hex');

export const jobArbitrateFingerprint = (jobId: number, action: ReviewAction, reason: string): string =>
  createHash('sha256').update(['job_arbitrate', String(jobId), action, reason].join('|')).digest('hex');

// ============================================================================
// 入参形状解析（纯函数 · 离线可判负 · 零 DB）—— §25.3 的 ≥6 条非法入参面
// ============================================================================
const parseIdShape = (raw: unknown): { ok: true; value: number } | { ok: false; text: string } => {
  const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '');
  if (!/^\d+$/.test(text)) return { ok: false, text };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false, text };
  return { ok: true, value };
};

const parseAction = (body: Record<string, unknown>): { ok: true; action: ReviewAction } | { ok: false; err: VerbErr } => {
  const raw = body.action;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, err: shapeError('action', 'REQUIRED', { allowed: [...REVIEW_ACTIONS] }) };
  if (!(REVIEW_ACTIONS as readonly string[]).includes(text)) {
    return { ok: false, err: shapeError('action', 'NOT_IN_CLOSED_SET', { provided: text, allowed: [...REVIEW_ACTIONS] }) };
  }
  return { ok: true, action: text as ReviewAction };
};

// ---- 商品 takedown 入参 ----
export type ParsedTakedown =
  | { ok: true; listingId: number; action: ReviewAction; result: 'approved' | 'rejected'; targetStatus: ListingTakedownTarget; reason: string; fingerprint: string }
  | { ok: false; err: VerbErr };

/**
 * 解析并校验商品 takedown 入参（**不触库**）：
 *   ① `:listingId` 非数字 / `<=0` ⇒ 404（**不得静默按 0 处理**）；
 *   ② `action` 缺失 / 非枚举 ⇒ 400（**不得静默取默认决定**）；
 *   ③ `reason` 缺失 / 空白串 ⇒ 400（**尤其驳回**）；
 *   ④ `target_status` 给出时必须在闭集 `{delisted, frozen}`（缺省 = `delisted`，即「下架」= takedown 规范动作）。
 */
export const parseTakedownInput = (params: {
  listingIdRaw: unknown;
  body: Record<string, unknown> | undefined;
}): ParsedTakedown => {
  const body = params.body || {};

  const id = parseIdShape(params.listingIdRaw);
  if (!id.ok) return { ok: false, err: listing404(id.text) };

  const act = parseAction(body);
  if (!act.ok) return { ok: false, err: act.err };
  const action = act.action;

  const reasonRaw = body.reason;
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  if (!reason) return { ok: false, err: shapeError('reason', 'REQUIRED') };

  const targetRaw = body.target_status;
  const targetText = targetRaw === undefined || targetRaw === null || String(targetRaw).trim() === ''
    ? 'delisted'
    : String(targetRaw).trim();
  if (!(LISTING_TAKEDOWN_TARGETS as readonly string[]).includes(targetText)) {
    return { ok: false, err: shapeError('target_status', 'NOT_IN_CLOSED_SET', { provided: targetText, allowed: [...LISTING_TAKEDOWN_TARGETS] }) };
  }
  const targetStatus = targetText as ListingTakedownTarget;

  return {
    ok: true,
    listingId: id.value,
    action,
    result: REVIEW_ACTION_TO_RESULT[action],
    targetStatus,
    reason,
    fingerprint: listingTakedownFingerprint(id.value, action, targetStatus, reason),
  };
};

// ---- 招工仲裁入参 ----
export type ParsedArbitration =
  | { ok: true; jobId: number; action: ReviewAction; result: 'approved' | 'rejected'; targetStatus: 'settled' | 'cancelled'; reason: string; fingerprint: string }
  | { ok: false; err: VerbErr };

/**
 * 解析并校验招工仲裁入参（**不触库**）：同 ①–③；目标状态**由 action 决定**
 * （`approve ⇒ settled`（支持雇主）/ `reject ⇒ cancelled`（退单）—— §28.2(d) 逐字）。
 * **候选人 / 标的物走 body 显式字段**（`R-8-27` I-4：路径不再加层级）；本轴无额外标的物字段。
 */
export const parseArbitrationInput = (params: {
  jobIdRaw: unknown;
  body: Record<string, unknown> | undefined;
}): ParsedArbitration => {
  const body = params.body || {};

  const id = parseIdShape(params.jobIdRaw);
  if (!id.ok) return { ok: false, err: job404(id.text) };

  const act = parseAction(body);
  if (!act.ok) return { ok: false, err: act.err };
  const action = act.action;

  const reasonRaw = body.reason;
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  if (!reason) return { ok: false, err: shapeError('reason', 'REQUIRED') };

  return {
    ok: true,
    jobId: id.value,
    action,
    result: REVIEW_ACTION_TO_RESULT[action],
    targetStatus: JOB_ARBITRATE_ACTION_TO_TARGET[action],
    reason,
    fingerprint: jobArbitrateFingerprint(id.value, action, reason),
  };
};

// ============================================================================
// 动作口 verb
// ============================================================================
/** 商品动作口 · `POST /api/admin/listing/:listingId/takedown`（§25.2 / §28.2(d)）。 */
export const reviewListingTakedownVerb = async (params: {
  listingIdRaw: unknown;
  actorUid: number;
  body: Record<string, unknown> | undefined;
  opsKey: string;
  /** 依赖注入（离线门用）；缺省 = 真 DB 语句。 */
  postEvent?: typeof DatabaseService.listingTakedownPostEvent;
}): Promise<VerbResult> => {
  const parsed = parseTakedownInput({ listingIdRaw: params.listingIdRaw, body: params.body });
  if (!parsed.ok) return parsed.err;

  const poster = params.postEvent ?? DatabaseService.listingTakedownPostEvent.bind(DatabaseService);
  let row: Record<string, unknown>;
  try {
    row = await poster({
      listingId: parsed.listingId,
      actorUid: params.actorUid,
      result: parsed.result,
      targetStatus: parsed.targetStatus,
      requestFingerprint: parsed.fingerprint,
      idempotencyKey: params.opsKey,
      memo: parsed.reason,
    });
  } catch (e) {
    return fromLedgerError(e, params.opsKey);
  }

  const found = Number(row.listing_found ?? 0);
  const priorCount = Number(row.prior_count ?? 0);
  const curStatus = row.listing_status === undefined || row.listing_status === null ? '' : String(row.listing_status);
  const applied = Number(row.applied ?? 0);
  const reviewed = Number(row.reviewed ?? 0);

  // 商品不存在 ⇒ 404（既有码 LEDGER_REF_NOT_FOUND）
  if (found !== 1) return listing404(String(parsed.listingId));

  // 幂等重放（同键同 result）⇒ 200
  if (priorCount >= 1) {
    return { ok: true, replay: true, view: { listing_id: String(parsed.listingId), status: curStatus, result: parsed.result } };
  }

  // 非法状态（非 listed ⇒ 非可审态）⇒ 409（既有码 LD011 + LISTING_STATE_INVALID）
  if (curStatus !== 'listed') {
    return listingStateConflict({ listing_id: String(parsed.listingId), from: curStatus, action: parsed.action });
  }

  // 防御：形状合法、状态合法，却未落下台账行 ⇒ 状态冲突（绝不静默成功）
  if (reviewed < 1) {
    return listingStateConflict({ listing_id: String(parsed.listingId), from: curStatus, action: parsed.action, reason_detail: 'LEDGER_ROW_NOT_WRITTEN' });
  }

  // 通过 ⇒ status 走既有边至 target（applied=1）；驳回 ⇒ 仍 listed
  const status = applied > 0 ? parsed.targetStatus : curStatus;
  return { ok: true, replay: false, view: { listing_id: String(parsed.listingId), status, result: parsed.result } };
};

/** 招工动作口 · `POST /api/admin/arbitration/:jobId`（§25.2 / §25.6(d) / §28.2(d)）。 */
export const arbitrateJobVerb = async (params: {
  jobIdRaw: unknown;
  actorUid: number;
  body: Record<string, unknown> | undefined;
  opsKey: string;
  postEvent?: typeof DatabaseService.jobArbitrationPostEvent;
}): Promise<VerbResult> => {
  const parsed = parseArbitrationInput({ jobIdRaw: params.jobIdRaw, body: params.body });
  if (!parsed.ok) return parsed.err;

  const poster = params.postEvent ?? DatabaseService.jobArbitrationPostEvent.bind(DatabaseService);
  let row: Record<string, unknown>;
  try {
    row = await poster({
      jobId: parsed.jobId,
      actorUid: params.actorUid,
      result: parsed.result,
      targetStatus: parsed.targetStatus,
      requestFingerprint: parsed.fingerprint,
      idempotencyKey: params.opsKey,
      memo: parsed.reason,
    });
  } catch (e) {
    return fromLedgerError(e, params.opsKey);
  }

  const found = Number(row.job_found ?? 0);
  const priorCount = Number(row.prior_count ?? 0);
  // ★ R-9-9①：**前置态**一律取回执的 `prior_status`（同一事务内 `FOR UPDATE` 读得 · 非第二个往返）；
  //   **严禁**用终态字段 `job_status` 做前置态判定（**投影层误读** · 与 `C-2`「投影 ≠ 真源」同族）。
  const priorStatus = row.prior_status === undefined || row.prior_status === null ? '' : String(row.prior_status);
  // 终态字段 `job_status` **仅**用于成功回执输出（动作已生效后的实际状态），**不参与**前置态判定。
  const finalStatus = row.job_status === undefined || row.job_status === null ? '' : String(row.job_status);
  const applied = Number(row.applied ?? 0);
  const reviewed = Number(row.reviewed ?? 0);
  const txid = row.txid === undefined || row.txid === null ? null : String(row.txid);

  // 招工不存在 ⇒ 404（既有码 LEDGER_REF_NOT_FOUND）
  if (found !== 1) return job404(String(parsed.jobId));

  // 幂等重放（同键同 result）⇒ 200
  if (priorCount >= 1) {
    return { ok: true, replay: true, view: { job_id: String(parsed.jobId), status: finalStatus, result: parsed.result, txid } };
  }

  // ★ 判定顺序钉死（R-9-9②）①：前置态非法（∉ {submitted, disputed}）⇒ 409（此时 `applied` 必为 0）。
  //   判据用 `priorStatus`（前置态），**不得**用 `finalStatus`（终态）。
  if (priorStatus !== 'submitted' && priorStatus !== 'disputed') {
    return jobStateConflict({ job_id: String(parsed.jobId), from: priorStatus, action: parsed.action });
  }

  // ★ R-9-9②②：`applied = 1` ⇒ 成功（回执输出用的是**终态** `finalStatus`，非判定）。
  if (applied > 0) {
    return { ok: true, replay: false, view: { job_id: String(parsed.jobId), status: finalStatus, result: parsed.result, txid } };
  }

  // ★ R-9-9②③：`applied = 0` 且 `priorStatus ∈ {submitted, disputed}` ⇒ 映射 DB 自己的拒绝原因
  //   （既有 409 码 `LD011` + 既有 reason 常量 `JOB_STATE_INVALID`；**零新增码 / 零新增 reason**）。
  //   绝不静默成功；`reviewed < 1` 即「未生效却记账」的对偶（**未生效即不落台账**）⇒ 细分 reason_detail。
  if (reviewed < 1) {
    return jobStateConflict({ job_id: String(parsed.jobId), from: priorStatus, action: parsed.action, reason_detail: 'LEDGER_ROW_NOT_WRITTEN' });
  }
  return jobStateConflict({ job_id: String(parsed.jobId), from: priorStatus, action: parsed.action });
};

// ============================================================================
// 读口 verb · `?status=` 过滤解析（§25.2；**非法值 ⇒ 400，不得静默回落**）
// ============================================================================
export type ParsedStatusFilter = { ok: true; status: string | null } | { ok: false; err: VerbErr };

const parseStatusFilterAgainst = (statusRaw: unknown, allowed: readonly string[], field: string): ParsedStatusFilter => {
  if (statusRaw === undefined || statusRaw === null || String(statusRaw).trim() === '') return { ok: true, status: null };
  const value = String(statusRaw).trim();
  if (!allowed.includes(value)) {
    return { ok: false, err: shapeError(field, 'NOT_IN_CLOSED_SET', { provided: value, allowed: [...allowed] }) };
  }
  return { ok: true, status: value };
};

/** 商品读口 `?status=<四值之一>`；缺省 / 空 ⇒ 全量（null）。 */
export const parseListingStatusFilter = (statusRaw: unknown): ParsedStatusFilter =>
  parseStatusFilterAgainst(statusRaw, LISTING_STATUS_VALUES, 'status');

/** 招工读口 `?status=<七值之一>`；缺省 / 空 ⇒ 全量（null）。 */
export const parseJobStatusFilter = (statusRaw: unknown): ParsedStatusFilter =>
  parseStatusFilterAgainst(statusRaw, JOB_STATUS_VALUES, 'status');
