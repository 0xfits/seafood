// p4z-a1ld-01-probe.ts — A1-LEDGER-DESIGN **只读取数**（不写库、不改码、不发写请求）
// ============================================================================
// 目的（派单 §1 + §2）：
//   ① 类级扫描的**现场真源**：库内 `public` 实际存在哪些表（逐名，非白名单）；
//   ② 差集候选（代码引用 ∖ 迁移建表）在**库里到底有没有**：asset / task / task_progress /
//      prize / prize_item / shard / shard_transfer / schema_migration / users / account；
//   ③ A1 改接账本所需只读事实：`ledger_post_event` 及其断言函数是否在盘、参数形状、
//      ledger_entry 现用 kind 集、平台保留 uid（0 / −1 / −2 / −3）的 account 行是否存在。
// 口径（㊳ · §5.7）：
//   · 一律走 HTTP 驱动的 `neon()`（**不**用 `Client`(ws)）；
//   · 0.6.1 的 `neon()` **无 `.query`** ⇒ 用 `sql.query ?? sql(text,params) ?? sql.unsafe` 自适应；
//   · **只读**：仅 `SELECT` / `information_schema` / `pg_catalog` 读，无 DDL/DML。
// 用法：
//   node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-a1ld-01-probe.ts <outDirAbs>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'a1ld-probe'));
fs.mkdirSync(outDir, { recursive: true });

// .env.local 只读加载（不改写）
for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless');
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));

// 0.6.1 自适应：neon() 无 .query ⇒ 依次尝试
const run = async (q: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
  const anySql = sqlRaw as unknown as {
    (t: string, p?: unknown[]): Promise<unknown[]>;
    query?: (t: string, p?: unknown[]) => Promise<unknown[]>;
    unsafe?: (t: string, p?: unknown[]) => Promise<unknown[]>;
  };
  if (typeof anySql.query === 'function') return (await anySql.query(q, params)) as Record<string, unknown>[];
  if (typeof anySql.unsafe === 'function' && params.length) return (await anySql.unsafe(q, params)) as Record<string, unknown>[];
  return (await anySql(q, params)) as Record<string, unknown>[];
};
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []): Promise<T[]> => {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try { return (await run(q, params)) as T[]; } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw last;
};

// 迁移建表集合（**文件侧现取常量**，provenance 见同目录 tables_from_migrations.json；
//   本脚本不重读 migrations，避免「探针自己造真源」）
const MIGRATION_TABLES = [
  'account', 'currency', 'ledger_entry', 'ledger_owner', 'user', 'users', 'commission_policy',
  'referral', 'job', 'job_application', 'job_submission', 'listing', 'listing_order',
  'market_order', 'market_trade', 'admin_permission', 'admin_role', 'admin_role_permission',
  'admin_user_role', 'app_config', 'currency_status_log',
];
// 代码侧引用的可疑表名（差集候选取自 src 扫描，见报告 §1-b）
const SRC_SUSPECTS = ['asset', 'task', 'task_progress', 'prize', 'prize_item', 'shard', 'shard_transfer', 'schema_migration', 'profile'];

const out: Record<string, unknown> = { run: path.basename(outDir), caliber: 'readonly SELECT/information_schema via HTTP neon()' };

(async () => {
  out.caller = 'p4z-a1ld-01-probe.ts';
  out.tables = await sql(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
  const live = (out.tables as Array<{ table_name: string }>).map((t) => t.table_name);
  out.live_table_count = live.length;

  out.src_suspects_presence = SRC_SUSPECTS.map((n) => ({ table: n, live_exists: live.includes(n), migration_created: MIGRATION_TABLES.includes(n) }));
  out.diff_src_minus_migrations = SRC_SUSPECTS.filter((n) => !MIGRATION_TABLES.includes(n));

  // 逐可疑表：真存在才读列/行数（不存在则显式记 NOT_EXISTS，不填 0）
  out.suspect_details = [] as unknown[];
  for (const n of SRC_SUSPECTS) {
    if (!live.includes(n)) { (out.suspect_details as unknown[]).push({ table: n, status: 'NOT_EXISTS_IN_DB' }); continue; }
    const cols = await sql(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [n]);
    const rc = await sql(`SELECT count(*)::int AS n FROM "${n}"`);
    (out.suspect_details as unknown[]).push({ table: n, status: 'EXISTS', columns: cols, rowcount: (rc[0] as { n: number }).n });
  }

  // A1 改接相关只读事实
  out.ledger_routines = await sql(
    `SELECT p.proname, pg_get_function_arguments(p.oid) AS args, length(p.prosrc) AS src_len
       FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
      WHERE nsp.nspname='public' AND p.proname IN ('ledger_post_event','ledger_assert_platform_mutation','ledger_move_guard') ORDER BY 1`);
  out.ledger_post_event_args_has_mint_token = await sql(
    `SELECT p.proname, (p.prosrc ILIKE '%''mint''%') AS src_mentions_quoted_mint
       FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
      WHERE nsp.nspname='public' AND p.proname='ledger_assert_platform_mutation'`);
  out.ledger_kinds_in_use = await sql(`SELECT kind, count(*)::int AS n FROM ledger_entry GROUP BY kind ORDER BY 2 DESC, 1`);
  out.ledger_entry_count = await sql(`SELECT count(*)::int AS n FROM ledger_entry`);
  out.platform_accounts = await sql(
    `SELECT uid::text AS uid, cid::int AS cid, balance::text AS bal, frozen::text AS frz
       FROM account WHERE uid IN (0,-1,-2,-3) ORDER BY uid, cid`);
  out.currency_rows = await sql(`SELECT cid::int AS cid, symbol, owner_uid::text AS owner_uid, supply_cap::text AS cap, total_supply::text AS ts FROM currency ORDER BY cid LIMIT 10`);
  out.schema_migration = await sql(`SELECT version FROM schema_migration ORDER BY version DESC LIMIT 3`).catch((e: unknown) => ({ error: String(e) }));
  out.audit_like_tables = await sql(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public'
       AND (table_name ILIKE '%audit%' OR table_name ILIKE '%log%' OR table_name ILIKE '%history%') ORDER BY 1`);

  const fp = path.join(outDir, 'results.json');
  fs.writeFileSync(fp, JSON.stringify(out, null, 2));
  // grep-able 摘要（§5.7 ⑥：报「实测」必须能 grep 到支撑读数）
  console.log('PROBE_OK ' + fp);
  console.log('LIVE_TABLES=' + live.join(','));
  console.log('DIFF_SRC_MINUS_MIGRATIONS=' + (out.diff_src_minus_migrations as string[]).join(','));
  for (const d of out.suspect_details as Array<{ table: string; status: string }>) console.log(`SUSPECT ${d.table} => ${d.status}`);
  console.log('ROUTINES=' + (out.ledger_routines as Array<{ proname: string; args: string }>).map((r) => r.proname + '(' + r.args + ')').join(' | '));
  console.log('KINDS_IN_USE=' + (out.ledger_kinds_in_use as Array<{ kind: string; n: number }>).map((k) => k.kind + ':' + k.n).join(','));
  console.log('PLATFORM_ACCOUNTS=' + (out.platform_accounts as Array<{ uid: string; cid: number; bal: string }>).map((a) => `uid${a.uid}/cid${a.cid}=${a.bal}`).join(','));
})().catch((e) => { console.error('PROBE_FAIL', e); process.exit(1); });
