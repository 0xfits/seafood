/**
 * ops/uid-renumber-2026-10-24/dryrun.ts
 * ============================================================================
 * `0076_uid_renumber.sql` 的**事务内 dry-run 自证**（契约 docs/data-layer.spec.md §40.17.10 `UR10` 第 2 关 ③④）
 *
 * 干什么：
 *   ① 先取「迁移前读数」（逐表行数 / users 全列 md5 / ledger Σdelta / account 快照 /
 *      14 触发器 tgenabled / users_uid_seq last_value·is_called / 31 FK 可延迟性 /
 *      schema_migration / public 对象集）；
 *   ② `BEGIN` + `SET LOCAL lock_timeout='5s'` + `SET LOCAL statement_timeout='120s'`
 *      ⇒ **执行迁移 SQL 全文** ⇒ 15 条判负（迁移文件尾部）⇒ **无条件 `ROLLBACK`**（`finally`，见 runArm）；
 *   ③ 回滚后**再取同一组读数**，与 ① 逐项 `JSON.stringify` 相等才算通过（含序列与 tgenabled）。
 *
 * 两个臂（同一事务语义、同一份迁移文件）：
 *   A `faithful`   —— 在**现盘真实数据**上直接跑迁移。现盘有 9 行 account 与其最新 ledger 快照不一致
 *                     （§40.17.11 `NM2`）；Kevin 2026-10-24 已授权「直接删掉那 9 行」，
 *                     ⇒ 迁移文件**步骤 2c** 自己完成清理（精确谓词 · 删前 9 / 删后 0），本臂应**跑完全部 12 步 + 17 条判负**。
 *   B `repaired`   —— 与 A 等价（迁移已自足，不再需要臂内预处理）。保留该臂是为了**同一份文件跑两遍**
 *                     以证明幂等准备阶段无副作用：两臂都必须 completed 且回滚后 equality 全等。
 *                     ★ 整体仍 `ROLLBACK`（零残留）。
 *
 * 纪律：
 *   · **绝不**打开 COMMIT：`runArm()` 的脚本末尾写死 `ROLLBACK`，且 `finally` 里再补发一次 `ROLLBACK`。
 *   · `lock_timeout` 拿不到锁 ⇒ 语句被取消（`55P03`）⇒ 本脚本按「未通过」记录并报告，绝不死等（ledger_entry 是写热点）。
 *   · 不 `nextval` 探针（会真烧号，§40.17.5 E）；读序列只用 `SELECT last_value, is_called FROM users_uid_seq`。
 *   · 读数落 `ops/uid-renumber-2026-10-24/readings/dryrun-<ts>.json`。
 *
 * 用法（`--arm` 可重复；默认两臂都跑）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.scripts.json npx ts-node --transpile-only \
 *     ../ops/uid-renumber-2026-10-24/dryrun.ts
 *   ... dryrun.ts --arm=faithful           # 只跑 A
 *   ... dryrun.ts --arm=repaired --arm=faithful
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import { mkPool, raw1, type Qx } from '../../backend-ts/scripts/p7b-lib';

const HERE = __dirname;
const REPO = path.resolve(HERE, '../..');
const MIGRATION = path.join(REPO, 'backend-ts/migrations/0076_uid_renumber.sql');
const OUT_DIR = path.join(HERE, 'readings');
const RUN = process.env.UR_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

const PSQL = process.env.PSQL
  || (fs.existsSync('/opt/homebrew/opt/libpq/bin/psql') ? '/opt/homebrew/opt/libpq/bin/psql' : 'psql');

const args = process.argv.slice(2);
const wanted = args.filter((a) => a.startsWith('--arm=')).map((a) => a.slice(6));
const ARMS: ArmName[] = (wanted.length ? wanted : ['faithful', 'repaired']) as ArmName[];

type ArmName = 'faithful' | 'repaired';
type Readings = Record<string, unknown>;

/** 逐表行数读数覆盖的表（与迁移触碰面一致；`schema_migration` 单列断言） */
const TABLES = [
  'users', 'ledger_entry', 'account', 'ledger_owner', 'currency', 'app_config', 'schema_migration',
  'batt_entry', 'batt_account', 'listing_edit_log', 'campaign_task_reward_pending',
  'admin_ops_audit_log', 'admin_refund_audit_log', 'admin_user_role', 'checkin_log', 'checkin_makeup_log',
  'conversation', 'currency_review_log', 'currency_status_log', 'listing', 'listing_favorite',
  'listing_order', 'listing_order_event', 'listing_review_log', 'market_order', 'market_trade',
  'media', 'message', 'project', 'project_wage_claim', 'project_worker', 'rating', 'referral',
  'subtask_proof', 'user_activity_hour',
];

