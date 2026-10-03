/**
 * P2 · 十级返佣 · 佣金层（应用层计算 + 单语句落账）
 * ============================================================================
 * 权威口径（逐条照落，不自行推导）：`docs/commission.spec.md` **v0.2**（§4 版本选择 /
 * §5 载荷形状与分录顺序铁律 / §6 池子·取整·最大余数法 / §7 重归一化 / §8 边界 /
 * §9 平台白名单 / §10 幂等并发 / §11 判据 M1–M9 / §13 借码映射）、
 * `docs/ledger.spec.md` v0.8（账本内核）、`docs/seafood.master-plan.md` §5.19–§5.23。
 *
 * 本模块做什么
 *   ① `getCommissionPolicy(at?)`   —— 「`effective_from <= at` 中最大者」的那一版（CR23 / CR82）
 *   ② `getReferralChain(uid, cap)` —— 沿 `referral` 上行取祖先（带层级号），**只读**（§3.4 / CR20）
 *   ③ `splitPool(P, weights)`      —— **最大余数法**：`q_L = P·w_L/W`（整除）/`r_L = P·w_L mod W`/
 *      `D = P − Σq_L`/按 **`(r_L DESC, L DESC)`** 取前 `D` 名各 `+1`（§6.2 / CR41 / CR42）⇒
 *      **Σx == P 是构造出来的**（CR45），不是舍入修回来的
 *   ④ 载荷构建（§5.3 分录顺序铁律）：`job_payout` 对 → `job_fee` 对 → `N×` `commission` 对，
 *      派生键按 `idx ⇒ K#(idx+1)`；**数组由本模块按 idx 重建，不依赖调用方传序**（CR32 / CR33）
 *   ⑤ `settleJobCommission()`      —— **一个业务事件 = 一次** `SELECT ledger_post_event($1::jsonb)`
 *      （CR29 / D10），幂等键 `biz:job:settle:<job_id>`（CR57，**只由 job_id 派生**、不含任何可变字段）
 *
 * 边界（§8，全部**静默正确**、都不是错误）
 *   · 零额（`fee = 0`）⇒ **不写** `job_fee`、**不写** `commission`、不报错；事件恰 2 条，
 *     派生键集合 = `{K, K#2}`（CR51）
 *   · 无邀请人（`chain_depth = 0`）⇒ 手续费**仍收**但入 **`-1`**（平台收入）、不入 `-2`；
 *     `commission` 条数 0；判据 **M3-C**（CR49 / CR52 / CR84）
 *   · 短链（`1 <= chain_depth < levels`）⇒ **重归一化**：分母 `W = Σ_{L=1..M} w_L`（**不是 10000**）、
 *     全额分完、`-2` 净额 0（CR47 / CR50 / D13）；重归一后算得 0 的层**不建分录**（CR48）
 *
 * 两条口径**必须同时写进注释**（CR34，最易被误读处）
 *   · **锁序不依赖传序**：R79 的加锁全序由 DB 内部 `SELECT DISTINCT uid,cid ORDER BY 1,2` 决定
 *     ⇒ 「数组顺序不影响锁序」；
 *   · **但数组顺序决定派生键序号与错误优先级** ⇒ 「顺序必须确定性可复现」。
 *     二者并存：只写「顺序无所谓」会诱发派生键漂移（LD024 / 500）。
 *
 * 计算不下沉（裁定 #14 / CR81）：金额算在本模块（应用层），DB 侧只做**后置断言**
 *   （`0007` 的 `trg_ledger_entry_commission_conservation`：同一 `event_root_key`
 *    断言 `Σcommission 出 -2 == Σjob_fee 入 -2`，失败抛 `LD032` / defect / 500）。
 *
 * 错误面（§13 · 关闭集 33 码不动）
 *   一律 `new LedgerError(...)` 借既有码 + 可机读 `details.reason`（CR75 / CR76）；
 *   **HTTP 状态一律取 `err.httpStatus`**（`status ?? 500` 兜底规则）——**不得**用 `err.status`
 *   （`LEDGER_RECONCILE_MISMATCH` 的 `status = null` 是 §11 R88 的**脚本退出码语义**，故意保留）。
 *
 * 诚实边界
 *   · `W = 0`（前 M 层权重全零）在**政策写入时**已被 `0007` 的守卫拒（裁定 #16）⇒ 运行时**不可达**；
 *     本模块的运行时分支只作兜底，且按 §14.2 #2 归 **defect / 500**（历史越界改库）。
 *     登记为「两处口径张力（§13.2 #10 写 `400` / §14.2 #2 读 `500`）」，已写进交付报告。
 *   · TOCTOU 面**保留**（CR26 ① / 裁定 #14）：读政策与落账不在同一语句 ⇒ 重放**必须**复用同一
 *     payload / 指纹（本模块的指纹是**确定性**的：同 business 输入 ⇒ 同指纹，故正常重试不会退化成
 *     409；但政策改版后**重算**金额再发 ⇒ 会得到不同 payload ⇒ 409 是**故意行为**，不是缺陷）。
 */
import { createHash } from 'crypto';
import {
  assertPlatformAccountMutation, assertUserUid, deriveEventKey, normalizeIdempotencyKey, postEvent, toAmount,
  type Amount, type LedgerEventEntryInput, type LedgerOpResult,
} from './ledger';
import { LedgerError } from './ledger-errors';
import { getTransactionPool, readQuery } from './db';

// ============================================================================
// §0 只读查询执行器（脚本可注入自己的 Pool；省略 ⇒ 走 db.ts 的只读池）
// ============================================================================

/** 只读/写入查询执行器的最小接口（`Pool` 与 `TxClient` 都满足） */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const runQuery = async <R = Record<string, unknown>>(
  ex: Queryable | undefined, sql: string, params: unknown[] = [],
): Promise<R[]> => (ex ? (await ex.query(sql, params)).rows as R[] : readQuery<R>(sql, params));

// ============================================================================
// §1 常量：借码 reason（§13.2 + CR76 的唯一常量表；**不新增错误码**）
// ============================================================================

/** §13.2 的 P2 借码 reason（机读枚举；`reason` 是诊断信息、**不是契约** —— 调用方只准按 code 分支） */
export const COMMISSION_REASON = {
  /** §13.2 #1：无任何政策满足 `effective_from <= T`（口径 A 下正常路径不可达） */
  POLICY_MISSING: 'COMMISSION_POLICY_MISSING',
  /** §13.2 #2：`fee_rate_bp` 不在 `[100,10000]`（政策写入时 ⇒ 400）。
   *  ★ P9⑤（`R-9-48`）：域由 `[100,500]` 扩至 `[100,10000]`（`fee_rate_bp` 语义改「进池比例」，`1000` = 10%）。 */
  FEE_RATE_OUT_OF_RANGE: 'FEE_RATE_OUT_OF_RANGE',
  /** §13.2 #3：`levels` / `weights_bp` 形态非法 ⇒ 400 */
  POLICY_SHAPE_INVALID: 'POLICY_SHAPE_INVALID',
  /** §13.2 #4：`Σ weights_bp > 10000` ⇒ 400 */
  WEIGHTS_SUM_EXCEEDS_10000: 'WEIGHTS_SUM_EXCEEDS_10000',
  /** §13.2 #5：`effective_from` 回填出死版本 ⇒ 400（CR25） */
  POLICY_EFFECTIVE_BACKDATED: 'POLICY_EFFECTIVE_BACKDATED',
  /** §13.2 #10 / CR83：退化分母（`Σ = 0` 或 `weights_bp[1] = 0`）⇒ 写入时 400；运行时兜底见 §7.3 */
  POLICY_WEIGHTS_ALL_ZERO: 'POLICY_WEIGHTS_ALL_ZERO',
  /** §13.2 #9：`Σ x_L != P`（组装器自检）⇒ 500 缺陷类 */
  COMMISSION_SPLIT_SUM_MISMATCH: 'COMMISSION_SPLIT_SUM_MISMATCH',
  /**
   * F1（独立质检不通过修复单）：邀请链的**结构断言**被破坏（`no_duplicate_uid` /
   * `contiguous_levels` / `all_user_uids` 任一为 false）⇒ **落账前响亮拒绝**（500 defect 类）。
   * 为什么必须在这里拒：环污染时链游走会重复节点（含**打工人本人**），而载荷仍然 `Σ x == P`
   * ⇒ DB 侧的 Σ 守恒断言（只保「池子总量」、不保「归属」，见 §D/CR80）会**放行** ⇒
   * 静默把佣金付给**错的人**。故归属不变式必须在应用层落账前拦住。
   */
  CHAIN_ASSERTION_VIOLATED: 'COMMISSION_CHAIN_ASSERTION_VIOLATED',
  /**
   * F7②：幂等重放时把 `plan` 由**账上已落事件**导出，但账上读数自相矛盾
   * （`worker_got + job_fee != employer_frozen_out` 等）⇒ 500 defect 类（内部不变式被破坏）。
   */
  LEDGER_REPLAY_INCONSISTENT: 'COMMISSION_LEDGER_REPLAY_INCONSISTENT',
  /** 绑定类（§13.2 #6/#7/#8）—— 本模块**只读**邀请图，不写；常量登记在此只为「同族同处」可检索 */
  REFERRAL_SELF_BIND: 'REFERRAL_SELF_BIND',
  REFERRAL_ALREADY_BOUND: 'REFERRAL_ALREADY_BOUND',
  REFERRAL_CYCLE_REJECTED: 'REFERRAL_CYCLE_REJECTED',
} as const;

export type CommissionReason = (typeof COMMISSION_REASON)[keyof typeof COMMISSION_REASON];

/** 平台保留 uid（§9）：`-2` = 佣金中转池、`-1` = 平台收入 */
export const COMMISSION_POOL_UID = '-2';
export const PLATFORM_REVENUE_UID = '-1';

/** 事件根键模板（CR57：`biz:job:settle:<job_id>`；**只**由不可变业务标识派生，禁入金额/政策/时间戳）。
 *  ★ S4a（`R-9-101` · §20.4 #2）：逐笔发放 ⇒ 同一 `job` 多份 ⇒ **键须含提交标识** =
 *     `biz:job:settle:<job_id>:<submission_id>`。`submissionId` 缺省 ⇒ 退化为旧 `biz:job:settle:<job_id>`
 *     （遗留单笔 / 旧脚本兼容；DB 侧 `job_post_event` 同口径）。 */
export const JOB_SETTLE_KEY_PREFIX = 'biz:job:settle:';
export const jobSettleKey = (jobId: Amount, submissionId?: Amount | null): string => {
  const base = `${JOB_SETTLE_KEY_PREFIX}${toAmount(jobId, 'job_id').toString()}`;
  if (submissionId === undefined || submissionId === null || String(submissionId).trim() === '') {
    return normalizeIdempotencyKey(base);
  }
  return normalizeIdempotencyKey(`${base}:${toAmount(submissionId, 'submission_id').toString()}`);
};

// ============================================================================
// §2 版本化佣金政策（§4；CR23 / CR25 / CR27 / CR82）
// ============================================================================

export interface CommissionPolicy {
  policy_id: string;
  fee_rate_bp: number;
  levels: number;
  weights_bp: number[];
  effective_from: string;
  created_by: string;
  time_created: string;
  /** 归一化后的 Σ（写入/读取时都算一次，便于判据对拍） */
  weights_sum_bp: number;
}

const parsePgSmallintArray = (v: unknown): number[] => {
  const s = String(v ?? '').trim();
  if (s === '' || s === '{}') return [];
  return s.replace(/^\{/, '').replace(/\}$/, '').split(',').map((x) => Number(x.trim()));
};

