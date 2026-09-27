/** 临时只读探针（本单用；稍后并入 p2w 脚本或删除）—— DB 基线读数 */
import './p1f-lib';
import { mkPool, raw } from './p1f-lib';
(async () => {
  const p = mkPool(2);
  const inv = await raw(p, `WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT count(*)::text AS bad_depth FROM referral x
      JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid WHERE x.depth <> t.mx`);
  const cyc = await raw(p, `WITH RECURSIVE up AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
    SELECT count(*)::text AS cycles FROM up WHERE cur = start`);
  const rows = await raw(p, `SELECT count(*)::text AS n, min(child_uid)::text AS minc, max(child_uid)::text AS maxc FROM referral`);
  const uids = await raw(p, `SELECT min(child_uid)::text AS minu, max(child_uid)::text AS maxu, count(*)::text AS n FROM referral WHERE child_uid >= 950000`);
  const trg = await raw(p, `SELECT c.relname AS tbl, t.tgname, t.tgenabled FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND n.nspname='public' ORDER BY 1,2`);
  const pol = await raw(p, `SELECT policy_id::text, fee_rate_bp::text, levels::text, weights_bp::text, effective_from::text FROM commission_policy ORDER BY effective_from DESC LIMIT 6`);
  const acct = await raw(p, `SELECT cid::text, count(*)::text AS n FROM account GROUP BY 1 ORDER BY 1`);
  const minus2 = await raw(p, `SELECT cid::text, balance::text, frozen::text FROM account WHERE uid = -2 ORDER BY cid`);
  const ver = await raw(p, `SELECT version, name FROM schema_migration ORDER BY version DESC LIMIT 2`);
  console.log(JSON.stringify({ inv, cyc, rows, uids, triggers: trg, policies: pol, accounts_by_cid: acct, minus2, version: ver }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
