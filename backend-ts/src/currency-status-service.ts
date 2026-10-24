// ============================================================================
// src/currency-status-service.ts — 交易所管理第④面 · **币种上架 / 下架（状态变更动作口）**
// ============================================================================
// 依据（唯一权威 · 已冻结）：
//   · `docs/route-layer.spec.md` **v2.52 §49.25**（§49.25.1–§49.25.10 = 契约全文）
//   · `docs/ledger.spec.md` **v0.18 §19.20**（动作口 ↔ R26/R27/R28/R30 映射 + 撤单解冻唯一路径）
//   · `docs/data-layer.spec.md` §8.3 / `DL157②`（端点与键形 `ops:<admin_uid>:currency_status:<cid>:<to_status>`
//     早已在册；「改状态」与「写日志」必须同一事务）
// ----------------------------------------------------------------------------
// 端点：`POST /api/admin/currency/:cid/status`（闸 `manage_settings`）·
//       读口 `GET /api/admin/currency/status`（闸 `manage_settings`；**不改**既有
//       `GET /api/admin/currency` 的 `review_tasks` 闸）
// 硬边界（本文件自证）：
//   · **零新增错误码**（§14.1 仍 33 码）：非法迁移 / `$` 被动 / 终态复活 / 活跃挂单残留 ⇒ 既有
//     `LD011 LEDGER_CURRENCY_INVALID_TRANSITION`（409）；不存在 ⇒ `LD007`（404）；入参形状 ⇒ `LD016`
//     `LEDGER_AMOUNT_INVALID`（400，靠 `details.field` / `details.reason` 区分）；缺幂等键 ⇒ `LD036`（400，路由层）。
//   · **零新增权限码**（12 键闭集不动）：闸 = `manage_settings`（§49.25.3）。
//   · **零账务分录**（§49.25.6）：本文件**不写** `ledger_entry` / `account` / `currency.total_supply`；
//     唯一的资金面副作用 = Phase A 的**撤单解冻**（`hold_release` × 2 同账户 `balance ↔ frozen`，
//     走既有 `market_post_event(op='cancel')`，**不计入**收支腿）。`deposit_action` 恒 `'none'`。
//   · **两阶段**（§49.25.5，顺序不可颠倒）：Phase A（撤单，逐单独立事务）→ Phase B（状态 + 日志，
//     单语句 / 单事务）。Phase A 任一单失败 ⇒ **不进入 Phase B**、原样上抛该单既有码。
//   · **状态机唯一天源** = `ledger.ts` 的 `CURRENCY_TRANSITIONS` / `assertCurrencyTransition`（R27）
//     + `assertSystemCurrencyImmutable` 的同口径目标侧断言（R26：`$` 恒 `listed`）+ R30（`delisted` 终态）。
//   · **R27 是上限、本口是子集**：`draft → listed` 带资金腿（`currency_create_fee` + `listing_fee` +
//     `listing_deposit`）⇒ **本口不承担**，一律 `409` + `details.reason = 'LISTING_REQUIRES_FEE_PATH'`
//     （§49.25.4 表；上市只能走 `POST /api/currency/:cid/list` + 审核通过支）。
// ============================================================================
import { DatabaseService } from './database';
import { assertCurrencyTransition, ledgerErrorFromDbError, normalizeLedgerError, SYSTEM_CURRENCY_CID } from './ledger';
import type { CurrencyStatus } from './ledger';
import { errorMessageOf } from './ledger-errors';
import { cancelOrdersOfCurrency } from './market-service';
import type { VerbErr, VerbResult } from './verb-shape';

/** 动作口的 `ops:` 幂等键 action 词（§49.25.2 / `DL157②` 逐字）。 */
export const CURRENCY_STATUS_OPS_ACTION = 'currency_status';

/**
 * `status` 闭集（§49.25.2 逐字）：**恰 3 值** `listed | frozen | delisted`。
 * `draft` **不在闭集内**（R27 白名单无任何 `→ draft` 边）⇒ `400`（形状闸），不是 `409`。
 */
export const CURRENCY_STATUS_TARGETS = ['listed', 'frozen', 'delisted'] as const;
export type CurrencyStatusTarget = (typeof CURRENCY_STATUS_TARGETS)[number];

/** `deposit_action` 冻结值（§49.25.9：恒 `'none'`；出现 `refund`/`forfeit`/其它值 ⇒ 判负）。 */
export const DEPOSIT_ACTION_NONE = 'none' as const;

/** `memo` 上限（§49.25.2；照 `admin-service.ts` 的 `>200 拒` 口径）。 */
export const CURRENCY_STATUS_MEMO_MAX = 200;

