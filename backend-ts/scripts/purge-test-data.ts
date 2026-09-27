/**
 * P1c 第 3 件 · 真库测试数据清理（**默认 dry-run**，真删需显式 `--apply`）
 * ============================================================================
 * P1g 扩展（本单）：
 *   ① 币种前缀集从 `qa1b% / smk%` 扩到 **10 个前缀（大小写不敏感）**：
 *      `qa1b / smk / p1e / p1f / p1g / p1h / p1i / p1j / p1k / qae`
 *      （实测 P1f 的 symbol 是**大写** `P1FMUJ…`，故必须 ILIKE / lower 比较）
 *   ② **恢复 `cid=1` 自洽（Zang 裁定 §5.9）**：删除流水后把每个受影响/残留 cid 的
 *      `currency.total_supply` 重整为与该 cid **残留流水自洽**的值
 *      `total_supply := Σ(delta WHERE kind='mint') − Σ(delta WHERE kind='burn')`
 *      并输出**改前 / 改后逐 cid 读数**。
 *      只改 `total_supply` **这一个字段**（其余列含 `time_updated` 一律不动）——
 *      这是 Zang 对本单「绝不动 cid=1 的币行」的**明示授权例外**。
 *
 * 待清理集合（预测集）：
 *   ① `account.uid >= 900000`
 *   ② `currency` 中 `cid <> 1 AND (symbol ILIKE '<10 前缀>%' 之一)`
 *   ③ `ledger_entry` 中 `uid >= 900000 OR cid IN (②的 cid 集)`
 *   ④ `ledger_owner` 中 `uid >= 900000`
 *
 * 绝对不碰（硬编码拒绝 + 断言）：
 *   - `currency.cid = 1`（`$` 系统币）**行本身**；平台账户 `uid` ∈ {0, -1, -2, -3}（及任何 `uid <= 0`）
 *   - `schema_migration` 表；`users` 表（连 DELETE 语句都不出现）
 *
 * `--apply` 分支纪律（逐字落实派单）：
 *   1) 先 **assert** 待删集合完全落在预测集内 —— 任何超出预测集的待删行 ⇒ **中止、不删、报告**（exit 3）
 *   2) 在**单个事务**里 `ALTER TABLE ... DISABLE TRIGGER USER` → DELETE → 重整 total_supply → `ENABLE TRIGGER USER`
 *   3) 提交前 + 提交后**各取一次触发器状态读数**（要求 `tgenabled = 'O'` 全启用）
 *   4) 覆盖 ledger_entry / account / currency / ledger_owner 四张表
 *   5) 删后复核 spec §11 判据 1 与判据 8（正式形状 `Σ(delta + frozen_delta) = 0`）
 *
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/purge-test-data.ts             # dry-run
 *   cd backend-ts && npx ts-node --transpile-only scripts/purge-test-data.ts --apply     # 真删
 */
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const APPLY = process.argv.includes('--apply');
const FORBIDDEN_UIDS = [0, -1, -2, -3, -4, -99];
/**
 * 预测集下界。默认 900000。
 * `PURGE_FALSIFY_FLOOR=<n>` 仅供**判负演练**（把下界放宽到会命中平台账户，验证断言真的能红）；
 * 与 `--apply` 同时使用会被拒绝（绝不允许在放宽的预测集下真删）。
 */
const FALSIFY_FLOOR = process.env.PURGE_FALSIFY_FLOOR ? Number(process.env.PURGE_FALSIFY_FLOOR) : null;
if (FALSIFY_FLOOR !== null && APPLY) {
  console.error('ABORT: PURGE_FALSIFY_FLOOR 仅允许 dry-run（判负演练），不得与 --apply 同时使用。');
  process.exit(4);
}
const TEST_UID_FLOOR = FALSIFY_FLOOR ?? 900000;

