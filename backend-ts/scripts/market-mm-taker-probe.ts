// market-mm-taker-probe.ts — 方案 C 做市验收探针：第三方测试账号小买单吃 MM 卖单
// ============================================================================
// 职责（派单 · 方案 C 验收③）：证明「任何第三方挂单都能与 MM 双边立即交叉成交」。
//   ① 临时钱包：env TAKER_PRIVATE_KEY 可复用重跑；缺省 Wallet.createRandom()。
//      私钥只存内存 / 可选落 ~/.config/seafood/mm-taker.env（0600），绝不打印（报告 [REDACTED]）。
//   ② users 行：走平台既有 findOrCreateUserByEvm（钱包登录同一条创建路径）。
//   ③ 注 $ 测试资金：ledger mint op（幂等键 ops:mm:taker:mint:usd:<addr8> ⇒ 同钱包重跑幂等重放）。
//   ④ API 登录（challenge/verify EIP-191 签名）→ GET orderbook 取最优卖价（= MM ask）。
//   ⑤ POST /api/order 小买单（create_key = cli:mm:taker:buy:<price>:<amount>:<addr8>）
//      ⇒ 平台**挂单不自动撮合**：成交 = M3 服务动词 matchMarketOrders（对手方服务端选择、
//      定价恒 = 买单限价 DL85、taker 付 $ 手费 DL87）；探针挂交叉买单后调 M3 完成吃单。
//   ⑥ 读回订单/成交流水/余额 ⇒ JSON 报告（验收读数落 ops/market/readings/）。
// 运行：cd backend-ts && ./node_modules/.bin/ts-node --transpile-only scripts/market-mm-taker-probe.ts
// 纪律：不改撮合引擎、零新路由；写库面 = users + account/ledger_entry（经 ledger 函数）。
// ============================================================================
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Wallet } from 'ethers';
import { closePools, readQuery, withTransaction } from '../src/db';
import { postEvent } from '../src/ledger';
import { DatabaseService } from '../src/database';
import { matchMarketOrders } from '../src/market-service';

const argv = process.argv.slice(2);
const argValue = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

const API_BASE = String(process.env.MM_TAKER_API_BASE || 'http://localhost:5788').replace(/\/+$/, '');
const MINT_USD = String(process.env.MM_TAKER_MINT_USD || '50000').trim();
const BUY_AMOUNT = Math.max(1, Math.floor(Number(process.env.MM_TAKER_BUY_AMOUNT || '2')));

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string | null, message: string) {
    super(`HTTP ${status} ${code || 'NO_CODE'}: ${String(message || '').slice(0, 200)}`);
  }
}

