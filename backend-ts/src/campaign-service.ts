// ============================================================================
// src/campaign-service.ts — 活动任务体系（Campaign → Task → Subtask → Subtask Type → Proof）
// ============================================================================
// 契约真源：
//   docs/data-layer.spec.md  §40.14.1（CP-1…CP-5 五表）· §40.14.2（CP-6 状态机 / 时间窗）
//                            §40.14.3（CP-7 五类 seed）· §40.14.4（CP-8 只存不审 / 重提覆盖）
//                            §40.14.8（CP-P1…P7 prediction）· §40.14.9（CP-R1…R6 task 奖励）
//                            §40.14.7 / §40.14.8 / §40.14.9 判负（CP-N1…N10 / CP-PN1…PN4）
//   docs/route-layer.spec.md §49.18（R1–R8 八口矩阵）
//   ops/campaign/SPEC-NOTE.md
//
// Kevin 定案（本文件逐条落地）：
//   ① 层级 Campaign → Task → Subtask → Subtask Type（5 类 seed：x_verify / onchain_snapshot /
//      survey / prediction / quiz，poll 不入 seed）；Subtask Proof **提交即通过**（无审核态）。
//   ② Task 奖励 = **额外完成奖**：全部 subtask 完成后发、一般延后（先手动）；
//      `reward_amount_primary`（$ 必填）＋ 可选次币 `reward_cid_secondary` / `reward_amount_secondary`（成对）。
//   ③ Subtask 奖励**锁 $**、即时发放，**与 task 预算零扣减**（CP-R4 / CP-N10）。
//   ④ prediction：**选项恒 Yes / No**（选项文案由前端 i18n 固定，payload 不再存选项文案）
//      ⇒ 新 payload = 恰两键 {prize_amount($), deadline}；用户 `{choice:'yes'|'no'}`
//      一人一票（重提 409）；截止后管理员 settle 回填 correct_option ∈ {'yes','no'} ⇒ **同一事务**分发
//      floor(prize ÷ 选对人数)，余数归平台；正确人数 0 ⇒ 整笔归平台（无预扣 ⇒ 无分录，实际留在平台收入）。
//      **存量兼容**：payload 仍是旧四键 {option_a, option_b, prize_amount, deadline} 的行，
//      读（三态）/写（proof）/结算（correct_option）一律维持 `a|b` 口径 —— 按 payload 形状分支，
//      两条路共存，**禁双开**（同一子任务的 payload 形状不可在改口里换口径）。
//   ⑤ quiz：payload 恰两键 {options:{a,b,c,d}(四键非空字符串), correct:['a'…]}（correct 1–4 个、
//      去重、均在 a–d）；`correct` **永不出公开读口**（脱敏体例同 prediction 的结算键）。
//      用户 `{answers:{picks:[…]}}`；提交时**集合相等**即答对 ⇒ **同一事务**发 `subtask.reward_amount`
//      （平台 −N → 用户 +N，借 PLATFORM_PAYOUT_KIND）；答错也落 proof（提交即通过）但零发奖；
//      同一 uid 同一子任务重提 ⇒ 409（与 prediction 一人一票同族）。
//      奖励载体 = 列 `subtask.reward_amount`（迁移 0072；quiz 必填 > 0，非 quiz 传 ⇒ 400）。
//
// 五条结构性纪律（超范围即缺陷）：
//   · **零新错误码**（33 码闭集不动）：400 借 `LEDGER_AMOUNT_INVALID` / 404 借 `LEDGER_REF_NOT_FOUND` /
//     409 借 `LEDGER_INSUFFICIENT_BALANCE` / 403 借 `AUTH_FORBIDDEN`；逐场景理由落 `details.reason`
//     （reason 字符串不进闭集，承 §49.18.3 体例）。
//   · **零新 ledger kind**（24 值闭集不动）：平台收入账户（uid = −1）出账的唯一合法 kind 是
//     `invite_first_task_reward`（0038 / ledger.ts PLATFORM_KIND_WHITELIST 的 −1 debit 白名单）⇒
//     prediction 奖池分发与 task 完成奖**均借该 kind**（语义窄化债，同族 precedent = 项目域建费借
//     `currency_create_fee`）。不得新增 kind、不得绕开 `postEvent`（D10 / DL18 单语句编排）。
//   · **prediction 回填与分发同一事务**：回填成功而分发失败 = 账实分裂 ⇒ 判负（CP-P6）。
//   · **一人一票的结构保证**：prediction 首票走 `ON CONFLICT DO NOTHING`（0 行 ⇒ 409），通用类型走
//     `ON CONFLICT DO UPDATE`（200 覆盖，last-write-wins）—— 两条方向相反，禁互抄（CP-N2 / CP-P4）。
//   · **零定时器零触发器**：prediction 的 open / deadline_reached / settled 三态全部**读时派生**
//     （`correct_option` 是否回填 ＋ `now` vs `deadline`），不新增状态列、不新增 cron。
// ============================================================================
import { createHash, randomUUID } from 'crypto';
import { readQuery, txQuery, withTransaction, type TxClient } from './db';
import { postEvent } from './ledger';
import { errorMessageOf, normalizeLedgerError } from './ledger-errors';
import { nextSnowflake } from './item-id';
import { ledgerErrorBody, sendVerbError, type VerbErr } from './verb-shape';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr };

/** 本域出口形状：`ok:true` 带 view，`ok:false` = 既有 R107 错误体（零新码） */
export type VerbOk<T> = { ok: true; view: T; replay: boolean } & Record<string, unknown>;
export type VerbResult<T> = VerbOk<T> | VerbErr;

// ============================================================================
// 常量（判据真源；改动 = 口径变更，须回写 §40.14）
// ============================================================================

/** 活动 / 任务状态三值闭集（§40.14.2 CP-6） */
export const CAMPAIGN_STATUSES = ['draft', 'active', 'ended'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
/** 合法状态迁移闭集（回退 / 跳变 / ended 后改写一律 409；同值写 = 幂等 no-op） */
export const CAMPAIGN_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['active'],
  active: ['ended'],
  ended: [],
};
/**
 * 任务（task）自己的迁移闭集（Kevin 2026-10-21 · 任务页步 3）：任务可**收回**（`active ⇒ draft`
 * = 下线），活动**不可**（`active ⇒ draft` 仍 409 `campaign_invalid_transition`）。
 * 只给 `patchTaskVerb` 用；`patchCampaignVerb` 恒用 `CAMPAIGN_STATUS_TRANSITIONS`（两表不共用，
 * 免得「任务下线」把活动状态机一起放宽）。三值闭集不动、零新错误码（仍借 409 语义）。
 */
export const TASK_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['active'],
  active: ['draft', 'ended'],
  ended: [],
};
/** Subtask Type 五类 seed 逐字（§40.14.3 CP-7；`poll` 不入） */
export const SUBTASK_TYPES = [
  { type_code: 'x_verify', label: 'X 验证', sort: 1 },
  { type_code: 'onchain_snapshot', label: '链上快照', sort: 2 },
  { type_code: 'survey', label: '问卷', sort: 3 },
  { type_code: 'prediction', label: '预测', sort: 4 },
  { type_code: 'quiz', label: '答题', sort: 5 },
] as const;
export const SUBTASK_TYPE_CODES = SUBTASK_TYPES.map((t) => t.type_code) as unknown as readonly string[];

/** Proof payload 键闭集四族（§40.14.4 CP-8）；未知键 ⇒ 400 */
export const PROOF_PAYLOAD_KEYS = ['screenshots', 'links', 'answers', 'snapshot_addr'] as const;
/** 类型 ↔ 键族映射（约定非约束；prediction 走类型级例外，见 §40.14.8 CP-P3） */
export const PROOF_KEYS_BY_TYPE: Record<string, readonly string[]> = {
  x_verify: ['screenshots', 'links'],
  onchain_snapshot: ['snapshot_addr'],
  survey: ['answers'],
  quiz: ['answers'],
  prediction: ['choice'],
};
/**
 * prediction 子任务 payload **新形状**：恰两键（选项文案由前端 i18n 恒 Yes / No ⇒ payload 不存文案）
 * —— 判据真源，改动 = 口径变更，须回写 §40.14.8。
 */
export const PREDICTION_PAYLOAD_KEYS = ['prize_amount', 'deadline'] as const;
/**
 * prediction 子任务 payload **旧形状**（存量行；迁移前落库的 option_a / option_b 两枚文案）。
 * 只读兼容用途：**新写口不再产出**，改口若把存量行改写成新形状 ⇒ 400（禁双开）。
 */
export const PREDICTION_LEGACY_PAYLOAD_KEYS = ['option_a', 'option_b', 'prize_amount', 'deadline'] as const;
/** 选项口径两值：`yes_no` = 新（Yes / No）· `ab_legacy` = 存量（a / b + option_a/option_b 文案） */
export const PREDICTION_OPTION_STYLES = ['yes_no', 'ab_legacy'] as const;
export type PredictionOptionStyle = (typeof PREDICTION_OPTION_STYLES)[number];
/** 各口径的合法 choice / correct_option 值域（settle 与 proof 共用，单一真源） */
export const PREDICTION_CHOICES: Record<PredictionOptionStyle, readonly string[]> = {
  yes_no: ['yes', 'no'],
  ab_legacy: ['a', 'b'],
};
/** quiz 子任务 payload 恰两键（0072 引入；`correct` 是**服务端密钥**，永不出公开读口） */
export const QUIZ_PAYLOAD_KEYS = ['options', 'correct'] as const;
/** quiz 四选项键闭集（顺序即展示序） */
export const QUIZ_OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;
/** quiz 正确答案键（脱敏：任何出参 payload 均剥除） */
export const QUIZ_CORRECT_KEY = 'correct';
/** quiz 奖励载体列（迁移 0072 `subtask.reward_amount`；quiz 必填 > 0、非 quiz 恒 NULL） */
export const SUBTASK_REWARD_COLUMN = 'reward_amount';
/** 结算回填键（settle 口独占写 · 零新列 · §40.14.8 CP-P2） */
export const PREDICTION_CORRECT_OPTION_KEY = 'correct_option';
/** prediction 生命周期三态（读时派生，零新列零定时器 · CP-P5） */
export const PREDICTION_STATES = ['open', 'deadline_reached', 'settled'] as const;
export type PredictionState = (typeof PREDICTION_STATES)[number];

/** `$`（平台内部积分 · currency.cid = 1 · decimals 0） */
export const USD_CID = 1;
/** 平台收入账户 uid（不真 burn · §31.5） */
export const PLATFORM_UID = -1;
/**
 * 平台出账 kind（**借码**）：24 值闭集里 −1 的 debit 白名单只有 `invite_first_task_reward`
 * （ledger.ts PLATFORM_KIND_WHITELIST / 0038 迁移）⇒ prediction 奖池与 task 完成奖共用此 kind。
 * 语义窄化债已登记（报告 §借码）；扩容新 kind ⇒ 另单（DB CHECK 重建 ＋ LEDGER_KINDS 同步）。
 */
export const PLATFORM_PAYOUT_KIND = 'invite_first_task_reward' as const;

const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'];
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const REF_PATTERN = /^\d+$/;

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const int = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const iso = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const asObject = (v: unknown): Row => {
  if (v === null || v === undefined) return {};
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : {};
    } catch {
      return {};
    }
  }
  if (typeof v === 'object' && !Array.isArray(v)) return v as Row;
  return {};
};
const isPlainObject = (v: unknown): v is Row =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

/** `:ref` / `:subtaskId` / `:taskId` 纯数字谓词（`all` / 非数字 ⇒ false ⇒ 路由落 404 而非 500 —— #60） */
export const isCampaignRef = (ref: unknown): boolean =>
  typeof ref === 'string' && REF_PATTERN.test(ref) && ref.length <= 20;

// ============================================================================
// 口径分支工具（prediction 新两键 / 存量四键 · quiz 脱敏）
// ============================================================================
/**
 * 子任务 payload 的 prediction **选项口径**（唯一判别函数：读 / 写 / 结算三处共用）：
 *   · 带 `option_a` / `option_b` 任一 ⇒ `ab_legacy`（存量四键行，choice/correct 用 a|b）；
 *   · 否则 ⇒ `yes_no`（新两键行，choice/correct 用 yes|no）。
 * 判别只看**已落库的 payload 形状**，不看请求体 ⇒ 「同一行两条路」在结构上不可能同时成立。
 */
export const predictionOptionStyle = (payload: Row): PredictionOptionStyle =>
  (Object.prototype.hasOwnProperty.call(payload, 'option_a')
    || Object.prototype.hasOwnProperty.call(payload, 'option_b')) ? 'ab_legacy' : 'yes_no';

/** 该口径下合法 choice / correct_option 值域（`'yes'|'no'` 或 `'a'|'b'`） */
export const predictionChoicesFor = (style: PredictionOptionStyle): readonly string[] =>
  PREDICTION_CHOICES[style] ?? PREDICTION_CHOICES.yes_no;

/** 值是否落在该口径值域内（越值 ⇒ false） */
export const isPredictionChoice = (style: PredictionOptionStyle, v: unknown): boolean =>
  typeof v === 'string' && predictionChoicesFor(style).includes(v);

/**
 * **公开读口脱敏**：quiz 的 `correct`（正确答案）永不出任何出参 payload ——
 * 与 prediction 的结算键同体例（服务端密钥不进读面）。其余类型原样透出（零形状变更）。
 * 入参是 `asObject(row.payload)` 的副本语义：返回**新对象**，不改库内值、不改调用方引用。
 */
export const publicSubtaskPayload = (typeCode: string, payload: Row): Row => {
  if (typeCode !== 'quiz') return payload;
  if (!Object.prototype.hasOwnProperty.call(payload, QUIZ_CORRECT_KEY)) return payload;
  const out: Row = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === QUIZ_CORRECT_KEY) continue;
    out[k] = v;
  }
  return out;
};

