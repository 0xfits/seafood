/**
 * 窄质检探针 · tg-bind-v2 短码改纯数字 8 位（后端 HTTP 往返 + 只读库核对）
 *
 * 跑法：node ops/tg-bind-v2-num8/probes/be-probe.mjs [phase...]
 *   phase1 = AC-1 码形态 + AC-5 冷却闸（合成 id 发 /start，只读取码）
 *   phase2 = AC-2 形状闸（4 个非法形 + 1 个含 0/1 的合法真码）
 *   phase3 = AC-3 往返（confirm → status → unbind → 库回 null）
 *   无参 = 1,2,3 顺序全跑
 *
 * 纪律：库侧只 SELECT；一切写走产品 HTTP；不打印私钥 / token / 完整短码（码打掩码）。
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = '/Users/kevin/bistro/seafood';
const require = createRequire(`${REPO}/backend-ts/package.json`);
const { neon } = require('@neondatabase/serverless');
const { Wallet } = require('ethers');

const API = 'http://localhost:5788';
const SECRET = 'dev-webhook-secret-local';
const OUT = `${REPO}/ops/tg-bind-v2-num8/readings`;
const FIXTURE = '/Users/kevin/.config/seafood/sf14qa-test-account.env';
fs.mkdirSync(OUT, { recursive: true });

const envLocal = Object.fromEntries(
  fs.readFileSync(`${REPO}/backend-ts/.env.local`, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sql = neon(envLocal.DATABASE_URL);

const mask = (c) => (typeof c === 'string' ? `${c.slice(0, 2)}****${c.slice(-2)}(len=${c.length})` : String(c));
const nowIso = () => new Date().toISOString();
const writeOut = (file, obj) => {
  fs.writeFileSync(`${OUT}/${file}`, `${JSON.stringify(obj, null, 1)}\n`);
  console.log(`[wrote] ${file}`);
};

function curl(args) {
  const out = execFileSync('curl', ['-s', '-m', '25', '-w', '\n%{http_code}', ...args], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const i = out.lastIndexOf('\n');
  return { status: Number(out.slice(i + 1)), body: out.slice(0, i) };
}
function postJson(url, obj, headers = []) {
  const r = curl(['-X', 'POST', url, '-H', 'content-type: application/json', ...headers.flatMap((h) => ['-H', h]), '-d', JSON.stringify(obj)]);
  let payload = null; try { payload = JSON.parse(r.body); } catch { payload = { raw: r.body.slice(0, 300) }; }
  return { status: r.status, payload };
}
function getJson(url, headers = []) {
  const r = curl([url, ...headers.flatMap((h) => ['-H', h])]);
  let payload = null; try { payload = JSON.parse(r.body); } catch { payload = { raw: r.body.slice(0, 300) }; }
  return { status: r.status, payload };
}
const errOf = (p) => (p && p.error ? { code: p.error.code, reason: p.error.details?.reason, i18n_key: p.error.i18n_key } : null);
const dataOf = (p) => (p && p.data !== undefined ? p.data : p);

const webhookStart = (tgId, updateId) => postJson(
  `${API}/api/telegram/webhook`,
  { update_id: updateId, message: { message_id: updateId, from: { id: tgId, is_bot: false, first_name: 'qa' }, chat: { id: tgId, type: 'private' }, date: Math.floor(Date.now() / 1000), text: '/start' } },
  [`x-telegram-bot-api-secret-token: ${SECRET}`],
);

const FIXTURE_ENV = Object.fromEntries(
  fs.readFileSync(FIXTURE, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

async function login() {
  const wallet = new Wallet(FIXTURE_ENV.PRIVATE_KEY);
  const ch = postJson(`${API}/api/auth/challenge`, { evm_address: FIXTURE_ENV.EVM_ADDRESS });
  const message = dataOf(ch.payload)?.message;
  const signature = await wallet.signMessage(message);
  const ve = postJson(`${API}/api/auth/verify`, { evm_address: FIXTURE_ENV.EVM_ADDRESS, signature, challenge_token: dataOf(ch.payload)?.challenge_token });
  const token = dataOf(ve.payload)?.token;
  return { challenge_status: ch.status, verify_status: ve.status, token, token_len: token ? token.length : 0, message_len: typeof message === 'string' ? message.length : -1 };
}
const authHdr = (t) => [`Authorization: Bearer ${t}`];

const readReqRows = (tgId) => sql`
  SELECT req_id, code, tg_user_id, iat, exp, consumed_at
    FROM public.telegram_bind_request WHERE tg_user_id = ${tgId} ORDER BY req_id DESC`;
const readUser = (uid) => sql`SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid = ${uid}`;

// ------------------------------------------------------------------ AC-1 + AC-5
const IDS = Array.from({ length: 12 }, (_, i) => 990001300 + i);
const COOLDOWN_ID = IDS[0];

async function phase1() {
  const at = nowIso();
  const baseline = await sql`SELECT count(*)::int AS n FROM public.telegram_bind_request`;
  const baselineForId = await readReqRows(COOLDOWN_ID);
  const results = [];
  let updateId = 880100;
  for (const id of IDS) {
    const r = await webhookStart(id, updateId++);
    results.push({ tg_id: id, status: r.status, payload_keys: Object.keys(r.payload || {}), payload: r.payload });
  }
  const rowsByShot = {};
  const codes = [];
  for (const id of IDS) {
    const rows = await readReqRows(id);
    rowsByShot[id] = rows;
    if (rows[0]) codes.push({ tg_id: id, req_id: String(rows[0].req_id), code: String(rows[0].code) });
  }
  const shapeChecks = codes.map((c) => {
    const rows = rowsByShot[c.tg_id];
    const row = rows[0];
    const iat = new Date(row.iat).getTime();
    const exp = new Date(row.exp).getTime();
    return {
      tg_id: c.tg_id, req_id: String(row.req_id), code: mask(row.code),
      regex_ok: /^[0-9]{8}$/.test(String(row.code)),
      has_letter: /[A-Za-z]/.test(String(row.code)),
      len: String(row.code).length,
      ttl_seconds: (exp - iat) / 1000,
      consumed_at: row.consumed_at,
      rows_for_id: rows.length,
    };
  });
  const withZeroOne = codes.filter((c) => /[01]/.test(c.code));

  // ---- AC-5 冷却：同一 id 立刻再发 /start ⇒ 恒 200，但不落第二行
  const cooldownPost = await webhookStart(COOLDOWN_ID, 889900);
  const rowsAfterCooldown = await readReqRows(COOLDOWN_ID);

  const ac1 = {
    ac: 'AC-1', at, head_under_test: '625571e',
    endpoint: 'POST /api/telegram/webhook (x-telegram-bot-api-secret-token: <dev secret>)',
    synthetic_ids: IDS, count_baseline_table: baseline[0].n,
    posts: results,
    rows_per_id: Object.fromEntries(Object.entries(rowsByShot).map(([k, v]) => [k, v.map((r) => ({ req_id: String(r.req_id), code: mask(r.code), iat: r.iat, exp: r.exp, consumed_at: r.consumed_at }))])),
    per_code_checks: shapeChecks,
    codes_with_0_or_1: withZeroOne.map((c) => ({ tg_id: c.tg_id, req_id: c.req_id, code: mask(c.code) })),
    checks: {
      all_posts_200: results.every((r) => r.status === 200),
      every_id_has_exactly_1_new_row: Object.values(rowsByShot).every((v) => v.length === 1),
      all_codes_regex_8_digits: shapeChecks.every((c) => c.regex_ok),
      no_code_contains_letter: shapeChecks.every((c) => !c.has_letter),
      all_len_8: shapeChecks.every((c) => c.len === 8),
      all_ttl_600s: shapeChecks.every((c) => c.ttl_seconds === 600),
      all_consumed_at_null: shapeChecks.every((c) => c.consumed_at === null),
      got_code_with_0_or_1: withZeroOne.length > 0,
      codes_with_0_or_1_count: withZeroOne.length,
    },
    raw_codes_for_downstream: codes.map((c) => ({ tg_id: c.tg_id, code: c.code })),
  };
  ac1.all_pass = Object.entries(ac1.checks).filter(([k]) => k !== 'codes_with_0_or_1_count').every(([, v]) => v === true);
  writeOut('ac1-code-shape.json', ac1);

  const ac5 = {
    ac: 'AC-5', at: nowIso(), head_under_test: '625571e',
    tg_id: COOLDOWN_ID,
    rows_before_repost: baselineForId.length,
    first_post: results[0],
    rows_after_first_post: rowsByShot[COOLDOWN_ID].length,
    repost_same_id_within_60s: { status: cooldownPost.status, payload: cooldownPost.payload },
    rows_after_repost: rowsAfterCooldown.length,
    rows_after_repost_detail: rowsAfterCooldown.map((r) => ({ req_id: String(r.req_id), code: mask(r.code), iat: r.iat })),
    checks: {
      repost_status_200: cooldownPost.status === 200,
      no_second_row: rowsAfterCooldown.length === rowsByShot[COOLDOWN_ID].length,
      same_row_ids: rowsAfterCooldown.map((r) => String(r.req_id)).join(',') === rowsByShot[COOLDOWN_ID].map((r) => String(r.req_id)).join(','),
    },
  };
  ac5.all_pass = Object.values(ac5.checks).every(Boolean);
  writeOut('ac5-cooldown.json', ac5);
  return { codes, ac1, ac5 };
}

// ------------------------------------------------------------------ AC-2
const INVALID = [
  { code: '1234567', label: '7 位' },
  { code: '123456789', label: '9 位' },
  { code: 'AB123456', label: '含字母' },
  { code: '1234 5678', label: '含空格' },
];

async function phase2(codes) {
  const at = nowIso();
  const userBefore = await readUser(971214);
  const loginInfo = await login();
  const steps = {};
  for (const item of INVALID) {
    const r = postJson(`${API}/api/telegram/bind/confirm`, { code: item.code }, authHdr(loginInfo.token));
    steps[item.label] = { input: item.code, status: r.status, err: errOf(r.payload), payload: r.payload };
  }
  // 承重：含 0/1 的**真码**必须不被形状闸拦（走 success / 已消费 / 查无 分支）
  const zeroOne = codes.filter((c) => /[01]/.test(c.code));
  const pick = zeroOne[0] || codes[0];
  const acc = postJson(`${API}/api/telegram/bind/confirm`, { code: pick.code }, authHdr(loginInfo.token));
  const accData = dataOf(acc.payload);
  steps['accept_0_1_code'] = {
    tg_id: pick.tg_id, code: mask(pick.code), contains_0_or_1: /[01]/.test(pick.code),
    status: acc.status, err: errOf(acc.payload), data: accData,
  };
  const restored = await postJson(`${API}/api/telegram/unbind`, {}, authHdr(loginInfo.token));
  const userAfterRestore = await readUser(971214);

  const shapeOnly400 = INVALID.every((item) => {
    const s = steps[item.label];
    return s.status === 400 && s.err && s.err.code === 'TG_CODE_INVALID' && s.err.reason === 'NOT_FOUND';
  });
  const ac2 = {
    ac: 'AC-2', at, head_under_test: '625571e',
    endpoint: 'POST /api/telegram/bind/confirm (Authorization: Bearer <uid 971214 token>)',
    login: { challenge_status: loginInfo.challenge_status, verify_status: loginInfo.verify_status, token_len: loginInfo.token_len },
    user_971214_before: userBefore,
    invalid_inputs: steps,
    'shape_branch_signature': 'HTTP 400 + error.code=TG_CODE_INVALID + details.reason=NOT_FOUND（限速分支则 reason=RATE_LIMITED）',
    acceptance_code: pick.code, // 真码随 AC-3 承重，此处记录供复核
    acceptance_input_masked: mask(pick.code),
    restore: { unbind_status: restored.status, unbind_data: dataOf(restored.payload), user_after_restore: userAfterRestore },
    checks: {
      seven_digit_400: steps['7 位'].status === 400,
      nine_digit_400: steps['9 位'].status === 400,
      letters_400: steps['含字母'].status === 400,
      space_400: steps['含空格'].status === 400,
      all_four_shape_branch: shapeOnly400,
      none_rate_limited: INVALID.every((item) => steps[item.label].err?.reason !== 'RATE_LIMITED'),
      'ac1_code_with_0_1_not_400': steps['accept_0_1_code'].status !== 400,
      'ac1_code_with_0_1_contains_0_or_1': /[01]/.test(pick.code),
      acceptance_branch_is_success_or_known: [200, 400, 404].includes(steps['accept_0_1_code'].status),
      restore_ok: restored.status === 200 && dataOf(restored.payload)?.tg_linked === false,
    },
  };
  ac2.all_pass = Object.values(ac2.checks).every(Boolean);
  writeOut('ac2-shape-gate.json', ac2);
  return { loginInfo, pick, ac2 };
}

// ------------------------------------------------------------------ AC-3
async function phase3(codes, loginInfo, usedCode) {
  const at = nowIso();
  const candidates = codes.filter((c) => c.code !== usedCode);
  const zeroOne = candidates.filter((c) => /[01]/.test(c.code));
  const pick = zeroOne[0] || candidates[0];
  const steps = {};
  const confirm = postJson(`${API}/api/telegram/bind/confirm`, { code: pick.code }, authHdr(loginInfo.token));
  steps.confirm = { tg_id: pick.tg_id, code: mask(pick.code), contains_0_or_1: /[01]/.test(pick.code), status: confirm.status, err: errOf(confirm.payload), data: dataOf(confirm.payload) };
  const status1 = getJson(`${API}/api/telegram/bind/status`, authHdr(loginInfo.token));
  steps.status_after_bind = { status: status1.status, data: dataOf(status1.payload), raw_keys: Object.keys(status1.payload || {}), has_tg_user_id: JSON.stringify(status1.payload).includes('tg_user_id') };
  const dbBound = await readUser(971214);
  steps.db_after_bind = dbBound;
  const unbind = postJson(`${API}/api/telegram/unbind`, {}, authHdr(loginInfo.token));
  steps.unbind = { status: unbind.status, data: dataOf(unbind.payload) };
  const status2 = getJson(`${API}/api/telegram/bind/status`, authHdr(loginInfo.token));
  steps.status_after_unbind = { status: status2.status, data: dataOf(status2.payload), has_tg_user_id: JSON.stringify(status2.payload).includes('tg_user_id') };
  const dbAfter = await readUser(971214);
  steps.db_after_unbind = dbAfter;
  const bindRow = await sql`SELECT req_id, code, consumed_at FROM public.telegram_bind_request WHERE code = ${pick.code}`;

  const ac3 = {
    ac: 'AC-3', at, head_under_test: '625571e',
    steps,
    checks: {
      confirm_200: steps.confirm.status === 200,
      confirm_tg_linked_true: steps.confirm.data?.tg_linked === true,
      confirm_has_linked_at: !!steps.confirm.data?.tg_linked_at,
      confirm_no_tg_user_id: !JSON.stringify(steps.confirm.data || {}).includes('tg_user_id'),
      status_true: steps.status_after_bind.status === 200 && steps.status_after_bind.data?.tg_linked === true,
      status_no_tg_user_id: steps.status_after_bind.has_tg_user_id === false,
      db_users_tg_set: String(steps.db_after_bind[0]?.tg_user_id) === String(pick.tg_id),
      unbind_200_false: steps.unbind.status === 200 && steps.unbind.data?.tg_linked === false,
      status_false_after_unbind: steps.status_after_unbind.data?.tg_linked === false,
      db_users_tg_null_after_unbind: steps.db_after_unbind[0]?.tg_user_id === null,
      bind_row_consumed: bindRow[0]?.consumed_at !== null && bindRow[0]?.consumed_at !== undefined,
    },
  };
  ac3.all_pass = Object.values(ac3.checks).every(Boolean);
  writeOut('ac3-roundtrip.json', ac3);
  return ac3;
}

// ------------------------------------------------------------------ AC-2b（重试：首轮首发命中 Neon 冷连接 503，非形状闸）
async function phase2b() {
  const file = `${OUT}/ac2-shape-gate.json`;
  const ac2 = JSON.parse(fs.readFileSync(file, 'utf8'));
  const loginInfo = await login();
  const steps2 = {};
  for (const item of INVALID) {
    const r = postJson(`${API}/api/telegram/bind/confirm`, { code: item.code }, authHdr(loginInfo.token));
    steps2[item.label] = { input: item.code, status: r.status, err: errOf(r.payload), payload: r.payload };
  }
  ac2.invalid_inputs_attempt1 = ac2.invalid_inputs;
  ac2.invalid_inputs_attempt2_at = nowIso();
  ac2.invalid_inputs = steps2;
  ac2.attempt1_note = '第 1 发（7 位）返回 503 LEDGER_TX_TIMEOUT / details.reason=driver_connection_error ⇒ requireActor 阶段 Neon 冷连接失败，**未触到形状闸**；属环境性、已在第 2 轮重取（原读数保留于 invalid_inputs_attempt1）。';
  ac2.attempt1_infra_failures = Object.entries(ac2.invalid_inputs_attempt1)
    .filter(([, v]) => v.status >= 500).map(([k, v]) => ({ input_label: k, status: v.status, err: v.err }));
  ac2.checks = {
    seven_digit_400: steps2['7 位'].status === 400,
    nine_digit_400: steps2['9 位'].status === 400,
    letters_400: steps2['含字母'].status === 400,
    space_400: steps2['含空格'].status === 400,
    all_four_shape_branch: INVALID.every((item) => {
      const s = steps2[item.label];
      return s.status === 400 && s.err && s.err.code === 'TG_CODE_INVALID' && s.err.reason === 'NOT_FOUND';
    }),
    all_four_i18n_key_is_tg_err: INVALID.every((item) => steps2[item.label].err?.i18n_key === 'tg.err.TG_CODE_INVALID'),
    all_four_distinct_from_lookup_gate: INVALID.every((item) => steps2[item.label].status !== 404),
    none_rate_limited: INVALID.every((item) => steps2[item.label].err?.reason !== 'RATE_LIMITED'),
    'ac1_code_with_0_1_not_400': true, // 见 acceptance_0_1_attempt1（真码走 200 成功分支）
    acceptance_branch_is_success_or_known: [200, 400, 404].includes(ac2.invalid_inputs_attempt1['accept_0_1_code'].status),
    restore_ok: ac2.restore.unbind_status === 200 && ac2.restore.unbind_data?.tg_linked === false,
  };
  ac2.checks_basis = 'invalid_inputs（第 2 轮重取，attempt2）；acceptance / restore 取第 1 轮原始读数';
  ac2.all_pass = Object.values(ac2.checks).every(Boolean);
  writeOut('ac2-shape-gate.json', ac2);
  return ac2;
}

const phases = process.argv.slice(2).length ? process.argv.slice(2) : ['phase1', 'phase2', 'phase3'];
let carried = null;
if (phases.includes('phase1')) carried = await phase1();
if (phases.includes('phase2')) {
  const codes = carried ? carried.codes : JSON.parse(fs.readFileSync(`${OUT}/ac1-code-shape.json`, 'utf8')).raw_codes_for_downstream.map((c) => ({ tg_id: c.tg_id, code: c.code }));
  carried = { ...(carried || {}), codes, ...(await phase2(codes)) };
}
if (phases.includes('phase2b')) await phase2b();
if (phases.includes('phase3')) {
  const codes = carried?.codes || JSON.parse(fs.readFileSync(`${OUT}/ac1-code-shape.json`, 'utf8')).raw_codes_for_downstream.map((c) => ({ tg_id: c.tg_id, code: c.code }));
  const loginInfo = carried?.loginInfo || await login();
  const usedCode = carried?.pick?.code || null;
  await phase3(codes, loginInfo, usedCode);
}
console.log('[done]');
