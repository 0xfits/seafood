/**
 * 批 8③（`data-layer.spec` v0.12 §23 · `route-layer.spec` v2.5 §20.7）·
 * **「上市保证金下限可配置」真生效四段读数探针**
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s3-01-effective.ts
 * 产物：backend-ts/.p8s3-artifacts/p8s3-effective-<RUN>/effective.json
 *
 * ★ `R-8-18`（本片新裁）/ `R-8-15`（同族 · 8② 立）· **逐字执行**：
 *   本探针**全部**在**一个** `withTransaction` 事务内完成，末尾抛哨兵 ⇒ 回调异常 ⇒
 *   `withTransaction` 走 `catch` ⇒ **`ROLLBACK`**（**绝不 `COMMIT`**）。
 *   · **零生产 HTTP 写**：**不**跑 `POST /api/admin/settings`、**不**跑 `POST /api/currency/:cid/list`。
 *     ⇒ 报告须逐字登记「**HTTP 写面 = `NOT_MEASURED`**（键级寻址线格式未冻结）」与
 *       「**HTTP `list` 面 = `NOT_MEASURED`**（跑真 POST 会永久改线上状态）」。
 *   · 写键段 = **事务内 DB 直写 `app_config` 的 `AK2` 行**（**不是** HTTP 写面）；
 *     ④ 行为段 = **调用与 `POST /api/currency/:cid/list` 同路径的 DB 函数**
 *     `DatabaseService.listCurrencyWithDeposit(input, tx)`（`ex` 口 = 本片新增，
 *     让「服务层（neon）」与「探针（事务内）」**共用同一份 SQL** ⇒ 无第二套取数）。
 *
 * 四段（`route-layer.spec` §20.4(d) 模板 · 与 8② 同形）：
 *   ① 写键（事务内 DB 直写 `AK2`）→ ② 库内落值（给表 / 列）→
 *   ③ 业务读口取数（给 `文件:行`：`currency-service.ts` 的 `resolveListingDepositFloorFromDb`）→
 *   ④ 行为随之（改键前 / 改键后**两读数**：上市的 `listing_deposit` **消耗额** =
 *      owner `balance` 减少额 = `uid = -1` `balance` 增加额）
 *
 * 每段自带判负（含逐字形态「**写成功但库值未变 ⇒ 判负**」）+ **判负自证**
 * （把判据谓词喂错值 ⇒ 必须报红；不报红 = 假门）。
 * ⚠️ 只打印 uid / cid / 计数 / 金额 / 机读字段，**不打印任何密钥 / 连接串**。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { readQuery, withTransaction, closePools, txQuery, TxClient } from '../src/db';
import {
  DatabaseService,
  LISTING_DEPOSIT_POLICY_KEY,
  parseListingDepositPolicyAmount,
} from '../src/database';
import { CURRENCY_LIST_DEPOSIT_FLOOR, resolveListingDepositFloor } from '../src/currency-service';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const OUT_DIR = path.join(HERE, '..', '.p8s3-artifacts', `p8s3-effective-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

/** 探针临时键值（**非定值** · 事务内写入 · `ROLLBACK` ⇒ 零落库；见报告「不得发明数值」口径）。 */
const NEW_AMOUNT = 123456;
/** fail-closed 负向验证用：**字符串型**金额（读侧必须 `null` ⇒ 回落常量）。 */
const ILLEGAL_RAW = { amount: '77777' };
/** 事务回滚哨兵：回调末尾抛它 ⇒ `withTransaction` 走 `catch` ⇒ `ROLLBACK`（**绝不 COMMIT**）。 */
class RollbackSentinel extends Error {
  constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); }
}