const mapPolicy = (r: Record<string, unknown>): CommissionPolicy => {
  const weights = parsePgSmallintArray(r.weights_bp);
  return {
    policy_id: String(r.policy_id),
    fee_rate_bp: Number(r.fee_rate_bp),
    levels: Number(r.levels),
    weights_bp: weights,
    effective_from: String(r.effective_from),
    created_by: String(r.created_by),
    time_created: String(r.time_created),
    weights_sum_bp: weights.reduce((a, b) => a + b, 0),
  };
};

export interface PolicyGuardResult { ok: true; weights_sum_bp: number; }

/**
 * CR27 / CR83：政策参数校验（**同一口径双层**：写政策时先校验，DB 侧 `23514` 闸是兜底）。
 * `stage = 'write'` ⇒ 失败一律 **400**（裁定 #5 / #16：守卫失败类 = `input` 桶）；
 * `stage = 'read'`  ⇒ 从库里读出的值违反 `CHECK` 只可能是越界改库/迁移缺陷 ⇒ **500 defect**。
 * **不得**「让 DB 报错来当校验」（R80 同口径）。
 */
export const guardCommissionPolicy = (
  p: Pick<CommissionPolicy, 'fee_rate_bp' | 'levels' | 'weights_bp'>, stage: 'write' | 'read' = 'write',
): PolicyGuardResult => {
  const bad = (reason: CommissionReason, extra: Record<string, string | number> = {}): never => {
    if (stage === 'write') {
      throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'commission_policy', reason, ...extra });
    }
    throw new LedgerError('LEDGER_FEE_RATE_INVALID', { field: 'commission_policy', reason, stage, ...extra });
  };
  if (!Number.isInteger(p.fee_rate_bp) || p.fee_rate_bp < 100 || p.fee_rate_bp > 10000) {
    // ★ P9⑤（R-9-48）：域扩至 [100,10000]（原 500）；fee_rate_bp 语义 = 进池比例（1000 = 10%）。
    bad(COMMISSION_REASON.FEE_RATE_OUT_OF_RANGE, { fee_rate_bp: p.fee_rate_bp, min: 100, max: 10000 });
  }
  if (!Number.isInteger(p.levels) || p.levels < 1 || p.levels > 10) {
    bad(COMMISSION_REASON.POLICY_SHAPE_INVALID, { levels: p.levels, min: 1, max: 10 });
  }
  if (p.weights_bp.length !== p.levels) {
    bad(COMMISSION_REASON.POLICY_SHAPE_INVALID, { weights_len: p.weights_bp.length, levels: p.levels });
  }
  if (p.weights_bp.some((w) => !Number.isInteger(w) || w < 0)) {
    bad(COMMISSION_REASON.POLICY_SHAPE_INVALID, { negative_or_noninteger: 'true' });
  }
  const sum = p.weights_bp.reduce((a, b) => a + b, 0);
  if (sum > 10000) bad(COMMISSION_REASON.WEIGHTS_SUM_EXCEEDS_10000, { weights_sum_bp: sum, max: 10000 });
  // 裁定 #16 / CR83：退化分母在写入时就拒（可静态判定式 = `weights_bp[1] > 0`，见 §14.2 #2）
  if (sum === 0) bad(COMMISSION_REASON.POLICY_WEIGHTS_ALL_ZERO, { weights_sum_bp: 0 });
  if (p.weights_bp[0] === 0) bad(COMMISSION_REASON.POLICY_WEIGHTS_ALL_ZERO, { weights_bp_1: 0 });
  return { ok: true, weights_sum_bp: sum };
};

/**
 * §4.1 / CR23：`policy(T) := SELECT * FROM commission_policy WHERE effective_from <= T
 *                            ORDER BY effective_from DESC LIMIT 1`
 * `at` 省略 ⇒ `T` **取自 DB 的 `now()`**（CR4：事件时刻不得由调用方传入）；传值仅供应质检脚本
 * 复现「某时刻生效的那一版」（**不是**服务层可用参数）。
 */
export const getCommissionPolicy = async (
  at?: string | Date | null, ex?: Queryable,
): Promise<CommissionPolicy> => {
  const atIso = at === null || at === undefined
    ? null
    : (at instanceof Date ? at.toISOString() : String(at));
  const rows = await runQuery<Record<string, unknown>>(ex, `
    SELECT policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS weights_bp,
           effective_from::text AS effective_from, created_by::text AS created_by,
           time_created::text AS time_created
      FROM commission_policy
     WHERE effective_from <= COALESCE($1::timestamptz, now())
     ORDER BY effective_from DESC
     LIMIT 1`, [atIso]);
  if (!rows.length) {
    // §13.2 #1：口径 A（0007 种子政策）下正常路径**不可达**；触发即「种子被删 / 越界改库」⇒ 500 + R108
    throw new LedgerError('LEDGER_FEE_RATE_INVALID', {
      reason: COMMISSION_REASON.POLICY_MISSING, at: atIso ?? 'db_now()',
    });
  }
  const policy = mapPolicy(rows[0]);
  guardCommissionPolicy(policy, 'read');
  return policy;
};

export interface InsertPolicyInput {
  fee_rate_bp: number;
  levels: number;
  weights_bp: number[];
  /** 「立即生效」= DB `now()`；「排期生效」= 未来时刻（CR25：**只准严格递增**，禁止回填） */
  effective_from?: string | null;
  created_by: Amount;
}

/**
 * 「后台可改政策」的唯一合法动作 = **插一行新政策**（CR8：INSERT-only，永不 UPDATE）。
 * 双层：应用层先校验（CR27 / CR83，失败 400）+ 单调性（CR25，失败 400 `POLICY_EFFECTIVE_BACKDATED`）；
 * DB 侧的 `trg_commission_policy_weights_guard` 仍会再判一次（23514 ⇒ input ⇒ 400，同码同 status）。
 */
export const insertCommissionPolicy = async (
  input: InsertPolicyInput, ex?: Queryable,
): Promise<CommissionPolicy> => {
  guardCommissionPolicy(input, 'write');
  const at = input.effective_from ?? null;
  const exq: Queryable = ex ?? (getTransactionPool() as unknown as Queryable);
  const rows = await exq.query(`
    INSERT INTO commission_policy (fee_rate_bp, levels, weights_bp, effective_from, created_by)
    SELECT $1::integer, $2::smallint, $3::smallint[],
           COALESCE($4::timestamptz, now()), $5::bigint
     WHERE NOT EXISTS (
       SELECT 1 FROM commission_policy WHERE effective_from >= COALESCE($4::timestamptz, now()))
    RETURNING policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS weights_bp,
              effective_from::text AS effective_from, created_by::text AS created_by,
              time_created::text AS time_created`,
  [input.fee_rate_bp, input.levels, `{${input.weights_bp.join(',')}}`, at,
    toAmount(input.created_by, 'created_by').toString()]);
  if (!rows.rows.length) {
    // 回填 / 非严格递增 ⇒ 会得到一个**永不生效的死版本**（CR25 / 裁定 #10）
    throw new LedgerError('LEDGER_AMOUNT_INVALID', {
      field: 'effective_from', reason: COMMISSION_REASON.POLICY_EFFECTIVE_BACKDATED,
      provided: at ?? 'db_now()',
    });
  }
  return mapPolicy(rows.rows[0]);
};

// ============================================================================
// §3 邀请链（§3.4 / CR20 / CR21 / CR22；**只读**）
// ============================================================================

export interface ChainNode { beneficiary_uid: string; level: number; }
export interface ReferralChain {
  nodes: ChainNode[];
  chain_depth: number;
  /**
   * F7①：`chain_depth == cap` 时，链是否**还有更深的一层**。
   * `false` = 真实链恰好到 `cap` 就结束（「恰好 cap」）；`true` = 真实链 ≥ `cap`（被遍历上界截断）。
   * 加这个字段的原因：老字段 `chain_depth` 是**返回节点数**（恰好 cap 与 ≥cap 都 = cap ⇒ 不可分辨）；
   * 本字段是**纯新增**，`chain_depth` 的语义**未动**（调用点无需改）。
   */
  truncated: boolean;
  assertions: { contiguous_levels: boolean; within_cap: boolean; all_user_uids: boolean; no_duplicate_uid: boolean };
}

/**
 * 沿 `referral` 从 `uid` 上行取祖先，最多 `maxLevels` 层（`level < cap` 的**硬闸在 CTE 内**：
 * 缺它则深链拖长事务 / 有环时无限递归 —— 它是**遍历上界**，与防环无关；防环在写入侧由
 * `0007` 的三件（自指禁令 + 祖先检查 + 绑定串行化）+ `0010`/`0011` 的守卫保证，CR78/CR79）。
 * `L = 1` = 直接邀请人（CR2：级数从 1 起）。
 */
export const getReferralChain = async (
  uid: Amount, maxLevels: number, ex?: Queryable,
): Promise<ReferralChain> => {
  const u = assertUserUid(uid, 'worker_uid');
  const cap = Math.max(1, Math.floor(maxLevels));
  const rows = await runQuery<{ beneficiary_uid: string; level: number }>(ex, `
    WITH RECURSIVE up AS (
      SELECT r.parent_uid AS parent_uid, 1 AS level
        FROM referral r WHERE r.child_uid = $1
      UNION ALL
      SELECT r.parent_uid, up.level + 1
        FROM referral r JOIN up ON r.child_uid = up.parent_uid
       WHERE up.level < $2
    )
    SELECT parent_uid::text AS beneficiary_uid, level FROM up ORDER BY level`,
  [u.toString(), cap]);
  const nodes: ChainNode[] = rows.map((r) => ({ beneficiary_uid: String(r.beneficiary_uid), level: Number(r.level) }));
  const uids = nodes.map((n) => n.beneficiary_uid);
  // F7①：返回节点数恰好 == cap 时，**多问一次**「最深那层的父是否还存在」⇒ 区分「恰好 cap」与「≥ cap」。
  // （只在可能被截断时才多一次往返；链短于 cap 时不必问。）
  let truncated = false;
  if (nodes.length === cap && nodes.length > 0) {
    const deeper = await runQuery<{ more: boolean }>(ex, `
      SELECT EXISTS (SELECT 1 FROM referral r WHERE r.child_uid = $1::bigint) AS more`,
    [nodes[nodes.length - 1].beneficiary_uid]);
    truncated = deeper[0]?.more === true;
  }
  return {
    nodes,
    chain_depth: nodes.length,
    truncated,
    assertions: {
      contiguous_levels: nodes.every((n, i) => n.level === i + 1),
      within_cap: nodes.length <= cap,
      // CR21：平台保留 uid（0/−1..−99）不得出现在链上
      all_user_uids: nodes.every((n) => toAmount(n.beneficiary_uid, 'beneficiary_uid') > 0n),
      // CR22：I1（PK on child_uid）⇒ 上行遍历必为简单路径 ⇒ 链上 uid 互不重复
      no_duplicate_uid: new Set(uids).size === uids.length,
    },
  };
};

// ============================================================================
// §3.5 下行链（P9⑤ · R-9-50：递归 CTE · 零新表）—— 与上行 `getReferralChain` 对称
// ============================================================================
// 「以 Worker 为中心」的新口径（commission.spec v0.4 §19.4 / §19.5①）需要**下行 3 层**：
//   `WITH RECURSIVE down … WHERE level < cap`，走 `idx_referral_parent`（`WHERE parent_uid = ?`）。
// 与上行同理：`level < cap` 的硬闸在 CTE 内（遍历上界，防深树拖长事务）；防环在写入侧
// （`0007` 三件 + `0010`/`0011` 守卫）。`L = 1` = 直接下级。

