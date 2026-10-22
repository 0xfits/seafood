#!/usr/bin/env node
// market-mm-kill.mjs — MM 急停（kill switch）：登录 MM 账号 → 全撤 → 打印撤单数/失败数
// ============================================================================
// 用途：一把把 MM 所有在挂单撤掉（跨币对），并（缺省）落急停 flag 挡住 bot 下一轮重挂。
// 用法：
//   node backend-ts/scripts/market-mm-kill.mjs [--env <env>] [--dry-run] [--no-flag] [--json]
//     --env <path>   env 文件（缺省 ~/.config/seafood/mm.env）
//     --dry-run      只列在挂单，不撤、不落 flag（安全演练/巡检）
//     --no-flag      真撤，但不落 flag（还打算让 bot 继续做市时用）
//     --json         额外输出一行机器可读 JSON
// 语义（平台现状，勿凭直觉改）：
//   · DELETE /api/order = **全撤**，服务端逐单 op='cancel'（一笔失败不阻断其余），
//     返回 { cancelled, attempted, failed, orders[] }；入参走 query，不收 body。
//   · flag 路径缺省 = <env 同目录>/mm-kill.flag（MM_KILL_FLAG 可覆盖）；bot 每轮开头检查，
//     存在即只撤不挂。**删掉 flag ⇒ bot 下一轮自动恢复双边**（进程无需重启）。
//   · 退出码：0 = 全部成功（含 0 单可撤）；1 = 有失败单 / 致命错。
// 安全：私钥/token 只进闭包，不打印、不落盘。
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { listOpenOrders, parseKillArgs, resolveConfig, summarizeCancelAll } from './market-mm-quotes.mjs';

const require = createRequire(import.meta.url);
const DEFAULT_ENV = path.join(os.homedir(), '.config/seafood/mm.env');
const args = parseKillArgs(process.argv.slice(2), { defaultEnvPath: DEFAULT_ENV });

const say = (msg) => console.log(`[mm-kill] ${msg}`);
const die = (msg, code = 1) => {
  console.error(`[mm-kill] FATAL ${msg}`);
  process.exit(code);
};

if (args.help) {
  console.log(`用法: node market-mm-kill.mjs [--env <env>] [--dry-run] [--no-flag] [--json]
  --env <path>   env 文件（缺省 ${DEFAULT_ENV}）
  --dry-run      只列在挂单，不撤、不落 flag
  --no-flag      真撤但不落 kill flag（bot 下一轮会重挂）
  --json         额外输出一行机器可读 JSON`);
  process.exit(0);
}
if (args.unknown.length > 0) die(`unknown args: ${args.unknown.join(' ')}`);

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

const envPath = path.resolve(String(args.envPath || DEFAULT_ENV));
const envFileExists = fs.existsSync(envPath);
loadEnvFile(envPath);
if (!envFileExists && !String(process.env.MM_PRIVATE_KEY || '').trim()) {
  die(`env file missing: ${envPath} and no MM_PRIVATE_KEY in process env`);
}

let CFG;
try {
  CFG = resolveConfig(process.env);
} catch (e) {
  die(`config invalid: ${e.message}`);
}

const killFlagFile = CFG.killFlagFile ? path.resolve(CFG.killFlagFile) : path.join(path.dirname(envPath), 'mm-kill.flag');

let wallet;
let MM_ADDRESS;
try {
  wallet = new (require('ethers').Wallet)(String(process.env.MM_PRIVATE_KEY || ''));
  MM_ADDRESS = String(wallet.address || '').toLowerCase();
} catch {
  die('MM_PRIVATE_KEY missing/invalid');
}
if (!/^0x[0-9a-f]{40}$/.test(MM_ADDRESS)) die('MM_PRIVATE_KEY missing/invalid');

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
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

async function getToken() {
  const ch = await api(null, 'POST', '/api/auth/challenge', { evm_address: MM_ADDRESS });
  const signature = await wallet.signMessage(ch.message);
  const verify = await api(null, 'POST', '/api/auth/verify', {
    evm_address: MM_ADDRESS,
    signature,
    challenge_token: ch.challenge_token,
  });
  const token = verify.token || verify.access_token;
  if (!token) throw new Error('auth/verify returned no token');
  return token;
}

function writeKillFlag(reason) {
  try {
    fs.mkdirSync(path.dirname(killFlagFile), { recursive: true });
    fs.writeFileSync(
      killFlagFile,
      JSON.stringify({ ts: new Date().toISOString(), by: 'market-mm-kill.mjs', reason }) + '\n',
      { mode: 0o600 },
    );
    return { written: true, path: killFlagFile, error: null };
  } catch (e) {
    return { written: false, path: killFlagFile, error: e.message };
  }
}

async function main() {
  say(`api=${CFG.apiBase} mm=0x…${MM_ADDRESS.slice(-6)} mode=${args.mode} flag=${killFlagFile}`);
  const token = await getToken();

  if (args.dryRun) {
    const orders = await api(token, 'GET', '/api/order?limit=200&skip=0');
    const open = listOpenOrders(orders);
    say(`dry_run: open_orders=${open.length} (would cancel, nothing changed)`);
    for (const o of open) say(`  would_cancel oID=${o.oID} pair=${o.pair} ${o.side} price=${o.price} remaining=${o.remaining}`);
    say(`dry_run: flag not written (would write ${killFlagFile})`);
    if (args.json) console.log(JSON.stringify({ mode: 'dry_run', api: CFG.apiBase, mm: MM_ADDRESS, open_orders: open.length, orders: open, flag: { written: false, path: killFlagFile } }));
    return 0;
  }

  const view = await api(token, 'DELETE', '/api/order');
  const sum = summarizeCancelAll(view);
  say(`cancel_all: attempted=${sum.attempted} cancelled=${sum.cancelled} failed=${sum.failed}`);
  if (sum.failed_ids.length > 0) say(`failed_ids=${sum.failed_ids.join(',')}`);

  let flag = { written: false, path: killFlagFile, error: null };
  if (args.writeFlag) {
    flag = writeKillFlag(`cancel_all:${sum.cancelled}/${sum.attempted}`);
    if (flag.written) say(`kill flag written: ${flag.path} — bot 下一轮起只撤不挂（rm 掉该文件即恢复）`);
    else say(`WARN kill flag write failed: ${flag.error} — bot 可能下一轮重挂，请手动 touch ${flag.path}`);
  } else {
    say(`kill flag NOT written (--no-flag) — bot 下一轮会重新挂单`);
  }

  if (args.json) {
    console.log(JSON.stringify({
      mode: 'cancel_all', api: CFG.apiBase, mm: MM_ADDRESS,
      cancelled: sum.cancelled, attempted: sum.attempted, failed: sum.failed, failed_ids: sum.failed_ids,
      flag,
    }));
  }
  return sum.failed > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => die(e.message));
