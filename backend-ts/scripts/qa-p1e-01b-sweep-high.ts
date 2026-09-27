/**
 * QA-P1E-01b · 同一行并发上限「高段」扫描（Neng）
 * ============================================================================
 * 用法：QAE_CID=<cid> QAE_SRC=931001 QAE_DST=931002 \
 *        cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-01b-sweep-high.ts
 *
 * 复用 QA-P1E-01 已建的测试币（不再新建币/账户），把并发档位推到 96 / 128 / 160，
 * 找出「同一行有效并发上限」的真实拐点，与 P1b（旧形态）的「≈2」对照。
 * 纪律：不碰 cid=1；键前缀 ops:qae:*。
 */
import { attempt, judgementRows, median, mkPool, raw, sampleActivity } from './qa-p1e-lib';

const RUN = Date.now().toString(36).slice(-4);
const CID = String(process.env.QAE_CID ?? '');
const SRC = BigInt(process.env.QAE_SRC ?? '931001');
const DST = BigInt(process.env.QAE_DST ?? '931002');

(async () => {
  if (!CID) throw new Error('QAE_CID 必填（复用已建测试币）');
  const out: Record<string, unknown> = { run: RUN, cid: CID, src: String(SRC), dst: String(DST) };
  const admin = mkPool(4);
  const sampler = mkPool(1);
  const acc = async () => (await raw(admin,
    'SELECT balance, frozen, version FROM account WHERE uid = $1 AND cid = $2', [String(SRC), CID]))[0];
  out.src_before = await acc();

  const samples: Array<Record<string, string>> = [];
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      try { const s = await sampleActivity(sampler); if (s.length) samples.push(s[0]); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 100));
    }
  })();

  const sweep: Array<Record<string, unknown>> = [];
  for (const N of [96, 128, 160]) {
    const keys = Array.from({ length: N }, (_, i) => `ops:qae:${RUN}:hi:${N}:${i}`);
    const pool = mkPool(N);
    const t0 = Date.now();
    const reqs = await Promise.all(keys.map(async (key, i) => {
      const s = Date.now();
      const r = await attempt(pool, {
        op: 'transfer', from_uid: String(SRC), to_uid: String(DST), cid: CID, amount_units: '1',
        idempotency_key: key, memo: 'qae high concurrency', ref_type: 'system', ref_id: '1',
      });
      return { i, ms: Date.now() - s, ok: r.ok, replay: r.replay, err: r.error?.code ?? undefined, msg: r.error?.message?.slice(0, 50) };
    }));
    const wall = Date.now() - t0;
    await pool.end().catch(() => undefined);
    const codes: Record<string, number> = {};
    for (const r of reqs) if (!r.ok) codes[`${r.err}|${r.msg}`] = (codes[`${r.err}|${r.msg}`] ?? 0) + 1;
    const fam = await raw(admin, `
      SELECT count(*)::text AS rows_, count(DISTINCT split_part(idempotency_key,'#',1))::text AS events
        FROM ledger_entry WHERE split_part(idempotency_key,'#',1) = ANY($1::text[])`, [keys]);
    const p50 = median(reqs.map((r) => r.ms));
    sweep.push({
      N, wall_ms: wall,
      success: reqs.filter((r) => r.ok).length,
      failure: reqs.filter((r) => !r.ok).length,
      failure_codes: codes,
      latency_ms: { min: Math.min(...reqs.map((r) => r.ms)), p50, max: Math.max(...reqs.map((r) => r.ms)) },
      lock_hold_per_stmt_ms_estimate: Math.round(wall / N),
      ledger_rows_for_run: fam[0].rows_, events: fam[0].events,
    });
  }
  stop = true;
  await loop.catch(() => undefined);

  out.sweep = sweep;
  out.activity = {
    samples: samples.length,
    max_distinct_pids: Math.max(0, ...samples.map((s) => Number(s.distinct_pids))),
    max_active: Math.max(0, ...samples.map((s) => Number(s.active))),
    max_lock_waiters: Math.max(0, ...samples.map((s) => Number(s.lock_waiters))),
  };
  out.src_after = await acc();
  const j = await judgementRows(admin);
  out.section11 = {
    j1_rows: j.j1_drift.length, j8_ref_rows: j.j8_ref.length, j8_key_rows: j.j8_key.length,
    negatives: j.negatives[0].n, supply_over: j.supply_over.length,
  };
  out.cid_net = await raw(admin, `SELECT SUM(delta + frozen_delta)::text AS net FROM ledger_entry WHERE cid = $1`, [CID]);

  console.log(JSON.stringify(out, null, 1));
  await admin.end().catch(() => undefined);
  await sampler.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
