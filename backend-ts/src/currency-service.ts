// ============================================================================
// src/currency-service.ts — P4-B3a · 币种面**真资金**编排（C1 建单位 / C2 上市收保证金）
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md **v0.2**
//   §1.1:147-148（C1/C2 = 批 3；spec 逐字「未实现（无编排函数）」）
//   §4.2 C1/C2（端点 → kind → 幂等键 → 失败/回滚；C2 行 ★ §7-3 裁定组合）
//   §4.3:427（资金四栏）· §4.0 R1（一切资金动作必须走账本：唯一写路径 = `ledger_post_event`）
//   §4.0 R2（业务行 + 分录**必须同一事务**；本片因**迁移冻结**（不开 0018、禁改 ledger.ts）
//             ⇒ 以「单语句 CTE」等价实现：一条 `SELECT`（隐式事务）= 业务行写 + `ledger_post_event` 调用）
//   §4.1（kind 关闭集 20）· §4.5（键前缀 `biz:`/`cm:`/`cli:`/`ops:`；禁 `#` 与控制字符）
//   §3.1/§3.2/§3.3（404 三类 / 逐码适用条件 / R107 收尾规则）· §6.2 附表（403 + ACTOR_NOT_ALLOWED）
//   §4.4-11（**FIX-B 落地** · Zang 裁定 §5.82 7-23）：**费率 / 保证金金额必须服务端取数**
//            —— 上市费 `currency_create_fee` → `-1`（消耗）+ 保证金 `listing_deposit`
//            → **贷 `uid = -1`（上市即消耗、不可退、无退还 kind、无罚没）**：
//            逐条依据 = `ledger.spec` §3.1 R31（v0.2，`:287`）/ `data-layer.spec` DL67（`:454`）/
//            DL88（`:530`）【均冻结】+ `route-layer.spec` §4.2 C2 行 / §4.3 资金四栏 / §7-3（**v0.3 更正**）
//            ⇒ 分录形状 = **借用户 `balance` / 贷 `uid=-1` `balance`**，**不得出现任何 `frozen` 变动**；
//            `hold_forfeit`→`-3` **不启用**（DL91：P3 无罚没标的物；退市/罚没**不实现**，见 §4.2 C3）。
//            〔**v0.2 旧写法（错，FIX-B 已改，留痕）**：保证金 = `HOLD_KINDS` 内 ⇒ 纯冻结、
//             可退、不进 `-1` 白名单 —— 该口径由 Zang §5.81 勘误作废〕
//
// 硬边界（本文件自证）：
//   · **不新增 kind**、**不改任何白名单**、**不改迁移**、**不改 `src/ledger.ts`**（调用它，不修改它）。
//   · 资金分录**只**由 DB 函数 `ledger_post_event` 落（R1）；本文件不写 `account` / `ledger_entry`。
//   · 退市 / 罚没**不实现**（§4.2 无端点、无幂等键、无失败语义 ⇒ 派单硬口径 #5：登记 `NOT_MEASURED`）。
//   · 对外路径注册点在 `src/index.ts`（本片新增 2 个：`POST /api/currency`、`POST /api/currency/:cid/list`）。
// ============================================================================
import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { ledgerErrorFromDbError, normalizeIdempotencyKey, normalizeLedgerError } from './ledger';
import { ledgerErrorBody, sendVerbError, type JobVerbErr as VerbErr, type JobVerbResult as VerbResult } from './job-service';

export { ledgerErrorBody, sendVerbError };
export type { VerbErr, VerbResult };

const MAX_SINGLE_AMOUNT = 1_000_000_000_000_000; // §4.4-9 / R71：1e15

// ---- 错误构造（§3.2 逐码 + §3.3-1 R107 形状）--------------------------------
const fail = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  message?: string,
): VerbErr => ({
  ok: false,
  status,
  code,
  message: message || code,
  details,
  authDomain: code.startsWith('AUTH_'),
});

/** §3.1：币种不存在 ⇒ `LEDGER_CURRENCY_NOT_FOUND` + `details.cid`（十进制字符串；含 `cid<=0`） */
const currency404 = (cid: string): VerbErr =>
  fail(404, 'LEDGER_CURRENCY_NOT_FOUND', { cid }, 'Currency not found');

