/**
 * ops/uid-renumber-2026-10-24/updown.ts
 * ============================================================================
 * **双向自证**（本单 B1 方向门的证据）：同一事务内 `ur.direction=up` 跑一遍
 * `0076_uid_renumber.sql` 全文，再 `ur.direction=down` 跑**同一份文件**第二遍，
 * 两遍都必须走到文件尾部的「12 steps + 17 judgments all green」；末尾 `ROLLBACK`，
 * 库面必须与开跑前**逐项相等**。
 *
 * 为什么需要它（复核提出的阻断 B1）：
 *   `UR-PRE-5` 与步骤 2c 里原有 4 处「必须 = 9」的断言只在 **up** 方向成立；
 *   apply 之后那 9 行已被删除，回滚（down）时这些断言会 100% 变红 ⇒ 回滚路径不可用。
 *   本脚本就是「apply 之后回滚仍然能跑」的机器证明：不需要真 apply，在同一事务里
 *   先把库推到「apply 后」状态，再原地回滚。
 *
 * 判据（任一不满足即 FAIL，不放宽）：
 *   ① 两遍都出现 `UR_UP_COMPLETED` / `UR_DOWN_COMPLETED` 标记，且 stderr 无 `ERROR:`；
 *   ② 两遍都打印 `direction=up` / `direction=down` 的「all green」收口 NOTICE（17 判负全过）；
 *   ③ 末尾 `ROLLBACK` 已发；回滚后 readings 与开跑前**逐键 JSON 相等**（含 21 个触发器
 *      tgenabled、31 FK 可延迟性、users_uid_seq、schema_migration、public 对象集）；
 *   ④ 显式四断言：`users=194` / `account=141` / `seq` 未漂 / 19 守卫全 `'O'`。
 *
 * 纪律：**绝不 COMMIT**（写死 ROLLBACK + `finally` 补发）；不 `nextval` 探针；不死等锁。
 *
 * 用法：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.scripts.json \
 *     ./node_modules/.bin/ts-node --transpile-only ../ops/uid-renumber-2026-10-24/updown.ts
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
const RUN = process.env.UR_RUN_UP || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

const PSQL = process.env.PSQL
  || (fs.existsSync('/opt/homebrew/opt/libpq/bin/psql') ? '/opt/homebrew/opt/libpq/bin/psql' : 'psql');

const TABLES = [
  'users', 'ledger_entry', 'account', 'ledger_owner', 'currency', 'app_config', 'schema_migration',
  'batt_entry', 'batt_account', 'listing_edit_log', 'campaign_task_reward_pending',
  'admin_ops_audit_log', 'admin_refund_audit_log', 'admin_user_role', 'checkin_log', 'checkin_makeup_log',
  'conversation', 'currency_review_log', 'currency_status_log', 'listing', 'listing_favorite',
  'listing_order', 'listing_order_event', 'listing_review_log', 'market_order', 'market_trade',
  'media', 'message', 'project', 'project_wage_claim', 'project_worker', 'rating', 'referral',
  'subtask_proof', 'user_activity_hour',
];

/** 19 个守卫（14 append-only + 5 额外写闸）：回滚后必须全部 tgenabled='O' */
const GUARDS = [
  'trg_ledger_entry_append_only', 'trg_referral_append_only', 'trg_market_trade_append_only',
  'trg_currency_status_log_append_only', 'trg_admin_ops_audit_log_append_only',
  'trg_admin_refund_audit_log_append_only', 'trg_currency_review_log_append_only',
  'trg_listing_review_log_append_only', 'trg_checkin_log_append_only',
  'trg_checkin_makeup_log_append_only', 'trg_rating_append_only',
  'trg_listing_order_event_append_only', 'trg_listing_edit_log_append_only', 'trg_batt_entry_append_only',
  'trg_admin_user_role_key_immutable', 'trg_conversation_read_mark_only',
  'trg_message_no_update_or_delete', 'trg_listing_order_core_immutable_guard',
  'trg_market_order_core_immutable_guard',
];

type Readings = Record<string, unknown>;

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
  'triggers', (SELECT jsonb_object_agg(tgname, tgenabled::text ORDER BY tgname) FROM pg_trigger
                WHERE NOT tgisinternal
                  AND (tgname LIKE 'trg_%_append_only'
                       OR tgname IN ('trg_batt_account_user_fk', 'trg_account_guard',
                                     'trg_admin_user_role_key_immutable', 'trg_conversation_read_mark_only',
                                     'trg_message_no_update_or_delete',
                                     'trg_listing_order_core_immutable_guard',
                                     'trg_market_order_core_immutable_guard'))),
  'guards_19', (SELECT jsonb_build_object(
      'total', count(*),
      'enabled_O', count(*) FILTER (WHERE tgenabled = 'O'),
      'not_O', coalesce(string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname)
                        FILTER (WHERE tgenabled <> 'O'), ''))
    FROM pg_trigger WHERE NOT tgisinternal
     AND tgname = ANY (ARRAY[${GUARDS.map((g) => `'${g}'`).join(', ')}])),
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

const diffReadings = (a: Readings, b: Readings) => {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const out: { key: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ key: k, before: a[k], after: b[k] });
  return out;
};

const MIGRATION_SHA = crypto.createHash('sha256').update(fs.readFileSync(MIGRATION, 'utf8'), 'utf8').digest('hex');

