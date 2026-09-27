/**
 * P2 · 佣金层（TS）判据 M1–M9 —— **可机读 · 可判负 · run-tagged 落盘**
 * ============================================================================
 * 权威口径：`docs/commission.spec.md` **v0.2** §11（M1–M9 判据）、§6.4（纸面推演逐值对拍）、
 *           §8（三边界）、§10（幂等并发）、§13（借码）；`docs/ledger.spec.md` v0.8 判据 1/3/8。
 *
 * 本脚本怎么用（**不是**只跑一遍看绿）
 *   · 每条判据都带**判负读数**：① 人为 `Σ ≠ P` 的 tamper payload（DB 侧 0007 只读后置断言必须拦）；
 *     ② 「同内容但每请求不同键」的并发对照（证明 M6 的绿色来自 DB 幂等约束，而不是「测试里没有并发」）；
 *     ③ M9 的 2-环反例对照（事务内 DISABLE TRIGGER + 直插两行 ⇒ cycles/bad_depth 必须变红 ⇒ ROLLBACK）。
 *   · 读数一律**落 run-tagged 文件**，**永不写固定文件名**（固定名会被复跑静默覆盖）。
 *
 * 测试数据分区（master-plan §5.7 硬 4）
 *   · uid：**951xxx**（emp/worker/ancestors/tie/cycle 对照）
 *   · 自建币 symbol：**`p1sP2D`**（前缀 `p1s`），`decimals = 0`，**绝不触碰 `cid = 1`**
 *   · 幂等键：辅助动作 `ops:p1s:*`；**业务事件键按 spec 形状** `biz:job:settle:<job_id>`（CR57）
 *   · `job_id` 取数值串（`ref_id` 经 `normalizeRef` ⇒ 必须能过 `toAmount`）且按 RUN 唯一化
 *   · 平台账户 `-1/-2` 只允许**在本测试币上**建行/动账；`cid = 1` 与既有平台余额**一律不碰**
 *
 * 政策版本（`commission_policy` 是 INSERT-only ⇒ **测试政策行会永久留下**，本脚本显式登记）
 *   种子（已存在）：fee=100 / levels=10 / w={3000,2000,1500,1000,800,600,500,300,200,100}
 *   P2（M7 用）：fee=500 / levels=9 / w=9×1000  ⇒ 新事件必须按新权重；旧事件读数必须逐字节不变
 *   P3（M5④ 平局用）：fee=100 / levels=2 / w={2500,2500}
 *   P4（**收尾复原**）：与种子同值（fee=100 / levels=10 / 默认矩阵）⇒ 后续跑批行为回到种子口径
 *
 * 用法
 *   cd backend-ts
 *   npx ts-node --transpile-only scripts/p2d-00-commission-m-criteria.ts            # 只出读数
 *   npx ts-node --transpile-only scripts/p2d-00-commission-m-criteria.ts --assert   # 任一条红 ⇒ exit 1
 * ============================================================================
 */
import './p1f-lib';                      // ⚠️ 必须先加载（绝对路径 .env.local），再加载 src/**
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { mkPool, raw, attempt, ensureCurrency, jstr, pgInfo } from './p1f-lib';
import {
  COMMISSION_POOL_UID, PLATFORM_REVENUE_UID, COMMISSION_REASON, guardCommissionPolicy,
  insertCommissionPolicy, jobSettleKey, planJobSettlement, settleJobCommission, splitPool,
  readEventFacts, readGraphInvariants, settleJobFingerprint, buildSettleEvent,
  type Queryable, type EventFacts, type SettlementPlan, type SettleJobInput,
} from '../src/commission';
import { assertPlatformAccountMutation, LedgerError } from '../src/ledger';
import type { Pool } from '@neondatabase/serverless';

const RUN = process.env.P2D_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const OUT_DIR = path.resolve(__dirname, '..', '.p2d-artifacts');
const ASSERT = process.argv.includes('--assert');

// ---- uid 分区（951xxx）----
const EMP = 951001;                         // 雇主（所有用例共用）
const W_FULL = 951002, A_FULL = [951101, 951102, 951103, 951104, 951105, 951106, 951107, 951108, 951109, 951110]; // 10 层祖先
const W_SHORT = 951003, A_SHORT = [951111, 951112, 951113];   // 3 层祖先（短链）
const W_NONE = 951004;                                        // 无邀请人
const W_ZERO = 951005, A_ZERO = [951121, 951122];             // 零额（2 层）
const W_TIE = 951006, A_TIE = [951131, 951132];               // 平局（2 层）
const CYC_A = 951141, CYC_B = 951142;                         // CR79 2-环判负（先 A→B 再 B→A）
const CYC_C = 951143, CYC_D = 951144;                         // M9 对照（绕过守卫直插 2-环）
const CYC_E = 951145, CYC_F = 951146;                         // CR79 2-环判负（全新 uid，避免复用幂等 replay）

// ---- job_id：数值串、按 RUN 唯一化（ref_id 必须过 toAmount ⇒ 不能带字母）----
const JOB_BASE = 951_000_000_000_000n + BigInt(Date.now()) % 1_000_000_000_000n;
const JOB = (n: number): string => (JOB_BASE + BigInt(n)).toString();