/** P1g：10 个测试 symbol 前缀（**大小写不敏感**） */
const SYMBOL_PREFIXES = ['qa1b', 'smk', 'p1e', 'p1f', 'p1g', 'p1h', 'p1i', 'p1j', 'p1k', 'qae'];
const SYMBOL_PRED = `(${SYMBOL_PREFIXES.map((p) => `symbol ILIKE '${p}%'`).join(' OR ')})`;
/** 与 SYMBOL_PRED 语义等价的 JS 判定（用于断言，两个实现必须同源同义） */
const symbolMatches = (symbol: string): boolean => {
  const s = String(symbol ?? '').toLowerCase();
  return SYMBOL_PREFIXES.some((p) => s.startsWith(p));
};

type Counts = { ledger_entry: number; account: number; currency: number; ledger_owner: number; schema_migration: number; users: number };
type TriggerRow = { relname: string; tgname: string; tgenabled: string };
type Judgement = { judgement_1_hits: Array<Record<string, unknown>>; judgement_8_hits: Array<Record<string, unknown>>; judgement_8_hits_excl_mint_burn: Array<Record<string, unknown>> };
type SupplyRow = { cid: string; symbol: string; total_supply: string; supply_cap: string | null; sum_mint: string; sum_burn: string; residue_count: string; consistent_target: string };

const num = (v: unknown): number => Number(v ?? 0);

const counts = async (): Promise<Counts> => {
  const rows = await readQuery<{ t: string; n: string }>(`
    SELECT 'ledger_entry' t, count(*)::text n FROM ledger_entry
    UNION ALL SELECT 'account', count(*)::text FROM account
    UNION ALL SELECT 'currency', count(*)::text FROM currency
    UNION ALL SELECT 'ledger_owner', count(*)::text FROM ledger_owner
    UNION ALL SELECT 'schema_migration', count(*)::text FROM schema_migration
    UNION ALL SELECT 'users', count(*)::text FROM "users"
  `);
  const m = Object.fromEntries(rows.map((r) => [r.t, num(r.n)]));
  return {
    ledger_entry: m.ledger_entry ?? 0,
    account: m.account ?? 0,
    currency: m.currency ?? 0,
    ledger_owner: m.ledger_owner ?? 0,
    schema_migration: m.schema_migration ?? 0,
    users: m.users ?? 0,
  };
};

const triggerState = async (): Promise<TriggerRow[]> =>
  readQuery<TriggerRow>(`
    SELECT c.relname, t.tgname, t.tgenabled
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal AND c.relname IN ('ledger_entry','account')
     ORDER BY 1,2`);

const judgements = async (): Promise<Judgement> => ({
  judgement_1_hits: await readQuery(`
    SELECT a.uid, a.cid, a.balance::text, a.frozen::text, COALESCE(s.d,0)::text AS sum_delta, COALESCE(s.f,0)::text AS sum_frozen
      FROM account a LEFT JOIN (SELECT uid, cid, SUM(delta) d, SUM(frozen_delta) f FROM ledger_entry GROUP BY uid, cid) s
        ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`),
  judgement_8_hits: await readQuery(`
    SELECT ref_type, ref_id, SUM(delta + frozen_delta)::text AS net
      FROM ledger_entry WHERE ref_type IS NOT NULL GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`),
  judgement_8_hits_excl_mint_burn: await readQuery(`
    SELECT ref_type, ref_id, SUM(delta + frozen_delta)::text AS net
      FROM ledger_entry WHERE ref_type IS NOT NULL
        AND (ref_type, ref_id) NOT IN (
          SELECT ref_type, ref_id FROM ledger_entry WHERE ref_type IS NOT NULL AND kind IN ('mint','burn'))
     GROUP BY 1,2 HAVING SUM(delta + frozen_delta) <> 0`),
});

