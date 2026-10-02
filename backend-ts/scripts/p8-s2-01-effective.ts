/**
 * 批 8②（spec `route-layer.spec` v2.4 §19.4）· **「真生效」四段读数探针**
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s2-01-effective.ts
 * 产物：backend-ts/.p8s2-artifacts/p8s2-effective-<RUN>/effective.json
 *
 * ★ `R-8-15`（本单刚裁 · 逐字执行）：
 *   **「后台写」段必须在事务内 ROLLBACK，禁止跑 HTTP POST。**
 *   理由 = `commission_policy` 表 **append-only**（`0007:102-112` `trg_commission_policy_append_only`
 *   对 UPDATE / DELETE 直接 RAISE），**且新政策行会以新 `effective_from` 直接成为「现行政策」**
 *   ⇒ 跑一发真 POST 就是**永久改变线上费率 / 佣金**（不可删、不可改）。
 *   执行口径 = 服务层写（`withTransaction` + `insertCommissionPolicy` 同路径）+ 全段在事务内完成
 *   + 末尾 **`ROLLBACK`**。**HTTP 面只做只读探针**（另一支：`p8-s2-02-http-readonly.ts`）。
 *
 * 四段（§19.4(a) 模板）：
 *   ① 后台写 → ② 库内落值（给表 / 列）→ ③ 业务读口取数（给 `文件:行`）→ ④ 行为随之（改前 / 改后两读数）
 * 两项配置：`fee_rate_bp`（§19.4(b)）/ `weights_bp`（§19.4(c)）。
 * 每段自带判负（含逐字形态「**写成功但库值未变 ⇒ 判负**」）+ **判负自证**（把判据喂错值 ⇒ 必须报红）。
 * ⚠️ 只打印 uid / 计数 / 金额 / 机读字段，**不打印任何密钥 / 连接串**。
 */
import '../src/env';
import { readQuery, withTransaction, closePools, txQuery, TxClient } from '../src/db';
import { getCommissionPolicy, insertCommissionPolicy, planJobSettlement } from '../src/commission';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = require('path').join(__dirname, '..', '.p8s2-artifacts', `p8s2-effective-${RUN}`);
require('fs').mkdirSync(OUT_DIR, { recursive: true });

/** 受控实例参数：worker 6 = 2 层邀请链（6→5→4，现取 `referral` = {(5,4),(6,5)}） */
const WORKER = 6n;
const EMPLOYER = 5n;
const CID = 1n;
const GROSS = 100000n;
const JOB_ID = 9000001n;
const CREATED_BY = 1n;
/** 事务回滚哨兵：回调末尾抛它 ⇒ `withTransaction` 走 `catch` ⇒ `ROLLBACK`（**绝不 COMMIT**） */
class RollbackSentinel extends Error {
  constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); }
}

interface Check { id: string; pass: boolean; detail: unknown; neg_rule?: string; }
const checks: Check[] = [];
const rec = (id: string, pass: boolean, detail: unknown, neg_rule?: string) => {
  checks.push({ id, pass, detail, neg_rule });
};

/** 判据比较器：唯一判负出口（`neg_rule` 逐字随读数登记） */
const judge = (id: string, actual: unknown, expected: unknown, negRule: string): boolean => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  rec(id, ok, { actual, expected }, negRule);
  return ok;
};

/**
 * 判负**自证**：把「判据谓词」喂一个**故意错**的输入 ⇒ 谓词必须返回 false（= 判据转红）。
 * 不转红 ⇒ 该段是假门（§19.4(d)-⑥ 口径）。
 */
const selfTest = (id: string, predicate: (v: unknown) => boolean, wrongInput: unknown, negRule: string) => {
  const fired = predicate(wrongInput) === false;
  rec(`${id}__selftest`, fired, { wrong_input: wrongInput, judge_fired: fired }, negRule);
};

const sqlPolicyLatest = `SELECT policy_id::text AS policy_id, fee_rate_bp, levels,
                                weights_bp::text AS weights_bp, effective_from::text AS effective_from
                           FROM commission_policy
                          ORDER BY effective_from DESC LIMIT 1`;
const sqlPolicyEffectiveNow = `SELECT policy_id::text AS policy_id, fee_rate_bp, levels,
                                      weights_bp::text AS weights_bp, effective_from::text AS effective_from
                                 FROM commission_policy WHERE effective_from <= now()
                                ORDER BY effective_from DESC LIMIT 1`;

