/**
 * p2qa-15 · 修复轮复检收尾（Neng）：全局触发器启用态 + 我的分区残留清点 + 平台只读（**只读**）
 */
import { mkPool, raw, raw1, save, RUN, errInfo, sha256 } from './p2qa-lib';
import { readGraphInvariants } from '../src/commission';

(async () => {
  const p = mkPool(4);
  const out: Record<string, unknown> = { script: 'scripts/p2qa-15-final-state.ts', run: RUN };
  out.triggers = (await raw(p, `
    SELECT c.relname AS tbl, t.tgname, t.tgenabled,
           t.tgdeferrable::text AS deferrable, t.tginitdeferred::text AS initdeferred,
           (t.tgconstraint <> 0)::text AS is_constraint_trigger
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
     ORDER BY c.relname, t.tgname`)).map((r) => r as unknown as Record<string, string>);
  const tmap = new Map((out.triggers as Array<Record<string, string>>).map((r) => [r.tgname, r.tgenabled]));
  out.user_triggers_all_O = ['trg_account_guard', 'trg_commission_policy_append_only',
    'trg_commission_policy_weights_guard', 'trg_ledger_entry_append_only',
    'trg_ledger_entry_commission_conservation', 'trg_referral_append_only', 'trg_referral_cycle_guard']
    .map((t) => ({ tgname: t, tgenabled: tmap.get(t) ?? 'ABSENT' }));
  out.all_user_triggers_enabled = (out.user_triggers_all_O as Array<{ tgenabled: string }>)
    .every((r) => r.tgenabled === 'O');

  out.invariants = await readGraphInvariants(p as never);
  out.schema_version = (await raw1(p, `SELECT max(version)::text AS v FROM schema_migration`))?.v;
  out.counts = {
    referral_total: (await raw1(p, `SELECT count(*)::text AS n FROM referral`))?.n,
    ledger_entry_total: (await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry`))?.n,
    commission_policy_total: (await raw1(p, `SELECT count(*)::text AS n FROM commission_policy`))?.n,
    users_total: (await raw1(p, `SELECT count(*)::text AS n FROM users`))?.n,
    currency_total: (await raw1(p, `SELECT count(*)::text AS n FROM currency`))?.n,
  };
  out.my_partition = {
    uid_958_referral: await raw(p, `SELECT child_uid::text,parent_uid::text,depth::text FROM referral
      WHERE child_uid BETWEEN 958000 AND 958999 OR parent_uid BETWEEN 958000 AND 958999 ORDER BY child_uid`),
    uid_958_users: (await raw(p, `SELECT uid::text FROM users WHERE uid BETWEEN 958000 AND 958999 ORDER BY uid`))
      .map((r) => (r as unknown as { uid: string }).uid),
    uid_958_accounts: await raw(p, `SELECT uid::text,cid::text,balance::text,frozen::text FROM account
      WHERE uid BETWEEN 958000 AND 958999 ORDER BY uid,cid`),
    currency_p1x: await raw(p, `SELECT cid::text,symbol FROM currency WHERE symbol LIKE 'p1x%' ORDER BY cid`),
    ledger_rows_958_or_p1x: (await raw1(p, `SELECT count(*)::text AS n FROM ledger_entry
      WHERE uid BETWEEN 958000 AND 958999 OR uid = -2 AND cid IN
        (SELECT cid FROM currency WHERE symbol LIKE 'p1x%')`))?.n,
    all_my_ref_ids: await raw(p, `SELECT DISTINCT ref_id::text FROM ledger_entry
      WHERE ref_id BETWEEN 958300000000000 AND 958499999999999`),
    // 958600-958699 里**除** F7② 用例（958636..958639）以外的行 = F3/F6/F2（应全为空 ⇒ 证明回滚干净）
    rolled_back_case_uids_present: await raw(p, `SELECT uid::text FROM users
      WHERE uid BETWEEN 958600 AND 958635 ORDER BY uid`),
    rolled_back_case_referral_present: await raw(p, `SELECT child_uid::text FROM referral
      WHERE child_uid BETWEEN 958600 AND 958635 ORDER BY child_uid`),
  };
  out.platform_cid1 = await raw(p, `SELECT uid::text,cid::text,balance::text,frozen::text FROM account
    WHERE cid = 1 AND uid IN (-3,-2,-1,0) ORDER BY uid`);
  out.spec_files_sha256 = {
    'docs/ledger.spec.md': sha256(require('fs').readFileSync(require('path').resolve(__dirname, '..', '..', 'docs', 'ledger.spec.md'), 'utf8')),
    'docs/commission.spec.md': sha256(require('fs').readFileSync(require('path').resolve(__dirname, '..', '..', 'docs', 'commission.spec.md'), 'utf8')),
    'docs/seafood.master-plan.md': sha256(require('fs').readFileSync(require('path').resolve(__dirname, '..', '..', 'docs', 'seafood.master-plan.md'), 'utf8')),
    'docs/qa/p2-commission.md': sha256(require('fs').readFileSync(require('path').resolve(__dirname, '..', '..', 'docs', 'qa', 'p2-commission.md'), 'utf8')),
  };

  const f = save('p2qa-15-final-state', out);
  console.log(JSON.stringify({ saved: f, all_user_triggers_enabled: out.all_user_triggers_enabled,
    user_triggers: out.user_triggers_all_O, invariants: out.invariants, schema_version: out.schema_version,
    counts: out.counts, my_partition: out.my_partition, platform_cid1: out.platform_cid1,
    spec_sha256: out.spec_files_sha256 }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', errInfo(e)); process.exit(1); });
