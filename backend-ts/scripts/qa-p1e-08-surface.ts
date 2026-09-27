/**
 * QA-P1E-08 · 实现方**声称已通过**但派单未点名的面 + 终态基座复核（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-08-surface.ts
 *
 * 覆盖：
 *   A 六个 op 各真跑一次（mint / transfer / hold / hold_release / settle / entries）
 *   B **真实业务形状**的 op=entries（跨两个币种 + ref_type='job' + 两条分录），
 *     补实现方自报的未验证面 ⑤（「op=entries 只跑了合成形状」）
 *   C R79 加锁全序取证（meta.lock_trace 原始读数：mint 先 currency、account 按 uid 升序）
 *   D 同键不同指纹 ⇒ LD003；同键无指纹 ⇒ 按重放（§19.6）
 *   E 终态基座复核：migrations 0001..0004 sha256、平台账户、§11 判据
 * 纪律：uid 937xxx；symbol 前缀 qae；键前缀 ops:qae:*。
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { attempt, ensureCurrency, judgementRows, mkPool, raw, entryCount, deadlocks } from './qa-p1e-lib';

const ROOT = path.resolve(__dirname, '..');
const sha = (rel: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

const RUN = Date.now().toString(36).slice(-5);
const O = 937001n;      // qaeOO 币 owner，主账户
const P = 937002n;      // qaePP 币 owner / 对手方
const SYMO = `qaeOO${RUN}`;
const SYMP = `qaePP${RUN}`;

const brief = (r: Awaited<ReturnType<typeof attempt>>) => ({
  ok: r.ok, replay: r.replay, txid: r.txid,
  entries: r.entries?.map((e) => ({ uid: e.uid, cid: e.cid, delta: e.delta, frozen_delta: e.frozen_delta, kind: e.kind, key: e.idempotency_key })),
  accounts: r.accounts, extra: r.extra, lock_trace: r.lock_trace,
  error: r.error ? { code: r.error.code, message: r.error.message, detail: r.error.detail } : undefined,
});

(async () => {
  const out: Record<string, unknown> = { run: RUN, symbols: { O: SYMO, P: SYMP } };
  const p = mkPool(3);
  const cidO = await ensureCurrency(p, SYMO, O, 2, 'listed', '1000');
  const cidP = await ensureCurrency(p, SYMP, P, 0, 'listed', null);
  out.cids = { O: cidO, P: cidP };
  const k = (s: string) => `ops:qae:${RUN}:sf:${s}`;

  // ---------------------------------------------------------------- A1 mint（amount 字符串走 decimals 换算）
  const a1 = await attempt(p, { op: 'mint', uid: String(O), cid: cidO, amount: '5.00', idempotency_key: k('mint'), memo: 'qae surface mint' });
  out.A1_mint = brief(a1);

  // ---------------------------------------------------------------- A2 transfer
  const a2 = await attempt(p, { op: 'transfer', from_uid: String(O), to_uid: String(P), cid: cidO, amount: '0.10', idempotency_key: k('xfer'), memo: 'qae surface transfer' });
  out.A2_transfer = brief(a2);

  // ---------------------------------------------------------------- A3 hold（需业务单）
  const a3 = await attempt(p, { op: 'hold', uid: String(O), cid: cidO, amount: '0.05', ref_type: 'job', ref_id: '1', idempotency_key: k('hold'), memo: 'qae surface hold' });
  out.A3_hold = brief(a3);

  // ---------------------------------------------------------------- A4 hold_release
  const a4 = await attempt(p, { op: 'hold_release', uid: String(O), cid: cidO, amount: '0.05', ref_type: 'job', ref_id: '1', idempotency_key: k('holdrel'), memo: 'qae surface hold_release' });
  out.A4_hold_release = brief(a4);

  // ---------------------------------------------------------------- A5 settle（purchase：冻结→收款方）
  await attempt(p, { op: 'hold', uid: String(O), cid: cidO, amount: '0.03', ref_type: 'job', ref_id: '2', idempotency_key: k('hold2'), memo: 'qae settle prep' });
  const a5 = await attempt(p, { op: 'settle', kind: 'purchase', from_uid: String(O), to_uid: String(P), cid: cidO, amount: '0.03', ref_type: 'job', ref_id: '2', idempotency_key: k('settle'), memo: 'qae surface settle' });
  out.A5_settle = brief(a5);

  // ---------------------------------------------------------------- A6/B entries（真实业务形状：跨币种 + ref 对，两条分录）
  const a6 = await attempt(p, {
    op: 'entries', idempotency_key: k('entries'), memo: 'qae 真实业务形状：跨币种 job 结算',
    ref_type: 'job', ref_id: '9001',
    entries: [
      { uid: String(O), cid: cidO, delta: '-25', frozen_delta: '0', kind: 'purchase', ref_type: 'job', ref_id: '9001', memo: 'qae buyer' },
      { uid: String(P), cid: cidP, delta: '25', frozen_delta: '0', kind: 'sale', ref_type: 'job', ref_id: '9001', memo: 'qae seller' },
    ],
  });
  out.A6_entries_real_shape = brief(a6);

  // ---------------------------------------------------------------- D 指纹策略
  const f1 = await attempt(p, { op: 'transfer', from_uid: String(O), to_uid: String(P), cid: cidO, amount: '0.20', idempotency_key: k('fp'), request_fingerprint: 'fp-alpha', memo: 'qae fp' });
  const f2 = await attempt(p, { op: 'transfer', from_uid: String(O), to_uid: String(P), cid: cidO, amount: '0.30', idempotency_key: k('fp'), request_fingerprint: 'fp-beta', memo: 'qae fp' });
  const f3 = await attempt(p, { op: 'transfer', from_uid: String(O), to_uid: String(P), cid: cidO, amount: '0.10', idempotency_key: k('fp'), memo: 'qae fp 无指纹' });
  out.D_fingerprint = { first: brief(f1), same_key_diff_fp: brief(f2), same_key_no_fp: brief(f3) };

  // ---------------------------------------------------------------- 读落账结果
  out.accounts = await raw(p, `
    SELECT uid, cid, balance, frozen, version FROM account
     WHERE (uid = $1 AND cid IN ($2,$3)) OR (uid = $4 AND cid IN ($2,$3)) ORDER BY uid, cid`,
  [String(O), cidO, cidP, String(P)]);
  out.entries_for_run = await raw(p, `
    SELECT txid, uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, ref_type, ref_id, idempotency_key
      FROM ledger_entry WHERE split_part(idempotency_key,'#',1) = ANY($1::text[]) ORDER BY txid`,
  [['mint', 'xfer', 'hold', 'holdrel', 'hold2', 'settle', 'entries', 'fp'].map((s) => k(s))]);
  out.my_currencies = await raw(p, `SELECT cid, symbol, total_supply, supply_cap FROM currency WHERE cid IN ($1,$2)`, [cidO, cidP]);

  // ---------------------------------------------------------------- E 终态基座复核
  out.E_baseline = {
    'migrations/0001_ledger_core.sql': sha('migrations/0001_ledger_core.sql'),
    'migrations/0002_user_identity.sql': sha('migrations/0002_user_identity.sql'),
    'migrations/0003_kind_close_set_20.sql': sha('migrations/0003_kind_close_set_20.sql'),
    'migrations/0004_ledger_post_event.sql': sha('migrations/0004_ledger_post_event.sql'),
    expected: {
      '0001': '4f902d3c47508d91826925a46765ad728b1a5a9c2773d0fc1c0f2c1e8e2451a4',
      '0002': '688b1935f6bc3006b545ca158ca97324256a117e4f86e69c09bda8bbb01c5990',
      '0003': 'f268e03075eb4bf46d58766412fc5b53d8f8841d4cac175a3f96c440e8730a23',
    },
  };
  const j = await judgementRows(p);
  out.E_section11 = {
    j1_drift_rows: j.j1_drift.length, j8_ref_rows: j.j8_ref.length, j8_key_rows: j.j8_key.length,
    negative_balances: j.negatives[0].n, supply_over_cap: j.supply_over.length,
    supply_mismatch: j.supply_mismatch,
  };
  out.E_platform_cid1 = j.platform;
  out.entry_count = await entryCount(p);
  out.deadlocks = await deadlocks(p);

  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