export interface DownChainNode { descendant_uid: string; level: number; bound_at: string | null; }
export interface ReferralDownChain {
  /** 按 `(level ASC, descendant_uid ASC)` 定序（确定性 · 可复现） */
  nodes: DownChainNode[];
  /** 已遍历到的最深层号（0 = 无任何下级） */
  down_depth: number;
  /** 是否存在比 `cap` 更深的一层（`cap` 层任一节点有子 ⇒ true；与上行 `truncated` 同义） */
  truncated: boolean;
  assertions: { contiguous_levels: boolean; within_cap: boolean; all_user_uids: boolean; no_duplicate_uid: boolean };
}

/**
 * 沿 `referral` 从 `uid` **下行**取子孙，最多 `maxLevels` 层（`level < cap` 硬闸在 CTE 内）。
 * 与 `getReferralChain` 严格对称（结构断言 / 定序 / 截断标记同口径）。
 */
export const getDownChain = async (
  uid: Amount, maxLevels: number, ex?: Queryable,
): Promise<ReferralDownChain> => {
  const u = assertUserUid(uid, 'worker_uid');
  const cap = Math.max(1, Math.floor(maxLevels));
  const rows = await runQuery<{ descendant_uid: string; level: number; bound_at: string | null }>(ex, `
    WITH RECURSIVE down AS (
      SELECT r.child_uid AS descendant_uid, 1 AS level, r.bound_at
        FROM referral r WHERE r.parent_uid = $1
      UNION ALL
      SELECT r.child_uid, down.level + 1, r.bound_at
        FROM referral r JOIN down ON r.parent_uid = down.descendant_uid
       WHERE down.level < $2
    )
    SELECT descendant_uid::text AS descendant_uid, level, bound_at::text AS bound_at
      FROM down ORDER BY level, descendant_uid`,
  [u.toString(), cap]);
  const nodes: DownChainNode[] = rows.map((r) => ({
    descendant_uid: String(r.descendant_uid), level: Number(r.level),
    bound_at: r.bound_at === null || r.bound_at === undefined ? null : String(r.bound_at),
  }));
  const maxLevel = nodes.reduce((m, n) => Math.max(m, n.level), 0);
  const levelsPresent = new Set(nodes.map((n) => n.level));
  // 树形下行 ⇒ 若存在 level k 的节点，其祖先链保证 1..k-1 皆有节点 ⇒ 层级连续；此处显式核验。
  let contiguous = true;
  for (let L = 1; L <= maxLevel; L++) if (!levelsPresent.has(L)) contiguous = false;
  // 截断：`cap` 层任一节点仍有子 ⇒ 真实下行 > cap（与上行 `truncated` 同判据）
  let truncated = false;
  if (maxLevel === cap && nodes.some((n) => n.level === cap)) {
    const deepest = nodes.filter((n) => n.level === cap).map((n) => n.descendant_uid);
    const more = await runQuery<{ more: boolean }>(ex, `
      SELECT EXISTS (SELECT 1 FROM referral r WHERE r.parent_uid = ANY($1::bigint[])) AS more`,
    [`{${deepest.join(',')}}`]);
    truncated = more[0]?.more === true;
  }
  const uids = nodes.map((n) => n.descendant_uid);
  return {
    nodes,
    down_depth: maxLevel,
    truncated,
    assertions: {
      contiguous_levels: contiguous,
      within_cap: maxLevel <= cap,
      all_user_uids: nodes.every((n) => toAmount(n.descendant_uid, 'descendant_uid') > 0n),
      no_duplicate_uid: new Set(uids).size === uids.length,
    },
  };
};

export interface ChainContext {
  /** 打工人（链的起点）；只用于诊断读数 */
  worker_uid?: string;
  /** 供诊断的附加读数（如 job_id） */
  job_id?: string;
  /**
   * ★ P9⑤（`R-9-56`）：本次分配**名单**（以 Worker 为中心「上 3 ∪ 下 3」，**已结构性剔除 worker**）。
   * 名单含 `worker_uid` ⇒ 硬拒（图损坏 / 管理员旁路 ⇒ 归属不可信）。
   */
  roster_uids?: ReadonlyArray<string>;
  /** ★ P9⑤（`R-9-50`）：下行链结构断言（与上行同判；`within_cap` 不硬拒）。 */
  down_chain?: ReferralDownChain;
}

/**
 * F1（独立质检不通过修复单）：**落账前**对链的结构断言做响亮拒绝。
 * ============================================================================
 * 修前事实（质检 F1 + Neng 一手复现）：`getReferralChain` 算出四个断言，但**全模块从未读过它们**；
 * 唯一被读的是 `event.assertions.sum_x_equals_pool`（那是**池子总量**，不是**归属**）⇒
 * 当库里存在环（管理员旁路写入）时，链返回 `[X,Y,X,Y,…]×10`、`no_duplicate_uid=false`、含**打工人本人**，
 * 而 `planJobSettlement` 产出的载荷仍然 `Σ x == P` ⇒ DB 的 Σ 守恒触发器（只查总量）放行 ⇒ **静默错付**。
 *
 * 判据（**硬拒**，逐条可机读）：
 *   · `no_duplicate_uid === false` ⇒ 拒（链上 uid 重复 = 环污染 = 归属不可信）
 *   · `contiguous_levels === false` ⇒ 拒（层级号不连续 = 遍历结果损坏）
 *   · `all_user_uids === false` ⇒ 拒（平台保留 uid 出现在链上 = 图损坏 / 越界数据）
 *   · `within_cap === false` ⇒ **不**硬拒（链长超 cap 是**设计内**行为：`cap = levels`，只分前 cap 层；
 *     该值仍随错误/计划一并回报，供观测）。
 *
 * 错误取 **500 类（defect）**：借既有闭集码 `LEDGER_RECONCILE_MISMATCH`（= `LD032`，§14.1 第 33 码，
 * bucket = defect；`httpStatus` 由 `httpStatusOf` 兜底为 `500`）——内部不变式被破坏**不是**调用方输入错，
 * 所以**不得**落 400。**不新增错误码**。机读 `details.reason = COMMISSION_CHAIN_ASSERTION_VIOLATED`，
 * `details.failed_assertions` 逐条列出**哪个断言**失败。
 */
export const assertReferralChainInvariants = (chain: ReferralChain, ctx: ChainContext = {}): void => {
  const failed: string[] = [];
  if (!chain.assertions.no_duplicate_uid) failed.push('no_duplicate_uid');
  if (!chain.assertions.contiguous_levels) failed.push('contiguous_levels');
  if (!chain.assertions.all_user_uids) failed.push('all_user_uids');
  // ★ P9⑤（R-9-56）：Worker **结构性剔除**的防御断言 —— 名单（上 3 ∪ 下 3）含 `worker_uid`
  //   ⇒ 图损坏 / 管理员旁路 ⇒ 归属不可信 ⇒ 与链断言同判据硬拒（`500` + `COMMISSION_CHAIN_ASSERTION_VIOLATED`）。
  //   （结构性剔除本身在名单构建处保证：遍历种子不含 Worker 本人。）
  if (ctx.roster_uids && ctx.worker_uid !== undefined
      && ctx.roster_uids.some((x) => x === ctx.worker_uid)) {
    failed.push('worker_in_roster');
  }
  // ★ P9⑤（R-9-50）：下行链结构断言（与上行同判；`within_cap` 不硬拒 —— 遍历上界是设计内行为）。
  if (ctx.down_chain) {
    if (!ctx.down_chain.assertions.no_duplicate_uid) failed.push('down_no_duplicate_uid');
    if (!ctx.down_chain.assertions.contiguous_levels) failed.push('down_contiguous_levels');
    if (!ctx.down_chain.assertions.all_user_uids) failed.push('down_all_user_uids');
  }
  if (failed.length === 0) return;
  throw new LedgerError('LEDGER_RECONCILE_MISMATCH', {
    reason: COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED,
    failed_assertions: failed.join(','),
    failed_count: failed.length,
    chain_depth: chain.chain_depth,
    chain_truncated: chain.truncated,
    within_cap: chain.assertions.within_cap,
    worker_uid: ctx.worker_uid ?? '',
    job_id: ctx.job_id ?? '',
    // P9⑤：名单规模 + 下行深度（诊断；不下发名单本体）
    roster_size: ctx.roster_uids ? ctx.roster_uids.length : 0,
    down_depth: ctx.down_chain ? ctx.down_chain.down_depth : 0,
    // 诊断：链上节点（含重复项）逐层铺开；只放非敏感 uid/层级
    chain_nodes: chain.nodes.map((n) => `${n.level}:${n.beneficiary_uid}`).join(','),
    note: 'referral graph invariants broken (cycle / platform uid / level gap) => attribution untrustworthy, refusing before ledger post',
  });
};

// ============================================================================
// §4 取整与分配（§6；CR38 / CR41 / CR42 / CR44 / CR45；全整数 BigInt、禁浮点）
// ============================================================================

/** R68 / CR38：整数除法 = half-up（分母必须是 2 的倍数或用 `den/2` 补偿） */
export const mulDivHalfUp = (a: bigint, b: bigint, den: bigint): bigint => {
  if (den <= 0n) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'den', reason: 'NOT_POSITIVE' });
  return (a * b + den / 2n) / den;
};

/** CR38：`fee = (gross × fee_rate_bp + 5000) / 10000`（**全项目唯一的取整点**） */
export const computeFee = (gross: Amount, feeRateBp: number | bigint): bigint =>
  mulDivHalfUp(toAmount(gross, 'gross'), toAmount(feeRateBp as Amount, 'fee_rate_bp'), 10000n);

/** CR39 / D14：`net = gross − fee`（**减法**求净额；禁止第二次取整 ⇒ `net + fee == gross` 恒等） */
export const computeNet = (gross: Amount, fee: Amount): bigint =>
  toAmount(gross, 'gross') - toAmount(fee, 'fee');

export interface SplitResult {
  pool: string;
  M: number;
  weights_bp: string[];
  /** 归一化分母（= Σ 已存在层级权重；**不是 10000**，CR47） */
  W: string;
  q: string[];
  r: string[];
  /** 残余 `D = P − Σq`（数学上 `0 <= D < M`） */
  D: string;
  /** 第 `L` 层实付（`L = 1..M`，索引 `L-1`） */
  x: string[];
  sum_x: string;
  /** 拿到 `+1` 的层号（升序，便于人读对拍） */
  plus_one_levels: number[];
  /** 排序全序（0-based 下标，按 `(r DESC, L DESC)`） */
  order: number[];
  sum_ok: boolean;
}

/**
 * §6.2 **最大余数法**（本册唯一分配算法）：
 * ```
 * W  := Σ_{L=1..M} w_L
 * q_L := (P × w_L) / W            -- 整除（向下取整）
 * r_L := (P × w_L) mod W
 * D  := P − Σ q_L                 -- 0 <= D < M
 * 排序：L 按 (r_L DESC, L DESC) 排成全序
 * x_L := q_L + 1（前 D 名）/ q_L（其余）
 * ```
 * 性质（可证）：① `D` 个 `+1` 刚好分完 ⇒ **`Σ x_L == P` 逐分不差**（构造出来，**不做任何二次舍入**，
 * CR45）；② 排序键 `(r_L DESC, L DESC)` 是**全序** ⇒ 结果唯一确定、可复现（CR42）。
 */
