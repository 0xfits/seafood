/**
 * P2C-00 · 「33 码全量往返闭合测试」（**本单的主要交付物**）
 * ============================================================================
 * 依据（权威口径）：
 *   `docs/seafood.master-plan.md` §5.22「裁定 2」——
 *     `ledger_error_for_sqlstate(ledger_sqlstate_of(name))` 必须**回到同名**，
 *     且 bucket 必须满足冻结的 `bucket↔状态类` 映射；
 *     断言 `roundtrip_mismatches = 0` / `unknown_codes = 0` / `bucket_violations = 0`。
 *   `docs/ledger.spec.md` §14.3 附（bucket 纪律冻结，S1）——
 *     `input ⇒ 400 类` / `integrity ⇒ 400|404|409（绝不 500）` / `retryable|infra ⇒ 503` /
 *     `defect ⇒ 500` ⇒ 追加判据「500 类码只可能来自 defect 桶」。
 *   `docs/ledger.spec.md` §14.1（33 码关闭集，R104/R105/R106）。
 *
 * 为什么要有这支脚本（诚实口径，逐字引用裁定 3）：
 *   P1 自证过的只是「**正向映射有 33 条**」（名 → SQLSTATE），**从未自证「反向映射也有 33 条」**
 *   （SQLSTATE → 名）。`0007` 的佣金守恒断言是人类**第一次真正抛 `LD032`**，缺口才暴露。
 *   ⇒ 凡双向映射，**单向自证不算闭合**；本脚本即那条「全量往返闭合断言」，并作为回归套件固定项。
 *
 * ---------------------------------------------------------------- 判据（四条硬判据 + 交叉项）
 *   ① `roundtrip_mismatches`  = Σ [ `ledger_error_for_sqlstate(ledger_sqlstate_of(name)).code ≠ name` ]
 *   ② `unknown_codes`         = 正向映射为 NULL 的码数 + DB 反向映射里「名不在 TS 关闭集」的项数
 *   ③ `bucket_violations`     = 复合计数（**任一子项非零即非零**）：
 *        · DB bucket 不在五值闭集 {input,integrity,retryable,infra,defect}
 *        · **冻结映射**违例（status ∈ {400,404,409,500,503} 的码，逐条用严格公式对拍，**不放宽**）
 *        · **扩展项**违例（status ∉ 冻结覆盖面的码：见下方「扩展」段，逐条按档位对拍）
 *        · **两侧不一致**（DB 桶 ≠ JS 侧由 `LEDGER_ERROR_TABLE` 状态派生的桶）
 *        · `retryable` 标志与桶不自洽（`retryable ≠ bucket ∈ {retryable,infra}`）
 *        ⚠️ **`benign_outcomes` 一类的码不参与上述任何「bucket↔状态类」校验**（见下），
 *           但**仍**参与 ① 往返闭合 / ② 未知码 / 两侧一致 / `retryable` 自洽 —— 只豁免「状态类」这一维。
 *   ④ `null_status_defect`    = defect 桶码中 `(LEDGER_ERROR_TABLE[code].status ?? 500) ≠ 500` 的项数
 *   ⑤ `benign_outcomes`       = **良性结果码**类（本单新增；master-plan §5.23）：
 *        `LD006 = LEDGER_IDEMPOTENCY_REPLAY` 是 **200**，它是**良性结果**（R106：调用方重复提交，
 *        永不进错误分支）⇒ **单列一类、不参与 bucket↔状态类校验**；`bucket` 字段**仍记 `'input'`**
 *        （= input 起源的良性结果，与**已应用**的 `0009` 的 DB 侧逐字一致）。
 *        计数字段：`count`（码数）/ `excluded_from_bucket_class_validation`（被排除出校验的码数），
 *        断言「**不参与校验的码数 = 1**」且良性码的 DB 桶/JS 桶**仍是 `input`**（防「为了让校验变绿去改桶」）。
 *
 *   ⚠️ **冻结映射的真实覆盖面不完整（本单登记的既有事实，非本脚本放宽断言）**：
 *     §14.1 的状态集含 `403`（LD014/LD015）、`423`（LD009）、`200`（LD006）、`null`（LD032），
 *     冻结的 `bucket↔状态类` 四条一个都没覆盖 ⇒ 任何分桶都必然「超出冻结面」。处置**分两种**（不得混为一谈）：
 *       · **扩展档位**（真的是一条「状态类 ⇒ 桶」映射，逐条留痕供追认）：
 *         `403` ⇒ `input`     （权限不足 = 调用方身份不对；非完整性、非状态冲突）
 *         `423` ⇒ `integrity` （资源被锁定 = 合规冻结，R105 把「币种状态」归 409 语义族）
 *         `null`（LD032）⇒ `defect` ⇒ `status ?? 500` ⇒ `500`（**响应层兜底规则**，见 ledger-errors.ts）
 *       · **良性结果**（**`200` 不是错误类** ⇒ 单列 `benign_outcomes`，**不做**状态类映射、**不进**
 *         `EXTENSION_STATUS_BUCKET`）：`LD006` 一个码。它此前被硬塞成扩展档位 `200 ⇒ input`，
 *         §5.23 已改判 ⇒ 本脚本按改判执行（**改的是期望模型，不是 DB**；`0009` 已应用，改它就是撒谎态）。
 *     ⇒ 覆盖内的码走**严格冻结公式**（`frozen_map_violations`），覆盖外的码走**扩展档位**
 *     （`extension_violations`），良性码走**豁免**（`benign_outcomes`），三者互补且**互不重叠**。
 *     **没有任何一条断言被放宽或跳过** —— 良性码的豁免是**逐码白名单**（当前 1 个码），
 *     且「良性命中数」本身是被断言的对象（非 1 即红 ⇒ 白名单被悄悄扩大会立刻变红）。
 *
 * ---------------------------------------------------------------- 用法 / 落盘
 *   cd backend-ts
 *   npx ts-node --transpile-only scripts/p2c-00-code-roundtrip.ts --phase before
 *   npx ts-node --transpile-only scripts/p2c-00-code-roundtrip.ts --phase after --assert
 * 落盘：`backend-ts/.p2c-artifacts/p2c-00-roundtrip-<phase>-<RUN>.json`
 *   —— **run-tagged，永不写固定文件名**（固定名会被复跑静默覆盖 ⇒ 读数不可回溯）；
 *      `--phase before` 的基线必须由**同一份终版脚本**产出（本脚本头部即终版，先跑基线后改实现）。
 *
 * ---------------------------------------------------------------- 本脚本不做 / 不碰
 *   · **只读**：不改任何表、不建测试数据（无 `uid` / `symbol` / 幂等键消耗）；
 *     对 LD032 的端到端取证用**合成错误对象**喂 TS 映射（与 `p2b-01` 的 F 组同法）。
 *   · 不改任何产品代码 / 迁移 / 质检资产；不 commit。
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { mkPool, raw } from './p1f-lib';
import { LEDGER_ERROR_TABLE, LEDGER_ERROR_CODES, LEDGER_BENIGN_CODES } from '../src/ledger-errors';
import { LEDGER_SQLSTATE_TO_CODE, ledgerErrorFromDbError } from '../src/ledger';

// ============================================================================
// 0. 运行参数 / run tag
// ============================================================================
const phaseArg = ((): string => {
  const i = process.argv.indexOf('--phase');
  const v = i >= 0 ? process.argv[i + 1] : '';
  return ['before', 'after'].includes(v) ? v : 'unspecified';
})();
const assertMode = process.argv.includes('--assert');
const RUN = Date.now().toString(36).toUpperCase();
const ART_DIR = path.resolve(__dirname, '..', '.p2c-artifacts');
const ART_FILE = path.join(ART_DIR, `p2c-00-roundtrip-${phaseArg}-${RUN}.json`);

const md5 = (rel: string): string => {
  const p = path.resolve(__dirname, '..', rel);
  return fs.existsSync(p) ? crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex') : 'ABSENT';
};

// ============================================================================
// 1. 冻结映射（**逐字**照抄 ledger.spec §14.3 附 / 0005 §C 抬头）与最小扩展
// ============================================================================

/** 冻结：`bucket ⇒ 允许的 §14.1 状态`（覆盖内逐条严格对拍，不放宽） */
const FROZEN_BUCKET_STATUS: Record<string, number[]> = {
  input: [400],
  integrity: [400, 404, 409],
  retryable: [503],
  infra: [503],
  defect: [500],
};
const BUCKET_CLOSED_SET = Object.keys(FROZEN_BUCKET_STATUS);

