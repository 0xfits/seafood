/**
 * 行为探针 · B32 对账告警（`notifyOps` + `pingHeartbeat` 接进 `opsReconHandler`）
 * ---------------------------------------------------------------------------
 * **零真实 DB / 零真实网络 / 零写库**：
 *   · `db.readQuery` 换成桩（对账三条 SQL + `users.tg_user_id` 查询都走它）；
 *   · `globalThis.fetch` 换成桩（`api.telegram.org` 与心跳 URL 都走它 ⇒ 一次外发都不会真的发出去）；
 *   · 鉴权 / 判定 / 回执组装 / 告警分支**全部走真码**（`src/index.ts` + `src/ops-alert.ts`）。
 *
 * 跑法（cwd = backend-ts）：
 *   npx ts-node --transpile-only ../ops/recon-alert/probe/recon-alert-probe.ts
 *   # 反向对照（临时改真码后复跑，见 REPORT §7）：
 *   PROBE_NEGCTL=notify_throw npx ts-node --transpile-only ../ops/recon-alert/probe/recon-alert-probe.ts
 *
 * 退出码：0 = 全部断言为真；1 = 有断言失败（失败项逐条打印）；2 = 探针自身崩了。
 */
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';

const BACKEND_ROOT = path.resolve(__dirname, '../../../backend-ts');
const OUT_DIR = process.env.PROBE_OUT_DIR
  ? path.resolve(process.env.PROBE_OUT_DIR)
  : path.resolve(__dirname, '../readings');

// 反向对照开关：`notify_throw` ⇒ 真码被改成「notifyOps 直接 throw」时，A2 放宽 Telegram 计数断言
// （只留「响应仍 200 + ok:false」），以证明告警抛出**不阻断**主流程。
const NEGCTL = String(process.env.PROBE_NEGCTL || '').trim();

// ---- ① 先把 db 模块拿到手并换桩（必须在 index 被 require 之前）---------------
/* eslint-disable @typescript-eslint/no-var-requires */
const db = require(path.join(BACKEND_ROOT, 'src/db'));

type Row = Record<string, unknown>;
type ReconMode = 'clean' | 'supply_drift' | 'all_drift' | 'db_error';
type UserMode = 'bound' | 'unbound' | 'missing' | 'query_error';

let reconMode: ReconMode = 'clean';
let userMode: UserMode = 'bound';
const sqlCalls: Array<{ sql: string; params: unknown[] }> = [];

const supplyRows = (diff: string): Row[] => [{
  cid: 1, symbol: '$', total_supply: '2010200', sum_mint: '210274', sum_burn: '-200074',
  ledger_derived: '10200', diff,
}];

db.readQuery = async (text: string, params?: unknown[]): Promise<Row[]> => {
  const sql = String(text);
  sqlCalls.push({ sql: sql.slice(0, 60), params: params ?? [] });

  // ① 收件人查询（notifyOps 唯一一条读）
  if (sql.includes('FROM public.users WHERE uid')) {
    if (userMode === 'query_error') {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      (err as Error & { code?: string }).code = 'ECONNREFUSED';
      throw err;
    }
    if (userMode === 'missing') return [];
    // bigint 回读体例：驱动给字符串
    return [{ tg_user_id: userMode === 'bound' ? '970001' : null }];
  }

  // ② 对账三条
  if (reconMode === 'db_error') {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    (err as Error & { code?: string }).code = 'ECONNREFUSED';
    throw err;
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

// ---- ② fetch 桩（同时接住 Telegram sendMessage 与心跳 ping）------------------
type FetchCall = { url: string; method: string; body: string | null };
let fetchCalls: FetchCall[] = [];
/** `ok` = 正常 2xx；`non2xx` = 500；`throw` = 立刻 reject；`hang` = 永不返回、等 AbortController */
let fetchMode: 'ok' | 'non2xx' | 'throw' | 'hang' = 'ok';
const warnLines: string[] = [];
const origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  warnLines.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  origWarn(...args);
};

globalThis.fetch = ((input: unknown, init?: { method?: string; body?: unknown; signal?: AbortSignal }) => {
  const url = String(input);
  fetchCalls.push({ url, method: String(init?.method || 'GET'), body: init?.body === undefined ? null : String(init.body) });
  if (fetchMode === 'throw') return Promise.reject(new Error('fetch failed: connect ECONNREFUSED'));
  if (fetchMode === 'non2xx') return Promise.resolve({ ok: false, status: 500, text: async () => '' });
  if (fetchMode === 'hang') {
    return new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('This operation was aborted')));
    });
  }
  return Promise.resolve({ ok: true, status: 200, text: async () => 'OK' });
}) as unknown as typeof fetch;

