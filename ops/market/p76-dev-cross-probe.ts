/**
 * p76-dev-cross-probe · dev 实跑读数：两账号纯 HTTP 交叉成交（打真 dev 服务 5788，非门内嵌 app）
 * -------------------------------------------------------------------------------------------
 * 职责（p76 收尾第 5 步）：证明新接线 `POST /api/order` 自动撮合在**真 dev 服务进程**上生效：
 *   ① 夹具 = p76 门同源钱包 A/B（`~/.config/seafood/p76-gate.env`，缺则新建并落盘 0600，值不打印）。
 *   ② mint 幂等注资（键 `ops:p76:devcross:mint:*`，重跑 = 重放不重复入账）。
 *   ③ 臂1 全额交叉：A 卖 3@10000（无对手 ⇒ matches:[]/remaining=3/open）→ B 买 3@10000 ⇒
 *      **路由自动撮合**：matches 恰 1（amount=3 · counterparty=A）· remaining=0 ·
 *      `order_status='filled'`（loop 收尾 DB 真值，非创建快照）。
 *   ④ 臂2 部分交叉：A 卖 2@10000 → B 买 5@10000 ⇒ matches 恰 1（amount=2）· remaining=3 ·
 *      `order_status='partial'`（S5 修法的 dev 实证）。
 *   ⑤ DB 读回：两臂订单行（status/amount_filled）＋ 成交分录（trade×4 + trade_fee×2 · taker 付费）。
 *   ⑥ 收尾全撤两账号 ⇒ 夹具零 open/partial 残留。
 * 运行：cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *         npx ts-node --transpile-only ../ops/market/p76-dev-cross-probe.ts
 * 前置：dev 后端已在 5788 跑**本批代码**（health `ok:true`；进程须在代码改动后重启过）。
 * 读数：`ops/market/readings/p76-dev-cross-<RUN>.json`。
 * 纪律：零新路由；写库面 = 夹具 users + mint + 订单/成交（真 HTTP 提交面）；MM 盘面不触碰
 *   （本探针单笔限价 10000，MM 报价 9950/10050 族结构性不可交叉）。
 * ============================================================================
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';
import { checker, mkPool, raw1, raw } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import { postEvent } from '../../backend-ts/src/ledger';
import { withTransaction } from '../../backend-ts/src/db';

const requireFromBackend = createRequire(path.resolve(__dirname, '../..', 'backend-ts/scripts/market-mm-setup.ts'));
interface GateWallet {
  privateKey: string;
  address: string;
  signMessage(message: string): Promise<string>;
}
const { Wallet } = requireFromBackend('ethers') as {
  Wallet: new (privateKey?: string) => GateWallet & { createRandom(): GateWallet };
};

const API_BASE = String(process.env.P76_DEVCROSS_API_BASE || 'http://localhost:5788').replace(/\/+$/, '');
const PRICE = '10000';
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const OUT_DIR = path.join(__dirname, 'readings');

const readEnv = (file: string): Record<string, string> => {
  if (!fs.existsSync(file)) return {};
  const o: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return o;
};

type OrderResp = { status: number; body: Record<string, unknown> };
const dataOf = (r: OrderResp) => (r.body.data ?? {}) as Record<string, unknown>;

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/market/p76-dev-cross-probe.ts', api_base: API_BASE, price: PRICE };

  // ① 钱包（与 p76 门同源 env；缺则新建落盘，值不打印）
  const ENV_FILE = path.join(os.homedir(), '.config/seafood/p76-gate.env');
  const saved = readEnv(ENV_FILE);
  const roles = ['A', 'B'] as const;
  const wallets = {} as Record<typeof roles[number], GateWallet>;
  let envDirty = false;
  for (const role of roles) {
    const k = String(saved[`P76_KEY_${role}`] || '').trim();
    wallets[role] = k ? new Wallet(k) : Wallet.createRandom();
    if (!k) { saved[`P76_KEY_${role}`] = wallets[role].privateKey; envDirty = true; }
  }
  if (envDirty) {
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(ENV_FILE, roles.map((r) => `P76_KEY_${r}=${saved[`P76_KEY_${r}`]}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(ENV_FILE, 0o600);
  }
  const addrOf = (r: typeof roles[number]) => wallets[r].address.toLowerCase();

  // ② 币种（现取；quote=$ cid1 · base=BTTC 非 1）
  const pool = mkPool(4);
  const curRows = await raw<{ cid: string; name: string; owner_uid: string }>(pool as unknown as Qx,
    `SELECT cid::text AS cid, name, owner_uid::text AS owner_uid FROM currency WHERE cid = 1 OR is_platform_coin = true OR name = 'BTTC' ORDER BY cid`);
  const baseRow = curRows.filter((r) => r.name === 'BTTC' && Number(r.cid) !== 1)[0] ?? null;
  if (!baseRow) throw new Error('BTTC currency row missing');
  const BASE_CID = Number(baseRow.cid);
  out.currencies = { quote_cid: 1, base_cid: BASE_CID };

  const uids = {} as Record<typeof roles[number], number>;
  for (const role of roles) {
    const u = await DatabaseService.findOrCreateUserByEvm(addrOf(role));
    uids[role] = Number(u.uID);
    const a8 = addrOf(role).slice(2, 10);
    const quoteRow = curRows.find((r) => Number(r.cid) === 1) ?? { owner_uid: '0' };
    await withTransaction(async (tx) => {
      await postEvent({ op: 'mint', uid: uids[role], cid: 1, amount: '5000000', platform: Number(quoteRow.owner_uid) === 0, idempotencyKey: `ops:p76:devcross:mint:usd:${a8}`, memo: 'p76 dev-cross fixture quote funds', ex: tx });
      await postEvent({ op: 'mint', uid: uids[role], cid: BASE_CID, amount: '1000', platform: Number(baseRow.owner_uid) === 0, idempotencyKey: `ops:p76:devcross:mint:base:${a8}`, memo: 'p76 dev-cross fixture base funds', ex: tx });
    });
  }
  out.fixtures = { uids, addresses: Object.fromEntries(roles.map((r) => [r, addrOf(r)])), private_keys: '[REDACTED]' };

  // ③ HTTP 面（真 dev 服务 5788）
  const api = async (token: string | null, method: string, urlPath: string, body?: unknown): Promise<OrderResp> => {
    const res = await fetch(API_BASE + urlPath, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try { json = await res.json() as Record<string, unknown>; } catch { /* 非 JSON */ }
    return { status: res.status, body: json };
  };
  const login = async (role: typeof roles[number]): Promise<string> => {
    const ch = await api(null, 'POST', '/api/auth/challenge', { evm_address: addrOf(role) });
    const chData = (ch.body.data ?? {}) as Record<string, unknown>;
    const signature = await wallets[role].signMessage(String(chData.message ?? ''));
    const vf = await api(null, 'POST', '/api/auth/verify', { evm_address: addrOf(role), signature, challenge_token: chData.challenge_token });
    const vfData = (vf.body.data ?? {}) as Record<string, unknown>;
    const token = String(vfData.token ?? vfData.access_token ?? '');
    if (!token) throw new Error(`login failed for ${role}: ${JSON.stringify(vf.body).slice(0, 200)}`);
    return token;
  };
  const postOrder = (token: string, body: Record<string, unknown>) => api(token, 'POST', '/api/order', body);
  const cancelAll = async (token: string) => api(token, 'DELETE', '/api/order');
  const orderRowByKey = async (createKey: string): Promise<{ st: string; f: string; oid: string } | null> =>
    raw1(pool as unknown as Qx,
      `SELECT status AS st, amount_filled::text AS f, order_id::text AS oid FROM public.market_order WHERE create_key = $1`, [createKey]);
  const legsOfRootKey = async (rootKey: string): Promise<Array<Record<string, unknown>>> =>
    raw(pool as unknown as Qx,
      `SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS frozen_delta, kind
         FROM public.ledger_entry WHERE event_root_key = $1 ORDER BY txid ASC`, [rootKey]);
  const feeRateBp = async (): Promise<number | null> => {
    const r = await raw1<{ bp: string }>(pool as unknown as Qx,
      `SELECT p.fee_rate_bp::text AS bp FROM public.commission_policy p
        WHERE p.effective_from <= now() ORDER BY p.effective_from DESC, p.policy_id DESC LIMIT 1`);
    return r ? Number(r.bp) : null;
  };
  const BP = await feeRateBp();
  const feeOf = (turnover: string): string =>
    BP === null ? '0' : ((BigInt(turnover) * BigInt(BP) + 5000n) / 10000n).toString();

  const health = await api(null, 'GET', '/api/health');
  out.health = { status: health.status, body: health.body };
  if (health.status !== 200 || (health.body as Record<string, unknown>).ok !== true) {
    throw new Error(`dev backend not healthy at ${API_BASE}: ${JSON.stringify(health.body).slice(0, 200)}`);
  }

  const tokA = await login('A');
  const tokB = await login('B');
  await cancelAll(tokA);
  await cancelAll(tokB);

  // ④ 臂1 · 全额交叉（A 卖 3 → B 买 3 ⇒ B filled）
  const r1sell = await postOrder(tokA, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: '3', create_key: `cli:p76:devcross:a1:sell:${RUN}` });
  const d1s = dataOf(r1sell);
  const r1buy = await postOrder(tokB, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: '3', create_key: `cli:p76:devcross:a1:buy:${RUN}` });
  const d1b = dataOf(r1buy);
  const m1 = Array.isArray(d1b.matches) ? (d1b.matches as Array<Record<string, unknown>>) : [];
  const oA1 = await orderRowByKey(`cli:p76:devcross:a1:sell:${RUN}`);
  const oB1 = await orderRowByKey(`cli:p76:devcross:a1:buy:${RUN}`);
  const legs1 = oB1 ? await legsOfRootKey(`biz:market:trade:${oB1.oid}:1`) : [];
  ck.t('C1',
    '★臂1 全额交叉（真 dev 5788 · 纯 HTTP 无 M3 直调）：A 卖 3（matches:[] · remaining=3 · open）⇒ '
    + 'B 买 3 ⇒ **路由自动撮合** · matches 恰 1（amount=3 · counterparty=A）· remaining=0 · '
    + '`order_status="filled"`（loop 收尾 DB 真值）· DB：双单 filled · 成交分录 trade×4 + trade_fee×2',
    r1sell.status === 200 && (d1s.matches as unknown[] | undefined)?.length === 0
      && String(d1s.remaining ?? '') === '3' && String(d1s.order_status ?? '') === 'open'
      && r1buy.status === 200 && m1.length === 1
      && String(m1[0]?.amount ?? '') === '3' && String(m1[0]?.counterparty_uid ?? '') === String(uids.A)
      && String(d1b.remaining ?? '') === '0' && String(d1b.order_status ?? '') === 'filled'
      && oA1?.st === 'filled' && oA1.f === '3' && oB1?.st === 'filled' && oB1.f === '3'
      && legs1.filter((l) => String(l.kind) === 'trade').length === 4
      && legs1.filter((l) => String(l.kind) === 'trade_fee').length === 2
      && String(legs1.find((l) => String(l.kind) === 'trade_fee' && String(l.uid) === String(uids.B))?.delta ?? '') === `-${feeOf('30000')}`,
    JSON.stringify({ sell: { status: r1sell.status, matches: d1s.matches, remaining: d1s.remaining, order_status: d1s.order_status }, buy: { status: r1buy.status, matches: m1, remaining: d1b.remaining, order_status: d1b.order_status }, oA: oA1, oB: oB1, fee_oracle: feeOf('30000'), bp: BP }));

  // ⑤ 臂2 · 部分交叉（A 卖 2 → B 买 5 ⇒ B partial 余 3）
  const r2sell = await postOrder(tokA, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: '2', create_key: `cli:p76:devcross:a2:sell:${RUN}` });
  const r2buy = await postOrder(tokB, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: '5', create_key: `cli:p76:devcross:a2:buy:${RUN}` });
  const d2b = dataOf(r2buy);
  const m2 = Array.isArray(d2b.matches) ? (d2b.matches as Array<Record<string, unknown>>) : [];
  const oA2 = await orderRowByKey(`cli:p76:devcross:a2:sell:${RUN}`);
  const oB2 = await orderRowByKey(`cli:p76:devcross:a2:buy:${RUN}`);
  ck.t('C2',
    '★臂2 部分交叉（S5 修法 dev 实证）：A 卖 2 ⇒ B 买 5 ⇒ matches 恰 1（amount=2 · counterparty=A）'
    + '· remaining=3 · `order_status="partial"`（DB 真值，非创建快照 open）· DB：A filled×2 · B partial×2',
    r2sell.status === 200 && r2buy.status === 200 && m2.length === 1
      && String(m2[0]?.amount ?? '') === '2' && String(m2[0]?.counterparty_uid ?? '') === String(uids.A)
      && String(d2b.remaining ?? '') === '3' && String(d2b.order_status ?? '') === 'partial'
      && oA2?.st === 'filled' && oA2.f === '2' && oB2?.st === 'partial' && oB2.f === '2',
    JSON.stringify({ sell: { status: r2sell.status }, buy: { status: r2buy.status, matches: m2, remaining: d2b.remaining, order_status: d2b.order_status }, oA: oA2, oB: oB2 }));

  // ⑥ 收尾全撤（两账号零残留）
  await cancelAll(tokA);
  await cancelAll(tokB);
  const fixOpen = Number((await raw1<{ n: string }>(pool as unknown as Qx,
    `SELECT count(*)::text AS n FROM public.market_order
      WHERE owner_uid = ANY($1::bigint[]) AND status IN ('open','partial')`, [[uids.A, uids.B]]))?.n ?? '-1');
  ck.t('C3', '★零残留：A/B 夹具 open/partial 订单 = 0（臂2 的 partial 单已全撤）',
    fixOpen === 0, JSON.stringify({ fixture_open_orders: fixOpen }));

  out.checks = ck.checks;
  out.summary = ck.summary();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p76-dev-cross-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ saved: file, summary: out.summary }, null, 1));
  process.exit((out.summary as { failed: number }).failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
