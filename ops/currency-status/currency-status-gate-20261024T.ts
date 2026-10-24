/**
 * 币种上架 / 下架（`POST /api/admin/currency/:cid/status`）· 实现级判负门（_gate）
 * ---------------------------------------------------------------------------
 * 依据：`docs/route-layer.spec.md` v2.52 **§49.25**（§49.25.5 两阶段 / §49.25.6 零账务 /
 *       §49.25.7 幂等 + 审计 / §49.25.8 错误码 / §49.25.9 响应形状与判负清单 12 条）
 *       + `docs/ledger.spec.md` v0.18 §19.20。
 *
 * 用法（必须带 TS_NODE_PROJECT，本文件在 backend-ts/ 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/currency-status/currency-status-gate-<TS>.ts
 *
 * 纪律：
 *   · **零残留**：一切写探针都在 `inRollbackTx` 内（脚本末尾 ROLLBACK）⇒ 库上零变化；
 *   · 临时币种 = 自建 `draft` 行（symbol 带 RUN 随机后缀），临时挂单 = 自插 `market_order` 行；
 *   · **不做真实撤单**（Phase A 用 DI 打桩：真撤单需要已冻结资金，属另一条资金链探针）
 *     ⇒ 「Phase A 真实 hold_release」= NOT_MEASURED（见报告）；
 *   · 不打端口、不起服务、不 apply 迁移、不改 `schema_migration`。
 */