// ---------------------------------------------------------------- 源码锚点（动态取真行号）
const CURRENCY_SRC = fs.readFileSync(path.resolve(HERE, '..', 'src', 'currency-service.ts'), 'utf8');
const CURRENCY_LINES = CURRENCY_SRC.split('\n');
const lineOf = (needle: string, nth = 1): number => {
  let c = 0;
  for (let i = 0; i < CURRENCY_LINES.length; i += 1) {
    if (CURRENCY_LINES[i].includes(needle)) { c += 1; if (c === nth) return i + 1; }
  }
  return -1;
};
const constOf = (name: string): number => {
  const m = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(CURRENCY_SRC);
  return m ? Number(m[1]) : -1;
};
/** `src/currency-service.ts` 的 `CURRENCY_LIST_FEE_FLOOR`（**未导出** ⇒ 从源码取真值，不发明）。 */
const LIST_FEE_FLOOR = constOf('CURRENCY_LIST_FEE_FLOOR');
const ANCHORS = {
  read_port_def: `src/currency-service.ts:${lineOf('const resolveListingDepositFloorFromDb')} resolveListingDepositFloorFromDb 定义（= resolveListingDepositFloor ∘ DatabaseService.getListingDepositPolicyValue + try/catch）`,
  read_port_call: `src/currency-service.ts:${lineOf('const depositFloor = await resolveListingDepositFloorFromDb();')} listCurrencyVerb 取保证金下限`,
  amount_gate: `src/currency-service.ts:${lineOf("resolveServerAmount(body.deposit_amount")} resolveServerAmount(…, depositFloor.floor, depositFloor.source)`,
  list_db_call: `src/currency-service.ts:${lineOf('DatabaseService.listCurrencyWithDeposit({')} listCurrencyVerb → DatabaseService.listCurrencyWithDeposit（④ 同路径 DB 函数）`,
  floor_constant: `src/currency-service.ts:${lineOf('export const CURRENCY_LIST_DEPOSIT_FLOOR')} 兜底常量 = ${CURRENCY_LIST_DEPOSIT_FLOOR}`,
  list_fee_constant: `src/currency-service.ts:${lineOf('CURRENCY_LIST_FEE_FLOOR =')} 上市费常量 = ${LIST_FEE_FLOOR}`,
};

interface Check { id: string; group: string; pass: boolean; detail: unknown; neg_rule: string; }
const checks: Check[] = [];
const rec = (id: string, group: string, pass: boolean, detail: unknown, negRule: string): void => {
  checks.push({ id, group, pass, detail, neg_rule: negRule });
};
/** 判据比较器（唯一判负出口 · `neg_rule` 逐字登记）。 */
const judge = (id: string, group: string, actual: unknown, expected: unknown, negRule: string): boolean => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  rec(id, group, ok, { actual, expected }, negRule);
  return ok;
};
/** 判负**自证**：谓词喂故意错值 ⇒ 必须返 false（不返 false = 假门）。 */
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, negRule: string): void => {
  const fired = predicate(wrongInput) === false;
  rec(`${id}__selftest`, group, fired, { wrong_input: wrongInput, judge_fired: fired }, negRule);
};

const fp = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

// ---------------------------------------------------------------- DB 小工具
const bal = async (tx: TxClient, uid: number, cid: number): Promise<number> => {
  const r = await txQuery<{ balance: string }>(tx,
    'SELECT balance::text AS balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint',
    [String(uid), String(cid)]);
  return r.length ? Number(r[0].balance) : -1;
};
const pickOwner = async (tx: TxClient): Promise<{ uid: number; balance: number }> => {
  // ★ 排序显式限定列（防 `ORDER BY <text 别名>` 的字典序陷阱）；只取**现库已出资**的正 uid 账户。
  const r = await txQuery<{ uid: string; balance: string }>(tx,
    `SELECT a.uid::text AS uid, a.balance::text AS balance
       FROM public.account AS a WHERE a.cid = 1 AND a.uid > 0
      ORDER BY a.balance DESC, a.uid ASC LIMIT 1`);
  return { uid: Number(r[0].uid), balance: Number(r[0].balance) };
};
/** 事务内直造一次性 `draft` 币（**显式 `cid`** ⇒ 不动 `currency_cid_seq`；生产路径走序列）。 */
const insertDraft = async (tx: TxClient, cid: number, symbol: string, ownerUid: number): Promise<number> => {
  const r = await txQuery<{ cid: string }>(tx,
    `INSERT INTO public.currency (cid, symbol, name, owner_uid, decimals, status, deposit_cid)
     VALUES ($1::bigint, $2::text, $3::text, $4::bigint, 0, 'draft', 1) RETURNING cid::text AS cid`,
    [String(cid), symbol, `p8s3 fuel probe ${symbol}`, String(ownerUid)]);
  return Number(r[0].cid);
};
/** ④ 同路径：与 `listCurrencyVerb` **同一** DB 函数 + **同一** `SQL`，只是把 `ex = tx` 传进去。 */
const runListSamePath = async (tx: TxClient, input: {
  cid: number; actorUid: number; fee: number; depositAmount: number;
}): Promise<Record<string, unknown>> => DatabaseService.listCurrencyWithDeposit({
  cid: input.cid, actorUid: input.actorUid, fee: input.fee, depositAmount: input.depositAmount,
  idempotencyKey: `biz:currency:list:${input.cid}`,
  requestFingerprint: fp(['list', input.cid, input.actorUid, input.fee, input.depositAmount]),
  memo: `currency_list_deposit:${input.cid}`,
}, tx) as Promise<Record<string, unknown>>;
/** 该上市事件的 4 条分录（根键 + `#2..#4`）逐条读数。 */
const eventLegs = async (tx: TxClient, cid: number): Promise<Array<Record<string, string>>> =>
  txQuery<Record<string, string>>(tx,
    `SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, kind,
            idempotency_key
       FROM public.ledger_entry
      WHERE idempotency_key = $1::text OR idempotency_key LIKE $1::text || '#%'
      ORDER BY txid`,
    [`biz:currency:list:${cid}`]);