/** 每个 cid 的 total_supply 与「残留流水自洽值」对照（改前 / 改后通用） */
const supplyAudit = async (client?: TxClient): Promise<SupplyRow[]> => {
  const sql = `
    SELECT c.cid::text AS cid, c.symbol, c.total_supply::text AS total_supply, c.supply_cap::text AS supply_cap,
           COALESCE(SUM(e.delta) FILTER (WHERE e.kind = 'mint'), 0)::text AS sum_mint,
           COALESCE(SUM(e.delta) FILTER (WHERE e.kind = 'burn'), 0)::text AS sum_burn,
           count(e.*)::text AS residue_count,
           (COALESCE(SUM(e.delta) FILTER (WHERE e.kind = 'mint'), 0)
            - COALESCE(SUM(e.delta) FILTER (WHERE e.kind = 'burn'), 0))::text AS consistent_target
      FROM currency c LEFT JOIN ledger_entry e ON e.cid = c.cid
     GROUP BY c.cid, c.symbol, c.total_supply, c.supply_cap
     ORDER BY c.cid::bigint`;
  if (client) {
    const r = await client.query<SupplyRow>(sql);
    return r.rows;
  }
  return readQuery<SupplyRow>(sql);
};

// ---------------------------------------------------------------- 预测集构建
interface Plan {
  uids: string[];
  cids: string[];
  symbols: Record<string, string>;
  txids: string[];
  ownerUids: string[];
  forbidden_hits: string[];
  out_of_predicate: string[];
  test_cid_platform_uid_entries: string[];
}

const buildPlan = async (): Promise<Plan> => {
  const accRows = await readQuery<{ uid: string }>(`SELECT uid::text FROM account WHERE uid >= ${TEST_UID_FLOOR} ORDER BY uid`);
  const curRows = await readQuery<{ cid: string; symbol: string }>(`SELECT cid::text, symbol FROM currency WHERE cid <> 1 AND ${SYMBOL_PRED} ORDER BY cid::bigint`);
  const cids = curRows.map((r) => r.cid);
  const symbols = Object.fromEntries(curRows.map((r) => [r.cid, r.symbol]));
  const cidList = cids.length ? cids.join(',') : '-1';

  const entryRows = await readQuery<{ txid: string; uid: string; cid: string }>(
    `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid FROM ledger_entry
      WHERE uid >= ${TEST_UID_FLOOR} OR cid IN (${cidList}) ORDER BY txid::bigint`,
  );
  const ownerRows = await readQuery<{ uid: string }>(`SELECT uid::text FROM ledger_owner WHERE uid >= ${TEST_UID_FLOOR} ORDER BY uid`);

  // ---- 断言 A：待删集合必须完全落在预测集内 ----
  const out_of_predicate: string[] = [];
  for (const r of entryRows) {
    const inPred = num(r.uid) >= TEST_UID_FLOOR || cids.includes(r.cid);
    if (!inPred) out_of_predicate.push(`ledger_entry txid=${r.txid} uid=${r.uid} cid=${r.cid} ∉ 预测集`);
  }
  for (const u of accRows) {
    if (num(u.uid) < TEST_UID_FLOOR) out_of_predicate.push(`account uid=${u.uid} < ${TEST_UID_FLOOR}`);
  }
  for (const r of curRows) {
    if (r.cid === '1') out_of_predicate.push(`currency cid=1 被列入待删（禁止）`);
    if (!symbolMatches(r.symbol)) out_of_predicate.push(`currency cid=${r.cid} symbol=${r.symbol} ∉ {${SYMBOL_PREFIXES.join(',')}}%`);
  }
  for (const u of ownerRows) {
    if (num(u.uid) < TEST_UID_FLOOR) out_of_predicate.push(`ledger_owner uid=${u.uid} < ${TEST_UID_FLOOR}`);
  }

  // ---- 断言 B：硬红线对象绝不出现在待删集合 ----
  const forbidden_hits: string[] = [];
  for (const fu of FORBIDDEN_UIDS) {
    if (accRows.some((r) => num(r.uid) === fu)) forbidden_hits.push(`account uid=${fu}（平台保留 uid）被列入待删`);
    if (ownerRows.some((r) => num(r.uid) === fu)) forbidden_hits.push(`ledger_owner uid=${fu}（平台保留 uid）被列入待删`);
  }
  if (cids.includes('1')) forbidden_hits.push(`currency cid=1（$ 系统币）被列入待删`);
  if (accRows.some((r) => num(r.uid) <= 0)) forbidden_hits.push('待删 account 含 uid <= 0 的行');

  // ---- 观察项（非失败）：测试 cid 内 uid <= 0 的流水（若出现需人工确认，本单实际为 0） ----
  const test_cid_platform_uid_entries = await readQuery<{ txid: string; uid: string; cid: string }>(
    `SELECT txid::text, uid::text, cid::text FROM ledger_entry WHERE cid IN (${cidList}) AND uid < ${TEST_UID_FLOOR} ORDER BY txid`,
  ).then((rs) => rs.map((r) => `txid=${r.txid} uid=${r.uid} cid=${r.cid}`));

  return {
    uids: accRows.map((r) => r.uid),
    cids,
    symbols,
    txids: entryRows.map((r) => r.txid),
    ownerUids: ownerRows.map((r) => r.uid),
    forbidden_hits,
    out_of_predicate,
    test_cid_platform_uid_entries,
  };
};

