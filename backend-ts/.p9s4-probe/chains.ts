// P9④ 库面收口 · 四段真链路探针（Kong；事务内 + 末尾 ROLLBACK；不进 scripts/）
import { DatabaseService } from '../src/database';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const SENT = 'P9S4B_LIVE_ROLLBACK';
const NOTE = 'P9S4B';

type Row = Record<string, unknown>;
const rowsOf = async (tx: TxClient, text: string, params: unknown[] = []): Promise<Row[]> => (await tx.query<Row>(text, params)).rows;
const oneOf = async (tx: TxClient, text: string, params: unknown[] = []): Promise<Row> => (await rowsOf(tx, text, params))[0] ?? {};

const counts = async (tx: TxClient): Promise<Row> => oneOf(tx, `
  SELECT
    (SELECT count(*)::int FROM public.currency) AS currency,
    (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
    (SELECT count(*)::int FROM public.batt_account) AS batt_account,
    (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
    (SELECT count(*)::int FROM public.account) AS account
`);

const supplyOf = async (tx: TxClient, cid: number): Promise<string> => String((await oneOf(tx,
  `SELECT total_supply::text AS s FROM public.currency WHERE cid=$1`, [cid])).s ?? 'NA');
const sumOf = async (tx: TxClient, cid: number, kind: string): Promise<string> => String((await oneOf(tx,
  `SELECT COALESCE(sum(delta),0)::text AS s FROM public.ledger_entry WHERE cid=$1 AND kind=$2`, [cid, kind])).s ?? '0');
const balOf = async (tx: TxClient, uid: number, cid: number): Promise<string> => String((await oneOf(tx,
  `SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2),0)::text AS b`, [uid, cid])).b ?? '0');
const battOf = async (tx: TxClient, uid: number): Promise<number> => Number((await oneOf(tx,
  `SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid=$1),0)::int AS b`, [uid])).b ?? 0);
const ledgerRows = async (tx: TxClient, cid: number, kind: string): Promise<Row[]> => rowsOf(tx,
  `SELECT uid::text, delta::text, kind FROM public.ledger_entry WHERE cid=$1 AND kind=$2 ORDER BY txid`, [cid, kind]);

const U = 4;          // $ 余额 > 0 的真实用户
const U0 = 971100;    // $ 余额 = 0 的真实用户（前置闸负读数）
const KC = 'cli:aaaaaaaa-1111-4111-8111-111111111111';
const KB = 'cli:bbbbbbbb-2222-4222-8222-222222222222';

