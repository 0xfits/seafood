/**
 * p2w-00 · P2 独立质检（不通过）修复单的**验收探针** —— 六项缺陷的判据 + 判负对照，run-tagged 落盘。
 * ==========================================================================
 * 被测对象：`src/commission.ts`（F1 / F7① / F7②）+ `migrations/0011`（F3 / F6 / F2）。
 * 用法：`npx ts-node --transpile-only scripts/p2w-00-p2fix-verify.ts [--assert]`
 *       `--assert` ⇒ 有红项则退出码 1（回归用）；读数落 `.p2w-artifacts/p2w-00-verify-<RUN>.{json,txt}`。
 * 退出码：0 全绿 / 1 判红（`--assert`）/ 2 致命 / 3 前置不满足（命名空间分配失败，明白话见 stdout+stderr）
 *
 * ---------------------------------------------------------------- 可重跑设计（本次修订，#2）
 * 上一版**不可重跑**，且两次失败**同因**（不是「夹具没复位」）：
 *   ① **命名空间固定**：uid 写死 `956xxx`、symbol 由 `RUNTAG` 派生、job 号段由 `RUNTAG` 派生。
 *      本机 shell **导出了 `P2W_RUN=pre011-…`** ⇒ 两次运行的 `RUNTAG` 完全相同 ⇒ 同一个 `symbol` /
 *      同一批 job id / 同一批幂等键 ⇒ 第二跑与第一跑**共用一份已被真落账消耗掉的账户状态**。
 *   ② **托管夹具的 mint 从未成功**（真根因，库上取证 + 探针复现见报告）：
 *      `ensureCurrency(p, SYM, '0', 8)` 造出的币 `owner_uid = 0`（平台），而 `mint` 的授权口径是
 *      「`owner_uid > 0` ⇒ 只许 owner 自铸；`owner_uid = 0` ⇒ 必须带 `platform: true` 受信标记」
 *      ⇒ 演员 uid 956001 的 mint 一律 `LD014 LEDGER_UNAUTHORIZED_MINT`。夹具 mint/hold 全灭后，
 *      §A 的**正向对照** `settleJobCommission`（唯一没有 try 包裹的落账调用）抛
 *      `LD002 LEDGER_INSUFFICIENT_FROZEN {cid:'…', uid:'956001', required:'99000', available:'0'}`
 *      ⇒ 顶层 `FATAL` + `exit 2`。**「上一跑的结算把托管余额花掉了」这个诊断是错的**：
 *      cid 180 名下**没有任何** account 行、`ops:p1w:` 键下**没有任何** ledger 行（supply = 0）。
 *   ⇒ 本次修订：① 一律走 `scripts/ns-alloc.ts`（**共享唯一实现**）取「本跑独占的新命名空间」
 *      （uid 窗口 / 币 symbol / 幂等键前缀 / job 号段；每次运行都不同且逐个验证未被占用）；
 *      ② 币的 `owner_uid` = 雇主（夹具演员）⇒ mint 走「owner 自铸」授权路径；
 *      ③ 夹具成功与否**进判据**（`F0x`），夹具坏了就判红（而不是让后面的落账抛 FATAL 把证据打碎）。
 *
 * ---------------------------------------------------------------- 数据分区
 * uid **959xxx**（本跑独占窗口，`959001..959949`）/ symbol 前缀 **p1y** / 幂等键前缀 **`ops:p1y:*`**。
 * 绝不触碰 `cid = 1` 与平台账户 0/-1/-2/-3 的既有余额；破坏性探针一律跑在**回滚事务**里（末尾一律 ROLLBACK，
 * 且每次尝试都用 SAVEPOINT 包裹 —— 事务内一次报错即整事务 aborted，不包 SAVEPOINT 会让后续判据全部失真）。
 *
 * ---------------------------------------------------------------- 判据（逐条对应质检单）
 *   §A F1  坏链（2-环污染）⇒ `planJobSettlement`/`settleJobCommission` **落账前**响亮拒绝：
 *           500 类（`LEDGER_RECONCILE_MISMATCH` / `httpStatus=500`）+ reason
 *           `COMMISSION_CHAIN_ASSERTION_VIOLATED` + `failed_assertions` 含 `no_duplicate_uid`；
 *           **判负对照**：绕过 TS 闸、按同一份污染链手工组装载荷 ⇒ DB 侧 Σ 触发器 `ok=true` 放行
 *           （证明「DB 只保总量不保归属」，故 TS 闸是唯一防线）；**正向对照**：健康链照常出计划并落账。
 *   §B F7① `chain_truncated` 区分「恰好 cap」与「≥ cap」（同 `chain_depth` 下取值不同）；
 *           旧字段 `chain_depth` 语义未动。
 *   §C F7② 幂等重放返回的 `plan` 由**账上事件**导出（与账上读数逐字段相等），`plan_source` 可分辨；
 *           同键按**新政策**重算的金额与返回的 `plan` **不同**（证明未用当前政策重算）。
 *   §D F3  ①`SET CONSTRAINTS ALL IMMEDIATE` 前置 ⇒ 真事件不再假报 LD032；②真 Σ 不符（丢一对佣金 /
 *           只入不出两形态）在**显式裁决点**（`SET CONSTRAINTS ALL IMMEDIATE` = 提交点等价）落
 *           LD032 + `COMMISSION_SPLIT_SUM_MISMATCH` —— 旧版「只 `DEFERRED` 不 flush」⇒ 闸永无裁决机会
 *           （= 探针口径错，定案见 `docs/audit/p3-baseline-rca.md` §1.1 D4/D5）；
 *           ③默认路径与「先落账再强制结算」行为不变；④D7 与同套件 D6 **同口径**（登记不判；依据行号见脚本内注释）；
 *           ⑤判负自证两路：同裁决点**合法**事件不报（灵敏度·合法侧）+ **摘掉该闸**后同形篡改不再报（灵敏度·闸侧）。
 *   §E F6  「child 已绑」由裸 `INSERT` 与 `referral_bind` 两条路径 ⇒ **同码同 reason**（LD003）；
 *           判负对照（**可对照形态**）：关掉守卫 ⇒ 字面 `depth=1` 首插成功、重绑退回 `23505`/`referral_pk`；
 *           原杆 `depth=0` 的 `23514`（摘杆连带摘掉 `0011:252` 的 depth 计算）**保留为第二路读数**（登记性断言）。
 *   §F F2  父存储 `depth` 陈旧 ⇒ 绑定被拒（LD016 + `REFERRAL_PARENT_DEPTH_INCONSISTENT`）；
 *           父 depth 一致 ⇒ 放行；判负对照：旧期望「摘杆后自动继承 50⇒51」**显式标为不可达**（= `0011:252` 本身，
 *           登记不判），改为**手写等价继承式**的可达对照（父 50 ⇒ 子 51 可写入）。
 *   §G 尾  全局图不变式 / 触发器启用态 / cid=1 平台账户未被触碰 / 残留登记（**限定在本跑命名空间内**）。
 * ==========================================================================
 */
import {
  COMMISSION_REASON, LedgerError, planJobSettlement, settleJobCommission, getReferralChain,
  readEventFacts, readLedgerSettlement, readLedgerEventRows, readGraphInvariants,
  buildSettleEvent, splitPool, toPayloadEntry, settleJobFingerprint, getCommissionPolicy,
  jobSettleKey, COMMISSION_POOL_UID,
  COMMISSION_CAP_LAYER_DEFAULT, COMMISSION_CAP_TOTAL_DEFAULT,
  type SettlementPlan, type SettleJobInput,
} from '../src/commission';
import {
  mkPool, raw, raw1, save, saveText, tryFn, callFn, trySql, inRollbackTx, ensureUsers, ensureCurrency,
  mintTo, holdFor, triggerEnablement, sha256, pgErr, RUN, type Qx, type PgErr,
} from './p2w-lib';
import { allocNamespace, exitPrecondition, occupiedUids, windowUids } from './ns-alloc';

