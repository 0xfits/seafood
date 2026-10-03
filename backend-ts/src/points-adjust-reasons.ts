// ============================================================================
// src/points-adjust-reasons.ts — 8⑥ C3③ · `points/adjust` 的**枚举原因码常量集**
// ============================================================================
// 权威：docs/route-layer.spec.md **v2.21 §32.14** `R-9-76`（= `PZ-1` 终审）= **(b) 收严为枚举原因码**：
//   · ★ **新增原因码常量集**（**非错误码** ⇒ 账本错误闭集 **33 不动**）；
//   · ★ **兼容历史 4 行**：现有自由文本**不回填、不改写**（仅**登记口径切换点**）；
//   · 常量集命名 / 校验落点 / 口径切换点 = **实现单**（§32.6③）。
//
// C3 裁定锚（`docs/seafood.master-plan.md:716` 逐字）：③ `/api/admin/points/adjust` 保留但锁死
//   （仅 `$`(`cid=1`) · `ops:` 前缀幂等键 · **必填原因码** · 必须经 `ledger_post_event`（`mint`/`burn`））。
//
// ★ 口径切换点（登记）：切换点 = `src/index.ts` `POST /api/admin/points/adjust` 的 `reason` 校验
//   （在既有「非空」闸**之后**追加「∈ 本常量集」闸）。**历史**已落库的 4 行自由文本（`admin_ops_audit_log.memo`）
//   **不回填 / 不改写**（R-9-76 逐字）；读侧（审计台）原样展示。
// ============================================================================

/**
 * `points/adjust` 的**原因码关闭集**（恰 7 值 · 语义域 · 非错误码）。
 * 调用方**必须**从此集合取值；集合外 ⇒ 路由层 `400`（借既有码 `LEDGER_AMOUNT_INVALID` · 见 route）。
 */
export const POINTS_ADJUST_REASONS = [
  /** 人工纠错（数据修正 / 误操作回滚） */
  'MANUAL_CORRECTION',
  /** 客服补偿（纠纷 / 服务瑕疵补偿） */
  'CUSTOMER_COMPENSATION',
  /** 活动奖励（营销 / 拉新 / 活动发放） */
  'PROMOTION_BONUS',
  /** 违规扣减（作弊 / 违约惩罚） */
  'PENALTY_DEDUCTION',
  /** 缺陷补偿（平台 bug 导致的损失补偿） */
  'BUG_COMPENSATION',
  /** 迁移调整（跨版本 / 数据搬迁一次性调整） */
  'MIGRATION_ADJUSTMENT',
  /** 其它（无上述合适分类；须在 memo 补充说明） */
  'OTHER',
] as const;

export type PointsAdjustReason = (typeof POINTS_ADJUST_REASONS)[number];

const REASON_SET: ReadonlySet<string> = new Set(POINTS_ADJUST_REASONS);

/** 是否为合法原因码（精确匹配；大小写敏感）。 */
export const isPointsAdjustReason = (value: unknown): value is PointsAdjustReason =>
  typeof value === 'string' && REASON_SET.has(value);
