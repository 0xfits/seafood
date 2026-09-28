/**
 * p3u-00 · **只读**真库行增量登记（Unit F / P3-SUITE-CALIBER-FIX）
 * ============================================================================
 * 用途：每次跑既有套件（p1o-00 / p2w-00）**前/后**同口径登记五表行数 + cid=1 守恒 +
 *       触发器启用态；读数落 `backend-ts/.p3u-artifacts/p3u-00-counts-<label>-<RUN>.json`
 *       （run-tagged、**同名拒写**）。
 *
 * 纪律
 *   · **纯只读**：不 INSERT/UPDATE/DELETE，不 DDL，不起 server。身份表名一律 `public.users`。
 *   · 跨 schema 陷阱：库内另有 `neon_auth.account` ⇒ 所有对象**显式限定 `public.`**。
 *   · 本单命名空间 = uid 窗口 `9913xx` / 键前缀 `cli:kong22-`；本脚本只**读**该窗口的占用态。
 *   · 退出码不取自管道之后；`--label before|after|<自定>` 只进文件名与 JSON。
 *
 * 用法：`cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only \
 *        scripts/p3u-00-counts.ts --label before`
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, RUN } from './p2w-lib';

const labelArg = ((): string => {
  const i = process.argv.indexOf('--label');
  const v = i >= 0 ? String(process.argv[i + 1] ?? '') : '';
  return /^[a-z0-9_-]{1,24}$/i.test(v) ? v : 'unspecified';
})();

/** 本单探针命名空间（uid 窗口 9913xx / 键前缀 cli:kong22-） */
const MY_UID_LO = 991300;
const MY_UID_HI = 991399;
const MY_KEYPREFIX = 'cli:kong22-';

const main = async (): Promise<void> => {
  const p = mkPool(2);
  const five = await raw<{ t: string; n: string }>(p, `
    SELECT 'users' AS t, count(*)::text AS n FROM public.users
    UNION ALL SELECT 'account', count(*)::text FROM public.account
    UNION ALL SELECT 'ledger_entry', count(*)::text FROM public.ledger_entry
    UNION ALL SELECT 'currency', count(*)::text FROM public.currency
    UNION ALL SELECT 'referral', count(*)::text FROM public.referral
    UNION ALL SELECT 'commission_policy', count(*)::text FROM public.commission_policy
    ORDER BY 1`);
  const counts: Record<string, string> = {};
  for (const r of five) counts[r.t] = r.n;

  const trig = await raw1<{ total: string; not_o: string }>(p, `
    SELECT count(*)::text AS total, count(*) FILTER (WHERE t.tgenabled <> 'O')::text AS not_o
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname = 'public'`);

  const supply = await raw1<{ supply: string | null; acct_sum: string | null }>(p, `
    SELECT (SELECT total_supply::text FROM public.currency WHERE cid = 1) AS supply,
           (SELECT COALESCE(sum(balance + frozen), 0)::text FROM public.account WHERE cid = 1) AS acct_sum`);

  const myWindow = await raw1<{ users_rows: string; account_rows: string; referral_rows: string; ledger_rows: string }>(p, `
    SELECT (SELECT count(*)::text FROM public.users WHERE uid BETWEEN $1 AND $2) AS users_rows,
           (SELECT count(*)::text FROM public.account WHERE uid BETWEEN $1 AND $2) AS account_rows,
           (SELECT count(*)::text FROM public.referral WHERE child_uid BETWEEN $1 AND $2 OR parent_uid BETWEEN $1 AND $2) AS referral_rows,
           (SELECT count(*)::text FROM public.ledger_entry WHERE idempotency_key LIKE $3) AS ledger_rows`,
    [MY_UID_LO, MY_UID_HI, `${MY_KEYPREFIX}%`]);

  const schemaVersion = (await raw1<{ v: string }>(p, `SELECT max(version) AS v FROM public.schema_migration`))?.v ?? null;

  const out = {
    probe: 'p3u-00 · 真库行增量登记（只读）', label: labelArg, run: RUN,
    at: new Date().toISOString(),
    note: '五表行数（每次跑既有套件前/后同口径）+ cid=1 守恒 + 触发器启用态；纯只读',
    counts,
    cid1_conservation: { total_supply: supply?.supply ?? null, accounts_sum: supply?.acct_sum ?? null,
      conserved: supply?.supply !== null && supply?.supply === supply?.acct_sum },
    triggers: { total: trig?.total ?? null, not_enabled_o: trig?.not_o ?? null },
    schema_version: schemaVersion,
    my_namespace: { uid_window: `${MY_UID_LO}-${MY_UID_HI}`, key_prefix: MY_KEYPREFIX, ...(myWindow ?? {}) },
  };

  const dir = path.resolve(__dirname, '..', '.p3u-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `p3u-00-counts-${labelArg}-${RUN}.json`);
  if (fs.existsSync(file)) throw new Error(`REFUSE_TO_OVERWRITE ${file}`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`WROTE ${file}`);
  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
};

main().then(() => process.exit(0)).catch((e) => { console.error('P3U-00 FAILED:', (e as Error)?.stack ?? e); process.exit(2); });