// ---------------------------------------------------------------- 快照（事务外 · 只读 · 逐字节）
const snapshot = async (): Promise<Record<string, unknown>> => {
  const [cfgRows, cfgAgg] = await Promise.all([
    readQuery<Record<string, unknown>>(
      `SELECT key, value::text AS value_text, updated_by::text AS updated_by, time_updated::text AS time_updated
         FROM public.app_config ORDER BY key`),
    readQuery<Record<string, string>>(
      `SELECT count(*)::int::text AS n, max(time_updated)::text AS max_updated FROM public.app_config`),
  ]);
  const [currency, ledger, account, slog, txid] = await Promise.all([
    readQuery<Record<string, string>>(
      `SELECT count(*)::int::text AS n, max(cid)::text AS max_cid, max(time_created)::text AS max_created,
              max(listed_at)::text AS max_listed_at,
              md5(string_agg(cid::text||'|'||symbol||'|'||owner_uid::text||'|'||status||'|'||
                  deposit_amount::text||'|'||deposit_cid::text||'|'||coalesce(listed_at::text,'~')||'|'||
                  time_created::text, E'\\n' ORDER BY cid)) AS digest
         FROM public.currency`),
    readQuery<Record<string, string>>(
      `SELECT count(*)::int::text AS n, max(txid)::text AS max_txid, max(time_created)::text AS max_created,
              md5(string_agg(txid::text||'|'||uid::text||'|'||cid::text||'|'||delta::text||'|'||
                  balance_after::text||'|'||kind||'|'||idempotency_key,
                  E'\\n' ORDER BY txid)) AS digest
         FROM public.ledger_entry`),
    readQuery<Record<string, string>>(
      `SELECT count(*)::int::text AS n,
              md5(string_agg(uid::text||'|'||cid::text||'|'||balance::text||'|'||frozen::text||'|'||
                  version::text, E'\\n' ORDER BY uid, cid)) AS digest
         FROM public.account`),
    readQuery<Record<string, string>>(
      `SELECT count(*)::int::text AS n, max(log_id)::text AS max_log_id FROM public.currency_status_log`),
    readQuery<Record<string, string>>(`SELECT last_value::text AS last_value FROM public.ledger_entry_txid_seq`).catch(() => [] as Record<string, string>[]),
  ]);
  return {
    app_config: { rows: cfgRows, agg: cfgAgg[0] },
    currency: currency[0], ledger_entry: ledger[0], account: account[0], status_log: slog[0],
    txid_seq_last: txid[0]?.last_value ?? null,
  };
};

