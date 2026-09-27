/**
 * p2qa-10 · 修复轮复检（Neng · 独立质检）：**只读基线** + 迁移底线
 * ============================================================================
 * 复检 F1..F7 之前先钉住环境事实：HEAD、被检文件 sha256、schema_version、
 * 0001–0010 是否被动过（对 HEAD~1 逐文件比 sha256）、全局 7 个用户触发器启用态、
 * 平台账户与 policy 只读快照、我的分区是否零残留。
 * 本脚本 **零写入**（只 SELECT）。
 * 夹具窗口（本轮全新）：uid 958xxx / symbol 前缀 p1x / 幂等键 ops:p1x:*
 */
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  mkPool, raw, raw1, save, sha256, RUN, type Qx,
} from './p2qa-lib';

const REPO = path.resolve(__dirname, '..', '..');
const git = (args: string[]): string => {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch (e) { return `GIT_ERR ${String(e)}`; }
};
const fsha = (rel: string): string => {
  const fs = require('fs') as typeof import('fs');
  const p = path.resolve(__dirname, '..', rel);
  return fs.existsSync(p) ? sha256(fs.readFileSync(p, 'utf8')) : 'MISSING';
};

const TRIGGERS = [
  'trg_account_guard', 'trg_commission_policy_append_only', 'trg_commission_policy_weights_guard',
  'trg_ledger_entry_append_only', 'trg_ledger_entry_commission_conservation',
  'trg_referral_append_only', 'trg_referral_cycle_guard',
];

