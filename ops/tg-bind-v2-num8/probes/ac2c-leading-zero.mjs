/**
 * AC-2c 承重补测：**以 0 开头**的合法 8 位码（前导零 = 数字强转最易被吃掉的一形）
 *   ⇒ confirm 不得落 400 形状分支；往返后 users.tg_user_id 回 null。
 * 码取自 ac1-code-shape.json 的 raw_codes_for_downstream（AC-1 真实签发行）。
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = '/Users/kevin/bistro/seafood';
const require = createRequire(`${REPO}/backend-ts/package.json`);
const { neon } = require('@neondatabase/serverless');
const { Wallet } = require('ethers');
const API = 'http://localhost:5788';
const env = Object.fromEntries(fs.readFileSync(`${REPO}/backend-ts/.env.local`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sql = neon(env.DATABASE_URL);
const mask = (c) => `${c.slice(0, 2)}****${c.slice(-2)}`;

const post = (url, obj, headers = []) => {
  const out = execFileSync('curl', ['-s', '-m', '25', '-w', '\n%{http_code}', '-X', 'POST', url, '-H', 'content-type: application/json', ...headers.flatMap((h) => ['-H', h]), '-d', JSON.stringify(obj)], { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  let p = null; try { p = JSON.parse(out.slice(0, i)); } catch { p = { raw: out.slice(0, i) }; }
  return { status: Number(out.slice(i + 1)), payload: p };
};
const get = (url, headers = []) => {
  const out = execFileSync('curl', ['-s', '-m', '25', '-w', '\n%{http_code}', url, ...headers.flatMap((h) => ['-H', h])], { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  let p = null; try { p = JSON.parse(out.slice(0, i)); } catch { p = {}; }
  return { status: Number(out.slice(i + 1)), payload: p };
};

const codes = JSON.parse(fs.readFileSync(`${REPO}/ops/tg-bind-v2-num8/readings/ac1-code-shape.json`, 'utf8')).raw_codes_for_downstream;
const pick = codes.find((c) => c.code.startsWith('0')) || codes.find((c) => c.code.includes('0'));
if (!pick) { console.log(JSON.stringify({ skipped: 'no leading-zero/0-bearing code available' })); process.exit(0); }

const FIX = Object.fromEntries(fs.readFileSync('/Users/kevin/.config/seafood/sf14qa-test-account.env', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const wallet = new Wallet(FIX.PRIVATE_KEY);
const ch = post(`${API}/api/auth/challenge`, { evm_address: FIX.EVM_ADDRESS });
const sig = await wallet.signMessage(ch.payload.data.message);
const ve = post(`${API}/api/auth/verify`, { evm_address: FIX.EVM_ADDRESS, signature: sig, challenge_token: ch.payload.data.challenge_token });
const token = ve.payload.data.token;
const hdr = [`Authorization: Bearer ${token}`];

const confirm = post(`${API}/api/telegram/bind/confirm`, { code: pick.code }, hdr);
const status = get(`${API}/api/telegram/bind/status`, hdr);
const unbind = post(`${API}/api/telegram/unbind`, {}, hdr);
const after = get(`${API}/api/telegram/bind/status`, hdr);
const db = await sql`SELECT uid, tg_user_id FROM public.users WHERE uid = 971214`;
const row = await sql`SELECT req_id, code, consumed_at FROM public.telegram_bind_request WHERE code = ${pick.code}`;

const out = {
  ac: 'AC-2c', at: new Date().toISOString(), head_under_test: '625571e',
  input_code_masked: mask(pick.code), input_code_starts_with_zero: pick.code.startsWith('0'),
  input_code_digit_count: pick.code.length, input_code_has_0_or_1: /[01]/.test(pick.code),
  confirm: { status: confirm.status, err: confirm.payload?.error ? { code: confirm.payload.error.code, reason: confirm.payload.error.details?.reason } : null, data: confirm.payload?.data },
  status_after_bind: { status: status.status, data: status.payload?.data, has_tg_user_id: JSON.stringify(status.payload).includes('tg_user_id') },
  unbind: { status: unbind.status, data: unbind.payload?.data },
  status_after_unbind: status.payload?.data,
  db_user_after: db,
  bind_row: row.map((r) => ({ req_id: String(r.req_id), consumed_at: r.consumed_at })),
  checks: {
    leading_zero_code_shape_accepted: confirm.status !== 400,
    confirm_200_tg_linked_true: confirm.status === 200 && confirm.payload?.data?.tg_linked === true,
    status_true_no_tg_user_id: status.payload?.data?.tg_linked === true && !JSON.stringify(status.payload).includes('tg_user_id'),
    unbind_ok: unbind.status === 200 && unbind.payload?.data?.tg_linked === false,
    users_tg_null_restored: db[0]?.tg_user_id === null,
    row_consumed: row[0]?.consumed_at !== null,
  },
};
out.all_pass = Object.values(out.checks).every(Boolean);
fs.writeFileSync(`${REPO}/ops/tg-bind-v2-num8/readings/ac2c-leading-zero.json`, `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify({ checks: out.checks, all_pass: out.all_pass, masked: out.input_code_masked, starts0: out.input_code_starts_with_zero }, null, 1));
