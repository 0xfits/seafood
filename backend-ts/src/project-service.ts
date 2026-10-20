// ============================================================================
// src/project-service.ts — 项目（打工 / 工资）域服务层
// ============================================================================
// 契约真源：
//   docs/data-layer.spec.md  §40.15（PR-1 四表 / PR-5 状态机与招工准入 / PR-6 活动桶与两腿到账 /
//                            PR-7 配置键 / PR-N1–N6 判负）
//   docs/route-layer.spec.md §49.19（R1–R7 七口矩阵 · 注册点 111 → 118 实测口径见 §49.19.2 注）
//   docs/design/design-system.spec.md §26.20
//
// Kevin 四点（本文件逐条落地）：
//   ① 活跃 = 该 UTC 小时桶有登录态请求 ⇒ 2 电量/时；无行 ⇒ 离线 1 电量/时（`recordUserActivityHour` 埋点
//      + `claimWageVerb` 的逐桶统计）；
//   ② 电量只在受雇期间累积 ⇒ 结算窗口 = [max(hired_at, 上次领取)，now)，首次 = hired_at；
//   ③ 【招工】→【任务】是前端文案面（本文件不涉）；
//   ④ 建项目费 = 从创建者 `$` 扣、入平台收入（uid = −1），费额读 `app_config.project_create_fee`。
//
// 三条结构性纪律（超范围即缺陷）：
//   · **两腿同事务**：建费（用户 −fee / 平台 +fee）、领薪（batt 面 + 币种腿）都必须在**同一个**
//     `withTransaction` 里落地；任一腿失败 ⇒ 整笔回滚（PR-N6 / route #64）。
//   · **电量非 ledger kind**（R-9-6）：batt 走 `batt_account` + `batt_entry`（[0,100] 封顶丢弃），
//     与币种腿两套账本并行。
//   · **零新错误码**（route §49.19.3 硬判据）：400 借 `LEDGER_AMOUNT_INVALID`、409 借
//     `LEDGER_INSUFFICIENT_BALANCE`、404 借 `LEDGER_REF_NOT_FOUND`、403 借 `AUTH_FORBIDDEN`，
//     逐场景理由落在 `details.reason`（字符串不进 33 码闭集）。
//
// ★ 两处「派单与 route 册状态码」的显式取舍（报告里同条披露）：
//   派单要求「领薪：间隔未到 ⇒ 400、未录用 ⇒ 403」；route §49.19.3 原表写 409。
//   本实现取**派单口径**（§49.19.3 自带授权句「具体码回填时可在闭集内择近者替换」）：
//   `wage_interval_not_reached` ⇒ 400 `LEDGER_AMOUNT_INVALID`；`worker_not_hired` ⇒ 403 `AUTH_FORBIDDEN`。
//   其余闸（非招募期 / 满员 / 天数不足 / 他项目在职 / ended 封板 / 缩容低于在职）仍 409。
// ============================================================================
import { createHash, randomInt, randomUUID } from 'crypto';
import { getTransactionPool, readQuery, txQuery, withTransaction, type TxClient } from './db';
import { postEvent } from './ledger';
import { errorMessageOf, normalizeLedgerError } from './ledger-errors';
import { nextSnowflake } from './item-id';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr } from './job-service';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr };

/** 本域出口形状：`ok:true` 带 view（+ 附加顶层键），`ok:false` = 既有 R107 错误体（零新码） */
export type VerbOk<T> = { ok: true; view: T; replay: boolean } & Record<string, unknown>;
export type VerbResult<T> = VerbOk<T> | VerbErr;

// ============================================================================
// 常量（判据真源；改动 = 口径变更，须回写 §40.15）
// ============================================================================

/** 建项目费配置键（§40.15.4） */
export const PROJECT_CREATE_FEE_KEY = 'project_create_fee';
/** 配置缺失 / 非法时的 fail-closed 兜底费额（Kevin 默认 10000 `$`；不发明数值） */
export const PROJECT_CREATE_FEE_DEFAULT = 10000n;
/** 活跃桶电量速率（Kevin ①：2/时） */
export const PROJECT_ACTIVE_BATT_PER_HOUR = 2;
/** 离线桶电量速率（Kevin ①：1/时） */
export const PROJECT_OFFLINE_BATT_PER_HOUR = 1;
/** 单次结算的累积上限（小时；超出不补 —— §40.15.1 PR-3 的 CHECK 同值） */
export const PROJECT_MAX_CLAIM_HOURS = 100;
/** 状态三值闭集（§40.15.2） */
export const PROJECT_STATUSES = ['recruiting', 'working', 'ended'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
/** 合法状态迁移（ended = 终态封板；同值写 = 幂等 no-op） */
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  recruiting: ['working', 'ended'],
  working: ['recruiting', 'ended'],
  ended: [],
};
/** 建费台账 kind：借现取 24 值闭集内的 `currency_create_fee`（**语义窄化债**，见 §40.15.3 授权句） */
export const PROJECT_CREATE_FEE_KIND = 'currency_create_fee' as const;
/** 币种工资腿 = 项目方 → 工作者的 `transfer`（零新 kind；平台不垫付） */
export const PROJECT_WAGE_KIND = 'transfer' as const;
/** batt 流水 reason（`batt_entry.reason` 无 CHECK，取机读常量） */
export const PROJECT_WAGE_BATT_REASON = 'project_wage' as const;
/**
 * 连续领工资奖励：配置键（迁移 0067 · §40.15.4 配置键族，与 `project_create_fee` 同一手法）。
 * 值形：`{"min":"1","max":"5"}`（$ 整数**字符串**，0017 容器约束逼对象包裹）。
 */
export const WAGE_STREAK_BONUS_KEY = 'wage_streak_bonus';
/** 配置缺失 / 非法时的 fail-closed 兜底区间（Kevin：不给就 1–5，含端点） */
export const WAGE_STREAK_BONUS_DEFAULT: { min: number; max: number } = { min: 1, max: 5 };
/** 区间上界护栏（配置写成天文数字 ⇒ 回落默认，不铸巨款） */
export const WAGE_STREAK_BONUS_CEILING = 1_000_000;
/**
 * 响应里的**语义标签**（`bonus_kind`）：不是 ledger kind —— 台账腿借现取闭集内的
 * `invite_first_task_reward`（24 值闭集不动，语义窄化债已登记，见报告）。
 */
export const WAGE_STREAK_BONUS_KIND = 'wage_streak' as const;
/** 奖励台账腿 kind（平台收入 `-1` → 用户 `$`；`-1` debit 白名单已含此值） */
export const WAGE_STREAK_BONUS_LEDGER_KIND = 'invite_first_task_reward' as const;
/** 平台收入账户 uid（不真 burn · §31.5） */
const PLATFORM_UID = -1;
/** `$`（平台内部积分）cid */
const USD_CID = 1;

const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'];
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// ============================================================================
// 出参形状（bigint / numeric 一律字符串 —— route #67）
// ============================================================================
export interface ProjectView {
  project_id: string;
  snowflake_id: string;
  owner_uid: string;
  title: string;
  description: string;
  headcount: number;
  hired_count: number;
  recruit_min_account_days: number;
  wage_batt_per_claim: string;
  wage_cid: string | null;
  wage_currency_amount: string | null;
  wage_interval_hours: number;
  status: string;
  time_created: string | null;
  time_updated: string | null;
}