// ============================================================================
// 出参形状（bigint / numeric 一律字符串 —— route #60 / CP-N5）
// ============================================================================
/** 登录态附加：本人该子任务的凭证摘要（`subtask_proof` 单行投影；未登录 ⇒ 键缺省） */
export interface MyProofView {
  payload: Row;
  time_created: string | null;
}

/**
 * 登录态附加：prediction 已结算时本人的输赢。
 * `payout` **由服务端按 settle 的同一条 floor 规则算出**（`floor(prize / 赢家人数)`；输 ⇒ `'0'`）
 * ⇒ 前端**禁自算**，只展示（CP-P6 单一算式真源）。
 */
export interface MyOutcomeView {
  /** 新两键行 = `'yes'|'no'`；存量四键行 = `'a'|'b'` */
  choice: 'a' | 'b' | 'yes' | 'no';
  won: boolean;
  payout: string;
}

export interface SubtaskView {
  subtask_id: string;
  snowflake_id: string;
  task_id: string;
  type_code: string;
  type_label: string | null;
  title: string;
  content: string | null;
  payload: Row;
  sort: number;
  required: boolean;
  /** quiz 答对奖励（`$`；迁移 0072 加性列；非 quiz 恒 `null`） */
  reward_amount: string | null;
  /** 仅 prediction 类型：读时派生的生命周期态（open / deadline_reached / settled） */
  prediction_state: PredictionState | null;
  time_created: string | null;
  time_updated: string | null;
  /** **加性 · 仅登录态**：本人提交（`null` = 未提交）；匿名读口 ⇒ 键缺省（不是 `null`） */
  my_proof?: MyProofView | null;
  /** **加性 · 仅登录态 ∧ prediction ∧ settled**：本人输赢（未投票 ⇒ `null`）；匿名读口 ⇒ 键缺省 */
  my_outcome?: MyOutcomeView | null;
}

export interface TaskView {
  task_id: string;
  snowflake_id: string;
  campaign_id: string;
  title: string;
  description: string;
  status: string;
  time_start: string | null;
  time_end: string | null;
  sort: number;
  reward_amount_primary: string;
  reward_cid_secondary: string | null;
  reward_amount_secondary: string | null;
  time_created: string | null;
  time_updated: string | null;
  subtasks: SubtaskView[];
}

export interface CampaignView {
  campaign_id: string;
  snowflake_id: string;
  /** 所属项目（0068 加性；JSON 出参字符串 —— 项目页嵌套读口按它过滤） */
  project_id: string;
  title: string;
  description: string;
  status: string;
  time_start: string | null;
  time_end: string | null;
  time_created: string | null;
  time_updated: string | null;
  tasks: TaskView[];
}

export interface ProofView {
  proof_id: string;
  subtask_id: string;
  uid: string;
  payload: Row;
  /** 恒 'submitted'（单值 CHECK；零审核态 —— CP-N1） */
  status: string;
  time_created: string | null;
  time_updated: string | null;
  /** **加性 · 仅 quiz**：本次是否答对（答错亦落 proof，零发奖） */
  quiz_correct?: boolean;
  /** **加性 · 仅 quiz**：本次实发奖励（`$`；答错 / 子任务无奖励 ⇒ `'0'`） */
  reward_paid?: string;
}

/** prediction 生命周期派生（读时，零列零定时器）—— 两种口径共用：`correct_option` 落在该口径值域即 settled */
export const derivePredictionState = (payload: Row, nowMs: number = Date.now()): PredictionState => {
  const style = predictionOptionStyle(payload);
  if (isPredictionChoice(style, payload[PREDICTION_CORRECT_OPTION_KEY])) return 'settled';
  const dl = iso(payload.deadline);
  if (dl === null) return 'open';
  return nowMs >= Date.parse(dl) ? 'deadline_reached' : 'open';
};

const normalizeSubtaskRow = (row: Row): SubtaskView => {
  const typeCode = str(row.type_code);
  const payload = publicSubtaskPayload(typeCode, asObject(row.payload));
  return {
    subtask_id: str(row.subtask_id),
    snowflake_id: str(row.snowflake_id),
    task_id: str(row.task_id),
    type_code: typeCode,
    type_label: strOrNull(row.type_label),
    title: str(row.title),
    content: strOrNull(row.content),
    payload,
    sort: int(row.sort),
    required: row.required === true,
    reward_amount: strOrNull(row.reward_amount),
    prediction_state: typeCode === 'prediction' ? derivePredictionState(payload) : null,
    time_created: iso(row.time_created),
    time_updated: iso(row.time_updated),
  };
};

const normalizeTaskRow = (row: Row, subtasks: SubtaskView[] = []): TaskView => ({
  task_id: str(row.task_id),
  snowflake_id: str(row.snowflake_id),
  campaign_id: str(row.campaign_id),
  title: str(row.title),
  description: str(row.description),
  status: str(row.status),
  time_start: iso(row.time_start),
  time_end: iso(row.time_end),
  sort: int(row.sort),
  reward_amount_primary: str(row.reward_amount_primary),
  reward_cid_secondary: strOrNull(row.reward_cid_secondary),
  reward_amount_secondary: strOrNull(row.reward_amount_secondary),
  time_created: iso(row.time_created),
  time_updated: iso(row.time_updated),
  subtasks,
});

const normalizeCampaignRow = (row: Row, tasks: TaskView[] = []): CampaignView => ({
  campaign_id: str(row.campaign_id),
  snowflake_id: str(row.snowflake_id),
  project_id: str(row.project_id),
  title: str(row.title),
  description: str(row.description),
  status: str(row.status),
  time_start: iso(row.time_start),
  time_end: iso(row.time_end),
  time_created: iso(row.time_created),
  time_updated: iso(row.time_updated),
  tasks,
});

const normalizeProofRow = (row: Row): ProofView => ({
  proof_id: str(row.proof_id),
  subtask_id: str(row.subtask_id),
  uid: str(row.uid),
  payload: asObject(row.payload),
  status: str(row.status),
  time_created: iso(row.time_created),
  time_updated: iso(row.time_updated),
});

// ============================================================================
// 错误构造（零新码：全部借既有 33 码闭集 + details.reason）
// ============================================================================
const fail = (status: number, code: string, reason: string, extra: Record<string, unknown> = {}): VerbErr => ({
  ok: false,
  status,
  code,
  message: errorMessageOf(code),
  details: { reason, ...extra },
  authDomain: code.startsWith('AUTH_'),
});

