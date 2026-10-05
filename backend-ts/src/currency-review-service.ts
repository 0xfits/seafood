// ============================================================================
// src/currency-review-service.ts — 批 8④ · 自建单位**审核**（变体 Ⅱ = 旁路台账型）
// ============================================================================
// 依据（唯一权威 · 已冻结）：
//   · `docs/route-layer.spec.md` **v2.8 §23.2 / §23.3 / §23.6**（读口 / 动作口 / 权限键）
//   · `docs/data-layer.spec.md` **v0.15 §26.4 / §26.5 / §26.7**（留痕 / 回滚 / 迁移内容）
// 硬边界（本文件自证）：
//   · **零新增错误码**（33 码闭集不动）：非法状态 ⇒ 借既有 `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`（409）；
//     单位不存在 ⇒ 借既有 `LD007 LEDGER_CURRENCY_NOT_FOUND`（404）；入参形状 ⇒ 借既有 `LD016`
//     `LEDGER_AMOUNT_INVALID`（400，与本仓既有「参数形状码」同族）。**零新增 reason 常量**。
//   · **不实现退还 / 罚没 / `delist` 面**（`R-8-17` / `DL67` / `DL88` 仍有效）：本文件**零账本分录**，
//     approve 走**既有** `draft → listed` 边（DB 侧单语句 CTE 同事务写 `currency_status_log`）。
//   · 主仓 `index.ts` / `database.ts` 唯一写者 = 本单；本文件只**读**它们。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr, type JobVerbResult as VerbResult } from './job-service';
import { ledgerErrorFromDbError, normalizeLedgerError } from './ledger';
import { errorMessageOf } from './ledger-errors';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr, VerbResult };

/** 动作闭集（§23.3(a) 逐字：`action ∈ {approve, reject}`，**恰 2 值**）。 */
export const CURRENCY_REVIEW_ACTIONS = ['approve', 'reject'] as const;
export type CurrencyReviewAction = (typeof CURRENCY_REVIEW_ACTIONS)[number];

/** 动作 → 台账 `result`（§26.7(c) 值域）。 */
export const CURRENCY_REVIEW_ACTION_TO_RESULT: Record<CurrencyReviewAction, 'approved' | 'rejected'> = {
  approve: 'approved',
  reject: 'rejected',
};

/** `currency.status` 四值闭集（只读引用；§26.2(a) 逐字 —— 不得增删）。 */
export const CURRENCY_STATUS_VALUES = ['draft', 'listed', 'frozen', 'delisted'] as const;

/** 动作口的 `ops:` 幂等键 action 词（§23.3(a) 逐字派生 = `<资源 currency>_<动作 review>`）。 */
export const CURRENCY_REVIEW_OPS_ACTION = 'currency_review';

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状；与 currency-service 同族）------
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

/** §26.5：币种不存在 ⇒ `LD007 LEDGER_CURRENCY_NOT_FOUND`（404；含 `cid<=0`）。 */
export const reviewCurrency404 = (cid: string): VerbErr =>
  fail(404, 'LEDGER_CURRENCY_NOT_FOUND', { cid, ref_type: 'currency', ref_id: cid || 'null' }, 'Currency not found');

/** §26.5：审批时单位非 `draft` ⇒ 借既有 `LD011`（409）。 */
export const reviewStateConflict = (extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
    field: 'currency.status', reason: 'CURRENCY_STATE_INVALID', required_from: 'draft', ...extra,
  }, 'Business state transition rejected');

/** §23.3(c)：入参形状非法 ⇒ 400（既有参数形状码，靠 `details.field` / `details.reason` 区分）。 */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §3.3-4：账本抛出的命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE）。 */
const fromLedgerError = (e: unknown, key: string): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, key);
  if (mapped) return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>);
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>);
};

/** 请求指纹（DL96：business 字段集合的 sha256；具体拼接式 = 本单现取落此处）。 */
export const reviewFingerprint = (cid: number, action: CurrencyReviewAction, reason: string): string =>
  createHash('sha256').update(['currency_review', String(cid), action, reason].join('|')).digest('hex');

// ============================================================================
// 入参形状解析（纯函数 · 离线可判负 · 零 DB）—— §23.3(c) 的 ≥6 条非法入参面
// ============================================================================
export type ParsedReview =
  | { ok: true; cid: number; action: CurrencyReviewAction; result: 'approved' | 'rejected'; reason: string; fingerprint: string }
  | { ok: false; err: VerbErr };

/**
 * 解析并校验审核动作入参（**不触库**）：
 *   ① `:cid` 非数字 / `cid <= 0` ⇒ 404 `LD007`（**不得静默按 0 处理**）；
 *   ② `action` 缺失 / 非枚举 ⇒ 400（**不得静默取默认决定**）；
 *   ③ `reason` 缺失 / 空白串 ⇒ 400（**尤其驳回** ⇒ 驳回缺 reason 不得被静默放行）。
 */