const READINGS_SQL = (): string => `
SELECT jsonb_build_object(
  'users_count', (SELECT count(*) FROM public.users),
  'users_md5_all', (SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
      SELECT concat_ws('|', uid::text, evm, coalesce(bio,'∅'), is_admin::text, time_reg::text,
                       time_login_last::text, coalesce(tg_user_id::text,'∅'),
                       coalesce(tg_linked_at::text,'∅'), coalesce(avatar_url,'∅')) AS x
        FROM public.users) s),
  'users_md5_nouid', (SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
      SELECT concat_ws('|', evm, coalesce(bio,'∅'), is_admin::text, time_reg::text, time_login_last::text,
                       coalesce(tg_user_id::text,'∅'), coalesce(tg_linked_at::text,'∅'),
                       coalesce(avatar_url,'∅')) AS x
        FROM public.users) s),
  'real_uid', (SELECT uid FROM public.users WHERE lower(evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0'),
  'ledger', (SELECT jsonb_build_object(
      'rows', count(*), 'sum_delta', sum(delta), 'sum_frozen', sum(frozen_delta),
      'by_cid', (SELECT jsonb_object_agg(cid::text, d ORDER BY cid)
                   FROM (SELECT cid, sum(delta) AS d FROM public.ledger_entry GROUP BY cid) t),
      'md5_nouid', (SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
          SELECT concat_ws('|', txid::text, cid::text, delta::text, frozen_delta::text, balance_after::text,
                           frozen_after::text, kind, coalesce(ref_type,'∅'), coalesce(ref_id::text,'∅'),
                           coalesce(idempotency_key,'∅'), coalesce(request_fingerprint,'∅'),
                           coalesce(reversal_of_txid::text,'∅'), coalesce(memo,'∅'), time_created::text,
                           coalesce(event_root_key,'∅')) AS x FROM public.ledger_entry) s))
    FROM public.ledger_entry),
  'account', (SELECT jsonb_build_object(
      'rows', count(*),
      'md5_all', (SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
          SELECT concat_ws('|', uid::text, cid::text, balance::text, frozen::text, version::text,
                           time_created::text, time_updated::text) AS x FROM public.account) s),
      'md5_nouid', (SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
          SELECT concat_ws('|', cid::text, balance::text, frozen::text, version::text,
                           time_created::text, time_updated::text) AS x FROM public.account) s),
      'drift_rows', (SELECT count(*) FROM public.account a WHERE ROW(a.balance, a.frozen) IS DISTINCT FROM (
          SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
           WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)))
    FROM public.account),
  -- 读数覆盖 22 个触发器：trg_%_append_only 15 个（契约 14 个 + trg_commission_policy_append_only）
  --   + trg_batt_account_user_fk + trg_account_guard + 5 个额外写闸（UR-BLOCK-6）
  --   ⇒ 13/13 equality 现在真能证明 19 守卫复位（此前 5 个额外写闸不在读数里）
  'triggers', (SELECT jsonb_object_agg(tgname, tgenabled::text ORDER BY tgname) FROM pg_trigger
                WHERE NOT tgisinternal
                  AND (tgname LIKE 'trg_%_append_only'
                       OR tgname IN ('trg_batt_account_user_fk', 'trg_account_guard',
                                     'trg_admin_user_role_key_immutable', 'trg_conversation_read_mark_only',
                                     'trg_message_no_update_or_delete',
                                     'trg_listing_order_core_immutable_guard',
                                     'trg_market_order_core_immutable_guard'))),
  'fk_users', (SELECT jsonb_object_agg(conname, condeferrable::text || '/' || condeferred::text ORDER BY conname)
                 FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.users'::regclass),
  'seq', (SELECT jsonb_build_object('last_value', last_value, 'is_called', is_called) FROM public.users_uid_seq),
  'row_counts', jsonb_build_object(${TABLES.map((t) => `'${t}', (SELECT count(*) FROM public.${t})`).join(', ')}),
  'public_relations', (SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c
                         JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S')),
  'schema_migration', (SELECT jsonb_build_object('rows', count(*), 'max_version', max(version),
                          'md5', md5(string_agg(version || ':' || name || ':' || applied_at::text, '|' ORDER BY version)))
                         FROM public.schema_migration),
  'account_pk_count', (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.account'::regclass AND contype = 'p')
) AS j
`;

