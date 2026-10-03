/** Neng 独立质检 · 承接门槛现取（真 HTTP /api/batt · 只读）。 */
import { createSessionToken } from '../src/auth';
import { BATT_POLICY_DEFAULTS, resolveBattPolicy } from '../src/database';

const BASE = 'http://127.0.0.1:5797';
(async () => {
  const out: Record<string, unknown> = { unit: 'P9S6-NENG-THRESHOLD-RO', generated_at: new Date().toISOString() };
  out.batt_policy_defaults = BATT_POLICY_DEFAULTS;
  out.rp_null = resolveBattPolicy(null);              // app_config 无行 ⇒ 常量
  out.rp_bad = resolveBattPolicy({ taskCostBatt: -1 });
  for (const uid of [970213, 11, 2]) {
    const token = createSessionToken({ uID: uid, evm: '' });
    const r = await fetch(`${BASE}/api/batt`, { headers: { authorization: `Bearer ${token}` } });
    let body: unknown = null; try { body = await r.json(); } catch { /* */ }
    (out as Record<string, unknown>)[`uid_${uid}`] = { status: r.status, body };
  }
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 800)); process.exit(2); });
