/**
 * QA 8④ 终审质检 · 自写探针 02：权限面候选现取（只读）。
 * 用法：cd backend-ts && npx ts-node --transpile-only .p8s4qa-artifacts/qa8s4-02-perm.ts
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { readQuery } from '../src/db';

const OUT = path.join(__dirname, 'qa8s4-02');
fs.mkdirSync(OUT, { recursive: true });

const main = async (): Promise<void> => {
  const admins = await readQuery(`SELECT uid::text AS uid, evm, is_admin FROM public.users WHERE is_admin = true ORDER BY uid ASC LIMIT 5`);
  const nonAdmins = await readQuery(`SELECT u.uid::text AS uid, u.evm FROM public.users u
    WHERE u.is_admin = false AND NOT EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid) ORDER BY u.uid ASC LIMIT 3`);
  const adminUserRoles = await readQuery(`SELECT uid::text AS uid, role_key FROM public.admin_user_role ORDER BY uid LIMIT 10`);
  const roles = await readQuery(`SELECT role_key FROM public.admin_role ORDER BY role_key`);
  const rolePerms = await readQuery(`SELECT role_key, permission_key FROM public.admin_role_permission WHERE permission_key = 'review_tasks'`);
  const permsCount = await readQuery(`SELECT count(*)::int AS n FROM public.admin_permission`);
  // 是否存在「可进后台（有 admin_user_role）但**不含** review_tasks」的角色？
  const lacking = await readQuery(`SELECT r.role_key FROM public.admin_role r
    WHERE NOT EXISTS (SELECT 1 FROM public.admin_role_permission p WHERE p.role_key = r.role_key AND p.permission_key = 'review_tasks')`);

  const out: Record<string, unknown> = { admins, non_admins: nonAdmins, admin_user_role: adminUserRoles, roles, roles_with_review_tasks: rolePerms, admin_permission_rows: permsCount[0]?.n ?? null, roles_lacking_review_tasks: lacking };
  out['nopts_users'] = await readQuery(`SELECT u.uid::text AS uid, u.evm, u.is_admin, r.role_key
     FROM public.users u JOIN public.admin_user_role r ON r.uid = u.uid
     WHERE r.role_key = ANY($1::text[]) ORDER BY u.uid`, [lacking.map((r) => String(r.role_key))]);
  out['role_perms_for_nopts'] = await readQuery(`SELECT role_key, permission_key FROM public.admin_role_permission
     WHERE role_key = ANY($1::text[]) ORDER BY role_key, permission_key`, [lacking.map((r) => String(r.role_key))]);
  fs.writeFileSync(path.join(OUT, 'perm.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAIL', (e as Error)?.message); process.exit(2); });
