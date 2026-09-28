/**
 * p3q-01 —— D20 残差只读清单（禁删）
 * Kong · P3-Q 单（变体 1 第 ② 前置）。
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3q-01-d20-residual.ts
 * 退出码：0 正常 / 2 致命。
 * 只读：仅 SELECT / count —— 不删任何行、不改任何表。
 * 落盘：.p3q-artifacts/p3q-01-d20-residual-<RUN>.json / .txt（同名拒写）。
 * 平台账户 0/-1/-2/-3 与 cid=1 **均为合法产物**，不列入残差（仅登记）。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
const RUN = process.env.P3Q_RUN
  || (new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6));
const OUT_DIR = path.resolve(__dirname, '..', '.p3q-artifacts');

const writeArtifact = (name: string, body: string): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  if (fs.existsSync(p)) throw new Error(`REFUSE_OVERWRITE: ${p}`);
  fs.writeFileSync(p, body);
  return p;
};

/** 夹具 uid 窗口（6 位 uid 的前 4 位） */
const WINDOWS = ['9903', '9904', '9905', '9906', '9907', '9908'];
/** 平台账户 uid：合法产物 */
const PLATFORM_UIDS = ['0', '-1', '-2', '-3'];

const main = async (): Promise<void> => {
  if (!DIRECT_URL) { console.error('FATAL: no DATABASE_URL'); process.exit(2); }
  const pool = new Pool({ connectionString: DIRECT_URL, max: 3, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });
  const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, params)).rows as R[];

  const out: Record<string, any> = {
    run: RUN, ts_utc: new Date().toISOString(), mode: 'READ_ONLY_INVENTORY', deletes_performed: 0,
    note: 'platform uids 0/-1/-2/-3 与 cid=1 为合法产物，不列残差；ledger_entry append-only 禁直删',
    windows: WINDOWS, platform_uids: PLATFORM_UIDS,
  };

  // ---------- A) 逐表 count(*) ----------
  const TABLES = ['users', 'currency', 'account', 'ledger_entry', 'referral', 'job', 'job_application',
    'job_submission', 'listing', 'listing_order', 'market_order', 'market_trade', 'commission_policy',
    'admin_role', 'admin_user_role', 'admin_permission', 'admin_role_permission', 'ledger_owner',
    'app_config', 'currency_status_log', 'schema_migration'];
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const r = await q<{ n: string }>(`SELECT count(*)::text AS n FROM public."${t}"`);
    counts[t] = Number(r[0]?.n ?? 0);
  }
  out.counts = counts;

  // ---------- B) uid 窗口聚合 ----------
  const windowExpr = (col: string) =>
    `left((${col})::text,4)`;
  const uidCols: Array<[string, string]> = [
    ['users', 'uid'], ['account', 'uid'], ['ledger_entry', 'uid'],
    ['referral', 'child_uid'], ['referral', 'parent_uid'],
    ['currency', 'owner_uid'], ['job', 'employer_uid'], ['job', 'worker_uid'],
    ['job_application', 'worker_uid'], ['job_submission', 'worker_uid'],
    ['listing', 'seller_uid'], ['listing_order', 'buyer_uid'], ['listing_order', 'seller_uid'],
    ['market_order', 'owner_uid'], ['market_trade', 'taker_uid'], ['commission_policy', 'created_by'],
  ];
  const uidWindows: Record<string, Record<string, number>> = {};
  for (const [t, c] of uidCols) {
    const rows = await q<{ w: string; n: string }>(
      `SELECT ${windowExpr(c)} AS w, count(*)::text AS n FROM public."${t}"
       WHERE ${windowExpr(c)} = ANY($1) GROUP BY 1 ORDER BY 1`, [WINDOWS]);
    const key = `${t}.${c}`;
    uidWindows[key] = Object.fromEntries(rows.map((r) => [r.w, Number(r.n)]));
  }
  out.uid_window_histogram = uidWindows;

  // 平台 uid 登记（非残差）
  const plat: Record<string, number> = {};
  for (const u of PLATFORM_UIDS) {
    if (u.startsWith('-')) continue;
    const r = await q<{ n: string }>(`SELECT count(*)::text AS n FROM public.users WHERE uid::text=$1`, [u]);
    plat[u] = Number(r[0]?.n ?? 0);
  }
  const negPlat = await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.users WHERE uid::text = ANY($1)`, [['-1', '-2', '-3']]);
  plat['minus1_2_3_users'] = Number(negPlat[0]?.n ?? 0);
  out.platform_uid_registration = plat;

  // ---------- C) 幂等键 / create_key 命名空间前缀 ----------
  const keyCols: Array<[string, string]> = [
    ['ledger_entry', 'idempotency_key'],
    ['job', 'create_key'], ['job_application', 'create_key'], ['job_submission', 'create_key'],
    ['listing', 'create_key'], ['listing_order', 'create_key'], ['market_order', 'create_key'],
  ];
  const keyNs: Record<string, Array<{ ns: string; n: number }>> = {};
  for (const [t, c] of keyCols) {
    const rows = await q<{ ns: string; n: string }>(
      `SELECT split_part(${c}, ':', 1) AS ns, count(*)::text AS n FROM public."${t}" GROUP BY 1 ORDER BY 2 DESC`);
    keyNs[`${t}.${c}`] = rows.map((r) => ({ ns: r.ns, n: Number(r.n) }));
  }
  out.key_namespaces = keyNs;

  // 前缀命中：含 neng* / cli:* / ops:* / p3p / neng17
  const interesting = ['cli', 'ops', 'neng', 'p3p', 'neng17'];
  const hits: Array<{ table: string; col: string; ns: string; n: number }> = [];
  for (const [k, arr] of Object.entries(keyNs)) {
    const [t, c] = k.split('.');
    for (const { ns, n } of arr) {
      if (interesting.some((p) => ns === p || ns.startsWith('neng'))) hits.push({ table: t, col: c, ns, n });
    }
  }
  out.key_namespace_hits = hits;

  // ---------- D) 角色键 ----------
  out.admin_role_keys = (await q<{ k: string; n: string }>(
    `SELECT role_key AS k, count(*)::text AS n FROM public.admin_role GROUP BY 1 ORDER BY 1`))
    .map((r) => ({ role_key: r.k, n: Number(r.n) }));
  out.admin_user_role_keys = (await q<{ k: string; n: string }>(
    `SELECT role_key AS k, count(*)::text AS n FROM public.admin_user_role GROUP BY 1 ORDER BY 1`))
    .map((r) => ({ role_key: r.k, n: Number(r.n) }));

  // ---------- E) currency / commission_policy 明细 ----------
  out.currency_by_cid = (await q<{ cid: string; symbol: string; status: string; total_supply: string; owner_uid: string }>(
    `SELECT cid::text, symbol, status, total_supply::text, owner_uid::text FROM public.currency ORDER BY cid`))
    .map((r) => ({ cid: r.cid, symbol: r.symbol, status: r.status, total_supply: r.total_supply, owner_uid: r.owner_uid }));
  out.currency_status_hist = (await q<{ s: string; n: string }>(
    `SELECT status AS s, count(*)::text AS n FROM public.currency GROUP BY 1 ORDER BY 2 DESC`))
    .map((r) => ({ status: r.s, n: Number(r.n) }));
  out.commission_policy_ids = (await q<{ p: string }>(
    `SELECT policy_id::text AS p FROM public.commission_policy ORDER BY policy_id`)).map((r) => r.p);

  // ---------- F) $（cid=1）敏感性预演（只读计算） ----------
  const cid1Supply = await q<{ s: string }>(`SELECT total_supply::text AS s FROM public.currency WHERE cid=1`);
  const cid1Sum = await q<{ n: string; c: string }>(
    `SELECT COALESCE(sum(balance+frozen),0)::text AS n, count(*)::text AS c FROM public.account WHERE cid=1`);
  const cid1SumExclWin = await q<{ n: string; c: string }>(
    `SELECT COALESCE(sum(balance+frozen),0)::text AS n, count(*)::text AS c FROM public.account
     WHERE cid=1 AND left(uid::text,4) <> ALL($1)`, [WINDOWS]);
  const cid1ByWindow = await q<{ w: string; n: string; c: string }>(
    `SELECT left(uid::text,4) AS w, COALESCE(sum(balance+frozen),0)::text AS n, count(*)::text AS c
     FROM public.account WHERE cid=1 GROUP BY 1 ORDER BY 1`);
  const cid1NegUid = await q<{ w: string; n: string; c: string }>(
    `SELECT uid::text AS w, (balance+frozen)::text AS n, '1' AS c FROM public.account
     WHERE cid=1 AND uid < 0 ORDER BY uid`);

  out.cid1_sensitivity = {
    total_supply: cid1Supply[0]?.s ?? null,
    account_sum_now: cid1Sum[0]?.n ?? null,
    account_rows_now: Number(cid1Sum[0]?.c ?? 0),
    account_sum_excl_fixture_windows: cid1SumExclWin[0]?.n ?? null,
    account_rows_excl_fixture_windows: Number(cid1SumExclWin[0]?.c ?? 0),
    by_window: cid1ByWindow.map((r) => ({ w: r.w, sum: r.n, rows: Number(r.c) })),
    negative_uid_rows: cid1NegUid.map((r) => ({ uid: r.w, sum: r.n })),
    formula: 'account_sum = SUM(balance+frozen) over public.account WHERE cid=1',
  };

  // ---------- G) 具名夹具计数（brief 台账逐条核） ----------
  const named: Record<string, number> = {};
  named['currency cid=991001 (draft)'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.currency WHERE cid=991001`))[0]?.n ?? 0);
  named['ledger_entry idempotency_key LIKE p3p:%'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE 'p3p:%'`))[0]?.n ?? 0);
  named['ledger_entry idempotency_key LIKE cli:%'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE 'cli:%'`))[0]?.n ?? 0);
  named['ledger_entry idempotency_key LIKE ops:%'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE 'ops:%'`))[0]?.n ?? 0);
  named['ledger_entry idempotency_key LIKE neng%'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key LIKE 'neng%'`))[0]?.n ?? 0);
  named['users left(uid,4) IN windows'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.users WHERE left(uid::text,4) = ANY($1)`, [WINDOWS]))[0]?.n ?? 0);
  named['commission_policy 1+20..37'] = Number((await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.commission_policy WHERE policy_id=1 OR policy_id BETWEEN 20 AND 37`))[0]?.n ?? 0);
  out.named_counts = named;

  await pool.end();

  const jsonPath = writeArtifact(`p3q-01-d20-residual-${RUN}.json`, JSON.stringify(out, null, 2));

  // ---------- 人可读表 ----------
  const L: string[] = [];
  L.push(`# D20 残差只读清单  RUN=${RUN}  ${new Date().toISOString()}`);
  L.push(`（只读盘点；deletes_performed=0；平台 uid 0/-1/-2/-3 与 cid=1 为合法产物，不列残差）`);
  L.push('');
  L.push('## A) 逐表 count(*)');
  L.push('| table | count |');
  L.push('|---|---|');
  for (const [t, n] of Object.entries(counts)) L.push(`| public.${t} | ${n} |`);
  L.push('');
  L.push('## B) 夹具 uid 窗口直方图 (left(uid,4))');
  L.push('| table.col | ' + WINDOWS.join(' | ') + ' |');
  L.push('|---|' + WINDOWS.map(() => '---|').join(''));
  for (const [k, hist] of Object.entries(uidWindows)) {
    L.push(`| ${k} | ` + WINDOWS.map((w) => hist[w] ?? 0).join(' | ') + ' |');
  }
  L.push('');
  L.push('## C) 幂等键/create_key 命名空间前缀');
  for (const [k, arr] of Object.entries(keyNs)) {
    L.push(`- ${k}: ` + (arr.length ? arr.map((x) => `${x.ns}=${x.n}`).join(', ') : '(empty)'));
  }
  L.push(`- 命中 interesting 前缀: ` + (hits.length ? hits.map((h) => `${h.table}.${h.col}:${h.ns}=${h.n}`).join(', ') : '(none)'));
  L.push('');
  L.push('## D) 角色键');
  L.push('- admin_role: ' + out.admin_role_keys.map((x: any) => `${x.role_key}=${x.n}`).join(', '));
  L.push('- admin_user_role: ' + out.admin_user_role_keys.map((x: any) => `${x.role_key}=${x.n}`).join(', '));
  L.push('');
  L.push('## E) currency / commission_policy');
  L.push('- currency status hist: ' + out.currency_status_hist.map((x: any) => `${x.status}=${x.n}`).join(', '));
  L.push('- currency cids: ' + out.currency_by_cid.map((x: any) => `${x.cid}(${x.symbol}/${x.status})`).join(', '));
  L.push('- commission_policy_ids: ' + out.commission_policy_ids.join(', '));
  L.push('');
  L.push('## F) $（cid=1）敏感性预演');
  const cs: any = out.cid1_sensitivity;
  L.push(`- total_supply(cid=1)      = ${cs.total_supply}`);
  L.push(`- account_sum NOW          = ${cs.account_sum_now}  (rows=${cs.account_rows_now})`);
  L.push(`- account_sum EXCL windows = ${cs.account_sum_excl_fixture_windows}  (rows=${cs.account_rows_excl_fixture_windows})`);
  L.push(`- by window: ` + cs.by_window.map((x: any) => `${x.w}:sum=${x.sum},rows=${x.rows}`).join(' | '));
  L.push(`- negative-uid rows: ` + (cs.negative_uid_rows.length ? cs.negative_uid_rows.map((x: any) => `uid=${x.uid}:sum=${x.sum}`).join(', ') : '(none)'));
  L.push('');
  L.push('## G) 具名夹具计数');
  for (const [k, v] of Object.entries(named)) L.push(`- ${k} = ${v}`);
  L.push('');
  L.push(`artifact_json=${jsonPath}`);

  const text = L.join('\n');
  const txtPath = writeArtifact(`p3q-01-d20-residual-${RUN}.txt`, text);
  console.log(text);
  console.log(`artifact_txt=${txtPath}`);
  console.log(`--- EXIT_OK RUN=${RUN} ---`);
};

main().catch((e) => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(2); });
