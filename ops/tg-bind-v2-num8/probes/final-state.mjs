/**
 * 副作用与终态披露（只读取数）：本轮合成的 tg id、落在 telegram_bind_request 的行、users.tg_user_id 复原确认。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const REPO = '/Users/kevin/bistro/seafood';
const require = createRequire(`${REPO}/backend-ts/package.json`);
const { neon } = require('@neondatabase/serverless');
const env = Object.fromEntries(fs.readFileSync(`${REPO}/backend-ts/.env.local`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = neon(env.DATABASE_URL);

const mask = (c) => (typeof c === 'string' ? `${c.slice(0, 2)}****${c.slice(-2)}` : c);
const ids = Array.from({ length: 12 }, (_, i) => 990001300 + i);

const rows = await sql`SELECT req_id, code, tg_user_id, iat, exp, consumed_at FROM public.telegram_bind_request ORDER BY req_id`;
const ours = rows.filter((r) => ids.includes(Number(r.tg_user_id)));
const prior = rows.filter((r) => !ids.includes(Number(r.tg_user_id)));
const users = await sql`SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid IN (971214)`;
const ourUids = await sql`SELECT uid, tg_user_id FROM public.users WHERE tg_user_id IS NOT NULL`;

const out = {
  ac: 'side-effects', at: new Date().toISOString(), head_under_test: '625571e',
  db_read_only: 'SELECT only（@neondatabase/serverless 标签模板）',
  synthetic_tg_ids: ids,
  table_total_rows: rows.length,
  rows_created_this_batch: ours.map((r) => ({ req_id: String(r.req_id), tg_user_id: String(r.tg_user_id), code: mask(r.code), iat: r.iat, exp: r.exp, consumed_at: r.consumed_at })),
  pre_existing_rows: prior.map((r) => ({ req_id: String(r.req_id), tg_user_id: String(r.tg_user_id), code: mask(r.code), consumed_at: r.consumed_at })),
  counts: {
    created_this_batch: ours.length,
    consumed: ours.filter((r) => r.consumed_at !== null).length,
    unconsumed: ours.filter((r) => r.consumed_at === null).length,
    created_by: '全部经 webhook §签发（产品 HTTP 路径）；未用 SQL 造行',
  },
  users_971214: users.map((u) => ({ uid: String(u.uid), tg_user_id: u.tg_user_id, tg_linked_at: u.tg_linked_at })),
  users_bound_non_null_any: ourUids.map((u) => ({ uid: String(u.uid), tg_user_id: String(u.tg_user_id) })),
  residue: {
    uid_971214_tg_user_id_null: users[0]?.tg_user_id === null,
    bind_request_rows_left: ours.length,
    note: 'telegram_bind_request 为 webhook 签发审计面：本轮行全部保留 = 已知代价（未消费行将在 exp = iat+600s 后自然过期，由后续签发事务顺手回收；未改库、未删行）。',
  },
};
fs.writeFileSync(`${REPO}/ops/tg-bind-v2-num8/readings/side-effects.json`, `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify({ total: out.table_total_rows, created: out.counts, residue: out.residue, uid_971214: out.users_971214 }, null, 1));