export const splitPoolByWeights = (pool: Amount, weights: ReadonlyArray<Amount>): SplitResult => {
  const P = toAmount(pool, 'pool');
  const w = weights.map((v, i) => toAmount(v, `weights_bp[${i + 1}]`));
  const M = w.length;
  if (P < 0n) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'pool', reason: 'NEGATIVE_POOL', pool: P.toString() });
  if (M === 0) {
    if (P !== 0n) {
      // M = 0 且 P > 0：调用方的分流错了（无邀请人时手续费必须入 `-1`，不得到这里来，CR52）
      throw new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION', {
        reason: COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH,
        note: 'M=0 with non-zero pool (caller must route fee to -1 per CR52)',
        pool: P.toString(),
      });
    }
    return { pool: '0', M: 0, weights_bp: [], W: '0', q: [], r: [], D: '0', x: [], sum_x: '0',
      plus_one_levels: [], order: [], sum_ok: true };
  }
  const W = w.reduce((a, b) => a + b, 0n);
  if (W <= 0n) {
    // §7.3：`W = 0` 在**政策写入时**已被 0007 守卫拒（裁定 #16）⇒ 运行时**不可达**。
    // 兜底按 §14.2 #2：库中已存在 `weights_bp[1] = 0` 的历史行 = 越界改库 ⇒ **defect / 500**。
    // ⚠️ 两处口径张力（§13.2 #10 写 400 / §14.2 #2 读 500）已登记交付报告，不在此静默择一。
    throw new LedgerError('LEDGER_FEE_RATE_INVALID', {
      reason: COMMISSION_REASON.POLICY_WEIGHTS_ALL_ZERO, levels: M,
      note: 'runtime W=0 branch is unreachable under 0007 write-time guard',
    });
  }
  const q = w.map((wi) => (P * wi) / W);
  const r = w.map((wi) => (P * wi) % W);
  const sumQ = q.reduce((a, b) => a + b, 0n);
  const D = P - sumQ;
  // 排序键 (r_L DESC, L DESC)：余数相同 ⇒ **更深层优先**（CR42 / §6.4 例 5）
  const order = w.map((_, i) => i).sort((a, b) => (r[b] > r[a] ? 1 : r[b] < r[a] ? -1 : b - a));
  const x = [...q];
  const plusOne: number[] = [];
  const plusCount = Number(D);
  if (plusCount < 0 || BigInt(plusCount) !== D || plusCount > M) {
    throw new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION', {
      reason: COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH, D: D.toString(), M,
    });
  }
  for (let k = 0; k < plusCount; k++) { const idx = order[k]; x[idx] += 1n; plusOne.push(idx + 1); }
  const sumX = x.reduce((a, b) => a + b, 0n);
  if (sumX !== P) {
    // CR43：落账前的显式断言（把「分不干净」从静默的资金黑洞变成响亮的 500 + R108）
    throw new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION', {
      reason: COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH,
      pool: P.toString(), sum_x: sumX.toString(), M: String(M),
    });
  }
  return {
    pool: P.toString(), M, weights_bp: w.map(String), W: W.toString(),
    q: q.map(String), r: r.map(String), D: D.toString(), x: x.map(String), sum_x: sumX.toString(),
    plus_one_levels: plusOne.sort((a, b) => a - b), order, sum_ok: true,
  };
};

// ============================================================================
// §4.5 两级最大余数法（P9⑤ · R-9-54）：层间（承 §6.2）→ 层内均分（第二级最大余数法）
// ============================================================================
// 权威口径：commission.spec v0.4 §19.5② / §19.6b（裁定 `R-9-54`）。
// · 层间：把池 P 按 6 层权重（`weights_bp`，序 `[U1,U2,U3,D1,D2,D3]`）用**一级最大余数法**分为层额
//   `x_L`（sort `(r_L DESC, L DESC)`，承 CR41/CR42）—— 复用 `splitPoolByWeights`。
// · 层内：把每层 `x_L` 在该层 `N_L` 名受益人之间**均分**（等权）—— 第二级最大余数法
//   （sort `(r_i DESC, uid ASC)`；等权 ⇒ `r_i` 恒相同 ⇒ 由 `uid ASC` 定序 ⇒ 取前 `x_L mod N_L` 名各 `+1`）。
// · 两级一律**整数**（BigInt）、**禁任何二次浮点舍入**；`Σ 全部人 == P` **构造性成立**（CR45 精神不变）。

export interface PoolLayerBeneficiary { uid: string; }
export interface PoolLayer {
  /** 层号 L（`1..6`）：`1..3` = 上行 `U1..U3`；`4..6` = 下行 `D1..D3`（= `weights_bp` 下标 +1） */
  layer: number;
  direction: 'up' | 'down';
  /** 距 Worker 的层距（`1..3`；`U_d` 与 `D_d` 同为 `d`） */
  distance: number;
  weight_bp: number;
  /** 该层受益人（**已**按层内规则截断并定序）；`splitPoolTwoLevel` 不再截断 */
  beneficiaries: ReadonlyArray<PoolLayerBeneficiary>;
}
export interface PoolLayerAlloc {
  layer: number; direction: 'up' | 'down'; distance: number;
  weight_bp: string; q: string; r: string;
  /** 该层层额 `x_L`（= Σ 该层每个受益人所得） */
  x: string;
}
export interface PoolEntryAlloc { layer: number; direction: 'up' | 'down'; distance: number; uid: string; x: string; }
export interface PoolAllocation {
  pool: string;
  /** 参与分配的**存在层**数（`M ∈ [0,6]`） */
  M: number;
  /** 重归一化分母 `W = Σ 存在层权重`（**不是 10000**，CR47） */
  W: string;
  layers: PoolLayerAlloc[];
  entries: PoolEntryAlloc[];
  /** 一级残余 `D = P − Σ q_L`（层间） */
  D: string;
  /** 一级全序（存在层下标 0-based，按 `(r DESC, L DESC)`） */
  order: number[];
  sum_x: string;
  sum_ok: boolean;
  plus_one_layers: number[];
}

/**
 * §19.5② **两级最大余数法**（P9⑤ 的唯一分配算法，裁定 `R-9-54`）。
 * `Σ entries == pool` 构造性成立（CR45）；层内等权 ⇒ 层内 tie-break `(r DESC, uid ASC)` 退化为 `uid ASC`。
 */
export const splitPoolTwoLevel = (
  pool: Amount, layers: ReadonlyArray<PoolLayer>,
): PoolAllocation => {
  const P = toAmount(pool, 'pool');
  const present = layers.filter((l) => l.beneficiaries.length > 0);
  const M = present.length;
  if (M === 0) {
    if (P !== 0n) {
      // M = 0 且 P > 0：调用方的分流错了（无合格受益人时手续费必须入 -1，不得到这里来，R-9-52）
      throw new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION', {
        reason: COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH,
        note: 'M=0 with non-zero pool (caller must route fee to -1 per R-9-52)',
        pool: P.toString(),
      });
    }
    return { pool: '0', M: 0, W: '0', layers: [], entries: [], D: '0', order: [], sum_x: '0', sum_ok: true, plus_one_layers: [] };
  }
  // ---- 一级：层间（一级最大余数法，sort `(r DESC, L DESC)`；L = 向量位序）
  const lvl1 = splitPoolByWeights(P, present.map((l) => BigInt(l.weight_bp)));
  const layerAlloc: PoolLayerAlloc[] = present.map((l, i) => ({
    layer: l.layer, direction: l.direction, distance: l.distance,
    weight_bp: String(l.weight_bp), q: lvl1.q[i], r: lvl1.r[i], x: lvl1.x[i],
  }));
  // ---- 二级：层内均分（第二级最大余数法，sort `(r DESC, uid ASC)`）
  const entries: PoolEntryAlloc[] = [];
  for (let i = 0; i < present.length; i++) {
    const xL = BigInt(lvl1.x[i]);
    const bens = present[i].beneficiaries;
    const n = BigInt(bens.length);
    if (n === 0n) continue;
    const base = xL / n;
    const plus = Number(xL % n);   // 取前 plus 名各 +1（等权 ⇒ r 恒相同 ⇒ 由 uid ASC 定序）
    const order = bens.map((_, idx) => idx)
      .sort((a, b) => (bens[a].uid < bens[b].uid ? -1 : bens[a].uid > bens[b].uid ? 1 : 0));
    const amt = bens.map(() => base);
    for (let k = 0; k < plus; k++) amt[order[k]] += 1n;
    for (const idx of order) {
      entries.push({
        layer: present[i].layer, direction: present[i].direction, distance: present[i].distance,
        uid: bens[idx].uid, x: amt[idx].toString(),
      });
    }
  }
  const sumX = entries.reduce((a, e) => a + BigInt(e.x), 0n);
  if (sumX !== P) {
    throw new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION', {
      reason: COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH,
      pool: P.toString(), sum_x: sumX.toString(), M: String(M),
    });
  }
  return {
    pool: P.toString(), M, W: lvl1.W, layers: layerAlloc, entries,
    D: lvl1.D, order: lvl1.order,
    sum_x: sumX.toString(), sum_ok: true, plus_one_layers: lvl1.plus_one_levels,
  };
};

/**
 * P9⑤：`splitPool` 成**两级**入口（`R-9-54`）。
 *   · 第二参为 `PoolLayer[]`（对象）⇒ 走**两级**最大余数法（`splitPoolTwoLevel`）；
 *   · 第二参为 `Amount[]`（数值）⇒ 走**一级**最大余数法（`splitPoolByWeights`，逐字保留为原语；
 *     供层间步骤 / 既有 QA 脚本复用）。
 * 语义等价：`splitPool(P, weights)` ≡ 旧行为；`splitPool(P, layers)` = 新两级。
 */
export function splitPool(pool: Amount, weights: ReadonlyArray<Amount>): SplitResult;
export function splitPool(pool: Amount, layers: ReadonlyArray<PoolLayer>): PoolAllocation;
export function splitPool(
  pool: Amount, arg: ReadonlyArray<Amount> | ReadonlyArray<PoolLayer>,
): SplitResult | PoolAllocation {
  if (arg.length > 0 && typeof arg[0] === 'object' && arg[0] !== null) {
    return splitPoolTwoLevel(pool, arg as ReadonlyArray<PoolLayer>);
  }
  return splitPoolByWeights(pool, arg as ReadonlyArray<Amount>);
}

// ============================================================================
// §5 结算计划（§7 重归一化 + §8 边界）与载荷构建（§5 分录顺序铁律）
// ============================================================================

export interface CommissionLayer {
  /** 层号 L（`1..6`）：`1..3` = 上行 `U1..U3`；`4..6` = 下行 `D1..D3`（= `weights_bp` 下标 +1） */
  level: number;
  beneficiary_uid: string;
  weight_bp: string;
  q: string;
  r: string;
  /** 实付；`"0"` ⇒ **不建分录**（CR48） */
  x: string;
  // ---- ★ P9⑤（纯新增可选字段，旧字段语义未动；重放路径不填 = undefined）
  /** 方向（`up` = 上行上级；`down` = 下行下级） */
  direction?: 'up' | 'down';
  /** 距 Worker 的层距（`1..3`） */
  distance?: number;
  /** 该层层额 `x_L`（= Σ 该层每人所得；= `x` 当且仅当该层仅 1 人） */
  layer_share?: string;
}

