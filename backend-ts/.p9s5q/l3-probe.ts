/**
 * P9⑤ L3 自写四段真链路探针（Neng · 独立质检 · 续跑单）。
 * 不复用实现方产物；库面写一律**事务内 + 末尾 ROLLBACK**。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s5q/l3-probe.ts
 * 出口：JSON 到 stdout（并写 .p9s5q/l3-probe.out）。全部真读数为现取。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { settleJob } from '../src/job-funds-service';
import {
  buildCommissionRoster, splitPoolTwoLevel, splitPoolByWeights,
  assertReferralChainInvariants, planJobSettlement, COMMISSION_REASON,
  COMMISSION_CAP_LAYER_DEFAULT, COMMISSION_CAP_TOTAL_DEFAULT,
  PLATFORM_REVENUE_UID, COMMISSION_POOL_UID,
} from '../src/commission';
import { SYSTEM_CURRENCY_CID } from '../src/ledger';

const W6 = [2600, 1700, 700, 2600, 1700, 700];
const WORKER = '9800099';
const SENT = 'L3_ROLLBACK_SENTINEL';
const checks: Array<{ id: string; pass: boolean; expect: string; actual: string }> = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown): void =>
  checks.push({ id, pass: Boolean(pass), expect: String(expect), actual: typeof actual === 'string' ? actual : JSON.stringify(actual) });
const evmOf = (u: number) => `0x${u.toString(16).padStart(40, '0')}`;
const OUT: Record<string, unknown> = {};

const mkUp = (uids: string[]) => ({
  nodes: uids.map((u, i) => ({ beneficiary_uid: u, level: i + 1 })),
  chain_depth: uids.length, truncated: false,
  assertions: { contiguous_levels: true, within_cap: true, all_user_uids: true, no_duplicate_uid: true },
});
const mkDown = (arr: Array<{ uid: string; level: number }>) => ({
  nodes: arr.map((n) => ({ descendant_uid: n.uid, level: n.level, bound_at: null })),
  down_depth: arr.reduce((m, n) => Math.max(m, n.level), 0), truncated: false,
  assertions: { contiguous_levels: true, within_cap: true, all_user_uids: true, no_duplicate_uid: true },
});

const TABLES = ['currency', 'ledger_entry', 'batt_account', 'batt_entry', 'account', 'users', 'job', 'job_submission', 'referral'];
const counts = async (): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (const tb of TABLES) {
    const r = await readQuery<{ n: string }>(`SELECT count(*)::text AS n FROM public.${tb}`);
    out[tb] = Number(r[0].n);
  }
  return out;
};

(async () => {
  const before = await counts();
  OUT.residual_before = before;

  await withTransaction(async (tx: TxClient) => {
    const q = <T>(s: string, p?: unknown[]): Promise<T[]> => tx.query<T>(s, p).then((r) => r.rows);
    const mkUsers = async (uids: number[]) => {
      for (const uid of uids) {
        await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last) VALUES ($1,$2,'',false,now(),now())`, [uid, evmOf(uid)]);
      }
    };
    const bind = (child: number, parent: number) => tx.query(`SELECT public.referral_bind($1::bigint,$2::bigint)`, [child, parent]);
    const battRowsOf = (uid: number) => q<Record<string, unknown>>(`SELECT txid::text AS txid, delta::text AS delta, batt_after::text AS batt_after, reason, idempotency_key FROM public.batt_entry WHERE uid=$1 ORDER BY txid`, [uid]);
    const ledRowsOf = (key: string) => q<Record<string, unknown>>(`SELECT uid::text AS uid, delta::text AS delta, kind, memo FROM public.ledger_entry WHERE split_part(idempotency_key,'#',1)=$1 ORDER BY txid`, [key]);
    const sp = async <T>(name: string, fn: () => Promise<T>) => {
      await tx.query(`SAVEPOINT ${name}`);
      try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return { ok: true as const, v }; }
      catch (e) {
        await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
        const err = e as { code?: string; message?: string; detail?: string; details?: { reason?: string }; httpStatus?: number };
        let reason: string | null = err.details?.reason ?? null;
        if (reason === null && err.detail) { try { reason = (JSON.parse(String(err.detail)) as { reason?: string }).reason ?? null; } catch { /* noop */ } }
        return { ok: false as const, code: String(err.code ?? ''), message: String(err.message ?? '').slice(0, 160), reason, httpStatus: err.httpStatus };
      }
    };

    // ============================================================ 夹具用户
    // 固定 uid 块（避开 sequence：现取 maxuid=971213）⇒ 98xxxxx 远超
    const presets = [9800001, 9800002];
    const chain2 = [9800021, 9800022];            // W(worker) + P(parent)
    const chain3 = [9800051, 9800052, 9800053];   // W3 + P3 + reviewer
    const six = [9800031, 9800032, 9800033, 9800034, 9800035, 9800036, 9800037, 9800038, 9800090]; // U3,U2,U1,W6,D1,D2,D3,D1b,noRef
    await mkUsers([...presets, ...chain2, ...chain3, ...six]);
    OUT.fixtures_ok = true;

    // ============================================================ L3①  注册腿
    const evmA = '0x' + 'a1'.repeat(20);
    const uA1 = await DatabaseService.findOrCreateUserByEvm(evmA, tx);
    const uidA = Number((uA1 as unknown as { uID: number }).uID);
    const regNew = {
      uid: String(uidA), batt: Number((await q<{ b: number }>(`SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid=$1),0)::int AS b`, [uidA]))[0].b),
      rows: (await battRowsOf(uidA)).length, entry: (await battRowsOf(uidA))[0] ?? null,
    };
    const uA2 = await DatabaseService.findOrCreateUserByEvm(evmA, tx);
    const uidA2 = Number((uA2 as unknown as { uID: number }).uID);
    const regReplay = {
      uid: String(uidA2), batt: Number((await q<{ b: number }>(`SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid=$1),0)::int AS b`, [uidA2]))[0].b),
      rows: (await battRowsOf(uidA2)).length,
    };
    OUT.L3_1_reg = { new: regNew, replay: regReplay };
    t('L3-1a 注册腿建户 +30', regNew.rows === 1 && regNew.batt === 30 && String((regNew.entry as Record<string, unknown>)?.delta) === '30' && String((regNew.entry as Record<string, unknown>)?.reason) === 'invite_signup',
      'findOrCreateUserByEvm 建户分支 ⇒ granted +30 batt（1 行 batt_entry / reason=invite_signup）',
      { batt: regNew.batt, delta: (regNew.entry as Record<string, unknown>)?.delta, reason: (regNew.entry as Record<string, unknown>)?.reason });
    t('L3-1b 注册腿重放零新增', uidA2 === uidA && regReplay.batt === 30 && regReplay.rows === 1,
      '同 EVM 二次调用 ⇒ 命中已存在用户（不建户、不双发）⇒ batt 仍 30 / batt_entry 仍 1 行',
      { same_uid: uidA2 === uidA, batt: regReplay.batt, rows: regReplay.rows });

    // 预置 90 ⇒ 封顶 100
    await tx.query(`INSERT INTO public.batt_account (uid, batt) VALUES ($1, 90)`, [9800001]);
    const g90 = await DatabaseService.grantSignupInviteBatt(9800001, tx);
    const r90 = await battRowsOf(9800001);
    // 预置 100 ⇒ +0
    await tx.query(`INSERT INTO public.batt_account (uid, batt) VALUES ($1, 100)`, [9800002]);
    const g100 = await DatabaseService.grantSignupInviteBatt(9800002, tx);
    const r100 = await battRowsOf(9800002);
    OUT.L3_1_cap = { preset90: { outcome: g90.outcome, granted: g90.grantedBatt, batt: g90.batt, rows: r90.length, delta: r90[0]?.delta ?? null }, preset100: { outcome: g100.outcome, granted: g100.grantedBatt, batt: g100.batt, rows: r100.length } };
    t('L3-1c 预置 90 封顶 100', g90.outcome === 'capped' && g90.batt === 100 && g90.grantedBatt === 10 && r90.length === 1 && String(r90[0].delta) === '10',
      'batt=90 预置 ⇒ outcome=capped / granted=+10 / batt=100（封顶 BATT_CAP_HARD_MAX=100）', OUT.L3_1_cap.preset90);
    t('L3-1d 预置 100 ⇒ +0', g100.outcome === 'capped' && g100.batt === 100 && g100.grantedBatt === 0 && r100.length === 0,
      'batt=100 预置 ⇒ outcome=capped / granted=0 / **零 batt_entry 行**', OUT.L3_1_cap.preset100);

    // ============================================================ L3②  首任务腿（方法级 N=2 / N=1 / 重放）
    await bind(9800021, 9800022); // child=W ← parent=P
    await tx.query(`INSERT INTO public.job (employer_uid, worker_uid, cid, reward, create_key) VALUES (970001,$1,1,100000,$2)`, [9800021, 'l3:job:W2']);
    const jobW = String((await q<{ j: string }>(`SELECT job_id::text AS j FROM public.job WHERE create_key='l3:job:W2'`))[0].j);
    const key2 = `biz:invite:firsttask:9800021`;
    const ftN2 = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: jobW }, tx);
    const rows1 = await ledRowsOf(key2);
    const ftReplay = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: jobW }, tx);
    const rows1b = await ledRowsOf(key2);
    OUT.L3_2_N2 = { outcome: ftN2.outcome, recipients: ftN2.recipientUids, perLeg: ftN2.perLegUsd, total: ftN2.totalUsdFromPlatform, key: ftN2.idempotencyKey, rows: rows1 };
    t('L3-2a 首任务腿 N=2', ftN2.outcome === 'posted' && ftN2.totalUsdFromPlatform === '20' && ftN2.perLegUsd === 10
      && rows1.map((r) => `${r.uid}:${r.delta}`).sort().join(',') === '-1:-20,9800021:10,9800022:10',
      'posted：−1 −20 / 本人 9800021 +10 / 直接上级 9800022 +10（kind=invite_first_task_reward）', { outcome: ftN2.outcome, legs: rows1.map((r) => `${r.uid}:${r.delta}`).join(',') });
    t('L3-2b 首任务腿重放零新增', ftReplay.outcome === 'replayed' && rows1b.length === rows1.length,
      '同键（biz:invite:firsttask:9800021）重放 ⇒ replayed / 行数不增', { outcome: ftReplay.outcome, rows: `${rows1.length}→${rows1b.length}` });

    await tx.query(`INSERT INTO public.job (employer_uid, worker_uid, cid, reward, create_key) VALUES (970001,$1,1,100000,$2)`, [9800090, 'l3:job:W1']);
    const jobW1 = String((await q<{ j: string }>(`SELECT job_id::text AS j FROM public.job WHERE create_key='l3:job:W1'`))[0].j);
    const key1 = `biz:invite:firsttask:9800090`;
    const ftN1 = await DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: jobW1 }, tx);
    const rowsN1 = await ledRowsOf(key1);
    OUT.L3_2_N1 = { outcome: ftN1.outcome, recipients: ftN1.recipientUids, perLeg: ftN1.perLegUsd, total: ftN1.totalUsdFromPlatform, rows: rowsN1 };
    t('L3-2c 首任务腿 N=1', ftN1.outcome === 'posted' && ftN1.totalUsdFromPlatform === '10' && ftN1.recipientUids.length === 1
      && rowsN1.map((r) => `${r.uid}:${r.delta}`).sort().join(',') === '-1:-10,9800090:10',
      '无上级 ⇒ 只发本人：−1 −10 / 本人 9800090 +10（平台不吞）', { outcome: ftN1.outcome, legs: rowsN1.map((r) => `${r.uid}:${r.delta}`).join(',') });

    // ============================================================ L3③  经真实结算路径（settleJob → dispatchJobEvent → 奖励）
    await bind(9800051, 9800052); // W3 ← P3
    const pub = await DatabaseService.jobPostEvent({ op: 'publish', create_key: `cli:${'b1'.repeat(15)}bc`, employer_uid: '970001', cid: '1', reward: '100000', title: 'L3③', description: 'x' }, tx);
    const jobId3 = String(((pub.r as Record<string, unknown>)?.job_id ?? (pub as unknown as Record<string, unknown>).job_id));
    await tx.query(`UPDATE public.job SET worker_uid=$1, status='accepted' WHERE job_id=$2::bigint`, [9800051, jobId3]);
    await tx.query(`UPDATE public.job SET status='submitted' WHERE job_id=$1::bigint`, [jobId3]);
    await tx.query(`INSERT INTO public.job_submission (job_id, worker_uid, deliverable, review_status, create_key) VALUES ($1::bigint, $2, 'deliv', 'pending', $3)`, [jobId3, 9800051, `cli:${'c2'.repeat(15)}ce`]);
    const statusBefore = (await q<{ s: string }>(`SELECT status s FROM public.job WHERE job_id=$1::bigint`, [jobId3]))[0].s;
    const settleRes = await settleJob({ jobIdRaw: jobId3, reviewerUid: 9800053 }, tx);
    const statusAfter = (await q<{ s: string; st: string | null; et: string | null }>(`SELECT status s, settle_txid::text st, escrow_txid::text et FROM public.job WHERE job_id=$1::bigint`, [jobId3]))[0];
    const key3 = `biz:invite:firsttask:9800051`;
    const ftRows3 = await ledRowsOf(key3);
    const settleRows = await q<Record<string, unknown>>(`SELECT uid::text AS uid, kind, delta::text AS delta FROM public.ledger_entry WHERE split_part(idempotency_key,'#',1)=$1 ORDER BY txid`, [`biz:job:settle:${jobId3}`]);
    const sub3 = (await q<Record<string, unknown>>(`SELECT review_status, reviewed_by::text AS rb FROM public.job_submission WHERE job_id=$1::bigint`, [jobId3]))[0];
    OUT.L3_3_settle = { job_id: jobId3, ok: settleRes.ok, replay: settleRes.replay, status_before: statusBefore, status_after: statusAfter.s, settle_txid: statusAfter.st, escrow_txid: statusAfter.et, submission: sub3, reward_rows: ftRows3, settle_event_rows: settleRows.map((r) => `${r.uid}:${r.delta}:${r.kind}`) };
    t('L3-3 经结算路径 → 首任务奖励', settleRes.ok === true && statusBefore === 'submitted' && statusAfter.s === 'settled'
      && ftRows3.map((r) => `${r.uid}:${r.delta}`).sort().join(',') === '-1:-20,9800051:10,9800052:10'
      && String(sub3?.review_status) === 'approved',
      'settleJob(submitted→settled) ⇒ 下游 best-effort 发 invite_first_task_reward：−1 −20 / 本人 +10 / 上级 +10；结论位 approved',
      { ok: settleRes.ok, status: `${statusBefore}→${statusAfter.s}`, reward: ftRows3.map((r) => `${r.uid}:${r.delta}`).join(','), sub: sub3?.review_status });

    // ============================================================ L3④  6 层距离加权 + 层内均分 + Σ==pool（经 DB 图真跑）
    // 上行 U3→U2→U1→W6；下行 W6→D1→D2→D3（外加 D1b ⇒ D1 层 2 人）
    await bind(9800032, 9800031); // U2 ← U3
    await bind(9800033, 9800032); // U1 ← U2
    await bind(9800034, 9800033); // W6 ← U1
    await bind(9800035, 9800034); // D1 ← W6
    await bind(9800036, 9800035); // D2 ← D1
    await bind(9800037, 9800036); // D3 ← D2
    await bind(9800038, 9800034); // D1b ← W6（D1 层第二人）
    const plan = await planJobSettlement({ jobId: '9890001', employerUid: 970001, workerUid: 9800034, cid: 1, gross: 100000, ex: tx });
    const labels = plan.layers.map((l) => (l.direction === 'up' ? `U${l.distance}` : `D${l.distance}`));
    const distinctLabels = Array.from(new Map(plan.layers.map((l) => [l.level, l.direction === 'up' ? `U${l.distance}` : `D${l.distance}`])).entries()).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    const layerShares = Array.from(new Set(plan.layers.map((l) => l.level))).map((L) => ({ L, share: plan.layers.filter((x) => x.level === L).reduce((a, x) => a + BigInt(x.x), 0n).toString(), n: plan.layers.filter((x) => x.level === L).length }));
    const sumEntries = plan.layers.reduce((a, l) => a + BigInt(l.x), 0n);
    const entryList = plan.layers.map((l) => ({ uid: l.beneficiary_uid, layer: l.level, dir: l.direction, dist: l.distance, x: l.x }));
    OUT.L3_4 = { M: plan.M, N: plan.N, fee: plan.fee, W: plan.W, weights_bp: plan.weights_bp, labels, layer_shares: layerShares, sum_entries: sumEntries.toString(), fee_credit_uid: plan.fee_credit_uid, entries: entryList };
    t('L3-4a 6 层序位与权重', plan.M === 6 && JSON.stringify(distinctLabels) === JSON.stringify(['U1', 'U2', 'U3', 'D1', 'D2', 'D3']) && JSON.stringify(plan.weights_bp.map(Number)) === JSON.stringify(W6),
      'M=6 · 去重层序 [U1,U2,U3,D1,D2,D3] · 权重 [2600,1700,700,2600,1700,700]', { M: plan.M, distinctLabels, W: plan.weights_bp });
    t('L3-4b Σ x == pool 构造性', sumEntries === BigInt(plan.fee) && plan.fee === '10000' && plan.fee_credit_uid === '-2',
      'Σ entries 逐分 == fee(池) == 10000 · fee_credit_uid=-2（有合格受益人）', { sum: sumEntries.toString(), fee: plan.fee, credit: plan.fee_credit_uid });
    const sh = Object.fromEntries(layerShares.map((x) => [x.L, x.share]));
    t('L3-4c 距离加权 + 层内均分', BigInt(sh['1']) > BigInt(sh['2']) && BigInt(sh['2']) > BigInt(sh['3']) && BigInt(sh['4']) > BigInt(sh['5']) && BigInt(sh['5']) > BigInt(sh['6'])
      && sh['1'] === '2600' && sh['2'] === '1700' && sh['3'] === '700' && sh['4'] === '2600'
      && plan.layers.filter((l) => l.level === 4).map((l) => l.x).sort().join(',') === '1300,1300',
      '越近越高（U1>U2>U3 · D1>D2>D3）· 层额=权重 · D1 层均分 2600→1300/1300', layerShares);
    // 层内 tie-break（纯函数 · uid ASC 拿余数）
    const tie = splitPoolTwoLevel(100, [{ layer: 1, direction: 'up', distance: 1, weight_bp: 100, beneficiaries: [{ uid: '300' }, { uid: '100' }, { uid: '200' }] }]);
    const tieEntries = tie.entries.map((e) => `${e.uid}:${e.x}`).join(',');
    const sumTie = tie.entries.reduce((a, e) => a + BigInt(e.x), 0n).toString();
    // 层间最大余数法（构造性，含余数）
    const sw = splitPoolByWeights(100, [1, 1, 1]);
    OUT.L3_4_tie = { tieEntries, sumTie, sw_x: sw.x, sw_sum: sw.sum_x, sw_plus: sw.plus_one_levels };
    t('L3-4d 层内 tie-break (r DESC, uid ASC) + 余数守恒', tieEntries === '100:34,200:33,300:33' && sumTie === '100',
      '+1 落 uid ASC 最小者（100→34 / 200→33 / 300→33）· Σ==100', { tieEntries, sumTie });
    t('L3-4e 层间最大余数法 Σ==pool（含 D>0）', JSON.stringify(sw.x) === JSON.stringify(['33', '33', '34']) && sw.sum_x === '100' && JSON.stringify(sw.plus_one_levels) === JSON.stringify([3]),
      'splitPoolByWeights(100,[1,1,1]) ⇒ q=33/33/33·D=1 ⇒ +1 落 L3（r 等 ⇒ L DESC）⇒ [33,33,34]·Σ=100', { x: sw.x, sum: sw.sum_x, plus: sw.plus_one_levels });

    // ============================================================ L3⑤  Worker 结构性剔除 ⇒ 500（口径 = 权威 spec R-9-56）
    const upPure = mkUp(['9800033', '9800032', '9800031']);
    const downWithWorker = mkDown([{ uid: WORKER, level: 1 }, { uid: '9800035', level: 1 }]);
    const rosterSelf = buildCommissionRoster(WORKER, upPure as never, downWithWorker as never, { levels: 6, weights_bp: W6 });
    const inRoster = rosterSelf.uids.includes(WORKER) || rosterSelf.layers.some((l) => l.beneficiaries.some((b) => b.uid === WORKER));
    const negOut = (() => { try { assertReferralChainInvariants(upPure as never, { worker_uid: WORKER, roster_uids: [WORKER, '9800035'], down_chain: downWithWorker as never }); return null; } catch (e) { const err = e as { code?: string; details?: { reason?: string; failed_assertions?: string }; httpStatus?: number }; return { code: err.code, reason: err.details?.reason, failed: err.details?.failed_assertions, httpStatus: err.httpStatus }; } })();
    OUT.L3_5 = { worker_in_roster: inRoster, roster_uids: rosterSelf.uids, rejection: negOut };
    t('L3-5 Worker 结构性剔除 + 防御断言硬拒(500)', inRoster === false && negOut !== null && negOut.code === 'LEDGER_RECONCILE_MISMATCH' && negOut.reason === COMMISSION_REASON.CHAIN_ASSERTION_VIOLATED && String(negOut.httpStatus) === '500' && String(negOut.failed).includes('worker_in_roster'),
      '名单不含 Worker（遍历种子剔除）；若含 ⇒ 500 LEDGER_RECONCILE_MISMATCH / COMMISSION_CHAIN_ASSERTION_VIOLATED（spec R-9-56 权威口径）', OUT.L3_5);

    // ============================================================ L3⑥ 上限截断留痕（capLayer 64 / capTotal 384）
    const d70 = mkDown(Array.from({ length: 70 }, (_, i) => ({ uid: `d${String(i + 1).padStart(4, '0')}`, level: 1 })));
    const rCap = buildCommissionRoster(WORKER, upPure as never, d70 as never, { levels: 6, weights_bp: W6 }, { capLayer: 64, capTotal: 384 });
    const d400 = mkDown(Array.from({ length: 400 }, (_, i) => ({ uid: `d${String(i + 1).padStart(4, '0')}`, level: 1 })));
    const rTot = buildCommissionRoster(WORKER, upPure as never, d400 as never, { levels: 6, weights_bp: W6 }, { capLayer: 3000, capTotal: 384 });
    OUT.L3_6 = { capLayer_dflt: COMMISSION_CAP_LAYER_DEFAULT, capTotal_dflt: COMMISSION_CAP_TOTAL_DEFAULT, layer_trunc: rCap.truncation, d1_kept: rCap.layers.find((l) => l.layer === 4)!.beneficiaries.length, total_trunc: rTot.truncation, uids: rTot.uids.length };
    t('L3-6 上限截断留痕', COMMISSION_CAP_LAYER_DEFAULT === 64 && COMMISSION_CAP_TOTAL_DEFAULT === 384
      && rCap.truncation.truncated === true && rCap.truncation.dropped_by_layer['4'] === 6 && rCap.layers.find((l) => l.layer === 4)!.beneficiaries.length === 64
      && rTot.truncation.truncated === true && rTot.uids.length === 384 && rTot.truncation.dropped_total === 19,
      '默认 capLayer64/capTotal384；层内 70⇒截 64 丢 6 留痕；总 403⇒截 384 丢 19 留痕（truncated=true）', OUT.L3_6);

    // ============================================================ L3⑦ M=0 兜底 ⇒ fee_credit_uid = −1
    const plan0 = await planJobSettlement({ jobId: '9890002', employerUid: 970001, workerUid: 9800090, cid: 1, gross: 100000, ex: tx });
    OUT.L3_7 = { M: plan0.M, no_referrer: plan0.no_referrer, fee_credit_uid: plan0.fee_credit_uid, layers: plan0.layers.length, fee: plan0.fee };
    t('L3-7 M=0 ⇒ fee_credit_uid=-1', plan0.M === 0 && plan0.no_referrer === true && plan0.fee_credit_uid === '-1' && plan0.layers.length === 0,
      '无任何合格受益人（无 invite 关系）⇒ M=0 / no_referrer / fee_credit_uid = "-1"（R-9-52 兜底非抽成）', OUT.L3_7);

    // ============================================================ L3⑧ 白名单外 −1 debit 必红 + 白名单内放行
    const negDb = await sp('l3_neg_db', () => tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint,'job_fee','debit')`).then((r) => r.rows[0]));
    const posDb = await sp('l3_pos_db', () => tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint,'invite_first_task_reward','debit')`).then((r) => r.rows[0]));
    const neg2 = await sp('l3_neg2', () => tx.query(`SELECT ledger_assert_platform_mutation(-2::bigint,'invite_first_task_reward','credit')`).then((r) => r.rows[0]));
    const neg1c = await sp('l3_neg1c', () => tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint,'invite_first_task_reward','credit')`).then((r) => r.rows[0]));
    OUT.L3_8 = { neg_jobfee_debit: negDb, pos_invite_debit: posDb, neg2_invite_credit: neg2, neg1_invite_credit: neg1c };
    t('L3-8 白名单外 −1 debit 必红', negDb.ok === false && negDb.code === 'LD021' && negDb.message === 'LEDGER_RESERVED_UID' && negDb.reason === 'PLATFORM_DEBIT_FORBIDDEN'
      && posDb.ok === true && neg2.ok === false && neg1c.ok === false,
      '−1 debit job_fee ⇒ LD021 / LEDGER_RESERVED_UID / reason=PLATFORM_DEBIT_FORBIDDEN；−1 debit invite_first_task_reward 放行；−2 credit invite / −1 credit invite 皆拒',
      { neg: { ok: negDb.ok, code: negDb.code, reason: negDb.reason }, pos_ok: posDb.ok, neg2_ok: neg2.ok, neg1c_ok: neg1c.ok });

    // ============================================================ 配置覆盖（策略键事务内 INSERT ⇒ 非默认值）
    await tx.query(`INSERT INTO public.app_config (key, value, updated_by) VALUES ('invite_reward_policy','{"signupBatt":7}'::jsonb, 0)`);
    await mkUsers([9800003]);
    const g7 = await DatabaseService.grantSignupInviteBatt(9800003, tx);
    OUT.config_override = { granted: g7.grantedBatt, batt: g7.batt, source: g7.source };
    t('L3-9 策略键可配置（事务内 INSERT · 只读默认时=常量）', g7.grantedBatt === 7 && g7.batt === 7,
      'app_config 无 invite_reward_policy 行 ⇒ 常量默认 30；事务内 INSERT {signupBatt:7} ⇒ +7（策略面真读库）', OUT.config_override);

    throw new Error(SENT);
  }).catch((e) => { if (String((e as Error)?.message) !== SENT) throw e; });

  const after = await counts();
  OUT.residual_after = after;
  const residualOk = TABLES.every((tb) => before[tb] === after[tb]);
  OUT.residual_diff = Object.fromEntries(TABLES.map((tb) => [tb, `${before[tb]}→${after[tb]}`]));
  t('L3-10 ROLLBACK 后表级零残渣', residualOk,
    'currency/ledger_entry/batt_account/batt_entry/account（+users/job/job_submission/referral）before == after',
    OUT.residual_diff);

  const failed = checks.filter((c) => !c.pass);
  OUT.summary = { total: checks.length, passed: checks.length - failed.length, failed: failed.length };
  OUT.checks = checks;
  const text = JSON.stringify(OUT, null, 1);
  fs.writeFileSync(path.resolve(__dirname, 'l3-probe.out'), text + '\n', 'utf8');
  console.log(text);
  console.log(`L3_SUMMARY total=${OUT.summary.total} passed=${OUT.summary.passed} failed=${OUT.summary.failed}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('L3_FATAL', String((e as Error)?.stack || e).slice(0, 1200));
  await closePools().catch(() => undefined);
  process.exit(2);
});
