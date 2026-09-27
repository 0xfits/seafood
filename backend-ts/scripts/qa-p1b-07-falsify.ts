/**
 * P1a 并发质检 · 用例⑥ 判负能力（对抗实验）——证明质检探针**能发现错**
 * ---------------------------------------------------------------------------
 * 每个注入用例的取证结构（R89 口径）：
 *   注入前读数（必须绿 → 判据返回空） → 注入 → **同一事务内**读数（必须红 → 判据返回非空）
 *   → 强制 ROLLBACK（抛哨兵）→ 注入后读数（必须回绿）
 * 说明：ledger_entry 是 append-only（`trg_ledger_entry_append_only` 拦 UPDATE/DELETE），
 *       直接 INSERT 的注入行**删不掉**，因此全部注入都在事务内完成并强制回滚，保证不留痕。
 *       `UPDATE account` 注入受 `trg_account_guard` 拦截（见 INJ-2 的真实报错），故采用 R90 首选
 *       的「插孤儿分录」路线（INJ-1/INJ-3）。
 * 运行：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1b-07-falsify.ts
 */
import { withTransaction, txQuery, TxClient, readQuery } from '../src/db';
import { findAccountDrift, sumAccountTotals } from '../src/ledger';
import { j, qaDrift, tally } from './qa-p1b-lib';

const CID = '4';
const UID_A = '910001';
const UID_B = '910003';

// ---------------------------------------------------------------- 质检方自写判据（入参 tx 可事务内复用）
const jDrift = async (tx?: TxClient) => {
  const sql = `SELECT * FROM (
      SELECT a.uid, a.cid, a.balance, a.frozen,
             COALESCE(s.d,0) AS sum_delta, COALESCE(s.f,0) AS sum_frozen_delta
        FROM account a
        LEFT JOIN (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM ledger_entry GROUP BY uid, cid) s
               ON s.uid = a.uid AND s.cid = a.cid
     ) t WHERE t.balance <> t.sum_delta OR t.frozen <> t.sum_frozen_delta`;
  return tx ? txQuery<Record<string, string>>(tx, sql) : readQuery<Record<string, string>>(sql);
};

/** 判据 8（事件配对）：同一 (ref_type, ref_id) 事件 Σ(delta+frozen_delta) 必须为 0，除非含 mint/burn */
const jPairing = async (tx?: TxClient) => {
  const sql = `SELECT ref_type, ref_id, SUM(delta) AS sum_delta, SUM(frozen_delta) AS sum_frozen,
                      SUM(delta + frozen_delta) AS net, count(*) AS n,
                      bool_or(kind IN ('mint','burn')) AS has_mint_burn
                 FROM ledger_entry WHERE ref_type IS NOT NULL
                GROUP BY ref_type, ref_id
               HAVING SUM(delta + frozen_delta) <> 0 AND NOT bool_or(kind IN ('mint','burn'))`;
  return tx ? txQuery<Record<string, string>>(tx, sql) : readQuery<Record<string, string>>(sql);
};

/** 判据 4（发行量）：currency.total_supply 必须 == Σ(mint delta) − Σ(burn 绝对额) */
const jSupply = async (tx?: TxClient) => {
  const sql = `SELECT c.cid, c.symbol, c.total_supply, COALESCE(m.s, 0) AS mint_sum
                 FROM currency c
                 LEFT JOIN (SELECT cid, SUM(delta) - COALESCE(SUM(delta) FILTER (WHERE kind='burn'), 0) AS s
                              FROM ledger_entry WHERE kind IN ('mint','burn') GROUP BY cid) m ON m.cid = c.cid
                WHERE c.total_supply <> COALESCE(m.s, 0)`;
  return tx ? txQuery<Record<string, string>>(tx, sql) : readQuery<Record<string, string>>(sql);
};

const snapshot = async () => ({
  accounts: await readQuery<Record<string, string>>(
    'SELECT uid, cid, balance, frozen, version FROM account WHERE cid = $1 ORDER BY uid', [CID]),
  supply: await readQuery<Record<string, string>>(
    'SELECT cid, symbol, total_supply, supply_cap FROM currency ORDER BY cid'),
  entry_count: (await readQuery<{ n: string }>('SELECT count(*) AS n FROM ledger_entry'))[0].n,
  entry_max_txid: (await readQuery<{ t: string }>('SELECT COALESCE(max(txid),0) AS t FROM ledger_entry'))[0].t,
  drift_impl: (await findAccountDrift()).length,
  drift_qa: (await qaDrift()).length,
  pairing: (await jPairing()).length,
  supply_mismatch: (await jSupply()).length,
  sum_totals: await sumAccountTotals(),
});