export interface SettlementPlan {
  job_id: string;
  idempotency_key: string;
  employer_uid: string;
  worker_uid: string;
  cid: string;
  gross: string;
  fee: string;
  net: string;
  /** 池子 `P = fee`（D6：全额进池、平台不抽成） */
  pool: string;
  policy: CommissionPolicy;
  chain_depth: number;
  /**
   * F7①（**纯新增字段，旧字段语义未动**）：`chain_depth == cap` 时，真实链是否更深。
   * `false` = 恰好 cap；`true` = 真实链 ≥ cap（只分前 `levels` 层是设计内行为）。
   */
  chain_truncated: boolean;
  // ---- ★ P9⑤（纯新增字段，旧字段语义未动）
  /** 下行链深度（`0..3`；0 = 无任何下级） */
  down_depth: number;
  /** 下行链是否被遍历上界（3）截断（与 `chain_truncated` 同义） */
  down_truncated: boolean;
  /** 本次分配名单规模（「上 3 ∪ 下 3」截断后、已结构性剔除 Worker） */
  roster_size: number;
  /** 名单规模上限截断留痕（`R-9-55`；常态 `truncated = false`） */
  truncation: RosterTruncation;
  /**
   * F7②（**纯新增字段**）：本计划的来源。
   *   · `'computed'`             = 由**当前政策 + 本次输入**算出（正常首写路径）；
   *   · `'replayed_from_ledger'` = 幂等重放：**全部金额读数由账上已落事件导出**，
   *     未用当前政策/当前输入重算（政策改版后重放不会返回「另一个版本的金额」）。
   */
  plan_source: SettlementPlanSource;
  /**
   * F7②（**纯新增字段**）：`policy` 字段是否**如实**代表了产生本计划的政策。
   *   · `true`  = 正常计算路径（`policy` = 实际用的那一版）；
   *   · `false` = 重放路径：**政策不落账**（账上没有政策引用）⇒ `policy` 只是占位符
   *     （`policy_id = 'ledger_replay'`），**不得**用它回算任何金额；金额一律看本计划的
   *     `fee`/`net`/`gross`/`layers` 等（那些来自账上事件）。
   */
  policy_reported: boolean;
  /** ★ P9⑤：参与分配的**存在层**数（`M ∈ [0,6]`；= 有受益人的层数、截断后） */
  M: number;
  /** `N` = 实际产生 `commission` 分录的层数（`x_L = 0` 的层不产生，CR48） */
  N: number;
  weights_bp: string[];
  W: string;
  split: SplitResult | null;
  layers: CommissionLayer[];
  /** `job_fee` 增方 uid：`-2`（正常/短链）或 `-1`（无邀请人，裁定 #11） */
  fee_credit_uid: string;
  zero_amount: boolean;
  no_referrer: boolean;
}

/** F7②：计划来源（`computed` = 按当前政策算；`replayed_from_ledger` = 由账上事件导出） */
export type SettlementPlanSource = 'computed' | 'replayed_from_ledger';

/**
 * F7②：重放路径的**政策占位符**。账本不记录政策（`ledger_entry` 没有 policy 列）⇒
 * 由账上事件导出的计划**不可能**知道当时那一版政策的 `fee_rate_bp`/`weights_bp`。
 * 与其「用当前政策冒充当时政策」（= 撒谎），不如显式占位 + `policy_reported = false`，
 * 让调用方一眼看出「这个 policy 不可信、金额要看账」。
 */
export const LEDGER_REPLAY_POLICY: CommissionPolicy = {
  policy_id: 'ledger_replay',
  fee_rate_bp: 0,
  levels: 0,
  weights_bp: [],
  effective_from: '',
  created_by: 'ledger',
  time_created: '',
  weights_sum_bp: 0,
};

export interface SettleJobInput {
  jobId: Amount;
  /** ★ S4a（`R-9-101`）：目标提交号（逐笔发放）；缺省 ⇒ 遗留单笔（键退化为 `biz:job:settle:<job_id>`）。 */
  submissionId?: Amount;
  employerUid: Amount;
  workerUid: Amount;
  cid: Amount;
  /** 招工酬金全额（最小单位整数）；`gross > 0` 由 P3 保证（§8.4） */
  gross: Amount;
  /** ⚠️ 仅质检脚本用（复现「某时刻生效的那版政策」）；**服务层不得传**（CR4：T 取自 DB now()） */
  at?: string | Date | null;
  memo?: string;
  /** R53：规范化请求体的 sha256；省略 ⇒ 由 business 字段确定性派生（同一业务事实 ⇒ 同指纹） */
  requestFingerprint?: string | null;
  /** §5.2 可选：对本事件所有 cid 施加结算档状态矩阵（`'settle'`） */
  currencyOp?: 'settle';
  /** 只读查询执行器（脚本注入）；省略 ⇒ 走 db.ts 只读池 */
  ex?: Queryable;
}

/** R53：请求指纹的**确定性**派生（同一 business 输入 ⇒ 逐字节同指纹 ⇒ 重放不退化成 409） */
export const settleJobFingerprint = (i: SettleJobInput): string =>
  createHash('sha256').update(JSON.stringify({
    job_id: toAmount(i.jobId, 'job_id').toString(),
    submission_id: i.submissionId === undefined || i.submissionId === null || String(i.submissionId).trim() === ''
      ? null
      : toAmount(i.submissionId, 'submission_id').toString(),
    employer_uid: toAmount(i.employerUid, 'employer_uid').toString(),
    worker_uid: toAmount(i.workerUid, 'worker_uid').toString(),
    cid: toAmount(i.cid, 'cid').toString(),
    gross: toAmount(i.gross, 'gross').toString(),
  })).digest('hex');

// ============================================================================
// §4.6 分配名单（P9⑤ · 以 Worker 为中心「上 3 ∪ 下 3」· Worker 结构性剔除 · 上限截断留痕）
// ============================================================================
// 权威口径：commission.spec v0.4 §19.4 / §19.5①③④（裁定 `R-9-53` / `R-9-55` / `R-9-56`）。
//   · 权重向量序位 `[U1,U2,U3,D1,D2,D3]`（对称 `{2600,1700,700,2600,1700,700}`，`Σ=10000`）。
//   · 层号 L：`1..3` = 上行 `U1..U3`；`4..6` = 下行 `D1..D3`（= `weights_bp` 下标 +1）。
//   · **Worker 结构性剔除**：遍历种子（上行 `parent_uid` / 下行 `child_uid`）本就不含 Worker 本人
//     ⇒ 物理上不可能入名单；此处再过滤一次作兜底（`R-9-56`）。
//   · **双层上限**（后台可配 · 常态不触发）：每层 ≤ `capLayer`（默认 64）∧ 总名单 ≤ `capTotal`（默认 384）。
//     超限**截断**序 = `(近者优先 → bound_at ASC → uid ASC)`；**必留痕**（`truncation`）。

export const COMMISSION_CAP_LAYER_DEFAULT = 64;
export const COMMISSION_CAP_TOTAL_DEFAULT = 384;

export interface RosterBeneficiary { uid: string; }
export interface CommissionRosterLayer {
  layer: number; direction: 'up' | 'down'; distance: number; weight_bp: number;
  beneficiaries: RosterBeneficiary[];   // 已截断、按 uid ASC 定序
}
export interface RosterTruncation {
  cap_layer: number;
  cap_total: number;
  /** 被截断（丢弃）的候选总数（层内 + 总名单） */
  dropped_total: number;
  /** 逐层丢弃数（键 = 层号 L 的字符串） */
  dropped_by_layer: Record<string, number>;
  /** 是否发生任何截断（常态 `false`） */
  truncated: boolean;
}
export interface CommissionRoster {
  worker_uid: string;
  up_depth: number;
  down_depth: number;
  /** 本次考虑的**有效层数上限**（= min(6, levels, weights 长度)；`R-9-60` levels 语义 = 有效层数含下 3） */
  layer_span: number;
  /** 参与分配的**存在层**数 M（`0..layer_span`） */
  M: number;
  /** 重归一化分母 `W = Σ 存在层权重`（不是 10000，CR47） */
  W: string;
  layers: CommissionRosterLayer[];
  truncation: RosterTruncation;
  /** 名单内全部 uid（存在层，截断后；已剔除 Worker） */
  uids: string[];
}

/** 单层内截断序：`bound_at ASC → uid ASC`（`bound_at` 缺失按空串 = 最先）。 */
const rosterCmp = (
  a: { bound_at: string | null; uid: string }, b: { bound_at: string | null; uid: string },
): number => {
  const ab = a.bound_at ?? ''; const bb = b.bound_at ?? '';
  if (ab !== bb) return ab < bb ? -1 : 1;
  return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
};

/**
 * 组装「以 Worker 为中心」的分配名单（**只读**；纯函数，便于单测）。
 * 上行层 `L=1..3` 至多 1 人（祖先链）；下行层 `L=4..6` 为 `D_{L-3}` 层全部下级（树分支）。
 * `levels`（有效层数）截断为 `min(6, levels, weights_bp.length)` —— 取权重向量前缀。
 */
export const buildCommissionRoster = (
  workerUid: Amount,
  up: ReferralChain,
  down: ReferralDownChain,
  policy: Pick<CommissionPolicy, 'levels' | 'weights_bp'>,
  caps: { capLayer?: number; capTotal?: number } = {},
): CommissionRoster => {
  const worker = assertUserUid(workerUid, 'worker_uid').toString();
  const capLayer = Math.max(1, Math.floor(caps.capLayer ?? COMMISSION_CAP_LAYER_DEFAULT));
  const capTotal = Math.max(1, Math.floor(caps.capTotal ?? COMMISSION_CAP_TOTAL_DEFAULT));
  const span = Math.max(0, Math.min(6, policy.levels, policy.weights_bp.length));

  type Cand = { uid: string; bound_at: string | null };
  const raw: { L: number; direction: 'up' | 'down'; distance: number; weight_bp: number; cand: Cand[] }[] = [];
  for (let L = 1; L <= span; L++) {
    const weight_bp = policy.weights_bp[L - 1];
    if (L <= 3) {
      const node = up.nodes.find((n) => n.level === L);
      raw.push({ L, direction: 'up', distance: L, weight_bp, cand: node ? [{ uid: node.beneficiary_uid, bound_at: null }] : [] });
    } else {
      const d = L - 3;
      const nodes = down.nodes.filter((n) => n.level === d);
      raw.push({ L, direction: 'down', distance: d, weight_bp, cand: nodes.map((n) => ({ uid: n.descendant_uid, bound_at: n.bound_at })) });
    }
  }
  // Worker 结构性剔除（种子本就不含 ⇒ 兜底过滤；防御断言在 assertReferralChainInvariants）
  for (const l of raw) l.cand = l.cand.filter((c) => c.uid !== worker);

  const droppedByLayer: Record<string, number> = {};
  let droppedTotal = 0;
  // ---- 层内上限
  for (const l of raw) {
    l.cand.sort(rosterCmp);
    if (l.cand.length > capLayer) {
      const dropped = l.cand.length - capLayer;
      droppedByLayer[String(l.L)] = (droppedByLayer[String(l.L)] ?? 0) + dropped;
      droppedTotal += dropped;
      l.cand = l.cand.slice(0, capLayer);
    }
  }
  // ---- 总名单上限（近者优先 → bound_at ASC → uid ASC）
  let kept: { L: number; distance: number; bound_at: string | null; uid: string }[] = [];
  for (const l of raw) for (const c of l.cand) kept.push({ L: l.L, distance: l.distance, bound_at: c.bound_at, uid: c.uid });
  if (kept.length > capTotal) {
    kept.sort((a, b) => (a.distance !== b.distance ? a.distance - b.distance : rosterCmp(a, b)));
    for (const k of kept.slice(capTotal)) {
      droppedByLayer[String(k.L)] = (droppedByLayer[String(k.L)] ?? 0) + 1;
      droppedTotal += 1;
    }
    kept = kept.slice(0, capTotal);
  }
  // ---- 重建层（L ASC；层内 uid ASC）
  const layers: CommissionRosterLayer[] = raw.map((l) => ({
    layer: l.L, direction: l.direction, distance: l.distance, weight_bp: l.weight_bp,
    beneficiaries: kept.filter((k) => k.L === l.L).map((k) => ({ uid: k.uid }))
      .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
  }));
  const present = layers.filter((l) => l.beneficiaries.length > 0);
  const W = present.reduce((a, l) => a + l.weight_bp, 0);
  const uids = present.flatMap((l) => l.beneficiaries.map((b) => b.uid));
  return {
    worker_uid: worker, up_depth: up.chain_depth, down_depth: down.down_depth, layer_span: span,
    M: present.length, W: String(W), layers,
    truncation: { cap_layer: capLayer, cap_total: capTotal, dropped_total: droppedTotal,
      dropped_by_layer: droppedByLayer, truncated: droppedTotal > 0 },
    uids,
  };
};