// ---------------------------------------------------------------- 真删（单事务）
const apply = async (plan: Plan): Promise<Record<string, unknown>> => {
  const cidList = plan.cids.length ? plan.cids.join(',') : '-1';
  const before = await triggerState();
  const supplyBeforeAll = await supplyAudit();

  const result = await withTransaction(async (tx: TxClient) => {
    // —— 硬红线再断言（事务内、删除前）：平台账户与 cid=1 币行必须完好 ——
    const platformBefore = (await tx.query<{ uid: string; cid: string; balance: string; frozen: string }>(
      `SELECT uid::text, cid::text, balance::text, frozen::text FROM account WHERE uid <= 0 ORDER BY 1`,
    )).rows;
    if (platformBefore.length !== 4) throw new Error(`platform accounts != 4 before purge: ${JSON.stringify(platformBefore)}`);
    if (platformBefore.some((r) => r.balance !== '0' || r.frozen !== '0')) {
      throw new Error(`platform account balance/frozen != 0 before purge: ${JSON.stringify(platformBefore)}`);
    }
    const cid1Before = (await tx.query<{ cid: string; symbol: string; total_supply: string; supply_cap: string | null }>(
      `SELECT cid::text, symbol, total_supply::text, supply_cap::text FROM currency WHERE cid = 1`,
    )).rows;
    if (cid1Before.length !== 1) throw new Error(`cid=1 currency row missing/duplicated: ${JSON.stringify(cid1Before)}`);

    // 守卫触发器会拒绝 DELETE（append-only / account 守卫）；在本事务内临时禁用
    await tx.query('ALTER TABLE ledger_entry DISABLE TRIGGER USER');
    await tx.query('ALTER TABLE account DISABLE TRIGGER USER');
    const disabled = await tx.query<{ relname: string; tgname: string; tgenabled: string }>(
      `SELECT c.relname, t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname IN ('ledger_entry','account') ORDER BY 1,2`);

    const d1 = await tx.query(`DELETE FROM ledger_entry WHERE uid >= ${TEST_UID_FLOOR} OR cid IN (${cidList})`);
    const d2 = await tx.query(`DELETE FROM account WHERE uid >= ${TEST_UID_FLOOR}`);
    const d3 = await tx.query(`DELETE FROM currency WHERE cid IN (${cidList})`);
    const d4 = await tx.query(`DELETE FROM ledger_owner WHERE uid >= ${TEST_UID_FLOOR}`);

    // ------------------------------------------------ P1g：恢复 total_supply 自洽
    // 只改 currency.total_supply 一个字段（Zang §5.9 明示授权）；其余列（含 time_updated）不动。
    const supplyBefore = await supplyAudit(tx);
    const reconcile = await tx.query<{ cid: string; symbol: string; total_supply_before: string; total_supply_after: string }>(`
      WITH target AS (
        SELECT c.cid,
               c.total_supply AS old_supply,
               COALESCE(SUM(e.delta) FILTER (WHERE e.kind = 'mint'), 0)
                 - COALESCE(SUM(e.delta) FILTER (WHERE e.kind = 'burn'), 0) AS new_supply
          FROM currency c LEFT JOIN ledger_entry e ON e.cid = c.cid
         GROUP BY c.cid, c.total_supply
      )
      UPDATE currency c
         SET total_supply = t.new_supply
        FROM target t
       WHERE c.cid = t.cid AND c.total_supply <> t.new_supply
      RETURNING c.cid::text AS cid, c.symbol, t.old_supply::text AS total_supply_before, c.total_supply::text AS total_supply_after`);
    const supplyAfter = await supplyAudit(tx);

    // 自证：改后每个 cid 的 total_supply 必须 == 残留 Σmint − Σburn
    const bad = supplyAfter.filter((r) => r.total_supply !== r.consistent_target);
    if (bad.length) {
      throw new Error(`total_supply reconcile failed (still inconsistent): ${JSON.stringify(bad)}`);
    }

    // 恢复触发器（必须在提交前）
    await tx.query('ALTER TABLE ledger_entry ENABLE TRIGGER USER');
    await tx.query('ALTER TABLE account ENABLE TRIGGER USER');
    const reenabled = await tx.query<{ relname: string; tgname: string; tgenabled: string }>(
      `SELECT c.relname, t.tgname, t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname IN ('ledger_entry','account') ORDER BY 1,2`);

    const notO = reenabled.rows.filter((r) => r.tgenabled !== 'O');
    if (notO.length) {
      throw new Error(`trigger restore failed inside tx: ${JSON.stringify(notO)}`);
    }

    // 删后（提交前）复核：保留集必须只剩平台账户 / cid=1 / 平台 owner
    const survivorAccounts = await tx.query<{ uid: string; cid: string }>(
      `SELECT uid::text AS uid, cid::text AS cid FROM account ORDER BY 1,2`,
    );
    const badAcc = survivorAccounts.rows.filter((r) => Number(r.uid) >= TEST_UID_FLOOR);
    if (badAcc.length) throw new Error(`survivor accounts still >= ${TEST_UID_FLOOR}: ${JSON.stringify(badAcc.slice(0, 5))}`);

    // 平台账户四行必须原样（balance/frozen 仍为 0）
    const platformAfter = (await tx.query<{ uid: string; cid: string; balance: string; frozen: string }>(
      `SELECT uid::text, cid::text, balance::text, frozen::text FROM account WHERE uid <= 0 ORDER BY 1`,
    )).rows;
    if (platformAfter.length !== 4 || platformAfter.some((r) => r.balance !== '0' || r.frozen !== '0')) {
      throw new Error(`platform accounts mutated by purge: ${JSON.stringify(platformAfter)}`);
    }

    // cid=1 币行必须仍在，且只有 total_supply 变了
    const cid1After = (await tx.query<{ cid: string; symbol: string; total_supply: string; supply_cap: string | null; status: string; owner_uid: string; decimals: string }>(
      `SELECT cid::text, symbol, total_supply::text, supply_cap::text, status, owner_uid::text, decimals::text FROM currency WHERE cid = 1`,
    )).rows;

    return {
      deleted: {
        ledger_entry: d1.rowCount,
        account: d2.rowCount,
        currency: d3.rowCount,
        ledger_owner: d4.rowCount,
      },
      expected: {
        ledger_entry: plan.txids.length,
        account: plan.uids.length,
        currency: plan.cids.length,
        ledger_owner: plan.ownerUids.length,
      },
      trigger_state_before: before,
      trigger_state_disabled_in_tx: disabled.rows,
      trigger_state_reenabled_in_tx: reenabled.rows,
      survivors_after_delete_in_tx: survivorAccounts.rows,
      platform_accounts_after_delete_in_tx: platformAfter,
      cid1_currency_row_before: cid1Before[0],
      cid1_currency_row_after: cid1After[0],
      supply_audit_in_tx_before_reconcile: supplyBefore,
      supply_audit_in_tx_after_reconcile: supplyAfter,
      reconcile_updated_rows: reconcile.rows,
      supply_audit_before_any_change: supplyBeforeAll,
    };
  });
  const after = await triggerState();
  return { ...result, trigger_state_after_commit: after };
};