/** 服务端派生 memo 前缀（§49.25.7：缺 `body.memo` 时**必须**派生，不得留空串）。 */
export const statusMemoOf = (cid: number, from: string, to: string): string =>
  `admin currency status:${cid}:${from}->${to}`;

// ---- 错误构造（§49.25.8 逐码 + §3.3-1 R107 形状）-----------------------------
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

/** §49.25.8 #3：非数字 / `cid<=0` / 不存在 ⇒ `LD007`（404；**不得静默按 0**）。 */
export const statusCurrency404 = (cid: string): VerbErr =>
  fail(404, 'LEDGER_CURRENCY_NOT_FOUND', { cid, ref_type: 'currency', ref_id: cid || 'null' }, 'Currency not found');

/** §49.25.8 #4/#5/#6：非法迁移 / 活跃挂单残留 ⇒ 既有 `LD011`（409），靠 `details.reason` 区分。 */
export const statusStateConflict = (details: Record<string, unknown>): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', details, 'Business state transition rejected');

/** §49.25.8 #7/#8：入参形状 ⇒ 既有 `LEDGER_AMOUNT_INVALID`（400，`details.field` 区分）。 */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §49.25.8 #10：账本抛出命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE）。 */
const fromLedgerError = (e: unknown, key: string): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, key);
  if (mapped) return fail(mapped.httpStatus, mapped.code, (mapped.details ?? {}) as Record<string, unknown>);
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>);
};

// ============================================================================
// 入参形状解析（纯函数 · 离线可判负 · 零 DB）
// ============================================================================
/** `:cid` 形状闸：`/^[1-9]\d*$/`（前导 0 / 负数 / 非数字 ⇒ 不存在 ⇒ 404；**不得静默按 0**）。 */
export const parseCidShape = (cidRaw: unknown): { ok: true; cid: number; cidText: string } | { ok: false; err: VerbErr } => {
  const cidText = typeof cidRaw === 'string' ? cidRaw.trim() : String(cidRaw ?? '');
  if (!/^[1-9]\d*$/.test(cidText)) return { ok: false, err: statusCurrency404(cidText) };
  const cid = Number(cidText);
  if (!Number.isSafeInteger(cid) || cid <= 0) return { ok: false, err: statusCurrency404(cidText) };
  return { ok: true, cid, cidText: String(cid) };
};

/**
 * `status` 形状闸（**闭集恰 3 值**）：缺失 ⇒ `MISSING`；非字符串 ⇒ `NOT_STRING`；
 * 闭集外（含 `draft`）⇒ `STATUS_NOT_IN_CLOSED_SET` —— **全部 400**（§49.25.8 #7）。
 */
export const parseTargetStatus = (statusRaw: unknown): { ok: true; status: CurrencyStatusTarget } | { ok: false; err: VerbErr } => {
  if (statusRaw === undefined || statusRaw === null) {
    return { ok: false, err: shapeError('status', 'MISSING', { allowed: [...CURRENCY_STATUS_TARGETS] }) };
  }
  if (typeof statusRaw !== 'string') {
    return { ok: false, err: shapeError('status', 'NOT_STRING', { allowed: [...CURRENCY_STATUS_TARGETS] }) };
  }
  const value = statusRaw.trim();
  if (!(CURRENCY_STATUS_TARGETS as readonly string[]).includes(value)) {
    return {
      ok: false,
      err: shapeError('status', 'STATUS_NOT_IN_CLOSED_SET', { provided: value, allowed: [...CURRENCY_STATUS_TARGETS] }),
    };
  }
  return { ok: true, status: value as CurrencyStatusTarget };
};

/** `memo` 形状闸：可选；给了就必须是 `string` 且 `≤ 200` 字符（§49.25.8 #8）。 */
export const parseMemo = (memoRaw: unknown): { ok: true; memo: string | null } | { ok: false; err: VerbErr } => {
  if (memoRaw === undefined || memoRaw === null) return { ok: true, memo: null };
  if (typeof memoRaw !== 'string') return { ok: false, err: shapeError('memo', 'NOT_STRING') };
  if (memoRaw.length > CURRENCY_STATUS_MEMO_MAX) {
    return { ok: false, err: shapeError('memo', 'TOO_LONG', { max_length: CURRENCY_STATUS_MEMO_MAX }) };
  }
  const memo = memoRaw.trim();
  return { ok: true, memo: memo ? memo : null };
};

