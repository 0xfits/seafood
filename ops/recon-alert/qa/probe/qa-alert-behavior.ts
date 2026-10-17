/**
 * Neng 独立质检探针 · B32 对账告警（commit b8a076e）
 * ================================================================================
 * 与被检方探针**完全独立**（另写、另跑、另落读数；不读 `ops/recon-alert/readings/*`）。
 *
 * 口径：
 *   · 零真实 DB（`db.readQuery` 换桩）· 零真实网络（`globalThis.fetch` 换桩）· 零写库。
 *   · 鉴权 / 判定 / 回执组装 / 告警分支**全部走真码**（`src/index.ts` + `src/ops-alert.ts`）。
 *   · 反向对照**不修改仓库任何文件**：直连 `ops-alert` 模块对象、在**内存里**把
 *     `notifyOps` / `pingHeartbeat` 换成 throw（ts-node/CommonJS 下 import 编译为
 *     `ops_alert_1.notifyOps(...)` ⇒ 调用点取属性，运行时改导出即生效）。
 *
 * 跑法（cwd = backend-ts）：
 *   QA_MODE=baseline        npx ts-node --transpile-only ../ops/recon-alert/qa/probe/qa-alert-behavior.ts
 *   QA_MODE=negctl_notify   …（把 notifyOps 换 throw）
 *   QA_MODE=negctl_ping     …（把 pingHeartbeat 换 throw）
 *   QA_MODE=negctl_both     …（两个都换 throw）
 *
 * 退出码：0 = 本模式全部判据成立；1 = 有判据不成立；2 = 探针自身崩了。
 */
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';

const BACKEND_ROOT = process.env.QA_TREE
  ? path.resolve(process.env.QA_TREE)
  : path.resolve(__dirname, '../../../../backend-ts');
const QA_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(QA_ROOT, 'readings');
const MODE = String(process.env.QA_MODE || 'baseline').trim();

// ---- 夹具（全部为构造值；不含任何真实凭据）------------------------------------
const HB_UUID = '11111111-2222-3333-4444-555555555555';
const HB = `https://hc-ping.invalid/ping/${HB_UUID}`;
const FAKE_TOKEN = '123456789:AAFakeTokenXYZ0123456789abcdefghij';
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMDAifQ.c2lnbmF0dXJlLXZhbHVlMTIz';
const FAKE_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const FAKE_CONN = 'postgresql://sf_user:S3cretPassw0rd@db.example.tech:5432/seafood';
const FAKE_CONN_NOPASS = 'postgresql://db.example.tech:5432/seafood';

// ---- ① 日志捕获（必须在 require index 之前装上）--------------------------------
const warnLines: string[] = [];
const errorLines: string[] = [];
const origWarn = console.warn.bind(console);
const origError = console.error.bind(console);
const fmt = (...args: unknown[]): string =>
  args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
console.warn = (...args: unknown[]) => { warnLines.push(fmt(...args)); };
console.error = (...args: unknown[]) => { errorLines.push(fmt(...args)); };

// ---- ② env（先就位，再 require db —— dotenv 不覆盖已存在值）---------------------
process.env.VERCEL = '1';
process.env.CRON_SECRET = 'qa-only-cron-secret';
process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN;
process.env.OPS_ALERT_UID = '100';
process.env.RECON_HEARTBEAT_URL = HB;

// ---- ③ fetch 桩 ---------------------------------------------------------------
type FetchCall = { url: string; method: string; body: string | null };
type FetchMode = 'ok' | 'non2xx' | 'throw' | 'throw_url' | 'hang';
let fetchCalls: FetchCall[] = [];
let fetchMode: FetchMode = 'ok';

globalThis.fetch = ((input: unknown, init?: { method?: string; body?: unknown; signal?: AbortSignal }) => {
  const url = String(input);
  fetchCalls.push({ url, method: String(init?.method || 'GET'), body: init?.body === undefined ? null : String(init.body) });
  if (fetchMode === 'throw') return Promise.reject(new Error('fetch failed'));
  if (fetchMode === 'throw_url') {
    // 真实 Node/undici 形态之一：URL 解析失败时 message 内嵌原串（此处用无 scheme 的 URL）
    return Promise.reject(new TypeError(`Failed to parse URL from ${HB.replace('https://', '')}`));
  }
  if (fetchMode === 'non2xx') return Promise.resolve({ ok: false, status: 500, text: async () => '' });
  if (fetchMode === 'hang') {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('This operation was aborted')));
    });
  }
  return Promise.resolve({ ok: true, status: 200, text: async () => 'OK' });
}) as unknown as typeof fetch;

// ---- ④ db 桩 ------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-var-requires */
const db = require(path.join(BACKEND_ROOT, 'src/db'));
type Row = Record<string, unknown>;
type ReconMode = 'clean' | 'supply_drift' | 'all_drift' | 'db_error' | 'db_error_dirty';
type UserMode = 'bound' | 'unbound' | 'missing' | 'query_error' | 'negative' | 'nonnumeric' | 'zero';

