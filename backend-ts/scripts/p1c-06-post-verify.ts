/**
 * P1c · 清理后复核 + 触发器复原的**判负取证**（不只看 tgenabled，还真去撞一次守卫）
 *   - 判据 1 / 判据 8（v0.2 正式形状）读数
 *   - 保留对象完整性：cid=1 的 `$`、平台账户 0/-1/-2/-3（0/0）、ledger_owner 4 行
 *   - 触发器复原判负：事务内 DELETE account / UPDATE ledger_entry 必须被 P0001 拒绝（回滚，零残留）
 *   - 外键孤儿检查
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1c-06-post-verify.ts
 */
import { readQuery, withTransaction, closePools } from '../src/db';
import { normalizeLedgerError } from '../src/ledger-errors';

const tryExpectReject = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { label, rejected: false, code: null as string | null, message: null as string | null };
  } catch (e) {
    const anyE = e as { code?: unknown; message?: unknown };
    const norm = normalizeLedgerError(e);
    return {
      label,
      rejected: true,
      pg_code: String(anyE?.code ?? '') || null,
      message: String(anyE?.message ?? '').slice(0, 120),
      classified: `${norm.code}/${norm.status}`,
    };
  }
};

(async () => {
  const counts = await readQuery(`
    SELECT 'ledger_entry' t, count(*)::text n FROM ledger_entry
    UNION ALL SELECT 'account', count(*)::text FROM account
    UNION ALL SELECT 'currency', count(*)::text FROM currency
    UNION ALL SELECT 'ledger_owner', count(*)::text FROM ledger_owner
    UNION ALL SELECT 'schema_migration', count(*)::text FROM schema_migration
    UNION ALL SELECT 'user', count(*)::text FROM "user"
  `);
  const triggers = await readQuery(`
    SELECT c.relname, t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE NOT t.tgisinternal AND c.relname IN ('ledger_entry','account') ORDER BY 1,2`);
  const money = await readQuery(`
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account ORDER BY uid, cid`);
  const currency = await readQuery(`SELECT cid::text, symbol, status FROM currency ORDER BY cid`);
  const owners = await readQuery(`SELECT uid::text, owner_type FROM ledger_owner ORDER BY uid`);

  const j1 = await readQuery(`
    SELECT a.uid, a.cid FROM account a LEFT JOIN
      (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM ledger_entry GROUP BY uid, cid) s
      ON s.uid=a.uid AND s.cid=a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`);
  const j8 = await readQuery(`
    SELECT ref_type, ref_id, SUM(delta+frozen_delta)::text net FROM ledger_entry
     WHERE ref_type IS NOT NULL GROUP BY 1,2 HAVING SUM(delta+frozen_delta) <> 0`);
  const j3 = await readQuery(`
    SELECT a.cid::text, COALESCE(SUM(a.balance),0)::text acc_sum
      FROM account a GROUP BY a.cid ORDER BY a.cid`);

  const orphans = await readQuery(`
    SELECT 'account->currency' k, count(*)::text n FROM account a LEFT JOIN currency c ON c.cid=a.cid WHERE c.cid IS NULL
    UNION ALL SELECT 'ledger_entry->currency', count(*)::text FROM ledger_entry e LEFT JOIN currency c ON c.cid=e.cid WHERE c.cid IS NULL
    UNION ALL SELECT 'ledger_entry->account', count(*)::text FROM ledger_entry e
       LEFT JOIN account a ON a.uid=e.uid AND a.cid=e.cid WHERE a.uid IS NULL
  `);

  // ---- 触发器复原判负：真去撞一次（都在事务内，必回滚）
  const guardProbes = [
    await tryExpectReject('DELETE account uid=0（account 守卫应拒）', () =>
      withTransaction(async (tx) => {
        await tx.query('DELETE FROM account WHERE uid = 0 AND cid = 1');
      })),
    await tryExpectReject('UPDATE ledger_entry（append-only 应拒）', () =>
      withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key, memo)
           VALUES (0, 1, 1, 0, 1, 0, 'mint', 'ops:p1c:guardprobe:1', 'p1c guard probe')`,
        );
        await tx.query(`UPDATE ledger_entry SET memo = 'tampered' WHERE idempotency_key = 'ops:p1c:guardprobe:1'`);
      })),
    await tryExpectReject('UPDATE account（account 守卫应拒：与最新分录不符）', () =>
      withTransaction(async (tx) => {
        await tx.query('UPDATE account SET balance = balance + 1 WHERE uid = 0 AND cid = 1');
      })),
  ];

  const countsAfterProbes = await readQuery(`SELECT count(*)::text n FROM ledger_entry`);

  console.log(JSON.stringify({
    case: 'p1c-06-post-verify',
    counts: Object.fromEntries(counts.map((r: any) => [r.t, r.n])),
    trigger_state: triggers,
    triggers_all_enabled: triggers.every((t: any) => t.tgenabled === 'O'),
    retained_accounts: money,
    retained_currency: currency,
    retained_ledger_owner: owners,
    judgement_1_rows: j1.length,
    judgement_8_rows: j8.length,
    judgement_3_by_cid: j3,
    fk_orphans: Object.fromEntries(orphans.map((r: any) => [r.k, r.n])),
    guard_probes: guardProbes,
    all_guards_still_reject: guardProbes.every((g: any) => g.rejected),
    ledger_entry_rows_after_guard_probes: countsAfterProbes[0]?.n,
  }, null, 2));
})()
  .catch((e) => {
    console.error('verify fatal:', String((e as Error)?.message || e).slice(0, 500));
    process.exitCode = 2;
  })
  .finally(async () => {
    await closePools();
  });
