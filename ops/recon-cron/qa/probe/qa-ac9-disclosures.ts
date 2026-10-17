/**
 * 独立质检 · AC9 披露核对（不判负，只登记）
 * ---------------------------------------------------------------------------
 * ① 漂移时 HTTP 仍 200（Vercel cron 面板不会红）—— 实测 status + 捕获的 console.error 一条
 * ② dev 库 ok=false 属**构造性**结果（基线取自生产）—— 归因写清，不当缺陷
 * ③ vercel.json 为 legacy builds 形态 ⇒ cron 是否真注册只能上线后现证 ⇒ ENV_LIMITED
 *
 * 用法（cwd = backend-ts）：
 *   TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only ../ops/recon-cron/qa/probe/qa-ac9-disclosures.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';
import type { AddressInfo } from 'net';

const HERE = __dirname;
const QA_DIR = path.resolve(HERE, '..');
const OUT_DIR = path.join(QA_DIR, 'readings');
const REPO = path.resolve(HERE, '../../../..');
const BACKEND = path.join(REPO, 'backend-ts');
fs.mkdirSync(OUT_DIR, { recursive: true });

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

const db = require(path.join(BACKEND, 'src/db'));
let supplyFixture: Row[] = [];
let accountFixture: Row[] = [];
let battFixture: Row[] = [];
db.readQuery = async (text: string): Promise<Row[]> => {
  const s = String(text);
  if (/sum_mint/.test(s)) return supplyFixture;
  if (/public\.batt_account/.test(s)) return battFixture;
  if (/public\.account/.test(s)) return accountFixture;
  return [];
};

// 捕获 console.error（不改实现，只在进程内旁听）
const errLines: string[] = [];
const origErr = console.error.bind(console);
console.error = (...args: unknown[]) => { errLines.push(args.map((a) => String(a)).join(' ')); };

process.env.VERCEL = '1';
const app = require(path.join(BACKEND, 'src/index')).default;

const SECRET = 'qa9-' + crypto.randomBytes(10).toString('hex');
process.env.CRON_SECRET = SECRET;

const server = http.createServer(app);
const supplyRow = (cid: string, diff: string): Row => ({
  cid, symbol: cid === '1' ? '$' : `T${cid}`, total_supply: '1000', sum_mint: '1000', sum_burn: '0', ledger_derived: '1000', diff,
});

const call = (): Promise<{ status: number; body: string; json: any }> => new Promise((resolve, reject) => {
  const req = http.request({
    host: '127.0.0.1',
    port: (server.address() as AddressInfo).port,
    method: 'GET',
    path: '/api/ops/recon/ledger',
    headers: { authorization: `Bearer ${SECRET}` },
  }, (res) => {
    let buf = '';
    res.on('data', (c) => { buf += c; });
    res.on('end', () => { let j: any = null; try { j = JSON.parse(buf); } catch { j = null; } resolve({ status: res.statusCode || 0, body: buf, json: j }); });
  });
  req.on('error', reject);
  req.end();
});

(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));

  // —— 干净态：不应有 [recon] 错误日志
  supplyFixture = [supplyRow('1', '2000000')]; accountFixture = []; battFixture = [];
  const before = errLines.length;
  const clean = await call();
  const cleanDriftLogs = errLines.length - before;

  // —— 漂移态（三条各一臂）
  const driftArms: Array<Record<string, unknown>> = [];
  const runDrift = async (name: string, setup: () => void) => {
    supplyFixture = []; accountFixture = []; battFixture = [];
    setup();
    const n0 = errLines.length;
    const r = await call();
    const logs = errLines.slice(n0);
    driftArms.push({
      arm: name,
      http_status: r.status,
      http_200_on_drift: r.status === 200,
      report_ok: r.json?.data?.ok ?? r.json?.ok ?? null,
      envelope_message: r.json?.message ?? r.json?.data?.message ?? null,
      recon_error_log_count: logs.filter((l) => l.includes('[recon] ledger drift detected')).length,
      body_contains_secret: r.body.includes(SECRET),
      log_excerpt: logs[0]?.slice(0, 220) ?? null,
    });
  };
  await runDrift('supply_drift', () => { supplyFixture = [supplyRow('1', '2000001')]; });
  await runDrift('account_drift', () => { accountFixture = [{ uid: '7', cid: '1', balance: '100', sum_delta: '99', diff_balance: '1', frozen: '0', sum_frozen_delta: '0', diff_frozen: '0' }]; });
  await runDrift('batt_drift', () => { battFixture = [{ uid: '8', batt: '10', sum_delta: '9', diff: '1' }]; });

  const staticSrc = fs.readFileSync(path.join(BACKEND, 'src/index.ts'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
  const ac8 = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'AC8-real-dev-readonly.json'), 'utf8'));

  const out = {
    ac: 'AC9',
    title: '披露核对（不判负）：漂移仍 200 / dev ok=false 属构造性 / legacy builds 下 cron 注册只能上线后证',
    measured_at: now(),
    disclosures: [
      {
        id: 'D1-http-200-on-drift',
        claim: '漂移时 HTTP 仍 200（Vercel cron 面板不会红）—— 属已披露设计',
        measured: {
          clean_arm_status: clean.status,
          clean_arm_ok: clean.json?.data?.ok ?? null,
          clean_arm_drift_logs: cleanDriftLogs,
          drift_arms: driftArms,
        },
        observations: {
          all_drift_arms_http_200: driftArms.every((a) => a.http_200_on_drift === true),
          all_drift_arms_ok_false: driftArms.every((a) => a.report_ok === false),
          drift_emits_exactly_one_recon_error_log: driftArms.every((a) => a.recon_error_log_count === 1),
          clean_arm_emits_none: cleanDriftLogs === 0,
          no_secret_in_bodies: driftArms.every((a) => a.body_contains_secret === false),
          alarm_channel_source: (staticSrc.match(/console\.error\('\[recon\] ledger drift detected'/) || [''])[0] || null,
        },
        verdict: 'AS_DESIGNED · 不改判负（告警面 v1 = 结构化回执 + console.error 一条；外部告警未接，属已知边界）',
        residual_risk: '若上线后无人看 Vercel 日志，漂移可长期无人处理（HTTP 200 ⇒ 平台不报警）。建议后续接外部告警（另立单）。',
      },
      {
        id: 'D2-dev-ok-false-constructive',
        claim: 'dev 库 ok=false 是构造性结果（基线取自生产），不得当缺陷',
        measured: {
          dev_identity: ac8.identity,
          dev_report_ok: ac8.report?.ok,
          dev_supply_check: ac8.report?.checks?.[0] ?? null,
          dev_supply_first_row: ac8.per_sql?.[0]?.sample_rows?.[0] ?? null,
          baseline_source: "KNOWN_SUPPLY_OFFSET: cid 1 → '2000000'（OPEN-ITEMS B25 生产已登记差额）",
        },
        attribution:
          'dev 库 cid=1 的 diff=0（dev 无该笔历史夹具），而基线常量按**生产**登记为 2000000 ⇒ 严格相等必然 FAIL。属「基线只对生产成立」的构造性产物；同一批数据下 account/batt 两条 0 行判据在 dev 上 PASS。',
        verdict: 'CONSTRUCTIVE_NON_DEFECT · 不判负、不改写为 PASS',
      },
      {
        id: 'D3-vercel-legacy-builds-cron-unverifiable',
        claim: 'vercel.json 为 legacy builds 形态 ⇒ cron 是否真注册只能上线后现证',
        measured: {
          has_builds_key: Object.prototype.hasOwnProperty.call(vercel, 'builds'),
          has_routes_key: Object.prototype.hasOwnProperty.call(vercel, 'routes'),
          crons: vercel.crons,
          crons_count: vercel.crons.length,
          plan_limit_note: 'Hobby 档 cron 上限 2 条 + 每条每天至多 1 次（非准点）⇒ 本批用满名额，无余量。',
        },
        verdict: 'ENV_LIMITED · 离线无法证明「Vercel 真的按 30 18 * * * 触发 /api/ops/recon/ledger」；上线后需现证（cron 面板 + 一次真实触发日志）。',
      },
    ],
    env_limited: [
      'D3: legacy builds 形态下 crons 注册/触发时刻只能上线后现证（离线仅能证 JSON 合法 + 路径注册了 GET）',
      'Hobby 档 cron 名额已用满 2/2 ⇒ 后续加第三条必须先合并调度器（机制约束，非本批缺陷）',
    ],
  };

  fs.writeFileSync(path.join(OUT_DIR, 'AC9-disclosures.json'), JSON.stringify(out, null, 2) + '\n');
  console.error = origErr;
  console.log(JSON.stringify({
    clean: { status: clean.status, ok: clean.json?.data?.ok, drift_logs: cleanDriftLogs },
    drift_arms: driftArms,
    d3_crons: vercel.crons,
  }, null, 2));
  server.close();
})().catch((e) => { console.error = origErr; console.error('AC9_PROBE_FATAL', e); process.exitCode = 2; });