/**
 * 最小扩展档位（仅在 status ∉ 冻结覆盖面时生效）：`status ⇒ 桶`。
 * 依据与理由见文件头「扩展」段；`null` = LD032 由「响应层 status ?? 500」兜底成 500 ⇒ defect。
 * ⚠️ **`200` 已从本表移除**（master-plan §5.23 改判）：`LD006 = LEDGER_IDEMPOTENCY_REPLAY` 是
 *    **良性结果**，单列 `benign_outcomes` 一类、**不参与** bucket↔状态类校验
 *    ⇒ 它若仍留在此处，就是把「不是错误类的东西」当成一条状态类映射来对拍（语义错）。
 *    豁免是**逐码**的（`LEDGER_BENIGN_CODES`），不是「凡 200 都免检」。
 */
const EXTENSION_STATUS_BUCKET: Record<string, string> = {
  '403': 'input',    // 权限不足（调用方身份不对）
  '423': 'integrity', // 资源被锁定（合规冻结，R105 的「币种状态」族）
  null: 'defect',    // LD032 对账不符（实现缺陷，R108 必告警）；HTTP 层 status ?? 500
};

/**
 * **良性结果码**（`benign_outcomes`）—— 真源 = TS 侧 `LEDGER_BENIGN_CODES`（**单一来源，不在此另抄一份**）。
 * 这些码：① 仍走往返闭合 / 未知码 / 两侧一致 / `retryable` 自洽；② **跳过** bucket↔状态类校验
 * （既不查冻结公式，也不查扩展档位）⇒ `frozen_ok = extension_ok = null`、`bucket_class_validated = false`。
 */