// ============================================================================
// 动作口 verb · `POST /api/admin/currency/:cid/status`（§49.25）
// ============================================================================
export type CurrencyStatusVerbDeps = {
  /** 只读当前状态（重放判定 + 状态机 `from`）；缺省 = 真 DB */
  readStatus?: (cid: number) => Promise<{ cid: number; status: string } | null>;
  /** Phase A（按币种撤单解冻）；缺省 = `market-service.cancelOrdersOfCurrency` */
  cancelOrders?: (cid: number, adminUid: number) => Promise<{
    ok: boolean; cancelled: number; attempted: number; failed: number;
    orders: Array<Record<string, unknown>>; error?: VerbErr;
  }>;
  /** Phase B（单语句：改状态 + 写日志）；缺省 = 真 DB */
  postEvent?: typeof DatabaseService.currencyStatusPostEvent;
};

export const currencyStatusVerb = async (params: {
  cidRaw: unknown;
  actorUid: number;
  body: Record<string, unknown> | undefined;
  deps?: CurrencyStatusVerbDeps;
}): Promise<VerbResult> => {
  const body = params.body || {};

  // ① 形状闸（顺序：cid → status → memo）——**全部在触库之前**
  const cidParsed = parseCidShape(params.cidRaw);
  if (!cidParsed.ok) return cidParsed.err;
  const { cid, cidText } = cidParsed;

  const targetParsed = parseTargetStatus(body.status);
  if (!targetParsed.ok) return targetParsed.err;
  const to = targetParsed.status;

  const memoParsed = parseMemo(body.memo);
  if (!memoParsed.ok) return memoParsed.err;

  const readStatus = params.deps?.readStatus ?? DatabaseService.getCurrencyStatus.bind(DatabaseService);
  const cancelOrders = params.deps?.cancelOrders
    ?? ((curCid: number, adminUid: number) => cancelOrdersOfCurrency({ cid: curCid, adminUid }));
  const poster = params.deps?.postEvent ?? DatabaseService.currencyStatusPostEvent.bind(DatabaseService);

  // ② 读 `from`（唯一真源 = 库；**不回显入参**）
  let cur: { cid: number; status: string } | null;
  try {
    cur = await readStatus(cid);
  } catch (e) {
    return fromLedgerError(e, `currency_status:${cidText}`);
  }
  if (!cur) return statusCurrency404(cidText);
  const from = String(cur.status);

  // ③ `from == to` ⇒ 不算迁移：200 + 顶层 `idempotent_replay:true`，**零日志行、零撤单**（§49.25.7②）
  if (from === to) {
    return {
      ok: true,
      replay: true,
      view: {
        cid: cidText,
        from_status: to,
        status: to,
        cancelled_orders: 0,
        deposit_action: DEPOSIT_ACTION_NONE,
      },
    };
  }

  // ④ R26：`$`（cid = 1）恒 `listed` —— 目标侧断言（先于状态机判定；一律 409，**不开白名单**）
  //    既有 `assertSystemCurrencyImmutable(cur)` 判的是**当前**状态（`$` 种子恒 `listed` ⇒ 永不触发）；
  //    本口真正要挡的是**目标**：把 `$` 改成 `frozen`/`delisted` ⇒ 同一 R26 口径 ⇒ 同码同状态。
  if (BigInt(cid) === SYSTEM_CURRENCY_CID && to !== 'listed') {
    return statusStateConflict({
      cid: cidText, from, to, reason: 'SYSTEM_CURRENCY_IMMUTABLE', symbol: '$',
    });
  }

  // ⑤ `draft → listed` **不在本口**（带资金腿）⇒ 409 + `LISTING_REQUIRES_FEE_PATH`（§49.25.4 ★）
  if (from === 'draft' && to === 'listed') {
    return statusStateConflict({
      cid: cidText, from: 'draft', to: 'listed', reason: 'LISTING_REQUIRES_FEE_PATH',
    });
  }

  // ⑥ R27 / R30 状态机（唯一真源 = `ledger.ts` 的白名单；`delisted` 终态不可复活）
  try {
    assertCurrencyTransition(from as CurrencyStatus, to as CurrencyStatus);
  } catch (e) {
    const mapped = normalizeLedgerError(e);
    return fail(mapped.httpStatus, mapped.code, { ...(mapped.details ?? {}), cid: cidText, from, to } as Record<string, unknown>);
  }

  // ⑦ **Phase A（前置副作用 · 逐单独立事务）**：`frozen → listed` 不撤单；其余承担格必跑。
  let cancelledOrders = 0;
  if (to !== 'listed') {
    const phaseA = await cancelOrders(cid, params.actorUid);
    if (phaseA.failed > 0 || !phaseA.ok) {
      // 任一单失败 ⇒ **中止**、**不进入 Phase B**、原样上抛该单既有码（§49.25.5 / §49.25.8 #11）
      if (phaseA.error) return phaseA.error;
      return statusStateConflict({
        cid: cidText, from, to, reason: 'PHASE_A_CANCEL_FAILED',
        attempted: phaseA.attempted, cancelled: phaseA.cancelled, orders: phaseA.orders,
      });
    }
    cancelledOrders = phaseA.cancelled;
  }

  // ⑧ **Phase B（单语句 / 单事务）**：断言状态机 + 再断言活跃挂单 = 0 + `UPDATE status` + 写日志恰 1 行
  let row: Record<string, unknown>;
  try {
    row = await poster({
      cid,
      toStatus: to,
      fromStatus: from,
      actorUid: params.actorUid, // ★ actor = **管理员**（不是 owner；§49.25.7 判负项）
      memo: memoParsed.memo ?? statusMemoOf(cid, from, to),
    });
  } catch (e) {
    return fromLedgerError(e, `currency_status:${cidText}`);
  }

  const curFound = Number(row.cur_found ?? 0);
  const curStatus = row.cur_status === undefined || row.cur_status === null ? '' : String(row.cur_status);
  const openOrders = Number(row.open_orders ?? 0);
  const applied = Number(row.applied ?? 0);
  const slogged = Number(row.slogged ?? 0);
  const appliedStatus = row.applied_status === undefined || row.applied_status === null
    ? '' : String(row.applied_status);

  // 单位不存在 ⇒ 404（既有 LD007）
  if (curFound !== 1) return statusCurrency404(cidText);

  if (applied < 1) {
    // Phase B 关窗竞态兜底：活跃挂单又出现 ⇒ 409 `ACTIVE_ORDERS_REMAIN`（status 未变、零日志行）
    if (openOrders > 0) {
      return statusStateConflict({ cid: cidText, from: curStatus || from, to, reason: 'ACTIVE_ORDERS_REMAIN', open_orders: openOrders });
    }
    // 状态已被并发改成目标值 ⇒ 语义幂等（重放；零日志行）；否则为非法迁移（`from` 已漂移）
    if (curStatus === to) {
      return {
        ok: true,
        replay: true,
        view: {
          cid: cidText,
          from_status: to,
          status: to,
          cancelled_orders: 0,
          deposit_action: DEPOSIT_ACTION_NONE,
        },
      };
    }
    return statusStateConflict({ cid: cidText, from: curStatus || from, to, reason: 'CURRENCY_STATE_INVALID' });
  }

  // 防御（构造上不可达：`slog` 与 `apply` 同一语句 ⇒ `applied=1` 必有 1 行日志）。
  // 真触发 ⇒ 说明「状态变了而日志缺失」⇒ 宁可响亮报错也不静默成功（§49.25.7 判负项 #7）。
  if (slogged < 1) {
    throw new Error('currencyStatusVerb: status applied but currency_status_log not written');
  }

  // ⑨ 成功：`data` **恰 5 键**（§49.25.9 冻结）；`status` = **读库真值**（`applied_status`），非回显入参
  return {
    ok: true,
    replay: false,
    view: {
      cid: cidText,
      from_status: from,
      status: appliedStatus || to,
      cancelled_orders: cancelledOrders,
      deposit_action: DEPOSIT_ACTION_NONE,
    },
  };
};

