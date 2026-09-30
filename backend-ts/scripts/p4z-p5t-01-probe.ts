// p4z-p5t-01-probe.ts — P5-TRIAGE **只读取数**（不写库、不发写请求、不改码）
// ============================================================================
// 目的（本单 §1/§5/§6）：
//   ① 复核 7 个「代码引用 ∖ 迁移建表」名在库内是否存在（`to_regclass`，逐名）；
//   ② **登录主路径爆炸半径**：`POST /api/auth/verify`（src/index.ts:354→:358）
//      在 `getUserAsset() || upsertAsset()` 短路处的落点 —— 即「有 cid=1 account 行的用户」
//      vs「无 cid=1 account 行的用户」各多少（后者必走 `upsertAsset` ⇒ 42P01 ⇒ 401）；
//   ③ 同法给 `POST /api/task-progress/claim/:jID`（:635→:659/:670）的同族读数；
//   ④ `task_progress` 现存行数（claim 面能否有数据流 = 前置）；
//   ⑤ schema 自曝：`users` / `account` 的列名（避免探针自伤，§5.7 ③）。
// 口径（§5.7）：只 `SELECT` / `information_schema`；退出码取自命令本身、非管道之后；
//               `user`/`users` 保留字**一律加引号**。
// 用法：
//   node --dns-result-order=ipv4first node_modules/.bin/ts-node --transpile-only \
//        scripts/p4z-p5t-01-probe.ts <outDirAbs>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'p5triage-probe'));
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

// 0.6.1 自适应：neon() 无 .query ⇒ 依次尝试；**打印实际命中分支**（P4 单 N4 未测项）
let HIT_BRANCH = 'UNKNOWN';
const run = async (q: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
  const anySql = sqlRaw as unknown as {
    (t: string, p?: unknown[]): Promise<unknown[]>;
    query?: (t: string, p?: unknown[]) => Promise<unknown[]>;
    unsafe?: (t: string, p?: unknown[]) => Promise<unknown[]>;
  };
  if (typeof anySql.query === 'function') {
    HIT_BRANCH = 'sql.query';
    return (await anySql.query(q, params)) as Record<string, unknown>[];
  }
  if (typeof anySql.unsafe === 'function' && params.length) {
    HIT_BRANCH = 'sql.unsafe';
    return (await anySql.unsafe(q, params)) as Record<string, unknown>[];
  }
  HIT_BRANCH = 'sql(text,params)';
  return (await anySql(q, params)) as Record<string, unknown>[];
};
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []): Promise<T[]> => {
  let last: unknown;
  for (let i = 0; i < 5; i++) {
    try {
      return (await run(q, params)) as T[];
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw last;
};

const out: Record<string, unknown> = { run_tag: path.basename(outDir), started: new Date().toISOString() };
const steps: string[] = [];

(async () => {
  const push = (s: string) => {
    steps.push(s);
    console.log(`[p5t] ${s}`);
  };

  // ① 七个缺表名 + 同族旁证名 —— to_regclass 逐名
  const NAMES = [
    'asset',
    'task',
    'task_progress',
    'prize',
    'prize_item',
    'shard',
    'shard_transfer',
    'schema_migration',
    'users',
    'account',
    'ledger_entry',
    'listing',
    'listing_order',
  ];
  const reg: Record<string, string | null> = {};
  for (const n of NAMES) {
    const rows = await sql<{ c: string | null }>(`SELECT to_regclass('public.${n}')::text AS c`);
    reg[n] = rows[0]?.c ?? null;
    push(`to_regclass(public.${n}) => ${reg[n] === null ? 'NULL (NOT EXISTS)' : reg[n]}`);
  }
  out.to_regclass = reg;

  // ⑤ schema 自曝：两表的列名（避免 reserved-word 自伤）
  const cols = async (t: string) =>
    (
      await sql<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t],
      )
    ).map((r) => `${r.column_name}:${r.data_type}`);
  const colsUsers = await cols('users');
  const colsAccount = await cols('account');
  const colsLedger = await cols('ledger_entry');
  push(`users columns = ${colsUsers.join(', ')}`);
  push(`account columns = ${colsAccount.join(', ')}`);
  out.columns = { users: colsUsers, account: colsAccount, ledger_entry: colsLedger };

  // ② 登录主路径爆炸半径：有 / 无 cid=1 account 行的用户数
  const tUsers = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public."users"`);
  const tAccCid1 = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public.account WHERE "cid" = 1`);
  const tAccAll = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public.account`);
  const noAcc = await sql<{ n: string }>(
    `SELECT count(*)::text AS n FROM public."users" u
      WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a."uid" = u."uid" AND a."cid" = 1)`,
  );
  out.users_total = tUsers[0]?.n ?? null;
  out.account_rows_total = tAccAll[0]?.n ?? null;
  out.account_rows_cid1 = tAccCid1[0]?.n ?? null;
  out.users_without_cid1_account = noAcc[0]?.n ?? null;
  push(`users_total=${out.users_total} account_rows_total=${out.account_rows_total} account_cid1=${out.account_rows_cid1} users_without_cid1_account=${out.users_without_cid1_account}`);

  // ②b 逐用户样本（现取前 10 行，佐证短路落点）
  const sample = await sql(
    `SELECT u."uid"::text AS uid,
            (SELECT count(*)::text FROM public.account a WHERE a."uid" = u."uid" AND a."cid" = 1) AS cid1_rows
       FROM public."users" u ORDER BY u."uid" LIMIT 10`,
  );
  out.per_user_sample = sample;
  push(`per_user_sample = ${JSON.stringify(sample)}`);

  // ④ task_progress 现存行数（claim 面数据流前置）
  const tpExists = reg['task_progress'] !== null;
  const tp = tpExists
    ? await sql<{ n: string }>(`SELECT count(*)::text AS n FROM public.task_progress`)
    : [{ n: 'TABLE_ABSENT' }];
  out.task_progress_rowcount = tp[0]?.n ?? null;
  push(`task_progress_rowcount = ${out.task_progress_rowcount}`);

  // ③ claim 面：有多少 user 会在 :659/:670 落进 upsertAsset
  out.claim_upsert_reach = {
    note: 'upsertAsset 内部两分支（UPDATE asset / INSERT INTO asset）**均**指向缺表 ⇒ 只要被调到必 42P01',
    path_659_already_claimed_users: '= users_without_cid1_account（同口径短路）',
    path_670_first_claim: '无条件调用 upsertAsset(:670) ⇒ 恒 42P01',
  };

  // ⑤b 账本侧旁证（说明 A1 已接账本、与 asset 脱钩后 §1.3#1 的现状）
  const lp = await sql<{ n: string }>(
    `SELECT count(*)::text AS n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname='public' AND p.proname IN ('ledger_post_event','ledger_assert_platform_mutation')`,
  );
  out.ledger_functions_on_disk = lp[0]?.n ?? null;
  push(`ledger functions on disk = ${out.ledger_functions_on_disk}`);

  out.hit_branch = HIT_BRANCH;
  out.steps = steps;
  out.finished = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(outDir, 'steps.log'), steps.join('\n'));
  console.log(`[p5t] wrote ${path.join(outDir, 'results.json')} (hit_branch=${HIT_BRANCH})`);
})().catch((e) => {
  console.error('[p5t] FAILED:', e);
  fs.writeFileSync(
    path.join(outDir, 'results.json'),
    JSON.stringify({ error: String(e), steps, hit_branch: HIT_BRANCH }, null, 2),
  );
  // 退出码取自异常本身（非管道之后）
  process.exitCode = 1;
});