/** 400：请求形状 / 值域（借 `LEDGER_AMOUNT_INVALID`） */
const badRequest = (reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', reason, extra);
/** 404：活动 / 任务 / 子任务不存在（借 `LEDGER_REF_NOT_FOUND`） */
const notFound = (reason = 'campaign_not_found'): VerbErr => fail(404, 'LEDGER_REF_NOT_FOUND', reason);
/** 409：状态 / 闸 / 一次性封板类冲突（借 `LEDGER_INSUFFICIENT_BALANCE`） */
const conflict = (reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_INSUFFICIENT_BALANCE', reason, extra);

/** 403：权限 / 身份类（借 `AUTH_FORBIDDEN`；创建口 project_owner 支与管理员支共用一出口） */
const forbidden = (reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(403, 'AUTH_FORBIDDEN', reason, extra);

/** 事务壳：生产无 `ex` ⇒ `withTransaction`；门 / 探针注入 `ex` ⇒ 复用调用方事务（零第二套写入面） */
const runInTx = async <T>(ex: TxClient | undefined, fn: (tx: TxClient) => Promise<T>): Promise<T> =>
  (ex ? fn(ex) : withTransaction(fn));

const readRows = async <R = Row>(text: string, params: unknown[], ex?: TxClient): Promise<R[]> =>
  (ex ? txQuery<R>(ex, text, params) : readQuery<R>(text, params));

// ============================================================================
// 幂等键（§4.5 前缀闭集；调用方未给 ⇒ 推导确定性键）
// ============================================================================
export const resolveCampaignIdempotencyKey = (raw: unknown): { key: string; derived: boolean } | null => {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { key: `cli:${randomUUID()}`, derived: true };
  if (text.length > 200 || CONTROL_CHARS.test(text)) return null;
  if (text.includes('#')) return null; // `#` 是台账内部派生键分隔符（R49/R50）
  if (!KEY_PREFIXES.some((p) => text.startsWith(p))) return null;
  return { key: text, derived: false };
};

const fingerprintOf = (parts: unknown[]): string =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);

// ============================================================================
// 值域工具
// ============================================================================
const POSITIVE_INT_TEXT = /^\d+$/;

const asPositiveIntText = (v: unknown): string | null => {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!POSITIVE_INT_TEXT.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? text : null;
};

const asNonNegInt = (v: unknown): number | null => {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (text === '0') return 0;
  if (!POSITIVE_INT_TEXT.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/**
 * prediction 输赢派生（**与 R8 settle 分发同一条 floor 算式** —— 单一真源，前端禁自算）。
 * 未投票 / choice 越集（按该行 payload 口径）/ 未结算 ⇒ `null`；payout 一律字符串（bigint 口径）。
 */
export const derivePredictionOutcome = (
  payload: Row,
  proof: MyProofView | null,
  winnerCount: number,
): MyOutcomeView | null => {
  if (!proof) return null;
  const style = predictionOptionStyle(payload);
  const choice = proof.payload.choice;
  if (!isPredictionChoice(style, choice)) return null;
  const correct = payload[PREDICTION_CORRECT_OPTION_KEY];
  if (!isPredictionChoice(style, correct)) return null;
  const prizeText = asPositiveIntText(payload.prize_amount);
  const prize = prizeText === null ? 0n : BigInt(prizeText);
  const winners = Number.isFinite(winnerCount) && winnerCount > 0 ? BigInt(Math.trunc(winnerCount)) : 0n;
  const perWinner = winners > 0n ? prize / winners : 0n;
  const won = choice === correct;
  return { choice: choice as MyOutcomeView['choice'], won, payout: (won ? perWinner : 0n).toString() };
};

const asTitle = (v: unknown): string | null => {
  const text = typeof v === 'string' ? v.trim() : '';
  return text && text.length <= 200 ? text : null;
};

const asTimeOrNull = (v: unknown): { value: string | null } | { err: true } => {
  if (v === null) return { value: null };
  if (typeof v !== 'string') return { err: true };
  const d = new Date(v.trim());
  if (Number.isNaN(d.getTime())) return { err: true };
  return { value: d.toISOString() };
};

const windowOk = (start: string | null, end: string | null): boolean =>
  start === null || end === null || Date.parse(end) > Date.parse(start);

// ============================================================================
// 入参校验 —— campaign（R4 / R5）
// ============================================================================
const CAMPAIGN_CREATE_KEYS = ['title', 'project_id', 'description', 'time_start', 'time_end'];
const CAMPAIGN_PATCH_KEYS = ['title', 'description', 'time_start', 'time_end', 'status'];
const CAMPAIGN_FORBIDDEN = ['status', 'snowflake_id', 'campaign_id', 'created_at', 'time_created'];

export interface CampaignPayload {
  title?: string;
  /** 创建必填（迁移 0068：campaign.project_id NOT NULL；PATCH 不可改挂 —— 不给改挂语义，未知键 400） */
  project_id?: string;
  description?: string;
  time_start?: string | null;
  time_end?: string | null;
  status?: CampaignStatus;
}

export const parseCampaignPayload = (
  body: unknown,
  mode: 'create' | 'patch',
): { payload: CampaignPayload } | { err: VerbErr } => {
  const input = isPlainObject(body) ? body : {};
  const legal = mode === 'create' ? CAMPAIGN_CREATE_KEYS : CAMPAIGN_PATCH_KEYS;
  if (mode === 'create') {
    const forbidden = CAMPAIGN_FORBIDDEN
      .filter((k) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== null && input[k] !== undefined);
    if (forbidden.length) return { err: badRequest('NOT_SUPPORTED', { field: forbidden[0], forbidden_keys: forbidden }) };
  }
  const unknown = Object.keys(input).filter((k) => !legal.includes(k));
  if (unknown.length) {
    return { err: badRequest('NOT_SUPPORTED', { field: unknown[0], unknown_keys: unknown, legal_keys: legal }) };
  }

  const out: CampaignPayload = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);

  // project_id：创建必填（页面地址归属的载体；存在性在写口事务内判，404 project_not_found）
  if (mode === 'create') {
    const pid = asPositiveIntText(input.project_id);
    if (pid === null) {
      return { err: badRequest('CAMPAIGN_PROJECT_REQUIRED', { field: 'project_id', expected: 'positive_integer (项目的 project_id 或 snowflake_id 所属行)' }) };
    }
    out.project_id = pid;
  }
  if (mode === 'create' || has('title')) {
    const title = asTitle(input.title);
    if (title === null) return { err: badRequest('CAMPAIGN_TITLE_INVALID', { field: 'title', expected: 'non_empty_string<=200' }) };
    out.title = title;
  }
  if (mode === 'create' || has('description')) {
    const desc = input.description === undefined || input.description === null ? '' : input.description;
    if (typeof desc !== 'string' || desc.length > 20000) {
      return { err: badRequest('CAMPAIGN_DESCRIPTION_INVALID', { field: 'description', expected: 'string<=20000' }) };
    }
    out.description = desc;
  }
  for (const field of ['time_start', 'time_end'] as const) {
    if (mode === 'create' || has(field)) {
      const parsed = asTimeOrNull(input[field] === undefined ? null : input[field]);
      if ('err' in parsed) return { err: badRequest('CAMPAIGN_TIME_WINDOW_INVALID', { field, expected: 'ISO-8601|null' }) };
      out[field] = parsed.value;
    }
  }
  if (has('status')) {
    const st = typeof input.status === 'string' ? input.status : '';
    if (!(CAMPAIGN_STATUSES as readonly string[]).includes(st)) {
      return { err: badRequest('CAMPAIGN_STATUS_INVALID', { field: 'status', expected: CAMPAIGN_STATUSES }) };
    }
    out.status = st as CampaignStatus;
  }
  if (windowOk(out.time_start ?? null, out.time_end ?? null) === false) {
    return { err: badRequest('CAMPAIGN_TIME_WINDOW_INVALID', { fields: ['time_start', 'time_end'], expected: 'time_end > time_start' }) };
  }
  return { payload: out };
};

// ============================================================================
// 入参校验 —— subtask payload（类型级）
// ============================================================================
/**
 * prediction 子任务 payload（**两条形状共存**，按请求体形状判别，产出一枚 `option_style` 标记）：
 *   · 新形状（默认，Kevin 2026-10-22）：**恰两键** `{prize_amount, deadline}` ⇒ `yes_no`；
 *   · 存量形状：**恰四键** `{option_a, option_b, prize_amount, deadline}` ⇒ `ab_legacy`
 *     （只有「改存量行」才可能走到；建口**拒收**，见 `parseSubtaskInput`）。
 * prize 正整数（$）、deadline 可解析、币种键与结算键一律 400（CP-PN1 / CP-P2）。
 */
export const parsePredictionPayload = (raw: unknown): {
  payload: { option_a?: string; option_b?: string; prize_amount: string; deadline: string };
  option_style: PredictionOptionStyle;
} | { err: VerbErr } => {
  if (!isPlainObject(raw)) {
    return { err: badRequest('PREDICTION_PAYLOAD_SHAPE', { expected: 'object_with_2_keys', got: Array.isArray(raw) ? 'array' : typeof raw }) };
  }
  // 币种键 ⇒ 400（CP-PN1 奖池非 $：prediction 奖池单位恒 $，不设币种键）
  const currencyKeys = ['currency', 'currency_cid', 'cid', 'prize_cid', 'unit', 'currency_symbol', PREDICTION_CORRECT_OPTION_KEY];
  const bad = Object.keys(raw).filter((k) => currencyKeys.includes(k));
  if (bad.length) {
    return { err: badRequest('PREDICTION_PRIZE_NOT_USD', { fields: bad, hint: 'prediction 奖池单位恒 $，且 correct_option 只由 settle 口写' }) };
  }
  // 形状判别：出现 option_a / option_b 任一 ⇒ 存量四键支；否则 ⇒ 新两键支
  const legacy = Object.prototype.hasOwnProperty.call(raw, 'option_a')
    || Object.prototype.hasOwnProperty.call(raw, 'option_b');
  const legal: readonly string[] = legacy ? PREDICTION_LEGACY_PAYLOAD_KEYS : PREDICTION_PAYLOAD_KEYS;
  const optionStyle: PredictionOptionStyle = legacy ? 'ab_legacy' : 'yes_no';
  const unknown = Object.keys(raw).filter((k) => !legal.includes(k));
  if (unknown.length) {
    return { err: badRequest('PREDICTION_PAYLOAD_SHAPE', { unknown_keys: unknown, legal_keys: legal, option_style: optionStyle }) };
  }
  const missing = legal.filter((k) => !Object.prototype.hasOwnProperty.call(raw, k));
  if (missing.length) {
    return { err: badRequest('PREDICTION_PAYLOAD_SHAPE', { missing_keys: missing, expected: `exactly_${legal.length}_keys`, option_style: optionStyle }) };
  }
  let a: string | undefined;
  let b: string | undefined;
  if (legacy) {
    a = typeof raw.option_a === 'string' ? raw.option_a.trim() : '';
    b = typeof raw.option_b === 'string' ? raw.option_b.trim() : '';
    if (!a || !b) {
      return { err: badRequest('PREDICTION_OPTIONS_INVALID', { expected: 'exactly_two_non_empty_options', option_a: a, option_b: b }) };
    }
  }
  const prize = asPositiveIntText(raw.prize_amount);
  if (prize === null) {
    return { err: badRequest('PREDICTION_PRIZE_INVALID', { field: 'prize_amount', expected: 'positive_integer_usd' }) };
  }
  const dl = asTimeOrNull(raw.deadline);
  if ('err' in dl || dl.value === null) {
    return { err: badRequest('PREDICTION_DEADLINE_INVALID', { field: 'deadline', expected: 'ISO-8601' }) };
  }
  return legacy
    ? { payload: { option_a: a, option_b: b, prize_amount: prize, deadline: dl.value }, option_style: 'ab_legacy' }
    : { payload: { prize_amount: prize, deadline: dl.value }, option_style: 'yes_no' };
};

/**
 * quiz 子任务 payload：**恰两键** `{options:{a,b,c,d}, correct:['a'…]}`。
 *   · options：plain object，键集**恰等于** a/b/c/d，逐值非空字符串（≤200）；
 *   · correct：数组 **1–4 个**、去重、逐值 ∈ a–d（「多选正确」是合法形态 —— 用户须全中）。
 * `reward_amount` 是**列**不是 payload 键 ⇒ 出现在 payload 内按未知键 400。
 */
export const parseQuizPayload = (raw: unknown): {
  payload: { options: Record<string, string>; correct: string[] };
} | { err: VerbErr } => {
  if (!isPlainObject(raw)) {
    return { err: badRequest('QUIZ_PAYLOAD_SHAPE', { expected: 'object_with_2_keys', got: Array.isArray(raw) ? 'array' : typeof raw }) };
  }
  const unknown = Object.keys(raw).filter((k) => !(QUIZ_PAYLOAD_KEYS as readonly string[]).includes(k));
  if (unknown.length) {
    return { err: badRequest('QUIZ_PAYLOAD_SHAPE', { unknown_keys: unknown, legal_keys: QUIZ_PAYLOAD_KEYS, hint: `${SUBTASK_REWARD_COLUMN} 是子任务列，不写进 payload` }) };
  }
  const missing = (QUIZ_PAYLOAD_KEYS as readonly string[]).filter((k) => !Object.prototype.hasOwnProperty.call(raw, k));
  if (missing.length) {
    return { err: badRequest('QUIZ_PAYLOAD_SHAPE', { missing_keys: missing, expected: 'exactly_2_keys' }) };
  }
  if (!isPlainObject(raw.options)) {
    return { err: badRequest('QUIZ_OPTIONS_INVALID', { field: 'options', expected: 'object_with_exactly_4_keys' }) };
  }
  const optKeys = Object.keys(raw.options);
  const badOpt = optKeys.filter((k) => !(QUIZ_OPTION_KEYS as readonly string[]).includes(k));
  const missOpt = (QUIZ_OPTION_KEYS as readonly string[]).filter((k) => !Object.prototype.hasOwnProperty.call(raw.options as Row, k));
  if (badOpt.length || missOpt.length) {
    return { err: badRequest('QUIZ_OPTIONS_INVALID', { field: 'options', unknown_keys: badOpt, missing_keys: missOpt, expected: QUIZ_OPTION_KEYS }) };
  }
  const options: Record<string, string> = {};
  for (const k of QUIZ_OPTION_KEYS) {
    const v = (raw.options as Row)[k];
    const text = typeof v === 'string' ? v.trim() : '';
    if (!text || text.length > 200) {
      return { err: badRequest('QUIZ_OPTIONS_INVALID', { field: `options.${k}`, expected: 'non_empty_string<=200' }) };
    }
    options[k] = text;
  }
  if (!Array.isArray(raw.correct)) {
    return { err: badRequest('QUIZ_CORRECT_INVALID', { field: 'correct', expected: 'array_of_1_to_4_option_keys' }) };
  }
  const picks = raw.correct.map((v) => (typeof v === 'string' ? v.trim() : ''));
  if (picks.length < 1 || picks.length > QUIZ_OPTION_KEYS.length) {
    return { err: badRequest('QUIZ_CORRECT_INVALID', { field: 'correct', expected: '1_to_4_picks', got_length: picks.length }) };
  }
  if (new Set(picks).size !== picks.length) {
    return { err: badRequest('QUIZ_CORRECT_INVALID', { field: 'correct', reason_hint: 'duplicates', got: picks }) };
  }
  const outOfSet = picks.filter((p) => !(QUIZ_OPTION_KEYS as readonly string[]).includes(p));
  if (outOfSet.length) {
    return { err: badRequest('QUIZ_CORRECT_INVALID', { field: 'correct', out_of_set: outOfSet, expected: QUIZ_OPTION_KEYS }) };
  }
  return { payload: { options, correct: [...picks].sort() } };
};

/** quiz 答题凭证：`{answers:{picks:[…]}}`（1–4 个、去重、∈a–d）；形状外一律 400 */
export const parseQuizProof = (raw: unknown): { picks: string[] } | { err: VerbErr } => {
  if (!isPlainObject(raw)) {
    return { err: badRequest('QUIZ_ANSWER_SHAPE', { expected: "{answers:{picks:['a'…]}}", got: Array.isArray(raw) ? 'array' : typeof raw }) };
  }
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== 'answers' || !isPlainObject(raw.answers)) {
    return { err: badRequest('QUIZ_ANSWER_SHAPE', { expected: "{answers:{picks:['a'…]}}", got_keys: keys }) };
  }
  const inner = Object.keys(raw.answers as Row);
  if (inner.length !== 1 || inner[0] !== 'picks' || !Array.isArray((raw.answers as Row).picks)) {
    return { err: badRequest('QUIZ_ANSWER_SHAPE', { expected: '{picks:[…]}', got_keys: inner }) };
  }
  const picks = ((raw.answers as Row).picks as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : ''));
  if (picks.length < 1 || picks.length > QUIZ_OPTION_KEYS.length) {
    return { err: badRequest('QUIZ_ANSWER_SHAPE', { field: 'picks', expected: '1_to_4_picks', got_length: picks.length }) };
  }
  if (new Set(picks).size !== picks.length) {
    return { err: badRequest('QUIZ_ANSWER_SHAPE', { field: 'picks', reason_hint: 'duplicates', got: picks }) };
  }
  const outOfSet = picks.filter((p) => !(QUIZ_OPTION_KEYS as readonly string[]).includes(p));
  if (outOfSet.length) {
    return { err: badRequest('QUIZ_ANSWER_SHAPE', { field: 'picks', out_of_set: outOfSet, expected: QUIZ_OPTION_KEYS }) };
  }
  return { picks: [...picks].sort() };
};

/** 集合相等（quiz 判分唯一判据：与顺序无关、与重复无关 —— 入参已去重排序） */
export const samePickSet = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length || a.length === 0) return false;
  const sa = new Set(a);
  if (sa.size !== b.length) return false;
  return b.every((x) => sa.has(x));
};

const isStringArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim().length > 0);

/** 通用四类 proof / subtask payload：闭集四键 ＋ 类型↔键族（§40.14.4 CP-8） */
export const parseTypedPayload = (typeCode: string, raw: unknown, scope: 'subtask' | 'proof'): { payload: Row } | { err: VerbErr } => {
  const reasonPrefix = scope === 'proof' ? 'PROOF_PAYLOAD' : 'SUBTASK_PAYLOAD';
  if (!isPlainObject(raw)) {
    return { err: badRequest(`${reasonPrefix}_SHAPE`, { expected: 'object', got: Array.isArray(raw) ? 'array' : typeof raw }) };
  }
  const allowed = PROOF_KEYS_BY_TYPE[typeCode];
  if (!allowed) {
    return { err: badRequest('PROOF_TYPE_UNKNOWN', { type_code: typeCode, legal_types: SUBTASK_TYPE_CODES }) };
  }
  const unknown = Object.keys(raw).filter((k) => !(PROOF_PAYLOAD_KEYS as readonly string[]).includes(k));
  if (unknown.length) {
    return { err: badRequest(`${reasonPrefix}_UNKNOWN_KEY`, { unknown_keys: unknown, legal_keys: PROOF_PAYLOAD_KEYS }) };
  }
  // 类型↔键族是约定：出现别的族键 ⇒ 400（防 payload 垃圾进库）
  const foreign = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (foreign.length) {
    return { err: badRequest(`${reasonPrefix}_TYPE_MISMATCH`, { type_code: typeCode, allowed_keys: allowed, offending: foreign }) };
  }

  const out: Row = {};
  if (Object.prototype.hasOwnProperty.call(raw, 'screenshots')) {
    if (!isStringArray(raw.screenshots)) {
      return { err: badRequest(`${reasonPrefix}_SHAPE`, { field: 'screenshots', expected: 'string[]' }) };
    }
    out.screenshots = raw.screenshots as string[];
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'links')) {
    if (!isStringArray(raw.links) || !(raw.links as string[]).every((u) => /^https?:\/\//i.test(u.trim()))) {
      return { err: badRequest(`${reasonPrefix}_SHAPE`, { field: 'links', expected: 'http(s)_url[]' }) };
    }
    out.links = raw.links as string[];
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'snapshot_addr')) {
    const addr = typeof raw.snapshot_addr === 'string' ? raw.snapshot_addr.trim() : '';
    if (!addr || addr.length > 200) {
      return { err: badRequest(`${reasonPrefix}_SHAPE`, { field: 'snapshot_addr', expected: 'non_empty_string<=200' }) };
    }
    out.snapshot_addr = addr;
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'answers')) {
    if (!isPlainObject(raw.answers)) {
      return { err: badRequest(`${reasonPrefix}_SHAPE`, { field: 'answers', expected: 'object' }) };
    }
    out.answers = raw.answers as Row;
  }
  if (scope === 'proof' && Object.keys(out).length === 0) {
    return { err: badRequest('PROOF_PAYLOAD_SHAPE', { expected: `at_least_one_key_of:${allowed.join('|')}` }) };
  }
  return { payload: out };
};

/**
 * prediction 投票凭证：单键 `{choice}`（CP-P3）。**值域由该行 payload 口径决定**：
 *   · `yes_no`（新两键行）⇒ `'yes'|'no'`；· `ab_legacy`（存量四键行）⇒ `'a'|'b'`。
 * 越值 / 多键 / 缺键 ⇒ 400（零新码，理由落 details.reason）。
 */
