// p4z-b5mt-01-probe.ts — B5-MT **只读取数**（不写库、不发写请求、不改码、零 DDL/DML）
// ============================================================================
// 口径（§5.7）：
//   ⑨ 只用 HTTP 驱动的 neon()（**不用 Client(ws)**）；neon() 无 .query ⇒ 自适应
//      `sql.query ?? sql(text,params) ?? sql.unsafe`，并**打印实际命中分支**；
//   ③ 保留字（user/users）一律**加引号**；缺表断言用 `to_regclass` + **JS 侧分支**
//      （Postgres 对 CASE 内子查询做解析期检查 ⇒ CASE 不构成保护，P5 已自伤复现）；
//   ⑦ `NOT_MEASURED` 禁填 0/空。
// 用法：
//   node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        /Users/kevin/bistro/seafood/backend-ts/scripts/p4z-b5mt-01-probe.ts <outDirAbs>
import * as fs from 'fs';
import * as path from 'path';

const REPO = '/Users/kevin/bistro/seafood/backend-ts';
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'p6b5mt-probe'));
fs.mkdirSync(outDir, { recursive: true });

// ---- boot env（只读，绝不打印值） ----
const envPath = path.join(REPO, '.env.local');
const boot: Record<string, unknown> = { env_local_exists: fs.existsSync(envPath) };
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
  boot.database_url_present = !!process.env.DATABASE_URL;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless');
const sqlRaw = neon(String(process.env.DATABASE_URL || ''));

let HIT_BRANCH = 'UNKNOWN';
const run = async (q: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
  const anySql = sqlRaw as unknown as {
    (t: string, p?: unknown[]): Promise<unknown[]>;
    query?: (t: string, p?: unknown[]) => Promise<unknown[]>;
    unsafe?: (t: string, p?: unknown[]) => Promise<unknown[]>;
  };
  if (typeof anySql.query === 'function') { HIT_BRANCH = 'sql.query'; return (await anySql.query(q, params)) as Record<string, unknown>[]; }
  if (typeof anySql.unsafe === 'function' && params.length) { HIT_BRANCH = 'sql.unsafe'; return (await anySql.unsafe(q, params)) as Record<string, unknown>[]; }
  HIT_BRANCH = 'sql(text,params)';
  return (await anySql(q, params)) as Record<string, unknown>[];
};
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []): Promise<T[]> => {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try { return (await run(q, params)) as T[]; } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2500)); }
  }
  throw last;
};

const steps: string[] = [];
const log = (s: string) => { steps.push(s); console.log(s); };
const out: Record<string, unknown> = { run_tag: 'p6b5mt-20261001T112357Z', boot, steps };

// 迁移面词法扫出的**真表全集**（0001–0017 + 0019 + 0020 + 0021，0018 缺；user→users 由 0006 RENAME 出）
const LEXICAL = [
  'currency', 'account', 'ledger_entry', 'ledger_owner', 'users',
  'referral', 'commission_policy', 'job', 'job_application', 'job_submission',
  'listing', 'listing_order', 'market_order', 'market_trade', 'app_config',
  'admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role',
  'currency_status_log', 'content_translation', 'translation_cache',
];
// 代码面被引用、迁移面未建的表（待本轮双口径复核）
const CANDIDATES = ['asset', 'task', 'task_progress', 'prize', 'prize_item', 'shard', 'shard_transfer'];

