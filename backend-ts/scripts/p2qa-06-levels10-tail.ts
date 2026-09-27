/**
 * p2qa-06 · 补证（独立质检 Neng）：**levels = 10 时第 11/12 层一分未得的「账本级」证据**
 * ============================================================================
 * 上一轮只拿到 `chain_depth` 截断读数（chain_cap10 只回 10 个节点、within_cap=true）。
 * 本脚本补的是**账本级**证据：造一条**13 节点**（12 级祖先）的链，用**当前生效政策**（levels=10）真结算，
 * 然后回到 `ledger_entry` 逐 uid 数佣金贷方行 —— 第 11 / 12 级祖先必须**一行都没有**，账户余额为 0。
 * 本脚本**提交**这次结算（真账读数，不靠事务内未提交视图），全部落在**本单自己的分区**：
 *   uid 9549xx / symbol p1u6* / 幂等键 ops:p1u:*；cid 由 ensureCurrency 新建（绝不碰 cid = 1）。
 * ============================================================================
 */
import {
  mkPool, raw1, save, sha256, ensureUsers, ensureCurrency, mintTo, holdFor, trySql, errInfo,
  RUN, type Qx,
} from './p2qa-lib';
import {
  getCommissionPolicy, planJobSettlement, settleJobCommission, readEventFacts, jobSettleKey,
  type SettleJobInput, type Queryable,
} from '../src/commission';
import { LedgerError, isLedgerError } from '../src/ledger-errors';

const EMP = 954001;
const W = 954901;                                        // 打工人（叶）
const ANC = Array.from({ length: 12 }, (_, i) => 954902 + i);  // 12 级祖先：距离 1..12
const ALL = [W, ...ANC];

