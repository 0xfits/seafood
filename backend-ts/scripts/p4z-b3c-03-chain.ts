/*
 * p4z-b3c-03-chain.ts — P4-B3c 补测：DL86 的**有邀请人**形态（`job_fee` 入 `-2` + `commission` 逐层分配）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3c-03-chain.ts <runDir>
 * 背景（现取读数）：本库 `public.referral` **现为空** ⇒ 首轮 e2e 的 J5_B 只测到「无邀请人 ⇒ `-1`」形态。
 * 本脚本用**迁移既有函数** `public.referral_bind(child,parent)` 建一条真链（P2 ← P1 ← W2，depth 2），
 * 再走同一条业务链（publish → apply → accept → submit → **HTTP verify**）测 `-2` + `commission`。
 * 口径：不写 kind、不改白名单、不改迁移；上游走本仓 service 代码；资金唯一路径 = `job_post_event`。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { publishJob } from '../src/job-funds-service';
import { applyToJob, acceptApplication, submitWork } from '../src/job-service';
import { ensureUser, fundFromResidual, raw, raw1, mkPool, errInfo } from './p3j-lib';

const BASE = 'http://127.0.0.1:5788';
const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir>');
fs.mkdirSync(path.join(outDir, 'post'), { recursive: true });
const RUN = path.basename(outDir);

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const mint = (uid: string, evm: string, key: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', key).update(u).digest('base64url')}`;
};

async function main() {
  const pool = mkPool(2);
  const out: Record<string, unknown> = { run: RUN, probe: 'p4z-b3c-03-chain', at: new Date().toISOString() };

  // 函数签名现取（不得凭记忆推断入参）
  const sig = await raw1<{ args: string }>(pool,
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='referral_bind'`);
  out.referral_bind_signature = sig?.args ?? null;
  out.referral_rows_before = Number((await raw1<{ n: number }>(pool, `SELECT COUNT(1)::int AS n FROM public.referral`))?.n ?? -1);

  const admin = (await raw1<{ uid: string }>(pool, `SELECT uid::text AS uid FROM public.users WHERE is_admin = true ORDER BY uid LIMIT 1`))?.uid;
  const employer = (await raw1<{ uid: string }>(pool, `SELECT uid::text AS uid FROM public.users WHERE uid = 2`))?.uid;
  const P2 = await ensureUser(pool, `0xb3cchainroot${RUN}`);
  const P1 = await ensureUser(pool, `0xb3cchainmid${RUN}`);
  const W2 = await ensureUser(pool, `0xb3cchainworker${RUN}`);
  await fundFromResidual(pool, employer || '2', 2000n);

  const binds: unknown[] = [];
  const bind = async (child: string, parent: string) => {
    try {
      await raw(pool, `SELECT public.referral_bind($1::bigint, $2::bigint)`, [child, parent]);
      binds.push({ child, parent, ok: true });
    } catch (e) { binds.push({ child, parent, ok: false, err: errInfo(e) }); }
  };
  await bind(P1, P2);   // P1 的邀请人 = P2（level 1）
  await bind(W2, P1);   // W2 的邀请人 = P1（level 1；P2 = level 2）
  const chain = await raw<Record<string, unknown>>(pool,
    `SELECT child_uid::text AS child_uid, parent_uid::text AS parent_uid, depth::text AS depth
       FROM public.referral WHERE child_uid IN ($1::bigint, $2::bigint) ORDER BY depth`, [W2, P1]);
  out.chain = { binds, rows: chain };

  // 业务链：publish(reward 1000) → apply → accept → submit
  const k = `cli:b3c:${RUN}:jobChain`;
  const p = await publishJob({ actorUid: Number(employer || '2'), body: { create_key: k, cid: '1', reward: '1000', title: 'b3c chain job' } });
  out.publish = p.ok ? { ok: true, job_id: (p as any).view.job_id, replay: p.replay } : { ok: false, code: (p as any).code, details: (p as any).details };
  if (!p.ok) { out.aborted = 'publish_failed'; fs.writeFileSync(path.join(outDir, 'post', 'b3c-03-chain.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out)); return; }
  const jobId = Number((p as any).view.job_id);
  const app = await applyToJob({ jobId, workerUid: Number(W2), createKeyRaw: `cli:b3c:${RUN}:appChain` });
  const appId = Number((app as any).view.application_id);
  out.apply = { ok: (app as any).ok, application_id: appId };
  out.accept = { ok: (await acceptApplication({ jobId, applicationId: appId, actorUid: Number(employer || '2') }) as any).ok };
  out.submit = { ok: (await submitWork({ identifier: appId, workerUid: Number(W2), deliverable: `b3c chain deliverable ${RUN}`, createKeyRaw: `cli:b3c:${RUN}:subChain` }) as any).ok };

  const evm = (await raw1<{ evm: string }>(pool, `SELECT evm FROM public.users WHERE uid = $1::bigint`, [admin || '1']))?.evm || '';
  const token = mint(String(admin), String(evm), process.env.SECRET_KEY || '');
  const res = await fetch(`${BASE}/api/tasklist/${appId}/verify`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true }), signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* noop */ }
  out.verify = { status: res.status, idempotent_replay: json?.idempotent_replay ?? null, data_keys: json?.data ? Object.keys(json.data) : null, error: json?.error ?? null, body_head: json ? null : text.slice(0, 200) };

  const key = `biz:job:settle:${jobId}`;
  const legs = await raw<Record<string, unknown>>(pool,
    `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS frozen_delta,
            kind, ref_type, ref_id::text AS ref_id, idempotency_key
       FROM public.ledger_entry WHERE event_root_key = $1::text ORDER BY txid`, [key]);
  const sd = legs.reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  const sf = legs.reduce((a, r) => a + BigInt(String(r.frozen_delta)), 0n);
  const feeIn = legs.filter((r) => r.kind === 'job_fee' && String(r.uid) === '-2').reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  const commOut = legs.filter((r) => r.kind === 'commission' && String(r.uid) === '-2').reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  const commIn = legs.filter((r) => r.kind === 'commission' && String(r.uid) !== '-2').reduce((a, r) => a + BigInt(String(r.delta)), 0n);
  out.settle = {
    key, job_id: jobId, legs, n: legs.length,
    kinds: legs.map((r) => String(r.kind)),
    pure_transfer: sd + sf === 0n, sum_delta: sd.toString(), sum_frozen_delta: sf.toString(),
    minus2_fee_in: feeIn.toString(), minus2_commission_out: commOut.toString(), commission_in_sum: commIn.toString(),
    conservation_minus2: feeIn + commOut === 0n,
    minus1_rows: legs.filter((r) => String(r.uid) === '-1').length,
    job_row: await raw1<Record<string, unknown>>(pool, `SELECT status, settle_txid::text AS settle_txid, ledger_event_keys FROM public.job WHERE job_id=$1::bigint`, [jobId]),
    submission: await raw1<Record<string, unknown>>(pool, `SELECT review_status, reviewed_by::text AS reviewed_by FROM public.job_submission WHERE job_id=$1::bigint ORDER BY submission_id DESC LIMIT 1`, [jobId]),
  };
  out.referral_rows_after = Number((await raw1<{ n: number }>(pool, `SELECT COUNT(1)::int AS n FROM public.referral`))?.n ?? -1);

  const payload = JSON.stringify(out, null, 2);
  const leak = { eyJ: (payload.match(/eyJ/g) || []).length };
  fs.writeFileSync(path.join(outDir, 'post', 'b3c-03-chain.json'), JSON.stringify({ ...out, leak_check: leak }, null, 2));
  console.log('WROTE ' + path.resolve(outDir, 'post', 'b3c-03-chain.json'));
  console.log(JSON.stringify({ sig: out.referral_bind_signature, binds, chain, verify: out.verify, settle: { n: (out.settle as any).n, kinds: (out.settle as any).kinds, pure: (out.settle as any).pure_transfer, minus2_fee_in: (out.settle as any).minus2_fee_in, comm_out: (out.settle as any).minus2_commission_out, comm_in: (out.settle as any).commission_in_sum, cons: (out.settle as any).conservation_minus2, minus1_rows: (out.settle as any).minus1_rows }, leak }, null, 1));
  await pool.end().catch(() => undefined);
}

main().then(() => process.exit(0)).catch((e) => { console.error('CHAIN_FAIL ' + String((e as Error)?.stack || e)); process.exit(1); });