// ---------------------------------------------------------------- main
(async () => {
  const before = await counts();
  const beforeTrig = await triggerState();
  const beforeJud = await judgements();
  const plan = await buildPlan();

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY-RUN',
    counts_before: before,
    trigger_state_before: beforeTrig,
    judgements_before: {
      judgement_1_rows: beforeJud.judgement_1_hits.length,
      judgement_8_rows_raw: beforeJud.judgement_8_hits.length,
      judgement_8_rows_excl_mint_burn: beforeJud.judgement_8_hits_excl_mint_burn.length,
    },
    planned_deletions: {
      ledger_entry: plan.txids.length,
      account: plan.uids.length,
      currency: plan.cids.length,
      ledger_owner: plan.ownerUids.length,
    },
    planned_detail: {
      currency_cids: plan.cids.map((c) => `cid=${c} symbol=${plan.symbols[c]}`),
      account_uids: plan.uids,
      ledger_entry_txid_numeric_range: plan.txids.length
        ? [String(Math.min(...plan.txids.map(Number))), String(Math.max(...plan.txids.map(Number)))]
        : [],
    },
    predicted_set_predicate: `account.uid >= ${TEST_UID_FLOOR}  ∪  currency.cid <> 1 AND (${SYMBOL_PRED})`,
    symbol_prefixes: SYMBOL_PREFIXES,
    assert_out_of_predicate: plan.out_of_predicate,
    assert_forbidden_hits: plan.forbidden_hits,
    observed_test_cid_entries_with_platform_uid: plan.test_cid_platform_uid_entries,
    assert_pass: plan.out_of_predicate.length === 0 && plan.forbidden_hits.length === 0,
    supply_audit_before: await supplyAudit(),
  }, null, 2));

  if (plan.out_of_predicate.length || plan.forbidden_hits.length) {
    console.error('ABORT: 待删集合超出预测集 / 命中硬红线，未做任何删除。');
    process.exitCode = 3;
    return;
  }
  if (!APPLY) {
    console.log('DRY-RUN：未做任何删除。要真删请显式传 --apply。');
    return;
  }

  const applied = await apply(plan);
  const after = await counts();
  const afterTrig = await triggerState();
  const afterJud = await judgements();
  const supplyAfter = await supplyAudit();

  console.log(JSON.stringify({
    mode: 'APPLY',
    applied,
    counts_after: after,
    delta: {
      ledger_entry: before.ledger_entry - after.ledger_entry,
      account: before.account - after.account,
      currency: before.currency - after.currency,
      ledger_owner: before.ledger_owner - after.ledger_owner,
      schema_migration: before.schema_migration - after.schema_migration,
      users: before.users - after.users,
    },
    trigger_state_after: afterTrig,
    triggers_all_enabled_after: afterTrig.every((t) => t.tgenabled === 'O'),
    supply_audit_after_commit: supplyAfter,
    supply_all_consistent_after_commit: supplyAfter.every((r) => r.total_supply === r.consistent_target),
    judgements_after: {
      judgement_1_rows: afterJud.judgement_1_hits.length,
      judgement_1_detail: afterJud.judgement_1_hits,
      judgement_8_rows_raw: afterJud.judgement_8_hits.length,
      judgement_8_rows_excl_mint_burn: afterJud.judgement_8_hits_excl_mint_burn.length,
      judgement_8_detail: afterJud.judgement_8_hits,
    },
    judgement_1_ok: afterJud.judgement_1_hits.length === 0,
    judgement_8_ok: afterJud.judgement_8_hits_excl_mint_burn.length === 0 && afterJud.judgement_8_hits.length === 0,
  }, null, 2));

  if (afterJud.judgement_1_hits.length || afterJud.judgement_8_hits.length) {
    console.error('STOP: 删后判据不为 0 —— 不自行编造平账，请人工复核（已单列上述差异行）。');
    process.exitCode = 5;
  }
})()
  .catch((e) => {
    console.error('purge fatal:', String((e as Error)?.message || e).slice(0, 800));
    process.exitCode = 2;
  })
  .finally(async () => {
    await closePools();
  });
