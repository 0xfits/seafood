// ============================================================================
// src/audit-console.ts — 8⑥ 审计台 · 统一读口（`GET /api/admin/audit/:table`）
// ============================================================================
// 唯一权威：docs/route-layer.spec.md **v2.21 §32.14** 终审裁定落位表（逐字遵）：
//   · **`R-9-74`**（载体 Ⅰ）：统一读口多表参数化 ⇒ 注册点 `87 → 88`（`+1` get）；
//     ★ 表名**白名单闭集 14 面**（逐字 · `app_config` 已裁出）；**非白名单 ⇒ `400`**
//     （原候选 `404` 作废）；★ **逐表过滤映射显式表达（结构化白名单查表），禁拼 SQL 字符串**。
//   · **`R-9-77`**：`app_config` 出 ⇒ 有效面数 = **14**（排除 `app_config`）。
//   · **`R-9-78`**：过滤参数在该表不适用 ⇒ **`400` 明确拒绝**（否决「静默忽略」）；
//     ★ 响应体**列出该表支持的过滤维度**（`details.supportedFilters` · 轻量能力面）。
//   · **`R-9-79`**：路径 `GET /api/admin/audit/:table`；`limit` **默认 50 / 上限 100**
//     （`limit > 100 ⇒ 400`）；**keyset 游标 `(timeColumn DESC, <pk> DESC)`**；
//     ★ **无 `time_created` 表逐表指定排序键**（本片**有效表仅 `referral` ⇒ `bound_at`**）。
//   · 五类过滤面逐表映射（`actor` / `target` / `action` / 时间窗 `from`·`to` / 关联 id `refId`）
//     = §32.3 权威表（库侧列类型注见 `data-layer.spec` v0.28 §35.4）。
//   · **零新增错误码**（账本错误闭集 **33 不动**）：一切 `400` 借既有 `LEDGER_AMOUNT_INVALID`（`#17`）。
//   · **`R107`** 错误形状：`{ error: { code, message, i18n_key, details } }`（由 `sendVerbError` 出口）。
//   · **只读**（§32.10）：本模块**只生成 `SELECT`**；不动任何 `append-only` 留痕面；不新造第二写入面。
//
// 设计要点（**禁拼 SQL 字符串** 的落地）：
//   · 14 面逐表映射 = 本文件 `AUDIT_TABLES` **显式常量表**（列名一律取自该表，**不来自请求**）；
//   · 请求只提供**值**（`:table` / 过滤值 / `limit` / `cursor`），**绝不进 SQL 标识符位**；
//   · `:table` 先查白名单（miss ⇒ `400`）；列名只在白名单命中后按映射**逐字取用**。
// ============================================================================
import { adminVerbError } from './admin-service';
import type { JobVerbErr } from './job-service';

// ---------------------------------------------------------------------------
// 五类过滤面 —— 请求参数名（统一口径 · §32.3(b)(c)）
//   · actor / target / action / 时间窗（from·to，半开 `[from, to)`）/ 关联 id（refId）
// ---------------------------------------------------------------------------
export const AUDIT_FILTER_PARAMS = ['actor', 'target', 'action', 'from', 'to', 'refId'] as const;
export type AuditFilterParam = (typeof AUDIT_FILTER_PARAMS)[number];

/**
 * 逐表过滤映射（§32.3 权威表逐字落码）。列名数组 = OR 匹配；`null` = 该参数对该表**不适用**
 * （⇒ 传参即 `400 PARAM_NOT_APPLICABLE` · `R-9-78`）。
 * `timeColumn` = 时间窗列（`time_created`，或 `referral` 的 `bound_at`）；`pk` = keyset 副键。
 */
export interface AuditColumnMap {
  readonly actor: readonly string[] | null;
  readonly target: readonly string[] | null;
  readonly action: readonly string[] | null;
  readonly timeColumn: string;
  readonly refId: readonly string[] | null;
  readonly pk: string;
}

