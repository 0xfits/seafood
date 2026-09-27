/**
 * 事务层验证脚本（真实读写，全部可重入）
 * 运行：npx ts-node --transpile-only scripts/verify-db-layer.ts
 *
 * 覆盖：
 *   1) withTransaction 回滚语义 —— 回调抛错后目标表行数 / 余额快照**逐项不变**（前后读数对比）
 *   2) withTransaction 提交语义 —— 成功回调必须真的落盘（对照组，防止封装「永远回滚」也能"通过"）
 *   3) §9 R74 / §16 #2 的 DB 守卫假设 —— 三条最小用例：
 *        ① 同事务内「先插分录、后更新 account」必须通过
 *        ② 只更新 account、不插分录必须被拒
 *        ③ 顺序颠倒（先更新 account、后插分录）必须被拒
 *      另附：快照不符 / 开户非 0/0 / account 删除 / ledger_entry UPDATE / DELETE 必须被拒
 *
 * 数据安全：除第 2 项（临时表，用完即 DROP）外，所有写都在事务内 ROLLBACK ——
 *           ledger_entry / account 不会留下任何验证行（脚本结束后会自动核对）
 */
import {
  withTransaction,
  closePools,
  readQuery,
  assertInTransaction,
  DbTxError,
  TxClient,
} from '../src/db';

const TEST_UID = 900001;
const TEST_UID_B = 900002;
const SCRATCH = 'p0_verify_scratch';

const counts = async () => {
  const rows = await readQuery<{ ledger_entry: number; account: number; scratch: number }>(`
    SELECT (SELECT count(*)::int FROM ledger_entry)  AS ledger_entry,
           (SELECT count(*)::int FROM account)       AS account,
           (SELECT count(*)::int FROM pg_class WHERE relname = '${SCRATCH}') AS scratch
  `);
  return rows[0];
};

const snapshot = async (uid: number) => {
  const rows = await readQuery<{ balance: number; frozen: number; version: number }>(
    'SELECT balance, frozen, version FROM account WHERE uid = $1 AND cid = 1',
    [uid],
  );
  return rows[0] ?? null;
};

/** 在同事务内插入一条合法分录并把 account 推进到对应快照（R74 要求的顺序） */
const insertEntryAndSync = async (
  tx: TxClient,
  args: { uid: number; delta: number; frozenDelta: number; balanceAfter: number; frozenAfter: number; key: string; kind: string },
) => {
  await tx.query(
    `INSERT INTO ledger_entry
       (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key, memo)
     VALUES ($1, 1, $2, $3, $4, $5, $6, $7, '')`,
    [args.uid, args.delta, args.frozenDelta, args.balanceAfter, args.frozenAfter, args.kind, args.key],
  );
  await tx.query(
    `UPDATE account SET balance = $2, frozen = $3, version = version + 1, time_updated = now()
      WHERE uid = $1 AND cid = 1`,
    [args.uid, args.balanceAfter, args.frozenAfter],
  );
};

const capture = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { case: label, outcome: 'PASSED (no error)' as const, error: null as string | null };
  } catch (e) {
    const anyE = e as { message?: string; code?: string };
    return {
      case: label,
      outcome: 'REJECTED' as const,
      error: String(anyE?.message ?? e).split('\n')[0].slice(0, 160),
      error_code: anyE?.code ?? null,
    };
  }
};

