#!/usr/bin/env node
// market-mm-bot.mjs — 方案 C 外部做市机器人（平台 MM 账户双边挂单 · 撤旧挂新）
// ============================================================================
// 用途：给平台做市（MM）账户在 POST /api/order 挂双边限价单，让任何用户的挂单都能成交：
//       taker 挂价格交叉的对手单后走 M3 撮合动词 matchMarketOrders（对手方服务端选择、
//       定价恒 = 买单限价 DL85、手费 = taker 且恒 $ DL87）；自成交双闸不变 ——
//       MM 自己的买单（低价）与卖单（高价）永不互碰。
// 长跑：cron/pm2/systemd/fly 拉起即可（缺省死循环 + 出错指数退避）；--once 单轮退出（验收/巡检用）。
// 运行：
//   node backend-ts/scripts/market-mm-bot.mjs [--env <env>] [--once]
//   node backend-ts/scripts/market-mm-bot.mjs [--env <env>] --status    # 只读本地 state/指标，不登录不下单
// 安全：私钥/token 只进闭包，绝不打印、绝不落 state；日志只记决策与响应状态。
// 纪律：不改撮合引擎、零新路由 —— 本文件是纯 API 消费者。
//
// P1（可托管服务 · 风险兑底，不依赖本机）：
//   ① 急停 flag：`<env 同目录>/mm-kill.flag` 存在 ⇒ 本轮只撤不挂 + 告警；进程保留，flag 删掉自动恢复。
//   ② 硬限额：MM_MAX_NOTIONAL_USD（单边单笔名义额）/ MM_MAX_INVENTORY_SKEW_PCT（两侧库存偏离，超限该侧不挂）。
//   ③ 自动降级：连续 MM_MAX_CONSEC_FAIL 轮报价失败 ⇒ 只撤不挂 + 告警（进程不退出，恢复后自动回双边）。
//   ④ 指标：每轮一行 JSON（stdout）+ `<state_dir>/mm-metrics.json` 滚动 MM_METRICS_LIMIT 轮。
// ============================================================================
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  appendMetricEntry,
  buildCreateKey,
  buildStatusView,
  computeQuoteTargets,
  deriveRefPrice,
  killSwitchState,
  openOwnOrdersForPair,
  planQuotes,
  resolveConfig,
  shouldDegrade,
  summarizeMetrics,
  windowSeq,
} from './market-mm-quotes.mjs';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------- CLI / env 装载
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length && !String(argv[i + 1]).startsWith('--') ? argv[i + 1] : null;
};

const envPath = path.resolve(argValue('--env') || path.join(os.homedir(), '.config/seafood/mm.env'));
const STATUS = flag('--status');
const ONCE = flag('--once') || String(process.env.MM_ONCE || '') === '1';

/** 读 env 文件：键值进 process.env（已存在的进程 env 优先，dotenv 同语义）。 */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
    if (!(k in process.env)) process.env[k] = v;
  }
  return out;
}

const envFileExists = fs.existsSync(envPath);
const hasKeyInProcEnv = String(process.env.MM_PRIVATE_KEY || '').trim() !== '';
if (!envFileExists && !STATUS) {
  // 托管口径：配置可整体来自平台 secrets（fly/railway 注入 process.env）⇒ env 文件缺失不致命
  if (hasKeyInProcEnv) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg: `env file missing: ${envPath} — running on process env (secrets mode)` }));
  } else {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: `env file missing: ${envPath} and no MM_PRIVATE_KEY in process env (run market-mm-setup.ts first)` }));
    process.exit(1);
  }
}
loadEnvFile(envPath);

let CFG;
try {
  CFG = resolveConfig(process.env);
} catch (e) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: `config invalid: ${e.message}` }));
  process.exit(1);
}

// --status 不需要私钥（只读本地 state/指标）；起跑/撤单才需要签名钱包
let wallet = null;
let MM_ADDRESS = '';
if (!STATUS) {
  wallet = new (require('ethers').Wallet)(String(process.env.MM_PRIVATE_KEY || ''));
  MM_ADDRESS = String(wallet.address || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(MM_ADDRESS)) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: 'MM_PRIVATE_KEY missing/invalid in env file' }));
    process.exit(1);
  }
}