async function main() {
  // A. 库内真表全集（information_schema，双口径之一：库侧）
  const tabs = await sql<{ table_name: string; table_type: string }>(
    `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  out.db_tables_public = tabs.map((r) => r.table_name);
  out.db_tables_count_public = tabs.length;
  out.db_tables_public_types = Object.fromEntries(tabs.map((r) => [r.table_name, r.table_type]));
  log(`[A] information_schema public 对象数 = ${tabs.length}`);

  const views = await sql<{ table_name: string }>(
    `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`);
  out.db_views_public = views.map((r) => r.table_name);

  // B. 迁移面词法名单 逐名存在性（加引号 + 裸名双路对照）
  const lexicalCheck: Record<string, string | null> = {};
  for (const t of LEXICAL) {
    const r = await sql<{ q: string | null; bare: string | null }>(
      `SELECT to_regclass('public."' || $1 || '"')::text AS q, to_regclass('public.' || $1)::text AS bare`, [t]);
    lexicalCheck[t] = r[0].q;
    if (r[0].q !== r[0].bare) log(`[B] 引号/裸名不一致: ${t} q=${r[0].q} bare=${r[0].bare}`);
  }
  out.lexical_to_regclass = lexicalCheck;
  const lexicalMissing = Object.entries(lexicalCheck).filter(([, v]) => v === null).map(([k]) => k);
  out.lexical_missing_from_db = lexicalMissing;
  log(`[B] 词法 ${LEXICAL.length} 名中库内缺 = ${lexicalMissing.length} [${lexicalMissing.join(',')}]`);

  // C. 候选缺表族 逐名（引号 + 裸名双路）
  const candCheck: Record<string, { quoted: string | null; bare: string | null }> = {};
  for (const t of CANDIDATES) {
    const r = await sql<{ q: string | null; bare: string | null }>(
      `SELECT to_regclass('public."' || $1 || '"')::text AS q, to_regclass('public.' || $1)::text AS bare`, [t]);
    candCheck[t] = { quoted: r[0].q, bare: r[0].bare };
  }
  out.candidate_to_regclass = candCheck;
  log(`[C] 候选 ${CANDIDATES.length} 名：存在 = ${JSON.stringify(candCheck)}`);

  // D. 存量计数（登录半径 / claim 前置）
  out.users_total = String((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public."users"`))[0].n);
  out.account_total = String((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public.account`))[0].n);
  out.account_cid1 = String((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public.account WHERE cid=1`))[0].n);
  const colsOf = async (t: string) => (await sql<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t])).map((r) => r.column_name);
  out.cols_users = await colsOf('users');
  out.cols_account = await colsOf('account');
  const aUidCol = (out.cols_account as string[]).includes('uID') ? 'uID' : ((out.cols_account as string[]).includes('uid') ? 'uid' : null);
  const uUidCol = (out.cols_users as string[]).includes('uID') ? 'uID' : ((out.cols_users as string[]).includes('uid') ? 'uid' : null);
  out.account_uid_column = aUidCol;
  out.users_uid_column = uUidCol;
  if (!aUidCol || !uUidCol) throw new Error('uid 列名无法确定 ⇒ 探针自伤保护');
  out.users_without_cid1_account = String((await sql<{ n: string }>(
    `SELECT count(*)::text AS n FROM public."users" u WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a."${aUidCol}"=u."${uUidCol}" AND a.cid=1)`))[0].n);
  log(`[D] users=${out.users_total} account=${out.account_total} cid1=${out.account_cid1} 无cid1户=${out.users_without_cid1_account} (uidCol: account=${aUidCol} users=${uUidCol})`);

  // E. schema_migration 面（重置键现取）
  const smReg = await sql<{ r: string | null }>(`SELECT to_regclass('public.schema_migration')::text AS r`);
  out.schema_migration_regclass = smReg[0].r;
  if (smReg[0].r) {
    const sm = await sql<{ version: string }>(`SELECT version FROM public.schema_migration ORDER BY version`);
    out.schema_migration_rows = sm.map((r) => r.version);
    out.schema_migration_row_count = String(sm.length);
    out.schema_migration_max = sm.length ? sm[sm.length - 1].version : null;
    log(`[E] schema_migration 行数=${sm.length} 末版=${out.schema_migration_max}`);
  } else {
    out.schema_migration_rows = 'TABLE_ABSENT';
    log('[E] schema_migration 不存在（TABLE_ABSENT）');
  }

  // F. 迁移面文件名（磁盘真源）
  const migDir = path.join(REPO, 'migrations');
  const migFiles = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  out.migration_files = migFiles;
  out.migration_files_count = migFiles.length;
  log(`[F] migrations/*.sql = ${migFiles.length}`);

  // G. 每张**库内真表**行数（只读 count；缺表不走此路）——给「空态/恒错」判定用
  const counts: Record<string, string> = {};
  for (const t of tabs) {
    if (t.table_type !== 'BASE TABLE') continue;
    const r = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public."${t.table_name}"`);
    counts[t.table_name] = String(r[0].n);
  }
  out.table_row_counts = counts;
  log(`[G] 逐表行数已取 ${Object.keys(counts).length} 张`);

  out.hit_branch = HIT_BRANCH;
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'steps.log'), steps.join('\n') + '\n', 'utf8');
  console.log('WROTE', outDir, 'HIT_BRANCH=' + HIT_BRANCH);
}

main().then(() => process.exit(0)).catch((e) => {
  const err = { name: e?.name, code: e?.code, message: e?.message, sourceError: e?.sourceError ? String(e.sourceError) : undefined };
  console.log('PROBE_EXIT=1 ' + JSON.stringify(err));
  try {
    out.error = err; out.hit_branch = HIT_BRANCH;
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(outDir, 'steps.log'), steps.join('\n') + '\n', 'utf8');
  } catch { /* noop */ }
  process.exit(1);
});