/** 一个事务：up 全文 → down 全文 → ROLLBACK（写死） */
const buildScript = (): string => `\\set ON_ERROR_STOP off
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';
SET ur.direction = 'up';
\\echo UR_UP_ENTERED
\\i ${MIGRATION}
\\echo UR_UP_COMPLETED
SET ur.direction = 'down';
\\echo UR_DOWN_ENTERED
\\i ${MIGRATION}
\\echo UR_DOWN_COMPLETED
ROLLBACK;
\\echo UR_ROLLBACK_DONE
`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ur-updown-'));
  const pool = mkPool(1);
  const dsn = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL || '';

  const pre = await readAll(pool as unknown as Qx);
  console.log(`[updown] 前置读数：users=${pre.users_count} `
    + `account=${JSON.stringify((pre.account as Record<string, unknown>).rows)} `
    + `seq=${JSON.stringify(pre.seq)} guards19=${JSON.stringify(pre.guards_19)}`);

  const scriptPath = path.join(workdir, 'updown.sql');
  fs.writeFileSync(scriptPath, buildScript(), 'utf8');

  const t0 = Date.now();
  const r = spawnSync(PSQL, [dsn, '-X', '-q', '-f', scriptPath], {
    encoding: 'utf8',
    maxBuffer: 48 * 1024 * 1024,
    env: { ...process.env, PGAPPNAME: 'seafood-uid-renumber-updown' },
  });
  const ms = Date.now() - t0;
  spawnSync(PSQL, [dsn, '-X', '-q', '-c', 'ROLLBACK'], { encoding: 'utf8' });

  const all = `${r.stdout || ''}\n${r.stderr || ''}`;
  const errors = (r.stderr || '').split('\n').filter((l) => /ERROR:/.test(l)).map((l) => l.trim());
  const notices = all.split('\n').filter((l) => /NOTICE:/.test(l)).map((l) => l.trim());

  const upDone = /UR_UP_COMPLETED/.test(all);
  const downDone = /UR_DOWN_COMPLETED/.test(all);
  const rolledBack = /UR_ROLLBACK_DONE/.test(all);
  const upGreen = /12 steps \+ 17 judgments all green \(direction=up\)/.test(all.replace(/\s+/g, ' '));
  const downGreen = /12 steps \+ 17 judgments all green \(direction=down\)/.test(all.replace(/\s+/g, ' '));

  const post = await readAll(pool as unknown as Qx);
  const diffs = diffReadings(pre, post);

  // 显式四断言（复核要求：users 194 / account 141 / seq 未漂 / 19 守卫全 'O'）
  const acct = post.account as Record<string, unknown>;
  const g19 = post.guards_19 as Record<string, unknown>;
  const asserts = {
    users_194: post.users_count === 194,
    account_141: Number(acct?.rows) === 141,
    seq_not_drifted: JSON.stringify(post.seq) === JSON.stringify(pre.seq),
    guards_19_all_O: Number(g19?.total) === 19 && Number(g19?.enabled_O) === 19,
  };

  const report = {
    run: RUN,
    generated_at: new Date().toISOString(),
    script: 'ops/uid-renumber-2026-10-24/updown.ts',
    purpose: 'B1 方向门自证：apply 之后 down（回滚）仍可跑完全程；同一事务 up → down 两遍，末尾 ROLLBACK',
    migration: 'backend-ts/migrations/0076_uid_renumber.sql',
    migration_sha256: MIGRATION_SHA,
    psql: `${PSQL} (${(spawnSync(PSQL, ['--version'], { encoding: 'utf8' }).stdout || '').trim()})`,
    lock_timeout: '5s',
    statement_timeout: '300s',
    commit_committed: false,
    duration_ms: ms,
    psql_exit: r.status,
    phases: {
      up_entered: /UR_UP_ENTERED/.test(all), up_completed: upDone, up_green_notice: upGreen,
      down_entered: /UR_DOWN_ENTERED/.test(all), down_completed: downDone, down_green_notice: downGreen,
      rollback_sent: rolledBack,
    },
    errors,
    first_error: errors[0] ?? null,
    notices,
    lock_timeout_hit: /lock timeout|canceling statement due to lock timeout|55P03/.test(all),
    equality: { passed: diffs.length === 0, keys_total: Object.keys(pre).length, diffs },
    asserts,
    pre_readings: pre,
    post_readings: post,
  };

  const pass = upGreen && downGreen && rolledBack && errors.length === 0
    && diffs.length === 0 && Object.values(asserts).every(Boolean);
  const verdict = [
    `up_all_green=${upGreen}`, `down_all_green=${downGreen}`, `rollback_sent=${rolledBack}`,
    `equality=${diffs.length === 0 ? `PASS(${Object.keys(pre).length}/${Object.keys(pre).length})` : `FAIL(${diffs.length} diffs)`}`,
    `users_194=${asserts.users_194}`, `account_141=${asserts.account_141}`,
    `seq_not_drifted=${asserts.seq_not_drifted}`, `guards_19_all_O=${asserts.guards_19_all_O}`,
    `lock_timeout_hit=${report.lock_timeout_hit}`,
    `PASS=${pass}`,
  ].join(' | ');
  const out = { ...report, verdict };

  const outFile = path.join(OUT_DIR, `updown-${RUN}${pass ? '-green' : '-FAIL'}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[updown] ${verdict}`);
  if (errors.length) console.log(`[updown] first_error: ${errors[0].slice(0, 300)}`);
  console.log(`[updown] 读数落盘：${path.relative(REPO, outFile)}`);

  await pool.end().catch(() => undefined);
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error('[updown] FATAL', e);
  process.exit(2);
});
