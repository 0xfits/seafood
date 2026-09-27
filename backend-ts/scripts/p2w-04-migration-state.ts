/**
 * p2w-04 · 迁移前后读数（只读）：给「应用 0011」这一步留可核对的证据。
 * 输出：schema_version 行、两个函数的 md5(prosrc)、触发器状态、探针 uid 占用情况。
 */
import { mkPool, raw, save } from './p2w-lib';

(async () => {
  const p = mkPool(2);
  const version = await raw(p, `SELECT version, name, applied_at::text AS applied_at FROM schema_migration ORDER BY version`);
  const schemaVersion = await raw(p, `SELECT max(version) AS schema_version FROM schema_migration`);
  const fns = await raw(p, `
    SELECT p.proname, md5(p.prosrc) AS body_md5, length(p.prosrc) AS body_len
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('ledger_assert_commission_conservation','referral_cycle_guard','referral_bind')
     ORDER BY p.proname`);
  const trg = await raw(p, `
    SELECT c.relname AS tbl, t.tgname, t.tgenabled, t.tgdeferrable, t.tginitdeferred, (t.tgconstraint <> 0) AS is_constraint
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal AND c.relname IN ('ledger_entry','referral','account')
     ORDER BY c.relname, t.tgname`);
  const probes = await raw(p, `
    SELECT (SELECT count(*) FROM users WHERE uid BETWEEN 952981 AND 952998)::text AS users_9529xx,
           (SELECT count(*) FROM referral WHERE child_uid BETWEEN 952981 AND 952998 OR parent_uid BETWEEN 952981 AND 952998)::text AS referral_9529xx,
           (SELECT count(*) FROM currency WHERE symbol = 'p0011selfcheck')::text AS probe_currency`);
  const res = {
    schema_version: String(schemaVersion[0]?.schema_version ?? ''),
    schema_migration: version.map((r) => `${r.version}:${r.name}@${r.applied_at}`),
    functions: fns,
    triggers: trg,
    probes,
    fingerprints: Object.fromEntries(fns.map((r) => [String(r.proname), String(r.body_md5)])),
  };
  await save('migration-state', res);
  console.log(JSON.stringify(res, null, 1));
  await p.end();
})().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1); });
