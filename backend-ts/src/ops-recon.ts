/**
 * 只读对账 · 账本 / 供应量 / 电量（ops recon）
 * ============================================================================
 * 性质：**纯只读**。三条检查全部是单语句 `SELECT`，无事务、无 INSERT/UPDATE/DELETE、
 *   无 `ledger_post_event`、不写库、不动数据模型（无迁移 / 无新表 / 无新列）。
 *   故按 `db.ts` 的分层走 `readQuery`（只读池，串优先 `DATABASE_URL` pooler）——
 *   这不是绕开 R55「写操作必须交互式事务」，而是只读口本来的层。
 *
 * 调用方：`index.ts` 的 `GET /api/ops/recon/ledger`（CRON_SECRET fail-closed），
 *   由 `vercel.json` 的第二条日级 cron 触发（`30 18 * * *` UTC）。
 *
 * 口径真源（**不要自创算式**）：
 *   · `ops/bttc-recon-cadence/REPORT.md` §3.1 / §3.2 / §3.3（三条 SQL 原文）
 *   · 符号约定：`ledger_entry` 的 burn 分录存的是**负** `delta` ⇒ 守恒式是
 *     `total_supply == Σmint + Σburn`，**不是** `Σmint − Σburn`
 *     （勘误出处 = `docs/audit/p9-s4-bttc.md` 的 KI2；现役门 `p8-s9-bttc-gate.ts` 同式）。
 *
 * 两条判据必须分开（`docs/OPEN-ITEMS.md` B25 已登记）：
 *   · 逐户 `account ↔ ledger`、`batt_account ↔ batt_entry` ⇒ **必须 0 行**（严格闭合）；
 *   · 供应量 ⇒ 按**已登记基线常量**对拍（**不是** 0，也**不是**容差/不等式）。
 *     基线来源：cid=1 的 `2,000,000` 是 B25 逐字登记的已知差额（未搬的纯夹具
 *     mint/burn 净额，几乎全为 `970001` 的 `mint 2,000,000`）⇒ 属「已知真漂移」，
 *     不是可放大的容差：`diff <> 基线` 一律 FAIL。
 */

import { readQuery } from './db';

// ---------------------------------------------------------------- 类型

export type ReconStatus = 'PASS' | 'FAIL';

export type ReconCheckId = 'supply_vs_ledger' | 'account_vs_ledger' | 'batt_account_vs_batt_entry';

export interface ReconCheck {
  /** 稳定机读 id（三条固定，作日志检索键） */
  id: ReconCheckId;
  status: ReconStatus;
  /** 受检行数（检查①= currency 行数；②= 漂移行数；③= 漂移行数） */
  rows: number;
  /** 检查① 的未登记差额（首个失败 cid）；通过时 = '0'。②③ 不产出该键。 */
  diff?: string;
  /** 定位样本（失败行 / 逐 cid 读数；上限 20 行） */
  sample?: Array<Record<string, unknown>>;
}

export interface ReconReport {
  ok: boolean;
  checks: ReconCheck[];
  checked_at: string;
  duration_ms: number;
}

// ---------------------------------------------------------------- 基线常量（已登记差额）

/**
 * 已登记基线差额（cid ⇒ 整数差额字符串），**不是容差**：判据是 `diff === 基线`。
 *
 * · `'1'`（`$`）⇒ `2000000`：`docs/OPEN-ITEMS.md` B25 登记的已知差额
 *   （`ops/bttc-recon-cadence/REPORT.md` §3.1 生产现取逐位相同 = 2,000,000）。
 * · `'21'` ⇒ `1`：本轮登记的第二条基线（登记值，当前 `currency` 表无该 cid ⇒ 该行缺席
 *   不影响判定：基线只对**在场**的 cid 生效）。
 * · 未登记 cid ⇒ 基线 `0`（默认严格相等，绝不因「新币种」而放宽）。
 *
 * 改法（误报处置，写死在 REPORT §5.4）：先复核读数 → 良性则改本表 + `OPEN-ITEMS` 留痕
 * （旧值/新值/原因/日期）；**禁止**改成 `>=` / 调大阈值 / try-catch 吞掉 / FAIL→SKIP。
 */
export const KNOWN_SUPPLY_OFFSET: Readonly<Record<string, string>> = Object.freeze({
  '1': '2000000',
  '21': '1',
});

