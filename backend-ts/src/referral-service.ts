/**
 * 我的邀请（referral 自助绑定）· 应用层服务
 * ============================================================================
 * 权威口径
 *   · `backend-ts/migrations/0007_referral_and_commission_policy.sql` §A（表 DDL：`child_uid` PK /
 *     `parent_uid` / `depth` / `bound_at`；`referral_no_self` CHECK；`trg_referral_append_only`）
 *     + §C（`referral_bind(child, parent)` = 应用层唯一绑定入口 + 便利层幂等语义）
 *   · `0010_referral_bind_protocol_guard.sql` —— ⑤「child 已有下级 ⇒ 拒」（`REFERRAL_BIND_WOULD_STALE_DEPTH`）
 *   · `0011_commission_assert_closure_and_referral_depth_guard.sql` §B —— ③「child 已绑 ⇒ 拒」
 *     （`LD003` / `LEDGER_IDEMPOTENCY_CONFLICT` + `REFERRAL_ALREADY_BOUND`）、④ 祖先检查（防环）、
 *     ⑥ 父 `depth` 真实性、⑦ `depth` 计算
 *   · `docs/commission.spec.md` §3.2 / §3.3；CR16「`depth` 不得作为 API 入参」
 *
 * 本模块做什么（**只有两件事**）
 *   ① `getMyReferral(uid)` —— 读「我绑了谁」（单行读，走只读池；`bound=false` ⇒ 四个空值）
 *   ② `bindMyReferral({childUid, parentUid})` —— 把绑定**整段交给 DB 函数 `referral_bind`**
 *
 * ★★ `depth` 算在哪一层 = **DB 触发器**（不是本模块、也不是路由层）
 *   `trg_referral_cycle_guard` 是 `BEFORE INSERT … FOR EACH ROW`：
 *     `NEW.depth := 1 + COALESCE(v_parent_stored_depth, 0)`（`0011` ⑦ 现取）。
 *   ⇒ 应用层**不得传 depth**：`0007` §C 的 `referral_bind` 内部插入时写占位 `0`，
 *     由触发器覆写（占位 0 若守卫被摘掉 ⇒ `referral_depth_rng CHECK(depth >= 1)` 立刻炸 =
 *     响亮的失败，而不是静默写坏的 depth）。本模块**不自算、不覆写、不回填** depth，
 *     只把函数返回的 `depth`（DB 算出的真值）原样读回用于回执。
 *
 * ★★ 防环 / 防重绑 / 已有下级 —— **一律用库内既有守卫，不自造第二套**
 *   本模块**没有**任何「祖先链游走」「环判定」「叶判定」的代码。理由：
 *   ① 这些判据在 `0010` / `0011` 里已经实现，且**检查顺序有判负用例钉着**
 *      （自指 → 串行化 → 已绑 → 环 → 已有下级 → 父 depth 真实性 → depth）；
 *      在应用层再写一份 ⇒ 两份判据漂移时，**先跑的那份赢**，另一份变成谎言。
 *   ② 触发器是**任何 INSERT 路径都绕不过**的闸；应用层复制品只覆盖本路由一条路径。
 *   ⇒ 本模块只在**事务内**读一次「我是否已绑」（为了给出 409 的准确 reason 与
 *     `bound_parent_uid`），随后 `SELECT public.referral_bind(...)` 让库做全部结构判定。
 *
 * ★★ 已绑定 = 一次性（不可改绑）
 *   `referral.child_uid` 是主键 ⇒ 一人一行、终身不变；`0011` 的 ③ 与 `referral_bind` 的
 *   409 分支对「同一 child 再绑」**同码同 reason**（`LD003` + `REFERRAL_ALREADY_BOUND`）。
 *   本模块的事务内预读把同一事实提前到 HTTP 层露出（更早、更准确的回执），
 *   **不改变** DB 侧的判定（并发下由 ② 的 `users` 两行 `FOR UPDATE` 串行化兜底）。
 *
 * 幂等键（`create_key`）
 *   本面**不落任何账本分录**（referral 表无 `idempotency_key` 列），一次性由 `child_uid` PK +
 *   0011 ③ 结构性保证 ⇒ 天然幂等，**不派生也不消费** `biz:referral:bind:<child_uid>`。
 *   路由层若收到 `create_key` 只做 §4.5 形态校验（前缀 / 分隔符 / 控制字符 / 长度）后**忽略**，
 *   以免把「重放同键」误当成「同父重放」而放宽 409。
 *
 * 错误面（关闭集 33 码不动）
 *   一律 `new LedgerError(<既有码>, { reason })`：
 *     · 已绑 ⇒ `LEDGER_IDEMPOTENCY_CONFLICT`（`LD003` ⇒ 409）+ `REFERRAL_ALREADY_BOUND`（与 DB 逐字同）
 *     · 自指 ⇒ `LEDGER_AMOUNT_INVALID`（`LD016` ⇒ 400）+ `REFERRAL_SELF_BIND`（与 DB 逐字同）
 *     · 父不存在 ⇒ `LEDGER_REF_NOT_FOUND`（`LD022` ⇒ 404）+ `REFERRAL_PARENT_NOT_FOUND`
 *     · 库守卫拒绝（环 / 已有下级 / 父 depth 陈旧）⇒ `LEDGER_AMOUNT_INVALID`（400）+
 *       `REFERRAL_BIND_REJECTED_BY_GUARD`（若驱动带来了 PG `DETAIL`，则透出里面的 `REFERRAL_*`）
 * ============================================================================
 */