export const parsePredictionChoice = (raw: unknown, style: PredictionOptionStyle): { choice: string } | { err: VerbErr } => {
  const legal = predictionChoicesFor(style);
  const expected = `{choice:'${legal.join("'|'")}'}`;
  if (!isPlainObject(raw)) {
    return { err: badRequest('PREDICTION_CHOICE_SHAPE', { expected, got: Array.isArray(raw) ? 'array' : typeof raw }) };
  }
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== 'choice') {
    return { err: badRequest('PREDICTION_CHOICE_SHAPE', { expected, got_keys: keys }) };
  }
  const choice = raw.choice;
  if (!isPredictionChoice(style, choice)) {
    return { err: badRequest('PREDICTION_CHOICE_SHAPE', { field: 'choice', expected, got: typeof choice === 'string' ? choice : null }) };
  }
  return { choice: choice as string };
};

// ============================================================================
// 入参校验 —— task（R6 / R7）＋ 内联 subtasks[]（整组 upsert，永不 DELETE）
// ============================================================================
const TASK_CREATE_KEYS = [
  'title', 'description', 'time_start', 'time_end', 'sort',
  'reward_amount_primary', 'reward_cid_secondary', 'reward_amount_secondary', 'subtasks',
];
const TASK_PATCH_KEYS = [...TASK_CREATE_KEYS, 'status'];
const TASK_FORBIDDEN = ['snowflake_id', 'task_id', 'campaign_id', 'time_created', 'time_updated'];

export interface SubtaskInput {
  subtask_id?: string;
  snowflake_id?: string;
  type_code: string;
  title: string;
  content: string | null;
  payload: Row;
  /** quiz 答对奖励（`$`；quiz 必填 > 0，其余类型恒 null —— 0072 列） */
  reward_amount: string | null;
  /** **仅 prediction**：payload 口径标记（`yes_no` 新两键 / `ab_legacy` 存量四键；写口据此禁双开） */
  option_style?: PredictionOptionStyle;
  sort: number;
  required: boolean;
}

export interface TaskPayload {
  title?: string;
  description?: string;
  time_start?: string | null;
  time_end?: string | null;
  sort?: number;
  status?: CampaignStatus;
  reward_amount_primary?: string;
  reward_cid_secondary?: string | null;
  reward_amount_secondary?: string | null;
  subtasks?: SubtaskInput[];
}

const parseSubtaskInput = (raw: unknown, index: number): { input: SubtaskInput } | { err: VerbErr } => {
  if (!isPlainObject(raw)) {
    return { err: badRequest('SUBTASK_INPUT_INVALID', { index, expected: 'object' }) };
  }
  const legal = ['subtask_id', 'snowflake_id', 'type_code', 'title', 'content', 'payload', 'sort', 'required', 'reward_amount'];
  const unknown = Object.keys(raw).filter((k) => !legal.includes(k));
  if (unknown.length) return { err: badRequest('SUBTASK_INPUT_INVALID', { index, unknown_keys: unknown, legal_keys: legal }) };

  const typeCode = typeof raw.type_code === 'string' ? raw.type_code : '';
  if (!SUBTASK_TYPE_CODES.includes(typeCode)) {
    return { err: badRequest('SUBTASK_TYPE_INVALID', { index, field: 'type_code', expected: SUBTASK_TYPE_CODES }) };
  }
  const title = asTitle(raw.title);
  if (title === null) return { err: badRequest('SUBTASK_INPUT_INVALID', { index, field: 'title', expected: 'non_empty_string<=200' }) };

  const contentRaw = raw.content === undefined || raw.content === null ? null : raw.content;
  if (contentRaw !== null && (typeof contentRaw !== 'string' || contentRaw.length > 20000)) {
    return { err: badRequest('SUBTASK_INPUT_INVALID', { index, field: 'content', expected: 'string<=20000|null' }) };
  }
  const sort = raw.sort === undefined ? 0 : asNonNegInt(raw.sort);
  if (sort === null) return { err: badRequest('SUBTASK_INPUT_INVALID', { index, field: 'sort', expected: 'non_negative_integer' }) };
  if (raw.required !== undefined && typeof raw.required !== 'boolean') {
    return { err: badRequest('SUBTASK_INPUT_INVALID', { index, field: 'required', expected: 'boolean' }) };
  }

  // payload 按类型分派：prediction 两形状（带口径标记）· quiz 四选项+正确答案 · 其余四类闭集键族
  const rawPayload = raw.payload === undefined ? {} : raw.payload;
  let payload: Row;
  let optionStyle: PredictionOptionStyle | null = null;
  if (typeCode === 'prediction') {
    const parsed = parsePredictionPayload(rawPayload);
    if ('err' in parsed) return { err: parsed.err };
    payload = parsed.payload as Row;
    optionStyle = parsed.option_style;
  } else if (typeCode === 'quiz') {
    const parsed = parseQuizPayload(rawPayload);
    if ('err' in parsed) return { err: parsed.err };
    payload = parsed.payload as Row;
  } else {
    const parsed = parseTypedPayload(typeCode, rawPayload, 'subtask');
    if ('err' in parsed) return { err: parsed.err };
    payload = parsed.payload as Row;
  }

  // 奖励列：**quiz 必填 > 0**（答对即发）；非 quiz 传了 ⇒ 400（奖励载体只服务 quiz）
  const rewardGiven = Object.prototype.hasOwnProperty.call(raw, 'reward_amount')
    && raw.reward_amount !== null && raw.reward_amount !== undefined && raw.reward_amount !== '';
  let rewardAmount: string | null = null;
  if (typeCode === 'quiz') {
    if (!rewardGiven) {
      return { err: badRequest('QUIZ_REWARD_REQUIRED', { index, field: 'reward_amount', expected: 'positive_integer_usd', hint: 'quiz 答对即发奖 ⇒ 奖励必填且 > 0' }) };
    }
    const reward = asPositiveIntText(raw.reward_amount);
    if (reward === null) {
      return { err: badRequest('QUIZ_REWARD_INVALID', { index, field: 'reward_amount', expected: 'positive_integer_usd' }) };
    }
    rewardAmount = reward;
  } else if (rewardGiven) {
    return { err: badRequest('SUBTASK_REWARD_NOT_APPLICABLE', { index, field: 'reward_amount', type_code: typeCode, hint: 'reward_amount 只服务 quiz' }) };
  }

  const out: SubtaskInput = {
    type_code: typeCode,
    title,
    content: contentRaw as string | null,
    payload,
    reward_amount: rewardAmount,
    sort,
    required: raw.required === true,
  };
  if (optionStyle !== null) out.option_style = optionStyle;
  for (const key of ['subtask_id', 'snowflake_id'] as const) {
    if (raw[key] !== undefined && raw[key] !== null) {
      const v = asPositiveIntText(raw[key]);
      if (v === null) return { err: badRequest('SUBTASK_INPUT_INVALID', { index, field: key, expected: 'positive_integer' }) };
      out[key] = v;
    }
  }
  return { input: out };
};

export const parseTaskPayload = (
  body: unknown,
  mode: 'create' | 'patch',
): { payload: TaskPayload } | { err: VerbErr } => {
  const input = isPlainObject(body) ? body : {};
  if (mode === 'create') {
    const forbidden = TASK_FORBIDDEN
      .filter((k) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== null && input[k] !== undefined);
    if (forbidden.length) return { err: badRequest('NOT_SUPPORTED', { field: forbidden[0], forbidden_keys: forbidden }) };
  }
  const legal = mode === 'create' ? TASK_CREATE_KEYS : TASK_PATCH_KEYS;
  const unknown = Object.keys(input).filter((k) => !legal.includes(k));
  if (unknown.length) {
    return { err: badRequest('NOT_SUPPORTED', { field: unknown[0], unknown_keys: unknown, legal_keys: legal }) };
  }

  const out: TaskPayload = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);

  if (mode === 'create' || has('title')) {
    const title = asTitle(input.title);
    if (title === null) return { err: badRequest('TASK_TITLE_INVALID', { field: 'title', expected: 'non_empty_string<=200' }) };
    out.title = title;
  }
  if (mode === 'create' || has('description')) {
    const desc = input.description === undefined || input.description === null ? '' : input.description;
    if (typeof desc !== 'string' || desc.length > 20000) {
      return { err: badRequest('TASK_DESCRIPTION_INVALID', { field: 'description', expected: 'string<=20000' }) };
    }
    out.description = desc;
  }
  for (const field of ['time_start', 'time_end'] as const) {
    if (mode === 'create' || has(field)) {
      const parsed = asTimeOrNull(input[field] === undefined ? null : input[field]);
      if ('err' in parsed) return { err: badRequest('TASK_TIME_WINDOW_INVALID', { field, expected: 'ISO-8601|null' }) };
      out[field] = parsed.value;
    }
  }
  if (mode === 'create' || has('sort')) {
    const sort = input.sort === undefined ? 0 : asNonNegInt(input.sort);
    if (sort === null) return { err: badRequest('TASK_SORT_INVALID', { field: 'sort', expected: 'non_negative_integer' }) };
    out.sort = sort;
  }
  if (has('status')) {
    const st = typeof input.status === 'string' ? input.status : '';
    if (!(CAMPAIGN_STATUSES as readonly string[]).includes(st)) {
      return { err: badRequest('TASK_STATUS_INVALID', { field: 'status', expected: CAMPAIGN_STATUSES }) };
    }
    out.status = st as CampaignStatus;
  }
  if (windowOk(out.time_start ?? null, out.time_end ?? null) === false) {
    return { err: badRequest('TASK_TIME_WINDOW_INVALID', { fields: ['time_start', 'time_end'], expected: 'time_end > time_start' }) };
  }

  // 奖励：主 $ 必填（create）· 次币成对 · 次币 ≠ $（cid 1）—— §40.14.9 CP-R1/R2
  if (mode === 'create' || has('reward_amount_primary')) {
    const primary = asPositiveIntText(input.reward_amount_primary);
    if (primary === null) {
      return { err: badRequest('TASK_REWARD_PRIMARY_INVALID', { field: 'reward_amount_primary', expected: 'positive_integer_usd' }) };
    }
    out.reward_amount_primary = primary;
  }
  const cidGiven = has('reward_cid_secondary');
  const amountGiven = has('reward_amount_secondary');
  const cidNull = input.reward_cid_secondary === null || input.reward_cid_secondary === undefined || input.reward_cid_secondary === '';
  const amountNull = input.reward_amount_secondary === null || input.reward_amount_secondary === undefined || input.reward_amount_secondary === '';
  if (cidNull !== amountNull) {
    return {
      err: badRequest('TASK_REWARD_SECONDARY_PAIR_REQUIRED', {
        fields: ['reward_cid_secondary', 'reward_amount_secondary'],
        hint: '次币 cid 与金额必须同空同非空（CP-R2 / CP-N9）',
      }),
    };
  }
  if ((cidGiven || amountGiven) && !(cidNull && amountNull)) {
    const cid = asPositiveIntText(input.reward_cid_secondary);
    if (cid === null || Number(cid) === USD_CID) {
      return { err: badRequest('TASK_REWARD_SECONDARY_CID_INVALID', { field: 'reward_cid_secondary', expected: `positive_integer_not_${USD_CID}`, hint: 'CP-N8 两币同币' }) };
    }
    const amount = asPositiveIntText(input.reward_amount_secondary);
    if (amount === null) {
      return { err: badRequest('TASK_REWARD_SECONDARY_AMOUNT_INVALID', { field: 'reward_amount_secondary', expected: 'positive_number' }) };
    }
    out.reward_cid_secondary = cid;
    out.reward_amount_secondary = amount;
  } else if (cidGiven || amountGiven) {
    out.reward_cid_secondary = null;
    out.reward_amount_secondary = null;
  }

  if (has('subtasks')) {
    if (!Array.isArray(input.subtasks)) {
      return { err: badRequest('SUBTASK_INPUT_INVALID', { field: 'subtasks', expected: 'array' }) };
    }
    const items: SubtaskInput[] = [];
    for (let i = 0; i < input.subtasks.length; i += 1) {
      const parsed = parseSubtaskInput((input.subtasks as unknown[])[i], i);
      if ('err' in parsed) return { err: parsed.err };
      // 建口只收新口径（选项恒 Yes/No）；四键旧形状仅服务「存量行改口」⇒ 建口带四键 = 400（禁双开）
      if (mode === 'create' && parsed.input.option_style === 'ab_legacy') {
        return {
          err: badRequest('PREDICTION_PAYLOAD_SHAPE', {
            index: i,
            expected: 'exactly_2_keys',
            got_option_style: 'ab_legacy',
            hint: 'prediction 选项恒 Yes / No ⇒ 建口 payload = {prize_amount, deadline}',
          }),
        };
      }
      items.push(parsed.input);
    }
    out.subtasks = items;
  }
  return { payload: out };
};

// ============================================================================
// 读口 —— 公开列表（R1：仅 active 活动 · 嵌套 active 任务 · 全量子任务）
// ============================================================================
const SUBTASK_SELECT = `
  SELECT s.*, st.label AS type_label
    FROM public.subtask AS s
    JOIN public.subtask_type AS st ON st.type_code = s.type_code`;

const groupSubtasks = (rows: Row[]): Map<string, SubtaskView[]> => {
  const map = new Map<string, SubtaskView[]>();
  for (const row of rows) {
    const key = str(row.task_id);
    const list = map.get(key) ?? [];
    list.push(normalizeSubtaskRow(row));
    map.set(key, list);
  }
  return map;
};

const groupTasks = (rows: Row[], subtasks: Map<string, SubtaskView[]>): Map<string, TaskView[]> => {
  const map = new Map<string, TaskView[]>();
  for (const row of rows) {
    const key = str(row.campaign_id);
    const list = map.get(key) ?? [];
    list.push(normalizeTaskRow(row, subtasks.get(str(row.task_id)) ?? []));
    map.set(key, list);
  }
  return map;
};