/** §3.2：业务状态机非法转移 ⇒ 409 + 借码 `LEDGER_CURRENCY_INVALID_TRANSITION` + field + reason（大写） */
const stateConflict = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', { field, reason, ...extra }, 'Business state transition rejected');

/** §3.2 400：入参形状 / 语义非法（`LEDGER_AMOUNT_INVALID` 被兼用作参数形状码，靠 `details.field` 区分） */
const shapeError = (field: string, reason: string, extra: Record<string, unknown> = {}): VerbErr =>
  fail(400, 'LEDGER_AMOUNT_INVALID', { field, reason, ...extra }, 'Request shape is invalid');

/** §3.3-4：账本抛出的命名错误 ⇒ 原码 / 原 status / 非敏感 details（禁裸 SQLSTATE） */
const fromLedgerError = (e: unknown, key: string): VerbErr => {
  const mapped = ledgerErrorFromDbError(e, key);
  if (mapped) {
    return fail(
      mapped.httpStatus,
      mapped.code,
      (mapped.details ?? {}) as Record<string, unknown>,
      mapped.code,
    );
  }
  const norm = normalizeLedgerError(e);
  return fail(norm.httpStatus, norm.code, (norm.details ?? {}) as Record<string, unknown>, norm.code);
};

// ---- 幂等键（§4.5：前缀只允许 biz:/cm:/cli:/ops:；禁 `#` 与控制字符；顺序固定）----
const KEY_PREFIXES = ['biz:', 'cm:', 'cli:', 'ops:'] as const;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * 幂等键解析（§4.5 + §4.0 R6）：
 *   · 调用方给 `create_key` / `idempotency_key` / `Idempotency-Key` ⇒ 按 §4.5 校验后**原样使用**
 *     （它同时是**账本事件幂等键** ⇒ 同键重投 = `200` 重放、同键异载荷 = `409`）。
 *   · 未给 ⇒ 派生**确定性**键：`biz:currency:create:<symbol>` / `biz:currency:list:<cid>`
 *     （data-layer.spec v0.6 §8.3:578-579 的键形；确定性 ⇒ 同一请求重试必得同键 ⇒ 重放）。
 *   · 登记（报告 §7-3）：route-layer §4.2 C1/C2 的「幂等键」列写的是**「待定」** ⇒ 本片取此形态待裁。
 */
export const resolveCurrencyKey = (
  raw: unknown,
  fallback: string,
): { ok: true; key: string; derived: boolean } | { ok: false; details: Record<string, unknown> } => {
  const provided = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!provided) return { ok: true, key: fallback, derived: true };
  if (provided.length > 200) return { ok: false, details: { field: 'create_key', reason: 'TOO_LONG' } };
  if (!KEY_PREFIXES.some((prefix) => provided.startsWith(prefix))) {
    return { ok: false, details: { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: KEY_PREFIXES } };
  }
  if (provided.includes('#')) return { ok: false, details: { field: 'create_key', reason: 'RESERVED_SEPARATOR' } };
  if (CONTROL_CHARS.test(provided)) return { ok: false, details: { field: 'create_key', reason: 'CONTROL_CHARACTER' } };
  return { ok: true, key: provided, derived: false };
};

export const pickIdempotencyKeyRaw = (
  body: Record<string, unknown> | undefined,
  headerValue: unknown,
): unknown => {
  const b = body || {};
  return b.create_key ?? b.idempotency_key ?? b.idempotencyKey ?? headerValue ?? undefined;
};

/** 请求指纹（R53：规范化请求体的 sha256；同键异指纹 ⇒ DB 抛 LD003 ⇒ 409） */
const fingerprintOf = (parts: Array<string | number>): string =>
  createHash('sha256').update(parts.join('|')).digest('hex');

// ---- 入参规范化（§3.2：形状非法 ⇒ 400；金额 = 最小单位整数，§4.4-9）----------
const toPosInt = (raw: unknown, field: string): { ok: true; value: number } | { ok: false; err: VerbErr } => {
  const text = typeof raw === 'string' ? raw.trim() : (raw === undefined || raw === null ? '' : String(raw));
  if (!/^\d+$/.test(text)) return { ok: false, err: shapeError(field, 'NOT_A_POSITIVE_INTEGER') };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false, err: shapeError(field, 'NOT_A_POSITIVE_INTEGER') };
  if (value > MAX_SINGLE_AMOUNT) return { ok: false, err: shapeError(field, 'OVER_MAX_SINGLE_AMOUNT') };
  return { ok: true, value };
};