async function api(token: string | null, method: string, urlPath: string, body?: unknown): Promise<any> {
  const res = await fetch(API_BASE + urlPath, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
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

(async () => {
  // ① 临时钱包：优先复用 ~/.config/seafood/mm-taker.env（重跑幂等）；无则生成并落 0600（私钥绝不打印）
  const envFile = path.join(os.homedir(), '.config/seafood/mm-taker.env');
  const readEnv = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {};
    const out: Record<string, string> = {};
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const i = raw.indexOf('=');
      if (i > 0) out[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
    }
    return out;
  };
  const reuseKey = String(process.env.TAKER_PRIVATE_KEY || readEnv(envFile).TAKER_PRIVATE_KEY || '').trim();
  const wallet = reuseKey ? new Wallet(reuseKey) : Wallet.createRandom();
  const evm = wallet.address.toLowerCase();
  const addr8 = evm.slice(2, 10);
  if (!reuseKey) {
    fs.mkdirSync(path.dirname(envFile), { recursive: true, mode: 0o700 });
    fs.writeFileSync(envFile, `TAKER_PRIVATE_KEY=${wallet.privateKey}\nTAKER_ADDRESS=${evm}\n`, { mode: 0o600 });
    fs.chmodSync(envFile, 0o600);
  }

  // ② users 行（登录同路径）+ ③ 注 $ 测试资金（幂等键含地址 ⇒ 换钱包必新键，同钱包重跑幂等重放）
  const user = await DatabaseService.findOrCreateUserByEvm(evm);
  const uid = Number(user.uID);
  const mint = await withTransaction((tx) =>
    postEvent({
      op: 'mint', uid, cid: 1, amount: MINT_USD, platform: true,
      idempotencyKey: `ops:mm:taker:mint:usd:${addr8}`, memo: 'market maker acceptance probe (taker quote funds)', ex: tx,
    }),
  );

  // ④ API 登录 → orderbook 最优卖价
  const challenge = await api(null, 'POST', '/api/auth/challenge', { evm_address: evm });
  const signature = await wallet.signMessage(challenge.message);
  const verify = await api(null, 'POST', '/api/auth/verify', { evm_address: evm, signature, challenge_token: challenge.challenge_token });
  const token = verify.token || verify.access_token;

  // base cid = 平台币 BTTC（name='BTTC' 且 is_platform_coin；dev cid 399 —— 与 market-mm-setup.ts 同口径）
  const rows = await readQuery<{ cid: string; name: string }>(
    `SELECT cid, name FROM currency WHERE is_platform_coin = true OR name = 'BTTC' ORDER BY cid`,
  );
  const baseRows = rows.filter((r) => r.name === 'BTTC' && Number(r.cid) !== 1);
  if (baseRows.length !== 1) throw new Error(`expected exactly one platform BTTC row, got ${baseRows.length}`);
  const baseCid = Number(baseRows[0].cid);

  const book = await api(token, 'GET', `/api/market/${baseCid}/orderbook`);
  const asks = (Array.isArray(book) ? book : []).filter((l: any) => l.side === 'sell' && Number(l.volume) > 0);
  if (asks.length === 0) throw new Error('orderbook has no sell side to lift (MM not quoting?)');
  const bestAsk = Math.min(...asks.map((l: any) => Number(l.price)));

  // ⑤ 小买单（限价 = MM 最优卖价 ⇒ 价格交叉；create_key 前缀闭集 cli:；同键重跑 = 幂等重放）
  const createKey = `cli:mm:taker:buy:${bestAsk}:${BUY_AMOUNT}:${addr8}`;
  const order = await api(token, 'POST', '/api/order', {
    side: 'buy', base_cid: baseCid, price: bestAsk, amount: BUY_AMOUNT, create_key: createKey,
  });
  const orderId = String(order && order.order_id);

  // ⑤b M3 撮合动词（平台挂单不自动撮合；服务层直调 = 平台既有成交路径，对手方服务端选择）
  const match = await matchMarketOrders({
    actorUid: uid,
    body: { taker_order_id: orderId, amount: String(BUY_AMOUNT), fill_no: '1' },
  });

  // ⑥ 读回：本单终态 + 成交流水 + 余额
  const myOrders = await api(token, 'GET', '/api/order?limit=50&skip=0');
  const trades = await api(token, 'GET', `/api/market/${baseCid}/trades?limit=10`);
  const balances = await api(token, 'GET', '/api/user/balances');

  const matchView = (match.ok ? match.view : null) as Record<string, unknown> | null;
  const report = {
    api_base: API_BASE,
    taker_private_key: '[REDACTED]',
    taker_address: evm,
    taker_uid: uid,
    mint: { cid: 1, amount: MINT_USD, idempotency_key: `ops:mm:taker:mint:usd:${addr8}`, idempotent_replay: mint.idempotent_replay, txid: mint.txid },
    base_cid: baseCid,
    best_ask: bestAsk,
    buy: { side: 'buy', price: bestAsk, amount: BUY_AMOUNT, create_key: createKey, order_id: orderId, order_status: order && order.order_status },
    match: match.ok
      ? {
          ok: true,
          fill_no: matchView && matchView.fill_no,
          price: matchView && matchView.buy_price,
          quantity: matchView && matchView.quantity,
          turnover: matchView && matchView.turnover,
          fee: matchView && matchView.fee,
          fee_rate_bp: matchView && matchView.fee_rate_bp,
          fee_rate_source: matchView && matchView.fee_rate_source,
          buy_order_id: matchView && matchView.buy_order_id,
          sell_order_id: matchView && matchView.sell_order_id,
          taker_uid: matchView && matchView.taker_uid,
          counterparty_selected_server_side: matchView && matchView.counterparty_selected_server_side,
        }
      : { ok: false, status: (match as unknown as { status?: number }).status, code: (match as unknown as { code?: string }).code, message: (match as unknown as { message?: string }).message },
    my_orders: myOrders,
    trades,
    balances,
  };
  console.log(JSON.stringify(report, null, 2));
  await closePools();
})().catch(async (e: unknown) => {
  console.error('MM TAKER PROBE FAILED:', (e as Error)?.message ?? e);
  await closePools().catch(() => undefined);
  process.exit(1);
});