let reconMode: ReconMode = 'clean';
let userMode: UserMode = 'bound';

const supplyLedgerDerived = (diff: string): string => String(2010200 - Number(diff));
const supplyRows = (diff: string): Row[] => [{
  cid: 1, symbol: '$', total_supply: '2010200', sum_mint: '210274', sum_burn: '-200074',
  ledger_derived: supplyLedgerDerived(diff), diff,
}];

const infraErr = (message: string): Error => {
  const e = new Error(message) as Error & { code?: string };
  e.code = 'ECONNREFUSED';
  return e;
};

db.readQuery = async (text: string, params?: unknown[]): Promise<Row[]> => {
  const sql = String(text);
  // 收件人查询（notifyOps 唯一一条读）
  if (sql.includes('FROM public.users WHERE uid')) {
    if (userMode === 'query_error') throw infraErr('connect ECONNREFUSED 127.0.0.1:5432');
    if (userMode === 'missing') return [];
    if (userMode === 'unbound') return [{ tg_user_id: null }];
    if (userMode === 'negative') return [{ tg_user_id: '-1001234567890' }];
    if (userMode === 'nonnumeric') return [{ tg_user_id: 'not-a-number' }];
    if (userMode === 'zero') return [{ tg_user_id: 0 }];
    return [{ tg_user_id: '970001' }]; // 1:1 绑定 = Telegram 用户 ID（正数）
  }
  // 三条对账
  if (reconMode === 'db_error') throw infraErr('connect ECONNREFUSED 127.0.0.1:5432');
  if (reconMode === 'db_error_dirty') {
    throw infraErr(`connect failed: ${FAKE_CONN} bot ${FAKE_TOKEN} jwt ${FAKE_JWT} hash ${FAKE_HEX}`);
  }
  if (sql.includes('FROM public.currency')) {
    return supplyRows(reconMode === 'supply_drift' || reconMode === 'all_drift' ? '2000001' : '2000000');
  }
  if (sql.includes('FROM public.account')) {
    return reconMode === 'all_drift'
      ? [{ uid: '970001', cid: '1', balance: '10', sum_delta: '9', diff_balance: '1', frozen: '0', sum_frozen_delta: '0', diff_frozen: '0' }]
      : [];
  }
  if (sql.includes('FROM public.batt_account')) {
    return reconMode === 'all_drift'
      ? [{ uid: '970001', batt: '100', sum_delta: '90', diff: '10' }]
      : [];
  }
  return [];
};

// ---- ⑤ 起真 app ---------------------------------------------------------------
const app = require(path.join(BACKEND_ROOT, 'src/index')).default;
const alertMod = require(path.join(BACKEND_ROOT, 'src/ops-alert'));

// ---- ⑥ 反向对照（内存改导出；不动仓库文件）------------------------------------
const overrideExport = (mod: Record<string, unknown>, name: string, fn: unknown): string => {
  mod[name] = fn;
  if (mod[name] === fn) return 'assign';
  Object.defineProperty(mod, name, { value: fn, configurable: true, writable: true, enumerable: true });
  if (mod[name] !== fn) throw new Error(`cannot override export ${name}`);
  return 'defineProperty';
};
const negctlApplied: string[] = [];
const throws = (label: string) => async (): Promise<never> => { throw new Error(`QA_NEGCTL_${label}_THROW`); };
const negNotify = MODE.includes('negctl') && (MODE.includes('notify') || MODE.includes('both'));
const negPing = MODE.includes('negctl') && (MODE.includes('ping') || MODE.includes('both'));
if (negNotify) negctlApplied.push(`notifyOps:${overrideExport(alertMod, 'notifyOps', throws('NOTIFY'))}`);
if (negPing) negctlApplied.push(`pingHeartbeat:${overrideExport(alertMod, 'pingHeartbeat', throws('PING'))}`);

// ---- ⑦ HTTP 工具 --------------------------------------------------------------
type Resp = { status: number; text: string; json: Row };
const dataOf = (json: Row): Row => (json.data && typeof json.data === 'object' ? (json.data as Row) : {});
const errCodeOf = (json: Row): string | null => {
  const e = json.error;
  if (e && typeof e === 'object' && 'code' in (e as Row)) return String((e as Row).code);
  return typeof json.code === 'string' ? json.code : null;
};
const URL_OK = '/api/ops/recon/ledger';

type ArmOpts = {
  recon?: ReconMode;
  user?: UserMode;
  hb?: string | null;
  fetch?: FetchMode;
  uidEnv?: string | null;
  token?: boolean;
  secret?: string | null;
  auth?: Record<string, string>;
};