// ============================================================================
// 读口 · `GET /api/admin/currency/status`（供前端 tab；闸 `manage_settings`）
// ----------------------------------------------------------------------------
// ★ 为什么另开一读口：既有 `GET /api/admin/currency` 的闸是 `review_tasks`（§23.2 已冻结条文），
//   与本 tab 的写口闸 `manage_settings` 不匹配 ⇒ **不改旧口**（改闸 = 放宽已冻结节点的可见面），
//   另开一只**只读投影**：`cid / symbol / status / listed_at` 恰 4 键。
// ★ 数据源复用既有 `listCurrenciesForAdmin(null)`（零新 SQL、零新写面）；本口**只 `SELECT`**。
// ============================================================================
export const listCurrencyStatusesForAdmin = async (params?: {
  list?: (statusFilter: string | null) => Promise<Record<string, unknown>[]>;
}): Promise<Array<{ cid: string; symbol: string; status: string; listed_at: string | null }>> => {
  const list = params?.list ?? DatabaseService.listCurrenciesForAdmin.bind(DatabaseService);
  const rows = await list(null);
  return rows.map((r) => ({
    cid: String(r.cid ?? ''),
    symbol: String(r.symbol ?? ''),
    status: String(r.status ?? ''),
    listed_at: r.listed_at === undefined || r.listed_at === null ? null : String(r.listed_at),
  }));
};