(async () => {
  await readQuery(`DROP TABLE IF EXISTS ${SCRATCH}`);

  const before = await counts();

  // ---------------------------------------------------------------- 1) 回滚语义
  const rollbackCase = await capture('rollback: insert entry + update account, then throw', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await insertEntryAndSync(tx, {
        uid: TEST_UID, delta: 100, frozenDelta: 0, balanceAfter: 100, frozenAfter: 0,
        key: 'ops:p0-verify-rollback', kind: 'mint',
      });
      const inside = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM ledger_entry');
      if (inside.rows[0].n !== 1) throw new Error('tx 内应可见自己的 1 条分录');
      throw new Error('INTENTIONAL_ROLLBACK'); // ← 人为抛错
    });
  });
  const afterRollbackCounts = await counts();
  const afterRollbackAccount = await snapshot(TEST_UID);
  const rollbackInfo = {
    case: rollbackCase,
    counts_before: before,
    counts_after: afterRollbackCounts,
    account_row_after: afterRollbackAccount,
    counts_unchanged:
      before.ledger_entry === afterRollbackCounts.ledger_entry
      && before.account === afterRollbackCounts.account,
    account_row_absent: afterRollbackAccount === null,
  };

  // ---------------------------------------------------------------- 2) 提交语义（对照组）
  const commitCase = await withTransaction(async (tx) => {
    await tx.query(`CREATE TABLE ${SCRATCH} (id bigint PRIMARY KEY, note text NOT NULL)`);
    await tx.query(`INSERT INTO ${SCRATCH} (id, note) VALUES (1, 'committed')`);
    const inside = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${SCRATCH}`);
    return inside.rows[0].n;
  });
  const committedRows = (await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM ${SCRATCH}`))[0].n;
  const commitInfo = { rows_inside_tx: commitCase, rows_after_commit: committedRows, commits_for_real: committedRows === 1 };
  await readQuery(`DROP TABLE ${SCRATCH}`);

  // ---------------------------------------------------------------- 3) DB 守卫 / 触发器假设
  const guards: Array<Record<string, unknown>> = [];

  guards.push(await capture('guard①: 同事务「先插分录、后更新 account」应通过', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await insertEntryAndSync(tx, {
        uid: TEST_UID, delta: 100, frozenDelta: 0, balanceAfter: 100, frozenAfter: 0,
        key: 'ops:p0-verify-guard1', kind: 'mint',
      });
      throw new Error('INTENTIONAL_ROLLBACK'); // 验证完立刻回滚，避免污染
    });
  }));

  guards.push(await capture('guard②: 只更新 account、不插分录应被拒', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await tx.query('UPDATE account SET balance = 50 WHERE uid = $1 AND cid = 1', [TEST_UID]);
    });
  }));

  guards.push(await capture('guard③: 顺序颠倒（先更新 account、后插分录）应被拒', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await tx.query('UPDATE account SET balance = 100 WHERE uid = $1 AND cid = 1', [TEST_UID]);
      await tx.query(
        `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key)
         VALUES ($1, 1, 100, 0, 100, 0, 'mint', 'ops:p0-verify-guard3')`,
        [TEST_UID],
      );
    });
  }));

  guards.push(await capture('guard④: account 快照与最新分录不符应被拒', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await tx.query(
        `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key)
         VALUES ($1, 1, 120, 0, 120, 0, 'mint', 'ops:p0-verify-guard4')`,
        [TEST_UID],
      );
      await tx.query('UPDATE account SET balance = 100 WHERE uid = $1 AND cid = 1', [TEST_UID]);
    });
  }));

  guards.push(await capture('guard⑤: 开户非 0/0 应被拒', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 5, 0)', [TEST_UID_B]);
    });
  }));

  guards.push(await capture('guard⑥: 删除 account 行应被拒', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await tx.query('DELETE FROM account WHERE uid = $1 AND cid = 1', [TEST_UID]);
    });
  }));

  guards.push(await capture('guard⑦: UPDATE ledger_entry 应被拒（append-only）', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await tx.query(
        `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key)
         VALUES ($1, 1, 100, 0, 100, 0, 'mint', 'ops:p0-verify-guard7')`,
        [TEST_UID],
      );
      await tx.query("UPDATE ledger_entry SET memo = 'tamper' WHERE txid = (SELECT max(txid) FROM ledger_entry)");
    });
  }));

  guards.push(await capture('guard⑧: DELETE ledger_entry 应被拒（append-only）', async () => {
    await withTransaction(async (tx) => {
      await tx.query('INSERT INTO account (uid, cid, balance, frozen) VALUES ($1, 1, 0, 0)', [TEST_UID]);
      await tx.query(
        `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key)
         VALUES ($1, 1, 100, 0, 100, 0, 'mint', 'ops:p0-verify-guard8')`,
        [TEST_UID],
      );
      await tx.query('DELETE FROM ledger_entry WHERE txid = (SELECT max(txid) FROM ledger_entry)');
    });
  }));

  guards.push(await capture('guard⑨: 只插分录、不更新 account（R90 注入路径 A）按设计应被允许', async () => {
    await withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key)
         VALUES ($1, 1, 7, 0, 7, 0, 'mint', 'ops:p0-verify-guard9')`,
        [TEST_UID],
      );
      throw new Error('INTENTIONAL_ROLLBACK');
    });
  }));

  const after = await counts();
  const ledgerUntouched = before.ledger_entry === after.ledger_entry && before.account === after.account;

  // 断言汇总（退出码：0 全绿 / 1 有红）
  const expect = (label: string, ok: boolean) => ({ label, ok });
  // ①/⑨ 验证的是「DB 放行」：两者在操作成功通过后立刻人为抛 INTENTIONAL_ROLLBACK 以免污染数据，
  // 故 outcome 恒为 REJECTED ⇒ 只要 error 是哨兵即视为放行（非哨兵 = 真被守卫拒绝）。
  const guardAllowed = (g: Record<string, unknown>) => (
    g.outcome === 'PASSED (no error)' || g.error === 'INTENTIONAL_ROLLBACK'
  );
  const assertTxGuard = (() => {
    try {
      assertInTransaction({ query: async () => ({ rows: [] }) });
      return false;
    } catch (e) {
      return (e as DbTxError).code === 'LEDGER_TRANSACTION_REQUIRED';
    }
  })();
  const checks = [
    expect('rollback: 计数不变', rollbackInfo.counts_unchanged === true),
    expect('rollback: account 行不存在', rollbackInfo.account_row_absent === true),
    expect('commit: 真的提交', commitInfo.commits_for_real === true),
    expect('guard①: 通过', guardAllowed(guards[0])),
    expect('guard②: 被拒', guards[1].outcome === 'REJECTED'),
    expect('guard③: 被拒', guards[2].outcome === 'REJECTED'),
    expect('guard④: 被拒', guards[3].outcome === 'REJECTED'),
    expect('guard⑤: 被拒', guards[4].outcome === 'REJECTED'),
    expect('guard⑥: 被拒', guards[5].outcome === 'REJECTED'),
    expect('guard⑦: 被拒', guards[6].outcome === 'REJECTED'),
    expect('guard⑧: 被拒', guards[7].outcome === 'REJECTED'),
    expect('guard⑨: 通过（孤儿分录按设计允许）', guardAllowed(guards[8])),
    expect('guard 错误信息命中 account_guard', /ledger_entry|account\(/i.test(String(guards[1].error || ''))),
    expect('guard 错误信息命中 append-only', /append-only/i.test(String(guards[6].error || ''))),
    expect('ledger_entry/account 零残留', ledgerUntouched),
    expect('assertInTransaction 拦住无事务写路径', assertTxGuard),
  ];
  const allGreen = checks.every((c) => c.ok);

  console.log(JSON.stringify({
    before, rollback: rollbackInfo, commit: commitInfo, guards, after,
    ledger_untouched: ledgerUntouched, checks, all_green: allGreen,
  }, null, 2));
  await closePools();
  process.exit(allGreen ? 0 : 1);
})().catch(async (e) => {
  console.error('verify fatal:', String((e as Error)?.message || e).slice(0, 300));
  await closePools().catch(() => undefined);
  process.exit(2);
});
