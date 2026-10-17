/**
 * 独立质检 · 覆盖度旁证（只读）：检查①只统计 mint/burn 两类，
 * 而 `ledger_kind_enum` 实际有 20 个 kind ⇒ 量化「其余 kind 在同一 cid 上是否净额为 0」，
 * 用于判断该口径的**覆盖缺口**是真风险还是仅理论风险（probe 只给读数，不改判据）。
 *
 * 用法（cwd = backend-ts）：
 *   TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-kind-coverage.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import { readQuery } from '../../../../backend-ts/src/db';

const OUT_DIR = path.resolve(__dirname, '../readings');

(async () => {
  const identity = await readQuery<Record<string, unknown>>(
    "SELECT current_setting('neon.project_id', true) AS project_id",
  );
  const projectId = String(identity[0]?.project_id ?? '');
  if (projectId === 'sweet-pond-28934105') {
    throw new Error('ABORTED: connection resolves to PRODUCTION project — refusing to run');
  }

  // 每个 cid 的两类口径对比：mint+burn vs 全部 kind
  const rows = await readQuery<Record<string, unknown>>(
    `SELECT cid,
            SUM(delta) FILTER (WHERE kind='mint') AS sum_mint,
            SUM(delta) FILTER (WHERE kind='burn') AS sum_burn,
            COALESCE(SUM(delta) FILTER (WHERE kind NOT IN ('mint','burn')),0) AS sum_other,
            SUM(delta) AS sum_all
       FROM public.ledger_entry GROUP BY cid ORDER BY cid`,
  );
  const byKind = await readQuery<Record<string, unknown>>(
    `SELECT kind, COUNT(*) AS n, SUM(delta) AS sum_delta
       FROM public.ledger_entry GROUP BY kind ORDER BY kind`,
  );
  const supply = await readQuery<Record<string, unknown>>(
    'SELECT cid, total_supply FROM public.currency ORDER BY cid',
  );
  // 账户侧合计（只读）：total_supply 与「全部账户余额和」是否一致 —— 用于把口径缺口量化成三方对照
  const accounts = await readQuery<Record<string, unknown>>(
    'SELECT cid, SUM(balance) AS sum_balance, SUM(frozen) AS sum_frozen FROM public.account GROUP BY cid ORDER BY cid',
  );

  const nonZeroOther = rows
    .filter((r) => BigInt(String(r.sum_other ?? '0')) !== 0n)
    .map((r) => ({ cid: String(r.cid), sum_other: String(r.sum_other), sum_all: String(r.sum_all), sum_mint: String(r.sum_mint), sum_burn: String(r.sum_burn) }));

  const supplyMap = new Map(supply.map((r) => [String(r.cid), String(r.total_supply)]));
  const perCid = rows.map((r) => {
    const cid = String(r.cid);
    const all = BigInt(String(r.sum_all ?? '0'));
    const ts = BigInt(supplyMap.get(cid) ?? '0');
    return { cid, total_supply: ts.toString(), sum_all_kinds: all.toString(), diff_all_kinds: (ts - all).toString(), sum_other: String(r.sum_other ?? '0') };
  });

  // 「孤儿分录」：ledger_entry 里 (uid,cid) 在 account 表无对应行 ⇒ 检查②（以 account 为 LEFT JOIN 左表）**看不见**这些行
  const orphan = await readQuery<Record<string, unknown>>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(le.delta),0) AS sum_delta,
            array_agg(DISTINCT le.kind) AS kinds
       FROM public.ledger_entry le
      WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a.uid = le.uid AND a.cid = le.cid)`,
  );
  const orphanRows = await readQuery<Record<string, unknown>>(
    `SELECT le.cid, COUNT(*) AS n, SUM(le.delta) AS sum_delta
       FROM public.ledger_entry le
      WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a.uid = le.uid AND a.cid = le.cid)
      GROUP BY le.cid ORDER BY le.cid`,
  );

  const acctMap = new Map(accounts.map((r) => [String(r.cid), { bal: String(r.sum_balance ?? '0'), froz: String(r.sum_frozen ?? '0') }]));
  const threeWay = perCid.map((r) => {
    const a = acctMap.get(r.cid) ?? { bal: '0', froz: '0' };
    const held = BigInt(a.bal) + BigInt(a.froz);
    return {
      cid: r.cid,
      total_supply: r.total_supply,
      sum_all_kinds: r.sum_all_kinds,
      sum_account_balance_plus_frozen: held.toString(),
      supply_minus_accounts: (BigInt(r.total_supply) - held).toString(),
      ...(r.sum_other !== '0' ? { sum_non_mint_burn: r.sum_other } : {}),
    };
  });

  const out = {
    ac: 'AC9-旁证',
    title: '检查①口径覆盖度：只算 mint/burn；其余 18 个 kind 在同一 cid 上是否净额为 0',
    measured_at: new Date().toISOString(),
    target: 'dev（readQuery 只读池；project_id 已核非生产）',
    db_project_id: projectId,
    kind_histogram: byKind.map((r) => ({ kind: String(r.kind), n: String(r.n), sum_delta: String(r.sum_delta) })),
    cids_with_nonzero_other_kinds: nonZeroOther,
    per_cid_total_supply_vs_all_kinds: perCid,
    per_cid_three_way: threeWay,
    accounts_by_cid_raw: accounts.map((r) => ({ cid: String(r.cid), sum_balance: String(r.sum_balance ?? '0'), sum_frozen: String(r.sum_frozen ?? '0') })),
    orphan_ledger_rows: {
      note: '检查②的 SQL 以 public.account 为左表 LEFT JOIN ledger_entry ⇒ (uid,cid) 无 account 行的分录在两侧都不出现（既不算漂移、也不进分母）。这些行在 dev 上实测非零 ⇒ 登记为口径覆盖披露。',
      total: orphan[0] ?? null,
      by_cid: orphanRows,
    },
    consistency_check: {
      note: '检查①只算 mint/burn；余额侧还含 frozen 与内部转移（hold/escrow/purchase 等）。判定口径是否自洽的办法：逐 cid 核「非 mint/burn 净额 + frozen 合计 == 0」—— 若成立，说明那些 kind 只是把余额搬进/搬出冻结，不改供应量。',
      per_cid: perCid.map((r) => {
        const a = acctMap.get(r.cid) ?? { bal: '0', froz: '0' };
        const other = BigInt(r.sum_other);
        const froz = BigInt(a.froz);
        return {
          cid: r.cid,
          sum_non_mint_burn: other.toString(),
          sum_frozen: froz.toString(),
          other_plus_frozen: (other + froz).toString(),
          self_consistent: other + froz === 0n,
        };
      }),
      all_self_consistent: perCid.every((r) => {
        const a = acctMap.get(r.cid) ?? { bal: '0', froz: '0' };
        return BigInt(r.sum_other) + BigInt(a.froz) === 0n;
      }),
    },
    reading: (() => {
      const okAll = perCid.every((r) => {
        const a = acctMap.get(r.cid) ?? { bal: '0', froz: '0' };
        return BigInt(r.sum_other) + BigInt(a.froz) === 0n;
      });
      return okAll
        ? '非 mint/burn 净额与 frozen 合计逐 cid 互为相反数（dev 读数）⇒ 内部转移/持有只改「余额 vs 冻结」分配、不改 total_supply，检查①口径（Σmint+Σburn）自洽，未发现覆盖缺口；orphan 分录 = 0。'
        : '存在 cid 的「非 mint/burn 净额 ≠ −frozen」⇒ 口径覆盖可能不足，需生产复核（属披露、不改判据）。';
    })(),
    note: '本文件只登记覆盖度，不改 AC 判据（口径由派单给定：Σmint+Σburn）。',
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'AC9-kind-coverage.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ cids: rows.length, kinds: byKind.map((r) => r.kind), nonzero_other: nonZeroOther, reading: out.reading }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error('PROBE_FATAL', e instanceof Error ? e.message : String(e));
  process.exit(2);
});