// ---- 金额服务端取数（§4.4-11 硬口径 · **FIX-B 落地**）------------------------------------------------
/**
 * 下限常量 = **服务端代码常量兜底**。★★ **已定值**（**Kevin 2026-09-30 定值**，由 Zang 代定）
 * ============================================================================
 * 依据 Zang 裁定 §5.82 **7-23**：「机制先落地、数值待 Kevin」⇒ 本片只落**机制**：
 *   ① 金额一律**服务端取数**（调用方未传 ⇒ 用服务端值）；② 调用方传值只允许 `>= 下限`，低于 ⇒ 400。
 * **Kevin 2026-09-30 定值**：建币费 `currency_create_fee` = **10000** / 上市费 `listing_fee` = **10000**
 *   / 上市保证金 `listing_deposit` = **50000**；依据 = **阶梯锥定**（以「1% 佣金下 10 万酬金 ⇒
 *   1000 手续费」为锚的阶梯）；`$` 目前**无 faucet** ⇒ 属**有量级感的起始值**，待**首次铸币后重估**。
 * **保持单点常量形态**（值只在此处出现一次，不得散落多处；**不得**改成从 `app_config` 读 —— 那属批 6）。
 * **批 6（配置面）登记**：改为**从平台配置取数**（真源键待 Kevin 给；**不得**从 `app_config`
 *   硬造键名 —— Zang 裁定 7-16），届时本常量降为兜底。
 */
const CURRENCY_CREATE_FEE_FLOOR = 10000; // Kevin 2026-09-30 定值（起始值：阶梯锥定；$ 无 faucet ⇒ 待首次铸币后重估）
const CURRENCY_LIST_FEE_FLOOR = 10000; // Kevin 2026-09-30 定值（同上）
const CURRENCY_LIST_DEPOSIT_FLOOR = 50000; // Kevin 2026-09-30 定值（同上）

/**
 * 金额解析 = **服务端取数 + 下限校验**（§4.4-11；Zang §5.82 7-23）。语义写死，不自行发挥：
 *   · **未传**（`undefined`/`null`/`''`）⇒ 取**服务端值**（下限常量兜底）⇒ 调用方**无法**把金额压到下限以下；
 *   · **传了** ⇒ 先过形状闸（正整数 · `<= 1e15`，§4.4-9），再必须 `>= floor`：低于 ⇒ **400**。
 *     借码（**不新造码**）= `LEDGER_AMOUNT_NOT_POSITIVE`（§14.1 #18，400 入参类，与「金额量纲不足」同族；
 *     本文件原有的缺值/非正整数分支同码 ⇒ 家族一致）；`details` = `{field, value, min, reason}`，
 *     `reason='BELOW_SERVER_FLOOR'`（报告 §4 记明「用了哪个码 + 依据 + 备选码」）。
 *   · 返回 `source` 仅用于回执视图 / 报告，**不参与**任何分支判定。
 */
const resolveServerAmount = (
  raw: unknown,
  field: string,
  floor: number,
): { ok: true; value: number; source: 'server_default' | 'client_ge_floor' } | { ok: false; err: VerbErr } => {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: floor, source: 'server_default' };
  }
  const parsed = toPosInt(raw, field);
  if (!parsed.ok) return parsed;
  if (parsed.value < floor) {
    return {
      ok: false,
      err: fail(
        400,
        'LEDGER_AMOUNT_NOT_POSITIVE',
        { field, value: String(parsed.value), min: String(floor), reason: 'BELOW_SERVER_FLOOR' },
        'Amount is below the server-side floor',
      ),
    };
  }
  return { ok: true, value: parsed.value, source: 'client_ge_floor' };
};

const ledgerView = (ledgerResult: unknown): Record<string, unknown> | null => {
  if (!ledgerResult || typeof ledgerResult !== 'object') return null;
  const r = ledgerResult as Record<string, unknown>;
  const entries = Array.isArray(r.entries) ? r.entries : [];
  return {
    txid: r.txid === undefined || r.txid === null ? null : String(r.txid),
    idempotency_key: r.idempotency_key === undefined || r.idempotency_key === null ? null : String(r.idempotency_key),
    idempotent_replay: r.idempotent_replay === true,
    entry_count: entries.length,
    kinds: entries.map((e) => String((e as Record<string, unknown>).kind ?? '')),
    accounts: Array.isArray(r.accounts) ? r.accounts : [],
  };
};