/** 基线取值（未登记 cid ⇒ 0n） */
export const baselineOffsetOf = (cid: string): bigint => BigInt(KNOWN_SUPPLY_OFFSET[cid] ?? '0');

// ---------------------------------------------------------------- 三条 SQL（原文见报告 §3）

/** 检查①：供应量 vs 账本（逐 cid）。`diff` 由 SQL 现算，与基线常量在 TS 侧严格比较。 */
export const SUPPLY_VS_LEDGER_SQL = `SELECT c.cid, c.symbol, c.total_supply,
       COALESCE(l.sum_mint,0)                       AS sum_mint,
       COALESCE(l.sum_burn,0)                       AS sum_burn,
       COALESCE(l.sum_mint,0)+COALESCE(l.sum_burn,0) AS ledger_derived,
       c.total_supply - (COALESCE(l.sum_mint,0)+COALESCE(l.sum_burn,0)) AS diff
  FROM public.currency c
  LEFT JOIN (SELECT cid,
                    SUM(delta) FILTER (WHERE kind='mint') AS sum_mint,
                    SUM(delta) FILTER (WHERE kind='burn') AS sum_burn
               FROM public.ledger_entry GROUP BY cid) l ON l.cid = c.cid
 ORDER BY c.cid`;

/** 检查②：`account.balance/frozen` vs `Σ ledger_entry.delta/frozen_delta`（逐户）⇒ 期望 0 行。 */
export const ACCOUNT_VS_LEDGER_SQL = `SELECT a.uid, a.cid, a.balance, COALESCE(s.d,0) AS sum_delta,
       a.balance - COALESCE(s.d,0) AS diff_balance,
       a.frozen, COALESCE(s.f,0) AS sum_frozen_delta,
       a.frozen  - COALESCE(s.f,0) AS diff_frozen
  FROM public.account a
  LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f
               FROM public.ledger_entry GROUP BY uid, cid) s
         ON s.uid = a.uid AND s.cid = a.cid
 WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)
 ORDER BY a.uid, a.cid`;

/** 检查③：`batt_account.batt` vs `Σ batt_entry.delta`（逐户）⇒ 期望 0 行。 */
export const BATT_VS_ENTRY_SQL = `SELECT b.uid, b.batt, COALESCE(e.d,0) AS sum_delta, b.batt - COALESCE(e.d,0) AS diff
  FROM public.batt_account b
  LEFT JOIN (SELECT uid, SUM(delta) AS d FROM public.batt_entry GROUP BY uid) e ON e.uid = b.uid
 WHERE b.batt <> COALESCE(e.d,0)
 ORDER BY b.uid`;

// ---------------------------------------------------------------- 内部工具

const SAMPLE_LIMIT = 20;

/**
 * `pg` 的 `numeric` / `bigint` 回来是**字符串**（见技能「DB 派生 id / 数值一律先归一」）⇒
 * 一律用 `BigInt` 严格比较，绝不转 `Number`（精度）。
 * `exact=false` 表示不是整数（含小数残差 / 非数值）⇒ 判 FAIL，不静默取整。
 */
const integerOf = (value: unknown): { big: bigint; exact: boolean } => {
  const raw = String(value ?? '').trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!m) return { big: 0n, exact: false };
  const big = BigInt(`${m[1]}${m[2]}`);
  const exact = !m[3] || /^0+$/.test(m[3]);
  return { big, exact };
};

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

interface SupplyRow {
  cid: number | string;
  symbol: string | null;
  total_supply: string | number | null;
  sum_mint: string | number | null;
  sum_burn: string | number | null;
  ledger_derived: string | number | null;
  diff: string | number | null;
}

/**
 * 检查①判定：逐 cid `diff === 基线`。**只对在场 cid 判**（BTTC 币种行由首次 mint 惰性创建
 * ⇒ 不得写成 `WHERE symbol='BTTC'`，否则今天 0 行、明天 1 行 = 「有行才检查」的假绿）。
 */
