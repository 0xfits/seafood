/**
 * p76-00 · taker 循环撮合进 `POST /api/order` 门（M3-L `matchTakerOrderLoop` + matches/remaining 响应）
 * ---------------------------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p74 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/market/p76-00-taker-match-gate.ts
 * 读数：`ops/market/readings/p76-taker-match-gate-<RUN>.json`
 *
 * 派单面（本门逐条守住，2026-10-22）：
 *   ① `market-service.ts` 新增导出动词 `matchTakerOrderLoop({takerOrderId, actorUid})`：
 *      循环 `resolveMarketCounterparty`（excludeSelf=true 首选，回退 false）→ `resolveNextFillNo`
 *      → `matchMarketOrders`（**内部服务面**调用：actorUid 不传），直到 taker 无余量（filled）
 *      ∨ 无对手方；单笔失败（如 self_trade_not_allowed/409）⇒ 终止并保留已完成部分；
 *      返回加性 `matches[]`（trade_id/price/amount/counterparty_uid）与 `remaining`。
 *   ② `POST /api/order`：placeMarketOrder 成功且**非 replay** ⇒ 调 loop；响应加性
 *      `matches`/`remaining` ＋ `order_status` 以 loop 收尾 **DB 真值**覆写（partial/filled；
 *      replay ⇒ 不补撮合，既有体例 + `matches: []`）；撮合内部失败
 *      **不吞单**（单已建，撮合失败只记日志、响应仍 200 + `matches: []`）。
 *   ③ **零新路由 / 零新错误码 / 零新 kind**；注册点仍 **109**。自成交双闸保持。
 *
 * 判据面：
 *   A · 静态：注册点 109 逐 verb · 路由接线（非 replay 条件 + loop 调用 + matches/remaining 加性
 *       + replay 体例）· loop 组成（cp 回退链 / fill_no 派生 / M3 actorUid 不传 / matches 字段）
 *       · `resolveNextFillNo` 落在 database.ts（按 ledger_entry market_trade 根键前缀计数）
 *       · 新代码零 fail()、零 kind 字面量。
 *   S · 行为（**真 HTTP** · 本进程 app · port 0 · 真 dev 库提交面 —— 与 MM 探针同族）：
 *       S1 A 卖 10@10000 → B 买 10@10000 ⇒ matches 恰 1 · trade 腿 4 + fee 2（taker=B 付费）
 *          · A 收 $ · B 收币 · 双方单 filled · fee = 半进位 oracle；
 *       S2 循环多笔：C1/C2 各卖 6@10000，B 买 10 ⇒ 恰 2 笔、两对手都吃到（6+4）、fill_no 1/2；
 *       S3 自成交：同账号买卖同价 ⇒ matches=[] · 订单 open · 零 trade（双闸：excludeSelf 首选
 *          + DB 响亮拒绝兜底）；
 *       S4 replay：同 create_key 重投 ⇒ matches=[] · 零新 trade · 单据原样；
 *       S5 部分成交：对手只有 4 ⇒ taker 转 partial · matches 恰 1 · remaining='6'。
 *   H · 真 HTTP 臂：401 无 token · 400 缺 create_key · 非 replay 响应加性键形 · replay 响应
 *       `matches:[]`（无 remaining 键）· 无对手方挂单 `matches:[]` + remaining 全量。
 *   N · **负控**：N1 mutant（门把路由 [P76-MATCH-BEGIN..END] 块注掉生成 `index.p76neg.ts`，
 *       子进程 5797 真 HTTP 重跑 S1 流）⇒ S1 谓词必红 + 零 trade；N2 同一谓词喂 mutant 响应
 *       （缺 matches / matches:[]）必 false、喂真响应必 true（可证伪自检）。
 *   Z · 残留：夹具零 open 订单（逐场景 cleanup = 平台全撤口）· 本轮 taker 全为夹具单
 *       · 非夹具（含 MM）盘面前后不变 · 夹具面登记入读数。
 *
 * 纪律：**不 apply 迁移、不 push、不改 frontend/docs**；写库面 = 夹具 users + mint + 订单/成交
 *   （真 HTTP 提交面，钱包私钥落 `~/.config/seafood/p76-gate.env` 0600 **不打印**）；
 *   夹具 create_key 前缀 `cli:p76:gate:`；mint 幂等键 `ops:p76:gate:mint:*`（重跑幂等重放）。
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { checker, mkPool, qRetry, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import { postEvent } from '../../backend-ts/src/ledger';
import { withTransaction } from '../../backend-ts/src/db';

/** ethers 只在 backend-ts/node_modules ⇒ 以 backend-ts 为锚解析（ops/ 直 import 解析不到） */
const requireFromBackend = createRequire(path.resolve(__dirname, '../..', 'backend-ts/scripts/market-mm-setup.ts'));
interface GateWallet {
  privateKey: string;
  address: string;
  signMessage(message: string): Promise<string>;
}
const { Wallet } = requireFromBackend('ethers') as {
  Wallet: new (privateKey?: string) => GateWallet & { createRandom(): GateWallet };
};

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const MS_TS = readSrc('backend-ts/src/market-service.ts');
const DB_TS = readSrc('backend-ts/src/database.ts');

const PRICE = '10000'; // 全门单一价位：MM 报价（9950/10050 族）结构性不可交叉（sell 门槛 = 买价≥10000；buy 门槛 = 卖价≤10000）
const AMOUNT_S1 = '10';
const FIX_KEY_PREFIX = 'cli:p76:gate:';

// ============================================================================
// 静态面（零 DB）
// ============================================================================
const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
const routeSliceOf = (verb: string, tail: string): string => {
  const head = INDEX_TS.indexOf(`${verb}${tail}`);
  if (head < 0) return '';
  const next = INDEX_TS.indexOf('\napp.', head + 8);
  return INDEX_TS.slice(head, next < 0 ? undefined : next);
};
const ORDER_POST = routeSliceOf("app.post", "('\/api/order'");
const LOOP_SRC = MS_TS.slice(MS_TS.indexOf('M3-L · taker 循环撮合'));

