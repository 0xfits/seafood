/**
 * 币种上架 / 下架（§49.25）· **Phase A 资金腿**（`hold_release` ×2）实现级判负门
 * ============================================================================
 * 依据：`docs/route-layer.spec.md` §49.25.5（Phase A = 按币种撤单解冻）+ `docs/ledger.spec.md` §19.20；
 *       实现真源：`src/market-service.ts` `cancelOrdersOfCurrency` → `cancelOne`
 *                 → `public.market_post_event(op='cancel')`（`0016_market.sql:616-681`）。
 *
 * 用法（必须带 TS_NODE_PROJECT，本文件在 backend-ts/ 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/currency-status/currency-status-hold-release-probe-20261024T.ts
 *
 * 纪律 / 手法（与 `currency-status-gate-*.ts` 同规）：
 *   · **零残留**：全部夹具 + 真撤单都在 `inRollbackTx` 内，末尾 `ROLLBACK`；探针随后用独立连接
 *     按 RUN 标记 `SELECT count(*)` 自证零残留（6 处计数全 0）。
 *   · **真调 `cancelOrdersOfCurrency({ cid })`**（**不给** DI 打桩）：真实枚举 → 真实 owner 解析 →
 *     真实 `cancelOne` → 真实 `market_post_event(op='cancel')` ⇒ 真 `hold_release` ×2。
 *   · 夹具全是**真账务链**（不直插 account）：`ledger_post_event(op='mint')` 铸 105 →
 *     `market_post_event(op='order')` 卖单冻结 base 10（真 `hold` ×2）——因为 `0001:132` 的
 *     `account_guard` 禁止「新账户非 0/0 开工」、且 `account` 必须恒等于最近一条 `ledger_entry` 快照
 *     （探针首跑读数即此断言：`new account must start at 0/0`）。
 *   · **为何要把三个静态执行口绑到本事务 client**：`DatabaseService.marketPostEvent` /
 *     `resolveMarketOrder` / `listOpenCidsMarketOrderIds` 走 `getSql()`（neon 独立连接），
 *     **看不见本事务未提交的夹具**（探针内 F0 实测读数为空 ⇒ 不绑定则「零挂单可撤」假绿）。
 *     这三条是**同一 SQL 文本**的只读/单语句转发（真正干活的是 `SELECT public.market_post_event($1::jsonb)`
 *     这句 DB 函数）⇒ 绑定的只是**连接**，不是判据；跑完原样还原（`finally`）。
 *   · 不打端口、不起服务、不 apply 迁移、不改 `schema_migration`、不动前端与下单路径。
 */