const judgeSupply = (rows: SupplyRow[]): ReconCheck => {
  // ★ 两阶段采集（Zang 审阅修复）：先扫全部行，失败行与通过行**分桶**收集 ——
  //   只按 `!pass || sample.length < 上限` 顺序推送再 `slice(0, 上限)` 的写法，
  //   会让「前 20 行全 PASS、后面才 FAIL」的行虽被推进数组却被切掉 ⇒
  //   值班人拿到 FAIL 却看不到是哪一行漂了（定位样本丢失，非判定错）。
  //   ⇒ 失败行恒占据输出前段（各自封顶 20），余位再用 PASS 行填满。
  const failedSample: Array<Record<string, unknown>> = [];
  const passedSample: Array<Record<string, unknown>> = [];
  let firstUnexpected: string | null = null;

  for (const row of rows) {
    const cid = str(row.cid);
    const baseline = baselineOffsetOf(cid);
    const parsed = integerOf(row.diff);
    const pass = parsed.exact && parsed.big === baseline;
    if (!pass && firstUnexpected === null) firstUnexpected = str(row.diff);
    // 每桶各自封顶 SAMPLE_LIMIT ⇒ 内存有界，且失败桶永远不会被通过行挤掉。
    if (pass) {
      if (passedSample.length < SAMPLE_LIMIT) passedSample.push({
        cid,
        symbol: str(row.symbol),
        total_supply: str(row.total_supply),
        sum_mint: str(row.sum_mint),
        sum_burn: str(row.sum_burn),
        ledger_derived: str(row.ledger_derived),
        diff: str(row.diff),
        baseline: baseline.toString(),
        ok: true,
      });
    } else if (failedSample.length < SAMPLE_LIMIT) {
      failedSample.push({
        cid,
        symbol: str(row.symbol),
        total_supply: str(row.total_supply),
        sum_mint: str(row.sum_mint),
        sum_burn: str(row.sum_burn),
        ledger_derived: str(row.ledger_derived),
        diff: str(row.diff),
        baseline: baseline.toString(),
        ok: false,
      });
    }
  }

  /** 输出顺序固定 = 失败行在前，余位（上限 − 失败数）由 PASS 行补齐 */
  const room = SAMPLE_LIMIT - failedSample.length;
  const sample = failedSample.concat(room > 0 ? passedSample.slice(0, room) : []);

  const failed = failedSample.length > 0;
  return {
    id: 'supply_vs_ledger',
    status: failed ? 'FAIL' : 'PASS',
    rows: rows.length,
    diff: failed ? String(firstUnexpected ?? '') : '0',
    sample,
  };
};

const judgeZeroRows = (
  id: ReconCheckId,
  rows: Array<Record<string, unknown>>,
): ReconCheck => ({
  // 复核（Zang 审阅轮）：本函数**无需改** —— 判据是「行数 > 0 即 FAIL」，无 PASS 行概念，
  //   `sample` 天然只由失败行组成，`slice(0, SAMPLE_LIMIT)` 只截数量、不会把「唯一的失败类型」
  //   挤出去（与 judgeSupply 的洞不是同一类问题）。
  id,
  status: rows.length > 0 ? 'FAIL' : 'PASS',
  rows: rows.length,
  sample: rows.slice(0, SAMPLE_LIMIT).map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = v === null || v === undefined ? null : String(v);
    return out;
  }),
});

// ---------------------------------------------------------------- 主入口

/**
 * 跑三条只读对账并给出机读结论。
 *
 * · 顺序执行（不是 `Promise.all`）：任一查询抛错时能定位到具体第几条，且三条合计 < 1s，
 *   并发收益无意义；抛出的错误由调用方交**既有** §14 分类器（`sendInfraMapped` ⇒ 503），
 *   本函数**不吞异常**（吞掉 = 「库不可达」被伪装成 PASS）。
 * · 纯只读 ⇒ 天然幂等，重入 / 连跑 / 手动触发均无副作用。
 */
export const runLedgerRecon = async (): Promise<ReconReport> => {
  const startedAt = Date.now();

  const supplyRows = await readQuery<SupplyRow>(SUPPLY_VS_LEDGER_SQL);
  const accountRows = await readQuery<Record<string, unknown>>(ACCOUNT_VS_LEDGER_SQL);
  const battRows = await readQuery<Record<string, unknown>>(BATT_VS_ENTRY_SQL);

  const checks: ReconCheck[] = [
    judgeSupply(supplyRows),
    judgeZeroRows('account_vs_ledger', accountRows),
    judgeZeroRows('batt_account_vs_batt_entry', battRows),
  ];

  return {
    ok: checks.every((c) => c.status === 'PASS'),
    checks,
    checked_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
  };
};
