// ★ 真实发放（COMMIT）：给 uid 970213 加 10000 积分（cid=1）—— 走唯一写路径 adjustPoints
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });
import { createHash } from 'crypto';
import { DatabaseService } from '../src/database';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const TARGET = 970213;
const ACTOR = 1;        // 既有管理员（现取）
const CID = '1';
const AMOUNT = 10000;
const REASON = 'PROMOTION_BONUS';   // POINTS_ADJUST_REASONS 闭集内（活动奖励/发放）
const KEY = `ops:${ACTOR}:points_adjust:${TARGET}:${CID}:kevin-grant-10000-a`;

(async () => {
  const fingerprint = createHash('sha256')
    .update(['points_adjust', String(TARGET), CID, String(AMOUNT), REASON].join('|'))
    .digest('hex');
  console.log('KEY =', KEY);
  console.log('FP  =', fingerprint);

  const r = await DatabaseService.adjustPoints({
    actorUid: ACTOR, uID: TARGET, amount: AMOUNT, reason: REASON,
    idempotencyKey: KEY, requestFingerprint: fingerprint,
  });
  console.log('RESULT =', JSON.stringify(r, null, 1));

  // 回读取证
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '' });
  const q = async (s: string, p?: unknown[]) => (await pool.query(s, p as any)).rows;
  console.log('--- account(uid=970213) ---', JSON.stringify(await q(`select uid, cid, balance::text from public.account where uid = ${TARGET} order by cid`)));
  console.log('--- audit 末行 ---', JSON.stringify((await q(`select log_id, actor_uid, target_uid, cid, op, amount, balance_before, balance_after, result, txid, idempotency_key, memo from public.admin_ops_audit_log order by log_id desc limit 1`))[0]));
  console.log('--- ledger_entry 末2 ---', JSON.stringify(await q(`select txid, kind, uid, cid, amount::text, idempotency_key from public.ledger_entry order by txid desc limit 2`)));
  console.log('--- users.points? ---', JSON.stringify(await q(`select uid, is_admin from public.users where uid = ${TARGET}`)));
  await pool.end();
})().catch((e) => { console.error('GRANT_FAIL', e?.message || e); process.exit(1); });
