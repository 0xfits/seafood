// P9④ 库面收口 · 四段真链路探针（Kong；事务内 + 子步 SAVEPOINT + 末尾 ROLLBACK；不进 scripts/）
import { DatabaseService } from '../src/database';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const SENT = 'P9S4B_LIVE_ROLLBACK';
const NOTE = 'P9S4B';
type Row = Record<string, unknown>;

async function main(): Promise<void> {
  const out: Row = { chains: {} };
  const before = await counts2();
  out.before = before;

  await withTransaction(async (tx: TxClient) => {
    const rowsOf = async (text: string, params: unknown[] = []): Promise<Row[]> => (await tx.query<Row>(text, params)).rows;
    const oneOf = async (text: string, params: unknown[] = []): Promise<Row> => (await rowsOf(text, params))[0] ?? {};
    const sp = async <T>(name: string, fn: () => Promise<T>): Promise<{ ok: boolean; v?: T; err?: string }> => {
      await tx.query(`SAVEPOINT ${name}`);
      try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return { ok: true, v }; }
      catch (e) { await tx.query(`ROLLBACK TO SAVEPOINT ${name}`); return { ok: false, err: String((e as { code?: string }).code ?? (e as Error).message).slice(0, 120) }; }
    };
    const counts = async (): Promise<Row> => oneOf(`
      SELECT (SELECT count(*)::int FROM public.currency) AS currency,
             (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
             (SELECT count(*)::int FROM public.batt_account) AS batt_account,
             (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
             (SELECT count(*)::int FROM public.account) AS account`);
    const supplyOf = async (cid: number): Promise<string> => String((await oneOf(`SELECT total_supply::text AS s FROM public.currency WHERE cid=$1`, [cid])).s ?? 'NA');
    const sumOf = async (cid: number, kind: string): Promise<string> => String((await oneOf(`SELECT COALESCE(sum(delta),0)::text AS s FROM public.ledger_entry WHERE cid=$1 AND kind=$2`, [cid, kind])).s ?? '0');
    const balOf = async (uid: number, cid: number): Promise<string> => String((await oneOf(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2),0)::text AS b`, [uid, cid])).b ?? '0');
    const battOf = async (uid: number): Promise<number> => Number((await oneOf(`SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid=$1),0)::int AS b`, [uid])).b ?? 0);
    const legs = async (cid: number, kind: string): Promise<Row[]> => rowsOf(`SELECT uid::text, delta::text, kind FROM public.ledger_entry WHERE cid=$1 AND kind=$2 ORDER BY txid`, [cid, kind]);

    const U = 4;
    const U0 = 971100;
    const KC = 'cli:aaaaaaaa-1111-4111-8111-111111111111';
    const KB = 'cli:bbbbbbbb-2222-4222-8222-222222222222';
    const chains = out.chains as Row;

    // ---------- CHAIN 1 · BTTC 创建（ensureBttcCurrency ×2） ----------
    const c1 = await DatabaseService.ensureBttcCurrency(tx);
    const c2 = await DatabaseService.ensureBttcCurrency(tx);
    const rowNow = await oneOf(`SELECT cid::text, symbol, name, decimals::int, status, total_supply::text, is_platform_coin FROM public.currency WHERE symbol='BTTC'`);
    const brief = (c: typeof c1): Row | null => (c ? { cid: c.cid, symbol: c.symbol, decimals: c.decimals, status: c.status, is_platform_coin: c.is_platform_coin, inserted: c.inserted } : null);
    chains.create = {
      call1: brief(c1), call2: brief(c2),
      row_direct: { cid: String(rowNow.cid), symbol: String(rowNow.symbol), decimals: Number(rowNow.decimals), status: String(rowNow.status), is_platform_coin: rowNow.is_platform_coin === true },
    };
    const cur = c2 ?? c1;
    if (!cur) throw new Error('ensureBttcCurrency null on both calls');
    const bcid = Number(cur.cid);

    // ---------- CHAIN 1b · 豁免闸两读数对照 ----------
    const mk = async (sym: string, plat: boolean, dep: number): Promise<string> => String((await oneOf(
      `INSERT INTO public.currency (symbol,name,owner_uid,decimals,status,deposit_amount,deposit_cid,is_platform_coin)
       VALUES ($1,'t',$2,0,'draft',$3,1,$4) RETURNING cid::text`, [sym, U, dep, plat])).cid);
    const pPlat = await mk('P9S4BPLAT', true, 0);
    const pNorm = await mk('P9S4BNORM', false, 0);
    const pPlatD = await mk('P9S4BPLATD', true, 7);
    const callList = async (cid: string, dep: number, tag: string): Promise<Row> => {
      const r = await sp(`spl_${tag}`, () => DatabaseService.listCurrencyWithDeposit({
        cid: Number(cid), actorUid: U, fee: 5, depositAmount: dep,
        idempotencyKey: `biz:p8s9:list:${tag}`, requestFingerprint: `${NOTE}:${tag}`, memo: tag,
      }, tx));
      if (!r.ok) return { ok: false, err: r.err };
      const row = r.v as Row;
      return { ok: true, applied: Number(row.applied ?? 0), cur_status: String(row.cur_status ?? '') };
    };
    chains.exemption = {
      platform_dep0: await callList(pPlat, 0, 'plat0'),
      nonplatform_dep0: await callList(pNorm, 0, 'norm0'),
      platform_dep7: await callList(pPlatD, 7, 'plat7'),
    };

    // ---------- 预备 ----------
    await tx.query(`INSERT INTO public.account (uid,cid,balance,frozen) VALUES ($1,$2,0,0) ON CONFLICT (uid,cid) DO NOTHING`, [U, bcid]);
    const setBatt = async (uid: number, v: number): Promise<void> => { await tx.query(`INSERT INTO public.batt_account (uid,batt) VALUES ($1,$2) ON CONFLICT (uid) DO UPDATE SET batt=EXCLUDED.batt`, [uid, v]); };

    // ---------- CHAIN 2a · 铸造前置闸不满足（batt=99） ----------
    await setBatt(U, 99);
    const mr1 = await DatabaseService.bttcMint({ uid: U, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    chains.mintRejectBatt = {
      outcome: mr1?.outcome, batt: mr1?.batt, battAfter: await battOf(U), usd: await balOf(U, 1), bttc: await balOf(U, bcid), supply: await supplyOf(bcid),
      mintLegs: (await legs(bcid, 'mint')).length, feeLegs: (await legs(1, 'bttc_mint_fee')).length,
      battEntry: Number((await oneOf(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [U])).n),
    };

    // ---------- CHAIN 2b · 铸造前置闸不满足（$=0） ----------
    await setBatt(U0, 100);
    const mr2 = await DatabaseService.bttcMint({ uid: U0, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    chains.mintRejectUsd = {
      outcome: mr2?.outcome, battAfter: await battOf(U0), usd: await balOf(U0, 1),
      mintLegs: (await legs(bcid, 'mint')).length, battEntry: Number((await oneOf(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [U0])).n),
    };

    // ---------- CHAIN 2c · 铸造成功（batt=100 · $>=1） ----------
    await setBatt(U, 100);
    const usdPre = await balOf(U, 1);
    const mint = await DatabaseService.bttcMint({ uid: U, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    chains.mint = {
      outcome: mint?.outcome, txid: mint?.txid, supplyBefore: mint?.supplyBefore, supplyAfter: mint?.supplyAfter,
      battBefore: 100, battAfter: await battOf(U), usdBefore: usdPre, usdAfter: await balOf(U, 1), bttcAfter: await balOf(U, bcid),
      supplyNow: await supplyOf(bcid), bodyLegs: await legs(bcid, 'mint'), feeLegs: await legs(1, 'bttc_mint_fee'),
    };

    // ---------- CHAIN 2d · 幂等重放 ----------
    await setBatt(U, 100);
    const bR = await counts();
    const replay = await DatabaseService.bttcMint({ uid: U, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    const aR = await counts();
    chains.mintReplay = {
      outcome: replay?.outcome,
      ledger_entry_delta: Number(aR.ledger_entry) - Number(bR.ledger_entry),
      batt_entry_delta: Number(aR.batt_entry) - Number(bR.batt_entry),
      supplyNow: await supplyOf(bcid),
    };
    chains.invAfterMint = { supply: await supplyOf(bcid), sumMint: await sumOf(bcid, 'mint'), sumBurn: await sumOf(bcid, 'burn') };

    // ---------- CHAIN 3 · 分解（batt=50 封顶丢弃） ----------
    await setBatt(U, 50);
    const usdPreB = await balOf(U, 1);
    const burn = await DatabaseService.bttcBurn({ uid: U, idempotencyKey: KB, requestFingerprint: `${NOTE}:burn`, memo: '' }, tx);
    chains.burn = {
      outcome: burn?.outcome, txid: burn?.txid, supplyBefore: burn?.supplyBefore, supplyAfter: burn?.supplyAfter,
      battBefore: 50, battAfter: await battOf(U), usdBefore: usdPreB, usdAfter: await balOf(U, 1), bttcAfter: await balOf(U, bcid),
      supplyNow: await supplyOf(bcid), bodyLegs: await legs(bcid, 'burn'), feeLegs: await legs(1, 'bttc_burn_fee'),
      battEntry: await oneOf(`SELECT delta::int AS d, batt_after::int AS a FROM public.batt_entry WHERE idempotency_key=$1`, [KB]),
    };
    chains.invAfterBurn = { supply: await supplyOf(bcid), sumMint: await sumOf(bcid, 'mint'), sumBurn: await sumOf(bcid, 'burn') };

    // ---------- 库级负读数：平台 uid 不得经 burn 销毁 ----------
    const neg = await sp('spbneg', () => rowsOf(`SELECT public.ledger_post_event(jsonb_build_object(
        'op','burn','idempotency_key',$1::text,'ref_type','currency','ref_id',$2::text,'uid','-1','cid',$2::text,'amount','1'))`, ['cli:cccccccc-3333-4333-8333-333333333333', String(bcid)]));
    chains.burnPlatform = neg.ok ? { raised: false } : { raised: true, code: neg.err };

    out.txAfterCounts = await counts();
    throw new Error(SENT);
  }).catch((e) => { if (String((e as Error)?.message) !== SENT) throw e; });

  out.after = await counts2();
  out.residue_zero = JSON.stringify(out.before) === JSON.stringify(out.after);
  console.log(JSON.stringify(out, null, 1));
}

const counts2 = async (): Promise<Row> => {
  const r = await readQuery<Row>(`
    SELECT (SELECT count(*)::int FROM public.currency) AS currency,
           (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
           (SELECT count(*)::int FROM public.batt_account) AS batt_account,
           (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
           (SELECT count(*)::int FROM public.account) AS account`);
  return r[0];
};

main().then(async () => { await closePools().catch(() => {}); })
  .catch(async (e) => { console.log('FATAL', String((e as Error).stack || e).slice(0, 900)); await closePools().catch(() => {}); });