// ============================================================================
(async () => {
  const out: Record<string, unknown> = {
    script: 'scripts/p8-s3-01-effective.ts', run: RUN,
    r8_18: 'R-8-18（本片）/ R-8-15（8② 立）：**全部在事务内 + 末尾 ROLLBACK**；**未跑任何生产 HTTP 写**',
    http_surfaces: {
      admin_settings_write: 'NOT_MEASURED（键级寻址线格式未冻结 ⇒ 不跑真 POST /api/admin/settings）',
      currency_list: 'NOT_MEASURED（跑真 POST /api/currency/:cid/list 会永久改线上状态 ⇒ 只走事务内同路径 DB 函数）',
    },
    anchors: ANCHORS,
    constants: {
      floor_constant: CURRENCY_LIST_DEPOSIT_FLOOR, list_fee_constant: LIST_FEE_FLOOR,
      probe_new_amount: NEW_AMOUNT, illegal_raw: ILLEGAL_RAW,
    },
  };

  // ---------------- 0) 开工基线（事务外 · 只读） ----------------
  const baseline = await snapshot();
  out.baseline = baseline;
  rec('S0-baseline-captured', 'baseline', (baseline.app_config as { agg?: unknown }).agg ? true : false,
    { app_config: baseline.app_config, currency: baseline.currency, ledger_entry: baseline.ledger_entry, account: baseline.account },
    '基线快照取不到 ⇒ 后续「回滚自证」不可信 ⇒ 判负');

  let seg: Record<string, unknown> = {};
  const txStart = Date.now();
  try {
    await withTransaction(async (tx) => {
      const A: Record<string, unknown> = {};
      // 受控夹具：**现库已出资的正 uid 账户**（cid=1 最大余额者）
      const owner = await pickOwner(tx);
      const OWNER = owner.uid;
      A.fixture = { owner_uid: String(OWNER), owner_balance_baseline: String(owner.balance), cid: '1' };
      rec('S0-owner-funded', 'baseline', owner.uid > 0 && owner.balance > LIST_FEE_FLOOR + CURRENCY_LIST_DEPOSIT_FLOOR + NEW_AMOUNT,
        { owner_uid: String(OWNER), balance: String(owner.balance), need_at_least: LIST_FEE_FLOOR + CURRENCY_LIST_DEPOSIT_FLOOR + NEW_AMOUNT },
        '出资账户不是**现库已出资**且余额不足以覆盖 改键前+改键后 两轮消耗 ⇒ ④ 不可测 ⇒ 判负');

      // ==================================================================
      // ③-before · 业务读口取数（AK2 尚不存在 ⇒ fail-closed 到常量）
      // ==================================================================
      const rawBefore = await DatabaseService.getListingDepositPolicyValue(tx);
      const floorBefore = resolveListingDepositFloor(rawBefore);
      A['3_business_read_before'] = { anchor: ANCHORS.read_port_call, raw_ak2: rawBefore, floor: floorBefore };
      judge('S3-before-fail-closed-to-constant', 'read', floorBefore,
        { floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'constant' },
        'AK2 不在库时业务读口**未** fail-closed 到兜底常量（fail-open / 取到别值）⇒ 判负');
      selfTest('S3-before-fail-closed-to-constant', 'read',
        (v) => JSON.stringify(v) === JSON.stringify({ floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'constant' }),
        { floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'config' },
        '把「常量兜底」误记为 config ⇒ 谓词必须转红');

      // ==================================================================
      // ④-before · 行为随之（改键**前**读数）
      // ==================================================================
      const cidB = 925_000_001;
      await insertDraft(tx, cidB, 'P8S3EFB1', OWNER);
      const ob0 = await bal(tx, OWNER, 1); const pb0 = await bal(tx, -1, 1);
      const listBefore = await runListSamePath(tx, { cid: cidB, actorUid: OWNER, fee: LIST_FEE_FLOOR, depositAmount: floorBefore.floor });
      const ob1 = await bal(tx, OWNER, 1); const pb1 = await bal(tx, -1, 1);
      const legsBefore = await eventLegs(tx, cidB);
      const depLegsBefore = legsBefore.filter((l) => l.kind === 'listing_deposit');
      A['4_before'] = {
        business_quantity: '上市的 `listing_deposit` **消耗额**（`draft → listed` 同路径）',
        draft_cid: String(cidB), list_reply: { cur_found: Number(listBefore.cur_found), applied: Number(listBefore.applied), cur_status: listBefore.cur_status },
        owner_balance: { before: String(ob0), after: String(ob1), decrease: String(ob0 - ob1) },
        pool_balance_minus1: { before: String(pb0), after: String(pb1), increase: String(pb1 - pb0) },
        ledger_legs: legsBefore,
        listing_deposit_legs: depLegsBefore,
        formula: `owner 减少额 = 上市费(${LIST_FEE_FLOOR}) + 保证金(${floorBefore.floor})（floor_source=${floorBefore.source}）`,
      };
      const beforeDecrease = ob0 - ob1;
      judge('S4-before-applied-1', 'behavior', Number(listBefore.applied),
        1, '同路径 DB 函数未把 `draft` 推成 `listed`（applied≠1）⇒ 判负');
      judge('S4-before-owner-decrease', 'behavior', beforeDecrease,
        LIST_FEE_FLOOR + floorBefore.floor,
        '改键**前** owner `balance` 减少额 ≠ 上市费 + 兜底常量 ⇒ 判负');
      judge('S4-before-pool-increase', 'behavior', pb1 - pb0,
        LIST_FEE_FLOOR + floorBefore.floor,
        '改键**前** `uid = -1` `balance` 增加额 ≠ owner 减少额（不守恒）⇒ 判负');
      judge('S4-before-deposit-legs', 'behavior',
        depLegsBefore.map((l) => `${l.uid}:${l.delta}`).sort(),
        [`${OWNER}:${-floorBefore.floor}`, '-1:' + String(floorBefore.floor)].sort(),
        '改键**前** `listing_deposit` 分录 ≠ {owner −floor, −1 +floor} ⇒ 判负');

      // ==================================================================
      // ① 写键（**事务内** DB 直写 AK2；**不跑 HTTP 写面**）
      // ==================================================================
      const writeRows = await txQuery<Record<string, string>>(tx,
        `INSERT INTO public.app_config (key, value, updated_by, time_updated)
         VALUES ($1::text, $2::jsonb, 0::bigint, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, time_updated = now()
         RETURNING value::text AS value_text, updated_by::text AS updated_by`,
        [LISTING_DEPOSIT_POLICY_KEY, JSON.stringify({ amount: NEW_AMOUNT })]);
      A['1_write'] = {
        surface: '事务内 DB 直写 public.app_config（HTTP 写面 = NOT_MEASURED · 键级寻址线格式未冻结）',
        table: 'public.app_config', key: LISTING_DEPOSIT_POLICY_KEY,
        rows_affected: writeRows.length, returned: writeRows[0] ?? null,
      };
      judge('S1-write-affected-1', 'write', writeRows.length, 1,
        '写键未影响任何行（INSERT/UPDATE 都 miss）⇒ 判负');
      judge('S1-write-returned-new-value', 'write',
        writeRows[0] ? JSON.parse(writeRows[0].value_text) : null, { amount: NEW_AMOUNT },
        '写口 `RETURNING` 的值 ≠ 新值 ⇒ 判负');

      // ==================================================================
      // ② 库内落值（给表 / 列）
      // ==================================================================
      const landed = (await txQuery<Record<string, string>>(tx,
        `SELECT value::text AS value_text, updated_by::text AS updated_by, time_updated::text AS time_updated
           FROM public.app_config WHERE key = $1::text`,
        [LISTING_DEPOSIT_POLICY_KEY]))[0];
      const landedVal = landed ? JSON.parse(landed.value_text) : null;
      A['2_db_landed'] = { table: 'public.app_config', columns: ['key', 'value'], row: landed ?? null };
      judge('S2-value-landed', 'landed', landedVal, { amount: NEW_AMOUNT },
        '**写成功但库值未变 ⇒ 判负**（写口返回行、库内落值却不等于新值）');
      selfTest('S2-value-landed', 'landed',
        (v) => JSON.stringify(v) === JSON.stringify({ amount: NEW_AMOUNT }), { amount: NEW_AMOUNT + 1 },
        '写成功但库列未变 ⇒ 判负');
      const keySet = (await txQuery<Record<string, string>>(tx,
        `SELECT key FROM public.app_config ORDER BY key`)).map((r) => r.key);
      judge('S2-key-set-is-2', 'landed', keySet, ['listing_deposit_policy', 'system_settings'],
        '`app_config` 顶层键集 ≠ {AK1, AK2}（恰 2 键）⇒ 判负');
      const ak1After = (await txQuery<Record<string, string>>(tx,
        `SELECT value::text AS value_text FROM public.app_config WHERE key = 'system_settings'`))[0];
      const ak1Base = (baseline.app_config as { rows: Array<Record<string, string>> }).rows
        .find((r) => r.key === 'system_settings');
      judge('S2-ak1-untouched', 'landed', ak1After ? ak1After.value_text : null,
        ak1Base ? ak1Base.value_text : null,
        '写 `AK2` 顺带改了 `AK1`（`system_settings` 值漂移）⇒ 判负');

      // ==================================================================
      // ③-after · 业务读口取数（AK2 已落 ⇒ 用键值）
      // ==================================================================
      const rawAfter = await DatabaseService.getListingDepositPolicyValue(tx);
      const floorAfter = resolveListingDepositFloor(rawAfter);
      A['3_business_read_after'] = { anchor: ANCHORS.read_port_call, raw_ak2: rawAfter, floor: floorAfter };
      judge('S3-after-uses-config', 'read', floorAfter, { floor: NEW_AMOUNT, source: 'config' },
        '业务读口**取不到**新键值（仍回落常量 / 取到别值）⇒ 判负');
      judge('S3-parse-no-invention', 'read', parseListingDepositPolicyAmount(rawAfter), NEW_AMOUNT,
        '读侧解析与落值不等（隐式转换 / 发明数值）⇒ 判负');
      selfTest('S3-after-uses-config', 'read',
        (v) => JSON.stringify(v) === JSON.stringify({ floor: NEW_AMOUNT, source: 'config' }),
        { floor: NEW_AMOUNT, source: 'constant' },
        '读口仍走常量 ⇒ 谓词必须转红');

      // ==================================================================
      // ④-after · 行为随之（改键**后**读数）
      // ==================================================================
      const cidA = 925_000_002;
      await insertDraft(tx, cidA, 'P8S3EFA1', OWNER);
      const oa0 = await bal(tx, OWNER, 1); const pa0 = await bal(tx, -1, 1);
      const listAfter = await runListSamePath(tx, { cid: cidA, actorUid: OWNER, fee: LIST_FEE_FLOOR, depositAmount: floorAfter.floor });
      const oa1 = await bal(tx, OWNER, 1); const pa1 = await bal(tx, -1, 1);
      const legsAfter = await eventLegs(tx, cidA);
      const depLegsAfter = legsAfter.filter((l) => l.kind === 'listing_deposit');
      A['4_after'] = {
        business_quantity: '上市的 `listing_deposit` **消耗额**（改键后）',
        draft_cid: String(cidA), list_reply: { cur_found: Number(listAfter.cur_found), applied: Number(listAfter.applied), cur_status: listAfter.cur_status },
        owner_balance: { before: String(oa0), after: String(oa1), decrease: String(oa0 - oa1) },
        pool_balance_minus1: { before: String(pa0), after: String(pa1), increase: String(pa1 - pa0) },
        ledger_legs: legsAfter,
        listing_deposit_legs: depLegsAfter,
        formula: `owner 减少额 = 上市费(${LIST_FEE_FLOOR}) + 保证金(${floorAfter.floor})（floor_source=${floorAfter.source}）`,
      };
      const afterDecrease = oa0 - oa1;
      judge('S4-after-applied-1', 'behavior', Number(listAfter.applied), 1,
        '改键后同路径 DB 函数未把 `draft` 推成 `listed`（applied≠1）⇒ 判负');
      judge('S4-after-owner-decrease', 'behavior', afterDecrease, LIST_FEE_FLOOR + NEW_AMOUNT,
        '改键**后** owner `balance` 减少额 ≠ 上市费 + 新键值 ⇒ 判负');
      judge('S4-after-pool-increase', 'behavior', pa1 - pa0, LIST_FEE_FLOOR + NEW_AMOUNT,
        '改键**后** `uid = -1` `balance` 增加额 ≠ owner 减少额（不守恒）⇒ 判负');
      judge('S4-after-deposit-legs', 'behavior',
        depLegsAfter.map((l) => `${l.uid}:${l.delta}`).sort(),
        [`${OWNER}:${-NEW_AMOUNT}`, `-1:${NEW_AMOUNT}`].sort(),
        '改键**后** `listing_deposit` 分录 ≠ {owner −新值, −1 +新值} ⇒ 判负');

      // ★★ 核心 AC：两读数必须不同且逐值可算
      A['4_two_readings'] = {
        before: { floor: floorBefore.floor, floor_source: floorBefore.source, owner_decrease: String(beforeDecrease) },
        after: { floor: floorAfter.floor, floor_source: floorAfter.source, owner_decrease: String(afterDecrease) },
        delta: String(afterDecrease - beforeDecrease), delta_expected: String(NEW_AMOUNT - CURRENCY_LIST_DEPOSIT_FLOOR),
      };
      judge('S4-two-readings-differ', 'behavior', beforeDecrease !== afterDecrease, true,
        '同一夹具下改键前后 `listing_deposit` 消耗额**相等** ⇒ 键不生效 ⇒ 判负');
      selfTest('S4-two-readings-differ', 'behavior',
        (v) => v !== beforeDecrease, beforeDecrease, '改键前后消耗额相等 ⇒ 谓词必须转红');
      judge('S4-two-readings-computable', 'behavior',
        { before: beforeDecrease === LIST_FEE_FLOOR + CURRENCY_LIST_DEPOSIT_FLOOR, after: afterDecrease === LIST_FEE_FLOOR + NEW_AMOUNT },
        { before: true, after: true },
        '两读数非「上市费 + 各自下限」逐值可算 ⇒ 判负');

      // ==================================================================
      // ③-负向 · fail-closed 验证（写**非法**值 ⇒ 必须回落常量）
      // ==================================================================
      await txQuery(tx,
        `INSERT INTO public.app_config (key, value, updated_by, time_updated)
         VALUES ($1::text, $2::jsonb, 0::bigint, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, time_updated = now()`,
        [LISTING_DEPOSIT_POLICY_KEY, JSON.stringify(ILLEGAL_RAW)]);
      const rawIllegal = await DatabaseService.getListingDepositPolicyValue(tx);
      const floorIllegal = resolveListingDepositFloor(rawIllegal);
      A['3_fail_closed_illegal'] = { raw_ak2: rawIllegal, floor: floorIllegal, anchor: ANCHORS.read_port_def };
      judge('S3-illegal-fail-closed', 'read', floorIllegal,
        { floor: CURRENCY_LIST_DEPOSIT_FLOOR, source: 'constant' },
        '库内 `AK2` 值为**非法**（字符串型金额）时读口**未** fail-closed 到常量 ⇒ 判负');
      // 负向段的行为面：同样必须用**常量**（证明 fail-closed 真的传到行为）
      const cidN = 925_000_003;
      await insertDraft(tx, cidN, 'P8S3EFN1', OWNER);
      const on0 = await bal(tx, OWNER, 1);
      await runListSamePath(tx, { cid: cidN, actorUid: OWNER, fee: LIST_FEE_FLOOR, depositAmount: floorIllegal.floor });
      const on1 = await bal(tx, OWNER, 1);
      A['4_fail_closed_behavior'] = { owner_decrease: String(on0 - on1), floor_used: floorIllegal.floor };
      judge('S4-fail-closed-behavior', 'behavior', on0 - on1, LIST_FEE_FLOOR + CURRENCY_LIST_DEPOSIT_FLOOR,
        '非法键值下行为面**未**用兜底常量（fail-open 到库里的坏值）⇒ 判负');
      selfTest('S4-fail-closed-behavior', 'behavior',
        (v) => v === LIST_FEE_FLOOR + CURRENCY_LIST_DEPOSIT_FLOOR, LIST_FEE_FLOOR + NEW_AMOUNT,
        '非法键值下行为面未回落常量 ⇒ 判负');

      seg = A;
      throw new RollbackSentinel('SEG_MAIN');
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
    seg.rollback = { sentinel: (e as RollbackSentinel).tag, committed: false, sql: 'withTransaction 回调抛哨兵 ⇒ catch ⇒ ROLLBACK（无 COMMIT）', tx_elapsed_ms: Date.now() - txStart };
  }
  out.segment = seg;

  // ============================================================================
  // 回滚自证（事务外 · 只读）：库面必须与开工基线**逐字节相同**
  // ============================================================================
  await new Promise((r) => setTimeout(r, 400));
  const after = await snapshot();
  out.post_rollback = after;
  const bs = baseline as Record<string, any>;
  const as = after as Record<string, any>;
  judge('ROLLBACK-app_config-identical', 'rollback',
    JSON.stringify(as.app_config.rows), JSON.stringify(bs.app_config.rows),
    '回滚后 `app_config` 行集（key/value/updated_by/time_updated）与开工基线不逐字节相同 ⇒ 判负（**写已外泄**）');
  judge('ROLLBACK-currency-digest-identical', 'rollback',
    [as.currency.n, as.currency.max_cid, as.currency.digest], [bs.currency.n, bs.currency.max_cid, bs.currency.digest],
    '回滚后 `currency` 行数/最大 cid/逐行摘要与基线不同 ⇒ 判负（**draft 币行已落库**）');
  judge('ROLLBACK-ledger-digest-identical', 'rollback',
    [as.ledger_entry.n, as.ledger_entry.max_txid, as.ledger_entry.digest], [bs.ledger_entry.n, bs.ledger_entry.max_txid, bs.ledger_entry.digest],
    '回滚后 `ledger_entry` 行数/最大 txid/逐行摘要与基线不同 ⇒ 判负（**分录已落库**）');
  judge('ROLLBACK-account-digest-identical', 'rollback',
    [as.account.n, as.account.digest], [bs.account.n, bs.account.digest],
    '回滚后 `account` 余额/冻结/version 与基线不同 ⇒ 判负（**余额已变动**）');
  judge('ROLLBACK-status-log-identical', 'rollback',
    as.status_log, bs.status_log,
    '回滚后 `currency_status_log` 行数/最大 log_id 与基线不同 ⇒ 判负（**审计行已落库**）');
  judge('ROLLBACK-timestamps-not-advanced', 'rollback',
    {
      app_config_max_updated: as.app_config.agg.max_updated === bs.app_config.agg.max_updated,
      currency_max_created: as.currency.max_created === bs.currency.max_created,
      currency_max_listed_at: as.currency.max_listed_at === bs.currency.max_listed_at,
      ledger_max_created: as.ledger_entry.max_created === bs.ledger_entry.max_created,
    },
    { app_config_max_updated: true, currency_max_created: true, currency_max_listed_at: true, ledger_max_created: true },
    '回滚后 `max(time_updated)` / `max(time_created)` / `max(listed_at)` 类时间戳**前移** ⇒ 判负');
  judge('ROLLBACK-no-commit', 'rollback',
    JSON.stringify((seg.rollback as Record<string, unknown> | undefined)?.committed), JSON.stringify(false),
    '`rollback.committed !== false`（疑似走了 COMMIT 路径）⇒ 判负');

  // ---------------------------------------------------------------- 结论
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S3-EFFECTIVE', run: RUN, generated_at: new Date().toISOString(),
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    rollback_discipline: 'R-8-18 / R-8-15：四段 + fail-closed 负向段**全部**在同一 `withTransaction` 内，末尾哨兵 ⇒ ROLLBACK（无 COMMIT / 无 HTTP 写）',
    http_surfaces: out.http_surfaces,
    readings: {
      baseline_owner: seg.fixture, before: (seg['4_two_readings'] as any)?.before, after: (seg['4_two_readings'] as any)?.after,
      floor_constant: CURRENCY_LIST_DEPOSIT_FLOOR, list_fee_constant: LIST_FEE_FLOOR, probe_new_amount: NEW_AMOUNT,
    },
    out, checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'effective.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'effective.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('PROBE_CRASHED', String((e as Error)?.stack || e).slice(0, 1600));
  await closePools().catch(() => undefined);
  process.exit(2);
});
