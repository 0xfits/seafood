/**
 * p7b-05 · 夹具规划用只读取证（users 列 / 身份序列 / 余额 / 权限键）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p7b-05-fixture-recon.ts
 */
import { mkPool, raw, raw1, save } from './p7b-lib';

(async () => {
  const p = mkPool(2);
  const out: Record<string, unknown> = { script: 'scripts/p7b-05-fixture-recon.ts' };
  try {
    out.users_cols = await raw(p, `SELECT column_name, is_nullable, column_default, data_type, is_identity, identity_generation
      FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
    out.users_uid_max = await raw1(p, `SELECT COALESCE(max(uid),0)::text AS max_uid FROM public."users"`);
    out.users_identity_seq = await raw(p, `SELECT pg_get_serial_sequence('public.users','uid') AS seq`);
    out.admin_permission_keys = await raw(p, `SELECT permission_key FROM public.admin_permission ORDER BY 1`);
    out.balances = await raw(p, `SELECT a.uid::text AS uid, a.cid::text AS cid, a.balance::text AS balance, a.frozen::text AS frozen
      FROM public.account a WHERE a.uid IN (1,7,8,10,970001,970201,970213) ORDER BY a.uid, a.cid`);
    out.accounts_cid1_top = await raw(p, `SELECT uid::text AS uid, balance::text AS balance FROM public.account
      WHERE cid=1 AND balance > 0 ORDER BY balance DESC LIMIT 12`);
    out.currency_cid1 = await raw(p, `SELECT cid::text AS cid, status, total_supply::text FROM public.currency WHERE cid=1`);
    out.biz_users = await raw(p, `SELECT uid::text AS uid, is_admin FROM public."users" WHERE uid < 20 ORDER BY uid`);
  } finally {
    await p.end().catch(() => undefined);
  }
  const f = save('p7b-05-fixture-recon', out);
  console.log(JSON.stringify({ saved: f, out }, null, 1));
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