// ============================================================================
// C1 · `POST /api/currency`（建自定义积分单位，收 `currency_create_fee` → `-1`）
// ============================================================================
export const createCurrencyVerb = async (params: {
  actorUid: number;
  body: Record<string, unknown> | undefined;
  headerKey?: unknown;
}): Promise<VerbResult> => {
  const body = params.body || {};
  const actorUid = Number(params.actorUid);
  if (!Number.isInteger(actorUid) || actorUid <= 0) {
    return fail(400, 'LEDGER_RESERVED_UID', { field: 'actor.uid', value: String(params.actorUid) }, 'Reserved uid is not allowed');
  }

  // symbol / name / decimals（§4.2 C1 必需字段）
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
  if (!/^\S{1,16}$/.test(symbol)) {
    return shapeError('currency.symbol', 'SYMBOL_FORMAT_INVALID', { provided_len: symbol.length });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return shapeError('currency.name', 'MISSING');

  const decimalsRaw = body.decimals === undefined || body.decimals === null ? 0 : body.decimals;
  const decimalsText = String(decimalsRaw).trim();
  if (!/^\d+$/.test(decimalsText)) return shapeError('currency.decimals', 'NOT_AN_INTEGER');
  const decimals = Number(decimalsText);
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 18) {
    return shapeError('currency.decimals', 'DECIMALS_OUT_OF_RANGE', { provided: decimalsText, min: 0, max: 18 });
  }

  // owner_uid：缺 ⇒ actor；给了但非 actor ⇒ 403（§6.2 附表：不得替他人出资 / 越权建单位）
  let ownerUid = actorUid;
  if (body.owner_uid !== undefined && body.owner_uid !== null && String(body.owner_uid) !== '') {
    const ownerText = String(body.owner_uid).trim();
    if (!/^\d+$/.test(ownerText)) return shapeError('currency.owner_uid', 'NOT_AN_INTEGER');
    ownerUid = Number(ownerText);
    if (ownerUid !== actorUid) {
      return fail(403, 'AUTH_FORBIDDEN', { reason: 'ACTOR_NOT_ALLOWED', field: 'currency.owner_uid' }, 'ACTOR_NOT_ALLOWED');
    }
  }

  // 建单位费（§7-3 / §4.4-11：`currency_create_fee` → `-1`；**金额服务端取数 + 下限校验**）
  const fee = resolveServerAmount(body.fee ?? body.create_fee, 'fee', CURRENCY_CREATE_FEE_FLOOR);
  if (!fee.ok) return fee.err;

  const resolved = resolveCurrencyKey(
    pickIdempotencyKeyRaw(body, params.headerKey),
    `biz:currency:create:${symbol}`,
  );
  if (!resolved.ok) return fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', resolved.details, 'Idempotency key is invalid');
  let key: string;
  try {
    key = normalizeIdempotencyKey(resolved.key);
  } catch (e) {
    return fromLedgerError(e, resolved.key);
  }

  const fingerprint = fingerprintOf(['create', symbol, name, ownerUid, decimals, fee.value]);
  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.createCurrencyWithFee({
      symbol, name, ownerUid, decimals, fee: fee.value,
      idempotencyKey: key, requestFingerprint: fingerprint,
      memo: `currency_create_fee:${symbol}`,
    });
  } catch (e) {
    return fromLedgerError(e, key);
  }

  const inserted = Number(row.inserted ?? 0);
  const keyFp = row.key_fingerprint === undefined || row.key_fingerprint === null ? null : String(row.key_fingerprint);

  if (inserted === 0) {
    // 未插入：symbol 已存在 ⇒ ① 同键同指纹 = 重放（200）；② 同键异指纹 = 409；③ 异键 = 符号占用 409
    if (keyFp !== null && keyFp === fingerprint) {
      const existing = (row.existing_row || {}) as Record<string, unknown>;
      return {
        ok: true,
        replay: true,
        view: {
          cid: String(existing.cid ?? ''),
          symbol: String(existing.symbol ?? symbol),
          name: String(existing.name ?? name),
          owner_uid: String(existing.owner_uid ?? ownerUid),
          decimals: Number(existing.decimals ?? decimals),
          status: String(existing.status ?? 'draft'),
          fee: String(fee.value),
          idempotent_replay: true,
          ledger_event: null,
        },
      };
    }
    if (keyFp !== null) {
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', {
        field: 'currency.create_key', reason: 'REPLAY_FINGERPRINT_MISMATCH', ref_id: key,
      }, 'Idempotency conflict');
    }
    return fail(409, 'LEDGER_CURRENCY_SYMBOL_TAKEN', { field: 'currency.symbol', symbol }, 'Currency symbol is taken');
  }

  return {
    ok: true,
    replay: false,
    view: {
      cid: String(row.new_cid ?? ''),
      symbol,
      name,
      owner_uid: String(ownerUid),
      decimals,
      status: 'draft',
      deposit_amount: '0',
      deposit_cid: '1',
      listed_at: null,
      fee: String(fee.value),
      fee_source: fee.source,
      fee_kind: 'currency_create_fee',
      fee_credit_uid: '-1',
      create_key: key,
      create_key_derived: resolved.derived,
      idempotent_replay: false,
      ledger_event: ledgerView(row.ledger_result),
    },
  };
};

