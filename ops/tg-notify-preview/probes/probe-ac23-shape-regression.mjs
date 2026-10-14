/**
 * AC-2 + AC-3 探针（Neng 窄质检 · 只读库 / 只打产品 HTTP）
 *   AC-2：confirm 形状闸 ⇒ 400 TG_CODE_INVALID + details.reason=SHAPE_INVALID；
 *         免鉴权 401；合法 8 位码不落形状分支；查无 8 位码 404 且 reason ≠ SHAPE_INVALID。
 *   AC-3：webhook 签发 → confirm 往返 → status → unbind ⇒ 只读库验 tg_user_id 回 null；
 *         冷却闸（60s 同 id 不落第二行）。
 * 跑法：node /Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/probe-ac23-shape-regression.mjs
 * 写明：库面**只 SELECT**（无写/无 DDL）；写全部走产品 HTTP。
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = '/Users/kevin/bistro/seafood';
const require = createRequire(`${REPO}/backend-ts/package.json`);
const { neon } = require('@neondatabase/serverless');
const { Wallet } = require('ethers');
const API = 'http://localhost:5788';
const OUTDIR = `${REPO}/ops/tg-notify-preview/readings`;

const readEnvFile = (p) => Object.fromEntries(fs.readFileSync(p, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const env = readEnvFile(`${REPO}/backend-ts/.env.local`);
const sql = neon(env.DATABASE_URL);

const post = (url, obj, headers = []) => {
  const out = execFileSync('curl', ['-s', '-m', '25', '-w', '\n%{http_code}', '-X', 'POST', url,
    '-H', 'content-type: application/json', ...headers.flatMap((h) => ['-H', h]), '-d', JSON.stringify(obj)], { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  let p = null; try { p = JSON.parse(out.slice(0, i)); } catch { p = { raw: out.slice(0, i).slice(0, 200) }; }
  return { status: Number(out.slice(i + 1)), payload: p };
};
const get = (url, headers = []) => {
  const out = execFileSync('curl', ['-s', '-m', '25', '-w', '\n%{http_code}', url, ...headers.flatMap((h) => ['-H', h])], { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  let p = null; try { p = JSON.parse(out.slice(0, i)); } catch { p = {}; }
  return { status: Number(out.slice(i + 1)), payload: p };
};
const errOf = (r) => (r.payload?.error ? { code: r.payload.error.code, reason: r.payload.error?.details?.reason ?? null, message: r.payload.error.message } : null);

// ---- 登录（私钥只读进进程、不打印）
const FIX = readEnvFile(`${process.env.HOME}/.config/seafood/sf14qa-test-account.env`);
const wallet = new Wallet(FIX.PRIVATE_KEY);
const ch = post(`${API}/api/auth/challenge`, { evm_address: FIX.EVM_ADDRESS });
const sig = await wallet.signMessage(ch.payload.data.message);
const ve = post(`${API}/api/auth/verify`, { evm_address: FIX.EVM_ADDRESS, signature: sig, challenge_token: ch.payload.data.challenge_token });
const token = ve.payload.data.token;
const hdr = [`Authorization: Bearer ${token}`];
const uid = ve.payload.data.uID ?? ve.payload.data.uid;
const head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const health = get(`${API}/api/health`);

// ================================================================ AC-2
const ac2 = { ac: 'AC-2', at: new Date().toISOString(), head_under_test: head, api: API, auth: { login_verify_status: ve.status, uid, token_len: token.length }, health_schema: health.payload?.schema ?? health.payload?.data?.schema ?? null, checks: [], reads: {} };
const chk = (id, pass, detail) => ac2.checks.push({ id, pass, detail });

ac2.auth = { ...ac2.auth };
const noAuth = post(`${API}/api/telegram/bind/confirm`, { code: '1234567' });
ac2.reads.no_auth = { status: noAuth.status, err: errOf(noAuth) };

const shapes = [
  { input: '1234567', desc: '7 位' },
  { input: '123456789', desc: '9 位' },
  { input: 'AB123456', desc: '含字母' },
  { input: '1234 5678', desc: '含空格' },
];
ac2.reads.shape_cases = shapes.map((s) => {
  const r = post(`${API}/api/telegram/bind/confirm`, { code: s.input }, hdr);
  return { input: s.input, desc: s.desc, status: r.status, err: errOf(r), raw_data: r.payload?.data ?? null };
});
for (const c of ac2.reads.shape_cases) {
  chk(`形状闸 ${c.desc}（${JSON.stringify(c.input)}）⇒ 400 + TG_CODE_INVALID + reason=SHAPE_INVALID`,
    c.status === 400 && c.err?.code === 'TG_CODE_INVALID' && c.err?.reason === 'SHAPE_INVALID', c);
}

// 合法 8 位码（webhook 签发）⇒ 不落形状分支
const TG_A = 990001401;
const secretHdr = [`x-telegram-bot-api-secret-token: ${env.TELEGRAM_WEBHOOK_SECRET}`];
const wh1 = post(`${API}/api/telegram/webhook`, { message: { from: { id: TG_A }, text: '/start' } }, secretHdr);
const issued = await sql`SELECT req_id, code, tg_user_id, iat, exp, consumed_at FROM public.telegram_bind_request WHERE tg_user_id = ${TG_A} ORDER BY req_id DESC LIMIT 1`;
const codeA = issued[0]?.code ?? null;
const confA = post(`${API}/api/telegram/bind/confirm`, { code: codeA }, hdr);
ac2.reads.valid_code = { tg_id: TG_A, webhook_status: wh1.status, issued_row: issued[0] ? { req_id: issued[0].req_id, code_masked: `${String(codeA).slice(0, 2)}****${String(codeA).slice(-2)}`, digit_count: String(codeA).length, consumed_at: issued[0].consumed_at } : null, confirm: { status: confA.status, err: errOf(confA), data: confA.payload?.data ?? null } };
chk('合法 8 位数字码 ⇒ 不落形状分支（非 400/非 SHAPE_INVALID；落 200 成功或业务分支）',
  confA.status !== 400 || errOf(confA)?.reason !== 'SHAPE_INVALID', ac2.reads.valid_code.confirm);
chk('合法码 confirm 成功 ⇒ 200 + tg_linked=true（形状闸未误杀）',
  confA.status === 200 && confA.payload?.data?.tg_linked === true, confA.payload?.data ?? null);

// 查无 8 位码 ⇒ 404 且 reason ≠ SHAPE_INVALID（对照）
const UNKNOWN = '91919191';
const exists = await sql`SELECT count(*)::int AS n FROM public.telegram_bind_request WHERE code = ${UNKNOWN}`;
const confU = post(`${API}/api/telegram/bind/confirm`, { code: UNKNOWN }, hdr);
ac2.reads.unknown_code = { input: UNKNOWN, rows_in_db: exists[0]?.n ?? null, status: confU.status, err: errOf(confU), body_keys: confU.payload && typeof confU.payload === 'object' ? Object.keys(confU.payload) : null, raw: JSON.stringify(confU.payload).slice(0, 300) };
chk('查无 8 位码 ⇒ 404 且 reason ≠ SHAPE_INVALID（防同名回归）',
  ac2.reads.unknown_code.rows_in_db === 0 && confU.status === 404 && (confU.payload?.error?.details?.reason ?? null) !== 'SHAPE_INVALID', ac2.reads.unknown_code);
chk('免鉴权 confirm ⇒ 401', noAuth.status === 401, ac2.reads.no_auth);
ac2.verdict = ac2.checks.every((c) => c.pass) ? 'PASS' : 'FAIL';

// ================================================================ AC-3（往返 + 冷却 + 门套）
const ac3 = { ac: 'AC-3', at: new Date().toISOString(), head_under_test: head, checks: [], reads: {} };
const c3 = (id, pass, detail) => ac3.checks.push({ id, pass, detail });

const before = await sql`SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid = ${uid}`;
const status0 = get(`${API}/api/telegram/bind/status`, hdr);
// 清场（AC-2 已把本账号绑到 TG_A）：unbind ⇒ 再验只读库回 null
const clean = post(`${API}/api/telegram/unbind`, {}, hdr);
const dbClean = await sql`SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid = ${uid}`;
// AC-3 自己的新鲜码（另一合成 tg id）
const TG_C = 990001403;
const whC = post(`${API}/api/telegram/webhook`, { message: { from: { id: TG_C }, text: '/start' } }, secretHdr);
const issuedC = await sql`SELECT req_id, code, tg_user_id, iat, exp, consumed_at FROM public.telegram_bind_request WHERE tg_user_id = ${TG_C} ORDER BY req_id DESC LIMIT 1`;
const codeC = issuedC[0]?.code ?? null;
const conf = post(`${API}/api/telegram/bind/confirm`, { code: codeC }, hdr);
const status1 = get(`${API}/api/telegram/bind/status`, hdr);
const dbAfterBind = await sql`SELECT uid, tg_user_id FROM public.users WHERE uid = ${uid}`;
const consumed = await sql`SELECT req_id, consumed_at FROM public.telegram_bind_request WHERE code = ${codeC}`;
// 已消费码重放（跨记录观察，不计判定）
const replay = post(`${API}/api/telegram/bind/confirm`, { code: codeC }, hdr);
const unbind = post(`${API}/api/telegram/unbind`, {}, hdr);
const status2 = get(`${API}/api/telegram/bind/status`, hdr);
const dbAfterUnbind = await sql`SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid = ${uid}`;

ac3.reads = {
  user_before: before[0] ?? null,
  status_before: { status: status0.status, data: status0.payload?.data ?? null, has_tg_user_id: JSON.stringify(status0.payload).includes('tg_user_id') },
  clean_unbind: { status: clean.status, data: clean.payload?.data ?? null },
  user_after_clean: dbClean[0] ?? null,
  fresh_code: issuedC[0] ? { req_id: issuedC[0].req_id, code_masked: `${String(codeC).slice(0, 2)}****${String(codeC).slice(-2)}`, digit_count: String(codeC).length, consumed_at_at_issue: issuedC[0].consumed_at } : null,
  webhook_issue_status: whC.status,
  confirm: { status: conf.status, err: errOf(conf), data: conf.payload?.data ?? null },
  status_after_bind: { status: status1.status, data: status1.payload?.data ?? null, has_tg_user_id: JSON.stringify(status1.payload).includes('tg_user_id') },
  db_after_bind_row: dbAfterBind[0] ?? null,
  bind_request_consumed_at: consumed[0]?.consumed_at ?? null,
  consumed_code_replay: { status: replay.status, err: errOf(replay) },
  unbind: { status: unbind.status, data: unbind.payload?.data ?? null },
  status_after_unbind: { status: status2.status, data: status2.payload?.data ?? null },
  user_after_unbind: dbAfterUnbind[0] ?? null,
};
const tgValue = dbAfterBind[0]?.tg_user_id;
c3('往返：confirm ⇒ 200 tg_linked=true', conf.status === 200 && conf.payload?.data?.tg_linked === true, ac3.reads.confirm);
c3('往返：confirm 后 users.tg_user_id 非空（值不回显，仅记类型/长度）',
  tgValue !== null && tgValue !== undefined, { type: typeof tgValue, len: tgValue === null || tgValue === undefined ? 0 : String(tgValue).length, matches_webhook_tg_id: String(tgValue) === String(TG_A) });
c3('往返：bind_request.consumed_at 已落（非空）', consumed[0]?.consumed_at != null, consumed[0] ?? null);
c3('status 绑定后 linked=true 且响应不含 tg_user_id 数值（隐私读面）',
  status1.payload?.data?.tg_linked === true && !ac3.reads.status_after_bind.has_tg_user_id, ac3.reads.status_after_bind);
c3('unbind ⇒ 200', unbind.status === 200, ac3.reads.unbind);
c3('unbind 后 status linked=false', status2.payload?.data?.tg_linked === false, ac3.reads.status_after_unbind);
c3('★ 只读库终态：users.tg_user_id 回 null 且 tg_linked_at 回 null',
  dbAfterUnbind[0]?.tg_user_id === null && dbAfterUnbind[0]?.tg_linked_at === null, ac3.reads.user_after_unbind);

// 冷却闸：同 id 60s 内二次 /start ⇒ 200 且不落第二行
const TG_B = 990001402;
const b1 = post(`${API}/api/telegram/webhook`, { message: { from: { id: TG_B }, text: '/start' } }, secretHdr);
const rows1 = await sql`SELECT count(*)::int AS n FROM public.telegram_bind_request WHERE tg_user_id = ${TG_B}`;
const b2 = post(`${API}/api/telegram/webhook`, { message: { from: { id: TG_B }, text: '/start' } }, secretHdr);
const rows2 = await sql`SELECT count(*)::int AS n FROM public.telegram_bind_request WHERE tg_user_id = ${TG_B}`;
ac3.reads.cooldown = { tg_id: TG_B, first: { status: b1.status }, second: { status: b2.status }, rows_after_first: rows1[0]?.n ?? null, rows_after_second: rows2[0]?.n ?? null };
c3('冷却闸 60s：同 id 二次 /start 恒 200 且不落第二行（行数不变）',
  b1.status === 200 && b2.status === 200 && rows1[0]?.n === 1 && rows2[0]?.n === 1, ac3.reads.cooldown);
ac3.verdict = ac3.checks.every((c) => c.pass) ? 'PASS' : 'FAIL';

fs.writeFileSync(`${OUTDIR}/ac2-shape-reason.json`, JSON.stringify(ac2, null, 2));
fs.writeFileSync(`${OUTDIR}/ac3-regression.json`, JSON.stringify({ ...ac3, gates: '见 gates/（另跑）' }, null, 2));
console.log(JSON.stringify({
  ac2: { verdict: ac2.verdict, checks: ac2.checks.length, failed: ac2.checks.filter((c) => !c.pass), shape_cases: ac2.reads.shape_cases, no_auth: ac2.reads.no_auth.status, valid: ac2.reads.valid_code.confirm, unknown: ac2.reads.unknown_code },
  ac3: { verdict: ac3.verdict, checks: ac3.checks.length, failed: ac3.checks.filter((c) => !c.pass), user_after_unbind: ac3.reads.user_after_unbind, cooldown: ac3.reads.cooldown },
}, null, 2));