/** 14 面白名单闭集（`R-9-74` / `R-9-77` · 逐字 · **排除 `app_config`**）。键 = `public.` 表名。 */
export const AUDIT_TABLES: Readonly<Record<string, AuditColumnMap>> = {
  // 1. 调分审计台账（`0023`）：actor=actor_uid / target=target_uid / action∈{action(恒),op,result}
  admin_ops_audit_log: {
    actor: ['actor_uid'], target: ['target_uid'], action: ['action', 'op', 'result'],
    timeColumn: 'time_created', refId: ['cid'], pk: 'log_id',
  },
  // 2. 订单退款台账：target=两当事人（seller/buyer）；无显式 action 列（表名=动作）
  admin_refund_audit_log: {
    actor: ['actor_uid'], target: ['seller_uid', 'buyer_uid'], action: null,
    timeColumn: 'time_created', refId: ['order_id'], pk: 'log_id',
  },
  // 3. 账本真源：无操作者列（uid=分录归属人）；无 target 概念；action 细粒度=kind 无独立 action 列
  ledger_entry: {
    actor: null, target: null, action: null,
    timeColumn: 'time_created', refId: ['ref_id'], pk: 'txid',
  },
  // 4. 币种审核台账：target=cid；无显式 action 列
  currency_review_log: {
    actor: ['actor_uid'], target: ['cid'], action: null,
    timeColumn: 'time_created', refId: ['cid'], pk: 'log_id',
  },
  // 5. 币种状态台账：action=from_status→to_status（状态迁移）
  currency_status_log: {
    actor: ['actor_uid'], target: ['cid'], action: ['from_status', 'to_status'],
    timeColumn: 'time_created', refId: ['cid'], pk: 'log_id',
  },
  // 6. 商品审核台账：target=listing_id；无显式 action 列
  listing_review_log: {
    actor: ['actor_uid'], target: ['listing_id'], action: null,
    timeColumn: 'time_created', refId: ['listing_id'], pk: 'log_id',
  },
  // 7. 招工仲裁台账：target=job_id；无显式 action 列
  job_arbitration_log: {
    actor: ['actor_uid'], target: ['job_id'], action: null,
    timeColumn: 'time_created', refId: ['job_id'], pk: 'log_id',
  },
  // 8. 电量台账：无 actor_uid（uid=电量归属人 · 多为系统触发）；无 target；无 action 列
  batt_entry: {
    actor: null, target: null, action: null,
    timeColumn: 'time_created', refId: ['ref_id'], pk: 'txid',
  },
  // 9. 签到台账：无 actor（系统奖励）；无 target；无显式 action 列
  checkin_log: {
    actor: null, target: null, action: null,
    timeColumn: 'time_created', refId: null, pk: 'log_id',
  },
  // 10. 补签台账：无 actor_uid（uid=本人）；无 target（标的=target_day 非 id）
  checkin_makeup_log: {
    actor: null, target: null, action: null,
    timeColumn: 'time_created', refId: ['cid'], pk: 'log_id',
  },
  // 11. 评分：actor=rater_uid；target=ratee_uid（人）+ target_id（标的）；action=direction
  rating: {
    actor: ['rater_uid'], target: ['ratee_uid', 'target_id'], action: ['direction'],
    timeColumn: 'time_created', refId: ['target_id'], pk: 'rating_id',
  },
  // 12. 订单事件：actor=actor_uid；target=order_id；action=event_type/from_status/to_status
  listing_order_event: {
    actor: ['actor_uid'], target: ['order_id'], action: ['event_type', 'from_status', 'to_status'],
    timeColumn: 'time_created', refId: ['ref_id', 'order_id'], pk: 'event_id',
  },
  // 13. 邀请绑定：无 actor_uid（child/parent 语义二选）；★ 无 time_created ⇒ 时间列 = bound_at
  referral: {
    actor: null, target: ['child_uid', 'parent_uid'], action: null,
    timeColumn: 'bound_at', refId: null, pk: 'child_uid',
  },
  // 14. 佣金政策：actor=created_by；无 target（全局策略）；无 action 列
  commission_policy: {
    actor: ['created_by'], target: null, action: null,
    timeColumn: 'time_created', refId: null, pk: 'policy_id',
  },
};

/** 白名单闭集（14 面 · 稳定顺序 = §32.2 逐字序）。 */
export const AUDIT_TABLE_NAMES: readonly string[] = Object.keys(AUDIT_TABLES);

export const AUDIT_LIMIT_DEFAULT = 50;
export const AUDIT_LIMIT_MAX = 100;

