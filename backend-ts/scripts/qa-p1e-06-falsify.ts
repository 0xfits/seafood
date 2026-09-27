/**
 * QA-P1E-06 · 判负能力（把 §11 判据 1 / 8 弄红再回绿）（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-06-falsify.ts
 *
 * 目的（R89/R93）：不能只报「全绿」；必须证明我的对账探针**在被人为注入偏差时会变红**，
 * 且注入撤销后**立刻回绿、指纹回基线**。
 *
 * 注入纪律：`ledger_entry` 是 append-only（`trg_ledger_entry_append_only` 拦 UPDATE/DELETE），
 * 故全部注入都在**显式事务内**完成并强制 `ROLLBACK` —— 提交即永久留痕，绝不提交。
 * 不使用任何 `ALTER TABLE … DISABLE TRIGGER`。
 * 注入前先**备份**被牵连行的原始值，注入撤销后再逐字比对（等于「备份-恢复」的更强形式：根本没改过）。
 * 纪律：只碰 uid 931001 / cid=49（本单自己造的测试区）；绝不碰 cid=1 与平台账户。
 */
import { judgementRows, mkPool, pgInfo, raw, entryCount } from './qa-p1e-lib';

const UID = 931001n;
const CID = process.env.QAE_CID ?? '49';

const jcount = (j: Awaited<ReturnType<typeof judgementRows>>) => ({
  j1_drift: j.j1_drift.length,
  j8_ref: j.j8_ref.length,
  j8_key: j.j8_key.length,
  negatives: j.negatives[0].n,
  supply_over: j.supply_over.length,
  supply_mismatch: j.supply_mismatch.length,
});

const greens = (c: ReturnType<typeof jcount>) =>
  c.j1_drift === 0 && c.j8_ref === 0 && c.j8_key === 0;

(async () => {
  const out: Record<string, unknown> = { cid: CID, uid: String(UID) };
  const admin = mkPool(3);
  const tx = mkPool(1);
  await tx.query('SELECT 1');

  // ---- 基线
  out.baseline = jcount(await judgementRows(admin));
  out.baseline_entry_count = await entryCount(admin);
  const backup = (await raw(admin,
    'SELECT uid, cid, balance, frozen, version, time_updated FROM account WHERE uid = $1 AND cid = $2',
    [String(UID), CID]))[0];
  out.backup_row = backup;
  const fp = (r: Record<string, string>) => JSON.stringify(r);

  // ---- 注入（事务内）：一条「孤儿分录」——有流水、无账户更新、带 ref 对、净额 != 0
  const refId = String(Date.now()).slice(-9);
  const key = `ops:qae:falsify:${refId}`;
  out.injection = { what: 'INSERT 一条孤儿分录（delta=+1、不更 account、带 ref 对 ⇒ 净额!=0）', key, ref_id: refId };

  await tx.query('BEGIN');
  await tx.query(`
    INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind,
                              ref_type, ref_id, idempotency_key, memo)
    VALUES ($1, $2, 1, 0, 0, 0, 'transfer', 'system', $3, $4, 'qae falsify orphan')`,
  [String(UID), CID, refId, key]);

  const during = await judgementRows(tx);
  out.during_injection = jcount(during);
  out.during_rows = {
    j1: during.j1_drift.slice(0, 3), j8_ref: during.j8_ref.slice(0, 3), j8_key: during.j8_key.slice(0, 3),
  };
  out.caught_j1 = during.j1_drift.length > 0;
  out.caught_j8_ref = during.j8_ref.length > 0;
  out.caught_j8_key = during.j8_key.length > 0;
  out.caught = out.caught_j1 && out.caught_j8_ref && out.caught_j8_key;

  // ---- 附带取证：直接 UPDATE account 的脏数据路线在本库被守卫拦下（P1b 同结论复核）
  let guard: Record<string, unknown> | null = null;
  try {
    await tx.query('UPDATE account SET balance = balance + 1 WHERE uid = $1 AND cid = $2', [String(UID), CID]);
    guard = { blocked: false };
  } catch (e) {
    const i = pgInfo(e);
    guard = { blocked: true, sqlstate: i.code, message: i.message };
  }
  out.account_update_injection = guard;
  await tx.query('ROLLBACK');

  // ---- 回绿核对
  out.after_rollback = jcount(await judgementRows(admin));
  out.after_entry_count = await entryCount(admin);
  const after = (await raw(admin,
    'SELECT uid, cid, balance, frozen, version, time_updated FROM account WHERE uid = $1 AND cid = $2',
    [String(UID), CID]))[0];
  out.after_row = after;
  out.fingerprint_restored = fp(backup) === fp(after);
  out.entry_count_unchanged = out.baseline_entry_count === out.after_entry_count;
  out.green_again = greens(out.after_rollback as ReturnType<typeof jcount>);
  out.orphan_persisted = (await raw(admin, 'SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key = $1', [key]))[0].n;
  out.verdict = {
    probe_can_detect_evil: out.caught === true,
    db_guard_blocks_account_update: (guard as { blocked?: boolean })?.blocked === true,
    back_to_green: out.green_again === true && out.fingerprint_restored === true && out.entry_count_unchanged === true,
  };

  console.log(JSON.stringify(out, null, 1));
  await tx.end().catch(() => undefined);
  await admin.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