const ASSERT_MODE = process.argv.includes('--assert');
const reds: string[] = [];
const reads: Record<string, unknown> = {};
const judge = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) reds.push(extra === undefined ? name : `${name} :: ${JSON.stringify(extra)}`);
};
const rec = (k: string, v: unknown) => { reads[k] = v; };
const errInfo = (e: unknown): Record<string, unknown> => {
  if (e instanceof LedgerError) {
    return { kind: 'LedgerError', code: e.code, httpStatus: e.httpStatus, status: e.status,
      reason: (e.details?.reason as string) ?? null, details: e.details };
  }
  return { kind: 'other', message: String((e as Error)?.message ?? e) };
};
const planRead = (p: SettlementPlan) => ({
  job_id: p.job_id, fee: p.fee, net: p.net, gross: p.gross, pool: p.pool,
  chain_depth: p.chain_depth, chain_truncated: p.chain_truncated, plan_source: p.plan_source,
  policy_reported: p.policy_reported, policy_id: p.policy.policy_id, fee_rate_bp: p.policy.fee_rate_bp,
  M: p.M, N: p.N, layers: p.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`),
  fee_credit_uid: p.fee_credit_uid, no_referrer: p.no_referrer, zero_amount: p.zero_amount,
});

// ---------------------------------------------------------------- 本跑独占命名空间（见文件头「可重跑设计」）
const WIN_SIZE = 45;                       // 槽位数（下表合计 45）
const WIN_STRIDE = 50;                     // 窗口基准步长
const WIN_PARTITION: readonly [number, number] = [959001, 959949];   // uid 959xxx（959950+ 留给 p2w-01 自测块）
const SLOT = {
  EMP: 0, W_SHORT: 1, W_DEEP: 2, W_EV3: 3, W_F7B1: 4, W_EXACT10: 5,
  ANC3: 6, ANC12: 7, ANC3C: 19, ANC2: 22, ANC10: 24, POISON: 34, PROBE2: 36,
} as const;
const GROSS_STD = '100000';   // levels=10 ⇒ fee=1000 ⇒ 20 条 commission + 4 = 24 条分录

(async () => {
  const p = mkPool(4);
  // ---- 前置：分配本跑独占的命名空间（只读扫描；失败 ⇒ 落盘 + exit 3 + 明白话）
  const nsRes = await allocNamespace(p, {
    tagPrefix: 'p2w', seed: RUN, uidCount: WIN_SIZE, uidStride: WIN_STRIDE, uidPartitions: [WIN_PARTITION],
    symbolPrefix: 'p1y', keyPrefix: 'ops:p1y',
    purpose: 'ledger_entry 是 append-only（键唯一）+ referral 是 INSERT-only（绑定幂等）+ currency.symbol 唯一且其账户余额会被真落账消耗 ⇒ 夹具不可复位，每一跑必须换新命名空间',
    hint: `本跑主分区 ${WIN_PARTITION[0]}..${WIN_PARTITION[1]}（可 export P2W_UID_PARTITION="958001-958949,959001-959949" 扩分区）；P2W_BASE_UID=<空闲基准> 可显式指定窗口`,
  });
  if (!nsRes.ok) {
    rec('namespace_allocation_fatal', nsRes.fatal);
    const f = save('p2w-00-verify-FATAL-namespace', { run: RUN, fatal: nsRes.fatal });
    console.error(`[p2w-00] 命名空间分配失败，已落盘 ${f}`);
    exitPrecondition(nsRes.fatal);
  }
  const ns = nsRes;
  const U = (i: number) => ns.uids[i];
  const at = (from: number, n: number) => ns.uids.slice(from, from + n);
  const SYM = ns.symbol;
  const KEYPREFIX = ns.key_prefix;                        // `ops:p1y:<token>:`
  const RUNTAG = ns.job_tag;                              // 9 位十进制号段
  const JOB = (k: number) => `${RUNTAG}${k}`;
  const KEY = (what: string, k: string) => `${KEYPREFIX}${what}:${k}`;
  const EMP = U(SLOT.EMP);
  const W_SHORT = U(SLOT.W_SHORT), W_DEEP = U(SLOT.W_DEEP), W_EV3 = U(SLOT.W_EV3);
  const W_F7B1 = U(SLOT.W_F7B1), W_EXACT10 = U(SLOT.W_EXACT10);
  const ANC3 = at(SLOT.ANC3, 1);
  const ANC12 = at(SLOT.ANC12, 12);
  const ANC3C = at(SLOT.ANC3C, 3);
  const ANC2 = at(SLOT.ANC2, 2);
  const ANC10 = at(SLOT.ANC10, 10);
  const POISON = at(SLOT.POISON, 2);
  const PROBE2 = at(SLOT.PROBE2, 9);
  const ALL_UIDS = ns.uids;

  // 币：**owner = 雇主**（mint 授权口径：owner_uid > 0 ⇒ 只许 owner 自铸，见文件头「真根因」）
  const cid = await ensureCurrency(p, SYM, EMP, 8);
  await ensureUsers(p, ALL_UIDS);
  rec('env', { run: RUN, run_tag_from_env: process.env.P2W_RUN ?? null, cid, symbol: SYM, job_tag: RUNTAG,
    key_prefix: KEYPREFIX, gross_std: GROSS_STD,
    namespace: { uid_base: ns.uid_base, uid_count: WIN_SIZE, uid_stride: WIN_STRIDE,
      uid_source: ns.uid_source, partition: ns.uid_partition, occupied_recheck: ns.occupied_recheck,
      slots: SLOT, uids: ALL_UIDS } });
  judge('N0 本跑 uid 窗口分配后复核为空（夹具新鲜）', ns.occupied_recheck.length === 0, ns.occupied_recheck);
  judge('N1 本跑 uid 窗口全部落在 959xxx 本单分区内（绝不越界）',
    ns.uid_base >= WIN_PARTITION[0] && ns.uid_base + WIN_SIZE - 1 <= WIN_PARTITION[1], ns.uid_base);
  judge('N2 币 symbol 前缀 = p1y 且幂等键前缀 = ops:p1y:', SYM.startsWith('p1y') && KEYPREFIX.startsWith('ops:p1y:'), { SYM, KEYPREFIX });

  const platformSnapshot = () => raw<Record<string, unknown>>(p, `
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen, version::text AS version
      FROM account WHERE uid IN (-1,-2,-3) AND cid = 1 ORDER BY uid`);
  const cid1Before = await platformSnapshot();
  rec('cid1_platform_accounts_before', cid1Before);
  rec('schema_version', (await raw1<{ v: string }>(p, `SELECT max(version) AS v FROM schema_migration`))?.v ?? null);
  rec('trigger_enablement_before', await triggerEnablement(p));
  rec('graph_invariants_before', await readGraphInvariants(p));

  // ---------------------------------------------------------------- 夹具（幂等；父先子后）
  const bindIfMissing = async (ex: Qx, child: string, parent: string): Promise<string> => {
    const n = await raw1<{ n: string }>(ex, `SELECT count(*)::text AS n FROM referral WHERE child_uid = $1`, [child]);
    if (Number(n?.n ?? '0') > 0) return 'exists';
    const r = await trySql(ex, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1, $2, 0)`, [child, parent]);
    return r.ok ? 'bound' : `err:${r.error?.sqlstate ?? '?'}/${r.error?.reason ?? '-'}`;
  };
  const bindChain = async (ex: Qx, worker: string, anc: string[]) => {
    const out: string[] = [];
    for (let i = anc.length - 1; i >= 0; i--) out.push(await bindIfMissing(ex, i === 0 ? worker : anc[i - 1], anc[i]));
    return out;
  };
  rec('chain_setup', {
    W_SHORT: await bindChain(p, W_SHORT, ANC3),
    W_DEEP: await bindChain(p, W_DEEP, ANC12),
    W_EV3: await bindChain(p, W_EV3, ANC3C),
    W_F7B1: await bindChain(p, W_F7B1, ANC2),
    W_EXACT10: await bindChain(p, W_EXACT10, ANC10),
  });

  // 已提交夹具资金：只给两个**会真落账**的 job 冻结（其余探针在回滚事务里自筹）
  const fixMint = await mintTo(p, EMP, cid, '1000000', KEY('mint', 'committed'));
  const fixHold1 = await holdFor(p, EMP, cid, GROSS_STD, JOB(1), KEY('hold', JOB(1)));
  // ⚠️ JOB(2) 托管**双倍**：账本的余额闸在幂等短路**之前**（见 scripts/p2w-03-ledger-replay-balance-gate.ts 的 A/B 读数）
  //    ⇒ F7② 的三次调用（首写=旧政策 5% ⇒ 100000；重放=当前政策 1% ⇒ 100000；C9 复用账上载荷 ⇒ 100000）
  //      每一次都要**各自**通过余额闸，故 frozen 必须 ≥ 2×GROSS_STD（否则第二次会拿到 LD002 而不是重放）
  const fixHold2 = await holdFor(p, EMP, cid, '200000', JOB(2), KEY('hold', JOB(2)));
  rec('fixture_mint', { ok: fixMint.ok, replay: fixMint.replay, err: fixMint.error });
  rec('fixture_hold_ctrl', { ok: fixHold1.ok, replay: fixHold1.replay, err: fixHold1.error });
  rec('fixture_hold_replay', { ok: fixHold2.ok, replay: fixHold2.replay, err: fixHold2.error });
  rec('fixture_currency_owner', await raw1<Record<string, unknown>>(p,
    `SELECT symbol, owner_uid::text AS owner_uid, cid::text AS cid, total_supply::text AS supply FROM currency WHERE cid = $1`, [cid]));
  rec('fixture_emp_account', await raw1<Record<string, unknown>>(p,
    `SELECT uid::text AS uid, balance::text AS balance, frozen::text AS frozen FROM account WHERE uid = $1 AND cid = $2`, [EMP, cid]));
  // F0x：夹具本身进判据（**旧版把夹具失败留成后续 FATAL，把证据打碎** —— 这里判红而不是崩）
  judge('F01 夹具 mint 成功（owner 自铸路径；非 LD014）', fixMint.ok === true, reads.fixture_mint);
  judge('F02 夹具 hold（正向对照用的 job）成功', fixHold1.ok === true, reads.fixture_hold_ctrl);
  judge('F03 夹具 hold（F7② 重放用的 job）成功', fixHold2.ok === true, reads.fixture_hold_replay);
  // 夹具是**后续全部落账判据的先决**：不成立就带红退出（并留下 run-tagged 证据），
  // 而不是让 §A 的正向对照抛 FATAL 把整份读数打碎（旧版正是如此）。
  if (fixMint.ok !== true || fixHold1.ok !== true || fixHold2.ok !== true) {
    rec('aborted_before_cases', { reason: 'FIXTURE_FAILED', fixture: { mint: reads.fixture_mint, hold_ctrl: reads.fixture_hold_ctrl, hold_replay: reads.fixture_hold_replay } });
    const out = { run: RUN, reds, reads };
    const fileF = save('p2w-00-verify', out);
    const txtF = saveText('p2w-00-verify', JSON.stringify(out, null, 1));
    console.log(JSON.stringify({ file: fileF, txt: txtF, run: RUN, reds_count: reds.length, reds, aborted: 'FIXTURE_FAILED' }, null, 1));
    await p.end();
    process.exit(ASSERT_MODE ? 1 : 2);
  }

  // 回滚事务内自筹（mint + hold），使破坏性探针**零残留**。
  // ⚠️ 事务内**一次报错即整事务 aborted（25P02）**⇒ 凡「预期失败」的语句必须用 SAVEPOINT 包裹，
  //    否则后续读数全部退化成 25P02（= 判据假红；旧版 §D/§E/§F 就是被这一条打红的）。
  const sp = async <T>(tx: Qx, fn: () => Promise<T>): Promise<{ ok: boolean; value: T | null; err: PgErr | null }> => {
    await tx.query('SAVEPOINT ns_sp');
    try {
      const value = await fn();
      await tx.query('RELEASE SAVEPOINT ns_sp');
      return { ok: true, value, err: null };
    } catch (e) {
      await tx.query(`ROLLBACK TO SAVEPOINT ns_sp`);
      return { ok: false, value: null, err: pgErr(e) };
    }
  };
  /** SAVEPOINT 包裹的裸 SQL（形状同 p2w-lib 的 trySql，但**不打死事务**） */
  const spQ = async (tx: Qx, sql: string, params: unknown[] = []):
  Promise<{ ok: boolean; rows: Array<Record<string, unknown>>; error: PgErr | null }> => {
    await tx.query('SAVEPOINT ns_sp');
    try {
      const r = await tx.query(sql, params);
      await tx.query('RELEASE SAVEPOINT ns_sp');
      return { ok: true, rows: r.rows as Array<Record<string, unknown>>, error: null };
    } catch (e) {
      await tx.query(`ROLLBACK TO SAVEPOINT ns_sp`);
      return { ok: false, rows: [], error: pgErr(e) };
    }
  };
  /** SAVEPOINT 包裹的 ledger_post_event（形状同 p2w-lib 的 tryFn，但**不打死事务**） */
  const spFn = async (tx: Qx, payload: unknown): Promise<{ ok: boolean; replay: boolean; rows: number; error: PgErr | null; raw: Record<string, unknown> | null }> => {
    await tx.query('SAVEPOINT ns_sp');
    try {
      const r = await callFn(tx, payload);
      await tx.query('RELEASE SAVEPOINT ns_sp');
      return { ok: r?.ok === true, replay: r?.idempotent_replay === true,
        rows: ((r?.entries as unknown[]) ?? []).length, error: null, raw: r };
    } catch (e) {
      await tx.query(`ROLLBACK TO SAVEPOINT ns_sp`);
      return { ok: false, replay: false, rows: 0, error: pgErr(e), raw: null };
    }
  };
  const txErr = (x: { error?: unknown }): string | null => (x?.error ? String((x.error as Error)?.message ?? x.error).slice(0, 200) : null);
  const selfFund = async (tx: Qx, gross: string, jobId: string) => {
    const m = await mintTo(tx, EMP, cid, '1000000', KEY('mint', `tx${jobId}`));
    const h = await holdFor(tx, EMP, cid, gross, jobId, KEY('hold', jobId));
    return { mint_ok: m.ok, hold_ok: h.ok, hold_err: h.error?.reason ?? null };
  };
  const settlePayload = (plan: SettlementPlan, input: SettleJobInput) => {
    const ev = buildSettleEvent(plan, input.memo);
    return {
      op: 'entries', idempotency_key: plan.idempotency_key,
      request_fingerprint: input.requestFingerprint ?? settleJobFingerprint(input),
      ref_type: 'job', ref_id: plan.job_id,
      memo: input.memo ?? `招工验收结算 job=${plan.job_id}`,
      entries: ev.entries.map((x) => toPayloadEntry(x)),
    } as Record<string, unknown>;
  };
  const dropEntries = (payload: Record<string, unknown>, keep: (e: Record<string, unknown>, i: number, n: number) => boolean) => {
    const es = payload.entries as Array<Record<string, unknown>>;
    return { ...payload, entries: es.filter((e, i) => keep(e, i, es.length)) };
  };

  // ================================================================ §A F1
  const planTry = async (input: SettleJobInput) => {
    try { return { ok: true as const, plan: await planJobSettlement(input) }; }
    catch (e) { return { ok: false as const, err: errInfo(e) }; }
  };
  const A = await inRollbackTx(p, async (tx) => {
    const out: Record<string, unknown> = { fund: await selfFund(tx, GROSS_STD, JOB(3)) };
    // 管理员旁路造 2-环：关掉守卫 + append-only，直插 X→Y、Y→X（= 质检/Neng 的复现手法）
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await tx.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$1,1)`, [POISON[0], POISON[1]]);
    await tx.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only`);
    await tx.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_cycle_guard`);
    const pol = await getCommissionPolicy(null, tx);
    const chain = await getReferralChain(POISON[0], pol.levels, tx);
    out.chain_depth = chain.chain_depth;
    out.chain_truncated = chain.truncated;
    out.assertions = chain.assertions;
    out.chain_nodes = chain.nodes.map((n) => `${n.level}:${n.beneficiary_uid}`);
    out.chain_contains_worker = chain.nodes.some((n) => n.beneficiary_uid === POISON[0]);
    out.chain_has_duplicates = new Set(chain.nodes.map((n) => n.beneficiary_uid)).size !== chain.nodes.length;
    // ① TS 闸：计划/服务两个入口都必须拒
    out.plan_result = await planTry({ jobId: JOB(3), employerUid: EMP, workerUid: POISON[0], cid, gross: GROSS_STD, ex: tx });
    const s1 = await sp(tx, () => settleJobCommission({ jobId: JOB(3), employerUid: EMP, workerUid: POISON[0], cid, gross: GROSS_STD, ex: tx }));
    out.settle_result = s1.ok
      ? { ok: true, replay: s1.value?.business.replay, plan_source: s1.value?.business.plan_source }
      : { ok: false, err: errInfo(s1.err) };
    out.ledger_rows_for_key = (await raw1<{ n: string }>(tx, `SELECT count(*)::text AS n FROM ledger_entry
      WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1`, [jobSettleKey(JOB(3))]))?.n;
    // ② 判负对照：绕过 TS 闸，按**同一份污染链**手工组装载荷（= 修前 planJobSettlement 会产出的形态）
    const M = Math.min(pol.levels, chain.chain_depth);
    const weights = pol.weights_bp.slice(0, M).map((w) => BigInt(w));
    const fee = (BigInt(GROSS_STD) * BigInt(pol.fee_rate_bp) + 5000n) / 10000n;
    const net = BigInt(GROSS_STD) - fee;
    const split = splitPool(BigInt(GROSS_STD) === 0n ? 0n : fee, weights);
    const fakePlan: SettlementPlan = {
      job_id: JOB(3), idempotency_key: jobSettleKey(JOB(3)), employer_uid: EMP, worker_uid: POISON[0], cid,
      gross: GROSS_STD, fee: fee.toString(), net: net.toString(), pool: fee.toString(),
      policy: pol, chain_depth: chain.chain_depth, chain_truncated: chain.truncated,
      // ★ P9⑤（`SettlementPlan` 新增 4 必填字段同步 —— 判负对照是手工组装的「修前形态」，
      //   下行 / 名单 / 截断在旧形态下均不存在 ⇒ 显式占位）：
      down_depth: 0, down_truncated: false, roster_size: M,
      truncation: { cap_layer: COMMISSION_CAP_LAYER_DEFAULT, cap_total: COMMISSION_CAP_TOTAL_DEFAULT,
        dropped_total: 0, dropped_by_layer: {}, truncated: false },
      plan_source: 'computed', policy_reported: true, M, N: M, weights_bp: pol.weights_bp.slice(0, M).map(String),
      W: split.W, split, fee_credit_uid: COMMISSION_POOL_UID, zero_amount: false, no_referrer: false,
      layers: chain.nodes.slice(0, M).map((n, i) => ({ level: n.level, beneficiary_uid: n.beneficiary_uid,
        weight_bp: String(weights[i]), q: split.q[i], r: split.r[i], x: split.x[i] })),
    };
    const fakePayload = settlePayload(fakePlan, { jobId: JOB(3), employerUid: EMP, workerUid: POISON[0], cid, gross: GROSS_STD });
    const posted = await tryFn(tx, fakePayload);
    out.bypass_post = { ok: posted.ok, rows: posted.rows, err: posted.error?.reason ?? null };
    const firstRow = (fakePayload.entries as Array<Record<string, unknown>>)[0];
    out.bypass_entries = (fakePayload.entries as Array<Record<string, unknown>>).length;
    out.bypass_worker_credit = (fakePayload.entries as Array<Record<string, unknown>>)
      .filter((e) => String(e.uid) === POISON[0] && e.kind === 'commission').reduce((a, e) => a + BigInt(String(e.delta)), 0n).toString();
    out.bypass_self_paid_levels = (fakePayload.entries as Array<Record<string, unknown>>)
      .filter((e) => String(e.uid) === POISON[0] && e.kind === 'commission').length;
    out.bypass_first_entry_kind = firstRow?.kind ?? null;
    return out;
  });
  rec('A_f1_poisoned_chain', { ...(A.result ?? {}), tx_error: txErr(A) });
  judge('A0 回滚事务内自筹成功（mint+hold）', (A.result?.fund as Record<string, unknown>)?.hold_ok === true, A.result?.fund);
  const Achain = A.result?.chain_nodes as string[] | undefined;
  judge('A1 污染链：节点重复（no_duplicate_uid=false）', (A.result?.assertions as Record<string, unknown>)?.no_duplicate_uid === false, A.result?.assertions);
  judge('A2 污染链：含打工人本人', A.result?.chain_contains_worker === true, Achain?.slice(0, 6));
  const Aplan = A.result?.plan_result as Record<string, unknown> | undefined;
  judge('A3 planJobSettlement 对坏链拒绝', Aplan?.ok === false, Aplan);
  const Aerr = Aplan?.err as Record<string, unknown> | undefined;
  judge('A4 拒绝码 = LEDGER_RECONCILE_MISMATCH', Aerr?.code === 'LEDGER_RECONCILE_MISMATCH', Aerr?.code);
  judge('A5 拒绝为 500 类（httpStatus=500）', Aerr?.httpStatus === 500, Aerr?.httpStatus);
  judge('A6 reason = COMMISSION_CHAIN_ASSERTION_VIOLATED', Aerr?.reason === COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED, Aerr?.reason);
  judge('A7 details 列出失败断言（含 no_duplicate_uid）',
    String((Aerr?.details as Record<string, unknown>)?.failed_assertions ?? '').includes('no_duplicate_uid'),
    (Aerr?.details as Record<string, unknown>)?.failed_assertions);
  const Asettle = A.result?.settle_result as Record<string, unknown> | undefined;
  judge('A8 settleJobCommission 亦拒绝（落账前）', Asettle?.ok === false, Asettle);
  judge('A9 坏链未落任何账', A.result?.ledger_rows_for_key === '0', A.result?.ledger_rows_for_key);
  judge('A10 判负对照：绕开 TS 闸 ⇒ DB Σ 触发器放行（ok=true）', (A.result?.bypass_post as Record<string, unknown>)?.ok === true, A.result?.bypass_post);
  judge('A11 判负对照：打工人本人被错付（多行佣金入己）',
    BigInt(String(A.result?.bypass_worker_credit ?? '0')) > 0n, A.result?.bypass_worker_credit);

  // 正向对照：健康链照常出计划并落账（**夹具先决已进判据 F02**，故此处不再裸抛）
  const ctrlInput: SettleJobInput = { jobId: JOB(1), employerUid: EMP, workerUid: W_SHORT, cid, gross: GROSS_STD };
  const ctrlPlan = await planJobSettlement(ctrlInput);
  rec('A_ctrl_plan', planRead(ctrlPlan));
  const ctrl = await (async () => {
    try { return { ok: true as const, out: await settleJobCommission(ctrlInput) }; }
    catch (e) { return { ok: false as const, err: errInfo(e) }; }
  })();
  const ctrlOut = ctrl.ok ? ctrl.out : null;
  rec('A_ctrl_settle', ctrlOut ? { ok: ctrlOut.result.ok, replay: ctrlOut.business.replay, plan_source: ctrlOut.business.plan_source,
    entries: ctrlOut.business.expected_entry_count, commission_rows: ctrlOut.business.expected_commission_rows,
    fee: ctrlOut.plan.fee, chain_truncated: ctrlOut.plan.chain_truncated } : { ok: false, err: ctrl.err });
  judge('A12 正向对照：健康链出计划（断言全 true）', ctrlPlan.M === 1 && ctrlPlan.layers.length === 1, planRead(ctrlPlan));
  judge('A13 正向对照：健康链落账 ok 且 plan_source=computed',
    ctrlOut?.result.ok === true && ctrlOut.business.plan_source === 'computed', reads.A_ctrl_settle);

  // ================================================================ §B F7①
  const capCases: Record<string, unknown> = {};
  for (const [name, uid, cap] of [['short_cap1_exact', W_SHORT, 1], ['ev3_cap3_exact', W_EV3, 3],
    ['ev3_cap2_truncated', W_EV3, 2], ['deep_cap10_truncated', W_DEEP, 10], ['deep_cap12_exact', W_DEEP, 12]] as Array<[string, string, number]>) {
    const c = await getReferralChain(uid, cap, p);
    capCases[name] = { cap, chain_depth: c.chain_depth, truncated: c.truncated, levels: c.nodes.map((n) => n.level) };
  }
  rec('B_chain_cap_cases', capCases);
  judge('B1 恰好 cap ⇒ truncated=false', (capCases.short_cap1_exact as Record<string, unknown>).truncated === false
    && (capCases.ev3_cap3_exact as Record<string, unknown>).truncated === false
    && (capCases.deep_cap12_exact as Record<string, unknown>).truncated === false, capCases);
  judge('B2 ≥ cap ⇒ truncated=true（同 chain_depth 下可分辨）',
    (capCases.ev3_cap2_truncated as Record<string, unknown>).truncated === true
    && (capCases.deep_cap10_truncated as Record<string, unknown>).truncated === true
    && (capCases.ev3_cap2_truncated as Record<string, unknown>).chain_depth === 2, capCases);
  const planExact = await planJobSettlement({ jobId: JOB(4), employerUid: EMP, workerUid: W_EXACT10, cid, gross: GROSS_STD });
  const planDeep = await planJobSettlement({ jobId: JOB(5), employerUid: EMP, workerUid: W_DEEP, cid, gross: GROSS_STD });
  rec('B_plan_level', { exact10: planRead(planExact), deep12: planRead(planDeep) });
  judge('B3 计划层：chain_depth 同为 10 但 chain_truncated 不同',
    planExact.chain_depth === 10 && planDeep.chain_depth === 10
    && planExact.chain_truncated === false && planDeep.chain_truncated === true, reads.B_plan_level);
  judge('B4 旧字段 chain_depth 语义未动（= 返回节点数）', planExact.chain_depth === planExact.layers.length, planRead(planExact));

  // ================================================================ §C F7②
  const pols = await raw<{ id: string; bp: string; lv: string; ef: string }>(p, `
    SELECT policy_id::text AS id, fee_rate_bp::text AS bp, levels::text AS lv, effective_from::text AS ef
      FROM commission_policy ORDER BY effective_from`);
  const oldPol = [...pols].sort((a, b) => Number(b.bp) - Number(a.bp) || (a.ef < b.ef ? -1 : 1))[0];
  const nowPol = pols[pols.length - 1];
  rec('C_policies', { all: pols, picked_old: oldPol, picked_now: nowPol });
  judge('C0 选到两版不同政策（否则本项空跑）', Boolean(oldPol) && Boolean(nowPol) && oldPol.bp !== nowPol.bp, { oldPol, nowPol });
  const replayInputOld: SettleJobInput = { jobId: JOB(2), employerUid: EMP, workerUid: W_F7B1, cid, gross: GROSS_STD, at: oldPol?.ef };
  const replayInputNow: SettleJobInput = { jobId: JOB(2), employerUid: EMP, workerUid: W_F7B1, cid, gross: GROSS_STD, at: nowPol?.ef };
  const first = await settleJobCommission(replayInputOld);
  const firstPlan = planRead(first.plan);
  const recomputedNow = await planJobSettlement(replayInputNow);
  const replayed = await settleJobCommission(replayInputNow);
  const ledgerFacts = await readEventFacts(jobSettleKey(JOB(2)), EMP, W_F7B1, p);
  const ledgerSettle = await readLedgerSettlement(jobSettleKey(JOB(2)), EMP, W_F7B1, p);
  const ledgerRows = await readLedgerEventRows(jobSettleKey(JOB(2)), p);
  rec('C_first_write', { plan: firstPlan, replay: first.business.replay, plan_source: first.business.plan_source,
    assertions: first.event.assertions, policy_fee_rate_bp: first.plan.policy.fee_rate_bp });
  rec('C_recompute_with_current_policy', { fee: recomputedNow.fee, layers: planRead(recomputedNow).layers, policy_fee_rate_bp: recomputedNow.policy.fee_rate_bp });
  rec('C_replay', { plan: planRead(replayed.plan), replay: replayed.business.replay, plan_source: replayed.business.plan_source,
    event_entries: replayed.business.expected_entry_count, event_assertions: replayed.event.assertions });
  rec('C_ledger_truth', { facts: { rows_total: ledgerFacts.rows_total, pool_in: ledgerFacts.pool_in, commission_rows: ledgerFacts.commission_rows, worker_got: ledgerFacts.worker_got },
    settlement: { fee: ledgerSettle.fee, net: ledgerSettle.net, gross: ledgerSettle.gross, layers: ledgerSettle.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}:${l.level_source}`) },
    rows: ledgerRows.length });
  judge('C1 首写：plan_source=computed', first.business.plan_source === 'computed' && first.business.replay === false, reads.C_first_write);
  judge('C2 重放：plan_source=replayed_from_ledger + replay=true',
    replayed.business.plan_source === 'replayed_from_ledger' && replayed.business.replay === true, reads.C_replay);
  judge('C3 重放：plan.fee == 账上 pool_in（不是重算值）',
    replayed.plan.fee === ledgerFacts.pool_in && replayed.plan.fee === ledgerSettle.fee, { plan_fee: replayed.plan.fee, ledger_pool_in: ledgerFacts.pool_in });
  judge('C4 重放：plan.net == 账上 worker_got', replayed.plan.net === ledgerFacts.worker_got, { net: replayed.plan.net, worker_got: ledgerFacts.worker_got });
  judge('C5 重放：layers 逐字段 == 账上 commission 行',
    JSON.stringify(replayed.plan.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`))
      === JSON.stringify(ledgerSettle.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`)),
    { plan_layers: planRead(replayed.plan).layers, ledger_layers: ledgerSettle.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}`) });
  judge('C6 重放：policy 显式标不可信（policy_reported=false + 占位符）',
    replayed.plan.policy_reported === false && replayed.plan.policy.policy_id === 'ledger_replay', planRead(replayed.plan));
  judge('C7 重算（当前政策）与重放返回的金额不同 ⇒ 证明未用当前政策重算',
    recomputedNow.fee !== replayed.plan.fee, { recomputed_fee: recomputedNow.fee, returned_fee: replayed.plan.fee });
  judge('C8 重放：event 读数与账上一致（entry_count == 账上行数）',
    replayed.business.expected_entry_count === ledgerRows.length
    && replayed.event.assertions.sum_commission_credit === ledgerSettle.commission_credit_sum,
    { entries: replayed.business.expected_entry_count, ledger_rows: ledgerRows.length });
  const repost = await callFn(p, replayed.payload);
  rec('C_repost_same_payload', { ok: repost.ok, replay: repost.idempotent_replay });
  judge('C9 用返回的 payload 再发 ⇒ 仍是重放（不退化成 409）',
    repost.ok === true && repost.idempotent_replay === true, reads.C_repost_same_payload);

  // ================================================================ §D F3
  const D: Record<string, unknown> = {};
  const f3Setup = async (tx: Qx, jobId: string) => {
    const fund = await selfFund(tx, GROSS_STD, jobId);
    const plan = await planJobSettlement({ jobId, employerUid: EMP, workerUid: W_EXACT10, cid, gross: GROSS_STD, ex: tx });
    return { fund, plan, payload: settlePayload(plan, { jobId, employerUid: EMP, workerUid: W_EXACT10, cid, gross: GROSS_STD }) };
  };
  // ① IMMEDIATE 前置（= F3 的假报场景）
  const d1 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(3));
    await tx.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const r = await spFn(tx, s.payload);
    return { entries: (s.payload.entries as unknown[]).length, commission_rows: s.plan.layers.length * 2, posted: r };
  });
  D.d1_immediate_before_post = { entries: d1.result?.entries, commission_rows: d1.result?.commission_rows,
    ok: d1.result?.posted.ok, rows: d1.result?.posted.rows, err: d1.result?.posted.error, tx_error: txErr(d1) };
  // ③ 默认 DEFERRED：同一载荷必须照常成功
  const d2 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(4));
    const r = await spFn(tx, s.payload);
    return { entries: (s.payload.entries as unknown[]).length, posted: r };
  });
  D.d2_deferred_default = { entries: d2.result?.entries, ok: d2.result?.posted.ok, err: d2.result?.posted.error, tx_error: txErr(d2) };
  // ②a 真 Σ 不符：丢最后一对佣金（Σ-中性，事件级平衡闸不响）⇒ 在**显式裁决点**必须 LD032
  //    口径修正（P3-SUITE-CALIBER-FIX）：`SET CONSTRAINTS … DEFERRED` 对 INITIALLY DEFERRED 是 **no-op**，
  //    旧版**从不 flush**、又跑在回滚事务里 ⇒ 闸永无裁决机会（定案见 `docs/audit/p3-baseline-rca.md` §1.1 D4/D5）。
  //    修法 = 加**显式裁决点**（`SET CONSTRAINTS ALL IMMEDIATE` = 提交点等价的结算动作），判据只落在该点上。
  const d3 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(5));
    await tx.query(`SET CONSTRAINTS ALL DEFERRED`);
    const t = dropEntries(s.payload, (_e, i, n) => i < n - 2);
    const r = await spFn(tx, t);
    const flush = await spQ(tx, `SET CONSTRAINTS ALL IMMEDIATE`);   // ← 显式裁决点
    return { entries: (t.entries as unknown[]).length, posted: r, flush: { ok: flush.ok, err: flush.error } };
  });
  D.d3_tamper_drop_pair = { entries: d3.result?.entries, ok: d3.result?.posted.ok, err: d3.result?.posted.error,
    flush_after_post: d3.result?.flush, tx_error: txErr(d3) };
  // ②b 只入不出：commission_rows=0 且 pool_in>0（Σ-中性；窄签名修法会**静默放过**的形态）⇒ 同裁决点必须 LD032
  const d4 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(6));
    await tx.query(`SET CONSTRAINTS ALL DEFERRED`);
    const t = dropEntries(s.payload, (_e, i) => i < 4);
    const r = await spFn(tx, t);
    const flush = await spQ(tx, `SET CONSTRAINTS ALL IMMEDIATE`);   // ← 显式裁决点
    return { entries: (t.entries as unknown[]).length, posted: r, flush: { ok: flush.ok, err: flush.error } };
  });
  D.d4_pool_in_no_out = { entries: d4.result?.entries, ok: d4.result?.posted.ok, err: d4.result?.posted.error,
    flush_after_post: d4.result?.flush, tx_error: txErr(d4) };
  // 判负自证 A（灵敏度·合法侧）：**合法**事件在同一裁决点**不得**报 —— 否则闸就是「一律报」而非判 Σ
  const dctrl = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(10));
    const r = await spFn(tx, s.payload);
    const flush = await spQ(tx, `SET CONSTRAINTS ALL IMMEDIATE`);
    return { entries: (s.payload.entries as unknown[]).length, ok: r.ok, err: r.error, flush_ok: flush.ok, flush_err: flush.error };
  });
  D.d_ctrl_legal_flush = { ...(dctrl.result ?? {}), tx_error: txErr(dctrl) };
  // 判负自证 B（灵敏度·闸侧）：把**同一道闸**在事务内摘掉（末尾一律 ROLLBACK）
  //   ⇒ 同形篡改在裁决点不再报 ⇒ 证明上面读到的 LD032 确实出自这道闸（判据对这道闸敏感，不是撞了别的错）
  const dgateoff = await inRollbackTx(p, async (tx) => {
    // ⚠️ 顺序铁律（本单实测修正）：**先摘闸，再造夹具**。
    //    `ALTER TABLE … DISABLE TRIGGER` 在**已有 pending 延迟触发器事件**的事务里被 PG 拒绝：
    //    首版把 `f3Setup`（mint/hold 也是 `ledger_entry` INSERT）放在前面 ⇒ 实测
    //    `55006 cannot ALTER TABLE "ledger_entry" because it has pending trigger events`
    //    ⇒ 控制杆自身没执行、判负自证空转（判据如实判红）。改为先 DISABLE 后 setup。
    const dis = await spQ(tx, `ALTER TABLE ledger_entry DISABLE TRIGGER trg_ledger_entry_commission_conservation`);
    const s = await f3Setup(tx, JOB(11));
    const t = dropEntries(s.payload, (_e, i, n) => i < n - 2);
    const r = await spFn(tx, t);
    const flush = await spQ(tx, `SET CONSTRAINTS ALL IMMEDIATE`);
    return { disable_ok: dis.ok, disable_err: dis.error, entries: (t.entries as unknown[]).length,
      ok: r.ok, err: r.error, flush_ok: flush.ok, flush_err: flush.error };
  });
  D.d_gate_off_control = { ...(dgateoff.result ?? {}), tx_error: txErr(dgateoff) };
  // ③ 先落账、后强制结算（p2qa-03 形态）：合法事件不得报，非法事件必须报
  const d5 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(7));
    const okPost = await spFn(tx, s.payload);
    const afterImmediate = await spQ(tx, `SET CONSTRAINTS ALL IMMEDIATE`);
    const s2 = await f3Setup(tx, JOB(8));
    const bad = dropEntries(s2.payload, (_e, i) => i < 4);
    const badPost = await spFn(tx, bad);
    const afterImmediate2 = await spQ(tx, `SET CONSTRAINTS ALL IMMEDIATE`);
    return { okPost_ok: okPost.ok, after_immediate: { ok: afterImmediate.ok, err: afterImmediate.error },
      badPost: { ok: badPost.ok, err: badPost.error }, after_immediate2: { ok: afterImmediate2.ok, err: afterImmediate2.error } };
  });
  D.d5_post_then_immediate = { ...(d5.result ?? {}), tx_error: txErr(d5) };
  // ④ 边界登记（**不判**，如实登记）：强制 IMMEDIATE 期间，Σ 断言不再判负（本修法的设计代价）
  const d6 = await inRollbackTx(p, async (tx) => {
    const s = await f3Setup(tx, JOB(9));
    await tx.query(`SET CONSTRAINTS ALL IMMEDIATE`);
    const t = dropEntries(s.payload, (_e, i) => i < 4);
    const r = await spFn(tx, t);
    return { entries: (t.entries as unknown[]).length, ok: r.ok, err: r.error?.reason ?? null };
  });
  D.d6_boundary_immediate_tamper = { ...(d6.result ?? {}), tx_error: txErr(d6) };
  rec('D_f3', D);
  judge('D1 IMMEDIATE 前置：真事件不再假报（ok=true）', d1.result?.posted.ok === true,
    { ok: d1.result?.posted.ok, err: d1.result?.posted.error });
  judge('D2 该事件确为 24 条分录 / 20 条 commission（与 F3 复现同形）',
    d1.result?.entries === 24 && d1.result?.commission_rows === 20, { entries: d1.result?.entries, commission_rows: d1.result?.commission_rows });
  judge('D3 默认 DEFERRED：照常成功', d2.result?.posted.ok === true, d2.result?.posted.error);
  judge('D4 丢一对佣金（Σ-中性）⇒ 在**显式裁决点**报 LD032 + COMMISSION_SPLIT_SUM_MISMATCH',
    d3.result?.flush.ok === false && d3.result?.flush.err?.sqlstate === 'LD032'
    && d3.result?.flush.err?.reason === COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH, d3.result?.flush);
  judge('D5 只入不出（commission_rows=0 且 pool_in>0）⇒ 在**显式裁决点**报 LD032',
    d4.result?.flush.ok === false && d4.result?.flush.err?.sqlstate === 'LD032'
    && d4.result?.flush.err?.reason === COMMISSION_REASON.COMMISSION_SPLIT_SUM_MISMATCH, d4.result?.flush);
  judge('D4s 判负自证·合法侧：同一裁决点上**合法**事件不报（闸不是「一律报」而是判 Σ）',
    dctrl.result?.ok === true && dctrl.result?.flush_ok === true, dctrl.result);
  judge('D5s 判负自证·闸侧：摘掉这道闸后同形篡改**不再报** ⇒ 上面的 LD032 确出自这道闸',
    dgateoff.result?.disable_ok === true && dgateoff.result?.flush_ok === true, dgateoff.result);
  judge('D6 先落账后强制结算：合法事件不报', d5.result?.okPost_ok === true && d5.result?.after_immediate.ok === true, d5.result);
  // ---- D7 口径修正（P3-SUITE-CALIBER-FIX）：**与同套件 D6 同口径 = 登记不判**（旧版判红 = 探针口径错，非缺陷）
  //   依据行号：`0011:96–99`（闸只挂 `ledger_entry` INSERT）+ `0011:112–133`（事件**未闭合** ⇒ `RAISE NOTICE … skip` 豁免）
  //   + 实测（本套件 leg_D7 / rca §1.1 D7）：`post_tampered_while_immediate ok=true` 且**之后再 flush 仍 ok=true**
  //   ⇒ 该模式下**不存在任何「事件闭合之后」的裁决点** ⇒ 两路（登记 / 独立裁决点）中只能取**登记**。
  rec('D7_immediate_escape_registered_not_judged', {
    ...(d5.result ?? {}), tx_error: txErr(d5), judged: false,
    why: 'IMMEDIATE 钉在 badPost **之前** ⇒ 行级闸在事件中途触发（未闭合 ⇒ 豁免）；账户写回（= 闭合）在其后且不触发复核'
      + ' ⇒ 闭合后无裁决机会（= 本修法的设计代价；`0011` 文件头与同套件 D6 已自行登记）',
    refs: ['0011:96–99', '0011:112–133', 'scripts/p2w-00-p2fix-verify.ts:483–491（D6 登记不判）',
      'docs/audit/p3-baseline-rca.md §1.2（生产不可达：src/** 内 SET CONSTRAINTS 命中数 = 0）'],
  });

  // ================================================================ §E F6
  const E = await inRollbackTx(p, async (tx) => {
    const [child, parentB, parentC] = PROBE2;
    const firstBind = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentB]);
    const rawRebind = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentC]);
    const fnRebind = await spQ(tx, `SELECT referral_bind($1::bigint, $2::bigint)`, [child, parentC]);
    return { first_bind: { ok: firstBind.ok, err: firstBind.error },
      raw_rebind: { ok: rawRebind.ok, err: rawRebind.error },
      fn_rebind: { ok: fnRebind.ok, err: fnRebind.error } };
  });
  rec('E_f6_two_paths', { ...(E.result ?? {}), tx_error: txErr(E) });
  const eRaw = E.result?.raw_rebind as Record<string, unknown> | undefined;
  const eFn = E.result?.fn_rebind as Record<string, unknown> | undefined;
  const eRawErr = eRaw?.err as PgErr | null | undefined;
  const eFnErr = eFn?.err as PgErr | null | undefined;
  judge('E1 裸 INSERT 重绑被拒为 LD003 + REFERRAL_ALREADY_BOUND',
    eRawErr?.sqlstate === 'LD003' && eRawErr?.reason === 'REFERRAL_ALREADY_BOUND', eRawErr);
  judge('E2 referral_bind 重绑被拒为 LD003 + REFERRAL_ALREADY_BOUND',
    eFnErr?.sqlstate === 'LD003' && eFnErr?.reason === 'REFERRAL_ALREADY_BOUND', eFnErr);
  judge('E3 两条路径**同码同 reason**', eRawErr?.sqlstate === eFnErr?.sqlstate && eRawErr?.reason === eFnErr?.reason,
    { raw: eRawErr, fn: eFnErr });
  // 判负对照：关掉守卫 ⇒ 退回修前形态（23505 / referral_pk）
  //   口径修正（P3-SUITE-CALIBER-FIX · rca §1.1 E4 / §3）：`0011:252` 的 `NEW.depth := 1+COALESCE(…,0)`
  //   **就在被摘掉的那个触发器里** ⇒ 旧版的字面量 `depth=0` 先撞 `0007:60 CHECK (depth>=1)`（`23514`），
  //   第二次 INSERT 结构上**不可达**。本版**保留两路读数**：(a) 原杆 depth=0（如实登记）；
  //   (b) **可对照杆** depth=1（首插成功 ⇒ 重绑 ⇒ `23505`/`referral_pk` = 修前形态，**可达**）——判据落在 (b)。
  const Ectrl = await inRollbackTx(p, async (tx) => {
    const [child, parentB, parentC] = PROBE2;
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    // (a) 原杆：字面 depth=0（旧输入）
    const zero = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, parentB]);
    // (b) 可对照杆：字面 depth=1（同一摘杆状态）
    const first1 = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [child, parentB]);
    const rebind1 = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [child, parentC]);
    return { depth0_first: { ok: zero.ok, err: zero.error },
      depth1_first: { ok: first1.ok, err: first1.error },
      depth1_rebind: { ok: rebind1.ok, err: rebind1.error } };
  });
  rec('E_f6_pre_fix_control', { ...(Ectrl.result ?? {}), tx_error: txErr(Ectrl),
    both_readings_kept: true,
    reading_a: '原杆 depth=0 ⇒ 23514/referral_depth_rng（摘杆连带摘掉 0011:252 的 depth 计算；如实登记，不据此判负）',
    reading_b: '可对照杆 depth=1 ⇒ 23505/referral_pk（= 修前形态，**判据落在这一路**）' });
  const eZero = (Ectrl.result?.depth0_first?.err ?? null) as PgErr | null;
  const eRebind = (Ectrl.result?.depth1_rebind?.err ?? null) as PgErr | null;
  judge('E4 判负对照（可对照形态）：无守卫时字面 depth=1 首插成功、重绑退回 23505/referral_pk（= 修前形态）',
    Ectrl.result?.depth1_first?.ok === true && eRebind?.sqlstate === '23505' && eRebind?.constraint === 'referral_pk',
    Ectrl.result?.depth1_rebind);
  judge('E4b 登记性断言（原杆读数保留）：同一摘杆状态 depth=0 ⇒ 23514/referral_depth_rng',
    eZero?.sqlstate === '23514' && eZero?.constraint === 'referral_depth_rng', Ectrl.result?.depth0_first);

  // ================================================================ §F F2
  const F = await inRollbackTx(p, async (tx) => {
    const [stale, child, root] = PROBE2.slice(3, 6);
    const setup = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [stale, root]);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await tx.query(`UPDATE referral SET depth = 50 WHERE child_uid = $1`, [stale]);
    await tx.query(`ALTER TABLE referral ENABLE TRIGGER trg_referral_append_only`);
    const toStale = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, stale]);
    const toRoot = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [child, root]);
    const depthNow = await raw1<{ depth: string }>(tx, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [child]);
    return { setup: { ok: setup.ok, err: setup.error }, bind_to_stale: { ok: toStale.ok, err: toStale.error },
      bind_to_consistent: { ok: toRoot.ok, err: toRoot.error }, depth_after: depthNow?.depth ?? null };
  });
  rec('F_f2_stale_parent', { ...(F.result ?? {}), tx_error: txErr(F) });
  const fErr = (F.result?.bind_to_stale as Record<string, unknown> | undefined)?.err as PgErr | null | undefined;
  judge('F1 绑到陈旧 depth 的父 ⇒ 拒（LD016 + REFERRAL_PARENT_DEPTH_INCONSISTENT）',
    fErr?.sqlstate === 'LD016' && fErr?.reason === 'REFERRAL_PARENT_DEPTH_INCONSISTENT', fErr);
  judge('F2 正向对照：父 depth 一致 ⇒ 放行且 depth 正确 = 1',
    (F.result?.bind_to_consistent as Record<string, unknown> | undefined)?.ok === true && F.result?.depth_after === '1', F.result);
  // 判负对照：关掉守卫 ⇒ 陈旧 depth 被继承（50 ⇒ 51）
  //   口径修正（P3-SUITE-CALIBER-FIX · rca §1.1 F3 / §3）：**旧期望本身不可达** ——「继承」这件事**就是**
  //   `0011:252`（在被摘掉的那个触发器里）；摘杆后只可能写**字面量**，而字面量 `depth=0` 先撞 `0007:60` 的 CHECK。
  //   本版 = ① 原杆**显式标为不可达**（登记，不判）+ ② **可达对照**（手写等价继承式 ⇒ 数值 50⇒51 可达）。
  const Fctrl = await inRollbackTx(p, async (tx) => {
    const [stale, child, root] = PROBE2.slice(3, 6);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard`);
    // ① 原杆（= 旧版期望的落点，**不可达**）：字面 depth=0 ⇒ CHECK(depth>=1) 先炸，「继承」无从发生
    const zero = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [stale, root]);
    const seed = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [stale, root]);
    await tx.query(`ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only`);
    await tx.query(`UPDATE referral SET depth = 50 WHERE child_uid = $1`, [stale]);
    // ② 可达对照：**手写等价继承式**（父存储 depth + 1）。它证明「50 ⇒ 51」这个**数值形态**在摘杆后可达，
    //    但只能靠探针手写（原实现 = 被摘掉的那段代码）⇒ 它**不是**对原机制的验证，只是可达性对照。
    const man = await spQ(tx, `INSERT INTO referral (child_uid, parent_uid, depth)
      SELECT $1, $2, (SELECT depth + 1 FROM referral WHERE child_uid = $2)`, [child, stale]);
    const d = await raw1<{ depth: string }>(tx, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [child]);
    return { depth0_original_leg: { ok: zero.ok, err: zero.error }, seed_ok: seed.ok,
      manual_equivalent_insert: { ok: man.ok, err: man.error }, manual_depth: d?.depth ?? null };
  });
  rec('F_f2_pre_fix_control', { ...(Fctrl.result ?? {}), tx_error: txErr(Fctrl),
    judged: false, unreachable: true,
    why: '旧期望「摘杆后自动继承 50⇒51」**不可达**：「继承」= 0011:252（就在被摘掉的触发器内）；摘杆后只能写'
      + '字面量，而字面量 depth=0 先撞 0007:60 CHECK(depth>=1) ⇒ 旧杆的「红」是探针口径错，不是缺陷',
    refs: ['0011:252', '0007:60', '0007:274（预写明的后果）'] });
  const fZeroErr = (Fctrl.result?.depth0_original_leg?.err ?? null) as PgErr | null;
  judge('F3b 可达对照（手写等价继承式，非原机制）：摘杆后父 depth=50 ⇒ 子 depth=51 可写入（数值形态可达）',
    Fctrl.result?.manual_equivalent_insert?.ok === true && Fctrl.result?.manual_depth === '51', Fctrl.result);
  rec('F3_original_expectation_unreachable_evidence', { reading: Fctrl.result?.depth0_original_leg ?? null,
    sqlstate: fZeroErr?.sqlstate ?? null, constraint: fZeroErr?.constraint ?? null,
    note: '原杆「红」的成因（23514）在此如实登记；旧期望已显式标为不可达并被上面的可达对照取代' });

  // ================================================================ §G 尾
  const cid1After = await platformSnapshot();
  rec('cid1_platform_accounts_after', cid1After);
  rec('trigger_enablement_after', await triggerEnablement(p));
  rec('graph_invariants_after', await readGraphInvariants(p));
  rec('residue', {
    // 残留登记**限定在本跑命名空间内**（库里同时有别的探针/别的脚本在写，全局计数不可作为本跑的判据）
    my_window_users: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM users WHERE uid = ANY($1::bigint[])`,
      [ALL_UIDS.map(String)]))?.n,
    my_window_referral_rows: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM referral
      WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`, [ALL_UIDS.map(String)]))?.n,
    poison_uids_in_graph: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM referral
      WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`, [POISON.map(String)]))?.n,
    my_key_prefix_rows: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE $1`,
      [`${KEYPREFIX}%`]))?.n,
    my_job_rows: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE $1`,
      [`biz:job:settle:${RUNTAG}%`]))?.n,
    my_currency_rows: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM currency WHERE symbol = $1`, [SYM]))?.n,
  });
  judge('G1 cid=1 平台账户（-1/-2/-3）未被触碰',
    JSON.stringify(cid1Before) === JSON.stringify(cid1After), { before: cid1Before, after: cid1After });
  const te = reads.trigger_enablement_after as { anomalies: unknown[] } | undefined;
  judge('G2 全部触发器启用（无异常）', Array.isArray(te?.anomalies) && te?.anomalies.length === 0, te?.anomalies);
  const gi = reads.graph_invariants_after as { cycles: string; bad_depth: string } | undefined;
  judge('G3 全局图不变式：cycles=0 且 bad_depth=0', gi?.cycles === '0' && gi?.bad_depth === '0', gi);
  judge(`G4 残留：回滚探针的毒环未留下（${POISON.join('/')} 在图里 0 行）`,
    (reads.residue as Record<string, unknown> | undefined)?.poison_uids_in_graph === '0', reads.residue);
  judge('G5 本跑窗口内的 uid 窗口复核仍空闲之外无异常（本跑自建夹具行数已登记）',
    Number((reads.residue as Record<string, string | undefined>)?.my_currency_rows ?? '0') >= 1, reads.residue);
  const stillOccupied = await occupiedUids(p, windowUids(ns.uid_base, WIN_SIZE));
  judge('G6 本跑窗口已写夹具（users/referral 占用数 = 45）',
    stillOccupied.length === WIN_SIZE, { occupied: stillOccupied.length, window_base: ns.uid_base });

  const out = { run: RUN, reds, reads };
  const file = save('p2w-00-verify', out);
  const txt = saveText('p2w-00-verify', JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ file, txt, run: RUN, uid_window_base: ns.uid_base, symbol: SYM, job_tag: RUNTAG,
    reds_count: reds.length, reds,
    key_readings: { fixture: { mint: reads.fixture_mint, hold_ctrl: reads.fixture_hold_ctrl },
      A: reads.A_f1_poisoned_chain ? {
      assertions: (reads.A_f1_poisoned_chain as Record<string, unknown>).assertions,
      plan_err: ((reads.A_f1_poisoned_chain as Record<string, unknown>).plan_result as Record<string, unknown>)?.err,
      bypass_post: (reads.A_f1_poisoned_chain as Record<string, unknown>).bypass_post,
      bypass_worker_credit: (reads.A_f1_poisoned_chain as Record<string, unknown>).bypass_worker_credit } : null,
      D: reads.D_f3, E: reads.E_f6_two_paths, F: reads.F_f2_stale_parent,
      C: { replay: reads.C_replay, recompute: reads.C_recompute_with_current_policy } } }, null, 1));
  await p.end();
  process.exit(ASSERT_MODE && reds.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