import { LedgerError } from './ledger-errors';
import { readQuery, txQuery, withTransaction } from './db';

/** 绑定态读回（`GET /api/referral/me` 的 `data`） */
export interface MyReferral {
  bound: boolean;
  parent_uid: number | null;
  bound_at: string | null;
  depth: number | null;
}

/** 机读 reason（**不是**错误码闭集成员；码一律借既有 33 码） */
export const REFERRAL_REASON = {
  ALREADY_BOUND: 'REFERRAL_ALREADY_BOUND',
  SELF_BIND: 'REFERRAL_SELF_BIND',
  PARENT_NOT_FOUND: 'REFERRAL_PARENT_NOT_FOUND',
  GUARD_REJECTED: 'REFERRAL_BIND_REJECTED_BY_GUARD',
} as const;

/**
 * 从 PG 异常的 `DETAIL`（= `ledger_raise` 的 details JSON）里取 `REFERRAL_*` reason。
 * 为什么需要：`normalizeLedgerError` 刻意**不读** `DETAIL`（route 册 §3.5 D1''：驱动常不搬运它），
 * 所以这里**只做诊断性透出**：拿得到就用（更准确），拿不到就回落到 `GUARD_REJECTED`。
 * 安全边界：只放行 `REFERRAL_` 前缀的值 ⇒ 不把任意 DB 文本带进对外 `details`。
 */
const guardReasonOf = (error: unknown): string => {
  const detail = String((error as { detail?: unknown })?.detail ?? '');
  if (!detail) return REFERRAL_REASON.GUARD_REJECTED;
  try {
    const reason = JSON.parse(detail)?.reason;
    return typeof reason === 'string' && reason.startsWith('REFERRAL_') ? reason : REFERRAL_REASON.GUARD_REJECTED;
  } catch {
    return REFERRAL_REASON.GUARD_REJECTED;
  }
};

/** `GET /api/referral/me` —— 读「我绑了谁」。未绑 ⇒ `{ bound:false, 三个 null }`。 */
export const getMyReferral = async (uid: number): Promise<MyReferral> => {
  const rows = await readQuery<{ parent_uid: string | null; depth: number | null; bound_at: unknown }>(
    `SELECT parent_uid::text AS parent_uid, depth::int AS depth, bound_at
       FROM public.referral
      WHERE child_uid = $1::bigint`,
    [String(uid)],
  );
  const row = rows[0];
  if (!row) return { bound: false, parent_uid: null, bound_at: null, depth: null };
  const parent = Number(row.parent_uid);
  return {
    bound: true,
    parent_uid: Number.isFinite(parent) ? parent : null,
    bound_at: row.bound_at instanceof Date ? row.bound_at.toISOString() : (row.bound_at ? String(row.bound_at) : null),
    depth: row.depth === null || row.depth === undefined ? null : Number(row.depth),
  };
};

