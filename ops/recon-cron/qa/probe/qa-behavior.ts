/**
 * 独立质检 · 行为面探针（Neng 自写；不采信实现方 probe / 日志）
 * ---------------------------------------------------------------------------
 * 覆盖：AC3 鉴权五态（+错路径/POST 404）· AC5 样本两阶段（含**反向对照**）· AC6 五臂灵敏度
 *      · AC2 行为侧（严格相等 / 小数残差 ⇒ FAIL）
 *
 * 做法：`db.readQuery` 换桩（不连库、零写、零真实网络），鉴权闸 / 判定 / 回执组装**全部走真码**；
 *   用真 express app 起一个 127.0.0.1 临时端口（`VERCEL=1` ⇒ 不触发 index.ts 的 listen）。
 *   密钥仅在进程内随机生成，**不打印值**，并逐例对响应原文做「是否含密钥」的字面检查。
 *
 * 用法（cwd = backend-ts）：
 *   npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-behavior.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';
import type { AddressInfo } from 'net';

const HERE = __dirname;
const QA_DIR = path.resolve(HERE, '..');
const OUT_DIR = path.join(QA_DIR, 'readings');
const BACKEND = path.resolve(HERE, '../../../../backend-ts');
fs.mkdirSync(OUT_DIR, { recursive: true });

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();
const dump = (name: string, obj: unknown) => {
  const f = path.join(OUT_DIR, name);
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n');
  return f;
};

/* ------------------------------------------------------------------ 桩：readQuery */
const db = require(path.join(BACKEND, 'src/db'));
let supplyFixture: Row[] = [];
let accountFixture: Row[] = [];
let battFixture: Row[] = [];
const sqlSeen: string[] = [];

db.readQuery = async (sql: string): Promise<Row[]> => {
  const s = String(sql);
  sqlSeen.push(s.replace(/\s+/g, ' ').trim().slice(0, 60));
  if (/sum_mint/.test(s)) return supplyFixture.map((r) => ({ ...r }));
  if (/public\.batt_account/.test(s)) return battFixture.map((r) => ({ ...r }));
  if (/public\.account/.test(s)) return accountFixture.map((r) => ({ ...r }));
  return [];
};

process.env.VERCEL = '1'; // ⇒ index.ts 不 app.listen
const app = require(path.join(BACKEND, 'src/index')).default;

/* ------------------------------------------------------------------ HTTP 面 */
const server = http.createServer(app);
let port = 0;

interface Resp { status: number; body: string; json: any }
const call = (method: string, p: string, headers: Record<string, string> = {}): Promise<Resp> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let json: any = null;
        try { json = JSON.parse(buf); } catch { json = null; }
        resolve({ status: res.statusCode || 0, body: buf, json });
      });
    });
    req.on('error', reject);
    req.end();
  });

/* ------------------------------------------------------------------ 夹具 */
const supplyRow = (cid: string, diff: string, over: Row = {}): Row => ({
  cid, symbol: cid === '1' ? '$' : `T${cid}`,
  total_supply: '1000', sum_mint: '1000', sum_burn: '0', ledger_derived: '1000',
  diff, ...over,
});

const BASELINE: Record<string, string> = { '1': '2000000', '21': '1' };

/** 25 行：第 1 行 cid=1（diff = 基线 2000000 ⇒ PASS），第 2..25 行 cid=9001..9024。
 *  第 22 行（cid=9021）diff 由参数决定 ⇒ 默认 '1'（≠ 未登记 cid 的基线 0 ⇒ FAIL）。 */
const fixture25 = (row22Diff: string | null): Row[] => {
  const rows: Row[] = [supplyRow('1', '2000000')];
  for (let i = 1; i <= 24; i += 1) {
    rows.push(supplyRow(String(9000 + i), i === 21 && row22Diff !== null ? row22Diff : '0'));
  }
  return rows;
};

const cleanFixtures = () => { supplyFixture = [supplyRow('1', '2000000')]; accountFixture = []; battFixture = []; };

/* ------------------------------------------------------------------ 真码驱动 */
const SECRET = 'qa-' + crypto.randomBytes(12).toString('hex');
const resetEnv = () => { delete process.env.CRON_SECRET; };

const probeLedger = async (headers: Record<string, string>, method = 'GET', p = '/api/ops/recon/ledger'): Promise<Resp> => {
  if (method === 'GET') return call('GET', p, headers);
  return call(method, p, headers);
};

