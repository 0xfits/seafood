/**
 * 行为探针 · `GET /api/ops/recon/ledger`（**零真实 DB / 零写库 / 零网络**）
 * ---------------------------------------------------------------------------
 * 用法（cwd = backend-ts）：
 *   npx ts-node --transpile-only ../ops/recon-cron/probe/recon-probe.ts
 *
 * 做法：在**进程内**把 `db.readQuery` 换成桩（`ops-recon.ts` 侧是 `db_1.readQuery(...)`
 *   属性取值 ⇒ 桩生效），鉴权闸 / 判定逻辑 / 回执组装**全部走真码**。
 *   ⇒ 本探针证的是：① CRON_SECRET 三档（503/401/200）；② 三条检查都在场且真被调用；
 *     ③ 判定**不是恒绿**（同一端点喂漂移夹具 ⇒ `ok` 必须翻 false）。
 *
 * 密钥口径：只从 `process.env` 读；**打印的只有长度与来源**，绝不回显值；
 *   并对回执原文做一次「是否包含密钥」的字面检查（防回显回归）。
 */
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';

const BACKEND_ROOT = path.resolve(__dirname, '../../../backend-ts');
const OUT_DIR = process.env.PROBE_OUT_DIR
  ? path.resolve(process.env.PROBE_OUT_DIR)
  : path.resolve(__dirname, '../readings');

// ---- ① 先把 db 模块拿到手并换桩（必须在 index 被 require 之前）---------------
/* eslint-disable @typescript-eslint/no-var-requires */
const db = require(path.join(BACKEND_ROOT, 'src/db'));

type Row = Record<string, unknown>;
type StubMode =
  | 'clean'
  | 'supply_drift'
  | 'unregistered_cid_baseline'
  | 'account_drift'
  | 'batt_drift'
  | 'supply_drift_late'
  | 'supply_all_pass_25';

let mode: StubMode = 'clean';
const calls: Array<{ sql: string; rows: number }> = [];

/** 夹具：与报告 §3.1 的生产现取同形（cid=1 的 diff 恰为已登记基线 2000000）。 */
const supplyRows = (diff: string, extra?: Row[]): Row[] => ([
  {
    cid: 1,
    symbol: '$',
    total_supply: '2010200',
    sum_mint: '210274',
    sum_burn: '-200074',
    ledger_derived: '10200',
    diff,
  },
  ...(extra ?? []),
]);

/**
 * 回归夹具（Zang 审阅修复 · 25 行）：cid=1 的 diff = 已登记基线 2000000（PASS），
 * 另 24 行 cid 9001..9024 的未登记基线 = 0、diff = 0（PASS）。
 * `failAt=21` ⇒ 第 22 行（cid 9021）diff 改成 1（≠ 基线 0）⇒ **前 21 行全 PASS、第 22 行 FAIL**。
 * 旧实现会把该失败行推进 `sample` 后又被 `slice(0,20)` 切掉（定位样本丢失）；
 * 两阶段采集后它必须出现在 `sample` 首位。
 */
const supplyBulkRows = (failAt: number | null): Row[] => {
  const rows: Row[] = [{
    cid: 1, symbol: '$', total_supply: '2010200', sum_mint: '210274', sum_burn: '-200074',
    ledger_derived: '10200', diff: '2000000',
  }];
  for (let i = 1; i <= 24; i += 1) {
    const drift = failAt !== null && i === failAt;
    rows.push({
      cid: 9000 + i, symbol: 'PROBE',
      total_supply: drift ? '1' : '0', sum_mint: drift ? '1' : '0', sum_burn: '0',
      ledger_derived: drift ? '1' : '0', diff: drift ? '1' : '0',
    });
  }
  return rows;
};