import { checker, inRollbackTx, mkPool, raw1, save, type Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import {
  CURRENCY_STATUS_OPS_ACTION,
  currencyStatusVerb,
  parseCidShape,
  parseMemo,
  parseTargetStatus,
  statusMemoOf,
} from '../../backend-ts/src/currency-status-service';

const C = checker();
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const SYM = ('ZZGATE' + RUN.replace(/\D/g, '').slice(-6)).slice(0, 16);
const VM = { ok: (r: any) => r?.ok === true, err: (r: any) => `${r?.status}/${r?.code}/${String(r?.details?.reason ?? '')}` };
const keys = (o: any) => Object.keys(o ?? {}).sort();

(async () => {
  const pool = mkPool(1);

  // ---------- 离线形状闸（零 DB）----------------------------------------------
  C.t('S1', 'status 缺失 ⇒ 400 LEDGER_AMOUNT_INVALID/MISSING',
    (parseTargetStatus(undefined) as any).err?.status === 400 && (parseTargetStatus(undefined) as any).err?.details?.reason === 'MISSING',
    JSON.stringify(parseTargetStatus(undefined)));
  C.t('S2', 'status=draft ⇒ 400 STATUS_NOT_IN_CLOSED_SET（不得 409 / 不得放行）',
    (parseTargetStatus('draft') as any).err?.status === 400 && (parseTargetStatus('draft') as any).err?.details?.reason === 'STATUS_NOT_IN_CLOSED_SET',
    JSON.stringify(parseTargetStatus('draft')));
  C.t('S3', 'status 非字符串 ⇒ 400 NOT_STRING', (parseTargetStatus(7) as any).err?.details?.reason === 'NOT_STRING', JSON.stringify(parseTargetStatus(7)));
  C.t('S4', 'memo 201 字符 ⇒ 400 TOO_LONG', (parseMemo('x'.repeat(201)) as any).err?.details?.reason === 'TOO_LONG', 'len=201');
  C.t('S5', ':cid 非数字 / 前导 0 / 0 ⇒ 404（不得静默按 0）',
    (parseCidShape('abc') as any).err?.status === 404 && (parseCidShape('007') as any).err?.status === 404
      && (parseCidShape('0') as any).err?.status === 404,
    ['abc', '007', '0'].map((x) => (parseCidShape(x) as any).err?.status).join(','));
  C.t('S6', 'ops 键 action 词 = currency_status（DL157②）', CURRENCY_STATUS_OPS_ACTION === 'currency_status', CURRENCY_STATUS_OPS_ACTION);

  // ---------- 真库（全部写在 inRollbackTx 内 ⇒ ROLLBACK 零残留）----------------
  const tx = await inRollbackTx(pool, async (c: Qx) => {
    const sql = c as unknown as { query: (t: string, p?: unknown[]) => Promise<{ rows: any[] }> };
    const ex = sql as any; // SqlRunner 结构兼容（runSql 只需 query(text, params)）

    // 夹具：临时 draft 币种 + 一个合法 admin uid（避免 FK）
    const ins = await raw1<{ cid: string }>(c,
      `INSERT INTO public.currency (symbol, name, owner_uid, decimals, status)
       VALUES ($1::text, 'Gate tmp currency', 900001::bigint, 18, 'draft') RETURNING cid::text AS cid`, [SYM]);
    const cid = Number(ins?.cid);
    const fk = await raw1<{ n: string }>(c,
      `SELECT count(*)::text AS n FROM pg_constraint
        WHERE conrelid = 'public.currency_status_log'::regclass AND contype = 'f'`);
    const prevActor = await raw1<{ a: string }>(c,
      `SELECT actor_uid::text AS a FROM public.currency_status_log ORDER BY log_id DESC LIMIT 1`);
    const adminUid = Number(prevActor?.a ?? 900001);

    const readStatus = async (c2: number) => {
      const r = await raw1<{ cid: string; status: string }>(c,
        `SELECT cid::text AS cid, status FROM public.currency WHERE cid = $1::bigint`, [c2]);
      return r ? { cid: Number(r.cid), status: String(r.status) } : null;
    };
    const logCount = async (c2: number) => Number((await raw1<{ n: string }>(c,
      `SELECT count(*)::text AS n FROM public.currency_status_log WHERE cid = $1::bigint`, [c2]))?.n ?? 0);
    const statusOf = async (c2: number) => (await readStatus(c2))?.status ?? 'MISSING';
    const ledgerCount = async () => Number((await raw1<{ n: string }>(c,
      `SELECT count(*)::text AS n FROM public.ledger_entry`))?.n ?? 0);
    const supplyOf = async (c2: number) => String((await raw1<{ s: string }>(c,
      `SELECT total_supply::text AS s FROM public.currency WHERE cid = $1::bigint`, [c2]))?.s ?? '');

    const ledger0 = await ledgerCount();
    const supply0 = await supplyOf(cid);
    const cid1Status0 = await statusOf(1);
    const cid1Log0 = await logCount(1);

    const seq: string[] = [];
    const poster = async (i: Parameters<typeof DatabaseService.currencyStatusPostEvent>[0]) => {
      seq.push('B');
      return DatabaseService.currencyStatusPostEvent(i, ex);
    };
    const run = (status: string, cancelOrders: any, memo?: string) => currencyStatusVerb({
      cidRaw: String(cid), actorUid: adminUid, body: { status, ...(memo ? { memo } : {}) },
      deps: { readStatus, postEvent: poster as any, cancelOrders },
    });

    // === D1：`draft → listed` 不在本口 ⇒ 409 LISTING_REQUIRES_FEE_PATH（零日志 / 零撤单）===
    let called = 0;
    const r1 = await run('listed', async () => { called += 1; return { ok: true, cancelled: 0, attempted: 0, failed: 0, orders: [] }; });
    C.t('D1', 'draft→listed ⇒ 409 LISTING_REQUIRES_FEE_PATH（零日志零撤单）',
      !VM.ok(r1) && VM.err(r1) === '409/LEDGER_CURRENCY_INVALID_TRANSITION/LISTING_REQUIRES_FEE_PATH'
        && (await logCount(cid)) === 0 && called === 0 && (await statusOf(cid)) === 'draft',
      `${VM.err(r1)} logs=${await logCount(cid)} cancels=${called} status=${await statusOf(cid)}`);

    // === D2：带活跃挂单**不先撤单**直改状态 ⇒ 必须 409 ACTIVE_ORDERS_REMAIN（判负 #5）===
    await c.query(`UPDATE public.currency SET status='listed', listed_at=now(), time_updated=now() WHERE cid=$1::bigint`, [cid]);
    const ord = await raw1<{ id: string }>(c,
      `INSERT INTO public.market_order (owner_uid, side, base_cid, quote_cid, price, amount, amount_filled, status, create_key)
       VALUES (900001::bigint, 'sell', $1::bigint, 1::bigint, 100::bigint, 10::bigint, 2::bigint, 'open', $2::text)
       RETURNING order_id::text AS id`, [cid, `gate:${SYM}:${RUN}`]);
    seq.length = 0;
    const r2 = await run('frozen', async () => { seq.push('A'); return { ok: true, cancelled: 0, attempted: 1, failed: 0, orders: [] }; });
    const ordStatus2 = String((await raw1<{ s: string }>(c,
      `SELECT status AS s FROM public.market_order WHERE order_id=$1::bigint`, [Number(ord?.id)]))?.s);
    C.t('D2', '带活跃挂单直改状态 ⇒ 409 ACTIVE_ORDERS_REMAIN（status 未变 / 零日志 / 挂单未动）',
      !VM.ok(r2) && VM.err(r2) === '409/LEDGER_CURRENCY_INVALID_TRANSITION/ACTIVE_ORDERS_REMAIN'
        && (await statusOf(cid)) === 'listed' && (await logCount(cid)) === 0 && ordStatus2 === 'open',
      `${VM.err(r2)} status=${await statusOf(cid)} logs=${await logCount(cid)} order=${ordStatus2} open_orders=${(r2 as any)?.details?.open_orders}`);

    // === D3：Phase A 撤单成功 ⇒ 200 + 5 键 + 日志恰 1 行 + actor = admin + 顺序 A→B ====
    seq.length = 0;
    const cancelOk = async () => {
      seq.push('A');
      await c.query(`UPDATE public.market_order SET status='cancelled', time_updated=now() WHERE order_id=$1::bigint`, [Number(ord?.id)]);
      return { ok: true, cancelled: 1, attempted: 1, failed: 0, orders: [{ order_id: String(ord?.id), ok: true }] };
    };
    const r3 = await run('frozen', cancelOk);
    const v3 = (r3 as any).view ?? {};
    const log3 = await raw1<any>(c,
      `SELECT from_status, to_status, actor_uid::text AS actor_uid, memo
         FROM public.currency_status_log WHERE cid=$1::bigint ORDER BY log_id DESC LIMIT 1`, [cid]);
    C.t('D3', 'listed→frozen ⇒ 200 / data 恰 5 键 / cancelled_orders=1 / status 读库真值 / 顺序 A→B',
      VM.ok(r3) && !(r3 as any).replay
        && JSON.stringify(keys(v3)) === JSON.stringify(['cancelled_orders', 'cid', 'deposit_action', 'from_status', 'status'])
        && v3.cid === String(cid) && v3.from_status === 'listed' && v3.status === 'frozen'
        && v3.cancelled_orders === 1 && v3.deposit_action === 'none'
        && (await statusOf(cid)) === 'frozen' && seq.join('') === 'AB',
      `${JSON.stringify(v3)} keys=${keys(v3).join(',')} seq=${seq.join('')} db=${await statusOf(cid)}`);
    C.t('D4', '审计行恰 1 行 / from→to 正确 / actor_uid = 管理员（≠ owner 900001 的"被操作方"语义）',
      (await logCount(cid)) === 1 && log3?.from_status === 'listed' && log3?.to_status === 'frozen'
        && log3?.actor_uid === String(adminUid),
      `logs=${await logCount(cid)} ${JSON.stringify(log3)}`);

    // === D5：幂等重放（同目标再投）⇒ 200 + replay + 零日志零撤单（判负 #6）======
    seq.length = 0;
    const r5 = await run('frozen', async () => { seq.push('A'); throw new Error('Phase A 不得在重放路径执行'); });
    C.t('D5', '重放 ⇒ 200 + idempotent_replay + from_status=status + cancelled_orders=0 + 日志仍 1 行 + 零撤单',
      VM.ok(r5) && (r5 as any).replay === true
        && (r5 as any).view?.from_status === 'frozen' && (r5 as any).view?.cancelled_orders === 0
        && (await logCount(cid)) === 1 && seq.length === 0,
      `${JSON.stringify((r5 as any).view)} replay=${(r5 as any).replay} logs=${await logCount(cid)} cancels=${seq.length}`);

    // === D6：零账务（无 ledger_entry / total_supply 不变）=======================
    C.t('D6', '零账务动作：ledger_entry 零新增 + total_supply 零变动',
      (await ledgerCount()) === ledger0 && (await supplyOf(cid)) === supply0,
      `ledger ${ledger0}→${await ledgerCount()} supply ${supply0}→${await supplyOf(cid)}`);

    // === D7：终态复活（delisted → listed）⇒ 409 / 零日志（判负 #3）=============
    await c.query(`UPDATE public.currency SET status='delisted' WHERE cid=$1::bigint`, [cid]);
    const logsBefore7 = await logCount(cid);
    const r7 = await run('listed', async () => ({ ok: true, cancelled: 0, attempted: 0, failed: 0, orders: [] }));
    C.t('D7', 'delisted→listed ⇒ 409 LD011（终态不可复活 / 零日志）',
      !VM.ok(r7) && VM.err(r7).startsWith('409/LEDGER_CURRENCY_INVALID_TRANSITION')
        && (await statusOf(cid)) === 'delisted' && (await logCount(cid)) === logsBefore7,
      `${VM.err(r7)} status=${await statusOf(cid)} logs=${await logCount(cid)}`);

    // === D8：`$`（cid=1）被动 ⇒ 409 / 库内 status 未变 / 零日志（判负 #2）=====
    const r8 = await currencyStatusVerb({
      cidRaw: '1', actorUid: adminUid, body: { status: 'frozen' },
      deps: { readStatus, postEvent: poster as any, cancelOrders: async () => ({ ok: true, cancelled: 0, attempted: 0, failed: 0, orders: [] }) },
    });
    C.t('D8', '$ 被动 ⇒ 409 SYSTEM_CURRENCY_IMMUTABLE（status 未变 / 零日志）',
      !VM.ok(r8) && VM.err(r8) === '409/LEDGER_CURRENCY_INVALID_TRANSITION/SYSTEM_CURRENCY_IMMUTABLE'
        && (await statusOf(1)) === cid1Status0 && (await logCount(1)) === cid1Log0,
      `${VM.err(r8)} status=${await statusOf(1)} logs=${await logCount(1)}`);

    // === D9：Phase A 单失败 ⇒ 原样上抛既有码、**不进 Phase B**（判负 #8）=======
    await c.query(`UPDATE public.currency SET status='listed' WHERE cid=$1::bigint`, [cid]);
    seq.length = 0;
    const r9 = await run('delisted', async () => {
      seq.push('A');
      return { ok: false, cancelled: 0, attempted: 1, failed: 1, orders: [], error: { ok: false, status: 403, code: 'AUTH_FORBIDDEN', message: 'Forbidden', details: { reason: 'ACTOR_NOT_ALLOWED' } } };
    });
    C.t('D9', 'Phase A 失败 ⇒ 透传该单既有码（403 AUTH_FORBIDDEN）+ 不进 Phase B + status 未变',
      !VM.ok(r9) && VM.err(r9) === '403/AUTH_FORBIDDEN/ACTOR_NOT_ALLOWED'
        && seq.join('') === 'A' && (await statusOf(cid)) === 'listed',
      `${VM.err(r9)} seq=${seq.join('')} status=${await statusOf(cid)}`);

    // === D10：memo 服务端派生（缺 memo ⇒ 非空派生串）==========================
    C.t('D10', 'memo 缺省派生 = admin currency status:<cid>:<from>-><to>',
      statusMemoOf(cid, 'listed', 'delisted') === `admin currency status:${cid}:listed->delisted`,
      statusMemoOf(cid, 'listed', 'delisted'));

    return {
      cid, adminUid, sym: SYM, fk_on_log: fk?.n ?? null,
      log_row: log3 ?? null, view_d3: v3,
      cid1_status: cid1Status0,
    };
  });

  await pool.end();
  const sum = C.summary();
  const out = save('currency-status-gate', { checks: C.checks, summary: sum, fixture: tx.result, tx: { rolled_back: tx.rolled_back, ms: tx.ms, error: tx.error ? String(tx.error).slice(0, 300) : null } });
  console.log(JSON.stringify({ summary: sum, fixture: tx.result, tx_error: tx.error ? String(tx.error).slice(0, 300) : null, rolled_back: tx.rolled_back, readings: out, red: C.checks.filter((x) => !x.pass) }, null, 2));
  process.exit(sum.failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('GATE_FATAL', e);
  process.exit(2);
});