/** S1 核心谓词（真实臂与 N 系 mutant 共用 —— 同一函数，保证可证伪）。
 * 注意：非 replay 响应的 `order_status` 自 P76 收尾起 = loop 收尾读库的 **DB 真值**（partial/filled），
 * 但 `amount_filled` 等其余字段仍是**创建时点快照**（挂单刻）⇒ 终态 filled/amount_filled 断言
 * 仍走 DB（S1d/S2b/S5），谓词只认加性 `matches`/`remaining`。 */
type OrderResp = { status: number; body: Record<string, unknown> };
const s1MatchesPredicate = (resp: OrderResp): boolean => {
  const data = (resp.body?.data ?? {}) as Record<string, unknown>;
  const matches = data.matches;
  return resp.status === 200
    && Array.isArray(matches)
    && matches.length === 1
    && String((matches[0] as Record<string, unknown> | undefined)?.price ?? '') === PRICE
    && String((matches[0] as Record<string, unknown> | undefined)?.amount ?? '') === AMOUNT_S1
    && String((matches[0] as Record<string, unknown> | undefined)?.trade_id ?? '') !== ''
    && String(data.remaining ?? '') === '0';
};

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/market/p76-00-taker-match-gate.ts', price: PRICE };

  // ---------------------------------------------------------------- A · 静态
  ck.t('A1',
    '★路由面：注册点仍 **109**（get 50 / post 54 / patch 4 / delete 3 / put 0 · 零新路由）',
    regs === 111 && countVerb('get') === 50 && countVerb('post') === 54 && countVerb('patch') === 4 && countVerb('delete') === 3,
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete') }));

  const SEND_FROM = ORDER_POST.indexOf('sendSuccess(');
  const SEND_BODY = SEND_FROM >= 0 ? ORDER_POST.slice(SEND_FROM) : '';
  ck.t('A2',
    '★`POST /api/order` 接线（判据按 index.ts **现取形状**写，不写假想形）：marker 对在（负控可切）'
    + '· `matchTakerOrderLoop` 全文件恰 1 次调用（import 面无括号）· **非 replay** 条件守门'
    + '· 调用实参 `takerOrderId: Number(result.view.order_id)` ＋ `actorUid: actor.user.uID`'
    + '· loop 三件进响应：`matches`/`remaining` 加性 ＋ `order_status` 以 `orderStatus ?? result.view.order_status` 覆写（DB 真值）'
    + '· replay 走既有体例 `{ ...result.view, matches }`',
    /\[P76-MATCH-BEGIN\]/.test(ORDER_POST) && /\[P76-MATCH-END\]/.test(ORDER_POST)
      && (INDEX_TS.match(/matchTakerOrderLoop\(/g) ?? []).length === 1
      && /if \(!result\.replay\)/.test(ORDER_POST)
      && ORDER_POST.includes('takerOrderId: Number(result.view.order_id)')
      && ORDER_POST.includes('actorUid: actor.user.uID')
      && /matches = loop\.matches/.test(ORDER_POST) && /remaining = loop\.remaining/.test(ORDER_POST)
      && /orderStatus = loop\.order_status/.test(ORDER_POST)
      && /\?\s*\{\s*\.\.\.result\.view,\s*matches\s*\}/.test(ORDER_POST)
      && /:\s*\{\s*\.\.\.result\.view,\s*order_status:\s*orderStatus\s*\?\?\s*result\.view\.order_status,\s*matches,\s*remaining\s*\}/.test(ORDER_POST),
    JSON.stringify({
      in_route: ORDER_POST.includes('matchTakerOrderLoop('),
      markers: ORDER_POST.includes('[P76-MATCH-BEGIN]') && ORDER_POST.includes('[P76-MATCH-END]'),
      call_count: (INDEX_TS.match(/matchTakerOrderLoop\(/g) ?? []).length,
      non_replay: /if \(!result\.replay\)/.test(ORDER_POST),
      status_override: /orderStatus \?\? result\.view\.order_status/.test(SEND_BODY),
      send_body_keys: ['...result.view', 'matches', 'remaining'].map((k) => SEND_BODY.includes(k)),
    }));

  ck.t('A3',
    '★`matchTakerOrderLoop` 组成：cp `excludeSelf=true` 首选 + 回退 `false` · 每轮重读 taker 余量'
    + '（status/amount_filled 真源）· `resolveNextFillNo` 派生 fill_no · M3 调用 **actorUid 不传**'
    + '（内部服务面）· 单笔 !ok ⇒ 停循环、保留已完成（error 上抛给路由记日志）',
    (LOOP_SRC.match(/excludeSelf: true/g) ?? []).length >= 1 && (LOOP_SRC.match(/excludeSelf: false/g) ?? []).length >= 1
      && LOOP_SRC.includes('DatabaseService.resolveNextFillNo(takerId)')
      && /await matchMarketOrders\(\{\s*\n\s*body: \{ taker_order_id: String\(takerId\), fill_no: String\(fillNo\), amount: qty\.toString\(\) \},\s*\n\s*\}\)/.test(LOOP_SRC)
      && /error: \{ status: one\.status, code: one\.code, message: one\.message \}/.test(LOOP_SRC),
    JSON.stringify({ excl_self: (LOOP_SRC.match(/excludeSelf: true/g) ?? []).length, fill_no: LOOP_SRC.includes('resolveNextFillNo(takerId)') }));

  ck.t('A4',
    '★matches 元素字段闭集 = trade_id/price/amount/counterparty_uid；返回加性 `remaining`（string）；'
    + '终止 reasons = filled/no_counterparty/not_open/order_not_found/forbidden/error',
    LOOP_SRC.includes("trade_id: String(view.trade_id ?? '')")
      && LOOP_SRC.includes('price: String(view.buy_price ?? view.price ?? taker.price)')
      && LOOP_SRC.includes('amount: String(view.quantity ?? qty.toString())')
      && LOOP_SRC.includes('counterparty_uid: String(cp.ownerUid)')
      && /reason: 'filled' \| 'no_counterparty' \| 'not_open' \| 'order_not_found' \| 'forbidden' \| 'error'/.test(LOOP_SRC)
      && LOOP_SRC.includes('remaining: string;'),
    'ok');

  ck.t('A5',
    '★`resolveNextFillNo` 落在 database.ts：按 `ledger_entry` 的 `market_trade` 行（事件根键 '
    + '`biz:market:trade:<taker>:%` 前缀）DISTINCT 计数 + 1（D-1 派生位兑现 · 只读 · 不写库）',
    DB_TS.includes('SELECT count(DISTINCT e.event_root_key)::int AS fills')
      && DB_TS.includes("e.event_root_key LIKE 'biz:market:trade:' || ${takerOrderId}::text || ':%'")
      && DB_TS.includes("e.ref_type = 'market_trade'")
      && DB_TS.includes('fills + 1'),
    'ok');

  ck.t('A6',
    '★零新错误码 / 零新 kind：新代码段零 `fail(` 调用、零 kind 字面量（loop 只上抛既有码；'
    + '事件面 kinds 不变）',
    (LOOP_SRC.match(/\bfail\(/g) ?? []).length === 0
      && ['hold', 'hold_release', 'trade', 'trade_fee'].every((k) => !(LOOP_SRC.match(new RegExp(`'${k}'`, 'g')) ?? []).length),
    'ok');

  // ============================================================================
  // 夹具 · 钱包/资金（真 dev 库提交面；重跑幂等）
  // ============================================================================
  const ENV_FILE = path.join(os.homedir(), '.config/seafood/p76-gate.env');
  const readEnv = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {};
    const o: Record<string, string> = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return o;
  };
  const saved = readEnv(ENV_FILE);
  const ROLES = ['A', 'B', 'C1', 'C2', 'D', 'E', 'F'] as const;
  type Role = typeof ROLES[number];
  const wallets = {} as Record<Role, Wallet>;
  let envDirty = false;
  for (const role of ROLES) {
    const k = String(saved[`P76_KEY_${role}`] || '').trim();
    wallets[role] = k ? new Wallet(k) : Wallet.createRandom();
    if (!k) { saved[`P76_KEY_${role}`] = wallets[role].privateKey; envDirty = true; }
  }
  if (envDirty) {
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(ENV_FILE, ROLES.map((r) => `P76_KEY_${r}=${saved[`P76_KEY_${r}`]}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(ENV_FILE, 0o600);
  }
  const addrOf = (r: Role) => wallets[r].address.toLowerCase();

  const pool = mkPool(6);
  // 币种解析（与 market-mm-setup 同口径：quote=$ cid1；base=BTTC 平台币，dev/生产 cid 不同 ⇒ 现取）
  const curRows = await raw<{ cid: string; name: string; owner_uid: string }>(pool as unknown as Qx,
    `SELECT cid::text AS cid, name, owner_uid::text AS owner_uid FROM currency WHERE cid = 1 OR is_platform_coin = true OR name = 'BTTC' ORDER BY cid`);
  const baseRow = curRows.filter((r) => r.name === 'BTTC' && Number(r.cid) !== 1)[0] ?? null;
  const quoteRow = curRows.find((r) => Number(r.cid) === 1) ?? null;
  if (!baseRow || !quoteRow) throw new Error(`currency rows missing: base=${!!baseRow} quote=${!!quoteRow}`);
  const BASE_CID = Number(baseRow.cid);
  out.currencies = { quote_cid: 1, base_cid: BASE_CID };

  const users = {} as Record<Role, number>;
  const mintKeys: string[] = [];
  for (const role of ROLES) {
    const u = await DatabaseService.findOrCreateUserByEvm(addrOf(role));
    users[role] = Number(u.uID);
    const a8 = addrOf(role).slice(2, 10);
    const mkUsd = `ops:p76:gate:mint:usd:${a8}`;
    const mkBase = `ops:p76:gate:mint:base:${a8}`;
    await withTransaction(async (tx) => {
      await postEvent({ op: 'mint', uid: users[role], cid: 1, amount: '5000000', platform: Number(quoteRow.owner_uid) === 0, idempotencyKey: mkUsd, memo: 'p76 gate fixture quote funds', ex: tx });
      await postEvent({ op: 'mint', uid: users[role], cid: BASE_CID, amount: '1000', platform: Number(baseRow.owner_uid) === 0, idempotencyKey: mkBase, memo: 'p76 gate fixture base funds', ex: tx });
    });
    mintKeys.push(mkUsd, mkBase);
  }
  const FIX_UIDS = ROLES.map((r) => users[r]);

  const balSnapshot = async (): Promise<Record<string, string>> => {
    const rows = await raw<{ uid: string; cid: string; balance: string; frozen: string }>(pool as unknown as Qx,
      `SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
         FROM account WHERE uid = ANY($1::bigint[])`, [FIX_UIDS]);
    const m: Record<string, string> = {};
    for (const r of rows) m[`${r.uid}:${r.cid}`] = (BigInt(r.balance) + BigInt(r.frozen)).toString();
    return m;
  };
  const balDelta = (before: Record<string, string>, after: Record<string, string>, uid: number, cid: number): string =>
    (BigInt(after[`${uid}:${cid}`] ?? '0') - BigInt(before[`${uid}:${cid}`] ?? '0')).toString();

  const feeRateBp = async (): Promise<number | null> => {
    const r = await raw1<{ bp: string }>(pool as unknown as Qx,
      `SELECT p.fee_rate_bp::text AS bp FROM public.commission_policy p
        WHERE p.effective_from <= now() ORDER BY p.effective_from DESC, p.policy_id DESC LIMIT 1`);
    return r ? Number(r.bp) : null;
  };
  const BP = await feeRateBp();
  /** D-2 半进位 oracle（与 market-service 同式：floor((turnover×bp+5000)/10000)；无政策行 ⇒ 0） */
  const feeOf = (turnover: string): string =>
    BP === null ? '0' : ((BigInt(turnover) * BigInt(BP) + 5000n) / 10000n).toString();

  const tradeKeyCount = async (takerOrderId: string | number): Promise<number> =>
    Number((await raw1<{ n: string }>(pool as unknown as Qx,
      `SELECT count(DISTINCT e.event_root_key)::text AS n FROM public.ledger_entry e
        WHERE e.ref_type = 'market_trade' AND e.event_root_key LIKE 'biz:market:trade:' || $1::text || ':%'`,
      [String(takerOrderId)]))?.n ?? '-1');
  const legsOfRootKey = async (rootKey: string): Promise<Array<Record<string, unknown>>> =>
    raw(pool as unknown as Qx,
      `SELECT uid::text AS uid, cid::text AS cid, delta::text AS delta, frozen_delta::text AS frozen_delta, kind
         FROM public.ledger_entry WHERE event_root_key = $1 ORDER BY txid ASC`, [rootKey]);
  const orderRowByKey = async (createKey: string): Promise<{ st: string; f: string; oid: string } | null> =>
    raw1(pool as unknown as Qx,
      `SELECT status AS st, amount_filled::text AS f, order_id::text AS oid FROM public.market_order WHERE create_key = $1`, [createKey]);

  // 盘面基线（**非夹具** owner 分组；夹具此刻零单 ⇒ 前后可比）
  const openBeforeRows = await raw<{ uid: string; n: string }>(pool as unknown as Qx,
    `SELECT o.owner_uid::text AS uid, count(*)::text AS n FROM public.market_order o
      WHERE o.status IN ('open','partial') AND o.owner_uid <> ALL($1::bigint[])
      GROUP BY o.owner_uid ORDER BY o.owner_uid`, [FIX_UIDS]);
  const openBeforeTotal = Number((await raw1<{ n: string }>(pool as unknown as Qx,
    `SELECT count(*)::text AS n FROM public.market_order WHERE status IN ('open','partial')`))?.n ?? '-1');
  out.book_before = { open_total: openBeforeTotal, non_fixture_owners: openBeforeRows };

  // ============================================================================
  // 真 HTTP 面（本进程 app · port 0 —— p74 H 系同族）
  // ============================================================================
  let server: { close: (cb?: () => void) => void } | null = null;
  let base = '';
  const api = async (token: string | null, method: string, urlPath: string, body?: unknown): Promise<OrderResp> => {
    const res = await fetch(base + urlPath, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try { json = await res.json() as Record<string, unknown>; } catch { /* 非 JSON */ }
    return { status: res.status, body: json };
  };
  const login = async (role: Role): Promise<string> => {
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
  const dataOf = (r: OrderResp) => (r.body.data ?? {}) as Record<string, unknown>;
  const keyOf = (tag: string) => `${FIX_KEY_PREFIX}${tag}:${RUN}`;
  const ALL_TOKENS: string[] = [];

  // 无交叉对手方预检（环境洁癖闸：MM 报价结构性不可交叉 ⇒ 应恒 null；非 null ⇒ 环境被污染，响亮失败）
  const assertCleanBook = async (side: 'buy' | 'sell', label: string) => {
    const cp = await DatabaseService.resolveMarketCounterparty({
      baseCid: BASE_CID, quoteCid: 1, takerOrderId: 0, takerSide: side, takerPrice: PRICE,
      takerOwnerUid: users.A, excludeSelf: true,
    });
    if (cp) throw new Error(`[p76] book contaminated before ${label}: crossable ${side} cp=${JSON.stringify(cp)}`);
  };

  try {
    process.env.VERCEL = '1';
    const mod = await import('../../backend-ts/src/index');
    const app = (mod as { default: { listen: (p: number, cb?: () => void) => unknown } }).default;
    const srv = app.listen(0) as unknown as { address: () => { port: number } | null; close: (cb?: () => void) => void; once: (ev: string, cb: () => void) => void };
    server = srv;
    await new Promise<void>((resolve) => { srv.once('listening', resolve); setTimeout(resolve, 8000); });
    base = `http://127.0.0.1:${srv.address()?.port ?? 0}`;
    out.http_base = base;

    for (const role of ROLES) ALL_TOKENS.push(await login(role));
    const [tokA, tokB, tokC1, tokC2, tokD, tokE, tokF] = ALL_TOKENS;
    for (const t of ALL_TOKENS) await cancelAll(t); // 上轮残单清理（幂等；不含非夹具单）

    // ------------------------------------------------------------ H1/H2 · 协议守卫
    const h1 = await api(null, 'POST', '/api/order', { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: '1', create_key: keyOf('h1') });
    ck.t('H1', '★真 HTTP（守卫未动）：无 token `POST /api/order` ⇒ 401（requireActor 前置不变）',
      h1.status === 401 && h1.body.success !== true, JSON.stringify({ status: h1.status }));

    const h2 = await postOrder(tokB, {});
    const h2err = (h2.body.error ?? {}) as Record<string, unknown>;
    ck.t('H2', '★真 HTTP（形状闸未动）：空 body ⇒ 400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED`（create_key fail-loud 不变）',
      h2.status === 400 && h2err.code === 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', JSON.stringify({ status: h2.status, code: h2err.code }));

    // ------------------------------------------------------------ S1 · 单笔吃单 + 腿/费/账
    await assertCleanBook('sell', 'S1');
    const bS1 = await balSnapshot();
    const s1sell = await postOrder(tokA, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: AMOUNT_S1, create_key: keyOf('s1:sell') });
    const dAs = dataOf(s1sell);
    const orderA = String(dAs.order_id ?? '');
    ck.t('S1a', '★S1 前半（真 HTTP）：A 挂卖 10@10000 ⇒ 200 · `matches:[]`（无 ≥10000 买价可吃）· '
      + '`remaining=10` · 单 open（**卖单 taker 循环空转** = 无对手方即终止）',
      s1sell.status === 200 && Array.isArray(dAs.matches) && (dAs.matches as unknown[]).length === 0
        && String(dAs.remaining ?? '') === AMOUNT_S1 && String(dAs.order_status ?? '') === 'open',
      JSON.stringify({ status: s1sell.status, matches: dAs.matches, remaining: dAs.remaining, order_status: dAs.order_status, order_id: orderA }));

    const s1buy = await postOrder(tokB, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: AMOUNT_S1, create_key: keyOf('s1:buy') });
    const dB1 = dataOf(s1buy);
    const orderB1 = String(dB1.order_id ?? '');
    const s1m = Array.isArray(dB1.matches) ? (dB1.matches as Array<Record<string, unknown>>) : [];
    ck.t('S1b', '★S1 核心（真 HTTP · s1MatchesPredicate）：B 买 10@10000 ⇒ 200 · `matches` 恰 1'
      + '（price=10000 · amount=10 · counterparty_uid=A · trade_id 非空）· `remaining=0`'
      + '（`order_status` = loop 收尾 DB 真值 **filled**；amount_filled 终态断言走 DB = S1d）',
      s1MatchesPredicate({ status: s1buy.status, body: s1buy.body })
        && String(s1m[0]?.counterparty_uid ?? '') === String(users.A),
      JSON.stringify({ status: s1buy.status, matches: s1m, remaining: dB1.remaining, order_status: dB1.order_status, order_id: orderB1 }));

    const s1Legs = orderB1 ? await legsOfRootKey(`biz:market:trade:${orderB1}:1`) : [];
    ck.t('S1c', '★S1 账面（trade 腿 4 + fee 腿 2）：根键 `biz:market:trade:<B单>:1` 分录 kinds 恰 '
      + 'trade×4 + trade_fee×2；taker=B 付费（B −fee / 平台 −1 +fee）· 四腿方向：B 出 $（冻结结算）、'
      + 'B 入 base、A 出 base（冻结结算）、A 入 $（maker 不付费）',
      s1Legs.length > 0
        && s1Legs.filter((l) => String(l.kind) === 'trade').length === 4
        && s1Legs.filter((l) => String(l.kind) === 'trade_fee').length === 2
        && BP !== null
        && String(s1Legs.find((l) => String(l.kind) === 'trade_fee' && String(l.uid) === String(users.B))?.delta ?? '') === `-${feeOf('100000')}`
        && String(s1Legs.find((l) => String(l.kind) === 'trade_fee' && String(l.uid) === '-1')?.delta ?? '') === feeOf('100000')
        && (() => { const q = s1Legs.find((l) => String(l.kind) === 'trade' && String(l.uid) === String(users.B) && String(l.cid) === '1'); return !!q && String(q.delta) === '0' && String(q.frozen_delta) === '-100000'; })()
        && (() => { const b = s1Legs.find((l) => String(l.kind) === 'trade' && String(l.uid) === String(users.B) && String(l.cid) === String(BASE_CID)); return !!b && String(b.delta) === AMOUNT_S1; })()
        && (() => { const a = s1Legs.find((l) => String(l.kind) === 'trade' && String(l.uid) === String(users.A) && String(l.cid) === String(BASE_CID)); return !!a && String(a.delta) === '0' && String(a.frozen_delta) === `-${AMOUNT_S1}`; })()
        && (() => { const q = s1Legs.find((l) => String(l.kind) === 'trade' && String(l.uid) === String(users.A) && String(l.cid) === '1'); return !!q && String(q.delta) === '100000'; })(),
      JSON.stringify({ order_b: orderB1, bp: BP, fee_oracle: feeOf('100000'), legs: s1Legs }));

    const afterS1 = await balSnapshot();
    const oA1 = orderA ? await orderRowByKey(keyOf('s1:sell')) : null;
    const oB1 = orderB1 ? await orderRowByKey(keyOf('s1:buy')) : null;
    ck.t('S1d', '★S1 资金四栏（余额对拍）：A $ +100000（maker 全额）· A base −10 · '
      + 'B $ −(100000+fee) · B base +10 · 双方单 filled（DB 真源 status/amount_filled）',
      balDelta(bS1, afterS1, users.A, 1) === '100000'
        && balDelta(bS1, afterS1, users.A, BASE_CID) === `-${AMOUNT_S1}`
        && balDelta(bS1, afterS1, users.B, BASE_CID) === AMOUNT_S1
        && balDelta(bS1, afterS1, users.B, 1) === `-${(BigInt('100000') + BigInt(feeOf('100000'))).toString()}`
        && oA1?.st === 'filled' && oA1.f === AMOUNT_S1
        && oB1?.st === 'filled' && oB1.f === AMOUNT_S1,
      JSON.stringify({
        a_usd: balDelta(bS1, afterS1, users.A, 1), a_base: balDelta(bS1, afterS1, users.A, BASE_CID),
        b_usd: balDelta(bS1, afterS1, users.B, 1), b_base: balDelta(bS1, afterS1, users.B, BASE_CID), fee: feeOf('100000'),
        oA: oA1, oB: oB1,
      }));

    ck.t('H3', '★真 HTTP（加性键形）：非 replay 响应 = 既有键（order_id/price/amount/order_status）'
      + ' + 恰加性 `matches`(Array) 与 `remaining`(string)',
      s1buy.status === 200 && typeof dB1.order_id === 'string' && Array.isArray(dB1.matches)
        && typeof dB1.remaining === 'string' && String(dB1.price) === PRICE && String(dB1.amount) === AMOUNT_S1,
      JSON.stringify({ keys: Object.keys(dB1).sort() }));

    // ------------------------------------------------------------ S2 · 循环多笔
    for (const t of ALL_TOKENS) await cancelAll(t);
    await assertCleanBook('sell', 'S2');
    const bS2 = await balSnapshot();
    const s2c1 = await postOrder(tokC1, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: '6', create_key: keyOf('s2:cs1') });
    const s2c2 = await postOrder(tokC2, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: '6', create_key: keyOf('s2:cs2') });
    const s2buy = await postOrder(tokB, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: '10', create_key: keyOf('s2:buy') });
    const dB2 = dataOf(s2buy);
    const orderB2 = String(dB2.order_id ?? '');
    const s2m = Array.isArray(dB2.matches) ? (dB2.matches as Array<Record<string, unknown>>) : [];
    ck.t('S2a', '★S2 循环多笔（真 HTTP）：C1/C2 各卖 6@10000（挂单响应各自 `matches:[]`）⇒ B 买 10 ⇒ '
      + '`matches` 恰 **2**：[0]=C1×6（同价 time_created 先者）、[1]=C2×4 · 两个 trade_id 相异',
      s2c1.status === 200 && s2c2.status === 200 && s2buy.status === 200
        && (dataOf(s2c1).matches as unknown[]).length === 0 && (dataOf(s2c2).matches as unknown[]).length === 0
        && s2m.length === 2
        && String(s2m[0]?.counterparty_uid ?? '') === String(users.C1) && String(s2m[0]?.amount ?? '') === '6'
        && String(s2m[1]?.counterparty_uid ?? '') === String(users.C2) && String(s2m[1]?.amount ?? '') === '4'
        && String(s2m[0]?.trade_id ?? '') !== String(s2m[1]?.trade_id ?? ''),
      JSON.stringify({ c1: dataOf(s2c1).matches, c2: dataOf(s2c2).matches, matches: s2m, order_b: orderB2 }));

    const oC1 = await orderRowByKey(keyOf('s2:cs1'));
    const oC2 = await orderRowByKey(keyOf('s2:cs2'));
    const oB2 = await orderRowByKey(keyOf('s2:buy'));
    const s2leg1 = orderB2 ? await legsOfRootKey(`biz:market:trade:${orderB2}:1`) : [];
    const s2leg2 = orderB2 ? await legsOfRootKey(`biz:market:trade:${orderB2}:2`) : [];
    ck.t('S2b', '★S2 幂等键链（fill_no 1/2）：B 单根键 `:1`/`:2` 各落账 trade×4 · '
      + 'C1 单 filled×6、C2 单 partial×4（余 2）· B 单 filled×10',
      (await tradeKeyCount(orderB2)) === 2
        && s2leg1.filter((l) => String(l.kind) === 'trade').length === 4
        && s2leg2.filter((l) => String(l.kind) === 'trade').length === 4
        && oC1?.st === 'filled' && oC1.f === '6'
        && oC2?.st === 'partial' && oC2.f === '4'
        && oB2?.st === 'filled' && oB2.f === '10',
      JSON.stringify({ trade_keys: await tradeKeyCount(orderB2), oC1, oC2, oB2 }));

    const afterS2 = await balSnapshot();
    ck.t('S2c', '★S2 两对手都吃到（余额对拍）：C1 $ +60000 / base −6 · C2 $ +40000 / base −4 · '
      + 'B $ −(60000+40000+两笔 fee) / base +10',
      balDelta(bS2, afterS2, users.C1, 1) === '60000' && balDelta(bS2, afterS2, users.C1, BASE_CID) === '-6'
        && balDelta(bS2, afterS2, users.C2, 1) === '40000' && balDelta(bS2, afterS2, users.C2, BASE_CID) === '-4'
        && balDelta(bS2, afterS2, users.B, BASE_CID) === '10'
        && balDelta(bS2, afterS2, users.B, 1) === `-${(BigInt('100000') + BigInt(feeOf('60000')) + BigInt(feeOf('40000'))).toString()}`,
      JSON.stringify({
        c1_usd: balDelta(bS2, afterS2, users.C1, 1), c2_usd: balDelta(bS2, afterS2, users.C2, 1),
        b_usd: balDelta(bS2, afterS2, users.B, 1), fees: [feeOf('60000'), feeOf('40000')],
      }));

    // ------------------------------------------------------------ S3 · 自成交双闸
    for (const t of ALL_TOKENS) await cancelAll(t);
    await assertCleanBook('sell', 'S3');
    const s3sell = await postOrder(tokD, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: '10', create_key: keyOf('s3:sell') });
    const oDs = await orderRowByKey(keyOf('s3:sell'));
    const s3buy = await postOrder(tokD, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: '10', create_key: keyOf('s3:buy') });
    const dB3 = dataOf(s3buy);
    const oDb = await orderRowByKey(keyOf('s3:buy'));
    ck.t('S3', '★S3 自成交（同账号买卖同价）：`matches=[]` · 订单 **open**（余 10）· 零 trade '
      + '（双闸：excludeSelf 首选无外部候选 ⇒ 回退含自身 ⇒ DB 自成交闸响亮拒绝 ⇒ 循环保已完成部分 = 空）'
      + '· 自家卖单原封（open · 余 10）',
      s3buy.status === 200 && Array.isArray(dB3.matches) && (dB3.matches as unknown[]).length === 0
        && String(dB3.remaining ?? '') === '10' && String(dB3.order_status ?? '') === 'open'
        && (await tradeKeyCount(oDb?.oid ?? '0')) === 0
        && oDb?.st === 'open' && oDb.f === '0'
        && oDs?.st === 'open' && oDs.f === '0',
      JSON.stringify({ matches: dB3.matches, remaining: dB3.remaining, order_status: dB3.order_status, order_d_buy: oDb, order_d_sell: oDs, trade_keys: await tradeKeyCount(oDb?.oid ?? '0') }));

    // ------------------------------------------------------------ S4 · replay
    const s4 = await postOrder(tokB, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: AMOUNT_S1, create_key: keyOf('s1:buy') });
    const dB4 = dataOf(s4);
    ck.t('S4', '★S4 replay（同 create_key 重投）：200 · 顶层 `idempotent_replay:true` · '
      + '`matches:[]`（**不补撮合**）· 单据原样（同 order_id · filled）· 零新 trade（根键计数仍 1）',
      s4.status === 200 && s4.body.idempotent_replay === true
        && Array.isArray(dB4.matches) && (dB4.matches as unknown[]).length === 0
        && String(dB4.order_id ?? '') === orderB1 && String(dB4.order_status ?? '') === 'filled'
        && (await tradeKeyCount(orderB1)) === 1,
      JSON.stringify({ idempotent_replay: s4.body.idempotent_replay, matches: dB4.matches, order_id: dB4.order_id, trade_keys: await tradeKeyCount(orderB1) }));
    ck.t('H4', '★真 HTTP（replay 体例）：响应 data 无 `remaining` 键（既有体例 + 恰加性 `matches`）',
      s4.status === 200 && !('remaining' in dB4) && 'matches' in dB4,
      JSON.stringify({ keys: Object.keys(dB4).sort() }));

    // ------------------------------------------------------------ S5 · 部分成交
    for (const t of ALL_TOKENS) await cancelAll(t);
    await assertCleanBook('sell', 'S5');
    const bS5 = await balSnapshot();
    const s5sell = await postOrder(tokE, { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: '4', create_key: keyOf('s5:sell') });
    const dEs = dataOf(s5sell);
    ck.t('H5', '★真 HTTP（无对手方臂）：E 挂卖 4@10000 ⇒ `matches:[]` · `remaining=4`（全量）· open',
      s5sell.status === 200 && Array.isArray(dEs.matches) && (dEs.matches as unknown[]).length === 0
        && String(dEs.remaining ?? '') === '4' && String(dEs.order_status ?? '') === 'open',
      JSON.stringify({ matches: dEs.matches, remaining: dEs.remaining }));

    const s5buy = await postOrder(tokF, { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: '10', create_key: keyOf('s5:buy') });
    const dB5 = dataOf(s5buy);
    const s5m = Array.isArray(dB5.matches) ? (dB5.matches as Array<Record<string, unknown>>) : [];
    const afterS5 = await balSnapshot();
    const oEs = await orderRowByKey(keyOf('s5:sell'));
    const oB5 = await orderRowByKey(keyOf('s5:buy'));
    ck.t('S5', '★S5 部分成交：对手只有 4 ⇒ taker 转 **partial**（余 6）· `matches` 恰 1（amount=4 · '
      + 'counterparty=E）· `remaining=6` · E 单 filled×4 · F $ −(40000+fee) / base +4',
      s5buy.status === 200 && s5m.length === 1
        && String(s5m[0]?.amount ?? '') === '4' && String(s5m[0]?.counterparty_uid ?? '') === String(users.E)
        && String(dB5.remaining ?? '') === '6' && String(dB5.order_status ?? '') === 'partial'
        && oEs?.st === 'filled' && oEs.f === '4'
        && oB5?.st === 'partial' && oB5.f === '4'
        && balDelta(bS5, afterS5, users.F, 1) === `-${(BigInt('40000') + BigInt(feeOf('40000'))).toString()}`
        && balDelta(bS5, afterS5, users.F, BASE_CID) === '4',
      JSON.stringify({ matches: s5m, remaining: dB5.remaining, order_status: dB5.order_status, fee: feeOf('40000'), oE: oEs, oF: oB5 }));

    // ------------------------------------------------------------ N2 · 谓词可证伪自检
    const realPred = s1MatchesPredicate({ status: s1buy.status, body: s1buy.body });
    const noKeyPred = s1MatchesPredicate({ status: 200, body: { data: { ...dB1, matches: undefined } } });
    const emptyPred = s1MatchesPredicate({ status: 200, body: { data: { ...dB1, matches: [] } } });
    ck.t('N2', '★负控②（谓词可证伪）：同一 `s1MatchesPredicate` 喂真响应 ⇒ true；喂 mutant 响应'
      + '（缺 matches / `matches:[]`）⇒ **false**（判据本身对「路由没接 loop」敏感）',
      realPred === true && noKeyPred === false && emptyPred === false,
      JSON.stringify({ real: realPred, mutant_no_key: noKeyPred, mutant_empty: emptyPred }));

    // ------------------------------------------------------------ N1 · mutant 子进程
    const MUTANT_PATH = path.resolve(REPO_ROOT, 'backend-ts/src/index.p76neg.ts');
    const NEG_PORT = 5797;
    let child: ReturnType<typeof spawn> | null = null;
    const outerBase = base;
    try {
      // 夹具卫生前置（读数 20261022T083648Z2ghg 的 N1 红因 = S5 残留 taker partial 单可交叉）：
      //   先全撤夹具单，再双向验盘面（base 仍指父进程 ⇒ 走父口；同 dev 库同效）。
      for (const t of ALL_TOKENS) await cancelAll(t);
      await assertCleanBook('sell', 'N1');
      await assertCleanBook('buy', 'N1');

      const begin = INDEX_TS.indexOf('// [P76-MATCH-BEGIN]');
      const end = INDEX_TS.indexOf('// [P76-MATCH-END]');
      if (begin < 0 || end < 0 || end < begin) throw new Error('P76 markers not found in index.ts');
      const markerEnd = end + '// [P76-MATCH-END]'.length;
      const mutantSrc = INDEX_TS.slice(0, begin) + '/* p76 NEG: matchTakerOrderLoop 调用已注掉（负控） */' + INDEX_TS.slice(markerEnd);
      if (mutantSrc.includes('[P76-MATCH-BEGIN]') || mutantSrc.includes('takerOrderId: Number(result.view.order_id)')) {
        throw new Error('mutant still contains the loop call');
      }
      fs.writeFileSync(MUTANT_PATH, mutantSrc, { mode: 0o600 });
      child = spawn('npx', ['ts-node', '--transpile-only', '../ops/market/p76-neg-driver.ts'], {
        cwd: path.resolve(REPO_ROOT, 'backend-ts'),
        env: { ...process.env, P76_NEG_PORT: String(NEG_PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const childOut: string[] = [];
      child.stdout?.on('data', (d: Buffer) => childOut.push(d.toString()));
      child.stderr?.on('data', (d: Buffer) => childOut.push(d.toString()));
      let ready = false;
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline && !ready) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const h = await fetch(`http://127.0.0.1:${NEG_PORT}/api/health`);
          const hj = await h.json().catch(() => ({} as Record<string, unknown>));
          ready = (hj as Record<string, unknown>).ok === true;
        } catch { /* not yet */ }
        if (child.exitCode !== null) break;
      }
      if (!ready) throw new Error(`mutant child not ready: ${childOut.join('').slice(0, 400)}`);

      await assertCleanBook('sell', 'N1');
      // N1 臂**真打 mutant**：api/login 吃闭包 `base` ⇒ 现场切到 5797（catch/finally 必还原），
      //   否则 S1 流会打在父进程这个带撮合的实例上 ⇒ 负控失真（matches 反而出现）。
      base = `http://127.0.0.1:${NEG_PORT}`;
      const negSell = await api(await login('A'), 'POST', '/api/order', { side: 'sell', base_cid: BASE_CID, price: PRICE, amount: AMOUNT_S1, create_key: keyOf('neg:sell') });
      const negBuy = await api(await login('B'), 'POST', '/api/order', { side: 'buy', base_cid: BASE_CID, price: PRICE, amount: AMOUNT_S1, create_key: keyOf('neg:buy') });
      const dNegB = dataOf(negBuy);
      const oNegB = await orderRowByKey(keyOf('neg:buy'));
      ck.t('N1', '★负控①（**真 mutant**：路由 [P76-MATCH-BEGIN..END] 块注掉 · 子进程 5797 真 HTTP'
        + '· S1 流经 `base` 切换真打 mutant · 前置夹具全撤＋双向盘面净检）：'
        + '同 S1 流（A 卖 10@10000 → B 买 10@10000）⇒ S1 谓词**必红**（matches 空 · 单 open 未撮）'
        + '· 零 trade（根键前缀计数 0）⇒ 证明 S1 绿是真由 loop 驱动',
        negBuy.status === 200
          && s1MatchesPredicate({ status: negBuy.status, body: negBuy.body }) === false
          && String(dNegB.order_status ?? '') === 'open'
          && (await tradeKeyCount(oNegB?.oid ?? '0')) === 0,
        JSON.stringify({ status: negBuy.status, matches: dNegB.matches, order_status: dNegB.order_status, trade_keys: await tradeKeyCount(oNegB?.oid ?? '0') }));

      // mutant 残单清理（A 卖/B 买都未撮 ⇒ 全撤）
      await cancelAll(await login('A'));
      await cancelAll(await login('B'));
    } catch (e) {
      base = outerBase; // 先还原 base 再做清尾（mutant 可能已死 ⇒ 清尾走父口，同库同效）
      ck.t('N1', '★负控①（mutant 子进程真 HTTP）', false, `error=${String((e as Error).message ?? e).slice(0, 300)}`);
      try { await cancelAll(await login('A')); await cancelAll(await login('B')); } catch { /* best effort */ }
    } finally {
      base = outerBase;
      if (child) { try { child.kill('SIGTERM'); } catch { /* noop */ } }
      try { if (fs.existsSync(MUTANT_PATH)) fs.unlinkSync(MUTANT_PATH); } catch { /* noop */ }
    }

    // ------------------------------------------------------------ Z · 残留
    for (const t of ALL_TOKENS) await cancelAll(t);
    const fixOpen = Number((await qRetry<{ n: string }>(pool,
      `SELECT count(*)::text AS n FROM public.market_order
        WHERE owner_uid = ANY($1::bigint[]) AND status IN ('open','partial')`, [FIX_UIDS]))[0]?.n ?? '-1');
    ck.t('Z1', '★零残留（活面）：夹具 open/partial 订单 = **0**（逐场景 + 收尾全撤；平台全撤口自身不受影响）',
      fixOpen === 0, JSON.stringify({ fixture_open_orders: fixOpen }));

    const runTradeKeys = await raw<{ key: string }>(pool as unknown as Qx,
      `SELECT DISTINCT e.event_root_key AS key FROM public.ledger_entry e
        WHERE e.ref_type = 'market_trade' AND e.event_root_key LIKE 'biz:market:trade:%'
          AND e.time_created > now() - interval '30 minutes'`);
    const takerIds = [...new Set(runTradeKeys.map((t) => String(t.key).split(':')[3]))];
    const takerOwners = takerIds.length
      ? await raw<{ order_id: string; owner: string }>(pool as unknown as Qx,
        `SELECT order_id::text AS order_id, owner_uid::text AS owner FROM public.market_order WHERE order_id = ANY($1::bigint[])`, [takerIds])
      : [];
    ck.t('Z2', '★本轮 taker 全为夹具单（未吃任何在市挂单，MM 盘面未被本门触碰）',
      takerOwners.length === takerIds.length && takerOwners.every((t) => FIX_UIDS.includes(Number(t.owner))),
      JSON.stringify({ trades_30min: takerIds.length, owners: [...new Set(takerOwners.map((t) => t.owner))], fixture_uids: FIX_UIDS }));

    const openAfterRows = await raw<{ uid: string; n: string }>(pool as unknown as Qx,
      `SELECT o.owner_uid::text AS uid, count(*)::text AS n FROM public.market_order o
        WHERE o.status IN ('open','partial') AND o.owner_uid <> ALL($1::bigint[])
        GROUP BY o.owner_uid ORDER BY o.owner_uid`, [FIX_UIDS]);
    const openAfterTotal = Number((await raw1<{ n: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n FROM public.market_order WHERE status IN ('open','partial')`))?.n ?? '-1');
    ck.t('Z3', '★MM/外部盘面前后不变：非夹具 open 订单按 owner 计数逐字相等、open 总数相等',
      JSON.stringify(openAfterRows) === JSON.stringify(openBeforeRows) && openAfterTotal === openBeforeTotal,
      JSON.stringify({ before: openBeforeRows, after: openAfterRows, total_before: openBeforeTotal, total_after: openAfterTotal }));
  } finally {
    if (server) await new Promise<void>((resolve) => {
      try {
        server?.close(() => resolve());
        setTimeout(resolve, 3000);
      } catch { resolve(); }
    });
  }

  out.checks = ck.checks;
  out.summary = ck.summary();
  out.fixtures = {
    env_file: ENV_FILE,
    private_keys: '[REDACTED]',
    uids: Object.fromEntries(ROLES.map((r) => [r, users[r]])),
    addresses: Object.fromEntries(ROLES.map((r) => [r, addrOf(r)])),
    mint_keys: mintKeys,
    fee_rate_bp: BP,
  };
  const file = save('p76-taker-match-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary }, null, 1));
  process.exit((out.summary as { failed: number }).failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  try {
    const m = path.resolve(REPO_ROOT, 'backend-ts/src/index.p76neg.ts');
    if (fs.existsSync(m)) fs.unlinkSync(m);
  } catch { /* noop */ }
  process.exit(2);
});