/**
 * `POST /api/referral/bind` —— 一次性绑定邀请人。
 * 事务内：① 预读「已绑」（给出准确的 409）→ ② 父存在性（404）→ ③ 交给 `referral_bind`（真正的闸）。
 * `深度` 由触发器算（见文件头）；本函数只把返回值读回。
 */
export const bindMyReferral = async (input: { childUid: number; parentUid: number }): Promise<{
  parent_uid: number;
  depth: number;
  bound_at: string | null;
  idempotent_replay: boolean;
}> => {
  const { childUid, parentUid } = input;

  if (childUid === parentUid) {
    throw new LedgerError('LEDGER_AMOUNT_INVALID', {
      field: 'inviter_uid',
      reason: REFERRAL_REASON.SELF_BIND,
      child_uid: String(childUid),
      parent_uid: String(parentUid),
    });
  }

  return withTransaction(async (tx) => {
    // ① 已绑（事务内预读；`SELECT … ` 不加锁 —— 真正的串行化点在触发器的 users 两行 FOR UPDATE）
    const existing = await txQuery<{ parent_uid: string }>(
      tx,
      `SELECT parent_uid::text AS parent_uid FROM public.referral WHERE child_uid = $1::bigint`,
      [String(childUid)],
    );
    if (existing.length > 0) {
      throw new LedgerError('LEDGER_IDEMPOTENCY_CONFLICT', {
        reason: REFERRAL_REASON.ALREADY_BOUND,
        child_uid: String(childUid),
        bound_parent_uid: String(existing[0].parent_uid),
        requested_parent_uid: String(parentUid),
      });
    }

    // ② 邀请人存在（`users.uid`；平台保留 uid 0 / 负数已被路由层的「正整数」闸挡在外面）
    const parent = await txQuery<{ uid: string }>(
      tx,
      `SELECT uid::text AS uid FROM public.users WHERE uid = $1::bigint`,
      [String(parentUid)],
    );
    if (parent.length === 0) {
      throw new LedgerError('LEDGER_REF_NOT_FOUND', {
        ref_type: 'user',
        ref_id: String(parentUid),
        field: 'inviter_uid',
        reason: REFERRAL_REASON.PARENT_NOT_FOUND,
      });
    }

    // ③ 绑定（**唯一**的结构判定入口：防环 / 已绑 / 已有下级 / 父 depth 真实性 / depth 计算）
    let result: { ok?: boolean; depth?: string; bound_at?: unknown; idempotent_replay?: boolean };
    try {
      const rows = await txQuery<{ r: unknown }>(
        tx,
        `SELECT public.referral_bind($1::bigint, $2::bigint)::jsonb AS r`,
        [String(childUid), String(parentUid)],
      );
      const raw = rows[0]?.r;
      result = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof result);
    } catch (error) {
      // 库守卫拒绝：保留既有码（LD016 / LD003 由既有分类器映射），只补机读 reason
      const code = String((error as { code?: unknown })?.code ?? '');
      if (code === 'LD016') {
        throw new LedgerError('LEDGER_AMOUNT_INVALID', {
          field: 'inviter_uid',
          reason: guardReasonOf(error),
          child_uid: String(childUid),
          parent_uid: String(parentUid),
        });
      }
      if (code === 'LD003') {
        throw new LedgerError('LEDGER_IDEMPOTENCY_CONFLICT', {
          reason: REFERRAL_REASON.ALREADY_BOUND,
          child_uid: String(childUid),
          requested_parent_uid: String(parentUid),
        });
      }
      throw error;
    }

    const boundAt = result?.bound_at;
    return {
      parent_uid: parentUid,
      depth: Number(result?.depth ?? 0),
      bound_at: boundAt instanceof Date ? boundAt.toISOString() : (boundAt ? String(boundAt) : null),
      idempotent_replay: result?.idempotent_replay === true,
    };
  });
};