const tsErr = (e: unknown): Record<string, unknown> =>
  isLedgerError(e) ? { ts_code: (e as LedgerError).code, http: (e as LedgerError).httpStatus, details: (e as LedgerError).details }
    : { ts_code: 'NON_LEDGER', message: String(e) };

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '10';
  const p = mkPool(10);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = {
    script: 'scripts/p2qa-06-levels10-tail.ts', run: RUN,
    question: 'levels=10、链长 12 时：第 11/12 级祖先在**账上**是否真的零得（不是只看 plan 的 chain_depth 截断读数）？',
  };

  const cid = await ensureCurrency(p, 'p1u6' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), String(EMP), 0);
  await ensureUsers(p, ALL);

  // 平台账户只读基线（cid=1 的 -1/-2 必须逐字节不变）
  const platPre = await trySql<Record<string, string>>(p, `
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account
     WHERE cid = 1 AND uid IN (-1,-2) ORDER BY uid`);

  // 政策（当前生效）—— 只读，绝不新增 commission_policy 行（F5 = 该表已被历轮验收脚本永久污染）
  const pol = await getCommissionPolicy(null, q);
  out.policy_now = pol as unknown as Record<string, unknown>;

  // ---- 夹具：叶 → 12 级祖先（按合法协议「先绑父、再绑子」）；uid 窗口必须是全新的
  const preRows = await trySql<Record<string, string>>(p, `
    SELECT count(*)::text AS n FROM referral WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`,
    [ALL.map(String)]);
  const bindChain: Array<Record<string, unknown>> = [];
  await mintTo(p, String(EMP), cid, '50000000', `ops:p1u:mint6-${RUN}`);
  for (let i = ANC.length - 1; i >= 0; i--) {
    const child = i === 0 ? W : ANC[i - 1];
    const r = await trySql<{ j?: unknown }>(p, 'SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(child), String(ANC[i])]);
    bindChain.push({ edge: `${child}->${ANC[i]}`, ok: r.ok, depth: (r.rows[0] as { j?: { depth?: string } })?.j?.depth, err: r.error ?? null });
  }
  out.setup = { cid, uid_window: ALL, pre_existing_referral_rows: preRows.rows, binds: bindChain,
    binds_failed: bindChain.filter((b) => b.ok !== true) };

  // ---- 递归上行链：证明这 12 级祖先**真的存在**（不是「链只有 10 级」）
  const chainRows = await trySql<{ uid: string; distance: string; depth: string }>(p, `
    WITH RECURSIVE up AS (
      SELECT r.parent_uid AS uid, 1 AS d FROM referral r WHERE r.child_uid = $1
      UNION ALL SELECT r.parent_uid, up.d + 1 FROM referral r JOIN up ON r.child_uid = up.uid WHERE up.d < 50)
    SELECT up.uid::text AS uid, up.d::text AS distance, COALESCE(rf.depth, 0)::text AS depth
      FROM up LEFT JOIN referral rf ON rf.child_uid = up.uid ORDER BY up.d`, [String(W)]);
  out.chain_above_worker = chainRows.rows;
  out.chain_above_worker_len = chainRows.rows.length;

  // ---- 真结算（提交）
  const OFF = BigInt('0x' + sha256('joboff6' + RUN).slice(0, 8)) % 1000000000n;
  const JOB = (954_600_000_000_000n + OFF).toString();
  const gross = '10000000';                                    // fee = 0.1% * 1e7 = 1e4? -> 用 100bp 政策：fee = 100000
  await holdFor(p, String(EMP), cid, gross, JOB, `ops:p1u:hold6-${RUN}`);
  const input = { jobId: JOB, employerUid: String(EMP), workerUid: String(W), cid, gross, ex: q } as SettleJobInput;
  const plan = await planJobSettlement(input);
  let posted: Record<string, unknown>;
  try {
    const r = await settleJobCommission(input);
    posted = { ok: r.result.ok, replay: r.business.replay, fee: r.plan.fee, pool: r.plan.pool, M: r.plan.M,
      chain_depth: r.plan.chain_depth, x: r.plan.layers.map((l) => l.x), uids: r.plan.layers.map((l) => l.beneficiary_uid) };
  } catch (e) { posted = { threw: tsErr(e) }; }
  out.settlement = { job_id: JOB, key: jobSettleKey(JOB), gross, plan_M: plan.M, plan_chain_depth: plan.chain_depth,
    plan_x: plan.layers.map((l) => l.x), plan_uids: plan.layers.map((l) => l.beneficiary_uid), plan_W: plan.W,
    plan_sum_x: plan.layers.reduce((a, l) => a + BigInt(l.x), 0n).toString(), posted };

  // ---- 账本级：逐 uid 数佣金行（权益人 = 距离 1..12 的祖先）
  const rootKey = jobSettleKey(JOB);
  const perUid = await trySql<Record<string, string>>(p, `
    SELECT u.uid::text AS uid, u.distance::text AS distance,
           (SELECT count(*) FROM ledger_entry e WHERE e.uid = u.uid AND e.kind = 'commission'
              AND COALESCE(e.event_root_key, split_part(e.idempotency_key,'#',1)) = $2)::text AS comm_rows,
           (SELECT COALESCE(sum(e.delta),0) FROM ledger_entry e WHERE e.uid = u.uid AND e.kind = 'commission'
              AND COALESCE(e.event_root_key, split_part(e.idempotency_key,'#',1)) = $2)::text AS comm_delta,
           (SELECT COALESCE(a.balance,0)::text FROM account a WHERE a.uid = u.uid AND a.cid = $3) AS balance,
           (SELECT COALESCE(a.frozen,0)::text FROM account a WHERE a.uid = u.uid AND a.cid = $3) AS frozen
      FROM (SELECT uu AS uid, dd AS distance FROM unnest($1::bigint[], $4::int[]) AS t(uu, dd)) AS u
     ORDER BY u.distance`,
    [ANC.map(String), rootKey, cid, ANC.map((_, i) => i + 1)]);
  out.account_level_per_ancestor = perUid.rows;

  const allRows = await trySql<Record<string, string>>(p, `
    SELECT uid::text AS uid, kind, count(*)::text AS n, COALESCE(sum(delta),0)::text AS sum_delta
      FROM ledger_entry WHERE COALESCE(event_root_key, split_part(idempotency_key,'#',1)) = $1
     GROUP BY 1,2 ORDER BY 1,2`, [rootKey]);
  out.event_rows_by_uid_kind = allRows.rows;

  const facts = await readEventFacts(rootKey, String(EMP), String(W), q);
  out.event_facts = facts as unknown as Record<string, unknown>;

  // ---- 判定：距离 ≤10 有佣金行；距离 11/12 零行 + 余额 0
  const tail = perUid.rows.filter((r) => Number(r.distance) >= 11);
  const head = perUid.rows.filter((r) => Number(r.distance) <= 10);
  out.verdict = {
    distance_le_10_all_paid: head.length === 10 && head.every((r) => Number(r.comm_rows) > 0 && r.comm_delta !== '0'),
    distance_11_12_zero_rows: tail.length === 2 && tail.every((r) => r.comm_rows === '0'),
    distance_11_12_zero_delta: tail.every((r) => (r.comm_delta ?? '0') === '0'),
    distance_11_12_account_zero: tail.every((r) => (r.balance ?? '0') === '0' && (r.frozen ?? '0') === '0'),
    plan_M_eq_10: plan.M === 10, plan_chain_depth_eq_10: plan.chain_depth === 10,
    plan_x_len_10: plan.layers.length === 10,
    sum_x_equals_pool: plan.layers.reduce((a, l) => a + BigInt(l.x), 0n).toString() === plan.pool,
    chain_has_12_ancestors: chainRows.rows.length === 12,
  };

  // ---- 平台只读基线的收尾复核（cid=1 未动）
  const platPost = await trySql<Record<string, string>>(p, `
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account
     WHERE cid = 1 AND uid IN (-1,-2) ORDER BY uid`);
  out.platform_cid1_unchanged = JSON.stringify(platPre.rows) === JSON.stringify(platPost.rows);
  out.platform_cid1 = { pre: platPre.rows, post: platPost.rows };

  const f = save('p2qa-06-levels10-tail', out);
  console.log(JSON.stringify({ saved: f, verdict: out.verdict,
    account_level: out.account_level_per_ancestor, settlement: out.settlement }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', errInfo(e)); process.exit(1); });