const BENIGN_CODES: readonly string[] = LEDGER_BENIGN_CODES as readonly string[];
const isBenignCode = (name: string): boolean => BENIGN_CODES.includes(name);

/** 冻结覆盖面 = 允许状态的全集（用于判定某个 status 是否「覆盖内」） */
const FROZEN_COVERED_STATUSES = new Set<number>(
  Object.values(FROZEN_BUCKET_STATUS).flat(),
);

/** JS 侧桶语义（真源 = TS 的 `LEDGER_ERROR_TABLE[code].status` + 下方按码表；`via` 标出该码走冻结面还是扩展档） */
const jsBucketOf = (code: string): { bucket: string | null; via: 'frozen' | 'extension' | 'uncovered' } => {
  const status = (LEDGER_ERROR_TABLE as Record<string, { status: number | null }>)[code]?.status ?? null;
  const b = JS_CODE_TO_BUCKET[code];
  if (!b) return { bucket: null, via: 'uncovered' };
  const via: 'frozen' | 'extension' = (status !== null && FROZEN_COVERED_STATUSES.has(status)) ? 'frozen' : 'extension';
  return { bucket: b, via };
};

// ============================================================================
// 2. §14.1 33 码 → 桶（**按码定死**，与 0009 迁移的 LD0nn 分支**逐条同值**）
// ---------------------------------------------------------------------------
// 取值规则（逐条可复核）：由该码的 §14.1 状态按「冻结映射 / 最小扩展」派生 ——
//   400 ⇒ input；403 ⇒ input（扩展）；404/409 ⇒ integrity；423 ⇒ integrity（扩展）；
//   500 ⇒ defect；503 ⇒ retryable；200 ⇒ input（扩展，R106 非错误）；null ⇒ defect（扩展，响应层 ?? 500）
// 两侧一致性由本脚本第 5 节逐条对拍（DB 桶 vs 本表），漂移即 `bucket_violations`。
// ============================================================================
const JS_CODE_TO_BUCKET: Record<string, string> = {
  LEDGER_INSUFFICIENT_BALANCE: 'integrity',
  LEDGER_INSUFFICIENT_FROZEN: 'integrity',
  LEDGER_IDEMPOTENCY_CONFLICT: 'integrity',
  LEDGER_IDEMPOTENCY_KEY_REQUIRED: 'input',
  LEDGER_IDEMPOTENCY_KEY_INVALID: 'input',
  LEDGER_IDEMPOTENCY_REPLAY: 'input',
  LEDGER_CURRENCY_NOT_FOUND: 'integrity',
  LEDGER_CURRENCY_NOT_LISTED: 'integrity',
  LEDGER_CURRENCY_FROZEN: 'integrity',
  LEDGER_CURRENCY_DELISTED: 'integrity',
  LEDGER_CURRENCY_INVALID_TRANSITION: 'integrity',
  LEDGER_CURRENCY_MISMATCH: 'input',
  LEDGER_SUPPLY_CAP_EXCEEDED: 'integrity',
  LEDGER_UNAUTHORIZED_MINT: 'input',
  LEDGER_HOLD_NOT_ALLOWED: 'input',
  LEDGER_AMOUNT_INVALID: 'input',
  LEDGER_AMOUNT_NOT_POSITIVE: 'input',
  LEDGER_DECIMALS_OVERFLOW: 'input',
  LEDGER_SELF_TRANSFER: 'input',
  LEDGER_ACCOUNT_NOT_FOUND: 'integrity',
  LEDGER_RESERVED_UID: 'input',
  LEDGER_REF_NOT_FOUND: 'integrity',
  LEDGER_UNKNOWN_KIND: 'input',
  LEDGER_TRANSACTION_REQUIRED: 'defect',
  LEDGER_LOCK_TIMEOUT: 'retryable',
  LEDGER_TX_TIMEOUT: 'retryable',
  LEDGER_DEADLOCK_RETRY_EXHAUSTED: 'retryable',
  LEDGER_NEGATIVE_BALANCE_GUARD: 'defect',
  LEDGER_APPEND_ONLY_VIOLATION: 'defect',
  LEDGER_ACCOUNT_GUARD_VIOLATION: 'defect',
  LEDGER_FEE_RATE_INVALID: 'defect',
  LEDGER_RECONCILE_MISMATCH: 'defect',
  LEDGER_CURRENCY_SYMBOL_TAKEN: 'integrity',
};