/**
 * 组装结算计划（**只读**：读政策 + 读邀请图 + 算金额；不落账、不加锁）。
 *
 * ★ P9⑤ 改版（`R-9-1` / `R-9-48` / `R-9-50` / `R-9-52` / `R-9-54` / `R-9-56`）：
 *   · 名单 = 以 Worker 为中心「上 3 ∪ 下 3」共 6 层（`buildCommissionRoster`）；Worker **结构性剔除**；
 *   · 层间 → 层内**两级最大余数法**（`splitPoolTwoLevel`）；`M ∈ [0,6]`（存在层数）；
 *   · `M = 0`（无合格受益人）⇒ `fee_credit_uid = -1`（`R-9-52`，兜底非抽成）；
 *   · 名单上限截断留痕（`R-9-55`）；坏链（上行 / 下行 / 名单含 Worker）⇒ 落账前硬拒（`R-9-56`）。
 * `W = Σ 存在层权重`（CR47：重归一化的唯一分母；**不是 10000**）。
 *
 * F1 + P9⑤：拿到上行链 / 下行链后**立刻**做 `assertReferralChainInvariants` —— 坏链（环污染 /
 * 平台 uid / 层级断裂 / 名单含 Worker）**不产出计划**（直接抛 500 defect + 机读 reason），
 * 而不是「先算出一份看起来正常的计划、等落账时才发现付错人」。抛错则不可能被漏读（fail-closed）。
 */
export const planJobSettlement = async (input: SettleJobInput): Promise<SettlementPlan> => {
  const jobId = toAmount(input.jobId, 'job_id');
  const employer = assertUserUid(input.employerUid, 'employer_uid');
  const worker = assertUserUid(input.workerUid, 'worker_uid');
  const cid = toAmount(input.cid, 'cid');
  const gross = toAmount(input.gross, 'gross');
  if (gross <= 0n) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'gross', reason: 'NOT_POSITIVE' });

  const policy = await getCommissionPolicy(input.at ?? null, input.ex);
  // ★ P9⑤（R-9-50）：以 Worker 为中心「上 3 ∪ 下 3」—— 上行只取 3 层（新口径），下行新增（递归 CTE）。
  const up = await getReferralChain(worker, 3, input.ex);
  const down = await getDownChain(worker, 3, input.ex);
  const roster = buildCommissionRoster(worker, up, down, policy);
  // F1 + P9⑤：落账前的**归属**闸（上行/下行链结构 + 名单含 Worker ⇒ 响亮拒绝；within_cap 不在此列）
  assertReferralChainInvariants(up, {
    worker_uid: worker.toString(), job_id: jobId.toString(),
    roster_uids: roster.uids, down_chain: down,
  });

  const fee = computeFee(gross, policy.fee_rate_bp);
  const net = computeNet(gross, fee);
  const M = roster.M;                          // ★ P9⑤（R-9-46 勘误）：存在层数（0..6），非 min(levels, chain_depth)
  const zeroAmount = fee === 0n;
  const noReferrer = M === 0;

  let split: SplitResult | null = null;
  let alloc: PoolAllocation | null = null;
  let layers: CommissionLayer[] = [];
  if (!zeroAmount && !noReferrer) {
    // ★ P9⑤（R-9-54）：层间 → 层内**两级最大余数法**
    const poolLayers: PoolLayer[] = roster.layers
      .filter((l) => l.beneficiaries.length > 0)
      .map((l) => ({
        layer: l.layer, direction: l.direction, distance: l.distance,
        weight_bp: l.weight_bp, beneficiaries: l.beneficiaries,
      }));
    alloc = splitPoolTwoLevel(fee, poolLayers);
    const byLayer = new Map(alloc.layers.map((a) => [a.layer, a]));
    // 兼容视图：把「层间一级」结果填进旧 `SplitResult` 形状（层 = 存在层，按 L 升序）
    split = {
      pool: alloc.pool, M: alloc.M, weights_bp: alloc.layers.map((a) => a.weight_bp), W: alloc.W,
      q: alloc.layers.map((a) => a.q), r: alloc.layers.map((a) => a.r), D: alloc.D,
      x: alloc.layers.map((a) => a.x), sum_x: alloc.sum_x,
      plus_one_levels: alloc.plus_one_layers, order: alloc.order, sum_ok: true,
    };
    layers = alloc.entries.map((e) => {
      const la = byLayer.get(e.layer);
      return {
        level: e.layer, beneficiary_uid: e.uid,
        weight_bp: la ? la.weight_bp : '0', q: la ? la.q : '0', r: la ? la.r : '0', x: e.x,
        direction: e.direction, distance: e.distance, layer_share: la ? la.x : '0',
      };
    });
  }
  const N = layers.filter((l) => l.x !== '0').length;
  return {
    job_id: jobId.toString(),
    idempotency_key: jobSettleKey(jobId, input.submissionId),
    employer_uid: employer.toString(),
    worker_uid: worker.toString(),
    cid: cid.toString(),
    gross: gross.toString(),
    fee: fee.toString(),
    net: net.toString(),
    pool: fee.toString(),
    policy,
    chain_depth: up.chain_depth,
    // F7①：链被遍历上界截断 ⇒ 明确标记（恰好 cap = false；≥ cap = true）
    chain_truncated: up.truncated,
    down_depth: down.down_depth,
    down_truncated: down.truncated,
    roster_size: roster.uids.length,
    truncation: roster.truncation,
    // F7②：首写路径 = 计算值
    plan_source: 'computed',
    policy_reported: true,
    M, N,
    weights_bp: alloc ? alloc.layers.map((a) => a.weight_bp) : [],
    W: alloc ? alloc.W : (zeroAmount ? '0' : roster.W),
    split,
    layers,
    fee_credit_uid: noReferrer ? PLATFORM_REVENUE_UID : COMMISSION_POOL_UID,
    zero_amount: zeroAmount,
    no_referrer: noReferrer,
  };
};

export interface BuiltEvent {
  entries: LedgerEventEntryInput[];
  /** `derived_keys[idx]`：`idx = 0` ⇒ `K`；`idx >= 1` ⇒ `K#(idx+1)`（R51 / CR33） */
  derived_keys: string[];
  assertions: {
    entry_count: number;
    /** CR35：涉及账户数（`uid`×`cid` 去重）`<= 16`；条数 `<= 32` */
    account_count: number;
    sum_delta_frozen: string;
    commission_rows: number;
    sum_commission_credit: string;
    sum_x_equals_pool: boolean;
  };
}

/**
 * §5.3 **分录顺序铁律**（本册核心契约）：
 * | idx | 分录 | uid | kind | delta | frozen_delta |
 * | 0 | job_payout 减方 | 雇主 | job_payout | "0" | −net |
 * | 1 | job_payout 增方 | 打工人 | job_payout | +net | "0" |
 * | 2 | job_fee 减方 | 雇主 | job_fee | "0" | −fee |
 * | 3 | job_fee 增方 | `-2`（无邀请人 ⇒ `-1`） | job_fee | +fee | "0" |
 * | 4+2(L−1) | commission 减方 | `-2` | commission | −x_L | "0" |
 * | 5+2(L−1) | commission 增方 | a_L | commission | +x_L | "0" |
 * 零额（`fee = 0`）⇒ 只有 idx 0/1 两条（CR51）；`x_L = 0` 的层**不建分录**（CR48）。
 *
 * ⚠️ 逐条 `ref_type`/`ref_id` 成对（裁定 #4：`commission` 的 `ref_id` = **同一 `job_id`**；
 * 值等同 payload 级回落，TS 侧因 `normalizeRef` 要求成对而逐条显式给出）。
 */
export const buildSettleEvent = (
  plan: SettlementPlan, memoOverride?: string,
): BuiltEvent => {
  const K = plan.idempotency_key;
  const cid = plan.cid;
  const e: LedgerEventEntryInput[] = [];
  const push = (x: LedgerEventEntryInput) => { e.push(x); };

  const net = toAmount(plan.net, 'net');
  const fee = toAmount(plan.fee, 'fee');
  const memo = memoOverride ?? `招工验收结算 job=${plan.job_id}`;

  // idx 0/1：job_payout 对（雇主 frozen −net；打工人 balance +net）
  push({ uid: plan.employer_uid, cid, kind: 'job_payout', delta: '0', frozenDelta: (-net).toString(),
    refType: 'job', refId: plan.job_id, memo });
  push({ uid: plan.worker_uid, cid, kind: 'job_payout', delta: net.toString(), frozenDelta: '0',
    refType: 'job', refId: plan.job_id, memo: `${memo}（打工人到手）` });

  if (!plan.zero_amount) {
    // idx 2/3：job_fee 对（雇主 frozen −fee；增方 = `-2`，无邀请人 ⇒ `-1`，裁定 #11 / CR84）
    push({ uid: plan.employer_uid, cid, kind: 'job_fee', delta: '0', frozenDelta: (-fee).toString(),
      refType: 'job', refId: plan.job_id, memo: `${memo}（手续费）` });
    push({ uid: plan.fee_credit_uid, cid, kind: 'job_fee', delta: fee.toString(), frozenDelta: '0',
      refType: 'job', refId: plan.job_id, memo: `${memo}（手续费入 ${plan.fee_credit_uid === '-1' ? '平台收入' : '佣金池'}）` });
    // idx 4+：逐层 commission（减方在前、增方在后，L 升序；`x_L = 0` 跳过）
    for (const layer of plan.layers) {
      const x = toAmount(layer.x, 'x_L');
      if (x === 0n) continue; // CR48：零额层不建分录（写了会被 ledger_move_guard 以 400 BOTH_ZERO 拒）
      push({ uid: COMMISSION_POOL_UID, cid, kind: 'commission', delta: (-x).toString(), frozenDelta: '0',
        refType: 'commission_payout', refId: plan.job_id, memo: `佣金出池 L=${layer.level}` });
      push({ uid: layer.beneficiary_uid, cid, kind: 'commission', delta: x.toString(), frozenDelta: '0',
        refType: 'commission_payout', refId: plan.job_id, memo: `佣金第 ${layer.level} 层` });
    }
  }

  // 平台账户 kind 白名单（R101 / CR54 / CR85 ④）：与 DB 侧 `ledger_assert_platform_mutation` 同判
  for (const x of e) {
    const uid = toAmount(x.uid, 'uid');
    if ([0n, -1n, -2n, -3n].includes(uid)) {
      const dir = toAmount(x.delta ?? '0', 'delta') < 0n ? 'debit' : 'credit';
      assertPlatformAccountMutation(uid, x.kind, dir);
    }
  }

  let sumDF = 0n;
  let commRows = 0;
  let commCredit = 0n;
  const accounts = new Set<string>();
  for (const x of e) {
    sumDF += toAmount(x.delta, 'delta') + toAmount(x.frozenDelta ?? '0', 'frozenDelta');
    if (x.kind === 'commission') {
      commRows += 1;
      const d = toAmount(x.delta, 'delta');
      if (d > 0n) commCredit += d;
    }
    accounts.add(`${toAmount(x.uid, 'uid')}:${toAmount(x.cid, 'cid')}`);
  }
  const sumXeqPool = commCredit === (plan.no_referrer ? 0n : fee) && commCredit === (plan.no_referrer ? 0n : toAmount(plan.pool, 'pool'));
  return {
    entries: e,
    derived_keys: e.map((_, idx) => (idx === 0 ? K : deriveEventKey(K, idx + 1))),
    assertions: {
      entry_count: e.length,
      account_count: accounts.size,
      sum_delta_frozen: sumDF.toString(),
      commission_rows: commRows,
      sum_commission_credit: commCredit.toString(),
      sum_x_equals_pool: sumXeqPool,
    },
  };
};

