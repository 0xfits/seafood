/**
 * P3-J · 探针 02：招工编排函数行为用例（①②③⑤ + 守卫矩阵 + 结算链）
 *
 * 用法：npx ts-node --transpile-only scripts/p3j-02-cases.ts
 * 写入面：只经 `public.job_post_event()` / `public.ledger_post_event()`（迁移创建的对象）与
 *         业务状态机的合法 UPDATE；测试 uid 由 identity 分配；供资走残差夹具的 `transfer`（净额守恒，
 *         不 mint、不改 currency 供给、不清理任何残差）。
 *
 * 用例（每条给头号读数）：
 *   ① 正常 publish 一次 ⇒ 业务行 + 分录成立 + `escrow_txid`/`ledger_event_keys`/`ref_id` 已回写
 *   ② 同键重放 ⇒ 200 且分录不翻倍、`ledger_event_keys` 不追加、业务行未重写（DL144①/DL149）
 *   ③ 余额/冻结正确（`job_escrow` −balance/+frozen；`job_escrow_refund` 反向）
 *   ④ 结算链：`job_payout`+`job_fee`+`commission`（有链 → `-2`；无链 → `-1`，DL86）+ DB 派生 vs
 *      `src/commission.ts` 的 P2 计划器**逐层对拍**
 *   ⑤ 非法状态迁移 ⇒ `JOB_STATE_INVALID`（**大写**）；DB 触发器层与编排函数层各一次
 *   ⑥ 守卫矩阵：核心字段冻结 / 账本引用列一次写定 / 禁 DELETE
 */
import { planJobSettlement } from '../src/commission';
import { mkPool, raw, raw1, save, jobPostEvent, ledgerPostEvent, ensureUser, fundFromResidual, acct, jobRow, ledgerRows, errInfo, RUN, uuidish } from './p3j-lib';

type Check = { id: string; name: string; pass: boolean; readout: Record<string, unknown> };