interface Row {
  name: string;                            // §14.1 码名
  sqlstate: string | null;                 // 正向映射
  db_code: string | null;                  // 反向映射的码名
  db_bucket: string | null;                // 反向映射的桶
  db_reason: string | null;                // 反向映射的 reason
  db_retryable: boolean | null;
  ts_reverse_code: string | null;          // TS 侧反向表（LEDGER_SQLSTATE_TO_CODE）
  ts_status: number | null;                // TS 侧状态（LEDGER_ERROR_TABLE）
  js_bucket: string | null;                // JS 侧派生桶
  benign: boolean;                         // 良性结果码（200，benign_outcomes）⇒ 豁免「状态类」校验
  bucket_class_validated: boolean;         // 是否参与了 bucket↔状态类校验（良性码 = false）
  roundtrip_ok: boolean;
  frozen_ok: boolean | null;               // 覆盖内严格公式；覆盖外 = null
  extension_ok: boolean | null;            // 覆盖外扩展档位；覆盖内 = null
  sides_agree: boolean;
  retryable_ok: boolean;
  defects: string[];
}

(async () => {
  fs.mkdirSync(ART_DIR, { recursive: true });
  const pool = mkPool(2);

  const names = LEDGER_ERROR_CODES as string[];
  const states = await raw<{ p_code: string; st: string | null }>(pool,
    `SELECT p_code AS p_code, ledger_sqlstate_of(p_code) AS st FROM unnest($1::text[]) AS p_code`,
    [names]);
  const forward = new Map<string, string | null>(states.map((r) => [r.p_code, r.st]));

  // 正向表的**全量**内容（用于反查：有没有「正向有、TS 关闭集没有」的码）
  const dbForwardAll = await raw<{ p_code: string; st: string | null }>(pool,
    `SELECT p.p_code, ledger_sqlstate_of(p.p_code) AS st
       FROM unnest(ARRAY['LD001','LD002','LD003','LD004','LD005','LD006','LD007','LD008','LD009','LD010',
                         'LD011','LD012','LD013','LD014','LD015','LD016','LD017','LD018','LD019','LD020',
                         'LD021','LD022','LD023','LD024','LD025','LD026','LD027','LD028','LD029','LD030',
                         'LD031','LD032','LD033']::text[]) AS p(p_code)`);
  const dbForwardStateSet = new Set(dbForwardAll.map((r) => String(r.st)));

  const rows: Row[] = [];
  const unknown: string[] = [];

  for (const name of names) {
    const sqlstate = forward.get(name) ?? null;
    const status = (LEDGER_ERROR_TABLE as Record<string, { status: number | null }>)[name]?.status ?? null;
    const derived = jsBucketOf(name);
    const row: Row = {
      name, sqlstate, db_code: null, db_bucket: null, db_reason: null, db_retryable: null,
      ts_reverse_code: LEDGER_SQLSTATE_TO_CODE[sqlstate ?? ''] ?? null,
      ts_status: status, js_bucket: derived.bucket,
      benign: isBenignCode(name), bucket_class_validated: false,
      roundtrip_ok: false, frozen_ok: null, extension_ok: null, sides_agree: false, retryable_ok: false,
      defects: [],
    };
    if (!sqlstate) {
      unknown.push(`${name}: 正向映射为 NULL（关闭集内码无 SQLSTATE 投影）`);
      row.defects.push('forward_missing');
      rows.push(row);
      continue;
    }

    const cls = (await raw<{ j: Record<string, unknown> }>(pool,
      `SELECT ledger_error_for_sqlstate($1::text) AS j`, [sqlstate]))[0]?.j;
    const code = String(cls?.code ?? '');
    const bucket = String(cls?.bucket ?? '');
    const reason = String(cls?.reason ?? '');
    const retryable = cls?.retryable === true;
    row.db_code = code; row.db_bucket = bucket; row.db_reason = reason; row.db_retryable = retryable;

    // ① 往返闭合
    row.roundtrip_ok = code === name;
    if (!row.roundtrip_ok) row.defects.push(`roundtrip: ${name} → ${sqlstate} → ${code}`);
    if (reason === 'unclassified_db_error') row.defects.push('reason=unclassified_db_error（兜底漏配）');
    if (!reason) row.defects.push('reason 为空');
    // ② TS 侧反向表
    if (row.ts_reverse_code !== name) {
      row.defects.push(`ts_reverse: ${sqlstate} → ${row.ts_reverse_code}（期望 ${name}）`);
    }
    // ③ 桶：闭集 + 冻结公式（覆盖内）/ 扩展档位（覆盖外）
    if (!BUCKET_CLOSED_SET.includes(bucket)) {
      row.defects.push(`bucket 不在闭集: ${bucket}`);
      row.frozen_ok = false; row.extension_ok = false;
      row.sides_agree = bucket === derived.bucket;
      row.retryable_ok = false;
      rows.push(row);
      continue;
    }
    if (status !== null && FROZEN_COVERED_STATUSES.has(status)) {
      row.frozen_ok = (FROZEN_BUCKET_STATUS[bucket] ?? []).includes(status);
      row.extension_ok = null;
      row.bucket_class_validated = true;
    } else if (row.benign) {
      // 良性结果（200，benign_outcomes）：**不参与** bucket↔状态类校验（master-plan §5.23）
      // 既不算冻结公式，也不算扩展档位 —— 两项都记 null 以示「未校验」（不是「校验通过」）。
      row.frozen_ok = null;
      row.extension_ok = null;
      row.bucket_class_validated = false;
    } else {
      row.extension_ok = EXTENSION_STATUS_BUCKET[String(status)] === bucket;
      row.frozen_ok = null;
      row.bucket_class_validated = true;
    }
    if (row.frozen_ok === false) row.defects.push(`frozen_map: status=${status} bucket=${bucket}`);
    if (row.extension_ok === false) {
      row.defects.push(`extension: status=${status} bucket=${bucket}（期望 ${EXTENSION_STATUS_BUCKET[String(status)]}）`);
    }
    // ④ 两侧一致 + retryable 自洽
    row.sides_agree = derived.bucket === bucket;
    if (!row.sides_agree) row.defects.push(`sides: db=${bucket} js=${derived.bucket}`);
    row.retryable_ok = retryable === (bucket === 'retryable' || bucket === 'infra');
    if (!row.retryable_ok) row.defects.push(`retryable 标志与桶不自洽: ${bucket}/${retryable}`);
    rows.push(row);
  }

  // ---------- 未知码（反向表的全量定义域抽样：LD001..LD033 之外不得被映射成关闭集内码）----------
  const strayStates = ['LD000', 'LD034', 'LD999', 'ld032', 'LD032 '];
  const strayOut = await raw<{ s: string; j: Record<string, string> }>(pool,
    `SELECT s, ledger_error_for_sqlstate(s) AS j FROM unnest($1::text[]) AS s`, [strayStates]);
  for (const r of strayOut) {
    const st = String(r.s);
    const inDomain = dbForwardStateSet.has(st);
    if (!inDomain && ['LD000', 'LD034', 'ld032', 'LD032 '].includes(st) && String(r.j?.bucket) !== 'defect') {
      unknown.push(`域外输入 ${JSON.stringify(st)} 未落 defect 兜底桶（bucket=${r.j?.bucket}）`);
    }
  }

  // ---------- 物理取证：LD031 / LD032 / LD033 逐条真实读数（修前 / 修后对照用）----------
  const literal = await raw<{ s: string; j: Record<string, unknown> }>(pool,
    `SELECT s, ledger_error_for_sqlstate(s) AS j
       FROM unnest(ARRAY['LD031','LD032','LD033']::text[]) AS s ORDER BY s`);
  const literalReadings = Object.fromEntries(literal.map((r) => [r.s, r.j]));

  // ---------- 响应层兜底 / 端到端 TS 映射取证（合成错误对象，不写库）----------
  const tsE2e: Record<string, unknown> = {};
  for (const [state, msg] of [['LD031', 'LEDGER_FEE_RATE_INVALID'], ['LD032', 'LEDGER_RECONCILE_MISMATCH'],
    ['LD033', 'LEDGER_CURRENCY_SYMBOL_TAKEN']] as Array<[string, string]>) {
    const le = ledgerErrorFromDbError({ code: state, message: msg, detail: '{"reason":"SYNTHETIC_PROBE"}' });
    tsE2e[state] = le
      ? { code: le.code, status: le.status, status_or_500: le.status ?? 500, details: le.details }
      : null;
  }
  // TS 侧桶资产（修后新增；修前 absent ⇒ 计数为「未就绪」，不静默跳过）
  const mod = (await import('../src/ledger-errors')) as Record<string, unknown>;
  const asset = mod.LEDGER_ERROR_BUCKETS as Record<string, string> | undefined;
  // 良性结果码资产（本单新增；缺席 ⇒ 断言失败，不静默跳过）
  const benignAsset = mod.LEDGER_BENIGN_CODES as readonly string[] | undefined;
  const benignAssetMismatch: string[] = [];
  if (benignAsset) {
    // 资产必须与脚本内用于豁免的名单**逐字一致**（单一来源：这里只是复核，不是另抄）
    if (JSON.stringify([...benignAsset]) !== JSON.stringify([...BENIGN_CODES])) {
      benignAssetMismatch.push(`asset=${JSON.stringify([...benignAsset])} used=${JSON.stringify([...BENIGN_CODES])}`);
    }
    // 资产里的每个码必须真的存在，且其 §14.1 状态 = 200（否则「良性」名不副实）
    for (const c of benignAsset) {
      const st = (LEDGER_ERROR_TABLE as Record<string, { status: number | null }>)[c]?.status ?? null;
      if (st !== 200) benignAssetMismatch.push(`${c}: status=${st}（良性码应为 200）`);
    }
  }
  const assetMismatch: string[] = [];
  if (asset) {
    for (const r of rows) {
      if (asset[r.name] !== r.js_bucket) assetMismatch.push(`${r.name}: asset=${asset[r.name]} derived=${r.js_bucket}/${r.db_bucket}`);
    }
  }
  const httpStatusOf = mod.httpStatusOf as ((c: string) => number) | undefined;
  const httpStatusProbe = httpStatusOf
    ? { LD032: httpStatusOf('LEDGER_RECONCILE_MISMATCH'), LD031: httpStatusOf('LEDGER_FEE_RATE_INVALID'),
        LD033: httpStatusOf('LEDGER_CURRENCY_SYMBOL_TAKEN'),
        // 良性结果码：**恒 200**（R106；不得落 500 兜底）—— 本单新增取证
        [`LD006:${BENIGN_CODES.join(',')}`]: BENIGN_CODES.map((c) => ({ code: c, httpStatus: httpStatusOf(c) })) }
    : null;

  // ============================================================================
  // 3. 汇总（四条硬判据 + 交叉项）
  // ============================================================================
  const roundtripMismatches = rows.filter((r) => !r.roundtrip_ok).map((r) => `${r.name}(${r.sqlstate})→${r.db_code}`);
  const reasonStale = rows.filter((r) => r.db_reason === 'unclassified_db_error' || !r.db_reason).map((r) => r.name);
  const frozenViolations = rows.filter((r) => r.frozen_ok === false).map((r) => `${r.name}:${r.ts_status}/${r.db_bucket}`);
  const extensionViolations = rows.filter((r) => r.extension_ok === false).map((r) => `${r.name}:${r.ts_status}/${r.db_bucket}`);
  const sidesViolations = rows.filter((r) => !r.sides_agree).map((r) => `${r.name}:db=${r.db_bucket}/js=${r.js_bucket}`);
  const retryableViolations = rows.filter((r) => !r.retryable_ok).map((r) => r.name);
  const bucketClosedSetViolations = rows.filter((r) => !BUCKET_CLOSED_SET.includes(String(r.db_bucket))).map((r) => `${r.name}:${r.db_bucket}`);
  const tsReverseViolations = rows.filter((r) => r.ts_reverse_code !== r.name).map((r) => `${r.name}:${r.sqlstate}→${r.ts_reverse_code}`);

  const defectRows = rows.filter((r) => r.db_bucket === 'defect');
  const nullStatusDefect = defectRows
    .filter((r) => (r.ts_status ?? 500) !== 500)
    .map((r) => `${r.name}:status=${r.ts_status}`);

  // ---- 良性结果码（benign_outcomes，master-plan §5.23）：豁免 bucket↔状态类校验，单独计数 ----
  const benignRows = rows.filter((r) => r.benign);
  const benignExcluded = benignRows.filter((r) => !r.bucket_class_validated);
  const benignOutcomes = {
    codes: benignRows.map((r) => r.name),
    statuses: benignRows.map((r) => r.ts_status),
    count: benignRows.length,
    excluded_from_bucket_class_validation: benignExcluded.length,
    /** 豁免必须是**逐码白名单**（真源 = `src/ledger-errors.ts` 的 `LEDGER_BENIGN_CODES`），不是「凡 200 都免检」 */
    whitelist_source: 'src/ledger-errors.ts#LEDGER_BENIGN_CODES',
    buckets_unchanged: benignRows.map((r) => ({ code: r.name, db_bucket: r.db_bucket, js_bucket: r.js_bucket,
      note: '桶字段仍为 input（与已应用的 0009 一致）；改桶 = 撒谎态，禁止' })),
    note: '200 不是错误类 ⇒ 单列一类、不参与 bucket↔状态类校验；仍参与往返闭合/未知码/两侧一致/retryable 自洽',
  };

  const unknownCodes = unknown.slice();
  // 反向映射里指向「TS 关闭集之外」的项（域外输入不计，只查 33 码域内）
  for (const r of rows) {
    if (r.db_code && !names.includes(r.db_code)) unknownCodes.push(`${r.sqlstate} → ${r.db_code}（不在 TS 关闭集）`);
  }

  const summary = {
    run: RUN,
    phase: phaseArg,
    closed_set_size_ts: names.length,
    closed_set_size_db: new Set(rows.map((r) => r.sqlstate).filter(Boolean)).size,
    roundtrip_mismatches: roundtripMismatches.length,
    unknown_codes: unknownCodes.length,
    bucket_violations:
      bucketClosedSetViolations.length + frozenViolations.length + extensionViolations.length
      + sidesViolations.length + retryableViolations.length,
    null_status_defect: nullStatusDefect.length,
    /** 良性结果码：码数 / 被排除出 bucket↔状态类校验的码数（断言「= 1」；见下方断言） */
    benign_outcomes: {
      count: benignOutcomes.count,
      excluded_from_bucket_class_validation: benignOutcomes.excluded_from_bucket_class_validation,
      codes: benignOutcomes.codes,
      whitelist_source: benignOutcomes.whitelist_source,
    },
    // —— 明细（每一条都能逐项复核）
    roundtrip_mismatch_list: roundtripMismatches,
    unknown_code_list: unknownCodes,
    bucket_violation_detail: {
      bucket_not_in_closed_set: bucketClosedSetViolations,
      frozen_map_violations: frozenViolations,
      extension_slot_violations: extensionViolations,
      db_js_bucket_mismatch: sidesViolations,
      retryable_flag_mismatch: retryableViolations,
    },
    null_status_defect_list: nullStatusDefect,
    stale_unclassified_reason: reasonStale,
    ts_reverse_map_violations: tsReverseViolations,
    ts_bucket_asset: asset ? 'present' : 'absent',
    ts_bucket_asset_mismatch: assetMismatch,
    ts_benign_asset: benignAsset ? 'present' : 'absent',
    ts_benign_asset_mismatch: benignAssetMismatch,
    httpStatusOf_probe: httpStatusProbe,
    bucket_map_extension_used: rows
      .filter((r) => r.extension_ok !== null)
      .map((r) => ({ code: r.name, status: r.ts_status, bucket: r.db_bucket, slot: EXTENSION_STATUS_BUCKET[String(r.ts_status)] })),
    /** 良性结果码明细（豁免名单 + 桶字段「未改动」取证；逐条可复核） */
    benign_outcomes_detail: benignOutcomes,
  };

  const artifact = {
    meta: {
      script: 'scripts/p2c-00-code-roundtrip.ts',
      run: RUN,
      phase: phaseArg,
      when: new Date().toISOString(),
      // 同一份终版脚本产出的两份读数靠这三个指纹对齐「脚本 / TS 源 / 迁移目录」状态
      inputs_fingerprint: {
        'src/ledger-errors.ts': md5('src/ledger-errors.ts'),
        'src/ledger.ts': md5('src/ledger.ts'),
        'src/ledger.ts#LEDGER_SQLSTATE_TO_CODE_entries': Object.keys(LEDGER_SQLSTATE_TO_CODE).length,
        'migrations/0009_ledger_error_reverse_map_complete.sql': md5('migrations/0009_ledger_error_reverse_map_complete.sql'),
        migration_files: fs.readdirSync(path.resolve(__dirname, '..', 'migrations')).filter((f) => f.endsWith('.sql')).sort(),
      },
    },
    db_schema_migration: await raw(pool, `SELECT version, name, left(checksum, 12) AS checksum12, applied_at::text FROM schema_migration ORDER BY version`),
    summary,
    rows,
    literal_readings: literalReadings,
    ts_e2e_synthetic: tsE2e,
    stray_domain_probe: strayOut,
  };

  fs.writeFileSync(ART_FILE, JSON.stringify(artifact, null, 2));

  // ============================================================================
  // 4. 打印
  // ============================================================================
  console.log('name'.padEnd(34) + 'sqlstate  db_code                     bucket       js_bucket    status  rt  froz ext sides retry benign');
  for (const r of rows) {
    console.log(
      r.name.padEnd(34)
      + String(r.sqlstate).padEnd(10)
      + String(r.db_code).padEnd(28)
      + String(r.db_bucket).padEnd(13)
      + String(r.js_bucket).padEnd(13)
      + String(r.ts_status).padEnd(8)
      + (r.roundtrip_ok ? ' ok ' : ' XX ')
      + (r.frozen_ok === null ? '  -  ' : r.frozen_ok ? ' ok  ' : ' XX  ')
      + (r.extension_ok === null ? ' -   ' : r.extension_ok ? ' ok  ' : ' XX  ')
      + (r.sides_agree ? ' ok   ' : ' XX   ')
      + (r.retryable_ok ? ' ok' : ' XX')
      // 良性结果码 = 未参与 bucket↔状态类校验（`--` 明示「未校验」，不是「通过」）
      + (r.benign ? '  benign(未校验)' : ''),
    );
  }
  console.log('\n--- 硬判据 ---');
  console.log(JSON.stringify({
    run: RUN, phase: phaseArg, artifact: ART_FILE,
    closed_set_size_ts: summary.closed_set_size_ts,
    closed_set_size_db: summary.closed_set_size_db,
    roundtrip_mismatches: summary.roundtrip_mismatches,
    unknown_codes: summary.unknown_codes,
    bucket_violations: summary.bucket_violations,
    null_status_defect: summary.null_status_defect,
    benign_outcomes: summary.benign_outcomes,
    stale_unclassified_reason: summary.stale_unclassified_reason,
    ts_reverse_map_violations: summary.ts_reverse_map_violations,
    ts_bucket_asset: summary.ts_bucket_asset,
    ts_bucket_asset_mismatch: summary.ts_bucket_asset_mismatch,
    ts_benign_asset: summary.ts_benign_asset,
    ts_benign_asset_mismatch: summary.ts_benign_asset_mismatch,
    httpStatusOf_probe: summary.httpStatusOf_probe,
    bucket_map_extension_used: summary.bucket_map_extension_used,
  }, null, 1));
  console.log('\n--- 物理取证 ledger_error_for_sqlstate(LD031|LD032|LD033) ---');
  console.log(JSON.stringify(literalReadings, null, 1));
  console.log('\n--- TS 端到端（合成 LD0nn 错误对象 ⇒ LedgerError）---');
  console.log(JSON.stringify(tsE2e, null, 1));

  const failed: string[] = [];
  if (summary.roundtrip_mismatches !== 0) failed.push(`roundtrip_mismatches=${summary.roundtrip_mismatches}`);
  if (summary.unknown_codes !== 0) failed.push(`unknown_codes=${summary.unknown_codes}`);
  if (summary.bucket_violations !== 0) failed.push(`bucket_violations=${summary.bucket_violations}`);
  if (summary.null_status_defect !== 0) failed.push(`null_status_defect=${summary.null_status_defect}`);
  if (summary.closed_set_size_ts !== 33) failed.push(`closed_set_size_ts=${summary.closed_set_size_ts}`);
  if (summary.closed_set_size_db !== 33) failed.push(`closed_set_size_db=${summary.closed_set_size_db}`);
  if (reasonStale.length !== 0) failed.push(`stale_unclassified_reason=${reasonStale.length}`);
  if (tsReverseViolations.length !== 0) failed.push(`ts_reverse_map_violations=${tsReverseViolations.length}`);
  if (!asset) failed.push('ts_bucket_asset_absent');
  if (assetMismatch.length !== 0) failed.push(`ts_bucket_asset_mismatch=${assetMismatch.length}`);
  if (!httpStatusOf) failed.push('httpStatusOf_absent');
  // ---- 良性结果码（benign_outcomes，master-plan §5.23）：**不参与** bucket↔状态类校验，且计数被断言 ----
  if (!benignAsset) failed.push('ts_benign_asset_absent');
  if (benignAssetMismatch.length !== 0) failed.push(`ts_benign_asset_mismatch=${benignAssetMismatch.length}`);
  if (benignOutcomes.count !== 1) {
    failed.push(`benign_outcomes.count=${benignOutcomes.count}（期望 1：§5.23 裁定 LD006 单列一类）`);
  }
  if (benignOutcomes.excluded_from_bucket_class_validation !== benignOutcomes.count) {
    failed.push(`benign_outcomes.excluded_from_bucket_class_validation=${benignOutcomes.excluded_from_bucket_class_validation}`
      + ` ≠ count=${benignOutcomes.count}（豁免必须逐码生效）`);
  }
  if (benignOutcomes.count !== benignRows.filter((r) => !r.bucket_class_validated).length) {
    failed.push('benign_outcomes 计数与逐行 bucket_class_validated 标记不一致');
  }
  // 良性码的桶字段必须**未改动**（仍 input，与已应用的 0009 一致）⇒ 防「为了让校验变绿去改桶」
  for (const r of benignRows) {
    if (r.db_bucket !== 'input' || r.js_bucket !== 'input') {
      failed.push(`benign_bucket_drift: ${r.name} db=${r.db_bucket} js=${r.js_bucket}（期望 input，未改动）`);
    }
    if (r.ts_status !== 200) failed.push(`benign_status_not_200: ${r.name}=${r.ts_status}`);
  }
  if (benignOutcomes.codes.join(',') !== 'LEDGER_IDEMPOTENCY_REPLAY') {
    failed.push(`benign_outcomes.codes=${benignOutcomes.codes.join(',')}（期望 LEDGER_IDEMPOTENCY_REPLAY）`);
  }
  // 良性码的 HTTP 语义：恒 200（R106）—— 不得落 500 兜底
  if (httpStatusOf) {
    for (const c of benignRows.map((r) => r.name)) {
      const got = httpStatusOf(c);
      if (got !== 200) failed.push(`httpStatusOf(${c})=${got}（良性码期望 200，不得落 500）`);
    }
  }

  console.log('\nassertions_failed = ' + JSON.stringify(failed));
  await pool.end();
  if (assertMode && failed.length > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
