/**
 * p2qa-00 · 底线读数（独立质检 Neng）
 * ① HEAD / 服务端版本；② 全局触发器启用态普查；③ append-only 是否仍生效；
 * ④ 图与账本不变量基线；⑤ 基线指纹（供「已复原」证明）；
 * ⑥ 平台账户余额只读快照（严禁改）。
 * 用法：npx ts-node --transpile-only scripts/p2qa-00-baseline.ts
 */
import { mkPool, raw, raw1, save, git, REPO, sha256, errInfo, inRollbackTx, RUN } from './p2qa-lib';

(async () => {
  const p = mkPool(4);
  const out: Record<string, unknown> = { script: 'scripts/p2qa-00-baseline.ts', run: RUN };

  // ---------------------------------------------------------------- ① 环境 / HEAD
  out.env = {
    head: git(REPO, ['log', '--oneline', '-1']),
    head_full: git(REPO, ['rev-parse', 'HEAD']),
    status_porcelain: git(REPO, ['status', '--porcelain']),
    pg: await raw1<{ v: string }>(p, 'SELECT version() AS v'),
    db_now: await raw1<{ t: string }>(p, `SELECT now()::text AS t`),
  };

  // ---------------------------------------------------------------- ② 触发器普查（非 internal）
  out.triggers = await raw(p, `
    SELECT c.relname AS tbl, t.tgname, t.tgenabled, t.tgtype,
           CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
           p.proname AS fn, t.tgconstraint <> 0 AS is_constraint, t.tgdeferrable AS deferrable
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE NOT t.tgisinternal AND n.nspname = 'public'
     ORDER BY c.relname, t.tgname`);
  const disabled = (out.triggers as Array<Record<string, string>>).filter((t) => t.tgenabled !== 'O');
  out.triggers_disabled = disabled;
  out.triggers_all_enabled = disabled.length === 0;

  // ---------------------------------------------------------------- ③ append-only 三表（事务内回滚）
  const ap = async (tbl: string): Promise<Record<string, unknown>> => {
    const upd = await inRollbackTx(p, async (c) => {
      const r = await c.query(`UPDATE ${tbl} SET ${tbl === 'ledger_entry' ? 'memo = memo' : 'depth = depth'}
                                WHERE ctid IN (SELECT ctid FROM ${tbl} LIMIT 1) RETURNING 1`);
      return r.rows.length;
    });
    const del = await inRollbackTx(p, async (c) => {
      const r = await c.query(`DELETE FROM ${tbl} WHERE ctid IN (SELECT ctid FROM ${tbl} LIMIT 1) RETURNING 1`);
      return r.rows.length;
    });
    return {
      update: upd.error ? errInfo(upd.error) : { rows: upd.result },
      delete: del.error ? errInfo(del.error) : { rows: del.result },
      rolled_back: upd.rolled_back && del.rolled_back,
    };
  };
  out.append_only = {
    ledger_entry: await ap('ledger_entry'),
    referral: await ap('referral'),
    commission_policy: await ap('commission_policy'),
  };

  // ---------------------------------------------------------------- ④ 不变量基线
  out.invariants = {
    referral_rows: await raw1(p, `SELECT count(*)::text AS n FROM referral`),
    referral_max_uid: await raw1(p, `SELECT COALESCE(max(GREATEST(child_uid, parent_uid)),0)::text AS m FROM referral`),
    graph: await raw1(p, `
      WITH RECURSIVE up AS (
        SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
        UNION ALL
        SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
      SELECT (SELECT count(*)::text FROM up WHERE cur = start) AS cycles,
             (SELECT count(*)::text FROM referral x
                JOIN (SELECT start, max(d) AS mx FROM up GROUP BY 1) t ON t.start = x.child_uid
               WHERE x.depth <> t.mx) AS bad_depth`),
    negatives: await raw1(p, `SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0`),
    conservation_mismatch_rows: await raw1(p, `
      SELECT count(*)::text AS n FROM account a
        LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f FROM ledger_entry GROUP BY uid, cid) s
          ON s.uid = a.uid AND s.cid = a.cid
       WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)`),
    event_net_nonzero_rows: await raw1(p, `
      WITH ev AS (SELECT COALESCE(event_root_key, split_part(idempotency_key,'#',1)) AS k,
                         SUM(delta+frozen_delta) AS net, bool_or(kind IN ('mint','burn')) AS mb
                    FROM ledger_entry GROUP BY 1)
      SELECT count(*)::text AS n FROM ev WHERE net <> 0 AND NOT mb`),
    ledger_entry_count: await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`),
    ledger_entry_uid_census: await raw(p, `SELECT uid::text, kind, count(*)::text AS n, COALESCE(sum(delta),0)::text AS sum_delta
                                             FROM ledger_entry WHERE uid < 0 GROUP BY 1,2 ORDER BY 1,2`),
  };

  // ---------------------------------------------------------------- ⑤ 平台账户余额只读快照
  out.platform_accounts = await raw(p, `
    SELECT uid::text, cid::text, balance::text, frozen::text, version::text
      FROM account WHERE uid IN (-1,-2,-3,0) ORDER BY uid, cid`);

  // ---------------------------------------------------------------- ⑥ 政策表（只读）
  out.policies = await raw(p, `
    SELECT policy_id::text, fee_rate_bp::text, levels::text, weights_bp::text,
           effective_from::text, created_by::text, time_created::text
      FROM commission_policy ORDER BY effective_from`);
  out.policies_seed_only = (out.policies as unknown[]).length === 1;

  // ---------------------------------------------------------------- ⑦ 基线指纹（供「已复原」证明）
  const fpGraph = async (): Promise<string> => sha256(await raw(p, `
    SELECT child_uid::text, parent_uid::text, depth::text FROM referral ORDER BY child_uid`));
  const fpGraphExclMyPartition = async (): Promise<string> => sha256(await raw(p, `
    SELECT child_uid::text, parent_uid::text, depth::text FROM referral
     WHERE child_uid < 954000 AND parent_uid < 954000 ORDER BY child_uid`));
  const fpLedger = async (): Promise<string> => sha256(await raw(p, `
    SELECT txid::text, uid::text, cid::text, kind, delta::text, frozen_delta::text, idempotency_key
      FROM ledger_entry ORDER BY txid`));
  const fpPolicy = async (): Promise<string> => sha256(await raw(p, `
    SELECT policy_id::text, fee_rate_bp::text, levels::text, weights_bp::text, effective_from::text
      FROM commission_policy ORDER BY policy_id`));
  out.baseline_fingerprints = {
    graph_all: await fpGraph(),
    graph_excluding_954xxx: await fpGraphExclMyPartition(),
    ledger_all: await fpLedger(),
    policy_all: await fpPolicy(),
    note: '本轮结束时会再取一次；graph_excluding_954xxx / policy_all / ledger 的「归属本单之外」部分必须逐字节不变',
  };

  // ---------------------------------------------------------------- ⑧ 测试数据分区可用性
  out.partition_probe = {
    uid_954_used: await raw1(p, `SELECT count(*)::text AS n FROM users WHERE uid >= 954000 AND uid < 955000`),
    sym_p1u_used: await raw1(p, `SELECT count(*)::text AS n FROM currency WHERE symbol LIKE 'p1u%'`),
  };

  const f = save('p2qa-00-baseline', out);
  console.log(JSON.stringify({ saved: f, head: out.env, triggers_disabled: disabled,
    triggers_all_enabled: out.triggers_all_enabled, invariants: out.invariants,
    policies: out.policies, append_only: out.append_only, fingerprints: out.baseline_fingerprints },
    null, 2));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