// ---- ③ env（必须在 index 被 require 之前就位；env.ts 的 dotenv 不覆盖已存在值）--
const HEARTBEAT = 'https://hc-ping.invalid/ping/probe-8f3a1c2d-uuid';
process.env.VERCEL = '1';
process.env.CRON_SECRET = 'probe-only-cron-secret';
process.env.TELEGRAM_BOT_TOKEN = '123456789:PROBEFAKETOKENabcdefghijklmnopqrstuvwxyz';
process.env.OPS_ALERT_UID = '100';
process.env.RECON_HEARTBEAT_URL = HEARTBEAT;

const app = require(path.join(BACKEND_ROOT, 'src/index')).default;

// ---- ④ 工具 ------------------------------------------------------------------
const call = (method: string, url: string, headers: Record<string, string>): Promise<{ status: number; text: string; json: Row }> =>
  new Promise((resolve, reject) => {
    const port = (httpServer.address() as AddressInfo).port;
    const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, (res) => {
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

const URL_OK = '/api/ops/recon/ledger';
const AUTH = { authorization: `Bearer ${process.env.CRON_SECRET}` };

type Reading = {
  id: string;
  recon_mode: ReconMode;
  user_mode: UserMode;
  heartbeat_url_configured: boolean;
  fetch_mode: string;
  status: number;
  ok: unknown;
  error_code: string | null;
  hb_calls: string[];
  hb_fail_calls: number;
  tg_calls: number;
  tg_text: string | null;
  tg_chars: number;
  elapsed_ms: number;
  sql_calls: number;
  secret_leak: boolean;
  note: string;
};

const readings: Reading[] = [];

const arm = async (
  id: string,
  note: string,
  opts: { recon?: ReconMode; user?: UserMode; hbUrl?: string | null; fetch?: typeof fetchMode; auth?: Record<string, string> } = {},
): Promise<Reading> => {
  reconMode = opts.recon ?? 'clean';
  userMode = opts.user ?? 'bound';
  fetchMode = opts.fetch ?? 'ok';
  if (opts.hbUrl === null) delete process.env.RECON_HEARTBEAT_URL;
  else process.env.RECON_HEARTBEAT_URL = opts.hbUrl ?? HEARTBEAT;
  fetchCalls = [];
  const before = sqlCalls.length;

  const started = Date.now();
  const { status, text, json } = await call('GET', URL_OK, opts.auth ?? AUTH);
  const elapsed = Date.now() - started;

  const hb = fetchCalls.filter((c) => !c.url.includes('api.telegram.org'));
  const tg = fetchCalls.filter((c) => c.url.includes('api.telegram.org'));
  let tgText: string | null = null;
  if (tg.length > 0 && tg[0].body) {
    try { tgText = String((JSON.parse(tg[0].body) as Row).text ?? ''); } catch { tgText = null; }
  }
  const d = dataOf(json);
  const reading: Reading = {
    id,
    recon_mode: reconMode,
    user_mode: userMode,
    heartbeat_url_configured: Boolean(process.env.RECON_HEARTBEAT_URL),
    fetch_mode: fetchMode,
    status,
    ok: d.ok,
    error_code: errCodeOf(json),
    hb_calls: hb.map((c) => c.url),
    hb_fail_calls: hb.filter((c) => c.url.endsWith('/fail')).length,
    tg_calls: tg.length,
    tg_text: tgText,
    tg_chars: tgText === null ? 0 : Array.from(tgText).length,
    elapsed_ms: elapsed,
    sql_calls: sqlCalls.length - before,
    // 泄漏自检：回执 / 外发文案里不得出现心跳 UUID、bot token、连接串口令
    secret_leak: text.includes('probe-8f3a1c2d-uuid') || text.includes('PROBEFAKETOKEN')
      || (tgText ?? '').includes('probe-8f3a1c2d-uuid') || (tgText ?? '').includes('PROBEFAKETOKEN'),
    note,
  };
  readings.push(reading);
  console.log(JSON.stringify(reading));
  return reading;
};

// ---- ⑤ 主流程 ----------------------------------------------------------------
(async () => {
  httpServer = http.createServer(app).listen(0, '127.0.0.1');
  await new Promise<void>((r) => httpServer.once('listening', () => r()));

  // ① 全绿 ⇒ ping 成功位 1 次（无 /fail）+ Telegram 0 次
  const A1 = await arm('A1_ok_true_clean', 'ok=true ⇒ ping 1 次（不含 /fail）、Telegram 0 次、200 + ok:true');

  // ② 漂移 ⇒ ping /fail 1 次 + Telegram 1 次（文本带 id/rows/diff/checked_at/duration）
  const A2 = await arm('A2_ok_false_drift', 'ok=false ⇒ ping /fail 1 次 + Telegram 1 次、仍 200 + ok:false', { recon: 'supply_drift' });

  // ③ handler 抛错 ⇒ ping 0 次 + Telegram 1 次、响应仍为既有 503（§14 分类器）
  const A3 = await arm('A3_infra_error', '抛错 ⇒ ping 0 次 + Telegram 1 次、响应 503（分类器不变）', { recon: 'db_error' });

  // ③′ 三条全 FAIL（最坏文案）⇒ 300 字上限内且三条 id 齐全
  const A4 = await arm('A4_all_three_drift', '三条全 FAIL ⇒ 文案含三条 id 且 ≤300 字', { recon: 'all_drift' });

  // ④ 缺 RECON_HEARTBEAT_URL ⇒ 静默：ping 0、对账不受影响
  const A5 = await arm('A5_no_heartbeat_url_ok', '心跳 URL 缺 ⇒ ping 0、200 + ok:true（静默降级）', { hbUrl: null });
  const A6 = await arm('A6_no_heartbeat_url_drift', '心跳 URL 缺 + 漂移 ⇒ ping 0 但 Telegram 仍 1 次、200 + ok:false', { hbUrl: null, recon: 'supply_drift' });

  // ⑤ 收件人各档降级（都不发、都不改响应）
  const A7 = await arm('A7_user_unbound', 'uid 存在但 tg_user_id 为 null ⇒ Telegram 0 次', { recon: 'supply_drift', user: 'unbound' });
  const A8 = await arm('A8_user_missing', 'uid 查无该行 ⇒ Telegram 0 次', { recon: 'supply_drift', user: 'missing' });

  process.env.OPS_ALERT_UID = '';
  const A9 = await arm('A9_uid_env_missing', 'OPS_ALERT_UID 未配 ⇒ Telegram 0 次', { recon: 'supply_drift' });
  process.env.OPS_ALERT_UID = 'abc';
  const A10 = await arm('A10_uid_not_numeric', 'OPS_ALERT_UID 非数字 ⇒ Telegram 0 次', { recon: 'supply_drift' });
  process.env.OPS_ALERT_UID = '100';

  const A11 = await arm('A11_user_query_error', '收件人查询抛错 ⇒ Telegram 0 次、漂移回执仍 200 + ok:false', { recon: 'supply_drift', user: 'query_error' });

  // ⑥ 心跳侧失败三态（2xx 之外 / 抛出 / 超时）都不得改判
  const A12 = await arm('A12_heartbeat_non2xx', '心跳返回 500 ⇒ 响应仍 200 + ok:true', { fetch: 'non2xx' });
  const A13 = await arm('A13_heartbeat_throw', '心跳 fetch 抛错 ⇒ 响应仍 200 + ok:true', { fetch: 'throw' });
  const A14 = await arm('A14_heartbeat_hang_3s', '心跳挂起 ⇒ 3s AbortController 上限后仍 200（且耗时 ≥2.9s）', { fetch: 'hang' });

  // ⑦ 鉴权面不变：告警不得在鉴权失败时触发
  process.env.CRON_SECRET = '';
  const A15 = await arm('A15_no_cron_secret', 'CRON_SECRET 缺 ⇒ 503 且 ping 0 / Telegram 0', { recon: 'supply_drift' });
  process.env.CRON_SECRET = 'probe-only-cron-secret';
  const A16 = await arm('A16_wrong_secret', '错 secret ⇒ 401 且 ping 0 / Telegram 0', { recon: 'supply_drift', auth: { authorization: 'Bearer wrong-secret' } });

  // ---- ⑧ 单元面（直接调 ops-alert 的纯函数 / 单发口，不经 HTTP）----
  const alertMod = require(path.join(BACKEND_ROOT, 'src/ops-alert'));

  // 脱敏：连接串口令 / bot token / 长 hex 一律 ***
  const dirty = alertMod.buildInfraAlertText(
    new Error('connect postgresql://sf_user:S3CRETPASS@db.example.tech/x bot 123456789:AAFakeTokenAAAAAAAAAAAAAAAAAAAAAAAAAAAA pid 1'),
  ) as string;
  // 300 字上限（超长错误原文被截断并补 …）；★ 夹具用**自然长句**而非 1000 个同字符
  //   —— 后者会先命中「长 base64/hex 串」脱敏规则变成 `***`（探针自身踩坑，见 REPORT §6）
  const huge = alertMod.buildInfraAlertText(new Error('连接超时，重试中。'.repeat(120))) as string;
  // 漂移文案必带 checked_at / duration_ms / id / rows / diff
  const driftText = alertMod.buildDriftAlertText({
    ok: false,
    checked_at: '2026-10-17T03:30:00.000Z',
    duration_ms: 42,
    checks: [
      { id: 'supply_vs_ledger', status: 'FAIL', rows: 2, diff: '2000001' },
      { id: 'account_vs_ledger', status: 'PASS', rows: 0 },
      { id: 'batt_account_vs_batt_entry', status: 'PASS', rows: 0 },
    ],
  }) as string;
  const driftNoDiff = alertMod.buildDriftAlertText({
    ok: false, checked_at: '2026-10-17T03:30:00.000Z', duration_ms: 5,
    checks: [{ id: 'account_vs_ledger', status: 'FAIL', rows: 3 }],
  }) as string;

  // 缺 TELEGRAM_BOT_TOKEN ⇒ notifyOps 如实回报未送达（且不抛）
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  fetchCalls = [];
  // 反向对照模式（notifyOps 被改成直接 throw）下，直接调用会抛 —— 探针自己接住并记为「已抛」
  let noToken: { sent: boolean; reason: string } & { __threw?: boolean };
  try {
    noToken = await alertMod.notifyOps('对账漂移 探针');
  } catch (error) {
    noToken = { sent: false, reason: `threw: ${error instanceof Error ? error.message : 'ERROR'}`, __threw: true };
  }
  const noTokenTg = fetchCalls.filter((c) => c.url.includes('api.telegram.org')).length;
  process.env.TELEGRAM_BOT_TOKEN = savedToken;

  // pingHeartbeat 自身契约：url 缺 ⇒ 一次都不 ping
  fetchCalls = [];
  await alertMod.pingHeartbeat(undefined);
  await alertMod.pingHeartbeat('');
  const emptyPing = fetchCalls.length;

  // ---- ⑨ 断言 ----
  type Ck = { id: string; ok: boolean; detail: string };
  const cks: Ck[] = [];
  const t = (id: string, pass: boolean, detail: string) => cks.push({ id, ok: Boolean(pass), detail });

  t('A1_ping_once_success', A1.hb_calls.length === 1 && A1.hb_fail_calls === 0, `hb=${JSON.stringify(A1.hb_calls)}`);
  t('A1_no_telegram', A1.tg_calls === 0, `tg=${A1.tg_calls}`);
  t('A1_status_200_ok_true', A1.status === 200 && A1.ok === true, `status=${A1.status} ok=${String(A1.ok)}`);

  t('A2_ping_fail_once', A2.hb_calls.length === 1 && A2.hb_fail_calls === 1 && A2.hb_calls[0].endsWith('/fail'), `hb=${JSON.stringify(A2.hb_calls)}`);
  t('A2_one_telegram', NEGCTL === 'notify_throw' ? A2.tg_calls === 0 : A2.tg_calls === 1, `tg=${A2.tg_calls} negctl=${NEGCTL || 'none'}`);
  t('A2_200_ok_false', A2.status === 200 && A2.ok === false, `status=${A2.status} ok=${String(A2.ok)}`);
  t('A2_text_has_id_rows_diff',
    Boolean(A2.tg_text && A2.tg_text.includes('supply_vs_ledger') && /rows=\d+/.test(A2.tg_text) && A2.tg_text.includes('diff=2000001')),
    String(A2.tg_text).slice(0, 200));
  t('A2_text_has_checked_at_duration',
    Boolean(A2.tg_text && /\d{4}-\d{2}-\d{2}T/.test(A2.tg_text) && /用时\d+ms/.test(A2.tg_text)),
    String(A2.tg_text).slice(0, 200));
  t('A2_text_within_300', A2.tg_chars > 0 && A2.tg_chars <= 300, `chars=${A2.tg_chars}`);

  t('A3_no_ping', A3.hb_calls.length === 0, `hb=${JSON.stringify(A3.hb_calls)}`);
  t('A3_one_telegram', A3.tg_calls === 1, `tg=${A3.tg_calls}`);
  t('A3_503_unchanged', A3.status === 503, `status=${A3.status} code=${String(A3.error_code)}`);
  t('A3_text_infra', Boolean(A3.tg_text && A3.tg_text.includes('对账执行异常')), String(A3.tg_text).slice(0, 200));

  t('A4_three_ids_in_text',
    Boolean(A4.tg_text && A4.tg_text.includes('supply_vs_ledger') && A4.tg_text.includes('account_vs_ledger') && A4.tg_text.includes('batt_account_vs_batt_entry')),
    String(A4.tg_text).slice(0, 300));
  t('A4_text_within_300', A4.tg_chars > 0 && A4.tg_chars <= 300, `chars=${A4.tg_chars}`);

  t('A5_no_ping_no_tg', A5.hb_calls.length === 0 && A5.tg_calls === 0, `hb=${A5.hb_calls.length} tg=${A5.tg_calls}`);
  t('A5_still_200_ok_true', A5.status === 200 && A5.ok === true, `status=${A5.status} ok=${String(A5.ok)}`);
  t('A6_notify_independent_of_heartbeat', A6.tg_calls === 1 && A6.hb_calls.length === 0 && A6.status === 200 && A6.ok === false, `tg=${A6.tg_calls} hb=${A6.hb_calls.length} status=${A6.status}`);

  t('A7_unbound_no_tg', A7.tg_calls === 0 && A7.hb_fail_calls === 1, `tg=${A7.tg_calls} hbFail=${A7.hb_fail_calls}`);
  t('A8_missing_user_no_tg', A8.tg_calls === 0, `tg=${A8.tg_calls}`);
  t('A9_uid_env_missing_no_tg', A9.tg_calls === 0, `tg=${A9.tg_calls}`);
  t('A10_uid_not_numeric_no_tg', A10.tg_calls === 0, `tg=${A10.tg_calls}`);
  t('A11_user_query_error_no_tg', A11.tg_calls === 0 && A11.status === 200 && A11.ok === false, `tg=${A11.tg_calls} status=${A11.status}`);

  t('A12_non2xx_no_effect', A12.status === 200 && A12.ok === true, `status=${A12.status} ok=${String(A12.ok)}`);
  t('A13_throw_no_effect', A13.status === 200 && A13.ok === true, `status=${A13.status} ok=${String(A13.ok)}`);
  t('A14_timeout_bounded', A14.status === 200 && A14.ok === true && A14.elapsed_ms >= 2900 && A14.elapsed_ms <= 8000, `elapsed=${A14.elapsed_ms}ms status=${A14.status}`);

  t('A15_auth_503_no_alerts', A15.status === 503 && A15.hb_calls.length === 0 && A15.tg_calls === 0, `status=${A15.status} hb=${A15.hb_calls.length} tg=${A15.tg_calls}`);
  t('A16_auth_401_no_alerts', A16.status === 401 && A16.hb_calls.length === 0 && A16.tg_calls === 0, `status=${A16.status} hb=${A16.hb_calls.length} tg=${A16.tg_calls}`);

  t('U1_redact_connstring', !dirty.includes('S3CRETPASS') && !dirty.includes('sf_user'), dirty.slice(0, 200));
  t('U1_redact_bot_token', !dirty.includes('AAFakeToken'), dirty.slice(0, 200));
  t('U2_clamp_300', Array.from(huge).length <= 300 && huge.endsWith('…'), `chars=${Array.from(huge).length}`);
  t('U3_drift_text_fields', driftText.includes('2026-10-17T03:30:00.000Z') && driftText.includes('用时42ms')
    && driftText.includes('supply_vs_ledger rows=2 diff=2000001'), driftText);
  t('U4_drift_no_diff_key_uses_dash', driftNoDiff.includes('account_vs_ledger rows=3 diff=-'), driftNoDiff);
  t('U5_no_token_reports_unsent',
    NEGCTL === 'notify_throw'
      ? noToken.__threw === true && noToken.sent === false
      : (noToken.sent === false && String(noToken.reason).includes('TELEGRAM_BOT_TOKEN')),
    JSON.stringify(noToken));
  t('U5_no_token_no_fetch', noTokenTg === 0, `tg=${noTokenTg}`);
  t('U6_empty_url_no_ping', emptyPing === 0, `calls=${emptyPing}`);

  t('N1_no_secret_leak_any_arm', readings.every((r) => r.secret_leak === false), `leaks=${readings.filter((r) => r.secret_leak).map((r) => r.id).join(',') || 'none'}`);
  t('N2_no_heartbeat_url_in_logs', warnLines.every((l) => !l.includes('hc-ping.invalid') && !l.includes('probe-8f3a1c2d-uuid')), `warn_lines=${warnLines.length}`);

  const failed = cks.filter((c) => !c.ok);
  const allPass = failed.length === 0;

  const out = {
    probe: 'recon-alert-probe',
    negctl: NEGCTL || 'none',
    backend_root: BACKEND_ROOT,
    heartbeat_url_configured_sample: HEARTBEAT,
    sql_calls_total: sqlCalls.length,
    warn_lines: warnLines,
    assertions: cks,
    failed: failed.map((f) => f.id),
    all_assertions_pass: allPass,
    readings,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'probe-recon-alert.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');

  console.log('\n===== ASSERTIONS =====');
  for (const c of cks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.id} :: ${c.detail}`);
  console.log(JSON.stringify({ saved: file, total: cks.length, passed: cks.length - failed.length, failed: failed.map((f) => f.id), all_assertions_pass: allPass }));

  httpServer.close();
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error('PROBE_FATAL', e instanceof Error ? e.stack : String(e));
  process.exit(2);
});
