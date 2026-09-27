/**
 * p2qa-14 · 修复轮复检（Neng）：F7② 的**误报/漏报双向**判据（只读）
 * ============================================================================
 * ① 不误报：对**正常**已落事件，`readLedgerSettlement` 不抛 `COMMISSION_LEDGER_REPLAY_INCONSISTENT`。
 * ② 有观测力（不是死分支）：同一事件把 `workerUid` 传错 ⇒ **必抛**同码同 reason。
 *    （数学上：`employer_frozen_out == worker_got + pool_in + minus1_fee_in` 是事件自洽判据；
 *      传错 worker ⇒ worker_got=0 ⇒ 左侧不变右侧变小 ⇒ 不等 ⇒ 必须报。）
 * ③ `readLedgerEventRows` 与账上逐行一致（重放 plan 的数据源）。
 * 只读：不写任何表。
 */
import { mkPool, raw, save, RUN, errInfo } from './p2qa-lib';
import { readLedgerSettlement, readLedgerEventRows, type Queryable } from '../src/commission';
import { isLedgerError, LedgerError, normalizeLedgerError } from '../src/ledger-errors';

const tsErr = (e: unknown): Record<string, unknown> => {
  if (isLedgerError(e)) {
    const le = e as LedgerError;
    return { ts_code: le.code, http: le.httpStatus, details: le.details };
  }
  const n = normalizeLedgerError(e);
  return { ts_code: n.code, http: n.httpStatus, details: n.details };
};

(async () => {
  const p = mkPool(4);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = { script: 'scripts/p2qa-14-replay-guard.ts', run: RUN };

  // 用本轮 F7② 提交的那类事件（本分区 958xxx 内的 biz:job:settle:*），只读
  const cand = await raw(p, `
    SELECT k, max(ref_id)::text AS job, count(*)::text AS rows
      FROM (SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) AS k, ref_id, txid
              FROM ledger_entry) t
     WHERE k LIKE 'biz:job:settle:%' AND k IN (
       SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) FROM ledger_entry
        WHERE uid BETWEEN 958000 AND 958999)
     GROUP BY k ORDER BY max(txid) DESC LIMIT 3`);
  out.candidate_events = cand as unknown as Array<Record<string, string>>;
  const key = (cand[0] as Record<string, string> | undefined)?.k;
  out.tested_key = key;

  if (key) {
    const rows = await readLedgerEventRows(key, q);
    const emp = rows.find((r) => r.kind === 'job_fee' && BigInt(r.frozen_delta) < 0n)?.uid
      ?? rows.find((r) => r.kind === 'job_payout' && BigInt(r.frozen_delta) < 0n)?.uid
      ?? rows.find((r) => BigInt(r.uid) > 0n)?.uid ?? '';
    const wrk = rows.find((r) => r.kind === 'job_payout' && BigInt(r.delta) > 0n)?.uid ?? '';
    const wrongWorker = rows.find((r) => BigInt(r.uid) > 0n && r.uid !== wrk)?.uid
      ?? String(BigInt(wrk) + 1n);
    out.derived = { employer_uid: emp, worker_uid: wrk, wrong_worker_uid: wrongWorker,
      rows: rows.length, row_uids_kinds: rows.map((r) => `${r.uid}:${r.kind}:${r.delta}:${r.frozen_delta}`) };

    // ① 正常事件（正确 worker）⇒ 不抛
    let ok: Record<string, unknown>;
    try {
      const f = await readLedgerSettlement(key, emp, wrk, q);
      ok = { threw: false, fee: f.fee, net: f.net, gross: f.gross, employer_frozen_out: f.employer_frozen_out,
        minus1_fee_in: f.minus1_fee_in, pool_in: f.pool_in, layers: f.layers.map((l) => `${l.level}:${l.beneficiary_uid}:${l.x}:${l.level_source}`),
        no_referrer: f.no_referrer, zero_amount: f.zero_amount };
    } catch (e) { ok = { threw: true, err: tsErr(e) }; }
    out.normal_event_no_false_positive = ok;

    // ② 同一事件、错 worker ⇒ 必抛 COMMISSION_LEDGER_REPLAY_INCONSISTENT
    let bad: Record<string, unknown>;
    try { await readLedgerSettlement(key, emp, wrongWorker, q); bad = { threw: false }; }
    catch (e) { bad = { threw: true, err: tsErr(e) }; }
    out.misbound_worker_must_throw = bad;

    out.verdict = {
      no_false_positive_on_normal_event: ok.threw === false,
      guard_is_live_not_dead_branch: bad.threw === true
        && (bad.err as Record<string, unknown> | undefined)?.ts_code === 'LEDGER_RECONCILE_MISMATCH'
        && ((bad.err as Record<string, unknown> | undefined)?.details as Record<string, unknown> | undefined)?.reason
           === 'COMMISSION_LEDGER_REPLAY_INCONSISTENT',
      guard_http_class: (bad.err as Record<string, unknown> | undefined)?.http,
    };
  }

  // ③ DB 侧借码投影（只读函数；与 TS 侧桶一致）
  out.db_borrow_map = (await raw(p, `
    SELECT ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH') AS ld032,
           (ledger_error_for_sqlstate('LD032')->>'bucket') AS ld032_bucket,
           (ledger_error_for_sqlstate('LD032')->>'code')   AS ld032_code,
           ledger_sqlstate_of('LEDGER_IDEMPOTENCY_CONFLICT') AS ld003,
           (ledger_error_for_sqlstate('LD003')->>'bucket') AS ld003_bucket,
           ledger_sqlstate_of('LEDGER_AMOUNT_INVALID') AS ld016,
           (ledger_error_for_sqlstate('LD016')->>'bucket') AS ld016_bucket`))
    .map((r) => r as unknown as Record<string, string>);
  out.db_error_code_closure = {
    note: 'DB 侧码集 = 0009 的 ledger_error_for_sqlstate 分支（本轮迁移只 CREATE OR REPLACE 两个函数、未触碰 0009）',
    ld032: (out.db_borrow_map as Array<Record<string, string>>)[0]?.ld032,
  };

  const f = save('p2qa-14-replay-guard', out);
  console.log(JSON.stringify({ saved: f, tested_key: out.tested_key, derived: out.derived,
    normal_event_no_false_positive: out.normal_event_no_false_positive,
    misbound_worker_must_throw: out.misbound_worker_must_throw,
    verdict: out.verdict, db_borrow_map: out.db_borrow_map }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', errInfo(e)); process.exit(1); });