/** R1 公开列表：`status='active'` 活动 → 仅 active 任务 → 全量子任务（无分页；sort ASC, id ASC 全序） */
export const listActiveCampaigns = async (ex?: TxClient): Promise<CampaignView[]> => {
  const campaigns = await readRows<Row>(
    `SELECT * FROM public.campaign WHERE status = 'active'
      ORDER BY time_created DESC, campaign_id DESC`,
    [],
    ex,
  );
  if (!campaigns.length) return [];
  const campaignIds = campaigns.map((c) => str(c.campaign_id));
  const tasks = await readRows<Row>(
    `SELECT * FROM public.task
      WHERE campaign_id = ANY($1::bigint[]) AND status = 'active'
      ORDER BY sort ASC, task_id ASC`,
    [campaignIds],
    ex,
  );
  const taskIds = tasks.map((t) => str(t.task_id));
  const subtasks = taskIds.length
    ? await readRows<Row>(
      `${SUBTASK_SELECT} WHERE s.task_id = ANY($1::bigint[]) ORDER BY s.sort ASC, s.subtask_id ASC`,
      [taskIds],
      ex,
    )
    : [];
  const subtaskMap = groupSubtasks(subtasks);
  const taskMap = groupTasks(tasks, subtaskMap);
  return campaigns.map((c) => normalizeCampaignRow(c, taskMap.get(str(c.campaign_id)) ?? []));
};

/**
 * R2 嵌套读口的项目过滤版（迁移 0068 · 零新路由）：`GET /api/project/:ref` 的加性 `campaigns[]` 用。
 * 归属链 = `campaign.project_id = 项目`；公开面 = campaign active ∧ task 非 draft（与 `getCampaignByRef`
 * 逐字同口径）；`includeDraft`（manage_tasks 管理员 / 项目 owner）= 全量 campaign + 全量 task。
 */
export const listCampaignsByProject = async (
  projectId: string,
  opts: { includeDraft: boolean },
  ex?: TxClient,
): Promise<CampaignView[]> => {
  const campaigns = await readRows<Row>(
    opts.includeDraft
      ? `SELECT * FROM public.campaign WHERE project_id = $1::bigint
          ORDER BY time_created DESC, campaign_id DESC`
      : `SELECT * FROM public.campaign WHERE project_id = $1::bigint AND status = 'active'
          ORDER BY time_created DESC, campaign_id DESC`,
    [projectId],
    ex,
  );
  if (!campaigns.length) return [];
  const campaignIds = campaigns.map((c) => str(c.campaign_id));
  const tasks = await readRows<Row>(
    opts.includeDraft
      ? `SELECT * FROM public.task WHERE campaign_id = ANY($1::bigint[]) ORDER BY sort ASC, task_id ASC`
      : `SELECT * FROM public.task WHERE campaign_id = ANY($1::bigint[]) AND status <> 'draft' ORDER BY sort ASC, task_id ASC`,
    [campaignIds],
    ex,
  );
  const taskIds = tasks.map((t) => str(t.task_id));
  const subtasks = taskIds.length
    ? await readRows<Row>(
      `${SUBTASK_SELECT} WHERE s.task_id = ANY($1::bigint[]) ORDER BY s.sort ASC, s.subtask_id ASC`,
      [taskIds],
      ex,
    )
    : [];
  const subtaskMap = groupSubtasks(subtasks);
  const taskMap = groupTasks(tasks, subtaskMap);
  return campaigns.map((c) => normalizeCampaignRow(c, taskMap.get(str(c.campaign_id)) ?? []));
};

/**
 * 登录态附加块（加性 —— 零新路由 / 零新表 / 零新查询面：两次只读、一次往返一层）：
 * ① 本人在本活动全部子任务上的凭证（`(subtask_id, uid)` 唯一 ⇒ 每子任务至多一行）；
 * ② 已结算 prediction 的赢家人数（与 settle 同口径：`proof.payload.choice = subtask.payload.correct_option`）。
 * 未登录（`viewerUid` 缺省）⇒ 本函数不调用 ⇒ `my_proof` / `my_outcome` 两键**均缺省**。
 */
const attachViewerContext = async (view: CampaignView, viewerUid: number, ex?: TxClient): Promise<void> => {
  const subtasks = view.tasks.flatMap((t) => t.subtasks);
  if (!subtasks.length) return;

  const proofRows = await readRows<Row>(
    `SELECT subtask_id::text AS subtask_id, payload, time_created
       FROM public.subtask_proof
      WHERE uid = $1::bigint AND subtask_id = ANY($2::bigint[])`,
    [String(viewerUid), subtasks.map((s) => s.subtask_id)],
    ex,
  );
  const mine = new Map<string, MyProofView>();
  for (const row of proofRows) {
    mine.set(str(row.subtask_id), { payload: asObject(row.payload), time_created: iso(row.time_created) });
  }

  const settledIds = subtasks
    .filter((s) => s.type_code === 'prediction' && s.prediction_state === 'settled')
    .map((s) => s.subtask_id);
  const winnerCounts = new Map<string, number>();
  if (settledIds.length) {
    const counted = await readRows<Row>(
      `SELECT p.subtask_id::text AS subtask_id, count(*)::int AS winner_count
         FROM public.subtask_proof AS p
         JOIN public.subtask AS s ON s.subtask_id = p.subtask_id
        WHERE p.subtask_id = ANY($1::bigint[])
          AND p.payload->>'choice' = s.payload->>'correct_option'
        GROUP BY p.subtask_id`,
      [settledIds],
      ex,
    );
    for (const row of counted) winnerCounts.set(str(row.subtask_id), int(row.winner_count));
  }

  for (const s of subtasks) {
    const proof = mine.get(s.subtask_id) ?? null;
    s.my_proof = proof;
    if (s.type_code === 'prediction' && s.prediction_state === 'settled') {
      s.my_outcome = derivePredictionOutcome(s.payload, proof, winnerCounts.get(s.subtask_id) ?? 0);
    }
  }
};

/**
 * R2 详情（单语句双形态：`campaign_id = $1 OR snowflake_id = $1`，一次往返 —— #60）。
 * `includeDraft=false`（公众）⇒ draft 活动返回 null（路由落 404，不泄露存在性）；draft 任务亦不嵌套。
 * `viewerUid` 给出（登录态）⇒ 加性附加每子任务 `my_proof` 与 settled prediction 的 `my_outcome`。
 */
export const getCampaignByRef = async (
  ref: string,
  opts: { includeDraft: boolean; viewerUid?: number | null },
  ex?: TxClient,
): Promise<CampaignView | null> => {
  if (!isCampaignRef(ref)) return null;
  const rows = await readRows<Row>(
    `SELECT * FROM public.campaign WHERE campaign_id = $1::bigint OR snowflake_id = $1::bigint LIMIT 1`,
    [ref],
    ex,
  );
  if (!rows.length) return null;
  const campaign = rows[0];
  if (str(campaign.status) === 'draft' && !opts.includeDraft) return null;
  const campaignId = str(campaign.campaign_id);

  const taskRows = await readRows<Row>(
    opts.includeDraft
      ? `SELECT * FROM public.task WHERE campaign_id = $1::bigint ORDER BY sort ASC, task_id ASC`
      : `SELECT * FROM public.task WHERE campaign_id = $1::bigint AND status <> 'draft' ORDER BY sort ASC, task_id ASC`,
    [campaignId],
    ex,
  );
  const taskIds = taskRows.map((t) => str(t.task_id));
  const subtaskRows = taskIds.length
    ? await readRows<Row>(
      `${SUBTASK_SELECT} WHERE s.task_id = ANY($1::bigint[]) ORDER BY s.sort ASC, s.subtask_id ASC`,
      [taskIds],
      ex,
    )
    : [];
  const subtaskMap = groupSubtasks(subtaskRows);
  const view = normalizeCampaignRow(campaign, taskRows.map((t) => normalizeTaskRow(t, subtaskMap.get(str(t.task_id)) ?? [])));
  // 登录态附加（匿名 / 非法 uid ⇒ 完全不附加，两键缺省 —— 与「key 缺省 vs null」的口径一致）
  const viewerUid = opts.viewerUid;
  if (typeof viewerUid === 'number' && Number.isSafeInteger(viewerUid) && viewerUid > 0) {
    await attachViewerContext(view, viewerUid, ex);
  }
  return view;
};

// ============================================================================
// R2b · 任务详情读口 —— 每个 campaign task 自己的页面（`/task/:taskId` 的数据面）
// ----------------------------------------------------------------------------
// Kevin 口径（派单逐字落地）：
//   · 形状**扁平**（任务自己的页面，不嵌套整份 campaign）：task 十一键 ＋ `joined_count`（＋ `headcount`
//     可选）＋ `campaign{id,title,status}` ＋ `project{id,title,slug,avatar_url,status}` ＋ `subtasks[]`；
//   · 公开面与首页热门任务读口 `listHomeCampaignTasks` **逐字同口径**：
//     `c.status = 'active' ∧ t.status <> 'draft' ∧ pr.status <> 'ended'`（draft / ended 任一 ⇒ 非公开）；
//   · 非公开 ⇒ `null` ⇒ 路由落 **404 `LEDGER_REF_NOT_FOUND`**（`details.reason = 'task_not_public'`，
//     借码零新码；「存在但未公开」与「不存在」对匿名不可区分）；
//   · 例外 = **owner（`project.owner_uid` = 本人）∨ 管理员（`includeDraft`，谓词与 R2 同源）**
//     ⇒ 同一形状 200（照旧是同一读口，零第二套字段面）；
//   · `joined_count = count(DISTINCT p.uid)` —— 同一人在多个子任务各一行凭证**只算一人**；
//   · 任务行不存在 / ref 非数字 ⇒ `null`（路由按 `reason='task_not_found'` 落 404）；
//   · 零新错误码、零新表、零写口改动。subtask 表**无 status 列**（0065 CP-3 逐字：只有「存在 / required」
//     两态）⇒ `subtasks[]` 不含 `status` 键（interface 留可选键，未来加列时按同一 normalize 透出）。
// ============================================================================
export interface TaskDetailSubtaskView {
  subtask_id: string;
  type_code: string;
  title: string;
  content: string | null;
  payload: Row;
  sort: number;
  required: boolean;
  /** quiz 答对奖励（`$`；0072 加性列；非 quiz 恒 `null`） */
  reward_amount: string | null;
  /** 加性可选：当前 DB 无 `subtask.status` 列 ⇒ **键缺省**（不是 null） */
  status?: string;
}

export interface TaskDetailView {
  task_id: string;
  title: string;
  description: string;
  status: string;
  time_start: string | null;
  time_end: string | null;
  sort: number;
  reward_amount_primary: string;
  reward_cid_secondary: string | null;
  reward_amount_secondary: string | null;
  /** 参与者去重人数（`count(DISTINCT subtask_proof.uid)`；零凭证 ⇒ 0，绝不是 null） */
  joined_count: number;
  /** 加性可选：项目额定人数（`project.headcount` 在场才出键） */
  headcount?: number;
  campaign: { id: string; title: string; status: string };
  project: { id: string; title: string; slug: string; avatar_url: string | null; status: string };
  subtasks: TaskDetailSubtaskView[];
}

/**
 * 公开面判据（**纯函数**：服务层决策与路由层缓存头共用同一实现，避免两处口径漂移）。
 * 逐字 = 首页热门任务读口的 `c.status='active' ∧ t.status<>'draft' ∧ pr.status<>'ended'`。
 */
export const isTaskPubliclyVisible = (input: {
  task_status: string | null | undefined;
  campaign_status: string | null | undefined;
  project_status: string | null | undefined;
}): boolean => str(input.campaign_status) === 'active'
  && str(input.task_status) !== 'draft'
  && str(input.project_status) !== 'ended';

/**
 * 单语句归属链（task → campaign → project）＋ 去重参与人数（相关子查询，零 N+1）。
 * 出参 bigint / numeric 一律 `::text`（承 route #60 出参体例；前端拿到即可直接渲染）。
 * 列引用均为**已落库列**（0063/0065/0068/0069），无 pre-apply 窗口问题。
 */
const TASK_DETAIL_SQL = `
  SELECT t.task_id::text                  AS task_id,
         t.title                          AS title,
         t.description                    AS description,
         t.status                         AS status,
         t.time_start                     AS time_start,
         t.time_end                       AS time_end,
         t.sort                           AS sort,
         t.reward_amount_primary::text    AS reward_amount_primary,
         t.reward_cid_secondary::text     AS reward_cid_secondary,
         t.reward_amount_secondary::text  AS reward_amount_secondary,
         c.campaign_id::text              AS campaign_id,
         c.title                          AS campaign_title,
         c.status                         AS campaign_status,
         pr.project_id::text              AS project_id,
         pr.title                         AS project_title,
         pr.slug                          AS project_slug,
         pr.avatar_url                    AS project_avatar_url,
         pr.status                        AS project_status,
         pr.owner_uid::text               AS project_owner_uid,
         pr.headcount::int                AS project_headcount,
         (SELECT count(DISTINCT p.uid)::int
            FROM public.subtask_proof AS p
            JOIN public.subtask AS s2 ON s2.subtask_id = p.subtask_id
           WHERE s2.task_id = t.task_id) AS joined_count
    FROM public.task AS t
    JOIN public.campaign AS c  ON c.campaign_id = t.campaign_id
    JOIN public.project  AS pr ON pr.project_id = c.project_id
   WHERE t.task_id = $1::bigint OR t.snowflake_id = $1::bigint
   LIMIT 1`;

/**
 * R2b 任务详情：`includeDraft`（管理员）∨ owner 放宽非公开面；其余匿名 / 第三方看图 = null（404）。
 * 未登录 ⇒ 本口零登录态附加键（与 R2 的 `my_proof` / `my_outcome` 无关：任务页只看任务本体）。
 */