const CASES: Array<{ id: string; what: string; inject: (tx: TxClient) => Promise<void> }> = [
  {
    id: 'INJ-1',
    what: '插孤儿分录（delta=+1，不更新 account）⇒ 判据 1 账户级守恒必须报出',
    inject: async (tx) => {
      await txQuery(tx, `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after,
              kind, idempotency_key, memo)
        VALUES ($1,$2,1,0,(SELECT balance + 1 FROM account WHERE uid=$1 AND cid=$2),0,'transfer','ops:qa1b:inj1','QA 注入：孤儿分录')`,
      [UID_A, CID]);
    },
  },
  {
    id: 'INJ-2',
    what: '直接 UPDATE account.balance（派单建议路线）⇒ 取证 trg_account_guard 是否拦下',
    inject: async (tx) => {
      await txQuery(tx, 'UPDATE account SET balance = balance + 1 WHERE uid = $1 AND cid = $2', [UID_A, CID]);
    },
  },
  {
    id: 'INJ-2b',
    what: '对「无任何流水」的新账户 UPDATE account ⇒ 取证 guard 的另一分支',
    inject: async (tx) => {
      await txQuery(tx, 'INSERT INTO account (uid, cid, balance, frozen) VALUES (910009,$1,0,0) ON CONFLICT DO NOTHING', [CID]);
      await txQuery(tx, 'UPDATE account SET balance = 5 WHERE uid = 910009 AND cid = $1', [CID]);
    },
  },
  {
    id: 'INJ-3',
    what: '插单边分录（带 ref_type/ref_id，无对手方）⇒ 判据 8 事件配对必须报出',
    inject: async (tx) => {
      await txQuery(tx, `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after,
              kind, ref_type, ref_id, idempotency_key, memo)
        VALUES ($1,$2,-1,0,(SELECT balance - 1 FROM account WHERE uid=$1 AND cid=$2),0,'transfer','system',991001,
                'ops:qa1b:inj3','QA 注入：单边分录')`, [UID_B, CID]);
    },
  },
  {
    id: 'INJ-4',
    what: 'UPDATE currency.total_supply = total_supply + 1 ⇒ 判据 4 发行量必须报出',
    inject: async (tx) => {
      await txQuery(tx, 'UPDATE currency SET total_supply = total_supply + 1 WHERE cid = $1', [CID]);
    },
  },
  {
    id: 'INJ-5',
    what: '把 account.balance 改成负数 ⇒ 取证 CHECK(account_bal_guard) 兜底是否拒',
    inject: async (tx) => {
      await txQuery(tx, 'UPDATE account SET balance = -1 WHERE uid = $1 AND cid = $2', [UID_A, CID]);
    },
  },
];

(async () => {
  const results: unknown[] = [];
  for (const c of CASES) {
    const before = {
      drift_qa: (await jDrift()).length, pairing: (await jPairing()).length, supply: (await jSupply()).length,
    };
    let injectError: unknown = null;
    let during: Record<string, number> = {};
    let duringRaw: Record<string, unknown> = {};
    try {
      await withTransaction(async (tx) => {
        await txQuery(tx, 'SAVEPOINT inj'); // 注入可能被守卫拒绝；用保存点保证事务不被 abort
        try {
          await c.inject(tx);
        } catch (e) {
          injectError = { name: (e as { name?: string }).name, code: (e as { code?: string }).code,
            hint: String((e as { hint?: string }).hint ?? '').slice(0, 80),
            message: String((e as { message?: string }).message).slice(0, 140) };
          await txQuery(tx, 'ROLLBACK TO SAVEPOINT inj');
        }
        // 同一事务内读数（未提交的注入对只读池不可见，必须在事务内取证）
        during = {
          drift: (await jDrift(tx)).length,
          pairing: (await jPairing(tx)).length,
          supply: (await jSupply(tx)).length,
        };
        duringRaw = {
          drift_rows: (await jDrift(tx)).slice(0, 3),
          pairing_rows: (await jPairing(tx)).slice(0, 3),
          supply_rows: (await jSupply(tx)).slice(0, 3),
        };
        throw new Error('QA_FALSIFY_ROLLBACK');
      });
    } catch (e) {
      if (String((e as Error).message) !== 'QA_FALSIFY_ROLLBACK') {
        injectError = injectError ?? { name: (e as Error).name, message: String((e as Error).message).slice(0, 200) };
      }
    }
    const after = {
      drift_qa: (await jDrift()).length, pairing: (await jPairing()).length, supply: (await jSupply()).length,
    };
    const detected = during.drift > 0 || during.pairing > 0 || during.supply > 0;
    results.push({
      id: c.id, what: c.what,
      before_all_green: before.drift_qa === 0 && before.pairing === 0 && before.supply === 0,
      inject_error: injectError,
      during_tx_counts: during,
      during_tx_rows: duringRaw,
      after_rollback_all_green: after.drift_qa === 0 && after.pairing === 0 && after.supply === 0,
      probe_caught_it: detected,
      after_counts: after,
    });
  }

  const final = await snapshot();
  console.log(j({
    case: '6-falsify',
    note: '每个注入：前绿 → 注入 → 事务内红 → 回滚 → 后绿；全部注入在事务内完成，不留痕',
    results,
    summary: {
      injections: results.length,
      caught: results.filter((r) => (r as { probe_caught_it: boolean }).probe_caught_it).length,
      inject_errors: tally(results.map((r) => String((r as { inject_error: unknown }).inject_error
        ? ((r as { inject_error: { code?: string } }).inject_error?.code ?? 'error') : 'none'))),
    },
    final_state: final,
  }));
  process.exit(0);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