(async () => {
  const pool = mkPool(2);
  const checks: Check[] = [];
  const add = (id: string, name: string, pass: boolean, readout: Record<string, unknown> = {}) =>
    checks.push({ id, name, pass, readout });

  try {
    // ================================================================= setup
    const E = await ensureUser(pool, `0xp3jemployer${RUN}`);
    const W = await ensureUser(pool, `0xp3jworker${RUN}`);
    const fund = await fundFromResidual(pool, E, 1400n);
    const acctE0 = await acct(pool, E);

    const policy = await raw1<{ fee_rate_bp: number; levels: number; weights_bp: string }>(pool,
      `SELECT fee_rate_bp, levels, weights_bp::text AS weights_bp FROM public.commission_policy
        WHERE effective_from <= now() ORDER BY effective_from DESC LIMIT 1`);

    const chainWorker = await raw1<{ uid: string; depth: string }>(pool,
      `SELECT r.child_uid::text AS uid, r.depth::text AS depth FROM public.referral r
        WHERE r.depth >= 3 ORDER BY r.depth DESC, r.child_uid LIMIT 1`);

    // ================================================================= case ① publish
    const k1 = `cli:${uuidish('publish-1')}`;
    const fp1 = 'a'.repeat(64);
    const r1 = await jobPostEvent(pool, {
      op: 'publish', create_key: k1, employer_uid: E, cid: '1', reward: '200',
      title: 'p3j job 1', description: 'case ①', request_fingerprint: fp1,
    });
    const job1 = String(r1.job_id);
    const job1Row = await jobRow(pool, job1);
    const escrowKey = `biz:job:escrow:${job1}`;
    const rows1 = await ledgerRows(pool, escrowKey);
    const acctE1 = await acct(pool, E);
    add('C1', '正常 publish 一次 ⇒ 业务行 + 分录 + 引用列/事件键回写', (
      r1.idempotent_replay === false && r1.created === true && r1.status === 'open'
      && job1Row?.escrow_txid !== null && String(r1.txid) === String(job1Row?.escrow_txid)
      && JSON.stringify(job1Row?.ledger_event_keys) === JSON.stringify([escrowKey])
      && rows1.length === 2
      && rows1.every((x) => x.kind === 'job_escrow' && x.ref_type === 'job' && String(x.ref_id) === job1)
      && String(rows1[0].delta) === '-200' && String(rows1[0].frozen_delta) === '0'
      && String(rows1[1].delta) === '0' && String(rows1[1].frozen_delta) === '200'
      && String(acctE1?.balance) === String(Number(acctE0?.balance) - 200)
      && String(acctE1?.frozen) === String(Number(acctE0?.frozen) + 200)
    ), { job_row: job1Row, escrow_key: escrowKey, ledger_rows: rows1, account: acctE1, account_before: acctE0, response: { txid: r1.txid, entries: r1.entries, created: r1.created, status: r1.status } });

    // ================================================================= case ② same-key replay（publish）
    const r1b = await jobPostEvent(pool, {
      op: 'publish', create_key: k1, employer_uid: E, cid: '1', reward: '200',
      title: 'p3j job 1', description: 'case ①', request_fingerprint: fp1,
    });
    const rows1b = await ledgerRows(pool, escrowKey);
    const job1RowB = await jobRow(pool, job1);
    const acctE1b = await acct(pool, E);
    add('C2', '同键重放 ⇒ 200 重放、分录不翻倍、ledger_event_keys 不追加、业务行未重写（DL149②③）', (
      r1b.idempotent_replay === true
      && String(r1b.txid) === String(r1.txid)
      && rows1b.length === 2
      && JSON.stringify(job1RowB?.ledger_event_keys) === JSON.stringify([escrowKey])
      && String(job1RowB?.time_updated) === String(job1Row?.time_updated)
      && String(job1RowB?.escrow_txid) === String(job1Row?.escrow_txid)
      && String(acctE1b?.balance) === String(acctE1?.balance)
      && String(acctE1b?.frozen) === String(acctE1?.frozen)
    ), { txid_first: r1.txid, txid_replay: r1b.txid, rows_after_replay: rows1b.length, job_row_after_replay: job1RowB, job_row_before: job1Row, account_after_replay: acctE1b });

    // DL144② 同键异指纹 ⇒ 409（另起一个全新 create_key 的 job 才能触发账本侧冲突：用 create_key 冲突路径）
    const conf = await jobPostEvent(pool, {
      op: 'publish', create_key: k1, employer_uid: E, cid: '1', reward: '2000', title: 'different',
    }).then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e: errInfo(e) }));
    add('C2b', '同 create_key 但业务内容不同 ⇒ 拒绝（不改数据）', conf.ok === false && (conf as { e: { sqlstate: string | null } }).e.sqlstate === 'LD003',
      { outcome: conf });

    // ================================================================= case ⑤ 非法状态迁移（编排函数层）
    const ill = await jobPostEvent(pool, { op: 'settle', job_id: job1, request_fingerprint: fp1 })
      .then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e: errInfo(e) }));
    add('C5a', '编排函数层：open→settled 非法 ⇒ LD011 + reason=JOB_STATE_INVALID（大写）', (
      ill.ok === false
      && (ill as { e: { sqlstate: string | null } }).e.sqlstate === 'LD011'
      && (ill as { e: { message: string } }).e.message === 'LEDGER_CURRENCY_INVALID_TRANSITION'
      && (ill as { e: { reason: string | null } }).e.reason === 'JOB_STATE_INVALID'
      && JSON.stringify((ill as { e: { detail: string } }).e.detail).indexOf('job_state_transition_invalid') < 0
    ), { outcome: ill });

    // case ⑤b DB 触发器层（DL77：判负用例两层各一）
    const illTrig = await raw(pool, `UPDATE public.job SET status='settled' WHERE job_id=$1::bigint`, [job1])
      .then(() => ({ ok: true })).catch((e) => ({ ok: false, e: errInfo(e) }));
    add('C5b', 'DB 触发器层：open→settled 非法 ⇒ LD011 + reason=JOB_STATE_INVALID（大写）', (
      illTrig.ok === false && (illTrig as { e: { sqlstate: string | null } }).e.sqlstate === 'LD011'
      && (illTrig as { e: { reason: string | null } }).e.reason === 'JOB_STATE_INVALID'
    ), { outcome: illTrig });

    // ================================================================= case ③ refund（余额/冻结正确）publish 700 → cancel
    const r2 = await jobPostEvent(pool, {
      op: 'publish', create_key: `cli:${uuidish('publish-2')}`, employer_uid: E, cid: '1', reward: '700', title: 'p3j job 2',
    });
    const job2 = String(r2.job_id);
    const acctAfterEscrow2 = await acct(pool, E);
    const r2refund = await jobPostEvent(pool, { op: 'refund', job_id: job2, to_status: 'cancelled' });
    const refundKey = `biz:job:refund:${job2}`;
    const rows2 = await ledgerRows(pool, refundKey);
    const job2Row = await jobRow(pool, job2);
    const acctAfterRefund = await acct(pool, E);
    add('C3', 'refund ⇒ job_escrow_refund 反向（+balance/−frozen）、状态 cancelled、事件键两条', (
      r2refund.status === 'cancelled'
      && rows2.length === 2
      && rows2.every((x) => x.kind === 'job_escrow_refund' && x.ref_type === 'job' && String(x.ref_id) === job2)
      && String(rows2[0].delta) === '700' && String(rows2[0].frozen_delta) === '0'
      && String(rows2[1].delta) === '0' && String(rows2[1].frozen_delta) === '-700'
      && String(acctAfterRefund?.frozen) === String(Number(acctAfterEscrow2?.frozen) - 700)
      && String(acctAfterRefund?.balance) === String(Number(acctAfterEscrow2?.balance) + 700)
      && (job2Row?.ledger_event_keys as string[]).length === 2
      && String(job2Row?.escrow_txid) === String(r2.txid)
    ), { ledger_rows: rows2, job_row: job2Row, account_after_escrow: acctAfterEscrow2, account_after_refund: acctAfterRefund, response: { status: r2refund.status, keys: r2refund.ledger_event_keys } });

    // ================================================================= 守卫矩阵（用 job2：已终态）
    const gCore = await raw(pool, `UPDATE public.job SET reward = 1 WHERE job_id=$1::bigint`, [job2])
      .then(() => ({ ok: true })).catch((e) => ({ ok: false, e: errInfo(e) }));
    const gRef = await raw(pool, `UPDATE public.job SET escrow_txid = NULL WHERE job_id=$1::bigint`, [job2])
      .then(() => ({ ok: true })).catch((e) => ({ ok: false, e: errInfo(e) }));
    const gDel = await raw(pool, `DELETE FROM public.job WHERE job_id=$1::bigint`, [job2])
      .then(() => ({ ok: true })).catch((e) => ({ ok: false, e: errInfo(e) }));
    const gCreateKey = await raw(pool, `UPDATE public.job SET create_key = create_key || 'x' WHERE job_id=$1::bigint`, [job2])
      .then(() => ({ ok: true })).catch((e) => ({ ok: false, e: errInfo(e) }));
    add('C6', '守卫矩阵：核心字段冻结 / 引用列一次写定 / 禁 DELETE / create_key 不可改', (
      gCore.ok === false && (gCore as { e: { reason: string | null } }).e.reason === 'job_core_fields_immutable'
      && gRef.ok === false && (gRef as { e: { reason: string | null } }).e.reason === 'job_ledger_ref_immutable'
      && gDel.ok === false && (gDel as { e: { reason: string | null } }).e.reason === 'job_delete_forbidden'
      && gCreateKey.ok === false && (gCreateKey as { e: { reason: string | null } }).e.reason === 'job_create_key_immutable'
    ), { core: gCore, ref: gRef, del: gDel, create_key: gCreateKey });

    // ================================================================= case ④ 结算链（有链 M>0 ⇒ -2；无链 M=0 ⇒ -1）
    const settleOne = async (label: string, worker: string, reward: string) => {
      const p = await jobPostEvent(pool, { op: 'publish', create_key: `cli:${uuidish(label)}`, employer_uid: E, cid: '1', reward, title: label });
      const id = String(p.job_id);
      await raw(pool, `UPDATE public.job SET status='accepted', worker_uid=$2::bigint WHERE job_id=$1::bigint AND status='open'`, [id, worker]);
      await raw(pool, `UPDATE public.job SET status='submitted' WHERE job_id=$1::bigint AND status='accepted'`, [id]);
      const fp = 'b'.repeat(64);
      const s = await jobPostEvent(pool, { op: 'settle', job_id: id, request_fingerprint: fp });
      const key = `biz:job:settle:${id}`;
      const rows = await ledgerRows(pool, key);
      const jr = await jobRow(pool, id);
      const s2 = await jobPostEvent(pool, { op: 'settle', job_id: id, request_fingerprint: fp });
      const rowsAfterReplay = await ledgerRows(pool, key);
      const jr2 = await jobRow(pool, id);
      return { id, publish: p, settle: s, settle_replay: s2, key, rows, rows_after_replay: rowsAfterReplay.length, job_row: jr, job_row_after_replay: jr2 };
    };

    const bp = BigInt(String(policy?.fee_rate_bp ?? 0));
    const s3 = await settleOne('p3j-settle-chain', String(chainWorker?.uid ?? W), '1000');
    const expFee = (1000n * bp + 5000n) / 10000n;
    const kinds3 = s3.rows.map((r) => String(r.kind));
    const commOut = s3.rows.filter((r) => r.kind === 'commission' && String(r.uid) === '-2').reduce((a, r) => a + BigInt(String(r.delta)), 0n);
    const commIn = s3.rows.filter((r) => r.kind === 'commission' && String(r.uid) !== '-2').reduce((a, r) => a + BigInt(String(r.delta)), 0n);
    const feePoolIn = s3.rows.filter((r) => r.kind === 'job_fee' && String(r.uid) === '-2').reduce((a, r) => a + BigInt(String(r.delta)), 0n);
    const payoutNet = s3.rows.filter((r) => r.kind === 'job_payout').reduce((a, r) => a + BigInt(String(r.delta)), 0n);

    // 逐层对拍：DB 派生 vs P2 的 TS 计划器（src/commission.ts）
    let tsPlan: Record<string, unknown> | null = null;
    let tsPlanError: Record<string, unknown> | null = null;
    try {
      const plan = await planJobSettlement({
        jobId: s3.id, employerUid: E, workerUid: String(chainWorker?.uid ?? W), cid: '1', gross: '1000',
        ex: pool as never, at: new Date(),
      });
      tsPlan = {
        fee: plan.fee, net: plan.net, M: plan.M, N: plan.N, W: plan.W, fee_credit_uid: plan.fee_credit_uid,
        layers: plan.layers.map((l) => ({ level: l.level, beneficiary_uid: l.beneficiary_uid, weight_bp: l.weight_bp, q: l.q, r: l.r, x: l.x })),
      };
    } catch (e) { tsPlanError = errInfo(e) as unknown as Record<string, unknown>; }
    const dbPlan = await raw1<{ p: Record<string, unknown> }>(pool,
      `SELECT public.job_settle_plan($1::bigint,$2::bigint,$3::bigint,1::bigint,1000::bigint) AS p`,
      [s3.id, E, String(chainWorker?.uid ?? W)]);
    const dbPlanShape = dbPlan?.p ? {
      fee: dbPlan.p.fee, net: dbPlan.p.net, M: dbPlan.p.M, N: dbPlan.p.N, W: dbPlan.p.W,
      fee_credit_uid: dbPlan.p.fee_credit_uid, layers: dbPlan.p.layers,
    } : null;

    add('C4', '结算链（有链 ⇒ −2）：kind 白名单 / net+fee=gross / Σcommission 出==fee 入 / 状态+settle_txid', (
      s3.settle.status === 'settled'
      && s3.settle.idempotent_replay === false
      && String(s3.settle.txid) === String(s3.job_row?.settle_txid)
      && kinds3.indexOf('job_payout') >= 0 && kinds3.indexOf('job_fee') >= 0 && kinds3.indexOf('commission') >= 0
      && kinds3.every((k) => ['job_payout', 'job_fee', 'commission'].indexOf(k) >= 0)
      && payoutNet === 1000n - expFee
      && feePoolIn === expFee
      && commOut === -expFee && commIn === expFee
      && (s3.job_row?.ledger_event_keys as string[]).length === 2
    ), { job_id: s3.id, key: s3.key, kinds: kinds3, rows: s3.rows, expected_fee: expFee.toString(), db_plan: dbPlanShape, job_row: s3.job_row, response: { status: s3.settle.status, txid: s3.settle.txid, keys: s3.settle.ledger_event_keys } });

    const canon = (p: Record<string, unknown> | null): string => p === null ? 'null' : JSON.stringify({
      fee: p.fee, net: p.net, M: p.M, N: p.N, W: p.W, fee_credit_uid: p.fee_credit_uid,
      // 口径差异（**非实现差异**）：DB 的 layers 只列**实付层**（x>0，= N 条，CR48）；
      // `src/commission.ts` 的 `plan.layers` 列全部 M 层（x 可为 "0"）⇒ 对拍前一律过滤 x==="0"。
      layers: ((p.layers as Array<Record<string, unknown>>) ?? [])
        .filter((l) => String(l.x) !== '0')
        .map((l) => [l.level, l.beneficiary_uid, l.weight_bp, l.q, l.r, l.x]),
    });
    add('C4b', 'DB 派生 vs `src/commission.ts` 计划器**逐层对拍**（fee/net/M/N/W/fee_credit_uid/layers）', (
      tsPlan !== null && dbPlanShape !== null && canon(tsPlan) === canon(dbPlanShape)
    ), { canon_ts: canon(tsPlan), canon_db: canon(dbPlanShape), ts_plan: tsPlan, ts_plan_error: tsPlanError, db_plan: dbPlanShape });

    add('C4c', '结算同键重放 ⇒ 不翻倍、不追加事件键、settle_txid/status 未第二次写', (
      s3.settle_replay.idempotent_replay === true
      && String(s3.settle_replay.txid) === String(s3.settle.txid)
      && s3.rows_after_replay === s3.rows.length
      && JSON.stringify(s3.job_row_after_replay?.ledger_event_keys) === JSON.stringify(s3.job_row?.ledger_event_keys)
      && String(s3.job_row_after_replay?.time_updated) === String(s3.job_row?.time_updated)
    ), { txid_first: s3.settle.txid, txid_replay: s3.settle_replay.txid, rows: s3.rows.length, rows_after_replay: s3.rows_after_replay, job_row: s3.job_row, job_row_after_replay: s3.job_row_after_replay });

    // 无邀请人 ⇒ fee 入 -1（DL86：不得写 -2）
    const s4 = await settleOne('p3j-settle-noref', W, '100');
    const kinds4 = s4.rows.map((r) => String(r.kind));
    const feeRows4 = s4.rows.filter((r) => r.kind === 'job_fee');
    const plat4 = await raw1<{ delta: string }>(pool,
      `SELECT COALESCE(sum(delta),0)::text AS delta FROM public.ledger_entry WHERE event_root_key=$1 AND uid=-1`, [s4.key]);
    const pool4 = await raw1<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key=$1 AND uid=-2`, [s4.key]);
    const fee100 = (100n * bp + 5000n) / 10000n;
    add('C4d', '无邀请人（M=0）⇒ job_fee 入 −1（平台），−2 零命中（DL86）', (
      s4.settle.status === 'settled'
      && kinds4.every((k) => ['job_payout', 'job_fee'].indexOf(k) >= 0)
      && feeRows4.length === 2 && String(plat4?.delta) === fee100.toString()
      && Number(pool4?.n) === 0
    ), { job_id: s4.id, key: s4.key, kinds: kinds4, fee_rows: feeRows4, platform_minus1_delta: plat4?.delta, minus2_rows: pool4?.n, expected_fee: fee100.toString() });

    // ================================================================= 汇总
    const out = {
      probe: 'P3J-02-CASES', run_tag: RUN,
      test_data: { employer_uid: E, worker_uid_new: W, chain_worker_uid: chainWorker?.uid ?? null, chain_depth: chainWorker?.depth ?? null, fund },
      policy_effective: policy,
      checks,
      pass_count: checks.filter((c) => c.pass).length,
      fail_count: checks.filter((c) => !c.pass).length,
      failed: checks.filter((c) => !c.pass).map((c) => c.id),
    };
    const file = save('cases', out);
    console.log(JSON.stringify({ artifact: file, pass_count: out.pass_count, fail_count: out.fail_count, failed: out.failed, checks: checks.map((c) => ({ id: c.id, pass: c.pass })) }, null, 2));
    process.exitCode = out.fail_count === 0 ? 0 : 3;
  } finally {
    await pool.end().catch(() => undefined);
  }
})().catch((e) => { console.error('p3j-02 fatal:', (e as Error)?.message || e); process.exit(2); });
