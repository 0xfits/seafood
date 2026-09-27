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
  /** §13.2 #2：`fee_rate_bp` 不在 `[100,500]`（政策写入时 ⇒ 400） */
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
  /** 绑定类（§13.2 #6/#7/#8）—— 本模块**只读**邀请图，不写；常量登记在此只为「同族同处」可检索 */
  REFERRAL_SELF_BIND: 'REFERRAL_SELF_BIND',
  REFERRAL_ALREADY_BOUND: 'REFERRAL_ALREADY_BOUND',
  REFERRAL_CYCLE_REJECTED: 'REFERRAL_CYCLE_REJECTED',
} as const;

export type CommissionReason = (typeof COMMISSION_REASON)[keyof typeof COMMISSION_REASON];

/** 平台保留 uid（§9）：`-2` = 佣金中转池、`-1` = 平台收入 */
export const COMMISSION_POOL_UID = '-2';
export const PLATFORM_REVENUE_UID = '-1';

/** 事件根键模板（CR57：`biz:job:settle:<job_id>`；**只**由 job_id 派生，禁入金额/政策/时间戳） */
export const JOB_SETTLE_KEY_PREFIX = 'biz:job:settle:';
export const jobSettleKey = (jobId: Amount): string =>
  normalizeIdempotencyKey(`${JOB_SETTLE_KEY_PREFIX}${toAmount(jobId, 'job_id').toString()}`);

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
  if (!Number.isInteger(p.fee_rate_bp) || p.fee_rate_bp < 100 || p.fee_rate_bp > 500) {
    bad(COMMISSION_REASON.FEE_RATE_OUT_OF_RANGE, { fee_rate_bp: p.fee_rate_bp, min: 100, max: 500 });
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
  assertions: { contiguous_levels: boolean; within_cap: boolean; all_user_uids: boolean; no_duplicate_uid: boolean };
}

/**
 * 沿 `referral` 从 `uid` 上行取祖先，最多 `maxLevels` 层（`level < cap` 的**硬闸在 CTE 内**：
 * 缺它则深链拖长事务 / 有环时无限递归 —— 它是**遍历上界**，与防环无关；防环在写入侧由
 * `0007` 的三件（自指禁令 + 祖先检查 + 绑定串行化）保证，CR78/CR79）。
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
  return {
    nodes,
    chain_depth: nodes.length,
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
export const splitPool = (pool: Amount, weights: ReadonlyArray<Amount>): SplitResult => {
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
// §5 结算计划（§7 重归一化 + §8 边界）与载荷构建（§5 分录顺序铁律）
// ============================================================================

export interface CommissionLayer {
  level: number;
  beneficiary_uid: string;
  weight_bp: string;
  q: string;
  r: string;
  /** 实付；`"0"` ⇒ **不建分录**（CR48） */
  x: string;
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
  /** `M = min(levels, chain_depth)`（CR46）：本次**参与分配**的层数 */
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

export interface SettleJobInput {
  jobId: Amount;
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
    employer_uid: toAmount(i.employerUid, 'employer_uid').toString(),
    worker_uid: toAmount(i.workerUid, 'worker_uid').toString(),
    cid: toAmount(i.cid, 'cid').toString(),
    gross: toAmount(i.gross, 'gross').toString(),
  })).digest('hex');

/**
 * 组装结算计划（**只读**：读政策 + 读邀请图 + 算金额；不落账、不加锁）。
 * `M = min(levels, chain_depth)`（CR46）⇒ `W = Σ_{L=1..M} w_L`（CR47：重归一化的唯一分母）。
 */
export const planJobSettlement = async (input: SettleJobInput): Promise<SettlementPlan> => {
  const jobId = toAmount(input.jobId, 'job_id');
  const employer = assertUserUid(input.employerUid, 'employer_uid');
  const worker = assertUserUid(input.workerUid, 'worker_uid');
  const cid = toAmount(input.cid, 'cid');
  const gross = toAmount(input.gross, 'gross');
  if (gross <= 0n) throw new LedgerError('LEDGER_AMOUNT_INVALID', { field: 'gross', reason: 'NOT_POSITIVE' });

  const policy = await getCommissionPolicy(input.at ?? null, input.ex);
  const chain = await getReferralChain(worker, policy.levels, input.ex);

  const fee = computeFee(gross, policy.fee_rate_bp);
  const net = computeNet(gross, fee);
  const M = Math.min(policy.levels, chain.chain_depth);
  const zeroAmount = fee === 0n;
  const noReferrer = M === 0;

  let split: SplitResult | null = null;
  let layers: CommissionLayer[] = [];
  if (!zeroAmount && !noReferrer) {
    const weights = policy.weights_bp.slice(0, M).map((w) => BigInt(w));
    split = splitPool(fee, weights);
    layers = chain.nodes.slice(0, M).map((n, i) => ({
      level: n.level,
      beneficiary_uid: n.beneficiary_uid,
      weight_bp: String(weights[i]),
      q: split!.q[i],
      r: split!.r[i],
      x: split!.x[i],
    }));
  }
  const N = layers.filter((l) => l.x !== '0').length;
  return {
    job_id: jobId.toString(),
    idempotency_key: jobSettleKey(jobId),
    employer_uid: employer.toString(),
    worker_uid: worker.toString(),
    cid: cid.toString(),
    gross: gross.toString(),
    fee: fee.toString(),
    net: net.toString(),
    pool: fee.toString(),
    policy,
    chain_depth: chain.chain_depth,
    M, N,
    weights_bp: policy.weights_bp.slice(0, M).map(String),
    W: split ? split.W : (zeroAmount ? '0' : String(policy.weights_bp.slice(0, M).reduce((a, b) => a + b, 0))),
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
  return {
    plan, event, payload, result,
    business: {
      replay: result.idempotent_replay === true,
      idempotency_key: plan.idempotency_key,
      job_id: plan.job_id,
      http_status_class: '200',
      expected_commission_rows: event.assertions.commission_rows,
      expected_entry_count: event.assertions.entry_count,
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