/** 失配（400）构造：一律借既有码 `LEDGER_AMOUNT_INVALID`（`#17`）· **零新增码** · `R107` 形状。 */
const audit400 = (details: Record<string, unknown>, message: string): JobVerbErr =>
  adminVerbError(400, 'LEDGER_AMOUNT_INVALID', details, message);

/** 该表支持的过滤维度（参数名清单 · §32.3 · 顺序 = `AUDIT_FILTER_PARAMS`）。 */
export const supportedFiltersOf = (spec: AuditColumnMap): AuditFilterParam[] =>
  AUDIT_FILTER_PARAMS.filter((p) =>
    p === 'from' || p === 'to' ? true : spec[p] !== null,
  );

export interface AuditPlan {
  readonly table: string;
  readonly spec: AuditColumnMap;
  readonly limit: number;
  readonly filters: {
    actor?: string; target?: string; action?: string;
    from?: string; to?: string; refId?: string;
  };
  readonly cursor?: { t: string; pk: string };
}

const isIntString = (v: string): boolean => /^-?\d+$/.test(v);
const isTimestamp = (v: string): boolean => Number.isFinite(Date.parse(v));

const decodeCursor = (raw: string): { t: string; pk: string } | null => {
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!json || typeof json !== 'object') return null;
    const t = String((json as { t?: unknown }).t ?? '');
    const pk = String((json as { pk?: unknown }).pk ?? '');
    if (!isTimestamp(t) || !isIntString(pk)) return null;
    return { t, pk };
  } catch {
    return null;
  }
};

export const encodeCursor = (tIso: string, pk: string): string =>
  Buffer.from(JSON.stringify({ t: tIso, pk }), 'utf8').toString('base64url');

/**
 * 解析 / 校验读口请求（`R-9-74`/`R-9-77`/`R-9-78`/`R-9-79`）。
 * 顺序：① 白名单（miss ⇒ `400 AUDIT_TABLE_NOT_FOUND`）→ ② 参数适用性（不适用 ⇒
 * `400 PARAM_NOT_APPLICABLE` + `supportedFilters`）→ ③ 形状（`limit` / `from`·`to` / id / cursor）。
 */
export const parseAuditRequest = (
  tableRaw: unknown,
  query: Record<string, unknown> | undefined,
): { ok: true; plan: AuditPlan } | { ok: false; err: JobVerbErr } => {
  const table = String(tableRaw ?? '').trim();
  const spec = AUDIT_TABLES[table];
  if (!spec) {
    // R-9-74：非白名单 ⇒ 400（原候选 404 作废）。响应只给非敏感上下文。
    return { ok: false, err: audit400({ field: 'table', reason: 'AUDIT_TABLE_NOT_FOUND' }, 'Audit table is not in the whitelist') };
  }
  const supported = supportedFiltersOf(spec);
  const q = query || {};

  // 参数适用性（R-9-78：不适用 ⇒ 400 + 列出该表支持的过滤维度）
  for (const p of ['actor', 'target', 'action', 'refId'] as const) {
    const has = q[p] !== undefined && q[p] !== null && String(q[p]) !== '';
    if (has && spec[p] === null) {
      return {
        ok: false,
        err: audit400(
          { field: p, reason: 'PARAM_NOT_APPLICABLE', supportedFilters: supported },
          `Filter '${p}' is not applicable to this table`,
        ),
      };
    }
  }

  // limit（默认 50 / 上限 100 · R-9-79）
  let limit = AUDIT_LIMIT_DEFAULT;
  if (q.limit !== undefined && q.limit !== null && String(q.limit) !== '') {
    const raw = String(q.limit);
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(n) || n < 1 || n > AUDIT_LIMIT_MAX) {
      return { ok: false, err: audit400({ field: 'limit', reason: 'LIMIT_OUT_OF_RANGE', max: AUDIT_LIMIT_MAX, min: 1 }, 'limit is out of range') };
    }
    limit = n;
  }

  // 时间窗（统一参数名 from/to · 逐表落到该表时间列 · 半开 [from,to)）
  const filters: AuditPlan['filters'] = {};
  for (const p of ['from', 'to'] as const) {
    if (q[p] !== undefined && q[p] !== null && String(q[p]) !== '') {
      const raw = String(q[p]);
      if (!isTimestamp(raw)) return { ok: false, err: audit400({ field: p, reason: 'INVALID_TIMESTAMP' }, 'Timestamp is invalid') };
      filters[p] = new Date(raw).toISOString();
    }
  }

  // 关联 id / actor / target：bigint（十进制整数）
  for (const p of ['actor', 'target', 'refId'] as const) {
    if (spec[p] === null) continue;
    const raw = q[p];
    if (raw === undefined || raw === null || String(raw) === '') continue;
    const s = String(raw);
    if (!isIntString(s)) return { ok: false, err: audit400({ field: p, reason: 'NOT_DECIMAL_INTEGER' }, 'Filter value must be a decimal integer') };
    filters[p] = s;
  }

  // action：文本（精确 / 闭集 IN 语义 · 逐表列 OR 匹配）
  if (spec.action !== null) {
    const raw = q.action;
    if (raw !== undefined && raw !== null && String(raw) !== '') {
      filters.action = String(raw);
    }
  }

  // 游标（keyset 双键 · 不透明）
  let cursor: AuditPlan['cursor'];
  if (q.cursor !== undefined && q.cursor !== null && String(q.cursor) !== '') {
    const dec = decodeCursor(String(q.cursor));
    if (!dec) return { ok: false, err: audit400({ field: 'cursor', reason: 'CURSOR_INVALID' }, 'Cursor is invalid') };
    cursor = dec;
  }

  return { ok: true, plan: { table, spec, limit, filters, cursor } };
};