/** DB 侧同核（§19.4(b)/(c) ③ 段的第二条锚：`migrations/0013_job.sql:250 job_settle_plan`） */
const dbPlan = async (tx: TxClient) => (await txQuery<{ plan: any }>(
  tx, `SELECT public.job_settle_plan($1::bigint,$2::bigint,$3::bigint,$4::bigint,$5::bigint) AS plan`,
  [JOB_ID.toString(), EMPLOYER.toString(), WORKER.toString(), CID.toString(), GROSS.toString()],
))[0].plan;

/** `-2` 池进出守恒（§19.4(c) ④）：入 = `job_fee` 入 `-2` 腿；出 = `commission` 各层 `-2` 腿 */
const poolFlow = (plan: any) => {
  const entries: any[] = Array.isArray(plan?.entries) ? plan.entries : [];
  const inflow = entries.filter((e) => e.kind === 'job_fee' && e.uid === '-2')
    .reduce((a, e) => a + BigInt(e.delta), 0n);
  const outflow = entries.filter((e) => e.kind === 'commission' && e.uid === '-2')
    .reduce((a, e) => a + BigInt(e.delta), 0n);
  return { inflow: inflow.toString(), outflow: outflow.toString(), net: (inflow + outflow).toString() };
};
const layersOf = (plan: any): Array<{ level: number; x: string }> =>
  (Array.isArray(plan?.layers) ? plan.layers : []).map((l: any) => ({ level: Number(l.level), x: String(l.x) }));

const out: Record<string, unknown> = {
  script: 'scripts/p8-s2-01-effective.ts', run: RUN,
  r8_15: '后台写段 = 服务层写（withTransaction + insertCommissionPolicy 同路径）+ 事务内 + 末尾 ROLLBACK；未跑任何 HTTP POST',
  fixture: {
    worker: WORKER.toString(), employer: EMPLOYER.toString(), cid: CID.toString(),
    gross: GROSS.toString(), job_id: JOB_ID.toString(),
    chain: '6→5→4（depth=2）',
  },
};

