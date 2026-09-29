/*
 * p4z-b3c-02-e2e.ts — P4-B3c 招工资金端到端（面板重启 → /health 200 → 全链 + 逐腿取证）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3c-02-e2e.ts <runDirAbsOrRel>
 * 口径：① 重启只走面板 {sid} 路由（禁 pkill/killall）② 重启后先等 /health 200
 *       ③ 真 token = `.env.local` 的 SECRET_KEY（旧兑底常量已失效，本脚本两候选现取取证）
 *       ④ 上游（apply/accept/submit）走 **本仓 service 代码**；资金写入唯一路径 = `job_post_event`
 *       ⑤ 产物零 token/密钥字节（`eyJ` 计数须为 0）；退出码直接取（不经管道）
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { publishJob, settleJob, refundJob, verifyJobSubmission } from '../src/job-funds-service';
import { applyToJob, acceptApplication, submitWork } from '../src/job-service';
import { ensureUser, fundFromResidual, raw, raw1, mkPool, errInfo } from './p3j-lib';

const REPO = path.resolve(__dirname, '..');
const BASE = 'http://127.0.0.1:5788';
const PANEL = 'http://127.0.0.1:5555';
const SID = 'seafood-api';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });
const RUN = path.basename(outDir);

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const mint = (uid: string, evm: string, key: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const unsigned = `${h}.${p}`;
  return `${unsigned}.${crypto.createHmac('sha256', key).update(unsigned).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + p, {
      method, headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return { status: res.status, json, text_head: text.slice(0, 400) };
  } catch (e) {
    return { status: 'NETERR' as unknown as number, json: null, text_head: String(e).slice(0, 200) };
  }
};

const legs = (pool: any, rootKey: string) => raw<Record<string, unknown>>(pool,
  `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
          frozen_delta::text AS frozen_delta, balance_after::text AS balance_after,
          frozen_after::text AS frozen_after, kind, ref_type, ref_id::text AS ref_id, idempotency_key
     FROM public.ledger_entry WHERE event_root_key = $1::text ORDER BY txid`, [rootKey]);

const legCheck = (rows: Array<Record<string, unknown>>) => {
  const sd = rows.reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  const sf = rows.reduce((a, r) => a + BigInt(String(r.frozen_delta)), 0n);
  const uids = Array.from(new Set(rows.map((r) => String(r.uid))));
  return {
    n: rows.length,
    kinds: rows.map((r) => String(r.kind)),
    uids,
    sum_delta: sd.toString(),
    sum_frozen_delta: sf.toString(),
    sum_delta_plus_frozen: (sd + sf).toString(),
    pure_transfer: sd + sf === 0n,
  };
};

async function main() {
  const pool = mkPool(2);
  const results: Record<string, unknown> = {};
  const pool_sql: any = pool;

  // ---------------------------------------------------------------- 0) 面板重启 + /health
  const preHealth = await call('GET', '/health');
  const restart = await (async () => {
    try {
      const res = await fetch(`${PANEL}/api/restart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid: SID }), signal: AbortSignal.timeout(90000),
      });
      return { status: res.status, body: (await res.text()).slice(0, 200) };
    } catch (e) { return { status: null, body: String(e).slice(0, 200) }; }
  })();
  let healthy = false; const t0 = Date.now();
  for (let i = 0; i < 120; i += 1) {
    const h = await call('GET', '/health');
    if (h.status === 200) { healthy = true; break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  results.restart = { pre_health: preHealth.status, panel: restart, health_200_after: healthy, waited_ms: Date.now() - t0 };
  if (!healthy) throw new Error('service not healthy after restart');

  // ---------------------------------------------------------------- 1) fixtures
  const A = await ensureUser(pool, `0xb3cadmin${RUN}`);
  const E = await ensureUser(pool, `0xb3cemployer${RUN}`);
  const W = await ensureUser(pool, `0xb3cworker${RUN}`);
  await raw(pool, `UPDATE public.users SET is_admin = true WHERE uid = $1::bigint`, [A]);
  const fund = await fundFromResidual(pool, E, 8000n);
  const policy = await raw1<{ fee_rate_bp: number; levels: number }>(pool,
    `SELECT fee_rate_bp, levels FROM public.commission_policy WHERE effective_from <= now() ORDER BY effective_from DESC LIMIT 1`);
  const chainWorker = await raw1<{ uid: string; depth: string }>(pool,
    `SELECT r.child_uid::text AS uid, r.depth::text AS depth FROM public.referral r
      WHERE r.depth >= 1 ORDER BY r.depth DESC, r.child_uid LIMIT 1`);
  results.fixtures = { admin_uid: A, employer_uid: E, worker_noref_uid: W, chain_worker_uid: chainWorker?.uid ?? null, chain_depth: chainWorker?.depth ?? null, fund, policy };

  // ---------------------------------------------------------------- 2) token 现取取证
  const cands: Array<{ name: string; key: string }> = [];
  if (process.env.SECRET_KEY) cands.push({ name: 'env-SECRET_KEY(.env.local)', key: process.env.SECRET_KEY });
  cands.push({ name: 'auth.ts 硬编码兑底', key: 'your-secret-key-here' });
  const keyProbe: any[] = []; let winner: { name: string; key: string } | null = null;
  for (const c of cands) {
    const t = mint(A, `0xb3cadmin${RUN}`, c.key);
    await raw(pool, `UPDATE public.users SET evm = $2::text WHERE uid = $1::bigint`, [A, `0xb3cadmin${RUN}`.replace(/[^0-9a-fx]/gi, '').padEnd(42, '0').slice(0, 42) === '' ? '' : `0x${crypto.createHash('sha256').update(`0xb3cadmin${RUN}`).digest('hex').slice(0, 40)}`]);
    const evm = (await raw1<{ evm: string }>(pool, `SELECT evm FROM public.users WHERE uid = $1::bigint`, [A]))?.evm || '';
    const t2 = mint(A, String(evm), c.key);
    const r = await call('GET', '/api/admin/me', { token: t2 });
    keyProbe.push({ candidate: c.name, key_len: c.key.length, token_fp: fp(t2), status: r.status, reason: r.json?.error?.details?.reason ?? null });
    if (r.status === 200 && !winner) winner = { name: c.name, key: c.key };
  }
  if (!winner) throw new Error('no token candidate gave 200');
  const evmOf = async (uid: string) => (await raw1<{ evm: string }>(pool, `SELECT evm FROM public.users WHERE uid = $1::bigint`, [uid]))?.evm || '';
  const tok = async (uid: string) => mint(uid, String(await evmOf(uid)), winner!.key);
  const tAdmin = await tok(A); const tEmployer = await tok(E); const tWorker = await tok(W);
  results.token = { key_probe: keyProbe, verdict: winner.name, note: '密钥本体不落盘；只记候选名 + token 指纹' };

  const R: any[] = [];
  const rec = (id: string, r: { status: number; json: any; text_head: string }, extra: Record<string, unknown> = {}) => {
    const entry = {
      id, status: r.status, code: r.json?.error?.code ?? null, reason: r.json?.error?.details?.reason ?? null,
      success: r.json?.success ?? null, message: r.json?.message ?? null,
      idempotent_replay: r.json?.idempotent_replay ?? null,
      data_keys: r.json?.data && typeof r.json.data === 'object' ? Object.keys(r.json.data) : null,
      error_details: r.json?.error?.details ?? null, body_head: r.json ? null : r.text_head, ...extra,
    };
    R.push(entry); return entry;
  };
  /** service 结果 → 同一记录口径 */
  const recS = (id: string, res: any, extra: Record<string, unknown> = {}) => {
    const entry = res?.ok
      ? { id, status: 200, ok: true, replay: res.replay === true, view_keys: Object.keys(res.view || {}), ...extra, view: res.view }
      : { id, status: res?.status ?? null, ok: false, code: res?.code ?? null, details: res?.details ?? null, ...extra, message: res?.message ?? null };
    R.push(entry); return entry;
  };
  const S: any[] = [];
  const srec = (id: string, res: any) => { const e = recS(id, res); S.push(e); return e; };

  // ================================================================ 3) J1 托管（service 层，唯一资金路径）
  const kA = `cli:b3c:${RUN}:jobA`;
  const pA1 = await publishJob({ actorUid: Number(E), body: { create_key: kA, cid: '1', reward: '400', title: 'b3c jobA', description: 'settle no-referral' } });
  srec('J1_A_publish', pA1);
  const jobA = Number((pA1 as any).view?.job_id);
  const escrowA = await legs(pool_sql, `biz:job:escrow:${jobA}`);
  const pA2 = await publishJob({ actorUid: Number(E), body: { create_key: kA, cid: '1', reward: '400', title: 'b3c jobA', description: 'settle no-referral' } });
  srec('J1_A_publish_replay', pA2);
  const escrowA2 = await legs(pool_sql, `biz:job:escrow:${jobA}`);
  results.J1_A = { job_id: jobA, escrow_key: `biz:job:escrow:${jobA}`, legs: escrowA, legs_check: legCheck(escrowA), replay_legs_n: escrowA2.length };

  // 负例：缺 create_key / 坏前缀 / 代他人出资 / 余额不足
  srec('J1_neg_no_key', await publishJob({ actorUid: Number(E), body: { cid: '1', reward: '10' } }));
  srec('J1_neg_bad_prefix', await publishJob({ actorUid: Number(E), body: { create_key: 'zzz:1', cid: '1', reward: '10' } }));
  srec('J1_neg_other_employer', await publishJob({ actorUid: Number(W), body: { create_key: `cli:b3c:${RUN}:imp`, cid: '1', reward: '10', employer_uid: E } }));
  srec('J1_neg_insufficient', await publishJob({ actorUid: Number(E), body: { create_key: `cli:b3c:${RUN}:big`, cid: '1', reward: '99999999' } }));
  srec('J1_neg_unknown_cid', await publishJob({ actorUid: Number(E), body: { create_key: `cli:b3c:${RUN}:cidx`, cid: '424242', reward: '10' } }));

  // ================================================================ 4) J5 结算 A（无邀请人 → job_fee 入 -1）
  const appA = await applyToJob({ jobId: jobA, workerUid: Number(W), createKeyRaw: `cli:b3c:${RUN}:appA` });
  const appAId = Number((appA as any).view?.application_id);
  const accA = await acceptApplication({ jobId: jobA, applicationId: appAId, actorUid: Number(E) });
  const subA = await submitWork({ identifier: appAId, workerUid: Number(W), deliverable: `b3c deliverable A ${RUN}`, createKeyRaw: `cli:b3c:${RUN}:subA` });
  results.chain_A_upstream = { apply: (appA as any).ok, application_id: appAId, accept: (accA as any).ok, submit: (subA as any).ok, job_status_after_submit: (await raw1<{ status: string }>(pool, `SELECT status FROM public.job WHERE job_id=$1::bigint`, [jobA]))?.status };

  const vA1 = await call('POST', `/api/tasklist/${appAId}/verify`, { token: tAdmin, body: { approved: true } });
  rec('J5_A_verify_approve', vA1, { jID: appAId, job_id: jobA });
  const settleA = await legs(pool_sql, `biz:job:settle:${jobA}`);
  const jobARow = await raw1<Record<string, unknown>>(pool,
    `SELECT job_id::text AS job_id, status, worker_uid::text AS worker_uid, settle_txid::text AS settle_txid,
            escrow_txid::text AS escrow_txid, ledger_event_keys, reward::text AS reward FROM public.job WHERE job_id=$1::bigint`, [jobA]);
  const subARow = await raw1<Record<string, unknown>>(pool,
    `SELECT submission_id, review_status, reviewed_by::text AS reviewed_by, (reviewed_at IS NOT NULL) AS has_reviewed_at, review_memo
       FROM public.job_submission WHERE job_id=$1::bigint ORDER BY submission_id DESC LIMIT 1`, [jobA]);
  const platA = await raw1<{ d: string; n: number }>(pool,
    `SELECT COALESCE(SUM(delta),0)::text AS d, COUNT(1)::int AS n FROM public.ledger_entry
      WHERE event_root_key=$1::text AND uid=-1`, [`biz:job:settle:${jobA}`]);
  const pool2A = await raw1<{ n: number }>(pool,
    `SELECT COUNT(1)::int AS n FROM public.ledger_entry WHERE event_root_key=$1::text AND uid=-2`, [`biz:job:settle:${jobA}`]);
  results.J5_A = { settle_key: `biz:job:settle:${jobA}`, legs: settleA, legs_check: legCheck(settleA), job_row: jobARow, submission: subARow, platform_minus1: platA, minus2_rows: pool2A?.n };

  // 重投（同键重放）
  const vA2 = await call('POST', `/api/tasklist/${appAId}/verify`, { token: tAdmin, body: { approved: true } });
  rec('J5_A_verify_replay', vA2, { jID: appAId });
  const settleA2 = await legs(pool_sql, `biz:job:settle:${jobA}`);
  results.J5_A_replay = { legs_after_replay: settleA2.length, same_txid_set: JSON.stringify(settleA.map((r) => r.txid)) === JSON.stringify(settleA2.map((r) => r.txid)) };

  // ================================================================ 5) J5 结算 B（有邀请链 → job_fee 入 -2 + commission）
  const kB = `cli:b3c:${RUN}:jobB`;
  const pB1 = await publishJob({ actorUid: Number(E), body: { create_key: kB, cid: '1', reward: '1000', title: 'b3c jobB' } });
  srec('J1_B_publish', pB1);
  const jobB = Number((pB1 as any).view?.job_id);
  const WB = String(chainWorker?.uid ?? W);
  const appB = await applyToJob({ jobId: jobB, workerUid: Number(WB), createKeyRaw: `cli:b3c:${RUN}:appB` });
  const appBId = Number((appB as any).view?.application_id);
  await acceptApplication({ jobId: jobB, applicationId: appBId, actorUid: Number(E) });
  await submitWork({ identifier: appBId, workerUid: Number(WB), deliverable: `b3c deliverable B ${RUN}`, createKeyRaw: `cli:b3c:${RUN}:subB` });
  const vB1 = await call('POST', `/api/tasklist/${appBId}/verify`, { token: tAdmin, body: { approved: true } });
  rec('J5_B_verify_approve', vB1, { jID: appBId, job_id: jobB, worker_uid: WB });
  const settleB = await legs(pool_sql, `biz:job:settle:${jobB}`);
  const bp = BigInt(String(policy?.fee_rate_bp ?? 0));
  results.J5_B = {
    settle_key: `biz:job:settle:${jobB}`, legs: settleB, legs_check: legCheck(settleB),
    expected_fee: ((1000n * bp + 5000n) / 10000n).toString(), fee_rate_bp: String(bp),
    job_row: await raw1<Record<string, unknown>>(pool, `SELECT status, settle_txid::text AS settle_txid FROM public.job WHERE job_id=$1::bigint`, [jobB]),
  };

  // ================================================================ 6) J6 退托管（HTTP approve:false）→ 链 C
  const kC = `cli:b3c:${RUN}:jobC`;
  const pC1 = await publishJob({ actorUid: Number(E), body: { create_key: kC, cid: '1', reward: '300', title: 'b3c jobC' } });
  srec('J1_C_publish', pC1);
  const jobC = Number((pC1 as any).view?.job_id);
  const appC = await applyToJob({ jobId: jobC, workerUid: Number(W), createKeyRaw: `cli:b3c:${RUN}:appC` });
  const appCId = Number((appC as any).view?.application_id);
  await acceptApplication({ jobId: jobC, applicationId: appCId, actorUid: Number(E) });
  await submitWork({ identifier: appCId, workerUid: Number(W), deliverable: `b3c deliverable C ${RUN}`, createKeyRaw: `cli:b3c:${RUN}:subC` });
  const vC1 = await call('POST', `/api/tasklist/${appCId}/verify`, { token: tAdmin, body: { approved: false } });
  rec('J6_C_verify_reject', vC1, { jID: appCId, job_id: jobC });
  const refundC = await legs(pool_sql, `biz:job:refund:${jobC}`);
  results.J6_C = {
    refund_key: `biz:job:refund:${jobC}`, legs: refundC, legs_check: legCheck(refundC),
    job_row: await raw1<Record<string, unknown>>(pool, `SELECT status, escrow_txid::text AS escrow_txid, ledger_event_keys FROM public.job WHERE job_id=$1::bigint`, [jobC]),
    submission: await raw1<Record<string, unknown>>(pool, `SELECT review_status, reviewed_by::text AS reviewed_by FROM public.job_submission WHERE job_id=$1::bigint ORDER BY submission_id DESC LIMIT 1`, [jobC]),
  };

  // ================================================================ 7) J6 cancel 路径（service 层）
  const kD = `cli:b3c:${RUN}:jobD`;
  const pD1 = await publishJob({ actorUid: Number(E), body: { create_key: kD, cid: '1', reward: '200', title: 'b3c jobD' } });
  const jobD = Number((pD1 as any).view?.job_id);
  const rD = await refundJob({ jobIdRaw: String(jobD), toStatusRaw: 'cancelled' });
  srec('J6_D_refund_cancelled', rD);
  const refundD = await legs(pool_sql, `biz:job:refund:${jobD}`);
  results.J6_D = { job_id: jobD, legs: refundD, legs_check: legCheck(refundD), status: (await raw1<{ status: string }>(pool, `SELECT status FROM public.job WHERE job_id=$1::bigint`, [jobD]))?.status };

  // 负例：非法 to_status / 未知 job / 二次退款（终态）
  srec('J6_neg_bad_to_status', await refundJob({ jobIdRaw: String(jobD), toStatusRaw: 'bogus' }));
  srec('J6_neg_unknown_job', await refundJob({ jobIdRaw: '99999999', toStatusRaw: 'cancelled' }));
  srec('J6_neg_already_cancelled', await refundJob({ jobIdRaw: String(jobD), toStatusRaw: 'cancelled' }));
  srec('J5_neg_unknown_job', await settleJob({ jobIdRaw: '99999999' }));

  // ================================================================ 8) HTTP 负例（未知 id / 非 admin）
  rec('HTTP_verify_miss_404', await call('POST', '/api/tasklist/999999999/verify', { token: tAdmin, body: { approved: true } }), {});
  rec('HTTP_verify_non_admin_403', await call('POST', `/api/tasklist/${appAId}/verify`, { token: tEmployer, body: { approved: true } }), {});
  rec('HTTP_verify_no_token_401', await call('POST', `/api/tasklist/${appAId}/verify`, { body: { approved: true } }), {});
  rec('HTTP_verify_nonnumeric_404', await call('POST', '/api/tasklist/abc/verify', { token: tAdmin, body: { approved: true } }), {});

  // 服务层入口（供路由批 4 复用的同一函数）—— 幂等性直证
  srec('SVC_verify_entry_replay_same_call', await verifyJobSubmission({ identifierRaw: String(appAId), approved: true, actorUid: Number(A) }));

  // ---------------------------------------------------------------- 9) 产物
  const out = {
    run: RUN, base: BASE, at: new Date().toISOString(), probe: 'p4z-b3c-02-e2e',
    results, http_records: R, service_records: S,
  };
  const payload = JSON.stringify(out, null, 2);
  const leak = {
    eyJ: (payload.match(/eyJ/g) || []).length,
    secret_occurrences: (payload.match(new RegExp(winner.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
  };
  fs.writeFileSync(path.join(outDir, 'post', 'e2e.json'), JSON.stringify({ ...out, leak_check: leak }, null, 2));
  console.log('WROTE ' + path.resolve(outDir, 'post', 'e2e.json'));
  console.log('leak_check=' + JSON.stringify(leak));
  console.log('restart=' + JSON.stringify(results.restart));
  console.log('token_verdict=' + winner.name);
  console.log('J1_A escrow legs=' + JSON.stringify(results.J1_A.legs_check));
  console.log('J5_A settle legs=' + JSON.stringify((results.J5_A as any).legs_check));
  console.log('J5_B settle legs=' + JSON.stringify((results.J5_B as any).legs_check));
  console.log('J6_C refund legs=' + JSON.stringify((results.J6_C as any).legs_check));
  console.log('J6_D legs=' + JSON.stringify((results.J6_D as any).legs_check));
  console.log('HTTP=' + JSON.stringify(R.map((r) => [r.id, r.status, r.code, r.idempotent_replay])));
  console.log('SVC=' + JSON.stringify(S.map((r) => [r.id, r.status, r.code])));
  await pool.end().catch(() => undefined);
}

main().then(() => process.exit(0)).catch((e) => { console.error('E2E_FAIL ' + String(e && (e as Error).stack || e)); process.exit(1); });
