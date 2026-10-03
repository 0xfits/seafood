/**
 * P9④ 终审质检 · L2 库面活体 + L3 四段真链路（自写探针 · 不复用实现方产物）
 * 角色 Neng。库面写一律事务内 + 末尾 ROLLBACK。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  DatabaseService, MINT_BURN_POLICY_DEFAULTS, BATT_CAP_HARD_MAX, resolveMintBurnPolicy,
} from '../src/database';
import { getTransactionPool, closePools, readQuery } from '../src/db';

const REPO = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT: Record<string, unknown> = {};

const uuid = (): string => crypto.randomUUID();
const cliKey = (): string => `cli:${uuid()}`;

const kindVals = (s: string): string[] => (s.match(/'([a-z_]+)'/g) || []).map((x) => x.slice(1, -1));

async function main(): Promise<void> {
  // ======================= L2 库面活体（只读） =======================
  const l2: Record<string, unknown> = {};
  l2.schema_version = (await readQuery<{ v: string }>('SELECT version AS v FROM public.schema_migration ORDER BY version DESC LIMIT 1'))[0]?.v;
  l2.schema_rows = (await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.schema_migration'))[0]?.n;
  l2.base_tables = (await readQuery<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`))[0]?.n;

  const keDef = (await readQuery<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`))[0]?.def ?? '';
  const keVals = kindVals(keDef);
  l2.kind_enum_def = keDef;
  l2.kind_enum_count = keVals.length;
  l2.kind_enum_has_bttc = keVals.includes('bttc_mint_fee') && keVals.includes('bttc_burn_fee');

  const fnDef = (await readQuery<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_kind_ok'`))[0]?.def ?? '';
  // 第一支 = SELECT p_kind IN (...)
  const m1 = fnDef.match(/p_kind IN \(([^)]*)\)\s*AND \(NOT p_frozen_settle OR p_kind IN \(([^)]*)\)\)/);
  const first = m1 ? kindVals(m1[1]) : [];
  const frozen = m1 ? kindVals(m1[2]) : [];
  l2.kind_ok_def_present = fnDef.length > 0;
  l2.kind_ok_first_branch = first;
  l2.kind_ok_first_branch_count = first.length;
  l2.kind_ok_first_has_bttc = first.includes('bttc_mint_fee') && first.includes('bttc_burn_fee');
  l2.kind_ok_frozen_family = frozen;
  l2.kind_ok_frozen_count = frozen.length;
  l2.kind_ok_frozen_has_bttc = frozen.some((k) => k.startsWith('bttc'));

  const pmDef = (await readQuery<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_assert_platform_mutation'`))[0]?.def ?? '';
  const mwl = pmDef.match(/WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN \(([^)]*)\)/);
  const wl = mwl ? kindVals(mwl[1]) : [];
  l2.platform_mutation_m1_credit = wl;
  l2.platform_mutation_m1_credit_count = wl.length;
  l2.platform_mutation_has_bttc = wl.includes('bttc_mint_fee') && wl.includes('bttc_burn_fee');

  const beDef = (await readQuery<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_post_event'`))[0]?.def ?? '';
  const mOp = beDef.match(/v_op IS NULL OR v_op NOT IN \(([^)]*)\)/);
  const opList = mOp ? (mOp[1].match(/'([a-z_]+)'/g) || []).map((x) => x.slice(1, -1)) : [];
  l2.op_whitelist = opList;
  l2.op_has_burn = opList.includes('burn');
  l2.double_write_mint = /UPDATE currency SET total_supply = total_supply \+ v_amount/.test(beDef);
  l2.double_write_burn = /UPDATE currency SET total_supply = total_supply - v_amount/.test(beDef);
  l2.burn_platform_forbidden = /PLATFORM_BURN_FORBIDDEN/.test(beDef);
  const mBurnSrc = beDef.match(/v_op = 'burn'[\s\S]{0,400}?ledger_norm_entry\(([^)]*)\)/);
  l2.burn_body_leg_snippet = mBurnSrc ? mBurnSrc[0].replace(/\s+/g, ' ').slice(0, 200) : null;

  l2.is_platform_coin_cols = await readQuery(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='currency' AND column_name='is_platform_coin'`);
  l2.currency_rows = (await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.currency'))[0]?.n;
  l2.currency_true_flag = (await readQuery<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.currency WHERE is_platform_coin`))[0]?.n;

  const migChecks: Record<string, unknown>[] = [];
  for (const v of ['0032', '0033', '0034']) {
    const row = (await readQuery<{ version: string; name: string; checksum: string }>(
      `SELECT version, name, checksum FROM public.schema_migration WHERE version=$1`, [v]))[0];
    const file = (await readQuery<{ p: string }>(`SELECT $1::text AS p`, ['x']))[0];
    const migFile = fs.readdirSync(path.join(REPO, 'backend-ts', 'migrations')).find((f) => f.startsWith(v))!;
    const content = fs.readFileSync(path.join(REPO, 'backend-ts', 'migrations', migFile), 'utf8');
    const sha = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    migChecks.push({ version: v, file: migFile, db_checksum: row?.checksum ?? null, file_sha256: sha, match: row?.checksum === sha, noop: file?.p });
  }
  l2.migration_checksums = migChecks;
  OUT.L2 = l2;

  // ======================= L3 四段真链路（事务内 + ROLLBACK） =======================
  const pool = getTransactionPool();
  const client = await pool.connect();
  const fk = cliKey();
  const fk2 = cliKey();
  const fk3 = cliKey();
  const fp = 'qa9s4fp'.padEnd(16, '0');
  const platformCid = 1;
  const RESIDUE_TABLES = ['currency', 'ledger_entry', 'batt_account', 'batt_entry', 'account', 'currency_status_log', 'currency_review_log'];
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL lock_timeout = 3000');
    await client.query('SET LOCAL statement_timeout = 10000');
    const q = (t: string, p?: unknown[]) => client.query(t, p);
    const cnt = async (): Promise<Record<string, number>> => {
      const o: Record<string, number> = {};
      for (const t of RESIDUE_TABLES) o[t] = Number((await q(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0]?.n ?? -1);
      return o;
    };
    const bttcCid = async (): Promise<string | null> => {
      const r = (await q(`SELECT cid::text AS cid FROM public.currency WHERE symbol='BTTC'`)).rows[0];
      return r ? String(r.cid) : null;
    };
    const supply = async (): Promise<string> => {
      const r = (await q(`SELECT total_supply::text AS s FROM public.currency WHERE symbol='BTTC'`)).rows[0];
      return r ? String(r.s) : 'NA';
    };
    const battOf = async (uid: number): Promise<number> => Number((await q(`SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid=$1),0)::int AS b`, [uid])).rows[0]?.b ?? -1);
    const usdOf = async (uid: number): Promise<string> => String((await q(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=1),0)::text AS b`, [uid])).rows[0]?.b ?? 'NA');
    const setBatt = async (uid: number, v: number) => q(
      `INSERT INTO public.batt_account (uid, batt) VALUES ($1,$2) ON CONFLICT (uid) DO UPDATE SET batt=$2`, [uid, v]);
    const setUsd = async (uid: number, v: number) => {
      await q(`INSERT INTO public.account (uid, cid, balance) VALUES ($1,1,0) ON CONFLICT (uid,cid) DO NOTHING`, [uid]);
      await q(`UPDATE public.account SET balance=$2 WHERE uid=$1 AND cid=1`, [uid, v]);
    };
    const sums = async (): Promise<Record<string, string>> => {
      const cid = await bttcCid();
      const r = (await q(
        `SELECT COALESCE(sum(e.delta) FILTER (WHERE e.kind='mint'),0)::text AS sm,
                COALESCE(sum(e.delta) FILTER (WHERE e.kind='burn'),0)::text AS sb
           FROM public.ledger_entry e WHERE e.cid=$1::bigint AND e.kind IN ('mint','burn')`, [cid])).rows[0];
      return { sumMint: String(r?.sm ?? 'NA'), sumBurn: String(r?.sb ?? 'NA') };
    };

    const l3: Record<string, unknown> = {};
    const UID = 4;
    l3.residue_before = await cnt();
    l3.bttc_row_before = await bttcCid();

    // ---- ① 创建 + F-α 首调 ----
    const c1 = await DatabaseService.ensureBttcCurrency(client);
    const c2 = await DatabaseService.ensureBttcCurrency(client);
    const direct = (await q(`SELECT cid::text, symbol, name, owner_uid::text, decimals, status, total_supply::text, is_platform_coin FROM public.currency WHERE symbol='BTTC'`)).rows[0];
    l3.create = {
      first_call: c1, second_call: c2, direct_row: direct,
      first_non_null: c1 !== null, first_symbol_BTTC: c1?.symbol === 'BTTC',
      first_decimals_0: c1?.decimals === 0, first_status_listed: c1?.status === 'listed',
      first_is_platform_coin_true: c1?.is_platform_coin === true, first_inserted: c1?.inserted === true,
      second_inserted_false: c2?.inserted === false, first_cid_equals_second: c1?.cid === c2?.cid,
    };
    const BC = await bttcCid();

    // ---- ② 豁免闸两读数 ----
    const su = 'QA9NONPLAT', sp = 'QA9PLAT', sp2 = 'QA9PLATD';
    const insCur = async (sym: string, owner: number, plat: boolean, dep: number): Promise<number> => {
      const r = await q(
        `INSERT INTO public.currency (symbol, name, owner_uid, decimals, status, deposit_amount, deposit_cid, is_platform_coin)
         VALUES ($1,$2,$3,0,'draft',$4,1,$5) RETURNING cid::text AS cid`, [sym, sym, owner, dep, plat]);
      return Number(r.rows[0]?.cid);
    };
    const cidN = await insCur(su, UID, false, 0);
    const cidP = await insCur(sp, UID, true, 0);
    const cidP2 = await insCur(sp2, UID, true, 2000);
    const saveWrap = async <T,>(fn: () => Promise<T>, onErr: (e: unknown) => T): Promise<T> => {
      await q('SAVEPOINT qasp');
      try { const r = await fn(); await q('RELEASE SAVEPOINT qasp'); return r; }
      catch (e) { await q('ROLLBACK TO SAVEPOINT qasp'); return onErr(e); }
    };
    const callList = async (cid: number, key: string): Promise<Record<string, unknown>> => saveWrap(
      async () => {
        const r = await DatabaseService.listCurrencyWithDeposit(
          { cid, actorUid: UID, fee: 0, depositAmount: cid === cidP2 ? 2000 : 0, idempotencyKey: key, requestFingerprint: fp, memo: '' }, client);
        return { ok: true, applied: Number(r.applied ?? -1), cur_status: r.cur_status, cur_found: r.cur_found };
      },
      (e) => ({ ok: false, err: String((e as { code?: string }).code ?? (e as Error).message).slice(0, 80) }),
    );
    l3.exempt_gate = {
      non_platform_dep0: await callList(cidN, cliKey()),
      platform_dep0: await callList(cidP, cliKey()),
      platform_dep2000: await callList(cidP2, cliKey()),
    };

    // ---- ③ 铸造（uid=4 · $ 余额 4 与账本快照一致，不直改账户） ----
    const NG = 900005; // 负对照用 fresh uid（users 存在 · 无 cid=1 账户行 ⇒ usd=0）
    await setBatt(UID, 100);
    const mintBefore = { batt: await battOf(UID), usd: await usdOf(UID), held: String((await q(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2::bigint),0)::text AS b`, [UID, BC])).rows[0]?.b), supply: await supply() };
    const mint1 = await DatabaseService.bttcMint({ uid: UID, idempotencyKey: fk, requestFingerprint: fp, memo: '' }, client);
    const mintAfter = { batt: await battOf(UID), usd: await usdOf(UID), held: String((await q(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2::bigint),0)::text AS b`, [UID, BC])).rows[0]?.b), supply: await supply() };
    const mintBodyLegs = (await q(`SELECT uid::text AS uid, delta::text AS delta, kind FROM public.ledger_entry WHERE cid=$1::bigint AND kind='mint'`, [BC])).rows;
    const feeLegs1 = (await q(`SELECT uid::text AS uid, delta::text AS delta, kind FROM public.ledger_entry WHERE kind='bttc_mint_fee'`)).rows;
    l3.mint = { outcome: mint1?.outcome, txid: mint1?.txid, supplyBefore: mint1?.supplyBefore, supplyAfter: mint1?.supplyAfter, before: mintBefore, after: mintAfter, bodyLegs: mintBodyLegs, feeLegs: feeLegs1 };

    // 幂等重放（★ 两读数：闸不可过 vs 闸可过）
    const leBefore = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    const beBefore = Number((await q(`SELECT count(*)::int AS n FROM public.batt_entry`)).rows[0]?.n);
    const mintReplayDowngate = await DatabaseService.bttcMint({ uid: UID, idempotencyKey: fk, requestFingerprint: fp, memo: '' }, client);
    const leMid = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    const beMid = Number((await q(`SELECT count(*)::int AS n FROM public.batt_entry`)).rows[0]?.n);
    await setBatt(UID, 100); // 恢复闸可过（同键重放语义：零新增）
    const mintReplay = await DatabaseService.bttcMint({ uid: UID, idempotencyKey: fk, requestFingerprint: fp, memo: '' }, client);
    const leAfter = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    const beAfter = Number((await q(`SELECT count(*)::int AS n FROM public.batt_entry`)).rows[0]?.n);
    l3.mint_replay = {
      replay_gate_down: { outcome: mintReplayDowngate?.outcome, ledger_entry_delta: leMid - leBefore, batt_entry_delta: beMid - beBefore },
      replay_gate_pass: { outcome: mintReplay?.outcome, ledger_entry_delta: leAfter - leMid, batt_entry_delta: beAfter - beMid },
      supplyNow: await supply(),
    };

    // 闸负：batt=99（同一 uid · $ 仍 3 ≥1）
    await setBatt(UID, 99);
    const leB2 = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    const negBatt = await DatabaseService.bttcMint({ uid: UID, idempotencyKey: fk2, requestFingerprint: fp, memo: '' }, client);
    const leA2 = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    l3.mint_neg_batt = { outcome: negBatt?.outcome, batt: await battOf(UID), usd: await usdOf(UID), ledger_delta: leA2 - leB2, supply: await supply() };

    // 闸负：$=0（fresh uid 900900 · 无 cid=1 账户行 ⇒ usd=0）
    await setBatt(NG, 100);
    const leB3 = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    const negUsd = await DatabaseService.bttcMint({ uid: NG, idempotencyKey: fk3, requestFingerprint: fp, memo: '' }, client);
    const leA3 = Number((await q(`SELECT count(*)::int AS n FROM public.ledger_entry`)).rows[0]?.n);
    l3.mint_neg_usd = { outcome: negUsd?.outcome, batt: await battOf(NG), usd: await usdOf(NG), ledger_delta: leA3 - leB3, supply: await supply() };

    // 配对不变式（铸后）
    const s1 = await sums(); l3.invariant_after_mint = { supply: await supply(), ...s1, eq_plus: String(BigInt(s1.sumMint) + BigInt(s1.sumBurn)) === await supply(), eq_minus: String(BigInt(s1.sumMint) - BigInt(s1.sumBurn)) === await supply() };

    // ---- ④ 分解（uid=4 · 铸后 $ 快照 3 · BTTC 持仓 1） ----
    await setBatt(UID, 50);
    const burnBefore = { batt: await battOf(UID), usd: await usdOf(UID), held: String((await q(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2::bigint),0)::text AS b`, [UID, BC])).rows[0]?.b), supply: await supply() };
    const burnKey = cliKey();
    const burn1 = await DatabaseService.bttcBurn({ uid: UID, idempotencyKey: burnKey, requestFingerprint: fp, memo: '' }, client);
    const burnAfter = { batt: await battOf(UID), usd: await usdOf(UID), held: String((await q(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2::bigint),0)::text AS b`, [UID, BC])).rows[0]?.b), supply: await supply() };
    const burnLegs = (await q(`SELECT uid::text AS uid, delta::text AS delta, kind FROM public.ledger_entry WHERE cid=$1::bigint AND kind='burn'`, [BC])).rows;
    const feeLegs2 = (await q(`SELECT uid::text AS uid, delta::text AS delta, kind FROM public.ledger_entry WHERE kind='bttc_burn_fee'`)).rows;
    const battEntry = (await q(`SELECT delta::text AS d, batt_after::text AS a, reason FROM public.batt_entry WHERE idempotency_key=$1`, [burnKey])).rows;
    l3.burn = { outcome: burn1?.outcome, txid: burn1?.txid, supplyBefore: burn1?.supplyBefore, supplyAfter: burn1?.supplyAfter, before: burnBefore, after: burnAfter, bodyLegs: burnLegs, feeLegs: feeLegs2, battEntry, capped: (burnBefore.batt + 100 > 100) };

    // 配对不变式（分解后）
    const s2 = await sums(); const sup2 = await supply();
    l3.invariant_after_burn = { supply: sup2, ...s2, eq_plus: String(BigInt(s2.sumMint) + BigInt(s2.sumBurn)) === sup2, eq_minus: String(BigInt(s2.sumMint) - BigInt(s2.sumBurn)) === sup2 };

    // ---- 平台 uid burn ⇒ LD021 ----
    await q('SAVEPOINT qaburn');
    try {
      await q(`SELECT ledger_post_event(jsonb_build_object('op','burn','idempotency_key',$1::text,'request_fingerprint',$2::text,'ref_type','currency','ref_id',$3::text,'uid','-1','cid',$3::text,'amount','1'))`, [cliKey(), fp, BC]);
      l3.platform_burn = { raised: false };
      await q('RELEASE SAVEPOINT qaburn');
    } catch (e) {
      const er = e as { code?: string; message?: string; detail?: string };
      await q('ROLLBACK TO SAVEPOINT qaburn');
      l3.platform_burn = { raised: true, code: er.code, message: er.message, has_PLATFORM_BURN_FORBIDDEN: /PLATFORM_BURN_FORBIDDEN/.test(String(er.detail ?? '')) };
    }

    // ---- 零残渣（事务内读数 + 回滚后现取对拍） ----
    l3.residue_in_tx_with_fixtures = await cnt();
    l3.zero_residue_note = '回滚后（见 L3_rollback_verify）现取与 residue_before 对拍';
    OUT.L3 = l3;
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  const liveAfter: Record<string, number> = {};
  for (const t of RESIDUE_TABLES) liveAfter[t] = Number((await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t}`))[0]?.n ?? -1);
  const before = OUT.L3 as { residue_before: Record<string, number> };
  OUT.L3_rollback_verify = {
    live_after_rollback: liveAfter,
    residue_before: before.residue_before,
    zero_residue: JSON.stringify(liveAfter) === JSON.stringify(before.residue_before),
    bttc_rows_after_rollback: (await readQuery(`SELECT cid::text FROM public.currency WHERE symbol='BTTC'`)).length,
    qa_currency_rows: (await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.currency WHERE symbol LIKE 'QA9%'`))[0]?.n,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'l2-l3.json'), JSON.stringify(OUT, null, 2));
  console.log(JSON.stringify(OUT, null, 2));
  await closePools();
}
main().catch((e) => { console.error('ERR', (e as Error).message, (e as { code?: string }).code); process.exit(1); });
