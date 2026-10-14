/**
 * 准备件（只读库 + 登录 token 落 scratch 文件，不打印）+ 副作用披露读数
 * 跑法：node /Users/kevin/bistro/seafood/ops/tg-notify-preview/probes/prep-token-sides.mjs
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = '/Users/kevin/bistro/seafood';
const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch';
const require = createRequire(`${REPO}/backend-ts/package.json`);
const { neon } = require('@neondatabase/serverless');
const { Wallet } = require('ethers');
const API = 'http://localhost:5788';
const readEnvFile = (p) => Object.fromEntries(fs.readFileSync(p, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const env = readEnvFile(`${REPO}/backend-ts/.env.local`);
const sql = neon(env.DATABASE_URL);
const post = (url, obj) => {
  const out = execFileSync('curl', ['-s', '-m', '25', '-w', '\n%{http_code}', '-X', 'POST', url,
    '-H', 'content-type: application/json', '-d', JSON.stringify(obj)], { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  let p = null; try { p = JSON.parse(out.slice(0, i)); } catch { p = { raw: out.slice(0, i).slice(0, 200) }; }
  return { status: Number(out.slice(i + 1)), payload: p };
};

const FIX = readEnvFile(`${process.env.HOME}/.config/seafood/sf14qa-test-account.env`);
const wallet = new Wallet(FIX.PRIVATE_KEY);
const ch = post(`${API}/api/auth/challenge`, { evm_address: FIX.EVM_ADDRESS });
const sig = await wallet.signMessage(ch.payload.data.message);
const ve = post(`${API}/api/auth/verify`, { evm_address: FIX.EVM_ADDRESS, signature: sig, challenge_token: ch.payload.data.challenge_token });
const token = ve.payload.data.token;
fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(`${SCRATCH}/qa-token.txt`, token, { mode: 0o600 });

const rows = await sql`SELECT req_id, tg_user_id, iat, exp, consumed_at, code FROM public.telegram_bind_request
  WHERE tg_user_id IN (990001401, 990001402, 990001403) ORDER BY req_id`;
const total = await sql`SELECT count(*)::int AS n FROM public.telegram_bind_request`;
const maxReq = await sql`SELECT max(req_id)::int AS mx FROM public.telegram_bind_request`;
const user = await sql`SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid = 971214`;
const gitStatus = execFileSync('bash', ['-lc', `cd ${REPO} && git status --porcelain | head -20 && echo "--- docs ---" && git status --porcelain -- docs/ | wc -l && echo "--- head ---" && git rev-parse HEAD && echo "--- behind ---" && git rev-list --count origin/main..HEAD`], { encoding: 'utf8' });

const out = {
  at: new Date().toISOString(),
  token_file: `${SCRATCH}/qa-token.txt (mode 0600, token 未打印, len=${token.length})`,
  auth: { verify_status: ve.status, uid: ve.payload.data.uID ?? ve.payload.data.uid, token_len: String(token).length },
  synthetic_bind_rows: rows.map((r) => ({ req_id: r.req_id, tg_user_id: r.tg_user_id, code_masked: `${String(r.code).slice(0, 2)}****${String(r.code).slice(-2)}`, digit_count: String(r.code).length, iat: r.iat, exp: r.exp, exp_minus_iat_s: (new Date(r.exp).getTime() - new Date(r.iat).getTime()) / 1000, consumed_at: r.consumed_at })),
  synthetic_chat_ids_disclosed: [990001401, 990001402, 990001403],
  table_totals: { rows_total: total[0]?.n ?? null, max_req_id: maxReq[0]?.mx ?? null },
  user_971214_final: user[0] ?? null,
  git: gitStatus.trim().split('\n'),
};
fs.writeFileSync(`${REPO}/ops/tg-notify-preview/readings/side-effects.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ token_len: String(token).length, uid: out.auth.uid, synthetic_rows: out.synthetic_bind_rows.length, totals: out.table_totals, user_final: out.user_971214_final, git: out.git }, null, 1));