/** 用真端点跑一次对账（鉴权用对的 Bearer），返回 report */
const runReport = async (): Promise<any> => {
  process.env.CRON_SECRET = SECRET;
  const r = await probeLedger({ authorization: `Bearer ${SECRET}` });
  if (r.status !== 200) throw new Error(`recon endpoint returned ${r.status}: ${r.body.slice(0, 200)}`);
  // 回执经 sendSuccess 包一层 ⇒ 报告在 data 下；两种形态都接住并登记取数路径
  return r.json?.data ?? r.json;
};

/** 老实现（逐字复制 a201cb3 版 judgeSupply；仅作反向对照，不改仓内文件） */
const integerOfLocal = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!m) return { big: 0n, exact: false };
  return { big: BigInt(`${m[1]}${m[2]}`), exact: !m[3] || /^0+$/.test(m[3]) };
};
const judgeSupplyOld = (rows: Row[]) => {
  const LIMIT = 20;
  const sample: Row[] = [];
  let firstUnexpected: string | null = null;
  for (const row of rows) {
    const cid = String(row.cid ?? '');
    const baseline = BigInt(BASELINE[cid] ?? '0');
    const parsed = integerOfLocal(row.diff);
    const pass = parsed.exact && parsed.big === baseline;
    if (!pass && firstUnexpected === null) firstUnexpected = String(row.diff ?? '');
    if (!pass || sample.length < LIMIT) sample.push({ cid, diff: String(row.diff ?? ''), ok: pass });
  }
  const failed = sample.some((s) => s.ok === false);
  return {
    status: failed ? 'FAIL' : 'PASS',
    rows: rows.length,
    diff: failed ? String(firstUnexpected ?? '') : '0',
    sample: sample.slice(0, LIMIT),
  };
};

/* ================================================================== AC3 鉴权五态 */
const ac3Cases: Array<Record<string, unknown>> = [];
const record = (id: string, desc: string, resp: Resp, expectStatus: number, extra: Record<string, unknown> = {}) => {
  const leaked = resp.body.includes(SECRET);
  const row = {
    id, desc,
    expected_status: expectStatus,
    actual_status: resp.status,
    status_ok: resp.status === expectStatus,
    body_contains_secret_value: leaked,
    no_secret_leak: !leaked,
    body_excerpt: resp.body.slice(0, 240),
    ...extra,
  };
  ac3Cases.push(row);
  return row;
};

