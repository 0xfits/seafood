/**
 * P6-B6-PERM · 验收探针（**不 apply 迁移**：事务内预演 + ROLLBACK，净零写）
 * ============================================================================
 * A) 权限键**三真源逐键相等**（离线解析）：src/database.ts ↔ frontend/src/admin-utils.js ↔ migrations/0022
 * B) `0022` 种子**事务内预演 + ROLLBACK**（净零写）：can_access_admin(uid 970213) 由 false → true
 *    （证明「先种子后收敛」不锁死运营管理员）；事务外复查 4 表仍 0 行
 * C) 账本零位移：`ledger_entry` 行数 + `Σ(account.balance, cid=1)` 改前/改后
 * D) HTTP 收敛验收：真 admin 200 / 非 admin 403 / 无 token 401
 *    （服务经面板 POST :5555/api/restart 重启以加载收敛后的 src；原地址持有人 收敛前/后 对照）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-b6perm-01-verify.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPO = path.resolve(__dirname, '..');

// .env.local 只读加载（**绝不打印任何值**）
for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const ADMIN_ADDRESS = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';
const UID_ADMIN = 1;            // users.is_admin = true（只读探针实测）
const UID_ADMIN_EVM = '0x99a7ae985ec41c5ba94dd640b74307d9d9cd8f74';
const UID_NONADMIN = 2;         // users.is_admin = false 且无角色行
const UID_NONADMIN_EVM = '0xaf2102ef4ef7e285dbe7558b748f62f16fa67b1e';
const UID_ADDR_HOLDER = 970213; // 原第三真源地址持有人；is_admin = false
const API = String(process.env.SEAFOOD_API_URL || 'http://127.0.0.1:5788');
const PANEL = String(process.env.SEAFOOD_PANEL || 'http://127.0.0.1:5555');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const quoted = (s: string): string[] => (s.match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));

// ---------------------------------------------------------------- A 三真源 --
function keysFromDatabaseTs(): string[] {
  const src = fs.readFileSync(path.join(REPO, 'src', 'database.ts'), 'utf8');
  const i = src.indexOf('const ALL_ADMIN_PERMISSIONS = [');
  const j = src.indexOf('] as const;', i);
  return quoted(src.slice(i, j));
}
function keysFromAdminUtils(): string[] {
  const src = fs.readFileSync(path.join(REPO, '..', 'frontend', 'src', 'admin-utils.js'), 'utf8');
  const i = src.indexOf("'dashboard_access'");
  const j = src.indexOf(']', i);
  return quoted(src.slice(i, j));
}
function keysFrom0022(): { perms: string[]; rolePerms: string[]; roles: string[]; userRoleSel: string } {
  const src = fs.readFileSync(path.join(REPO, 'migrations', '0022_admin_permission_seed.sql'), 'utf8');
  const block = (anchor: string, stop: string) => {
    const i = src.indexOf(anchor); const j = src.indexOf(stop, i);
    return src.slice(i, j);
  };
  const pBlock = block('INSERT INTO public.admin_permission ', 'ON CONFLICT');
  const perms = (pBlock.match(/\(\s*'([^']+)'\s*,/g) || []).map((x) => x.replace(/^\(\s*'/, '').replace(/'\s*,$/, ''));
  const rpBlock = block('INSERT INTO public.admin_role_permission ', 'ON CONFLICT');
  const rolePerms = (rpBlock.match(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g) || []).map((x) => x);
  const rBlock = block('INSERT INTO public.admin_role ', 'ON CONFLICT');
  const roles = (rBlock.match(/\(\s*'([^']+)'\s*,/g) || []).map((x) => x.replace(/^\(\s*'/, '').replace(/'\s*,$/, ''));
  return { perms, rolePerms, roles, userRoleSel: src.includes("WHERE lower(u.evm) = '" + ADMIN_ADDRESS + "'") ? 'ok' : 'MISSING' };
}

const keyEq = (a: string[], b: string[]): boolean => {
  const A = [...new Set(a)].sort(); const B = [...new Set(b)].sort();
  return A.length > 0 && A.length === B.length && A.every((x, i) => x === B[i]);
};

// ---------------------------------------------------------------- D HTTP ----
const mint = (uID: number, evm: string): string => {
  const key = String(process.env.SECRET_KEY || '');
  if (!key) throw new Error('SECRET_KEY missing');
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ sub: String(uID), evm, exp: Math.floor(Date.now() / 1000) + 1800 });
  const sig = crypto.createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
};

type HttpOut = { status: number; body: string };
const get = async (p: string, token?: string): Promise<HttpOut> => {
  try {
    const res = await fetch(`${API}${p}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 400) };
  } catch (e) {
    return { status: -1, body: `FETCH_ERROR: ${e instanceof Error ? e.message : String(e)}` };
  }
};

(async () => {
  const out: any = { unit: 'P6-B6-PERM' };

  // ---- A 三真源 ----
  const dbKeys = keysFromDatabaseTs();
  const feKeys = keysFromAdminUtils();
  const m = keysFrom0022();
  out.A_three_sources = {
    database_ts: dbKeys, database_ts_count: dbKeys.length,
    frontend_admin_utils: feKeys, frontend_count: feKeys.length,
    migration_0022: m.perms, migration_0022_count: m.perms.length,
    db_eq_fe: keyEq(dbKeys, feKeys),
    db_eq_migration: keyEq(dbKeys, m.perms),
    all_three_equal: keyEq(dbKeys, feKeys) && keyEq(dbKeys, m.perms),
    role_seed: m.roles, role_permission_count: m.rolePerms.length,
    role_permission_all_super_admin: m.rolePerms.every((x) => x.includes("'super_admin'")),
    admin_user_role_seed_select: m.userRoleSel,
  };

  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  if (!URL) { out.fatal = 'missing DATABASE_URL_UNPOOLED'; console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  const c = new Client({ connectionString: URL });
  await c.connect();

  const counts = async () => {
    const r: Record<string, string> = {};
    for (const t of ['admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role']) {
      r[t] = String((await c.query(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0].n);
    }
    return r;
  };
  const ledger = async () => ({
    ledger_entry: String((await c.query(`SELECT count(*)::text AS n FROM public.ledger_entry`)).rows[0].n),
    sigma_balance_cid1: String((await c.query(`SELECT coalesce(sum(balance),0)::text AS s FROM public.account WHERE cid = 1`)).rows[0].s),
  });

  out.C_ledger_before = await ledger();
  out.B_outside_tx_before = await counts();

  // ---- D 收敛前 HTTP（现存进程仍是收敛前代码）----
  const preAddr = await get('/api/admin/settings', mint(UID_ADDR_HOLDER, ADMIN_ADDRESS));
  out.D_pre_convergence_addr_holder = { endpoint: 'GET /api/admin/settings', status: preAddr.status, body: preAddr.body };

  // ---- B 事务内预演 0022 + ROLLBACK（净零写）----
  const migSql = fs.readFileSync(path.join(REPO, 'migrations', '0022_admin_permission_seed.sql'), 'utf8');
  await c.query('BEGIN');
  await c.query(migSql);
  out.B_in_tx_counts = await counts();
  out.B_in_tx_access = (await c.query(
    `SELECT u.uid::text AS uid, u.is_admin,
            (u.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid)) AS can_access_admin,
            (SELECT count(*)::int FROM public.admin_role_permission rp WHERE rp.role_key = 'super_admin') AS super_admin_perms
       FROM public.users u WHERE lower(u.evm) = $1 OR u.uid IN ($2, $3) ORDER BY u.uid`,
    [ADMIN_ADDRESS, UID_ADMIN, UID_NONADMIN],
  )).rows;
  await c.query('ROLLBACK');
  out.B_rolled_back = true;
  out.B_outside_tx_after = await counts();
  out.B_net_zero = JSON.stringify(out.B_outside_tx_before) === JSON.stringify(out.B_outside_tx_after);

  // ---- D 重启服务以加载收敛后的 src ----
  let restart: any = null;
  try {
    const r = await fetch(`${PANEL}/api/restart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: 'seafood-api' }),
    });
    restart = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) { restart = { status: -1, body: `FETCH_ERROR: ${e instanceof Error ? e.message : String(e)}` }; }
  out.D_restart = restart;

  let ready = -1;
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const probe = await get('/api/admin/settings');
    if (probe.status !== -1) { ready = probe.status; break; }
  }
  out.D_ready_after_restart_status = ready;

  const tokAdmin = mint(UID_ADMIN, UID_ADMIN_EVM);
  const tokNonAdmin = mint(UID_NONADMIN, UID_NONADMIN_EVM);
  const tokAddr = mint(UID_ADDR_HOLDER, ADMIN_ADDRESS);
  const a = await get('/api/admin/settings', tokAdmin);
  const n = await get('/api/admin/settings', tokNonAdmin);
  const z = await get('/api/admin/settings', tokAddr);
  const q = await get('/api/admin/settings');
  const me = await get('/api/admin/me', tokAdmin);
  out.D_post_convergence = {
    admin_uid1_settings: { status: a.status, expect: 200, ok: a.status === 200, body: a.body },
    nonadmin_uid2_settings: { status: n.status, expect: 403, ok: n.status === 403, body: n.body },
    addr_holder_settings: { status: z.status, expect: 403, ok: z.status === 403, body: z.body },
    no_token_settings: { status: q.status, expect: 401, ok: q.status === 401, body: q.body },
    admin_uid1_me: { status: me.status, body: me.body },
  };

  out.C_ledger_after = await ledger();
  out.C_ledger_zero_drift = JSON.stringify(out.C_ledger_before) === JSON.stringify(out.C_ledger_after);

  console.log(JSON.stringify(out, null, 2));
  await c.end().catch(() => undefined);
  const pass = out.A_three_sources.all_three_equal && out.B_net_zero && out.C_ledger_zero_drift
    && out.D_post_convergence.admin_uid1_settings.ok && out.D_post_convergence.nonadmin_uid2_settings.ok
    && out.D_post_convergence.no_token_settings.ok;
  console.log(`VERIFY_PASS=${pass}`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('VERIFY_CRASHED', e?.message); process.exit(2); });