/**
 * 列表行的**登录态加性面**（route §49.19 R1 增量 · 零新路由）：
 * · `my_role`      —— 本人与该项目的在职关系（`project_worker.status='hired'`）⇒ `'hired'`，否则 `'none'`；
 * · `my_hired_at`  —— 仅 `my_role='hired'` 时有值（`string|null`）；
 * · `next_claim_at`—— `max(hired_at, 上次 claim) + wage_interval_hours`（与 `claimProjectWageVerb`
 *                     ③ 段的结算窗口起点**同一算式**），仅 hired 行有值；
 * 匿名（无登录取向）⇒ **三键缺省**（不是 null —— 前端按 `hasOwn` 判「未登录 / 未在职」）。
 */
export interface ProjectListRow extends ProjectView {
  my_role?: 'hired' | 'none';
  my_hired_at?: string | null;
  next_claim_at?: string | null;
}

export interface ProjectWorkerView {
  worker_id: string;
  project_id: string;
  uid: string;
  status: string;
  hired_at: string | null;
  left_at: string | null;
}

export interface WageClaimView {
  claim_id: string;
  project_id: string;
  uid: string;
  batt_credited: string;
  currency_cid: string | null;
  currency_amount: string | null;
  hours_elapsed: string;
  active_hours: string;
  active_rate: number;
  offline_hours: string;
  offline_rate: number;
  batt_after: number | null;
  claim_key: string;
  time_created: string | null;
  /** ★ 加性（Kevin 需求第 4 条）：连续领工资次数 = 本项目**累计**领取行数（含本次；离职重入不清零） */
  streak: number;
  /** ★ 加性：本次随机奖励（`$` 整数十进制串；`'0'` = 平台收入账户不足 ⇒ 奖励腿跳过，领取仍成功） */
  bonus_amount: string;
  /** ★ 加性：奖励**语义标签**（`wage_streak`，非 ledger kind） */
  bonus_kind: string;
}

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

export const normalizeProjectRow = (row: Row): ProjectView => ({
  project_id: str(row.project_id),
  snowflake_id: str(row.snowflake_id),
  owner_uid: str(row.owner_uid),
  title: str(row.title),
  description: str(row.description),
  headcount: int(row.headcount),
  hired_count: int(row.hired_count),
  recruit_min_account_days: int(row.recruit_min_account_days),
  wage_batt_per_claim: str(row.wage_batt_per_claim),
  wage_cid: strOrNull(row.wage_cid),
  wage_currency_amount: strOrNull(row.wage_currency_amount),
  wage_interval_hours: int(row.wage_interval_hours),
  status: str(row.status),
  time_created: iso(row.time_created),
  time_updated: iso(row.time_updated),
});