async function main(): Promise<void> {
  const out: Row = { chains: {} };
  const before = await counts2();
  out.before = before;

  await withTransaction(async (tx) => {
    // ---------- CHAIN 1 · BTTC 创建（ensureBttcCurrency） ----------
    const c1 = await DatabaseService.ensureBttcCurrency(tx);
    const c2 = await DatabaseService.ensureBttcCurrency(tx);
    const rowNow = await oneOf(tx, `SELECT cid::text, symbol, name, decimals::int, status, total_supply::text, is_platform_coin FROM public.currency WHERE symbol='BTTC'`);
    out.chains.create = {
      call1: c1 === null ? null : { cid: c1.cid, symbol: c1.symbol, decimals: c1.decimals, status: c1.status, is_platform_coin: c1.is_platform_coin, inserted: c1.inserted },
      call2: c2 === null ? null : { cid: c2.cid, symbol: c2.symbol, decimals: c2.decimals, status: c2.status, is_platform_coin: c2.is_platform_coin, inserted: c2.inserted },
      row_direct: { cid: String(rowNow.cid), symbol: String(rowNow.symbol), decimals: Number(rowNow.decimals), status: String(rowNow.status), is_platform_coin: rowNow.is_platform_coin === true },
    };
    const cur = c2 ?? c1;
    if (!cur) throw new Error('ensureBttcCurrency returned null on both calls');
    const bcid = Number(cur.cid);

    // ---------- CHAIN 1b · 豁免闸两读数对照 ----------
    const exRes: Row = {};
    // 平台 draft 行（无审核台账）· 保证金 0
    const pPlat = (await oneOf(tx, `INSERT INTO public.currency
      (symbol,name,owner_uid,decimals,status,deposit_amount,deposit_cid,is_platform_coin)
      VALUES ('P9S4BPLAT','plat',$1,0,'draft',0,1,true) RETURNING cid::text`, [U]));
    // 非平台 draft 行（无审核台账）
    const pNorm = (await oneOf(tx, `INSERT INTO public.currency
      (symbol,name,owner_uid,decimals,status,deposit_amount,deposit_cid,is_platform_coin)
      VALUES ('P9S4BNORM','norm',$1,0,'draft',0,1,false) RETURNING cid::text`, [U]));
    // 平台 draft 行 · 保证金 >0
    const pPlatD = (await oneOf(tx, `INSERT INTO public.currency
      (symbol,name,owner_uid,decimals,status,deposit_amount,deposit_cid,is_platform_coin)
      VALUES ('P9S4BPLATD','platd',$1,0,'draft',7,1,true) RETURNING cid::text`, [U]));
    const callList = async (cid: string, dep: number, tag: string): Promise<Row> => {
      try {
        const r = await DatabaseService.listCurrencyWithDeposit({
          cid: Number(cid), actorUid: U, fee: 5, depositAmount: dep,
          idempotencyKey: `${NOTE}:list:${tag}`, requestFingerprint: `${NOTE}:${tag}`, memo: tag,
        }, tx);
        return { applied: Number(r.applied ?? 0), cur_status: String(r.cur_status ?? ''), ok: true };
      } catch (e) {
        return { ok: false, err: String((e as { code?: string }).code ?? (e as Error).message).slice(0, 120) };
      }
    };
    exRes.platform_dep0 = await callList(String(pPlat.cid), 0, 'plat0');
    exRes.nonplatform_dep0 = await callList(String(pNorm.cid), 0, 'norm0');
    exRes.platform_dep7 = await callList(String(pPlatD.cid), 7, 'plat7');
    out.chains.exemption = exRes;

    // ---------- 预备：测试 uid 的账户/batt ----------
    await tx.query(`INSERT INTO public.account (uid,cid,balance,frozen) VALUES ($1,$2,0,0) ON CONFLICT (uid,cid) DO NOTHING`, [U, bcid]);
    // 每次调用前重置 batt
    const setBatt = async (uid: number, v: number) => tx.query(
      `INSERT INTO public.batt_account (uid,batt) VALUES ($1,$2) ON CONFLICT (uid) DO UPDATE SET batt=EXCLUDED.batt`, [uid, v]);

    // ---------- CHAIN 2a · 铸造前置闸不满足（batt=99） ----------
    await setBatt(U, 99);
    const mintRejectBatt = await DatabaseService.bttcMint(
      { uid: U, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    out.chains.mintRejectBatt = {
      outcome: mintRejectBatt?.outcome, batt: mintRejectBatt?.batt,
      battAfterProbe: await battOf(tx, U), usd: await balOf(tx, U, 1),
      bttc: await balOf(tx, U, bcid), supply: await supplyOf(tx, bcid),
      ledgerMintRows: (await ledgerRows(tx, bcid, 'mint')).length,
      feeRows: (await ledgerRows(tx, 1, 'bttc_mint_fee')).length,
      battEntryRows: Number((await oneOf(tx, `SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [U])).n),
    };

    // ---------- CHAIN 2b · 铸造前置闸不满足（$=0） ----------
    await setBatt(U0, 100);
    const mintRejectUsd = await DatabaseService.bttcMint(
      { uid: U0, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    out.chains.mintRejectUsd = {
      outcome: mintRejectUsd?.outcome, battAfterProbe: await battOf(tx, U0),
      usd: await balOf(tx, U0, 1),
      ledgerMintRows: (await ledgerRows(tx, bcid, 'mint')).length,
      battEntryRows: Number((await oneOf(tx, `SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [U0])).n),
    };

    // ---------- CHAIN 2c · 铸造成功（batt=100 · $>=1） ----------
    await setBatt(U, 100);
    const usdPre = await balOf(tx, U, 1);
    const mint = await DatabaseService.bttcMint(
      { uid: U, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    const mintBody = await ledgerRows(tx, bcid, 'mint');
    const mintFee = await ledgerRows(tx, 1, 'bttc_mint_fee');
    out.chains.mint = {
      outcome: mint?.outcome, txid: mint?.txid,
      supplyBefore: mint?.supplyBefore, supplyAfter: mint?.supplyAfter,
      battBefore: 100, battAfter: await battOf(tx, U),
      usdBefore: usdPre, usdAfter: await balOf(tx, U, 1),
      bttcAfter: await balOf(tx, U, bcid),
      supplyNow: await supplyOf(tx, bcid),
      bodyLegs: mintBody, feeLegs: mintFee,
    };

    // ---------- CHAIN 2d · 幂等重放（同 cli:<UUID>） ----------
    await setBatt(U, 100); // 重放仍满足前置闸（否则 gated=false 会走 rejected 分支）
    const beforeReplay = await counts(tx);
    const replay = await DatabaseService.bttcMint(
      { uid: U, idempotencyKey: KC, requestFingerprint: `${NOTE}:mint`, memo: '' }, tx);
    const afterReplay = await counts(tx);
    out.chains.mintReplay = {
      outcome: replay?.outcome,
      ledger_entry_delta: Number(afterReplay.ledger_entry) - Number(beforeReplay.ledger_entry),
      batt_entry_delta: Number(afterReplay.batt_entry) - Number(beforeReplay.batt_entry),
      supplyNow: await supplyOf(tx, bcid),
    };

    // 配对不变式（铸造后）：total_supply == Σmint − Σburn
    out.chains.invAfterMint = {
      supply: await supplyOf(tx, bcid), sumMint: await sumOf(tx, bcid, 'mint'), sumBurn: await sumOf(tx, bcid, 'burn'),
    };

    // ---------- CHAIN 3 · 分解（batt=50 封顶丢弃） ----------
    await setBatt(U, 50);
    const usdPreB = await balOf(tx, U, 1);
    const burn = await DatabaseService.bttcBurn(
      { uid: U, idempotencyKey: KB, requestFingerprint: `${NOTE}:burn`, memo: '' }, tx);
    const burnBody = await ledgerRows(tx, bcid, 'burn');
    const burnFee = await ledgerRows(tx, 1, 'bttc_burn_fee');
    out.chains.burn = {
      outcome: burn?.outcome, txid: burn?.txid,
      supplyBefore: burn?.supplyBefore, supplyAfter: burn?.supplyAfter,
      battBefore: 50, battAfter: await battOf(tx, U),
      usdBefore: usdPreB, usdAfter: await balOf(tx, U, 1),
      bttcAfter: await balOf(tx, U, bcid),
      supplyNow: await supplyOf(tx, bcid),
      bodyLegs: burnBody, feeLegs: burnFee,
      battEntryCap: await oneOf(tx, `SELECT delta::int, batt_after::int FROM public.batt_entry WHERE idempotency_key=$1`, [KB]),
    };
    out.chains.invAfterBurn = {
      supply: await supplyOf(tx, bcid), sumMint: await sumOf(tx, bcid, 'mint'), sumBurn: await sumOf(tx, bcid, 'burn'),
    };

    // ---------- 库级负读数：平台 uid 不得经 burn 销毁（R-9-38） ----------
    try {
      await rowsOf(tx, `SELECT public.ledger_post_event(jsonb_build_object(
        'op','burn','idempotency_key',$1,'ref_type','currency','ref_id',$2,
        'uid','-1','cid',$2,'amount','1'))`, [`${NOTE}:burnneg`, String(bcid)]);
      out.chains.burnPlatform = { raised: false };
    } catch (e) {
      out.chains.burnPlatform = { raised: true, code: String((e as { code?: string }).code ?? '').slice(0, 40) };
    }

    // ---------- 表级零残渣（事务内 after：反映本次写入总量） ----------
    out.txAfterCounts = await counts(tx);
    throw new Error(SENT);
  }).catch((e) => { if (String((e as Error)?.message) !== SENT) throw e; });

  out.after = await counts2();
  out.residue_zero = JSON.stringify(out.before) === JSON.stringify(out.after);
  console.log(JSON.stringify(out, null, 1));
}

const counts2 = async (): Promise<Row> => {
  const r = await readQuery<Row>(`
    SELECT
      (SELECT count(*)::int FROM public.currency) AS currency,
      (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
      (SELECT count(*)::int FROM public.batt_account) AS batt_account,
      (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
      (SELECT count(*)::int FROM public.account) AS account`);
  return r[0];
};

main().then(async () => { await closePools().catch(() => {}); })
  .catch(async (e) => { console.log('FATAL', String((e as Error).stack || e).slice(0, 800)); await closePools().catch(() => {}); });