// ============================================================================
// §6 一次原子调用（CR29：一个业务事件 = 一次 ledger_post_event；CR57/CR58 幂等）
// ============================================================================

export interface SettleJobOutcome {
  plan: SettlementPlan;
  event: BuiltEvent;
  payload: Record<string, unknown>;
  result: LedgerOpResult;
  /** 应用侧可机读读数（判据 M1–M6 的服务层面） */
  business: {
    replay: boolean;
    /** F7②：本次 `plan`/`event` 读数的来源（`computed` 首写 / `replayed_from_ledger` 重放） */
    plan_source: SettlementPlanSource;
    idempotency_key: string;
    job_id: string;
    http_status_class: string;
    expected_commission_rows: number;
    expected_entry_count: number;
  };
}

/**
 * 招工验收结算（P2 唯一入口）：组装 payload → **一条** `SELECT ledger_post_event($1::jsonb)`。
 * 幂等键 `biz:job:settle:<job_id>`（CR57）；同键并发 ⇒ DB 唯一索引串行化 ⇒ 恰一组分录（CR58）。
 * **禁止**拆成多次调用、**禁止**应用层包 `BEGIN…COMMIT`（CR29）。
 *
 * F1：`planJobSettlement` 内部已在落账前做链断言硬拒（坏链到这里之前就抛了）。
 * F7②：落账后若判定为**幂等重放**，返回值中的 `plan`/`event`/`payload`/读数**一律改由账上事件导出**
 * （`planJobSettlementFromLedger` / `buildSettleEventFromLedger` / `readLedgerEventRows`），
 * 不用当前政策与当前输入重算 —— 否则「政策改版后重放」会返回与账**不一致**的金额。
 */
export const settleJobCommission = async (input: SettleJobInput): Promise<SettleJobOutcome> => {
  const plan = await planJobSettlement(input);
  const event = buildSettleEvent(plan, input.memo);
  // CR43：落账前的显式 Σ 断言（DB 侧 0007 的只读后置断言是第二道防线）
  if (!event.assertions.sum_x_equals_pool || event.assertions.sum_delta_frozen !== '0') {
    throw new LedgerError('LEDGER_ACCOUNT_GUARD_VIOLATION', {
      reason: COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH,
      job_id: plan.job_id, pool: plan.pool,
      sum_commission_credit: event.assertions.sum_commission_credit,
      sum_delta_frozen: event.assertions.sum_delta_frozen,
    });
  }
  // DB 契约形状的 payload（供脚本「复用原 payload 重放」与取证用；与 postEvent 内部组装逐字同形）
  const payload: Record<string, unknown> = {
    op: 'entries',
    idempotency_key: plan.idempotency_key,
    request_fingerprint: input.requestFingerprint ?? settleJobFingerprint(input),
    ref_type: 'job',
    ref_id: plan.job_id,
    memo: input.memo ?? `招工验收结算 job=${plan.job_id}`,
    entries: event.entries.map((x) => toPayloadEntry(x)),
  };
  if (input.currencyOp) payload.currency_op = input.currencyOp;
  // TS 侧唯一写入口（字段名为 camelCase 的 TS 契约；它内部再组装同一份 DB payload）
  const result = await postEvent({
    op: 'entries',
    idempotencyKey: plan.idempotency_key,
    requestFingerprint: payload.request_fingerprint as string,
    memo: payload.memo as string,
    refType: 'job',
    refId: plan.job_id,
    entries: event.entries,
    currencyOp: input.currencyOp,
  });
  const replay = result.idempotent_replay === true;

  // ---- F7②：重放 ⇒ 一切金额类读数改由账上已落事件导出（不得用当前政策/当前输入重算）
  let outPlan = plan; let outEvent = event; let outPayload = payload;
  if (replay) {
    const rows = await readLedgerEventRows(plan.idempotency_key, input.ex);
    outPlan = await planJobSettlementFromLedger(input, plan.idempotency_key);
    outEvent = buildSettleEventFromLedger(outPlan, rows);
    outPayload = {
      op: 'entries',
      idempotency_key: outPlan.idempotency_key,
      // 指纹取**账上那一版**（首写时被接受的那个）⇒ 复用本 payload 再发仍是重放，不会退化成 409
      request_fingerprint: rows.find((r) => r.idempotency_key === outPlan.idempotency_key)?.request_fingerprint
        ?? (payload.request_fingerprint as string),
      ref_type: 'job',
      ref_id: outPlan.job_id,
      memo: rows.find((r) => r.idempotency_key === outPlan.idempotency_key)?.memo ?? (payload.memo as string),
      entries: outEvent.entries.map((x) => toPayloadEntry(x)),
    };
    if (input.currencyOp) outPayload.currency_op = input.currencyOp;
  }

  return {
    plan: outPlan, event: outEvent, payload: outPayload, result,
    business: {
      replay,
      plan_source: outPlan.plan_source,
      idempotency_key: outPlan.idempotency_key,
      job_id: outPlan.job_id,
      http_status_class: '200',
      expected_commission_rows: outEvent.assertions.commission_rows,
      expected_entry_count: outEvent.assertions.entry_count,
    },
  };
};

/** 分录入参 → DB 契约（字段名逐字对齐 0004；金额一律十进制字符串，R70） */
export const toPayloadEntry = (x: LedgerEventEntryInput): Record<string, unknown> => {
  const out: Record<string, unknown> = {
    uid: toAmount(x.uid, 'uid').toString(),
    cid: toAmount(x.cid, 'cid').toString(),
    kind: x.kind,
    delta: toAmount(x.delta, 'delta').toString(),
    frozen_delta: toAmount(x.frozenDelta ?? '0', 'frozen_delta').toString(),
    memo: x.memo ?? '',
  };
  if (x.refType) { out.ref_type = x.refType; out.ref_id = toAmount(x.refId as Amount, 'ref_id').toString(); }
  if (x.reversalOfTxid !== undefined && x.reversalOfTxid !== null) {
    out.reversal_of_txid = toAmount(x.reversalOfTxid, 'reversal_of_txid').toString();
  }
  return out;
};

// ============================================================================
// §7 事件读数（判据 M1–M8 的单一 SQL 口径；只读）
// ============================================================================

export interface EventFacts {
  idempotency_key: string;
  rows_total: string;
  root_rows: string;
  commission_rows: string;
  payout_rows: string;
  job_fee_rows: string;
  pool_in: string;
  commission_out: string;
  minus2_net: string;
  minus1_net: string;
  minus1_fee_in: string;
  employer_frozen_out: string;
  employer_delta: string;
  worker_got: string;
  ev_net_sum: string;
  credit_rows: string;
  distinct_beneficiaries: string;
  minus2_commission_payer_rows: string;
  commission_uid_delta: string;
  key_family_net_by_root: string;
  key_family_net_by_key_arithmetic: string;
  /** 派生键集合（升序）—— 顺序确定性取证（CR33） */
  derived_keys: string;
}

/** 取某事件根键的全部判据读数（**只读**；一条 SQL 出全部标量，避免多次往返） */
export const readEventFacts = async (
  rootKey: string, employerUid: Amount, workerUid: Amount, ex?: Queryable,
): Promise<EventFacts> => {
  const k = normalizeIdempotencyKey(rootKey);
  const emp = toAmount(employerUid, 'employer_uid').toString();
  const wrk = toAmount(workerUid, 'worker_uid').toString();
  const rows = await runQuery<Record<string, unknown>>(ex, `
    WITH ev AS (SELECT * FROM ledger_entry WHERE event_root_key = $1)
    SELECT
      (SELECT count(*)::text FROM ev)                                              AS rows_total,
      (SELECT count(*)::text FROM ev WHERE idempotency_key = $1)                   AS root_rows,
      (SELECT count(*)::text FROM ev WHERE kind = 'commission')                    AS commission_rows,
      (SELECT count(*)::text FROM ev WHERE kind = 'job_payout')                    AS payout_rows,
      (SELECT count(*)::text FROM ev WHERE kind = 'job_fee')                       AS job_fee_rows,
      (SELECT COALESCE(sum(delta),0)::text FROM ev WHERE uid = -2 AND kind = 'job_fee')      AS pool_in,
      (SELECT COALESCE(-sum(delta),0)::text FROM ev WHERE uid = -2 AND kind = 'commission')  AS commission_out,
      (SELECT COALESCE(sum(delta),0)::text FROM ev WHERE uid = -2)                 AS minus2_net,
      (SELECT COALESCE(sum(delta),0)::text FROM ev WHERE uid = -1)                 AS minus1_net,
      (SELECT COALESCE(sum(delta),0)::text FROM ev WHERE uid = -1 AND kind = 'job_fee')      AS minus1_fee_in,
      (SELECT COALESCE(-sum(frozen_delta),0)::text FROM ev WHERE uid = $2)         AS employer_frozen_out,
      (SELECT COALESCE(sum(delta),0)::text FROM ev WHERE uid = $2)                 AS employer_delta,
      (SELECT COALESCE(sum(delta),0)::text FROM ev WHERE uid = $3 AND kind = 'job_payout')   AS worker_got,
      (SELECT COALESCE(sum(delta + frozen_delta),0)::text FROM ev)                 AS ev_net_sum,
      (SELECT count(*)::text FROM ev WHERE uid > 0 AND kind = 'commission')        AS credit_rows,
      (SELECT count(DISTINCT uid)::text FROM ev WHERE uid > 0 AND kind = 'commission') AS distinct_beneficiaries,
      (SELECT count(DISTINCT uid)::text FROM ev WHERE uid = -2 AND kind = 'commission') AS minus2_commission_payer_rows,
      (SELECT COALESCE(string_agg(uid::text || ':' || delta::text, ',' ORDER BY txid), '') FROM ev
        WHERE kind = 'commission')                                                 AS commission_uid_delta,
      (SELECT COALESCE(sum(delta + frozen_delta),0)::text FROM ledger_entry
        WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1)    AS key_family_net_by_root,
      (SELECT COALESCE(sum(delta + frozen_delta),0)::text FROM ledger_entry
        WHERE split_part(idempotency_key,'#',1) = $1)                              AS key_family_net_by_key_arithmetic,
      (SELECT COALESCE(string_agg(idempotency_key, ',' ORDER BY txid), '') FROM ev) AS derived_keys`,
  [k, emp, wrk]);
  const r = rows[0] ?? {};
  const s = (v: unknown): string => String(v ?? '');
  return {
    idempotency_key: k,
    rows_total: s(r.rows_total), root_rows: s(r.root_rows), commission_rows: s(r.commission_rows),
    payout_rows: s(r.payout_rows), job_fee_rows: s(r.job_fee_rows),
    pool_in: s(r.pool_in), commission_out: s(r.commission_out), minus2_net: s(r.minus2_net),
    minus1_net: s(r.minus1_net), minus1_fee_in: s(r.minus1_fee_in),
    employer_frozen_out: s(r.employer_frozen_out), employer_delta: s(r.employer_delta),
    worker_got: s(r.worker_got), ev_net_sum: s(r.ev_net_sum),
    credit_rows: s(r.credit_rows), distinct_beneficiaries: s(r.distinct_beneficiaries),
    minus2_commission_payer_rows: s(r.minus2_commission_payer_rows),
    commission_uid_delta: s(r.commission_uid_delta),
    key_family_net_by_root: s(r.key_family_net_by_root),
    key_family_net_by_key_arithmetic: s(r.key_family_net_by_key_arithmetic),
    derived_keys: s(r.derived_keys),
  };
};