const normalizeWorkerView = (row: Row): ProjectWorkerView => ({
  worker_id: str(row.worker_id),
  project_id: str(row.project_id),
  uid: str(row.uid),
  status: str(row.status),
  hired_at: iso(row.hired_at),
  left_at: iso(row.left_at),
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
/** 404：项目不存在（借 `LEDGER_REF_NOT_FOUND`） */
const notFound = (reason = 'project_not_found'): VerbErr => fail(404, 'LEDGER_REF_NOT_FOUND', reason);
/** 409：状态 / 余额 / 名额类冲突（借 `LEDGER_INSUFFICIENT_BALANCE`） */
const conflict = (reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_INSUFFICIENT_BALANCE', reason, extra);
/** 403：权限 / 身份类（借 `AUTH_FORBIDDEN`） */
const forbidden = (reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(403, 'AUTH_FORBIDDEN', reason, extra);

const isVerbErr = (v: unknown): v is VerbErr => Boolean(v) && typeof v === 'object' && (v as VerbErr).ok === false;

/**
 * 事务壳：生产路径无 `ex` ⇒ `withTransaction`（失败整体回滚）；
 * 门 / 探针注入 `ex` ⇒ 复用调用方事务（同一条 SQL 语义、零第二套写入面），
 * 使「真 service 路径 + 回滚事务 ⇒ 零残留」成为可测形态（p59b/p61 同族）。
 */
const runInTx = async <T>(ex: TxClient | undefined, fn: (tx: TxClient) => Promise<T>): Promise<T> =>
  (ex ? fn(ex) : withTransaction(fn));

// ============================================================================
// 幂等键（§4.5：前缀闭集 cli:/biz:/cm:/ops:；调用方未给 ⇒ 每次新键）
// ============================================================================
export const resolveProjectIdempotencyKey = (raw: unknown): { key: string; derived: boolean } | null => {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { key: `cli:${randomUUID()}`, derived: true };
  if (text.length > 200 || CONTROL_CHARS.test(text)) return null;
  if (!KEY_PREFIXES.some((p) => text.startsWith(p))) return null;
  return { key: text, derived: false };
};

const fingerprintOf = (parts: unknown[]): string =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);

// ============================================================================
// 入参校验（create 与 patch 共用；patch 允许部分字段）
// ============================================================================
const FORBIDDEN_CREATE_KEYS = ['status', 'snowflake_id', 'project_id', 'owner_uid'];
const FORBIDDEN_PATCH_KEYS = ['snowflake_id', 'project_id', 'owner_uid', 'create_key'];

const CREATE_KEYS = [
  'title', 'description', 'headcount', 'recruit_min_account_days',
  'wage_batt_per_claim', 'wage_cid', 'wage_currency_amount', 'wage_interval_hours',
  'create_key',
];
/** PATCH 合法键 = 建项八键 + `status`（状态机）；`create_key` 不是可改字段 */
const PATCH_KEYS = [
  'title', 'description', 'headcount', 'recruit_min_account_days',
  'wage_batt_per_claim', 'wage_cid', 'wage_currency_amount', 'wage_interval_hours', 'status',
];

export interface ProjectPayload {
  title?: string;
  description?: string;
  headcount?: number;
  recruit_min_account_days?: number;
  wage_batt_per_claim?: string;
  wage_cid?: string | null;
  wage_currency_amount?: string | null;
  wage_interval_hours?: number;
}

const POSITIVE_INT_TEXT = /^\d+$/;
const DECIMAL_TEXT = /^\d+(\.\d{1,2})?$/;

const asPositiveInt = (v: unknown): number | null => {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!POSITIVE_INT_TEXT.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const asNonNegInt = (v: unknown): number | null => {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (text === '0') return 0;
  if (!POSITIVE_INT_TEXT.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

const asPositiveDecimal = (v: unknown): string | null => {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!DECIMAL_TEXT.test(text)) return null;
  return Number(text) > 0 ? text : null;
};

/**
 * 解析 body：`strict` = create（八键全量 + 禁带四键），否则 = patch（任意子集）。
 * 返回 `{ payload }` 或 `{ err }`（VerbErr 形态，直接交路由层 `sendVerbError`）。
 */
export const parseProjectPayload = (
  body: unknown,
  mode: 'create' | 'patch',
): { payload: ProjectPayload } | { err: VerbErr } => {
  const input = (body || {}) as Record<string, unknown>;
  const forbidden = (mode === 'create' ? FORBIDDEN_CREATE_KEYS : FORBIDDEN_PATCH_KEYS)
    .filter((k) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== null && input[k] !== undefined);
  if (forbidden.length) {
    return { err: badRequest('NOT_SUPPORTED', { field: forbidden[0], forbidden_keys: forbidden }) };
  }
  {
    const legal = mode === 'create' ? CREATE_KEYS : PATCH_KEYS;
    const unknown = Object.keys(input).filter((k) => !legal.includes(k));
    if (unknown.length) {
      return { err: badRequest('NOT_SUPPORTED', { field: unknown[0], unknown_keys: unknown, legal_keys: legal }) };
    }
  }

  const out: ProjectPayload = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);

  if (mode === 'create' || has('title')) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title || title.length > 200) {
      return { err: badRequest('PROJECT_TITLE_INVALID', { field: 'title', expected: 'non_empty_string<=200' }) };
    }
    out.title = title;
  }
  if (mode === 'create' || has('description')) {
    const desc = input.description === undefined || input.description === null ? '' : input.description;
    if (typeof desc !== 'string' || desc.length > 20000) {
      return { err: badRequest('PROJECT_DESCRIPTION_INVALID', { field: 'description', expected: 'string<=20000' }) };
    }
    out.description = desc;
  }
  if (mode === 'create' || has('headcount')) {
    const n = asPositiveInt(input.headcount);
    if (n === null) return { err: badRequest('PROJECT_HEADCOUNT_INVALID', { field: 'headcount', expected: 'positive_integer' }) };
    out.headcount = n;
  }
  if (mode === 'create' || has('recruit_min_account_days')) {
    const raw = input.recruit_min_account_days === undefined || input.recruit_min_account_days === null
      ? 0 : input.recruit_min_account_days;
    const n = asNonNegInt(raw);
    if (n === null) {
      return { err: badRequest('PROJECT_MIN_DAYS_INVALID', { field: 'recruit_min_account_days', expected: 'non_negative_integer' }) };
    }
    out.recruit_min_account_days = n;
  }
  if (mode === 'create' || has('wage_batt_per_claim')) {
    const text = asPositiveDecimal(input.wage_batt_per_claim);
    if (text === null) {
      return { err: badRequest('PROJECT_WAGE_BATT_INVALID', { field: 'wage_batt_per_claim', expected: 'positive_number' }) };
    }
    out.wage_batt_per_claim = text;
  }
  if (mode === 'create' || has('wage_interval_hours')) {
    const n = asPositiveInt(input.wage_interval_hours);
    if (n === null || n < 1 || n > 100) {
      return { err: badRequest('PROJECT_INTERVAL_INVALID', { field: 'wage_interval_hours', expected: 'integer_1..100' }) };
    }
    out.wage_interval_hours = n;
  }

  // 两币字段：同现同缺（create 必判；patch 判「本次提供的两键」是否成对）
  const cidGiven = has('wage_cid');
  const amountGiven = has('wage_currency_amount');
  const cidNull = input.wage_cid === null || input.wage_cid === undefined || input.wage_cid === '';
  const amountNull = input.wage_currency_amount === null || input.wage_currency_amount === undefined
    || input.wage_currency_amount === '';
  if (cidNull !== amountNull) {
    return {
      err: badRequest('PROJECT_WAGE_CURRENCY_PAIR_REQUIRED', {
        fields: ['wage_cid', 'wage_currency_amount'],
        hint: 'wage_cid 与 wage_currency_amount 必须同空同非空',
      }),
    };
  }
  if (cidGiven || amountGiven) {
    if (cidNull && amountNull) {
      out.wage_cid = null;
      out.wage_currency_amount = null;
    } else {
      const cid = asPositiveInt(input.wage_cid);
      const amount = asPositiveDecimal(input.wage_currency_amount);
      if (cid === null || cid === USD_CID) {
        return { err: badRequest('PROJECT_WAGE_CID_INVALID', { field: 'wage_cid', expected: 'positive_integer_not_1' }) };
      }
      if (amount === null) {
        return { err: badRequest('PROJECT_WAGE_AMOUNT_INVALID', { field: 'wage_currency_amount', expected: 'positive_number' }) };
      }
      out.wage_cid = String(cid);
      out.wage_currency_amount = amount;
    }
  } else if (mode === 'create') {
    out.wage_cid = null;
    out.wage_currency_amount = null;
  }

  return { payload: out };
};

// ============================================================================
// 读口（公开 · 只读 · 走只读池）
// ============================================================================
const PROJECT_LIST_SQL = `
  SELECT p.*,
         COALESCE((SELECT count(*)::int FROM public.project_worker AS w
                    WHERE w.project_id = p.project_id AND w.status = 'hired'), 0) AS hired_count
    FROM public.project AS p
   WHERE p.status IN ('recruiting', 'working')
   ORDER BY p.time_created DESC, p.project_id DESC`;

/**
 * 登录态列表 SQL（`project_worker_single_hired_uniq` ⇒ 每个 uid 至多一条 hired 行 ⇒ LEFT JOIN 不放大行数）。
 * 「上次 claim」按 `max(time_created)` 取 —— 与 `claimProjectWageVerb` ③ 段同一口径。
 */
const PROJECT_LIST_VIEWER_SQL = `
  SELECT p.*,
         COALESCE((SELECT count(*)::int FROM public.project_worker AS w
                    WHERE w.project_id = p.project_id AND w.status = 'hired'), 0) AS hired_count,
         (v.worker_id IS NOT NULL) AS viewer_hired,
         v.hired_at AS viewer_hired_at,
         (SELECT max(cl.time_created) FROM public.project_wage_claim AS cl
           WHERE cl.project_id = p.project_id AND cl.uid = $1::bigint) AS viewer_last_claim_at
    FROM public.project AS p
    LEFT JOIN public.project_worker AS v
      ON v.project_id = p.project_id AND v.uid = $1::bigint AND v.status = 'hired'
   WHERE p.status IN ('recruiting', 'working')
   ORDER BY p.time_created DESC, p.project_id DESC`;

/** 读口 SQL 执行：门内传入 `ex` 复用事务连接（迁移干跑未提交 ⇒ 别的连接看不到表）；HTTP 路径不传 = 只读池 */
const readRows = async <R = Row>(text: string, params: unknown[], ex?: TxClient): Promise<R[]> =>
  (ex ? txQuery<R>(ex, text, params) : readQuery<R>(text, params));

/** `base + hours` ⇒ ISO（基值为空 / 坏值 ⇒ null，前端按「无倒计时」降级，**不猜**） */
const addHoursIso = (base: string | null, hours: number): string | null => {
  if (base === null) return null;
  const t = Date.parse(base);
  if (!Number.isFinite(t)) return null;
  return new Date(t + hours * 3_600_000).toISOString();
};

/** 登录态行：在职 ⇒ `my_role='hired'` + `my_hired_at` + `next_claim_at`；否则 `my_role='none'`（两键 null） */
const normalizeProjectListRow = (row: Row): ProjectListRow => {
  const base = normalizeProjectRow(row);
  if (row.viewer_hired !== true) return { ...base, my_role: 'none', my_hired_at: null, next_claim_at: null };
  const hiredAt = iso(row.viewer_hired_at);
  const lastClaimAt = iso(row.viewer_last_claim_at);
  const windowStart = hiredAt === null
    ? lastClaimAt
    : lastClaimAt === null || Date.parse(lastClaimAt) < Date.parse(hiredAt) ? hiredAt : lastClaimAt;
  return {
    ...base,
    my_role: 'hired',
    my_hired_at: hiredAt,
    next_claim_at: addHoursIso(windowStart, base.wage_interval_hours),
  };
};

/**
 * R1 列表。`opts.viewerUid` 缺省 ⇒ **匿名面**：行仍是原 15 键（三键缺省）；
 * 有值 ⇒ 登录态加性三键（**零新路由、零第二套读口**）。
 */
export const listProjects = async (
  ex?: TxClient,
  opts?: { viewerUid?: number | null },
): Promise<ProjectListRow[]> => {
  const viewerUid = opts?.viewerUid;
  if (viewerUid === null || viewerUid === undefined || !Number.isSafeInteger(viewerUid) || viewerUid <= 0) {
    const rows = await readRows<Row>(PROJECT_LIST_SQL, [], ex);
    return rows.map(normalizeProjectRow);
  }
  const rows = await readRows<Row>(PROJECT_LIST_VIEWER_SQL, [String(viewerUid)], ex);
  return rows.map(normalizeProjectListRow);
};

/** 单语句双形态（`project_id` OR `snowflake_id`，一次往返 —— route #67） */
export const getProjectByRef = async (ref: string, ex?: TxClient): Promise<ProjectView | null> => {
  if (!/^\d+$/.test(ref)) return null;
  const rows = await readRows<Row>(
    `SELECT p.*, COALESCE((SELECT count(*)::int FROM public.project_worker AS w
                            WHERE w.project_id = p.project_id AND w.status = 'hired'), 0) AS hired_count
       FROM public.project AS p
      WHERE p.project_id = $1::bigint OR p.snowflake_id = $1::bigint
      LIMIT 1`,
    [ref],
    ex,
  );
  return rows.length ? normalizeProjectRow(rows[0]) : null;
};

const REF_PATTERN = /^\d+$/;
export const isProjectRef = (ref: unknown): boolean =>
  typeof ref === 'string' && REF_PATTERN.test(ref) && ref.length <= 20;

// ============================================================================
// 建项目（R3）：建行 + 扣建费 + 平台收入 = 同一事务同一幂等键
// ============================================================================
const readCreateFee = async (tx: TxClient): Promise<bigint> => {
  const rows = await txQuery<Row>(
    tx,
    `SELECT value->>'fee' AS fee FROM public.app_config WHERE key = $1 LIMIT 1`,
    [PROJECT_CREATE_FEE_KEY],
  );
  const raw = rows.length ? str(rows[0].fee).trim() : '';
  if (!/^\d+$/.test(raw)) return PROJECT_CREATE_FEE_DEFAULT; // fail-closed 兜底（缺键 / 非法）
  const value = BigInt(raw);
  return value > 0n ? value : PROJECT_CREATE_FEE_DEFAULT;
};

export const createProjectVerb = async (input: {
  actorUid: number;
  body: unknown;
  headerKey: unknown;
  /** 门 / 探针注入的既有事务（生产不传） */
  ex?: TxClient;
}): Promise<VerbResult<ProjectView>> => {
  const parsed = parseProjectPayload(input.body, 'create');
  if ('err' in parsed) return parsed.err;
  const p = parsed.payload;

  const keyed = resolveProjectIdempotencyKey(
    input.headerKey ?? (input.body as Record<string, unknown>)?.create_key,
  );
  if (keyed === null) {
    return badRequest('IDEMPOTENCY_KEY_INVALID', { field: 'idempotency-key', expected: 'cli:|biz:|cm:|ops: prefix' });
  }
  const key = keyed.key;
  const fingerprint = fingerprintOf([
    'project.create', input.actorUid, p.title, p.headcount, p.recruit_min_account_days,
    p.wage_batt_per_claim, p.wage_cid, p.wage_currency_amount, p.wage_interval_hours,
  ]);

  try {
    return await runInTx<VerbResult<ProjectView>>(input.ex, async (tx) => {
      // 幂等重放：同键已有分录 ⇒ 回库内真值（不重复建行、不重复扣费）
      const prior = await txQuery<Row>(
        tx,
        `SELECT ref_id::text AS ref_id FROM public.ledger_entry WHERE idempotency_key = $1 LIMIT 1`,
        [key],
      );
      if (prior.length) {
        const pid = str(prior[0].ref_id);
        const rows = await txQuery<Row>(
          tx,
          `SELECT p.*, COALESCE((SELECT count(*)::int FROM public.project_worker AS w
                                  WHERE w.project_id = p.project_id AND w.status = 'hired'), 0) AS hired_count
             FROM public.project AS p WHERE p.project_id = $1::bigint LIMIT 1`,
          [pid],
        );
        if (!rows.length) {
          return conflict('project_create_replay_lost', { idempotency_key: key });
        }
        return { ok: true, view: normalizeProjectRow(rows[0]), replay: true };
      }

      const fee = await readCreateFee(tx);

      // 余额前置只读（**早于任何写入**：余额不足 ⇒ 409 + 零残留；账本腿仍是最终执法者）
      const balRows = await txQuery<Row>(
        tx,
        `SELECT COALESCE((SELECT a.balance FROM public.account AS a WHERE a.uid = $1::bigint AND a.cid = $2::bigint), 0)::text AS balance`,
        [String(input.actorUid), String(USD_CID)],
      );
      const balance = BigInt(str(balRows.length ? balRows[0].balance : '0') || '0');
      if (balance < fee) {
        return conflict('project_create_fee_insufficient', {
          fee: fee.toString(),
          balance: balance.toString(),
          cid: String(USD_CID),
        });
      }

      // 币种存在性 + listed（建项目即校验，早于任何写入）
      if (p.wage_cid !== null && p.wage_cid !== undefined) {
        const cur = await txQuery<Row>(
          tx,
          `SELECT cid::text AS cid, status FROM public.currency WHERE cid = $1::bigint LIMIT 1`,
          [p.wage_cid],
        );
        if (!cur.length) return conflict('project_wage_currency_not_found', { wage_cid: p.wage_cid });
        if (str(cur[0].status) !== 'listed') {
          return conflict('project_wage_currency_not_listed', { wage_cid: p.wage_cid, status: str(cur[0].status) });
        }
      }

      let inserted: Row[];
      try {
        inserted = await txQuery<Row>(
          tx,
          `INSERT INTO public.project
             (snowflake_id, owner_uid, title, description, headcount, recruit_min_account_days,
              wage_batt_per_claim, wage_cid, wage_currency_amount, wage_interval_hours, status)
           VALUES ($1::bigint, $2::bigint, $3::text, $4::text, $5::int, $6::int,
                   $7::numeric, $8::bigint, $9::numeric, $10::int, 'recruiting')
           RETURNING *`,
          [
            nextSnowflake().toString(), String(input.actorUid), p.title, p.description ?? '',
            p.headcount, p.recruit_min_account_days ?? 0, p.wage_batt_per_claim,
            p.wage_cid ?? null, p.wage_currency_amount ?? null, p.wage_interval_hours,
          ],
        );
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === '23505') return conflict('project_snowflake_collision', {});
        throw e;
      }
      const row = inserted[0];
      const projectId = str(row.project_id);

      // 建费两腿（用户 −fee / 平台 −1 +fee，同 kind · 同一幂等键 · 同一事务）
      await postEvent({
        op: 'entries',
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        refType: 'system',
        refId: projectId,
        memo: `project_create_fee:${projectId}`,
        entries: [
          { uid: String(input.actorUid), cid: String(USD_CID), delta: (-fee).toString(), kind: PROJECT_CREATE_FEE_KIND },
          { uid: String(PLATFORM_UID), cid: String(USD_CID), delta: fee.toString(), kind: PROJECT_CREATE_FEE_KIND },
        ],
        ex: tx as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
      });

      return {
        ok: true,
        view: normalizeProjectRow({ ...row, hired_count: 0 }),
        replay: false,
        fee: fee.toString(),
      } as VerbResult<ProjectView>;
    });
  } catch (e) {
    const normalized = normalizeLedgerError(e);
    if (normalized.code === 'LEDGER_INSUFFICIENT_BALANCE') {
      return conflict('project_create_fee_insufficient', {
        fee: PROJECT_CREATE_FEE_DEFAULT.toString(),
        project_create_fee: await currentCreateFee(),
      });
    }
    throw e;
  }
};

/** 读当前费额（仅用于错误详情 / 门套读数；失败 ⇒ 兜底常量） */
export const currentCreateFee = async (): Promise<string> => {
  try {
    const rows = await readQuery<Row>(
      `SELECT value->>'fee' AS fee FROM public.app_config WHERE key = $1 LIMIT 1`,
      [PROJECT_CREATE_FEE_KEY],
    );
    const raw = rows.length ? str(rows[0].fee).trim() : '';
    return /^\d+$/.test(raw) && BigInt(raw) > 0n ? raw : PROJECT_CREATE_FEE_DEFAULT.toString();
  } catch {
    return PROJECT_CREATE_FEE_DEFAULT.toString();
  }
};

// ----------------------------------------------------------------------------
// 连续领工资随机奖励（Kevin 需求第 4 条）：区间解析 / 读配置 / 抽样
// ----------------------------------------------------------------------------
export interface WageStreakBonusRange {
  min: number;
  max: number;
  /** `app_config` = 读到并校验通过；`default` = 缺行 / 非法 / 读失败 ⇒ fail-closed 1–5 */
  source: 'app_config' | 'default';
}

const DIGITS_ONLY = /^[0-9]+$/;

/** 十进制数字串（或安全整数 number）⇒ 正整数；负数 / 小数 / 科学计数 / 空串 ⇒ null */
const toPositiveInt = (v: unknown): number | null => {
  const text = typeof v === 'number'
    ? (Number.isSafeInteger(v) ? String(v) : '')
    : (typeof v === 'string' ? v.trim() : '');
  if (!DIGITS_ONLY.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
};

/**
 * 区间解析（纯函数 · 门可直接调）：
 *   · 必须是对象包裹的 `{"min":"1","max":"5"}`（0017 容器约束的同款形状）；数组 / 标量 / null ⇒ 默认；
 *   · `min` / `max` 非十进制数字串 ⇒ 默认（不「猜」、不做四舍五入）；
 *   · `0 < min <= max <= CEILING` 不满足 ⇒ 默认（fail-closed：坏配置绝不放大奖励）。
 */
export const parseWageStreakBonusRange = (value: unknown): WageStreakBonusRange => {
  const fallback = { min: WAGE_STREAK_BONUS_DEFAULT.min, max: WAGE_STREAK_BONUS_DEFAULT.max, source: 'default' as const };
  let obj: unknown = value;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return fallback; }
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return fallback;
  const rec = obj as Record<string, unknown>;
  const min = toPositiveInt(rec.min);
  const max = toPositiveInt(rec.max);
  if (min === null || max === null) return fallback;
  if (min <= 0 || max < min) return fallback;
  if (min > WAGE_STREAK_BONUS_CEILING || max > WAGE_STREAK_BONUS_CEILING) return fallback;
  return { min, max, source: 'app_config' };
};

/** 读当前区间（`ex` 给出 ⇒ 在该事务内读，供门套在未提交的迁移上真跑；失败 ⇒ 默认） */
export const currentWageStreakBonusRange = async (ex?: TxClient): Promise<WageStreakBonusRange> => {
  try {
    const sql = `SELECT value FROM public.app_config WHERE key = $1 LIMIT 1`;
    const rows = ex
      ? await txQuery<Row>(ex, sql, [WAGE_STREAK_BONUS_KEY])
      : await readQuery<Row>(sql, [WAGE_STREAK_BONUS_KEY]);
    if (!rows.length) return { min: WAGE_STREAK_BONUS_DEFAULT.min, max: WAGE_STREAK_BONUS_DEFAULT.max, source: 'default' };
    return parseWageStreakBonusRange(rows[0].value);
  } catch {
    return { min: WAGE_STREAK_BONUS_DEFAULT.min, max: WAGE_STREAK_BONUS_DEFAULT.max, source: 'default' };
  }
};

/** 均匀抽样 `[min, max]`（含端点；`crypto.randomInt` 无模偏） —— 纯随机，无状态 */
export const pickWageStreakBonus = (range: { min: number; max: number }): number => {
  const min = Math.max(1, Math.trunc(range.min));
  const max = Math.max(min, Math.trunc(range.max));
  return randomInt(min, max + 1);
};

// ============================================================================
// 招工（R4）：满足条件即直接录用；招满当次事务内自动转 working
// ============================================================================
const lockProjectByRef = async (tx: TxClient, ref: string): Promise<Row | null> => {
  if (!isProjectRef(ref)) return null;
  const rows = await txQuery<Row>(
    tx,
    `SELECT * FROM public.project
      WHERE project_id = $1::bigint OR snowflake_id = $1::bigint
      LIMIT 1
      FOR UPDATE`,
    [ref],
  );
  return rows.length ? rows[0] : null;
};

const hiredCountOf = async (tx: TxClient, projectId: string): Promise<number> => {
  const rows = await txQuery<Row>(
    tx,
    `SELECT count(*)::int AS n FROM public.project_worker WHERE project_id = $1::bigint AND status = 'hired'`,
    [projectId],
  );
  return rows.length ? int(rows[0].n) : 0;
};

export const applyProjectVerb = async (input: {
  actorUid: number;
  ref: string;
  ex?: TxClient;
}): Promise<VerbResult<{ worker: ProjectWorkerView; project: ProjectView }>> => {
  if (!isProjectRef(input.ref)) return notFound();

  return runInTx<VerbResult<{ worker: ProjectWorkerView; project: ProjectView }>>(input.ex, async (tx) => {
    const project = await lockProjectByRef(tx, input.ref);
    if (!project) return notFound();
    const projectId = str(project.project_id);
    const uid = String(input.actorUid);

    // ① 本项目已在职 ⇒ 200 no-op 回放（不判招募期：招满后在职者重投仍应 200）
    const mine = await txQuery<Row>(
      tx,
      `SELECT * FROM public.project_worker WHERE project_id = $1::bigint AND uid = $2::bigint AND status = 'hired' LIMIT 1`,
      [projectId, uid],
    );
    if (mine.length) {
      return {
        ok: true,
        view: { worker: normalizeWorkerView(mine[0]), project: normalizeProjectRow({ ...project, hired_count: await hiredCountOf(tx, projectId) }) },
        replay: true,
      } as VerbResult<{ worker: ProjectWorkerView; project: ProjectView }>;
    }

    // ② 招募期
    if (str(project.status) !== 'recruiting') {
      return conflict('project_not_recruiting', { status: str(project.status) });
    }
    // ③ 名额
    const hired = await hiredCountOf(tx, projectId);
    if (hired >= int(project.headcount)) {
      return conflict('project_headcount_full', { headcount: int(project.headcount), hired_count: hired });
    }
    // ④ 注册天数
    const minDays = int(project.recruit_min_account_days);
    if (minDays > 0) {
      const reg = await txQuery<Row>(
        tx,
        `SELECT (now() - u.time_reg) >= ($2::int * interval '1 day') AS ok, u.time_reg
           FROM public.users AS u WHERE u.uid = $1::bigint LIMIT 1`,
        [uid, minDays],
      );
      if (!reg.length || reg[0].ok !== true) {
        return conflict('project_min_days_unmet', {
          recruit_min_account_days: minDays,
          time_reg: iso(reg.length ? reg[0].time_reg : null),
        });
      }
    }
    // ⑤ 他项目在职（DB 部分唯一索引兜底同码）
    const other = await txQuery<Row>(
      tx,
      `SELECT project_id::text AS project_id FROM public.project_worker WHERE uid = $1::bigint AND status = 'hired' LIMIT 1`,
      [uid],
    );
    if (other.length) {
      return conflict('worker_already_hired', { project_id: str(other[0].project_id) });
    }

    let inserted: Row[];
    try {
      inserted = await txQuery<Row>(
        tx,
        `INSERT INTO public.project_worker (project_id, uid, status) VALUES ($1::bigint, $2::bigint, 'hired') RETURNING *`,
        [projectId, uid],
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return conflict('worker_already_hired', {});
      throw e;
    }

    // ⑥ 招满 ⇒ 同事务自动翻 working（非管理员边、零定时器 —— §40.15.2）
    const after = hired + 1;
    let status = str(project.status);
    if (after >= int(project.headcount) && status === 'recruiting') {
      const flipped = await txQuery<Row>(
        tx,
        `UPDATE public.project SET status = 'working' WHERE project_id = $1::bigint RETURNING *`,
        [projectId],
      );
      if (flipped.length) {
        return {
          ok: true,
          view: { worker: normalizeWorkerView(inserted[0]), project: normalizeProjectRow({ ...flipped[0], hired_count: after }) },
          replay: false,
        } as VerbResult<{ worker: ProjectWorkerView; project: ProjectView }>;
      }
    }

    return {
      ok: true,
      view: { worker: normalizeWorkerView(inserted[0]), project: normalizeProjectRow({ ...project, hired_count: after }) },
      replay: false,
    } as VerbResult<{ worker: ProjectWorkerView; project: ProjectView }>;
  });
};

// ============================================================================
// 领工资（R5）：逐小时桶结算 batt + 币种定额，两腿同事务
// ============================================================================
const CLAIM_WINDOW_SQL = `
  SELECT
    floor(extract(epoch FROM (now() - $1::timestamptz)) / 3600)::int AS hours,
    (SELECT count(*)::int
       FROM public.user_activity_hour AS a
      WHERE a.uid = $2::bigint
        AND ((a.day::timestamp + make_interval(hours => a.hour)) AT TIME ZONE 'UTC')
              >= date_trunc('hour', $1::timestamptz)
        AND ((a.day::timestamp + make_interval(hours => a.hour)) AT TIME ZONE 'UTC')
              <  date_trunc('hour', now())) AS active_hours`;

export const claimProjectWageVerb = async (input: {
  actorUid: number;
  ref: string;
  ex?: TxClient;
}): Promise<VerbResult<WageClaimView>> => {
  if (!isProjectRef(input.ref)) return notFound();

  return runInTx<VerbResult<WageClaimView>>(input.ex, async (tx) => {
    const project = await lockProjectByRef(tx, input.ref);
    if (!project) return notFound();
    const projectId = str(project.project_id);
    const uid = String(input.actorUid);

    // ① 在职行锁（防双领竞态 —— route #65）
    const workerRows = await txQuery<Row>(
      tx,
      `SELECT * FROM public.project_worker
        WHERE project_id = $1::bigint AND uid = $2::bigint AND status = 'hired'
        LIMIT 1 FOR UPDATE`,
      [projectId, uid],
    );
    if (!workerRows.length) return forbidden('worker_not_hired', { project_id: projectId });
    const worker = workerRows[0];

    // ② ended 封板
    if (str(project.status) === 'ended') return conflict('project_ended_frozen', { project_id: projectId });

    // ③ 结算窗口 = [max(hired_at, 上次领取)，now)，首次 = hired_at（Kevin ②）
    const lastRows = await txQuery<Row>(
      tx,
      `SELECT max(time_created) AS last_claim FROM public.project_wage_claim
        WHERE project_id = $1::bigint AND uid = $2::bigint`,
      [projectId, uid],
    );
    const lastClaim = lastRows.length ? lastRows[0].last_claim : null;
    const startRows = await txQuery<Row>(
      tx,
      `SELECT GREATEST($1::timestamptz, COALESCE($2::timestamptz, $1::timestamptz)) AS window_start`,
      [iso(worker.hired_at) ?? new Date().toISOString(), lastClaim ? iso(lastClaim) : null],
    );
    const windowStart = iso(startRows[0].window_start) ?? new Date().toISOString();

    const winRows = await txQuery<Row>(tx, CLAIM_WINDOW_SQL, [windowStart, uid]);
    const elapsedRaw = Math.max(0, int(winRows[0].hours));
    const intervalHours = int(project.wage_interval_hours);
    if (elapsedRaw < intervalHours) {
      return badRequest('wage_interval_not_reached', {
        wage_interval_hours: intervalHours,
        hours_since_window_start: elapsedRaw,
        window_start: windowStart,
      });
    }

    // ④ 100h 上限（超出不补）与逐小时桶归属
    const hoursElapsed = Math.min(elapsedRaw, PROJECT_MAX_CLAIM_HOURS);
    const activeHours = Math.min(Math.max(0, int(winRows[0].active_hours)), hoursElapsed);
    const offlineHours = hoursElapsed - activeHours;
    const battCredited = PROJECT_ACTIVE_BATT_PER_HOUR * activeHours + PROJECT_OFFLINE_BATT_PER_HOUR * offlineHours;
    const windowEnd = new Date().toISOString();
    const claimKey = `biz:project:claim:${projectId}:${uid}:${Date.parse(windowEnd)}`;

    // ⑤ claim 行（先落行 → 拿到 claim_id 作 batt 幂等键的引用）
    const claimRows = await txQuery<Row>(
      tx,
      `INSERT INTO public.project_wage_claim
         (project_id, uid, batt_credited, currency_cid, currency_amount, hours_elapsed, active_hours, offline_hours)
       VALUES ($1::bigint, $2::bigint, $3::numeric, $4::bigint, $5::numeric, $6::numeric, $7::numeric, $8::numeric)
       RETURNING *`,
      [
        projectId, uid, String(battCredited),
        project.wage_cid === null || project.wage_cid === undefined ? null : str(project.wage_cid),
        project.wage_currency_amount === null || project.wage_currency_amount === undefined ? null : str(project.wage_currency_amount),
        String(hoursElapsed), String(activeHours), String(offlineHours),
      ],
    );
    const claim = claimRows[0];
    const claimId = str(claim.claim_id);

    // ⑥ batt 腿（[0,100] 封顶丢弃；delta=0 不落 batt_entry —— 移动守卫）
    let battAfter: number | null = null;
    if (battCredited > 0) {
      const curRows = await txQuery<Row>(
        tx,
        `SELECT COALESCE((SELECT b.batt FROM public.batt_account AS b WHERE b.uid = $1::bigint FOR UPDATE), 0)::int AS batt`,
        [uid],
      );
      const before = curRows.length ? int(curRows[0].batt) : 0;
      const after = Math.min(before + battCredited, 100);
      const delta = after - before;
      battAfter = after;
      if (delta > 0) {
        await txQuery<Row>(
          tx,
          `INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint, $2::int)
             ON CONFLICT (uid) DO UPDATE SET batt = EXCLUDED.batt
             RETURNING batt`,
          [uid, after],
        );
        await txQuery<Row>(
          tx,
          `INSERT INTO public.batt_entry (uid, delta, batt_after, reason, idempotency_key, ref_type, ref_id, memo)
           VALUES ($1::bigint, $2::int, $3::int, $4::text, $5::text, 'project', $6::bigint, $7::text)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [uid, delta, after, PROJECT_WAGE_BATT_REASON, `${claimKey}:batt`, claimId, `project_wage:${projectId}`],
        );
      }
    }

    // ⑦ 币种腿（每次固定额 · 项目方 → 工作者 · 零新 kind）
    const wageCid = project.wage_cid === null || project.wage_cid === undefined ? null : str(project.wage_cid);
    if (wageCid !== null) {
      const cur = await txQuery<Row>(
        tx,
        `SELECT status FROM public.currency WHERE cid = $1::bigint LIMIT 1`,
        [wageCid],
      );
      if (!cur.length) return conflict('project_wage_currency_not_found', { wage_cid: wageCid });
      if (str(cur[0].status) !== 'listed') {
        return conflict('project_wage_currency_not_listed', { wage_cid: wageCid, status: str(cur[0].status) });
      }
      // 同一人既是项目方又是工作者 ⇒ 左右互抵，跳过账本腿（claim 行仍留名义额）
      if (str(project.owner_uid) !== uid) {
        try {
          await postEvent({
            op: 'transfer',
            idempotencyKey: `${claimKey}:wage`,
            requestFingerprint: fingerprintOf(['project.claim', projectId, claimId]),
            refType: 'system',
            refId: projectId,
            memo: `project_wage:${projectId}:${claimId}`,
            fromUid: str(project.owner_uid),
            toUid: uid,
            cid: wageCid,
            amount: str(project.wage_currency_amount),
            ex: tx as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
          });
        } catch (e) {
          const normalized = normalizeLedgerError(e);
          if (normalized.code === 'LEDGER_INSUFFICIENT_BALANCE') {
            return conflict('project_wage_pool_insufficient', { wage_cid: wageCid, owner_uid: str(project.owner_uid) });
          }
          throw e;
        }
      }
    }

    // ⑧ 连续领工资：次数 = **本项目累计**领取行数（含本次 —— 行已在 ⑤ 落盘）
    //    口径决定（一句话可改）：按 (project_id, uid) 累计，**离职后重新入职不清零**
    //    （行保留不删 ⇒ 派生即真源，不落冗余列、无两处真源）。
    const streakRows = await txQuery<Row>(
      tx,
      `SELECT count(*)::int AS n FROM public.project_wage_claim
        WHERE project_id = $1::bigint AND uid = $2::bigint`,
      [projectId, uid],
    );
    const streak = Math.max(1, int(streakRows.length ? streakRows[0].n : 0));

    // ⑨ 随机奖励腿（平台收入 −1 → 用户 `$`；kind 借闭集内 invite_first_task_reward，零新 kind）
    //    · 区间读 `app_config.wage_streak_bonus`（缺失 / 非法 ⇒ 1–5）；每笔独立均匀抽样，含端点；
    //    · **先对 `-1` 账户行 FOR UPDATE 预检余额**（不是事后 catch）：台账函数报不足会把整个 PG
    //      事务置为 aborted，TS 侧 catch 救不回来 ⇒ 只能「先看够不够，不够就不发」，让领取照常成功；
    //      `FOR UPDATE` 同时把并发奖励发放串行化（预检与出账之间无人能挤走余额）；不足 ⇒ bonus_amount='0'；
    //    · 幂等键 = `<claim 键>:bonus`（claim 键含毫秒时间戳 ⇒ 每次领取一条事件、两腿）。
    const bonusRange = await currentWageStreakBonusRange(tx);
    const bonusPicked = pickWageStreakBonus(bonusRange);
    let bonusAmount = bonusPicked;
    if (bonusPicked > 0) {
      const revRows = await txQuery<Row>(
        tx,
        `SELECT COALESCE((SELECT balance FROM public.account
                            WHERE uid = $1::bigint AND cid = $2::bigint FOR UPDATE), 0)::text AS balance`,
        [String(PLATFORM_UID), String(USD_CID)],
      );
      const revenueBalance = BigInt(revRows.length ? strOrNull(revRows[0].balance) ?? '0' : '0');
      if (revenueBalance < BigInt(bonusPicked)) {
        bonusAmount = 0;
      } else {
        await postEvent({
          op: 'entries',
          idempotencyKey: `${claimKey}:bonus`,
          requestFingerprint: fingerprintOf(['project.claim-bonus', projectId, claimId, String(bonusPicked)]),
          refType: 'system',
          refId: projectId,
          memo: `project_wage_streak_bonus:${projectId}:${claimId}`,
          entries: [
            { uid: String(PLATFORM_UID), cid: String(USD_CID), delta: String(-bonusPicked), kind: WAGE_STREAK_BONUS_LEDGER_KIND },
            { uid, cid: String(USD_CID), delta: String(bonusPicked), kind: WAGE_STREAK_BONUS_LEDGER_KIND },
          ],
          ex: tx as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
        });
      }
    }

    const view: WageClaimView = {
      claim_id: claimId,
      project_id: projectId,
      uid,
      batt_credited: str(claim.batt_credited),
      currency_cid: strOrNull(claim.currency_cid),
      currency_amount: strOrNull(claim.currency_amount),
      hours_elapsed: str(claim.hours_elapsed),
      active_hours: str(claim.active_hours),
      active_rate: PROJECT_ACTIVE_BATT_PER_HOUR,
      offline_hours: str(claim.offline_hours),
      offline_rate: PROJECT_OFFLINE_BATT_PER_HOUR,
      batt_after: battAfter,
      claim_key: claimKey,
      time_created: iso(claim.time_created),
      streak,
      bonus_amount: String(bonusAmount),
      bonus_kind: WAGE_STREAK_BONUS_KIND,
    };
    return { ok: true, view, replay: false, idempotency_key: claimKey } as VerbResult<WageClaimView>;
  });
};

// ============================================================================
// 离职（R6）：幂等 no-op（未在职 / 已 left / ended ⇒ 200）
// ============================================================================
export const leaveProjectVerb = async (input: {
  actorUid: number;
  ref: string;
  ex?: TxClient;
}): Promise<VerbResult<{ project_id: string; left: boolean; worker: ProjectWorkerView | null }>> => {
  if (!isProjectRef(input.ref)) return notFound();

  return runInTx<VerbResult<{ project_id: string; left: boolean; worker: ProjectWorkerView | null }>>(input.ex, async (tx) => {
    const project = await lockProjectByRef(tx, input.ref);
    if (!project) return notFound();
    const projectId = str(project.project_id);

    const rows = await txQuery<Row>(
      tx,
      `UPDATE public.project_worker SET status = 'left', left_at = now()
        WHERE project_id = $1::bigint AND uid = $2::bigint AND status = 'hired'
        RETURNING *`,
      [projectId, String(input.actorUid)],
    );
    if (!rows.length) {
      return {
        ok: true,
        view: { project_id: projectId, left: false, worker: null },
        replay: true,
      } as VerbResult<{ project_id: string; left: boolean; worker: ProjectWorkerView | null }>;
    }

    // 离职使在职数回落：working 且未满 ⇒ 回到 recruiting（可继续招工；ended 不回退）
    const hired = await hiredCountOf(tx, projectId);
    if (str(project.status) === 'working' && hired < int(project.headcount)) {
      await txQuery<Row>(
        tx,
        `UPDATE public.project SET status = 'recruiting' WHERE project_id = $1::bigint AND status = 'working'`,
        [projectId],
      );
    }

    return {
      ok: true,
      view: { project_id: projectId, left: true, worker: normalizeWorkerView(rows[0]) },
      replay: false,
    } as VerbResult<{ project_id: string; left: boolean; worker: ProjectWorkerView | null }>;
  });
};

// ============================================================================
// 管理员 PATCH（R7）：状态机 + headcount 扩缩 + 工资 / 间隔修改
// ============================================================================
export const patchProjectVerb = async (input: {
  ref: string;
  body: unknown;
  ex?: TxClient;
}): Promise<VerbResult<ProjectView>> => {
  const parsed = parseProjectPayload(input.body, 'patch');
  if ('err' in parsed) return parsed.err;
  const p = parsed.payload;
  if (!isProjectRef(input.ref)) return notFound();

  return runInTx<VerbResult<ProjectView>>(input.ex, async (tx) => {
    const project = await lockProjectByRef(tx, input.ref);
    if (!project) return notFound();
    const projectId = str(project.project_id);

    // ended = 终态封板：一切 PATCH ⇒ 409（同值写也不放行，避免「封板后仍可改」的错觉）
    if (str(project.status) === 'ended') return conflict('project_ended_frozen', { project_id: projectId });

    const currentStatus = str(project.status) as ProjectStatus;
    let nextStatus = currentStatus;
    if (Object.prototype.hasOwnProperty.call(p, 'status') || (input.body as Row)?.status !== undefined) {
      const raw = str((input.body as Row)?.status);
      if (!(PROJECT_STATUSES as readonly string[]).includes(raw)) {
        return badRequest('PROJECT_STATUS_INVALID', { field: 'status', allowed: [...PROJECT_STATUSES] });
      }
      nextStatus = raw as ProjectStatus;
      if (nextStatus !== currentStatus && !PROJECT_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
        return conflict('project_invalid_transition', { from: currentStatus, to: nextStatus });
      }
    }

    // headcount 缩容不得低于在职数（不代项目方裁人）
    if (p.headcount !== undefined) {
      const hired = await hiredCountOf(tx, projectId);
      if (p.headcount < hired) {
        return conflict('project_headcount_below_hired', { headcount: p.headcount, hired_count: hired });
      }
    }

    // 两币成对：本次只改一侧 ⇒ 用库内现值补齐后整体校验
    let wageCid: string | null = project.wage_cid === null || project.wage_cid === undefined ? null : str(project.wage_cid);
    let wageAmount: string | null = project.wage_currency_amount === null || project.wage_currency_amount === undefined
      ? null : str(project.wage_currency_amount);
    const body = (input.body || {}) as Row;
    if (Object.prototype.hasOwnProperty.call(body, 'wage_cid')) {
      wageCid = p.wage_cid === undefined ? null : p.wage_cid;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'wage_currency_amount')) {
      wageAmount = p.wage_currency_amount === undefined ? null : p.wage_currency_amount;
    }
    if ((wageCid === null) !== (wageAmount === null)) {
      return badRequest('PROJECT_WAGE_CURRENCY_PAIR_REQUIRED', { fields: ['wage_cid', 'wage_currency_amount'] });
    }
    if (wageCid !== null) {
      const cur = await txQuery<Row>(tx, `SELECT status FROM public.currency WHERE cid = $1::bigint LIMIT 1`, [wageCid]);
      if (!cur.length) return conflict('project_wage_currency_not_found', { wage_cid: wageCid });
      if (str(cur[0].status) !== 'listed') {
        return conflict('project_wage_currency_not_listed', { wage_cid: wageCid, status: str(cur[0].status) });
      }
    }

    const rows = await txQuery<Row>(
      tx,
      `UPDATE public.project SET
         title = COALESCE($2::text, title),
         description = COALESCE($3::text, description),
         headcount = COALESCE($4::int, headcount),
         recruit_min_account_days = COALESCE($5::int, recruit_min_account_days),
         wage_batt_per_claim = COALESCE($6::numeric, wage_batt_per_claim),
         wage_cid = $7::bigint,
         wage_currency_amount = $8::numeric,
         wage_interval_hours = COALESCE($9::int, wage_interval_hours),
         status = $10::text
       WHERE project_id = $1::bigint
       RETURNING *`,
      [
        projectId,
        p.title ?? null,
        p.description ?? null,
        p.headcount ?? null,
        p.recruit_min_account_days ?? null,
        p.wage_batt_per_claim ?? null,
        wageCid,
        wageAmount,
        p.wage_interval_hours ?? null,
        nextStatus,
      ],
    );

    return {
      ok: true,
      view: normalizeProjectRow({ ...rows[0], hired_count: await hiredCountOf(tx, projectId) }),
      replay: nextStatus === currentStatus && Object.keys(p).length === 0,
    } as VerbResult<ProjectView>;
  });
};

// ============================================================================
// 活动小时桶埋点（旁路写：不进业务事务、失败不阻断业务 —— PR-N5）
// ============================================================================
const ACTIVITY_UPSERT_SQL = `
  INSERT INTO public.user_activity_hour (uid, day, hour, request_count)
  VALUES ($1::bigint, (now() AT TIME ZONE 'UTC')::date, EXTRACT(HOUR FROM (now() AT TIME ZONE 'UTC'))::int, 1)
  ON CONFLICT (uid, day, hour)
  DO UPDATE SET request_count = public.user_activity_hour.request_count + 1`;

/**
 * 登录态请求埋点（**唯一的请求侧计数写面**）。
 * 纪律：调用方**不得 await 到阻塞响应**（`void … .catch()` 即可）；本函数自身也不抛
 * （吞错 ⇒ 最坏该小时桶缺行 ⇒ 该小时按离线计，绝不因埋点失败影响业务）。
 */
export const recordUserActivityHour = async (uid: number): Promise<void> => {
  if (!Number.isSafeInteger(uid) || uid <= 0) return;
  try {
    const pool = getTransactionPool() as unknown as {
      query: (t: string, p?: unknown[]) => Promise<unknown>;
    };
    await pool.query(ACTIVITY_UPSERT_SQL, [uid]);
  } catch (error) {
    console.warn(
      '[project.activity] activity hour upsert failed (side channel, business unaffected):',
      error instanceof Error ? error.message : error,
    );
  }
};