(async () => {
  // ---------------- 0) 基线（只读，事务外） ----------------
  const before = await readQuery<Record<string, unknown>>(
    `SELECT policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS weights_bp,
            effective_from::text AS effective_from, created_by::text AS created_by,
            time_created::text AS time_created
       FROM commission_policy ORDER BY effective_from DESC`);
  const beforeCount = Number((await readQuery<{ n: number }>(
    'SELECT count(*)::int AS n FROM commission_policy'))[0].n);
  out.baseline = { rows: before, count: beforeCount };

  // ================================================================
  // 段 A · `fee_rate_bp`（§19.4(b)）
  // ================================================================
  let segA: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx) => {
      const A: Record<string, unknown> = {};
      // ---- 改前（读口 / DB 同核 / 行为） ----
      const p0 = await getCommissionPolicy(null, tx);
      const d0 = await dbPlan(tx);
      const b0 = await planJobSettlement({
        jobId: JOB_ID, employerUid: EMPLOYER, workerUid: WORKER, cid: CID, gross: GROSS, at: null, ex: tx,
      });
      A.before = {
        read_endpoint: { policy_id: p0.policy_id, fee_rate_bp: p0.fee_rate_bp, levels: p0.levels, weights_bp: p0.weights_bp },
        db_fn: { fee: d0.fee, fee_rate_bp: d0.fee_rate_bp, layers: layersOf(d0) },
        service_fn: { fee: b0.fee, net: b0.net, layer_x: b0.layers.map((l) => ({ level: l.level, x: l.x })) },
      };

      // ---- ① 后台写（服务层写 · 同 POST /api/admin/commission_policy 路径） ----
      const NEW_BP = Number(p0.fee_rate_bp) + 150; // 100 ⇒ 250（CHECK `BETWEEN 100 AND 500`）
      const written = await insertCommissionPolicy({
        fee_rate_bp: NEW_BP, levels: p0.levels, weights_bp: p0.weights_bp, created_by: CREATED_BY,
      }, tx);
      A['1_write'] = {
        same_path: 'POST /api/admin/commission_policy（src/index.ts:1999）⇒ src/commission.ts:240 insertCommissionPolicy',
        returned_keys: Object.keys(written).sort(),
        fee_rate_bp_returned: written.fee_rate_bp,
        policy_id: written.policy_id,
      };
      judge('A1-write-shape-8keys',
        Object.keys(written).sort(),
        ['created_by', 'effective_from', 'fee_rate_bp', 'levels', 'policy_id', 'time_created', 'weights_bp', 'weights_sum_bp'],
        '写口返回 `data` 键集 ≠ `CommissionPolicy` 8 键 ⇒ 判负');

      // ---- ② 库内落值（表 + 列 + 取值） ----
      const r1 = (await txQuery<Record<string, unknown>>(tx, sqlPolicyEffectiveNow))[0];
      A['2_db_landed'] = { table: 'public.commission_policy', columns: ['fee_rate_bp', 'effective_from'], row: r1 };
      const dbChanged = judge('A2-db-fee_rate_bp-landed', r1.fee_rate_bp, NEW_BP,
        '写成功（insert 返回行）但 `public.commission_policy.fee_rate_bp` 未随之变 ⇒ 判负');
      selfTest('A2-db-fee_rate_bp-landed', (v) => v === NEW_BP, NEW_BP + 1, '写成功但库列未变 ⇒ 判负');

      // ---- ③ 业务读口取数（两条锚：`src/commission.ts:201` + `migrations/0013_job.sql:250`） ----
      const p1 = await getCommissionPolicy(null, tx);
      const d1 = await dbPlan(tx);
      A['3_business_read'] = {
        anchor_1: 'src/commission.ts:201 getCommissionPolicy → src/commission.ts:207 SELECT … WHERE effective_from <= COALESCE($1::timestamptz, now())',
        anchor_2: 'migrations/0013_job.sql:250 public.job_settle_plan → :292 SELECT cp.fee_rate_bp, cp.levels, cp.weights_bp',
        read_endpoint_policy_id: p1.policy_id,
        read_endpoint_fee_rate_bp: p1.fee_rate_bp,
        db_fn_fee: d1.fee, db_fn_fee_rate_bp: d1.fee_rate_bp,
      };
      judge('A3-read-fn-sees-new', p1.fee_rate_bp, NEW_BP,
        '业务读口（`getCommissionPolicy`）取到的仍是旧值 ⇒ 判负');
      judge('A3-db-fn-sees-new', d1.fee_rate_bp, NEW_BP,
        'DB 侧同核（`job_settle_plan`）取到的仍是旧值 ⇒ 判负');

      // ---- ④ 行为随之（同一业务量 = `job_fee` 金额；改前 / 改后两读数） ----
      const b1 = await planJobSettlement({
        jobId: JOB_ID, employerUid: EMPLOYER, workerUid: WORKER, cid: CID, gross: GROSS, at: null, ex: tx,
      });
      A['4_behavior'] = {
        business_quantity: 'job_fee 金额（同一 gross=100000）',
        before_fee: b0.fee, after_fee: b1.fee, before_net: b0.net, after_net: b1.net,
        db_fn_before_fee: d0.fee, db_fn_after_fee: d1.fee,
        expect_formula: 'fee = (gross × fee_rate_bp + 5000) / 10000（CR38 · 唯一取整点）',
        compute: {
          gross: GROSS.toString(), bp_before: p0.fee_rate_bp, bp_after: p1.fee_rate_bp,
          formula_before: ((GROSS * BigInt(p0.fee_rate_bp) + 5000n) / 10000n).toString(),
          formula_after: ((GROSS * BigInt(p1.fee_rate_bp) + 5000n) / 10000n).toString(),
        },
      };
      rec('A4-job_fee-amount-differs', b0.fee !== b1.fee, { before: b0.fee, after: b1.fee },
        '同一 `gross`、改 `fee_rate_bp` 前后两次结算的 `job_fee` 金额相等 ⇒ 判负');
      selfTest('A4-job_fee-amount-differs', (v) => v !== b0.fee, b0.fee, '改 `fee_rate_bp` 前后 `job_fee` 相等 ⇒ 判负');
      rec('A4-fee-matches-formula',
        b1.fee === ((GROSS * BigInt(p1.fee_rate_bp) + 5000n) / 10000n).toString()
        && d1.fee === ((GROSS * BigInt(p1.fee_rate_bp) + 5000n) / 10000n).toString(),
        { service_fee: b1.fee, db_fee: d1.fee, formula: ((GROSS * BigInt(p1.fee_rate_bp) + 5000n) / 10000n).toString() },
        '改后 `job_fee` ≠ CR38 公式值 ⇒ 判负');
      rec('A4-db-write-parity', dbChanged === true, { dbChanged },
        '② 段库列未落地 ⇒ 本段 ④ 读数不可采信（判负）');

      segA = A;
      throw new RollbackSentinel('SEG_A');
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
    segA.rollback = { sentinel: (e as RollbackSentinel).tag, committed: false };
  }
  out.segment_A_fee_rate_bp = segA;

  // ================================================================
  // 段 B · `weights_bp`（§19.4(c)）
  // ================================================================
  let segB: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx) => {
      const B: Record<string, unknown> = {};
      const p0 = await getCommissionPolicy(null, tx);
      const d0 = await dbPlan(tx);
      const b0 = await planJobSettlement({
        jobId: JOB_ID, employerUid: EMPLOYER, workerUid: WORKER, cid: CID, gross: GROSS, at: null, ex: tx,
      });
      B.before = {
        policy: { fee_rate_bp: p0.fee_rate_bp, levels: p0.levels, weights_bp: p0.weights_bp, weights_sum_bp: p0.weights_sum_bp },
        M: b0.M, W: b0.W,
        db_fn: { fee: d0.fee, W: d0.W, weights_bp: d0.weights_bp, layers: layersOf(d0) },
        service_fn: { fee: b0.fee, layer_x: b0.layers.map((l) => ({ level: l.level, weight_bp: l.weight_bp, x: l.x })) },
      };

      // ---- ① 后台写（同一写口 · 只改 weights / levels） ----
      const NEW_LEVELS = 3;
      const NEW_W = [5000, 3000, 2000];
      const written = await insertCommissionPolicy({
        fee_rate_bp: p0.fee_rate_bp, levels: NEW_LEVELS, weights_bp: NEW_W, created_by: CREATED_BY,
      }, tx);
      B['1_write'] = {
        same_path: 'POST /api/admin/commission_policy ⇒ src/commission.ts:240 insertCommissionPolicy',
        returned_levels: written.levels, returned_weights_bp: written.weights_bp,
        returned_weights_sum_bp: written.weights_sum_bp,
      };
      judge('B1-write-shape-8keys',
        Object.keys(written).sort(),
        ['created_by', 'effective_from', 'fee_rate_bp', 'levels', 'policy_id', 'time_created', 'weights_bp', 'weights_sum_bp'],
        '写口返回 `data` 键集 ≠ `CommissionPolicy` 8 键 ⇒ 判负');

      // ---- ② 库内落值 ----
      const r1 = (await txQuery<Record<string, unknown>>(tx, sqlPolicyEffectiveNow))[0];
      B['2_db_landed'] = { table: 'public.commission_policy', columns: ['weights_bp', 'levels'], row: r1 };
      const dbChanged = judge('B2-db-weights_bp-landed', r1.weights_bp, `{${NEW_W.join(',')}}`,
        '写成功（insert 返回行）但 `public.commission_policy.weights_bp` 未随之变 ⇒ 判负');
      judge('B2-db-levels-landed', r1.levels, NEW_LEVELS,
        '写成功（insert 返回行）但 `public.commission_policy.levels` 未随之变 ⇒ 判负');
      selfTest('B2-db-weights_bp-landed', (v) => v === `{${NEW_W.join(',')}}`,
        '{3000,2000,1500,1000,800,600,500,300,200,100}', '写成功但库列未变 ⇒ 判负');

      // ---- ③ 业务读口取数（`src/commission.ts:432 splitPool` + DB 同核） ----
      const p1 = await getCommissionPolicy(null, tx);
      const d1 = await dbPlan(tx);
      B['3_business_read'] = {
        anchor_1: 'src/commission.ts:432 splitPool（最大余数法）← src/commission.ts:645 planJobSettlement 调它',
        anchor_2: 'migrations/0013_job.sql:336-360（同核最大余数法 + `Σx_L <> pool` ⇒ ledger_raise）',
        read_endpoint_weights_bp: p1.weights_bp, read_endpoint_levels: p1.levels, read_endpoint_weights_sum_bp: p1.weights_sum_bp,
        db_fn_W: d1.W, db_fn_weights_bp: d1.weights_bp,
      };
      judge('B3-read-fn-sees-new', p1.weights_bp, NEW_W,
        '业务读口（`getCommissionPolicy`）取到的 `weights_bp` 仍是旧值 ⇒ 判负');
      judge('B3-db-fn-sees-new', d1.weights_bp, NEW_W.slice(0, Number(d1.M)),
        'DB 侧同核（`job_settle_plan`）取到的 `weights_bp` 仍是旧值 ⇒ 判负');

      // ---- ④ 行为随之（各层 `x_L`；改前 / 改后两读数 + 两条不变量） ----
      const b1 = await planJobSettlement({
        jobId: JOB_ID, employerUid: EMPLOYER, workerUid: WORKER, cid: CID, gross: GROSS, at: null, ex: tx,
      });
      const x0 = b0.layers.map((l) => l.x);
      const x1 = b1.layers.map((l) => l.x);
      const fee = b1.fee;
      const sumX1 = b1.layers.reduce((a, l) => a + BigInt(l.x), 0n);
      const flows0 = poolFlow(d0); const flows1 = poolFlow(d1);
      B['4_behavior'] = {
        business_quantity: '`commission` 各层分配额 `x_L`（同一 `fee`）',
        before: { fee: b0.fee, layer_x: x0, weights_used: b0.weights_bp, W: b0.W, sum_x: x0.reduce((a, v) => (a + BigInt(v)), 0n).toString() },
        after: { fee: b1.fee, layer_x: x1, weights_used: b1.weights_bp, W: b1.W, sum_x: sumX1.toString() },
        db_fn_after: { fee: d1.fee, layers: layersOf(d1), sum_x: layersOf(d1).reduce((a, l) => a + BigInt(l.x), 0n).toString() },
        pool_flow_before: flows0, pool_flow_after: flows1,
        fee_credit_uid: b1.fee_credit_uid,
      };
      rec('B4-xL-differs', JSON.stringify(x0) !== JSON.stringify(x1), { before: x0, after: x1 },
        '同一 `fee`、改 `weights_bp` 前后两次结算的 `commission` 各层 `x_L` 逐层相等 ⇒ 判负');
      selfTest('B4-xL-differs', (v) => JSON.stringify(v) !== JSON.stringify(x0), x0,
        '改 `weights_bp` 前后 `x_L` 逐层相等 ⇒ 判负');
      rec('B4-sum_x-equals-fee', sumX1.toString() === fee,
        { sum_x: sumX1.toString(), fee, db_sum_x: layersOf(d1).reduce((a, l) => a + BigInt(l.x), 0n).toString(), db_fee: d1.fee },
        '改 `weights_bp` 后 `Σx_L != fee` ⇒ 判负');
      rec('B4-pool-minus2-conserved',
        b1.fee_credit_uid === '-2' && flows1.net === '0' && flows1.inflow === fee,
        { fee_credit_uid: b1.fee_credit_uid, pool_inflow: flows1.inflow, pool_outflow: flows1.outflow, pool_net: flows1.net, fee },
        '改 `weights_bp` 后 `-2` 池进出不守恒（`inflow + outflow ≠ 0`）⇒ 判负');
      selfTest('B4-pool-minus2-conserved',
        (v) => b1.fee_credit_uid === '-2' && v === '0' && flows1.inflow === fee, '-1',
        '`-2` 池进出不守恒 ⇒ 判负');
      rec('B4-db-write-parity', dbChanged === true, { dbChanged },
        '② 段库列未落地 ⇒ 本段 ④ 读数不可采信（判负）');

      segB = B;
      throw new RollbackSentinel('SEG_B');
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
    segB.rollback = { sentinel: (e as RollbackSentinel).tag, committed: false };
  }
  out.segment_B_weights_bp = segB;

  // ================================================================
  // 回滚自证（事务外 · 只读）：库面必须与开工基线**逐字节相同**
  // ================================================================
  const after = await readQuery<Record<string, unknown>>(
    `SELECT policy_id::text AS policy_id, fee_rate_bp, levels, weights_bp::text AS weights_bp,
            effective_from::text AS effective_from, created_by::text AS created_by,
            time_created::text AS time_created
       FROM commission_policy ORDER BY effective_from DESC`);
  const afterCount = Number((await readQuery<{ n: number }>(
    'SELECT count(*)::int AS n FROM commission_policy'))[0].n);
  const maxEff = (await readQuery<{ m: string | null }>(
    'SELECT max(effective_from)::text AS m FROM commission_policy'))[0].m;
  const rowsIdentical = JSON.stringify(after) === JSON.stringify(before);
  out.post_rollback = { count: afterCount, max_effective_from: maxEff, rows_identical: rowsIdentical };
  judge('ROLLBACK-count-unchanged', afterCount, beforeCount,
    '事务回滚后 `commission_policy` 行数变了 ⇒ 判负（**写已外泄**）');
  judge('ROLLBACK-rows-identical', rowsIdentical, true,
    '事务回滚后政策行与开工基线不逐字节相同 ⇒ 判负');
  judge('ROLLBACK-effective_from-unchanged', maxEff, before[0].effective_from,
    '事务回滚后 `max(effective_from)` 前移 ⇒ 判负（**新政策行已落库**）');

  // ================================================================
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S2-EFFECTIVE', run: RUN, generated_at: new Date().toISOString(),
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    rollback_discipline: 'R-8-15：两段各在自己的 withTransaction 内完成并 ROLLBACK（无 HTTP POST）',
    out, checks,
  };
  require('fs').writeFileSync(require('path').join(OUT_DIR, 'effective.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${require('path').join(OUT_DIR, 'effective.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('PROBE_CRASHED', String((e as Error)?.stack || e).slice(0, 1200)); process.exit(2); });