const stateDir = CFG.stateFile ? path.dirname(path.resolve(CFG.stateFile)) : path.dirname(envPath);
const stateFile = CFG.stateFile ? path.resolve(CFG.stateFile) : path.join(stateDir, 'mm-state.json');
const metricsFile = path.join(stateDir, 'mm-metrics.json');
const killFlagFile = CFG.killFlagFile ? path.resolve(CFG.killFlagFile) : path.join(path.dirname(envPath), 'mm-kill.flag');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return {};
  }
}
function writeState(state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  } catch (e) {
    log({ level: 'warn', msg: `state write failed: ${e.message}` });
  }
}

function readMetrics() {
  try {
    const parsed = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function appendMetrics(entry) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const next = appendMetricEntry(readMetrics(), entry, CFG.metricsLimit);
    const tmp = `${metricsFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, metricsFile);
  } catch (e) {
    log({ level: 'warn', msg: `metrics write failed: ${e.message}` });
  }
}

function readKillFlag() {
  try {
    const st = fs.statSync(killFlagFile);
    return killSwitchState({ flagExists: true, flagPath: killFlagFile, flagMtimeMs: st.mtimeMs });
  } catch {
    return killSwitchState({ flagExists: false, flagPath: killFlagFile });
  }
}

function log(fields) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    ...(MM_ADDRESS ? { mm: `0x…${MM_ADDRESS.slice(-6)}` } : {}),
    pair: `${CFG.baseCid}/${CFG.quoteCid}`,
    ...fields,
  }));
}

// ---------------------------------------------------------------- --status（健康视图；也供容器探活）
function statusView() {
  const nowMs = Date.now();
  const state = readState();
  const metrics = readMetrics();
  const view = buildStatusView({ state, metrics, nowMs });
  const kill = readKillFlag();
  const stale = view.age_seconds === null || view.age_seconds > CFG.statusMaxAgeS;
  return {
    ...view,
    rounds_last_hour: summarizeMetrics(metrics, nowMs).rounds_last_hour,
    kill_switch: { active: kill.active, path: kill.flag_path, age_s: kill.flag_age_s },
    degraded: state.degraded === true,
    stale,
    max_age_s: CFG.statusMaxAgeS,
    state_file: stateFile,
  };
}

if (STATUS) {
  const view = statusView();
  console.log(JSON.stringify(view));
  process.exit(view.stale ? 2 : 0);
}

// ---------------------------------------------------------------- HTTP 层
class ApiError extends Error {
  constructor(status, code, message) {
    super(`HTTP ${status} ${code || 'NO_CODE'}: ${String(message || '').slice(0, 200)}`);
    this.status = status;
    this.code = code || null;
  }
}

/**
 * 失败重试：本机 DNS 被 TUN/fake-ip 接管时，单次 `fetch` 会偶发 ECONNRESET
 * （实测 10 次里 1 次）——一轮要打 4 个请求 ⇒ 约 35% 的轮次整轮作废、被迫退避 2 分钟。
 * 这里只对**网络层**错误重试（`ApiError` = 服务端应答，不重试）：
 *   GET 天然幂等；写口带 `create_key` 幂等指纹 ⇒ 同键重放不会重复挂单/撤单。
 */
const NET_RETRIES = Number(CFG.netRetries) > 0 ? Number(CFG.netRetries) : 3;
const NET_RETRY_DELAY_MS = 350;

async function fetchWithRetry(url, init) {
  let lastErr = null;
  for (let attempt = 1; attempt <= NET_RETRIES; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastErr = error;
      if (attempt === NET_RETRIES) break;
      await new Promise((r) => setTimeout(r, NET_RETRY_DELAY_MS * attempt));
    }
  }
  throw lastErr;
}

async function api(token, method, urlPath, body) {
  const res = await fetchWithRetry(CFG.apiBase + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 非 JSON 响应体 */
  }
  if (!res.ok || !json || json.success !== true) {
    const err = json && (json.error || json);
    throw new ApiError(res.status, err && (err.code || err.error_code), err && (err.message || err.reason));
  }
  return json.data;
}

// ---------------------------------------------------------------- 登录（token 缓存 + exp 预判刷新）
let cachedToken = null;

function tokenExp(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return Number(payload.exp) || 0;
  } catch {
    return 0;
  }
}

async function login() {
  const challenge = await api(null, 'POST', '/api/auth/challenge', { evm_address: MM_ADDRESS });
  const signature = await wallet.signMessage(challenge.message);
  const verify = await api(null, 'POST', '/api/auth/verify', {
    evm_address: MM_ADDRESS,
    signature,
    challenge_token: challenge.challenge_token,
  });
  const token = verify.token || verify.access_token;
  if (!token) throw new Error('auth/verify returned no token');
  return token;
}

async function getToken() {
  const fresh = cachedToken && tokenExp(cachedToken) - Date.now() / 1000 > 300;
  if (!fresh) cachedToken = await login();
  return cachedToken;
}

// ---------------------------------------------------------------- 每轮
const fetchJsonNumber = (rows, cid) => {
  const row = (Array.isArray(rows) ? rows : []).find((r) => Number(r && r.cid) === Number(cid));
  return row ? Math.max(0, Math.floor(Number(row.balance) || 0)) : 0;
};

/** 只撤不挂：把本币对全部在挂单撤掉（逐单，一笔失败不中断）。 */
async function cancelAllOwn(token, n, mine) {
  let cancelled = 0;
  let failed = 0;
  for (const o of mine) {
    try {
      await api(token, 'DELETE', `/api/order/${o.oID}`);
      cancelled += 1;
    } catch (e) {
      failed += 1;
      log({ level: 'warn', round: n, msg: `cancel ${o.oID} failed: ${e.message}`, oID: o.oID, status: e.status, code: e.code });
    }
  }
  return { cancelled, failed };
}

/** 落 state + 指标一条（每轮必落：正常 / 只撤不挂 / 降级）。 */
function persistRound({ state, t0, n, ref, quotes, balances, mode, cancelReason, placed, cancelled, errors, degraded = false }) {
  const tsIso = new Date(t0).toISOString();
  writeState({
    ...state,
    last_ref_price: ref.refPrice,
    last_ref_source: ref.source,
    last_round_ts: t0,
    last_round_ts_iso: tsIso,
    last_round: n,
    last_mode: mode,
    last_quotes: quotes || null,
    last_balances: balances,
    last_cancel_reason: cancelReason || null,
    last_round_summary: { mode, placed, cancelled, errors },
    degraded,
  });
  appendMetrics({
    ts: tsIso,
    round: n,
    ref_price: ref.refPrice,
    ref_source: ref.source,
    quotes: quotes || null,
    placed,
    cancelled,
    errors,
    mode,
  });
}

async function round(n, opts = {}) {
  const cancelOnly = opts.cancelOnly === true;
  const cancelReason = opts.reason || null;
  const token = await getToken();
  const t0 = Date.now();

  // 行情 + 自己的在挂单 + 余额（并行）
  const [book, trades, ownOrders, balances] = await Promise.all([
    api(token, 'GET', `/api/market/${CFG.baseCid}/orderbook`),
    api(token, 'GET', `/api/market/${CFG.baseCid}/trades?limit=10`),
    api(token, 'GET', '/api/order?limit=200&skip=0'),
    api(token, 'GET', '/api/user/balances'),
  ]);

  const state = readState();
  const ref = deriveRefPrice({
    trades,
    fixedRefPrice: CFG.refPriceFixed,
    envRefPrice: CFG.refPriceEnv,
    stateRefPrice: state.last_ref_price,
  });
  const mine = openOwnOrdersForPair(ownOrders, CFG.baseCid);
  const quoteAvail = fetchJsonNumber(balances, CFG.quoteCid);
  const baseAvail = fetchJsonNumber(balances, CFG.baseCid);
  const bal = { quote_avail: quoteAvail, base_avail: baseAvail };

  // ---------- 只撤不挂（急停 flag / 连续失败降级 / ref 无来源）----------
  if (cancelOnly || ref.refPrice === null) {
    const reason = cancelOnly
      ? cancelReason || (opts.degraded ? 'degraded_consecutive_failures' : 'cancel_only')
      : 'ref_price_unavailable';
    const res = await cancelAllOwn(token, n, mine);
    log({
      level: 'alert',
      round: n,
      msg: `cancel_only: ${reason}`,
      mode: 'cancel_only',
      reason,
      ref_price: ref.refPrice,
      ref_source: ref.source,
      open_orders: mine.length,
      cancelled: res.cancelled,
      failed: res.failed,
      balances: bal,
      book_levels: Array.isArray(book) ? book.length : null,
      ms: Date.now() - t0,
    });
    persistRound({
      state, t0, n, ref, quotes: null, balances: bal,
      mode: 'cancel_only', cancelReason: reason,
      placed: 0, cancelled: res.cancelled, errors: res.failed,
      degraded: opts.degraded === true,
    });
    return { mode: 'cancel_only', reason, errors: res.failed, placed: 0, cancelled: res.cancelled, quoteFailed: false };
  }

  // ---------- 正常双边 ----------
  const targets = computeQuoteTargets({ refPrice: ref.refPrice, spreadPct: CFG.spreadPct });
  const quotes = { buy: targets.buyPrice, sell: targets.sellPrice };
  const plan = planQuotes({
    targets,
    ownOpenOrders: mine,
    refPrice: ref.refPrice,
    quoteAvail,
    baseAvail,
    orderSizeBase: CFG.orderSizeBase,
    maxInventoryPct: CFG.maxInventoryPct,
    maxNotionalUsd: CFG.maxNotionalUsd,
    maxInventorySkewPct: CFG.maxInventorySkewPct,
  });

  const seq = windowSeq(Date.now(), CFG.intervalS);
  const done = [];
  let errors = 0;

  for (const c of plan.cancels) {
    try {
      await api(token, 'DELETE', `/api/order/${c.oID}`);
      done.push({ action: 'cancel', oID: c.oID, side: c.side, price: c.price, reason: c.reason, ok: true });
    } catch (e) {
      // 已被成交/已撤 ⇒ 404/409 属良性；其余记失败不中断本轮
      errors += 1;
      done.push({ action: 'cancel', oID: c.oID, side: c.side, price: c.price, reason: c.reason, ok: false, status: e.status, code: e.code });
    }
  }

  for (const p of plan.places) {
    const createKey = buildCreateKey({
      baseCid: CFG.baseCid,
      quoteCid: CFG.quoteCid,
      side: p.side,
      price: p.price,
      seq,
    });
    try {
      const view = await api(token, 'POST', '/api/order', {
        side: p.side,
        base_cid: CFG.baseCid,
        create_key: createKey,
        price: p.price,
        amount: p.amount,
      });
      done.push({
        action: 'place', side: p.side, price: p.price, amount: p.amount, create_key: createKey,
        boundedBy: p.boundedBy, degraded: p.degraded, ok: true,
        order_id: view && view.order_id, replay: !!(view && view.idempotent_replay),
        order_status: view && view.order_status,
      });
    } catch (e) {
      // 模糊失败（超时等）同窗重试 = 同 create_key ⇒ 服务端幂等重放兜底
      errors += 1;
      done.push({ action: 'place', side: p.side, price: p.price, amount: p.amount, create_key: createKey, ok: false, status: e.status, code: e.code });
    }
  }

  const placedOk = done.filter((d) => d.action === 'place' && d.ok === true).length;
  const cancelledOk = done.filter((d) => d.action === 'cancel' && d.ok === true).length;
  // 「报价失败」= 本轮有挂单动作但一单都没挂上（连续满 N 轮 ⇒ 降级）
  const quoteFailed = plan.places.length > 0 && placedOk === 0;

  log({
    level: plan.mode === 'cancel_only' ? 'alert' : quoteFailed ? 'warn' : 'info',
    round: n,
    ref_price: ref.refPrice,
    ref_source: ref.source,
    targets,
    quotes,
    skew_pct: plan.skew.skewPct,
    balances: bal,
    mode: plan.mode,
    limits: {
      max_notional_usd: CFG.maxNotionalUsd,
      max_inventory_skew_pct: CFG.maxInventorySkewPct,
      order_size_base: CFG.orderSizeBase,
    },
    keeps: plan.keeps.map((k) => ({ oID: k.oID, side: k.side, price: k.price })),
    alerts: plan.alerts,
    placed: placedOk,
    cancelled: cancelledOk,
    quote_failed: quoteFailed,
    ms: Date.now() - t0,
  });
  for (const d of done) log({ level: d.ok === false ? 'warn' : 'info', round: n, ...d });

  persistRound({
    state, t0, n, ref, quotes, balances: bal,
    mode: plan.mode, cancelReason: null,
    placed: placedOk, cancelled: cancelledOk, errors,
  });
  return { mode: plan.mode, errors, placed: placedOk, cancelled: cancelledOk, quoteFailed };
}

// ---------------------------------------------------------------- 健康探活（托管用；MM_HEALTH_PORT=0 ⇒ 不开）
function startHealthServer() {
  const server = http.createServer((req, res) => {
    const url = String(req.url || '/');
    if (url === '/healthz' || url === '/' || url === '/status') {
      const view = statusView();
      res.writeHead(view.stale ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(view) + '\n');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found', paths: ['/healthz'] }) + '\n');
  });
  server.listen(CFG.healthPort, () => {
    log({ level: 'info', msg: `health server listening on :${CFG.healthPort}/healthz`, stale_after_s: CFG.statusMaxAgeS });
  });
  server.on('error', (e) => log({ level: 'error', msg: `health server error: ${e.message}` }));
}

// ---------------------------------------------------------------- 主循环（急停 / 降级 / 错误退避）
let roundNo = 0;
let errorStreak = 0;
let degraded = false;
let degradedReason = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log({
    level: 'info',
    msg: `bot start: api=${CFG.apiBase} spread=${CFG.spreadPct}% size=${CFG.orderSizeBase} interval=${CFG.intervalS}s state=${stateFile} metrics=${metricsFile} kill_flag=${killFlagFile}`,
    limits: {
      max_notional_usd: CFG.maxNotionalUsd,
      max_inventory_skew_pct: CFG.maxInventorySkewPct,
      max_consec_fail: CFG.maxConsecFail,
    },
  });
  if (CFG.healthPort > 0) startHealthServer();

  for (;;) {
    roundNo += 1;
    const kill = readKillFlag();
    const cancelOnly = kill.active || degraded;
    const reason = kill.active ? kill.reason : degraded ? degradedReason : null;

    try {
      const summary = await round(roundNo, { cancelOnly, reason, degraded });
      // 一轮完整跑完（含只撤不挂轮）⇒ API 可达，清错误计数并解除降级（下一轮回双边）
      errorStreak = summary.quoteFailed ? 1 : 0;
      const d = shouldDegrade({ consecutiveFailures: errorStreak, threshold: CFG.maxConsecFail });
      if (d.degraded && !degraded) {
        degraded = true;
        degradedReason = d.reason;
        log({ level: 'alert', msg: `degrade_on: ${d.reason} ⇒ cancel_only until a round completes`, consecutive_failures: errorStreak });
      } else if (!d.degraded && degraded) {
        degraded = false;
        degradedReason = null;
        log({ level: 'alert', msg: 'degrade_off: round recovered ⇒ resume two-sided quoting' });
      }
      if (kill.active) {
        log({ level: 'alert', round: roundNo, msg: `kill_switch_active: ${kill.flag_path} (delete file to resume)`, flag_age_s: kill.flag_age_s });
      }
    } catch (e) {
      errorStreak += 1;
      const d = shouldDegrade({ consecutiveFailures: errorStreak, threshold: CFG.maxConsecFail });
      if (d.degraded && !degraded) {
        degraded = true;
        degradedReason = d.reason;
        log({ level: 'alert', msg: `degrade_on: ${d.reason} ⇒ cancel_only until a round completes`, consecutive_failures: errorStreak });
      }
      const backoffMs = Math.min(CFG.intervalS * 1000 * 2 ** errorStreak, CFG.intervalS * 1000 * 10);
      log({
        level: 'error',
        round: roundNo,
        msg: `round failed: ${e.message}`,
        consecutive_failures: errorStreak,
        degraded,
        backoff_s: Math.round(backoffMs / 1000),
      });
      appendMetrics({
        ts: new Date().toISOString(),
        round: roundNo,
        ref_price: null,
        ref_source: null,
        quotes: null,
        placed: 0,
        cancelled: 0,
        errors: 1,
        mode: 'error',
      });
      writeState({
        ...readState(),
        last_error: { ts: new Date().toISOString(), msg: String(e.message || '').slice(0, 200) },
        degraded,
        last_round: roundNo,
      });
      if (ONCE) process.exit(1);
      await sleep(backoffMs);
      continue;
    }
    if (ONCE) return;
    await sleep(CFG.intervalS * 1000);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: e.message }));
  process.exit(1);
});