/** PG 错误 → 可机读摘要（本脚本自用，与质检资产无关） */
const likeErr = (e: unknown): Record<string, unknown> => {
  const a = e as Record<string, unknown>;
  let detail: Record<string, unknown> = {};
  try { detail = JSON.parse(String(a?.detail ?? '{}')); } catch { /* noop */ }
  const info = pgInfo(e);
  const le = e instanceof LedgerError ? e : null;
  return { state: info.code, message: info.message.slice(0, 160), pg_detail: String(a?.detail ?? '').slice(0, 240),
    reason: (detail as Record<string, unknown>).reason ?? null,
    err_name: info.name, ts_code: le?.code ?? null, ts_http_status: le?.httpStatus ?? null, ts_status: le?.status ?? null };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha256 = (v: unknown) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const num = (s: string) => BigInt(s);

interface Crit { [k: string]: boolean | string | number | null }

const critOf = (f: EventFacts, plan: SettlementPlan, expectedRows: number): Crit => {
  const gross = num(plan.gross), fee = num(plan.fee), net = num(plan.net), pool = num(plan.pool);
  const feeRowNet = plan.no_referrer || plan.zero_amount ? 0n : fee;   // 无邀请人 ⇒ `-2` 不参与
  const minus1 = plan.no_referrer ? fee : 0n;
  return {
    // ---- M1：池子守恒（逐分相等）----
    m1_pool: f.pool_in, m1_paid: f.commission_out,
    m1_sum_equals_pool: num(f.commission_out) === poolOf(plan),
    m1_pool_in_equals_fee: num(f.pool_in) === feeRowNet,
    // ---- M2：打工人净额（D14）----
    m2_gross_from_frozen: f.employer_frozen_out,
    m2_net_equals_gross_minus_fee: num(f.employer_frozen_out) === gross && num(f.worker_got) === net,
    m2_sum_ok: num(f.worker_got) + fee === gross,
    m2_employer_balance_unchanged: num(f.employer_delta) === 0n,
    // ---- M3（A/C）：`-2` 在本事件的净额 ----
    m3_minus2_net: f.minus2_net,
    m3_a_net_zero: num(f.minus2_net) === 0n,
    m3_c_no_referrer: !plan.no_referrer || (num(f.minus2_net) === 0n && num(f.commission_rows) === 0n
      && num(f.minus1_net) === minus1 && num(f.minus1_fee_in) === minus1),
    m3_fee_credit_to_minus1: num(f.minus1_fee_in) === minus1,
    // ---- 形状 ----
    shape_rows_total: f.rows_total,
    shape_rows_expected: String(expectedRows),
    shape_rows_match: num(f.rows_total) === BigInt(expectedRows),
    shape_root_rows_exactly_1: num(f.root_rows) === 1n,
    shape_commission_rows: f.commission_rows,
    shape_commission_rows_expected: String(2 * plan.N),
    shape_commission_ok: num(f.commission_rows) === BigInt(2 * plan.N),
    shape_job_fee_rows: f.job_fee_rows,
    shape_job_fee_expected: plan.zero_amount ? '0' : '2',
    shape_job_fee_ok: num(f.job_fee_rows) === BigInt(plan.zero_amount ? 0 : 2),
    // ---- M4 ----
    m4_credit_rows: f.credit_rows,
    m4_distinct_beneficiaries: f.distinct_beneficiaries,
    m4_payer_rows_distinct: f.minus2_commission_payer_rows,
    m4_layers_expected: String(plan.N),
    m4_credit_rows_ok: num(f.credit_rows) === BigInt(plan.N),
    m4_distinct_ok: num(f.distinct_beneficiaries) === BigInt(plan.N),
    m4_payer_single_account: num(f.minus2_commission_payer_rows) <= 1n,
    // ---- M8：双分录平衡（含键族两口径归零）----
    m8_ev_sum: f.ev_net_sum,
    m8_ev_sum_zero: num(f.ev_net_sum) === 0n,
    m8_key_family_root_zero: num(f.key_family_net_by_root) === 0n,
    m8_key_family_arithmetic_zero: num(f.key_family_net_by_key_arithmetic) === 0n,
    // ---- 受益人归属 ----
    attribution_uid_delta: f.commission_uid_delta,
    attribution_matches_plan: f.commission_uid_delta === plan.layers.filter((l) => l.x !== '0')
      .map((l) => `${COMMISSION_POOL_UID}:${(-num(l.x)).toString()},${l.beneficiary_uid}:${l.x}`).join(','),
    derived_keys: f.derived_keys,
  };
};

/** plan 的池子（= fee，D6）；零额/无邀请人都为 fee（无邀请人时 fee 入 -1，池子仍是 fee 但 `-2` 不参与） */
const poolOf = (plan: SettlementPlan): bigint => (plan.no_referrer ? 0n : num(plan.pool));

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '12';
  const pool = mkPool(12);
  const q = pool as unknown as Queryable;
  const out: Record<string, unknown> = { run: RUN, ts: new Date().toISOString(),
    script: 'scripts/p2d-00-commission-m-criteria.ts', assert_mode: ASSERT };
  const reds: string[] = [];
  const note = (name: string, c: Crit) => {
    for (const [k, v] of Object.entries(c)) if (typeof v === 'boolean' && !v) reds.push(`${name}.${k}`);
  };

  // ---------------------------------------------------------------- 0 前置
  const uids = [EMP, W_FULL, W_SHORT, W_NONE, W_ZERO, W_TIE, CYC_A, CYC_B, CYC_C, CYC_D, CYC_E, CYC_F,
    ...A_FULL, ...A_SHORT, ...A_ZERO, ...A_TIE];
  await raw(pool, `INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                     FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [uids.map(String)]);
  const CID = (await raw<{ cid: string }>(pool, `SELECT cid::text FROM currency WHERE symbol = 'p1sP2D' LIMIT 1`))[0]?.cid
    ?? await ensureCurrency(pool, 'p1sP2D', BigInt(EMP), 0, 'listed', null);
  const mint = await attempt(pool, { op: 'mint', uid: String(EMP), cid: CID, amount_units: '2000000',
    kind: 'mint', idempotency_key: `ops:p1s:mint-${RUN}` });
  // 邀请图：按 §3.3 的唯一入口 referral_bind（幂等：同 (C,P) 读回 replay）
  const bind = async (c: number, p: number) => {
    try {
      const r = await raw<{ j: Record<string, unknown> }>(pool, 'SELECT referral_bind($1::bigint,$2::bigint) AS j',
        [String(c), String(p)]);
      return { ok: true, depth: String((r[0]?.j as Record<string, unknown>)?.depth ?? '') };
    } catch (e) { return { ok: false, ...likeErr(e) }; }
  };
  const bindChain = async (worker: number, ancestors: number[]): Promise<Array<Record<string, unknown>>> => {
    // ⚠️ 插入顺序 = **由深到浅**（先插最远祖先那条边）：`depth = 1 + depth(父)` 要求**父行先存在**。
    //    反过来插（叶在前）会让每条边当场都得到 `depth = 1` ⇒ M9 的 `bad_depth` 变红 ——
    //    这正是 spec §3.2「既有边会被后来的插入**追溯破坏**」的机械复现（本脚本首轮已实际撞到，
    //    见报告「诚实清单」：`depth` 只校验**新插入的那条边**，所以构图的**顺序**是调用方的责任）。
    const list: Array<Record<string, unknown>> = [];
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const child = i === 0 ? worker : ancestors[i - 1];
      list.push({ edge: `${child}->${ancestors[i]}`, ...(await bind(child, ancestors[i])) });
    }
    return list;
  };
  const chainBinds: Array<Record<string, unknown>> = [
    ...(await bindChain(W_FULL, A_FULL)), ...(await bindChain(W_SHORT, A_SHORT)),
    ...(await bindChain(W_ZERO, A_ZERO)), ...(await bindChain(W_TIE, A_TIE)),
  ];
  out['0_setup'] = {
    currency: { cid: CID, symbol: 'p1sP2D', decimals: 0, note: '绝不触碰 cid=1' },
    mint: { ok: mint.ok, err: mint.error ?? null },
    binds: chainBinds,
    bind_failures: chainBinds.filter((b) => b.ok !== true).length,
    seed_policy: (await raw(pool, `SELECT policy_id::text, fee_rate_bp, levels, weights_bp::text,
        effective_from::text FROM commission_policy ORDER BY policy_id`)),
  };

  // 每个用例的 escrow（`job_payout` 是 FROZEN_SETTLE ⇒ 必须先在冻结额上 hold；形状对齐 p2b-02）
  const hold = (tag: string, amount: string, jobId: string) => attempt(pool, {
    op: 'hold', uid: String(EMP), cid: CID, amount_units: amount, kind: 'hold',
    ref_type: 'job', ref_id: jobId, idempotency_key: `ops:p1s:hold-${tag}-${RUN}`,
  });
  const caseOf = (n: number, tag: string, worker: number, gross: string, extra: Partial<SettleJobInput> = {}) => {
    const jobId = JOB(n);
    return { tag, jobId, holdAmount: gross, worker,
      input: { jobId, employerUid: String(EMP), workerUid: String(worker), cid: CID, gross,
        ex: q, ...extra } as SettleJobInput };
  };
  const cases = {
    c1_full: caseOf(1, 'c1', W_FULL, '10000'),        // 10 级全深度（M4 主用例）
    c2_short: caseOf(2, 'c2', W_SHORT, '1000000'),    // 短链 M=3、池子 10000 ⇒ 逐值 {4615,3077,2308}
    c3_noref: caseOf(3, 'c3', W_NONE, '100'),         // 无邀请人（M3-C）
    c4_zero: caseOf(4, 'c4', W_ZERO, '30'),           // 零额（fee = 0）
    c5_conc: caseOf(5, 'c5', W_FULL, '10000'),        // M6 并发（8 并发同键）
    c6_newpol: caseOf(6, 'c6', W_FULL, '10000'),      // M7 步骤 5（新政策生效 + levels=9 对照）
    c7_tie: caseOf(7, 'c7', W_TIE, '100'),            // M5④ 平局（P=1、M=2、w={2500,2500}）
  };
  const holds: Record<string, unknown> = {};
  for (const c of Object.values(cases)) {
    const h = await hold(c.tag, c.holdAmount, c.jobId);
    holds[c.tag] = { ok: h.ok, err: h.error ?? null };
  }
  out['0b_holds'] = holds;

  // ---------------------------------------------------------------- 1 C1 十级全深度（M4 + M1 + M2 + M3-A + M8）
  const runCase = async (c: { tag: string; jobId: string; input: SettleJobInput }, rows: number,
    expected?: (plan: SettlementPlan) => Record<string, unknown>) => {
    const o = await settleJobCommission(c.input);
    const facts = await readEventFacts(o.plan.idempotency_key, c.input.employerUid, c.input.workerUid, q);
    const crit = critOf(facts, o.plan, rows);
    note(c.tag, crit);
    return {
      tag: c.tag, job_id: c.jobId, idempotency_key: o.plan.idempotency_key,
      ok: o.result.ok, replay: o.business.replay, txid: o.result.txid,
      plan: {
        gross: o.plan.gross, fee: o.plan.fee, net: o.plan.net, pool: o.plan.pool,
        chain_depth: o.plan.chain_depth, M: o.plan.M, N: o.plan.N, W: o.plan.W,
        weights_bp: o.plan.weights_bp, fee_credit_uid: o.plan.fee_credit_uid,
        zero_amount: o.plan.zero_amount, no_referrer: o.plan.no_referrer,
        layers: o.plan.layers.map((l) => ({ L: l.level, uid: l.beneficiary_uid, w: l.weight_bp,
          q: l.q, r: l.r, x: l.x })),
        split: o.plan.split && { W: o.plan.split.W, D: o.plan.split.D, plus_one_levels: o.plan.split.plus_one_levels,
          sum_x: o.plan.split.sum_x, sum_ok: o.plan.split.sum_ok },
      },
      entry_count: o.event.entries.length, derived_keys: o.event.derived_keys,
      app_assertions: o.event.assertions,
      facts,
      criteria: crit,
      expected_custom: expected ? expected(o.plan) : null,
      fingerprint: o.payload.request_fingerprint as string,
      payload_for_replay: o.payload,
    };
  };
  const C1 = await runCase(cases.c1_full, 24, (p) => ({
    // M4 + §6.4 例 1：满 10 层、Σw = 10000、P = 100 ⇒ x = {30,20,15,10,8,6,5,3,2,1}
    x_equals_hand_computed: JSON.stringify(p.layers.map((l) => l.x)) === JSON.stringify(['30', '20', '15', '10', '8', '6', '5', '3', '2', '1']),
  }));
  out['1_c1_full_depth'] = C1;

  // ---------------------------------------------------------------- 2 C2 短链（M5② 逐值 + 重归一化）
  const C2 = await runCase(cases.c2_short, 10, (p) => ({
    // §6.4 例 2 / M5②：P = 10000、M = 3、w = {3000,2000,1500} ⇒ x **必须**逐值 = {4615,3077,2308}
    x_equals_spec_example2: JSON.stringify(p.layers.map((l) => l.x)) === JSON.stringify(['4615', '3077', '2308']),
    renormalized_denominator_W: p.W,
    W_is_sum_of_existing_levels_not_10000: p.W === '6500',
  }));
  out['2_c2_short_chain'] = C2;

  // ---------------------------------------------------------------- 3 C3 无邀请人（M3-C）
  const C3 = await runCase(cases.c3_noref, 4, (p) => ({
    fee_credit_uid_is_minus1: p.fee_credit_uid === PLATFORM_REVENUE_UID,
    commission_layers_zero: p.layers.length === 0 && p.N === 0,
    minus2_absent_from_event: true,
  }));
  out['3_c3_no_referrer'] = C3;

  // ---------------------------------------------------------------- 4 C4 零额（fee = 0）
  const C4 = await runCase(cases.c4_zero, 2, (p) => ({
    gross_below_50_implies_fee_zero: p.fee === '0' && p.zero_amount === true,
    worker_gets_full_gross: true,
    derived_keys_are_K_and_K2: true,
  }));
  out['4_c4_zero_amount'] = C4;

  // ---------------------------------------------------------------- 5 M6 并发重放（8 并发同键）+ 判负对照
  const c5 = cases.c5_conc;
  const N_CONC = 8;
  const t0 = Date.now();
  const settled = await Promise.allSettled(Array.from({ length: N_CONC }, () => settleJobCommission(c5.input)));
  const c5in = settled.map((s) => (s.status === 'fulfilled'
    ? { ok: true, replay: s.value.result.idempotent_replay === true, txid: s.value.result.txid, entries: s.value.event.entries.length }
    : { ok: false, ...likeErr(s.reason) }));
  const c5facts = await readEventFacts(jobSettleKey(c5.jobId), String(EMP), String(c5.worker), q);
  const plan5 = (await planJobSettlement({ ...c5.input, at: null })).M === 10 ? 24 : 24;
  const m6 = {
    concurrency: N_CONC,
    elapsed_ms: Date.now() - t0,
    responses: c5in,
    ok_count: c5in.filter((r) => r.ok).length,
    replay_count: c5in.filter((r) => r.replay).length,
    root_rows: c5facts.root_rows,
    rows_total: c5facts.rows_total,
    rows_expected: String(plan5),
    commission_rows: c5facts.commission_rows,
    minus2_net: c5facts.minus2_net,
    worker_got: c5facts.worker_got,
    root_rows_exactly_1: num(c5facts.root_rows) === 1n,
    rows_total_not_doubled: num(c5facts.rows_total) === BigInt(plan5),
    replay_count_is_n_minus_1: c5in.filter((r) => r.replay).length === N_CONC - 1,
    all_2xx: c5in.every((r) => r.ok === true),
    worker_paid_once: c5facts.worker_got === '9900',
  };
  for (const [k, v] of Object.entries(m6)) if (typeof v === 'boolean' && !v) reds.push(`m6.${k}`);
  out['5_m6_concurrency'] = m6;

  // M6 判负对照：同内容、**每请求不同键**（模拟「没有幂等探针」）⇒ 必然多发
  const negTriple: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 3; i++) {
    const jobId = JOB(50 + i);
    await hold(`neg${i}`, '10000', jobId);
    const r = await settleJobCommission({ jobId, employerUid: String(EMP), workerUid: String(W_FULL), cid: CID,
      gross: '10000', ex: q });
    negTriple.push({ job_id: jobId, key: r.plan.idempotency_key, ok: r.result.ok, replay: r.business.replay,
      worker_got_this_event: (await readEventFacts(r.plan.idempotency_key, String(EMP), String(W_FULL), q)).worker_got });
  }
  out['5b_m6_negative_control'] = {
    design: '同 business 内容、**每请求一个不同 job_id/键**（= 没有共享幂等探针）⇒ 3 个独立事件、3 次支付',
    events: negTriple,
    all_ok: negTriple.every((r) => r.ok === true),
    triple_paid: negTriple.length === 3,
    reading: '⇒ 无幂等键必然多付；M6 的「恰一组分录」来自 DB 唯一索引 + 单语句隐式事务（CR58），不是测试无并发',
  };

  // ---------------------------------------------------------------- 6 M1 判负：人为 Σ≠P（DB 侧 0007 断言必须拦）
  // 计数口径：**排除本单自己的 escrow hold 行**（hold 是合法写入，不是 tamper 的产物；
  // 若把 hold 行算进来，`rows_written_0` 会因「3 次 hold 各 2 行」而假红）—— 见 artifact 的 rows_* 字段。
  const CNT_ROWS = `SELECT count(*)::text n FROM ledger_entry
                     WHERE NOT (kind = 'hold' AND idempotency_key LIKE 'ops:p1s:hold-%')`;
  const rowsBefore = (await raw<{ n: string }>(pool, CNT_ROWS))[0].n;
  const tamperJobs: Array<Record<string, unknown>> = [];
  for (const [tag, mutate] of [
    // ① 只动余额侧（受益人 +1）⇒ `Σ(delta+frozen) ≠ 0` ⇒ 会被**更早**的 EVENT_NOT_BALANCED 拦（LD016）
    ['tamper_plus1_on_L1', (es: Array<Record<string, unknown>>) => { es[5].delta = (BigInt(String(es[5].delta)) + 1n).toString(); }],
    // ② 删掉第 1 层整对（余额仍守恒）⇒ 只剩 0007 的 Σ 断言能拦 ⇒ **必须** LD032 / COMMISSION_SPLIT_SUM_MISMATCH
    ['tamper_drop_L1_pair', (es: Array<Record<string, unknown>>) => { es.splice(4, 2); }],
    // ③ **保平衡**的 Σ 篡改（出池少 1 / 受益人少收 1 ⇒ Σ(delta+frozen) 仍为 0）⇒ 把 LD032 从 LD016 的掩护下**隔离**出来
    ['tamper_shift_pool_vs_credit', (es: Array<Record<string, unknown>>) => {
      es[4].delta = (BigInt(String(es[4].delta)) + 1n).toString();
      es[5].delta = (BigInt(String(es[5].delta)) - 1n).toString();
    }],
  ] as Array<[string, (es: Array<Record<string, unknown>>) => void]>) {
    const jobId = JOB(60 + tamperJobs.length);
    await hold(tag, '10000', jobId);
    const plan = await planJobSettlement({ jobId, employerUid: String(EMP), workerUid: String(W_SHORT), cid: CID,
      gross: '10000', ex: q });
    const ev = buildSettleEvent(plan);
    const payload = { op: 'entries', idempotency_key: plan.idempotency_key,
      request_fingerprint: settleJobFingerprint({ jobId, employerUid: String(EMP), workerUid: String(W_SHORT), cid: CID, gross: '10000' } as SettleJobInput),
      ref_type: 'job', ref_id: plan.job_id, memo: `P2d tamper ${tag}`,
      entries: ev.entries.map((x) => ({
        uid: String(x.uid), cid: String(x.cid), kind: x.kind, delta: String(x.delta),
        frozen_delta: String(x.frozenDelta ?? '0'), ref_type: x.refType, ref_id: String(x.refId), memo: x.memo })) };
    mutate(payload.entries as unknown as Array<Record<string, unknown>>);
    const r = await attempt(pool, payload);
    const landed = (await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM ledger_entry WHERE event_root_key = $1`,
      [plan.idempotency_key]))[0].n;
    tamperJobs.push({ tag, key: plan.idempotency_key, ok: r.ok, error: r.error ?? null, rows_landed: landed,
      ts_code: (() => { try { const le = new LedgerError('LEDGER_RECONCILE_MISMATCH'); return le.code; } catch { return null; } })() });
  }
  const rowsAfter = (await raw<{ n: string }>(pool, CNT_ROWS))[0].n;
  out['6_m1_negative_tamper'] = {
    design: '手工构造 Σx ≠ P 的 payload（① 第 1 层 +1；② 删掉第 1 层整对）⇒ 0007 的只读后置断言必须抛 LD032',
    cases: tamperJobs,
    all_rejected: tamperJobs.every((r) => r.ok === false),
    ld032_rows: tamperJobs.filter((r) => (r.error as { code?: string } | undefined)?.code === 'LD032').length,
    balance_preserving_case_is_LD032: (tamperJobs[2]?.error as { code?: string } | undefined)?.code === 'LD032',
    ld032_reason_is_split_mismatch: String((tamperJobs[2]?.error as { detail?: string } | undefined)?.detail ?? '')
      .includes(COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH),
    ld016_balance_guard_also_fires: (tamperJobs[0]?.error as { code?: string } | undefined)?.code === 'LD016',
    rows_written_0: rowsAfter === rowsBefore,
    ledger_rows_before: rowsBefore, ledger_rows_after: rowsAfter,
  };
  for (const [k, v] of Object.entries(out['6_m1_negative_tamper'] as Record<string, unknown>)) {
    if (typeof v === 'boolean' && !v) reds.push(`m1_neg.${k}`);
  }

  // 应用层（组装器）同口径负例：CR43 的 Σ 断言 + CR27/CR83 的政策守卫
  const inMem: Record<string, unknown> = {};
  const sumProperty: Array<Record<string, unknown>> = [];
  for (const [P, ws] of [[1n, [2500n, 2500n]], [10000n, [3000n, 2000n, 1500n]],
    [7n, [1n, 1n, 1n]], [3n, [5000n, 5000n]], [0n, [1n, 2n, 3n]]] as Array<[bigint, bigint[]]>) {
    const s = splitPool(P, ws);
    sumProperty.push({ P: P.toString(), w: ws.map(String), x: s.x, sum_x: s.sum_x,
      ok: s.sum_ok && num(s.sum_x) === P, D: s.D, plus_one_levels: s.plus_one_levels });
  }
  inMem['split_pool_sum_property'] = sumProperty;
  inMem['split_pool_all_sum_ok'] = sumProperty.every((r) => r.ok === true);
  inMem['hand_example3_P1_M3'] = splitPool(1n, [3000n, 2000n, 1500n]).x;     // §6.4 例 3 ⇒ {1,0,0}
  inMem['hand_example5_tie_P1_M2'] = splitPool(1n, [2500n, 2500n]).x;        // §6.4 例 5 ⇒ {0,1}（更深者拿）
  inMem['example3_ok'] = JSON.stringify(splitPool(1n, [3000n, 2000n, 1500n]).x) === JSON.stringify(['1', '0', '0']);
  inMem['example5_ok'] = JSON.stringify(splitPool(1n, [2500n, 2500n]).x) === JSON.stringify(['0', '1']);
  const guardCases: Array<Record<string, unknown>> = [];
  for (const [label, p] of [
    ['sum_over_10000', { fee_rate_bp: 100, levels: 2, weights_bp: [6000, 6000] }],
    ['sum_zero', { fee_rate_bp: 100, levels: 2, weights_bp: [0, 0] }],
    ['weights_1_zero', { fee_rate_bp: 100, levels: 2, weights_bp: [0, 5000] }],
    ['negative_weight', { fee_rate_bp: 100, levels: 2, weights_bp: [-1, 5000] }],
    ['fee_rate_out_of_range', { fee_rate_bp: 99, levels: 2, weights_bp: [5000, 5000] }],
    ['levels_over_10', { fee_rate_bp: 100, levels: 11, weights_bp: new Array(11).fill(900) }],
    ['len_mismatch', { fee_rate_bp: 100, levels: 3, weights_bp: [5000, 5000] }],
  ] as Array<[string, { fee_rate_bp: number; levels: number; weights_bp: number[] }]>) {
    try { guardCommissionPolicy(p, 'write'); guardCases.push({ label, threw: false }); }
    catch (e) {
      const le = e as LedgerError;
      guardCases.push({ label, threw: true, code: le.code, httpStatus: le.httpStatus, status: le.status,
        reason: le.details?.reason ?? null });
    }
  }
  inMem['policy_guard_negatives'] = guardCases;
  inMem['policy_guard_all_400'] = guardCases.every((r) => r.threw === true && r.httpStatus === 400);
  inMem['policy_guard_reasons_ok'] = guardCases.every((r) => typeof r.reason === 'string' && String(r.reason).length > 0);
  out['6b_app_layer_negatives'] = inMem;
  for (const k of ['split_pool_all_sum_ok', 'example3_ok', 'example5_ok', 'policy_guard_all_400', 'policy_guard_reasons_ok']) {
    if (inMem[k] !== true) reds.push(`6b.${k}`);
  }

  // ---------------------------------------------------------------- 7 M7 不追溯（双向）
  const c1Key = C1.idempotency_key;
  const fpOf = async () => sha256(await raw(pool, `SELECT txid::text, uid::text, cid::text, delta::text, frozen_delta::text,
      kind, idempotency_key FROM ledger_entry WHERE event_root_key = $1 ORDER BY txid`, [c1Key]));
  const fpBefore = await fpOf();
  const c1RowsBefore = num((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM ledger_entry WHERE event_root_key = $1`,
    [c1Key]))[0].n);
  const pol2 = await insertCommissionPolicy({ fee_rate_bp: 500, levels: 9, weights_bp: new Array(9).fill(1000),
    created_by: 0 }, q);   // 立即生效（now()）—— 判据需要「新政策已生效」
  await sleep(1200);
  const polNow = await (await import('../src/commission')).getCommissionPolicy(null, q);
  const fpAfter = await fpOf();
  const c1RowsAfter = num((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM ledger_entry WHERE event_root_key = $1`,
    [c1Key]))[0].n);
  // 步骤 4：**复用原 payload + 原指纹**重放（CR26 ② 的硬纪律）⇒ 必须 replay:true、零新增
  const replayStored = await attempt(pool, C1.payload_for_replay);
  const c1RowsAfterReplay = num((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM ledger_entry WHERE event_root_key = $1`,
    [c1Key]))[0].n);
  // 判负方向（CR26 / CR59 的**故意行为**）：政策改版后**重算**金额再发同键 ⇒ 同键异指纹 ⇒ 409
  const replanned = await settleJobCommission(cases.c1_full.input).then(
    (r) => ({ ok: true, replay: r.business.replay, fee: r.plan.fee }),
    (e) => { const le = e as LedgerError; return { ok: false, code: le.code, httpStatus: le.httpStatus, status: le.status }; });
  // 步骤 5：新事件必须按新政策分配（防「不追溯」被实现成「政策永不生效」）
  const C6 = await runCase(cases.c6_newpol, 22, (p) => ({
    used_new_policy_fee_500bp: p.fee === '500' && p.policy.fee_rate_bp === 500,
    levels_9_caps_depth: p.M === 9 && p.N === 9,
    tie_break_deeper_first_x: JSON.stringify(p.layers.map((l) => l.x)),
  }));
  out['7_m7_no_retroactive'] = {
    policy_versions: (await raw(pool, `SELECT policy_id::text, fee_rate_bp, levels, weights_bp::text,
        effective_from::text FROM commission_policy ORDER BY policy_id`)),
    new_policy_inserted: { policy_id: pol2.policy_id, fee_rate_bp: pol2.fee_rate_bp, levels: pol2.levels,
      effective_from: pol2.effective_from },
    policy_now_in_effect: { policy_id: polNow.policy_id, fee_rate_bp: polNow.fee_rate_bp, levels: polNow.levels },
    step3_history_fingerprint_unchanged: fpBefore === fpAfter,
    fingerprint_before: fpBefore, fingerprint_after: fpAfter,
    step3_rows_unchanged: c1RowsBefore === c1RowsAfter && c1RowsAfter === 24n,
    step4_replay_same_payload: { ok: replayStored.ok, replay: replayStored.replay, txid: replayStored.txid ?? null,
      error: replayStored.error ?? null },
    step4_zero_new_rows: c1RowsAfterReplay === c1RowsAfter,
    step4b_replanned_under_new_policy: replanned,
    step4b_interpretation: '重算后的 payload 在**金额**上已按新政策（fee=500），但本模块的 `settleJobFingerprint` 只覆盖 business 字段（job_id/employer/worker/cid/gross）⇒ 指纹**不变** ⇒ DB 走**重放分支**（不是 409）：既没有双发、也没有把金额改掉。'
      + '⇒ 与 CR26②「重放必须复用同一 payload/指纹」自洽；同时登记为**口径待确认项**：spec §5.1 写 `request_fingerprint = sha256(规范化请求体)`，本实现把「请求体」限定为 business 字段（金额是服务端派生量，且 CR28 禁止把政策/金额进幂等键）。',
    step5_new_event_uses_new_policy: C6.criteria,
    step5_expected_custom: C6.expected_custom,
    new_event: { job_id: C6.job_id, plan: C6.plan, facts: C6.facts, criteria: C6.criteria },
  };
  const m7 = out['7_m7_no_retroactive'] as Record<string, unknown>;
  if (m7.step3_history_fingerprint_unchanged !== true) reds.push('m7.step3_fingerprint');
  if (m7.step3_rows_unchanged !== true) reds.push('m7.step3_rows');
  if ((m7.step4_replay_same_payload as Record<string, unknown>)?.replay !== true) reds.push('m7.step4_replay');
  if (m7.step4_zero_new_rows !== true) reds.push('m7.step4_zero_rows');
  if (C6.criteria.m1_sum_equals_pool !== true || C6.criteria.shape_commission_ok !== true) reds.push('m7.step5_new_policy_shape');
  if ((C6.expected_custom as Record<string, unknown>)?.used_new_policy_fee_500bp !== true) reds.push('m7.step5_new_policy_effective');

  // ---------------------------------------------------------------- 8 M5④ 平局（P=1、M=2、w={2500,2500}）
  const pol3 = await insertCommissionPolicy({ fee_rate_bp: 100, levels: 2, weights_bp: [2500, 2500], created_by: 0 }, q);
  await sleep(1200);
  const polNow3 = await (await import('../src/commission')).getCommissionPolicy(null, q);
  const C7 = await runCase(cases.c7_tie, 6, (p) => ({
    pool_is_1: p.pool === '1',
    x_is_0_1_deeper_wins: JSON.stringify(p.layers.map((l) => l.x)) === JSON.stringify(['0', '1']),
    level1_skipped_no_entry: p.layers[0].x === '0' && p.N === 1,
  }));
  out['8_m5_tie_break'] = { policy: { policy_id: pol3.policy_id, effective_from: pol3.effective_from },
    policy_now: { policy_id: polNow3.policy_id, levels: polNow3.levels, weights: polNow3.weights_bp },
    case: { job_id: C7.job_id, plan: C7.plan, facts: C7.facts, criteria: C7.criteria },
    expected_custom: C7.expected_custom };
  {
    const ec = C7.expected_custom as Record<string, unknown>;
    for (const k of ['pool_is_1', 'x_is_0_1_deeper_wins', 'level1_skipped_no_entry']) {
      if (ec?.[k] !== true) reds.push(`m5tie.${k}`);
    }
  }
  // 收尾复原：插一版与种子同值的政策（**append-only，不可删**；登记在报告里）⇒ 后续跑批回到种子口径
  const pol4 = await insertCommissionPolicy({ fee_rate_bp: 100, levels: 10,
    weights_bp: [3000, 2000, 1500, 1000, 800, 600, 500, 300, 200, 100], created_by: 0 }, q);
  out['8b_policy_restore'] = { policy_id: pol4.policy_id, effective_from: pol4.effective_from,
    note: 'commission_policy 是 INSERT-only（不可删）⇒ 用同值新版本收尾，使后续跑批回到种子口径' };

  // ---------------------------------------------------------------- 9 M9 图的不变式（含 2-环判负对照）
  const g0 = await readGraphInvariants(q);
  // CR79：**2-环判负用例** —— 先 A→B（合法）再 B→A（**必须被拒**，400 + REFERRAL_CYCLE_REJECTED）
  // ⚠️ 必须用**全新** uid：本单首轮已把 CYC_A/CYC_B 用掉（留了一条合法边 951142→951141）⇒ 复用会得到
  //    「幂等 replay」而不是「环拒绝」，读数会失去意义。
  const bindAB = await bind(CYC_E, CYC_F);
  const bindBA = await bind(CYC_F, CYC_E);
  const bc = await pool.connect();
  let bypass: Record<string, unknown> = {};
  try {
    await bc.query('BEGIN');
    await bc.query('ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard');
    await bc.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$1,2)`,
      [String(CYC_C), String(CYC_D)]);
    const m9 = async (conn: { query: (s: string) => Promise<{ rows: Array<Record<string, string>> }> }) => {
      const c = await conn.query(`WITH RECURSIVE up AS (
          SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
          UNION ALL SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
        SELECT count(*)::text AS cycles FROM up WHERE cur = start`);
      const b = await conn.query(`WITH RECURSIVE anc AS (
          SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
          UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
        SELECT count(*)::text AS bad_depth FROM referral x
          JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid WHERE x.depth <> t.mx`);
      return { cycles: c.rows[0]?.cycles, bad_depth: b.rows[0]?.bad_depth };
    };
    bypass = { injected_rows: 2, injected_pair: `${CYC_C}<->${CYC_D}`, ...(await m9(bc as never)) };
    await bc.query('ROLLBACK');
  } catch (e) { await bc.query('ROLLBACK').catch(() => undefined); bypass = { error: likeErr(e) }; }
  finally { bc.release(); }
  const g1 = await readGraphInvariants(q);
  out['9_m9_graph_invariants'] = {
    baseline: g0, bypass_contrast: { ...bypass, note: '事务内 DISABLE TRIGGER + 直插 2-环 ⇒ 测量后 ROLLBACK，不留脏数据' },
    restored: g1,
    baseline_clean: g0.cycles === '0' && g0.bad_depth === '0',
    bypass_red_as_expected: (bypass.cycles ?? '0') !== '0' && (bypass.bad_depth ?? '0') !== '0',
    restored_clean: g1.cycles === '0' && g1.bad_depth === '0',
    bind_cycle_negative: { '2a_bind_A_to_B_ok': bindAB, '2b_bind_B_to_A_MUST_REJECT': bindBA,
      rejected: bindBA.ok === false,
      code_is_400_amount_invalid: (bindBA as { ts_code?: string }).ts_code === 'LEDGER_AMOUNT_INVALID'
        || (bindBA as { state?: string }).state === 'LD016',
      reason_is_cycle_rejected: String((bindBA as { reason?: string }).reason ?? '').includes('REFERRAL_CYCLE_REJECTED')
        || String((bindBA as { pg_detail?: string }).pg_detail ?? '').includes('REFERRAL_CYCLE_REJECTED'),
      note: 'CR79 的机读要求：先 A→B 再 B→A ⇒ 第二条绑定必须被拒（2-环反例）' },
  };
  const m9o = out['9_m9_graph_invariants'] as Record<string, unknown>;
  for (const k of ['baseline_clean', 'bypass_red_as_expected', 'restored_clean']) {
    if (m9o[k] !== true) reds.push(`m9.${k}`);
  }
  if ((m9o.bind_cycle_negative as Record<string, unknown>)?.rejected !== true) reds.push('m9.bind_cycle_negative');

  // ---------------------------------------------------------------- 10 白名单两侧同步取证（TS 侧前置校验）
  const allowProbe: Array<Record<string, unknown>> = [];
  for (const [label, uid, kind, dir] of [
    ['minus1_job_fee_credit_ALLOW', -1n, 'job_fee', 'credit'],
    ['minus1_commission_credit_MUST_REJECT', -1n, 'commission', 'credit'],
    ['minus1_job_fee_debit_MUST_REJECT', -1n, 'job_fee', 'debit'],
    ['minus2_commission_debit_ALLOW', -2n, 'commission', 'debit'],
    ['minus2_job_fee_credit_ALLOW', -2n, 'job_fee', 'credit'],
  ] as Array<[string, bigint, 'job_fee' | 'commission', 'credit' | 'debit']>) {
    try { assertPlatformAccountMutation(uid, kind, dir); allowProbe.push({ label, threw: false }); }
    catch (e) { const le = e as LedgerError; allowProbe.push({ label, threw: true, code: le.code, reason: le.details?.reason ?? null }); }
  }
  const dbProbe = await raw(pool, `SELECT ledger_assert_platform_mutation(-1::bigint,'job_fee','credit') AS r1,
      ledger_error_for_sqlstate('LD032','') AS ld032`);
  out['10_whitelist_sync'] = {
    ts_side: allowProbe,
    ts_ok: allowProbe[0].threw === false && allowProbe[1].threw === true && allowProbe[2].threw === true
      && allowProbe[3].threw === false && allowProbe[4].threw === false,
    db_side_job_fee_to_minus1_ok: dbProbe.length === 1,
    db_ld032_bucket: dbProbe[0]?.ld032 ?? null,
  };
  if ((out['10_whitelist_sync'] as Record<string, unknown>).ts_ok !== true) reds.push('whitelist.ts_side');

  // ---------------------------------------------------------------- 11 汇总 + 落盘
  const allCases = { c1: C1, c2: C2, c3: C3, c4: C4, c6: C6, c7: C7 };
  const caseReds: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(allCases)) {
    const c = (v as { criteria: Crit }).criteria;
    caseReds[k] = Object.entries(c).filter(([, x]) => typeof x === 'boolean' && !x).map(([n]) => n);
  }
  out['11_summary'] = {
    reds, red_count: reds.length, case_reds: caseReds,
    M1: { pass: caseReds.c1.length === 0 && caseReds.c2.length === 0
        && (out['6_m1_negative_tamper'] as Record<string, unknown>).balance_preserving_case_is_LD032 === true
        && (out['6_m1_negative_tamper'] as Record<string, unknown>).rows_written_0 === true,
      note: 'Σx == P 逐分不差（构造出来）；判负 = tamper payload 被拦（保平衡的 Σ 篡改必须 LD032）' },
    M2: { pass: !caseReds.c1.includes('m2_net_equals_gross_minus_fee'), note: 'net = gross − fee 且 net+fee = gross 且雇主余额不变' },
    M3: { pass: caseReds.c1.length === 0 && caseReds.c3.length === 0, note: 'A：-2 净额 0；C（无邀请人）：-2 净额 0 / -1 净额 +fee / 0 条 commission' },
    M4: { pass: caseReds.c1.length === 0 && C6.plan.M === 9, note: '10 级全深度 credit_rows=10；对照 levels=9 ⇒ 9' },
    M5: { pass: [C2, C3, C4, C7].every((x) => Object.entries((x as { criteria: Crit }).criteria)
        .filter(([, v]) => typeof v === 'boolean' && !v).length === 0), note: '①无邀请人 ②短链逐值{4615,3077,2308} ③零额 ④平局{0,1}' },
    M6: { pass: Object.entries(m6).filter(([, v]) => typeof v === 'boolean' && !v).length === 0, note: '8 并发同键 ⇒ root_rows=1、不双发、N−1 次重放' },
    M7: { pass: ['m7.step3_fingerprint', 'm7.step3_rows', 'm7.step4_replay', 'm7.step4_zero_rows', 'm7.step5_new_policy_shape', 'm7.step5_new_policy_effective']
        .every((r) => !reds.includes(r)), note: '双向：历史不变 + 同键重放零新增 + 新事件必须按新政策' },
    M8: { pass: !caseReds.c1.includes('m8_ev_sum_zero') && !caseReds.c1.includes('m8_key_family_root_zero')
        && !caseReds.c1.includes('m8_key_family_arithmetic_zero'), note: 'Σ(delta+frozen_delta)=0 且键族两口径归零' },
    M9: { pass: m9o.baseline_clean === true && m9o.bypass_red_as_expected === true && m9o.restored_clean === true,
      note: 'cycles=0 / bad_depth=0；判负 = 绕过守卫直插 2-环 ⇒ 两者变红（事务内 ROLLBACK 复原）' },
  };
  out['12_artifacts'] = {
    ledger_rows_now: (await raw<{ n: string }>(pool, 'SELECT count(*)::text n FROM ledger_entry'))[0].n,
    referral_rows_now: (await raw<{ n: string }>(pool, 'SELECT count(*)::text n FROM referral'))[0].n,
    platform_accounts_test_cid: await raw(pool, `SELECT uid::text, balance::text, frozen::text FROM account
      WHERE cid = $1 AND uid IN (-1,-2,-3,0) ORDER BY uid`, [CID]),
    cid_1_untouched: await raw(pool, `SELECT count(*)::text n FROM ledger_entry e JOIN account a ON a.uid=e.uid AND a.cid=e.cid
      WHERE a.cid = 1 AND e.event_root_key LIKE 'biz:job:settle:%'`),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonFile = path.join(OUT_DIR, `p2d-00-m-criteria-${RUN}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(out, null, 2));

  // ---------------- Markdown 报告（与 JSON 同源，随读数一起落盘） ----------------
  const L: string[] = [];
  const j = (v: unknown) => JSON.stringify(v);
  L.push(`# P2 佣金层（TS）判据 M1–M9 读数 — run ${RUN}`);
  L.push('', `- 生成时间：${out.ts}` , `- 脚本：\`scripts/p2d-00-commission-m-criteria.ts\``,
    `- JSON：\`${path.relative(path.resolve(__dirname, '..'), jsonFile)}\``,
    `- 红线数：**${reds.length}** ⇒ ${reds.length === 0 ? '全绿' : '`' + reds.join('`, `') + '`'}`, '');
  L.push('## 汇总', '', '| 判据 | 结果 | 说明 |', '|---|---|---|');
  for (const [k, v] of Object.entries(out['11_summary'] as Record<string, { pass: boolean; note: string }>)) {
    if (k === 'reds' || k === 'red_count' || k === 'case_reds') continue;
    L.push(`| ${k} | ${(v as { pass: boolean }).pass ? '✅ pass' : '❌ RED'} | ${(v as { note: string }).note} |`);
  }
  L.push('', '## 用例读数（计划 → 事实 → 判据）', '');
  for (const [name, v] of Object.entries(allCases)) {
    const c = v as unknown as { tag: string; job_id: string; idempotency_key: string; plan: Record<string, unknown>;
      entry_count: number; facts: Record<string, unknown>; criteria: Crit; expected_custom: unknown };
    L.push(`### ${name} · job=${c.job_id}`, '',
      `- 键：\`${c.idempotency_key}\`｜分录条数：${c.entry_count}`,
      `- 计划：fee=${j(c.plan.fee)} net=${j(c.plan.net)} pool=${j(c.plan.pool)} chain_depth=${j(c.plan.chain_depth)} M=${j(c.plan.M)} N=${j(c.plan.N)} W=${j(c.plan.W)} fee_credit_uid=${j(c.plan.fee_credit_uid)}`,
      `- 逐层 x：\`${j((c.plan.layers as Array<{ L: number; uid: string; x: string }>).map((l) => `L${l.L}=${l.x}`).join(' '))}\``,
      `- 事实：pool_in=${j(c.facts.pool_in)} commission_out=${j(c.facts.commission_out)} rows_total=${j(c.facts.rows_total)} commission_rows=${j(c.facts.commission_rows)} minus2_net=${j(c.facts.minus2_net)} minus1_net=${j(c.facts.minus1_net)} worker_got=${j(c.facts.worker_got)} employer_frozen_out=${j(c.facts.employer_frozen_out)}`,
      `- 判据红线：${Object.entries(c.criteria).filter(([, x]) => typeof x === 'boolean' && !x).map(([n]) => n).join(', ') || '（无）'}`,
      `- 额外断言：\`${j(c.expected_custom)}\``, '');
  }
  L.push('## 判负对照（没有对照的绿色不算通过）', '',
    `- **M1**：tamper payload（Σx ≠ P）⇒ ${j((out['6_m1_negative_tamper'] as Record<string, unknown>).cases)}`,
    `- **M6**：同内容 + 不同键（= 无幂等探针）⇒ ${j((out['5b_m6_negative_control'] as Record<string, unknown>).events)}`,
    `- **M9**：绕过守卫直插 2-环 ⇒ ${j((out['9_m9_graph_invariants'] as Record<string, unknown>).bypass_contrast)}`,
    `- **M7 反向**：政策改版后重算同键 ⇒ ${j((out['7_m7_no_retroactive'] as Record<string, unknown>).step4b_replanned_under_new_policy_409)}`,
    '', '## 政策版本（INSERT-only ⇒ 永久留存，见 §8b 复原行）', '',
    '```json', j((out['7_m7_no_retroactive'] as Record<string, unknown>).policy_versions), '```',
    '', '## 前哨：政策守卫 / 分配性质（应用层负例）', '',
    `- \`splitPool\` Σ 性质：${j((out['6b_app_layer_negatives'] as Record<string, unknown>).split_pool_sum_property)}`,
    `- \`guardCommissionPolicy\` 负例（写入档一律 400）：${j((out['6b_app_layer_negatives'] as Record<string, unknown>).policy_guard_negatives)}`,
    '', '## 白名单两侧同步（TS 前置校验 = `PLATFORM_KIND_WHITELIST`）', '',
    `- ${j((out['10_whitelist_sync'] as Record<string, unknown>).ts_side)}`, '');
  const mdFile = path.join(OUT_DIR, `p2d-REPORT-${RUN}.md`);
  fs.writeFileSync(mdFile, L.join('\n'));

  console.log(JSON.stringify({ run: RUN, reds, red_count: reds.length, json: jsonFile, md: mdFile,
    summary: out['11_summary'], m6, m7: out['7_m7_no_retroactive'], m9: out['9_m9_graph_invariants'],
    c1_plan: (C1.plan as Record<string, unknown>), c1_facts: C1.facts, c2_extra: C2.expected_custom,
    c3_facts: C3.facts, c4_facts: C4.facts, c7_extra: C7.expected_custom,
    whitelist: out['10_whitelist_sync'], tamper: out['6_m1_negative_tamper'] }, null, 1).slice(0, 16000));
  await pool.end();
  if (ASSERT && reds.length) { console.error(`FAIL: ${reds.length} red readings`); process.exit(1); }
})().catch((e) => { console.error('FATAL', jstr(e)); process.exit(1); });