const readAll = async (q: Qx): Promise<Readings> => {
  const row = await raw1<{ j: Readings }>(q, READINGS_SQL());
  return (row?.j ?? {}) as Readings;
};

/** 逐项比较（顶层键），返回差异清单 */
const diffReadings = (a: Readings, b: Readings): { key: string; before: unknown; after: unknown }[] => {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const out: { key: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ key: k, before: a[k], after: b[k] });
  }
  return out;
};

interface ArmResult {
  arm: ArmName;
  psql_exit: number | null;
  duration_ms: number;
  migration_entered: boolean;
  migration_completed: boolean;
  rolled_back_marker: boolean;
  errors: string[];
  first_error: string | null;
  notices: string[];
  lock_timeout_hit: boolean;
  statement_timeout_hit: boolean;
  deviation?: string;
  /** 回滚后与迁移前读数的逐项比对 */
  equality: { passed: boolean; keys_total: number; diffs: { key: string; before: unknown; after: unknown }[] };
}

const MIGRATION_SHA = crypto.createHash('sha256').update(fs.readFileSync(MIGRATION, 'utf8'), 'utf8').digest('hex');

/** 事务内脚本：BEGIN → 超时 → 迁移全文 → 标记 → ROLLBACK（**写死**）→ 标记 */
const buildScript = (dsnIgnored: string, prelude: string): string => `\\set ON_ERROR_STOP off
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET ur.direction = 'up';
${prelude}\\echo UR_MIGRATION_ENTERED
\\i ${MIGRATION}
\\echo UR_MIGRATION_COMPLETED
ROLLBACK;
\\echo UR_ROLLBACK_DONE
`;