// ============================================================================
// §7.5 F7②：由**账上已落事件**导出计划 / 事件 / 读数（幂等重放路径的唯一读数来源）
// ============================================================================
// 修前事实（质检 F7②）：`settleJobCommission` 返回的 `plan` 是**函数开头本地算出来的那个**（用
// **当前政策 + 当前输入**），而 `business.replay` 却说明「账上早已有一版」⇒ 政策改版后重放会返回
// 「另一个版本的金额」（实测：返回 fee=10000/x={5000,5000}，账上仍是 fee=50000/x={16666,16667,16667}）。
// 调用方若按返回的 plan 去做对账/展示/回执，就与账**不一致**。
// ⇒ 重放时返回值里的**一切金额类读数**一律由账上事件导出（下面两个函数），**不得**重算。
// ============================================================================

export interface LedgerEventRow {
  txid: string; uid: string; cid: string; kind: string; delta: string; frozen_delta: string;
  ref_type: string | null; ref_id: string | null; memo: string; idempotency_key: string;
  request_fingerprint: string | null; balance_after: string; frozen_after: string;
}

/** 取某事件根键的全部分录行（**只读**；按 `txid` 升序 = 落账顺序） */
export const readLedgerEventRows = async (rootKey: string, ex?: Queryable): Promise<LedgerEventRow[]> => {
  const k = normalizeIdempotencyKey(rootKey);
  const rows = await runQuery<Record<string, unknown>>(ex, `
    SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, kind,
           delta::text AS delta, frozen_delta::text AS frozen_delta,
           ref_type, ref_id::text AS ref_id, memo, idempotency_key, request_fingerprint,
           balance_after::text AS balance_after, frozen_after::text AS frozen_after
      FROM ledger_entry
     WHERE COALESCE(event_root_key, split_part(idempotency_key, '#', 1)) = $1
     ORDER BY txid`, [k]);
  const s = (v: unknown): string => String(v ?? '');
  return rows.map((r) => ({
    txid: s(r.txid), uid: s(r.uid), cid: s(r.cid), kind: s(r.kind),
    delta: s(r.delta), frozen_delta: s(r.frozen_delta),
    ref_type: (r.ref_type as string | null) ?? null, ref_id: (r.ref_id as string | null) ?? null,
    memo: s(r.memo), idempotency_key: s(r.idempotency_key),
    request_fingerprint: (r.request_fingerprint as string | null) ?? null,
    balance_after: s(r.balance_after), frozen_after: s(r.frozen_after),
  }));
};

export interface LedgerDerivedLayer {
  level: number;
  beneficiary_uid: string;
  x: string;
  /** 层号的来源：`memo` = 从账上 `memo`（`佣金第 L 层`）解析；`ordinal` = 按落账顺序推定 */
  level_source: 'memo' | 'ordinal';
  memo: string;
}

export interface LedgerSettlementFacts {
  idempotency_key: string;
  rows_total: string;
  fee: string;
  net: string;
  gross: string;
  pool_in: string;
  minus1_fee_in: string;
  employer_frozen_out: string;
  commission_rows: string;
  commission_credit_rows: number;
  commission_credit_sum: string;
  layers: LedgerDerivedLayer[];
  no_referrer: boolean;
  zero_amount: boolean;
  fee_credit_uid: string;
  cid: string;
  ref_id: string;
  request_fingerprint: string | null;
}

/**
 * 由账上事件导出「手续费 / 到手 / 受益层」读数（**只读**；金额一律来自 `readEventFacts` 的标量 +
 * 逐行 `commission` 增方，绝不回算政策）。
 * 金额口径：`fee = pool_in + minus1_fee_in`（有邀请人 ⇒ 手续费入 `-2`；无邀请人 ⇒ 入 `-1`）；
 * `net = worker_got`（打工人 `job_payout` 增方）；`gross = net + fee`（并交叉核对
 * `employer_frozen_out == gross`，不等即内部不变式坏了 ⇒ 500 defect）。
 */
export const readLedgerSettlement = async (
  rootKey: string, employerUid: Amount, workerUid: Amount, ex?: Queryable,
): Promise<LedgerSettlementFacts> => {
  const k = normalizeIdempotencyKey(rootKey);
  const facts = await readEventFacts(k, employerUid, workerUid, ex);
  const rows = await readLedgerEventRows(k, ex);
  const poolIn = BigInt(facts.pool_in);
  const minus1In = BigInt(facts.minus1_fee_in);
  const fee = poolIn + minus1In;
  const net = BigInt(facts.worker_got);
  const gross = net + fee;
  const employerFrozenOut = BigInt(facts.employer_frozen_out);
  if (employerFrozenOut !== gross) {
    throw new LedgerError('LEDGER_RECONCILE_MISMATCH', {
      reason: COMMISSION_REASON.LEDGER_REPLAY_INCONSISTENT,
      idempotency_key: k,
      net: net.toString(), fee: fee.toString(), gross: gross.toString(),
      employer_frozen_out: employerFrozenOut.toString(),
      note: 'ledger event is self-inconsistent: worker_got + (pool_in + minus1_fee_in) != employer_frozen_out',
    });
  }
  const credits = rows.filter((r) => r.kind === 'commission' && BigInt(r.uid) > 0n);
  const layers: LedgerDerivedLayer[] = credits.map((r, i) => {
    const m = /第\s*(\d+)\s*层/.exec(r.memo);
    return {
      level: m ? Number(m[1]) : i + 1,
      beneficiary_uid: r.uid,
      x: r.delta,
      level_source: m ? 'memo' : 'ordinal',
      memo: r.memo,
    };
  });
  const creditSum = credits.reduce((a, r) => a + BigInt(r.delta), 0n);
  const noReferrer = fee > 0n && poolIn === 0n && credits.length === 0;
  return {
    idempotency_key: k,
    rows_total: facts.rows_total,
    fee: fee.toString(), net: net.toString(), gross: gross.toString(),
    pool_in: facts.pool_in, minus1_fee_in: facts.minus1_fee_in,
    employer_frozen_out: facts.employer_frozen_out,
    commission_rows: facts.commission_rows,
    commission_credit_rows: credits.length,
    commission_credit_sum: creditSum.toString(),
    layers,
    no_referrer: noReferrer,
    zero_amount: fee === 0n,
    fee_credit_uid: noReferrer ? PLATFORM_REVENUE_UID : COMMISSION_POOL_UID,
    cid: rows[0]?.cid ?? '',
    ref_id: rows[0]?.ref_id ?? '',
    request_fingerprint: rows.find((r) => r.idempotency_key === k)?.request_fingerprint
      ?? rows[0]?.request_fingerprint ?? null,
  };
};

/**
 * F7②：由账上事件导出 `SettlementPlan`（**重放路径专用**）。
 * 金额与层级全部来自账（`readLedgerSettlement`）；账上无从得知的字段显式标不可得：
 *   · `policy` = 占位符 + `policy_reported = false`（政策不落账）；
 *   · `weights_bp = []` / `W = '0'` / `split = null`（权重与最大余数中间量不落账，**不重算**）；
 *   · `M = N = chain_depth` = 账上实际发生 `commission` 增方的层数（参与但零额的层在账上不可见）。
 * 身份字段（job/employer/worker）取入参（它们本就是幂等键与归属的定义域，不是「金额读数」）。
 */
export const planJobSettlementFromLedger = async (
  input: SettleJobInput, rootKey?: string,
): Promise<SettlementPlan> => {
  const jobId = toAmount(input.jobId, 'job_id');
  const employer = assertUserUid(input.employerUid, 'employer_uid');
  const worker = assertUserUid(input.workerUid, 'worker_uid');
  const k = rootKey ?? jobSettleKey(jobId);
  const f = await readLedgerSettlement(k, employer, worker, input.ex);
  const layers: CommissionLayer[] = f.layers.map((l) => ({
    level: l.level, beneficiary_uid: l.beneficiary_uid,
    weight_bp: '0', q: '0', r: '0', x: l.x,
  }));
  return {
    job_id: jobId.toString(),
    idempotency_key: f.idempotency_key,
    employer_uid: employer.toString(),
    worker_uid: worker.toString(),
    cid: f.cid || toAmount(input.cid, 'cid').toString(),
    gross: f.gross,
    fee: f.fee,
    net: f.net,
    pool: f.fee,
    policy: LEDGER_REPLAY_POLICY,
    chain_depth: layers.length,
    chain_truncated: false,
    // ★ P9⑤：重放路径不落账政策 / 名单 / 截断 ⇒ 显式占位（金额一律看账，`readLedgerSettlement`）
    down_depth: 0,
    down_truncated: false,
    roster_size: layers.length,
    truncation: { cap_layer: COMMISSION_CAP_LAYER_DEFAULT, cap_total: COMMISSION_CAP_TOTAL_DEFAULT,
      dropped_total: 0, dropped_by_layer: {}, truncated: false },
    plan_source: 'replayed_from_ledger',
    policy_reported: false,
    M: layers.length,
    N: layers.length,
    weights_bp: [],
    W: '0',
    split: null,
    layers,
    fee_credit_uid: f.fee_credit_uid,
    zero_amount: f.zero_amount,
    no_referrer: f.no_referrer,
  };
};

/**
 * F7②：由账上事件导出 `BuiltEvent`（重放路径专用）—— `entries` / `derived_keys` / `assertions`
 * **逐项**来自账上那 24 行，而不是「按当前政策重算一遍」。这样重放返回的读数与账**逐字节同源**。
 */
export const buildSettleEventFromLedger = (
  plan: SettlementPlan, rows: LedgerEventRow[],
): BuiltEvent => {
  const entries: LedgerEventEntryInput[] = rows.map((r) => ({
    uid: r.uid, cid: r.cid, kind: r.kind as LedgerEventEntryInput['kind'],
    delta: r.delta, frozenDelta: r.frozen_delta,
    refType: (r.ref_type as LedgerEventEntryInput['refType']) ?? null,
    refId: r.ref_id, memo: r.memo,
  }));
  let sumDF = 0n;
  let commRows = 0;
  let commCredit = 0n;
  const accounts = new Set<string>();
  for (const r of rows) {
    sumDF += BigInt(r.delta) + BigInt(r.frozen_delta);
    if (r.kind === 'commission') {
      commRows += 1;
      const d = BigInt(r.delta);
      if (d > 0n) commCredit += d;
    }
    accounts.add(`${r.uid}:${r.cid}`);
  }
  const pool = plan.no_referrer ? 0n : toAmount(plan.pool, 'pool');
  return {
    entries,
    derived_keys: rows.map((r) => r.idempotency_key),
    assertions: {
      entry_count: rows.length,
      account_count: accounts.size,
      sum_delta_frozen: sumDF.toString(),
      commission_rows: commRows,
      sum_commission_credit: commCredit.toString(),
      sum_x_equals_pool: commCredit === pool,
    },
  };
};

/** M9（图的不变式）：`cycles`（无环）与 `bad_depth`（I5 一致性）读数；**只读** */
export const readGraphInvariants = async (ex?: Queryable): Promise<{
  cycles: string; bad_depth: string; referral_rows: string;
}> => {
  const cycles = await runQuery<Record<string, unknown>>(ex, `
    WITH RECURSIVE up AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL
      SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
    SELECT count(*)::text AS cycles FROM up WHERE cur = start`);
  const bad = await runQuery<Record<string, unknown>>(ex, `
    WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL
      SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT count(*)::text AS bad_depth FROM referral x
      JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid
     WHERE x.depth <> t.mx`);
  const rows = await runQuery<Record<string, unknown>>(ex, `SELECT count(*)::text AS n FROM referral`);
  return {
    cycles: String(cycles[0]?.cycles ?? ''),
    bad_depth: String(bad[0]?.bad_depth ?? ''),
    referral_rows: String(rows[0]?.n ?? ''),
  };
};

export { LedgerError };