/**
 * 生成参数化 `SELECT`（`text` 中的**表名 / 列名一律取自白名单映射**；请求值只进 `$n` 参数位）。
 * `limit + 1` 用于判定是否还有下一页（keyset）。
 */
export const buildAuditSql = (plan: AuditPlan): { text: string; params: unknown[] } => {
  const { spec, limit } = plan;
  const params: unknown[] = [];
  const ph = (v: unknown): string => {
    params.push(v);
    return `$${params.length}`;
  };
  const orEq = (cols: readonly string[], value: string): string =>
    `(${cols.map((c) => `${c} = ${ph(value)}::bigint`).join(' OR ')})`;

  const clauses: string[] = [];
  const f = plan.filters;
  if (f.from !== undefined) clauses.push(`${spec.timeColumn} >= ${ph(f.from)}::timestamptz`);
  if (f.to !== undefined) clauses.push(`${spec.timeColumn} < ${ph(f.to)}::timestamptz`);
  if (f.actor !== undefined && spec.actor) clauses.push(orEq(spec.actor, f.actor));
  if (f.target !== undefined && spec.target) clauses.push(orEq(spec.target, f.target));
  if (f.refId !== undefined && spec.refId) clauses.push(orEq(spec.refId, f.refId));
  if (f.action !== undefined && spec.action) {
    clauses.push(`(${spec.action.map((c) => `${c} = ${ph(f.action)}`).join(' OR ')})`);
  }
  if (plan.cursor) {
    clauses.push(`(${spec.timeColumn}, ${spec.pk}) < (${ph(plan.cursor.t)}::timestamptz, ${ph(plan.cursor.pk)}::bigint)`);
  }

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  const text =
    `SELECT * FROM public.${plan.table}${where}` +
    ` ORDER BY ${spec.timeColumn} DESC, ${spec.pk} DESC LIMIT ${ph(limit + 1)}::int`;
  return { text, params };
};

/** 读口 `data` 键集（§32.7(a) 候选逐字）：`{ table, rows[], nextCursor, capabilities }`。 */
export const buildAuditView = (
  plan: AuditPlan,
  rows: Record<string, unknown>[],
): Record<string, unknown> => {
  const { spec, limit } = plan;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    const timeVal = last[spec.timeColumn];
    const tIso = timeVal instanceof Date ? timeVal.toISOString() : (timeVal === null || timeVal === undefined ? '' : String(timeVal));
    const pkVal = last[spec.pk];
    if (tIso && pkVal !== null && pkVal !== undefined) {
      nextCursor = encodeCursor(tIso, String(pkVal));
    }
  }
  return {
    table: plan.table,
    rows: page,
    nextCursor,
    // 轻量能力面（`R-9-78` / §32.3(d) · 参数名清单；非表名/列名裸露）
    capabilities: {
      filters: supportedFiltersOf(spec),
      limit: { default: AUDIT_LIMIT_DEFAULT, max: AUDIT_LIMIT_MAX },
    },
  };
};