db.readQuery = async (text: string): Promise<Row[]> => {
  const sql = String(text);
  let rows: Row[] = [];
  if (sql.includes('FROM public.currency')) {
    if (mode === 'clean') rows = supplyRows('2000000');
    else if (mode === 'supply_drift') rows = supplyRows('2000001');
    else if (mode === 'unregistered_cid_baseline') {
      // cid=21 已登记基线 = 1 ⇒ 喂 diff=0 必须判 FAIL（证明基线表真生效，不是恒绿）。
      rows = supplyRows('2000000', [{ cid: 21, symbol: 'BTTC', total_supply: '5', sum_mint: '5', sum_burn: '0', ledger_derived: '5', diff: '0' }]);
    }
    // 回归①：25 行，前 21 行 PASS、第 22 行（cid 9021）FAIL ⇒ 失败行必须进 sample。
    else if (mode === 'supply_drift_late') rows = supplyBulkRows(21);
    // 回归②：同 25 行形状但全 PASS ⇒ PASS + diff='0'（证明两阶段采集不会把绿的判红）。
    else if (mode === 'supply_all_pass_25') rows = supplyBulkRows(null);
    else rows = supplyRows('2000000');
  } else if (sql.includes('FROM public.account')) {
    rows = mode === 'account_drift'
      ? [{ uid: '970001', cid: '1', balance: '10', sum_delta: '9', diff_balance: '1', frozen: '0', sum_frozen_delta: '0', diff_frozen: '0' }]
      : [];
  } else if (sql.includes('FROM public.batt_account')) {
    rows = mode === 'batt_drift'
      ? [{ uid: '970001', batt: '100', sum_delta: '90', diff: '10' }]
      : [];
  }
  calls.push({ sql: sql.slice(0, 40), rows: rows.length });
  return rows;
};

// ---- ② 加载真 app（env.ts 首 import 会注入 backend-ts/.env.local）-------------
process.env.VERCEL = '1';
const app = require(path.join(BACKEND_ROOT, 'src/index')).default;
const ENV_SECRET = String(process.env.CRON_SECRET || '').trim();
const SECRET = ENV_SECRET || 'probe-only-secret-not-the-real-one';
const WRONG = 'probe-wrong-secret-not-the-real-one';

type Reading = {
  id: string;
  method: string;
  url: string;
  auth: string;
  mode: string;
  status: number;
  body_keys: string[];
  data_keys?: string[];
  ok?: unknown;
  check_ids?: string[];
  check_status?: string[];
  rows?: number[];
  diff?: unknown;
  /** 供应量检查的 sample 形状（回归用：长度 / 首个 cid / 其中 ok=false 的 cid 集） */
  sample_len?: number;
  sample_first_cid?: string | null;
  sample_failed_cids?: string[];
  /** 三条检查的 diff 原值（PASS 时为 '0'，②③ 无该键 ⇒ null） */
  check_diff?: Array<string | null>;
  error_code?: string | null;
  message?: unknown;
  secret_echoed?: boolean;
  note: string;
};

const call = (method: string, url: string, headers: Record<string, string>): Promise<{ status: number; text: string; json: Row }> =>
  new Promise((resolve, reject) => {
    const addr = (httpServer.address() as AddressInfo).port;
    const req = http.request({ host: '127.0.0.1', port: addr, path: url, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: Row = {};
        try { json = JSON.parse(text) as Row; } catch { json = { _raw_head: text.slice(0, 200) }; }
        resolve({ status: res.statusCode || 0, text, json });
      });
    });
    req.on('error', reject);
    req.end();
  });

let httpServer: http.Server;

const dataOf = (json: Row): Row => (json.data && typeof json.data === 'object' ? (json.data as Row) : {});
const errCodeOf = (json: Row): string | null => {
  const e = json.error;
  if (e && typeof e === 'object' && 'code' in (e as Row)) return String((e as Row).code);
  return typeof json.code === 'string' ? json.code : null;
};