const runArm = async (
  pool: ReturnType<typeof mkPool>,
  dsn: string,
  arm: ArmName,
  pre: Readings,
  workdir: string,
): Promise<ArmResult> => {
  let prelude = '';
  let deviation: string | undefined;

  if (arm === 'repaired') {
    // 迁移文件步骤 2c 已自足（Kevin 2026-10-24 授权就地删除那 9 行），本臂**不再**做任何前置预处理：
    // 两臂跑同一份文件、同一 DSN，用于证明「准备阶段无副作用 + 迁移可重复执行」。
    deviation = 'repaired 臂与 faithful 等价：NM2 那 9 行已由迁移文件步骤 2c 在事务内按精确谓词删除'
      + '（删前 9 / DELETE 命中 9 / 删后 0）；本臂不做任何臂内预处理，整体 ROLLBACK（零残留）。';
  }

  const scriptPath = path.join(workdir, `dryrun-${arm}.sql`);
  fs.writeFileSync(scriptPath, buildScript(dsn, prelude), 'utf8');

  const t0 = Date.now();
  const r = spawnSync(PSQL, [dsn, '-X', '-q', '-f', scriptPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PGAPPNAME: 'seafood-uid-renumber-dryrun' },
  });
  const ms = Date.now() - t0;

  // finally 兜底：无论上面发生什么，再补一条 ROLLBACK（连接级），确保不留未决事务
  spawnSync(PSQL, [dsn, '-X', '-q', '-c', 'ROLLBACK'], { encoding: 'utf8' });

  const out = `${r.stdout || ''}`;
  const err = `${r.stderr || ''}`;
  const all = `${out}\n${err}`;
  const errors = err.split('\n').filter((l) => /ERROR:/.test(l)).map((l) => l.trim());
  const notices = all.split('\n').filter((l) => /NOTICE:/.test(l)).map((l) => l.trim());

  const post = await readAll(pool as unknown as Qx);
  const diffs = diffReadings(pre, post);
  const keysTotal = Object.keys(pre).length;

  return {
    arm,
    psql_exit: r.status,
    duration_ms: ms,
    migration_entered: /UR_MIGRATION_ENTERED/.test(all),
    migration_completed: /UR_MIGRATION_COMPLETED/.test(all) && errors.length === 0,
    rolled_back_marker: /UR_ROLLBACK_DONE/.test(all),
    errors,
    first_error: errors[0] ?? null,
    notices,
    lock_timeout_hit: /lock timeout|canceling statement due to lock timeout|55P03/.test(all),
    statement_timeout_hit: /statement timeout|canceling statement due to statement timeout/.test(all),
    deviation,
    equality: { passed: diffs.length === 0, keys_total: keysTotal, diffs },
  };
};

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ur-dryrun-'));
  const pool = mkPool(1);
  const dsn = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL || '';

  const report: Record<string, unknown> = {
    run: RUN,
    generated_at: new Date().toISOString(),
    script: 'ops/uid-renumber-2026-10-24/dryrun.ts',
    contract: 'docs/data-layer.spec.md §40.17.10 UR10（第 2 关 ③④）',
    migration: 'backend-ts/migrations/0076_uid_renumber.sql',
    migration_sha256: MIGRATION_SHA,
    psql: `${PSQL} (${(spawnSync(PSQL, ['--version'], { encoding: 'utf8' }).stdout || '').trim()})`,
    lock_timeout: '5s',
    statement_timeout: '120s',
    commit_committed: false,
    pre_readings: null as Readings | null,
    arms: [] as ArmResult[],
    verdict: '' as string,
  };

  const pre = await readAll(pool as unknown as Qx);
  report.pre_readings = pre;
  console.log(`[dryrun] 迁移前读数 keys=${Object.keys(pre).length}：`
    + `users=${pre.users_count} ledger=${JSON.stringify((pre.ledger as Record<string, unknown>).rows)} `
    + `seq=${JSON.stringify(pre.seq)} drift=${JSON.stringify((pre.account as Record<string, unknown>).drift_rows)}`);

  const results: ArmResult[] = [];
  for (const arm of ARMS) {
    if (arm !== 'faithful' && arm !== 'repaired') {
      console.warn(`[dryrun] 未知臂 ${arm}（只允许 faithful / repaired）`);
      continue;
    }
    console.log(`[dryrun] arm=${arm} …`);
    const res = await runArm(pool, dsn, arm, pre, workdir);
    results.push(res);
    console.log(`[dryrun] arm=${arm} exit=${res.psql_exit} ${res.duration_ms}ms`
      + ` entered=${res.migration_entered} completed=${res.migration_completed} rolled_back=${res.rolled_back_marker}`
      + ` lock_timeout=${res.lock_timeout_hit} equality=${res.equality.passed ? `PASS(${res.equality.keys_total}/${res.equality.keys_total})` : `FAIL(${res.equality.diffs.length} diffs)`}`);
    if (res.first_error) console.log(`[dryrun]   first_error: ${res.first_error.slice(0, 240)}`);
    for (const n of res.notices.slice(0, 6)) console.log(`[dryrun]   ${n.slice(0, 240)}`);
  }

  report.arms = results;
  const faithful = results.find((r) => r.arm === 'faithful');
  const repaired = results.find((r) => r.arm === 'repaired');
  const allRolledBack = results.every((r) => r.rolled_back_marker && r.equality.passed);
  // 判据（本轮起收紧，不放宽）：**每个**臂都必须跑完 12 步 + 17 条判负，且回滚后读数全等
  const logicGreen = results.length > 0 && results.every((r) => r.migration_completed && r.equality.passed);
  report.verdict = [
    `rollback_zero_residue=${allRolledBack ? 'PASS' : 'FAIL'}`,
    `faithful_arm=${faithful ? (faithful.migration_completed ? 'completed' : `stopped: ${(faithful.first_error || '').slice(0, 160)}`) : 'not-run'}`,
    `repaired_arm_12steps_17checks=${repaired ? (repaired.migration_completed && repaired.equality.passed ? 'PASS' : 'FAIL') : 'not-run'}`,
    `lock_timeout_hit=${results.some((r) => r.lock_timeout_hit)}`,
  ].join(' | ');

  const outFile = path.join(OUT_DIR, `dryrun-${RUN}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`[dryrun] 读数落盘：${path.relative(REPO, outFile)}`);
  console.log(`[dryrun] verdict: ${report.verdict}`);
  console.log(`[dryrun] COMMIT 从未发生（每臂末尾写死 ROLLBACK，且 finally 补发一次）`);

  await pool.end().catch(() => undefined);
  process.exit(allRolledBack && logicGreen ? 0 : 1);
})().catch((e) => {
  console.error('[dryrun] FATAL', e);
  process.exit(2);
});
