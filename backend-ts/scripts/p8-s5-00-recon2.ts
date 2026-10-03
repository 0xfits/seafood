/** p8-s5 侦察2（只读）：admin 角色/权限面 + 可承接/可购买夹具候选。 */
import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const out: Record<string, unknown> = {};
  out.role_tables_cols = await readQuery(`SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS cols FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('admin_role','admin_role_permission','admin_user_role','admin_permission') GROUP BY table_name ORDER BY table_name`);
  out.user_roles = await readQuery(`SELECT ur.uid, ur.role_key, u.is_admin, string_agg(rp.permission_key, ',' ORDER BY rp.permission_key) AS perms FROM public.admin_user_role ur JOIN "users" u ON u.uid=ur.uid LEFT JOIN public.admin_role_permission rp ON rp.role_key=ur.role_key GROUP BY ur.uid, ur.role_key, u.is_admin ORDER BY ur.uid`);
  out.role_perms = await readQuery(`SELECT role_key, string_agg(permission_key, ',' ORDER BY permission_key) AS perms FROM public.admin_role_permission GROUP BY role_key ORDER BY role_key`);
  out.listed_listings = await readQuery(`SELECT listing_id, seller_uid, cid, price, stock, status FROM public.listing WHERE status='listed' ORDER BY listing_id DESC LIMIT 10`);
  out.users_min = await readQuery(`SELECT uid, is_admin FROM "users" WHERE uid IN (2,3,6,7,11,970001) ORDER BY uid`);
  out.job_cols = await readQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='job_application' ORDER BY ordinal_position`);
  console.log(JSON.stringify(out, null, 1));
  await closePools();
  process.exit(0);
})().catch(async (e) => { console.error('CRASH', String((e as Error)?.stack || e).slice(0, 1200)); await closePools().catch(() => undefined); process.exit(2); });