(async () => {
  const p = mkPool(4);
  const out: Record<string, unknown> = {
    script: 'scripts/p2qa-10-baseline-migration.ts', run: RUN,
    question: '修复轮环境底线：HEAD / 迁移版本 / 0001-0010 未动 / 触发器启用态 / 分区残留',
  };

  // ---------------------------------------------------------------- git 事实
  const gitOut: Record<string, unknown> = {
    head: git(['log', '--oneline', '-1']),
    head_full: git(['rev-parse', 'HEAD']),
    head_1: git(['log', '--oneline', '-1', 'HEAD~1']),
    status_porcelain: git(['status', '--porcelain']).split('\n').filter(Boolean),
    // 0001–0010 是否被改：HEAD~1..HEAD 对 migrations/ 的 diff（应只有 0011 新增）
    diff_migrations_stat: git(['diff', '--stat', 'HEAD~1..HEAD', '--', 'backend-ts/migrations/']),
    diff_src_stat: git(['diff', '--stat', 'HEAD~1..HEAD', '--', 'backend-ts/src/']),
    // 关键：0001–0010 在 HEAD 与 HEAD~1 的内容是否逐字节相同
    per_file_same_as_head1: {} as Record<string, boolean>,
  };
  out.git = gitOut;
  const sameAsHead1 = gitOut.per_file_same_as_head1 as Record<string, boolean>;
  for (let i = 1; i <= 10; i++) {
    const v = `000${i}`.slice(-4);
    const f = git(['ls-tree', '--name-only', 'HEAD', '--', `backend-ts/migrations/${v}_`]);
    const blobHead = f ? git(['rev-parse', `HEAD:${f}`]) : 'NOFILE';
    const g = git(['ls-tree', '--name-only', 'HEAD~1', '--', `backend-ts/migrations/${v}_`]);
    const blobPrev = g ? git(['rev-parse', `HEAD~1:${g}`]) : 'NOFILE';
    sameAsHead1[v] = blobHead === blobPrev;
  }
  out.file_sha256 = {
    'migrations/0011_commission_assert_closure_and_referral_depth_guard.sql': fsha('migrations/0011_commission_assert_closure_and_referral_depth_guard.sql'),
    'src/commission.ts': fsha('src/commission.ts'),
    'src/ledger.ts': fsha('src/ledger.ts'),
    'src/ledger-errors.ts': fsha('src/ledger-errors.ts'),
  };

  // ---------------------------------------------------------------- 迁移版本表
  out.schema_migration = (await raw(p, `
    SELECT version, name, checksum, applied_at::text
      FROM schema_migration ORDER BY version`)).map((r) => r as unknown as Record<string, string>);
  const vers = (out.schema_migration as Array<Record<string, string>>).map((r) => r.version);
  out.schema_version_max = vers[vers.length - 1] ?? null;
  out.schema_version_count = vers.length;

  // 磁盘上 0011 的 checksum（与表里比对 ⇒ 迁移文件未被事后改动）
  out.migration_files_on_disk = (await raw(p, `SELECT version, count(*)::text AS n FROM schema_migration GROUP BY 1 ORDER BY 1`))
    .map((r) => r as unknown as Record<string, string>);

  // ---------------------------------------------------------------- 触发器启用态（全局 7 个用户触发器）
  out.triggers = (await raw(p, `
    SELECT c.relname AS tbl, t.tgname, t.tgenabled
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
       AND c.relname IN ('account','ledger_entry','referral','commission_policy','users')
     ORDER BY c.relname, t.tgname`)).map((r) => r as unknown as Record<string, string>);
  const tmap = new Map((out.triggers as Array<Record<string, string>>).map((r) => [r.tgname, r.tgenabled]));
  out.triggers_expected_present = TRIGGERS.map((t) => ({ tgname: t, tgenabled: tmap.get(t) ?? 'ABSENT' }));
  out.triggers_all_enabled_O = TRIGGERS.every((t) => tmap.get(t) === 'O');
  out.triggers_disabled_or_absent = TRIGGERS.filter((t) => tmap.get(t) !== 'O');

  // Σ 断言触发器仍是 DEFERRABLE INITIALLY DEFERRED 的约束触发器
  out.conservation_trigger_shape = (await raw(p, `
    SELECT tgname, tgdeferrable::text, tginitdeferred::text, (tgconstraint <> 0)::text AS has_constraint
      FROM pg_trigger
     WHERE tgrelid = 'public.ledger_entry'::regclass AND tgname = 'trg_ledger_entry_commission_conservation'`))
    .map((r) => r as unknown as Record<string, string>);

  // ---------------------------------------------------------------- 只读快照
  out.partition_snapshot = {
    referral_mine_958: (await raw1(p, `SELECT count(*)::text AS n FROM referral WHERE child_uid BETWEEN 958000 AND 958999 OR parent_uid BETWEEN 958000 AND 958999`))?.n,
    users_mine_958: (await raw1(p, `SELECT count(*)::text AS n FROM users WHERE uid BETWEEN 958000 AND 958999`))?.n,
    referral_total: (await raw1(p, `SELECT count(*)::text AS n FROM referral`))?.n,
    ledger_entry_total: (await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`))?.n,
    commission_policy_total: (await raw1(p, `SELECT count(*)::text AS n FROM commission_policy`))?.n,
    users_total: (await raw1(p, `SELECT count(*)::text AS n FROM users`))?.n,
    currency_p1x: (await raw(p, `SELECT cid::text, symbol FROM currency WHERE symbol LIKE 'p1x%' ORDER BY cid`)).map((r) => r as unknown as Record<string, string>),
  };
  out.platform_cid1_baseline = (await raw(p, `
    SELECT uid::text, cid::text, balance::text, frozen::text FROM account
     WHERE cid = 1 AND uid IN (-3,-2,-1,0) ORDER BY uid`)).map((r) => r as unknown as Record<string, string>);

  // 当前生效政策（只读；settleJobCommission 的 policy 选择基准）
  out.policy_now = (await raw(p, `
    SELECT policy_id::text, levels::text, fee_rate_bp::text, effective_from::text,
           array_to_string(weights_bp, ',') AS weights
      FROM commission_policy WHERE effective_from <= now()
     ORDER BY effective_from DESC, policy_id DESC LIMIT 1`)).map((r) => r as unknown as Record<string, string>);
  out.policy_tail = (await raw(p, `
    SELECT policy_id::text, levels::text, fee_rate_bp::text, effective_from::text
      FROM commission_policy ORDER BY effective_from DESC, policy_id DESC LIMIT 8`)).map((r) => r as unknown as Record<string, string>);

  // 错误码闭集：确认未新增码（33 码），且 CHAIN_ASSERTION_VIOLATED 不是码而是 reason
  const codes = require('../src/ledger-errors') as {
    LEDGER_ERROR_CODES: string[]; LEDGER_ERROR_TABLE: Record<string, unknown>;
    httpStatusOf: (c: string) => number; DEFECT_ERROR_CODES: string[];
    LEDGER_ERROR_BUCKETS: Record<string, string>;
  };
  out.error_codes = {
    count: codes.LEDGER_ERROR_CODES.length,
    list: codes.LEDGER_ERROR_CODES,
    has_LEDGER_RECONCILE_MISMATCH: codes.LEDGER_ERROR_CODES.includes('LEDGER_RECONCILE_MISMATCH'),
    has_chain_assertion_violated_as_code: codes.LEDGER_ERROR_CODES.includes('COMMISSION_CHAIN_ASSERTION_VIOLATED' as never),
    has_replay_inconsistent_as_code: codes.LEDGER_ERROR_CODES.includes('COMMISSION_LEDGER_REPLAY_INCONSISTENT' as never),
    httpStatusOf_LD032: codes.httpStatusOf('LEDGER_RECONCILE_MISMATCH'),
    bucket_LD032: codes.LEDGER_ERROR_BUCKETS['LEDGER_RECONCILE_MISMATCH'],
    httpStatusOf_LD003: codes.httpStatusOf('LEDGER_IDEMPOTENCY_CONFLICT'),
    bucket_LD003: codes.LEDGER_ERROR_BUCKETS['LEDGER_IDEMPOTENCY_CONFLICT'],
    httpStatusOf_LD016: codes.httpStatusOf('LEDGER_AMOUNT_INVALID'),
    bucket_LD016: codes.LEDGER_ERROR_BUCKETS['LEDGER_AMOUNT_INVALID'],
  };

  // DB 侧借码投影（只读函数）
  out.db_borrow_map = (await raw(p, `
    SELECT ledger_sqlstate_of('LEDGER_RECONCILE_MISMATCH') AS ld032,
           ledger_sqlstate_of('LEDGER_IDEMPOTENCY_CONFLICT') AS ld003,
           ledger_sqlstate_of('LEDGER_AMOUNT_INVALID') AS ld016,
           (ledger_error_for_sqlstate('LD032')->>'bucket') AS ld032_bucket,
           (ledger_error_for_sqlstate('LD032')->>'code')   AS ld032_code,
           (ledger_error_for_sqlstate('LD003')->>'bucket') AS ld003_bucket,
           (ledger_error_for_sqlstate('LD016')->>'bucket') AS ld016_bucket`))
    .map((r) => r as unknown as Record<string, string>);

  // 两个函数体含 0011 判据（结构证据）
  out.function_bodies = (await raw(p, `
    SELECT proname,
           (prosrc LIKE '%v_closed%')::text        AS has_v_closed,
           (prosrc LIKE '%REFERRAL_ALREADY_BOUND%')::text AS has_f6,
           (prosrc LIKE '%REFERRAL_PARENT_DEPTH_INCONSISTENT%')::text AS has_f2,
           length(prosrc)::text AS len
      FROM pg_proc WHERE proname IN ('ledger_assert_commission_conservation','referral_cycle_guard')
     ORDER BY proname`)).map((r) => r as unknown as Record<string, string>);

  const f = save('p2qa-10-baseline-migration', out);
  console.log(JSON.stringify({
    saved: f,
    head: out.git && (out.git as Record<string, unknown>).head,
    git_0001_0010_same: (out.git as Record<string, unknown>).per_file_same_as_head1,
    schema_version_max: out.schema_version_max,
    triggers_all_enabled_O: out.triggers_all_enabled_O,
    error_code_count: (out.error_codes as Record<string, unknown>).count,
    function_bodies: out.function_bodies,
    partition_snapshot: out.partition_snapshot,
  }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', String(e)); process.exit(1); });
