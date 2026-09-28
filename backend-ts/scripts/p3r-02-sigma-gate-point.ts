/**
 * p3r-02 · P3-RCA 决定性实验：Σ 闸（trg_ledger_entry_commission_conservation）到底在哪个落点拦得住？
 * ------------------------------------------------------------------------------
 * 全部 leg 跑在**回滚事务**内（末尾一律 ROLLBACK）⇒ 零残留、零真库写入；夹具 uid 9909xx / 键前缀 cli:kong18-。
 * leg 设计（每条独立事务，读进可变 holder，避免被 inRollbackTx 的 result=null 吞掉）：
 *   R   篡改事件（删两行 commission）→ post；再 SET CONSTRAINTS ALL IMMEDIATE（= 提交点结算）→ 期望 LD032
 *   R4  只入不出（删掉全部 commission 行）→ post；再 SET CONSTRAINTS ALL IMMEDIATE → 期望 LD032
 *   G   合法事件 → post；再 SET CONSTRAINTS ALL IMMEDIATE → 期望「无错」（正向对照）
 *   D7  SET CONSTRAINTS ALL IMMEDIATE **前置**；post 合法 → ok；post 篡改 → 复现 D7 的 ok=true 逃逸；再 IMMEDIATE → 期望仍无错
 *   C1  摘掉 trg_referral_cycle_guard + 裸 INSERT depth=0 → 期望 23514 / referral_depth_rng（= E4/F3 的实测崩因）
 *   C2  同上但 depth=1 字面量 → 期望首插成功、第二次同 child_uid 撞 23505 / referral_pk（= E4 期望的「修前形态」其实可达）
 *   C3  守卫启用 + 裸 INSERT depth=0 → 期望 ok，depth 被算成 1（正向对照）
 * 用法：npx ts-node --transpile-only scripts/p3r-02-sigma-gate-point.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import { mkPool, ensureUsers, ensureCurrency, mintTo, holdFor, inRollbackTx, trySql, pgErr,
  RUN, type Qx, type PgErr } from './p2w-lib';
import { planJobSettlement, buildSettleEvent, toPayloadEntry, settleJobFingerprint,
  type SettlementPlan, type SettleJobInput } from '../src/commission';

const OUT_DIR = path.resolve(__dirname, '..', '.p3r-artifacts');
const KEYPREFIX = 'cli:kong18-';
const SYM = `p3rk18${RUN.slice(-4)}`;
const GROSS = '100000';
// job 号（ref_id 必须为十进制整数：hold 校验 NOT_DECIMAL_INTEGER）
const NUMTAG = RUN.replace(/\D/g, '').slice(-7);
const JID = (s: string) => `${NUMTAG}${s}`;

(async () => {
  const p = mkPool(2);
  const U = { EMP: '990901', W: '990902', A: '990903', B: '990904', X: '990905', Y: '990906', Z: '990907' };
  const cid = await ensureCurrency(p as unknown as Qx, SYM, U.EMP, 8);
  // 全 leg 复用同一批 uid：users/currency 的写入也在事务内 ⇒ 回滚后零残留
  const out: Record<string, unknown> = { cid, symbol: SYM, gross: GROSS };

  // SAVEPOINT 包裹（形状同 p2w-00 的 spQ/spFn，公开 Qx 接口）
  const spQ = async (tx: Qx, sql: string, params: unknown[] = []) => {
    await tx.query('SAVEPOINT p3r_sp');
    try {
      const r = await tx.query(sql, params);
      await tx.query('RELEASE SAVEPOINT p3r_sp');
      return { ok: true, rows: r.rows as Array<Record<string, unknown>>, error: null as PgErr | null };
    } catch (e) {
      await tx.query('ROLLBACK TO SAVEPOINT p3r_sp');
      return { ok: false, rows: [] as Array<Record<string, unknown>>, error: pgErr(e) };
    }
  };
  const flushImm = async (tx: Qx) => {
    await tx.query('SAVEPOINT p3r_fl');
    try { await tx.query('SET CONSTRAINTS ALL IMMEDIATE'); await tx.query('RELEASE SAVEPOINT p3r_fl');
      return { ok: true, err: null as PgErr | null }; }
    catch (e) { return { ok: false, err: pgErr(e) }; }
  };
  const post = async (tx: Qx, payload: Record<string, unknown>) => {
    await tx.query('SAVEPOINT p3r_po');
    try {
      const r = await tx.query(`SELECT public.ledger_post_event($1::jsonb) AS r`, [JSON.stringify(payload)]);
      await tx.query('RELEASE SAVEPOINT p3r_po');
      const v = (r.rows[0] as { r: unknown })?.r;
      const o = (typeof v === 'string' ? JSON.parse(v) : v) as Record<string, unknown>;
      return { ok: o?.ok === true, err: null as PgErr | null, raw_ok: o?.ok ?? null };
    } catch (e) { await tx.query('ROLLBACK TO SAVEPOINT p3r_po'); return { ok: false, err: pgErr(e), raw_ok: null }; }
  };
  // 夹具（事务内）：users + 币 + 铸 + 冻结 + 邀请链 W→A→B（先父后子）
  const setup = async (tx: Qx, tag: string) => {
    await ensureUsers(tx, Object.values(U));
    const binds: unknown[] = [];
    for (const [c, par] of [[U.A, U.B], [U.W, U.A]] as Array<[string, string]>) {
      binds.push(await spQ(tx, `INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [c, par]));
    }
    const m = await spQ(tx, `SELECT public.ledger_post_event($1::jsonb) AS r`,
      [JSON.stringify({ op: 'mint', uid: U.EMP, cid, amount_units: '1000000', kind: 'mint', idempotency_key: `${KEYPREFIX}mint:${tag}` })]);
    const h = await spQ(tx, `SELECT public.ledger_post_event($1::jsonb) AS r`,
      [JSON.stringify({ op: 'hold', uid: U.EMP, cid, amount_units: GROSS, kind: 'hold', ref_type: 'job', ref_id: tag, idempotency_key: `${KEYPREFIX}hold:${tag}` })]);
    return { binds: binds.map((b) => (b as { ok: boolean }).ok), mint_ok: m.ok, mint_err: (m.error as PgErr | null)?.reason ?? null,
      hold_ok: h.ok, hold_err: (h.error as PgErr | null)?.reason ?? null };
  };
  const mkPayload = async (tx: Qx, jobId: string) => {
    const input: SettleJobInput = { jobId, employerUid: U.EMP, workerUid: U.W, cid, gross: GROSS };
    const plan = await planJobSettlement({ ...input, ex: tx });
    const ev = buildSettleEvent(plan, input.memo);
    const payload = { op: 'entries', idempotency_key: plan.idempotency_key,
      request_fingerprint: settleJobFingerprint(input), ref_type: 'job', ref_id: plan.job_id,
      memo: `p3r-02 ${jobId}`, entries: ev.entries.map((x) => toPayloadEntry(x)) } as Record<string, unknown> & { entries: Array<Record<string, unknown>> };
    return { plan, payload, input };
  };
  const kinds = (es: Array<Record<string, unknown>>) => es.map((e) => String(e.kind));

  // ---------------- leg R / R4 / G：默认 DEFERRED 落账 → 提交点 flush ----------------
  for (const leg of ['R', 'R4', 'G'] as const) {
    const h: Record<string, unknown> = {};
    const txres = await inRollbackTx(p, async (tx) => {
      h.setup = await setup(tx, JID(leg === 'R' ? '1' : leg === 'R4' ? '2' : '3'));
      const { payload } = await mkPayload(tx, JID(leg === 'R' ? '1' : leg === 'R4' ? '2' : '3'));
      const es = payload.entries;
      let tampered = payload;
      if (leg !== 'G') {
        const comm = es.map((e, i) => [e, i] as const).filter(([e]) => String(e.kind) === 'commission');
        const dropIdx = new Set(leg === 'R' ? comm.slice(-2).map(([, i]) => i) : comm.map(([, i]) => i));
        tampered = { ...payload, entries: es.filter((_e, i) => !dropIdx.has(i)) };
      }
      h.entries_total = es.length; h.entries_posted = tampered.entries.length;
      h.kinds_all = kinds(es); h.kinds_posted = kinds(tampered.entries);
      const pr = await post(tx, tampered);
      h.post = { ok: pr.ok, err: pr.err };
      const fl = await flushImm(tx);
      h.flush_after_post = { ok: fl.ok, sqlstate: fl.err?.sqlstate ?? null, reason: fl.err?.reason ?? null, message: fl.err?.message ?? null };
      return h;
    });
    out[`leg_${leg}`] = { ...h, tx_error: txres.error ? String((txres.error as Error)?.message ?? txres.error).slice(0, 160) : null };
  }

  // ---------------- leg D7：IMMEDIATE **前置** → 复现 D7 逃逸 ----------------
  {
    const h: Record<string, unknown> = {};
    const txres = await inRollbackTx(p, async (tx) => {
      h.setup = await setup(tx, JID('4'));
      const f0 = await flushImm(tx); h.immediate_before = { ok: f0.ok, err: f0.err };
      const okP = await mkPayload(tx, JID('4'));
      const pr1 = await post(tx, okP.payload); h.post_legal = { ok: pr1.ok, err: pr1.err };
      const bad = await mkPayload(tx, JID('5'));
      h.fund_job5 = { mint: (await mintTo(tx, U.EMP, cid, '1000000', `${KEYPREFIX}mint:${JID('5')}`)).ok,
        hold: await holdFor(tx, U.EMP, cid, GROSS, JID('5'), `${KEYPREFIX}hold:${JID('5')}`) };
      const comm = bad.payload.entries.filter((e) => String(e.kind) === 'commission');
      const dropIdx = new Set(comm.slice(-2).map((e) => bad.payload.entries.indexOf(e)));
      const badP = { ...bad.payload, entries: bad.payload.entries.filter((_e, i) => !dropIdx.has(i)) };
      const pr2 = await post(tx, badP); h.post_tampered_while_immediate = { ok: pr2.ok, err: pr2.err };
      const fl = await flushImm(tx); h.flush_after = { ok: fl.ok, sqlstate: fl.err?.sqlstate ?? null, reason: fl.err?.reason ?? null };
      return h;
    });
    out.leg_D7 = { ...h, tx_error: txres.error ? String((txres.error as Error)?.message ?? txres.error).slice(0, 160) : null };
  }

  // ---------------- leg C1/C2/C3：E4/F3 对照手段（摘守卫）的实测崩因 ----------------
  {
    const h: Record<string, unknown> = {};
    await inRollbackTx(p, async (tx) => {
      await ensureUsers(tx, Object.values(U));
      h.disable = (await trySql(tx, `ALTER TABLE public.referral DISABLE TRIGGER trg_referral_cycle_guard`)).ok;
      const i1 = await spQ(tx, `INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [U.X, U.Y]);
      h.insert_depth0_guard_off = { ok: i1.ok, sqlstate: i1.error?.sqlstate ?? null, constraint: i1.error?.constraint ?? null, message: i1.error?.message ?? null };
      const i2 = await spQ(tx, `INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [U.X, U.Y]);
      h.insert_depth1_guard_off_first = { ok: i2.ok, err: i2.error?.sqlstate ?? null };
      const i3 = await spQ(tx, `INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,1)`, [U.X, U.Z]);
      h.insert_depth1_guard_off_rebind = { ok: i3.ok, sqlstate: i3.error?.sqlstate ?? null, constraint: i3.error?.constraint ?? null, message: i3.error?.message ?? null };
      h.enable = (await trySql(tx, `ALTER TABLE public.referral ENABLE TRIGGER trg_referral_cycle_guard`)).ok;
      return h;
    });
    Object.assign(h, { tx_error: null });
    out.leg_C_guardless = h;
  }
  {
    const h: Record<string, unknown> = {};
    await inRollbackTx(p, async (tx) => {
      await ensureUsers(tx, Object.values(U));
      const r = await spQ(tx, `INSERT INTO public.referral (child_uid, parent_uid, depth) VALUES ($1,$2,0)`, [U.X, U.Y]);
      h.insert_depth0_guard_on = { ok: r.ok, err: r.error?.sqlstate ?? null };
      const d = await spQ(tx, `SELECT depth::text AS depth FROM public.referral WHERE child_uid = $1`, [U.X]);
      h.stored_depth = d.rows?.[0]?.depth ?? null;
      return h;
    });
    out.leg_C_guard_on = h;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p3r-02-sigma-gate-point-${RUN}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name: 'p3r-02', at: new Date().toISOString(), ...out }, null, 2));
  console.log(JSON.stringify({ file, run: RUN, out }, null, 1));
  await p.end();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
