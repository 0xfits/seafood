/**
 * R-9-86 三臂真 HTTP（受控实例）——同一探针可打任意 BASE（主仓修复侧 / 仓外判负副本）
 * ============================================================================
 * 臂：无 token ⇒ 401 · 已登录非本人 ⇒ 404 · 本人 ⇒ 200（+ data 键集） · miss ⇒ 404（与「非本人」同形）
 * 用法（cwd = backend-ts）：
 *   R986_BASE=http://127.0.0.1:5797 npx ts-node --transpile-only .p8s6-impl/r9-86-http.ts
 * 目标行（read-only 现取，见 recon.out.json）：app 24 = job 23 / worker 12（本人 uid 12）；
 * 非本人 uid 1（存在）· 另一本人臂 app 9 = job 11 / worker 6。
 */
import '../src/env';
import { createSessionToken } from '../src/auth';

const BASE = process.env.R986_BASE || 'http://127.0.0.1:5797';
const tok = (uid: number) => createSessionToken({ uID: uid, evm: '' });

const call = async (p: string, token?: string) => {
  const r = await fetch(`${BASE}${p}`, token ? { headers: { authorization: `Bearer ${token}` } } : undefined);
  const body = await r.json().catch(() => null) as Record<string, unknown> | null;
  const data = (body?.data ?? null) as Record<string, unknown> | null;
  return {
    path: p,
    status: r.status,
    success: body?.success ?? null,
    error_code: (body?.error as Record<string, unknown> | undefined)?.code ?? null,
    data_keys: data ? Object.keys(data).sort() : null,
    body,
  };
};

const main = async () => {
  const arms = {
    A_no_token: await call('/api/task-progress/24'),
    B_non_owner_uid1: await call('/api/task-progress/24', tok(1)),
    C_owner_uid12: await call('/api/task-progress/24', tok(12)),
    D_owner2_uid6_app9: await call('/api/task-progress/9', tok(6)),
    E_non_owner_uid6_app24: await call('/api/task-progress/24', tok(6)),
    F_miss_999999_owner: await call('/api/task-progress/999999', tok(12)),
  };
  const noloop: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(arms)) {
    noloop[k] = { path: (v as any).path, status: (v as any).status, success: (v as any).success, error_code: (v as any).error_code, data_keys: (v as any).data_keys };
  }
  const checks = {
    A_401: arms.A_no_token.status === 401,
    B_404: arms.B_non_owner_uid1.status === 404,
    C_200: arms.C_owner_uid12.status === 200 && arms.C_owner_uid12.success === true,
    C_data_keys_9: JSON.stringify(arms.C_owner_uid12.data_keys) === JSON.stringify(
      ['info_input', 'jID', 'points_claimed', 'tID', 'time_checked', 'time_claimed', 'time_created', 'time_submitted', 'uID']),
    D_200_second_owner: arms.D_owner2_uid6_app9.status === 200,
    E_404_non_owner: arms.E_non_owner_uid6_app24.status === 404,
    F_404_miss: arms.F_miss_999999_owner.status === 404,
    no_leak_same_shape: JSON.stringify(arms.B_non_owner_uid1.body) === JSON.stringify(arms.F_miss_999999_owner.body),
  };
  const out = { base: BASE, arms_summary: noloop, checks, failures: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k), raw_bodies: arms };
  console.log('R986_HTTP=' + JSON.stringify(out, null, 2));
  process.exit(out.failures.length ? 1 : 0);
};

main().catch((e) => { console.error('R986_HTTP_FAIL', e); process.exit(2); });