export const getTaskDetailByRef = async (
  ref: string,
  opts: { includeDraft: boolean; actorUid?: number | null },
  ex?: TxClient,
): Promise<TaskDetailView | null> => {
  if (!isCampaignRef(ref)) return null;
  const rows = await readRows<Row>(TASK_DETAIL_SQL, [ref], ex);
  if (!rows.length) return null;
  const row = rows[0];

  const publicVisible = isTaskPubliclyVisible({
    task_status: strOrNull(row.status),
    campaign_status: strOrNull(row.campaign_status),
    project_status: strOrNull(row.project_status),
  });
  if (!publicVisible) {
    const uid = opts.actorUid;
    const owner = typeof uid === 'number' && Number.isSafeInteger(uid) && uid > 0
      && String(uid) === str(row.project_owner_uid);
    if (!(opts.includeDraft || owner)) return null;   // ★ draft 闸 / ended 闸：删掉 ⇒ 匿名可读未公开任务
  }

  const subtaskRows = await readRows<Row>(
    `${SUBTASK_SELECT} WHERE s.task_id = $1::bigint ORDER BY s.sort ASC, s.subtask_id ASC`,
    [str(row.task_id)],
    ex,
  );
  const headcount = row.project_headcount === null || row.project_headcount === undefined
    ? null
    : int(row.project_headcount);

  return {
    task_id: str(row.task_id),
    title: str(row.title),
    description: str(row.description),
    status: str(row.status),
    time_start: iso(row.time_start),
    time_end: iso(row.time_end),
    sort: int(row.sort),
    reward_amount_primary: str(row.reward_amount_primary),
    reward_cid_secondary: strOrNull(row.reward_cid_secondary),
    reward_amount_secondary: strOrNull(row.reward_amount_secondary),
    joined_count: int(row.joined_count),
    ...(headcount === null ? {} : { headcount }),
    campaign: {
      id: str(row.campaign_id),
      title: str(row.campaign_title),
      status: str(row.campaign_status),
    },
    project: {
      id: str(row.project_id),
      title: str(row.project_title),
      slug: str(row.project_slug),
      avatar_url: strOrNull(row.project_avatar_url),
      status: str(row.project_status),
    },
    subtasks: subtaskRows.map((s) => ({
      subtask_id: str(s.subtask_id),
      type_code: str(s.type_code),
      title: str(s.title),
      content: strOrNull(s.content),
      payload: publicSubtaskPayload(str(s.type_code), asObject(s.payload)),
      sort: int(s.sort),
      required: s.required === true,
      reward_amount: strOrNull(s.reward_amount),
    })),
  };
};

// ============================================================================
// 链加载（写口前置只读闸 · 承 §49.18.3「闸链 = 服务层前置只读」体例）
// ============================================================================
interface SubtaskChainRow extends Row {
  subtask_id: number | string;
  task_id: number | string;
  campaign_id: number | string;
  type_code: string;
  task_status: string;
  campaign_status: string;
}

const loadSubtaskChain = async (
  q: (text: string, params?: unknown[]) => Promise<Row[]>,
  subtaskRef: string,
  forUpdate: boolean,
): Promise<SubtaskChainRow | null> => {
  if (!isCampaignRef(subtaskRef)) return null;
  const rows = await q(
    `SELECT s.*, t.status AS task_status, t.campaign_id AS campaign_id, c.status AS campaign_status
       FROM public.subtask AS s
       JOIN public.task AS t ON t.task_id = s.task_id
       JOIN public.campaign AS c ON c.campaign_id = t.campaign_id
      WHERE s.subtask_id = $1::bigint OR s.snowflake_id = $1::bigint
      LIMIT 1${forUpdate ? ' FOR UPDATE OF s' : ''}`,
    [subtaskRef],
  );
  return rows.length ? (rows[0] as SubtaskChainRow) : null;
};

const loadTaskRow = async (
  q: (text: string, params?: unknown[]) => Promise<Row[]>,
  taskRef: string,
  forUpdate: boolean,
): Promise<Row | null> => {
  if (!isCampaignRef(taskRef)) return null;
  const rows = await q(
    `SELECT t.*, c.status AS campaign_status
       FROM public.task AS t
       JOIN public.campaign AS c ON c.campaign_id = t.campaign_id
      WHERE t.task_id = $1::bigint OR t.snowflake_id = $1::bigint
      LIMIT 1${forUpdate ? ' FOR UPDATE OF t' : ''}`,
    [taskRef],
  );
  return rows.length ? rows[0] : null;
};

