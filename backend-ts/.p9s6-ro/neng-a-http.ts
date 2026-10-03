/**
 * Neng 独立质检（线 A）· R-9-86 四臂真 HTTP 探针（自起，不信任当事读数）。
 * 用法（主仓实例 5797）：cd backend-ts && npx ts-node --transpile-only .p9s6-ro/neng-a-http.ts
 * 用法（仓外对照副本 5797）：NEG=1 npx ts-node --transpile-only .p9s6-ro/neng-a-http.ts
 */
import '../src/env';
import { createSessionToken } from '../src/auth';

const BASE = process.env.BASE || 'http://127.0.0.1:5797';
const NEG = process.env.NEG === '1';
const OWNER = Number(process.env.OWNER_UID || 970002);
const NONOWNER = Number(process.env.NONOWNER_UID || 11);
const JID = Number(process.env.JID || 4);
const MISS = 999999999;

const get = async (path: string, token?: string, tokenRaw?: string) => {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  if (tokenRaw !== undefined) headers.authorization = tokenRaw;
  const r = await fetch(`${BASE}${path}`, { headers });
  const raw = await r.text();
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* non-json */ }
  return { status: r.status, raw, json };
};

(async () => {
  const out: Record<string, unknown> = { base: BASE, neg_mode: NEG, owner: OWNER, nonowner: NONOWNER, jid: JID };
  const ownerTok = createSessionToken({ uID: OWNER, evm: '' });
  const nonTok = createSessionToken({ uID: NONOWNER, evm: '' });

  // Arm 1 · 未登录 / 凭据无效 ⇒ 401
  const a1_none = await get(`/api/task-progress/${JID}`);
  const a1_bad = await get(`/api/task-progress/${JID}`, undefined, 'Bearer not.a.valid.jwt');
  out.arm1_no_token = { status: a1_none.status, body: a1_none.json };
  out.arm1_bad_token = { status: a1_bad.status, body: a1_bad.json };

  // Arm 2 · 非本人 ⇒ 404（与 miss 同形）
  const a2_hit = await get(`/api/task-progress/${JID}`, nonTok);
  const a2_miss = await get(`/api/task-progress/${MISS}`, nonTok);
  out.arm2_nonowner_hit = { status: a2_hit.status, raw: a2_hit.raw, body: a2_hit.json };
  out.arm2_nonowner_miss = { status: a2_miss.status, raw: a2_miss.raw, body: a2_miss.json };
  out.arm2_bytes_equal = a2_hit.raw === a2_miss.raw;

  // Arm 3 · 本人 ⇒ 200 + data 9 键
  const a3 = await get(`/api/task-progress/${JID}`, ownerTok);
  const dataKeys = a3.json && a3.json.data && typeof a3.json.data === 'object' ? Object.keys(a3.json.data).sort() : null;
  out.arm3_owner = {
    status: a3.status,
    data_keys: dataKeys,
    keys_count: dataKeys ? dataKeys.length : 0,
    info_input: a3.json?.data?.info_input ?? null,
    data: a3.json?.data ?? null,
    top: a3.json ? { success: a3.json.success, message: a3.json.message } : null,
  };

  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('ERR', e); process.exit(1); });