// ============================================================================
// C2 · `POST /api/currency/:cid/list`（上市：上市费 `currency_create_fee` ×2 → `-1`
//                                     + 保证金 `listing_deposit` ×2 → **贷 `uid = -1`**）
// ----------------------------------------------------------------------------
// **FIX-B 形状**（§4.2 C2 · §4.3 资金四栏 · §7-3 v0.3 · Zang §5.81 最终裁定）：
//   4 条分录，**全部落在 `balance`**（**零 `frozen` 变动**）：
//     ① user `balance -fee`  ② `-1` `balance +fee`   → kind = `currency_create_fee`（cid 恒 1）
//     ③ user `balance -dep`  ④ `-1` `balance +dep`   → kind = `listing_deposit`（cid = 行 `deposit_cid`）
//   **不可退 · 无退还 kind · 无罚没**（`listing_deposit_refund` 不存在；`hold_forfeit` P3 不启用）。
//   金额 = **服务端取数**（§4.4-11；Zang §5.82 7-23）⇒ 见 `resolveServerAmount`。
// ============================================================================
export const listCurrencyVerb = async (params: {
  cidRaw: unknown;
  actorUid: number;
  body: Record<string, unknown> | undefined;
  headerKey?: unknown;
}): Promise<VerbResult> => {
  const body = params.body || {};
  const actorUid = Number(params.actorUid);
  if (!Number.isInteger(actorUid) || actorUid <= 0) {
    return fail(400, 'LEDGER_RESERVED_UID', { field: 'actor.uid', value: String(params.actorUid) }, 'Reserved uid is not allowed');
  }

  // cid 形状闸（§3.1 类②：`cid <= 0` / 非整数 ⇒ 该币种不存在 ⇒ 404，与 `ledger_cid_arg` 同口径）
  const cidText = typeof params.cidRaw === 'string' ? params.cidRaw.trim() : String(params.cidRaw ?? '');
  if (!/^\d+$/.test(cidText)) return currency404(cidText);
  const cid = Number(cidText);
  if (!Number.isSafeInteger(cid) || cid <= 0) return currency404(cidText);

  // §4.4-11（FIX-B）：金额 = **服务端取数 + 下限校验**（调用方可传，但只允许 `>= 下限`）
  const fee = resolveServerAmount(body.fee ?? body.listing_fee, 'listing_fee', CURRENCY_LIST_FEE_FLOOR);
  if (!fee.ok) return fee.err;
  const deposit = resolveServerAmount(body.deposit_amount ?? body.deposit, 'deposit_amount', CURRENCY_LIST_DEPOSIT_FLOOR);
  if (!deposit.ok) return deposit.err;

  const resolved = resolveCurrencyKey(
    pickIdempotencyKeyRaw(body, params.headerKey),
    `biz:currency:list:${cid}`,
  );
  if (!resolved.ok) return fail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', resolved.details, 'Idempotency key is invalid');
  let key: string;
  try {
    key = normalizeIdempotencyKey(resolved.key);
  } catch (e) {
    return fromLedgerError(e, resolved.key);
  }

  const fingerprint = fingerprintOf(['list', cid, actorUid, fee.value, deposit.value]);
  let row: Record<string, unknown>;
  try {
    row = await DatabaseService.listCurrencyWithDeposit({
      cid, actorUid, fee: fee.value, depositAmount: deposit.value,
      idempotencyKey: key, requestFingerprint: fingerprint,
      memo: `currency_list_deposit:${cid}`,
    });
  } catch (e) {
    return fromLedgerError(e, key);
  }

  const curFound = Number(row.cur_found ?? 0);
  const applied = Number(row.applied ?? 0);
  const curOwner = row.cur_owner === undefined || row.cur_owner === null ? null : String(row.cur_owner);
  const curStatus = row.cur_status === undefined || row.cur_status === null ? null : String(row.cur_status);
  const keyFp = row.key_fingerprint === undefined || row.key_fingerprint === null ? null : String(row.key_fingerprint);

  if (curFound === 0) return currency404(String(cid));

  if (applied === 0) {
    // 未迁移：① 同键同指纹 ⇒ 200 重放（业务行已是 listed、**不产生第二条分录**）；
    //          ② 非本人 ⇒ 403；③ 非 draft ⇒ 409 状态冲突
    if (keyFp !== null && keyFp === fingerprint && curStatus !== 'draft') {
      const appliedRow = (row.applied_row || {}) as Record<string, unknown>;
      return {
        ok: true,
        replay: true,
        view: {
          cid: String(cid),
          symbol: String(appliedRow.symbol ?? ''),
          owner_uid: curOwner,
          status: curStatus,
          idempotent_replay: true,
          ledger_event: null,
        },
      };
    }
    if (curOwner !== String(actorUid)) {
      // §6.2 附表 / §3.4：业务角色守卫 ⇒ 403 `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`
      // （§4.2 C2 的「期望码」列写的是 `LD014`；§3.2 明文禁止新面业务路由返回 `LEDGER_UNAUTHORIZED_MINT`
      //   ⇒ 本片取 §3.2/§6.2 的 `AUTH_FORBIDDEN`；登记为报告 §2 的 T4 待裁项）
      return fail(403, 'AUTH_FORBIDDEN', {
        reason: 'ACTOR_NOT_ALLOWED', ref_type: 'currency', ref_id: String(cid), condition: 'not_currency_owner',
      }, 'ACTOR_NOT_ALLOWED');
    }
    if (keyFp !== null) {
      return fail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', {
        field: 'currency.list_key', reason: 'REPLAY_FINGERPRINT_MISMATCH', ref_id: key,
      }, 'Idempotency conflict');
    }
    return stateConflict('currency.status', 'CURRENCY_STATE_INVALID', {
      cid: String(cid), from: curStatus, to: 'listed', required_from: 'draft',
    });
  }

  const appliedRow = (row.applied_row || {}) as Record<string, unknown>;
  return {
    ok: true,
    replay: false,
    view: {
      cid: String(cid),
      symbol: String(appliedRow.symbol ?? ''),
      owner_uid: curOwner,
      status: String(appliedRow.status ?? 'listed'),
      deposit_amount: String(appliedRow.deposit_amount ?? deposit.value),
      deposit_cid: String(appliedRow.deposit_cid ?? '1'),
      listed_at: appliedRow.listed_at === undefined || appliedRow.listed_at === null ? null : String(appliedRow.listed_at),
      listing_fee: String(fee.value),
      // ★ FIX-B：保证金**上市即消耗**（不再是「冻结」）⇒ 回执只报「消耗额 + 收款账户」，不报冻结/可退
      deposit_consumed: String(deposit.value),
      listing_fee_source: fee.source,
      deposit_source: deposit.source,
      fee_kind: 'currency_create_fee',
      fee_credit_uid: '-1',
      deposit_kind: 'listing_deposit',
      deposit_credit_uid: '-1',
      deposit_refundable: false,
      list_key: key,
      list_key_derived: resolved.derived,
      idempotent_replay: false,
      ledger_event: ledgerView(row.ledger_result),
    },
  };
};