const main = async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  port = (server.address() as AddressInfo).port;

  // —— 1) CRON_SECRET 未配 ⇒ 503
  resetEnv();
  cleanFixtures();
  const r503 = await probeLedger({});
  record('no_secret_env', 'CRON_SECRET 未配 + 无任何头', r503, 503);

  // —— 2) 已配 secret、无头 ⇒ 401
  process.env.CRON_SECRET = SECRET;
  const r401NoHdr = await probeLedger({});
  record('secret_set_no_header', 'CRON_SECRET 已配、请求无 Authorization / x-cron-secret', r401NoHdr, 401);

  // —— 3) 已配、错 Bearer ⇒ 401
  const r401BadBearer = await probeLedger({ authorization: 'Bearer qa-wrong-bearer-value' });
  record('wrong_bearer', 'Authorization: Bearer <错误值>', r401BadBearer, 401);

  // —— 4) 已配、错 x-cron-secret ⇒ 401
  const r401BadX = await probeLedger({ 'x-cron-secret': 'qa-wrong-header-value' });
  record('wrong_x_cron_secret', 'x-cron-secret: <错误值>', r401BadX, 401);

  // —— 5) 对 ⇒ 200（Bearer / x-cron-secret 两种形态各一次）
  const r200Bearer = await probeLedger({ authorization: `Bearer ${SECRET}` });
  record('correct_bearer', 'Authorization: Bearer <正确值>（夹具为干净账）', r200Bearer, 200, {
    report_ok: r200Bearer.json?.data?.ok ?? r200Bearer.json?.ok ?? null,
  });
  const r200X = await probeLedger({ 'x-cron-secret': SECRET });
  record('correct_x_cron_secret', 'x-cron-secret: <正确值>', r200X, 200, {
    report_ok: r200X.json?.data?.ok ?? r200X.json?.ok ?? null,
  });

  // —— 6) 错路径 ⇒ 404
  const r404Path = await probeLedger({ authorization: `Bearer ${SECRET}` }, 'GET', '/api/ops/recon/ledger-x');
  record('wrong_path', 'GET /api/ops/recon/ledger-x（错路径）', r404Path, 404);

  // —— 7) 同路径 POST ⇒ 404（证只注册 GET）
  const r404Post = await probeLedger({ authorization: `Bearer ${SECRET}` }, 'POST', '/api/ops/recon/ledger');
  record('post_same_path', 'POST /api/ops/recon/ledger（同路径、正确密钥）', r404Post, 404);

  const ac3 = {
    ac: 'AC3',
    title: '鉴权五态（无 secret 503 / 无头 401 / 错 Bearer 401 / 错 x-cron-secret 401 / 对 200）+ 错路径 404 + 同路径 POST 404 + 密钥不回显',
    measured_at: now(),
    secret_length: SECRET.length,
    secret_source: 'in-process crypto.randomBytes（未读任何仓内/环境凭据）',
    cases: ac3Cases,
    pass: ac3Cases.every((c) => c.status_ok === true && c.no_secret_leak === true),
  };

  /* ================================================================ AC5 样本两阶段 */
  // F1：第 22 行（cid=9021）漂移 ⇒ FAIL 且定位行必须出现
  supplyFixture = fixture25('1'); accountFixture = []; battFixture = [];
  const repF1 = await runReport();
  const c1F1 = (repF1.checks || []).find((c: any) => c.id === 'supply_vs_ledger');
  const sampleF1 = (c1F1?.sample || []) as Row[];
  const cidsF1 = sampleF1.map((s) => String(s.cid));

  // F2：同形状全 PASS ⇒ PASS / diff='0' / rows=25
  supplyFixture = fixture25(null); accountFixture = []; battFixture = [];
  const repF2 = await runReport();
  const c1F2 = (repF2.checks || []).find((c: any) => c.id === 'supply_vs_ledger');
  const sampleF2 = (c1F2?.sample || []) as Row[];

  // 反向对照：老实现对同一夹具的产出（仅在探针内实现，不改仓内文件）
  const oldF1 = judgeSupplyOld(fixture25('1'));
  const oldF2 = judgeSupplyOld(fixture25(null));

  // 额外：25 行全 FAIL ⇒ cap 仍 20 且样本全为失败行（不混入 PASS 行）
  supplyFixture = Array.from({ length: 25 }, (_, i) => supplyRow(String(i === 0 ? 1 : 9000 + i), '5'));
  const repF3 = await runReport();
  const c1F3 = (repF3.checks || []).find((c: any) => c.id === 'supply_vs_ledger');

  const firstFailIdx = sampleF1.findIndex((s) => s.ok === false);
  const lastPassIdx = sampleF1.map((s) => s.ok).lastIndexOf(true);
  const failureFirst = firstFailIdx >= 0 && (lastPassIdx === -1 || firstFailIdx < lastPassIdx);

  const ac5 = {
    ac: 'AC5',
    title: 'judgeSupply 两阶段采集：失败行优先、不被 slice 切掉；不足 20 补 PASS；反向对照证用例有分辨力',
    measured_at: now(),
    fixture: {
      shape: '25 行 = cid1(diff=基线 2000000, PASS) + cid 9001..9024(diff=0, PASS)，第 22 行 = cid 9021',
      f1_row22_diff: '1（≠ 未登记 cid 基线 0）',
      f2_row22_diff: '0（全 PASS）',
    },
    f1_drift_at_row22: {
      status: c1F1?.status,
      rows: c1F1?.rows,
      diff: c1F1?.diff,
      sample_len: sampleF1.length,
      sample_cids: cidsF1,
      sample_has_9021: cidsF1.includes('9021'),
      sample_first_is_9021: cidsF1[0] === '9021',
      first_entry_ok_false: sampleF1[0]?.ok === false,
      failure_rows_before_pass_rows: failureFirst,
      failed_entries: sampleF1.filter((s) => s.ok === false).map((s) => s.cid),
      assertions: {
        status_is_fail: c1F1?.status === 'FAIL',
        locator_row_present: cidsF1.includes('9021'),
        locator_is_first: cidsF1[0] === '9021',
        sample_capped_20: sampleF1.length === 20,
        fail_first_ordering: failureFirst,
        diff_reports_offender: c1F1?.diff === '1',
        rows_all_counted: c1F1?.rows === 25,
      },
    },
    f2_all_pass: {
      status: c1F2?.status,
      diff: c1F2?.diff,
      rows: c1F2?.rows,
      sample_len: sampleF2.length,
      assertions: {
        status_is_pass: c1F2?.status === 'PASS',
        diff_is_zero_string: c1F2?.diff === '0',
        rows_25: c1F2?.rows === 25,
        sample_filled_to_cap_with_pass: sampleF2.length === 20 && sampleF2.every((s) => s.ok === true),
      },
    },
    f3_all_fail_cap: {
      status: c1F3?.status,
      sample_len: (c1F3?.sample || []).length,
      all_failed: (c1F3?.sample || []).every((s: Row) => s.ok === false),
      assertions: {
        capped_at_20: (c1F3?.sample || []).length === 20,
        no_pass_row_pushed_out_failure: (c1F3?.sample || []).every((s: Row) => s.ok === false),
      },
    },
    negative_control_old_impl: {
      note: '把 judgeSupply 回退成 a201cb3 版（单桶 push + slice(0,20)），同一夹具下必须丢失定位行 ⇒ 证 F1 用例有分辨力（不是恒绿的尺子）',
      impl: 'ops/recon-cron/qa/probe/qa-behavior.ts :: judgeSupplyOld（逐字复制旧逻辑，未改仓内文件）',
      old_f1_status: oldF1.status,
      old_f1_sample_len: oldF1.sample.length,
      old_f1_sample_cids: oldF1.sample.map((s) => s.cid),
      old_f1_has_9021: oldF1.sample.some((s) => s.cid === '9021'),
      old_f1_loses_locator: !oldF1.sample.some((s) => s.cid === '9021'),
      new_f1_has_9021: cidsF1.includes('9021'),
      discriminating: !oldF1.sample.some((s) => s.cid === '9021') && cidsF1.includes('9021'),
      judgement_unchanged: {
        f1_status_equal: oldF1.status === c1F1?.status,
        f1_diff_equal: oldF1.diff === c1F1?.diff,
        f1_rows_equal: oldF1.rows === c1F1?.rows,
        f2_status_equal: oldF2.status === c1F2?.status,
        f2_diff_equal: oldF2.diff === c1F2?.diff,
        f2_rows_equal: oldF2.rows === c1F2?.rows,
        note: '旧/新实现 status/diff/rows 逐项相同 ⇒ 本次修复只改样本可定位性，未动判据语义',
      },
    },
    pass: false,
  };
  ac5.pass =
    Object.values(ac5.f1_drift_at_row22.assertions).every(Boolean)
    && Object.values(ac5.f2_all_pass.assertions).every(Boolean)
    && Object.values(ac5.f3_all_fail_cap.assertions).every(Boolean)
    && ac5.negative_control_old_impl.discriminating === true
    && Object.entries(ac5.negative_control_old_impl.judgement_unchanged)
      .filter(([k]) => k !== 'note')
      .every(([, v]) => v === true);

  /* ================================================================ AC6 五臂灵敏度 */
  const armOf = async (name: string, setup: () => void) => {
    cleanFixtures();
    setup();
    const rep = await runReport();
    return {
      arm: name,
      ok: rep.ok,
      checks: (rep.checks || []).map((c: any) => ({ id: c.id, status: c.status, rows: c.rows, diff: c.diff ?? null })),
      expect_ok: false,
      behaves_as_expected: rep.ok === false,
    };
  };

  const arms = [];
  arms.push(await armOf('supply_diff_off_baseline', () => { supplyFixture = [supplyRow('1', '2000001')]; }));
  arms.push(await armOf('baseline_mismatch_cid21', () => {   // cid=21 基线登记为 '1' ⇒ diff=2 必须 FAIL
    supplyFixture = [supplyRow('1', '2000000'), supplyRow('21', '2')];
  }));
  arms.push(await armOf('account_drift_one_row', () => {
    accountFixture = [{ uid: '7', cid: '1', balance: '100', sum_delta: '99', diff_balance: '1', frozen: '0', sum_frozen_delta: '0', diff_frozen: '0' }];
  }));
  arms.push(await armOf('batt_drift_one_row', () => {
    battFixture = [{ uid: '8', batt: '10', sum_delta: '9', diff: '1' }];
  }));

  // 反向臂：全部干净 ⇒ ok=true（防「判定恒 FAIL」）
  cleanFixtures();
  const repClean = await runReport();
  const reverseArm = {
    arm: 'clean_no_drift_reverse_arm',
    ok: repClean.ok,
    checks: (repClean.checks || []).map((c: any) => ({ id: c.id, status: c.status, rows: c.rows, diff: c.diff ?? null })),
    expect_ok: true,
    behaves_as_expected: repClean.ok === true,
  };

  // 基线正向臂：cid=21 diff=1（恰等于登记基线）⇒ 必须 PASS（证基线表逐 cid 真生效，而非全局常量）
  cleanFixtures();
  supplyFixture = [supplyRow('1', '2000000'), supplyRow('21', '1')];
  const repBaselineOk = await runReport();
  const baselinePositiveArm = {
    arm: 'baseline_registered_cid21_hit',
    ok: repBaselineOk.ok,
    checks: (repBaselineOk.checks || []).map((c: any) => ({ id: c.id, status: c.status, rows: c.rows, diff: c.diff ?? null })),
    expect_ok: true,
    behaves_as_expected: repBaselineOk.ok === true,
  };

  // 小数残差臂（AC2 行为）：diff = '2000000.5' ⇒ 必 FAIL
  cleanFixtures();
  supplyFixture = [supplyRow('1', '2000000.5')];
  const repDecimal = await runReport();
  const decimalArm = {
    arm: 'decimal_residual_off_baseline',
    ok: repDecimal.ok,
    supply_check: (repDecimal.checks || []).find((c: any) => c.id === 'supply_vs_ledger'),
    expect_ok: false,
    behaves_as_expected: repDecimal.ok === false,
  };

  // 小数但整值（'2000000.0'）⇒ 必须 PASS（证明不是「凡带小数点就红的坏尺子」）
  cleanFixtures();
  supplyFixture = [supplyRow('1', '2000000.0')];
  const repDecimalZero = await runReport();
  const decimalZeroArm = {
    arm: 'decimal_zero_fraction_matches_baseline',
    ok: repDecimalZero.ok,
    expect_ok: true,
    behaves_as_expected: repDecimalZero.ok === true,
  };

  const ac6 = {
    ac: 'AC6',
    title: '5 臂灵敏度：stub diff 偏移 / 基线错配 / account 漂移 1 行 / batt 漂移 1 行 ⇒ ok=false；反向臂全净 ⇒ ok=true',
    measured_at: now(),
    arms: [...arms, reverseArm, baselinePositiveArm, decimalArm, decimalZeroArm],
    runtime_assertions: {
      all_drift_arms_fail: [...arms, decimalArm].every((a) => a.behaves_as_expected === true),
      reverse_arm_passes: reverseArm.behaves_as_expected === true,
      baseline_table_effective: baselinePositiveArm.behaves_as_expected === true,
      decimal_int_value_allowed: decimalZeroArm.behaves_as_expected === true,
    },
    pass: false,
  };
  ac6.pass = Object.values(ac6.runtime_assertions).every(Boolean);

  /* ================================================================ AC2 行为侧 */
  const ac2b = {
    ac: 'AC2',
    title: '行为侧：严格相等（非不等式/容差）、BigInt 比较 pg 字符串、小数残差 ⇒ FAIL、未登记 cid 默认 0',
    measured_at: now(),
    observed: {
      baseline_hit_ok: baselinePositiveArm.checks,
      off_by_one_ok: arms[0].checks,
      decimal_residual_ok: repDecimal.ok,
      decimal_zero_ok: repDecimalZero.ok,
      unregistered_cid_drift_ok: oldF1.status === 'FAIL' ? c1F1?.status : null,
      unregistered_cid_sample: cidsF1.slice(0, 3),
    },
    assertions: {
      off_by_one_fails: arms[0].behaves_as_expected === true,
      baseline_mismatch_fails: arms[1].behaves_as_expected === true,
      baseline_hit_passes: baselinePositiveArm.behaves_as_expected === true,
      decimal_residual_fails: decimalArm.behaves_as_expected === true,
      decimal_int_value_passes: decimalZeroArm.behaves_as_expected === true,
      pg_string_numeric_handled: c1F1?.status === 'FAIL', // diff 回字符串 '1' 仍被判出 ⇒ BigInt 路径有效
    },
    pass: false,
  };
  ac2b.pass = Object.values(ac2b.assertions).every(Boolean);

  /* ================================================================ 落盘 */
  const files = {
    AC3: dump('AC3-auth-states.json', ac3),
    AC5: dump('AC5-sample-two-phase.json', ac5),
    AC6: dump('AC6-sensitivity-arms.json', ac6),
    AC2: dump('AC2-judgement.json', ac2b),
  };

  const summary = {
    probe: 'qa-behavior.ts',
    measured_at: now(),
    head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: BACKEND }).toString().trim(),
    sql_seen_kinds: Array.from(new Set(sqlSeen)),
    results: { AC2: ac2b.pass, AC3: ac3.pass, AC5: ac5.pass, AC6: ac6.pass },
    files,
  };
  dump('qa-behavior-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));

  server.close();
  if (!(ac2b.pass && ac3.pass && ac5.pass && ac6.pass)) process.exitCode = 1;
};

main().catch((e) => {
  console.error('PROBE_ERROR', e);
  try { server.close(); } catch { /* noop */ }
  process.exitCode = 2;
});