type ArmReading = {
  id: string;
  note: string;
  status: number;
  ok: unknown;
  error_code: string | null;
  ping_calls: string[];
  ping_fail_calls: number;
  tg_calls: number;
  tg_text: string | null;
  tg_chars: number;
  elapsed_ms: number;
  warn_lines: string[];
  error_lines: string[];
  resp_json: Row;
  resp_text_has_fixture: boolean;
  tg_text_has_fixture: boolean;
  warn_has_fixture: boolean;
  warn_has_heartbeat_url: boolean;
};

const FIXTURES: Array<[string, string]> = [
  ['conn_password', 'S3cretPassw0rd'],
  ['conn_user', 'sf_user'],
  ['bot_token_secret', 'AAFakeTokenXYZ0123456789abcdefghij'],
  ['jwt', 'eyJhbGciOiJIUzI1NiJ9'],
  ['long_hex', FAKE_HEX],
  ['heartbeat_uuid', HB_UUID],
  ['heartbeat_host', 'hc-ping.invalid'],
];
const hitsOf = (s: string, keys?: string[]): string[] =>
  FIXTURES.filter(([k, v]) => (keys === undefined || keys.includes(k)) && s.includes(v)).map(([k]) => k);

const arms: ArmReading[] = [];

const runArm = async (id: string, note: string, opts: ArmOpts = {}): Promise<ArmReading> => {
  reconMode = opts.recon ?? 'clean';
  userMode = opts.user ?? 'bound';
  fetchMode = opts.fetch ?? 'ok';
  if (opts.hb === null) delete process.env.RECON_HEARTBEAT_URL;
  else process.env.RECON_HEARTBEAT_URL = opts.hb ?? HB;
  if (opts.uidEnv === null) delete process.env.OPS_ALERT_UID;
  else process.env.OPS_ALERT_UID = opts.uidEnv ?? '100';
  if (opts.token === false) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = FAKE_TOKEN;
  if (opts.secret === null) process.env.CRON_SECRET = '';
  else process.env.CRON_SECRET = opts.secret ?? 'qa-only-cron-secret';

  fetchCalls = [];
  const w0 = warnLines.length;
  const e0 = errorLines.length;

  const started = Date.now();
  const { status, text, json } = await new Promise<Resp>((resolve, reject) => {
    const port = (httpServer.address() as AddressInfo).port;
    const req = http.request(
      { host: '127.0.0.1', port, path: URL_OK, method: 'GET', headers: opts.auth ?? { authorization: `Bearer ${process.env.CRON_SECRET}` } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: Row = {};
          try { parsed = JSON.parse(raw) as Row; } catch { parsed = { _raw: raw.slice(0, 300) }; }
          resolve({ status: res.statusCode || 0, text: raw, json: parsed });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
  const elapsed = Date.now() - started;

  const hbCalls = fetchCalls.filter((c) => !c.url.includes('api.telegram.org'));
  const tgCalls = fetchCalls.filter((c) => c.url.includes('api.telegram.org'));
  let tgText: string | null = null;
  if (tgCalls.length > 0 && tgCalls[0].body) {
    try { tgText = String((JSON.parse(tgCalls[0].body) as Row).text ?? ''); } catch { tgText = null; }
  }
  const armWarn = warnLines.slice(w0);
  const armErr = errorLines.slice(e0);

  const reading: ArmReading = {
    id, note,
    status,
    ok: dataOf(json).ok,
    error_code: errCodeOf(json),
    ping_calls: hbCalls.map((c) => c.url),
    ping_fail_calls: hbCalls.filter((c) => c.url.endsWith('/fail')).length,
    tg_calls: tgCalls.length,
    tg_text: tgText,
    tg_chars: tgText === null ? 0 : Array.from(tgText).length,
    elapsed_ms: elapsed,
    warn_lines: armWarn,
    error_lines: armErr,
    resp_json: json,
    resp_text_has_fixture: hitsOf(text).length > 0,
    tg_text_has_fixture: tgText !== null && hitsOf(tgText).length > 0,
    warn_has_fixture: armWarn.some((l) => hitsOf(l).length > 0),
    warn_has_heartbeat_url: armWarn.some((l) => l.includes('hc-ping.invalid') || l.includes(HB_UUID)),
  };
  arms.push(reading);
  return reading;
};

// ---- ⑧ 判据表 -----------------------------------------------------------------
type Ck = { id: string; ac: string; kind: 'response' | 'delivery' | 'unit' | 'degradation'; pass: boolean; detail: string };
const cks: Ck[] = [];
const t = (id: string, ac: string, kind: Ck['kind'], pass: boolean, detail: string) =>
  cks.push({ id, ac, kind, pass: Boolean(pass), detail });

let httpServer: http.Server;

(async () => {
  httpServer = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise<void>((r) => httpServer.once('listening', () => r()));

  // ============================================================ AC1 三态
  const A1 = await runArm('A1_ok_true', '全绿 ⇒ ping 成功位 1 次 / 无 /fail / Telegram 0 / 200 + ok:true');
  t('AC1-1a_ping_once_success_url', 'AC1', 'delivery', A1.ping_calls.length === 1 && A1.ping_calls[0] === HB, `ping=${JSON.stringify(A1.ping_calls)}`);
  t('AC1-1b_no_fail_suffix', 'AC1', 'delivery', A1.ping_fail_calls === 0, `fail_calls=${A1.ping_fail_calls}`);
  t('AC1-1c_no_telegram', 'AC1', 'delivery', A1.tg_calls === 0, `tg=${A1.tg_calls}`);
  t('AC1-1d_200_ok_true', 'AC1', 'response', A1.status === 200 && A1.ok === true, `status=${A1.status} ok=${String(A1.ok)}`);

  const A2 = await runArm('A2_ok_false', '漂移 ⇒ ping 1 次含 /fail + Telegram 1 次（id/rows/diff）/ 200 + ok:false', { recon: 'supply_drift' });
  t('AC1-2a_ping_fail_once', 'AC1', 'delivery',
    A2.ping_calls.length === 1 && A2.ping_calls[0] === `${HB}/fail`, `ping=${JSON.stringify(A2.ping_calls)}`);
  t('AC1-2b_one_telegram', 'AC1', 'delivery', A2.tg_calls === 1, `tg=${A2.tg_calls}`);
  t('AC1-2c_text_has_failed_check', 'AC1', 'delivery',
    Boolean(A2.tg_text && A2.tg_text.includes('supply_vs_ledger') && /rows=1\b/.test(A2.tg_text) && A2.tg_text.includes('diff=2000001')),
    String(A2.tg_text).slice(0, 220));
  t('AC1-2d_200_ok_false', 'AC1', 'response', A2.status === 200 && A2.ok === false, `status=${A2.status} ok=${String(A2.ok)}`);

  const A3 = await runArm('A3_infra_throw', 'handler 抛错 ⇒ ping 0 + Telegram 1 + 既有 infra 映射（非 200）', { recon: 'db_error' });
  t('AC1-3a_no_ping', 'AC1', 'delivery', A3.ping_calls.length === 0, `ping=${JSON.stringify(A3.ping_calls)}`);
  t('AC1-3b_one_telegram', 'AC1', 'delivery', A3.tg_calls === 1, `tg=${A3.tg_calls}`);
  t('AC1-3c_infra_mapping_unchanged', 'AC1', 'response',
    A3.status === 503 && A3.ok === undefined && typeof A3.error_code === 'string' && A3.error_code.length > 0,
    `status=${A3.status} code=${String(A3.error_code)}`);
  t('AC1-3d_text_is_infra', 'AC1', 'delivery', Boolean(A3.tg_text && A3.tg_text.includes('对账执行异常')), String(A3.tg_text).slice(0, 160));

  // 与父提交（无告警面）逐字节对照 —— 若父基线读数存在则比对
  const parentFile = path.resolve(OUT_DIR, 'parent-responses.json');
  if (fs.existsSync(parentFile)) {
    const parent = JSON.parse(fs.readFileSync(parentFile, 'utf8')) as { arms: Array<{ id: string; status: number; body_keys: string[]; body: Row }> };
    const pInfra = parent.arms.find((a) => a.id === 'P_db_error');
    const pDrift = parent.arms.find((a) => a.id === 'P_drift');
    t('AC1-3e_parent_infra_body_identical', 'AC1', 'response',
      Boolean(pInfra) && pInfra!.status === A3.status && JSON.stringify(pInfra!.body) === JSON.stringify(A3.resp_json),
      `parent=${JSON.stringify(pInfra ? { status: pInfra.status, body: pInfra.body } : null)} child=${JSON.stringify(A3.resp_json)}`);
    t('AC1-3f_parent_no_alert_side_effects', 'AC1', 'delivery',
      Boolean(parent) && parent.arms.every((a) => (a as unknown as { ping_calls?: number }).ping_calls === 0),
      `parent_arms=${parent.arms.map((a) => a.id).join(',')}`);
    t('AC1-2e_drift_status_same_as_parent', 'AC1', 'response',
      Boolean(pDrift) && pDrift!.status === A2.status,
      `parent=${pDrift ? pDrift.status : 'null'} child=${A2.status}`);
  }

  // ============================================================ AC3 降级矩阵
  const M1 = await runArm('M1_no_uid_env', '缺 OPS_ALERT_UID ⇒ 不发、响应不变', { recon: 'supply_drift', uidEnv: null });
  t('M1_uid_env_missing', 'AC3', 'degradation', M1.tg_calls === 0 && M1.status === 200 && M1.ok === false && M1.ping_fail_calls === 1, `tg=${M1.tg_calls} status=${M1.status} ping=${M1.ping_calls.length}`);

  const M2 = await runArm('M2_uid_not_numeric', 'OPS_ALERT_UID=abc ⇒ 不发', { recon: 'supply_drift', uidEnv: 'abc' });
  t('M2_uid_not_numeric', 'AC3', 'degradation', M2.tg_calls === 0 && M2.status === 200 && M2.ok === false, `tg=${M2.tg_calls}`);

  const M3 = await runArm('M3_uid_zero', 'OPS_ALERT_UID=0（越界下限）⇒ 不发', { recon: 'supply_drift', uidEnv: '0' });
  t('M3_uid_zero_out_of_range', 'AC3', 'degradation', M3.tg_calls === 0 && M3.status === 200 && M3.ok === false, `tg=${M3.tg_calls}`);

  const M4 = await runArm('M4_uid_unsafe_integer', 'OPS_ALERT_UID=9007199254740993（非安全整数）⇒ 不发', { recon: 'supply_drift', uidEnv: '9007199254740993' });
  t('M4_uid_unsafe_integer', 'AC3', 'degradation', M4.tg_calls === 0 && M4.status === 200 && M4.ok === false, `tg=${M4.tg_calls}`);

  const M5 = await runArm('M5_user_missing', 'uid 查无该行 ⇒ 不发', { recon: 'supply_drift', user: 'missing' });
  t('M5_user_not_found', 'AC3', 'degradation', M5.tg_calls === 0 && M5.status === 200 && M5.ok === false, `tg=${M5.tg_calls}`);

  const M6 = await runArm('M6_tg_null', 'tg_user_id NULL（未绑）⇒ 不发', { recon: 'supply_drift', user: 'unbound' });
  t('M6_tg_user_id_null', 'AC3', 'degradation', M6.tg_calls === 0 && M6.status === 200 && M6.ok === false, `tg=${M6.tg_calls}`);

  const M7 = await runArm('M7_no_bot_token', '缺 TELEGRAM_BOT_TOKEN ⇒ 不发（不谎报 sent:true）、响应不变', { recon: 'supply_drift', token: false });
  t('M7_no_bot_token_no_fetch', 'AC3', 'degradation', M7.tg_calls === 0 && M7.status === 200 && M7.ok === false, `tg=${M7.tg_calls}`);
  // 直调：返回值必须如实 sent:false
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  let direct7: { sent?: boolean; reason?: string; threw?: string } = {};
  try { direct7 = await alertMod.notifyOps('对账漂移 QA'); } catch (e) { direct7 = { threw: e instanceof Error ? e.message : String(e) }; }
  t('M7_notify_reports_unsent', 'AC3', 'degradation',
    negNotify ? direct7.threw !== undefined : (direct7.sent === false && /TELEGRAM_BOT_TOKEN/.test(String(direct7.reason))),
    JSON.stringify(direct7));
  process.env.TELEGRAM_BOT_TOKEN = savedToken;

  const M8 = await runArm('M8_no_heartbeat_url', '缺 RECON_HEARTBEAT_URL ⇒ ping 0 且不打 warn', { hb: null });
  t('M8_no_hb_url_no_ping', 'AC3', 'degradation', M8.ping_calls.length === 0 && M8.status === 200 && M8.ok === true, `ping=${M8.ping_calls.length}`);
  t('M8_no_hb_url_no_warn', 'AC3', 'degradation', M8.warn_lines.length === 0, `warn=${JSON.stringify(M8.warn_lines)}`);

  const M8b = await runArm('M8b_no_heartbeat_url_drift', '缺 RECON_HEARTBEAT_URL + 漂移 ⇒ 仍不发心跳、不得打 warn、Telegram 照发', { hb: null, recon: 'supply_drift' });
  t('M8b_no_hb_url_drift_no_warn', 'AC3', 'degradation',
    M8b.ping_calls.length === 0 && M8b.warn_lines.length === 0 && M8b.status === 200 && M8b.ok === false && M8b.tg_calls === 1,
    `ping=${M8b.ping_calls.length} warn=${JSON.stringify(M8b.warn_lines)} tg=${M8b.tg_calls}`);

  const M9 = await runArm('M9_hb_non2xx', '心跳非 2xx ⇒ 响应不变 + warn 只含状态码', { fetch: 'non2xx' });
  t('M9_hb_non2xx_no_effect', 'AC3', 'degradation', M9.status === 200 && M9.ok === true, `status=${M9.status} ok=${String(M9.ok)}`);
  t('M9_hb_non2xx_warn_status_only', 'AC3', 'degradation',
    M9.warn_lines.some((l) => l.includes('non-2xx') && l.includes('500')) && !M9.warn_has_heartbeat_url,
    JSON.stringify(M9.warn_lines));

  const M10 = await runArm('M10_hb_timeout', '心跳挂起 ⇒ 3s 界内返回、响应不变', { fetch: 'hang' });
  t('M10_hb_timeout_bounded', 'AC3', 'degradation',
    M10.status === 200 && M10.ok === true && M10.elapsed_ms >= 2900 && M10.elapsed_ms <= 6000, `elapsed=${M10.elapsed_ms}ms`);

  const M11 = await runArm('M11_hb_fetch_throw', '心跳 fetch 抛错 ⇒ 响应不变', { fetch: 'throw' });
  t('M11_hb_fetch_throw_no_effect', 'AC3', 'degradation',
    M11.status === 200 && M11.ok === true && M11.warn_lines.some((l) => l.includes('heartbeat ping failed')),
    `status=${M11.status} warn=${JSON.stringify(M11.warn_lines)}`);

  const M12 = await runArm('M12_no_cron_secret', 'CRON_SECRET 缺 ⇒ 503 且不告警', { recon: 'supply_drift', secret: null });
  t('M12_auth_503_no_alert', 'AC3', 'degradation',
    M12.status === 503 && M12.tg_calls === 0 && M12.ping_calls.length === 0, `status=${M12.status} tg=${M12.tg_calls} ping=${M12.ping_calls.length}`);

  const M13 = await runArm('M13_wrong_secret', '错 secret ⇒ 401 且不告警', { recon: 'supply_drift', auth: { authorization: 'Bearer wrong' } });
  t('M13_auth_401_no_alert', 'AC3', 'degradation',
    M13.status === 401 && M13.tg_calls === 0 && M13.ping_calls.length === 0, `status=${M13.status} tg=${M13.tg_calls} ping=${M13.ping_calls.length}`);

  const M14 = await runArm('M14_tg_negative_group', 'tg_user_id 为负（群组 chat_id）⇒ 被判无效、不发（AC7 已知限制实证）', { recon: 'supply_drift', user: 'negative' });
  t('M14_negative_chat_id_rejected', 'AC3', 'degradation', M14.tg_calls === 0 && M14.status === 200 && M14.ok === false, `tg=${M14.tg_calls}`);

  const M15 = await runArm('M15_tg_nonnumeric', 'tg_user_id 非数字 ⇒ 不发', { recon: 'supply_drift', user: 'nonnumeric' });
  t('M15_tg_nonnumeric_rejected', 'AC3', 'degradation', M15.tg_calls === 0 && M15.status === 200 && M15.ok === false, `tg=${M15.tg_calls}`);

  const M16 = await runArm('M16_user_query_error', '收件人查询抛错 ⇒ 不发、响应不变、只一行 warn', { recon: 'supply_drift', user: 'query_error' });
  t('M16_user_query_error_no_effect', 'AC3', 'degradation',
    M16.tg_calls === 0 && M16.status === 200 && M16.ok === false && M16.warn_lines.some((l) => l.includes('notifyOps degraded')),
    `tg=${M16.tg_calls} warn=${JSON.stringify(M16.warn_lines)}`);

  // ============================================================ AC4 尾斜杠 / URL 形态
  const probePing = async (url: string | undefined, fail: boolean): Promise<{ calls: string[]; threw?: string }> => {
    fetchCalls = [];
    try { await alertMod.pingHeartbeat(url, fail); } catch (e) { return { calls: fetchCalls.map((c) => c.url), threw: e instanceof Error ? e.message : String(e) }; }
    return { calls: fetchCalls.map((c) => c.url) };
  };

  const T1r = await probePing(`${HB}/`, true);
  t('AC4-1_single_trailing_slash', 'AC4', 'unit', negPing ? true : (T1r.calls.length === 1 && T1r.calls[0] === `${HB}/fail`), negPing ? 'skipped (negctl_ping: 实现被换成 throw)' : JSON.stringify(T1r.calls));

  const T2r = await probePing(`${HB}///`, true);
  t('AC4-2_multi_trailing_slash', 'AC4', 'unit', negPing ? true : (T2r.calls.length === 1 && T2r.calls[0] === `${HB}/fail`), negPing ? 'skipped' : JSON.stringify(T2r.calls));

  const T3r = await probePing(HB, true);
  t('AC4-3_no_trailing_slash', 'AC4', 'unit', negPing ? true : (T3r.calls.length === 1 && T3r.calls[0] === `${HB}/fail`), negPing ? 'skipped' : JSON.stringify(T3r.calls));

  const T4r = await probePing(`${HB}/`, false);
  t('AC4-4_success_uses_base_asis', 'AC4', 'unit', negPing ? true : (T4r.calls.length === 1 && T4r.calls[0] === `${HB}/`), negPing ? 'skipped' : `${JSON.stringify(T4r.calls)}（成功位不带 /fail；尾斜杠原样保留 = 观察项，非判负）`);

  const T5arm = await runArm('T5_handler_trailing_slash_drift', 'env 带尾 / ⇒ 实际外发 URL 必须 /fail（不得 //fail）', { recon: 'supply_drift', hb: `${HB}/` });
  t('AC4-5_handler_url_no_double_slash', 'AC4', 'delivery',
    T5arm.ping_calls.length === 1 && T5arm.ping_calls[0] === `${HB}/fail` && !T5arm.ping_calls[0].includes('//fail'),
    JSON.stringify(T5arm.ping_calls));

  fetchCalls = [];
  try { await alertMod.pingHeartbeat(undefined); await alertMod.pingHeartbeat('   '); } catch { /* negctl_ping */ }
  t('AC4-6_empty_url_no_ping', 'AC4', 'unit', negPing ? true : fetchCalls.length === 0, negPing ? 'skipped' : `calls=${fetchCalls.length}`);

  // ============================================================ AC5 脱敏
  // ① 外发文案（handler 真路径）：DB 错误 message 内嵌连接串/令牌/JWT/长 hex
  const R1 = await runArm('R1_infra_dirty_message', '含密错误的 infra 文案 ⇒ 外发与日志均不得出现密文', { recon: 'db_error_dirty' });
  t('AC5-1_telegram_text_redacted', 'AC5', 'unit', R1.tg_calls === 1 && R1.tg_text_has_fixture === false, String(R1.tg_text).slice(0, 240));
  t('AC5-2_response_redacted', 'AC5', 'unit', R1.resp_text_has_fixture === false, `resp_fixture=${R1.resp_text_has_fixture}`);
  t('AC5-3_warn_lines_redacted', 'AC5', 'unit', R1.warn_has_fixture === false, JSON.stringify(R1.warn_lines));

  // ② 直接调 notifyOps（绕过 build* 格式化器）：仍须脱敏 + 300 字上限
  fetchCalls = [];
  const dirtyText = `对账漂移 ${FAKE_CONN} token=${FAKE_TOKEN} jwt=${FAKE_JWT} h=${FAKE_HEX} 尾部`;
  let direct5: { sent?: boolean; reason?: string } = {};
  try { direct5 = await alertMod.notifyOps(dirtyText); } catch (e) { direct5 = { sent: undefined, reason: `threw: ${e instanceof Error ? e.message : 'ERROR'}` }; }
  const dTg = fetchCalls.filter((c) => c.url.includes('api.telegram.org'));
  let dBody = '';
  try { dBody = String((JSON.parse(String(dTg[0]?.body ?? '{}')) as Row).text ?? ''); } catch { dBody = ''; }
  t('AC5-4_notify_redacts_direct', 'AC5', 'unit',
    negNotify ? true : (dTg.length === 1 && hitsOf(dBody).length === 0),
    `tg=${dTg.length} text=${dBody.slice(0, 200)}`);
  t('AC5-5_notify_within_300', 'AC5', 'unit', negNotify ? true : (Array.from(dBody).length > 0 && Array.from(dBody).length <= 300),
    `chars=${Array.from(dBody).length}`);
  t('AC5-6_notify_sent_flag_honest', 'AC5', 'unit', negNotify ? true : (direct5.sent === true),
    JSON.stringify(direct5));

  // ③ 长文本截断后不得残留半截密文
  fetchCalls = [];
  const longText = `${FAKE_CONN} ${'对账漂移细节 '.repeat(80)}`;
  try { await alertMod.notifyOps(longText); } catch { /* negctl_notify */ }
  const lTg = fetchCalls.filter((c) => c.url.includes('api.telegram.org'));
  let lBody = '';
  try { lBody = String((JSON.parse(String(lTg[0]?.body ?? '{}')) as Row).text ?? ''); } catch { lBody = ''; }
  t('AC5-7_truncation_no_partial_secret', 'AC5', 'unit',
    negNotify ? true : (hitsOf(lBody).length === 0 && Array.from(lBody).length <= 300 && !lBody.includes('S3cret')),
    `chars=${Array.from(lBody).length} text=${lBody.slice(0, 120)}`);

  // ④ 日志不得出现心跳 URL / UUID —— 含「URL 内嵌进异常 message」这一真实形态
  const R4 = await runArm('R4_url_in_error_message', '心跳 fetch 抛 TypeError（message 内嵌 URL）⇒ 日志不得带 UUID/URL', { fetch: 'throw_url' });
  const uuidInWarn = R4.warn_lines.some((l) => l.includes(HB_UUID) || l.includes('hc-ping.invalid'));
  t('AC5-8_no_uuid_in_log_when_url_in_error', 'AC5', 'unit', !uuidInWarn, JSON.stringify(R4.warn_lines));

  // 全臂汇总（不含 R4 这条刻意构造）
  const allWarn = warnLines.filter((l) => !l.includes('Failed to parse URL from'));
  t('AC5-9_no_heartbeat_url_in_any_log', 'AC5', 'unit',
    allWarn.every((l) => !l.includes('hc-ping.invalid') && !l.includes(HB_UUID)), `${allWarn.length} warn lines scanned`);
  // 告警面自身只走 console.warn（notifyOps / pingHeartbeat / runAlertSafely 三处）⇒ 逐行断言
  t('AC5-10_no_bot_token_in_alert_warn', 'AC5', 'unit',
    [...warnLines, ...errorLines.filter((l) => l.startsWith('[recon]'))].every((l) => !l.includes('AAFakeTokenXYZ')),
    `warn=${warnLines.length} alert_error=${errorLines.filter((l) => l.startsWith('[recon]')).length}`);
  t('AC5-11_no_connstring_in_alert_warn', 'AC5', 'unit',
    [...warnLines, ...errorLines.filter((l) => l.startsWith('[recon]'))].every((l) => !l.includes('S3cretPassw0rd')),
    `warn=${warnLines.length}`);

  // ⑤ 既有 infra 诊断日志（非本单新增面）是否泄漏 raw message —— 与父提交同形即「既有面」
  const diagLeaks = errorLines.filter((l) => l.startsWith('[ops.recon.ledger]') && (l.includes('S3cretPassw0rd') || l.includes('AAFakeTokenXYZ')));
  const parentDiag = fs.existsSync(path.resolve(OUT_DIR, 'parent-responses.json'))
    ? (JSON.parse(fs.readFileSync(path.resolve(OUT_DIR, 'parent-responses.json'), 'utf8')) as { arms: Array<{ id: string; error_lines: string[] }> })
      .arms.find((a) => a.id === 'P_db_error_dirty')
    : undefined;
  const parentDiagLeaks = (parentDiag?.error_lines ?? []).filter((l) => l.includes('S3cretPassw0rd') || l.includes('AAFakeTokenXYZ'));
  t('AC5-12_infra_diag_leak_same_as_parent', 'AC5', 'unit',
    diagLeaks.length === parentDiagLeaks.length && diagLeaks.length > 0,
    `child_diag_leak_lines=${diagLeaks.length} parent_diag_leak_lines=${parentDiagLeaks.length}（既有面 sendInfraMapped/ledgerErrorDiagnostics，本单未改）`);

  // ============================================================ 附：延迟上界（观察项）
  const L1 = await runArm('L1_drift_both_hang', '漂移 + 心跳挂起 + Telegram 挂起 ⇒ 串行 6s 上界内返回', { recon: 'supply_drift', fetch: 'hang' });
  t('OBS-latency-bounded', 'OBS', 'unit', L1.status === 200 && L1.ok === false, `elapsed=${L1.elapsed_ms}ms`);

  // ---- 汇总落盘 ----------------------------------------------------------------
  const failed = cks.filter((c) => !c.pass);
  const byKind = (k: Ck['kind']) => cks.filter((c) => c.kind === k);
  const respFailed = byKind('response').filter((c) => !c.pass);
  const delivFailed = byKind('delivery').filter((c) => !c.pass);
  const acFailed = (ac: string) => cks.filter((c) => c.ac === ac && !c.pass);

  const out = {
    probe: 'qa-alert-behavior',
    mode: MODE,
    tree: BACKEND_ROOT,
    at: new Date().toISOString(),
    negctl_applied: negctlApplied,
    fixtures: { heartbeat_url_shape: 'https://hc-ping.invalid/ping/<uuid>', token_shape: '<digits>:<35>', note: '全部为构造值' },
    summary: {
      total: cks.length,
      passed: cks.length - failed.length,
      failed: failed.map((f) => f.id),
      response_assertions: byKind('response').length,
      response_failed: respFailed.map((f) => f.id),
      delivery_assertions: byKind('delivery').length,
      delivery_failed: delivFailed.map((f) => f.id),
      by_ac: ['AC1', 'AC3', 'AC4', 'AC5', 'OBS'].map((ac) => ({
        ac, total: cks.filter((c) => c.ac === ac).length, failed: acFailed(ac).map((f) => f.id),
      })),
    },
    assertions: cks,
    arms,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.resolve(OUT_DIR, `qa-behavior-${MODE}.json`);
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');

  origWarn('===== ASSERTIONS =====');
  for (const c of cks) origWarn(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} [${c.ac}/${c.kind}] :: ${c.detail}`);
  origWarn(JSON.stringify({ saved: file, mode: MODE, total: cks.length, passed: cks.length - failed.length, failed: failed.map((f) => f.id), response_failed: respFailed.map((f) => f.id), delivery_failed: delivFailed.map((f) => f.id) }));

  // 模式化退出码：baseline 要求全绿；negctl 要求「响应断言全绿 + 至少一条投递断言为红」
  const ok = MODE.includes('negctl')
    ? (respFailed.length === 0 && delivFailed.length > 0)
    : failed.length === 0;

  httpServer.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  origError('PROBE_FATAL', e instanceof Error ? e.stack : String(e));
  process.exit(2);
});