export const parseReviewInput = (params: {
  cidRaw: unknown;
  actorUid: number;
  body: Record<string, unknown> | undefined;
  opsKey: string;
}): ParsedReview => {
  const body = params.body || {};

  // ① cid 形状闸（§3.1 类② / §23.3(c)#1#2：非数字或 cid<=0 ⇒ 该单位不存在 ⇒ 404）
  const cidText = typeof params.cidRaw === 'string' ? params.cidRaw.trim() : String(params.cidRaw ?? '');
  if (!/^\d+$/.test(cidText)) return { ok: false, err: reviewCurrency404(cidText) };
  const cid = Number(cidText);
  if (!Number.isSafeInteger(cid) || cid <= 0) return { ok: false, err: reviewCurrency404(cidText) };

  // ② action 闭集（恰 2 值；缺失 / 非枚举 ⇒ 400，不得静默）
  const actionRaw = body.action;
  const actionText = typeof actionRaw === 'string' ? actionRaw.trim() : '';
  if (!actionText) return { ok: false, err: shapeError('action', 'REQUIRED', { allowed: [...CURRENCY_REVIEW_ACTIONS] }) };
  if (!(CURRENCY_REVIEW_ACTIONS as readonly string[]).includes(actionText)) {
    return { ok: false, err: shapeError('action', 'NOT_IN_CLOSED_SET', { provided: actionText, allowed: [...CURRENCY_REVIEW_ACTIONS] }) };
  }
  const action = actionText as CurrencyReviewAction;

  // ③ reason 必填 / 非空（§23.3(a)：「`reason` 必填 / 非空字符串」；驳回必须给 reason）
  const reasonRaw = body.reason;
  const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
  if (!reason) return { ok: false, err: shapeError('reason', 'REQUIRED') };

  return { ok: true, cid, action, result: CURRENCY_REVIEW_ACTION_TO_RESULT[action], reason, fingerprint: reviewFingerprint(cid, action, reason) };
};

// ============================================================================
// 动作口 verb · `POST /api/admin/currency/:cid/review`（§23.3）
// ============================================================================
export const reviewCurrencyVerb = async (params: {
  cidRaw: unknown;
  actorUid: number;
  body: Record<string, unknown> | undefined;
  opsKey: string;
  /** 依赖注入（离线门用）；缺省 = 真 DB 语句。 */
  postEvent?: typeof DatabaseService.currencyReviewPostEvent;
}): Promise<VerbResult> => {
  const parsed = parseReviewInput({ cidRaw: params.cidRaw, actorUid: params.actorUid, body: params.body, opsKey: params.opsKey });
  if (!parsed.ok) return parsed.err;

  const poster = params.postEvent ?? DatabaseService.currencyReviewPostEvent.bind(DatabaseService);
  let row: Record<string, unknown>;
  try {
    row = await poster({
      cid: parsed.cid,
      actorUid: params.actorUid,
      result: parsed.result,
      requestFingerprint: parsed.fingerprint,
      idempotencyKey: params.opsKey,
      memo: parsed.reason,
    });
  } catch (e) {
    return fromLedgerError(e, params.opsKey);
  }

  const curFound = Number(row.cur_found ?? 0);
  const priorCount = Number(row.prior_count ?? 0);
  const curStatus = row.cur_status === undefined || row.cur_status === null ? '' : String(row.cur_status);
  const applied = Number(row.applied ?? 0);
  const reviewed = Number(row.reviewed ?? 0);

  // 单位不存在 ⇒ 404（既有码 LD007）
  if (curFound !== 1) return reviewCurrency404(String(parsed.cid));

  // 幂等重放（同键同 result）⇒ 200（§23.3(a)：同键同 action 重投 = 幂等重放）
  if (priorCount >= 1) {
    return { ok: true, replay: true, view: { cid: String(parsed.cid), status: curStatus, result: parsed.result } };
  }

  // 非法状态（非 draft）⇒ 409（既有码 LD011）；无任何落值
  if (curStatus !== 'draft') {
    return reviewStateConflict({ cid: String(parsed.cid), from: curStatus, action: parsed.action });
  }

  // 防御：形状合法、状态合法，却未落下台账行 ⇒ 视为状态冲突（绝不静默成功）
  if (reviewed < 1) {
    return reviewStateConflict({ cid: String(parsed.cid), from: curStatus, action: parsed.action, reason_detail: 'LEDGER_ROW_NOT_WRITTEN' });
  }

  // 通过 ⇒ status 落 listed（applied=1）；驳回 ⇒ 仍 draft
  const status = applied > 0 ? 'listed' : curStatus;
  return { ok: true, replay: false, view: { cid: String(parsed.cid), status, result: parsed.result } };
};

// ============================================================================
// 读口 verb · `GET /api/admin/currency` 的 `?status=` 过滤解析（§23.2）
// ============================================================================
export type ParsedStatusFilter = { ok: true; status: string | null } | { ok: false; err: VerbErr };

/** `?status=<四值之一>`；缺省 / 空 ⇒ 全量（null）；**非法值 ⇒ 400**（不得静默回落）。 */
export const parseStatusFilter = (statusRaw: unknown): ParsedStatusFilter => {
  if (statusRaw === undefined || statusRaw === null || String(statusRaw).trim() === '') return { ok: true, status: null };
  const value = String(statusRaw).trim();
  if (!(CURRENCY_STATUS_VALUES as readonly string[]).includes(value)) {
    return { ok: false, err: shapeError('status', 'NOT_IN_CLOSED_SET', { provided: value, allowed: [...CURRENCY_STATUS_VALUES] }) };
  }
  return { ok: true, status: value };
};