const loadCampaignRow = async (
  q: (text: string, params?: unknown[]) => Promise<Row[]>,
  campaignRef: string,
  forUpdate: boolean,
): Promise<Row | null> => {
  if (!isCampaignRef(campaignRef)) return null;
  const rows = await q(
    `SELECT * FROM public.campaign
      WHERE campaign_id = $1::bigint OR snowflake_id = $1::bigint
      LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [campaignRef],
  );
  return rows.length ? rows[0] : null;
};

// ============================================================================
// 创建口 project_owner 支（迁移 0068 权限扩容 · manage_tasks 管理员之外的另一支）
// ----------------------------------------------------------------------------
//   · campaign 建：owner = body.project_id 所指项目的 owner_uid；
//   · task 建：owner = campaign.project_id（归属链经 campaign）；
//   · subtask 建（内联于 task 建改口）：owner = task → campaign → project 链；
//   · 谓词 = owner_uid = 本人 ∧ 项目 status ≠ 'ended'（派单逐字；管理员支不受 ≠ended 约束）；
//   · 决策纯函数零 DB（上下文由两个读口取），路由层与门共用同一实现。
// ============================================================================
export interface CreateAuthzOwnerContext {
  project_owner_uid: string;
  project_status: string;
}

/** campaign 建 / task 建的归属链读口：campaign（或其 snowflake）→ 所属项目 owner/status */
export const getCampaignAuthzContext = async (
  campaignRef: string,
  ex?: TxClient,
): Promise<(CreateAuthzOwnerContext & { campaign_id: string; project_id: string }) | null> => {
  if (!isCampaignRef(campaignRef)) return null;
  const rows = await readRows<Row>(
    `SELECT c.campaign_id::text AS campaign_id, c.project_id::text AS project_id,
            p.owner_uid::text AS project_owner_uid, p.status AS project_status
       FROM public.campaign AS c
       JOIN public.project AS p ON p.project_id = c.project_id
      WHERE c.campaign_id = $1::bigint OR c.snowflake_id = $1::bigint
      LIMIT 1`,
    [campaignRef],
    ex,
  );
  return rows.length ? (rows[0] as unknown as CreateAuthzOwnerContext & { campaign_id: string; project_id: string }) : null;
};

/** subtask 建（task 改口内联新增）的归属链读口：task → campaign → project owner/status */
export const getTaskAuthzContext = async (
  taskRef: string,
  ex?: TxClient,
): Promise<(CreateAuthzOwnerContext & { task_id: string; campaign_id: string; project_id: string }) | null> => {
  if (!isCampaignRef(taskRef)) return null;
  const rows = await readRows<Row>(
    `SELECT t.task_id::text AS task_id, t.campaign_id::text AS campaign_id,
            c.project_id::text AS project_id,
            p.owner_uid::text AS project_owner_uid, p.status AS project_status
       FROM public.task AS t
       JOIN public.campaign AS c ON c.campaign_id = t.campaign_id
       JOIN public.project AS p ON p.project_id = c.project_id
      WHERE t.task_id = $1::bigint OR t.snowflake_id = $1::bigint
      LIMIT 1`,
    [taskRef],
    ex,
  );
  return rows.length ? (rows[0] as unknown as CreateAuthzOwnerContext & { task_id: string; campaign_id: string; project_id: string }) : null;
};

/**
 * 创建口权限决策（纯函数 · 路由层与门共用）：
 *   · `adminActor`（路由层以 requireAdmin 同源谓词判定：can_access_admin ∧ (is_admin ∨ manage_tasks)）⇒ 放行；
 *   · 否则 owner 支：ownerContext.project_owner_uid = 本人 ∧ project_status ≠ 'ended' ⇒ 放行；
 *   · 都不满足 ⇒ 403（details.reason = 'project_owner_required' / owner 但项目已 ended ⇒
 *     'project_owner_ended'），借 AUTH_FORBIDDEN（零新码）。
 */
export const authorizeProjectScopedCreate = (input: {
  actorUid: number;
  adminActor: boolean;
  ownerContext: CreateAuthzOwnerContext | null;
  projectId: string | null;
}): VerbErr | null => {
  if (input.adminActor) return null;
  const ctx = input.ownerContext;
  if (ctx && str(ctx.project_owner_uid) === String(input.actorUid)) {
    if (str(ctx.project_status) !== 'ended') return null;
    return forbidden('project_owner_ended', {
      project_id: input.projectId,
      project_status: str(ctx.project_status),
    });
  }
  return forbidden('project_owner_required', {
    project_id: input.projectId,
    hint: 'manage_tasks 管理员，或项目 owner（owner_uid = 本人 ∧ status ≠ ended）',
  });
};

// ============================================================================
// R3 · 提交凭证（subtask proof）—— 提交即通过；一人一提交
// ============================================================================
export const submitProofVerb = async (input: {
  actorUid: number;
  subtaskRef: string;
  body: unknown;
  ex?: TxClient;
}): Promise<VerbResult<ProofView>> => {
  if (!isCampaignRef(input.subtaskRef)) return notFound('subtask_not_found');

  try {
    return await runInTx<VerbResult<ProofView>>(input.ex, async (tx) => {
    const q = (text: string, params?: unknown[]) => txQuery<Row>(tx, text, params);
    const chain = await loadSubtaskChain(q, input.subtaskRef, false);
    if (!chain) return notFound('subtask_not_found');

    // 闸链：subtask → task.active → campaign.active（任一非 active ⇒ 409，零写副作用）
    if (str(chain.campaign_status) !== 'active' || str(chain.task_status) !== 'active') {
      return conflict('campaign_not_active', {
        campaign_status: str(chain.campaign_status),
        task_status: str(chain.task_status),
      });
    }

    const subtaskId = str(chain.subtask_id);
    const typeCode = str(chain.type_code);
    const uid = String(input.actorUid);
    const nowMs = Date.now();

    // ---- prediction：单键 {choice} + 一人一票（首票即定）----
    if (typeCode === 'prediction') {
      const payload = asObject(chain.payload);
      const style = predictionOptionStyle(payload);   // ★ 口径由**库内 payload 形状**定，不由请求体定
      const state = derivePredictionState(payload, nowMs);
      if (state === 'settled') return conflict('prediction_already_settled', { subtask_id: subtaskId });
      if (state === 'deadline_reached') {
        return conflict('prediction_deadline_passed', { subtask_id: subtaskId, deadline: iso(payload.deadline) });
      }
      const parsed = parsePredictionChoice(input.body, style);
      if ('err' in parsed) return parsed.err;

      // ★ 单语句 + DO NOTHING：0 行 = 已有票 ⇒ 409（不覆盖、不新增行 —— CP-P4 / CP-PN4）
      const inserted = await q(
        `INSERT INTO public.subtask_proof (subtask_id, uid, payload, status)
         VALUES ($1::bigint, $2::bigint, $3::jsonb, 'submitted')
         ON CONFLICT (subtask_id, uid) DO NOTHING
         RETURNING *`,
        [subtaskId, uid, JSON.stringify({ choice: parsed.choice })],
      );
      if (!inserted.length) return conflict('prediction_vote_locked', { subtask_id: subtaskId });
      return { ok: true, view: normalizeProofRow(inserted[0]), replay: false };
    }

    // ---- quiz：{answers:{picks}}（1–4 个 ∈a–d）⇒ 集合相等即答对 ⇒ **同一事务**发奖 ----
    //   答错也落 proof（提交即通过体例）但零发奖；同一 uid 重提 ⇒ 409（与 prediction 一人一票同族）。
    if (typeCode === 'quiz') {
      const payload = asObject(chain.payload);
      const parsed = parseQuizProof(input.body);
      if ('err' in parsed) return parsed.err;
      // 正确答案只在这里读（公开读口已脱敏）；库内形状异常 ⇒ 视为「无正确答案」⇒ 判错（不 500）
      const correctRaw = payload[QUIZ_CORRECT_KEY];
      const correct = Array.isArray(correctRaw)
        ? correctRaw
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => (QUIZ_OPTION_KEYS as readonly string[]).includes(v))
        : [];
      const quizCorrect = samePickSet(parsed.picks, correct);
      const rewardText = asPositiveIntText(chain.reward_amount) ?? '0';
      const reward = BigInt(rewardText);

      const inserted = await q(
        `INSERT INTO public.subtask_proof (subtask_id, uid, payload, status)
         VALUES ($1::bigint, $2::bigint, $3::jsonb, 'submitted')
         ON CONFLICT (subtask_id, uid) DO NOTHING
         RETURNING *`,
        [subtaskId, uid, JSON.stringify({ answers: { picks: parsed.picks } })],
      );
      if (!inserted.length) return conflict('quiz_already_answered', { subtask_id: subtaskId });

      let rewardPaid = '0';
      if (quizCorrect && reward > 0n) {
        const key = `biz:campaign:quiz:${subtaskId}:${uid}`;
        await postEvent({
          op: 'entries',
          idempotencyKey: key,
          requestFingerprint: fingerprintOf(['campaign.quiz', subtaskId, uid, rewardText]),
          refType: 'system',
          refId: subtaskId,
          memo: `campaign_quiz_reward:${subtaskId}:${uid}`,
          entries: [
            { uid: String(PLATFORM_UID), cid: String(USD_CID), delta: (-reward).toString(), kind: PLATFORM_PAYOUT_KIND },
            { uid, cid: String(USD_CID), delta: reward.toString(), kind: PLATFORM_PAYOUT_KIND },
          ],
          ex: tx as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
        });
        rewardPaid = rewardText;
      }
      return {
        ok: true,
        view: { ...normalizeProofRow(inserted[0]), quiz_correct: quizCorrect, reward_paid: rewardPaid },
        replay: false,
      };
    }

    // ---- 通用三类（x_verify / onchain_snapshot / survey）：闭集四键 + 重提覆盖（last-write-wins，200）----
    const parsed = parseTypedPayload(typeCode, input.body, 'proof');
    if ('err' in parsed) return parsed.err;
    const upserted = await q(
      `INSERT INTO public.subtask_proof (subtask_id, uid, payload, status)
       VALUES ($1::bigint, $2::bigint, $3::jsonb, 'submitted')
       ON CONFLICT (subtask_id, uid)
       DO UPDATE SET payload = EXCLUDED.payload, time_updated = now()
       RETURNING *`,
      [subtaskId, uid, JSON.stringify(parsed.payload)],
    );
    return { ok: true, view: normalizeProofRow(upserted[0]), replay: false };
    });
  } catch (e) {
    const normalized = normalizeLedgerError(e);
    if (normalized.code === 'LEDGER_INSUFFICIENT_BALANCE') {
      return conflict('quiz_reward_pool_insufficient', { ledger_code: normalized.code });
    }
    throw e;
  }
};

// ============================================================================
// R8 · prediction 结算（回填 correct_option ＋ 一次性分发，同一事务）
// ============================================================================
export interface SettlementView {
  subtask_id: string;
  type_code: string;
  prediction_state: PredictionState;
  /** 新两键行 = `'yes'|'no'`；存量四键行 = `'a'|'b'` */
  correct_option: 'a' | 'b' | 'yes' | 'no';
  prize_amount: string;
  winner_count: number;
  per_winner_amount: string;
  distributed_total: string;
  platform_retained: string;
  ledger_entries: number;
  idempotency_key: string | null;
}

export const settlePredictionVerb = async (input: {
  subtaskRef: string;
  body: unknown;
  /** 门 / 探针注入的既有事务（生产不传） */
  ex?: TxClient;
}): Promise<VerbResult<SettlementView>> => {
  if (!isCampaignRef(input.subtaskRef)) return notFound('subtask_not_found');

  const body = isPlainObject(input.body) ? input.body : {};
  const unknown = Object.keys(body).filter((k) => k !== PREDICTION_CORRECT_OPTION_KEY);
  if (unknown.length) return badRequest('PREDICTION_SETTLE_BODY_INVALID', { unknown_keys: unknown, legal_keys: [PREDICTION_CORRECT_OPTION_KEY] });
  // 值域不能在此定（要读行才知道口径）⇒ 先做「字符串且在并集内」的粗筛，事务内再按行口径细判
  const optionRaw = body[PREDICTION_CORRECT_OPTION_KEY];
  const optionAny = typeof optionRaw === 'string' ? optionRaw : '';
  const union = [...PREDICTION_CHOICES.yes_no, ...PREDICTION_CHOICES.ab_legacy];
  if (!union.includes(optionAny)) {
    return badRequest('PREDICTION_CORRECT_OPTION_INVALID', { field: PREDICTION_CORRECT_OPTION_KEY, expected: "'yes'|'no'（新两键行）或 'a'|'b'（存量四键行）" });
  }
  const option = optionAny;

  try {
    return await runInTx<VerbResult<SettlementView>>(input.ex, async (tx) => {
      const q = (text: string, params?: unknown[]) => txQuery<Row>(tx, text, params);
      // 行锁：并发双 settle 串行化（第二笔读到已回填的 correct_option ⇒ 409）
      const chain = await loadSubtaskChain(q, input.subtaskRef, true);
      if (!chain) return notFound('subtask_not_found');
      if (str(chain.type_code) !== 'prediction') {
        return badRequest('PREDICTION_TYPE_MISMATCH', { type_code: str(chain.type_code), expected: 'prediction' });
      }
      const subtaskId = str(chain.subtask_id);
      const payload = asObject(chain.payload);
      const style = predictionOptionStyle(payload);

      // 回填值必须落在**该行口径**的值域（新两键 ⇒ yes|no；存量四键 ⇒ a|b）—— 跨口径 ⇒ 400（禁双开）
      if (!isPredictionChoice(style, option)) {
        return badRequest('PREDICTION_CORRECT_OPTION_INVALID', {
          field: PREDICTION_CORRECT_OPTION_KEY,
          option_style: style,
          expected: predictionChoicesFor(style),
        });
      }

      // 一次性封板：已回填 ⇒ 409（防二次分发 —— CP-P5 / #64）
      if (isPredictionChoice(style, payload[PREDICTION_CORRECT_OPTION_KEY])) {
        return conflict('prediction_already_settled', {
          subtask_id: subtaskId,
          correct_option: str(payload[PREDICTION_CORRECT_OPTION_KEY]),
        });
      }
      const deadline = iso(payload.deadline);
      if (deadline === null) return badRequest('PREDICTION_PAYLOAD_SHAPE', { field: 'deadline', subtask_id: subtaskId });
      if (Date.now() < Date.parse(deadline)) {
        return conflict('prediction_deadline_not_reached', { subtask_id: subtaskId, deadline });
      }
      const prizeText = asPositiveIntText(payload.prize_amount);
      if (prizeText === null) return badRequest('PREDICTION_PRIZE_INVALID', { field: 'prize_amount', subtask_id: subtaskId });
      const prize = BigInt(prizeText);

      // 选对者（按 proof_id 全序；同一事务内读取 ⇒ 与分发同一快照）
      const winners = await q(
        `SELECT uid::text AS uid FROM public.subtask_proof
          WHERE subtask_id = $1::bigint AND payload->>'choice' = $2::text
          ORDER BY proof_id ASC`,
        [subtaskId, option],
      );
      const winnerCount = winners.length;
      const perWinner = winnerCount > 0 ? prize / BigInt(winnerCount) : 0n;
      const distributed = perWinner * BigInt(winnerCount);
      const retained = prize - distributed;

      // ---- 分发（零预扣 ⇒ 平台收入账户出账；floor ＋ 余数留在平台 —— CP-P6）----
      let ledgerEntries = 0;
      let key: string | null = null;
      if (winnerCount > 0 && perWinner > 0n) {
        key = `biz:campaign:settle:${subtaskId}:${option}`;
        const entries: Array<{ uid: string; cid: string; delta: string; kind: typeof PLATFORM_PAYOUT_KIND }> = winners
          .map((w) => ({ uid: str(w.uid), cid: String(USD_CID), delta: perWinner.toString(), kind: PLATFORM_PAYOUT_KIND }));
        entries.push({ uid: String(PLATFORM_UID), cid: String(USD_CID), delta: (-distributed).toString(), kind: PLATFORM_PAYOUT_KIND });
        await postEvent({
          op: 'entries',
          idempotencyKey: key,
          requestFingerprint: fingerprintOf(['campaign.settle', subtaskId, option, prizeText, winnerCount, perWinner.toString()]),
          refType: 'system',
          refId: subtaskId,
          memo: `campaign_prediction_settle:${subtaskId}`,
          entries,
          ex: tx as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
        });
        ledgerEntries = entries.length;
      }

      // ---- 回填 correct_option（payload 内键，零新列 —— CP-P2）----
      await q(
        `UPDATE public.subtask
            SET payload = payload || jsonb_build_object($2::text, $3::text)
          WHERE subtask_id = $1::bigint`,
        [subtaskId, PREDICTION_CORRECT_OPTION_KEY, option],
      );

      return {
        ok: true,
        view: {
          subtask_id: subtaskId,
          type_code: 'prediction',
          prediction_state: 'settled',
          correct_option: option,
          prize_amount: prizeText,
          winner_count: winnerCount,
          per_winner_amount: perWinner.toString(),
          distributed_total: distributed.toString(),
          platform_retained: retained.toString(),
          ledger_entries: ledgerEntries,
          idempotency_key: key,
        },
        replay: false,
      } as VerbResult<SettlementView>;
    });
  } catch (e) {
    const normalized = normalizeLedgerError(e);
    if (normalized.code === 'LEDGER_INSUFFICIENT_BALANCE') {
      return conflict('prediction_prize_pool_insufficient', { ledger_code: normalized.code });
    }
    throw e;
  }
};

// ============================================================================
// 管理员写口 —— campaign（R4 / R5）
// ============================================================================
export const createCampaignVerb = async (input: { body: unknown; ex?: TxClient }): Promise<VerbResult<CampaignView>> => {
  const parsed = parseCampaignPayload(input.body, 'create');
  if ('err' in parsed) return parsed.err;
  const p = parsed.payload;

  return runInTx<VerbResult<CampaignView>>(input.ex, async (tx) => {
    // 挂载项目必须在场（迁移 0068：campaign.project_id NOT NULL FK；不存在 ⇒ 404，不落 23503 半码）
    const projRows = await txQuery<Row>(
      tx,
      `SELECT project_id::text AS project_id FROM public.project WHERE project_id = $1::bigint LIMIT 1`,
      [p.project_id],
    );
    if (!projRows.length) {
      return notFound('project_not_found');
    }

    const inserted = await txQuery<Row>(
      tx,
      `INSERT INTO public.campaign (snowflake_id, project_id, title, description, status, time_start, time_end)
       VALUES ($1::bigint, $2::bigint, $3::text, $4::text, 'draft', $5::timestamptz, $6::timestamptz)
       RETURNING *`,
      [nextSnowflake().toString(), p.project_id, p.title, p.description ?? '', p.time_start ?? null, p.time_end ?? null],
    );
    return { ok: true, view: normalizeCampaignRow(inserted[0], []), replay: false };
  });
};

export const patchCampaignVerb = async (input: { ref: string; body: unknown; ex?: TxClient }): Promise<VerbResult<CampaignView>> => {
  if (!isCampaignRef(input.ref)) return notFound();
  const parsed = parseCampaignPayload(input.body, 'patch');
  if ('err' in parsed) return parsed.err;
  const p = parsed.payload;

  return runInTx<VerbResult<CampaignView>>(input.ex, async (tx) => {
    const q = (text: string, params?: unknown[]) => txQuery<Row>(tx, text, params);
    const row = await loadCampaignRow(q, input.ref, true);
    if (!row) return notFound();
    const campaignId = str(row.campaign_id);
    const current = str(row.status) as CampaignStatus;

    // ended = 终态封板（CP-6 / CP-N3）
    if (current === 'ended') return conflict('campaign_ended_frozen', { campaign_id: campaignId });
    const nextStatus = (p.status ?? current) as CampaignStatus;
    if (nextStatus !== current && !CAMPAIGN_STATUS_TRANSITIONS[current].includes(nextStatus)) {
      return conflict('campaign_invalid_transition', { from: current, to: nextStatus });
    }
    // 时间窗：本次只改一侧 ⇒ 用库内现值补齐后整体校验（不撞 DB CHECK）
    const start = p.time_start !== undefined ? p.time_start : iso(row.time_start);
    const end = p.time_end !== undefined ? p.time_end : iso(row.time_end);
    if (!windowOk(start, end)) {
      return badRequest('CAMPAIGN_TIME_WINDOW_INVALID', { time_start: start, time_end: end, expected: 'time_end > time_start' });
    }

    const updated = await q(
      `UPDATE public.campaign SET
         title = COALESCE($2::text, title),
         description = COALESCE($3::text, description),
         time_start = $4::timestamptz,
         time_end = $5::timestamptz,
         status = $6::text
       WHERE campaign_id = $1::bigint
       RETURNING *`,
      [campaignId, p.title ?? null, p.description ?? null, start, end, nextStatus],
    );

    // 回显 = 写后读（含任务/子任务嵌套）
    const detail = await getCampaignByRef(campaignId, { includeDraft: true }, tx);
    return {
      ok: true,
      view: detail ?? normalizeCampaignRow(updated[0], []),
      replay: nextStatus === current && Object.keys(p).length === 0,
    };
  });
};

// ============================================================================
// 管理员写口 —— task（R6 / R7 ＋ subtasks[] 整组 upsert，永不 DELETE）
// ============================================================================
const insertSubtask = async (tx: TxClient, taskId: string, item: SubtaskInput): Promise<Row> => {
  const rows = await txQuery<Row>(
    tx,
    `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title, content, payload, reward_amount, sort, required)
     VALUES ($1::bigint, $2::bigint, $3::text, $4::text, $5::text, $6::jsonb, $7::numeric, $8::int, $9::boolean)
     RETURNING *`,
    [
      nextSnowflake().toString(), taskId, item.type_code, item.title, item.content,
      JSON.stringify(item.payload), item.reward_amount ?? null, item.sort, item.required,
    ],
  );
  return rows[0];
};

const updateSubtask = async (tx: TxClient, ref: string, item: SubtaskInput): Promise<Row | null> => {
  const rows = await txQuery<Row>(
    tx,
    `UPDATE public.subtask SET
       type_code     = $2::text,
       title         = $3::text,
       content       = $4::text,
       payload       = $5::jsonb,
       reward_amount = $6::numeric,
       sort          = $7::int,
       required      = $8::boolean
     WHERE subtask_id = $1::bigint OR snowflake_id = $1::bigint
     RETURNING *`,
    [ref, item.type_code, item.title, item.content, JSON.stringify(item.payload), item.reward_amount ?? null, item.sort, item.required],
  );
  return rows.length ? rows[0] : null;
};

/** 枚举类型必须在册且 active（未知 / inactive ⇒ 400 —— R6） */
const assertTypeUsable = async (tx: TxClient, typeCode: string): Promise<VerbErr | null> => {
  const rows = await txQuery<Row>(
    tx,
    `SELECT active FROM public.subtask_type WHERE type_code = $1::text LIMIT 1`,
    [typeCode],
  );
  if (!rows.length) return badRequest('SUBTASK_TYPE_INVALID', { type_code: typeCode, expected: SUBTASK_TYPE_CODES });
  if (rows[0].active !== true) return badRequest('SUBTASK_TYPE_INACTIVE', { type_code: typeCode });
  return null;
};

export const createTaskVerb = async (input: {
  campaignRef: string;
  body: unknown;
  ex?: TxClient;
}): Promise<VerbResult<TaskView>> => {
  if (!isCampaignRef(input.campaignRef)) return notFound();
  const parsed = parseTaskPayload(input.body, 'create');
  if ('err' in parsed) return parsed.err;
  const p = parsed.payload;

  return runInTx<VerbResult<TaskView>>(input.ex, async (tx) => {
    const q = (text: string, params?: unknown[]) => txQuery<Row>(tx, text, params);
    const campaign = await loadCampaignRow(q, input.campaignRef, true);
    if (!campaign) return notFound();
    const campaignId = str(campaign.campaign_id);
    // campaign ended ⇒ 不可再加任务（CP-6 封板）
    if (str(campaign.status) === 'ended') return conflict('campaign_ended_frozen', { campaign_id: campaignId });

    // 次币在册 + listed（早于任何写入）
    const secondaryCid = p.reward_cid_secondary ?? null;
    if (secondaryCid !== null) {
      const cur = await txQuery<Row>(tx, `SELECT status FROM public.currency WHERE cid = $1::bigint LIMIT 1`, [secondaryCid]);
      if (!cur.length) return conflict('task_reward_currency_not_found', { reward_cid_secondary: secondaryCid });
      if (str(cur[0].status) !== 'listed') {
        return conflict('task_reward_currency_not_listed', { reward_cid_secondary: secondaryCid, status: str(cur[0].status) });
      }
    }

    const items = p.subtasks ?? [];
    for (const item of items) {
      const bad = await assertTypeUsable(tx, item.type_code);
      if (bad) return bad;
    }

    const inserted = await q(
      `INSERT INTO public.task
         (snowflake_id, campaign_id, title, description, status, time_start, time_end, sort,
          reward_amount_primary, reward_cid_secondary, reward_amount_secondary)
       VALUES ($1::bigint, $2::bigint, $3::text, $4::text, 'draft', $5::timestamptz, $6::timestamptz, $7::int,
               $8::numeric, $9::bigint, $10::numeric)
       RETURNING *`,
      [
        nextSnowflake().toString(), campaignId, p.title, p.description ?? '', p.time_start ?? null,
        p.time_end ?? null, p.sort ?? 0, p.reward_amount_primary,
        secondaryCid, p.reward_amount_secondary ?? null,
      ],
    );
    const taskId = str(inserted[0].task_id);
    const subtaskViews: SubtaskView[] = [];
    for (const item of items) {
      const row = await insertSubtask(tx, taskId, item);
      subtaskViews.push(normalizeSubtaskRow(row));
    }
    return { ok: true, view: normalizeTaskRow(inserted[0], subtaskViews), replay: false };
  });
};

export const patchTaskVerb = async (input: { ref: string; body: unknown; ex?: TxClient }): Promise<VerbResult<TaskView>> => {
  if (!isCampaignRef(input.ref)) return notFound('task_not_found');
  const parsed = parseTaskPayload(input.body, 'patch');
  if ('err' in parsed) return parsed.err;
  const p = parsed.payload;

  return runInTx<VerbResult<TaskView>>(input.ex, async (tx) => {
    const q = (text: string, params?: unknown[]) => txQuery<Row>(tx, text, params);
    const row = await loadTaskRow(q, input.ref, true);
    if (!row) return notFound('task_not_found');
    const taskId = str(row.task_id);
    if (str(row.campaign_status) === 'ended' || str(row.status) === 'ended') {
      return conflict('campaign_ended_frozen', { task_id: taskId, campaign_status: str(row.campaign_status), task_status: str(row.status) });
    }

    const current = str(row.status) as CampaignStatus;
    const nextStatus = (p.status ?? current) as CampaignStatus;
    // 任务自己的迁移表（active ⇒ draft = 下线；活动仍用 CAMPAIGN_STATUS_TRANSITIONS，不受影响）
    if (nextStatus !== current && !TASK_STATUS_TRANSITIONS[current].includes(nextStatus)) {
      return conflict('task_invalid_transition', { from: current, to: nextStatus });
    }
    const start = p.time_start !== undefined ? p.time_start : iso(row.time_start);
    const end = p.time_end !== undefined ? p.time_end : iso(row.time_end);
    if (!windowOk(start, end)) {
      return badRequest('TASK_TIME_WINDOW_INVALID', { time_start: start, time_end: end, expected: 'time_end > time_start' });
    }

    // 两币成对：本次只改一侧 ⇒ 用库内现值补齐（CP-R2）
    let cid: string | null = strOrNull(row.reward_cid_secondary);
    let amount: string | null = strOrNull(row.reward_amount_secondary);
    const bodyObj = isPlainObject(input.body) ? input.body : {};
    if (Object.prototype.hasOwnProperty.call(bodyObj, 'reward_cid_secondary')) cid = p.reward_cid_secondary ?? null;
    if (Object.prototype.hasOwnProperty.call(bodyObj, 'reward_amount_secondary')) amount = p.reward_amount_secondary ?? null;
    if ((cid === null) !== (amount === null)) {
      return badRequest('TASK_REWARD_SECONDARY_PAIR_REQUIRED', { fields: ['reward_cid_secondary', 'reward_amount_secondary'] });
    }
    if (cid !== null) {
      const cur = await txQuery<Row>(tx, `SELECT status FROM public.currency WHERE cid = $1::bigint LIMIT 1`, [cid]);
      if (!cur.length) return conflict('task_reward_currency_not_found', { reward_cid_secondary: cid });
      if (str(cur[0].status) !== 'listed') {
        return conflict('task_reward_currency_not_listed', { reward_cid_secondary: cid, status: str(cur[0].status) });
      }
    }

    // subtasks[] 整组 upsert：带 id ⇒ 更新（须属本任务，否则 404）、不带 ⇒ 插入；**永不 DELETE**
    const items = p.subtasks ?? [];
    for (const item of items) {
      const bad = await assertTypeUsable(tx, item.type_code);
      if (bad) return bad;
      if (item.subtask_id !== undefined || item.snowflake_id !== undefined) {
        const ref = item.subtask_id ?? item.snowflake_id ?? '';
        const owned = await q(
          `SELECT task_id::text AS task_id, type_code, payload FROM public.subtask
            WHERE subtask_id = $1::bigint OR snowflake_id = $1::bigint LIMIT 1`,
          [ref],
        );
        if (!owned.length || str(owned[0].task_id) !== taskId) {
          return notFound('subtask_not_found');
        }
        // ★ 禁双开：存量四键行的改口必须继续用四键（a|b），新两键行必须继续用两键（yes|no）
        //   —— payload 口径不可在同一行上来回换；换口径会同时改掉已有 proof 的 choice 语义（不可逆）。
        if (item.type_code === 'prediction' && str(owned[0].type_code) === 'prediction' && item.option_style) {
          const existing = predictionOptionStyle(asObject(owned[0].payload));
          if (existing !== item.option_style) {
            return badRequest('PREDICTION_OPTION_STYLE_IMMUTABLE', {
              subtask_id: str(owned[0].subtask_id ?? ref),
              existing_option_style: existing,
              payload_option_style: item.option_style,
              hint: '存量四键行改口仍用 {option_a, option_b, prize_amount, deadline}；新行恒 {prize_amount, deadline}',
            });
          }
        }
      }
    }

    const updated = await q(
      `UPDATE public.task SET
         title                   = COALESCE($2::text, title),
         description             = COALESCE($3::text, description),
         time_start              = $4::timestamptz,
         time_end                = $5::timestamptz,
         sort                    = COALESCE($6::int, sort),
         status                  = $7::text,
         reward_amount_primary   = COALESCE($8::numeric, reward_amount_primary),
         reward_cid_secondary    = $9::bigint,
         reward_amount_secondary = $10::numeric
       WHERE task_id = $1::bigint
       RETURNING *`,
      [
        taskId, p.title ?? null, p.description ?? null, start, end, p.sort ?? null, nextStatus,
        p.reward_amount_primary ?? null, cid, amount,
      ],
    );

    for (const item of items) {
      const ref = item.subtask_id ?? item.snowflake_id;
      if (ref !== undefined) {
        const patched = await updateSubtask(tx, ref, item);
        if (!patched) return notFound('subtask_not_found');
      } else {
        await insertSubtask(tx, taskId, item);
      }
    }

    const detail = await getTaskDetailById(taskId, tx);
    return {
      ok: true,
      view: detail ?? normalizeTaskRow(updated[0], []),
      replay: nextStatus === current && Object.keys(p).length === 0,
    };
  });
};

/** 任务详情（写后回显；含全部子任务 + 类型 label） */
export const getTaskDetailById = async (taskId: string, ex?: TxClient): Promise<TaskView | null> => {
  const rows = await readRows<Row>(
    `SELECT * FROM public.task WHERE task_id = $1::bigint LIMIT 1`,
    [taskId],
    ex,
  );
  if (!rows.length) return null;
  const subtasks = await readRows<Row>(
    `${SUBTASK_SELECT} WHERE s.task_id = $1::bigint ORDER BY s.sort ASC, s.subtask_id ASC`,
    [taskId],
    ex,
  );
  return normalizeTaskRow(rows[0], subtasks.map(normalizeSubtaskRow));
};

// ============================================================================
// task 完成奖（额外完成奖 · 手动发放 · 全部 subtask 完成后才可发）
// ============================================================================
export interface TaskRewardView {
  task_id: string;
  uid: string;
  reward_amount_primary: string;
  reward_amount_secondary: string | null;
  reward_cid_secondary: string | null;
  total_subtasks: number;
  completed_subtasks: number;
  idempotency_key: string;
}

export const grantTaskRewardVerb = async (input: {
  ref: string;
  body: unknown;
  headerKey: unknown;
  ex?: TxClient;
}): Promise<VerbResult<TaskRewardView>> => {
  if (!isCampaignRef(input.ref)) return notFound('task_not_found');
  const body = isPlainObject(input.body) ? input.body : {};
  const legal = ['uid', 'idempotency_key'];
  const unknown = Object.keys(body).filter((k) => !legal.includes(k));
  if (unknown.length) return badRequest('NOT_SUPPORTED', { unknown_keys: unknown, legal_keys: legal });
  const uid = asPositiveIntText(body.uid);
  if (uid === null) return badRequest('TASK_REWARD_UID_INVALID', { field: 'uid', expected: 'positive_integer' });

  try {
    return await runInTx<VerbResult<TaskRewardView>>(input.ex, async (tx) => {
      const q = (text: string, params?: unknown[]) => txQuery<Row>(tx, text, params);
      const row = await loadTaskRow(q, input.ref, true);
      if (!row) return notFound('task_not_found');
    const taskId = str(row.task_id);

    // 幂等键：显式给（header / body）⇒ 用它；否则按 (task,uid) 推导确定性键（天然幂等）
    const given = resolveCampaignIdempotencyKey(input.headerKey ?? body.idempotency_key);
    if (given === null) {
      return badRequest('IDEMPOTENCY_KEY_INVALID', { field: 'idempotency-key', expected: 'cli:|biz:|cm:|ops: prefix' });
    }
    const key = given.derived ? `biz:campaign:task-reward:${taskId}:${uid}` : given.key;

    // ① 全部 subtask 完成才可发（缺一 ⇒ 409；含 0 子任务的空壳任务）
    const counts = await q(
      `SELECT (SELECT count(*)::int FROM public.subtask AS s WHERE s.task_id = $1::bigint) AS total,
              (SELECT count(*)::int FROM public.subtask AS s
                WHERE s.task_id = $1::bigint
                  AND EXISTS (SELECT 1 FROM public.subtask_proof AS p
                               WHERE p.subtask_id = s.subtask_id AND p.uid = $2::bigint)) AS done`,
      [taskId, uid],
    );
    const total = int(counts.length ? counts[0].total : 0);
    const done = int(counts.length ? counts[0].done : 0);
    if (total === 0) return conflict('task_has_no_subtask', { task_id: taskId });
    if (done < total) {
      return conflict('task_reward_incomplete', { task_id: taskId, uid, total_subtasks: total, completed_subtasks: done });
    }

    const primary = asPositiveIntText(row.reward_amount_primary) ?? '0';
    const secondaryCid = strOrNull(row.reward_cid_secondary);
    const secondaryAmount = strOrNull(row.reward_amount_secondary);

    // ② 幂等重放：同键已有分录 ⇒ 回库内真值（不重复发放）
    const prior = await q(
      `SELECT count(*)::int AS n FROM public.ledger_entry
        WHERE idempotency_key = $1::text OR idempotency_key LIKE $1::text || '#%'`,
      [key],
    );
    if (int(prior.length ? prior[0].n : 0) > 0) {
      return {
        ok: true,
        view: {
          task_id: taskId, uid, reward_amount_primary: primary,
          reward_amount_secondary: secondaryAmount, reward_cid_secondary: secondaryCid,
          total_subtasks: total, completed_subtasks: done, idempotency_key: key,
        },
        replay: true,
      } as VerbResult<TaskRewardView>;
    }

    // ③ 平台收入账户支付（两币各一笔事件；每事件 = 平台 −amount ＋ 用户 +amount，净额 0）
    const legs: Array<{ cid: string; amount: string; key: string }> = [];
    legs.push({ cid: String(USD_CID), amount: primary, key });
    if (secondaryCid !== null && secondaryAmount !== null) {
      legs.push({ cid: secondaryCid, amount: secondaryAmount, key: `${key}:secondary` });
    }

    for (const leg of legs) {
      if (!POSITIVE_INT_TEXT.test(leg.amount) || BigInt(leg.amount) <= 0n) continue;
      await postEvent({
        op: 'entries',
        idempotencyKey: leg.key,
        requestFingerprint: fingerprintOf(['campaign.task-reward', taskId, uid, leg.cid, leg.amount]),
        refType: 'system',
        refId: taskId,
        memo: `campaign_task_reward:${taskId}:${uid}`,
        entries: [
          { uid: String(PLATFORM_UID), cid: leg.cid, delta: (-BigInt(leg.amount)).toString(), kind: PLATFORM_PAYOUT_KIND },
          { uid, cid: leg.cid, delta: BigInt(leg.amount).toString(), kind: PLATFORM_PAYOUT_KIND },
        ],
        ex: tx as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
      });
    }

      return {
        ok: true,
        view: {
          task_id: taskId, uid, reward_amount_primary: primary,
          reward_amount_secondary: secondaryAmount, reward_cid_secondary: secondaryCid,
          total_subtasks: total, completed_subtasks: done, idempotency_key: key,
        },
        replay: false,
      } as VerbResult<TaskRewardView>;
    });
  } catch (e) {
    const normalized = normalizeLedgerError(e);
    if (normalized.code === 'LEDGER_INSUFFICIENT_BALANCE') {
      return conflict('task_reward_pool_insufficient', { ledger_code: normalized.code });
    }
    throw e;
  }
};