import { checker, inRollbackTx, mkPool, qRetry, raw, raw1, save, type Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import { cancelOrdersOfCurrency } from '../../backend-ts/src/market-service';

const C = checker();
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const DIGITS = RUN.replace(/\D/g, '').slice(-6);
const SYM = ('ZZHLD' + DIGITS).slice(0, 16);
const CREATE_KEY = `biz:probe:holdrel:${SYM}:${RUN}`; // create_key 即挂单事件根键 ⇒ 同受 biz|cm|cli|ops 前缀闸
const MINT_KEY = `biz:probe:holdrel-mint:${SYM}:${RUN}`; // R49/R52③：根键前缀闭集 biz|cm|cli|ops
const EVM = '0x' + (RUN + SYM).replace(/[^0-9a-f]/gi, '').toLowerCase().padEnd(40, '0').slice(0, 40);
/** 测试 uid ≥ 900000（p7b 纪律；本事务内新建，ROLLBACK 后不留） */
const TUID = 990000 + (Number(DIGITS) % 9000);
const MINT_AMT = 105;
const ORDER_AMOUNT = 10;
const ORDER_PRICE = 100;

const num = (v: unknown) => Number(v ?? 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

(async () => {
  const pool = mkPool(1);

  const tx = await inRollbackTx(pool, async (c: Qx) => {
    // ---------------- 夹具（真账务链，全部本事务内）-----------------------------
    await c.query(`INSERT INTO public.users (uid, evm) VALUES ($1::bigint, $2::text)`, [TUID, EVM]);
    const cur = await raw1<{ cid: string }>(c,
      `INSERT INTO public.currency (symbol, name, owner_uid, decimals, status, total_supply, listed_at)
       VALUES ($1::text, 'HoldRelease probe currency', $2::bigint, 0, 'listed', 0, now())
       RETURNING cid::text AS cid`, [SYM, TUID]);
    const cid = num(cur?.cid);

    // ① 真铸币 105（owner 自铸 ⇒ R23/R28 mint 仅 draft|listed 通过）
    await raw1(c, `SELECT public.ledger_post_event($1::jsonb) AS r`,
      [JSON.stringify({ op: 'mint', uid: String(TUID), cid: String(cid), amount: String(MINT_AMT),
        idempotency_key: MINT_KEY, memo: `probe mint ${SYM}` })]);

    // ② 真挂单（卖单冻结 base = amount = 10 ⇒ 真 `hold` ×2，产生真实 frozen）
    const placed = await raw1<{ r: any }>(c,
      `WITH l AS (SELECT pg_advisory_xact_lock($1::int4, 1::int4) AS k OFFSET 0)
       SELECT public.market_post_event($2::jsonb) AS r FROM l`,
      [cid, JSON.stringify({ op: 'order', create_key: CREATE_KEY, owner_uid: String(TUID), side: 'sell',
        base_cid: String(cid), quote_cid: '1', price: String(ORDER_PRICE), amount: String(ORDER_AMOUNT),
        request_fingerprint: `probe:${CREATE_KEY}`, memo: `market order:${CREATE_KEY}` })]);
    const oid = num(placed?.r?.order_id);
    const ROOT = `biz:market:cancel:${oid}`;

    const ledgerTotal = async () => num((await raw1<{ n: string }>(c,
      `SELECT count(*)::text AS n FROM public.ledger_entry`))?.n);
    const acctOf = async () => {
      const r = await raw1<{ b: string; f: string; v: string }>(c,
        `SELECT balance::text AS b, frozen::text AS f, version::text AS v
           FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint`, [TUID, cid]);
      return { bal: num(r?.b), frz: num(r?.f), ver: num(r?.v) };
    };
    const ordRow = async () => raw1<{ status: string; amount: string; filled: string; keys: string | null }>(c,
      `SELECT o.status, o.amount::text AS amount, o.amount_filled::text AS filled,
              array_to_string(o.ledger_event_keys, ',') AS keys
         FROM public.market_order o WHERE o.order_id = $1::bigint`, [oid]);

    const l0 = await ledgerTotal();
    const a0 = await acctOf();
    const o0 = await ordRow();
    const REMAIN = num(o0?.amount) - num(o0?.filled); // 撤单释放量（DL64：卖单 = amount − amount_filled）

    // ---------------- F1：夹具自证（挂单真 open、真冻结 10）---------------------
    C.t('F1', '夹具自证：真挂单 open / amount>amount_filled / account frozen = 剩余量（真 hold 落地）',
      o0?.status === 'open' && num(o0?.amount) > num(o0?.filled) && a0.frz === REMAIN
        && a0.bal === MINT_AMT - REMAIN && oid > 0,
      `order=${oid} status=${o0?.status} amount=${o0?.amount} filled=${o0?.filled} remain=${REMAIN} account=${JSON.stringify(a0)}`);

    // ---------------- F0：tx 隔离自证（不绑定 ⇒ 看不到夹具 ⇒ 必须绑定）---------
    const nakedIds = await DatabaseService.listOpenCidsMarketOrderIds(cid);
    C.t('F0', 'tx 隔离自证：未绑定事务时 neon 独立连接看不到本事务夹具（读数 = 0 单）',
      nakedIds.length === 0,
      `naked_list=${JSON.stringify(nakedIds)} cid=${cid} order=${oid}`);

    // ---------------- 把三个静态执行口绑到本事务 client（同 SQL 文本转发）------
    const orig = {
      mpe: DatabaseService.marketPostEvent,
      rmo: DatabaseService.resolveMarketOrder,
      loc: DatabaseService.listOpenCidsMarketOrderIds,
    };
    const DS = DatabaseService as unknown as Record<string, unknown>;
    DS.marketPostEvent = async (payload: Record<string, unknown>, pair: { baseCid: number; quoteCid: number }) => {
      const row = await raw1<Record<string, unknown>>(c,
        `WITH l AS (SELECT pg_advisory_xact_lock($1::int4, $2::int4) AS k OFFSET 0)
         SELECT public.market_post_event($3::jsonb) AS r FROM l`,
        [pair.baseCid, pair.quoteCid, JSON.stringify(payload)]);
      if (!row) throw new Error('marketPostEvent: no row returned');
      return row;
    };
    DS.resolveMarketOrder = async (orderId: number) => {
      const r = await raw1<Record<string, unknown>>(c,
        `SELECT o.order_id::text AS order_id, o.owner_uid::text AS owner_uid, o.side,
                o.base_cid::text AS base_cid, o.quote_cid::text AS quote_cid,
                o.price::text AS price, o.amount::text AS amount,
                o.amount_filled::text AS amount_filled, o.status
           FROM public.market_order o WHERE o.order_id = $1::bigint`, [orderId]);
      if (!r) return null;
      return {
        orderId: num(r.order_id), ownerUid: num(r.owner_uid), side: String(r.side ?? ''),
        baseCid: num(r.base_cid), quoteCid: num(r.quote_cid),
        price: String(r.price ?? ''), amount: String(r.amount ?? ''),
        amountFilled: String(r.amount_filled ?? ''), status: String(r.status ?? ''),
      };
    };
    DS.listOpenCidsMarketOrderIds = async (cidIn: number) => (await raw<{ order_id: string }>(c,
      `SELECT o.order_id::text AS order_id FROM public.market_order o
        WHERE o.base_cid = $1::bigint AND o.status IN ('open','partial') AND o.amount > o.amount_filled
        ORDER BY o.order_id ASC`, [cidIn])).map((r) => num(r.order_id)).filter((n) => Number.isInteger(n) && n > 0);

    let res: Awaited<ReturnType<typeof cancelOrdersOfCurrency>> | null = null;
    let fatal: string | null = null;
    try {
      // ★ 真调（无 DI）：枚举 → 逐单 resolve → cancelOne → market_post_event(op='cancel')
      res = await cancelOrdersOfCurrency({ cid, adminUid: TUID });
    } catch (e) {
      fatal = String((e as Error)?.message ?? e).slice(0, 300);
    } finally {
      DS.marketPostEvent = orig.mpe;
      DS.resolveMarketOrder = orig.rmo;
      DS.listOpenCidsMarketOrderIds = orig.loc;
    }

    // ---------------- 读数 ------------------------------------------------------
    const rows = await raw<{ txid: string; uid: string; cid: string; delta: string; frz: string; kind: string; key: string; ek: string }>(c,
      `SELECT txid::text, uid::text, cid::text, delta::text, frozen_delta::text AS frz, kind,
              event_root_key AS key, idempotency_key AS ek
         FROM public.ledger_entry WHERE event_root_key = $1::text ORDER BY txid ASC`, [ROOT]);
    const l1 = await ledgerTotal();
    const a1 = await acctOf();
    const o1 = await ordRow();

    const d = rows.map((r) => num(r.delta));
    const f = rows.map((r) => num(r.frz));

    // ① 恰 2 条 hold_release（同账户搬运；Σdelta=+REMAIN / Σfrozen=−REMAIN / 持仓净变 0）
    C.t('H1', '① ledger_entry 恰新增 2 条 hold_release（同 uid 同 cid；Σdelta=+10 / Σfrozen=−10 / 持仓净变 0）',
      rows.length === 2 && (l1 - l0) === 2
        && rows.every((r) => r.kind === 'hold_release' && r.uid === String(TUID) && r.cid === String(cid))
        && JSON.stringify(d.slice().sort((x, y) => x - y)) === JSON.stringify([0, REMAIN])
        && JSON.stringify(f.slice().sort((x, y) => x - y)) === JSON.stringify([-REMAIN, 0])
        && sum(d) + sum(f) === 0,
      `n=${rows.length} Δledger=${l1 - l0} delta=[${d}] frozen=[${f}] Σdelta=${sum(d)} Σfrozen=${sum(f)} Σ=${sum(d) + sum(f)} rows=${JSON.stringify(rows.map((r) => [r.kind, r.uid, r.cid, r.delta, r.frz]))}`);

    // ② account 侧：frozen 减、balance 加，数值 = 挂单成交前剩余量
    C.t('H2', '② account：frozen −10 / balance +10（= 该单成交前剩余量 amount−amount_filled=10），version 递增',
      a1.frz === a0.frz - REMAIN && a1.bal === a0.bal + REMAIN && a1.ver > a0.ver && REMAIN === ORDER_AMOUNT,
      `frozen ${a0.frz}→${a1.frz} balance ${a0.bal}→${a1.bal} version ${a0.ver}→${a1.ver} remain=${REMAIN}`);

    // ③ 订单终态 = cancelled
    C.t('H3', '③ market_order.status = cancelled（撤单真落库，非仅返 200）',
      o1?.status === 'cancelled' && res?.ok === true && res?.cancelled === 1 && res?.failed === 0,
      `order ${o0?.status}→${o1?.status} res=${JSON.stringify({ ok: res?.ok, cancelled: res?.cancelled, failed: res?.failed, attempted: res?.attempted })} fatal=${fatal}`);

    // ④ 幂等根键 = biz:market:cancel:<order_id>
    C.t('H4', '④ 幂等根键（event_root_key）= biz:market:cancel:<order_id>；逐条 idempotency_key 为派生 <root>#<i>',
      rows.length === 2 && rows.every((r) => r.key === ROOT) && ROOT === `biz:market:cancel:${oid}`
        && JSON.stringify(rows.map((r) => r.ek)) === JSON.stringify([ROOT, `${ROOT}#2`])
        && String(o1?.keys ?? '').includes(ROOT),
      `root=${ROOT} entry_keys=[${rows.map((r) => r.ek)}] order.ledger_event_keys=${o1?.keys}`);

    // 附加：响应 orders[] 回执
    C.t('H5', '附加：cancelOrdersOfCurrency 回执 = attempted 1 / cancelled 1 / failed 0 / orders[0].ok',
      res?.attempted === 1 && res?.orders?.length === 1 && (res?.orders?.[0] as any)?.ok === true
        && String((res?.orders?.[0] as any)?.order_id) === String(oid),
      JSON.stringify(res?.orders ?? []));

    return {
      cid, tuid: TUID, order_id: oid, root: ROOT, sym: SYM, remain: REMAIN,
      fixture_before: { ledger_total: l0, account: a0, order_status: o0?.status ?? null, amount: o0?.amount, amount_filled: o0?.filled },
      after: {
        ledger_total: l1, account: a1, order_status: o1?.status ?? null,
        entries: rows.map((r) => ({ txid: r.txid, uid: r.uid, cid: r.cid, kind: r.kind, delta: r.delta, frozen_delta: r.frz, event_root_key: r.key, entry_key: r.ek })),
        sums: { delta: sum(d), frozen: sum(f), net: sum(d) + sum(f) },
      },
      verdict: res ? { ok: res.ok, cancelled: res.cancelled, attempted: res.attempted, failed: res.failed, orders: res.orders } : { fatal },
    };
  });

  // ---------------- 零残留自证（ROLLBACK 之后，独立连接）------------------------
  const fx = tx.result as any;
  const residual: Record<string, number> = {};
  if (fx?.order_id) {
    residual.users = num((await qRetry<any>(pool, `SELECT count(*)::text AS n FROM public.users WHERE evm = $1::text`, [EVM]))[0]?.n);
    residual.currency = num((await qRetry<any>(pool, `SELECT count(*)::text AS n FROM public.currency WHERE symbol = $1::text`, [SYM]))[0]?.n);
    residual.market_order = num((await qRetry<any>(pool, `SELECT count(*)::text AS n FROM public.market_order WHERE create_key = $1::text`, [CREATE_KEY]))[0]?.n);
    residual.ledger_entry = num((await qRetry<any>(pool, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE event_root_key IN ($1::text, $2::text) OR idempotency_key = $1::text`, [MINT_KEY, `biz:market:cancel:${fx.order_id}`]))[0]?.n);
    residual.account = num((await qRetry<any>(pool, `SELECT count(*)::text AS n FROM public.account WHERE uid = $1::bigint`, [fx.tuid]))[0]?.n);
    residual.currency_status_log = num((await qRetry<any>(pool, `SELECT count(*)::text AS n FROM public.currency_status_log WHERE cid = $1::bigint`, [fx.cid]))[0]?.n);
  }
  C.t('H6', '⑤ 收尾 ROLLBACK ⇒ 库上零残留（users/currency/market_order/ledger_entry/account/status_log 全 0）',
    tx.rolled_back === true && Object.keys(residual).length === 6 && Object.values(residual).every((n) => n === 0),
    `rolled_back=${tx.rolled_back} residual=${JSON.stringify(residual)}`);

  await pool.end();
  const summary = C.summary();
  const out = save('currency-status-hold-release-probe', {
    checks: C.checks, summary, fixture: tx.result,
    tx: { rolled_back: tx.rolled_back, ms: tx.ms, attempts: tx.attempts, error: tx.error ? (String((tx.error as any)?.message ?? tx.error) + ' | ' + String((tx.error as any)?.detail ?? '')).slice(0, 400) : null },
    residual,
  });
  console.log(JSON.stringify({ summary, fixture: tx.result, residual, rolled_back: tx.rolled_back,
    tx_error: tx.error ? (String((tx.error as any)?.message ?? tx.error) + ' | ' + String((tx.error as any)?.detail ?? '')).slice(0, 400) : null, readings: out,
    red: C.checks.filter((x) => !x.pass) }, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
})().catch((e) => { console.error('PROBE_FATAL', e); process.exit(2); });