(async () => {
  httpServer = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise<void>((r) => httpServer.once('listening', () => r()));

  const URL_OK = '/api/ops/recon/ledger';
  const readings: Reading[] = [];
  const push = (r: Reading) => { readings.push(r); console.log(JSON.stringify(r)); };

  const probe = async (id: string, url: string, headers: Record<string, string>, auth: string, note: string): Promise<Reading> => {
    const { status, text, json } = await call('GET', url, headers);
    const d = dataOf(json);
    const checks = Array.isArray(d.checks) ? (d.checks as Row[]) : [];
    const supplyCheck = checks.find((c) => String(c.id) === 'supply_vs_ledger');
    const supplySample: Row[] = supplyCheck && Array.isArray(supplyCheck.sample) ? (supplyCheck.sample as Row[]) : [];
    const r: Reading = {
      id, method: 'GET', url, auth, mode, status,
      body_keys: Object.keys(json),
      data_keys: Object.keys(d),
      ok: d.ok,
      check_ids: checks.map((c) => String(c.id)),
      check_status: checks.map((c) => String(c.status)),
      rows: checks.map((c) => Number(c.rows)),
      diff: d.ok === false ? checks.filter((c) => String(c.status) === 'FAIL').map((c) => c.diff ?? null) : undefined,
      sample_len: supplySample.length,
      sample_first_cid: supplySample.length > 0 ? String(supplySample[0].cid) : null,
      sample_failed_cids: supplySample.filter((s) => s.ok === false).map((s) => String(s.cid)),
      check_diff: checks.map((c) => (c.diff === undefined || c.diff === null ? null : String(c.diff))),
      error_code: errCodeOf(json),
      message: json.message,
      // 密钥回显自检：只有「非空且出现在回执原文里」才算回显（空串恒命中，须排除）
      secret_echoed: SECRET.length > 0 ? text.includes(SECRET) : false,
      note,
    };
    push(r);
    return r;
  };

  // ① CRON_SECRET 未配 ⇒ 503（fail-loud；绝不默认放行）
  process.env.CRON_SECRET = '';
  await probe('A1_no_secret_configured', URL_OK, {}, 'none', 'CRON_SECRET 未配 ⇒ 期望 503');

  // ② secret 已配：无头 ⇒ 401；错 Bearer ⇒ 401；错 x-cron-secret ⇒ 401
  process.env.CRON_SECRET = SECRET;
  await probe('B1_no_header', URL_OK, {}, 'none', 'secret 已配、无头 ⇒ 期望 401');
  await probe('B2_wrong_bearer', URL_OK, { authorization: `Bearer ${WRONG}` }, 'bearer(wrong)', '错 Bearer ⇒ 期望 401');
  await probe('B3_wrong_header_secret', URL_OK, { 'x-cron-secret': WRONG }, 'x-cron-secret(wrong)', '错 x-cron-secret ⇒ 期望 401');

  // ③ 正确密钥（桩：干净）⇒ 200 + data.ok:true + 三条检查齐 + 桩真被调用
  mode = 'clean';
  const before = calls.length;
  const clean = await probe('C1_correct_bearer_clean', URL_OK, { authorization: `Bearer ${SECRET}` }, 'bearer(correct · 值不打印)', '干净夹具 ⇒ 200 + ok:true + 三条 PASS');
  const cleanCalls = calls.length - before;

  // ③′ x-cron-secret 头同样放行
  await probe('C2_correct_header_secret_clean', URL_OK, { 'x-cron-secret': SECRET }, 'x-cron-secret(correct)', '备用头同样放行 ⇒ 200');

  // ④ 反向灵敏度：同一端点同一鉴权，仅把供应量差额 +1 ⇒ ok 必须翻 false
  mode = 'supply_drift';
  await probe('S1_supply_drift_should_fail', URL_OK, { authorization: `Bearer ${SECRET}` }, 'bearer(correct)', '反向臂①：diff 2000000→2000001 ⇒ 期望 ok:false + supply_vs_ledger FAIL');

  // ④′ 反向灵敏度：已登记基线 cid=21(=1) 被喂 diff=0 ⇒ 期望 FAIL（证明基线表不是空转）
  mode = 'unregistered_cid_baseline';
  await probe('S2_baseline_table_enforced', URL_OK, { authorization: `Bearer ${SECRET}` }, 'bearer(correct)', '反向臂②：cid=21 基线 1、喂 diff=0 ⇒ 期望 FAIL');

  // ④″ 反向灵敏度：逐户 0 行闸 —— 各喂一行漂移
  // ④‴ 回归（Zang 审阅修复）：25 行、前 21 行 PASS、第 22 行 FAIL ⇒ 失败行不得被 slice(0,20) 切掉。
  //   鉴权走 x-cron-secret（C2 已证同权），与 Bearer 臂解耦，回归只关心 sample 采集形状。
  mode = 'supply_drift_late';
  await probe('R1_supply_drift_after_20_pass', URL_OK, { 'x-cron-secret': SECRET }, 'x-cron-secret(correct)', '回归①：25 行、前 21 PASS、第 22 行 cid=9021 diff=1 ⇒ 期望 FAIL 且 sample 含 cid 9021（不被切掉）');

  // ④‴′ 回归：同 25 行形状全 PASS ⇒ PASS + diff=0 + rows=25（两阶段采集不得把绿的判红）
  mode = 'supply_all_pass_25';
  await probe('R2_supply_25_all_pass', URL_OK, { 'x-cron-secret': SECRET }, 'x-cron-secret(correct)', '回归②：25 行全 PASS ⇒ 期望 PASS + diff=0');

  mode = 'account_drift';
  await probe('S3_account_drift_should_fail', URL_OK, { authorization: `Bearer ${SECRET}` }, 'bearer(correct)', '反向臂③：account 漂移 1 行 ⇒ 期望 account_vs_ledger FAIL');
  mode = 'batt_drift';
  await probe('S4_batt_drift_should_fail', URL_OK, { authorization: `Bearer ${SECRET}` }, 'bearer(correct)', '反向臂④：batt 漂移 1 行 ⇒ 期望 batt_account_vs_batt_entry FAIL');

  // ⑤ 未注册路径 ⇒ catch-all route_not_found（证明 200 是「进 handler」而不是兜底）
  mode = 'clean';
  await probe('E1_unregistered_path', '/api/ops/recon/ledger-not-a-route', {}, 'none', '对照：未注册路径 ⇒ 404 route_not_found');
  // ⑤′ 方法对照：POST 未注册 ⇒ 不得落到本 handler
  {
    const { status, json } = await call('POST', URL_OK, { authorization: `Bearer ${SECRET}` });
    push({
      id: 'E2_post_not_registered', method: 'POST', url: URL_OK, auth: 'bearer(correct)', mode,
      status, body_keys: Object.keys(json), data_keys: Object.keys(dataOf(json)), ok: dataOf(json).ok,
      check_ids: [], check_status: [], rows: [], error_code: errCodeOf(json), message: json.message,
      secret_echoed: false, note: '本单只注册 GET ⇒ POST 落 catch-all（非 200）',
    });
  }

  // ---- 结论（机读）----
  const byId = (id: string) => readings.find((r) => r.id === id);
  const verdict = {
    probe: 'recon-probe',
    backend_root: BACKEND_ROOT,
    secret_source: ENV_SECRET ? 'env(.env.local)' : 'probe-synthetic',
    secret_len: SECRET.length,
    stub_sql_calls: calls.length,
    stub_calls_for_C1: cleanCalls,
    assertions: {
      A1_503: byId('A1_no_secret_configured')?.status === 503,
      B1_401: byId('B1_no_header')?.status === 401,
      B2_401: byId('B2_wrong_bearer')?.status === 401,
      B3_401: byId('B3_wrong_header_secret')?.status === 401,
      C1_200_ok_true: byId('C1_correct_bearer_clean')?.status === 200 && byId('C1_correct_bearer_clean')?.ok === true,
      C1_three_checks: (byId('C1_correct_bearer_clean')?.check_ids ?? []).length === 3,
      C1_sql_really_ran: cleanCalls === 3,
      C2_200: byId('C2_correct_header_secret_clean')?.status === 200,
      S1_flips_to_false: byId('S1_supply_drift_should_fail')?.ok === false,
      S2_baseline_enforced: byId('S2_baseline_table_enforced')?.ok === false,
      // ---- 回归两例（Zang 审阅修复：sample 两阶段采集）----
      // ① 25 行 / 前 21 PASS / 第 22 行 FAIL ⇒ 必须 FAIL 且失败行在 sample 内、不被 slice 切掉
      R1_status_fail: (byId('R1_supply_drift_after_20_pass')?.check_status ?? [])[0] === 'FAIL',
      R1_rows_25: (byId('R1_supply_drift_after_20_pass')?.rows ?? [])[0] === 25,
      R1_sample_has_drift_cid: (byId('R1_supply_drift_after_20_pass')?.sample_failed_cids ?? []).includes('9021'),
      R1_fail_row_first: byId('R1_supply_drift_after_20_pass')?.sample_first_cid === '9021',
      R1_sample_len_capped: byId('R1_supply_drift_after_20_pass')?.sample_len === 20,
      // ② 同形状 25 行全 PASS ⇒ PASS + diff='0' + rows=25
      R2_status_pass: (byId('R2_supply_25_all_pass')?.check_status ?? [])[0] === 'PASS',
      R2_diff_zero: (byId('R2_supply_25_all_pass')?.check_diff ?? [])[0] === '0',
      R2_rows_25: (byId('R2_supply_25_all_pass')?.rows ?? [])[0] === 25,
      S3_account_drift_fail: byId('S3_account_drift_should_fail')?.ok === false,
      S4_batt_drift_fail: byId('S4_batt_drift_should_fail')?.ok === false,
      E1_404: byId('E1_unregistered_path')?.status === 404,
      E2_post_not_200: byId('E2_post_not_registered')?.status !== 200,
      no_secret_echo: readings.every((r) => r.secret_echoed === false),
    },
    readings,
  };
  const allPass = Object.values(verdict.assertions).every(Boolean);
  const out = { ...verdict, all_assertions_pass: allPass };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'probe-recon-auth.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
  console.log(JSON.stringify({ saved: file, all_assertions_pass: allPass, assertions: verdict.assertions }));

  httpServer.close();
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error('PROBE_FATAL', e instanceof Error ? e.message : String(e));
  process.exit(2);
});
