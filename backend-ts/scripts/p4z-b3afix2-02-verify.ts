// p4z-b3afix2-02-verify.ts — P4-B3a-FIX-A2 验证（函数形状 + 真事件正/负对照 + 幂等 + 关闭集 + 资金不变量）
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix2-02-verify.ts <outDir>
// 口径：每步单独 try/catch，读数落盘；不落 token/密钥本体；先落盘再断言。
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix2-run'));
fs.mkdirSync(outDir, { recursive: true });
const RUN = path.basename(outDir);

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sql = neon(String(process.env.DATABASE_URL || ''));
const ledger = require(path.join(REPO, 'src', 'ledger')) as {
  HOLD_KINDS: string[];
  LEDGER_KINDS: string[];
  assertPlatformAccountMutation: (u: bigint, k: string, d: 'credit' | 'debit') => void;
  postEvent: (i: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const steps: Record<string, unknown> = {};
const run = async (name: string, fn: () => Promise<unknown> | unknown) => {
  try { steps[name] = { ok: true, result: await fn() }; }
  catch (e) {
    const anyE = e as Record<string, unknown>;
    steps[name] = {
      ok: false,
      error_code: anyE?.code ?? null,
      error_message: String(anyE?.message || e).slice(0, 240),
      details: anyE?.details ?? null,
    };
  }
  const s = steps[name] as Record<string, unknown>;
  console.log(`[${s.ok ? 'PASS' : 'FAIL'}] ${name} :: ${JSON.stringify(s.ok ? s.result : { code: s.error_code, msg: s.error_message, details: s.details }).slice(0, 260)}`);
};

const expectThrow = async (name: string, wantCode: string, fn: () => Promise<unknown> | unknown) => {
  try {
    await fn();
    steps[name] = { ok: false, result: 'NOT-REJECTED (不得出现)' };
  } catch (e) {
    const anyE = e as Record<string, unknown>;
    const code = String(anyE?.code ?? '');
    steps[name] = {
      ok: code === wantCode,
      result: code === wantCode ? `rejected as expected: ${code}` : `rejected with WRONG code: ${code}`,
      error_message: String(anyE?.message || e).slice(0, 200),
      details: anyE?.details ?? null,
    };
  }
  const s = steps[name] as Record<string, unknown>;
  console.log(`[${s.ok ? 'PASS' : 'FAIL'}] ${name} :: ${JSON.stringify({ r: s.result, msg: s.error_message, details: s.details }).slice(0, 260)}`);
};

const expectThrowReason = async (name: string, wantCode: string, wantReason: string, fn: () => Promise<unknown> | unknown) => {
  try {
    await fn();
    steps[name] = { ok: false, result: 'NOT-REJECTED (不得出现)' };
  } catch (e) {
    const anyE = e as Record<string, unknown>;
    const code = String(anyE?.code ?? '');
    const reason = String((anyE?.details as { reason?: string } | undefined)?.reason ?? '');
    steps[name] = {
      ok: code === wantCode && reason === wantReason,
      result: `code=${code} reason=${reason} (want ${wantCode}/${wantReason})`,
      error_message: String(anyE?.message || e).slice(0, 200),
      details: anyE?.details ?? null,
    };
  }
  const s = steps[name] as Record<string, unknown>;
  console.log(`[${s.ok ? 'PASS' : 'FAIL'}] ${name} :: ${JSON.stringify({ r: s.result, details: s.details }).slice(0, 260)}`);
};

const countEntries = async () => Number(((await sql('SELECT count(*)::int AS n FROM public.ledger_entry')) as Array<{ n: number }>)[0].n);
const sigma = async () => String(((await sql('SELECT COALESCE(sum(balance+frozen),0)::text AS s FROM public.account')) as Array<{ s: string }>)[0].s);
const bal = async (uid: string, cid: string) =>
  ((await sql(`SELECT balance::text AS b, frozen::text AS f FROM public.account WHERE uid = ${uid}::bigint AND cid = ${cid}::bigint`)) as Array<{ b: string; f: string }>)[0] ?? null;
const keyOf = (s: string) => `cli:p4b3afix2:${RUN}:${s}`;

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), run: RUN, phase: 'post-fix-A2' };
  const from = (name: string) => { const s = steps[name] as Record<string, unknown>; return s && s.ok ? s.result : `STEP_FAILED:${name}`; };

  // ================= A. 迁移注册表 = 19 =================
  await run('A_registry_count_19', async () => {
    const rows = (await sql(`SELECT version, name, checksum FROM public.schema_migration ORDER BY version`)) as Array<Record<string, string>>;
    return { count: rows.length, last: rows[rows.length - 1], versions: rows.map((r) => r.version) };
  });

  // ================= B. 函数形状（live 读数） =================
  await run('B_fn_shape', async () => {
    const r = (await sql(`SELECT md5(pg_get_functiondef(p.oid)) AS def_md5, length(pg_get_functiondef(p.oid))::int AS def_len,
                                 md5(p.prosrc) AS prosrc_md5,
                                 position('listing_deposit' in p.prosrc) AS ld_in_body,
                                 position('''hold'',''hold_release'',''job_escrow'',''job_escrow_refund'')' in p.prosrc) AS list_pos,
                                 position('HOLD_PAIR_REQUIRED' in p.prosrc) AS pair_hint_pos,
                                 position('HAVING count(*) <> 2' in p.prosrc) AS having_pos,
                                 pg_get_function_identity_arguments(p.oid) AS sig, pg_get_function_result(p.oid) AS ret,
                                 obj_description(p.oid, 'pg_proc') AS comment
                            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                           WHERE p.proname = 'ledger_post_event' AND n.nspname = 'public'`)) as Array<Record<string, unknown>>;
    return r[0];
  });

  // ================= C. kind 关闭集（DB ::text 计数 + TS 对照） =================
  await run('C_kind_close_set_20', async () => {
    const dbDef = ((await sql(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conrelid='public.ledger_entry'::regclass AND c.conname='ledger_kind_enum'`)) as Array<{ def: string }>)[0].def;
    const dbKinds = (dbDef.match(/'([a-z_]+)'::text/g) || []).map((s) => s.slice(1, s.indexOf("'", 1)));
    const textHits = (dbDef.match(/::text/g) || []).length;
    const tsKinds = ledger.LEDGER_KINDS as string[];
    return {
      db_text_occurrences: textHits,
      db_kind_count: dbKinds.length,
      ts_kind_count: tsKinds.length,
      sets_equal: JSON.stringify([...dbKinds].sort()) === JSON.stringify([...tsKinds].sort()),
      db_only: dbKinds.filter((k) => !tsKinds.includes(k)),
      ts_only: tsKinds.filter((k) => !dbKinds.includes(k)),
    };
  });

  // ================= D. TS 侧：HOLD_KINDS 4 项（不含 listing_deposit） =================
  await run('D_ts_hold_kinds_4', () => ({
    hold_kinds: ledger.HOLD_KINDS, len: ledger.HOLD_KINDS.length,
    has_listing_deposit: ledger.HOLD_KINDS.includes('listing_deposit'),
    ts_assert_pos_m1_listing_deposit_credit: (() => { try { ledger.assertPlatformAccountMutation(-1n, 'listing_deposit', 'credit'); return 'no-throw'; } catch (e) { return 'THROW:' + String((e as { code?: string })?.code); } })(),
  }));

  // ================= E. 夹具 =================
  const cand = (await sql(`
    SELECT a.uid::text AS uid, a.cid::text AS cid, a.balance::text AS balance, c.symbol, c.status
      FROM public.account a
      JOIN public.currency c ON c.cid = a.cid
     WHERE a.uid > 0 AND a.balance >= 5
       AND EXISTS (SELECT 1 FROM public.account p WHERE p.uid = -1 AND p.cid = a.cid)
     ORDER BY a.uid, a.cid LIMIT 20`)) as Array<Record<string, string>>;
  out.fixture_candidates = cand;
  if (!cand.length) throw new Error('NO_FIXTURE_ACCOUNT');
  const fx = cand[0];
  const fx2 = cand.find((c) => c.uid !== fx.uid) || cand[1] || fx;
  out.fixture = fx;
  out.fixture_other_account = fx2;
  const AMT = 1;

  const n0 = await countEntries();
  const sig0 = await sigma();
  const bal0User = await bal(fx.uid, fx.cid);
  const bal0P1 = await bal('-1', fx.cid);
  const bal0P2 = await bal('-2', fx.cid);
  const bal0P3 = await bal('-3', fx.cid);

  // ================= F. 正向：listing_deposit 跨账户消耗入 -1 =================
  const KEY_POS = keyOf('pos:listing_deposit_cross_account');
  await run('F_event_pos_listing_deposit_cross_account', async () => {
    const r = await ledger.postEvent({
      op: 'entries',
      idempotencyKey: KEY_POS,
      memo: 'p4b3afix2 positive: listing_deposit consumed, credit uid=-1',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
    return { txid: r.txid, replayed: r.replayed ?? null, entry_count: (r.entries as unknown[]).length, entries: r.entries };
  });

  // ================= F2. 资金不变量：正向形状的 Σ(balance+frozen) 变化量必须 = 0 =================
  await run('F2_sigma_invariant_around_positive_event', async () => {
    const KEY_SIG = keyOf('pos:listing_deposit_sigma_probe');
    const sBefore = await sigma();
    const uBefore = await bal(fx.uid, fx.cid);
    const pBefore = await bal('-1', fx.cid);
    const r = await ledger.postEvent({
      op: 'entries', idempotencyKey: KEY_SIG, memo: 'p4b3afix2 sigma probe: listing_deposit consumed -> uid=-1',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
    const sAfter = await sigma();
    return {
      sigma_before: sBefore, sigma_after: sAfter,
      sigma_delta: String(BigInt(sAfter) - BigInt(sBefore)),
      user_before: uBefore, user_after: await bal(fx.uid, fx.cid),
      m1_before: pBefore, m1_after: await bal('-1', fx.cid),
      txid: r.txid, entry_count: (r.entries as unknown[]).length,
      per_entry: (r.entries as Array<Record<string, string>>).map((e) => ({ uid: e.uid, delta: e.delta, frozen_delta: e.frozen_delta })),
    };
  });

  // ================= G. 幂等：同键重投 =================
  const KEY_IDEM = keyOf('pos:idem_repost');
  await run('G_idem_first_post', async () => {
    const r = await ledger.postEvent({
      op: 'entries', idempotencyKey: KEY_IDEM, memo: 'p4b3afix2 idem #1',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
    return { txid: r.txid, replayed: r.replayed ?? null };
  });
  const nAfterIdem1 = await countEntries();
  await run('G_idem_second_post_replay', async () => {
    const r = await ledger.postEvent({
      op: 'entries', idempotencyKey: KEY_IDEM, memo: 'p4b3afix2 idem #2 (same key)',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
    const n = await countEntries();
    return { txid: r.txid, replayed: r.replayed ?? null, entries_after: n, entries_before_second: nAfterIdem1, second_entry_added: n - nAfterIdem1 };
  });

  // ================= H. 负对照 =================
  // H1 一个 hold 家族 kind（hold）单腿 ⇒ 仍拒
  await expectThrow('H1_neg_hold_single_leg_pair_required', 'LEDGER_AMOUNT_INVALID', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:hold_single_leg'), memo: 'p4b3afix2 neg: hold single leg',
      entries: [{ uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'hold' }],
    });
  });
  // H2a 两个不同 hold 家族 kind（hold / job_escrow）各只 1 条腿 ⇒ 每个 (uid,cid,kind) 组 count=1 ⇒ 仍拒
  //   注：run#1 的「跨账户两腿」用例因**夹具不足**（正 uid 账户只有 970001/cid1 一个 ⇒ fx2===fx）退化成
  //   「同账户 2 腿」的**合法对**，被放行 —— 该退化读数是「守卫正向侧仍工作」的证据，负向改用下面三例。
  await expectThrowReason('H2a_neg_two_hold_family_kinds_one_leg_each', 'LEDGER_AMOUNT_INVALID', 'HOLD_PAIR_REQUIRED', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:hold_and_escrow_one_leg_each'), memo: 'p4b3afix2 neg: hold + job_escrow, one leg each',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'hold' },
        { uid: fx.uid, cid: fx.cid, delta: `${AMT}`, kind: 'job_escrow' },
      ],
    });
  });
  // H2b 同一 kind（hold）两腿但**不同 (cid)** ⇒ 两个组各 1 条 ⇒ 仍拒（列了同一 uid、同 cid 才许成对）
  await expectThrowReason('H2b_neg_hold_same_kind_two_cids', 'LEDGER_AMOUNT_INVALID', 'HOLD_PAIR_REQUIRED', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:hold_two_cids'), memo: 'p4b3afix2 neg: hold same kind, two cids',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'hold' },
        { uid: fx.uid, cid: '10', delta: `${AMT}`, kind: 'hold' },
      ],
    });
  });
  // H2c 同一 (uid,cid,kind) 组 **3 条**（>2）⇒ 仍拒（「恰好 2 条」的另一侧）
  //   run#2 首版用 (-1,0)/(0,+1)/(+1,0) 三腿 ⇒ 在 **TS 侧** `assertBalanced`（net = delta+frozen ≠ 0）先被拒
  //   （reason=EVENT_NOT_BALANCED），根本没到 DB 的配对闸；改成 net=0 且无零腿的纯 delta 三腿以直达该闸。
  await expectThrowReason('H2c_neg_hold_three_legs_same_group', 'LEDGER_AMOUNT_INVALID', 'HOLD_PAIR_REQUIRED', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:hold_three_legs_same_group'), memo: 'p4b3afix2 neg: hold 3 legs same account/cid, net 0',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'hold' },
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'hold' },
        { uid: fx.uid, cid: fx.cid, delta: `${AMT + AMT}`, kind: 'hold' },
      ],
    });
  });
  // H4 阳性对照：hold 家族同账户**恰 2 腿**仍必须放行（证明守卫本体仍在工作，不是被整段删掉）
  await run('H4_pos_hold_same_account_two_legs_still_ok', async () => {
    const r = await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('pos:hold_same_account_pair'), memo: 'p4b3afix2 control: hold 2 legs same account',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'hold' },
        { uid: fx.uid, cid: fx.cid, delta: '0', frozenDelta: `${AMT}`, kind: 'hold' },
      ],
    });
    return { txid: r.txid, entry_count: (r.entries as unknown[]).length };
  });
  // H5 commission 贷 -1 仍拒
  await expectThrow('H5_neg_commission_credit_m1', 'LEDGER_RESERVED_UID', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:commission_credit_m1'), memo: 'p4b3afix2 neg: commission -> -1',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'commission' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'commission' },
      ],
    });
  });
  // H6 listing_deposit **借** -1 仍拒
  await expectThrow('H6_neg_listing_deposit_debit_m1', 'LEDGER_RESERVED_UID', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:listing_deposit_debit_m1'), memo: 'p4b3afix2 neg: listing_deposit debit -1',
      entries: [
        { uid: '-1', cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: fx.uid, cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
  });
  // H7/H8 -2 / -3 白名单未被顺带放宽（listing_deposit credit ⇒ 仍拒）
  await expectThrow('H7_neg_listing_deposit_credit_m2', 'LEDGER_RESERVED_UID', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:listing_deposit_credit_m2'), memo: 'p4b3afix2 neg: listing_deposit -> -2',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-2', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
  });
  await expectThrow('H8_neg_listing_deposit_credit_m3', 'LEDGER_RESERVED_UID', async () => {
    await ledger.postEvent({
      op: 'entries', idempotencyKey: keyOf('neg:listing_deposit_credit_m3'), memo: 'p4b3afix2 neg: listing_deposit -> -3',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-3', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
  });
  // H9 DB 侧直调：-1 debit listing_deposit 仍拒 / -2 -3 credit listing_deposit 仍拒
  await expectThrow('H9_db_fn_neg_m1_debit', 'LD021', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-1::bigint,'listing_deposit','debit')`);
  });
  await expectThrow('H9b_db_fn_neg_m2_credit', 'LD021', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-2::bigint,'listing_deposit','credit')`);
  });
  await expectThrow('H9c_db_fn_neg_m3_credit', 'LD021', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-3::bigint,'listing_deposit','credit')`);
  });
  await run('H9d_db_fn_pos_m1_credit', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-1::bigint,'listing_deposit','credit')`);
    return 'no-throw (0019 白名单仍生效)';
  });

  // ================= I. 分录形状 + 资金不变量 =================
  const n1 = await countEntries();
  const sig1 = await sigma();
  const balU1 = await bal(fx.uid, fx.cid);
  const balP1 = await bal('-1', fx.cid);
  const balP2 = await bal('-2', fx.cid);
  const balP3 = await bal('-3', fx.cid);
  out.deltas = {
    ledger_entry_n: { before: n0, after: n1, delta: n1 - n0 },
    sigma: { before: sig0, after: sig1, equal: sig0 === sig1 },
    user_account: { before: bal0User, after: balU1 },
    m1_account: { before: bal0P1, after: balP1 },
    m2_account: { before: bal0P2, after: balP2 },
    m3_account: { before: bal0P3, after: balP3 },
    sigma_delta_positive_event_only: from('F_event_pos_listing_deposit_cross_account'),
  };

  await run('I_positive_event_entries_readback', async () => ({
    persisted_rows: await sql(`SELECT txid::text, uid::text, cid::text, delta::text, frozen_delta::text, balance_after::text, frozen_after::text, kind, idempotency_key, event_root_key
                                 FROM public.ledger_entry WHERE event_root_key = '${KEY_POS}' ORDER BY txid`),
    frozen_delta_sum_for_event: await sql(`SELECT COALESCE(sum(frozen_delta),0)::text AS s FROM public.ledger_entry WHERE event_root_key = '${KEY_POS}'`),
    negative_key_row_counts: await sql(`SELECT
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:hold_single_leg')}') AS hold_single_leg,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:hold_and_escrow_one_leg_each')}') AS hold_and_escrow_one_leg_each,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:hold_two_cids')}') AS hold_two_cids,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:hold_three_legs_same_group')}') AS hold_three_legs_same_group,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:commission_credit_m1')}') AS commission_m1,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:listing_deposit_debit_m1')}') AS ld_debit_m1,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:listing_deposit_credit_m2')}') AS ld_credit_m2,
        (SELECT count(*)::int FROM public.ledger_entry WHERE event_root_key = '${keyOf('neg:listing_deposit_credit_m3')}') AS ld_credit_m3`),
  }));

  // ================= J. 本迁移文件原样重放（幂等/可重入，走 Pool 简单查询＝与 migrate.ts 同通道） =================
  await run('J_migration_0020_reapply_idempotent', async () => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { Pool, neonConfig } = require('@neondatabase/serverless') as {
      Pool: new (o: Record<string, unknown>) => { connect: () => Promise<{ query: (q: string) => Promise<unknown>; release: () => void }>; end: () => Promise<void> };
      neonConfig: Record<string, unknown>;
    };
    neonConfig.webSocketConstructor = require('ws');
    const txUrl = String(process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '');
    const pool = new Pool({ connectionString: txUrl, max: 1 });
    const client = await pool.connect();
    try {
      const body = fs.readFileSync(path.join(REPO, 'migrations', '0020_ledger_post_event_hold_family_drop_listing_deposit.sql'), 'utf8');
      await client.query(body);
      const after = (await client.query(`SELECT md5(pg_get_functiondef(p.oid)) AS md5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='ledger_post_event' AND n.nspname='public'`)) as { rows: Array<{ md5: string }> };
      return { re_applied_bytes: body.length, def_md5_after_reapply: after.rows[0].md5 };
    } finally {
      client.release();
      await pool.end().catch(() => undefined);
    }
  });

  fs.writeFileSync(path.join(outDir, 'b3afix2-02-verify.json'), JSON.stringify({ out, steps }, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3afix2-02-verify.json'));
  console.log('SUMMARY ' + JSON.stringify(out.deltas));
  const failed = Object.entries(steps).filter(([, v]) => (v as { ok: boolean }).ok === false).map(([k]) => k);
  console.log('FAILED_STEPS ' + JSON.stringify(failed));
};

main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
