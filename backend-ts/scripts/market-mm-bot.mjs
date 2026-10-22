#!/usr/bin/env node
// market-mm-bot.mjs — 方案 C 外部做市机器人（平台 MM 账户双边挂单 · 撤旧挂新）
// ============================================================================
// 用途：给平台做市（MM）账户在 POST /api/order 挂双边限价单，让任何用户的挂单都能成交：
//       taker 挂价格交叉的对手单后走 M3 撮合动词 matchMarketOrders（对手方服务端选择、
//       定价恒 = 买单限价 DL85、手费 = taker 且恒 $ DL87）；自成交双闸不变 ——
//       MM 自己的买单（低价）与卖单（高价）永不互碰。
// 长跑：cron/pm2/systemd 拉起即可（缺省死循环 + 出错指数退避）；--once 单轮退出（验收/巡检用）。
// 运行：node backend-ts/scripts/market-mm-bot.mjs [--env ~/.config/seafood/mm.env] [--once]
// 安全：私钥/token 只进闭包，绝不打印、绝不落 state；日志只记决策与响应状态。
// 纪律：不改撮合引擎、零新路由 —— 本文件是纯 API 消费者。
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  CONFIG_DEFAULTS,
  buildCreateKey,
  computeQuoteTargets,
  deriveRefPrice,
  openOwnOrdersForPair,
  planQuotes,
  resolveConfig,
  windowSeq,
} from './market-mm-quotes.mjs';

const require = createRequire(import.meta.url);
const { Wallet } = require('ethers'); // 复用 backend-ts 既有依赖（零新增）

// ---------------------------------------------------------------- CLI / env 装载
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const argValue = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

const envPath = path.resolve(argValue('--env') || path.join(os.homedir(), '.config/seafood/mm.env'));
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

if (!fs.existsSync(envPath)) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: `env file missing: ${envPath} (run market-mm-setup.ts first)` }));
  process.exit(1);
}
loadEnvFile(envPath);

let CFG;
try {
  CFG = resolveConfig(process.env);
} catch (e) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: `config invalid: ${e.message}` }));
  process.exit(1);
}

const wallet = new Wallet(String(process.env.MM_PRIVATE_KEY || ''));
const MM_ADDRESS = wallet.address.toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(MM_ADDRESS)) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'fatal', msg: 'MM_PRIVATE_KEY missing/invalid in env file' }));
  process.exit(1);
}

const stateFile = CFG.stateFile
  ? path.resolve(CFG.stateFile)
  : path.join(path.dirname(envPath), 'mm-state.json');

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

function log(fields) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), mm: `0x…${MM_ADDRESS.slice(-6)}`, pair: `${CFG.baseCid}/${CFG.quoteCid}`, ...fields }));
}

// ---------------------------------------------------------------- HTTP 层
class ApiError extends Error {
  constructor(status, code, message) {
    super(`HTTP ${status} ${code || 'NO_CODE'}: ${String(message || '').slice(0, 200)}`);
    this.status = status;
    this.code = code || null;
  }
}

async function api(token, method, urlPath, body) {
  const res = await fetch(CFG.apiBase + urlPath, {
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

async function round(n) {
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
    envRefPrice: CFG.refPriceEnv,
    stateRefPrice: state.last_ref_price,
  });

  if (ref.refPrice === null) {
    // 停止条件：ref 无来源（无成交 ∧ env 未给 ∧ state 无存）⇒ 只撤不挂 + 告警
    const mine = openOwnOrdersForPair(ownOrders, CFG.baseCid);
    for (const o of mine) {
      await api(token, 'DELETE', `/api/order/${o.oID}`).catch((e) => log({ level: 'warn', round: n, msg: `cancel ${o.oID} failed: ${e.message}` }));
    }
    log({ level: 'alert', round: n, msg: 'ref_price_unavailable: cancelled own orders, no quotes placed', source: ref.source, open_cancelled: mine.length });
    writeState({ ...state, last_round_ts: t0, last_round: n, last_round_summary: { mode: 'cancel_only_no_ref' } });
    return;
  }

  const targets = computeQuoteTargets({ refPrice: ref.refPrice, spreadPct: CFG.spreadPct });
  const mine = openOwnOrdersForPair(ownOrders, CFG.baseCid);
  const quoteAvail = fetchJsonNumber(balances, CFG.quoteCid);
  const baseAvail = fetchJsonNumber(balances, CFG.baseCid);

  const plan = planQuotes({
    targets,
    ownOpenOrders: mine,
    refPrice: ref.refPrice,
    quoteAvail,
    baseAvail,
    orderSizeBase: CFG.orderSizeBase,
    maxInventoryPct: CFG.maxInventoryPct,
  });

  const seq = windowSeq(Date.now(), CFG.intervalS);
  const done = [];

  for (const c of plan.cancels) {
    try {
      await api(token, 'DELETE', `/api/order/${c.oID}`);
      done.push({ action: 'cancel', oID: c.oID, side: c.side, price: c.price, reason: c.reason, ok: true });
    } catch (e) {
      // 已被成交/已撤 ⇒ 404/409 属良性；其余记失败不中断本轮
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
      done.push({ action: 'place', side: p.side, price: p.price, amount: p.amount, create_key: createKey, ok: false, status: e.status, code: e.code });
    }
  }

  log({
    level: plan.mode === 'cancel_only' ? 'alert' : 'info',
    round: n,
    ref_price: ref.refPrice,
    ref_source: ref.source,
    targets,
    balances: { quote_avail: quoteAvail, base_avail: baseAvail },
    mode: plan.mode,
    keeps: plan.keeps.map((k) => ({ oID: k.oID, side: k.side, price: k.price })),
    alerts: plan.alerts,
    ms: Date.now() - t0,
  });
  for (const d of done) log({ level: d.ok === false ? 'warn' : 'info', round: n, ...d });

  writeState({ ...state, last_ref_price: ref.refPrice, last_ref_source: ref.source, last_round_ts: t0, last_round: n, last_round_summary: { mode: plan.mode, placed: plan.places.length, cancelled: plan.cancels.length } });
}

// ---------------------------------------------------------------- 主循环（错误退避）
let roundNo = 0;
let errorStreak = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log({ level: 'info', msg: `bot start: api=${CFG.apiBase} spread=${CFG.spreadPct}% size=${CFG.orderSizeBase} interval=${CFG.intervalS}s state=${stateFile}` });
  for (;;) {
    roundNo += 1;
    try {
      await round(roundNo);
      errorStreak = 0;
    } catch (e) {
      errorStreak += 1;
      const backoffMs = Math.min(CFG.intervalS * 1000 * 2 ** errorStreak, CFG.intervalS * 1000 * 10);
      log({ level: 'error', round: roundNo, msg: `round failed: ${e.message}`, backoff_s: Math.round(backoffMs / 1000) });
      if (!ONCE) await sleep(backoffMs);
      if (ONCE) process.exit(1);
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
